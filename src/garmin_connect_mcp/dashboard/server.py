"""Tiny local web server for ``dashboard --serve``: the page plus a sync button.

It binds to 127.0.0.1 only, rejects requests whose Host or Origin is not this server
(DNS-rebinding and cross-site POSTs), and exits on its own once no browser tab has
checked in for a while.
"""

import json
import sys
import threading
import time
from collections.abc import Callable
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

IDLE_SHUTDOWN_SECONDS = 120
NO_TAB_SHUTDOWN_SECONDS = 600


class DashboardServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(
        self,
        port: int,
        page: Callable[[], str],
        do_sync: Callable[[], dict[str, Any]],
    ):
        super().__init__(("127.0.0.1", port), _Handler)
        self.page = page
        self.do_sync = do_sync
        self.started = time.monotonic()
        self.last_ping: float | None = None
        self.sync_lock = threading.Lock()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server_address[1]}/"

    def allowed_hosts(self) -> set[str]:
        port = self.server_address[1]
        return {f"127.0.0.1:{port}", f"localhost:{port}"}

    def idle(self, now: float) -> bool:
        if self.last_ping is None:
            return now - self.started > NO_TAB_SHUTDOWN_SECONDS
        return now - self.last_ping > IDLE_SHUTDOWN_SECONDS

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

    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        if not self._trusted():
            return self._send(HTTPStatus.FORBIDDEN, b"forbidden", "text/plain")
        if self.path.split("?")[0] not in ("/", "/index.html"):
            return self._send(HTTPStatus.NOT_FOUND, b"not found", "text/plain")
        self.server.last_ping = time.monotonic()
        self._send(HTTPStatus.OK, self.server.page().encode(), "text/html; charset=utf-8")

    def do_POST(self) -> None:  # noqa: N802 - stdlib naming
        if not self._trusted():
            return self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "forbidden"})
        if self.path == "/api/ping":
            self.server.last_ping = time.monotonic()
            return self._json(HTTPStatus.OK, {"ok": True})
        if self.path == "/api/sync":
            if not self.server.sync_lock.acquire(blocking=False):
                return self._json(HTTPStatus.CONFLICT, {"ok": False, "error": "sync in progress"})
            try:
                result = self.server.do_sync()
            except Exception as exc:
                return self._json(
                    HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)}
                )
            finally:
                self.server.sync_lock.release()
            return self._json(HTTPStatus.OK, {"ok": True, **result})
        self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
