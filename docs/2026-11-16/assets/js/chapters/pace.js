/* Chapter 3: are we keeping pace? Monthly input vs output, in two views.
   3.1 What enters Jira: every new Jira issue by the month it was created, coloured by where it stands today
       (signed client / still in pre-sale onboarding / Services Declined). Since 27 May 2026 Jira opens before the sale.
   (16 Nov 2026 reporting version: starts = Client Started events, confirmed Jira starts dated by client_start_date;
   UC = latest valid contract; CLOSED = closings up to the data date; 90-day strip = matured cohort flags.)
   3.2 Clients in, contracts out: signed clients by the month their acquisition clock started vs Under Contract and
       CLOSED events in the month they happened (the Explorer's Q3 chart). Underneath, on the same months: the gap
       (starts minus Under Contract that month, two counts side by side, not a cohort) and the Explorer's same-cohort
       view (of each month's starters, the share under contract within 90 days). */
(function () {
  'use strict';
  const S = window.S;
  const KEYS = [
    { k: 'signed', name: 'Signed client', cls: 'in-signed', sub: 'bought the service' },
    { k: 'presale', name: 'Still in pre-sale onboarding', cls: 'in-presale', sub: 'New Clients or Onboarding Completed' },
    { k: 'declined', name: 'Services Declined', cls: 'in-declined', sub: 'did not buy' },
  ];
  const SERIES = ['Clients starting acquisition (confirmed starts)', 'Under Contract that month', 'CLOSED that month'];
  const QUARTER = ['01', '04', '07', '10'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fullMon = k => MONTHS[+k.slice(5) - 1];
  const listMon = ks => (ks.length < 2 ? fullMon(ks[0]) : `${ks.slice(0, -1).map(fullMon).join(', ')} and ${fullMon(ks[ks.length - 1])}`);
  const sgn = v => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');
  const r10 = v => Math.round(v / 10) * 10;
  const sw = bg => `<i style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;background:${bg}"></i>`;
  const swl = bg => `<i style="display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:6px;vertical-align:3px;background:${bg}"></i>`;
  const hatch = t => `repeating-linear-gradient(135deg,${t.sales} 0 1.5px,${t.sales2} 1.5px 4.2px)`;
  // diagonal stripes as an image pattern (same look as the CSS hatch), drawn at device resolution
  const stripes = (fg, bg) => {
    const r = Math.min(2, Math.ceil(window.devicePixelRatio || 1)), s = 6, c = document.createElement('canvas');
    c.width = c.height = s * r;
    const x = c.getContext('2d');
    x.scale(r, r);
    x.fillStyle = bg; x.fillRect(0, 0, s, s);
    x.strokeStyle = fg; x.lineWidth = 2.1; x.beginPath();
    [0, s, 2 * s].forEach(k => { x.moveTo(k - s - 2, s + 2); x.lineTo(k + 2, -2); });
    x.stroke();
    return { image: c, repeat: 'repeat', scaleX: 1 / r, scaleY: 1 / r };
  };

  // month axis, plus a hidden value axis on the same grid so markers can sit exactly between two months
  const monthAxis = (t, rows, extra) => Object.assign({
    type: 'category', data: rows.map(r => r.month), axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
    axisLabel: { color: t.label, fontSize: 12.5, formatter: S.monShort, interval: i => QUARTER.includes(rows[i].month.slice(5)) },
  }, extra || {});
  const between = (rows, gridIndex) => ({ type: 'value', gridIndex, min: -0.5, max: rows.length - 0.5, show: false, axisPointer: { show: false } });

  // 3.1 new Jira issues by month created, stacked by where each issue stands today
  function intake(node, pc, asof) {
    const rows = pc.intake.monthly, n = rows.length, ci = rows.findIndex(r => r.month === pc.change_month);
    return S.chart(node, t => {
      const narrow = node.offsetWidth < 640;
      const color = { signed: t.acq, presale: stripes(t.sales, t.sales2), declined: t.decl };
      const top = rows.map(r => (r.declined ? 'declined' : r.presale ? 'presale' : 'signed'));
      const seg = (x, extra) => ({
        name: x.name, type: 'bar', stack: 'in', barWidth: '66%', emphasis: { disabled: true },
        itemStyle: Object.assign({ color: color[x.k], borderColor: t.surface, borderWidth: 1 }, extra || {}),
        data: rows.map((r, i) => ({ value: r[x.k], itemStyle: { opacity: r.partial ? 0.5 : 1, borderRadius: top[i] === x.k ? [4, 4, 0, 0] : 0 } })),
      });
      const label = (text, color, weight, right) => ({ show: true, position: right ? ['100%', -8] : [8, -8], align: right ? 'right' : 'left', verticalAlign: 'bottom',
        formatter: text, color, fontWeight: weight, fontSize: narrow ? 11.5 : 12.5, lineHeight: narrow ? 15 : 16 });
      return Object.assign(S.base(t), {
        legend: { show: false },
        grid: { left: 8, right: 12, top: narrow ? 62 : 52, bottom: 8, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, {
          axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } },
          formatter: ps => {
            const r = rows[ps[0].dataIndex];
            return `<b>${r.label}${r.partial ? ` (to ${S.date(asof)})` : ''}</b> · ${S.int(r.total)} new issues<br>`
              + `<span style="color:${t.muted}">where they stand today</span><br>`
              + KEYS.map(x => `${sw(x.k === 'presale' ? hatch(t) : color[x.k])}${x.name}: <b>${S.int(r[x.k])}</b>`).join('<br>');
          },
        }),
        xAxis: [monthAxis(t, rows), between(rows, 0)],
        yAxis: S.valAxis(t),
        series: [
          seg(KEYS[0]),
          seg(KEYS[1]),
          seg(KEYS[2]),
          { type: 'line', xAxisIndex: 1, data: [], silent: true,
            markArea: { silent: true, data: [
              [{ xAxis: -0.5, itemStyle: { color: 'transparent' }, label: label(narrow ? 'Jira opened\nat the sale' : 'Before: Jira opened at the sale', t.muted, 600) }, { xAxis: ci - 0.5 }],
              [{ xAxis: ci - 0.5, itemStyle: { color: t.sales, opacity: 0.06 }, label: label(narrow ? `Since ${S.date(pc.change_date).replace(/ \d{4}$/, '')}:\nJira opens\nbefore the sale` : `Since ${S.date(pc.change_date).replace(/ \d{4}$/, '')}: Jira opens at\nonboarding, before the sale`, t.sales, 700, narrow) }, { xAxis: n - 0.5 }],
            ] },
            markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: t.sales, type: 'dashed', width: 1.6, opacity: 0.8 }, data: [{ xAxis: ci - 0.5 }] } },
        ],
      });
    });
  }

  // 3.2 signed clients starting acquisition vs Under Contract / CLOSED events; underneath, on the same months,
  // the monthly gap (starts minus Under Contract) and the 90-day cohort strip
  function throughput(node, pc, asof) {
    const rows = pc.monthly, n = rows.length, ci = rows.findIndex(r => r.month === pc.change_month);
    const coh = Object.fromEntries(pc.cohort.rows.map(c => [c.month, c]));
    const strip = rows.map(r => (coh[r.month] && coh[r.month].share != null ? coh[r.month].share * 100 : null));   // round once, at the label
    const shown = strip.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0);
    const pending = rows.map((r, i) => (coh[r.month] && !coh[r.month].mature ? i : -1)).filter(i => i >= 0);
    // gap row from pc.gap.from; months whose starts can still rise are faded, the partial month carries no label
    const g0 = rows.findIndex(r => r.month >= pc.gap.from), inGap = i => g0 >= 0 && i >= g0;
    const gaps = rows.filter((r, i) => inGap(i)).map(r => r.gap);
    const peakI = rows.findIndex(r => r.month === pc.gap.peak_months[pc.gap.peak_months.length - 1]);   // phone: the last peak month
    const settledI = rows.reduce((a, r, i) => (inGap(i) && !r.filling ? i : a), -1);
    const fullI = rows.reduce((a, r, i) => (inGap(i) && !r.partial ? i : a), -1);
    return S.chart(node, t => {
      const narrow = node.offsetWidth < 640, stripH = 58, gapH = narrow ? 92 : 112, L = 40, R = 14;
      const gapB = 8 + stripH + 22, mainB = gapB + gapH + (narrow ? 36 : 40);
      const hi = Math.max(0, ...gaps), lo = Math.min(0, ...gaps), room = (18 * (hi - lo)) / Math.max(1, gapH - 36);
      const keep = i => !narrow || i === shown[0] || i === shown[shown.length - 1];
      const keepGap = i => !rows[i].partial && (!narrow || [g0, peakI, settledI, fullI].includes(i));
      const side = (text, bottom) => ({ type: 'text', left: L, bottom, silent: true,
        style: { text, fill: t.ink2, font: `600 ${narrow ? 11.5 : 13}px Figtree, system-ui, sans-serif`, lineHeight: narrow ? 15 : 18 } });
      const late = (axis, extra) => Object.assign({ type: 'line', xAxisIndex: axis, yAxisIndex: axis === 1 ? 0 : axis === 3 ? 1 : 2, data: [], silent: true,
        markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: t.sales, type: 'dashed', width: 1.8 }, data: [{ xAxis: ci - 0.5 }] } }, extra || {});
      return Object.assign(S.base(t), {
        legend: { show: false, data: SERIES },
        grid: [{ left: L, right: R, top: 34, bottom: mainB }, { left: L, right: R, bottom: gapB, height: gapH }, { left: L, right: R, bottom: 8, height: stripH }],
        axisPointer: { link: [{ xAxisIndex: [0, 2, 4] }] },
        tooltip: Object.assign(S.base(t).tooltip, {
          axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } },
          formatter: ps => {
            if (!ps || !ps.length) return '';
            const i = ps[0].dataIndex, r = rows[i], c = coh[r.month];
            let h = `<b>${r.label}${r.partial ? ` (to ${S.date(asof)})` : ''}</b><br>`
              + `${sw(t.hold2)}${SERIES[0]}: <b>${r.new}</b><br>${swl(t.uc)}${SERIES[1]}: <b>${r.uc}</b><br>${swl(t.closed)}${SERIES[2]}: <b>${r.closed}</b>`;
            if (inGap(i)) h += `<br>${sw(r.gap < 0 ? t.uc : t.ink2)}Starts minus Under Contract: <b>${sgn(r.gap)}</b>`
              + (r.filling ? `<br><span style="color:${t.muted}">Partial month: the data run to ${S.date(asof)}</span>` : '');
            if (c && c.share != null) h += `<br><span style="color:${t.muted}">Of these starters, ${S.pct(c.share)} under contract within ${pc.cohort.days} days (${c.k} of ${c.n})</span>`;
            else if (c && !c.mature) h += `<br><span style="color:${t.muted}">Too recent for the ${pc.cohort.days}-day view</span>`;
            return h;
          },
        }),
        xAxis: [monthAxis(t, rows, { gridIndex: 0 }), between(rows, 0),
          monthAxis(t, rows, { gridIndex: 1, axisLabel: { show: false }, axisLine: { show: false } }), between(rows, 1),
          monthAxis(t, rows, { gridIndex: 2, axisLabel: { show: false }, axisLine: { show: false } }), between(rows, 2)],
        yAxis: [S.valAxis(t, { gridIndex: 0 }), { type: 'value', gridIndex: 1, min: lo - room, max: hi + room, show: false },
          { type: 'value', gridIndex: 2, min: 0, max: 100, show: false }],
        graphic: [
          side(narrow ? 'Starts minus\nUnder Contract,\nsame month' : 'Starts minus Under Contract,\nsame month', gapB + gapH / 2 - (narrow ? 22 : 14)),
          side(narrow ? 'Of each month’s\nstarters: under contract\nwithin 90 days' : `Of each month’s starters:\nunder contract within ${pc.cohort.days} days`, 8 + stripH / 2 - (narrow ? 22 : 14)),
        ],
        series: [
          { name: SERIES[0], type: 'bar', barWidth: '64%', xAxisIndex: 0, yAxisIndex: 0,
            data: rows.map(r => ({ value: r.new, itemStyle: { color: t.hold2, opacity: r.partial ? 0.45 : 1, borderRadius: [5, 5, 0, 0] } })) },
          { name: SERIES[1], type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: rows.map(r => r.uc), symbol: 'circle', symbolSize: 8,
            lineStyle: { color: t.uc, width: 3.2 }, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 1.5 } },
          { name: SERIES[2], type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: rows.map(r => r.closed), symbol: 'circle', symbolSize: 8,
            lineStyle: { color: t.closed, width: 3.2 }, itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 1.5 } },
          late(1, { markLine: { symbol: 'none', silent: true, lineStyle: { color: t.sales, type: 'dashed', width: 1.8 },
            label: { position: 'end', formatter: narrow ? 'Late May changes' : 'Late May: Complete offer + Confidence Call', align: narrow ? 'right' : 'center', color: t.sales, fontWeight: 700, fontSize: narrow ? 11.5 : 12.5 },
            data: [{ xAxis: ci - 0.5 }] } }),
          // the gap: dark when starts exceed contracts, blue when contracts exceed starts
          { name: 'gap', type: 'bar', barWidth: '58%', xAxisIndex: 2, yAxisIndex: 1, emphasis: { disabled: true },
            data: rows.map((r, i) => (inGap(i) ? {
              value: r.gap,
              itemStyle: { color: r.gap < 0 ? t.uc : t.ink2, opacity: r.filling ? 0.4 : 1, borderRadius: r.gap < 0 ? [0, 0, 3, 3] : [3, 3, 0, 0] },
              label: { show: keepGap(i), position: r.gap < 0 ? 'bottom' : 'top', distance: 4, formatter: sgn(r.gap),
                color: r.filling ? t.muted : t.ink, fontWeight: 700, fontSize: narrow ? 11 : 12.5 },
            } : null)) },
          late(3, { symbol: 'none', data: g0 >= 0 ? [[g0 - 0.5, 0], [n - 0.5, 0]] : [], lineStyle: { color: t.axis, width: 1 } }),
          { name: 'cohort', type: 'line', xAxisIndex: 4, yAxisIndex: 2, data: strip, connectNulls: false, symbol: 'circle', symbolSize: narrow ? 7 : 9, showAllSymbol: true,
            lineStyle: { color: t.ink2, width: 1.5, opacity: 0.6 }, itemStyle: { color: t.ink2, borderColor: t.surface, borderWidth: 1.5 },
            label: { show: true, position: 'top', distance: 6, color: t.ink, fontWeight: 700, fontSize: narrow ? 11.5 : 12.5,
              formatter: p => (keep(p.dataIndex) && p.value != null ? Math.round(p.value) + '%' : '') } },
          late(5, { markArea: { silent: true, itemStyle: { color: t.grid, opacity: 0.55 },
            label: { show: true, position: 'inside', color: t.muted, fontSize: narrow ? 11 : 12, lineHeight: 14, formatter: narrow ? 'too\nrecent' : 'too recent to tell' },
            data: pending.length ? [[{ xAxis: pending[0] - 0.5 }, { xAxis: pending[pending.length - 1] + 0.5 }]] : [] } }),
        ],
      });
    });
  }

  /* ---- added 18 Nov 2026 -------------------------------------------------------------------------------------------- */
  const phrase = d => (d > 0 ? `${d} more start${d === 1 ? '' : 's'} than contracts` : d < 0 ? `${-d} more contract${d === -1 ? '' : 's'} than starts` : 'as many starts as contracts');
  const monName = k => MONTHS[+k.slice(5) - 1].slice(0, 3);
  const span = p => (p && p.months ? (p.months[0] === p.months[1] ? monName(p.months[0]) : `${monName(p.months[0])}–${monName(p.months[1])}`) : '');
  const NOTE = { early: 'a', rule: 'b', ucgap: 'c' };

  // 3.2 table: Won, Starts, Under Contract with growth against the previous month or the same month a year earlier
  function growthTable(host, gr, mode, range) {
    const R = gr.reasons;
    const dlt = (r, m) => {
      const x = r[`${m}_${mode}`];
      if (x.pct == null) return x.why === 'zero' ? `<span class="nc" title="${R.zero}">–</span>` : `<span class="nc" title="${R[x.why]}">n/c<sup>${NOTE[x.why]}</sup></span>`;
      return `${S.signed(x.pct)}<small>vs ${S.int(x.base)}</small>`;
    };
    const vs = mode === 'mom' ? 'vs previous month' : 'vs same month last year';
    const lab = r => `${r.label}${r.partial ? `<small>1–${r.days} ${r.label.slice(0, 3)} (partial), compared with the same days ${mode === 'mom' ? 'of the previous month' : 'a year earlier'}</small>` : ''}`;
    const cols = [{ k: 'month', label: 'Month', html: lab }];
    [['won', 'Won (Pipedrive)'], ['starts', 'Jira starts'], ['uc', 'Under Contract']].forEach(([m, l]) => {
      cols.push({ k: m, label: l, num: true, html: r => S.int(r[m]) });
      cols.push({ k: `${m}_${mode}`, label: `<small style="margin:0">${vs}</small>`, num: true, sv: r => r[`${m}_${mode}`].pct, html: r => dlt(r, m) });
    });
    cols.push({ k: 'diff', label: 'Starts − Under Contract', cls: 'nw', html: r => phrase(r.diff) + (r.partial ? '<small>so far</small>' : '') });
    S.ui.table(host, cols, gr.rows.filter(r => range === 'all' || r.month >= '2026-01').reverse().map(r => Object.assign({ _cls: r.partial ? 'part' : '' }, r)), {
      caption: 'Monthly Won, Jira starts and Under Contract with growth',
      notes: `<span>n/c = not comparable; hover for the reason.</span>${Object.entries(NOTE).map(([k, l]) => `<span><b>${l}</b>${R[k]}</span>`).join('')}<span>Growth = this period ÷ the comparison period − 1. The hunting count (${S.int(gr.hunting)} today) is the backlog; monthly differences are not added up.</span>`,
    });
  }

  // 3.3 same-cohort view: share of each start month's clients under contract within 14 / 30 / 60 / 90 days or to date
  function cohortScene(main, D, ch) {
    const C = D.pace.cohorts, st = { w: '14', clock: 'start', range: '2026' };
    const P = n => C.clocks[n].pooled, ps = P('start'), pw = P('won');
    const cmp = (a, b) => (Math.abs(a - b) < 0.02 ? 'about the same as' : a > b ? 'up from' : 'down from');
    const b14 = ps.w14.before, a14 = ps.w14.after, b30 = ps.w30.before, a30 = ps.w30.after;
    const old = C.clocks.start.rows.filter(r => r.uc_dates_incomplete), oldN = old.reduce((a, r) => a + r.n, 0), oldK = old.reduce((a, r) => a + r.closed_no_uc, 0);
    const body = S.scene(main, { ch, step: 3, of: 3, label: 'Are newer clients faster?',
      title: `First 14 days: ${S.pct(a14.share)} of starters since June went under contract, ${cmp(a14.share, b14.share)} ${S.pct(b14.share)} before; by day 30, ${S.pct(a30.share)}, ${cmp(a30.share, b30.share)} ${S.pct(b30.share)}` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num"><span class="from">${S.pct(b14.share)}</span><span class="ar2">→</span>${S.pct(a14.share)}</span><span class="l"><i style="background:var(--uc)"></i>under contract within 14 days: ${span(b14)} → ${span(a14)} start months (${b14.k} of ${S.int(b14.n)} → ${a14.k} of ${S.int(a14.n)})</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(b30.share)}</span><span class="ar2">→</span>${S.pct(a30.share)}</span><span class="l"><i style="background:var(--uc)"></i>within 30 days: ${span(b30)} → ${span(a30)} (${b30.k} of ${S.int(b30.n)} → ${a30.k} of ${S.int(a30.n)})</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(pw.w14.before.share)}</span><span class="ar2">→</span>${S.pct(pw.w14.after.share)}</span><span class="l"><i style="background:var(--uc-2)"></i>within 14 days counted from the won date, one clock for every month (${pw.w14.before.k} of ${S.int(pw.w14.before.n)} → ${pw.w14.after.k} of ${S.int(pw.w14.after.n)})</span></div>
      </div>
      <div class="board" id="cohBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('w', 'Window', [['14', 'Within 14 days'], ['30', '30'], ['60', '60'], ['90', '90'], ['todate', 'To date']], '14', 'only-chart')}${S.ui.seg('clock', 'Clock', [['start', 'From client start'], ['won', 'From won date']], 'start')}${S.ui.seg('range', 'Months shown', [['2026', '2026'], ['all', 'Since Jan 2025']], '2026', 'only-table')}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-coh" id="cohChart" role="img" aria-label="Share of each 2026 start month's clients under contract within 14 days: ${C.clocks.start.rows.filter(r => r.month >= C.compare_from && r.w14.eligible).map(r => `${S.monShort(r.month)} ${r.w14.k} of ${r.w14.eligible}`).join(', ')}."></div>
          <div class="legend"><span><i style="background:var(--uc)"></i>Every client in the month has had the full window</span><span><i class="hatch-uc"></i>Maturing: share so far</span><span id="cohAvg"></span><span><i class="line" style="background:var(--sales)"></i>Late May changes</span></div></div>
        <div class="pv-table tw" id="cohTable"></div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">The measure</p><p>Each start month's confirmed starts (won deals with a Jira start, ${S.int(D.speed.estimate.n)} in all) and how many reached Under Contract within 14, 30, 60 or 90 days of their start: <code>SUM(uc_within_Nd × eligible_Nd) ÷ SUM(eligible_Nd)</code>, the Explorer's matured-cohort rule. A window is <b>maturing</b> while some of the month's clients have had fewer than N days; the chart then shows the share so far. Under Contract is the latest valid contract, so a client whose first contract fell through counts at the later one. Refunded clients stay in (${S.int(C.refunded_included)}).</p>
         <p class="ex-h">Comparable months</p><p>Months whose whole window has passed, from January 2026: ${span(b14)} 2026 before the late-May changes, June 2026 on after. 2025 start months are in the table but not compared: ${S.int(oldK)} of their ${S.int(oldN)} clients closed without an Under Contract date, so their shares read low. Cells resting on fewer than 5 clients are marked <sup>s</sup>.</p>`,
        `<p class="ex-h">Two clocks</p><p><b>From client start</b> (the reporting rule): before June the start is the kickoff, a median ${S.d1(C.kickoff_lag_median)} days after the sale; from 1 June it is the won date. So clients since June get about ${S.d1(C.kickoff_lag_median)} fewer search days inside the same window, which works against the newer months.</p>
         <p><b>From won date</b> counts every month from the sale. It removes that shift, but since 27 May clients meet Acquisitions in the Confidence Call before they buy, so part of their search can start before the won date. The true change in the first two weeks lies between the two readings: ${S.pct(b14.share)} → ${S.pct(a14.share)} and ${S.pct(pw.w14.before.share)} → ${S.pct(pw.w14.after.share)}.</p>`,
      ])}
      <p class="cap">Confirmed starts by start month · bars show the selected window · the table shows every window with its numerator and eligible clients.</p>`;
    const board = S.$('#cohBoard', body), node = S.$('#cohChart', body), host = S.$('#cohTable', body);
    const cellOf = (r, w) => (w === 'todate' ? { k: r.to_date.k, el: r.to_date.n, mature: true, small: r.to_date.small } : { k: r[`w${w}`].k, el: r[`w${w}`].eligible, mature: r[`w${w}`].mature, small: r[`w${w}`].small });
    const rec = S.chart(node, t => {
      const rows = C.clocks[st.clock].rows.filter(r => r.month >= C.compare_from), n = rows.length, w = st.w;
      const ci = rows.findIndex(r => r.month === C.change_month), pool = w === 'todate' ? null : C.clocks[st.clock].pooled[`w${w}`];
      const pts = rows.map(r => { const c = cellOf(r, w); return { c, v: c.el ? (100 * c.k) / c.el : null }; });
      const idx = m => rows.findIndex(r => r.month === m);
      const ref = p => (p && p.months ? [[{ coord: [idx(p.months[0]) - 0.42, p.share * 100] }, { coord: [idx(p.months[1]) + 0.42, p.share * 100] }]] : []);
      const ymax = Math.max(20, Math.ceil(Math.max(...pts.map(p => p.v || 0), pool ? pool.after.share * 100 : 0, pool ? pool.before.share * 100 : 0) / 10) * 10 + 10);
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 14, top: 30, bottom: 28, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => {
          const r = rows[p.dataIndex], c = pts[p.dataIndex].c, wl = w === 'todate' ? 'to date' : `within ${w} days`;
          if (!c.el) return `<b>${r.label} starters</b> · ${S.int(r.n)} clients<br>No client has had ${w} days yet`;
          return `<b>${r.label} starters</b> · ${S.int(r.n)} clients<br>Under contract ${wl}: <b>${c.k} of ${c.el}</b> (${S.pct(c.k / c.el)})`
            + (c.mature ? '' : `<br><span style="color:${t.muted}">Maturing: ${c.el} of ${r.n} clients have had ${w} days</span>`)
            + (c.small ? `<br><span style="color:${t.muted}">Fewer than 5: one client moves this by ${S.pct(1 / c.el)}</span>` : '');
        } }),
        xAxis: [{ type: 'category', data: rows.map(r => r.month), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } }, axisLabel: { color: t.label, fontSize: 12.5, formatter: S.monShort } },
          { type: 'value', min: -0.5, max: n - 0.5, show: false }],
        yAxis: S.valAxis(t, { max: ymax, axisLabel: { color: t.label, fontSize: 12, formatter: v => v + '%' } }),
        series: [
          { type: 'bar', barWidth: '58%', z: 3, data: pts.map(p => ({ value: p.v == null ? 0 : p.v,
            itemStyle: { color: p.c.mature ? t.uc : stripes(t.uc, t.uc2), borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', distance: 5, color: p.c.mature ? t.ink : t.muted, fontWeight: p.c.mature ? 700 : 500, fontSize: 12.5, backgroundColor: t.surface, padding: [1, 3], borderRadius: 3,
              formatter: p.v == null ? 'too recent' : `${Math.round(p.v)}%${p.c.mature ? '' : ' so far'}` } })) },
          { type: 'line', xAxisIndex: 1, data: [], silent: true, z: 1,
            markLine: { symbol: 'none', silent: true, z: 1, lineStyle: { color: t.ink2, type: 'dashed', width: 1.8 }, label: { show: false },
              data: pool ? [...ref(pool.before), ...ref(pool.after)] : [] } },
          { type: 'line', xAxisIndex: 1, data: [], silent: true,
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.sales, type: 'solid', width: 1.6, opacity: 0.8 },
              label: { show: true, position: 'end', formatter: 'Late May changes', color: t.sales, fontWeight: 700, fontSize: 12 }, data: ci > 0 ? [{ xAxis: ci - 0.5 }] : [] } },
        ],
      });
    });
    const table = () => {
      const rows = C.clocks[st.clock].rows, pool = C.clocks[st.clock].pooled, W = ['14', '30', '60', '90'];
      const cell = (r, w) => {
        const c = cellOf(r, w);
        if (!c.el) return '<span class="nc" title="No client in this month has had the full window yet">–</span>';
        const s = c.small ? '<sup title="Fewer than 5 clients">s</sup>' : '';
        return c.mature ? `${S.pct(c.k / c.el)}${s}<small>${c.k} of ${c.el}</small>` : `<span class="mat">${S.pct(c.k / c.el)} so far${s}</span><small>${c.k} of ${c.el} eligible</small>`;
      };
      const cols = [{ k: 'month', label: 'Start month', html: r => `${r.label}${r.uc_dates_incomplete ? '<sup title="Under Contract dates incomplete">u</sup>' : ''}${r.partial ? '<small>partial month</small>' : ''}` },
        { k: 'n', label: 'Clients', num: true, html: r => S.int(r.n) },
        ...W.map(w => ({ k: `w${w}`, label: w === '14' ? '<b>Within 14 days</b>' : `Within ${w}`, num: true, sv: r => (r[`w${w}`].eligible ? r[`w${w}`].k / r[`w${w}`].eligible : null), html: r => cell(r, w) })),
        { k: 'to_date', label: 'Under contract to date', num: true, sv: r => r.to_date.k / (r.to_date.n || 1), html: r => cell(r, 'todate') }];
      S.ui.table(host, cols, rows.filter(r => st.range === 'all' || !r.uc_dates_incomplete).reverse().map(r => Object.assign({ _cls: r.uc_dates_incomplete ? 'dim' : r.partial ? 'part' : '' }, r)), {
        caption: 'Under Contract within 14, 30, 60 and 90 days by start month',
        notes: `<span><b>s</b>fewer than 5 clients: one client moves the share by several points.</span><span><b>u</b>2025: ${S.int(oldK)} of ${S.int(oldN)} clients closed without an Under Contract date, so these shares read low; not compared.</span><span>Comparable months, pooled (full windows only): ${W.map(w => `${w} days ${S.pct(pool[`w${w}`].before.share)} (${pool[`w${w}`].before.k} of ${pool[`w${w}`].before.n}, ${span(pool[`w${w}`].before)}) → ${S.pct(pool[`w${w}`].after.share)} (${pool[`w${w}`].after.k} of ${pool[`w${w}`].after.n}, ${span(pool[`w${w}`].after)})`).join(' · ')}.</span>`,
      });
    };
    const avg = () => {
      const el = S.$('#cohAvg', body), p = st.w === 'todate' ? null : C.clocks[st.clock].pooled[`w${st.w}`];
      el.innerHTML = p ? `<i class="dash" style="color:var(--ink-2)"></i>Average of the comparable months: ${span(p.before)} <b>${S.pct(p.before.share)}</b> (${p.before.k} of ${S.int(p.before.n)}) · ${span(p.after)} <b>${S.pct(p.after.share)}</b> (${p.after.k} of ${S.int(p.after.n)})` : 'To date: older months have had longer, so they are not compared';
    };
    avg();
    table();
    S.ui.wire(board, (name, v) => { st[name] = v; if (name !== 'range') { rec.draw(); avg(); } if (name !== 'w') table(); });
  }

  S.chapter('pace', {
    n: 3, title: 'Are we keeping pace?',
    render(main, D, ch) {
      const pc = D.pace, w = pc.windows, co = pc.cohort, sc = pc.intake.since_change, asof = D.meta.asof;
      const last = pc.monthly[pc.monthly.length - 1], since = S.date(pc.change_date).replace(/ \d{4}$/, '');

      // 3.1
      let body = S.scene(main, { ch, step: 1, of: 3, label: 'What enters Jira',
        title: `Jira intake jumped from about ${r10(w.intake.before)} to ${r10(w.intake.after)} a month: issues now open before the sale` });
      body.innerHTML = `<div class="board">
          <div class="chart h-l" id="intakeChart" role="img" aria-label="New Jira issues per month from ${pc.intake.monthly[0].label} to ${last.label}, by where each issue stands today. Before ${since} 2026 almost every issue is a signed client; from June 2026 intake rises to between ${Math.min(...w.after.map(m => pc.intake.monthly.find(r => r.month === m).total))} and ${Math.max(...w.after.map(m => pc.intake.monthly.find(r => r.month === m).total))} a month, most of them prospects."></div>
          <div class="tally">
            <div class="tally-h">Opened since ${since}: <b class="num">${S.int(sc.total)}</b> issues, by where they stand today</div>
            <div class="tally-bar" aria-hidden="true">${KEYS.map(x => `<i class="${x.cls}" style="flex:${sc[x.k]} 1 0"></i>`).join('')}</div>
            <div class="tally-keys">${KEYS.map(x => `<div class="tk"><span class="tk-v num">${S.int(sc[x.k])}</span><span class="tk-t"><i class="${x.cls}"></i>${x.k === 'signed' ? 'Signed clients' : x.name}</span><span class="tk-s">${S.pct(sc[x.k] / sc.total)} · ${x.sub}</span></div>`).join('')}</div>
          </div></div>
        <p class="cap">New issues by month created, coloured by where each stands today, not by what happened that month · ${r10(w.intake.before)} → ${r10(w.intake.after)}: average of the five full months either side of ${since}.</p>`;
      intake(S.$('#intakeChart', body), pc, asof);

      // 3.2 (answer first, then the chart / table with growth, then how it is built)
      const g = pc.gap, gr = pc.growth, full = gr.rows.filter(r => !r.partial), lf = full[full.length - 1], pr = gr.rows.find(r => r.partial);
      body = S.scene(main, { ch, step: 2, of: 3, label: 'Starts vs contracts',
        title: lf.diff > 0 ? `Starts still outpace contracts${g.narrowing ? ', but by less each month' : ''}: ${phrase(lf.diff)} in ${fullMon(lf.month)}, against ${g.peak} in ${listMon(g.peak_months)}`
          : `Contracts caught up with starts in ${fullMon(lf.month)}: ${phrase(lf.diff)}` });
      body.innerHTML = `<div class="figs qf">
          <div class="fig"><span class="v num">${Math.abs(lf.diff)}</span><span class="l"><i style="background:var(--ink-2)"></i>${phrase(lf.diff).replace(/^\d+ /, '')} in ${fullMon(lf.month)}: ${lf.starts} starts, ${lf.uc} contracts ${S.ui.chip('rec')}</span></div>
          ${pr ? `<div class="fig"><span class="v num">${Math.abs(pr.diff)}</span><span class="l"><i style="background:var(--uc)"></i>${phrase(pr.diff).replace(/^\d+ /, '')} so far in ${fullMon(pr.month)} (1–${pr.days} ${pr.label.slice(0, 3)}, partial): ${pr.starts} starts, ${pr.uc} contracts</span></div>` : ''}
          <div class="fig"><span class="v num">${S.int(gr.hunting)}</span><span class="l"><i style="background:var(--wait)"></i>clients hunting today: the actual backlog (monthly differences are not added up)</span></div>
        </div>
        <div class="board" id="paceBoard">
          <div class="ptools"><div class="pl"><div class="legend legend-top only-chart" id="paceLegend">
            <button type="button" aria-pressed="true" data-s="${SERIES[0]}"><i style="background:var(--hold-2)"></i>${SERIES[0]}</button>
            <button type="button" aria-pressed="true" data-s="${SERIES[1]}"><i class="line" style="background:var(--uc)"></i>${SERIES[1]}</button>
            <button type="button" aria-pressed="true" data-s="${SERIES[2]}"><i class="line" style="background:var(--closed)"></i>${SERIES[2]}</button>
          </div>${S.ui.seg('growth', 'Growth', [['mom', 'Month on month'], ['yoy', 'Year on year']], 'mom', 'only-table')}${S.ui.seg('range', 'Months shown', [['2026', '2026'], ['all', 'Since Jan 2025']], '2026', 'only-table')}</div><div class="pr">${S.ui.toggle()}</div></div>
          <div class="pv-chart"><div class="chart h-pace" id="paceChart" role="img" aria-label="Monthly confirmed starts, Under Contract and CLOSED events from ${pc.monthly[0].label} to ${last.label}. Below, starts minus Under Contract each month: ${pc.monthly.filter(r => r.month >= g.from && !r.partial).map(r => `${S.monShort(r.month)} ${sgn(r.gap)}`).join(', ')}. Then the share of each month's starters under contract within ${co.days} days: ${co.rows.filter(c => c.share != null).map(c => `${S.monShort(c.month)} ${S.pct(c.share)}`).join(', ')}."></div></div>
          <div class="pv-table tw" id="growthTable"></div>
        </div>
        ${S.ui.ex('How is this number built?', [
          `<p class="ex-h">The three counts</p><p><b>Won</b> = Pipedrive STR Search deals won that month (Client Won events, ${S.int(gr.rows.reduce((a, r) => a + r.won, 0))} since ${gr.rows[0].label}). <b>Jira starts</b> = confirmed client starts, dated by the client start date. <b>Under Contract</b> = contracts by the date of the latest valid contract. All three come from daily_client_activity, the reporting layer's daily counts.</p>
           <p><b>Starts − Under Contract</b> compares two counts in the same month; the contracts often belong to clients who started earlier. It is calendar throughput, not a backlog, and is never added up. The backlog is the number of clients hunting today: <b>${S.int(gr.hunting)}</b>.</p>`,
          `<p class="ex-h">Growth</p><p>Month on month and year on year = this month ÷ the comparison month − 1, shown only where both periods count the same way. ${pr ? `The partial month (1–${pr.days} ${pr.label.slice(0, 3)}) is compared with the same ${pr.days} days of the previous month and of the year before.` : ''}</p>
           <ul>${Object.entries(NOTE).map(([k, l]) => `<li><b>${l}</b> ${gr.reasons[k]}</li>`).join('')}</ul>`,
        ])}
        <p class="cap">Gap = that month’s starts minus its Under Contract events (net client change), which often come from earlier starters: calendar throughput, not the hunting backlog · from 1 Jun 2026 a start is the won date, so a finished month no longer changes${last.partial ? ` · ${last.label.split(' ')[0]} runs to ${S.date(asof)}` : ''}.</p>`;
      const rec = throughput(S.$('#paceChart', body), pc, asof);
      body.querySelectorAll('#paceLegend button').forEach(b => b.addEventListener('click', () => {
        if (!rec.inst) return;
        rec.inst.dispatchAction({ type: 'legendToggleSelect', name: b.dataset.s });
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      }));
      const gt = S.$('#growthTable', body);
      const gs = { growth: 'mom', range: '2026' };
      growthTable(gt, gr, gs.growth, gs.range);
      S.ui.wire(S.$('#paceBoard', body), (name, v) => { gs[name] = v; growthTable(gt, gr, gs.growth, gs.range); });

      // 3.3
      cohortScene(main, D, ch);
    },
  });
})();
