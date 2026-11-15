"use strict";
// Long Shadows · events and start.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- events and start ----------
function bind() {
  document.querySelectorAll("#xsw button").forEach(b => b.onclick = () => setExpert(b.dataset.x === "1"));
  $("plan-sites").innerHTML = PLAN_SITES.map(id => `<button data-s="${id}" aria-pressed="${id === P.site}">${S.byId[id].name}</button>`).join("");
  xlEvents(); xaEvents();
  $("plan-sites").onclick = (ev) => { const b = ev.target.closest("button"); if (b) planSwitch(b.dataset.s); };
  window.addEventListener("hashchange", () => { stopPlay(); planStop(); stop3D(); closeDT(); render(); window.scrollTo(0, 0); });
  window.addEventListener("resize", () => { closeDT(); clearTimeout(bind.t); bind.t = setTimeout(rerender, 120); });
  document.querySelectorAll("#layer-seg button").forEach(b => b.onclick = () => setLayer(b.dataset.v));
  const segBind = (id, key) => document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { S[key] = b.dataset.v; rerender(); });
  ["h-seg", "h-seg-2"].forEach(id => segBind(id, "H"));
  ["p-seg", "p-seg-2", "p-seg-3"].forEach(id => segBind(id, "period"));
  $("site-select").onchange = (e) => { S.site = e.target.value; renderSite(); saveLink(); };
  document.querySelectorAll(".copy-link").forEach(b => { b.hidden = !LINK.ok; b.onclick = () => copyLink(b); });
  ["c-lat", "c-lon"].forEach(id => $(id).onchange = () => renderSite());
  const setDate = (i) => { S.i = S.t0 = i; rerender(); };
  $("anchor").onclick = () => { S.t0 = S.i; renderSite(); };
  $("dt").onclick = () => openDT($("dt"), S.i, setDate);
  $("cmp-dt").onclick = () => openDT($("cmp-dt"), S.t0, setDate);
  $("plan-dt").onclick = () => openDT($("plan-dt"), S.i, setDate);
  document.addEventListener("pointerdown", (ev) => { if (!$("dtpop").hidden && !ev.target.closest(".dtpop,.dtp")) closeDT(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("dtpop").hidden) { const a = DT.anchor; closeDT(); a && a.isConnected && a.focus(); } });
  $("range").oninput = (e) => { S.i = periodStart() + +e.target.value; renderSite(); saveLink(); };
  document.querySelectorAll("#shift-seg button").forEach(b => b.onclick = () => {
    const mv = (t) => Math.max(0, Math.min(S.n - 1, t + 24 * +b.dataset.d));
    if (S.cmpMode === "dates") S.cmpDates = S.cmpDates.map(mv); else S.i = S.t0 = mv(S.t0);
    renderCompare();
  });
  document.querySelectorAll("#mode-seg button").forEach(b => b.onclick = () => { S.cmpMode = b.dataset.v; renderCompare(); });
  $("cmp-site").onchange = (e) => { S.site = e.target.value; renderCompare(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const k in STARS) delete STARS[k]; rerender(); });
  $("show-sun").onchange = (e) => { S.showSun = e.target.checked; renderSite(); };
  $("show-earth").onchange = (e) => { S.showEarth = e.target.checked; renderSite(); };
  $("add-compare").onclick = () => { if (!S.compare.includes(S.site)) { S.compare.push(S.site); if (S.compare.length > 3) S.compare.shift(); } location.hash = "compare"; };
  $("strip").addEventListener("click", (ev) => { const r = ev.currentTarget.getBoundingClientRect(); S.i = periodStart() + Math.floor((ev.clientX - r.left) / r.width * periodN()); renderSite(); });
  $("why-toggle").onclick = () => { S.whyOpen = !S.whyOpen; $("site-grid").classList.toggle("why-closed", !S.whyOpen); $("why-toggle").textContent = S.whyOpen ? "▸" : "◂"; $("why-toggle").setAttribute("aria-expanded", String(S.whyOpen)); renderSite(); };
  $("play").onclick = () => (S.playing ? stopPlay() : startPlay());
  $("clear-plan").addEventListener("click", () => { P.cleared = true; });
  planEvents(); roverEvents(); tourEvents(); homeEvents(); csvEvents(); events3D(); calEvents(); replayEvents(); homeDoors();
  // "back to the start": the slider returns to the first hour of the period
  $("rew").onclick = () => { stopPlay(); S.i = periodStart(); renderSite(); saveLink(); };
  $("plan-rew").onclick = () => { planStop(); S.i = periodStart(); renderPlan(); saveLink(); };
  $("t3-rew").onclick = () => { stop3D(); S.i = periodStart(); drawView(); saveLink(); };
  $("map").addEventListener("click", mapPick);
  document.addEventListener("keydown", (ev) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || ev.altKey || ev.ctrlKey || ev.metaKey || !$("dtpop").hidden) return;
    const v = curView(), dx = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0, dy = ev.key === "ArrowUp" ? 1 : ev.key === "ArrowDown" ? -1 : 0;
    if (v === "plan" && P.sel.size && (dx || dy)) {           // keyboard alternative to dragging
      ev.preventDefault(); const st = ev.shiftKey ? 50 : 10, [le, ln] = planLim();
      for (const o of P.objs) if (P.sel.has(o.id)) { o.e = Math.max(-le, Math.min(le, o.e + dx * st)); o.n = Math.max(-ln, Math.min(ln, o.n + dy * st)); }
      P.dirty = true; renderPlan();
    } else if ((v === "site" || v === "plan") && dx) {
      ev.preventDefault(); const a = periodStart(); S.i = Math.max(a, Math.min(a + periodN() - 1, S.i + dx * (ev.shiftKey ? 24 : 1))); v === "site" ? renderSite() : renderPlan();
    }
  });
}
function startPlay() {
  S.playing = true; $("play").textContent = "❚❚"; $("play").setAttribute("aria-label", "Pause");
  const i0 = periodStart(); let k = S.i - i0;
  const tick = () => { if (!S.playing) return; k += Math.max(1, Math.round(periodN() / 360)); if (k >= periodN()) k = 0; S.i = i0 + k; renderSite(); S.raf = requestAnimationFrame(tick); };
  S.raf = requestAnimationFrame(tick);
}
function stopPlay() { S.playing = false; cancelAnimationFrame(S.raf); $("play").textContent = "▶"; $("play").setAttribute("aria-label", "Play"); }
function b64(str) { const bin = atob(str), u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return u.buffer; }

