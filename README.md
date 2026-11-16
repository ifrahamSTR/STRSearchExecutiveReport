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
`docs/2026-11-16/cash.html` (header tab "Cash forecast") is an interactive scenario model of the cash STRSearch can still collect: second Split Pay installments plus affiliate revenue from future closings. Built from the reporting layer's modeled `client_cash_forecast` (contractual expectations, not verified receipts) by `pipeline/chapters/cash.py`; only aggregates are published.
- Every won engagement sits in exactly one group (checked on each build, and reconciled with the view's gross outstanding of $3,893,254): under contract (59, timed by historical UC → CLOSED durations conditional on time already waited), closing scheduled (6, on its date; the view counts these as collected), no property yet (116), paused / additional service (110), refunded (79), closed with the date missing (22), already closed (437) and no Jira match (47, not forecast).
- Controls: timing slider for clients without a property (optimistic: Under Contract tomorrow + 36-day median = day 37; pessimistic: 77 days, adjustable), paused / additional-service share that proceeds (default 50%), and conversion + revenue for realtor (93% × $4,000), lender (70% × $1,400) and STR Cribs (70% × $2,500).
- Defaults: about $2.27M expected service cash + $1.52M affiliate revenue = $3.79M from a $3.96M contractual balance. The dashboard's expandable notes list every assumption and limitation, separating historical figures from business assumptions.

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
