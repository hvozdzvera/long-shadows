"use strict";
// Long Shadows · which screen is shown, and drawing it again.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- routing & events ----------
const VIEWS = ["home", "sites", "site", "compare", "plan", "about"];
const curView = () => { const v = (location.hash || "#home").slice(1); return VIEWS.includes(v) ? v : "home"; };
function render() {
  const view = curView();
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("on", s.id === "v-" + view));
  document.querySelectorAll("nav.keys a").forEach(a => { if (a.getAttribute("href") === "#" + view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  $("hint").textContent = (S.expert ? HINTS_X : HINTS)[view] || ""; $("hint").hidden = view === "home" || view === "sites" || view === "about";
  homeOn(view === "home");
  if (view === "sites") renderSites();
  if (view === "site") renderSite();
  if (view === "compare") renderCompare();
  if (view === "plan") { if (!P.objs.length && !P.cleared) exampleLayout(); renderPlan(); }
  if (view === "about") renderAbout();
  saveLink();
}
function rerender() { const v = curView(); if (v === "plan") renderPlan(); else if (v === "home") { PO.drawnAz = null; drawPole(); } else render(); saveLink(); }
