# NASA's nine Artemis III candidate regions (USGS outlines, lon/lat): which of our points lie inside, and the best-lit spot of each region
import json, numpy as np
from paths import NASA, DATA
from matplotlib.path import Path
from dem import PolarDEM
from sites import SITES
D = NASA
sunmap = PolarDEM(D + "AVGVISIB_65S_240M_201608.IMG", 6420, 240, 3209.5)
G = json.load(open(NASA + "regions/regions.geojson"))
REG = []
for f in G["features"]:
    ring = np.array(f["geometry"]["coordinates"][0]); x, y = sunmap.ll2xy(ring[:, 1], ring[:, 0])
    REG.append(dict(name=f["properties"]["Region"], code=f["properties"]["RegionCode"], ring=[[round(float(a) % 360, 4), round(float(b), 4)] for a, b in ring], xy=np.c_[x, y], area=f["properties"]["Area_km2"]))
def inside(lat, lon):
    x, y = sunmap.ll2xy(lat, lon)
    return [r["code"] for r in REG if Path(r["xy"]).contains_point((float(x), float(y)))]
if __name__ == "__main__":
    for s in SITES:
        if s["lat"] < -80: print(f'{s["id"]:10s} {s["lat"]:9.4f} {s["lon"]:8.3f}  in: {inside(s["lat"], s["lon"])}')
    print()
    best = {}
    for r in REG:
        xy = r["xy"]; c = xy[:-1].mean(0)
        inner = c + (xy - c) * (1 - 1500 / np.linalg.norm(xy[:-1] - c, axis=1).mean())     # stay 1.5 km clear of the edge
        x0, x1, y0, y1 = xy[:, 0].min(), xy[:, 0].max(), xy[:, 1].min(), xy[:, 1].max()
        gx = np.arange(x0, x1, 240.0); gy = np.arange(y0, y1, 240.0); X, Y = np.meshgrid(gx, gy)
        m = Path(inner).contains_points(np.c_[X.ravel(), Y.ravel()]).reshape(X.shape)
        V = sunmap.height(X, Y) * 2 * 0.00004 * 100; V[~m] = -1
        k = np.unravel_index(np.argmax(V), V.shape); la, lo = sunmap.xy2ll(X[k], Y[k])
        side = np.linalg.norm(xy[1] - xy[0]) / 1000
        best[r["code"]] = (round(float(la), 4), round(float(lo), 3))
        print(f'{r["code"]} {r["name"]:22s} side {side:5.1f} km  best-lit {la:9.4f} {lo:8.3f}  NASA sun {V[k]:.1f}%  check inside: {inside(la, lo)}')
    json.dump([dict(name=r["name"], code=r["code"], ring=r["ring"]) for r in REG], open(DATA + "regions.json", "w"), separators=(",", ":"))
    json.dump(best, open("regions_best.json", "w"))
