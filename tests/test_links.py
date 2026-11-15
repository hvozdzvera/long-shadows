"""The address remembers the view, and a broken address does not break the site."""
from harness import Checks, open_site


async def run(browser):
    c = Checks("Links")
    page = await open_site(browser, "site", query="?site=malapert&t=2026-01-05T07&now=2026-01-09T12&p=q&h=20&cmp=ridge.malapert")
    got = await page.evaluate("[S.site, dateStr(S.t0), dateStr(S.i), S.period, S.H, S.compare.join('.')]")
    c.ok("a link restores site, landing date, shown hour, period, height and comparison",
         got[0] == "malapert" and got[1].startswith("2026-01-05T07") and got[2].startswith("2026-01-09T12") and got[3:] == ["q", "20", "ridge.malapert"], got)
    await page.context.close()

    page = await open_site(browser, "site", query="?site=nosuch&t=1999-01-01T00&p=zz&h=7")
    got = await page.evaluate("[S.site, S.period, S.H, S.i >= 0 && S.i < S.n]")
    c.ok("unknown site, date outside the data and wrong options fall back to safe values", got[0] in await page.evaluate("S.sites.map(s => s.id)") and got[1] in ("day", "q", "y") and got[2] in ("2", "10", "20") and got[3] and not page.errors, got)
    await page.context.close()

    page = await open_site(browser, "nonsense")
    c.ok("an unknown screen name opens the first screen", await page.evaluate("curView()") == "home" and not page.errors)
    await page.context.close()
    return c
