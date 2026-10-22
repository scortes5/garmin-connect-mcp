"""Strava: OAuth connection, a rate-limit-aware API client and incremental sync into the cache.

Strava complements Garmin with what only Strava has: heart-rate and power zones as you set
them on Strava, time in those zones per activity, running best efforts (400 m … marathon),
per-km splits, segment efforts, relative effort, kudos and gear mileage. Activities recorded
elsewhere (a phone, Zwift, another watch) also show up here.

Strava allows 100 read requests per 15 minutes and 1,000 per day. Activity lists are cheap
(200 per request); full detail costs two requests per activity, so details are fetched
newest first within a budget and the rest continue on the next sync.

Like Garmin activities, Strava responses are stripped of identity and coordinates before
they reach the disk.
"""

import json
import re
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx

from ..auth import write_private_file
from .cache import ChunkCache
from .sources import windows

API = "https://www.strava.com/api/v3"
AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"
# activity:read_all includes private activities; profile:read_all gives zones and gear.
SCOPES = "read,activity:read_all,profile:read_all"
SETTINGS_URL = "https://www.strava.com/settings/api"

# Same rule as Garmin: recent windows are refreshed (late uploads, edited titles).
SETTLE_DAYS = 7
PAGE_SIZE = 200
# Leave headroom under Strava's 15-minute read limit for the user's other apps.
SHORT_LIMIT_MARGIN = 10
DAILY_LIMIT_MARGIN = 50
REQUEST_PAUSE_SECONDS = 0.1

LIST_SOURCE = "strava_activities"
DETAIL_SOURCE = "strava_activity"
ZONES_SOURCE = "strava_zones"
ATHLETE_SOURCE = "strava_athlete"


class StravaError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class RateLimited(StravaError):
    """Strava's request budget is spent for now; the sync resumes next time."""


class NotConnected(StravaError):
    pass


def credentials_path(cache: ChunkCache) -> Path:
    return cache.root / "strava.json"


def load_credentials(cache: ChunkCache) -> dict[str, Any]:
    path = credentials_path(cache)
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_credentials(cache: ChunkCache, creds: dict[str, Any]) -> None:
    cache.root.mkdir(mode=0o700, parents=True, exist_ok=True)
    write_private_file(credentials_path(cache), json.dumps(creds, indent=2))


def is_connected(cache: ChunkCache) -> bool:
    return bool(load_credentials(cache).get("refresh_token"))


def disconnect(cache: ChunkCache) -> None:
    credentials_path(cache).unlink(missing_ok=True)


# ------------------------------------------------------------------------------- OAuth
@dataclass
class PendingAuth:
    """An authorization in progress: what the callback must echo back."""

    client_id: str
    client_secret: str
    redirect_uri: str
    state: str = field(default_factory=lambda: secrets.token_urlsafe(24))

    @property
    def url(self) -> str:
        query = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "approval_prompt": "auto",
            "scope": SCOPES,
            "state": self.state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(query)}"


def finish_auth(
    cache: ChunkCache,
    pending: PendingAuth,
    params: dict[str, str],
    http: httpx.Client | None = None,
) -> dict[str, Any]:
    """Validate Strava's redirect, trade the code for tokens and save them ``0600``.

    Returns the athlete Strava sent with the tokens (first name only is used, for a greeting).
    """
    if params.get("error"):
        raise StravaError(f"Strava did not authorize the connection: {params['error']}")
    if not secrets.compare_digest(params.get("state", ""), pending.state):
        raise StravaError("The answer from Strava does not match this request (state).")
    granted = set((params.get("scope") or "").split(","))
    if "activity:read_all" not in granted and "activity:read" not in granted:
        raise StravaError("Strava was connected without access to activities; try again.")
    http = http or httpx.Client(timeout=30)
    res = http.post(
        TOKEN_URL,
        data={
            "client_id": pending.client_id,
            "client_secret": pending.client_secret,
            "code": params.get("code", ""),
            "grant_type": "authorization_code",
        },
    )
    if res.status_code != 200:
        raise StravaError(f"Strava rejected the authorization code (HTTP {res.status_code}).")
    body = res.json()
    athlete = body.get("athlete") or {}
    save_credentials(
        cache,
        {
            "client_id": pending.client_id,
            "client_secret": pending.client_secret,
            "access_token": body["access_token"],
            "refresh_token": body["refresh_token"],
            "expires_at": body["expires_at"],
            "athlete_id": athlete.get("id"),
            "scope": ",".join(sorted(granted)),
        },
    )
    return athlete


