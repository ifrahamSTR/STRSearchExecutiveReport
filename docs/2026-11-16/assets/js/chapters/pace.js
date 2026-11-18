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
    return { image: c, repeat: 'repeat', imageWidth: c.width, imageHeight: c.height, scaleX: 1 / r, scaleY: 1 / r };
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

  // 3.2 (reworked 18 Nov 2026) searches started vs Under Contract, paired by month, with the difference in an aligned strip around zero.
  // Marked months (1 peak, 2 last full month, 3 the partial month) are explained beside the chart. Closed and the 90-day cohort share live in 3.2 and 3.4.
  function startsVsUc(node, pc, asof, st, marks) {
    return S.chart(node, t => {
      const rows = pc.monthly.filter(r => st.range === 'all' || r.month >= '2026-01'), n = rows.length, dense = n > 14, narrow = node.offsetWidth < 640;
      const g0 = rows.findIndex(r => r.month >= pc.gap.from), inGap = i => g0 >= 0 && i >= g0;
      const ci = rows.findIndex(r => r.month === pc.change_month), pi = rows.findIndex(r => r.partial);
      const gaps = rows.filter((r, i) => inGap(i)).map(r => r.gap), hi = Math.max(10, ...gaps), lo = Math.min(-10, ...gaps), room = (hi - lo) * 0.2;
      const ymax = Math.ceil(Math.max(...rows.flatMap(r => [r.new, r.uc])) / 20) * 20 + 10;
      const H = node.clientHeight, top = 34, stripH = 118, gapGap = 70, topH = H - top - stripH - gapGap - 4;
      const cat = (gridIndex, show) => ({ type: 'category', gridIndex, data: rows.map(r => r.month), axisTick: { show: false }, axisLine: { show: show, lineStyle: { color: t.axis } },
        axisLabel: { show, color: t.label, fontSize: 12.5, lineHeight: 15, interval: dense ? i => rows[i].month.slice(5) === '01' || rows[i].month.slice(5) === '04' || rows[i].month.slice(5) === '07' || rows[i].month.slice(5) === '10' || rows[i].partial : 0,
          formatter: (m, i) => { const r = rows[i]; const nm = S.monShort(m); return r.partial ? `{b|${nm.replace(/ ’\d\d/, '')}}\n{p|1–${new Date(asof + 'T12:00:00').getDate()} (partial)}` : `{b|${nm}}`; },
          rich: { b: { color: t.ink2, fontSize: 12.5, fontWeight: 600 }, p: { color: t.muted, fontSize: 11 } } } });
      const between = gridIndex => ({ type: 'value', gridIndex, min: -0.5, max: n - 0.5, show: false, axisPointer: { show: false } });
      const label = (color, w) => ({ show: !dense, position: 'top', distance: 3, color, fontWeight: w, fontSize: narrow ? 10.5 : 12, formatter: p => S.int(p.value) });
      const sgn2 = v => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');
      return Object.assign(S.base(t), {
        legend: { show: false, data: SERIES2 },
        axisPointer: { link: [{ xAxisIndex: [0, 2] }] },
        tooltip: Object.assign(S.base(t).tooltip, { axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } }, formatter: ps => {
          if (!ps || !ps.length) return '';
          const i = ps[0].dataIndex, r = rows[i];
          return `<b>${r.label}${r.partial ? ` · 1–${new Date(asof + 'T12:00:00').getDate()} (partial: data run to ${S.date(asof)})` : ''}</b><br>${sw(t.wait)}Searches started: <b>${r.new}</b><br>${sw(t.uc)}Under Contract: <b>${r.uc}</b>${!inGap(i) ? `<span style="color:${t.muted}"> (2025 contract dates are incomplete)</span>` : ''}`
            + (inGap(i) ? `<br>${sw(r.gap < 0 ? t.uc : t.wait)}Started minus Under Contract: <b>${sgn(r.gap)}</b> · ${r.gap > 0 ? 'more starts than contracts' : r.gap < 0 ? 'more contracts than starts' : 'level'}` : '');
        } }),
        grid: [{ left: 40, right: 14, top, height: topH }, { left: 40, right: 14, top: top + topH + gapGap, height: stripH }],
        xAxis: [cat(0, true), between(0), cat(1, false), between(1)],
        yAxis: [S.valAxis(t, { gridIndex: 0, max: ymax }), { type: 'value', gridIndex: 1, min: lo - room, max: hi + room, show: false }],
        graphic: [{ type: 'text', left: 40, top: top + topH + gapGap - 24, silent: true, style: { text: 'Started minus Under Contract, same month', fill: t.ink2, font: `650 ${narrow ? 12 : 13}px Figtree, system-ui, sans-serif` } }],
        series: [
          { name: SERIES2[0], type: 'bar', xAxisIndex: 0, yAxisIndex: 0, barGap: '10%', barCategoryGap: dense ? '22%' : '30%', z: 3,
            data: rows.map((r, i) => ({ value: r.new, itemStyle: { color: r.partial ? S.stripes(t.wait, t.wait2) : t.wait, borderColor: t.wait, borderWidth: r.partial ? 1.2 : 0, borderRadius: [4, 4, 0, 0] } })), label: label(t.ink2, 600) },
          { name: SERIES2[1], type: 'bar', xAxisIndex: 0, yAxisIndex: 0, z: 3,
            data: rows.map((r, i) => ({ value: r.uc, itemStyle: { color: r.partial ? S.stripes(t.uc, t.uc2) : t.uc, borderColor: t.uc, borderWidth: r.partial ? 1.2 : 0, borderRadius: [4, 4, 0, 0], opacity: inGap(i) ? 1 : 0.4 } })), label: label(t.ink, 700) },
          // numbered marks over the months explained beside the chart, the late-May line, the partial-month band
          { type: 'line', xAxisIndex: 1, yAxisIndex: 0, data: [], silent: true, z: 5,
            markPoint: { silent: true, symbol: 'circle', symbolSize: 22, itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 },
              data: marks.map(m => ({ i: rows.findIndex(r => r.month === m.month), m })).filter(x => x.i >= 0).map(({ i, m }) => ({ coord: [i, Math.max(rows[i].new, rows[i].uc)], symbolOffset: [0, dense ? -14 : -26], label: { show: true, formatter: String(m.n), color: t.surface, fontWeight: 800, fontSize: 12 } })) },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.sales, type: 'dashed', width: 1.6, opacity: 0.85 }, label: { show: true, position: 'end', formatter: narrow ? 'Late May' : 'Late May changes', color: t.sales, fontWeight: 700, fontSize: 12, distance: 6 }, data: ci > 0 ? [{ xAxis: ci - 0.5 }] : [] },
            markArea: { silent: true, itemStyle: { color: t.grid, opacity: 0.7 }, data: pi >= 0 ? [[{ xAxis: pi - 0.5 }, { xAxis: pi + 0.5 }]] : [] } },
          { name: 'gap', type: 'bar', xAxisIndex: 2, yAxisIndex: 1, barWidth: dense ? '56%' : '46%', emphasis: { disabled: true }, z: 3,
            data: rows.map((r, i) => (inGap(i) ? { value: r.gap, itemStyle: { color: r.partial ? S.stripes(r.gap < 0 ? t.uc : t.wait, r.gap < 0 ? t.uc2 : t.wait2) : (r.gap < 0 ? t.uc : t.wait), borderColor: r.gap < 0 ? t.uc : t.wait, borderWidth: r.partial ? 1.2 : 0, borderRadius: r.gap < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0] },
              label: { show: !dense || marks.some(m => m.month === r.month), position: r.gap < 0 ? 'bottom' : 'top', distance: 4, formatter: sgn2(r.gap), color: t.ink, fontWeight: 700, fontSize: narrow ? 11 : 13 } } : null)) },
          { type: 'line', xAxisIndex: 3, yAxisIndex: 1, data: [], silent: true, z: 4,
            markLine: { symbol: 'none', silent: true, label: { show: false }, data: [{ yAxis: 0, lineStyle: { color: t.ink2, width: 1.6, type: 'solid' } }, ...(ci > 0 ? [{ xAxis: ci - 0.5, lineStyle: { color: t.sales, type: 'dashed', width: 1.6, opacity: 0.85 } }] : [])] },
            markArea: { silent: true, itemStyle: { color: t.grid, opacity: 0.7 }, data: pi >= 0 ? [[{ xAxis: pi - 0.5 }, { xAxis: pi + 0.5 }]] : [] } },
        ],
      });
    });
  }
  const SERIES2 = ['Searches started', 'Under Contract'];

  /* ---- Added 18 Nov 2026: 3.1 the 100-a-month goal ----------------------------------------------------------------
     Sales (Pipedrive won date), Under Contract (valid contract date) and Closed (completed closing date) from
     daily_client_activity, by calendar month or by Sunday-Saturday reporting week. Months can be read per seven calendar days
     covered, so a month, a partial month and a week all compare with the same weekly benchmark (100 a month = 23.0 per 7 days). */
  const GS = [['sales', 'Sales', 'Pipedrive won date'], ['uc', 'Under Contract', 'valid contract date'], ['closed', 'Closed', 'completed closing date']];
  const dShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const span7 = r => `${dShort(r.first)}–${dShort(r.last)}`;
  const f1 = v => (v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1));
  /* the two reporting changes that make start-date cohorts before and after them not like for like (stated beside the charts that compare them) */
  const changeNote = D => {
    const cov = D.budgets.coverage, kl = D.pace.cohorts.kickoff_lag_median;
    return `<div class="call chg"><span class="call-h">Two reporting changes affect cohort comparisons</span>
      <p><b>27 May 2026, the onboarding change.</b> Clients now meet Acquisitions before they buy, and Jira opens an issue at that stage, so intake and the pool of signed searches changed. The onboarding budget question is also asked only from then: ${S.int(cov.not_recorded_before_nce)} of the ${S.int(cov.not_recorded_total)} missing budgets are for starts before 27 May.</p>
      <p><b>1 June 2026, the start-date change.</b> Before June a search starts at its kickoff, a median ${S.d1(kl)} days after the sale; from June it starts on the won date. A start-month cohort from June therefore begins earlier in the client's journey than one from before June, so shares before and after June are not counted the same way. The won-date clock removes the shift; both are shown.</p></div>`;
  };

  function goalChart(node, G, st) {
    return S.chart(node, t => {
      const col = { sales: t.sales, uc: t.uc, closed: t.closed }, light = { sales: t.sales2, uc: t.uc2, closed: t.closed2 };
      const on = GS.filter(([k]) => st.on[k]), narrow = node.offsetWidth < 760;
      const tipRow = (r, per) => GS.map(([k, l]) => `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:${col[k]}"></span>${l}: <b>${S.int(r[k])}</b>${per ? ` · ${f1(r[k + '_per7'])} per 7 days` : ''}`).join('<br>');
      if (st.view === 'month') {
        const rows = G.months, per = st.unit === 'per7', bench = per ? G.benchmark_per7 : G.goal_per_month;
        const v = (r, k) => (per ? r[k + '_per7'] : r[k]);
        const ymax = Math.ceil(Math.max(bench * 1.15, ...rows.flatMap(r => on.map(([k]) => v(r, k)))) / (per ? 5 : 20)) * (per ? 5 : 20);
        return Object.assign(S.base(t), {
          grid: { left: 8, right: narrow ? 8 : 150, top: 30, bottom: 8, containLabel: true },
          tooltip: Object.assign(S.base(t).tooltip, { axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } }, formatter: ps => {
            const r = rows[ps[0].dataIndex];
            return `<b>${r.label}</b>${r.partial ? ` · ${span7(r)}, ${r.days} of ${r.full_days} days` : ''}<br>${tipRow(r, true)}<br><span style="color:${t.muted}">Closings: ${r.partial ? `${S.pct(r.pace_share)} of the weekly rate needed` : `${S.pct(r.goal_share)} of 100`}</span>`;
          } }),
          xAxis: { type: 'category', data: rows.map(r => r.month), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
            axisLabel: { color: t.label, fontSize: 13, lineHeight: 17, interval: 0, formatter: (m, i) => { const r = rows[i]; return r.partial ? `{b|${S.monShort(m).replace(/ ’\d\d/, '')}}\n{p|1–${r.days} (partial)}` : `{b|${S.monShort(m).replace(/ ’\d\d/, '')}}`; },
              rich: { b: { color: t.ink2, fontSize: 13, fontWeight: 600 }, p: { color: t.muted, fontSize: 11.5 } } } },
          yAxis: S.valAxis(t, { max: ymax, axisLabel: { color: t.label, fontSize: 12 } }),
          series: on.map(([k, l], i) => ({
            name: l, type: 'bar', barGap: '12%', barCategoryGap: '26%', z: 3,
            data: rows.map(r => ({ value: v(r, k), itemStyle: { color: r.partial ? S.stripes(col[k], light[k]) : col[k], borderColor: r.partial ? col[k] : null, borderWidth: r.partial ? 1.2 : 0, borderRadius: [4, 4, 0, 0] } })),
            label: { show: true, position: 'top', distance: 3, color: k === 'closed' ? t.ink : t.ink2, fontWeight: k === 'closed' ? 800 : 600, fontSize: k === 'closed' ? 13.5 : 12,
              formatter: p => (per ? f1(p.value) : S.int(p.value)) },
            markLine: i ? undefined : { symbol: 'none', silent: true, z: 1, lineStyle: { color: t.closed, type: 'dashed', width: 2 },
              label: { show: true, position: narrow ? 'insideEndTop' : 'end', formatter: per ? `Goal: 100 a month\n= ${f1(bench)} per 7 days` : 'Goal: 100 a month', color: t.closed, fontWeight: 700, fontSize: 12.5, lineHeight: 16 },
              data: [{ yAxis: bench }] },
          })),
        });
      }
      // weekly: one panel per series, same scale, so each can be read against the weekly benchmark
      const rows = G.weeks, n = on.length || 1, H = node.clientHeight, top = 28, gap = 34, bottom = 34, ph = (H - top - bottom - gap * (n - 1)) / n;
      const ymax = Math.ceil(Math.max(G.benchmark_per7 * 1.2, ...rows.flatMap(r => on.map(([k]) => r[k]))) / 5) * 5;
      const monthStart = rows.map(r => { const d0 = new Date(r.week + 'T12:00:00'); for (let k = 0; k < 7; k++) { const d = new Date(d0.getTime() + k * 864e5); if (d.getDate() === 1) return d.toLocaleDateString('en-GB', { month: 'short' }); } return ''; });
      return Object.assign(S.base(t), {
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        tooltip: Object.assign(S.base(t).tooltip, { axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } }, formatter: ps => {
          const r = rows[ps[0].dataIndex];
          return `<b>Week ${dShort(r.week)}–${dShort(r.end)}</b>${r.partial ? ` · partial: ${r.days} of 7 days (to ${dShort(r.last)})` : ''}<br>${tipRow(r, false)}<br><span style="color:${t.muted}">Weekly rate for 100 a month: ${f1(G.benchmark_per7)}</span>`;
        } }),
        grid: on.map((_, i) => ({ left: 46, right: narrow ? 8 : 150, top: top + i * (ph + gap), height: ph })),
        xAxis: on.map((_, i) => ({ type: 'category', gridIndex: i, data: rows.map(r => r.week), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
          axisLabel: { show: i === n - 1, color: t.label, fontSize: 12, interval: 0, formatter: (w, j) => monthStart[j] } })),
        yAxis: on.map((_, i) => S.valAxis(t, { gridIndex: i, max: ymax, interval: ymax / (ymax > 25 ? 3 : 2), axisLabel: { color: t.label, fontSize: 11.5 } })),
        graphic: on.map(([k, l, src], i) => ({ type: 'text', left: 46, top: top + i * (ph + gap) - 20, silent: true,
          style: { text: `${l} per week · ${src} · best ${G.best[k].week.n} (${dShort(G.best[k].week.at)}) · ${G.weeks_at_benchmark[k]} of ${G.full_weeks} weeks at ${f1(G.benchmark_per7)}+`, fill: t.ink2, font: '600 12.5px Figtree, system-ui, sans-serif' } })),
        series: on.map(([k, l], i) => ({
          name: l, type: 'bar', xAxisIndex: i, yAxisIndex: i, barWidth: '68%',
          data: rows.map(r => ({ value: r[k], itemStyle: { color: r.partial ? S.stripes(col[k], light[k]) : col[k], borderColor: r.partial ? col[k] : null, borderWidth: r.partial ? 1 : 0, borderRadius: [3, 3, 0, 0], opacity: r[k] >= G.benchmark_per7 || r.partial ? 1 : 0.78 } })),
          label: { show: true, position: 'top', distance: 2, fontSize: 11.5, fontWeight: 700, color: t.ink,
            formatter: p => { const r = rows[p.dataIndex]; return r.partial ? `${p.value} (${r.days} days)` : p.value >= G.benchmark_per7 || (G.best[k].week.at === r.week) ? String(p.value) : ''; } },
          markLine: { symbol: 'none', silent: true, lineStyle: { color: t.closed, type: 'dashed', width: 1.6 },
            label: { show: !narrow, position: 'end', formatter: i === 0 ? `100 a month\n= ${f1(G.benchmark_per7)} a week` : f1(G.benchmark_per7), color: t.closed, fontWeight: 700, fontSize: 12, lineHeight: 15 },
            data: [{ yAxis: G.benchmark_per7 }] },
        })),
      });
    });
  }

  function goalTable(host, G, st) {
    if (st.view === 'month') {
      S.ui.table(host, [
        { k: 'month', label: 'Month', html: r => `${r.label}${r.partial ? `<small>partial: ${span7(r)}, ${r.days} of ${r.full_days} days</small>` : ''}` },
        { k: 'days', label: 'Days covered', num: true },
        ...GS.flatMap(([k, l]) => [{ k, label: l, num: true, html: r => S.int(r[k]) }, { k: k + '_per7', label: '<small style="margin:0">per 7 days</small>', num: true, html: r => f1(r[k + '_per7']) }]),
        { k: 'goal_share', label: 'Closed vs goal', num: true, sv: r => r.pace_share, html: r => (r.partial ? `${S.pct(r.pace_share)}<small>of the weekly rate</small>` : `${S.pct(r.goal_share)}<small>of 100</small>`) },
      ], G.months.slice().reverse().map(r => Object.assign({ _cls: r.partial ? 'part' : '' }, r)), {
        caption: 'Sales, Under Contract and Closed by month with the rate per seven days',
        total: [Object.assign({ label: 'April to ' + S.date(G.asof), month: '', days: G.months.reduce((a, r) => a + r.days, 0) }, ...GS.map(([k]) => ({ [k]: G.totals[k], [k + '_per7']: G.totals[k] * 7 / G.months.reduce((a, r) => a + r.days, 0) })), { goal_share: null, partial: false })]
          .map(x => Object.assign(x, { label: x.label })),
        notes: `<span>Per 7 days = count × 7 ÷ days covered. Goal: 100 closings a month = ${f1(G.benchmark_per7)} per 7 days.</span>`,
      });
      const tf = host.querySelector('tfoot tr');
      if (tf) { tf.children[0].textContent = `1 Apr – ${dShort(G.asof)}`; tf.lastElementChild.textContent = ''; }
      return;
    }
    S.ui.table(host, [
      { k: 'week', label: 'Week (Sunday–Saturday)', html: r => `${dShort(r.week)}–${dShort(r.end)}${r.partial ? `<small>partial: ${r.days} of 7 days, to ${dShort(r.last)}</small>` : ''}` },
      ...GS.map(([k, l]) => ({ k, label: l, num: true, html: r => `${S.int(r[k])}${!r.partial && r[k] >= G.benchmark_per7 ? '<small>at the weekly rate</small>' : ''}` })),
      { k: 'pace', label: 'Closed vs weekly rate', num: true, sv: r => r.closed_per7, html: r => (r.partial ? `<span class="mat">${S.pct(r.closed_per7 / G.benchmark_per7)}</span><small>${f1(r.closed_per7)} per 7 days</small>` : S.pct(r.closed / G.benchmark_per7)) },
    ], G.weeks.slice().reverse().map(r => Object.assign({ _cls: r.partial ? 'part' : '' }, r)), {
      caption: 'Sales, Under Contract and Closed by Sunday-Saturday week',
      notes: `<span>Weekly rate for 100 closings a month: ${f1(G.benchmark_per7)}. The first week (29 Mar–4 Apr) includes three March days.</span>`,
    });
  }

  const monthYear = iso => new Date(iso.slice(0, 7) + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  function goalScene(main, D, ch, of) {
    const G = D.pace.goal, st = { view: 'month', unit: 'per7', on: { sales: true, uc: true, closed: true } };
    const full = G.months.filter(r => !r.partial), cur = G.months.find(r => r.partial), bc = G.best.closed.month, bs = G.best.sales.month;
    const bcRow = G.months.find(r => r.month === bc.at), last = full[full.length - 1], W = G.windows.per7, cv = G.conversion, L4 = G.last4;
    const mon = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long' });
    const soldIn = Object.entries(G.best_close_sold.by_sale_month), wave = soldIn.filter(([m]) => m >= '2026-06' && m <= '2026-08').reduce((a, [, n]) => a + n, 0);
    const py = G.prev_year, lowest = cur && G.months.filter(r => r !== cur).every(r => r.sales_per7 > cur.sales_per7), cooled = last.sales_per7 < G.best.sales.month.per7 && (!cur || cur.sales_per7 < last.sales_per7);
    const sold = G.best_close_sold.by_sale_month, before = Object.entries(sold).filter(([m]) => m < '2026-06').reduce((a, [, n]) => a + n, 0);
    const lagSegs = [...(before ? [{ k: 'before', n: before, label: 'Before June', sub: 'won Dec 2025 – May 2026', c: 'var(--hold)' }] : []),
      ...Object.entries(sold).filter(([m]) => m >= '2026-06').map(([m, n]) => ({ k: 'm' + m, n, label: `Won in ${mon(m)}`, sub: m <= '2026-08' ? 'the June–August sales wave' : 'later sales', c: m <= '2026-08' ? 'var(--sales)' : 'var(--sales-2)', lt: m > '2026-08' }))];
    const body = S.scene(main, { ch, step: 1, of, label: 'How close to 100 a month',
      title: `Closings peaked at ${bc.n} in ${mon(bc.at)}, ${S.pct(bc.n / G.goal_per_month)} of the 100-a-month goal; ${cooled ? `the sales that feed closings have slowed since ${mon(bs.at)}` : `sales peaked in ${mon(bs.at)}`}` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num">${bc.n}<span class="of">of 100</span></span><span class="l"><i style="background:var(--closed)"></i>closings in ${mon(bc.at)}, the best month: ${f1(bcRow.closed_per7)} per 7 days against the ${f1(G.benchmark_per7)} the goal needs ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${f1(L4.closed_per7)}<small>a week</small></span><span class="l"><i style="background:var(--closed)"></i>closings over the last four full weeks (${dShort(L4.from)}–${dShort(L4.to)}): ${S.pct(L4.closed_per7 / G.benchmark_per7)} of the weekly rate; sales ${f1(L4.sales_per7)}, contracts ${f1(L4.uc_per7)}</span></div>
        <div class="fig"><span class="v num">≈${S.int(cv.sales_needed)}<small>sales a month</small></span><span class="l"><i style="background:var(--sales)"></i><b>planning estimate</b> for 100 closings a month: ${S.int(cv.won_closed)} of the ${S.int(cv.won_n)} deals won ${monthYear(cv.won_from)}–${monthYear(cv.won_to)} have closed (${S.pct(cv.won_close, 1)}), so about ${S.int(cv.sales_needed)} sales a month; best month so far ${G.best.sales.month.n}. About ${S.int(cv.uc_needed)} contracts a month (best ${G.best.uc.month.n}) ${S.ui.chip('inf')}</span></div>
      </div>
      <div class="board" id="goalBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('view', 'Period', [['month', 'Monthly'], ['week', 'Weekly (Sun–Sat)']], 'month')}${S.ui.seg('unit', 'Unit', [['per7', 'Per 7 days'], ['count', 'Monthly totals']], 'per7', 'only-chart hide-wk')}
          <div class="legend legend-top only-chart" id="goalLegend">${GS.map(([k, l, src]) => `<button type="button" aria-pressed="true" data-k="${k}"><i style="background:var(--${k})"></i>${l} <small style="color:var(--muted)">· ${src}</small></button>`).join('')}</div></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-goal" id="goalChart" role="img" aria-label="Sales, Under Contract and Closed per month from April to ${S.date(G.asof)}: ${G.months.map(r => `${r.label}${r.partial ? ' (partial)' : ''} ${r.sales} / ${r.uc} / ${r.closed}`).join('; ')}. Goal 100 closings a month, ${G.benchmark_per7} per 7 days."></div>
          <div class="legend"><span><i class="dash" style="color:var(--closed)"></i>Goal: 100 closings a month = ${f1(G.benchmark_per7)} per 7 days</span><span><i class="hatch-uc"></i>Partial period (hatched): ${cur ? `1–${cur.days} ${cur.label.slice(0, 3)}` : ''}${G.weeks[G.weeks.length - 1].partial ? ` · last week ${G.weeks[G.weeks.length - 1].days} of 7 days` : ''}</span></div></div>
        <div class="pv-table tw" id="goalTable"></div>
        <div class="lag" id="lagBoard"><p class="lag-h">The lag between a sale and a purchase <small>${mon(bc.at)}'s ${bc.n} closings, by the month the deal was won ${S.ui.chip('rec')}</small></p>
          ${S.ui.stack(lagSegs, [{ from: 'm2026-06', to: 'm2026-08', text: `${wave} of ${bc.n} came from deals won in June–August`, sub: S.pct(wave / bc.n), lvl: 0 }], `${mon(bc.at)} closings by the month the deal was won: ${soldIn.map(([m, n]) => `${m} ${n}`).join(', ')}; ${wave} of ${bc.n} won in June to August.`)}
          ${S.ui.keys(lagSegs.map(x => ({ n: x.n, of: S.pct(x.n / bc.n), label: x.label, sub: x.sub, c: x.c })), lagSegs.length)}</div>
        <p class="call"><span class="call-h">The change that matters most</span><b>The June sales surge has reached closings, and sales have since cooled.</b> Sales rose from ${f1(W.before.sales)} per 7 days in April–May to ${f1(W.surge.sales)} in June–September. Closings follow a sale by a median ${S.int(G.lag.sale_to_close)} days, so the surge arrived as closings from August: ${wave} of ${mon(bc.at)}'s ${bc.n} closings were sold in June–August. Sales slowed to ${f1(last.sales_per7)} per 7 days in ${mon(last.month)}${cur ? ` and ${f1(cur.sales_per7)} so far in ${mon(cur.month)} (1–${cur.days}), ${lowest ? 'the lowest rate of any month since April' : 'well below the summer'}` : ''}. ${py.length === 3 ? `A year earlier sales also fell from ${f1(py[0].sales_per7)} per 7 days in ${mon(py[0].month)} to ${f1(py[1].sales_per7)} in 1–${cur.days} ${mon(py[1].month)}, then recovered to ${f1(py[2].sales_per7)} in ${mon(py[2].month)}, so part of this is seasonal. ` : ''}At a median ${S.int(G.lag.sale_to_close)} days from sale to closing, ${cur ? mon(cur.month) : 'this month'}'s sales become closings in January and February.</p>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Three series, one source</p><p><b>Sales</b> = won STR Search deals by Pipedrive won date. <b>Under Contract</b> = clients by the date of their latest valid contract. <b>Closed</b> = completed purchases by closing date, up to ${S.date(G.asof)}; ${S.int(D.speed.clock.scheduled_closings)} closings dated later are not counted until they happen (the Cash Forecast collects them on that date). All three are the reporting layer's daily_client_activity, the same daily counts as the Explorer's monthly table and chart 3.3.</p>
         <p class="ex-h">Partial periods and the weekly rate</p><p>Per 7 days = count × 7 ÷ calendar days covered, so a 30-day month, a 31-day month, the partial month (1–${cur ? cur.days : ''} ${cur ? cur.label.slice(0, 3) : ''}) and a week all compare with one benchmark: 100 a month = 100 × 7 ÷ 30.44 = <b>${f1(G.benchmark_per7)}</b> per 7 days. Weeks run Sunday to Saturday; the first (29 Mar–4 Apr) includes three March days and the last covers ${G.weeks[G.weeks.length - 1].days} days.</p>`,
        `<p class="ex-h">What 100 a month needs</p><p>Of the <b>${S.int(cv.won_n)}</b> deals won from ${S.date(cv.won_from)} to ${S.date(cv.won_to)} (seven months or more to close), <b>${S.int(cv.won_closed)}</b> (${S.pct(cv.won_close)}) have closed, so 100 closings a month needs about 100 ÷ ${S.pct(cv.won_close)} ≈ <b>${S.int(cv.sales_needed)}</b> sales a month at steady state. Of ${S.int(cv.uc_n)} contracts at least ${cv.uc_days} days old (since June 2025), ${S.int(cv.uc_closed)} (${S.pct(cv.uc_close)}) closed: ≈ <b>${S.int(cv.uc_needed)}</b> contracts a month. These are recorded shares of past clients, not a forecast. Median days from sale: ${S.int(G.lag.sale_to_uc)} to the contract, ${S.int(G.lag.sale_to_close)} to the closing (2026 sales).</p>
         <p class="ex-h">Same figures elsewhere</p><p>The Explorer's Sales funnel applies Pipedrive's duplicate filter, so it shows one sale fewer in June and in November (${Object.entries(D.reconcile.rows.find(r => r.key === 'oct_sales').bridge.funnel_months_differ).map(([m, [a, b]]) => `${mon(m)} ${b} not ${a}`).join(', ')}). The ${D.cash.recent_closed.n} closings from ${dShort(D.cash.recent_closed.from)} to ${dShort(D.cash.recent_closed.to)} equal the Cash Forecast's.</p>`,
      ])}
      <p class="cap">Daily client activity, April to ${S.date(G.asof)} · bars at the same scale for all three series · the hatched bar is a partial period · switch to the weekly view for the Sunday–Saturday reporting weeks.</p>`;
    const board = S.$('#goalBoard', body), node = S.$('#goalChart', body), host = S.$('#goalTable', body);
    const rec = goalChart(node, G, st);
    goalTable(host, G, st);
    body.querySelectorAll('#goalLegend button').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k, others = Object.values(st.on).filter(Boolean).length;
      if (st.on[k] && others === 1) return;
      st.on[k] = !st.on[k];
      b.setAttribute('aria-pressed', String(st.on[k]));
      rec.draw();
    }));
    S.ui.wire(board, (name, v) => {
      st[name] = v;
      if (name === 'view') { node.classList.toggle('h-goal', v === 'month'); node.classList.toggle('h-goalw', v === 'week'); board.classList.toggle('m-wk', v === 'week'); board.querySelector('[data-seg="unit"]').style.display = v === 'week' ? 'none' : ''; if (rec.inst) rec.inst.resize(); }
      rec.draw();
      goalTable(host, G, st);
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

  // 3.3 same-cohort view: share of each start month's clients under contract within 14 / 30 / 60 / 90 days or to date,
  // for all confirmed starts or split up to / above $250K (18 Nov 2026: the Explorer's budget groups, eligible counts on every bar)
  function cohortScene(main, D, ch, of) {
    const C = D.pace.cohorts, B = D.budgets, st = { w: '14', clock: 'start', range: '2026', grp: 'all' };
    const P = n => C.clocks[n].pooled, ps = P('start'), pw = P('won');
    const cmp = (a, b) => (Math.abs(a - b) < 0.02 ? 'about the same as' : a > b ? 'up from' : 'down from');
    const b14 = ps.w14.before, a14 = ps.w14.after, b30 = ps.w30.before, a30 = ps.w30.after;
    const old = C.clocks.start.rows.filter(r => r.uc_dates_incomplete), oldN = old.reduce((a, r) => a + r.n, 0), oldK = old.reduce((a, r) => a + r.closed_no_uc, 0);
    const BG = Object.fromEntries(B.groups.map(g => [g.label, g])), LO = 'Up to $250K', HI = 'Above $250K', mh14 = B.mh.uc.find(x => x.w === 14);
    const pts = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)} pts`;
    const body = S.scene(main, { ch, step: 3, of, label: 'Are newer clients faster?',
      title: `First 14 days: ${S.pct(a14.share)} of starters since June went under contract, ${cmp(a14.share, b14.share)} ${S.pct(b14.share)} before; by day 30, ${S.pct(a30.share)}, ${cmp(a30.share, b30.share)} ${S.pct(b30.share)}` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num"><span class="from">${S.pct(b14.share)}</span><span class="ar2">→</span>${S.pct(a14.share)}</span><span class="l"><i style="background:var(--uc)"></i>under contract within 14 days: ${span(b14)} → ${span(a14)} start months (${b14.k} of ${S.int(b14.n)} → ${a14.k} of ${S.int(a14.n)})</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(b30.share)}</span><span class="ar2">→</span>${S.pct(a30.share)}</span><span class="l"><i style="background:var(--uc)"></i>within 30 days: ${span(b30)} → ${span(a30)} (${b30.k} of ${S.int(b30.n)} → ${a30.k} of ${S.int(a30.n)})</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(BG[LO].uc14.k / BG[LO].uc14.eligible, 1)}</span><span class="ar2">vs</span>${S.pct(BG[HI].uc14.k / BG[HI].uc14.eligible, 1)}</span><span class="l"><i style="background:linear-gradient(90deg,var(--b-lo) 50%,var(--b-hi) 50%)"></i>within 14 days, up to vs above $250K (${BG[LO].uc14.k} of ${BG[LO].uc14.eligible}, ${BG[HI].uc14.k} of ${BG[HI].uc14.eligible}); like for like ${pts(mh14.diff)}</span></div>
      </div>
      <div class="board" id="cohBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('grp', 'Clients', [['all', 'All starts'], ['bud', 'Up to vs above $250K']], 'all')}${S.ui.seg('w', 'Window', [['14', 'Within 14 days'], ['30', '30'], ['60', '60'], ['90', '90'], ['todate', 'To date']], '14', 'only-chart')}${S.ui.seg('clock', 'Clock', [['start', 'From client start'], ['won', 'From won date']], 'start', 'hide-bud')}${S.ui.seg('range', 'Months shown', [['2026', '2026'], ['all', 'Since Jan 2025']], '2026', 'only-table hide-bud')}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-coh" id="cohChart" role="img" aria-label="Share of each 2026 start month's clients under contract within 14 days: ${C.clocks.start.rows.filter(r => r.month >= C.compare_from && r.w14.eligible).map(r => `${S.monShort(r.month)} ${r.w14.k} of ${r.w14.eligible}`).join(', ')}. Up to $250K vs above, by month: ${B.months.filter(m => m[LO].w14.eligible).map(m => `${S.monShort(m.month)} ${m[LO].w14.k} of ${m[LO].w14.eligible} vs ${m[HI].w14.k} of ${m[HI].w14.eligible}`).join(', ')}."></div>
          <div class="legend hide-bud"><span><i style="background:var(--uc)"></i>Every client in the month has had the full window</span><span><i class="hatch-uc"></i>Maturing: share so far</span><span id="cohAvg"></span><span><i class="line" style="background:var(--sales)"></i>Late May changes</span></div>
          <div class="legend only-bud"><span><i style="background:var(--b-lo)"></i>Up to $250K</span><span><i style="background:var(--b-hi)"></i>Above $250K</span><span>Each bar: under contract of eligible clients (the count under the month)</span><span>Hatched: maturing</span></div>
          <p class="bnote only-bud" id="cohBud"></p></div>
        <div class="pv-table tw" id="cohTable"></div>
        <div class="links">${S.ui.xl('#cohorts?preset=0', 'Explorer: Jul–Sep starts by budget in the cohort builder')}${S.ui.xl('#budget', 'Explorer: budget performance')}</div>
      </div>
      ${changeNote(D)}
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">The measure</p><p>Each start month's confirmed starts (won deals with a Jira start, ${S.int(D.speed.estimate.n)} in all) and how many reached Under Contract within 14, 30, 60 or 90 days of their start: <code>SUM(uc_within_Nd × eligible_Nd) ÷ SUM(eligible_Nd)</code>, the Explorer's matured-cohort rule. A window is <b>maturing</b> while some of the month's clients have had fewer than N days; the chart then shows the share so far. Under Contract is the latest valid contract. Refunded clients stay in (${S.int(C.refunded_included)}).</p>
         <p class="ex-h">Comparable months</p><p>Months whose whole window has passed, from January 2026: ${span(b14)} 2026 before the late-May changes, June 2026 on after. 2025 start months are in the table but not compared: ${S.int(oldK)} of their ${S.int(oldN)} clients closed without an Under Contract date. Cells resting on fewer than 5 clients are marked <sup>s</sup>.</p>
         <p class="ex-h">By budget</p><p>Upper end of the onboarding-form range (all-in capital), matched for ${S.int(B.coverage.matched)} confirmed starts since the form went live on ${S.date(B.form_since)}, on the client-start clock. Each month holds 0 to ${Math.max(...B.months.map(m => Math.max(m[LO].w14.k, m[HI].w14.k)))} contracts per group within 14 days, so single months swing; the pooled shares and the like-for-like difference (same start month, client experience and start rule: ${pts(mh14.diff)}, 95% ${pts(mh14.lo)} to ${pts(mh14.hi)}) are the comparison to quote.</p>`,
        `<p class="ex-h">Two clocks</p><p><b>From client start</b> (the reporting rule): before June the start is the kickoff, a median ${S.d1(C.kickoff_lag_median)} days after the sale; from 1 June it is the won date. So clients since June get about ${S.d1(C.kickoff_lag_median)} fewer search days inside the same window, which works against the newer months.</p>
         <p><b>From won date</b> counts every month from the sale. It removes that shift, but since 27 May clients meet Acquisitions in the Confidence Call before they buy, so part of their search can start before the won date. The true change in the first two weeks lies between the two readings: ${S.pct(b14.share)} → ${S.pct(a14.share)} and ${S.pct(pw.w14.before.share)} → ${S.pct(pw.w14.after.share)}.</p>`,
      ])}
      <p class="cap">Confirmed starts by start month · bars show the selected window · the table shows every window with its numerator and eligible clients · the first 14 days also bring refunds: see 3.5.</p>`;
    const board = S.$('#cohBoard', body), node = S.$('#cohChart', body), host = S.$('#cohTable', body);
    const cellOf = (r, w) => (w === 'todate' ? { k: r.to_date.k, el: r.to_date.n, mature: true, small: r.to_date.small } : { k: r[`w${w}`].k, el: r[`w${w}`].eligible, mature: r[`w${w}`].mature, small: r[`w${w}`].small });
    const budRows = () => B.months.filter(m => m.month >= '2026-05');
    const rec = S.chart(node, t => {
      if (st.grp === 'bud') {
        const w = st.w === 'todate' ? '14' : st.w, rows = budRows(), col = { [LO]: t.blo, [HI]: t.bhi }, lt = { [LO]: t.wait2, [HI]: t.closed2 };
        const val = (m, g) => (m[g][`w${w}`].eligible ? (100 * m[g][`w${w}`].k) / m[g][`w${w}`].eligible : null);
        const ymax = Math.max(20, Math.ceil(Math.max(...rows.flatMap(m => [val(m, LO) || 0, val(m, HI) || 0])) / 10) * 10 + 10);
        return Object.assign(S.base(t), {
          grid: { left: 8, right: 14, top: 30, bottom: 8, containLabel: true },
          tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const m = rows[p.dataIndex], g = p.seriesName, c = m[g][`w${w}`];
            return `<b>${m.label} starters · ${g}</b><br>${c.eligible ? `Under contract within ${w} days: <b>${c.k} of ${c.eligible}</b> (${S.pct(c.k / c.eligible)})${c.mature ? '' : `<br><span style="color:${t.muted}">Maturing: ${c.eligible} of ${m[g].n} have had ${w} days</span>`}` : `No client has had ${w} days yet`}`; } }),
          xAxis: { type: 'category', data: rows.map(m => m.month), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
            axisLabel: { color: t.label, fontSize: 12.5, lineHeight: 16, formatter: (mm, i) => { const m = rows[i]; return `{b|${S.monShort(mm).replace(/ ’\d\d/, '')}}\n{e|${m[LO][`w${w}`].eligible} · ${m[HI][`w${w}`].eligible} eligible}`; },
              rich: { b: { color: t.ink2, fontWeight: 600, fontSize: 13 }, e: { color: t.muted, fontSize: 11 } } } },
          yAxis: S.valAxis(t, { max: ymax, axisLabel: { color: t.label, fontSize: 12, formatter: v => v + '%' } }),
          series: [LO, HI].map(g => ({ name: g, type: 'bar', barGap: '10%', barCategoryGap: '34%',
            data: rows.map(m => { const c = m[g][`w${w}`]; return { value: val(m, g) == null ? 0 : val(m, g), itemStyle: { color: c.mature ? col[g] : S.stripes(col[g], lt[g]), borderColor: col[g], borderWidth: c.mature ? 0 : 1, borderRadius: [4, 4, 0, 0] } }; }),
            label: { show: true, position: 'top', distance: 3, fontSize: 12, fontWeight: 700, color: t.ink, formatter: p => { const c = rows[p.dataIndex][g][`w${w}`]; return c.eligible ? `${c.k}/${c.eligible}` : '–'; } } })),
        });
      }
      const rows = C.clocks[st.clock].rows.filter(r => r.month >= C.compare_from), n = rows.length, w = st.w;
      const ci = rows.findIndex(r => r.month === C.change_month), pool = w === 'todate' ? null : C.clocks[st.clock].pooled[`w${w}`];
      const pt = rows.map(r => { const c = cellOf(r, w); return { c, v: c.el ? (100 * c.k) / c.el : null }; });
      const idx = m => rows.findIndex(r => r.month === m);
      const ref = p => (p && p.months ? [[{ coord: [idx(p.months[0]) - 0.42, p.share * 100] }, { coord: [idx(p.months[1]) + 0.42, p.share * 100] }]] : []);
      const ymax = Math.max(20, Math.ceil(Math.max(...pt.map(p => p.v || 0), pool ? pool.after.share * 100 : 0, pool ? pool.before.share * 100 : 0) / 10) * 10 + 10);
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 14, top: 30, bottom: 8, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => {
          const r = rows[p.dataIndex], c = pt[p.dataIndex].c, wl = w === 'todate' ? 'to date' : `within ${w} days`;
          if (!c.el) return `<b>${r.label} starters</b> · ${S.int(r.n)} clients<br>No client has had ${w} days yet`;
          return `<b>${r.label} starters</b> · ${S.int(r.n)} clients<br>Under contract ${wl}: <b>${c.k} of ${c.el}</b> (${S.pct(c.k / c.el)})`
            + (c.mature ? '' : `<br><span style="color:${t.muted}">Maturing: ${c.el} of ${r.n} clients have had ${w} days</span>`)
            + (c.small ? `<br><span style="color:${t.muted}">Fewer than 5: one client moves this by ${S.pct(1 / c.el)}</span>` : '');
        } }),
        xAxis: [{ type: 'category', data: rows.map(r => r.month), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
          axisLabel: { color: t.label, fontSize: 12.5, lineHeight: 16, formatter: (mm, i) => { const c = pt[i].c; return `{b|${S.monShort(mm)}}\n{e|${c.el ? c.el + ' eligible' : 'too recent'}}`; },
            rich: { b: { color: t.label, fontSize: 12.5 }, e: { color: t.muted, fontSize: 11 } } } },
          { type: 'value', min: -0.5, max: n - 0.5, show: false }],
        yAxis: S.valAxis(t, { max: ymax, axisLabel: { color: t.label, fontSize: 12, formatter: v => v + '%' } }),
        series: [
          { type: 'bar', barWidth: '58%', z: 3, data: pt.map(p => ({ value: p.v == null ? 0 : p.v,
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
      const W = ['14', '30', '60', '90'];
      if (st.grp === 'bud') {
        const c = (m, g, w) => { const x = m[g][`w${w}`]; if (!x.eligible) return '<span class="nc" title="No client has had the full window yet">–</span>';
          const sm = x.k > 0 && x.k < 5 ? '<sup title="Fewer than 5 clients">s</sup>' : '';
          return x.mature ? `${S.pct(x.k / x.eligible)}${sm}<small>${x.k} of ${x.eligible}</small>` : `<span class="mat">${S.pct(x.k / x.eligible)} so far${sm}</span><small>${x.k} of ${x.eligible} eligible</small>`; };
        S.ui.table(host, [{ k: 'month', label: 'Start month', html: m => m.label },
          ...[LO, HI].flatMap(g => [{ k: g + 'n', label: `${g}<small>clients</small>`, num: true, sv: m => m[g].n, html: m => S.int(m[g].n) },
            ...W.map(w => ({ k: g + w, label: w === '14' ? '<b>14 days</b>' : `${w} days`, num: true, sv: m => (m[g][`w${w}`].eligible ? m[g][`w${w}`].k / m[g][`w${w}`].eligible : null), html: m => c(m, g, w) }))])],
        B.months.slice().reverse(), { caption: 'Under Contract within 14, 30, 60 and 90 days by start month, up to and above $250K',
          head: `<tr class="sup"><th></th><th colspan="5">Up to $250K</th><th colspan="5">Above $250K</th></tr>`,
          total: [Object.assign({ label: '<b>All matched starts</b>' }, ...[LO, HI].map(g => ({ [g]: Object.assign({ n: BG[g].n }, ...W.map(w => ({ [`w${w}`]: Object.assign({ mature: true }, BG[g][`uc${w}`]) }))) })))],
          notes: `<span><b>s</b>fewer than 5 clients. Pooled within 14 days: ${LO} ${S.pct(BG[LO].uc14.k / BG[LO].uc14.eligible, 1)} (${BG[LO].uc14.k} of ${BG[LO].uc14.eligible}), ${HI} ${S.pct(BG[HI].uc14.k / BG[HI].uc14.eligible, 1)} (${BG[HI].uc14.k} of ${BG[HI].uc14.eligible}); like for like ${pts(mh14.diff)} (95% ${pts(mh14.lo)} to ${pts(mh14.hi)}, ${mh14.strata} strata).</span>` });
        const tf = host.querySelector('tfoot tr'); if (tf) tf.children[0].innerHTML = '<b>All matched starts</b>';
        return;
      }
      const rows = C.clocks[st.clock].rows, pool = C.clocks[st.clock].pooled;
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
      const w = st.w === 'todate' ? '14' : st.w, a = BG[LO][`uc${w}`], b = BG[HI][`uc${w}`], m = B.mh.uc.find(x => x.w === +w);
      S.$('#cohBud', body).innerHTML = `Within ${w} days, all matched months: <b>${LO} ${S.pct(a.k / a.eligible, 1)}</b> (${a.k} of ${a.eligible}) against <b>${HI} ${S.pct(b.k / b.eligible, 1)}</b> (${b.k} of ${b.eligible}). Like for like (same start month, client experience and start rule): ${pts(m.diff)}, 95% ${pts(m.lo)} to ${pts(m.hi)}${m.lo < 0 && m.hi > 0 ? ': no measurable difference' : ''}.`;
    };
    avg();
    table();
    S.ui.wire(board, (name, v) => {
      st[name] = v;
      if (name === 'grp') { board.classList.toggle('m-bud', v === 'bud'); const td = board.querySelector('[data-seg="w"] [data-v="todate"]'); td.hidden = v === 'bud'; if (v === 'bud' && st.w === 'todate') { st.w = '14'; board.querySelectorAll('[data-seg="w"] button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === '14'))); } }
      if (name !== 'range') { rec.draw(); avg(); }
      if (name !== 'w') table();
    });
  }

  // 3.4 the first 14 days: under contract vs refunded within 14 (or 30) days of the start, by start month, on the same eligible clients
  function firstScene(main, D, ch, of) {
    const F = D.pace.first14, B = D.budgets, st = { grp: 'all', w: '14', range: '2026' }, LO = 'Up to $250K', HI = 'Above $250K';
    const sc = F.since_change, BG = Object.fromEntries(B.groups.map(g => [g.label, g]));
    const r30 = F.rows.filter(r => r.month >= '2026-06' && r.el30);
    const ye = F.year_end_2025, more = sc.rf14 > sc.uc14;
    const rowsFor = () => {
      if (st.grp === 'all') return F.rows.filter(r => (st.range === 'all' || r.month >= F.compare_from)).map(r => ({ month: r.month, label: r.label, n: r.n, el: r[`el${st.w}`], uc: r[`uc${st.w}`], rf: r[`rf${st.w}`], dim: r.uc_dates_incomplete, mature: r[`el${st.w}`] === r.n }));
      return B.months.filter(m => m.month >= '2026-05').map(m => { const g = m[st.grp]; return { month: m.month, label: m.label, n: g.n, el: g[`w${st.w}`].eligible, uc: g[`w${st.w}`].k, rf: g[`rf${st.w}`].k, mature: g[`w${st.w}`].eligible === g.n }; });
    };
    const body = S.scene(main, { ch, step: 4, of, label: 'The first 14 days',
      title: more ? `In their first 14 days, more clients since June were refunded (${sc.rf14}) than went under contract (${sc.uc14})` : `In their first 14 days since June, ${sc.uc14} clients went under contract and ${sc.rf14} were refunded` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num">${S.int(sc.uc14)}<span class="of">of ${S.int(sc.el14)}</span></span><span class="l"><i style="background:var(--uc)"></i>under contract within 14 days (${S.pct(sc.uc14 / sc.el14, 1)}), ${span(sc)} 2026 starts ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.int(sc.rf14)}<span class="of">of ${S.int(sc.el14)}</span></span><span class="l"><i style="background:var(--refund)"></i>refunded within 14 days (${S.pct(sc.rf14 / sc.el14, 1)}): the same clients, the same clock</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(r30[0].rf30 / r30[0].el30)}</span><span class="ar2">→</span>${S.pct(r30[r30.length - 1].rf30 / r30[r30.length - 1].el30)}</span><span class="l"><i style="background:var(--refund)"></i>refunded within 30 days: ${r30[0].label.slice(0, 3)} → ${r30[r30.length - 1].label.slice(0, 3)} starters (${r30.map(r => `${r.label.slice(0, 3)} ${r.rf30} of ${r.el30}`).join(', ')})</span></div>
      </div>
      <div class="board" id="f14Board">
        <div class="ptools"><div class="pl">${S.ui.seg('grp', 'Clients', [['all', 'All starts'], [LO, LO], [HI, HI]], 'all')}${S.ui.seg('w', 'Window', [['14', 'Within 14 days'], ['30', 'Within 30 days']], '14')}${S.ui.seg('range', 'Months shown', [['2026', '2026'], ['all', 'Since Jan 2025']], '2026', 'hide-bud')}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-f14" id="f14Chart" role="img" aria-label="By start month, under contract and refunded within 14 days of the start, of eligible clients: ${F.rows.filter(r => r.month >= F.compare_from && r.el14).map(r => `${S.monShort(r.month)} ${r.uc14} under contract, ${r.rf14} refunded of ${r.el14}`).join('; ')}."></div>
          <div class="legend"><span><i style="background:var(--uc)"></i>Under contract within the window</span><span><i style="background:var(--refund)"></i>Refunded within the window</span><span>Under each month: clients with the full window (eligible)</span><span><i class="hatch-r"></i>Maturing: some clients have not had the full window</span></div>
          <p class="bnote only-bud" id="f14Bud"></p></div>
        <div class="pv-table tw" id="f14Table"></div>
        <p class="call"><span class="call-h">Why it matters</span>Refunds come early: a median ${S.int(D.outcomes.status.refunded.median_days)} days after the start, and ${S.int(D.outcomes.status.refunded.from_client_start)} refunded clients never reached their two-week check-in. The 30-day refund rate has risen with each start month since July. ${ye && ye.oct25 ? `A year earlier, October 2025 starters also refunded more often within 30 days (${ye.oct25.k} of ${ye.oct25.n}, ${S.pct(ye.oct25.k / ye.oct25.n)}) than January–September 2025 starters (${ye.rest25.k} of ${ye.rest25.n}, ${S.pct(ye.rest25.k / ye.rest25.n)}), consistent with refunds rising toward year-end; this year the rise is larger and began in September.` : ''} Up to $250K clients refund more often early (section 5.3), but the rise is in both groups.</p>
      </div>
      ${changeNote(D)}
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Same clients, same clock</p><p>For each start month, the confirmed starts with at least 14 (or 30) days since their client start date are <b>eligible</b>. Under contract within the window = latest valid Under Contract date − start ≤ the window (the cohort rule in 3.4, so the counts equal its table). Refunded within the window = refund date − start ≤ the window. A client can be in both (a contract that fell through, then a refund); that is rare.</p>
         <p>Since June the start is the won date, so 14 days means 14 days after the sale. The refund date is when the refund was recorded.</p>`,
        `<p class="ex-h">Reading the months</p><p>The latest month is <b>maturing</b> at 30 days (some clients have had fewer), so its share can still rise. 2025 months are context: their Under Contract dates are incomplete and few refunds were recorded, so they are dimmed and not compared. By budget, the comparison covers May–October 2026 starts with a matched onboarding answer; pooled: ${LO} ${BG[LO].uc14.k} under contract and ${BG[LO].rf14.k} refunded within 14 days of ${BG[LO].uc14.eligible}; ${HI} ${BG[HI].uc14.k} and ${BG[HI].rf14.k} of ${BG[HI].uc14.eligible}.</p>`,
      ])}
      <p class="cap">Confirmed starts by start month · bars = share of eligible clients · under contract (blue) and refunded (orange) on the same denominator · the eligible count is under each month.</p>`;
    const node = S.$('#f14Chart', body), host = S.$('#f14Table', body), board = S.$('#f14Board', body);
    const rec = S.chart(node, t => {
      const rows = rowsFor();
      const ymax = Math.max(15, Math.ceil(Math.max(...rows.flatMap(r => (r.el ? [100 * r.uc / r.el, 100 * r.rf / r.el] : [0]))) / 5) * 5 + 5);
      const item = (r, k, c, c2) => ({ value: r.el ? (100 * r[k]) / r.el : 0, itemStyle: { color: r.mature ? c : S.stripes(c, c2), borderColor: c, borderWidth: r.mature ? 0 : 1, borderRadius: [4, 4, 0, 0], opacity: r.dim ? 0.45 : 1 } });
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 14, top: 26, bottom: 8, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } }, formatter: ps => {
          const r = rows[ps[0].dataIndex];
          if (!r.el) return `<b>${r.label} starters</b> · ${S.int(r.n)}<br>No client has had ${st.w} days yet`;
          return `<b>${r.label} starters${st.grp === 'all' ? '' : ' · ' + st.grp}</b> · ${S.int(r.el)} of ${S.int(r.n)} eligible<br>Under contract within ${st.w} days: <b>${r.uc}</b> (${S.pct(r.uc / r.el, 1)})<br>Refunded within ${st.w} days: <b>${r.rf}</b> (${S.pct(r.rf / r.el, 1)})${r.dim ? `<br><span style="color:${t.muted}">2025: Under Contract dates incomplete</span>` : ''}`;
        } }),
        xAxis: { type: 'category', data: rows.map(r => r.month), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
          axisLabel: { color: t.label, fontSize: 12.5, lineHeight: 16, interval: 0, formatter: (mm, i) => `{b|${S.monShort(mm)}}\n{e|${rows[i].el ? rows[i].el : 'too recent'}}`, rich: { b: { color: t.ink2, fontWeight: 600, fontSize: 12.5 }, e: { color: t.muted, fontSize: 11 } } } },
        yAxis: S.valAxis(t, { max: ymax, axisLabel: { color: t.label, fontSize: 12, formatter: v => v + '%' } }),
        series: [['uc', 'Under contract', t.uc, t.uc2], ['rf', 'Refunded', t.refund, t.refund2]].map(([k, l, c, c2]) => ({ name: l, type: 'bar', barGap: '8%', barCategoryGap: rows.length > 14 ? '22%' : '32%',
          data: rows.map(r => item(r, k, c, c2)),
          label: { show: rows.length <= 14, position: 'top', distance: 3, fontSize: 12, fontWeight: 700, color: t.ink, formatter: p => { const r = rows[p.dataIndex]; return r.el ? String(r[k]) : ''; } } })),
      });
    });
    const table = () => {
      const rows = rowsFor().slice().reverse();
      S.ui.table(host, [
        { k: 'label', label: 'Start month', html: r => `${r.label}${r.dim ? '<sup title="2025: Under Contract dates incomplete">u</sup>' : ''}${!r.mature && r.el ? '<small>maturing</small>' : ''}` },
        { k: 'n', label: 'Clients', num: true, html: r => S.int(r.n) },
        { k: 'el', label: `Eligible (${st.w}+ days)`, num: true, html: r => S.int(r.el) },
        { k: 'uc', label: `Under contract within ${st.w} days`, num: true, sv: r => (r.el ? r.uc / r.el : null), html: r => (r.el ? `${S.pct(r.uc / r.el, 1)}<small>${r.uc} of ${r.el}</small>` : '–') },
        { k: 'rf', label: `Refunded within ${st.w} days`, num: true, sv: r => (r.el ? r.rf / r.el : null), html: r => (r.el ? `${S.pct(r.rf / r.el, 1)}<small>${r.rf} of ${r.el}</small>` : '–') },
      ], rows.map(r => Object.assign({ _cls: r.dim ? 'dim' : '' }, r)), { caption: 'Under contract and refunded within the first days, by start month',
        notes: `<span>${st.grp === 'all' ? 'All confirmed starts.' : st.grp + ', matched onboarding budget.'} <b>u</b> 2025 months: Under Contract dates incomplete, context only.</span>` });
    };
    const bud = () => {
      const g = st.grp === 'all' ? null : BG[st.grp], w = st.w;
      S.$('#f14Bud', body).innerHTML = g ? `${st.grp}, all matched months: <b>${g[`uc${w}`].k}</b> under contract and <b>${g[`rf${w}`].k}</b> refunded within ${w} days, of ${g[`uc${w}`].eligible} eligible (${S.pct(g[`uc${w}`].k / g[`uc${w}`].eligible, 1)} and ${S.pct(g[`rf${w}`].k / g[`rf${w}`].eligible, 1)}).` : '';
    };
    bud();
    table();
    S.ui.wire(board, (name, v) => { st[name] = v; board.classList.toggle('m-bud', st.grp !== 'all'); rec.draw(); table(); bud(); });
  }

  S.chapter('pace', {
    n: 3, title: 'Are we keeping pace?',
    order: ['pace-5', 'pace-1', 'pace-2', 'pace-3', 'pace-4'],       // displayed order; ids are stable keys (deep links)
    render(main, D, ch) {
      const pc = D.pace, w = pc.windows, co = pc.cohort, sc = pc.intake.since_change, asof = D.meta.asof, OF = 5;
      const last = pc.monthly[pc.monthly.length - 1], since = S.date(pc.change_date).replace(/ \d{4}$/, '');

      // 3.1 (moved to the front of the chapter on 18 Nov 2026; its id pace-5 is kept so every earlier link still works): what enters Jira
      let body = S.scene(main, { ch, step: 5, of: OF, label: 'What enters Jira',
        title: `Jira intake jumped from about ${r10(w.intake.before)} to ${r10(w.intake.after)} a month: issues now open before the sale` });
      body.innerHTML = `<div class="board">
          <div class="chart h-l" id="intakeChart" role="img" aria-label="New Jira issues per month from ${pc.intake.monthly[0].label} to ${last.label}, by where each issue stands today. Before ${since} 2026 almost every issue is a signed client; from June 2026 intake rises to between ${Math.min(...w.after.map(m => pc.intake.monthly.find(r => r.month === m).total))} and ${Math.max(...w.after.map(m => pc.intake.monthly.find(r => r.month === m).total))} a month, most of them prospects."></div>
          <div class="tally">
            <div class="tally-h">Opened since ${since}: <b class="num">${S.int(sc.total)}</b> issues, by where they stand today</div>
            <div class="tally-bar" aria-hidden="true">${KEYS.map(x => `<i class="${x.cls}" style="flex:${sc[x.k]} 1 0"></i>`).join('')}</div>
            <div class="tally-keys">${KEYS.map(x => `<div class="tk"><span class="tk-v num">${S.int(sc[x.k])}</span><span class="tk-t"><i class="${x.cls}"></i>${x.k === 'signed' ? 'Signed clients' : x.name}</span><span class="tk-s">${S.pct(sc[x.k] / sc.total)} · ${x.sub}</span></div>`).join('')}</div>
          </div></div>
        ${changeNote(D)}
        <p class="cap">New issues by month created, coloured by where each stands today, not by what happened that month · ${r10(w.intake.before)} → ${r10(w.intake.after)}: average of the five full months either side of ${since} · the pre-sale prospects here are not clients yet, so they are outside every count in chapters 2–4.</p>`;
      intake(S.$('#intakeChart', body), pc, asof);

      // 3.2 the 100-a-month goal
      goalScene(main, D, ch, OF);

      // 3.3 (reworked 18 Nov 2026): the question, the three numbers that matter, the paired chart with marks explained beside it, then the detail
      const g = pc.gap, gr = pc.growth, full = gr.rows.filter(r => !r.partial), lf = full[full.length - 1], pr = gr.rows.find(r => r.partial);
      const mrow = Object.fromEntries(pc.monthly.map(r => [r.month, r])), pk = mrow[g.peak_months[g.peak_months.length - 1]], day = new Date(asof + 'T12:00:00').getDate();
      const prevNeg = pc.monthly.filter(r => r.month >= g.from && !r.partial && r.gap < 0).slice(-1)[0];
      const trail = [pk.gap, ...g.tail.map(t => t.gap)].map(v => (v > 0 ? '+' : '') + v).join(' → ');
      const marks = [{ n: 1, month: pk.month }, { n: 2, month: lf.month }, ...(pr ? [{ n: 3, month: pr.month }] : [])];
      const lead = (r, w) => (r.gap > 0 ? `${r.gap} more searches started than contracts were signed` : r.gap < 0 ? `${-r.gap} more contracts were signed than searches started` : 'starts and contracts were level');
      body = S.scene(main, { ch, step: 2, of: OF, label: 'Starts vs contracts',
        title: lf.diff > 0 && pr && pr.diff < 0 ? `Starts led contracts by less each month, from +${pk.gap} in ${fullMon(pk.month)} to +${lf.diff} in ${fullMon(lf.month)}; so far in ${fullMon(pr.month)} contracts lead by ${-pr.diff}`
          : lf.diff > 0 ? `Starts still outpace contracts${g.narrowing ? ', but by less each month' : ''}: ${phrase(lf.diff)} in ${fullMon(lf.month)}, against ${g.peak} in ${listMon(g.peak_months)}` : `Contracts caught up with starts in ${fullMon(lf.month)}: ${phrase(lf.diff)}` });
      body.innerHTML = `<div class="figs qf">
          <div class="fig"><span class="v num">${sgn(lf.diff)}</span><span class="l"><i style="background:var(--wait)"></i><b>${fullMon(lf.month)}:</b> ${lf.starts} searches started, ${lf.uc} went under contract ${S.ui.chip('flow')}</span></div>
          ${pr ? `<div class="fig"><span class="v num">${sgn(pr.diff)}</span><span class="l"><i style="background:var(--uc)"></i><b>1–${day} ${pr.label.slice(0, 3)} (partial month):</b> ${pr.starts} started, ${pr.uc} under contract ${S.ui.chip('flow')}</span></div>` : ''}
          <div class="fig status"><span class="v num">${S.int(gr.hunting)}</span><span class="l"><i style="background:var(--wait)"></i><b>Hunting on ${S.date(asof)}:</b> the clients searching now, a count by status, not movement in a month ${S.ui.chip('snap')}</span></div>
        </div>
        <div class="board" id="paceBoard">
          <div class="ptools"><div class="pl"><div class="legend legend-top only-chart" id="paceLegend">
            <button type="button" aria-pressed="true" data-s="${SERIES2[0]}"><i style="background:var(--wait)"></i>${SERIES2[0]}</button>
            <button type="button" aria-pressed="true" data-s="${SERIES2[1]}"><i style="background:var(--uc)"></i>${SERIES2[1]}</button>
          </div>${S.ui.seg('range', 'Months shown', [['2026', '2026'], ['all', 'Since Jan 2025']], '2026')}${S.ui.seg('growth', 'Growth', [['mom', 'Month on month'], ['yoy', 'Year on year']], 'mom', 'only-table')}</div><div class="pr">${S.ui.toggle()}</div></div>
          <div class="split">
            <div class="split-main">
              <div class="pv-chart"><div class="chart h-pace2" id="paceChart" role="img" aria-label="Searches started and Under Contract by month, with the difference below. ${pc.monthly.filter(r => r.month >= g.from).map(r => `${S.monShort(r.month)}${r.partial ? ' (1–' + day + ', partial)' : ''}: ${r.new} started, ${r.uc} under contract, ${sgn(r.gap)}`).join('; ')}."></div>
                <div class="legend"><span><i style="background:var(--wait)"></i>Amber: more searches started than contracts signed</span><span><i style="background:var(--uc)"></i>Blue: more contracts than starts</span><span><i class="hatch-uc"></i>Hatched and shaded: partial month, 1–${day} ${pr ? pr.label.slice(0, 3) : ''}</span><span><i class="line" style="background:var(--sales)"></i>Late May changes</span></div></div>
              <div class="pv-table tw" id="growthTable"></div>
            </div>
            <aside class="split-side" aria-label="How to read this chart">
              <div class="note"><span class="note-h">What to look at</span>
                <ol class="marks">
                  <li><i>1</i><div><b>${fullMon(pk.month)}: ${sgn(pk.gap)}.</b> ${pk.new} searches started and ${pk.uc} went under contract, the widest gap this year. Since 1 June a start is the sale date, so starts jumped with sales (3.2).</div></li>
                  <li><i>2</i><div><b>${fullMon(lf.month)}: ${sgn(lf.diff)}.</b> ${lf.starts} started, ${lf.uc} under contract. The gap has narrowed every month since ${fullMon(pk.month)}${g.narrowing ? ` (${trail})` : ''}: contracts are catching up.</div></li>
                  ${pr ? `<li><i>3</i><div><b>1–${day} ${pr.label.slice(0, 3)}: ${sgn(pr.diff)}.</b> ${pr.starts} started, ${pr.uc} under contract: ${lead(mrow[pr.month])}${prevNeg ? `, the first month with contracts ahead since ${fullMon(prevNeg.month)}` : ''}. Partial month: the last ${new Date(new Date(asof + 'T12:00:00').getFullYear(), new Date(asof + 'T12:00:00').getMonth() + 1, 0).getDate() - day} days are still to come.</div></li>` : ''}
                </ol></div>
              <div class="note"><span class="note-h">What the gap means</span><p><b style="color:var(--wait)">Positive</b>: more searches began than contracts were signed that month, so the pool of searching clients tends to grow. <b style="color:var(--uc)">Negative</b>: more contracts than starts, so it tends to shrink. The two counts are different clients (a contract often belongs to a search begun earlier), so a gap is a signal of direction, not a head count.</p></div>
              <div class="note status"><span class="note-h">The backlog is a status count ${S.ui.chip('snap')}</span><p><b class="num big">${S.int(gr.hunting)}</b> clients are hunting on ${S.date(asof)}, a median ${S.med(D.outcomes.status.hunting.median)} days since their start (${S.int(D.outcomes.status.hunting.with_start)} with a start date; section 2.2). Do not add the monthly gaps to reach it: they leave out pauses, refunds and restarts.</p></div>
            </aside>
          </div>
        </div>
        ${S.ui.ex('How is this number built?', [
          `<p class="ex-h">The two counts</p><p><b>Searches started</b> = confirmed client starts, dated by the client start date (from 1 June the Pipedrive won date, so starts and sales move together). <b>Under Contract</b> = clients by the date of their latest valid contract. Both are the reporting layer's daily_client_activity, the same daily counts as the Explorer's monthly table and the Won / Under Contract series in 3.2 (Won ${S.int(gr.rows.reduce((a, r) => a + r.won, 0))} since ${gr.rows[0].label}).</p>
           <p><b>Started − Under Contract</b> (the net client change) compares two counts in the same month. It is calendar throughput, never added up: the backlog is the hunting count, <b>${S.int(gr.hunting)}</b>.</p>`,
          `<p class="ex-h">Partial month and 2025</p><p>${pr ? `The latest month runs 1–${day} ${pr.label.slice(0, 3)}; it is hatched and shaded, and in the table it is compared with the same ${day} days of the previous month and the year before.` : ''} 2025 contract counts are understated (${S.int(D.pace.cohort.no_uc_date.y2025.k)} of ${S.int(D.pace.cohort.no_uc_date.y2025.n)} clients who started in 2025 closed without a contract date), so the gap strip starts in ${S.monShort(g.from)} and 2025 contract bars are faded.</p>
           <ul>${Object.entries(NOTE).map(([k, l]) => `<li><b>${l}</b> ${gr.reasons[k]}</li>`).join('')}</ul>`,
        ])}
        <p class="cap">Confirmed starts and latest-valid-contract dates by month · the Table view adds Pipedrive Won and month-on-month / year-on-year growth where both periods count the same way${last.partial ? ` · ${last.label.split(' ')[0]} runs to ${S.date(asof)}` : ''}.</p>`;
      const st2 = { range: '2026' };
      const rec = startsVsUc(S.$('#paceChart', body), pc, asof, st2, marks);
      body.querySelectorAll('#paceLegend button').forEach(b => b.addEventListener('click', () => {
        if (!rec.inst) return;
        rec.inst.dispatchAction({ type: 'legendToggleSelect', name: b.dataset.s });
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      }));
      const gt = S.$('#growthTable', body);
      const gs = { growth: 'mom', range: '2026' };
      growthTable(gt, gr, gs.growth, gs.range);
      S.ui.wire(S.$('#paceBoard', body), (name, v) => {
        gs[name] = v;
        if (name === 'range') { st2.range = v; rec.draw(); }
        growthTable(gt, gr, gs.growth, gs.range);
      });

      // 3.4 cohorts (with the budget split), 3.5 the first 14 days
      cohortScene(main, D, ch, OF);
      firstScene(main, D, ch, OF);

    },
  });
})();
