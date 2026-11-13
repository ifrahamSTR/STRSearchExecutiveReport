/* Small notes at the bottom: definitions and caveats. */
(function () {
  'use strict';
  const R = window.R;
  R.story('notes', {
    nav: 'Notes',
    render(root, D) {
      const m = D.meta, sp = D.speed, j = D.journey;
      root.className = 'notes';
      root.innerHTML = `
      <div class="wrap">
        <h2>Notes</h2>
        <ul>
          <li>Static snapshot as of ${R.date(m.asof)}; nothing updates live. Aggregates only.</li>
          <li>Client start = onboarding-call date (or Jira record creation if none). UC / CLOSED = first date in that status.</li>
          <li>Signed-up = Jira client statuses. Active = signed-up minus paused, refunded, additional service. Pre-sale prospects excluded.</li>
          <li>Estimates (Speed, step D) assume clients still searching progress as earlier clients did. Not commitments.</li>
          <li>Jira keeps only recent status history: ${R.int(sp.observed.closed_without_uc_date)} closed clients lack a contract date. Figures can shift slightly at each refresh.</li>
          <li>Records before July 2025 are a surviving subset; cohort views start there.</li>
          <li>${R.int(j.start_date_source.since_change_no_due_date)} of ${R.int(j.start_date_source.since_change)} clients since late May have no onboarding-call date.</li>
          <li>The late-May offer and Confidence Call changes coincide; their separate effects can't be measured.</li>
          <li>Detailed records and data checks: <a href="https://ifrahamstr.github.io/STRSearchBusinessDataExplorer-Public/" target="_blank" rel="noopener">Business Data Explorer</a> (${D.checks.filter(c => c.ok).length}/${D.checks.length} figures reconcile).</li>
        </ul>
      </div>`;
    },
  });
})();
