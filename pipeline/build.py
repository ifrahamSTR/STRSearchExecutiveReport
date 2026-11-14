#!/usr/bin/env python3
"""Build the data for "The Client Journey" presentation.

    python pipeline/build.py [--explorer <path to STRSearch-Business-Data-Explorer>] [--reports <Reporting Tables>] [--cache]

All figures come from the Business Data Explorer's validated pipeline (imported, not copied).
Chapter modules reshape them for the visuals; nothing is re-analysed or imputed. Every build
checks the output against the Explorer's own headline metrics and stops on any mismatch.
Output: docs/data/story-data.js (window.STORY_DATA) and docs/data/story-data.json (aggregates only).

Adding a chapter: write pipeline/chapters/<name>.py with build(ctx) -> dict, add it to CHAPTERS,
then add docs/assets/js/chapters/<name>.js and one <script> tag in docs/index.html.
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
from chapters import drivers, journey, outcomes, pace, speed  # noqa: E402

CHAPTERS = {"journey": journey, "outcomes": outcomes, "pace": pace, "speed": speed, "drivers": drivers}
OUT = C.ROOT / "docs" / "data" / "story-data.js"


def small_cells(obj) -> int:
    """Count published {n, k, share} cells whose share rests on fewer than 5 clients (or reveals a suppressed count)."""
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


def checks(ctx: C.Ctx, data: dict) -> list[dict]:
    ex, sp, oc, pc, jn, dr = ctx.expected, data["speed"], data["outcomes"], data["pace"], data["journey"], data["drivers"]
    out = []

    def chk(name, got, want, hard=True):
        out.append({"check": name, "page": got, "explorer": want, "ok": got == want, "hard": hard})

    chk("Days to UC: median / mean / n", (sp["observed"]["uc"]["median"], sp["observed"]["uc"]["mean"], sp["observed"]["uc"]["n"]),
        (ex["q1"]["uc"]["median"], ex["q1"]["uc"]["mean"], ex["q1"]["uc"]["n"]))
    chk("Days to CLOSED: median / mean / n", (sp["observed"]["closed"]["median"], sp["observed"]["closed"]["mean"], sp["observed"]["closed"]["n"]),
        (ex["q1"]["closed"]["median"], ex["q1"]["closed"]["mean"], ex["q1"]["closed"]["n"]))
    chk("Kaplan-Meier curve crosses 50% (UC)", sp["estimate"]["uc"]["check"], ex["q1"]["km_uc_signed"])
    chk("Kaplan-Meier curve crosses 50% (CLOSED)", sp["estimate"]["closed"]["check"], ex["q1"]["km_closed_signed"])
    chk("Histogram bins + overflow = UC n", sum(sp["hist"]["counts"]) + sp["hist"]["overflow"], ex["q1"]["uc"]["n"])
    chk("Active status groups add up to Active", sum(g["n"] for g in oc["active_groups"]), ex["jira"]["active"])
    chk("Inactive statuses add up to Inactive", sum(i["n"] for i in oc["inactive_statuses"]), ex["jira"]["inactive"])
    chk("Active + Inactive = signed-up", oc["active"] + oc["inactive"], ex["jira"]["signed"])
    chk("Active clients with UC / CLOSED recorded", (oc["attainment"]["uc"], oc["attainment"]["closed"]), (ex["q2"]["active_uc"], ex["q2"]["active_closed"]))
    q3 = {r["month"]: r for r in ex["q3"]}
    chk("Monthly rows that differ from the Explorer", sum(1 for r in pc["monthly"] if (r["new"], r["uc"], r["closed"]) != (q3[r["month"]]["new_signed_start"], q3[r["month"]]["uc"], q3[r["month"]]["closed"])), 0)
    chk("Jira intake: signed + pre-sale + declined = the Explorer's new Jira issues (all statuses), months that differ",
        sum(1 for r in pc["intake"]["monthly"] if r["signed"] + r["presale"] + r["declined"] != q3[r["month"]]["new_all_created"]), 0)
    ca = pc["intake"]["classes_all"]
    chk("Jira intake classes cover every issue: signed = signed-up list, pre-sale + declined = records outside it",
        (ca["signed"], ca["presale"] + ca["declined"]), (ex["jira"]["signed"], ex["jira"]["unmapped"]))
    chk("Same-cohort view: start months whose size differs from the Explorer's signed starts",
        sum(1 for c in pc["cohort"]["rows"] if c["n"] != q3[c["month"]]["new_signed_start"]), 0)
    chk("Keeping pace: no published share rests on 1-4 clients", small_cells(pc), 0)
    chk("Pre-sale Jira statuses = records outside the signed-up lists", sum(jn["presale"]["statuses"].values()), ex["jira"]["unmapped"])
    chk("Fast/slow: the four speed groups add up to clients with 75+ days on the clock", sum(g["n"] for g in dr["composition"]["groups"]), dr["bases"]["d75"]["eligible"])
    chk("Fast/slow: matched clients never exceed eligible clients", all(dr["bases"][b]["matched"] <= dr["bases"][b]["eligible"] for b in ("d30", "d75")), True)
    ident = dr["matching"]["identifier"]
    chk("Onboarding column AH behaves as a Pipedrive deal id, not a person id (>=95% agreement with e-mail matches)",
        ident["deal"]["agree"] >= 0.95 * (ident["deal"]["agree"] + ident["deal"]["conflict"]) and ident["person"]["agree"] == 0, True)
    chk("Onboarding answers used all precede the client's first Under Contract date", dr["matching"]["answers_after_uc_used"], 0)
    chk("Fast/slow: no published share rests on 1-4 clients", small_cells(dr), 0)
    # statements the presentation makes in words (warn only: on a refresh the page text follows the data)
    chk("Largest 15-day bin is 15-29 days", (sp["hist"]["largest"]["from"], sp["hist"]["largest"]["to"]), (15, 29), hard=False)
    chk("About 71% of recorded UC within 60 days", round(sp["hist"]["within60"]["share"] * 100), 71, hard=False)
    w, co = pc["windows"], pc["cohort"]
    chk("Keeping pace: Jira intake and acquisition starts both rose after late May (five-month averages)",
        w["intake"]["after"] > w["intake"]["before"] and w["starts"]["after"] > w["starts"]["before"], True, hard=False)
    chk("Keeping pace: 'still about N in 10' - starters before and after late May reach UC within 90 days at the same rounded rate",
        co["pooled_before"] is not None and round(co["pooled_before"] * 10) == round(co["pooled_after"] * 10), True, hard=False)
    of = [r["within30"]["share"] for r in dr["offers"]["rows"]]
    chk("Capital: no threshold beats chance (family-wise p > 0.05 on both outcomes)", min(dr["capital"]["family_p"].values()) > 0.05, True, hard=False)
    chk("Offer experience: share within 30 days rises 0 -> 1-2 -> 3+ offers", None not in of and of == sorted(of), True, hard=False)
    chk("Deals seen: slow > middle > fast (medians)", dr["deals"]["groups"]["slow"]["median"] > dr["deals"]["groups"]["middle"]["median"] > dr["deals"]["groups"]["fast"]["median"], True, hard=False)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--explorer", type=Path, default=C.DEFAULT_EXPLORER)
    ap.add_argument("--reports", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--cache", action="store_true")
    args = ap.parse_args()
    t0 = time.time()
    ctx = C.load(args.explorer, args.reports, args.cache)
    data = {k: mod.build(ctx) for k, mod in CHAPTERS.items()}
    snap = {m["key"]: m["snapshot"] for m in ctx.meta}
    data["meta"] = {
        "title": "The Client Journey", "asof": ctx.asof.strftime("%Y-%m-%d"),
        "snapshots": {"jira": snap["jira"], "pipedrive": snap["deals"]},
        "built_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "chapters": list(CHAPTERS),
        "source": "https://ifrahamstr.github.io/STRSearchBusinessDataExplorer-Public/",
    }
    data["checks"] = checks(ctx, data)
    js = "/* Generated by pipeline/build.py from the Business Data Explorer. Aggregates only. */\nwindow.STORY_DATA = " + json.dumps(data, separators=(",", ":"), default=str) + ";\n"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(js, encoding="utf-8")
    args.out.with_suffix(".json").write_text(json.dumps(data, indent=1, default=str), encoding="utf-8")
    bad = [c for c in data["checks"] if not c["ok"]]
    print(f"Wrote {args.out.name} ({len(js) / 1e3:.0f} KB) in {time.time() - t0:.1f}s; checks: {len(data['checks']) - len(bad)}/{len(data['checks'])} ok")
    for c in bad:
        print(f"  {'CHECK FAILED' if c['hard'] else 'NOTE'}: {c['check']}: page {c['page']} vs explorer/brief {c['explorer']}")
    if any(c["hard"] for c in bad):
        sys.exit(1)


if __name__ == "__main__":
    main()
