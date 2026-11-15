"use strict";
// Long Shadows · own date and time picker (UTC).
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- own date & time picker (UTC), one popover shared by every date field ----------
const fmtDT = (i) => prettyDate(i).replace(/ (\d\d:\d\d) UTC/, " · $1 UTC");
function setDT(el, i) { el.textContent = fmtDT(i); }
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DT = { i: 0, y: 2027, m: 0, pick: null, anchor: null };
function openDT(anchor, i, pick) {
  const pop = $("dtpop");
  if (!pop.hidden && DT.anchor === anchor) return closeDT();
  const d = iToDate(i); Object.assign(DT, { i, pick, anchor, y: d.getUTCFullYear(), m: d.getUTCMonth() });
  pop.hidden = false; drawDT();
  const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, vw = document.documentElement.clientWidth;
  let top = r.bottom + 6; if (top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
  pop.style.left = Math.max(8, Math.min(vw - pw - 8, r.left)) + window.scrollX + "px"; pop.style.top = top + window.scrollY + "px";
  anchor.setAttribute("aria-expanded", "true");
  const f = pop.querySelector(".dsel") || pop.querySelector("button"); f && f.focus({ preventScroll: true });
}
function closeDT() { const pop = $("dtpop"); if (pop.hidden) return; pop.hidden = true; if (DT.anchor) DT.anchor.removeAttribute("aria-expanded"); DT.anchor = null; }
function drawDT() {
  const pop = $("dtpop"), cur = iToDate(DT.i), hr = cur.getUTCHours(), lo = iToDate(0), hi = iToDate(S.n - 1);
  const ym = (d) => d.getUTCFullYear() * 12 + d.getUTCMonth(), now = Math.max(ym(lo), Math.min(ym(hi), DT.y * 12 + DT.m)); DT.y = Math.floor(now / 12); DT.m = now % 12;
  const lead = (new Date(Date.UTC(DT.y, DT.m, 1)).getUTCDay() + 6) % 7, days = new Date(Date.UTC(DT.y, DT.m + 1, 0)).getUTCDate();
  const iOf = (day, h) => Math.round((Date.UTC(DT.y, DT.m, day, h) - T0) / 3600e3), inMonth = cur.getUTCFullYear() === DT.y && cur.getUTCMonth() === DT.m;
  let h = `<div class="dt-years" role="group" aria-label="Year">`;
  for (let y = lo.getUTCFullYear(); y <= hi.getUTCFullYear(); y++) h += `<button data-y="${y}" aria-pressed="${y === DT.y}">${y}</button>`;
  h += `</div><div class="dt-head"><button class="btn small" data-mv="-1" aria-label="Previous month"${now <= ym(lo) ? " disabled" : ""}>‹</button><b>${MONTHS[DT.m]} ${DT.y}</b><button class="btn small" data-mv="1" aria-label="Next month"${now >= ym(hi) ? " disabled" : ""}>›</button></div>`;
  h += `<div class="dt-grid">` + ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => `<span>${d}</span>`).join("") + "<i></i>".repeat(lead);
  for (let d = 1; d <= days; d++) { const i = iOf(d, hr), ok = i >= 0 && i < S.n, sel = inMonth && cur.getUTCDate() === d; h += `<button data-d="${d}"${ok ? "" : " disabled"}${sel ? ' class="dsel" aria-current="date"' : ""}>${d}</button>`; }
  h += `</div><span class="label">Hour · UTC</span><div class="dt-hours">`;
  for (let k = 0; k < 24; k++) h += `<button data-h="${k}"${k === hr ? ' class="dsel"' : ""} aria-label="${k}:00 UTC">${String(k).padStart(2, "0")}</button>`;
  h += `</div><div class="dt-foot"><span class="mono">${fmtDT(DT.i)}</span><button class="btn small" data-done>Done</button></div>`;
  pop.innerHTML = h;
  const apply = (i, keep) => { DT.i = Math.max(0, Math.min(S.n - 1, i)); const d = iToDate(DT.i); DT.y = d.getUTCFullYear(); DT.m = d.getUTCMonth(); DT.pick(DT.i); drawDT(); const f = pop.querySelector(keep); f && f.focus({ preventScroll: true }); };
  pop.querySelectorAll("[data-y]").forEach(b => b.onclick = () => { DT.y = +b.dataset.y; drawDT(); const f = pop.querySelector('[data-y][aria-pressed="true"]'); f && f.focus({ preventScroll: true }); });
  pop.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => { const v = DT.y * 12 + DT.m + +b.dataset.mv; DT.y = Math.floor(v / 12); DT.m = v % 12; drawDT(); const f = pop.querySelector(`[data-mv="${b.dataset.mv}"]`); f && !f.disabled && f.focus({ preventScroll: true }); });
  pop.querySelectorAll("[data-d]").forEach(b => b.onclick = () => apply(iOf(+b.dataset.d, hr), ".dt-grid .dsel"));
  pop.querySelectorAll("[data-h]").forEach(b => b.onclick = () => apply(DT.i - hr + +b.dataset.h, ".dt-hours .dsel"));
  pop.querySelector("[data-done]").onclick = () => { const a = DT.anchor; closeDT(); a && a.isConnected && a.focus(); };
}
function normTime() { const a = periodStart(); S.i = Math.max(a, Math.min(S.i, a + periodN() - 1)); }
