"use strict";
// Long Shadows · rover route on the base plan.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- rover route on the base plan ----------
// Data (made by build/rover_data.py): for every 40 m cell of the 4 km box, the skyline 2 m above the ground in 360 directions, and the mean slope.
// A cell is in the Sun when the Sun's centre stands above that skyline at the hour the rover gets there.
const RV = { open: false, state: "idle", err: "", hz: null, slope: null, G: 100, cell: 40, q: 0.05, off: 4, sq: 0.25,
  start: { e: 60, n: -60 }, goal: { e: -1700, n: 0 }, pick: null, drag: null, speed: 0.7, maxSlope: 15, batt: 2, back: false, slow: false, scan: 0, res: null, key: "", cvS: null, cvT: null };
function loadRover() {
  if (RV.state !== "idle") return; RV.state = "loading";
  const site = P.site, put = (o) => Object.assign(P.site === site ? RV : PLANS[site].rv, o);            // the site may be switched while the file is on its way
  fetch(`data/rover${site === "ridge" ? "" : "_" + site}.json`).then(r => { if (!r.ok) throw new Error("file not found"); return r.json(); }).then(m => new Promise((ok, bad) => {
    const im = new Image();
    im.onload = () => {
      const n = m.grid * m.grid, cv = document.createElement("canvas"); cv.width = 360; cv.height = n;
      const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0);
      const d = cx.getImageData(0, 0, 360, n).data, hz = new Uint8Array(n * 360); let sum = 0;
      for (let k = 0, p = 0; k < hz.length; k++, p += 4) { hz[k] = d[p]; sum += d[p]; }
      if (sum % 1000000007 !== m.sum) return bad(new Error("the image was altered while loading"));   // guards against colour-managed decoding
      put({ hz, slope: new Uint8Array(b64(m.slope_b64)), G: m.grid, cell: m.cell_m, q: m.q, off: m.off, sq: m.slope_q, state: "ready" });
      if (P.site === site && RV.fresh) { RV.fresh = false; rvAuto(); } ok();
    };
    im.onerror = () => bad(new Error("image not found")); im.src = "data/" + m.file;
  })).catch(e => { put({ state: "failed", err: e.message }); }).then(() => { if (curView() === "plan") renderPlan(); });
}
const rvCell = (p) => { const G = RV.G, half = S.plan.size_m / 2; return Math.max(0, Math.min(G - 1, Math.floor((half - p.n) / RV.cell))) * G + Math.max(0, Math.min(G - 1, Math.floor((p.e + half) / RV.cell))); };
const rvE = (k) => (k % RV.G + 0.5) * RV.cell - S.plan.size_m / 2, rvN = (k) => S.plan.size_m / 2 - (Math.floor(k / RV.G) + 0.5) * RV.cell;
function sunAtT(c, t) {       // Sun azimuth and elevation at a moment between two hourly values
  const i = Math.max(0, Math.min(S.n - 2, Math.floor(t))), f = clamp01(t - i), d = ((c.saz[i + 1] - c.saz[i] + 540) % 360) - 180;
  return [c.saz[i] + d * f, c.sel[i] + (c.sel[i + 1] - c.sel[i]) * f];
}
// how far the Sun's centre stands above the skyline of cell k, in degrees (negative = the cell is in shadow).
// The Sun is taken as seen from the middle of the box; the ground of a cell e, n metres away is tilted by (distance toward the Sun) / (radius of the Moon).
function rvMargin(k, az, el) {
  const a = az * D2R, x = (((az % 360) + 360) % 360) - 0.5, j = Math.floor(x), f = x - j, o = k * 360;
  const h = (RV.hz[o + (j + 360) % 360] * (1 - f) + RV.hz[o + (j + 1) % 360] * f) * RV.q - RV.off;
  return el + (rvE(k) * Math.sin(a) + rvN(k) * Math.cos(a)) / (RM * 1000) * R2D - h;
}
const RV_MOVES = (() => { const m = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const a = Math.abs(dx), b = Math.abs(dy); if ((a === 0 && b === 0) || (a === 2 && b === 2) || (a === 2 && b === 0) || (a === 0 && b === 2)) continue;
  const mids = a + b === 3 ? (b === 2 ? [[0, dy / 2], [dx, dy / 2]] : [[dx / 2, 0], [dx / 2, dy]]) : []; m.push({ dx, dy, len: Math.hypot(dx, dy), mids }); } return m; })();
