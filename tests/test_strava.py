"""Behaviour tests for Strava: connection, sync, rate limits and merging with Garmin.

Strava is faked at the HTTP boundary (``httpx.MockTransport``); the client, cache,
normalisation and local server run for real.
"""

import http.client
import json
import stat
import threading
from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from garmin_connect_mcp.dashboard.cache import ChunkCache
from garmin_connect_mcp.dashboard.normalize import build_dataset
from garmin_connect_mcp.dashboard.server import DashboardServer
from garmin_connect_mcp.dashboard.strava import (
    NotConnected,
    StravaAPI,
    StravaError,
    StravaLink,
    is_connected,
    save_credentials,
    sync_strava,
)
from garmin_connect_mcp.dashboard.sync import sync
from tests.test_dashboard import TODAY, FakeGarmin

CLIENT_ID = "12345"
SECRET = "0123456789abcdef0123456789abcdef01234567"


class FakeStrava:
    """A Strava account with one Garmin upload, one phone-only run and private fields."""

    def __init__(self, short_limit: int = 100):
        self.requests: list[str] = []
        self.token_posts: list[dict[str, list[str]]] = []
        self.short_limit = short_limit
        self.revoked = False
        self.zones_status = 200
        garmin_ride = date(2025, 3, 13)  # FakeGarmin trains on days with ordinal % 3 == 0
        assert FakeGarmin.load(garmin_ride)
        self.activities = [
            {
                "id": 501,
                "name": "Morning ride",
                "sport_type": "Ride",
                "start_date": f"{garmin_ride}T21:00:00Z",
                "start_date_local": f"{garmin_ride}T18:00:00Z",
                "distance": 40000.0,
                "moving_time": 5200,
                "elapsed_time": 5400,
                "total_elevation_gain": 400.0,
                "kudos_count": 7,
                "suffer_score": 88,
                "gear_id": "b1",
                "external_id": f"garmin_ping_{garmin_ride.toordinal()}",
                "map": {"summary_polyline": "SECRET_POLYLINE"},
                "start_latlng": [12.345, 67.89],
                "athlete": {"id": 42},
            },
            {
                "id": 502,
                "name": "Phone run",
                "sport_type": "Run",
                "start_date": "2025-03-14T10:00:00Z",
                "start_date_local": "2025-03-14T07:00:00Z",
                "distance": 10000.0,
                "moving_time": 3000,
                "elapsed_time": 3100,
                "total_elevation_gain": 50.0,
                "average_heartrate": 150.0,
                "external_id": "phone.gpx",
            },
        ]

    def handle(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/oauth/token":
            form = parse_qs(request.content.decode())
            self.token_posts.append(form)
            if self.revoked:
                return httpx.Response(400, json={"message": "Bad Request"})
            return httpx.Response(
                200,
                json={
                    "access_token": f"access-{len(self.token_posts)}",
                    "refresh_token": "refresh-2",
                    "expires_at": 4_000_000_000,
                    "athlete": {"id": 42, "firstname": "Ana"},
                },
            )
        path = request.url.path.removeprefix("/api/v3")
        self.requests.append(path)
        headers = {
            "X-ReadRateLimit-Limit": f"{self.short_limit},1000",
            "X-ReadRateLimit-Usage": f"{len(self.requests)},{len(self.requests)}",
        }
        if path == "/athlete":
            body = {
                "id": 42,
                "firstname": "Ana",
                "city": "Santiago",
                "ftp": 250,
                "bikes": [{"id": "b1", "name": "Road bike", "distance": 1_234_000}],
                "shoes": [],
            }
        elif path == "/athlete/zones":
            body = {"heart_rate": {"zones": [{"min": 0, "max": 120}, {"min": 120, "max": -1}]}}
        elif path == "/athletes/42/stats":
            body = {"all_ride_totals": {"count": 1, "distance": 40000, "moving_time": 5200}}
        elif path == "/athlete/activities":
            page = int(request.url.params["page"])
            after, before = int(request.url.params["after"]), int(request.url.params["before"])
            body = [
                a
                for a in self.activities
                if after
                < datetime.fromisoformat(a["start_date"].replace("Z", "+00:00"))
                .astimezone(UTC)
                .timestamp()
                < before
            ][(page - 1) * 200 : page * 200]
        elif path.endswith("/zones"):
            if self.zones_status != 200:
                return httpx.Response(self.zones_status, json={}, headers=headers)
            body = [
                {
                    "type": "heartrate",
                    "distribution_buckets": [{"time": 600}, {"time": 4800}],
                }
            ]
        elif path.startswith("/activities/"):
            sid = int(path.split("/")[2])
            base = next(a for a in self.activities if a["id"] == sid)
            body = {
                **base,
                "device_name": "Edge",
                "best_efforts": [
                    {"name": "5k", "elapsed_time": 1500, "pr_rank": 1, "athlete": {"id": 42}}
                ]
                if sid == 502
                else [],
                "segment_efforts": [
                    {
                        "name": "Climb",
                        "elapsed_time": 600,
                        "distance": 2000,
                        "pr_rank": 2,
                        "segment": {"name": "Climb", "start_latlng": [1.0, 2.0]},
                    }
                ]
                if sid == 501
                else [],
            }
        else:
            return httpx.Response(404, json={})
        return httpx.Response(200, json=body, headers=headers)

    def client(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handle))


