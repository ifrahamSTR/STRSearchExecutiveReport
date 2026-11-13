/* Acquisition speed: A observed -> B where the bulk falls -> C still in the journey -> D estimate for everyone. */
(function () {
  'use strict';
  const R = window.R;

  function histogram(node, dist) {
    const W = 7, cap = dist.cap, dh = dist.dense_half;
    R.chart(node, t => {
      const o = R.base(t);
      const bars = dist.bins7.map(b => [b.from, b.to + 1, b.n]);
      bars.push([cap, cap + W, dist.overflow]);
      const inBulk = b => b[0] + W > dh.from && b[0] <= dh.to;
      const ymax = Math.ceil(Math.max(...bars.map(b => b[2])) * 1.3 / 10) * 10, ytop = ymax * 0.8;
      return Object.assign(o, {
        grid: { left: 8, right: 18, top: 16, bottom: 30, containLabel: true },
        tooltip: Object.assign(o.tooltip, {
          trigger: 'item',
          formatter: p => { const b = p.data.value; return `<b>${b[0] >= cap ? cap + '+ days' : `Days ${b[0]}–${b[1] - 1}`}</b><br>${b[2]} clients (${R.pct(b[2] / dist.n, 1)})`; },
        }),
        xAxis: R.valAxis(t, {
          min: 0, max: cap + W, interval: 28, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: t.axis } },
          axisLabel: { color: t.label, fontSize: 12.5, formatter: v => (v >= cap ? cap + '+' : v) },
          name: 'days from client start to Under Contract', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted, fontSize: 12.5 },
        }),
        yAxis: R.valAxis(t, { max: ymax, axisLabel: { color: t.label, fontSize: 12 } }),
        series: [{
          type: 'custom',
          renderItem: (params, api) => {
            const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), 0]);
            return { type: 'rect', shape: { x: a[0] + 1, y: a[1], width: Math.max(1, b[0] - a[0] - 2), height: b[1] - a[1], r: [3, 3, 0, 0] }, style: api.style() };
          },
          encode: { x: [0, 1], y: 2 },
          data: bars.map(b => ({ value: b, itemStyle: { color: b[0] >= cap ? t.neutral : inBulk(b) ? t.uc : t.ucSoft } })),
          markLine: {
            symbol: 'none', silent: true, label: { show: false },
            data: [
              [{ coord: [dist.median, 0], lineStyle: { color: t.inkStrong, type: 'solid', width: 2 } }, { coord: [dist.median, ytop] }],
              [{ coord: [dist.mean, 0], lineStyle: { color: t.muted, type: 'dashed', width: 1.5 } }, { coord: [dist.mean, ytop] }],
            ],
          },
          markArea: {
            silent: true, itemStyle: { color: 'rgba(0,0,0,0)' },
            label: { show: true, position: 'insideTop', color: t.uc, fontWeight: 700, fontSize: 14, formatter: `Half land here · day ${dh.from}–${dh.to}`, distance: 4 },
            data: [[{ xAxis: dh.from }, { xAxis: dh.to + 1 }]],
          },
        }],
      });
    });
  }

  function agingChart(node, u) {
    R.chart(node, t => {
      const o = R.base(t);
      return Object.assign(o, {
        grid: { left: 8, right: 12, top: 22, bottom: 30, containLabel: true },
        tooltip: Object.assign(o.tooltip, { axisPointer: { type: 'shadow' } }),
        xAxis: R.catAxis(t, u.buckets.map(b => b.replace(' days', '')), {
          axisLabel: { color: t.label, fontSize: 12.5 },
          name: 'days waited so far', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted, fontSize: 12.5 },
        }),
        yAxis: R.valAxis(t),
        series: [
          { name: 'Searching', type: 'bar', stack: 'a', barWidth: '58%', data: u.searching.map(v => v), itemStyle: { color: t.wait, borderColor: t.surface, borderWidth: 1 } },
          { name: 'Under contract, not closed', type: 'bar', stack: 'a', data: u.under_contract, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 1, borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', color: t.inkStrong, fontSize: 13, fontWeight: 700, formatter: p => u.searching[p.dataIndex] + u.under_contract[p.dataIndex] } },
        ],
      });
    });
  }

  function dumbbell(node, rows) {
    R.chart(node, t => {
      const o = R.base(t);
      const col = { uc: t.uc, closed: t.closed };
      return Object.assign(o, {
        grid: { left: 8, right: 30, top: 26, bottom: 30, containLabel: true },
        tooltip: Object.assign(o.tooltip, {
          trigger: 'item',
          formatter: p => { const r = rows[p.dataIndex]; return `<b>${r.name}</b><br>Clients who got there: ${r.obs} days<br>All clients (estimate): ${r.est} days<br>Likely range: ${r.lo}–${r.hi}`; },
        }),
        yAxis: R.catAxis(t, rows.map(r => r.name), { inverse: true, axisLine: { show: false }, axisLabel: { color: t.inkStrong, fontSize: 14, fontWeight: 600 } }),
        xAxis: R.valAxis(t, { min: 0, max: 150, interval: 30, name: 'days from client start', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted, fontSize: 12.5 } }),
        series: [{
          type: 'custom',
          data: rows.map((r, i) => [i, r.obs, r.est, r.lo, r.hi]),
          renderItem: (params, api) => {
            const r = rows[api.value(0)], c = col[r.key];
            const y = api.coord([0, api.value(0)])[1];
            const xo = api.coord([api.value(1), 0])[0], xe = api.coord([api.value(2), 0])[0];
            const xl = api.coord([api.value(3), 0])[0], xh = api.coord([api.value(4), 0])[0];
            const txt = (x, dy, s, w, color) => ({ type: 'text', style: { x, y: y + dy, text: s, textAlign: 'center', textVerticalAlign: 'middle', fill: color, font: `${w} 15px Inter, sans-serif` } });
            return { type: 'group', children: [
              { type: 'line', shape: { x1: xl, y1: y, x2: xh, y2: y }, style: { stroke: c, lineWidth: 10, opacity: 0.18, lineCap: 'round' } },
              { type: 'line', shape: { x1: xo + 9, y1: y, x2: xe - 11, y2: y }, style: { stroke: t.muted, lineWidth: 2, lineDash: [4, 4] } },
              { type: 'circle', shape: { cx: xo, cy: y, r: 9 }, style: { fill: t.surface, stroke: c, lineWidth: 3 } },
              { type: 'circle', shape: { cx: xe, cy: y, r: 11 }, style: { fill: c, stroke: t.surface, lineWidth: 2 } },
              txt(xo, -24, `${r.obs}`, '600', t.ink),
              txt(xe, -26, `~${r.est}`, '700', t.inkStrong),
            ] };
          },
        }],
      });
    });
  }

  function kmChart(node, est, dist) {
    R.chart(node, t => {
      const o = R.base(t);
      return Object.assign(o, {
        grid: { left: 8, right: 22, top: 18, bottom: 28, containLabel: true },
        tooltip: Object.assign(o.tooltip, { formatter: ps => `<b>Day ${ps[0].value[0]}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: ${R.pct(p.value[1])}`).join('<br>') }),
        xAxis: R.valAxis(t, { min: 0, max: 365, interval: 60, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: t.axis } } }),
        yAxis: R.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, formatter: v => R.pct(v) } }),
        series: [
          { name: 'UC, clients who got there', type: 'line', step: 'end', showSymbol: false, data: dist.ecdf.filter(p => p[0] <= 365), lineStyle: { color: t.uc, width: 1.5, type: 'dashed' }, itemStyle: { color: t.uc } },
          { name: 'UC, all clients', type: 'line', step: 'end', showSymbol: false, data: est.uc.curve, lineStyle: { color: t.uc, width: 2.5 }, itemStyle: { color: t.uc },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.muted, type: 'dotted' }, label: { show: false }, data: [{ yAxis: 0.5 }] } },
          { name: 'CLOSED, all clients', type: 'line', step: 'end', showSymbol: false, data: est.closed.curve, lineStyle: { color: t.closed, width: 2.5 }, itemStyle: { color: t.closed } },
        ],
      });
    });
  }

  R.story('speed', {
    nav: 'Speed',
    render(root, D) {
      const sp = D.speed, ob = sp.observed, dist = sp.distribution.uc, u = sp.unfinished, est = sp.estimate;
      const w = d => dist.within.find(x => x.days === d);
      const nu = u.never_uc, uw = u.under_contract_wait, alts = est.uc.alternatives, calts = est.closed.alternatives;
      const rows = [
        { key: 'uc', name: 'Under Contract', obs: ob.uc.median, est: est.uc.primary.median, lo: est.uc.range.likely[0], hi: est.uc.range.likely[1] },
        { key: 'closed', name: 'CLOSED', obs: ob.closed.median, est: est.closed.primary.median, lo: est.closed.range.likely[0], hi: est.closed.range.likely[1] },
      ];
      root.innerHTML = `
      <div class="wrap">
        <div class="sec-head"><div class="eyebrow">Acquisition speed <i>· acquisition clock</i></div><h2>How long does acquisition take?</h2></div>

        <div class="step"><span class="n">A</span><h3>Clients who got there</h3></div>
        <div class="pairs">
          <div class="pair" style="--pc:var(--c-uc)"><span class="t">Client start → Under Contract</span>
            <div class="nums"><div><span class="big num">${ob.uc.median}<small>days</small></span><span class="cap">median</span></div><div><span class="mid num">${Math.round(ob.uc.mean)}<small>days</small></span><span class="cap">average</span></div></div>
            <span class="cap">${R.int(ob.uc.n)} clients</span></div>
          <div class="pair" style="--pc:var(--c-closed)"><span class="t">Client start → CLOSED</span>
            <div class="nums"><div><span class="big num">${ob.closed.median}<small>days</small></span><span class="cap">median</span></div><div><span class="mid num">${Math.round(ob.closed.mean)}<small>days</small></span><span class="cap">average</span></div></div>
            <span class="cap">${R.int(ob.closed.n)} clients</span></div>
        </div>

        <div class="step"><span class="n">B</span><h3>Most contracts land between day ${dist.dense_half.from} and day ${dist.dense_half.to}</h3></div>
        <div class="panel">
          <div class="panel-title"><h4>Days to Under Contract</h4><span>${R.int(dist.n)} clients who reached a contract · weekly bins</span></div>
          <div class="chart tall" id="histChart" role="img" aria-label="Distribution of days to Under Contract; half fall between day ${dist.dense_half.from} and ${dist.dense_half.to}."></div>
          <div class="legend"><span><i style="background:var(--c-uc)"></i>Densest half</span><span><i class="line" style="background:var(--ink-strong)"></i>Median ${dist.median}</span><span><i class="dash" style="color:var(--muted)"></i>Average ${Math.round(dist.mean)}</span></div>
          <div class="chips">${[30, 60, 90, 120].map(d => `<span class="chip">within ${d} days <b>${R.pct(w(d).share)}</b></span>`).join('')}</div>
        </div>
        <p class="takeaway">A slow tail of long searches pulls the average (${Math.round(dist.mean)}) above the median (${dist.median}).</p>

        <div class="step"><span class="n">C</span><h3>${R.int(u.n_unfinished)} clients are still mid-journey</h3></div>
        <div class="row row-main">
          <div class="panel">
            <div class="panel-title"><h4>Unfinished journeys by time waited</h4><span>As of ${R.date(D.meta.asof)}</span></div>
            <div class="chart" id="agingChart" role="img" aria-label="Clients still searching or under contract, by days waited."></div>
            <div class="legend"><span><i style="background:var(--c-wait)"></i>Searching</span><span><i style="background:var(--c-uc)"></i>Under contract, not closed</span></div>
          </div>
          <div class="stack">
            <div class="stat" style="--sc:var(--c-wait)"><div class="v num">${R.int(u.n_searching)}</div><div class="l">still searching · ${R.int(nu.past_completed_median)} already past the ${dist.median}-day median</div></div>
            <div class="stat" style="--sc:var(--c-uc)"><div class="v num">${R.int(u.n_under_contract)}</div><div class="l">under contract · typically close ${uw.typical_uc_to_close.median} days after contract</div></div>
          </div>
        </div>
        <p class="takeaway">None of these waits appear in the medians above, so those medians understate the full timeline.</p>

        <div class="step"><span class="n">D</span><h3>Counting everyone, the timeline stretches</h3></div>
        <div class="panel">
          <div class="panel-title"><h4>Median days: clients who got there vs all signed-up clients</h4><span>Shaded = likely range</span></div>
          <div class="chart short" id="dumbbellChart" role="img" aria-label="Under Contract ${rows[0].obs} days observed, about ${rows[0].est} days for all clients; CLOSED ${rows[1].obs} observed, about ${rows[1].est} for all clients."></div>
          <div class="legend"><span><i class="dot" style="background:var(--surface);border:2px solid var(--ink-2)"></i>Clients who got there</span><span><i class="dot" style="background:var(--ink-2)"></i>All clients, incl. those still waiting (estimate)</span></div>
        </div>
        <p class="takeaway">Half of all clients are under contract by <b>~${rows[0].est} days</b> and closed by <b>~${rows[1].est} days</b>.</p>
        <details class="more">
          <summary>How the estimate works</summary>
          <div class="inner">
            <p>Kaplan–Meier estimate: each client counts for as long as they have waited so far. Paused and refunded clients stay in as not reaching the milestone. Clients who closed without a logged contract date count as under contract ${sp.uc_to_close_typical} days before closing. Previously reported figures (${est.uc.prior.median} and ${est.closed.prior.median} days) counted those clients as never under contract.</p>
            <div class="chart mid" id="kmChart" role="img" aria-label="Share of clients reaching each milestone over time."></div>
            <div class="legend"><span><i class="line" style="background:var(--c-uc)"></i>Under Contract, all clients</span><span><i class="line" style="background:var(--c-closed)"></i>CLOSED, all clients</span><span><i class="dash" style="color:var(--c-uc)"></i>UC, clients who got there</span></div>
            <div class="tbl-wrap"><table class="t">
              <thead><tr><th>Treatment</th><th class="n">Median to UC</th><th class="n">Median to CLOSED</th></tr></thead>
              <tbody>
                <tr class="hl"><td>Primary estimate</td><td class="n">${est.uc.primary.median}</td><td class="n">${est.closed.primary.median}</td></tr>
                <tr><td>${alts[0].label}</td><td class="n">${alts[0].median}</td><td class="n dim">–</td></tr>
                <tr><td>${alts[1].label}</td><td class="n">${alts[1].median}</td><td class="n dim">–</td></tr>
                <tr><td>${alts[2].label}</td><td class="n">${alts[2].median}</td><td class="n">${calts[1].median}</td></tr>
                <tr><td>${alts[4].label}</td><td class="n">${alts[4].median}</td><td class="n">${calts[3].median}</td></tr>
                <tr><td>As previously reported</td><td class="n">${est.uc.prior.median}</td><td class="n">${est.closed.prior.median}</td></tr>
              </tbody>
            </table></div>
          </div>
        </details>
      </div>`;
      histogram(R.$('#histChart', root), dist);
      agingChart(R.$('#agingChart', root), u);
      dumbbell(R.$('#dumbbellChart', root), rows);
      kmChart(R.$('#kmChart', root), est, dist);
    },
  });
})();
