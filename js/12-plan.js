"use strict";
// Long Shadows · base plan: placing objects, shadows, checks.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- base plan ----------
const OBJ = { m5: { kind: "mast", h: 5, w: 4, label: "Mast 5 m" }, m10: { kind: "mast", h: 10, w: 4, label: "Mast 10 m" }, m20: { kind: "mast", h: 20, w: 4, label: "Tower 20 m" }, a3: { kind: "ant", h: 3, w: 2, label: "Antenna 3 m" } };
const P = { site: "ridge", tool: "m10", objs: [], sel: new Set(), band: null, cleared: false, drag: null, res: null, local: {}, view: 1200, load: 2, layer: "relief" };
function groundAt(e, n) {
  const g = S.plan, G = g.grid, L = g.size_m, cell = L / G;
  const cx = (e + L / 2) / cell - 0.5, cy = (L / 2 - n) / cell - 0.5;
  const x0 = Math.max(0, Math.min(G - 2, Math.floor(cx))), y0 = Math.max(0, Math.min(G - 2, Math.floor(cy)));
  const fx = clamp01(cx - x0), fy = clamp01(cy - y0), H = g.h;
  return H[y0 * G + x0] * (1 - fx) * (1 - fy) + H[y0 * G + x0 + 1] * fx * (1 - fy) + H[(y0 + 1) * G + x0] * (1 - fx) * fy + H[(y0 + 1) * G + x0 + 1] * fx * fy;
}
function localHorizon(o) {
  // horizon from the 4 km terrain box around the object (adds nearby slopes to the distant site horizon)
  const out = new Float32Array(NB).fill(-90), z0 = groundAt(o.e, o.n) + o.h, half = S.plan.size_m / 2;
  for (let a = 0; a < 360; a += 1) {
    const sa = Math.sin(a * D2R), ca = Math.cos(a * D2R); let best = -90;
    for (let d = 30; d < 2000; d += 30) {
      const e = o.e + sa * d, n = o.n + ca * d; if (Math.abs(e) > half - 30 || Math.abs(n) > half - 30) break;
      const el = Math.atan2(groundAt(e, n) - z0 - d * d / (2 * RM * 1000), d) * R2D; if (el > best) best = el;
    }
    out[a * 2] = best; out[a * 2 + 1] = best;
  }
  return out;
}
function objHz(o) {
  const key = `${o.id}:${Math.round(o.e)}:${Math.round(o.n)}`;
  if (P.local[key]) return P.local[key];
  const site = S.byId[P.site], base = hzFor(site, String(Math.max(2, o.h))), loc = localHorizon(o);
  const hz = new Float32Array(NB); for (let k = 0; k < NB; k++) hz[k] = Math.max(base[k], loc[k]);
  return (P.local[key] = hz);
}
let pid = 1;
function exampleLayout() {
  P.dirty = true;
  const c = series(P.site, "10"), i0 = periodStart(), n = periodN();
  let sx = 0, sy = 0; for (let i = i0; i < i0 + n; i++) if (c.ev[i]) { sx += Math.sin(c.eaz[i] * D2R); sy += Math.cos(c.eaz[i] * D2R); }
  const eaz = Math.atan2(sx, sy);
  const A = { id: pid++, type: "a3", e: -160, n: -140 };
  P.objs = [
    { id: pid++, type: "m10", e: 0, n: 0 },
    { id: pid++, type: "m10", e: 45, n: 20 },
    { id: pid++, type: "m20", e: -300, n: 220 },
    Object.assign(A, OBJ.a3),
    { id: pid++, type: "m10", e: A.e + 140 * Math.sin(eaz), n: A.n + 140 * Math.cos(eaz) }
  ].map(o => Object.assign({}, OBJ[o.type], o));
  if (P.site !== "ridge") P.objs = [P.objs[0], P.objs[1], P.objs[3]];        // other sites start with two masts and an antenna: their ground has not been looked at by hand
  P.sel = new Set();
}
function computePlan() {
  const c = series(P.site, "10"), i0 = periodStart(), n = periodN(), step = n > 3000 ? 3 : 1;
  const objs = P.objs.map(o => ({ o, g: groundAt(o.e, o.n), hz: objHz(o) }));
  const masts = objs.filter(x => x.o.kind === "mast"), ants = objs.filter(x => x.o.kind === "ant");
  const R = new Map(objs.map(x => [x.o.id, { sunT: 0, sunAfter: 0, loss: new Map(), earthT: 0, earthOk: 0, block: new Map() }]));
  let cnt = 0, power = 0, link = 0, both = 0, dark = 0, maxDark = 0, kw = 0;
  for (let i = i0; i < i0 + n && i < S.n; i += step) {
    cnt++;
    const saz = c.saz[i], sel = c.sel[i], eaz = c.eaz[i], eel = c.eel[i], tanS = Math.tan(Math.max(sel, -5) * D2R);
    let anyLit = false;
    for (const m of masts) {
      const base = clamp01((sel - hzAt(m.hz, saz)) / (2 * RSUN) + 0.5); const r = R.get(m.o.id); r.sunT += base;
      if (base <= 0) continue;
      let shade = 0, by = null;
      for (const q of objs) {
        if (q === m) continue;
        const de = q.o.e - m.o.e, dn = q.o.n - m.o.n, d = Math.hypot(de, dn); if (d < 1) continue;
        let dAz = Math.abs(((Math.atan2(de, dn) * R2D - saz) % 360 + 540) % 360 - 180);
        if (dAz > Math.atan2(q.o.w / 2, d) * R2D) continue;
        const zs = q.g + q.o.h - m.g - d * tanS;               // height of q's shadow at m
        const f = clamp01((zs - 1) / (m.o.h - 1));            // share of m's array (1 m … top) in shadow
        if (f > shade) { shade = f; by = q.o.id; }
      }
      const got = base * (1 - shade); r.sunAfter += got; kw += got * kwOf(m.o); if (by) r.loss.set(by, (r.loss.get(by) || 0) + base * shade);
      if (got >= 0.5) anyLit = true;
    }
    let anyLink = false;
    for (const a of ants) {
      const r = R.get(a.o.id); const vis = eel > hzAt(a.hz, eaz); if (!vis) continue; r.earthT++;
      let blocked = null; const tanE = Math.tan(eel * D2R);
      for (const m of masts) {
        const de = m.o.e - a.o.e, dn = m.o.n - a.o.n, d = Math.hypot(de, dn); if (d < 1) continue;
        const dAz = Math.abs(((Math.atan2(de, dn) * R2D - eaz) % 360 + 540) % 360 - 180);
        if (dAz > Math.atan2(m.o.w / 2, d) * R2D + REARTH) continue;
        if (m.g + m.o.h - (a.g + a.o.h) > d * tanE) { blocked = m.o.id; break; }
      }
      if (blocked) r.block.set(blocked, (r.block.get(blocked) || 0) + 1); else { r.earthOk++; anyLink = true; }
    }
    if (anyLit) power++; if (anyLink) link++; if (anyLit && anyLink) both++;
    dark = anyLit ? 0 : dark + step; if (dark > maxDark) maxDark = dark;
  }
  P.res = { R, cnt, power: 100 * power / cnt, link: 100 * link / cnt, both: 100 * both / cnt, maxDark, objs, c, i0, n, step, kwAvg: kw / cnt, kwPeak: masts.reduce((s, m) => s + kwOf(m.o), 0) };
}

