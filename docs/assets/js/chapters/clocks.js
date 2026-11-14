/* Chapter 1: one customer, two journeys. Two clock dials (semicircular bezels), linked by the hand-off
   from Pipedrive Won to the Jira client, and by the Confidence Call bridge that now starts acquisition earlier. */
(function () {
  'use strict';
  const S = window.S;
  const P = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy - r * Math.sin(deg * Math.PI / 180)];
  const f = v => v.toFixed(1);
  const arc = (cx, cy, r, a1, a2) => { const [x1, y1] = P(cx, cy, r, a1), [x2, y2] = P(cx, cy, r, a2); return `M${f(x1)} ${f(y1)} A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}`; };

  const SALES = [
    { deg: 180, t: 'Discovers STRSearch', s: 'finds us', cls: 'sales' },
    { deg: 120, t: 'Books a call', s: 'with sales', cls: 'sales' },
    { deg: 60, t: 'Sales process', s: 'Confidence Call', cls: 'sales' },
    { deg: 0, t: 'Won', s: 'buys our service', cls: 'sales', win: true },
  ];
  const ACQ = [
    { deg: 180, t: 'Client start', s: 'onboarding call', cls: 'onb' },
    { deg: 120, t: 'Property search', s: 'weekly check-ins', cls: 'search' },
    { deg: 60, t: 'Under Contract', s: 'offer accepted', cls: 'contract' },
    { deg: 0, t: 'CLOSED', s: 'buys a property', cls: 'closed', win: true },
  ];

  function dial(o) {
    const { cx, cy, r, stages, kind } = o;
    let s = '';
    for (let d = 0; d <= 180; d += 10) {
      const [x1, y1] = P(cx, cy, r + 14, d), [x2, y2] = P(cx, cy, r + (d % 30 === 0 ? 24 : 19), d);
      s += `<line class="clk-tick" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    }
    const segCls = kind === 'sales' ? ['sales', 'sales', 'sales'] : ['onb', 'search', 'contract'];
    for (let i = 0; i < 3; i++) s += `<path class="clk-track ${segCls[i]}" d="${arc(cx, cy, r, stages[i].deg, stages[i + 1].deg)}"/>`;
    stages.forEach(st => {
      const [x, y] = P(cx, cy, r, st.deg);
      if (st.win) s += `<circle class="clk-dot ${st.cls}" cx="${f(x)}" cy="${f(y)}" r="14"/><path class="clk-check" d="M${f(x - 6)} ${f(y)} L${f(x - 1.5)} ${f(y + 4.5)} L${f(x + 6.5)} ${f(y - 4.5)}"/>`;
      else s += `<circle class="clk-dot ${st.cls}" cx="${f(x)}" cy="${f(y)}" r="9"/>`;
      let lx, ly;
      if (st.deg === 180 || st.deg === 0) { lx = x; ly = cy + o.below; }
      else { [lx, ly] = P(cx, cy, r + o.above, st.deg); }
      s += `<text class="clk-st" x="${f(lx)}" y="${f(ly)}" text-anchor="middle">${st.t}</text><text class="clk-sub" x="${f(lx)}" y="${f(ly + 17)}" text-anchor="middle">${st.s}</text>`;
    });
    const k = kind === 'sales' ? 'sales' : 'acq';
    s += `<text class="clk-eyebrow ${k}" x="${cx}" y="${cy - o.c[0]}" text-anchor="middle">${o.eyebrow}</text>`;
    s += `<text class="clk-title" x="${cx}" y="${cy - o.c[1]}" text-anchor="middle" style="font-size:${o.titleSize}px">${o.title}</text>`;
    s += `<text class="clk-win ${k}" x="${cx}" y="${cy - o.c[2]}" text-anchor="middle">${o.win}</text>`;
    s += `<text class="clk-note" x="${cx}" y="${cy - o.c[3]}" text-anchor="middle">${o.note}</text>`;
    return s;
  }

  const defs = `<defs>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="clk-head" d="M0 0 L10 5 L0 10 z"/></marker>
    <marker id="ah-acq" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="clk-head acq" d="M0 0 L10 5 L0 10 z"/></marker></defs>`;

  function wide(c) {
    const common = { r: 150, cy: 300, above: 56, below: 36, c: [90, 56, 30, 9], titleSize: 27 };
    const sales = dial(Object.assign({ cx: 250, stages: SALES, kind: 'sales', eyebrow: 'SALES CLOCK · PIPEDRIVE', title: 'Win the customer', win: 'Success: Pipedrive Won', note: `median ${c.median_days_to_win} days to Won` }, common));
    const acq = dial(Object.assign({ cx: 870, stages: ACQ, kind: 'acq', eyebrow: 'ACQUISITION CLOCK · JIRA', title: 'Win the property', win: 'Success: Jira CLOSED', note: `${S.int(c.signed)} signed-up clients` }, common));
    const [bx, by] = P(250, 300, 150, 35);
    return `<svg viewBox="0 0 1120 400" role="img" aria-label="Two clocks. Sales clock in Pipedrive: discovers STRSearch, books a call, sales process, Won. Acquisition clock in Jira: client start, property search, Under Contract, CLOSED. A won customer becomes a paying client; since late May the Confidence Call brings the acquisition team in before the purchase.">
      ${defs}${sales}${acq}
      <line class="clk-link" x1="436" y1="300" x2="684" y2="300" marker-end="url(#ah)"/>
      <text class="clk-lab" x="560" y="288" text-anchor="middle">becomes a paying client</text>
      <path class="clk-bridge" d="M${f(bx + 6)} ${f(by - 4)} C 470 150, 640 170, 708 286" marker-end="url(#ah-acq)"/>
      <text class="clk-bridge-t" x="556" y="118" text-anchor="middle">Confidence Call</text>
      <text class="clk-bridge-s" x="556" y="137" text-anchor="middle">since late May 2026, prospects meet the</text>
      <text class="clk-bridge-s" x="556" y="154" text-anchor="middle">acquisition team before they buy</text>
    </svg>`;
  }

  function narrow(c) {
    const common = { r: 128, cy: 250, cx: 210, above: 50, below: 32, c: [82, 50, 26, 7], titleSize: 23 };
    const one = (stages, kind, eyebrow, title, win, note) => `<svg viewBox="0 0 420 312" role="img" aria-label="${eyebrow}">${dial(Object.assign({ stages, kind, eyebrow, title, win, note }, common))}</svg>`;
    return one(SALES, 'sales', 'SALES CLOCK · PIPEDRIVE', 'Win the customer', 'Success: Pipedrive Won', `median ${c.median_days_to_win} days to Won`) +
      `<div class="clk-mid"><span class="arrow">↓</span><span>becomes a paying client</span><span class="cc"><b>Confidence Call</b> · since late May 2026, prospects meet the acquisition team before they buy</span></div>` +
      one(ACQ, 'acq', 'ACQUISITION CLOCK · JIRA', 'Win the property', 'Success: Jira CLOSED', `${S.int(c.signed)} signed-up clients`);
  }

  S.chapter('clocks', {
    n: 1, title: 'One customer, two journeys',
    render(main, D, ch) {
      const body = S.scene(main, { ch, step: 1, of: 1, title: 'Winning a customer and closing a property are two different outcomes' });
      const box = S.h('<div class="board clocks"></div>');
      body.append(box);
      let mode = '';
      const draw = () => {
        const m = box.clientWidth >= 820 ? 'wide' : 'narrow';
        if (m !== mode) { mode = m; box.innerHTML = m === 'wide' ? wide(D.clocks) : narrow(D.clocks); }
      };
      draw();
      if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(draw)).observe(box);
    },
  });
})();
