"""Run every test: python3 tests/run.py   (add a name to run one group, e.g. python3 tests/run.py rover)"""
import asyncio
import importlib
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright  # noqa: E402
from harness import CHROMIUM_ARGS  # noqa: E402

GROUPS = ["numbers", "screens", "links", "plan", "rover", "tour", "expert"]


async def main():
    wanted = [g for g in GROUPS if not sys.argv[1:] or g in sys.argv[1:]]
    failed = total = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=CHROMIUM_ARGS)
        for g in wanted:
            t = time.time()
            checks = await importlib.import_module("test_" + g).run(browser)
            print(f"\n{checks.title}  ({time.time() - t:.0f} s)")
            for name, passed, detail in checks.rows:
                total += 1
                failed += not passed
                print(f"  {'PASS' if passed else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))
        await browser.close()
    print(f"\n{total - failed} of {total} checks passed")
    sys.exit(1 if failed else 0)


asyncio.run(main())
