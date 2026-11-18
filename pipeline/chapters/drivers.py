"""Chapter 5: what distinguishes fast and slow clients? (16 Nov 2026 reporting version)

Population: won engagements with a confirmed Jira start (client_cohort_performance); days to the latest valid Under
Contract date from client_start_date. Speed groups as before: fast <= 30 days, middle 31-74, slow >= 75, and still
hunting (no contract yet). Shares use only clients who have had the whole window (30 or 75 days on the clock).

Capital, revisited for survivorship. Clients still waiting for a contract are kept in every comparison: time to Under
Contract is analysed with Kaplan-Meier curves (unfinished journeys censored at the data date), a log-rank test and a
Cox model (hazard ratio per $100K, stratified by start era). Two pre-search capital measures are used:
  - Pipedrive deal_capital_min: the lead's stated minimum capital, filled for about 80% of clients whatever their outcome;
  - onboarding questionnaire column M (all-in out-of-pocket capital), read at the upper end of each range.
Jira total_oop and purchase price are NOT used: they are recorded mostly once a client buys (survivorship by design).
A non-significant result is reported with the smallest effect the data could have detected, never as proof of no effect.

Offer experience: onboarding questionnaire ("Form Responses 2"), column AA, the client's self-reported experience
submitting real-estate offers BEFORE STRSearch. It is not offers made during the search.

Deals sent: Jira total_deals_sent is a cumulative, undated total, recorded mostly at purchase. It grows with search
length, so it cannot measure early deal velocity (e.g. properties sent in the first 14 days) or explain duration.

Matching to the questionnaire: client e-mail (preferred or secondary answer vs the 12 Nov Jira extract's Client_Email
and Additional_Emails, hashed, joined by Jira key) and, as a fallback that never overrides an e-mail match, column AH
read as the Pipedrive deal id of the engagement. The answer used is the latest one given up to 30 days after the client
start and before the Under Contract date. Output is aggregates only; no share rests on 1-4 clients.
"""
from __future__ import annotations

import hashlib
import importlib.util
import re
import sys
import warnings

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import norm, spearmanr
from statsmodels.duration.hazard_regression import PHReg
from statsmodels.duration.survfunc import survdiff
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.proportion import confint_proportions_2indep

import core as C

WORKBOOK = "Onboarding STR Search (Responses).xlsx"
SHEET = "Form Responses 2"
COLS = {
    "A": ("ts", "Timestamp"), "D": ("email", "Preferred Email"), "E": ("email2", "Secondary Email"),
    "M": ("capital", "out-of-pocket capital"), "N": ("liquid", "liquid and ready to deploy"), "O": ("budget", "Budget flexibility"),
    "P": ("approach", "investment approach"), "Q": ("reno", "level of renovations"), "U": ("markets", "specific markets"),
    "AA": ("offers", "experience submitting offers"), "AB": ("airbnbs", "How many other Airbnbs"), "AH": ("form_deal", "Person ID"),
}
FAST, SLOW, MIN_DAYS, ANSWER_AFTER, MIN_CELL, CURVE_DAYS = 30, 75, 75, 30, 5, 180
GROUPS = [("fast", "Under Contract within 30 days"), ("middle", "31–74 days"), ("slow", "75 days or longer"),
          ("searching", "Still hunting, no contract yet")]
OFFERS = [("0", "No offers yet"), ("1-2", "1–2 offers"), ("3+", "3+ offers")]
PD_BANDS = [(0, 200_000, "Under $200K"), (200_000, 300_000, "$200K–$299K"), (300_000, float("inf"), "$300K+")]
FORM_BANDS = [(0, 250, "Up to $250K"), (251, 400, "$300K–$400K"), (401, float("inf"), "$450K+")]


# ----------------------------------------------------------------------------- questionnaire
def _h(email) -> str | None:
    e = "" if email is None or pd.isna(email) else str(email).strip().lower()
    return hashlib.sha256(e.encode()).hexdigest() if e else None


def _cap_upper(v) -> float:
    s = "" if pd.isna(v) else str(v).strip()
    k = re.findall(r"\$(\d+)\s*K", s)
    if not k:
        return np.nan
    if s.endswith("+"):
        return 500.0 if k[0] == "500" else -float(k[0])
    return float(k[-1])


def _starts(v, *pairs, default=None):
    s = "" if pd.isna(v) else str(v)
    for prefix, key in pairs:
        if s.startswith(prefix):
            return key
    return default


