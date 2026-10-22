"""Turn cached raw Garmin responses into one compact, chart-ready dataset."""

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any

from .cache import ChunkCache

# Time constants of the classic fitness/fatigue model (Banister; CTL/ATL in TrainingPeaks).
ATL_DAYS = 7
CTL_DAYS = 42

# Order matters only for readability of the embedded JSON.
DAY_METRICS = (
    # activity & energy
    "steps", "stepGoal", "floors", "kcal", "kcalActive", "imMod", "imVig",
    # heart, stress, body battery, breathing
    "rhr", "hrMin", "hrMax", "stress", "stressMax", "stressHighMin", "stressRestMin",
    "bbMax", "bbMin", "bbCharged", "bbDrained", "resp", "spo2",
    # sleep (labelled with the date you woke up)
    "sleepScore", "sleepH", "deepH", "remH", "lightH", "awakeH", "sleepNeedH",
    "bedtime", "wake", "skinTemp", "bbSleep",
    # HRV and readiness
    "hrv", "hrvWeek", "hrvLow", "hrvHigh", "readiness", "recoveryH",
    # Garmin training status
    "acute", "chronic", "acwr", "tStatus",
    # derived from activities
    "actN", "actMin", "actKm", "actElev", "actLoad", "lastEnd", "atl", "ctl", "tsb",
)  # fmt: skip


def sport_of(type_key: str) -> str:
    """Collapse Garmin's ~60 activity types into the groups a dashboard can colour."""
    t = (type_key or "").lower()
    if any(k in t for k in ("cycl", "biking", "ride", "bmx")):
        return "cycling"
    if "run" in t:
        return "running"
    if "swim" in t:
        return "swimming"
    if any(k in t for k in ("walk", "hik")):
        return "walking"
    if any(k in t for k in ("strength", "cardio", "hiit", "yoga", "pilates", "mobility")):
        return "gym"
    return "other"


def _num(value: Any, scale: float = 1.0, digits: int = 1) -> float | int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        out = float(value) * scale
    except (TypeError, ValueError):
        return None
    return int(round(out)) if digits == 0 else round(out, digits)


def _local_hour(millis: Any, *, evening_wrap: bool = False) -> float | None:
    """Hour of day from Garmin's "local millis" (local wall time encoded as if it were UTC).

    With ``evening_wrap`` an early-morning bedtime (01:30) becomes 25.5 so that going to
    bed later always means a bigger number.
    """
    if not isinstance(millis, int | float):
        return None
    moment = datetime.fromtimestamp(millis / 1000, UTC)
    hour = moment.hour + moment.minute / 60
    if evening_wrap and hour < 12:
        hour += 24
    return round(hour, 2)


def _clock_hour(text: Any) -> float | None:
    if not text:
        return None
    try:
        moment = datetime.fromisoformat(str(text).replace("Z", ""))
    except ValueError:
        return None
    return round(moment.hour + moment.minute / 60, 2)


class _Days:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = defaultdict(dict)

    def set(self, day: str | None, **values: Any) -> None:
        if not day:
            return
        row = self.rows[day[:10]]
        for key, value in values.items():
            if value is not None:
                row[key] = value


