/* Cash forecast tab (16 Nov 2026 reporting version): net future cash flow from service payments, affiliate
   revenue and refunds, recomputed in the browser from aggregates built by pipeline/chapters/cash.py.
   - fixed timing:  under-contract clients and scheduled closings, weighted by the historical probability of closing
                    for clients who had waited as long, timed by the remaining historical UC -> CLOSED durations
   - slider timing: clients without a property (historical close / refund / pause shares) and paused or
                    additional-service clients (proceed share = slider), spread around the expected days until
                    collection with the historical UC -> CLOSED variation
   - refunds:       refunding clients x refundable share x amount already paid (first installment or full price)
   - affiliates:    recorded partner choice where Jira has one; the conversion sliders only where it has none
   Presentation: KPIs, a left-to-right waterfall, then monthly cash flow, refund sources, affiliate partners and timing
   scenarios. Each of those five views switches between a chart and a sortable table; both follow the sliders.
   Refunds by source and affiliate revenue by partner are display-only splits of the same flows (they sum to the totals).
   No client record is published. */
(function () {
  'use strict';
  const S = window.S, D = S.data, C = D.cash;
  const G = C.groups, F = C.fixed, NP = C.noprop, PA = C.paused, DEF = C.defaults, H0 = C.history, AF = C.affiliates, R = C.resolution;
  const DAY = 86400000, OPT = DEF.optimistic_days, AFF = ['realtor', 'lender', 'cribs'];
  const asof = new Date(C.asof + 'T12:00:00');
  const at = d => new Date(asof.getTime() + d * DAY);
  const dLong = d => at(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dShort = d => at(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const mKey = d => { const x = at(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const mLab = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', ' ’');
  const mFull = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const money = v => (v < 0 ? '−$' : '$') + nf0.format(Math.abs(Math.round(v)));
  const short = v => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return s + (a >= 1e6 ? '$' + (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? '$' + Math.round(a / 1e3) + 'K' : a >= 1e3 ? '$' + (a / 1e3).toFixed(1) + 'K' : '$' + Math.round(a)); };
  const signed = v => (v > 0 ? '+' : '') + short(v);
  const cellM = v => (Math.abs(v) < 0.5 ? '–' : short(v));
  const pct = v => Math.round(v * 100) + '%';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const tok = () => Object.assign(S.tok(), { neg: css('--neg'), total: css('--total'), band: css('--wf-band') });

  const defaults = () => ({ d: DEF.expected_days, max: DEF.expected_days_max, p: DEF.paused_proceed, s: DEF.refundable_share,
    aff: Object.fromEntries(AFF.map(k => [k, { conv: DEF.affiliates[k].conv, rev: DEF.affiliates[k].rev }])) });
  let st = defaults();

  /* ------------------------------------------------------------------ model (unchanged; the splits below only re-group the same flows) */
  const affValue = (parts, s) => AFF.reduce((a, k) => a + s.aff[k].rev * (parts[k].known + s.aff[k].conv * parts[k].unknown), 0);
  function model(s) {
    const spread = C.spread.map(([o, w]) => [Math.max(1, s.d + o), w]);
    const H = Math.max(F.svc.length - 1, ...spread.map(x => x[0]));
    const z = () => new Array(H + 1).fill(0);
    const fixed = z(), noprop = z(), paused = z(), aff = z(), refund = z();
    const refUC = z(), refNP = z(), refPA = z(), affBy = Object.fromEntries(AFF.map(k => [k, z()]));
    F.svc.forEach((v, d) => {
      fixed[d] = v;
      refund[d] -= s.s * F.refund_base[d];
      aff[d] += AFF.reduce((a, k) => a + s.aff[k].rev * (F.known[k][d] + s.aff[k].conv * F.unknown[k][d]), 0);
      refUC[d] -= s.s * F.refund_base[d];
      AFF.forEach(k => { affBy[k][d] += s.aff[k].rev * (F.known[k][d] + s.aff[k].conv * F.unknown[k][d]); });
    });
    const npAff = affValue(NP.aff, s), paAff = s.p * affValue(PA.aff, s);
    const kAff = Object.fromEntries(AFF.map(k => [k, s.aff[k].rev * (NP.aff[k].known + s.aff[k].conv * NP.aff[k].unknown + s.p * (PA.aff[k].known + s.aff[k].conv * PA.aff[k].unknown))]));
    spread.forEach(([d, w]) => {
      noprop[d] += NP.collect * w;
      paused[d] += s.p * PA.second * w;
      aff[d] += (npAff + paAff) * w;
      refund[d] -= s.s * (NP.refund_base + (1 - s.p) * PA.paid) * w;
      refNP[d] -= s.s * NP.refund_base * w;
      refPA[d] -= s.s * (1 - s.p) * PA.paid * w;
      AFF.forEach(k => { affBy[k][d] += kAff[k] * w; });
    });
    const sum = a => a.reduce((x, y) => x + y, 0);
    const tot = { fixed: sum(fixed), noprop: sum(noprop), paused: sum(paused), aff: sum(aff), refund: sum(refund),
      refUC: sum(refUC), refNP: sum(refNP), refPA: sum(refPA), affBy: Object.fromEntries(AFF.map(k => [k, sum(affBy[k])])) };
    tot.service = tot.fixed + tot.noprop + tot.paused;
    tot.net = tot.service + tot.aff + tot.refund;
    const cum = []; let run = 0;
    for (let d = 0; d <= H; d++) { run += fixed[d] + noprop[d] + paused[d] + aff[d] + refund[d]; cum.push(run); }
    return { H, fixed, noprop, paused, aff, refund, refUC, refNP, refPA, affBy, tot, cum, within: n => cum[Math.max(0, Math.min(n, H))] };
  }
  const MKEYS = ['fixed', 'noprop', 'paused', 'aff', 'refund', 'refUC', 'refNP', 'refPA'];
  function monthly(m) {
    const rows = [], idx = {};
    for (let d = 1; d <= m.H; d++) {
      const k = mKey(d);
      if (!(k in idx)) { idx[k] = rows.length; rows.push(Object.fromEntries([['k', k]].concat(MKEYS.concat(AFF).map(x => [x, 0])))); }
      const r = rows[idx[k]];
      MKEYS.forEach(x => { r[x] += m[x][d]; });
      AFF.forEach(x => { r[x] += m.affBy[x][d]; });
    }
    const live = r => Math.abs(r.fixed) + Math.abs(r.noprop) + Math.abs(r.paused) + Math.abs(r.aff) + Math.abs(r.refund) > 1;
    while (rows.length && !live(rows[rows.length - 1])) rows.pop();
    let run = 0;
    rows.forEach(r => { r.service = r.fixed + r.noprop + r.paused; r.inflow = r.service + r.aff; r.net = r.inflow + r.refund; run += r.net; r.cum = run; });
    return rows;
  }
  // affiliate revenue per partner: expected closings with the partner already chosen vs with no recorded choice
  const FK = Object.fromEntries(AFF.map(k => [k, { known: F.known[k].reduce((a, b) => a + b, 0), unknown: F.unknown[k].reduce((a, b) => a + b, 0) }]));
  function affParts(s) {
    return Object.fromEntries(AFF.map(k => {
      const a = s.aff[k], known = FK[k].known + NP.aff[k].known + s.p * PA.aff[k].known, unk = FK[k].unknown + NP.aff[k].unknown + s.p * PA.aff[k].unknown;
      return [k, { label: DEF.affiliates[k].label, conv: a.conv, rev: a.rev, known, unk, paying: known + a.conv * unk, chosen: a.rev * known, assumed: a.rev * a.conv * unk, total: a.rev * (known + a.conv * unk) }];
    }));
  }
  const contractual = Object.values(G).reduce((a, g) => a + g.outstanding, 0) + C.view.scheduled_counted_collected + C.other.outstanding;
  const unverified = G.unverified_closing.outstanding + G.unverified_repeat.outstanding + G.unverified_none.outstanding;
  const U = H0.uc_to_close;

  /* ------------------------------------------------------------------ layout */
  const IC = {
    clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.3 1.5"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.9 4v8M10.1 4v8"/></svg>',
    refund: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 3.8 3 7l3.2 3.2"/><path d="M3.4 7h6.1a3.1 3.1 0 0 1 0 6.2H8"/></svg>',
    partner: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.6" cy="5.6" r="2.1"/><circle cx="11" cy="6.2" r="1.7"/><path d="M1.9 13c.4-2.1 1.9-3.3 3.7-3.3s3.3 1.2 3.7 3.3M9.8 9.9c.4-.2.8-.3 1.2-.3 1.4 0 2.6 1 3 3"/></svg>',
    scen: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/><circle class="k" cx="6" cy="4.5" r="1.6"/><circle class="k" cx="10.5" cy="8" r="1.6"/><circle class="k" cx="5" cy="11.5" r="1.6"/></svg>',
    chart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5h11M4.8 11V7.5M8 11V4M11.2 11V6.2"/></svg>',
    table: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.6"/><path d="M2.5 6.6h11M2.5 9.8h11M6.4 6.6V13"/></svg>',
  };
  const toggle = id => `<div class="vt" role="group" aria-label="Show as chart or table"><button type="button" data-for="${id}" data-view="chart" aria-pressed="true">${IC.chart}<span>Chart</span></button><button type="button" data-for="${id}" data-view="table" aria-pressed="false">${IC.table}<span>Table</span></button></div>`;
  const panel = (id, title, cls, aria, foot, extra, kick) => `
        <section class="panel ${extra || ''}" id="p-${id}" aria-labelledby="h-${id}">
          <div class="panel-head"><div class="ph">${kick ? `<div class="kick">${kick}</div>` : ''}<h2 id="h-${id}">${title}</h2><p class="sub" id="s-${id}"></p></div>${id === 'cash' ? `<div class="ph-tools"><button type="button" class="lg-btn" id="b-detail" aria-pressed="false">Split by client group</button>${toggle(id)}</div>` : toggle(id)}</div>
          <div class="pv-chart"><div class="legend-row" id="lg-${id}"></div><div class="chart ${cls}" id="c-${id}" role="img" aria-label="${aria}"></div><p class="empty-note" id="e-${id}"></p><p class="foot" id="f-${id}">${foot}</p></div>
          <div class="pv-table tw" id="t-${id}"></div>
        </section>`;
  /* client landscape and unresolved records: counts and balances come straight from the model's groups */
  const RC = C.recent_closed;
  const nUC = G.under_contract.n + G.scheduled.n, nOpen = G.noprop.n + G.paused.n + nUC;
  const lc = (c, n, label, sub) => `<div class="lc" style="--c:${c}"><b>${S.int(n)}</b><span>${label}</span><small>${sub}</small></div>`;
  const LAND = `
        <section class="panel land" id="p-land" aria-labelledby="h-land">
          <div class="panel-head"><div class="ph"><div class="kick">1 · Where clients are today</div><h2 id="h-land">Our won deals today</h2>
            <p class="sub">Snapshot as of ${S.date(C.asof)}. Each is a Won Pipedrive deal, not necessarily a unique client.</p></div></div>
          <div class="land-grid">
            <div class="land-open">
              <div class="land-cap"><b>${S.int(nOpen)}</b> open won deals <span>by where they stand today</span></div>
              <div class="land-bar" role="img" aria-label="Open won deals: ${G.noprop.n} no property yet, ${G.paused.n} paused or Additional Service, ${nUC} under contract or closing scheduled">
                <i style="flex:${G.noprop.n};background:var(--wait)"></i><i style="flex:${G.paused.n};background:var(--sales)"></i><i style="flex:${nUC};background:var(--uc)"></i></div>
              <div class="land-cards">
                ${lc('var(--wait)', G.noprop.n, 'No property yet', `${pct(G.noprop.n / nOpen)} · ${S.int(NP.hunting)} hunting, ${S.int(NP.not_started)} won but not started`)}
                ${lc('var(--sales)', G.paused.n, 'Paused / Additional Service', `${pct(G.paused.n / nOpen)} · ${S.int(PA.paused_n)} paused, ${S.int(PA.additional_n)} Additional Service`)}
                ${lc('var(--uc)', nUC, 'Under Contract / closing scheduled', `${pct(nUC / nOpen)} · ${S.int(G.under_contract.n)} under contract, ${S.int(G.scheduled.n)} closing scheduled`)}
              </div>
            </div>
            <div class="land-recent">
              <div class="lr-k">Also: recently closed</div>
              ${lc('var(--closed)', RC.n, 'Closed in the last 30 days', `${S.date(RC.from)} – ${S.date(RC.to)}, from source closing dates. Part of the ${S.int(G.closed.n)} closings recorded to date, not a separate stage.`)}
              <p class="lr-note">Affiliate payouts for these closings may still be pending. They are not included in the forecast.</p>
            </div>
          </div>
        </section>`;
  const UNR = [
    ['unverified_closing', 'Post-close, no closing date', 'Jira shows a post-close status, but no closing date appears in any source, so it is unclear whether the balance has been collected.'],
    ['unverified_repeat', 'Repeat purchase without its own Jira issue', 'The client’s only Jira issue tracks their other won deal, so this purchase has no progress record.'],
    ['unverified_none', 'Won deal without matching records', `No Jira issue, e-mail or purchase record was found for the deal (${S.int(R.unverified_none_2024)} won in 2024, ${S.int(R.unverified_none_2026)} in 2026).`],
  ];
  const uN = UNR.reduce((a, r) => a + G[r[0]].n, 0), uB = UNR.reduce((a, r) => a + G[r[0]].outstanding, 0);
  const bal = v => `<td class="n" title="${money(v)}">${short(v)}</td>`;
  const UNRES = `
        <details class="panel unres" id="p-unres">
          <summary><span class="u-t"><span class="kick">4 · What reduces it</span>Unresolved records<small>Set aside: not in the forecast until their records are found</small></span>
            <span class="u-v"><b>${S.int(uN)}</b> won deals · <b>${short(uB)}</b> still owed</span></summary>
          <div class="tw"><table class="cf-t unr"><caption class="visually-hidden">Unresolved records kept out of the forecast, and probable duplicates</caption>
            <thead><tr><th scope="col">Category</th><th scope="col" class="n">Won deals</th><th scope="col" class="n">Balance still owed</th><th scope="col">Why it is excluded</th></tr></thead>
            <tbody>${UNR.map(([k, lab, why]) => `<tr><td>${lab}</td><td class="n">${S.int(G[k].n)}</td>${bal(G[k].outstanding)}<td class="rule">${why}</td></tr>`).join('')}
              <tr class="tot"><td>Unresolved total</td><td class="n">${S.int(uN)}</td>${bal(uB)}<td class="rule">Excluded from service collections, affiliate revenue and refunds.</td></tr>
              <tr class="grp"><th colspan="4" scope="rowgroup">Counted separately</th></tr>
              <tr><td>Probable duplicates</td><td class="n">${S.int(G.duplicate.n)}</td>${bal(G.duplicate.outstanding)}<td class="rule">Same client, won date and value as another deal. Counted once; not yet reconciled one by one.</td></tr></tbody></table></div>
        </details>`;
  const main = document.getElementById('main');
  const RY = AF.recorded_year;
  main.innerHTML = `
    <section class="cf-intro" aria-labelledby="cf-title">
      <div class="cf-kicker">Cash forecast · ${D.meta.version.label} reporting package</div>
      <h1 id="cf-title">How much more cash STRSearch can expect, and when</h1>
      <p>Service payments still to collect and affiliate revenue, less the refunds expected along the way. Change any assumption on the left and every number, chart and table updates instantly.</p>
      <div class="cf-chips"><span class="cf-chip">Data as of ${S.date(C.asof)}</span><span class="cf-chip">${S.int(C.view.engagements)} won deals reconciled</span></div>
    </section>
    <div class="cf-grid">
      <aside class="cf-controls" aria-label="Forecast assumptions">
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--wait)">${IC.clock}</span>Expected days until collection</h3>
          <div class="readout"><b id="o-day">–</b><span id="o-date">–</span></div>
          <div class="range"><div class="range-top"><label for="r-d">Clients still searching, and paused clients who resume</label></div>
            <input type="range" id="r-d" min="${OPT}" max="${DEF.expected_days_max}" step="1" style="--c:var(--wait)"><div class="range-ends"><span>${OPT} days (optimistic)</span><span id="o-dmax"></span></div></div>
          <p class="hint">${OPT} days = Under Contract tomorrow plus the typical ${U.median} days to closing. Payments spread around the chosen day the way past closings did (middle half ${U.p25}–${U.p75} days). The same day times projected refunds, so they move with collections.</p>
          <div class="range"><div class="range-top"><label for="r-max">Slider maximum</label><output id="o-max" for="r-max"></output></div>
            <input type="range" id="r-max" min="${OPT + 3}" max="240" step="1" style="--c:var(--hold)"></div>
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--sales)">${IC.pause}</span>Paused + Additional Service</h3>
          <div class="range"><div class="range-top"><label for="r-p">Share who eventually proceed</label><output id="o-p" for="r-p"></output></div>
            <input type="range" id="r-p" min="0" max="100" step="1" style="--c:var(--sales)"><div class="range-ends"><span>0% (all refunded)</span><span>100%</span></div></div>
          <p class="hint" id="o-p-hint"></p>
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--neg)">${IC.refund}</span>Refund size</h3>
          <div class="range"><div class="range-top"><label for="r-s">Share of the upfront payment returned</label><output id="o-s" for="r-s"></output></div>
            <input type="range" id="r-s" min="0" max="100" step="5" style="--c:var(--neg)"><div class="range-ends"><span>0% · none returned</span><span>100% · all returned</span></div></div>
          <p class="hint">Applies to future refunds only: paused or Additional Service clients who don’t proceed, and other clients expected to refund. The upfront payment is the first Split Pay installment, or the full Paid In Full price; a refunded client never pays the second installment. Clients already marked Refunded in Jira were paid back in the past and are not in the forecast. Refunds still show at 100% paused: clients still searching are refunded at the historical rate for their stage (${pct(NP.p_refund)}), and under-contract clients who don’t close at ${pct(H0.uc_fail_refund)}. The paused slider does not change these.</p>
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--closed)">${IC.partner}</span>Affiliate revenue</h3>
          <p class="hint">Conversion applies only where Jira has no recorded partner choice. A recorded preferred partner earns the fee; a recorded other partner, cash purchase or turnkey home earns nothing.</p>
          ${AFF.map(k => `<div class="aff" data-aff="${k}">
            <div class="aff-head"><b>${DEF.affiliates[k].label}</b><span id="o-${k}-val"></span></div>
            <div class="range"><div class="range-top"><label for="r-${k}-c">Conversion when no choice is recorded</label><output id="o-${k}-c"></output></div><input type="range" id="r-${k}-c" min="0" max="100" step="1" style="--c:var(--closed)"></div>
            <div class="range"><div class="range-top"><label for="r-${k}-r">Revenue per conversion</label><output id="o-${k}-r"></output></div><input type="range" id="r-${k}-r" min="0" max="10000" step="100" style="--c:var(--closed)"></div>
            <div class="hist" id="h-${k}"></div>
          </div>`).join('')}
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--acq)">${IC.scen}</span>Quick scenarios</h3>
          <div class="presets"><button class="btn" data-preset="opt" type="button">Optimistic</button><button class="btn" data-preset="bal" type="button">Balanced</button><button class="btn" data-preset="pes" type="button">Pessimistic</button>
            <button class="btn reset" id="b-reset" type="button">Reset every assumption</button></div>
          <p class="hint">The three scenarios change collection timing only.</p>
        </div>
      </aside>
      <div class="cf-results">
        ${LAND}
        <div class="kpis" id="kpis" aria-live="polite"></div>
        ${panel('bridge', 'From what clients still owe to the cash we expect', 'chart-wf', 'Waterfall from the balance still owed on client contracts to net expected cash, read left to right',
          'Read left to right. Red bars reduce the total, the green bar adds to it, and indigo bars are totals. Shaded steps are balances that are not future cash or not expected to be paid. Hover a bar to see what it includes.', 'feature', '2 · How much we expect')}
        ${panel('aff', 'Affiliate revenue by partner', 'chart-aff', 'Expected affiliate revenue for realtor, lender and STR Cribs, split into partner choices already recorded and assumed conversions',
          'Each expected closing counts in proportion to its chance of closing. A recorded preferred partner earns the fee, a recorded other partner, cash purchase or turnkey home earns nothing, and the conversion assumption applies only where no choice is recorded.')}
        ${panel('cash', 'Expected cash flow by month', 'chart-cash', 'Expected monthly collections by client group and affiliate revenue above zero, refunds below zero, and the net cash flow line',
          '', '', '3 · When the cash arrives')}
        ${panel('scen', 'Scenario comparison: when the cash arrives', 'chart-scen', 'Cumulative net cash flow under optimistic, current and pessimistic timing', '')}
        ${panel('ref', 'Where future refunds come from', 'chart-ref', 'Projected refunds by month and by source',
          `Future refunds only: the ${S.int(G.refunded.n)} clients already marked Refunded in Jira were paid back in the past and are not included. Refunds are timed with the same spread as collections.`, '', '4 · What reduces it')}
        ${UNRES}
        <section class="panel" id="p-groups" aria-labelledby="h-groups">
          <div class="panel-head"><div class="ph"><h2 id="h-groups">Every won deal, accounted for</h2><p class="sub">Each of the ${S.int(C.view.engagements)} won deals sits in exactly one row. “Still owed” is money still owed under contracts, from the reporting layer’s cash forecast view.</p></div></div>
          <div class="tw" id="t-groups"></div>
        </section>
        <section class="panel cf-notes" id="notes" aria-labelledby="h-notes">
          <div class="panel-head"><div class="ph"><h2 id="h-notes">Assumptions &amp; Methodology</h2><p class="sub">What the forecast assumes, in plain terms. The first group follows the controls on the left.</p></div></div>
          <div class="ag">
            <div class="ag-col"><h3>You control <span>· the sliders</span></h3><div class="ag-grid" id="ag-you"></div></div>
            <div class="ag-col"><h3>From STRSearch history and payment rules</h3><div class="ag-grid" id="ag-data"></div></div>
          </div>
          <details class="more" id="more"><summary>Full methodology</summary><div class="notes-body" id="notes-body"></div></details>
        </section>
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

  /* ------------------------------------------------------------------ chart helpers */
  let M = model(st), MM = monthly(M);
  const tip = (t, extra) => Object.assign(S.base(t).tooltip, { confine: true, extraCssText: S.base(t).tooltip.extraCssText + 'white-space:normal;max-width:340px;' }, extra);
  const tipBox = (t, title, rows, foot) => `<div style="min-width:220px"><b style="font-size:13.5px">${title}</b>${rows.map(r => {
    const sub = r[3] === 'sub', bold = r[3] === 'b';
    return `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:${sub ? 1 : 4}px;${sub ? `padding-left:14px;font-size:12.5px;color:${t.ink2}` : ''}${bold ? ';font-weight:700' : ''}"><span>${r[2] ? `<i style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:${r[2]}"></i>` : ''}${r[0]}</span><b>${r[1]}</b></div>`;
  }).join('')}${foot ? `<div style="margin-top:7px;color:${t.muted};font-size:12px;line-height:1.45">${foot}</div>` : ''}</div>`;
  // S.chart redraws on theme change; this also rebuilds the option when the width changes (waterfall orientation, label widths)
  function chart(node, build) {
    const rec = S.chart(node, build);
    if (window.ResizeObserver) {
      let w0 = node.offsetWidth, r0 = 0;
      new ResizeObserver(() => { const w = node.offsetWidth; if (w && Math.abs(w - w0) > 8) { w0 = w; cancelAnimationFrame(r0); r0 = requestAnimationFrame(() => rec.draw()); } }).observe(node);
    }
    return rec;
  }

  /* ------------------------------------------------------------------ waterfall */
  const PHASES = [{ a: 1, b: 4, label: 'Not future cash' }, { a: 5, b: 6, label: 'Not expected to pay', chart: 'Not expected\nto pay' }];
  function bridgeSteps() {
    const sched = C.view.scheduled_counted_collected, fixedDue = G.under_contract.second + G.scheduled.second;
    const nUnres = G.unverified_closing.n + G.unverified_repeat.n + G.unverified_none.n;
    return [
      { ax: 'Still owed on contracts', n: 'Still owed on contracts', v: contractual, kind: 'total',
        tip: `Money still owed under contracts, including ${money(sched)} for ${G.scheduled.n} closings scheduled after ${S.date(C.asof)}.` },
      { ax: 'Already refunded', n: 'Already refunded (past)', v: -G.refunded.outstanding,
        tip: `${S.int(G.refunded.n)} won deals refunded in the past. Already paid back, so not future cash.` },
      { ax: 'Records we can’t verify', n: 'Records we can’t verify', v: -unverified,
        tip: `${S.int(nUnres)} won deals with missing records. Kept out of the forecast until found.` },
      { ax: 'Duplicate deals', n: 'Duplicate deals', v: -G.duplicate.outstanding,
        tip: `${S.int(G.duplicate.n)} deals that repeat another deal (same client, date and value). Counted once.` },
      { ax: 'Already collected', n: 'Already collected at closing', v: -G.closed.outstanding,
        tip: `${S.int(G.closed.evidenced)} closings found in brokerage, lender or affiliate records. Second installment collected.` },
      { ax: 'Not expected to close', n: 'Not expected to close', v: -((fixedDue - M.tot.fixed) + (NP.second - NP.collect)),
        tip: `Expected to close: ${pct(G.under_contract.p_close)} under contract, ${pct(NP.p_close)} still searching.` },
      { ax: 'Paused, not returning', n: 'Paused, not returning', v: -(1 - st.p) * PA.second,
        tip: `${pct(1 - st.p)} of ${S.int(PA.n)} paused and Additional Service deals assumed not to proceed.` },
      { ax: 'Service collections', n: 'Expected service collections', v: M.tot.service, kind: 'sub', tip: 'Second installments expected to be collected.' },
      { ax: 'Affiliate revenue', n: 'Affiliate revenue', v: M.tot.aff, tip: 'Realtor, lender and STR Cribs fees on expected closings.' },
      { ax: 'Future refunds paid out', n: 'Future refunds paid out', v: M.tot.refund,
        tip: `Cash paid back to clients expected to refund: ${pct(st.s)} of their upfront payment.` },
      { ax: 'Net expected cash', n: 'Net expected future cash flow', v: M.tot.net, kind: 'total', tip: 'Service collections + affiliate revenue − future refunds.' },
    ];
  }
  const wfFill = (t, s) => (s.kind ? t.total : s.v < 0 ? t.neg : t.closed);
  const wfColor = s => (s.kind ? 'var(--total)' : s.v < 0 ? 'var(--neg)' : 'var(--closed)');
  const wfLabel = s => (s.kind ? short(s.v) : signed(s.v));
  const FONT = (w, z) => `${w} ${z}px Figtree, system-ui, sans-serif`;
  const FAM = 'Figtree, system-ui, sans-serif';
  const ctx2d = document.createElement('canvas').getContext('2d');
  const textW = (txt, font) => { ctx2d.font = font; return ctx2d.measureText(txt).width; };
  // left-to-right columns when every word of every step label fits its column at 12.5, 12 or 11.5px; otherwise rows (top to bottom)
  function wfLayout(W, steps) {
    const band = (W - 12) / steps.length;
    if (W >= 600) for (const z of [12.5, 12, 11.5]) {
      const need = Math.max(...steps.map(s => Math.max(...s.ax.split(/\s+/).map(w => textW(w, FONT(s.kind ? 700 : 400, z))))));
      if (band - 8 >= need) return { vert: true, z, labW: band - 6 };
    }
    return { vert: false, z: 12 };
  }
  const MONO = '600 10.5px "IBM Plex Mono", ui-monospace, monospace';
  const wfNode = $('c-bridge');
  const wfChart = chart(wfNode, () => {
    const t = tok(), steps = bridgeSteps(), n = steps.length, W = wfNode.offsetWidth, L = wfLayout(W, steps), vert = L.vert;
        $('f-bridge').textContent = `Read ${vert ? 'left to right' : 'top to bottom'}. Red reduces the total, green adds to it, indigo is a total. Already refunded = paid back in the past; future refunds = cash still to pay out. “Records we can’t verify” (${S.int(G.unverified_closing.n + G.unverified_repeat.n + G.unverified_none.n)} won deals) = ${S.int(G.unverified_closing.n)} with a post-close status but no closing date, ${S.int(G.unverified_repeat.n)} repeat purchases without their own Jira issue, and ${S.int(G.unverified_none.n)} with no matching record. They stay out of the forecast until found. Shaded steps are not future cash or not expected to pay. ${vert ? 'Hover' : 'Tap'} a bar for detail.`;
    let run = 0;
    const geo = steps.map(s => {
      let lo, hi;
      if (s.kind) { lo = 0; hi = s.v; run = s.v; } else if (s.v < 0) { hi = run; run += s.v; lo = run; } else { lo = run; run += s.v; hi = run; }
      return [lo, hi, run];
    });
    const top = Math.max(...geo.map(g => g[1]), 1);
    const startOf = Object.fromEntries(PHASES.map(p => [p.a, p]));
    const valLabel = (s, i, x, y, align, vAlign) => (i === n - 1
      ? { x, y, text: wfLabel(s), align, verticalAlign: vAlign, fill: t.surface, backgroundColor: t.total, padding: [5, 9], borderRadius: 7, font: FONT(700, 15) }
      : { x, y, text: wfLabel(s), align, verticalAlign: vAlign, fill: s.kind ? t.ink : t.ink2, font: FONT(s.kind ? 700 : 600, s.kind ? 14 : 13) });
    const barV = (p, api) => {
      const i = api.value(0), [lo, hi, end] = geo[i], s = steps[i], cs = p.coordSys;
      const band = api.size([1, 0])[0], bw = Math.max(16, Math.min(64, band * 0.6));
      const cx = api.coord([i, hi])[0], yHi = api.coord([i, hi])[1], yLo = api.coord([i, lo])[1], h = Math.max(2, yLo - yHi);
      const kids = [
        { type: 'rect', shape: { x: cx - band / 2, y: cs.y, width: band, height: cs.height }, style: { fill: 'rgba(0,0,0,0)' } },
        { type: 'rect', shape: { x: cx - bw / 2, y: yLo - h, width: bw, height: h, r: 4 }, style: { fill: wfFill(t, s) } },
        { type: 'text', silent: true, style: valLabel(s, i, cx, yLo - h - (i === n - 1 ? 10 : 7), 'center', 'bottom') },
      ];
      if (i < n - 1) {
        const yE = api.coord([i, end])[1], nx = api.coord([i + 1, end])[0];
        kids.push({ type: 'line', silent: true, shape: { x1: cx + bw / 2 + 2, y1: yE, x2: nx - bw / 2 - 2, y2: yE }, style: { stroke: t.muted, lineWidth: 1, lineDash: [3, 3], opacity: 0.75 } });
      }
      return { type: 'group', children: kids };
    };
    const barH = (p, api) => {
      const i = api.value(0), [lo, hi, end] = geo[i], s = steps[i], cs = p.coordSys;
      const band = api.size([0, 1])[1], bh = Math.max(12, Math.min(22, band * 0.56));
      const cy = api.coord([lo, i])[1], xLo = api.coord([lo, i])[0], xHi = api.coord([hi, i])[0], w = Math.max(2, xHi - xLo);
      const kids = [
        { type: 'rect', shape: { x: cs.x, y: cy - band / 2, width: cs.width, height: band }, style: { fill: 'rgba(0,0,0,0)' } },
        { type: 'rect', shape: { x: xLo, y: cy - bh / 2, width: w, height: bh, r: 4 }, style: { fill: wfFill(t, s) } },
        { type: 'text', silent: true, style: valLabel(s, i, xLo + w + (i === n - 1 ? 8 : 6), cy, 'left', 'middle') },
      ];
      if (i < n - 1) {
        const xE = api.coord([end, i])[0], ny = api.coord([end, i + 1])[1];
        kids.push({ type: 'line', silent: true, shape: { x1: xE, y1: cy + bh / 2 + 2, x2: xE, y2: ny - bh / 2 - 2 }, style: { stroke: t.muted, lineWidth: 1, lineDash: [3, 3], opacity: 0.75 } });
      }
      return { type: 'group', children: kids };
    };
    const phase = (p, api) => {
      const ph = PHASES[p.dataIndex], cs = p.coordSys;
      if (vert) {
        const band = api.size([1, 0])[0], x0 = api.coord([ph.a, 0])[0] - band / 2 + 3, x1 = api.coord([ph.b, 0])[0] + band / 2 - 3, y0 = cs.y - 30;
        return { type: 'group', silent: true, children: [
          { type: 'rect', shape: { x: x0, y: y0, width: x1 - x0, height: api.getHeight() - y0 - 2, r: 10 }, style: { fill: t.band } },
          { type: 'text', style: { x: x0 + 10, y: y0 + 9, text: (ph.chart || ph.label).toUpperCase(), fill: t.muted, font: MONO, verticalAlign: 'top', width: x1 - x0 - 18, overflow: 'break', lineHeight: 14 } },
        ] };
      }
      const band = api.size([0, 1])[1], y0 = api.coord([0, ph.a])[1] - band / 2 + 1, y1 = api.coord([0, ph.b])[1] + band / 2 - 1;
      return { type: 'group', silent: true, children: [{ type: 'rect', shape: { x: 2, y: y0, width: api.getWidth() - 4, height: y1 - y0, r: 10 }, style: { fill: t.band } }] };
    };
    const cat = {
      type: 'category', data: steps.map(s => s.ax), axisTick: { show: false }, z: 6,
      axisLine: { show: vert, lineStyle: { color: t.axis } },
      axisLabel: vert
        ? { interval: 0, width: L.labW, overflow: 'break', lineHeight: L.z + 2.5, fontSize: L.z, fontFamily: FAM, color: t.ink2, margin: 12,
          formatter: (v, i) => (steps[i].kind ? `{b|${v}}` : v), rich: { b: { fontWeight: 700, color: t.ink, fontSize: L.z, fontFamily: FAM, lineHeight: L.z + 2.5 } } }
        : { interval: 0, width: 118, overflow: 'break', lineHeight: 14, fontSize: 12, fontFamily: FAM, color: t.ink2, margin: 10,
          formatter: (v, i) => (startOf[i] ? `{p|${startOf[i].label.toUpperCase()}}\n` : '') + (steps[i].kind ? `{b|${v}}` : v),
          rich: { b: { fontWeight: 700, color: t.ink, fontSize: 12, fontFamily: FAM, lineHeight: 14 }, p: { fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontSize: 9.5, fontWeight: 600, color: t.muted, lineHeight: 14 } } },
    };
    const val = { type: 'value', min: 0, max: top * (vert ? 1.13 : 1.36), show: false };
    return Object.assign(S.base(t), {
      animationDurationUpdate: 300,
      grid: vert ? { left: 6, right: 6, top: 40, bottom: 4, containLabel: true } : { left: 6, right: 8, top: 6, bottom: 6, containLabel: true },
      tooltip: tip(t, { trigger: 'item', formatter: p => {
        if (p.seriesIndex !== 1) return '';
        const s = steps[p.dataIndex], end = geo[p.dataIndex][2];
        const rows = s.kind ? [['Total', money(s.v), wfFill(t, s)]] : [[s.v < 0 ? 'Reduces the total by' : 'Adds', money(Math.abs(s.v)), wfFill(t, s)], ['Running total after this step', money(end)]];
        return tipBox(t, s.n, rows, s.tip);
      } }),
      xAxis: vert ? cat : val,
      yAxis: vert ? val : Object.assign(cat, { inverse: true }),
      series: [
        { type: 'custom', renderItem: phase, data: PHASES.map(p => [p.a, p.b]), silent: true, z: 1, tooltip: { show: false } },
        { type: 'custom', renderItem: vert ? barV : barH, data: geo.map((g, i) => [i, g[0], g[1]]), encode: vert ? { x: 0, y: [1, 2] } : { y: 0, x: [1, 2] }, z: 3 },
      ],
    });
  });

  /* ------------------------------------------------------------------ monthly cash flow */
  const SRC = t => [
    { k: 'fixed', name: 'Under contract or scheduled', color: t.uc },
    { k: 'noprop', name: 'Still searching', color: t.wait },
    { k: 'paused', name: 'Paused / Additional Service, resuming', color: t.sales },
    { k: 'aff', name: 'Affiliate revenue', color: t.closed },
    { k: 'refund', name: 'Future refunds paid out', color: t.neg },
  ];
  const POS = ['fixed', 'noprop', 'paused', 'aff'];
  const shadow = t => ({ type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } });
  const monthTitle = r => mFull(r.k) + (r.k === mKey(0) ? ' (from ' + dShort(1) + ')' : '');
  const mMid = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  let cashDetail = false;                    // false: service collections as one bar; true: split by client group
  const cashSeriesDef = t => (cashDetail ? SRC(t) : [
    { k: 'service', name: 'Service collections', color: t.uc },
    { k: 'aff', name: 'Affiliate revenue', color: t.closed },
    { k: 'refund', name: 'Future refunds paid out', color: t.neg },
  ]);
  const cashChart = chart($('c-cash'), () => {
    const t = tok(), src = SRC(t), ser = cashSeriesDef(t), pos = ser.map(x => x.k).filter(k => k !== 'refund'), narrow = $('c-cash').offsetWidth < 560;
    const eps = Math.max(1, ...MM.map(r => r.inflow)) * 0.005, topKey = r => { for (let i = pos.length - 1; i >= 0; i--) if (r[pos[i]] > eps) return pos[i]; return null; };
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 10, top: 30, bottom: 8, containLabel: true },
      tooltip: tip(t, { trigger: 'axis', axisPointer: shadow(t), formatter: ps => {
        const r = MM[ps[0].dataIndex];
        return tipBox(t, monthTitle(r), [['Service collections', money(r.service), cashDetail ? null : t.uc, 'b']]
          .concat(src.slice(0, 3).filter(s => Math.abs(r[s.k]) > 0.5).map(s => [s.name, money(r[s.k]), cashDetail ? s.color : null, 'sub']))
          .concat([['Affiliate revenue', money(r.aff), t.closed], ['Future refunds paid out', money(r.refund), t.neg], ['Net this month', money(r.net), null, 'b'], ['Running total', money(r.cum)]]));
      } }),
      xAxis: { type: 'category', data: MM.map(r => mLab(r.k)), axisLine: { onZero: true, lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.label, fontSize: 12, interval: narrow ? 'auto' : 0 } },
      yAxis: S.valAxis(t, { axisLabel: { color: t.label, fontSize: 12, formatter: v => short(v) } }),
      series: ser.map(s => ({ name: s.name, type: 'bar', stack: 'c', barMaxWidth: 56,
        data: MM.map(r => ({ value: Math.round(r[s.k]), itemStyle: { borderRadius: s.k === 'refund' ? [0, 0, 4, 4] : topKey(r) === s.k ? [4, 4, 0, 0] : 0 } })),
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } }))
        .concat([{ name: 'Net', type: 'line', data: MM.map(r => Math.round(r.net)), symbol: 'circle', symbolSize: 8, z: 5,
          lineStyle: { color: t.ink, width: 2 }, itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 },
          label: { show: true, position: 'top', distance: 9, formatter: p => short(p.value), color: t.ink, fontSize: 12, fontWeight: 700, fontFamily: FAM,
            backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 6, padding: [2, 6] } }]),
    });
  });
  function cashLegend() {
    const t = tok(), srcs = SRC(t), LGC = ['var(--uc)', 'var(--wait)', 'var(--sales)', 'var(--closed)', 'var(--neg)'];
    const lgi = (s, i) => `<span><i style="background:${LGC[i]}"></i>${s.name}</span>`;
    const btn = $('b-detail'); btn.setAttribute('aria-pressed', String(cashDetail)); btn.textContent = cashDetail ? 'Hide client groups' : 'Split by client group';
    $('lg-cash').innerHTML = (cashDetail
      ? `<span class="lg-g"><span class="lg-h">Service collections</span>${srcs.slice(0, 3).map(lgi).join('')}</span>${srcs.slice(3).map((s, i) => lgi(s, i + 3)).join('')}`
      : `<span><i style="background:var(--uc)"></i>Service collections</span><span><i style="background:var(--closed)"></i>Affiliate revenue</span><span><i style="background:var(--neg)"></i>Future refunds paid out</span>`)
      + `<span><i class="ln" style="background:var(--ink)"></i>Net (cash in minus refunds)</span>`;
    $('f-cash').textContent = cashDetail
      ? 'Service collections split by client group. Each bar is one month’s cash, not a running total. The line is the month’s net (cash in minus refunds), not extra cash.'
      : 'Each bar is one month’s cash, not a running total. Blue and green bars are cash in; red is refunds paid out. The line is the month’s net (cash in minus refunds), not extra cash.';
  }

  /* ------------------------------------------------------------------ refunds by source */
  const RSRC = t => [
    { k: 'refPA', name: 'Paused / Additional Service, not proceeding', color: t.sales, css: 'var(--sales)' },
    { k: 'refNP', name: 'Still searching, expected to refund', color: t.wait, css: 'var(--wait)' },
    { k: 'refUC', name: 'Under contract or scheduled, not closing', color: t.uc, css: 'var(--uc)' },
  ];
  function refRows() {
    const has = r => Math.abs(r.refund) >= 0.5, a = MM.findIndex(has);
    if (a < 0) return [];
    let b = MM.length - 1; while (b > a && !has(MM[b])) b--;
    return MM.slice(a, b + 1);
  }
  const refChart = chart($('c-ref'), () => {
    const t = tok(), src = RSRC(t), rows = refRows();
    const eps = Math.max(1, ...rows.map(r => -r.refund)) * 0.005, botKey = r => { for (let i = src.length - 1; i >= 0; i--) if (r[src[i].k] < -eps) return src[i].k; return null; };
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 10, top: 14, bottom: 8, containLabel: true },
      tooltip: tip(t, { trigger: 'axis', axisPointer: shadow(t), formatter: ps => {
        const r = rows[ps[0].dataIndex];
        return tipBox(t, monthTitle(r), src.filter(s => Math.abs(r[s.k]) > 0.5).map(s => [s.name, money(r[s.k]), s.color]).concat([['Refunds this month', money(r.refund), null, 'b']]));
      } }),
      xAxis: { type: 'category', data: rows.map(r => mLab(r.k)), axisLine: { onZero: false, lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.label, fontSize: 12 } },
      yAxis: S.valAxis(t, { max: 0, axisLabel: { color: t.label, fontSize: 12, formatter: v => short(v) } }),
      series: src.map(s => ({ name: s.name, type: 'bar', stack: 'r', barMaxWidth: 52,
        data: rows.map(r => ({ value: Math.round(r[s.k]), itemStyle: { borderRadius: botKey(r) === s.k ? [0, 0, 4, 4] : 0 } })),
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } })),
    });
  });

  /* ------------------------------------------------------------------ affiliate revenue by partner */
  const affChart = chart($('c-aff'), () => {
    const t = tok(), P = affParts(st), mx = Math.max(...AFF.map(k => P[k].total), 1);
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 66, top: 4, bottom: 4, containLabel: true },
      tooltip: tip(t, { trigger: 'axis', axisPointer: shadow(t), formatter: ps => {
        const p = P[AFF[ps[0].dataIndex]];
        return tipBox(t, p.label, [
          ['Partner already chosen', money(p.chosen), t.closed], [`${S.d1(p.known)} expected closings × ${money(p.rev)}`, '', null, 'sub'],
          ['Assumed conversions', money(p.assumed), t.closed2], [`${pct(p.conv)} of ${S.d1(p.unk)} with no recorded choice × ${money(p.rev)}`, '', null, 'sub'],
          ['Expected revenue', money(p.total), null, 'b']]);
      } }),
      yAxis: { type: 'category', inverse: true, data: AFF.map(k => P[k].label), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: t.ink, fontSize: 13, fontWeight: 600, margin: 12 } },
      xAxis: { type: 'value', min: 0, max: mx * 1.02, show: false },
      series: [
        { name: 'Partner already chosen', type: 'bar', stack: 'a', barWidth: 28,
          data: AFF.map(k => ({ value: Math.round(P[k].chosen), itemStyle: { borderRadius: P[k].assumed < 0.5 ? [0, 4, 4, 0] : 0 } })),
          itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } },
        { name: 'Assumed conversions', type: 'bar', stack: 'a', barWidth: 28, data: AFF.map(k => Math.round(P[k].assumed)),
          itemStyle: { color: t.closed2, borderColor: t.closed, borderWidth: 1.5, borderRadius: [0, 4, 4, 0] }, emphasis: { focus: 'series' },
          label: { show: true, position: 'right', distance: 8, color: t.ink, fontSize: 13.5, fontWeight: 700, formatter: p => short(P[AFF[p.dataIndex]].total) } },
      ],
    });
  });

  /* ------------------------------------------------------------------ scenarios */
  const scenarios = () => [
    { key: 'opt', name: 'Optimistic', s: Object.assign({}, st, { d: OPT }) },
    { key: 'cur', name: 'Your setting', s: st },
    { key: 'pes', name: 'Pessimistic', s: Object.assign({}, st, { d: st.max }) },
  ].map(x => Object.assign(x, { m: model(x.s) }));
  const scenChart = chart($('c-scen'), () => {
    const t = tok(), sc = scenarios(), H = Math.max(...sc.map(x => x.m.H));
    const col = { opt: t.sp2, cur: t.acq, pes: t.hold };
    const pts = x => { const out = []; for (let d = 0; d <= H; d++) out.push([at(d).getTime(), Math.round(x.m.cum[Math.min(d, x.m.H)])]); return out; };
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 14, top: 14, bottom: 8, containLabel: true },
      tooltip: tip(t, { trigger: 'axis', formatter: ps => tipBox(t, 'By ' + new Date(ps[0].value[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        ps.map(p => [sc[p.seriesIndex].name, money(p.value[1]), col[sc[p.seriesIndex].key]])) }),
      xAxis: { type: 'time', axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { color: t.label, fontSize: 11.5, formatter: '{MMM} ’{yy}' } },
      yAxis: S.valAxis(t, { axisLabel: { color: t.label, fontSize: 11.5, formatter: v => short(v) } }),
      series: sc.map(x => ({ name: x.name, type: 'line', showSymbol: false, data: pts(x), z: x.key === 'cur' ? 3 : 2,
        lineStyle: { color: col[x.key], width: x.key === 'cur' ? 3 : 2, type: x.key === 'pes' ? [6, 4] : 'solid' }, itemStyle: { color: col[x.key] }, emphasis: { disabled: true } })),
    });
  });

  /* ------------------------------------------------------------------ tables (sortable, follow the sliders) */
  const SORT = {};
  function dataTable(host, id, cols, rows, opt) {
    opt = opt || {};
    const sortable = opt.sortable !== false, so = SORT[id] || (SORT[id] = { k: null, dir: -1 });
    let body = rows.slice();
    if (sortable && so.k && cols.some(x => x.k === so.k)) {
      const c = cols.find(x => x.k === so.k), v = r => (c.sv ? c.sv(r) : r[c.k]);
      body = body.filter(r => !r._group).sort((a, b) => { const va = v(a), vb = v(b); return (va > vb ? 1 : va < vb ? -1 : 0) * so.dir; });
    }
    const cell = (c, r) => `<td class="${c.num ? 'n' : ''}${c.cls ? ' ' + c.cls : ''}"${c.title && r._total !== true ? ` title="${c.title(r)}"` : ''}>${c.html ? c.html(r) : c.fmt ? c.fmt(r[c.k], r) : (r[c.k] == null ? '' : r[c.k])}</td>`;
    const head = cols.map(c => {
      const s = sortable && c.sort !== false;
      return `<th scope="col" class="${c.num ? 'n' : ''}${c.hcls ? ' ' + c.hcls : ''}"${s ? ` aria-sort="${so.k === c.k ? (so.dir > 0 ? 'ascending' : 'descending') : 'none'}"` : ''}>${s ? `<button type="button" data-k="${c.k}">${c.label}</button>` : c.label}</th>`;
    }).join('');
    const tr = r => (r._group ? `<tr class="grp"><th colspan="${cols.length}" scope="rowgroup">${r._group}</th></tr>` : `<tr${r._cls ? ` class="${r._cls}"` : ''}>${cols.map(c => cell(c, r)).join('')}</tr>`);
    host.innerHTML = `<table class="cf-t dt${opt.cls ? ' ' + opt.cls : ''}"><caption class="visually-hidden">${opt.caption || ''}</caption><thead><tr>${head}</tr></thead><tbody>${body.map(tr).join('')}</tbody>${opt.total ? `<tfoot><tr>${cols.map(c => cell(c, Object.assign({ _total: true }, opt.total))).join('')}</tr></tfoot>` : ''}</table><p class="t-hint"><span class="t-swipe">Swipe sideways to see every column. </span>${sortable ? 'Select a column heading to sort; select it again to reverse, a third time to restore the original order.' : ''}</p>`;
    host.classList.toggle('scrolls', host.scrollWidth > host.clientWidth + 2);
    if (sortable) host.querySelectorAll('th button').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k, c = cols.find(x => x.k === k), first = c.num ? -1 : 1;
      if (so.k !== k) { so.k = k; so.dir = first; } else if (so.dir === first) so.dir = -first; else so.k = null;
      dataTable(host, id, cols, rows, opt);
      const again = host.querySelector(`th button[data-k="${k}"]`); if (again) again.focus();
    }));
  }
  const sw = c => `<span class="sw" style="background:${c}"></span>`;

  function bridgeTable() {
    const steps = bridgeSteps(), rows = []; let run = 0;
    steps.forEach((s, i) => {
      const ph = PHASES.find(p => p.a === i); if (ph) rows.push({ _group: ph.label });
      run = s.kind ? s.v : run + s.v;
      rows.push({ step: s.n, v: s.v, run, tip: s.tip, kind: s.kind, color: wfColor(s), _cls: s.kind ? 'tot' : '' });
    });
    dataTable($('t-bridge'), 'bridge', [
      { k: 'step', label: 'Step', html: r => sw(r.color) + r.step },
      { k: 'v', label: 'Amount', num: true, html: r => (r.kind ? short(r.v) : signed(r.v)), title: r => money(r.v) },
      { k: 'run', label: 'Running total', num: true, fmt: short, title: r => money(r.run) },
      { k: 'tip', label: 'What it includes', cls: 'rule' },
    ], rows, { sortable: false, cls: 'steps', caption: 'From the balance still owed on contracts to net expected cash, step by step' });
  }
  function cashTable() {
    const rows = MM.map(r => ({ k: r.k, month: mMid(r.k) + (r.k === mKey(0) ? ' (from ' + dShort(1) + ')' : ''), service: r.service, fixed: r.fixed, noprop: r.noprop, paused: r.paused, aff: r.aff, refund: r.refund, net: r.net, cum: r.cum }));
    const mcol = (k, label, extra) => Object.assign({ k, label, num: true, fmt: cellM, title: r => money(r[k]) }, extra);
    const grp = cashDetail ? [mcol('fixed', 'Under contract / scheduled', { cls: 'dim', hcls: 'dim' }), mcol('noprop', 'Still searching', { cls: 'dim', hcls: 'dim' }), mcol('paused', 'Paused, resuming', { cls: 'dim', hcls: 'dim' })] : [];
    dataTable($('t-cash'), 'cash', [
      { k: 'month', label: 'Month', sv: r => r.k },
      mcol('service', 'Service collections')].concat(grp, [mcol('aff', 'Affiliate revenue'), mcol('refund', 'Future refunds'),
      mcol('net', 'Net cash', { cls: 'strong' }), mcol('cum', 'Running total')]),
    rows, { total: { month: 'Total', service: M.tot.service, fixed: M.tot.fixed, noprop: M.tot.noprop, paused: M.tot.paused, aff: M.tot.aff, refund: M.tot.refund, net: M.tot.net, cum: M.tot.net }, caption: 'Expected cash flow by month' });
  }
  function refTable() {
    const src = RSRC(tok()), months = refRows();
    const shown = months.length > 6 ? months.slice(0, 5) : months, later = months.length > 6 ? months.slice(5) : [];
    const driver = {
      refPA: `${pct(1 - st.p)} of ${S.int(PA.n)} paused / Additional Service clients don’t proceed and get ${pct(st.s)} of their upfront payment back`,
      refNP: `${S.int(NP.n)} clients still searching: ${pct(NP.p_refund)} expected to refund, like past clients at the same stage`,
      refUC: `${S.int(G.under_contract.n + G.scheduled.n)} clients under contract or scheduled: ${pct(H0.uc_fail_refund)} of past clients who didn’t close were refunded`,
    };
    const tot = M.tot.refund;
    const rows = src.map(s => Object.assign({ name: s.name, css: s.css, k: s.k, total: M.tot[s.k], share: tot ? M.tot[s.k] / tot : 0, later: later.reduce((a, r) => a + r[s.k], 0) },
      Object.fromEntries(shown.map(r => ['m' + r.k, r[s.k]]))));
    const T = Object.assign({ name: 'Total', total: tot, share: tot ? 1 : 0, later: later.reduce((a, r) => a + r.refund, 0) }, Object.fromEntries(shown.map(r => ['m' + r.k, r.refund])));
    dataTable($('t-ref'), 'ref', [
      { k: 'name', label: 'Refund source', html: r => (r._total ? 'Total' : `${sw(r.css)}${r.name}<small>${driver[r.k]}</small>`) },
      { k: 'total', label: 'Expected refunds', num: true, fmt: cellM, title: r => money(r.total), cls: 'strong' },
      { k: 'share', label: 'Share', num: true, fmt: v => (v ? pct(v) : '–') },
    ].concat(shown.map(r => ({ k: 'm' + r.k, label: mLab(r.k), num: true, hcls: 'nw', fmt: cellM, title: x => money(x['m' + r.k]) })))
      .concat(later.length ? [{ k: 'later', label: 'Later', num: true, fmt: cellM, title: r => money(r.later) }] : []),
    rows, { total: T, caption: 'Projected refunds by source and month' });
  }
  function affTable() {
    const P = affParts(st), tot = AFF.reduce((a, k) => a + P[k].total, 0);
    const rows = AFF.map(k => Object.assign({ k, share: tot ? P[k].total / tot : 0 }, P[k]));
    dataTable($('t-aff'), 'aff', [
      { k: 'label', label: 'Partner', html: r => (r._total ? 'Total' : `${sw('var(--closed)')}${r.label}<small>${S.int(r.known)} expected closings already chose this partner · ${S.int(r.unk)} with no recorded choice</small>`) },
      { k: 'conv', label: 'Conversion (no choice recorded)', num: true, fmt: (v, r) => (r._total ? '' : pct(v)) },
      { k: 'paying', label: 'Expected paying closings', num: true, fmt: v => (v == null ? '' : S.int(v)) },
      { k: 'rev', label: 'Revenue per conversion', num: true, fmt: (v, r) => (r._total ? '' : money(v)) },
      { k: 'total', label: 'Expected revenue', num: true, fmt: cellM, title: r => money(r.total), cls: 'strong' },
      { k: 'share', label: 'Share', num: true, fmt: v => (v ? pct(v) : '–') },
    ], rows, { total: { label: 'Total', paying: null, total: tot, share: tot ? 1 : 0 }, caption: 'Expected affiliate revenue by partner' });
  }
  function scenTable() {
    const sc = scenarios(), ends = [2, 3, 4].map(lastMonthEnd), cur = sc[1];
    const delta = (x, v, ref) => (x.key === 'cur' || Math.abs(v - ref) < 500 ? '' : `<small>${signed(v - ref)} vs your setting</small>`);
    const rows = sc.map(x => Object.assign({ key: x.key, name: x.name, d: x.s.d, timing: `${x.s.d} days · centred on ${dShort(x.s.d)}`, total: x.m.tot.net, _cls: x.key === 'cur' ? 'cur' : '' },
      Object.fromEntries(ends.map((d, i) => ['e' + i, x.m.within(d)])), { _ref: Object.fromEntries(ends.map((d, i) => ['e' + i, cur.m.within(d)])) }));
    dataTable($('t-scen'), 'scen', [
      { k: 'name', label: 'Scenario', cls: 'strong' },
      { k: 'timing', label: 'Collection timing', sv: r => r.d },
    ].concat(ends.map((d, i) => ({ k: 'e' + i, label: `Running total by ${dShort(d)}`, num: true, html: r => short(r['e' + i]) + delta(r, r['e' + i], r._ref['e' + i]), title: r => money(r['e' + i]) })))
      .concat([{ k: 'total', label: 'Net total', num: true, fmt: short, title: r => money(r.total) }]),
    rows, { caption: 'Running total of net cash by date', cls: 'scen' });
  }
  function groupsTable() {
    const XU = G.under_contract.expected, XS = G.scheduled.expected;
    const spec = [
      { _group: 'In the forecast' },
      ['under_contract', 'var(--uc)', XU.svc, -st.s * XU.refund_base, affValue(XU.aff, st), `${pct(G.under_contract.p_close)} expected to close, from past clients who had waited as long; timed by the remaining historical Under Contract → closing times (${S.int(U.n)} closings, median ${U.median} days)`],
      ['scheduled', 'var(--uc)', XS.svc, -st.s * XS.refund_base, affValue(XS.aff, st), `${pct(G.scheduled.p_close)} expected to close on the scheduled date (all by ${S.date(C.notes.scheduled_dates_to)}); the cash forecast view already counts these ${short(C.view.scheduled_counted_collected)} as collected`],
      ['noprop', 'var(--wait)', M.tot.noprop, -st.s * NP.refund_base, affValue(NP.aff, st), `${S.int(NP.hunting)} searching + ${S.int(NP.not_started)} won but not started; like past clients at the same stage: ${pct(NP.p_close)} close, ${pct(NP.p_refund)} refund, ${pct(NP.p_pause)} pause or keep searching`],
      ['paused', 'var(--sales)', M.tot.paused, -st.s * (1 - st.p) * PA.paid, st.p * affValue(PA.aff, st), `${pct(st.p)} proceed and pay the second installment; ${pct(1 - st.p)} are refunded ${pct(st.s)} of their upfront payment and never pay the second installment`],
      { _group: 'Set aside: not future cash' },
      ['refunded', null, 0, 0, 0, 'Refund already paid back (historical): nothing more to collect or refund'],
      ['closed', null, 0, 0, 0, `Second installment collected at the recorded closing (incl. ${S.int(G.closed.evidenced)} closings found in affiliate or brokerage records)`],
      ['unverified_closing', null, 0, 0, 0, 'Missing: closing date. Post-close Jira status but no closing in any source'],
      ['unverified_repeat', null, 0, 0, 0, 'Missing: a Jira issue for this purchase. The client’s only issue tracks their other won deal'],
      ['unverified_none', null, 0, 0, 0, `Missing: any Jira, e-mail or purchase record (${S.int(R.unverified_none_2024)} won in 2024, ${S.int(R.unverified_none_2026)} in 2026)`],
      ['duplicate', null, 0, 0, 0, 'Same client, won date and value as a Jira-linked deal: counted once'],
    ];
    const T = { label: 'Total', n: 0, bal: 0, svc: 0, ref: 0, aff: 0 };
    const rows = spec.map(x => {
      if (!Array.isArray(x)) return x;
      const [k, col, svc, ref, aff, rule] = x, g = G[k], bal = g.outstanding + (k === 'scheduled' ? C.view.scheduled_counted_collected : 0);
      T.n += g.n; T.bal += bal; T.svc += svc; T.ref += ref; T.aff += aff;
      return { label: k === 'refunded' ? 'Already refunded (past)' : g.label, col, n: g.n, bal, svc, ref, aff, rule, _cls: svc || ref || aff ? '' : 'ex' };
    });
    T.rule = `Net ${short(T.svc + T.ref + T.aff)}`;
    dataTable($('t-groups'), 'groups', [
      { k: 'label', label: 'Group', html: r => (r._total ? 'Total' : sw(r.col || 'var(--line-2)') + r.label) },
      { k: 'n', label: 'Won deals', num: true, fmt: v => S.int(v) },
      { k: 'bal', label: 'Still owed', num: true, fmt: cellM, title: r => money(r.bal) },
      { k: 'svc', label: 'Service collections', num: true, fmt: cellM, title: r => money(r.svc) },
      { k: 'ref', label: 'Refunds', num: true, fmt: cellM, title: r => money(r.ref) },
      { k: 'aff', label: 'Affiliate revenue', num: true, fmt: cellM, title: r => money(r.aff) },
      { k: 'rule', label: 'How it’s treated', cls: 'rule' },
    ], rows, { sortable: false, total: T, cls: 'groups', caption: 'Every won deal and how the forecast treats it' });
  }

  /* ------------------------------------------------------------------ chart / table toggles */
  const VIEWS = {
    bridge: { chart: () => wfChart, table: bridgeTable },
    cash: { chart: () => cashChart, table: cashTable },
    ref: { chart: () => refChart, table: refTable },
    aff: { chart: () => affChart, table: affTable },
    scen: { chart: () => scenChart, table: scenTable },
  };
  const isTable = id => $('p-' + id).classList.contains('is-table');
  document.querySelectorAll('.vt button').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.for, table = b.dataset.view === 'table';
    $('p-' + id).classList.toggle('is-table', table);
    $('p-' + id).querySelectorAll('.vt button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (table) VIEWS[id].table(); else VIEWS[id].chart().draw();
  }));

  $('p-cash').addEventListener('click', e => {
    if (!e.target.closest('#b-detail')) return;
    cashDetail = !cashDetail; cashLegend();
    if (isTable('cash')) cashTable(); else cashChart.draw();
    $('b-detail').focus();
  });

  /* ------------------------------------------------------------------ render */
  function render() {
    M = model(st); MM = monthly(M);
    const P = affParts(st);
    $('o-day').textContent = st.d + ' days';
    $('o-date').textContent = 'centred on ' + dLong(st.d);
    $('o-dmax').textContent = st.max + ' days (pessimistic)';
    $('o-max').textContent = st.max + ' days';
    $('o-p').textContent = pct(st.p);
    $('o-p-hint').textContent = `${S.int(PA.paused_n)} paused and ${S.int(PA.additional_n)} Additional Service clients. Those who proceed pay their second installment (${short(st.p * PA.second)}). Those who don’t are refunded ${pct(st.s)} of their upfront payment, paid back and subtracted from net cash (−${short((1 - st.p) * PA.paid * st.s)}), and never pay the second installment.`;
    $('o-s').textContent = pct(st.s);
    AFF.forEach(k => {
      $('o-' + k + '-c').textContent = pct(st.aff[k].conv); $('o-' + k + '-r').textContent = money(st.aff[k].rev);
      $('o-' + k + '-val').textContent = short(P[k].total);
      const histFee = k === 'realtor' ? `median referral fee ${money(AF.realtor.median_fee)}` : k === 'lender' ? `median amount due ${money(AF.lender.median_due)}` : `typical fee ${money(AF.cribs.typical_fee)}`;
      $('h-' + k).innerHTML = `Expected closings: <b>${Math.round(P[k].known)}</b> with this partner recorded, <b>${Math.round(P[k].unk)}</b> unrecorded · history: ${pct(RY[k])} of ${AF.year_label} closings, ${histFee}`;
    });
    document.querySelectorAll('.presets [data-preset]').forEach(b => b.setAttribute('aria-pressed', String(presetDay(b.dataset.preset) === st.d)));
    $('kpis').innerHTML = [
      { cls: 'hero', l: 'Net expected future cash flow', v: short(M.tot.net), s: `${short(M.tot.service + M.tot.aff)} in · ${short(-M.tot.refund)} out · ${short(M.within(lastMonthEnd(2)))} by ${dLong(lastMonthEnd(2))}` },
      { l: 'Expected service collections', c: 'var(--uc)', v: short(M.tot.service), s: `Second installments: ${pct(M.tot.service / contractual)} of the ${short(contractual)} still owed on contracts` },
      { l: 'Expected affiliate revenue', c: 'var(--closed)', v: short(M.tot.aff), s: 'Realtor, lender and STR Cribs fees on expected closings' },
      { l: 'Projected refund outflows', c: 'var(--neg)', v: short(M.tot.refund), s: `Future refunds only · ${pct(st.s)} of the upfront payment returned` },
    ].map(k => `<div class="kpi ${k.cls || ''}"><div class="l">${k.c ? `<i style="background:${k.c}"></i>` : ''}${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s}</div></div>`).join('');

    // panel subtitles and legends
    $('s-bridge').innerHTML = `<b>${short(contractual)}</b> still owed → <b>${short(M.tot.service)}</b> in expected service collections → <b>${short(M.tot.net)}</b> net after affiliate revenue and refunds`;
    $('lg-bridge').innerHTML = `<span><i style="background:var(--total)"></i>Total</span><span><i style="background:var(--closed)"></i>Adds cash</span><span><i style="background:var(--neg)"></i>Reduces cash</span><span><i class="band"></i>Shaded: grouped steps</span>`;
    const half = M.cum.findIndex(v => v >= M.tot.net / 2), peak = MM.reduce((a, r) => (r.net > a.net ? r : a), MM[0] || { net: 0, k: mKey(1) });
    $('s-cash').textContent = `Half of the net arrives by ${dLong(Math.max(half, 1))} · biggest month: ${mFull(peak.k)} (${short(peak.net)} net)`;
    cashLegend();
    const refShare = M.tot.refund ? M.tot.refPA / M.tot.refund : 0, noRefunds = Math.abs(M.tot.refund) < 0.5;
    $('s-ref').textContent = noRefunds ? 'No future refunds at a 0% refund size' : `${short(M.tot.refund)} in total · ${pct(st.s)} of the upfront payment returned · ${pct(refShare)} from paused and Additional Service clients`;
    $('lg-ref').innerHTML = RSRC(tok()).map(s => `<span><i style="background:${s.css}"></i>${s.name}<b>${cellM(M.tot[s.k])}</b><em>${M.tot.refund ? pct(M.tot[s.k] / M.tot.refund) : ''}</em></span>`).join('');
    $('p-ref').classList.toggle('is-empty', noRefunds);
    $('e-ref').textContent = noRefunds ? 'With the refund size at 0%, no upfront money is returned, so there are no future refunds to show.' : '';
    const chosen = AFF.reduce((a, k) => a + P[k].chosen, 0), affTot = AFF.reduce((a, k) => a + P[k].total, 0);
    $('s-aff').textContent = `${short(M.tot.aff)} expected · ${short(chosen)} (${affTot ? pct(chosen / affTot) : '0%'}) from partner choices already recorded in Jira; the rest depends on the conversion assumptions`;
    $('lg-aff').innerHTML = `<span><i style="background:var(--closed)"></i>Partner already chosen</span><span><i class="out" style="background:var(--closed-2);border-color:var(--closed)"></i>Assumed conversions (no choice recorded)</span>`;
    const sc = scenarios(), nets = sc.map(x => x.m.tot.net), same = Math.max(...nets) - Math.min(...nets) < 1;
    $('s-scen').textContent = same ? `Only timing changes, so every scenario reaches the same ${short(nets[1])}; what differs is the running total by each date.` : `Net ranges from ${short(Math.min(...nets))} to ${short(Math.max(...nets))}.`;
    $('lg-scen').innerHTML = `<span><i class="ln" style="background:var(--sp-mid)"></i>Optimistic (${OPT} days)</span><span><i class="ln" style="background:var(--acq)"></i>Your setting (${st.d} days)</span><span style="color:var(--hold)"><i class="dash"></i><span style="color:var(--ink-2)">Pessimistic (${st.max} days)</span></span>`;
    $('f-scen').textContent = `Running total by date, not monthly cash. Optimistic: collections centred ${OPT} days out. Pessimistic: the slider maximum (${st.max} days). Everything else follows your current settings.`;

    Object.keys(VIEWS).forEach(id => { if (isTable(id)) VIEWS[id].table(); else VIEWS[id].chart().draw(); });
    groupsTable();
    glance(P);
  }
  function lastMonthEnd(k) { const e = new Date(asof.getFullYear(), asof.getMonth() + k, 0, 12); return Math.round((e - asof) / DAY); }

  /* ------------------------------------------------------------------ assumptions at a glance (live) */
  function glance(P) {
    const card = (v, l, s) => `<div class="ag-i"><b>${v}</b><span>${l}</span><small>${s}</small></div>`;
    $('ag-you').innerHTML = [
      card(`${st.d} days`, 'Expected days until collection', `For clients still searching and paused clients who resume; payments spread around ${dLong(st.d)} like past closings.`),
      card(pct(st.p), 'Paused + Additional Service who proceed', `They pay their second installment; the other ${pct(1 - st.p)} are refunded and never pay it.`),
      card(pct(st.s), 'Refund size', 'Share of the upfront payment returned on each future refund.'),
      `<div class="ag-i"><span>Affiliate assumptions</span><ul class="ag-l">${AFF.map(k => `<li><i>${P[k].label}</i><b>${pct(P[k].conv)} · ${money(P[k].rev)}</b></li>`).join('')}</ul><small>Conversion where no partner choice is recorded · revenue per conversion</small></div>`,
    ].join('');
    $('ag-data').innerHTML = [
      card(pct(G.under_contract.p_close), 'Under-contract clients expected to close', 'From past clients who had been under contract as long.'),
      card(`${pct(NP.p_close)} · ${pct(NP.p_refund)}`, 'Still searching: close · refund', `Like past clients at the same stage; the other ${pct(NP.p_pause)} pause or keep searching.`),
      card(`${U.median} days`, 'Typical Under Contract to closing', `Middle half ${U.p25}–${U.p75} days, across ${S.int(U.n)} closings.`),
      card('50 / 50', 'Split Pay', 'Half at the win, half at closing. Paid In Full is collected at the win, so only second installments are future cash.'),
      card(S.int(G.refunded.n), 'Clients already refunded', 'Paid back in the past: not future outflows, and their unpaid balance is not collected.'),
      card(short(unverified + G.duplicate.outstanding), 'Set aside, not forecast', 'Unresolved or duplicate records stay out of the forecast until their records are found.'),
    ].join('');
  }

  /* ------------------------------------------------------------------ full methodology */
  const MS = H0.mature_starts;
  const li = html => `<li>${html}</li>`;
  $('notes-body').innerHTML = `
    <div class="nb"><h3>Refund rules</h3><ul>
      ${li(`Clients already marked Refunded in Jira (${S.int(G.refunded.n)}) were paid back in the past. They are not future cash outflows, and their unpaid second installments will not be collected.`)}
      ${li(`Paused and Additional Service clients: by default ${pct(DEF.paused_proceed)} eventually proceed and pay their second installment, and ${pct(1 - DEF.paused_proceed)} are refunded (adjustable). The refunded amount is paid back to the client and subtracted from net cash.`)}
      ${li(`Clients still searching are refunded at the historical rate for their stage (${pct(NP.p_refund)} on average). Under-contract clients who don’t close are refunded at the historical rate (${pct(H0.uc_fail_refund)} of past clients who didn’t close).`)}
      ${li(`Refund size (0–100%, default ${pct(DEF.refundable_share)}) is the share of the upfront payment returned on future refunds: 0% returns nothing, 100% returns all of it. The upfront payment is the first Split Pay installment, or the full price for Paid In Full.`)}
      ${li('A client who is refunded never pays their remaining installment.')}
      ${li('Each client counts once: as a past refund, a projected refund or an expected collection. Projected refunds are timed with the same spread as collections.')}
    </ul></div>
    <div class="nb"><h3>How the forecast is reconciled</h3><ul>
      ${li(`All ${S.int(C.view.engagements)} won deals sit in exactly one row of the table above, and the rows add up to the money still owed under contracts in the reporting layer’s cash forecast view (${money(C.view.gross_outstanding)}) plus ${money(C.view.scheduled_counted_collected)} for closings scheduled after the data date.`)}
      ${li(`47 won deals had no Jira match. Each was checked against the Jira key typed in Pipedrive, client e-mails in the 12 Nov Jira and Pipedrive extracts, both onboarding-form sheets, and the brokerage and lender closing records: ${R.own_jira} match their own Jira issue (now grouped by its status), ${R.purchase_record} have a closing record, ${R.duplicate} are probable duplicates of another deal, ${R.repeat} are repeat purchases whose client’s only Jira issue tracks the other deal, and ${R.none} have no record anywhere (${R.onboarded} of the 47 completed an onboarding form).`)}
      ${li(`${R.post_close_no_date} post-close won deals had no closing date. Checking affiliate, brokerage and lender records by property address found ${R.post_close_evidenced} closings; the rest stay unresolved.`)}
    </ul></div>
    <div class="nb"><h3>What history shows</h3><ul>
      ${li(`Under Contract to closing takes ${U.median} days at the median (middle half ${U.p25}–${U.p75}) across ${S.int(U.n)} closings; Passed Inspection to closing takes ${H0.pi_to_close.median} days. ${pct(H0.uc_close_rate)} of ${S.int(H0.uc_n)} past under-contract clients closed, and the chance falls the longer a contract runs without closing.`)}
      ${li(`Of ${S.int(MS.n)} confirmed starts with at least a year of history and a known outcome, ${pct(MS.shares.closed)} closed, ${pct(MS.shares.refunded)} refunded, ${pct(MS.shares.paused)} paused and ${pct(MS.shares.hunting)} are still searching. The longer a client goes without a contract, the more those shares shift toward refund and pause, so each client still searching uses the shares for their own number of days.`)}
      ${li(`Past refunds: ${S.int(H0.processed_refunds.n)} won deals are marked Refunded in Jira, typically ${H0.refund_lag.median} days after the client start (90% within ${Math.round(H0.refund_lag.p90)} days).`)}
      ${li(`Affiliate history: ${S.int(AF.realized.payments)} recorded affiliate payments since Dec 2024 total ${money(AF.realized.total)} (broker ${money(AF.realized.by_source.Broker.total)}, lender ${money(AF.realized.by_source.Lender.total)}, construction ${money(AF.realized.by_source.Construction.total)}). Median realtor referral fee ${money(AF.realtor.median_fee)} (${S.int(AF.realtor.received)} of ${S.int(AF.realtor.n)} received); median lender amount due ${money(AF.lender.median_due)}; typical STR Cribs fee ${money(AF.cribs.typical_fee)}. No affiliate fee is recorded as received yet for any client still expected to close.`)}
    </ul></div>
    <div class="nb"><h3>Other assumptions</h3><ul>
      ${li('Payment rules from the cash forecast view: Paid In Full is collected at the win; Split Pay collects half at the win and half at closing. Only second installments are future collections.')}
      ${li(`Expected days until collection (default ${DEF.expected_days}; from ${OPT} up to an adjustable maximum of ${DEF.expected_days_max}) applies to clients still searching and to paused clients who resume. Their collections and refunds spread around that day like past Under Contract → closing times, rather than landing on one date.`)}
      ${li(`Paused + Additional Service: default ${pct(DEF.paused_proceed)} proceed; the rest refund. The slider moves both collections and refunds.`)}
      ${li(`Affiliates: a recorded preferred realtor, lender or STR Cribs choice earns the fee; a recorded other partner, cash purchase or turnkey home earns nothing. Only clients with no recorded choice use the conversion sliders (defaults ${pct(DEF.affiliates.realtor.conv)} / ${pct(DEF.affiliates.lender.conv)} / ${pct(DEF.affiliates.cribs.conv)}). Revenue per conversion defaults (${money(DEF.affiliates.realtor.rev)} / ${money(DEF.affiliates.lender.rev)} / ${money(DEF.affiliates.cribs.rev)}) are business assumptions; the recorded medians above are higher.`)}
    </ul></div>
    <div class="nb"><h3>Data limitations</h3><ul>
      ${li(`Payment type: blanks default to Split Pay, and only ${S.int(C.view.payment_recorded)} of ${S.int(C.view.engagements)} won deals have a recorded type, so balances may be overstated for clients who paid in full.`)}
      ${li(`${money(unverified)} of unresolved and ${money(G.duplicate.outstanding)} of probable-duplicate balances stay outside the forecast until their records are found.`)}
      ${li('Under Contract is the latest valid contract; earlier fall-throughs aren’t recorded, so the historical closing rate may be slightly optimistic.')}
    </ul></div>`;

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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());
  window.__CASH_READY = true;
  window.__CASH = { model, monthly, affParts, bridgeSteps, defaults, get state() { return st; } };
})();
