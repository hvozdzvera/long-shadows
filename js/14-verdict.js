"use strict";
// Long Shadows · verdict for a landing at the chosen moment.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- verdict: what a landing at the chosen moment would get, in plain words ----------
// ground slope around a site (LOLA 80 m map, circle of 500 m): tag class, word and sentence
function slopeOf(s) {
  const g = s.slope;
  if (!g) return { cls: "", word: "Ground: no data", text: s.id === "custom" ? "The slope is not computed for your own point." : "The polar terrain maps do not reach this site, so the slope is not computed." };
  const rough = g.cell > 80 ? ` (from the ${g.cell} m map, so only a rough figure)` : "";
  const base = `Within ${g.zone} m of this point the ground typically slopes <b>${g.typ.toFixed(1)}°</b>, and <b>${g.p95.toFixed(1)}°</b> in the steepest parts${rough}.`;
  if (g.ok10 >= 95) return { cls: "ok", word: "Ground: gentle", text: `${base} ${g.ok10 === 100 ? "All" : `<b>${g.ok10}%</b>`} of that circle is gentler than 10°.` };
  if (g.ok10 >= 75) return { cls: "warn", word: "Ground: mixed", text: `${base} <b>${g.ok10}%</b> of that circle is gentler than 10°, so the touchdown spot has to be picked with care.` };
  return { cls: "bad", word: "Ground: steep", text: `${base} Only <b>${g.ok10}%</b> of that circle is gentler than 10°.` };
}
// nearest ground that never sees the Sun (NASA's LOLA illumination map, patches of 1 km2 or more)
function shadowOf(s) {
  const p = s.psr; if (!p) return null;
  return { word: `Shadow: ${p.km.toFixed(1)} km`, text: `The nearest ground that never sees the Sun lies <b>${p.km.toFixed(1)} km</b> from this point (a patch of ${p.area < 10 ? p.area.toFixed(1) : Math.round(p.area)} km²). Water ice is looked for in such places, so a short drive to one makes a site more useful.` };
}
// Standard: the verdict in one line, in plain words
function bottomLine(pc, lc, gcls) {
  if (pc === "") return "";
  const p = pc === "ok" ? 2 : pc === "warn" ? 1 : 0, l = lc === "ok" ? 2 : lc === "warn" ? 1 : 0; let t;
  if (p === 2 && l === 2) t = "A good moment to land here: long sunlight for power, and Earth in view for a direct radio link.";
  else if (p === 2 && l === 1) t = "Good for power. Earth is in view only part of the time, so some messages have to wait or go through a relay satellite.";
  else if (p === 2) t = "Good for power, but not for talking to Earth directly: a relay satellite is needed.";
  else if (p === 1 && l === 2) t = "Earth is in view, but the sunlight runs out soon. Landing earlier in the lunar day gives more.";
  else if (p === 1) t = "A weak moment to land here: the sunlight runs out soon, and Earth is not always in view.";
  else if (l === 2) t = "Earth is in view, but there is little or no sunlight left for power at this moment.";
  else t = "A poor moment to land here: little or no sunlight for power, and no steady line to Earth.";
  if (gcls === "bad") t += " The ground around is steep, so the touchdown spot has to be chosen with great care.";
  return `<b>Bottom line.</b> ${t}`;
}
// Advanced: the same verdict as a table of figures with their sources
// mean gap between our sunlight and Earth-in-view figures and NASA's average maps, over the sites that have both (the same figures as on the About screen)
function nasaGap() {
  if (!nasaGap.v) { const q = S.sites.filter(s => s.nasa_sun_pct != null), m = (f) => q.reduce((p, s) => p + Math.abs(f(s)), 0) / q.length;
    nasaGap.v = { n: q.length, sun: m(s => s.stats_2027_2028["2"].sun_pct - s.nasa_sun_pct), earth: m(s => s.stats_2027_2028["2"].earth_pct - s.nasa_earth_pct) }; }
  return nasaGap.v;
}
function verdictTable(c, i, v) {
  const s = c.site, rows = [], X = XD.state === "ready" ? XD : null, pct1 = (x) => x.toFixed(1) + "%", deg = (x) => fx(x, 2) + "°", T = "LOLA skyline, JPL DE421";
  const add = (name, val, from, cls) => rows.push(`<tr><td>${name}</td><td class="${cls || ""}">${val}</td><td>${from}</td></tr>`);
  add("Unbroken sunlight after landing", `${v.light} h (${(v.light / 24).toFixed(1)} d)${v.toEnd ? ", to the end of the data" : ""}`, T, v.pc);
  add("Night that follows", v.toEnd ? "beyond the data" : `${v.night} h`, T);
  add("Sun now: elevation / skyline in its direction", `${deg(c.sel[i])} / ${deg(hzAt(c.hz, c.saz[i]))}`, T);
  add("Earth in view, next 14 d", pct1(v.earth), T, v.lc);
  add("Earth now: elevation / skyline in its direction", `${deg(c.eel[i])} / ${deg(hzAt(c.hz, c.eaz[i]))}`, T);
  if (X && X.dsn) {                                                // NASA Deep Space Network: complexes with the Moon at least 10 deg up
    const g = X.dsn, any = (k) => g.el[k] >= g.min || g.el[g.n + k] >= g.min || g.el[2 * g.n + k] >= g.min, D = `JPL DE421, Earth rotation; Moon ≥ ${g.min}° up`;
    const now = g.st.map((q, j) => ({ name: q.name, el: g.el[j * g.n + i] })).filter(q => q.el >= g.min).sort((a, b) => b.el - a.el);
    const e1 = Math.min(S.n, i + 336); let seen = 0, both = 0; for (let k = i; k < e1; k++) if (c.ev[k]) { seen++; if (any(k)) both++; }
    add("DSN complex in position now", !c.ev[i] ? "none: Earth is behind the skyline" : now.length ? now.map(q => `${q.name} ${q.el}°`).join(", ") : "none", D, !c.ev[i] ? "" : now.length ? "ok" : "warn");
    add("DSN in position, next 14 d", seen ? `${pct1(100 * both / seen)} of the hours with Earth in view` : "Earth is not in view", D);
  }
  const g = s.slope, f = X && X.d.slope5m && X.d.slope5m.sites[s.id], k10 = (p) => p >= 95 ? "ok" : p >= 75 ? "warn" : "bad", trio = (q) => `${q.typ.toFixed(1)}° / ${q.p95.toFixed(1)}° / ${q.ok10}%`;
  add(`Slope within ${g ? g.zone : 500} m: median / 95th percentile / share ≤ 10°`, g ? trio(g) : "no data", g ? `LOLA ${g.cell} m map` : "outside the polar maps, or your own point", g ? k10(g.ok10) : "");
  if (f) {
    add("Slope within 100 m, 5 m map: median / 95th percentile / share ≤ 10°", trio(f.r100), `LOLA 5 m site map “${f.map}” (Barker et al. 2021)`, k10(f.r100.ok10));
    add("Slope within 500 m, 5 m map: median / 95th percentile / share ≤ 10°", trio(f.r500), `LOLA 5 m site map “${f.map}”`, k10(f.r500.ok10));
  }
  { const G = nasaGap(), st = s.stats_2027_2028 && s.stats_2027_2028["2"], M = "NASA LOLA average visibility maps, 240 m, 18.6-year mean";
    if (st && s.nasa_sun_pct != null) add("Check, 2027–2028 at 2 m: sunlight ours / NASA map · Earth in view ours / NASA map", `${pct1(st.sun_pct)} / ${pct1(s.nasa_sun_pct)} · ${pct1(st.earth_pct)} / ${pct1(s.nasa_earth_pct)}`, M);
    add(`Typical difference from NASA's maps, ${G.n} sites: sunlight / Earth in view`, `±${G.sun.toFixed(1)} / ±${G.earth.toFixed(1)} percentage points`, "see About, Check against NASA maps"); }
  add("Nearest permanent shadow: distance / area", s.psr ? `${s.psr.km.toFixed(1)} km / ${s.psr.area < 10 ? s.psr.area.toFixed(1) : Math.round(s.psr.area)} km²` : "no data", "LOLA map of average sunlight, patches from 1 km²");
  const t = X && X.d.diviner && (X.d.diviner.sites[s.id] || (s.id === "custom" ? divAt(s.lat, s.lon) : null));
  if (t) {
    const from = t.coarse ? "LRO Diviner maps averaged to 480 m (Schorghofer &amp; Williams 2020)" : "LRO Diviner maps (Schorghofer &amp; Williams 2020)";
    add("Surface temperature: mean / highest", `${t.tmean} K / ${t.tmax} K (${fx(t.tmean - 273.15)} / ${fx(t.tmax - 273.15)} °C)`, from);
    add("Depth below which buried ice is stable (model)", t.ice == null ? `none within ${X.d.diviner.ice_max_m} m` : t.ice < 0.005 ? "0 m (at the surface)" : `${t.ice.toFixed(2)} m`, t.coarse ? "the same maps, 480 m" : "Schorghofer &amp; Williams 2020");
  } else if (X) add("Surface temperature, buried ice", t === undefined ? "loading…" : "no data", "the Diviner maps reach from the pole to 80° S");
  return `<span class="label">Landing at ${prettyDate(i)} · observer ${S.H} m above ground <span class="x-tag">Advanced</span></span>
    <div class="vt-wrap"><table class="vt"><tr><th scope="col">Quantity</th><th scope="col">Value</th><th scope="col">Source</th></tr>${rows.join("")}</table></div>${X ? "" : XD.state === "failed" ? `<p class="rv-hint">The station, temperature and 5 m slope data could not be loaded.</p>` : `<p class="rv-hint">Loading station, temperature and slope data…</p>`}`;
}
function renderVerdict(c, i) {
  const a = aheadOf(c), light = a[i], e1 = Math.min(S.n, i + 336), earth = 100 * (c.pe[e1] - c.pe[i]) / Math.max(1, e1 - i);
  let night = 0; for (let k = i + light; k < S.n && c.sf[k] < 0.5; k++) night++;                      // the dark stretch that follows the light
  const toEnd = i + light >= S.n, after = toEnd ? "" : ` Then comes a night of ${fmtDays(night)}.`;
  let pc, pw, pt;
  if (toEnd && light < 240) { pc = ""; pw = "Power: no verdict"; pt = "Our data end on 31 December 2028, too soon after this moment to judge."; }
  else if (!light) { const ns = nextChange(c.sf, i, 0.5); pc = "bad"; pw = "No power"; pt = `The site is dark at this moment${ns.hours === null ? "." : `; the Sun comes back in ${fmtDur(ns.hours)}.`}`; }
  else if (light >= 240) { pc = "ok"; pw = "Power: good"; pt = `<b>${fmtDays(light)}</b> of unbroken sunlight after landing${toEnd ? " (to the end of our data)" : ""}.${after}`; }
  else if (light >= 72) { pc = "warn"; pw = "Power: short"; pt = `Only <b>${fmtDays(light)}</b> of sunlight left after landing.${after} Landing earlier in the lunar day gives more.`; }
  else { pc = "bad"; pw = "Power: poor"; pt = `Only <b>${fmtDays(light)}</b> of sunlight left after landing.${after}`; }
  let lc, lw, lt;
  if (earth >= 99.5) { lc = "ok"; lw = "Link: direct"; lt = "Earth stays in view for the next 14 days, so the lander can talk to it directly."; }
  else if (earth >= 50) { lc = "warn"; lw = "Link: part-time"; lt = `Earth is in view <b>${fmtPct(earth)}</b> of the next 14 days. For the rest, store the data or use a relay satellite.`; }
  else if (earth >= 0.5) { lc = "bad"; lw = "Link: mostly relay"; lt = `Earth is in view only <b>${fmtPct(earth)}</b> of the next 14 days. A relay satellite is needed most of the time.`; }
  else { lc = "bad"; lw = "Link: relay only"; lt = "Earth does not rise here in the next 14 days. Every message needs a relay satellite."; }
  if (S.expert) { $("verdict").innerHTML = verdictTable(c, i, { light, night, toEnd, earth, pc, lc }); return; }
  const g = slopeOf(c.site), sum = bottomLine(pc, lc, g.cls), row = (cls, word, text) => `<div class="vd-row"><span class="tag ${cls}">${word}</span><p>${text}</p></div>`, sh = shadowOf(c.site);
  $("verdict").innerHTML = `<span class="label">If you land at this moment · ${prettyDate(i)} · ${S.H} m up</span>${sum ? `<p class="vd-sum">${sum}</p>` : ""}
    ${row(pc, pw, pt)}${row(lc, lw, lt)}${row(g.cls, g.word, g.text)}${sh ? row("", sh.word, sh.text) : ""}`;
}
