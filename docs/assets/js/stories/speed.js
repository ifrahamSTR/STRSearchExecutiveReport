/* Acquisition speed: what completed acquisitions took -> where the bulk falls -> who is still waiting -> the estimate for everyone. */
(function () {
  'use strict';
  const R = window.R;

  function histogram(node, dist, est) {
    let view = 'dist';
    const W = 7, cap = dist.cap;
    const rec = R.chart(node, t => {
      const o = R.base(t);
      const dh = dist.dense_half;
      if (view === 'dist') {
        const bars = dist.bins7.map(b => [b.from, b.to + 1, b.n]);
        bars.push([cap, cap + W, dist.overflow]);
        const inBulk = b => b[0] + W > dh.from && b[0] <= dh.to;
        const ymax = Math.ceil(Math.max(...bars.map(b => b[2])) * 1.25 / 10) * 10, ytop = ymax * 0.84;
        return Object.assign(o, {
          grid: { left: 8, right: 18, top: 16, bottom: 28, containLabel: true },
          tooltip: Object.assign(o.tooltip, {
            trigger: 'item',
            formatter: p => {
              const b = p.data.value;
              const lab = b[0] >= cap ? `${cap}+ days` : `Days ${b[0]}–${b[1] - 1}`;
              return `<b>${lab}</b><br>${b[2]} clients (${R.pct(b[2] / dist.n, 1)} of ${dist.n})`;
            },
          }),
          xAxis: R.valAxis(t, {
            min: 0, max: cap + W, interval: 28, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: t.axis } },
            axisLabel: { color: t.label, fontSize: 12, formatter: v => (v >= cap ? cap + '+' : v) },
            name: 'days from client start to Under Contract', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 12 },
          }),
          yAxis: R.valAxis(t, { max: ymax }),
          series: [{
            type: 'custom',
            renderItem: (params, api) => {
              const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), 0]);
              const w = Math.max(1, b[0] - a[0] - 2);
              return { type: 'rect', shape: { x: a[0] + 1, y: a[1], width: w, height: b[1] - a[1], r: [3, 3, 0, 0] }, style: api.style() };
            },
            encode: { x: [0, 1], y: 2 },
            data: bars.map(b => ({ value: b, itemStyle: { color: b[0] >= cap ? t.neutral : inBulk(b) ? t.uc : t.ucSoft } })),
            markLine: {
              symbol: 'none', silent: true, animation: false,
              label: { show: false },
              data: [
                [{ coord: [dist.median, 0], lineStyle: { color: t.inkStrong, type: 'solid', width: 1.5 } }, { coord: [dist.median, ytop] }],
                [{ coord: [dist.mean, 0], lineStyle: { color: t.muted, type: 'dashed', width: 1.5 } }, { coord: [dist.mean, ytop] }],
              ],
            },
            markArea: {
              silent: true, itemStyle: { color: 'rgba(0,0,0,0)', borderColor: t.uc, borderWidth: 0 },
              label: { show: true, position: 'insideTop', color: t.uc, fontWeight: 600, fontSize: 12, formatter: `Half of clients: day ${dh.from}–${dh.to}`, distance: 6 },
              data: [[{ xAxis: dh.from }, { xAxis: dh.to + 1 }]],
            },
          }],
        });
      }
      // cumulative view: share of the clients who reached UC, by day
      const pts = dist.ecdf.filter(p => p[0] <= cap);
      const marks = dist.within.filter(w => w.days <= 120);
      return Object.assign(o, {
        grid: { left: 8, right: 18, top: 24, bottom: 28, containLabel: true },
        tooltip: Object.assign(o.tooltip, { formatter: ps => { const p = ps[0]; return `Within <b>${p.value[0]} days</b>: ${R.pct(p.value[1], 1)} of the ${dist.n} clients`; } }),
        xAxis: R.valAxis(t, {
          min: 0, max: cap, interval: 30, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: t.axis } },
          name: 'days from client start to Under Contract', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 12 },
        }),
        yAxis: R.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, fontSize: 12, formatter: v => R.pct(v) } }),
        series: [{
          type: 'line', step: 'end', showSymbol: false, data: pts, lineStyle: { color: t.uc, width: 2.5 }, itemStyle: { color: t.uc },
          areaStyle: { color: t.ucSoft, opacity: 0.35 },
          markPoint: {
            symbol: 'circle', symbolSize: 9, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 2 },
            label: { position: 'left', color: t.inkStrong, fontSize: 12, fontWeight: 600, formatter: p => `${R.pct(p.value)} by day ${p.data.coord[0]}`, distance: 8 },
            data: marks.map(w => ({ coord: [w.days, w.share], value: w.share })),
          },
        }],
      });
    });
    return v => { view = v; rec.draw(); };
  }

  function agingChart(node, u) {
    R.chart(node, t => {
      const o = R.base(t);
      return Object.assign(o, {
        grid: { left: 8, right: 12, top: 16, bottom: 26, containLabel: true },
        tooltip: Object.assign(o.tooltip, { axisPointer: { type: 'shadow' } }),
        xAxis: R.catAxis(t, u.buckets.map(b => b.replace(' days', '')), {
          name: 'days since client start', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 12 },
        }),
        yAxis: R.valAxis(t, { name: 'clients', nameTextStyle: { color: t.muted, fontSize: 12, align: 'left' } }),
        series: [
          { name: 'Searching, never under contract', type: 'bar', stack: 'a', data: u.searching_never, itemStyle: { color: t.wait, borderColor: t.surface, borderWidth: 1 }, barWidth: '56%' },
          { name: 'Searching again after a contract fell through', type: 'bar', stack: 'a', data: u.searching_again, itemStyle: { color: t.waitSoft, borderColor: t.surface, borderWidth: 1 } },
          { name: 'Under contract, waiting to close', type: 'bar', stack: 'a', data: u.under_contract, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 1, borderRadius: [3, 3, 0, 0] },
            label: { show: true, position: 'top', color: t.inkStrong, fontSize: 12, fontWeight: 600,
              formatter: p => u.searching_never[p.dataIndex] + u.searching_again[p.dataIndex] + u.under_contract[p.dataIndex] } },
        ],
      });
    });
  }

  function kmChart(node, est, dist) {
    R.chart(node, t => {
      const o = R.base(t);
      const step = c => c.map(p => [p[0], p[1]]);
      const obs = dist.ecdf.filter(p => p[0] <= 365);
      return Object.assign(o, {
        grid: { left: 8, right: 22, top: 22, bottom: 28, containLabel: true },
        tooltip: Object.assign(o.tooltip, {
          formatter: ps => `<b>Day ${ps[0].value[0]}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: ${R.pct(p.value[1])}`).join('<br>'),
        }),
        xAxis: R.valAxis(t, {
          min: 0, max: 365, interval: 30, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: t.axis } },
          name: 'days from client start', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 12 },
        }),
        yAxis: R.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, fontSize: 12, formatter: v => R.pct(v) } }),
        series: [
          { name: 'Under Contract, clients who got there only', type: 'line', step: 'end', showSymbol: false, data: obs, lineStyle: { color: t.uc, width: 1.5, type: 'dashed', opacity: 0.7 }, itemStyle: { color: t.uc }, z: 1 },
          { name: 'Under Contract, all signed-up clients', type: 'line', step: 'end', showSymbol: false, data: step(est.uc.curve), lineStyle: { color: t.uc, width: 2.5 }, itemStyle: { color: t.uc }, z: 3,
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.muted, type: 'dotted' }, label: { color: t.muted, fontSize: 11, formatter: 'half of clients', position: 'insideEndTop' }, data: [{ yAxis: 0.5 }] },
            markPoint: { symbol: 'circle', symbolSize: 10, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 2 },
              label: { position: 'right', color: t.inkStrong, fontWeight: 600, fontSize: 12, formatter: `${est.uc.primary.median} days`, distance: 6, offset: [0, 10] },
              data: [{ coord: [est.uc.primary.median, 0.5] }] } },
          { name: 'CLOSED, all signed-up clients', type: 'line', step: 'end', showSymbol: false, data: step(est.closed.curve), lineStyle: { color: t.closed, width: 2.5 }, itemStyle: { color: t.closed }, z: 2,
            markPoint: { symbol: 'circle', symbolSize: 10, itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 2 },
              label: { position: 'right', color: t.inkStrong, fontWeight: 600, fontSize: 12, formatter: `${est.closed.primary.median} days`, distance: 6, offset: [0, 10] },
              data: [{ coord: [est.closed.primary.median, 0.5] }] } },
        ],
      });
    });
  }

  R.story('speed', {
    nav: 'Acquisition speed',
    render(root, D) {
      const sp = D.speed, ob = sp.observed, dist = sp.distribution.uc, dc = sp.distribution.closed, u = sp.unfinished, est = sp.estimate;
      const w = d => dist.within.find(x => x.days === d);
      const tail = dist.tail, nu = u.never_uc, uw = u.under_contract_wait;
      const eras = sp.cohorts.eras;
      const recentEra = eras[eras.length - 1], prevEras = eras.filter(e => e.reliable).slice(0, -1);
      const alts = est.uc.alternatives, calts = est.closed.alternatives, old = sp.older_starts.uc;
      const lk = est.uc.range.likely, lkc = est.closed.range.likely, df = dist.dense_fortnight;
      root.innerHTML = `
      <div class="wrap">
        <header class="story-head">
          <div class="eyebrow">Acquisition speed <i>· Acquisition clock</i></div>
          <h2>Clients who go under contract usually do so in about five weeks; counting everyone, half are under contract within two months</h2>
          <p>Completed contracts are quick and tightly clustered. A slow minority, and the clients still searching, stretch the overall timeline.</p>
        </header>

        <div class="beat">
          <div class="beat-title"><span class="k">A</span><h3>What completed acquisitions took</h3></div>
          <div class="tiles">
            <div class="tile">
              <div class="tile-head"><i style="background:var(--c-uc)"></i>Client start → Under Contract</div>
              <div class="tile-nums"><div><strong class="num">${ob.uc.median}<small>days</small></strong><span>median</span></div><div><strong class="num">${Math.round(ob.uc.mean)}<small>days</small></strong><span>average</span></div></div>
              <p>${R.int(ob.uc.n)} clients with a logged date for their first contract. The middle half took ${ob.uc.p25} to ${ob.uc.p75} days.</p>
            </div>
            <div class="tile">
              <div class="tile-head"><i style="background:var(--c-closed)"></i>Client start → CLOSED</div>
              <div class="tile-nums"><div><strong class="num">${ob.closed.median}<small>days</small></strong><span>median</span></div><div><strong class="num">${Math.round(ob.closed.mean)}<small>days</small></strong><span>average</span></div></div>
              <p>${R.int(ob.closed.n)} clients with a logged closing date. The middle half took ${ob.closed.p25} to ${ob.closed.p75} days.</p>
            </div>
          </div>
          <p class="caption">Clock starts at the onboarding-call date (or the record's creation date if none is set). Each average sits well above its median because a small number of very long searches pulls it up.</p>
        </div>

        <div class="beat">
          <div class="beat-title"><span class="k">B</span><h3>About half of clients who went under contract did so between day ${dist.dense_half.from} and day ${dist.dense_half.to}</h3></div>
          <div class="grid g-main">
            <div class="card">
              <div class="card-head">
                <h4>Days from client start to Under Contract<span class="sub">${R.int(dist.n)} clients who reached a contract · weekly bins</span></h4>
                <span id="histSeg"></span>
              </div>
              <div class="chart tall" id="histChart" role="img" aria-label="Histogram of days to Under Contract. Half of clients fall between day ${dist.dense_half.from} and ${dist.dense_half.to}; median ${dist.median}, average ${Math.round(dist.mean)}."></div>
              <div class="legend"><span><i style="background:var(--c-uc)"></i>Weeks holding the densest half of clients</span><span><i style="background:var(--c-uc-soft)"></i>Other weeks</span><span><i style="background:var(--c-neutral)"></i>${dist.cap}+ days</span><span><i class="line" style="background:var(--ink-strong)"></i>Median ${dist.median}</span><span><i class="dash" style="color:var(--muted)"></i>Average ${Math.round(dist.mean)}</span></div>
            </div>
            <div class="facts">
              <div class="fact accent"><div class="v num">${R.pct(dist.dense_half.share)}<small>between day ${dist.dense_half.from} and ${dist.dense_half.to}</small></div><p>${R.int(dist.dense_half.n)} of ${R.int(dist.n)} clients; no narrower window holds half. ${R.pct(dist.faster_than_bulk)} were faster and ${R.pct(dist.slower_than_bulk)} slower. The busiest two weeks are days ${df.from}–${df.to}, with ${R.pct(df.share)} of contracts.</p></div>
              <div class="fact">
                <table class="t" aria-label="Share under contract within N days">
                  <thead><tr><th>Under contract within</th><th class="n">Clients</th><th class="n">Share</th></tr></thead>
                  <tbody>${dist.within.filter(x => x.days <= 120).map(x => `<tr${x.days === 60 ? ' class="hl"' : ''}><td>${x.days} days</td><td class="n">${R.int(x.n)}</td><td class="n">${R.pct(x.share)}</td></tr>`).join('')}</tbody>
                </table>
              </div>
              <div class="fact accent-wait"><div class="v num">${R.pct(tail.slow_share_of_days)}<small>of all days waited</small></div><p>come from the slowest 10% (${tail.slow_n} clients, ${tail.slow_from}+ days, up to ${tail.max}). Without them the average drops from ${Math.round(dist.mean)} to ${Math.round(tail.mean_without_slow)} days. The tail is longer than it looks: ${R.pct(old.recent_share)} of these clients started in the last six months and can't have long searches yet. Among clients who started earlier, the average is ${Math.round(old.mean)} days and ${R.pct(old.over120)} took more than 120.</p></div>
            </div>
          </div>
          <div class="means"><span class="lbl">What it means</span><div>
            <p>A successful search is typically a five-to-six-week job, and the median (${dist.median} days) and the day ${dist.dense_half.from}–${dist.dense_half.to} window hold up in every cut of the data. Quote those, not the average, which a long tail of slow searches inflates.</p>
            <p>Every figure here is a share of the ${R.int(dist.n)} clients who reached a contract, not of all clients. Of all signed-up clients, about half are under contract by day 60 (part D).</p>
          </div></div>
          <details class="more">
            <summary>Has the timing shifted between client cohorts? And the same view for CLOSED</summary>
            <div class="inner">
              <p>Completed-only medians favour recent cohorts, whose slow searches haven't finished yet. The fair comparison counts every client in the cohort, including those still searching (the same estimate as part D).</p>
              <p>Since late May, clients on the Confidence Call path start the clock about a week before buying, so measured from the start they look slower than they are. Measured from the purchase date, Confidence Call and other clients reach contracts at the same pace.</p>
              <div class="tbl-wrap"><table class="t">
                <thead><tr><th>Client start</th><th class="n">Clients</th><th class="n">Under contract by day 30</th><th class="n">by day 60</th><th class="n">by day 90</th><th class="n">Estimated median</th><th class="n">Median, completed only</th></tr></thead>
                <tbody>${eras.map(e => `<tr${e === recentEra ? ' class="hl"' : ''}><td>${e.label}${e.reliable ? '' : ' <span class="dim">(incomplete records)</span>'}</td><td class="n">${R.int(e.n)}</td><td class="n">${R.pct(e.by['30'])}</td><td class="n">${R.pct(e.by['60'])}</td><td class="n">${R.pct(e.by['90'])}</td><td class="n">${e.est_median == null ? '–' : e.est_median + ' days'}</td><td class="n">${e.completed_median} days</td></tr>`).join('')}</tbody>
              </table></div>
              <p>Since late May, ${R.pct(recentEra.by['60'])} of clients were under contract by day 60, against ${prevEras.map(e => R.pct(e.by['60'])).join(' and ')} in the two earlier periods: a modest improvement, not a step change. By day 90 the periods are level. All three are slower than 2024 to mid-2025, though records from that period are a surviving subset. Many of the newest clients have fewer than 90 days of history, so the recent figures will move.</p>
              <p><b>CLOSED.</b> Half of closings land between day ${dc.dense_half.from} and day ${dc.dense_half.to}; the busiest fortnight is weeks ${dc.modal_fortnight.weeks[0]}–${dc.modal_fortnight.weeks[1]} (${R.pct(dc.modal_fortnight.share)}). ${R.pct(dc.within.find(x => x.days === 90).share)} closed within 90 days and ${R.pct(dc.within.find(x => x.days === 120).share)} within 120. The slowest 10% (${dc.tail.slow_n} clients, ${dc.tail.slow_from}+ days) lift the average from ${Math.round(dc.tail.mean_without_slow)} to ${Math.round(dc.mean)} days. Contract to close typically takes ${uw.typical_uc_to_close.median} days (middle half ${uw.typical_uc_to_close.p25}–${uw.typical_uc_to_close.p75}).</p>
            </div>
          </details>
        </div>

        <div class="beat">
          <div class="beat-title"><span class="k">C</span><h3>${R.int(u.n_unfinished)} clients are mid-journey; the ${R.int(nu ? u.n_never_uc : 0)} still searching have already waited a median of ${Math.round(nu.median_wait)} days</h3></div>
          <div class="grid g-main">
            <div class="card">
              <div class="card-head"><h4>Clients whose journey is unfinished, by time since client start<span class="sub">Current status on ${R.date(D.meta.asof)} · ${R.int(u.n_searching)} searching, ${R.int(u.n_under_contract)} under contract</span></h4></div>
              <div class="chart" id="agingChart" role="img" aria-label="Unfinished clients by days since start."></div>
              <div class="legend"><span><i style="background:var(--c-wait)"></i>Searching, never under contract</span><span><i style="background:var(--c-wait-soft)"></i>Searching again after a contract fell through</span><span><i style="background:var(--c-uc)"></i>Under contract, waiting to close</span></div>
            </div>
            <div class="facts">
              <div class="fact accent-wait"><div class="v num">${R.int(nu.past_completed_median)}<small>of ${R.int(u.n_never_uc)}</small></div><p>searching clients have already waited longer than the ${dist.median}-day median of completed contracts. ${R.int(nu.wait_90)} have waited 90+ days and ${R.int(nu.wait_180)} more than 180.</p></div>
              <div class="fact accent"><div class="v num">${Math.round(uw.median_since_uc)}<small>days under contract (median)</small></div><p>The ${R.int(u.n_under_contract)} clients under contract are on schedule: contract to close typically takes ${uw.typical_uc_to_close.median} days and 90% close within ${uw.typical_uc_to_close.p90}. ${uw.past_p90 === 0 ? 'None has' : R.int(uw.past_p90) + ' has'} passed that mark.</p></div>
              <div class="fact"><div class="v num">${R.int(u.on_hold.paused + u.on_hold.refunded + u.on_hold.additional)}<small>paused or refunded</small></div><p>${R.int(u.on_hold.paused)} paused, ${R.int(u.on_hold.refunded)} refunded, ${R.int(u.on_hold.additional)} on additional services. ${R.int(u.on_hold.never_uc)} of them never reached a contract. They are outside the active pipeline but count in part D.</p></div>
            </div>
          </div>
          <div class="means"><span class="lbl">What it means</span><div>
            <p>The contract-to-close stage is running to its normal rhythm. The open question is the search stage: ${R.int(nu.wait_60)} clients have searched for 60+ days without a contract, and none of their time appears in the completed-client figures in A and B.</p>
          </div></div>
        </div>

        <div class="beat">
          <div class="beat-title"><span class="k">D</span><h3>Counting every client, half are under contract within about ${est.uc.primary.median} days and closed within about ${est.closed.primary.median}</h3></div>
          <div class="grid g-main">
            <div class="card">
              <div class="card-head"><h4>Share of signed-up clients who have reached each milestone, by days since start<span class="sub">Kaplan–Meier estimate: clients still searching count for the time they have waited so far</span></h4></div>
              <div class="chart tall" id="kmChart" role="img" aria-label="Estimated share of clients reaching Under Contract and CLOSED over time."></div>
              <div class="legend"><span><i class="line" style="background:var(--c-uc)"></i>Under Contract, all clients</span><span><i class="line" style="background:var(--c-closed)"></i>CLOSED, all clients</span><span><i class="dash" style="color:var(--c-uc)"></i>Under Contract, completed clients only (part B)</span></div>
            </div>
            <div class="facts">
              <div class="fact accent"><div class="v num">${est.uc.primary.median}<small>days: half of clients under contract</small></div><p>Likely between ${lk[0]} and ${lk[1]} days, allowing for record gaps and sampling. About ${R.pct(est.uc.primary.by['365'])} reach a contract within a year; most of the rest paused or were refunded.</p></div>
              <div class="fact accent-closed"><div class="v num">${est.closed.primary.median}<small>days: half of clients closed</small></div><p>Likely between ${lkc[0]} and ${lkc[1]} days. About ${R.pct(est.closed.primary.by['365'])} close within a year.</p></div>
              <div class="fact"><p><b>Why these differ from earlier reporting (${est.uc.prior.median} and ${est.closed.prior.median} days).</b> ${R.int(est.uc.inferred)} clients closed on a property but have no logged contract date, a gap in Jira's status history. The earlier ${est.uc.prior.median}-day figure counted them as never under contract. Here they count as under contract, ${sp.uc_to_close_typical} days before their closing. ${R.int(est.closed.left_out)} clients in post-close statuses with no closing date are left out of the closing estimate.</p></div>
            </div>
          </div>
          <div class="means"><span class="lbl">What it means</span><div>
            <p>Completed-client figures (${dist.median} and ${ob.closed.median} days) describe the clients who finished. Across all signed-up clients, half are under contract within about two months and closed within about four. These are estimates from past patterns, not commitments: they assume today's searching clients progress as earlier clients did at the same point, and that paused or refunded clients rarely return.</p>
          </div></div>
          <details class="more">
            <summary>How unfinished, paused, refunded and incomplete records are treated</summary>
            <div class="inner">
              <p>Each client counts from their start until they reach the milestone, or until the snapshot date (${R.date(D.meta.asof)}) if they have not. Paused, refunded and additional-service clients stay in as not having reached it. The table shows how far the estimate moves under other reasonable choices.</p>
              <div class="tbl-wrap"><table class="t">
                <thead><tr><th>Treatment</th><th class="n">Median to UC</th><th class="n">Median to CLOSED</th><th>What changes</th></tr></thead>
                <tbody>
                  <tr class="hl"><td>Primary estimate</td><td class="n">${est.uc.primary.median} days</td><td class="n">${est.closed.primary.median} days</td><td>${est.uc.primary.note}</td></tr>
                  <tr><td>${alts[0].label}</td><td class="n">${alts[0].median} days</td><td class="n dim">–</td><td>${alts[0].note}</td></tr>
                  <tr><td>${alts[1].label}</td><td class="n">${alts[1].median} days</td><td class="n dim">–</td><td>${alts[1].note}</td></tr>
                  <tr><td>${alts[2].label}</td><td class="n">${alts[2].median} days</td><td class="n">${calts[1].median} days</td><td>${alts[2].note}</td></tr>
                  <tr><td>${alts[4].label}</td><td class="n">${alts[4].median} days</td><td class="n">${calts[3].median} days</td><td>${alts[4].note}</td></tr>
                  <tr><td class="dim">${alts[3].label}</td><td class="n dim">${alts[3].median} days</td><td class="n dim">${calts[2].median} days</td><td class="dim">${alts[3].note}</td></tr>
                  <tr><td>As previously reported</td><td class="n">${est.uc.prior.median} days</td><td class="n">${est.closed.prior.median} days</td><td>${est.uc.prior.note} ${est.closed.prior.note}</td></tr>
                </tbody>
              </table></div>
              <p>Sampling alone puts the contract estimate between ${Math.round(est.uc.range.sampling[0])} and ${Math.round(est.uc.range.sampling[1])} days and the closing estimate between ${Math.round(est.closed.range.sampling[0])} and ${Math.round(est.closed.range.sampling[1])}. ${R.int(est.uc.left_out)} clients whose status says they closed but who have neither date are left out of the contract estimate. A client whose contract fell through counts from their first contract date.</p>
              <p>Jira's extract keeps only each record's recent status history, so older milestone dates are gradually dropping out; that is why ${R.int(est.uc.inferred)} closed clients have no contract date. Older copies of the table recover some of them and point to about 59 days, inside the range above.</p>
            </div>
          </details>
        </div>
      </div>`;

      const setView = histogram(R.$('#histChart', root), dist, est);
      R.$('#histSeg', root).append(R.seg([{ value: 'dist', label: 'Distribution' }, { value: 'cum', label: 'Cumulative' }], 'dist', setView, 'Histogram view'));
      agingChart(R.$('#agingChart', root), u);
      kmChart(R.$('#kmChart', root), est, dist);
    },
  });
})();
