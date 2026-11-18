/* Chapter 6 (added 18 Nov 2026): what happens after a contract falls through?
   Every client known to have gone under contract sits in one evidence group: a documented fall-out address, a contract
   that ended without a purchase (status), back under contract after returning to the search (status), Under Contract
   entered twice before buying (cannot tell a new contract from a repeated entry), or no sign of a fall-through.
   Then: where the fall-throughs stand today, and what the records would need to show more. */
(function () {
  'use strict';
  const S = window.S;
  const STAGE = { purchased: 'Purchased', under_contract: 'Under contract', hunting: 'Hunting', paused: 'Paused', refunded: 'Refunded', additional: 'Additional Service' };
  const STAGE_C = { purchased: 'var(--closed)', under_contract: 'var(--uc)', hunting: 'var(--wait)', paused: 'var(--paused)', refunded: 'var(--hold)', additional: 'var(--hold-2)' };

  S.chapter('fallout', {
    n: 6, title: 'What happens after a contract falls through?',
    render(main, D, ch) {
      const F = D.fallout, G = F.groups, K = F.known, N = K.n, d = F.documented, e = F.ended, rt = F.returned, ft = F.fell_through;
      const pc = n => S.pct(n / N);
      const GR = [
        { k: 'documented', n: G.documented.n, label: 'Documented fall-through', sub: 'a fall-out address is recorded', c: 'var(--wait)', basis: 'rec', shows: 'Address_Fell_Out_Of_Contract is filled in Jira.' },
        { k: 'ended', n: G.ended.n, label: 'Contract ended, no purchase', sub: 'now hunting, paused, refunded or Additional Service', c: 'var(--wait)', cls: 'hatch-wait', basis: 'inf', shows: 'A contract is on record, but the client has no purchase and is back to a search, paused, refunded or on Additional Service. No fall-out address.' },
        { k: 'returned', n: G.returned.n, label: 'Back under contract after the search', sub: 'new contract; its property is not recorded', c: 'var(--uc)', basis: 'inf', shows: 'Under Contract entered twice, with a search status in between: a new contract after a fall-through.' },
        { k: 'second_entry', n: G.second_entry.n, label: 'Under Contract entered twice, then bought', sub: 'a new contract or the same one entered again', c: 'var(--uc-2)', lt: true, basis: 'rec', shows: 'Only the latest status change is kept, so the records cannot tell a replacement contract from a repeated status entry.' },
        { k: 'none', n: G.none.n, label: 'No fall-through evidence recorded', sub: 'one contract on record, no fall-out address', c: 'var(--grid)', lt: true, text: `No fall-through evidence recorded · ${S.int(G.none.n)} (${S.pct(G.none.n / K.n)})`, basis: 'rec', shows: 'One Under Contract entry and no fall-out address, or a purchase whose contract date is missing.' },
      ];
      const body = S.scene(main, { ch, step: 1, of: 1, label: 'Contracts that fall through',
        title: `${S.int(d.n)} documented fall-throughs and ${S.int(e.n)} ended contracts without a recorded purchase, among ${S.int(N)} searches that went under contract` });
      const EN = ['paused', 'hunting', 'refunded', 'additional'].filter(k => e.now[k]).map(k => ({ k, n: e.now[k], label: STAGE[k], c: STAGE_C[k] }));
      let cum = 0; EN.forEach(x => { x.l = cum / e.n; cum += x.n; x.w = x.n / e.n; });
      body.innerHTML = `<div class="figs qf">
          <div class="fig emph"><span class="v num">${S.int(d.n)}</span><span class="l"><i style="background:var(--wait)"></i><b>documented fall-through</b>: a fall-out address is recorded (${pc(d.n)} of ${S.int(N)}); none records a replacement property ${S.ui.chip('rec')}</span></div>
          <div class="fig emph"><span class="v num">${S.int(e.n)}</span><span class="l"><i class="hatch-wait"></i><b>contract ended, no recorded purchase</b>: a contract on record, and the search is now hunting, paused, refunded or on Additional Service ${S.ui.chip('inf')}</span></div>
          <div class="fig"><span class="v num">${S.pct(ft.share)}<span class="of">${S.int(ft.n)}</span></span><span class="l"><i style="background:var(--uc)"></i>with the ${S.int(rt.n)} back under contract after the search, the searches that fell through by any evidence; ${S.int(ft.without_property)} are still without a property</span></div>
        </div>
        <div class="board" id="foBoard">
          <div class="ptools"><div class="pl"><span class="vt-l">Searches (signed-up Jira records) known to have gone under contract · ${S.int(N)}</span></div><div class="pr">${S.ui.toggle()}</div></div>
          <div class="pv-chart">
            ${S.ui.stack(GR, [
              { from: 'documented', to: 'returned', text: `Fell through, by any evidence · ${S.int(ft.n)}`, sub: S.pct(ft.share), al: true },
            ], `${N} searches known to have gone under contract: ${GR.map(g => `${g.label} ${g.n}`).join(', ')}.`)}
            ${S.ui.keys(GR.map(g => ({ n: g.n, of: pc(g.n), label: g.label, sub: g.sub, c: g.cls ? 'repeating-linear-gradient(135deg,var(--wait) 0 4px,var(--wait-2) 4px 8px)' : g.c })))}
            <div class="fo43" id="fo43" role="img" aria-label="The ${e.n} searches whose contract ended without a recorded purchase, by where they are now: ${EN.map(x => `${x.label} ${x.n}`).join(', ')}.">
              <p class="fo43-h"><span class="duo-v">${S.int(e.n)}</span> ended contracts: where those searches are now <small>zoomed in from the bar above · status on ${S.date(D.meta.asof)}</small></p>
              <div class="fo43-lab top">${EN.slice(0, 3).map(x => `<span style="left:${(x.l * 100).toFixed(2)}%"><b>${x.label}</b> ${x.n}</span>`).join('')}</div>
              <div class="fo43-bar">${EN.map(x => `<i style="flex:${x.n} 1 0;background:${x.c}" title="${x.label}: ${x.n}">${x.n}</i>`).join('')}</div>
              <div class="fo43-lab bot">${EN.slice(3).map(x => `<span class="r" style="right:${((1 - x.l - x.w) * 100).toFixed(2)}%"><b>${x.label}</b> ${x.n}</span>`).join('')}</div>
              <p class="ob-note">None has a new contract yet · ${S.int(e.previous_status_search)} reached their current status from a search status.</p>
            </div>
            <div class="ob-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 32px;margin-top:26px;padding-top:18px;border-top:1px solid var(--line)">
              <div class="ob"><div class="ob-h"><span class="v num">${S.int(d.n)}</span><span class="t">documented: where they are now</span></div>
                ${S.ui.bar('Purchased the same address', d.now.purchased || 0, d.n, STAGE_C.purchased, 'the address that fell out is the one still on record')}
                ${S.ui.bar('Paused', d.now.paused || 0, d.n, STAGE_C.paused)}
                ${S.ui.bar('Hunting', d.now.hunting || 0, d.n, STAGE_C.hunting)}
                ${S.ui.bar('Refunded', d.now.refunded || 0, d.n, STAGE_C.refunded)}
                ${S.ui.bar('Replacement property documented', d.replacement_documented, d.n, STAGE_C.under_contract)}</div>
              <div class="ob"><div class="ob-h"><span class="v num">${S.int(rt.n)}</span><span class="t">back under contract after the search</span></div>
                ${S.ui.bar('Under contract now', rt.now.under_contract || 0, Math.max(rt.n, 1), STAGE_C.under_contract, 'a new contract; the property is not recorded')}
                <p class="ob-note">${S.int(G.second_entry.n)} more entered Under Contract twice and then bought (median ${S.med(F.second_entry.gap_median)} days between the first and latest entry): a replacement or the same contract entered again.</p></div>
            </div>
          </div>
          <div class="pv-table tw" id="foTable"></div>
        </div>
        <p class="miss"><b>What the records cannot show yet:</b> a dated record of each contract and the property it was for. The fall-out field is filled for ${S.int(F.fell_field_filled_all_issues)} Jira issues and in all ${S.int(d.address_on_record)} repeats the address still under contract; the reporting layer keeps only the latest valid Under Contract date; and a second Under Contract entry can be a new contract or the same one entered again. So ${S.pct(ft.share)} is a floor for fall-throughs, and replacements can only be counted from statuses.</p>
        ${S.ui.ex('How is this number built?', [
          `<p class="ex-h">Who counts as having gone under contract</p><p><b>${S.int(N)}</b> signed-up clients with any record of a contract: an Under Contract date or status entry (${S.int(K.uc_record)}), only a fall-out address (${S.int(K.fell_only)}), or a completed purchase with no Under Contract date (${S.int(K.purchase_only)}; a purchase needs a contract).</p>
           <p class="ex-h">Sources</p><p>${F.source}. ${S.int(F.not_in_12nov_extract)} issues opened after 11 Nov are not in the extract. These are the fields of the archived 12 Nov Explorer: fell_out, the Under Contract count and the first / latest Under Contract dates.</p>`,
          `<p class="ex-h">Groups, in this order</p><ul>${GR.map(g => `<li><b>${g.label}</b> (${S.int(g.n)}): ${g.shows}</li>`).join('')}</ul>
           <p class="ex-h">Replacement</p><p>A documented replacement needs a later contract on a different property. In all ${S.int(d.address_on_record)} documented cases the fall-out address is the address still under contract (${S.int(d.purchased_with_closing_date)} with a closing date on it), so none qualifies: the contract was revived, or the field was not cleared. The ${S.int(rt.n)} clients back under contract after the search are new contracts by status only.</p>`,
        ])}
        <p class="cap">Jira, signed-up clients · statuses on ${S.date(D.meta.asof)}, contract history from the 12 Nov extract · shares of the ${S.int(N)} clients known to have gone under contract.</p>`;
      const host = S.$('#foTable', body), now = k => (k === 'documented' ? d.now : k === 'ended' ? e.now : F[k] ? F[k].now : {});
      S.ui.table(host, [
        { k: 'label', label: 'Evidence group', html: r => `<span class="sw" style="background:${r.cls ? 'repeating-linear-gradient(135deg,var(--wait) 0 2px,var(--wait-2) 2px 4px)' : r.c}"></span>${r.label}<small>${r.shows}</small>` },
        { k: 'n', label: 'Searches', num: true, html: r => S.int(r.n) },
        { k: 'share', label: `% of ${S.int(N)}`, num: true, sv: r => r.n, html: r => pc(r.n) },
        ...Object.keys(STAGE).map(s => ({ k: s, label: STAGE[s], num: true, sv: r => now(r.k)[s] || 0, html: r => S.int(now(r.k)[s] || 0) })),
        { k: 'basis', label: 'Basis', sort: false, html: r => S.ui.chip(r.basis) },
      ], GR, {
        caption: 'Clients known to have gone under contract, by fall-through evidence and where they stand today', sortable: false,
        total: [{ label: '<b>Known to have gone under contract</b>', shows: '', n: N, c: 'transparent', k: 'total', basis: 'rec' }],
        notes: `<span>Where they stand today: status on ${S.date(D.meta.asof)} (purchased = CLOSED or post-close, or a closing recorded on a contract).</span>`,
      });
      host.querySelectorAll('tfoot td').forEach((td, i) => { if (i > 2) td.textContent = ''; });
      S.ui.wire(S.$('#foBoard', body));
    },
  });
})();
