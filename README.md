# STRSearch Executive Performance Report

A leadership report on client acquisition. It covers how quickly clients reach Under Contract and CLOSED, how many get there, and whether acquisition output keeps pace with new clients. It is built around the client journey's two clocks: sales (Pipedrive) and acquisition (Jira).

Open `docs/index.html` in a browser, or serve the `docs/` folder from any static host. There is no build step for the page.

## How it fits with the Business Data Explorer
- The Explorer (`../STRSearch-Business-Data-Explorer`) is the detailed, record-level tool.
- This report imports the Explorer's pipeline (`definitions.py`, `build.py`, `metrics.py`), so both use the same status lists, start-date rule and deal filter. Nothing in the Explorer is modified.
- Every build compares this report's headline figures with the Explorer's validated metrics. The build fails if any of them disagree.

## Refresh
```bash
python pipeline/build.py --cache            # defaults: ../STRSearch-Business-Data-Explorer, its default reports folder
python pipeline/build.py --explorer <path> --reports "<.../Reporting Tables>"
```
This writes `docs/data/report-data.js`, which contains aggregates only: no client names, contact details or record identifiers.

## Structure
| Part | Pipeline module | Page script |
|---|---|---|
| Summary + client journey (two clocks) | `pipeline/stories/journey.py` | `docs/assets/js/stories/journey.js` |
| Acquisition speed (A completed, B distribution, C unfinished, D estimate) | `pipeline/stories/speed.py` | `stories/speed.js` |
| Client progression | `pipeline/stories/progression.py` | `stories/progression.js` |
| Operational throughput | `pipeline/stories/throughput.py` | `stories/throughput.js` |
| Definitions and limits | – | `stories/notes.js` |

Shared rules and statistics (Kaplan–Meier, densest interval, stage mapping, report settings) are in `pipeline/core.py`. Shared chart and format helpers are in `docs/assets/js/core.js`.

**Adding a story** (for example sales performance or cash collection):
1. Add `pipeline/stories/<name>.py` with `build(ctx) -> dict`, and register it in `STORIES` in `pipeline/build.py`.
2. Add `docs/assets/js/stories/<name>.js`, calling `R.story('<name>', { nav, render(root, data) })`.
3. Add one `<script>` tag in `docs/index.html`.

Stories render in the order listed in `STORIES`. Nothing else needs to change.

## Analytical choices (summary)
- **Client start:** `COALESCE(issue_due_date, issue_created_date)`.
- **Clients with a CLOSED date but no logged Under Contract date** (61, a status-history gap) count as having reached UC, 38 days (the median contract-to-close gap) before closing. This is why the estimated median to UC is 61 days rather than the previously reported 77. Alternative treatments are shown in the report and range from 56 to 66 days.
- **Kaplan–Meier estimates** count clients still searching up to the snapshot date. Paused and refunded clients stay in as not having reached the milestone.
- **Early records:** cohort comparisons start in July 2025, because Jira records before then are a surviving subset.
- **Snapshot:** the data is a static snapshot (as of 2026-11-11). The page never implies live data.
