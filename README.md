# STRSearch — The Client Journey

A visually led leadership presentation that shows how STRSearch turns paying clients into property owners.

**Live:** https://ifrahamstr.github.io/STRSearchExecutiveReport/ opens the default version. Two reporting versions are published (see [`VERSIONS.md`](VERSIONS.md)):
- **16 Nov 2026 · Updated reporting (default):** https://ifrahamstr.github.io/STRSearchExecutiveReport/2026-11-16/ · Supabase reporting layer · data as of 2026-11-16.
- **12 Nov 2026 · Original reporting (archived, unchanged):** https://ifrahamstr.github.io/STRSearchExecutiveReport/2026-11-12/ · DIM extracts · data as of 2026-11-11.

The date menu in the header switches version and keeps the chapter. Links to the Business Data Explorer open the same version there.

**Rebuild:** `python pipeline/build.py --cache` (16 Nov, imports the Explorer's 16 Nov foundation and checks it matches the published Explorer). `python versions/2026-11-12/pipeline/build.py --cache` reproduces the frozen 12 Nov data into `versions/2026-11-12/rebuild/`.

**Using this repo with an AI assistant?** Start with [`LLM_CONTEXT.md`](LLM_CONTEXT.md). Every figure is in `docs/<version>/data/story-data.json`.

## 16 Nov 2026 headline figures
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
- Payout-schedule switch (Affiliate revenue card): "Apply expected affiliate payout schedules", default OFF (OFF reproduces the baseline exactly, array for array). ON is timing only: each partner's affiliate cash moves from its projected closing day to its receipt day, the 15th of the payout month. Realtor is paid in the month after the closing's calendar quarter ends (Q4 2026 closings in January 2027); lender and STR Cribs in the month after closing (STR Cribs provisional). The horizon extends to the last payout, so totals per partner are unchanged. At the defaults, cash by 31 Dec falls from $1.04M to $0.66M, and the realtor Q1 2027 fees ($0.42M) land in April 2027.
- Upcoming source change (not implemented here): estimated closing dates of Under Contract + 30 days for UC / Passed Inspection records without one. The pipeline treats any `closed_raw` on or before the reporting date as a closing (second installment collected; counted in the 30-day closings). 13 of today's 59 such records ($129K of second installments) would get an estimated date already in the past, and the other 46 ($452K) would become dated scheduled closings. The source should flag estimated dates (or keep them in a separate column), and the pipeline should use them only for timing, never as evidence of a closing. The payout schedules key off the projected closing day, so they work with either source.
- Story order: (1) client landscape (open won deals by stage plus deals closed in the 30 days ending on the reporting date, counted from source `property_closed_date`; `cash.recent_closed` in the data file), KPIs, (2) waterfall and affiliate revenue, (3) monthly cash flow (simple view: service collections, affiliate revenue, future refunds, net; "Split by client group" shows the client groups) and scenarios, (4) refunds by source, an expandable unresolved-records breakdown (second deals under review listed separately) and the won-deal reconciliation table.

## Chapters (structure shared by both versions; the figures below are the archived 12 Nov ones)
| Chapter | Shows | Pipeline module | Page script |
|---|---|---|---|
| 1 · The Client Journey | Route map: Pipedrive Won (buys STRSearch) vs Jira CLOSED (buys a property); sales-first route before 27 May 2026 vs the New Client Experience (New Clients → Confidence Call → Won or Services Declined), where the clocks overlap | `pipeline/chapters/journey.py` | `docs/assets/js/chapters/journey.js` |
| 2 · Where are our clients today? | 850 signed-up → Active / Inactive → current stage; recorded milestone attainment (72% / 67%) | `outcomes.py` | `outcomes.js` |
| 3 · Are we keeping pace? | What enters Jira: new issues by month created, by where each stands today (signed client / still in pre-sale onboarding / Services Declined), since Jira began opening before the sale on 27 May 2026 → signed clients starting acquisition vs Under Contract and CLOSED events, with the monthly gap (starts minus Under Contract, 2026) and the share of each 2026 start month under contract within 90 days | `pace.py` | `pace.js` |
| 4 · How long does acquisition actually take? | How the days are counted (from the client start date) → recorded durations → distribution of days to UC → clients still waiting → Kaplan–Meier (77 / 127 days) | `speed.py` | `speed.js` |
| 5 · What distinguishes fast and slow clients? | Who moves quickly (four speed groups) → capital: no threshold from $250K to $500K → offer experience (16% vs 36% under contract within 30 days) → deals seen before committing (8 / 13 / 20) → what STRSearch might take from it | `drivers.py` | `drivers.js` |

Use the ← and → keys to step through the scenes while presenting.

## Data
- Every figure comes from the [Business Data Explorer](https://github.com/ifrahamSTR/STRSearchBusinessDataExplorer-Public). This repo imports its pipeline (`definitions.py`, `build.py`, `metrics.py`) and uses its headline metrics directly.
- The chapter modules only reshape those figures for the visuals (bin counts, curve points). There is no new analysis and no imputed dates.
- Chapter 3 uses the Explorer's monthly counts (new Jira issues by created date, signed clients by client start, first Under Contract / CLOSED dates), its onboarding-first funnel classes and its same-cohort view (Under Contract within 90 days). Each build checks that the three intake classes add up to the Explorer's monthly totals, that each monthly gap is the Explorer's signed starts minus its Under Contract events, and that cohort sizes match its monthly signed starts.
- Chapter 5 also reads the onboarding form (`Onboarding STR Search (Responses).xlsx`, sheet *Form Responses 2*) and matches it to Jira by hashed client e-mail (preferred or secondary answer vs Jira client and additional e-mails).
  - The column headed "Person ID" (AH) actually holds Pipedrive **deal** ids. Each build checks this against the e-mail matches, and the column is used only as a deal-id fallback.
  - An answer counts only if it was given before the client's first Under Contract date.
  - Each share uses only clients who have had time to reach that milestone (30+ or 75+ days on the clock).
  - It outputs only aggregates. No share rests on fewer than 5 clients, and suppressed counts are not published.
- `pipeline/build.py` checks the output against the Explorer's own metrics and stops on any mismatch.

```bash
python pipeline/build.py --cache        # defaults: ../STRSearch-Business-Data-Explorer and its default reports folder
```

**Adding a chapter:**
1. Add `pipeline/chapters/<name>.py` with `build(ctx) -> dict`, and register it in `CHAPTERS`.
2. Add `docs/assets/js/chapters/<name>.js` calling `S.chapter('<name>', { n, title, render })`.
3. Add one `<script>` tag in `docs/index.html`.

The journey rail and keyboard stepping pick the new chapter up automatically.

The earlier "Executive Performance Report" version, which included corrected estimates and extra cuts, remains in git history (commit `4f05a10`).
