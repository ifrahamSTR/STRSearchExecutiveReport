"""Chapter 4: how long does acquisition actually take? (16 Nov 2026 reporting version)

Population: won engagements with a confirmed Jira start (client_cohort_performance). Days = milestone date minus
client_start_date, where client_start_date is the issue due date for Jira issues created before 1 Jun 2026 (or the
created date + 4 days when no due date is set) and the Pipedrive won date from 1 Jun 2026. Under Contract is the
latest valid contract; CLOSED counts closings up to the data date (later dates are scheduled). Kaplan-Meier counts
every confirmed start without the milestone until the data date (hunting, paused and refunded clients alike)."""
from __future__ import annotations

import numpy as np
import pandas as pd

import core as C

HIST_BIN, HIST_CAP = 15, 180
WAIT_BIN, WAIT_CAP = 10, 180
CURVE_DAYS = 200


def _bins(values: pd.Series, width: int, cap: int) -> dict:
    v = pd.to_numeric(values, errors="coerce").dropna()
    v = v[v >= 0]
    counts = [int(((v >= a) & (v < a + width)).sum()) for a in range(0, cap, width)]
    return {"width": width, "cap": cap, "counts": counts, "overflow": int((v >= cap).sum()), "n": int(len(v))}


def build(ctx: C.Ctx) -> dict:
    ex, s = ctx.expected, ctx.cohort
    q1 = ex["q1"]
    observed = {k: {"n": q1[k]["n"], "median": q1[k]["median"], "mean": q1[k]["mean"]} for k in ("uc", "closed")}
    hist = _bins(s.days_uc, HIST_BIN, HIST_CAP)
    top = int(np.argmax(hist["counts"]))
    d = s.days_uc.dropna()
    d = d[d >= 0]
    hist.update({"largest": {"from": top * HIST_BIN, "to": top * HIST_BIN + HIST_BIN - 1, "n": hist["counts"][top]},
                 "within60": {"n": int((d < 60).sum()), "share": round(float((d < 60).mean()), 4)},
                 "median": observed["uc"]["median"], "mean": observed["uc"]["mean"]})
    lanes = {}
    for key, group, ref in (("searching", "Hunting", observed["uc"]["median"]), ("under_contract", "Under contract", observed["closed"]["median"])):
        g = s[s.group == group]
        lanes[key] = {**_bins(g.elapsed, WAIT_BIN, WAIT_CAP), "ref": ref,
                      "past_ref": int((g.elapsed > ref).sum()), "within_ref": int((g.elapsed <= ref).sum()),
                      "statuses": {k: int(v) for k, v in g.status.value_counts().items()}}

    def km(col, days_col):
        t = np.where(s[col].notna(), s[days_col], s.elapsed)
        return C.km_curve(t, s[col].notna().values)

    k_uc, k_cl = km("uc", "days_uc"), km("closed", "days_closed")
    first50 = lambda k: float(k[k.cum >= 0.5].t.iloc[0])  # noqa: E731
    estimate = {"uc": {"median": q1["km_uc"], "curve": C.daily(k_uc, CURVE_DAYS), "check": first50(k_uc)},
                "closed": {"median": q1["km_closed"], "curve": C.daily(k_cl, CURVE_DAYS), "check": first50(k_cl)},
                "n": int(len(s)),
                "recorded_curve": {"uc": C.daily(C.ecdf(s.days_uc), CURVE_DAYS), "closed": C.daily(C.ecdf(s.days_closed), CURVE_DAYS)}}
    gap = s.days_uc_to_close.dropna()
    rules = ("due", "created+4", "won")
    rec = {"uc": s.days_uc.notna() & (s.days_uc >= 0), "closed": s.days_closed.notna() & (s.days_closed >= 0),
           "population": pd.Series(True, index=s.index)}            # recorded durations exclude the negative one(s)
    clock = {k: {"n": int(m.sum()), **{r: int(((s.start_rule == r) & m).sum()) for r in rules}} for k, m in rec.items()}
    clock["fallback_excluded"] = ex["engagements"]["fallback"]
    clock["scheduled_closings"] = ex["engagements"]["scheduled_closings"]
    clock["negative_excluded"] = q1["negative_days_to_uc"]
    return {
        "observed": observed, "hist": hist, "lanes": lanes, "estimate": estimate, "clock": clock,
        "uc_to_close": {"n": int(len(gap)), "median": float(gap.median())},
        "running": int(sum(l["n"] for l in lanes.values())),
        "closed_without_uc_date": int((s.closed.notna() & s.uc.isna()).sum()),
    }
