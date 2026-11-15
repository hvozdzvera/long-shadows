"""Data for the rover route on the Base plan (4 km box at Connecting Ridge, 40 m cells, plan frame: up = north, right = east).
1. rover_hz: for every cell, the skyline 2 m above the ground in 360 directions (1 deg bins).
   Directions are measured in the plan's own frame (the frame of the box centre); elevations from the cell's own horizontal.
2. rover_slope: mean ground slope in the cell, from the LOLA 20 m map (rise over 40 m).
Run:  python3 rover_data.py part 0 2 &  python3 rover_data.py part 1 2 ;  python3 rover_data.py join 2"""
import sys, json, time, numpy as np
sys.path.insert(0, '.')
from dem import PolarDEM
import os
SITE = os.environ.get('LS_SITE', 'ridge'); SUF = '' if SITE == 'ridge' else '_' + SITE          # which site the box is centred on; files of other sites carry its id
import hz_browser as hb
D = "/mnt/user-data/uploads/Астрономия/SpaceApps2026/"
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)
RM = 1737400.0
ridge = next(s for s in json.load(open('sites_out.json')) if s['id'] == SITE)
x0, y0 = ultra.ll2xy(ridge['lat'], ridge['lon']); nrm = np.hypot(x0, y0)
nx, ny = x0 / nrm, y0 / nrm; ex, ey = ny, -nx
G, L, HOBS = 100, 4000.0, 2.0
g = (np.arange(G) + 0.5) * (L / G) - L / 2
def frame(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]); east = np.array([-np.sin(lo), np.cos(lo), 0]); return up, east, np.cross(up, east)
UPC, EC, NC = frame(ridge['lat'], ridge['lon'])
d = [14.0]
while d[-1] < 300e3: d.append(d[-1] + max(14.0, d[-1] * 0.015))
d = np.array(d); near = d < 6000
b = np.radians(np.arange(720) * 0.5)[:, None]
def binmax(az, el):
    best = np.full(720, -90.0); np.maximum.at(best, (az / 0.5).astype(int).ravel() % 720, el.ravel())
    bad = best <= -89
    if bad.any(): good = np.where(~bad)[0]; best[bad] = np.interp(np.where(bad)[0], good, best[good], period=720)
    return best
def horizons(e, n):
    """skyline of the cell at (e, n): in the plan frame and in the cell's own true-north frame (for checking)"""
    x, y = x0 + e * ex + n * nx, y0 + e * ey + n * ny
    lat, lon = ultra.xy2ll(x, y); lat = float(lat); lon = float(lon)
    up, east, north = frame(lat, lon)
    O = (RM + float(ultra.height(x, y)) + HOBS) * up
    px = x + d[None, :] * np.sin(b); py = y + d[None, :] * np.cos(b)
    h = np.empty(px.shape)
    h[:, near] = ultra.height(px[:, near], py[:, near]); h[:, ~near] = hb.sample(px[:, ~near], py[:, ~near])
    ok = ~np.isnan(h)
    P = (RM + np.where(ok, h, 0))[..., None] * hb.unit_xy(px, py); V = P - O; dist = np.linalg.norm(V, axis=-1)
    el = np.where(ok, np.degrees(np.arcsin((V @ up) / dist)), -90)
    plan = binmax(np.degrees(np.arctan2(V @ EC, V @ NC)) % 360, el)
    own = binmax(np.degrees(np.arctan2(V @ east, V @ north)) % 360, el)
    return plan, own, lat, lon
if __name__ == "__main__" and sys.argv[1] == "part":
    k, m = int(sys.argv[2]), int(sys.argv[3]); rows = [r for r in range(G) if r % m == k]
    HZ = np.zeros((len(rows), G, 720), np.float32); OWN = {}; t = time.time()
    for a, r in enumerate(rows):
        for c in range(G):
            plan, own, lat, lon = horizons(g[c], -g[r]); HZ[a, c] = plan
            if r % 9 == 4 and c % 9 == 4: OWN[(r, c)] = (own.astype(np.float32), lat, lon)
        if a % 5 == 0: print(k, a, len(rows), round(time.time() - t), 's', flush=True)
    np.savez(f'rover{SUF}_part{k}.npz', rows=np.array(rows), hz=HZ, own_keys=np.array(list(OWN.keys())), own_hz=np.array([v[0] for v in OWN.values()]), own_ll=np.array([[v[1], v[2]] for v in OWN.values()]))
    print('part done', k, round(time.time() - t), 's')
