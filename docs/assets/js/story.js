/* Core for "The Client Journey": data, formatting, theme tokens, charts, scenes, chapter registry.
   A chapter = one pipeline module (pipeline/chapters/<id>.py) + one script here calling S.chapter(). */
(function () {
  'use strict';
  const S = (window.S = { chapters: {}, charts: [] });
  S.data = window.STORY_DATA;

  /* formatting */
  const nf = new Intl.NumberFormat('en-US');
  S.int = v => (v == null ? '–' : nf.format(Math.round(v)));
  S.pct = (v, d = 0) => (v == null ? '–' : (v * 100).toFixed(d) + '%');
  S.d1 = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
  S.date = iso => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  S.monShort = ym => new Date(ym + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' }) + (ym.endsWith('-01') ? ' ’' + ym.slice(2, 4) : '');

  /* DOM */
  S.h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  S.$ = (sel, root) => (root || document).querySelector(sel);

  /* theme tokens for charts (read from CSS so both themes stay in one place) */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  S.tok = () => ({
    ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), surface: css('--surface'), line: css('--line'),
    grid: css('--grid'), axis: css('--axis'), label: css('--label'), sales: css('--sales'), acq: css('--acq'),
    uc: css('--uc'), uc2: css('--uc-2'), closed: css('--closed'), closed2: css('--closed-2'),
    wait: css('--wait'), wait2: css('--wait-2'), hold: css('--hold'), hold2: css('--hold-2'),
    sp1: css('--sp-fast'), sp2: css('--sp-mid'), sp3: css('--sp-slow'),
  });

  /* charts: ECharts (SVG renderer), redrawn on theme change, resized with their container */
  S.chart = function (node, build) {
    const rec = { node, build, inst: null };
    rec.draw = () => {
      if (!node.offsetWidth) return;
      if (!rec.inst) rec.inst = echarts.init(node, null, { renderer: 'svg' });
      rec.inst.setOption(build(S.tok(), node), true);
    };
    S.charts.push(rec);
    rec.draw();
    if (window.ResizeObserver) {
      let raf = 0;
      new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => (rec.inst ? rec.inst.resize() : rec.draw())); }).observe(node);
    }
    return rec;
  };
  S.redraw = () => S.charts.forEach(c => c.draw());

  S.base = t => ({
    animationDuration: 700, animationEasing: 'cubicOut',
    textStyle: { fontFamily: 'Figtree, system-ui, sans-serif', color: t.label },
    tooltip: {
      trigger: 'axis', backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, padding: [8, 12],
      textStyle: { color: t.ink, fontSize: 13 }, extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,.14);border-radius:10px;',
    },
  });
  S.valAxis = (t, extra) => Object.assign({
    type: 'value', axisLine: { show: false }, axisTick: { show: false },
    splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.label, fontSize: 12 },
  }, extra || {});
  S.dayAxis = (t, max, extra) => Object.assign({
    type: 'value', min: 0, max, interval: 30, axisTick: { show: false }, splitLine: { show: false },
    axisLine: { show: true, lineStyle: { color: t.axis } }, axisLabel: { color: t.label, fontSize: 12.5 },
    nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: t.muted, fontSize: 12.5 },
  }, extra || {});

  /* scenes: slide-like blocks with a chapter eyebrow and a one-line headline */
  S.scene = (root, { ch, step, of, label, title }) => {
    const sec = document.createElement('section');
    sec.className = 'scene' + (step === 1 ? ' first' : '');
    sec.id = `${ch.id}-${step}`;
    sec.dataset.chapter = ch.id;
    sec.innerHTML = `<div class="stage"><header class="sh"><div class="sh-top"><span class="sh-ch">Chapter ${ch.n}</span><span class="sh-ct">${ch.title}</span>${label ? `<span class="sh-step">${of > 1 ? `${step}/${of} · ` : ''}${label}</span>` : ''}</div><h2>${title}</h2></header><div class="body"></div></div>`;
    root.append(sec);
    return sec.querySelector('.body');
  };

  S.chapter = (id, spec) => { S.chapters[id] = Object.assign({ id }, spec); };
})();
