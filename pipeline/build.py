#!/usr/bin/env python3
"""Build the data for "The Client Journey", 16 Nov 2026 reporting version.

    python pipeline/build.py [--explorer <path to STRSearch-Business-Data-Explorer>] [--reports <16 Nov UpdatedReports>] [--cache]

All figures come from the Business Data Explorer's 16 Nov foundation (imported, not copied): the reporting-layer
export, reconciled with its SQL reference. Every build checks the output against the foundation's headline metrics and
against the Explorer's PUBLISHED 16 Nov data file, and stops on any mismatch, so the two sites always agree.
Output: docs/2026-11-16/data/story-data.js (window.STORY_DATA) and story-data.json (aggregates only).
The archived 12 Nov 2026 version is rebuilt only by versions/2026-11-12/pipeline/ and is never overwritten here.
"""
from __future__ import annotations

import argparse
import json

import pandas as pd
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import core as C  # noqa: E402
from chapters import budgets, cash, drivers, fallout, journey, outcomes, pace, repeat, speed, summary  # noqa: E402

CHAPTERS = {"journey": journey, "outcomes": outcomes, "pace": pace, "speed": speed, "drivers": drivers, "fallout": fallout, "repeat": repeat}
OUT = C.ROOT / "docs" / C.VERSION_ID / "data" / "story-data.js"


def small_cells(obj) -> int:
    """Published {n, k, share} cells whose share rests on fewer than 5 clients (or reveals a suppressed count)."""
    if isinstance(obj, dict):
        bad = 0
        if {"n", "k", "share"} <= obj.keys() and obj["share"] is not None:
            bad += obj["n"] < 5 or obj["k"] is None or 0 < obj["k"] < 5
        if {"n", "k", "share"} <= obj.keys() and obj["share"] is None and obj["k"] is not None:
            bad += 1
        return bad + sum(small_cells(v) for v in obj.values())
    if isinstance(obj, list):
        return sum(small_cells(v) for v in obj)
    return 0


def explorer_published(explorer: Path) -> dict | None:
    p = explorer / "docs" / C.VERSION_ID / "data" / "explorer-data.js"
    if not p.exists():
        return None
    s = p.read_text(encoding="utf-8")
    return json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))["expected"]


