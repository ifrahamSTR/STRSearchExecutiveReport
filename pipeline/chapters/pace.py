"""Chapter 4: are we keeping pace? (the Explorer's monthly Q3 table, unchanged)"""
from __future__ import annotations

import pandas as pd

import core as C

FROM_MONTH = "2025-01"
CHANGE_MONTH = "2026-06"   # first full month after the late-May changes (Complete offer, Confidence Call)


def build(ctx: C.Ctx) -> dict:
    cur = ctx.asof.strftime("%Y-%m")
    rows = [{"month": r["month"], "label": C.month_label(r["month"]), "new": r["new_signed_start"], "uc": r["uc"],
             "closed": r["closed"], "partial": r["month"] == cur and ctx.asof != pd.Period(cur, "M").end_time.normalize()}
            for r in ctx.expected["q3"] if r["month"] >= FROM_MONTH]
    return {"monthly": rows, "change_month": CHANGE_MONTH, "change_date": ctx.D.NEW_EXPERIENCE_DATE}
