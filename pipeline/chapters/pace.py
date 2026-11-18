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


# ----------------------------------------------------------------------------- 3.2 table: month-on-month and year-on-year growth
GROWTH_FROM = "2025-01"
UC_GAP = ("2025-06", "2025-11")   # contract months behind the Aug-Dec 2025 closings that have no Under Contract date (checked in build.py)
GAP_CLOSINGS = ("2025-08", "2025-12")
RULE_MONTH = "2026-06"            # first month of the 1 Jun 2026 start rule (definitions.START_RULE_DATE; checked in build.py)
REASONS = {
    "early": "2024 Jira records are incomplete: {early_k} of {early_n} deals won in 2024 have a Jira issue (2025: {y25_k} of {y25_n}), so 2024 starts and contracts are undercounted.",
    "rule": "The start date rule changed on 1 Jun 2026: from June a start is the won date, before it the kickoff date (a median {lag} days later), so starts from June are not counted the same way as earlier months.",
    "ucgap": "{gap_k} of the {gap_n} clients who closed from August to December 2025 have no Under Contract date, so the contract counts for June to November 2025 are too low.",
    "zero": "No events in the comparison period.",
}


def _comparable(metric: str, cur: str, base: str) -> str | None:
    """Reason a growth figure is not shown, or None when the two periods count the same way."""
    if metric == "won":
        return None                                              # Pipedrive won date: one definition throughout
    if base < GROWTH_FROM:
        return "early"
    if metric == "starts":
        if (cur >= RULE_MONTH) != (base >= RULE_MONTH):
            return "rule"
    if metric == "uc" and (UC_GAP[0] <= cur <= UC_GAP[1] or UC_GAP[0] <= base <= UC_GAP[1]):
        return "ucgap"
    return None


def growth(ctx: C.Ctx) -> dict:
    """Monthly Won, Starts and Under Contract (daily_client_activity, as the chart above it) with month-on-month and
    year-on-year growth where both periods count the same way. The current, partial month is compared with the same
    days of the previous month and of the same month a year earlier."""
    asof, daily = ctx.asof, ctx.f.daily
    cur_m = asof.strftime("%Y-%m")
    last_day = int(asof.day)
    partial = asof != pd.Period(cur_m, "M").end_time.normalize()
    cols = {"won": "clients_won", "starts": "clients_started", "uc": "clients_went_uc"}
    dm = daily.assign(m=daily.activity_date.dt.strftime("%Y-%m"), d=daily.activity_date.dt.day)

    def count(metric, month, upto=None):
        g = dm[dm.m == month]
        if upto is not None:
            g = g[g.d <= upto]
        return int(g[cols[metric]].sum())

    months = [r["month"] for r in ctx.expected["q3"] if r["month"] >= GROWTH_FROM]
    rows = []
    for m in months:
        p = pd.Period(m, "M")
        upto = last_day if (m == cur_m and partial) else None
        r = {"month": m, "label": C.month_label(m), "partial": upto is not None, "days": upto}
        for k in cols:
            v = count(k, m, upto)
            r[k] = v
            for kind, base_m in (("mom", str(p - 1)), ("yoy", str(p - 12))):
                b = count(k, base_m, upto)
                why = _comparable(k, m, base_m) or (None if b else "zero")
                r[f"{k}_{kind}"] = {"base": b, "base_month": base_m, "pct": None if why else round(v / b - 1, 4), "why": why}
        r["diff"] = r["starts"] - r["uc"]
        rows.append(r)
    # evidence behind the reasons (the build checks these still hold)
    e = ctx.f.eng
    won24 = e[e.won_date.dt.year == 2024]
    won25 = e[e.won_date.dt.year == 2025]
    clo = e[e.closed.notna()].assign(cm=lambda x: x.closed.dt.strftime("%Y-%m"))
    gap = clo[(clo.cm >= GAP_CLOSINGS[0]) & (clo.cm <= GAP_CLOSINGS[1])]
    rest25 = clo[(clo.cm >= "2025-01") & (clo.cm < GAP_CLOSINGS[0])]
    c26 = clo[clo.cm >= "2026-01"]
    pre = ctx.cohort[ctx.cohort.start_rule.isin(["due", "created+4"])]
    ev = {"early_n": int(len(won24)), "early_k": int(won24.has_jira.sum()), "y25_n": int(len(won25)), "y25_k": int(won25.has_jira.sum()),
          "gap_n": int(len(gap)), "gap_k": int(gap.uc.isna().sum()),
          "rest25_n": int(len(rest25)), "rest25_k": int(rest25.uc.isna().sum()),
          "y26_n": int(len(c26)), "y26_k": int(c26.uc.isna().sum()),
          "lag": float((pre.start - pre.won_date).dt.days.median())}
    lag = int(ev["lag"]) if float(ev["lag"]).is_integer() else ev["lag"]
    reasons = {k: v.format(**{**ev, "lag": lag}) for k, v in REASONS.items()}
    return {"from": GROWTH_FROM, "rows": rows, "uc_gap": list(UC_GAP), "rule_month": RULE_MONTH, "evidence": ev, "reasons": reasons,
            "partial": {"month": cur_m if partial else None, "days": last_day if partial else None},
            "hunting": int(ctx.jira.hunting.sum())}


