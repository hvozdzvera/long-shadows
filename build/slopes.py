"""Ground slope around every site, from the LOLA 80 m polar map (240 m where the 80 m map ends).
Slope = gradient of height over two map cells (central difference), corrected for the map scale.
Zone = circle of 500 m radius around the site point."""
import sys, json, numpy as np
sys.path.insert(0, '.')
from dem import PolarDEM
D = "/mnt/user-data/uploads/Астрономия/SpaceApps2026/"
coarse = PolarDEM(D + "LDEM_60S_240M.IMG", 7760, 240, 3879.5)
fine = PolarDEM(D + "LDEM_80S_80M.IMG", 7600, 80, 3799.5)
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)
RZ = 500.0
def slope_field(dm, x0, y0, rz, step=None):
    s = dm.scale; st = step or s / 2
    g = np.arange(-rz, rz + 1e-6, st)
    X, Y = np.meshgrid(x0 + g, y0 + g)
    dx = (dm.height(X + s, Y) - dm.height(X - s, Y)) / (2 * s)
    dy = (dm.height(X, Y + s) - dm.height(X, Y - s)) / (2 * s)
    return X, Y, np.hypot(dx, dy), np.hypot(X - x0, Y - y0) <= rz
def site_slope(lat, lon, dm=None, rz=RZ):
    if lat > -60: return None
    if dm is None: dm = next(d for d in (fine, coarse) if d.covers(*d.ll2xy(lat, lon), margin=20))
    x0, y0 = dm.ll2xy(lat, lon)
    k = 2 / (1 + np.sin(np.radians(abs(lat))))          # map scale factor of the polar stereographic projection
    X, Y, g, inz = slope_field(dm, x0, y0, rz)
    sl = np.degrees(np.arctan(g * k))[inz]
    at = float(np.degrees(np.arctan(slope_field(dm, x0, y0, 0)[2][0, 0] * k)))
    return dict(typ=round(float(np.median(sl)), 1), p95=round(float(np.percentile(sl, 95)), 1), max=round(float(sl.max()), 1),
                ok10=int(round(float((sl <= 10).mean() * 100))), at=round(at, 1), cell=int(dm.scale), zone=int(rz))
if __name__ == "__main__":
    sites = json.load(open('/home/claude/ls/site/data/sites.json'))
    for s in sites:
        r = site_slope(s['lat'], s['lon'])
        if r is None: print(f"{s['id']:10s} -"); continue
        extra = ""
        if ultra.covers(*ultra.ll2xy(s['lat'], s['lon']), margin=60):
            u = site_slope(s['lat'], s['lon'], ultra); extra = f"   | 20 m map: typ {u['typ']} p95 {u['p95']} ok10 {u['ok10']}%"
        w = site_slope(s['lat'], s['lon'], rz=1500)
        print(f"{s['id']:10s} cell {r['cell']:3d}  at {r['at']:5.1f}  typ {r['typ']:5.1f}  p95 {r['p95']:5.1f}  max {r['max']:5.1f}  <=10deg {r['ok10']:3d}%   | 1.5 km: typ {w['typ']:5.1f} ok10 {w['ok10']:3d}%{extra}")
    if "--write" in sys.argv:           # run after the site export: adds "slope" to every site in the app's data file
        P = '/home/claude/ls/site/data/sites.json'
        for s in sites:
            r = site_slope(s['lat'], s['lon'])
            if r: s['slope'] = {k: r[k] for k in ('typ', 'p95', 'ok10', 'at', 'cell', 'zone')}
            else: s.pop('slope', None)
        json.dump(sites, open(P, 'w'), ensure_ascii=True, separators=(',', ':'))
        print('written', sum('slope' in s for s in sites), 'of', len(sites))
