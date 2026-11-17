# LLM context — The Client Journey (two reporting versions)

The site publishes two versions: **16 Nov 2026** (default, `docs/2026-11-16/`, Supabase reporting layer, data as of 2026-11-16) and **12 Nov 2026** (archived, frozen, `docs/2026-11-12/`, DIM extracts, data as of 2026-11-11). Their figures differ by design; see `VERSIONS.md` for why. Data files: `docs/2026-11-16/data/story-data.json` and `docs/2026-11-12/data/story-data.json`.

## 16 Nov 2026 version (default)
Definitions: client_start_date = due date for Jira issues created before 1 Jun 2026 (else created + 4 days), Pipedrive won date from 1 Jun 2026; Under Contract = latest valid contract; CLOSED = closing date up to the data date; durations use won engagements with a confirmed Jira start; client counts use the reporting-layer flags (Active includes closed / post-close clients; hunting = still searching). 27 May 2026 (New Client Experience) is an operational change; 1 Jun 2026 is a reporting rule.
- Durations (won engagements with a confirmed Jira start, n = 825): median 37.5 days to Under Contract (mean 56.17, n = 492), median 73.0 to CLOSED (mean 92.82, n = 438); Kaplan–Meier 76 / 117 days.
- Jira clients (reporting-layer flags): 843 signed-up = 648 Active + 195 Inactive; 123 hunting. Active reaching UC / CLOSED: 72% / 68% (6 further closings scheduled after the data date).
- Monthly starts minus Under Contract (net client change): peak +40 in 2026-06, then 2026-07 +31, 2026-08 +22, 2026-09 +19, 2026-10 +13.
- Capital (chapter 5, survival analysis incl. unfinished journeys): Pipedrive stated capital, 668 clients, log-rank p = 0.434, Cox HR per $100K 1.016 (95% 0.977–1.055). Offer experience (form column AA, self-reported, before STRSearch): within 30 days 19% / 28% / 40% for 0 / 1–2 / 3+ prior offers.
- Deals sent: cumulative and undated; cannot measure early (first 14 days) deal velocity.


## Cash forecast tab (16 Nov 2026 only)
`docs/2026-11-16/cash.html` (header tab "Cash forecast") forecasts net future cash: second Split Pay installments + affiliate revenue − expected refunds. Built by `pipeline/chapters/cash.py` from the reporting layer's `client_cash_forecast`, the 12 Nov Jira / Pipedrive / affiliate-tracking extracts and both onboarding-form sheets; only aggregates are published.
- Reconciliation: all 876 won engagements sit in exactly one group and add up to the view's outstanding balance. The 47 won deals without a Jira match were resolved by e-mail, Jira key, onboarding forms and brokerage/lender records: 6 own Jira issue (5 matched by e-mail, 1 second deal whose own Jira issue is named by the Pipedrive deal and Jira's deal-id field), 2 closing record, 6 second deals under review (same client, won date and value as another deal, won within seconds, recorded as "Deal 2"; no engagement of their own, so they stay excluded and are flagged), 9 repeat purchases without their own issue, 24 with no record. Matching client, date and value is not treated as proof of a duplicate: two-search purchases look identical (13 of the 14 same-client wins within a minute are named as a second deal, and in 6 both deals have their own Jira issue). No confirmed duplicates. Of 22 post-close records without a closing date, 3 closings were found in affiliate records; the rest are shown as unresolved.
- Model: under-contract clients close with the historical probability for their elapsed time (UC → CLOSED), timed by the remaining historical durations; clients without a property follow the historical close / refund / pause shares for their stage; collections spread around the "Expected days until collection" slider (37 days optimistic to an adjustable maximum of 77) with the historical UC → CLOSED variation; paused / additional-service clients proceed or are refunded by slider (default 50%); for those refunded, the refunded amount is paid back and subtracted as a cash outflow, and their unpaid second installment is not collected; the refund-size slider (default 100%) sets the share of the upfront payment returned, for future refunds only; clients marked Refunded in Jira are historical refunds, already paid back and not in the forecast; affiliates use each client's recorded partner choice and the conversion sliders only where none is recorded.
- Defaults: about $1.74M expected service collections + $1.20M affiliate collections − $0.64M projected refunds = $2.30M net expected cash flow; $0.41M of unresolved balances and second deals under review is shown but not forecast. (The duplicate review moved one second deal into the Paused / Additional Service group: +$3.2K net at the defaults, so the live defaults are $1.74M + $1.20M − $0.64M = $2.31M.)
- Presentation (`docs/2026-11-16/assets/js/cash.js`, `assets/css/cash.css`): KPIs; a left-to-right waterfall from the balance still owed to net cash (indigo totals, green adds, red reduces; shaded groups "Not future cash" and "Not expected to pay"); monthly cash flow; refunds by source; affiliate revenue by partner (recorded choice vs assumed conversions); timing scenarios. Each of those five views has a Chart / Table switch with sortable tables that follow the sliders. Refunds by source and affiliate revenue by partner are display-only splits of the same model flows. The page uses a 1280px stage; desktop is the supported layout.
- Simulation switch (Refund size card): "Include projected refunds from clients still searching" (default ON = the historical refund rate for clients without a property). OFF removes only that refund outflow (about $147K at the defaults); their collections, closing chances and affiliate revenue are unchanged, and paused / under-contract refunds are untouched. It is a display-side simulation setting; no historical data changes.
- Story order: (1) client landscape (open won deals by stage plus deals closed in the 30 days ending on the reporting date, counted from source `property_closed_date`; `cash.recent_closed` in the data file), KPIs, (2) waterfall and affiliate revenue, (3) monthly cash flow (simple view: service collections, affiliate revenue, future refunds, net; "Split by client group" shows the client groups) and scenarios, (4) refunds by source, an expandable unresolved-records breakdown (second deals under review listed separately) and the won-deal reconciliation table.

