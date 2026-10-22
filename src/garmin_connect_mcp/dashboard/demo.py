"""Synthetic Garmin account for ``dashboard --demo``: try the dashboard without an account.

The demo client answers the same library calls as ``garminconnect.Garmin``, so the demo
runs through the real sync, cache, normalisation and analytics. The numbers are invented
but follow plausible physiology (hard days lower next-night HRV, late nights cost sleep
score, fitness builds over the season), so the correlation view has something to find.
"""

import math
import random
from datetime import date, timedelta
from typing import Any

YEARS_OF_HISTORY = 3

_SPORTS = (
    # typeKey, name, weight, minutes (mean), speed km/h, climb m/km, intensity
    ("road_biking", "Road ride", 0.45, 120, 28, 12, 1.0),
    ("virtual_ride", "Zwift session", 0.15, 60, 32, 6, 1.25),
    ("running", "Easy run", 0.22, 45, 11, 8, 1.1),
    ("strength_training", "Strength", 0.12, 45, 0, 0, 0.6),
    ("walking", "Walk", 0.06, 50, 5, 5, 0.3),
)


def _local_millis(day: date, hour: float) -> int:
    return int((day - date(1970, 1, 1)).days * 86_400_000 + hour * 3_600_000)


class DemoGarmin:
    """In-memory athlete with ``YEARS_OF_HISTORY`` years of daily data."""

    def __init__(self, today: date | None = None, seed: int = 7):
        self.today = today or date.today()
        self.start = date(self.today.year - YEARS_OF_HISTORY + 1, 1, 1)
        self.rng = random.Random(seed)
        self.days: dict[str, dict[str, Any]] = {}
        self.activities: list[dict[str, Any]] = []
        self._simulate()

    # -- simulation -------------------------------------------------------------------
    def _simulate(self) -> None:
        rng = self.rng
        ctl = atl = 20.0
        prev_load = 0.0
        day = self.start
        while day <= self.today:
            season = 0.5 + 0.5 * math.sin((day.timetuple().tm_yday - 30) / 365 * 2 * math.pi)
            weekend = day.weekday() >= 5
            p_train = (0.75 if weekend else 0.45) * (0.7 + 0.5 * season)
            load = 0.0
            if rng.random() < p_train:
                load = self._activity(day, weekend, season)
                if weekend and rng.random() < 0.15:
                    load += self._activity(day, False, season, hour=17.5)
            atl += (load - atl) * (1 - math.exp(-1 / 7))
            ctl += (load - ctl) * (1 - math.exp(-1 / 42))

            bedtime = 23.0 + rng.gauss(0, 0.6) + (0.7 if day.weekday() in (4, 5) else 0)
            sleep_h = max(4.5, min(9.5, 7.6 - 0.55 * (bedtime - 23) + rng.gauss(0, 0.5)))
            hrv = (
                58 + 0.12 * ctl - 0.045 * prev_load - 1.5 * max(0, bedtime - 23.5) + rng.gauss(0, 5)
            )
            score = 80 - 6 * max(0, bedtime - 23.2) - 0.03 * prev_load + 4 * (sleep_h - 7.3)
            score = max(35, min(98, score + rng.gauss(0, 6)))
            rhr = 52 - 0.06 * ctl + 0.012 * prev_load - 0.08 * (hrv - 60) + rng.gauss(0, 1.2)
            stress = max(10, min(70, 48 - 0.28 * (score - 70) + rng.gauss(0, 6)))
            bb_max = max(20, min(100, 15 + 0.9 * score + rng.gauss(0, 5)))
            readiness = max(
                5, min(100, 0.6 * score + 0.5 * (hrv - 40) - 0.08 * prev_load + rng.gauss(10, 7))
            )
            iso = day.isoformat()
            self.days[iso] = {
                "steps": int(max(2000, rng.gauss(9500 if weekend else 7800, 2500))),
                "rhr": round(rhr),
                "hrv": round(hrv),
                "sleepScore": round(score),
                "sleepH": sleep_h,
                "bedtime": bedtime,
                "stress": round(stress),
                "bbMax": round(bb_max),
                "bbMin": round(max(5, bb_max - 55 - 0.1 * load + rng.gauss(0, 8))),
                "readiness": round(readiness),
                "resp": round(14 + rng.gauss(0, 0.6), 1),
                "spo2": round(96 + rng.gauss(0, 1)),
                "acute": round(atl * 7),
                "chronic": round(ctl * 7),
                "imMod": int(max(0, rng.gauss(25, 15))),
                "imVig": int(load / 4),
                "kcalActive": int(400 + load * 4 + rng.gauss(0, 120)),
            }
            prev_load = load
            day += timedelta(days=1)

    def _activity(
        self, day: date, long_day: bool, season: float, hour: float | None = None
    ) -> float:
        rng = self.rng
        type_key, name, _, minutes, speed, climb, intensity = rng.choices(
            _SPORTS, weights=[s[2] for s in _SPORTS]
        )[0]
        minutes = max(
            20,
            rng.gauss(minutes * (1.6 if long_day and "biking" in type_key else 1), minutes * 0.25),
        )
        load = minutes * intensity * (1.4 + rng.random()) * (0.8 + 0.4 * season)
        km = speed * minutes / 60 * (0.9 + 0.2 * rng.random())
        start = hour if hour is not None else (8.0 if long_day else rng.choice((7.0, 18.5, 19.5)))
        hr = 120 + 25 * intensity + rng.gauss(0, 6)
        zones = [rng.random() for _ in range(5)]
        zones = [z * minutes * 60 / sum(zones) for z in zones]
        ftp = 230 + 25 * season + (self.today.year - day.year) * -6
        activity = {
            "activityId": int(day.strftime("%Y%m%d")) * 10 + rng.randint(0, 9),
            "activityName": name,
            "startTimeLocal": f"{day} {int(start):02d}:{int(start % 1 * 60):02d}:00",
            "activityType": {"typeKey": type_key},
            "distance": km * 1000 if speed else None,
            "duration": minutes * 60,
            "movingDuration": minutes * 57,
            "elevationGain": km * climb * (0.5 + rng.random()) if climb else None,
            "averageSpeed": km / (minutes / 60) / 3.6 if speed else None,
            "averageHR": hr,
            "maxHR": hr + 30,
            "calories": minutes * 11,
            "activityTrainingLoad": round(load),
            "aerobicTrainingEffect": round(min(5, 1.5 + load / 80), 1),
            "anaerobicTrainingEffect": round(max(0, min(5, rng.gauss(1.2 * intensity, 0.8))), 1),
            **{f"hrTimeInZone_{i + 1}": z for i, z in enumerate(zones)},
        }
        if "ride" in type_key or "biking" in type_key:
            activity.update(
                avgPower=round(ftp * 0.68 * intensity),
                normPower=round(ftp * 0.78 * intensity),
                **{
                    f"maxAvgPower_{s}": round(ftp * f * (0.92 + 0.08 * rng.random()))
                    for s, f in ((5, 3.6), (10, 3.2), (30, 2.3), (60, 1.75), (120, 1.4), (300, 1.18),
                                 (600, 1.07), (1200, 1.03), (1800, 0.98), (3600, 0.93))
                    if s <= minutes * 60
                },
            )  # fmt: skip
        self.activities.append(activity)
        return load

    def _range(self, start: str, end: str):
        d, last = date.fromisoformat(start), date.fromisoformat(end)
        while d <= last:
            if d.isoformat() in self.days:
                yield d, self.days[d.isoformat()]
            d += timedelta(days=1)

    # -- garminconnect-compatible API ---------------------------------------------------
    def count_activities(self) -> int:
        return len(self.activities)

    def get_activities(self, start: int, limit: int) -> list[dict[str, Any]]:
        newest_first = sorted(self.activities, key=lambda a: a["startTimeLocal"], reverse=True)
        return newest_first[start : start + limit]

    def get_activities_by_date(self, start: str, end: str) -> list[dict[str, Any]]:
        return [a for a in self.activities if start <= a["startTimeLocal"][:10] <= end]

    def get_daily_summaries(self, start: str, end: str) -> dict[str, Any]:
        return {
            "data": [
                {
                    "calendarDate": d.isoformat(),
                    "includesWellnessData": True,
                    "movement": {"steps": {"value": v["steps"], "goal": 8000}},
                    "calories": {
                        "burnedActive": v["kcalActive"],
                        "burnedTotal": v["kcalActive"] + 1750,
                    },
                    "heartRate": {
                        "restingValue": v["rhr"],
                        "minValue": v["rhr"] - 4,
                        "maxValue": 160,
                    },
                    "intensityMinutes": {"moderate": v["imMod"], "vigorous": v["imVig"]},
                    "stress": {"avgLevel": v["stress"], "maxLevel": 95},
                    "bodyBattery": {
                        "maxValue": v["bbMax"],
                        "minValue": v["bbMin"],
                        "chargedValue": max(0, v["bbMax"] - v["bbMin"] - 5),
                    },
                    "respiration": {"avgValue": v["resp"]},
                    "pulseOx": {"avgValue": v["spo2"]},
                }
                for d, v in self._range(start, end)
            ]
        }

    def get_sleep_daily(self, start: str, end: str) -> list[dict[str, Any]]:
        out = []
        for d, v in self._range(start, end):
            total = v["sleepH"] * 3600
            out.append(
                {
                    "calendarDate": d.isoformat(),
                    "values": {
                        "totalSleepTimeInSeconds": int(total),
                        "deepTime": int(total * 0.18),
                        "remTime": int(total * 0.22),
                        "lightTime": int(total * 0.56),
                        "awakeTime": int(total * 0.04),
                        "sleepScore": v["sleepScore"],
                        "sleepNeed": 480,
                        "localSleepStartTimeInMillis": _local_millis(
                            d - timedelta(days=1), v["bedtime"]
                        ),
                        "localSleepEndTimeInMillis": _local_millis(
                            d - timedelta(days=1), v["bedtime"] + v["sleepH"] + 0.3
                        ),
                        "skinTempC": round(self.rng.gauss(0, 0.3), 1),
                    },
                }
            )
        return out

    def get_hrv_data_range(self, start: str, end: str) -> dict[str, Any]:
        return {
            "hrvSummaries": [
                {
                    "calendarDate": d.isoformat(),
                    "lastNightAvg": v["hrv"],
                    "weeklyAvg": v["hrv"],
                    "baseline": {"balancedLow": 52, "balancedUpper": 72},
                }
                for d, v in self._range(start, end)
            ]
        }

    def get_training_readiness_range(self, start: str, end: str) -> list[dict[str, Any]]:
        return [
            {
                "calendarDate": d.isoformat(),
                "score": v["readiness"],
                "timestamp": f"{d}T07:00:00",
                "inputContext": "AFTER_WAKEUP_RESET",
                "recoveryTime": 0,
            }
            for d, v in self._range(start, end)
        ]

    def get_weekly_training_status(self, start: str, end: str) -> dict[str, Any]:
        rows = [
            {
                "calendarDate": d.isoformat(),
                "primaryTrainingDevice": True,
                "trainingStatus": 4,
                "acuteTrainingLoadDTO": {
                    "dailyTrainingLoadAcute": v["acute"],
                    "dailyTrainingLoadChronic": v["chronic"],
                    "dailyAcuteChronicWorkloadRatio": round(v["acute"] / max(1, v["chronic"]), 2),
                },
            }
            for d, v in self._range(start, end)
        ]
        return {"reportData": {"demo": rows}}

    def get_max_metrics_range(self, start: str, end: str) -> list[dict[str, Any]]:
        out = []
        for d, _ in self._range(start, end):
            if d.weekday() != 6:
                continue
            ctl = self.days[d.isoformat()]["chronic"] / 7
            out.append(
                {
                    "generic": {
                        "calendarDate": d.isoformat(),
                        "vo2MaxPreciseValue": round(47 + ctl / 12, 1),
                    },
                    "cycling": {
                        "calendarDate": d.isoformat(),
                        "vo2MaxPreciseValue": round(49 + ctl / 10, 1),
                    },
                }
            )
        return out

    def get_endurance_score(
        self, start: str, end: str, aggregation: str = "weekly"
    ) -> dict[str, Any]:
        return {
            "groupMap": {
                d.isoformat(): {"groupAverage": int(4800 + 14 * v["chronic"] / 7)}
                for d, v in self._range(start, end)
                if d.weekday() == 0
            }
        }

    def get_body_composition(self, start: str, end: str) -> dict[str, Any]:
        return {
            "dateWeightList": [
                {
                    "calendarDate": d.isoformat(),
                    "weight": (76 - 2 * math.sin(d.toordinal() / 120)) * 1000,
                    "bmi": 23.4,
                }
                for d, _ in self._range(start, end)
                if d.day == 1
            ]
        }
