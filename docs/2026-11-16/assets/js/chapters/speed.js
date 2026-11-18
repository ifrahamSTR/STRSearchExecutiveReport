/* Chapter 4: how long does it actually take? Four scenes on one shared day axis:
   recorded durations -> where the bulk falls -> if every hunting client went under contract tomorrow (all clients, up to vs
   above $250K, budget ranges) -> Kaplan-Meier. The old 'who is still waiting' lanes moved to chapter 2 (2.2-2.3), where they use
   the status-first counts that reconcile with the Cash Forecast (18 Nov 2026). */
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
        xAxis: S.dayAxis(t, 150, { name: 'days from client start date' }),
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
        xAxis: S.dayAxis(t, 150, { name: 'days from client start date' }),
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
        xAxis: S.dayAxis(t, cap + W, { interval: 30, name: 'days from client start date to Under Contract', axisLabel: { color: t.label, fontSize: 12.5, formatter: v => (v >= cap ? cap + '+' : v) } }),
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

  /* 2.4 recorded-only curve vs Kaplan-Meier curve, with the median shift along the 50% line */
  function kmPanel(node, km, rec, obsMed, kmMed, colorKey) {
    S.chart(node, t => {
      const color = t[colorKey];
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 22, top: 18, bottom: 36, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { formatter: ps => `<b>Day ${ps[0].value[0]}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: ${S.pct(p.value[1])}`).join('<br>') }),
        xAxis: S.dayAxis(t, 200, { interval: 30, name: 'days from client start date' }),
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

  /* 4.4 (added 18 Nov 2026) the "UC tomorrow" scenario next to the recorded durations and the Kaplan-Meier estimate,
     for all clients or by budget (upper amount of the onboarding-form range). Solid = recorded, striped = scenario,
     half-filled dot = Kaplan-Meier (inferred). Bars run to the median; the lighter extension and tick mark the average. */
  function scenarioChart(node, sc, st) {
    const stripes = (fg, bg) => {
      const r = Math.min(2, Math.ceil(window.devicePixelRatio || 1)), s = 6, c = document.createElement('canvas');
      c.width = c.height = s * r;
      const x = c.getContext('2d');
      x.scale(r, r); x.fillStyle = bg; x.fillRect(0, 0, s, s); x.strokeStyle = fg; x.lineWidth = 2.1; x.beginPath();
      [0, s, 2 * s].forEach(k => { x.moveTo(k - s - 2, s + 2); x.lineTo(k + 2, -2); });
      x.stroke();
      return { image: c, repeat: 'repeat', imageWidth: c.width, imageHeight: c.height };
    };
    return S.chart(node, (t, el) => {
      const all = st.mode === 'all', a = sc.all;
      const rows = all ? [
        { name: 'Recorded', sub: `${S.int(a.recorded.n)} contracts`, kind: 'rec', med: a.recorded.median, mean: a.recorded.mean },
        { name: 'UC tomorrow', sub: `${S.int(a.scenario.n)} searches`, kind: 'sce', med: a.scenario.median, mean: a.scenario.mean },
        { name: 'Kaplan–Meier', sub: `all ${S.int(a.clients)} searches`, kind: 'inf', med: a.km_median, mean: null },
      ] : (st.mode === 'cmp' ? sc.cmp : sc.budgets).flatMap(g => [
        { group: g.label, name: 'Recorded', sub: `${g.recorded.n}`, kind: 'rec', med: g.recorded.median, mean: g.recorded.mean },
        { group: '', name: 'UC tomorrow', sub: `${g.scenario.n}`, kind: 'sce', med: g.scenario.median, mean: g.scenario.mean, km: g.km_median, nm: g.label },
      ]);
      const MAX = all ? 120 : 120, h = all ? 28 : 15, L = all ? 190 : 250;
      const col = { rec: [t.uc, t.uc2], sce: [stripes(t.uc, t.uc2), t.uc2] };
      const F = (w, s, f) => `${w} ${s}px ${f === 'd' ? '"Bricolage Grotesque", Figtree, sans-serif' : 'Figtree, sans-serif'}`;
      return Object.assign(S.base(t), {
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => {
          const r = rows[p.value[0]];
          const g = r.group || r.nm;
          return `<b>${g ? g + ' · ' : ''}${r.name}</b><br>Median <b>${S.med(r.med)}</b> days${r.mean != null ? ` · average <b>${S.d1(r.mean)}</b>` : ' (no average: not every client has reached Under Contract)'}${r.km ? `<br>Kaplan–Meier median for this group: ${S.med(r.km)} days` : ''}`;
        } }),
        grid: { left: L, right: 40, top: all ? 34 : 18, bottom: 40 },
        xAxis: S.dayAxis(t, MAX, { name: 'days from client start date to Under Contract' }),
        yAxis: { type: 'category', data: rows.map((_, i) => i), inverse: true, show: false },
        series: [{
          type: 'custom', encode: { x: [1, 2], y: 0 }, data: rows.map((r, i) => [i, r.med, r.mean == null ? r.med : r.mean]),
          renderItem: (p, api) => {
            const i = api.value(0), r = rows[i], [x0, y] = api.coord([0, i]), xm = api.coord([Math.min(r.med, MAX), i])[0];
            const ch = [];
            if (r.kind === 'inf') {
              ch.push({ type: 'line', shape: { x1: x0, y1: y, x2: xm, y2: y }, style: { stroke: t.uc, lineWidth: 2, lineDash: [2, 4] } },
                { type: 'circle', shape: { cx: xm, cy: y, r: 9 }, style: { fill: t.surface, stroke: t.uc, lineWidth: 2.5 } },
                { type: 'sector', shape: { cx: xm, cy: y, r: 9, r0: 0, startAngle: Math.PI / 2, endAngle: Math.PI * 1.5 }, style: { fill: t.uc } },
                { type: 'text', style: { x: xm + 16, y, text: `${S.med(r.med)} days median · no average`, textVerticalAlign: 'middle', font: F(600, 13), fill: t.ink2 } });
            } else {
              const xa = api.coord([Math.min(r.mean, MAX), i])[0];
              ch.push({ type: 'rect', shape: { x: x0, y: y - h / 2, width: xa - x0, height: h, r: h / 2 }, style: { fill: col[r.kind][1], opacity: 0.55 } },
                { type: 'rect', shape: { x: x0, y: y - h / 2, width: xm - x0, height: h, r: h / 2 }, style: { fill: col[r.kind][0], stroke: r.kind === 'sce' ? t.uc : null, lineWidth: r.kind === 'sce' ? 1.4 : 0 } },
                { type: 'line', shape: { x1: xa, y1: y - h / 2 - 4, x2: xa, y2: y + h / 2 + 4 }, style: { stroke: t.ink2, lineWidth: 2 } });
              if (all) ch.push({ type: 'text', style: { x: xm, y: y - h / 2 - 7, text: S.med(r.med), textAlign: 'right', textVerticalAlign: 'bottom', font: F(700, 26, 'd'), fill: t.ink } },
                { type: 'text', style: { x: xm + 6, y: y - h / 2 - 10, text: 'days median', textVerticalAlign: 'bottom', font: F(500, 13), fill: t.ink2 } },
                { type: 'text', style: { x: xa + 8, y, text: `average ${S.d1(r.mean)}`, textVerticalAlign: 'middle', font: F(500, 13), fill: t.ink2 } });
              else ch.push({ type: 'text', style: { x: xa + 8, y, text: `${S.med(r.med)} · avg ${S.d1(r.mean)}`, textVerticalAlign: 'middle', font: F(600, 12.5), fill: t.ink2 } });
              if (r.km) {
                const xk = api.coord([Math.min(r.km, MAX), i])[0];
                ch.push({ type: 'circle', shape: { cx: xk, cy: y + h / 2 + 7, r: 5 }, style: { fill: t.surface, stroke: t.uc, lineWidth: 1.8 } },
                  { type: 'sector', shape: { cx: xk, cy: y + h / 2 + 7, r: 5, r0: 0, startAngle: Math.PI / 2, endAngle: Math.PI * 1.5 }, style: { fill: t.uc } });
              }
            }
            if (all) ch.push({ type: 'text', style: { x: x0 - 16, y: y - 8, text: r.name, textAlign: 'right', textVerticalAlign: 'middle', font: F(650, 16, 'd'), fill: t.ink } },
              { type: 'text', style: { x: x0 - 16, y: y + 11, text: `${r.kind === 'rec' ? 'Recorded' : r.kind === 'sce' ? 'Scenario' : 'Inferred'} · ${r.sub}`, textAlign: 'right', textVerticalAlign: 'middle', font: F(500, 12), fill: t.muted } });
            else {
              if (r.group) ch.push({ type: 'text', style: { x: 0 + 8, y: y + 12, text: r.group, textVerticalAlign: 'middle', font: F(650, 14.5, 'd'), fill: t.ink } });
              ch.push({ type: 'text', style: { x: x0 - 12, y, text: `${r.name} · ${r.sub}`, textAlign: 'right', textVerticalAlign: 'middle', font: F(500, 12), fill: t.muted } });
            }
            return { type: 'group', children: ch };
          },
        }],
      });
    });
  }

  function scenarioScene(main, D, ch) {
    const sp = D.speed, sc = sp.scenario, a = sc.all, BR = sc.budget_rule, st = { mode: 'all' };
    const BG = Object.fromEntries(D.budgets.groups.map(g => [g.label, g])), bLo = BG['Up to $250K'], bHi = BG['Above $250K'];
    const body = S.scene(main, { ch, step: 3, of: 4, label: 'If they all went under contract tomorrow',
      title: `If every hunting client went under contract tomorrow: average ${S.d1(a.scenario.mean)} days, median ${S.med(a.scenario.median)}` });
    const nr = sc.budgets.find(g => g.label === 'Not recorded');
    const why = Object.entries(sc.jira_hunting_not_confirmed_why).map(([k, v]) => `${v} ${k.toLowerCase() === 'lost' || k.toLowerCase() === 'open' || k.toLowerCase() === 'won' ? k + ' deal' + (v > 1 ? 's' : '') : k.toLowerCase()}`).join(', ');
    const lo = sc.left_out;
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num">${S.med(a.recorded.median)}<small>days</small></span><span class="l"><i style="background:var(--uc)"></i>median, recorded contracts · average ${S.d1(a.recorded.mean)} · ${S.int(a.recorded.n)} contracts ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.med(a.scenario.median)}<small>days</small></span><span class="l"><i class="hatch-uc" style="background:var(--uc)"></i>median if the ${S.int(a.hunting)} hunting searches went under contract tomorrow · average ${S.d1(a.scenario.mean)} · ${S.int(a.scenario.n)} searches ${S.ui.chip('sce')}</span></div>
        <div class="fig"><span class="v num">${S.med(a.km_median)}<small>days</small></span><span class="l"><i style="background:linear-gradient(90deg,var(--uc) 50%,var(--uc-2) 50%)"></i>Kaplan–Meier median, the statistical estimate for all ${S.int(a.clients)} searches (section 4.3) ${S.ui.chip('inf')}</span></div>
      </div>
      <div class="board" id="scnBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('mode', 'Group', [['all', 'All clients'], ['cmp', 'Up to vs above $250K'], ['budget', 'Budget ranges']], 'all')}<span class="vt-l only-budget" hidden>Budget = upper end of the onboarding-form range</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-scn" id="scnChart" role="img" aria-label="Days from client start to Under Contract. Recorded: median ${a.recorded.median}, average ${a.recorded.mean}. If every hunting client went under contract tomorrow: median ${a.scenario.median}, average ${a.scenario.mean}. Kaplan–Meier median ${a.km_median}. By budget: ${sc.budgets.map(g => `${g.label} recorded median ${g.recorded.median}, scenario median ${g.scenario.median}`).join('; ')}."></div>
          <div class="legend"><span><i style="background:var(--uc)"></i>Recorded, to the median</span><span><i class="hatch-uc"></i>UC tomorrow (scenario), to the median</span><span><i style="background:var(--uc-2)"></i>To the average (tick)</span><span><i class="ring" style="color:var(--uc);border-color:var(--uc);background:linear-gradient(90deg,var(--uc) 50%,transparent 50%) !important"></i>Kaplan–Meier median</span></div>
          <p class="bnote only-cmp">Up to $250K against above $250K: recorded median <b>${S.med(bLo.recorded.median)}</b> vs <b>${S.med(bHi.recorded.median)}</b> days to Under Contract (averages ${S.d1(bLo.recorded.mean)} and ${S.d1(bHi.recorded.mean)}), Kaplan–Meier ${S.med(bLo.km_uc)} vs ${S.med(bHi.km_uc)}, and contract to closing <b>${S.med(bLo.uc_to_close.median)}</b> vs <b>${S.med(bHi.uc_to_close.median)}</b> days: no measurable difference in speed (section 5.3). Not recorded = mostly clients who started before the form, an older and slower period.</p></div>
        <div class="pv-table tw" id="scnTable"></div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">The scenario</p><p>Each of the <b>${S.int(a.hunting)}</b> hunting searches counts as reaching Under Contract on ${S.date(new Date(new Date(D.meta.asof + 'T12:00:00').getTime() + 864e5).toISOString())}, the day after the snapshot: its days = that date − its client start date (median ${S.med(a.waits.median)}, average ${S.d1(a.waits.mean)}). They are pooled with the <b>${S.int(a.scenario.n - a.hunting)}</b> recorded durations of every other search, so each search counts once: the ${S.int(a.hunting_with_older_uc)} hunting searches that still carry an older Under Contract date count as waiting, not with that date.</p>
         <p>Searches = won deals with a confirmed Jira start, as elsewhere in this chapter. Jira lists ${S.int(sc.jira_hunting)} hunting clients; ${S.int(sc.jira_hunting_not_confirmed)} have no confirmed start on a won deal (${why}). Counting them too, from their Jira start: average ${S.d1(sc.all_hunting_sensitivity.mean)}, median ${S.med(sc.all_hunting_sensitivity.median)}. Not in either figure: searches with no recorded contract that are not hunting (${Object.entries(lo).map(([k, v]) => `${k} ${v}`).join(', ')}; Closed and Post-close here are closings without an Under Contract date). ${sc.negative_excluded} contract dated before its start is left out.</p>`,
        `<p class="ex-h">Budget</p><p>The upper amount of the onboarding-form range <b>"${BR.field}"</b> (column ${BR.column}), carried into Jira as the interim rule until Acquisitions cleans the Jira budget field. It measures ${BR.measures}. Matched to ${S.int(BR.since_form_matched)} of the ${S.int(BR.since_form)} confirmed starts since the form went live on ${S.date(BR.form_since)} (e-mail first, the form's deal id as a fallback), using the answer given before the contract. <b>Not recorded</b> (${S.int(nr.clients)}) is mostly clients who started before the form existed, so their times reflect older periods, not their budget. Jira's own budget field is filled for ${S.int(BR.jira_budget_filled)} of ${S.int(BR.signed)} signed-up clients and is not used.</p>
         <p class="ex-h">Three readings, three labels</p><p>${S.ui.chip('rec')} what has happened; ${S.ui.chip('sce')} an assumption that every hunting search ends tomorrow, so it is a floor for those searches; ${S.ui.chip('inf')} Kaplan–Meier, which lets unfinished searches progress as earlier ones did (section 4.3).</p>`,
      ])}
      <p class="cap">Days from client start date to the latest valid Under Contract date · confirmed starts · the scenario changes only the ${S.int(a.hunting)} hunting searches.</p>`;
    const board = S.$('#scnBoard', body), node = S.$('#scnChart', body), host = S.$('#scnTable', body);
    const rec = scenarioChart(node, sc, st);
    const table = () => {
      const row = (lab, rng, g) => ({ lab, rng, clients: g.clients, rn: g.recorded.n, ra: g.recorded.mean, rm: g.recorded.median, h: g.hunting, sn: g.scenario.n, sa: g.scenario.mean, sm: g.scenario.median, km: g.km_median });
      const rows = st.mode === 'all' ? [row('All clients', 'every confirmed start', a)] : st.mode === 'cmp' ? sc.cmp.map(g => row(g.label, g.label === 'Not recorded' ? 'no matched form answer' : g.label === 'Up to $250K' ? 'upper end of the form range ≤ $250K' : 'upper end above $250K', g)) : sc.budgets.map(g => row(g.label, g.range ? `form range ${g.range}` : 'no matched form answer', g));
      const d = v => (v == null ? '–' : S.d1(v)), m = v => (v == null ? 'not reached' : S.med(v));
      S.ui.table(host, [
        { k: 'lab', label: st.mode === 'all' ? 'Group' : 'Budget (upper amount)', html: r => `${r.lab}<small>${r.rng}</small>` },
        { k: 'clients', label: 'Searches', num: true, html: r => S.int(r.clients) },
        { k: 'rn', label: 'Contracts', num: true, html: r => S.int(r.rn) },
        { k: 'ra', label: 'Average', num: true, html: r => d(r.ra) },
        { k: 'rm', label: 'Median', num: true, html: r => m(r.rm) },
        { k: 'h', label: 'Hunting now', num: true, html: r => S.int(r.h) },
        { k: 'sn', label: 'Searches pooled', num: true, html: r => S.int(r.sn) },
        { k: 'sa', label: 'Average', num: true, html: r => d(r.sa) },
        { k: 'sm', label: 'Median', num: true, html: r => m(r.sm) },
        { k: 'km', label: 'Median', num: true, html: r => m(r.km) },
      ], rows, {
        caption: 'Days from client start to Under Contract: recorded, UC tomorrow scenario and Kaplan–Meier', sortable: st.mode !== 'all',
        head: `<tr class="sup"><th></th><th></th><th colspan="3">Recorded ${S.ui.chip('rec')}</th><th colspan="4">UC tomorrow ${S.ui.chip('sce')}</th><th>Kaplan–Meier ${S.ui.chip('inf')}</th></tr>`,
        total: st.mode === 'all' ? [Object.assign(row(`All ${S.int(sc.jira_hunting)} hunting Jira clients`, `adds the ${sc.jira_hunting_not_confirmed} without a confirmed start, measured from their Jira start`, a), { rn: a.recorded.n, h: a.hunting + sc.jira_hunting_not_confirmed, sn: sc.all_hunting_sensitivity.n, sa: sc.all_hunting_sensitivity.mean, sm: sc.all_hunting_sensitivity.median, km: null, clients: a.clients + sc.jira_hunting_not_confirmed })]
          : [row('All clients', 'every confirmed start', a)],
      });
    };
    table();
    S.ui.wire(board, (name, v) => {
      st[name] = v;
      node.classList.toggle('h-scn', v === 'all');
      node.classList.toggle('h-scc', v === 'cmp');
      node.classList.toggle('h-scb', v === 'budget');
      board.classList.toggle('m-cmp', v === 'cmp');
      board.querySelector('.only-budget').hidden = v === 'all';
      if (rec.inst) rec.inst.resize();
      rec.draw();
      table();
    });
  }

  S.chapter('speed', {
    n: 4, title: 'How long does acquisition actually take?',
    order: ['speed-1', 'speed-2', 'speed-4', 'speed-3'],       // displayed order; ids are stable keys (deep links)
    render(main, D, ch) {
      const sp = D.speed, ob = sp.observed, h = sp.hist, L = sp.lanes, est = sp.estimate;

      // 2.1
      let body = S.scene(main, { ch, step: 1, of: 4, label: 'What has happened', title: `Among searches with recorded milestones, the median is ${S.med(ob.uc.median)} days to Under Contract and ${S.med(ob.closed.median)} to CLOSED` });
      const ck = sp.clock, sc0 = sp.scenario.all, other = sc0.scenario.n - sc0.hunting;
      const guide = `<div class="tguide"><p class="tg-h">Five medians, three groups of searches <small>read each number with the group it counts</small></p>
        <div class="tw"><table class="dt tg"><caption class="visually-hidden">The timing medians and the searches each one counts</caption>
          <thead><tr><th scope="col">Measure</th><th scope="col" class="n">Under Contract</th><th scope="col" class="n">CLOSED</th><th scope="col">Searches counted</th></tr></thead><tbody>
          <tr class="tg-rec"><td><b>Recorded</b>${S.ui.chip('rec')}<small>searches that reached the milestone</small></td><td class="n"><b class="num">${S.med(ob.uc.median)}</b> days</td><td class="n"><b class="num">${S.med(ob.closed.median)}</b> days</td>
            <td>${S.int(ob.uc.n)} with a recorded contract, ${S.int(ob.closed.n)} with a recorded closing, out of ${S.int(est.n)} confirmed starts. Searches still waiting are left out, so these are the fastest journeys.</td></tr>
          <tr class="tg-inf"><td><b>Estimated, unfinished included</b>${S.ui.chip('inf')}<small>Kaplan–Meier, every confirmed start</small></td><td class="n"><b class="num">${S.med(est.uc.median)}</b> days</td><td class="n"><b class="num">${S.med(est.closed.median)}</b> days</td>
            <td>All ${S.int(est.n)} confirmed starts: ${S.int(est.n - est.events.uc)} without a contract and ${S.int(est.n - est.events.closed)} without a closing are counted as still waiting until the data date, then progress as earlier searches did.</td></tr>
          <tr class="tg-sce"><td><b>Scenario: every hunting search goes under contract tomorrow</b>${S.ui.chip('sce')}<small>not a forecast</small></td><td class="n"><b class="num">${S.med(sc0.scenario.median)}</b> days</td><td class="n">–</td>
            <td>The ${S.int(sc0.hunting)} eligible hunting searches, each counted at the days it will have waited tomorrow, pooled with ${S.int(other)} recorded contracts of other searches (${S.int(sc0.scenario.n)} in all). A floor for the hunting searches (section 4.4).</td></tr>
        </tbody></table></div></div>`;
      body.innerHTML = guide + `<div class="board">
          <div class="clock" aria-label="How the days are counted">
            <div class="clk"><i style="background:var(--uc)"></i><span><b>Days to Under Contract</b> = latest valid Under Contract date − <b>client start date</b></span></div>
            <div class="clk"><i style="background:var(--closed)"></i><span><b>Days to CLOSED</b> = closing date − <b>client start date</b> (closings up to the data date)</span></div>
            <p class="clk-def"><b>Client start date</b> = the reporting layer's client_start_date. For Jira issues created before 1 Jun 2026: the issue due date (a kickoff after the sale), or the created date + 4 days when none is set. From 1 Jun 2026: the Pipedrive won date. Of the ${S.int(ck.uc.n)} recorded contracts, ${S.int(ck.uc.due)} start on a due date, ${S.int(ck.uc['created+4'])} on created + 4 days and ${S.int(ck.uc.won)} on the won date. Clients: the ${S.int(ck.population.n)} won engagements with a confirmed Jira start; ${S.int(ck.fallback_excluded)} Pipedrive-fallback starts are not confirmed and are left out.</p>
          </div>
          <div class="chart h-m" id="rulerChart" role="img" aria-label="Median ${S.med(ob.uc.median)} and average ${S.d1(ob.uc.mean)} days from client start date to Under Contract; median ${ob.closed.median} and average ${S.d1(ob.closed.mean)} days to CLOSED."></div></div>
        <p class="cap">Confirmed starts with a recorded milestone · ${S.int(ck.scheduled_closings)} closings dated after the data date are scheduled, not counted.</p>`;
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

      // 4.3 (id speed-4): the estimate that counts unfinished searches
      body = S.scene(main, { ch, step: 4, of: 4, label: 'What it means for the timeline', title: `Counting everyone still waiting: ${est.uc.median} days to Under Contract, ${est.closed.median} to CLOSED` });
      body.innerHTML = `<div class="board" style="margin-bottom:16px"><div class="chart h-s" id="extChart" role="img" aria-label="Recorded medians ${ob.uc.median} and ${ob.closed.median} days extend to ${est.uc.median} and ${est.closed.median} days when unfinished journeys are counted."></div></div>
        <div class="duo">
          <div class="board"><div class="fig arrow"><span class="v num"><span class="from">${ob.uc.median}</span><span class="ar">→</span><span class="to">${est.uc.median}</span><small>days</small></span><span class="l"><i style="background:var(--uc)"></i>Under Contract</span></div>
            <div class="chart h-s2" id="kmUC" role="img" aria-label="Under Contract: recorded median ${ob.uc.median} days, Kaplan–Meier median ${est.uc.median} days."></div></div>
          <div class="board"><div class="fig arrow"><span class="v num"><span class="from">${ob.closed.median}</span><span class="ar">→</span><span class="to">${est.closed.median}</span><small>days</small></span><span class="l"><i style="background:var(--closed)"></i>CLOSED</span></div>
            <div class="chart h-s2" id="kmCL" role="img" aria-label="CLOSED: recorded median ${ob.closed.median} days, Kaplan–Meier median ${est.closed.median} days."></div></div>
        </div>
        <div class="legend" style="margin-top:12px"><span><i class="dash" style="color:var(--ink-2)"></i>Recorded journeys only</span><span><i class="line" style="background:var(--ink-2)"></i>All ${S.int(est.n)} signed-up clients, unfinished journeys included (Kaplan–Meier)</span></div>
        <p class="cap">Share of the ${S.int(est.n)} confirmed starts who have reached the milestone, by day · clients still hunting, paused or refunded count until the data date · Under Contract is the latest valid contract · the median is where each curve crosses half.</p>`;
      extended(S.$('#extChart', body), [{ k: 'uc', name: 'Under Contract', obs: ob.uc.median, km: est.uc.median }, { k: 'closed', name: 'CLOSED', obs: ob.closed.median, km: est.closed.median }]);
      kmPanel(S.$('#kmUC', body), est.uc.curve, est.recorded_curve.uc, ob.uc.median, est.uc.median, 'uc');
      kmPanel(S.$('#kmCL', body), est.closed.curve, est.recorded_curve.closed, ob.closed.median, est.closed.median, 'closed');

      // 4.4 (id speed-3, added 18 Nov 2026): the stated scenario, after the estimate it is compared with
      scenarioScene(main, D, ch);
    },
  });
})();