# ----------------------------------------------------------------------------- 3.3 cohorts: under contract within 14 / 30 / 60 / 90 days
WINDOWS = [14, 30, 60, 90]
COHORTS_FROM = "2025-01"
COMPARE_FROM = "2026-01"     # 2025 cohorts lack many Under Contract dates (see uc_gap)


def cohorts(ctx: C.Ctx) -> dict:
    """client_cohort_performance by start month (the Explorer's matured-cohort rule): share of confirmed starts under
    contract within N days = SUM(uc_within_Nd x eligible_Nd) / SUM(eligible_Nd). A window is maturing while some of the
    month's clients have had fewer than N days. Two clocks: the reporting layer's client start date, and the Pipedrive won
    date (one definition for every month). Counts are published with their denominators, as in the Explorer's own cohort
    table; cells resting on fewer than 5 clients are marked small."""
    co, asof = ctx.cohort, ctx.asof
    sm = co.start.dt.strftime("%Y-%m")
    clocks = {
        "start": {"days": co.days_to_uc, "elapsed": co.days_since_start},
        "won": {"days": (co.uc - co.won_date).dt.days, "elapsed": (asof - co.won_date).dt.days},
    }
    cur_m = asof.strftime("%Y-%m")
    out = {"windows": WINDOWS, "from": COHORTS_FROM, "compare_from": COMPARE_FROM, "change_month": CHANGE_MONTH, "clocks": {}}
    months = sorted(m for m in sm.unique() if m >= COHORTS_FROM)
    for name, ck in clocks.items():
        d, el = ck["days"], ck["elapsed"]
        rows = []
        for m in months:
            g = sm == m
            n = int(g.sum())
            r = {"month": m, "label": C.month_label(m), "n": n, "partial": m == cur_m,
                 "uc_dates_incomplete": m < COMPARE_FROM, "closed_no_uc": int((co.closed.notna() & co.uc.isna())[g].sum())}
            for w in WINDOWS:
                eli = g & (el >= w)
                k = int((eli & (d >= 0) & (d <= w)).sum())
                r[f"w{w}"] = {"k": k, "eligible": int(eli.sum()), "mature": bool(n) and int(eli.sum()) == n, "small": 0 < k < 5 or int(eli.sum()) < 5}
            reached = int((g & co.uc.notna() & (d >= 0)).sum())
            r["to_date"] = {"k": reached, "n": n, "small": 0 < reached < 5 or n < 5}
            rows.append(r)

        def pool(lo, hi, w):
            cs = [r for r in rows if lo <= r["month"] <= hi and r[f"w{w}"]["mature"]]
            k, n = sum(r[f"w{w}"]["k"] for r in cs), sum(r[f"w{w}"]["eligible"] for r in cs)
            return {"k": k, "n": n, "share": round(k / n, 4) if n else None, "small": 0 < k < 5,
                    "months": [cs[0]["month"], cs[-1]["month"]] if cs else None}
        before_hi = str(pd.Period(CHANGE_MONTH, "M") - 1)
        out["clocks"][name] = {"rows": rows, "pooled": {f"w{w}": {"before": pool(COMPARE_FROM, before_hi, w), "after": pool(CHANGE_MONTH, "9999-12", w)} for w in WINDOWS}}
    pre = co[co.start_rule.isin(["due", "created+4"])]
    out["kickoff_lag_median"] = float((pre.start - pre.won_date).dt.days.median())
    out["refunded_included"] = int(co.refunded.fillna(False).astype(bool).sum())
    return out


# ----------------------------------------------------------------------------- 3.1 (added 18 Nov 2026): the 100-a-month goal
GOAL_PER_MONTH = 100            # completed property purchases a month: the company goal
GOAL_FROM = "2026-04-01"        # April 2026 to the data date
DAYS_PER_MONTH = 365.25 / 12    # so the weekly benchmark = 100 x 7 / 30.44 = 23.0 per seven calendar days
SERIES = {"sales": "clients_won", "uc": "clients_went_uc", "closed": "properties_closed"}
CONV_WON = ("2025-01-01", "2026-03-31")   # sales with 7+ months of follow-up: their recorded sale -> closing share
CONV_UC_DAYS = 120                         # contracts at least this old: their recorded contract -> closing share


