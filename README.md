# Long Shadows

**Where and when a base at the lunar south pole gets light and a line to Earth.**

NASA Space Apps Challenge 2026 · challenge *Lunar Landing Site Navigator* · solo entry by Vera Hvozdz

Live site: **https://hvozdzvera.github.io/long-shadows/**

At the Moon's south pole the Sun never climbs above 1.6°, so a hill a few kilometres away decides whether a lander has power. Long Shadows shows, for 18 landing sites and for any point you click, the Sun and Earth moving over the real skyline, and turns that into a plain verdict for a chosen landing date: how long the sunlight lasts, whether Earth is in view, how steep the ground is, how far the nearest permanent shadow lies. On top of that it lets you lay out a base on real terrain, see which mast shades which, and send a rover round the shadow that would empty its battery.

The tool is meant for quick comparison of sites and dates and for teaching. It is not a mission design tool: see *Limits* on the About screen.

## Judge guide: the tool in 60 seconds

Open the site and press **▶ Start here** on the first screen. The tour takes you through these seven steps; each can also be reached by hand.

| # | Screen | What to look at |
|---|---|---|
| 1 | **01 Map** | Eighteen sites near the south pole: NASA's nine Artemis regions, commercial landers, real landings. The amber layer is NASA's map of average sunlight. Click anywhere to analyse your own point. |
| 2 | **02 Horizon** | Connecting Ridge on 20 Oct 2027. The pale line is the real skyline from LOLA; the Sun and Earth travel along it. Press ▶ to watch a lunar day. |
| 3 | **02 Horizon**, verdict | For a landing at that moment: how long the sunlight lasts, whether Earth is in view, how steep the ground is, how far the nearest permanent shadow lies. |
| 4 | **02 Horizon**, replay | Choose *Chandrayaan-3*. The tool puts sunset on 4 Sep 2023, the day ISRO put the lander to sleep. |
| 5 | **03 Compare** | Three sites on one date, row by row; or one site on three dates, to see what a slipped launch costs. |
| 6 | **04 Base plan** | Place solar masts and antennas on real terrain. The checks show which mast shades which, and what blocks the line to Earth. |
| 7 | **04 Base plan**, rover | Press *Plan a rover route*. The shortest way crosses a shadow that would empty the battery, so the route goes round along the sunlit ridge. |

**Where the numbers are checked:** screen **05 About**, block *Check against NASA maps*.

- Sun and Earth directions against JPL Horizons: largest gap 0.0007°.
- Sunlight against NASA's LOLA illumination maps at 15 sites: 1.3 points on average, correlation 0.99.
- Ground slope at the IM-1 site: 11.5° here, 12° reported by the LRO camera team.
- Rover lighting rule against the full calculation: same answer in 99.75% of 1,059,960 cell-hours.

## Advanced mode

The switch **Standard / Advanced** in the header changes the depth, not the calculations. **Standard** explains: a verdict in plain words with a one-line bottom line, notes on the pictures, the few figures that matter most. **Advanced** is the working tool: the same results as tables of exact figures with their sources, more data, more controls. What Advanced adds carries the mark *Advanced*.

| Where | What Advanced adds |
|---|---|
| **02 Horizon**, verdict | The verdict as a table of figures with sources. Ground slope at lander scale from NASA's 5 m map of the site, for the six sites that have one. Which NASA Deep Space Network complex (Goldstone, Madrid, Canberra) has the Moon in its sky at that hour; surface temperature and the depth at which buried ice would last (LRO Diviner maps). |
| **02 Horizon**, below | All five summary figures and the energy estimate; the hourly table as CSV with three station columns; the skyline of the site as CSV, 720 directions. |
| **03 Compare** | Six more rows (link gap, highest Sun, permanent shadow, slope at lander scale, temperature, buried ice) and every site in one sortable table with CSV. |
| **05 About** | The full method and the full list of sources. |
| **01 Map** | Five ways to sort the list. A list of your own points (name, latitude, longitude): each is calculated for the whole of 2027, gets temperature and ice south of 80° S, and can be opened on the Horizon screen. |
| **04 Base plan** | The plan and the rover on two more sites: de Gerlache Rim 2 and the peak near Shackleton. The sunlight layer, the choice of period, kilowatts and battery size. Exact position of the selected object in metres from the centre, and the whole layout as CSV with latitude and longitude. |
| **04 Base plan**, rover | The way back, *Slower on slopes*, and *Find a later start*: the first hour in the next 14 days at which the battery survives the trip. Start and goal typed in metres, and the route as CSV: every step with its position, time, light and battery. |

Checks of the added parts: heights of the 5 m map against the LOLA 20 m map at 4,000 points, typical difference 0.7 m (11 m when the map is moved by 100 m); Moon elevation at the three complexes against the astropy library at 1,200 station-hours, largest gap 0.004°; orientation of the Diviner maps found by matching NASA's sunlight map (correlation 0.69 for the right one, at most 0.18 for the other seven); rover lighting rule on the two new sites, 99.80% and 99.72% of cell-hours equal to the full calculation. Details are on the About screen in Advanced mode.

## Who did what