def load_form(path) -> pd.DataFrame:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        raw = pd.read_excel(path, sheet_name=SHEET, usecols=",".join(COLS))
    for (letter, (name, cue)), header in zip(COLS.items(), raw.columns):
        if cue.lower() not in " ".join(str(header).split()).lower():
            raise SystemExit(f"Onboarding form column {letter} no longer holds '{cue}'. The form layout has changed.")
    raw.columns = [v[0] for v in COLS.values()]
    off = raw.offers.astype(str)
    return pd.DataFrame({
        "ts": pd.to_datetime(raw.ts, errors="coerce"), "h1": raw.email.map(_h), "h2": raw.email2.map(_h),
        "form_deal": pd.to_numeric(raw.form_deal, errors="coerce"), "cap": raw.capital.map(_cap_upper),
        "cap_label": raw.capital.astype("string").str.strip(),
        "liquid": raw.liquid.map(lambda v: _starts(v, ("All", "all"), ("Most", "most"), default="some")),
        "budget": raw.budget.map(lambda v: _starts(v, ("Strict", "strict"), ("Some", "some"), default="flexible")),
        "property": [("turnkey" if str(a).startswith("Turnkey") else "light" if str(r).startswith("Light") else "value_add")
                     for a, r in zip(raw.approach, raw.reno)],
        "markets": raw.markets.map(lambda v: _starts(v, ("Yes", "specific"), default="open")),
        "offers": np.where(off.str.contains("No experience"), "0", np.where(off.str.contains("1–2|1-2"), "1-2", "3+")),
        "airbnb": raw.airbnbs.map(lambda v: "none" if str(v).split(".")[0].strip() == "0" else "owns"),
    })


def jira_email_hashes(explorer) -> dict:
    """Jira key -> e-mail hashes, from the 12 Nov Jira extract (the reporting layer carries no e-mails). Read through the
    Explorer's frozen 12 Nov loader; never written anywhere."""
    path = explorer / "versions" / "2026-11-12" / "pipeline" / "build.py"
    spec = importlib.util.spec_from_file_location("explorer_build_20261112_emails", path)
    mod = importlib.util.module_from_spec(spec)
    saved = {k: sys.modules.pop(k) for k in ("definitions", "metrics", "quality") if k in sys.modules}
    spec.loader.exec_module(mod)
    frames, _ = mod.load_sources(mod.DEFAULT_REPORTS, True)
    for k in ("definitions", "metrics", "quality"):
        sys.modules.pop(k, None)
    sys.modules.update(saved)
    rj = frames["jira"]
    out = {}
    for key, e1, extra in zip(rj["key"].astype(str).str.strip().str.upper(), rj["Client_Email"], rj["Additional_Emails"].astype("string").fillna("")):
        hs = {_h(e1)} | {_h(e) for e in re.split(r"[,;\s]+", str(extra)) if "@" in e}
        out[key] = {x for x in hs if x}
    return out


def match(co: pd.DataFrame, form: pd.DataFrame, hashes: dict) -> tuple[pd.DataFrame, dict]:
    rows_by_hash, rows_by_deal, keys_by_row = {}, {}, {}
    key_by_hash = {}
    for k, hs in hashes.items():
        for x in hs:
            key_by_hash.setdefault(x, set()).add(k)
    for i, r in form.iterrows():
        for x in (r.h1, r.h2):
            if x:
                rows_by_hash.setdefault(x, set()).add(i)
        if pd.notna(r.form_deal):
            rows_by_deal.setdefault(int(r.form_deal), set()).add(i)
        keys_by_row[i] = set().union(*(key_by_hash.get(x, set()) for x in (r.h1, r.h2) if x))
    picked, via_deal_only, rejected, after_uc = [], 0, 0, 0
    for _, c in co.iterrows():
        by_mail = set().union(*(rows_by_hash.get(x, set()) for x in hashes.get(c.jira_key, set())))
        by_deal = rows_by_deal.get(int(c.id), set())
        ok = {i for i in by_deal if not keys_by_row[i] or c.jira_key in keys_by_row[i]}
        rejected += len(by_deal - ok)
        cand = form.loc[sorted(by_mail | ok)] if (by_mail or ok) else form.iloc[0:0]
        cand = cand[cand.ts <= c.start + pd.Timedelta(days=ANSWER_AFTER)]
        before = cand[cand.ts.dt.normalize() < c.uc] if pd.notna(c.uc) else cand
        after_uc += int(len(cand) > 0 and len(before) == 0)
        pick = before.sort_values("ts").index[-1] if len(before) else None
        via_deal_only += int(pick is not None and pick not in by_mail)
        picked.append(pick)
    cols = ["ts", "cap", "liquid", "budget", "property", "markets", "offers", "airbnb"] + (["cap_label"] if "cap_label" in form else [])
    out = pd.DataFrame({col: [form.at[i, col] if i is not None else None for i in picked] for col in cols}, index=co.index)
    out["matched"] = [i is not None for i in picked]
    return out, {"via_deal_only": via_deal_only, "rejected_conflicts": rejected, "only_after_uc": after_uc}


