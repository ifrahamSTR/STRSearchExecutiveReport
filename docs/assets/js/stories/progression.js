/* Client progression: where clients are now -> how many reached the milestones. */
(function () {
  'use strict';
  const R = window.R;
  const STAGE = {
    'Searching': { v: '--c-wait', label: 'Searching' },
    'Under contract': { v: '--c-uc', label: 'Under contract / inspection' },
    'Closed': { v: '--c-closed', label: 'Closed' },
    'Post-close': { v: '--c-closed-soft', label: 'Post-close', light: true },
    'Paused': { v: '--c-hold', label: 'Paused' },
    'Refunded': { v: '--c-neutral', label: 'Refunded' },
    'Additional service': { v: '--c-neutral-2', label: 'Additional service', light: true },
  };

  function board(pr) {
    const total = pr.classes.signed, segs = pr.stages.filter(s => s.n > 0);
    const act = segs.filter(s => s.active).reduce((a, s) => a + s.n, 0);
    const bar = segs.map(s => {
      const st = STAGE[s.stage], wide = s.n / total > 0.07;
      return `<div style="flex:${s.n};background:var(${st.v})" class="${st.light ? 'light' : ''}" title="${st.label}: ${s.n}">${wide ? `${s.n}<small>${st.label.split(' /')[0]}</small>` : ''}</div>`;
    }).join('');
    return `<div class="board-bar" role="img" aria-label="${total} signed-up clients by current stage">${bar}</div>
      <div class="brackets"><div style="flex:${act}"><b>Active ${R.int(pr.classes.active)}</b></div><div style="flex:${total - act}"><b>Inactive ${R.int(pr.classes.inactive)}</b></div></div>
      <div class="key">${segs.map(s => `<span><i style="background:var(${STAGE[s.stage].v})"></i>${STAGE[s.stage].label} <b>${s.n}</b></span>`).join('')}</div>`;
  }

  const bar = (lab, share, color) => `<div class="att-row"><span class="lab">${lab}</span><div class="bar"><div style="width:${(share * 100).toFixed(1)}%;background:var(${color})"></div></div><span class="val num">${R.pct(share)}</span></div>`;

  function cohortChart(node, cohorts) {
    const rows = cohorts.filter(c => c.reliable);
    const order = ['Closed', 'Post-close', 'Under contract', 'Searching', 'Paused', 'Refunded', 'Additional service'];
    R.chart(node, t => {
      const o = R.base(t);
      const col = { 'Closed': t.closed, 'Post-close': t.closedSoft, 'Under contract': t.uc, 'Searching': t.wait, 'Paused': t.hold, 'Refunded': t.neutral, 'Additional service': t.neutral2 };
      return Object.assign(o, {
        grid: { left: 8, right: 12, top: 12, bottom: 8, containLabel: true },
        tooltip: Object.assign(o.tooltip, { axisPointer: { type: 'shadow' }, formatter: ps => { const c = rows[ps[0].dataIndex]; return `<b>${c.label}</b> · ${c.n} clients<br>` + ps.filter(p => p.value > 0).map(p => `${p.marker} ${p.seriesName}: ${c.stages[p.seriesName]}`).join('<br>'); } }),
        xAxis: R.catAxis(t, rows.map(c => `${c.label}${c.mature ? '' : ' *'}`)),
        yAxis: R.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, formatter: v => R.pct(v) } }),
        series: order.map(k => ({ name: k, type: 'bar', stack: 's', barWidth: '56%', itemStyle: { color: col[k], borderColor: t.surface, borderWidth: 1 }, data: rows.map(c => c.stages[k] / c.n) })),
      });
    });
  }

  R.story('progression', {
    nav: 'Progression',
    render(root, D) {
      const pr = D.progression, a = pr.attainment.active, m = pr.mature;
      const searchingActive = pr.stages.find(s => s.stage === 'Searching').n / a.n;
      const e45 = pr.early_exits['45'];
      const exitM = (m.stages.Paused + m.stages.Refunded + m.stages['Additional service']) / m.n;
      root.innerHTML = `
      <div class="wrap">
        <div class="sec-head"><div class="eyebrow">Client progression</div><h2>How many clients reach Under Contract and CLOSED?</h2></div>

        <div class="step"><span class="n">1</span><h3>Where the ${R.int(pr.classes.signed)} signed-up clients are today</h3></div>
        <div class="panel">${board(pr)}</div>
        <p class="takeaway"><b>Active is not "still searching":</b> ${R.int(pr.closed_or_beyond)} of ${R.int(pr.classes.active)} Active clients have already closed.</p>

        <div class="step"><span class="n">2</span><h3>Milestones reached</h3></div>
        <div class="row row-2">
          <div class="panel att">
            <h5>Active clients today · ${R.int(a.n)}</h5>
            ${bar('Reached Under Contract', a.uc_at_least_share, '--c-uc')}
            ${bar('Closed', a.ever_closed_share, '--c-closed')}
            ${bar('Still searching', searchingActive, '--c-wait')}
          </div>
          <div class="panel att">
            <h5>Clients who started 6+ months ago · ${R.int(m.n)}</h5>
            ${bar('Reached Under Contract', m.uc_at_least_share, '--c-uc')}
            ${bar('Closed', m.ever_closed_share, '--c-closed')}
            ${bar('Paused or refunded', exitM, '--c-hold')}
          </div>
        </div>
        <p class="takeaway">The fair conversion view: of clients with time to finish, about <b>3 in 4 reach a contract and 2 in 3 close</b>.</p>
        <div class="watch"><b class="tag">Watch</b><span>Refunds within ${e45[2].days} days: <b>${R.pct(e45[2].refunded_share)}</b> of September starters vs ${R.pct(e45[0].refunded_share)}–${R.pct(e45[1].refunded_share)} before.</span></div>

        <details class="more">
          <summary>By start quarter</summary>
          <div class="inner">
            <div class="chart mid" id="cohortChart" role="img" aria-label="Current stage of clients by start quarter."></div>
            <div class="legend">${['Closed', 'Post-close', 'Under contract', 'Searching', 'Paused', 'Refunded'].map(k => `<span><i style="background:var(${STAGE[k].v})"></i>${STAGE[k].label}</span>`).join('')}</div>
            <p>* Less than six months of follow-up. "Reached Under Contract" counts clients who closed without a logged contract date (Active: ${R.int(a.uc_logged)} logged, ${R.int(a.uc_at_least)} in total). Previously reported Active shares were ${R.pct(a.uc_logged_share)} (UC) and ${R.pct(a.closed_logged_share)} (CLOSED).</p>
          </div>
        </details>
      </div>`;
      cohortChart(R.$('#cohortChart', root), pr.cohorts);
    },
  });
})();
