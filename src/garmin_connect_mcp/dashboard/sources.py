"""Garmin endpoints the dashboard reads, and the date windows each one accepts."""

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

# Fields removed from activity summaries before they reach the cache: identity, account
# roles and exact coordinates (the start and end of most activities is someone's home).
_ACTIVITY_DROP_PREFIXES = ("owner", "userRoles", "startLatitude", "startLongitude")
_ACTIVITY_DROP_KEYS = {"endLatitude", "endLongitude", "userPro", "splitSummaries"}


def _strip_activity(activity: dict[str, Any]) -> dict[str, Any]:
    return {
        k: v
        for k, v in activity.items()
        if k not in _ACTIVITY_DROP_KEYS and not k.startswith(_ACTIVITY_DROP_PREFIXES)
    }


def _activities(client: Any, start: str, end: str) -> list[dict[str, Any]]:
    return [_strip_activity(a) for a in client.get_activities_by_date(start, end) or []]


@dataclass(frozen=True)
class Source:
    """One Garmin range endpoint.

    ``chunk_days`` is the widest window the endpoint answers reliably; wider requests are
    either rejected (HTTP 400) or silently truncated by Garmin.
    """

    name: str
    chunk_days: int
    fetch: Callable[[Any, str, str], Any]


SOURCES: tuple[Source, ...] = (
    Source("daily_summaries", 366, lambda c, s, e: c.get_daily_summaries(s, e)),
    Source("sleep", 28, lambda c, s, e: c.get_sleep_daily(s, e)),
    Source("hrv", 28, lambda c, s, e: c.get_hrv_data_range(s, e)),
    Source("readiness", 28, lambda c, s, e: c.get_training_readiness_range(s, e)),
    Source("training_status", 91, lambda c, s, e: c.get_weekly_training_status(s, e)),
    Source("max_metrics", 366, lambda c, s, e: c.get_max_metrics_range(s, e)),
    Source("endurance", 366, lambda c, s, e: c.get_endurance_score(s, e, aggregation="weekly")),
    Source("body_composition", 366, lambda c, s, e: c.get_body_composition(s, e)),
    Source("activities", 366, _activities),
)

SOURCE_NAMES = tuple(s.name for s in SOURCES)


def windows(first_year: int, today: date, chunk_days: int) -> Iterator[tuple[date, date]]:
    """Yield ``(start, end)`` windows that never cross a year boundary.

    Keeping windows inside one calendar year makes chunk boundaries stable from run to run,
    so a window cached last month has the same key today.
    """
    for year in range(first_year, today.year + 1):
        year_end = min(date(year, 12, 31), today)
        start = date(year, 1, 1)
        while start <= year_end:
            end = min(start + timedelta(days=chunk_days - 1), year_end)
            yield start, end
            start = end + timedelta(days=1)
