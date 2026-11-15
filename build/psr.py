"""Nearest permanently shadowed ground for every site, from NASA's LOLA average Sun visibility map
(AVGVISIB_65S_240M, Mazarico et al. 2011): pixels that are never lit in the 18.6-year simulation.
Only shadowed patches of at least 1 km2 count. Distance is measured to the nearest pixel of the patch."""
import sys, json, numpy as np
from scipy import ndimage
sys.path.insert(0, '.')
from dem import PolarDEM
D = "/mnt/user-data/uploads/Астрономия/SpaceApps2026/"
sunmap = PolarDEM(D + "AVGVISIB_65S_240M_201608.IMG", 6420, 240, 3209.5)
A = np.asarray(sunmap.a)
psr = A == 0
lab, n = ndimage.label(psr, structure=np.ones((3, 3)))
area = ndimage.sum(psr, lab, np.arange(1, n + 1)) * 0.240 ** 2          # km2 on the map
big = np.concatenate([[False], area >= 1.0])[lab]
ii, jj = np.nonzero(big)
px = (jj - sunmap.off) * 240.0; py = (sunmap.off - ii) * 240.0
print('pixels never lit:', int(psr.sum()), ' patches:', n, ' patches >= 1 km2:', int((area >= 1).sum()), ' their area, km2:', round(float(area[area >= 1].sum())))
def nearest(lat, lon):
    if lat > -66: return None
    x, y = sunmap.ll2xy(lat, lon)
    d = np.hypot(px - x, py - y); k = int(np.argmin(d))
    kk = 2 / (1 + np.sin(np.radians(abs(lat))))
    la, lo = sunmap.xy2ll(px[k], py[k])
    return dict(km=float(round(float(d[k]) / kk / 1000, 1)), area=round(float(area[lab[ii[k], jj[k]] - 1]), 1), lat=round(float(la), 3), lon=round(float(lo), 2),
                own=round(float(A[int(round(sunmap.off - y / 240)), int(round(sunmap.off + x / 240))]) * 0.004, 1))
if __name__ == "__main__":
    P = '/home/claude/ls/site/data/sites.json'
    sites = json.load(open(P))
    for s in sites:
        r = nearest(s['lat'], s['lon'])
        print(f"{s['id']:10s}", r)
        if "--write" in sys.argv:
            if r: s['psr'] = {k: r[k] for k in ('km', 'area', 'lat', 'lon')}
            else: s.pop('psr', None)
    if "--write" in sys.argv:
        json.dump(sites, open(P, 'w'), ensure_ascii=True, separators=(',', ':')); print('written')
