"use strict";
// Long Shadows · a link that remembers the view.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- a link that remembers the view: site, date, period, height, comparison, own point ----------
// It lives in the address after "?". Inside an embedded preview the address cannot be changed, so there it is quietly skipped.
const LINK = { ok: false, t: 0 };
try { LINK.ok = window.self === window.top && /^https?:$/.test(location.protocol); } catch (e) { LINK.ok = false; }
const hourOf = (v) => { const t = Date.parse(v + ":00:00Z"), i = Math.round((t - T0) / 3600e3); return isNaN(t) || i < 0 || i > S.n - 1 ? null : i; };
function stateQS() {
  const q = new URLSearchParams();
  if (S.expert) q.set("x", "1"); if (S.expert && P.site !== "ridge") q.set("ps", P.site);
  q.set("site", S.site); q.set("t", dateStr(S.t0).slice(0, 13)); if (S.i !== S.t0) q.set("now", dateStr(S.i).slice(0, 13));
  q.set("p", S.period); q.set("h", S.H);
  if (S.compare.length) q.set("cmp", S.compare.join("."));
  if (S.customOn || S.site === "custom") { q.set("lat", $("c-lat").value); q.set("lon", $("c-lon").value); }
  return q.toString();
}
function saveLink() {
  if (!LINK.ok) return;
  clearTimeout(LINK.t);
  LINK.t = setTimeout(() => { try { history.replaceState(null, "", "?" + stateQS() + location.hash); } catch (e) { LINK.ok = false; } }, 500);
}
function readLink() {
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
  const lat = parseFloat(q.get("lat")), lon = parseFloat(q.get("lon"));
  if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90) { $("c-lat").value = lat; $("c-lon").value = ((lon % 360) + 360) % 360; S.customOn = true; }
  const ok = (id) => !!S.byId[id] || (id === "custom" && S.customOn);
  if (ok(q.get("site"))) S.site = q.get("site");
  if (PERIODS[q.get("p")]) S.period = q.get("p");
  if (["2", "10", "20"].includes(q.get("h"))) S.H = q.get("h");
  if (q.get("cmp")) { const c = q.get("cmp").split(".").filter(ok).slice(0, 3); if (c.length) S.compare = c; }
  const t = q.get("t") && hourOf(q.get("t")), now = q.get("now") && hourOf(q.get("now"));
  if (t != null && t !== "") { S.t0 = S.i = t; if (now != null && now !== "") S.i = now; }
}
function copyLink(btn) {
  const url = location.origin + location.pathname + "?" + stateQS() + location.hash, done = (m) => { btn.textContent = m; setTimeout(() => { btn.textContent = "Copy link to this view"; }, 1800); };
  try { navigator.clipboard.writeText(url).then(() => done("Link copied"), () => done("Copy it from the address bar")); } catch (e) { done("Copy it from the address bar"); }
}
