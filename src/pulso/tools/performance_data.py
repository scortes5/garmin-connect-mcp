"""Raw performance data tools: activity time-series, thresholds and file export."""

import io
import os
import zipfile
from datetime import date, timedelta
from pathlib import Path
from typing import Annotated, Any, Literal

from fastmcp import Context
from garminconnect import Garmin

from ..client import GarminAPIError
from ..response_builder import ResponseBuilder

# Output column -> Garmin metric keys to try, in order of preference.
STREAM_KEYS: dict[str, tuple[str, ...]] = {
    "elapsed_s": ("sumElapsedDuration", "sumDuration"),
    "distance_m": ("sumDistance",),
    "heart_rate_bpm": ("directHeartRate",),
    "speed_mps": ("directSpeed",),
    "power_w": ("directPower",),
    "cadence": ("directRunCadence", "directBikeCadence", "directDoubleCadence"),
    "elevation_m": ("directElevation",),
    "temperature_c": ("directAirTemperature",),
}
GPS_KEYS: dict[str, tuple[str, ...]] = {
    "latitude": ("directLatitude",),
    "longitude": ("directLongitude",),
}

ExportFormat = Literal["fit", "gpx", "tcx", "csv"]


def _descriptor_map(details: dict[str, Any]) -> dict[str, int]:
    return {
        d["key"]: int(d["metricsIndex"])
        for d in details.get("metricDescriptors") or []
        if d.get("key") is not None and d.get("metricsIndex") is not None
    }


