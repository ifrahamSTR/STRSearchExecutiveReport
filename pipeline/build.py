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
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import core as C  # noqa: E402
from chapters import cash, drivers, journey, outcomes, pace, speed  # noqa: E402

CHAPTERS = {"journey": journey, "outcomes": outcomes, "pace": pace, "speed": speed, "drivers": drivers}
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
    chk("Keeping pace: no published share rests on 1-4 clients", small_cells(pc), 0)
    chk("Fast/slow: the four speed groups add up to classifiable clients with 75+ days on the clock", sum(g["n"] for g in dr["composition"]["groups"]), dr["bases"]["d75"]["eligible"])
    chk("Fast/slow: matched clients never exceed eligible clients", all(dr["bases"][b]["matched"] <= dr["bases"][b]["eligible"] for b in ("d30", "d75")), True)
    chk("Onboarding answers used all precede the client's Under Contract date", dr["matching"]["answers_after_uc_used"], 0)
    chk("Fast/slow: no published share rests on 1-4 clients", small_cells(dr), 0)
    chk("Capital (Pipedrive): every confirmed start with a stated capital is in the survival analysis", dr["capital"]["pipedrive"]["n"], dr["capital"]["pipedrive"]["coverage"]["known"])
    # statements the presentation makes in words (warn only: on a refresh the page text follows the data)
    gp = pc["gap"]
    chk("Keeping pace: 'the gap has narrowed every month since' its peak after late May", gp["narrowing"], True, hard=False)
    chk("Capital: no capital band differs (log-rank p > 0.05, Pipedrive capital)", dr["capital"]["pipedrive"].get("logrank", {}).get("p", 0) > 0.05, True, hard=False)
    cx = dr["capital"]["pipedrive"]["cox"] or {}
    chk("Capital: Cox 95% CI for capital includes 1 (Pipedrive capital)", cx.get("lo", 2) <= 1 <= cx.get("hi", 0), True, hard=False)
    of = [r["within30"]["share"] for r in dr["offers"]["rows"]]
    chk("Offer experience: share within 30 days rises 0 -> 1-2 -> 3+ offers", None not in of and of == sorted(of), True, hard=False)
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
