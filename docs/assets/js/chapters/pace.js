/* Chapter 4: are we keeping pace? Monthly inflow of new clients vs Under Contract and CLOSED events. */
(function () {
  'use strict';
  const S = window.S;
  const SERIES = ['New signed-up clients', 'Under Contract', 'CLOSED'];

  S.chapter('pace', {
    n: 3, title: 'Are we keeping pace?',
    render(main, D, ch) {
      const pc = D.pace, rows = pc.monthly, last = rows[rows.length - 1];
      const ci = rows.findIndex(r => r.month === pc.change_month);
      const body = S.scene(main, { ch, step: 1, of: 1, title: 'New clients in, contracts and closings out' });
      body.innerHTML = `<div class="board">
          <div class="chart h-xl" id="paceChart" role="img" aria-label="Monthly new signed-up clients, Under Contract and CLOSED events from ${rows[0].label} to ${last.label}."></div>
          <div class="legend" id="paceLegend">
            <button type="button" aria-pressed="true" data-s="${SERIES[0]}"><i style="background:var(--hold-2)"></i>New signed-up clients</button>
            <button type="button" aria-pressed="true" data-s="${SERIES[1]}"><i class="line" style="background:var(--uc)"></i>Under Contract</button>
            <button type="button" aria-pressed="true" data-s="${SERIES[2]}"><i class="line" style="background:var(--closed)"></i>CLOSED</button>
          </div></div>
        <p class="cap">Monthly totals, not cohorts: a client reaching Under Contract may have started months earlier.${last.partial ? ` ${last.label.split(' ')[0]} runs to ${S.date(D.meta.asof)}.` : ''}</p>`;
      const rec = S.chart(S.$('#paceChart', body), t => Object.assign(S.base(t), {
        legend: { show: false, data: SERIES },
        grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, {
          axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } },
          formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.label}${r.partial ? ' (partial)' : ''}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: ${p.value}`).join('<br>'); },
        }),
        xAxis: { type: 'category', data: rows.map(r => S.monShort(r.month)), axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
          axisLabel: { color: t.label, fontSize: 12.5, interval: i => ['01', '04', '07', '10'].includes(rows[i].month.slice(5)) } },
        yAxis: S.valAxis(t),
        series: [
          { name: SERIES[0], type: 'bar', barWidth: '64%', data: rows.map(r => ({ value: r.new, itemStyle: { color: t.hold2, opacity: r.partial ? 0.45 : 1, borderRadius: [5, 5, 0, 0] } })),
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.sales, type: 'dashed', width: 1.8 },
              label: { position: 'end', formatter: 'Late May: Complete offer + Confidence Call', color: t.sales, fontWeight: 700, fontSize: 12.5 },
              data: ci > 0 ? [{ xAxis: ci - 0.5 }] : [] } },
          { name: SERIES[1], type: 'line', data: rows.map(r => r.uc), symbol: 'circle', symbolSize: 8, lineStyle: { color: t.uc, width: 3.2 }, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 1.5 } },
          { name: SERIES[2], type: 'line', data: rows.map(r => r.closed), symbol: 'circle', symbolSize: 8, lineStyle: { color: t.closed, width: 3.2 }, itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 1.5 } },
        ],
      }));
      body.querySelectorAll('#paceLegend button').forEach(b => b.addEventListener('click', () => {
        if (!rec.inst) return;
        rec.inst.dispatchAction({ type: 'legendToggleSelect', name: b.dataset.s });
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      }));
    },
  });
})();
