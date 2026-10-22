"""On-disk cache of raw Garmin responses, one JSON file per source and date window."""

import json
import os
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Any

from ..auth import write_private_file


def default_cache_dir() -> Path:
    """Where synced data lives unless ``GARMIN_DASHBOARD_DIR`` says otherwise."""
    return Path(os.environ.get("GARMIN_DASHBOARD_DIR", Path.home() / ".garmin-dashboard"))


class ChunkCache:
    """Raw responses keyed by ``<source>/<start>_<end>.json``.

    Files are written ``0600`` inside ``0700`` folders: they hold health data.
    """

    def __init__(self, root: Path):
        self.root = Path(root).expanduser()

    @property
    def raw_dir(self) -> Path:
        return self.root / "raw"

    def _path(self, source: str, start: date, end: date) -> Path:
        return self.raw_dir / source / f"{start.isoformat()}_{end.isoformat()}.json"

    def has(self, source: str, start: date, end: date) -> bool:
        return self._path(source, start, end).is_file()

    def put(self, source: str, start: date, end: date, payload: Any) -> None:
        path = self._path(source, start, end)
        for folder in (self.root, self.raw_dir, path.parent):
            folder.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(folder, 0o700)
        # Write then rename, so a page built mid-sync never reads a half-written window.
        tmp = path.with_suffix(".json.tmp")
        write_private_file(tmp, json.dumps(payload, separators=(",", ":")))
        os.replace(tmp, path)

    def drop_overlapping(self, source: str, start: date, end: date) -> None:
        """Remove stale windows that overlap ``start..end`` (e.g. a shorter "today" window)."""
        folder = self.raw_dir / source
        if not folder.is_dir():
            return
        for path in folder.glob("*.json"):
            s, e = _parse_window(path)
            if (s, e) != (start, end) and s <= end and e >= start:
                path.unlink()

    def iter_source(self, source: str) -> Iterator[tuple[date, date, Any]]:
        """Yield cached windows of one source, oldest first."""
        folder = self.raw_dir / source
        if not folder.is_dir():
            return
        for path in sorted(folder.glob("*.json")):
            start, end = _parse_window(path)
            yield start, end, json.loads(path.read_text(encoding="utf-8"))

    def meta(self) -> dict[str, Any]:
        path = self.root / "meta.json"
        if not path.is_file():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def write_meta(self, meta: dict[str, Any]) -> None:
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        write_private_file(self.root / "meta.json", json.dumps(meta, indent=2))


def _parse_window(path: Path) -> tuple[date, date]:
    start, end = path.stem.split("_")
    return date.fromisoformat(start), date.fromisoformat(end)
