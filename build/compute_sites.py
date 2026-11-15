import sys, json, time, numpy as np
sys.path.insert(0, '.')
from dem import PolarDEM
from horizon import horizon, NB
from ephem import azel, enu, R_MOON
from sites import SITES
D = "/mnt/user-data/uploads/Астрономия/SpaceApps2026/"
coarse = PolarDEM(D + "LDEM_60S_240M.IMG", 7760, 240, 3879.5)
fine = PolarDEM(D + "LDEM_80S_80M.IMG", 7600, 80, 3799.5)
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)
sunmap = PolarDEM(D + "AVGVISIB_65S_240M_201608.IMG", 6420, 240, 3209.5)
earmap = PolarDEM(D + "AVGVISIB_65S_240M_201608_EARTH.IMG", 6420, 240, 3209.5)
eph = np.load('ephem_2027_2028.npz')
S, E = eph['sun'], eph['earth']
HEIGHTS = [2, 10, 20]
RSUN = 0.2666
def frac_visible(el, az, hz, r):
    h = np.interp(az, np.arange(NB) * 360 / NB, hz, period=360)
    return np.clip((el - h) / (2 * r) + 0.5, 0, 1)
def longest(mask):
    best = cur = 0
    for m in mask:
        cur = cur + 1 if m else 0
        best = max(best, cur)
    return best
out = []
for s in SITES:
    t = time.time()
    rec = dict(s)
    if s['lat'] < -60 and s.get('refine', True):
        dm = next(d for d in (ultra, fine, coarse) if d.covers(*d.ll2xy(s['lat'], s['lon'])))
        x0, y0 = dm.ll2xy(s['lat'], s['lon'])
        g = np.arange(-100, 101, dm.scale / 2)
        X, Y = np.meshgrid(x0 + g, y0 + g)
        H = dm.height(X, Y); k = np.unravel_index(np.argmax(H), H.shape)
        la, lo = dm.xy2ll(X[k], Y[k]); s = dict(s, lat=round(float(la), 4), lon=round(float(lo), 3)); rec.update(lat=s['lat'], lon=s['lon'])
    saz, sel = azel(S, s['lat'], s['lon'], topocentric=False)
    if s['lat'] > -60:
        rec['h0'] = None; hzs = {h: np.full(NB, 0.0) for h in HEIGHTS}   # flat mare: spherical horizon
        for h in HEIGHTS:  # dip of the horizon for a raised observer on a sphere
            hzs[h] = np.full(NB, -np.degrees(np.arccos(R_MOON / (R_MOON + h / 1000.0))))
    else:
        hzs = {}
        for h in HEIGHTS:
            hz, h0 = horizon(s['lat'], s['lon'], h, [(ultra, 6), (fine, 25), (coarse, 320)])
            hzs[h] = hz
        rec['h0'] = round(h0)
        x, y = sunmap.ll2xy(s['lat'], s['lon'])
        rec['nasa_sun_pct'] = round(float(sunmap.height(x, y)) * 2 * 0.00004 * 100, 1)
        rec['nasa_earth_pct'] = round(float(earmap.height(x, y)) * 2 * 0.00004 * 100, 1)
    rec['horizon'] = {str(h): [round(float(v), 2) for v in hzs[h]] for h in HEIGHTS}
    stats = {}
    for h in HEIGHTS:
        eaz, eel = azel(E, s['lat'], s['lon'], h_km=(rec['h0'] or 0) / 1000 + h / 1000)
        fs = frac_visible(sel, saz, hzs[h], RSUN)
        ve = eel > np.interp(eaz, np.arange(NB) * 360 / NB, hzs[h], period=360)
        lit = fs >= 0.5
        fe = frac_visible(eel, eaz, hzs[h], 0.95)
        stats[str(h)] = dict(sun_pct=round(float(fs.mean() * 100), 1),
                             longest_dark_h=int(longest(~lit)),
                             earth_pct=round(float(ve.mean() * 100), 1),
                             earth_disk_pct=round(float(fe.mean() * 100), 1),
                             longest_no_earth_h=int(longest(~ve)),
                             both_pct=round(float((lit & ve).mean() * 100), 1),
                             sun_el_max=round(float(sel.max()), 2))
    rec['stats_2027_2028'] = stats
    out.append(rec)
    print(f"{s['id']:10s} h0={rec['h0']}  NASA sun {rec.get('nasa_sun_pct')}% earth {rec.get('nasa_earth_pct')}%  |",
          ' '.join(f"{h}m: sun {stats[str(h)]['sun_pct']}% dark {stats[str(h)]['longest_dark_h']/24:.1f}d earth {stats[str(h)]['earth_pct']}%/{stats[str(h)]['earth_disk_pct']}% both {stats[str(h)]['both_pct']}%" for h in HEIGHTS),
          f"({time.time()-t:.0f}s)")
json.dump(out, open('sites_out.json', 'w'))
