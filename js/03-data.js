"use strict";
// Long Shadows · CSV export, loading of data, statistics of a period, number formats.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- CSV export of the current period ----------
function periodCSV() {
  const c = series(S.site, S.H), s = c.site, i0 = periodStart(), n = periodN(), L = [];
  L.push(`# Long Shadows · ${s.name} · lat ${s.lat} lon ${s.lon} E · observer ${S.H} m above ground`);
  L.push(`# Sun and Earth: JPL DE421; horizon: ${s.id === "custom" ? (s.terrain ? "LOLA " + s.terrain : "smooth Moon") : s.lat < -60 ? "LOLA 20/80/240 m" : "smooth Moon"}; elevations in degrees above the horizon of a smooth Moon; azimuth clockwise from north`);
  const g = S.expert && XD.state === "ready" ? XD.dsn : null;          // Expert: three more columns, the Moon above each Deep Space Network complex
  if (g) L.push("# Deep Space Network: elevation of the Moon at each complex in whole degrees, rounded down; a complex is counted as in position from 10 deg up");
  L.push("time_utc,sun_azimuth_deg,sun_elevation_deg,skyline_at_sun_deg,sun_disc_visible_fraction,earth_azimuth_deg,earth_elevation_deg,skyline_at_earth_deg,earth_in_view" + (g ? ",moon_elevation_goldstone_deg,moon_elevation_madrid_deg,moon_elevation_canberra_deg" : ""));
  for (let i = i0; i < i0 + n && i < S.n; i++) L.push([dateStr(i) + "Z", c.saz[i].toFixed(2), c.sel[i].toFixed(3), hzAt(c.hz, c.saz[i]).toFixed(2), c.sf[i].toFixed(3), c.eaz[i].toFixed(2), c.eel[i].toFixed(3), hzAt(c.hz, c.eaz[i]).toFixed(2), c.ev[i]].concat(g ? [g.el[i], g.el[g.n + i], g.el[2 * g.n + i]] : []).join(","));
  return L.join("\n");
}
function horizonCSV() {                                        // Expert: the skyline itself, to check it or to use it in other tools
  const c = series(S.site, S.H), s = c.site, L = [];
  L.push(`# Long Shadows · skyline of ${s.name} · lat ${s.lat} lon ${s.lon} E · observer ${S.H} m above ground`);
  L.push(`# source: ${s.id === "custom" ? (s.terrain ? "LOLA " + s.terrain : "smooth Moon") : s.lat < -60 ? "LOLA 20/80/240 m" : "smooth Moon"}; elevation of the skyline in degrees above the horizon of a smooth Moon; azimuth clockwise from north; values between rows: straight line`);
  L.push("azimuth_deg,skyline_elevation_deg");
  for (let k = 0; k < NB; k++) L.push((k * 0.5).toFixed(1) + "," + c.hz[k].toFixed(3));
  return L.join("\n");
}
function csvEvents() {
  const say = (t) => { $("csv-msg").textContent = t; clearTimeout(csvEvents.t); csvEvents.t = setTimeout(() => { $("csv-msg").textContent = ""; }, 5000); };
  $("csv-copy").onclick = () => { const t = periodCSV(); if (!navigator.clipboard) return say("The browser did not allow copying here. Use Download on the public site."); navigator.clipboard.writeText(t).then(() => say(`Copied ${periodN()} rows. Paste into a spreadsheet.`), () => say("The browser did not allow copying here. Use Download on the public site.")); };
  $("csv-save").onclick = () => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([periodCSV()], { type: "text/csv" }));
    a.download = `long-shadows_${S.site}_${dateStr(periodStart()).slice(0, 10)}_${S.period}.csv`; document.body.appendChild(a); a.click(); a.remove();
    say("If no file appeared, this preview blocks downloads: use Copy, or the public site.");
  };
  $("hz-copy").onclick = () => { if (!navigator.clipboard) return say("The browser did not allow copying here. Use Download on the public site."); navigator.clipboard.writeText(horizonCSV()).then(() => say(`Copied ${NB} rows. Paste into a spreadsheet.`), () => say("The browser did not allow copying here. Use Download on the public site.")); };
  $("hz-save").onclick = () => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([horizonCSV()], { type: "text/csv" }));
    a.download = `long-shadows_${S.site}_skyline_${S.H}m.csv`; document.body.appendChild(a); a.click(); a.remove();
    say("If no file appeared, this preview blocks downloads: use Copy, or the public site.");
  };
}

