"""Chapter 4: how long does acquisition actually take? (16 Nov 2026 reporting version)

Population: won engagements with a confirmed Jira start (client_cohort_performance). Days = milestone date minus
client_start_date, where client_start_date is the issue due date for Jira issues created before 1 Jun 2026 (or the
created date + 4 days when no due date is set) and the Pipedrive won date from 1 Jun 2026. Under Contract is the
latest valid contract; CLOSED counts closings up to the data date (later dates are scheduled). Kaplan-Meier counts
every confirmed start without the milestone until the data date (hunting, paused and refunded clients alike)."""
from __future__ import annotations

import numpy as np
import pandas as pd

import core as C

HIST_BIN, HIST_CAP = 15, 180
WAIT_BIN, WAIT_CAP = 10, 180
CURVE_DAYS = 200


def _bins(values: pd.Series, width: int, cap: int) -> dict:
    v = pd.to_numeric(values, errors="coerce").dropna()
    v = v[v >= 0]
    counts = [int(((v >= a) & (v < a + width)).sum()) for a in range(0, cap, width)]
    return {"width": width, "cap": cap, "counts": counts, "overflow": int((v >= cap).sum()), "n": int(len(v))}


# ----------------------------------------------------------------------------- 4.4 scenario: every hunting client under contract tomorrow
# Budget = the upper amount of the onboarding-form range "Total out-of-pocket capital available (all-in)" (column M of the
# current form, live since 20 Apr 2026): the interim rule is to carry that amount into Jira until Acquisitions cleans the
# Jira budget field. It measures all-in capital (down payment + closing costs + renovation + furniture + amenities), not the
# purchase price. Matched to clients as in chapter 5 (e-mail first, the form's deal id as a fallback; the answer given
# before the client's Under Contract date).
BUDGETS = [(200, "$200K", "$150K–$200K"), (250, "$250K", "$200K–$250K"), (300, "$300K", "$250K–$300K"),
           (400, "$350K–$400K", "$300K–$400K"), (10_000, "$450K and above", "$400K–$500K and $500K+")]
NO_BUDGET = "Not recorded"


def _budget(cap) -> str:
    if cap is None or pd.isna(cap):
        return NO_BUDGET
    c = float(cap)
    if c < 0:                       # an open-ended answer such as "$400K+" (upper amount unknown, at least $400K)
        return BUDGETS[-1][1]
    return next(lab for hi, lab, _ in BUDGETS if c <= hi)


def _st(v: pd.Series) -> dict:
    v = pd.to_numeric(v, errors="coerce").dropna()
    return {"n": int(len(v)), "mean": round(float(v.mean()), 2) if len(v) else None, "median": float(v.median()) if len(v) else None}


def scenario(ctx: C.Ctx) -> dict:
    """Observed days from client start to Under Contract, and the 'UC tomorrow' scenario: every hunting search counts as
    reaching Under Contract on the day after the data date, pooled with the recorded durations of every other search. Each
    search (engagement with a confirmed start) counts once: a hunting search that still carries an older Under Contract
    date counts as waiting, not with that older date. Paused and refunded searches without a contract are in neither."""
    from chapters import drivers as DR
    co, asof = ctx.cohort.copy(), ctx.asof
    form = DR.load_form(C.ROOT.parent / "12 Nov 26 Reports" / "DataDrive" / DR.WORKBOOK)
    ans, info = DR.match(co, form, DR.jira_email_hashes(ctx.explorer))
    co["budget"] = ans.cap.map(_budget)
    hunt = co.hunting.fillna(False).astype(bool)
    rec = co.uc.notna() & (co.days_uc >= 0)
    co["obs"] = co.days_uc.where(rec)
    co["wait"] = ((asof + pd.Timedelta(days=1)) - co.start).dt.days.where(hunt)
    co["pool"] = co.wait.where(hunt, co.obs)
    co["t"], co["e"] = np.where(co.uc.notna(), co.days_uc, co.elapsed), co.uc.notna()

    def km_med(g):
        g = g[g.t >= 0]
        k = C.km_curve(g.t, g.e.astype(bool))
        hit = k[k.cum >= 0.5]
        return float(hit.t.iloc[0]) if len(hit) else None

    def block(g):
        return {"clients": int(len(g)), "recorded": _st(g.obs), "hunting": int(g.wait.notna().sum()), "waits": _st(g.wait),
                "scenario": _st(g.pool), "km_median": km_med(g), "hunting_with_older_uc": int((g.wait.notna() & g.uc.notna()).sum())}

    groups = []
    for _, lab, rng in BUDGETS + [(None, NO_BUDGET, None)]:
        g = co[co.budget == lab]
        groups.append({"label": lab, "range": rng, **block(g)})
    # every hunting Jira client, including the 15 without a confirmed start on a won deal (measured from their Jira start)
    jh = ctx.jira[ctx.jira.hunting]
    extra = jh[~jh.key.isin(co.jira_key) & jh.start.notna()]
    ext_wait = ((asof + pd.Timedelta(days=1)) - extra.start).dt.days
    all_pool = pd.concat([co.pool.dropna(), ext_wait])
    sig = ctx.signed
    since = co[co.start >= pd.Timestamp("2026-04-20")]
    return {
        "all": block(co), "budgets": groups,
        "budget_rule": {"field": "Total out-of-pocket capital available (all-in)", "column": "M", "form_since": "2026-04-20",
                        "measures": "down payment + closing costs + renovation + furniture + amenities (all-in capital, not the purchase price)",
                        "matched": int(ans.matched.sum()), "since_form": int(len(since)), "since_form_matched": int(since.index.isin(ans.index[ans.matched]).sum()),
                        "via_deal_only": info["via_deal_only"], "jira_budget_filled": int(sig.budget.notna().sum()), "signed": int(len(sig))},
        "jira_hunting": int(len(jh)), "jira_hunting_not_confirmed": int((~jh.key.isin(co.jira_key)).sum()),
        "jira_hunting_not_confirmed_why": {k: int(v) for k, v in jh[~jh.key.isin(co.jira_key)].pd_status.value_counts().items()},
        "all_hunting_sensitivity": _st(all_pool),
        # searches in neither figure: no recorded contract and not hunting (by status group: Closed / Post-close = closings without a UC date)
        "left_out": {k: int(v) for k, v in co[~hunt & co.uc.isna()].group.fillna("No Jira status").value_counts().items()},
        "negative_excluded": int((co.uc.notna() & (co.days_uc < 0)).sum()),
        "km_median": ctx.expected["q1"]["km_uc"],
    }