def goal(ctx: C.Ctx) -> dict:
    """Sales (Pipedrive won date), Under Contract (latest valid contract date) and Closed (completed closing date, up to the
    data date) from daily_client_activity, by calendar month and by Sunday-Saturday reporting week, from April 2026 to the
    data date. A period is partial when the data cover fewer of its days; every rate is events per seven calendar days covered."""
    asof, d = ctx.asof, ctx.f.daily
    bench = round(GOAL_PER_MONTH * 7 / DAYS_PER_MONTH, 2)
    lo = pd.Timestamp(GOAL_FROM)
    wk0 = lo - pd.Timedelta(days=(lo.dayofweek + 1) % 7)                     # the Sunday on or before 1 April
    d = d[(d.activity_date >= wk0) & (d.activity_date <= asof)].copy()

    def row(g, **kw):
        days = int(g.activity_date.nunique())
        r = dict(kw, days=days, first=g.activity_date.min().strftime("%Y-%m-%d"), last=g.activity_date.max().strftime("%Y-%m-%d"))
        for k, c in SERIES.items():
            r[k] = int(g[c].sum())
            r[f"{k}_per7"] = round(r[k] * 7 / days, 2)
        return r

    months = []
    for m in pd.period_range(GOAL_FROM[:7], asof.strftime("%Y-%m"), freq="M"):
        g = d[d.activity_date.dt.to_period("M") == m]
        months.append(row(g, month=str(m), label=C.month_label(m), full_days=int(m.days_in_month), partial=int(g.activity_date.nunique()) < m.days_in_month))
    for r in months:
        r["goal_share"] = round(r["closed"] / GOAL_PER_MONTH, 4)                     # full months: closings / 100
        r["pace_share"] = round(r["closed_per7"] / bench, 4)                         # any period: closings per 7 days / 23.0
    weeks = []
    for w, g in d.groupby(d.activity_date - pd.to_timedelta((d.activity_date.dt.dayofweek + 1) % 7, unit="D")):
        weeks.append(row(g, week=w.strftime("%Y-%m-%d"), end=(w + pd.Timedelta(days=6)).strftime("%Y-%m-%d")))
    for r in weeks:
        r["partial"] = r["days"] < 7
    full_m = [r for r in months if not r["partial"]]
    full_w = [r for r in weeks if not r["partial"]]

    def best(rows, k, key):
        b = max(rows, key=lambda r: r[k])
        return {"at": b[key], "n": b[k], "per7": b[f"{k}_per7"]}

    def per7(rows, k):
        days = sum(r["days"] for r in rows)
        return round(sum(r[k] for r in rows) * 7 / days, 2) if days else None

    windows = {"before": ["2026-04", "2026-05"], "surge": ["2026-06", "2026-07", "2026-08", "2026-09"]}
    win = {name: {k: per7([r for r in months if r["month"] in ms], k) for k in SERIES} for name, ms in windows.items()}
    last4 = full_w[-4:]
    # what the goal implies upstream, at the recorded conversion of earlier clients (engagement grain, as the daily counts)
    e = ctx.f.eng
    w = e[(e.won_date >= CONV_WON[0]) & (e.won_date <= CONV_WON[1])]
    u = e[e.uc.notna() & (e.uc >= "2025-06-01") & ((asof - e.uc).dt.days >= CONV_UC_DAYS)]
    won_close = round(float(w.closed.notna().mean()), 4)
    uc_close = round(float(u.closed.notna().mean()), 4)
    y26 = e[(e.won_date >= "2026-01-01")]
    lag = {"sale_to_uc": float((y26.uc - y26.won_date).dt.days.dropna().median()), "sale_to_close": float((y26.closed - y26.won_date).dt.days.dropna().median())}
    # where the record closing month's purchases were sold
    best_close = best(full_m, "closed", "month")
    bc = e[e.closed.notna() & (e.closed.dt.strftime("%Y-%m") == best_close["at"])]
    sold = bc.won_date.dt.strftime("%Y-%m").value_counts()
    # the same days a year earlier (seasonality of the current, partial month)
    cur = months[-1]
    prev_year = []
    if cur["partial"]:
        p = pd.Period(cur["month"], "M") - 12
        dy = ctx.f.daily
        for mm, upto in ((p - 1, None), (p, cur["days"]), (p + 1, None)):
            g = dy[dy.activity_date.dt.to_period("M") == mm]
            if upto:
                g = g[g.activity_date.dt.day <= upto]
            prev_year.append(row(g, month=str(mm), label=C.month_label(mm), partial=upto is not None))
    return {
        "goal_per_month": GOAL_PER_MONTH, "benchmark_per7": bench, "from": GOAL_FROM, "asof": asof.strftime("%Y-%m-%d"),
        "months": months, "weeks": weeks,
        "best": {k: {"month": best(full_m, k, "month"), "week": best(full_w, k, "week")} for k in SERIES},
        "weeks_at_benchmark": {k: sum(1 for r in full_w if r[k] >= bench) for k in SERIES}, "full_weeks": len(full_w),
        "windows": {"months": windows, "per7": win},
        "last4": {"from": last4[0]["week"], "to": last4[-1]["end"], **{k: sum(r[k] for r in last4) for k in SERIES}, **{f"{k}_per7": per7(last4, k) for k in SERIES}},
        "conversion": {"won_from": CONV_WON[0], "won_to": CONV_WON[1], "won_n": int(len(w)), "won_closed": int(w.closed.notna().sum()), "won_close": won_close,
                       "uc_days": CONV_UC_DAYS, "uc_n": int(len(u)), "uc_closed": int(u.closed.notna().sum()), "uc_close": uc_close,
                       "sales_needed": round(GOAL_PER_MONTH / won_close), "uc_needed": round(GOAL_PER_MONTH / uc_close)},
        "lag": lag,
        "best_close_sold": {"month": best_close["at"], "n": best_close["n"], "by_sale_month": {k: int(v) for k, v in sold.sort_index().items()}},
        "prev_year": prev_year,
        "totals": {k: sum(r[k] for r in months) for k in SERIES},
    }


