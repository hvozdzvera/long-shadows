"use strict";
// Long Shadows · replay of real landings.
// Code written with an AI assistant (Claude, by Anthropic) under the direction of the author, Vera Hvozdz. See README.
// ---------- replay: put the tool at the place and hour of a real landing and compare with what happened ----------
const REPLAY = [
  { id: "ch3", site: "ch3", name: "Chandrayaan-3", when: "23 Aug 2023, 12:33 UTC", land: "2023-08-23T12", who: "ISRO, India",
    fact: "The lander and its rover worked through the rest of the lunar day. ISRO put the rover to sleep on 2 September and the lander on 4 September, just before sunset. Neither woke up after the two-week night.",
    verdict: "<b>It fits.</b> Our sunset falls on 4 September, the very day ISRO put the lander to sleep." },
  { id: "im1", site: "im1", name: "IM-1 Odysseus", when: "22 Feb 2024, 23:23 UTC", land: "2024-02-22T23", who: "Intuitive Machines, NASA CLPS",
    fact: "Odysseus caught a leg at touchdown and came to rest tilted over, so its panels got less light than planned. It ran for about six days; contact ended on 29 February as the Sun moved off the panels.",
    verdict: "<b>Night was not the cause.</b> At this spot the Sun stayed up until 2 March. Odysseus stopped earlier because it lay tilted and its panels lost the light." },
  { id: "ce6", site: "ce6", name: "Chang'e-6", when: "1 Jun 2024, 22:23 UTC", land: "2024-06-01T22", who: "CNSA, China",
    fact: "Chang'e-6 landed on the far side in the lunar morning, drilled and scooped samples for two days and lifted off on 3 June at 23:38 UTC. Every message went through the Queqiao-2 relay satellite.",
    verdict: "<b>It fits.</b> Earth is in view 0% of the time here, so a relay was the only way. The lander left with about eight days of daylight to spare." },
  { id: "bg1", site: "bg1", name: "Blue Ghost Mission 1", when: "2 Mar 2025, 08:34 UTC", land: "2025-03-02T08", who: "Firefly Aerospace, NASA CLPS",
    fact: "Blue Ghost worked for a full lunar day of about 14 Earth days, filmed the sunset and then ran about five hours into the night on batteries. Firefly reported its last signal on the evening of 16 March, US time.",
    verdict: "<b>It fits.</b> Our sunset is on 16 March, the day Blue Ghost filmed the Sun going down. It landed with the Sun only 3° up — right at the start of the lunar day, to get all 14 days of light." },
  { id: "im2", site: "mouton", name: "IM-2 Athena", when: "6 Mar 2025, 17:28 UTC", land: "2025-03-06T17", who: "Intuitive Machines, NASA CLPS",
    fact: "Athena came down about 250 m from its target and ended on its side inside a small, shaded crater. With the Sun very low and the panels pointing the wrong way it could not recharge; the mission ended the next day, 7 March.",
    verdict: "<b>A few hundred metres decided it.</b> On the planned spot the Sun was in view, but only 2.4° high. Inside a small crater nearby, a Sun that low does not reach the floor. That is the whole problem of the pole in one landing." }
];
const replayNow = () => REPLAY.find(m => m.site === S.site && hourOf(m.land) === S.t0);
function applyReplay(id) { const m = REPLAY.find(r => r.id === id); if (!m) return; S.site = m.site; S.i = S.t0 = hourOf(m.land); S.period = "day"; S.H = "2"; }
function renderReplay(c) {
  const m = replayNow(), box = $("replay-card"), sel = $("replay");
  if (!sel.options.length) { sel.add(new Option("Choose a mission…", "")); for (const r of REPLAY) sel.add(new Option(`${r.name} · ${r.when.match(/\d{4}/)[0]}`, r.id)); }
  sel.value = m ? m.id : ""; box.hidden = !m; if (!m) return;
  const t = S.t0, up = c.sf[t] >= 0.5, ns = nextChange(c.sf, t, 0.5), ne = nextChangeE(c, t), st = stats(c, t, 709);
  const sunTxt = up ? `the Sun was <b>${fx(c.sel[t], 1)}° above the horizon</b> and in view. It set <b>${ns.hours === null ? "after the end of our data" : fmtDur(ns.hours) + " later, on " + prettyDate(Math.round(t + ns.hours))}</b>.`
    : `the Sun was <b>hidden</b> behind the skyline (${fx(c.sel[t], 1)}° above a smooth horizon). ${ns.hours === null ? "" : "It came into view " + fmtDur(ns.hours) + " later."}`;
  const earthTxt = st.earth >= 99.95 ? "Earth stayed in view the whole time, so the lander could talk to it directly." : st.earth < 0.05 ? "Earth never rose here, so a relay satellite was the only link." : `Earth was ${ne.now ? "in view" : "below the skyline"} at landing and in view ${fmtPct(st.earth)} of the following lunar day.`;
  box.innerHTML = `<div class="rp-head"><span class="label">Replay · ${m.who}</span><button class="btn small" id="rp-close" aria-label="Close the replay">×</button></div>
    <h3 aria-level="2">${m.name} — landed ${m.when}</h3>
    <div class="rp-cols"><div><span class="label">What really happened</span><p>${m.fact}</p></div>
    <div><span class="label">What this tool shows for that hour</span><p>At ${c.site.name}, 2 m above the ground, ${sunTxt} ${earthTxt}</p></div></div>
    <p class="rp-verdict">${m.verdict}</p>
    <p class="rp-note">${c.site.lat > -60 ? "This site is far from the pole and is shown with a smooth horizon. " : ""}The tool only knows where the Sun and Earth were. Tipped landers, cold and empty batteries are not in it. Press ▶ to watch the Sun go down.</p>`;
  $("rp-close").onclick = () => { S.t0 = S.i = Math.min(S.n - 1, S.t0 + 1); renderSite(); };
}
function homeDoors() {          // the second door opens the best landing date of 2027 at Connecting Ridge, found from the data
  const a = aheadOf(series("ridge", "10")); let bi = Y27, bl = 0;
  for (let i = Y27; i < Y27 + 8760; i++) if (a[i] > bl && (i === Y27 || !a[i - 1])) { bl = a[i]; bi = i; }
  $("door-date-v").textContent = `${Math.round(bl / 24)} days of unbroken light at Connecting Ridge in 2027`;
  $("door-date").onclick = () => { S.site = "ridge"; S.H = "10"; S.period = "day"; S.i = S.t0 = bi; };
}
function replayEvents() {
  $("replay").onchange = (e) => { if (!e.target.value) return; stopPlay(); applyReplay(e.target.value); renderSite(); saveLink(); };
  $("cta-replay").onclick = () => { applyReplay("bg1"); };
}