function lightCanvas() {
  if (P.lightCv) return P.lightCv;
  const L = S.plan.light, G = L.grid, v = new Uint8Array(b64(L.b64)), cv = document.createElement("canvas"); cv.width = cv.height = G;
  const x = cv.getContext("2d"), img = x.createImageData(G, G);
  for (let k = 0; k < G * G; k++) { const t = clamp01((v[k] - 40) / 50); img.data[k * 4] = 205; img.data[k * 4 + 1] = 146; img.data[k * 4 + 2] = 36; img.data[k * 4 + 3] = 255 * (0.04 + 0.74 * t * t); }
  x.putImageData(img, 0, 0); P.lightV = v; return (P.lightCv = cv);
}
function planProbe(e, n) {
  const L = S.plan.light, half = S.plan.size_m / 2; if (Math.abs(e) > half || Math.abs(n) > half) return "";
  let t = `Under the pointer: ground ${fx(groundAt(e, n) + (S.plan.h0_m || 0))} m`;
  if (RV.state === "ready") t += ` · slope ${(RV.slope[rvCell({ e, n })] * RV.sq).toFixed(0)}°`;
  if (L) { lightCanvas(); const G = L.grid, cell = S.plan.size_m / G, cx = Math.min(G - 1, Math.floor((e + half) / cell)), cy = Math.min(G - 1, Math.floor((half - n) / cell)); t += ` · a 10 m mast here has the Sun ${P.lightV[cy * G + cx]}% of the year 2027`; }
  return t;
}
// The map is as wide as its column and as tall as fits on the screen. P.view is the height shown, in metres;
// the width follows from the shape of the frame, but never goes beyond the 4 km of terrain we have.
function planScale() {
  const cv = $("plan-cv"), w = cv.clientWidth || 600, h = Math.round(Math.min(w, Math.max(340, window.innerHeight - 250)));
  return { w, h, s: Math.max(h / P.view, w / S.plan.size_m) };
}
function toPx(e, n) { const { w, h, s } = planScale(); return [w / 2 + e * s, h / 2 - n * s]; }
function fromPx(x, y) { const { w, h, s } = planScale(); return [(x - w / 2) / s, (h / 2 - y) / s]; }
function planLim() { const { w, h, s } = planScale(); return [Math.min(1950, w / s / 2), Math.min(1950, h / s / 2)]; }
function nameOf(o) { const same = P.objs.filter(q => q.kind === o.kind), k = same.indexOf(o); return o.kind === "mast" ? `Mast ${String.fromCharCode(65 + k)}` : `Antenna ${k + 1}`; }
function renderPlan() {
  document.querySelectorAll("#plan-sites button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.s === P.site)));
  { const o = P.sel.size === 1 ? P.objs.find(q => P.sel.has(q.id)) : null;                    // Advanced: the exact place of the one selected object
    [["ob-e", o && o.e], ["ob-n", o && o.n]].forEach(([id, v]) => { const el = $(id); el.disabled = !o; if (document.activeElement !== el) el.value = o ? Math.round(v) : ""; }); }
  { const t = $("plan-hint").firstChild, v = t.nodeValue.replace(/^Site: [^.]*\./, "Site: " + S.byId[P.site].name + "."); if (v !== t.nodeValue) t.nodeValue = v; }      // the site name inside the hint, without wrapping it in a tag
  setSeg("p-seg-3", S.period); setSeg("z-seg", String(P.view), "z");
  document.querySelectorAll(".tool").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === P.tool)));
  $("del-obj").disabled = !P.sel.size; $("del-obj").textContent = P.sel.size ? `Delete selected (${P.sel.size})` : "Delete selected";
  $("clear-plan").disabled = !P.objs.length;
  normTime();
  if (P.dirty !== false || !P.res || P.res.i0 !== periodStart() || P.res.n !== periodN()) { computePlan(); P.dirty = false; }
  { const n0 = periodN(), a0 = periodStart(), iN = Math.max(a0, Math.min(S.i, a0 + n0 - 1)); setDT($("plan-dt"), S.i); $("plan-range").max = n0 - 1; $("plan-range").value = iN - a0; syncRange($("plan-range")); $("plan-range-label").textContent = `Moment within the period · ${PERIODS[S.period].label} from ${prettyDate(a0).slice(0, 11)}`; }
  const cv = $("plan-cv"), { w, h, s } = planScale(), { ctx } = fitCanvas(cv, h), SZ = S.plan.size_m;
  ctx.fillStyle = col("--bg-2"); ctx.fillRect(0, 0, w, h);
  document.querySelectorAll("#z-seg button").forEach(b => { const sv = Math.max(h / +b.dataset.z, w / SZ); b.querySelector("small").textContent = `${(w / sv / 1000).toFixed(1)} × ${(h / sv / 1000).toFixed(1)} km`; });      // what each view really shows
  if (S.planImg.complete && S.planImg.naturalWidth) {
    const iw = S.planImg.naturalWidth, sw = iw * w / s / SZ, sh = iw * h / s / SZ;
    ctx.globalCompositeOperation = "multiply"; ctx.drawImage(S.planImg, (iw - sw) / 2, (iw - sh) / 2, sw, sh, 0, 0, w, h); ctx.globalCompositeOperation = "source-over";
  }
  setSeg("pl-seg", P.layer, "l");
  if (P.layer === "light" && S.plan.light) {      // where a 10 m mast gets the most Sun over a year
    const lc = lightCanvas(), G = S.plan.light.grid, sw = G * w / s / SZ, sh = G * h / s / SZ;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(lc, (G - sw) / 2, (G - sh) / 2, sw, sh, 0, 0, w, h); ctx.restore();
  }
  if (!P.probe) $("plan-probe").textContent = P.layer === "light" ? "Amber = share of the year 2027 with the Sun in view for a 10 m mast (80 m cells): pale 40% or less, strong 90% or more. Move the pointer over the map to read a value." : "Move the pointer over the map to read the ground height and the yearly sunlight there.";
  const { c, i0, n, step } = P.res;
  // smooth contour lines (vector, from LOLA 20 m, smoothed)
  ctx.lineJoin = "round";
  for (const ln of S.plan.contours || []) {
    ctx.strokeStyle = ln.major ? "rgba(26,27,27,.42)" : "rgba(26,27,27,.2)"; ctx.lineWidth = ln.major ? 1.1 : .8;
    ctx.beginPath(); ln.pts.forEach((p, k) => { const [x, y] = toPx(p[0], p[1]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  }
  rvLayers(ctx, w, h, s);
  const iNow = Math.max(i0, Math.min(S.i, i0 + n - 1)), sNow = c.sel[iNow], aNow = c.saz[iNow], NOWLIT = new Map();
  // reach of each mast's shadow during the period: dotted outline only
  for (const m of P.objs.filter(o => o.kind === "mast")) {
    const [mx, my] = toPx(m.e, m.n), hz = objHz(m), NBIN = 120, maxL = new Float32Array(NBIN);
    for (let i = i0; i < i0 + n && i < S.n; i += step) {
      if (c.sel[i] - hzAt(hz, c.saz[i]) < 0) continue;
      const L = Math.min(m.h / Math.tan(Math.max(c.sel[i], 0.02) * D2R), 2500), b = Math.floor(((c.saz[i] + 180) % 360) / 3);
      if (L > maxL[b]) maxL[b] = L;
    }
    const sel = P.sel.has(m.id);
    ctx.strokeStyle = sel ? "rgba(26,27,27,.6)" : "rgba(26,27,27,.3)"; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.beginPath();
    let first = true;
    for (let b = 0; b <= NBIN; b++) { const bb = b % NBIN; if (!maxL[bb]) { first = true; continue; } const a = (bb + 0.5) * 3 * D2R, r = maxL[bb] * s; const x = mx + Math.sin(a) * r, y = my - Math.cos(a) * r; first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
    ctx.stroke(); ctx.setLineDash([]);
    // the shadow right now: a long strip away from the Sun, widening slightly (the Sun is a disc, not a point)
    const lit = sNow - hzAt(hz, aNow) > 0; NOWLIT.set(m.id, lit);
    if (lit) {
      const L = (sNow > 0.2 ? Math.min(m.h / Math.tan(sNow * D2R), 3000) : 3000) * s, a = (aNow + 180) * D2R, dx = Math.sin(a), dy = -Math.cos(a), qx = Math.cos(a), qy = Math.sin(a);
      const wb = Math.max(2.5, m.w * s), we = Math.max(wb + 2, (m.w + L / s * 2 * Math.tan(RSUN * D2R)) * s);
      const g = ctx.createLinearGradient(mx, my, mx + dx * L, my + dy * L); g.addColorStop(0, "rgba(26,27,27,.78)"); g.addColorStop(1, "rgba(26,27,27,.12)");
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(mx + qx * wb / 2, my + qy * wb / 2); ctx.lineTo(mx + dx * L + qx * we / 2, my + dy * L + qy * we / 2);
      ctx.lineTo(mx + dx * L - qx * we / 2, my + dy * L - qy * we / 2); ctx.lineTo(mx - qx * wb / 2, my - qy * wb / 2); ctx.closePath(); ctx.fill();
    }
  }
  // Earth: faint corridor for the period, a clear line for right now
  for (const a of P.objs.filter(o => o.kind === "ant")) {
    const [ax, ay] = toPx(a.e, a.n), hz = objHz(a), L = 1400 * s;
    ctx.strokeStyle = `rgba(${EARTH_P},.035)`; ctx.lineWidth = 2;
    for (let i = i0; i < i0 + n && i < S.n; i += step * 2) {
      if (!(c.eel[i] > hzAt(hz, c.eaz[i]))) continue;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.sin(c.eaz[i] * D2R) * L, ay - Math.cos(c.eaz[i] * D2R) * L); ctx.stroke();
    }
    const up = c.eel[iNow] > hzAt(hz, c.eaz[iNow]), ea = c.eaz[iNow] * D2R;
    ctx.strokeStyle = `rgba(${EARTH_P},${up ? .9 : .35})`; ctx.lineWidth = 1.4; ctx.setLineDash(up ? [] : [3, 4]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.sin(ea) * L, ay - Math.cos(ea) * L); ctx.stroke(); ctx.setLineDash([]);
  }
  // where the Sun is: a stippled Sun on the edge of the map, in its direction
  {
    const sa = Math.sin(aNow * D2R), ca = -Math.cos(aNow * D2R), t = Math.min((w / 2 - 22) / Math.max(1e-6, Math.abs(sa)), (h / 2 - 22) / Math.max(1e-6, Math.abs(ca))), x = w / 2 + sa * t, y = h / 2 + ca * t;
    const up = sNow - hzAt(S.byId[P.site].horizon["10"], aNow) > 0;
    ctx.globalAlpha = up ? 1 : 0.4; ctx.drawImage(starCv(34, col("--sun")), x - 17, y - 17, 34, 34); ctx.globalAlpha = 1;
    ctx.font = cvf(13); ctx.fillStyle = col("--sun"); ctx.textAlign = x > w / 2 ? "right" : "left";
    ctx.fillText(up ? `SUN ${fx(sNow, 2)}°` : "SUN BEHIND TERRAIN", x + (x > w / 2 ? -20 : 20), y + (y > h / 2 ? -14 : 22)); ctx.textAlign = "left";
  }
  const lit = [...NOWLIT.values()].filter(Boolean).length;
  $("plan-now").textContent = `${prettyDate(iNow)} · Sun elevation ${fx(sNow, 2)}°${sNow <= 0 && lit ? " (below the smooth-Moon horizon, but the ridge still sees it)" : ""} · ${lit} of ${NOWLIT.size} masts have the Sun above their skyline`;
  // objects
  ctx.font = cvf(13); ctx.textAlign = "left"; ctx.lineJoin = "round";
  for (const o of P.objs) {
    const [x, y] = toPx(o.e, o.n), r = P.res.R.get(o.id);
    let state = "ok";
    if (o.kind === "mast") { const lossPct = r.sunT ? 100 * (r.sunT - r.sunAfter) / r.sunT : 0; state = lossPct > 10 ? "bad" : lossPct > 2 ? "warn" : "ok"; }
    else { const bl = r.earthT ? 100 * (r.earthT - r.earthOk) / r.earthT : 0; state = bl > 10 ? "bad" : bl > 2 ? "warn" : "ok"; }
    ctx.lineWidth = 2; ctx.strokeStyle = state === "ok" ? col("--ink") : col("--" + state);
    ctx.fillStyle = o.kind === "mast" ? (NOWLIT.get(o.id) ? col("--sun-2") : "#a4a6a4") : col("--earth-2");
    ctx.beginPath();
    if (o.kind === "mast") ctx.rect(x - 5.5, y - 5.5, 11, 11); else ctx.arc(x, y, 6.5, 0, 7);
    ctx.fill(); ctx.stroke();
    if (P.sel.has(o.id)) { ctx.strokeStyle = col("--ink"); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke(); }
    const t = nameOf(o).toUpperCase(), crowd = P.objs.some(q => { if (q === o) return false; const [qx, qy] = toPx(q.e, q.n); return qx >= x && qx - x < 90 && Math.abs(qy - y) < 26; });
    const lx = crowd ? x - 11 : x + 11; ctx.textAlign = crowd ? "right" : "left";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(235,236,234,.9)"; ctx.strokeText(t, lx, y - 9); ctx.fillStyle = col("--ink"); ctx.fillText(t, lx, y - 9); ctx.textAlign = "left";
  }
  rvRoute(ctx); ctx.font = cvf(13);
  if (P.band) {
    const b = P.band; ctx.setLineDash([4, 3]); ctx.strokeStyle = col("--ink"); ctx.lineWidth = 1; ctx.fillStyle = "rgba(27,27,25,.05)";
    ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    ctx.strokeRect(Math.min(b.x0, b.x1) + .5, Math.min(b.y0, b.y1) + .5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); ctx.setLineDash([]);
  }
  { const ax = w - 24, ay = 20; ctx.strokeStyle = col("--ink"); ctx.fillStyle = col("--ink"); ctx.lineWidth = 1.2;      // north arrow
    ctx.beginPath(); ctx.moveTo(ax, ay + 34); ctx.lineTo(ax, ay + 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 4.5, ay + 9); ctx.lineTo(ax + 4.5, ay + 9); ctx.closePath(); ctx.fill();
    ctx.font = cvf(14); ctx.textAlign = "center"; ctx.fillText("N", ax, ay + 50); ctx.textAlign = "left"; }
  const bar = P.view > 2000 ? 500 : 200;
  ctx.fillStyle = col("--ink"); ctx.fillRect(12, h - 16, bar * s, 1.5); ctx.fillRect(12, h - 20, 1, 5); ctx.fillRect(12 + bar * s - 1, h - 20, 1, 5);
  ctx.font = cvf(12); ctx.fillText(bar + " M", 12, h - 24);
  renderChecks(); rvPanel();
}
function renderChecks() {
  const res = P.res, el = $("checks"); let h = `<h3 aria-level="2">Checks · ${PERIODS[S.period].label}</h3>`;
  h += `<div class="totals"><div class="tile"><span class="label">Power</span><span class="v" style="color:var(--sun-t)">${fmtPct(res.power)}</span><span class="s">at least one mast lit</span></div>
        <div class="tile"><span class="label">Link to Earth</span><span class="v" style="color:var(--earth)">${fmtPct(res.link)}</span><span class="s">an antenna sees Earth</span></div>
        <div class="tile"><span class="label">Both</span><span class="v">${fmtPct(res.both)}</span><span class="s">power and link</span></div>
        <div class="tile"><span class="label">Longest blackout</span><span class="v">${fmtDays(res.maxDark)}</span><span class="s">longest time with no mast lit</span></div>
        ${S.expert ? `<div class="tile"><span class="label">Average power</span><span class="v" style="color:var(--sun-t)">${res.kwAvg.toFixed(1)} kW</span><span class="s">of ${res.kwPeak.toFixed(1)} kW installed</span></div>
        <div class="tile"><span class="label">Battery needed</span><span class="v">${res.maxDark ? fmtKWh(P.load * res.maxDark) : "none"}</span><span class="s">${res.maxDark ? `≈ ${fmtKg(P.load * res.maxDark / 0.2)} of cells for the longest blackout` : "no blackout in this period"}</span></div>` : ""}</div>
        ${S.expert ? `<label class="field load"><span class="label">The base needs, kW — during a blackout</span><input type="number" id="load" min="0.1" max="100" step="0.1" value="${P.load}"></label>` : ""}`;
  if (!P.objs.length) h += `<p class="label" style="margin:0;text-transform:none;letter-spacing:.02em">The map is empty. Pick an object on the left and click on the map to place it.</p>`;
  for (const o of P.objs) {
    const r = res.R.get(o.id); let chip, text;
    if (o.kind === "mast") {
      const terr = 100 * r.sunT / res.cnt, after = 100 * r.sunAfter / res.cnt, loss = r.sunT ? 100 * (r.sunT - r.sunAfter) / r.sunT : 0;
      let top = null, tv = 0; r.loss.forEach((v, k) => { if (v > tv) { tv = v; top = k; } });
      const who = top ? nameOf(P.objs.find(q => q.id === top)) : null;
      chip = loss > 10 ? "bad" : loss > 2 ? "warn" : "ok";
      const f1 = (v) => loss > 0.05 && loss < 2 ? v.toFixed(1) + "%" : fmtPct(v);
      text = `Sunlight ${f1(terr)} from terrain → <b>${f1(after)}</b> after shading. ${loss > 0.05 ? `Loses <b>${fmtPct(loss)}</b> of its energy${who ? `, mostly to the shadow of ${who}` : ""}.` : "No other object shades it."}`;
    } else {
      const terr = 100 * r.earthT / res.cnt, ok = 100 * r.earthOk / res.cnt, bl = r.earthT ? 100 * (r.earthT - r.earthOk) / r.earthT : 0;
      let top = null, tv = 0; r.block.forEach((v, k) => { if (v > tv) { tv = v; top = k; } });
      chip = bl > 10 ? "bad" : bl > 2 ? "warn" : "ok";
      text = `Earth above terrain ${fmtPct(terr)} → <b>${fmtPct(ok)}</b> with masts. ${bl > 0.05 ? `Line of sight blocked <b>${fmtPct(bl)}</b> of the time by ${nameOf(P.objs.find(q => q.id === top))}. Move it out of the blue corridor.` : "The corridor to Earth is clear."}`;
    }
    h += `<div class="check${P.sel.has(o.id) ? " sel" : ""}" data-id="${o.id}" tabindex="0" role="button" aria-pressed="${P.sel.has(o.id)}"><div style="display:flex;justify-content:space-between;gap:8px"><b>${nameOf(o)} <span style="color:var(--muted);font-weight:400">· ${o.h} m</span></b><span class="tag ${chip}">${chip === "ok" ? "clear" : chip === "warn" ? "minor" : "conflict"}</span></div><span style="color:var(--ink-2)">${text}</span></div>`;
  }
  h += !S.expert ? `<p class="label" style="margin:0;text-transform:none;letter-spacing:.02em">A mast here is a tall solar panel, 4 m wide. Its shadow falls on another mast when the Sun stands behind it. An antenna loses Earth when a mast stands in its line of sight.</p>`
    : `<p class="label" style="margin:0;text-transform:none;letter-spacing:.02em">Masts: vertical solar arrays 4 m wide from 1 m to the top (5 m: ${kwOf(OBJ.m5).toFixed(1)} kW, 10 m: ${kwOf(OBJ.m10).toFixed(1)} kW, 20 m: ${kwOf(OBJ.m20).toFixed(1)} kW in full Sun). A mast's shadow covers part of another array when the Sun is behind it. Antenna: blocked when a mast stands between it and Earth.</p>`;
  el.innerHTML = h;
  if ($("load")) $("load").onchange = (e) => { const v = parseFloat(e.target.value); if (v > 0) P.load = Math.min(100, v); renderChecks(); };
  el.querySelectorAll(".check").forEach(d => {
    d.onclick = (ev) => { const id = +d.dataset.id; if (ev.shiftKey || ev.ctrlKey || ev.metaKey) { P.sel.has(id) ? P.sel.delete(id) : P.sel.add(id); } else P.sel = new Set([id]); renderPlan(); };
    d.onkeydown = (ev) => { if (ev.key !== "Enter" && ev.key !== " ") return; ev.preventDefault(); const id = d.dataset.id; d.onclick(ev); const again = $("checks").querySelector(`.check[data-id="${id}"]`); if (again) again.focus(); };      // the list is redrawn, so put the focus back
  });
}
function planStop() { P.playing = false; cancelAnimationFrame(P.raf); $("plan-play").textContent = "▶"; $("plan-play").setAttribute("aria-label", "Play"); }
function deleteSelected() { if (!P.sel.size) return; P.dirty = true; P.objs = P.objs.filter(o => !P.sel.has(o.id)); P.sel = new Set(); if (!P.objs.length) P.cleared = true; renderPlan(); }
function planEvents() {
  const cv = $("plan-cv");
  const pick = (x, y) => { let best = null, bd = 14; for (const o of P.objs) { const [px, py] = toPx(o.e, o.n); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = o; } } return best; };
  const pos = (ev) => { const r = cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  let raf = 0; const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderPlan(); }); };
  cv.addEventListener("pointerdown", (ev) => {
    const [x, y] = pos(ev), hit = pick(x, y), multi = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    ev.preventDefault(); cv.setPointerCapture(ev.pointerId);
    if (RV.open) {                                              // rover marks come first while its window is open
      const near = (p) => { const [px, py] = toPx(p.e, p.n); return Math.hypot(px - x, py - y) < 15; };
      const which = RV.pick || (near(RV.goal) ? "goal" : near(RV.start) ? "start" : null);
      if (which) { const [e, n] = fromPx(x, y); rvPut(which, e, n); RV.drag = which; RV.pick = RV.pick === "start" ? "goal" : null; renderPlan(); return; }
    }
    if (hit) {
      if (multi) { P.sel.has(hit.id) ? P.sel.delete(hit.id) : P.sel.add(hit.id); renderPlan(); return; }
      if (!P.sel.has(hit.id)) P.sel = new Set([hit.id]);
      const [e, n] = fromPx(x, y);
      P.drag = { e, n, items: P.objs.filter(o => P.sel.has(o.id)).map(o => [o, o.e, o.n]) };
      renderPlan(); return;
    }
    if (P.tool !== "move") { const [e, n] = fromPx(x, y); const o = Object.assign({}, OBJ[P.tool], { id: pid++, type: P.tool, e, n }); P.objs.push(o); P.dirty = true; P.sel = new Set([o.id]); renderPlan(); return; }
    P.band = { x0: x, y0: y, x1: x, y1: y, base: multi ? new Set(P.sel) : new Set() };
    P.sel = new Set(P.band.base); renderPlan();
  });
  cv.addEventListener("pointermove", (ev) => {
    const [x, y] = pos(ev);
    if (RV.drag) { const [e, n] = fromPx(x, y); rvPut(RV.drag, e, n); later(); return; }
    if (P.drag) {
      const [e, n] = fromPx(x, y), de = e - P.drag.e, dn = n - P.drag.n, [le, ln] = planLim();
      P.dirty = true;
      for (const [o, e0, n0] of P.drag.items) { o.e = Math.max(-le, Math.min(le, e0 + de)); o.n = Math.max(-ln, Math.min(ln, n0 + dn)); }
      later();
    } else if (!P.band) {
      const [e, n] = fromPx(x, y), t = planProbe(e, n); if (t) { P.probe = true; $("plan-probe").textContent = t; }
    } else {
      const b = P.band; b.x1 = x; b.y1 = y;
      const xa = Math.min(b.x0, b.x1), xb = Math.max(b.x0, b.x1), ya = Math.min(b.y0, b.y1), yb = Math.max(b.y0, b.y1);
      P.sel = new Set(b.base); for (const o of P.objs) { const [px, py] = toPx(o.e, o.n); if (px >= xa && px <= xb && py >= ya && py <= yb) P.sel.add(o.id); }
      later();
    }
  });
  const up = () => { const had = P.band; P.drag = null; P.band = null; RV.drag = null; if (had) renderPlan(); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", () => { if (P.probe) { P.probe = false; renderPlan(); } });
  document.querySelectorAll("#pl-seg button").forEach(b => b.onclick = () => { P.layer = b.dataset.l; renderPlan(); });
  document.addEventListener("keydown", (ev) => {
    if (location.hash !== "#plan" || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); deleteSelected(); }
    if (ev.key === "Escape") { if (RV.pick) RV.pick = null; else P.sel = new Set(); renderPlan(); }
  });
  document.querySelectorAll(".tool").forEach(b => b.onclick = () => { P.tool = b.dataset.tool; renderPlan(); });
  $("del-obj").onclick = deleteSelected;
  $("clear-plan").onclick = () => { P.objs = []; P.sel = new Set(); P.dirty = true; renderPlan(); };
  $("reset-plan").onclick = () => { exampleLayout(); P.dirty = true; renderPlan(); };
  $("plan-range").oninput = (e) => { S.i = periodStart() + +e.target.value; renderPlan(); };
  $("plan-play").onclick = () => {
    if (P.playing) return planStop();
    P.playing = true; $("plan-play").textContent = "❚❚"; $("plan-play").setAttribute("aria-label", "Pause");
    const i0 = periodStart(); let k = Math.max(0, S.i - i0);
    const tick = () => { if (!P.playing) return; k += Math.max(1, Math.round(periodN() / 400)); if (k >= periodN()) k = 0; S.i = i0 + k; renderPlan(); P.raf = requestAnimationFrame(tick); };
    P.raf = requestAnimationFrame(tick);
  };
  document.querySelectorAll("#z-seg button").forEach(b => b.onclick = () => { P.view = +b.dataset.z; renderPlan(); });
}
