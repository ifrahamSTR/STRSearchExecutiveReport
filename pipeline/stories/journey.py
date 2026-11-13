"""The client journey: the sales clock (Pipedrive) and the acquisition clock (Jira), and how they line up."""
from __future__ import annotations

import pandas as pd

import core as C


def build(ctx: C.Ctx) -> dict:
    sc, won, s = ctx.deals[ctx.deals.in_scope], ctx.won, ctx.signed
    dtw = won.days_to_win.dropna()
    change = pd.Timestamp(C.PROCESS_CHANGE)

    # ---- how the two clocks line up: acquisition start relative to the sale
    linked = s[s.pd_won_date.notna()].copy()
    linked["gap"] = (linked.start - linked.pd_won_date).dt.days

    def align(g):
        return {"n": int(len(g)), "median": C.r(g.gap.median(), 1), "p25": C.r(g.gap.quantile(0.25), 1),
                "p75": C.r(g.gap.quantile(0.75), 1), "starts_before_sale": C.r((g.gap < 0).mean())}

    since_s = s[s.start >= change]
    # ---- prospects in Jira since the process change
    new = ctx.jira[ctx.jira.created >= change]
    undecided = new.status.isin(["New Clients", "Onboarding Completed"])

    won_m = won.assign(m=won.won_date.dt.to_period("M").astype(str))
    post_first = C.POST_CHANGE_FIRST_MONTH
    last_complete = (ctx.asof.to_period("M") - 1).strftime("%Y-%m")
    post = won_m[(won_m.m >= post_first) & (won_m.m <= last_complete)]
    n_post = post.m.nunique()
    pre_months = [str(p) for p in pd.period_range(end=pd.Period(post_first, "M") - 1, periods=n_post, freq="M")]
    pre = won_m[won_m.m.isin(pre_months)]

    def sales_period(g, months):
        return {"months": months, "won": int(len(g)), "won_avg": C.r(len(g) / months, 1), "value": C.r(g.value.sum(), 0),
                "avg_value": C.r(g.value.mean(), 0), "complete_share": C.r((g["product"] == "Complete").mean())}

    return {
        "sales": {
            "deals": int(len(sc)), "won": int(len(won)), "first_month": sc.created.min().strftime("%Y-%m"),
            "days_to_win": {"median": C.r(dtw.median(), 1), "p25": C.r(dtw.quantile(0.25), 1), "p75": C.r(dtw.quantile(0.75), 1)},
            "won_value": C.r(won.value.sum(), 0),
            "pre": sales_period(pre, len(pre_months)), "post": sales_period(post, n_post),
        },
        "acquisition": {"signed": int(len(s)), "uc_logged": int(s.uc_logged.sum()), "closed_logged": int(s.cl_evt.sum()),
                        "first_month": s.start.min().strftime("%Y-%m")},
        "alignment": {"before": align(linked[linked.start < change]), "since": align(linked[linked.start >= change]),
                      "since_nce": align(linked[(linked.start >= change) & (linked.pd_experience == "New Client Experience")]),
                      "since_other": align(linked[(linked.start >= change) & (linked.pd_experience != "New Client Experience")])},
        "start_date_source": {
            "no_due_date": int(s.due.isna().sum()), "signed": int(len(s)),
            "since_change_no_due_date": int(since_s.due.isna().sum()), "since_change": int(len(since_s)),
        },
        "prospects": {"since": C.PROCESS_CHANGE, "entered": int(len(new)), "became_clients": int(new.carson_signed.sum()),
                      "declined": int((new.status == "Services Declined").sum()), "undecided": int(undecided.sum())},
    }