// Expert option: the rover slows down evenly from full speed on flat ground to half speed on the steepest slope it is allowed to take (our own simple rule)
const rvK = (w) => S.expert && RV.slow ? 1 - 0.5 * Math.min(1, RV.slope[w] * RV.sq / RV.maxSlope) : 1;
// fastest way from cell a to cell b leaving at hour t0. lam = how much an hour in shadow is disliked (0 = not at all).
function rvSearch(a, b, t0, lam) {
  const G = RV.G, N = G * G, cost = new Float64Array(N).fill(Infinity), time = new Float64Array(N), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const lim = RV.maxSlope / RV.sq, c = series(P.site, "10"), v = RV.speed * 1000, sl = RV.slope;
  const hk = [], hv = [];                                             // a small binary heap of (cost, cell)
  const push = (key, val) => { let i = hk.length; hk.push(key); hv.push(val); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= key) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = key; hv[i] = val; };
  const pop = () => { const top = hv[0], key = hk.pop(), val = hv.pop(), n = hk.length; if (n) { let i = 0; for (;;) { let ch = 2 * i + 1; if (ch >= n) break; if (ch + 1 < n && hk[ch + 1] < hk[ch]) ch++; if (hk[ch] >= key) break; hk[i] = hk[ch]; hv[i] = hv[ch]; i = ch; } hk[i] = key; hv[i] = val; } return top; };
  cost[a] = 0; push(0, a);
  while (hk.length) {
    const u = pop(); if (done[u]) continue; done[u] = 1; if (u === b) break;
    const ur = Math.floor(u / G), uc = u % G;
    for (const mv of RV_MOVES) {
      const r = ur + mv.dy, cc = uc + mv.dx; if (r < 0 || cc < 0 || r >= G || cc >= G) continue;
      const w = r * G + cc; if (done[w] || sl[w] > lim) continue;
      if (mv.mids.length && (sl[(ur + mv.mids[0][1]) * G + uc + mv.mids[0][0]] > lim || sl[(ur + mv.mids[1][1]) * G + uc + mv.mids[1][0]] > lim)) continue;
      const dt = mv.len * RV.cell / (v * rvK(w)), tt = time[u] + dt, s = sunAtT(c, t0 + tt), nc = cost[u] + dt * (rvMargin(w, s[0], s[1]) < 0 ? 1 + lam : 1);
      if (nc < cost[w]) { cost[w] = nc; time[w] = tt; prev[w] = u; push(nc, w); }
    }
  }
  if (!done[b]) return null;
  const path = []; for (let k = b; k !== -1; k = prev[k]) path.push(k); return path.reverse();
}
// drive along a path and keep the books: time, shadow, battery
function rvSim(path, t0, ch0) {
  const c = series(P.site, "10"), v = RV.speed * 1000, G = RV.G, shade = [false], tAt = [0];
  let t = 0, len = 0, ch = ch0, minCh = ch0, shadow = 0, run = 0, longest = 0, steep = RV.slope[path[0]] * RV.sq, dead = null;
  for (let k = 1; k < path.length; k++) {
    const d = Math.hypot(path[k] % G - path[k - 1] % G, Math.floor(path[k] / G) - Math.floor(path[k - 1] / G)) * RV.cell, dt = d / (v * rvK(path[k]));
    const s = sunAtT(c, t0 + t + dt), sh = rvMargin(path[k], s[0], s[1]) < 0;
    if (sh) { if (dead === null && ch - dt < 0) dead = { km: (len + d * ch / dt) / 1000, k }; ch -= dt; shadow += dt; run += dt; if (run > longest) longest = run; }
    else { ch = Math.min(RV.batt, ch + dt); run = 0; }
    t += dt; len += d; if (ch < minCh) minCh = ch; steep = Math.max(steep, RV.slope[path[k]] * RV.sq); shade.push(sh); tAt.push(t);
  }
  return { path, shade, tAt, len, time: t, shadow, longest, minCh: Math.max(0, minCh), endCh: Math.max(0, ch), steep, dead };
}
// one leg: the fastest way first; if its shadows drain the battery, try ways that like the Sun more and more, and keep the first that survives
// (and, for a round trip, the first that also leaves enough charge for the way back: that is what "accept" checks)
function rvLeg(a, b, t0, ch0, accept) {
  let direct = null, last = null;
  for (const lam of [0, 0.5, 1, 2, 4, 8, 20, 60]) {
    const p = rvSearch(a, b, t0, lam); if (!p) return null;
    const r = rvSim(p, t0, ch0); r.lam = lam; if (!direct) direct = r; last = r;
    if (!r.dead && (!accept || accept(r))) return { r, direct };
    if (!r.shadow) break;                                              // nothing sunnier can exist
  }
  return { r: last, direct, failed: true };
}
function rvCompute() {
  const key = [P.site, S.i, RV.start.e, RV.start.n, RV.goal.e, RV.goal.n, RV.speed, RV.maxSlope, RV.batt, RV.back, S.expert && RV.slow].join("|");
  if (key === RV.key) return RV.res; RV.key = key;
  if (!RV.scanning) { const m = $("rv-wait-msg"); if (m) m.textContent = ""; }                    // the note of "Find a later start" belongs to the old question
  const a = rvCell(RV.start), b = rvCell(RV.goal), lim = RV.maxSlope / RV.sq;
  if (RV.slope[a] > lim) return (RV.res = { fail: "start", deg: RV.slope[a] * RV.sq });
  if (RV.slope[b] > lim) return (RV.res = { fail: "goal", deg: RV.slope[b] * RV.sq });
  if (a === b) return (RV.res = { fail: "same" });
  if (!RV.back) { const out = rvLeg(a, b, S.i, RV.batt); return (RV.res = out ? { legs: [out] } : { fail: "blocked" }); }
  let back = null, first = null;                                       // there and back: the two legs are chosen together
  const out = rvLeg(a, b, S.i, RV.batt, (r) => { const bk = rvLeg(b, a, S.i + r.time, r.endCh); if (!first) first = { r, bk }; if (bk && !bk.failed) { back = bk; return true; } return false; });
  if (!out) return (RV.res = { fail: "blocked" });
  if (back) return (RV.res = { legs: [out, back] });
  if (!first) return (RV.res = { legs: [out] });                       // the battery does not even last one way
  return (RV.res = { legs: first.bk ? [{ r: first.r, direct: out.direct }, first.bk] : [{ r: first.r, direct: out.direct }] });
}
// Advanced: latitude and longitude of a point of the plan, the same way the plan itself was cut out of the LOLA map (polar stereographic plane, metres)
function planLL(e, n) {
  const R = RM * 1000, rho0 = 2 * R * Math.tan((90 + S.plan.lat) / 2 * D2R), nx = Math.sin(S.plan.lon * D2R), ny = Math.cos(S.plan.lon * D2R);
  const x = rho0 * nx + e * ny + n * nx, y = rho0 * ny - e * nx + n * ny;
  return [2 * Math.atan(Math.hypot(x, y) / (2 * R)) * R2D - 90, (Math.atan2(x, y) * R2D + 360) % 360];
}
function routeCSV() {
  const R = rvCompute(), L = [`# Long Shadows · rover route · ${S.byId[P.site].name} · leaves ${dateStr(S.i)}Z · speed ${RV.speed} km/h, slope limit ${RV.maxSlope} deg, battery ${RV.batt} h${S.expert && RV.slow ? ", slower on slopes" : ""}`,
    "# east and north in metres from the centre of the plan; one row per 40 m cell on the way", "leg,point,east_m,north_m,lat_deg,lon_deg,hours_from_start,time_utc,in_shadow,slope_deg"];
  if (!R || !R.legs) return L.concat(["# no route: " + (R && R.fail ? R.fail : "not ready")]).join("\n");
  let t0 = 0;
  R.legs.forEach((leg, k) => { const q = leg.r; q.path.forEach((c, j) => { const e = rvE(c), n = rvN(c), ll = planLL(e, n), t = t0 + q.tAt[j];
    L.push([k + 1, j + 1, e.toFixed(0), n.toFixed(0), ll[0].toFixed(5), ll[1].toFixed(4), t.toFixed(3), new Date(T0 + (S.i + t) * 3600e3).toISOString().slice(0, 16) + "Z", q.shade[j] ? 1 : 0, (RV.slope[c] * RV.sq).toFixed(1)].join(",")); }); t0 += q.time; });
  return L.join("\n");
}
function layoutCSV() {
  const res = P.res, L = [`# Long Shadows · base layout · ${S.byId[P.site].name} · ${PERIODS[S.period].label} from ${dateStr(periodStart())}Z`,
    "# east and north in metres from the centre of the plan; sunlight for masts, Earth in view for antennas, in percent of the period", "object,kind,height_m,east_m,north_m,lat_deg,lon_deg,ground_m,from_terrain_pct,with_other_objects_pct"];
  for (const o of P.objs) { const r = res && res.R.get(o.id), ll = planLL(o.e, o.n), mast = o.kind === "mast";
    L.push([nameOf(o), o.kind, o.h, o.e.toFixed(0), o.n.toFixed(0), ll[0].toFixed(5), ll[1].toFixed(4), (groundAt(o.e, o.n) + (S.plan.h0_m || 0)).toFixed(0),
      r ? (100 * (mast ? r.sunT : r.earthT) / res.cnt).toFixed(1) : "", r ? (100 * (mast ? r.sunAfter : r.earthOk) / res.cnt).toFixed(1) : ""].join(",")); }
  return L.join("\n");
}
function giveCSV(text, name, say) {                                   // copy or download, with the same notes as the other CSV buttons
  return { copy: () => { if (!navigator.clipboard) return say("The browser did not allow copying here."); navigator.clipboard.writeText(text()).then(() => say("Copied. Paste into a spreadsheet."), () => say("The browser did not allow copying here.")); },
    save: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text()], { type: "text/csv" })); a.download = name(); document.body.appendChild(a); a.click(); a.remove(); say("If no file appeared, this preview blocks downloads: use Copy, or the public site."); } };
}
// a first route for a site without a prepared example: from the gentle cell nearest the centre to a gentle cell about 1.3 km away that can be reached
function rvAuto() {
  const G = RV.G, lim = RV.maxSlope / RV.sq; let a = -1, da = 1e9;
  for (let k = 0; k < G * G; k++) if (RV.slope[k] <= lim) { const d = Math.hypot(rvE(k), rvN(k)); if (d < da) { da = d; a = k; } }
  if (a < 0) return;
  RV.start = { e: rvE(a), n: rvN(a) }; RV.goal = { e: RV.start.e, n: RV.start.n };
  const cand = []; for (let k = 0; k < G * G; k++) if (RV.slope[k] <= lim * 0.6) { const d = Math.hypot(rvE(k) - RV.start.e, rvN(k) - RV.start.n); if (d > 900 && d < 1700) cand.push([Math.abs(d - 1300), k]); }
  cand.sort((x, y) => x[0] - y[0]);
  for (let j = 0, step = Math.max(1, Math.floor(cand.length / 12)); j < cand.length; j += step) if (rvSearch(a, cand[j][1], S.i, 0)) { RV.goal = { e: rvE(cand[j][1]), n: rvN(cand[j][1]) }; return; }
}
// --- Expert: the same plan and rover on other sites. Each site keeps its own terrain, objects and rover marks. ---
const PLAN_SITES = ["ridge", "gerlache", "shackleton"], PLANS = {};
function planKeep() {
  PLANS[P.site] = { plan: S.plan, img: S.planImg, objs: P.objs, cleared: P.cleared,
    rv: { hz: RV.hz, slope: RV.slope, state: RV.state, err: RV.err, G: RV.G, cell: RV.cell, q: RV.q, off: RV.off, sq: RV.sq, start: RV.start, goal: RV.goal, fresh: RV.fresh } };
}
function planApply(id) {
  const d = PLANS[id]; P.site = id; S.plan = d.plan; S.planImg = d.img; P.objs = d.objs; P.cleared = d.cleared;
  P.sel = new Set(); P.local = {}; P.lightCv = null; P.dirty = true;
  Object.assign(RV, d.rv, { res: null, key: "", pick: null, drag: null, cvS: null, cvT: null });
  if (!P.objs.length && !P.cleared) exampleLayout();
  if (RV.open) loadRover();
  renderPlan();
}
function planSwitch(id) {
  if (id === P.site || !PLAN_SITES.includes(id)) return;
  planKeep();
  if (PLANS[id]) return planApply(id);
  const msg = $("plan-sites-msg"); msg.textContent = "Loading the terrain…";
  fetch(`data/plan_${id}.json`).then(r => { if (!r.ok) throw new Error("file not found"); return r.json(); }).then(plan => new Promise((ok, bad) => {
    const img = new Image(); img.onload = () => ok({ plan, img }); img.onerror = () => bad(new Error("picture not found")); img.src = `data/plan_relief_${id}.jpg`;
  })).then(({ plan, img }) => {
    PLANS[id] = { plan: Object.assign(plan, { h: new Int16Array(b64(plan.height_b64)) }), img, objs: [], cleared: false,
      rv: { hz: null, slope: null, state: "idle", err: "", G: RV.G, cell: RV.cell, q: RV.q, off: RV.off, sq: RV.sq, start: { e: 0, n: 0 }, goal: { e: 0, n: 0 }, fresh: true } };
    msg.textContent = ""; if (S.expert) { planKeep(); planApply(id); }
  }).catch(e => { msg.textContent = "Could not load this site: " + e.message; });
}
// drawn under the masts: where the ground is in shadow at the moment on the slider, and where it is too steep for this rover
function rvLayers(ctx, w, h, s) {
  if (!RV.open || RV.state !== "ready") return;
  const G = RV.G, SZ = S.plan.size_m, c = series(P.site, "10"), mk = () => { const cv = document.createElement("canvas"); cv.width = cv.height = G; return cv; };
  if (!RV.cvS) { RV.cvS = mk(); RV.cvT = mk(); }
  if (RV.cvS.key !== S.i) {
    const x = RV.cvS.getContext("2d"), img = x.createImageData(G, G), az = c.saz[S.i], el = c.sel[S.i];
    for (let k = 0; k < G * G; k++) { const f = clamp01(rvMargin(k, az, el) / (2 * RSUN) + 0.5); img.data[k * 4] = 34; img.data[k * 4 + 1] = 44; img.data[k * 4 + 2] = 62; img.data[k * 4 + 3] = 118 * (1 - f); }
    x.putImageData(img, 0, 0); RV.cvS.key = S.i;
  }
  if (RV.cvT.key !== RV.maxSlope) {
    const x = RV.cvT.getContext("2d"), img = x.createImageData(G, G), lim = RV.maxSlope / RV.sq;
    for (let k = 0; k < G * G; k++) { img.data[k * 4] = 156; img.data[k * 4 + 1] = 58; img.data[k * 4 + 2] = 36; img.data[k * 4 + 3] = RV.slope[k] > lim ? 84 : 0; }
    x.putImageData(img, 0, 0); RV.cvT.key = RV.maxSlope;
  }
  const sw = G * w / s / SZ, sh = G * h / s / SZ;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(RV.cvT, (G - sw) / 2, (G - sh) / 2, sw, sh, 0, 0, w, h); ctx.drawImage(RV.cvS, (G - sw) / 2, (G - sh) / 2, sw, sh, 0, 0, w, h); ctx.restore();
}
// drawn over everything: the route, hour marks, start and goal
function rvRoute(ctx) {
  if (!RV.open) return;
  const text = (t, x, y, al) => { ctx.font = cvf(12); ctx.textAlign = al || "left"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(235,236,234,.92)"; ctx.strokeText(t, x, y); ctx.fillStyle = col("--ink"); ctx.fillText(t, x, y); ctx.textAlign = "left"; };
  const R = RV.state === "ready" ? rvCompute() : null;
  if (R && R.legs) {
    let tBase = 0; const total = R.legs.reduce((p, l) => p + l.r.time, 0), every = total <= 12 ? 1 : total <= 48 ? 6 : 24;
    R.legs.forEach((leg, li) => {
      const r = leg.r, pts = r.path.map(k => toPx(rvE(k), rvN(k)));
      pts[0] = toPx(li ? RV.goal.e : RV.start.e, li ? RV.goal.n : RV.start.n); pts[pts.length - 1] = toPx(li ? RV.start.e : RV.goal.e, li ? RV.start.n : RV.goal.n);
      const end = r.dead ? r.dead.k : pts.length - 1;
      ctx.lineJoin = ctx.lineCap = "round"; ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(240,241,239,.9)"; ctx.lineWidth = 5.5; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      for (let k = 1; k < pts.length; k++) {              // amber = driving in the Sun, dark = in shadow, faint = the part never reached
        ctx.strokeStyle = k > end ? "rgba(26,27,27,.28)" : r.shade[k] ? "#22262e" : col("--sun"); ctx.lineWidth = 2.6; ctx.setLineDash(li ? [7, 5] : []);
        ctx.beginPath(); ctx.moveTo(pts[k - 1][0], pts[k - 1][1]); ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let k = 1, next = (Math.floor(tBase / every) + 1) * every; k <= end; k++) {            // hour marks
        while (tBase + r.tAt[k] >= next) {
          const f = (next - tBase - r.tAt[k - 1]) / (r.tAt[k] - r.tAt[k - 1]), x = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, y = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f;
          ctx.fillStyle = "#f1f2f0"; ctx.strokeStyle = col("--ink"); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); ctx.stroke();
          if (Math.hypot(x - pts[pts.length - 1][0], y - pts[pts.length - 1][1]) > 34 && Math.hypot(x - pts[0][0], y - pts[0][1]) > 34) text(every === 24 ? `+${next / 24} d` : `+${next} h`, x + 7, li ? y - 8 : y + 13);
          next += every;
        }
      }
      if (r.dead) { const p = pts[r.dead.k]; ctx.strokeStyle = col("--bad"); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(p[0] - 6, p[1] - 6); ctx.lineTo(p[0] + 6, p[1] + 6); ctx.moveTo(p[0] + 6, p[1] - 6); ctx.lineTo(p[0] - 6, p[1] + 6); ctx.stroke(); text("BATTERY EMPTY", p[0] + 10, p[1] - 8); }
      tBase += r.time;
    });
  }
  const [sx, sy] = toPx(RV.start.e, RV.start.n), [gx, gy] = toPx(RV.goal.e, RV.goal.n);
  ctx.setLineDash([]); ctx.lineWidth = 2.2; ctx.strokeStyle = col("--ink"); ctx.fillStyle = "#f1f2f0";
  ctx.beginPath(); ctx.arc(sx, sy, 6.5, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col("--ink"); ctx.beginPath(); ctx.moveTo(gx, gy - 8); ctx.lineTo(gx + 8, gy); ctx.lineTo(gx, gy + 8); ctx.lineTo(gx - 8, gy); ctx.closePath(); ctx.fill();
  text("START", sx + 11, sy + 16); text("GOAL", gx + 12, gy + 16);
}
function rvPanel() {
  const win = $("rover"); win.hidden = !RV.open; $("rover-open").setAttribute("aria-pressed", String(RV.open));
  $("plan-cv").parentElement.classList.toggle("rvpick", RV.open && !!RV.pick);
  if (!RV.open) return;
  [["rv-se", RV.start.e], ["rv-sn", RV.start.n], ["rv-ge", RV.goal.e], ["rv-gn", RV.goal.n]].forEach(([id, v]) => { const el = $(id); if (document.activeElement !== el) el.value = Math.round(v); });
  $("rv-set-start").setAttribute("aria-pressed", String(RV.pick === "start")); $("rv-set-goal").setAttribute("aria-pressed", String(RV.pick === "goal"));
  const out = $("rv-out"), hint = $("rv-hint");
  hint.textContent = RV.pick ? `Now click the map to put the ${RV.pick}.` : "Drag the two marks on the map, or press a button and click. The rover leaves at the moment on the time slider.";
  if (RV.state === "failed") { out.innerHTML = `<p>The terrain for the rover did not load (${RV.err}). The rest of the plan works as before.</p>`; return; }
  if (RV.state !== "ready") { out.innerHTML = `<p>Loading the terrain for the rover…</p>`; return; }
  const R = rvCompute(), km = (m) => (m / 1000).toFixed(m < 9950 ? 2 : 1) + " km", pc = (h) => Math.round(100 * h / RV.batt) + "%";
  if (R.fail) {
    const dg = R.deg != null ? R.deg.toFixed(0) : "";
    const t = { start: `The start stands on ground of ${dg}°, steeper than this rover can take. Move it or raise the slope limit.`, goal: `The goal lies on ground of ${dg}°, steeper than this rover can take. Move it or raise the slope limit.`,
      same: "Start and goal are in the same 40 m cell. Move one of them.", blocked: `Every way to the goal crosses ground steeper than ${RV.maxSlope}°. Raise the slope limit or pick another goal.` }[R.fail];
    out.innerHTML = `<span class="tag bad">${R.fail === "same" ? "Nothing to drive" : "No way through"}</span><p>${t}</p>`; return;
  }
  const legs = R.legs.map(l => l.r), a = legs[0], dl = legs.find(r => r.dead), back = legs.length > 1, wanted = RV.back;
  const len = legs.reduce((p, r) => p + r.len, 0), time = legs.reduce((p, r) => p + r.time, 0), shadow = legs.reduce((p, r) => p + r.shadow, 0);
  const longest = Math.max(...legs.map(r => r.longest)), steep = Math.max(...legs.map(r => r.steep)), minCh = Math.min(...legs.map(r => r.minCh)), endCh = legs[legs.length - 1].endCh;
  let head;
  if (dl) { const leg = legs.indexOf(dl), done = (leg ? a.len : 0) / 1000 + dl.dead.km; head = `<span class="tag bad">Battery runs out</span><p>The battery is empty after <b>${done.toFixed(2)} km</b>${leg ? ", on the way back" : ""}, <b>${Math.max(0.01, dl.len / 1000 - dl.dead.km).toFixed(2)} km</b> short. No way that keeps the battery alive was found. Leave at another hour, drive faster or take a bigger battery.</p>`; }
  else if (wanted && !back) head = `<span class="tag bad">No way back</span><p>The rover reaches the goal, but no way back was found.</p>`;
  else head = `<span class="tag ok">${back ? "There and back" : "Arrives"}</span><p>${back ? "The rover is back at the start" : "The rover reaches the goal"} after <b>${fmtDur(time)}</b>, on ${new Date(T0 + (S.i + time) * 3600e3).toUTCString().slice(5, 22)} UTC, with <b>${pc(endCh)}</b> of the battery left.</p>`;
  const d0 = R.legs[0].direct, det = !dl && a.lam > 0 && d0 ? `<p>The shortest way (${km(d0.len)}) spends ${fmtDur(d0.shadow)} in shadow and would empty the battery, so the route goes round through the light: ${km(Math.max(0, a.len - d0.len))} longer.</p>` : "";
  out.innerHTML = `${head}${det}<table>
    <tr><td>Distance</td><td>${km(len)}</td></tr><tr><td>Driving time</td><td>${fmtDur(time)}</td></tr>
    <tr><td>Steepest ground</td><td>${steep.toFixed(0)}°</td></tr>
    <tr><td>In shadow</td><td>${shadow ? fmtDur(shadow) : "none"}</td></tr>${shadow ? `<tr><td>Longest stretch in shadow</td><td>${fmtDur(longest)}</td></tr>` : ""}
    <tr><td>Battery, lowest</td><td>${pc(minCh)}</td></tr></table>
    <p class="key">Amber line: driving in the Sun. Dark line: in shadow. Blue-grey ground is in shadow at departure; red ground is too steep for this rover.</p>`;
}
function rvPut(which, e, n) { const lim = S.plan.size_m / 2 - RV.cell / 2; RV[which] = { e: Math.max(-lim, Math.min(lim, e)), n: Math.max(-lim, Math.min(lim, n)) }; }
function roverEvents() {
  const win = $("rover"), bar = $("rover-bar");
  const keep = () => { if (getComputedStyle(win).position !== "fixed") { win.style.left = win.style.top = win.style.right = win.style.bottom = win.style.width = ""; return; } if (win.hidden || !win.style.top) return; const r = win.getBoundingClientRect(); win.style.left = Math.max(4, Math.min(window.innerWidth - r.width - 4, r.left)) + "px"; win.style.top = Math.max(4, Math.min(window.innerHeight - 40, r.top)) + "px"; };
  $("rover-open").onclick = () => { RV.open = !RV.open; RV.pick = null; if (RV.open) { loadRover(); P.view = 4000; P.tool = "move"; } renderPlan(); keep(); if (RV.open && getComputedStyle(win).position !== "fixed") win.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  $("rover-close").onclick = () => { RV.open = false; RV.pick = null; renderPlan(); $("rover-open").focus(); };
  let grab = null;
  bar.addEventListener("pointerdown", (ev) => { if (ev.target.closest("button") || getComputedStyle(win).position !== "fixed") return; const r = win.getBoundingClientRect(); grab = { dx: ev.clientX - r.left, dy: ev.clientY - r.top }; bar.setPointerCapture(ev.pointerId); bar.classList.add("drag"); ev.preventDefault(); });
  bar.addEventListener("pointermove", (ev) => { if (!grab) return; const r = win.getBoundingClientRect();
    win.style.right = "auto"; win.style.bottom = "auto"; win.style.width = r.width + "px";
    win.style.left = Math.max(4, Math.min(window.innerWidth - r.width - 4, ev.clientX - grab.dx)) + "px"; win.style.top = Math.max(4, Math.min(window.innerHeight - 40, ev.clientY - grab.dy)) + "px"; });
  const drop = () => { grab = null; bar.classList.remove("drag"); }; bar.addEventListener("pointerup", drop); bar.addEventListener("pointercancel", drop);
  window.addEventListener("resize", keep);
  $("rv-set-start").onclick = () => { RV.pick = RV.pick === "start" ? null : "start"; rvPanel(); };
  $("rv-set-goal").onclick = () => { RV.pick = RV.pick === "goal" ? null : "goal"; rvPanel(); };
  const num = (id, key, lo, hi) => { $(id).onchange = (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) RV[key] = Math.max(lo, Math.min(hi, v)); e.target.value = RV[key]; renderPlan(); }; };
  num("rv-speed", "speed", 0.05, 15); num("rv-slope", "maxSlope", 3, 30); num("rv-batt", "batt", 0.5, 200);
  $("rv-back").onchange = (e) => { RV.back = e.target.checked; renderPlan(); };
  $("rv-slow").onchange = (e) => { RV.slow = e.target.checked; renderPlan(); };
  [["rv-se", "start", "e"], ["rv-sn", "start", "n"], ["rv-ge", "goal", "e"], ["rv-gn", "goal", "n"]].forEach(([id, which, ax]) => { $(id).onchange = (ev) => { const v = parseFloat(ev.target.value); if (!isFinite(v)) return; const p = Object.assign({}, RV[which]); p[ax] = v; rvPut(which, p.e, p.n); renderPlan(); }; });
  { const g = giveCSV(routeCSV, () => `long-shadows_route_${P.site}_${dateStr(S.i).slice(0, 13)}.csv`, (t) => { $("rv-wait-msg").textContent = t; }); $("rv-copy").onclick = g.copy; $("rv-save").onclick = g.save; }
  { const g = giveCSV(layoutCSV, () => `long-shadows_layout_${P.site}.csv`, (t) => { $("pl-msg").textContent = t; }); $("pl-copy").onclick = g.copy; $("pl-save").onclick = g.save; }
  ["ob-e", "ob-n"].forEach((id, k) => { $(id).onchange = (ev) => { const v = parseFloat(ev.target.value), o = P.sel.size === 1 && P.objs.find(q => P.sel.has(q.id)); if (!o || !isFinite(v)) return;
    const lim = S.plan.size_m / 2 - 1; o[k ? "n" : "e"] = Math.max(-lim, Math.min(lim, v)); P.dirty = true; renderPlan(); }; });
  // Expert: if the battery does not survive now, look hour by hour for the first later start at which it does (up to 14 days ahead)
  $("rv-wait").onclick = () => {
    const msg = $("rv-wait-msg"), safe = (R) => R && R.legs && R.legs.length === (RV.back ? 2 : 1) && R.legs.every(L => !L.failed && !L.r.dead);
    if (RV.state !== "ready") return;
    if (safe(rvCompute())) { msg.textContent = "The route is already safe at this hour."; return; }
    if (RV.res && RV.res.fail) { msg.textContent = "First put the start and the goal on ground the rover can drive on."; return; }
    const i0 = S.i, token = ++RV.scan; let d = 1;
    const step = () => {
      if (token !== RV.scan || S.i !== i0 || !RV.open) { msg.textContent = ""; return; }                 // something was changed meanwhile: stop quietly
      const t = Date.now(); let hit = 0;
      while (d <= 336 && i0 + d < S.n && Date.now() - t < 40) { S.i = i0 + d; RV.key = ""; RV.scanning = true; const ok = safe(rvCompute()); RV.scanning = false; S.i = i0; RV.key = ""; if (ok) { hit = d; break; } d++; }
      if (hit) { S.i = i0 + hit; RV.scan++; renderPlan(); msg.textContent = `Start moved ${fmtDur(hit)} later: the first hour at which the battery survives the trip.`; return; }
      if (d > 336 || i0 + d >= S.n) { msg.textContent = "No start in the next 14 days lets the battery survive this trip. Try a bigger battery or another goal."; return; }
      msg.textContent = `Looking… ${fmtDur(d)} ahead`; setTimeout(step, 0);
    };
    step();
  };
}
