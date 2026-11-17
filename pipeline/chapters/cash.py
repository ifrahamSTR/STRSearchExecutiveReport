"""Cash forecast tab (16 Nov 2026 reporting version): evidence-based inputs for the interactive cash-flow dashboard.

Sources, all read-only and published only as aggregates:
  - reporting layer (16 Nov): won_clients_master + client_cash_forecast (modeled contractual cash: Paid In Full at
    the win; Split Pay 50% at the win, 50% at property close), jira_reporting_base (status, milestones, partner use)
  - 12 Nov package: Jira and Pipedrive extracts (client e-mails, deal names) to resolve won deals without a Jira match;
    affiliate tracking (brokerage referral fees, lender commissions, construction/Cribs fees, Affiliates_Historical)
  - onboarding questionnaire, both sheets (e-mails), as supporting evidence that an unmatched deal onboarded

Every won engagement lands in exactly one group:
  under_contract      collect the 2nd installment at closing with the historical probability of closing for a client
                      who has waited as long (UC -> CLOSED), timed by the remaining historical durations
  scheduled           closing dated after the reporting date: same closing probability, collected on that date
  noprop              hunting or won-but-not-started: historical outcome shares for clients without a contract after
                      the same number of days (close / refund / pause); closings timed by the remaining days to closing of
                      past clients still searching after as many days, refunds by the remaining days of past refunds (Batch 4D)
  paused              paused or additional service: three slider shares (resume and close / full refund / remain paused),
                      timed by the dashboard's expected-days slider with the historical UC -> CLOSED spread around it
  refunded            marked Refunded in Jira: refund assumed already paid back (historical); no future flows
  closed              closing recorded on or before the reporting date (incl. dates found in affiliate records):
                      2nd installment assumed collected at closing, as the reporting layer models it
  unverified_*        balances the data cannot resolve (shown with the missing information, not forecast)
  second_deal_review  same client, won date and value as a Jira-linked won deal, but no engagement of its own and no payment record: a second
                      search not yet started or a record entered twice. Excluded (conservative) and flagged for review
Projected refunds (future only) = clients assumed to refund x refund-size slider x upfront payment (first installment for
Split Pay, the full price for Paid In Full); their unpaid second installment is not collected. Affiliate revenue uses each client's recorded partner choice where Jira has
one (preferred = earns, other / cash / turnkey = does not) and the conversion slider only where it has none.
"""
from __future__ import annotations

import functools
import hashlib
import importlib.util
import re
import sys
import warnings

import numpy as np
import pandas as pd

import core as C

HORIZON = 420
EXPECTED_DAYS_MAX = 77                 # agreed default maximum of the expected-days slider (pessimistic case)
EXPECTED_DAYS = 57                     # default slider position: halfway between optimistic (day 37) and 77
PAUSED_PROCEED = 0.10                  # default paused outcome shares (Batch 4D): resume and close / full refund / remain paused
PAUSED_DEFAULTS = {"resume": 10, "refund": 40, "remain": 50}
REFUNDABLE_SHARE = 1.0                 # default refund size for FUTURE refunds: share of the upfront payment returned (slider 0-100%)
AFFILIATES = {"realtor": {"label": "Realtor", "conv": 0.93, "rev": 4000},
              "lender": {"label": "Lender", "conv": 0.70, "rev": 1400},
              "cribs": {"label": "STR Cribs", "conv": 0.70, "rev": 2500}}
POST_CLOSE = ["CLOSED", "Photography Shared", "Listed", "Content Pulled"]
MIN_TAIL = 10
MATURE_UC_DAYS, MATURE_START_DAYS = 120, 365
R12 = "12 Nov 26 Reports/DataDrive/Reporting Tables"
ONBOARDING = "12 Nov 26 Reports/DataDrive/Onboarding STR Search (Responses).xlsx"


# ----------------------------------------------------------------------------- helpers
def _h(s):
    return None if s is None or pd.isna(s) or not str(s).strip() else hashlib.sha256(str(s).strip().lower().encode()).hexdigest()


def _addr(s):
    return None if s is None or pd.isna(s) else (re.sub(r"[^a-z0-9]", "", str(s).lower())[:18] or None)


def _name(s):
    return None if s is None or pd.isna(s) else re.sub(r"\s+", " ", re.sub(r"[^a-z ]", " ", str(s).lower())).strip()


def _residual(history: np.ndarray, elapsed: int) -> np.ndarray:
    tail = history[history > elapsed]
    if len(tail) < MIN_TAIL:
        tail = np.sort(history)[-MIN_TAIL:]
    return np.maximum(tail - elapsed, 1)


@functools.lru_cache(maxsize=2)
def _old_package(explorer):
    """12 Nov Jira and Pipedrive extracts through the Explorer's frozen loader (cache only; nothing is written)."""
    path = explorer / "versions" / "2026-11-12" / "pipeline" / "build.py"
    spec = importlib.util.spec_from_file_location("explorer_build_20261112_cash", path)
    mod = importlib.util.module_from_spec(spec)
    saved = {k: sys.modules.pop(k) for k in ("definitions", "metrics", "quality") if k in sys.modules}
    spec.loader.exec_module(mod)
    frames, _ = mod.load_sources(mod.DEFAULT_REPORTS, True)
    for k in ("definitions", "metrics", "quality"):
        sys.modules.pop(k, None)
    sys.modules.update(saved)
    return frames["jira"], frames["deals"]


