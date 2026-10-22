"""``garmin-connect-mcp dashboard``: sync, build and open the dashboard."""

import argparse
import getpass
import os
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import webbrowser
from collections.abc import Callable
from datetime import date
from importlib import resources
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlsplit

from .analytics import correlations
from .cache import ChunkCache, default_cache_dir
from .normalize import build_dataset
from .render import _ASSETS, render_html, write_dashboard
from .strava import (
    SETTINGS_URL,
    NotConnected,
    StravaAPI,
    StravaError,
    StravaLink,
    disconnect,
    is_connected,
    save_credentials,
    sync_strava,
)
from .sync import REQUEST_PAUSE_SECONDS, sync

APP_NAME = "Pulso"
# Browsers that can open a page as a standalone app window (no tabs or address bar).
_APP_WINDOW_BROWSERS = ("Google Chrome", "Microsoft Edge", "Brave Browser", "Chromium")


def build(cache: ChunkCache, *, demo: bool = False) -> dict[str, Any]:
    """Cache -> dataset with correlations attached."""
    dataset = build_dataset(cache)
    dataset["correlations"] = correlations(dataset)
    dataset["demo"] = demo
    return dataset


def _client() -> Any:
    from ..auth import can_authenticate, load_config
    from ..client import init_garmin_client

    config = load_config()
    if not can_authenticate(config):
        raise SystemExit("Garmin is not authenticated. Run: garmin-connect-mcp auth")
    client = init_garmin_client(config)
    if client is None:
        raise SystemExit("Could not sign in to Garmin. Run: garmin-connect-mcp auth")
    return client


# The demo has no network to wait for; a tiny pause lets the app show its progress bar.
DEMO_APP_PAUSE_SECONDS = 0.03


def _demo_strava(cache: ChunkCache, garmin: Any) -> StravaAPI:
    import httpx

    from .demo import DemoStrava

    save_credentials(
        cache,
        {"client_id": "0", "client_secret": "demo", "access_token": "demo",
         "refresh_token": "demo", "expires_at": 2**40, "athlete_id": 1},
    )  # fmt: skip
    return StravaAPI(cache, http=httpx.Client(transport=DemoStrava(garmin).transport))


def _sync(
    cache: ChunkCache,
    args: argparse.Namespace,
    on_step: Callable[[int, int, str], None] | None = None,
) -> dict[str, Any]:
    """Garmin first, then Strava when it is connected; one combined progress count."""
    if args.demo:
        from .demo import DemoGarmin

        client, pause = DemoGarmin(), DEMO_APP_PAUSE_SECONDS if on_step else 0.0
    else:
        client, pause = _client(), REQUEST_PAUSE_SECONDS
    log = None if args.demo else lambda line: print(f"  ↓ {line}", file=sys.stderr)
    with_strava = args.demo or is_connected(cache)
    garmin_total = [0]

    def garmin_step(done: int, total: int, source: str) -> None:
        garmin_total[0] = total
        if on_step:
            # Keep the bar short of 100 % while Strava is still to come.
            on_step(done, total + (1 if with_strava else 0), source)

    report = sync(
        client, cache, since=args.since, full=args.full, pause=pause, progress=log,
        on_step=garmin_step,
    )  # fmt: skip
    print(
        f"Garmin: {report.fetched} downloaded, {report.cached} already cached, "
        f"{len(report.errors)} errors.",
        file=sys.stderr,
    )
    result: dict[str, Any] = {
        "fetched": report.fetched,
        "cached": report.cached,
        "errors": list(report.errors),
    }
    if with_strava:
        result["strava"] = _sync_strava(
            cache, args, client if args.demo else None, garmin_total[0], on_step, log
        )
        result["fetched"] += result["strava"].get("fetched", 0)
        result["errors"] += result["strava"].get("errors", [])
    for err in result["errors"]:
        print(f"  ! {err['source']} {err['window']}: {err['error']}", file=sys.stderr)
    return result


