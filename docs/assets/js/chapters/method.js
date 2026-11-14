/* End of the presentation and a discreet methodology note. */
(function () {
  'use strict';
  const S = window.S;
  S.renderMethod = function (main, D) {
    const m = D.meta, sp = D.speed;
    const sec = document.createElement('section');
    sec.className = 'stage';
    sec.id = 'method';
    sec.innerHTML = `<p class="closing">End of the initial presentation</p>
      <details class="method"><summary>Method and limitations</summary><ul>
        <li>Static snapshot (Jira ${m.snapshots.jira.slice(0, 10)}, Pipedrive ${m.snapshots.pipedrive.slice(0, 10)}); figures as of ${S.date(m.asof)}. Nothing updates live. Aggregates only.</li>
        <li>Every figure comes from the <a href="${m.source}" target="_blank" rel="noopener">Business Data Explorer</a> and uses its definitions (${D.checks.filter(c => c.ok).length}/${D.checks.length} checks against it pass). No new analysis or imputed dates.</li>
        <li>Client start = ${D.journey.start_rule}. Milestones = first recorded Under Contract / CLOSED date.</li>
        <li>Journey: pre-sale Jira statuses are New Clients, Onboarding Completed and Services Declined (counts are current records). Clock start vs Pipedrive Won, median: +${D.journey.start_vs_won.classic.median} days before 27 May (${S.int(D.journey.start_vs_won.classic.n)} clients); ${D.journey.start_vs_won.nce.median} days for Confidence Call clients since then (${S.int(D.journey.start_vs_won.nce.n)}); +${D.journey.start_vs_won.other_since.median} for other clients since then (${S.int(D.journey.start_vs_won.other_since.n)}).</li>
        <li>Recorded durations cover clients with a recorded milestone (${S.int(sp.observed.uc.n)} Under Contract, ${S.int(sp.observed.closed.n)} CLOSED). Distribution in 15-day bins; "within 60 days" = 0–59 days.</li>
        <li>Journeys still running: signed-up clients now in a searching status (Client Start, 2/4/6/8 Weeks) or Under Contract / Passed Inspection; days counted from client start.</li>
        <li>Kaplan–Meier: ${S.int(sp.estimate.n)} signed-up clients. A client reaches the milestone on its recorded date; everyone else counts until ${S.date(m.asof)}. Paused and refunded clients stay in as not reached. Estimates assume unfinished clients progress as earlier clients did; they are not commitments.</li>
        <li>Limitation: Jira's status history is incomplete. ${S.int(sp.closed_without_uc_date)} clients have a recorded CLOSED date but no recorded Under Contract date and count as not reaching Under Contract, so the Under Contract estimate is likely on the high side.</li>
        <li>Active / Inactive follow STRSearch's status lists; Active includes clients who have already closed. Attainment uses recorded dates and describes today's Active clients.</li>
        <li>Monthly view: new clients by month of client start; Under Contract and CLOSED by month recorded. Not a same-cohort conversion rate.</li>
        <li>The late-May changes (Complete offer, Confidence Call) coincided with sales growth; their separate effects have not been established.</li>
        <li>Fast vs slow: recorded days to first Under Contract (fast ≤30, middle 31–74, slow ≥75); still-searching clients kept separate. Only clients with 75+ days on the clock (started by ${S.date(D.drivers.eligible_through)}) are compared, so every client could have been slow.</li>
        <li>Onboarding answers: current form (since ${S.date(D.drivers.form_from)}), matched by client e-mail or Pipedrive deal; latest answer up to 30 days after client start. Column M is total all-in out-of-pocket capital, not purchase budget. Matched clients are mostly recent, so this describes the new process. Fast vs slow tested with Fisher's exact test; counts below 5 suppressed.</li>
        <li>Deals seen = Jira "Total Deals Sent", deals the acquisition team sent to the client so far. It grows with search time and cannot show cause.</li>
      </ul></details>`;
    main.append(sec);
  };
})();
