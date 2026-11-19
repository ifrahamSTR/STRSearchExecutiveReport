"""Chapter 7: do clients come back for another property? (16 Nov 2026 reporting version, added 18 Nov 2026)

Unique clients, not records:
  Jira       signed-up issues grouped by client: issues sharing a Pipedrive person id or primary e-mail (12 Nov extract;
             records.people). A completed purchase is records.purchased (status first). Actively pursuing = an issue now
             hunting or under contract; the purchase it pursues is the client's completed purchases + 1.
  Pipedrive  won engagements grouped by client: the deal's e-mail (12 Nov Pipedrive extract), the Jira issue it links to
             and that issue's client. Repeat deals without a Jira issue of their own come from the Cash Forecast
             reconciliation (cash.resolve): confirmed repeat purchases ("the client's only Jira issue tracks their other won
             deal") and second deals under review (same client, won date and value as a Jira-linked deal, no engagement of
             their own) stay separate, as there.
STR Cribs on repeat purchases: the client's recorded designer choice in Jira (designer_used: "STR Cribs", "Other
Designer", "Other Designer-Bought Turnkey" or blank), the field the Cash Forecast treats as the recorded partner choice. It
records a selection, not a paid project. Supporting evidence of use: the Cribs tracker (Cribs_Data, 12 Nov package), a
Cribs deal at the purchase address in stage "Handed off to PM". The tracker's own Jira join (Internal_Data) is not used: it
attaches one Cribs deal to 1,009 different Jira issues.
"""
from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd

import core as C
from chapters import cash
from chapters import records as R

CRIBS_FILE, CRIBS_SHEET = "Cribs Affiliate Tracking.xlsx", "Cribs_Data"
STAGE_RANK = {"Handed off to PM": 5, "Pending deposit ": 4, "Pending contract": 4, "Pending documents (MP,IR,Intake)": 3, "Hot leads!": 2, "Cold/Lost leads": 1}
DESIGNER = {"STR Cribs": "cribs", "Other Designer": "other", "Other Designer-Bought Turnkey": "turnkey"}


def _hash(s):
    return None if s is None or pd.isna(s) or not str(s).strip() else hashlib.sha256(str(s).strip().lower().encode()).hexdigest()


def _jira_side(ctx, j12):
    s = ctx.signed.copy()
    s["pid"] = R.people(s.key, j12)
    s["done"] = R.purchased(s)
    s["open"] = ~s.done & (s.hunting | s.status.isin(R.UNDER_CONTRACT))
    g = s.groupby("pid")
    P = pd.DataFrame({"n": g.size(), "done": g.done.sum(), "open": g.open.sum()})
    m = P[P.n >= 2]
    cat = np.select([(m.done >= 2) & (m.open == 0), (m.done >= 2) & (m.open > 0), (m.done == 1) & (m.open > 0), (m.done == 1) & (m.open == 0), m.done == 0],
                    ["two_plus", "two_plus_pursuing", "one_pursuing", "one_inactive", "none_completed"], "other")
    pursuing = P[(P.done >= 1) & (P.open > 0)]
    return s, P, {
        "issues": int(len(s)), "clients": int(len(P)), "multi_clients": int(len(m)), "multi_issues": int(m.n.sum()),
        "searches": {str(k): int(v) for k, v in P.n.value_counts().sort_index().items()},
        "two_plus_purchases": int((P.done >= 2).sum()),
        "purchases_dist": {str(k): int(v) for k, v in P.done[P.done >= 2].value_counts().sort_index().items()},
        "pursuing": int(len(pursuing)),
        "pursuing_by_purchase": {str(k): int(v) for k, v in (pursuing.done + 1).value_counts().sort_index().items()},
        "pursuing_status": {"hunting": int(s[s.open & s.pid.isin(pursuing.index)].hunting.sum()),
                            "under_contract": int((s.open & s.pid.isin(pursuing.index) & s.status.isin(R.UNDER_CONTRACT)).sum())},
        "categories": {k: int((cat == k).sum()) for k in ["two_plus", "two_plus_pursuing", "one_pursuing", "one_inactive", "none_completed", "other"]},
        "not_in_12nov_extract": int((~s.key.isin(j12.index)).sum()),
    }