def _sheet(base, file, sheet):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return pd.read_excel(base / R12 / file, sheet_name=sheet)


# ----------------------------------------------------------------------------- same-client, same-day, same-value second deals
_SECOND_DEAL = re.compile(r"(#\s*\d|\bdeal\s*\d|\b2nd\b|\bsecond\b|\(\s*2\s*\))", re.I)


def _second_deal_verdict(did, d12i, key_of_deal, j12k):
    """What is a second won deal that shares a Jira-linked deal's client, won date and value?
    Matching client, date and value is NOT proof of a duplicate: a client who buys two searches together produces exactly this
    (13 of the 14 same-client pairs won within a minute are named as a second deal, e.g. "Deal 2", and in 6 of them both deals have their own
    Jira issue). The evidence that settles a case is an engagement of its own:
      separate : the deal's Pipedrive 'JIRA Issue ID' exists in the 12 Nov Jira extract, or a Jira issue names this deal in PD_Deal_ID.
                 It is a second purchase; its balance is forecast by that issue's status.
      review   : no engagement of its own and no payment records to settle it (a second search not yet started, or a record entered twice).
                 Stays excluded from the forecast (the conservative treatment) and is flagged for review.
    No case is called a confirmed duplicate without positive evidence of a single purchase, and none has it.
    Returns (verdict, Jira key or None, reason)."""
    d = d12i.loc[did]
    typed = d.get("JIRA Issue ID")
    key = str(typed).strip().upper() if pd.notna(typed) and str(typed).strip() else None
    if key not in j12k.index:
        key = key_of_deal.get(int(did))
    if key is not None and key in j12k.index:
        return "separate", key, "has its own Jira issue (Pipedrive key / Jira deal id) under a different e-mail"
    named = bool(_SECOND_DEAL.search(str(d.get("Deal_Name"))))
    return "review", None, ("recorded as a second deal" if named else "same name as the other deal, no second-deal label") + "; no engagement of its own yet"


