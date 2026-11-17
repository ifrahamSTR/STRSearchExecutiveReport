/* Cash forecast tab (16 Nov 2026 reporting version): net future cash flow from service payments, affiliate
   revenue and refunds, recomputed in the browser from aggregates built by pipeline/chapters/cash.py.
   - fixed timing:  under-contract clients and scheduled closings, weighted by the historical probability of closing
                    for clients who had waited as long, timed by the remaining historical UC -> CLOSED durations
   - slider timing: clients without a property (historical close / refund / pause shares) and paused or
                    additional-service clients (proceed share = slider), spread around the expected days until
                    collection with the historical UC -> CLOSED variation
   - refunds:       refunding clients x refundable share x amount already paid (first installment or full price)
   - affiliates:    recorded partner choice where Jira has one; the conversion sliders only where it has none
   No client record is published. */
(function () {
  'use strict';
  const S = window.S, D = S.data, C = D.cash;
  const G = C.groups, F = C.fixed, NP = C.noprop, PA = C.paused, DEF = C.defaults, H0 = C.history, AF = C.affiliates;
  const DAY = 86400000, OPT = DEF.optimistic_days, AFF = ['realtor', 'lender', 'cribs'];
  const asof = new Date(C.asof + 'T12:00:00');
  const at = d => new Date(asof.getTime() + d * DAY);
  const dLong = d => at(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dShort = d => at(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const mKey = d => { const x = at(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const mLab = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', ' ’');
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money = v => (v < 0 ? '−$' : '$') + nf0.format(Math.abs(Math.round(v)));
  const short = v => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return s + (a >= 1e6 ? '$' + (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? '$' + Math.round(a / 1e3) + 'K' : a >= 1e3 ? '$' + (a / 1e3).toFixed(1) + 'K' : '$' + Math.round(a)); };
  const pct = v => Math.round(v * 100) + '%';

  const defaults = () => ({ d: DEF.expected_days, max: DEF.expected_days_max, p: DEF.paused_proceed, s: DEF.refundable_share,
    aff: Object.fromEntries(AFF.map(k => [k, { conv: DEF.affiliates[k].conv, rev: DEF.affiliates[k].rev }])) });
  let st = defaults();

  /* ------------------------------------------------------------------ model */
  const affValue = (parts, s) => AFF.reduce((a, k) => a + s.aff[k].rev * (parts[k].known + s.aff[k].conv * parts[k].unknown), 0);
  function model(s) {
    const spread = C.spread.map(([o, w]) => [Math.max(1, s.d + o), w]);
    const H = Math.max(F.svc.length - 1, ...spread.map(x => x[0]));
    const z = () => new Array(H + 1).fill(0);
    const fixed = z(), noprop = z(), paused = z(), aff = z(), refund = z();
    F.svc.forEach((v, d) => {
      fixed[d] = v;
      refund[d] -= s.s * F.refund_base[d];
      aff[d] += AFF.reduce((a, k) => a + s.aff[k].rev * (F.known[k][d] + s.aff[k].conv * F.unknown[k][d]), 0);
    });
    const npAff = affValue(NP.aff, s), paAff = s.p * affValue(PA.aff, s);
    spread.forEach(([d, w]) => {
      noprop[d] += NP.collect * w;
      paused[d] += s.p * PA.second * w;
      aff[d] += (npAff + paAff) * w;
      refund[d] -= s.s * (NP.refund_base + (1 - s.p) * PA.paid) * w;
    });
    const sum = a => a.reduce((x, y) => x + y, 0);
    const tot = { fixed: sum(fixed), noprop: sum(noprop), paused: sum(paused), aff: sum(aff), refund: sum(refund) };
    tot.service = tot.fixed + tot.noprop + tot.paused;
    tot.net = tot.service + tot.aff + tot.refund;
    const cum = []; let run = 0;
    for (let d = 0; d <= H; d++) { run += fixed[d] + noprop[d] + paused[d] + aff[d] + refund[d]; cum.push(run); }
    return { H, fixed, noprop, paused, aff, refund, tot, cum, within: n => cum[Math.max(0, Math.min(n, H))] };
  }
  function monthly(m) {
    const rows = [], idx = {};
    for (let d = 1; d <= m.H; d++) {
      const k = mKey(d);
      if (!(k in idx)) { idx[k] = rows.length; rows.push({ k, fixed: 0, noprop: 0, paused: 0, aff: 0, refund: 0 }); }
      const r = rows[idx[k]];
      r.fixed += m.fixed[d]; r.noprop += m.noprop[d]; r.paused += m.paused[d]; r.aff += m.aff[d]; r.refund += m.refund[d];
    }
    const live = r => Math.abs(r.fixed) + Math.abs(r.noprop) + Math.abs(r.paused) + Math.abs(r.aff) + Math.abs(r.refund) > 1;
    while (rows.length && !live(rows[rows.length - 1])) rows.pop();
    let run = 0;
    rows.forEach(r => { r.inflow = r.fixed + r.noprop + r.paused + r.aff; r.net = r.inflow + r.refund; run += r.net; r.cum = run; });
    return rows;
  }
  const contractual = Object.values(G).reduce((a, g) => a + g.outstanding, 0) + C.view.scheduled_counted_collected + C.other.outstanding;
  const unverified = G.unverified_closing.outstanding + G.unverified_repeat.outstanding + G.unverified_none.outstanding;

  /* ------------------------------------------------------------------ layout */
  const main = document.getElementById('main');
  const RY = AF.recorded_year;
  main.innerHTML = `
    <section class="cf-intro" aria-labelledby="cf-title">
      <div class="cf-kicker">Cash forecast · ${D.meta.version.label} reporting package</div>
      <h1 id="cf-title">How much more cash STRSearch can expect, and when</h1>
      <p>Future service collections and affiliate revenue, less the refunds expected along the way, under assumptions you control. Every change recalculates instantly.</p>
      <div class="cf-chips"><span class="cf-chip">Data as of ${S.date(C.asof)}</span><span class="cf-chip">${S.int(C.view.engagements)} won engagements reconciled</span></div>
    </section>
    <div class="cf-grid">
      <aside class="cf-controls" aria-label="Forecast assumptions">
        <div class="ctl">
          <h3><i style="background:var(--wait)"></i>Expected days until collection</h3>
          <div class="readout"><b id="o-day">–</b><span id="o-date">–</span></div>
          <div class="range"><div class="range-top"><label for="r-d">Clients without a property, and paused clients who resume</label></div>
            <input type="range" id="r-d" min="${OPT}" max="${DEF.expected_days_max}" step="1" style="--c:var(--wait)"><div class="range-ends"><span>${OPT} days (optimistic)</span><span id="o-dmax"></span></div></div>
          <p class="hint">${OPT} days = Under Contract tomorrow plus the historical median of ${H0.uc_to_close.median} days to closing. Collections spread around the chosen day the way past closings did (middle half ${H0.uc_to_close.p25}–${H0.uc_to_close.p75} days).</p>
          <div class="range"><div class="range-top"><label for="r-max">Maximum on this slider</label><output id="o-max" for="r-max"></output></div>
            <input type="range" id="r-max" min="${OPT + 3}" max="240" step="1" style="--c:var(--hold)"></div>
        </div>
        <div class="ctl">
          <h3><i style="background:var(--sales)"></i>Paused + Additional Service</h3>
          <div class="range"><div class="range-top"><label for="r-p">Eventually proceed</label><output id="o-p" for="r-p"></output></div>
            <input type="range" id="r-p" min="0" max="100" step="1" style="--c:var(--sales)"><div class="range-ends"><span>0% (all refund)</span><span>100%</span></div></div>
          <p class="hint" id="o-p-hint"></p>
        </div>
        <div class="ctl">
          <h3><i style="background:var(--sales-2);outline:1.5px solid var(--sales)"></i>Refunds</h3>
          <div class="range"><div class="range-top"><label for="r-s">Refund size: share of the upfront payment returned</label><output id="o-s" for="r-s"></output></div>
            <input type="range" id="r-s" min="0" max="100" step="5" style="--c:var(--sales)"><div class="range-ends"><span>0% · none returned</span><span>100% · all returned</span></div></div>
          <p class="hint">Future refunds only: paused or additional-service clients who don’t proceed, and clients expected to refund. Upfront payment = the first Split Pay installment, or the full Paid In Full price. Their unpaid second installment is not collected. Clients already marked Refunded in Jira were refunded in the past and are not part of the forecast.</p>
        </div>
        <div class="ctl">
          <h3><i style="background:var(--closed)"></i>Affiliate revenue</h3>
          <p class="hint">Conversion applies only to clients whose partner choice is not yet recorded in Jira; a recorded preferred partner earns, a recorded other partner, cash purchase or turnkey home does not.</p>
          ${AFF.map(k => `<div class="aff" data-aff="${k}">
            <div class="aff-head"><b>${DEF.affiliates[k].label}</b><span id="o-${k}-val"></span></div>
            <div class="range"><div class="range-top"><label for="r-${k}-c">Conversion (unrecorded choice)</label><output id="o-${k}-c"></output></div><input type="range" id="r-${k}-c" min="0" max="100" step="1" style="--c:var(--closed)"></div>
            <div class="range"><div class="range-top"><label for="r-${k}-r">Revenue per conversion</label><output id="o-${k}-r"></output></div><input type="range" id="r-${k}-r" min="0" max="10000" step="100" style="--c:var(--closed)"></div>
            <div class="hist" id="h-${k}"></div>
          </div>`).join('')}
        </div>
        <div class="ctl">
          <h3>Scenarios</h3>
          <div class="presets"><button class="btn" data-preset="opt" type="button">Optimistic</button><button class="btn" data-preset="bal" type="button">Balanced</button><button class="btn" data-preset="pes" type="button">Pessimistic</button>
            <button class="btn reset" id="b-reset" type="button">Reset every assumption</button></div>
        </div>
      </aside>
      <div class="cf-results">
        <div class="kpis" id="kpis" aria-live="polite"></div>
        <section class="panel" aria-labelledby="h-cash">
          <div class="panel-head"><h2 id="h-cash">Expected cash flow by month</h2><p class="sub" id="s-cash"></p></div>
          <div class="legend-row" id="lg-cash"></div>
          <div class="chart chart-cash" id="c-cash" role="img" aria-label="Expected monthly collections above zero, refund outflows below zero, and the net cash flow line"></div>
          <p class="foot">Above zero: service collections and affiliate revenue. Below zero: expected refunds. The line is the month’s net. Under-contract timing follows past clients who had waited as long; other clients spread around the expected days until collection the way past closings did.</p>
        </section>
        <div class="two">
          <section class="panel" aria-labelledby="h-bridge">
            <div class="panel-head"><h2 id="h-bridge">From contractual balance to net cash</h2></div>
            <div class="chart chart-bridge" id="c-bridge" role="img" aria-label="Bridge from the outstanding contractual balance to net expected cash flow"></div>
            <p class="foot">Each dollar is counted once: historical refunds and unresolved records are set aside, expected non-completion and projected refunds come off, and affiliate revenue is added per expected closing.</p>
          </section>
          <section class="panel" aria-labelledby="h-scen">
            <div class="panel-head"><h2 id="h-scen">Scenario comparison</h2><p class="sub">Cumulative net cash flow</p></div>
            <div class="legend-row" id="lg-scen"></div>
            <div class="chart chart-scen" id="c-scen" role="img" aria-label="Cumulative net cash flow under optimistic, current and pessimistic timing"></div>
            <div class="tw"><table class="cf-t scen" id="t-scen"></table></div>
          </section>
        </div>
        <section class="panel" aria-labelledby="h-groups">
          <div class="panel-head"><h2 id="h-groups">Every won engagement, reconciled</h2><p class="sub">Each engagement belongs to exactly one row · contractual balance from client_cash_forecast</p></div>
          <div class="tw"><table class="cf-t" id="t-groups"></table></div>
        </section>
        <details class="cf-notes" id="notes"><summary>Assumptions &amp; Methodology</summary><div class="notes-body" id="notes-body"></div></details>
      </div>
    </div>
    <p class="cf-foot">Aggregates only: no client names, ids or individual amounts are published. Sources: the Business Data Explorer’s 16 Nov 2026 foundation, the 12 Nov 2026 Jira, Pipedrive and affiliate-tracking extracts, and both onboarding-form sheets.</p>`;

  /* ------------------------------------------------------------------ controls */
  const $ = id => document.getElementById(id);
  const fill = el => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  const inputs = { d: $('r-d'), max: $('r-max'), p: $('r-p'), s: $('r-s') };
  AFF.forEach(k => { inputs[k + 'c'] = $('r-' + k + '-c'); inputs[k + 'r'] = $('r-' + k + '-r'); });
  function sync() {
    inputs.max.value = st.max; inputs.d.max = st.max; st.d = Math.min(st.d, st.max); inputs.d.value = st.d;
    inputs.p.value = Math.round(st.p * 100); inputs.s.value = Math.round(st.s * 100);
    AFF.forEach(k => { inputs[k + 'c'].value = Math.round(st.aff[k].conv * 100); inputs[k + 'r'].value = st.aff[k].rev; });
    Object.values(inputs).forEach(fill);
  }
  function read(src) {
    if (src === inputs.max) { st.max = +inputs.max.value; inputs.d.max = st.max; if (+inputs.d.value > st.max) inputs.d.value = st.max; fill(inputs.d); }
    st.d = +inputs.d.value; st.p = inputs.p.value / 100; st.s = inputs.s.value / 100;
    AFF.forEach(k => { st.aff[k].conv = inputs[k + 'c'].value / 100; st.aff[k].rev = +inputs[k + 'r'].value; });
  }
  let raf = 0;
  Object.values(inputs).forEach(el => el.addEventListener('input', () => { fill(el); read(el); cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }));
  const presetDay = k => (k === 'opt' ? OPT : k === 'pes' ? st.max : Math.round((OPT + st.max) / 2));
  document.querySelectorAll('.presets [data-preset]').forEach(b => b.addEventListener('click', () => { st.d = presetDay(b.dataset.preset); sync(); render(); }));
  $('b-reset').addEventListener('click', () => { st = defaults(); sync(); render(); });

  /* ------------------------------------------------------------------ charts */
  const SRC = t => [
    { k: 'fixed', name: 'Under contract & scheduled', color: t.uc },
    { k: 'noprop', name: 'No property yet', color: t.wait },
    { k: 'paused', name: 'Paused & Additional Service', color: t.sales },
    { k: 'aff', name: 'Affiliate revenue', color: t.closed },
    { k: 'refund', name: 'Projected refunds', color: t.sales2 },
  ];
  let M = model(st), MM = monthly(M);
  const tipBox = (t, title, rows, foot) => `<div style="min-width:230px"><b>${title}</b>${rows.map(r => `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:${r[2] || 'transparent'}"></i>${r[0]}</span><b>${r[1]}</b></div>`).join('')}${foot ? `<div style="margin-top:6px;color:${t.muted};font-size:12px">${foot}</div>` : ''}</div>`;

  const cashChart = S.chart($('c-cash'), t => {
    const src = SRC(t), narrow = $('c-cash').offsetWidth < 560;
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 10, top: 18, bottom: 8, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } },
        formatter: ps => { const r = MM[ps[0].dataIndex]; return tipBox(t, mLab(r.k).replace('’', '20') + (r.k === mKey(0) ? ' (from ' + dLong(1) + ')' : ''),
          src.filter(s => Math.abs(r[s.k]) > 0.5).map(s => [s.name, money(r[s.k]), s.color]).concat([['Net this month', money(r.net), t.ink], ['Cumulative net', money(r.cum)]])); } }),
      xAxis: { type: 'category', data: MM.map(r => mLab(r.k)), axisLine: { onZero: true, lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.label, fontSize: 12, interval: narrow ? 'auto' : 0 } },
      yAxis: S.valAxis(t, { axisLabel: { color: t.label, fontSize: 12, formatter: v => short(v) } }),
      series: src.map((s, i) => ({ name: s.name, type: 'bar', stack: 'c', data: MM.map(r => Math.round(r[s.k])), barMaxWidth: 46,
        itemStyle: { color: s.color, borderColor: s.k === 'refund' ? t.sales : t.surface, borderWidth: 1, borderRadius: s.k === 'aff' ? [4, 4, 0, 0] : s.k === 'refund' ? [0, 0, 4, 4] : 0 }, emphasis: { focus: 'series' } }))
        .concat([{ name: 'Net', type: 'line', data: MM.map(r => Math.round(r.net)), symbol: 'circle', symbolSize: 7, lineStyle: { color: t.ink, width: 2 }, itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 1.5 }, z: 5 }]),
    });
  });

  function bridgeSteps() {
    const sched = C.view.scheduled_counted_collected;
    const fixedDue = G.under_contract.second + G.scheduled.second;
    return [
      { n: 'Outstanding contractual balance', v: contractual, kind: 'total', tip: `Client_cash_forecast outstanding (${money(C.view.gross_outstanding)}) plus ${money(sched)} for ${G.scheduled.n} closings scheduled after ${S.date(C.asof)}, which the view already counts as collected.` },
      { n: 'Already refunded (historical)', v: -G.refunded.outstanding, tip: `${S.int(G.refunded.n)} engagements marked Refunded in Jira: the refund is assumed already paid back, and their unpaid second installment is not collectible. Nothing here enters future cash flow.` },
      { n: 'Unresolved records (not forecast)', v: -unverified, tip: `${S.int(G.unverified_closing.n + G.unverified_repeat.n + G.unverified_none.n)} engagements the data cannot resolve; see the table for the missing information.` },
      { n: 'Probable duplicate deals', v: -G.duplicate.outstanding, tip: `${S.int(G.duplicate.n)} won deals with the same client, won date and value as a Jira-linked deal: not counted twice.` },
      { n: 'Closing found in affiliate records', v: -G.closed.outstanding, tip: `${S.int(G.closed.evidenced)} engagements whose closing is evidenced in brokerage, lender or affiliate records: second installment assumed collected at closing, like every recorded closing.` },
      { n: 'Expected not to close', v: -((fixedDue - M.tot.fixed) + (NP.second - NP.collect)), tip: `Under contract: historical closing probability ${pct(G.under_contract.p_close)}. No property yet: ${pct(NP.p_close)} expected to close, ${pct(NP.p_refund)} to refund and ${pct(NP.p_pause)} to pause or keep searching (past clients at the same stage).` },
      { n: 'Paused / AS not proceeding', v: -(1 - st.p) * PA.second, tip: `${pct(1 - st.p)} of ${S.int(PA.n)} paused or additional-service engagements assumed to refund.` },
      { n: 'Expected service collections', v: M.tot.service, kind: 'sub', tip: 'Second installments expected to be collected.' },
      { n: 'Affiliate revenue', v: M.tot.aff, tip: 'Recorded preferred partners plus conversion × revenue where no choice is recorded, for every expected closing.' },
      { n: 'Projected refunds', v: M.tot.refund, tip: `Future refunds only: ${pct(st.s)} of the upfront payment of clients expected to refund.` },
      { n: 'Net expected cash flow', v: M.tot.net, kind: 'total', tip: 'Service collections + affiliate revenue − refunds.' },
    ];
  }
  const bridgeChart = S.chart($('c-bridge'), t => {
    const steps = bridgeSteps();
    let run = 0;
    const base = [], val = [];
    steps.forEach(s => {
      if (s.kind) { base.push(0); val.push(s.v); run = s.v; }
      else if (s.v < 0) { run += s.v; base.push(run); val.push(-s.v); }
      else { base.push(run); val.push(s.v); run += s.v; }
    });
    const color = s => s.kind === 'total' ? t.acq : s.kind === 'sub' ? t.uc : s.n === 'Projected refunds' ? t.sales : s.v < 0 ? t.hold : t.closed;
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 64, top: 6, bottom: 4, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const s = steps[p.dataIndex]; return tipBox(t, s.n, [[s.v < 0 ? 'Less' : 'Amount', money(Math.abs(s.v)), color(s)]], s.tip); } }),
      yAxis: { type: 'category', inverse: true, data: steps.map(s => s.n), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: 12, width: 150, overflow: 'break', lineHeight: 14 } },
      xAxis: S.valAxis(t, { axisLabel: { show: false }, splitLine: { show: false } }),
      series: [
        { type: 'bar', stack: 'w', data: base, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, tooltip: { show: false }, silent: true },
        { type: 'bar', stack: 'w', barMaxWidth: 22, data: val.map((v, i) => ({ value: v, itemStyle: { color: color(steps[i]), borderRadius: 4 } })),
          label: { show: true, position: 'right', color: t.ink, fontSize: 12, fontWeight: 600, formatter: p => (steps[p.dataIndex].v < 0 ? '−' : '') + short(Math.abs(steps[p.dataIndex].v)) } },
      ],
    });
  });

  const scenarios = () => [
    { key: 'opt', name: 'Optimistic', s: Object.assign({}, st, { d: OPT }) },
    { key: 'cur', name: 'Your setting', s: st },
    { key: 'pes', name: 'Pessimistic', s: Object.assign({}, st, { d: st.max }) },
  ].map(x => Object.assign(x, { m: model(x.s) }));
  const scenChart = S.chart($('c-scen'), t => {
    const sc = scenarios(), H = Math.max(...sc.map(x => x.m.H));
    const col = { opt: t.sp2, cur: t.acq, pes: t.hold };
    const pts = x => { const out = []; for (let d = 0; d <= H; d++) out.push([at(d).getTime(), Math.round(x.m.cum[Math.min(d, x.m.H)])]); return out; };
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 14, top: 14, bottom: 8, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'axis', formatter: ps => tipBox(t, new Date(ps[0].value[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        ps.map(p => [sc[p.seriesIndex].name, money(p.value[1]), col[sc[p.seriesIndex].key]])) }),
      xAxis: { type: 'time', axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: t.label, fontSize: 11, formatter: '{MMM} ’{yy}' } },
      yAxis: S.valAxis(t, { axisLabel: { color: t.label, fontSize: 11, formatter: v => short(v) } }),
      series: sc.map(x => ({ name: x.name, type: 'line', showSymbol: false, data: pts(x), z: x.key === 'cur' ? 3 : 2,
        lineStyle: { color: col[x.key], width: x.key === 'cur' ? 3 : 2, type: x.key === 'pes' ? [6, 4] : 'solid' }, itemStyle: { color: col[x.key] }, emphasis: { disabled: true } })),
    });
  });

  /* ------------------------------------------------------------------ render */
  function render() {
    M = model(st); MM = monthly(M);
    const t = S.tok(), src = SRC(t);
    $('o-day').textContent = st.d + ' days';
    $('o-date').textContent = 'centred on ' + dLong(st.d);
    $('o-dmax').textContent = st.max + ' days (pessimistic)';
    $('o-max').textContent = st.max + ' days';
    $('o-p').textContent = pct(st.p);
    $('o-p-hint').textContent = `${S.int(PA.paused_n)} paused and ${S.int(PA.additional_n)} additional-service engagements. Those who proceed pay their second installment (${short(st.p * PA.second)}); those who don’t are refunded ${pct(st.s)} of their upfront payment, which is paid back and subtracted from net cash flow (−${short((1 - st.p) * PA.paid * st.s)}), and their second installment is not collected.`;
    $('o-s').textContent = pct(st.s);
    AFF.forEach(k => {
      $('o-' + k + '-c').textContent = pct(st.aff[k].conv); $('o-' + k + '-r').textContent = money(st.aff[k].rev);
      const known = F.known[k].reduce((a, b) => a + b, 0) + NP.aff[k].known + st.p * PA.aff[k].known;
      const unk = F.unknown[k].reduce((a, b) => a + b, 0) + NP.aff[k].unknown + st.p * PA.aff[k].unknown;
      $('o-' + k + '-val').textContent = short(st.aff[k].rev * (known + st.aff[k].conv * unk));
      const histFee = k === 'realtor' ? `median referral fee ${money(AF.realtor.median_fee)}` : k === 'lender' ? `median amount due ${money(AF.lender.median_due)}` : `typical fee ${money(AF.cribs.typical_fee)}`;
      $('h-' + k).innerHTML = `Expected closings: <b>${Math.round(known)}</b> with this partner recorded, <b>${Math.round(unk)}</b> unrecorded · history: ${pct(RY[k])} of ${AF.year_label} closings, ${histFee}`;
    });
    document.querySelectorAll('.presets [data-preset]').forEach(b => b.setAttribute('aria-pressed', String(presetDay(b.dataset.preset) === st.d)));
    $('kpis').innerHTML = [
      { cls: 'hero', l: 'Net expected future cash flow', v: short(M.tot.net), s: `${short(M.tot.service + M.tot.aff)} in, ${short(-M.tot.refund)} out · ${short(M.within(lastMonthEnd(2)))} by ${dLong(lastMonthEnd(2))}` },
      { l: 'Expected service collections', c: 'var(--uc)', v: short(M.tot.service), s: `Second installments, ${pct(M.tot.service / contractual)} of the ${short(contractual)} contractual balance` },
      { l: 'Expected affiliate collections', c: 'var(--closed)', v: short(M.tot.aff), s: 'Realtor, lender and STR Cribs fees on expected closings' },
      { l: 'Projected refund outflows', c: 'var(--sales)', v: short(M.tot.refund), s: `Future refunds only · ${pct(st.s)} of the upfront payment returned` },
    ].map(k => `<div class="kpi ${k.cls || ''}"><div class="l">${k.c ? `<i style="background:${k.c}"></i>` : ''}${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s}</div></div>`).join('');
    const half = M.cum.findIndex(v => v >= M.tot.net / 2);
    $('s-cash').textContent = `Half of the net by ${dLong(Math.max(half, 1))} · ${short(unverified + G.duplicate.outstanding)} in unresolved or duplicate records is not included`;
    $('lg-cash').innerHTML = src.map(s => `<span><i style="background:${s.color}${s.k === 'refund' ? ';outline:1.5px solid ' + t.sales : ''}"></i>${s.name}</span>`).join('') + `<span><i class="ln" style="background:${t.ink}"></i>Net</span>`;
    $('lg-scen').innerHTML = `<span><i class="ln" style="background:${t.sp2}"></i>Optimistic (${OPT} days)</span><span><i class="ln" style="background:${t.acq}"></i>Your setting (${st.d} days)</span><span style="color:${t.hold}"><i class="dash"></i><span style="color:var(--ink-2)">Pessimistic (${st.max} days)</span></span>`;
    const sc = scenarios(), ends = [2, 3].map(lastMonthEnd);
    $('t-scen').innerHTML = `<thead><tr><th>Scenario</th><th>Centred on</th>${ends.map(d => `<th>By ${dShort(d)}</th>`).join('')}<th>Net total</th></tr></thead><tbody>` +
      sc.map(x => `<tr class="${x.key === 'cur' ? 'cur' : ''}"><td>${x.name}</td><td>${dShort(x.s.d)}</td>${ends.map(d => `<td>${short(x.m.within(d))}</td>`).join('')}<td>${short(x.m.tot.net)}</td></tr>`).join('') + '</tbody>';
    // groups table
    const XU = G.under_contract.expected, XS = G.scheduled.expected;
    const rows = [
      ['under_contract', t.uc, XU.svc, -st.s * XU.refund_base, affValue(XU.aff, st), `Closing probability ${pct(G.under_contract.p_close)} (past clients who had waited as long); timed by the remaining historical UC → CLOSED durations (${S.int(H0.uc_to_close.n)} closings, median ${H0.uc_to_close.median} days)`],
      ['scheduled', t.uc, XS.svc, -st.s * XS.refund_base, affValue(XS.aff, st), `Collected on the scheduled date (to ${S.date(C.notes.scheduled_dates_to)}) with probability ${pct(G.scheduled.p_close)}; the view already counts these ${short(C.view.scheduled_counted_collected)} as collected`],
      ['noprop', t.wait, M.tot.noprop, -st.s * NP.refund_base, affValue(NP.aff, st), `${S.int(NP.hunting)} hunting + ${S.int(NP.not_started)} won but not started · past clients at the same stage: ${pct(NP.p_close)} closed, ${pct(NP.p_refund)} refunded, ${pct(NP.p_pause)} paused or still searching`],
      ['paused', t.sales, M.tot.paused, -st.s * (1 - st.p) * PA.paid, st.p * affValue(PA.aff, st), `${pct(st.p)} proceed and pay the second installment; ${pct(1 - st.p)} are refunded ${pct(st.s)} of their upfront payment, paid back and subtracted (their second installment is not collected)`],
      ['refunded', null, 0, 0, 0, 'Marked Refunded in Jira: refund assumed already paid back (historical); no future collection or outflow'],
      ['closed', null, 0, 0, 0, `Second installment assumed collected at the recorded closing (incl. ${S.int(G.closed.evidenced)} closings found in affiliate or brokerage records)`],
      ['unverified_closing', null, 0, 0, 0, 'Missing: closing date. Post-close Jira status but no closing in any source'],
      ['unverified_repeat', null, 0, 0, 0, 'Missing: a Jira issue for this purchase. The client’s only issue tracks their other won deal'],
      ['unverified_none', null, 0, 0, 0, `Missing: any Jira, e-mail or purchase record (${S.int(C.resolution.unverified_none_2024)} won in 2024, ${S.int(C.resolution.unverified_none_2026)} in 2026)`],
      ['duplicate', null, 0, 0, 0, 'Same client, won date and value as a Jira-linked deal: not counted twice'],
    ];
    let tc = 0, te = 0, tr = 0, ta = 0, tn = 0;
    $('t-groups').innerHTML = `<thead><tr><th>Group</th><th>Engagements</th><th>Contractual balance</th><th>Service collections</th><th>Refunds</th><th>Affiliate</th><th style="text-align:left">Treatment and evidence</th></tr></thead><tbody>` +
      rows.map(([k, col, svc, ref, aff, rule]) => {
        const g = G[k], bal = g.outstanding + (k === 'scheduled' ? C.view.scheduled_counted_collected : 0);
        tc += bal; te += svc; tr += ref; ta += aff; tn += g.n;
        const live = svc || ref || aff;
        return `<tr class="${live ? '' : 'ex'}"><td><span class="sw" style="background:${col || 'var(--line-2)'}"></span>${g.label}</td><td>${S.int(g.n)}</td><td>${bal ? short(bal) : '–'}</td><td>${svc ? short(svc) : '–'}</td><td>${ref ? short(ref) : '–'}</td><td>${aff ? short(aff) : '–'}</td><td class="rule">${rule}</td></tr>`;
      }).join('') + `</tbody><tfoot><tr><td>Total</td><td>${S.int(tn)}</td><td>${short(tc)}</td><td>${short(te)}</td><td>${short(tr)}</td><td>${short(ta)}</td><td class="rule">Net ${short(te + tr + ta)}</td></tr></tfoot>`;
    cashChart.draw(); bridgeChart.draw(); scenChart.draw();
  }
  function lastMonthEnd(k) { const e = new Date(asof.getFullYear(), asof.getMonth() + k, 0, 12); return Math.round((e - asof) / DAY); }

  /* ------------------------------------------------------------------ assumptions, reconciliation, limitations */
  const R = C.resolution, MS = H0.mature_starts;
  const item = (tag, html) => `<li><span class="tag ${tag}">${{ h: 'Historical', a: 'Assumption', l: 'Limitation', r: 'Reconciled' }[tag]}</span><span>${html}</span></li>`;
  $('notes-body').innerHTML = `
    <h3>Refunds</h3><ul>
      ${item('a', `Clients marked Refunded in Jira (${S.int(G.refunded.n)}) have already been paid back. These are completed, historical refunds: they are not future cash outflows, and their unpaid second installments are not collectible.`)}
      ${item('a', `Paused and Additional Service clients: by default ${pct(DEF.paused_proceed)} eventually proceed and pay their second installment, and ${pct(1 - DEF.paused_proceed)} are refunded (adjustable). For those refunded, the refunded amount is paid back to the client and subtracted from the forecast as a cash outflow.`)}
      ${item('a', `Clients without a property are refunded at the historical rate for their stage (${pct(C.noprop.p_refund)} on average); under-contract clients who do not close are refunded at the historical rate (${pct(H0.uc_fail_refund)} of those who did not close).`)}
      ${item('a', `The refund-size slider (0–100%, default ${pct(DEF.refundable_share)}) sets how much of the previously collected upfront payment is returned, for future refunds only: 0% returns no upfront money, 100% returns all of it. The upfront payment is the first Split Pay installment, or the full price for Paid In Full.`)}
      ${item('a', `For every client assumed to refund, the remaining unpaid installment is not collected.`)}
      ${item('a', `Historical refunds, projected refunds and expected collections are kept separate: a client contributes to at most one of them, and projected refunds are timed with the same expected-days spread as collections.`)}
    </ul>
    <h3>Reconciliation</h3><ul>
      ${item('r', `Every one of the ${S.int(C.view.engagements)} won engagements sits in exactly one row of the table above, and the rows add up to client_cash_forecast’s outstanding balance (${money(C.view.gross_outstanding)}) plus ${money(C.view.scheduled_counted_collected)} for scheduled closings.`)}
      ${item('r', `The 47 won deals without a Jira match were checked against the Jira key typed in Pipedrive, client e-mails in the 12 Nov Jira and Pipedrive extracts, both onboarding-form sheets, and the brokerage and lender closing records: ${R.own_jira} match their own Jira issue (now grouped by its status), ${R.purchase_record} have a closing record, ${R.duplicate} are probable duplicates of a Jira-linked deal, ${R.repeat} are repeat purchases whose client’s only Jira issue tracks the other deal, and ${R.none} have no record anywhere (${R.onboarded} of the 47 did complete an onboarding form).`)}
      ${item('r', `The ${R.post_close_no_date} post-close engagements without a closing date were checked against the affiliate revenue, brokerage and lender records by property address: ${R.post_close_evidenced} closings were found; the rest stay unresolved.`)}
    </ul>
    <h3>What the data shows</h3><ul>
      ${item('h', `Under Contract → CLOSED: median ${H0.uc_to_close.median} days (middle half ${H0.uc_to_close.p25}–${H0.uc_to_close.p75}) across ${S.int(H0.uc_to_close.n)} closings; Passed Inspection → CLOSED median ${H0.pi_to_close.median} days. ${pct(H0.uc_close_rate)} of ${S.int(H0.uc_n)} past under-contract clients closed; the chance falls the longer a contract has run without closing. ${pct(H0.uc_fail_refund)} of those who did not close were refunded.`)}
      ${item('h', `Of ${S.int(MS.n)} confirmed starts with a year or more of history and a known outcome, ${pct(MS.shares.closed)} closed, ${pct(MS.shares.refunded)} refunded, ${pct(MS.shares.paused)} paused and ${pct(MS.shares.hunting)} are still searching; for clients still without a contract after N days the shares shift toward refund and pause, and each hunting client uses the shares for their own number of days.`)}
      ${item('h', `Historical refunds: ${S.int(H0.processed_refunds.n)} engagements are marked Refunded in Jira, typically ${H0.refund_lag.median} days after the client start (90% within ${Math.round(H0.refund_lag.p90)} days).`)}
      ${item('h', `Affiliate history: ${S.int(AF.realized.payments)} recorded affiliate payments since ${'Dec 2024'} total ${money(AF.realized.total)} (broker ${money(AF.realized.by_source.Broker.total)}, lender ${money(AF.realized.by_source.Lender.total)}, construction ${money(AF.realized.by_source.Construction.total)}). Median realtor referral fee ${money(AF.realtor.median_fee)} (${S.int(AF.realtor.received)} of ${S.int(AF.realtor.n)} received); median lender amount due ${money(AF.lender.median_due)}; typical STR Cribs fee ${money(AF.cribs.typical_fee)}. No affiliate fee is recorded as already received for any client still expected to close (realtor ${AF.future_clients_already_paid.realtor}, lender ${AF.future_clients_already_paid.lender}).`)}
    </ul>
    <h3>Assumptions (adjustable unless noted)</h3><ul>
      ${item('a', 'Payment rules from client_cash_forecast: Paid In Full is collected at the win; Split Pay collects 50% at the win and 50% at property closing. Only second installments are future collections.')}
      ${item('a', `Expected days until collection (default ${DEF.expected_days}, from ${OPT} to an adjustable maximum of ${DEF.expected_days_max}): applies to clients without a property and to paused clients who resume. Collections and their refunds spread around that day with the historical UC → CLOSED variation rather than landing on one date.`)}
      ${item('a', `Paused + Additional Service: default ${pct(DEF.paused_proceed)} proceed (second installment collected), the rest refund. The slider moves both the collections and the refunds.`)}

      ${item('a', `Affiliates: a recorded preferred realtor, lender or STR Cribs choice earns the fee; a recorded other partner, cash purchase or turnkey home earns nothing; only unrecorded choices use the conversion sliders (defaults ${pct(DEF.affiliates.realtor.conv)} / ${pct(DEF.affiliates.lender.conv)} / ${pct(DEF.affiliates.cribs.conv)}). Revenue per conversion defaults ${money(DEF.affiliates.realtor.rev)} / ${money(DEF.affiliates.lender.rev)} / ${money(DEF.affiliates.cribs.rev)} are business assumptions; the recorded medians above are higher.`)}
    </ul>
    <h3>Data limitations</h3><ul>
      ${item('l', `Payment type: blanks default to Split Pay and only ${S.int(C.view.payment_recorded)} of ${S.int(C.view.engagements)} won deals carry a recorded type, so outstanding balances may be overstated for clients who paid in full.`)}
      ${item('l', `${money(unverified)} of unresolved and ${money(G.duplicate.outstanding)} of probable-duplicate balances stay outside the forecast until their records are found.`)}
      ${item('l', 'Under Contract is the latest valid contract; earlier fall-throughs are not recorded, so the historical closing probability may be slightly optimistic.')}
    </ul>`;

  /* ------------------------------------------------------------------ chrome */
  document.getElementById('snap').textContent = 'data as of ' + S.date(D.meta.asof);
  document.getElementById('foot-asof').textContent = `Data as of ${S.date(D.meta.asof)}`;
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cj-theme', next); } catch (err) { /* storage unavailable */ }
    render();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  sync();
  render();
  window.__CASH_READY = true;
  window.__CASH = { model, defaults, get state() { return st; } };
})();
