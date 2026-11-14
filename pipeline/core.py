"""Shared loading for "The Client Journey" presentation.

Nothing is re-analysed here. Records, definitions and headline metrics come straight from the
Business Data Explorer's own pipeline (build.py, definitions.py, metrics.py), imported from its
folder. Chapter modules only reshape those results into what each visual needs: bin counts and
curve points. No dates are imputed and no record is reclassified.
"""
from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_EXPLORER = ROOT.parent / "STRSearch-Business-Data-Explorer"


@dataclass
class Ctx:
    jira: pd.DataFrame      # every Jira issue, as built by the Explorer (plus elapsed days)
    signed: pd.DataFrame    # issues in the signed-up statuses
    deals: pd.DataFrame     # STR Search pipeline deals, as built by the Explorer
    asof: pd.Timestamp
    meta: list
    D: object               # Explorer definitions module
    expected: dict          # Explorer headline metrics (metrics.expected), the figures the page shows
    raw: dict               # raw sheets as read by the Explorer (row order matches ctx.jira)


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def load(explorer: Path, reports: Path | None, use_cache: bool) -> Ctx:
    if not (explorer / "pipeline" / "build.py").exists():
        raise SystemExit(f"Business Data Explorer pipeline not found at: {explorer}\n"
                         "Pass --explorer <path to STRSearch-Business-Data-Explorer>.")
    XB = _load_module("explorer_build", explorer / "pipeline" / "build.py")
    D, M = sys.modules["definitions"], sys.modules["metrics"]
    frames, meta = XB.load_sources(reports or XB.DEFAULT_REPORTS, use_cache)
    jira_keys = set(XB.clean_str(frames["jira"]["key"]).str.upper().dropna())
    deals_all = XB.build_deals_all(frames["deals"])
    deals = XB.build_deals(frames["deals"], frames["stages"], jira_keys)
    jira = XB.build_jira(frames["jira"], deals_all)
    snap = {m["key"]: m["snapshot"] for m in meta}
    asof = min(pd.Timestamp(snap["jira"]), pd.Timestamp(snap["deals"])).normalize()
    jira["elapsed"] = (asof - jira["start"]).dt.days       # days on the acquisition clock so far
    expected = M.expected(deals, jira, asof)
    return Ctx(jira=jira, signed=jira[jira.carson_signed].copy(), deals=deals, asof=asof, meta=meta, D=D, expected=expected, raw=frames)


def km_curve(t, e) -> pd.DataFrame:
    """Kaplan-Meier product-limit estimate: the same estimator as the Explorer's km_median.
    Returns the cumulative share reaching the milestone at each distinct day."""
    df = pd.DataFrame({"t": np.asarray(t, float), "e": np.asarray(e, bool)}).dropna()
    df = df[df.t >= 0]
    g = df.groupby("t").e.agg(["size", "sum"]).sort_index()
    at_risk = len(df) - g["size"].cumsum().shift(fill_value=0)
    surv = (1 - g["sum"] / at_risk).cumprod()
    return pd.DataFrame({"t": g.index.values, "cum": (1 - surv).values})


def daily(points: pd.DataFrame, upto: int) -> list:
    """Step function sampled at every day 0..upto (value = last point at or before the day)."""
    out, j, cur = [], 0, 0.0
    t, c = points.t.values, points.cum.values
    for d in range(upto + 1):
        while j < len(t) and t[j] <= d:
            cur = float(c[j])
            j += 1
        out.append(round(cur, 4))
    return out


def ecdf(days: pd.Series) -> pd.DataFrame:
    d = np.sort(days.dropna().values)
    d = d[d >= 0]
    u, cnt = np.unique(d, return_counts=True)
    return pd.DataFrame({"t": u, "cum": np.cumsum(cnt) / len(d)})


def month_label(p) -> str:
    return pd.Period(p, freq="M").strftime("%b %Y")
