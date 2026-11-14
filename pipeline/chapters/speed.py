"""Chapter 2: how long does it actually take? (the acquisition clock)

1. observed durations   2. distribution of days to UC   3. journeys still running   4. Kaplan-Meier
All figures follow the Explorer: effective start = COALESCE(issue_due_date, issue_created_date),
milestones = first recorded UC / CLOSED date, Kaplan-Meier on signed-up clients with everyone
without the milestone counted until the snapshot date.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import core as C

HIST_BIN = 15          # the Explorer's histogram uses 15-day bins
HIST_CAP = 180         # durations of 180+ days share one overflow bin
WAIT_BIN = 10          # dot chart of unfinished journeys
WAIT_CAP = 180
CURVE_DAYS = 200


def _bins(values: pd.Series, width: int, cap: int) -> dict:
    v = values.dropna()
    v = v[v >= 0]
    counts = [int(((v >= a) & (v < a + width)).sum()) for a in range(0, cap, width)]
    return {"width": width, "cap": cap, "counts": counts, "overflow": int((v >= cap).sum()), "n": int(len(v))}


def build(ctx: C.Ctx) -> dict:
    ex, j, s = ctx.expected, ctx.jira, ctx.signed
    q1 = ex["q1"]
    observed = {k: {"n": q1[k]["n"], "median": q1[k]["median"], "mean": q1[k]["mean"]} for k in ("uc", "closed")}

    # 2. distribution of recorded days to UC (same population as the Explorer's Q1: every issue with a first UC date)
    hist = _bins(j.days_uc, HIST_BIN, HIST_CAP)
    top = int(np.argmax(hist["counts"]))
    d = j.days_uc.dropna()
    d = d[d >= 0]
    hist.update({
        "largest": {"from": top * HIST_BIN, "to": top * HIST_BIN + HIST_BIN - 1, "n": hist["counts"][top]},
        "within60": {"n": int((d < 60).sum()), "share": round(float((d < 60).mean()), 4)},   # bins 0-14 .. 45-59
        "median": observed["uc"]["median"], "mean": observed["uc"]["mean"],
    })

    # 3. journeys still running: signed-up clients in the searching / under-contract status groups (Explorer groups)
    lanes = {}
    for key, group, ref in (("searching", "Searching", observed["uc"]["median"]), ("under_contract", "Under contract", observed["closed"]["median"])):
        g = s[s.group == group]
        lanes[key] = {**_bins(g.elapsed, WAIT_BIN, WAIT_CAP), "ref": ref,
                      "past_ref": int((g.elapsed > ref).sum()), "within_ref": int((g.elapsed <= ref).sum()),
                      "statuses": {k: int(v) for k, v in g.status.value_counts().items()}}

    # 4. Kaplan-Meier, exactly as the Explorer: signed-up clients, event = recorded date, others counted to the snapshot
    def km(col, days_col):
        t = np.where(s[col].notna(), s[days_col], s.elapsed)
        return C.km_curve(t, s[col].notna().values)

    k_uc, k_cl = km("uc", "days_uc"), km("closed", "days_closed")
    first50 = lambda k: float(k[k.cum >= 0.5].t.iloc[0])
    estimate = {
        "uc": {"median": q1["km_uc_signed"], "curve": C.daily(k_uc, CURVE_DAYS), "check": first50(k_uc)},
        "closed": {"median": q1["km_closed_signed"], "curve": C.daily(k_cl, CURVE_DAYS), "check": first50(k_cl)},
        "n": int(len(s)),
        "recorded_curve": {"uc": C.daily(C.ecdf(j.days_uc), CURVE_DAYS), "closed": C.daily(C.ecdf(j.days_closed), CURVE_DAYS)},
    }
    return {
        "observed": observed, "hist": hist, "lanes": lanes, "estimate": estimate,
        "running": int(sum(l["n"] for l in lanes.values())),
        # for the methodology note only
        "closed_without_uc_date": int((s.closed.notna() & s.uc.isna()).sum()),
    }