def _daily_summaries(days: _Days, payload: Any) -> None:
    for d in (payload or {}).get("data") or []:
        if not d.get("includesWellnessData") and not d.get("includesActivityData"):
            continue
        mv = d.get("movement") or {}
        steps = mv.get("steps") or {}
        cal = d.get("calories") or {}
        hr = d.get("heartRate") or {}
        im = d.get("intensityMinutes") or {}
        st = d.get("stress") or {}
        bb = d.get("bodyBattery") or {}
        days.set(
            d.get("calendarDate"),
            steps=_num(steps.get("value"), digits=0),
            stepGoal=_num(steps.get("goal"), digits=0),
            floors=_num((mv.get("floorsAscended") or {}).get("value"), digits=0),
            kcal=_num(cal.get("burnedTotal"), digits=0),
            kcalActive=_num(cal.get("burnedActive"), digits=0),
            rhr=_num(hr.get("restingValue"), digits=0),
            hrMin=_num(hr.get("minValue"), digits=0),
            hrMax=_num(hr.get("maxValue"), digits=0),
            imMod=_num(im.get("moderate"), digits=0),
            imVig=_num(im.get("vigorous"), digits=0),
            stress=_num(st.get("avgLevel"), digits=0) if (st.get("avgLevel") or -1) >= 0 else None,
            stressMax=_num(st.get("maxLevel"), digits=0),
            stressHighMin=_num(st.get("highStressDurationInMillis"), 1 / 60000, 0),
            stressRestMin=_num(st.get("restDurationInMillis"), 1 / 60000, 0),
            bbMax=_num(bb.get("maxValue"), digits=0),
            bbMin=_num(bb.get("minValue"), digits=0),
            bbCharged=_num(bb.get("chargedValue"), digits=0),
            bbDrained=_num(bb.get("drainedValue"), digits=0),
            resp=_num((d.get("respiration") or {}).get("avgValue")),
            spo2=_num((d.get("pulseOx") or {}).get("avgValue")),
        )


def _sleep(days: _Days, payload: Any) -> None:
    for entry in payload or []:
        v = entry.get("values") or {}
        if not v.get("totalSleepTimeInSeconds"):
            continue
        days.set(
            entry.get("calendarDate"),
            sleepScore=_num(v.get("sleepScore"), digits=0),
            sleepH=_num(v.get("totalSleepTimeInSeconds"), 1 / 3600, 2),
            deepH=_num(v.get("deepTime"), 1 / 3600, 2),
            remH=_num(v.get("remTime"), 1 / 3600, 2),
            lightH=_num(v.get("lightTime"), 1 / 3600, 2),
            awakeH=_num(v.get("awakeTime"), 1 / 3600, 2),
            sleepNeedH=_num(v.get("sleepNeed"), 1 / 60, 2),
            bedtime=_local_hour(v.get("localSleepStartTimeInMillis"), evening_wrap=True),
            wake=_local_hour(v.get("localSleepEndTimeInMillis")),
            skinTemp=_num(v.get("skinTempC"), digits=2),
            bbSleep=_num(v.get("bodyBatteryChange"), digits=0),
        )


def _hrv(days: _Days, payload: Any) -> None:
    for h in (payload or {}).get("hrvSummaries") or []:
        base = h.get("baseline") or {}
        days.set(
            h.get("calendarDate"),
            hrv=_num(h.get("lastNightAvg"), digits=0),
            hrvWeek=_num(h.get("weeklyAvg"), digits=0),
            hrvLow=_num(base.get("balancedLow"), digits=0),
            hrvHigh=_num(base.get("balancedUpper"), digits=0),
        )


def _readiness(days: _Days, payload: Any) -> None:
    """Garmin recalculates readiness during the day; keep the morning value."""
    by_day: dict[str, dict[str, Any]] = {}
    for r in payload or []:
        day = r.get("calendarDate")
        if not day or r.get("score") is None:
            continue
        current = by_day.get(day)
        is_morning = r.get("inputContext") == "AFTER_WAKEUP_RESET"
        if (
            current is None
            or (is_morning and current.get("inputContext") != "AFTER_WAKEUP_RESET")
            or (
                is_morning == (current.get("inputContext") == "AFTER_WAKEUP_RESET")
                and str(r.get("timestamp")) < str(current.get("timestamp"))
            )
        ):
            by_day[day] = r
    for day, r in by_day.items():
        days.set(
            day,
            readiness=_num(r.get("score"), digits=0),
            recoveryH=_num(r.get("recoveryTime"), 1 / 60, 1),
        )


