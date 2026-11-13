"""Client progression: who the clients are, where they are now, and how many reached milestones."""
from __future__ import annotations

import pandas as pd

import core as C


def _attainment(g: pd.DataFrame) -> dict:
    past_uc_status = g.status.isin(C.UNDER_CONTRACT + C.SURELY_CLOSED)
    uc_at_least = g.uc_evt | past_uc_status
    closedish = g.stage.isin(["Closed", "Post-close"])
    return {
        "n": int(len(g)),
        "uc_logged": int(g.uc_logged.sum()), "uc_logged_share": C.r(g.uc_logged.mean()),
        # A closing implies a contract: clients with a CLOSED date (or a status that only follows a
        # closing) are counted even when the UC date itself was never logged.
        "uc_at_least": int(uc_at_least.sum()), "uc_at_least_share": C.r(uc_at_least.mean()),
        "closed_logged": int(g.cl_evt.sum()), "closed_logged_share": C.r(g.cl_evt.mean()),
        "closed_status": int(closedish.sum()), "closed_status_share": C.r(closedish.mean()),
        # single "ever closed" figure: a logged CLOSED date or a closed / post-close status
        "ever_closed": int((g.cl_evt | closedish).sum()), "ever_closed_share": C.r((g.cl_evt | closedish).mean()),
    }


def _composition(g: pd.DataFrame) -> dict:
    vc = g.stage.value_counts()
    return {k: int(vc.get(k, 0)) for k in C.STAGE_ORDER}


def build(ctx: C.Ctx) -> dict:
    s, D = ctx.signed, ctx.D
    active, inactive = s[s.carson_active], s[s.carson_inactive]
    order = {k: v["order"] for k, v in D.STATUS_META.items()}
    stages = []
    for st in C.STAGE_ORDER:
        g = s[s.stage == st]
        by_status = g.status.value_counts()
        stages.append({"stage": st, "n": int(len(g)), "active": st in ("Searching", "Under contract", "Closed", "Post-close"),
                       "statuses": [{"status": k, "n": int(v)} for k, v in sorted(by_status.items(), key=lambda kv: order.get(kv[0], 99))]})

    s2 = s.copy()
    s2["q"] = s2.start.dt.to_period("Q")
    cohorts = []
    for q, g in s2.groupby("q"):
        cohorts.append({"q": str(q), "label": f"Q{q.quarter} {q.year}", "n": int(len(g)), "stages": _composition(g),
                        "reliable": bool(q.start_time >= pd.Timestamp(C.RELIABLE_FROM)),
                        "mature": bool(q.end_time.normalize() + pd.Timedelta(days=C.MATURE_DAYS) <= ctx.asof)})

    reliable = s.start >= pd.Timestamp(C.RELIABLE_FROM)
    mature = s[reliable & (s.elapsed >= C.MATURE_DAYS)]
    change = pd.Timestamp(C.PROCESS_CHANGE)
    before, since = s[reliable & (s.start < change)], s[s.start >= change]
    non_signed = ctx.jira[~ctx.jira.carson_signed].status.value_counts()

    def exits(g, label):
        return {"label": label, "n": int(len(g)), "refunded": int((g.stage == "Refunded").sum()),
                "paused": int((g.stage == "Paused").sum())}

    # Exits at an equal age: refunded / paused within N days of start, among clients with N days of follow-up.
    def early_exit(g, label, days):
        m = g[g.elapsed >= days]
        ex_days = (m.exit_date - m.start).dt.days
        ref = int(((m.stage == "Refunded") & (ex_days <= days)).sum())
        pau = int(((m.stage == "Paused") & (ex_days <= days)).sum())
        return {"label": label, "days": days, "den": int(len(m)), "refunded": ref, "paused": pau,
                "refunded_share": C.r(ref / len(m)) if len(m) else None, "paused_share": C.r(pau / len(m)) if len(m) else None}

    sep = pd.Timestamp("2026-09-01")
    periods = [("Jul 2025 – late May 2026", reliable & (s.start < change)),
               ("Late May – Aug 2026", (s.start >= change) & (s.start < sep)),
               ("Sep 2026", (s.start >= sep) & (s.start < pd.Timestamp("2026-10-01")))]
    early = {str(dd): [early_exit(s[mask], lab, dd) for lab, mask in periods] for dd in (45, 90)}
    searching = s[s.stage == "Searching"]
    paused = s[s.stage == "Paused"]
    dormant = {"searching_over_180": int((searching.elapsed > 180).sum()),
               "paused_over_180": int(((ctx.asof - paused.exit_date).dt.days > 180).sum()), "paused": int(len(paused))}

    return {
        "classes": {"signed": int(len(s)), "active": int(len(active)), "inactive": int(len(inactive)),
                    "inactive_split": {k: int(v) for k, v in inactive.status.value_counts().items()}},
        "stages": stages,
        "in_progress": int(s.stage.isin(["Searching", "Under contract"]).sum()),
        "closed_or_beyond": int(s.stage.isin(["Closed", "Post-close"]).sum()),
        "attainment": {"active": _attainment(active), "signed": _attainment(s)},
        "post_close_without_closed_date": int((s.stage.eq("Post-close") & ~s.cl_evt).sum()),
        "cohorts": cohorts,
        "mature": {"days": C.MATURE_DAYS, "from": C.RELIABLE_FROM,
                   "to": (ctx.asof - pd.Timedelta(days=C.MATURE_DAYS)).strftime("%Y-%m-%d"),
                   **_attainment(mature), "stages": _composition(mature)},
        "exits_by_era": {"before": exits(before, "Jul 2025 – late May 2026"), "since": exits(since, "Since late May 2026")},
        "early_exits": early, "dormant": dormant,
        "presale": {"n": int(non_signed.sum()), "statuses": {k: int(v) for k, v in non_signed.items()}},
    }