# ------------------------------------------------------------------------------- client
class StravaAPI:
    """Minimal Strava v3 client: refreshes tokens and tracks the read rate limit."""

    def __init__(
        self,
        cache: ChunkCache,
        http: httpx.Client | None = None,
        now: Callable[[], float] = time.time,
    ):
        self.cache = cache
        self.creds = load_credentials(cache)
        if not self.creds.get("refresh_token"):
            raise NotConnected("Strava is not connected. Run: pulso dashboard strava")
        self.http = http or httpx.Client(timeout=30)
        self.now = now
        # [used, limit] for the 15-minute and daily windows, from Strava's response headers.
        self.short = [0, 100]
        self.daily = [0, 1000]

    def _token(self) -> str:
        if self.creds.get("expires_at", 0) - 60 > self.now():
            return self.creds["access_token"]
        res = self.http.post(
            TOKEN_URL,
            data={
                "client_id": self.creds["client_id"],
                "client_secret": self.creds["client_secret"],
                "grant_type": "refresh_token",
                "refresh_token": self.creds["refresh_token"],
            },
        )
        if res.status_code in (400, 401):
            raise NotConnected(
                "Strava access was revoked or expired. Connect again: pulso dashboard strava"
            )
        res.raise_for_status()
        body = res.json()
        self.creds.update(
            access_token=body["access_token"],
            refresh_token=body["refresh_token"],
            expires_at=body["expires_at"],
        )
        save_credentials(self.cache, self.creds)
        return self.creds["access_token"]

    def remaining(self) -> int:
        """Requests left before the margin, in the tighter of the two windows."""
        return min(
            self.short[1] - SHORT_LIMIT_MARGIN - self.short[0],
            self.daily[1] - DAILY_LIMIT_MARGIN - self.daily[0],
        )

    def _track(self, headers: httpx.Headers) -> None:
        # Read requests have their own (smaller) limit; fall back to the overall one.
        limit = headers.get("x-readratelimit-limit") or headers.get("x-ratelimit-limit")
        usage = headers.get("x-readratelimit-usage") or headers.get("x-ratelimit-usage")
        if limit and usage:
            (ls, ld), (us, ud) = (map(int, v.split(",")[:2]) for v in (limit, usage))
            self.short, self.daily = [us, ls], [ud, ld]

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        if self.remaining() <= 0:
            raise RateLimited("Strava's request limit is reached; the rest continues next sync.")
        res = self.http.get(
            f"{API}{path}", params=params, headers={"Authorization": f"Bearer {self._token()}"}
        )
        self._track(res.headers)
        if res.status_code == 429:
            raise RateLimited("Strava's request limit is reached; the rest continues next sync.")
        if res.status_code == 401:
            raise NotConnected("Strava access was revoked. Connect again from the dashboard.")
        if res.status_code >= 400:
            raise StravaError(f"Strava {path}: HTTP {res.status_code}", res.status_code)
        return res.json()


# ------------------------------------------------------------------------------- privacy
_DROP = {
    "map", "start_latlng", "end_latlng", "athlete", "photos", "private_note",
    "embed_token", "similar_activities", "available_zones", "highlighted_kudosers",
}  # fmt: skip


def _strip_segment_effort(e: dict[str, Any]) -> dict[str, Any]:
    seg = e.get("segment") or {}
    return {
        "name": e.get("name") or seg.get("name"),
        "elapsed_time": e.get("elapsed_time"),
        "moving_time": e.get("moving_time"),
        "distance": e.get("distance"),
        "average_heartrate": e.get("average_heartrate"),
        "average_watts": e.get("average_watts"),
        "pr_rank": e.get("pr_rank"),
        "kom_rank": e.get("kom_rank"),
        "start_date_local": e.get("start_date_local"),
        "segment": {
            k: seg.get(k)
            for k in ("id", "name", "distance", "average_grade", "maximum_grade", "climb_category")
        },
    }


