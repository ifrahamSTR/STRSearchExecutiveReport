"""Chapter 5: what distinguishes fast and slow clients?

Speed groups (unchanged, from the Explorer's recorded days to first Under Contract): fast <= 30 days, middle 31-74,
slow >= 75, and still searching (no Under Contract yet, Searching status) kept apart from completed slow purchases.

Shares are only taken where every client has had time to reach the milestone:
  - "under contract within 30 days": clients with 30+ days on the clock
  - "under contract within 75 days" and the four-group mix: clients with 75+ days on the clock
The slow / still-searching split depends on how long a client has been on the clock, so comparisons use
"within 75 days" (fully observed for everyone in that base) and show the split only as context.

Onboarding answers come from the current form ("Form Responses 2", first response 20 Apr 2026):
  M  total all-in out-of-pocket capital (not purchase budget). Ranges are read at their upper end
     ("$250K-$300K" counts as $300K); "$500K+" is the top option, so no threshold above $500K exists.
  N  liquidity, O budget flexibility, P investment approach, Q renovation level, U specific markets,
  AA real-estate offers submitted, AB other Airbnbs owned.
Matching to Jira: client e-mail (preferred or secondary answer vs Jira Client_Email and Additional_Emails, hashed).
Column AH is headed "Person ID" but holds Pipedrive DEAL ids: read as a deal id it agrees with the e-mail match
almost every time, read against Jira's person id (PD_Contact_ID) it never does (both counts are published and
checked on each build). It is used only as a deal-id fallback and never overrides an e-mail match.
The answer used is the latest one given up to 30 days after client start and before the first Under Contract date.

Deals seen = Jira Total_Deals_Sent. The count appears to stop at Under Contract (checked below), so for clients
who reached a contract it approximates deals seen before committing. There is no dated record of each deal, so
exposure over the same time window cannot be compared.

Output is aggregates only: no e-mail, hash, id or record leaves this module, and no share rests on 1-4 clients.
"""
from __future__ import annotations

import hashlib
import re
import warnings

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import spearmanr
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import confint_proportions_2indep

import core as C

WORKBOOK = "Onboarding STR Search (Responses).xlsx"
SHEET = "Form Responses 2"
COLS = {  # in sheet order: letter -> (name, text the header must contain)
    "A": ("ts", "Timestamp"), "D": ("email", "Preferred Email"), "E": ("email2", "Secondary Email"),
    "M": ("capital", "out-of-pocket capital"), "N": ("liquid", "liquid and ready to deploy"), "O": ("budget", "Budget flexibility"),
    "P": ("approach", "investment approach"), "Q": ("reno", "level of renovations"), "U": ("markets", "specific markets"),
    "AA": ("offers", "experience submitting offers"), "AB": ("airbnbs", "How many other Airbnbs"), "AH": ("form_deal", "Person ID"),
}
FAST, SLOW, MIN_DAYS, ANSWER_AFTER, MIN_CELL = 30, 75, 75, 30, 5
THRESHOLDS = [250, 300, 350, 400, 450, 500]        # $K; $200K+ would include every client (lowest option $150K-$200K)
NCE_DATE = pd.Timestamp("2026-05-27")
GROUPS = [("fast", "Under Contract within 30 days"), ("middle", "31–74 days"), ("slow", "75 days or longer"),
          ("searching", "Still searching, no contract yet")]
OFFERS = [("0", "No offers yet"), ("1-2", "1–2 offers"), ("3+", "3+ offers")]


def _h(email) -> str | None:
    e = "" if email is None or pd.isna(email) else str(email).strip().lower()
    return hashlib.sha256(e.encode()).hexdigest() if e else None


def _cap_upper(v) -> float:
    s = "" if pd.isna(v) else str(v).strip()
    k = re.findall(r"\$(\d+)\s*K", s)
    if not k:
        return np.nan
    if s.endswith("+"):                      # open-ended: "$500K+" is the top option; "$400K+" is unknown above $400K
        return 500.0 if k[0] == "500" else -float(k[0])
    return float(k[-1])                      # bounded range -> its upper end


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
        "form_deal": pd.to_numeric(raw.form_deal, errors="coerce"),
        "cap": raw.capital.map(_cap_upper),
        "liquid": raw.liquid.map(lambda v: _starts(v, ("All", "all"), ("Most", "most"), default="some")),
        "budget": raw.budget.map(lambda v: _starts(v, ("Strict", "strict"), ("Some", "some"), default="flexible")),
        "property": [("turnkey" if str(a).startswith("Turnkey") else "light" if str(r).startswith("Light") else "value_add")
                     for a, r in zip(raw.approach, raw.reno)],
        "markets": raw.markets.map(lambda v: _starts(v, ("Yes", "specific"), default="open")),
        "offers": np.where(off.str.contains("No experience"), "0", np.where(off.str.contains("1–2|1-2"), "1-2", "3+")),
        "airbnb": raw.airbnbs.map(lambda v: "none" if str(v).split(".")[0].strip() == "0" else "owns"),
    })


