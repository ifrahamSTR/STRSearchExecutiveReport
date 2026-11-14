# STRSearch — The Client Journey

A visually led leadership presentation that shows how STRSearch turns paying clients into property owners.

**Live:** https://ifrahamstr.github.io/STRSearchExecutiveReport/ · data as of 2026-11-11 (static snapshot, aggregates only).

**Using this repo with an AI assistant?** Start with [`LLM_CONTEXT.md`](LLM_CONTEXT.md). Every figure on the page is in [`docs/data/story-data.json`](docs/data/story-data.json).

## Chapters
| Chapter | Shows | Pipeline module | Page script |
|---|---|---|---|
| 1 · The Client Journey | Route map: Pipedrive Won (buys STRSearch) vs Jira CLOSED (buys a property); sales-first route before 27 May 2026 vs the New Client Experience (New Clients → Confidence Call → Won or Services Declined), where the clocks overlap | `pipeline/chapters/journey.py` | `docs/assets/js/chapters/journey.js` |
| 2 · Where are our clients today? | 850 signed-up → Active / Inactive → current stage; recorded milestone attainment (72% / 67%) | `outcomes.py` | `outcomes.js` |
| 3 · Are we keeping pace? | Monthly new clients vs Under Contract and CLOSED events | `pace.py` | `pace.js` |
| 4 · How long does acquisition actually take? | Recorded durations → distribution of days to UC → clients still waiting → Kaplan–Meier (77 / 127 days) | `speed.py` | `speed.js` |
| 5 · What distinguishes fast and slow clients? | Who moves quickly (four speed groups) → capital: no threshold from $250K to $500K → offer experience (16% vs 36% under contract within 30 days) → deals seen before committing (8 / 13 / 20) → what STRSearch might take from it | `drivers.py` | `drivers.js` |

Use the ← and → keys to step through the scenes while presenting.

## Data
- Every figure comes from the [Business Data Explorer](https://github.com/ifrahamSTR/STRSearchBusinessDataExplorer-Public). This repo imports its pipeline (`definitions.py`, `build.py`, `metrics.py`) and uses its headline metrics directly.
- The chapter modules only reshape those figures for the visuals (bin counts, curve points). There is no new analysis and no imputed dates.
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
