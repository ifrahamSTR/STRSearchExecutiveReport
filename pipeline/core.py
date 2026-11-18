"""Shared loading for "The Client Journey", 16 Nov 2026 reporting version.

Records, rebuilt views, definitions and headline metrics come from the Business Data Explorer's 16 Nov foundation
(pipeline/foundation.py in the Explorer repository, imported, not copied), so both sites publish the same figures.
Populations are kept apart exactly as in the Explorer:
  ctx.jira / ctx.signed   Jira issues (reporting-layer flags)            -> chapters 1-3 client counts
  ctx.cohort              won engagements with a confirmed Jira start    -> chapters 4-5 durations
  ctx.f.monthly           daily_client_activity summed by month          -> chapter 3 throughput
The archived 12 Nov 2026 version keeps its own pipeline in versions/2026-11-12/pipeline/.
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
VERSION_ID = "2026-11-16"


@dataclass
class Ctx:
    f: object               # the Explorer foundation (records, rebuilt views, recon, quality, expected)
    jira: pd.DataFrame      # every Jira issue (reporting-layer flags) + aliases used by the chapter modules
    signed: pd.DataFrame    # Jira issues with signed_up_client = 1
    cohort: pd.DataFrame    # client_cohort_performance: won engagements with a confirmed Jira start
    deals: pd.DataFrame     # pipedrive_reporting_base, cleaned (in_scope, status, won_date, ...)
    asof: pd.Timestamp
    D: object               # Explorer 16 Nov definitions module
    expected: dict          # Explorer headline metrics (the figures both sites show)
    explorer: Path


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def load(explorer: Path, reports: Path | None, use_cache: bool) -> Ctx:
    fpath = explorer / "pipeline" / "foundation.py"
    if not fpath.exists():
        raise SystemExit(f"Business Data Explorer 16 Nov foundation not found at: {fpath}\n"
                         "Pass --explorer <path to STRSearch-Business-Data-Explorer>.")
    F = _load_module("explorer_foundation", fpath)
    D = sys.modules["definitions"]
    f = F.load(reports, use_cache, cache_dir=explorer / ".cache")
    if f.recon_failures:
        raise SystemExit("Explorer reconciliation failed: " + "; ".join(r["check"] for r in f.recon_failures))
    return from_foundation(f, explorer, D)


def from_foundation(f, explorer: Path, D=None) -> Ctx:
    """Ctx from an already-loaded Explorer foundation (used by load() and by the Explorer's own build to reuse the
    chapter modules without loading the reporting layer twice)."""
    D = D or sys.modules["definitions"]
    asof = f.asof
    j = f.jira.copy()
    j["signed_list"], j["active_list"], j["inactive_list"] = j.signed, j.active, j.inactive   # names the chapter code uses
    j["start_src"] = j.start_rule
    j["elapsed"] = (asof - j.start).dt.days
    c = f.cohort.copy()
    c["days_uc"], c["days_closed"], c["elapsed"] = c.days_to_uc, c.days_to_close, c.days_since_start
    c["start_src"], c["pd_experience"] = c.start_rule, c.experience
    return Ctx(f=f, jira=j, signed=j[j.signed].copy(), cohort=c, deals=f.deals, asof=asof, D=D, expected=f.expected, explorer=explorer)


def km_curve(t, e) -> pd.DataFrame:
    """Kaplan-Meier product-limit estimate (the same estimator as the Explorer). Cumulative share reaching the milestone."""
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
    d = np.sort(pd.to_numeric(days, errors="coerce").dropna().values)
    d = d[d >= 0]
    u, cnt = np.unique(d, return_counts=True)
    return pd.DataFrame({"t": u, "cum": np.cumsum(cnt) / len(d)})


def month_label(p) -> str:
    return pd.Period(p, freq="M").strftime("%b %Y")
