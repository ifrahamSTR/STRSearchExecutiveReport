/* Chapter 7 (added 18 Nov 2026): do clients come back for another property?
   7.1 unique repeat clients in Jira (searches and completed purchases) and in Pipedrive (won deals), with the repeat deals
       that have no Jira issue of their own from the Cash Forecast reconciliation (confirmed repeats vs second deals under review).
   7.2 STR Cribs on repeat buyers' first and later purchases: the recorded Jira selection, and the Cribs tracker's projects. */
(function () {
  'use strict';
  const S = window.S;
  const DES = [['cribs', 'STR Cribs', 'var(--acq)'], ['other', 'Other designer', 'var(--hold)'], ['turnkey', 'Bought turnkey', 'var(--hold-2)'], ['unknown', 'Not recorded', 'var(--grid)']];
  const dist = o => Object.entries(o).map(([k, v]) => `${v} with ${k === '2' ? 'two' : k === '3' ? 'three' : k}`).join(', ');

  function repeatScene(main, D, ch) {
    const J = D.repeat.jira, P = D.repeat.pipedrive, nj = P.no_own_jira, c = J.categories, pb = J.pursuing_by_purchase;
    const later = Object.keys(pb).filter(k => +k >= 3).reduce((a, k) => a + pb[k], 0);
    const body = S.scene(main, { ch, step: 1, of: 2, label: 'Repeat clients',
      title: `${S.int(P.repeat_clients)} clients have bought STRSearch more than once; ${S.int(J.two_plus_purchases)} have completed two or more property purchases` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num">${S.int(J.two_plus_purchases)}</span><span class="l"><i style="background:var(--closed)"></i>clients with two or more completed purchases (${dist(J.purchases_dist)}) · Jira ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.int(J.pursuing)}</span><span class="l"><i style="background:var(--wait)"></i>actively pursuing their next purchase: ${Object.entries(pb).map(([k, v]) => `${v} for purchase ${k}`).join(', ')}${later ? '' : ', none for purchase 3 or later'} (${J.pursuing_status.hunting} hunting, ${J.pursuing_status.under_contract} under contract)</span></div>
        <div class="fig"><span class="v num">${S.int(nj.either.clients)}</span><span class="l"><i style="background:var(--sales)"></i>repeat clients with a repeat deal that has no verified Jira issue of its own: ${S.int(nj.either.deals)} deals · Pipedrive ${S.ui.chip('inf')}</span></div>
      </div>
      <div class="board" id="rpBoard">
        <div class="ptools"><div class="pl"><span class="vt-l">Unique clients, not records</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart"><div class="duo">
          <div class="ob"><div class="ob-h"><span class="v num">${S.int(J.multi_clients)}</span><span class="t">Jira: clients with two or more searches</span><span class="s">of ${S.int(J.clients)} clients across ${S.int(J.issues)} signed-up searches</span></div>
            ${S.ui.bar('Two or more completed purchases', c.two_plus + c.two_plus_pursuing, J.multi_clients, 'var(--closed)', dist(J.purchases_dist))}
            ${S.ui.bar('One purchase, pursuing the next', c.one_pursuing, J.multi_clients, 'var(--wait)', `${J.pursuing_status.hunting} hunting, ${J.pursuing_status.under_contract} under contract`)}
            ${S.ui.bar('One purchase, next search paused or refunded', c.one_inactive, J.multi_clients, 'var(--paused)')}
            ${S.ui.bar('Parallel searches, none completed yet', c.none_completed, J.multi_clients, 'var(--hold-2)')}</div>
          <div class="ob"><div class="ob-h"><span class="v num">${S.int(P.repeat_clients)}</span><span class="t">Pipedrive: clients with two or more won deals</span><span class="s">of ${S.int(P.clients)} clients across ${S.int(P.deals)} won deals · ${S.int(P.repeat_client_deals)} deals, ${S.int(P.deals_beyond_first)} beyond each client's first</span></div>
            ${Object.entries(P.won_deals_dist).map(([k, v]) => S.ui.bar(`${k === '2' ? 'Two' : k === '3' ? 'Three' : k} won deals`, v, P.repeat_clients, 'var(--sales)')).join('')}
            ${S.ui.bar('A repeat deal with no Jira issue of its own', nj.either.clients, P.repeat_clients, 'var(--sales)', `${S.int(nj.either.deals)} deals; ${nj.both} client is in both groups below`)}
            ${S.ui.bar('· confirmed repeat purchase', nj.confirmed_repeat.clients, P.repeat_clients, 'var(--sales)', `${nj.confirmed_repeat.deals} deals, ${nj.confirmed_repeat.won_2026} won in 2026`)}
            ${S.ui.bar('· second deal under review', nj.second_deal_review.clients, P.repeat_clients, 'var(--sales)', `${nj.second_deal_review.deals} deals: same client, day and value as another deal`)}</div>
        </div></div>
        <div class="pv-table tw" id="rpTable"></div>
      </div>
      ${S.ui.ex('How are these numbers built?', [
        `<p class="ex-h">One client, many records</p><p><b>Jira:</b> signed-up searches that share a Pipedrive person id or primary e-mail belong to one client (12 Nov extract; the ${J.not_in_12nov_extract} issues opened after 11 Nov count on their own). A completed purchase is a CLOSED or post-close status, or a closing recorded on a contract. <b>Pursuing</b> = a search now hunting or under contract; the purchase it pursues is the client's completed purchases + 1.</p>
         <p><b>Pipedrive:</b> won deals that share an e-mail, a Jira issue or that issue's client. The reporting layer's own repeat_client flag marks ${P.reporting_flag.deals} deals (${P.reporting_flag.in_repeat_clients} of them within these ${P.repeat_clients} clients); it is narrower and not used.</p>`,
        `<p class="ex-h">Repeat deals without their own Jira issue</p><p>From the Cash Forecast reconciliation, unchanged. <b>Confirmed repeat purchase</b> (${nj.confirmed_repeat.deals}): the client's only Jira issue tracks their other won deal. <b>Second deal under review</b> (${nj.second_deal_review.deals}): same client, won date and value as a Jira-linked deal and no engagement of its own, so it may be a second search not yet started or a record entered twice. The two stay separate.</p>
         <p class="ex-h">Why Pipedrive shows more</p><p>Pipedrive counts every won deal; Jira only searches with their own signed-up issue. ${S.int(nj.either.clients)} of the ${S.int(P.repeat_clients)} have a repeat deal without one, and their search status is unknown.</p>`,
      ])}
      <p class="cap">Unique clients · Jira: signed-up searches on ${S.date(D.meta.asof)} · Pipedrive: won deals.</p>`;
    S.ui.table(S.$('#rpTable', body), [
      { k: 'src', label: 'Source' }, { k: 'm', label: 'Measure', html: r => `${r.m}${r.note ? `<small>${r.note}</small>` : ''}` },
      { k: 'n', label: 'Clients', num: true, html: r => S.int(r.n) }, { k: 'r', label: 'Records', num: true, html: r => (r.r == null ? '' : S.int(r.r)) },
      { k: 'b', label: 'Basis', html: r => S.ui.chip(r.b) },
    ], [
      { src: 'Jira', m: 'Unique clients', n: J.clients, r: J.issues, note: 'records = signed-up searches', b: 'rec' },
      { src: 'Jira', m: 'Two or more searches', n: J.multi_clients, r: J.multi_issues, b: 'rec' },
      { src: 'Jira', m: 'Two or more completed purchases', n: J.two_plus_purchases, note: dist(J.purchases_dist), b: 'rec' },
      ...Object.entries(pb).map(([k, v]) => ({ src: 'Jira', m: `Actively pursuing purchase ${k}`, n: v, note: `${J.pursuing_status.hunting} hunting, ${J.pursuing_status.under_contract} under contract`, b: 'rec' })),
      { src: 'Jira', m: 'Actively pursuing purchase 3 or later', n: later, b: 'rec' },
      { src: 'Jira', m: 'One purchase, next search paused or refunded', n: c.one_inactive, b: 'rec' },
      { src: 'Pipedrive', m: 'Unique clients', n: P.clients, r: P.deals, note: 'records = won deals', b: 'inf' },
      { src: 'Pipedrive', m: 'Two or more won deals', n: P.repeat_clients, r: P.repeat_client_deals, note: dist(P.won_deals_dist), b: 'inf' },
      { src: 'Pipedrive', m: 'Repeat deal without its own verified Jira issue', n: nj.either.clients, r: nj.either.deals, note: `${nj.both} client in both groups below`, b: 'inf' },
      { src: 'Pipedrive', m: '· confirmed repeat purchase', n: nj.confirmed_repeat.clients, r: nj.confirmed_repeat.deals, note: `${nj.confirmed_repeat.won_2026} won in 2026`, b: 'inf' },
      { src: 'Pipedrive', m: '· second deal under review', n: nj.second_deal_review.clients, r: nj.second_deal_review.deals, note: `${nj.second_deal_review.won_2026} won in 2026`, b: 'inf' },
    ], { caption: 'Repeat clients in Jira and Pipedrive', sortable: false });
    S.ui.wire(S.$('#rpBoard', body));
  }

  function cribsScene(main, D, ch) {
    const C = D.repeat.cribs, tr = C.tracker_handed_off, ap = C.all_purchases;
    const seg = (o, n) => DES.map(([k, l, c]) => ({ k, n: o[k], label: l, c, lt: k !== 'cribs' && k !== 'other', cls: k === 'unknown' ? 'unk' : '' })).filter(s => s.n);
    const body = S.scene(main, { ch, step: 2, of: 2, label: 'STR Cribs on repeat purchases',
      title: `${S.int(C.clients_later_cribs)} of ${S.int(C.clients)} repeat buyers chose STR Cribs again${C.clients_later_only === 0 ? ', and every one of them had chosen Cribs the first time' : ''}` });
    body.innerHTML = `<div class="figs qf">
        <div class="fig"><span class="v num">${S.int(C.clients_first_cribs)}<span class="of">of ${S.int(C.clients)}</span></span><span class="l"><i style="background:var(--acq)"></i>chose STR Cribs on their first purchase · ${S.int(C.first.unknown)} not recorded ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.int(C.clients_both)}<span class="of">of ${S.int(C.clients)}</span></span><span class="l"><i style="background:var(--acq)"></i>chose STR Cribs both times · ${S.int(C.clients_first_cribs_not_later)} switched to another designer, ${S.int(C.clients_first_cribs_later_unknown)} later choice not recorded ${S.ui.chip('rec')}</span></div>
        <div class="fig"><span class="v num">${S.int(tr.first)}<span class="ar2">·</span>${S.int(tr.later)}</span><span class="l"><i style="background:var(--closed)"></i>Cribs projects handed to a project manager at the purchase address: first purchases · later purchases (Cribs tracker) ${S.ui.chip('inf')}</span></div>
      </div>
      <div class="board" id="crBoard">
        <div class="ptools"><div class="pl"><span class="vt-l">${S.int(C.clients)} clients with two or more completed purchases · ${S.int(C.purchases)} purchases</span></div><div class="pr">${S.ui.toggle()}</div></div>
        <div class="pv-chart">
          <div class="ob-h" style="margin-top:4px"><span class="t">First purchase</span><span class="s">${S.int(C.first_purchases)} purchases · recorded designer choice</span></div>
          ${S.ui.stack(seg(C.first), [], `First purchases: ${DES.map(([k, l]) => `${l} ${C.first[k]}`).join(', ')}`)}
          <div class="ob-h"><span class="t">Later purchases</span><span class="s">${S.int(C.later_purchases)} purchases (second or third) · recorded designer choice</span></div>
          ${S.ui.stack(seg(C.later), [], `Later purchases: ${DES.map(([k, l]) => `${l} ${C.later[k]}`).join(', ')}`)}
          <div class="legend">${DES.map(([k, l, c]) => `<span><i style="background:${c}${k === 'unknown' ? ';box-shadow:inset 0 0 0 1px var(--line-2)' : ''}"></i>${l}</span>`).join('')}</div>
        </div>
        <div class="pv-table tw" id="crTable"></div>
      </div>
      <p class="miss"><b>Selection, not proof of use:</b> Jira's Designer Used field records the client's chosen designer, the same recorded partner choice the Cash Forecast uses. The Cribs tracker confirms a project handed to a Cribs project manager at ${S.int(tr.first)} of the ${S.int(C.first_purchases)} first-purchase addresses but only ${S.int(tr.later)} of the ${S.int(C.later_purchases)} later ones, so most later Cribs selections are not yet confirmed as projects.</p>
      ${S.ui.ex('How are these numbers built?', [
        `<p class="ex-h">Repeat buyers and purchase order</p><p>The ${S.int(C.clients)} Jira clients with two or more completed purchases (previous scene), ${S.int(C.purchases)} purchases ordered by closing date (the client start date where a post-close record has none). <b>Later</b> = the second and third purchases.</p>
         <p class="ex-h">Designer choice (Recorded)</p><p>Jira Designer Used: STR Cribs, Other Designer, Other Designer-Bought Turnkey, or blank (<b>Not recorded</b>, kept as its own group). The field was rarely filled before 2025: blank for ${ap.unknown_by_year['2024'] ? `${ap.unknown_by_year['2024'][0]} of ${ap.unknown_by_year['2024'][1]}` : '–'} purchases in 2024, ${ap.unknown_by_year['2025'] ? `${ap.unknown_by_year['2025'][0]} of ${ap.unknown_by_year['2025'][1]}` : '–'} in 2025 and ${ap.unknown_by_year['2026'] ? `${ap.unknown_by_year['2026'][0]} of ${ap.unknown_by_year['2026'][1]}` : '–'} in 2026. Across all ${S.int(ap.n)} completed purchases, STR Cribs is recorded on ${S.int(ap.cribs)} (${S.pct(ap.cribs / ap.n)}).</p>`,
        `<p class="ex-h">Evidence of use (Inferred)</p><p>Cribs tracker (Cribs_Data, 12 Nov package): a Cribs deal at the purchase address in the stage "Handed off to PM", matched by address. The tracker's own Jira join is not used: it attaches one Cribs deal to over a thousand Jira issues. Any Cribs deal at the address (any stage): ${S.int(C.tracker_any_deal.first)} first, ${S.int(C.tracker_any_deal.later)} later purchases.</p>
         <p class="ex-h">Unknown</p><p>${S.int(C.clients_first_unknown)} clients have no first choice recorded; ${S.int(C.later.unknown)} later purchases have none. Repeat deals without their own Jira issue (previous scene) have no designer field at all.</p>`,
      ])}
      <p class="cap">Jira Designer Used on completed purchases · Cribs tracker matched by property address · ${S.date(D.meta.asof)}.</p>`;
    const row = (lab, o, n, t) => ({ lab, n, cribs: o.cribs, other: o.other, turnkey: o.turnkey, unknown: o.unknown, t });
    S.ui.table(S.$('#crTable', body), [
      { k: 'lab', label: 'Group' }, { k: 'n', label: 'Count', num: true, html: r => S.int(r.n) },
      ...DES.map(([k, l]) => ({ k, label: `${l}${k === 'cribs' ? ' ' + S.ui.chip('rec') : ''}`, num: true, html: r => (r[k] == null ? '' : S.int(r[k])) })),
      { k: 't', label: `Cribs project handed off ${S.ui.chip('inf')}`, num: true, html: r => (r.t == null ? '' : S.int(r.t)) },
    ], [
      { _group: 'Purchases' },
      row('First purchase', C.first, C.first_purchases, tr.first),
      row('Later purchases', C.later, C.later_purchases, tr.later),
      { _group: 'Clients' },
      { lab: 'STR Cribs both times', n: C.clients_both }, { lab: 'STR Cribs first, another designer later', n: C.clients_first_cribs_not_later },
      { lab: 'STR Cribs first, later choice not recorded', n: C.clients_first_cribs_later_unknown }, { lab: 'STR Cribs later only', n: C.clients_later_only },
      { lab: 'First choice not recorded', n: C.clients_first_unknown },
    ], { caption: 'STR Cribs on repeat buyers’ purchases', sortable: false,
      total: [row('All repeat purchases', { cribs: C.first.cribs + C.later.cribs, other: C.first.other + C.later.other, turnkey: C.first.turnkey + C.later.turnkey, unknown: C.first.unknown + C.later.unknown }, C.purchases, tr.first + tr.later)] });
    S.ui.wire(S.$('#crBoard', body));
  }

  S.chapter('repeat', {
    n: 7, title: 'Do clients come back for another property?',
    render(main, D, ch) {
      repeatScene(main, D, ch);
      cribsScene(main, D, ch);
    },
  });
})();
