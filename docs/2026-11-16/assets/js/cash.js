/* Cash forecast tab (16 Nov 2026 reporting version): estimated net future cash flow from service payments, affiliate
   revenue and refunds, recomputed in the browser from aggregates built by pipeline/chapters/cash.py.
   - fixed timing:  under-contract clients and scheduled closings, weighted by the historical probability of closing
                    for clients who had waited as long, timed by the remaining historical UC -> CLOSED durations
   - history timing: clients without a property (historical close / refund / pause shares): expected collections and
                    affiliate closings over the remaining days to closing of past clients still searching after as many
                    days; their refunds over the remaining days of past refunds (closings and refunds timed separately)
   - slider timing: paused or additional-service clients who close or are refunded, spread around the expected days until
                    collection with the historical UC -> CLOSED variation (a modeling assumption, not a validated pattern)
   - refunds:       every approved refund returns 100% of the upfront payment (business rule, not a control)
   - paused:        one "% expected to close" slider: that share closes (collect + affiliate), the rest receive a full
                    refund of the upfront payment (Batch 5; default and its derivation from cash.py)
   - affiliates:    recorded partner choice where Jira has one; the conversion sliders only where it has none.
                    Cash is received on modeled payout dates (realtor: month after the quarter; lender and STR Cribs:
                    month after closing; the 15th), so affiliate totals never change, only when they arrive.
                    Completed purchases since 1 Oct whose fees are not shown as paid are added on the same payout dates
                    (October's lender and STR Cribs fees, due 15 Nov, in November).
   Presentation: KPIs, a left-to-right waterfall, monthly cash flow (the months to SHOW_TO, then later cash as one block),
   paused exposure, affiliate partners, timing comparison, refund sources. The five chart views switch between chart and sortable
   table; both follow the controls. Key figures open into plain-language explanations (collapsed by default) that are rebuilt
   from the same model, so they follow the controls. Every figure carries a label: Recorded (source records), Inferred (history or
   matching), Assumed (a default rule where the record is blank), Scenario (controls). No client record is published. */
