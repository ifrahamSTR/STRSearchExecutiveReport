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
| 5 · What distinguishes fast and slow clients? | Onboarding capital, offers and Airbnb ownership, and deals sent, by speed to Under Contract | `drivers.py` | `drivers.js` |

Use the ← and → keys to step through the scenes while presenting.

## Data
- Every figure comes from the [Business Data Explorer](https://github.com/ifrahamSTR/STRSearchBusinessDataExplorer-Public). This repo imports its pipeline (`definitions.py`, `build.py`, `metrics.py`) and uses its headline metrics directly.
- The chapter modules only reshape those figures for the visuals (bin counts, curve points). There is no new analysis and no imputed dates.
- Chapter 5 also reads the onboarding form (`Onboarding STR Search (Responses).xlsx`, sheet *Form Responses 2*) and matches it to Jira by hashed client e-mail or Pipedrive deal id. It outputs only aggregates, and counts below 5 are suppressed.
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