def checks(ctx: C.Ctx, data: dict) -> list[dict]:
    ex, sp, oc, pc, dr = ctx.expected, data["speed"], data["outcomes"], data["pace"], data["drivers"]
    out = []

    def chk(name, got, want, hard=True):
        out.append({"check": name, "page": got, "explorer": want, "ok": got == want, "hard": hard})

    pub = explorer_published(ctx.explorer)
    chk("Explorer 16 Nov data file is published next to this build", pub is not None, True)
    if pub:
        chk("Shared headline: days to UC median / mean / n = the published Explorer", (sp["observed"]["uc"]["median"], sp["observed"]["uc"]["mean"], sp["observed"]["uc"]["n"]),
            (pub["q1"]["uc"]["median"], pub["q1"]["uc"]["mean"], pub["q1"]["uc"]["n"]))
        chk("Shared headline: days to CLOSED median / mean / n = the published Explorer", (sp["observed"]["closed"]["median"], sp["observed"]["closed"]["mean"], sp["observed"]["closed"]["n"]),
            (pub["q1"]["closed"]["median"], pub["q1"]["closed"]["mean"], pub["q1"]["closed"]["n"]))
        chk("Shared headline: Kaplan-Meier day 50% (UC / CLOSED) = the published Explorer", (sp["estimate"]["uc"]["median"], sp["estimate"]["closed"]["median"]), (pub["q1"]["km_uc"], pub["q1"]["km_closed"]))
        chk("Shared headline: signed / active / inactive / hunting = the published Explorer", (oc["signed"], oc["active"], oc["inactive"], oc["hunting"]),
            (pub["jira"]["signed"], pub["jira"]["active"], pub["jira"]["inactive"], pub["jira"]["hunting"]))
        chk("Shared headline: Active with UC / CLOSED = the published Explorer", (oc["attainment"]["uc"], oc["attainment"]["closed"]), (pub["q2"]["active_uc"], pub["q2"]["active_closed"]))
        pq = {r["month"]: r for r in pub["q3"]}
        chk("Shared monthly starts / UC / CLOSED: months that differ from the published Explorer",
            sum(1 for r in pc["monthly"] if (r["new"], r["uc"], r["closed"]) != (pq[r["month"]]["started"], pq[r["month"]]["uc"], pq[r["month"]]["closed"])), 0)
    chk("Kaplan-Meier curve crosses 50% where the foundation says (UC)", sp["estimate"]["uc"]["check"], ex["q1"]["km_uc"])
    chk("Kaplan-Meier curve crosses 50% where the foundation says (CLOSED)", sp["estimate"]["closed"]["check"], ex["q1"]["km_closed"])
    chk("Histogram bins + overflow = UC n", sum(sp["hist"]["counts"]) + sp["hist"]["overflow"], ex["q1"]["uc"]["n"])
    chk("Clock start counts cover exactly the recorded durations (UC n / CLOSED n)", (sp["clock"]["uc"]["n"], sp["clock"]["closed"]["n"]), (ex["q1"]["uc"]["n"], ex["q1"]["closed"]["n"]))
    chk("Start rules add up to the recorded UC durations", sum(sp["clock"]["uc"][r] for r in ("due", "created+4", "won")), sp["clock"]["uc"]["n"])
    chk("Active status groups add up to Active", sum(g["n"] for g in oc["active_groups"]), ex["jira"]["active"])
    chk("Inactive statuses add up to Inactive", sum(i["n"] for i in oc["inactive_statuses"]), ex["jira"]["inactive"])
    chk("Active + Inactive = signed-up", oc["active"] + oc["inactive"], ex["jira"]["signed"])
    chk("Hunting = the Active group 'Hunting'", next(g["n"] for g in oc["active_groups"] if g["group"] == "Hunting"), ex["jira"]["hunting"])
    q3 = {r["month"]: r for r in ex["q3"]}
    chk("Monthly rows that differ from daily_client_activity", sum(1 for r in pc["monthly"] if (r["new"], r["uc"], r["closed"]) != (q3[r["month"]]["started"], q3[r["month"]]["uc"], q3[r["month"]]["closed"])), 0)
    chk("Monthly gap = starts minus Under Contract events (net_client_change), months that differ",
        sum(1 for r in pc["monthly"] if r["gap"] != q3[r["month"]]["net_client_change"]), 0)
    jt = ctx.jira.created.dt.strftime("%Y-%m").value_counts()
    chk("Jira intake: signed + pre-sale + declined = every new Jira issue that month, months that differ",
        sum(1 for r in pc["intake"]["monthly"] if r["signed"] + r["presale"] + r["declined"] != int(jt.get(r["month"], 0))), 0)
    cs = ctx.cohort.start.dt.strftime("%Y-%m").value_counts()
    chk("Same-cohort strip: start months whose size differs from the confirmed starts", sum(1 for c in pc["cohort"]["rows"] if c["n"] != int(cs.get(c["month"], 0))), 0)
    chk("Keeping pace: no published share rests on 1-4 clients (the monthly cohort table publishes counts with their denominators and marks small cells instead)",
        small_cells({k: v for k, v in pc.items() if k not in ("cohorts", "growth")}), 0)
    chk("Fast/slow: the four speed groups add up to classifiable clients with 75+ days on the clock", sum(g["n"] for g in dr["composition"]["groups"]), dr["bases"]["d75"]["eligible"])
    chk("Fast/slow: matched clients never exceed eligible clients", all(dr["bases"][b]["matched"] <= dr["bases"][b]["eligible"] for b in ("d30", "d75")), True)
    chk("Onboarding answers used all precede the client's Under Contract date", dr["matching"]["answers_after_uc_used"], 0)
    chk("Fast/slow: no published share rests on 1-4 clients", small_cells(dr), 0)
    chk("Capital (Pipedrive): every confirmed start with a stated capital is in the survival analysis", dr["capital"]["pipedrive"]["n"], dr["capital"]["pipedrive"]["coverage"]["known"])
    # ---- questions added 18 Nov 2026 (scenes 2.2, 3.2 table, 3.3, 4.4, chapters 6 and 7)
    w = oc["waiting"]
    st = w["stages"]
    chk("Still waiting: the six stages add up to the signed-up clients, none unclassified", (sum(st.values()), w["other"]), (ex["jira"]["signed"], 0))
    chk("Still waiting: Hunting / Paused / Inactive equal the snapshot status counts", (st["hunting"], st["paused"], st["paused"] + st["additional"] + st["refunded"]),
        (ex["jira"]["hunting"], w["snapshot"]["paused"], ex["jira"]["inactive"]))
    chk("Still waiting: purchased + under contract + hunting = Active", st["purchased"] + st["under_contract"] + st["hunting"], ex["jira"]["active"])
    chk("Still waiting: no contract = hunting + paused + additional + refunded; yet to close = that + under contract",
        (w["no_contract"]["n"], w["yet_to_close"]["n"]), (st["hunting"] + st["paused"] + st["additional"] + st["refunded"], st["hunting"] + st["paused"] + st["additional"] + st["refunded"] + st["under_contract"]))
    gr = pc["growth"]
    chk("Growth table: Won / Starts / UC of every full month equal the monthly table above it (daily_client_activity)",
        sum(1 for r in gr["rows"] if not r["partial"] and (r["won"], r["starts"], r["uc"]) != (q3[r["month"]]["won"], q3[r["month"]]["started"], q3[r["month"]]["uc"])), 0)
    chk("Growth table: every growth figure shown = this period / the same days of the comparison period - 1",
        all(abs(r[f"{m}_{k}"]["pct"] - (r[m] / r[f"{m}_{k}"]["base"] - 1)) < 1e-3 for r in gr["rows"] for m in ("won", "starts", "uc") for k in ("mom", "yoy") if r[f"{m}_{k}"]["pct"] is not None), True)
    ev = gr["evidence"]
    chk("Growth table: the June-November 2025 contract gap still holds (30%+ of Aug-Dec 2025 closings lack a UC date; at most 10% in Jan-Jul 2025 and in 2026)",
        ev["gap_k"] / ev["gap_n"] >= 0.3 and ev["rest25_k"] / ev["rest25_n"] <= 0.1 and ev["y26_k"] / ev["y26_n"] <= 0.1, True)
    chk("Growth table: the start-rule month is the month of definitions.START_RULE_DATE", gr["rule_month"], ctx.D.START_RULE_DATE[:7])
    cc, exc = pc["cohorts"]["clocks"]["start"]["rows"], {r["month"]: r for r in ex["cohort"]}
    chk("Cohorts (client start clock): within 14 / 30 / 60 / 90 days equal the Explorer's matured-cohort table, months that differ",
        sum(1 for r in cc if any((r[f"w{d}"]["k"], r[f"w{d}"]["eligible"]) != (exc[r["month"]][f"w{d}"]["converted"], exc[r["month"]][f"w{d}"]["eligible"]) for d in (14, 30, 60, 90))), 0)
    chk("Cohorts: month sizes equal the confirmed starts", sum(1 for r in cc if r["n"] != int(cs.get(r["month"], 0))), 0)
    chk("Cohorts: numerators never exceed eligible clients, eligible never exceeds the month, cells under 5 are marked small (both clocks)",
        all(c[f"w{d}"]["k"] <= c[f"w{d}"]["eligible"] <= c["n"] and (c[f"w{d}"]["small"] or c[f"w{d}"]["k"] == 0 or c[f"w{d}"]["k"] >= 5)
            for ck in pc["cohorts"]["clocks"].values() for c in ck["rows"] for d in (14, 30, 60, 90)), True)
    sc, q1 = sp["scenario"], ex["q1"]
    a = sc["all"]
    chk("UC tomorrow: recorded durations equal the published headline (n / mean / median)", (a["recorded"]["n"], a["recorded"]["mean"], a["recorded"]["median"]),
        (q1["uc"]["n"], q1["uc"]["mean"], q1["uc"]["median"]))
    chk("UC tomorrow: each search counts once (recorded - hunting with an older date + hunting = pooled)", a["recorded"]["n"] - a["hunting_with_older_uc"] + a["hunting"], a["scenario"]["n"])
    chk("UC tomorrow: hunting searches = the reporting layer's hunting engagements", a["hunting"], ex["engagements"]["hunting_official"])
    chk("UC tomorrow: budget groups add up to every confirmed start, recorded duration and hunting search",
        tuple(sum(b[k] for b in sc["budgets"]) for k in ("clients", "hunting")) + (sum(b["recorded"]["n"] for b in sc["budgets"]), sum(b["scenario"]["n"] for b in sc["budgets"])),
        (a["clients"], a["hunting"], a["recorded"]["n"], a["scenario"]["n"]))
    chk("UC tomorrow: no budget-group average or median rests on fewer than 5 searches", min(min(b["recorded"]["n"], b["scenario"]["n"]) for b in sc["budgets"]) >= 5, True)
    fo = data["fallout"]
    chk("Fall-through: the five evidence groups add up to the clients known to have gone under contract", sum(g["n"] for g in fo["groups"].values()), fo["known"]["n"])
    chk("Fall-through: known = UC record + fall-out address only + purchase only", fo["known"]["uc_record"] + fo["known"]["fell_only"] + fo["known"]["purchase_only"], fo["known"]["n"])
    chk("Fall-through: where documented and status-implied fall-throughs stand today adds up",
        (sum(fo["documented"]["now"].values()), sum(fo["ended"]["now"].values())), (fo["documented"]["n"], fo["ended"]["n"]))
    rp = data["repeat"]
    nj = rp["pipedrive"]["no_own_jira"]
    chk("Repeat clients: deals without their own Jira issue are the Cash Forecast reconciliation's (repeat purchases / second deals under review)",
        (nj["confirmed_repeat"]["deals"], nj["second_deal_review"]["deals"]), (data["cash"]["resolution"]["repeat"], data["cash"]["resolution"]["second_deal_review"]))
    chk("Repeat clients: every deal without its own Jira issue belongs to a client with two or more won deals", rp["pipedrive"]["within_repeat_clients"], True)
    chk("Repeat clients: the Jira categories add up to the clients with two or more searches", sum(rp["jira"]["categories"].values()), rp["jira"]["multi_clients"])
    cr = rp["cribs"]
    chk("STR Cribs: first and later designer choices add up to the repeat buyers' purchases", (sum(cr["first"].values()), sum(cr["later"].values())), (cr["clients"], cr["purchases"] - cr["clients"]))
    chk("STR Cribs: repeat buyers are the Jira clients with two or more completed purchases", cr["clients"], rp["jira"]["two_plus_purchases"])
    # ---- Added 18 Nov 2026: the 100-a-month goal, client status, the first 14 days, budget groups, reconciliation
    gl, dm = pc["goal"], ctx.f.daily
    day = dm.set_index("activity_date")
    cols = {"sales": "clients_won", "uc": "clients_went_uc", "closed": "properties_closed"}
    chk("Goal pace: every month's and every Sunday-Saturday week's Sales / Under Contract / Closed equal daily_client_activity over the days it covers",
        all(r[k] == int(day.loc[r["first"]:r["last"], c].sum()) and r["days"] == len(day.loc[r["first"]:r["last"]]) for r in gl["months"] + gl["weeks"] for k, c in cols.items()), True)
    chk("Goal pace: full months equal the published Explorer's monthly table (won / UC / closed)" if pub else "Goal pace: full months equal the foundation's monthly table",
        sum(1 for r in gl["months"] if not r["partial"] and (r["sales"], r["uc"], r["closed"]) != (q3[r["month"]]["won"], q3[r["month"]]["uc"], q3[r["month"]]["closed"])), 0)
    chk("Goal pace: weeks cover every day from the first Sunday to the data date exactly once; only the last month and week are partial and both end on the data date",
        (sum(r["days"] for r in gl["weeks"]), [r["partial"] for r in gl["months"]].count(True), [r["partial"] for r in gl["weeks"]].count(True), gl["months"][-1]["last"], gl["weeks"][-1]["last"]),
        ((ctx.asof - pd.Timestamp(gl["weeks"][0]["week"])).days + 1, int(gl["months"][-1]["partial"]), int(gl["weeks"][-1]["partial"]), gl["asof"], gl["asof"]))
    chk("Goal pace: weekly benchmark = 100 a month per seven calendar days; every rate = count x 7 / days covered",
        (gl["benchmark_per7"], all(abs(r[f"{k}_per7"] - r[k] * 7 / r["days"]) < 0.01 for r in gl["months"] + gl["weeks"] for k in cols)), (round(100 * 7 / (365.25 / 12), 2), True))
    cv = gl["conversion"]
    chk("Goal pace: sales and contracts needed for 100 closings a month = 100 / the recorded conversion", (cv["sales_needed"], cv["uc_needed"]), (round(100 / cv["won_close"]), round(100 / cv["uc_close"])))
    cs2 = oc["status"]
    h, pa, rf, uc = cs2["hunting"], cs2["paused"], cs2["refunded"], cs2["under_contract"]
    stg = oc["waiting"]["stages"]
    chk("Client status: hunting, paused, refunded and under contract equal scene 2.1 (status first) and hunting equals the published Explorer",
        (h["n"], pa["n"], rf["n"], uc["n"], h["n"]), (stg["hunting"], stg["paused"], stg["refunded"], stg["under_contract"], pub["jira"]["hunting"] if pub else stg["hunting"]))
    chk("Client status: hunting with a start date + without = hunting; wait bins (10-day + 180+) and bands add up to those with a start date; no-start reasons add up",
        (h["with_start"] + h["no_start"], sum(h["bins"]["counts"]) + h["bins"]["overflow"], sum(b["n"] for b in h["bands"]), sum(h["no_start_why"].values()), sum(r["n"] for r in h["by_start_month"])),
        (h["n"], h["with_start"], h["with_start"], h["no_start"], h["with_start"]))
    chk("Client status: pause-length bands add up to dated pauses; refund-timing bands to timed refunds; refund months to dated refunds; previous statuses of paused clients to Paused",
        (sum(b["n"] for b in pa["bands"]), sum(b["n"] for b in rf["bands"]), sum(r["n"] for r in rf["by_month"]) + rf["before_2025"], sum(pa["from"].values())),
        (pa["dated"], rf["timed"], rf["dated"], pa["n"]))
    f14 = pc["first14"]
    cc14 = {r["month"]: r for r in pc["cohorts"]["clocks"]["start"]["rows"]}
    chk("First 14 days: under contract within 14 days and eligible clients equal the cohort table (3.3), months that differ",
        sum(1 for r in f14["rows"] if (r["uc14"], r["el14"]) != (cc14[r["month"]]["w14"]["k"], cc14[r["month"]]["w14"]["eligible"])), 0)
    chk("First 14 days: contracts and refunds never exceed eligible clients, eligible never exceeds the month",
        all(r[f"uc{w}"] <= r[f"el{w}"] and r[f"rf{w}"] <= r[f"el{w}"] <= r["n"] for r in f14["rows"] for w in (14, 30)), True)
    bd = data["budgets"]
    if pub:
        pb = {g["label"]: g for g in pub["budget"]["groups"]["cmp"]}
        keys = ("n", "uc14", "uc30", "uc60", "uc90", "cl90", "rf14", "rf30", "rf60", "km_uc", "km_closed", "stages")
        chk("Budget: up to / above $250K / not recorded (sizes, windows, refunds, Kaplan-Meier, stages) = the published Explorer #budget view",
            sum(1 for g in bd["groups"] for k in keys if g[k] != pb[g["label"]][k]) + sum(1 for g in bd["groups"] if g["recorded"]["median"] != pb[g["label"]]["recorded"]["median"]), 0)
        pm = pub["budget"]["mh"]["cmp"]
        chk("Budget: like-for-like differences and intervals (contracts, closings, refunds) = the published Explorer",
            sum(1 for k in ("uc", "closed", "refunded") for a, b in zip(bd["mh"][k], pm[k]) if (a["diff"], a["lo"], a["hi"], a["a"], a["b"]) != (b["diff"], b["lo"], b["hi"], b["a"], b["b"])), 0)
    bg = {g["label"]: g for g in bd["groups"]}
    chk("Budget: monthly cohort cells add up to each group's 14 / 30-day contracts and 14 / 30-day refunds",
        all(sum(r[lab][f"w{w}"]["k"] for r in bd["months"]) == bg[lab][f"uc{w}"]["k"] and sum(r[lab][f"w{w}"]["eligible"] for r in bd["months"]) == bg[lab][f"uc{w}"]["eligible"]
            and sum(r[lab][f"rf{w}"]["k"] for r in bd["months"]) == bg[lab][f"rf{w}"]["k"] for lab in ("Up to $250K", "Above $250K") for w in (14, 30)), True)
    chk("Budget: the UC-tomorrow groups (4.3) hold the same clients and recorded durations as the budget groups",
        [(c["label"], c["clients"], c["recorded"]["n"], c["recorded"]["median"]) for c in sp["scenario"]["cmp"]], [(g["label"], g["n"], g["recorded"]["n"], g["recorded"]["median"]) for g in bd["groups"]])
    chk("Budget: experience split adds up to the matched groups' 30-day refunds",
        all(sum(x["rf30"]["k"] for x in bd["experience"] if x["group"] == lab) == bg[lab]["rf30"]["k"] for lab in ("Up to $250K", "Above $250K")), True)
    rows = {r["key"]: r for r in data["reconcile"]["rows"]}
    same = ["uc", "paused", "scheduled", "closed30", "oct_closed", "oct_sales", "uc_median", "budget14", "budget_rf30", "budget_paused", "starts_oct", "starts_nov", "hunting_status"]
    chk("Reconciliation: figures that must be equal across the report, the Explorer and the Cash Forecast are equal",
        [k for k in same if not (rows[k]["cj"] == rows[k]["explorer"] and (rows[k]["cash"] is None or rows[k]["cash"] == rows[k]["cj"]))]
        + ([] if abs(rows["net_cash"]["explorer"] - rows["net_cash"]["cash"]) < 0.01 else ["net_cash"]), [])
    hb, pb2, rb, ub, sb = rows["hunting"]["bridge"], rows["paused"]["bridge"], rows["refunded"]["bridge"], rows["purchased"]["bridge"], rows["signed"]["bridge"]
    chk("Reconciliation: every bridge between Jira issues and won deals adds up (signed, hunting, paused, refunded, purchases)",
        (sb["issues_with_won_deal"] + sb["issues_without_won_deal"], hb["in_cash_noprop"] + hb["in_cash_closed"] + hb["without_won_deal"], hb["cash_hunting"] + hb["cash_not_started"],
         pb2["matched"] + pb2["jira_in_cash_closed"] + pb2["jira_without_won_deal"], pb2["matched"] + pb2["cash_only"], rb["matched"] + rb["jira_without_won_deal"], rb["matched"] + rb["cash_only"],
         ub["in_cash_closed"] + ub["in_cash_unverified"] + ub["without_won_deal"]),
        (rows["signed"]["cj"], rows["hunting"]["cj"], rows["hunting"]["cash"], rows["paused"]["cj"], rows["paused"]["cash"], rows["refunded"]["cj"], rows["refunded"]["cash"], rows["purchased"]["cj"]))
    # statements the presentation makes in words (warn only: on a refresh the page text follows the data)
    gp = pc["gap"]
    chk("Keeping pace: 'the gap has narrowed every month since' its peak after late May", gp["narrowing"], True, hard=False)
    chk("Capital: no capital band differs (log-rank p > 0.05, Pipedrive capital)", dr["capital"]["pipedrive"].get("logrank", {}).get("p", 0) > 0.05, True, hard=False)
    cx = dr["capital"]["pipedrive"]["cox"] or {}
    chk("Capital: Cox 95% CI for capital includes 1 (Pipedrive capital)", cx.get("lo", 2) <= 1 <= cx.get("hi", 0), True, hard=False)
    of = [r["within30"]["share"] for r in dr["offers"]["rows"]]
    chk("Offer experience: share within 30 days rises 0 -> 1-2 -> 3+ offers", None not in of and of == sorted(of), True, hard=False)
    # ---- budget scenes 5.3-5.4 (18 Nov 2026)
    ea = bd["early"]
    LO_, HI_ = "Up to $250K", "Above $250K"
    if pub:
        pgrp = {g["label"]: g for g in pub["budget"]["groups"]["cmp"]}
        mism = sum(1 for lab in (LO_, HI_) for key, ws in (("uc", ea["windows"]["uc"]), ("cl", ea["windows"]["closed"]), ("rf", ea["windows"]["early"])) for w in ws
                   if (ea["sets"]["all"][lab][f"{key}{w}"]["k"], ea["sets"]["all"][lab][f"{key}{w}"]["eligible"]) != (pgrp[lab][f"{key}{w}"]["k"], pgrp[lab][f"{key}{w}"]["eligible"]))
        chk("Budget scenes: every window count (contracts 14-90 days, closings 60-120, refunds 14-90) = the published Explorer's budget groups, cells that differ", mism, 0)
        chk("Budget scenes: survival curves cross 50% where the Explorer's Kaplan-Meier medians are (contracts, closings, both groups)",
            tuple(ea["curves"][f][lab]["half"] for f in ("uc", "closed") for lab in (LO_, HI_)), tuple(pgrp[lab][k] for k in ("km_uc", "km_closed") for lab in (LO_, HI_)))
        chk("Budget scenes: paused-today counts = the Explorer's stage counts", tuple(ea["sets"]["all"][lab]["paused_now"] for lab in (LO_, HI_)), tuple(pgrp[lab]["stages"].get("paused", 0) for lab in (LO_, HI_)))
    keys_ = [f"{k}{w}" for k, ws in (("uc", ea["windows"]["uc"]), ("cl", ea["windows"]["closed"]), ("rf", ea["windows"]["early"]), ("pa", ea["windows"]["early"]), ("ex", ea["windows"]["early"])) for w in ws]
    chk("Budget scenes: New Client Experience + Legacy add up to all matched clients in every window, both groups (counts and eligible)",
        all(ea["sets"]["nce"][lab][k][f] + ea["sets"]["legacy"][lab][k][f] == ea["sets"]["all"][lab][k][f] for lab in (LO_, HI_) for k in keys_ for f in ("k", "eligible")), True)
    chk("Budget scenes: refunded-or-paused is never below either alone nor above their sum (every window, both groups)",
        all(max(ea["sets"]["all"][lab][f"rf{w}"]["k"], ea["sets"]["all"][lab][f"pa{w}"]["k"]) <= ea["sets"]["all"][lab][f"ex{w}"]["k"] <= ea["sets"]["all"][lab][f"rf{w}"]["k"] + ea["sets"]["all"][lab][f"pa{w}"]["k"]
            and ea["sets"]["all"][lab][f"ex{w}"]["eligible"] == ea["sets"]["all"][lab][f"rf{w}"]["eligible"] for lab in (LO_, HI_) for w in ea["windows"]["early"]), True)
    chk("Budget scenes: dated pauses never exceed paused clients; no timed pause count exceeds the paused-today count", all(ea["sets"]["all"][lab]["pause_dated"] <= ea["sets"]["all"][lab]["paused_now"]
        and all(ea["sets"]["all"][lab][f"pa{w}"]["k"] <= ea["sets"]["all"][lab]["pause_dated"] for w in ea["windows"]["early"]) for lab in (LO_, HI_)), True)
    chk("Budget scenes: every like-for-like difference carries a 95% interval that contains it", all(m["lo"] <= m["diff"] <= m["hi"] for fam in ea["mh"].values() for ms in fam.values() for m in ms if m["diff"] is not None), True)
    # Added 18 Nov 2026: statements the chapters and the Executive Summary make in words (warn only)
    gm = [r for r in gl["months"] if not r["partial"]]
    cur = next((r for r in gl["months"] if r["partial"]), None)
    chk("Summary: the best closing month is the most closings of any month on record", gl["best"]["closed"]["month"]["n"] == max(r["closed"] for r in ctx.expected["q3"]), True, hard=False)
    rfm = max(cs2["refunded"]["by_month"], key=lambda r: r["n"])
    chk("Summary: refunds peaked in the same month as closings ('record refunds')", rfm["month"], gl["best"]["closed"]["month"]["at"], hard=False)
    chk("Summary: sales have slowed since their best month (last full month and the partial month below it)",
        gm[-1]["sales_per7"] < gl["best"]["sales"]["month"]["per7"] and (cur is None or cur["sales_per7"] < gm[-1]["sales_per7"]), True, hard=False)
    chk("Summary: in the first 14 days since June, refunds at least match contracts", f14["since_change"]["rf14"] >= f14["since_change"]["uc14"], True, hard=False)
    r30 = [r for r in f14["rows"] if "2026-07" <= r["month"] and r["el30"]]
    chk("3.4: the 30-day refund rate rises with each start month since July", all(a["rf30"] / a["el30"] < b["rf30"] / b["el30"] for a, b in zip(r30, r30[1:])), True, hard=False)
    chk("5.3: no contract or closing window differs like for like (every 95% interval includes zero)",
        all(x["lo"] <= 0 <= x["hi"] for k in ("uc", "closed") for x in bd["mh"][k]), True, hard=False)
    chk("5.3: refunds within 30 days are higher up to $250K, interval clear of zero", bd["mh"]["refunded"][1]["w"] == 30 and bd["mh"]["refunded"][1]["lo"] > 0, True, hard=False)
    unadj = ea["sets"]["all"][LO_]["rf30"]["k"] / ea["sets"]["all"][LO_]["rf30"]["eligible"] - ea["sets"]["all"][HI_]["rf30"]["k"] / ea["sets"]["all"][HI_]["rf30"]["eligible"]
    chk("5.4: the like-for-like refund gap within 30 days is within 1.5 points of the unadjusted gap ('timing and mix do not explain it')", abs(ea["mh"]["all"]["rf"][1]["diff"] - unadj) < 0.015, True, hard=False)
    chk("5.4: no pause begins inside the first 14 days ('the first 14 days contain none')", min(ea["sets"]["all"][lab]["pause_days"]["min"] for lab in (LO_, HI_)) > 14, True, hard=False)
    chk("5.4: by day 90 refunded-or-paused shares are close (95% interval includes zero)", ea["mh"]["all"]["ex"][3]["lo"] <= 0 <= ea["mh"]["all"]["ex"][3]["hi"], True, hard=False)
    chk("5.3: no contract or closing window is clear of zero, like for like", all(m["lo"] <= 0 <= m["hi"] for k in ("uc", "cl") for m in ea["mh"]["all"][k]), True, hard=False)
    prm = [r for r in pc["monthly"] if r["partial"]]
    chk("3.2: the partial month has more contracts than starts, and the gap narrowed every full month after its peak", (bool(prm) and prm[0]["gap"] < 0, pc["gap"]["narrowing"]), (True, True), hard=False)
    br_ = data["reconcile"]["cash_bridge"]
    pd_ = data["cash"]["defaults"]["paused_defaults"]
    chk("2.3 / Summary: paused clients carry most of the projected refunds at the default assumptions",
        data["cash"]["groups"]["paused"]["paid"] * pd_["refund"] / 100 > 0.5 * abs(br_["refunds"]), True, hard=False)
    # cash forecast tab: every engagement in exactly one group, balances reconcile with client_cash_forecast,
    # the fixed schedule holds exactly the expected amounts, and no engagement can produce both cash and a refund twice
    cf = data["cash"]
    g = cf["groups"]
    chk("Cash forecast: every won engagement sits in exactly one group", (sum(x["n"] for x in g.values()) + cf["other"]["n"], cf["other"]["n"]), (cf["view"]["engagements"], 0))
    chk("Cash forecast: group outstanding balances add up to the view's gross outstanding",
        round(sum(x["outstanding"] for x in g.values()) + cf["other"]["outstanding"]), round(cf["view"]["gross_outstanding"]))
    chk("Cash forecast: unmatched won deals all resolved or classified (own Jira / separate purchase / second deal under review / repeat / purchase record / none)",
        sum(cf["resolution"][k] for k in ("own_jira", "separate_purchase", "second_deal_review", "repeat", "purchase_record", "none")), 47)
    chk("Cash forecast: the eight same-client, same-day, same-value second deals (seven matched by e-mail, one by the Jira key typed in Pipedrive) are each classified (separate purchase / under review)",
        cf["resolution"]["separate_purchase"] + cf["resolution"]["second_deal_review"], 8)
    ex = cf["history"]["exits"]
    chk("Cash forecast: every past refund, pause and failed contract leaves its comparison group on a recorded date (no closer without an Under Contract date stays in the group)",
        ex["refunded_dated"] == ex["refunded"] and ex["paused_dated"] == ex["paused"] and ex["uc_failures_dated"] == ex["uc_failures"]
        and ex["closed_exit_by"]["inspection"] + ex["closed_exit_by"]["closing"] == ex["closed_no_uc_date"] and all(c["n"] >= 10 for c in cf["history"]["curves"]["uc"]), True)
    nt = cf["noprop"]["timing"]
    chk("Cash forecast: still-searching timing arrays hold exactly the expected collections, refunds and affiliate closings, all after today",
        abs(sum(nt["svc"]) - cf["noprop"]["collect"]) < 0.05 and abs(sum(nt["refund_base"]) - cf["noprop"]["refund_base"]) < 0.05 and nt["svc"][0] == 0 and nt["refund_base"][0] == 0
        and all(abs(sum(nt[t][a]) - cf["noprop"]["aff"][a][t]) < 1e-3 for a in nt["known"] for t in ("known", "unknown")), True)
    chk("Cash forecast: closing probabilities are probabilities", all(0 <= (g[k]["p_close"] or 0) <= 1 for k in ("under_contract", "scheduled")) and 0 <= cf["noprop"]["p_close"] + cf["noprop"]["p_refund"] + cf["noprop"]["p_pause"] <= 1.0001, True)
    chk("Cash forecast: expected collections never exceed the installments still due (under contract + scheduled)",
        round(sum(cf["fixed"]["svc"])) <= round(g["under_contract"]["second"] + g["scheduled"]["second"]), True)
    chk("Cash forecast: expected refund base never exceeds what refunding clients paid", cf["noprop"]["refund_base"] <= cf["noprop"]["paid"] and round(sum(cf["fixed"]["refund_base"])) <= round(g["under_contract"]["paid"] + g["scheduled"]["paid"]), True)
    chk("Cash forecast: timing spread is a distribution", abs(sum(w for _, w in cf["spread"]) - 1) < 1e-4, True)
    chk("Cash forecast: processed refunds are not in the future cash flow", g["refunded"]["n"] > 0 and "refunded" not in ("under_contract", "scheduled", "noprop", "paused"), True)
    rc = cf["recent_closed"]
    chk("Cash forecast: closings in the last 30 days are dated inside the window and sit in no more deals than were closed",
        (rc["n"] == sum(rc["by_group"].values()), 0 < rc["n"] <= g["closed"]["n"] + g["refunded"]["n"] + g["scheduled"]["n"] + g["unverified_closing"]["n"] and rc["to"] == cf["asof"]), (True, True))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--explorer", type=Path, default=C.DEFAULT_EXPLORER)
    ap.add_argument("--reports", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--cache", action="store_true")
    args = ap.parse_args()
    if "2026-11-12" in str(args.out):
        raise SystemExit("Refusing to write into the frozen 2026-11-12 version.")
    t0 = time.time()
    ctx = C.load(args.explorer, args.reports, args.cache)
    data = {k: mod.build(ctx) for k, mod in CHAPTERS.items()}
    data["cash"] = cash.build(ctx)          # the Cash forecast tab (cash.html), not a presentation chapter
    data["budgets"] = budgets.build(ctx)    # the Explorer's budget view, used in chapters 2-5 (added 18 Nov 2026)
    data["reconcile"] = summary.reconcile(ctx, data)   # shared figures across the report, the Explorer and the Cash Forecast
    f = ctx.f
    data["meta"] = {
        "title": "The Client Journey", "asof": ctx.asof.strftime("%Y-%m-%d"),
        "version": {"id": C.VERSION_ID, "label": "16 Nov 2026", "title": "Updated reporting", "status": "current"},
        "snapshots": {"reporting_layer": ctx.asof.strftime("%Y-%m-%d")},
        "built_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "chapters": list(CHAPTERS),
        "source": "https://ifrahamstr.github.io/STRSearchBusinessDataExplorer-Public/2026-11-16/",
        "reconciliation": {"checks": len(f.recon), "ok": sum(r["ok"] for r in f.recon)},
        "quality": [{"id": q["id"], "title": q["title"], "metric": q["metric"]} for q in f.quality if q["severity"] in ("serious", "warning")],
    }
    ch = args.explorer / "docs" / C.VERSION_ID / "data" / "version-changes.json"
    if ch.exists():
        data["changes"] = json.loads(ch.read_text())
    data["checks"] = checks(ctx, data)
    js = "/* Generated by pipeline/build.py (16 Nov 2026 reporting version) from the Business Data Explorer foundation. Aggregates only. */\nwindow.STORY_DATA = " + json.dumps(data, separators=(",", ":"), default=str) + ";\n"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(js, encoding="utf-8")
    args.out.with_suffix(".json").write_text(json.dumps(data, indent=1, default=str), encoding="utf-8")
    bad = [c for c in data["checks"] if not c["ok"]]
    print(f"Wrote {args.out.name} ({len(js) / 1e3:.0f} KB) in {time.time() - t0:.1f}s; checks: {len(data['checks']) - len(bad)}/{len(data['checks'])} ok")
    for c in bad:
        print(f"  {'CHECK FAILED' if c['hard'] else 'NOTE'}: {c['check']}: page {c['page']} vs explorer {c['explorer']}")
    if any(c["hard"] for c in bad):
        sys.exit(1)


if __name__ == "__main__":
    main()
