"""Operational throughput: is acquisition output keeping pace with incoming clients?

Calendar view (who entered, who reached a milestone, each month) and same-cohort view (of the
clients who started in a month, how many were under contract N days later).
"""
from __future__ import annotations

import pandas as pd

import core as C

FIRST_MONTH = "2025-01"


def build(ctx: C.Ctx) -> dict:
    j, s_all = ctx.jira, ctx.signed
    asof = ctx.asof
    s = s_all[~s_all.uc_time_unknown].copy()
    # Day a client left the pool of open searches: went under contract (logged, or inferred from a
    # closing) or, failing that, paused / refunded (date of the latest status change).
    exit_date = s.exit_date.where(~s.uc_evt)
    refund_date = exit_date.where(s.stage == "Refunded")
    uc_all = j.uc_adj_date.where(j.uc_evt)          # logged UC dates plus those inferred from a closing
    s["left_search"] = s.uc_adj_date.where(s.uc_evt).fillna(exit_date)

    months = pd.period_range(FIRST_MONTH, asof.to_period("M"), freq="M")
    rows = []
    for m in months:
        a, b = m.start_time, min(m.end_time.normalize(), asof)
        between = lambda col: int(((col >= a) & (col <= b)).sum())
        rows.append({
            "month": str(m), "label": C.month_label(m), "partial": bool(m.end_time.normalize() > asof),
            "new": between(s_all.start), "uc": between(j.uc), "uc_all": between(uc_all), "closed": between(j.closed),
            "won": between(ctx.won.won_date), "exits": between(exit_date), "refunds": between(refund_date),
            "open_searches": int(((s.start <= b) & (s.left_search.isna() | (s.left_search > b))).sum()),
            "open_over_60": int(((s.start <= b - pd.Timedelta(days=60)) & (s.left_search.isna() | (s.left_search > b))).sum()),
        })
    t = pd.DataFrame(rows)
    t["uc_rate"] = (t.uc / t.open_searches.shift()).round(4)
    rows = [{**r, "uc_rate": C.r(u)} for r, u in zip(rows, t.uc_rate)]

    complete = t[~t.partial]
    post = complete[complete.month >= C.POST_CHANGE_FIRST_MONTH]
    pre = complete[complete.month < C.POST_CHANGE_FIRST_MONTH].tail(len(post))

    def period(g):
        return {"label": f"{C.month_label(g.month.iloc[0]).split()[0]} – {C.month_label(g.month.iloc[-1])}", "months": int(len(g)),
                "first": g.month.iloc[0], "last": g.month.iloc[-1],
                "new": int(g.new.sum()), "uc": int(g.uc.sum()), "closed": int(g.closed.sum()), "won": int(g.won.sum()),
                "new_avg": C.r(g.new.mean(), 1), "uc_avg": C.r(g.uc.mean(), 1), "uc_all_avg": C.r(g.uc_all.mean(), 1), "closed_avg": C.r(g.closed.mean(), 1),
                "won_avg": C.r(g.won.mean(), 1), "open_avg": C.r(g.open_searches.mean(), 1), "uc_rate_avg": C.r(g.uc_rate.mean())}

    pre_p, post_p = period(pre), period(post)

    # ---- same-cohort conversion by start month
    s["m"] = s.start.dt.to_period("M")
    cohort = []
    for m, g in s[s.start >= pd.Timestamp(C.RELIABLE_FROM)].groupby("m"):
        row = {"month": str(m), "label": C.month_label(m), "n": int(len(g)), "windows": {}}
        for w in (60, 90):
            mat = g[g.elapsed >= w]
            num = int((mat.uc_evt & (mat.t_uc <= w)).sum())
            row["windows"][str(w)] = {"num": num, "den": int(len(mat)), "share": C.r(num / len(mat)) if len(mat) else None,
                                      "complete": bool(m.end_time.normalize() + pd.Timedelta(days=w) <= asof)}
        cohort.append(row)

    def cohort_rate(first, last, w):
        sel = [c for c in cohort if first <= c["month"] <= last and c["windows"][str(w)]["complete"]]
        num, den = sum(c["windows"][str(w)]["num"] for c in sel), sum(c["windows"][str(w)]["den"] for c in sel)
        return {"months": [sel[0]["label"], sel[-1]["label"]] if sel else None, "num": num, "den": den,
                "share": C.r(num / den) if den else None}

    cohort_compare = {str(w): {"pre": cohort_rate(pre_p["first"], pre_p["last"], w),
                               "post": cohort_rate(post_p["first"], post_p["last"], w)} for w in (60, 90)}

    # ---- how long after starting do UC events happen (recent complete months)
    ucs = j[j.uc.notna()].copy()
    ucs["lag"] = (ucs.uc.dt.year - ucs.start.dt.year) * 12 + (ucs.uc.dt.month - ucs.start.dt.month)
    recent = ucs[(ucs.uc.dt.to_period("M").astype(str) >= post_p["first"]) & (ucs.uc.dt.to_period("M").astype(str) <= post_p["last"])]
    lag = {"n": int(len(recent)), "same_month": int((recent.lag == 0).sum()), "one_month": int((recent.lag == 1).sum()),
           "two_months": int((recent.lag == 2).sum()), "three_plus": int((recent.lag >= 3).sum())}

    peak = complete.loc[complete.open_searches.idxmax()]
    # flows into and out of the open-search pool since its peak month end
    p_end = pd.Period(peak.month, "M").end_time.normalize()
    win = lambda col: int(((col > p_end) & (col <= asof)).sum())
    went_uc = s.left_search.where(s.uc_evt)
    since_peak = {"from": p_end.strftime("%Y-%m-%d"), "entered": win(s.start), "went_uc": win(went_uc), "exited": win(exit_date),
                  "refunded": win(refund_date), "start": int(peak.open_searches), "end": int(t.open_searches.iloc[-1])}
    part = t.iloc[-1]
    recent = {"label": part.label, "days": int(asof.day), "new": int(part.new), "won": int(part.won),
              "new_pace_30": C.r(part.new / asof.day * 30, 0), "won_pace_30": C.r(part.won / asof.day * 30, 0),
              "partial": bool(part.partial)}
    return {
        "monthly": rows,
        "pre": pre_p, "post": post_p,
        "ratio": {k: C.r(post_p[f"{k}_avg"] / pre_p[f"{k}_avg"], 2) for k in ("new", "uc", "uc_all", "closed", "won")},
        "since_peak": since_peak,
        "cohort": cohort, "cohort_compare": cohort_compare, "lag": lag,
        "open_searches": {"peak": {"month": peak.month, "label": C.month_label(peak.month), "n": int(peak.open_searches)},
                          "now": int(t.open_searches.iloc[-1]), "pre_avg": pre_p["open_avg"]},
        "last_complete": {"month": complete.month.iloc[-1], "label": C.month_label(complete.month.iloc[-1]),
                          "new": int(complete.new.iloc[-1]), "uc": int(complete.uc.iloc[-1]), "closed": int(complete.closed.iloc[-1])},
        "recent": recent,
        "refunds_by_month": [{"month": r["month"], "n": r["refunds"]} for r in rows if r["month"] >= "2026-01"],
        "record_closed": {"label": C.month_label(complete.loc[complete.closed.idxmax()].month), "n": int(complete.closed.max())},
    }
