# STRSearch — The Client Journey

A visually led leadership presentation that shows how STRSearch turns paying clients into property owners.

**Live:** https://ifrahamstr.github.io/STRSearchExecutiveReport/ · data as of 2026-11-11 (static snapshot, aggregates only).

**Using this repo with an AI assistant?** Start with [`LLM_CONTEXT.md`](LLM_CONTEXT.md). Every figure on the page is in [`docs/data/story-data.json`](docs/data/story-data.json).

## Chapters
| Chapter | Shows | Pipeline module | Page script |
|---|---|---|---|
| 1 · One customer, two journeys | Sales clock (Pipedrive Won) and acquisition clock (Jira CLOSED), the Confidence Call bridge | `pipeline/chapters/clocks.py` | `docs/assets/js/chapters/clocks.js` |
| 2 · How long does it actually take? | Recorded durations, distribution of days to UC, journeys still running, Kaplan–Meier | `speed.py` | `speed.js` |
| 3 · How many clients reach their destination? | 850 signed-up → Active / Inactive → current stage; recorded milestone attainment | `outcomes.py` | `outcomes.js` |
| 4 · Are we keeping pace? | Monthly new clients vs Under Contract and CLOSED events | `pace.py` | `pace.js` |

Use the ← and → keys to step through the scenes while presenting.

## Data
- Every figure comes from the [Business Data Explorer](https://github.com/ifrahamSTR/STRSearchBusinessDataExplorer-Public). This repo imports its pipeline (`definitions.py`, `build.py`, `metrics.py`) and uses its headline metrics directly.
- The chapter modules only reshape those figures for the visuals (bin counts, curve points). There is no new analysis and no imputed dates.
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