def _sync_strava(
    cache: ChunkCache,
    args: argparse.Namespace,
    demo_garmin: Any,
    offset: int,
    on_step: Callable[[int, int, str], None] | None,
    log: Callable[[str], None] | None,
) -> dict[str, Any]:
    try:
        api = _demo_strava(cache, demo_garmin) if args.demo else StravaAPI(cache)
        first_year = args.since or cache.meta().get("first_year") or date.today().year
        report = sync_strava(
            api, cache, first_year=first_year, full=args.full, progress=log,
            pause=0 if args.demo else 0.1,
            on_step=(lambda d, t, s: on_step(offset + d, offset + t, s)) if on_step else None,
        )  # fmt: skip
    except NotConnected as exc:
        return {"fetched": 0, "errors": [{"source": "strava", "window": "", "error": str(exc)}]}
    pending = (
        f", {report.pending_details} activities still waiting for details"
        if (report.pending_details)
        else ""
    )
    print(
        f"Strava: {report.fetched} downloaded, {report.cached} already cached{pending}.",
        file=sys.stderr,
    )
    return {
        "fetched": report.fetched,
        "pending": report.pending_details,
        "errors": report.errors,
    }


def connect_strava(cache: ChunkCache, *, open_browser: bool = True) -> None:
    """Guided connection from the terminal: credentials, browser authorization, callback."""
    from http.server import BaseHTTPRequestHandler, HTTPServer

    print(
        "Connect Strava\n"
        f"1. Open {SETTINGS_URL} and create an API application (any name and website;\n"
        "   'Authorization Callback Domain': localhost).\n"
        "2. Paste its Client ID and Client Secret here.\n"
    )
    client_id = os.environ.get("STRAVA_CLIENT_ID") or input("Client ID: ")
    client_secret = os.environ.get("STRAVA_CLIENT_SECRET") or getpass.getpass("Client Secret: ")
    answer: dict[str, str] = {}

    class Callback(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            pass

        def do_GET(self) -> None:  # noqa: N802
            url = urlsplit(self.path)
            if url.path != "/strava/callback":
                self.send_error(404)
                return
            answer.update(parse_qsl(url.query))
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                "<p style='font:16px system-ui;margin:40px'>Listo. Puedes cerrar esta pestaña "
                "y volver a la terminal. / Done, you can close this tab.</p>".encode()
            )

    server = HTTPServer(("127.0.0.1", 0), Callback)
    server.timeout = 5
    link = StravaLink(cache)
    url = link.start(
        client_id, client_secret, f"http://127.0.0.1:{server.server_address[1]}/strava/callback"
    )
    print(f"\n3. Authorize Pulso in the browser:\n   {url}\n", file=sys.stderr)
    if open_browser:
        webbrowser.open(url)
    deadline = time.monotonic() + 300
    while not answer:
        if time.monotonic() > deadline:
            raise SystemExit("No answer from Strava within 5 minutes; run the command again.")
        server.handle_request()
    server.server_close()
    athlete = link.finish(answer)
    name = athlete.get("firstname") or ""
    print(f"Strava connected{', ' + name if name else ''}. It syncs every time Pulso opens.")


def open_window(url: str, profile_dir: Path) -> None:
    """Open ``url`` as its own app window when a Chromium browser is installed (macOS).

    The window gets a private browser profile in ``profile_dir``: otherwise it would open in
    whichever of the user's profiles was used last, mixing health data into it.
    """
    if sys.platform == "darwin":
        for browser in _APP_WINDOW_BROWSERS:
            if Path(f"/Applications/{browser}.app").is_dir():
                profile_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
                args = [
                    f"--app={url}",
                    f"--user-data-dir={profile_dir}",
                    "--no-first-run",
                    "--no-default-browser-check",
                ]
                subprocess.Popen(["open", "-na", browser, "--args", *args])
                return
    webbrowser.open(url)


