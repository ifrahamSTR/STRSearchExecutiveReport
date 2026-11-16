/* Reporting-version switcher shared by every version folder of this site.
   Reads window.STR_VERSIONS (versions.js, one level up), mounts a compact date control into
   [data-version-slot], marks archived versions with a slim banner, and keeps links to the partner site
   (Executive Report <-> Business Data Explorer) on the same reporting version.
   Plain script, no dependencies; works from disk and on GitHub Pages. */
(function () {
  'use strict';
  var R = window.STR_VERSIONS;
  if (!R || !R.versions || !R.versions.length) return;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmt(iso) { if (!iso) return ''; var p = iso.split('-'); return (+p[2]) + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function byId(id) { for (var i = 0; i < R.versions.length; i++) if (R.versions[i].id === id) return R.versions[i]; return null; }

  // Current version: <html data-version>, else the /YYYY-MM-DD/ folder in the path.
  var m = location.pathname.match(/\/(\d{4}-\d{2}-\d{2})\//);
  var currentId = document.documentElement.getAttribute('data-version') || (m && m[1]) || R.default;
  var current = byId(currentId) || byId(R.default);
  if (!current) return;
  document.documentElement.setAttribute('data-version', current.id);
  document.documentElement.setAttribute('data-version-status', current.status);

  // Target of a version switch on this site: sibling folder, same section (hash) when possible.
  function hrefFor(id) {
    var here = location.pathname;
    var base = m ? here.slice(0, here.indexOf('/' + m[1] + '/') + 1) : here.replace(/[^/]*$/, '');
    return base + id + '/' + location.hash;
  }
  function partnerHref(site, id) {
    var s = R.sites && R.sites[site];
    return s ? s.base.replace(/\/?$/, '/') + id + '/' : null;
  }

  // ------------------------------------------------------------------ control
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function build() {
    var slot = document.querySelector('[data-version-slot]');
    var wrap = el('div', 'vs');
    var btn = el('button', 'vs-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Reporting version: ' + current.label + ' (' + current.title + '). Change version');
    btn.title = 'Reporting version';
    var dot = el('span', 'vs-dot vs-dot--' + current.status);
    var lab = el('span', 'vs-label', current.label);
    var short = el('span', 'vs-short', current.label.replace(/ \d{4}$/, ''));
    var chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chev.setAttribute('viewBox', '0 0 12 12'); chev.setAttribute('class', 'vs-chev'); chev.setAttribute('aria-hidden', 'true');
    chev.innerHTML = '<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
    btn.append(dot, lab, short, chev);

    var pop = el('div', 'vs-pop');
    pop.setAttribute('role', 'menu');
    pop.hidden = true;
    pop.append(el('div', 'vs-head', 'Reporting version'));
    R.versions.forEach(function (v) {
      var a = el('a', 'vs-item' + (v.id === current.id ? ' is-current' : ''));
      a.setAttribute('role', 'menuitemradio');
      a.setAttribute('aria-checked', v.id === current.id ? 'true' : 'false');
      a.href = v.id === current.id ? '#' : hrefFor(v.id);
      var top = el('span', 'vs-item-top');
      top.append(el('span', 'vs-item-date', v.label), el('span', 'vs-tag vs-tag--' + v.status, v.status === 'current' ? 'Default' : 'Archived'));
      a.append(top, el('span', 'vs-item-title', v.title), el('span', 'vs-item-asof', 'Data as of ' + fmt(v.data_asof)));
      if (v.id === current.id) a.addEventListener('click', function (e) { e.preventDefault(); close(); btn.focus(); });
      pop.append(a);
    });
    var note = el('p', 'vs-note', 'The version date names the reporting package. The data inside it runs to its own as-of date.');
    pop.append(note);
    var other = R.site === 'report' ? 'explorer' : 'report';
    var oh = partnerHref(other, current.id);
    if (oh) {
      var x = el('a', 'vs-cross', 'Open the ' + current.label + ' ' + R.sites[other].name + ' ↗');
      x.href = oh; x.setAttribute('role', 'menuitem');
      pop.append(x);
    }
    wrap.append(btn, pop);

    function items() { return Array.prototype.slice.call(pop.querySelectorAll('a')); }
    function open() { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); wrap.classList.add('is-open'); var c = pop.querySelector('.is-current') || items()[0]; if (c) c.focus(); }
    function close() { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); wrap.classList.remove('is-open'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (pop.hidden) open(); else close(); });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
    wrap.addEventListener('keydown', function (e) {
      // keep the host page's arrow-key navigation out of the menu
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Escape'].indexOf(e.key) >= 0) e.stopPropagation();
      if (e.key === 'Escape') { close(); btn.focus(); return; }
      if (pop.hidden) { if (e.key === 'ArrowDown') { e.preventDefault(); open(); } return; }
      var list = items(), i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      if (e.key === 'Tab' && !e.shiftKey && i === list.length - 1) close();
    });

    if (slot) slot.replaceWith(wrap);
    else { wrap.classList.add('vs--float'); document.body.append(wrap); }

    if (current.status !== 'current') {
      var latest = byId(R.default);
      var bar = el('div', 'vs-banner');
      bar.setAttribute('role', 'note');
      var txt = el('span', null, 'Archived reporting package: ' + current.label + ' (data as of ' + fmt(current.data_asof) + '). Figures use the original definitions and are kept unchanged. ');
      bar.append(txt);
      if (latest) { var go = el('a', null, 'View the ' + latest.label + ' update'); go.href = hrefFor(latest.id); bar.append(go); }
      var host = document.querySelector(R.bannerAfter || 'header');
      if (host && host.parentNode) host.parentNode.insertBefore(bar, host.nextSibling); else document.body.prepend(bar);
    }
  }

  // ------------------------------------------------------------------ partner links keep the version
  function versioned(href) { return /\/\d{4}-\d{2}-\d{2}\//.test(href); }
  function fix(a) {
    if (!a || !a.href || !R.sites) return;
    for (var k in R.sites) {
      if (!Object.prototype.hasOwnProperty.call(R.sites, k) || k === R.site) continue;
      var base = R.sites[k].base.replace(/\/?$/, '/');
      if (a.href.indexOf(base) === 0 && !versioned(a.href)) {
        var rest = a.href.slice(base.length).replace(/^index\.html/, '');
        a.href = base + current.id + '/' + rest;
      }
    }
  }
  function sweep(root) { (root.querySelectorAll ? root.querySelectorAll('a[href]') : []).forEach(fix); }
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href]'); if (a) fix(a); }, true);

  function start() {
    build();
    sweep(document);
    if ('MutationObserver' in window) {
      new MutationObserver(function (ms) {
        ms.forEach(function (mu) { mu.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.tagName === 'A') fix(n); sweep(n); } }); });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
