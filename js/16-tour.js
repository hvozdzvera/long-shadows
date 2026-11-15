"use strict";
// Long Shadows · guided tour in seven steps.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- guided tour: seven steps, each puts the tool into a telling state and says one thing about it ----------
const TOUR_DAY = Math.round((Date.UTC(2027, 9, 20) - T0) / 3600e3);
const tourBase = () => { S.site = "ridge"; S.H = "10"; S.period = "day"; S.i = S.t0 = TOUR_DAY; };
const TOUR = { on: false, k: 0, nav: false, steps: [
  { hash: "#sites", at: "#map", h: "Pick a place", p: "Eighteen sites near the south pole: NASA's nine Artemis regions, commercial landers and real landings. The amber layer is NASA's map of where the Sun shines most of the time.",
    go: () => { tourBase(); setView("map"); setLayer("sun"); } },
  { hash: "#site", at: ".pano-box", h: "Stand on the site", p: "Connecting Ridge on 20 October 2027. The pale line is the real skyline, measured by NASA's laser altimeter. The Sun and Earth travel along it; press ▶ to watch a lunar day.", go: tourBase },
  { hash: "#site", at: "#verdict", h: "Read the verdict", p: "For a landing at this moment: how long the sunlight lasts, whether Earth is in view for a direct radio link, how steep the ground is and how far the nearest permanent shadow lies.", go: tourBase },
  { hash: "#site", at: "#replay-card", h: "Check it against a real landing", p: "Chandrayaan-3 landed on 23 August 2023. The tool puts sunset on 4 September, the very day India put the lander to sleep.", go: () => applyReplay("ch3") },
  { hash: "#compare", at: "#cmp", h: "Compare sites or dates", p: "Three sites on the same date, row by row. Switch to “1 site, 3 dates” to see what a slipped launch would cost.",
    go: () => { tourBase(); S.compare = ["ridge", "malapert", "mouton"]; S.cmpMode = "sites"; } },
  { hash: "#plan", at: ".plan-frame", h: "Plan a base", p: "A base needs several solar masts and antennas, and shadows here are hundreds of metres long. Place them on real terrain: the checks show which mast shades which and what blocks the line to Earth.",
    go: () => { tourBase(); RV.open = false; RV.pick = null; if (!P.objs.length) exampleLayout(); P.view = 1200; } },
  { hash: "#plan", at: ".plan-frame", h: "Send a rover", p: "The shortest way to the goal crosses a shadow that would empty the battery, so the route goes round along the sunlit ridge. Drag the two marks to try your own. That is the whole tool; the method and the checks are on the About screen. For specialists, the Advanced switch in the header adds ground stations, temperature, buried ice and two more sites for this plan.",
    go: () => { tourBase(); Object.assign(RV, { open: true, pick: null, start: { e: 60, n: -60 }, goal: { e: -1700, n: 0 }, speed: 0.7, maxSlope: 15, batt: 2, back: false }); ["speed", "slope", "batt"].forEach((k, j) => { $("rv-" + k).value = [0.7, 15, 2][j]; }); $("rv-back").checked = false; loadRover(); P.view = 4000; P.tool = "move"; } }
] };
function tourShow() {
  const st = TOUR.steps[TOUR.k], n = TOUR.steps.length, card = $("tour");
  document.querySelectorAll(".tour-hl").forEach(e => e.classList.remove("tour-hl"));
  stopPlay(); planStop(); closeDT(); st.go();
  card.hidden = false; document.documentElement.classList.add("touring");
  $("tour-n").textContent = `Tour · ${TOUR.k + 1} of ${n}`; $("tour-h").textContent = st.h; $("tour-p").textContent = st.p;
  $("tour-dots").innerHTML = TOUR.steps.map((_, j) => `<i class="${j === TOUR.k ? "on" : ""}"></i>`).join("");
  $("tour-back").disabled = TOUR.k === 0; $("tour-next").textContent = TOUR.k === n - 1 ? "Finish" : "Next →";
  $("tour-next").focus({ preventScroll: true });
  const after = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!TOUR.on) return;
    const el = document.querySelector(st.at), hd = document.querySelector("header.top");
    if (el && el.getClientRects().length) {
      el.classList.add("tour-hl");
      const r = el.getBoundingClientRect(), top = r.top + window.scrollY - (hd ? hd.offsetHeight : 0) - 18, room = window.innerHeight - (hd ? hd.offsetHeight : 0) - card.offsetHeight - 40;
      window.scrollTo({ top: Math.max(0, r.height > room ? top : top - (room - r.height) / 2), behavior: "auto" });
    }
    $("tour-next").focus({ preventScroll: true });
  }));
  if (location.hash !== st.hash) { TOUR.nav = true; location.hash = st.hash; } else render();
  after();
}
function tourEnd() { TOUR.on = false; $("tour").hidden = true; document.documentElement.classList.remove("touring"); document.querySelectorAll(".tour-hl").forEach(e => e.classList.remove("tour-hl")); }
function tourEvents() {
  $("door-tour").onclick = (ev) => { ev.preventDefault(); if (S.expert) setExpert(false, true); TOUR.on = true; TOUR.k = 0; tourShow(); };
  $("tour-next").onclick = () => { if (TOUR.k === TOUR.steps.length - 1) { tourEnd(); RV.open = false; RV.pick = null; P.view = 1200; P.tool = "m10"; location.hash = "#home"; return; } TOUR.k++; tourShow(); };      // Finish goes back to the first screen
  $("tour-back").onclick = () => { if (TOUR.k > 0) { TOUR.k--; tourShow(); } };
  $("tour-x").onclick = tourEnd;
  window.addEventListener("hashchange", () => { if (TOUR.on && !TOUR.nav) tourEnd(); TOUR.nav = false; });      // leaving by hand ends the tour
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && TOUR.on && $("dtpop").hidden) tourEnd(); }, true);      // capture: runs before the date picker closes itself, so one Esc closes only the picker
}