# ----------------------------------------------------------------------------- statistics
def _share(k, n):
    k, n = int(k), int(n)
    return None if n < MIN_CELL or 0 < k < MIN_CELL else round(k / n, 4)


def _cell(mask: pd.Series) -> dict:
    mask = mask.astype(bool)
    share = _share(mask.sum(), len(mask))
    return {"n": int(len(mask)), "k": int(mask.sum()) if share is not None else None, "share": share}


def _diff_ci(a: pd.Series, b: pd.Series) -> list:
    if not len(a) or not len(b):
        return [None, None]
    lo, hi = confint_proportions_2indep(int(a.sum()), len(a), int(b.sum()), len(b), method="newcomb")
    return [round(float(lo), 3), round(float(hi), 3)]


def _logit_p(y, X, term) -> dict:
    try:
        r = sm.Logit(y.astype(float), sm.add_constant(X.astype(float), has_constant="add")).fit(disp=0)
        ci = r.conf_int().loc[term]
        return {"or": round(float(np.exp(r.params[term])), 2), "lo": round(float(np.exp(ci[0])), 2),
                "hi": round(float(np.exp(ci[1])), 2), "p": round(float(r.pvalues[term]), 4)}
    except Exception:
        return {"or": None, "lo": None, "hi": None, "p": None}


def _era(df: pd.DataFrame) -> pd.Series:
    """Start era: issues created from 1 Jun 2026 start on the won date (reporting rule)."""
    return (df.start_rule == "won").astype(int)


def survival(df: pd.DataFrame, band_col: str, bands: list, x: pd.Series, per: float) -> dict:
    """KM curves by band + log-rank + Cox (per `per` units of x, stratified by start era) on time to Under Contract.
    Every client is in: unfinished journeys are censored at the data date."""
    d = df.assign(_x=x).dropna(subset=["_x", band_col])
    d = d[d.t >= 0]
    out = {"n": int(len(d)), "events": int(d.e.sum()), "bands": []}
    for lab in bands:
        g = d[d[band_col] == lab]
        k = C.km_curve(g.t, g.e.astype(bool))
        hit = k[k.cum >= 0.5]
        el90 = g[g.elapsed >= 90]
        out["bands"].append({"label": lab, "n": int(len(g)), "events": int(g.e.sum()),
                             "km_median": float(hit.t.iloc[0]) if len(hit) else None,
                             "curve": C.daily(k, CURVE_DAYS)[::5] if len(g) >= MIN_CELL else None,
                             "uc90": _cell(el90.days_uc.between(0, 90)) if len(el90) else {"n": 0, "k": None, "share": None}})
    if d[band_col].nunique() > 1:
        stat, p = survdiff(d.t.values, d.e.values, d[band_col].astype(str).values)
        out["logrank"] = {"chi2": round(float(stat), 2), "df": int(d[band_col].nunique() - 1), "p": round(float(p), 3)}
    try:
        r = PHReg(d.t.values.astype(float), (d._x.values / per).reshape(-1, 1).astype(float), status=d.e.values.astype(int),
                  strata=_era(d).values, ties="efron").fit()
        hr, (lo, hi) = float(np.exp(r.params[0])), np.exp(r.conf_int()[0])
        out["cox"] = {"hr": round(hr, 3), "lo": round(float(lo), 3), "hi": round(float(hi), 3), "p": round(float(r.pvalues[0]), 3), "per": per}
    except Exception:
        out["cox"] = None
    # smallest hazard ratio detectable with 80% power at alpha 0.05 between two equal halves (Schoenfeld)
    ev = max(int(d.e.sum()), 1)
    lhr = (norm.ppf(0.975) + norm.ppf(0.8)) / np.sqrt(ev * 0.25)
    out["detectable_hr"] = round(float(np.exp(lhr)), 2)
    return out


