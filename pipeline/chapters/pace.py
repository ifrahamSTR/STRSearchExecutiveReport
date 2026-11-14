"""Chapter 3: are we keeping pace? Two views of the Explorer's monthly Q3 figures.

1. Jira intake: every new Jira issue by the month it was created (the Explorer's `new_all_created`), split by
   where each issue stands TODAY with the Explorer's onboarding-first funnel classes (signed client / still in
   pre-sale onboarding / Services Declined). Current status, not what happened in the month the issue opened.
2. Acquisition: signed clients by the month their acquisition clock started vs first Under Contract and first
   CLOSED events in the month they happened (the Explorer's Q3 table, unchanged), plus the Explorer's same-cohort
   view: the share of each start month's signed clients under contract within 90 days of starting.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import core as C

FROM_MONTH = "2025-01"
CHANGE_MONTH = "2026-06"   # first full month after the late-May changes (Complete offer, Confidence Call)
WINDOW = 5                 # full months compared on each side of the change (the change month itself is split)
COHORT_DAYS = 90           # the Explorer's same-cohort window (Q3 cohort chart)
COHORT_FROM = "2026-01"    # earlier start months carry many CLOSED dates without a recorded Under Contract date
MIN_CELL = 5


def funnel_class(j: pd.DataFrame) -> pd.Series:
    """The Explorer's onboarding-first funnel classes (Acquisition section): signed client if the current status is
    in the signed-up list, else Services Declined, else still in pre-sale onboarding (New Clients, Onboarding Completed)."""
    return pd.Series(np.select([j.carson_signed, j.status == "Services Declined"], ["signed", "declined"], "presale"), index=j.index)


def _month(s: pd.Series) -> pd.Series:
    return s.dt.to_period("M").astype(str)


def _share(k: int, n: int):
    return None if n < MIN_CELL or 0 < k < MIN_CELL else round(k / n, 4)


def build(ctx: C.Ctx) -> dict:
    j, s, asof = ctx.jira, ctx.signed, ctx.asof
    cur = asof.strftime("%Y-%m")
    partial = lambda m: m == cur and asof != pd.Period(cur, "M").end_time.normalize()  # noqa: E731
    change = pd.Timestamp(ctx.D.NEW_EXPERIENCE_DATE)

    # 2. the existing monthly acquisition view (Explorer Q3 table, unchanged)
    rows = [{"month": r["month"], "label": C.month_label(r["month"]), "new": r["new_signed_start"], "uc": r["uc"],
             "closed": r["closed"], "partial": partial(r["month"])}
            for r in ctx.expected["q3"] if r["month"] >= FROM_MONTH]

    # 1. Jira intake by month created, split by where each issue stands today
    cls, created_m = funnel_class(j), _month(j.created)
    tab = pd.crosstab(created_m, cls).reindex(columns=["signed", "presale", "declined"], fill_value=0)
    intake = [{"month": m, "label": C.month_label(m), **{k: int(tab.at[m, k]) if m in tab.index else 0 for k in tab.columns},
               "partial": partial(m)} for m in (r["month"] for r in rows)]
    for r in intake:
        r["total"] = r["signed"] + r["presale"] + r["declined"]
    since = cls[j.created >= change].value_counts()
    since_change = {"from": ctx.D.NEW_EXPERIENCE_DATE, "total": int(since.sum()), **{k: int(since.get(k, 0)) for k in ("signed", "presale", "declined")}}

    # five full months before and after the change (the change month is split, so it sits in neither)
    cm = pd.Period(CHANGE_MONTH, "M")
    last_full = (asof + pd.Timedelta(days=1)).to_period("M") - 1
    before = [str(cm - 2 - i) for i in reversed(range(WINDOW))]
    after = [str(cm + i) for i in range(WINDOW) if cm + i <= last_full]
    by_m, in_m = {r["month"]: r for r in rows}, {r["month"]: r for r in intake}

    def avg(src, months, key):
        return round(sum(src[m][key] for m in months) / len(months), 1)

    windows = {"before": before, "after": after,
               "intake": {"before": avg(in_m, before, "total"), "after": avg(in_m, after, "total")},
               "starts": {"before": avg(by_m, before, "new"), "after": avg(by_m, after, "new")},
               "uc": {"before": avg(by_m, before, "uc"), "after": avg(by_m, after, "uc")},
               "closed": {"before": avg(by_m, before, "closed"), "after": avg(by_m, after, "closed")}}

    # same-cohort view (the Explorer's Q3 cohort chart): of each start month's signed clients, the share under
    # contract within 90 days; only once every client in the month has had the full 90 days
    sm = _month(s.start)
    elapsed = (asof - s.start).dt.days
    uc90 = s.uc.notna() & (s.days_uc <= COHORT_DAYS)
    no_uc_date = s.closed.notna() & s.uc.isna()
    cohort = []
    for m in (r["month"] for r in rows if r["month"] >= COHORT_FROM):
        g = sm == m
        n = int(g.sum())
        mature = bool(n) and bool((elapsed[g] >= COHORT_DAYS).all())
        k = int(uc90[g].sum()) if mature else None
        share = _share(k, n) if mature else None
        cohort.append({"month": m, "n": n, "k": k if share is not None else None, "share": share, "mature": mature,
                       "closed_no_uc": int(no_uc_date[g].sum())})
    shown = [c for c in cohort if c["share"] is not None]
    pooled = lambda cs: round(sum(c["k"] for c in cs) / sum(c["n"] for c in cs), 4) if cs else None  # noqa: E731
    y25 = sm.str.startswith("2025")
    cohort_meta = {
        "days": COHORT_DAYS, "from": COHORT_FROM, "rows": cohort,
        # before = start months wholly before the change; the change month (May) is split and sits in neither
        "pooled_before": pooled([c for c in shown if c["month"] < ctx.D.NEW_EXPERIENCE_DATE[:7]]),
        "pooled_after": pooled([c for c in shown if c["month"] >= CHANGE_MONTH]),
        # why earlier start months are not shown: a CLOSED date without a recorded Under Contract date counts as no contract
        "no_uc_date": {"y2025": {"n": int(y25.sum()), "k": int(no_uc_date[y25].sum())},
                       "shown": {"n": sum(c["n"] for c in shown), "k": sum(c["closed_no_uc"] for c in shown)}},
        "presale_pending": {c["month"]: int(((_month(j.start) == c["month"]) & (cls == "presale")).sum()) for c in shown if c["month"] >= CHANGE_MONTH},
    }

    # service sales (Pipedrive Won, official filter, by won date) next to starts, for the method note only
    won = ctx.deals[ctx.deals.in_scope & (ctx.deals.status == "won")]
    won_m = _month(won.won_date).value_counts()
    sales = {w: {"won": int(sum(won_m.get(m, 0) for m in windows[w])), "starts": int(sum(by_m[m]["new"] for m in windows[w]))}
             for w in ("before", "after")}

    return {
        "monthly": rows, "change_month": CHANGE_MONTH, "change_date": ctx.D.NEW_EXPERIENCE_DATE,
        "intake": {"monthly": intake, "since_change": since_change,
                   "classes_all": {k: int((cls == k).sum()) for k in ("signed", "presale", "declined")},
                   "early_prospects": int(((cls != "signed") & (j.created < change)).sum())},
        "windows": windows, "cohort": cohort_meta, "sales": sales,
    }
