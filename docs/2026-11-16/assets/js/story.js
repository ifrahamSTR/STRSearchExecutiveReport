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
  S.med = v => (v == null ? '–' : Number.isInteger(v) ? S.int(v) : S.d1(v));   // half-day medians stay visible
  S.date = iso => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  S.monShort = ym => new Date(ym + '-15T12:00:00').toLocaleDateString('en-US', { month: 'short' }) + (ym.endsWith('-01') ? ' ’' + ym.slice(2, 4) : '');

  /* DOM */
  S.h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  S.$ = (sel, root) => (root || document).querySelector(sel);

  /* theme tokens for charts (read from CSS so both themes stay in one place) */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  S.tok = () => ({
    ink: css('--ink'), ink2: css('--ink-2'), muted: css('--muted'), surface: css('--surface'), line: css('--line'),
    grid: css('--grid'), axis: css('--axis'), label: css('--label'), sales: css('--sales'), sales2: css('--sales-2'), acq: css('--acq'),
    uc: css('--uc'), uc2: css('--uc-2'), closed: css('--closed'), closed2: css('--closed-2'),
    wait: css('--wait'), wait2: css('--wait-2'), hold: css('--hold'), hold2: css('--hold-2'), paused: css('--paused'),
    sp1: css('--sp-fast'), sp2: css('--sp-mid'), sp3: css('--sp-slow'), decl: css('--decl'),
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

  /* panel tools (added 18 Nov 2026), the Cash Forecast pattern: the answer first, a Chart / Table switch that shows the
     exact values in the same space, segmented switches for follow-up cuts, Recorded / Inferred / Scenario labels and a
     collapsed "How is this built?" explanation. */
  const IC = {
    chart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5h11M4.8 11V7.5M8 11V4M11.2 11V6.2"/></svg>',
    table: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.6"/><path d="M2.5 6.6h11M2.5 9.8h11M6.4 6.6V13"/></svg>',
  };
  const BASIS = {
    rec: { label: 'Recorded', tip: 'Recorded: taken directly from source records (Jira, Pipedrive, the onboarding form or the partner trackers).' },
    inf: { label: 'Inferred', tip: 'Inferred: estimated from history or by matching records. Not recorded directly.' },
    sce: { label: 'Scenario', tip: 'Scenario: what the figure would be under a stated assumption. It has not happened.' },
  };
  const SORT = new WeakMap();
  S.ui = {
    chip: k => `<span class="bx ${k}" title="${BASIS[k].tip}"><i></i>${BASIS[k].label}</span>`,
    chips: ks => `<span class="bs">${ks.map(k => S.ui.chip(k)).join('')}</span>`,
    toggle: () => `<div class="vt" role="group" aria-label="Show as chart or table"><button type="button" data-view="chart" aria-pressed="true">${IC.chart}<span>Chart</span></button><button type="button" data-view="table" aria-pressed="false">${IC.table}<span>Table</span></button></div>`,
    seg: (name, label, opts, value, cls) => `<div class="vt seg${cls ? ' ' + cls : ''}" role="group" aria-label="${label}" data-seg="${name}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(v === value)}">${t}</button>`).join('')}</div>`,
    ex: (title, cols, desc) => `<details class="ex"><summary><span class="ex-t">${title}</span>${desc ? `<span class="ex-s">${desc}</span>` : ''}</summary><div class="ex-b">${cols.map(c => `<div>${c}</div>`).join('')}</div></details>`,
    /* wire a board: Chart / Table switch and segmented switches; onSeg(name, value) redraws whatever depends on them */
    wire(board, onSeg) {
      board.querySelectorAll('.vt:not(.seg) button').forEach(b => b.addEventListener('click', () => {
        board.classList.toggle('is-table', b.dataset.view === 'table');
        b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      }));
      board.querySelectorAll('.vt.seg').forEach(g => g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        if (onSeg) onSeg(g.dataset.seg, b.dataset.v);
      })));
    },
    /* sortable table: cols [{k, label, num, html(r), sv(r), sort:false, cls}], rows; opt {caption, total, sortable, notes, head} */
    table(host, cols, rows, opt) {
      opt = opt || {};
      const sortable = opt.sortable !== false;
      const so = SORT.get(host) || { k: null, dir: -1 };
      SORT.set(host, so);
      let body = rows.slice();
      if (sortable && so.k && cols.some(c => c.k === so.k)) {
        const c = cols.find(x => x.k === so.k), v = r => (c.sv ? c.sv(r) : r[c.k]);
        body = body.filter(r => !r._group).sort((a, b) => { const va = v(a), vb = v(b); return (va == null ? -Infinity : va) > (vb == null ? -Infinity : vb) ? so.dir : (va == null ? -Infinity : va) < (vb == null ? -Infinity : vb) ? -so.dir : 0; });
      }
      const cell = (c, r) => `<td class="${c.num ? 'n' : ''}${c.cls ? ' ' + c.cls : ''}">${c.html ? c.html(r) : (r[c.k] == null ? '' : r[c.k])}</td>`;
      const head = cols.map(c => {
        const s = sortable && c.sort !== false;
        return `<th scope="col" class="${c.num ? 'n' : ''}"${s ? ` aria-sort="${so.k === c.k ? (so.dir > 0 ? 'ascending' : 'descending') : 'none'}"` : ''}>${s ? `<button type="button" data-k="${c.k}">${c.label}</button>` : c.label}</th>`;
      }).join('');
      const tr = r => (r._group ? `<tr class="grp"><th colspan="${cols.length}" scope="rowgroup">${r._group}</th></tr>` : `<tr${r._cls ? ` class="${r._cls}"` : ''}>${cols.map(c => cell(c, r)).join('')}</tr>`);
      host.innerHTML = `<table class="dt"><caption class="visually-hidden">${opt.caption || ''}</caption><thead>${opt.head || ''}<tr>${head}</tr></thead><tbody>${body.map(tr).join('')}</tbody>`
        + `${opt.total ? `<tfoot>${[].concat(opt.total).map(t => `<tr>${cols.map(c => cell(c, t)).join('')}</tr>`).join('')}</tfoot>` : ''}</table>`
        + `${opt.notes ? `<div class="t-notes">${opt.notes}</div>` : ''}${sortable ? '<p class="t-hint">Select a column heading to sort; again to reverse; a third time to restore the order.</p>' : ''}`;
      if (sortable) host.querySelectorAll('th button').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k, c = cols.find(x => x.k === k), first = c.num ? -1 : 1;
        if (so.k !== k) { so.k = k; so.dir = first; } else if (so.dir === first) so.dir = -first; else so.k = null;
        S.ui.table(host, cols, rows, opt);
        const again = host.querySelector(`th button[data-k="${k}"]`);
        if (again) again.focus();
      }));
    },
    /* a share bar with brackets: segs [{k, n, label, c (css colour), cls, lt}], brackets [{from, to, text, sub, dn, al, ar}] by segment key */
    stack(segs, brackets, aria) {
      const tot = segs.reduce((a, s) => a + s.n, 0), at = {}, STEP = 34, BAR = 46;
      let cum = 0;
      segs.forEach(s => { at[s.k] = { l: cum / tot, w: s.n / tot }; cum += s.n; });
      const levels = dn => brackets.filter(b => !!b.dn === dn).reduce((m, b) => Math.max(m, (b.lvl || 0) + 1), 0);
      const padT = 16 + levels(false) * STEP, padB = 16 + levels(true) * STEP;
      const br = b => {
        const l = at[b.from].l, r = at[b.to].l + at[b.to].w, lv = b.lvl || 0;
        const top = b.dn ? padT + BAR + 2 + lv * STEP : padT - 14 - lv * STEP;
        return `<div class="brk ${b.dn ? 'dn' : 'up'}${b.al ? ' al' : ''}${b.ar ? ' ar' : ''}" style="left:${(l * 100).toFixed(2)}%;width:${((r - l) * 100).toFixed(2)}%;top:${top}px"><span>${b.text}${b.sub ? `<em>${b.sub}</em>` : ''}</span></div>`;
      };
      return `<div class="stack" role="img" aria-label="${aria}" style="padding:${padT}px 0 ${padB}px">${brackets.map(br).join('')}<div class="stack-bar" style="height:${BAR}px">${segs.map(s => `<i class="${s.cls || ''}${s.lt ? ' lt' : ''}" style="flex:${s.n} 1 0;background:${s.c}" title="${s.label}: ${S.int(s.n)}">${s.n / tot > 0.045 ? S.int(s.n) : ''}</i>`).join('')}</div></div>`;
    },
    keys: (items, cols) => `<div class="stack-keys" style="--cols:${cols || items.length}">${items.map(x => `<div class="sk" style="--c:${x.c}"><span class="sk-v num">${S.int(x.n)}${x.of ? `<small>${x.of}</small>` : ''}</span><span class="sk-t">${x.label}</span>${x.sub ? `<span class="sk-s">${x.sub}</span>` : ''}</div>`).join('')}</div>`,
    bar: (label, n, max, c, note) => `<div class="ob-r${n ? '' : ' zero'}"><span>${label}${note ? `<small style="display:block;color:var(--muted);font-size:12px">${note}</small>` : ''}</span><span class="bar" style="--c:${c}"><i style="width:${max ? (100 * n / max).toFixed(1) : 0}%"></i></span><span class="n num">${S.int(n)}</span></div>`,
  };
  S.pctp = (v, d = 0) => (v == null ? '–' : (v * 100).toFixed(d) + '%');
  S.signed = (v, d = 0) => (v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%');
})();
