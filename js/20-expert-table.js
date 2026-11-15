"use strict";
// Long Shadows · Advanced: every site in one table.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- Advanced: every site in one table, for the landing date, period and height chosen on the Compare screen ----------
const XA = { key: "sun", dir: -1, rows: [] };
const XA_COLS = [["name", "Site"], ["lat", "Lat °", 3], ["lon", "Lon °E", 3], ["sun", "Sunlight %", 1], ["night", "Longest night h", 0], ["earth", "Earth in view %", 1], ["gap", "Longest link gap h", 0], ["both", "Power + link %", 1],
  ["selmax", "Highest Sun °", 2], ["sl80", "Slope, 500 m °", 1], ["ok10", "Share ≤ 10° %", 0], ["sl5", "Slope, 100 m on 5 m map °", 1], ["psr", "Permanent shadow km", 1], ["tmean", "Mean temp K", 0], ["tmax", "Highest temp K", 0], ["ice", "Stable ice below m", 2]];
function xaRender() {
  if (!S.expert) return;
  const n = periodN(), t = Math.min(S.t0, S.n - 1), d = XD.state === "ready" ? XD.d : null;
  XA.rows = S.sites.map(s => {
    const st = stats(series(s.id, S.H), winStart(t), n), dv = d && d.diviner.sites[s.id], f = d && d.slope5m && d.slope5m.sites[s.id];
    return { name: s.name, lat: s.lat, lon: s.lon, sun: st.sun, night: st.maxDark, earth: st.earth, gap: st.maxNoE, both: st.both, selmax: st.selMax, sl80: s.slope ? s.slope.typ : null, ok10: s.slope ? s.slope.ok10 : null,
      sl5: f ? f.r100.typ : null, psr: s.psr ? s.psr.km : null, tmean: dv ? dv.tmean : null, tmax: dv ? dv.tmax : null, ice: dv ? (dv.ice == null ? Infinity : dv.ice) : null };       // Infinity: no stable ice in the modelled layer
  });
  const k = XA.key; XA.rows.sort((a, b) => a[k] == null ? 1 : b[k] == null ? -1 : typeof a[k] === "string" ? XA.dir * a[k].localeCompare(b[k]) : XA.dir * (a[k] - b[k]) || a.name.localeCompare(b.name));
  const cell = (v, dg) => v == null ? "–" : v === Infinity ? "none" : typeof v === "string" ? v : fx(v, dg);
  $("xa-note").textContent = `Landing ${prettyDate(t)}, ${PERIODS[S.period].label}, observer ${S.H} m above ground. Press a heading to sort; press again to turn the order round. “–” means no data, “none” no stable ice in the modelled layer.`;
  $("xa-out").innerHTML = `<table><tr>${XA_COLS.map(q => `<th scope="col" aria-sort="${q[0] === k ? (XA.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-k="${q[0]}" aria-pressed="${q[0] === k}">${q[1]}${q[0] === k ? (XA.dir > 0 ? " ↑" : " ↓") : ""}</button></th>`).join("")}</tr>${XA.rows.map(r =>
    `<tr>${XA_COLS.map(q => `<td>${cell(r[q[0]], q[2])}</td>`).join("")}</tr>`).join("")}</table>`;
}
function xaCSV() {
  const q = (t) => /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t, t = Math.min(S.t0, S.n - 1);
  return [`# Long Shadows · all sites · landing ${dateStr(t)}Z · ${PERIODS[S.period].label} · observer ${S.H} m above ground`,
    "site,lat_deg,lon_e_deg,sunlight_pct,longest_night_h,earth_in_view_pct,longest_link_gap_h,power_and_link_pct,highest_sun_elevation_deg,slope_500m_median_deg,share_gentler_than_10deg_pct,slope_100m_5m_map_median_deg,nearest_permanent_shadow_km,mean_temperature_k,highest_temperature_k,stable_ice_below_m"]
    .concat(XA.rows.map(r => XA_COLS.map(c => { const v = r[c[0]]; return v == null ? "" : v === Infinity ? "none" : typeof v === "string" ? q(v) : v.toFixed(c[2]); }).join(","))).join("\n");
}
function xaEvents() {
  const say = (t) => { $("xa-msg").textContent = t; };
  $("xa-out").onclick = (ev) => { const b = ev.target.closest("button[data-k]"); if (!b) return; const k = b.dataset.k; if (XA.key === k) XA.dir = -XA.dir; else { XA.key = k; XA.dir = k === "name" || k === "night" || k === "gap" || k === "sl80" || k === "sl5" || k === "psr" || k === "ice" ? 1 : -1; } xaRender();
    const again = $("xa-out").querySelector(`button[data-k="${k}"]`); if (again) again.focus(); };
  $("xa-copy").onclick = () => { if (!navigator.clipboard) return say("The browser did not allow copying here."); navigator.clipboard.writeText(xaCSV()).then(() => say(`Copied ${XA.rows.length} rows. Paste into a spreadsheet.`), () => say("The browser did not allow copying here.")); };
  $("xa-save").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([xaCSV()], { type: "text/csv" })); a.download = `long-shadows_all-sites_${dateStr(Math.min(S.t0, S.n - 1)).slice(0, 10)}_${S.period}_${S.H}m.csv`; document.body.appendChild(a); a.click(); a.remove();
    say("If no file appeared, this preview blocks downloads: use Copy, or the public site."); };
}
