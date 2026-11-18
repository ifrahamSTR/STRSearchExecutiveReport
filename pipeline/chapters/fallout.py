"""Chapter 6: what happens after a contract falls through? (16 Nov 2026 reporting version, added 18 Nov 2026)

The reporting layer keeps only the latest valid Under Contract date, so contract history comes from the 12 Nov 2026 Jira
extract (data as of 11 Nov; records.jira12), the same fields the archived 12 Nov Explorer carries: the fell_out flag
(Address_Fell_Out_Of_Contract filled), under_contract_count and the first / latest Under Contract dates.

Population: signed-up Jira clients known to have gone under contract = a recorded Under Contract date or status entry, a
recorded fall-out address, or a completed purchase (a purchase needs a contract, even where its date is missing).

Every known client sits in exactly one evidence group (in this order):
  documented     a fall-out address is recorded (Address_Fell_Out_Of_Contract)
  ended          a contract is on record, no completed purchase, and the status is now a search, Paused, Refunded or
                 Additional Service: the contract ended without a purchase, but no fall-out address was recorded
  returned       under contract again after returning to a search status (Under Contract entered more than once, previous
                 status a search status): a new contract after a fall-through; its property is not recorded
  second_entry   Under Contract entered more than once, now purchased: a replacement contract or a repeated status entry (the
                 records cannot tell which: only the latest status change is kept)
  none           no sign of a fall-through in the records
A replacement is documented only when a later contract is recorded on a different property; the fall-out address is
compared with the address under contract today.
"""
from __future__ import annotations

import re

import pandas as pd

import core as C
from chapters import records as R

GROUPS = ["documented", "ended", "returned", "second_entry", "none"]
SEARCH = ["Client Start", "2 Weeks", "4 Weeks", "6 Weeks", "8 Weeks"]


def _addr(s):
    return None if s is None or pd.isna(s) else (re.sub(r"[^a-z0-9]", "", str(s).lower()) or None)


def build(ctx: C.Ctx) -> dict:
    j12 = R.jira12(ctx.explorer)
    s = ctx.signed.set_index("key")
    x = s.join(j12, how="left")
    x["uc_addr16"] = ctx.f.frames["jira"].assign(key=ctx.f.frames["jira"]["key"].astype(str).str.upper()).set_index("key")["address_under_contract"]
    st = R.stage(s.reset_index()).set_axis(s.index)
    done = st.eq("purchased")
    fell = x.fell_addr.notna()
    ucn = x.uc_count.fillna(0)
    ucrec = x.uc.notna() | x.first_uc.notna() | (ucn >= 1)
    known = ucrec | fell | done
    ended = known & ~fell & ucrec & st.isin(["hunting", "paused", "refunded", "additional"])
    multi = known & ~fell & ~ended & (ucn >= 2)
    returned = multi & st.eq("under_contract") & x.previous_status.isin(SEARCH)
    second = multi & ~returned
    grp = pd.Series(pd.NA, index=x.index, dtype="object")
    grp[known] = "none"
    grp[second] = "second_entry"
    grp[returned] = "returned"
    grp[ended] = "ended"
    grp[fell & known] = "documented"
    k = x[known]
    n_known = int(known.sum())

    def by_stage(m):
        return {g: int((st[m] == g).sum()) for g in R.STAGES if (st[m] == g).any()}

    d = x[fell]
    same = [(_addr(f) == _addr(u)) if pd.notna(u) else None for f, u in zip(d.fell_addr, d.uc_addr16)]
    replaced = [(not sm) and st[i] in ("purchased", "under_contract") for i, sm in zip(d.index, same) if sm is not None]
    sec = x[second]
    gap = (sec.latest_uc - sec.first_uc).dt.days
    return {
        "source": "12 Nov 2026 Jira extract (data as of 11 Nov 2026) for the fall-out address, Under Contract count and first / latest dates; 16 Nov reporting layer for statuses",
        "known": {"n": n_known, "uc_record": int(ucrec.sum()), "fell_only": int((fell & ~ucrec).sum()), "purchase_only": int((done & ~ucrec & ~fell).sum())},
        "groups": {g: {"n": int((grp == g).sum()), "share": round(int((grp == g).sum()) / n_known, 4)} for g in GROUPS},
        "documented": {"n": int(fell.sum()), "now": by_stage(fell), "same_address_as_today": int(sum(1 for v in same if v)),
                       "address_on_record": int(sum(1 for v in same if v is not None)), "replacement_documented": int(sum(replaced)),
                       "purchased_with_closing_date": int((fell & done & x.closed.notna()).sum()),
                       "uc_record": int((fell & ucrec).sum()), "second_entry": int((fell & (ucn >= 2)).sum())},
        "ended": {"n": int(ended.sum()), "now": by_stage(ended), "with_closing_date_entered": int((ended & x.closed.notna()).sum()),
                  "second_entry": int((ended & (ucn >= 2)).sum()),
                  "previous_status_search": int((ended & x.previous_status.isin(SEARCH)).sum())},
        "returned": {"n": int(returned.sum()), "now": by_stage(returned)},
        "none": {"n": int((grp == "none").sum()), "now": by_stage(grp == "none")},
        "second_entry": {"n": int(second.sum()), "now": by_stage(second), "same_day": int((gap == 0).sum()),
                         "gap_median": float(gap.median()) if len(gap.dropna()) else None},
        "fell_through": {"n": int((fell | ended | returned).sum()), "share": round(int((fell | ended | returned).sum()) / n_known, 4),
                         "new_contract": int(returned.sum()), "replacement_documented": int(sum(replaced)),
                         "without_property": int((ended | (fell & ~done & ~st.eq("under_contract"))).sum()),
                         "same_address_purchase": int((fell & done).sum())},
        "uc_count_2plus": int((ucn >= 2).sum()),
        "fell_field_filled_all_issues": int(j12.fell_addr.notna().sum()),
        "not_in_12nov_extract": int((~x.index.isin(j12.index)).sum()),
    }
