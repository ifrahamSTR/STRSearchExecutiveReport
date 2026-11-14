# Context for AI assistants

This repository holds **"The Client Journey"**, a leadership presentation for **STRSearch**, a company that helps clients buy short-term-rental (STR) properties.

- **Source:** every figure comes from the [Business Data Explorer](https://github.com/ifrahamSTR/STRSearchBusinessDataExplorer-Public) and uses its definitions.
- **Snapshot:** all figures are a static snapshot **as of 2026-11-11** and are aggregates only.
- **Scope:** use only these numbers and `docs/data/story-data.json`. Do not invent revenue, cash, conversion drivers or other findings.

Live page: https://ifrahamstr.github.io/STRSearchExecutiveReport/

## Chapter 1: the client journey
- **Two finish lines:**
  - **Pipedrive Won:** the customer buys STRSearch's service.
  - **Jira CLOSED:** the client buys a property.
- **Before 27 May 2026 (sales first):** book a call → sales call → Won. The acquisition clock then starts at the onboarding call, a median 5 days after Won.
  - Client start = `COALESCE(issue_due_date, issue_created_date)`.
  - Acquisition then runs Client Start → Search (2–8+ week check-ins) → Under Contract (incl. inspection) → CLOSED.
- **New Client Experience (since 27 May 2026):** the two clocks overlap.
  - After booking, the prospect fills the onboarding form and enters Jira as a *New Client*.
  - They meet Acquisitions in the **Confidence Call** (status *Onboarding Completed*), where the acquisition clock starts.
  - They then either buy (Won) or decline (*Services Declined*).
  - Confidence Call clients start the clock a median **8 days before** Won (219 clients). Other clients since late May still start about 5 days after.
- **Pre-sale Jira records now:** 114 New Clients, 198 Onboarding Completed, 394 Services Declined.

## Chapter 2: where are our clients today?
- **850 signed-up clients:**
  - **644 Active:** 119 still searching, 66 under contract or inspection, 236 CLOSED, 223 post-close.
  - **206 Inactive:** 109 paused, 92 refunded, 5 additional service.
- Active includes clients who have already closed.
- **Recorded milestones among the 644 Active clients:** **72%** have recorded Under Contract (464) and **67%** have recorded CLOSED (429). These describe historical attainment, not a lifetime conversion rate.

## Chapter 3: are we keeping pace?
- Monthly from January 2025: new signed-up clients (by month of client start) vs Under Contract and CLOSED events (by month recorded). See `pace.monthly`.
- The late-May 2026 changes (Complete offer, Confidence Call) coincided with growth; their separate effects have not been established.
- This is not same-cohort conversion.

## Chapter 4: how long does acquisition actually take?
1. **Recorded durations:** median 36 / average 53.8 days to Under Contract (499 clients); median 77 / average 96.3 days to CLOSED (432 clients).
2. **Distribution (15-day bins):** the largest group is 15–29 days (130 clients); 71% land within 60 days (days 0–59).
3. **Still waiting:** 185 paid clients have not bought a property yet.
   - 119 are searching; 90 of them are already past 36 days.
   - 66 are under contract; 24 are already past 77 days. Recorded contracts close a median 38 days after Under Contract.
4. **Kaplan–Meier** (850 signed-up clients): **77 days** to Under Contract and **127 days** to CLOSED.
   - **Limitation:** 61 clients with a recorded CLOSED date but no recorded Under Contract date count as not reaching Under Contract, so 77 is likely on the high side.

## Chapter 5: what distinguishes fast and slow clients?
- **Groups,** by recorded days to first Under Contract: fast ≤30, middle 31–74, slow ≥75. Clients still searching are a separate group.
- **Who is compared:** only clients with 75+ days on the clock (started by 28 Aug 2026).
- **Onboarding answers** (current form, since 20 Apr 2026; matched for 204 of 491 eligible clients, mostly recent):
  - Has submitted 3+ offers: fast 65%, slow 56%.
  - Owns an Airbnb: fast 18%, slow 22%.
  - All-in out-of-pocket capital of $300K+: fast 26%, slow 30%.
  - Capital under $200K: fast 30%, slow 30%.
  - **No difference is statistically clear** (Fisher's exact test, all p ≥ 0.48).
  - Capital (column M) is total all-in out-of-pocket capital, not the purchase budget.
- **Deals sent** (Jira *Total Deals Sent*): median 8 for fast clients, 13 middle, 20 slow, 15 for those still searching. Longer searches accumulate more deals, so this describes the search rather than explains it.

## Files
- `docs/data/story-data.json`: all figures, keyed by chapter: `journey`, `outcomes`, `pace`, `speed`, `drivers`, plus `meta` and `checks`.
- `pipeline/`: how each figure is taken from the Explorer. `core.py` handles loading; `chapters/*.py` has one module per chapter.
