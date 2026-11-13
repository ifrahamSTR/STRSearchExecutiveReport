"""Acquisition speed: how quickly clients reach Under Contract and CLOSED.

A. observed durations   B. where the bulk falls   C. unfinished journeys   D. estimate for all clients
"""
from __future__ import annotations

import numpy as np
import pandas as pd

import core as C


def observed(days: pd.Series) -> dict:
    d = days.dropna()
    d = d[d >= 0]
    return {"n": int(len(d)), "mean": C.r(d.mean(), 2), "median": C.r(d.median(), 1), "p25": C.r(d.quantile(0.25), 1),
            "p75": C.r(d.quantile(0.75), 1), "p90": C.r(d.quantile(0.9), 1), "max": int(d.max())}


def _bins(d: np.ndarray, width: int, cap: int) -> list[dict]:
    out = []
    for a in range(0, cap, width):
        out.append({"from": a, "to": a + width - 1, "n": int(((d >= a) & (d < a + width)).sum())})
    return out


def distribution(days: pd.Series, cap: int) -> dict:
    d = np.sort(days.dropna().astype(int).values)
    d = d[d >= 0]
    n = len(d)
    q25, q75 = np.percentile(d, [25, 75])
    b7, b14 = _bins(d, 7, cap), _bins(d, 14, cap)
    m14 = max(b14, key=lambda b: b["n"])
    m7 = max(b7, key=lambda b: b["n"])
    k = int(np.ceil(n * 0.1))                      # slowest tenth
    slow, rest = d[n - k:], d[: n - k]
    uniq, counts = np.unique(d, return_counts=True)
    cum = np.cumsum(counts) / n
    dh = C.shortest_interval(d, 0.5)
    return {
        "faster_than_bulk": round(float((d < dh["from"]).mean()), 4), "slower_than_bulk": round(float((d > dh["to"]).mean()), 4),
        "n": n, "mean": C.r(d.mean(), 2), "median": C.r(np.median(d), 1), "cap": cap,
        "fd_width": C.r(2 * (q75 - q25) / n ** (1 / 3), 1),          # Freedman-Diaconis bin width
        "bins7": b7, "bins14": b14, "overflow": int((d >= cap).sum()),
        "dense_half": {**C.shortest_interval(d, 0.5)},
        "dense_fortnight": C.densest_window(d, 14),
        "dense_two_thirds": C.shortest_interval(d, 2 / 3),
        "middle_half": {"from": C.r(q25, 1), "to": C.r(q75, 1)},
        "modal_fortnight": {**m14, "share": round(m14["n"] / n, 4), "weeks": [m14["from"] // 7 + 1, (m14["to"] + 1) // 7]},
        "modal_week": {**m7, "share": round(m7["n"] / n, 4), "week": m7["from"] // 7 + 1},
        "within": [{"days": t, "n": int((d <= t).sum()), "share": round(float((d <= t).mean()), 4)} for t in C.CUM_DAYS],
        "ecdf": [[int(a), round(float(b), 4)] for a, b in zip(uniq, cum)],
        "tail": {
            "slow_n": int(k), "slow_from": int(slow.min()), "slow_mean": C.r(slow.mean(), 1),
            "slow_share_of_days": round(float(slow.sum() / d.sum()), 4),
            "mean_without_slow": C.r(rest.mean(), 1),
            "faster_than_mean": round(float((d < d.mean()).mean()), 4),
            "over": [{"days": t, "n": int((d > t).sum()), "share": round(float((d > t).mean()), 4)} for t in (90, 120, 180, 365)],
            "p90": C.r(np.percentile(d, 90), 1), "p95": C.r(np.percentile(d, 95), 1), "max": int(d.max()),
            "skew": C.skewness(d.astype(float)),
        },
    }


def older_starts(ctx: C.Ctx, days_col: str) -> dict:
    """Observed durations for clients who started at least MATURE_DAYS ago: recent starters cannot yet
    show long durations, so the pooled mean and tail understate slow searches."""
    g = ctx.jira[ctx.jira[days_col].notna() & (ctx.jira.elapsed >= C.MATURE_DAYS)]
    d = g[days_col].astype(float)
    return {"n": int(len(d)), "mean": C.r(d.mean(), 1), "median": C.r(d.median(), 1), "p90": C.r(d.quantile(0.9), 1),
            "within60": C.r((d <= 60).mean()), "within90": C.r((d <= 90).mean()), "over120": C.r((d > 120).mean()),
            "recent_share": C.r(1 - len(g) / int(ctx.jira[days_col].notna().sum()))}


def cohort_timing(ctx: C.Ctx) -> dict:
    """Has the time to UC shifted between client cohorts? Fixed windows, mature clients only."""
    s = ctx.signed[~ctx.signed.uc_time_unknown].copy()
    s["q"] = s.start.dt.to_period("Q")
    quarters = []
    for q, g in s.groupby("q"):
        row = {"q": str(q), "label": f"Q{q.quarter} {q.year}", "n": int(len(g)),
               "reliable": bool(q.start_time >= pd.Timestamp(C.RELIABLE_FROM)), "windows": {}}
        for w in (30, 60, 90):
            m = g[g.elapsed >= w]
            num = int((m.uc_evt & (m.t_uc <= w)).sum())
            row["windows"][str(w)] = {"num": num, "den": int(len(m)), "share": C.r(num / len(m)) if len(m) else None,
                                      "complete": bool(q.end_time.normalize() + pd.Timedelta(days=w) <= ctx.asof)}
        quarters.append(row)
    change = pd.Timestamp(C.PROCESS_CHANGE)
    eras = [
        ("Before July 2025", s.start < pd.Timestamp(C.RELIABLE_FROM), False),
        ("Jul – Dec 2025", (s.start >= pd.Timestamp(C.RELIABLE_FROM)) & (s.start < pd.Timestamp("2026-01-01")), True),
        ("Jan – late May 2026", (s.start >= pd.Timestamp("2026-01-01")) & (s.start < change), True),
        ("Since late May 2026", s.start >= change, True),
    ]
    out_eras = []
    for label, mask, reliable in eras:
        g = s[mask]
        k = C.km(g.t_uc, g.uc_evt)
        logged = g.days_uc.dropna()
        out_eras.append({"label": label, "reliable": reliable, "n": int(len(g)), "reached": int(g.uc_evt.sum()),
                         "est_median": C.km_median(g.t_uc, g.uc_evt),
                         "by": {str(t): C.r(C.km_at(k, t)) for t in (30, 60, 90)},
                         "completed_median": C.r(logged.median(), 1), "completed_n": int(len(logged))})
    return {"quarters": quarters, "eras": out_eras}


def unfinished(ctx: C.Ctx, completed_median_uc: float) -> dict:
    s = ctx.signed
    searching = s[s.stage == "Searching"]
    never = searching[~searching.uc_evt]
    uc_now = s[s.stage == "Under contract"]
    edges = C.AGING_EDGES + [10 ** 6]
    labels = [f"{a}–{b - 1} days" for a, b in zip(C.AGING_EDGES[:-1], C.AGING_EDGES[1:])] + [f"{C.AGING_EDGES[-1]}+ days"]

    def bucket(g):
        return [int(((g.elapsed >= a) & (g.elapsed < b)).sum()) for a, b in zip(edges[:-1], edges[1:])]

    since_uc = (ctx.asof - uc_now.latest_uc.fillna(uc_now.uc)).dt.days
    both = s[s.uc.notna() & s.closed.notna()]
    gap = (both.closed - both.uc).dt.days
    inactive = s[s.carson_inactive]
    return {
        "buckets": labels,
        "searching": bucket(searching), "under_contract": bucket(uc_now),
        "searching_never": bucket(never), "searching_again": bucket(searching[searching.uc_evt]),
        "n_searching": int(len(searching)), "n_never_uc": int(len(never)), "n_back_in_search": int(searching.uc_evt.sum()),
        "n_under_contract": int(len(uc_now)), "n_unfinished": int(len(searching) + len(uc_now)),
        "never_uc": {
            "median_wait": C.r(never.elapsed.median(), 1),
            "past_completed_median": int((never.elapsed > completed_median_uc).sum()),
            "wait_60": int((never.elapsed >= 60).sum()), "wait_90": int((never.elapsed >= 90).sum()),
            "wait_120": int((never.elapsed >= 120).sum()), "wait_180": int((never.elapsed >= 180).sum()),
            "longest": int(never.elapsed.max()),
        },
        "under_contract_wait": {
            "median_since_uc": C.r(since_uc.median(), 1),
            "typical_uc_to_close": {"n": int(len(gap)), "median": C.r(gap.median(), 1), "p25": C.r(gap.quantile(0.25), 1),
                                    "p75": C.r(gap.quantile(0.75), 1), "p90": C.r(gap.quantile(0.9), 1)},
            "past_p90": int((since_uc > gap.quantile(0.9)).sum()),
        },
        "on_hold": {"paused": int((s.stage == "Paused").sum()), "refunded": int((s.stage == "Refunded").sum()),
                    "additional": int((s.stage == "Additional service").sum()),
                    "never_uc": int((~inactive.uc_evt).sum())},
    }


def _curve(k: pd.DataFrame, upto: int = 365) -> list:
    k = k[k.t <= upto]
    return [[int(t), round(float(c), 4)] for t, c in zip(k.t, k.cum)]


def estimate(ctx: C.Ctx) -> dict:
    """Kaplan-Meier estimates for all signed-up clients, with the treatment of incomplete and
    exited records made explicit (primary estimate + alternatives)."""
    s = ctx.signed
    elapsed = s.elapsed.values.astype(float)
    reliable = (s.start >= pd.Timestamp(C.RELIABLE_FROM)).values
    inactive = s.carson_inactive.values
    exit_days = np.minimum(s.exit_days.fillna(s.elapsed).values.astype(float), elapsed)

    def pack(label, t, e, mask, note, in_range=True):
        t, e = np.asarray(t, float)[mask], np.asarray(e, bool)[mask]
        k = C.km(t, e)
        return {"label": label, "note": note, "n": int(mask.sum()), "events": int(e.sum()), "median": C.km_median(t, e),
                "in_range": in_range, "by": {str(d): C.r(C.km_at(k, d)) for d in (30, 60, 90, 120, 180, 365)}}, k

    # ---- Under Contract
    ok = ~s.uc_time_unknown.values
    e_uc, t_uc = s.uc_evt.values, s.t_uc.values
    primary, k_uc = pack("Primary estimate", t_uc, e_uc, ok,
                         "Clients who closed without a logged UC date count as reaching UC, placed the typical UC-to-close gap before their closing. Paused and refunded clients stay in as not having reached it.")
    no_uc_exit = inactive & ~e_uc
    # latest possible UC date for clients who closed without one: their inspection date if logged, else the closing
    latest = np.where(s.uc_inferred & s.pi.notna(), s.days_pi, s.t_uc_upper).astype(float)
    long_gap = np.where(s.uc_inferred, (s.days_closed - 60).clip(lower=0), t_uc).astype(float)
    t_exit = t_uc.copy()
    t_exit[no_uc_exit] = exit_days[no_uc_exit]
    t_never = t_uc.copy()
    t_never[no_uc_exit] = 1e6
    uc_alts = [
        pack("Latest possible contract date", latest, e_uc, ok, "Clients who closed without a logged contract date are placed at their inspection date, or their closing if no inspection is logged.")[0],
        pack("Earlier contract date (60-day gap)", long_gap, e_uc, ok, "Places those clients 60 days before closing, the 90th percentile of the contract-to-close gap.")[0],
        pack("Paused and refunded clients can never reach it", t_never, e_uc, ok, "Treats every pause or refund as permanent.")[0],
        pack("Paused and refunded clients leave when they exit", t_exit, e_uc, ok, "Assumes they would have progressed like everyone else. Too optimistic; not used for the range.", in_range=False)[0],
        pack(f"Only clients who started since {pd.Timestamp(C.RELIABLE_FROM).strftime('%b %Y')}", t_uc, e_uc, ok & reliable, "Leaves out the early period, where Jira history is incomplete.")[0],
    ]
    prior_uc = pack("As previously reported", np.where(s.uc_logged, s.days_uc, s.elapsed), s.uc_logged.values, np.ones(len(s), bool),
                    "Counts clients who closed without a logged UC date as still waiting.")[0]

    # ---- CLOSED
    okc = ~s.cl_time_unknown.values
    e_cl, t_cl = s.cl_evt.values, s.t_cl.values
    primary_c, k_cl = pack("Primary estimate", t_cl, e_cl, okc,
                           "Clients in a closed or post-close status with no logged CLOSED date are left out. Paused and refunded clients stay in as not having reached it.")
    no_cl_exit = inactive & ~e_cl
    tc_exit = t_cl.copy()
    tc_exit[no_cl_exit] = exit_days[no_cl_exit]
    tc_never = t_cl.copy()
    tc_never[no_cl_exit] = 1e6
    prior_cl = pack("As previously reported", t_cl, e_cl, np.ones(len(s), bool),
                    "Counts clients in post-close statuses without a logged CLOSED date as not closed.")[0]
    cl_alts = [
        prior_cl,
        pack("Paused and refunded clients can never reach it", tc_never, e_cl, okc, "Treats every pause or refund as permanent.")[0],
        pack("Paused and refunded clients leave when they exit", tc_exit, e_cl, okc, "Assumes they would have progressed like everyone else. Too optimistic; not used for the range.", in_range=False)[0],
        pack(f"Only clients who started since {pd.Timestamp(C.RELIABLE_FROM).strftime('%b %Y')}", t_cl, e_cl, okc & reliable, "Leaves out the early period, where Jira history is incomplete.")[0],
    ]

    ci_uc = C.km_median_ci(t_uc[ok], e_uc[ok])
    ci_cl = C.km_median_ci(t_cl[okc], e_cl[okc])

    def span(primary, alts, ci):
        vals = [a["median"] for a in alts if a["median"] is not None and a.get("in_range", True) and not a["label"].startswith("As previously")]
        vals += [primary["median"]]
        return {"records": [min(vals), max(vals)], "sampling": ci,
                "likely": [int(round(min(min(vals), ci[0]))), int(round(max(max(vals), ci[1])))]}

    return {
        "uc": {"primary": primary, "alternatives": uc_alts, "prior": prior_uc, "curve": _curve(k_uc),
               "range": span(primary, uc_alts, ci_uc),
               "inferred": int(s.uc_inferred.sum()), "left_out": int(s.uc_time_unknown.sum())},
        "closed": {"primary": primary_c, "alternatives": cl_alts, "prior": prior_cl, "curve": _curve(k_cl),
                   "range": span(primary_c, cl_alts, ci_cl),
                   "left_out": int(s.cl_time_unknown.sum())},
        "exits_without_uc": int(no_uc_exit.sum()),
    }


def build(ctx: C.Ctx) -> dict:
    j = ctx.jira
    obs_uc, obs_cl = observed(j.days_uc), observed(j.days_closed)
    return {
        "observed": {"uc": obs_uc, "closed": obs_cl,
                     "uc_in_signed_statuses": int(ctx.signed.uc_logged.sum()),
                     "closed_in_signed_statuses": int(ctx.signed.cl_evt.sum()),
                     "closed_without_uc_date": int(ctx.signed.uc_inferred.sum())},
        "distribution": {"uc": distribution(j.days_uc, C.HIST_CAP), "closed": distribution(j.days_closed, 280)},
        "older_starts": {"uc": older_starts(ctx, "days_uc"), "closed": older_starts(ctx, "days_closed")},
        "cohorts": cohort_timing(ctx),
        "unfinished": unfinished(ctx, obs_uc["median"]),
        "estimate": estimate(ctx),
        "uc_to_close_typical": ctx.uc_to_close,
    }
