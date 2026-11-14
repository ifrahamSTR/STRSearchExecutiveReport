"""Chapter 3: how many clients reach their destination? (Explorer status groups and Q2 attainment)"""
from __future__ import annotations

import core as C

ACTIVE_GROUPS = ["Searching", "Under contract", "Closed", "Post-close"]
INACTIVE_STATUSES = ["Paused", "Refunded", "Additional Service"]


def build(ctx: C.Ctx) -> dict:
    ex, s = ctx.expected, ctx.signed
    act = s[s.carson_active]
    groups = []
    for gname in ACTIVE_GROUPS:
        g = act[act.group == gname]
        groups.append({"group": gname, "n": int(len(g)), "statuses": {k: int(v) for k, v in g.status.value_counts().items()}})
    inactive = [{"status": st, "n": int((s.status == st).sum())} for st in INACTIVE_STATUSES]
    q2 = ex["q2"]
    return {
        "signed": ex["jira"]["signed"], "active": ex["jira"]["active"], "inactive": ex["jira"]["inactive"],
        "active_groups": groups, "inactive_statuses": inactive,
        "attainment": {"active": q2["active"], "uc": q2["active_uc"], "closed": q2["active_closed"],
                       "uc_share": round(q2["active_uc"] / q2["active"], 4), "closed_share": round(q2["active_closed"] / q2["active"], 4)},
    }
