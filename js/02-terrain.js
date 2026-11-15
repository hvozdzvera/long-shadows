"use strict";
// Long Shadows · horizon of a custom point, computed in the browser from LOLA tiles.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- terrain for custom points: horizon computed in the browser from LOLA tiles ----------
// heights packed into a PNG: (R*256 + G) * q - offset metres; the checksum guards against colour-managed decoding
function pngHeights(t, off) {
  return new Promise((ok, bad) => {
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement("canvas"); cv.width = cv.height = t.n;
      const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, t.n, t.n).data, h = new Float32Array(t.n * t.n); let sum = 0;
      for (let k = 0, p = 0; k < h.length; k++, p += 4) { const v = d[p] * 256 + d[p + 1]; sum += v; h[k] = v * t.q - off; }
      if (sum % 1000000007 !== t.sum) return bad(new Error("terrain image was altered while loading"));   // guards against colour-managed decoding
      ok({ n: t.n, px: t.px, h });
    };
    im.onerror = () => bad(new Error("terrain image did not load"));
    im.src = "data/" + t.file;
  });
}
const TR = { state: "none", tiles: [], wait: null };            // none | loading | ready | failed
function loadTerrain() {
  if (TR.wait) return TR.wait;
  TR.state = "loading";
  const tile = pngHeights;
  TR.wait = fetch("data/terrain.json").then(r => r.json()).then(m => Promise.all([tile(m.t1, m.offset), tile(m.t2, m.offset)]))
    .then(ts => { TR.tiles = ts; TR.state = "ready"; }).catch(e => { TR.state = "failed"; console.error(e); });
  return TR.wait;
}
function terrainAt(x, y, from) {
  for (let k = from; k < TR.tiles.length; k++) {
    const t = TR.tiles[k], cx = x / t.px + t.n / 2 - 0.5, cy = t.n / 2 - 0.5 - y / t.px;
    if (cx < 0 || cy < 0 || cx > t.n - 1.001 || cy > t.n - 1.001) continue;
    const i = Math.floor(cx), j = Math.floor(cy), fx = cx - i, fy = cy - j, o = j * t.n + i, h = t.h;
    return h[o] * (1 - fx) * (1 - fy) + h[o + 1] * fx * (1 - fy) + h[o + t.n] * (1 - fx) * fy + h[o + t.n + 1] * fx * fy;
  }
  return NaN;
}
// same method as the offline pipeline: rays over the map, true 3D geometry with the curve of the Moon
function terrainHorizon(lat, lon, hObs, from) {
  const Rm = RM * 1000, rho0 = 2 * Rm * Math.tan(Math.PI / 4 + lat * D2R / 2), x0 = rho0 * Math.sin(lon * D2R), y0 = rho0 * Math.cos(lon * D2R);
  const h0 = terrainAt(x0, y0, from), f = frame(lat, lon), r0 = Rm + h0 + hObs;
  const ox = r0 * f.up[0], oy = r0 * f.up[1], oz = r0 * f.up[2];
  const ds = [0.7 * TR.tiles[from].px]; while (ds[ds.length - 1] < 300e3) { const d = ds[ds.length - 1]; ds.push(d + Math.max(ds[0], d * 0.015)); }
  const best = new Float32Array(NB).fill(-90);
  for (let r = 0; r < 1440; r++) {
    const b = r * 0.25 * D2R, sb = Math.sin(b), cb = Math.cos(b);
    for (let k = 0; k < ds.length; k++) {
      const x = x0 + ds[k] * sb, y = y0 + ds[k] * cb, h = terrainAt(x, y, from); if (h !== h) continue;
      const rho = Math.hypot(x, y) || 1e-9, t = rho / (2 * Rm), sc = 2 * t / (1 + t * t), cc = (1 - t * t) / (1 + t * t), rr = Rm + h;
      const vx = rr * sc * y / rho - ox, vy = rr * sc * x / rho - oy, vz = -rr * cc - oz, dist = Math.hypot(vx, vy, vz);
      const el = Math.asin((vx * f.up[0] + vy * f.up[1] + vz * f.up[2]) / dist) * R2D;
      let az = Math.atan2(vx * f.east[0] + vy * f.east[1], vx * f.north[0] + vy * f.north[1] + vz * f.north[2]) * R2D; if (az < 0) az += 360;
      const bin = Math.floor(az * 2) % NB; if (el > best[bin]) best[bin] = el;
    }
  }
  for (let k = 0; k < NB; k++) if (best[k] <= -89) { let a = k, b2 = k; while (best[(a + NB) % NB] <= -89 && k - a < NB) a--; while (best[b2 % NB] <= -89 && b2 - k < NB) b2++; best[k] = Math.max(best[(a + NB) % NB], best[b2 % NB]); }
  return { hz: best, h0 };
}
function siteObj(id) {
  if (id !== "custom") return S.byId[id];
  const num = (i, d) => { const v = parseFloat($(i).value); return isNaN(v) ? d : v; };
  const lat = Math.max(-90, Math.min(90, num("c-lat", -89))), lon = ((num("c-lon", 0) % 360) + 360) % 360;
  const want = lat <= -84.5 ? 0 : lat <= -76 ? 1 : -1, key = `${lat}:${lon}:${want >= 0 ? TR.state : "smooth"}`;
  if (S.custom && S.custom.key === key) return S.custom.obj;
  const name = `Custom point ${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "S" : "N"}, ${lon.toFixed(2)}° E`;
  let obj;
  if (want >= 0 && TR.state === "ready") {
    const hz = {}; let h0 = 0;
    for (const H of [2, 10, 20]) { const r = terrainHorizon(lat, lon, H, want); hz[String(H)] = r.hz; h0 = r.h0; }
    obj = { id: "custom", name, lat, lon, h0: Math.round(h0), horizon: hz, group: "Your point", terrain: want === 0 ? "240 m" : "960 m" };
  } else {
    const flat = (H) => new Float32Array(NB).fill(-Math.acos(RM / (RM + H / 1000)) * R2D);
    obj = { id: "custom", name, lat, lon, h0: 0, horizon: { "2": flat(2), "10": flat(10), "20": flat(20) }, group: "Your point", terrain: null, pending: want >= 0 && TR.state !== "failed" };
    if (obj.pending) loadTerrain().then(() => { if (S.site === "custom" || S.customOn) rerender(); });
  }
  for (const k in S.cache) if (k.startsWith("custom:")) delete S.cache[k];
  S.custom = { key, obj };
  return obj;
}
const customNote = (s) => s.terrain === "240 m" ? "Real terrain, LOLA at 240 m per pixel. At our named sites this quick method lands within 2–3 points of the full 20 m calculation."
  : s.terrain === "960 m" ? "Rough terrain, LOLA at 960 m per pixel: sharp peaks can be off by up to 10 points. Finer terrain is used south of 84.5° S."
  : s.pending ? "Loading terrain data (4 MB)… Until then the point is shown on a smooth Moon."
  : Math.abs(s.lat) > 60 && s.lat < 0 ? "No terrain here (it is used south of 76° S): smooth Moon, so sunlight and Earth time are upper limits."
  : "Outside the polar terrain data: shown on a smooth Moon without hills.";
