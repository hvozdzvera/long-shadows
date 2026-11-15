"""Base plan: objects can be placed, moved and removed, and the checks react."""
from harness import Checks, open_site


async def run(browser):
    c = Checks("Base plan")
    page = await open_site(browser, "plan")
    n0 = await page.evaluate("P.objs.length")
    box = await page.locator("#plan-cv").bounding_box()
    await page.click("[data-tool=m20]")
    await page.mouse.click(box["x"] + box["width"] * 0.2, box["y"] + box["height"] * 0.3)
    c.ok("a click with the tower tool places a tower and selects it", await page.evaluate("P.objs.length") == n0 + 1 and await page.evaluate("P.sel.size") == 1)
    before = await page.evaluate("(() => { const o = P.objs[P.objs.length - 1]; return [o.e, o.n]; })()")
    await page.keyboard.press("ArrowUp")
    after = await page.evaluate("(() => { const o = P.objs[P.objs.length - 1]; return [o.e, o.n]; })()")
    c.ok("arrow keys move the selected object north", after[1] > before[1] and after[0] == before[0], f"{before} -> {after}")
    await page.keyboard.press("Delete")
    c.ok("Delete removes it", await page.evaluate("P.objs.length") == n0)

    # the shading check itself: a 5 m mast alone loses nothing; a 20 m tower 30 m away takes part of its sunlight
    # (over a lunar day the Sun passes behind the tower whichever side it stands on)
    r = await page.evaluate("""() => { const mk = (id, type, e, n) => Object.assign({}, OBJ[type], { id, type, e, n });
        P.objs = [mk(901, "m5", 0, 0)]; P.sel.clear(); P.cleared = true; P.dirty = true; renderPlan();
        const a = P.res.R.get(901), alone = [a.sunT, a.sunAfter, a.loss.size];
        P.objs.push(mk(902, "m20", 30, 0)); P.dirty = true; renderPlan();
        const b = P.res.R.get(901); return { alone, sunT: b.sunT, after: b.sunAfter, by: [...b.loss.keys()] }; }""")
    c.ok("a mast standing alone loses no sunlight to other objects", r["alone"][0] > 0 and r["alone"][0] == r["alone"][1] and r["alone"][2] == 0, r["alone"])
    c.ok("a 20 m tower 30 m away takes sunlight from a 5 m mast, and the check names the tower", r["after"] < r["sunT"] and r["by"] == [902], f"{100 * (1 - r['after'] / r['sunT']):.0f}% of its sunlight lost")
    c.ok("no script errors", not page.errors, page.errors[:3])
    await page.context.close()
    return c