def install_app(python: str = sys.executable, apps_dir: Path | None = None) -> Path:
    """Create a double-clickable macOS app (with icon) that runs the dashboard app."""
    apps_dir = apps_dir or Path.home() / "Applications"
    app = apps_dir / f"{APP_NAME}.app"
    macos = app / "Contents" / "MacOS"
    macos.mkdir(parents=True, exist_ok=True)
    resources_dir = app / "Contents" / "Resources"
    resources_dir.mkdir(exist_ok=True)
    with resources.as_file(_ASSETS / "icon.icns") as icon:
        shutil.copyfile(icon, resources_dir / "AppIcon.icns")
    log = default_cache_dir() / "app.log"
    script = macos / "pulso"
    script.write_text(
        "#!/bin/bash\n"
        "# Generated by `garmin-connect-mcp dashboard install-app`.\n"
        f"mkdir -p {shlex.quote(str(log.parent))}\n"
        f"exec {shlex.quote(python)} -m garmin_connect_mcp.cli dashboard --window "
        f">> {shlex.quote(str(log))} 2>&1\n",
        encoding="utf-8",
    )
    script.chmod(script.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    (app / "Contents" / "Info.plist").write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>{APP_NAME}</string>
  <key>CFBundleDisplayName</key><string>{APP_NAME}</string>
  <key>CFBundleIdentifier</key><string>io.github.scortes5.pulso</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleExecutable</key><string>pulso</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
""",
        encoding="utf-8",
    )
    return app


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="garmin-connect-mcp dashboard",
        description=(
            "Open your Garmin history as a local app. It shows what is cached right away and "
            "syncs new data in the background every time it opens."
        ),
    )
    p.add_argument(
        "action",
        nargs="?",
        choices=["install-app", "strava"],
        help="install-app: macOS app; strava: connect your Strava account",
    )
    p.add_argument("--disconnect", action="store_true", help="with strava: forget the connection")
    p.add_argument("--no-sync", action="store_true", help="do not sync; show cached data only")
    p.add_argument("--full", action="store_true", help="re-download all history, not just new days")
    p.add_argument("--since", type=int, metavar="YEAR", help="first year to download")
    p.add_argument(
        "--static", action="store_true", help="sync, then write a standalone HTML file instead"
    )
    p.add_argument("--output", type=Path, metavar="FILE", help="HTML file for --static")
    p.add_argument("--no-open", action="store_true", help="do not open the browser")
    p.add_argument(
        "--window", action="store_true", help="open in its own app window (Chrome, Edge, Brave)"
    )
    p.add_argument("--port", type=int, default=0, help="port for the app (default: any free port)")
    p.add_argument("--demo", action="store_true", help="synthetic data; no Garmin account needed")
    # The app used to be opt-in; old launchers (install-app before 1.3) still pass this.
    p.add_argument("--serve", action="store_true", help=argparse.SUPPRESS)
    return p


def _serve(cache: ChunkCache, args: argparse.Namespace) -> None:
    from .server import DashboardServer

    sync_args = argparse.Namespace(since=args.since, full=args.full, demo=args.demo)
    link = None if args.demo else StravaLink(cache)
    first = {"full": args.full}

    def do_sync(step: Callable[[int, int, str], None]) -> dict[str, Any]:
        # --full applies to the first sync only; later ones (button, reopen) are incremental.
        sync_args.full, first["full"] = first["full"], False
        return _sync(cache, sync_args, on_step=step)

    server = DashboardServer(
        args.port,
        page=lambda: render_html(
            build(cache, demo=args.demo), live=True, auto_sync=not args.no_sync
        ),
        do_sync=do_sync,
        strava=link,
        strava_disconnect=(lambda: disconnect(cache)) if link else None,
    )
    print(f"{APP_NAME} running at {server.url} (Ctrl+C to stop)", file=sys.stderr)
    if not args.no_open:
        if args.window:
            open_window(server.url, cache.root / "window-profile")
        else:
            webbrowser.open(server.url)
    try:
        server.serve_until_idle()
    except KeyboardInterrupt:
        pass


def main(argv: list[str]) -> None:
    args = _parser().parse_args(argv)
    if args.demo:
        # Never mix invented numbers into the real cache.
        cache = ChunkCache(Path(tempfile.mkdtemp(prefix="garmin-dashboard-demo-")))
        args.no_sync = False
    else:
        cache = ChunkCache(default_cache_dir())

    if args.action == "strava":
        if args.demo:
            raise SystemExit("The demo already includes a simulated Strava account.")
        if args.disconnect:
            disconnect(cache)
            print("Strava disconnected; its downloaded data stays in the cache.")
            return
        try:
            connect_strava(cache, open_browser=not args.no_open)
        except StravaError as exc:
            raise SystemExit(str(exc)) from exc
        return

    if args.action == "install-app":
        if sys.platform != "darwin":
            raise SystemExit("install-app is only available on macOS.")
        app = install_app()
        print(f"Installed {app}\nOpen it from Finder, Launchpad or Spotlight ('{APP_NAME}').")
        return

    if not (args.static or args.output):
        return _serve(cache, args)

    if not args.no_sync:
        _sync(cache, args)
    output = args.output or Path(
        os.environ.get("GARMIN_DASHBOARD_HTML", cache.root / "dashboard.html")
    )
    path = write_dashboard(build(cache, demo=args.demo), output)
    print(f"Dashboard written to {path}", file=sys.stderr)
    if not args.no_open:
        webbrowser.open(path.resolve().as_uri())
