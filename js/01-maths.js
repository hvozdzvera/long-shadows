"use strict";
// Long Shadows · small maths helpers.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- maths ----------
function frame(lat, lon) {
  const la = lat * D2R, lo = lon * D2R;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-up[2] * east[1], up[2] * east[0], up[0] * east[1] - up[1] * east[0]];
  return { up, east, north };
}
const dot = (a, b, o) => a[o] * b[0] + a[o + 1] * b[1] + a[o + 2] * b[2];
function hzAt(arr, az) {
  const x = (((az % 360) + 360) % 360) / 0.5, i = Math.floor(x) % NB, f = x - Math.floor(x);
  return arr[i] * (1 - f) + arr[(i + 1) % NB] * f;
}
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