if __name__ == "__main__" and sys.argv[1] == "join":
    import base64
    from PIL import Image
    from ephem import azel
    m = int(sys.argv[2]); HZ = np.zeros((G, G, 720), np.float32); OWN = {}
    for k in range(m):
        z = np.load(f'rover{SUF}_part{k}.npz'); HZ[z['rows']] = z['hz']
        for key, hz, ll in zip(z['own_keys'], z['own_hz'], z['own_ll']): OWN[tuple(int(v) for v in key)] = (hz, ll)
    H1 = HZ.reshape(G, G, 360, 2).mean(-1)                       # 1 deg bins: bin j covers [j, j+1) deg, value = mean of its two half-degree bins
    Q, OFF = 0.05, 4.0
    q = np.clip(np.round((H1 + OFF) / Q), 0, 255).astype(np.uint8).reshape(G * G, 360)
    Image.fromarray(q, 'L').save(f'../site/data/rover_hz{SUF}.png', optimize=True)
    # slope: LOLA 20 m heights on a 20 m lattice of the plan frame, rise over 40 m, mean of the four 20 m points of each cell
    g20 = (np.arange(2 * G) + 0.5) * 20.0 - L / 2; E2, N2 = np.meshgrid(g20, -g20)
    hh = lambda e, n: ultra.height(x0 + e * ex + n * nx, y0 + e * ey + n * ny)
    sl = np.degrees(np.arctan(np.hypot((hh(E2 + 20, N2) - hh(E2 - 20, N2)) / 40, (hh(E2, N2 + 20) - hh(E2, N2 - 20)) / 40)))
    slc = sl.reshape(G, 2, G, 2).mean((1, 3))
    # check: the browser's short rule (Sun as seen from the box centre + tilt of the ground) against the full calculation at 121 cells, every hour of 2027
    S = np.load('ephem_2027_2028.npz')['sun'][:8760]
    az0, el0 = azel(S, ridge['lat'], ridge['lon'], topocentric=False)
    same = tot = 0; lit_b = lit_x = 0
    for (r, c), (own, ll) in OWN.items():
        e, n = g[c], -g[r]
        azc, elc = azel(S, float(ll[0]), float(ll[1]), topocentric=False)
        ex_lit = elc >= np.interp(azc, np.arange(720) * 0.5, own, period=360)
        hzq = q[r * G + c] * Q - OFF
        elb = el0 + np.degrees((e * np.sin(np.radians(az0)) + n * np.cos(np.radians(az0))) / RM)
        br_lit = elb >= np.interp(az0, np.arange(360) + 0.5, hzq, period=360)
        same += int((ex_lit == br_lit).sum()); tot += len(S); lit_b += int(br_lit.sum()); lit_x += int(ex_lit.sum())
    meta = {"grid": G, "cell_m": L / G, "height_m": HOBS, "file": f"rover_hz{SUF}.png", "q": Q, "off": OFF, "sum": int(q.astype(np.int64).sum() % 1000000007),
            "slope_b64": base64.b64encode(np.clip(np.round(slc / 0.25), 0, 255).astype(np.uint8).tobytes()).decode(), "slope_q": 0.25,
            "check": {"cells": len(OWN), "hours": 8760, "agree_pct": round(100 * same / tot, 2), "lit_pct_full": round(100 * lit_x / tot, 1), "lit_pct_short": round(100 * lit_b / tot, 1)},
            "note": "rover_hz.png: one row per cell (row index = r*grid + c, r from the north edge, c from the west edge), 360 columns = directions in the plan frame (column j = j+0.5 deg clockwise from the plan's north), value*q-off = skyline elevation in degrees, 2 m above the ground. slope: mean slope of the cell in degrees = byte*slope_q, LOLA 20 m, rise over 40 m."}
    json.dump(meta, open(f'../site/data/rover{SUF}.json', 'w'), separators=(',', ':'))
    import os
    print('png', os.path.getsize(f'../site/data/rover_hz{SUF}.png'), 'bytes; hz range', float(H1.min()), float(H1.max()), '; clipped high', float((H1 > 8.75).mean()), 'low', float((H1 < -4).mean()))
    print('slope: median', float(np.median(slc)), 'p90', float(np.percentile(slc, 90)), 'max', float(slc.max()), ' share <=15:', float((slc <= 15).mean()), ' <=10:', float((slc <= 10).mean()))
    print('check', meta['check'])
