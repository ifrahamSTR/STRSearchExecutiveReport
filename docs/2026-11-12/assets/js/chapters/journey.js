/* Chapter 1: the client journey. A two-lane route map (Sales · Pipedrive / Acquisition · Jira), drawn for
   the route before 27 May 2026 (sales first, then acquisition) and for the New Client Experience (prospects
   enter Jira and meet Acquisitions in the Confidence Call before they buy, so the two clocks overlap). */
(function () {
  'use strict';
  const S = window.S;
  const width = n => Math.round(n.label.length * 7.4 + 30 + (n.win ? 18 : 0));

  function draw(J) {
    const sw = J.start_vs_won, st = J.presale.statuses;
    const A = { title: 'Before 27 May 2026', sub: 'Sales first, then acquisition', y: 30, sales: 98, acq: 186 };
    const B = { title: 'New Client Experience · since 27 May 2026', sub: 'Prospects meet Acquisitions before they buy', y: 268, sales: 340, acq: 428, exit: 506 };
    const N = {};
    const add = (id, x, y, label, cls, o = {}) => { N[id] = Object.assign({ id, x, y, label, cls }, o); N[id].w = width(N[id]); };
    // route before 27 May
    add('a1', 262, A.sales, 'Books a call', 's');
    add('a2', 395, A.sales, 'Sales call', 's');
    add('a3', 520, A.sales, 'Won', 'won', { win: true, above: 'buys STRSearch' });
    add('b1', 632, A.acq, 'Client Start', 'a', { subs: [['⚑ clock starts', 'flag'], ['onboarding call', '']] });
    add('b2', 752, A.acq, 'Search', 'search', { subs: [['2–8+ week check-ins', '']] });
    add('b3', 880, A.acq, 'Under Contract', 'uc', { subs: [['incl. inspection', '']] });
    add('b4', 1035, A.acq, 'CLOSED', 'closed', { win: true, subs: [['buys a property', '']] });
    // New Client Experience
    add('c1', 262, B.sales, 'Books a call', 's');
    add('c2', 520, B.sales, 'Won', 'won', { win: true });
    add('d1', 262, B.acq, 'New Clients', 'a', { subs: [[`${S.int(st['New Clients'])} awaiting the call`, 'count']] });
    add('d2', 412, B.acq, 'Confidence Call', 'a', { above: '⚑ clock starts', aboveCls: 'flag', subs: [[`${S.int(st['Onboarding Completed'])} deciding`, 'count']] });
    add('d3', 632, B.acq, 'Client Start', 'a', { subs: [['search begins', '']] });
    add('d4', 752, B.acq, 'Search', 'search');
    add('d5', 880, B.acq, 'Under Contract', 'uc');
    add('d6', 1035, B.acq, 'CLOSED', 'closed', { win: true, subs: [['buys a property', '']] });
    add('x1', 590, B.exit, 'Services Declined', 'exit', { subs: [[`${S.int(st['Services Declined'])} declined`, 'count']] });

    const R = n => n.x + n.w / 2, L = n => n.x - n.w / 2;
    const h = (a, b) => `<path class="je" d="M${R(N[a]) + 4} ${N[a].y} L${L(N[b]) - 7} ${N[b].y}" marker-end="url(#ja)"/>`;
    const elbow = (a, b) => { const p = N[a], q = N[b], dy = q.y > p.y ? -25 : 25; return `<path class="je" d="M${R(p) + 4} ${p.y} C${q.x} ${p.y} ${q.x} ${p.y} ${q.x} ${q.y + dy}" marker-end="url(#ja)"/>`; };
    const v = (a, b) => `<path class="je" d="M${N[a].x} ${N[a].y + 21} L${N[b].x} ${N[b].y - 25}" marker-end="url(#ja)"/>`;
    const exit = (a, b) => { const p = N[a], q = N[b], x = L(p) + 14; return `<path class="je x" d="M${x} ${p.y + 21} C${x} ${q.y} ${x + 30} ${q.y} ${L(q) - 7} ${q.y}" marker-end="url(#jx)"/>`; };

    const node = n => {
      const check = n.win ? `<path class="jn-check" d="M${L(n) + 14} ${n.y} l4 4 l8 -8"/>` : '';
      let s = `<g class="jn ${n.cls}"><rect x="${L(n)}" y="${n.y - 18}" width="${n.w}" height="36" rx="18"/>${check}<text x="${n.x + (n.win ? 9 : 0)}" y="${n.y + 4.5}" text-anchor="middle">${n.label}</text></g>`;
      if (n.above) s += `<text class="jsub ${n.aboveCls || ''}" x="${n.x}" y="${n.y - 27}" text-anchor="middle">${n.above}</text>`;
      (n.subs || []).forEach(([t, c], i) => { s += `<text class="jsub ${c}" x="${n.x}" y="${n.y + 34 + i * 15}" text-anchor="middle">${t}</text>`; });
      return s;
    };
    const lanes = P => `
      <text class="jt" x="20" y="${P.y}">${P.title}</text><text class="jts" x="20" y="${P.y + 18}">${P.sub}</text>
      <rect class="jband s" x="166" y="${P.sales - 26}" width="944" height="52" rx="26"/>
      <rect class="jband a" x="166" y="${P.acq - 26}" width="944" height="52" rx="26"/>
      <text class="jlane s" x="20" y="${P.sales - 1}">SALES</text><text class="jlsub" x="20" y="${P.sales + 15}">Pipedrive</text>
      <text class="jlane a" x="20" y="${P.acq - 1}">ACQUISITION</text><text class="jlsub" x="20" y="${P.acq + 15}">Jira</text>`;

    const gap = sw.classic.median, ov = Math.abs(sw.nce.median);
    return `<svg viewBox="0 0 1120 560" role="img" aria-label="Client journey. Before 27 May 2026: book a call, sales call, Won, then the acquisition clock starts at the onboarding call about ${gap} days later, followed by search, Under Contract and CLOSED. Since 27 May 2026: after booking a call the prospect enters Jira as a New Client and meets Acquisitions in the Confidence Call, where the acquisition clock starts; then they either buy (Won, about ${ov} days later) and continue to search, Under Contract and CLOSED, or decline.">
      <defs>
        <marker id="ja" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="jhead" d="M0 0 L10 5 L0 10 z"/></marker>
        <marker id="jx" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="jhead x" d="M0 0 L10 5 L0 10 z"/></marker>
      </defs>
      ${lanes(A)}${lanes(B)}
      <rect class="joverlap" x="330" y="${B.sales - 34}" width="248" height="${B.acq - B.sales + 60}" rx="16"/>
      <text class="jlab a" x="344" y="${B.sales - 6}">clocks overlap</text>
      <text class="jlab" x="344" y="${B.sales + 10}">≈ ${ov} days before Won</text>
      ${h('a1', 'a2')}${h('a2', 'a3')}${elbow('a3', 'b1')}${h('b1', 'b2')}${h('b2', 'b3')}${h('b3', 'b4')}
      <text class="jlab" x="${N.b1.x + 10}" y="${(A.sales + A.acq) / 2 + 4}">+${gap} days after Won</text>
      ${v('c1', 'd1')}<text class="jsub" x="${N.c1.x - 10}" y="${(B.sales + B.acq) / 2 + 4}" text-anchor="end">onboarding form</text>
      ${h('d1', 'd2')}${elbow('d2', 'c2')}${elbow('c2', 'd3')}${h('d3', 'd4')}${h('d4', 'd5')}${h('d5', 'd6')}${exit('d2', 'x1')}
      ${Object.values(N).map(node).join('')}
    </svg>`;
  }

  S.chapter('journey', {
    n: 1, title: 'The Client Journey',
    render(main, D, ch) {
      const J = D.journey, sw = J.start_vs_won;
      const body = S.scene(main, { ch, step: 1, of: 1, title: 'Two finish lines: a customer buys STRSearch, then buys a property' });
      body.innerHTML = `<div class="board diagram"><div class="scroll">${draw(J)}</div>
          <div class="legend">
            <span><i class="pill" style="background:var(--sales)"></i>Won · the customer buys STRSearch (Pipedrive)</span>
            <span><i class="pill" style="background:var(--closed)"></i>CLOSED · the client buys a property (Jira)</span>
            <span><b class="flag">⚑</b>where the acquisition clock starts</span>
            <span><i class="dash" style="color:var(--hold)"></i>prospect declines</span>
          </div></div>
        <p class="cap">Since 27 May, Confidence Call clients start the acquisition clock a median ${Math.abs(sw.nce.median)} days before buying (${S.int(sw.nce.n)} clients); others still start about ${sw.other_since.median} days after.</p>`;
    },
  });
})();