def build_streams(
    details: dict[str, Any], max_points: int = 500, include_gps: bool = False
) -> dict[str, Any]:
    """Turn Garmin's row-oriented activity details into downsampled columns.

    Columns with no data at all are omitted. GPS is excluded unless asked for,
    because start/end coordinates reveal where someone lives.
    """
    index = _descriptor_map(details)
    rows = [r.get("metrics") or [] for r in details.get("activityDetailMetrics") or []]
    if not rows or not index:
        return {"points": 0, "total_points": 0, "streams": {}}

    stride = max(1, -(-len(rows) // max(1, max_points)))  # ceil division
    sampled = rows[::stride]

    wanted = dict(STREAM_KEYS)
    if include_gps:
        wanted.update(GPS_KEYS)

    streams: dict[str, list[Any]] = {}
    for column, keys in wanted.items():
        key = next((k for k in keys if k in index), None)
        if key is None:
            continue
        i = index[key]
        values = [row[i] if i < len(row) else None for row in sampled]
        if any(v is not None for v in values):
            streams[column] = [round(v, 2) if isinstance(v, float) else v for v in values]

    return {
        "points": len(sampled),
        "total_points": len(rows),
        "downsample_stride": stride,
        "streams": streams,
    }


async def get_activity_streams(
    activity_id: Annotated[int, "Activity ID"],
    max_points: Annotated[int, "Maximum samples per stream (10-2000). Default 500."] = 500,
    include_gps: Annotated[
        bool, "Include latitude/longitude. Off by default: GPS reveals home location."
    ] = False,
    ctx: Context | None = None,
) -> str:
    """
    Get second-by-second style time-series for an activity, ready to chart.

    Returns aligned columns (elapsed time, distance, heart rate, speed, power,
    cadence, elevation, temperature) downsampled to at most max_points rows.
    Only columns the device actually recorded are returned.
    """
    assert ctx is not None
    max_points = min(max(max_points, 10), 2000)
    try:
        client = await ctx.get_state("client")
        details = client.safe_call(
            "get_activity_details", activity_id, maxchart=max(max_points, 2000)
        )
        result = build_streams(details or {}, max_points=max_points, include_gps=include_gps)

        insights = []
        if not result["streams"]:
            insights.append("No time-series data recorded for this activity")
        else:
            insights.append(f"Streams available: {', '.join(result['streams'])}")

        return ResponseBuilder.build_response(
            data=result,
            analysis={"insights": insights},
            metadata={"activity_id": activity_id, "include_gps": include_gps},
        )
    except GarminAPIError as e:
        return ResponseBuilder.build_error_response(
            e.message, "api_error", ["Verify the activity ID with query_activities"]
        )
    except Exception as e:
        return ResponseBuilder.build_error_response(str(e), "internal_error")


async def get_fitness_thresholds(
    weeks: Annotated[int, "Weeks of running-tolerance history (1-52). Default 8."] = 8,
    ctx: Context | None = None,
) -> str:
    """
    Get the thresholds that define training zones and race targets.

    Includes lactate threshold (HR and pace), cycling FTP, race-time predictions
    (5K, 10K, half, marathon) and weekly running tolerance. Each section is
    fetched independently; failures are reported in analysis.errors.
    """
    assert ctx is not None
    weeks = min(max(weeks, 1), 52)
    try:
        client = await ctx.get_state("client")
        end = date.today()
        start = end - timedelta(weeks=weeks)

        calls: dict[str, tuple[str, tuple[Any, ...], dict[str, Any]]] = {
            "lactate_threshold": ("get_lactate_threshold", (), {"latest": True}),
            "cycling_ftp": ("get_cycling_ftp", (), {}),
            "race_predictions": ("get_race_predictions", (), {}),
            "running_tolerance": (
                "get_running_tolerance",
                (start.isoformat(), end.isoformat()),
                {"aggregation": "weekly"},
            ),
        }

        data: dict[str, Any] = {}
        errors: dict[str, str] = {}
        for name, (method, args, kwargs) in calls.items():
            try:
                data[name] = client.safe_call(method, *args, **kwargs)
            except Exception as e:
                data[name] = None
                errors[name] = str(e)

        available = [k for k, v in data.items() if v]
        analysis: dict[str, Any] = {
            "insights": [
                f"Available: {', '.join(available)}" if available else "No threshold data found"
            ]
        }
        if errors:
            analysis["errors"] = errors

        return ResponseBuilder.build_response(
            data=data,
            analysis=analysis,
            metadata={"running_tolerance_weeks": weeks},
        )
    except Exception as e:
        return ResponseBuilder.build_error_response(str(e), "internal_error")


def default_export_dir() -> Path:
    """Directory for exported files: $GARMIN_EXPORT_DIR or ~/GarminExports."""
    return Path(os.environ.get("GARMIN_EXPORT_DIR", Path.home() / "GarminExports")).expanduser()


def write_export(content: bytes, fmt: ExportFormat, activity_id: int, out_dir: Path) -> Path:
    """Write an export to disk with owner-only permissions; unzip original FIT files."""
    if fmt == "fit":
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            fit_names = [n for n in archive.namelist() if n.lower().endswith(".fit")]
            if not fit_names:
                raise ValueError("Garmin returned an archive without a .fit file")
            content = archive.read(fit_names[0])

    out_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    target = out_dir / f"{activity_id}.{fmt}"
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as fh:
        fh.write(content)
    os.chmod(target, 0o600)
    return target


_FORMATS: dict[str, Garmin.ActivityDownloadFormat] = {
    "fit": Garmin.ActivityDownloadFormat.ORIGINAL,
    "gpx": Garmin.ActivityDownloadFormat.GPX,
    "tcx": Garmin.ActivityDownloadFormat.TCX,
    "csv": Garmin.ActivityDownloadFormat.CSV,
}


async def export_activity_file(
    activity_id: Annotated[int, "Activity ID"],
    format: Annotated[
        ExportFormat,
        "'fit' (original device file, all fields), 'gpx', 'tcx', or 'csv' (splits)",
    ] = "fit",
    ctx: Context | None = None,
) -> str:
    """
    Save an activity file to this computer (never uploaded anywhere).

    Files go to $GARMIN_EXPORT_DIR (default ~/GarminExports) with owner-only
    permissions. 'fit' is the original recording from the watch, including the
    fields Garmin strips from its partner API.
    """
    assert ctx is not None
    try:
        client = await ctx.get_state("client")
        content = client.safe_call("download_activity", activity_id, dl_fmt=_FORMATS[format])
        path = write_export(content, format, activity_id, default_export_dir())
        return ResponseBuilder.build_response(
            data={"path": str(path), "bytes": path.stat().st_size, "format": format},
            metadata={"activity_id": activity_id},
        )
    except GarminAPIError as e:
        return ResponseBuilder.build_error_response(
            e.message, "api_error", ["Verify the activity ID with query_activities"]
        )
    except Exception as e:
        return ResponseBuilder.build_error_response(str(e), "internal_error")
