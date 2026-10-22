"""Incremental download of Garmin history into the chunk cache."""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from .cache import ChunkCache
from .sources import SOURCES, windows

# Garmin keeps revising the last few days (late syncs, sleep re-scoring, readiness
# recalculations), so a window is only treated as final once it ends this many days ago.
SETTLE_DAYS = 7

# Pause between requests. Bulk history downloads are exactly the traffic pattern that gets
# an account rate-limited, so the first full sync is deliberately unhurried.
REQUEST_PAUSE_SECONDS = 0.25


@dataclass
class SyncReport:
    fetched: int = 0
    cached: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)


def first_year_with_data(client: Any, today: date) -> int:
    """Year of the oldest activity on the account, or the current year if there is none."""
    total = client.count_activities() or 0
    if total:
        oldest = client.get_activities(total - 1, 1) or []
        if oldest and oldest[0].get("startTimeLocal"):
            return int(str(oldest[0]["startTimeLocal"])[:4])
    return today.year


def sync(
    client: Any,
    cache: ChunkCache,
    *,
    since: int | None = None,
    full: bool = False,
    today: date | None = None,
    progress: Callable[[str], None] | None = None,
    on_step: Callable[[int, int, str], None] | None = None,
    pause: float = REQUEST_PAUSE_SECONDS,
) -> SyncReport:
    """Fetch every window that is missing or not yet settled.

    Args:
        client: authenticated ``garminconnect.Garmin`` (or a test double).
        cache: destination cache.
        since: first year to download; defaults to the year of the oldest activity.
        full: re-download settled windows too.
        today: override for tests.
        progress: callback receiving one human-readable line per request.
        on_step: callback receiving ``(done, total, source)`` before each request and once
            more with ``done == total`` at the end; drives progress bars.
        pause: seconds to wait between requests.
    """
    today = today or date.today()
    meta = cache.meta()
    first_year = since or meta.get("first_year") or first_year_with_data(client, today)
    settled_before = today - timedelta(days=SETTLE_DAYS)
    report = SyncReport()

    todo = []
    for source in SOURCES:
        for start, end in windows(first_year, today, source.chunk_days):
            if not full and end < settled_before and cache.has(source.name, start, end):
                report.cached += 1
            else:
                todo.append((source, start, end))

    for done, (source, start, end) in enumerate(todo):
        if on_step:
            on_step(done, len(todo), source.name)
        if progress:
            progress(f"{source.name:<17} {start} → {end}")
        try:
            payload = source.fetch(client, start.isoformat(), end.isoformat())
        except Exception as exc:  # one failing endpoint must not abort the sync
            report.errors.append(
                {"source": source.name, "window": f"{start}..{end}", "error": str(exc)[:300]}
            )
            continue
        cache.drop_overlapping(source.name, start, end)
        cache.put(source.name, start, end, payload)
        report.fetched += 1
        if pause:
            time.sleep(pause)
    if on_step:
        on_step(len(todo), len(todo), "")

    cache.write_meta(
        {
            "first_year": first_year,
            "last_sync": datetime.now().astimezone().isoformat(timespec="seconds"),
            "errors": report.errors,
        }
    )
    return report
