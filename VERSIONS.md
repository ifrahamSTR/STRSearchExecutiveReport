# Reporting versions

This site publishes one folder per reporting package. A newer package never rebuilds or edits an older one.

| Version | Folder / URL | Status | Data as of | Source package |
|---|---|---|---|---|
| **16 Nov 2026 · Updated reporting** | `docs/2026-11-16/` → `/2026-11-16/` | Default | 16 Nov 2026 | `16 Nov UpdatedReports`: Supabase reporting-layer views (`New SQL Views for Reporting.xlsx`) and their SQL reference |
| **12 Nov 2026 · Original reporting** | `docs/2026-11-12/` → `/2026-11-12/` | Archived, frozen | 11 Nov 2026 | `12 Nov 26 Reports`: DIM extracts (Jira, Pipedrive, FCT) |

- The site root (`/`) redirects to the default version, keeping any `#section` in the link.
- The version date names the reporting package. The data inside a package runs to its own as-of date. For example, the 12 Nov package's data runs to 11 Nov.
- `docs/versions.js` is the registry. `docs/version-switcher.js` and `docs/version-switcher.css` add the date menu to every version folder.
  - When you change versions, the menu keeps the current section.
  - Links between the Executive Report and the Business Data Explorer always point to the same version.
- Each version has a manifest in `versions/<id>/version.json` recording its sources, pipeline, rebuild command and, once frozen, the SHA-256 of its published data files.

## Reproducing a version

- **16 Nov 2026 (current):** build the Explorer first, then `python pipeline/build.py --cache`. The build imports the Explorer's 16 Nov foundation and stops unless its shared headline figures equal the published Explorer's.
- **12 Nov 2026 (frozen):** `python versions/2026-11-12/pipeline/build.py --cache`.
  - This writes to `versions/2026-11-12/rebuild/`, never into `docs/2026-11-12/`.
  - It reproduces the published file exactly, except for the `built_at` time stamp.
  - The current pipeline refuses to write into a frozen version's outputs.

## Adding a newer version later

1. Freeze the current version: set `"frozen": true` in its `version.json` and record its output hashes.
2. Build the new package into a new `docs/<YYYY-MM-DD>/` folder.
3. Add the new version to `docs/versions.js` and make it the default.

## Why 12 Nov and 16 Nov figures differ

| Topic | 12 Nov 2026 (archived) | 16 Nov 2026 (default) |
|---|---|---|
| Unit for durations | Signed-up Jira issues | Won Pipedrive engagements with a confirmed Jira start (`client_cohort_performance`); Pipedrive-fallback starts excluded |
| Client start | `COALESCE(issue_due_date, issue_created_date)` | `client_start_date`: due date for issues created before 1 Jun 2026 (else created + 4 days); Pipedrive won date from 1 Jun 2026 |
| Under Contract | First recorded UC status date | Latest currently valid UC date (falls back to the first) |
| CLOSED | First recorded CLOSED status date | Closing-date field; dates after the data date count as scheduled, not closed |
| Client counts | Status lists | The reporting layer's `signed_up_client` / `active_clients` / `inactive_clients` / `hunting_clients` flags (same status lists, verified) |
| Monthly pace | Signed starts by start month vs first-UC events; a month's starts settle 30 days after it ends | `daily_client_activity`: Client Started vs Under Contract events; net change; no back-fill from June, because the start is the won date |
| Cohorts | 90-day same-cohort strip | Matured windows (14–90 days, eligible clients only), gross and refund-excluded |
| Capital (report chapter 5) | Thresholds on the onboarding form | Survival analysis including unfinished journeys (Pipedrive stated capital and form capital) |
| HENRY | Not used | `henry_client` = total out-of-pocket ≤ $225K (recorded mostly at purchase, so not used to explain speed) |
| Cash | Not available | Modeled contractual cash (`client_cash_forecast`); not receipts or revenue |

The method note at the end of the 16 Nov report summarises these differences as counts, taken from the Explorer's `version-changes.json`.
