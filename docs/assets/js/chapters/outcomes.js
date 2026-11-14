/* Chapter 3: how many clients reach their destination? Who they are -> where they are -> milestones reached. */
(function () {
  'use strict';
  const S = window.S;

  function sankey(node, oc) {
    const g = Object.fromEntries(oc.active_groups.map(x => [x.group, x]));
    const ina = Object.fromEntries(oc.inactive_statuses.map(x => [x.status, x.n]));
    S.chart(node, t => {
      const lab = { backgroundColor: t.surface, borderRadius: 5, padding: [3, 7] };
      const nodes = [
        { name: 'Signed-up clients', value: oc.signed, itemStyle: { color: t.ink2 }, label: Object.assign({ position: 'left' }, lab) },
        { name: 'Active', value: oc.active, itemStyle: { color: t.acq }, label: lab },
        { name: 'Inactive', value: oc.inactive, itemStyle: { color: t.hold }, label: lab },
        { name: 'Still searching', value: g['Searching'].n, itemStyle: { color: t.wait } },
        { name: 'Under contract / inspection', value: g['Under contract'].n, itemStyle: { color: t.uc } },
        { name: 'CLOSED', value: g['Closed'].n, itemStyle: { color: t.closed } },
        { name: 'Post-close', value: g['Post-close'].n, itemStyle: { color: t.closed2 } },
        { name: 'Paused', value: ina['Paused'], itemStyle: { color: t.hold } },
        { name: 'Refunded', value: ina['Refunded'], itemStyle: { color: t.hold } },
        { name: 'Additional service', value: ina['Additional Service'], itemStyle: { color: t.hold2 } },
      ];
      const links = [
        ['Signed-up clients', 'Active', oc.active], ['Signed-up clients', 'Inactive', oc.inactive],
        ['Active', 'Still searching', g['Searching'].n], ['Active', 'Under contract / inspection', g['Under contract'].n],
        ['Active', 'CLOSED', g['Closed'].n], ['Active', 'Post-close', g['Post-close'].n],
        ['Inactive', 'Paused', ina['Paused']], ['Inactive', 'Refunded', ina['Refunded']], ['Inactive', 'Additional service', ina['Additional Service']],
      ].map(([source, target, value]) => ({ source, target, value }));
      const tip = { 'Still searching': g['Searching'].statuses, 'Under contract / inspection': g['Under contract'].statuses, 'Post-close': g['Post-close'].statuses };
      return Object.assign(S.base(t), {
        tooltip: Object.assign(S.base(t).tooltip, {
          trigger: 'item',
          formatter: p => p.dataType === 'edge' ? `${p.data.source} → ${p.data.target}: <b>${p.data.value}</b>` :
            `<b>${p.name}</b>: ${p.value}` + (tip[p.name] ? '<br>' + Object.entries(tip[p.name]).map(([k, v]) => `${k} ${v}`).join(' · ') : ''),
        }),
        series: [{
          type: 'sankey', left: 196, right: 236, top: 8, bottom: 8, nodeWidth: 18, nodeGap: 16, layoutIterations: 0, draggable: false,
          emphasis: { focus: 'adjacency' }, data: nodes, links,
          lineStyle: { color: 'target', opacity: 0.3, curveness: 0.5 },
          label: { color: t.ink, fontSize: 14, fontWeight: 600, formatter: p => `${p.name}  {v|${p.value}}`, rich: { v: { fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 16, color: t.ink } } },
        }],
      });
    });
  }

  function ring(share, num, den, colorVar, name) {
    const R = 100, C = 2 * Math.PI * R;
    return `<div class="ring"><svg viewBox="0 0 250 250" role="img" aria-label="${name}: ${S.pct(share)}, ${num} of ${den}">
        <circle class="bg" cx="125" cy="125" r="${R}" stroke-width="22"/>
        <circle class="fg" cx="125" cy="125" r="${R}" stroke-width="22" style="stroke:var(${colorVar})" stroke-dasharray="${(C * share).toFixed(1)} ${C.toFixed(1)}"/>
        <text class="pct" x="125" y="122" text-anchor="middle" dominant-baseline="middle">${S.pct(share)}</text>
        <text class="of" x="125" y="160" text-anchor="middle">${S.int(num)} of ${S.int(den)}</text>
      </svg><span class="name"><i style="background:var(${colorVar})"></i>${name}</span></div>`;
  }

  S.chapter('outcomes', {
    n: 3, title: 'How many clients reach their destination?',
    render(main, D, ch) {
      const oc = D.outcomes, at = oc.attainment, g = Object.fromEntries(oc.active_groups.map(x => [x.group, x.n]));
      const closedOrPost = g['Closed'] + g['Post-close'];

      let body = S.scene(main, { ch, step: 1, of: 2, label: 'Who they are, where they are now', title: `${S.int(oc.active)} Active clients, but only ${S.int(g['Searching'])} are still searching` });
      body.innerHTML = `<div class="figs">
          <div class="fig"><span class="v num">${S.int(oc.active)}</span><span class="l"><i style="background:var(--acq)"></i>Active, of ${S.int(oc.signed)} signed-up</span></div>
          <div class="fig"><span class="v num">${S.int(g['Searching'])}</span><span class="l"><i style="background:var(--wait)"></i>still searching</span></div>
          <div class="fig"><span class="v num">${S.int(closedOrPost)}</span><span class="l"><i style="background:var(--closed)"></i>Active and already CLOSED or post-close</span></div>
        </div>
        <div class="board"><div class="chart h-xl" id="sankeyChart" role="img" aria-label="${oc.signed} signed-up clients: ${oc.active} Active (${g['Searching']} searching, ${g['Under contract']} under contract or inspection, ${g['Closed']} CLOSED, ${g['Post-close']} post-close) and ${oc.inactive} Inactive."></div></div>
        <p class="cap">Active is STRSearch's reporting class: it includes clients who have already bought a property.</p>`;
      sankey(S.$('#sankeyChart', body), oc);

      body = S.scene(main, { ch, step: 2, of: 2, label: 'Milestones reached', title: `${S.pct(at.uc_share)} of Active clients have recorded Under Contract, ${S.pct(at.closed_share)} CLOSED` });
      body.innerHTML = `<div class="board"><div class="rings">
          ${ring(at.uc_share, at.uc, at.active, '--uc', 'Under Contract recorded')}
          ${ring(at.closed_share, at.closed, at.active, '--closed', 'CLOSED recorded')}
        </div></div>
        <p class="cap">Historical attainment of today's ${S.int(at.active)} Active clients, not a lifetime conversion rate.</p>`;
    },
  });
})();
