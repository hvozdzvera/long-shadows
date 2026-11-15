# Python twin of the browser horizon routine (same tiles, same stepping) + validation against the full-resolution pipeline
import sys, json, numpy as np
sys.path.insert(0, '.')
from ephem import azel
RM = 1737400.0; NB = 720
Z = np.load('tiles.npz'); TILES = [(Z['T1'], 240.0), (Z['T2'], 960.0)]
def sample(x, y):
    out = np.full(np.shape(x), np.nan)
    for T, px in TILES:
        n = T.shape[0]; cx = x / px + n / 2 - 0.5; cy = n / 2 - 0.5 - y / px
        ok = np.isnan(out) & (cx >= 0) & (cx <= n - 1.001) & (cy >= 0) & (cy <= n - 1.001)
        i = np.floor(np.where(ok, cx, 0)).astype(int); j = np.floor(np.where(ok, cy, 0)).astype(int); fx = cx - i; fy = cy - j
        v = T[j, i] * (1 - fx) * (1 - fy) + T[j, i + 1] * fx * (1 - fy) + T[j + 1, i] * (1 - fx) * fy + T[j + 1, i + 1] * fx * fy
        out = np.where(ok, v, out)
    return out
def unit_xy(x, y):
    rho = np.hypot(x, y); t = rho / (2 * RM); sc = 2 * t / (1 + t * t); cc = (1 - t * t) / (1 + t * t)
    r = np.where(rho > 0, rho, 1)
    return np.stack([sc * y / r, sc * x / r, -cc], -1)
def ll2xy(lat, lon):
    rho = 2 * RM * np.tan(np.pi / 4 + np.radians(lat) / 2); return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))
def horizon(lat, lon, hobs, coarse_only=False):
    global TILES
    keep = TILES
    if coarse_only: TILES = TILES[1:]
    x0, y0 = ll2xy(lat, lon); h0 = float(sample(np.array(x0), np.array(y0)))
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]); east = np.array([-np.sin(lo), np.cos(lo), 0]); north = np.cross(up, east)
    O = (RM + h0 + hobs) * up
    d = [0.7 * (960 if coarse_only else 240)]
    while d[-1] < 300e3: d.append(d[-1] + max(d[0], d[-1] * 0.015))
    d = np.array(d); b = np.radians(np.arange(1440) * 0.25)[:, None]
    px = x0 + d[None, :] * np.sin(b); py = y0 + d[None, :] * np.cos(b)
    h = sample(px, py); ok = ~np.isnan(h)
    P = (RM + np.where(ok, h, 0))[..., None] * unit_xy(px, py); V = P - O; dist = np.linalg.norm(V, axis=-1)
    el = np.degrees(np.arcsin((V @ up) / dist)); az = np.degrees(np.arctan2(V @ east, V @ north)) % 360
    el = np.where(ok, el, -90); best = np.full(NB, -90.0); np.maximum.at(best, (az / 0.5).astype(int).ravel() % NB, el.ravel())
    bad = best <= -89
    if bad.any(): good = np.where(~bad)[0]; best[bad] = np.interp(np.where(bad)[0], good, best[good], period=NB)
    TILES = keep
    return best, h0
if __name__ == '__main__':
    eph = np.load('ephem_2027_2028.npz'); S, E = eph['sun'], eph['earth']
    def pct(lat, lon, hz, h0, H):
        saz, sel = azel(S, lat, lon, topocentric=False); eaz, eel = azel(E, lat, lon, h_km=(h0 + H) / 1000)
        g = np.arange(NB) * 0.5
        fs = np.clip((sel - np.interp(saz, g, hz, period=360)) / (2 * 0.2666) + 0.5, 0, 1); ve = eel > np.interp(eaz, g, hz, period=360)
        return fs.mean() * 100, ve.mean() * 100
    for s in json.load(open('sites_out.json')):
        if s['lat'] > -60: continue
        row = f"{s['id']:11s}"
        for H in (2, 10):
            ref = s['stats_2027_2028'][str(H)]
            row += f" | {H:2d} m full-res sun {ref['sun_pct']:5.1f} earth {ref['earth_pct']:5.1f}"
            if s['lat'] <= -84.5:
                hz, h0 = horizon(s['lat'], s['lon'], H); a, b = pct(s['lat'], s['lon'], hz, h0, H); row += f" · 240m {a:5.1f}/{b:5.1f}"
            hz, h0 = horizon(s['lat'], s['lon'], H, True); a, b = pct(s['lat'], s['lon'], hz, h0, H); row += f" · 960m {a:5.1f}/{b:5.1f}"
        print(row, '| NASA map', s.get('nasa_sun_pct'), s.get('nasa_earth_pct'))