# ----------------------------------------------------------------------------- evidence for uncertain engagements
def resolve(ctx: C.Ctx, e: pd.DataFrame) -> tuple[pd.Series, pd.Series, dict]:
    """Resolve won deals without a Jira match and post-close records without a closing date.
    Returns (resolved status per engagement, evidence label per engagement, summary counts)."""
    base = C.ROOT.parent
    j12, d12 = _old_package(ctx.explorer)
    jira16 = ctx.f.jira.set_index("key")
    key_by_hash = {}
    for k, e1, ex in zip(j12["key"].astype(str).str.upper(), j12["Client_Email"], j12["Additional_Emails"].astype("string").fillna("")):
        for x in {_h(e1)} | {_h(t) for t in re.split(r"[,;\s]+", str(ex)) if "@" in t}:
            if x:
                key_by_hash.setdefault(x, set()).add(k)
    deal_hash = {int(i): _h(m) for i, m in zip(d12["Deal_ID"], d12["pd_primary_email"])}
    deal_name = {int(i): _name(n) for i, n in zip(d12["Deal_ID"], d12["Deal_Name"])}
    brk = _sheet(base, "Brokerage Affiliate Tracking.xlsx", "Brokerage_Data")
    lend = _sheet(base, "Lending Affiliate Tracking.xlsx", "Lender_Data")
    rev = _sheet(base, "DIM - JIRA Client Data.xlsx", "All_Affiliate_Revenue")
    names = {"brokerage": set(brk["Referred Client"].map(_name).dropna()), "lender": set(lend["Borrower Name"].map(_name).dropna())}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        f1 = pd.read_excel(base / ONBOARDING, sheet_name="Form Responses 1")
        f2 = pd.read_excel(base / ONBOARDING, sheet_name="Form Responses 2")
    form_hash = set(f1.iloc[:, 3].map(_h)) | set(f1.iloc[:, 32].map(_h)) | set(f2.iloc[:, 3].map(_h)) | set(f2.iloc[:, 4].map(_h))

    def name_hit(nm, pool):
        if not nm:
            return False
        t = [w for w in nm.split() if w not in ("deal", "search", "str", "and", "the", "llc", "core", "complete")]
        return len(t) >= 2 and any(t[0] in p.split() and t[-1] in p.split() for p in pool)

    status = pd.Series(e.status.values, index=e.index, dtype="object")
    evidence = pd.Series("Jira match (reporting layer)", index=e.index, dtype="object")
    linked = e[e.has_jira].set_index("jira_key")
    counts = {"own_jira": 0, "separate_purchase": 0, "second_deal_review": 0, "repeat": 0, "purchase_record": 0, "none": 0, "onboarded": 0}
    d12i = d12.set_index("Deal_ID")
    j12k = j12.set_index(j12["key"].astype(str).str.upper())
    typed_key = {int(i): str(k).strip().upper() for i, k in zip(d12["Deal_ID"], d12["JIRA Issue ID"]) if pd.notna(k) and str(k).strip()}   # Jira key typed in Pipedrive
    pdid = pd.to_numeric(j12["PD_Deal_ID"], errors="coerce")
    key_of_deal = {int(v): k for v, k in zip(pdid, j12["key"].astype(str).str.upper()) if pd.notna(v)}
    for i, r in e[~e.has_jira].iterrows():
        hsh = deal_hash.get(int(r.id))
        keys = sorted(key_by_hash.get(hsh, set())) if hsh else []
        counts["onboarded"] += int(hsh in form_hash) if hsh else 0
        own = [k for k in keys if k not in linked.index and k in jira16.index]
        shared = [k for k in keys if k in linked.index]
        if own:
            # several issues for one e-mail: take the most advanced status (a signed client over a pre-sale record)
            rank = {s: m["order"] for s, m in ctx.D.STATUS_META.items()}
            k = max(own, key=lambda x: (jira16.signed[x], rank.get(jira16.status[x], 0)))
            cr = jira16.closed_raw[k]
            if pd.notna(cr) and cr <= ctx.asof:
                status[i], evidence[i] = "CLOSED_EVIDENCED", "closing recorded on its own Jira issue (matched by e-mail)"
            else:
                status[i], evidence[i] = jira16.status[k], "e-mail matches its own Jira issue (12 Nov extract)"
            counts["own_jira"] += 1
        elif shared:
            o = linked.loc[shared[0]]
            if r.won_date == o.won_date and r.value == o.value:
                verdict, k, why = _second_deal_verdict(int(r.id), d12i, key_of_deal, j12k)
                if verdict == "separate":
                    status[i], evidence[i] = str(j12k.loc[k, "Issue_Status"]), "separate purchase: " + why
                    counts["separate_purchase"] += 1
                else:
                    status[i], evidence[i] = "SECOND_DEAL_REVIEW", "second deal under review: " + why
                    counts["second_deal_review"] += 1
            else:
                status[i], evidence[i] = "UNRESOLVED_REPEAT", "repeat purchase: the client's only Jira issue tracks their other won deal"
                counts["repeat"] += 1
        elif name_hit(deal_name.get(int(r.id)), names["brokerage"]) or name_hit(deal_name.get(int(r.id)), names["lender"]):
            status[i], evidence[i] = "CLOSED_EVIDENCED", "client found in brokerage or lender closing records"
            counts["purchase_record"] += 1
        elif typed_key.get(int(r.id)) in linked.index:
            # no e-mail match, but the Jira key typed in Pipedrive names the issue that tracks another won deal: the same checks as for
            # an e-mail match apply (same won date and value = second deal under review; otherwise a repeat purchase). Only deals that
            # would otherwise be unresolved reach this branch, so no closing evidence is overridden.
            o = linked.loc[typed_key[int(r.id)]]
            if r.won_date == o.won_date and r.value == o.value:
                status[i], evidence[i] = "SECOND_DEAL_REVIEW", "second deal under review: the Jira key typed in Pipedrive names the other deal's issue (same won date and value); no engagement of its own yet"
                counts["second_deal_review"] += 1
            else:
                status[i], evidence[i] = "UNRESOLVED_REPEAT", "repeat purchase: the Jira key typed in Pipedrive names the issue that tracks the client's other won deal"
                counts["repeat"] += 1
        else:
            status[i], evidence[i] = "UNRESOLVED_NONE", "no Jira issue, e-mail, or purchase record found"
            counts["none"] += 1
    # post-close records without a closing date: dated closing evidence in the affiliate records (by property address)
    raw = ctx.f.frames["jira"].set_index(ctx.f.frames["jira"]["key"].astype(str).str.upper())
    closed_addr = set(rev["address"].map(_addr).dropna()) | set(rev["address_clean"].map(_addr).dropna()) | \
        set(brk["Full address"].map(_addr).dropna()) | set(brk["Property"].map(_addr).dropna()) | \
        set(lend.loc[lend["Funded Date"].notna(), "Subject Property Address"].map(_addr).dropna())
    pc = e[e.has_jira & e.closed_raw.isna() & e.status.isin(POST_CLOSE)]
    counts.update({"post_close_no_date": int(len(pc)), "post_close_evidenced": 0})
    for i, r in pc.iterrows():
        a = _addr(raw["address_under_contract"].get(r.jira_key))
        if a and a in closed_addr:
            status[i], evidence[i] = "CLOSED_EVIDENCED", "closing found in affiliate records by property address"
            counts["post_close_evidenced"] += 1
        else:
            status[i], evidence[i] = "UNRESOLVED_CLOSING", "post-close status, but no closing date or purchase record"
    return status, evidence, counts


# ----------------------------------------------------------------------------- history
def _carry(at_risk, el, values):
    """Outcome values for the clients still at risk at day el. When fewer than MIN_TAIL remain, use the last day that still had
    MIN_TAIL (never the whole cohort: that would put back clients who had already left the group)."""
    m = at_risk(el)
    while len(m) < MIN_TAIL and el > 0:
        el -= 1
        m = at_risk(el)
    return values(m), int(len(m)), el


