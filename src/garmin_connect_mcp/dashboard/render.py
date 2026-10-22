"""Render the dataset into one self-contained HTML file (no network needed to view it)."""

import base64
import json
from importlib import resources
from pathlib import Path
from typing import Any

from ..auth import write_private_file

_ASSETS = resources.files("garmin_connect_mcp.dashboard") / "assets"


def _embed_json(value: Any) -> str:
    # "</" would end the <script> element early; "<!--" could open a comment in old parsers.
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return text.replace("</", "<\\/").replace("<!--", "<\\!--")


def render_html(dataset: dict[str, Any], *, live: bool = False, auto_sync: bool = False) -> str:
    """Return the dashboard page with Chart.js, the app and the data inlined.

    Args:
        dataset: output of ``build_dataset`` with ``correlations`` attached.
        live: True when served by the local app; enables the in-page sync button.
        auto_sync: with ``live``, start a background sync as soon as the page opens.
    """
    template = (_ASSETS / "dashboard.html").read_text(encoding="utf-8")
    chart_js = (_ASSETS / "chart.umd.min.js").read_text(encoding="utf-8")
    app_js = (_ASSETS / "app.js").read_text(encoding="utf-8")
    styles = (_ASSETS / "styles.css").read_text(encoding="utf-8")
    icon = base64.b64encode((_ASSETS / "icon.svg").read_bytes()).decode()
    replacements = {
        "/*__STYLES__*/": styles,
        "/*__ICON__*/": f"data:image/svg+xml;base64,{icon}",
        "/*__CHART_JS__*/": chart_js,
        "/*__APP_JS__*/": app_js,
        "/*__LIVE__*/false": "true" if live else "false",
        "/*__AUTOSYNC__*/false": "true" if live and auto_sync else "false",
        # Last, so no marker is ever searched for inside user data.
        "/*__DATA__*/null": _embed_json(dataset),
    }
    for marker, value in replacements.items():
        template = template.replace(marker, value)
    return template


def write_dashboard(dataset: dict[str, Any], output: Path) -> Path:
    """Write the dashboard ``0600``: the page contains your health history."""
    output = Path(output).expanduser()
    write_private_file(output, render_html(dataset))
    return output