def _connect(cache: ChunkCache, expires_at: int = 4_000_000_000) -> None:
    save_credentials(
        cache,
        {
            "client_id": CLIENT_ID,
            "client_secret": SECRET,
            "access_token": "access-1",
            "refresh_token": "refresh-1",
            "expires_at": expires_at,
            "athlete_id": 42,
        },
    )


@pytest.fixture
def cache(tmp_path: Path) -> ChunkCache:
    return ChunkCache(tmp_path / "dash")


class TestConnect:
    def test_authorization_saves_private_tokens(self, cache):
        strava = FakeStrava()
        link = StravaLink(cache, http=strava.client())
        url = link.start(CLIENT_ID, SECRET, "http://127.0.0.1:9/strava/callback")
        query = parse_qs(urlsplit(url).query)
        assert query["scope"] == ["read,activity:read_all,profile:read_all"]
        assert query["redirect_uri"] == ["http://127.0.0.1:9/strava/callback"]

        athlete = link.finish(
            {"code": "abc", "state": query["state"][0], "scope": "read,activity:read_all"}
        )

        assert athlete["firstname"] == "Ana"
        assert strava.token_posts[0]["grant_type"] == ["authorization_code"]
        assert is_connected(cache)
        creds = cache.root / "strava.json"
        assert stat.S_IMODE(creds.stat().st_mode) == 0o600

    def test_a_forged_or_denied_callback_is_rejected(self, cache):
        link = StravaLink(cache, http=FakeStrava().client())
        link.start(CLIENT_ID, SECRET, "http://127.0.0.1:9/strava/callback")

        with pytest.raises(StravaError, match="state"):
            link.finish({"code": "abc", "state": "forged", "scope": "activity:read_all"})
        with pytest.raises(StravaError, match="access_denied"):
            link.finish({"error": "access_denied", "state": link.pending.state})  # type: ignore[union-attr]
        assert not is_connected(cache)

    def test_malformed_credentials_are_explained_before_leaving_for_strava(self, cache):
        with pytest.raises(StravaError, match="Client ID"):
            StravaLink(cache).start("my app", "secret", "http://127.0.0.1:9/strava/callback")

    def test_expired_token_is_refreshed_and_saved(self, cache):
        _connect(cache, expires_at=0)
        strava = FakeStrava()
        api = StravaAPI(cache, http=strava.client())

        api.get("/athlete")

        assert strava.token_posts[0]["grant_type"] == ["refresh_token"]
        assert json.loads((cache.root / "strava.json").read_text())["refresh_token"] == "refresh-2"

    def test_revoked_access_asks_to_connect_again(self, cache):
        _connect(cache, expires_at=0)
        strava = FakeStrava()
        strava.revoked = True
        with pytest.raises(NotConnected):
            StravaAPI(cache, http=strava.client()).get("/athlete")


class TestSync:
    def test_sync_downloads_profile_lists_and_details_without_private_fields(self, cache):
        _connect(cache)
        strava = FakeStrava()
        report = sync_strava(
            StravaAPI(cache, http=strava.client()), cache, first_year=2024, today=TODAY, pause=0
        )

        assert report.errors == [] and report.pending_details == 0
        assert {"/athlete", "/athlete/zones", "/athletes/42/stats"} <= set(strava.requests)
        assert "/activities/501" in strava.requests and "/activities/502/zones" in strava.requests
        raw = "".join(p.read_text() for p in cache.raw_dir.rglob("*.json"))
        for secret in ("SECRET_POLYLINE", "latlng", "Santiago", '"athlete"'):
            assert secret not in raw

    def test_second_sync_skips_settled_years_and_known_details(self, cache):
        _connect(cache)
        sync_strava(StravaAPI(cache, http=FakeStrava().client()), cache, first_year=2024,
                    today=TODAY, pause=0)  # fmt: skip
        again = FakeStrava()
        report = sync_strava(
            StravaAPI(cache, http=again.client()), cache, first_year=2024, today=TODAY, pause=0
        )

        assert report.cached == 1, "2024 is settled"
        assert not any(p.startswith("/activities/") for p in again.requests)

    def test_rate_limit_stops_details_and_resumes_next_time(self, cache):
        _connect(cache)
        # 3 profile requests + 2 list windows, then a budget of 15 - 10 margin = 5 requests.
        tight = FakeStrava(short_limit=15)
        first = sync_strava(
            StravaAPI(cache, http=tight.client()), cache, first_year=2024, today=TODAY, pause=0
        )
        assert first.pending_details == 2
        assert not any(p.startswith("/activities/") for p in tight.requests)

        second = sync_strava(
            StravaAPI(cache, http=FakeStrava().client()), cache, first_year=2024, today=TODAY,
            pause=0,
        )  # fmt: skip
        assert second.pending_details == 0

    def test_refused_activity_zones_are_not_asked_for_again(self, cache):
        _connect(cache)
        refusing = FakeStrava()
        refusing.zones_status = 402
        report = sync_strava(
            StravaAPI(cache, http=refusing.client()), cache, first_year=2024, today=TODAY, pause=0
        )
        assert report.errors == [] and report.pending_details == 0

        again = FakeStrava()
        sync_strava(StravaAPI(cache, http=again.client()), cache, first_year=2024, today=TODAY,
                    pause=0)  # fmt: skip
        assert not any(p.endswith("/zones") and p != "/athlete/zones" for p in again.requests)


