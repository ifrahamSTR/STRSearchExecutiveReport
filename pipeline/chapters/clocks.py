"""Chapter 1: one customer, two journeys (sales clock and acquisition clock)."""
from __future__ import annotations

import core as C


def build(ctx: C.Ctx) -> dict:
    ex = ctx.expected
    return {
        "median_days_to_win": ex["deals"]["median_days_to_win"],     # Pipedrive: deal created -> Won
        "won": ex["deals"]["won"],
        "signed": ex["jira"]["signed"],
        "confidence_call_since": ctx.D.NEW_EXPERIENCE_DATE,
        "start_rule": ctx.D.EFFECTIVE_START_RULE,
    }
