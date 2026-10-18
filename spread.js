// Pay per hour spread: one row per activity, one dot per contract with a pay-per-hour figure.
// Shows how wide the pay range is, not just the average, and where the good-to-start ones sit.
(function () {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const short = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  // Small, stable vertical offset per contract so dots at the same pay don't hide each other.
  const jitter = (id) => {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return ((Math.abs(h) % 1000) / 1000 - 0.5) * 12;
  };

  // list: contracts to show; rate: id -> pay per hour or null; acts: id -> label.
  function html(list, rate, acts, width) {
    const rows = new Map();
    for (const c of list) {
      const r = rate.get(c.id);
      if (r == null) continue;
      if (!rows.has(c.act)) rows.set(c.act, []);
      rows.get(c.act).push(c);
    }
    const order = [...rows].map(([act, cs]) => ({ act, cs, med: median(cs.map((c) => rate.get(c.id))) }))
      .filter((r) => r.cs.length >= 2).sort((a, b) => b.med - a.med);
    if (!order.length) return `<p class="muted">No contracts here have enough reported run times.</p>`;

    const all = order.flatMap((r) => r.cs.map((c) => rate.get(c.id)));
    const lo = Math.min(...all) / 1.2, hi = Math.max(...all) * 1.2;
    const W = Math.max(300, width), rowH = 30, labelW = W < 520 ? 96 : 150;
    const pad = { l: labelW, r: 14, t: 6, b: 30 };
    const H = pad.t + order.length * rowH + pad.b;
    const sx = (v) => pad.l + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (W - pad.l - pad.r);
    const ticks = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
      for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) ticks.push(v); }

    const grid = ticks.map((v) => `<line class="sp-grid" x1="${sx(v)}" x2="${sx(v)}" y1="${pad.t}" y2="${H - pad.b}"/>
      <text class="sp-tick" x="${sx(v)}" y="${H - pad.b + 16}" text-anchor="middle">${short(v)}</text>`).join("");
    const body = order.map((r, i) => {
      const y = pad.t + i * rowH + rowH / 2;
      const dots = r.cs.sort((a, b) => !!a.starter - !!b.starter).map((c) => {
        const v = rate.get(c.id);
        const tip = `${c.title.replace(/\[([^\]]+)\]/g, (_, t) => t.split("|").pop().toLowerCase())} · ${short(v)}/h · ${short(c.reward)} reward${c.starter ? " · good to start" : ""}`;
        return `<a href="#${esc(c.id)}" class="sp-pt${c.starter ? " starter" : ""}" data-tip="${esc(tip)}">
          <circle class="sp-hit" cx="${sx(v)}" cy="${y + jitter(c.id)}" r="7"/><circle class="sp-dot" cx="${sx(v)}" cy="${y + jitter(c.id)}" r="3.5"/></a>`;
      }).join("");
      return `<text class="sp-label" x="${pad.l - 10}" y="${y + 4}" text-anchor="end">${esc(acts[r.act] || r.act)}</text>
        <line class="sp-row" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/>
        ${dots}
        <line class="sp-med" x1="${sx(r.med)}" x2="${sx(r.med)}" y1="${y - 11}" y2="${y + 11}"><title>Median ${short(r.med)}/h</title></line>`;
    }).join("");
    return `<svg class="sp-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pay per hour of each contract, by activity">${grid}${body}
      <text class="sp-tick" x="${(pad.l + W - pad.r) / 2}" y="${H - 2}" text-anchor="middle">aUEC per hour (log scale)</text></svg>`;
  }

  function card(list, rate, acts, width) {
    return `<section class="ov-card sp-card">
      <header><h3>How pay per hour spreads</h3></header>
      <div class="sp-legend"><span><i class="sp-key starter"></i>Good to start</span><span><i class="sp-key"></i>Needs rank or unlock</span><span><i class="sp-key med"></i>Median</span></div>
      <div class="sp-plot">${html(list, rate, acts, width)}</div>
      <div class="sp-tip" role="tooltip" hidden></div>
      <p class="note">Each dot is a contract with 3+ reported runs. Hover for its name, click to open it. Rows are sorted by median pay. Mining, gathering and Wikelo trades have no hourly figure.</p>
    </section>`;
  }

  // Tooltip follows the hovered or focused dot.
  function bind(root) {
    const show = (e) => {
      const tip = root.querySelector(".sp-tip");
      if (!tip) return;
      const pt = e.target.closest && e.target.closest(".sp-pt");
      if (!pt) { tip.hidden = true; return; }
      const box = root.querySelector(".sp-card").getBoundingClientRect();
      const r = pt.querySelector(".sp-dot").getBoundingClientRect();
      tip.textContent = pt.dataset.tip;
      tip.hidden = false;
      tip.style.left = `${Math.max(8, Math.min(r.left - box.left + 10, box.width - tip.offsetWidth - 8))}px`;
      tip.style.top = `${r.top - box.top - tip.offsetHeight - 8}px`;
    };
    root.addEventListener("mouseover", show);
    root.addEventListener("focusin", show);
    root.addEventListener("mouseleave", () => { const t = root.querySelector(".sp-tip"); if (t) t.hidden = true; });
  }

  window.PaySpread = { card, bind };
})();
