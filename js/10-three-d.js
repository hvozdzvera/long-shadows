"use strict";
// Long Shadows · 3D views and the Horizon screen.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- 3D views: the whole Moon (globe) and the terrain around the pole, both lit by the real Sun of the chosen moment ----------
const THREE_URL = "vendor/three.min.js";
const T3 = { ready: false, theta: -0.45, phi: 0.98, dist: 840, EX: 3, key: "" };
const GL = { ready: false, theta: Math.PI / 2 + 0.3, phi: 2.3, dist: 440 };
let lib3d = null;
function loadThree() {
  if (!lib3d) lib3d = new Promise((ok, bad) => {
    if (window.THREE) return ok();
    const sc = document.createElement("script"); sc.src = THREE_URL; sc.onload = ok; sc.onerror = () => bad(new Error("three.js did not load")); document.head.appendChild(sc);
  });
  return lib3d;
}
const body3 = (x, y, z, r = 1) => new THREE.Vector3(x * r, z * r, -y * r);                       // Moon frame (x: lon 0, y: lon 90 E, z: north) → scene
const ll3 = (lat, lon, r) => body3(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R), r);
function sunAtPole(i) {        // direction on the polar map (clockwise from the top, lon 0) and elevation at the pole itself
  const o = i * 6, E = S.eph, L = Math.hypot(E[o + 3], E[o + 4], E[o + 5]);
  return { az: (Math.atan2(E[o + 1], E[o]) * R2D + 360) % 360, el: Math.asin(-E[o + 2]) * R2D, eaz: (Math.atan2(E[o + 4], E[o + 3]) * R2D + 360) % 360, eel: Math.asin(-E[o + 5] / L) * R2D };
}
// drag to turn, wheel or +/- to zoom, arrow keys as the keyboard alternative.
// On a touch screen a sideways swipe turns the model and an up-down swipe scrolls the page; the ▲ ▼ buttons tilt.
const TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
function wheelZoom(cv, zoom) { cv.parentElement.addEventListener("wheel", (ev) => { ev.preventDefault(); zoom(ev.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false }); }
function orbit(cv, st, draw, lim) {
  let drag = null;
  const zoom = (f) => { st.dist = Math.max(lim.dMin, Math.min(lim.dMax, st.dist * f)); draw(); };
  const clampPhi = (p) => Math.max(lim.pMin, Math.min(lim.pMax, p));
  const tilt = (d) => { st.phi = clampPhi(st.phi + d); draw(); };
  cv.addEventListener("pointerdown", (ev) => { drag = { x: ev.clientX, y: ev.clientY, t: st.theta, p: st.phi }; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
  cv.addEventListener("pointermove", (ev) => { if (!drag) return; st.theta = drag.t - (ev.clientX - drag.x) * 0.008; if (ev.pointerType !== "touch") st.phi = clampPhi(drag.p - (ev.clientY - drag.y) * 0.006); draw(); });
  const up = () => { drag = null; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  wheelZoom(cv, zoom);
  cv.addEventListener("keydown", (ev) => {
    const k = ev.key; if (!/^Arrow|^[+\-=]$/.test(k)) return; ev.preventDefault(); ev.stopPropagation();
    if (k === "ArrowLeft") st.theta += 0.1; if (k === "ArrowRight") st.theta -= 0.1;
    if (k === "ArrowUp") st.phi = clampPhi(st.phi - 0.08); if (k === "ArrowDown") st.phi = clampPhi(st.phi + 0.08);
    if (k === "+" || k === "=") return zoom(1 / 1.15); if (k === "-") return zoom(1.15);
    draw();
  });
  return { zoom, tilt };
}
// the globe turns freely in every direction: each drag adds a small rotation about the screen's own axes
function trackball(cv, st, draw, lim) {
  let drag = null;
  const zoom = (f) => { st.dist = Math.max(lim.dMin, Math.min(lim.dMax, st.dist * f)); draw(); };
  const turn = (ay, ax) => { st.grp.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(ax, ay, 0))).normalize(); draw(); };
  const k = () => 0.0075 * Math.max(0.1, Math.min(1.2, (st.dist - 100) / 340));          // slower when zoomed in, so the surface follows the pointer
  cv.addEventListener("pointerdown", (ev) => { drag = { x: ev.clientX, y: ev.clientY }; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
  cv.addEventListener("pointermove", (ev) => { if (!drag) return; const dx = ev.clientX - drag.x, dy = ev.pointerType === "touch" ? 0 : ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY; turn(dx * k(), dy * k()); });
  const up = () => { drag = null; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  wheelZoom(cv, zoom);
  cv.addEventListener("keydown", (ev) => {
    const key = ev.key; if (!/^Arrow|^[+\-=]$/.test(key)) return; ev.preventDefault(); ev.stopPropagation();
    if (key === "ArrowLeft") turn(-0.12, 0); if (key === "ArrowRight") turn(0.12, 0); if (key === "ArrowUp") turn(0, -0.12); if (key === "ArrowDown") turn(0, 0.12);
    if (key === "+" || key === "=") zoom(1 / 1.15); if (key === "-") zoom(1.15);
  });
  return { zoom, tilt: (d) => turn(0, d * 2.5) };
}
const camPos = (st) => new THREE.Vector3(st.dist * Math.sin(st.phi) * Math.sin(st.theta), st.dist * Math.cos(st.phi), st.dist * Math.sin(st.phi) * Math.cos(st.theta));
function labels(lay, pts, cam) {
  let html = ""; const W = lay.clientWidth || 600, placed = [];
  const order = pts.slice().sort((a, b) => (/sel|cap|sun|earth/.test(b.c) ? 1 : 0) - (/sel|cap|sun|earth/.test(a.c) ? 1 : 0));
  for (const p of order) {
    const q = p.v.clone().project(cam); if (q.z > 1 || p.hide) continue;
    const x = (q.x + 1) / 2 * W, y = (1 - q.y) / 2 * W, bw = p.t.length * 6.9 + 22, over = x + bw > W - 4, flip = over && x - bw - 14 >= 4, push = over && !flip ? Math.min(x - 4, x + bw + 12 - (W - 4)) : 0,      // near the right edge: turn the label to the left, or slide it back inside
      box = flip ? [x - bw, y - 10, x, y + 10] : [x - push, y - 10, x + bw - push, y + 10];
    const clash = !!p.dot || placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    if (!clash) placed.push(box);
    html += `<span class="l3 ${p.c}${clash ? " dotonly" : flip ? " flip" : ""}"${p.id ? ` data-id="${p.id}"` : ""}${p.go ? ` data-go="${p.go}"` : ""} title="${p.n || p.t}" style="${push && !clash ? `margin-left:${-push.toFixed(0)}px;` : ""}left:${(x / W * 100).toFixed(2)}%;top:${(y / W * 100).toFixed(2)}%">${clash ? "" : p.t}</span>`;
  }
  lay.innerHTML = html;
  lay.querySelectorAll("[data-id]").forEach(e => e.onclick = () => selectSite(e.dataset.id));
  lay.querySelectorAll("[data-go]").forEach(e => e.onclick = () => setView(e.dataset.go));
}
// --- the pole, 400 km across
function buildPole3D() {
  const cv = $("cv3d"), N = PO.N, G = SMALL ? 384 : 512, half = PO.j.radius_m / 1000;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 10, 6000);
  const pos = new Float32Array(G * G * 3), uv = new Float32Array(G * G * 2), idx = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const k = j * G + i, px = Math.min(N - 1, Math.round(i / (G - 1) * (N - 1))), py = Math.min(N - 1, Math.round(j / (G - 1) * (N - 1)));
    pos[k * 3] = (i / (G - 1) - 0.5) * 2 * half; pos[k * 3 + 1] = PO.z[py * N + px] / 1000 * T3.EX; pos[k * 3 + 2] = (j / (G - 1) - 0.5) * 2 * half;
    uv[k * 2] = i / (G - 1); uv[k * 2 + 1] = 1 - j / (G - 1);
  }
  const inside = (i, j) => Math.hypot(i / (G - 1) - 0.5, j / (G - 1) - 0.5) <= 0.51;
  for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) {
    if (!(inside(i, j) && inside(i + 1, j) && inside(i, j + 1) && inside(i + 1, j + 1))) continue;
    const a = j * G + i; idx.push(a, a + G, a + 1, a + 1, a + G, a + G + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  T3.tex = new THREE.CanvasTexture(PO.off); T3.tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: T3.tex, side: THREE.DoubleSide, alphaTest: 0.5 })));
  const ring = []; for (let a = 0; a <= 360; a += 2) ring.push(new THREE.Vector3(Math.sin(a * D2R) * half * 1.02, -half * half / (2 * RM) * T3.EX, -Math.cos(a * D2R) * half * 1.02));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0x1a1b1b, transparent: true, opacity: 0.45 })));
  T3.sunDot = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xd29d35 })); scene.add(T3.sunDot);
  T3.earthDot = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), new THREE.MeshBasicMaterial({ color: 0x4f86bb })); scene.add(T3.earthDot);
  Object.assign(T3, { renderer, scene, cam, half, ready: true });
  Object.assign(T3, orbit(cv, T3, drawPole3D, { pMin: 0.12, pMax: 1.5, dMin: 200, dMax: 1600 }));
}
function drawPole3D() {
  if (!T3.ready || S.view !== "3d") return;
  normTime();
  const w = $("view3d").clientWidth, s = sunAtPole(S.i), key = S.i + "";
  if (T3.w !== w) { T3.renderer.setSize(w, w, false); T3.w = w; }
  const size = SMALL || T3.playing ? 1024 : 2048, gkey = key + ":" + size;
  if (PG.ok && (T3.key !== gkey || PG.last !== "3d") && gpuShade("3d", s.az, s.el, [0, 0, 1, 1], size, 0, 0.5, T3.playing ? 60 : 350)) { T3.tex.image = PG.cv; T3.tex.needsUpdate = true; T3.key = gkey; }
  if (!PG.ok && (T3.key !== key || PO.shaded !== "full" || T3.tex.image !== PO.off)) { poleShade(s.az, s.el, false); PO.drawnAz = null; T3.tex.image = PO.off; T3.tex.needsUpdate = true; T3.key = key; }
  const { cam, half } = T3;
  cam.position.copy(camPos(T3)); cam.lookAt(0, -4, 0);
  const place = (m, az, el) => m.position.set(Math.sin(az * D2R) * half * 1.1, Math.tan(el * D2R) * half * 1.1 * T3.EX + 2, -Math.cos(az * D2R) * half * 1.1);
  place(T3.sunDot, s.az, s.el); place(T3.earthDot, s.eaz, s.eel);
  T3.renderer.render(T3.scene, cam);
  const pts = [{ t: "SUN", c: "sun", v: T3.sunDot.position }, { t: "EARTH", c: "earth", v: T3.earthDot.position }];
  for (const st of PO.j.sites) {
    const gx = st.px[0], gy = st.px[1], zz = PO.z[Math.round(gy) * PO.N + Math.round(gx)] / 1000 * T3.EX;
    pts.push({ t: (SHORT[st.id] || st.id).toUpperCase(), c: "site" + (st.id === S.site ? " sel" : ""), id: st.id, v: new THREE.Vector3((gx / PO.N - 0.5) * 2 * half, zz + 3, (gy / PO.N - 0.5) * 2 * half) });
  }
  labels($("lab3d"), pts, cam);
  $("t3-read").textContent = `${prettyDate(S.i)} · at the pole the Sun is ${Math.abs(s.el).toFixed(2)}° ${s.el >= 0 ? "above" : "below"} the horizon, Earth ${fx(s.eel, 1)}°${PG.ok ? "" : ` · ${PO.lit.toFixed(0)}% of the area in sunlight`}`;
}
// --- the whole Moon
function buildGlobe() {
  const cv = $("cvglobe");
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 1, 4000);
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const tex = new THREE.TextureLoader().load(small ? "data/moon_2k.jpg" : "data/moon_4k.jpg", () => { $("msgglobe").hidden = true; drawGlobe(); }, undefined, () => { $("msgglobe").textContent = "The Moon picture did not load."; });
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const grp = new THREE.Group(); scene.add(grp);                 // everything fixed to the Moon turns together; the camera stays put
  // Picture of the Moon times light: a little fill light plus the Sun. Within 196 km of the south pole the Sun's light is taken from the
  // LOLA terrain instead (slopes and cast shadows), fading in over the last 45 km so that there is no visible edge.
  GL.mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, cap: { value: null }, sunDir: { value: new THREE.Vector3(1, 0, 0) }, capOn: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform sampler2D cap; uniform vec3 sunDir; uniform float capOn; varying vec2 vUv; varying vec3 vP;
      void main() {
        vec3 p = normalize(vP); vec3 alb = texture2D(map, vUv).rgb;
        float direct = max(dot(p, sunDir), 0.0);
        if (capOn > 0.5 && p.y < -0.985) {
          vec2 m = 2.0 * 1737.4 * vec2(-p.z, p.x) / (1.0 - p.y);
          float w = 1.0 - smoothstep(150.0, 196.0, length(m)), c = texture2D(cap, vec2(0.5 + m.x / 400.0, 0.5 + m.y / 400.0)).r;
          direct = mix(direct, min(1.0, c * c * 2.0), w);        // light doubled here, so the relief reads at this grazing Sun
        }
        gl_FragColor = vec4(alb * (0.2 + 1.12 * direct), 1.0);
      }`
  });
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(100, 160, 100), GL.mat));
  // the cap that the Map view shows: 320 km around the south pole
  const capLat = -90 + 320 / RM * R2D, cap = []; for (let a = 0; a <= 360; a += 3) cap.push(ll3(capLat, a, 100.4));
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cap), new THREE.LineBasicMaterial({ color: 0xd29d35 })));
  const axis = [ll3(-90, 0, 100), ll3(-90, 0, 118)]; grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(axis), new THREE.LineBasicMaterial({ color: 0x1a1b1b })));
  GL.pos = {}; for (const s of S.sites) GL.pos[s.id] = ll3(s.lat, s.lon, 100.3);
  const c0 = new THREE.Vector3(Math.sin(2.3) * Math.sin(1.87), Math.cos(2.3), Math.sin(2.3) * Math.cos(1.87));     // start: near side and south pole in view
  grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(c0, new THREE.Vector3(), new THREE.Vector3(0, 1, 0))).invert();
  Object.assign(GL, { renderer, scene, cam, capLat, grp, ready: true });
  Object.assign(GL, trackball(cv, GL, drawGlobe, { dMin: 118, dMax: 700 }));
}
function drawGlobe() {
  if (!GL.ready || S.view !== "globe") return;
  normTime();
  const w = $("viewglobe").clientWidth, o = S.i * 6, E = S.eph, L = Math.hypot(E[o + 3], E[o + 4], E[o + 5]);
  if (GL.w !== w) { GL.renderer.setSize(w, w, false); GL.w = w; }
  const sun = body3(E[o], E[o + 1], E[o + 2]), earth = body3(E[o + 3] / L, E[o + 4] / L, E[o + 5] / L), cam = GL.cam;
  GL.mat.uniforms.sunDir.value.copy(sun).normalize();
  if (PG.ok) {                                   // sharp relief and real shadows around the south pole
    const sp = sunAtPole(S.i), size = SMALL || T3.playing ? 1024 : 2048, ck = S.i + ":" + size;
    if ((GL.ck !== ck || PG.last !== "cap") && gpuShade("cap", sp.az, sp.el, [0, 0, 1, 1], size, 1, 0, T3.playing ? 60 : 350)) {
      if (!GL.capTex) { GL.capTex = new THREE.CanvasTexture(PG.cv); GL.capTex.anisotropy = Math.min(8, GL.renderer.capabilities.getMaxAnisotropy()); GL.mat.uniforms.cap.value = GL.capTex; }
      GL.capTex.needsUpdate = true; GL.ck = ck;
    }
  }
  GL.mat.uniforms.capOn.value = PG.ok && GL.capTex ? 1 : 0;
  cam.position.set(0, 0, GL.dist); cam.lookAt(0, 0, 0);
  GL.renderer.render(GL.scene, cam);
  const W = (v, r = 1) => v.clone().multiplyScalar(r).applyQuaternion(GL.grp.quaternion);                        // Moon frame → what the camera sees
  const front = (v) => v.clone().normalize().dot(cam.position.clone().sub(v).normalize()) > 0.08;
  const sv = W(sun, 100.5), ev = W(earth, 100.5), near = GL.dist < 200;
  const pts = [{ t: "SUN OVERHEAD HERE", c: "site mark sun", v: sv, hide: !front(sv) }, { t: "EARTH OVERHEAD HERE", c: "site mark earth", v: ev, hide: !front(ev) }];
  let polar = 0;
  for (const s of S.sites) {
    const v = W(GL.pos[s.id]), cap = s.lat < GL.capLat; if (cap) polar++;
    pts.push({ t: (cap ? SHORT[s.id] || s.name : s.name.replace(/^.*\(|\)$/g, "")).toUpperCase(), n: s.name, c: "site" + (s.id === S.site ? " sel" : ""), id: s.id, v, hide: !front(v), dot: cap && !near });
  }
  const pv = W(ll3(-90, 0, 119)); pts.push({ t: `SOUTH POLE · ${polar} SITES · OPEN THE MAP →`, c: "site cap", go: "map", v: pv, hide: near || !front(W(ll3(-90, 0, 100))) });
  labels($("labglobe"), pts, cam);
  const lat = (v) => Math.asin(v) * R2D, lon = (y, x) => (Math.atan2(y, x) * R2D + 360) % 360, f = (la) => `${Math.abs(la).toFixed(1)}° ${la < 0 ? "S" : "N"}`;
  $("t3-read").textContent = `${prettyDate(S.i)} · Sun overhead at ${f(lat(E[o + 2]))}, ${lon(E[o + 1], E[o]).toFixed(0)}° E · Earth overhead at ${f(lat(E[o + 5] / L))}, ${lon(E[o + 4], E[o + 3]).toFixed(1)}° E (it wobbles: libration)`;
}
function drawView() {
  if (S.view === "map") return;
  const a0 = periodStart(); $("t3-range").max = periodN() - 1; $("t3-range").value = S.i - a0; syncRange($("t3-range"));
  S.view === "3d" ? drawPole3D() : drawGlobe();
}
function setView(v) {
  S.view = v; setSeg("view-seg", v); stop3D();
  $("map").hidden = v !== "map"; $("view3d").hidden = v !== "3d"; $("viewglobe").hidden = v !== "globe"; $("bar3d").hidden = v === "map";
  document.querySelectorAll(".map-only").forEach(e => { e.hidden = v !== "map"; });
  if (v === "map") { renderSites(); return; }
  const msg = $(v === "3d" ? "msg3d" : "msgglobe"), st = v === "3d" ? T3 : GL;
  if (!st.ready) { msg.textContent = "Loading the 3D view…"; msg.hidden = false; }
  loadThree().then(() => {
    if (!st.ready) { v === "3d" ? buildPole3D() : buildGlobe(); if (v === "3d") msg.hidden = true; }
    T3.key = ""; drawView();
  }).catch((e) => { console.error(e); msg.hidden = false; msg.textContent = "The 3D view could not start in this browser (it needs WebGL and a network connection). The map works without it."; });
}
function stop3D() { T3.playing = false; cancelAnimationFrame(T3.raf); $("t3-play").textContent = "▶"; $("t3-play").setAttribute("aria-label", "Play"); }
function events3D() {
  document.querySelectorAll("#view-seg button").forEach(b => b.onclick = () => setView(b.dataset.v));
  $("t3-range").oninput = (e) => { S.i = periodStart() + +e.target.value; drawView(); };
  $("t3-play").onclick = () => {
    if (T3.playing) { stop3D(); return drawView(); }
    T3.playing = true; $("t3-play").textContent = "❚❚"; $("t3-play").setAttribute("aria-label", "Pause");
    const a0 = periodStart(); let k = S.i - a0, f = 0;
    const tick = () => { if (!T3.playing) return; if (f++ % 2 === 0) { k += Math.max(1, Math.round(periodN() / 350)); if (k >= periodN()) k = 0; S.i = a0 + k; drawView(); } T3.raf = requestAnimationFrame(tick); };
    T3.raf = requestAnimationFrame(tick);
  };
  for (const [id, st] of [["z3", T3], ["zg", GL]]) {
    $(id + "-in").onclick = () => st.zoom && st.zoom(1 / 1.2); $(id + "-out").onclick = () => st.zoom && st.zoom(1.2);
    $(id + "-up").onclick = () => st.tilt && st.tilt(-0.1); $(id + "-dn").onclick = () => st.tilt && st.tilt(0.1);
  }
  if (TOUCH) { $("hint-globe").textContent = "Whole Moon · swipe sideways to turn · ▲ ▼ tilt · + − zoom"; $("hint-3d").textContent = "400 km across · heights ×3 · swipe sideways to turn · ▲ ▼ tilt"; }
}
// time sliders: filled part and tick marks follow the value and the period
function syncRange(el) {
  const max = +el.max || 1; el.style.setProperty("--p", (100 * +el.value / max).toFixed(2) + "%");
  el.style.setProperty("--d", S.period === "day" ? 29.5 : S.period === "q" ? 13 : 12);
}

// click on the map: put a custom point there
function mapPick(ev) {
  if (ev.target.closest(".mk,.mlab")) return;
  const r = $("map").getBoundingClientRect(), RAD = 320000, Rm = RM * 1000;
  const x = ((ev.clientX - r.left) / r.width * 2 - 1) * RAD, y = (1 - (ev.clientY - r.top) / r.height * 2) * RAD, rho = Math.hypot(x, y);
  const lat = (2 * Math.atan(rho / (2 * Rm)) - Math.PI / 2) * R2D, lon = (Math.atan2(x, y) * R2D + 360) % 360;
  $("c-lat").value = lat.toFixed(3); $("c-lon").value = lon.toFixed(3);
  S.customOn = true; S.site = "custom"; renderSites();
  const row = $("site-list").querySelector('[data-id="custom"]'); row && row.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function selectSite(id) { S.site = id; renderSites(); saveLink(); }
function setLayer(v) {
  S.layer = v; setSeg("layer-seg", v);
  $("lay-sun").style.opacity = v === "sun" ? 1 : 0; $("lay-earth").style.opacity = v === "earth" ? 1 : 0;
  $("ramp").style.visibility = v === "none" ? "hidden" : "visible"; $("ramp").style.setProperty("--c", v === "earth" ? "#5082ba" : "#d29b37");
  $("ramp-note").textContent = v === "none" ? "Shaded relief from the LOLA elevation model." : `Share of time with ${v === "earth" ? "Earth" : "the Sun"} in view. NASA LOLA average maps, 18.6-year mean.`;
}
const shiftNote = () => S.t0 + periodN() > S.n ? `The data run to 31 Dec 2028, so this period is shown from ${prettyDate(periodStart()).slice(0, 11)} to 31 Dec 2028 instead of starting at the chosen date.` : "";

function renderSite() {
  const sel = $("site-select");
  if (!sel.options.length) {
    for (const s of S.sites) sel.add(new Option(s.name, s.id));
    sel.add(new Option("Custom point…", "custom"));
  }
  normTime();
  sel.value = S.site; $("custom-box").hidden = S.site !== "custom"; 
  setSeg("h-seg", S.H); setSeg("p-seg", S.period);
  const c = series(S.site, S.H), n = periodN(), i0 = periodStart(), iNow = Math.max(i0, Math.min(S.i, i0 + n - 1));
  const s = c.site;
  $("site-meta").textContent = `${Math.abs(s.lat).toFixed(3)}° ${s.lat < 0 ? "S" : "N"}, ${s.lon.toFixed(3)}° E${s.h0 != null && (s.id !== "custom" || s.terrain) ? ` · ground ${fx(s.h0)} m (rel. 1737.4 km)` : ""}`;
  if (s.id === "custom") { $("custom-note").textContent = customNote(s); $("custom-note").style.color = s.terrain === "240 m" ? "var(--ink-2)" : ""; }
  setDT($("dt"), S.i);
  $("range").max = n - 1; $("range").value = iNow - i0; syncRange($("range"));
  $("range-label").textContent = `Moment within the period · ${PERIODS[S.period].label}`;
  $("win-label").textContent = `Period: ${prettyDate(i0).slice(0, 11)} → ${prettyDate(Math.min(S.n - 1, i0 + n - 1)).slice(0, 11)}`; $("anchor").disabled = S.i === S.t0;
  const note = shiftNote(); $("site-note").hidden = !note; $("site-note").textContent = note;
  const r = drawPano($("pano"), c, i0, n, iNow);
  $("pano-l").textContent = `${s.name} · ${s.id === "custom" ? (s.terrain ? "horizon from LOLA terrain at " + s.terrain + " per pixel" : "smooth Moon, no terrain") : s.lat > -60 ? "smooth horizon, far from the pole" : "horizon from LOLA terrain"} · observer ${S.H} m up`;
  $("pano-r").textContent = (S.expert ? `vertical scale ×${r.exag.toFixed(1)} · ` : "") + `N = north${s.lat < -60 ? ", the direction away from the pole" : ""}` + (S.expert ? "; 0° = horizon of a smooth Moon" : "");
  drawStrip($("strip"), c, i0, n, iNow); drawCal(c, iNow);
  const ns = nextChange(c.sf, iNow, 0.5), ne = nextChangeE(c, iNow);
  $("cd-sun-l").textContent = ns.now ? "Sunset in" : "Sunrise in";
  $("cd-sun").textContent = ns.hours === null ? "after 2028" : fmtDur(ns.hours);
  $("cd-sun-s").textContent = ns.now ? "panels have power until then" : "running on batteries until then";
  $("cd-earth-l").textContent = ne.now ? "Earthset in" : "Earthrise in";
  $("cd-earth").textContent = ne.hours === null ? (ne.now ? "never before 2029" : "after 2028") : fmtDur(ne.hours);
  $("cd-earth-s").textContent = ne.now ? "direct radio link until then" : "needs a relay satellite until then";
  const st = stats(c, i0, n), hzS = hzAt(c.hz, c.saz[iNow]);
  const tiles = [
    ["Sun elevation now", `${fx(c.sel[iNow], 2)}°`, s.id === "custom" && !s.terrain ? `${c.sf[iNow] >= 0.5 ? "above" : "below"} the horizon (${fx(hzS, 1)}°)` : c.sf[iNow] >= 0.5 ? `in view; the skyline there is at ${fx(hzS, 1)}°` : `hidden; the skyline there is at ${fx(hzS, 1)}°`],
    ["Sunlight", fmtPct(st.sun), "share of the period"],
    ["Longest night", fmtDays(st.maxDark), "in this period"],
    ["Earth in view", fmtPct(st.earth), `longest gap ${fmtDays(st.maxNoE)}`],
    ["Power + link", fmtPct(st.both), "Sun and Earth both up"]
  ];
  { // energy in plain units: what the hardware at this height would give, and the battery for the longest night
    const g = RIG[S.H], avg = g.kw * st.sun / 100, keep = g.kw * 0.1, kwh = keep * st.maxDark;
    $("energy").innerHTML = `<b>Energy.</b> ${g.name} gives about ${g.kw} kW in full Sun, so about <b>${avg.toFixed(1)} kW on average</b> over this period. ` + (st.maxDark
      ? `To keep a tenth of that (${keep.toFixed(2).replace(/0$/, "")} kW) running through the longest night of ${fmtDays(st.maxDark)}, it needs a battery of about <b>${fmtKWh(kwh)}</b> — roughly ${fmtKg(kwh / 0.2)} of cells.`
      : `There is no night in this period, so no battery is needed to bridge one.`);
  }
  $("tiles").classList.toggle("t3", !S.expert); $("energy").hidden = !S.expert;      // Standard: the three figures that matter most; Advanced: all five and the energy estimate
  $("tiles").innerHTML = (S.expert ? tiles : tiles.slice(1, 4)).map(t => `<div class="tile"><span class="label">${t[0]}</span><span class="v">${t[1]}</span><span class="s">${t[2]}</span></div>`).join("");
  renderWhy(c, st, i0, n, iNow); renderReplay(c); renderVerdict(c, iNow);
}
function handSize(a) {
  if (a < 0.8) return "less than the width of a finger held at arm's length";
  if (a < 2.5) return "about the width of a finger held at arm's length";
  if (a < 7) return "about three fingers held at arm's length";
  return "about a fist held at arm's length";
}
function renderWhy(c, st, i0, n, iNow) {
  const s = c.site, p = [], custom = s.id === "custom" && !s.terrain, polar = s.lat < -60;
  const smooth = `This point is calculated on a <b>smooth Moon without hills</b>, so these are best-case numbers: real terrain can only hide more of the Sun and Earth.`;
  if (!polar) {
    p.push(`${Math.abs(s.lat) < 20 ? "Near the equator" : "At this latitude"} the Sun climbs to <b>${fx(st.selMax, 0)}°</b> in this period. Every spot gets roughly half of the time in sunlight: about two weeks of day, then two weeks of night.`);
    if (st.eelMin > 0) p.push(`Earth hangs about <b>${((st.eelMax + st.eelMin) / 2).toFixed(0)}°</b> up and never sets. Compare this with any site at the pole.`);
    else if (st.earth === 0) p.push(`This is the far side of the Moon: Earth never rises here. Every message home has to go through a relay satellite.`);
    else p.push(`Earth is in view <b>${fmtPct(st.earth)}</b> of this period.`);
    if (custom) p.push(smooth);
  } else {
    const maxHz = Math.max(...c.hz), minHz = Math.min(...c.hz), az = c.hz.indexOf(maxHz) * 0.5;
    if (custom) p.push(smooth);
    if (!custom && st.sun < 0.5) p.push(`This spot gets <b>no direct sunlight</b> in this period: the terrain around it stands higher than the Sun ever climbs. Dark, cold places like this are where water ice may survive, and why missions want to land nearby.`);
    if (st.selMax > 0.4) {
      p.push(`Here the Sun never climbs higher than <b>${fx(st.selMax, 1)}°</b> in this period — ${handSize(st.selMax)}.`);
      p.push(`Even at that highest point, a <b>10 m</b> mast casts a shadow about <b>${Math.round(10 / Math.tan(st.selMax * D2R))} m</b> long. When the Sun is at 1°, the shadow is <b>${Math.round(10 / Math.tan(D2R))} m</b>.`);
    } else {
      p.push(`In this period the Sun stays at or even below <b>0°</b> — the horizon of a perfectly smooth Moon (highest: <b>${fx(st.selMax, 1)}°</b>).`);
      if (!custom) p.push(`The site still gets light because it stands ${s.h0 ? `<b>${s.h0} m</b> high` : "high"} and looks over the curve of the Moon: in some directions the horizon drops to <b>${fx(minHz, 1)}°</b>. A 10 m mast in a 1° Sun casts a <b>${Math.round(10 / Math.tan(D2R))} m</b> shadow.`);
      else p.push(`From ${S.H} m up you see a little over the curve of the Moon: the horizon is at <b>${fx(minHz, 1)}°</b>, so the Sun can still show.`);
    }
    if (!custom) {
      if (maxHz > 0) p.push(`The terrain around the site rises up to <b>${fx(maxHz, 1)}°</b> (toward ${Math.round(az)}°). Hills that low are enough to hide a Sun that crawls along the horizon.`);
      else p.push(`Even the highest part of the horizon is below 0° (<b>${fx(maxHz, 1)}°</b>): from here you look down on everything around. That is why ridges and crater rims are the best-lit places.`);
    }
    p.push(`The Sun circles the whole horizon once per lunar day (29.5 Earth days), so each direction gets its turn of light and shadow.`);
    p.push(`Earth stays in almost the same part of the sky and wobbles between <b>${fx(st.eelMin, 1)}°</b> and <b>${fx(st.eelMax, 1)}°</b> (libration). It is in view <b>${fmtPct(st.earth)}</b> of this period.`);
    if (!custom) {
      const a = stats(series(s.id, "2"), i0, n), b = stats(series(s.id, "20"), i0, n);
      if (b.sun < 0.5) { /* nothing to add: no sunlight at any height */ }
      else if (fmtPct(a.sun) === fmtPct(b.sun) && a.maxDark !== b.maxDark) p.push(`Height changes little here: sunlight stays near <b>${fmtPct(b.sun)}</b> at 2 m and at 20 m, but the longest night goes from <b>${fmtDays(a.maxDark)}</b> to <b>${fmtDays(b.maxDark)}</b>.`);
      else if (fmtPct(a.sun) === fmtPct(b.sun)) p.push(`In this period the height of the panels makes no difference here: the site is lit <b>${fmtPct(b.sun)}</b> of the time even at 2 m. Try another date or the 1-year period.`);
      else p.push(`Height matters: raising panels from <b>2 m</b> to <b>20 m</b> changes sunlight here from <b>${fmtPct(a.sun)}</b> to <b>${fmtPct(b.sun)}</b>, and the longest night from <b>${fmtDays(a.maxDark)}</b> to <b>${fmtDays(b.maxDark)}</b>.`);
    }
  }
  $("why").innerHTML = p.map(t => `<p>${t}</p>`).join("") + `<p style="color:var(--muted);font-size:12.5px">For scale: on Earth, the Sun at noon in New York in June is about 73° high. Here the highest it gets in this period is ${fx(st.selMax, 1)}°.</p>`;
}

// Compare: three sites on one landing date, or one site on three landing dates
const whenText = (now, hours, up, down) => `${now ? up : down}${hours === null ? "after 2028" : "in " + fmtDur(hours)}`;
function renderCompare() {
  normTime();
  const dates = S.cmpMode === "dates";
  setSeg("h-seg-2", S.H); setSeg("p-seg-2", S.period); setSeg("mode-seg", S.cmpMode);
  $("cmp-date-field").hidden = dates; $("cmp-site-field").hidden = !dates;
  setDT($("cmp-dt"), S.t0);
  const selc = $("cmp-site");
  if (!selc.options.length) for (const s of S.sites) selc.add(new Option(s.name, s.id));
  if (S.site === "custom" && dates) S.site = "ridge";
  selc.value = S.site;
  if (!S.cmpDates) S.cmpDates = [S.t0, S.t0 + 7 * 24, S.t0 + 709].map(t => Math.min(S.n - 1, t));
  const n = periodN(), wrap = $("cmp"); wrap.innerHTML = "";
  const cols = dates ? S.cmpDates.map((t, k) => ({ id: S.site, t, k })) : S.compare.map(id => ({ id, t: Math.min(S.t0, S.n - 1) }));
  const cut = cols.some(c => c.t + n > S.n);
  $("cmp-note").hidden = !cut; $("cmp-note").textContent = cut ? "The data run to 31 Dec 2028. Where a period would go past that, it is shown as the last " + PERIODS[S.period].label + " of 2028 instead." : "";
  $("cmp-foot").hidden = !cols.length; $("cmp-sum").hidden = true;
  if (!cols.length) xaRender();
  if (!cols.length) { wrap.innerHTML = `<p class="label" style="padding-top:14px;text-transform:none;letter-spacing:.02em">Nothing to compare yet. Tick “Compare” on up to three sites on the Map screen, or switch to “1 site, 3 dates”.</p>`; return; }
  const rows = [
    ["Sunlight", (st) => st.sun, (v) => fmtPct(v), "max"],
    ["Longest night", (st) => st.maxDark, (v) => fmtDays(v), "min"],
    ["Earth in view", (st) => st.earth, (v) => fmtPct(v), "max"],
    ["Longest link gap", (st) => st.maxNoE, (v) => fmtDays(v), "min", "x"],
    ["Power + link", (st) => st.both, (v) => fmtPct(v), "max"],
    ["Highest Sun elevation", (st) => st.selMax, (v) => fx(v, 1) + "°", "max", "x"],
    ["Ground slope, typical", (st, c) => c.site.slope ? c.site.slope.typ : null, (v) => v == null ? "no data" : v.toFixed(1) + "°", "min"],
    ["Nearest permanent shadow", (st, c) => c.site.psr ? c.site.psr.km : null, (v) => v == null ? "no data" : v.toFixed(1) + " km", "none", "x"]
  ].filter(r => S.expert || !r[4]);                                       // rows marked "x" are shown in Advanced only
  if (S.expert && XD.state === "ready") {                                 // Expert: two more rows from the Diviner maps
    const dv = (c) => XD.d.diviner.sites[c.site.id] || (c.site.id === "custom" ? divAt(c.site.lat, c.site.lon) : null) || null;
    rows.push(['Slope within 100 m, 5 m map <span class="x-tag">Advanced</span>', (st, c) => XD.d.slope5m && XD.d.slope5m.sites[c.site.id] ? XD.d.slope5m.sites[c.site.id].r100.typ : null, (v) => v == null ? "no 5 m map" : v.toFixed(1) + "°", "none"],
      ['Mean temperature <span class="x-tag">Advanced</span>', (st, c) => dv(c) ? dv(c).tmean : null, (v) => v == null ? "no data" : `${fx(v - 273.15)} °C`, "none"],
      ['Buried ice could last <span class="x-tag">Advanced</span>', (st, c) => dv(c) ? (dv(c).ice == null ? -1 : dv(c).ice) : null, (v) => v == null ? "no data" : v < 0 ? "not stable" : v < 0.005 ? "at the surface" : `below ${Math.round(v * 100)} cm`, "none"]);
  }
  const data = cols.map(col => { const c = series(col.id, S.H), i0 = winStart(col.t); return Object.assign({ c, i0, st: stats(c, i0, n) }, col); });
  const best = rows.map(r => { const vals = data.map(d => r[1](d.st, d.c)).filter(v => v != null); if (!vals.length || r[3] === "none" || (dates && r[0].startsWith("Ground"))) return NaN; return r[3] === "max" ? Math.max(...vals) : Math.min(...vals); });
  if (!S.expert && data.length > 1) {                                    // Standard: say in one line which column wins, and on what
    const nm = (d) => `<b>${dates ? fmtDT(d.t) : d.c.site.name}</b>`, on = dates ? "landing on " : "";
    const lead = (f) => { const m = Math.max(...data.map(f)), w = data.filter(d => m - f(d) < 0.5); return { m, w, all: w.length === data.length, names: w.map(nm).join(" and ") }; };     // columns within half a point of the best count as equal
    const p = lead(d => d.st.sun), l = lead(d => d.st.earth), night = (d) => d.st.maxDark ? `longest night ${fmtDays(d.st.maxDark)}` : "no night";
    let t;
    if (p.all && l.all) t = dates ? "These dates give the same sunlight and the same time with Earth in view, so a slip between them costs nothing here." : "These sites are equal in sunlight and in time with Earth in view over this period.";
    else t = (p.all ? `Sunlight is the same in every column (${fmtPct(p.m)}).` : p.w.length > 1 ? `For power, ${on}${p.names} are equally good: ${fmtPct(p.m)} sunlight.` : `For power, ${on}${p.names} is best: ${fmtPct(p.m)} sunlight, ${night(p.w[0])}.`) + " "
      + (l.all ? `Earth is in view equally often (${fmtPct(l.m)}).` : l.w.length > 1 ? `For a direct link to Earth, ${on}${l.names} are equally good: Earth in view ${fmtPct(l.m)} of the time.` : `For a direct link to Earth, ${on}${l.names} is best: Earth in view ${fmtPct(l.m)} of the time.`);
    $("cmp-sum").innerHTML = `<b>Bottom line.</b> ${t}`; $("cmp-sum").hidden = false;
  }
  for (const d of data) {
    const ns = nextChange(d.c.sf, d.t, 0.5), ne = nextChangeE(d.c, d.t);
    const el = document.createElement("div"); el.className = "ccard";
    const head = dates
      ? `<label class="field"><span class="label">Landing ${"ABC"[d.k]} (UTC)</span><button type="button" class="dtp" data-date="${d.k}" aria-haspopup="dialog">${fmtDT(d.t)}</button></label><h2>${d.c.site.name}</h2>`
      : `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h2>${d.c.site.name}</h2><button class="btn small" data-rm="${d.id}" aria-label="Remove ${d.c.site.name} from the comparison">×</button></div>
      <span class="tag" style="justify-self:start">${d.c.site.group}</span>`;
    el.innerHTML = `${head}
      <div class="night"><canvas aria-hidden="true"></canvas></div>
      <div class="landing">At landing, ${prettyDate(d.t).slice(0, 17)}: <span style="color:var(--sun-t)">${whenText(ns.now, ns.hours, "Sun up, sets ", "dark, sunrise ")}</span> · <span style="color:var(--earth)">${whenText(ne.now, ne.hours, "Earth up, sets ", "no Earth, rises ")}</span></div>
      <table>${rows.map((r, k) => { const v = r[1](d.st, d.c); return `<tr><td>${r[0]}</td><td class="${v === best[k] && data.length > 1 ? "best" : ""}">${r[2](v)}</td></tr>`; }).join("")}</table>
      <canvas data-h="52" role="img" aria-label="Hours with the Sun and with Earth in view over the period"></canvas>`;
    wrap.appendChild(el);
    const cvs = el.querySelectorAll("canvas");
    drawPano(cvs[0], d.c, d.i0, n, d.t, { small: true }); drawStrip(cvs[1], d.c, d.i0, n, d.t);
  }
  xaRender();
  wrap.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { S.compare = S.compare.filter(x => x !== b.dataset.rm); renderCompare(); });
  wrap.querySelectorAll("[data-date]").forEach(b => b.onclick = () => { const k = +b.dataset.date; openDT(b, S.cmpDates[k], (i) => { S.cmpDates[k] = i; renderCompare(); }); });
}
