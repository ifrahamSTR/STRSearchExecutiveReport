/* Reporting versions published on this site (newest first). Each version lives in its own folder and is never
   rebuilt by a newer version. Shared by every version folder through ../versions.js. */
window.STR_VERSIONS = {
  site: 'report',
  default: '2026-11-16',
  bannerAfter: 'header.top',
  versions: [
    { id: '2026-11-16', label: '16 Nov 2026', title: 'Updated reporting', status: 'current', data_asof: '2026-11-16',
      note: 'Supabase reporting layer (SQL views): client_start_date, latest valid Under Contract, won-engagement grain.' },
    { id: '2026-11-12', label: '12 Nov 2026', title: 'Original reporting', status: 'archived', data_asof: '2026-11-11',
      note: 'DIM extracts of the 12 Nov package: first recorded UC / CLOSED dates, COALESCE(due, created) start.' },
  ],
  sites: {
    report: { name: 'Executive Report', base: 'https://ifrahamstr.github.io/STRSearchExecutiveReport/' },
    explorer: { name: 'Business Data Explorer', base: 'https://ifrahamstr.github.io/STRSearchBusinessDataExplorer-Public/' },
  },
};
