/* Chapter 5: what distinguishes fast and slow clients?
   5.1 who moves quickly (the four speed groups) -> 5.2 capital: no threshold -> 5.3 offer experience ->
   5.4 deals seen before committing -> 5.5 what STRSearch might take from it.
   Speed groups share one blue ramp (strong = within 30 days, pale = 75+ days); still searching is hatched amber. */
(function () {
  'use strict';
  const S = window.S;
  const DISPLAY = '"Bricolage Grotesque", Figtree, sans-serif', BODY = 'Figtree, sans-serif';
  const KEY = {
    fast: 'Under contract within 30 days', middle: 'Under contract in 31–74 days',
    slow: 'Under contract in 75+ days', searching: 'Still searching, no contract yet',
  };
  const ROW = { fast: 'Within 30 days', middle: 'In 31–74 days', slow: 'In 75+ days' };
  const ramp = t => ({ fast: t.sp1, middle: t.sp2, slow: t.sp3 });
  const muted = s => `<span style="opacity:.62">${s}</span>`;

  /* 5.1 one bar for every client with 75+ days on the clock, keyed below */
  function mixBoard(dr) {
    const c = dr.composition, n = c.n, g = Object.fromEntries(c.groups.map(x => [x.key, x]));
    const reached = (g.fast.n + g.middle.n) / n;
    const sub = {
      fast: `${S.int(g.fast.n)} clients · median ${g.fast.median_days} days`,
      middle: `${S.int(g.middle.n)} clients · median ${g.middle.median_days} days`,
      slow: `${S.int(g.slow.n)} clients · median ${g.slow.median_days} days`,
      searching: `${S.int(g.searching.n)} clients · ${Math.round(g.searching.median_elapsed)} days in, median`,
    };
    const aria = c.groups.map(x => `${KEY[x.key]}: ${S.pct(x.n / n)}`).join('; ');
    return `<div class="mix" role="img" aria-label="${S.int(n)} clients with 75 or more days on the clock. ${aria}.">
        <div class="mix-brace" style="left:${(reached * 100).toFixed(2)}%;width:${((1 - reached) * 100).toFixed(2)}%"><span>no contract before day 75 · ${S.pct(1 - reached)}</span></div>
        <div class="mix-bar">${c.groups.map(x => `<i class="sp-${x.key}" style="flex:${x.n} 1 0"></i>`).join('')}</div>
      </div>
      <div class="mix-keys">${c.groups.map(x => `<div class="mk ${x.key}"><span class="mk-v">${S.pct(x.n / n)}</span><span class="mk-t">${KEY[x.key]}</span><span class="mk-s">${sub[x.key]}</span></div>`).join('')}</div>`;
  }

  /* 5.2 share under contract, at or above each capital cut-off (solid) vs below it (dashed) */
  function capital(node, cap) {
    const rows = cap.rows, cats = rows.map(r => `$${r.t}K+`);
    S.chart(node, t => {
      const c30 = t.sp1, c75 = t.ink2, narrow = node.offsetWidth < 560;
      const named = { color: t.ink, fontFamily: BODY, fontSize: 13, fontWeight: 600 };
      const line = (data, color, dashed, label) => ({
        type: 'line', data, symbol: dashed ? 'none' : 'circle', symbolSize: 9, z: dashed ? 2 : 3,
        lineStyle: { color, width: dashed ? 2 : 3, type: dashed ? [6, 5] : 'solid' },
        itemStyle: { color, borderColor: t.surface, borderWidth: 2 }, emphasis: { disabled: true },
        // line names: at the end on wide screens, above the first point on narrow ones
        endLabel: label && !narrow ? Object.assign({ show: true, formatter: label, distance: 12 }, named) : { show: false },
        label: label && narrow ? Object.assign({ show: true, position: 'top', distance: 10, align: 'left', formatter: q => (q.dataIndex === 0 ? label : '') }, named) : { show: false },
      });
      const tip = i => {
        const r = rows[i];
        return `<b>${cats[i]}</b> ${muted('vs below')}<br>`
          + `<span style="color:${c30}">●</span> within 30 days: <b>${S.pct(r.d30.at.share)}</b> vs ${S.pct(r.d30.below.share)} ${muted(`(${r.d30.at.n} / ${r.d30.below.n} clients)`)}<br>`
          + `<span style="color:${c75}">●</span> before day 75: <b>${S.pct(r.d75.at.share)}</b> vs ${S.pct(r.d75.below.share)} ${muted(`(${r.d75.at.n} / ${r.d75.below.n})`)}<br>`
          + `median days to contract: ${r.median_days.at} vs ${r.median_days.below}`;
      };
      return Object.assign(S.base(t), {
        grid: { left: 6, right: narrow ? 14 : 118, top: 16, bottom: 40, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } }, formatter: ps => tip(ps[0].dataIndex) }),
        xAxis: { type: 'category', data: narrow ? rows.map(r => String(r.t)) : cats, boundaryGap: false, axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
          axisLabel: { color: t.ink2, fontSize: narrow ? 12 : 13, fontWeight: 600, margin: 12, interval: 0 },
          name: narrow ? 'capital cut-off, $K and above' : 'all-in capital cut-off (top of each answer range)', nameLocation: 'middle', nameGap: 32, nameTextStyle: { color: t.muted, fontSize: 12.5 } },
        yAxis: S.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, fontSize: 12, formatter: v => S.pct(v) } }),
        series: [
          line(rows.map(r => r.d75.at.share), c75, false, 'before day 75'),
          line(rows.map(r => r.d75.below.share), c75, true),
          line(rows.map(r => r.d30.at.share), c30, false, 'within 30 days'),
          line(rows.map(r => r.d30.below.share), c30, true),
        ],
      });
    });
  }

  /* 5.3 by offer experience: share under contract within 30 days (filled) and before day 75 (open ring) */
  function offers(node, of, level75) {
    const rows = of.rows;
    S.chart(node, t => {
      /* a bracket beside the open rings: every group ends up at about the same level by day 75 */
      const bracket = api => {
        const pts = rows.map((r, j) => api.coord([r.within75.share, j]));
        const x = Math.max(...pts.map(q => q[0])) + 30, y1 = pts[0][1], y2 = pts[pts.length - 1][1];
        return [
          { type: 'polyline', shape: { points: [[x - 6, y1], [x, y1], [x, y2], [x - 6, y2]] }, style: { stroke: t.muted, lineWidth: 1.4, fill: 'none' } },
          { type: 'text', style: { x: x + 12, y: (y1 + y2) / 2 - 10, text: 'level by day 75', textVerticalAlign: 'middle', font: `650 14px ${BODY}`, fill: t.ink } },
          { type: 'text', style: { x: x + 12, y: (y1 + y2) / 2 + 10, text: `≈ ${S.pct(level75)} for every group`, textVerticalAlign: 'middle', font: `500 12.5px ${BODY}`, fill: t.muted } },
        ];
      };
      return Object.assign(S.base(t), {
      grid: { left: 8, right: 34, top: 40, bottom: 30, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, {
        trigger: 'item',
        formatter: p => {
          const r = rows[p.data[0]];
          return `<b>${r.label}</b><br>within 30 days: <b>${S.pct(r.within30.share)}</b> ${muted(`of ${r.within30.n} clients with 30+ days`)}<br>`
            + `before day 75: <b>${S.pct(r.within75.share)}</b> ${muted(`of ${r.within75.n} with 75+ days`)}<br>median days to contract: ${r.median_days}`;
        },
      }),
      xAxis: S.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, fontSize: 12, formatter: v => S.pct(v) } }),
      yAxis: { type: 'category', data: rows.map(r => r.label), inverse: true, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: t.ink, fontSize: 14.5, fontWeight: 600, margin: 16 } },
      series: [{
        type: 'custom', encode: { x: [1, 2], y: 0 },
        data: rows.map((r, i) => [i, r.within30.share, r.within75.share]),
        renderItem: (p, api) => {
          const i = api.value(0), a = api.coord([api.value(1), i]), b = api.coord([api.value(2), i]);
          return { type: 'group', children: [
            { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: t.grid, lineWidth: 10, lineCap: 'round' } },
            { type: 'circle', shape: { cx: b[0], cy: b[1], r: 8.5 }, style: { fill: t.surface, stroke: t.ink2, lineWidth: 3 } },
            { type: 'circle', shape: { cx: a[0], cy: a[1], r: 11 }, style: { fill: t.sp1, stroke: t.surface, lineWidth: 2 } },
            { type: 'text', style: { x: a[0], y: a[1] - 17, text: S.pct(api.value(1)), textAlign: 'center', textVerticalAlign: 'bottom', font: `700 22px ${DISPLAY}`, fill: t.ink } },
            { type: 'text', style: { x: b[0], y: b[1] - 15, text: S.pct(api.value(2)), textAlign: 'center', textVerticalAlign: 'bottom', font: `600 14px ${BODY}`, fill: t.ink2 } },
          ].concat(i === rows.length - 1 && p.coordSys.width > 560 ? bracket(api) : []) };
        },
      }],
    });
    });
  }

  /* 5.4 deals seen before committing: one tile per deal (solid to the median, outlined to the upper quartile) */
  function deals(node, dl) {
    const keys = ['fast', 'middle', 'slow'], g = dl.groups;
    const most = Math.max(...keys.map(k => Math.round(g[k].p75)));
    S.chart(node, t => Object.assign(S.base(t), {
      tooltip: Object.assign(S.base(t).tooltip, {
        trigger: 'item',
        formatter: p => {
          const k = keys[p.data[0]], d = g[k];
          return `<b>${KEY[k]}</b><br>median <b>${d.median}</b> deals before committing<br>${muted(`middle half ${d.p25}–${d.p75} · ${d.n} clients · median ${d.median_days} days to contract`)}`;
        },
      }),
      grid: { left: 0, right: 0, top: 6, bottom: 6 },
      xAxis: { type: 'value', min: 0, max: 1, show: false },
      yAxis: { type: 'category', data: keys, inverse: true, show: false },
      series: [{
        type: 'custom', encode: { y: 0 }, data: keys.map((k, i) => [i]),
        renderItem: (p, api) => {
          const cs = p.coordSys, i = api.value(0), k = keys[i], d = g[k], col = ramp(t)[k];
          const narrow = cs.width < 600, y = api.coord([0, i])[1];
          const numW = narrow ? 54 : 84, labW = narrow ? 0 : 196;
          const x0 = cs.x + labW, step = (cs.width - labW - numW) / most, size = Math.min(17, step * 0.76);
          const ty = narrow ? y + 2 : y - 8;
          const med = Math.round(d.median), lo = Math.round(d.p25), hi = Math.round(d.p75);
          const kids = [];
          for (let j = 0; j < hi; j++) {
            kids.push({ type: 'rect', shape: { x: x0 + j * step, y: ty - size / 2, width: size, height: size, r: 3 },
              style: j < med ? { fill: col } : { fill: t.surface, stroke: col, lineWidth: 1.6 } });
            kids[kids.length - 1].shape.r = Math.min(3, size * 0.2);
          }
          const bx1 = x0 + (lo - 1) * step, bx2 = x0 + (hi - 1) * step + size, by = ty + size / 2 + 7;
          kids.push(
            { type: 'polyline', shape: { points: [[bx1, by - 4], [bx1, by], [bx2, by], [bx2, by - 4]] }, style: { stroke: t.muted, lineWidth: 1.2, fill: 'none' } },
            { type: 'text', style: { x: bx1, y: by + 4, text: `middle half ${lo}–${hi}`, textVerticalAlign: 'top', font: `500 11.5px ${BODY}`, fill: t.muted } },
            { type: 'text', style: { x: cs.x + cs.width, y: ty, text: String(d.median), textAlign: 'right', textVerticalAlign: 'middle', font: `700 ${narrow ? 28 : 36}px ${DISPLAY}`, fill: t.ink } },
          );
          if (narrow) {
            kids.push({ type: 'text', style: { x: cs.x, y: ty - size / 2 - 8, text: `${ROW[k]} · median ${d.median_days} days to contract`, textVerticalAlign: 'bottom', font: `600 13px ${BODY}`, fill: t.ink } });
          } else {
            kids.push(
              { type: 'text', style: { x: cs.x, y: ty - 9, text: ROW[k], textVerticalAlign: 'middle', font: `650 16px ${DISPLAY}`, fill: t.ink } },
              { type: 'text', style: { x: cs.x, y: ty + 12, text: `median ${d.median_days} days to contract`, textVerticalAlign: 'middle', font: `500 12.5px ${BODY}`, fill: t.muted } },
            );
          }
          return { type: 'group', children: kids };
        },
      }],
    }));
  }

  S.chapter('drivers', {
    n: 5, title: 'What distinguishes fast and slow clients?',
    render(main, D, ch) {
      const dr = D.drivers, comp = Object.fromEntries(dr.composition.groups.map(x => [x.key, x])), n = dr.composition.n;
      const off = Object.fromEntries(dr.offers.rows.map(r => [r.key, r])), dl = dr.deals.groups, b = dr.bases;
      const OF = 5;

      let body = S.scene(main, { ch, step: 1, of: OF, label: 'Who moves quickly',
        title: `${S.pct(comp.fast.n / n)} of clients are under contract within 30 days; ${S.pct((comp.slow.n + comp.searching.n) / n)} have none before day 75` });
      body.innerHTML = `<div class="board">${mixBoard(dr)}</div>
        <p class="cap">All ${S.int(n)} clients with at least 75 days on the clock (started by ${S.date(dr.eligible_through)}), so every client had time to be slow. Still searching = no contract yet, kept apart from completed slow purchases.</p>`;

      body = S.scene(main, { ch, step: 2, of: OF, label: 'Capital', title: 'More capital doesn’t mean a faster contract' });
      body.innerHTML = `<div class="board"><div class="chart h-m" id="capChart" role="img" aria-label="Share of clients under contract within 30 days and before day 75, at or above versus below each capital cut-off from $250K to $500K. The lines stay level and the at-or-above and below lines overlap at every cut-off."></div>
          <div class="legend"><span><i class="line" style="background:var(--ink-2)"></i>clients at or above the cut-off</span><span><i class="dash" style="color:var(--ink-2)"></i>clients below it</span></div></div>
        <p class="cap">Onboarding answers (form since ${S.date(dr.form_from)}): ${S.int(b.d30.matched)} clients with 30+ days on the clock, ${S.int(b.d75.matched)} with 75+ · capital = all-in out-of-pocket, at the top of each answer range ($200K+ would include everyone) · liquidity, budget flexibility, location and property preferences show no clear difference either.</p>`;
      capital(S.$('#capChart', body), dr.capital);

      body = S.scene(main, { ch, step: 3, of: OF, label: 'Offer experience',
        title: `First-time offer-makers rarely sign within a month: ${S.pct(off['0'].within30.share)}, against ${S.pct(off['3+'].within30.share)} with 3+ offers` });
      body.innerHTML = `<div class="board"><div class="chart h-s2" id="offChart" role="img" aria-label="Under contract within 30 days: ${dr.offers.rows.map(r => `${r.label} ${S.pct(r.within30.share)}`).join(', ')}. Before day 75 every group is near ${S.pct(b.d75.share)}."></div>
          <div class="legend"><span><i class="dot" style="background:var(--sp-fast)"></i>under contract within 30 days</span><span><i class="hollow"></i>under contract before day 75</span></div></div>
        <p class="cap">Real-estate offers submitted before joining (onboarding question) · the gap holds in each start month since May and after allowing for capital and the other answers, but with seven answers tested it is a lead worth watching, not a proven driver.</p>`;
      offers(S.$('#offChart', body), dr.offers, b.d75.share);

      body = S.scene(main, { ch, step: 4, of: OF, label: 'Deals seen',
        title: `Slow clients see more deals before committing: ${dl.slow.median}, against ${dl.fast.median}` });
      body.innerHTML = `<div class="board"><div class="chart h-d" id="dealChart" role="img" aria-label="Median deals sent before going under contract: within 30 days ${dl.fast.median}, 31 to 74 days ${dl.middle.median}, 75 days or more ${dl.slow.median}."></div>
          <div class="legend"><span><i style="background:var(--sp-mid)"></i>one deal · deals seen by the median client</span><span><i style="border:1.6px solid var(--sp-mid);background:none"></i>up to the top of the middle half</span></div></div>
        <p class="cap">Jira “Total Deals Sent” for clients who reached a contract; the count stops at Under Contract, so it approximates deals seen before committing · slow clients also received them more slowly, and without a dated record of each deal that pace can’t be separated from the length of the search.</p>`;
      deals(S.$('#dealChart', body), dr.deals);

      body = S.scene(main, { ch, step: 5, of: OF, label: 'What we might learn', title: 'What STRSearch might take from this' });
      body.innerHTML = `<div class="board"><ol class="learn">
          <li><b>Capital isn’t a speed signal.</b><span>Budget size, liquidity and flexibility don’t separate fast from slow clients, at any cut-off from $250K to $500K.</span></li>
          <li><b>Offer readiness may be.</b><span>First-time offer-makers rarely sign in the first month, then catch up by day 75. Early offer preparation is worth testing.</span></li>
          <li><b>Slow searches see more deals, not fewer.</b><span>${dl.slow.median} before committing, against ${dl.fast.median}. Whether a faster flow of deals would shorten them needs a dated record of each deal sent.</span></li>
        </ol></div>
        <p class="cap">Associations, not proven causes, from about ${Math.floor(b.d75.matched / 100) * 100}–${Math.ceil(b.d30.matched / 100) * 100} recent clients. Worth re-checking as more onboarding answers mature.</p>`;
    },
  });
})();