def deal_people(ctx, j12, jira_pid):
    """Won engagements with their resolved status (cash.resolve) and a client id linking deals that share an e-mail, a Jira
    issue or that issue's client (jira_pid: Jira key -> client id from records.people)."""
    e = ctx.f.eng.copy()
    status, evidence, rc = cash.resolve(ctx, e)
    _, d12 = cash._old_package(ctx.explorer)
    mail = d12.assign(i=pd.to_numeric(d12.Deal_ID, errors="coerce")).dropna(subset=["i"]).drop_duplicates("i").set_index("i").pd_primary_email.map(_hash)
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    for i, k in zip(e.id, e.jira_key):
        find("d%d" % i)
        m = mail.get(i)
        if isinstance(m, str):
            union("d%d" % i, "e" + m)
        if isinstance(k, str):
            union("d%d" % i, "k" + k)
            if k in jira_pid.index:
                union("k" + k, "p" + jira_pid[k])
    e["pid"] = [find("d%d" % i) for i in e.id]
    e["rs"], e["evidence"] = status, evidence
    return e, rc


def _pipedrive_side(ctx, j12, jira_pid):
    e, rc = deal_people(ctx, j12, jira_pid)
    n = e.groupby("pid").size()
    rep = e[e.pid.map(n) >= 2]
    rr, sd = e[e.rs == "UNRESOLVED_REPEAT"], e[e.rs == "SECOND_DEAL_REVIEW"]
    either = e[e.rs.isin(["UNRESOLVED_REPEAT", "SECOND_DEAL_REVIEW"])]
    return {
        "deals": int(len(e)), "clients": int(len(n)), "repeat_clients": int((n >= 2).sum()), "repeat_client_deals": int(len(rep)),
        "deals_beyond_first": int(len(rep) - (n >= 2).sum()),
        "won_deals_dist": {str(k): int(v) for k, v in n[n >= 2].value_counts().sort_index().items()},
        "no_own_jira": {"confirmed_repeat": {"deals": int(len(rr)), "clients": int(rr.pid.nunique()), "won_2026": int((rr.won_date.dt.year == 2026).sum())},
                        "second_deal_review": {"deals": int(len(sd)), "clients": int(sd.pid.nunique()), "won_2026": int((sd.won_date.dt.year == 2026).sum())},
                        "either": {"deals": int(len(either)), "clients": int(either.pid.nunique())},
                        "both": int(len(set(rr.pid) & set(sd.pid)))},
        "within_repeat_clients": bool(either.pid.isin(rep.pid).all()),   # every deal without its own Jira issue belongs to a client with 2+ won deals
        "reporting_flag": {"deals": int(e.repeat_client.sum()), "in_repeat_clients": int(rep.repeat_client.sum())},
        "resolution": {k: int(v) for k, v in rc.items() if k in ("repeat", "second_deal_review", "separate_purchase", "own_jira")},
    }


def cribs_stages():
    """Cribs tracker (Cribs_Data): the most advanced Cribs deal stage at each property address (cash._addr key)."""
    tr = cash._sheet(C.ROOT.parent, CRIBS_FILE, CRIBS_SHEET)
    return tr.assign(ak=tr.Address.map(cash._addr), rk=tr["Deal Stage"].map(STAGE_RANK)).dropna(subset=["ak"]) \
        .sort_values("rk").drop_duplicates("ak", keep="last").set_index("ak")["Deal Stage"]


