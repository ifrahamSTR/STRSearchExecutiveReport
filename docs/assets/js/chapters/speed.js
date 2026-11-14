/* Chapter 2: how long does it actually take? Four scenes on one shared day axis:
   recorded durations -> where the bulk falls -> journeys still running -> Kaplan-Meier. */
(function () {
  'use strict';
  const S = window.S;
  const DISPLAY = '"Bricolage Grotesque", Figtree, sans-serif', BODY = 'Figtree, sans-serif', MONO = '"IBM Plex Mono", monospace';

  /* 2.1 recorded durations as journey bars: solid to the median, lighter to the average */
  function ruler(node, ob) {
    const rows = [{ k: 'uc', name: 'Under Contract', ...ob.uc }, { k: 'closed', name: 'CLOSED', ...ob.closed }];
    S.chart(node, t => {
      const col = { uc: [t.uc, t.uc2], closed: [t.closed, t.closed2] };
      return Object.assign(S.base(t), {
        tooltip: { show: false },
        grid: { left: 150, right: 28, top: 30, bottom: 44 },
        xAxis: S.dayAxis(t, 150, { name: 'days from client start' }),
        yAxis: { type: 'category', data: rows.map(r => r.name), inverse: true, show: false },
        series: [{
          type: 'custom', encode: { x: 1, y: 0 }, data: rows.map((r, i) => [i, r.median, r.mean]),
          renderItem: (p, api) => {
            const i = api.value(0), r = rows[i], c = col[r.k], h = 30;
            const [x0, y] = api.coord([0, i]), xm = api.coord([r.median, i])[0], xa = api.coord([r.mean, i])[0], xe = api.coord([150, i])[0];
            return { type: 'group', children: [
              { type: 'rect', shape: { x: x0, y: y - h / 2, width: xe - x0, height: h, r: h / 2 }, style: { fill: t.grid } },
              { type: 'rect', shape: { x: x0, y: y - h / 2, width: xa - x0, height: h, r: h / 2 }, style: { fill: c[1] } },
              { type: 'rect', shape: { x: x0, y: y - h / 2, width: xm - x0, height: h, r: h / 2 }, style: { fill: c[0] } },
              { type: 'line', shape: { x1: xa, y1: y - h / 2 - 5, x2: xa, y2: y + h / 2 + 5 }, style: { stroke: t.ink2, lineWidth: 2 } },
              { type: 'text', style: { x: xm, y: y - h / 2 - 8, text: String(r.median), textAlign: 'right', textVerticalAlign: 'bottom', font: `700 34px ${DISPLAY}`, fill: t.ink } },
              { type: 'text', style: { x: xm + 6, y: y - h / 2 - 12, text: 'days median', textAlign: 'left', textVerticalAlign: 'bottom', font: `500 13px ${BODY}`, fill: t.ink2 } },
              { type: 'text', style: { x: xa, y: y + h / 2 + 10, text: `average ${S.d1(r.mean)}`, textAlign: 'center', textVerticalAlign: 'top', font: `500 13px ${BODY}`, fill: t.ink2 } },
              { type: 'text', style: { x: x0 - 18, y: y - 9, text: r.name, textAlign: 'right', textVerticalAlign: 'middle', font: `650 17px ${DISPLAY}`, fill: t.ink } },
              { type: 'text', style: { x: x0 - 18, y: y + 12, text: `${S.int(r.n)} recorded`, textAlign: 'right', textVerticalAlign: 'middle', font: `500 12px ${MONO}`, fill: t.muted } },
            ] };
          },
        }],
      });
    });
  }

  /* 4.4 the same journey bars as 4.1, extended from the recorded median to the Kaplan-Meier median */
  function extended(node, rows) {
    S.chart(node, t => {
      const col = { uc: [t.uc, t.uc2], closed: [t.closed, t.closed2] };
      return Object.assign(S.base(t), {
        tooltip: { show: false },
        grid: { left: 150, right: 28, top: 34, bottom: 40 },
        xAxis: S.dayAxis(t, 150, { name: 'days from client start' }),
        yAxis: { type: 'category', data: rows.map(r => r.name), inverse: true, show: false },
        series: [{
          type: 'custom', encode: { x: [1, 2], y: 0 }, data: rows.map((r, i) => [i, r.obs, r.km]),
          renderItem: (p, api) => {
            const i = api.value(0), r = rows[i], c = col[r.k], h = 26;
            const [x0, y] = api.coord([0, i]), xo = api.coord([r.obs, i])[0], xk = api.coord([r.km, i])[0], xe = api.coord([150, i])[0];
            return { type: 'group', children: [
              { type: 'rect', shape: { x: x0, y: y - h / 2, width: xe - x0, height: h, r: h / 2 }, style: { fill: t.grid } },
              { type: 'rect', shape: { x: x0, y: y - h / 2, width: xk - x0, height: h, r: h / 2 }, style: { fill: c[1], stroke: c[0], lineWidth: 1.5, lineDash: [5, 4] } },
              { type: 'rect', shape: { x: x0, y: y - h / 2, width: xo - x0, height: h, r: h / 2 }, style: { fill: c[0] } },
              { type: 'text', style: { x: xo, y: y + h / 2 + 8, text: `recorded ${r.obs}`, textAlign: 'center', textVerticalAlign: 'top', font: `500 12.5px ${BODY}`, fill: t.ink2 } },
              { type: 'text', style: { x: xk, y: y - h / 2 - 6, text: String(r.km), textAlign: 'right', textVerticalAlign: 'bottom', font: `700 34px ${DISPLAY}`, fill: t.ink } },
              { type: 'text', style: { x: xk + 6, y: y - h / 2 - 10, text: 'days, all clients', textAlign: 'left', textVerticalAlign: 'bottom', font: `500 13px ${BODY}`, fill: t.ink2 } },
              { type: 'text', style: { x: x0 - 18, y, text: r.name, textAlign: 'right', textVerticalAlign: 'middle', font: `650 17px ${DISPLAY}`, fill: t.ink } },
            ] };
          },
        }],
      });
    });
  }

  /* 2.2 distribution of recorded days to Under Contract (the Explorer's 15-day bins) */
  function histogram(node, h) {
    const W = h.width, cap = h.cap;
    const bars = h.counts.map((n, i) => [i * W, i * W + W, n]).concat([[cap, cap + W, h.overflow]]);
    S.chart(node, t => {
      const ymax = Math.ceil(Math.max(...bars.map(b => b[2])) * 1.32 / 20) * 20, ytop = ymax * 0.84, ymid = ymax * 0.7;
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 16, top: 44, bottom: 36, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const b = p.data.value; return `<b>${b[0] >= cap ? cap + '+ days' : `${b[0]}–${b[1] - 1} days`}</b><br>${b[2]} clients · ${S.pct(b[2] / h.n)}`; } }),
        xAxis: S.dayAxis(t, cap + W, { interval: 30, name: 'days from client start to Under Contract', axisLabel: { color: t.label, fontSize: 12.5, formatter: v => (v >= cap ? cap + '+' : v) } }),
        yAxis: S.valAxis(t, { max: ymax }),
        series: [{
          type: 'custom', encode: { x: [0, 1], y: 2 },
          data: bars.map(b => ({ value: b, itemStyle: b[0] >= cap ? { color: t.hold2 } : b[0] === h.largest.from ? { color: t.uc } : b[0] < 60 ? { color: t.uc, opacity: 0.6 } : { color: t.uc2 } })),
          renderItem: (p, api) => {
            const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), 0]);
            const rect = { type: 'rect', shape: { x: a[0] + 2, y: a[1], width: Math.max(1, b[0] - a[0] - 4), height: b[1] - a[1], r: [5, 5, 0, 0] }, style: api.style() };
            if (api.value(0) !== h.largest.from) return rect;
            return { type: 'group', children: [rect, { type: 'text', style: { x: (a[0] + b[0]) / 2, y: a[1] - 8, text: String(api.value(2)), textAlign: 'center', textVerticalAlign: 'bottom', font: `700 16px ${DISPLAY}`, fill: t.ink } }] };
          },
          markArea: { silent: true, itemStyle: { color: t.uc, opacity: 0.07 }, label: { show: true, position: 'top', distance: 10, color: t.uc, fontWeight: 700, fontSize: 14, formatter: `${S.pct(h.within60.share)} within 60 days` }, data: [[{ xAxis: 0 }, { xAxis: 60 }]] },
          markLine: {
            symbol: 'none', silent: true,
            data: [
              [{ coord: [h.median, 0], lineStyle: { color: t.ink, width: 2, type: 'solid' }, label: { show: true, position: 'end', formatter: `median ${h.median}`, color: t.ink, fontWeight: 600, fontSize: 12.5 } }, { coord: [h.median, ytop] }],
              [{ coord: [h.mean, 0], lineStyle: { color: t.muted, width: 1.6, type: 'dashed' }, label: { show: true, position: 'end', formatter: `avg ${S.d1(h.mean)}`, color: t.muted, fontSize: 12.5 } }, { coord: [h.mean, ymid] }],
            ],
          },
        }],
      });
    });
  }

  /* 2.3 journeys still running: one dot per client, by days on the clock so far */
  function lane(node, l, colorKey, refText, showAxis) {
    const W = l.width, cap = l.cap;
    const pts = [];
    l.counts.forEach((c, i) => { for (let k = 0; k < c; k++) pts.push([i * W + W / 2, k + 0.5]); });
    for (let k = 0; k < l.overflow; k++) pts.push([cap + (k % 2 ? 7.5 : 2.5), Math.floor(k / 2) + 0.5]);
    const rows = Math.max(...l.counts, Math.ceil(l.overflow / 2), 1);
    S.chart(node, (t, el) => {
      const color = t[colorKey], top = 30, bottom = showAxis ? 36 : 10;
      const innerH = el.clientHeight - top - bottom, innerW = el.clientWidth - 56;
      const size = Math.max(5, Math.min(innerH / (rows + 0.6), (innerW / (cap + W)) * W) * 0.78);
      return Object.assign(S.base(t), {
        tooltip: { show: false },
        grid: { left: 40, right: 16, top, bottom },
        xAxis: S.dayAxis(t, cap + W, { interval: 30, name: showAxis ? 'days on the acquisition clock so far' : '', axisLabel: { show: showAxis, color: t.label, fontSize: 12.5, formatter: v => (v >= cap ? cap + '+' : v) } }),
        yAxis: { type: 'value', min: 0, max: rows + 0.6, show: false },
        series: [{
          type: 'scatter', data: pts, symbolSize: size, itemStyle: { color, opacity: 0.92 }, silent: true,
          markArea: { silent: true, itemStyle: { color, opacity: 0.07 }, data: [[{ xAxis: l.ref }, { xAxis: cap + W }]] },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: t.ink, width: 1.8, type: 'solid' }, label: { show: true, position: 'end', formatter: refText, color: t.ink, fontWeight: 600, fontSize: 12.5 }, data: [{ xAxis: l.ref }] },
        }],
      });
    });
  }

  /* 2.4 recorded-only curve vs Kaplan-Meier curve, with the median shift along the 50% line */
  function kmPanel(node, km, rec, obsMed, kmMed, colorKey) {
    S.chart(node, t => {
      const color = t[colorKey];
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 22, top: 18, bottom: 36, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { formatter: ps => `<b>Day ${ps[0].value[0]}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: ${S.pct(p.value[1])}`).join('<br>') }),
        xAxis: S.dayAxis(t, 200, { interval: 30, name: 'days from client start' }),
        yAxis: S.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, fontSize: 12, formatter: v => S.pct(v) } }),
        series: [
          { name: 'Recorded journeys only', type: 'line', step: 'end', showSymbol: false, data: rec.map((v, d) => [d, v]), lineStyle: { color, width: 2.2, type: 'dashed', opacity: 0.7 }, itemStyle: { color },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.muted, type: 'dotted', width: 1.2 }, label: { show: true, position: 'insideStartTop', formatter: 'half', color: t.muted, fontSize: 11.5 }, data: [{ yAxis: 0.5 }] } },
          { name: 'All signed-up clients', type: 'line', step: 'end', showSymbol: false, data: km.map((v, d) => [d, v]), lineStyle: { color, width: 3.5 }, itemStyle: { color },
            markLine: { symbol: ['none', 'arrow'], symbolSize: 11, silent: true, lineStyle: { color: t.ink2, width: 2, type: 'solid' }, label: { show: false }, data: [[{ coord: [obsMed + 3, 0.5] }, { coord: [kmMed - 5, 0.5] }]] },
            markPoint: { silent: true, symbol: 'circle', data: [
              { coord: [obsMed, 0.5], symbolSize: 14, itemStyle: { color: t.surface, borderColor: color, borderWidth: 3 }, label: { show: true, position: 'left', distance: 8, formatter: String(obsMed), color: t.ink2, fontWeight: 700, fontSize: 15 } },
              { coord: [kmMed, 0.5], symbolSize: 16, itemStyle: { color, borderColor: t.surface, borderWidth: 2 }, label: { show: true, position: 'bottom', distance: 10, formatter: String(kmMed), color: t.ink, fontWeight: 800, fontSize: 17 } },
            ] } },
        ],
      });
    });
  }

  S.chapter('speed', {
    n: 4, title: 'How long does acquisition actually take?',
    render(main, D, ch) {
      const sp = D.speed, ob = sp.observed, h = sp.hist, L = sp.lanes, est = sp.estimate;

      // 2.1
      let body = S.scene(main, { ch, step: 1, of: 4, label: 'What has happened', title: `Recorded journeys: ${ob.uc.median} days to Under Contract, ${ob.closed.median} to CLOSED` });
      body.innerHTML = `<div class="board"><div class="chart h-m" id="rulerChart" role="img" aria-label="Median ${ob.uc.median} and average ${S.d1(ob.uc.mean)} days to Under Contract; median ${ob.closed.median} and average ${S.d1(ob.closed.mean)} days to CLOSED."></div></div>
        <p class="cap">Clients with a recorded milestone · clock starts at the onboarding call.</p>`;
      ruler(S.$('#rulerChart', body), ob);

      // 2.2
      body = S.scene(main, { ch, step: 2, of: 4, label: 'Where the bulk falls', title: `Most recorded contracts land early, with the largest group at ${h.largest.from}–${h.largest.to} days` });
      body.innerHTML = `<div class="figs">
          <div class="fig"><span class="v num">${h.largest.from}–${h.largest.to}<small>days</small></span><span class="l"><i style="background:var(--uc)"></i>largest group · ${S.int(h.largest.n)} clients</span></div>
          <div class="fig"><span class="v num">${S.pct(h.within60.share)}</span><span class="l"><i style="background:var(--uc);opacity:.6"></i>of recorded contracts within 60 days</span></div>
        </div>
        <div class="board"><div class="chart h-l" id="histChart" role="img" aria-label="Distribution of days to Under Contract in 15-day bins; largest group ${h.largest.from}–${h.largest.to} days; ${S.pct(h.within60.share)} within 60 days; median ${h.median}."></div>
          <div class="legend"><span><i class="line" style="background:var(--ink)"></i>Median ${h.median}</span><span><i class="dash" style="color:var(--muted)"></i>Average ${S.d1(h.mean)}</span><span><i style="background:var(--uc-2)"></i>Longer tail</span></div></div>
        <p class="cap">${S.int(h.n)} recorded Under Contract milestones · 15-day bins.</p>`;
      histogram(S.$('#histChart', body), h);

      // 2.3
      body = S.scene(main, { ch, step: 3, of: 4, label: 'Who is still waiting', title: `${S.int(sp.running)} paid clients have not bought a property yet` });
      body.innerHTML = `<div class="board">
          <div class="lane"><div class="lane-head"><span class="v num">${S.int(L.searching.n)}</span><span class="t"><i style="background:var(--wait)"></i>Still searching</span><span class="s">${S.int(L.searching.past_ref)} have already waited longer than ${L.searching.ref} days</span></div>
            <div class="chart h-s" id="laneSearch" role="img" aria-label="${L.searching.n} clients still searching, by days so far."></div></div>
          <div class="lane"><div class="lane-head"><span class="v num">${S.int(L.under_contract.n)}</span><span class="t"><i style="background:var(--uc)"></i>Under contract, not yet closed</span><span class="s">${S.int(L.under_contract.past_ref)} already past ${L.under_contract.ref} days · recorded contracts close a median ${sp.uc_to_close.median} days after Under Contract</span></div>
            <div class="chart h-s" id="laneUC" role="img" aria-label="${L.under_contract.n} clients under contract, by days so far."></div></div>
        </div>
        <p class="cap">One dot per client · acquisitions still to come, and time the recorded medians cannot see.</p>`;
      lane(S.$('#laneSearch', body), L.searching, 'wait', `recorded median to Under Contract · ${L.searching.ref}`, false);
      lane(S.$('#laneUC', body), L.under_contract, 'uc', `recorded median to CLOSED · ${L.under_contract.ref}`, true);

      // 2.4
      body = S.scene(main, { ch, step: 4, of: 4, label: 'What it means for the timeline', title: `Counting everyone still waiting: ${est.uc.median} days to Under Contract, ${est.closed.median} to CLOSED` });
      body.innerHTML = `<div class="board" style="margin-bottom:16px"><div class="chart h-s" id="extChart" role="img" aria-label="Recorded medians ${ob.uc.median} and ${ob.closed.median} days extend to ${est.uc.median} and ${est.closed.median} days when unfinished journeys are counted."></div></div>
        <div class="duo">
          <div class="board"><div class="fig arrow"><span class="v num"><span class="from">${ob.uc.median}</span><span class="ar">→</span><span class="to">${est.uc.median}</span><small>days</small></span><span class="l"><i style="background:var(--uc)"></i>Under Contract</span></div>
            <div class="chart h-s2" id="kmUC" role="img" aria-label="Under Contract: recorded median ${ob.uc.median} days, Kaplan–Meier median ${est.uc.median} days."></div></div>
          <div class="board"><div class="fig arrow"><span class="v num"><span class="from">${ob.closed.median}</span><span class="ar">→</span><span class="to">${est.closed.median}</span><small>days</small></span><span class="l"><i style="background:var(--closed)"></i>CLOSED</span></div>
            <div class="chart h-s2" id="kmCL" role="img" aria-label="CLOSED: recorded median ${ob.closed.median} days, Kaplan–Meier median ${est.closed.median} days."></div></div>
        </div>
        <div class="legend" style="margin-top:12px"><span><i class="dash" style="color:var(--ink-2)"></i>Recorded journeys only</span><span><i class="line" style="background:var(--ink-2)"></i>All ${S.int(est.n)} signed-up clients, unfinished journeys included (Kaplan–Meier)</span></div>
        <p class="cap">Share of clients who have reached the milestone, by day · the median is where each curve crosses half.</p>`;
      extended(S.$('#extChart', body), [{ k: 'uc', name: 'Under Contract', obs: ob.uc.median, km: est.uc.median }, { k: 'closed', name: 'CLOSED', obs: ob.closed.median, km: est.closed.median }]);
      kmPanel(S.$('#kmUC', body), est.uc.curve, est.recorded_curve.uc, ob.uc.median, est.uc.median, 'uc');
      kmPanel(S.$('#kmCL', body), est.closed.curve, est.recorded_curve.closed, ob.closed.median, est.closed.median, 'closed');
    },
  });
})();
