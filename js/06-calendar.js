"use strict";
// Long Shadows · landing calendar: how long the sunlight lasts after a landing on each date.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- landing calendar: for every date of a year, how long the sunlight lasts without a break after landing ----------
function aheadOf(c) {
  if (c.ahead) return c.ahead;
  const n = S.n, a = new Uint16Array(n + 1), pe = new Uint32Array(n + 1);
  for (let i = n - 1; i >= 0; i--) a[i] = c.sf[i] >= 0.5 ? Math.min(65535, a[i + 1] + 1) : 0;
  for (let i = 0; i < n; i++) pe[i + 1] = pe[i] + c.ev[i];
  c.pe = pe; return (c.ahead = a);
}
const CAL = { days: [], iA: 0, yr: 0 };
function drawCal(c, iNow) {
  const cv = $("cal"), { ctx, w, h } = fitCanvas(cv, 96), a = aheadOf(c), yr = iToDate(S.t0).getUTCFullYear();
  const iA = Math.max(0, Math.round((Date.UTC(yr, 0, 1) - T0) / 3600e3)), iB = Math.min(S.n, Math.round((Date.UTC(yr + 1, 0, 1) - T0) / 3600e3)), nd = Math.ceil((iB - iA) / 24);
  const days = []; let top = 0;
  for (let d = 0; d < nd; d++) {
    let best = 0, bi = iA + d * 24; for (let i = iA + d * 24; i < Math.min(iB, iA + d * 24 + 24); i++) if (a[i] > best) { best = a[i]; bi = i; }
    const e0 = bi, e1 = Math.min(S.n, bi + 336); days.push({ i: bi, light: best, earth: (c.pe[e1] - c.pe[e0]) / Math.max(1, e1 - e0) }); if (best > top) top = best;
  }
  Object.assign(CAL, { days, iA, yr, nd });
  ctx.clearRect(0, 0, w, h);
  const H = 58, cw = w / nd, cap = Math.max(top, 24);
  ctx.fillStyle = "rgba(26,27,27,.05)"; ctx.fillRect(0, 0, w, H);
  days.forEach((d, k) => {
    const bh = d.light / cap * (H - 2); ctx.fillStyle = `rgba(${SUN_P},${d.light ? 0.9 : 0})`; ctx.fillRect(k * cw, H - bh, Math.max(1, cw - (cw > 2.2 ? 0.6 : 0)), bh);
    ctx.fillStyle = `rgba(${EARTH_P},${0.08 + 0.8 * d.earth})`; ctx.fillRect(k * cw, H + 3, cw + 0.3, 8);
  });
  ctx.font = cvf(11); ctx.lineJoin = "round"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(235,236,234,.9)"; ctx.fillStyle = col("--ink"); ctx.textAlign = "left";
  const lab = top ? `TALLEST BAR: ${fmtDays(top).toUpperCase()} OF LIGHT` : "NO DIRECT SUNLIGHT THIS YEAR"; ctx.strokeText(lab, 4, 12); ctx.fillText(lab, 4, 12);
  ctx.fillStyle = col("--muted"); ctx.font = cvf(12);
  for (let m = 0; m < 12; m++) {
    const i = Math.round((Date.UTC(yr, m, 1) - T0) / 3600e3); if (i < iA || i >= iB) continue;
    const x = (i - iA) / 24 * cw; ctx.fillRect(Math.round(x), H + 13, 1, 5); ctx.fillText(MONTHS[m].slice(0, 3).toUpperCase(), x + 4, h - 3);
  }
  if (iNow >= iA && iNow < iB) { const x = (iNow - iA) / 24 * cw; ctx.fillStyle = col("--ink"); ctx.fillRect(x - 1, 0, 2, H + 11); }
  $("cal-title").textContent = `Landing calendar ${yr} — unbroken sunlight after landing on each date · ${S.H} m up`;
  // the best dates: the starts of the longest stretches of light
  const runs = []; for (let i = iA; i < iB; i++) if (a[i] && (i === iA || !a[i - 1])) runs.push({ i, len: a[i] });
  runs.sort((p, q) => q.len - p.len);
  const cut = runs.slice(0, 3).some(r => r.i + r.len >= S.n);
  $("cal-best").innerHTML = runs.length ? `<span class="label">Best dates to land</span>` + runs.slice(0, 3).map(r => `<button class="btn small" data-i="${r.i}">${prettyDate(r.i).slice(0, 6)} · ${fmtDays(r.len)} of light</button>`).join("") + (cut ? `<span class="label">a stretch that reaches 31 Dec 2028 is cut there</span>` : "")
    : `<span class="label">The Sun never clears the skyline here in ${yr}.</span>`;
  $("cal-best").querySelectorAll("[data-i]").forEach(b => b.onclick = () => { S.i = S.t0 = +b.dataset.i; S.period = "day"; renderSite(); saveLink(); });
  if (!CAL.hover) $("cal-read").textContent = "Blue band: Earth in view during the next 14 days · click a date to jump there";
}
function calEvents() {
  const cv = $("cal");
  const at = (ev) => { const r = cv.getBoundingClientRect(); return CAL.days[Math.max(0, Math.min(CAL.days.length - 1, Math.floor((ev.clientX - r.left) / r.width * CAL.days.length)))]; };
  cv.addEventListener("pointermove", (ev) => { const d = at(ev); if (!d) return; CAL.hover = true; $("cal-read").textContent = `${prettyDate(d.i).slice(0, 11)}: ${d.light ? fmtDays(d.light) + " of light ahead" : "dark all day"} · Earth in view ${Math.round(d.earth * 100)}% of the next 14 days`; });
  cv.addEventListener("pointerleave", () => { CAL.hover = false; $("cal-read").textContent = "Blue band: Earth in view during the next 14 days · click a date to jump there"; });
  cv.addEventListener("click", (ev) => { const d = at(ev); if (!d) return; S.i = S.t0 = d.i; renderSite(); saveLink(); });
  cv.addEventListener("keydown", (ev) => { if (ev.key !== "Enter" && ev.key !== " ") return; ev.preventDefault(); const b = $("cal-best").querySelector("button"); b && b.focus(); });
}
