"""Behaviour tests for the dashboard: sync -> cache -> dataset -> correlations -> HTML.

Garmin is faked at the library boundary (the ``garminconnect.Garmin`` methods); every
other part runs for real against a temporary cache directory.
"""

import http.client
import json
import stat
import threading
import time
from datetime import date, timedelta
from pathlib import Path

import pytest

from garmin_connect_mcp.dashboard.analytics import correlations, p_value, pearson, spearman
from garmin_connect_mcp.dashboard.cache import ChunkCache
from garmin_connect_mcp.dashboard.cli import build, install_app
from garmin_connect_mcp.dashboard.cli import main as dashboard_main
from garmin_connect_mcp.dashboard.normalize import build_dataset, sport_of
from garmin_connect_mcp.dashboard.render import render_html
from garmin_connect_mcp.dashboard.server import DashboardServer
from garmin_connect_mcp.dashboard.sync import sync

TODAY = date(2025, 3, 15)


def _days(start: str, end: str):
    d, last = date.fromisoformat(start), date.fromisoformat(end)
    while d <= last:
        yield d
        d += timedelta(days=1)


def _local_millis(day: date, hour: float) -> int:
    """Garmin's "local millis": wall-clock time encoded as if it were UTC."""
    return int((day.toordinal() - date(1970, 1, 1).toordinal()) * 86400_000 + hour * 3600_000)


class FakeGarmin:
    """Deterministic Garmin account: trains every third day; hard days lower next-night HRV."""

    def __init__(self, first_activity: date = date(2024, 6, 1)):
        self.calls: list[tuple[str, str, str]] = []
        self.first_activity = first_activity
        self.fail: set[str] = set()

    def _log(self, name: str, start: str, end: str) -> None:
        if name in self.fail:
            raise RuntimeError(f"{name} unavailable")
        self.calls.append((name, start, end))

    @staticmethod
    def load(day: date) -> int:
        return 150 if day.toordinal() % 3 == 0 else 0

    def count_activities(self):
        return 3

    def get_activities(self, start, limit):
        return [{"startTimeLocal": f"{self.first_activity} 07:00:00"}]

    def get_daily_summaries(self, start, end):
        self._log("daily_summaries", start, end)
        return {
            "data": [
                {
                    "calendarDate": d.isoformat(),
                    "includesWellnessData": True,
                    "movement": {"steps": {"value": 8000 + d.day * 10, "goal": 8000}},
                    "heartRate": {"restingValue": 45 + (3 if self.load(d - timedelta(1)) else 0)},
                    "stress": {"avgLevel": 30, "maxLevel": 90},
                    "bodyBattery": {"maxValue": 80, "minValue": 20, "chargedValue": 60},
                }
                for d in _days(start, end)
                if d >= self.first_activity
            ]
        }

    def get_sleep_daily(self, start, end):
        self._log("sleep", start, end)
        return [
            {
                "calendarDate": d.isoformat(),
                "values": {
                    "totalSleepTimeInSeconds": 7.5 * 3600,
                    "deepTime": 3600,
                    "remTime": 5400,
                    "lightTime": 18000,
                    "awakeTime": 600,
                    "sleepScore": 80 - (10 if self.load(d - timedelta(1)) else 0),
                    "localSleepStartTimeInMillis": _local_millis(d - timedelta(1), 23.5),
                    "localSleepEndTimeInMillis": _local_millis(d, 7.0),
                },
            }
            for d in _days(start, end)
            if d >= self.first_activity
        ]

    def get_hrv_data_range(self, start, end):
        self._log("hrv", start, end)
        return {
            "hrvSummaries": [
                {
                    "calendarDate": d.isoformat(),
                    "lastNightAvg": 70 - (15 if self.load(d - timedelta(1)) else 0) + d.day % 3,
                    "weeklyAvg": 65,
                    "baseline": {"balancedLow": 55, "balancedUpper": 75},
                }
                for d in _days(start, end)
                if d >= self.first_activity
            ]
        }

    def get_training_readiness_range(self, start, end):
        self._log("readiness", start, end)
        out = []
        for d in _days(start, end):
            if d < self.first_activity:
                continue
            out.append(
                {
                    "calendarDate": d.isoformat(),
                    "score": 20,
                    "timestamp": "T12",
                    "inputContext": "UPDATE",
                }
            )
            out.append(
                {
                    "calendarDate": d.isoformat(),
                    "score": 75,
                    "timestamp": "T07",
                    "inputContext": "AFTER_WAKEUP_RESET",
                }
            )
        return out

    def get_weekly_training_status(self, start, end):
        self._log("training_status", start, end)
        return {"reportData": {"1": []}}

    def get_max_metrics_range(self, start, end):
        self._log("max_metrics", start, end)
        return [{"generic": {"calendarDate": end, "vo2MaxPreciseValue": 52.4}, "cycling": None}]

    def get_endurance_score(self, start, end, aggregation="weekly"):
        self._log("endurance", start, end)
        return {"groupMap": {start: {"groupAverage": 6100}}}

    def get_body_composition(self, start, end):
        self._log("body_composition", start, end)
        return {"dateWeightList": [{"calendarDate": end, "weight": 70500.0, "bmi": 22.1}]}

    def get_activities_by_date(self, start, end):
        self._log("activities", start, end)
        return [
            {
                "activityId": d.toordinal(),
                "activityName": "Morning ride",
                "startTimeLocal": f"{d} 18:00:00",
                "activityType": {"typeKey": "road_biking"},
                "distance": 40000.0,
                "duration": 5400.0,
                "elevationGain": 400.0,
                "averageHR": 140.0,
                "activityTrainingLoad": float(self.load(d)),
                "maxAvgPower_1200": 250,
                "hrTimeInZone_2": 3000.0,
                "ownerFullName": "Private Person",
                "ownerProfileImageUrlSmall": "https://example.invalid/me.png",
                "userRoles": ["SCOPE_X"],
                "startLatitude": 12.345,
                "startLongitude": 67.89,
                "endLatitude": 12.345,
                "endLongitude": 67.89,
            }
            for d in _days(start, end)
            if d >= self.first_activity and self.load(d)
        ]


