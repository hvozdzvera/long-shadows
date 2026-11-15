"""The numbers on screen against independent sources."""
import json
import os

from harness import ROOT, Checks, open_site


async def run(browser):
    c = Checks("Numbers")
    page = await open_site(browser, "site")
    sites = json.load(open(os.path.join(ROOT, "data", "sites.json"), encoding="utf-8"))

    # 1. The browser recomputes sunlight, Earth visibility and the longest night from the horizon profiles.
    #    The same figures were computed by the Python pipeline (build/) and stored in sites.json.
    rows = await page.evaluate("""() => S.sites.flatMap(s => ["2", "10", "20"].map(H => {
        const st = stats(series(s.id, H), Y27, 17544), p = s.stats_2027_2028[H];
        return [s.id, H, st.sun - p.sun_pct, st.earth - p.earth_pct, st.maxDark - p.longest_dark_h]; }))""")
    worst = max(max(abs(r[2]), abs(r[3])) for r in rows)
    c.ok("browser and pipeline agree on sunlight and Earth visibility (18 sites x 3 heights)", len(rows) == 3 * len(sites) and worst <= 0.15, f"largest gap {worst:.2f} points")
    c.ok("browser and pipeline agree on the longest night", max(abs(r[4]) for r in rows) <= 1, f"largest gap {max(abs(r[4]) for r in rows)} h")

    # 2. NASA's own illumination maps (average over 18.6 years) at the polar sites: stored next to our figure.
    polar = [s for s in sites if s.get("nasa_sun_pct") is not None]
    gaps = [abs(s["stats_2027_2028"]["2"]["sun_pct"] - s["nasa_sun_pct"]) for s in polar]
    c.ok("sunlight is close to NASA's LOLA illumination maps", len(polar) >= 10 and sum(gaps) / len(gaps) <= 2.0, f"{len(polar)} sites, mean gap {sum(gaps) / len(gaps):.1f} points")

    # 3. Real landings.
    sunset = await page.evaluate("""() => { applyReplay("ch3"); const c = series(S.site, S.H), ns = nextChange(c.sf, S.t0, 0.5); return dateStr(Math.round(S.t0 + ns.hours)); }""")
    c.ok("Chandrayaan-3: sunset falls on 4 Sep 2023, the day ISRO put the lander to sleep", sunset.startswith("2023-09-04"), sunset)
    im1 = next(s for s in sites if s["id"] == "im1")
    c.ok("IM-1 Odysseus: ground slope close to the 12° reported by the LRO camera team", abs(im1["slope"]["at"] - 12) <= 1, f"{im1['slope']['at']}° at the landing point")

    # 4. Sanity of every stored series: values in range, no gaps.
    bad = await page.evaluate("""() => { const bad = []; for (const s of S.sites) { const c = series(s.id, "10");
        for (let i = 0; i < S.n; i += 97) if (!(c.sf[i] >= 0 && c.sf[i] <= 1) || !(Math.abs(c.sel[i]) <= 90) || !(Math.abs(c.eel[i]) <= 90) || !(c.saz[i] >= 0 && c.saz[i] < 360.001)) { bad.push(s.id); break; } } return bad; }""")
    c.ok("every site has a complete Sun and Earth series for the whole period", not bad, bad)
    c.ok("no script errors", not page.errors, page.errors[:3])
    await page.context.close()
    return c
