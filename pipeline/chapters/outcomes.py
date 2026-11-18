"""Chapter 2: where are our clients today? (16 Nov 2026: Jira-issue grain, reporting-layer flags)

Active = signed-up minus Refunded, Paused and Additional Service; it includes clients who already closed and are in
post-close services. Hunting = the Active clients still searching (Client Start to 8 Weeks). Attainment counts
completed milestones only: closing dates after the data date are scheduled, not closed."""
from __future__ import annotations

import pandas as pd

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


WAIT_BIN, WAIT_CAP = 10, 180            # the hunting-wait strip: 10-day bins, 180+ together
WAIT_BANDS = [(0, 30), (31, 60), (61, 90), (91, 180), (181, 365), (366, 10_000)]
PAUSE_BANDS = [(0, 30), (31, 90), (91, 180), (181, 365), (366, 10_000)]
REFUND_BANDS = [(0, 14), (15, 30), (31, 60), (61, 90), (91, 10_000)]
SEARCH = ["Client Start", "2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks"]
RECENT_FROM = "2026-04"                   # hunting waits by start month: April 2026 on, earlier months together


def _bands(v: pd.Series, bands) -> list:
    v = pd.to_numeric(v, errors="coerce").dropna()
    return [{"lo": lo, "hi": hi if hi < 10_000 else None, "n": int(v.between(lo, hi).sum())} for lo, hi in bands]


