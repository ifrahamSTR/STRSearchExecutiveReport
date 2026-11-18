/* Boot: opening, chapters (in REPORT order), method note, journey rail, arrow-key stepping, theme. */
(function () {
  'use strict';
  const S = window.S, D = S.data;
  const main = document.getElementById('main');
  const chapters = D.meta.chapters.map(id => S.chapters[id]).filter(Boolean);

  /* the questions the report answers, each with its short answer and a link to the view (added 18 Nov 2026; L10 update the same day) */
  const questions = () => {
    const ph = d => (d > 0 ? `${d} more starts than contracts` : d < 0 ? `${-d} more contracts than starts` : 'as many starts as contracts');
    const mon = k => new Date(k + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long' });
    const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
    const gr = D.pace.growth, full = gr.rows.filter(r => !r.partial), lf = full[full.length - 1], pr = gr.rows.find(r => r.partial);
    const w = D.outcomes.waiting, st = w.stages, hs = D.outcomes.status.hunting, cp = D.pace.cohorts.clocks.start.pooled, sc = D.speed.scenario.all, J = D.repeat.jira, P = D.repeat.pipedrive, C = D.repeat.cribs, F = D.fallout;
    const G = D.pace.goal, bc = G.best.closed.month, f14 = D.pace.first14.since_change, BG = Object.fromEntries(D.budgets.groups.map(g => [g.label, g])), lo = BG['Up to $250K'], hi = BG['Above $250K'], m14 = D.budgets.mh.uc.find(x => x.w === 14);
    const q = [
      ['pace-1', 'How close are we to 100 closings a month?', `Best month ${bc.n} (${mon(bc.at)}); ${f1(G.last4.closed_per7)} a week over the last four weeks against ${f1(G.benchmark_per7)} needed; about ${S.int(G.conversion.sales_needed)} sales a month would be needed.`],
      ['outcomes-1', 'How many signed-up clients are still waiting?', `${S.int(w.no_contract.n)} (${S.pct(w.no_contract.share)}) have no current contract or completed purchase: ${S.int(st.hunting)} hunting and ${S.int(st.paused + st.additional + st.refunded)} Inactive (Paused ${S.int(st.paused)}, Refunded ${S.int(st.refunded)}, Additional Service ${S.int(st.additional)}).`],
      ['outcomes-2', 'How long have hunting clients waited?', `Median ${S.med(hs.median)} days for the ${S.int(hs.with_start)} with a start date; ${S.int(hs.over90)} over 90 days; ${S.int(hs.no_start)} have no start date.`],
      ['pace-2', 'Are starts outpacing contracts?', `${ph(lf.diff)} in ${mon(lf.month)}${pr ? `; ${ph(pr.diff)} so far in ${mon(pr.month)} (partial)` : ''}.`],
      ['pace-3', 'Are newer cohorts going under contract faster?', `Within 14 days: ${S.pct(cp.w14.before.share)} → ${S.pct(cp.w14.after.share)}. Within 30 days: ${S.pct(cp.w30.before.share)} → ${S.pct(cp.w30.after.share)} (start months before → since June).`],
      ['pace-4', 'What happens in the first 14 days?', `Since June, ${f14.uc14} of ${S.int(f14.el14)} went under contract and ${f14.rf14} were refunded within 14 days of starting.`],
      ['drivers-3', 'Do lower-budget clients perform differently?', `Same speed (within 14 days ${S.pct(lo.uc14.k / lo.uc14.eligible, 1)} up to $250K vs ${S.pct(hi.uc14.k / hi.uc14.eligible, 1)} above); more early refunds (${S.pct(lo.rf30.k / lo.rf30.eligible)} vs ${S.pct(hi.rf30.k / hi.rf30.eligible)} within 30 days).`],
      ['speed-3', 'How long does Under Contract take, overall and by budget?', `Median ${S.med(sc.recorded.median)} days (average ${S.d1(sc.recorded.mean)}) recorded; ${S.med(sc.scenario.median)} (average ${S.d1(sc.scenario.mean)}) if every hunting client went under contract tomorrow.`],
      ['repeat-1', 'How many clients come back, and for which purchase?', `${S.int(P.repeat_clients)} have two or more won deals; ${S.int(J.two_plus_purchases)} completed two or more purchases; ${S.int(J.pursuing)} are pursuing their next.`],
      ['repeat-2', 'Do repeat buyers use STR Cribs again?', `${S.int(C.clients_later_cribs)} of ${S.int(C.clients)} chose Cribs again, ${C.clients_later_only === 0 ? 'all of them Cribs the first time' : `${C.clients_both} of them both times`} (recorded selection).`],
      ['fallout-1', 'What happens after a contract falls through?', `${S.int(F.documented.n)} of ${S.int(F.known.n)} documented (${S.pct(F.documented.n / F.known.n)}), no replacement property recorded; ${S.pct(F.fell_through.share)} counting status evidence.`],
    ];
    return `<div class="qa"><div class="qa-h"><b>Questions and short answers</b><span>Each opens the view with the supporting numbers (Chart / Table, and how each number is built). The Executive Summary at the end reads them together.</span></div>
      <ol>${q.map(([id, t, a]) => `<li><a href="#${id}"><span class="q">${t}</span><span class="ans">${a}</span><span class="go">Open →</span></a></li>`).join('')}</ol></div>`;
  };
  let qa = '';
  try { qa = questions(); } catch (e) { console.error(e); }

  main.append(S.h(`<section class="opening" id="top"><div class="stage">
    <div class="kicker">STRSearch · Executive presentation</div>
    <h1>The Client Journey</h1>
    <p class="sub">How STRSearch turns paying clients into property owners.</p>
    <div class="meta"><span class="tag">Static snapshot</span><span>Data as of ${S.date(D.meta.asof)}</span></div>
    <div class="jump-row"><a class="jump" href="#summary">Jump to Executive Summary <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/></svg></a><span class="jump-s">The conclusions, what changed and what to discuss at the L10, after the chapters.</span></div>
    <ol class="agenda">${chapters.map(c => `<li><a href="#${c.id}-1"><span class="n">Chapter ${c.n}</span><span class="t">${c.title}</span></a></li>`).join('')}<li class="sum"><a href="#summary"><span class="n">Summary</span><span class="t">Executive Summary</span></a></li></ol>
    ${qa}
  </div></section>`));

  chapters.forEach(c => {
    try { c.render(main, D, c); } catch (e) { console.error(e); main.append(S.h(`<section class="scene"><div class="stage"><p>Chapter ${c.n} could not be drawn: ${e.message}</p></div></section>`)); }
  });
  try { S.renderSummary(main, D); } catch (e) { console.error(e); }
  S.renderMethod(main, D);
  document.getElementById('foot-asof').textContent = `Data as of ${S.date(D.meta.asof)} · source: Business Data Explorer`;

  /* journey rail */
  const rail = document.getElementById('rail');
  rail.innerHTML = '<ol>' + chapters.map(c => `<li data-ch="${c.id}"><a href="#${c.id}-1" aria-label="Chapter ${c.n}: ${c.title}"><span class="dot">${c.n}</span><span class="lbl">${c.title}</span></a></li>`).join('')
    + '<li data-ch="summary" class="sum"><a href="#summary" aria-label="Executive Summary"><span class="dot">S</span><span class="lbl">Executive Summary</span></a></li></ol>';
  const items = [...rail.querySelectorAll('li')];
  const scenes = [...document.querySelectorAll('.scene')];
  const setChapter = id => {
    const idx = id === 'summary' ? chapters.length : chapters.findIndex(c => c.id === id);
    items.forEach((li, i) => { li.classList.toggle('on', i === idx); li.classList.toggle('done', i < idx); });
  };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setChapter(e.target.dataset.chapter); }), { rootMargin: '-45% 0px -50% 0px' });
  scenes.forEach(s => io.observe(s));

  /* scroll progress */
  const bar = document.getElementById('progress');
  const onScroll = () => { const h = document.documentElement; bar.style.transform = `scaleX(${Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight))})`; };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* arrow keys step through scenes (the opening counts as the first stop) */
  const stops = [document.getElementById('top'), ...scenes, document.getElementById('method')];
  const head = () => document.querySelector('.top').offsetHeight;
  addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(document.activeElement.tagName)) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const y = scrollY + head() + 8;
    let i = stops.findIndex((s, k) => k === stops.length - 1 || stops[k + 1].offsetTop > y);
    i = Math.max(0, Math.min(stops.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    stops[i].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
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
