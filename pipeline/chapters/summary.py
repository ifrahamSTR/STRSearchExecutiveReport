"""Executive Summary support (added 18 Nov 2026): the figures this report shares with the Business Data Explorer
and the Cash Forecast, reconciled on one snapshot.

Each row states the population, event date and counting unit on each side and the counts that bridge any difference, so a
legitimate difference is explained rather than hidden. The Client Journey counts Jira issues (one per search) by status; the
Cash Forecast counts won Pipedrive deals (engagements) and resolves each one to a cash group; the monthly and weekly pace
counts come from daily_client_activity (won-deal grain) in both the Client Journey and the Explorer. build.py checks every
equality and every bridge."""
from __future__ import annotations

import json

import pandas as pd

import core as C
from chapters import cash, records as R


def _published(ctx: C.Ctx) -> dict:
    p = ctx.explorer / "docs" / C.VERSION_ID / "data" / "explorer-data.js"
    s = p.read_text(encoding="utf-8")
    return json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))


def reconcile(ctx: C.Ctx, data: dict) -> dict:
    asof = ctx.asof
    pub = _published(ctx)
    ex = pub["expected"]
    e, _ = cash.assign_groups(ctx)
    s = ctx.signed.copy()
    s["stage"] = R.stage(s)
    stage_by_key = s.set_index("key").stage
    e["stage"] = e.jira_key.map(stage_by_key)
    cg = data["cash"]["groups"]
    st = data["outcomes"]["waiting"]["stages"]
    keys_with_deal = set(e.jira_key.dropna())
    no_deal = s[~s.key.isin(keys_with_deal)].stage.value_counts()

    def x(stage, group):
        return int(((e.stage == stage) & (e.g == group)).sum())

    def other_side(group, stages):
        """Won deals in a cash group whose Jira issue is not in the given stages (resolved by e-mail, or a status that moved)."""
        return int(((e.g == group) & ~e.stage.isin(stages)).sum())

    goal = data["pace"]["goal"]
    pm = {r["month"]: r for r in data["pace"]["monthly"]}
    oct_m = next(r for r in goal["months"] if r["month"] == "2026-10")
    q3 = {r["month"]: r for r in ex["q3"]}
    jira_oct = int(ctx.jira.closed.dt.strftime("%Y-%m").eq("2026-10").sum())
    won = ctx.deals[ctx.deals.in_scope & (ctx.deals.status == "won")]
    won_m = won.won_date.dt.strftime("%Y-%m").value_counts()
    daily_m = ctx.f.daily.groupby(ctx.f.daily.activity_date.dt.strftime("%Y-%m")).clients_won.sum()
    won_diff = {m: [int(daily_m.get(m, 0)), int(won_m.get(m, 0))] for m in sorted(set(daily_m.index) | set(won_m.index))
                if int(daily_m.get(m, 0)) != int(won_m.get(m, 0))}
    rc = data["cash"]["recent_closed"]
    w30 = ctx.f.daily[(ctx.f.daily.activity_date >= pd.Timestamp(rc["from"])) & (ctx.f.daily.activity_date <= asof)].properties_closed.sum()
    bud = data["budgets"]["groups"]
    pb = {g["label"]: g for g in ex["budget"]["groups"]["cmp"]}

    E = __import__("sys").modules["explorer_enrich"]
    bridge = E.cash_bridge(data, ctx.f)["expected"]

    rows = [
        {"key": "signed", "label": "Signed-up clients", "cj": sum(st.values()), "explorer": ex["jira"]["signed"], "cash": data["cash"]["view"]["engagements"],
         "unit": "Jira issues (one per search) · Cash: won Pipedrive deals",
         "bridge": {"issues_with_won_deal": int(s.key.isin(keys_with_deal).sum()), "issues_without_won_deal": int((~s.key.isin(keys_with_deal)).sum()),
                    "deals_presale_or_unsigned_issue": int((e.jira_key.notna() & e.stage.isna()).sum()), "deals_without_jira": int(e.jira_key.isna().sum())}},
        {"key": "hunting", "label": "Hunting (no contract yet, still searching)", "cj": st["hunting"], "explorer": ex["jira"]["hunting"], "cash": cg["noprop"]["n"],
         "unit": "Jira issues by status · Cash: won deals with no property yet",
         "bridge": {"in_cash_noprop": x("hunting", "noprop"), "in_cash_closed": x("hunting", "closed"), "without_won_deal": int(no_deal.get("hunting", 0)),
                    "cash_not_started": data["cash"]["noprop"]["not_started"], "cash_hunting": data["cash"]["noprop"]["hunting"]}},
        {"key": "uc", "label": "Under contract, not yet closed", "cj": st["under_contract"], "explorer": st["under_contract"], "cash": cg["under_contract"]["n"] + cg["scheduled"]["n"],
         "unit": "Jira issues by status · Cash: under contract + closing scheduled",
         "bridge": {"cash_uc": cg["under_contract"]["n"], "cash_scheduled": cg["scheduled"]["n"], "matched": x("under_contract", "under_contract") + x("under_contract", "scheduled")}},
        {"key": "paused", "label": "Paused + Additional Service", "cj": st["paused"] + st["additional"], "explorer": st["paused"] + st["additional"], "cash": cg["paused"]["n"],
         "unit": "Jira issues by status · Cash: won deals in Paused / Additional Service",
         "bridge": {"matched": x("paused", "paused") + x("additional", "paused"), "jira_in_cash_closed": x("paused", "closed") + x("additional", "closed"),
                    "jira_without_won_deal": int(no_deal.get("paused", 0) + no_deal.get("additional", 0)), "cash_only": other_side("paused", ["paused", "additional"])}},
        {"key": "refunded", "label": "Refunded", "cj": st["refunded"], "explorer": ex["jira"]["refunded"], "cash": cg["refunded"]["n"],
         "unit": "Jira issues by status · Cash: won deals with a refund processed",
         "bridge": {"matched": x("refunded", "refunded"), "jira_without_won_deal": int(no_deal.get("refunded", 0)), "cash_only": other_side("refunded", ["refunded"])}},
        {"key": "purchased", "label": "Completed purchases", "cj": st["purchased"], "explorer": st["purchased"], "cash": cg["closed"]["n"] + cg["unverified_closing"]["n"],
         "unit": "Jira issues, status first · Cash: closing recorded + post-close without a closing date",
         "bridge": {"in_cash_closed": x("purchased", "closed"), "in_cash_unverified": x("purchased", "unverified_closing"), "without_won_deal": int(no_deal.get("purchased", 0)),
                    "cash_closed": cg["closed"]["n"], "cash_unverified": cg["unverified_closing"]["n"], "cash_closed_other_stage": other_side("closed", ["purchased"])}},
        {"key": "scheduled", "label": "Closings dated after the data date", "cj": cg["scheduled"]["n"], "explorer": ex["engagements"]["scheduled_closings"], "cash": cg["scheduled"]["n"],
         "unit": "Client Journey: still under contract (not a purchase) · Cash: collected on the scheduled date", "bridge": {}},
        {"key": "closed30", "label": f"Closings {pd.Timestamp(rc['from']).strftime('%-d %b')}–{asof.strftime('%-d %b')}", "cj": int(w30), "explorer": int(w30), "cash": rc["n"],
         "unit": "closing date up to the data date, won-deal grain (daily_client_activity)", "bridge": {}},
        {"key": "oct_closed", "label": "October 2026 closings", "cj": oct_m["closed"], "explorer": q3["2026-10"]["closed"],
         "cash": next(r["n"] for r in data["cash"]["completed"]["months"] if r["month"] == "2026-10"),
         "unit": "daily_client_activity (won deals) · Jira issues dated in October: " + str(jira_oct), "bridge": {"jira_issues": jira_oct}},
        {"key": "oct_sales", "label": "October 2026 sales", "cj": oct_m["sales"], "explorer": q3["2026-10"]["won"], "cash": None,
         "unit": "Pipedrive won date (daily_client_activity) · Explorer Sales funnel uses the official filter", "bridge": {"funnel_months_differ": won_diff}},
        {"key": "starts_oct", "label": "October 2026: searches started · under contract · difference", "fmt": "trio",
         "cj": [pm["2026-10"]["new"], pm["2026-10"]["uc"], pm["2026-10"]["gap"]], "explorer": [q3["2026-10"]["started"], q3["2026-10"]["uc"], q3["2026-10"]["net_client_change"]], "cash": None,
         "unit": "daily_client_activity (client starts by client start date, contracts by latest valid contract date)", "bridge": {}},
        {"key": "starts_nov", "label": "1–16 Nov 2026 (partial): searches started · under contract · difference", "fmt": "trio",
         "cj": [pm["2026-11"]["new"], pm["2026-11"]["uc"], pm["2026-11"]["gap"]], "explorer": [q3["2026-11"]["started"], q3["2026-11"]["uc"], q3["2026-11"]["net_client_change"]], "cash": None,
         "unit": "the same daily counts up to the data date; the month is still filling", "bridge": {}},
        {"key": "hunting_status", "label": "Hunting on 16 Nov (the backlog, a status count)", "cj": data["outcomes"]["waiting"]["stages"]["hunting"], "explorer": ex["jira"]["hunting"], "cash": None,
         "unit": "Jira issues by status; not the sum of the monthly starts − contracts", "bridge": {}},
        {"key": "uc_median", "label": "Median days to Under Contract (recorded)", "cj": data["speed"]["observed"]["uc"]["median"], "explorer": ex["q1"]["uc"]["median"], "cash": None,
         "unit": "confirmed starts, client start date to latest valid contract", "bridge": {}},
        {"key": "budget14", "label": "Under contract within 14 days, up to / above $250K", "cj": [bud[0]["uc14"]["k"], bud[0]["uc14"]["eligible"], bud[1]["uc14"]["k"], bud[1]["uc14"]["eligible"]],
         "explorer": [pb["Up to $250K"]["uc14"]["k"], pb["Up to $250K"]["uc14"]["eligible"], pb["Above $250K"]["uc14"]["k"], pb["Above $250K"]["uc14"]["eligible"]], "cash": None,
         "unit": "confirmed starts with a matched onboarding budget, eligible = 14 days on the clock", "bridge": {}},
        {"key": "budget_rf30", "label": "Refunded within 30 days, up to / above $250K",
         "cj": [data["budgets"]["early"]["sets"]["all"][g]["rf30"][k] for g in ("Up to $250K", "Above $250K") for k in ("k", "eligible")],
         "explorer": [pb[g]["rf30"][k] for g in ("Up to $250K", "Above $250K") for k in ("k", "eligible")], "cash": None,
         "unit": "refund date - client start date within 30 days, eligible = 30 days on the clock", "bridge": {}},
        {"key": "budget_paused", "label": "Paused on 16 Nov, up to / above $250K",
         "cj": [data["budgets"]["early"]["sets"]["all"]["Up to $250K"]["paused_now"], data["budgets"]["early"]["sets"]["all"]["Up to $250K"]["n"],
                data["budgets"]["early"]["sets"]["all"]["Above $250K"]["paused_now"], data["budgets"]["early"]["sets"]["all"]["Above $250K"]["n"]],
         "explorer": [pb["Up to $250K"]["stages"].get("paused", 0), pb["Up to $250K"]["n"], pb["Above $250K"]["stages"].get("paused", 0), pb["Above $250K"]["n"]], "cash": None,
         "unit": "status snapshot (Jira, 16 Nov), all matched clients in each group", "bridge": {}},
        {"key": "fall_pair", "label": "Fall-through: documented · contract ended without a purchase", "fmt": "pair",
         "cj": [data["fallout"]["documented"]["n"], data["fallout"]["ended"]["n"]],
         "explorer": [data["budgets"]["explorer_jira"]["fallout"].get("documented", 0), data["budgets"]["explorer_jira"]["fallout"].get("ended", 0)], "cash": None,
         "unit": "searches known to have gone under contract (Jira, 12 Nov extract + 16 Nov statuses)", "bridge": {}},
        {"key": "paused_ft", "label": "Paused searches with an ended contract or documented fall-through",
         "cj": data["outcomes"]["status"]["paused"]["prior"]["evidence"], "explorer": data["budgets"]["explorer_jira"]["paused_fallthrough"],
         "cash": data["cash"]["paused"]["fell_through"]["jira_fell_through"],
         "unit": "Paused Jira issues; the Cash Forecast's paused default uses the same count", "bridge": {}},
        {"key": "net_cash", "label": "Forecast net cash (default assumptions)", "cj": None, "explorer": pub["views"]["cash_bridge"]["expected"]["net"], "cash": bridge["net"],
         "unit": "service + affiliate − future refunds, Cash Forecast defaults", "bridge": {k: bridge[k] for k in ("service", "affiliate", "refunds")}},
    ]
    return {"asof": asof.strftime("%Y-%m-%d"), "rows": rows, "explorer_asof": pub["meta"]["asof"] if "meta" in pub and "asof" in pub["meta"] else None,
            "cash_bridge": bridge}