def build(ctx: C.Ctx) -> dict:
    ex, s = ctx.expected, ctx.cohort
    q1 = ex["q1"]
    observed = {k: {"n": q1[k]["n"], "median": q1[k]["median"], "mean": q1[k]["mean"]} for k in ("uc", "closed")}
    hist = _bins(s.days_uc, HIST_BIN, HIST_CAP)
    top = int(np.argmax(hist["counts"]))
    d = s.days_uc.dropna()
    d = d[d >= 0]
    hist.update({"largest": {"from": top * HIST_BIN, "to": top * HIST_BIN + HIST_BIN - 1, "n": hist["counts"][top]},
                 "within60": {"n": int((d < 60).sum()), "share": round(float((d < 60).mean()), 4)},
                 "median": observed["uc"]["median"], "mean": observed["uc"]["mean"]})
    lanes = {}
    for key, group, ref in (("searching", "Hunting", observed["uc"]["median"]), ("under_contract", "Under contract", observed["closed"]["median"])):
        g = s[s.group == group]
        lanes[key] = {**_bins(g.elapsed, WAIT_BIN, WAIT_CAP), "ref": ref,
                      "past_ref": int((g.elapsed > ref).sum()), "within_ref": int((g.elapsed <= ref).sum()),
                      "statuses": {k: int(v) for k, v in g.status.value_counts().items()}}

    def km(col, days_col):
        t = np.where(s[col].notna(), s[days_col], s.elapsed)
        return C.km_curve(t, s[col].notna().values)

    k_uc, k_cl = km("uc", "days_uc"), km("closed", "days_closed")
    first50 = lambda k: float(k[k.cum >= 0.5].t.iloc[0])  # noqa: E731
    estimate = {"uc": {"median": q1["km_uc"], "curve": C.daily(k_uc, CURVE_DAYS), "check": first50(k_uc)},
                "closed": {"median": q1["km_closed"], "curve": C.daily(k_cl, CURVE_DAYS), "check": first50(k_cl)},
                "n": int(len(s)),
                "recorded_curve": {"uc": C.daily(C.ecdf(s.days_uc), CURVE_DAYS), "closed": C.daily(C.ecdf(s.days_closed), CURVE_DAYS)}}
    gap = s.days_uc_to_close.dropna()
    rules = ("due", "created+4", "won")
    rec = {"uc": s.days_uc.notna() & (s.days_uc >= 0), "closed": s.days_closed.notna() & (s.days_closed >= 0),
           "population": pd.Series(True, index=s.index)}            # recorded durations exclude the negative one(s)
    clock = {k: {"n": int(m.sum()), **{r: int(((s.start_rule == r) & m).sum()) for r in rules}} for k, m in rec.items()}
    clock["fallback_excluded"] = ex["engagements"]["fallback"]
    clock["scheduled_closings"] = ex["engagements"]["scheduled_closings"]
    clock["negative_excluded"] = q1["negative_days_to_uc"]
    return {
        "observed": observed, "hist": hist, "lanes": lanes, "estimate": estimate, "clock": clock,
        "uc_to_close": {"n": int(len(gap)), "median": float(gap.median())},
        "running": int(sum(l["n"] for l in lanes.values())),
        "closed_without_uc_date": int((s.closed.notna() & s.uc.isna()).sum()),
        "scenario": scenario(ctx),
    }
