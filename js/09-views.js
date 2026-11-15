"use strict";
// Long Shadows · screens: home, site map and list.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- views ----------
const SHORT = { ridge: "Connecting Ridge", shackleton: "Peak near Shackleton", malapert: "Malapert massif", mouton: "Mons Mouton · IM-2", im1: "Malapert A · IM-1", nobile: "Nobile · Griffin-1", gerlache: "de Gerlache rim", haworth: "Haworth", nobile1: "Nobile Rim 1", nobile2: "Nobile Rim 2", moutonp: "Mouton Plateau", slater: "Slater Plain", cabeusb: "Cabeus B", moutonr: "Mons Mouton" };
const LBL = { ridge: [-150, 75, 1], shackleton: [120, 70, 0], malapert: [-130, -45, 1], mouton: [100, -40, 0], im1: [40, 28, 0], nobile: [106, 5, 0], gerlache: [-150, -10, 1], haworth: [-140, -25, 1], nobile1: [50, 70, 0], nobile2: [50, 12, 0], moutonp: [80, -22, 0], moutonr: [-70, -75, 1], slater: [100, -8, 0], cabeusb: [20, -34, 0], custom: [30, -30, 0] };
function setSeg(id, v, attr = "v") { document.querySelectorAll(`#${id} button`).forEach(b => b.setAttribute("aria-pressed", String(b.dataset[attr] === v))); }
function mapGrid() {
  const svg = $("map-grid"); if (svg.dataset.done) return;
  const RAD = 320000, RMm = RM * 1000; let s = "";
  const rv = (lat) => 2 * RMm * Math.tan(Math.PI / 4 + lat * D2R / 2) / RAD * 500;
  for (let a = 0; a < 360; a += 30) { const r0 = rv(-88); s += `<line x1="${500 + Math.sin(a * D2R) * r0}" y1="${500 - Math.cos(a * D2R) * r0}" x2="${500 + Math.sin(a * D2R) * 707}" y2="${500 - Math.cos(a * D2R) * 707}" stroke="rgba(27,27,25,.28)" stroke-dasharray="1 5" vector-effect="non-scaling-stroke"/>`; }
  for (const lat of [-88, -86, -84, -82, -80]) { const r = rv(lat); s += `<circle cx="500" cy="500" r="${r}" fill="none" stroke="rgba(27,27,25,.32)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><text x="506" y="${500 + r + 16}" font-size="14" fill="#5c5f5e" font-family="B612 Mono, monospace">${-lat}°S</text>`; }
  for (const r of S.regions || []) {            // NASA's nine Artemis III candidate regions, outlines from USGS
    const pts = r.ring.map(([lon, lat]) => { const rho = 2 * RMm * Math.tan(Math.PI / 4 + lat * D2R / 2); return `${(500 + rho * Math.sin(lon * D2R) / RAD * 500).toFixed(1)},${(500 - rho * Math.cos(lon * D2R) / RAD * 500).toFixed(1)}`; }).join(" ");
    s += `<polygon points="${pts}" fill="rgba(26,27,27,.05)" stroke="rgba(26,27,27,.7)" stroke-width="1" vector-effect="non-scaling-stroke"><title>${r.name} — Artemis III candidate region</title></polygon>`;
  }
  s += `<g id="leaders"></g>`;
  svg.innerHTML = s; svg.dataset.done = "1";
}
const FILTERS = [["all", "All"], ["clps", "Commercial landers"], ["artemis", "Artemis regions"], ["other", "Other countries"], ["ref", "Reference points"]];
const SORTS = [["listed", "As listed"], ["sun", "Most Sun"], ["earth", "Most Earth"], ["night", "Shortest night"], ["slope", "Gentlest ground"]];
const inFilter = (s) => S.filter === "all" || ({ clps: "Commercial (CLPS)", artemis: "Artemis candidate region", other: "Other countries" }[S.filter] === s.group) || (S.filter === "ref" && /Most illuminated|Apollo/.test(s.group));
function renderSites() {
  if (!S.expert && S.sort !== "listed" && S.sort !== "sun") S.sort = "listed";
  mapGrid();
  const list = $("site-list"), map = $("map"), keep = list.scrollTop; list.innerHTML = "";
  map.querySelectorAll(".mk,.mlab").forEach(m => m.remove());
  const RAD = 320000, RMm = RM * 1000; let leaders = "";
  if (!S.customOn) S.compare = S.compare.filter(x => x !== "custom");
  $("list-head").textContent = `Compare: ${S.compare.length} of 3 chosen${S.compare.length >= 3 ? " — untick one to add another" : ""}`;
  $("chips").innerHTML = FILTERS.map(f => `<button data-f="${f[0]}" aria-pressed="${S.filter === f[0]}">${f[1]}</button>`).join("");
  $("chips").querySelectorAll("button").forEach(b => b.onclick = () => { S.filter = b.dataset.f; renderSites(); });
  $("sort-seg").innerHTML = SORTS.filter(f => S.expert || f[0] === "listed" || f[0] === "sun").map(f => `<button data-s="${f[0]}" aria-pressed="${S.sort === f[0]}">${f[1]}</button>`).join("");
  $("sort-seg").querySelectorAll("button").forEach(b => b.onclick = () => { S.sort = b.dataset.s; list.scrollTop = 0; renderSites(); });
  const yst = new Map(), ys = (s) => { if (!yst.has(s.id)) yst.set(s.id, stats(series(s.id, "10"), Y27, 8760)); return yst.get(s.id); };
  const named = S.sites.filter(inFilter);
  if (S.sort === "sun") named.sort((a, b) => ys(b).sun - ys(a).sun);
  if (S.sort === "earth") named.sort((a, b) => ys(b).earth - ys(a).earth);
  if (S.sort === "night") named.sort((a, b) => ys(a).maxDark - ys(b).maxDark);
  if (S.sort === "slope") named.sort((a, b) => (a.slope ? a.slope.typ : 99) - (b.slope ? b.slope.typ : 99));
  const rows = (S.customOn ? [siteObj("custom")] : []).concat(named);
  for (const s of rows) {
    const custom = s.id === "custom", idx = S.sites.indexOf(s);
    const st = ys(s), sel = s.id === S.site;
    const row = document.createElement("article");
    row.className = "srow"; row.dataset.id = s.id; if (sel) row.setAttribute("aria-current", "true"); row.tabIndex = 0;
    row.innerHTML = `<div class="srow-head"><span class="idx mono">${custom ? "(+)" : `(${String(idx + 1).padStart(2, "0")})`}</span><h2>${s.name}</h2><span class="tag">${s.group}</span></div>
      <p>${custom ? customNote(s) : s.note}</p>
      <div class="nums mono"><span><i class="dot sun"></i>Sun ${fmtPct(st.sun)}</span><span><i class="dot earth"></i>Earth ${fmtPct(st.earth)}</span><span>Longest night ${fmtDays(st.maxDark)}</span>${s.slope ? `<span>Slope ${s.slope.typ.toFixed(1)}°</span>` : ""}</div>
      <div class="srow-foot"><span class="coord mono">${Math.abs(s.lat).toFixed(3)}° ${s.lat < 0 ? "S" : "N"}, ${s.lon.toFixed(3)}° E${s.h0 != null && (!custom || s.terrain) ? ` · ${fx(s.h0)} m` : ""}</span>
        ${custom ? `<button class="btn small" id="custom-off">Remove</button>` : `<label><input type="checkbox" ${S.compare.includes(s.id) ? "checked" : (S.compare.length >= 3 ? "disabled" : "")} data-cmp="${s.id}"> Compare</label>`}
        <button class="btn small" data-go="${s.id}">Details →</button></div>`;
    row.onclick = (ev) => { if (ev.target.closest("label,button,input")) return; selectSite(s.id); };
    row.onkeydown = (ev) => { if (ev.key === "Enter" && ev.target === row) selectSite(s.id); };
    list.appendChild(row);
    if (s.lat < -60) {
      const rho = 2 * RMm * Math.tan(Math.PI / 4 + s.lat * D2R / 2), x = rho * Math.sin(s.lon * D2R), y = rho * Math.cos(s.lon * D2R);
      if (Math.abs(x) < RAD && Math.abs(y) < RAD) {
        const vx = (x + RAD) / (2 * RAD) * 1000, vy = (RAD - y) / (2 * RAD) * 1000, o = LBL[s.id] || [40, -20, 0];
        const lx = Math.max(8, Math.min(992, vx + o[0])), ly = Math.max(20, Math.min(980, vy + o[1]));
        const mk = document.createElement("button"); mk.className = "mk" + (sel ? " sel" : "") + (custom ? " custom" : ""); mk.title = s.name; mk.setAttribute("aria-label", s.name);
        mk.style.left = vx / 10 + "%"; mk.style.top = vy / 10 + "%"; mk.innerHTML = `<span class="pt"></span>`;
        const lb = document.createElement("button"); lb.className = "mlab" + (o[2] ? " end" : "") + (sel ? " sel" : ""); lb.tabIndex = -1;
        lb.style.left = lx / 10 + "%"; lb.style.top = ly / 10 + "%"; lb.textContent = custom ? "Your point" : (SHORT[s.id] || s.name);
        mk.onclick = lb.onclick = (ev) => { ev.stopPropagation(); selectSite(s.id); const r = list.querySelector(`[data-id="${s.id}"]`); r && r.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
        map.appendChild(mk); map.appendChild(lb);
        leaders += `<line x1="${vx}" y1="${vy}" x2="${lx + (o[2] ? 6 : -6)}" y2="${ly}" stroke="${sel ? "#1b1b19" : "rgba(27,27,25,.55)"}" stroke-width="${sel ? 1.4 : 1}" vector-effect="non-scaling-stroke"/>`;
      }
    }
  }
  if (!rows.length) list.innerHTML = `<p class="label" style="padding:14px 0;text-transform:none;letter-spacing:.02em">No sites in this group.</p>`;
  $("leaders").innerHTML = leaders; list.scrollTop = keep;
  const mr = map.getBoundingClientRect();      // keep labels inside the map on narrow screens
  map.querySelectorAll(".mlab").forEach(lb => { lb.style.marginLeft = ""; const r = lb.getBoundingClientRect(), dx = Math.max(0, mr.left + 4 - r.left) - Math.max(0, r.right - (mr.right - 4)); if (dx) lb.style.marginLeft = dx + "px"; });
  list.querySelectorAll("[data-cmp]").forEach(cb => cb.onchange = () => {
    const id = cb.dataset.cmp;
    if (cb.checked) { if (!S.compare.includes(id) && S.compare.length < 3) S.compare.push(id); }
    else S.compare = S.compare.filter(x => x !== id);
    renderSites();
  });
  list.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { S.site = b.dataset.go; location.hash = "site"; });
  if (S.view !== "map") drawView();
  const off = $("custom-off"); if (off) off.onclick = () => { S.customOn = false; S.compare = S.compare.filter(x => x !== "custom"); if (S.site === "custom") S.site = "ridge"; renderSites(); };
}