(function () {
  'use strict';
  const S = window.S, D = S.data, C = D.cash;
  const G = C.groups, F = C.fixed, NP = C.noprop, PA = C.paused, DEF = C.defaults, H0 = C.history, AF = C.affiliates, R = C.resolution, CP = C.completed;
  const DAY = 86400000, OPT = DEF.optimistic_days, AFF = ['realtor', 'lender', 'cribs'];
  const REFUND_SHARE = 1;                    // business rule: an approved refund returns 100% of the amount paid upfront
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
  const amt = v => `<b title="${money(v)}">${short(v)}</b>`;           // an amount in running text; hover shows the exact figure
  const amtS = v => `<b title="${money(v)}">${signed(v)}</b>`;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const tok = () => Object.assign(S.tok(), { neg: css('--neg'), total: css('--total'), band: css('--wf-band') });

  /* ------------------------------------------------------------------ state: paused + Additional Service = one whole-percent "% expected to close" */
  const defaults = () => ({ d: DEF.expected_days, max: DEF.expected_days_max, pc: DEF.paused_close, h: true,
    aff: Object.fromEntries(AFF.map(k => [k, { conv: DEF.affiliates[k].conv, rev: DEF.affiliates[k].rev }])) });
  let st = defaults();
  // whole-deal counts for a set of shares that add up to the total
  function alloc(shares, n) {
    const raw = shares.map(x => x * n), fl = raw.map(Math.floor); let rem = n - fl.reduce((a, b) => a + b, 0);
    raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (rem > 0) { fl[i]++; rem--; } });
    return fl;
  }

  /* ------------------------------------------------------------------ model (the totals are unchanged by the payout dates; the splits below only re-group the same flows) */
  // Affiliate cash earned at a projected closing on day d is received on the 15th of: realtor - the month after the closing's calendar
  // quarter ends (Q4 2026 closings -> January 2027); lender and STR Cribs - the month after closing (STR Cribs provisional).
  // These are modeled receipt dates, not confirmed payment dates. Receipt days never precede closing days and rise with them.
  const PAYDAY = 15, SCHED = { realtor: 'quarter', lender: 'month', cribs: 'month' }, RECV = { realtor: {}, lender: {}, cribs: {} };
  const recvDay = (k, d) => {
    if (RECV[k][d] === undefined) {
      const c = at(d), m = c.getMonth(), pm = SCHED[k] === 'quarter' ? (Math.floor(m / 3) + 1) * 3 : m + 1;
      RECV[k][d] = Math.round((new Date(c.getFullYear(), pm, PAYDAY, 12) - asof) / DAY);
    }
    return RECV[k][d];
  };
  // completed purchases since 1 Oct: fees not shown as paid arrive on the same payout dates, never before tomorrow (October's lender
  // and STR Cribs fees were due on 15 Nov and no payment is recorded, so they are placed in November)
  const doneDay = (k, r) => Math.max(1, recvDay(k, r.first_day));
  function doneParts(s) {
    return Object.fromEntries(AFF.map(k => {
      const a = s.aff[k], months = CP.months.map(r => ({ k: r.month, n: r.n, day: doneDay(k, r), known: r.aff[k].known, unk: r.aff[k].unknown, paid: r.aff[k].paid,
        total: a.rev * (r.aff[k].known + a.conv * r.aff[k].unknown) }));
      const known = months.reduce((x, r) => x + r.known, 0), unk = months.reduce((x, r) => x + r.unk, 0);
      return [k, { known, unk, paid: months.reduce((x, r) => x + r.paid, 0), paying: known + a.conv * unk, total: a.rev * (known + a.conv * unk), months }];
    }));
  }
  // the published timing weights are rounded to six decimals and add up to 0.999999; scaled to add up to exactly 1 so that every total and split reconciles to the cent
  const SPW = (() => { const t = C.spread.reduce((a, x) => a + x[1], 0); return C.spread.map(([o, w]) => [o, w / t]); })();
  // clients still searching: their own historical timing, published by day (closings and refunds timed separately); each array is
  // scaled so that its total equals the published amount to the cent (the published days are rounded)
  const NT = NP.timing, sumA = a => a.reduce((x, y) => x + y, 0), per = (v, a) => (sumA(a) ? v / sumA(a) : 0);
  const NTK = { svc: per(NP.collect, NT.svc), ref: per(NP.refund_base, NT.refund_base),
    known: Object.fromEntries(AFF.map(k => [k, per(NP.aff[k].known, NT.known[k])])), unknown: Object.fromEntries(AFF.map(k => [k, per(NP.aff[k].unknown, NT.unknown[k])])) };
  const affValue = (parts, s) => AFF.reduce((a, k) => a + s.aff[k].rev * (parts[k].known + s.aff[k].conv * parts[k].unknown), 0);
  function model(s) {
    const spread = SPW.map(([o, w]) => [Math.max(1, s.d + o), w]);
    let H = Math.max(F.svc.length - 1, NT.svc.length - 1, ...spread.map(x => x[0]));
    H = Math.max(H, ...AFF.map(k => recvDay(k, H)));                       // horizon covers the last modeled payout
    const z = () => new Array(H + 1).fill(0);
    const fixed = z(), noprop = z(), paused = z(), aff = z(), refund = z(), affDone = z();
    const refUC = z(), refNP = z(), refPA = z(), affBy = Object.fromEntries(AFF.map(k => [k, z()]));
    const pr = s.pc / 100, pf = 1 - pr;                                     // paused: close, or a full refund of the upfront payment
    F.svc.forEach((v, d) => {
      fixed[d] = v;
      refund[d] -= REFUND_SHARE * F.refund_base[d];
      aff[d] += AFF.reduce((a, k) => a + s.aff[k].rev * (F.known[k][d] + s.aff[k].conv * F.unknown[k][d]), 0);
      refUC[d] -= REFUND_SHARE * F.refund_base[d];
      AFF.forEach(k => { affBy[k][d] += s.aff[k].rev * (F.known[k][d] + s.aff[k].conv * F.unknown[k][d]); });
    });
    const hv = s.h === false ? 0 : 1;          // simulation switch: refunds projected for clients still searching (1 = on)
    NT.svc.forEach((v, d) => {                 // clients still searching: historical timing (not the expected-days setting)
      noprop[d] += v * NTK.svc;
      const r = REFUND_SHARE * hv * NT.refund_base[d] * NTK.ref;
      refund[d] -= r; refNP[d] -= r;
      AFF.forEach(k => { affBy[k][d] += s.aff[k].rev * (NT.known[k][d] * NTK.known[k] + s.aff[k].conv * NT.unknown[k][d] * NTK.unknown[k]); });
    });
    const kAff = Object.fromEntries(AFF.map(k => [k, s.aff[k].rev * pr * (PA.aff[k].known + s.aff[k].conv * PA.aff[k].unknown)]));
    spread.forEach(([d, w]) => {               // paused clients who close or are refunded: spread around the expected-days setting
      paused[d] += pr * PA.second * w;
      refund[d] -= REFUND_SHARE * pf * PA.paid * w;
      refPA[d] -= REFUND_SHARE * pf * PA.paid * w;
      AFF.forEach(k => { affBy[k][d] += kAff[k] * w; });
    });
    const earned = Object.fromEntries(AFF.map(k => [k, affBy[k].slice()]));   // affiliate cash by projected closing day
    AFF.forEach(k => { const a = z(); earned[k].forEach((v, d) => { if (v) a[recvDay(k, d)] += v; }); affBy[k] = a; });   // moved to each partner's receipt day
    const DP = doneParts(s);                   // completed purchases: fees not yet received, on their payout dates (counted once, never forecast again)
    AFF.forEach(k => DP[k].months.forEach(r => { affBy[k][r.day] += r.total; affDone[r.day] += r.total; }));
    for (let d = 0; d <= H; d++) aff[d] = AFF.reduce((x, k) => x + affBy[k][d], 0);
    const sum = a => a.reduce((x, y) => x + y, 0);
    const tot = { fixed: sum(fixed), noprop: sum(noprop), paused: sum(paused), aff: sum(aff), refund: sum(refund), affDone: sum(affDone),
      refUC: sum(refUC), refNP: sum(refNP), refPA: sum(refPA), affBy: Object.fromEntries(AFF.map(k => [k, sum(affBy[k])])) };
    tot.affFc = tot.aff - tot.affDone;
    tot.service = tot.fixed + tot.noprop + tot.paused;
    tot.net = tot.service + tot.aff + tot.refund;
    const cum = []; let run = 0;
    for (let d = 0; d <= H; d++) { run += fixed[d] + noprop[d] + paused[d] + aff[d] + refund[d]; cum.push(run); }
    return { H, fixed, noprop, paused, aff, affDone, refund, refUC, refNP, refPA, affBy, earned, tot, cum, within: n => cum[Math.max(0, Math.min(n, H))] };
  }
  const MKEYS = ['fixed', 'noprop', 'paused', 'aff', 'affDone', 'refund', 'refUC', 'refNP', 'refPA'];
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
    rows.forEach(r => { r.service = r.fixed + r.noprop + r.paused; r.affFc = r.aff - r.affDone; r.inflow = r.service + r.aff; r.net = r.inflow + r.refund; run += r.net; r.cum = run; });
    return rows;
  }
  // the monthly view: every month to SHOW_TO, then the rest as one "Later" block (its months rest on few past clients)
  const SHOW_K = C.show_to.slice(0, 7);
  function monthView(rows) {
    const near = rows.filter(r => r.k <= SHOW_K), rest = rows.filter(r => r.k > SHOW_K);
    if (!rest.length) return near;
    const L = { k: 'later', later: true, from: rest[0].k, to: rest[rest.length - 1].k };
    MKEYS.concat(AFF, ['service', 'affFc', 'inflow', 'net']).forEach(x => { L[x] = rest.reduce((a, r) => a + r[x], 0); });
    L.cum = rest[rest.length - 1].cum;
    return near.concat([L]);
  }
  const mRange = r => `${mLab(r.from)} – ${mLab(r.to)}`;
  // affiliate revenue per partner: forecast closings with the partner already chosen vs with no recorded choice, and completed
  // purchases whose fees are not yet received (each fee counts once: a completed closing is never a forecast one)
  const FK = Object.fromEntries(AFF.map(k => [k, { known: F.known[k].reduce((a, b) => a + b, 0), unknown: F.unknown[k].reduce((a, b) => a + b, 0) }]));
  function affParts(s) {
    const pr = s.pc / 100, DP = doneParts(s);
    return Object.fromEntries(AFF.map(k => {
      const a = s.aff[k], known = FK[k].known + NP.aff[k].known + pr * PA.aff[k].known, unk = FK[k].unknown + NP.aff[k].unknown + pr * PA.aff[k].unknown;
      const fc = a.rev * (known + a.conv * unk), done = DP[k];
      return [k, { label: DEF.affiliates[k].label, conv: a.conv, rev: a.rev, known, unk, paying: known + a.conv * unk, chosen: a.rev * known, assumed: a.rev * a.conv * unk, forecast: fc,
        done: done.total, doneN: done.paying, donePaid: done.paid, doneM: done.months, total: fc + done.total }];
    }));
  }
  // where the net comes from: contracts in progress, clients still searching, paused clients, completed purchases (they add up to the net)
  function groupNet(s, m) {
    const pr = s.pc / 100;
    const aF = AFF.reduce((a, k) => a + s.aff[k].rev * (FK[k].known + s.aff[k].conv * FK[k].unknown), 0), aN = affValue(NP.aff, s), aP = pr * affValue(PA.aff, s);
    const g = (svc, af, rf) => ({ svc, aff: af, ref: rf, net: svc + af + rf });
    return { uc: g(m.tot.fixed, aF, m.tot.refUC), np: g(m.tot.noprop, aN, m.tot.refNP), pa: g(m.tot.paused, aP, m.tot.refPA), cp: g(0, m.tot.affDone, 0) };
  }
  // paused + Additional Service: the share expected to close and the share refunded, at the current setting, and the extremes
  function pausedView(s) {
    const r = s.pc / 100, f = 1 - r, full = affValue(PA.aff, s), n = alloc([r, f], PA.n);
    const o = (share, cnt, svc, af, rf) => ({ share, n: cnt, svc, aff: af, ref: rf, net: svc + af + rf });
    return { r, f, full,
      close: o(r, n[0], r * PA.second, r * full, 0), refund: o(f, n[1], 0, 0, -REFUND_SHARE * f * PA.paid),
      range: { close: PA.second + full, refund: -REFUND_SHARE * PA.paid } };
  }
  const contractual = Object.values(G).reduce((a, g) => a + g.outstanding, 0) + C.view.scheduled_counted_collected + C.other.outstanding;
  const unverified = G.unverified_closing.outstanding + G.unverified_repeat.outstanding + G.unverified_none.outstanding;
  const active = G.under_contract.second + G.scheduled.second + G.noprop.second + G.paused.second;      // owed by clients still in progress
  const U = H0.uc_to_close, TM = Object.assign({}, NP.timing.meta, { bands: NP.timing.bands }), TC = NP.timing.check;

  /* ------------------------------------------------------------------ labels: recorded / inferred / scenario */
  const BASIS = {
    rec: { label: 'Recorded', key: 'taken straight from source records (Jira, Pipedrive, the payment view, the affiliate trackers)', tip: 'Recorded: taken directly from source records (Jira, Pipedrive, the payment view or the affiliate trackers).' },
    inf: { label: 'Inferred', key: 'estimated from history or by matching records', tip: 'Inferred: estimated from historical evidence or by matching records. Not recorded directly.' },
    asm: { label: 'Assumed', key: 'a payment rule applied where the record is blank (payment type, upfront amount)', tip: 'Assumed: a payment rule applied where the record is blank. A blank payment type is taken as Split Pay, and the upfront amount follows the type (half the deal value for Split Pay, all of it for Paid In Full).' },
    sce: { label: 'Scenario', key: 'set by the controls on the left', tip: 'Scenario: set by the controls on the left. Change the control and this number changes.' },
  };
  const chip = k => `<span class="bx ${k}" title="${BASIS[k].tip}"><i></i>${BASIS[k].label}</span>`;
  const chips = ks => `<span class="bs">${ks.map(chip).join('')}</span>`;
  const basisText = ks => ks.map(k => BASIS[k].label).join(' + ');

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
  // an expandable explanation (collapsed by default); its body is rebuilt from the model while it is open
  const exBlock = (name, title, desc, cls) => `<details class="ex ${cls || ''}" data-x="${name}"><summary><span class="ex-t">${title}</span>${desc ? `<span class="ex-s">${desc}</span>` : ''}</summary><div class="ex-b" id="xb-${name}"></div></details>`;
  const panel = (id, title, cls, aria, foot, extra, kick, after) => `
        <section class="panel ${extra || ''}" id="p-${id}" aria-labelledby="h-${id}">
          <div class="panel-head"><div class="ph">${kick ? `<div class="kick">${kick}</div>` : ''}<h2 id="h-${id}">${title}</h2><p class="sub" id="s-${id}"></p></div>${id === 'cash' ? `<div class="ph-tools"><button type="button" class="lg-btn" id="b-detail" aria-pressed="false">Split by client group</button>${toggle(id)}</div>` : toggle(id)}</div>
          <div class="pv-chart"><div class="legend-row" id="lg-${id}"></div><div class="chart ${cls}" id="c-${id}" role="img" aria-label="${aria}"></div><p class="empty-note" id="e-${id}"></p><p class="foot" id="f-${id}">${foot}</p></div>
          <div class="pv-table tw" id="t-${id}"></div>${after || ''}
        </section>`;
  /* client landscape and unresolved records: counts and balances come straight from the model's groups */
  const RC = C.recent_closed;
  const nUC = G.under_contract.n + G.scheduled.n, nOpen = G.noprop.n + G.paused.n + nUC;
  const lc = (c, n, label, sub) => `<div class="lc" style="--c:${c}"><b>${S.int(n)}</b><span>${label}</span><small>${sub}</small></div>`;
  const LAND = `
        <section class="panel land" id="p-land" aria-labelledby="h-land">
          <div class="panel-head"><div class="ph"><div class="kick">1 · Where clients are today</div><h2 id="h-land">Our won deals today</h2>
            <p class="sub">Snapshot as of ${S.date(C.asof)}. Each is a Won Pipedrive deal, not necessarily a unique client. ${chip('rec')}</p></div></div>
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
              <p class="lr-note" id="lr-note"></p>
            </div>
          </div>
        </section>`;
  const UNR = [
    ['unverified_closing', 'Post-close, no closing date', 'Jira shows a post-close status, but no closing date appears in any source, so it is unclear whether the balance has been collected.'],
    ['unverified_repeat', 'Repeat purchase without its own Jira issue', 'The client’s only Jira issue tracks their other won deal, so this purchase has no progress record.'],
    ['unverified_none', 'Won deal without matching records', `No Jira issue, e-mail or purchase record was found for the deal (${S.int(R.unverified_none_2024)} won in 2024, ${S.int(R.unverified_none_2026)} in 2026).`],
  ];
  const dupB = G.second_deal_review.outstanding;
  const uN = UNR.reduce((a, r) => a + G[r[0]].n, 0), uB = UNR.reduce((a, r) => a + G[r[0]].outstanding, 0);
  const bal = v => `<td class="n" title="${money(v)}">${short(v)}</td>`;
  const UNRES = `
        <details class="panel unres" id="p-unres" data-x="unres">
          <summary><span class="u-t"><span class="kick">Supporting analysis · set aside</span>Unresolved records<small>Set aside: not in the forecast until their records are found</small></span>
            <span class="u-v"><b>${S.int(uN)}</b> won deals · <b>${short(uB)}</b> still owed</span></summary>
          <div class="tw"><table class="cf-t unr"><caption class="visually-hidden">Unresolved records kept out of the forecast, and second deals under review</caption>
            <thead><tr><th scope="col">Category</th><th scope="col" class="n">Won deals</th><th scope="col" class="n">Balance still owed</th><th scope="col">Why it is excluded</th></tr></thead>
            <tbody>${UNR.map(([k, lab, why]) => `<tr><td>${lab}</td><td class="n">${S.int(G[k].n)}</td>${bal(G[k].outstanding)}<td class="rule">${why}</td></tr>`).join('')}
              <tr class="tot"><td>Unresolved total</td><td class="n">${S.int(uN)}</td>${bal(uB)}<td class="rule">Excluded from service collections, affiliate revenue and refunds.</td></tr>
              <tr class="grp"><th colspan="4" scope="rowgroup">Counted separately</th></tr>
              <tr><td>Second deals under review</td><td class="n">${S.int(G.second_deal_review.n)}</td>${bal(G.second_deal_review.outstanding)}<td class="rule">Same client, won date and value as another deal, won within seconds of it (or named by the same Jira key) and recorded as a second deal, with no engagement of their own yet. Either a second search not yet started or a record entered twice; excluded until reviewed.</td></tr></tbody></table></div>
          <div class="ex-b" id="xb-unres"></div>
        </details>`;
  const PAUSED = `
        <section class="panel px" id="p-paused" aria-labelledby="h-paused">
          <div class="panel-head"><div class="ph"><div class="kick">4 · The biggest assumption</div><h2 id="h-paused">Paused and Additional Service: what is at stake</h2>
            <p class="sub" id="s-paused"></p></div></div>
          <div class="px-cards" id="px-cards"></div>
          <div class="px-sc"><p class="px-sc-t">What the selected setting assumes</p><div class="px-bar" id="px-bar" role="img" aria-label="Paused outcomes"></div><div class="legend-row" id="px-lg"></div>
            <div class="tw" id="t-px"></div><p class="px-range" id="px-range"></p></div>
          <div class="px-rec">
            <div><p class="px-sc-t">From the Paused filter to the forecast’s ${S.int(PA.n)} deals</p><div class="tw" id="t-pxm"></div></div>
            <div><p class="px-sc-t">From booked value to future cash</p><div class="tw" id="t-pxb"></div></div>
          </div>
          ${exBlock('paused', 'How each outcome works', 'Close · Full refund')}
        </section>`;
  const main = document.getElementById('main');
  const RY = AF.recorded_year;
  main.innerHTML = `
    <section class="cf-intro" aria-labelledby="cf-title">
      <div class="cf-kicker">Cash forecast · ${D.meta.version.label} reporting package</div>
      <h1 id="cf-title">How much more cash STRSearch can expect, and when</h1>
      <p>An estimate of the cash still to come from deals already won (service payments and affiliate revenue, less refunds), under the assumptions you select. New sales are not included. Change any assumption on the left and every number, chart and table updates.</p>
      <div class="cf-chips"><span class="cf-chip">Data as of ${S.date(C.asof)}</span><span class="cf-chip">${S.int(C.view.engagements)} won deals reconciled</span></div>
      <div class="cf-key" role="list" aria-label="How to read the labels"><span class="cf-key-t">Every figure is labelled by where it comes from</span>
        ${['rec', 'inf', 'asm', 'sce'].map(k => `<span class="cf-key-i" role="listitem">${chip(k)}<small>${BASIS[k].key}</small></span>`).join('')}</div>
    </section>
    <div class="cf-grid">
      <aside class="cf-controls" aria-label="Forecast assumptions">
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--wait)">${IC.clock}</span>Expected days until collection</h3>
          <div class="readout"><b id="o-day">–</b><span id="o-date">–</span></div>
          <div class="range"><div class="range-top"><label for="r-d">Paused clients who close or are refunded</label></div>
            <input type="range" id="r-d" min="${OPT}" max="${DEF.expected_days_max}" step="1" style="--c:var(--wait)"><div class="range-ends"><span>${OPT} days (earliest)</span><span id="o-dmax"></span></div></div>
          <p class="hint">${OPT} days = Under Contract tomorrow plus the typical ${U.median} days to closing. Paused payments and refunds spread around the chosen day the way past closings did (middle half ${U.p25}–${U.p75} days). Clients still searching follow their own historical timing and do not move with this setting.</p>
          <div class="range"><div class="range-top"><label for="r-max">Slider maximum</label><output id="o-max" for="r-max"></output></div>
            <input type="range" id="r-max" min="${OPT + 3}" max="240" step="1" style="--c:var(--hold)"></div>
          ${exBlock('c-days', 'What this changes', '', 'mini')}
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--sales)">${IC.pause}</span>Paused + Additional Service</h3>
          <div class="range"><div class="range-top"><label for="r-pc" class="range-lab">% expected to close<small>The rest receive a full refund of the upfront payment</small></label><output id="o-pc" for="r-pc"></output></div>
            <input type="range" id="r-pc" min="0" max="100" step="1" style="--c:var(--closed)"></div>
          <div class="tri" id="tri-bar" aria-hidden="true"></div>
          <p class="hint" id="o-pc-hint"></p>
          <p class="hint">Default ${DEF.paused_close}%: ${S.int(PA.fell_through.jira_fell_through)} of the ${S.int(PA.fell_through.jira_paused)} Paused clients (${pct(PA.fell_through.jira_fell_through / PA.fell_through.jira_paused)}) had a contract that ended or a documented fall-through. The default assumes ${PA.default.pts.fell_through} points of the Paused group close from those cases and ${PA.default.pts.other} from the rest (${pct(PA.default.paused_close)}), and all ${S.int(PA.additional_n)} Additional Service deals close.</p>
          ${exBlock('c-paused', 'What this changes', '', 'mini')}
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--neg)">${IC.refund}</span>Refunds</h3>
          <div class="rule100"><span><b>100%</b> of the upfront payment is returned on every approved refund</span><em>Fixed rule</em></div>
          <div class="sw-row"><button type="button" role="switch" id="t-hunt" class="sw-btn" aria-checked="true"><i></i></button>
            <div><label for="t-hunt">Include projected refunds from clients still searching</label><small id="t-hunt-s"></small></div></div>
          <p class="hint">Applies to future refunds only. The upfront payment is the first Split Pay installment, or the full Paid In Full price; a refunded client never pays the second installment. Clients already marked Refunded in Jira were paid back in the past and are not in the forecast. Under-contract clients who don’t close are refunded at ${pct(H0.uc_fail_refund)}, the historical rate.</p>
          ${exBlock('c-refunds', 'What this changes', '', 'mini')}
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--closed)">${IC.partner}</span>Affiliate revenue</h3>
          <p class="hint">Conversion applies only where Jira has no recorded partner choice. A recorded preferred partner earns the fee; a recorded other partner, cash purchase or turnkey home earns nothing. Cash arrives on modeled payout dates (realtor: the month after the quarter ends; lender and STR Cribs: the month after closing). The same rules apply to the ${S.int(CP.n)} purchases completed since ${S.date(CP.from)} whose fees are not shown as paid.</p>
          ${AFF.map(k => `<div class="aff" data-aff="${k}">
            <div class="aff-head"><b>${DEF.affiliates[k].label}</b><span id="o-${k}-val"></span></div>
            <div class="range"><div class="range-top"><label for="r-${k}-c">Conversion when no choice is recorded</label><output id="o-${k}-c"></output></div><input type="range" id="r-${k}-c" min="0" max="100" step="1" style="--c:var(--closed)"></div>
            <div class="range"><div class="range-top"><label for="r-${k}-r">Revenue per conversion</label><output id="o-${k}-r"></output></div><input type="range" id="r-${k}-r" min="0" max="10000" step="100" style="--c:var(--closed)"></div>
            <div class="hist" id="h-${k}"></div>
          </div>`).join('')}
          ${exBlock('c-aff', 'What this changes', '', 'mini')}
        </div>
        <div class="ctl">
          <h3><span class="ic" style="--ic:var(--acq)">${IC.scen}</span>Timing presets</h3>
          <div class="presets"><button class="btn" data-preset="opt" type="button">Earliest</button><button class="btn" data-preset="bal" type="button">Middle</button><button class="btn" data-preset="pes" type="button">Latest</button>
            <button class="btn reset" id="b-reset" type="button">Reset every assumption</button></div>
          <p class="hint">The presets move only the expected days until collection for paused clients. They change when cash arrives, never how much is collected.</p>
        </div>
      </aside>
      <div class="cf-results">
        ${LAND}
        <div class="kpis" id="kpis" aria-live="polite"></div>
        ${exBlock('head', 'How is this number built?', 'Service collections + affiliate revenue − future refunds, and which client groups they come from')}
        ${panel('bridge', 'From what clients still owe to the cash we expect', 'chart-wf', 'Waterfall from the balance on contracts to estimated net future cash, read left to right',
          'Read left to right. Red bars reduce the total, the green bar adds to it, and indigo bars are totals. Shaded steps are balances that are not future cash or not expected to be paid. Hover a bar to see what it includes.', 'feature', '2 · How much we expect', exBlock('bridge', 'Explain each step', 'What every bar means, how it is calculated and where it comes from'))}
        ${panel('cash', 'Expected cash flow by month', 'chart-cash', 'Expected monthly collections by client group and affiliate revenue above zero, refunds below zero, and the net cash flow line',
          '', '', '3 · When the cash arrives', `<p class="tnote" id="n-cash"></p>${exBlock('cash', 'What makes up each month', 'Collections, affiliate fees and refunds behind every monthly bar')}`)}
        ${PAUSED}
        ${panel('aff', 'Affiliate revenue by partner', 'chart-aff', 'Expected affiliate revenue for realtor, lender and STR Cribs: completed purchases with fees not yet received, and forecast closings split into recorded partner choices and modeled conversions',
          `Completed purchases: closings since ${S.date(CP.from)} whose fee the trackers do not show as paid (a realtor fee counts as paid when the brokerage records a Date Received; no lender or STR Cribs payment is recorded). Forecast closings count in proportion to their chance of closing. A recorded preferred partner earns the fee, a recorded other partner, cash purchase or turnkey home earns nothing, and the conversion setting applies only where no choice is recorded. Fees are placed on modeled receipt dates (the 15th of the payout month: realtor, the month after the quarter ends; lender and STR Cribs, the month after closing, provisional). These are modeled dates, not confirmed payment dates.`,
          '', 'Supporting analysis · affiliate revenue', exBlock('aff', 'How each partner’s revenue is calculated', 'Recorded partner choices, modeled conversions and expected payout dates'))}
        ${panel('scen', 'Timing comparison: same total, different timing', 'chart-scen', 'Cumulative net cash flow with earlier, current and later collection timing', '', '', 'Supporting analysis · timing')}
        ${panel('ref', 'Where future refunds come from', 'chart-ref', 'Projected refunds by month and by source',
          `Future refunds only: the ${S.int(G.refunded.n)} clients already marked Refunded in Jira were paid back in the past and are not included. Every refund returns 100% of the upfront payment. Refunds from clients still searching follow the timing of past refunds; paused refunds follow the expected-days setting; failed contracts follow their contract timing.`, '', 'Supporting analysis · refunds', exBlock('ref', 'How future refunds are calculated', 'Who is expected to refund, and why past refunds are not included'))}
        ${UNRES}
        <section class="panel" id="p-groups" aria-labelledby="h-groups">
          <div class="panel-head"><div class="ph"><h2 id="h-groups">Every won deal, accounted for</h2><p class="sub">Each of the ${S.int(C.view.engagements)} won deals sits in exactly one row. “Still owed” is money still owed under contracts, from the reporting layer’s cash forecast view.</p></div></div>
          <div class="tw" id="t-groups"></div>
        </section>
        <section class="panel cf-notes" id="notes" aria-labelledby="h-notes">
          <div class="panel-head"><div class="ph"><h2 id="h-notes">Assumptions &amp; Methodology</h2><p class="sub">What the forecast assumes, in plain terms. The first group follows the controls on the left.</p></div></div>
          <div class="ag">
            <div class="ag-col"><h3>You control <span>· the controls on the left</span></h3><div class="ag-grid" id="ag-you"></div></div>
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
  const inputs = { d: $('r-d'), max: $('r-max'), pc: $('r-pc') }, huntBtn = $('t-hunt');
  AFF.forEach(k => { inputs[k + 'c'] = $('r-' + k + '-c'); inputs[k + 'r'] = $('r-' + k + '-r'); });
  function sync() {
    inputs.max.value = st.max; inputs.d.max = st.max; st.d = Math.min(st.d, st.max); inputs.d.value = st.d;
    inputs.pc.value = st.pc;
    huntBtn.setAttribute('aria-checked', String(st.h));
    AFF.forEach(k => { inputs[k + 'c'].value = Math.round(st.aff[k].conv * 100); inputs[k + 'r'].value = st.aff[k].rev; });
    Object.values(inputs).forEach(fill);
  }
  function read(src) {
    if (src === inputs.max) { st.max = +inputs.max.value; inputs.d.max = st.max; if (+inputs.d.value > st.max) inputs.d.value = st.max; fill(inputs.d); }
    st.d = +inputs.d.value;
    st.pc = Math.max(0, Math.min(100, Math.round(+inputs.pc.value)));
    AFF.forEach(k => { st.aff[k].conv = inputs[k + 'c'].value / 100; st.aff[k].rev = +inputs[k + 'r'].value; });
  }
  let raf = 0;
  Object.values(inputs).forEach(el => el.addEventListener('input', () => { fill(el); read(el); cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }));
  const presetDay = k => (k === 'opt' ? OPT : k === 'pes' ? st.max : Math.round((OPT + st.max) / 2));
  document.querySelectorAll('.presets [data-preset]').forEach(b => b.addEventListener('click', () => { st.d = presetDay(b.dataset.preset); sync(); render(); }));
  huntBtn.addEventListener('click', () => { st.h = !st.h; sync(); render(); });
  $('b-reset').addEventListener('click', () => { st = defaults(); sync(); render(); });

  /* ------------------------------------------------------------------ chart helpers */
  let M = model(st), MM = monthly(M), MV = monthView(MM), GN = groupNet(st, M);
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
    const pv = pausedView(st), notUC = fixedDue - M.tot.fixed, notNP = NP.second - NP.collect, notClosing = (1 - pv.r) * PA.second;
    const evb = G.closed.evidenced_by || {}, ea = evb.address || { n: 0, outstanding: 0 }, en = evb.name || { n: 0, outstanding: 0 };
    const P = affParts(st), chosen = AFF.reduce((a, k) => a + P[k].chosen, 0), assumed = AFF.reduce((a, k) => a + P[k].assumed, 0);
    const rd = (h, t) => [h, t];
    return [
      { ax: 'Contract balances', n: 'Balance on contracts (second installments)', v: contractual, kind: 'total', basis: ['rec'],
        tip: `Second installments still shown as unpaid across all ${S.int(C.view.engagements)} won deals, plus ${money(sched)} for ${G.scheduled.n} closings scheduled after ${S.date(C.asof)}.`,
        x: () => [rd('What it is', `The second installments the 16 Nov reporting layer’s cash view shows as still unpaid on all ${S.int(C.view.engagements)} won deals (${amt(C.view.gross_outstanding)}), plus ${amt(sched)} for the ${G.scheduled.n} closings scheduled after ${S.date(C.asof)}, which that view already counts as collected.`),
          rd('Where it comes from', 'Split Pay deals pay half at the win and half at closing, so every deal that has not closed still owes its second half. This is a recorded balance, not a forecast.'),
          rd('Why it is not the forecast', `Most of it is not future cash. The next four steps remove balances that cannot be collected or are still being reconciled, and none of them uses a probability. After them ${amt(active)} remains owed by clients still in progress: ${amt(G.under_contract.second + G.scheduled.second)} under contract or scheduled, ${amt(G.noprop.second)} still searching and ${amt(G.paused.second)} paused.`)] },
      { ax: 'Cancelled by past refunds', n: 'Cancelled by past refunds', v: -G.refunded.outstanding, basis: ['rec'],
        tip: `${S.int(G.refunded.n)} won deals were refunded before ${S.date(C.asof)}. Their second installment will never be billed, so it leaves the balance. Not a cash outflow: those refunds happened in the past.`,
        x: () => [rd('What it is', `${S.int(G.refunded.n)} won deals marked Refunded in Jira before ${S.date(C.asof)}. Each one’s second installment will never be billed, so it comes off the balance.`),
          rd('How it is calculated', `${S.int(G.refunded.n)} deals × the unpaid second installment on each = ${amt(G.refunded.outstanding)}. Recorded in Jira and the cash view; no percentage is involved.`),
          rd('Not a cash outflow', `This is not money going out. Those clients’ refunds (about ${amt(G.refunded.paid)} paid upfront) were returned in the past and are not part of the forecast. Refunds still expected to be paid are the separate “Future refunds paid out” step: ${amt(M.tot.refund)} in this scenario.`),
          rd('Effect on expected cash', 'None. The balance is no longer owed, so it was never going to arrive.')] },
      { ax: 'Unverified records', n: 'Unverified records (set aside)', v: -unverified, basis: ['rec'],
        tip: `${S.int(nUnres)} won deals with missing records. Kept out of the forecast until they are found.`,
        x: () => [rd('What it is', `${S.int(nUnres)} won deals whose progress cannot be found in Jira, client e-mails, onboarding forms or purchase records: ${S.int(G.unverified_closing.n)} have a post-close status but no closing date, ${S.int(G.unverified_repeat.n)} are repeat purchases without their own Jira issue and ${S.int(G.unverified_none.n)} have no matching record.`),
          rd('How it is calculated', `Recorded balances: ${amt(G.unverified_closing.outstanding)} + ${amt(G.unverified_repeat.outstanding)} + ${amt(G.unverified_none.outstanding)} = ${amt(unverified)}.`),
          rd('Why it is set aside', `Without a record showing the client is still active, the model can neither expect a collection nor a refund, so these stay out of every figure instead of being guessed. No control changes this. Each deal is identified in an internal reconciliation list (not published); once a record is found, the deal is forecast like the rest.`),
          rd('Effect on expected cash', 'Reduces the balance only. It adds no expected cash and no refund.')] },
      { ax: 'Second deals under review', n: 'Second deals under review', v: -dupB, basis: ['rec'],
        tip: `${S.int(G.second_deal_review.n)} second deals (same client, value and win moment as another deal). Kept out of the forecast until reviewed.`,
        x: () => [rd('What it is', `${S.int(G.second_deal_review.n)} won deals with the same client, win date and value as another deal, typically a second search bought together. They have no engagement record of their own, and neither a separate purchase nor a duplicate has been confirmed.`),
          rd('How it is calculated', `${S.int(G.second_deal_review.n)} deals, ${amt(dupB)} of recorded balances. ${R.separate_purchase === 1 ? 'One similar deal has its own Jira issue and is forecast normally.' : `${S.int(R.separate_purchase)} similar deals have their own Jira issue and are forecast normally.`}`),
          rd('Why it is set aside', 'Counting them could double-count a purchase; leaving them out could miss a real second search. They stay out (the conservative choice) until reviewed. No control changes this.'),
          rd('Effect on expected cash', 'Reduces the balance only. It adds no expected cash and no refund.')] },
      { ax: 'Assumed collected at closing', n: 'Assumed collected at closing', v: -G.closed.outstanding, basis: ['inf'],
        tip: `${S.int(G.closed.evidenced)} closings found only in brokerage, lender or affiliate records. The second installment is assumed collected at closing under the Split Pay rule.`,
        x: () => [rd('What it is', `${S.int(G.closed.evidenced)} deals that Jira does not show as closed with a date, but whose closing appears in other records. Under the Split Pay rule the second half is paid at closing, so each balance is treated as collected. It is an assumed receipt, not a recorded payment.`),
          rd('How it is calculated', `${S.int(ea.n)} matched by property address in affiliate records (${amt(ea.outstanding)}) and ${S.int(en.n)} matched by client name in brokerage or lender records (${amt(en.outstanding)}) = ${amt(G.closed.outstanding)}. The same rule already treats the other ${S.int(G.closed.n - G.closed.evidenced)} recorded closings as collected, with no balance left.`),
          rd('Effect on expected cash', `None. It is treated as already collected, so it is not future cash. It is ${pct(G.closed.outstanding / contractual)} of the starting balance.`)] },
      { ax: 'Not expected to close', n: 'Not expected to close', v: -(notUC + notNP), basis: ['inf'],
        tip: `Expected to close: ${pct(G.under_contract.p_close)} under contract, ${pct(NP.p_close)} still searching (history of past clients at the same stage).`,
        x: () => [rd('What it is', 'The part of the balance owed by clients under contract or still searching who, judging by past clients, will not buy a property and so never owe their second installment.'),
          rd('How it is calculated', `Under contract or scheduled: ${pct(G.under_contract.p_close)} of the ${S.int(G.under_contract.n)} under-contract clients (and ${pct(G.scheduled.p_close)} of the ${S.int(G.scheduled.n)} scheduled closings) are expected to close, so ${amt(notUC)} of ${amt(fixedDue)} is not expected to be paid. Still searching: ${pct(NP.p_close)} of ${S.int(NP.n)} clients are expected to buy, so ${amt(notNP)} of ${amt(NP.second)} is not expected to be paid.`),
          rd('Where the percentages come from', 'Past clients who reached the same stage and had waited as long: how many went on to buy. Those chances already reflect clients who later refunded or paused, which is why they are not subtracted again.'),
          rd('Effect on expected cash', `Reduces the balance by what history says will not be paid. Of the clients still searching, ${pct(NP.p_refund)} are expected to refund and ${pct(NP.p_pause)} to pause or keep searching${st.h ? '; the refunds show up later as a cash outflow' : '; refunds from them are switched off in this scenario'}.`)] },
      { ax: 'Paused, not closing', n: 'Paused, not closing', v: -notClosing, basis: ['sce', 'asm'],
        tip: `${pct(1 - pv.r)} of ${S.int(PA.n)} paused and Additional Service deals do not close in this scenario and receive a full refund. They never pay the second installment.`,
        x: () => [rd('What it is', 'Paused and Additional Service deals that, at the setting you selected, do not close. Their second installment is not collected, and they receive a full refund of what they paid upfront.'),
          rd('How it is calculated', `${S.int(PA.n)} deals owe ${amt(PA.second)} in second installments. You assume ${pct(pv.r)} close, so ${pct(1 - pv.r)} × ${amt(PA.second)} = ${amt(notClosing)} is not collected. The ${S.int(PA.payment.pif)} Paid In Full deals owe nothing more, so they add nothing here.`),
          rd('Where it comes from', `${chip('sce')} The % expected to close is an assumption (Paused card on the left), not a measured rate. ${chip('asm')} ${S.int(PA.payment.assumed_split)} of the ${S.int(PA.n)} deals have no recorded payment type and are taken as Split Pay.`),
          rd('Effect on expected cash', 'Reduces collections. The same deals are paid back their upfront payment in the “Future refunds paid out” step.')] },
      { ax: 'Service collections', n: 'Expected service collections', v: M.tot.service, kind: 'sub', basis: ['inf', 'sce'], tip: 'Second installments expected to be collected.',
        x: () => [rd('What it is', 'The second installments expected to be collected at closing from the clients still in progress.'),
          rd('How it is calculated', `${amt(M.tot.fixed)} contracts in progress + ${amt(M.tot.noprop)} clients still searching + ${amt(M.tot.paused)} paused clients who close = ${amt(M.tot.service)}, which is ${pct(M.tot.service / active)} of the ${amt(active)} still owed by clients in progress.`),
          rd('Where it comes from', `Recorded balances ${chip('rec')} multiplied by an inferred chance of closing ${chip('inf')} and, for paused clients, your % expected to close ${chip('sce')}.`)] },
      { ax: 'Affiliate revenue', n: 'Affiliate revenue', v: M.tot.aff, basis: ['rec', 'sce'], tip: `Realtor, lender and STR Cribs fees: ${money(M.tot.affDone)} from purchases completed since ${S.date(CP.from)} (not yet received) and ${money(M.tot.affFc)} from forecast closings. Totals do not depend on the payout dates.`,
        x: () => [rd('What it is', `Fees STRSearch expects from partners (realtor, lender, STR Cribs): on purchases already completed since ${S.date(CP.from)} whose fee is not yet received, and on the closings expected above. It is new revenue, not part of the balance owed.`),
          rd('How it is calculated', `${amt(M.tot.affDone)} from ${S.int(CP.n)} completed purchases (fees the trackers do not show as paid) + ${amt(chosen)} from forecast closings whose partner choice is recorded in Jira ${chip('rec')} + ${amt(assumed)} modeled from your conversion settings where no choice is recorded ${chip('sce')} = ${amt(M.tot.aff)}. Each fee counts once: a completed purchase is never also a forecast closing.`),
          rd('When it arrives', 'On modeled payout dates: realtor fees the month after each quarter ends, lender and STR Cribs fees the month after closing, all on the 15th. October’s lender and STR Cribs fees were due on 15 Nov with no payment recorded, so they are placed in November. The dates change when the money arrives, never how much.')] },
      { ax: 'Future refunds paid out', n: 'Future refunds paid out', v: M.tot.refund, basis: ['inf', 'sce'], tip: 'Cash paid back to clients expected to refund: 100% of their upfront payment.',
        x: () => [rd('What it is', 'Cash STRSearch expects to hand back to clients who refund in the future. Every approved refund returns 100% of the upfront payment, and a refunded client never pays the second installment.'),
          rd('How it is calculated', `${amt(-M.tot.refPA)} paused clients refunded (${pct(pv.f)} × ${amt(PA.paid)} paid upfront ${chip('asm')}) + ${amt(-M.tot.refNP)} clients still searching (${pct(NP.p_refund)} expected to refund${st.h ? '' : '; switched off'}) + ${amt(-M.tot.refUC)} under-contract clients who do not close (${pct(H0.uc_fail_refund)}) = ${amt(-M.tot.refund)}.`),
          rd('Not the same as “Cancelled by past refunds”', 'That earlier step is the balance on deals refunded in the past. This step is cash still to go out.')] },
      { ax: 'Estimated net cash', n: 'Estimated future net cash', v: M.tot.net, kind: 'total', basis: ['rec', 'inf', 'sce'], tip: 'Service collections + affiliate revenue − future refunds, under the selected assumptions.',
        x: () => [rd('What it is', 'The estimated cash STRSearch can still expect from deals already won, under the assumptions currently selected. It is a probability-weighted estimate, not a commitment.'),
          rd('How it is calculated', `${amt(M.tot.service)} service collections + ${amt(M.tot.aff)} affiliate revenue − ${amt(-M.tot.refund)} future refunds = ${amt(M.tot.net)}.`),
          rd('What it rests on', `${amt(GN.uc.net)} comes from contracts in progress, ${amt(GN.np.net)} from clients still searching, ${amt(GN.pa.net)} from paused clients (it depends on the % expected to close you chose) and ${amt(GN.cp.net)} from fees on completed purchases. Open “How is this number built?” above for the full picture.`)] },
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
    $('f-bridge').textContent = `Read ${vert ? 'left to right' : 'top to bottom'}. Red reduces the total, green adds to it, indigo is a total. “Cancelled by past refunds” is a balance that will never be billed because those refunds happened in the past; “Future refunds paid out” is cash still expected to go out. “Assumed collected at closing” is a balance treated as collected under the Split Pay rule. Shaded steps are not future cash or not expected to pay. ${vert ? 'Hover' : 'Tap'} a bar for detail, or open “Explain each step” below.`;
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
        return tipBox(t, s.n, rows, `${s.tip}<br><b>Basis: ${basisText(s.basis)}</b>`);
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
  const shadow = t => ({ type: 'shadow', shadowStyle: { color: t.grid, opacity: 0.6 } });
  const monthTitle = r => (r.later ? `Later: ${mFull(r.from)} – ${mFull(r.to)}` : mFull(r.k) + (r.k === mKey(0) ? ' (from ' + dShort(1) + ')' : ''));
  const xLab = r => (r.later ? 'Later' : mLab(r.k));
  const mMid = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  let cashDetail = false;                    // false: service collections as one bar; true: split by client group
  const cashSeriesDef = t => (cashDetail ? SRC(t) : [
    { k: 'service', name: 'Service collections', color: t.uc },
    { k: 'aff', name: 'Affiliate revenue', color: t.closed },
    { k: 'refund', name: 'Future refunds paid out', color: t.neg },
  ]);
  const cashChart = chart($('c-cash'), () => {
    const t = tok(), src = SRC(t), ser = cashSeriesDef(t), pos = ser.map(x => x.k).filter(k => k !== 'refund'), narrow = $('c-cash').offsetWidth < 560;
    const eps = Math.max(1, ...MV.map(r => r.inflow)) * 0.005, topKey = r => { for (let i = pos.length - 1; i >= 0; i--) if (r[pos[i]] > eps) return pos[i]; return null; };
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 10, top: 30, bottom: 8, containLabel: true },
      tooltip: tip(t, { trigger: 'axis', axisPointer: shadow(t), formatter: ps => {
        const r = MV[ps[0].dataIndex];
        return tipBox(t, monthTitle(r), [['Service collections', money(r.service), cashDetail ? null : t.uc, 'b']]
          .concat(src.slice(0, 3).filter(s => Math.abs(r[s.k]) > 0.5).map(s => [s.name, money(r[s.k]), cashDetail ? s.color : null, 'sub']))
          .concat([['Affiliate revenue', money(r.aff), t.closed]], r.affDone > 0.5 ? [['Completed purchases', money(r.affDone), null, 'sub'], ['Forecast closings', money(r.affFc), null, 'sub']] : [],
            [['Future refunds paid out', money(r.refund), t.neg], [r.later ? 'Net in these months' : 'Net this month', money(r.net), null, 'b'], ['Running total', money(r.cum)]]),
          r.later ? 'Summarised as one block: past clients this far out are few, so the month of each payment is uncertain. The amounts are in the total.' : '');
      } }),
      xAxis: { type: 'category', data: MV.map(xLab), axisLine: { onZero: true, lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.label, fontSize: 12, interval: narrow ? 'auto' : 0, lineHeight: 15,
        formatter: (v, i) => (MV[i] && MV[i].later ? `{l|Later}\n{s|${mRange(MV[i])}}` : v), rich: { l: { fontWeight: 700, color: t.ink2, fontSize: 12, lineHeight: 15 }, s: { color: t.muted, fontSize: 10.5, lineHeight: 13 } } } },
      yAxis: S.valAxis(t, { axisLabel: { color: t.label, fontSize: 12, formatter: v => short(v) } }),
      series: ser.map(s => ({ name: s.name, type: 'bar', stack: 'c', barMaxWidth: 56,
        data: MV.map(r => ({ value: Math.round(r[s.k]), itemStyle: Object.assign({ borderRadius: s.k === 'refund' ? [0, 0, 4, 4] : topKey(r) === s.k ? [4, 4, 0, 0] : 0 },
          r.later ? { color: S.stripes(s.color, t.surface), borderColor: s.color, borderWidth: 1.2 } : {}) })),
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } }))
        .concat([['line', r => !r.later], ['scatter', r => r.later]].map(([type, on]) => ({ name: 'Net', type, data: MV.map(r => (on(r) ? Math.round(r.net) : '-')), symbol: 'circle', symbolSize: 8, z: 5,
          lineStyle: { color: t.ink, width: 2 }, itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 }, tooltip: { show: false },
          label: { show: true, position: 'top', distance: 9, formatter: p => short(p.value), color: t.ink, fontSize: 12, fontWeight: 700, fontFamily: FAM,
            backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 6, padding: [2, 6] } }))),
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
      ? `Service collections split by client group. Each bar is one month’s cash, not a running total. The line is the month’s net (cash in minus refunds), not extra cash. Affiliate fees appear on their modeled payout dates. The striped bar sums every month after ${mFull(SHOW_K)}.`
      : `Each bar is one month’s cash, not a running total. Blue and green bars are cash in; red is refunds paid out. The line is the month’s net (cash in minus refunds), not extra cash. Affiliate fees appear on their modeled payout dates. The striped bar sums every month after ${mFull(SHOW_K)}.`;
  }

  /* ------------------------------------------------------------------ refunds by source */
  const RSRC = t => [
    { k: 'refPA', name: 'Paused / Additional Service, refunded', color: t.sales, css: 'var(--sales)' },
    { k: 'refNP', name: 'Still searching, expected to refund', color: t.wait, css: 'var(--wait)' },
    { k: 'refUC', name: 'Under contract or scheduled, not closing', color: t.uc, css: 'var(--uc)' },
  ];
  function refRows() {
    const has = r => Math.abs(r.refund) >= 0.5, a = MV.findIndex(has);
    if (a < 0) return [];
    let b = MV.length - 1; while (b > a && !has(MV[b])) b--;
    return MV.slice(a, b + 1);
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
      xAxis: { type: 'category', data: rows.map(xLab), axisLine: { onZero: false, lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.label, fontSize: 12, lineHeight: 15,
        formatter: (v, i) => (rows[i] && rows[i].later ? `{l|Later}\n{s|${mRange(rows[i])}}` : v), rich: { l: { fontWeight: 700, color: t.ink2, fontSize: 12, lineHeight: 15 }, s: { color: t.muted, fontSize: 10.5, lineHeight: 13 } } } },
      yAxis: S.valAxis(t, { max: 0, axisLabel: { color: t.label, fontSize: 12, formatter: v => short(v) } }),
      series: src.map(s => ({ name: s.name, type: 'bar', stack: 'r', barMaxWidth: 52,
        data: rows.map(r => ({ value: Math.round(r[s.k]), itemStyle: Object.assign({ borderRadius: botKey(r) === s.k ? [0, 0, 4, 4] : 0 }, r.later ? { color: S.stripes(s.color, t.surface), borderColor: s.color, borderWidth: 1.2 } : {}) })),
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } })),
    });
  });

  /* ------------------------------------------------------------------ affiliate revenue by partner */
  const TIMING = { realtor: 'Month after the quarter ends', lender: 'Month after closing', cribs: 'Month after closing (provisional)' };
  const affRecv = (k, n) => M.affBy[k].slice(0, Math.max(0, Math.min(n, M.H)) + 1).reduce((a, b) => a + b, 0);   // cash received by day n (modeled)
  const affChart = chart($('c-aff'), () => {
    const t = tok(), P = affParts(st), mx = Math.max(...AFF.map(k => P[k].total), 1);
    return Object.assign(S.base(t), {
      grid: { left: 8, right: 66, top: 4, bottom: 4, containLabel: true },
      tooltip: tip(t, { trigger: 'axis', axisPointer: shadow(t), formatter: ps => {
        const k = AFF[ps[0].dataIndex], p = P[k];
        return tipBox(t, p.label, [
          ['Completed purchases, not yet received', money(p.done), t.acq], [`${S.d1(p.doneN)} completed closings since ${S.date(CP.from)} × ${money(p.rev)}${p.donePaid ? ` (${S.int(p.donePaid)} already received, not counted)` : ''}`, '', null, 'sub'],
          ['Forecast: recorded partner choices', money(p.chosen), t.closed], [`${S.d1(p.known)} expected closings × ${money(p.rev)}`, '', null, 'sub'],
          ['Forecast: modeled conversions', money(p.assumed), t.closed2], [`${pct(p.conv)} of ${S.d1(p.unk)} with no recorded choice × ${money(p.rev)}`, '', null, 'sub'],
          ['Expected revenue', money(p.total), null, 'b'], [`Modeled receipt by ${dShort(lastMonthEnd(2))}`, money(affRecv(k, lastMonthEnd(2)))], [`${TIMING[k]}, on the 15th`, '', null, 'sub']]);
      } }),
      yAxis: { type: 'category', inverse: true, data: AFF.map(k => P[k].label), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: t.ink, fontSize: 13, fontWeight: 600, margin: 12 } },
      xAxis: { type: 'value', min: 0, max: mx * 1.02, show: false },
      series: [
        { name: 'Completed purchases, not yet received', type: 'bar', stack: 'a', barWidth: 28, data: AFF.map(k => Math.round(P[k].done)),
          itemStyle: { color: t.acq, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } },
        { name: 'From recorded partner choices', type: 'bar', stack: 'a', barWidth: 28,
          data: AFF.map(k => ({ value: Math.round(P[k].chosen), itemStyle: { borderRadius: P[k].assumed < 0.5 ? [0, 4, 4, 0] : 0 } })),
          itemStyle: { color: t.closed, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } },
        { name: 'From modeled conversions', type: 'bar', stack: 'a', barWidth: 28, data: AFF.map(k => Math.round(P[k].assumed)),
          itemStyle: { color: t.closed2, borderColor: t.closed, borderWidth: 1.5, borderRadius: [0, 4, 4, 0] }, emphasis: { focus: 'series' },
          label: { show: true, position: 'right', distance: 8, color: t.ink, fontSize: 13.5, fontWeight: 700, formatter: p => short(P[AFF[p.dataIndex]].total) } },
      ],
    });
  });

  /* ------------------------------------------------------------------ timing comparison (timing only: every line ends at the same total) */
  const scenarios = () => [
    { key: 'opt', name: 'Earlier collections', s: Object.assign({}, st, { d: OPT }) },
    { key: 'cur', name: 'Your timing', s: st },
    { key: 'pes', name: 'Later collections', s: Object.assign({}, st, { d: st.max }) },
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

  /* ------------------------------------------------------------------ tables (sortable, follow the controls) */
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
      rows.push({ step: s.n, v: s.v, run, tip: s.tip, kind: s.kind, basis: s.basis, color: wfColor(s), _cls: s.kind ? 'tot' : '' });
    });
    dataTable($('t-bridge'), 'bridge', [
      { k: 'step', label: 'Step', html: r => sw(r.color) + r.step },
      { k: 'v', label: 'Amount', num: true, html: r => (r.kind ? short(r.v) : signed(r.v)), title: r => money(r.v) },
      { k: 'run', label: 'Running total', num: true, fmt: short, title: r => money(r.run) },
      { k: 'basis', label: 'Basis', html: r => chips(r.basis), sort: false },
      { k: 'tip', label: 'What it includes', cls: 'rule' },
    ], rows, { sortable: false, cls: 'steps', caption: 'From the balance on contracts to estimated net future cash, step by step' });
  }
  function cashTable() {
    const rows = MV.map(r => ({ k: r.k, month: r.later ? `Later (${mRange(r)})` : mMid(r.k) + (r.k === mKey(0) ? ' (from ' + dShort(1) + ')' : ''), service: r.service, fixed: r.fixed, noprop: r.noprop, paused: r.paused, aff: r.aff, affDone: r.affDone, refund: r.refund, net: r.net, cum: r.cum, _cls: r.later ? 'later' : '' }));
    const mcol = (k, label, extra) => Object.assign({ k, label, num: true, fmt: cellM, title: r => money(r[k]) }, extra);
    const grp = cashDetail ? [mcol('fixed', 'Under contract / scheduled', { cls: 'dim', hcls: 'dim' }), mcol('noprop', 'Still searching', { cls: 'dim', hcls: 'dim' }), mcol('paused', 'Paused, resuming', { cls: 'dim', hcls: 'dim' })] : [];
    dataTable($('t-cash'), 'cash', [
      { k: 'month', label: 'Month', sv: r => r.k },
      mcol('service', 'Service collections')].concat(grp, [mcol('aff', 'Affiliate revenue'), mcol('affDone', 'of which completed purchases', { cls: 'dim', hcls: 'dim' }), mcol('refund', 'Future refunds'),
      mcol('net', 'Net cash', { cls: 'strong' }), mcol('cum', 'Running total')]),
    rows, { total: { month: 'Total', service: M.tot.service, fixed: M.tot.fixed, noprop: M.tot.noprop, paused: M.tot.paused, aff: M.tot.aff, affDone: M.tot.affDone, refund: M.tot.refund, net: M.tot.net, cum: M.tot.net }, caption: 'Expected cash flow by month' });
  }
  function refTable() {
    const src = RSRC(tok()), months = refRows(), pv = pausedView(st);
    const shown = months.filter(r => !r.later), later = months.filter(r => r.later);
    const driver = {
      refPA: `${pct(pv.f)} of ${S.int(PA.n)} paused / Additional Service clients do not close and are refunded 100% of their upfront payment`,
      refNP: st.h ? `${S.int(NP.n)} clients still searching: ${pct(NP.p_refund)} expected to refund, like past clients at the same stage` : `${S.int(NP.n)} clients still searching: refunds switched off in this simulation`,
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
      .concat(later.length ? [{ k: 'later', label: `Later (${mRange(later[0])})`, num: true, fmt: cellM, title: r => money(r.later) }] : []),
    rows, { total: T, caption: 'Projected refunds by source and month' });
  }
  function affTable() {
    const P = affParts(st), tot = AFF.reduce((a, k) => a + P[k].total, 0);
    const rows = AFF.map(k => Object.assign({ k, share: tot ? P[k].total / tot : 0 }, P[k]));
    dataTable($('t-aff'), 'aff', [
      { k: 'label', label: 'Partner', html: r => (r._total ? 'Total' : `${sw('var(--closed)')}${r.label}<small>Completed: ${S.int(r.doneN)} fees not yet received · forecast: ${S.int(r.known)} expected closings already chose this partner, ${S.int(r.unk)} with no recorded choice</small>`) },
      { k: 'done', label: 'Completed purchases', num: true, fmt: cellM, title: r => money(r.done) },
      { k: 'conv', label: 'Conversion (no choice recorded)', num: true, fmt: (v, r) => (r._total ? '' : pct(v)) },
      { k: 'paying', label: 'Expected paying closings (forecast)', num: true, fmt: v => (v == null ? '' : S.int(v)) },
      { k: 'rev', label: 'Revenue per conversion', num: true, fmt: (v, r) => (r._total ? '' : money(v)) },
      { k: 'chosen', label: 'Forecast: recorded choices', num: true, fmt: cellM, title: r => money(r.chosen) },
      { k: 'assumed', label: 'Forecast: modeled conversions', num: true, fmt: cellM, title: r => money(r.assumed) },
      { k: 'total', label: 'Expected revenue', num: true, fmt: cellM, title: r => money(r.total), cls: 'strong' },
      { k: 'share', label: 'Share', num: true, fmt: v => (v ? pct(v) : '–') },
      { k: 'timing', label: 'Modeled cash arrival (15th)', sort: false, fmt: (v, r) => (r._total ? '' : v) },
      { k: 'dec', label: `Received by ${dShort(lastMonthEnd(2))}`, num: true, fmt: cellM, title: r => money(r.dec) },
    ], rows.map(r => Object.assign(r, { timing: TIMING[r.k], dec: affRecv(r.k, lastMonthEnd(2)) })),
    { total: { label: 'Total', paying: null, done: AFF.reduce((a, k) => a + P[k].done, 0), chosen: AFF.reduce((a, k) => a + P[k].chosen, 0), assumed: AFF.reduce((a, k) => a + P[k].assumed, 0), total: tot, share: tot ? 1 : 0, dec: AFF.reduce((a, k) => a + affRecv(k, lastMonthEnd(2)), 0) }, caption: 'Expected affiliate revenue by partner' });
  }
  function scenTable() {
    const sc = scenarios(), ends = [2, 3, 4].map(lastMonthEnd), cur = sc[1];
    const delta = (x, v, ref) => (x.key === 'cur' || Math.abs(v - ref) < 500 ? '' : `<small>${signed(v - ref)} vs your timing</small>`);
    const rows = sc.map(x => Object.assign({ key: x.key, name: x.name, d: x.s.d, timing: `${x.s.d} days · centred on ${dShort(x.s.d)}`, total: x.m.tot.net, _cls: x.key === 'cur' ? 'cur' : '' },
      Object.fromEntries(ends.map((d, i) => ['e' + i, x.m.within(d)])), { _ref: Object.fromEntries(ends.map((d, i) => ['e' + i, cur.m.within(d)])) }));
    dataTable($('t-scen'), 'scen', [
      { k: 'name', label: 'Timing', cls: 'strong' },
      { k: 'timing', label: 'Collection timing', sv: r => r.d },
    ].concat(ends.map((d, i) => ({ k: 'e' + i, label: `Running total by ${dShort(d)}`, num: true, html: r => short(r['e' + i]) + delta(r, r['e' + i], r._ref['e' + i]), title: r => money(r['e' + i]) })))
      .concat([{ k: 'total', label: 'Net total (same for all)', num: true, fmt: short, title: r => money(r.total) }]),
    rows, { caption: 'Running total of net cash by date', cls: 'scen' });
  }
  function groupsTable() {
    const XU = G.under_contract.expected, XS = G.scheduled.expected, pv = pausedView(st);
    const spec = [
      { _group: 'In the forecast' },
      ['under_contract', 'var(--uc)', XU.svc, -REFUND_SHARE * XU.refund_base, affValue(XU.aff, st), `${pct(G.under_contract.p_close)} expected to close, from past clients who had waited as long; timed by the remaining historical Under Contract → closing times (${S.int(U.n)} closings, median ${U.median} days)`],
      ['scheduled', 'var(--uc)', XS.svc, -REFUND_SHARE * XS.refund_base, affValue(XS.aff, st), `${pct(G.scheduled.p_close)} expected to close on the scheduled date (all by ${S.date(C.notes.scheduled_dates_to)}); the cash forecast view already counts these ${short(C.view.scheduled_counted_collected)} as collected`],
      ['noprop', 'var(--wait)', M.tot.noprop, -(st.h ? REFUND_SHARE * NP.refund_base : 0), affValue(NP.aff, st), `${S.int(NP.hunting)} searching + ${S.int(NP.not_started)} won but not started; like past clients at the same stage: ${pct(NP.p_close)} close, ${st.h ? `${pct(NP.p_refund)} refund` : 'refunds switched off'}, ${pct(NP.p_pause)} pause or keep searching; timed by past clients’ remaining days to closing (refunds by past refund timing)`],
      ['paused', 'var(--sales)', M.tot.paused, M.tot.refPA, pv.close.aff, `${pct(pv.r)} close and pay the second installment (nothing more for the ${S.int(PA.payment.pif)} Paid In Full deals); ${pct(pv.f)} are refunded 100% of their upfront payment and never pay it`],
      ['closed', 'var(--acq)', 0, 0, M.tot.affDone, `Second installment assumed collected at the recorded closing (incl. ${S.int(G.closed.evidenced)} closings found in affiliate or brokerage records without a recorded closing date). Affiliate fees from the ${S.int(CP.n)} closings since ${S.date(CP.from)} that the trackers do not show as paid are still to come`],
      { _group: 'Set aside: not future cash' },
      ['refunded', null, 0, 0, 0, 'Refund already paid back (historical): nothing more to collect or refund'],
      ['unverified_closing', null, 0, 0, 0, 'Missing: closing date. Post-close Jira status but no closing in any source'],
      ['unverified_repeat', null, 0, 0, 0, 'Missing: a Jira issue for this purchase. The client’s only issue tracks their other won deal'],
      ['unverified_none', null, 0, 0, 0, `Missing: any Jira, e-mail or purchase record (${S.int(R.unverified_none_2024)} won in 2024, ${S.int(R.unverified_none_2026)} in 2026)`],
      ['second_deal_review', null, 0, 0, 0, 'Same client, won date and value as another deal, recorded as a second deal, with no engagement of its own: kept out of the forecast and flagged for review'],
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

  /* ------------------------------------------------------------------ paused financial exposure */
  function renderPaused() {
    const pv = pausedView(st), net = pv.close.net + pv.refund.net, PY = PA.payment, MS = PA.master;
    $('s-paused').innerHTML = `${S.int(PA.n)} deals (${S.int(PA.paused_n)} Paused, ${S.int(PA.additional_n)} Additional Service), ${short(PA.booked)} booked. What is owed, what was already paid, and what the selected setting assumes. ${chip('rec')}${chip('asm')}${chip('sce')}`;
    const card = (l, v, s, bs) => `<div class="pxc"><span>${l}</span><b title="${money(v)}">${short(v)}</b><small>${s}</small>${chips(bs)}</div>`;
    $('px-cards').innerHTML = card('Installments still owed', PA.second, `The second installments these deals still owe under Split Pay. Collected only if the client closes. The ${S.int(PY.pif)} Paid In Full deals owe nothing more.`, ['rec', 'asm'])
      + card('Already paid upfront', PA.paid, `Cash already received, and the most that could be refunded (100% of the upfront payment). Payment type is recorded for ${S.int(PY.recorded)} of ${S.int(PA.n)} deals (${S.int(PY.recorded_split)} Split Pay, ${S.int(PY.recorded_pif)} Paid In Full); the other ${S.int(PY.assumed_split)} are taken as Split Pay, so their upfront amount is assumed to be half the deal value.`, ['asm'])
      + card('Potential affiliate revenue', pv.full, 'What partner fees would add if every one of these deals closed, at the current fee and conversion settings. Paid In Full deals earn them too.', ['sce']);
    const seg = [['close', 'Close', 'var(--closed)', st.pc], ['refund', 'Full refund', 'var(--neg)', 100 - st.pc]];
    $('px-bar').innerHTML = seg.map(([, , c, v]) => `<i style="flex:${v};background:${c}"></i>`).join('');
    $('px-bar').setAttribute('aria-label', `Paused outcomes: ${seg.map(([, l, , v]) => `${l} ${v}%`).join(', ')}`);
    $('px-lg').innerHTML = seg.map(([, l, c, v]) => `<span><i style="background:${c}"></i>${l}<b>${v}%</b></span>`).join('');
    const rows = [
      { o: 'Close', col: 'var(--closed)', ...pv.close, note: 'Pays the second installment (Split Pay) and earns affiliate fees' },
      { o: 'Full refund', col: 'var(--neg)', ...pv.refund, note: '100% of the upfront payment is returned; the second installment is never collected' },
    ];
    dataTable($('t-px'), 'px', [
      { k: 'o', label: 'Outcome', html: r => (r._total ? 'All paused clients' : `${sw(r.col)}${r.o}<small>${r.note}</small>`) },
      { k: 'share', label: 'Share', num: true, fmt: v => pct(v) },
      { k: 'n', label: 'Deals (approx.)', num: true, fmt: (v, r) => (r._total ? S.int(PA.n) : '≈ ' + S.int(v)) },
      { k: 'svc', label: 'Installments collected', num: true, fmt: cellM, title: r => money(r.svc) },
      { k: 'aff', label: 'Affiliate revenue', num: true, fmt: cellM, title: r => money(r.aff) },
      { k: 'ref', label: 'Refunds paid', num: true, fmt: cellM, title: r => money(r.ref) },
      { k: 'net', label: 'Net cash', num: true, fmt: cellM, title: r => money(r.net), cls: 'strong' },
    ], rows, { sortable: false, total: { o: 'All', share: 1, n: PA.n, svc: pv.close.svc, aff: pv.close.aff, ref: pv.refund.ref, net }, cls: 'px', caption: 'Paused client outcomes at the selected setting' });
    $('px-range').innerHTML = `The group’s net effect runs from <b>${short(pv.range.refund)}</b> at 0% (every deal refunded) to <b>${signed(pv.range.close)}</b> at 100% (every deal closes), at the current fee and conversion settings. The % expected to close is an assumption, not a measured rate: this is the largest single swing in the forecast.`;
    const bal = v => `<td class="n">${money(v)}</td>`;
    const via = MS.recovered.by, viaT = [via.own_jira ? `${S.int(via.own_jira)} matched to their own Paused Jira issue by e-mail` : '', via.separate_purchase ? `${S.int(via.separate_purchase)} separate purchase with its own Jira issue` : ''].filter(Boolean).join(', ');
    $('t-pxm').innerHTML = `<table class="cf-t px-m"><caption class="visually-hidden">Reconciliation from the won_clients_master Paused filter to the forecast group</caption>
      <thead><tr><th scope="col">Step</th><th scope="col" class="n">Deals</th><th scope="col" class="n">Booked value</th></tr></thead><tbody>
      <tr><td>won_clients_master, issue_status = Paused</td><td class="n">${S.int(MS.n)}</td>${bal(MS.booked)}</tr>
      <tr><td>− Closing already recorded<small>Counted as a completed purchase</small></td><td class="n">−${S.int(MS.moved_out.n)}</td>${bal(-MS.moved_out.booked)}</tr>
      <tr><td>+ Additional Service<small>Same treatment as Paused</small></td><td class="n">+${S.int(MS.additional.n)}</td>${bal(MS.additional.booked)}</tr>
      <tr><td>+ Recovered by reconciliation<small>No Jira link in the reporting layer: ${viaT}</small></td><td class="n">+${S.int(MS.recovered.n)}</td>${bal(MS.recovered.booked)}</tr>
      <tr class="tot"><td>Forecast group</td><td class="n">${S.int(PA.n)}</td>${bal(PA.booked)}</tr></tbody></table>`;
    $('t-pxb').innerHTML = `<table class="cf-t px-m"><caption class="visually-hidden">From booked value to future cash for the paused group</caption>
      <thead><tr><th scope="col">Step</th><th scope="col" class="n">Amount</th></tr></thead><tbody>
      <tr><td>Booked value</td>${bal(PA.booked)}</tr>
      <tr><td>− Already paid upfront ${chip('asm')}<small>Received at the win: not future cash</small></td>${bal(-PA.paid)}</tr>
      <tr class="mid"><td>= Remaining installments ${chip('asm')}<small>Split Pay second halves; ${S.int(PY.pif)} Paid In Full deals owe nothing</small></td>${bal(PA.second)}</tr>
      <tr><td>× ${st.pc}% expected to close = collections ${chip('sce')}</td>${bal(pv.close.svc)}</tr>
      <tr><td>+ Affiliate fees on those closings ${chip('sce')}</td>${bal(pv.close.aff)}</tr>
      <tr><td>− Refunds: ${100 - st.pc}% × ${short(PA.paid)} paid upfront</td>${bal(pv.refund.ref)}</tr>
      <tr class="tot"><td>Future net cash from the group</td>${bal(net)}</tr></tbody></table>`;
  }

  /* ------------------------------------------------------------------ expandable explanations (collapsed by default; rebuilt from the model while open) */
  const OPEN = new Set();                              // which nested rows the reader has opened (kept across re-renders)
  const XR = {};
  const acc = (key, label, sub, value, bs, rows) => `<details class="acc" data-n="${key}"><summary><span class="acc-l">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="acc-v${value.cls ? ' ' + value.cls : ''}">${value.t}</span><span class="acc-b">${bs ? chips(bs) : ''}</span></summary>`
    + `<dl class="acc-d">${rows.map(([h, t]) => `<div><dt>${h}</dt><dd>${t}</dd></div>`).join('')}</dl></details>`;
  const val = (v, kind) => ({ t: kind ? short(v) : signed(v), cls: kind ? '' : v < 0 ? 'neg' : v > 0 ? 'pos' : '' });
  function renderX(name) {
    const d = document.querySelector(`details[data-x="${name}"]`);
    if (!d || !d.open || !XR[name]) return;
    const b = $('xb-' + name); b.innerHTML = XR[name]();
    b.querySelectorAll('details[data-n]').forEach(x => { if (OPEN.has(x.dataset.n)) x.open = true; });
  }
  main.addEventListener('toggle', e => {
    const d = e.target; if (!d || !d.matches) return;
    if (d.matches('details[data-x]')) renderX(d.dataset.x);
    else if (d.matches('details[data-n]')) { if (d.open) OPEN.add(d.dataset.n); else OPEN.delete(d.dataset.n); }
  }, true);

  XR.head = () => {
    const P = affParts(st), chosen = AFF.reduce((a, k) => a + P[k].chosen, 0), assumed = AFF.reduce((a, k) => a + P[k].assumed, 0), net = M.tot.net, pv = pausedView(st);
    const row = (l, v, bs, w) => `<tr><td>${l}${bs ? chips(bs) : ''}</td><td class="n">${amtS(v)}</td><td class="w">${w}</td></tr>`;
    const grp = [['Contracts in progress', GN.uc, 'var(--uc)', 'Recorded contracts; history gives each one’s chance of closing.', ['rec', 'inf']],
      ['Clients still searching', GN.np, 'var(--wait)', 'Recorded balances; history gives the chance of closing and of refunding.', ['rec', 'inf']],
      ['Paused clients', GN.pa, 'var(--sales)', 'Depends on the % expected to close you chose.', ['sce', 'asm']],
      ['Completed purchases', GN.cp, 'var(--acq)', `Affiliate fees on closings since ${S.date(CP.from)} that the trackers do not show as paid.`, ['rec', 'sce']]];
    return `<p class="ex-h">How the number adds up</p>
      <table class="mini-t"><tbody>
        ${row('Service collections', M.tot.service, ['inf', 'sce'], `Second installments expected at closing: ${amt(M.tot.fixed)} contracts in progress, ${amt(M.tot.noprop)} clients still searching, ${amt(M.tot.paused)} paused clients who close.`)}
        ${row('Affiliate revenue', M.tot.aff, ['rec', 'sce'], `${amt(M.tot.affDone)} on purchases completed since ${S.date(CP.from)} (not yet received) + ${amt(chosen)} from forecast closings with a recorded partner choice + ${amt(assumed)} modeled from your conversion settings.`)}
        ${row('Future refunds', M.tot.refund, ['inf', 'sce'], `${amt(-M.tot.refPA)} paused clients refunded, ${amt(-M.tot.refNP)} clients still searching${st.h ? '' : ' (switched off)'}, ${amt(-M.tot.refUC)} contracts that do not close. Every refund returns 100% of the upfront payment.`)}
        <tr class="t"><td>Estimated future net cash</td><td class="n">${amt(net)}</td><td class="w">Under the assumptions selected on the left. A probability-weighted estimate, not a commitment.</td></tr></tbody></table>
      <p class="ex-h">Where it comes from</p>
      <div class="gbar" role="img" aria-label="Net cash by client group">${grp.map(([, g, c]) => `<i style="flex:${Math.max(0, g.net)};background:${c}"></i>`).join('')}</div>
      <table class="mini-t"><tbody>${grp.map(([l, g, c, w, bs]) => `<tr><td><span class="sw" style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:8px;background:${c}"></span>${l}${chips(bs)}</td><td class="n">${amt(g.net)}</td><td class="w">${net ? pct(g.net / net) : '–'} of the net. ${w} Collections ${amt(g.svc)} + affiliate ${amt(g.aff)} − refunds ${amt(-g.ref)}.</td></tr>`).join('')}</tbody></table>
      <p class="ex-h">What can change it</p>
      <ul>
        <li><b>The paused % expected to close</b> moves only the paused group: from 0% (all refunded) to 100% (all close), its net runs from ${amt(pv.range.refund)} to ${amt(pv.range.close)}.</li>
        <li><b>Conversion and fee settings</b> move only affiliate revenue. <b>The Hunting switch</b> moves only the ${amt(REFUND_SHARE * NP.refund_base)} refund projected for clients still searching (${st.h ? 'included' : 'excluded'} now).</li>
        <li><b>Expected days</b> and the timing presets change only when paused clients’ cash arrives. The total stays ${amt(net)}.</li></ul>`;
  };
  XR.bridge = () => `<div class="acc-list">${bridgeSteps().map((s, i) => acc('b' + i, s.n, '', val(s.v, s.kind), s.basis, s.x())).join('')}</div>`;
  const TIMING_NOTE = () => {
    const L = MV.find(r => r.later), b0 = TM.bands[0];
    return `<b>Timing.</b> Clients still searching follow how much longer comparable past clients took (a typical new client closes about ${S.int(b0.close_med)} days from now); paused deals follow the expected-days setting (${st.d} days); affiliate fees follow the payout dates. ${L ? `Cash after ${mFull(SHOW_K)} is shown as one block (${short(L.net)} net): it rests on few past clients, so its months are not estimated. ` : ''}The totals do not depend on the timing. Details in the methodology.`;
  };
  const qOf = k => { const [y, m] = k.split('-').map(Number), q = ((Math.floor((m - 1) / 3) + 3) % 4) + 1; return `Q${q} ${m === 1 ? y - 1 : y}`; };
  XR.cash = () => `<p>Open a month to see what is in its bar. Paused clients’ cash moves between months with the expected-days setting, and affiliate cash with the partner payout dates; the totals do not change.</p><div class="acc-list">${MV.map(r => {
    const part = (l, v, items) => (Math.abs(v) < 0.5 ? '' : `${l}: ${amt(v)}${items ? ` (${items})` : ''}`);
    const list = a => a.filter(Boolean).join(', ');
    const rows = [];
    if (r.later) rows.push(['Why one block', `${mFull(r.from)} to ${mFull(r.to)}. This is the slow end of the still-searching timing: some comparable past clients took many more months to close or refund, and realtor fees on those closings arrive a quarter later. Few past clients are seen this far out (the last months rest on ${S.int(TM.closers_after_year)} past closings more than a year after the start), so the amounts count in the total but their months are not estimated.`]);
    if (Math.abs(r.service) >= 0.5) rows.push(['Service collections', `${amt(r.service)}: ${list([r.fixed > 0.5 && `${amt(r.fixed)} from contracts in progress`, r.noprop > 0.5 && `${amt(r.noprop)} from clients still searching`, r.paused > 0.5 && `${amt(r.paused)} from paused clients who close`])}.`]);
    if (Math.abs(r.aff) >= 0.5) {
      const mi = r.later ? -1 : +r.k.slice(5) - 1, notes = [];
      if (r.affDone > 0.5) notes.push(r.affFc < 0.5 ? 'All of it is from purchases already completed (fees not yet received).' : `${amt(r.affDone)} is from purchases already completed (fees not yet received); ${amt(r.affFc)} from forecast closings.`);
      if (r.realtor > 0.5 && mi % 3 === 0) notes.push(`Realtor fees for ${qOf(r.k)} closings arrive this month.`);
      if (r.lender > 0.5 || r.cribs > 0.5) notes.push(r.k === mKey(1) && r.affDone > 0.5 ? 'Lender and STR Cribs fees arrive the month after closing; October’s were due on 15 Nov with no payment recorded.' : 'Lender and STR Cribs fees arrive the month after closing.');
      rows.push(['Affiliate revenue', `${amt(r.aff)}: ${list(AFF.map(k => r[k] > 0.5 && `${DEF.affiliates[k].label} ${amt(r[k])}`))}. ${notes.join(' ')} Modeled receipt dates (the 15th).`]);
    }
    if (Math.abs(r.refund) >= 0.5) rows.push(['Future refunds', `${amt(r.refund)}: ${list([r.refPA < -0.5 && `${amt(-r.refPA)} paused clients refunded`, r.refNP < -0.5 && `${amt(-r.refNP)} clients still searching`, r.refUC < -0.5 && `${amt(-r.refUC)} contracts that do not close`])}.`]);
    rows.push([r.later ? 'Net in these months' : 'Net this month', `${amt(r.net)} = ${amt(r.service)} service collections + ${amt(r.aff)} affiliate − ${amt(-r.refund)} refunds. Running total after ${r.later ? 'them' : 'this month'}: ${amt(r.cum)}.`]);
    return acc('m' + r.k, monthTitle(r), '', val(r.net), null, rows);
  }).join('')}</div>`;
  XR.paused = () => {
    const pv = pausedView(st), PY = PA.payment, FT = PA.fell_through, DF = PA.default;
    const rows = [
      ['px-close', 'Close', pct(pv.r), val(pv.close.net), ['sce'], [
        ['What it means', `About ${S.int(pv.close.n)} of the ${S.int(PA.n)} deals restart, find a property and close. Split Pay deals pay the second installment at closing; the ${S.int(PY.pif)} Paid In Full deals owe nothing more. Every closing earns the usual affiliate fees.`],
        ['How it is calculated', `${pct(pv.r)} × ${amt(PA.second)} still owed = ${amt(pv.close.svc)} collected, plus ${pct(pv.r)} × ${amt(pv.full)} potential affiliate revenue = ${amt(pv.close.aff)}. Timing: spread around the expected-days setting (${st.d} days).`],
        ['Effect on expected cash', `Adds ${amt(pv.close.net)}.`]]],
      ['px-refund', 'Full refund', pct(pv.f), val(pv.refund.net), ['sce', 'asm'], [
        ['What it means', `About ${S.int(pv.refund.n)} deals do not close and receive 100% of what they paid upfront. Their second installment is never collected and they earn no affiliate fees.`],
        ['How it is calculated', `${pct(pv.f)} × ${amt(PA.paid)} paid upfront = ${amt(-pv.refund.ref)} refunded. ${chip('asm')} Payment type is recorded for ${S.int(PY.recorded)} of ${S.int(PA.n)} deals; the other ${S.int(PY.assumed_split)} are taken as Split Pay, so half of their deal value (${amt(PY.paid_assumed_type)}) is the assumed upfront payment.`],
        ['Effect on expected cash', `Reduces it by ${amt(-pv.refund.ref)}.`]]],
    ];
    return `<p>One setting: the share expected to close. Everyone else is refunded in full. Each outcome changes different lines, so you can see exactly what a different assumption does.</p><div class="acc-list">${rows.map(([k, l, sh, v, bs, r]) => acc(k, l, `${sh} of the deals`, v, bs, r)).join('')}</div>
      <p class="ex-h">Where the default comes from</p><p>${S.int(FT.jira_fell_through)} of the ${S.int(FT.jira_paused)} Paused clients (${pct(FT.jira_fell_through / FT.jira_paused)}) had a contract that ended (${S.int(FT.ended)}) or a documented fall-through (${S.int(FT.documented)}), as in the Client Journey’s fall-through chapter; ${S.int(FT.deals)} of them are among the forecast’s ${S.int(FT.paused_deals)} Paused deals. The default assumes ${DF.pts.fell_through} points of the Paused group close from those cases and ${DF.pts.other} points from the rest, so ${pct(DF.paused_close)} of Paused deals close. With the ${S.int(PA.additional_n)} Additional Service deals expected to close: (${pct(DF.paused_close)} × ${S.int(PA.paused_n)} + ${S.int(PA.additional_n)}) ÷ ${S.int(PA.n)} = ${(100 * DF.combined).toFixed(1)}%, shown as ${DF.pct}%. It is an assumption, not a measured rate.</p>
      <p class="ex-h">Net effect at the current setting</p><p>${amt(pv.close.net)} (close) − ${amt(-pv.refund.net)} (refund) = <b title="${money(pv.close.net + pv.refund.net)}">${short(pv.close.net + pv.refund.net)}</b>. In other words: collections ${amt(pv.close.svc)} + affiliate revenue ${amt(pv.close.aff)} − refunds ${amt(-pv.refund.ref)}.</p>`;
  };
  XR.aff = () => {
    const P = affParts(st), tot = AFF.reduce((a, k) => a + P[k].total, 0);
    const rows = AFF.map(k => {
      const p = P[k], rec = affRecv(k, lastMonthEnd(2)), by = MM.filter(r => r[k] > 0.5).map(r => `${mLab(r.k)} ${amt(r[k])}`).join(' · ');
      return acc('a-' + k, p.label, `${S.d1(p.doneN)} completed + ${S.d1(p.paying)} expected paying closings`, val(p.total, 1), ['rec', 'sce'], [
        ['Recorded partner choices', `${chip('rec')} ${S.d1(p.known)} expected closings whose recorded Jira choice is this partner × ${money(p.rev)} = ${amt(p.chosen)}.`],
        ['Modeled conversions', `${chip('sce')} ${pct(p.conv)} of ${S.d1(p.unk)} expected closings with no recorded choice × ${money(p.rev)} = ${amt(p.assumed)}. Clients who recorded another partner, a cash purchase or a turnkey home earn nothing.`],
        ['Completed purchases', `${chip('rec')} ${S.d1(p.doneN)} fees on closings since ${S.date(CP.from)} not yet received × ${money(p.rev)} = ${amt(p.done)}.`],
        ['Expected revenue', `${amt(p.done)} + ${amt(p.chosen)} + ${amt(p.assumed)} = ${amt(p.total)}.`],
        ['Expected payout dates', `${TIMING[k]}, on the 15th (modeled dates, not confirmed payment dates). By ${dShort(lastMonthEnd(2))}, ${amt(rec)} of it has arrived. Modeled receipts: ${by || 'none'}.`],
        ['What changes it', `The conversion and revenue-per-conversion sliders for ${p.label} (Affiliate card). They change only this partner’s revenue, never when it arrives.`]]);
    });
    const chosen = AFF.reduce((a, k) => a + P[k].chosen, 0), assumed = AFF.reduce((a, k) => a + P[k].assumed, 0);
    const done = AFF.reduce((a, k) => a + P[k].done, 0), DPm = CP.months.map(r => `${mFull(r.month)}: ${S.int(r.n)} closings`).join('; ');
    const doneRows = AFF.map(k => { const p = P[k]; return `${p.label} ${amt(p.done)} (${S.d1(p.doneN)} fees${p.donePaid ? `; ${S.int(p.donePaid)} already received and not counted` : ''}; ${p.doneM.filter(m => m.total > 0.5).map(m => `${mFull(m.k).split(' ')[0]} closings paid ${dShort(m.day)}`).join(', ')})`; }).join(' · ');
    return `<p class="ex-h">Completed purchases: ${amt(done)}</p><p>${S.int(CP.n)} purchases completed between ${S.date(CP.from)} and ${S.date(CP.to)} (${DPm}). A fee counts unless the trackers show it was paid: a realtor fee with a Date Received in the brokerage records is treated as paid; no lender invoice is ever marked paid and the STR Cribs tracker has no payment field, so those fees count. Eligibility and fees follow the same rules as forecast closings. ${doneRows}. Each closing appears once, and none of them is also a forecast closing.</p>
      <p class="ex-h">Forecast closings: ${amt(tot - done)}</p><p>${amt(chosen)} comes from clients whose partner choice is already recorded; ${amt(assumed)} is modeled from your conversion settings. Fees are paid on modeled dates: the realtor the month after each quarter ends (Q4 2026 closings in January 2027), the lender and STR Cribs the month after closing (STR Cribs provisional).</p><div class="acc-list">${rows.join('')}</div>`;
  };
  XR.ref = () => {
    const pv = pausedView(st);
    const rows = [
      ['r-pa', 'Paused, refunded', `${pct(pv.f)} of ${S.int(PA.n)} deals`, val(M.tot.refPA), ['sce', 'asm'], [['How it is calculated', `${pct(pv.f)} (the deals not expected to close) × ${amt(PA.paid)} paid upfront × 100% = ${amt(-M.tot.refPA)}. Set by the % expected to close in the Paused card. The upfront amount is assumed from the payment type (half the deal value for Split Pay, all of it for Paid In Full).`]]],
      ['r-np', 'Still searching, expected to refund', st.h ? `${pct(NP.p_refund)} of ${S.int(NP.n)} clients` : 'switched off', val(M.tot.refNP), ['inf', 'sce'], [['How it is calculated', st.h ? `${pct(NP.p_refund)} of clients still searching are expected to refund, like past clients at the same stage and time searching: ${amt(NP.refund_base)} paid upfront by those expected to refund × 100% = ${amt(-M.tot.refNP)}. Their closing chances already reflect those who refunded, so affiliate revenue is not reduced a second time.` : `The “Include projected refunds from clients still searching” switch is off, so no refund is projected for them (${amt(-REFUND_SHARE * NP.refund_base)} when on). Their collections, closing chances and affiliate revenue do not change.`]]],
      ['r-uc', 'Under contract, not closing', `${pct(H0.uc_fail_refund)} of those who don’t close`, val(M.tot.refUC), ['inf'], [['How it is calculated', `Clients under contract or scheduled who do not close (the share not expected to close) are refunded at the historical rate of ${pct(H0.uc_fail_refund)}: ${amt(-M.tot.refUC)}.`]]],
    ];
    return `<p>Future refunds are the cash STRSearch still expects to return: ${amt(-M.tot.refund)} in this scenario. Every refund returns 100% of the upfront payment, and a refunded client never pays the second installment. The ${S.int(G.refunded.n)} clients already marked Refunded were paid back in the past: their ${amt(G.refunded.outstanding)} second installments are removed in the waterfall (“Cancelled by past refunds”) and no cash goes out for them in the forecast.</p><div class="acc-list">${rows.map(([k, l, s, v, bs, r]) => acc(k, l, s, v, bs, r)).join('')}</div>`;
  };
  XR.unres = () => {
    const ev = k => { const g = G[k]; return `${S.int(g.won_before_year)} of the ${S.int(g.n)} were won before ${asof.getFullYear()}`; };
    const cat = [
      ['u-closing', 'Post-close, no closing date', G.unverified_closing, [
        ['What it is', 'Jira shows a post-close status (the client bought a property), but no closing date appears in Jira, the affiliate records or the brokerage and lender records.'],
        ['Why it is set aside', `Without a closing date the model cannot tell whether the second installment was collected. ${ev('unverified_closing')}, so most are long-past business. Nothing is expected from them in the forecast and no refund is projected.`]]],
      ['u-repeat', 'Repeat purchase without its own Jira issue', G.unverified_repeat, [
        ['What it is', 'The client’s only Jira issue tracks their other won deal, so this later purchase has no progress record (not under contract, not closed).'],
        ['Why it is set aside', `There is no way to place the deal at a stage, so it is neither collected nor refunded. ${ev('unverified_repeat')}, so most are recent purchases that may still turn into future cash once an issue is linked.`]]],
      ['u-none', 'Won deal without matching records', G.unverified_none, [
        ['What it is', 'A Won Pipedrive deal with no Jira issue, e-mail match, onboarding form or purchase record.'],
        ['Why it is set aside', `No evidence the client started, was refunded or bought. ${ev('unverified_none')} (${S.int(R.unverified_none_2024)} in 2024, ${S.int(R.unverified_none_2026)} in 2026).`]]],
      ['u-second', 'Second deals under review', G.second_deal_review, [
        ['What it is', 'Deals with the same client, win date and value as another deal, won within seconds of it or named by the same Jira key, with no engagement record of their own.'],
        ['Why it is set aside', `Either a second search bought together (not yet started) or a record entered twice. No duplicate has been confirmed, so they are neither counted nor deleted until reviewed. ${ev('second_deal_review')}.`]]],
    ];
    return `<p class="ex-h">Why each group is set aside</p><div class="acc-list">${cat.map(([k, l, g, rows]) => acc(k, l, `${S.int(g.n)} won deals`, val(-g.outstanding), ['rec'], rows.concat([
      ['Effect on expected cash', `The ${amt(g.outstanding)} balance is excluded from service collections, affiliate revenue and refunds. No control changes this.`],
      ['What happens next', 'Each deal is identified in an internal reconciliation list (not published). When a record shows the client is active, the deal joins its stage and is forecast like the others.']]))).join('')}</div>`;
  };
  XR['c-days'] = () => {
    const pa = GN.pa.net;
    return `<p><b>Changes:</b> when cash arrives for paused clients who close or are refunded: their collections, affiliate fees and refunds.</p><p><b>Does not change:</b> any total (net stays ${amt(M.tot.net)}), clients still searching (timed from past clients’ journeys), contracts in progress or the partner payout rules.</p><p><b>Right now:</b> ${amt(M.within(lastMonthEnd(2)))} of net cash arrives by ${dShort(lastMonthEnd(2))} and ${amt(M.within(lastMonthEnd(3)))} by ${dShort(lastMonthEnd(3))}. The paused group is worth ${amt(pa)} in net cash.</p>`;
  };
  XR['c-paused'] = () => {
    const pv = pausedView(st);
    return `<p><b>Close</b> (${pct(pv.r)}) sets paused collections (${amt(pv.close.svc)}) and paused affiliate revenue (${amt(pv.close.aff)}).</p><p><b>Full refund</b> (the other ${pct(pv.f)}) sets the refunds paid out (${amt(-pv.refund.ref)}).</p><p>The paused group’s net effect now: ${amt(pv.close.net + pv.refund.net)}; at 0% it is ${amt(pv.range.refund)}, at 100% ${amt(pv.range.close)}. Nothing else changes: contracts in progress, clients still searching and completed purchases are unaffected.</p>`;
  };
  XR['c-refunds'] = () => `<p><b>The 100% rule</b> is fixed: every approved refund returns the full upfront payment.</p><p><b>The switch</b> adds or removes the refund projected for clients still searching (${amt(REFUND_SHARE * NP.refund_base)} paid out); it is currently ${st.h ? 'on' : 'off'}. Their collections, closing chances and affiliate revenue do not change, because the closing chances already reflect clients who refunded.</p>`;
  XR['c-aff'] = () => {
    const P = affParts(st);
    return `<p><b>Conversion</b> changes affiliate revenue from clients with no recorded partner choice (${AFF.map(k => `${P[k].label} ${amt(P[k].assumed)}`).join(', ')}).</p><p><b>Revenue per conversion</b> multiplies every expected paying closing for that partner (${AFF.map(k => `${P[k].label} ${S.d1(P[k].paying)} × ${money(P[k].rev)}`).join(', ')}).</p><p>Neither changes any other number. The payout dates follow fixed rules, so they change when the money arrives, not how much.</p>`;
  };

  /* ------------------------------------------------------------------ render */
  function render() {
    M = model(st); MM = monthly(M); MV = monthView(MM); GN = groupNet(st, M);
    const P = affParts(st), pv = pausedView(st);
    $('o-day').textContent = st.d + ' days';
    $('o-date').textContent = 'centred on ' + dLong(st.d);
    $('o-dmax').textContent = st.max + ' days (latest)';
    $('o-max').textContent = st.max + ' days';
    $('o-pc').textContent = st.pc + '%';
    $('tri-bar').innerHTML = `<i style="flex:${st.pc};background:var(--closed)"></i><i style="flex:${100 - st.pc};background:var(--neg)"></i>`;
    $('o-pc-hint').textContent = `${S.int(PA.n)} deals. Close (${st.pc}%): collect ${short(pv.close.svc)} and earn ${short(pv.close.aff)} in affiliate fees. Full refund (${100 - st.pc}%): pay back ${short(-pv.refund.ref)}.`;
    $('lr-note').textContent = `Affiliate fees on the ${S.int(CP.n)} closings since ${S.date(CP.from)} (these included) are in the forecast where the trackers do not show them as paid: ${short(M.tot.affDone)}.`;
    $('t-hunt-s').textContent = st.h ? `Simulation setting: past clients at the same stage refunded ${pct(NP.p_refund)} of the time, about ${short(REFUND_SHARE * NP.refund_base)}. Historical data is not changed.` : 'Switched off: no refunds are projected for clients still searching. Their collections, closing chances and affiliate revenue are unchanged.';
    AFF.forEach(k => {
      $('o-' + k + '-c').textContent = pct(st.aff[k].conv); $('o-' + k + '-r').textContent = money(st.aff[k].rev);
      $('o-' + k + '-val').textContent = short(P[k].total);
      const histFee = k === 'realtor' ? `median referral fee ${money(AF.realtor.median_fee)}` : k === 'lender' ? `median amount due ${money(AF.lender.median_due)}` : `typical fee ${money(AF.cribs.typical_fee)}`;
      $('h-' + k).innerHTML = `Expected closings: <b>${Math.round(P[k].known)}</b> with this partner recorded, <b>${Math.round(P[k].unk)}</b> unrecorded · history: ${pct(RY[k])} of ${AF.year_label} closings, ${histFee}`;
    });
    document.querySelectorAll('.presets [data-preset]').forEach(b => b.setAttribute('aria-pressed', String(presetDay(b.dataset.preset) === st.d)));
    const chosen = AFF.reduce((a, k) => a + P[k].chosen, 0), affTot = AFF.reduce((a, k) => a + P[k].total, 0);
    $('kpis').innerHTML = [
      { cls: 'hero', l: 'Estimated future net cash', v: short(M.tot.net), s: 'Under the assumptions selected on the left, from deals already won', s2: `${short(M.tot.service + M.tot.aff)} in · ${short(-M.tot.refund)} out · ${short(M.within(lastMonthEnd(2)))} by ${dLong(lastMonthEnd(2))}`, bs: ['rec', 'inf', 'sce'] },
      { l: 'Expected service collections', c: 'var(--uc)', v: short(M.tot.service), s: `Second installments: ${pct(M.tot.service / active)} of the ${short(active)} still owed by clients in progress`, bs: ['inf', 'sce'] },
      { l: 'Expected affiliate revenue', c: 'var(--closed)', v: short(M.tot.aff), s: `${short(M.tot.affDone)} on completed purchases not yet paid + ${short(M.tot.affFc)} on forecast closings · paid on modeled dates`, bs: ['rec', 'sce'] },
      { l: 'Projected refund outflows', c: 'var(--neg)', v: short(M.tot.refund), s: `Future refunds only · 100% of the upfront payment returned${st.h ? '' : ' · none projected for clients still searching'}`, bs: ['inf', 'sce'] },
    ].map(k => `<div class="kpi ${k.cls || ''}"><div class="l">${k.c ? `<i style="background:${k.c}"></i>` : ''}${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s}</div>${k.s2 ? `<div class="s2">${k.s2}</div>` : ''}${chips(k.bs)}</div>`).join('');

    // panel subtitles and legends
    $('s-bridge').innerHTML = `<b>${short(contractual)}</b> owed on contracts → <b>${short(active)}</b> owed by clients still in progress → <b>${short(M.tot.service)}</b> expected service collections → <b>${short(M.tot.net)}</b> estimated net after affiliate revenue and refunds`;
    $('lg-bridge').innerHTML = `<span><i style="background:var(--total)"></i>Total</span><span><i style="background:var(--closed)"></i>Adds cash</span><span><i style="background:var(--neg)"></i>Reduces cash</span><span><i class="band"></i>Shaded: grouped steps</span>`;
    const half = M.cum.findIndex(v => v >= M.tot.net / 2), peak = MM.reduce((a, r) => (r.net > a.net ? r : a), MM[0] || { net: 0, k: mKey(1) });
    $('s-cash').textContent = `Modeled timing: half of the net arrives by ${dLong(Math.max(half, 1))} · largest month: ${mFull(peak.k)} (${short(peak.net)} net) · affiliate fees on modeled payout dates`;
    $('n-cash').innerHTML = TIMING_NOTE();
    cashLegend();
    const refShare = M.tot.refund ? M.tot.refPA / M.tot.refund : 0, noRefunds = Math.abs(M.tot.refund) < 0.5;
    $('s-ref').textContent = noRefunds ? 'No future refunds in this scenario' : `${short(M.tot.refund)} in total · 100% of the upfront payment returned · ${pct(refShare)} from paused and Additional Service clients`;
    $('lg-ref').innerHTML = RSRC(tok()).map(s => `<span><i style="background:${s.css}"></i>${s.name}<b>${cellM(M.tot[s.k])}</b><em>${s.k === 'refNP' && !st.h ? 'switched off' : M.tot.refund ? pct(M.tot[s.k] / M.tot.refund) : ''}</em></span>`).join('');
    $('p-ref').classList.toggle('is-empty', noRefunds);
    $('e-ref').textContent = noRefunds ? 'No upfront money is returned in this scenario, so there are no future refunds to show.' : '';
    $('s-aff').textContent = `${short(M.tot.aff)} expected (${short(AFF.reduce((a, k) => a + affRecv(k, lastMonthEnd(2)), 0))} received by ${dShort(lastMonthEnd(2))} on modeled payout dates) · ${short(M.tot.affDone)} from purchases already completed, ${short(chosen)} from forecast closings with a recorded partner choice, the rest modeled from conversion settings`;
    $('lg-aff').innerHTML = `<span><i style="background:var(--acq)"></i>Completed purchases, fee not yet received</span><span><i style="background:var(--closed)"></i>Forecast: recorded partner choices</span><span><i class="out" style="background:var(--closed-2);border-color:var(--closed)"></i>Forecast: modeled conversions (no choice recorded)</span>`;
    const sc = scenarios(), nets = sc.map(x => x.m.tot.net);
    $('s-scen').textContent = `Only timing changes, so every line reaches the same ${short(nets[1])}; what differs is the running total by each date.`;
    $('lg-scen').innerHTML = `<span><i class="ln" style="background:var(--sp-mid)"></i>Earlier collections (${OPT} days)</span><span><i class="ln" style="background:var(--acq)"></i>Your timing (${st.d} days)</span><span style="color:var(--hold)"><i class="dash"></i><span style="color:var(--ink-2)">Later collections (${st.max} days)</span></span>`;
    $('f-scen').textContent = `Running total by date, not monthly cash. These lines move only the expected days until collection for paused clients (earlier: ${OPT} days; later: the slider maximum, ${st.max} days); collection amounts, chances and refunds are identical, so every line ends at the same total. Clients still searching, contracts in progress and completed purchases keep their timing in all three lines; everything else follows your current settings.`;

    Object.keys(VIEWS).forEach(id => { if (isTable(id)) VIEWS[id].table(); else VIEWS[id].chart().draw(); });
    renderPaused();
    groupsTable();
    glance(P, pv);
    Object.keys(XR).forEach(renderX);
  }
  function lastMonthEnd(k) { const e = new Date(asof.getFullYear(), asof.getMonth() + k, 0, 12); return Math.round((e - asof) / DAY); }

  /* ------------------------------------------------------------------ assumptions at a glance (live) */
  function glance(P, pv) {
    const card = (v, l, s) => `<div class="ag-i"><b>${v}</b><span>${l}</span><small>${s}</small></div>`;
    $('ag-you').innerHTML = [
      card(`${st.d} days`, 'Expected days until collection', `For paused clients who close or are refunded; payments spread around ${dLong(st.d)} like past closings. Clients still searching follow historical timing.`),
      card(`${st.pc}%`, 'Paused + Additional Service expected to close', `The other ${100 - st.pc}% receive a full refund of the upfront payment. Default ${DEF.paused_close}%.`),
      card(st.h ? 'On' : 'Off', 'Refunds from clients still searching', st.h ? `Simulation using the historical ${pct(NP.p_refund)} refund rate.` : 'Simulation switched off: none projected.'),
      `<div class="ag-i"><span>Affiliate assumptions</span><ul class="ag-l">${AFF.map(k => `<li><i>${P[k].label}</i><b>${pct(P[k].conv)} · ${money(P[k].rev)}</b></li>`).join('')}</ul><small>Conversion where no partner choice is recorded · revenue per conversion</small></div>`,
    ].join('');
    $('ag-data').innerHTML = [
      card(pct(G.under_contract.p_close), 'Under-contract clients expected to close', 'From past clients who had been under contract as long.'),
      card(`${pct(NP.p_close)} · ${st.h ? pct(NP.p_refund) : 'off'}`, 'Still searching: close · refund', `Like past clients at the same stage; the other ${pct(NP.p_pause)} pause or keep searching.`),
      card(`${U.median} days`, 'Typical Under Contract to closing', `Middle half ${U.p25}–${U.p75} days, across ${S.int(U.n)} closings.`),
      card(`${S.int(TM.bands[0].close_med)} days`, 'Typical time to closing, new client', `Median further days for a client searching up to ${TM.bands[0].to} days, from ${S.int(TM.bands[0].closers_min)}+ comparable past closings. Longer searches take longer.`),
      card(short(M.tot.affDone), 'Fees on completed purchases', `${S.int(CP.n)} closings since ${S.date(CP.from)}; counted unless the trackers show the fee as paid.`),
      card('50 / 50', 'Split Pay', `Half at the win, half at closing; Paid In Full is collected at the win. A blank payment type is taken as Split Pay (assumed for ${S.int(C.view.engagements - C.view.payment_recorded)} of ${S.int(C.view.engagements)} won deals).`),
      card('100%', 'Refund amount', 'Every approved refund returns the full upfront payment (fixed rule).'),
      card(S.int(G.refunded.n), 'Clients already refunded', 'Paid back in the past: not future outflows, and their unpaid balance is not collected.'),
      card('Modeled', 'Affiliate payout dates', 'Realtor: month after the quarter ends. Lender and STR Cribs: month after closing. All on the 15th; totals never change.'),
      card(short(unverified + dupB), 'Set aside, not forecast', 'Unresolved records and second deals under review stay out of the forecast until resolved.'),
    ].join('');
  }

  /* ------------------------------------------------------------------ full methodology */
  const MS = H0.mature_starts, EX = H0.exits, cnp = d => H0.curves.noprop.find(x => x.day === d).closed, cuc = d => H0.curves.uc.find(x => x.day === d).p_close;
  const li = html => `<li>${html}</li>`;
  $('notes-body').innerHTML = `
    <div class="nb"><h3>Refund rules</h3><ul>
      ${li(`Clients already marked Refunded in Jira (${S.int(G.refunded.n)}) were paid back in the past. They are not future cash outflows, and their unpaid second installments will not be collected.`)}
      ${li('Every approved refund returns 100% of the amount paid upfront (the first Split Pay installment, or the full price for Paid In Full). This is a fixed business rule, not a control.')}
      ${li(`Paused and Additional Service deals (${S.int(PA.n)}) have one setting, the % expected to close. That share closes: Split Pay deals pay the second installment and every closing earns affiliate fees (the ${S.int(PA.payment.pif)} Paid In Full deals owe nothing more but still earn the fees). The rest receive a full refund of the upfront payment and never pay the second installment. The default, ${DEF.paused_close}%, assumes ${PA.default.pts.fell_through} points of the Paused group close from the ${S.int(PA.fell_through.jira_fell_through)} of ${S.int(PA.fell_through.jira_paused)} Paused clients with an ended contract or documented fall-through and ${PA.default.pts.other} points from the rest (${pct(PA.default.paused_close)} of Paused), with all ${S.int(PA.additional_n)} Additional Service deals closing. It is an assumption, not a measured rate.`)}
      ${li(`With the “clients still searching” switch on (default), they are refunded at the historical rate for their stage (${pct(NP.p_refund)} on average); the switch is a simulation setting and changes no historical data. Under-contract clients who don’t close are refunded at the historical rate (${pct(H0.uc_fail_refund)} of past clients who didn’t close).`)}
      ${li('A client who is refunded never pays their remaining installment.')}
      ${li('Each client counts once in expectation: as a past refund, a projected refund or an expected collection. Projected refunds are timed separately from collections: clients still searching by past refund timing, paused clients by the expected-days setting.')}
    </ul></div>
    <div class="nb"><h3>How the forecast is reconciled</h3><ul>
      ${li(`All ${S.int(C.view.engagements)} won deals sit in exactly one row of the table above, and the rows add up to the money still owed under contracts in the reporting layer’s cash forecast view (${money(C.view.gross_outstanding)}) plus ${money(C.view.scheduled_counted_collected)} for closings scheduled after the data date.`)}
      ${li(`47 won deals had no Jira match. Each was checked against the Jira key typed in Pipedrive (and, for second deals, Jira’s own deal-id field in the 12 Nov extract), client e-mails in the 12 Nov Jira and Pipedrive extracts, both onboarding-form sheets, and the brokerage and lender closing records: ${R.own_jira} match their own Jira issue (now grouped by its status), ${R.purchase_record} have a closing record, ${R.separate_purchase} is a separate purchase with its own Jira issue (now grouped by that status), ${R.second_deal_review} are second deals for a client who already has one (same value, won within seconds or named by the same Jira key, recorded as a second deal) with no engagement of their own, so they stay out of the forecast under review, ${R.repeat} are repeat purchases whose client’s only Jira issue tracks the other deal, and ${R.none} have no record anywhere (${R.onboarded} of the 47 completed an onboarding form).`)}
      ${li(`${R.post_close_no_date} post-close won deals had no closing date. Checking affiliate, brokerage and lender records by property address found ${R.post_close_evidenced} closings; the rest stay unresolved.`)}
      ${li(`${S.int(G.closed.evidenced)} deals counted as closed have no closing date in Jira: their closing was found in brokerage, lender or affiliate records, and their second installment (${money(G.closed.outstanding)}) is assumed collected at closing under the Split Pay rule, like every other closing.`)}
      ${li(`The forecast’s ${S.int(PA.n)} paused deals start from won_clients_master filtered to issue_status = Paused (${S.int(PA.master.n)} deals, ${money(PA.master.booked)} booked): ${S.int(PA.master.moved_out.n)} with a recorded closing is counted as a completed purchase (−${money(PA.master.moved_out.booked)}), the ${S.int(PA.master.additional.n)} Additional Service deals are added (+${money(PA.master.additional.booked)}), and ${S.int(PA.master.recovered.n)} deals with no Jira link in the reporting layer are recovered by reconciliation because their own Jira issue is Paused (+${money(PA.master.recovered.booked)}), for ${money(PA.booked)} booked.`)}
      ${li(`Completed purchases since ${S.date(CP.from)} (${S.int(CP.n)} closings, one per Jira issue) add the affiliate fees still due under the payout dates: realtor fees for these Q4 closings in January, lender and STR Cribs fees the month after closing (October’s, due 15 Nov with no payment recorded, in November). A fee is left out only when the trackers show it was paid: ${S.int(CP.months.reduce((a, r) => a + r.aff.realtor.paid, 0))} realtor fees have a Date Received in the brokerage records; no lender invoice is marked paid and the STR Cribs tracker has no payment field. Earlier closings’ fees fell due before the data date and are assumed paid. None of these closings is also a forecast closing.`)}
    </ul></div>
    <div class="nb"><h3>What history shows</h3><ul>
      ${li(`Under Contract to closing takes ${U.median} days at the median (middle half ${U.p25}–${U.p75}) across ${S.int(U.n)} closings; Passed Inspection to closing takes ${H0.pi_to_close.median} days. ${pct(H0.uc_close_rate)} of ${S.int(H0.uc_n)} past under-contract clients closed, and the chance falls the longer a contract runs without closing (${pct(cuc(30))} for a contract open 30 days, ${pct(cuc(60))} at 60 days). A contract that failed leaves this comparison group on the date it ended: the refund, the pause or the next recorded status (${S.int(EX.uc_failures_dated)} of ${S.int(EX.uc_failures)} failures dated).`)}
      ${li(`Of ${S.int(MS.n)} confirmed starts with at least a year of history and a known outcome, ${pct(MS.shares.closed)} closed, ${pct(MS.shares.refunded)} refunded, ${pct(MS.shares.paused)} paused and ${pct(MS.shares.hunting)} are still searching. Each client still searching uses the outcomes of past clients who were still searching after the same number of days. A past client leaves that group at their first Under Contract, inspection or closing date (${S.int(EX.closed_no_uc_date)} past closers have no Under Contract date and leave at their inspection or closing date), their refund date or the date they paused. Refunds mostly come early, so the longer a client goes without a contract, the more the shares shift toward pausing and still searching: the closing chance is ${pct(cnp(0))} at the start, ${pct(cnp(90))} after 90 days and ${pct(cnp(180))} after 180 days. Beyond day ${S.int(EX.last_day_np)} fewer than 10 past clients remain, so the shares at that day are used.`)}
      ${li(`Past refunds: ${S.int(H0.processed_refunds.n)} won deals are marked Refunded in Jira, typically ${H0.refund_lag.median} days after the client start (90% within ${Math.round(H0.refund_lag.p90)} days).`)}
      ${li(`Affiliate history: ${S.int(AF.realized.payments)} recorded affiliate revenue entries since Dec 2024 total ${money(AF.realized.total)} (broker ${money(AF.realized.by_source.Broker.total)}, lender ${money(AF.realized.by_source.Lender.total)}, construction ${money(AF.realized.by_source.Construction.total)}). Median realtor referral fee ${money(AF.realtor.median_fee)} (${S.int(AF.realtor.received)} of ${S.int(AF.realtor.n)} received); median lender amount due ${money(AF.lender.median_due)}; typical STR Cribs fee ${money(AF.cribs.typical_fee)}. No affiliate fee is recorded as received yet for any client still expected to close.`)}
    </ul></div>
    <div class="nb"><h3>Other assumptions</h3><ul>
      ${li('Payment rules from the cash forecast view: Paid In Full is collected at the win; Split Pay collects half at the win and half at closing. Only second installments are future collections.')}
      ${li(`Expected days until collection (default ${DEF.expected_days}; from ${OPT} up to an adjustable maximum of ${DEF.expected_days_max}) applies to paused clients who close or are refunded. Their collections, affiliate fees and refunds spread around that day like past Under Contract → closing times, rather than landing on one date.`)}
      ${li('Affiliate payout dates are modeled, not confirmed: realtor fees are distributed quarterly, in the month after the closing’s calendar quarter ends (Q4 2026 closings in January 2027); lender fees arrive in the month after closing; STR Cribs is provisionally the month after closing. Cash is placed on the 15th of the payout month. Eligibility, conversions, fees and totals do not change; only when the cash arrives.')}
      ${li(`Affiliates: a recorded preferred realtor, lender or STR Cribs choice earns the fee; a recorded other partner, cash purchase or turnkey home earns nothing. Only clients with no recorded choice use the conversion sliders (defaults ${pct(DEF.affiliates.realtor.conv)} / ${pct(DEF.affiliates.lender.conv)} / ${pct(DEF.affiliates.cribs.conv)}). Revenue per conversion defaults (${money(DEF.affiliates.realtor.rev)} / ${money(DEF.affiliates.lender.rev)} / ${money(DEF.affiliates.cribs.rev)}) are weighted-average planning assumptions; recorded medians are shown for context only.`)}
    </ul></div>
    <div class="nb"><h3>Timing and the long tail</h3><ul>
      ${li(`Typical timing uses medians. Clients still searching: how much longer comparable past clients (still searching after about as many days) took. ${TM.bands.map(b => `${b.to ? `${b.from}–${b.to}` : `over ${b.from - 1}`} days searched (${S.int(b.n)} clients now): closing typically ${S.int(b.close_med)} more days (from ${S.int(b.closers_min)}${b.closers_max !== b.closers_min ? `–${S.int(b.closers_max)}` : ''} past closings), refund ${S.int(b.refund_med)} more days`).join('; ')}. Closings and refunds are timed separately. Under contract: the remaining Under Contract → closing times (median ${U.median} days). Paused deals: the expected-days setting.`)}
      ${li(`Each client’s cash is spread over those comparable past clients’ remaining days rather than placed on the median day. Checked against ${TC.dates.length} past dates (${S.date(TC.dates[0])} to ${S.date(TC.dates[TC.dates.length - 1])}, ${S.int(TC.clients)} client-dates, six months each): the spread came within ${TC.close.mae_spread} points a month of the actual closing pattern; placing each client on the median put ${pct(TC.close.peak_median)} of closings in one month (actual peak ${pct(TC.close.peak_actual)}) and missed by ${TC.close.mae_median} points. Refunds: ${TC.refund.mae_spread} vs ${TC.refund.mae_median} points, on only ${S.int(TC.refund.actual.reduce((a, b) => a + b, 0))} refunds.`)}
      ${li(`The long tail: about ${pct(1 - TM.collect_share.show)} of the still-searching collections (${amt(NP.collect * (1 - TM.collect_share.show))} before refunds) and ${pct(1 - TM.refund_share.show)} of their refunds fall after ${mFull(SHOW_K)}, reaching ${mFull(mKey(TM.last_day))}; realtor fees on those closings arrive a quarter later. It comes from every waiting band, not only the longest searches: some comparable past clients took many months. Only ${S.int(TM.closers_after_year)} of ${S.int(TM.closers)} past closings came more than a year after the start; they are weighted up for past clients not yet observed that long (at most ${TM.close_max} days). The longest searches (over ${TM.bands[TM.bands.length - 1].from - 1} days) rest on ${S.int(TM.bands[TM.bands.length - 1].closers_min)} past closings and ${S.int(TM.refunds_after_last_day)} late refunds (the last day with at least 10 is used). The monthly view therefore shows the months to ${mFull(SHOW_K)} and sums the rest as one block.`)}
      ${li('Paused deals follow the expected-days setting, an assumption not validated against history. Realtor fees are placed in the month after each calendar quarter, so January, April, July and October carry more affiliate cash. Month-by-month amounts are estimates; the totals do not depend on them.')}
    </ul></div>
    <div class="nb"><h3>Data limitations</h3><ul>
      ${li('Timing: closings for clients still searching come from 2024–2025 starts; refunds mostly from 2026 starts, whose long delays cannot be seen yet, so their refunds may be timed slightly early.')}
      ${li('Closing and refund chances for clients still searching come from past clients at the same stage and time searching (2024–2025 starts). The newest clients have refunded faster, so their refund chance may be understated.')}
      ${li(`Payment type: blanks default to Split Pay, and only ${S.int(C.view.payment_recorded)} of ${S.int(C.view.engagements)} won deals have a recorded type (${S.int(PA.payment.recorded)} of the ${S.int(PA.n)} paused deals), so balances may be overstated for clients who paid in full. Upfront amounts follow the type (half the deal value for Split Pay, all of it for Paid In Full): they are assumed, not recorded payments.`)}
      ${li(`${money(unverified)} of unresolved and ${money(dupB)} of second-deal balances under review stay outside the forecast.`)}
      ${li('Under Contract is the latest valid contract; earlier fall-throughs are only partly recorded, so the historical closing rate may be slightly optimistic.')}
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
  window.__CASH = { model, monthly, affParts, bridgeSteps, defaults, short, money, scenarios, recvDay, groupNet, pausedView, monthView, doneParts, alloc, get state() { return st; } };
})();
