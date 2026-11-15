"""Every screen opens without errors and never scrolls sideways, from a phone to a wide monitor."""
from harness import Checks, open_site

VIEWS = ["home", "sites", "site", "compare", "plan", "about"]
WIDTHS = [(360, 700), (390, 800), (768, 1024), (1107, 726), (1440, 900), (1920, 1080)]


async def run(browser):
    c = Checks("Screens")
    for w, h in WIDTHS:
        page = await open_site(browser, "home", w, h, mobile=w < 500, wait=800)
        over = []
        for v in VIEWS:
            await page.evaluate(f"location.hash = '#{v}'")
            await page.wait_for_timeout(900)
            o = await page.evaluate("document.documentElement.scrollWidth - innerWidth")
            if o > 0:
                over.append((v, o))
        c.ok(f"{w} px wide: six screens, no sideways scroll, no errors", not over and not page.errors, over or page.errors[:2])
        await page.context.close()

    # the Horizon screen with every site, height and period, at phone width (long numbers must not push the page wider)
    page = await open_site(browser, "site", 390, 800, mobile=True)
    bad = await page.evaluate("""() => { const bad = [];
        for (const s of S.sites) for (const H of ["2", "10", "20"]) for (const per of ["day", "q", "y"]) for (const t of [0, 20000, 36984, S.n - 1]) {
            S.site = s.id; S.H = H; S.period = per; S.i = S.t0 = t; renderSite();
            const o = document.documentElement.scrollWidth - innerWidth; if (o > 0) bad.push([s.id, H, per, t, o]); }
        for (const m of REPLAY) { applyReplay(m.id); renderSite(); if (document.documentElement.scrollWidth > innerWidth) bad.push(["replay", m.id]); }
        return bad; }""")
    c.ok("Horizon at 390 px: 18 sites x 3 heights x 3 periods x 4 dates and every replay fit the screen", not bad and not page.errors, bad[:4] or page.errors[:2])
    text = await page.evaluate("document.querySelector('main').innerText")
    c.ok("no 'NaN', 'undefined' or 'Infinity' in the text", not any(w in text for w in ("NaN", "undefined", "Infinity")))
    await page.context.close()

    # first screen and the list of sites
    for w, h in ((1440, 900), (390, 800)):
        page = await open_site(browser, "home", w, h, mobile=w < 500, wait=800)
        r = await page.evaluate("""() => { const t = document.getElementById("door-tour").getBoundingClientRect(), others = [...document.querySelectorAll("#v-home .cta .btn")].map(b => b.getBoundingClientRect());
            return [t.width > 0 && t.bottom <= innerHeight, others.every(b => b.top >= t.bottom - 1), t.height >= Math.max(...others.map(b => b.height)), /Standard/.test(document.querySelector(".mode-note").innerText) && /Advanced/.test(document.querySelector(".mode-note").innerText)]; }""")
        c.ok(f"{w} px, first screen: the tour is the first and largest button, seen without scrolling; one line says what the two modes are", all(r), r)
        await page.click("#door-plan")
        await page.wait_for_timeout(900)
        c.ok(f"{w} px, first screen: the second large button opens the base plan", await page.evaluate("location.hash") == "#plan")
        await page.evaluate("location.hash = '#site'")
        await page.wait_for_timeout(900)
        r = await page.evaluate("['.pano-box', '.timebar', '.controls', '#verdict'].map(q => { const b = document.querySelector('#v-site ' + q).getBoundingClientRect(); return [Math.round(b.top + scrollY), Math.round(b.left)]; })")
        if w < 500:
            c.ok(f"{w} px, Horizon: the picture comes first, then the time controls, the settings and the verdict", r[0][0] < r[1][0] < r[2][0] < r[3][0], [q[0] for q in r])
        else:
            c.ok(f"{w} px, Horizon: the settings stand to the left of the picture, level with it", r[2][1] < r[0][1] and abs(r[2][0] - r[0][0]) < 4, r)
        await page.evaluate("location.hash = '#sites'")
        await page.wait_for_timeout(900)
        r = await page.evaluate("[[...document.querySelectorAll('.srow > p')].filter(e => e.getClientRects().length).length, document.querySelectorAll('.srow').length, [...document.querySelectorAll('#chips button')].map(b => b.textContent.trim())]")
        want = 1 if w < 500 else r[1]
        c.ok(f"{w} px, list of sites: " + ("only the chosen site keeps its description" if w < 500 else "every site has its description") + "; filters carry plain names",
             r[0] == want and r[1] == 18 and "Commercial landers" in r[2] and "Other countries" in r[2], [r[0], r[1], r[2]])
        await page.context.close()
    return c
