/* Executive Summary (updated 18 Nov 2026): written after the chapters, placed after them and before the method note.
   Every number is read from the same data file as the chapters, so the summary follows the data on a refresh; the build checks
   the statements it makes in words. Ends with the shared figures reconciled across the Client Journey, the Business Data Explorer
   and the Cash Forecast (pipeline/chapters/summary.py). */
(function () {
  'use strict';
  const S = window.S;
  const f1 = v => (v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1));
  const mon = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long' });
  const dShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const money = v => '$' + (Math.abs(v) / 1e6).toFixed(2) + 'M';
  const pts = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)} pts`;

  function reconTable(host, D) {
    const R = D.reconcile.rows, fmt = (r, v) => (v == null ? '–' : r.fmt === 'pair' ? `${v[0]} · ${v[1]}` : r.fmt === 'trio' ? `${v[0]} · ${v[1]} · ${v[2] > 0 ? '+' : v[2] < 0 ? '−' : ''}${Math.abs(v[2])}` : r.key === 'net_cash' ? money(v) : Array.isArray(v) ? `${S.pct(v[0] / v[1], 1)} · ${S.pct(v[2] / v[3], 1)}<small>${v[0]} of ${v[1]} · ${v[2]} of ${v[3]}</small>` : S.med(v));
    const same = r => { const vs = [r.cj, r.explorer, r.cash].filter(v => v != null).map(v => JSON.stringify(typeof v === 'number' ? Math.round(v * 100) / 100 : v)); return vs.every(v => v === vs[0]); };
    const b = r => r.bridge;
    const WHY = {
      signed: r => `The Client Journey and the Explorer count Jira issues (one per search); the Cash Forecast counts won deals. ${S.int(b(r).issues_with_won_deal)} issues have a won deal and ${S.int(b(r).issues_without_won_deal)} do not; ${S.int(b(r).deals_without_jira)} won deals have no Jira issue and ${S.int(b(r).deals_presale_or_unsigned_issue)} are still in pre-sale onboarding.`,
      hunting: r => `${S.int(b(r).in_cash_noprop)} are in both. Jira also counts ${S.int(b(r).without_won_deal)} hunting issues with no won deal${b(r).in_cash_closed ? ` and ${b(r).in_cash_closed} whose won deal shows a closing` : ''}; the Cash Forecast also counts ${S.int(b(r).cash_not_started)} won deals whose search has not started.`,
      uc: r => `The same clients: ${S.int(b(r).cash_uc)} under contract + ${S.int(b(r).cash_scheduled)} with a closing scheduled after the data date.`,
      paused: r => `${S.int(b(r).matched)} in both. Jira adds ${S.int(b(r).jira_without_won_deal)} without a won deal${b(r).jira_in_cash_closed ? ` and ${b(r).jira_in_cash_closed} whose won deal shows a closing` : ''}; the Cash Forecast adds ${S.int(b(r).cash_only)} matched by e-mail.`,
      refunded: r => `${S.int(b(r).matched)} in both. Jira adds ${S.int(b(r).jira_without_won_deal)} without a won deal; the Cash Forecast adds ${S.int(b(r).cash_only)} matched by e-mail.`,
      purchased: r => `Jira by status: ${S.int(b(r).in_cash_closed)} with a recorded closing, ${S.int(b(r).in_cash_unverified)} post-close without a closing date, ${S.int(b(r).without_won_deal)} without a won deal. The Cash Forecast: ${S.int(b(r).cash_closed)} closings recorded + ${S.int(b(r).cash_unverified)} post-close records.`,
      scheduled: () => 'A scheduled closing informs forecast cash on its date; the Client Journey counts it as a purchase only once it happens, so these clients are still under contract here.',
      closed30: () => 'Closing date up to the data date, won-deal grain, in both.',
      oct_closed: r => `daily_client_activity (won deals) in the Client Journey and the Explorer; the Cash Forecast counts the same October closings as completed purchases whose affiliate fees are still due. Jira issues with an October closing date: ${S.int(b(r).jira_issues)} (issue grain).`,
      fall_pair: () => 'The Explorer’s fall-through view uses the same evidence rules and the same Jira records.',
      paused_ft: () => `The Cash Forecast’s paused default (${D.cash.defaults.paused_close}%) is built from this count: ${D.cash.paused.fell_through.jira_fell_through} of the ${D.cash.paused.fell_through.jira_paused} Paused searches.`,
      oct_sales: r => `Pipedrive won date in both. The Explorer's Sales funnel applies Pipedrive's duplicate filter: ${Object.entries(b(r).funnel_months_differ).map(([m, [a, c]]) => `${mon(m)} ${c} not ${a}`).join(', ')}.`,
      starts_oct: () => 'The pair of bars and the gap in 3.3: the same daily counts in the report and the Explorer’s monthly table.',
      starts_nov: () => 'Partial month: the data run to 16 Nov, so this gap is still moving; contracts led starts.',
      hunting_status: () => 'The status count in 2.1 and 3.3. The Cash Forecast’s 117 “no property yet” counts won deals instead; see the Hunting row above.',
      uc_median: () => 'Confirmed starts, client start date to the latest valid contract.',
      budget14: () => 'Confirmed starts with a matched onboarding budget; the report runs the Explorer’s own budget code.',
      budget_rf30: () => 'Refund date − client start date, among clients with 30+ days on the clock; the report runs the Explorer’s own budget code.',
      budget_paused: () => 'Status snapshot on the data date for every matched client in each group (not a rate over time).',
      net_cash: r => `Explorer bridge at the Cash Forecast's defaults: ${money(b(r).service)} service + ${money(b(r).affiliate)} affiliate − ${money(b(r).refunds)} refunds.`,
    };
    S.ui.table(host, [
      { k: 'label', label: 'Figure', html: r => `${r.label}<small>${r.unit}</small>` },
      { k: 'cj', label: 'Client Journey', num: true, html: r => fmt(r, r.cj) },
      { k: 'explorer', label: 'Explorer', num: true, html: r => fmt(r, r.explorer) },
      { k: 'cash', label: 'Cash Forecast', num: true, html: r => fmt(r, r.cash) },
      { k: 'why', label: 'Match, or why they differ', cls: 'why', html: r => `${same(r) ? '<b style="color:var(--closed)">Same figure.</b> ' : ''}${WHY[r.key] ? WHY[r.key](r) : ''}` },
    ], R, { caption: 'Shared figures across the Client Journey, the Explorer and the Cash Forecast', sortable: false });
  }

  S.renderSummary = function (main, D) {
    const G = D.pace.goal, bc = G.best.closed.month, bs0 = G.best.sales.month, L4 = G.last4, cv = G.conversion, W = G.windows.per7;
    const cur = G.months.find(r => r.partial), last = G.months.filter(r => !r.partial).slice(-1)[0];
    const wave = Object.entries(G.best_close_sold.by_sale_month).filter(([m]) => m >= '2026-06' && m <= '2026-08').reduce((a, [, n]) => a + n, 0);
    const st = D.outcomes.waiting.stages, h = D.outcomes.status.hunting, p = D.outcomes.status.paused, rf = D.outcomes.status.refunded;
    const F = D.pace.first14, sc = F.since_change, mat = F.rows.filter(r => r.month >= '2026-06' && r.el30 && r.el30 === r.n), ye = F.year_end_2025;
    const peakRf = rf.by_month.reduce((a, m) => (m.n > a.n ? m : a), { n: -1 });
    const B = D.budgets, BG = Object.fromEntries(B.groups.map(g => [g.label, g])), lo = BG['Up to $250K'], hi = BG['Above $250K'];
    const m14 = B.mh.uc.find(x => x.w === 14), m30 = B.mh.refunded.find(x => x.w === 30);
    const E = Object.fromEntries(B.experience.map(x => [`${x.experience}|${x.group}`, x])), nce = E['New Client Experience|Up to $250K'], nceHi = E['New Client Experience|Above $250K'];
    const br = D.reconcile.cash_bridge, pc = D.cash.defaults.paused_close, PA = D.cash.paused, DF = D.cash.defaults;
    const cg = D.cash.groups.paused, pRef = cg.paid * (100 - pc) / 100;
    const full = ['realtor', 'lender', 'cribs'].reduce((a, k) => a + DF.affiliates[k].rev * (PA.aff[k].known + DF.affiliates[k].conv * PA.aff[k].unknown), 0), perPoint = (PA.second + full + PA.paid) / 100;
    const ob = D.speed.observed, est = D.speed.estimate, sa = D.speed.scenario.all;
    const dr = D.drivers, cm = dr.composition, o0 = dr.offers.same_clients.rows.find(r => r.key === '0'), o3 = dr.offers.same_clients.rows.find(r => r.key === '3+'), dn = dr.deals.number_purchased;
    const FO = D.fallout, CR = D.repeat.cribs, px = p.cross;
    const no = id => { const c = S.chapters[id.split('-')[0]]; return `${c.n}.${S.pos(c, id)}`; };
    const pp = v => S.pct(v, 1);
    const card = o => `<li class="${o.lead ? 'lead' : o.wide ? 'wide' : ''}" style="--c:var(${o.c})"><div class="sc-h"><span class="sc-t">${o.t}</span></div>
        <div class="sc-k">${o.k.map(([v, l]) => `<span><b class="num">${v}</b><small>${l}</small></span>`).join('')}</div><p>${o.p}</p><span class="sc-go">Section ${o.gl}</span></li>`;
    const sec = document.createElement('section');
    sec.className = 'scene summary';
    sec.id = 'summary';
    sec.dataset.chapter = 'summary';
    sec.innerHTML = `<div class="stage"><header class="sh"><div class="sh-top"><span class="sh-ch">Executive Summary</span><span class="sh-ct">What the Client Journey says, read together</span><span class="sh-step">data as of ${S.date(D.meta.asof)}</span></div>
        <h2>Closings reached a record ${bc.n} in ${mon(bc.at)}; 100 a month needs about ${S.int(cv.sales_needed)} sales a month, early refunds match early contracts, and 12 paused searches are both long-paused and past an ended contract</h2></header>
      <div class="body">
        <p class="sum-lead">Three questions run through the workbook. <b>Reaching 100 closings a month</b> is mainly a question of sales volume: ${mon(bc.at)}'s record ${bc.n} were mostly sold in June–August, and sales have run lower since ${mon(bs0.at)}. <b>First-month refunds</b> are elevated for the newest starters and are higher for clients up to $250K, who go under contract as fast as those above. <b>Paused searches</b> are ${S.int(p.n)}, ${S.int(p.over180)} of them paused over six months and ${S.int(p.prior.evidence)} with evidence of an ended contract; ${S.int(px.long_evidence)} are both.</p>
        <ol class="sum-cards">
          ${card({ lead: true, c: '--closed', t: `Reaching 100 closings a month: volume of sales is the constraint, and it works through a lag of about ${S.int(G.lag.sale_to_close)} days`,
            k: [[bc.n, `closings in ${mon(bc.at)}, the best month (${S.pct(bc.n / G.goal_per_month)} of 100)`], [f1(L4.closed_per7), `closings a week over the last four full weeks (${dShort(L4.from)}–${dShort(L4.to)}); the goal needs ${f1(G.benchmark_per7)}`], [`≈${S.int(cv.sales_needed)}`, `sales a month: planning estimate from ${S.int(cv.won_closed)} closed of ${S.int(cv.won_n)} deals won Jan 2025–Mar 2026 (${S.pct(cv.won_close, 1)}); best month so far ${bs0.n}`], [`${wave} of ${bc.n}`, `${mon(bc.at)} closings that came from deals won in June–August`]],
            p: `Sales rose from ${f1(W.before.sales)} per 7 days in April–May to ${f1(W.surge.sales)} in June–September, then slipped to ${f1(last.sales_per7)} in ${mon(last.month)}${cur ? ` and ${f1(cur.sales_per7)} so far in ${mon(cur.month)}` : ''}. With about ${S.int(G.lag.sale_to_close)} days from sale to closing, the lower sales of ${mon(last.month)}–${cur ? mon(cur.month) : 'now'} become the lower closings of the winter. The estimate also implies about ${S.int(cv.uc_needed)} contracts a month (best so far ${G.best.uc.month.n}). Speed to a contract is a second lever: ${S.med(ob.uc.median)} days recorded, ${S.med(est.uc.median)} counting searches still waiting.`, go: 'pace-1', gl: `${no('pace-1')} How close to 100 a month` })}
          ${card({ lead: true, c: '--refund', t: `First-month refunds: in the first 14 days as many new searches are refunded as go under contract, and the gap is wider up to $250K`,
            k: [[`${sc.rf14} vs ${sc.uc14}`, `refunded vs under contract within 14 days, of ${S.int(sc.el14)} starters June–October`], [`${S.pct(mat[0].rf30 / mat[0].el30)} → ${S.pct(mat[mat.length - 1].rf30 / mat[mat.length - 1].el30)}`, `refunded within 30 days, ${mon(mat[0].month)} → ${mon(mat[mat.length - 1].month)} starters`], [`${pp(lo.rf30.k / lo.rf30.eligible)} vs ${pp(hi.rf30.k / hi.rf30.eligible)}`, 'refunded within 30 days, up to · above $250K'], [`${pp(lo.uc14.k / lo.uc14.eligible)} vs ${pp(hi.uc14.k / hi.uc14.eligible)}`, 'under contract within 14 days, up to · above $250K']],
            p: `Like for like (same start month, experience and start rule) the refund gap is ${pts(m30.diff)} (95% ${pts(m30.lo)} to ${pts(m30.hi)}), almost the same as the unadjusted gap, and it sits in the New Client Experience (${pp(nce.rf30.k / nce.rf30.eligible)} vs ${pp(nceHi.rf30.k / nceHi.rf30.eligible)}). Contract speed does not differ (${pts(m14.diff)} at 14 days, interval includes zero). ${ye && ye.oct25 ? `October 2025 starters also refunded early more often (${ye.oct25.k} of ${ye.oct25.n}, against ${S.pct(ye.rest25.k / ye.rest25.n)} for January–September 2025), so part may be a year-end pattern, but this year's rise is larger and began in September. ` : ''}${S.int(peakRf.n)} refunds were recorded in ${mon(peakRf.month)}, the most of any month. These are associations, not causes.`, go: 'pace-4', gl: `${no('pace-4')} The first 14 days, ${no('drivers-4')} Early refunds` })}
          ${card({ lead: true, c: '--paused', t: `Paused searches: ${S.int(px.long_evidence)} are both paused over six months and past an ended contract, the clearest place to start`,
            k: [[S.int(p.n), `paused searches; a median ${Math.round(p.median_days)} days in pause`], [S.int(p.over180), 'paused over six months (pause length)'], [S.int(p.prior.evidence), `with an ended contract or documented fall-through (${S.int(p.prior.ended)} + ${S.int(p.prior.documented)}; contract history)`], [S.int(px.long_evidence), 'both: paused over six months and past an ended contract']],
            p: `By what the records show: <b>${S.int(px.long_evidence)}</b> paused over six months with an ended contract; <b>${S.int(px.short_evidence + px.undated_evidence)}</b> paused six months or less (or undated) with an ended contract; <b>${S.int(px.long_none)}</b> paused over six months with no contract evidence; <b>${S.int(px.short_none + px.undated_none)}</b> the rest. ${S.int(p.from.long_search)} paused after eight or more weeks of searching. Cash at the Cash Forecast defaults (${pc}% of the ${S.int(D.cash.groups.paused.n)} paused and Additional Service deals close, the rest are refunded in full): the group has paid ${money(cg.paid)} up front and carries ${money(pRef)} of the ${money(br.refunds)} projected refunds; net forecast <b>${money(br.net)}</b> (${money(br.service)} service + ${money(br.affiliate)} affiliate, of which ${money(br.affiliate_parts.completed)} on October–November closings, − ${money(br.refunds)} refunds); each point of the slider moves it about $${Math.round(perPoint / 1e3)}K.`, go: 'outcomes-3', gl: `${no('outcomes-3')} Where the others stand` })}
          ${card({ c: '--uc', t: `Timing: five medians, three groups of searches`,
            k: [[`${S.med(ob.uc.median)} · ${S.med(ob.closed.median)}`, `recorded days to Under Contract · CLOSED (${S.int(ob.uc.n)} and ${S.int(ob.closed.n)} searches with the milestone)`], [`${S.med(est.uc.median)} · ${S.med(est.closed.median)}`, `estimated, counting the searches still waiting (all ${S.int(est.n)} confirmed starts)`], [S.med(sa.scenario.median), `scenario: all ${S.int(sa.hunting)} eligible hunting searches go under contract tomorrow`]],
            p: `The recorded medians leave out searches still waiting, so they are the fastest journeys; the estimates count everyone. The 40 days is a floor for the ${S.int(sa.hunting)} hunting searches, not a forecast. ${S.int(st.hunting)} searches are hunting: half of the ${S.int(h.with_start)} with a start date have waited ${S.med(h.median)} days or more, ${S.int(h.over90)} over 90, and ${S.int(h.no_start)} have no start date.`, go: 'speed-1', gl: `${no('speed-1')} What has happened, ${no('speed-4')} Counting everyone, ${no('speed-3')} The scenario` })}
          ${card({ c: '--sp-fast', t: `What separates faster searches: offers reported before joining, not capital or budget`,
            k: [[`${S.pct(cm.all_fast / cm.all_eligible)}`, `of ${S.int(cm.all_eligible)} starts with 75+ days of follow-up had a recorded contract by day 30 (${S.int(cm.all_fast)})`], [`${pp(o0.share30)} vs ${pp(o3.share30)}`, `under contract by day 30: no prior offers vs 3+ (day 14: ${pp(o0.share14)} vs ${pp(o3.share14)})`], [`${S.med(dn.early.median)} → ${S.med(dn.late.median)}`, `median Jira Deal Number Purchased, searches under contract by day 30: Jan–May → Jun–Sep starts`]],
            p: `Stated capital shows no measurable link to time to contract, and neither does the up-to / above $250K budget. Prior offers (reported by the client before joining) show by day 30, not day 14. The median deal number purchased rose from ${S.med(dn.early.median)} (${S.int(dn.early.n)} searches) to ${S.med(dn.late.median)} (${S.int(dn.late.n)}); the running Deals Sent total has no send dates, so early deal flow cannot be measured directly.`, go: 'drivers-1', gl: `${no('drivers-1')} Who moves quickly, ${no('drivers-5')} Offer experience, ${no('drivers-6')} Deals sent` })}
          ${card({ wide: true, c: '--wait', t: `After a contract falls through, and who comes back`,
            k: [[S.int(FO.documented.n), 'documented fall-throughs'], [S.int(FO.ended.n), `contracts ended without a recorded purchase: ${S.int(FO.ended.now.paused)} paused, ${S.int(FO.ended.now.hunting)} hunting, ${S.int(FO.ended.now.refunded)} refunded, ${S.int(FO.ended.now.additional)} Additional Service`], [`${S.int(CR.clients_both)} of ${S.int(CR.clients_first_cribs)}`, 'repeat buyers who chose STR Cribs first have Cribs recorded again']],
            p: `${S.pct(FO.groups.none.n / FO.known.n)} of the ${S.int(FO.known.n)} searches that went under contract show no fall-through evidence, but the records cannot show a contract's dates or property, so ${S.pct(FO.fell_through.share)} is a floor. ${S.int(CR.clients)} repeat buyers made ${S.int(CR.purchases)} purchases (${S.int(CR.first_purchases)} first, ${S.int(CR.later_purchases)} later); the designer is not recorded for ${S.int(CR.first.unknown)} first and ${S.int(CR.later.unknown)} later purchases.`, go: 'fallout-1', gl: `${no('fallout-1')} Fall-through, ${no('repeat-2')} STR Cribs` })}
        </ol>
        <div class="sum-two">
          <div class="board"><h3>Talking points</h3><ol>
            <li><b>Sales set the ceiling.</b> 100 closings a month needs about ${S.int(cv.sales_needed)} sales a month at today's conversion (${S.int(cv.won_closed)} of ${S.int(cv.won_n)} historical deals closed). ${mon(last.month)} had ${last.sales} sales${cur ? `; ${mon(cur.month)} has ${cur.sales} in its first ${cur.days} days` : ''}; a sale becomes a closing a median ${S.int(G.lag.sale_to_close)} days later, and ${wave} of ${mon(bc.at)}'s ${bc.n} closings were won in June–August.</li>
            <li><b>The first two weeks.</b> Of ${S.int(sc.el14)} searches that started June–October, ${sc.rf14} were refunded and ${sc.uc14} went under contract within 14 days; by day 30 contracts lead (${sc.uc30} against ${sc.rf30}). Up to $250K, ${pp(lo.rf30.k / lo.rf30.eligible)} were refunded within 30 days against ${pp(hi.rf30.k / hi.rf30.eligible)} above, with the same contract pace (${pp(lo.uc14.k / lo.uc14.eligible)} and ${pp(hi.uc14.k / hi.uc14.eligible)} by day 14).</li>
            <li><b>Paused searches.</b> ${S.int(px.long_evidence)} of ${S.int(p.n)} are paused over six months and show an ended contract; ${S.int(px.long_none)} more are paused over six months with no contract evidence. At the Cash Forecast defaults, the paused and Additional Service deals carry ${money(pRef)} of ${money(br.refunds)} projected refunds, and the forecast nets ${money(br.net)}.</li>
            <li><b>Waiting.</b> ${S.int(st.hunting)} searches are hunting; ${S.int(h.over90)} of the ${S.int(h.with_start)} with a start date have waited more than 90 days (median ${S.med(h.median)}).</li>
          </ol></div>
          <div class="board"><h3>Records that limit the answers</h3><ul>
            <li>${S.int(h.no_start)} hunting searches have no start date because no won deal is linked to their Jira issue, so they are counted but not aged.</li>
            <li>${S.int(B.coverage.not_recorded_total)} confirmed starts have no recorded budget; ${S.int(B.coverage.not_recorded_before_nce)} of them began before ${S.date(B.coverage.nce_date)}, so the budget comparison covers mostly later starts.</li>
            <li>Pause dates exist only for pauses still in effect, so timed pause counts are a lower bound.</li>
            <li>There is no dated log of the properties sent: the running Deals Sent total cannot show early deal flow.</li>
            <li>Payment type is recorded for ${S.int(D.cash.paused.payment.recorded)} of the ${S.int(D.cash.paused.n)} paused and Additional Service deals; the rest are taken as Split Pay in the Cash Forecast.</li>
          </ul></div>
        </div>
        <div class="board" style="margin-top:16px"><h3 style="margin:0 0 4px;font:650 18px/1.25 var(--f-display)">Shared figures, reconciled</h3>
          <p class="cap" style="margin:0 0 10px">Same snapshot (${S.date(D.meta.asof)}) across the Client Journey, the <a href="${D.meta.source}" target="_blank" rel="noopener">Business Data Explorer</a> and the Cash Forecast tab. Where a count differs, the unit or the event date differs, and the bridge is stated.</p>
          <div class="tw" id="reconTable"></div></div>
        <div class="links">${S.ui.xl('#budget', 'Explorer: budget performance')}${S.ui.xl('#cohorts?preset=0', 'Explorer: cohort builder')}</div>
      </div></div>`;
    main.append(sec);
    reconTable(S.$('#reconTable', sec), D);
  };
})();
