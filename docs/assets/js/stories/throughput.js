/* Operational throughput: clients in vs contracts and closings out. */
(function () {
  'use strict';
  const R = window.R;

  function flowChart(node, th, meta) {
    const rows = th.monthly;
    R.chart(node, t => {
      const o = R.base(t);
      const changeIdx = rows.findIndex(r => r.month === meta.post_change_first_month);
      return Object.assign(o, {
        grid: { left: 8, right: 14, top: 34, bottom: 8, containLabel: true },
        tooltip: Object.assign(o.tooltip, {
          axisPointer: { type: 'shadow' },
          formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.label}${r.partial ? ' (to ' + R.date(meta.asof) + ')' : ''}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: ${p.value}`).join('<br>'); },
        }),
        xAxis: R.catAxis(t, rows.map(r => R.monShort(r.month)), { axisLabel: { color: t.label, fontSize: 12, interval: i => ['01', '04', '07', '10'].includes(rows[i].month.slice(5)) } }),
        yAxis: R.valAxis(t),
        series: [
          { name: 'New clients', type: 'bar', barWidth: '64%', data: rows.map(r => ({ value: r.new, itemStyle: { color: t.neutral2, opacity: r.partial ? 0.45 : 1, borderRadius: [3, 3, 0, 0] } })),
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.gold, type: 'dashed', width: 1.5 },
              label: { formatter: 'New offer + Confidence Call', color: t.gold, fontWeight: 600, fontSize: 12, position: 'end' },
              data: changeIdx >= 0 ? [{ xAxis: changeIdx - 0.5 }] : [] } },
          { name: 'Under Contract', type: 'line', data: rows.map(r => r.uc_all), symbol: 'circle', symbolSize: 7, lineStyle: { color: t.uc, width: 3 }, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 1.5 } },
          { name: 'CLOSED', type: 'line', data: rows.map(r => r.closed), symbol: 'circle', symbolSize: 7, lineStyle: { color: t.closed, width: 3 }, itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 1.5 } },
        ],
      });
    });
  }

  function openChart(node, th) {
    const rows = th.monthly.filter(r => r.month >= '2025-07');
    R.chart(node, t => {
      const o = R.base(t);
      return Object.assign(o, {
        grid: { left: 8, right: 30, top: 26, bottom: 8, containLabel: true },
        tooltip: Object.assign(o.tooltip, { formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.label}</b><br>${r.open_searches} searching without a contract`; } }),
        xAxis: R.catAxis(t, rows.map(r => R.monShort(r.month)), { boundaryGap: false, axisLabel: { color: t.label, fontSize: 12, interval: i => ['01', '04', '07', '10'].includes(rows[i].month.slice(5)) } }),
        yAxis: R.valAxis(t, { min: 0 }),
        series: [{
          type: 'line', data: rows.map(r => r.open_searches), symbol: 'none', smooth: 0.2, lineStyle: { color: t.wait, width: 3 }, areaStyle: { color: t.waitSoft, opacity: 0.45 },
          markPoint: { symbol: 'circle', symbolSize: 9, itemStyle: { color: t.wait, borderColor: t.surface, borderWidth: 2 },
            label: { position: 'top', color: t.inkStrong, fontWeight: 700, fontSize: 13, formatter: p => p.value },
            data: [{ coord: [rows.findIndex(r => r.month === th.open_searches.peak.month), th.open_searches.peak.n], value: th.open_searches.peak.n },
                   { coord: [rows.length - 1, th.open_searches.now], value: th.open_searches.now }] },
        }],
      });
    });
  }

  function waterfall(node, sp) {
    const steps = [
      { k: 'start', l: R.date(sp.from).replace(/, \d{4}$/, ''), v: sp.start },
      { k: 'in', l: 'New clients', v: sp.entered },
      { k: 'uc', l: 'Went under contract', v: -sp.went_uc },
      { k: 'out', l: 'Paused / refunded', v: -sp.exited },
      { k: 'end', l: 'Now', v: sp.end },
    ];
    let run = 0;
    const base = [], val = [];
    steps.forEach(s => {
      if (s.k === 'start' || s.k === 'end') { base.push(0); val.push(s.v); run = s.v; }
      else if (s.v >= 0) { base.push(run); val.push(s.v); run += s.v; }
      else { run += s.v; base.push(run); val.push(-s.v); }
    });
    R.chart(node, t => {
      const o = R.base(t);
      const col = { start: t.wait, in: t.neutral, uc: t.uc, out: t.hold, end: t.wait };
      return Object.assign(o, {
        grid: { left: 8, right: 8, top: 26, bottom: 8, containLabel: true },
        tooltip: { show: false },
        xAxis: R.catAxis(t, steps.map(s => s.l), { axisLabel: { color: t.label, fontSize: 11.5, interval: 0, width: 80, overflow: 'break' } }),
        yAxis: R.valAxis(t, { min: 0 }),
        series: [
          { type: 'bar', stack: 'w', data: base, itemStyle: { color: 'transparent' }, silent: true },
          { type: 'bar', stack: 'w', barWidth: '58%', data: steps.map((s, i) => ({ value: val[i], itemStyle: { color: col[s.k], borderRadius: 3 } })),
            label: { show: true, position: 'top', color: t.inkStrong, fontWeight: 700, fontSize: 13, formatter: p => { const s = steps[p.dataIndex]; return s.k === 'in' ? '+' + s.v : s.v < 0 ? '−' + (-s.v) : s.v; } } },
        ],
      });
    });
  }

  R.story('throughput', {
    nav: 'Throughput',
    render(root, D) {
      const th = D.throughput, pre = th.pre, post = th.post, cc = th.cohort_compare, sp = th.since_peak;
      root.innerHTML = `
      <div class="wrap">
        <div class="sec-head"><div class="eyebrow">Operational throughput</div><h2>Is acquisition output keeping pace with new clients?</h2></div>

        <div class="panel">
          <div class="panel-title"><h4>New clients vs contracts and closings, by month</h4><span>${th.monthly[th.monthly.length - 1].label} is partial (faded)</span></div>
          <div class="chart tall" id="flowChart" role="img" aria-label="Monthly new clients, contracts and closings."></div>
          <div class="legend"><span><i style="background:var(--c-neutral-2)"></i>New signed-up clients</span><span><i class="line" style="background:var(--c-uc)"></i>Under Contract</span><span><i class="line" style="background:var(--c-closed)"></i>CLOSED</span></div>
          <div class="chips">
            <span class="chip">New clients <b>${R.ratio(th.ratio.new)}</b></span>
            <span class="chip">Under Contract <b>${R.ratio(th.ratio.uc_all)}</b></span>
            <span class="chip">CLOSED <b>${R.ratio(th.ratio.closed)}</b></span>
            <span class="chip">${post.label} vs ${pre.label}</span>
          </div>
        </div>
        <p class="takeaway"><b>Broadly yes:</b> contracts and closings scaled with the summer surge, about one to two months behind intake.</p>

        <div class="step"><span class="n">+</span><h3>Open searches peaked in ${th.open_searches.peak.label}</h3></div>
        <div class="row row-2">
          <div class="panel">
            <div class="panel-title"><h4>Clients searching without a contract</h4><span>Month end</span></div>
            <div class="chart short" id="openChart" role="img" aria-label="Open searches at month end."></div>
          </div>
          <div class="panel">
            <div class="panel-title"><h4>Why it fell since the peak</h4><span>${R.date(sp.from)} → ${R.date(D.meta.asof)}</span></div>
            <div class="chart short" id="waterfallChart" role="img" aria-label="Open searches ${sp.start} plus ${sp.entered} new, minus ${sp.went_uc} under contract, minus ${sp.exited} paused or refunded, equals ${sp.end}."></div>
          </div>
        </div>
        <p class="takeaway">The recent drop is mostly clients leaving (${sp.refunded} refunds), not faster contracts.</p>

        <details class="more">
          <summary>Same-cohort check and monthly figures</summary>
          <div class="inner">
            <div class="tbl-wrap"><table class="t">
              <thead><tr><th>Under contract within</th><th class="n">Started ${cc['60'].pre.months.join('–')}</th><th class="n">Started ${cc['60'].post.months.join('–')} / ${cc['90'].post.months.join('–')}</th></tr></thead>
              <tbody>
                <tr><td>60 days</td><td class="n">${R.pct(cc['60'].pre.share)} (${cc['60'].pre.num}/${cc['60'].pre.den})</td><td class="n">${R.pct(cc['60'].post.share)} (${cc['60'].post.num}/${cc['60'].post.den})</td></tr>
                <tr><td>90 days</td><td class="n">${R.pct(cc['90'].pre.share)} (${cc['90'].pre.num}/${cc['90'].pre.den})</td><td class="n">${R.pct(cc['90'].post.share)} (${cc['90'].post.num}/${cc['90'].post.den})</td></tr>
              </tbody>
            </table></div>
            <div class="tbl-wrap"><table class="t">
              <thead><tr><th>Month</th><th class="n">New</th><th class="n">Under Contract</th><th class="n">CLOSED</th><th class="n">Paused / refunded</th><th class="n">Open searches</th></tr></thead>
              <tbody>${th.monthly.slice().reverse().map(r => `<tr><td>${r.label}${r.partial ? ' (partial)' : ''}</td><td class="n">${r.new}</td><td class="n">${r.uc_all}</td><td class="n">${r.closed}</td><td class="n">${r.exits}</td><td class="n">${r.open_searches}</td></tr>`).join('')}</tbody>
            </table></div>
            <p>Under Contract includes contracts dated from a later closing where Jira lost the contract date.</p>
          </div>
        </details>
      </div>`;
      flowChart(R.$('#flowChart', root), th, D.meta);
      openChart(R.$('#openChart', root), th);
      waterfall(R.$('#waterfallChart', root), sp);
    },
  });
})();
