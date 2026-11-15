# Tests

The tests open the site in a headless browser straight from this folder (no web server) and check it the way a visitor would use it.

```
pip install playwright pillow
playwright install chromium
python3 tests/run.py            # everything, about 2 minutes
python3 tests/run.py rover      # one group
```

| Group | What it checks |
|---|---|
| `numbers` | Sunlight, Earth visibility and longest night computed in the browser equal the figures of the Python pipeline for all 18 sites at three heights; sunlight is close to NASA's LOLA illumination maps; Chandrayaan-3 sunset falls on 4 Sep 2023; ground slope at the IM-1 site is close to the 12° reported by the LRO camera team. |
| `screens` | Six screens at six widths from 360 to 1920 px: no script errors and no sideways scroll. The Horizon screen is swept through every site, height, period and replay at phone width. The first screen puts the tour first; the list of sites is short on a phone. |
| `links` | A link restores the whole view; a broken link falls back to safe values. |
| `plan` | Objects can be placed, moved and removed; a tower put between a mast and the Sun takes sunlight from the mast. |
| `rover` | Route search and battery model against `rover_reference.json`, which is produced by an independent Python model (`build/rover_check.py`); then 40 random scenarios checked against rules every route must obey. |
| `expert` | Advanced mode: the switch, 5 m slope, stations, temperature and ice, skyline CSV, list of points, base plan on two more sites, exact coordinates, layout and route as CSV, rover options; Standard stays free of all of them. |
| `tour` | The seven-step tour on desktop and phone: right screen at every step, target marked, card inside the screen; Finish, Esc and manual navigation end it. |

The exit code is 0 when every check passes, so the same command can run in CI.

What the tests cannot see: a real phone, browsers other than Chromium, and the graphics-card path of the terrain shading (the tests use software WebGL).
