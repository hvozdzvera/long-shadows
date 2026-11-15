"""Advanced mode: the switch, and every block it adds. Standard must stay free of them."""
import json
import os

from harness import ROOT, Checks, open_site

ROWS = "[...document.querySelectorAll('#verdict .vd-row .tag')].map(e => e.textContent)"                    # Standard: the verdict in words
TABLE = "[...document.querySelectorAll('#verdict table.vt tr')].slice(1).map(r => [...r.cells].map(td => td.innerText.trim()))"      # Advanced: the verdict as a table
SHOWN = "(q) => [...document.querySelectorAll(q)].filter(e => e.getClientRects().length).length"


async def run(browser):
    c = Checks("Advanced mode")
    sites = json.load(open(os.path.join(ROOT, "data", "sites.json"), encoding="utf-8"))
    page = await open_site(browser, "site")
    std = await page.evaluate(ROWS)
    c.ok("Standard: verdict in words with a bottom line, no Advanced block, no Advanced data loaded",
         len(std) == 4 and await page.evaluate("!!document.querySelector('#verdict .vd-sum') && !S.expert && XD.state === 'idle'") and await page.evaluate("[...document.querySelectorAll('.x-only')].every(e => getComputedStyle(e).display === 'none')"), std)
    shown = await page.evaluate(f"[({SHOWN})('#tiles .tile'), document.getElementById('energy').hidden, ({SHOWN})('#csv-save'), ({SHOWN})('.why-col')]")
    c.ok("Standard: three summary figures, no energy line, no CSV buttons, the explanation column is there", shown == [3, True, 0, 1], shown)
    await page.click("#xsw button[data-x='1']")
    await page.wait_for_function("XD.state === 'ready'", timeout=20000)
    await page.wait_for_timeout(300)
    rows = await page.evaluate(TABLE)
    names = [r[0] for r in rows]
    c.ok("Advanced: the verdict becomes a table with stations, 5 m slope, temperature and ice",
         len(rows) == 15 and all(len(r) == 3 and r[1] and r[2] for r in rows) and "DSN complex in position now" in names and any(n.startswith("Slope within 100 m, 5 m map") for n in names)
         and "Surface temperature: mean / highest" in names and not await page.evaluate("!!document.querySelector('#verdict .vd-row')"), names[5:])
    shown = await page.evaluate(f"[({SHOWN})('#tiles .tile'), document.getElementById('energy').hidden, ({SHOWN})('#csv-save'), ({SHOWN})('.why-col')]")
    c.ok("Advanced: five summary figures, the energy line, CSV buttons, no explanation column", shown == [5, False, 1, 0], shown)
    ridge = next(q for q in sites if q["id"] == "ridge"); st = ridge["stats_2027_2028"]["2"]
    both = [q for q in sites if q.get("nasa_sun_pct") is not None]
    gs = sum(abs(q["stats_2027_2028"]["2"]["sun_pct"] - q["nasa_sun_pct"]) for q in both) / len(both); ge = sum(abs(q["stats_2027_2028"]["2"]["earth_pct"] - q["nasa_earth_pct"]) for q in both) / len(both)
    chk = next(r[1] for r in rows if r[0].startswith("Check, 2027")); typ = next(r for r in rows if r[0].startswith("Typical difference"))
    c.ok("Advanced: the verdict shows this site next to NASA's map, and the typical difference over all sites that have both",
         chk == f"{st['sun_pct']:.1f}% / {ridge['nasa_sun_pct']:.1f}% · {st['earth_pct']:.1f}% / {ridge['nasa_earth_pct']:.1f}%" and typ[1] == f"±{gs:.1f} / ±{ge:.1f} percentage points" and f"{len(both)} sites" in typ[0], [chk, typ[1]])
    await page.reload()
    await page.wait_for_function("typeof S !== 'undefined' && S.n > 0 && !document.getElementById('loading')")
    c.ok("the choice is remembered after a reload", await page.evaluate("S.expert"))
    await page.wait_for_function("XD.state === 'ready'", timeout=20000)
    await page.wait_for_timeout(300)
    rows = await page.evaluate(TABLE)

    # ground stations: the stored elevations against plain facts
    d = json.load(open(os.path.join(ROOT, "data", "dsn.json"), encoding="utf-8"))
    r = await page.evaluate("""() => { const g = XD.dsn; let none = 0, bad = 0; for (let k = 0; k < g.n; k++) { let any = false; for (let j = 0; j < 3; j++) { const e = g.el[j * g.n + k]; if (e < -90 || e > 90) bad++; if (e >= g.min) any = true; } if (!any) none++; }
        const up = [0, 1, 2].map(j => { let n = 0; for (let k = 0; k < g.n; k++) if (g.el[j * g.n + k] > 0) n++; return 100 * n / g.n; }); return { none: 100 * none / g.n, bad, up, n: g.n }; }""")
    c.ok("ground stations: three complexes, one value per hour, the Moon above each horizon about half the time", r["bad"] == 0 and r["n"] == d["n"] and all(45 < u < 55 for u in r["up"]), [round(u, 1) for u in r["up"]])
    c.ok("ground stations: hours with no complex in position match the figure on the About screen", abs(r["none"] - d["none_pct"]) < 0.01 and r["none"] < 5, f"{r['none']:.2f}%")
    c.ok("ground stations were checked against an independent library when the file was made", d["check"] and d["check"]["max_gap_deg"] < 0.05 and d["check"]["flips"] == 0, d["check"])

    # slope at lander scale
    xj = json.load(open(os.path.join(ROOT, "data", "expert.json"), encoding="utf-8"))
    g = xj["slope5m"]
    q = g["sites"]["ridge"]["r100"]
    got = next(r[1] for r in rows if r[0].startswith("Slope within 100 m, 5 m map"))
    c.ok("5 m slope row shows the stored values for Connecting Ridge", got == f"{q['typ']:.1f}° / {q['p95']:.1f}° / {q['ok10']}%", got)
    c.ok("5 m maps sit where we think: heights agree with the LOLA 20 m map, and stop agreeing when moved by 100 m", g["check"]["mad_m"] < 2 and g["check"]["mad_shifted_100m"] > 5 * g["check"]["mad_m"], g["check"])
    finer = [k for k, v in g["sites"].items() if v["r500"]["typ"] >= next(q for q in sites if q["id"] == k)["slope"]["typ"]]
    c.ok("a finer map sees more roughness: 5 m slopes are not below the 80 m ones in the same 500 m circle", len(finer) == len(g["sites"]), f"{len(finer)} of {len(g['sites'])} sites")

    # temperature and ice
    x = xj["diviner"]
    await page.evaluate("S.site = 'slater'; renderSite()")
    t = {r[0]: r[1] for r in await page.evaluate(TABLE)}
    s = x["sites"]["slater"]
    c.ok("temperature and ice rows show the stored Diviner values", t["Surface temperature: mean / highest"].startswith(f"{s['tmean']} K / {s['tmax']} K") and t["Depth below which buried ice is stable (model)"] == f"{s['ice']:.2f} m", list(t.items())[-2:])
    c.ok("the orientation of the Diviner maps was pinned down by matching NASA's sunlight map", x["check_r"] > 0.5 and x["ice_check_r"] > 0.5, (x["check_r"], x["ice_check_r"]))
    await page.evaluate("S.site = 'a11'; renderSite()")
    t = {r[0]: r[1] for r in await page.evaluate(TABLE)}
    c.ok("a site outside the Diviner maps says so instead of showing a temperature", t.get("Surface temperature, buried ice") == "no data" and "Surface temperature: mean / highest" not in t)
    csv = (await page.evaluate("S.site = 'ridge', horizonCSV()")).split("\n")
    c.ok("skyline CSV: 720 directions from 0° to 359.5°", len(csv) == 723 and csv[3].startswith("0.0,") and csv[-1].startswith("359.5,"))
    hourly = (await page.evaluate("periodCSV()")).split("\n")
    c.ok("hourly CSV gets the three station columns", hourly[3].endswith("moon_elevation_goldstone_deg,moon_elevation_madrid_deg,moon_elevation_canberra_deg") and len(hourly[4].split(",")) == 12, hourly[4][-30:])
    await page.evaluate("location.hash = '#compare'")
    await page.wait_for_timeout(500)
    cmp_rows = await page.evaluate("[...document.querySelector('.ccard').querySelectorAll('tr')].map(r => r.innerText.replace(/\\s+/g, ' '))")
    c.ok("Compare in Advanced: eleven rows, the last three are 5 m slope, temperature and buried ice", len(cmp_rows) == 11 and cmp_rows[8].startswith("Slope within 100 m") and cmp_rows[9].startswith("Mean temperature") and cmp_rows[10].startswith("Buried ice"), cmp_rows[8:])
    all_rows = await page.evaluate("document.querySelectorAll('#xa-out tr').length - 1")
    await page.click("#xa-out button[data-k='lat']")
    one = await page.evaluate("XA.rows[0].lat")
    await page.click("#xa-out button[data-k='lat']")
    two = await page.evaluate("XA.rows[0].lat")
    ends = await page.evaluate("[Math.min(...S.sites.map(s => s.lat)), Math.max(...S.sites.map(s => s.lat))]")
    c.ok("all sites in one table: 18 rows; a heading sorts, pressing it again turns the order round", all_rows == 18 and sorted([one, two]) == ends, [one, two])
    csv_all = (await page.evaluate("xaCSV()")).split("\n")
    c.ok("all sites as CSV: a note, a heading line and 18 rows of 16 values", len(csv_all) == 20 and all(len(r.split(",")) == 16 for r in csv_all[1:] if '"' not in r), csv_all[2][:80])
    await page.evaluate("location.hash = '#about'")
    await page.wait_for_timeout(400)
    about = await page.evaluate("[[...document.querySelectorAll('#about-body h2')].map(h => h.innerText.split(' ADVANCED')[0].trim()), [...document.querySelectorAll('#about-body .ab-n')].map(e => e.textContent).join('')]")
    c.ok("About in Advanced: the method, the full sources and the Advanced block, lettered in order", "How it is calculated" in about[0] and any(a.startswith("Advanced mode") for a in about[0]) and about[1] == "abcdefgh", about)
    await page.evaluate("location.hash = '#compare'")
    await page.wait_for_timeout(400)

    # list of points: the same place as a named site must give nearly the same year
    await page.evaluate("location.hash = '#sites'")
    await page.fill("#xl-text", "name, lat, lon\nRidge again, -89.4403, 222.719\nnot a line\nEquator, 0, 0")
    await page.click("#xl-run")
    await page.wait_for_function("/calculated/.test(document.getElementById('xl-msg').textContent)", timeout=90000)
    r = await page.evaluate("[XL.rows.map(r => [r.name, r.sun, r.earth, r.terrain]), stats(series('ridge', '10'), Y27, 8760).sun, document.getElementById('xl-msg').textContent]")
    c.ok("list of points: two lines understood, the bad one reported", len(r[0]) == 2 and "3" in r[2], r[2])
    c.ok("list of points: Connecting Ridge by coordinates is within 2 points of the named site (240 m terrain against 20 m)", abs(r[0][0][1] - r[1]) < 2, f"{r[0][0][1]:.1f}% against {r[1]:.1f}%")
    tr = await page.evaluate("XL.rows[0].t && [XL.rows[0].t.tmean, XL.rows[0].t.tmax]")
    c.ok("a point of your own gets its temperature from the 480 m copy of the Diviner maps, close to the exact value at the same place", bool(tr) and abs(tr[0] - x["sites"]["ridge"]["tmean"]) <= 3 and abs(tr[1] - x["sites"]["ridge"]["tmax"]) <= 15, tr)
    rc = x["raster"]["check"]
    c.ok("the 480 m copy was compared with the 240 m maps at the named sites when it was made", rc["sites"] >= 10 and rc["typ_mean_k"] <= 3 and rc["typ_highest_k"] <= 6, rc)

    # base plan on other sites, rover options
    await page.evaluate("location.hash = '#plan'")
    await page.wait_for_timeout(600)
    await page.click("#rover-open")
    await page.wait_for_function("RV.state === 'ready'", timeout=30000)
    n_ridge = await page.evaluate("P.objs.length")
    for sid in ("gerlache", "shackleton"):
        await page.click(f"#plan-sites button[data-s='{sid}']")
        await page.wait_for_function(f"P.site === '{sid}' && RV.state === 'ready'", timeout=30000)
        await page.wait_for_timeout(400)
        r = await page.evaluate("(() => { const R = rvCompute(); return [S.plan.site, P.objs.length, R.fail || null, R.legs ? R.legs[0].r.len : 0, R.legs ? !!R.legs[0].r.dead : null, RV.slope[rvCell(RV.start)] * RV.sq <= RV.maxSlope]; })()")
        c.ok(f"base plan at {sid}: own terrain, example objects, a first route that can be driven", r[0] == sid and r[1] == 3 and r[2] is None and r[3] > 500 and r[5], r)
    await page.click("#plan-sites button[data-s='ridge']")
    await page.wait_for_timeout(400)
    c.ok("going back to Connecting Ridge restores its own objects", await page.evaluate("[P.site, P.objs.length]") == ["ridge", n_ridge])
    r = await page.evaluate("""() => { Object.assign(RV, { start: { e: 60, n: -60 }, goal: { e: -1700, n: 0 }, speed: 0.7, maxSlope: 15, batt: 2, back: false, slow: false }); S.i = 36984; RV.key = "";
        const a = rvCompute().legs[0].r; RV.slow = true; RV.key = ""; const b = rvCompute().legs[0].r; RV.slow = false; RV.key = ""; return [a.time, b.time, a.len / 700]; }""")
    c.ok("rover: 'slower on slopes' makes the same trip take longer; without it time is length / speed", r[1] > r[0] and abs(r[0] - r[2]) < 1e-9, f"{r[0]:.2f} h -> {r[1]:.2f} h")
    await page.evaluate("RV.batt = 0.5; document.getElementById('rv-batt').value = 0.5; RV.key = ''; renderPlan()")
    i0 = await page.evaluate("S.i")
    await page.click("#rv-wait")
    await page.wait_for_function("/moved|No start/.test(document.getElementById('rv-wait-msg').textContent)", timeout=90000)
    r = await page.evaluate("(() => { const R = rvCompute(); return [S.i, !R.legs[0].failed && !R.legs[0].r.dead]; })()")
    c.ok("rover: 'find a later start' moves the clock to an hour at which the battery survives", r[0] > i0 and r[1], f"{r[0] - i0} h later")

    # exact coordinates and the two CSV files of the base plan
    r = await page.evaluate("""() => { const c = planLL(0, 0), n = planLL(0, 1000), e = planLL(1000, 0), R = RM * 1000 * Math.PI / 180;
        const d = (90 + c[0]) * R;
        return [c[0] - S.plan.lat, c[1] - S.plan.lon, (n[0] - c[0]) * R, (e[0] - c[0]) * R - (Math.hypot(d, 1000) - d), (e[1] - c[1]) * R * Math.cos(e[0] * Math.PI / 180) / (Math.atan2(1000, d) * Math.hypot(d, 1000))]; }""")
    c.ok("plan coordinates: the centre is the site itself; 1000 m north is 1000 m further from the pole; 1000 m east is where plane geometry around the pole puts it",
         abs(r[0]) < 1e-9 and abs(r[1]) < 1e-9 and abs(r[2] - 1000) < 2 and abs(r[3]) < 2 and abs(abs(r[4]) - 1) < 0.01, [round(v, 3) for v in r[2:]])
    r = await page.evaluate("""() => { const o = P.objs[0]; P.sel = new Set([o.id]); renderPlan(); const el = document.getElementById("ob-e"), was = [el.disabled, +el.value, Math.round(o.e)];
        el.value = 250; el.dispatchEvent(new Event("change", { bubbles: true })); const rows = layoutCSV().split("\\n").filter(l => l[0] !== "#");
        return [was, P.objs[0].e, rows.length - 1, P.objs.length, rows[0].split(",").length, rows[1].split(",")[3], rows.slice(1).every(l => l.split(",").length === rows[0].split(",").length)]; }""")
    c.ok("base plan: the East field shows the selected object and moves it; the layout CSV has one row per object with the new position",
         r[0][0] is False and r[0][1] == r[0][2] and r[1] == 250 and r[2] == r[3] and r[5] == "250" and r[6], r)
    r = await page.evaluate("""() => { const el = document.getElementById("rv-ge"); el.value = -1500; el.dispatchEvent(new Event("change", { bubbles: true })); RV.batt = 2; RV.key = ""; renderPlan();
        const R = rvCompute(), rows = routeCSV().split("\\n").filter(l => l[0] !== "#"), n = R.legs.reduce((a, l) => a + l.r.path.length, 0), first = rows[1].split(","), last = rows[rows.length - 1].split(",");
        return [RV.goal.e, rows.length - 1, n, +first[2], +first[3], rvE(rvCell(RV.start)), rvN(rvCell(RV.start)), +last[6], R.legs.reduce((a, l) => a + l.r.time, 0), +last[2], rvE(rvCell(RV.goal))]; }""")
    c.ok("rover: the Goal field moves the goal; the route CSV has one row per step, from the start cell to the goal cell, and ends at the trip time",
         r[0] == -1500 and r[1] == r[2] and r[3] == round(r[5]) and r[4] == round(r[6]) and abs(r[7] - r[8]) < 0.002 and r[9] == round(r[10]), r[:3] + [round(r[7], 2)])

    await page.click("#xsw button[data-x='0']")
    await page.wait_for_timeout(300)
    std_cmp = await page.evaluate("(location.hash = '#compare', renderCompare(), [document.querySelector('.ccard').querySelectorAll('tr').length, !document.getElementById('cmp-sum').hidden, document.getElementById('cmp-sum').innerText.slice(0, 12)])")
    await page.evaluate("location.hash = '#site'")
    await page.wait_for_timeout(500)
    words = await page.evaluate(ROWS)
    c.ok("back to Standard: plan at Connecting Ridge, verdict in words again, Compare with five rows and a bottom line",
         await page.evaluate("P.site") == "ridge" and len(words) == 4 and std_cmp == [5, True, "Bottom line."], [words, std_cmp])
    await page.evaluate("location.hash = '#about'")
    await page.wait_for_timeout(400)
    about = await page.evaluate("[[...document.querySelectorAll('#about-body h2')].map(h => h.innerText.trim()), [...document.querySelectorAll('#about-body .ab-n')].map(e => e.textContent).join('')]")
    c.ok("About in Standard: the checks against NASA and a short list of sources stay, the method moves out, letters in order", "Check against NASA maps" in about[0] and "Data and sources" in about[0] and "How it is calculated" not in about[0] and about[1] == "abcdef", about)
    await page.evaluate("location.hash = '#sites'")
    await page.wait_for_timeout(500)
    sorts = await page.evaluate("document.querySelectorAll('#sort-seg button').length")
    await page.evaluate("location.hash = '#plan'")
    await page.wait_for_timeout(600)
    shown = await page.evaluate(f"[({SHOWN})('#pl-seg'), ({SHOWN})('#p-seg-3'), ({SHOWN})('#load'), ({SHOWN})('#checks .totals .tile'), ({SHOWN})('#rv-back'), ({SHOWN})('#rv-slow')]")
    shown += await page.evaluate(f"[({SHOWN})('#ob-e'), ({SHOWN})('#pl-save'), ({SHOWN})('#rv-se'), ({SHOWN})('#rv-save')]")
    c.ok("Standard: two ways to sort; base plan without sunlight layer, period, kilowatts, coordinate fields and CSV; rover without the way back", sorts == 2 and shown == [0, 0, 0, 4, 0, 0, 0, 0, 0, 0], [sorts, shown])
    c.ok("no script errors", not page.errors, page.errors[:3])
    await page.context.close()

    # every screen in Advanced, phone to wide monitor
    for w, h in ((360, 700), (390, 800), (768, 1024), (1440, 900)):
        page = await open_site(browser, "home", w, h, mobile=w < 500, query="?x=1", wait=800)
        over = []
        for v in ("home", "sites", "site", "compare", "plan", "about"):
            await page.evaluate(f"location.hash = '#{v}'")
            await page.wait_for_timeout(900)
            o = await page.evaluate("document.documentElement.scrollWidth - innerWidth")
            if o > 0:
                over.append((v, o))
        c.ok(f"Advanced at {w} px: six screens, no sideways scroll, no errors", not over and not page.errors, over or page.errors[:2])
        await page.context.close()
    return c
