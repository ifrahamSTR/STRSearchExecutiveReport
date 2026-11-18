/* Chapter 2: where are our clients today? (updated 18 Nov 2026)
   2.1 every signed-up client in one stage, status first: no current contract or completed purchase = hunting + Inactive
       (Paused + Additional Service + Refunded) -> 2.2 how long the hunting clients have waited -> 2.3 where the others stand
       (pauses, refunds, contracts) -> 2.4 up to vs above $250K today -> 2.5 milestones reached.
   Every count is a Jira issue (one per search) by its status on the data date, so the scenes add up to each other and to the
   Cash Forecast's groups (reconciled in the Executive Summary). */
(function () {
  'use strict';
  const S = window.S;
  const DISPLAY = '"Bricolage Grotesque", Figtree, sans-serif';
  const band = b => (b.hi == null ? `${b.lo}+` : b.lo === 0 ? `0–${b.hi}` : `${b.lo}–${b.hi}`);

  function ring(share, num, den, colorVar, name) {
    const R = 100, C = 2 * Math.PI * R;
    return `<div class="ring"><svg viewBox="0 0 250 250" role="img" aria-label="${name}: ${S.pct(share)}, ${num} of ${den}">
        <circle class="bg" cx="125" cy="125" r="${R}" stroke-width="22"/>
        <circle class="fg" cx="125" cy="125" r="${R}" stroke-width="22" style="stroke:var(${colorVar})" stroke-dasharray="${(C * share).toFixed(1)} ${C.toFixed(1)}"/>
        <text class="pct" x="125" y="122" text-anchor="middle" dominant-baseline="middle">${S.pct(share)}</text>
        <text class="of" x="125" y="160" text-anchor="middle">${S.int(num)} of ${S.int(den)}</text>
      </svg><span class="name"><i style="background:var(${colorVar})"></i>${name}</span></div>`;
  }

  /* simple vertical bars with the count on top (bands, months) */
  function bars(node, rows, colorKey, opt) {
    opt = opt || {};
    return S.chart(node, t => Object.assign(S.base(t), {
      grid: { left: 8, right: 10, top: 26, bottom: opt.name ? 34 : 8, containLabel: true },
      tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => opt.tip ? opt.tip(rows[p.dataIndex]) : `<b>${rows[p.dataIndex].label}</b>: ${S.int(p.value)}` }),
      xAxis: { type: 'category', data: rows.map(r => r.label), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
        axisLabel: { color: t.label, fontSize: 12, interval: opt.interval == null ? 0 : opt.interval, formatter: opt.xfmt },
        name: opt.name || '', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 12 } },
      yAxis: S.valAxis(t, { show: false }),
      series: [{ type: 'bar', barWidth: opt.barWidth || '62%', data: rows.map(r => ({ value: r.n, itemStyle: { color: r.hl ? t[r.hl] : t[colorKey], borderRadius: [4, 4, 0, 0], opacity: r.dim ? 0.45 : 1 } })),
        label: { show: true, position: 'top', distance: 4, color: t.ink, fontWeight: 700, fontSize: 13, formatter: p => (p.value ? S.int(p.value) : '') } }],
    }));
  }

  /* 2.1 who is where: every signed-up client in one stage (status first), with the two answers as brackets */
  function stages(main, D, ch, of) {
    const w = D.outcomes.waiting, st = w.stages, N = w.denominator, P = w.purchased, ex = w.excluding_refunded, h = D.outcomes.status.hunting;
    const pc = n => S.pct(n / N);
    const SEG = [
      { k: 'purchased', n: st.purchased, label: 'Completed purchase', c: 'var(--closed)', sub: `CLOSED or post-close · ${S.int(P.no_uc_date)} without a UC date`, status: 'CLOSED, Photography Shared, Listed, Content Pulled; Under Contract or Passed Inspection with a closing date on or before the data date', group: 'Active' },
      { k: 'under_contract', n: st.under_contract, label: 'Under contract', c: 'var(--uc)', sub: `not yet closed · ${S.int(w.under_contract.scheduled)} closings scheduled`, status: 'Under Contract, Passed Inspection (no completed closing)', group: 'Active' },
      { k: 'hunting', n: st.hunting, label: 'Hunting', c: 'var(--wait)', sub: 'actively searching · Client Start to 8 Weeks', status: 'Client Start, 2 / 4 / 6 / 8 Weeks', group: 'Active' },
      { k: 'paused', n: st.paused, label: 'Paused', c: 'var(--paused)', sub: 'Inactive · may resume', status: 'Paused', group: 'Inactive' },
      { k: 'additional', n: st.additional, label: 'Additional Service', c: 'var(--hold-2)', sub: 'Inactive', status: 'Additional Service', group: 'Inactive', lt: true },
      { k: 'refunded', n: st.refunded, label: 'Refunded', c: 'var(--hold)', cls: 'hatch-hold', sub: 'Inactive · left without a property', status: 'Refunded', group: 'Inactive', lt: true },
    ];
    const noC = new Set(['hunting', 'paused', 'additional', 'refunded']), yet = new Set([...noC, 'under_contract']);
    const inact = st.paused + st.additional + st.refunded;
    const body = S.scene(main, { ch, step: 1, of, label: 'Who is where',
      title: `${S.int(w.no_contract.n)} of ${S.int(N)} signed-up clients have no current contract or completed purchase; ${S.int(st.hunting)} of them are actively hunting` });
    body.innerHTML = `<div class="figs qf four">
        <div class="fig"><span class="v num">${S.int(w.no_contract.n)}<span class="of">${pc(w.no_contract.n)}</span></span><span class="l"><i style="background:var(--ink-2)"></i>no current contract or completed purchase: hunting + Inactive ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.int(st.hunting)}</span><span class="l"><i style="background:var(--wait)"></i>actively hunting; half have waited ${S.med(h.median)}+ days (section 2.2)</span></div>
        <div class="fig"><span class="v num">${S.int(inact)}</span><span class="l"><i style="background:var(--paused)"></i>Inactive = Paused ${S.int(st.paused)} + Refunded ${S.int(st.refunded)} + Additional Service ${S.int(st.additional)}</span></div>
        <div class="fig"><span class="v num">${S.int(st.under_contract)}</span><span class="l"><i style="background:var(--uc)"></i>under contract, not yet closed; ${S.int(w.under_contract.scheduled)} closings scheduled</span></div>
      </div>
      <div class="board" id="waitBoard">
        <div class="ptools"><div class="pl"><span class="vt-l">Jira, ${S.date(D.meta.asof)} snapshot · one row per search</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart">
          ${S.ui.stack(SEG, [
            { from: 'under_contract', to: 'refunded', text: `Yet to close · ${S.int(w.yet_to_close.n)}`, sub: pc(w.yet_to_close.n), lvl: 1 },
            { from: 'hunting', to: 'refunded', text: `No current contract or completed purchase · ${S.int(w.no_contract.n)}`, sub: pc(w.no_contract.n), lvl: 0, ar: true },
            { from: 'purchased', to: 'hunting', text: `Active · ${S.int(w.snapshot.active)}`, sub: 'purchased + under contract + hunting', dn: true },
            { from: 'paused', to: 'refunded', text: `Inactive · ${S.int(w.snapshot.inactive)}`, sub: 'Paused + Additional Service + Refunded', dn: true, ar: true },
          ], `${N} signed-up clients: ${SEG.map(s => `${s.label} ${s.n}`).join(', ')}. No current contract or completed purchase ${w.no_contract.n} (hunting ${st.hunting} plus Inactive ${inact}); yet to close ${w.yet_to_close.n}; Inactive ${w.snapshot.inactive} = Paused ${st.paused} + Additional Service ${st.additional} + Refunded ${st.refunded}.`)}
          ${S.ui.keys(SEG.map(s => ({ n: s.n, of: pc(s.n), label: s.label, sub: s.sub, c: s.cls ? 'repeating-linear-gradient(135deg,var(--hold) 0 4px,var(--hold-2) 4px 8px)' : s.c })))}
        </div>
        <div class="pv-table tw" id="waitTable"></div>
      </div>
      ${S.ui.ex('How are these numbers built?', [
        `<p class="ex-h">Denominator</p><p><b>${S.int(N)}</b> signed-up clients: Jira issues with the reporting layer's signed-up flag on ${S.date(D.meta.asof)}. One per search, so a client with two searches counts twice. Prospects (New Clients, Onboarding Completed, Services Declined) are not in it.</p>
         <p class="ex-h">One stage per client, by current status</p><p><b>Completed purchase</b> = CLOSED or a post-close status (${S.int(P.post_close_status)}), or Under Contract / Passed Inspection with a closing date on or before the data date (${S.int(P.uc_status_closing_recorded)}). ${S.int(P.no_uc_date)} purchases have no Under Contract date recorded; they still count. ${S.int(P.status_only)} post-close records have no closing date and count by status.</p>
         <p><b>Under contract</b> = Under Contract or Passed Inspection without a completed closing (${S.int(st.under_contract)}; ${S.int(w.under_contract.scheduled)} have a closing dated after the data date, which the Cash Forecast collects on that date but this report counts as a purchase only once it happens).</p>`,
        `<p class="ex-h">The answers</p><p><b>No current contract or completed purchase</b> = Hunting ${S.int(st.hunting)} + Paused ${S.int(st.paused)} + Additional Service ${S.int(st.additional)} + Refunded ${S.int(st.refunded)} = <b>${S.int(w.no_contract.n)}</b> (${pc(w.no_contract.n)}). Leaving out refunded clients, who left: ${S.int(ex.no_contract)} (${S.pct(ex.no_contract_share)}).</p>
         <p><b>Inactive</b> = Paused + Additional Service + Refunded = <b>${S.int(w.snapshot.inactive)}</b>, the reporting layer's inactive flag. <b>Active</b> = the rest (${S.int(w.snapshot.active)}), including clients who already bought. <b>Yet to close</b> = no current contract or purchase + under contract = ${S.int(w.yet_to_close.n)}.</p>
         <p class="ex-h">Edge cases</p><p>${S.int(w.hunting_with_older_uc_date)} hunting clients still carry an older Under Contract date: that contract no longer stands, so they count as hunting. ${S.int(w.moved_back_with_closing_date.n)} clients have a closing date but their status moved back afterwards (${Object.entries(w.moved_back_with_closing_date.statuses).map(([k, v]) => `${k} ${v}`).join(', ')}); they count by status.</p>`,
      ])}
      <p class="cap">Jira, one row per search, by status on ${S.date(D.meta.asof)} · shares of the ${S.int(N)} signed-up clients · the Cash Forecast counts won deals instead: the Executive Summary reconciles the two.</p>`;
    const board = S.$('#waitBoard', body);
    S.ui.table(S.$('#waitTable', body), [
      { k: 'label', label: 'Stage', html: r => `<span class="sw" style="background:${r.c}"></span>${r.label}<small>${r.status}</small>` },
      { k: 'n', label: 'Clients', num: true, html: r => S.int(r.n) },
      { k: 'share', label: `% of ${S.int(N)}`, num: true, sv: r => r.n, html: r => pc(r.n) },
      { k: 'group', label: 'Active / Inactive' },
      { k: 'noC', label: 'No current contract or purchase', html: r => (noC.has(r.k) ? '✓' : ''), sort: false },
      { k: 'yet', label: 'Yet to close', html: r => (yet.has(r.k) ? '✓' : ''), sort: false },
    ], SEG.map(s => Object.assign({}, s, { c: s.cls ? 'repeating-linear-gradient(135deg,var(--hold) 0 2px,var(--hold-2) 2px 4px)' : s.c })), {
      caption: 'Signed-up clients by stage', sortable: false,
      total: [
        { label: '<b>No current contract or completed purchase</b><small>Hunting + Paused + Additional Service + Refunded</small>', n: w.no_contract.n, group: '', status: '' },
        { label: '<b>Inactive</b><small>Paused + Additional Service + Refunded</small>', n: w.snapshot.inactive, group: '', status: '' },
        { label: '<b>Yet to close</b><small>the first row + under contract</small>', n: w.yet_to_close.n, group: '', status: '' },
        { label: '<b>Signed-up clients</b>', n: N, group: '', status: '' },
      ].map(t => Object.assign(t, { c: 'transparent' })),
    });
    S.ui.wire(board);
  }

  /* 2.2 how long the hunting clients have waited: one dot per client by days since the client start date */
  function waitStrip(node, h) {
    const W = h.bins.width, cap = h.bins.cap, pts = [];
    h.bins.counts.forEach((c, i) => { for (let k = 0; k < c; k++) pts.push([i * W + W / 2, k + 0.5]); });
    for (let k = 0; k < h.bins.overflow; k++) pts.push([cap + (k % 2 ? 7.5 : 2.5), Math.floor(k / 2) + 0.5]);
    const rows = Math.max(...h.bins.counts, Math.ceil(h.bins.overflow / 2), 1);
    return S.chart(node, (t, el) => {
      const top = 46, bottom = 40, innerH = el.clientHeight - top - bottom, innerW = el.clientWidth - 56;
      const size = Math.max(6, Math.min(innerH / (rows + 0.6), (innerW / (cap + W)) * W) * 0.8);
      const ml = (x, text, color, type, pos) => ({ xAxis: x, lineStyle: { color, width: 2, type }, label: { show: true, position: 'end', formatter: text, color, fontWeight: 650, fontSize: 12.5, align: pos || 'center' } });
      return Object.assign(S.base(t), {
        tooltip: { show: false },
        grid: { left: 40, right: 18, top, bottom },
        xAxis: S.dayAxis(t, cap + W, { interval: 30, name: `days since the client start date, to ${S.date(S.data.meta.asof)}`, axisLabel: { color: t.label, fontSize: 12.5, formatter: v => (v === cap ? cap + '+' : v > cap ? '' : v) } }),
        yAxis: { type: 'value', min: 0, max: rows + 0.6, show: false },
        series: [{
          type: 'scatter', data: pts, symbolSize: size, silent: true,
          itemStyle: { color: p => (p.value[0] > 90 ? t.wait : t.wait2), borderColor: t.wait, borderWidth: 1 },
          markArea: { silent: true, itemStyle: { color: t.wait, opacity: 0.07 }, label: { show: true, position: 'insideTopRight', color: t.wait, fontWeight: 700, fontSize: 13, formatter: `over 90 days · ${h.over90}` }, data: [[{ xAxis: 90 }, { xAxis: cap + W }]] },
          markLine: { symbol: 'none', silent: true, data: [
            ml(h.median, `median wait ${S.med(h.median)}`, t.ink, 'solid'),
            { xAxis: h.recorded_median_to_uc, lineStyle: { color: t.uc, width: 2, type: 'dashed' }, label: { show: false } },
          ] },
        }],
      });
    });
  }

  function hunting(main, D, ch, of) {
    const h = D.outcomes.status.hunting, st = { view: 'days' };
    const months = h.by_start_month.map(r => ({ label: r.month === 'earlier' ? 'Earlier' : S.monShort(r.month).replace(/ ’\d\d/, ''), n: r.n, median: r.median, month: r.month }));
    const WHY = { 'No deal link': 'no deal linked', 'Pipedrive deal lost': 'deal lost in Pipedrive', 'Pipedrive deal still open': 'deal still open in Pipedrive', 'Deal not in base': 'deal outside the reporting base' };
    const why = Object.entries(h.no_start_why).map(([k, v]) => `${v} ${WHY[k] || k}`).join(', ');
    const body = S.scene(main, { ch, step: 2, of, label: 'How long hunting clients have waited',
      title: `Half of the hunting clients have waited ${S.med(h.median)} days or more; ${S.int(h.over90)} have waited over 90 days` });
    body.innerHTML = `<div class="figs qf four">
        <div class="fig"><span class="v num">${S.med(h.median)}<small>days</small></span><span class="l"><i style="background:var(--wait)"></i>median wait of the ${S.int(h.with_start)} hunting clients with a start date (average ${S.d1(h.mean)}) ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.int(h.over90)}</span><span class="l"><i style="background:var(--wait)"></i>have waited over 90 days, ${S.int(h.over180)} of them over 180</span></div>
        <div class="fig"><span class="v num">${S.int(h.started_last_90)}</span><span class="l"><i style="background:var(--wait-2)"></i>of the ${S.int(h.with_start)} started in the last 90 days, after sales rose in June: a young pool</span></div>
        <div class="fig"><span class="v num">${S.int(h.no_start)}</span><span class="l"><i style="background:var(--hold-2)"></i>hunting with no start date: no won deal linked to the Jira issue</span></div>
      </div>
      <div class="board" id="huntBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('view', 'View', [['days', 'By days waited'], ['month', 'By start month']], 'days', 'only-chart')}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-wait" id="huntDays" role="img" aria-label="${h.with_start} hunting clients by days since their start: median ${h.median}; ${h.over90} over 90 days; ${h.bands.map(b => `${band(b)} days ${b.n}`).join(', ')}."></div>
          <div class="chart h-wait" id="huntMonths" hidden role="img" aria-label="Hunting clients by start month: ${months.map(m => `${m.label} ${m.n}`).join(', ')}."></div>
          <div class="legend"><span><i class="dot" style="background:var(--wait-2);border:1px solid var(--wait)"></i>one hunting client, up to 90 days</span><span><i class="dot" style="background:var(--wait)"></i>over 90 days</span><span><i class="line" style="background:var(--ink)"></i>median wait</span><span><i class="dash" style="color:var(--uc)"></i>recorded median to Under Contract (${S.med(h.recorded_median_to_uc)} days)</span></div></div>
        <div class="pv-table tw" id="huntTable"></div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Wait</p><p>Wait = ${S.date(D.meta.asof)} − the client start date (the reporting layer's client_start_date: the won date from June 2026, the kickoff before). Hunting = the statuses Client Start, 2 / 4 / 6 / 8 Weeks. Of <b>${S.int(h.n)}</b> hunting clients, <b>${S.int(h.with_start)}</b> have a start date; the median and the 90-day count use those ${S.int(h.with_start)}.</p>
         <p>The other <b>${S.int(h.no_start)}</b> have no start date because their Jira issue is not linked to a won Pipedrive deal (${why}). They are counted as hunting but not aged, rather than given an age of zero. Linking their deals would date them.</p>`,
        `<p class="ex-h">Reading it</p><p>Half of past clients were under contract by day ${S.med(h.recorded_median_to_uc)}; ${S.int(h.past_recorded_median)} of the ${S.int(h.with_start)} hunting clients have already waited longer. Jira statuses run with time: the ${S.int(h.by_status['8 Weeks'].n)} at "8 Weeks" have waited a median ${S.med(h.by_status['8 Weeks'].median)} days. ${S.int(h.older_uc_date)} hunting clients carry an older Under Contract date from a contract that fell through.</p>
         <p>Same figure in the <a href="${D.meta.source}#questions" target="_blank" rel="noopener">Explorer's backlog callout</a> (median ${S.med(h.median)} days, ${S.int(h.over90)} over 90). The ${S.int(D.cash.noprop.n)} "No property yet" in the Cash Forecast count won deals; the Executive Summary reconciles them.</p>`,
      ])}
      <p class="cap">One dot per hunting client with a start date, by days since that date · 10-day columns · 180+ days together.</p>`;
    const nodeD = S.$('#huntDays', body), nodeM = S.$('#huntMonths', body);
    waitStrip(nodeD, h);
    let recM = null;
    S.ui.table(S.$('#huntTable', body), [
      { k: 'label', label: 'Group', html: r => `${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}` },
      { k: 'n', label: 'Hunting clients', num: true, html: r => S.int(r.n) },
      { k: 'median', label: 'Median days waited', num: true, html: r => (r.median == null ? '–' : S.med(r.median)) },
    ], [
      { _group: 'By time waited (clients with a start date)' },
      ...h.bands.map(b => ({ label: `${band(b)} days`, n: b.n, median: null })),
      { _group: 'By Jira status' },
      ...Object.entries(h.by_status).map(([k, v]) => ({ label: k, n: v.n, median: v.median })),
      { _group: 'By start month' },
      ...months.map(m => ({ label: m.month === 'earlier' ? 'Before April 2026' : m.label + ' 2026', n: m.n, median: m.median })),
      { _group: 'No start date' },
      ...Object.entries(h.no_start_why).map(([k, v]) => ({ label: k, sub: 'no won Pipedrive deal linked', n: v, median: null })),
    ], { caption: 'Hunting clients by time waited, status and start month', sortable: false,
      total: [{ label: 'All hunting clients', n: h.n, median: h.median }] });
    S.ui.wire(S.$('#huntBoard', body), (name, v) => {
      st[name] = v;
      nodeD.hidden = v !== 'days'; nodeM.hidden = v !== 'month';
      if (v === 'month' && !recM) recM = bars(nodeM, months, 'wait', { tip: r => `<b>${r.label}</b> start month: ${r.n} hunting · median ${S.med(r.median)} days waited`, name: 'client start month' });
      else if (v === 'month') recM.draw();
    });
  }

  /* 2.3 where the others stand: paused, refunded, under contract */
  function others(main, D, ch, of) {
    const s = D.outcomes.status, p = s.paused, r = s.refunded, u = s.under_contract, w = D.outcomes.waiting.stages, st = { rf: 'days' };
    const cg = D.cash.groups.paused, pd = D.cash.defaults.paused_defaults, br = D.reconcile.cash_bridge;
    const pausedRefund = cg.paid * pd.refund / 100, money = v => '$' + (Math.abs(v) / 1e6).toFixed(2) + 'M';
    const recent = r.by_month.filter(m => m.month >= '2026-01'), peak = r.by_month.reduce((a, m) => (m.n > a.n ? m : a), { n: -1 });
    const fullMon = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const body = S.scene(main, { ch, step: 3, of, label: 'Where the others stand',
      title: `Most paused clients have been paused for months; most refunds come within two weeks of the start` });
    body.innerHTML = `<div class="figs qf four">
        <div class="fig"><span class="v num">${S.int(p.n)}</span><span class="l"><i style="background:var(--paused)"></i>Paused: a median ${Math.round(p.median_days)} days in pause; ${S.int(p.from.long_search)} paused after 8+ weeks of searching</span></div>
        <div class="fig"><span class="v num">${S.int(r.n)}</span><span class="l"><i style="background:var(--refund)"></i>Refunded: a median ${S.med(r.median_days)} days after the start; ${S.int(r.within14)} within 14 days; ${S.int(peak.n)} in ${fullMon(peak.month)} alone</span></div>
        <div class="fig"><span class="v num">${S.int(u.n)}</span><span class="l"><i style="background:var(--uc)"></i>Under contract: a median ${S.med(u.median_days_since)} days since the contract; ${S.int(u.scheduled)} closings scheduled</span></div>
        <div class="fig"><span class="v num">${S.int(w.additional)}</span><span class="l"><i style="background:var(--hold-2)"></i>Additional Service (Inactive)</span></div>
      </div>
      <div class="board" id="othBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('rf', 'Refunds', [['days', 'Refunds by days after start'], ['month', 'Refunds by month']], 'days', 'only-chart')}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="duo">
          <div><p class="duo-h"><span class="duo-v">${S.int(p.n)}</span>Paused, by time in pause <small>days since the pause began</small></p><div class="chart h-duo" id="pauseChart" role="img" aria-label="Paused clients by days in pause: ${p.bands.map(b => `${band(b)} ${b.n}`).join(', ')}."></div></div>
          <div><p class="duo-h"><span class="duo-v">${S.int(r.n)}</span><span id="rfHead">Refunded, by days from start to refund</span> <small id="rfSub">client start date to refund date</small></p>
            <div class="chart h-duo" id="refundDays" role="img" aria-label="Refunded clients by days from start to refund: ${r.bands.map(b => `${band(b)} ${b.n}`).join(', ')}."></div>
            <div class="chart h-duo" id="refundMonths" hidden role="img" aria-label="Refunds by month: ${recent.map(m => `${S.monShort(m.month)} ${m.n}`).join(', ')}."></div></div>
        </div>
        <p class="call"><span class="call-h">Cash link</span>Paused clients have paid <b>${money(cg.paid)}</b> up front. At the Cash Forecast's default (${pd.resume}% resume, ${pd.refund}% refunded, ${pd.remain}% stay paused), <b>${money(pausedRefund)}</b> of the <b>${money(br.refunds)}</b> projected refunds come from them: the paused group is the largest single swing in forecast cash. The Cash Forecast tab models these flows.</p></div>
        <div class="pv-table tw" id="othTable"></div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Paused</p><p>Time in pause = ${S.date(D.meta.asof)} − the date the client entered Paused, from the 12 Nov 2026 Jira extract (latest_status_date, data as of 11 Nov), known for ${S.int(p.dated)} of ${S.int(p.n)}. The status before the pause (previous_status): 8 Weeks ${S.int(p.from.long_search)}, an earlier search status ${S.int(p.from.earlier_search)}, Under Contract / Passed Inspection ${S.int(p.from.contract)}, other ${S.int(p.from.other)}, not recorded ${S.int(p.from.unknown)}. ${S.int(p.older_uc_date)} paused clients carry an Under Contract date from a contract that did not close.</p>`,
        `<p class="ex-h">Refunded</p><p>Days to refund = refund date − client start date (${S.int(r.timed)} of ${S.int(r.n)} with both dates). The refund date is when the refund was recorded, so the decision came a little earlier. ${S.int(r.from_client_start)} refunded clients went straight from Client Start, before their first two-week check-in. The first refund in these records is dated ${fullMon(r.by_month.find(m => m.n).month)}, and 2025 has few, so compare recent months with care.</p>
         <p class="ex-h">Under contract</p><p>Days since contract = ${S.date(D.meta.asof)} − the latest valid Under Contract date; past contracts closed a median ${S.med(D.speed.uc_to_close.median)} days after Under Contract. ${S.int(u.passed_inspection)} have passed inspection.</p>`,
      ])}
      <p class="cap">Jira, status on ${S.date(D.meta.asof)} · the same ${S.int(p.n)} paused, ${S.int(r.n)} refunded and ${S.int(u.n)} under contract as in 2.1 · the first 14 days by start month are in section 3.4.</p>`;
    bars(S.$('#pauseChart', body), p.bands.map(b => ({ label: band(b), n: b.n })), 'paused', { name: 'days in pause', tip: x => `<b>${x.label} days</b> in pause: ${x.n} clients` });
    bars(S.$('#refundDays', body), r.bands.map(b => ({ label: band(b), n: b.n, hl: b.lo === 0 ? 'refund' : null })), 'refund2', { name: 'days from start to refund', tip: x => `<b>${x.label} days</b> after the start: ${x.n} refunds` });
    let recM = null;
    const nodeRD = S.$('#refundDays', body), nodeRM = S.$('#refundMonths', body);
    S.ui.table(S.$('#othTable', body), [
      { k: 'label', label: 'Group', html: x => `${x.label}${x.sub ? `<small>${x.sub}</small>` : ''}` },
      { k: 'n', label: 'Clients', num: true, html: x => S.int(x.n) },
    ], [
      { _group: `Paused (${p.n}) by days in pause` }, ...p.bands.map(b => ({ label: `${band(b)} days`, n: b.n })), ...(p.n - p.dated ? [{ label: 'Pause date not recorded', n: p.n - p.dated }] : []),
      { _group: 'Paused by the status before the pause' }, { label: '8 Weeks (long search)', n: p.from.long_search }, { label: 'Client Start to 6 Weeks', n: p.from.earlier_search }, { label: 'Under Contract / Passed Inspection', n: p.from.contract }, { label: 'Other', n: p.from.other }, { label: 'Not recorded', n: p.from.unknown },
      { _group: `Refunded (${r.n}) by days from start to refund` }, ...r.bands.map(b => ({ label: `${band(b)} days`, n: b.n })), ...(r.n - r.timed ? [{ label: 'Start or refund date missing', n: r.n - r.timed }] : []),
      { _group: 'Refunds by month recorded (2026)' }, ...recent.map(m => ({ label: fullMon(m.month), n: m.n })),
      { _group: 'Under contract' }, { label: 'Under contract, not yet closed', sub: `median ${S.med(u.median_days_since)} days since the contract`, n: u.n }, { label: 'of which closing scheduled after the data date', n: u.scheduled },
    ], { caption: 'Paused, refunded and under-contract clients', sortable: false });
    S.ui.wire(S.$('#othBoard', body), (name, v) => {
      st[name] = v;
      nodeRD.hidden = v !== 'days'; nodeRM.hidden = v !== 'month';
      S.$('#rfHead', body).textContent = v === 'days' ? 'Refunded, by days from start to refund' : 'Refunds by month recorded';
      S.$('#rfSub', body).textContent = v === 'days' ? 'client start date to refund date' : '2026, Jira refund date';
      if (v === 'month' && !recM) recM = bars(nodeRM, recent.map(m => ({ label: S.monShort(m.month).replace(/ ’\d\d/, ''), n: m.n, hl: m.n === peak.n ? 'refund' : null })), 'refund2', { tip: x => `<b>${x.label} 2026</b>: ${x.n} refunds recorded` });
      else if (v === 'month') recM.draw();
    });
  }

  /* 2.4 up to vs above $250K: where each group stands today */
  function budgetToday(main, D, ch, of) {
    const B = D.budgets, G = Object.fromEntries(B.groups.map(g => [g.label, g])), lo = G['Up to $250K'], hi = G['Above $250K'], nr = G['Not recorded'];
    const mh = B.mh.refunded.find(x => x.w === 30), sh = (g, k) => (g.stages[k] || 0) / g.n;
    const KEYS = [['purchased', 'Completed purchase', 'closed'], ['under_contract', 'Under contract', 'uc'], ['hunting', 'Hunting', 'wait'], ['paused', 'Paused', 'paused'], ['refunded', 'Refunded', 'refund'], ['other', 'Other', 'hold2']];
    const val = (g, k) => (k === 'other' ? g.n - KEYS.slice(0, 5).reduce((a, [x]) => a + (g.stages[x] || 0), 0) : g.stages[k] || 0);
    const pts = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)} pts`;
    const body = S.scene(main, { ch, step: 4, of, label: 'Lower and higher budgets today',
      title: `Clients up to $250K have bought as often as those above, but more of them have been refunded: ${S.pct(sh(lo, 'refunded'))} against ${S.pct(sh(hi, 'refunded'))}` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num"><span class="from">${S.pct(sh(lo, 'refunded'))}</span><span class="ar2">vs</span>${S.pct(sh(hi, 'refunded'))}</span><span class="l"><i style="background:var(--refund)"></i>refunded today: ${S.int(lo.stages.refunded)} of ${S.int(lo.n)} up to $250K, ${S.int(hi.stages.refunded)} of ${S.int(hi.n)} above ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(lo.rf30.k / lo.rf30.eligible)}</span><span class="ar2">vs</span>${S.pct(hi.rf30.k / hi.rf30.eligible)}</span><span class="l"><i style="background:var(--refund)"></i>refunded within 30 days of the start (${lo.rf30.k} of ${lo.rf30.eligible}, ${hi.rf30.k} of ${hi.rf30.eligible}); like for like ${pts(mh.diff)} (95% ${pts(mh.lo)} to ${pts(mh.hi)}) ${S.ui.chip('inf')}</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(sh(lo, 'purchased'))}</span><span class="ar2">vs</span>${S.pct(sh(hi, 'purchased'))}</span><span class="l"><i style="background:var(--closed)"></i>completed a purchase (${S.int(lo.stages.purchased)} and ${S.int(hi.stages.purchased)}); paused ${S.pct(sh(lo, 'paused'))} vs ${S.pct(sh(hi, 'paused'))}</span></div>
      </div>
      <div class="board" id="bstBoard">
        <div class="ptools"><div class="pl"><span class="vt-l">Budget = upper end of the onboarding-form range (all-in capital)</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-bst" id="bstChart" role="img" aria-label="Where clients stand today by budget. Up to $250K (${lo.n}): ${KEYS.map(([k, l]) => `${l} ${val(lo, k)}`).join(', ')}. Above $250K (${hi.n}): ${KEYS.map(([k, l]) => `${l} ${val(hi, k)}`).join(', ')}."></div>
          <div class="legend">${KEYS.map(([k, l, c]) => `<span><i style="background:var(--${c === 'hold2' ? 'hold-2' : c})"></i>${l}</span>`).join('')}</div></div>
        <div class="pv-table tw" id="bstTable"></div>
        <div class="links">${S.ui.xl('#budget', 'Explorer: budget performance')}</div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Budget</p><p>The onboarding form's <b>"${B.field}"</b> (column M, live since ${S.date(B.form_since)}), read at the upper end of the chosen range: up to $250K = the range ends at $250K or below. It measures ${B.measures}. Matched to ${S.int(B.coverage.matched)} confirmed starts (e-mail first, the form's deal id as a fallback, the answer before the contract). ${S.int(nr.n)} have no matched answer (${S.int(B.coverage.not_recorded_before_form)} started before the form existed) and are left out of the comparison, which therefore covers clients who started from May 2026.</p>
         <p class="ex-h">Does the stated budget mean anything?</p><p>Yes: among completed purchases, the median price was ${'$' + Math.round(B.profile[0].price.median / 1e3)}K for clients up to $250K against ${'$' + Math.round(B.profile[1].price.median / 1e3)}K above, and the recorded out-of-pocket ${'$' + Math.round(B.profile[0].oop.median / 1e3)}K against ${'$' + Math.round(B.profile[1].oop.median / 1e3)}K.</p>`,
        `<p class="ex-h">Stages</p><p>Status first, as in 2.1, per won engagement with a confirmed start (the Explorer's unit, so these groups equal its #budget view). Other = a won deal whose Jira issue is back in pre-sale onboarding or Additional Service.</p>
         <p class="ex-h">Like for like</p><p>Refunds within 30 days compare clients with 30+ days on the clock. The like-for-like difference is a Mantel–Haenszel risk difference within the same start month, client experience and start-date rule (${mh.strata} strata), so the gap is not a timing artefact. ${S.ui.chip('inf')} = estimated. The interval only just clears zero; treat it as a signal to watch.</p>`,
      ])}
      <p class="cap">Confirmed starts with a matched onboarding budget, mostly June–October 2026 starts · status on ${S.date(D.meta.asof)} · Not recorded (${S.int(nr.n)}, mostly older clients) is in the table only.</p>`;
    S.chart(S.$('#bstChart', body), t => {
      const groups = [lo, hi], col = { closed: t.closed, uc: t.uc, wait: t.wait, paused: t.paused, refund: t.refund, hold2: t.hold2 };
      return Object.assign(S.base(t), {
        grid: { left: 8, right: 16, top: 6, bottom: 6, containLabel: true },
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', formatter: p => { const g = groups[p.dataIndex], [k, l] = KEYS[p.seriesIndex]; return `<b>${g.label}</b> · ${l}<br>${S.int(val(g, k))} of ${S.int(g.n)} (${S.pct(val(g, k) / g.n)})`; } }),
        xAxis: { type: 'value', max: 1, show: false },
        yAxis: { type: 'category', data: groups.map(g => `${g.label}\n${S.int(g.n)} clients`), inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink, fontSize: 14, fontWeight: 650, lineHeight: 19 } },
        series: KEYS.map(([k, l, c], i) => ({ name: l, type: 'bar', stack: 's', barWidth: 44,
          itemStyle: { color: col[c], borderColor: t.surface, borderWidth: 1.5, borderRadius: i === 0 ? [8, 0, 0, 8] : i === KEYS.length - 1 ? [0, 8, 8, 0] : 0 },
          label: { show: true, color: ['hold2', 'wait'].includes(c) ? t.ink : '#fff', fontWeight: 700, fontSize: 13, formatter: p => (p.value >= 0.06 ? S.pct(p.value) : '') },
          data: groups.map(g => val(g, k) / g.n) })),
      });
    });
    S.ui.table(S.$('#bstTable', body), [
      { k: 'label', label: 'Budget (upper end of the form range)', html: g => `${g.label}${g.label === 'Not recorded' ? '<small>no matched form answer; mostly started before the form</small>' : ''}` },
      { k: 'n', label: 'Clients', num: true, html: g => S.int(g.n) },
      ...KEYS.map(([k, l]) => ({ k, label: l, num: true, sv: g => val(g, k) / g.n, html: g => `${S.pct(val(g, k) / g.n)}<small>${S.int(val(g, k))}</small>` })),
      { k: 'rf30', label: 'Refunded within 30 days', num: true, sv: g => g.rf30.k / g.rf30.eligible, html: g => `${S.pct(g.rf30.k / g.rf30.eligible, 1)}<small>${g.rf30.k} of ${g.rf30.eligible}</small>` },
    ], B.groups.map(g => Object.assign({ _cls: g.label === 'Not recorded' ? 'dim' : '' }, g)), { caption: 'Where clients stand today by budget' });
    S.ui.wire(S.$('#bstBoard', body));
  }

  S.chapter('outcomes', {
    n: 2, title: 'Where are our clients today?',
    render(main, D, ch) {
      const OF = 5, at = D.outcomes.attainment;
      stages(main, D, ch, OF);
      hunting(main, D, ch, OF);
      others(main, D, ch, OF);
      budgetToday(main, D, ch, OF);
      const body = S.scene(main, { ch, step: 5, of: OF, label: 'Milestones reached', title: `${S.pct(at.uc_share)} of Active clients have recorded Under Contract, ${S.pct(at.closed_share)} CLOSED` });
      body.innerHTML = `<div class="board"><div class="rings">
          ${ring(at.uc_share, at.uc, at.active, '--uc', 'Under Contract recorded')}
          ${ring(at.closed_share, at.closed, at.active, '--closed', 'CLOSED recorded')}
        </div></div>
        <p class="cap">Historical attainment of today's ${S.int(at.active)} Active clients, not a lifetime conversion rate. Under Contract = latest valid contract; ${S.int(at.closed_scheduled)} closings dated after the data date are not counted.</p>`;
    },
  });
})();
