"use strict";
// Long Shadows · Advanced: a list of your own points, calculated in one go.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- Expert: a list of your own points, calculated in one go (10 m mast, whole of 2027) ----------
const XL = { rows: [], run: 0 };
function xlParse(text) {
  const rows = [], bad = [];
  text.split(/\r?\n/).forEach((line, k) => {
    const f = line.split(/[,;\t]/).map(x => x.trim()); if (!line.trim()) return;
    const three = f.length >= 3, lat = parseFloat(f[three ? 1 : 0]), lon = parseFloat(f[three ? 2 : 1]);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90) { if (rows.length || k > 0) bad.push(k + 1); return; }      // a first line that is not numbers is taken as a heading
    rows.push({ name: (three ? f[0] : "") || `Point ${rows.length + 1}`, lat, lon: ((lon % 360) + 360) % 360 });
  });
  return { rows: rows.slice(0, 30), bad, cut: rows.length > 30 };
}
function xlRun() {
  const msg = $("xl-msg"), p = xlParse($("xl-text").value), token = ++XL.run;
  if (!p.rows.length) { msg.textContent = "No lines with a latitude and a longitude were found."; return; }
  if (p.rows.some(r => r.lat <= -76) && TR.state !== "ready" && TR.state !== "failed") { msg.textContent = "Loading the terrain…"; loadTerrain().then(() => { if (token === XL.run) xlRun(); }); return; }
  if (XD.state === "ready" && XD.d.diviner.raster && DV.state !== "ready" && DV.state !== "failed" && p.rows.some(r => r.lat <= -80)) { msg.textContent = "Loading the temperature map…"; loadDiviner().then(() => { if (token === XL.run) xlRun(); }); return; }
  XL.rows = []; let k = 0;
  const step = () => {
    if (token !== XL.run) return;
    const r = p.rows[k], want = r.lat <= -84.5 ? 0 : r.lat <= -76 ? 1 : -1; let s;
    if (want >= 0 && TR.state === "ready") { const t = terrainHorizon(r.lat, r.lon, 10, want); s = { id: "list", name: r.name, lat: r.lat, lon: r.lon, h0: Math.round(t.h0), horizon: { "10": t.hz }, terrain: want === 0 ? "LOLA 240 m" : "LOLA 960 m" }; }
    else s = { id: "list", name: r.name, lat: r.lat, lon: r.lon, h0: 0, horizon: { "10": new Float32Array(NB).fill(-Math.acos(RM / (RM + 10 / 1000)) * R2D) }, terrain: "smooth Moon" };
    const st = stats(seriesFor(s, "10"), Y27, 8760);
    XL.rows.push({ name: r.name, lat: r.lat, lon: r.lon, terrain: s.terrain, h0: s.h0, sun: st.sun, earth: st.earth, night: st.maxDark, t: divAt(r.lat, r.lon) || null });
    if (++k < p.rows.length) { msg.textContent = `Calculating ${k + 1} of ${p.rows.length}…`; setTimeout(step, 0); return; }
    msg.textContent = `${XL.rows.length} points calculated.` + (p.bad.length ? ` Lines not understood: ${p.bad.slice(0, 8).join(", ")}.` : "") + (p.cut ? " Only the first 30 lines were used." : "");
    xlTable();
  };
  msg.textContent = `Calculating 1 of ${p.rows.length}…`; setTimeout(step, 0);
}
function xlTable() {
  const esc = (t) => t.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  $("xl-out").innerHTML = `<table><tr><th>Point</th><th>Lat</th><th>Lon E</th><th>Sun in 2027</th><th>Earth in view</th><th>Longest night</th><th>Mean temp</th><th>Highest temp</th><th>Stable ice below</th><th>Terrain</th><th></th></tr>${XL.rows.map((r, k) =>
    `<tr><td>${esc(r.name)}</td><td>${fx(r.lat, 3)}°</td><td>${r.lon.toFixed(3)}°</td><td><b>${fmtPct(r.sun)}</b></td><td>${fmtPct(r.earth)}</td><td>${fmtDays(r.night)}</td><td>${r.t ? r.t.tmean + " K" : "–"}</td><td>${r.t ? r.t.tmax + " K" : "–"}</td><td>${!r.t ? "–" : r.t.ice == null ? "none" : r.t.ice.toFixed(2) + " m"}</td><td>${r.terrain}</td><td><button class="btn small" type="button" data-k="${k}">Open</button></td></tr>`).join("")}</table>`;
  $("xl-copy").hidden = !XL.rows.length;
}
function xlCSV() {
  const q = (t) => /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  return ["name,lat_deg,lon_e_deg,sun_pct_2027,earth_in_view_pct_2027,longest_night_h_2027,ground_height_m,terrain,mean_temperature_k,highest_temperature_k,stable_ice_below_m"].concat(XL.rows.map(r => [q(r.name), r.lat, r.lon.toFixed(4), r.sun.toFixed(1), r.earth.toFixed(1), r.night, r.h0, r.terrain, r.t ? r.t.tmean : "", r.t ? r.t.tmax : "", !r.t ? "" : r.t.ice == null ? "none" : r.t.ice.toFixed(2)].join(","))).join("\n");
}
function xlEvents() {
  $("xl-run").onclick = xlRun;
  $("xl-pick").onclick = () => $("xl-file").click();
  $("xl-file").onchange = (ev) => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $("xl-text").value = String(rd.result).slice(0, 20000); xlRun(); }; rd.readAsText(f); ev.target.value = ""; };
  $("xl-copy").onclick = () => { const msg = $("xl-msg"); if (!navigator.clipboard) { msg.textContent = "The browser did not allow copying here."; return; } navigator.clipboard.writeText(xlCSV()).then(() => { msg.textContent = `Copied ${XL.rows.length} rows. Paste into a spreadsheet.`; }, () => { msg.textContent = "The browser did not allow copying here."; }); };
  $("xl-out").onclick = (ev) => { const b = ev.target.closest("button[data-k]"); if (!b) return; const r = XL.rows[+b.dataset.k];      // open one point on the Horizon screen as "your point"
    $("c-lat").value = r.lat; $("c-lon").value = r.lon; S.customOn = true; S.site = "custom"; location.hash = "#site"; };
}
