"""Lower-budget vs higher-budget clients (added for the L10, 18 Nov 2026): the Business Data Explorer's budget findings, brought
into the chapters where they answer a business question (2.4 where they stand, 3.3-3.4 monthly cohorts and the first 14 days,
4.3 time to contract, 5.3 like-for-like).

One calculation for both sites: this module runs the Explorer's own enrichment (pipeline/enrich.py) and budget reference
(pipeline/budget.py) on the already-loaded foundation, so every group count, window share and like-for-like difference equals
the Explorer's #budget view (build.py checks this against the published Explorer data file).

Budget = the onboarding form's "Total out-of-pocket capital available (all-in)" range (column M, live since 20 Apr 2026),
read at its upper end. Up to $250K = upper end <= $250K; Above $250K = the rest; Not recorded = no matched form answer.
Population: won engagements with a confirmed Jira start (client_cohort_performance), one row per search. A window share counts
only clients who have had the whole window (eligible)."""
from __future__ import annotations

import sys

import numpy as np
import pandas as pd

import core as C

GROUPS = ["Up to $250K", "Above $250K", "Not recorded"]
KEEP = ["n", "uc14", "uc30", "uc45", "uc60", "uc90", "cl60", "cl90", "cl120", "rf14", "rf30", "rf60", "rf90", "recorded", "uc_to_close",
        "scenario", "km_uc", "km_closed", "stages", "closed", "hunting", "hunting_wait"]
MONTH_WINDOWS = [14, 30, 60, 90]


def _explorer(ctx: C.Ctx):
    pipe = ctx.explorer / "pipeline"
    if str(pipe) not in sys.path:
        sys.path.append(str(pipe))
    E = sys.modules.get("explorer_enrich") or C._load_module("explorer_enrich", pipe / "enrich.py")
    B = sys.modules.get("explorer_budget") or C._load_module("explorer_budget", pipe / "budget.py")
    return E, B


def _mh(x: dict) -> dict:
    return {k: x[k] for k in ("w", "strata", "diff", "lo", "hi", "a", "b", "thin")}


def build(ctx: C.Ctx) -> dict:
    E, B = _explorer(ctx)
    enr = E.build(ctx.f)
    ref = B.build(ctx.f, enr)
    df = B.frame(ctx.f, enr)
    df["grp"] = df.budget_cmp.fillna("Not recorded")
    df["sm"] = df.start.dt.strftime("%Y-%m")
    asof = ctx.asof
    groups = [{k: g[k] for k in ["label"] + KEEP} for g in ref["groups"]["cmp"]]
    strict = [{k: g[k] for k in ("label", "n", "uc14", "uc30", "rf30", "recorded", "stages")} for g in ref["groups"]["strict"]]
    mh = {k: [_mh(x) for x in v] for k, v in ref["mh"]["cmp"].items() if k in ("uc", "closed", "refunded")}
    mh_strict = {k: [_mh(x) for x in v] for k, v in ref["mh"]["strict"].items() if k in ("uc", "refunded")}

    # per start month x group (matched months): under contract and refunded within each window, on the same eligible clients
    m = df[df.budget_cmp.notna()]
    months = []
    for sm in sorted(m.sm.unique()):
        row = {"month": sm, "label": C.month_label(sm)}
        for lab in GROUPS[:2]:
            g = m[(m.sm == sm) & (m.grp == lab)]
            c = {"n": int(len(g))}
            for w in MONTH_WINDOWS:
                el = g.elapsed >= w
                c[f"w{w}"] = {"k": int((el & g.d_uc.between(0, w)).sum()), "eligible": int(el.sum()), "mature": bool(len(g)) and int(el.sum()) == len(g)}
            for w in (14, 30):
                el = g.elapsed >= w
                c[f"rf{w}"] = {"k": int((el & g.d_rf.between(0, w)).sum()), "eligible": int(el.sum())}
            row[lab] = c
        months.append(row)

    # refunds within 30 days and contracts within 14 days by client experience (where the early-refund gap sits)
    exp = []
    for ex in ("New Client Experience", "Legacy"):
        for lab in GROUPS[:2]:
            g = m[(m.experience == ex) & (m.grp == lab)]
            e30, e14 = g.elapsed >= 30, g.elapsed >= 14
            exp.append({"experience": ex, "group": lab, "n": int(len(g)),
                        "rf30": {"k": int((e30 & g.d_rf.between(0, 30)).sum()), "eligible": int(e30.sum())},
                        "uc14": {"k": int((e14 & g.d_uc.between(0, 14)).sum()), "eligible": int(e14.sum())},
                        "uc30": {"k": int((e30 & g.d_uc.between(0, 30)).sum()), "eligible": int(e30.sum())}})

    # does the stated budget match what clients spend? (completed purchases, Jira purchase price and total out-of-pocket)
    jj = ctx.f.jira.set_index("key")
    df["price"] = df.jira_key.map(jj.purchase_price)
    df["oop"] = df.jira_key.map(jj.oop)
    rf = df.refunded.fillna(False).astype(bool)
    profile = []
    for lab in GROUPS:
        g = df[df.grp == lab]
        bought = g[g.closed.notna()]
        uc = g[g.uc.notna() & ((asof - g.uc).dt.days >= 90)]
        u2c = (uc.closed - uc.uc).dt.days
        r = g[rf.loc[g.index]]
        off = g.offers.value_counts()
        profile.append({
            "label": lab, "n": int(len(g)),
            "price": {"n": int(bought.price.notna().sum()), "median": float(bought.price.median()) if bought.price.notna().any() else None},
            "oop": {"n": int(bought.oop.notna().sum()), "median": float(bought.oop.median()) if bought.oop.notna().any() else None},
            "fee": {"median": float(g.value.median()), "mean": round(float(g.value.mean()), 0)},
            "complete_share": round(float((g["product"] == "Complete").mean()), 4),
            "split_share": round(float((g.payment == "Split Pay").mean()), 4),
            "uc_close90": {"k": int(u2c.between(0, 90).sum()), "eligible": int(len(uc))},
            "refund": {"n": int(len(r)), "median_days": float(r.d_rf.median()) if len(r) else None, "within14": int(r.d_rf.between(0, 14).sum())},
            "offers": {k: int(off.get(k, 0)) for k in ("No offers before", "1–2 offers before", "3+ offers before")},
            "experience": {k: int(v) for k, v in g.experience.fillna("Not tagged").value_counts().items()},
        })
    return {
        "field": E.BUDGET_FIELD, "measures": E.BUDGET_MEASURES, "threshold": E.BUDGET_THRESHOLD, "form_since": "2026-04-20",
        "population": ref["population"], "n": ref["n"], "groups": groups, "strict": strict, "mh": mh, "mh_strict": mh_strict,
        "thin": B.THIN, "coverage": ref["coverage"], "months": months, "experience": exp, "profile": profile,
        "explorer_view": "#budget",
    }
