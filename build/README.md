# build/

Python scripts that turn the NASA files into the small files in `data/`. They are kept as they were run during the hackathon. Two environment variables say where things are (see `paths.py`): `LS_NASA_DIR` is the folder with the downloaded NASA files (`LDEM_*.IMG`, `AVGVISIB_*.IMG`, the 5 m site maps, the Diviner maps), `LS_DATA_DIR` is the site's `data/` folder (default `../data`). Run the scripts from this folder.

```
export LS_NASA_DIR=/path/to/nasa-files
cd build && python3 slopes5m.py
```

| Script | Makes |
|---|---|
| `paths.py` | where the NASA files and the site's data folder are |
| `dem.py` | reader for LOLA polar maps (shared by the others) |
| `ephem.py`, `make_ephem_long.py` | hourly Sun and Earth directions, Aug 2023 – Dec 2028 (`ephem.json`) |
| `horizon.py`, `compute_sites.py`, `sites.py` | skyline and statistics of every site (`sites.json`) |
| `slopes.py`, `psr.py`, `regions.py` | ground slope, nearest permanent shadow, Artemis regions |
| `tiles.py`, `hz_browser.py` | terrain tiles for points you click, and the check of the browser method |
| `export_maps.py`, `pole_hi.py` | map pictures and pole heights |
| `plan_v4.py`, `plan_contours.py`, `lightmap.py` | base-plan terrain, contours and sunlight layer |
| `rover_data.py`, `rover_check.py` | rover map, and the independent rover model used by the tests |
| `finalize_data.py` | packs binary results into JSON |
| `diviner.py` | Advanced: temperature and ice depth at the sites (`expert.json`) and a 480 m copy of the maps for points of your own (`diviner_480m.png`), with the orientation check |
| `slopes5m.py` | Advanced: slope at lander scale from the LOLA 5 m site maps, with the check of their position |
| `dsn.py` | Advanced: elevation of the Moon at the three Deep Space Network complexes (`dsn.json`), with the astropy check |
| `more_sites.sh` | Advanced: plan and rover data for more sites (`plan_<site>.json`, `rover_<site>.json`, …); the plan and rover scripts take the site from `LS_SITE` |
