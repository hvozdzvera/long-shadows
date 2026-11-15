"use strict";
// Long Shadows · canvas helpers: the horizon panorama and the light strips.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- canvas helpers ----------
function fitCanvas(cv, cssH) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || cv.parentElement.clientWidth, h = cssH;
  cv.style.height = h + "px";
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
const CSS = getComputedStyle(document.documentElement);
const col = (n) => CSS.getPropertyValue(n).trim();
const cvf = (px) => `${(px * 0.9).toFixed(1)}px ${col("--f-body")}`;           // labels drawn on canvas: plain B612, so that "1.6°" stays tight
const SUN_N = "227,182,92", EARTH_N = "134,182,224", SUN_P = "162,116,29", EARTH_P = "52,101,148";

// sky panorama, "soft graphite": dark grey paper, terrain as layered ridges, paths as lines
// (solid where the body is above the terrain, dotted where the terrain hides it)
function drawPano(cv, c, i0, n, iNow, opt = {}) {
  const small = !!opt.small;
  const { ctx, w, h } = fitCanvas(cv, small ? 130 : Math.max(220, Math.min(320, cv.clientWidth / 3.4)));
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#3d3c38"); bg.addColorStop(1, "#2f2e2b"); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const padL = small ? 4 : 36, padR = small ? 4 : 8, padB = small ? 18 : 24, padT = 6, W = w - padL - padR, Hh = h - padB - padT;
  const st = stats(c, i0, n);
  const hzMax = Math.max(...c.hz), hzMin = Math.min(...c.hz);
  let lo = Math.min(-2, hzMin - 0.8), hi = Math.max(6, hzMax + 1, st.selMax + 1.2, (S.showEarth || small) ? st.eelMax + 1.6 : 0);
  if (S.showEarth || small) lo = Math.min(lo, st.eelMin - 1);
  if (hi > 30) { lo = Math.min(lo, -5, hzMin - 2); }
  const X = (az) => padL + (az / 360) * W, Y = (el) => padT + (hi - el) / (hi - lo) * Hh;
  ctx.font = cvf(small ? 11.5 : 13); ctx.fillStyle = "#a3a097"; ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.setLineDash([1, 4]);
  const span = hi - lo, stepEl = span > 40 ? 15 : span > 16 ? 4 : 2;
  for (let e = Math.ceil(lo / stepEl) * stepEl; e <= hi; e += stepEl) {
    const y = Math.round(Y(e)) + .5; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    if (!small) { ctx.textAlign = "right"; ctx.fillText(fx(e) + "°", padL - 6, y + 4); }
  }
  ctx.setLineDash([]); ctx.textAlign = "center"; ctx.strokeStyle = "#a3a097";
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"].forEach((t, k) => {
    const x = Math.round(X(k * 45)) + .5; ctx.beginPath(); ctx.moveTo(x, padT + Hh); ctx.lineTo(x, padT + Hh + 4); ctx.stroke();
    if (!small || k % 2 === 0) ctx.fillText(t, Math.min(Math.max(x, padL + 8), padL + W - 8), h - (small ? 3 : 5));
  });
  ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, W, Hh); ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,.32)"; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(padL + W, Y(0)); ctx.stroke(); ctx.setLineDash([]);
  const step = n > 3000 ? 2 : 1;
  const path = (az, el, vis, rgb, lw) => {
    for (const want of [false, true]) {
      ctx.strokeStyle = `rgba(${rgb},${want ? .95 : .5})`; ctx.lineWidth = want ? lw : 1; ctx.setLineDash(want ? [] : [1.5, 3]);
      ctx.beginPath(); let pen = false, prev = 0;
      for (let i = i0; i < i0 + n && i < S.n; i += step) {
        const ok = vis(i) === want, x = X(az[i]), y = Y(el[i]);
        if (ok && pen && Math.abs(az[i] - prev) < 180) ctx.lineTo(x, y); else if (ok) ctx.moveTo(x, y);
        pen = ok; prev = az[i];
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  if (S.showSun || small) path(c.saz, c.sel, (i) => c.sf[i] >= 0.5, SUN_N, small ? 1.2 : 1.5);
  if (S.showEarth || small) path(c.eaz, c.eel, (i) => !!c.ev[i], EARTH_N, small ? 1.2 : 1.5);
  // terrain: graphite fill, layered ridge lines, light outline
  const shape = () => { ctx.beginPath(); ctx.moveTo(padL, padT + Hh); for (let k = 0; k <= NB; k++) ctx.lineTo(X(k * 0.5), Y(c.hz[k % NB])); ctx.lineTo(padL + W, padT + Hh); ctx.closePath(); };
  const ridge = (off) => { ctx.beginPath(); for (let k = 0; k <= NB; k++) { const x = X(k * 0.5), y = Y(c.hz[k % NB]) + off; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
  shape(); ctx.fillStyle = "#262522"; ctx.fill();
  ctx.save(); shape(); ctx.clip(); ctx.lineWidth = 1;
  for (let k = 1; k < 9; k++) { ctx.strokeStyle = `rgba(216,213,204,${.48 - k * .05})`; ridge(k * (small ? 4 : 7)); }
  ctx.restore();
  ctx.strokeStyle = "#d8d5cc"; ctx.lineWidth = 1.2; ridge(0);
  ctx.restore();
  if (iNow !== null) {
    const ex = X(c.eaz[iNow]), ey = Y(c.eel[iNow]), sx = X(c.saz[iNow]), sy = Y(c.sel[iNow]), sunOn = c.sel[iNow] > lo - 0.5;
    ctx.globalAlpha = c.ev[iNow] ? 1 : 0.4; ctx.strokeStyle = `rgb(${EARTH_N})`; ctx.fillStyle = `rgb(${EARTH_N})`; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(ex, ey, small ? 4.5 : 6.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(ex, ey, 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (sunOn) { const px = small ? 24 : 34; ctx.globalAlpha = c.sf[iNow] >= 0.5 ? 1 : 0.4; ctx.drawImage(starCv(px, `rgb(${SUN_N})`), sx - px / 2, sy - px / 2, px, px); ctx.globalAlpha = 1; }
    if (!small) {
      ctx.font = cvf(13.5); ctx.textAlign = "left";
      const lab = (t, x, y, rgb, gap) => { const tw = ctx.measureText(t).width; if (x + gap + tw > padL + W - 2) x -= gap * 2 + tw; else x += gap; ctx.fillStyle = `rgb(${rgb})`; ctx.fillText(t, Math.max(x, padL + 2), Math.min(Math.max(y, padT + 12), padT + Hh - 3)); };
      lab(`EARTH ${fx(c.eel[iNow], 1)}°`, ex, ey + 4, EARTH_N, 11);
      if (sunOn) lab(`SUN ${fx(c.sel[iNow], 1)}°`, sx, sy - 10, SUN_N, 16);
    }
  }
  if (!small && !S.expert) {
    const wide = W > 560; ctx.font = cvf(wide ? 12 : 11);
    const note = (t, x, y, rgb, align) => {
      const tw = ctx.measureText(t).width, x0 = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x, xx = Math.max(padL + 4, Math.min(padL + W - tw - 4, x0)), yy = Math.max(padT + 14, Math.min(padT + Hh - 5, y));
      ctx.fillStyle = "rgba(38,37,34,.84)"; ctx.fillRect(xx - 4, yy - 12, tw + 8, 17); ctx.fillStyle = rgb; ctx.textAlign = "left"; ctx.fillText(t, xx, yy);
    };
    let kz = 0; for (let k = 0; k < NB; k++) if (c.hz[k] > c.hz[kz]) kz = k;                    // the skyline: a tick under its highest peak
    const zx = X(kz * 0.5), zy = Y(c.hz[kz]);
    ctx.strokeStyle = "rgba(216,213,204,.75)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(zx) + .5, zy + 4); ctx.lineTo(Math.round(zx) + .5, zy + 20); ctx.stroke();
    note(wide ? "the real skyline, measured by NASA’s laser altimeter" : "the real skyline", zx, zy + 34, "#d8d5cc", "center");
    if (S.showSun && iNow !== null) {                                                            // the Sun's path: on the side of the sky opposite to the Sun itself
      const want = Math.max(40, Math.min(320, (c.saz[iNow] + 180) % 360)); let bi = -1, bd = 1e9;
      for (let i = i0; i < i0 + n && i < S.n; i += 3) { const d = Math.abs(((c.saz[i] - want + 540) % 360) - 180); if (d < bd && c.sel[i] > lo + 0.3) { bd = d; bi = i; } }
      if (bi >= 0 && bd < 30) note(wide ? "the Sun’s path during this period" : "the Sun’s path", X(c.saz[bi]), Y(c.sel[bi]) - 9, `rgb(${SUN_N})`, "center");
    }
    if (S.showEarth && iNow !== null) note(wide ? "Earth: it only sways around this spot" : "Earth’s small loop", X(c.eaz[iNow]) - 12, Y(st.eelMax) - 8, `rgb(${EARTH_N})`, "right");
  }
  return { exag: (Hh / (hi - lo)) / (W / 360) };
}
// timeline: two bars (Sun, Earth), ticks below, date labels on their own row
function drawStrip(cv, c, i0, n, iNow) {
  const { ctx, w, h } = fitCanvas(cv, +cv.dataset.h || 60);
  ctx.clearRect(0, 0, w, h);
  const bh = Math.round((h - 22) / 2);
  for (let px = 0; px < w; px++) {
    const a = i0 + Math.floor(px / w * n), b = Math.max(a + 1, i0 + Math.floor((px + 1) / w * n));
    let s = 0, e = 0, k = 0; for (let i = a; i < b && i < S.n; i++) { s += c.sf[i]; e += c.ev[i]; k++; }
    s /= k || 1; e /= k || 1;
    ctx.fillStyle = `rgba(${SUN_P},${0.08 + 0.8 * s})`; ctx.fillRect(px, 0, 1, bh);
    ctx.fillStyle = `rgba(${EARTH_P},${0.08 + 0.8 * e})`; ctx.fillRect(px, bh + 3, 1, bh);
  }
  ctx.font = cvf(11); ctx.textAlign = "left"; ctx.lineJoin = "round"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(235,236,234,.85)"; ctx.fillStyle = col("--ink");
  ctx.strokeText("SUN", 4, bh - 3.5); ctx.fillText("SUN", 4, bh - 3.5); ctx.strokeText("EARTH", 4, 2 * bh - 0.5); ctx.fillText("EARTH", 4, 2 * bh - 0.5);
  const ty = 2 * bh + 5;
  ctx.fillStyle = col("--muted");
  const days = n / 24, tick = days > 200 ? 30 : days > 60 ? 7 : 1;
  for (let d = 0; d <= days; d += tick) ctx.fillRect(Math.min(w - 1, Math.round(d / days * w)), ty, 1, 4);
  ctx.font = cvf(12); ctx.textAlign = "left";
  ctx.fillText(prettyDate(i0).slice(0, 11), 0, h - 2); ctx.textAlign = "right"; ctx.fillText(prettyDate(Math.min(S.n - 1, i0 + n - 1)).slice(0, 11), w, h - 2);
  if (iNow !== null && iNow >= i0 && iNow < i0 + n) { const x = (iNow - i0) / n * w; ctx.fillStyle = col("--ink"); ctx.fillRect(x - 1, -1, 2, 2 * bh + 5); }
}
