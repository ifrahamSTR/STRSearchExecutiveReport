/* Summary: the three answers up front, then the client journey (sales clock + acquisition clock). */
(function () {
  'use strict';
  const R = window.R;

  function overlapSvg(al) {
    // Acquisition start relative to the Pipedrive sale (days). Dot = median, bar = middle half of clients.
    const lo = -20, hi = 10, W = 380, x0 = 150, x1 = W - 10;
    const x = v => x0 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (x1 - x0);
    const row = (y, label, a, cls) => `
      <text x="0" y="${y + 4}" class="ov-l">${label}</text>
      <rect x="${x(a.p25)}" y="${y - 5}" width="${Math.max(2, x(a.p75) - x(a.p25))}" height="10" rx="5" class="ov-iqr ${cls}"/>
      <circle cx="${x(a.median)}" cy="${y}" r="6" class="ov-dot ${cls}"/>
      <text x="${x(a.median)}" y="${y - 11}" text-anchor="middle" class="ov-v">${a.median > 0 ? '+' : ''}${a.median}d</text>`;
    const ticks = [-20, -15, -10, -5, 0, 5, 10].map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="22" y2="${v === 0 ? 132 : 126}" class="${v === 0 ? 'ov-zero' : 'ov-grid'}"/><text x="${x(v)}" y="144" text-anchor="middle" class="ov-t">${v > 0 ? '+' : ''}${v}</text>`).join('');
    return `<svg viewBox="0 0 ${W} 166" role="img" aria-label="Acquisition start relative to the sale: before late May 2026 a median of ${al.before.median} days after; since then ${al.since_nce.median} days for Confidence Call clients and ${al.since_other.median} for others.">
      <style>.ov-l{font:500 12px Inter,sans-serif;fill:var(--ink-2)}.ov-t{font:11px Inter,sans-serif;fill:var(--muted)}.ov-v{font:600 11px Inter,sans-serif;fill:var(--ink-strong)}
      .ov-grid{stroke:var(--grid)}.ov-zero{stroke:var(--gold);stroke-width:1.5}.ov-iqr{fill:var(--c-neutral-2)}.ov-iqr.new{fill:var(--c-uc-soft)}.ov-dot{fill:var(--c-neutral);stroke:var(--surface);stroke-width:2}.ov-dot.new{fill:var(--c-uc)}</style>
      ${ticks}
      <text x="${x(0)}" y="14" text-anchor="middle" class="ov-t" style="fill:var(--gold);font-weight:600">Sale won</text>
      ${row(44, 'Before late May', al.before, 'old')}
      ${row(78, 'Since: Confidence Call', al.since_nce, 'new')}
      ${row(112, 'Since: other clients', al.since_other, 'old')}
      <text x="${x1}" y="160" text-anchor="end" class="ov-t">days from sale to client start</text>
    </svg>`;
  }

  R.story('journey', {
    nav: null,
    render(root, D) {
      const j = D.journey, sp = D.speed, pr = D.progression, th = D.throughput, m = D.meta;
      const dist = sp.distribution.uc, est = sp.estimate, mat = pr.mature;
      const al = j.alignment, s = j.sales;
      const ucEst = est.uc.primary.median, clEst = est.closed.primary.median;
      root.innerHTML = `
      <div class="wrap">
        <div class="eyebrow">Executive Performance Report · Client acquisition</div>
        <h1>Contracts cluster between day ${dist.dense_half.from} and day ${dist.dense_half.to}, and output kept pace with the summer surge until refunds rose this autumn</h1>
        <p class="lede">How quickly clients reach Under Contract and CLOSED, how many get there, and whether the acquisition team is keeping pace with new clients. Built from the Jira client record, with the Pipedrive sales clock for context.</p>
        <div class="asof"><span class="pill">Static snapshot</span><span>Data as of <b>${R.date(m.asof)}</b></span><span>Jira ${m.snapshots.jira.slice(0, 10)} · Pipedrive ${m.snapshots.pipedrive.slice(0, 10)}</span><span>${R.int(pr.classes.signed)} signed-up clients</span></div>

        <div class="answers">
          <a class="answer" href="#speed">
            <span class="q">How quickly do clients reach Under Contract?</span>
            <span class="big num">${dist.median}<small>days median</small></span>
            <p>For clients who went under contract; about half did so between day ${dist.dense_half.from} and ${dist.dense_half.to}. Counting every client, half are under contract within about <b>${ucEst} days</b> and closed within about <b>${clEst}</b>.</p>
            <span class="go">Acquisition speed →</span>
          </a>
          <a class="answer" href="#progression">
            <span class="q">How many clients reach Under Contract and CLOSED?</span>
            <span class="big num">${R.pct(mat.ever_closed_share)}<small>have closed</small></span>
            <p>Of the ${R.int(mat.n)} clients who started at least six months ago, ${R.pct(mat.uc_at_least_share)} reached a contract and ${R.pct(mat.ever_closed_share)} closed. ${R.pct((mat.stages.Paused + mat.stages.Refunded) / mat.n)} paused or were refunded.</p>
            <span class="go">Client progression →</span>
          </a>
          <a class="answer" href="#throughput">
            <span class="q">Is acquisition output keeping pace with new clients?</span>
            <span class="big num">${R.ratio(th.ratio.uc_all)}–${R.ratio(th.ratio.uc)}<small>contracts per month</small></span>
            <p>Through the summer cohorts, yes: new clients rose ${R.ratio(th.ratio.new)} and contracts kept up. The open pool's fall from ${th.since_peak.start} to ${th.since_peak.end} since September is mostly clients leaving (${th.since_peak.refunded} refunds), not faster contracts.</p>
            <span class="go">Operational throughput →</span>
          </a>
        </div>

        <div class="journey" aria-labelledby="journey-title">
          <div class="journey-head">
            <h2 id="journey-title">The client journey runs on two clocks</h2>
            <p>Different start events. Don't add the two together.</p>
          </div>
          <div class="clocks">
            <div class="clock sales">
              <h3>Sales clock</h3>
              <p class="sys">Pipedrive · how we win paying clients</p>
              <ol class="steps">
                <li><span class="dot"></span><b>Prospect</b><span>books a call</span></li>
                <li><span class="dot"></span><b>Sales process</b><span>Confidence Call + sales call</span></li>
                <li><span class="dot"></span><b>Won</b><span>service purchased</span></li>
                <li><span class="dot"></span><b>Paying client</b><span>handed to Acquisitions</span></li>
              </ol>
              <div class="clock-stats">
                <span><strong class="num">${s.days_to_win.median}</strong>days, deal created to won (median)</span>
                <span><strong class="num">${Math.round(s.post.won_avg)}</strong>wins a month since June (${Math.round(s.pre.won_avg)} before)</span>
              </div>
            </div>
            <div class="clock acq">
              <h3>Acquisition clock</h3>
              <p class="sys">Jira · how we help clients buy a property</p>
              <ol class="steps">
                <li><span class="dot"></span><b>Client start</b><span>onboarding call date</span></li>
                <li class="s-search"><span class="dot"></span><b>Property search</b><span>2 to 8+ week check-ins</span></li>
                <li class="s-uc"><span class="dot"></span><b>Under Contract</b><span>${dist.median} days typical*</span></li>
                <li class="s-closed"><span class="dot"></span><b>CLOSED</b><span>${sp.observed.closed.median} days typical*</span></li>
              </ol>
              <div class="clock-stats">
                <span><strong class="num">${ucEst}</strong>days to a contract, all clients (estimate)</span>
                <span><strong class="num">${clEst}</strong>days to close, all clients (estimate)</span>
                <span><strong class="num">${sp.uc_to_close_typical}</strong>days from contract to close (median)</span>
              </div>
            </div>
          </div>
          <div class="overlap">
            <div class="overlap-fig">${overlapSvg(al)}</div>
            <div>
              <p style="margin:0 0 6px"><b>For Confidence Call clients, the clocks now overlap.</b> Before late May the acquisition clock started a median of ${al.before.median} days after the sale. Clients on the Confidence Call path (${R.int(al.since_nce.n)} since late May) start a median of ${Math.abs(al.since_nce.median)} days <i>before</i> buying; other clients still start about ${al.since_other.median} days after. Days counted from the client start therefore include some pre-sale time for the newest clients.</p>
              <p style="margin:0;font-size:13px;color:var(--muted)">*Median for clients who reached the milestone. Client start = onboarding-call date, or the date the Jira record was created when no call date is set. Bars show the middle half of clients.</p>
            </div>
          </div>
        </div>

        <div class="context">
          <span class="tag">Context</span>
          <div>
            <p><b>Late May to June 2026:</b> the new Complete offer launched, and the sales process gained a Confidence Call, where prospects meet Acquisitions and enter Jira before buying. Monthly wins rose from ${Math.round(s.pre.won_avg)} to ${Math.round(s.post.won_avg)}, and the Complete package is ${R.pct(s.post.complete_share)} of wins since June. The two changes happened together, so their separate effects can't be measured.</p>
            <p>Internally reported Confidence Call conversion is about 30%, against 10–12% before. This data cannot confirm that figure. From June, no-show calls also move to a separate SDR pipeline, so Pipedrive volumes before and after June are not directly comparable.</p>
          </div>
        </div>
      </div>`;
    },
  });
})();
