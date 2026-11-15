"""Shared part of the tests: opens the site in headless Chromium straight from the repository folder.

No web server is needed: every request of the page is answered from disk.
Google Fonts are replaced by an empty stylesheet, so the tests also run offline.
"""
import mimetypes
import os
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "http://longshadows.test/"
URL = HOST + "index.html"
# software WebGL, so that the 3D views and the terrain shading also work on a machine without a graphics card
CHROMIUM_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


async def open_site(browser, view="home", width=1440, height=900, mobile=False, query="", wait=2000):
    """Open one screen of the site. Returns the page; page.errors collects script errors."""
    ctx = await browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce",
                                    is_mobile=mobile, has_touch=mobile, device_scale_factor=1)

    async def from_disk(route):
        path = os.path.realpath(os.path.join(ROOT, unquote(urlparse(route.request.url).path.lstrip("/"))))
        if path.startswith(ROOT) and os.path.isfile(path):
            await route.fulfill(path=path, content_type=mimetypes.guess_type(path)[0] or "application/octet-stream")
        else:
            await route.fulfill(status=404, body="")

    await ctx.route(HOST + "**", from_disk)
    await ctx.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
    page = await ctx.new_page()
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)[:300]))
    page.on("console", lambda m: page.errors.append(m.text[:300]) if m.type == "error" else None)
    await page.goto(URL + query + "#" + view)
    await page.wait_for_function("typeof S !== 'undefined' && S.n > 0 && !document.getElementById('loading')", timeout=30000)
    await page.wait_for_timeout(wait)
    return page


class Checks:
    """Collects named checks; run.py prints them and sets the exit code."""

    def __init__(self, title):
        self.title, self.rows = title, []

    def ok(self, name, passed, detail=""):
        self.rows.append((name, bool(passed), str(detail)))
        return bool(passed)
