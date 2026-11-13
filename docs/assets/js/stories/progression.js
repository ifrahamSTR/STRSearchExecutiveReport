/* Client progression: who the clients are -> where they are now -> how many reached the milestones. */
(function () {
  'use strict';
  const R = window.R;
  const STAGE = {
    'Searching': { v: '--c-wait', label: 'Searching' },
    'Under contract': { v: '--c-uc', label: 'Under contract' },
    'Closed': { v: '--c-closed', label: 'Closed' },
    'Post-close': { v: '--c-closed-soft', label: 'Post-close (listed, photos, archived)', light: true },
    'Paused': { v: '--c-hold', label: 'Paused' },
    'Refunded': { v: '--c-neutral', label: 'Refunded' },
    'Additional service': { v: '--c-neutral-2', label: 'Additional service', light: true },
  };

  function board(pr) {
    const total = pr.classes.signed;
    const segs = pr.stages.filter(s => s.n > 0);
    const bar = segs.map(s => `<div style="flex:${s.n};background:var(${STAGE[s.stage].v})" class="${STAGE[s.stage].light ? 'light' : ''}" title="${STAGE[s.stage].label}: ${s.n}">${s.n / total > 0.06 ? s.n : ''}</div>`).join('');
    const act = segs.filter(s => s.active).reduce((a, s) => a + s.n, 0);
    const key = segs.map(s => `<div><i style="background:var(${STAGE[s.stage].v})"></i><span>${STAGE[s.stage].label}</span><b>${R.int(s.n)}</b></div>`).join('');
    return `<div class="board">
      <div class="board-bar" role="img" aria-label="${total} signed-up clients by current stage">${bar}</div>
      <div class="board-brackets"><div style="flex:${act}"><b>Active ${R.int(pr.classes.active)}</b> · ${R.int(pr.in_progress)} in progress, ${R.int(pr.closed_or_beyond)} closed or beyond</div><div style="flex:${total - act}"><b>Inactive ${R.int(pr.classes.inactive)}</b></div></div>
      <div class="board-key">${key}</div>
    </div>`;
  }

  function cmpRow(label, sub, share, color) {
    return `<div class="cmp-row"><div class="lab">${label}${sub ? `<small>${sub}</small>` : ''}</div><div class="track"><div class="fill" style="width:${(share * 100).toFixed(1)}%;background:var(${color})"></div></div><div class="val">${R.pct(share)}</div></div>`;
  }

  function cohortChart(node, cohorts) {
    const rows = cohorts.filter(c => c.reliable);
    const order = ['Closed', 'Post-close', 'Under contract', 'Searching', 'Paused', 'Refunded', 'Additional service'];
    R.chart(node, t => {
      const o = R.base(t);
      const col = { 'Closed': t.closed, 'Post-close': t.closedSoft, 'Under contract': t.uc, 'Searching': t.wait, 'Paused': t.hold, 'Refunded': t.neutral, 'Additional service': t.neutral2 };
      return Object.assign(o, {
        grid: { left: 8, right: 12, top: 12, bottom: 8, containLabel: true },
        tooltip: Object.assign(o.tooltip, {
          axisPointer: { type: 'shadow' },
          formatter: ps => { const c = rows[ps[0].dataIndex]; return `<b>${c.label}</b> · ${c.n} clients${c.mature ? '' : ' · <i>less than 6 months of follow-up</i>'}<br>` + ps.filter(p => p.value > 0).map(p => `${p.marker} ${p.seriesName}: ${c.stages[p.seriesName]} (${R.pct(p.value)})`).join('<br>'); },
        }),
        xAxis: R.catAxis(t, rows.map(c => `${c.label}\n${c.n} clients${c.mature ? '' : ' *'}`), { axisLabel: { color: t.label, fontSize: 11.5, lineHeight: 15 } }),
        yAxis: R.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, fontSize: 12, formatter: v => R.pct(v) } }),
        series: order.map((k, i) => ({
          name: k, type: 'bar', stack: 's', barWidth: '58%',
          itemStyle: { color: col[k], borderColor: t.surface, borderWidth: 1, borderRadius: i === order.length - 1 ? [3, 3, 0, 0] : 0 },
          data: rows.map(c => c.stages[k] / c.n),
        })),
      });
    });
  }

  R.story('progression', {
    nav: 'Client progression',
    render(root, D) {
      const pr = D.progression, a = pr.attainment.active, sg = pr.attainment.signed, m = pr.mature;
      const exitM = (m.stages.Paused + m.stages.Refunded + m.stages['Additional service']) / m.n;
      const e45 = pr.early_exits['45'], e90 = pr.early_exits['90'];
      root.innerHTML = `
      <div class="wrap">
        <header class="story-head">
          <div class="eyebrow">Client progression <i>· Acquisition clock</i></div>
          <h2>Of clients who started six or more months ago, three in four reached a contract and two in three have closed</h2>
          <p>The "Active" share is a snapshot of where clients stand today. Following clients from their start gives a cleaner conversion figure.</p>
        </header>

        <div class="beat">
          <div class="beat-title"><span class="k">1</span><h3>Where the ${R.int(pr.classes.signed)} signed-up clients stand today</h3></div>
          <div class="card">${board(pr)}</div>
          <div class="means"><span class="lbl">What it means</span><div>
            <p>"Active" does not mean "still searching". ${R.int(pr.closed_or_beyond)} of the ${R.int(pr.classes.active)} Active clients (${R.pct(pr.closed_or_beyond / pr.classes.active)}) have already closed; only ${R.int(pr.in_progress)} are still working toward a property. Pre-sale prospects (${R.int(pr.presale.n)} Jira records since the Confidence Call began) are not clients and are excluded throughout.</p>
          </div></div>
        </div>

        <div class="beat">
          <div class="beat-title"><span class="k">2</span><h3>How many reached Under Contract and CLOSED depends on who you count</h3></div>
          <div class="grid g-even">
            <div class="card cmp">
              <div class="cmp-group"><h5>Active clients today (${R.int(a.n)})</h5>
                ${cmpRow('Reached Under Contract (at least)', `${R.int(a.uc_at_least)} clients; ${R.int(a.uc_logged)} (${R.pct(a.uc_logged_share)}) have a logged date`, a.uc_at_least_share, '--c-uc')}
                ${cmpRow('Closed', `${R.int(a.ever_closed)} clients; ${R.int(a.closed_logged)} (${R.pct(a.closed_logged_share)}) have a logged date`, a.ever_closed_share, '--c-closed')}
              </div>
              <div class="cmp-group"><h5>All signed-up clients (${R.int(sg.n)})</h5>
                ${cmpRow('Reached Under Contract (at least)', `${R.int(sg.uc_at_least)} clients`, sg.uc_at_least_share, '--c-uc')}
                ${cmpRow('Closed', `${R.int(sg.ever_closed)} clients`, sg.ever_closed_share, '--c-closed')}
              </div>
            </div>
            <div class="card cmp">
              <div class="cmp-group"><h5>Clients who started 6+ months ago (${R.int(m.n)})</h5>
                <p class="caption" style="margin:0 0 4px">Started ${R.mon(m.from.slice(0, 7))} to ${R.date(m.to)}, before the late-May process change. Everyone has had at least ${m.days} days.</p>
                ${cmpRow('Reached Under Contract', `${R.int(m.uc_at_least)} clients`, m.uc_at_least_share, '--c-uc')}
                ${cmpRow('Closed', `${R.int(m.ever_closed)} clients`, m.ever_closed_share, '--c-closed')}
                ${cmpRow('Still searching or under contract', `${R.int(m.stages.Searching + m.stages['Under contract'])} clients`, (m.stages.Searching + m.stages['Under contract']) / m.n, '--c-wait')}
                ${cmpRow('Paused or refunded', `${R.int(m.stages.Paused)} paused, ${R.int(m.stages.Refunded)} refunded`, exitM, '--c-hold')}
              </div>
            </div>
          </div>
          <div class="means"><span class="lbl">What it means</span><div>
            <p>The previously reported ${R.pct(a.uc_logged_share)} and ${R.pct(a.closed_logged_share)} are not the chance that a new client will buy. Active already includes everyone who has closed and leaves out the ${R.int(pr.classes.inactive)} clients who paused or were refunded, so it overstates success. It also undercounts contracts: ${R.int(a.uc_at_least - a.uc_logged)} Active clients closed on a property without a logged contract date, so at least ${R.pct(a.uc_at_least_share)} reached one.</p>
            <p>The most dependable figure follows clients who started at least six months ago: <b>${R.pct(m.uc_at_least_share)} reached a contract and ${R.pct(m.ever_closed_share)} closed</b>. About one in four paused or was refunded. That, rather than slow searching, is the main reason clients don't close. These clients all started before the process change; the newer cohorts are on a similar early pace but are too young to confirm it.</p>
          </div></div>
        </div>

        <div class="beat">
          <div class="beat-title"><span class="k">3</span><h3>Each quarter's clients, by where they are today</h3></div>
          <div class="card">
            <div class="card-head"><h4>Current stage of clients, by the quarter they started<span class="sub">Quarters marked * have less than six months of follow-up, so more of those clients will still close</span></h4></div>
            <div class="chart" id="cohortChart" role="img" aria-label="Share of each start quarter by current stage."></div>
            <div class="legend">${['Closed', 'Post-close', 'Under contract', 'Searching', 'Paused', 'Refunded'].map(k => `<span><i style="background:var(${STAGE[k].v})"></i>${k}</span>`).join('')}</div>
          </div>
          <div class="means" style="border-color:var(--c-wait-soft)"><span class="lbl" style="color:var(--gold)">Watch</span><div>
            <p><b>Early refunds jumped in the September cohort.</b> ${R.pct(e45[2].refunded_share)} of September starters were refunded within ${e45[2].days} days (${e45[2].refunded} of ${e45[2].den}), against ${R.pct(e45[0].refunded_share)} for clients who started between July 2025 and late May and ${R.pct(e45[1].refunded_share)} for late-May to August starters. October logged ${R.int((D.throughput.refunds_by_month.find(x => x.month === '2026-10') || { n: 0 }).n)} refunds, spread across the month rather than a one-day clean-up, mostly about two weeks after purchase and before the search had started. Booked sales figures are not net of these refunds.</p>
          </div></div>
          <details class="more">
            <summary>Exits at equal follow-up, and dormant records</summary>
            <div class="inner">
              <div class="tbl-wrap"><table class="t">
                <thead><tr><th>Client start</th><th class="n">Refunded within 45 days</th><th class="n">Paused within 90 days</th></tr></thead>
                <tbody>${e45.map((r, i) => `<tr><td>${r.label}</td><td class="n">${r.refunded} of ${r.den} (${R.pct(r.refunded_share)})</td><td class="n">${e90[i].den ? `${e90[i].paused} of ${e90[i].den} (${R.pct(e90[i].paused_share)})` : 'too recent'}</td></tr>`).join('')}</tbody>
              </table></div>
              <p>Comparing current statuses would make pauses look rarer among newer clients, but older clients have simply had longer to pause. At equal follow-up, pauses are not lower since late May.</p>
              <p>Some records are dormant: ${R.int(pr.dormant.searching_over_180)} clients still in a searching status started more than 180 days ago, and ${R.int(pr.dormant.paused_over_180)} of the ${R.int(pr.dormant.paused)} paused clients paused more than 180 days ago. Few paused clients are seen to resume. Quarters before July 2025 are left out of the chart because Jira holds only the surviving records from that period.</p>
            </div>
          </details>
        </div>
      </div>`;
      cohortChart(R.$('#cohortChart', root), pr.cohorts);
    },
  });
})();
