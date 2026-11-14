/* Chapter 5: what distinguishes fast and slow clients? Onboarding profile by speed group, then deals seen. */
(function () {
  'use strict';
  const S = window.S;
  const STYLE = {
    fast: t => ({ color: t.uc, symbol: 'circle', size: 15 }),
    middle: t => ({ color: t.hold2, symbol: 'circle', size: 11 }),
    slow: t => ({ color: t.ink2, symbol: 'diamond', size: 17 }),
    searching: t => ({ color: t.wait, symbol: 'emptyCircle', size: 13 }),
  };
  const SHORT = { fast: 'Fast · ≤30 days', middle: 'Middle · 31–74', slow: 'Slow · ≥75 days', searching: 'Still searching' };

  function profile(node, dr) {
    const rows = dr.rows, keys = dr.groups.map(g => g.key);
    S.chart(node, t => Object.assign(S.base(t), {
      grid: { left: 8, right: 30, top: 10, bottom: 34, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, {
        trigger: 'item',
        formatter: p => { const r = rows[p.data.value[1]]; return `<b>${r.label}</b><br>` + keys.map(k => `${SHORT[k]}: ${r.shares[k] == null ? 'too few' : S.pct(r.shares[k])} <span style="opacity:.6">(n ${r.n[k]})</span>`).join('<br>'); },
      }),
      xAxis: S.valAxis(t, { min: 0, max: 1, interval: 0.25, splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.label, fontSize: 12, formatter: v => S.pct(v) } }),
      yAxis: { type: 'category', data: rows.map(r => r.label), inverse: true, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: t.ink, fontSize: 13.5, fontWeight: 600, width: 230, overflow: 'break', lineHeight: 17 } },
      series: [
        { type: 'custom', silent: true, z: 1, encode: { x: [1, 2], y: 0 },
          data: rows.map((r, i) => [i, r.shares.fast, r.shares.slow]).filter(d => d[1] != null && d[2] != null),
          renderItem: (p, api) => { const a = api.coord([api.value(1), api.value(0)]), b = api.coord([api.value(2), api.value(0)]);
            return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: t.line, lineWidth: 6, lineCap: 'round' } }; } },
      ].concat(keys.map(k => {
        const st = STYLE[k](t);
        return { name: SHORT[k], type: 'scatter', z: k === 'fast' || k === 'slow' ? 4 : 3, symbol: st.symbol, symbolSize: st.size,
          itemStyle: { color: st.color, borderColor: k === 'searching' ? st.color : t.surface, borderWidth: k === 'searching' ? 2.5 : 1.5 },
          data: rows.map((r, i) => r.shares[k] == null ? null : { value: [r.shares[k], i] }).filter(Boolean) };
      })),
    }));
  }

  function deals(node, dr) {
    const keys = dr.groups.map(g => g.key).filter(k => dr.deals[k]);
    S.chart(node, t => Object.assign(S.base(t), {
      grid: { left: 8, right: 40, top: 10, bottom: 34, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const k = keys[p.data[0]], d = dr.deals[k]; return `<b>${SHORT[k]}</b><br>median ${d.median} deals · middle half ${d.p25}–${d.p75}<br><span style="opacity:.6">${d.n} clients</span>`; } }),
      xAxis: S.valAxis(t, { min: 0, name: 'deals sent to the client', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 12.5 } }),
      yAxis: { type: 'category', data: keys.map(k => SHORT[k]), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink, fontSize: 13.5, fontWeight: 600 } },
      series: [{
        type: 'custom', encode: { x: [1, 2, 3], y: 0 },
        data: keys.map((k, i) => [i, dr.deals[k].p25, dr.deals[k].median, dr.deals[k].p75]),
        renderItem: (p, api) => {
          const k = keys[api.value(0)], st = STYLE[k](t), hollow = k === 'searching';
          const [x1, y] = api.coord([api.value(1), api.value(0)]), xm = api.coord([api.value(2), api.value(0)])[0], x2 = api.coord([api.value(3), api.value(0)])[0];
          return { type: 'group', children: [
            { type: 'rect', shape: { x: x1, y: y - 7, width: Math.max(2, x2 - x1), height: 14, r: 7 }, style: { fill: st.color, opacity: hollow ? 0.18 : 0.25 } },
            { type: 'circle', shape: { cx: xm, cy: y, r: 9 }, style: { fill: hollow ? t.surface : st.color, stroke: hollow ? st.color : t.surface, lineWidth: hollow ? 2.5 : 2 } },
            { type: 'text', style: { x: x2 + 10, y, text: String(api.value(2)), textVerticalAlign: 'middle', font: '700 16px "Bricolage Grotesque", sans-serif', fill: t.ink } },
          ] };
        },
      }],
    }));
  }

  S.chapter('drivers', {
    n: 5, title: 'What distinguishes fast and slow clients?',
    render(main, D, ch) {
      const dr = D.drivers, g = Object.fromEntries(dr.groups.map(x => [x.key, x]));
      const matched = dr.groups.reduce((a, x) => a + x.matched, 0), eligible = dr.groups.reduce((a, x) => a + x.eligible, 0);
      const maxP = Math.min(...dr.rows.map(r => r.p_fast_slow));
      const legend = keys => keys.map(k => {
        const sym = { fast: '<i class="dot" style="background:var(--uc)"></i>', middle: '<i class="dot" style="background:var(--hold-2)"></i>', slow: '<i class="diamond"></i>', searching: '<i class="ring" style="color:var(--wait)"></i>' }[k];
        return `<span>${sym}${SHORT[k]} <span class="muted">· ${k === 'searching' ? 'unfinished' : 'reached contract'}</span></span>`;
      }).join('');

      let body = S.scene(main, { ch, step: 1, of: 2, label: 'At onboarding', title: 'Fast and slow clients look alike at onboarding' });
      body.innerHTML = `<div class="board"><div class="chart h-m" id="profileChart" role="img" aria-label="Share of fast, middle, slow and still-searching clients with each onboarding answer; fast and slow clients are similar on all four."></div>
          <div class="legend">${legend(['fast', 'middle', 'slow', 'searching'])}</div></div>
        <p class="cap">${S.int(matched)} of ${S.int(eligible)} clients with 75+ days on the clock matched an onboarding answer (form since ${S.date(dr.form_from)}) · no fast-vs-slow gap is statistically clear (all p ≥ ${maxP.toFixed(2)}).</p>`;
      profile(S.$('#profileChart', body), dr);

      const f = dr.deals.fast, s = dr.deals.slow;
      body = S.scene(main, { ch, step: 2, of: 2, label: 'Deals seen', title: `Slow clients are sent far more deals: ${s.median} vs ${f.median}` });
      body.innerHTML = `<div class="board"><div class="chart h-m" id="dealsChart" role="img" aria-label="Median deals sent: fast ${f.median}, slow ${s.median}."></div>
          <div class="legend"><span><i class="dot" style="background:var(--ink-2)"></i>median</span><span><i style="background:var(--ink-2);opacity:.25;width:22px;border-radius:7px"></i>middle half of clients</span></div></div>
        <p class="cap">Jira "Total Deals Sent" · longer searches accumulate more deals, so this describes the search rather than explains it.</p>`;
      deals(S.$('#dealsChart', body), dr);
    },
  });
})();