def _jira_hashes(ctx: C.Ctx) -> dict:
    """Every e-mail hash per Jira issue: Client_Email (the Explorer's _email_hash) plus Additional_Emails."""
    extra = ctx.raw["jira"].reset_index(drop=True)["Additional_Emails"].astype("string").fillna("").str.split(r"[,;\s]+")
    return {i: {x for x in {ctx.jira.at[i, "_email_hash"]} | {_h(e) for e in extra.iloc[i] if "@" in e} if x} for i in ctx.jira.index}


def _identifier_check(ctx: C.Ctx, form: pd.DataFrame, by_hash: dict) -> dict:
    """How column AH behaves: as a Pipedrive deal id (Jira PD_Deal_ID) or as a person id (Jira PD_Contact_ID)?
    Counted against the independent e-mail match: agrees / conflicts."""
    rj = ctx.raw["jira"].reset_index(drop=True)
    tables = {"deal": pd.to_numeric(rj["PD_Deal_ID"], errors="coerce"), "person": pd.to_numeric(rj["PD_Contact_ID"], errors="coerce")}
    out = {}
    for key, ids in tables.items():
        look = {}
        for i, v in ids.items():
            if pd.notna(v):
                look.setdefault(int(v), set()).add(i)
        agree = conflict = 0
        for _, r in form[form.form_deal.notna()].iterrows():
            hit = look.get(int(r.form_deal), set())
            em = set().union(*(by_hash.get(k, set()) for k in (r.h1, r.h2) if k))
            if hit and em:
                agree += bool(hit & em)
                conflict += not (hit & em)
        out[key] = {"agree": agree, "conflict": conflict}
    return out


