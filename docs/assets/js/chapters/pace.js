/* Chapter 3: are we keeping pace? Monthly input vs output, in two views.
   3.1 What enters Jira: every new Jira issue by the month it was created, coloured by where it stands today
       (signed client / still in pre-sale onboarding / Services Declined). Since 27 May 2026 Jira opens before the sale.
   3.2 Clients in, contracts out: signed clients by the month their acquisition clock started vs Under Contract and
       CLOSED events in the month they happened (the Explorer's Q3 chart), with the Explorer's same-cohort view on the
       same months underneath: of each month's starters, the share under contract within 90 days. */
(function () {
  'use strict';
  const S = window.S;
  const KEYS = [
    { k: 'signed', name: 'Signed client', cls: 'in-signed', sub: 'bought the service' },
    { k: 'presale', name: 'Still in pre-sale onboarding', cls: 'in-presale', sub: 'New Clients or Onboarding Completed' },
    { k: 'declined', name: 'Services Declined', cls: 'in-declined', sub: 'did not buy' },
  ];
  const SERIES = ['Signed clients starting acquisition', 'Under Contract that month', 'CLOSED that month'];
  const QUARTER = ['01', '04', '07', '10'];
  const r10 = v => Math.round(v / 10) * 10;
  const sw = bg => `<i style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;background:${bg}"></i>`;
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

  // 3.2 signed clients starting acquisition vs Under Contract / CLOSED events, with the 90-day cohort strip below
  function throughput(node, pc, asof) {
    const rows = pc.monthly, n = rows.length, ci = rows.findIndex(r => r.month === pc.change_month);
    const coh = Object.fromEntries(pc.cohort.rows.map(c => [c.month, c]));
    const strip = rows.map(r => (coh[r.month] && coh[r.month].share != null ? +(coh[r.month].share * 100).toFixed(1) : null));
    const shown = strip.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0);
    const pending = rows.map((r, i) => (coh[r.month] && !coh[r.month].mature ? i : -1)).filter(i => i >= 0);
    return S.chart(node, t => {
      const narrow = node.offsetWidth < 640, stripH = 58, L = 40, R = 14;
      const keep = i => !narrow || i === shown[0] || i === shown[shown.length - 1];
      return Object.assign(S.base(t), {
        legend: { show: false, data: SERIES },
        grid: [{ left: L, right: R, top: 34, bottom: stripH + 62 }, { left: L, right: R, bottom: 8, height: stripH }],
        axisPointer: { link: [{ xAxisIndex: [0, 2] }] },
        tooltip: Object.assign(S.base(t).tooltip, {
          axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } },
          formatter: ps => {
            const r = rows[ps[0].dataIndex], c = coh[r.month];
            let h = `<b>${r.label}${r.partial ? ` (to ${S.date(asof)})` : ''}</b><br>`
              + ps.filter(p => SERIES.includes(p.seriesName)).map(p => `${p.marker} ${p.seriesName}: <b>${p.value}</b>`).join('<br>');
            if (c && c.share != null) h += `<br><span style="color:${t.muted}">Of these starters, ${S.pct(c.share)} under contract within ${pc.cohort.days} days (${c.k} of ${c.n})</span>`;
            else if (c && !c.mature) h += `<br><span style="color:${t.muted}">Too recent for the ${pc.cohort.days}-day view</span>`;
            return h;
          },
        }),
        xAxis: [monthAxis(t, rows, { gridIndex: 0 }), between(rows, 0),
          monthAxis(t, rows, { gridIndex: 1, axisLabel: { show: false }, axisLine: { show: false } }), between(rows, 1)],
        yAxis: [S.valAxis(t, { gridIndex: 0 }), { type: 'value', gridIndex: 1, min: 0, max: 100, show: false }],
        graphic: [{ type: 'text', left: L, bottom: 8 + stripH / 2 - (narrow ? 22 : 14), silent: true,
          style: { text: narrow ? 'Of each month’s\nstarters: under contract\nwithin 90 days' : `Of each month’s starters:\nunder contract within ${pc.cohort.days} days`,
            fill: t.ink2, font: `600 ${narrow ? 11.5 : 13}px Figtree, system-ui, sans-serif`, lineHeight: narrow ? 15 : 18 } }],
        series: [
          { name: SERIES[0], type: 'bar', barWidth: '64%', xAxisIndex: 0, yAxisIndex: 0,
            data: rows.map(r => ({ value: r.new, itemStyle: { color: t.hold2, opacity: r.partial ? 0.45 : 1, borderRadius: [5, 5, 0, 0] } })) },
          { name: SERIES[1], type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: rows.map(r => r.uc), symbol: 'circle', symbolSize: 8,
            lineStyle: { color: t.uc, width: 3.2 }, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 1.5 } },
          { name: SERIES[2], type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: rows.map(r => r.closed), symbol: 'circle', symbolSize: 8,
            lineStyle: { color: t.closed, width: 3.2 }, itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 1.5 } },
          { type: 'line', xAxisIndex: 1, yAxisIndex: 0, data: [], silent: true,
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.sales, type: 'dashed', width: 1.8 },
              label: { position: 'end', formatter: narrow ? 'Late May changes' : 'Late May: Complete offer + Confidence Call', align: narrow ? 'right' : 'center', color: t.sales, fontWeight: 700, fontSize: narrow ? 11.5 : 12.5 },
              data: [{ xAxis: ci - 0.5 }] } },
          { name: 'cohort', type: 'line', xAxisIndex: 2, yAxisIndex: 1, data: strip, connectNulls: false, symbol: 'circle', symbolSize: narrow ? 7 : 9, showAllSymbol: true,
            lineStyle: { color: t.ink2, width: 1.5, opacity: 0.6 }, itemStyle: { color: t.ink2, borderColor: t.surface, borderWidth: 1.5 },
            label: { show: true, position: 'top', distance: 6, color: t.ink, fontWeight: 700, fontSize: narrow ? 11.5 : 12.5,
              formatter: p => (keep(p.dataIndex) && p.value != null ? Math.round(p.value) + '%' : '') } },
          { type: 'line', xAxisIndex: 3, yAxisIndex: 1, data: [], silent: true,
            markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: t.sales, type: 'dashed', width: 1.8 }, data: [{ xAxis: ci - 0.5 }] },
            markArea: { silent: true, itemStyle: { color: t.grid, opacity: 0.55 },
              label: { show: true, position: 'inside', color: t.muted, fontSize: narrow ? 11 : 12, lineHeight: 14, formatter: narrow ? 'too\nrecent' : 'too recent to tell' },
              data: pending.length ? [[{ xAxis: pending[0] - 0.5 }, { xAxis: pending[pending.length - 1] + 0.5 }]] : [] } },
        ],
      });
    });
  }

  S.chapter('pace', {
    n: 3, title: 'Are we keeping pace?',
    render(main, D, ch) {
      const pc = D.pace, w = pc.windows, co = pc.cohort, sc = pc.intake.since_change, asof = D.meta.asof;
      const last = pc.monthly[pc.monthly.length - 1], since = S.date(pc.change_date).replace(/ \d{4}$/, '');

      // 3.1
      let body = S.scene(main, { ch, step: 1, of: 2, label: 'What enters Jira',
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

      // 3.2
      body = S.scene(main, { ch, step: 2, of: 2, label: 'Clients in, contracts out',
        title: `Acquisition starts rose from ${Math.round(w.starts.before)} to ${Math.round(w.starts.after)} a month; about ${Math.round(co.pooled_after * 10)} in 10 still reach Under Contract within ${co.days} days` });
      body.innerHTML = `<div class="board">
          <div class="legend legend-top" id="paceLegend">
            <button type="button" aria-pressed="true" data-s="${SERIES[0]}"><i style="background:var(--hold-2)"></i>${SERIES[0]}</button>
            <button type="button" aria-pressed="true" data-s="${SERIES[1]}"><i class="line" style="background:var(--uc)"></i>${SERIES[1]}</button>
            <button type="button" aria-pressed="true" data-s="${SERIES[2]}"><i class="line" style="background:var(--closed)"></i>${SERIES[2]}</button>
          </div>
          <div class="chart h-xxl" id="paceChart" role="img" aria-label="Monthly signed clients starting acquisition, Under Contract and CLOSED events from ${pc.monthly[0].label} to ${last.label}. Below, the share of each month's starters under contract within ${co.days} days: ${co.rows.filter(c => c.share != null).map(c => `${S.monShort(c.month)} ${S.pct(c.share)}`).join(', ')}."></div></div>
        <p class="cap">Starts are dated by the acquisition clock, not the purchase · contracts and closings count in the month they happen, often for earlier starters · ${Math.round(w.starts.before)} → ${Math.round(w.starts.after)}: five-month averages${last.partial ? ` · ${last.label.split(' ')[0]} runs to ${S.date(asof)}` : ''}.</p>`;
      const rec = throughput(S.$('#paceChart', body), pc, asof);
      body.querySelectorAll('#paceLegend button').forEach(b => b.addEventListener('click', () => {
        if (!rec.inst) return;
        rec.inst.dispatchAction({ type: 'legendToggleSelect', name: b.dataset.s });
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      }));
    },
  });
})();
