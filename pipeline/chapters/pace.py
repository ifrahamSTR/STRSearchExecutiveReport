"""Chapter 3: are we keeping pace? (16 Nov 2026 reporting version)

Starts are 'Client Started' events (won engagements with a confirmed Jira start, dated by client_start_date), Under
Contract events use the latest valid UC date, CLOSED events the closing date up to the data date
(daily_client_activity summed by month). From 1 Jun 2026 a start is the Pipedrive won date, so a month's starts do
not change after it ends; only the current, partial month is still filling. The 90-day strip uses the
client_cohort_performance rule (matured clients only).

Original 12 Nov description, for reference:

1. Jira intake: every new Jira issue by the month it was created (the Explorer's `new_all_created`), split by
   where each issue stands TODAY with the Explorer's onboarding-first funnel classes (signed client / still in
   pre-sale onboarding / Services Declined). Current status, not what happened in the month the issue opened.
2. Acquisition: signed clients by the month their acquisition clock started vs first Under Contract and first
   CLOSED events in the month they happened (the Explorer's Q3 table, unchanged), plus the Explorer's same-cohort
   view: the share of each start month's signed clients under contract within 90 days of starting.
   The monthly gap = that month's starts minus that month's first Under Contract events: two Explorer counts side by
   side, not a cohort (contracts often belong to earlier starters) and never summed into a backlog. A prospect who
   signs later joins the month their clock started, so a month's starts settle SETTLE_DAYS after it ends.
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
GAP_FROM = "2026-01"       # same reason: missing Under Contract dates make earlier gaps read high
SETTLE_DAYS = 0            # 16 Nov: starts are won dates from 1 Jun 2026 and never back-fill; only the partial month fills
MIN_CELL = 5


def funnel_class(j: pd.DataFrame) -> pd.Series:
    """The Explorer's onboarding-first funnel classes (Acquisition section): signed client if the current status is
    in the signed-up list, else Services Declined, else still in pre-sale onboarding (New Clients, Onboarding Completed)."""
    return pd.Series(np.select([j.signed, j.status == "Services Declined"], ["signed", "declined"], "presale"), index=j.index)


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
    rows = [{"month": r["month"], "label": C.month_label(r["month"]), "new": r["started"], "uc": r["uc"],
             "closed": r["closed"], "partial": partial(r["month"]), "won": r["won"],
             "replacement_rate": r["replacement_rate"], "cumulative": r["cumulative_net_change"]}
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

    # monthly gap: starts minus first Under Contract events in the same month
    for r in rows:
        r["gap"] = r["new"] - r["uc"]
        r["filling"] = bool(r["partial"])

    windows = {"before": before, "after": after,
               "intake": {"before": avg(in_m, before, "total"), "after": avg(in_m, after, "total")},
               "starts": {"before": avg(by_m, before, "new"), "after": avg(by_m, after, "new")},
               "uc": {"before": avg(by_m, before, "uc"), "after": avg(by_m, after, "uc")},
               "closed": {"before": avg(by_m, before, "closed"), "after": avg(by_m, after, "closed")},
               "gap": {"before": avg(by_m, before, "gap"), "after": avg(by_m, after, "gap")}}

    # the gap since the change: its peak (settled months only), then each full month after the last peak month
    full_after = [r for r in rows if r["month"] >= CHANGE_MONTH and not r["partial"]]
    settled = [r for r in full_after if not r["filling"]]
    peak = max(r["gap"] for r in settled)
    peak_months = [r["month"] for r in settled if r["gap"] == peak]
    tail = [r for r in full_after if r["month"] > peak_months[-1]]
    seq = [peak] + [r["gap"] for r in tail]
    co = ctx.cohort
    since_rule = co[co.start_rule == "won"]
    late = int((since_rule.start != since_rule.won_date).sum())        # by the rule this is 0: start = won date
    gap = {"from": GAP_FROM, "settle_days": SETTLE_DAYS, "peak": peak, "peak_months": peak_months,
           "tail": [{"month": r["month"], "gap": r["gap"], "filling": r["filling"]} for r in tail],
           "narrowing": bool(tail) and all(b < a for a, b in zip(seq, seq[1:])),
           "start_is_won_date": {"n": int(len(since_rule)), "differ": late},
           "late_signers": {"n": int(len(since_rule)), "k": 0, "share": 0.0}}

    # same-cohort view: client_cohort_performance, share of each start month's confirmed starts under contract within
    # 90 days (uc_within_90d x eligible_90d); shown once every client in the month is eligible
    co = ctx.cohort
    sm = _month(co.start)
    no_uc_date = co.closed.notna() & co.uc.isna()
    cohort = []
    for m in (r["month"] for r in rows if r["month"] >= COHORT_FROM):
        g = sm == m
        n = int(g.sum())
        el = int(co.eligible_90d[g].sum())
        mature = bool(n) and el == n
        k = int((co.uc_within_90d[g] * co.eligible_90d[g]).sum()) if mature else None
        share = _share(k, n) if mature else None
        cohort.append({"month": m, "n": n, "k": k if share is not None else None, "share": share, "mature": mature,
                       "eligible": el, "closed_no_uc": int(no_uc_date[g].sum())})
    shown = [c for c in cohort if c["share"] is not None]
    pooled = lambda cs: round(sum(c["k"] for c in cs) / sum(c["n"] for c in cs), 4) if cs else None  # noqa: E731
    y25 = sm.str.startswith("2025")
    cohort_meta = {
        "days": COHORT_DAYS, "from": COHORT_FROM, "rows": cohort, "rule": "SUM(uc_within_90d * eligible_90d) / SUM(eligible_90d)",
        "pooled_before": pooled([c for c in shown if c["month"] < ctx.D.NEW_EXPERIENCE_DATE[:7]]),
        "pooled_after": pooled([c for c in shown if c["month"] >= CHANGE_MONTH]),
        "no_uc_date": {"y2025": {"n": int(y25.sum()), "k": int(no_uc_date[y25].sum())},
                       "shown": {"n": sum(c["n"] for c in shown), "k": sum(c["closed_no_uc"] for c in shown)}},
        "presale_pending": {},
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
        "windows": windows, "gap": gap, "cohort": cohort_meta, "sales": sales,
    }
