"""Shared record helpers for the Client Journey questions added on 18 Nov 2026 (16 Nov 2026 reporting version).

Read-only, aggregates only. Three things several chapters need:
  - where each signed-up Jira client stands, status first: a completed purchase is a CLOSED or post-close status, or an
    Under Contract / Passed Inspection record whose closing date is on or before the data date. Closings without a recorded
    Under Contract date count as purchases. A client whose status moved back to a search, Paused or Refunded after a
    closing date was entered counts by that status (the closing did not stand).
  - the 12 Nov 2026 Jira extract (data as of 11 Nov), which carries what the reporting layer does not: client e-mails and
    the Pipedrive person id (to recognise the same client across Jira issues), Address_Fell_Out_Of_Contract,
    under_contract_count and the first / latest Under Contract dates. Loaded through the Explorer's frozen loader, the
    same way the Cash Forecast reconciliation does (cash._old_package); nothing is written.
  - one person id per signed-up Jira issue: issues sharing a Pipedrive person id or a primary e-mail belong to one client.
"""
from __future__ import annotations

import functools
import hashlib

import numpy as np
import pandas as pd

from chapters import cash

POST_CLOSE = ["CLOSED", "Photography Shared", "Listed", "Content Pulled"]
UNDER_CONTRACT = ["Under Contract", "Passed Inspection"]
STAGES = ["purchased", "under_contract", "hunting", "paused", "additional", "refunded"]


def _hash(s):
    return None if s is None or pd.isna(s) or not str(s).strip() else hashlib.sha256(str(s).strip().lower().encode()).hexdigest()


def _day(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s.astype("string").str[:10], errors="coerce")


def purchased(j: pd.DataFrame) -> pd.Series:
    """Completed purchase, status first (see the module note). j: Explorer Jira rows (status, closed = closings up to the data date)."""
    return j.status.isin(POST_CLOSE) | (j.status.isin(UNDER_CONTRACT) & j.closed.notna())


def stage(j: pd.DataFrame) -> pd.Series:
    """One stage per signed-up Jira issue; the six stages add up to the signed-up count."""
    p = purchased(j)
    return pd.Series(np.select(
        [p, j.status.isin(UNDER_CONTRACT), j.hunting, j.status.eq("Paused"), j.status.eq("Additional Service"), j.status.eq("Refunded")],
        STAGES, "other"), index=j.index)


@functools.lru_cache(maxsize=2)
def jira12(explorer) -> pd.DataFrame:
    """12 Nov 2026 Jira extract, one row per issue key (upper case), with the fields the 16 Nov layer lacks."""
    raw, _ = cash._old_package(explorer)
    k = raw.assign(key=raw["key"].astype(str).str.strip().str.upper()).drop_duplicates("key").set_index("key")
    fell = k["Address_Fell_Out_Of_Contract"].astype("string").str.strip()
    return pd.DataFrame({
        "cid": pd.to_numeric(k["PD_Contact_ID"], errors="coerce"),           # Pipedrive person id (two free-text entries drop out)
        "email": k["Client_Email"].map(_hash),
        "fell_addr": fell.where(fell.notna() & fell.ne("")),
        "uc_addr": k["Address_Under_Contract"],
        "uc_count": pd.to_numeric(k["under_contract_count"], errors="coerce"),
        "first_uc": _day(k["first_under_contract_date"]),
        "latest_uc": _day(k["latest_under_contract_date"]),
        "previous_status": k["previous_status"],
        "latest_status": k["latest_status"],
        "latest_status_date": _day(k["latest_status_date"]),       # date the current status was entered (as of 11 Nov 2026)
    }, index=k.index)


def people(keys: pd.Series, j12: pd.DataFrame) -> pd.Series:
    """Person id per Jira key: connected components over the Pipedrive person id and the primary e-mail (12 Nov extract).
    Keys missing from the extract (opened after 11 Nov) stay on their own."""
    parent: dict = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    for k in keys:
        find("k" + k)
        if k in j12.index:
            c, e = j12.at[k, "cid"], j12.at[k, "email"]
            if pd.notna(c):
                union("k" + k, "c%d" % int(c))
            if isinstance(e, str):
                union("k" + k, "e" + e)
    return pd.Series([find("k" + k) for k in keys], index=keys.index)
