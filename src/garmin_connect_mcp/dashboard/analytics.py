"""Correlations between daily metrics, overall and per year.

Everything here is plain Python so the dashboard has no numeric dependencies. The
numbers describe association in your own history, not causation.
"""

import math
from datetime import date, timedelta
from typing import Any

# Metrics shown in the correlation matrix.
MATRIX_METRICS = (
    "actLoad", "actMin", "imVig", "steps", "tsb", "acwr",
    "rhr", "hrv", "stress", "bbMax", "bbCharged", "readiness",
    "sleepScore", "sleepH", "deepH", "remH", "bedtime", "resp",
)  # fmt: skip

# Hypotheses worth testing explicitly: (x, y, lag in days). ``lag=1`` pairs x on day d with
# y on day d+1. Sleep, HRV and readiness are labelled with the morning you woke up, so the
# night after a workout on day d shows up on d+1.
PAIRS: tuple[tuple[str, str, int], ...] = (
    ("actLoad", "hrv", 1),
    ("actLoad", "rhr", 1),
    ("actLoad", "sleepScore", 1),
    ("actLoad", "readiness", 1),
    ("actLoad", "bbCharged", 1),
    ("imVig", "hrv", 1),
    ("lastEnd", "sleepScore", 1),
    ("lastEnd", "hrv", 1),
    ("stress", "sleepScore", 1),
    ("steps", "sleepScore", 1),
    ("sleepScore", "stress", 0),
    ("sleepScore", "bbMax", 0),
    ("sleepH", "readiness", 0),
    ("sleepH", "rhr", 0),
    ("bedtime", "sleepScore", 0),
    ("bedtime", "deepH", 0),
    ("hrv", "rhr", 0),
    ("hrv", "readiness", 0),
    ("sleepScore", "actLoad", 0),
    ("readiness", "actLoad", 0),
    ("tsb", "hrv", 0),
    ("acwr", "readiness", 0),
    ("resp", "sleepScore", 0),
    ("skinTemp", "hrv", 0),
)

MIN_N = 20


def _rank(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=values.__getitem__)
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            ranks[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return ranks


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True))
    return sxy / math.sqrt(sxx * syy)


def spearman(xs: list[float], ys: list[float]) -> float | None:
    return pearson(_rank(xs), _rank(ys))


def p_value(r: float, n: int) -> float:
    """Two-sided p-value for H0: r = 0, via the t statistic and a normal approximation.

    Accurate to two decimals for n >= 20, which is all the dashboard reports.
    """
    if n < 4 or abs(r) >= 1:
        return 0.0 if abs(r) >= 1 else 1.0
    df = n - 2
    t = abs(r) * math.sqrt(df / (1 - r * r))
    # Cornish-Fisher style correction from Student t to standard normal.
    z = t * (1 - 1 / (4 * df)) / math.sqrt(1 + t * t / (2 * df))
    return math.erfc(z / math.sqrt(2))


def _quantile(sorted_values: list[float], q: float) -> float:
    pos = (len(sorted_values) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (pos - lo)


Window = tuple[str, str] | None  # inclusive ISO date bounds; None means all history


def _aligned(
    days: dict[str, list[Any]], x: str, y: str, lag: int, window: Window
) -> tuple[list[float], list[float]]:
    index = {d: i for i, d in enumerate(days["date"])}
    xs: list[float] = []
    ys: list[float] = []
    for i, d in enumerate(days["date"]):
        if window and not window[0] <= d <= window[1]:
            continue
        xv = days[x][i]
        if xv is None:
            continue
        target = (date.fromisoformat(d) + timedelta(days=lag)).isoformat() if lag else d
        j = index.get(target)
        if j is None:
            continue
        yv = days[y][j]
        if yv is None:
            continue
        xs.append(float(xv))
        ys.append(float(yv))
    return xs, ys


def _pair_stats(xs: list[float], ys: list[float]) -> dict[str, Any] | None:
    n = len(xs)
    r = pearson(xs, ys)
    if r is None or n < MIN_N:
        return None
    rho = spearman(xs, ys)
    sx = sorted(xs)
    lo_cut, hi_cut = _quantile(sx, 0.25), _quantile(sx, 0.75)
    lo = [y for x, y in zip(xs, ys, strict=True) if x <= lo_cut]
    if hi_cut <= lo_cut:
        # Zero-inflated metrics (training load is 0 on every rest day) collapse both
        # quartiles onto the same value; compare "above the low group" instead.
        above = [x for x in xs if x > lo_cut]
        hi_cut = min(above) if above else hi_cut
        hi = [y for x, y in zip(xs, ys, strict=True) if x > lo_cut]
    else:
        hi = [y for x, y in zip(xs, ys, strict=True) if x >= hi_cut]
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True)) / sxx
    return {
        "r": round(r, 3),
        "rho": round(rho, 3) if rho is not None else None,
        "n": n,
        "p": round(p_value(r, n), 4),
        "slope": round(slope, 4),
        "intercept": round(my - slope * mx, 3),
        "loMean": round(sum(lo) / len(lo), 2) if lo else None,
        "hiMean": round(sum(hi) / len(hi), 2) if hi else None,
        "loCut": round(lo_cut, 2),
        "hiCut": round(hi_cut, 2),
    }


def _scope(days: dict[str, list[Any]], window: Window) -> dict[str, Any]:
    matrix: list[list[float | None]] = []
    counts: list[list[int]] = []
    for a in MATRIX_METRICS:
        row, row_n = [], []
        for b in MATRIX_METRICS:
            xs, ys = _aligned(days, a, b, 0, window)
            r = pearson(xs, ys) if len(xs) >= MIN_N else None
            row.append(round(r, 3) if r is not None else None)
            row_n.append(len(xs))
        matrix.append(row)
        counts.append(row_n)

    pairs = []
    for x, y, lag in PAIRS:
        if x not in days or y not in days:
            continue
        stats = _pair_stats(*_aligned(days, x, y, lag, window))
        if stats:
            pairs.append({"x": x, "y": y, "lag": lag, **stats})
    return {"matrix": matrix, "n": counts, "pairs": pairs}


def correlations(dataset: dict[str, Any], *, today: date | None = None) -> dict[str, Any]:
    """Correlation matrix and hypothesis pairs for all history, the last 365 days and each year.

    Scope keys match the dashboard's period selector: ``all``, ``365`` and ``"2024"`` etc.
    """
    days = dataset["days"]
    today = today or date.today()
    scopes = {
        "all": _scope(days, None),
        "365": _scope(days, ((today - timedelta(days=364)).isoformat(), today.isoformat())),
    }
    for year in dataset.get("years", []):
        scopes[year] = _scope(days, (f"{year}-01-01", f"{year}-12-31"))
    return {"metrics": list(MATRIX_METRICS), "minN": MIN_N, "scopes": scopes}
