"use strict";
// Long Shadows · Advanced mode: the switch and the data it loads.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- Expert mode (called "Advanced" on the page): one site, two depths. The choice is kept in the link (x=1) and in the browser. ----------
function setExpert(on, quiet) {
  S.expert = !!on; document.documentElement.classList.toggle("expert", S.expert);
  if (!S.expert && P.site !== "ridge") { planKeep(); planApply("ridge"); }
  if (!S.expert) { P.layer = "relief"; RV.back = false; const b = $("rv-back"); if (b) b.checked = false; }                 // Standard always shows the plan at Connecting Ridge
  document.querySelectorAll("#xsw button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.x === "1") === S.expert)));
  if (S.expert) loadExpert();
  try { localStorage.setItem("ls-expert", S.expert ? "1" : "0"); } catch (e) { /* private window: the choice simply is not remembered */ }
  if (!quiet) render();
}
const XD = { state: "idle", d: null };                        // data read only in Expert mode: idle | loading | ready | failed
function loadExpert() {
  if (XD.state !== "idle") return;
  XD.state = "loading";
  Promise.all([fetch("data/expert.json").then(r => r.json()), fetch("data/dsn.json").then(r => r.json())]).then(([d, g]) => {
    const bin = atob(g.el_b64), el = new Int8Array(bin.length); for (let k = 0; k < bin.length; k++) el[k] = (bin.charCodeAt(k) << 24) >> 24;      // signed bytes
    if (el.length !== 3 * g.n || g.n !== S.n) throw new Error("dsn.json does not match the ephemeris");
    XD.d = d; XD.dsn = { st: g.stations, min: g.min_el, el, n: g.n, none: g.none_pct, check: g.check }; XD.state = "ready"; if (S.expert) render();
  }).catch(e => { XD.state = "failed"; console.error(e); });
}
// Advanced: the Diviner maps as a picture (480 m per pixel), read only when a point of your own needs a temperature
const DV = { state: "idle", px: null, wait: null };
function loadDiviner() {
  if (DV.wait) return DV.wait;
  const m = XD.d.diviner.raster; DV.state = "loading";
  return (DV.wait = new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement("canvas"); cv.width = cv.height = m.n; const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, m.n, m.n).data; let sum = 0; for (let k = 0; k < d.length; k += 4) sum += d[k] + d[k + 1] + d[k + 2];
      if (sum % 1000000007 !== m.sum) { DV.state = "failed"; console.error("diviner picture altered while loading"); } else { DV.px = d; DV.state = "ready"; }      // guards against colour-managed decoding
      ok();
    };
    im.onerror = () => { DV.state = "failed"; ok(); }; im.src = "data/" + m.file;
  }));
}
// temperature and ice at any point south of 80 S: { tmean, tmax, ice } in K and m, null outside the maps, undefined while the picture is on its way
function divAt(lat, lon) {
  if (XD.state !== "ready" || !XD.d.diviner.raster || lat > -80) return null;
  if (DV.state === "idle") loadDiviner().then(() => { if (S.expert) render(); });
  if (DV.state !== "ready") return DV.state === "failed" ? null : undefined;
  const m = XD.d.diviner.raster, rho = 2 * RM * 1000 * Math.tan((90 + lat) / 2 * D2R), x = rho * Math.sin(lon * D2R), y = rho * Math.cos(lon * D2R);
  const c = Math.round((x - m.x0) / m.px), r = Math.round((m.y0 - y) / m.px); if (c < 0 || r < 0 || c >= m.n || r >= m.n) return null;
  const k = 4 * (r * m.n + c); if (!DV.px[k]) return null;
  return { tmean: DV.px[k], tmax: 2 * DV.px[k + 1], ice: DV.px[k + 2] === 255 ? null : DV.px[k + 2] * 0.005, coarse: true };
}
function expertWanted() {
  try { const x = new URLSearchParams(location.search).get("x"); if (x === "1" || x === "0") return x === "1"; } catch (e) { /* no address to read */ }
  try { return localStorage.getItem("ls-expert") === "1"; } catch (e) { return false; }
}
