# Context for AI assistants

This repository holds the **STRSearch Executive Performance Report**, a leadership report on client acquisition. STRSearch helps clients buy short-term-rental (STR) properties. All figures are a static snapshot **as of 2026-11-11** and are aggregates only: there are no client names, contact details or record identifiers. Use only the numbers here and in `docs/data/report-data.json`. Do not invent revenue, cash, CAC or team-capacity figures: the data does not contain them.

Live page: https://ifrahamstr.github.io/STRSearchExecutiveReport/
Record-level companion (anonymized): https://github.com/ifrahamSTR/STRSearchBusinessDataExplorer-Public

## The client journey: two clocks
- **Sales clock (Pipedrive):** prospect books a call → sales process → deal won (service purchased). The median from deal created to won is 21 days. Wins averaged 28 a month in Jan–May 2026 and 72 a month in Jun–Oct 2026.
- **Acquisition clock (Jira):** client start → property search → Under Contract (UC) → CLOSED.
  - Client start = `COALESCE(issue_due_date, issue_created_date)`, i.e. the onboarding-call date.
  - UC and CLOSED are the first dates the client entered that status.
- **The clocks overlap since late May 2026.** A new Complete offer and a "Confidence Call" step (prospects meet Acquisitions and enter Jira before buying) launched together.
  - Confidence Call clients start the acquisition clock a median 8 days *before* the sale.
  - Other clients start about 5 days after it.
  - Do not add the two clocks together.

## Definitions
- **Signed-up client:** a Jira record in a client status. Active = signed-up minus Paused, Refunded and Additional Service.
- **Pre-sale prospects:** New Clients, Onboarding Completed and Services Declined. These are not clients and are excluded throughout.
- **Counts:** 850 signed-up clients: 644 Active and 206 Inactive (109 Paused, 92 Refunded, 5 Additional Service).

## Findings

### 1. Acquisition speed
- **Clients who reached UC (n=499):** median 36 days, average 54.
  - About half went under contract between **day 11 and day 41** (251 clients, 50%). 6% were faster and 43% slower.
  - The busiest two weeks are days 12–25 (27%).
  - Within 30 / 45 / 60 / 90 / 120 days: 42% / 60% / 72% / 85% / 92%. These are shares of the clients who reached UC, not of all clients.
  - The slowest 10% (106+ days) account for 36% of all days waited.
  - 43% of these clients started in the last six months and cannot yet show long searches. Among clients who started earlier, the average is 63 days and 13% took more than 120.
- **Clients who closed (n=432):** median 77 days, average 96. Contract to close typically takes 38 days.
- **Unfinished journeys:**
  - 108 clients are searching without a contract (median wait 65 days; 33 have waited 90+ days) and 11 are searching again after a contract fell through.
  - 66 are under contract, a median 15 days in, which is on schedule.
- **Estimates for all signed-up clients (Kaplan–Meier, unfinished clients counted up to the snapshot):** half are under contract within about **61 days** (likely 55–70) and closed within about **120 days** (likely 111–132).
  - Earlier reporting said 77 and 127 days. That counted 61 clients who closed without a logged contract date (a gap in Jira's history) as never under contract.
  - These are estimates from past patterns, not commitments.

### 2. Client progression
- **"Active" is a snapshot, not a conversion rate.**
  - 459 of the 644 Active clients have already closed; only 185 are in progress.
  - The previously reported 72% (UC) and 67% (CLOSED) of Active clients overstate conversion, because Active excludes paused and refunded clients.
  - They also undercount contracts: at least 82% of Active clients reached UC.
- **Most dependable figure:** of the 303 clients who started Jul 2025 – mid-May 2026 (6+ months of follow-up), **74% reached a contract and 68% closed**, and about 26% paused or were refunded.
- **Watch:**
  - 18% of September 2026 starters were refunded within 45 days, against 5–7% before.
  - October 2026 logged 25 refunds.

### 3. Operational throughput

Jan–May vs Jun–Oct 2026, monthly averages:

| Measure | Jan–May | Jun–Oct | Change |
|---|---|---|---|
| New clients | 29.6 | 73.4 | 2.5× |
| Under Contract | — | — | 2.2–2.4× |
| CLOSED | 16.8 | 38.0 | 2.3× |

- **Same-cohort conversion:** under contract within 60 days was 42% (Jan–May starters) vs 51% (Jun–Aug); within 90 days, 60% vs 62%.
- Output kept pace with intake through the August cohort.
- **Open searches peaked at 170** (end of September) and are 108 at the snapshot. The fall came mainly from exits, not more contracts: since 30 Sep, +61 new, −75 under contract, −48 paused or refunded (31 refunds).
- **Intake has receded:** 9 new clients and 8 wins in 1–11 Nov 2026.

## Limits
- Jira's extract keeps only recent status history, so older milestone dates drop out over time.
- Jira records before July 2025 are a surviving subset.
- The effects of the late-May changes can't be separated.
- Booked sales values are before refunds.

## Files
- `docs/data/report-data.json`: every figure on the page (keys: `meta`, `journey`, `speed`, `progression`, `throughput`, `checks`).
- `pipeline/`: how each figure is computed. `core.py` holds shared rules and statistics; `stories/*.py` hold one module per section.
