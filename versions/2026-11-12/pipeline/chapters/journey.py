"""Chapter 1: the client journey. Two finish lines (Pipedrive Won = buys STRSearch, Jira CLOSED = buys a
property) and the two routes: sales first (before 27 May 2026) and the New Client Experience, where prospects
enter Jira and meet Acquisitions in the Confidence Call before they buy."""
from __future__ import annotations

import pandas as pd

import core as C

PRESALE = ["New Clients", "Onboarding Completed", "Services Declined"]     # Explorer: pre-sale Jira statuses
NCE = "New Client Experience"


def build(ctx: C.Ctx) -> dict:
    ex, j, s, D = ctx.expected, ctx.jira, ctx.signed, ctx.D
    change = pd.Timestamp(D.NEW_EXPERIENCE_DATE)
    pre = j[~j.carson_signed]
    # where the acquisition clock starts relative to the sale: client start minus Pipedrive won date (days)
    linked = s[s.pd_won_date.notna()].copy()
    linked["gap"] = (linked.start - linked.pd_won_date).dt.days

    def med(g):
        return {"n": int(len(g)), "median": float(g.gap.median())}

    return {
        "median_days_to_win": ex["deals"]["median_days_to_win"], "won": ex["deals"]["won"],
        "signed": ex["jira"]["signed"],
        "presale": {"statuses": {st: int((pre.status == st).sum()) for st in PRESALE}, "total": int(len(pre))},
        "start_vs_won": {
            "classic": med(linked[linked.start < change]),
            "nce": med(linked[(linked.start >= change) & (linked.pd_experience == NCE)]),
            "other_since": med(linked[(linked.start >= change) & (linked.pd_experience != NCE)]),
        },
        "new_experience_date": D.NEW_EXPERIENCE_DATE, "start_rule": D.EFFECTIVE_START_RULE,
    }
