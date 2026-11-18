/* Chapter 5: what distinguishes fast and slow clients?
   5.1 who moves quickly (the four speed groups) -> 5.2 capital: no threshold -> 5.3 up to vs above $250K, like for like
   (L10 update) -> 5.4 offer experience -> 5.5 deals seen before committing -> 5.6 what STRSearch might take from it.
   Speed groups share one blue ramp (strong = within 30 days, pale = 75+ days); still searching is hatched amber. */
(function () {
  'use strict';
  const S = window.S;
  const DISPLAY = '"Bricolage Grotesque", Figtree, sans-serif', BODY = 'Figtree, sans-serif';
  const KEY = {
    fast: 'Under contract within 30 days', middle: 'Under contract in 31–74 days',
    slow: 'Under contract in 75+ days', searching: 'Still hunting, no contract yet',
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
  // 16 Nov: time to Under Contract by stated capital, every confirmed start included (unfinished journeys censored)
  function capitalKM(node, cp) {
    const bands = cp.bands.filter(x => x.curve), days = bands[0].curve.map((_, i) => i * 5);
    S.chart(node, t => {
      const cols = [t.sp3, t.sp2, t.sp1], narrow = node.offsetWidth < 560;
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 18, top: 18, bottom: 34, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } },
          formatter: ps => `<b>Day ${ps[0].axisValue}</b><br>` + ps.map(p => `${p.marker}${bands[p.seriesIndex].label}: <b>${S.pct(p.value)}</b> under contract`).join('<br>') }),
        xAxis: { type: 'category', data: days, boundaryGap: false, name: 'days from client start date', nameLocation: 'middle', nameGap: 26,
          nameTextStyle: { color: t.label, fontFamily: BODY }, axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
          axisLabel: { color: t.label, fontFamily: BODY, interval: 5 } },
        yAxis: { type: 'value', min: 0, max: 1, splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.label, fontFamily: BODY, formatter: v => Math.round(v * 100) + '%' } },
        series: bands.map((x, i) => ({ type: 'line', step: 'end', data: x.curve, symbol: 'none', lineStyle: { color: cols[i], width: 3 }, emphasis: { disabled: true } })),
      });
    });
  }

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

  /* 5.3 (L10 update, 18 Nov 2026) up to vs above $250K, like for like: Mantel-Haenszel differences with 95% intervals for
     contracts, closings and refunds within each window (the Explorer's #budget reference, same figures) */
  const FAM = [['uc', 'Under contract', 'uc', [14, 30, 45, 60, 90]], ['closed', 'Closed', 'cl', [60, 90, 120]], ['refunded', 'Refunded', 'rf', [14, 30, 60, 90]]];
  const pts = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}`;
  function forestRows(B) {
    const G = Object.fromEntries(B.groups.map(g => [g.label, g])), lo = G['Up to $250K'], hi = G['Above $250K'];
    return FAM.flatMap(([fk, fl, gk, ws]) => ws.map((w, i) => {
      const m = B.mh[fk].find(x => x.w === w), a = lo[`${gk}${w}`], b = hi[`${gk}${w}`];
      return { fam: fk, label: i === 0 ? `${fl} within ${w} days` : `${w} days`, first: i === 0, w, m, a, b, clear: m.lo > 0 || m.hi < 0 };
    }));
  }
  function forest(node, B) {
    const rows = forestRows(B);
    return S.chart(node, t => {
      const ext = Math.max(...rows.map(r => Math.max(Math.abs(r.m.lo), Math.abs(r.m.hi)))) * 100;
      const X = Math.ceil(ext / 5) * 5;
      const famCol = { uc: t.uc, closed: t.closed, refunded: t.refund };
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 230, top: 34, bottom: 40, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const r = rows[p.dataIndex];
          return `<b>${FAM.find(f => f[0] === r.fam)[1]} within ${r.w} days</b><br>Up to $250K: ${r.a.k} of ${r.a.eligible} (${S.pct(r.a.k / r.a.eligible, 1)})<br>Above $250K: ${r.b.k} of ${r.b.eligible} (${S.pct(r.b.k / r.b.eligible, 1)})<br>Like for like: <b>${pts(r.m.diff)} pts</b> (95% ${pts(r.m.lo)} to ${pts(r.m.hi)}), ${r.m.strata} strata`; } }),
        xAxis: { type: 'value', min: -X, max: X, interval: 5, name: 'percentage points, up to $250K minus above $250K (same start month, client experience and start rule)', nameLocation: 'middle', nameGap: 26,
          nameTextStyle: { color: t.muted, fontSize: 12 }, axisLabel: { color: t.label, fontSize: 12, formatter: v => (v === 0 ? '0 = no difference' : (v > 0 ? '+' : '') + v) }, splitLine: { lineStyle: { color: t.grid } }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'category', data: rows.map(r => r.label), inverse: true, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: t.ink, fontSize: 13, formatter: (v, i) => (rows[i].first ? `{f|${v}}` : v), rich: { f: { fontWeight: 700, color: t.ink, fontSize: 13.5 } } } },
        series: [{
          type: 'custom', encode: { x: [1, 2, 3], y: 0 }, data: rows.map((r, i) => [i, r.m.lo * 100, r.m.diff * 100, r.m.hi * 100]),
          renderItem: (p, api) => {
            const i = api.value(0), r = rows[i], y = api.coord([0, i])[1], xl = api.coord([api.value(1), i])[0], xd = api.coord([api.value(2), i])[0], xh = api.coord([api.value(3), i])[0];
            const c = famCol[r.fam], cs = p.coordSys;
            return { type: 'group', children: [
              { type: 'line', shape: { x1: xl, y1: y, x2: xh, y2: y }, style: { stroke: c, lineWidth: r.clear ? 3 : 2, opacity: r.clear ? 1 : 0.55 } },
              { type: 'line', shape: { x1: xl, y1: y - 5, x2: xl, y2: y + 5 }, style: { stroke: c, lineWidth: 2, opacity: r.clear ? 1 : 0.55 } },
              { type: 'line', shape: { x1: xh, y1: y - 5, x2: xh, y2: y + 5 }, style: { stroke: c, lineWidth: 2, opacity: r.clear ? 1 : 0.55 } },
              { type: 'circle', shape: { cx: xd, cy: y, r: r.clear ? 7 : 6 }, style: { fill: r.clear ? c : t.surface, stroke: c, lineWidth: 2.4 } },
              { type: 'text', style: { x: cs.x + cs.width + 16, y, text: `${S.pct(r.a.k / r.a.eligible, 1)} vs ${S.pct(r.b.k / r.b.eligible, 1)}`, textVerticalAlign: 'middle', font: `${r.clear ? 700 : 500} 13px Figtree, sans-serif`, fill: r.clear ? t.ink : t.ink2 } },
              { type: 'text', style: { x: cs.x + cs.width + 130, y, text: `${pts(r.m.diff)} pts`, textVerticalAlign: 'middle', font: `${r.clear ? 700 : 500} 13px Figtree, sans-serif`, fill: r.clear ? t.ink : t.muted } },
            ] };
          },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: t.ink2, width: 1.5, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] },
        }],
        graphic: [{ type: 'text', right: 116, top: 8, style: { text: 'up to · above', fill: t.muted, font: '600 11.5px Figtree, sans-serif' } },
          { type: 'text', right: 40, top: 8, style: { text: 'like for like', fill: t.muted, font: '600 11.5px Figtree, sans-serif' } }],
      });
    });
  }

  function budgetScene(main, D, ch, of) {
    const B = D.budgets, rows = forestRows(B), G = Object.fromEntries(B.groups.map(g => [g.label, g])), lo = G['Up to $250K'], hi = G['Above $250K'];
    const P = Object.fromEntries(B.profile.map(p => [p.label, p])), pl = P['Up to $250K'], ph = P['Above $250K'];
    const u14 = rows.find(r => r.fam === 'uc' && r.w === 14), r30 = rows.find(r => r.fam === 'refunded' && r.w === 30), clear = rows.filter(r => r.clear);
    const E = Object.fromEntries(B.experience.map(x => [`${x.experience}|${x.group}`, x])), sh = x => S.pct(x.k / x.eligible, 1);
    const k = v => '$' + Math.round(v / 1e3) + 'K';
    const body = S.scene(main, { ch, step: 3, of, label: 'Lower vs higher budget',
      title: `Up to $250K clients go under contract and close as fast as those above; the clear gap is early refunds` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num">${pts(u14.m.diff)}<small>pts</small></span><span class="l"><i style="background:var(--uc)"></i>under contract within 14 days, like for like: ${sh(u14.a)} vs ${sh(u14.b)} (95% ${pts(u14.m.lo)} to ${pts(u14.m.hi)}); none of the ${rows.filter(r => r.fam !== 'refunded').length} contract and closing windows differs ${S.ui.chip('inf')}</span></div>
        <div class="fig"><span class="v num">${pts(r30.m.diff)}<small>pts</small></span><span class="l"><i style="background:var(--refund)"></i>refunded within 30 days: ${sh(r30.a)} vs ${sh(r30.b)} (95% ${pts(r30.m.lo)} to ${pts(r30.m.hi)}), mostly among New Client Experience clients</span></div>
        <div class="fig"><span class="v num">${k(pl.price.median)}<span class="of">vs ${k(ph.price.median)}</span></span><span class="l"><i style="background:var(--closed)"></i>median purchase price: the stated budget tracks what clients buy, so the split is meaningful</span></div>
      </div>
      <div class="board" id="fstBoard">
        <div class="ptools"><div class="pl"><span class="vt-l">${S.int(lo.n)} up to $250K · ${S.int(hi.n)} above · mostly May–October 2026 starts</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-forest" id="fstChart" role="img" aria-label="Up to $250K minus above $250K, like for like, in percentage points with 95% intervals: ${rows.map(r => `${FAM.find(f => f[0] === r.fam)[1]} within ${r.w} days ${pts(r.m.diff)} (${pts(r.m.lo)} to ${pts(r.m.hi)})`).join('; ')}."></div>
          <div class="legend"><span><i class="dot" style="background:var(--refund)"></i>Filled: the 95% interval excludes zero (${clear.length} of ${rows.length})</span><span><i class="hollow" style="border-color:var(--ink-2)"></i>Hollow: no measurable difference</span><span>Right: observed shares, up to vs above</span></div></div>
        <div class="pv-table tw" id="fstTable"></div>
        <div class="links">${S.ui.xl('#budget', 'Explorer: budget performance (same figures, every window)')}${S.ui.xl('#cohorts?preset=0', 'Explorer: build your own budget cohort')}${S.ui.go('pace-4', 'First 14 days by start month (3.4)')}</div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">The comparison</p><p>Confirmed starts with a matched onboarding budget, read at the upper end of the all-in capital range: up to $250K (${S.int(lo.n)}) against above $250K (${S.int(hi.n)}). Each window counts only clients who have had it in full. <b>Like for like</b> = a Mantel–Haenszel risk difference within strata of the same start month, client experience and start-date rule, with a 95% interval, so differences in timing or mix between the groups cancel out. The Explorer's #budget view uses the same code and shows the same figures.</p>
         <p class="ex-h">How sure</p><p>${rows.length} differences are tested; ${clear.length} clear zero at 95% (${clear.map(r => `refunds within ${r.w} days`).join(', ')}). By chance alone about ${S.d1(rows.length * 0.05)} would, and the refund intervals only just clear zero: treat early refunds as a signal to watch, not a proven effect. Associations, not causes.</p>`,
        `<p class="ex-h">Where the refund gap sits</p><p>Within 30 days, New Client Experience: up to $250K ${E['New Client Experience|Up to $250K'].rf30.k} of ${E['New Client Experience|Up to $250K'].rf30.eligible} (${sh(E['New Client Experience|Up to $250K'].rf30)}) vs above ${E['New Client Experience|Above $250K'].rf30.k} of ${E['New Client Experience|Above $250K'].rf30.eligible} (${sh(E['New Client Experience|Above $250K'].rf30)}); Legacy: ${E['Legacy|Up to $250K'].rf30.k} of ${E['Legacy|Up to $250K'].rf30.eligible} vs ${E['Legacy|Above $250K'].rf30.k} of ${E['Legacy|Above $250K'].rf30.eligible}.</p>
         <p class="ex-h">What else differs</p><p>The groups buy the same package (Complete ${S.pct(pl.complete_share)} vs ${S.pct(ph.complete_share)}), pay the same way (Split Pay ${S.pct(pl.split_share)} vs ${S.pct(ph.split_share)}) and a similar fee (median ${k(pl.fee.median)} vs ${k(ph.fee.median)}), so the fee is a larger share of a smaller budget. Fewer have made offers before (3+ offers ${S.pct(pl.offers['3+ offers before'] / pl.n)} vs ${S.pct(ph.offers['3+ offers before'] / ph.n)}). Once under contract both close: ${pl.uc_close90.k} of ${pl.uc_close90.eligible} and ${ph.uc_close90.k} of ${ph.uc_close90.eligible} within 90 days of the contract. Median purchase price ${k(pl.price.median)} vs ${k(ph.price.median)}; recorded out-of-pocket ${k(pl.oop.median)} vs ${k(ph.oop.median)}.</p>`,
      ])}
      <p class="cap">Up to $250K minus above $250K, in percentage points · dot = like-for-like difference, whiskers = 95% interval · contracts (blue), closings (green), refunds (orange) · right: the observed shares.</p>`;
    forest(S.$('#fstChart', body), B);
    S.ui.table(S.$('#fstTable', body), [
      { k: 'label', label: 'Outcome', html: r => `${FAM.find(f => f[0] === r.fam)[1]} within ${r.w} days` },
      { k: 'a', label: 'Up to $250K', num: true, sv: r => r.a.k / r.a.eligible, html: r => `${sh(r.a)}<small>${r.a.k} of ${r.a.eligible}</small>` },
      { k: 'b', label: 'Above $250K', num: true, sv: r => r.b.k / r.b.eligible, html: r => `${sh(r.b)}<small>${r.b.k} of ${r.b.eligible}</small>` },
      { k: 'd', label: 'Like for like', num: true, sv: r => r.m.diff, html: r => `${pts(r.m.diff)} pts<small>95% ${pts(r.m.lo)} to ${pts(r.m.hi)} · ${r.m.strata} strata</small>` },
      { k: 'v', label: 'Reading', html: r => (r.clear ? '<b>Clear of zero</b>' : 'No measurable difference') + (r.m.thin ? '<small>thin: fewer than ' + B.thin + ' eligible in a group</small>' : '') },
    ], rows, { caption: 'Up to $250K vs above $250K, like for like' });
    S.ui.wire(S.$('#fstBoard', body));
  }

  S.chapter('drivers', {
    n: 5, title: 'What distinguishes fast and slow clients?',
    render(main, D, ch) {
      const dr = D.drivers, comp = Object.fromEntries(dr.composition.groups.map(x => [x.key, x])), n = dr.composition.n;
      const off = Object.fromEntries(dr.offers.rows.map(r => [r.key, r])), dl = dr.deals.groups, b = dr.bases;
      const OF = 6;

      let body = S.scene(main, { ch, step: 1, of: OF, label: 'Who moves quickly',
        title: `${S.pct(comp.fast.n / n)} of clients are under contract within 30 days; ${S.pct((comp.slow.n + comp.searching.n) / n)} have none before day 75` });
      body.innerHTML = `<div class="board">${mixBoard(dr)}</div>
        <p class="cap">All ${S.int(n)} confirmed starts with at least 75 days on the clock (started by ${S.date(dr.eligible_through)}), so every client had time to be slow · days to the latest valid Under Contract date · still hunting = no contract yet · ${S.int(dr.composition.stopped_no_contract)} more are paused, refunded or have no contract date and are not shown.</p>`;

      const cp = dr.capital.pipedrive, cf = dr.capital.form, cx = cp.cox || {}, cfx = cf.cox || {};
      const pc100 = v => (v >= 1 ? '+' : '−') + Math.abs(Math.round((v - 1) * 100)) + '%';
      body = S.scene(main, { ch, step: 2, of: OF, label: 'Capital', title: 'Capital doesn’t separate fast from slow clients, even counting those still waiting' });
      body.innerHTML = `<div class="board"><div class="chart h-m" id="capChart" role="img" aria-label="Share of clients under contract by day since start, by stated capital: ${cp.bands.map(x => `${x.label} (${x.n} clients, half under contract by day ${x.km_median == null ? 'not yet' : x.km_median})`).join('; ')}. The curves overlap."></div>
          <div class="legend">${cp.bands.map((x, i) => `<span><i class="line" style="background:var(${['--sp-slow', '--sp-mid', '--sp-fast'][i]})"></i>${x.label} · ${S.int(x.n)} clients</span>`).join('')}</div></div>
        <p class="cap">${S.int(cp.n)} confirmed starts with a stated capital (Pipedrive, recorded before the search), including ${S.int(cp.n - cp.events)} still without a contract · log-rank p = ${cp.logrank.p} · each extra $100K changes the contract rate by ${pc100(cx.lo)} to ${pc100(cx.hi)} (95% interval) · the questionnaire’s all-in capital agrees (${S.int(cf.n)} clients, p = ${cf.logrank.p}) · the data can rule out large effects, not every small one.</p>`;
      capitalKM(S.$('#capChart', body), cp);

      budgetScene(main, D, ch, OF);

      body = S.scene(main, { ch, step: 4, of: OF, label: 'Offer experience',
        title: `First-time offer-makers rarely sign within a month: ${S.pct(off['0'].within30.share)}, against ${S.pct(off['3+'].within30.share)} with 3+ offers` });
      body.innerHTML = `<div class="board"><div class="chart h-s2" id="offChart" role="img" aria-label="Under contract within 30 days: ${dr.offers.rows.map(r => `${r.label} ${S.pct(r.within30.share)}`).join(', ')}. Before day 75 every group is near ${S.pct(b.d75.share)}."></div>
          <div class="legend"><span><i class="dot" style="background:var(--sp-fast)"></i>under contract within 30 days</span><span><i class="hollow"></i>under contract before day 75</span></div></div>
        <p class="cap">Source: onboarding questionnaire (Form Responses 2, column AA), the client’s own count of real-estate offers submitted before STRSearch, not offers made during the search · ${S.int(b.d30.matched)} matched clients with 30+ days on the clock (matched by e-mail or deal id) · ahead in the first month, level by day 75: a lead worth testing, not a proven driver.</p>`;
      offers(S.$('#offChart', body), dr.offers, b.d75.share);

      const dc = dr.deals.coverage;
      body = S.scene(main, { ch, step: 5, of: OF, label: 'Deals sent',
        title: `Deals sent can’t yet test early momentum: the count only grows with a longer search` });
      body.innerHTML = `<div class="board"><div class="chart h-d" id="dealChart" role="img" aria-label="Median deals sent before going under contract: within 30 days ${dl.fast.median}, 31 to 74 days ${dl.middle.median}, 75 days or more ${dl.slow.median}."></div>
          <div class="legend"><span><i style="background:var(--sp-mid)"></i>one deal · deals seen by the median client</span><span><i style="border:1.6px solid var(--sp-mid);background:none"></i>up to the top of the middle half</span></div></div>
        <p class="cap">Jira total_deals_sent for clients who reached a contract: ${dl.fast.median} for contracts within 30 days, ${dl.slow.median} for 75+ days · it is a cumulative total with no dates, filled for ${S.pct(dc.with_uc)} of clients with a contract but only ${S.int(dc.hunting_with_count)} of ${S.int(dc.hunting_n)} hunting clients · so properties sent in the first 14 days, and whether a slow early trickle dampens momentum, cannot be measured yet.</p>`;
      deals(S.$('#dealChart', body), dr.deals);

      const BGd = Object.fromEntries(D.budgets.groups.map(g => [g.label, g])), r30d = D.budgets.mh.refunded.find(x => x.w === 30);
      body = S.scene(main, { ch, step: 6, of: OF, label: 'What we might learn', title: 'What STRSearch might take from this' });
      body.innerHTML = `<div class="board"><ol class="learn four">
          <li><b>Capital isn’t a speed signal.</b><span>Counting clients still waiting, stated capital shows no measurable link to time to contract; any effect of an extra $100K is small (${pc100(cx.lo)} to ${pc100(cx.hi)}).</span></li>
          <li><b>Offer readiness may be.</b><span>Clients with no prior offers rarely sign in the first month, then catch up by day 75. Early offer preparation is worth testing.</span></li>
          <li><b>Budget isn’t a speed signal either; early refunds are.</b><span>Clients up to $250K contract and close at the same pace as those above, but refund more often in their first month (${S.pct(BGd['Up to $250K'].rf30.k / BGd['Up to $250K'].rf30.eligible)} vs ${S.pct(BGd['Above $250K'].rf30.k / BGd['Above $250K'].rf30.eligible)}). Their first two weeks deserve a closer look, not a different search.</span></li>
          <li><b>Early deal flow needs its own record.</b><span>To test whether a slow trickle of properties in the first two weeks dampens momentum, log the date of every property sent.</span></li>
        </ol></div>
        <p class="cap">Associations, not proven causes · confirmed starts from the 16 Nov reporting layer · onboarding answers cover ${S.int(dr.matching.cohort_matched)} of ${S.int(dr.matching.cohort_n)} clients.</p>`;
    },
  });
})();
