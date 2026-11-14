"""Chapter 5: what distinguishes fast and slow clients?

A descriptive comparison, by recorded days to first Under Contract (the Explorer's days_uc):
fast <= 30 days, middle 31-74, slow >= 75. Clients still searching (no Under Contract yet) stay a separate group.
Only clients with at least 75 days on the clock are compared, so every client had the chance to be slow.

Onboarding answers come from the current form ("Form Responses 2", first response 20 Apr 2026):
column M = total all-in out-of-pocket capital (not the purchase budget), AA = real-estate offers submitted,
AB = other Airbnbs owned. They are matched to Jira by hashed e-mail (preferred or secondary, the Explorer's
_email_hash rule) or by the Pipedrive deal id the form stores in column AH; the latest answer given up to
30 days after the client start is used. Deals Seen = the Jira field Total_Deals_Sent (deals the acquisition
team sent to the client), available without the form.

Output is aggregates only: no e-mail, hash or record leaves this module, and any count from 1 to 4 is suppressed.
"""
from __future__ import annotations

import hashlib
import re
import warnings

import numpy as np
import pandas as pd
from scipy.stats import fisher_exact

import core as C

WORKBOOK = "Onboarding STR Search (Responses).xlsx"
SHEET = "Form Responses 2"
COLS = {"A": ("ts", "Timestamp"), "D": ("email", "Preferred Email"), "E": ("email2", "Secondary Email"),
        "M": ("capital", "out-of-pocket capital"), "AA": ("offers", "experience submitting offers"),
        "AB": ("airbnbs", "How many other Airbnbs"), "AH": ("deal", "Person ID")}
FAST, SLOW, MIN_DAYS, ANSWER_AFTER, MIN_CELL = 30, 75, 75, 30, 5
GROUPS = [("fast", "Under Contract within 30 days"), ("middle", "31–74 days"), ("slow", "75 days or longer"),
          ("searching", "Still searching, no contract yet")]


def _h(email) -> str | None:
    e = "" if email is None or pd.isna(email) else str(email).strip().lower()
    return hashlib.sha256(e.encode()).hexdigest() if e else None


def _capital(v) -> str | None:
    m = re.search(r"\$(\d+)\s*K", "" if pd.isna(v) else str(v))
    lo = int(m.group(1)) if m else None
    return None if lo is None else "<200" if lo < 200 else "200-300" if lo < 300 else "300+"


def _offers(v) -> str | None:
    s = "" if pd.isna(v) else str(v)
    return "0" if "No experience" in s else "1-2" if ("1–2" in s or "1-2" in s) else "3+" if "3+" in s else None


def _airbnbs(v) -> str | None:
    s = "" if pd.isna(v) else str(v).strip().split(".")[0]
    return s if s in ("0", "1") else "2+" if s.endswith("+") or (s.isdigit() and int(s) >= 2) else None


def load_form(path) -> pd.DataFrame:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        raw = pd.read_excel(path, sheet_name=SHEET, usecols=",".join(COLS))
    for (letter, (name, cue)), header in zip(COLS.items(), raw.columns):
        if cue.lower() not in " ".join(str(header).split()).lower():
            raise SystemExit(f"Onboarding form column {letter} no longer holds '{cue}'. The form layout has changed.")
    raw.columns = [v[0] for v in COLS.values()]
    return pd.DataFrame({
        "ts": pd.to_datetime(raw.ts, errors="coerce"), "h1": raw.email.map(_h), "h2": raw.email2.map(_h),
        "deal": pd.to_numeric(raw.deal, errors="coerce"),
        "capital": raw.capital.map(_capital), "offers": raw.offers.map(_offers), "airbnbs": raw.airbnbs.map(_airbnbs),
    })


def _answers(s: pd.DataFrame, form: pd.DataFrame) -> pd.DataFrame:
    by_email, by_deal = {}, {}
    for i, r in form.iterrows():
        for k in (r.h1, r.h2):
            if k:
                by_email.setdefault(k, set()).add(i)
        if pd.notna(r.deal):
            by_deal.setdefault(int(r.deal), set()).add(i)
    picked = []
    for _, c in s.iterrows():
        idx = set(by_email.get(c._email_hash, ())) | (set(by_deal.get(int(c.deal_id), ())) if pd.notna(c.deal_id) else set())
        rows = form.loc[sorted(idx)] if idx else form.iloc[0:0]
        rows = rows[rows.ts <= c.start + pd.Timedelta(days=ANSWER_AFTER)]
        picked.append(rows.sort_values("ts").index[-1] if len(rows) else None)
    out = pd.DataFrame(index=s.index)
    for col in ("capital", "offers", "airbnbs"):
        out[col] = [form.at[i, col] if i is not None else None for i in picked]
    out["matched"] = [i is not None for i in picked]
    return out


def build(ctx: C.Ctx, onboarding_path=None) -> dict:
    path = onboarding_path or (C.ROOT.parent / "12 Nov 26 Reports" / "DataDrive" / WORKBOOK)
    form = load_form(path)
    s = ctx.signed.copy()
    s["group"] = np.select(
        [s.days_uc.notna() & (s.days_uc <= FAST), s.days_uc.notna() & (s.days_uc >= SLOW), s.days_uc.notna(),
         s.uc.isna() & (s.group == "Searching")],
        ["fast", "slow", "middle", "searching"], default="")
    s = s.join(_answers(s, form))
    elig = s[(s.elapsed >= MIN_DAYS) & (s.group != "")]
    m = elig[elig.matched]

    def share_row(key, label, test):
        out = {"key": key, "label": label, "shares": {}, "n": {}}
        for g, _ in GROUPS:
            gg = m[m.group == g]
            answered = gg[gg[test[0]].notna()]
            k = int(answered[test[0]].isin(test[1]).sum())
            out["n"][g] = int(len(answered))
            out["shares"][g] = None if (0 < k < MIN_CELL or len(answered) < MIN_CELL) else round(k / len(answered), 4)
        f, sl = m[m.group == "fast"], m[m.group == "slow"]
        kf, ks = int(f[test[0]].isin(test[1]).sum()), int(sl[test[0]].isin(test[1]).sum())
        out["p_fast_slow"] = round(float(fisher_exact([[kf, len(f) - kf], [ks, len(sl) - ks]])[1]), 3)
        return out

    rows = [
        share_row("offers3", "Has submitted 3+ real-estate offers", ("offers", ["3+"])),
        share_row("airbnb", "Already owns at least one Airbnb", ("airbnbs", ["1", "2+"])),
        share_row("cap300", "Capital (all-in, out of pocket) of $300K+", ("capital", ["300+"])),
        share_row("cap200", "Capital (all-in, out of pocket) under $200K", ("capital", ["<200"])),
    ]

    # Deals Seen: Total_Deals_Sent from Jira, all eligible signed clients (no form needed)
    deals = {}
    for g, _ in GROUPS:
        d = elig[elig.group == g].deals_sent.dropna()
        deals[g] = {"n": int(len(d)), "p25": float(d.quantile(0.25)), "median": float(d.median()), "p75": float(d.quantile(0.75))} if len(d) >= MIN_CELL else None
    return {
        "form_from": form.ts.min().strftime("%Y-%m-%d"), "min_days": MIN_DAYS,
        "eligible_through": (ctx.asof - pd.Timedelta(days=MIN_DAYS)).strftime("%Y-%m-%d"),
        "groups": [{"key": g, "label": lab, "eligible": int((elig.group == g).sum()), "matched": int((m.group == g).sum())} for g, lab in GROUPS],
        "rows": rows, "deals": deals,
        "signed_matched": int(s.matched.sum()),
    }
