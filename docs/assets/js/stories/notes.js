/* Definitions and limitations: short, at the end, for readers who want them. */
(function () {
  'use strict';
  const R = window.R;
  R.story('notes', {
    nav: 'Notes',
    render(root, D) {
      const m = D.meta, sp = D.speed, j = D.journey, pr = D.progression;
      const ok = D.checks.filter(c => c.ok).length;
      root.className = 'notes';
      root.innerHTML = `
      <div class="wrap">
        <h2>Definitions and limits</h2>
        <p>Detailed record-level exploration and data-quality checks live in the <a href="https://ifrahamstr.github.io/STRSearchBusinessDataExplorer-Public/" target="_blank" rel="noopener">Business Data Explorer</a>. This report uses the same definitions and was checked against it (${ok} of ${D.checks.length} figures agree).</p>
        <div class="notes-grid">
          <section><h3>Definitions</h3><ul>
            <li><b>Signed-up client:</b> a Jira record in one of the client statuses (searching, under contract, closed, post-close, paused, refunded, additional service). Active = signed-up minus paused, refunded and additional service.</li>
            <li><b>Client start:</b> the onboarding-call date, or the date the Jira record was created when no call date is set.</li>
            <li><b>Under Contract / CLOSED:</b> the first date the client entered that status in Jira. About 8% of first contracts later fell through.</li>
            <li><b>Clients</b> are client engagements: a few people bought twice and appear as two clients.</li>
            <li><b>Sales clock:</b> Pipedrive STR Search pipeline, official reporting filter. Days to win = deal created to won.</li>
          </ul></section>
          <section><h3>Data and dates</h3><ul>
            <li>Static snapshot as of ${R.date(m.asof)} (Jira ${m.snapshots.jira}, Pipedrive ${m.snapshots.pipedrive}). Nothing on this page updates live.</li>
            <li>Milestone dates are calendar dates in UTC, so a day count can be off by one.</li>
            <li>Aggregates only. No client names, contact details or record identifiers.</li>
          </ul></section>
          <section><h3>Known gaps in the records</h3><ul>
            <li>Jira's extract keeps only each record's recent status history, so older milestone dates drop out over time. ${R.int(sp.observed.closed_without_uc_date)} closed clients have no logged contract date, and ${R.int(pr.post_close_without_closed_date)} post-close clients have no closing date. Expect small revisions at each refresh.</li>
            <li>Jira records before July 2025 are a surviving subset, so early cohorts are shown for reference only.</li>
            <li>Since late May, ${R.int(j.start_date_source.since_change_no_due_date)} of ${R.int(j.start_date_source.since_change)} new clients have no onboarding-call date, so their clock starts when the Jira record was created, which is usually a few days earlier.</li>
          </ul></section>
          <section><h3>What these figures are not</h3><ul>
            <li>Estimated timelines (part D) assume clients still searching progress as earlier clients did. They are not commitments.</li>
            <li>The late-May changes (Complete offer, Confidence Call) coincide with the growth shown; their separate effects can't be measured from this data.</li>
            <li>No figure here measures team capacity, revenue or cash. Booked sales values are before refunds.</li>
          </ul></section>
        </div>
      </div>`;
    },
  });
})();