class TestMerge:
    @pytest.fixture
    def merged(self, cache):
        sync(FakeGarmin(), cache, today=TODAY, pause=0)
        _connect(cache)
        sync_strava(StravaAPI(cache, http=FakeStrava().client()), cache, first_year=2024,
                    today=TODAY, pause=0)  # fmt: skip
        return build_dataset(cache, today=TODAY)

    def test_garmin_upload_is_enriched_not_duplicated(self, merged):
        ride = next(a for a in merged["activities"] if a["date"] == "2025-03-13")
        same_day = [a for a in merged["activities"] if a["date"] == "2025-03-13"]

        assert len(same_day) == 1
        assert ride["src"] == "both" and ride["sid"] == 501
        assert ride["kudos"] == 7 and ride["relEffort"] == 88 and ride["gear"] == "Road bike"
        assert ride["hrZonesS"] == [10.0, 80.0]
        assert ride["segs"][0]["name"] == "Climb" and ride["segs"][0]["pr"] == 2

    def test_strava_only_activity_is_added_and_counted_in_its_day(self, merged):
        run = next(a for a in merged["activities"] if a.get("sid") == 502)
        assert run["src"] == "strava" and run["sport"] == "running"
        assert run["km"] == 10.0 and run["best"] == {"5k": [1500, 1]}

        days = merged["days"]
        i = days["date"].index("2025-03-14")
        assert days["actKm"][i] >= 10.0

    def test_athlete_block_has_zones_gear_and_totals(self, merged):
        block = merged["strava"]
        assert block["connected"] and block["ftp"] == 250
        assert block["hrZones"] == [[0, 120], [120, -1]]
        assert block["gear"][0] == {
            "id": "b1", "name": "Road bike", "kind": "bike", "km": 1234,
            "primary": False, "retired": False,
        }  # fmt: skip
        assert block["totals"]["ride"]["count"] == 1

    def test_without_strava_the_dataset_has_no_strava_block(self, cache):
        sync(FakeGarmin(), cache, today=TODAY, pause=0)
        data = build_dataset(cache, today=TODAY)
        assert data["strava"] is None
        assert all("src" not in a for a in data["activities"])


class TestAppConnect:
    @pytest.fixture
    def server(self, cache):
        strava = FakeStrava()
        syncs: list[int] = []
        srv = DashboardServer(
            0,
            page=lambda: "<html>ok</html>",
            do_sync=lambda step: syncs.append(1) or {"fetched": 0, "cached": 0, "errors": []},
            strava=StravaLink(cache, http=strava.client()),
            strava_disconnect=lambda: (cache.root / "strava.json").unlink(missing_ok=True),
        )
        srv.syncs = syncs  # type: ignore[attr-defined]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        yield srv
        srv.shutdown()

    def _request(self, server, method, path, body=None):
        port = server.server_address[1]
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        conn.request(
            method,
            path,
            body=json.dumps(body) if body is not None else None,
            headers={"Host": f"127.0.0.1:{port}"},
        )
        res = conn.getresponse()
        return res.status, res.getheader("Location"), res.read().decode()

    def test_connect_from_the_app_round_trip(self, server, cache):
        status, _, body = self._request(
            server, "POST", "/api/strava/connect", {"client_id": CLIENT_ID, "client_secret": SECRET}
        )
        assert status == 200
        url = json.loads(body)["url"]
        query = parse_qs(urlsplit(url).query)
        assert query["redirect_uri"] == [f"{server.url}strava/callback"]

        status, location, _ = self._request(
            server,
            "GET",
            f"/strava/callback?code=abc&scope=read,activity:read_all&state={query['state'][0]}",
        )
        assert status == 303 and location == "/?strava=connected"
        assert is_connected(cache)

        assert self._request(server, "POST", "/api/strava/disconnect")[0] == 200
        assert not is_connected(cache)

    def test_callback_with_a_wrong_state_shows_an_error_page(self, server, cache):
        self._request(
            server, "POST", "/api/strava/connect", {"client_id": CLIENT_ID, "client_secret": SECRET}
        )
        status, _, body = self._request(
            server, "GET", "/strava/callback?code=abc&scope=activity:read_all&state=evil"
        )
        assert status == 400 and "state" in body
        assert not is_connected(cache)

    def test_bad_credentials_are_reported_to_the_page(self, server):
        status, _, body = self._request(
            server, "POST", "/api/strava/connect", {"client_id": "x", "client_secret": "y"}
        )
        assert status == 400 and "Client ID" in json.loads(body)["error"]