@pytest.fixture
def cache(tmp_path: Path) -> ChunkCache:
    return ChunkCache(tmp_path / "dash")


@pytest.fixture
def synced(cache: ChunkCache) -> ChunkCache:
    sync(FakeGarmin(), cache, today=TODAY, pause=0)
    return cache


class TestSync:
    def test_first_sync_downloads_every_window_from_the_oldest_activity(self, cache):
        garmin = FakeGarmin()
        report = sync(garmin, cache, today=TODAY, pause=0)

        assert report.errors == []
        windows = {(s, e) for name, s, e in garmin.calls if name == "daily_summaries"}
        assert windows == {("2024-01-01", "2024-12-31"), ("2025-01-01", "2025-03-15")}
        sleep_windows = sorted((s, e) for name, s, e in garmin.calls if name == "sleep")
        assert all(
            date.fromisoformat(e) - date.fromisoformat(s) < timedelta(28) for s, e in sleep_windows
        )
        assert cache.meta()["first_year"] == 2024

    def test_second_sync_only_refreshes_recent_windows(self, cache):
        sync(FakeGarmin(), cache, today=TODAY, pause=0)
        again = FakeGarmin()
        report = sync(again, cache, today=TODAY, pause=0)

        assert report.cached > 0
        assert again.calls, "the current, unsettled windows are always refreshed"
        assert all(e >= (TODAY - timedelta(days=7)).isoformat() for _, _, e in again.calls)

    def test_moving_today_replaces_the_open_window_instead_of_duplicating_it(self, cache):
        sync(FakeGarmin(), cache, today=TODAY, pause=0)
        sync(FakeGarmin(), cache, today=TODAY + timedelta(days=1), pause=0)

        files = sorted(p.name for p in (cache.raw_dir / "daily_summaries").iterdir())
        assert files == ["2024-01-01_2024-12-31.json", "2025-01-01_2025-03-16.json"]

    def test_progress_counts_every_request_and_ends_complete(self, cache):
        steps: list[tuple[int, int, str]] = []
        garmin = FakeGarmin()
        sync(garmin, cache, today=TODAY, pause=0, on_step=lambda *s: steps.append(s))

        total = len(garmin.calls)
        assert [done for done, _, _ in steps] == list(range(total + 1))
        assert {t for _, t, _ in steps} == {total}
        assert steps[0][2] == "daily_summaries" and steps[-1] == (total, total, "")

    def test_failing_endpoint_is_reported_without_stopping_the_rest(self, cache):
        garmin = FakeGarmin()
        garmin.fail.add("hrv")
        report = sync(garmin, cache, today=TODAY, pause=0)

        assert report.errors and {e["source"] for e in report.errors} == {"hrv"}
        assert any(name == "sleep" for name, _, _ in garmin.calls)
        assert cache.meta()["errors"] == report.errors

    def test_cache_is_private_and_holds_no_identity_or_coordinates(self, synced):
        assert stat.S_IMODE(synced.root.stat().st_mode) == 0o700
        files = list(synced.raw_dir.rglob("*.json"))
        assert files and all(stat.S_IMODE(f.stat().st_mode) == 0o600 for f in files)

        raw = "".join(f.read_text() for f in (synced.raw_dir / "activities").iterdir())
        for secret in ("Private Person", "example.invalid", "SCOPE_X", "Latitude", "Longitude"):
            assert secret not in raw


