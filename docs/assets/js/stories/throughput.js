/* Operational throughput: how many clients enter -> how many reach milestones -> what that says about flow. */
(function () {
  'use strict';
  const R = window.R;

  function flowChart(node, th, meta) {
    const rows = th.monthly;
    R.chart(node, t => {
      const o = R.base(t);
      const cats = rows.map(r => R.monShort(r.month));
      const changeIdx = rows.findIndex(r => r.month === meta.post_change_first_month);
      return Object.assign(o, {
        grid: { left: 8, right: 14, top: 30, bottom: 8, containLabel: true },
        tooltip: Object.assign(o.tooltip, {
          axisPointer: { type: 'shadow' },
          formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.label}${r.partial ? ' (to ' + R.date(meta.asof) + ')' : ''}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: ${p.value}`).join('<br>'); },
        }),
        xAxis: R.catAxis(t, cats, { axisLabel: { color: t.label, fontSize: 11.5, interval: i => ['01', '04', '07', '10'].includes(rows[i].month.slice(5)) } }),
        yAxis: R.valAxis(t),
        series: [
          { name: 'New signed-up clients', type: 'bar', barWidth: '62%', data: rows.map(r => ({ value: r.new, itemStyle: { color: t.neutral2, opacity: r.partial ? 0.5 : 1, borderRadius: [3, 3, 0, 0] } })),
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.gold, type: 'dashed', width: 1.5 },
              label: { formatter: 'New offer + Confidence Call →', color: t.gold, fontWeight: 600, fontSize: 11.5, position: 'end' },
              data: changeIdx >= 0 ? [{ xAxis: changeIdx - 0.5 }] : [] } },
          { name: 'Reached Under Contract', type: 'line', data: rows.map(r => r.uc_all), symbol: 'circle', symbolSize: 7, lineStyle: { color: t.uc, width: 2.5 }, itemStyle: { color: t.uc, borderColor: t.surface, borderWidth: 1.5 } },
          { name: 'Reached CLOSED', type: 'line', data: rows.map(r => r.closed), symbol: 'circle', symbolSize: 7, lineStyle: { color: t.closed, width: 2.5 }, itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 1.5 } },
        ],
      });
    });
  }

  function openChart(node, th, meta) {
    const rows = th.monthly;
    R.chart(node, t => {
      const o = R.base(t);
      return Object.assign(o, {
        grid: { left: 8, right: 30, top: 22, bottom: 8, containLabel: true },
        tooltip: Object.assign(o.tooltip, {
          formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.partial ? R.date(meta.asof) : 'End of ' + r.label}</b><br>${r.open_searches} clients searching without a contract<br>${r.open_over_60} of them for 60+ days<br>${r.exits} paused or refunded during the month`; },
        }),
        xAxis: R.catAxis(t, rows.map(r => R.monShort(r.month)), { boundaryGap: false, axisLabel: { color: t.label, fontSize: 11.5 } }),
        yAxis: R.valAxis(t, { min: 0 }),
        series: [{
          name: 'Waiting 60+ days', type: 'line', data: rows.map(r => r.open_over_60), symbol: 'none', smooth: 0.2, z: 3,
          lineStyle: { color: t.inkStrong, width: 1.5, type: 'dashed' },
        }, {
          name: 'Open searches', type: 'line', data: rows.map(r => r.open_searches), symbol: 'none', smooth: 0.2,
          lineStyle: { color: t.wait, width: 2.5 }, areaStyle: { color: t.waitSoft, opacity: 0.45 },
          markPoint: { symbol: 'circle', symbolSize: 9, itemStyle: { color: t.wait, borderColor: t.surface, borderWidth: 2 },
            label: { position: 'top', color: t.inkStrong, fontWeight: 600, fontSize: 12, formatter: p => p.value },
            data: [{ coord: [rows.findIndex(r => r.month === th.open_searches.peak.month), th.open_searches.peak.n], value: th.open_searches.peak.n },
                   { coord: [rows.length - 1, th.open_searches.now], value: th.open_searches.now }] },
        }],
      });
    });
  }

  R.story('throughput', {
    nav: 'Operational throughput',
    render(root, D) {
      const th = D.throughput, pre = th.pre, post = th.post, cc = th.cohort_compare, lag = th.lag, lc = th.last_complete;
      const sp = th.since_peak, rc = th.recent;
      root.innerHTML = `
      <div class="wrap">
        <header class="story-head">
          <div class="eyebrow">Operational throughput <i>· Both clocks</i></div>
          <h2>Output kept pace with the summer surge; the autumn fall in open searches comes mainly from refunds, not faster contracts</h2>
          <p>Calendar months show the flow in and out. Following each month's new clients shows whether the larger cohorts moved as quickly as the smaller ones did.</p>
        </header>

        <div class="beat">
          <div class="beat-title"><span class="k">1</span><h3>Clients in, contracts and closings out, each month</h3></div>
          <div class="grid g-main">
            <div class="card">
              <div class="card-head"><h4>New signed-up clients vs clients reaching Under Contract and CLOSED<span class="sub">By calendar month · ${th.monthly[th.monthly.length - 1].label} runs to ${R.date(D.meta.asof)} (faded)</span></h4></div>
              <div class="chart tall" id="flowChart" role="img" aria-label="Monthly new clients, contracts and closings."></div>
              <div class="legend"><span><i style="background:var(--c-neutral-2)"></i>New signed-up clients</span><span><i class="line" style="background:var(--c-uc)"></i>Reached Under Contract*</span><span><i class="line" style="background:var(--c-closed)"></i>Reached CLOSED</span></div>
              <p class="caption">*Includes contracts dated from a later closing where Jira lost the contract date (mostly 2025). Clients are counted in the month of their client start, which for Confidence Call clients can fall before the purchase month, so the latest months will be revised up slightly.</p>
            </div>
            <div class="facts">
              <div class="fact">
                <table class="t" aria-label="Monthly averages before and after June 2026">
                  <thead><tr><th>Per month</th><th class="n">${pre.label}</th><th class="n">${post.label}</th><th class="n">Change</th></tr></thead>
                  <tbody>
                    <tr><td>New clients</td><td class="n">${pre.new_avg}</td><td class="n">${post.new_avg}</td><td class="n">${R.ratio(th.ratio.new)}</td></tr>
                    <tr class="hl"><td>Under Contract</td><td class="n">${pre.uc_all_avg}</td><td class="n">${post.uc_all_avg}</td><td class="n">${R.ratio(th.ratio.uc_all)}–${R.ratio(th.ratio.uc)}</td></tr>
                    <tr><td>CLOSED</td><td class="n">${pre.closed_avg}</td><td class="n">${post.closed_avg}</td><td class="n">${R.ratio(th.ratio.closed)}</td></tr>
                    <tr><td class="dim">Sales won (Pipedrive)</td><td class="n dim">${pre.won_avg}</td><td class="n dim">${post.won_avg}</td><td class="n dim">${R.ratio(th.ratio.won)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="fact accent"><div class="v num">${R.pct((lag.one_month + lag.two_months) / lag.n)}<small>of contracts</small></div><p>signed ${post.label} came one or two months after the client's start month. Only ${R.pct(lag.same_month / lag.n)} came in the same month, so each month's contracts mostly reflect clients who started earlier.</p></div>
              <div class="fact accent-closed"><div class="v num">${lc.closed}<small>closings in ${lc.label}</small></div><p>The highest month on record, as the summer's contracts reach closing about ${D.speed.uc_to_close_typical} days later.</p></div>
              <div class="fact accent-wait"><div class="v num">${rc.new}<small>new clients, ${rc.label.split(' ')[0]} 1–${rc.days}</small></div><p>A pace of about ${rc.new_pace_30} a month (${rc.won} sales won, about ${rc.won_pace_30} a month), against ${Math.round(post.new_avg)} over the summer. Intake has receded, so contract volume will likely ease in the coming months for reasons unrelated to capacity.</p></div>
            </div>
          </div>
        </div>

        <div class="beat">
          <div class="beat-title"><span class="k">2</span><h3>The larger summer cohorts reached contracts at least as quickly; the open pool shrank mostly because clients left</h3></div>
          <div class="grid g-even">
            <div class="card">
              <div class="card-head"><h4>Clients searching without a contract<span class="sub">At each month end · paused and refunded clients leave the pool</span></h4></div>
              <div class="chart short" id="openChart" role="img" aria-label="Open searches at month end."></div>
              <div class="legend"><span><i class="line" style="background:var(--c-wait)"></i>All open searches</span><span><i class="dash" style="color:var(--ink-strong)"></i>Waiting 60+ days</span></div>
              <table class="t" style="margin-top:8px" aria-label="Changes in open searches since the peak">
                <tbody>
                  <tr><td>Open searches on ${R.date(sp.from)}</td><td class="n">${sp.start}</td></tr>
                  <tr><td>+ new clients</td><td class="n">+${sp.entered}</td></tr>
                  <tr><td>− went under contract</td><td class="n">−${sp.went_uc}</td></tr>
                  <tr><td>− paused or refunded (${sp.refunded} refunds)</td><td class="n">−${sp.exited}</td></tr>
                  <tr class="hl"><td>Open searches on ${R.date(D.meta.asof)}</td><td class="n">${sp.end}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="card cmp">
              <div class="card-head"><h4>Same-cohort conversion<span class="sub">Share of each period's new clients under contract within 60 and 90 days of their start</span></h4></div>
              <div class="cmp-group"><h5>Within 60 days</h5>
                <div class="cmp-row"><div class="lab">Started ${cc['60'].pre.months.join(' – ')}<small>${cc['60'].pre.num} of ${cc['60'].pre.den}</small></div><div class="track"><div class="fill" style="width:${cc['60'].pre.share * 100}%;background:var(--c-uc-soft)"></div></div><div class="val">${R.pct(cc['60'].pre.share)}</div></div>
                <div class="cmp-row"><div class="lab">Started ${cc['60'].post.months.join(' – ')}<small>${cc['60'].post.num} of ${cc['60'].post.den}</small></div><div class="track"><div class="fill" style="width:${cc['60'].post.share * 100}%;background:var(--c-uc)"></div></div><div class="val">${R.pct(cc['60'].post.share)}</div></div>
              </div>
              <div class="cmp-group"><h5>Within 90 days</h5>
                <div class="cmp-row"><div class="lab">Started ${cc['90'].pre.months.join(' – ')}<small>${cc['90'].pre.num} of ${cc['90'].pre.den}</small></div><div class="track"><div class="fill" style="width:${cc['90'].pre.share * 100}%;background:var(--c-uc-soft)"></div></div><div class="val">${R.pct(cc['90'].pre.share)}</div></div>
                <div class="cmp-row"><div class="lab">Started ${cc['90'].post.months.join(' – ')}<small>${cc['90'].post.num} of ${cc['90'].post.den}</small></div><div class="track"><div class="fill" style="width:${cc['90'].post.share * 100}%;background:var(--c-uc)"></div></div><div class="val">${R.pct(cc['90'].post.share)}</div></div>
              </div>
              <p class="caption">Only months whose clients have all had the full 60 or 90 days are included.</p>
            </div>
          </div>
          <div class="means"><span class="lbl">What it means</span><div>
            <p>Through the August cohort, acquisition output kept pace with the jump in demand. Contracts rose about ${R.ratio(th.ratio.uc_all)} to ${R.ratio(th.ratio.uc)} and closings ${R.ratio(th.ratio.closed)} while new clients rose ${R.ratio(th.ratio.new)}, and the larger summer cohorts reached contracts at least as fast as earlier ones.</p>
            <p>Since September, contracts have held flat at about ${(th.monthly.find(r => r.month === '2026-09') || { uc_all: 0 }).uc_all} a month. The open pool fell from ${sp.start} to ${sp.end} mainly because ${sp.exited} clients left (${sp.refunded} refunded) and fewer signed, so the fall is not evidence of extra capacity. Clients waiting 60+ days have not declined. September and October cohorts are too young to judge. This data counts clients and milestones; it does not measure team capacity or workload.</p>
          </div></div>
          <details class="more">
            <summary>Monthly figures</summary>
            <div class="inner"><div class="tbl-wrap"><table class="t">
              <thead><tr><th>Month</th><th class="n">New clients</th><th class="n">Under Contract*</th><th class="n">CLOSED</th><th class="n">Paused / refunded</th><th class="n">of which refunded</th><th class="n">Open searches at month end</th><th class="n">Sales won</th></tr></thead>
              <tbody>${th.monthly.slice().reverse().map(r => `<tr><td>${r.label}${r.partial ? ' (partial)' : ''}</td><td class="n">${r.new}</td><td class="n">${r.uc_all}</td><td class="n">${r.closed}</td><td class="n">${r.exits}</td><td class="n">${r.refunds}</td><td class="n">${r.open_searches}</td><td class="n">${r.won}</td></tr>`).join('')}</tbody>
            </table></div>
            <p>New clients are counted by their client start (onboarding-call date). Contracts and closings are counted in the month they happened, whenever the client started. Sales won counts STR Search deals won in Pipedrive.</p></div>
          </details>
        </div>
      </div>`;
      flowChart(R.$('#flowChart', root), th, D.meta);
      openChart(R.$('#openChart', root), th, D.meta);
    },
  });
})();
