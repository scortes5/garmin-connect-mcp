"""Cached Strava responses -> fields merged into the dashboard dataset.

A Strava activity uploaded by Garmin carries the Garmin activity ID in ``external_id``; it
enriches that Garmin activity. Otherwise activities are matched by start time (within two
minutes, same sport group). Strava activities with no Garmin twin are added on their own,
marked ``src: "strava"``.
"""

import re
from datetime import datetime
from typing import Any

from .cache import ChunkCache
from .strava import (
    ATHLETE_SOURCE,
    DETAIL_SOURCE,
    LIST_SOURCE,
    ZONES_SOURCE,
    garmin_id_of,
    is_connected,
    strava_meta,
)

MATCH_SECONDS = 120


def _num(value: Any, scale: float = 1.0, digits: int = 1) -> float | int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        out = float(value) * scale
    except (TypeError, ValueError):
        return None
    return int(round(out)) if digits == 0 else round(out, digits)


def type_key(sport_type: str) -> str:
    """Strava ``VirtualRide`` -> Garmin-style ``virtual_ride``."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", sport_type or "Workout").lower()


def _zone_minutes(zones: Any, kind: str) -> list[float] | None:
    for z in zones or []:
        if z.get("type") == kind:
            mins = [
                round((b.get("time") or 0) / 60, 1) for b in z.get("distribution_buckets") or []
            ]
            return mins if any(mins) else None
    return None


def _extras(s: dict[str, Any], detail: dict[str, Any] | None, zones: Any, gear_names: dict) -> dict:
    """Strava-only fields of one activity, compact keys, omitted when absent."""
    d = detail or {}
    best = {
        e["name"]: [e.get("elapsed_time"), e.get("pr_rank")]
        for e in d.get("best_efforts") or []
        if e.get("name") and e.get("elapsed_time")
    }
    splits = [
        {
            "k": sp.get("split"),
            "km": _num(sp.get("distance"), 1 / 1000, 2),
            "s": sp.get("moving_time") or sp.get("elapsed_time"),
            "elev": _num(sp.get("elevation_difference"), digits=0),
            "hr": _num(sp.get("average_heartrate"), digits=0),
            "kmh": _num(sp.get("average_speed"), 3.6, 1),
        }
        for sp in d.get("splits_metric") or []
    ]
    segs = [
        {
            "name": e.get("name"),
            "s": e.get("elapsed_time"),
            "km": _num(e.get("distance"), 1 / 1000, 2),
            "grade": _num((e.get("segment") or {}).get("average_grade")),
            "hr": _num(e.get("average_heartrate"), digits=0),
            "w": _num(e.get("average_watts"), digits=0),
            "pr": e.get("pr_rank"),
            "kom": e.get("kom_rank"),
        }
        for e in d.get("segment_efforts") or []
    ]
    laps = [
        {
            "name": lap.get("name"),
            "s": lap.get("moving_time") or lap.get("elapsed_time"),
            "km": _num(lap.get("distance"), 1 / 1000, 2),
            "hr": _num(lap.get("average_heartrate"), digits=0),
            "w": _num(lap.get("average_watts"), digits=0),
            "kmh": _num(lap.get("average_speed"), 3.6, 1),
        }
        for lap in d.get("laps") or []
    ]
    gear_id = s.get("gear_id")
    out = {
        "sid": s.get("id"),
        "sportType": s.get("sport_type") or s.get("type"),
        "kudos": s.get("kudos_count"),
        "achievements": s.get("achievement_count"),
        "prCount": s.get("pr_count"),
        "comments": s.get("comment_count"),
        "relEffort": _num(s.get("suffer_score"), digits=0),
        "kj": _num(s.get("kilojoules"), digits=0),
        "wAvgW": _num(s.get("weighted_average_watts"), digits=0),
        "maxKmh": _num(s.get("max_speed"), 3.6, 1),
        "elevHigh": _num(s.get("elev_high"), digits=0),
        "elevLow": _num(s.get("elev_low"), digits=0),
        "gear": (d.get("gear") or {}).get("name") or gear_names.get(gear_id),
        "gearId": gear_id,
        "device": d.get("device_name"),
        "rpe": d.get("perceived_exertion"),
        "desc": d.get("description") or None,
        "commute": True if s.get("commute") else None,
        "trainer": True if s.get("trainer") else None,
        "hrZonesS": _zone_minutes(zones, "heartrate"),
        "pwrZonesS": _zone_minutes(zones, "power"),
        "best": best or None,
        "splits": splits or None,
        "segs": segs or None,
        "laps": laps if len(laps) > 1 else None,
    }
    return {k: v for k, v in out.items() if v is not None}


def _standalone(s: dict[str, Any], sport_of: Any) -> dict[str, Any] | None:
    """A Strava activity with no Garmin twin, in the dataset's activity shape."""
    start = str(s.get("start_date_local") or "").replace("T", " ").rstrip("Z")
    if len(start) < 16:
        return None
    key = type_key(s.get("sport_type") or s.get("type") or "")
    elapsed = s.get("elapsed_time") or 0
    hour = int(start[11:13]) + int(start[14:16]) / 60
    out = {
        "id": f"s{s.get('id')}",
        "date": start[:10],
        "start": start[:16],
        "type": key,
        "sport": sport_of(key),
        "name": s.get("name") or key,
        "km": _num(s.get("distance"), 1 / 1000, 2) or None,
        "min": _num(elapsed, 1 / 60, 1),
        "movMin": _num(s.get("moving_time"), 1 / 60, 1),
        "elev": _num(s.get("total_elevation_gain"), digits=0) or None,
        "kmh": _num(s.get("average_speed"), 3.6, 1) or None,
        "hr": _num(s.get("average_heartrate"), digits=0),
        "hrMax": _num(s.get("max_heartrate"), digits=0),
        "kcal": _num(s.get("calories"), digits=0),
        "watts": _num(s.get("average_watts"), digits=0),
        "np": _num(s.get("weighted_average_watts"), digits=0),
        "wMax": _num(s.get("max_watts"), digits=0),
        "cad": _num(s.get("average_cadence"), digits=0),
        "end": round(hour + elapsed / 3600, 2),
        "src": "strava",
    }
    return {k: v for k, v in out.items() if v is not None}