Vera Hvozdz, architecture student, Minsk (solo team). I was responsible for the idea, the product design, the UX and interface design, setting the tasks for the calculations, QA testing and deployment of the project. The calculation algorithms and the code were implemented with Claude (by Anthropic) under my direction. Every figure comes from the NASA data listed below, and every number the tool shows is checked against an independent source (see *Where the numbers are checked* above).

## NASA data used

- **LRO LOLA** gridded elevation: `LDEM_60S_240M`, `LDEM_80S_80M`, `LDEM_875S_20M` (NASA PDS). Skylines, slopes, the base plan and the rover map are computed from these.
- **LOLA average visibility maps** `AVGVISIB_65S_240M` (Sun and Earth): the map layers, the permanent-shadow distances and the check of our sunlight figures.
- **JPL DE421** ephemeris for the directions to the Sun and Earth, checked against **JPL Horizons**.
- **USGS / NASA** outlines of the nine Artemis III candidate regions.
- **NASA SVS CGI Moon Kit** (LROC WAC colour map) for the globe.
- **LOLA 5 m site maps** of south-pole landing sites (Barker et al. 2021, *Planetary and Space Science* 203), slope files, used in Advanced mode.
- **LRO Diviner** polar maps of temperature and ice stability (Schorghofer & Williams 2020, *Planetary Science Journal* 1, 54), used in Advanced mode.
- Positions of the three **Deep Space Network** complexes, used in Advanced mode.

Full references are on the About screen, block *Data and sources*.

## How it is built

Everything the site shows is computed in two places:

1. **Before publishing**, Python scripts in `build/` read the NASA files and write the small files in `data/`: the hourly Sun and Earth directions (`ephem.json`), the skyline of each site at three heights with slopes and shadow distances (`sites.json`), terrain tiles for points you click (`terrain_*.png`), the base-plan terrain (`plan.json`), the rover map (`rover.json`, `rover_hz.png`) and the map pictures.
2. **In the browser**, plain JavaScript without a framework and without a build step combines them for the chosen site, date and height. The only library is three.js for the two 3D views.

```
index.html      the page
css/style.css   styles
js/             the program, cut into 24 files that are loaded in order (00-state.js … 23-main.js)
data/           data computed from NASA files
vendor/         three.js r128 (MIT)
build/          Python scripts that make data/ from the NASA files
tests/          automatic checks, see tests/README.md
```

### What loads when

| When | What | Size |
|---|---|---|
| First screen | page, styles, scripts, Sun and Earth directions for 2023–2028, site list, pole heights | 2.6 MB |
| Right after it, in the background | three map layers | 0.7 MB |
| Same, on screens wider than a phone | sharper pole heights for the first picture and the 3D view | 3.9 MB |
| Opening the globe | three.js and the Moon picture | 1.6 MB (0.6 MB on a phone) |
| Clicking your own point | terrain tiles at 240 m and 960 m per pixel | 3.8 MB |
| Opening the rover window | skyline of 10,000 cells | 0.9 MB |
| Switching to Advanced | station table, temperature and ice | 0.1 MB |
| Advanced: a point of your own south of 80° S | temperature and ice maps at 480 m per pixel | 1.9 MB |
| Advanced: another site on the base plan | its terrain, and its rover map when the rover window is open | 0.1 MB + 0.8 MB |

Text files are counted as a server sends them (gzip). Nothing else is downloaded: the Horizon, Compare, Base plan and About screens work from what the first screen has already loaded.

## Accessibility

- Checked with axe-core 4.14 (WCAG 2.1 A and AA plus best practices) on eleven states of the site at desktop and phone width: no issues left.
- Every control can be reached and used from the keyboard, the focus is always visible, the tour can be walked with Enter and closed with Esc, and animations stop when the system asks for reduced motion.
- The 3D views turn with the arrow keys and zoom with plus and minus. On the base plan, placed objects can be selected from the list, moved with the arrow keys and removed with Delete.
- Known gap: placing a new object on the base plan and setting the rover's start and goal need a pointer (mouse or touch).

## Run it

The site is static. Any web server will do:

```
python3 -m http.server 8000      # then open http://localhost:8000
```

Opening `index.html` as a local file does not work, because browsers do not let a page read data files from disk.

To make `data/` again from the NASA files, download the files listed in [build/README.md](build/README.md) into one folder, set the paths at the top of each script to that folder, and run the scripts in the order of that table (`pip install numpy scipy pillow scikit-image matplotlib tifffile jplephem de421 astropy`). The site itself needs none of this: `data/` is already in the repository.

## History

The site was written during the hackathon weekend as one working file outside GitHub, and was cut into the files of this repository at the end. That is why the commit history here is short; the steps of the work are described in *Who did what* above.

## Tests

```
pip install playwright pillow && playwright install chromium
python3 tests/run.py
```

The tests compare the browser with the Python pipeline and with an independent rover model, sweep every screen at six widths, and walk through the tour. Details: [tests/README.md](tests/README.md).

## Licence

Code: Apache License 2.0, see [LICENSE](LICENSE). NASA data is in the public domain. three.js: MIT. Fonts B612 and B612 Mono: SIL Open Font License.