def _match(ctx: C.Ctx, s: pd.DataFrame, form: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    hashes = _jira_hashes(ctx)
    issue_by_hash = {}
    for i, hs in hashes.items():
        for x in hs:
            issue_by_hash.setdefault(x, set()).add(i)
    rows_by_hash, rows_by_deal = {}, {}
    for i, r in form.iterrows():
        for k in (r.h1, r.h2):
            if k:
                rows_by_hash.setdefault(k, set()).add(i)
        if pd.notna(r.form_deal):
            rows_by_deal.setdefault(int(r.form_deal), set()).add(i)
    row_issues = {i: set().union(*(issue_by_hash.get(k, set()) for k in (r.h1, r.h2) if k)) for i, r in form.iterrows()}
    picked, via_deal_only, rejected, after_uc = [], 0, 0, 0
    for idx, c in s.iterrows():
        by_mail = set().union(*(rows_by_hash.get(x, set()) for x in hashes[idx]))
        by_deal = rows_by_deal.get(int(c.deal_id), set()) if pd.notna(c.deal_id) else set()
        ok = {i for i in by_deal if not row_issues[i] or idx in row_issues[i]}      # e-mail wins any conflict
        rejected += len(by_deal - ok)
        cand = form.loc[sorted(by_mail | ok)] if (by_mail or ok) else form.iloc[0:0]
        cand = cand[cand.ts <= c.start + pd.Timedelta(days=ANSWER_AFTER)]
        before = cand[cand.ts.dt.normalize() < c.uc] if pd.notna(c.uc) else cand   # the answer must precede the contract
        after_uc += int(len(cand) > 0 and len(before) == 0)
        pick = before.sort_values("ts").index[-1] if len(before) else None
        via_deal_only += int(pick is not None and pick not in by_mail)
        picked.append(pick)
    cols = ["ts", "cap", "liquid", "budget", "property", "markets", "offers", "airbnb"]
    out = pd.DataFrame({col: [form.at[i, col] if i is not None else None for i in picked] for col in cols}, index=s.index)
    out["matched"] = [i is not None for i in picked]
    ident = _identifier_check(ctx, form, issue_by_hash)
    return out, {"identifier": ident, "via_deal_only": via_deal_only, "rejected_conflicts": rejected, "only_after_uc": after_uc}


# ----------------------------------------------------------------------------- small helpers
def _share(k, n):
    k, n = int(k), int(n)
    return None if n < MIN_CELL or 0 < k < MIN_CELL else round(k / n, 4)


def _cell(mask: pd.Series) -> dict:
    """n, k and share; a suppressed share also hides its count."""
    mask = mask.astype(bool)
    share = _share(mask.sum(), len(mask))
    return {"n": int(len(mask)), "k": int(mask.sum()) if share is not None else None, "share": share}


def _diff_ci(a: pd.Series, b: pd.Series) -> list:
    lo, hi = confint_proportions_2indep(int(a.sum()), len(a), int(b.sum()), len(b), method="newcomb")
    return [round(float(lo), 3), round(float(hi), 3)]


def _logit_p(y: pd.Series, X: pd.DataFrame, term: str) -> dict:
    try:
        r = sm.Logit(y.astype(float), sm.add_constant(X.astype(float), has_constant="add")).fit(disp=0)
        ci = r.conf_int().loc[term]
        return {"or": round(float(np.exp(r.params[term])), 2), "lo": round(float(np.exp(ci[0])), 2),
                "hi": round(float(np.exp(ci[1])), 2), "p": round(float(r.pvalues[term]), 4)}
    except Exception:          # tiny cells can stop the fit from converging
        return {"or": None, "lo": None, "hi": None, "p": None}


def _era(df: pd.DataFrame) -> pd.DataFrame:
    era = np.where(df.start < NCE_DATE, "classic", np.where(df.pd_experience == "New Client Experience", "nce", "other"))
    return pd.get_dummies(pd.Series(era, index=df.index), drop_first=True).astype(float)


def build(ctx: C.Ctx, onboarding_path=None) -> dict:
    path = onboarding_path or (C.ROOT.parent / "12 Nov 26 Reports" / "DataDrive" / WORKBOOK)
    form = load_form(path)
    s = ctx.signed.copy()
    s["spd"] = np.select(       # the existing speed groups (s.group is the Explorer's status group)
        [s.days_uc.notna() & (s.days_uc <= FAST), s.days_uc.notna() & (s.days_uc >= SLOW), s.days_uc.notna(),
         s.uc.isna() & (s.group == "Searching")],
        ["fast", "slow", "middle", "searching"], default="")
    answers, match_info = _match(ctx, s, form)
    s = s.join(answers)
    s["within30"] = s.days_uc.notna() & (s.days_uc <= FAST)
    s["within75"] = s.days_uc.notna() & (s.days_uc < SLOW)
    classifiable = s.spd != ""
    e75 = s[classifiable & (s.elapsed >= MIN_DAYS)]                 # every client here had 75 days to reach a contract
    e30 = s[classifiable & (s.elapsed >= FAST)]                     # every client here had 30 days
    m75, m30 = e75[e75.matched], e30[e30.matched]

    # 1. who moves quickly: all clients with 75+ days on the clock
    composition = [{"key": g, "label": lab, "n": int((e75.spd == g).sum()),
                    "median_days": (float(e75[e75.spd == g].days_uc.median()) if g != "searching" else None),
                    "median_elapsed": (float(e75[e75.spd == g].elapsed.median()) if g == "searching" else None)} for g, lab in GROUPS]

    # 2. capital thresholds (upper end of each range); ambiguous "$400K+" answers only count up to $400K
    def at_or_above(df, t):
        c = df.cap.astype(float)
        known = (c > 0) | ((c < 0) & (t <= -c))
        return df[known], ((c >= t) | ((c < 0) & (t <= -c)))[known]

    cap_rows = []
    for t in THRESHOLDS:
        row = {"t": t}
        for key, df, col in (("d30", m30, "within30"), ("d75", m75, "within75")):
            d, a = at_or_above(df[df.cap.notna()], t)
            row[key] = {"at": _cell(d[a][col]), "below": _cell(d[~a][col]), "diff_ci": _diff_ci(d[a][col], d[~a][col])}
        d, a = at_or_above(m75[m75.cap.notna()], t)
        row["median_days"] = {"at": float(d[a].days_uc.median()), "below": float(d[~a].days_uc.median())}
        cap_rows.append(row)
    rng = np.random.default_rng(20261111)

    def family_p(df, col):        # chance of a gap this large at the best of all thresholds tested, by shuffling capital
        d = df[df.cap.astype(float) > 0]
        caps, y = d.cap.astype(float).values, d[col].values.astype(float)

        def zmax(c):
            z = []
            for t in THRESHOLDS:
                a = c >= t
                p = y.mean()
                z.append(abs(y[a].mean() - y[~a].mean()) / np.sqrt(p * (1 - p) * (1 / a.sum() + 1 / (~a).sum())))
            return max(z)
        obs = zmax(caps)
        return round(float(np.mean([zmax(rng.permutation(caps)) >= obs for _ in range(4000)])), 3)

    reached = m75[m75.days_uc.notna() & (m75.cap.astype(float) > 0)]
    capital = {
        "rows": cap_rows, "everyone_from": 200, "top_option": 500,
        "family_p": {"d30": family_p(m30, "within30"), "d75": family_p(m75, "within75")},
        "rho_days": round(float(spearmanr(reached.cap.astype(float), reached.days_uc)[0]), 3),
        "widest_gap_ci": round(float(max(max(abs(v) for v in r[k]["diff_ci"]) for r in cap_rows for k in ("d30", "d75"))), 2),
        "ambiguous_400plus": int((m75.cap.astype(float) < 0).sum()),
    }

    # 3. the answers tested, era-adjusted, with a Holm correction across all of them (both outcomes)
    def flags(df):
        return pd.DataFrame({
            "capital": df.cap.astype(float).clip(lower=0) / 100,
            "liquidity": (df.liquid == "some").astype(float),
            "budget": (df.budget == "strict").astype(float),
            "markets": (df.markets == "specific").astype(float),
            "property": (df.property != "value_add").astype(float),
            "offers": df.offers.map({"0": 0, "1-2": 1, "3+": 2}).astype(float),
            "airbnb": (df.airbnb == "owns").astype(float),
        }, index=df.index)
    labels = {"capital": "All-in capital (per $100K)", "liquidity": "Capital partly tied up (not liquid)", "budget": "Strict budget",
              "markets": "Named specific markets", "property": "Turnkey or light renovation only",
              "offers": "Real-estate offers submitted (0 / 1–2 / 3+)", "airbnb": "Already owns an Airbnb"}
    f30, f75 = flags(m30), flags(m75)
    tested = []
    for k, lab in labels.items():
        r30 = _logit_p(m30.within30, pd.concat([f30[[k]], _era(m30)], axis=1), k)
        r75 = _logit_p(m75.within75, pd.concat([f75[[k]], _era(m75)], axis=1), k)
        tested.append({"key": k, "label": lab, "within30": r30, "within75": r75})
    ps = [t[o]["p"] if t[o]["p"] is not None else 1.0 for t in tested for o in ("within30", "within75")]
    holm = multipletests(ps, method="holm")[1]
    for i, t in enumerate(tested):
        t["within30"]["p_holm"], t["within75"]["p_holm"] = round(float(holm[2 * i]), 3), round(float(holm[2 * i + 1]), 3)
    adjusted_all = _logit_p(m30.within30, pd.concat([f30, _era(m30)], axis=1), "offers")

    # does lower capital (<= $250K, the two lowest answers) matter more alongside another constraint?
    interactions = []
    for k in ("budget", "liquidity", "markets", "property"):
        row = {"key": k, "label": labels[k]}
        for out, df, f, col in (("within30", m30, f30, "within30"), ("within75", m75, f75, "within75")):
            low = ((df.cap.astype(float) > 0) & (df.cap.astype(float) <= 250)).astype(float)
            X = pd.DataFrame({"low": low, "c": f[k], "both": low * f[k]}, index=df.index)
            row[out] = _logit_p(df[col], pd.concat([X, _era(df)], axis=1), "both")["p"]
        interactions.append(row)
    p0 = float(m75.within75.mean())          # smallest gap detectable with 80% power, splitting the 75-day base in half
    half = len(m75) / 2
    detectable = next(g for g in np.arange(0.05, 0.6, 0.01)
                      if NormalIndPower().power(abs(2 * np.arcsin(np.sqrt(min(p0 + g, 0.999))) - 2 * np.arcsin(np.sqrt(p0))), nobs1=half, ratio=1.0, alpha=0.05) >= 0.8)

    # 4. offer experience
    offers = []
    for key, lab in OFFERS:
        a, b = m30[m30.offers == key], m75[m75.offers == key]
        offers.append({"key": key, "label": lab, "within30": _cell(a.within30), "within75": _cell(b.within75),
                       "median_days": float(b.days_uc.median())})
    monthly = []
    for p, g in m30.groupby(m30.start.dt.to_period("M")):
        sh = {k: (g[g.offers == k].within30.mean() if (g.offers == k).sum() >= MIN_CELL else None) for k, _ in OFFERS}
        if sh["0"] is not None and sh["3+"] is not None:
            monthly.append({"month": str(p), "more_experienced_faster": bool(sh["3+"] > sh["0"])})
    off_gap = _diff_ci(m30[m30.offers == "3+"].within30, m30[m30.offers == "0"].within30)

    # 5. location: named specific markets vs open to any market (weaker signal)
    markets = {k: _cell(~m75[m75.markets == k].within75) for k in ("specific", "open")}

    # 6. deals seen (Jira Total_Deals_Sent), all clients with 75+ days on the clock who reached a contract
    rj = ctx.raw["jira"].reset_index(drop=True)
    last = pd.to_datetime(rj.loc[s.index, "Deal_Last_Sent_Date"], errors="coerce")
    last = last.dt.tz_localize(None) if getattr(last.dt, "tz", None) is not None else last
    both = s[last.notna() & s.uc.notna()]
    lb = last[both.index]
    u = e75[e75.days_uc.notna() & e75.deals_sent.notna()].copy()
    u["since_uc"] = (ctx.asof - u.uc).dt.days
    deals = {"groups": {}, "searching_with_count": [int(e75[e75.spd == "searching"].deals_sent.notna().sum()), int((e75.spd == "searching").sum())],
             "last_sent": {"n": int(len(both)), "on_or_before_uc": int((lb.dt.normalize() <= both.uc).sum())},
             "since_uc_rho": {}}
    for g in ("fast", "middle", "slow"):
        d = u[u.spd == g]
        rate = d.deals_sent / d.days_uc.clip(lower=1) * 30
        deals["groups"][g] = {"n": int(len(d)), "p25": float(d.deals_sent.quantile(.25)), "median": float(d.deals_sent.median()),
                              "p75": float(d.deals_sent.quantile(.75)), "per_30_days": round(float(rate.median()), 1),
                              "median_days": float(d.days_uc.median())}
        deals["since_uc_rho"][g] = round(float(spearmanr(d.deals_sent, d.since_uc)[0]), 2)

    in_window = e75[e75.start >= form.ts.min().normalize() - pd.Timedelta(days=ANSWER_AFTER)]
    lag = (pd.to_datetime(m75.ts) - m75.start).dt.days
    return {
        "form_from": form.ts.min().strftime("%Y-%m-%d"), "min_days": MIN_DAYS, "fast_days": FAST,
        "eligible_through": (ctx.asof - pd.Timedelta(days=MIN_DAYS)).strftime("%Y-%m-%d"),
        "fast_base_through": (ctx.asof - pd.Timedelta(days=FAST)).strftime("%Y-%m-%d"),
        "composition": {"n": int(len(e75)), "groups": composition},
        "bases": {"d30": {"eligible": int(len(e30)), "matched": int(len(m30)), "share": round(float(m30.within30.mean()), 4)},
                  "d75": {"eligible": int(len(e75)), "matched": int(len(m75)), "share": round(float(m75.within75.mean()), 4),
                          "in_form_window": int(len(in_window)), "matched_in_window": int(in_window.matched.sum())}},
        "matching": dict(match_info, answer_lag_days={"median": float(lag.median()), "max": float(lag.max())},
                         signed_matched=int(s.matched.sum()),
                         answers_after_uc_used=int((s.matched & s.uc.notna() & (pd.to_datetime(s.ts).dt.normalize() >= s.uc)).sum())),
        "capital": capital,
        "offers": {"rows": offers, "trend": tested[[t["key"] for t in tested].index("offers")]["within30"],
                   "adjusted_all": adjusted_all, "gap_3plus_vs_0": off_gap, "monthly": monthly},
        "markets": markets,
        "tested": tested,
        "interactions": interactions, "detectable_gap": round(float(detectable), 2),
        "matched_cohort": {"from": m30.start.min().strftime("%Y-%m-%d"), "to": m30.start.max().strftime("%Y-%m-%d"),
                           "since_new_experience": round(float((m75.start >= NCE_DATE).mean()), 3)},
        "deals": deals,
    }