def _parse(text: str) -> datetime | None:
    try:
        return datetime.fromisoformat(text.replace("Z", "").replace(" ", "T"))
    except ValueError:
        return None


def merge_strava(
    cache: ChunkCache, acts: list[dict[str, Any]], sport_of: Any
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Enrich Garmin activities with Strava fields and add Strava-only ones.

    Returns the merged activity list and the ``strava`` block of the dataset (``None`` when
    Strava was never connected or synced).
    """
    listed: dict[Any, dict[str, Any]] = {}
    for _, _, payload in cache.iter_source(LIST_SOURCE):
        for s in payload or []:
            if s.get("id") is not None:
                listed[s["id"]] = s
    connected = is_connected(cache)
    if not listed and not connected:
        return acts, None

    profile = cache.get_doc(ATHLETE_SOURCE, "profile") or {}
    gear = [
        {**g, "kind": kind}
        for kind, items in (("bike", profile.get("bikes")), ("shoes", profile.get("shoes")))
        for g in items or []
    ]
    gear_names = {g["id"]: g.get("name") for g in gear if g.get("id")}

    for a in acts:
        a.setdefault("src", "garmin")
    by_garmin_id = {a["id"]: a for a in acts if isinstance(a.get("id"), int)}
    by_day: dict[str, list[dict[str, Any]]] = {}
    for a in acts:
        by_day.setdefault(a["date"], []).append(a)

    def twin(s: dict[str, Any]) -> dict[str, Any] | None:
        gid = garmin_id_of(s)
        if gid in by_garmin_id:
            return by_garmin_id[gid]
        when = _parse(str(s.get("start_date_local") or ""))
        if when is None:
            return None
        sport = sport_of(type_key(s.get("sport_type") or s.get("type") or ""))
        for a in by_day.get(when.date().isoformat(), []):
            start = _parse(a["start"])
            if (
                a["src"] == "garmin"
                and start
                and abs((start - when).total_seconds()) <= MATCH_SECONDS
                and a["sport"] == sport
            ):
                return a
        return None

    merged = list(acts)
    for sid, s in listed.items():
        detail = cache.get_doc(DETAIL_SOURCE, str(sid))
        zones = cache.get_doc(ZONES_SOURCE, str(sid))
        source = {**s, **(detail or {})}
        extras = _extras(source, detail, zones, gear_names)
        target = twin(s)
        if target is not None:
            target.update(extras)
            target["src"] = "both"
            for key, value in (
                ("kcal", _num(source.get("calories"), digits=0)),
                ("np", extras.get("wAvgW")),
                ("watts", _num(source.get("average_watts"), digits=0)),
            ):
                if key not in target and value is not None:
                    target[key] = value
        else:
            base = _standalone(source, sport_of)
            if base:
                merged.append({**base, **extras})
    merged.sort(key=lambda a: a["start"])

    zones_doc = cache.get_doc(ATHLETE_SOURCE, "zones") or {}
    stats = cache.get_doc(ATHLETE_SOURCE, "stats") or {}
    meta = strava_meta(cache)

    def bounds(kind: str) -> list[list[int]] | None:
        zs = ((zones_doc.get(kind) or {}).get("zones")) or []
        return [[z.get("min"), z.get("max")] for z in zs] or None

    def totals(key: str) -> dict[str, Any] | None:
        t = stats.get(key) or {}
        if not t.get("count"):
            return None
        return {
            "count": t["count"],
            "km": _num(t.get("distance"), 1 / 1000, 0),
            "h": _num(t.get("moving_time"), 1 / 3600, 0),
            "elev": _num(t.get("elevation_gain"), digits=0),
        }

    block = {
        "connected": connected,
        "lastSync": meta.get("last_sync"),
        "pending": meta.get("pending_details", 0),
        "errors": meta.get("errors") or [],
        "activities": len(listed),
        "detailed": sum(1 for sid in listed if cache.has_doc(DETAIL_SOURCE, str(sid))),
        "ftp": profile.get("ftp"),
        "weight": profile.get("weight"),
        "hrZones": bounds("heart_rate"),
        "powerZones": bounds("power"),
        "gear": [
            {
                "id": g.get("id"),
                "name": g.get("name"),
                "kind": g["kind"],
                "km": _num(g.get("distance"), 1 / 1000, 0),
                "primary": bool(g.get("primary")),
                "retired": bool(g.get("retired")),
            }
            for g in gear
        ],
        "totals": {
            k: v
            for k, v in (
                ("ride", totals("all_ride_totals")),
                ("run", totals("all_run_totals")),
                ("swim", totals("all_swim_totals")),
            )
            if v
        },
        "biggestRideKm": _num(stats.get("biggest_ride_distance"), 1 / 1000, 1),
        "biggestClimbM": _num(stats.get("biggest_climb_elevation_gain"), digits=0),
    }
    return merged, block