async function init() {
  try {
    fetch("data/regions.json").then(r => r.json()).then(j => { S.regions = j; const g = $("map-grid"); if (g.dataset.done) { delete g.dataset.done; if (curView() === "sites") renderSites(); } }).catch(() => {});
    const [sites, ephJ, plan, pole] = await Promise.all([
      fetch("data/sites.json").then(r => r.json()),
      fetch("data/ephem.json").then(r => r.json()),
      fetch("data/plan.json").then(r => r.json()),
      fetch("data/pole.json").then(r => r.json())
    ]);
    S.sites = sites; sites.forEach(s => S.byId[s.id] = s);
    S.eph = new Float32Array(b64(ephJ.data_b64)); S.n = S.eph.length / 6;
    S.plan = Object.assign(plan, { h: new Int16Array(b64(plan.height_b64)) });
    S.planImg = new Image(); S.planImg.src = "data/plan_relief.jpg"; S.planImg.onload = () => { if (location.hash === "#plan") renderPlan(); };
    S.i = S.t0 = Math.round((Date.UTC(2027, 9, 20) - T0) / 3600e3); S.cmpMode = "sites"; S.filter = "all"; S.view = "map"; S.sort = "listed"; readLink(); setExpert(expertWanted(), true);
    if (S.expert) { try { const ps = new URLSearchParams(location.search).get("ps"); if (ps) setTimeout(() => planSwitch(ps), 0); } catch (e) { /* no address to read */ } }
    const low = (await pngHeights({ file: pole.file, n: pole.N, q: 1, sum: pole.sum }, pole.offset)).h;
    poleInit(pole, low); stars();
    $("loading").remove();
    bind(); render();
    setTimeout(() => document.querySelectorAll('img[loading="lazy"]').forEach(im => { im.loading = "eager"; }), 2500);   // the map pictures are left out of the first screen and fetched once it is drawn
    // sharper picture: heights at 195 m per pixel, shaded on the graphics card (small screens keep the lighter 390 m file)
    const coarse = { h: low, n: pole.N, px: pole.px_m };
    (SMALL || !pole.hi ? Promise.resolve(coarse) : pngHeights(pole.hi, pole.offset).catch(() => coarse)).then((t) => {
      if (!gpuInit(t.h, t.n, t.px)) return;
      T3.key = ""; const v = curView(); if (v === "home") drawPole(); else if (v === "sites") drawView();
    });
  } catch (e) {
    $("loading").textContent = "Could not load the data files. Open the page through a web server (for example GitHub Pages), not as a local file.";
    console.error(e);
  }
}
init();