class TestDataset:
    def test_days_combine_every_source(self, synced):
        data = build_dataset(synced, today=TODAY)
        days = data["days"]
        i = days["date"].index("2025-03-10")

        assert days["steps"][i] == 8100
        assert days["sleepH"][i] == 7.5
        assert days["bedtime"][i] == 23.5
        assert days["wake"][i] == 7.0
        assert days["hrvLow"][i] == 55 and days["hrvHigh"][i] == 75
        assert days["readiness"][i] == 75, "the morning readiness wins over later recalculations"

    def test_rest_days_count_as_zero_load_and_training_days_aggregate_activities(self, synced):
        days = build_dataset(synced, today=TODAY)["days"]
        loads = {d: days["actLoad"][i] for i, d in enumerate(days["date"])}
        train_day = next(d for d in loads if FakeGarmin.load(date.fromisoformat(d)))
        rest_day = next(d for d in loads if not FakeGarmin.load(date.fromisoformat(d)))

        assert loads[train_day] == 150
        assert loads[rest_day] == 0
        assert days["ctl"][-1] > 0 and days["atl"][-1] > 0

    def test_activities_are_compact_and_grouped_by_sport(self, synced):
        acts = build_dataset(synced, today=TODAY)["activities"]
        ride = acts[-1]

        assert ride["sport"] == "cycling"
        assert ride["km"] == 40.0 and ride["min"] == 90.0 and ride["end"] == 19.5
        assert ride["power"] == {"1200": 250}
        assert ride["zones"] == [0, 50.0, 0, 0, 0]
        assert [a["start"] for a in acts] == sorted(a["start"] for a in acts)

    def test_fitness_series_and_years(self, synced):
        data = build_dataset(synced, today=TODAY)
        assert data["years"] == ["2024", "2025"]
        assert data["vo2"][-1] == {"date": "2025-03-15", "sport": "running", "value": 52.4}
        assert data["weight"][-1]["kg"] == 70.5
        assert data["endurance"][0]["value"] == 6100

    @pytest.mark.parametrize(
        ("type_key", "sport"),
        [("virtual_ride", "cycling"), ("treadmill_running", "running"), ("lap_swimming", "swimming"),
         ("hiking", "walking"), ("strength_training", "gym"), ("soccer", "other")],
    )  # fmt: skip
    def test_sport_groups(self, type_key, sport):
        assert sport_of(type_key) == sport


class TestCorrelations:
    def test_statistics_helpers(self):
        xs = [1.0, 2.0, 3.0, 4.0, 5.0]
        assert pearson(xs, [2 * x for x in xs]) == pytest.approx(1.0)
        assert spearman(xs, [x**3 for x in xs]) == pytest.approx(1.0)
        assert pearson(xs, [1.0] * 5) is None
        assert p_value(0.0, 100) == pytest.approx(1.0)
        assert p_value(0.5, 100) < 0.001

    def test_training_load_predicts_next_night_hrv_in_the_fake_account(self, synced):
        data = build_dataset(synced, today=TODAY)
        result = correlations(data, today=TODAY)

        assert set(result["scopes"]) == {"all", "365", "2024", "2025"}
        pairs = {(p["x"], p["lag"], p["y"]): p for p in result["scopes"]["all"]["pairs"]}
        load_hrv = pairs[("actLoad", 1, "hrv")]
        assert load_hrv["r"] < -0.9
        assert load_hrv["p"] < 0.001
        assert load_hrv["hiMean"] < load_hrv["loMean"], "hard days are followed by lower HRV"
        assert load_hrv["hiCut"] == 150, "zero-inflated load splits rest days from training days"

    def test_hypotheses_are_shipped_so_the_page_can_recompute_any_range(self, synced):
        result = correlations(build_dataset(synced, today=TODAY), today=TODAY)
        assert ["actLoad", "hrv", 1] in result["pairs"]

    def test_matrix_is_square_and_symmetric(self, synced):
        result = correlations(build_dataset(synced, today=TODAY), today=TODAY)
        matrix = result["scopes"]["all"]["matrix"]
        assert len(matrix) == len(result["metrics"]) == len(matrix[0])
        for i, row in enumerate(matrix):
            for j, value in enumerate(row):
                assert value == matrix[j][i]

    def test_too_little_data_yields_no_pairs(self, cache):
        sync(FakeGarmin(first_activity=TODAY - timedelta(days=5)), cache, today=TODAY, pause=0)
        result = correlations(build_dataset(cache, today=TODAY), today=TODAY)
        assert result["scopes"]["all"]["pairs"] == []


