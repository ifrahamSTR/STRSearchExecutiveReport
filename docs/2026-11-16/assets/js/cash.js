/* Cash forecast tab (16 Nov 2026 reporting version).
   An interactive scenario model on top of the reporting layer's modeled cash (client_cash_forecast):
   - fixed timing:  under-contract clients (historical UC -> CLOSED timing, conditional on time already waited) and
                    scheduled closings (their dates), pre-computed as daily sums by pipeline/chapters/cash.py
   - slider timing: clients without a property, and the share of paused / additional-service clients who proceed,
                    collected on one date between the optimistic and pessimistic endpoints
   - affiliates:    expected future closings x conversion x revenue per conversion (realtor, lender, STR Cribs)
   Everything is recomputed in the browser from aggregates; no client record is published. */
(function () {
  'use strict';
  const S = window.S, D = S.data, C = D.cash;
  const G = C.groups, F = C.fixed, DEF = C.defaults, H0 = C.history;
  const DAY = 86400000, OPT = DEF.optimistic_days;
  const asof = new Date(C.asof + 'T12:00:00');
  const at = d => new Date(asof.getTime() + d * DAY);
  const dLong = d => at(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const mKey = d => { const x = at(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const mLab = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', ' ’');
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money = v => '$' + nf0.format(Math.round(v));
  const short = v => { const a = Math.abs(v); return (v < 0 ? '−' : '') + (a >= 1e6 ? '$' + (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? '$' + Math.round(a / 1e3) + 'K' : a >= 1e3 ? '$' + (a / 1e3).toFixed(1) + 'K' : '$' + Math.round(a)); };
  const pct = v => Math.round(v * 100) + '%';
  const AFF = ['realtor', 'lender', 'cribs'];

  const defaults = () => ({ t: DEF.timing, pess: DEF.pessimistic_days, p: DEF.paused_proceed,
    aff: Object.fromEntries(AFF.map(k => [k, { conv: DEF.affiliates[k].conv, rev: DEF.affiliates[k].rev }])) });
  let st = defaults();

  /* ------------------------------------------------------------------ model */
  const perClosing = s => AFF.reduce((a, k) => a + s.aff[k].conv * s.aff[k].rev, 0);
  const dayOf = s => Math.round(OPT + s.t * (s.pess - OPT));
  function model(s) {
    const day = dayOf(s), per = perClosing(s), H = Math.max(F.cash.length - 1, day);
    const fixed = new Array(H + 1).fill(0), noprop = new Array(H + 1).fill(0), paused = new Array(H + 1).fill(0), close = new Array(H + 1).fill(0);
    F.cash.forEach((v, d) => { fixed[d] = v; close[d] += F.closings[d]; });
    noprop[day] += G.noprop.amount;
    paused[day] += s.p * G.paused.amount;
    close[day] += G.noprop.n + s.p * G.paused.n;
    const aff = close.map(c => c * per);
    const sum = a => a.reduce((x, y) => x + y, 0);
    const tot = { fixed: sum(fixed), noprop: sum(noprop), paused: sum(paused), closings: sum(close), aff: sum(aff) };
    tot.service = tot.fixed + tot.noprop + tot.paused;
    tot.total = tot.service + tot.aff;
    const cum = []; let run = 0;
    for (let d = 0; d <= H; d++) { run += fixed[d] + noprop[d] + paused[d] + aff[d]; cum.push(run); }
    const within = n => cum[Math.min(n, H)];
    return { day, per, H, fixed, noprop, paused, close, aff, tot, cum, within };
  }
  function monthly(m) {
    const keys = [], idx = {};
    const row = () => ({ fixed: 0, noprop: 0, paused: 0, aff: 0, close: 0 });
    for (let d = 1; d <= m.H; d++) {
      const k = mKey(d);
      if (!(k in idx)) { idx[k] = keys.length; keys.push({ k, ...row() }); }
      const r = keys[idx[k]];
      r.fixed += m.fixed[d]; r.noprop += m.noprop[d]; r.paused += m.paused[d]; r.aff += m.aff[d]; r.close += m.close[d];
    }
    while (keys.length && keys[keys.length - 1].fixed + keys[keys.length - 1].noprop + keys[keys.length - 1].paused + keys[keys.length - 1].aff === 0) keys.pop();
    let run = 0;
    keys.forEach(r => { r.total = r.fixed + r.noprop + r.paused + r.aff; run += r.total; r.cum = run; });
    return keys;
  }
  const contractual = G.under_contract.amount + G.scheduled.amount + G.noprop.amount + G.paused.amount + G.refunded.amount + G.post_close_no_date.amount + G.no_jira.amount + G.closed.amount;

  /* ------------------------------------------------------------------ layout */
  const main = document.getElementById('main');
  const hist = H0.affiliates_n;
  main.innerHTML = `
    <section class="cf-intro" aria-labelledby="cf-title">
      <div class="cf-kicker">Cash forecast · ${D.meta.version.label} reporting package</div>
      <h1 id="cf-title">How much more cash STRSearch can expect, and when</h1>
      <p>Outstanding service payments and affiliate revenue from clients who have not yet closed, under assumptions you control. Every change recalculates instantly.</p>
      <div class="cf-chips"><span class="cf-chip">Data as of ${S.date(C.asof)}</span><span class="cf-chip warn">Modeled from contracts, not verified receipts</span><span class="cf-chip">${S.int(C.view.engagements)} won engagements</span></div>
    </section>
    <div class="cf-grid">
      <aside class="cf-controls" aria-label="Forecast assumptions">
        <div class="ctl">
          <h3><i style="background:var(--wait)"></i>Timing · clients without a property</h3>
          <div class="readout"><b id="o-day">–</b><span id="o-date">–</span></div>
          <div class="range"><div class="range-top"><label for="r-t">Optimistic ↔ pessimistic</label><output id="o-t" for="r-t"></output></div>
            <input type="range" id="r-t" min="0" max="100" step="1" style="--c:var(--wait)"><div class="range-ends"><span>Optimistic · day ${OPT}</span><span id="o-pend">Pessimistic</span></div></div>
          <p class="hint">Optimistic: Under Contract tomorrow, then the historical median of ${H0.uc_to_close.median} days to closing (day ${OPT}). Pessimistic: one collection the set number of days after the reporting date.</p>
          <div class="range"><div class="range-top"><label for="r-pess">Pessimistic endpoint</label><output id="o-pess" for="r-pess"></output></div>
            <input type="range" id="r-pess" min="${OPT}" max="240" step="1" style="--c:var(--hold)"><div class="range-ends"><span>${OPT} days</span><span>240 days</span></div></div>
        </div>
        <div class="ctl">
          <h3><i style="background:var(--sales)"></i>Paused + Additional Service</h3>
          <div class="range"><div class="range-top"><label for="r-p">Eventually proceed</label><output id="o-p" for="r-p"></output></div>
            <input type="range" id="r-p" min="0" max="100" step="1" style="--c:var(--sales)"><div class="range-ends"><span>0% (all refund)</span><span>100%</span></div></div>
          <p class="hint" id="o-p-hint"></p>
        </div>
        <div class="ctl">
          <h3><i style="background:var(--closed)"></i>Affiliate revenue per closing <span style="margin-left:auto;font:600 13px/1 var(--f-mono);color:var(--closed)" id="o-per"></span></h3>
          ${AFF.map(k => `<div class="aff" data-aff="${k}">
            <div class="aff-head"><b>${DEF.affiliates[k].label}</b><span id="o-${k}-val"></span></div>
            <div class="range"><div class="range-top"><label for="r-${k}-c">Conversion</label><output id="o-${k}-c"></output></div><input type="range" id="r-${k}-c" min="0" max="100" step="1" style="--c:var(--closed)"></div>
            <div class="range"><div class="range-top"><label for="r-${k}-r">Revenue per conversion</label><output id="o-${k}-r"></output></div><input type="range" id="r-${k}-r" min="0" max="10000" step="100" style="--c:var(--closed)"></div>
            <div class="hist">Recorded in Jira for ${hist.year_label} closings: <b>${pct(DEF.affiliates[k].recorded_year)}</b> · all closings: ${pct(DEF.affiliates[k].recorded_all)}</div>
          </div>`).join('')}
        </div>
        <div class="ctl">
          <h3>Scenarios</h3>
          <div class="presets"><button class="btn" data-t="0" type="button">Optimistic</button><button class="btn" data-t="0.5" type="button">Balanced</button><button class="btn" data-t="1" type="button">Pessimistic</button>
            <button class="btn reset" id="b-reset" type="button">Reset every assumption</button></div>
        </div>
      </aside>
      <div class="cf-results">
        <div class="kpis" id="kpis" aria-live="polite"></div>
        <section class="panel" aria-labelledby="h-cash">
          <div class="panel-head"><h2 id="h-cash">Expected collections by month</h2><p class="sub" id="s-cash"></p></div>
          <div class="legend-row" id="lg-cash"></div>
          <div class="chart chart-cash" id="c-cash" role="img" aria-label="Expected collections by month, stacked by source"></div>
          <p class="foot">Under-contract timing follows the closing times of past clients who had waited as long; scheduled closings use their dates; clients without a property collect on the date set by the timing slider. Affiliate revenue is earned at each expected closing.</p>
        </section>
        <div class="two">
          <section class="panel" aria-labelledby="h-bridge">
            <div class="panel-head"><h2 id="h-bridge">From contractual balance to projected cash</h2></div>
            <div class="chart chart-bridge" id="c-bridge" role="img" aria-label="Bridge from outstanding contractual balance to total projected collections"></div>
            <p class="foot">No amount is counted twice: already-closed engagements are out, scheduled closings move from the view’s “collected” to their dates, and refunded or unknown-status balances are not expected.</p>
          </section>
          <section class="panel" aria-labelledby="h-scen">
            <div class="panel-head"><h2 id="h-scen">Scenario comparison</h2><p class="sub">Cumulative projected collections</p></div>
            <div class="legend-row" id="lg-scen"></div>
            <div class="chart chart-scen" id="c-scen" role="img" aria-label="Cumulative projected collections under optimistic, current and pessimistic timing"></div>
            <div class="tw"><table class="cf-t scen" id="t-scen"></table></div>
          </section>
        </div>
        <section class="panel" aria-labelledby="h-groups">
          <div class="panel-head"><h2 id="h-groups">Where every outstanding dollar sits</h2><p class="sub">Each won engagement belongs to exactly one row</p></div>
          <div class="tw"><table class="cf-t" id="t-groups"></table></div>
        </section>
        <details class="cf-notes" id="notes"><summary>Every assumption and data limitation</summary><div class="notes-body" id="notes-body"></div></details>
      </div>
    </div>
    <p class="cf-foot">Aggregates only: no client names, ids or individual amounts are published. Source: the Business Data Explorer’s 16 Nov 2026 foundation (client_cash_forecast, won_clients_master, jira_reporting_base).</p>`;

  /* ------------------------------------------------------------------ controls */
  const $ = id => document.getElementById(id);
  const fill = el => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  const inputs = { t: $('r-t'), pess: $('r-pess'), p: $('r-p') };
  AFF.forEach(k => { inputs[k + 'c'] = $('r-' + k + '-c'); inputs[k + 'r'] = $('r-' + k + '-r'); });
  function sync() {
    inputs.t.value = Math.round(st.t * 100); inputs.pess.value = st.pess; inputs.p.value = Math.round(st.p * 100);
    AFF.forEach(k => { inputs[k + 'c'].value = Math.round(st.aff[k].conv * 100); inputs[k + 'r'].value = st.aff[k].rev; });
    Object.values(inputs).forEach(fill);
  }
  function read() {
    st.t = inputs.t.value / 100; st.pess = +inputs.pess.value; st.p = inputs.p.value / 100;
    AFF.forEach(k => { st.aff[k].conv = inputs[k + 'c'].value / 100; st.aff[k].rev = +inputs[k + 'r'].value; });
  }
  let raf = 0;
  Object.values(inputs).forEach(el => el.addEventListener('input', () => { fill(el); read(); cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }));
  document.querySelectorAll('.presets [data-t]').forEach(b => b.addEventListener('click', () => { st.t = +b.dataset.t; sync(); render(); }));
  $('b-reset').addEventListener('click', () => { st = defaults(); sync(); render(); });

  /* ------------------------------------------------------------------ charts */
  const SRC = t => [
    { k: 'fixed', name: 'Under contract & scheduled', color: t.uc },
    { k: 'noprop', name: 'No property yet', color: t.wait },
    { k: 'paused', name: 'Paused & Additional Service', color: t.sales },
    { k: 'aff', name: 'Affiliate revenue', color: t.closed },
  ];
  let M = model(st), MM = monthly(M);
  const tipBox = (t, title, rows, foot) => `<div style="min-width:220px"><b>${title}</b>${rows.map(r => `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:${r[2] || 'transparent'}"></i>${r[0]}</span><b>${r[1]}</b></div>`).join('')}${foot ? `<div style="margin-top:6px;color:${t.muted};font-size:12px">${foot}</div>` : ''}</div>`;

  const cashChart = S.chart($('c-cash'), t => {
    const src = SRC(t), narrow = $('c-cash').offsetWidth < 560;
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 10, top: 18, bottom: 8, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } },
        formatter: ps => { const r = MM[ps[0].dataIndex]; return tipBox(t, mLab(r.k).replace('’', '20') + (r.k === mKey(0) ? ' (from ' + dLong(1) + ')' : ''),
          src.filter(s => r[s.k] > 0.5).map(s => [s.name, money(r[s.k]), s.color]).concat([['Month total', money(r.total)], ['Cumulative', money(r.cum)]]),
          'Expected closings this month: ' + (Math.round(r.close * 10) / 10)); } }),
      xAxis: { type: 'category', data: MM.map(r => mLab(r.k)), axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.label, fontSize: 12, interval: narrow ? 'auto' : 0 } },
      yAxis: S.valAxis(t, { axisLabel: { color: t.label, fontSize: 12, formatter: v => short(v) } }),
      series: src.map((s, i) => ({ name: s.name, type: 'bar', stack: 'c', data: MM.map(r => Math.round(r[s.k])), barMaxWidth: 46,
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1, borderRadius: i === src.length - 1 ? [4, 4, 0, 0] : 0 }, emphasis: { focus: 'series' } })),
    });
  });

  const bridgeChart = S.chart($('c-bridge'), t => {
    const sched = G.scheduled.view_counts_collected, start = C.view.gross_outstanding + sched;
    const steps = [
      { n: 'Outstanding contractual balance', v: start, kind: 'total', tip: `Client_cash_forecast outstanding (${money(C.view.gross_outstanding)}) plus ${money(sched)} for ${G.scheduled.n} closings scheduled after ${S.date(C.asof)}, which the view already counts as collected.` },
      { n: 'Refunded', v: -G.refunded.amount, tip: `${S.int(G.refunded.n)} engagements whose Jira status is Refunded: no further collections.` },
      { n: 'No Jira match', v: -G.no_jira.amount, tip: `${S.int(G.no_jira.n)} won deals with no Jira record, mostly from 2024–25: status unknown, so not forecast.` },
      { n: 'Closed, date missing', v: -G.post_close_no_date.amount, tip: `${S.int(G.post_close_no_date.n)} engagements already in a post-close status without a closing date: treated as collected, not forecast again.` },
      { n: 'Paused / AS not proceeding', v: -(1 - st.p) * G.paused.amount, tip: `${pct(1 - st.p)} of the ${S.int(G.paused.n)} paused or additional-service engagements are assumed to refund.` },
      { n: 'Expected service cash', v: M.tot.service, kind: 'sub', tip: 'Service payments still expected under these assumptions.' },
      { n: 'Affiliate revenue', v: M.tot.aff, tip: `${Math.round(M.tot.closings)} expected future closings × ${money(M.per)} per closing.` },
      { n: 'Total projected collections', v: M.tot.total, kind: 'total', tip: 'Expected service cash plus affiliate revenue.' },
    ];
    let run = 0;
    const base = [], val = [];
    steps.forEach(s => {
      if (s.kind) { base.push(0); val.push(s.v); run = s.v; }
      else if (s.v < 0) { run += s.v; base.push(run); val.push(-s.v); }
      else { base.push(run); val.push(s.v); run += s.v; }
    });
    const color = s => s.kind === 'total' ? t.acq : s.kind === 'sub' ? t.uc : s.v < 0 ? t.hold : t.closed;
    const cats = steps.map(s => s.n);
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 64, top: 6, bottom: 4, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const s = steps[p.dataIndex]; return tipBox(t, s.n, [[s.v < 0 ? 'Less' : 'Amount', money(Math.abs(s.v)), color(s)]], s.tip); } }),
      yAxis: { type: 'category', inverse: true, data: cats, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink2, fontSize: 12.5, width: 140, overflow: 'break', lineHeight: 15 } },
      xAxis: S.valAxis(t, { axisLabel: { show: false }, splitLine: { show: false } }),
      series: [
        { type: 'bar', stack: 'w', data: base, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, tooltip: { show: false }, silent: true },
        { type: 'bar', stack: 'w', barMaxWidth: 26, data: val.map((v, i) => ({ value: v, itemStyle: { color: color(steps[i]), borderRadius: 4 } })),
          label: { show: true, position: 'right', color: t.ink, fontSize: 12, fontWeight: 600, formatter: p => (steps[p.dataIndex].v < 0 ? '−' : '') + short(Math.abs(steps[p.dataIndex].v)) } },
      ],
    });
  });

  const scenarios = () => [
    { key: 'opt', name: 'Optimistic', s: Object.assign({}, st, { t: 0 }) },
    { key: 'cur', name: 'Your setting', s: st },
    { key: 'pes', name: 'Pessimistic', s: Object.assign({}, st, { t: 1 }) },
  ].map(x => Object.assign(x, { m: model(x.s) }));
  const scenChart = S.chart($('c-scen'), t => {
    const sc = scenarios(), H = Math.max(...sc.map(x => x.m.H)) + 14;
    const col = { opt: t.sp2, cur: t.acq, pes: t.hold };
    const pts = x => { const out = []; for (let d = 0; d <= H; d += 1) out.push([at(d).getTime(), Math.round(x.m.cum[Math.min(d, x.m.H)])]); return out; };
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 14, top: 14, bottom: 8, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'axis', formatter: ps => tipBox(t, new Date(ps[0].value[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        ps.map(p => [sc[p.seriesIndex].name, money(p.value[1]), col[sc[p.seriesIndex].key]])) }),
      xAxis: { type: 'time', axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: t.label, fontSize: 11, formatter: '{MMM} ’{yy}' } },
      yAxis: S.valAxis(t, { axisLabel: { color: t.label, fontSize: 11, formatter: v => short(v) } }),
      series: sc.map(x => ({ name: x.name, type: 'line', step: 'end', showSymbol: false, data: pts(x), z: x.key === 'cur' ? 3 : 2,
        lineStyle: { color: col[x.key], width: x.key === 'cur' ? 3 : 2, type: x.key === 'pes' ? [6, 4] : 'solid' }, itemStyle: { color: col[x.key] }, emphasis: { disabled: true } })),
    });
  });

  /* ------------------------------------------------------------------ render */
  function render() {
    M = model(st); MM = monthly(M);
    const t = S.tok(), src = SRC(t);
    // controls readouts
    $('o-day').textContent = 'Day ' + M.day;
    $('o-date').textContent = 'collect on ' + dLong(M.day);
    $('o-t').textContent = st.t === 0 ? 'Optimistic' : st.t === 1 ? 'Pessimistic' : st.t === 0.5 ? 'Balanced' : Math.round(st.t * 100) + '%';
    $('o-pess').textContent = st.pess + ' days · ' + dLong(st.pess);
    $('o-pend').textContent = 'Pessimistic · day ' + st.pess;
    $('o-p').textContent = pct(st.p);
    $('o-p-hint').textContent = `${S.int(G.paused.paused_n)} paused and ${S.int(G.paused.additional_n)} additional-service engagements (${short(G.paused.amount)} outstanding). The share that proceeds collects on the same date as clients without a property; the rest refunds.`;
    $('o-per').textContent = money(M.per);
    AFF.forEach(k => { $('o-' + k + '-c').textContent = pct(st.aff[k].conv); $('o-' + k + '-r').textContent = money(st.aff[k].rev); $('o-' + k + '-val').textContent = money(st.aff[k].conv * st.aff[k].rev) + ' / closing'; });
    document.querySelectorAll('.presets [data-t]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.t === st.t)));
    // KPIs
    const w90 = M.within(90);
    $('kpis').innerHTML = [
      { cls: 'hero', l: 'Total projected collections', v: short(M.tot.total), s: `${short(M.tot.service)} service + ${short(M.tot.aff)} affiliate · ${short(w90)} (${pct(w90 / M.tot.total)}) by ${dLong(90)}` },
      { l: 'Outstanding contractual balance', c: 'var(--hold)', v: short(contractual), s: `Second Split Pay installments not yet due · ${S.int(G.under_contract.split + G.scheduled.split + G.noprop.split + G.paused.split + G.refunded.split + G.post_close_no_date.split + G.no_jira.split)} engagements` },
      { l: 'Expected service cash', c: 'var(--uc)', v: short(M.tot.service), s: `${pct(M.tot.service / contractual)} of the contractual balance, after refunds, unknown status and paused clients who don’t proceed` },
      { l: 'Expected affiliate revenue', c: 'var(--closed)', v: short(M.tot.aff), s: `${Math.round(M.tot.closings)} expected closings × ${money(M.per)} (realtor, lender, STR Cribs)` },
    ].map(k => `<div class="kpi ${k.cls || ''}"><div class="l">${k.c ? `<i style="background:${k.c}"></i>` : ''}${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s}</div></div>`).join('');
    // monthly header + legend
    const half = M.cum.findIndex(v => v >= M.tot.total / 2);
    let lastD = 0;
    for (let d = M.H; d > 0; d--) if (M.fixed[d] + M.noprop[d] + M.paused[d] + M.aff[d] > 0.5) { lastD = d; break; }
    $('s-cash').textContent = `Half collected by ${dLong(half)} · last expected collection ${dLong(lastD)}`;
    $('lg-cash').innerHTML = src.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
    $('lg-scen').innerHTML = `<span><i class="ln" style="background:${t.sp2}"></i>Optimistic (day ${OPT})</span><span><i class="ln" style="background:${t.acq}"></i>Your setting (day ${M.day})</span><span style="color:${t.hold}"><i class="dash"></i><span style="color:var(--ink-2)">Pessimistic (day ${st.pess})</span></span>`;
    // scenario table
    const sc = scenarios();
    const dShort = d => at(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    // month-end checkpoints (cash planning is monthly): the next three month ends after the reporting date
    const ends = [2, 3, 4].map(k => { const e = new Date(asof.getFullYear(), asof.getMonth() + k, 0, 12); return Math.round((e - asof) / DAY); });
    $('t-scen').innerHTML = `<thead><tr><th>Scenario</th><th>No-property date</th>${ends.map(d => `<th>By ${dShort(d)}</th>`).join('')}<th>Total</th></tr></thead><tbody>` +
      sc.map(x => `<tr class="${x.key === 'cur' ? 'cur' : ''}"><td>${x.name}</td><td>${dShort(x.m.day)}</td>${ends.map(d => `<td>${short(x.m.within(d))}</td>`).join('')}<td>${short(x.m.tot.total)}</td></tr>`).join('') + '</tbody>';
    // groups table
    const rowsG = [
      ['under_contract', t.uc, 1, `Closing timed by ${S.int(H0.uc_to_close.n)} past UC → CLOSED durations (median ${H0.uc_to_close.median} days; ${G.under_contract.pi_based} past inspection use Passed Inspection → CLOSED, median ${H0.pi_to_close.median}), counting only durations longer than each client has already waited`],
      ['scheduled', t.uc, 1, `On the scheduled closing date (to ${S.date(C.notes.scheduled_dates_to)})`],
      ['noprop', t.wait, 1, `${S.int(G.noprop.hunting)} hunting + ${S.int(G.noprop.presale)} won with Jira still pre-sale · collected on ${dLong(M.day)} (timing slider)`],
      ['paused', t.sales, st.p, `${pct(st.p)} proceed and collect on ${dLong(M.day)}; the rest refund`],
      ['refunded', null, 0, 'No further collections'],
      ['post_close_no_date', null, 0, 'Post-close status without a closing date: treated as already collected'],
      ['no_jira', null, 0, 'No Jira record: status unknown, not forecast'],
      ['closed', null, 0, 'Second installment already assumed collected'],
    ];
    const closingsOf = k => ({ under_contract: G.under_contract.n, scheduled: G.scheduled.n, noprop: G.noprop.n, paused: st.p * G.paused.n }[k] || 0);
    let tc = 0, te = 0, ta = 0, tn = 0;
    $('t-groups').innerHTML = `<thead><tr><th>Group</th><th>Engagements</th><th>Contractual balance</th><th>Expected</th><th>Service cash</th><th>Affiliate revenue</th><th style="text-align:left">Timing and treatment</th></tr></thead><tbody>` +
      rowsG.map(([k, col, share, rule]) => {
        const g = G[k], exp = g.amount * share, aff = closingsOf(k) * M.per;
        tc += g.amount; te += exp; ta += aff; tn += g.n;
        return `<tr class="${share ? '' : 'ex'}"><td>${col ? `<span class="sw" style="background:${col}"></span>` : '<span class="sw" style="background:var(--line-2)"></span>'}${g.label}</td><td>${S.int(g.n)}</td><td>${g.amount ? short(g.amount) : '–'}</td><td>${g.amount ? pct(share) : '–'}</td><td>${exp ? short(exp) : '–'}</td><td>${aff ? short(aff) : '–'}</td><td class="rule">${rule}</td></tr>`;
      }).join('') + `</tbody><tfoot><tr><td>Total</td><td>${S.int(tn)}</td><td>${short(tc)}</td><td>${pct(te / tc)}</td><td>${short(te)}</td><td>${short(ta)}</td><td></td></tr></tfoot>`;
    cashChart.draw(); bridgeChart.draw(); scenChart.draw();
  }

  /* ------------------------------------------------------------------ assumptions & limitations */
  const A = DEF.affiliates, of = H0.older_starts;
  const item = (tag, html) => `<li><span class="tag ${tag}">${{ h: 'Historical', a: 'Assumption', l: 'Limitation' }[tag]}</span><span>${html}</span></li>`;
  $('notes-body').innerHTML = `
    <h3>What the data shows</h3><ul>
      ${item('h', `Under Contract → CLOSED: median ${H0.uc_to_close.median} days (middle half ${H0.uc_to_close.p25}–${H0.uc_to_close.p75}, longest ${H0.uc_to_close.max}) across ${S.int(H0.uc_to_close.n)} completed closings. Passed Inspection → CLOSED: median ${H0.pi_to_close.median} days (${S.int(H0.pi_to_close.n)}).`)}
      ${item('h', `Preferred-partner use recorded in Jira for ${hist.year_label} closings (${S.int(hist.year)}): realtor ${pct(A.realtor.recorded_year)}, lender ${pct(A.lender.recorded_year)}, STR Cribs ${pct(A.cribs.recorded_year)}; across all ${S.int(hist.all)} recorded closings ${pct(A.realtor.recorded_all)}, ${pct(A.lender.recorded_all)} and ${pct(A.cribs.recorded_all)}. These are usage flags, not affiliate payments.`)}
      ${item('h', `Of ${S.int(of.n)} confirmed starts with 180+ days since their start, ${pct(of.closed)} have closed, ${pct(of.paused)} are paused, ${pct(of.refunded)} refunded and ${pct(of.hunting)} are still hunting. Assuming every client without a property eventually pays is therefore on the optimistic side.`)}
    </ul>
    <h3>Business assumptions (adjustable above unless noted)</h3><ul>
      ${item('a', `Payment rules from client_cash_forecast: Paid In Full is collected at the win; Split Pay collects 50% at the win and 50% at property closing. Only the second Split Pay installment is forecast here; first installments and Paid In Full are already assumed collected.`)}
      ${item('a', `Under contract (${S.int(G.under_contract.n)}): collected at closing. Timing uses past clients’ closing times, keeping only those longer than the time each client has already been under contract, so a client 40 days in is not assumed to close on day 36. Every under-contract client is assumed to close (not adjustable).`)}
      ${item('a', `Scheduled closings (${S.int(G.scheduled.n)}): collected on their scheduled dates. The view counts these ${money(G.scheduled.view_counts_collected)} as already collected; the forecast moves them to their dates instead of counting them twice.`)}
      ${item('a', `No property yet (${S.int(G.noprop.n)}: hunting, or won with the Jira issue still pre-sale): one collection date for all, moved by the timing slider between optimistic (Under Contract tomorrow + ${H0.uc_to_close.median}-day median = day ${OPT}) and pessimistic (default ${DEF.pessimistic_days} days after ${S.date(C.asof)}, adjustable). All are assumed to proceed (not adjustable).`)}
      ${item('a', `Paused + Additional Service (${S.int(G.paused.n)}): treated together; default ${pct(DEF.paused_proceed)} proceed on the no-property timing and ${pct(1 - DEF.paused_proceed)} refund.`)}
      ${item('a', `Refunded and already-closed engagements: nothing further.`)}
      ${item('a', `Affiliate revenue: each expected future closing (any payment type, repeat purchases counted separately) earns conversion × revenue for realtor (default ${pct(A.realtor.conv)} × ${money(A.realtor.rev)}), lender (${pct(A.lender.conv)} × ${money(A.lender.rev)}) and STR Cribs (${pct(A.cribs.conv)} × ${money(A.cribs.rev)}), received on the closing date.`)}
    </ul>
    <h3>Data limitations</h3><ul>
      ${item('l', `Modeled, not received: the reporting layer has no QuickBooks or Stripe transactions. Amounts are contractual expectations, not cash in the bank or accounting revenue.`)}
      ${item('l', `Payment type: blanks default to Split Pay, and only ${S.int(C.view.payment_recorded)} of ${S.int(C.view.engagements)} won deals carry a recorded type. If some of those clients actually paid in full, outstanding balances and expected service cash are overstated.`)}
      ${item('l', `${S.int(G.no_jira.n)} won deals have no Jira match (${money(G.no_jira.amount)} contractual balance). Their status is unknown, so they are shown but not forecast.`)}
      ${item('l', `${S.int(G.post_close_no_date.n)} engagements are in a post-close status but lack a closing date. The view lists ${money(G.post_close_no_date.amount)} for them as outstanding; the forecast treats it as already collected.`)}
      ${item('l', `Under Contract is the latest valid contract. Fall-through history is not in the reporting layer, so the risk that a current contract fails is not modeled.`)}
      ${item('l', `Refunds are a Jira status proxy: a refunded engagement drops out entirely. Partial refunds and refund timing are not modeled.`)}
      ${item('l', `Affiliate conversion and revenue are business assumptions: the reporting layer holds partner-usage flags, not affiliate payments, and affiliate payments may arrive later than closing.`)}
      ${item('l', `${S.int(C.notes.zero_value_wins)} won deals carry a deal value of $0 and add no service cash. There is no monthly forward cash forecast in the reporting layer; this page is a scenario model built on top of it.`)}
    </ul>`;

  /* ------------------------------------------------------------------ chrome */
  document.getElementById('snap').textContent = 'data as of ' + S.date(D.meta.asof);
  document.getElementById('foot-asof').textContent = `Data as of ${S.date(D.meta.asof)} · modeled cash, not receipts`;
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
