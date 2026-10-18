// Contracts viewer. Overview: the ways to make money, with pay, the best UEC per hour and where to
// start. Search: every contract, with filters. Detail: rewards, requirements, where, cargo, enemies.
(function () {
  const META = window.CONTRACTS_META || {};
  const PLACES = window.CONTRACT_PLACES || [];
  const SHIPS = window.CONTRACT_SHIPS || [];
  const BLUEPRINTS = window.CONTRACT_BLUEPRINTS || [];
  const TEXT = window.CONTRACT_TEXT || [];
  const GUIDE = window.ACTIVITIES || {};
  const ACTS = META.activities || {};
  const contracts = window.CONTRACTS || [];
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const SYSTEMS = ["Stanton", "Pyro", "Nyx"];
  const SITE = window.SITE || {};
  const siteHref = (id) => ((SITE.links || []).find((l) => l.id === id) || {}).href;
  // Names link to their entry in the glossary app (it finds the entry by name).
  const glossaryHref = ((window.SITE || {}).links || []).find((l) => l.id === "glossary")?.href;
  const lookUp = (name) => (glossaryHref && name ? `<a class="lookup" href="${esc(glossaryHref)}#find/${encodeURIComponent(name)}" title="Look up ${esc(name)} in the glossary">${esc(name)}</a>` : esc(name));

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
  const short = (n) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
  const $ = (id) => document.getElementById(id);
  const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  const human = (s) => String(s || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

  // "[TARGET] needs stomping" -> the token is filled in by the game when the contract is offered.
  const withTokens = (s) => esc(s).replace(/\[([^\]]+)\]/g, (_, t) => `<span class="tok">${esc(human(t.split("|").pop()))}</span>`);

  // ── Pay per hour ──────────────────────────────────────────────────────────
  // From players' reported median time per run (SCMDB). Mining and trades only time the hand-in,
  // so they're left out. Runs shorter than 5 minutes count as 5 to allow for getting there.
  const NO_RATE = new Set(["mining", "wikelo", "gathering"]);
  const MIN_RUNS = 3;
  function perHour(c) {
    const t = c.community;
    if (!t || !c.reward || !t.mins || t.runs < MIN_RUNS || NO_RATE.has(c.act)) return null;
    return Math.round((c.reward * 60) / Math.max(t.mins, 5));
  }
  const RATE = new Map(contracts.map((c) => [c.id, perHour(c)]));

  const place = (i) => PLACES[i] || ["?", "area", null, null];
  const placeLabel = (i) => {
    const [name, , , on] = place(i);
    return on ? `${name} (${on})` : name;
  };
  // Places link straight to the locations app when the refresh found them there.
  function placeLink(i) {
    const locId = place(i)[4];
    const loc = siteHref("locations");
    const label = esc(placeLabel(i));
    if (!loc || !locId) return `<span class="chip-static">${label}</span>`;
    return `<a class="chip-static" href="${esc(loc)}#${encodeURIComponent(locId)}">${label}</a>`;
  }

  // SCMDB links a contract by a hash of its internal name (same function as scmdb.net).
  function scmdbKey(t) {
    let s = 5381;
    for (let i = 0; i < t.length; i++) s = ((s << 5) + s + t.charCodeAt(i)) & 4294967295;
    return (s >>> 0).toString(36);
  }

  const VIEW_KEY = "sc-contracts:view";
  const SYSTEM_KEY = "sc-contracts:system";
  const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } };

  const state = {
    view: read(VIEW_KEY, "overview"),
    system: read(SYSTEM_KEY, ""),
    query: "",
    act: "",
    sort: "reward",
    legal: "",
    flags: new Set(),
    selected: null,
  };

  // ── Search ────────────────────────────────────────────────────────────────
  // Plain words match the title, contractor, type, places, cargo and rewards.
  // Terms: act: by: type: in: vs: reward: rank: has: is:
  const haystacks = new Map(
    contracts.map((c) => [
      c.id,
      [
        c.title, ...(c.alt || []), c.by, c.type, ACTS[c.act], ...(c.sys || []), ...(c.offered || []), ...(c.near || []),
        ...(c.at || []).map((i) => place(i)[0]), ...(c.to || []).map((i) => place(i)[0]),
        ...(c.cargo || []).map((r) => r[0]), ...(c.items || []).map((r) => r[0]),
        ...(c.bp || []).flatMap(([i]) => BLUEPRINTS[i] || []),
        c.illegal ? "illegal" : "legal",
      ].filter(Boolean).join(" ").toLowerCase(),
    ])
  );
  const enemyShips = (c) => ((c.enemies || {}).groups || []).flatMap((g) => (g[3] != null ? SHIPS[g[3]] : []));

  const num = (s) => {
    const m = String(s).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)([km]?)$/);
    return m ? parseFloat(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1) : NaN;
  };
  function compare(expr, value) {
    if (value == null) return false;
    const range = expr.match(/^(.+)\.\.(.+)$/);
    if (range) return value >= num(range[1]) && value <= num(range[2]);
    const m = expr.match(/^(>=|<=|>|<|=)?(.+)$/);
    const n = num(m[2]);
    if (isNaN(n)) return false;
    return { ">=": value >= n, "<=": value <= n, ">": value > n, "<": value < n }[m[1]] ?? value === n;
  }

  const TERMS = ["act", "by", "type", "in", "vs", "reward", "rank", "has", "is"];
  function parse(q) {
    return (q.match(/-?\w+:"[^"]*"|-?"[^"]*"|\S+/g) || []).map((raw) => {
      let t = raw;
      const neg = t.startsWith("-") && t.length > 1;
      if (neg) t = t.slice(1);
      const m = t.match(new RegExp(`^(${TERMS.join("|")}|system|sys):(.+)$`, "i"));
      const val = (m ? m[2] : t).replace(/^"|"$/g, "").toLowerCase();
      let key = m ? m[1].toLowerCase() : "text";
      if (key === "system" || key === "sys") key = "in";
      return { raw, neg, key, val };
    }).filter((t) => t.val);
  }
  const HAS = {
    blueprint: (c) => !!c.bp, blueprints: (c) => !!c.bp, bp: (c) => !!c.bp,
    items: (c) => !!c.items, item: (c) => !!c.items,
    cargo: (c) => !!(c.cargo && c.cargo.length), enemies: (c) => !!c.enemies, ships: (c) => !!c.enemies,
    buyin: (c) => !!c.buyIn, times: (c) => !!c.community, rate: (c) => RATE.get(c.id) != null, rep: (c) => !!c.rep,
  };
  const IS = {
    legal: (c) => !c.illegal, illegal: (c) => c.illegal, starter: (c) => !!c.starter,
    shareable: (c) => !!c.share, share: (c) => !!c.share, solo: (c) => !c.share,
    event: (c) => !!c.event, off: (c) => !!c.off, once: (c) => !!c.once, story: (c) => c.cat === "story", career: (c) => c.cat === "career",
  };
  function test(t, c) {
    let ok;
    const v = t.val;
    if (t.key === "act") ok = c.act === v || (ACTS[c.act] || "").toLowerCase().includes(v);
    else if (t.key === "by") ok = (c.by || "").toLowerCase().includes(v);
    else if (t.key === "type") ok = (c.type || "").toLowerCase().includes(v);
    else if (t.key === "in") {
      ok = (c.sys || []).some((s) => s.toLowerCase() === v) ||
        [...(c.offered || []), ...(c.near || [])].some((s) => s.toLowerCase().includes(v)) ||
        [...(c.at || []), ...(c.to || [])].some((i) => place(i)[0].toLowerCase().includes(v) || (place(i)[3] || "").toLowerCase().includes(v));
    } else if (t.key === "vs") ok = enemyShips(c).some((s) => s.toLowerCase().includes(v));
    else if (t.key === "reward") ok = compare(v, c.reward);
    else if (t.key === "rank") ok = compare(v, c.rank ? c.rank[0] : 0);
    else if (t.key === "has") ok = (HAS[v] || (() => false))(c);
    else if (t.key === "is") ok = (IS[v] || (() => false))(c);
    else ok = haystacks.get(c.id).includes(v);
    return t.neg ? !ok : ok;
  }

  const FLAGS = [
    ["starter", "Good to start (no rank or unlock needed)"],
    ["shareable", "Can share with friends"],
    ["blueprint", "Gives blueprints"],
    ["times", "Has player run times"],
    ["off", "Include events that aren't running"],
  ];
  const SORTS = { reward: "Highest reward", rate: "Best UEC per hour", quick: "Quickest (player times)", name: "Name" };
  const LEGAL = { "": "Any", legal: "Legal only", illegal: "Illegal only" };

  function base(c) {
    return (!state.system || (c.sys || []).includes(state.system)) && (!c.off || state.flags.has("off"));
  }
  function results() {
    const terms = parse(state.query);
    const wantsOff = terms.some((t) => t.key === "is" && t.val === "off" && !t.neg);
    const list = contracts.filter((c) =>
      (!state.system || (c.sys || []).includes(state.system)) &&
      (!c.off || state.flags.has("off") || wantsOff) &&
      (!state.act || c.act === state.act) &&
      (!state.legal || (state.legal === "illegal") === c.illegal) &&
      (!state.flags.has("starter") || c.starter) &&
      (!state.flags.has("shareable") || c.share) &&
      (!state.flags.has("blueprint") || c.bp) &&
      (!state.flags.has("times") || c.community) &&
      terms.every((t) => test(t, c))
    );
    const by = {
      reward: (a, b) => (b.reward || 0) - (a.reward || 0),
      rate: (a, b) => (RATE.get(b.id) ?? -1) - (RATE.get(a.id) ?? -1) || (b.reward || 0) - (a.reward || 0),
      quick: (a, b) => ((a.community || {}).mins ?? 1e9) - ((b.community || {}).mins ?? 1e9),
      name: () => 0,
    }[state.sort];
    return list.sort((a, b) => by(a, b) || a.title.localeCompare(b.title));
  }

  // ── Overview ──────────────────────────────────────────────────────────────
  const link = (c, text) => `<a href="#${esc(c.id)}" class="c-link">${withTokens(text || c.title)}</a>`;
  const rateText = (c) => (RATE.get(c.id) != null ? `${short(RATE.get(c.id))}/h` : "");

  function actCard(act, list) {
    const g = GUIDE[act] || {};
    const paid = list.map((c) => c.reward).filter(Boolean);
    const rated = list.filter((c) => RATE.get(c.id) != null).sort((a, b) => RATE.get(b.id) - RATE.get(a.id));
    const starters = list.filter((c) => c.starter).sort((a, b) => (RATE.get(b.id) ?? 0) - (RATE.get(a.id) ?? 0) || (b.reward || 0) - (a.reward || 0));
    const illegal = list.filter((c) => c.illegal).length;
    const who = Object.entries(list.reduce((m, c) => (c.by && (m[c.by] = (m[c.by] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
    const row = (label, html) => (html ? `<div class="ov-row"><dt>${label}</dt><dd>${html}</dd></div>` : "");
    return `<section class="ov-card act-${act}">
      <header><h3><a href="?q=${encodeURIComponent(`act:${act}`)}" data-act="${esc(act)}">${esc(ACTS[act])}</a></h3><span class="muted">${fmt(list.length)}</span></header>
      ${g.summary ? `<p class="ov-sum">${esc(g.summary)}</p>` : ""}
      <dl class="ov">
        ${row("Pays", paid.length ? `${short(median(paid))} typical, up to ${short(Math.max(...paid))}` : `<span class="muted">Items, not UEC</span>`)}
        ${row("Best / hour", rated[0] ? `${link(rated[0])} <span class="rate">${rateText(rated[0])}</span>` : "")}
        ${row("Start with", starters[0] ? `${link(starters[0])} <span class="muted">${short(starters[0].reward)}</span>` : "")}
        ${row("Need", g.need ? esc(g.need) : "")}
        ${row("From", who.map(esc).join(", "))}
        ${row("Legal", illegal ? `${fmt(list.length - illegal)} legal, <span class="illegal-text">${fmt(illegal)} illegal</span>` : "All legal")}
      </dl>
      <p class="ov-more"><a href="?q=${encodeURIComponent(`act:${act}`)}" data-act="${esc(act)}">See all ${fmt(list.length)} →</a></p>
    </section>`;
  }

  function renderOverview() {
    const active = contracts.filter(base);
    const top = active.filter((c) => RATE.get(c.id) != null).sort((a, b) => RATE.get(b.id) - RATE.get(a.id)).slice(0, 10);
    const groups = {};
    for (const c of active) (groups[c.act] = groups[c.act] || []).push(c);
    const width = ($("overview").clientWidth || 760) - 34;
    $("overview").innerHTML = `
      <section class="ov-card ov-top">
        <header><h3>Best pay per hour</h3><a href="?q=" data-sort="rate">All by pay per hour →</a></header>
        <table>
          <thead><tr><th>Contract</th><th>Type</th><th class="num">Reward</th><th class="num">Per hour</th><th class="num">Runs</th></tr></thead>
          <tbody>${top.map((c) => `<tr><td>${link(c)}<div class="sub">${esc(c.by || "")}</div></td><td>${esc(ACTS[c.act])}</td>
            <td class="num">${fmt(c.reward)}</td><td class="num rate">${fmt(RATE.get(c.id))}</td><td class="num muted">${c.community.runs}</td></tr>`).join("")}</tbody>
        </table>
        <p class="note">From players' reported times (median of ${MIN_RUNS}+ runs, via SCMDB). It leaves out travel to the contract, and the rewards scale with your rank, so take it as a guide.</p>
      </section>
      ${window.PaySpread ? PaySpread.card(active, RATE, ACTS, width) : ""}
      <div class="ov-grid">${Object.keys(ACTS).filter((a) => groups[a]).map((a) => actCard(a, groups[a])).join("")}</div>`;
  }

  // ── List ──────────────────────────────────────────────────────────────────
  function renderControls() {
    const counts = {};
    contracts.filter(base).forEach((c) => (counts[c.act] = (counts[c.act] || 0) + 1));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    $("actChips").innerHTML = ["", ...Object.keys(ACTS).filter((a) => counts[a])]
      .map((a) => `<button class="chip${state.act === a ? " on" : ""}" data-act="${a}">${esc(a ? ACTS[a] : "All")} <span>${fmt(a ? counts[a] : total)}</span></button>`).join("");
    $("sort").innerHTML = Object.entries(SORTS).map(([k, l]) => `<option value="${k}"${state.sort === k ? " selected" : ""}>${esc(l)}</option>`).join("");
    $("legal").innerHTML = Object.entries(LEGAL).map(([k, l]) => `<option value="${k}"${state.legal === k ? " selected" : ""}>${esc(l)}</option>`).join("");
    $("flagFilters").innerHTML = FLAGS.map(([k, l]) => `<label class="fp-flag"><input type="checkbox" data-flag="${k}"${state.flags.has(k) ? " checked" : ""}> ${esc(l)}</label>`).join("");
  }

  function renderSearch() {
    const list = results();
    const LIMIT = 300;
    $("list").innerHTML = list.length
      ? list.slice(0, LIMIT).map((c) => `<li class="row${c.id === state.selected ? " active" : ""}">
          <a href="#${esc(c.id)}" class="row-link">
            <div class="row-main"><strong>${withTokens(c.title)}</strong>
              <span class="sub">${esc([c.by, c.type].filter(Boolean).join(" · "))}</span>
              <span class="sub">${esc((c.sys || []).join(", "))}${c.rank && c.rank[0] > 0 ? ` · rank ${c.rank[0]}+` : ""}</span></div>
            <div class="row-side">
              <span class="price buy">${c.reward ? fmt(c.reward) : c.items ? "Items" : "—"}</span>
              ${RATE.get(c.id) != null ? `<span class="rate sub">${short(RATE.get(c.id))}/h</span>` : ""}
              <span class="row-tags">${c.illegal ? `<span class="tag illegal">Illegal</span>` : ""}${c.off ? `<span class="tag off">Not running</span>` : c.event ? `<span class="tag event">Event</span>` : ""}</span>
            </div>
          </a></li>`).join("") + (list.length > LIMIT ? `<li class="empty">${fmt(list.length - LIMIT)} more. Narrow the search to see them.</li>` : "")
      : `<li class="empty">No contracts match.</li>`;
    $("total").innerHTML = `<span>${fmt(list.length)} shown</span>`;
  }

  function renderHelp() {
    if ($("help").dataset.ready) return;
    $("help").dataset.ready = "1";
    $("help").innerHTML = `<summary>Search terms</summary>
      <table class="fp-syntax"><tbody>
        <tr><td><code>act:hauling</code></td><td>Activity: ${Object.keys(ACTS).map((a) => `<code>${esc(a)}</code>`).join(" ")}</td></tr>
        <tr><td><code>by:headhunters</code></td><td>Contractor</td></tr>
        <tr><td><code>type:"ship mining"</code></td><td>The game's mission type</td></tr>
        <tr><td><code>in:pyro</code> <code>in:hurston</code></td><td>System, region, planet, moon or place</td></tr>
        <tr><td><code>reward:>100k</code> <code>reward:50k..200k</code></td><td>UEC reward</td></tr>
        <tr><td><code>rank:0</code> <code>rank:<=2</code></td><td>Rank needed with the contractor</td></tr>
        <tr><td><code>vs:vanduul</code></td><td>Enemy ships</td></tr>
        <tr><td><code>has:blueprint</code></td><td><code>blueprint</code> <code>items</code> <code>cargo</code> <code>enemies</code> <code>buyin</code> <code>times</code> <code>rate</code> <code>rep</code></td></tr>
        <tr><td><code>is:starter</code></td><td><code>starter</code> <code>legal</code> <code>illegal</code> <code>shareable</code> <code>solo</code> <code>event</code> <code>off</code> <code>once</code> <code>story</code> <code>career</code></td></tr>
      </tbody></table>
      <p>Put <code>-</code> in front of a term to exclude it, and quotes around phrases.</p>`;
  }

  // ── Detail ────────────────────────────────────────────────────────────────
  function rankText(r) {
    if (!r) return null;
    return r[0] <= 0 ? `None (${r[1]})` : `${r[1]} (rank ${r[0]}${r[2] ? `, ${r[2]}` : ""})`;
  }

  function cargoTable(rows) {
    // The same cargo row more than once means several pickups or drop-offs: count them.
    const merged = [];
    for (const r of rows) {
      const hit = merged.find((m) => JSON.stringify(m.r) === JSON.stringify(r));
      if (hit) hit.n++;
      else merged.push({ r, n: 1 });
    }
    const either = rows.some((r) => r[5]);
    return `${either ? `<p class="sub">Bring one of these:</p>` : ""}<table><thead><tr><th>Cargo</th><th class="num">Amount</th><th class="num">Largest box</th></tr></thead><tbody>
      ${merged.map(({ r: [name, lo, hi, unit, box], n }) => `<tr><td>${n > 1 ? `${n} × ` : ""}${esc(name)}</td>
        <td class="num">${lo === hi || !hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`}${unit ? ` ${unit}` : ""}</td>
        <td class="num">${box ? `${box} SCU` : "—"}</td></tr>`).join("")}</tbody></table>`;
  }

  function shipList(ix) {
    const names = SHIPS[ix] || [];
    if (!names.length) return "";
    const shown = names.slice(0, 8).map(esc).join(", ");
    return names.length > 8
      ? `<details class="inline"><summary>${shown} <span class="muted">+${names.length - 8} more</span></summary><p class="sub">${names.map(esc).join(", ")}</p></details>`
      : `<span class="sub">${shown}</span>`;
  }

  function enemiesBlock(e) {
    const total = e.min === e.max ? fmt(e.min) : `${fmt(e.min)}–${fmt(e.max)}`;
    return `<p>${total} ship${e.max === 1 ? "" : "s"} in total.</p><ul class="enemies">${e.groups.map(([role, lo, hi, ix, cls]) =>
      `<li><strong>${esc(human(role) || "Ships")}</strong>: ${lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`}${cls ? ` <span class="muted">(${esc(cls)})</span>` : ""}${ix != null ? `<div>${shipList(ix)}</div>` : ""}</li>`).join("")}</ul>`;
  }

  function rewardsBlock(c) {
    const items = siteHref("items");
    const shipsSite = siteHref("ships");
    const itemLink = (name, type) => {
      const href = type === "vehicle" ? shipsSite : items;
      return href ? `<a href="${esc(href)}?q=${encodeURIComponent(`"${name}"`)}">${esc(name)}</a>` : esc(name);
    };
    const parts = [];
    if (c.reward) parts.push(`<p class="reward">${fmt(c.reward)} UEC</p>`);
    if (c.rep) parts.push(`<ul class="plain">${c.rep.map(([f, n, scope]) => `<li>${n > 0 ? "+" : ""}${fmt(n)} ${esc(scope || "reputation")} with ${esc(f)}</li>`).join("")}</ul>`);
    if (c.items) parts.push(`<h4>Items</h4><ul class="plain">${c.items.map(([n, amt, type]) => `<li>${amt > 1 ? `${amt} × ` : ""}${itemLink(n, type)}${type === "vehicle" ? ` <span class="muted">(ship)</span>` : ""}</li>`).join("")}</ul>`);
    if (c.bp) {
      parts.push(c.bp.map(([ix, chance]) => {
        const names = BLUEPRINTS[ix] || [];
        return `<h4>Blueprint ${chance < 100 ? `(${chance}% chance)` : ""}${names.length > 1 ? ` · one of ${names.length}` : ""}</h4>
          <ul class="cols">${names.map((n) => `<li>${itemLink(n)}</li>`).join("")}</ul>`;
      }).join(""));
    }
    return parts.length ? `<h3>Rewards</h3>${parts.join("")}` : "";
  }

  function requirements(c) {
    const out = [];
    const r = rankText(c.rank);
    if (r) out.push(["Rank needed", r]);
    if (c.maxRank && c.rank && c.maxRank[0] > c.rank[0]) out.push(["Offered until", `${c.maxRank[1]} (rank ${c.maxRank[0]})`]);
    if (c.crime) out.push(["CrimeStat", c.crime[0] > 0 ? `Needs ${c.crime[0]}–${c.crime[1]}` : `Up to ${c.crime[1]}`]);
    if (c.intros) out.push(["Unlock first", c.intros.join(", ")]);
    else if (c.unlock) out.push(["Unlock", "Complete earlier contracts for this contractor first."]);
    if (c.buyIn) out.push(["Buy-in", `${fmt(c.buyIn)} UEC up front`]);
    if (c.once) out.push(["Repeat", "Once only"]);
    if (c.event) out.push(["Event", c.off ? `${c.event.join(", ")}: not running now` : `${c.event.join(", ")}: running`]);
    return out;
  }

  function whereBlock(c) {
    const rows = [];
    if (c.sys && c.sys.length) rows.push(["Systems", esc(c.sys.join(", "))]);
    if (c.offered && c.offered.length) rows.push(["Offered in", esc(c.offered.join(", "))]);
    if (c.region && c.region.length) {
      const R = META.pyroRegions || {};
      rows.push(["Pyro regions", c.region.map((k) => `${esc(k)}${R[k] && R[k].length ? ` <span class="muted">(${esc(R[k].join(", "))})</span>` : ""}`).join("<br>")]);
    }
    if (c.near && c.near.length) rows.push(["Offered at", c.near.map((n) => {
      const loc = siteHref("locations");
      return loc ? `<a href="${esc(loc)}?q=${encodeURIComponent(`"${n}"`)}">${esc(n)}</a>` : esc(n);
    }).join(", ")]);
    const chips = (list, max = 40) => {
      const html = list.slice(0, max).map(placeLink).join("");
      return list.length > max ? `${html}<details class="inline"><summary class="muted">+${list.length - max} more</summary>${list.slice(max).map(placeLink).join("")}</details>` : html;
    };
    let html = rows.length ? `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>` : "";
    if (c.at && c.at.length) html += `<h4>${c.to && c.to.length ? "Start or pick up at" : "Takes place at"}</h4><div class="chips-static">${chips(c.at)}</div>`;
    if (c.to && c.to.length) html += `<h4>Deliver to</h4><div class="chips-static">${chips(c.to)}</div>`;
    return html ? `<h3>Where</h3>${html}` : "";
  }

  function partialBlock(c) {
    const pool = (META.partialPayouts || [])[c.partial];
    if (!pool || !pool.length) return "";
    return `<details class="contents"><summary>Partial pay</summary><table><thead><tr><th>Delivered</th><th class="num">Pays</th></tr></thead><tbody>
      ${pool.map(([lo, hi, mult]) => `<tr><td>${lo}–${hi}%</td><td class="num">${Math.round(mult * 100)}% of the reward</td></tr>`).join("")}</tbody></table></details>`;
  }

  function renderDetail() {
    const c = byId.get(state.selected);
    if (!c) {
      $("detail").innerHTML = `<div class="hero-spacer"></div><h2>Ways to make money</h2>
        <p>Pick a contract to see what it pays, what you need and where it happens. The cards group contracts by the kind of work. <strong>Start with</strong> on each card is the best contract that needs no rank or unlock.</p>
        <p class="note">Rewards are the base amounts from the game files. Rewards and reputation usually grow with your rank, and the game fills in targets and places (shown like <span class="tok">location</span>) when it offers the contract.</p>`;
      return;
    }
    const g = GUIDE[c.act] || {};
    const rate = RATE.get(c.id);
    const t = c.community;
    const stat = (label, value, small) => `<div class="stat"><dt>${label}</dt><dd>${value}${small ? ` <small>${small}</small>` : ""}</dd></div>`;
    const stats = [
      stat("Reward", c.reward ? `${fmt(c.reward)}` : c.items ? "Items" : "—", c.reward ? "UEC" : ""),
      c.buyIn ? stat("Buy-in", fmt(c.buyIn), "UEC") : "",
      c.mins ? stat("Time limit", `${fmt(c.mins)} min`) : "",
      t ? stat("Players take", `${t.mins} min`, `${t.runs} run${t.runs === 1 ? "" : "s"}`) : "",
      rate != null ? stat("Per hour", short(rate), "UEC est.") : "",
      t && t.difficulty != null ? stat("Difficulty", `${t.difficulty} / 7`, "players say") : "",
      stat("Group", c.share ? `Shareable${c.players ? `, up to ${c.players}` : ""}` : "Solo"),
      c.cooldown ? stat("Cooldown", `${fmt(c.cooldown)} min`) : "",
    ].join("");
    const req = requirements(c);
    const desc = c.desc != null ? TEXT[c.desc] : "";

    $("detail").innerHTML = `
      <div class="hero-spacer"></div>
      <div class="detail-head">
        <div><h2>${withTokens(c.title)}</h2><p class="sub">${[c.by && lookUp(c.by), c.type && esc(c.type)].filter(Boolean).join(" · ")}</p></div>
        <div class="badges"><span class="tag act">${esc(ACTS[c.act])}</span>${c.illegal ? `<span class="tag illegal">Illegal</span>` : `<span class="tag legal">Legal</span>`}${c.off ? `<span class="tag off">Not running</span>` : ""}</div>
      </div>
      ${c.alt ? `<p class="sub">Also offered as: ${c.alt.map(withTokens).join(", ")}</p>` : ""}
      <dl class="stats">${stats}</dl>
      ${c.off ? `<ul class="ttk"><li class="ttk-warn"><span class="ttk-icon">!</span>Part of an event that isn't running now (${esc(c.event.join(", "))}).</li></ul>` : ""}

      ${rewardsBlock(c)}
      ${req.length ? `<h3>Requirements</h3><dl class="kv">${req.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
      ${c.starter ? `<p class="note good">Good to start: no rank or unlock needed.</p>` : ""}
      ${whereBlock(c)}
      ${c.cargo && c.cargo.length ? `<h3>Cargo</h3>${cargoTable(c.cargo)}` : ""}
      ${partialBlock(c)}
      ${c.enemies ? `<h3>Enemy ships</h3>${enemiesBlock(c.enemies)}` : ""}

      ${g.summary || g.need ? `<h3>About ${esc(ACTS[c.act])}</h3>${g.summary ? `<p>${esc(g.summary)}</p>` : ""}${g.need ? `<p><span class="muted">You need:</span> ${esc(g.need)}</p>` : ""}
        ${(g.tips || []).length ? `<ul class="ttk">${g.tips.map((n) => `<li class="ttk-info"><span class="ttk-icon">i</span>${esc(n)}</li>`).join("")}</ul>` : ""}` : ""}
      ${desc ? `<h3>Contract text</h3><p class="desc">${withTokens(desc)}</p>` : ""}
      ${c.issue ? `<h3>Known issue</h3><p class="note">${esc(c.issue)}</p>` : ""}
      ${c.variants > 1 ? `<p class="note">${fmt(c.variants)} versions of this contract in the game files, merged here (they differ by place).</p>` : ""}
      <nav class="links"><a href="https://scmdb.net/?m=${scmdbKey(c.debug)}" target="_blank" rel="noopener">On SCMDB ↗</a></nav>`;
  }

  // ── Wiring ────────────────────────────────────────────────────────────────
  let shownDetail = null;
  function render() {
    $("tabs").innerHTML = [["overview", "Ways to make money"], ["search", "All contracts"]]
      .map(([k, l]) => `<button class="tab${state.view === k ? " on" : ""}" data-view="${k}">${l}</button>`).join("");
    document.body.dataset.view = state.view;
    $("systemChips").innerHTML = ["", ...SYSTEMS]
      .map((s) => `<button class="chip${state.system === s ? " on" : ""}" data-system="${s}">${s || "All systems"}</button>`).join("");
    if (state.view === "overview") {
      renderOverview();
      $("total").innerHTML = `<span>${fmt(contracts.filter(base).length)} contracts</span>`;
    } else {
      renderControls();
      renderHelp();
      renderSearch();
    }
    renderDetail();
    if (state.selected !== shownDetail) {
      $("detail").scrollTop = 0;
      shownDetail = state.selected;
    }
  }

  function setView(v) {
    state.view = v;
    write(VIEW_KEY, v);
  }
  function setQuery(q) {
    state.query = q;
    $("search").value = q;
    const url = new URL(location.href);
    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    try { history.replaceState(null, "", url); } catch (e) { /* blocked on some file:// pages */ }
  }
  function selectFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (byId.has(id)) state.selected = id;
  }
  function goSearch({ act, sort } = {}) {
    state.act = act ?? "";
    if (sort) state.sort = sort;
    setQuery("");
    setView("search");
    render();
  }

  const systems = META.patch ? `data for patch ${META.patch} · gathered ${META.gathered}` : "";
  $("meta").textContent = `${fmt(contracts.length)} contracts in Stanton, Pyro and Nyx · ${systems} · from SCMDB`;
  $("siteLinks").innerHTML = (SITE.links || []).map((l) => `<a href="${esc(l.href)}">${esc(l.label)} →</a>`).join("");

  let typing;
  $("search").addEventListener("input", (e) => {
    clearTimeout(typing);
    typing = setTimeout(() => { setQuery(e.target.value); if (state.view !== "search") setView("search"); render(); }, 120);
  });
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) { setView(b.dataset.view); render(); }
  });
  $("systemChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-system]");
    if (b) { state.system = b.dataset.system; write(SYSTEM_KEY, state.system); render(); }
  });
  if (window.PaySpread) PaySpread.bind($("overview"));
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.view === "overview") renderOverview(); }, 150);
  });
  $("overview").addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (a) { e.preventDefault(); goSearch({ act: a.dataset.act }); return; }
    const s = e.target.closest("[data-sort]");
    if (s) { e.preventDefault(); goSearch({ sort: s.dataset.sort }); }
  });
  $("actChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (b) { state.act = b.dataset.act; render(); }
  });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("legal").addEventListener("change", (e) => { state.legal = e.target.value; render(); });
  $("flagFilters").addEventListener("change", (e) => {
    const f = e.target.dataset.flag;
    if (!f) return;
    if (e.target.checked) state.flags.add(f);
    else state.flags.delete(f);
    render();
  });
  window.addEventListener("hashchange", () => { selectFromHash(); render(); });

  const q = new URLSearchParams(location.search).get("q");
  if (q) { setQuery(q); setView("search"); }
  selectFromHash();
  if (!state.selected && state.view === "search" && state.query) {
    const first = results()[0];
    if (first) state.selected = first.id;
  }
  render();
})();