def strip_activity(a: dict[str, Any]) -> dict[str, Any]:
    """Drop identity, maps and coordinates from a Strava activity (summary or detail)."""
    out = {k: v for k, v in a.items() if k not in _DROP}
    if "segment_efforts" in out:
        out["segment_efforts"] = [_strip_segment_effort(e) for e in out["segment_efforts"] or []]
    for key in ("laps", "best_efforts"):
        if key in out:
            out[key] = [
                {k: v for k, v in item.items() if k not in ("athlete", "activity")}
                for item in out[key] or []
            ]
    if isinstance(out.get("gear"), dict):
        out["gear"] = {k: out["gear"].get(k) for k in ("id", "name", "distance", "primary")}
    return out


def _strip_athlete(a: dict[str, Any]) -> dict[str, Any]:
    """Keep what the dashboard uses: units, FTP, weight and gear. No name, photo or city."""
    gear = lambda items: [  # noqa: E731
        {k: g.get(k) for k in ("id", "name", "distance", "primary", "retired")} for g in items or []
    ]
    return {
        "id": a.get("id"),
        "measurement_preference": a.get("measurement_preference"),
        "ftp": a.get("ftp"),
        "weight": a.get("weight"),
        "bikes": gear(a.get("bikes")),
        "shoes": gear(a.get("shoes")),
    }


# ------------------------------------------------------------------------------- sync
@dataclass
class StravaReport:
    fetched: int = 0
    cached: int = 0
    pending_details: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)


def _epoch(d: date) -> int:
    return int(datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp())


def list_window(api: StravaAPI, start: date, end: date) -> list[dict[str, Any]]:
    """Every activity that started in ``start..end`` (UTC bounds padded by a day)."""
    after, before = _epoch(start - timedelta(days=1)), _epoch(end + timedelta(days=2))
    out: list[dict[str, Any]] = []
    page = 1
    while True:
        batch = api.get(
            "/athlete/activities",
            {"after": after, "before": before, "page": page, "per_page": PAGE_SIZE},
        )
        out.extend(
            strip_activity(a)
            for a in batch or []
            if start.isoformat() <= str(a.get("start_date_local", ""))[:10] <= end.isoformat()
        )
        if len(batch or []) < PAGE_SIZE:
            return out
        page += 1


def sync_strava(
    api: StravaAPI,
    cache: ChunkCache,
    *,
    first_year: int,
    today: date | None = None,
    full: bool = False,
    on_step: Callable[[int, int, str], None] | None = None,
    progress: Callable[[str], None] | None = None,
    pause: float = REQUEST_PAUSE_SECONDS,
) -> StravaReport:
    """Profile, zones and stats; activity lists per year; then details newest first."""
    today = today or date.today()
    report = StravaReport()
    settled_before = today - timedelta(days=SETTLE_DAYS)

    todo: list[tuple[str, Any]] = [("athlete", None), ("zones", None), ("stats", None)]
    for start, end in windows(first_year, today, 366):
        if not full and end < settled_before and cache.has(LIST_SOURCE, start, end):
            report.cached += 1
        else:
            todo.append(("list", (start, end)))

    def run(step: tuple[str, Any]) -> None:
        kind, arg = step
        if kind == "athlete":
            cache.put_doc(ATHLETE_SOURCE, "profile", _strip_athlete(api.get("/athlete")))
        elif kind == "zones":
            cache.put_doc(ATHLETE_SOURCE, "zones", api.get("/athlete/zones"))
        elif kind == "stats":
            athlete_id = api.creds.get("athlete_id") or (
                cache.get_doc(ATHLETE_SOURCE, "profile") or {}
            ).get("id")
            if athlete_id:
                cache.put_doc(ATHLETE_SOURCE, "stats", api.get(f"/athletes/{athlete_id}/stats"))
        elif kind == "list":
            start, end = arg
            payload = list_window(api, start, end)
            cache.drop_overlapping(LIST_SOURCE, start, end)
            cache.put(LIST_SOURCE, start, end, payload)
        elif kind == "detail":
            cache.put_doc(DETAIL_SOURCE, str(arg), strip_activity(api.get(f"/activities/{arg}")))
        elif kind == "zones_of":
            try:
                zones = api.get(f"/activities/{arg}/zones")
            except StravaError as exc:
                # A definite "no" (e.g. zones not available for this account or activity) is
                # remembered as "no zones", or every sync would spend its budget asking again.
                if exc.status not in (402, 403, 404):
                    raise
                zones = []
            cache.put_doc(ZONES_SOURCE, str(arg), zones)

    def label(step: tuple[str, Any]) -> str:
        kind, arg = step
        if kind == "list":
            return f"strava list       {arg[0]} → {arg[1]}"
        return f"strava {kind:<10} {arg or ''}"

    done = 0
    stopped = False

    def execute(steps: list[tuple[str, Any]], total: int) -> None:
        nonlocal done, stopped
        for step in steps:
            if stopped:
                return
            if on_step:
                on_step(done, total, "strava")
            if progress:
                progress(label(step))
            try:
                run(step)
                report.fetched += 1
            except RateLimited as exc:
                report.errors.append({"source": "strava", "window": step[0], "error": str(exc)})
                stopped = True
                return
            except NotConnected:
                raise
            except Exception as exc:  # one failing request must not abort the sync
                report.errors.append(
                    {"source": "strava", "window": f"{step[0]} {step[1] or ''}".strip(),
                     "error": str(exc)[:300]}
                )  # fmt: skip
            done += 1
            if pause:
                time.sleep(pause)

    execute(todo, len(todo))

    # Details for activities not fetched yet, newest first, while the budget lasts.
    missing = [
        a["id"]
        for a in sorted(_listed(cache), key=lambda a: a.get("start_date", ""), reverse=True)
        if not cache.has_doc(DETAIL_SOURCE, str(a["id"])) or not cache.has_doc(ZONES_SOURCE, str(a["id"]))
    ]  # fmt: skip
    detail_steps: list[tuple[str, Any]] = []
    for activity_id in missing:
        if not cache.has_doc(DETAIL_SOURCE, str(activity_id)):
            detail_steps.append(("detail", activity_id))
        if not cache.has_doc(ZONES_SOURCE, str(activity_id)):
            detail_steps.append(("zones_of", activity_id))
    budget = max(0, api.remaining()) if not stopped else 0
    total = done + min(len(detail_steps), budget)
    execute(detail_steps[:budget], total)
    report.pending_details = len(
        [
            i
            for i in missing
            if not (cache.has_doc(DETAIL_SOURCE, str(i)) and cache.has_doc(ZONES_SOURCE, str(i)))
        ]
    )
    if on_step:
        on_step(done, done, "")

    write_private_file(
        cache.root / "strava-meta.json",
        json.dumps(
            {
                "last_sync": datetime.now().astimezone().isoformat(timespec="seconds"),
                "pending_details": report.pending_details,
                "errors": report.errors,
            },
            indent=2,
        ),
    )
    return report


