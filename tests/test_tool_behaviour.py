"""Behavioural tests: drive tools through the MCP server with Garmin faked at the boundary."""

import io
import json
import stat
import zipfile
from typing import Any

import pytest
from fastmcp import Client
from garminconnect import GarminConnectAuthenticationError

import garmin_connect_mcp.client as client_module
import garmin_connect_mcp.middleware as middleware_module
from garmin_connect_mcp.server import mcp


class FakeGarmin:
    """Stands in for garminconnect.Garmin; only methods the real library has."""

    def __init__(self, **responses: Any):
        self.responses = responses
        self.calls: list[tuple[str, tuple, dict]] = []

    def __getattr__(self, name: str):
        if name not in self.responses:
            raise AttributeError(name)

        def method(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            value = self.responses[name]
            if isinstance(value, Exception):
                raise value
            return value(*args, **kwargs) if callable(value) else value

        return method


@pytest.fixture
def garmin(monkeypatch):
    fake = FakeGarmin()
    monkeypatch.setattr(middleware_module, "can_authenticate", lambda config: True)
    monkeypatch.setattr(middleware_module, "get_cached_client", lambda config: fake)
    return fake


async def call(tool: str, **args: Any) -> dict[str, Any]:
    async with Client(mcp) as c:
        result = await c.call_tool(tool, args, raise_on_error=False)
    return json.loads(result.content[0].text)  # type: ignore[union-attr]


async def test_new_tools_are_registered_and_broken_social_tool_is_gone():
    async with Client(mcp) as c:
        names = {t.name for t in await c.list_tools()}
    assert {"get_activity_streams", "get_fitness_thresholds", "export_activity_file"} <= names
    assert "get_activity_social" not in names


async def test_training_effect_is_read_from_the_activity(garmin):
    garmin.responses["get_activity"] = {
        "activityId": 1,
        "summaryDTO": {
            "trainingEffect": 3.4000001,
            "anaerobicTrainingEffect": 1.2,
            "trainingEffectLabel": "TEMPO",
            "activityTrainingLoad": 120.5,
            "hrTimeInZone_2": 600.4,
        },
    }

    body = await call("get_training_effect", activity_id=1)

    effect = body["data"]["training_effect"]
    assert effect["aerobic"] == 3.4
    assert effect["anaerobic"] == 1.2
    assert effect["label"] == "TEMPO"
    assert effect["training_load"] == 120.5
    assert effect["hr_time_in_zones_seconds"] == {"zone_2": 600}


async def test_training_effect_for_unknown_activity_is_not_found(garmin):
    garmin.responses["get_activity"] = None

    body = await call("get_training_effect", activity_id=999)

    assert body["error"]["type"] == "not_found"


async def test_performance_metrics_returns_fitness_age_and_explains_failures(garmin):
    garmin.responses["get_fitnessage_data"] = {"fitnessAge": 29}
    garmin.responses["get_max_metrics"] = RuntimeError("upstream 500")
    garmin.responses["get_hrv_data"] = {"hrvSummary": {"weeklyAvg": 61}}

    body = await call("get_performance_metrics", date="2026-10-01")

    assert body["data"]["fitness_age"] == {"fitnessAge": 29}
    assert body["data"]["vo2_max"] is None
    assert "upstream 500" in body["analysis"]["errors"]["vo2_max"]


async def test_get_workout_by_id(garmin):
    garmin.responses["get_workout_by_id"] = {"workoutId": 7, "workoutName": "Z2"}

    body = await call("manage_workouts", action="get", workout_id=7)

    assert body["data"]["workout"]["workoutName"] == "Z2"


def _details(rows: int) -> dict[str, Any]:
    # Deliberately non-standard column order: tools must follow the descriptors.
    descriptors = [
        {"metricsIndex": 0, "key": "directHeartRate"},
        {"metricsIndex": 1, "key": "sumDistance"},
        {"metricsIndex": 2, "key": "sumDuration"},
        {"metricsIndex": 3, "key": "directLatitude"},
        {"metricsIndex": 4, "key": "directLongitude"},
        {"metricsIndex": 5, "key": "directPower"},
    ]
    metrics = [
        {"metrics": [120 + i % 10, i * 10.0, float(i), 51.5, -0.12, None]} for i in range(rows)
    ]
    return {"metricDescriptors": descriptors, "activityDetailMetrics": metrics}


async def test_streams_follow_descriptors_downsample_and_hide_gps(garmin):
    garmin.responses["get_activity_details"] = _details(1000)

    body = await call("get_activity_streams", activity_id=1, max_points=100)

    data = body["data"]
    assert data["total_points"] == 1000
    assert data["points"] == 100
    streams = data["streams"]
    assert streams["distance_m"][:2] == [0.0, 100.0]
    assert streams["elapsed_s"][1] == 10.0
    assert len(streams["heart_rate_bpm"]) == 100
    assert "latitude" not in streams
    assert "power_w" not in streams  # recorded as all-null


async def test_streams_include_gps_only_when_asked(garmin):
    garmin.responses["get_activity_details"] = _details(5)

    body = await call("get_activity_streams", activity_id=1, include_gps=True)

    assert body["data"]["streams"]["latitude"][0] == 51.5


async def test_thresholds_report_each_section_independently(garmin):
    garmin.responses["get_lactate_threshold"] = {"speed_and_heart_rate": {"heartRate": 172}}
    garmin.responses["get_cycling_ftp"] = {"functionalThresholdPower": 245}
    garmin.responses["get_race_predictions"] = {"timeHalfMarathon": 6300}
    garmin.responses["get_running_tolerance"] = RuntimeError("not supported on device")

    body = await call("get_fitness_thresholds", weeks=4)

    assert body["data"]["cycling_ftp"]["functionalThresholdPower"] == 245
    assert body["data"]["running_tolerance"] is None
    assert "not supported" in body["analysis"]["errors"]["running_tolerance"]


async def test_export_unzips_fit_and_writes_owner_only(garmin, tmp_path, monkeypatch):
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as z:
        z.writestr("123_ACTIVITY.fit", b"FITDATA")
    garmin.responses["download_activity"] = archive.getvalue()
    monkeypatch.setenv("GARMIN_EXPORT_DIR", str(tmp_path / "exports"))

    body = await call("export_activity_file", activity_id=123, format="fit")

    written = tmp_path / "exports" / "123.fit"
    assert body["data"]["path"] == str(written)
    assert written.read_bytes() == b"FITDATA"
    assert stat.S_IMODE(written.stat().st_mode) == 0o600


async def test_account_internals_are_stripped_from_responses(garmin):
    garmin.responses["get_activity"] = {
        "activityId": 5,
        "activityName": "Ride",
        "userRoles": ["SCOPE_CONNECT_WRITE"],
        "ownerProfileImageUrlLarge": "https://example.invalid/me.png",
    }

    raw = await call("query_activities", activity_id=5)

    text = json.dumps(raw)
    assert "SCOPE_CONNECT_WRITE" not in text
    assert "me.png" not in text
    assert "Ride" in text


def test_client_is_created_once_and_dropped_after_auth_failure(monkeypatch):
    created: list[FakeGarmin] = []

    def fake_init(config):
        fake = FakeGarmin(get_stats=GarminConnectAuthenticationError("expired"))
        created.append(fake)
        return fake

    monkeypatch.setattr(client_module, "init_garmin_client", fake_init)
    client_module.reset_cached_client()

    first = client_module.get_cached_client(None)  # type: ignore[arg-type]
    assert client_module.get_cached_client(None) is first  # type: ignore[arg-type]

    with pytest.raises(client_module.GarminAuthenticationError):
        client_module.GarminClientWrapper(first).safe_call("get_stats", "today")  # type: ignore[arg-type]

    assert client_module.get_cached_client(None) is not first  # type: ignore[arg-type]
    assert len(created) == 2
    client_module.reset_cached_client()
