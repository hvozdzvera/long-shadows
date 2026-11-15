"""Guided tour: seven steps, each on the right screen with its target marked; Finish, Esc and manual navigation end it."""
from harness import Checks, open_site

EXPECT = ["#sites", "#site", "#site", "#site", "#compare", "#plan", "#plan"]


async def run(browser):
    c = Checks("Guided tour")
    for w, h, mobile in ((1440, 900, False), (390, 800, True)):
        page = await open_site(browser, "home", w, h, mobile)
        await page.click("#door-tour")
        seen = []
        for k in range(7):
            await page.wait_for_timeout(1800 if k == 6 else 700)
            seen.append(await page.evaluate("""() => { const card = document.getElementById("tour").getBoundingClientRect();
                return [location.hash, !!document.querySelector(".tour-hl"), card.left >= 0 && card.right <= innerWidth + .5 && card.bottom <= innerHeight + .5, document.documentElement.scrollWidth - innerWidth]; }"""))
            await page.click("#tour-next")
        await page.wait_for_timeout(400)
        c.ok(f"{w} px: seven steps on the right screens, target marked, card inside the screen", [s[0] for s in seen] == EXPECT and all(s[1] and s[2] and s[3] <= 0 for s in seen), [s[0] for s in seen])
        end = await page.evaluate("[location.hash, document.getElementById('tour').hidden, document.querySelectorAll('.tour-hl').length, RV.open]")
        c.ok(f"{w} px: Finish returns to the first screen and leaves nothing behind", end == ["#home", True, 0, False] and not page.errors, end)
        await page.context.close()

    page = await open_site(browser, "home")
    await page.click("#door-tour")
    await page.wait_for_timeout(600)
    await page.keyboard.press("Escape")
    c.ok("Esc ends the tour", await page.evaluate("document.getElementById('tour').hidden"))
    await page.evaluate("location.hash = '#home'")          # the first step had moved to the map
    await page.wait_for_timeout(500)
    await page.click("#door-tour")
    await page.wait_for_timeout(600)
    await page.click('nav.keys a[href="#about"]')
    await page.wait_for_timeout(500)
    c.ok("going to another screen by hand ends the tour", await page.evaluate("document.getElementById('tour').hidden") and not page.errors)
    await page.context.close()
    return c
