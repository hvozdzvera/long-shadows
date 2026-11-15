"use strict";
// Long Shadows · energy: rough but honest numbers.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- energy: rough but honest numbers ----------
// Sunlight above the Moon carries 1361 W on every square metre. Cells turn about 30% of it into electricity; the array is assumed to face the Sun.
const KW_M2 = 1.361 * 0.30;
const RIG = { "2": { name: "A lander with 4 m² of solar panels", kw: +(4 * KW_M2).toFixed(1) }, "10": { name: "A 10 m solar mast (36 m² of panels)", kw: +(36 * KW_M2).toFixed(1) }, "20": { name: "A 20 m solar tower (76 m² of panels)", kw: +(76 * KW_M2).toFixed(1) } };
const fmtKWh = (v) => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + " MWh" : (v >= 100 ? Math.round(v) : v.toFixed(1)) + " kWh";
const fmtKg = (v) => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + " t" : Math.round(v) + " kg";       // battery cells at 200 Wh per kg
const kwOf = (o) => o.w * (o.h - 1) * KW_M2;