def _listed(cache: ChunkCache) -> list[dict[str, Any]]:
    out: dict[Any, dict[str, Any]] = {}
    for _, _, payload in cache.iter_source(LIST_SOURCE):
        for a in payload or []:
            if a.get("id") is not None:
                out[a["id"]] = a
    return list(out.values())


def strava_meta(cache: ChunkCache) -> dict[str, Any]:
    path = cache.root / "strava-meta.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


# ------------------------------------------------------------------------------- matching
_GARMIN_EXTERNAL_ID = re.compile(r"garmin_\w*?_?(\d{6,})")


def garmin_id_of(strava_activity: dict[str, Any]) -> int | None:
    """Garmin activity ID from the ``external_id`` Garmin sets when it uploads to Strava."""
    match = _GARMIN_EXTERNAL_ID.search(str(strava_activity.get("external_id") or ""))
    return int(match.group(1)) if match else None


class StravaLink:
    """Connecting from the app or the terminal: ``start`` gives Strava's authorization URL,
    ``finish`` handles the redirect back to this computer."""

    def __init__(self, cache: ChunkCache, http: httpx.Client | None = None):
        self.cache = cache
        self.http = http
        self.pending: PendingAuth | None = None

    def start(self, client_id: str, client_secret: str, redirect_uri: str) -> str:
        client_id, client_secret = client_id.strip(), client_secret.strip()
        if not client_id.isdigit() or not re.fullmatch(r"[0-9a-f]{20,64}", client_secret):
            raise StravaError(
                "That does not look like a Strava Client ID (a number) and Client Secret "
                f"(40 hex characters). Copy both from {SETTINGS_URL}"
            )
        self.pending = PendingAuth(client_id, client_secret, redirect_uri)
        return self.pending.url

    def finish(self, params: dict[str, str]) -> dict[str, Any]:
        if self.pending is None:
            raise StravaError("No Strava connection was started from this window.")
        athlete = finish_auth(self.cache, self.pending, params, self.http)
        self.pending = None
        return athlete