def _cribs(ctx, s):
    """Designer choice on each completed purchase of clients with two or more purchases, in purchase order."""
    raw = ctx.f.frames["jira"].assign(key=lambda f: f["key"].astype(str).str.upper()).set_index("key")
    d = s[s.done].copy()
    d["designer"] = d.key.map(raw["designer_used"]).map(DESIGNER).fillna("unknown")
    d["addr"] = d.key.map(raw["address_under_contract"]).map(cash._addr)
    d["order"] = d.closed.fillna(d.start).fillna(d.created)
    d = d.sort_values(["pid", "order", "key"])
    d["k"] = d.groupby("pid").cumcount() + 1
    d["np"] = d.pid.map(d.groupby("pid").size())
    r = d[d.np >= 2].copy()
    r["tracker"] = r.addr.map(cribs_stages())
    first, later = r[r.k == 1], r[r.k > 1]
    keys = ["cribs", "other", "turnkey", "unknown"]
    per = r.groupby("pid").apply(lambda g: pd.Series({"first": g.designer.iloc[0], "later_cribs": bool((g.designer.iloc[1:] == "cribs").any()),
                                                      "later_known": bool((g.designer.iloc[1:] != "unknown").any())}), include_groups=False)
    fc = per["first"] == "cribs"
    allp = d.assign(y=d.order.dt.year)
    return {
        "clients": int(len(per)), "purchases": int(len(r)), "first_purchases": int(len(first)), "later_purchases": int(len(later)),
        "first": {k: int((first.designer == k).sum()) for k in keys}, "later": {k: int((later.designer == k).sum()) for k in keys},
        "clients_first_cribs": int(fc.sum()), "clients_later_cribs": int(per.later_cribs.sum()), "clients_both": int((fc & per.later_cribs).sum()),
        "clients_first_cribs_not_later": int((fc & ~per.later_cribs & per.later_known).sum()),
        "clients_first_cribs_later_unknown": int((fc & ~per.later_known).sum()),
        "clients_later_only": int((~fc & per.later_cribs).sum()), "clients_first_unknown": int((per["first"] == "unknown").sum()),
        "clients_first_other": int(per["first"].isin(["other", "turnkey"]).sum()),
        "tracker_handed_off": {"first": int((first.tracker == "Handed off to PM").sum()), "later": int((later.tracker == "Handed off to PM").sum())},
        "tracker_any_deal": {"first": int(first.tracker.notna().sum()), "later": int(later.tracker.notna().sum())},
        "all_purchases": {"n": int(len(d)), "cribs": int((d.designer == "cribs").sum()), "unknown": int((d.designer == "unknown").sum()),
                          "unknown_by_year": {str(y): [int((g.designer == "unknown").sum()), int(len(g))] for y, g in allp.groupby("y")}},
    }


def _usage(ctx) -> dict:
    """Clients using STR Cribs (the simple executive view): the recorded designer on every signed-up search that has reached a purchase or a
    contract, by status (records.stage, status first). Same Jira field and mapping as the repeat-purchase view (designer_used); a blank is
    'unknown' (not recorded), never counted as another designer. Searches still hunting, paused or refunded are left out (a designer is
    mostly chosen once a property is found)."""
    s = ctx.signed.copy()
    s["stage"] = R.stage(s)
    raw = ctx.f.frames["jira"].assign(key=lambda f: f["key"].astype(str).str.upper()).set_index("key")
    s["des"] = s.key.map(raw["designer_used"]).map(DESIGNER).fillna("unknown")
    keys = ["cribs", "other", "turnkey", "unknown"]
    row = lambda g: {"n": int(len(g)), **{k: int((g.des == k).sum()) for k in keys}}  # noqa: E731
    p = s[s.stage == "purchased"]
    yr = p.closed.dt.year
    return {"purchased": row(p), "under_contract": row(s[s.stage == "under_contract"]),
            "purchased_by_year": {**{str(int(y)): row(p[yr == y]) for y in sorted(yr.dropna().unique())}, **({"none": row(p[yr.isna()])} if yr.isna().any() else {})},
            "field": "Jira Designer Used"}


def build(ctx: C.Ctx) -> dict:
    j12 = R.jira12(ctx.explorer)
    s, P, jira = _jira_side(ctx, j12)
    pdr = _pipedrive_side(ctx, j12, s.set_index("key").pid)
    return {"jira": jira, "pipedrive": pdr, "cribs": _cribs(ctx, s), "usage": _usage(ctx)}
