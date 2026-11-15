"use strict";
// Long Shadows · pole terrain lit by a low Sun (home picture and the 3D view share it).
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- pole terrain lit by a low Sun (home hero and the 3D view share this) ----------
const PO = { az: 135, el: 1.5, drawnAz: null, lastMove: -1e9, raf: 0, on: false, lit: 0, frame: 0 };
function poleInit(j, h) {
  const N = j.N, pm = j.px_m, Rm = RM * 1000, c = N / 2 - 0.5;
  const z = new Float32Array(N * N), A = new Float32Array(N * N), B = new Float32Array(N * N), C = new Float32Array(N * N), amb = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x - c) * pm, dy = (y - c) * pm, k = y * N + x;
    z[k] = h[k] - (dx * dx + dy * dy) / (2 * Rm);            // tangent-plane heights: includes the curve of the Moon
  }
  const s35 = Math.sin(35 * D2R), c35 = Math.cos(35 * D2R), s315 = Math.sin(315 * D2R), c315 = Math.cos(315 * D2R);
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const k = y * N + x, gx = (z[k + 1] - z[k - 1]) / (2 * pm), gr = (z[k + N] - z[k - N]) / (2 * pm), nr = Math.hypot(gx, gr, 1);
    A[k] = -gx / nr; B[k] = gr / nr; C[k] = 1 / nr;
    amb[k] = clamp01((A[k] * s315 + B[k] * c315) * c35 + C[k] * s35);
  }
  const off = document.createElement("canvas"); off.width = off.height = N;
  const octx = off.getContext("2d");
  Object.assign(PO, { j, N, pm, z, A, B, C, amb, off, octx, img: octx.createImageData(N, N), M: new Float32Array(N * N), Dq: new Float32Array(N * N), F: new Float32Array(N * N) });
}
// One sweep from the Sun side. M = height of the shadow surface over each pixel, Dq = distance to the terrain that casts it.
// The Sun is a disc 0.53° wide, so the edge of a shadow is soft: F = share of the disc that a pixel sees (0…1).
function poleShade(azDeg, elDeg = PO.el, inner = false) {
  const { N, pm, z, A, B, C, amb, M, Dq, F, img } = PO, d = img.data;
  const lo = inner ? N / 4 : 0, hi = inner ? 3 * N / 4 : N, c = N / 2 - 0.5, rad = (hi - lo) / 2 - 0.5;
  const az = azDeg * D2R, e = elDeg * D2R, sa = Math.sin(az), ca = Math.cos(az), ce = Math.cos(e), se = Math.sin(e);
  const ux = sa, uy = -ca, tpx = Math.tan(e) * pm, tr = Math.tan(RSUN * D2R);
  const put = (k, sh, dsh) => {
    const m = z[k] - sh;
    F[k] = sh < -1e8 ? 1 : clamp01(0.5 + m / (2 * Math.max(dsh * tr, 1.5)));
    if (m > 0) { M[k] = z[k]; Dq[k] = 0; } else { M[k] = sh; Dq[k] = dsh; }
  };
  if (Math.abs(ux) >= Math.abs(uy)) {
    const sx = ux > 0 ? 1 : -1, dy = uy / Math.abs(ux), drop = tpx / Math.abs(ux), step = pm * Math.hypot(1, dy);
    for (let x = sx > 0 ? hi - 1 : lo; x >= lo && x < hi; x -= sx) {
      const xp = x + sx, inX = xp >= lo && xp < hi;
      for (let y = lo; y < hi; y++) {
        let sh = -1e9, dsh = 0;
        if (inX) { const yp = y + dy; if (yp >= lo && yp <= hi - 1) { const y0 = Math.floor(yp), f = yp - y0, y1 = y0 < hi - 1 ? y0 + 1 : y0, a = y0 * N + xp, b = y1 * N + xp; sh = M[a] * (1 - f) + M[b] * f - drop; dsh = Dq[a] * (1 - f) + Dq[b] * f + step; } }
        put(y * N + x, sh, dsh);
      }
    }
  } else {
    const sy = uy > 0 ? 1 : -1, dx = ux / Math.abs(uy), drop = tpx / Math.abs(uy), step = pm * Math.hypot(1, dx);
    for (let y = sy > 0 ? hi - 1 : lo; y >= lo && y < hi; y -= sy) {
      const yp = y + sy, inY = yp >= lo && yp < hi;
      for (let x = lo; x < hi; x++) {
        let sh = -1e9, dsh = 0;
        if (inY) { const xq = x + dx; if (xq >= lo && xq <= hi - 1) { const x0 = Math.floor(xq), f = xq - x0, x1 = x0 < hi - 1 ? x0 + 1 : x0, a = yp * N + x0, b = yp * N + x1; sh = M[a] * (1 - f) + M[b] * f - drop; dsh = Dq[a] * (1 - f) + Dq[b] * f + step; } }
        put(y * N + x, sh, dsh);
      }
    }
  }
  let lit = 0, tot = 0;
  for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) {
    const k = y * N + x, p = k * 4;
    if (Math.hypot(x - c, y - c) > rad) { d[p + 3] = 0; continue; }
    tot++;
    const dd = ce * (A[k] * sa + B[k] * ca) + C[k] * se, f = F[k] * clamp01(dd * 30), v = clamp01(dd * 3.4 + 0.06), a = amb[k];
    lit += f;
    d[p] = (176 + 72 * v) * f + (33 + 30 * a) * (1 - f); d[p + 1] = (177 + 72 * v) * f + (32 + 29 * a) * (1 - f); d[p + 2] = (174 + 73 * v) * f + (29 + 27 * a) * (1 - f);
    d[p + 3] = 255;
  }
  PO.octx.putImageData(img, 0, 0, inner ? lo : 0, inner ? lo : 0, hi - lo, hi - lo);
  PO.lit = 100 * lit / tot; PO.shaded = inner ? "inner" : "full";
}
