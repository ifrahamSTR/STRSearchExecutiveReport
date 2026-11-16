"""Cash forecast tab (16 Nov 2026 reporting version): inputs for the interactive dashboard.

Starts from the reporting layer's client_cash_forecast (modeled contractual cash, not receipts): Paid In Full is
assumed collected at the win; Split Pay leaves 50% outstanding until the property closes. Every won engagement is
placed in exactly one group, so nothing is forecast twice:

  Under contract       Under Contract / Passed Inspection, no closing date -> collected at closing, timed with the
                       historical UC -> CLOSED (or Passed Inspection -> CLOSED) durations still possible for that client
  Scheduled closing    closing date after the reporting date -> collected on that date (the view already counts
                       these as collected; the forecast moves them to their real date instead of counting them twice)
  No property yet      hunting, or won with the Jira issue still pre-sale -> one collection date set by the
                       dashboard's timing slider (optimistic: UC tomorrow + median UC -> CLOSED; pessimistic: N days)
  Paused / Additional  a share proceeds on the same timing as clients without a property; the rest refunds
  Refunded             nothing further
  Already closed       closing date on or before the reporting date, or a post-close status: second installment
                       already assumed collected (post-close records missing the date are not forecast again)
  No Jira match        status unknown -> shown as contractual balance only, never forecast

Affiliate revenue is earned per future closing (any payment type): closings x conversion x revenue per conversion.
Only aggregates leave this module: daily sums for the fixed-timing groups and group totals for the slider groups.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import core as C

HORIZON = 400                      # days after the reporting date covered by the daily schedule
PESSIMISTIC_DAYS = 77              # business default: collection 77 days after the reporting date
PAUSED_PROCEED = 0.5
AFFILIATES = {"realtor": {"label": "Realtor", "conv": 0.93, "rev": 4000, "flag": "agent_pref"},
              "lender": {"label": "Lender", "conv": 0.70, "rev": 1400, "flag": "lender_pref"},
              "cribs": {"label": "STR Cribs", "conv": 0.70, "rev": 2500, "flag": "cribs"}}
POST_CLOSE = ["CLOSED", "Photography Shared", "Listed", "Content Pulled"]
MIN_TAIL = 10                      # residual-time draws needed for a client's conditional timing


def _group(e: pd.DataFrame, asof: pd.Timestamp) -> pd.Series:
    ref = e.refunded.fillna(False).astype(bool)
    hunt = e.hunting.fillna(False).astype(bool)
    signed = e.signed.fillna(False).astype(bool)
    sched = e.closed_raw.notna() & (e.closed_raw > asof)
    done = e.closed_raw.notna() & (e.closed_raw <= asof)
    return pd.Series(np.select(
        [~e.has_jira, ref, sched, done, e.status.isin(POST_CLOSE), e.status.isin(["Under Contract", "Passed Inspection"]),
         e.status.isin(["Paused", "Additional Service"]), hunt, ~signed],
        ["no_jira", "refunded", "scheduled", "closed", "post_close_no_date", "under_contract", "paused", "noprop", "noprop"],
        default="other"), index=e.index)


def _residual(history: np.ndarray, elapsed: int) -> np.ndarray:
    """Remaining days to closing for a client who has waited `elapsed` days: historical durations longer than the wait,
    minus the wait (each equally likely). Falls back to the longest MIN_TAIL durations when too few remain."""
    tail = history[history > elapsed]
    if len(tail) < MIN_TAIL:
        tail = np.sort(history)[-MIN_TAIL:]
    return np.maximum(tail - elapsed, 1)


def build(ctx: C.Ctx) -> dict:
    e, j, asof = ctx.f.eng.copy(), ctx.f.jira, ctx.asof
    e["g"] = _group(e, asof)
    e["out"] = e.cash_outstanding_cash_balance.fillna(0.0)
    e["second"] = e.cash_second_installment_amount.fillna(0.0)
    split = e.cash_payment_type_normalized == "Split Pay"

    # historical timing (completed closings only)
    h_uc = e.days_uc_to_close.dropna().values
    h_uc = h_uc[h_uc >= 0].astype(int)
    h_pi = (e.closed - e.pi).dt.days.dropna().values
    h_pi = h_pi[h_pi >= 0].astype(int)

    cash_d, close_d = np.zeros(HORIZON + 1), np.zeros(HORIZON + 1)
    beyond = {"cash": 0.0, "closings": 0.0}
    uc = e[e.g == "under_contract"]
    pi_based = 0
    for r in uc.itertuples():
        if r.status == "Passed Inspection" and pd.notna(r.pi):
            rem = _residual(h_pi, int((asof - r.pi).days)); pi_based += 1
        else:
            rem = _residual(h_uc, int((asof - r.uc).days)) if pd.notna(r.uc) else np.array([int(np.median(h_uc))])
        w = 1.0 / len(rem)
        amt = float(r.out)
        for d in rem:
            if d <= HORIZON:
                cash_d[d] += amt * w; close_d[d] += w
            else:
                beyond["cash"] += amt * w; beyond["closings"] += w
    sc = e[e.g == "scheduled"]
    for r in sc.itertuples():
        d = int((r.closed_raw - asof).days)
        cash_d[d] += float(r.second) if r.cash_payment_type_normalized == "Split Pay" else 0.0
        close_d[d] += 1

    def tot(g, col="out"):
        x = e[e.g == g]
        return {"n": int(len(x)), "split": int((x.cash_payment_type_normalized == "Split Pay").sum()), "amount": round(float(x[col].sum()), 2)}

    groups = {
        "under_contract": {**tot("under_contract"), "label": "Under contract", "treatment": "Collected at closing, timed by historical UC → CLOSED durations",
                           "pi_based": pi_based, "kind": "fixed"},
        "scheduled": {**tot("scheduled", "second"), "label": "Closing scheduled", "treatment": "Collected on the scheduled closing date", "kind": "fixed",
                      "view_counts_collected": round(float(sc[sc.cash_payment_type_normalized == "Split Pay"].second.sum()), 2)},
        "noprop": {**tot("noprop"), "label": "No property yet", "treatment": "Collected on the date set by the timing slider", "kind": "slider",
                   "hunting": int(((e.g == "noprop") & e.hunting.fillna(False).astype(bool)).sum()),
                   "presale": int(((e.g == "noprop") & ~e.hunting.fillna(False).astype(bool)).sum())},
        "paused": {**tot("paused"), "label": "Paused / Additional Service", "treatment": "A share proceeds on the slider date; the rest refunds", "kind": "slider",
                   "paused_n": int(((e.g == "paused") & (e.status == "Paused")).sum()), "additional_n": int(((e.g == "paused") & (e.status == "Additional Service")).sum())},
        "refunded": {**tot("refunded"), "label": "Refunded", "treatment": "No further collections", "kind": "excluded"},
        "post_close_no_date": {**tot("post_close_no_date"), "label": "Closed, date missing", "treatment": "Already closed per status: second installment treated as collected, not forecast again", "kind": "excluded"},
        "closed": {**tot("closed"), "label": "Already closed", "treatment": "Second installment already assumed collected", "kind": "excluded"},
        "no_jira": {**tot("no_jira"), "label": "No Jira match", "treatment": "Status unknown: contractual balance shown, not forecast", "kind": "excluded"},
    }
    other = e[e.g == "other"]

    # affiliate history: recorded preferred-partner use among signed clients with a completed closing
    cl = j[j.signed & j.closed.notna()]
    c26 = cl[cl.closed.dt.year == asof.year]
    affiliates = {k: {**{x: v[x] for x in ("label", "conv", "rev")},
                      "recorded_all": round(float(cl[v["flag"]].mean()), 3), "recorded_year": round(float(c26[v["flag"]].mean()), 3)}
                  for k, v in AFFILIATES.items()}

    # what eventually happened to older starts (context for "no property yet"): starts with 180+ days on the clock
    co = ctx.cohort
    old = co[co.days_since_start >= 180]
    fate = {"n": int(len(old)), "closed": round(float(old.closed.notna().mean()), 3), "refunded": round(float(old.refunded.fillna(False).astype(bool).mean()), 3),
            "paused": round(float((old.status == "Paused").mean()), 3), "hunting": round(float(old.hunting.fillna(False).astype(bool).mean()), 3)}

    view = ctx.f.frames["cash"]
    last = max(int(np.nonzero(cash_d + close_d)[0].max()) if (cash_d + close_d).any() else 0, PESSIMISTIC_DAYS)
    hist = lambda a: {"n": int(len(a)), "median": float(np.median(a)), "p25": float(np.percentile(a, 25)), "p75": float(np.percentile(a, 75)), "max": int(a.max())}  # noqa: E731
    return {
        "asof": asof.strftime("%Y-%m-%d"), "horizon": HORIZON,
        "view": {"gross_outstanding": round(float(view.gross_outstanding_cash_balance.sum()), 2),
                 "refund_excluded_outstanding": round(float(view.refund_excluded_outstanding_cash_balance.sum()), 2),
                 "assumed_collected": round(float(view.gross_assumed_cash_collected.sum()), 2), "deal_value": round(float(view.deal_value.sum()), 2),
                 "engagements": int(len(view)), "paid_in_full": int((view.payment_type_normalized == "Paid In Full").sum()),
                 "payment_recorded": int(e.payment_recorded.notna().sum())},
        "groups": groups, "other": {"n": int(len(other)), "amount": round(float(other.out.sum()), 2)},
        "fixed": {"cash": [round(v, 2) for v in cash_d[:last + 1]], "closings": [round(v, 4) for v in close_d[:last + 1]], "beyond_horizon": beyond},
        "history": {"uc_to_close": hist(h_uc), "pi_to_close": hist(h_pi), "affiliates_n": {"all": int(len(cl)), "year": int(len(c26)), "year_label": str(asof.year)},
                    "older_starts": fate},
        "defaults": {"pessimistic_days": PESSIMISTIC_DAYS, "optimistic_days": int(1 + np.median(h_uc)), "timing": 0.5, "paused_proceed": PAUSED_PROCEED,
                     "affiliates": affiliates},
        "notes": {"zero_value_wins": int((e.value == 0).sum()), "scheduled_dates_to": sc.closed_raw.max().strftime("%Y-%m-%d") if len(sc) else None},
    }
