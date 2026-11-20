/* Chapter 2: where are our clients today? (updated 18 Nov 2026)
   2.1 every signed-up client in one stage, status first: no current contract or completed purchase = hunting + Inactive
       (Paused + Additional Service + Refunded) -> 2.2 how long the hunting clients have waited -> 2.3 where the others stand
       (pauses, refunds, contracts) -> 2.4 pauses by acquisition lead (id outcomes-6, added 20 Nov 2026) -> 2.5 up to vs above $250K today
       (id outcomes-4) -> 2.6 milestones reached (id outcomes-5). Scene ids are stable keys; `order` sets the displayed numbers.
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
      title: `${S.int(w.no_contract.n)} of ${S.int(N)} searches have no current contract or completed purchase: ${S.int(st.hunting)} hunting and ${S.int(inact)} inactive; a separate ${S.int(st.under_contract)} are under contract` });
    body.innerHTML = `<div class="figs qf four">
        <div class="fig emph"><span class="v num">${S.int(w.no_contract.n)}<span class="of">${pc(w.no_contract.n)} of ${S.int(N)}</span></span><span class="l"><i style="background:var(--ink-2)"></i>searches with no current contract or completed purchase = ${S.int(st.hunting)} hunting + ${S.int(inact)} inactive ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.int(st.hunting)}</span><span class="l"><i style="background:var(--wait)"></i>hunting: still searching; half have waited ${S.med(h.median)}+ days (section 2.2)</span></div>
        <div class="fig"><span class="v num">${S.int(inact)}</span><span class="l"><i style="background:var(--paused)"></i>inactive = Paused ${S.int(st.paused)} + Refunded ${S.int(st.refunded)} + Additional Service ${S.int(st.additional)}</span></div>
        <div class="fig status"><span class="v num">${S.int(st.under_contract)}</span><span class="l"><i style="background:var(--uc)"></i>under contract, not yet closed: its own category, outside the ${S.int(w.no_contract.n)}; ${S.int(w.under_contract.scheduled)} closings scheduled</span></div>
      </div>
      <div class="board" id="waitBoard">
        <div class="ptools"><div class="pl"><span class="vt-l">Jira, ${S.date(D.meta.asof)} snapshot · one row per search (a signed-up Jira record)</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart">
          ${S.ui.stack(SEG, [
            { from: 'under_contract', to: 'refunded', text: `Yet to close · ${S.int(w.yet_to_close.n)}`, sub: pc(w.yet_to_close.n), lvl: 1 },
            { from: 'hunting', to: 'refunded', text: `No current contract or completed purchase · ${S.int(w.no_contract.n)}`, sub: pc(w.no_contract.n), lvl: 0, ar: true },
            { from: 'purchased', to: 'hunting', text: `Active · ${S.int(w.snapshot.active)}`, sub: 'purchased + under contract + hunting', dn: true },
            { from: 'paused', to: 'refunded', text: `Inactive · ${S.int(w.snapshot.inactive)}`, sub: 'Paused + Additional Service + Refunded', dn: true, ar: true },
          ], `${N} searches: ${SEG.map(s => `${s.label} ${s.n}`).join(', ')}. No current contract or completed purchase ${w.no_contract.n} (hunting ${st.hunting} plus Inactive ${inact}); yet to close ${w.yet_to_close.n}; Inactive ${w.snapshot.inactive} = Paused ${st.paused} + Additional Service ${st.additional} + Refunded ${st.refunded}.`)}
          ${S.ui.keys(SEG.map(s => ({ n: s.n, of: pc(s.n), label: s.label, sub: s.sub, c: s.cls ? 'repeating-linear-gradient(135deg,var(--hold) 0 4px,var(--hold-2) 4px 8px)' : s.c })))}
        </div>
        <div class="pv-table tw" id="waitTable"></div>
      </div>
      ${S.ui.ex('How are these numbers built?', [
        `<p class="ex-h">Denominator</p><p><b>${S.int(N)}</b> searches: Jira issues with the reporting layer's signed-up flag on ${S.date(D.meta.asof)}. One record per search, so a client with two searches counts twice. Prospects (New Clients, Onboarding Completed, Services Declined) are not in it.</p>
         <p class="ex-h">One stage per search, by current status</p><p><b>Completed purchase</b> = CLOSED or a post-close status (${S.int(P.post_close_status)}), or Under Contract / Passed Inspection with a closing date on or before the data date (${S.int(P.uc_status_closing_recorded)}). ${S.int(P.no_uc_date)} purchases have no Under Contract date recorded; they still count. ${S.int(P.status_only)} post-close records have no closing date and count by status.</p>
         <p><b>Under contract</b> (its own category: it has a contract, so it is not in the ${S.int(w.no_contract.n)}) = Under Contract or Passed Inspection without a completed closing (${S.int(st.under_contract)}; ${S.int(w.under_contract.scheduled)} have a closing dated after the data date, which the Cash Forecast collects on that date but this report counts as a purchase only once it happens).</p>`,
        `<p class="ex-h">The answers</p><p><b>No current contract or completed purchase</b> = Hunting ${S.int(st.hunting)} + Inactive ${S.int(inact)} (Paused ${S.int(st.paused)} + Additional Service ${S.int(st.additional)} + Refunded ${S.int(st.refunded)}) = <b>${S.int(w.no_contract.n)}</b> (${pc(w.no_contract.n)}). Leaving out refunded searches, who left: ${S.int(ex.no_contract)} (${S.pct(ex.no_contract_share)}).</p>
         <p><b>Inactive</b> = Paused + Additional Service + Refunded = <b>${S.int(w.snapshot.inactive)}</b>, the reporting layer's inactive flag. <b>Active</b> = the rest (${S.int(w.snapshot.active)}), including clients who already bought. <b>Yet to close</b> = no current contract or purchase + under contract = ${S.int(w.yet_to_close.n)}.</p>
         <p class="ex-h">Edge cases</p><p>${S.int(w.hunting_with_older_uc_date)} hunting searches still carry an older Under Contract date: that contract no longer stands, so they count as hunting. ${S.int(w.moved_back_with_closing_date.n)} searches have a closing date but their status moved back afterwards (${Object.entries(w.moved_back_with_closing_date.statuses).map(([k, v]) => `${k} ${v}`).join(', ')}); they count by status.</p>`,
      ])}
      <p class="cap">Jira, one row per search, by status on ${S.date(D.meta.asof)} · shares of the ${S.int(N)} searches · the Cash Forecast counts won deals instead: the Executive Summary reconciles the two.</p>`;
    const board = S.$('#waitBoard', body);
    S.ui.table(S.$('#waitTable', body), [
      { k: 'label', label: 'Stage', html: r => `<span class="sw" style="background:${r.c}"></span>${r.label}<small>${r.status}</small>` },
      { k: 'n', label: 'Searches', num: true, html: r => S.int(r.n) },
      { k: 'share', label: `% of ${S.int(N)}`, num: true, sv: r => r.n, html: r => pc(r.n) },
      { k: 'group', label: 'Active / Inactive' },
      { k: 'noC', label: 'No current contract or purchase', html: r => (noC.has(r.k) ? '✓' : ''), sort: false },
      { k: 'yet', label: 'Yet to close', html: r => (yet.has(r.k) ? '✓' : ''), sort: false },
    ], SEG.map(s => Object.assign({}, s, { c: s.cls ? 'repeating-linear-gradient(135deg,var(--hold) 0 2px,var(--hold-2) 2px 4px)' : s.c })), {
      caption: 'Searches by stage', sortable: false,
      total: [
        { label: '<b>No current contract or completed purchase</b><small>Hunting + Paused + Additional Service + Refunded</small>', n: w.no_contract.n, group: '', status: '' },
        { label: '<b>Inactive</b><small>Paused + Additional Service + Refunded</small>', n: w.snapshot.inactive, group: '', status: '' },
        { label: '<b>Yet to close</b><small>the first row + under contract</small>', n: w.yet_to_close.n, group: '', status: '' },
        { label: '<b>Searches (signed-up Jira records)</b>', n: N, group: '', status: '' },
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
      title: `Half of the hunting searches have waited ${S.med(h.median)} days or more; ${S.int(h.over90)} have waited over 90 days` });
    body.innerHTML = `<div class="figs qf four">
        <div class="fig"><span class="v num">${S.med(h.median)}<small>days</small></span><span class="l"><i style="background:var(--wait)"></i>median wait. <b>${S.int(h.with_start)} of ${S.int(h.n)}</b> hunting searches have a start date (average ${S.d1(h.mean)} days) ${S.ui.chip('rec')}</span></div>
        <div class="fig emph"><span class="v num">${S.int(h.over90)}</span><span class="l"><i style="background:var(--wait)"></i><b>over 90 days</b>, ${S.int(h.over180)} of them over 180</span></div>
        <div class="fig"><span class="v num">${S.int(h.started_last_90)}</span><span class="l"><i style="background:var(--wait-2)"></i>of the ${S.int(h.with_start)} started in the last 90 days, after sales rose in June: a young pool</span></div>
        <div class="fig emph nodate"><span class="v num">${S.int(h.no_start)}</span><span class="l"><i style="background:var(--hold-2)"></i><b>no start date</b>, so counted but not aged: no won deal linked to the Jira issue</span></div>
      </div>
      <div class="board" id="huntBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('view', 'View', [['days', 'By days waited'], ['month', 'By start month']], 'days', 'only-chart')}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="chart h-wait" id="huntDays" role="img" aria-label="${h.with_start} of ${h.n} hunting searches by days since their start: median ${h.median}; ${h.over90} over 90 days; ${h.no_start} have no start date; ${h.bands.map(b => `${band(b)} days ${b.n}`).join(', ')}."></div>
          <div class="chart h-wait" id="huntMonths" hidden role="img" aria-label="Hunting clients by start month: ${months.map(m => `${m.label} ${m.n}`).join(', ')}."></div>
          <div class="legend"><span><i class="dot" style="background:var(--wait-2);border:1px solid var(--wait)"></i>one hunting search, up to 90 days</span><span><i class="dot" style="background:var(--wait)"></i>over 90 days</span><span><i class="line" style="background:var(--ink)"></i>median wait</span><span><i class="dash" style="color:var(--uc)"></i>recorded median to Under Contract (${S.med(h.recorded_median_to_uc)} days)</span></div>
          <p class="nd-note"><b>${S.int(h.no_start)} hunting searches are not in the chart:</b> they have no start date, so their wait cannot be measured (${why}).</p></div>
        <div class="pv-table tw" id="huntTable"></div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Wait</p><p>Wait = ${S.date(D.meta.asof)} − the client start date (the reporting layer's client_start_date: the won date from June 2026, the kickoff before). Hunting = the statuses Client Start, 2 / 4 / 6 / 8 Weeks. Of <b>${S.int(h.n)}</b> hunting clients, <b>${S.int(h.with_start)}</b> have a start date; the median and the 90-day count use those ${S.int(h.with_start)}.</p>
         <p>The other <b>${S.int(h.no_start)}</b> have no start date because their Jira issue is not linked to a won Pipedrive deal (${why}). They are counted as hunting but not aged, rather than given an age of zero. Linking their deals would date them.</p>`,
        `<p class="ex-h">Reading it</p><p>Half of past clients were under contract by day ${S.med(h.recorded_median_to_uc)}; ${S.int(h.past_recorded_median)} of the ${S.int(h.with_start)} hunting clients have already waited longer. Jira statuses run with time: the ${S.int(h.by_status['8 Weeks'].n)} at "8 Weeks" have waited a median ${S.med(h.by_status['8 Weeks'].median)} days. ${S.int(h.older_uc_date)} hunting clients carry an older Under Contract date from a contract that fell through.</p>
         <p>Same figure in the <a href="${D.meta.source}#questions" target="_blank" rel="noopener">Explorer's backlog callout</a> (median ${S.med(h.median)} days, ${S.int(h.over90)} over 90). The ${S.int(D.cash.noprop.n)} "No property yet" in the Cash Forecast count won deals; the Executive Summary reconciles them.</p>`,
      ])}
      <p class="cap">One dot per hunting search with a start date (${S.int(h.with_start)} of ${S.int(h.n)}), by days since that date · 10-day columns · 180+ days together.</p>`;
    const nodeD = S.$('#huntDays', body), nodeM = S.$('#huntMonths', body);
    waitStrip(nodeD, h);
    let recM = null;
    S.ui.table(S.$('#huntTable', body), [
      { k: 'label', label: 'Group', html: r => `${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}` },
      { k: 'n', label: 'Hunting searches', num: true, html: r => S.int(r.n) },
      { k: 'median', label: 'Median days waited', num: true, html: r => (r.median == null ? '–' : S.med(r.median)) },
    ], [
      { _group: 'By time waited (searches with a start date)' },
      ...h.bands.map(b => ({ label: `${band(b)} days`, n: b.n, median: null })),
      { _group: 'By Jira status' },
      ...Object.entries(h.by_status).map(([k, v]) => ({ label: k, n: v.n, median: v.median })),
      { _group: 'By start month' },
      ...months.map(m => ({ label: m.month === 'earlier' ? 'Before April 2026' : m.label + ' 2026', n: m.n, median: m.median })),
      { _group: 'No start date' },
      ...Object.entries(h.no_start_why).map(([k, v]) => ({ label: k, sub: 'no won Pipedrive deal linked', n: v, median: null })),
    ], { caption: 'Hunting clients by time waited, status and start month', sortable: false,
      total: [{ label: 'All hunting searches', n: h.n, median: h.median }] });
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
    const cg = D.cash.groups.paused, pc = D.cash.defaults.paused_close, br = D.reconcile.cash_bridge;
    const pausedRefund = cg.paid * (100 - pc) / 100, money = v => '$' + (Math.abs(v) / 1e6).toFixed(2) + 'M';
    const recent = r.by_month.filter(m => m.month >= '2026-01'), peak = r.by_month.reduce((a, m) => (m.n > a.n ? m : a), { n: -1 });
    const fullMon = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const body = S.scene(main, { ch, step: 3, of, label: 'Where the others stand',
      title: `Of ${S.int(p.n)} paused searches, ${S.int(p.over180)} have been paused over six months and ${S.int(p.prior.evidence)} show an ended contract or documented fall-through` });
    body.innerHTML = `<div class="figs qf four">
        <div class="fig"><span class="v num">${S.int(p.n)}</span><span class="l"><i style="background:var(--paused)"></i>paused searches; a median ${Math.round(p.median_days)} days in pause ${S.ui.chip('rec')}</span></div>
        <div class="fig emph"><span class="v num">${S.int(p.over180)}</span><span class="l"><i style="background:var(--paused)"></i><b>paused over six months</b> (181+ days): ${S.int(p.bands.find(b => b.lo === 366).n)} of them over a year. A fact about <b>how long</b>, from the pause date</span></div>
        <div class="fig emph"><span class="v num">${S.int(p.prior.evidence)}</span><span class="l"><i style="background:var(--uc)"></i><b>show an ended contract or documented fall-through</b>: ${S.int(p.prior.ended)} ended, ${S.int(p.prior.documented)} documented. A fact about <b>what happened before</b>, from the contract history</span></div>
        <div class="fig"><span class="v num">${S.int(r.n)}</span><span class="l"><i style="background:var(--refund)"></i>refunded: a median ${S.med(r.median_days)} days after the start; ${S.int(r.within14)} within 14 days; ${S.int(peak.n)} in ${fullMon(peak.month)} alone</span></div>
      </div>
      <div class="board" id="othBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('rf', 'Refunds', [['days', 'Refunds by days after start'], ['month', 'Refunds by month']], 'days', 'only-chart')}</div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="duo">
          <div><p class="duo-h"><span class="duo-v">${S.int(p.n)}</span>Paused, by time in pause <small>days since the pause began · over six months darker</small></p><div class="chart h-duo" id="pauseChart" role="img" aria-label="Paused searches by days in pause: ${p.bands.map(b => `${band(b)} ${b.n}`).join(', ')}."></div>
            <div class="pstrip" id="pauseHistory" role="img" aria-label="Contract history of the ${p.n} paused searches: ${p.prior.documented} documented fall-through, ${p.prior.ended} contract ended without a purchase, ${p.prior.none} no evidence; ${p.cross.long_evidence} of the ${p.over180} paused over six months show an ended contract or documented fall-through.">
              <p class="duo-h"><span class="duo-v">${S.int(p.prior.evidence)}</span>of the ${S.int(p.n)} show an ended contract <small>contract history, not pause length</small></p>
              <div class="ps-bar"><i class="ps-doc" style="flex:${p.prior.documented} 1 0"></i><i class="ps-end" style="flex:${p.prior.ended} 1 0"></i><i class="ps-none" style="flex:${p.prior.none} 1 0"></i></div>
              <div class="ps-keys"><span><i class="ps-doc"></i><b>${S.int(p.prior.documented)}</b> documented fall-through</span><span><i class="ps-end"></i><b>${S.int(p.prior.ended)}</b> contract ended, no purchase</span><span><i class="ps-none"></i><b>${S.int(p.prior.none)}</b> no evidence of a contract that ended</span></div>
              <p class="ps-x"><b>Both facts together:</b> ${S.int(p.cross.long_evidence)} of the ${S.int(p.over180)} paused over six months also show an ended contract or documented fall-through (${S.int(p.cross.short_evidence + p.cross.undated_evidence)} of the other ${S.int(p.n - p.over180)}).</p>
            </div></div>
          <div><p class="duo-h"><span class="duo-v">${S.int(r.n)}</span><span id="rfHead">Refunded, by days from start to refund</span> <small id="rfSub">client start date to refund date</small></p>
            <div class="chart h-duo" id="refundDays" role="img" aria-label="Refunded searches by days from start to refund: ${r.bands.map(b => `${band(b)} ${b.n}`).join(', ')}."></div>
            <div class="chart h-duo" id="refundMonths" hidden role="img" aria-label="Refunds by month: ${recent.map(m => `${S.monShort(m.month)} ${m.n}`).join(', ')}."></div></div>
        </div>
        <p class="call"><span class="call-h">Cash link</span>Paused clients have paid <b>${money(cg.paid)}</b> up front. At the Cash Forecast's default (${pc}% of paused and Additional Service deals close, the other ${100 - pc}% are refunded in full), <b>${money(pausedRefund)}</b> of the <b>${money(br.refunds)}</b> projected refunds come from them: the paused group is the largest single swing in forecast cash. The Cash Forecast tab models these flows.</p></div>
        <div class="pv-table tw" id="othTable"></div>
      </div>
      ${S.ui.ex('How is this number built?', [
        `<p class="ex-h">Paused: two separate facts</p><p><b>Pause length</b> and <b>contract history</b> come from different records. The contract history is chapter 6's evidence: a documented fall-out address (${S.int(p.prior.documented)}) or a contract on record that ended without a purchase (${S.int(p.prior.ended)}). A search can be paused for years with no sign of a contract, or paused for weeks after one fell through. Time in pause = ${S.date(D.meta.asof)} − the date the client entered Paused, from the 12 Nov 2026 Jira extract (latest_status_date, data as of 11 Nov), known for ${S.int(p.dated)} of ${S.int(p.n)}. The status before the pause (previous_status): 8 Weeks ${S.int(p.from.long_search)}, an earlier search status ${S.int(p.from.earlier_search)}, Under Contract / Passed Inspection ${S.int(p.from.contract)}, other ${S.int(p.from.other)}, not recorded ${S.int(p.from.unknown)}. ${S.int(p.older_uc_date)} paused clients carry an Under Contract date from a contract that did not close.</p>`,
        `<p class="ex-h">Refunded</p><p>Days to refund = refund date − client start date (${S.int(r.timed)} of ${S.int(r.n)} with both dates). The refund date is when the refund was recorded, so the decision came a little earlier. ${S.int(r.from_client_start)} refunded clients went straight from Client Start, before their first two-week check-in. The first refund in these records is dated ${fullMon(r.by_month.find(m => m.n).month)}, and 2025 has few, so compare recent months with care.</p>
         <p class="ex-h">Under contract</p><p>Days since contract = ${S.date(D.meta.asof)} − the latest valid Under Contract date; past contracts closed a median ${S.med(D.speed.uc_to_close.median)} days after Under Contract. ${S.int(u.passed_inspection)} have passed inspection.</p>`,
      ])}
      <p class="cap">Jira, status on ${S.date(D.meta.asof)} · the same ${S.int(p.n)} paused, ${S.int(r.n)} refunded and ${S.int(u.n)} under contract (a median ${S.med(u.median_days_since)} days since the contract; ${S.int(u.scheduled)} closings scheduled) as in 2.1 · the first 14 days by start month are in section 3.5.</p>`;
    bars(S.$('#pauseChart', body), p.bands.map(b => ({ label: band(b), n: b.n, hl: b.lo > 180 ? 'ink2' : null })), 'paused', { name: 'days in pause', tip: x => `<b>${x.label} days</b> in pause: ${x.n} searches` });
    bars(S.$('#refundDays', body), r.bands.map(b => ({ label: band(b), n: b.n, hl: b.lo === 0 ? 'refund' : null })), 'refund2', { name: 'days from start to refund', tip: x => `<b>${x.label} days</b> after the start: ${x.n} refunds` });
    let recM = null;
    const nodeRD = S.$('#refundDays', body), nodeRM = S.$('#refundMonths', body);
    S.ui.table(S.$('#othTable', body), [
      { k: 'label', label: 'Group', html: x => `${x.label}${x.sub ? `<small>${x.sub}</small>` : ''}` },
      { k: 'n', label: 'Searches', num: true, html: x => S.int(x.n) },
    ], [
      { _group: `Paused (${p.n}) by days in pause` }, ...p.bands.map(b => ({ label: `${band(b)} days`, n: b.n })), ...(p.n - p.dated ? [{ label: 'Pause date not recorded', n: p.n - p.dated }] : []),
      { _group: 'Paused by contract history (separate from pause length)' }, { label: 'Documented fall-through', n: p.prior.documented }, { label: 'Contract ended, no purchase recorded', n: p.prior.ended }, { label: 'No evidence of a contract that ended', n: p.prior.none },
      { _group: 'Pause length and contract history together' }, { label: 'Paused over six months, contract ended or fell through', n: p.cross.long_evidence }, { label: 'Paused over six months, no such evidence', n: p.cross.long_none },
      { label: 'Paused six months or less (or undated), contract ended or fell through', n: p.cross.short_evidence + p.cross.undated_evidence }, { label: 'Paused six months or less (or undated), no such evidence', n: p.cross.short_none + p.cross.undated_none },
      { _group: 'Paused by the status before the pause' }, { label: '8 Weeks (long search)', n: p.from.long_search }, { label: 'Client Start to 6 Weeks', n: p.from.earlier_search }, { label: 'Under Contract / Passed Inspection', n: p.from.contract }, { label: 'Other', n: p.from.other }, { label: 'Not recorded', n: p.from.unknown },
      { _group: `Refunded (${r.n}) by days from start to refund` }, ...r.bands.map(b => ({ label: `${band(b)} days`, n: b.n })), ...(r.n - r.timed ? [{ label: 'Start or refund date missing', n: r.n - r.timed }] : []),
      { _group: 'Refunds by month recorded (2026)' }, ...recent.map(m => ({ label: fullMon(m.month), n: m.n })),
      { _group: 'Under contract' }, { label: 'Under contract, not yet closed', sub: `median ${S.med(u.median_days_since)} days since the contract`, n: u.n }, { label: 'of which closing scheduled after the data date', n: u.scheduled },
    ], { caption: 'Paused, refunded and under-contract searches', sortable: false });
    S.ui.wire(S.$('#othBoard', body), (name, v) => {
      st[name] = v;
      nodeRD.hidden = v !== 'days'; nodeRM.hidden = v !== 'month';
      S.$('#rfHead', body).textContent = v === 'days' ? 'Refunded, by days from start to refund' : 'Refunds by month recorded';
      S.$('#rfSub', body).textContent = v === 'days' ? 'client start date to refund date' : '2026, Jira refund date';
      if (v === 'month' && !recM) recM = bars(nodeRM, recent.map(m => ({ label: S.monShort(m.month).replace(/ ’\d\d/, ''), n: m.n, hl: m.n === peak.n ? 'refund' : null })), 'refund2', { tip: x => `<b>${x.label} 2026</b>: ${x.n} refunds recorded` });
      else if (v === 'month') recM.draw();
    });
  }

  /* 2.4 pauses by acquisition lead (added 20 Nov 2026; scene id outcomes-6, shown 4th). Unit = search. Leads appear only as aliases (A1, A2, ...)
     drawn at random, independent of any figure; the mapping stays in the private Explorer repo. Three answers in reading order: the pause rate
     per lead with the median start-to-pause in the same row order; where the largest portfolio's extra pauses come from (status before the
     pause, or contract history, per 100 searches); and the 8-week searches, paused vs still hunting. Cohort cuts and the full breakdown sit
     behind the 2026-starts switch and the Table view. */
  function byLead(main, D, ch, of) {
    const L = D.outcomes.leads, G = L.groups, big = L.largest, gL = G.largest, gO = G.others, gA = G.assigned, gAll = G.all, mh = L.mh.by_start_half;
    const st = { coh: 'all', mix: 'path' };
    const p1 = v => (v * 100).toFixed(1) + '%', f1 = v => (Math.round(v * 10) / 10).toFixed(1), per = (k, n) => (n ? (100 * k) / n : 0);
    const pts = v => (v * 100).toFixed(1), rate = g => (g.n ? g.paused / g.n : 0), l8 = g => g.long.paused / (g.long.paused + g.long.hunting);
    const hp = g => (g.stages.hunting + g.stages.paused) / g.n, ev = g => g.hist.documented + g.hist.ended, sum = (rs, f) => rs.reduce((a, r) => a + f(r), 0);
    const OTH = 'Other assigned leads', un = L.rows.find(r => r.alias === 'Unassigned'), small = L.rows.filter(r => r.small);
    const sized = L.rows.filter(r => !r.small && r.alias !== 'Unassigned');
    const smRow = small.length ? { alias: `${small.length} smaller`, sub: `${small.map(r => r.alias).join(', ')}`, n: sum(small, r => r.n), paused: sum(small, r => r.paused), dated: sum(small, r => r.dated), median: null, merged: true,
      y2026: { n: sum(small, r => r.y2026.n), paused: sum(small, r => r.y2026.paused), dated: sum(small, r => r.y2026.dated), median: null } } : null;
    const rows = [...sized, ...(smRow ? [smRow] : []), un];
    const cut = r => (st.coh === 'y26' ? Object.assign({ alias: r.alias, sub: r.sub, merged: r.merged }, r.y2026) : r);
    const gapAll = rate(gL) - rate(gO), gap8 = (gL.path.long_search / gL.n) - (gO.path.long_search / gO.n);
    const histEv = gL.cross.long_search_ev + gL.cross.earlier_ev;
    const body = S.scene(main, { ch, step: 6, of, label: 'Pauses by acquisition lead',
      title: `${big} holds ${S.pct(gL.n / gA.n)} of assigned searches but ${S.pct(gL.paused / gA.paused)} of current pauses: most of the gap is long searches moved to Paused rather than kept at 8 Weeks, not faster pausing` });
    const rowAria = rows.map(r => `${r.alias}: ${r.paused} of ${r.n} paused (${p1(rate(r))})${r.median != null ? `, median ${S.med(r.median)} days from start to pause (${r.dated} searches)` : ''}`).join('; ');
    body.innerHTML = `<div class="figs qf four">
        <div class="fig emph"><span class="v num"><span class="from">${p1(rate(gL))}</span><span class="ar2">vs</span>${p1(rate(gO))}</span><span class="l"><i style="background:var(--paused)"></i><b>paused today</b>: ${big} ${S.int(gL.paused)} of ${S.int(gL.n)} searches; the other assigned leads ${S.int(gO.paused)} of ${S.int(gO.n)} ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num"><span class="from">${S.pct(gL.n / gA.n)}</span><span class="ar2">→</span>${S.pct(gL.paused / gA.paused)}</span><span class="l"><i style="background:var(--ink-2)"></i>${big}'s share of the ${S.int(gA.n)} assigned searches, then of their ${S.int(gA.paused)} current pauses</span></div>
        <div class="fig emph"><span class="v num"><span class="from">${S.pct(l8(gL))}</span><span class="ar2">vs</span>${S.pct(l8(gO))}</span><span class="l"><i style="background:var(--wait)"></i><b>of 8-week searches are paused</b>, not still hunting: ${S.int(gL.long.paused)} of ${S.int(gL.long.paused + gL.long.hunting)} for ${big}, ${S.int(gO.long.paused)} of ${S.int(gO.long.paused + gO.long.hunting)} for the others</span></div>
        <div class="fig"><span class="v num">${S.med(gL.median)}<span class="ar2">vs</span>${S.med(gO.median)}<small>days</small></span><span class="l"><i style="background:var(--ink-2)"></i>median start to pause (${S.int(gL.dated)} and ${S.int(gO.dated)} still paused); 2026 starts ${S.med(gL.y2026.median)} vs ${S.med(gO.y2026.median)}: <b>not sooner</b></span></div>
      </div>
      <div class="board" id="ldBoard">
        <div class="ptools"><div class="pl">${S.ui.seg('coh', 'Start cohort', [['all', 'All starts'], ['y26', '2026 starts']], 'all', 'only-chart')}<span class="vt-l only-table">every lead, then start cohorts</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart">
          <div class="lx"><div><p class="duo-h"><span class="duo-v" id="ldV">${p1(rate(gAll))}</span><span id="ldHead">of all ${S.int(gAll.n)} searches are paused today. Each lead:</span> <small>leads by number of searches · bar = paused share · dot = median days from start to pause, line = middle half</small></p>
              <div class="chart h-lead" id="ldChart" role="img" aria-label="Pause rate and median days from start to pause by acquisition lead. ${rowAria}."></div>
              <div class="legend"><span><i style="background:var(--paused)"></i>${big}: paused, % of its searches</span><span><i style="background:var(--hold-2);box-shadow:inset 0 0 0 1px var(--hold)"></i>Other leads</span><span><i class="dot" style="background:var(--ink)"></i>Median days from start to the current pause</span><span><i class="dash" style="color:var(--ink-2)"></i>All searches</span></div></div>
            <aside class="lx-note" id="ldNote"></aside></div>
          <div class="lx"><div><p class="duo-h"><span class="duo-v">${f1(100 * gapAll)}</span>more paused per 100 searches for ${big} than the other leads. What those pauses were: <small>paused searches per 100 searches · status first, as in 2.3</small></p>
              <div class="mixbar">${S.ui.seg('mix', 'Pause pathway', [['path', 'Status before the pause'], ['hist', 'Contract history']], 'path')}</div>
              <div class="chart h-mix" id="ldMix" role="img" aria-label="Paused per 100 searches by the status before the pause: ${big} ${['long_search', 'earlier', 'contract'].map(k => `${k.replace('_', ' ')} ${f1(per(gL.path[k], gL.n))}`).join(', ')}; other assigned leads ${['long_search', 'earlier', 'contract'].map(k => `${k.replace('_', ' ')} ${f1(per(gO.path[k], gO.n))}`).join(', ')}."></div>
              <div class="legend" id="ldMixKey"></div></div>
            <aside class="lx-note" id="ldMixNote"></aside></div>
          <div class="lx"><div><p class="duo-h"><span class="duo-v">${S.int(gL.long.paused + gL.long.hunting + gO.long.paused + gO.long.hunting)}</span>assigned searches reached 8 Weeks and have no contract today: paused or still hunting? <small>last search status 8 Weeks · Jira, ${S.date(D.meta.asof)}</small></p>
              <div class="l8" role="img" aria-label="Searches that reached 8 Weeks with no contract today. ${big}: ${gL.long.paused} paused, ${gL.long.hunting} still hunting (${S.pct(l8(gL))} paused). Other assigned leads: ${gO.long.paused} paused, ${gO.long.hunting} still hunting (${S.pct(l8(gO))} paused).">
                ${[[big, gL], [OTH, gO]].map(([lab, g]) => `<div class="l8-row"><span class="l8-lab"><b>${lab}</b><small>${S.int(g.long.paused + g.long.hunting)} searches</small></span><div class="l8-bar"><i class="l8-p" style="flex:${g.long.paused} 1 0" title="Paused after 8 Weeks: ${g.long.paused}">${g.long.paused}</i><i class="l8-h" style="flex:${g.long.hunting} 1 0" title="Still hunting at 8 Weeks: ${g.long.hunting}">${g.long.hunting}</i></div><span class="l8-v num">${S.pct(l8(g))}<small>paused</small></span></div>`).join('')}
              </div>
              <div class="legend"><span><i style="background:var(--paused)"></i>Paused, straight from 8 Weeks</span><span><i style="background:var(--wait-2);box-shadow:inset 0 0 0 1.5px var(--wait)"></i>Still hunting at 8 Weeks</span></div></div>
            <aside class="lx-note"><b>Where the gap sits.</b> ${big} has moved ${S.int(gL.long.paused)} of its ${S.int(gL.long.paused + gL.long.hunting)} long searches to Paused; the other leads keep most of theirs at 8 Weeks (${S.int(gO.long.hunting)} of ${S.int(gO.long.paused + gO.long.hunting)}). Counting hunting and paused together, the gap narrows from ${pts(gapAll)} to ${pts(hp(gL) - hp(gO))} points (${p1(hp(gL))} vs ${p1(hp(gO))}). Jira records no reason for a pause, so the records cannot say whether clients stepped back or how statuses are kept.</aside></div>
        </div>
        <div class="pv-table"><div class="tw" id="ldTable"></div><p class="t-h2">Start cohorts: ${big} against the other assigned leads</p><div class="tw" id="ldCoh"></div></div>
      </div>
      ${S.ui.ex('How is this built?', [
        `<p class="ex-h">Unit and lead</p><p>One row per <b>search</b>: a signed-up Jira record (${S.int(gAll.n)}), so a repeat client counts once per search. Lead = the Jira Acq Lead the search is assigned to on ${S.date(D.meta.asof)} (current assignee). ${S.int(un.n)} searches have no lead (Unassigned, ${S.int(un.paused)} paused); they are in every total and outside the lead comparison, so the largest portfolio is compared with the other ${S.int(gO.n)} assigned searches. ${S.int(L.reassigned.n)} search changed lead between the 12 Nov extract and ${S.date(D.meta.asof)} (${S.int(L.reassigned.paused)} paused).</p>
         <p><b>Aliases</b>: A1, A2, … were drawn in a random order, independent of any figure here, and stay fixed for later updates; the names behind them are kept out of this report. Leads with fewer than ${L.min_row} searches (${small.map(r => r.alias).join(', ')}) share one chart row and are listed in the table.</p>
         <p class="ex-h">Pause rate and like for like</p><p>Paused = status Paused on the data date, status first as in 2.1 (the same ${S.int(gAll.paused)}). Started in the same half-year, ${big} is still ${pts(mh.diff)} points above the other leads (Mantel–Haenszel, ${mh.strata} start half-years, 95% ${pts(mh.lo)} to ${pts(mh.hi)}) ${S.ui.chip('inf')}; adding product (Core / Complete) gives ${pts(L.mh.by_start_half_product.diff)}. The mix is alike: Complete ${S.pct(L.mix.complete.largest / gL.n)} vs ${S.pct(L.mix.complete.others / gO.n)}, New Client Experience ${S.pct(L.mix.nce.largest / gL.n)} vs ${S.pct(L.mix.nce.others / gO.n)}. ${big}'s searches are not older: a median ${S.int(gL.followup_median)} days since the start against ${S.int(gO.followup_median)}. No batch moves: at most ${gL.max_same_day} of ${big}'s pauses share a date.</p>`,
        `<p class="ex-h">Start to pause</p><p>Canonical start date (client_start_date: the won date from June 2026, the kickoff before) to the date the <b>current</b> pause began (12 Nov 2026 extract, latest_status_date, kept where that extract already shows Paused). Both dates exist for ${S.int(gAll.dated)} of ${S.int(gAll.paused)}: ${S.int(L.late_pause)} entered Paused after the extract and ${S.int(L.no_start)} have no start date. It describes searches <b>still paused</b>, grouped by current assignee: a pause that ended leaves no date. Medians need ${L.min_median}+ searches. By start half-year the largest portfolio is not consistently sooner (Table view). Days in the status before the pause: a median ${S.med(gL.dwell_median)} for ${big}, ${S.med(gO.dwell_median)} for the others.</p>
         <p class="ex-h">Pathway</p><p><b>Status before the pause</b> (previous_status, 12 Nov extract) uses 2.3's groups: 8 Weeks; Client Start to 6 Weeks; Under Contract or Passed Inspection; other (Additional Service, Refunded); not recorded. <b>Contract history</b> is chapter 6's evidence: a documented fall-out address, or a contract on record that ended without a purchase; otherwise no contract on record. Every paused search is in the 12 Nov extract, so no history is unknown. The two overlap: ${S.int(histEv)} of ${big}'s ${S.int(ev(gL))} pauses with an ended contract were hunting again just before the pause. Totals tie to 2.3 (${S.int(gAll.hist.documented)} documented, ${S.int(gAll.hist.ended)} ended), chapter 6, the Cash Forecast's ${S.int(ev(gAll))} paused fall-throughs and the Explorer's own records, per lead (checked on every build).</p>`,
      ])}
      <p class="cap">Jira, status on ${S.date(D.meta.asof)} · ${S.int(gAll.n)} searches = ${S.int(gA.n)} assigned + ${S.int(un.n)} Unassigned; ${S.int(gAll.paused)} paused = ${S.int(gA.paused)} + ${S.int(un.paused)}, the same as 2.1 and 2.3 · a pattern in the records, not a cause.</p>`;

    const chartNode = S.$('#ldChart', body), mixNode = S.$('#ldMix', body);
    const COLS = { path: [['long_search', '8 Weeks', 'wait'], ['earlier', 'Client Start to 6 Weeks', 'wait2'], ['contract', 'Under Contract / Passed Inspection', 'uc'], ['otherx', 'Other or not recorded', 'hold2']],
      hist: [['documented', 'Documented fall-through', 'uc'], ['ended', 'Contract ended, no purchase', 'uc2'], ['none', 'No contract on record', 'hold2']].concat(gAll.hist.unknown ? [['unknown', 'History not covered', 'hold']] : []) };
    const mixVal = (g, k) => (k === 'otherx' ? g.path.other + g.path.unknown : st.mix === 'path' ? g.path[k] : g.hist[k]);

    const note = () => {
      const c = st.coh === 'y26', a = c ? gL.y2026 : gL, b = c ? gO.y2026 : gO;
      S.$('#ldNote', body).innerHTML = c
        ? `<b>2026 starts only.</b> ${big}: ${S.int(a.paused)} of ${S.int(a.n)} paused (${p1(rate(a))}); the other leads ${S.int(b.paused)} of ${S.int(b.n)} (${p1(rate(b))}). Median start to pause ${S.med(a.median)} vs ${S.med(b.median)} days: <b>not sooner</b>. These pauses are recent, so the days are short for everyone.`
        : `<b>Rate.</b> ${big} has ${S.int(gL.paused)} of the ${S.int(gA.paused)} assigned pauses from ${S.pct(gL.n / gA.n)} of the searches. The gap holds for searches that started in the same half-year (+${pts(mh.diff)} points). <b>Timing.</b> Its median start to pause is ${S.med(gL.median)} days against ${S.med(gO.median)} for the others: <b>not sooner</b>.`;
      S.$('#ldV', body).textContent = p1(rate(c ? gAll.y2026 : gAll));
      S.$('#ldHead', body).textContent = c ? `of the ${S.int(gAll.y2026.n)} searches that started in 2026 are paused today. Each lead:` : `of all ${S.int(gAll.n)} searches are paused today. Each lead:`;
    };
    const mixNote = () => {
      const k8 = per(gL.path.long_search, gL.n), o8 = per(gO.path.long_search, gO.n);
      S.$('#ldMixNote', body).innerHTML = st.mix === 'path'
        ? `<b>Mostly long searches.</b> ${f1(k8)} of every 100 ${big} searches are paused straight from 8 Weeks, against ${f1(o8)} for the other leads: ${f1(100 * gap8)} of the ${f1(100 * gapAll)}-point gap. Earlier hunting stages add ${f1(per(gL.path.earlier, gL.n) - per(gO.path.earlier, gO.n))}; pauses from a contract are few for everyone (${gL.path.contract} and ${gO.path.contract}).`
        : `<b>Contract trouble is proportionate.</b> ${S.int(ev(gL))} of ${big}'s ${S.int(gL.paused)} pauses (${S.pct(ev(gL) / gL.paused)}) follow an ended contract or documented fall-through, against ${S.int(ev(gO))} of ${S.int(gO.paused)} (${S.pct(ev(gO) / gO.paused)}) for the others. Per 100 searches: ${f1(per(ev(gL), gL.n))} vs ${f1(per(ev(gO), gO.n))} with that history, ${f1(per(gL.hist.none, gL.n))} vs ${f1(per(gO.hist.none, gO.n))} without.`;
      S.$('#ldMixKey', body).innerHTML = COLS[st.mix].map(([, l, c]) => `<span><i style="background:var(--${c === 'wait2' ? 'wait-2' : c === 'uc2' ? 'uc-2' : c === 'hold2' ? 'hold-2' : c})${c === 'uc2' ? ';box-shadow:inset 0 0 0 1.5px var(--uc)' : ''}"></i>${l}</span>`).join('');
    };

    const recL = S.chart(chartNode, (t, el) => {
      const rs = rows.map(cut), W = el.clientWidth, labW = 112, gap = 40, endR = 74;
      const wL = Math.max(160, (W - labW - gap - endR) * 0.54), xR = labW + wL + gap;
      const maxRate = Math.ceil(Math.max(0.2, ...rs.map(r => rate(r))) * 1.5 * 20) / 20;   // room for the count labels
      const maxD = Math.ceil(Math.max(120, ...rs.map(r => r.q3 || r.median || 0)) / 60) * 60;
      const all = st.coh === 'y26' ? gAll.y2026 : gAll;
      const lab = (r, i) => `{a|${r.alias}}\n{n|${S.int(r.n)} searches}`;
      const timing = r => (r.median != null ? `${S.med(r.median)} days` : r.paused ? `${r.dated ? r.dated : 'no'} dated: too few` : r.n ? 'no pauses' : st.coh === 'y26' ? 'no 2026 starts' : 'no searches');
      return Object.assign(S.base(t), {
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', confine: true, formatter: p => {
          const r = rs[p.dataIndex];
          const head = `<b>${r.alias}</b>${r.sub ? ` (${r.sub})` : ''} · ${S.int(r.n)} searches${st.coh === 'y26' ? ' started in 2026' : ''}`;
          return p.seriesIndex === 0
            ? `${head}<br>Paused today: <b>${S.int(r.paused)}</b> (${p1(rate(r))})${r.alias !== 'Unassigned' && !r.merged && st.coh === 'all' ? `<br>${S.pct(r.paused / gA.paused)} of the ${S.int(gA.paused)} assigned pauses, from ${S.pct(r.n / gA.n)} of assigned searches` : ''}`
            : `${head}<br>${r.median != null ? `Median <b>${S.med(r.median)}</b> days from start to the current pause${r.q1 != null ? ` (middle half ${S.med(r.q1)}–${S.med(r.q3)})` : ''}<br>${S.int(r.dated)} still-paused searches with both dates` : `${timing(r)}${r.paused ? ` (a median needs ${L.min_median}+ dated pauses)` : ''}`}`;
        } }),
        grid: [{ left: labW, top: 34, bottom: 36, width: wL }, { left: xR, right: endR, top: 34, bottom: 36 }],
        xAxis: [
          { type: 'value', gridIndex: 0, min: 0, max: maxRate, splitNumber: 4, axisLabel: { color: t.label, fontSize: 12, formatter: v => Math.round(v * 100) + '%' }, splitLine: { lineStyle: { color: t.grid } },
            name: 'paused, % of the lead\'s searches', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: t.muted, fontSize: 12 } },
          { type: 'value', gridIndex: 1, min: 0, max: maxD, interval: maxD > 240 ? 90 : 60, axisLabel: { color: t.label, fontSize: 12 }, splitLine: { lineStyle: { color: t.grid } },
            name: 'days from start to the current pause', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: t.muted, fontSize: 12 } },
        ],
        yAxis: [
          { type: 'category', gridIndex: 0, data: rs.map(r => r.alias), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
            axisLabel: { formatter: (v, i) => lab(rs[i], i), rich: { a: { color: t.ink, fontSize: 14, fontWeight: 700, lineHeight: 18, fontFamily: DISPLAY }, n: { color: t.muted, fontSize: 11.5, lineHeight: 15 } } } },
          { type: 'category', gridIndex: 1, data: rs.map(r => r.alias), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } }, axisLabel: { show: false } },
        ],
        series: [
          { type: 'bar', xAxisIndex: 0, yAxisIndex: 0, barWidth: '56%',
            data: rs.map(r => ({ value: rate(r), itemStyle: { color: r.alias === big ? t.paused : t.hold2, opacity: r.alias === 'Unassigned' || r.merged ? 0.6 : 1, borderColor: r.alias === big ? t.paused : t.hold, borderWidth: r.alias === big ? 0 : 1, borderRadius: [0, 4, 4, 0] } })),
            label: { show: true, position: 'right', distance: 6, color: t.ink, fontSize: 12.5, fontWeight: 650, backgroundColor: t.surface, padding: [2, 4], borderRadius: 3, formatter: p => { const r = rs[p.dataIndex]; return r.n ? `${S.int(r.paused)} of ${S.int(r.n)} · ${p1(rate(r))}` : st.coh === 'y26' ? 'no 2026 starts' : 'none'; } },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.ink2, type: 'dashed', width: 1.4 },
              label: { show: true, position: 'start', distance: 6, formatter: `all searches ${p1(rate(all))}`, color: t.ink2, fontSize: 12, fontWeight: 600 }, data: [{ xAxis: rate(all) }] } },
          { type: 'custom', xAxisIndex: 1, yAxisIndex: 1, data: rs.map((r, i) => [r.median == null ? 0 : r.median, i]),
            renderItem: (params, api) => {
              const i = params.dataIndex, r = rs[i], y = api.coord([0, i])[1];
              if (r.median == null) return { type: 'text', z2: 5, style: { x: api.coord([0, i])[0] + 6, y, text: timing(r), textVerticalAlign: 'middle', fill: t.muted, font: `500 12px Figtree, sans-serif`, backgroundColor: t.surface, padding: [2, 4] } };
              const xm = api.coord([r.median, i])[0], kids = [];
              if (r.q1 != null) kids.push({ type: 'line', shape: { x1: api.coord([r.q1, i])[0], y1: y, x2: api.coord([r.q3, i])[0], y2: y }, style: { stroke: r.alias === big ? t.ink2 : t.hold, lineWidth: 3, lineCap: 'round', opacity: 0.55 } });
              kids.push({ type: 'circle', shape: { cx: xm, cy: y, r: r.alias === big ? 8 : 6.5 }, style: { fill: r.alias === big ? t.ink : t.ink2, stroke: t.surface, lineWidth: 2 } });
              kids.push({ type: 'text', z2: 5, style: { x: (r.q3 != null ? api.coord([r.q3, i])[0] : xm) + 8, y, text: `${S.med(r.median)} d · ${r.dated}`, textVerticalAlign: 'middle', fill: t.ink, font: `650 12.5px Figtree, sans-serif`, backgroundColor: t.surface, padding: [2, 4] } });
              return { type: 'group', children: kids };
            },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: t.ink2, type: 'dashed', width: 1.4 },
              label: { show: true, position: 'start', distance: 6, formatter: `all searches ${S.med(all.median)} d`, color: t.ink2, fontSize: 12, fontWeight: 600 }, data: all.median != null ? [{ xAxis: all.median }] : [] } },
        ],
      });
    });

    const recM = S.chart(mixNode, t => {
      const grp = [[big, gL], [OTH, gO]], cols = COLS[st.mix];
      const col = { wait: t.wait, wait2: t.wait2, uc: t.uc, uc2: t.uc2, hold2: t.hold2, hold: t.hold };
      const maxV = Math.ceil(per(gL.paused, gL.n) / 5) * 5 + 3;
      return Object.assign(S.base(t), {
        tooltip: Object.assign(S.base(t).tooltip, { trigger: 'item', confine: true, formatter: p => {
          const [name, g] = grp[p.dataIndex], [k, l] = cols[p.seriesIndex], v = mixVal(g, k);
          return `<b>${name}</b> · ${l}<br>${S.int(v)} paused of ${S.int(g.n)} searches = <b>${f1(per(v, g.n))}</b> per 100<br>${S.pct(g.paused ? v / g.paused : 0)} of the group's ${S.int(g.paused)} pauses`;
        } }),
        grid: { left: 8, right: 24, top: 6, bottom: 26, containLabel: true },
        xAxis: { type: 'value', min: 0, max: maxV, interval: 5, axisLabel: { color: t.label, fontSize: 12 }, splitLine: { lineStyle: { color: t.grid } },
          name: 'paused per 100 searches', nameLocation: 'middle', nameGap: 22, nameTextStyle: { color: t.muted, fontSize: 12 } },
        yAxis: { type: 'category', inverse: true, data: grp.map(([n]) => n), axisTick: { show: false }, axisLine: { show: false },
          axisLabel: { formatter: (v, i) => `{a|${v}}\n{n|${f1(per(grp[i][1].paused, grp[i][1].n))} per 100 · ${S.int(grp[i][1].paused)} paused}`,
            rich: { a: { color: t.ink, fontSize: 14, fontWeight: 700, lineHeight: 18, fontFamily: DISPLAY }, n: { color: t.muted, fontSize: 11.5, lineHeight: 15 } } } },
        series: cols.map(([k, l, c], si) => ({ name: l, type: 'bar', stack: 'm', barWidth: 34,
          itemStyle: { color: col[c], borderColor: c === 'uc2' ? t.uc : t.surface, borderWidth: c === 'uc2' ? 1.2 : 1.5 },
          label: { show: true, color: ['uc', 'wait'].includes(c) ? '#fff' : t.ink, fontWeight: 700, fontSize: 12.5, formatter: p => (p.value >= 1.6 ? f1(p.value) : '') },
          data: grp.map(([, g]) => ({ value: per(mixVal(g, k), g.n), itemStyle: { borderRadius: si === cols.length - 1 ? [0, 5, 5, 0] : si === 0 ? [5, 0, 0, 5] : 0 } })) })),
      });
    });

    /* Table view: every lead, then the start cohorts (the cohort cuts behind the switch) */
    const tRow = r => Object.assign({}, r, { rate: rate(r) });
    S.ui.table(S.$('#ldTable', body), [
      { k: 'alias', label: 'Lead', html: r => `<b>${r.alias}</b><small>${r._tot ? r.sub : r.alias !== 'Unassigned' ? `${S.pct(r.n / gA.n, 1)} of assigned` : 'no Acq Lead'}</small>` },
      { k: 'n', label: 'Searches', num: true, html: r => S.int(r.n) },
      { k: 'rate', label: 'Paused', num: true, html: r => `${p1(r.rate)}<small>${S.int(r.paused)}</small>` },
      { k: 'pshare', label: 'Share of assigned pauses', num: true, sv: r => (r.alias === 'Unassigned' ? null : r.paused / gA.paused), html: r => (r._tot ? (r._all ? '–' : '100%') : r.alias === 'Unassigned' ? '–' : S.pct(r.paused / gA.paused, 1)) },
      { k: 'median', label: 'Median days start → pause', num: true, html: r => (r.median != null ? `${S.med(r.median)}<small>${r.dated} dated</small>` : `–<small>${r.dated} dated</small>`) },
      { k: 'p8', label: 'From 8 Weeks', num: true, sv: r => r.path.long_search, html: r => S.int(r.path.long_search) },
      { k: 'pe', label: 'From Client Start–6 Weeks', num: true, sv: r => r.path.earlier, html: r => S.int(r.path.earlier) },
      { k: 'pc', label: 'From UC / Passed Insp.', num: true, sv: r => r.path.contract, html: r => S.int(r.path.contract) },
      { k: 'po', label: 'Other / not recorded', num: true, sv: r => r.path.other + r.path.unknown, html: r => S.int(r.path.other + r.path.unknown) },
      { k: 'hev', label: 'Ended contract or fall-through', num: true, sv: r => ev(r), html: r => `${S.int(ev(r))}${r.hist.documented ? `<small>${r.hist.documented} documented</small>` : ''}` },
      { k: 'hno', label: 'No contract on record', num: true, sv: r => r.hist.none, html: r => S.int(r.hist.none) },
      { k: 'l8', label: '8 Weeks: paused of all', num: true, sv: r => (r.long.paused + r.long.hunting ? l8(r) : null), html: r => (r.long.paused + r.long.hunting ? `${S.int(r.long.paused)} of ${S.int(r.long.paused + r.long.hunting)}<small>${S.pct(l8(r))}</small>` : '–') },
      { k: 'y26', label: '2026 starts: paused', num: true, sv: r => (r.y2026.n ? r.y2026.paused / r.y2026.n : null), html: r => (r.y2026.n ? `${S.int(r.y2026.paused)} of ${S.int(r.y2026.n)}<small>${p1(r.y2026.paused / r.y2026.n)}${r.y2026.median != null ? ` · ${S.med(r.y2026.median)} d` : ''}</small>` : '–') },
    ], L.rows.map(tRow), { caption: 'Pauses by acquisition lead, every lead',
      total: [Object.assign(tRow(gA), { alias: 'All assigned leads', sub: `${S.int(L.rows.length - 1)} leads`, _tot: true }), Object.assign(tRow(gAll), { alias: 'All searches', sub: 'incl. Unassigned', _tot: true, _all: true })] });
    const cc = r => `${S.int(r.paused)} of ${S.int(r.n)}<small>${r.n ? p1(r.paused / r.n) : '–'}</small>`;
    S.ui.table(S.$('#ldCoh', body), [
      { k: 'label', label: 'Start half-year', html: r => r.label },
      { k: 'a', label: `${big}: paused`, num: true, html: r => cc(r.largest) },
      { k: 'b', label: 'Other leads: paused', num: true, html: r => cc(r.others) },
      { k: 'am', label: `${big}: median days to pause`, num: true, html: r => (r.largest.median != null ? `${S.med(r.largest.median)}<small>${r.largest.dated} dated</small>` : `–<small>${r.largest.dated} dated</small>`) },
      { k: 'bm', label: 'Other leads: median days', num: true, html: r => (r.others.median != null ? `${S.med(r.others.median)}<small>${r.others.dated} dated</small>` : `–<small>${r.others.dated} dated</small>`) },
    ], L.cohorts, { caption: 'Start cohorts: the largest portfolio against the other assigned leads', sortable: false,
      notes: `Like for like over the ${mh.strata} start half-years: +${pts(mh.diff)} points (95% ${pts(mh.lo)} to ${pts(mh.hi)}). A median needs ${L.min_median}+ dated pauses. The days describe searches still paused; recent cohorts have had less time, so compare within a row.` });

    note(); mixNote();
    S.ui.wire(S.$('#ldBoard', body), (name, v) => {
      st[name] = v;
      if (name === 'coh') { note(); recL.draw(); }
      if (name === 'mix') { mixNote(); recM.draw(); }
    });
  }

  /* 2.5 up to vs above $250K: where each group stands today (scene id outcomes-4) */
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
    n: 2, title: 'Where are our searches today?',
    order: ['outcomes-1', 'outcomes-2', 'outcomes-3', 'outcomes-6', 'outcomes-4', 'outcomes-5'],   // displayed order; ids are stable keys (deep links)
    render(main, D, ch) {
      const OF = 6, at = D.outcomes.attainment;
      stages(main, D, ch, OF);
      hunting(main, D, ch, OF);
      others(main, D, ch, OF);
      byLead(main, D, ch, OF);
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
