"""Rover route: the browser against an independent model, and rules that every route must obey."""
import json
import os

from harness import Checks, open_site

REF = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rover_reference.json"), encoding="utf-8"))


async def run(browser):
    c = Checks("Rover")
    page = await open_site(browser, "plan")
    await page.click("#rover-open")
    await page.wait_for_function("RV.state === 'ready'", timeout=30000)

    # 1. rover_reference.json was produced by build/rover_check.py: the same rules written again in Python, from the terrain file up.
    got = await page.evaluate("ms => { const c = series('ridge', '10'); return ms.map(m => { const s = sunAtT(c, m[1]); return rvMargin(m[0], s[0], s[1]); }); }", REF["margins"])
    gap = max(abs(a - b[2]) for a, b in zip(got, REF["margins"]))
    flips = sum((a < 0) != (b[2] < 0) for a, b in zip(got, REF["margins"]))
    c.ok("Sun above or below the skyline of a cell: same answer as the Python model at 300 cell-hours", flips == 0 and gap < 1e-3, f"largest gap {gap:.5f}°")
    worst, wrong = 0.0, 0
    for r in REF["routes"]:
        g = await page.evaluate("""r => { RV.speed = r.speed; RV.maxSlope = r.lim; RV.batt = r.batt;
            const p = rvSearch(rvCell({ e: r.a[0], n: r.a[1] }), rvCell({ e: r.b[0], n: r.b[1] }), r.t0, r.lam); if (!p) return null;
            const s = rvSim(p, r.t0, r.batt); return { len: s.len, time: s.time, shadow: s.shadow, end: s.endCh, dead: s.dead ? s.dead.km : null, steep: s.steep, cost: s.time + r.lam * s.shadow }; }""", r)
        if g is None or r.get("none"):
            wrong += (g is None) != bool(r.get("none"))
            continue
        d = max(abs(g[k] - r[k]) for k in ("len", "time", "shadow", "end", "steep", "cost"))
        worst = max(worst, d)
        wrong += d > 1e-6 or (g["dead"] is None) != (r["dead"] is None) or (g["dead"] is not None and abs(g["dead"] - r["dead"]) > 1e-6)
    c.ok(f"{len(REF['routes'])} routes: length, time, time in shadow and battery equal to the Python model", wrong == 0, f"largest gap {worst:.1e}")

    # 2. Random starts, goals, speeds, slope limits, batteries and dates: every route found must obey the rules.
    r = await page.evaluate("""() => { let seed = 2026; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, pick = a => a[Math.floor(rnd() * a.length)];
        const G = RV.G, bad = []; let found = 0; const i0 = S.i;
        for (let k = 0; k < 40; k++) {
            RV.start = { e: (rnd() - .5) * 3900, n: (rnd() - .5) * 3900 }; RV.goal = { e: (rnd() - .5) * 3900, n: (rnd() - .5) * 3900 };
            RV.speed = pick([0.2, 0.7, 2, 15]); RV.maxSlope = pick([8, 12, 15, 20, 30]); RV.batt = pick([0.5, 1, 2, 6, 50]); RV.back = rnd() < 0.4; S.i = pick([0, Math.floor(rnd() * S.n), S.n - 1, 36984]); RV.key = "";
            let R; try { R = rvCompute(); } catch (e) { bad.push(["exception", k, String(e).slice(0, 100)]); continue; }
            if (R.fail) continue; found++;
            const lim = RV.maxSlope / RV.sq;
            R.legs.forEach((L, li) => { const q = L.r, p = q.path, a = rvCell(li ? RV.goal : RV.start), b = rvCell(li ? RV.start : RV.goal);
                if (p[0] !== a || p[p.length - 1] !== b) bad.push(["does not join start and goal", k]);
                for (let j = 0; j < p.length; j++) { if (RV.slope[p[j]] > lim) bad.push(["crosses ground steeper than the limit", k]);
                    if (j) { const dx = Math.abs(p[j] % G - p[j - 1] % G), dy = Math.abs(Math.floor(p[j] / G) - Math.floor(p[j - 1] / G));
                        if (dx > 2 || dy > 2 || (dx === 2 && dy !== 1) || (dy === 2 && dx !== 1) || (!dx && !dy)) bad.push(["jumps between cells", k]);
                        if (!(q.tAt[j] > q.tAt[j - 1])) bad.push(["time does not grow", k]); } }
                if (Math.abs(q.time - q.len / (RV.speed * 1000)) > 1e-9) bad.push(["time is not length / speed", k]);
                if (q.shadow > q.time + 1e-9 || q.longest > q.shadow + 1e-9) bad.push(["shadow time longer than the trip", k]);
                if (!q.dead && q.minCh < -1e-9) bad.push(["battery below zero on a route reported as safe", k]); });
            rvPanel(); if (/NaN|undefined|Infinity/.test(document.getElementById("rv-out").innerText)) bad.push(["broken text", k]);
        }
        S.i = i0; return { found, bad: bad.slice(0, 5), n: bad.length }; }""")
    c.ok("40 random scenarios: routes join start and goal, stay off steep ground, never jump, never report a dead battery as safe", r["n"] == 0 and r["found"] >= 10, f"{r['found']} routes found; {r['bad'] or 'no rule broken'}")
    c.ok("no script errors", not page.errors, page.errors[:3])
    await page.context.close()
    return c
