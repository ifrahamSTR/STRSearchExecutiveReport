/* Boot: opening, chapters (in REPORT order), method note, journey rail, arrow-key stepping, theme. */
(function () {
  'use strict';
  const S = window.S, D = S.data;
  const main = document.getElementById('main');
  const chapters = D.meta.chapters.map(id => S.chapters[id]).filter(Boolean);

  main.append(S.h(`<section class="opening" id="top"><div class="stage">
    <div class="kicker">STRSearch · Executive presentation</div>
    <h1>The Client Journey</h1>
    <p class="sub">How STRSearch turns paying clients into property owners.</p>
    <div class="meta"><span class="tag">Static snapshot</span><span>Data as of ${S.date(D.meta.asof)}</span></div>
    <ol class="agenda">${chapters.map(c => `<li><a href="#${c.id}-1"><span class="n">Chapter ${c.n}</span><span class="t">${c.title}</span></a></li>`).join('')}</ol>
  </div></section>`));

  chapters.forEach(c => {
    try { c.render(main, D, c); } catch (e) { console.error(e); main.append(S.h(`<section class="scene"><div class="stage"><p>Chapter ${c.n} could not be drawn: ${e.message}</p></div></section>`)); }
  });
  S.renderMethod(main, D);
  document.getElementById('foot-asof').textContent = `Data as of ${S.date(D.meta.asof)} · source: Business Data Explorer`;

  /* journey rail */
  const rail = document.getElementById('rail');
  rail.innerHTML = '<ol>' + chapters.map(c => `<li data-ch="${c.id}"><a href="#${c.id}-1" aria-label="Chapter ${c.n}: ${c.title}"><span class="dot">${c.n}</span><span class="lbl">${c.title}</span></a></li>`).join('') + '</ol>';
  const items = [...rail.querySelectorAll('li')];
  const scenes = [...document.querySelectorAll('.scene')];
  const setChapter = id => {
    const idx = chapters.findIndex(c => c.id === id);
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