def _training_status(days: _Days, payload: Any) -> None:
    rows_by_device = (payload or {}).get("reportData") or {}
    all_rows = [row for rows in rows_by_device.values() for row in rows or []]
    primary = [r for r in all_rows if r.get("primaryTrainingDevice")]
    for r in primary or all_rows:
        acute = r.get("acuteTrainingLoadDTO") or {}
        days.set(
            r.get("calendarDate"),
            acute=_num(acute.get("dailyTrainingLoadAcute"), digits=0),
            chronic=_num(acute.get("dailyTrainingLoadChronic"), digits=0),
            acwr=_num(acute.get("dailyAcuteChronicWorkloadRatio"), digits=2),
            tStatus=_num(r.get("trainingStatus"), digits=0),
        )


def _activity(a: dict[str, Any]) -> dict[str, Any] | None:
    start = a.get("startTimeLocal")
    if not start:
        return None
    type_key = (a.get("activityType") or {}).get("typeKey") or "other"
    duration = a.get("duration") or 0
    zones = [_num(a.get(f"hrTimeInZone_{i}"), 1 / 60, 1) or 0 for i in range(1, 6)]
    best_power = {
        str(s): a[f"maxAvgPower_{s}"]
        for s in (5, 10, 30, 60, 120, 300, 600, 1200, 1800, 3600)
        if a.get(f"maxAvgPower_{s}")
    }
    end_hour = _clock_hour(start)
    if end_hour is not None:
        end_hour = round(end_hour + duration / 3600, 2)
    out = {
        "id": a.get("activityId"),
        "date": str(start)[:10],
        "start": str(start)[:16],
        "type": type_key,
        "sport": sport_of(type_key),
        "name": a.get("activityName") or type_key,
        "place": a.get("locationName"),
        "km": _num(a.get("distance"), 1 / 1000, 2),
        "min": _num(duration, 1 / 60, 1),
        "movMin": _num(a.get("movingDuration"), 1 / 60, 1),
        "elev": _num(a.get("elevationGain"), digits=0),
        "kmh": _num(a.get("averageSpeed"), 3.6, 1),
        "hr": _num(a.get("averageHR"), digits=0),
        "hrMax": _num(a.get("maxHR"), digits=0),
        "kcal": _num(a.get("calories"), digits=0),
        "watts": _num(a.get("avgPower"), digits=0),
        "np": _num(a.get("normPower"), digits=0),
        "wMax": _num(a.get("maxPower"), digits=0),
        "tss": _num(a.get("trainingStressScore"), digits=0),
        "if": _num(a.get("intensityFactor"), digits=2),
        "te": _num(a.get("aerobicTrainingEffect")),
        "ta": _num(a.get("anaerobicTrainingEffect")),
        "load": _num(a.get("activityTrainingLoad"), digits=0),
        "label": a.get("trainingEffectLabel"),
        "cad": _num(
            a.get("averageBikingCadenceInRevPerMinute")
            or a.get("averageRunningCadenceInStepsPerMinute"),
            digits=0,
        ),
        "vo2": _num(a.get("vO2MaxValue"), digits=0),
        "bb": _num(a.get("differenceBodyBattery"), digits=0),
        "tMin": _num(a.get("minTemperature"), digits=0),
        "tMax": _num(a.get("maxTemperature"), digits=0),
        "pr": bool(a.get("pr") or a.get("isPR")),
        "end": end_hour,
        "zones": zones if any(zones) else None,
        "power": best_power or None,
    }
    return {k: v for k, v in out.items() if v is not None}


def _fitness_load(days: _Days, first: date, last: date) -> None:
    """Exponentially weighted chronic/acute load and form, from Garmin activity load."""
    atl = ctl = 0.0
    k_atl = 1 - pow(2.718281828, -1 / ATL_DAYS)
    k_ctl = 1 - pow(2.718281828, -1 / CTL_DAYS)
    day = first
    while day <= last:
        key = day.isoformat()
        load = days.rows.get(key, {}).get("actLoad", 0) or 0
        tsb = ctl - atl  # form going into the day
        atl += (load - atl) * k_atl
        ctl += (load - ctl) * k_ctl
        days.set(key, atl=round(atl, 1), ctl=round(ctl, 1), tsb=round(tsb, 1))
        day += timedelta(days=1)


