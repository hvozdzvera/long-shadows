"use strict";
// Long Shadows · the same shading on the graphics card (WebGL2).
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- the same shading on the graphics card (WebGL2), from heights at 195 m per pixel ----------
// Same rule as poleShade: a pixel is lit by the share of the Sun's disc it can see. Here it is worked out for every screen pixel,
// so the picture stays sharp at any size. Where WebGL2 is missing, poleShade above is used instead.
const PG = { ok: false, last: "" };
function gpuInit(h, n, pm) {
  try {
    const cv = document.createElement("canvas"), gl = cv.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl || !gl.getExtension("OES_texture_float_linear")) return false;
    const Rm = RM * 1000, c = n / 2 - 0.5; let z = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = (x - c) * pm, dy = (y - c) * pm; z[y * n + x] = h[y * n + x] - (dx * dx + dy * dy) / (2 * Rm); }
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture()); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (let s = n, lev = 0; ; lev++) {                 // heights and their averages at coarser steps (for terrain far from the pixel)
      gl.texImage2D(gl.TEXTURE_2D, lev, gl.R32F, s, s, 0, gl.RED, gl.FLOAT, z);
      if (s === 1) break;
      const t = s >> 1, m = new Float32Array(t * t);
      for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) { const k = 2 * y * s + 2 * x; m[y * t + x] = (z[k] + z[k + 1] + z[k + s] + z[k + s + 1]) / 4; }
      z = m; s = t;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, `#version 300 es
in vec2 a; out vec2 q; void main() { q = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); gl_Position = vec4(a, 0., 1.); }`));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
uniform sampler2D H;
uniform vec4 rect;            // part of the height map to draw
uniform vec2 sun;             // direction to the Sun on the map
uniform vec3 el;              // tan, sin, cos of the Sun's elevation
uniform float pm, N, tanR, mode, clipR;
in vec2 q; out vec4 o;
float hgt(vec2 p, float lod) { return textureLod(H, p, lod).r; }
void main() {
  vec2 uv = rect.xy + q * rect.zw;
  if (clipR > 0. && length(uv - 0.5) > clipR) { o = vec4(0.); return; }
  float e = 1. / N, z0 = hgt(uv, 0.);
  float gx = (hgt(uv + vec2(e, 0.), 0.) - hgt(uv - vec2(e, 0.), 0.)) / (2. * pm);
  float gy = (hgt(uv + vec2(0., e), 0.) - hgt(uv - vec2(0., e), 0.)) / (2. * pm);
  vec3 n = normalize(vec3(-gx, -gy, 1.));
  float vis = 1., t = pm * 0.75;                         // walk toward the Sun: how much of its disc clears the terrain on the way
  for (int k = 0; k < 170; k++) {
    vec2 p = uv + sun * (t / (pm * N));
    if (p.x <= 0. || p.x >= 1. || p.y <= 0. || p.y >= 1.) break;
    float st = max(pm * 0.75, t * 0.03);
    float m = z0 + t * el.x - hgt(p, max(0., log2(st / pm) - 0.5));
    vis = min(vis, 0.5 + m / (2. * max(t * tanR, 1.5)));
    if (vis <= 0.) break;
    t += st;
  }
  vis = clamp(vis, 0., 1.);
  float dd = el.z * dot(n.xy, sun) + n.z * el.y;
  if (mode > 0.5) { o = vec4(vec3(sqrt(vis * max(dd, 0.))), 1.); return; }       // plain light, for the globe
  float f = vis * clamp(dd * 30., 0., 1.), v = clamp(dd * 3.4 + 0.06, 0., 1.);
  float amb = clamp(dot(n, vec3(-0.5792, -0.5792, 0.5736)), 0., 1.);
  vec3 lit = vec3(176., 177., 174.) / 255. + vec3(72., 72., 73.) / 255. * v, dark = vec3(33., 32., 29.) / 255. + vec3(30., 29., 27.) / 255. * amb;
  o = vec4(mix(dark, lit, f), 1.);
}`));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; for (const k of ["rect", "sun", "el", "pm", "N", "tanR", "mode", "clipR"]) U[k] = gl.getUniformLocation(pr, k);
    gl.uniform1f(U.pm, pm); gl.uniform1f(U.N, n); gl.uniform1f(U.tanR, Math.tan(RSUN * D2R));
    Object.assign(PG, { cv, gl, U, n, ok: true, rate: 1e9 });
    // How fast is this graphics card? Three small test frames, the last two timed. A slow card gets a smaller picture, a very slow one the plain method.
    const bench = () => { gpuShade("bench", 135, 1.5, [0.25, 0.25, 0.5, 0.5], 256); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); };
    bench(); const t0 = performance.now(); bench(); bench(); PG.rate = 2 * 65536 / Math.max(0.4, performance.now() - t0);        // pixels per millisecond
    if (PG.rate * 45 < 420 * 420) { PG.ok = false; console.warn("GPU shading is off: this graphics card is too slow for it"); return false; }
    return true;
  } catch (e) { console.warn("GPU shading is off:", e.message); return false; }
}
function gpuShade(what, azDeg, elDeg, rect, size, mode = 0, clipR = 0, budget = 45) {      // budget: milliseconds one frame may take
  const { gl, cv, U } = PG;
  if (!PG.ok || gl.isContextLost()) { PG.ok = false; return false; }
  size = Math.max(256, Math.min(size, Math.floor(Math.sqrt(PG.rate * budget))));
  if (cv.width !== size) cv.width = cv.height = size;
  const az = azDeg * D2R, e = elDeg * D2R;
  gl.viewport(0, 0, size, size);
  gl.uniform4f(U.rect, rect[0], rect[1], rect[2], rect[3]); gl.uniform2f(U.sun, Math.sin(az), -Math.cos(az)); gl.uniform3f(U.el, Math.tan(e), Math.sin(e), Math.cos(e));
  gl.uniform1f(U.mode, mode); gl.uniform1f(U.clipR, clipR);
  gl.drawArrays(gl.TRIANGLES, 0, 3); PG.last = what;
  return true;
}
const SMALL = Math.min(window.screen.width, window.screen.height) < 700;
function drawPole() {
  const cv = $("pole"); if (!PO.N || !cv.clientWidth) return;
  const side = Math.min(cv.clientWidth, 680), { ctx } = fitCanvas(cv, side), w = cv.clientWidth;
  const R = side / 2 - 46, cx = w / 2, cy = side / 2, N = PO.N, k = 2 * R / (N / 2), RADm = PO.j.radius_m / 2;      // the hero shows the inner 200 km
  const gpu = PG.ok && gpuShade("hero", PO.az, PO.el, [0.25, 0.25, 0.5, 0.5], Math.min(2048, Math.round(2 * R * Math.min(2, window.devicePixelRatio || 1))));
  if (!gpu && PO.drawnAz !== PO.az) { poleShade(PO.az, PO.el, true); PO.drawnAz = PO.az; }
  const P2 = (p) => [cx - R + (p[0] - N / 4) * k, cy - R + (p[1] - N / 4) * k];
  ctx.clearRect(0, 0, w, side);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip(); ctx.imageSmoothingQuality = "high";
  if (gpu) ctx.drawImage(PG.cv, cx - R, cy - R, 2 * R, 2 * R); else ctx.drawImage(PO.off, N / 4, N / 4, N / 2, N / 2, cx - R, cy - R, 2 * R, 2 * R);
  // latitude circles and meridians
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(150,148,140,.55)"; ctx.setLineDash([2, 4]);
  for (const lat of [-89, -88, -87]) { const r = 2 * RM * 1000 * Math.tan(Math.PI / 4 + lat * D2R / 2) / RADm * R; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  ctx.setLineDash([1, 5]);
  for (let a = 0; a < 360; a += 30) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a * D2R) * R, cy - Math.cos(a * D2R) * R); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.restore();
  ctx.strokeStyle = col("--ink"); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  // outer ring: longitude ticks
  ctx.strokeStyle = col("--line-2"); ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, 7); ctx.stroke();
  ctx.fillStyle = col("--muted"); ctx.font = cvf(11.5); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let a = 0; a < 360; a += 5) {
    const big = a % 30 === 0, s = Math.sin(a * D2R), c = -Math.cos(a * D2R), r0 = R + 10, r1 = R + (big ? 18 : 14);
    ctx.strokeStyle = big ? col("--ink-2") : col("--line-2"); ctx.beginPath(); ctx.moveTo(cx + s * r0, cy + c * r0); ctx.lineTo(cx + s * r1, cy + c * r1); ctx.stroke();
    if (big) ctx.fillText(a + "°" + (a && a !== 180 ? "E" : ""), cx + s * (R + 31), cy + c * (R + 31));
  }
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  const halo = (t, x, y, fg, al = "left") => { ctx.textAlign = al; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(25,25,23,.7)"; ctx.strokeText(t, x, y); ctx.fillStyle = fg; ctx.fillText(t, x, y); };
  ctx.font = cvf(11);
  for (const lat of [-89, -88, -87]) { const r = 2 * RM * 1000 * Math.tan(Math.PI / 4 + lat * D2R / 2) / RADm * R; halo(`${-lat}°S`, cx + 3, cy - r - 3, "#bdb9ae"); }
  ctx.font = cvf(11.5);
  for (const f of PO.j.features) {
    const [x, y] = P2(f.px), r = f.r_px * k;
    ctx.strokeStyle = "rgba(205,201,190,.45)"; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    const t = f.name.toUpperCase(), tw = ctx.measureText(t).width; let tx = x + r * 0.72 + 3; if (tx + tw > cx + R - 6) tx = x - r * 0.72 - 3 - tw;
    halo(t, tx, y - r * 0.72 - 2, "#e6e3da");
  }
  const OFFS = { ridge: [-9, 14, "right"], shackleton: [9, 16, "left"] };
  for (const s of PO.j.sites) {
    if (!OFFS[s.id]) continue;
    const [x, y] = P2(s.px), o = OFFS[s.id];
    ctx.strokeStyle = col("--sun-2"); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
    halo(SHORT[s.id].toUpperCase(), x + o[0], y + o[1], "#f0c66e", o[2]);
  }
  const sa = Math.sin(PO.az * D2R), ca = -Math.cos(PO.az * D2R);
  ctx.strokeStyle = `rgba(${SUN_P},.55)`; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(cx + sa * (R + 10), cy + ca * (R + 10)); ctx.lineTo(cx + sa * (R - 30), cy + ca * (R - 30)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = col("--sun-2"); ctx.beginPath(); ctx.arc(cx + sa * (R + 10), cy + ca * (R + 10), 4, 0, 7); ctx.fill();
  $("pole-read").textContent = `Sun over longitude ${Math.round(PO.az)}° E · ${fx(PO.el, 1)}° above the horizon${gpu ? " · relief: NASA LOLA, 195 m per pixel" : ` · ${PO.lit.toFixed(0)}% of the area in sunlight`}`;
}
function poleLoop() {
  if (!PO.on) return;
  PO.frame++;
  const idle = performance.now() - PO.lastMove > 3500;
  if (idle && !matchMedia("(prefers-reduced-motion: reduce)").matches && PO.frame % 2 === 0) PO.az = (PO.az + 0.35) % 360;
  if (PO.drawnAz !== PO.az) drawPole();
  PO.raf = requestAnimationFrame(poleLoop);
}
// stippled Sun (star B): drawn from tiny dots, like a stipple print
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function drawStar(cv, css, color, seed, dpr = Math.min(2, window.devicePixelRatio || 1)) {
  cv.width = cv.height = Math.round(css * dpr); cv.style.width = cv.style.height = css + "px";
  const ctx = cv.getContext("2d"), R = css / 2, rnd = rng(seed);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, css, css); ctx.fillStyle = color;
  const dotR = Math.max(0.32, css / 300), n = Math.round(css * css * 0.55);
  const dot = (x, y, s) => { ctx.beginPath(); ctx.arc(R + x, R + y, s, 0, 6.3); ctx.fill(); };
  const rays = Array.from({ length: 70 }, () => rnd() * Math.PI * 2);
  for (let i = 0; i < n; i++) {
    let th, r;
    if (rnd() < 0.55) { th = rays[Math.floor(rnd() * rays.length)] + (rnd() - 0.5) * 0.06; r = Math.min(1, -Math.log(rnd()) * 0.27); }
    else { th = rnd() * Math.PI * 2; r = Math.min(1, Math.sqrt(rnd()) * (0.5 + 0.5 * rnd())); }
    dot(Math.cos(th) * r * R * 0.96, Math.sin(th) * r * R * 0.96, dotR * (0.6 + rnd() * 0.8));
  }
  for (let i = 0; i < n * 0.35; i++) { const th = rnd() * Math.PI * 2, r = Math.pow(rnd(), 2.2) * 0.3; dot(Math.cos(th) * r * R, Math.sin(th) * r * R, dotR * 1.2); }
}
const STARS = {};
function starCv(px, color) { const k = px + color; if (!STARS[k]) { const cv = document.createElement("canvas"); drawStar(cv, px, color, 9); STARS[k] = cv; } return STARS[k]; }
function stars() {
  const gold = col("--sun");
  drawStar($("brand-star"), 22, gold, 5);
  if (matchMedia("(pointer: fine)").matches) {      // the star IS the browser cursor on the home page: no lag
    const url = (d) => { const cv = document.createElement("canvas"); drawStar(cv, 40, gold, 11, d); return cv.toDataURL(); };
    PO.cur = [`url("${url(1)}") 20 20, crosshair`, ""]; PO.cur[1] = `image-set(${PO.cur[0].slice(0, PO.cur[0].indexOf(")") + 1)} 1x, url("${url(2)}") 2x) 20 20, crosshair`;
    homeCursor();
  }
}
function homeCursor() {          // on the home screen the star is the cursor over the whole window
  const st = document.documentElement.style; st.cursor = "";
  if (PO.on && PO.cur) { st.cursor = PO.cur[0]; st.cursor = PO.cur[1]; }
}
function homeOn(on) {
  PO.on = on; cancelAnimationFrame(PO.raf); homeCursor();
  if (on) { PO.drawnAz = null; drawPole(); PO.raf = requestAnimationFrame(poleLoop); }
}
function homeEvents() {
  const sec = $("v-home"), fine = matchMedia("(pointer: fine)").matches;
  const aim = (cx, cy) => { const r = $("pole").getBoundingClientRect(), side = Math.min(r.width, 680); const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + side / 2); if (Math.hypot(dx, dy) > 4) PO.az = (Math.atan2(dx, -dy) * R2D + 360) % 360; };
  document.addEventListener("pointermove", (ev) => {
    if (!PO.on) return;
    PO.lastMove = performance.now();
    sec.style.setProperty("--mx", ev.clientX + "px"); sec.style.setProperty("--my", ev.clientY + "px");
    if (ev.pointerType === "mouse" || ev.pointerType === "pen" || ev.buttons) aim(ev.clientX, ev.clientY);
  });
  $("pole").addEventListener("pointerdown", (ev) => { PO.lastMove = performance.now(); aim(ev.clientX, ev.clientY); });
  if (!fine) $("pole-note").textContent = "Drag on the terrain to move the Sun. Real LOLA terrain, 200 km across, Sun 1.5° above the horizon.";
}