def history(ctx: C.Ctx, e: pd.DataFrame) -> dict:
    """Historical comparison groups (Batch 4C). A past client counts as still searching (or still under contract) at day el only while
    no exit event has happened by that day and the client has been observed for longer than el:
      still searching: exit at the earliest of the Under Contract, Passed Inspection or closing date (a closing without a Under Contract
                       date is still a closing; no date is invented), the refund date, or the date the client entered Paused /
                       Additional Service (12 Nov extract, latest status)
      under contract:  closers exit at closing; contracts that failed exit at the earliest of the refund date, the pause-entry date or
                       the date the client was next seen in another status (12 Nov extract)
    Outcomes stay mutually exclusive (closed > refunded > paused > still searching). Records whose outcome is unknown (post-close with no
    closing date, still under contract) stay out of the groups, as before."""
    asof = ctx.asof
    h_uc = e.days_uc_to_close.dropna().values
    h_uc = h_uc[h_uc >= 0].astype(int)
    h_pi = (e.closed - e.pi).dt.days.dropna().values
    h_pi = h_pi[h_pi >= 0].astype(int)
    j12, _ = _old_package(ctx.explorer)
    j12 = j12.assign(K=j12["key"].astype(str).str.upper()).drop_duplicates("K").set_index("K")
    co = e[e.confirmed_start].copy()
    ref = co.refunded.fillna(False).astype(bool)
    co["outcome"] = np.select([co.closed.notna(), ref, co.status.isin(["Paused", "Additional Service"]), co.hunting.fillna(False).astype(bool)],
                              ["closed", "refunded", "paused", "hunting"], "unknown")
    k = co.jira_key.astype("string").str.upper()
    ls = k.map(j12.latest_status)
    lsd = pd.to_datetime(k.map(j12.latest_status_date), errors="coerce")
    paused_since = lsd.where(co.outcome.eq("paused") & ls.isin(["Paused", "Additional Service"]))
    refund_on = co.refund_date.where(co.outcome.eq("refunded"))
    seen = (asof - co.start).dt.days

    # (a) probability of closing for a client still unclosed el days after going under contract (mature UC records, outcome known)
    uc = co[co.uc.notna() & ((asof - co.uc).dt.days >= MATURE_UC_DAYS) & (co.outcome != "unknown")]
    left_other = lsd.where(~ls.isin(["Under Contract", "Passed Inspection"] + POST_CLOSE))           # next seen in another status
    fail_t = pd.concat([refund_on, paused_since, left_other], axis=1).min(axis=1).sub(co.uc).dt.days
    uc_exit = uc.days_uc_to_close.where(uc.closed.notna(), fail_t[uc.index])
    uc_seen = (asof - uc.uc).dt.days
    uc_at = lambda el: uc[(uc_exit > el) | (uc_exit.isna() & (uc_seen > el))]
    def p_close_uc(el):
        v, n, _ = _carry(uc_at, el, lambda m: float(m.closed.notna().mean()))
        return v, n
    fail = uc[uc.closed.isna()]
    uc_fail_refund = float((fail.outcome == "refunded").mean()) if len(fail) else 0.0

    # (b) outcome shares for clients without a contract after el days (mature cohorts, outcome known)
    old = co[(seen >= MATURE_START_DAYS) & (co.outcome != "unknown")]
    evidence = pd.concat([old.days_to_uc, (old.pi - old.start).dt.days, old.days_to_close.where(old.outcome.eq("closed"))], axis=1).min(axis=1)
    np_exit = pd.concat([evidence, (refund_on - co.start).dt.days[old.index], (paused_since - co.start).dt.days[old.index]], axis=1).min(axis=1)
    np_at = lambda el: old[(np_exit > el) | (np_exit.isna() & (seen[old.index] > el))]
    def p_noprop(el):
        v, n, _ = _carry(np_at, el, lambda m: {k: float((m.outcome == k).mean()) for k in ("closed", "refunded", "paused", "hunting")})
        return v, n
    # (c) timing for clients still searching (Batch 4D): days from today until the closing or the refund, from past clients
    #     closings: the same comparison group as (b); remaining days = closing day - el for the past closers still in the group at el.
    #               Closings more than a year after the start are seen only for past clients observed that long, so each closing at
    #               day t is weighted by 1 / (share of the group observed for at least t days). Fewer than MIN_TAIL closers left:
    #               the last day with MIN_TAIL is used (its remaining days), as for the outcome shares.
    #     refunds:  every dated refund (outcome refunded) after a confirmed start (refunds come early, so recent starts show them); remaining days =
    #               refund day - el for the refunds made after day el. Fewer than MIN_TAIL later refunds: the last day with MIN_TAIL.
    seen_old = seen[old.index].values
    g_obs = lambda t: float((seen_old >= t).mean())
    closers = old[old.outcome.eq("closed")]
    def close_timing(el):
        e2 = el
        while e2 > 0:
            m = np_at(e2)
            if len(m) >= MIN_TAIL and m.outcome.eq("closed").sum() >= MIN_TAIL:
                break
            e2 -= 1
        c = np_at(e2)
        t = c.loc[c.outcome.eq("closed"), "days_to_close"].values.astype(int)
        w = np.array([1.0 / g_obs(x) for x in t])
        return np.maximum(t - e2, 1), w / w.sum(), e2
    rlag = (refund_on - co.start).dt.days.dropna().values.astype(int)          # outcome refunded (a client who also closed counts as a closing)
    def refund_timing(el):
        e2 = el
        while e2 > 0 and (rlag > e2).sum() < MIN_TAIL:
            e2 -= 1
        t = rlag[rlag > e2]
        return np.maximum(t - e2, 1), np.full(len(t), 1.0 / len(t)), e2
    curve = lambda f, days: [{"day": d, "n": f(d)[1], **({"p_close": round(f(d)[0], 4)} if isinstance(f(d)[0], float)
                                                        else {k: round(x, 4) for k, x in f(d)[0].items()})} for d in days]
    last_np = _carry(np_at, 10_000, lambda m: None)[2]
    exits = {"closed_no_uc_date": int((old.outcome.eq("closed") & old.days_to_uc.isna()).sum()),
             "closed_exit_by": {"uc": int((old.outcome.eq("closed") & old.days_to_uc.notna()).sum()),
                                "inspection": int((old.outcome.eq("closed") & old.days_to_uc.isna() & old.pi.notna()).sum()),
                                "closing": int((old.outcome.eq("closed") & old.days_to_uc.isna() & old.pi.isna()).sum())},
             "refunded_dated": int(refund_on[old.index].notna().sum()), "refunded": int(old.outcome.eq("refunded").sum()),
             "paused_dated": int(paused_since[old.index].notna().sum()), "paused": int(old.outcome.eq("paused").sum()),
             "uc_failures": int(len(fail)), "uc_failures_dated": int(fail_t[fail.index].notna().sum()),
             "last_day_np": int(last_np)}
    timing = {"closers": int(len(closers)), "closers_after_year": int((closers.days_to_close > 365).sum()), "close_median": float(closers.days_to_close.median()),
              "close_p25": float(closers.days_to_close.quantile(.25)), "close_p75": float(closers.days_to_close.quantile(.75)), "close_max": int(closers.days_to_close.max()),
              "close_last_day": int(close_timing(10_000)[2]), "refunds": int(len(rlag)), "refund_median": float(np.median(rlag)),
              "refund_last_day": int(refund_timing(10_000)[2]), "refunds_after_last_day": int((rlag > refund_timing(10_000)[2]).sum())}
    return {"h_uc": h_uc, "h_pi": h_pi, "p_close_uc": p_close_uc, "uc_fail_refund": uc_fail_refund, "p_noprop": p_noprop,
            "uc_n": int(len(uc)), "uc_rate": float(uc.closed.notna().mean()), "old_n": int(len(old)),
            "old_shares": {k: round(float((old.outcome == k).mean()), 3) for k in ("closed", "refunded", "paused", "hunting")},
            "curve_np": curve(p_noprop, (0, 30, 60, 90, 120, 180, 270, 365)), "curve_uc": curve(p_close_uc, (0, 15, 30, 45, 60, 75)),
            "exits": exits, "close_timing": close_timing, "refund_timing": refund_timing, "timing": timing,
            "refund_lag": (co[ref & co.refund_date.notna()].refund_date - co[ref & co.refund_date.notna()].start).dt.days}