class TestRender:
    def test_page_is_self_contained_and_embeds_the_data(self, synced):
        html = render_html(build(synced))

        assert "Chart.js v4.4.1" in html
        assert "window.GARMIN_DATA = {" in html
        assert "window.GARMIN_LIVE = false" in html
        assert "<script src=" not in html and '<link rel="stylesheet"' not in html
        assert '<link rel="icon" href="data:image/svg+xml;base64,' in html
        assert "/*__" not in html, "every template marker is replaced"

    def test_user_text_cannot_break_out_of_the_script_tag(self):
        dataset = {
            "days": {"date": []},
            "activities": [{"name": "</script><img src=x onerror=alert(1)>"}],
        }
        html = render_html(dataset)
        assert "</script><img" not in html
        assert "<\\/script><img" in html

    def test_live_flag(self):
        assert "window.GARMIN_LIVE = true" in render_html({"days": {"date": []}}, live=True)

    def test_auto_sync_only_in_the_app(self):
        empty = {"days": {"date": []}}
        assert "GARMIN_AUTOSYNC = true" in render_html(empty, live=True, auto_sync=True)
        assert "GARMIN_AUTOSYNC = false" in render_html(empty, live=False, auto_sync=True)


class TestCli:
    def test_offline_build_writes_a_private_file(self, synced, tmp_path, monkeypatch):
        monkeypatch.setenv("GARMIN_DASHBOARD_DIR", str(synced.root))
        out = tmp_path / "out" / "dash.html"

        dashboard_main(["--no-sync", "--no-open", "--output", str(out)])

        assert out.is_file()
        assert stat.S_IMODE(out.stat().st_mode) == 0o600
        assert "GARMIN_DATA" in out.read_text()

    def test_demo_runs_the_real_pipeline_without_touching_the_real_cache(
        self, tmp_path, monkeypatch
    ):
        real = tmp_path / "real"
        monkeypatch.setenv("GARMIN_DASHBOARD_DIR", str(real))
        out = tmp_path / "demo.html"

        dashboard_main(["--demo", "--no-open", "--output", str(out)])

        html = out.read_text()
        assert '"activities":[{' in html and '"correlations":' in html
        assert '"strava":{"connected":true' in html, "the demo includes a simulated Strava"
        assert "demo-polyline-must-be-stripped" not in html
        assert not real.exists()

    def test_strava_disconnect_forgets_the_tokens(self, tmp_path, monkeypatch):
        from garmin_connect_mcp.dashboard.strava import is_connected, save_credentials

        monkeypatch.setenv("GARMIN_DASHBOARD_DIR", str(tmp_path))
        cache = ChunkCache(tmp_path)
        save_credentials(cache, {"refresh_token": "r"})

        dashboard_main(["strava", "--disconnect"])

        assert not is_connected(cache)

    def test_install_app_creates_a_launchable_bundle_with_its_icon(self, tmp_path):
        app = install_app(python="/opt/py/bin/python3", apps_dir=tmp_path)

        assert app.name == "Pulso.app"
        script = app / "Contents" / "MacOS" / "pulso"
        assert script.stat().st_mode & stat.S_IXUSR
        assert "/opt/py/bin/python3 -m garmin_connect_mcp.cli dashboard --window" in (
            script.read_text()
        )
        plist = (app / "Contents" / "Info.plist").read_text()
        assert "<string>pulso</string>" in plist
        assert "<key>CFBundleIconFile</key><string>AppIcon</string>" in plist
        icon = app / "Contents" / "Resources" / "AppIcon.icns"
        assert icon.read_bytes()[:4] == b"icns"