# ----------------------------------------------------------------------------- 3.4 (added 18 Nov 2026): the first 14 days
FIRST_FROM = "2025-01"          # 2025 rows are context only: many 2025 contracts lack a UC date (COMPARE_FROM)


def first14(ctx: C.Ctx) -> dict:
    """Of each start month's confirmed starts with 14 days on the clock: under contract within 14 days (the cohort rule above)
    and refunded within 14 days (refund date - client start date). Both counted on the same eligible clients."""
    co, asof = ctx.cohort, ctx.asof
    sm = co.start.dt.strftime("%Y-%m")
    el = co.days_since_start
    d_uc = co.days_to_uc.where(co.uc.notna())
    rf = co.refunded.fillna(False).astype(bool)
    d_rf = (co.refund_date - co.start).dt.days.where(rf)
    rows = []
    for m in sorted(x for x in sm.dropna().unique() if x >= FIRST_FROM):
        g = sm == m
        r = {"month": m, "label": C.month_label(m), "n": int(g.sum())}
        for w in (14, 30):
            e = g & (el >= w)
            r[f"el{w}"] = int(e.sum())
            r[f"uc{w}"] = int((e & d_uc.between(0, w)).sum())
            r[f"rf{w}"] = int((e & d_rf.between(0, w)).sum())
        r["mature"] = r["el14"] == r["n"] and r["n"] > 0
        r["uc_dates_incomplete"] = m < COMPARE_FROM
        rows.append(r)

    def pool(ms):
        cs = [r for r in rows if r["month"] in ms]
        return {k: sum(r[k] for r in cs) for k in ("n", "el14", "uc14", "rf14", "el30", "uc30", "rf30")} | {"months": [cs[0]["month"], cs[-1]["month"]] if cs else None}
    before = [r["month"] for r in rows if COMPARE_FROM <= r["month"] < CHANGE_MONTH]
    after = [r["month"] for r in rows if r["month"] >= CHANGE_MONTH and r["el14"]]
    y25 = [r for r in rows if r["month"] < COMPARE_FROM and r["el30"]]
    late25 = [r for r in y25 if r["month"] >= "2025-10"]
    rest25 = [r for r in y25 if r["month"] < "2025-10"]
    oct25 = next((r for r in y25 if r["month"] == "2025-10"), None)
    year_end = {"oct25": {"k": oct25["rf30"], "n": oct25["el30"]} if oct25 else None,
                "rest25_max": max((round(r["rf30"] / r["el30"], 4) for r in rest25 if r["month"] != "2025-10"), default=None),
                "rest25": {"k": sum(r["rf30"] for r in rest25), "n": sum(r["el30"] for r in rest25)}, "late25": {"k": sum(r["rf30"] for r in late25), "n": sum(r["el30"] for r in late25)}}
    return {"from": FIRST_FROM, "compare_from": COMPARE_FROM, "rows": rows, "before": pool(before), "since_change": pool(after), "year_end_2025": year_end,
            "refund_rule": "refund date - client start date, refunded clients only"}


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
        "growth": growth(ctx), "cohorts": cohorts(ctx),
        "goal": goal(ctx), "first14": first14(ctx),
    }