## 12 Nov 2026 version (archived). Everything below describes it, unchanged.

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
  - **Client start date** = the Jira due date (since May 2026, the onboarding-call date), or the date the Jira issue was created when no due date is set (126 of 850 signed-up clients). In code: `COALESCE(issue_due_date, issue_created_date)`.
  - Every duration = first recorded Under Contract (or CLOSED) date − client start date.
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
- **Active client (STRSearch definition):** a signed-up client whose current Jira status is not Inactive. Active statuses: Searching (Client Start, 2/4/6/8 Weeks), Under Contract (Under Contract, Passed Inspection), CLOSED, Post-close (Photography Shared, Listed, Content Pulled). Inactive: Paused, Refunded, Additional Service. New Clients, Onboarding Completed and Services Declined are prospects, outside the signed-up population.
- Active does not mean actively searching: clients who have bought a property stay Active. The classification uses current status only, not historical activity.
- **Recorded milestones among the 644 Active clients:** **72%** have recorded Under Contract (464) and **67%** have recorded CLOSED (429). These describe historical attainment, not a lifetime conversion rate.

## Chapter 3: are we keeping pace?
Two views of monthly input vs output, January 2025 to November 2026 (November partial). See `pace`.
1. **What enters Jira** (`pace.intake`): every Jira issue by the month it was created, all statuses, split by where it stands **today** with the Explorer's onboarding-first funnel classes: signed client (status in the signed-up list), still in pre-sale onboarding (New Clients, Onboarding Completed), Services Declined.
   - Since the New Client Experience (27 May 2026), Jira opens at onboarding, before the sale. Before it, Jira opened at the sale.
   - New issues per month: about 30 before vs about 200 after (29.8 vs 204.4; averages of the five full months either side, Dec 2025–Apr 2026 vs Jun–Oct 2026).
   - Of the 1,074 issues opened since 27 May: 375 are signed clients today, 307 still in pre-sale onboarding, 392 Services Declined. These are current statuses, not conversions completed in the month the issue opened.
