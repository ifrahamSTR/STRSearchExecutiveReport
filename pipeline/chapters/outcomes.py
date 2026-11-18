"""Chapter 2: where are our clients today? (16 Nov 2026: Jira-issue grain, reporting-layer flags)

Active = signed-up minus Refunded, Paused and Additional Service; it includes clients who already closed and are in
post-close services. Hunting = the Active clients still searching (Client Start to 8 Weeks). Attainment counts
completed milestones only: closing dates after the data date are scheduled, not closed."""
from __future__ import annotations

import core as C
from chapters import records as R

ACTIVE_GROUPS = ["Hunting", "Under contract", "Closed", "Post-close"]
INACTIVE_STATUSES = ["Paused", "Refunded", "Additional Service"]


def waiting(ctx: C.Ctx) -> dict:
    """Signed-up clients who are still waiting (scene 2.2). One stage per Jira issue, status first (records.stage), so the
    stages add up to the signed-up count and Hunting / Paused / Inactive equal the snapshot counts.
      no valid contract or completed purchase = hunting + paused + additional service + refunded
      yet to close                            = that + under contract (incl. closings scheduled after the data date)"""
    s = ctx.signed
    st = R.stage(s)
    n = {k: int((st == k).sum()) for k in R.STAGES}
    signed = int(len(s))
    no_contract = n["hunting"] + n["paused"] + n["additional"] + n["refunded"]
    yet = no_contract + n["under_contract"]
    pu, uc = s[st == "purchased"], s[st == "under_contract"]
    moved_back = s[st.isin(["hunting", "paused", "refunded"]) & s.closed.notna()]
    share = lambda k: round(k / signed, 4)  # noqa: E731
    return {
        "denominator": signed, "stages": n, "other": int((st == "other").sum()),
        "no_contract": {"n": no_contract, "share": share(no_contract)},
        "yet_to_close": {"n": yet, "share": share(yet)},
        "excluding_refunded": {"no_contract": no_contract - n["refunded"], "yet_to_close": yet - n["refunded"],
                               "no_contract_share": share(no_contract - n["refunded"]), "yet_share": share(yet - n["refunded"])},
        "snapshot": {"active": int(s.active.sum()), "inactive": int(s.inactive.sum()), "hunting": int(s.hunting.sum()),
                     "paused": int((s.status == "Paused").sum()), "refunded": int((s.status == "Refunded").sum()),
                     "additional": int((s.status == "Additional Service").sum())},
        "purchased": {"post_close_status": int(pu.status.isin(R.POST_CLOSE).sum()),
                      "uc_status_closing_recorded": int(pu.status.isin(R.UNDER_CONTRACT).sum()),
                      "with_closing_date": int(pu.closed.notna().sum()), "status_only": int(pu.closed.isna().sum()),
                      "no_uc_date": int(pu.uc.isna().sum())},
        "under_contract": {"scheduled": int(uc.closed_scheduled.sum()), "passed_inspection": int((uc.status == "Passed Inspection").sum())},
        "moved_back_with_closing_date": {"n": int(len(moved_back)), "statuses": {k: int(v) for k, v in moved_back.status.value_counts().items()}},
        "hunting_with_older_uc_date": int((s.hunting & s.uc.notna()).sum()),
    }


def build(ctx: C.Ctx) -> dict:
    ex, s = ctx.expected, ctx.signed
    act = s[s.active]
    groups = []
    for gname in ACTIVE_GROUPS:
        g = act[act.group == gname]
        groups.append({"group": gname, "n": int(len(g)), "statuses": {k: int(v) for k, v in g.status.value_counts().items()}})
    inactive = [{"status": st, "n": int((s.status == st).sum())} for st in INACTIVE_STATUSES]
    q2 = ex["q2"]
    return {
        "signed": ex["jira"]["signed"], "active": ex["jira"]["active"], "inactive": ex["jira"]["inactive"], "hunting": ex["jira"]["hunting"],
        "active_groups": groups, "inactive_statuses": inactive,
        "attainment": {"active": q2["active"], "uc": q2["active_uc"], "closed": q2["active_closed"],
                       "uc_share": round(q2["active_uc"] / q2["active"], 4), "closed_share": round(q2["active_closed"] / q2["active"], 4),
                       "closed_scheduled": q2["active_closed_scheduled"]},
        "hunting_engagements": ex["engagements"]["hunting_official"],
        "waiting": waiting(ctx),
    }
