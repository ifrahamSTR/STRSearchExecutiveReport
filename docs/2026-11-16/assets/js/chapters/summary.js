/* Executive Summary (L10 update, 18 Nov 2026): written after the chapters, placed after them and before the method note.
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
    const R = D.reconcile.rows, fmt = (r, v) => (v == null ? '–' : r.key === 'net_cash' ? money(v) : r.key === 'budget14' ? `${S.pct(v[0] / v[1], 1)} · ${S.pct(v[2] / v[3], 1)}<small>${v[0]} of ${v[1]} · ${v[2]} of ${v[3]}</small>` : S.med(v));
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
      oct_closed: r => `daily_client_activity (won deals) in both; Jira issues with an October closing date: ${S.int(b(r).jira_issues)} (issue grain).`,
      oct_sales: r => `Pipedrive won date in both. The Explorer's Sales funnel applies Pipedrive's duplicate filter: ${Object.entries(b(r).funnel_months_differ).map(([m, [a, c]]) => `${mon(m)} ${c} not ${a}`).join(', ')}.`,
      uc_median: () => 'Confirmed starts, client start date to the latest valid contract.',
      budget14: () => 'Confirmed starts with a matched onboarding budget; the report runs the Explorer’s own budget code.',
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
    const G = D.pace.goal, bc = G.best.closed.month, L4 = G.last4, cv = G.conversion, W = G.windows.per7;
    const cur = G.months.find(r => r.partial), last = G.months.filter(r => !r.partial).slice(-1)[0];
    const wave = Object.entries(G.best_close_sold.by_sale_month).filter(([m]) => m >= '2026-06' && m <= '2026-08').reduce((a, [, n]) => a + n, 0);
    const st = D.outcomes.waiting.stages, w = D.outcomes.waiting, h = D.outcomes.status.hunting, p = D.outcomes.status.paused, rf = D.outcomes.status.refunded;
    const F = D.pace.first14, sc = F.since_change, r30 = F.rows.filter(r => r.month >= '2026-06' && r.el30);
    const peakRf = rf.by_month.reduce((a, m) => (m.n > a.n ? m : a), { n: -1 });
    const B = D.budgets, BG = Object.fromEntries(B.groups.map(g => [g.label, g])), lo = BG['Up to $250K'], hi = BG['Above $250K'];
    const m14 = B.mh.uc.find(x => x.w === 14), m30 = B.mh.refunded.find(x => x.w === 30);
    const P = Object.fromEntries(B.profile.map(x => [x.label, x]));
    const cg = D.cash.groups.paused, pd = D.cash.defaults.paused_defaults, br = D.reconcile.cash_bridge;
    const gr = D.pace.growth, pr = gr.rows.find(r => r.partial);
    const E = Object.fromEntries(B.experience.map(x => [`${x.experience}|${x.group}`, x]));
    const nce = E['New Client Experience|Up to $250K'], nceHi = E['New Client Experience|Above $250K'];
    const lanes = D.speed.lanes, ye = F.year_end_2025;
    const k = v => '$' + Math.round(v / 1e3) + 'K';
    const card = (o) => `<li class="${o.lead ? 'lead' : ''}" style="--c:var(${o.c})"><div class="sc-h"><span class="sc-t">${o.t}</span></div>
        <div class="sc-k">${o.k.map(([v, l]) => `<span><b class="num">${v}</b><small>${l}</small></span>`).join('')}</div><p>${o.p}</p><a class="sc-go" href="#${o.go}">${o.gl} →</a></li>`;
    const sec = document.createElement('section');
    sec.className = 'scene summary';
    sec.id = 'summary';
    sec.dataset.chapter = 'summary';
    sec.innerHTML = `<div class="stage"><header class="sh"><div class="sh-top"><span class="sh-ch">Executive Summary</span><span class="sh-ct">What the Client Journey says, read together</span><span class="sh-step">data as of ${S.date(D.meta.asof)}</span></div>
        <h2>Closings are at a record, but 100 a month needs about ${S.int(cv.sales_needed)} sales a month and a stronger first two weeks</h2></header>
      <div class="body">
        <p class="sum-lead">October brought a record <b>${bc.n} closings</b>, the June sales surge arriving at the closing table. The goal of <b>100 a month</b> is still well ahead: at the conversion we record, it needs about <b>${S.int(cv.sales_needed)} sales a month</b>, and sales have slowed since ${mon(G.best.sales.month.at)}. Meanwhile ${S.int(st.hunting)} clients are hunting, and in their first 14 days as many new clients are refunded as go under contract. Clients up to $250K move as fast as those above; they refund more often early.</p>
        <ol class="sum-cards">
          ${card({ lead: true, c: '--closed', t: `Closings reached ${bc.n} in ${mon(bc.at)}, ${S.pct(bc.n / G.goal_per_month)} of the 100-a-month goal; no month has reached it yet`,
            k: [[bc.n, `closings in ${mon(bc.at)}, the best month`], [f1(L4.closed_per7), `closings a week over the last four full weeks (${dShort(L4.from)}–${dShort(L4.to)}); the goal needs ${f1(G.benchmark_per7)}`], [`≈${S.int(cv.sales_needed)}`, `sales a month needed at today's conversion; best so far ${G.best.sales.month.n} (${mon(G.best.sales.month.at)})`], [`≈${S.int(cv.uc_needed)}`, `contracts a month needed; best so far ${G.best.uc.month.n}`]],
            p: `${G.weeks_at_benchmark.closed ? `One week (${dShort(G.best.closed.week.at)}) reached the weekly rate of ${f1(G.benchmark_per7)} closings. ` : ''}Of deals won from January 2025 to March 2026, <b>${S.pct(cv.won_close)}</b> have closed, and <b>${S.pct(cv.uc_close)}</b> of contracts close, so 100 closings a month needs about ${S.int(cv.sales_needed)} sales and ${S.int(cv.uc_needed)} contracts a month at steady state. The binding constraint is sales volume, not the time a search takes.`, go: 'pace-1', gl: '3.1 How close to 100 a month' })}
          ${card({ c: '--sales', t: `The June sales surge has reached closings; sales have cooled since ${mon(G.best.sales.month.at)}`,
            k: [[`${f1(W.before.sales)} → ${f1(W.surge.sales)}`, 'sales per 7 days, April–May → June–September'], [f1(cur ? cur.sales_per7 : last.sales_per7), cur ? `so far in ${mon(cur.month)} (1–${cur.days}), ${cur.sales} sales` : '']],
            p: `${wave} of ${mon(bc.at)}'s ${bc.n} closings were sold in June–August. Sales slipped to ${f1(last.sales_per7)} per 7 days in ${mon(last.month)}${cur ? ` and ${f1(cur.sales_per7)} so far in ${mon(cur.month)}` : ''}. ${G.prev_year.length === 3 ? `November also dipped last year (${f1(G.prev_year[1].sales_per7)} per 7 days) before December recovered (${f1(G.prev_year[2].sales_per7)}), so part is seasonal, but ` : ''}at a median ${S.int(G.lag.sale_to_close)} days from sale to closing, these are January and February's closings.`, go: 'pace-1', gl: '3.1 The change in pace' })}
          ${card({ c: '--wait', t: `${S.int(st.hunting)} clients are hunting; half have waited ${S.med(h.median)} days or more and ${S.int(h.over90)} over 90`,
            k: [[S.int(st.hunting), 'hunting today'], [S.med(h.median), `median days waited (${S.int(h.with_start)} with a start date)`], [S.int(h.over90), 'waited over 90 days']],
            p: `The pool is young: ${S.int(h.started_last_90)} of the ${S.int(h.with_start)} started in the last 90 days, so waits will lengthen unless contracts keep pace. ${pr && pr.diff < 0 ? `So far in ${mon(pr.month)} contracts are ahead of starts (${pr.uc} vs ${pr.starts}). ` : ''}${S.int(h.no_start)} hunting clients have no start date because no won deal is linked to their Jira issue.`, go: 'outcomes-2', gl: '2.2 How long they have waited' })}
          ${card({ c: '--refund', t: `In the first 14 days, as many new clients are refunded as go under contract`,
            k: [[`${sc.rf14} vs ${sc.uc14}`, `refunded vs under contract within 14 days, of ${S.int(sc.el14)} clients who started June–October`], [`${S.pct(r30[0].rf30 / r30[0].el30)} → ${S.pct(r30[r30.length - 1].rf30 / r30[r30.length - 1].el30)}`, `refunded within 30 days, ${mon(r30[0].month)} → ${mon(r30[r30.length - 1].month)} starters`], [peakRf.n, `refunds recorded in ${mon(peakRf.month)}, the most of any month`]],
            p: `Refunds come a median ${S.int(rf.median_days)} days after the start; ${S.int(rf.from_client_start)} refunded clients never reached their two-week check-in. ${ye && ye.oct25 ? `October 2025 starters also refunded early more often (${ye.oct25.k} of ${ye.oct25.n}, against ${S.pct(ye.rest25.k / ye.rest25.n)} for January–September 2025 starters), so part may be a year-end pattern, but this year's rise is larger and began in September.` : ''} By day 30 contracts pull clearly ahead (${sc.uc30} vs ${sc.rf30}).`, go: 'pace-4', gl: '3.4 The first 14 days' })}
          ${card({ c: '--b-lo', t: `Clients up to $250K are not slower; they refund more often in the first month`,
            k: [[`${S.pct(lo.uc14.k / lo.uc14.eligible, 1)} · ${S.pct(hi.uc14.k / hi.uc14.eligible, 1)}`, 'under contract within 14 days, up to · above $250K'], [`${S.med(lo.uc_to_close.median)} · ${S.med(hi.uc_to_close.median)}`, 'median days from contract to closing'], [`${S.pct(lo.rf30.k / lo.rf30.eligible)} · ${S.pct(hi.rf30.k / hi.rf30.eligible)}`, 'refunded within 30 days']],
            p: `Like for like (same start month, experience and start rule) the 14-day difference is ${pts(m14.diff)} (95% ${pts(m14.lo)} to ${pts(m14.hi)}), and no contract or closing window differs. Refunds within 30 days are ${pts(m30.diff)} (95% ${pts(m30.lo)} to ${pts(m30.hi)}), concentrated in the New Client Experience (${nce.rf30.k} of ${nce.rf30.eligible} vs ${nceHi.rf30.k} of ${nceHi.rf30.eligible}). The budget is real: median purchase ${k(P['Up to $250K'].price.median)} vs ${k(P['Above $250K'].price.median)}.`, go: 'drivers-3', gl: '5.3 Like for like' })}
          ${card({ lead: true, c: '--paused', t: `Paused clients are the largest swing in forecast cash`,
            k: [[S.int(p.n), `paused, a median ${Math.round(p.median_days)} days`], [money(cg.paid), 'paid up front by paused clients'], [money(cg.paid * pd.refund / 100), `of ${money(br.refunds)} projected refunds, at the default ${pd.refund}% refund`]],
            p: `${S.int(p.from.long_search)} paused after eight or more weeks of searching. The Cash Forecast's default (${pd.resume}% resume, ${pd.refund}% refunded, ${pd.remain}% stay paused) puts most projected refunds on these clients; its net forecast is <b>${money(br.net)}</b>. A decision on paused clients moves cash more than any other assumption.`, go: 'outcomes-3', gl: '2.3 Where the others stand' })}
        </ol>
        <div class="sum-two">
          <div class="board"><h3>What changed</h3><ul>
            <li><b>${mon(bc.at)}</b>: record ${bc.n} closings and record ${peakRf.month === bc.at ? `${peakRf.n} refunds` : 'refund volume'}.</li>
            ${cur ? `<li><b>${mon(cur.month)} so far (1–${cur.days})</b>: ${cur.sales} sales (${f1(cur.sales_per7)} per 7 days), ${cur.uc} contracts (${f1(cur.uc_per7)}), ${cur.closed} closings (${f1(cur.closed_per7)}).</li>` : ''}
            <li><b>Early refunds</b> rose from about ${S.pct(r30[0].rf30 / r30[0].el30)} of ${mon(r30[0].month)} starters to ${S.pct(r30[r30.length - 2].rf30 / r30[r30.length - 2].el30)} of ${mon(r30[r30.length - 2].month)} starters within 30 days.</li>
            <li><b>In this edition</b>: hunting waits use every hunting client with a start date (${S.int(h.with_start)} of ${S.int(h.n)}); the old chapter-4 lanes (${S.int(lanes.searching.n)} hunting, ${S.int(lanes.under_contract.n)} under contract, by reporting group) gave way to the status-first counts (${S.int(st.hunting)} and ${S.int(st.under_contract)}) that match the Cash Forecast; budget comparisons use the Explorer's up-to / above $250K split; pace is read against the 100-a-month goal by month and by Sunday–Saturday week.</li>
          </ul></div>
          <div class="board"><h3>For discussion at the L10</h3><ol>
            <li><b>Sales volume.</b> 100 closings a month needs about ${S.int(cv.sales_needed)} sales a month; ${mon(last.month)} had ${last.sales}${cur ? ` and ${mon(cur.month)} ${cur.sales} in ${cur.days} days` : ''}. What is the plan for December and January sales?</li>
            <li><b>The first two weeks.</b> What happens between the sale and day 14: onboarding, the first properties sent? Should each early refund request get a review, starting with New Client Experience clients up to $250K?</li>
            <li><b>Long waits and pauses.</b> ${S.int(h.over90)} clients have hunted 90+ days and ${S.int(p.n)} are paused (${S.int(p.bands.filter(b => b.lo > 180).reduce((a, b) => a + b.n, 0))} for over six months). Re-engage, re-scope or close out, and what does that mean for the paused assumption in the Cash Forecast?</li>
            <li><b>Two data fixes.</b> Link a won deal to the ${S.int(h.no_start)} hunting clients without a start date, and log each property sent with its date so early deal flow can be measured.</li>
          </ol></div>
        </div>
        <div class="board" style="margin-top:16px"><h3 style="margin:0 0 4px;font:650 18px/1.25 var(--f-display)">Shared figures, reconciled</h3>
          <p class="cap" style="margin:0 0 10px">Same snapshot (${S.date(D.meta.asof)}) across the Client Journey, the <a href="${D.meta.source}" target="_blank" rel="noopener">Business Data Explorer</a> and the <a href="cash.html">Cash Forecast</a>. Where a count differs, the unit or the event date differs, and the bridge is stated.</p>
          <div class="tw" id="reconTable"></div></div>
        <div class="links">${S.ui.xl('#budget', 'Explorer: budget performance')}${S.ui.xl('#cohorts?preset=0', 'Explorer: cohort builder')}<a class="xl" href="cash.html">Cash Forecast →</a><a class="xl" href="#top">Back to the start ↑</a></div>
      </div></div>`;
    main.append(sec);
    reconTable(S.$('#reconTable', sec), D);
  };
})();
