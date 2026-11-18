/* Chapter 2: where are our clients today? Who they are -> who is still waiting (added 18 Nov 2026) -> milestones reached. */
(function () {
  'use strict';
  const S = window.S;

  function sankey(node, oc) {
    const g = Object.fromEntries(oc.active_groups.map(x => [x.group, x]));
    const ina = Object.fromEntries(oc.inactive_statuses.map(x => [x.status, x.n]));
    S.chart(node, t => {
      const lab = { backgroundColor: t.surface, borderRadius: 5, padding: [3, 7] };
      const nodes = [
        { name: 'Signed-up clients', value: oc.signed, itemStyle: { color: t.ink2 }, label: Object.assign({ position: 'left' }, lab) },
        { name: 'Active', value: oc.active, itemStyle: { color: t.acq }, label: lab },
        { name: 'Inactive', value: oc.inactive, itemStyle: { color: t.hold }, label: lab },
        { name: 'Hunting', value: g['Hunting'].n, itemStyle: { color: t.wait } },
        { name: 'Under contract / inspection', value: g['Under contract'].n, itemStyle: { color: t.uc } },
        { name: 'CLOSED', value: g['Closed'].n, itemStyle: { color: t.closed } },
        { name: 'Post-close', value: g['Post-close'].n, itemStyle: { color: t.closed2 } },
        { name: 'Paused', value: ina['Paused'], itemStyle: { color: t.hold } },
        { name: 'Refunded', value: ina['Refunded'], itemStyle: { color: t.hold } },
        { name: 'Additional service', value: ina['Additional Service'], itemStyle: { color: t.hold2 } },
      ];
      const links = [
        ['Signed-up clients', 'Active', oc.active], ['Signed-up clients', 'Inactive', oc.inactive],
        ['Active', 'Hunting', g['Hunting'].n], ['Active', 'Under contract / inspection', g['Under contract'].n],
        ['Active', 'CLOSED', g['Closed'].n], ['Active', 'Post-close', g['Post-close'].n],
        ['Inactive', 'Paused', ina['Paused']], ['Inactive', 'Refunded', ina['Refunded']], ['Inactive', 'Additional service', ina['Additional Service']],
      ].map(([source, target, value]) => ({ source, target, value }));
      const tip = { 'Hunting': g['Hunting'].statuses, 'Under contract / inspection': g['Under contract'].statuses, 'Post-close': g['Post-close'].statuses };
      return Object.assign(S.base(t), {
        tooltip: Object.assign(S.base(t).tooltip, {
          trigger: 'item',
          formatter: p => p.dataType === 'edge' ? `${p.data.source} → ${p.data.target}: <b>${p.data.value}</b>` :
            `<b>${p.name}</b>: ${p.value}` + (tip[p.name] ? '<br>' + Object.entries(tip[p.name]).map(([k, v]) => `${k} ${v}`).join(' · ') : ''),
        }),
        series: [{
          type: 'sankey', left: 196, right: 236, top: 8, bottom: 8, nodeWidth: 18, nodeGap: 16, layoutIterations: 0, draggable: false,
          emphasis: { focus: 'adjacency' }, data: nodes, links,
          lineStyle: { color: 'target', opacity: 0.3, curveness: 0.5 },
          label: { color: t.ink, fontSize: 14, fontWeight: 600, formatter: p => `${p.name}  {v|${p.value}}`, rich: { v: { fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 16, color: t.ink } } },
        }],
      });
    });
  }

  function ring(share, num, den, colorVar, name) {
    const R = 100, C = 2 * Math.PI * R;
    return `<div class="ring"><svg viewBox="0 0 250 250" role="img" aria-label="${name}: ${S.pct(share)}, ${num} of ${den}">
        <circle class="bg" cx="125" cy="125" r="${R}" stroke-width="22"/>
        <circle class="fg" cx="125" cy="125" r="${R}" stroke-width="22" style="stroke:var(${colorVar})" stroke-dasharray="${(C * share).toFixed(1)} ${C.toFixed(1)}"/>
        <text class="pct" x="125" y="122" text-anchor="middle" dominant-baseline="middle">${S.pct(share)}</text>
        <text class="of" x="125" y="160" text-anchor="middle">${S.int(num)} of ${S.int(den)}</text>
      </svg><span class="name"><i style="background:var(${colorVar})"></i>${name}</span></div>`;
  }


  /* 2.2 who is still waiting: every signed-up client in one stage (status first), with the two answers as brackets */
  function waiting(main, D, ch) {
    const w = D.outcomes.waiting, st = w.stages, N = w.denominator, P = w.purchased, ex = w.excluding_refunded;
    const pc = n => S.pct(n / N);
    const SEG = [
      { k: 'purchased', n: st.purchased, label: 'Completed purchase', c: 'var(--closed)', sub: `CLOSED or post-close · ${S.int(P.no_uc_date)} without a UC date`, status: 'CLOSED, Photography Shared, Listed, Content Pulled; Under Contract or Passed Inspection with a closing date on or before the data date', group: 'Active' },
      { k: 'under_contract', n: st.under_contract, label: 'Under contract', c: 'var(--uc)', sub: `not yet closed · ${S.int(w.under_contract.scheduled)} closings scheduled`, status: 'Under Contract, Passed Inspection (no completed closing)', group: 'Active' },
      { k: 'hunting', n: st.hunting, label: 'Hunting', c: 'var(--wait)', sub: 'Client Start to 8 Weeks', status: 'Client Start, 2 / 4 / 6 / 8 Weeks', group: 'Active' },
      { k: 'paused', n: st.paused, label: 'Paused', c: 'var(--paused)', sub: 'part of Inactive', status: 'Paused', group: 'Inactive' },
      { k: 'additional', n: st.additional, label: 'Additional Service', c: 'var(--hold-2)', sub: 'part of Inactive', status: 'Additional Service', group: 'Inactive', lt: true },
      { k: 'refunded', n: st.refunded, label: 'Refunded', c: 'var(--hold)', cls: 'hatch-hold', sub: 'part of Inactive · left without a property', status: 'Refunded', group: 'Inactive', lt: true },
    ];
    const noC = new Set(['hunting', 'paused', 'additional', 'refunded']), yet = new Set([...noC, 'under_contract']);
    const body = S.scene(main, { ch, step: 2, of: 3, label: 'Who is still waiting',
      title: `${S.int(w.yet_to_close.n)} of ${S.int(N)} signed-up clients have yet to close; ${S.int(w.no_contract.n)} have no valid contract or completed purchase` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num">${S.int(w.no_contract.n)}<span class="of">${pc(w.no_contract.n)}</span></span><span class="l"><i style="background:var(--wait)"></i>no valid contract or completed purchase: hunting, paused, Additional Service or refunded</span></div>
        <div class="fig"><span class="v num">${S.int(w.yet_to_close.n)}<span class="of">${pc(w.yet_to_close.n)}</span></span><span class="l"><i style="background:var(--uc)"></i>yet to close, including ${S.int(st.under_contract)} already under contract</span></div>
        <div class="fig"><span class="v num">${S.int(N)}</span><span class="l"><i style="background:var(--ink-2)"></i>signed-up clients: the denominator for every share here ${S.ui.chip('rec')}</span></div>
      </div>
      <div class="board" id="waitBoard">
        <div class="ptools"><div class="pl"><span class="vt-l">Jira, ${S.date(D.meta.asof)} snapshot</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart">
          ${S.ui.stack(SEG, [
            { from: 'under_contract', to: 'refunded', text: `Yet to close · ${S.int(w.yet_to_close.n)}`, sub: pc(w.yet_to_close.n), lvl: 1 },
            { from: 'hunting', to: 'refunded', text: `No valid contract or completed purchase · ${S.int(w.no_contract.n)}`, sub: pc(w.no_contract.n), lvl: 0, ar: true },
            { from: 'purchased', to: 'hunting', text: `Active · ${S.int(w.snapshot.active)}`, dn: true },
            { from: 'paused', to: 'refunded', text: `Inactive · ${S.int(w.snapshot.inactive)}`, sub: 'Paused + Additional Service + Refunded', dn: true, ar: true },
          ], `${N} signed-up clients: ${SEG.map(s => `${s.label} ${s.n}`).join(', ')}. Yet to close ${w.yet_to_close.n}; no valid contract or completed purchase ${w.no_contract.n}; Inactive ${w.snapshot.inactive}.`)}
          ${S.ui.keys(SEG.map(s => ({ n: s.n, of: pc(s.n), label: s.label, sub: s.sub, c: s.cls ? 'repeating-linear-gradient(135deg,var(--hold) 0 4px,var(--hold-2) 4px 8px)' : s.c })))}
        </div>
        <div class="pv-table tw" id="waitTable"></div>
      </div>
      ${S.ui.ex('How are these numbers built?', [
        `<p class="ex-h">Denominator</p><p><b>${S.int(N)}</b> signed-up clients: Jira issues with the reporting layer's signed-up flag on ${S.date(D.meta.asof)}. One per search, so a client with two searches counts twice. Prospects (New Clients, Onboarding Completed, Services Declined) are not in it.</p>
         <p class="ex-h">One stage per client, by current status</p><p><b>Completed purchase</b> = CLOSED or a post-close status (${S.int(P.post_close_status)}), or Under Contract / Passed Inspection with a closing date on or before the data date (${S.int(P.uc_status_closing_recorded)}). ${S.int(P.no_uc_date)} purchases have no Under Contract date recorded; they still count as purchases. ${S.int(P.status_only)} post-close records have no closing date and count by their status.</p>
         <p><b>Under contract</b> = Under Contract or Passed Inspection without a completed closing (${S.int(st.under_contract)}, of which ${S.int(w.under_contract.scheduled)} have a closing dated after the data date).</p>`,
        `<p class="ex-h">The two answers</p><p><b>No valid contract or completed purchase</b> = Hunting ${S.int(st.hunting)} + Paused ${S.int(st.paused)} + Additional Service ${S.int(st.additional)} + Refunded ${S.int(st.refunded)} = <b>${S.int(w.no_contract.n)}</b> (${pc(w.no_contract.n)}).</p>
         <p><b>Yet to close</b> = that + Under contract ${S.int(st.under_contract)} = <b>${S.int(w.yet_to_close.n)}</b> (${pc(w.yet_to_close.n)}). Leaving out refunded clients, who left without a property: ${S.int(ex.no_contract)} (${S.pct(ex.no_contract_share)}) and ${S.int(ex.yet_to_close)} (${S.pct(ex.yet_share)}).</p>
         <p class="ex-h">Snapshot counts</p><p>Hunting ${S.int(w.snapshot.hunting)}, Paused ${S.int(w.snapshot.paused)}, Inactive ${S.int(w.snapshot.inactive)} = Paused + Additional Service ${S.int(w.snapshot.additional)} + Refunded ${S.int(w.snapshot.refunded)}. ${S.int(w.hunting_with_older_uc_date)} hunting clients still carry an older Under Contract date: that contract no longer stands, so they count as hunting. ${S.int(w.moved_back_with_closing_date.n)} clients have a closing date but their status moved back afterwards (${Object.entries(w.moved_back_with_closing_date.statuses).map(([k, v]) => `${k} ${v}`).join(', ')}): they count by status.</p>`,
      ])}
      <p class="cap">Jira, one row per search, by status on ${S.date(D.meta.asof)} · shares of the ${S.int(N)} signed-up clients · Active includes clients who already bought.</p>`;
    const board = S.$('#waitBoard', body);
    S.ui.table(S.$('#waitTable', body), [
      { k: 'label', label: 'Stage', html: r => `<span class="sw" style="background:${r.c}"></span>${r.label}<small>${r.status}</small>` },
      { k: 'n', label: 'Clients', num: true, html: r => S.int(r.n) },
      { k: 'share', label: `% of ${S.int(N)}`, num: true, sv: r => r.n, html: r => pc(r.n) },
      { k: 'group', label: 'Active / Inactive' },
      { k: 'noC', label: 'No valid contract or purchase', html: r => (noC.has(r.k) ? '✓' : ''), sort: false },
      { k: 'yet', label: 'Yet to close', html: r => (yet.has(r.k) ? '✓' : ''), sort: false },
    ], SEG.map(s => Object.assign({}, s, { c: s.cls ? 'repeating-linear-gradient(135deg,var(--hold) 0 2px,var(--hold-2) 2px 4px)' : s.c })), {
      caption: 'Signed-up clients by stage', sortable: false,
      total: [
        { label: '<b>No valid contract or completed purchase</b><small>Hunting + Paused + Additional Service + Refunded</small>', n: w.no_contract.n, group: '', status: '' },
        { label: '<b>Yet to close</b><small>the above + under contract</small>', n: w.yet_to_close.n, group: '', status: '' },
        { label: '<b>Inactive</b><small>Paused + Additional Service + Refunded</small>', n: w.snapshot.inactive, group: '', status: '' },
        { label: '<b>Still waiting, refunded clients left out</b><small>no contract · yet to close</small>', n: ex.no_contract, n2: ex.yet_to_close, group: '', status: '' },
        { label: '<b>Signed-up clients</b>', n: N, group: '', status: '' },
      ].map(t => Object.assign(t, { c: 'transparent' })),
    });
    // the total rows reuse the cell renderers; fix the extra column for the refunded-out row
    const last = board.querySelectorAll('tfoot tr');
    if (last[3]) { last[3].children[1].textContent = `${S.int(ex.no_contract)} · ${S.int(ex.yet_to_close)}`; last[3].children[2].textContent = `${S.pct(ex.no_contract_share)} · ${S.pct(ex.yet_share)}`; }
    S.ui.wire(board);
  }

  S.chapter('outcomes', {
    n: 2, title: 'Where are our clients today?',
    render(main, D, ch) {
      const oc = D.outcomes, at = oc.attainment, g = Object.fromEntries(oc.active_groups.map(x => [x.group, x.n]));
      const closedOrPost = g['Closed'] + g['Post-close'];

      let body = S.scene(main, { ch, step: 1, of: 3, label: 'Who they are, where they are now', title: `${S.int(oc.active)} Active clients, but only ${S.int(g['Hunting'])} are hunting for a property` });
      body.innerHTML = `<div class="figs">
          <div class="fig"><span class="v num">${S.int(oc.active)}</span><span class="l"><i style="background:var(--acq)"></i>Active, of ${S.int(oc.signed)} signed-up</span></div>
          <div class="fig"><span class="v num">${S.int(g['Hunting'])}</span><span class="l"><i style="background:var(--wait)"></i>hunting (still searching)</span></div>
          <div class="fig"><span class="v num">${S.int(closedOrPost)}</span><span class="l"><i style="background:var(--closed)"></i>Active and already CLOSED or post-close</span></div>
        </div>
        <div class="board"><div class="chart h-xl" id="sankeyChart" role="img" aria-label="${oc.signed} signed-up clients: ${oc.active} Active (${g['Hunting']} hunting, ${g['Under contract']} under contract or inspection, ${g['Closed']} CLOSED, ${g['Post-close']} post-close) and ${oc.inactive} Inactive."></div></div>
        <p class="cap">Jira clients by the reporting-layer flags. Active includes clients who have already closed and are in post-close services; hunting = Active clients still searching (Client Start to 8 Weeks).</p>`;
      sankey(S.$('#sankeyChart', body), oc);

      waiting(main, D, ch);

      body = S.scene(main, { ch, step: 3, of: 3, label: 'Milestones reached', title: `${S.pct(at.uc_share)} of Active clients have recorded Under Contract, ${S.pct(at.closed_share)} CLOSED` });
      body.innerHTML = `<div class="board"><div class="rings">
          ${ring(at.uc_share, at.uc, at.active, '--uc', 'Under Contract recorded')}
          ${ring(at.closed_share, at.closed, at.active, '--closed', 'CLOSED recorded')}
        </div></div>
        <p class="cap">Historical attainment of today's ${S.int(at.active)} Active clients, not a lifetime conversion rate. Under Contract = latest valid contract; ${S.int(at.closed_scheduled)} closings dated after the data date are not counted.</p>`;
    },
  });
})();
