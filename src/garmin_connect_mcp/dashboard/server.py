"""Tiny local web server behind the dashboard app: the page, a background sync and its status.

It binds to 127.0.0.1 only, rejects requests whose Host or Origin is not this server
(DNS-rebinding and cross-site POSTs), and exits on its own once no browser tab has
checked in for a while.

Opening the page asks for an automatic sync; it runs in a background thread while the page
shows cached data and polls ``/api/status`` for progress.
"""

import json
import sys
import threading
import time
from collections.abc import Callable
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qsl, urlsplit

IDLE_SHUTDOWN_SECONDS = 120
NO_TAB_SHUTDOWN_SECONDS = 600
# An automatic sync (page load) is skipped if one finished this recently, so the reload
# that shows fresh data does not start yet another sync. The Sync button always runs.
AUTO_SYNC_COOLDOWN_SECONDS = 300

Step = Callable[[int, int, str], None]


class DashboardServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(
        self,
        port: int,
        page: Callable[[], str],
        do_sync: Callable[[Step], dict[str, Any]],
        strava: Any = None,
        strava_disconnect: Callable[[], None] | None = None,
    ):
        super().__init__(("127.0.0.1", port), _Handler)
        self.page = page
        self.do_sync = do_sync
        self.strava = strava  # StravaLink: connect from the app; None when not offered
        self.strava_disconnect = strava_disconnect
        self.started = time.monotonic()
        self.last_ping: float | None = None
        self.sync_lock = threading.Lock()
        self.finished_at: float | None = None
        self.status: dict[str, Any] = {"state": "idle", "done": 0, "total": 0, "generation": 0}

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server_address[1]}/"

    def allowed_hosts(self) -> set[str]:
        port = self.server_address[1]
        return {f"127.0.0.1:{port}", f"localhost:{port}"}

    def idle(self, now: float) -> bool:
        if self.status["state"] == "running":
            return False  # never stop halfway through a download
        if self.last_ping is None:
            return now - self.started > NO_TAB_SHUTDOWN_SECONDS
        return now - self.last_ping > IDLE_SHUTDOWN_SECONDS

    def start_sync(self, *, auto: bool) -> bool:
        """Start a background sync unless one is running (or, for ``auto``, just finished)."""
        if auto and self.finished_at is not None:
            if time.monotonic() - self.finished_at < AUTO_SYNC_COOLDOWN_SECONDS:
                return False
        if not self.sync_lock.acquire(blocking=False):
            return False
        print(f"Sync started ({'opened' if auto else 'button'}).", file=sys.stderr)
        generation = self.status["generation"] + 1
        self.status = {"state": "running", "done": 0, "total": 0, "generation": generation}
        threading.Thread(target=self._run_sync, daemon=True).start()
        return True

    def _run_sync(self) -> None:
        def step(done: int, total: int, source: str) -> None:
            self.status = {**self.status, "done": done, "total": total, "source": source}

        try:
            result = self.do_sync(step)
            self.status = {**self.status, "state": "done", "result": result}
        except (Exception, SystemExit) as exc:  # SystemExit: "not authenticated" from the CLI
            self.status = {**self.status, "state": "error", "error": str(exc)}
        finally:
            self.finished_at = time.monotonic()
            self.sync_lock.release()

    def serve_until_idle(self) -> None:
        def watchdog() -> None:
            while True:
                time.sleep(5)
                if self.idle(time.monotonic()):
                    print("No open dashboard tabs; shutting down.", file=sys.stderr)
                    self.shutdown()
                    return

        threading.Thread(target=watchdog, daemon=True).start()
        self.serve_forever()


class _Handler(BaseHTTPRequestHandler):
    server: DashboardServer

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - stdlib signature
        pass  # keep the terminal quiet; nothing here is worth logging

    def _trusted(self) -> bool:
        allowed = self.server.allowed_hosts()
        if self.headers.get("Host") not in allowed:
            return False
        origin = self.headers.get("Origin")
        return origin is None or origin.removeprefix("http://") in allowed

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        self._send(status, json.dumps(payload).encode(), "application/json")

    def _body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= 1024:
            return {}
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            return {}
        return body if isinstance(body, dict) else {}

    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if not self._trusted():
            return self._send(HTTPStatus.FORBIDDEN, b"forbidden", "text/plain")
        url = urlsplit(self.path)
        path = url.path
        self.server.last_ping = time.monotonic()
        if path == "/api/status":
            return self._json(HTTPStatus.OK, {"ok": True, **self.server.status})
        if path == "/strava/callback" and self.server.strava:
            return self._strava_callback(dict(parse_qsl(url.query)))
        if path not in ("/", "/index.html"):
            return self._send(HTTPStatus.NOT_FOUND, b"not found", "text/plain")
        self._send(HTTPStatus.OK, self.server.page().encode(), "text/html; charset=utf-8")

    def do_POST(self) -> None:  # noqa: N802 - stdlib naming
        if not self._trusted():
            return self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "forbidden"})
        if self.path == "/api/ping":
            self.server.last_ping = time.monotonic()
            return self._json(HTTPStatus.OK, {"ok": True})
        if self.path == "/api/sync":
            started = self.server.start_sync(auto=bool(self._body().get("auto")))
            status = HTTPStatus.ACCEPTED if started else HTTPStatus.OK
            return self._json(status, {"ok": True, "started": started, **self.server.status})
        if self.path == "/api/strava/connect" and self.server.strava:
            body = self._body()
            try:
                url = self.server.strava.start(
                    str(body.get("client_id") or ""),
                    str(body.get("client_secret") or ""),
                    f"{self.server.url}strava/callback",
                )
            except Exception as exc:  # StravaError: shown to the user as is
                return self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
            return self._json(HTTPStatus.OK, {"ok": True, "url": url})
        if self.path == "/api/strava/disconnect" and self.server.strava_disconnect:
            self.server.strava_disconnect()
            return self._json(HTTPStatus.OK, {"ok": True})
        self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def _strava_callback(self, params: dict[str, str]) -> None:
        """Strava sends the browser back here; save the tokens, then sync and show the app."""
        try:
            self.server.strava.finish(params)
        except Exception as exc:  # StravaError, or Strava unreachable
            message = str(exc).replace("&", "&amp;").replace("<", "&lt;")
            body = (
                "<!doctype html><meta charset='utf-8'><title>Pulso</title>"
                "<body style='font:16px system-ui;margin:48px;max-width:640px'>"
                f"<h1 style='font-size:22px'>Strava</h1><p>{message}</p>"
                "<p><a href='/'>← Pulso</a></p>"
            )
            return self._send(HTTPStatus.BAD_REQUEST, body.encode(), "text/html; charset=utf-8")
        self.server.start_sync(auto=False)
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", "/?strava=connected")
        self.send_header("Content-Length", "0")
        self.end_headers()
