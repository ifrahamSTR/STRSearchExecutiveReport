"""Chapter 1: the client journey (16 Nov 2026 reporting version). Two finish lines (Pipedrive Won = buys STRSearch,
Jira CLOSED = buys a property) and two routes: sales first (before 27 May 2026) and the New Client Experience, where
prospects enter Jira and meet Acquisitions before they buy. The acquisition clock is client_start_date: the due date
for issues created before 1 Jun 2026 (a kickoff after the sale), the Pipedrive won date from 1 Jun 2026."""
from __future__ import annotations

import pandas as pd

import core as C

PRESALE = ["New Clients", "Onboarding Completed", "Services Declined"]
NCE = "New Client Experience"


def build(ctx: C.Ctx) -> dict:
    ex, j, s, D = ctx.expected, ctx.jira, ctx.signed, ctx.D
    change, rule = pd.Timestamp(D.NEW_EXPERIENCE_DATE), pd.Timestamp(D.START_RULE_DATE)
    pre = j[~j.signed]
    linked = s[s.pd_won_date.notna() & s.start.notna()].copy()
    linked["gap"] = (linked.start - linked.pd_won_date).dt.days

    def med(g):
        return {"n": int(len(g)), "median": float(g.gap.median()) if len(g) else None}

    rules = s.start_rule.value_counts()
    return {
        "median_days_to_win": ex["deals"]["median_days_to_win"], "won": ex["deals"]["won_all"],
        "signed": ex["jira"]["signed"], "hunting": ex["jira"]["hunting"],
        "presale": {"statuses": {st: int((pre.status == st).sum()) for st in PRESALE}, "total": int(len(pre))},
        "start_vs_won": {
            "classic": med(linked[linked.created < change]),
            "nce_before_rule": med(linked[(linked.created >= change) & (linked.created < rule)]),
            "from_rule": med(linked[linked.created >= rule]),
        },
        "start_rules": {k: int(rules.get(k, 0)) for k in ("due", "created+4", "won")},
        "signed_no_start": int(s.start.isna().sum()),
        "new_experience_date": D.NEW_EXPERIENCE_DATE, "start_rule_date": D.START_RULE_DATE, "start_rule": D.START_RULE_TEXT,
        "engagements": ex["engagements"],
    }
