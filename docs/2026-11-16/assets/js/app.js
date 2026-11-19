/* Boot: opening, chapters (in REPORT order), method note, journey rail, arrow-key stepping, theme. */
(function () {
  'use strict';
  const S = window.S, D = S.data;
  const main = document.getElementById('main');
  const chapters = D.meta.chapters.map(id => S.chapters[id]).filter(Boolean);

  /* the questions the report answers, each with its short answer and the section that answers it (plain text: the outline is the only way to move between chapters) */
  const questions = () => {
    const ph = d => (d > 0 ? `${d} more starts than contracts` : d < 0 ? `${-d} more contracts than starts` : 'as many starts as contracts');
    const mon = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long' });
    const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
    const gr = D.pace.growth, full = gr.rows.filter(r => !r.partial), lf = full[full.length - 1], pr = gr.rows.find(r => r.partial);
    const w = D.outcomes.waiting, st = w.stages, hs = D.outcomes.status.hunting, cp = D.pace.cohorts.clocks.start.pooled, sc = D.speed.scenario.all, J = D.repeat.jira, P = D.repeat.pipedrive, C = D.repeat.cribs, F = D.fallout;
    const G = D.pace.goal, bc = G.best.closed.month, f14 = D.pace.first14.since_change, BG = Object.fromEntries(D.budgets.groups.map(g => [g.label, g])), lo = BG['Up to $250K'], hi = BG['Above $250K'], m14 = D.budgets.mh.uc.find(x => x.w === 14);
    const pz = D.outcomes.status.paused, dr = D.drivers, oc = dr.offers.same_clients.rows, o0 = oc.find(r => r.key === '0'), o3 = oc.find(r => r.key === '3+'), dn = dr.deals.number_purchased, ob = D.speed.observed, es = D.speed.estimate;
    const m30 = D.budgets.mh.refunded.find(x => x.w === 30), sg = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}`, p1 = v => (v * 100).toFixed(1) + '%', r10 = v => Math.round(v / 10) * 10, it = D.pace.windows.intake;
    // the core KPIs come first: deals sold, clients signed up, clients going under contract, how many of those use STR Cribs, how fast they go under contract
    const lastFull = G.months.filter(r => !r.partial).slice(-1)[0], curM = G.months.find(r => r.partial), us = D.repeat.usage;
    const core = [
      ['pace-1', 'Deals sold: how many sales are we making?', `${S.int(D.cash.view.engagements)} won deals in Pipedrive. ${mon(lastFull.month)}: ${S.int(lastFull.sales)} sales (best month ${G.best.sales.month.n}, ${mon(G.best.sales.month.at)})${curM ? `; ${mon(curM.month)} so far: ${S.int(curM.sales)} in ${curM.days} days (${f1(curM.sales_per7)} per 7 days)` : ''}. About ${S.int(G.conversion.sales_needed)} a month are needed for 100 closings.`],
      ['outcomes-1', 'Total clients signed up: how many are there, and where are they?', `${S.int(w.denominator)} searches signed up in Jira (${S.int(D.cash.view.engagements)} won deals in Pipedrive; the Executive Summary reconciles the two): ${S.int(st.purchased)} have bought, ${S.int(st.under_contract)} are under contract, ${S.int(st.hunting)} hunting, ${S.int(st.paused + st.additional + st.refunded)} inactive.`],
      ['pace-2', 'Clients going under contract: how many, and is it keeping up?', `${S.int(st.under_contract)} under contract now. ${mon(lastFull.month)}: ${S.int(lastFull.uc)} new contracts (best month ${G.best.uc.month.n}); ${S.int(D.speed.estimate.events.uc)} searches have ever reached a recorded contract. About ${S.int(G.conversion.uc_needed)} a month are needed for 100 closings.`],
      ['repeat-3', 'Of those, how many use STR Cribs?', `STR Cribs is recorded for ${S.int(us.under_contract.cribs)} of the ${S.int(us.under_contract.n)} searches under contract (${S.pct(us.under_contract.cribs / us.under_contract.n)}; ${S.pct(us.under_contract.cribs / (us.under_contract.n - us.under_contract.unknown))} of those with a designer recorded) and ${S.int(us.purchased.cribs)} of ${S.int(us.purchased.n)} completed purchases (${S.pct(us.purchased.cribs / us.purchased.n)}).`],
      ['speed-1', 'How fast do clients go under contract?', `Median ${S.med(ob.uc.median)} days among searches that got there; ${S.med(es.uc.median)} counting searches still waiting; ${S.med(sc.scenario.median)} if all ${S.int(sc.hunting)} eligible hunting searches went under contract tomorrow. Closing: ${S.med(ob.closed.median)} days recorded.`],
    ];
    const q = [
      ...core,
      ['outcomes-1', 'How many searches are still waiting?', `${S.int(w.no_contract.n)} of ${S.int(w.denominator)} (${S.pct(w.no_contract.share)}) have no current contract or completed purchase: ${S.int(st.hunting)} hunting and ${S.int(st.paused + st.additional + st.refunded)} inactive (Paused ${S.int(st.paused)}, Refunded ${S.int(st.refunded)}, Additional Service ${S.int(st.additional)}); a separate ${S.int(st.under_contract)} are under contract.`],
      ['outcomes-2', 'How long have hunting searches waited?', `Median ${S.med(hs.median)} days; ${S.int(hs.with_start)} of ${S.int(hs.n)} have a start date; ${S.int(hs.over90)} have waited over 90 days; ${S.int(hs.no_start)} have no start date.`],
      ['outcomes-3', 'Which paused searches stand out?', `Of ${S.int(pz.n)} paused, ${S.int(pz.over180)} for over six months and ${S.int(pz.prior.evidence)} with an ended contract or documented fall-through; ${S.int(pz.cross.long_evidence)} are both.`],
      ['pace-5', 'What enters Jira, and what changed on 27 May and 1 June?', `Jira intake rose from about ${r10(it.before)} to ${r10(it.after)} issues a month once Jira opened before the sale (27 May); from 1 June a search starts on its won date.`],
      ['pace-1', 'How close are we to 100 closings a month?', `Best month ${bc.n} (${mon(bc.at)}), ${G.best_close_sold ? Object.entries(G.best_close_sold.by_sale_month).filter(([m]) => m >= '2026-06' && m <= '2026-08').reduce((a, [, n]) => a + n, 0) : ''} of them won in June–August; ${f1(G.last4.closed_per7)} a week over the last four weeks against ${f1(G.benchmark_per7)} needed; about ${S.int(G.conversion.sales_needed)} sales a month (planning estimate: ${S.int(G.conversion.won_closed)} of ${S.int(G.conversion.won_n)} historical deals closed).`],
      ['pace-2', 'Are more searches starting than going under contract?', `${ph(lf.diff)} in ${mon(lf.month)} (${lf.starts} started, ${lf.uc} under contract)${pr ? `; so far in ${mon(pr.month)} (partial) ${ph(pr.diff)}` : ''}. The backlog is the ${S.int(st.hunting)} hunting today.`],
      ['pace-3', 'How quickly do monthly cohorts reach a contract?', `Within 14 days: ${S.pct(cp.w14.before.share)} → ${S.pct(cp.w14.after.share)}. Within 30 days: ${S.pct(cp.w30.before.share)} → ${S.pct(cp.w30.after.share)} (start months before → since June; the start date changed on 1 June).`],
      ['pace-4', 'What happens in the first 14 days?', `Of ${S.int(f14.el14)} searches that started June–October, ${f14.rf14} were refunded and ${f14.uc14} went under contract within 14 days.`],
      ['drivers-1', 'How many searches reach a contract within 30 days?', `${S.int(dr.composition.all_fast)} of ${S.int(dr.composition.all_eligible)} (${S.pct(dr.composition.all_fast / dr.composition.all_eligible)}) of the starts with 75+ days of follow-up.`],
      ['drivers-3', 'Do searches up to $250K go under contract and close more slowly?', `No measurable difference: ${p1(lo.uc14.k / lo.uc14.eligible)} up to $250K vs ${p1(hi.uc14.k / hi.uc14.eligible)} above under contract within 14 days; contract to closing ${S.med(lo.uc_to_close.median)} vs ${S.med(hi.uc_to_close.median)} days.`],
      ['drivers-4', 'Are they refunded early more often?', `A question to investigate: refunded within 30 days ${p1(lo.rf30.k / lo.rf30.eligible)} vs ${p1(hi.rf30.k / hi.rf30.eligible)} (unadjusted); ${sg(m30.diff)} points like for like (95% ${sg(m30.lo)} to ${sg(m30.hi)}).`],
      ['drivers-5', 'Do prior offers matter?', `Offers reported before joining: by day 30, ${p1(o0.share30)} with none against ${p1(o3.share30)} with 3+ (by day 14: ${p1(o0.share14)} and ${p1(o3.share14)}).`],
      ['drivers-6', 'Can early deal flow be seen?', `The Deals Sent total has no send dates; the median Deal Number Purchased rose from ${S.med(dn.early.median)} to ${S.med(dn.late.median)} (Jan–May to Jun–Sep starts under contract by day 30).`],
      ['fallout-1', 'What happens after a contract falls through?', `${S.int(F.documented.n)} documented fall-throughs and ${S.int(F.ended.n)} ended contracts without a recorded purchase (${S.int(F.ended.now.paused)} paused, ${S.int(F.ended.now.hunting)} hunting, ${S.int(F.ended.now.refunded)} refunded, ${S.int(F.ended.now.additional)} Additional Service).`],
      ['repeat-1', 'How many clients come back, and for which purchase?', `${S.int(P.repeat_clients)} have two or more won deals; ${S.int(J.two_plus_purchases)} completed two or more purchases; ${S.int(J.pursuing)} are pursuing their next.`],
      ['repeat-2', 'Do repeat buyers use STR Cribs again?', `${S.int(C.clients_both)} of the ${S.int(C.clients_first_cribs)} repeat buyers who chose Cribs first have Cribs recorded again (recorded selection).`],
    ];
    const where = id => { const c = chapters.find(x => x.id === id.split('-')[0]); return c ? `${c.n}.${S.pos(c, id)}` : ''; };
    return `<div class="qa"><div class="qa-h"><b>Questions and short answers</b><span>Each is answered in the section named on its card; the outline on the left jumps there. The Executive Summary at the end reads them together.</span></div>
      <ol>${q.map(([id, t, a], i) => `<li><div class="qc${i < core.length ? ' kpi' : ''}">${i < core.length ? '<span class="kpi-tag">Core KPI</span>' : ''}<span class="q">${t}</span><span class="ans">${a}</span><span class="go" title="Section ${where(id)}">Section ${where(id)}</span></div></li>`).join('')}</ol></div>`;
  };
  let qa = '';
  try { qa = questions(); } catch (e) { console.error(e); }

  main.append(S.h(`<section class="opening" id="top"><div class="stage">
    <div class="kicker">STRSearch · Executive presentation</div>
    <h1>The Client Journey</h1>
    <p class="sub">How STRSearch turns paying clients into property owners.</p>
    <div class="meta"><span class="tag">Static snapshot</span><span>Data as of ${S.date(D.meta.asof)}</span></div>
    <div class="howto"><span class="howto-i" aria-hidden="true"><i></i><i></i><i class="s"></i></span><p><b>Moving around.</b> The outline on the left is the only way to jump between chapters, scenes and the Executive Summary (hover it, or press its button). <kbd>←</kbd> <kbd>→</kbd> step through scenes. Charts, tables and “How is this number built?” panels open in place and never move you.</p></div>
    <ol class="agenda">${chapters.map(c => `<li><span class="n">Chapter ${c.n}</span><span class="t">${c.title}</span></li>`).join('')}<li class="sum"><span class="n">Summary</span><span class="t">Executive Summary</span></li></ol>
    ${qa}
  </div></section>`));

  chapters.forEach(c => {
    try { c.render(main, D, c); } catch (e) { console.error(e); main.append(S.h(`<section class="scene"><div class="stage"><p>Chapter ${c.n} could not be drawn: ${e.message}</p></div></section>`)); }
  });
  try { S.renderSummary(main, D); } catch (e) { console.error(e); }
  S.renderMethod(main, D);
  document.getElementById('foot-asof').textContent = `Data as of ${S.date(D.meta.asof)} · source: Business Data Explorer`;

  /* ---- the outline (far left): the ONLY control that moves between chapters, scenes and the Executive Summary.
     Collapsed it is a column of dots (nothing invisible can sit over the page); hovering it, focusing it or pressing its button opens a
     panel with every chapter, and the scenes of the chapter being read. Navigation scrolls in place and never rewrites the page. */
  const rail = document.getElementById('rail');
  const scenes = [...document.querySelectorAll('.scene')];
  const stepLabel = sc => { const t = (sc.querySelector('.sh-step') || {}).textContent || ''; return t.replace(/^\d+\/\d+\s*·\s*/, '').replace(/^data as of.*$/, ''); };
  const sceneNo = sc => { const c = chapters.find(x => x.id === sc.dataset.chapter); return c ? `${c.n}.${sc.dataset.pos}` : ''; };
  const entries = [
    { id: 'top', key: 'top', dot: '↑', title: 'Start', kind: 'start' },
    ...chapters.map(c => ({ id: (c.order ? c.order[0] : `${c.id}-1`), key: c.id, dot: String(c.n), title: c.title, kind: 'chapter', n: c.n,
      scenes: scenes.filter(sc => sc.dataset.chapter === c.id).map(sc => ({ id: sc.id, no: sceneNo(sc), title: stepLabel(sc) })) })),
    { id: 'summary', key: 'summary', dot: 'S', title: 'Executive Summary', kind: 'summary' },
    { id: 'method', key: 'method', dot: 'M', title: 'Method and limitations', kind: 'method' },
  ];
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  rail.innerHTML = `<button class="rail-btn" type="button" aria-expanded="false" aria-controls="railPanel"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7"/></svg><span>Outline</span></button>
    <ol class="rail-dots" aria-hidden="true">${entries.map(e => `<li data-key="${e.key}" class="${e.kind}"><a tabindex="-1" data-go="${e.id}" href="#${e.id}" title="${esc(e.title)}"><span class="dot">${e.dot}</span></a></li>`).join('')}</ol>
    <div class="rail-panel" id="railPanel" hidden><p class="rp-h">Outline</p><ol class="rp-list">${entries.map(e => `<li data-key="${e.key}" class="${e.kind}"><a class="rp-ch" data-go="${e.id}" href="#${e.id}"><span class="rp-n">${e.dot}</span><span class="rp-t">${esc(e.title)}</span></a>${e.scenes && e.scenes.length > 1 ? `<ol class="rp-sub">${e.scenes.map(sc => `<li data-scene="${sc.id}"><a data-go="${sc.id}" href="#${sc.id}"><b>${sc.no}</b> ${esc(sc.title)}</a></li>`).join('')}</ol>` : ''}</li>`).join('')}</ol></div>`;
  const btn = rail.querySelector('.rail-btn'), panel = rail.querySelector('.rail-panel');
  let pinned = false, closeT = 0;
  const setOpen = on => { clearTimeout(closeT); panel.hidden = !on; rail.classList.toggle('open', on); btn.setAttribute('aria-expanded', String(on)); if (!on) pinned = false; };
  btn.addEventListener('click', () => { if (panel.hidden) { pinned = true; setOpen(true); } else setOpen(false); });
  rail.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover) and (min-width: 1260px)').matches) setOpen(true); });
  rail.addEventListener('mouseleave', () => { if (!pinned) closeT = setTimeout(() => setOpen(false), 280); });
  rail.addEventListener('focusin', e => { if (e.target.closest('.rail-panel')) clearTimeout(closeT); });
  rail.addEventListener('keydown', e => { if (e.key === 'Escape') { setOpen(false); btn.focus(); } });
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !rail.contains(e.target)) setOpen(false); });

  const head = () => document.querySelector('.top').offsetHeight;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const goTo = id => {
    const el = document.getElementById(id);
    if (!el) return;
    scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - (id === 'top' ? 0 : head())), behavior: reduce() ? 'auto' : 'smooth' });
    try { history.replaceState(null, '', id === 'top' ? location.pathname + location.search : '#' + id); } catch (err) { /* file:// or sandboxed */ }
  };
  rail.addEventListener('click', e => {
    const a = e.target.closest('a[data-go]');
    if (!a) return;
    e.preventDefault();
    goTo(a.dataset.go);
    if (!matchMedia('(min-width: 1260px)').matches) setOpen(false);   // floating-button layout: close once a destination is chosen
  });

  /* scroll-spy: which chapter and scene is being read */
  const keys = entries.map(e => e.key);
  let curKey = null, curScene = null;
  const mark = () => {
    const idx = keys.indexOf(curKey);
    rail.querySelectorAll('.rail-dots li, .rp-list > li').forEach(li => {
      const i = keys.indexOf(li.dataset.key);
      li.classList.toggle('on', i === idx); li.classList.toggle('done', i < idx);
      const a = li.querySelector(':scope > a'); if (a) { if (i === idx) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }
    });
    rail.querySelectorAll('.rp-sub li').forEach(li => li.classList.toggle('now', li.dataset.scene === curScene));
    const here = entries[idx], sc = curScene && scenes.find(x => x.id === curScene);
    btn.querySelector('span').textContent = here && here.kind === 'chapter' && sc ? `${sceneNo(sc)} · Outline` : here && here.kind !== 'chapter' ? `${here.title} · Outline` : 'Outline';
  };
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    curKey = e.target.dataset.chapter || e.target.id; curScene = e.target.classList.contains('scene') ? e.target.id : null; mark();
  }), { rootMargin: '-45% 0px -50% 0px' });
  [document.getElementById('top'), ...scenes, document.getElementById('method')].forEach(el => { if (el) { if (!el.dataset.chapter) el.dataset.chapter = el.id; spy.observe(el); } });
  mark();

  /* scroll progress */
  const bar = document.getElementById('progress');
  const onScroll = () => { const h = document.documentElement; bar.style.transform = `scaleX(${Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight))})`; };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* presentation shortcut: ← → step through the scenes (the opening counts as the first stop). Never fires while typing, with a modifier
     held, or when a control that uses the arrows has focus. */
  const stops = [document.getElementById('top'), ...scenes, document.getElementById('method')];
  addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (/input|textarea|select/i.test(document.activeElement.tagName) || document.activeElement.isContentEditable || (rail.contains(document.activeElement) && !panel.hidden)) return;
    e.preventDefault();
    const y = scrollY + head() + 8;
    let i = stops.findIndex((s, k) => k === stops.length - 1 || stops[k + 1].getBoundingClientRect().top + scrollY > y);
    i = Math.max(0, Math.min(stops.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    goTo(stops[i].id);
  });

  /* theme toggle: an explicit choice overrides the system setting */
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cj-theme', next); } catch (err) { /* storage unavailable */ }
    S.redraw();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', S.redraw);
  window.__REPORT_READY = true;
})();