def status(ctx: C.Ctx) -> dict:
    """Scenes 2.2-2.3 (added 18 Nov 2026): how long hunting clients have waited and where the other clients
    without a current contract or completed purchase stand. Jira-issue grain, status first (records.stage), so every count
    equals scene 2.1. Hunting wait = data date - client start date (the reporting layer's client_start_date); clients without
    a start date are counted, not aged. Pause entry dates and previous statuses come from the 12 Nov 2026 Jira extract
    (latest_status_date / previous_status, data as of 11 Nov); issues opened after it have none."""
    asof, s = ctx.asof, ctx.signed.copy()
    s["stage"] = R.stage(s)
    j12 = R.jira12(ctx.explorer)
    key = s.key.astype(str).str.upper()
    for c in ("previous_status", "latest_status", "latest_status_date"):
        s[c] = key.map(j12[c]).values
    h = s[s.stage == "hunting"]
    age = (asof - h.start).dt.days
    a = age.dropna()
    nostart = h[h.start.isna()]
    why = nostart.pd_status.fillna("No deal link").replace({"lost": "Pipedrive deal lost", "open": "Pipedrive deal still open"}).value_counts()
    hm = h.assign(m=h.start.dt.strftime("%Y-%m"), a=age).dropna(subset=["m"])
    hm["m"] = hm.m.where(hm.m >= RECENT_FROM, "earlier")                       # older start months together (no single-client ages)
    by_month = hm.groupby("m").a.agg(["size", "median"])
    hunting = {
        "n": int(len(h)), "with_start": int(len(a)), "no_start": int(len(nostart)),
        "no_start_why": {k: int(v) for k, v in why.items()},
        "median": float(a.median()), "mean": round(float(a.mean()), 1), "over90": int((a > 90).sum()), "over180": int((a > 180).sum()),
        "within30": int((a <= 30).sum()),
        "bins": {"width": WAIT_BIN, "cap": WAIT_CAP, "counts": [int(((a >= x) & (a < x + WAIT_BIN)).sum()) for x in range(0, WAIT_CAP, WAIT_BIN)],
                 "overflow": int((a >= WAIT_CAP).sum())},
        "bands": _bands(a, WAIT_BANDS),
        "by_status": {st: {"n": int((h.status == st).sum()), "median": float(age[h.status == st].median()) if age[h.status == st].notna().any() else None} for st in SEARCH},
        "by_start_month": [{"month": m, "n": int(r["size"]), "median": float(r["median"])} for m, r in by_month.iterrows()],
        "started_last_90": int((a <= 90).sum()),
        "older_uc_date": int(h.uc.notna().sum()),
        "recorded_median_to_uc": ctx.expected["q1"]["uc"]["median"],
        "past_recorded_median": int((a > ctx.expected["q1"]["uc"]["median"]).sum()),
    }
    p = s[s.stage == "paused"]
    dp = (asof - pd.to_datetime(p.latest_status_date)).dt.days.where(p.latest_status.eq("Paused"))
    prev = p.previous_status.fillna("").str.strip().str.lower()
    from chapters import fallout as FO          # prior contract history: Jira fall-out address / an ended contract (chapter 6's evidence)
    grp = p.key.map(FO.classify(ctx).grp)
    ev = grp.isin(["documented", "ended"])
    long_ = dp > 180
    paused = {
        "n": int(len(p)), "dated": int(dp.notna().sum()), "median_days": float(dp.median()), "bands": _bands(dp, PAUSE_BANDS),
        "from": {"long_search": int(prev.eq("8 weeks").sum()), "earlier_search": int(prev.isin([x.lower() for x in SEARCH[:4]]).sum()),
                 "contract": int(prev.isin(["under contract", "passed inspection"]).sum()),
                 "other": int((~prev.isin([x.lower() for x in SEARCH] + ["under contract", "passed inspection", ""])).sum()), "unknown": int(prev.eq("").sum())},
        "older_uc_date": int(p.uc.notna().sum()),
        "start_year": {str(int(k)): int(v) for k, v in p.start.dt.year.value_counts().sort_index().items()},
        # two separate facts: how long the pause has lasted (pause date) and what the contract history shows (fall-out evidence)
        "over180": int(long_.sum()),
        "prior": {"documented": int((grp == "documented").sum()), "ended": int((grp == "ended").sum()), "evidence": int(ev.sum()),
                  "none": int((~ev).sum())},
        "cross": {"long_evidence": int((long_ & ev).sum()), "long_none": int((long_ & ~ev).sum()),
                  "short_evidence": int((~long_ & dp.notna() & ev).sum()), "short_none": int((~long_ & dp.notna() & ~ev).sum()),
                  "undated_evidence": int((dp.isna() & ev).sum()), "undated_none": int((dp.isna() & ~ev).sum())},
    }
    r = s[s.stage == "refunded"]
    dr = (r.refund_date - r.start).dt.days
    rprev = r.previous_status.fillna("").str.strip()
    by_m = r.refund_date.dt.strftime("%Y-%m").value_counts()
    months = [str(m) for m in pd.period_range("2025-01", asof.strftime("%Y-%m"), freq="M")]
    refunded = {
        "n": int(len(r)), "dated": int(r.refund_date.notna().sum()), "timed": int(dr.notna().sum()), "median_days": float(dr.median()),
        "within14": int(dr.between(0, 14).sum()), "within30": int(dr.between(0, 30).sum()), "bands": _bands(dr, REFUND_BANDS),
        "from_client_start": int(rprev.eq("Client Start").sum()), "prev_unknown": int(rprev.eq("").sum()),
        "by_month": [{"month": m, "n": int(by_m.get(m, 0))} for m in months],
        "before_2025": int((r.refund_date < "2025-01-01").sum()),
    }
    u = s[s.stage == "under_contract"]
    du = (asof - u.uc).dt.days
    uc = {"n": int(len(u)), "scheduled": int(u.closed_scheduled.sum()), "median_days_since": float(du.median()), "over60": int((du > 60).sum()),
          "passed_inspection": int((u.status == "Passed Inspection").sum())}
    ad = s[s.stage == "additional"]
    return {"hunting": hunting, "paused": paused, "refunded": refunded, "under_contract": uc,
            "additional": {"n": int(len(ad)), "after_search": int(ad.previous_status.fillna("").str.strip().isin(SEARCH).sum())},
            "source_12nov": {"asof": "2026-11-11", "missing": int((~key.isin(j12.index)).sum())}}


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
        "status": status(ctx),
    }