2. **Clients in, contracts out** (`pace.monthly`, the Explorer's Q3 table): signed clients by the month their acquisition clock started vs first Under Contract and first CLOSED events in the month they happened.
   - Starts: 26.8 → 73.4 a month; Under Contract events 17.6 → 46.6; CLOSED events 18.0 → 38.0 (same five-month windows).
   - Starts are currently signed clients grouped by clock start, not purchases in that month. For reference, Pipedrive Won (service sales): 362 in Jun–Oct 2026 vs 367 starts.
   - Monthly events often belong to clients who started earlier. Never divide monthly Under Contract by monthly starts or intake: that is not a conversion rate.
   - **Monthly gap** (`pace.monthly[].gap`, `pace.gap`): that month's starts minus its Under Contract events, two counts side by side, shown from January 2026 (missing Under Contract dates make 2025 gaps read high). 2026: Jan +18, Feb +10, Mar +10, Apr −1, May +13, Jun +48, Jul +48, Aug +27, Sep +17, Oct −6 (Nov partial). Peak +48 in June and July; it has narrowed every month since. Five-month averages: 9.2 before vs 26.8 after late May.
   - A month's starts count as settled 30 days after it ends, because a prospect who signs later joins the month their clock started (23 of 369 clients who started since 27 May signed more than 30 days after starting). October and November 2026 are not settled yet, so their starts (and gaps) can still rise.
   - Never add the gaps up into a backlog: other exits (pauses, refunds) are not counted.
   - **Same-cohort view** (`pace.cohort`, the Explorer's Q3 cohort chart): share of each start month's signed clients under contract within 90 days, shown once every client has had 90 days. 2026-01 55%, 2026-02 48%, 2026-03 53%, 2026-04 64%, 2026-05 62%, 2026-06 58%, 2026-07 62%. Pooled: 55% for Jan–Apr 2026 starters vs 61% for Jun–Jul 2026.
   - 2025 start months are not shown: 48 of 238 clients who started in 2025 have a CLOSED date but no recorded Under Contract date, which would understate them. Shares shown are a slight floor (9 of 305 affected).
- The late-May 2026 changes (Complete offer, Confidence Call) coincided with growth; their separate effects have not been established.
- No historical backlog is reconstructed from today's statuses.

## Chapter 4: how long does acquisition actually take?
Every figure counts days from the **client start date** (Jira due date; issue creation date when none is set: 51 of the 499 recorded contracts and 29 of the 432 closings) to the first recorded Under Contract or CLOSED date. The chapter states this formula at the top.
1. **Recorded durations:** median 36 / average 53.8 days to Under Contract (499 clients); median 77 / average 96.3 days to CLOSED (432 clients).
2. **Distribution (15-day bins):** the largest group is 15–29 days (130 clients); 71% land within 60 days (days 0–59).
3. **Still waiting:** 185 paid clients have not bought a property yet.
   - 119 are searching; 90 of them are already past 36 days.
   - 66 are under contract; 24 are already past 77 days. Recorded contracts close a median 38 days after Under Contract.
4. **Kaplan–Meier** (850 signed-up clients): **77 days** to Under Contract and **127 days** to CLOSED.
   - **Limitation:** 61 clients with a recorded CLOSED date but no recorded Under Contract date count as not reaching Under Contract, so 77 is likely on the high side.

## Chapter 5: what distinguishes fast and slow clients?
- **Speed groups** (recorded days to first Under Contract):
  - Fast: within 30 days. Middle: 31–74 days. Slow: 75+ days.
  - Still searching (no contract yet) is kept separate from completed slow purchases.
- **Who moves quickly** (all 491 clients with 75+ days on the clock, started by 28 Aug 2026):

  | Group | Share | Median days to Under Contract |
  |---|---|---|
  | Within 30 days | 36% | 18 |
  | 31–74 days | 34% | 48 |
  | 75+ days | 20% | 106 |
  | Still searching | 9% | — |

  30% had no contract before day 75.
- **Fair comparisons:** each share uses only clients who have had time to reach that milestone.
  - "Within 30 days": clients with 30+ days on the clock (571; 285 with onboarding answers).
  - "Before day 75": clients with 75+ days on the clock (491; 206 with answers).
  - The slow / still-searching split depends on time on the clock, so comparisons use "before day 75".
- **Onboarding matching:**
  - Current form, since 20 Apr 2026, matched by client e-mail.
  - 206 of the 241 eligible clients who started in the form's window are matched (85%).
  - The form column headed "Person ID" (AH) holds Pipedrive **deal** ids: 599 agreements with the e-mail match, against 0 when read as Jira's person id (`PD_Contact_ID`).
  - Every answer used precedes the client's first Under Contract date; typically it is given 5 days before client start.
  - Matched clients started 24 Apr – 12 Oct 2026; 87% after the late-May changes.
- **Capital** (column M, total all-in out-of-pocket capital, not purchase budget; each range read at its upper end):
  - No cut-off from $250K to $500K separates fast from slow clients.
  - Within 30 days: 28–33% at or above each cut-off vs 29–32% below. Before day 75: 68–72% vs 69–70%. Median days to contract ≈ 40 on both sides.
  - The best cut-off is no better than chance once all six are considered together (p = 0.92 / 0.99). Differences beyond ±19 points are ruled out.
  - $200K+ would include everyone (the lowest option is $150K–$200K). $500K+ is the top option, so nothing higher can be tested.
- **Other answers tested** (adjusted for start period; Holm correction across 14 tests):
  - No clear difference for liquidity, strict budget, named specific markets, turnkey / light renovation, or Airbnb ownership.
  - Named specific markets: no contract before day 75 for 40% vs 27% (p = 0.13), within chance.
  - Lower capital (≤$250K) combined with any other constraint: no added effect.
- **Offer experience** (column AA), share under contract within 30 days:
  - 16% with no offers, 26% with 1–2, 36% with 3+. Before day 75 every group is ≈ 70%.
  - Odds ×1.67 per step (95% 1.10–2.54): p = 0.015 before correction, 0.21 after. Same direction in each start month since May.
  - A lead worth watching, not a proven driver.
- **Deals seen** (Jira *Total Deals Sent*), median before committing:
  - 8 within 30 days (median 18 days to contract), 13 in 31–74 days, 20 in 75+ days.
  - The count appears to stop at Under Contract: for all 23 clients with both dates, the last deal was sent on or before the contract date, and totals don't grow with time since contract.
  - Per 30 days of search: 13.8 / 8.6 / 5.3. No dated record of each deal exists, so pace and length of search can't be separated.
  - Missing for most still-searching clients (14 of 46).
- **Sample size:** with about 200 matched clients, only gaps of ~17 points or more are reliably detectable. "No clear difference" means no large gap, not identical behaviour. Associations, not causes.

## Files
- `docs/data/story-data.json`: all figures, keyed by chapter: `journey`, `outcomes`, `pace`, `speed`, `drivers`, plus `meta` and `checks`.
- `pipeline/`: how each figure is taken from the Explorer. `core.py` handles loading; `chapters/*.py` has one module per chapter.
