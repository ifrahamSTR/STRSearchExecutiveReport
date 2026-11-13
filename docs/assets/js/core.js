/* Shared helpers for the Executive Performance Report.
   R.story(id, spec) registers a story; app.js renders them in the order of REPORT_DATA.meta.stories.
   A new story = one pipeline module + one file in stories/ + one <script> tag. Nothing else changes. */
(function () {
  'use strict';
  const R = (window.R = { stories: {}, charts: [] });
  R.data = window.REPORT_DATA;

  /* ---------- formatting */
  const nf = new Intl.NumberFormat('en-US');
  R.int = v => (v == null ? '–' : nf.format(Math.round(v)));
  R.pct = (v, d = 0) => (v == null ? '–' : (v * 100).toFixed(d) + '%');
  R.days = v => (v == null ? '–' : Math.round(v) + ' days');
  R.money = v => (v == null ? '–' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + nf.format(Math.round(v / 100) * 100));
  R.weeks = d => Math.round(d / 7);
  R.date = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  R.mon = ym => new Date(ym + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  R.monShort = ym => new Date(ym + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' }) + (ym.endsWith('-01') ? ' ’' + ym.slice(2, 4) : '');
  R.ratio = v => v.toFixed(1).replace(/\.0$/, '') + '×';

  /* ---------- DOM */
  R.h = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  R.$ = (sel, root) => (root || document).querySelector(sel);

  /* ---------- theme */
  R.css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  R.tokens = () => ({
    wait: R.css('--c-wait'), waitSoft: R.css('--c-wait-soft'), uc: R.css('--c-uc'), ucSoft: R.css('--c-uc-soft'),
    closed: R.css('--c-closed'), closedSoft: R.css('--c-closed-soft'), neutral: R.css('--c-neutral'), neutral2: R.css('--c-neutral-2'),
    hold: R.css('--c-hold'), grid: R.css('--grid'), axis: R.css('--axis'), label: R.css('--label'), ink: R.css('--ink'),
    inkStrong: R.css('--ink-strong'), muted: R.css('--muted'), surface: R.css('--surface'), gold: R.css('--gold'), line: R.css('--line'),
  });

  /* ---------- charts: ECharts with theme-aware re-render, rendered when visible */
  R.chart = function (node, build) {
    const rec = { node, build, inst: null };
    R.charts.push(rec);
    const draw = () => {
      if (!rec.inst) rec.inst = echarts.init(node, null, { renderer: 'svg' });
      rec.inst.setOption(build(R.tokens()), true);
    };
    rec.draw = draw;
    draw();
    return rec;
  };
  R.redrawAll = () => R.charts.forEach(c => c.draw());
  window.addEventListener('resize', () => R.charts.forEach(c => c.inst && c.inst.resize()));

  R.base = t => ({
    animation: false,
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: t.label },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis', backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, padding: [8, 12],
      textStyle: { color: t.ink, fontSize: 13 }, extraCssText: 'box-shadow:0 6px 20px rgba(0,0,0,.12);border-radius:8px;',
    },
  });
  R.valAxis = (t, extra) => Object.assign({
    type: 'value', axisLine: { show: false }, axisTick: { show: false },
    splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.label, fontSize: 12 },
  }, extra || {});
  R.catAxis = (t, data, extra) => Object.assign({
    type: 'category', data, axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
    axisLabel: { color: t.label, fontSize: 12 },
  }, extra || {});

  /* segmented toggle */
  R.seg = function (options, value, onChange, label) {
    const box = R.h(`<div class="seg" role="group" aria-label="${label || 'View'}"></div>`);
    options.forEach(o => {
      const b = R.h(`<button type="button" aria-pressed="${o.value === value}">${o.label}</button>`);
      b.addEventListener('click', () => {
        box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        onChange(o.value);
      });
      box.append(b);
    });
    return box;
  };

  R.story = (id, spec) => { R.stories[id] = spec; };
})();