# ----------------------------------------------------------------------------- build
def build(ctx: C.Ctx, onboarding_path=None) -> dict:
    path = onboarding_path or (C.ROOT.parent / "12 Nov 26 Reports" / "DataDrive" / WORKBOOK)
    form = load_form(path)
    co = ctx.cohort.copy()
    co["spd"] = np.select([co.days_uc.notna() & (co.days_uc >= 0) & (co.days_uc <= FAST), co.days_uc.notna() & (co.days_uc >= SLOW),
                           co.days_uc.notna() & (co.days_uc >= 0), co.uc.isna() & (co.group == "Hunting")],
                          ["fast", "slow", "middle", "searching"], default="")
    answers, match_info = match(co, form, jira_email_hashes(ctx.explorer))
    co = co.join(answers)
    co["within30"] = co.days_uc.notna() & co.days_uc.between(0, FAST)
    co["within75"] = co.days_uc.notna() & co.days_uc.between(0, SLOW - 1)
    co["t"] = np.where(co.uc.notna(), co.days_uc, co.elapsed)
    co["e"] = co.uc.notna().astype(int)
    classifiable = co.spd != ""
    e75, e30 = co[classifiable & (co.elapsed >= MIN_DAYS)], co[classifiable & (co.elapsed >= FAST)]
    m75, m30 = e75[e75.matched], e30[e30.matched]

    composition = [{"key": g, "label": lab, "n": int((e75.spd == g).sum()),
                    "median_days": (float(e75[e75.spd == g].days_uc.median()) if g != "searching" and (e75.spd == g).any() else None),
                    "median_elapsed": (float(e75[e75.spd == g].elapsed.median()) if g == "searching" and (e75.spd == g).any() else None)}
                   for g, lab in GROUPS]
    stopped = co[(co.elapsed >= MIN_DAYS) & ~classifiable]

    # capital 1: Pipedrive stated capital (pre-sale; whole confirmed-start population, unfinished journeys included)
    capmin = co.id.map(ctx.deals.set_index("id").capital_min)
    band = pd.Series([next((lab for lo, hi, lab in PD_BANDS if lo < v <= hi or (lo == 0 and 0 < v <= hi)), None) if pd.notna(v) and v > 0 else None
                      for v in capmin], index=co.index)
    co["pd_band"] = band
    pd_surv = survival(co, "pd_band", [b[2] for b in PD_BANDS], capmin.where(capmin > 0), 100_000)
    valid = co.t >= 0                                                # a UC dated before the start is left out everywhere
    known = co[valid & capmin.notna() & (capmin > 0)]
    unk = co[valid & ~(capmin.notna() & (capmin > 0))]
    stat, p_missing = survdiff(co.t.values[co.t >= 0], co.e.values[co.t >= 0],
                               (capmin.notna() & (capmin > 0)).astype(int).values[co.t >= 0])
    km_med = lambda g: (lambda k: float(k[k.cum >= 0.5].t.iloc[0]) if (k.cum >= 0.5).any() else None)(C.km_curve(g.t, g.e.astype(bool)))  # noqa: E731
    pd_surv["coverage"] = {"known": int(len(known)), "unknown": int(len(unk)), "share_known": round(len(known) / len(co), 3),
                           "known_km_median": km_med(known), "unknown_km_median": km_med(unk), "missing_logrank_p": round(float(p_missing), 3),
                           "known_with_uc": round(float(known.e.mean()), 3), "unknown_with_uc": round(float(unk.e.mean()), 3)}
    oop_cov = ctx.signed.assign(u=ctx.signed.uc.notna()).groupby("u").oop_known.mean()
    pd_surv["oop_recorded"] = {"with_uc": round(float(oop_cov.get(True, 0)), 3), "without_uc": round(float(oop_cov.get(False, 0)), 3),
                               "hunting": round(float(ctx.signed[ctx.signed.hunting].oop_known.mean()), 3)}

    # capital 2: onboarding questionnaire column M (matched subset; upper end of each range)
    mf = co[co.matched & co.cap.notna() & (co.cap.astype(float) > 0)].copy()
    mf["form_band"] = [next((lab for lo, hi, lab in FORM_BANDS if lo <= c <= hi), None) for c in mf.cap.astype(float)]
    form_surv = survival(mf, "form_band", [b[2] for b in FORM_BANDS], mf.cap.astype(float), 100)
    rng = np.random.default_rng(20261116)

    def family_p(df, col, thresholds=(250, 300, 350, 400, 450, 500)):
        d = df[df.cap.astype(float) > 0]
        caps, y = d.cap.astype(float).values, d[col].values.astype(float)

        def zmax(c):
            z = []
            for th in thresholds:
                a = c >= th
                if a.all() or (~a).all():
                    continue
                p = y.mean()
                z.append(abs(y[a].mean() - y[~a].mean()) / np.sqrt(p * (1 - p) * (1 / a.sum() + 1 / (~a).sum())))
            return max(z) if z else 0
        obs = zmax(caps)
        return round(float(np.mean([zmax(rng.permutation(caps)) >= obs for _ in range(4000)])), 3)
    form_surv["threshold_family_p"] = {"d30": family_p(m30, "within30"), "d75": family_p(m75, "within75")}

    # offer experience (questionnaire column AA): self-reported, before STRSearch
    offers = []
    for key, lab in OFFERS:
        a, b = m30[m30.offers == key], m75[m75.offers == key]
        g = co[co.matched & (co.offers == key)]
        offers.append({"key": key, "label": lab, "within30": _cell(a.within30), "within75": _cell(b.within75),
                       "median_days": float(b.days_uc.median()) if b.days_uc.notna().any() else None,
                       "km_median": km_med(g) if len(g) >= MIN_CELL else None, "n_all": int(len(g))})
    mo = co[co.matched & co.offers.notna()]
    lr = survdiff(mo.t.values, mo.e.values, mo.offers.astype(str).values) if mo.offers.nunique() > 1 else (None, None)
    off_flags = m30.offers.map({"0": 0, "1-2": 1, "3+": 2}).astype(float)
    trend30 = _logit_p(m30.within30, pd.DataFrame({"offers": off_flags, "era": _era(m30)}), "offers")
    off_gap = _diff_ci(m30[m30.offers == "3+"].within30, m30[m30.offers == "0"].within30)

    # the other answers, era-adjusted, Holm across all tests (method note)
    def flags(df):
        return pd.DataFrame({"capital": df.cap.astype(float).clip(lower=0) / 100, "liquidity": (df.liquid == "some").astype(float),
                             "budget": (df.budget == "strict").astype(float), "markets": (df.markets == "specific").astype(float),
                             "property": (df.property != "value_add").astype(float),
                             "offers": df.offers.map({"0": 0, "1-2": 1, "3+": 2}).astype(float), "airbnb": (df.airbnb == "owns").astype(float)}, index=df.index)
    labels = {"capital": "All-in capital (per $100K)", "liquidity": "Capital partly tied up (not liquid)", "budget": "Strict budget",
              "markets": "Named specific markets", "property": "Turnkey or light renovation only",
              "offers": "Real-estate offers submitted before STRSearch (0 / 1–2 / 3+)", "airbnb": "Already owns an Airbnb"}
    f30, f75 = flags(m30), flags(m75)
    tested = []
    for k, lab in labels.items():
        tested.append({"key": k, "label": lab,
                       "within30": _logit_p(m30.within30, pd.concat([f30[[k]], _era(m30).rename("era")], axis=1), k),
                       "within75": _logit_p(m75.within75, pd.concat([f75[[k]], _era(m75).rename("era")], axis=1), k)})
    ps = [t[o]["p"] if t[o]["p"] is not None else 1.0 for t in tested for o in ("within30", "within75")]
    holm = multipletests(ps, method="holm")[1]
    for i, t in enumerate(tested):
        t["within30"]["p_holm"], t["within75"]["p_holm"] = round(float(holm[2 * i]), 3), round(float(holm[2 * i + 1]), 3)

    # deals sent: coverage by outcome, and how the cumulative count grows with search length
    sig = ctx.signed
    u = e75[e75.days_uc.notna() & e75.deals_sent.notna() & (e75.days_uc >= 0)]
    deals = {"groups": {g: {"n": int((u.spd == g).sum()), "median": float(u[u.spd == g].deals_sent.median()) if (u.spd == g).any() else None,
                            "p25": float(u[u.spd == g].deals_sent.quantile(.25)) if (u.spd == g).any() else None,
                            "p75": float(u[u.spd == g].deals_sent.quantile(.75)) if (u.spd == g).any() else None,
                            "median_days": float(u[u.spd == g].days_uc.median()) if (u.spd == g).any() else None}
                        for g in ("fast", "middle", "slow")},
             "rho_days": round(float(spearmanr(u.deals_sent, u.days_uc)[0]), 2) if len(u) > 5 else None,
             "coverage": {"with_uc": round(float(sig[sig.uc.notna()].deals_sent.notna().mean()), 3),
                          "hunting": round(float(sig[sig.hunting].deals_sent.notna().mean()), 3),
                          "hunting_n": int(sig.hunting.sum()), "hunting_with_count": int(sig[sig.hunting].deals_sent.notna().sum())},
             "dated_log": False}

    lag = (pd.to_datetime(m75.ts) - m75.start).dt.days
    # prior offers on day 14 and day 30, the SAME clients: every matched start with at least 30 days of follow-up (no outcome filter), so both
    # windows share one denominator; the day-14 count can rest on fewer than 5 searches (marked small, published as a rate with its base)
    mm = co[co.matched & (co.elapsed >= FAST)]
    offers_d = []
    for key, lab in OFFERS:
        g = mm[mm.offers == key]
        k14, k30 = int(g.days_uc.between(0, 14).sum()), int(g.days_uc.between(0, FAST).sum())
        offers_d.append({"key": key, "label": lab, "n": int(len(g)), "k14": k14, "k30": k30,
                         "share14": round(k14 / len(g), 4) if len(g) else None, "share30": round(k30 / len(g), 4) if len(g) else None,
                         "small14": bool(0 < k14 < MIN_CELL), "small30": bool(0 < k30 < MIN_CELL)})
    # Jira Deal Number Purchased (which deal STRSearch sent became the purchase), searches under contract by day 30, by start period
    sm = co.start.dt.strftime("%Y-%m")
    u30 = co[co.days_uc.between(0, FAST)]
    def _num(lo, hi):
        g = u30[(sm.loc[u30.index] >= lo) & (sm.loc[u30.index] <= hi)]
        v = pd.to_numeric(g.deal_number_purchased, errors="coerce").dropna()
        return {"from": lo, "to": hi, "uc30": int(len(g)), "n": int(len(v)), "median": float(v.median()) if len(v) else None,
                "p25": float(v.quantile(.25)) if len(v) else None, "p75": float(v.quantile(.75)) if len(v) else None}
    deals["number_purchased"] = {"early": _num("2026-01", "2026-05"), "late": _num("2026-06", "2026-09"),
                                 "field": "Jira Deal Number Purchased (deal_number_purchased)", "window": FAST}
    return {
        "form_from": form.ts.min().strftime("%Y-%m-%d"), "min_days": MIN_DAYS, "fast_days": FAST,
        "eligible_through": (ctx.asof - pd.Timedelta(days=MIN_DAYS)).strftime("%Y-%m-%d"),
        "population": "won engagements with a confirmed Jira start",
        "composition": {"n": int(len(e75)), "groups": composition, "stopped_no_contract": int(len(stopped)),
                        "all_eligible": int((co.elapsed >= MIN_DAYS).sum()), "all_fast": int((co[co.elapsed >= MIN_DAYS].days_uc.between(0, FAST)).sum()),
                        "stopped_by_status": {k: int(v) for k, v in stopped.status.value_counts().items()}},
        "bases": {"d30": {"eligible": int(len(e30)), "matched": int(len(m30)), "share": round(float(m30.within30.mean()), 4) if len(m30) else None},
                  "d75": {"eligible": int(len(e75)), "matched": int(len(m75)), "share": round(float(m75.within75.mean()), 4) if len(m75) else None}},
        "matching": dict(match_info, answer_lag_days={"median": float(lag.median()) if len(lag) else None, "max": float(lag.max()) if len(lag) else None},
                         cohort_matched=int(co.matched.sum()), cohort_n=int(len(co)),
                         answers_after_uc_used=int((co.matched & co.uc.notna() & (pd.to_datetime(co.ts).dt.normalize() >= co.uc)).sum())),
        "capital": {"pipedrive": pd_surv, "form": form_surv, "everyone_from": 200, "top_option": 500},
        "offers": {"rows": offers, "same_clients": {"n": int(len(mm)), "from": mm.start.min().strftime("%Y-%m-%d"), "to": mm.start.max().strftime("%Y-%m-%d"), "rows": offers_d},
                   "trend": trend30, "gap_3plus_vs_0": off_gap,
                   "logrank_p": round(float(lr[1]), 3) if lr[1] is not None else None,
                   "source": "Onboarding questionnaire (Form Responses 2), column AA: self-reported experience submitting real-estate offers before STRSearch"},
        "tested": tested,
        "deals": deals,
        "matched_cohort": {"from": m30.start.min().strftime("%Y-%m-%d") if len(m30) else None,
                           "to": m30.start.max().strftime("%Y-%m-%d") if len(m30) else None},
    }