# ----------------------------------------------------------------------------- build
def build(ctx: C.Ctx) -> dict:
    asof = ctx.asof
    e = ctx.f.eng.copy()
    jj = ctx.f.jira.set_index("key")
    status, evidence, rc = resolve(ctx, e)
    e["rstatus"], e["evidence"] = status, evidence
    hunt = e.hunting.fillna(False).astype(bool)
    signed = e.signed.fillna(False).astype(bool)
    sched = e.closed_raw.notna() & (e.closed_raw > asof)
    done = e.closed_raw.notna() & (e.closed_raw <= asof)
    rs = e.rstatus
    e["g"] = np.select(
        [rs.eq("SECOND_DEAL_REVIEW"), rs.eq("UNRESOLVED_REPEAT"), rs.eq("UNRESOLVED_NONE"), rs.eq("UNRESOLVED_CLOSING"), rs.eq("CLOSED_EVIDENCED"),
         rs.eq("Refunded"), sched, done, rs.isin(POST_CLOSE), rs.isin(["Under Contract", "Passed Inspection"]),
         rs.isin(["Paused", "Additional Service"]), hunt | rs.isin(["Client Start", "2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks"]),
         (e.has_jira & ~signed) | rs.isin(["New Clients", "Onboarding Completed", "Services Declined"])],
        ["second_deal_review", "unverified_repeat", "unverified_none", "unverified_closing", "closed", "refunded", "scheduled", "closed",
         "unverified_closing", "under_contract", "paused", "noprop", "noprop"], default="other")
    split = e.cash_payment_type_normalized.eq("Split Pay")
    e["second"] = np.where(split, e.cash_second_installment_amount.fillna(0.0), 0.0)               # still due at closing
    e["paid"] = e.cash_assumed_initial_cash_collected.fillna(0.0)                                   # received at the win
    e["out"] = e.cash_outstanding_cash_balance.fillna(0.0)
    H = history(ctx, e)

    # affiliate eligibility from recorded partner choices (Jira): 1 = preferred partner recorded, 0 = other / cash /
    # turnkey recorded, NaN = not recorded (the dashboard's conversion slider applies)
    def elig(row):
        k = row.jira_key
        if not isinstance(k, str) or k not in jj.index:
            return {a: np.nan for a in AFFILIATES}
        r = jj.loc[k]
        return {"realtor": 1.0 if r.agent_pref else (0.0 if r.agent_not_pref else np.nan),
                "lender": 1.0 if r.lender_pref else (0.0 if (r.lender_not_pref or r.lender_cat == "Cash purchase") else np.nan),
                "cribs": 1.0 if r.cribs else (0.0 if (r.cribs_not or r.designer_cat in ("Other designer", "Bought turnkey")) else np.nan)}
    el = pd.DataFrame([elig(r) for r in e.itertuples()], index=e.index)

    def aff_parts(mask, weight):
        """Expected closings with a recorded preferred partner (known) and with no record (unknown), per affiliate."""
        w = weight[mask]
        return {a: {"known": round(float((w * el.loc[mask, a].fillna(0)).sum()), 4),
                    "unknown": round(float((w * el.loc[mask, a].isna()).sum()), 4)} for a in AFFILIATES}

    # ---- fixed timing: under contract (historical residual timing) and scheduled closings (their dates)
    D = HORIZON + 1
    svc_d, ref_d = np.zeros(D), np.zeros(D)
    known_d = {a: np.zeros(D) for a in AFFILIATES}
    unk_d = {a: np.zeros(D) for a in AFFILIATES}
    p_used = {"under_contract": [], "scheduled": []}
    exp = {g: {"svc": 0.0, "refund_base": 0.0, "aff": {a: {"known": 0.0, "unknown": 0.0} for a in AFFILIATES}} for g in p_used}
    for i, r in e[e.g.isin(["under_contract", "scheduled"])].iterrows():
        el_uc = int((asof - r.uc).days) if pd.notna(r.uc) else 0
        p, _ = H["p_close_uc"](el_uc)
        p_used[r.g].append(p)
        exp[r.g]["svc"] += p * r.second
        exp[r.g]["refund_base"] += (1 - p) * H["uc_fail_refund"] * r.paid
        for a in AFFILIATES:
            x = el.at[i, a]
            exp[r.g]["aff"][a]["known" if x == x else "unknown"] += p * (x if x == x else 1.0)
        if r.g == "scheduled":
            days = np.array([int((r.closed_raw - asof).days)])
        elif r.status == "Passed Inspection" and pd.notna(r.pi):
            days = _residual(H["h_pi"], int((asof - r.pi).days))
        else:
            days = _residual(H["h_uc"], el_uc)
        w = 1.0 / len(days)
        for d in days:
            d = int(min(d, HORIZON))
            svc_d[d] += p * r.second * w
            ref_d[d] += (1 - p) * H["uc_fail_refund"] * r.paid * w          # refundable base, x refundable share in the browser
            for a in AFFILIATES:
                x = el.at[i, a]
                (known_d if x == x else unk_d)[a][d] += p * w * (x if x == x else 1.0)
    last = int(max(np.nonzero(svc_d + ref_d + sum(known_d.values()) + sum(unk_d.values()))[0].max(), EXPECTED_DAYS_MAX))

    # ---- slider timing: no property yet (historical outcomes by days without a contract) and paused / additional service
    npm = e.g.eq("noprop")
    el_start = (asof - e.start).dt.days.where(e.start.notna(), 0).clip(lower=0)
    shares = {i: H["p_noprop"](int(el_start[i]))[0] for i in e[npm].index}
    pc = pd.Series({i: s["closed"] for i, s in shares.items()}, dtype=float).reindex(e.index).fillna(0.0)
    pr = pd.Series({i: s["refunded"] for i, s in shares.items()}, dtype=float).reindex(e.index).fillna(0.0)
    pp = pd.Series({i: s["paused"] + s["hunting"] for i, s in shares.items()}, dtype=float).reindex(e.index).fillna(0.0)
    pam = e.g.eq("paused")
    # timing for clients still searching (Batch 4D): each client's expected collection, affiliate closings and refund spread over
    # their own remaining-days distributions (closings and refunds timed separately); amounts are unchanged, only the days
    tl = 4 * HORIZON
    t_svc, t_ref = np.zeros(tl), np.zeros(tl)
    t_known, t_unk = {a: np.zeros(tl) for a in AFFILIATES}, {a: np.zeros(tl) for a in AFFILIATES}
    carried = {"close": 0, "refund": 0}
    for i in e[npm].index:
        el_i = int(el_start[i])
        dc, wc, c2 = H["close_timing"](el_i)
        dr, wr, r2 = H["refund_timing"](el_i)
        carried["close"] += int(c2 < el_i)
        carried["refund"] += int(r2 < el_i)
        np.add.at(t_svc, dc, pc[i] * e.at[i, "second"] * wc)
        np.add.at(t_ref, dr, pr[i] * e.at[i, "paid"] * wr)
        for a in AFFILIATES:
            x = el.at[i, a]
            np.add.at((t_known if x == x else t_unk)[a], dc, pc[i] * wc * (x if x == x else 1.0))
    t_last = int(np.nonzero(t_svc + t_ref + sum(t_known.values()) + sum(t_unk.values()))[0].max())
    cum = np.cumsum(t_svc) / t_svc.sum()
    ends = {"dec": int((pd.Timestamp(asof.year, 12, 31) - asof).days), "jan": int((pd.Timestamp(asof.year + 1, 1, 31) - asof).days),
            "jun": int((pd.Timestamp(asof.year + 1, 6, 30) - asof).days)}
    noprop_timing = {"svc": [round(v, 4) for v in t_svc[:t_last + 1]], "refund_base": [round(v, 4) for v in t_ref[:t_last + 1]],
                     "known": {a: [round(v, 6) for v in t_known[a][:t_last + 1]] for a in AFFILIATES},
                     "unknown": {a: [round(v, 6) for v in t_unk[a][:t_last + 1]] for a in AFFILIATES},
                     "meta": {**H["timing"], "carried_close": carried["close"], "carried_refund": carried["refund"], "last_day": t_last,
                              "collect_share": {k: round(float(cum[d]), 4) for k, d in ends.items()},
                              "refund_share": {k: round(float(np.cumsum(t_ref)[d] / t_ref.sum()), 4) for k, d in ends.items()} if t_ref.sum() else {}}}
    noprop = {"n": int(npm.sum()), "second": round(float(e.loc[npm, "second"].sum()), 2), "paid": round(float(e.loc[npm, "paid"].sum()), 2),
              "collect": round(float((pc * e.second)[npm].sum()), 2), "refund_base": round(float((pr * e.paid)[npm].sum()), 2),
              "p_close": round(float(pc[npm].mean()), 4), "p_refund": round(float(pr[npm].mean()), 4), "p_pause": round(float(pp[npm].mean()), 4),
              "aff": aff_parts(npm, pc), "hunting": int((npm & hunt).sum()), "not_started": int((npm & ~hunt).sum()),
              "timing": noprop_timing}
    paused = {"n": int(pam.sum()), "second": round(float(e.loc[pam, "second"].sum()), 2), "paid": round(float(e.loc[pam, "paid"].sum()), 2),
              "aff": aff_parts(pam, pd.Series(1.0, index=e.index)),
              "paused_n": int((pam & e.rstatus.eq("Paused")).sum()), "additional_n": int((pam & e.rstatus.eq("Additional Service")).sum())}
    # timing spread for collections on the expected-days slider: the historical UC -> CLOSED spread around its median
    med = float(np.median(H["h_uc"]))
    offs, cnt = np.unique(np.clip(H["h_uc"] - med, -60, 120).astype(int), return_counts=True)
    spread = [[int(o), round(float(c / cnt.sum()), 6)] for o, c in zip(offs, cnt)]

    # ---- groups table
    def tot(g):
        x = e[e.g.eq(g)]
        return {"n": int(len(x)), "split": int(x.cash_payment_type_normalized.eq("Split Pay").sum()), "outstanding": round(float(x.out.sum()), 2),
                "second": round(float(x.second.sum()), 2), "paid": round(float(x.paid.sum()), 2)}
    labels = {"under_contract": "Under contract", "scheduled": "Closing scheduled", "noprop": "No property yet", "paused": "Paused / Additional Service",
              "refunded": "Refund already processed", "closed": "Closed (closing recorded)", "unverified_closing": "Post-close, closing unrecorded",
              "unverified_repeat": "Repeat purchase without its own Jira issue", "unverified_none": "No Jira or purchase record", "second_deal_review": "Second deal under review"}
    groups = {g: {**tot(g), "label": lab} for g, lab in labels.items()}
    for g in ("under_contract", "scheduled"):
        groups[g]["p_close"] = round(float(np.mean(p_used[g])), 4) if p_used[g] else None
        groups[g]["expected"] = {"svc": round(exp[g]["svc"], 2), "refund_base": round(exp[g]["refund_base"], 2),
                                 "aff": {a: {k: round(v, 4) for k, v in x.items()} for a, x in exp[g]["aff"].items()}}
    groups["closed"]["evidenced"] = int(e.rstatus.eq("CLOSED_EVIDENCED").sum())
    # how the deals classed as closed without a recorded closing date were matched (aggregates only): the second installment of these is
    # assumed collected at closing under the Split Pay rule, like every other closing, but no closing date is recorded for them
    ev = e[e.rstatus.eq("CLOSED_EVIDENCED")]
    evk = np.select([ev.evidence.str.contains("property address"), ev.evidence.str.contains("brokerage or lender"), ev.evidence.str.contains("own Jira issue")], ["address", "name", "own_jira"], "other")
    groups["closed"]["evidenced_by"] = {k: {"n": int((evk == k).sum()), "outstanding": round(float(ev.out[evk == k].sum()), 2)} for k in ("address", "name", "own_jira") if (evk == k).any()}
    # the deals set aside: how many were won before the reporting year (a count only)
    for g in ("unverified_closing", "unverified_repeat", "unverified_none", "second_deal_review"):
        groups[g]["won_before_year"] = int((e.loc[e.g.eq(g), "won_date"].dt.year < asof.year).sum())
    other = e[e.g.eq("other")]
    nu = e[e.g.eq("unverified_none")]

    view = ctx.f.frames["cash"]
    cl = ctx.f.jira[ctx.f.jira.signed & ctx.f.jira.closed.notna()]
    c26 = cl[cl.closed.dt.year == asof.year]
    base = C.ROOT.parent
    brk = _sheet(base, "Brokerage Affiliate Tracking.xlsx", "Brokerage_Data")
    lend = _sheet(base, "Lending Affiliate Tracking.xlsx", "Lender_Data")
    revs = _sheet(base, "DIM - JIRA Client Data.xlsx", "All_Affiliate_Revenue")
    hist_aff = _sheet(base, "DIM - JIRA Client Data.xlsx", "Affiliates_Historical")
    fut_keys = set(e[e.g.isin(["under_contract", "scheduled", "noprop", "paused"])].jira_key.dropna())
    hf = hist_aff[hist_aff["key"].astype(str).str.upper().isin(fut_keys)]
    affiliate_history = {
        "realized": {"payments": int(len(revs)), "total": round(float(revs.revenue.sum()), 2),
                     "by_source": {k: {"n": int(len(g)), "total": round(float(g.revenue.sum()), 2)} for k, g in revs.groupby("source")},
                     "through": revs.closing_date.max().strftime("%Y-%m-%d")},
        "realtor": {"median_fee": float(brk["Referral Fee"].median()), "n": int(len(brk)), "received": int(brk["Date Received"].notna().sum())},
        "lender": {"median_due": float(lend["Amount Due"].median()), "n": int(len(lend)), "funded": int(lend["Funded Date"].notna().sum()),
                   "pipeline_unfunded": int(lend["Funded Date"].isna().sum()), "invoice_paid_recorded": int(lend["Invoice Paid"].notna().sum())},
        "cribs": {"typical_fee": float(hist_aff.loc[hist_aff.Cribs_Referral_Fee > 0, "Cribs_Referral_Fee"].median()),
                  "construction_payments": int((revs.source == "Construction").sum())},
        "future_clients_already_paid": {"realtor": int(hf["Date Received"].notna().sum()), "lender": int(hf["Funded Date"].notna().sum())},
        "recorded_year": {"realtor": round(float(c26.agent_pref.mean()), 3), "lender": round(float(c26.lender_pref.mean()), 3), "cribs": round(float(c26.cribs.mean()), 3)},
        "year_label": str(asof.year), "year_n": int(len(c26)),
    }
    # ---- client landscape: deals whose source closing date falls in the 30 days ending on the reporting date (inclusive).
    # Not a pipeline stage: these are a subset of completed closings. Second deals under review are never counted.
    win0 = asof - pd.Timedelta(days=30)
    rec = e[done & (e.closed_raw > win0) & ~e.g.eq("second_deal_review")]
    recent_closed = {"n": int(len(rec)), "from": (win0 + pd.Timedelta(days=1)).strftime("%Y-%m-%d"), "to": asof.strftime("%Y-%m-%d"),
                     "by_group": {k: int(v) for k, v in rec.g.value_counts().items()}}
    lag = H["refund_lag"]
    return {
        "asof": asof.strftime("%Y-%m-%d"), "horizon": HORIZON,
        "view": {"gross_outstanding": round(float(view.gross_outstanding_cash_balance.sum()), 2), "engagements": int(len(view)),
                 "assumed_collected": round(float(view.gross_assumed_cash_collected.sum()), 2), "paid_in_full": int(view.payment_type_normalized.eq("Paid In Full").sum()),
                 "payment_recorded": int(e.payment_recorded.notna().sum()), "scheduled_counted_collected": round(float(e.loc[e.g.eq("scheduled"), "second"].sum()), 2)},
        "groups": groups, "other": {"n": int(len(other)), "outstanding": round(float(other.out.sum()), 2)},
        "recent_closed": recent_closed,
        "resolution": {**rc, "unverified_none_2026": int((nu.won_date.dt.year == asof.year).sum()), "unverified_none_2024": int((nu.won_date.dt.year == 2024).sum())},
        "fixed": {"svc": [round(v, 2) for v in svc_d[:last + 1]], "refund_base": [round(v, 2) for v in ref_d[:last + 1]],
                  "known": {a: [round(v, 4) for v in known_d[a][:last + 1]] for a in AFFILIATES},
                  "unknown": {a: [round(v, 4) for v in unk_d[a][:last + 1]] for a in AFFILIATES}},
        "noprop": noprop, "paused": paused, "spread": spread,
        "history": {"uc_to_close": {"n": int(len(H["h_uc"])), "median": med, "p25": float(np.percentile(H["h_uc"], 25)), "p75": float(np.percentile(H["h_uc"], 75)), "max": int(H["h_uc"].max())},
                    "pi_to_close": {"n": int(len(H["h_pi"])), "median": float(np.median(H["h_pi"]))},
                    "uc_close_rate": round(H["uc_rate"], 3), "uc_n": H["uc_n"], "uc_fail_refund": round(H["uc_fail_refund"], 3),
                    "mature_starts": {"n": H["old_n"], "shares": H["old_shares"]},
                    "curves": {"noprop": H["curve_np"], "uc": H["curve_uc"]}, "exits": H["exits"],
                    "refund_lag": {"n": int(len(lag)), "median": float(lag.median()), "p75": float(lag.quantile(.75)), "p90": float(lag.quantile(.9))},
                    "processed_refunds": {"n": groups["refunded"]["n"], "paid": groups["refunded"]["paid"]}},
        "affiliates": affiliate_history,
        "defaults": {"expected_days": EXPECTED_DAYS, "expected_days_max": EXPECTED_DAYS_MAX, "optimistic_days": int(1 + med),
                     "paused_proceed": PAUSED_PROCEED, "paused_defaults": PAUSED_DEFAULTS, "refundable_share": REFUNDABLE_SHARE, "affiliates": AFFILIATES},
        "notes": {"zero_value_wins": int((e.value == 0).sum()), "scheduled_dates_to": e.loc[e.g.eq("scheduled"), "closed_raw"].max().strftime("%Y-%m-%d") if e.g.eq("scheduled").any() else None},
    }
