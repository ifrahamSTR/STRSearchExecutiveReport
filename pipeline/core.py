"""Shared loading, business rules and statistics for the Executive Performance Report.

Record building and business definitions are NOT re-implemented here. They are imported from the
Business Data Explorer's pipeline (definitions.py, build.py, metrics.py), so both products apply
the same status lists, the same effective start date and the same deal filter.
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

# --------------------------------------------------------------------------------------
# Report settings (analytical choices made for this report; business rules live in the
# Explorer's definitions.py)
# --------------------------------------------------------------------------------------
# Jira issues from before this date are a surviving subset (deleted / moved issues, missing
# milestone history), so cohort comparisons start here.
RELIABLE_FROM = "2025-07-01"
# Business context shown as annotations. Dates are approximate ("late May / early June 2026").
PROCESS_CHANGE = "2026-05-27"        # date carried by the Pipedrive "New Client Experience" option
POST_CHANGE_FIRST_MONTH = "2026-06"  # first full calendar month under the new offer and process
HIST_CAP = 210                       # days; longer durations are grouped into one overflow bin
CUM_DAYS = [30, 45, 60, 90, 120, 180]
AGING_EDGES = [0, 30, 60, 90, 120]   # buckets: 0-29, 30-59, 60-89, 90-119, 120+
MATURE_DAYS = 180                    # follow-up needed before a cohort's outcome is called mature

SEARCH = ["Client Start", "2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks"]
UNDER_CONTRACT = ["Under Contract", "under Contract", "Passed Inspection"]
CLOSED = ["CLOSED"]
POST_CLOSE = ["Photography Shared", "Listed", "Content Pulled"]
# Post-close statuses that can only follow a closing. 'Content Pulled' is left out because its
# meaning is unconfirmed.
SURELY_CLOSED = ["CLOSED", "Photography Shared", "Listed"]
STAGE_ORDER = ["Searching", "Under contract", "Closed", "Post-close", "Paused", "Refunded", "Additional service"]


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@dataclass
class Ctx:
    jira: pd.DataFrame        # every Jira issue, with report columns added
    signed: pd.DataFrame      # issues in the signed-up statuses
    deals: pd.DataFrame       # STR Search pipeline deals (official filter flag: in_scope)
    won: pd.DataFrame         # in-scope won deals
    raw: dict                 # raw sheets as read from the workbooks
    asof: pd.Timestamp
    meta: list
    D: object                 # Explorer definitions module
    M: object                 # Explorer metrics module
    uc_to_close: int          # typical days from UC to CLOSED (median, clients with both dates)


def stage_of(status: str) -> str | None:
    if status in SEARCH:
        return "Searching"
    if status in UNDER_CONTRACT:
        return "Under contract"
    if status in CLOSED:
        return "Closed"
    if status in POST_CLOSE:
        return "Post-close"
    if status == "Paused":
        return "Paused"
    if status == "Refunded":
        return "Refunded"
    if status == "Additional Service":
        return "Additional service"
    return None


def load(explorer: Path, reports: Path | None, use_cache: bool) -> Ctx:
    if not (explorer / "pipeline" / "build.py").exists():
        raise SystemExit(f"Business Data Explorer pipeline not found at: {explorer}\n"
                         "Pass --explorer <path to STRSearch-Business-Data-Explorer>.")
    XB = _load_module("explorer_build", explorer / "pipeline" / "build.py")
    D, M = sys.modules["definitions"], sys.modules["metrics"]
    reports = reports or XB.DEFAULT_REPORTS
    frames, meta = XB.load_sources(reports, use_cache)
    jira_keys = set(XB.clean_str(frames["jira"]["key"]).str.upper().dropna())
    deals_all = XB.build_deals_all(frames["deals"])
    deals = XB.build_deals(frames["deals"], frames["stages"], jira_keys)
    jira = XB.build_jira(frames["jira"], deals_all)
    snap = {m["key"]: m["snapshot"] for m in meta}
    asof = min(pd.Timestamp(snap["jira"]), pd.Timestamp(snap["deals"])).normalize()

    j = jira.copy()
    j["elapsed"] = (asof - j["start"]).dt.days
    j["stage"] = j["status"].map(stage_of)
    both = j[j.uc.notna() & j.closed.notna()]
    uc_to_close = int(round(float((both.closed - both.uc).dt.days.median())))

    # Under Contract, adjusted for incomplete status history. A client with a CLOSED date but no
    # logged UC date did go under contract; the date is unknown. It is placed `uc_to_close` days
    # before the closing (the typical gap), never before the client start.
    j["uc_logged"] = j.uc.notna()
    j["uc_inferred"] = j.uc.isna() & j.closed.notna()
    j["uc_evt"] = j.uc_logged | j.uc_inferred
    inferred_days = (j.days_closed - uc_to_close).clip(lower=0)
    j["t_uc"] = np.where(j.uc_logged, j.days_uc, np.where(j.uc_inferred, inferred_days, j.elapsed)).astype(float)
    j["t_uc_upper"] = np.where(j.uc_logged, j.days_uc, np.where(j.uc_inferred, j.days_closed, j.elapsed)).astype(float)
    j["uc_adj_date"] = j.uc.fillna(j.start + pd.to_timedelta(inferred_days, unit="D"))
    j["cl_evt"] = j.closed.notna()
    j["t_cl"] = np.where(j.cl_evt, j.days_closed, j.elapsed).astype(float)
    # Records whose status says the milestone was passed but whose dates are missing: the timing
    # is unknown, so they are left out of time-to-milestone estimates.
    closedish = j.status.isin(CLOSED + POST_CLOSE)
    j["uc_time_unknown"] = closedish & j.uc.isna() & j.closed.isna()
    j["cl_time_unknown"] = closedish & j.closed.isna()
    # Exit date for paused / refunded / additional-service clients = date of their latest status change.
    j["exit_date"] = j.latest_status_date.where(j.carson_inactive)
    j["exit_days"] = (j.exit_date - j.start).dt.days

    sc = deals[deals.in_scope]
    return Ctx(jira=j, signed=j[j.carson_signed].copy(), deals=deals, won=sc[sc.status == "won"].copy(),
               raw=frames, asof=asof, meta=meta, D=D, M=M, uc_to_close=uc_to_close)


# ----------------------------------------------------------------------------- statistics
def km(t, e) -> pd.DataFrame:
    """Kaplan-Meier estimate. One row per distinct time: at_risk, events, cum (share reached)."""
    df = pd.DataFrame({"t": np.asarray(t, float), "e": np.asarray(e, bool)}).dropna()
    df = df[df.t >= 0]
    g = df.groupby("t").e.agg(["size", "sum"]).sort_index()
    at_risk = len(df) - g["size"].cumsum().shift(fill_value=0)
    surv = (1 - g["sum"] / at_risk).cumprod()
    return pd.DataFrame({"t": g.index.values, "at_risk": at_risk.values, "events": g["sum"].values, "cum": (1 - surv).values})


def km_median(t, e, p: float = 0.5):
    k = km(t, e)
    hit = k[k.cum >= p]
    return float(hit.t.iloc[0]) if len(hit) else None


def km_at(k: pd.DataFrame, day: float) -> float:
    k = k[k.t <= day]
    return float(k.cum.iloc[-1]) if len(k) else 0.0


def km_median_ci(t, e, reps: int = 400, seed: int = 7) -> list:
    """Bootstrap 95% interval for the Kaplan-Meier median (resampling clients)."""
    t, e = np.asarray(t, float), np.asarray(e, bool)
    rng = np.random.default_rng(seed)
    meds = []
    for _ in range(reps):
        i = rng.integers(0, len(t), len(t))
        m = km_median(t[i], e[i])
        if m is not None:
            meds.append(m)
    return [float(np.percentile(meds, 2.5)), float(np.percentile(meds, 97.5))]


def densest_window(d: np.ndarray, width: int) -> dict:
    """Sliding window of `width` days holding the most observations (d sorted ascending)."""
    best = max(range(0, int(d.max()) + 1), key=lambda a: (((d >= a) & (d < a + width)).sum(), -a))
    n = int(((d >= best) & (d < best + width)).sum())
    return {"from": int(best), "to": int(best + width - 1), "n": n, "share": round(n / len(d), 4)}


def shortest_interval(d: np.ndarray, share: float) -> dict:
    """Narrowest range of days that holds `share` of the observations (d sorted ascending)."""
    n = len(d)
    k = int(np.ceil(share * n))
    widths = d[k - 1:] - d[: n - k + 1]
    i = int(np.argmin(widths))
    lo, hi = int(d[i]), int(d[i + k - 1])
    inside = int(((d >= lo) & (d <= hi)).sum())
    return {"from": lo, "to": hi, "n": inside, "share": round(inside / n, 4)}


def skewness(d: np.ndarray) -> float:
    m, s = d.mean(), d.std()
    return round(float(((d - m) ** 3).mean() / s ** 3), 2) if s else 0.0


def month_label(p) -> str:
    return pd.Period(p, freq="M").strftime("%b %Y")


def r(x, nd: int = 4):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), nd)
