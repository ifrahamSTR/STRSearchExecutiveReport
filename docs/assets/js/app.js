/* Boot: render each registered story in the order listed in REPORT_DATA.meta.stories, then the notes. */
(function () {
  'use strict';
  const R = window.R, D = R.data;
  const main = document.getElementById('main');
  const nav = document.getElementById('nav');
  const order = D.meta.stories.concat(['notes']);
  order.forEach(id => {
    const spec = R.stories[id];
    if (!spec) return;
    const sec = document.createElement('section');
    sec.id = id;
    sec.className = id === 'journey' ? 'hero' : 'section';
    main.append(sec);
    try { spec.render(sec, D); } catch (e) { sec.innerHTML = `<div class="wrap"><p>This section could not be drawn: ${e.message}</p></div>`; console.error(e); }
    if (spec.nav) nav.append(R.h(`<a href="#${id}">${spec.nav}</a>`));
  });
  document.getElementById('foot-asof').textContent = 'Data as of ' + R.date(D.meta.asof) + ' · built ' + D.meta.built_at;

  // theme toggle (explicit choice overrides the system setting)
  const btn = document.getElementById('themeBtn');
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('exr-theme', next); } catch (e) { /* storage unavailable */ }
    R.redrawAll();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', R.redrawAll);

  // highlight the section in view
  const links = [...nav.querySelectorAll('a')];
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  order.forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
  window.__REPORT_READY = true;
})();