function hzFor(site, H) {
  if (site.horizon[H]) return site.horizon[H];
  const h = +H, ks = [2, 10, 20];
  let a = 2, b = 10; if (h >= 10) { a = 10; b = 20; }
  const t = clamp01((h - a) / (b - a)), A = site.horizon[String(a)], B = site.horizon[String(b)];
  return A.map((v, k) => v + (B[k] - v) * t);
}
// Sun/Earth series for a site & height over the whole data span, Aug 2023 – Dec 2028 (cached)
function series(siteId, H) {
  const key = siteId === "custom" ? `custom:${siteObj("custom") && S.custom.key}:${H}` : `${siteId}:${H}`;
  if (S.cache[key]) return S.cache[key];
  return (S.cache[key] = seriesFor(siteObj(siteId), H));
}
function seriesFor(s, H) {
  const f = frame(s.lat, s.lon), hz = hzFor(s, H), E = S.eph, n = S.n;
  const rr = RM + ((s.h0 || 0) + +H) / 1000;
  const saz = new Float32Array(n), sel = new Float32Array(n), sf = new Float32Array(n), eaz = new Float32Array(n), eel = new Float32Array(n), ev = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const su = dot(E, f.up, o), se = dot(E, f.east, o), sn = dot(E, f.north, o);
    sel[i] = Math.asin(Math.max(-1, Math.min(1, su))) * R2D;
    saz[i] = (Math.atan2(se, sn) * R2D + 360) % 360;
    sf[i] = clamp01((sel[i] - hzAt(hz, saz[i])) / (2 * RSUN) + 0.5);
    const vx = E[o + 3] - rr * f.up[0], vy = E[o + 4] - rr * f.up[1], vz = E[o + 5] - rr * f.up[2];
    const L = Math.hypot(vx, vy, vz);
    const eu = (vx * f.up[0] + vy * f.up[1] + vz * f.up[2]) / L, ee = (vx * f.east[0] + vy * f.east[1]) / L, en = (vx * f.north[0] + vy * f.north[1] + vz * f.north[2]) / L;
    eel[i] = Math.asin(eu) * R2D;
    eaz[i] = (Math.atan2(ee, en) * R2D + 360) % 360;
    ev[i] = eel[i] > hzAt(hz, eaz[i]) ? 1 : 0;
  }
  return { site: s, hz, saz, sel, sf, eaz, eel, ev };
}
function stats(c, i0, n) {
  const i1 = Math.min(S.n, i0 + n);
  let sun = 0, ear = 0, both = 0, dark = 0, maxDark = 0, noE = 0, maxNoE = 0, selMax = -90, eelMax = -90, eelMin = 90, cnt = 0;
  for (let i = i0; i < i1; i++) {
    const lit = c.sf[i] >= 0.5, e = c.ev[i];
    sun += c.sf[i]; ear += e; if (lit && e) both++;
    dark = lit ? 0 : dark + 1; if (dark > maxDark) maxDark = dark;
    noE = e ? 0 : noE + 1; if (noE > maxNoE) maxNoE = noE;
    if (c.sel[i] > selMax) selMax = c.sel[i]; if (c.eel[i] > eelMax) eelMax = c.eel[i]; if (c.eel[i] < eelMin) eelMin = c.eel[i];
    cnt++;
  }
  return { sun: 100 * sun / cnt, earth: 100 * ear / cnt, both: 100 * both / cnt, maxDark, maxNoE, selMax, eelMax, eelMin };
}
// next change of state from hour i (with linear interpolation inside the hour)
function nextChange(arr, i, thr) {
  const now = arr[i] >= thr;
  for (let j = i + 1; j < S.n; j++) {
    if ((arr[j] >= thr) !== now) {
      const a = arr[j - 1], b = arr[j], f = (b === a) ? 0 : clamp01((thr - a) / (b - a));
      return { now, hours: (j - 1 - i) + f };
    }
  }
  return { now, hours: null };
}
function nextChangeE(c, i) {
  const now = !!c.ev[i];
  for (let j = i + 1; j < S.n; j++) if (!!c.ev[j] !== now) {
    const m = (k) => c.eel[k] - hzAt(c.hz, c.eaz[k]);
    const a = m(j - 1), b = m(j), f = (b === a) ? 0 : clamp01((0 - a) / (b - a));
    return { now, hours: (j - 1 - i) + f };
  }
  return { now, hours: null };
}
function fmtDur(h) {
  if (h === null) return "beyond 2028";
  const m = Math.round(h * 60);
  if (m < 60) return `${Math.max(1, m)} min`;
  if (h < 48) { const hh = Math.floor(m / 60), mm = m % 60; return mm ? `${hh} h ${mm} min` : `${hh} h`; }
  const t = Math.round(h), d = Math.floor(t / 24), hh = t % 24; return hh ? `${d} d ${hh} h` : `${d} d`;
}
const fx = (v, d = 0) => { const t = (+v).toFixed(d); return +t === 0 ? t.replace("-", "") : t.replace("-", "\u2212"); };   // a number for the screen: real minus sign, and no "-0.0" (CSV, links and inputs keep the plain hyphen)
const fmtPct = (v) => (S.expert || (v < 9.95 && v > 0) ? v.toFixed(1) : Math.round(v)) + "%";      // Advanced: always one decimal
const fmtDays = (h) => h === 0 ? "none" : (h < 48 ? `${h} h` : `${(h / 24).toFixed(1)} d`);
const iToDate = (i) => new Date(T0 + i * 3600e3);
const dateStr = (i) => iToDate(i).toISOString().slice(0, 16);
const prettyDate = (i) => { const d = iToDate(i); return d.toUTCString().slice(5, 22) + " UTC"; };
const periodN = () => PERIODS[S.period].h;
const winStart = (t) => Math.max(0, Math.min(S.n - periodN(), t));
const periodStart = () => winStart(S.t0);                      // S.t0 = start of the period, S.i = the moment being looked at
