"use strict";
// Long Shadows · constants and the shared state.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// The program is one script cut into files; they are loaded in order and share one scope.
// Shared objects (declared once, used by every file):
//   S   what is shown now: sites, ephemeris, chosen site, date (hour index S.i), period, height
//   P   base plan: tool, placed objects, selection, view size
//   RV  rover: marks, settings, loaded skyline of every cell, last route
//   PO  home picture of the pole · PG  graphics-card shading · GL  3D view · TR  terrain tiles
//   TOUR guided tour · XD  data of the Advanced mode · XL  list of your own points
const D2R = Math.PI / 180, R2D = 180 / Math.PI, RM = 1737.4, RSUN = 0.2666, REARTH = 0.95, NB = 720;
const T0 = Date.UTC(2023, 7, 1), Y27 = Math.round((Date.UTC(2027, 0, 1) - T0) / 3600e3);      // hour 0 of the data; first hour of 2027
const PERIODS = { day: { h: 709, label: "1 lunar day (29.5 d)" }, q: { h: 2184, label: "3 months" }, y: { h: 8760, label: "1 year" } };
const HINTS_X = {           // Advanced: the short working line
  site: "Pick the site, height and period on the left, and the date under the panorama. The panorama shows the real horizon with the paths of the Sun and Earth.",
  compare: "Three sites on the same landing date, or one site on three dates. Move the dates to see what a launch slip does. ● marks the best value in each row.",
  plan: "Pick an object and click on the map to place it. Drag to move. Press ▶ or move the slider to watch the shadows turn. The checks on the right show how objects get in each other's way."
};
const HINTS = {             // Standard: what is on the screen and why it matters
  site: "This is the view from the landing site: the real skyline all the way round, with the Sun and Earth moving along it. While the Sun is above that line the lander has power; while Earth is above it, a direct radio link. Pick the site, height and period on the left, and the date under the picture.",
  compare: "Which site is better, and what does a late launch cost? Here are three sites on one landing date, or one site on three dates, row by row. Move the dates to see what a slip does. ● marks the best value in each row.",
  plan: "A base is more than one lander: masts shade each other and can stand in an antenna's line to Earth. Pick an object and click on the map to place it, drag to move it, press ▶ to watch the shadows turn. The checks on the right show who gets in whose way."
};
const S = { sites: [], byId: {}, eph: null, n: 0, site: "ridge", H: "10", period: "day", i: 1416, compare: ["ridge", "malapert", "mouton"], layer: "sun", showSun: true, showEarth: true, whyOpen: true, cache: {}, plan: null };
const $ = (id) => document.getElementById(id);