class TestServer:
    @pytest.fixture
    def server(self):
        release = threading.Event()
        syncs: list[int] = []

        def do_sync(step):
            step(0, 2, "sleep")
            release.wait(5)
            if srv.fail:  # type: ignore[attr-defined]
                raise SystemExit("Garmin is not authenticated. Run: garmin-connect-mcp auth")
            step(2, 2, "")
            syncs.append(1)
            return {"fetched": 3, "cached": 0, "errors": []}

        srv = DashboardServer(0, page=lambda: "<html>ok</html>", do_sync=do_sync)
        srv.syncs, srv.release, srv.fail = syncs, release, False  # type: ignore[attr-defined]
        thread = threading.Thread(target=srv.serve_forever, daemon=True)
        thread.start()
        yield srv
        release.set()
        srv.shutdown()

    def _request(self, server, method, path, headers=None, body=None):
        port = server.server_address[1]
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        payload = json.dumps(body) if body is not None else None
        conn.request(
            method, path, body=payload, headers={"Host": f"127.0.0.1:{port}", **(headers or {})}
        )
        res = conn.getresponse()
        return res.status, res.read().decode()

    def _status(self, server):
        return json.loads(self._request(server, "GET", "/api/status")[1])

    def _wait_until_finished(self, server):
        deadline = time.monotonic() + 5
        while self._status(server)["state"] == "running" and time.monotonic() < deadline:
            time.sleep(0.01)
        return self._status(server)

    def test_page_opens_immediately_while_sync_runs_in_the_background(self, server):
        status, body = self._request(server, "POST", "/api/sync", body={"auto": True})
        assert status == 202 and json.loads(body)["started"] is True

        assert self._request(server, "GET", "/") == (200, "<html>ok</html>")
        running = self._status(server)
        assert running["state"] == "running"
        assert (running["done"], running["total"], running["source"]) == (0, 2, "sleep")

        server.release.set()
        done = self._wait_until_finished(server)
        assert done["state"] == "done" and done["result"]["fetched"] == 3
        assert server.syncs == [1]

    def test_only_one_sync_runs_at_a_time(self, server):
        assert self._request(server, "POST", "/api/sync")[0] == 202
        status, body = self._request(server, "POST", "/api/sync")
        assert status == 200 and json.loads(body)["started"] is False

        server.release.set()
        self._wait_until_finished(server)
        assert server.syncs == [1]

    def test_reopening_right_after_a_sync_does_not_sync_again_but_the_button_does(self, server):
        server.release.set()
        self._request(server, "POST", "/api/sync", body={"auto": True})
        self._wait_until_finished(server)

        status, body = self._request(server, "POST", "/api/sync", body={"auto": True})
        assert json.loads(body)["started"] is False and json.loads(body)["state"] == "done"
        assert self._request(server, "POST", "/api/sync", body={"auto": False})[0] == 202
        self._wait_until_finished(server)
        assert server.syncs == [1, 1]

    def test_failed_sync_is_reported_in_the_status(self, server):
        server.fail = True
        self._request(server, "POST", "/api/sync", body={"auto": True})
        server.release.set()

        failed = self._wait_until_finished(server)
        assert failed["state"] == "error" and "garmin-connect-mcp auth" in failed["error"]
        assert self._request(server, "POST", "/api/sync")[0] == 202, "a failure can be retried"

    def test_rejects_foreign_hosts_and_origins(self, server):
        assert self._request(server, "GET", "/", {"Host": "evil.example:80"})[0] == 403
        assert self._request(server, "GET", "/api/status", {"Host": "evil.example:80"})[0] == 403
        assert (
            self._request(server, "POST", "/api/sync", {"Origin": "http://evil.example"})[0] == 403
        )
        assert self._status(server)["state"] == "idle"

    def test_heartbeat_keeps_it_alive_and_a_running_sync_is_never_cut_off(self, server):
        assert server.idle(server.started + 10_000)
        assert self._request(server, "POST", "/api/ping")[0] == 200
        assert not server.idle(server.last_ping + 1)

        self._request(server, "POST", "/api/sync")
        assert not server.idle(server.started + 10_000)
