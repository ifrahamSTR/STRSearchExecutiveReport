/* Chapter 5: what distinguishes fast and slow clients?
   5.1 who moves quickly (the four speed groups) -> 5.2 capital: no threshold -> 5.3 up to vs above $250K: how fast ->
   5.4 up to vs above $250K: refunds and pauses -> 5.5 offer experience -> 5.6 deals sent -> 5.7 what STRSearch might take from it.
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
      fast: `${S.int(g.fast.n)} of ${S.int(n)} searches · median ${g.fast.median_days} days`,
      middle: `${S.int(g.middle.n)} of ${S.int(n)} searches · median ${g.middle.median_days} days`,
      slow: `${S.int(g.slow.n)} of ${S.int(n)} searches · median ${g.slow.median_days} days`,
      searching: `${S.int(g.searching.n)} of ${S.int(n)} searches · ${Math.round(g.searching.median_elapsed)} days in, median`,
    };
    const aria = c.groups.map(x => `${KEY[x.key]}: ${S.pct(x.n / n)}`).join('; ');
    return `<div class="mix" role="img" aria-label="${S.int(n)} searches that either reached a contract or are still hunting, with 75 or more days on the clock. ${aria}.">
        <div class="mix-brace" style="left:${(reached * 100).toFixed(2)}%;width:${((1 - reached) * 100).toFixed(2)}%"><span>no contract before day 75 · ${S.pct(1 - reached)}</span></div>
        <div class="mix-bar">${c.groups.map(x => `<i class="sp-${x.key}" style="flex:${x.n} 1 0"></i>`).join('')}</div>
      </div>
      <div class="mix-keys">${c.groups.map(x => `<div class="mk ${x.key}"><span class="mk-v">${S.pct(x.n / n)}<small class="mk-of">of ${S.int(n)}</small></span><span class="mk-t">${KEY[x.key]}</span><span class="mk-s">${sub[x.key]}</span></div>`).join('')}</div>`;
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

  /* 5.5 prior offers, day 14 and day 30 on the SAME clients (every matched start with 30+ days of follow-up): grouped bars, base under each group */
  const pp1 = v => (v == null ? '–' : (v * 100).toFixed(1) + '%');
  function offersChart(node, rows) {
    S.chart(node, t => Object.assign(S.base(t), {
      grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } }, formatter: ps => {
        const r = rows[ps[0].dataIndex];
        return `<b>${r.label}</b> ${muted(`${r.n} searches with 30+ days of follow-up`)}<br>Under contract by day 14: <b>${pp1(r.share14)}</b> ${muted(r.small14 ? 'fewer than 5 searches' : `${r.k14} of ${r.n}`)}<br>By day 30: <b>${pp1(r.share30)}</b> ${muted(`${r.k30} of ${r.n}`)}`;
      } }),
      xAxis: { type: 'category', data: rows.map(r => `${r.label}\n{n|${r.n} searches}`), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
        axisLabel: { color: t.ink, fontSize: 14, fontWeight: 600, lineHeight: 20, interval: 0, rich: { n: { color: t.muted, fontSize: 12, fontWeight: 500, lineHeight: 18 } } } },
      yAxis: S.valAxis(t, { min: 0, max: 0.4, interval: 0.1, axisLabel: { color: t.label, fontSize: 12, formatter: v => S.pct(v) } }),
      series: [['By day 14', 'share14', t.sp2, 'small14'], ['By day 30', 'share30', t.sp1, 'small30']].map(([name, k, c, sm]) => ({
        name, type: 'bar', barGap: '10%', barCategoryGap: '34%', barMaxWidth: 70, data: rows.map(r => ({ value: r[k], itemStyle: { color: c, borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: 'top', distance: 4, color: t.ink, fontWeight: 700, fontSize: 14, formatter: p => pp1(p.value) + (rows[p.dataIndex][sm] ? '*' : '') },
      })),
    }));
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

  /* 5.3-5.4 (18 Nov 2026) up to vs above $250K. The groups come from the all-in onboarding budget (upper end of the form range);
     every figure is the Explorer's #budget calculation (pipeline/chapters/budgets.py runs its code).
       5.3 speed   under contract and closed within N days (the first 14 days first), then the curves that include clients still searching
       5.4 exits   refunds, timed pauses and the two together, overall and by client experience, with the like-for-like check in plain English
     Rates always show the count behind them and who had the full window ("eligible"); the like-for-like column says whether a gap is clear. */
  const LO = 'Up to $250K', HI = 'Above $250K', NAMES = [LO, HI], COLS = ['var(--b-lo)', 'var(--b-hi)'];
  const sg = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}`;
  const p1 = x => (x && x.eligible ? S.pct(x.k / x.eligible, 1) : '–');
  const cellN = x => ({ k: x.k, n: x.eligible });
  const kK = v => '$' + Math.round(v / 1e3) + 'K';
  const FAMILY = { uc: 'Under Contract', closed: 'Closed', rf: 'Refunded', pa: 'Paused', ex: 'Refunded or paused' };
  /* rows for one family: key = field prefix in sets (uc, cl, rf, pa, ex), mhKey = key in the like-for-like block */
  const rowsOf = (E, exp, key, mhKey, ws, tail, subFn) => ws.map(w => {
    const all = { uc: E.windows.uc, cl: E.windows.closed, rf: E.windows.early, pa: E.windows.early, ex: E.windows.early }[mhKey], i = all.indexOf(w);
    const A = E.sets[exp][LO][key + w], H = E.sets[exp][HI][key + w];
    return { w, label: `Within ${w} days`, hl: w === 14, tag: w === 14 ? 'First 14 days' : '', sub: subFn ? subFn(A, H, w) : `eligible: ${A.eligible} · ${H.eligible}`, a: cellN(A), b: cellN(H), m: E.mh[exp][mhKey][i] };
  });

  function curves(node, B, fam, title) {
    const E = B.early, C = E.curves[fam], day14 = fam === 'uc';
    return S.chart(node, t => {
      const col = { [LO]: t.blo, [HI]: t.bhi };
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 16, top: 22, bottom: 36, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { formatter: ps => `<b>Day ${ps[0].value[0]}</b><br>` + ps.map(q => `${q.marker}${q.seriesName}: <b>${S.pct(q.value[1], 1)}</b> ${fam === 'uc' ? 'under contract' : 'closed'}`).join('<br>') }),
        xAxis: S.dayAxis(t, E.curves.days, { interval: 30, name: `days from client start date to ${title}`, nameGap: 28 }),
        yAxis: S.valAxis(t, { min: 0, max: 1, interval: 0.25, axisLabel: { color: t.label, fontSize: 12, formatter: v => S.pct(v) } }),
        series: [LO, HI].map((g, i) => ({ name: g, type: 'line', step: 'end', showSymbol: false, data: C[g].curve.map((v, d) => [d, v]), lineStyle: { color: col[g], width: 3.2 }, itemStyle: { color: col[g] },
          markLine: i === 0 && day14 ? { symbol: 'none', silent: true, lineStyle: { color: t.ink2, type: 'dashed', width: 1.5 }, label: { show: true, position: 'insideEndTop', formatter: 'day 14', color: t.ink2, fontSize: 12, fontWeight: 650 }, data: [{ xAxis: 14 }] } : undefined,
          markPoint: { silent: true, symbol: 'circle', symbolSize: 11, itemStyle: { color: col[g], borderColor: t.surface, borderWidth: 2 }, data: C[g].half != null ? [{ coord: [C[g].half, 0.5], label: { show: true, position: i ? 'bottom' : 'left', distance: 8, formatter: `${g.replace('Up to ', 'up to ').replace('Above ', 'above ')}: half by day ${C[g].half}`, color: t.ink, fontSize: 11.5, fontWeight: 650, backgroundColor: t.surface, padding: [2, 5], borderRadius: 4 } }] : [] } })),
      });
    });
  }

  /* 5.3 how quickly each group reaches Under Contract and closes */
  function speedScene(main, D, ch, of) {
    const B = D.budgets, E = B.early, G = Object.fromEntries(B.groups.map(g => [g.label, g])), lo = G[LO], hi = G[HI], P = Object.fromEntries(B.profile.map(x => [x.label, x]));
    const sa = E.sets.all[LO], sb = E.sets.all[HI], st = { view: 'win' };
    const ucRows = rowsOf(E, 'all', 'uc', 'uc', E.windows.uc), clRows = rowsOf(E, 'all', 'cl', 'cl', E.windows.closed);
    const u14 = ucRows[0], clearAny = [...E.mh.all.uc, ...E.mh.all.cl].some(m => m.lo > 0 || m.hi < 0);
    const body = S.scene(main, { ch, step: 3, of, label: 'Budget: how fast',
      title: `Clients up to $250K reach Under Contract and close at a similar pace to clients above: ${p1(sa.uc14)} against ${p1(sb.uc14)} in the first 14 days` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num"><span class="from">${p1(sa.uc14)}</span><span class="ar2">vs</span>${p1(sb.uc14)}</span><span class="l"><i style="background:linear-gradient(90deg,var(--b-lo) 50%,var(--b-hi) 50%)"></i>under contract within 14 days: ${sa.uc14.k} of ${sa.uc14.eligible} up to $250K, ${sb.uc14.k} of ${sb.uc14.eligible} above. Like for like ${sg(u14.m.diff)} pts (95% ${sg(u14.m.lo)} to ${sg(u14.m.hi)}): similar ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.med(lo.recorded.median)}</span><span class="ar2">vs</span>${S.med(hi.recorded.median)}<small>days</small></span><span class="l"><i style="background:var(--uc)"></i>median days to Under Contract among clients who got there (${lo.recorded.n} and ${hi.recorded.n}); counting clients still searching, half are under contract by day ${E.curves.uc[LO].half} vs ${E.curves.uc[HI].half}</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.med(lo.uc_to_close.median)}</span><span class="ar2">vs</span>${S.med(hi.uc_to_close.median)}<small>days</small></span><span class="l"><i style="background:var(--closed)"></i>median from Under Contract to closing (${lo.uc_to_close.n} and ${hi.uc_to_close.n} closings)</span></div>
      </div>
      <div class="board" id="spdBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('view', 'View', [['win', 'By window'], ['curve', 'Over time']], 'win', 'only-chart')}${S.ui.key(NAMES, COLS)}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart">
          <div id="spdWin" class="pp-grid">
            <div><div class="pp-h"><span class="pp-q">Question 1</span><b>How quickly do clients go under contract?</b><span>Share of each group under contract within N days of the start. Only clients who have had the full N days count (<i>eligible</i>, shown under each window: up to $250K · above).</span></div>
              ${S.ui.pairs(ucRows, { names: NAMES, cols: COLS, max: 0.8, head: ['Window', 'Share under contract', 'Like for like'], aria: 'Under Contract within N days, up to vs above $250K' })}</div>
            <div><div class="pp-h"><span class="pp-q">Question 2</span><b>How quickly do they close?</b><span>Share of each group with a closing within N days of the start (a later milestone, so fewer clients have had the full window).</span></div>
              ${S.ui.pairs(clRows, { names: NAMES, cols: COLS, max: 0.8, head: ['Window', 'Share closed', 'Like for like'], aria: 'Closed within N days, up to vs above $250K' })}</div>
          </div>
          <div id="spdCurve" hidden>
            <div class="pp-grid"><div><div class="pp-h"><span class="pp-q">Counting clients still searching</span><b>Under Contract, by day since the start</b></div><div class="chart h-km" id="kmU" role="img" aria-label="Share under contract by day, up to vs above $250K: half by day ${E.curves.uc[LO].half} and ${E.curves.uc[HI].half}."></div></div>
              <div><div class="pp-h"><span class="pp-q">Counting clients still searching</span><b>Closed, by day since the start</b></div><div class="chart h-km" id="kmC" role="img" aria-label="Share closed by day, up to vs above $250K: half by day ${E.curves.closed[LO].half} and ${E.curves.closed[HI].half}."></div></div></div>
          </div>
        </div>
        <div class="pv-table tw" id="spdTable"></div>
      </div>
      <p class="ctx"><span class="ctx-h">Missing budgets</span>${S.int(B.coverage.not_recorded_before_nce)} of the ${S.int(B.coverage.not_recorded_total)} confirmed starts without a recorded budget began before ${S.date(B.coverage.nce_date)}, when the onboarding changed; the budget question is answered only from then (the form went live ${S.date(B.form_since)}). They are left out of both groups.</p>
      <p class="ctx"><span class="ctx-h">Context: who the groups are</span>The groups rest on the <b>all-in onboarding budget</b> (down payment, closing costs, renovation, furniture and amenities), read at the upper end of the range the client chose. For scale, among clients <b>who have purchased</b> the median price was <b>${kK(P[LO].price.median)}</b> (${P[LO].price.n} purchases) up to $250K and <b>${kK(P[HI].price.median)}</b> (${P[HI].price.n}) above, and recorded out-of-pocket ${kK(P[LO].oop.median)} and ${kK(P[HI].oop.median)}. Purchase prices describe what buyers bought; they are not how the groups are defined, and clients still searching have no price yet.</p>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Rates and windows</p><p>Confirmed starts with a matched onboarding budget: <b>${sa.n}</b> up to $250K and <b>${sb.n}</b> above (${S.int(B.coverage.not_recorded)} confirmed starts have no matched answer, mostly clients who started before the form went live on ${S.date(B.form_since)}, and are left out). For each window, <b>eligible</b> = clients with at least that many days since their client start date; the rate is the share of those who reached the milestone within the window. A longer window has fewer eligible clients because recent starters have not had it yet.</p>
         <p class="ex-h">Like for like</p><p>The right-hand column compares clients who started in the same month, went through the same onboarding experience and had their start date set the same way, then averages the gaps. ${clearAny ? 'At least one window is clear of zero.' : `None of the ${ucRows.length + clRows.length} windows is clear of zero (95% interval): the data cannot tell the groups apart, which is not proof that they are identical.`}</p>`,
        `<p class="ex-h">Over time</p><p>The curves include every confirmed start; clients still searching count until the data date (Kaplan–Meier), so they do not flatter the groups. Half of up-to-$250K clients are under contract by day ${E.curves.uc[LO].half}, above $250K by day ${E.curves.uc[HI].half}; closed by day ${E.curves.closed[LO].half} and ${E.curves.closed[HI].half}.</p>
         <p class="ex-h">Same figures in the Explorer</p><p>Budget performance in the Business Data Explorer uses the same code and the same clients; its 14-day rates are ${p1(sa.uc14)} and ${p1(sb.uc14)}.</p>`,
      ])}
      <div class="links">${S.ui.xl('#budget', 'Explorer: budget performance (every window, every grouping)')}${S.ui.xl('#cohorts?preset=0', 'Explorer: build your own budget cohort')}</div>
      <p class="cap">Confirmed starts with an onboarding budget, mostly May–October 2026 starts · bars = share of clients who have had the full window · the count behind each rate is beside it · ${S.date(D.meta.asof)} snapshot.</p>`;
    const board = S.$('#spdBoard', body);
    let recU = null, recC = null;
    const tableRows = [{ _group: 'Under Contract within N days' }, ...ucRows.map(r => Object.assign({ fam: 'Under Contract' }, r)), { _group: 'Closed within N days' }, ...clRows.map(r => Object.assign({ fam: 'Closed' }, r))];
    S.ui.table(S.$('#spdTable', body), [
      { k: 'label', label: 'Window', html: r => `${r.label}${r.w === 14 ? '<small>first 14 days</small>' : ''}` },
      { k: 'a', label: LO, num: true, html: r => `${p1({ k: r.a.k, eligible: r.a.n })}<small>${r.a.k} of ${r.a.n}</small>` },
      { k: 'b', label: HI, num: true, html: r => `${p1({ k: r.b.k, eligible: r.b.n })}<small>${r.b.k} of ${r.b.n}</small>` },
      { k: 'd', label: 'Like for like (up to − above)', num: true, html: r => `${sg(r.m.diff)} pts<small>95% ${sg(r.m.lo)} to ${sg(r.m.hi)} · ${r.m.strata} strata</small>` },
      { k: 'v', label: 'Reading', html: r => (r.m.lo > 0 || r.m.hi < 0 ? '<b>Clear of zero</b>' : 'No measurable difference') },
    ], tableRows, { caption: 'Under Contract and closed within N days, up to vs above $250K', sortable: false });
    S.ui.wire(board, (name, v) => {
      st[name] = v;
      S.$('#spdWin', body).hidden = v !== 'win'; S.$('#spdCurve', body).hidden = v !== 'curve';
      if (v === 'curve') { if (!recU) { recU = curves(S.$('#kmU', body), B, 'uc', 'Under Contract'); recC = curves(S.$('#kmC', body), B, 'closed', 'closing'); } else { recU.draw(); recC.draw(); } }
    });
  }

  /* all-window like-for-like (one click away inside 5.4): the 95% interval of every difference */
  function forest(node, B) {
    const E = B.early, fams = [['uc', 'Under Contract', 'uc', E.windows.uc], ['cl', 'Closed', 'cl', E.windows.closed], ['rf', 'Refunded', 'rf', E.windows.early], ['pa', 'Paused (still paused)', 'pa', E.windows.early]];
    const rows = fams.flatMap(([fk, fl, key, ws]) => ws.map((w, i) => ({ fam: fk, label: i === 0 ? `${fl} within ${w} days` : `${w} days`, first: i === 0, w, m: E.mh.all[fk][i], a: E.sets.all[LO][key + w], b: E.sets.all[HI][key + w], clear: E.mh.all[fk][i].lo > 0 || E.mh.all[fk][i].hi < 0 })));
    const rec = S.chart(node, t => {
      const X = Math.ceil(Math.max(...rows.map(r => Math.max(Math.abs(r.m.lo), Math.abs(r.m.hi)))) * 100 / 5) * 5;
      const famCol = { uc: t.uc, cl: t.closed, rf: t.refund, pa: t.paused };
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 230, top: 34, bottom: 40, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const r = rows[p.dataIndex];
          return `<b>${r.label.replace(/^(\d+) days$/, (m0, d) => `${fams.find(f => f[0] === r.fam)[1]} within ${d} days`)}</b><br>Up to $250K: ${r.a.k} of ${r.a.eligible} (${p1(r.a)})<br>Above $250K: ${r.b.k} of ${r.b.eligible} (${p1(r.b)})<br>Like for like: <b>${sg(r.m.diff)} pts</b> (95% ${sg(r.m.lo)} to ${sg(r.m.hi)}), ${r.m.strata} strata`; } }),
        xAxis: { type: 'value', min: -X, max: X, interval: 5, name: 'percentage points, up to $250K minus above $250K (same start month, client experience and start rule)', nameLocation: 'middle', nameGap: 26,
          nameTextStyle: { color: t.muted, fontSize: 12 }, axisLabel: { color: t.label, fontSize: 12, interval: 0, formatter: v => (v === 0 ? '0 = no difference' : v % 10 === 0 ? (v > 0 ? '+' : '') + v : '') }, splitLine: { lineStyle: { color: t.grid } }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'category', data: rows.map(r => r.label), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink, fontSize: 13, formatter: (v, i) => (rows[i].first ? `{f|${v}}` : v), rich: { f: { fontWeight: 700, color: t.ink, fontSize: 13.5 } } } },
        series: [{ type: 'custom', encode: { x: [1, 2, 3], y: 0 }, data: rows.map((r, i) => [i, r.m.lo * 100, r.m.diff * 100, r.m.hi * 100]),
          renderItem: (p, api) => {
            const i = api.value(0), r = rows[i], y = api.coord([0, i])[1], xl = api.coord([api.value(1), i])[0], xd = api.coord([api.value(2), i])[0], xh = api.coord([api.value(3), i])[0], c = famCol[r.fam], cs = p.coordSys, o = r.clear ? 1 : 0.55;
            return { type: 'group', children: [
              { type: 'line', shape: { x1: xl, y1: y, x2: xh, y2: y }, style: { stroke: c, lineWidth: r.clear ? 3 : 2, opacity: o } },
              { type: 'line', shape: { x1: xl, y1: y - 5, x2: xl, y2: y + 5 }, style: { stroke: c, lineWidth: 2, opacity: o } },
              { type: 'line', shape: { x1: xh, y1: y - 5, x2: xh, y2: y + 5 }, style: { stroke: c, lineWidth: 2, opacity: o } },
              { type: 'circle', shape: { cx: xd, cy: y, r: r.clear ? 7 : 6 }, style: { fill: r.clear ? c : t.surface, stroke: c, lineWidth: 2.4 } },
              { type: 'text', style: { x: cs.x + cs.width + 16, y, text: `${p1(r.a)} vs ${p1(r.b)}`, textVerticalAlign: 'middle', font: `${r.clear ? 700 : 500} 13px Figtree, sans-serif`, fill: r.clear ? t.ink : t.ink2 } },
              { type: 'text', style: { x: cs.x + cs.width + 130, y, text: `${sg(r.m.diff)} pts`, textVerticalAlign: 'middle', font: `${r.clear ? 700 : 500} 13px Figtree, sans-serif`, fill: r.clear ? t.ink : t.muted } },
            ] };
          },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: t.ink2, width: 1.5, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] } }],
        graphic: [{ type: 'text', right: 116, top: 8, style: { text: 'up to · above', fill: t.muted, font: '600 11.5px Figtree, sans-serif' } }, { type: 'text', right: 40, top: 8, style: { text: 'like for like', fill: t.muted, font: '600 11.5px Figtree, sans-serif' } }],
      });
    });
    return { rec, rows };
  }

  /* 5.4 refunds and pauses: the early exits */
  function exitScene(main, D, ch, of) {
    const B = D.budgets, E = B.early, st = { exp: 'all' };
    const A = E.sets.all[LO], H = E.sets.all[HI], m30 = E.mh.all.rf[1], unadj = A.rf30.k / A.rf30.eligible - H.rf30.k / H.rf30.eligible, nclear = [...E.mh.all.uc, ...E.mh.all.cl, ...E.mh.all.rf, ...E.mh.all.pa].filter(m => m.lo > 0 || m.hi < 0);
    const nTests = E.mh.all.uc.length + E.mh.all.cl.length + E.mh.all.rf.length + E.mh.all.pa.length;
    const body = S.scene(main, { ch, step: 4, of, label: 'Budget: refunds and pauses',
      title: `Early refunds are worth investigating: ${p1(A.rf30)} of clients up to $250K were refunded within 30 days, against ${p1(H.rf30)} above` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num"><span class="from">${p1(A.rf30)}</span><span class="ar2">vs</span>${p1(H.rf30)}</span><span class="l"><i style="background:linear-gradient(90deg,var(--b-lo) 50%,var(--b-hi) 50%)"></i><b>As observed, unadjusted:</b> refunded within 30 days, ${A.rf30.k} of ${A.rf30.eligible} up to $250K and ${H.rf30.k} of ${H.rf30.eligible} above (${sg(unadj)} pts) ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${sg(m30.diff)}<small>pts</small></span><span class="l"><i style="background:var(--refund)"></i><b>Like for like:</b> the same gap comparing clients from the same start month, experience and start rule; 95% interval ${sg(m30.lo)} to ${sg(m30.hi)}, which only just clears zero ${S.ui.chip('inf')}</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(A.paused_now / A.n, 1)}</span><span class="ar2">vs</span>${S.pct(H.paused_now / H.n, 1)}</span><span class="l"><i style="background:var(--paused)"></i><b>Paused on ${S.date(E.asof_status)}:</b> ${A.paused_now} of ${A.n} and ${H.paused_now} of ${H.n}. A status snapshot, not a rate over time ${S.ui.chip('snap')}</span></div>
      </div>
      <div class="board" id="exBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('exp', 'Client experience', E.experience.map(x => [x.key, x.label]), 'all')}${S.ui.key(NAMES, COLS)}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart">
          <div class="pp-grid" id="exPanels"></div>
          <p class="bnote" id="exNote"></p>
        </div>
        <div class="pv-table tw" id="exTable"></div>
      </div>
      <details class="ex deep" id="lflDeep"><summary><span class="ex-t">Every window, like for like</span><span class="ex-s">the 95% interval of each difference: contracts, closings, refunds and pauses</span></summary>
        <div class="deep-b"><div class="chart h-forest" id="fstChart" role="img" aria-label="Up to $250K minus above $250K, like for like, in percentage points with 95% intervals for every window."></div><div class="legend"><span><i class="dot" style="background:var(--refund)"></i>Filled: the 95% interval excludes zero</span><span><i class="hollow" style="border-color:var(--ink-2)"></i>Hollow: no measurable difference</span><span>Right: observed shares, up to vs above</span></div></div></details>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Refunds</p><p>Refunded within N days = refund date − client start date ≤ N, among clients with at least N days since their start. Refund dates are recorded in Jira. The first 14 days are shown first; the gap shows from 30 days.</p>
         <p class="ex-h">Pauses, timed</p><p>A paused client's pause date comes from the 12 Nov 2026 Jira extract (data as of ${S.date(E.asof_pause_dates)}): ${E.sets.all[LO].pause_dated + E.sets.all[HI].pause_dated} of the ${A.paused_now + H.paused_now} clients paused on ${S.date(E.asof_status)} have one. <b>A pause that has ended (the client resumed, closed or was refunded) leaves no date</b>, so the timed bars count pauses still in effect and undercount all pauses. The headline snapshot above uses the 16 Nov status instead. Pauses begin a median ${S.med(A.pause_days.median)} days (up to $250K) and ${S.med(H.pause_days.median)} days (above) after the start, the earliest at day ${S.med(Math.min(A.pause_days.min, H.pause_days.min))}, so the first 14 days contain none.</p>`,
        `<p class="ex-h">Refunded or paused</p><p>Whichever came first: a refund, or a pause that is still in effect. It asks whether the groups differ in <i>leaving the search</i> by either route. By day 90 the shares are close, because higher-budget clients pause later where lower-budget clients refund earlier.</p>
         <p class="ex-h">By client experience</p><p>The New Client Experience began on 27 May 2026: clients meet Acquisitions in a Confidence Call before buying. Splitting by experience halves the clients, so intervals widen: a split that includes zero is a direction, not a finding.</p>`,
      ])}
      <div class="links">${S.ui.xl('#budget', 'Explorer: refunds and stages by budget')}${S.ui.xl('#cohorts?preset=0', 'Explorer: build your own budget cohort')}</div>
      <p class="cap">Confirmed starts with an onboarding budget · rates = clients with the event within N days of the start ÷ clients who have had N days · counts are beside every rate · pause dates as of ${S.date(E.asof_pause_dates)}, status snapshot ${S.date(E.asof_status)}.</p>`;
    const board = S.$('#exBoard', body), panels = S.$('#exPanels', body), note = S.$('#exNote', body);
    const sub = () => (a, h) => `eligible: ${a.eligible} · ${h.eligible}`;
    const rowsFor = exp => ({
      rf: rowsOf(E, exp, 'rf', 'rf', E.windows.early, null, sub()),
      pa: rowsOf(E, exp, 'pa', 'pa', E.windows.early, null, sub()),
      ex: rowsOf(E, exp, 'ex', 'ex', E.windows.early.slice(1), null, sub()),
    });
    const draw = () => {
      const r = rowsFor(st.exp), x = E.sets[st.exp], mx = Math.max(0.2, Math.ceil(Math.max(...[...r.rf, ...r.pa, ...r.ex].flatMap(q => [q.a, q.b].map(z => (z.n ? z.k / z.n : 0)))) * 10 + 1) / 10);
      const head = ['Window', 'Share of clients', 'Like for like'];
      panels.innerHTML = `<div><div class="pp-h"><span class="pp-q">Question 1</span><b>Who is refunded early?</b><span>Refund recorded within N days of the start (eligible = clients who have had N days: up to $250K · above).</span></div>${S.ui.pairs(r.rf, { names: NAMES, cols: COLS, max: mx, head, aria: 'Refunded within N days' })}</div>
        <div><div class="pp-h"><span class="pp-q">Question 2</span><b>Who pauses, and when?</b><span>The client’s current pause began within N days. Pauses come later than refunds, and only pauses still in effect carry a date.</span></div>${S.ui.pairs(r.pa, { names: NAMES, cols: COLS, max: mx, head, aria: 'Paused within N days' })}</div>
        <div><div class="pp-h"><span class="pp-q">Question 3</span><b>Together: refunded, or paused and still paused</b><span>Leaving the search by either route within N days. Today (status ${S.date(E.asof_status)}): paused ${x[LO].paused_now} of ${x[LO].n} up to $250K, ${x[HI].paused_now} of ${x[HI].n} above; refunded ${x[LO].refunded_now} and ${x[HI].refunded_now}.</span></div>${S.ui.pairs(r.ex, { names: NAMES, cols: COLS, max: mx, head, aria: 'Refunded or paused within N days' })}</div>
        <div class="call pp-call"><span class="call-h">What “like for like” means</span>
          <p>Refund rates have risen in recent months and the onboarding experience changed in late May, so a plain comparison can be fooled by <i>when</i> each group started. We instead compare clients who <b>started in the same month</b>, went through the <b>same onboarding experience</b> and had their start date <b>set the same way</b>, work out the gap inside each of those small groups, and average the gaps (larger groups count more).</p>
          <p>Here it barely changes the picture: <b>${sg(m30.diff)} points</b> like for like against <b>${sg(unadj)}</b> unadjusted, so timing and mix do not explain the gap. Its interval only just excludes zero, and ${nTests} windows were tested (${nclear.length} came out clear), so read it as a pattern to investigate, not a proven effect.</p>
          <p><b>Pauses are the other half of the story.</b> By day 90 clients above $250K have paused more often (${p1(E.sets.all[HI].pa90)} vs ${p1(E.sets.all[LO].pa90)}, clear of zero), while refunds and pauses together leave the groups level (${p1(E.sets.all[LO].ex90)} vs ${p1(E.sets.all[HI].ex90)}): lower-budget clients tend to leave by refund, higher-budget clients by pausing, later.</p></div>`;
      const m = E.mh[st.exp].rf[1], lab = E.experience.find(z => z.key === st.exp).label;
      note.innerHTML = st.exp === 'all' ? `All matched clients: refunded within 30 days ${p1(x[LO].rf30)} (${x[LO].rf30.k} of ${x[LO].rf30.eligible}) vs ${p1(x[HI].rf30)} (${x[HI].rf30.k} of ${x[HI].rf30.eligible}); like for like ${sg(m.diff)} pts (95% ${sg(m.lo)} to ${sg(m.hi)}). Use the experience switch to see where the gap sits.`
        : `<b>${lab}:</b> refunded within 30 days ${p1(x[LO].rf30)} (${x[LO].rf30.k} of ${x[LO].rf30.eligible}) vs ${p1(x[HI].rf30)} (${x[HI].rf30.k} of ${x[HI].rf30.eligible}); like for like within this group ${sg(m.diff)} pts (95% ${sg(m.lo)} to ${sg(m.hi)})${m.lo > 0 || m.hi < 0 ? '' : ': the interval includes zero, a direction rather than a finding, because this group is smaller'}. ${st.exp === 'nce' ? 'New Client Experience clients are the larger share of recent starts, where early refunds have risen.' : 'Legacy clients started before the new experience (mostly April–June 2026 starts); very few refunds here, so rates move on one or two clients.'}`;
    };
    const tableRows = () => {
      const r = rowsFor(st.exp);
      return [{ _group: 'Refunded within N days' }, ...r.rf, { _group: 'Paused (still paused) within N days' }, ...r.pa, { _group: 'Refunded, or paused and still paused' }, ...r.ex];
    };
    const table = () => S.ui.table(S.$('#exTable', body), [
      { k: 'label', label: 'Window', html: r => `${r.label}${r.w === 14 ? '<small>first 14 days</small>' : ''}` },
      { k: 'a', label: LO, num: true, html: r => `${p1({ k: r.a.k, eligible: r.a.n })}<small>${r.a.k} of ${r.a.n}</small>` },
      { k: 'b', label: HI, num: true, html: r => `${p1({ k: r.b.k, eligible: r.b.n })}<small>${r.b.k} of ${r.b.n}</small>` },
      { k: 'd', label: 'Like for like (up to − above)', num: true, html: r => (r.m.diff == null ? '–' : `${sg(r.m.diff)} pts<small>95% ${sg(r.m.lo)} to ${sg(r.m.hi)} · ${r.m.strata} strata</small>`) },
      { k: 'v', label: 'Reading', html: r => (r.m.diff == null ? '' : r.m.lo > 0 || r.m.hi < 0 ? '<b>Clear of zero</b>' : 'No measurable difference') },
    ], tableRows(), { caption: 'Refunds and pauses within N days, up to vs above $250K', sortable: false, notes: `<span>${E.experience.find(z => z.key === st.exp).label}. <b>s</b> fewer than 5 clients.</span>` });
    draw(); table();
    let fr = null;
    S.$('#lflDeep', body).addEventListener('toggle', e => { if (e.target.open) { if (!fr) fr = forest(S.$('#fstChart', body), B); else fr.rec.draw(); } });
    S.ui.wire(board, (name, v) => { st[name] = v; draw(); table(); });
  }

  S.chapter('drivers', {
    n: 5, title: 'What distinguishes faster and slower searches?',
    render(main, D, ch) {
      const dr = D.drivers, comp = Object.fromEntries(dr.composition.groups.map(x => [x.key, x])), n = dr.composition.n;
      const off = Object.fromEntries(dr.offers.rows.map(r => [r.key, r])), dl = dr.deals.groups, b = dr.bases;
      const OF = 7;

      const cm = dr.composition, sb = cm.stopped_by_status, nEl = cm.all_eligible, nFast = cm.all_fast;
      const stopPaused = sb.Paused || 0, stopRef = sb.Refunded || 0, stopPost = ['Content Pulled', 'Listed', 'CLOSED', 'Photography Shared'].reduce((a, k) => a + (sb[k] || 0), 0), stopOther = cm.stopped_no_contract - stopPaused - stopRef - stopPost;
      let body = S.scene(main, { ch, step: 1, of: OF, label: 'Who moves quickly',
        title: `Of ${S.int(nEl)} starts with at least 75 days of follow-up, ${S.int(nFast)} (${S.pct(nFast / nEl)}) had reached a recorded contract by day 30` });
      body.innerHTML = `<div class="figs qf">
          <div class="fig emph"><span class="v num">${S.pct(nFast / nEl)}<span class="of">${S.int(nFast)} of ${S.int(nEl)}</span></span><span class="l"><i style="background:var(--sp-fast)"></i><b>every start</b> with 75+ days of follow-up (started by ${S.date(dr.eligible_through)}) that had a recorded contract by day 30 ${S.ui.chip('rec')}</span></div>
          <div class="fig"><span class="v num">${S.pct(comp.fast.n / n)}<span class="of">${S.int(comp.fast.n)} of ${S.int(n)}</span></span><span class="l"><i style="background:var(--sp-fast)"></i>the narrower chart below: only the ${S.int(n)} searches that reached a contract or are still hunting</span></div>
          <div class="fig"><span class="v num">${S.int(cm.stopped_no_contract)}</span><span class="l"><i style="background:var(--hold-2)"></i>left out of that chart: ended without a recorded contract (${S.int(stopPaused)} paused, ${S.int(stopRef)} refunded, ${S.int(stopPost)} post-close with no contract date, ${S.int(stopOther)} other)</span></div>
        </div>
        <div class="board">${mixBoard(dr)}</div>
        <p class="cap">${S.int(nEl)} = ${S.int(n)} charted searches + ${S.int(cm.stopped_no_contract)} that ended without a contract · confirmed starts with at least 75 days on the clock, so every search had time to be slow · days to the latest valid Under Contract date · still hunting = no contract yet.</p>`;

      const cp = dr.capital.pipedrive, cf = dr.capital.form, cx = cp.cox || {}, cfx = cf.cox || {};
      const pc100 = v => (v >= 1 ? '+' : '−') + Math.abs(Math.round((v - 1) * 100)) + '%';
      body = S.scene(main, { ch, step: 2, of: OF, label: 'Capital', title: 'Capital doesn’t separate fast from slow clients, even counting those still waiting' });
      body.innerHTML = `<div class="board"><div class="chart h-m" id="capChart" role="img" aria-label="Share of clients under contract by day since start, by stated capital: ${cp.bands.map(x => `${x.label} (${x.n} clients, half under contract by day ${x.km_median == null ? 'not yet' : x.km_median})`).join('; ')}. The curves overlap."></div>
          <div class="legend">${cp.bands.map((x, i) => `<span><i class="line" style="background:var(${['--sp-slow', '--sp-mid', '--sp-fast'][i]})"></i>${x.label} · ${S.int(x.n)} clients</span>`).join('')}</div></div>
        <p class="cap">${S.int(cp.n)} confirmed starts with a stated capital (Pipedrive, recorded before the search), including ${S.int(cp.n - cp.events)} still without a contract · log-rank p = ${cp.logrank.p} · each extra $100K changes the contract rate by ${pc100(cx.lo)} to ${pc100(cx.hi)} (95% interval) · the questionnaire’s all-in capital agrees (${S.int(cf.n)} clients, p = ${cf.logrank.p}) · the data can rule out large effects, not every small one.</p>`;
      capitalKM(S.$('#capChart', body), cp);

      speedScene(main, D, ch, OF);
      exitScene(main, D, ch, OF);

      const sc5 = dr.offers.same_clients, orow = Object.fromEntries(sc5.rows.map(r => [r.key, r])), o0 = orow['0'], o3 = orow['3+'];
      body = S.scene(main, { ch, step: 5, of: OF, label: 'Offer experience',
        title: `Prior offer experience shows by day 30, not day 14: ${pp1(o0.share14)} against ${pp1(o3.share14)} under contract by day 14, ${pp1(o0.share30)} against ${pp1(o3.share30)} by day 30` });
      body.innerHTML = `<div class="figs qf">
          <div class="fig"><span class="v num"><span class="from">${pp1(o0.share14)}</span><span class="ar2">vs</span>${pp1(o3.share14)}</span><span class="l"><i style="background:var(--sp-mid)"></i>under contract by <b>day 14</b>: no prior offers (${o0.n} searches) against 3+ offers (${o3.n})${o0.small14 ? '. The no-offers rate rests on fewer than 5 searches' : ''}</span></div>
          <div class="fig emph"><span class="v num"><span class="from">${pp1(o0.share30)}</span><span class="ar2">vs</span>${pp1(o3.share30)}</span><span class="l"><i style="background:var(--sp-fast)"></i>under contract by <b>day 30</b>: ${o0.k30} of ${o0.n} against ${o3.k30} of ${o3.n} ${S.ui.chip('rec')}</span></div>
          <div class="fig"><span class="v num">${S.int(sc5.n)}</span><span class="l"><i style="background:var(--hold-2)"></i>the same searches in both windows: every start with an onboarding answer and 30+ days of follow-up (${S.date(sc5.from)} – ${S.date(sc5.to)} starts)</span></div>
        </div>
        <div class="board" id="offBoard">
          <div class="ptools"><div class="pl"><span class="vt-l">Offers reported by clients <b>before they joined STR Search</b> · onboarding questionnaire, column AA</span></div><div class="pr">${S.ui.toggle()}</div></div>
          <div class="pv-chart"><div class="chart h-s2" id="offChart" role="img" aria-label="Under contract by day 14 and by day 30, by offers the client reported submitting before joining STR Search: ${sc5.rows.map(r => `${r.label} (${r.n} searches) ${pp1(r.share14)} and ${pp1(r.share30)}`).join('; ')}."></div>
            <div class="legend"><span><i style="background:var(--sp-mid)"></i>under contract by day 14</span><span><i style="background:var(--sp-fast)"></i>under contract by day 30</span>${sc5.rows.some(r => r.small14) ? '<span>* fewer than 5 searches behind the day-14 rate</span>' : ''}</div></div>
          <div class="pv-table tw" id="offTable"></div>
        </div>
        <p class="cap">Offers are the client’s own count of real-estate offers submitted <b>before</b> STRSearch, not offers made during the search · ${S.int(sc5.n)} matched searches (e-mail or deal id) with 30+ days on the clock · on the narrower view of searches with 75+ days that reached a contract or are still hunting, every group ends near ${S.pct(b.d75.share)} by day 75: ahead in the first month, level later, a lead worth testing, not a proven driver.</p>`;
      offersChart(S.$('#offChart', body), sc5.rows);
      S.ui.table(S.$('#offTable', body), [
        { k: 'label', label: 'Offers reported before joining', html: r => `${r.label}<small>${r.n} searches</small>` },
        { k: 'd14', label: 'Under contract by day 14', num: true, sv: r => r.share14, html: r => `${pp1(r.share14)}<small>${r.small14 ? 'fewer than 5 searches' : `${r.k14} of ${r.n}`}</small>` },
        { k: 'd30', label: 'Under contract by day 30', num: true, sv: r => r.share30, html: r => `${pp1(r.share30)}<small>${r.k30} of ${r.n}</small>` },
      ], sc5.rows, { caption: 'Under contract by day 14 and day 30 by offers reported before joining STR Search (the same searches)', sortable: false });
      S.ui.wire(S.$('#offBoard', body));

      const dc = dr.deals.coverage, dn = dr.deals.number_purchased;
      body = S.scene(main, { ch, step: 6, of: OF, label: 'Deals sent',
        title: `Deals sent can’t yet test early momentum, but the deal number purchased has risen: a median ${S.med(dn.early.median)} for January–May starts, ${S.med(dn.late.median)} for June–September` });
      body.innerHTML = `<div class="board"><div class="chart h-d" id="dealChart" role="img" aria-label="Median deals sent before going under contract: within 30 days ${dl.fast.median}, 31 to 74 days ${dl.middle.median}, 75 days or more ${dl.slow.median}."></div>
          <div class="legend"><span><i style="background:var(--sp-mid)"></i>one deal · deals seen by the median client</span><span><i style="border:1.6px solid var(--sp-mid);background:none"></i>up to the top of the middle half</span></div></div>
        <p class="cap">Jira total_deals_sent for clients who reached a contract: ${dl.fast.median} for contracts within 30 days, ${dl.slow.median} for 75+ days · it is a cumulative total with no dates, filled for ${S.pct(dc.with_uc)} of clients with a contract but only ${S.int(dc.hunting_with_count)} of ${S.int(dc.hunting_n)} hunting clients · so properties sent in the first 14 days, and whether a slow early trickle dampens momentum, cannot be measured yet.</p>`;
      deals(S.$('#dealChart', body), dr.deals);
      const mx = Math.max(dn.early.p75, dn.late.p75) + 2, at = v => (100 * v / mx).toFixed(2) + '%';
      const dnRow = (x, lab, c) => `<div class="dn-row"><span class="dn-l">${lab}<small>${S.int(x.n)} searches with a number (of ${S.int(x.uc30)} under contract by day ${dn.window})</small></span>
          <span class="dn-track" role="img" aria-label="${lab}: median ${x.median}, middle half ${x.p25} to ${x.p75}"><i class="dn-iqr" style="left:${at(x.p25)};width:calc(${at(x.p75)} - ${at(x.p25)});background:${c}"></i><i class="dn-med" style="left:${at(x.median)}"></i></span>
          <span class="dn-v"><b class="num">${S.med(x.median)}</b><small>middle half ${S.med(x.p25)}–${S.med(x.p75)}</small></span></div>`;
      body.insertAdjacentHTML('beforeend', `<div class="board dnb"><p class="dn-h">${dn.field}: <b>which of the deals STRSearch sent became the purchase</b> ${S.ui.chip('rec')}</p>
        <div class="dn">${dnRow(dn.early, 'Started January–May 2026', 'var(--sp-mid)')}${dnRow(dn.late, 'Started June–September 2026', 'var(--sp-fast)')}
          <div class="dn-row dn-axisrow" aria-hidden="true"><span></span><span class="dn-ax">${[0, 5, 10, 15, 20].filter(v => v <= mx).map(v => `<span style="left:${at(v)}">${v}</span>`).join('')}</span><span></span></div></div>
        <p class="cap" style="margin-top:12px">Searches that reached a recorded contract by day ${dn.window}, by start month, with a value in the Jira field Deal Number Purchased (the number of the deal that was bought). A higher number means more deals were sent before the one that was bought. The running Deals Sent total above has no send dates, so this is the closest dated view of deal flow.</p></div>`);

      const BGd = Object.fromEntries(D.budgets.groups.map(g => [g.label, g])), r30d = D.budgets.mh.refunded.find(x => x.w === 30);
      body = S.scene(main, { ch, step: 7, of: OF, label: 'What we might learn', title: 'What STRSearch might take from this' });
      body.innerHTML = `<div class="board"><ol class="learn four">
          <li><b>Capital isn’t a speed signal.</b><span>Counting clients still waiting, stated capital shows no measurable link to time to contract; any effect of an extra $100K is small (${pc100(cx.lo)} to ${pc100(cx.hi)}).</span></li>
          <li><b>Offer readiness may be.</b><span>Clients who reported no prior offers are slower to a first contract: ${pp1(o0.share30)} by day 30 against ${pp1(o3.share30)} with 3+ offers, though level at day 14. Early offer preparation is worth testing.</span></li>
          <li><b>Budget isn’t a speed signal either; early refunds are.</b><span>Clients up to $250K contract and close at the same pace as those above, but refund more often in their first month (${S.pct(BGd['Up to $250K'].rf30.k / BGd['Up to $250K'].rf30.eligible)} vs ${S.pct(BGd['Above $250K'].rf30.k / BGd['Above $250K'].rf30.eligible)}). Their first two weeks deserve a closer look, not a different search.</span></li>
          <li><b>Early deal flow needs its own record.</b><span>To test whether a slow trickle of properties in the first two weeks dampens momentum, log the date of every property sent.</span></li>
        </ol></div>
        <p class="cap">Associations, not proven causes · confirmed starts from the 16 Nov reporting layer · onboarding answers cover ${S.int(dr.matching.cohort_matched)} of ${S.int(dr.matching.cohort_n)} clients.</p>`;
    },
  });
})();
