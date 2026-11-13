/* Hero (answers at a glance) + the two clocks. */
(function () {
  'use strict';
  const R = window.R;

  R.story('journey', {
    nav: null,
    render(root, D) {
      const j = D.journey, sp = D.speed, pr = D.progression, th = D.throughput, m = D.meta;
      const est = sp.estimate, mat = pr.mature, al = j.alignment, s = j.sales, ob = sp.observed;
      root.innerHTML = `
      <div class="wrap">
        <div class="eyebrow">STRSearch · Executive Report</div>
        <h1>Client acquisition at a glance</h1>
        <div class="asof"><span class="pill">Static snapshot</span><span>Data as of <b>${R.date(m.asof)}</b></span><span>${R.int(pr.classes.signed)} signed-up clients</span></div>

        <div class="kpis">
          <a class="kpi" href="#speed" style="--kc:var(--c-uc)"><span class="v num">${ob.uc.median}<small>days</small></span><span class="l">Median to Under Contract</span><span class="s">Clients who got there</span></a>
          <a class="kpi" href="#speed" style="--kc:var(--c-uc-soft)"><span class="v num">~${est.uc.primary.median}<small>days</small></span><span class="l">Until half of all clients are under contract</span><span class="s">Estimate, incl. clients still searching</span></a>
          <a class="kpi" href="#progression" style="--kc:var(--c-closed)"><span class="v num">${R.pct(mat.ever_closed_share)}</span><span class="l">Have closed</span><span class="s">Clients who started 6+ months ago</span></a>
          <a class="kpi" href="#throughput" style="--kc:var(--c-neutral)"><span class="v num">${R.ratio(th.ratio.uc_all)}</span><span class="l">Contracts per month since June</span><span class="s">vs Jan–May · new clients ${R.ratio(th.ratio.new)}</span></a>
        </div>
      </div>

      <div class="wrap" id="clocks" style="padding-top:48px">
        <div class="sec-head"><div class="eyebrow">The client journey</div><h2>Two clocks: winning the client, then winning the property</h2></div>
        <div class="clocks">
          <div class="clock sales">
            <h3>Sales clock <span>Pipedrive</span></h3>
            <div class="track">
              <div class="m" style="--mc:var(--gold)"><b>Prospect</b><span>books a call</span></div>
              <div class="m" style="--mc:var(--gold)"><b>Sales process</b><span>Confidence Call</span></div>
              <div class="m" style="--mc:var(--gold)"><b>Won</b><em class="num">${s.days_to_win.median}<small>days</small></em><span>median</span></div>
            </div>
          </div>
          <div class="clock acq">
            <h3>Acquisition clock <span>Jira</span></h3>
            <div class="track">
              <div class="m" style="--mc:var(--c-neutral)"><b>Client start</b><span>onboarding call</span></div>
              <div class="m" style="--mc:var(--c-wait)"><b>Search</b><span>2–8+ weeks</span></div>
              <div class="m" style="--mc:var(--c-uc)"><b>Under Contract</b><em class="num">${ob.uc.median}<small>days</small></em><span>median</span></div>
              <div class="m" style="--mc:var(--c-closed)"><b>CLOSED</b><em class="num">${ob.closed.median}<small>days</small></em><span>median</span></div>
            </div>
          </div>
        </div>
        <p class="clock-note">Different starting points, so the two don't add up. Since late May, Confidence Call clients start acquisition about ${Math.abs(al.since_nce.median)} days <i>before</i> they buy.</p>
      </div>`;
    },
  });
})();