def build_dataset(cache: ChunkCache, *, today: date | None = None) -> dict[str, Any]:
    """Read the whole cache and return the dataset embedded in the dashboard."""
    today = today or date.today()
    days = _Days()

    for _, _, payload in cache.iter_source("daily_summaries"):
        _daily_summaries(days, payload)
    for _, _, payload in cache.iter_source("sleep"):
        _sleep(days, payload)
    for _, _, payload in cache.iter_source("hrv"):
        _hrv(days, payload)
    for _, _, payload in cache.iter_source("readiness"):
        _readiness(days, payload)
    for _, _, payload in cache.iter_source("training_status"):
        _training_status(days, payload)

    activities: dict[Any, dict[str, Any]] = {}
    for _, _, payload in cache.iter_source("activities"):
        for raw in payload or []:
            act = _activity(raw)
            if act:
                activities[act.get("id") or act["start"]] = act
    acts = sorted(activities.values(), key=lambda a: a["start"])

    per_day: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for a in acts:
        agg = per_day[a["date"]]
        agg["actN"] += 1
        agg["actMin"] += a.get("min", 0)
        agg["actKm"] += a.get("km", 0)
        agg["actElev"] += a.get("elev", 0)
        agg["actLoad"] += a.get("load", 0)
        agg["lastEnd"] = max(agg["lastEnd"], a.get("end", 0))
    for day, agg in per_day.items():
        days.set(day, **{k: round(v, 1) for k, v in agg.items()})
    # A day the watch recorded without any activity is a rest day: zero load, not unknown.
    # Without this, load correlations would only ever compare training days with each other.
    for row in days.rows.values():
        if "actN" not in row and ("steps" in row or "sleepH" in row):
            row.update(actN=0, actMin=0, actKm=0, actElev=0, actLoad=0)

    vo2: list[dict[str, Any]] = []
    for _, _, payload in cache.iter_source("max_metrics"):
        for entry in payload or []:
            for sport, key in (("running", "generic"), ("cycling", "cycling")):
                m = entry.get(key) or {}
                value = m.get("vo2MaxPreciseValue") or m.get("vo2MaxValue")
                if m.get("calendarDate") and value:
                    vo2.append(
                        {"date": m["calendarDate"], "sport": sport, "value": round(value, 1)}
                    )

    endurance: list[dict[str, Any]] = []
    for _, _, payload in cache.iter_source("endurance"):
        for week, g in ((payload or {}).get("groupMap") or {}).items():
            if g.get("groupAverage"):
                endurance.append({"date": week, "value": g["groupAverage"]})

    weight: list[dict[str, Any]] = []
    for _, _, payload in cache.iter_source("body_composition"):
        for w in (payload or {}).get("dateWeightList") or []:
            if w.get("calendarDate") and w.get("weight"):
                weight.append(
                    {
                        "date": w["calendarDate"],
                        "kg": round(w["weight"] / 1000, 1),
                        "fat": w.get("bodyFat"),
                        "bmi": _num(w.get("bmi")),
                    }
                )

    keys = sorted(k for k in days.rows if k <= today.isoformat())
    if keys:
        _fitness_load(days, date.fromisoformat(keys[0]), today)
        keys = sorted(k for k in days.rows if k <= today.isoformat())

    columns = {"date": keys}
    for metric in DAY_METRICS:
        columns[metric] = [days.rows[k].get(metric) for k in keys]

    meta = cache.meta()
    return {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "lastSync": meta.get("last_sync"),
        "syncErrors": meta.get("errors") or [],
        "years": sorted({k[:4] for k in keys} | {a["date"][:4] for a in acts}),
        "days": columns,
        "activities": acts,
        "vo2": _dedupe(vo2, ("date", "sport")),
        "endurance": _dedupe(endurance, ("date",)),
        "weight": _dedupe(weight, ("date",)),
    }


def _dedupe(rows: list[dict[str, Any]], key: tuple[str, ...]) -> list[dict[str, Any]]:
    seen = {tuple(r[k] for k in key): r for r in rows}
    return sorted(seen.values(), key=lambda r: tuple(r[k] for k in key))
