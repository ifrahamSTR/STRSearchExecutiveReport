# Context for AI assistants

This repository holds **"The Client Journey"**, a leadership presentation for **STRSearch**, a company that helps clients buy short-term-rental (STR) properties.

- **Source:** every figure comes from the [Business Data Explorer](https://github.com/ifrahamSTR/STRSearchBusinessDataExplorer-Public) and uses its definitions.
- **Snapshot:** all figures are a static snapshot **as of 2026-11-11** and are aggregates only.
- **Scope:** use only these numbers and `docs/data/story-data.json`. Do not invent revenue, cash, conversion drivers or other findings.

Live page: https://ifrahamstr.github.io/STRSearchExecutiveReport/

## Chapter 1: one customer, two journeys
- **Sales clock (Pipedrive):** discovers STRSearch → books a call → sales process → **Won** (buys the service). The median from deal created to Won is 21 days.
- **Acquisition clock (Jira):** client start → property search → **Under Contract** → **CLOSED** (buys a property).
  - Client start = `COALESCE(issue_due_date, issue_created_date)`, i.e. the onboarding-call date.
- Winning a customer and closing a property are two different outcomes.
- **Confidence Call (since late May 2026):** prospects enter Jira and meet the acquisition team before they buy.

## Chapter 2: how long does it actually take?
1. **Recorded durations** (clients with a recorded milestone):

   | Milestone | Clients | Median | Average |
   |---|---|---|---|
   | Under Contract | 499 | 36 days | 53.8 days |
   | CLOSED | 432 | 77 days | 96.3 days |

2. **Distribution of days to Under Contract** (15-day bins):
   - The largest group is **15–29 days** (130 clients).
   - **71%** land within 60 days (days 0–59).
   - A long tail continues past 180 days.
3. **Journeys still running:** 185 clients.
   - 119 are still searching; 90 of them have already waited longer than 36 days.
   - 66 are under contract but not yet closed; 24 of them have already waited longer than 77 days.
4. **Kaplan–Meier** (850 signed-up clients, unfinished journeys counted up to the snapshot date):
   - **Under Contract:** 36 days recorded → **77 days** for all clients.
   - **CLOSED:** 77 days recorded → **127 days** for all clients.
   - **Limitation:** 61 clients have a recorded CLOSED date but no recorded Under Contract date and count as not reaching Under Contract, so the Under Contract estimate is likely on the high side.

## Chapter 3: how many clients reach their destination?
- **850 signed-up clients:**
  - **644 Active:** 119 still searching, 66 under contract or inspection, 236 CLOSED, 223 post-close.
  - **206 Inactive:** 109 paused, 92 refunded, 5 additional service.
- **Active is a reporting class, not "still searching"**: 459 Active clients are already CLOSED or post-close.
- **Recorded milestones among the 644 Active clients:**
  - **72%** have recorded Under Contract (464).
  - **67%** have recorded CLOSED (429).
  - These describe historical attainment, not a lifetime conversion rate.

## Chapter 4: are we keeping pace?
Monthly totals from January 2025 (see `pace.monthly` in the JSON):
- New signed-up clients, by month of client start.
- Under Contract events and CLOSED events, by month recorded.

The late-May 2026 changes (the Complete offer and the Confidence Call) coincided with sales growth; their separate effects have not been established. This is an input/output comparison, not same-cohort conversion.

## Files
- `docs/data/story-data.json`: all figures, keyed by chapter: `clocks`, `speed`, `outcomes`, `pace`, plus `meta` and `checks`.
- `pipeline/`: how each figure is taken from the Explorer. `core.py` handles loading; `chapters/*.py` has one module per chapter.
