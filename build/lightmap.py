# Sunlight map for the base plan: share of 2027 with the Sun in view for a 10 m mast at each cell of the 4 km box
import sys, json, base64, time, numpy as np
from paths import NASA, DATA
sys.path.insert(0, '.')
from dem import PolarDEM
import os
SITE = os.environ.get('LS_SITE', 'ridge'); SUF = '' if SITE == 'ridge' else '_' + SITE          # which site the box is centred on; files of other sites carry its id
from ephem import azel
import hz_browser as hb
D = NASA
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)
RM = 1737400.0; NB = 720
ridge = next(s for s in json.load(open('sites_out.json')) if s['id'] == SITE)
x0, y0 = ultra.ll2xy(ridge['lat'], ridge['lon']); nrm = np.hypot(x0, y0)
nx, ny = x0 / nrm, y0 / nrm; ex, ey = ny, -nx
eph = np.load('ephem_2027_2028.npz'); S = eph['sun'][:8760]
G, L, HOBS = 50, 4000.0, 10.0
g = (np.arange(G) + 0.5) * (L / G) - L / 2
d = [14.0]
while d[-1] < 300e3: d.append(d[-1] + max(14.0, d[-1] * 0.015))
d = np.array(d); near = d < 6000
b = np.radians(np.arange(720) * 0.5)[:, None]
grid = np.arange(NB) * 0.5
def horizon(x, y):
    lat, lon = ultra.xy2ll(x, y); lat = float(lat); lon = float(lon)
    h0 = float(ultra.height(x, y))
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]); east = np.array([-np.sin(lo), np.cos(lo), 0]); north = np.cross(up, east)
    O = (RM + h0 + HOBS) * up
    px = x + d[None, :] * np.sin(b); py = y + d[None, :] * np.cos(b)
    h = np.empty(px.shape)
    h[:, near] = ultra.height(px[:, near], py[:, near]); h[:, ~near] = hb.sample(px[:, ~near], py[:, ~near])
    ok = ~np.isnan(h)
    P = (RM + np.where(ok, h, 0))[..., None] * hb.unit_xy(px, py); V = P - O; dist = np.linalg.norm(V, axis=-1)
    el = np.where(ok, np.degrees(np.arcsin((V @ up) / dist)), -90); az = np.degrees(np.arctan2(V @ east, V @ north)) % 360
    best = np.full(NB, -90.0); np.maximum.at(best, (az / 0.5).astype(int).ravel() % NB, el.ravel())
    bad = best <= -89
    if bad.any(): good = np.where(~bad)[0]; best[bad] = np.interp(np.where(bad)[0], good, best[good], period=NB)
    return best, lat, lon
out = np.zeros((G, G)); t = time.time()
for r in range(G):
    for c in range(G):
        e, n = g[c], -g[r]
        hz, lat, lon = horizon(x0 + e * ex + n * nx, y0 + e * ey + n * ny)
        saz, sel = azel(S, lat, lon, topocentric=False)
        out[r, c] = np.clip((sel - np.interp(saz, grid, hz, period=360)) / (2 * 0.2666) + 0.5, 0, 1).mean() * 100
    if r % 5 == 0: print(r, round(time.time() - t), 's', flush=True)
np.save(f'lightmap{SUF}.npy', out)
p = f'{DATA}plan{SUF}.json'; plan = json.load(open(p))
plan['light'] = {"grid": G, "height_m": HOBS, "year": 2027, "b64": base64.b64encode(np.round(out).astype(np.uint8).tobytes()).decode(),
                 "note": "percent of 2027 with at least part of the Sun's disc above the skyline (mean visible fraction), 10 m above ground, 80 m cells, row 0 = north edge"}
json.dump(plan, open(p, 'w'), separators=(',', ':'))
print('done', out.min(), out.max(), 'centre', out[G // 2, G // 2], round(time.time() - t), 's')
