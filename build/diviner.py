"""Surface temperature and depth of stable ice at every site, from LRO Diviner polar maps
(Schorghofer & Williams 2020, Planetary Science Journal 1, 54, doi 10.3847/PSJ/abb6ff), 240 m per pixel, south of 80 S:
  polar_south_80_Tmean.grd  mean temperature, K        polar_south_80_Tmax.grd  highest temperature, K
  polar_south_80_zit_float32.tif  depth at which buried ice survives, m (0 = at the surface, no value = not within the top metres)
The grids are polar stereographic in units of the lunar radius. Their orientation is not written in the files, so it is
found here: of the eight possible flips and turns, the right one is the one whose Tmax map follows NASA's map of average sunlight.
Writes site/data/expert.json (read only by the Expert mode)."""
import sys, json, numpy as np, tifffile
from paths import NASA, DATA
from scipy.io import netcdf_file
sys.path.insert(0, '.')
from dem import PolarDEM, R
D = NASA
def grd(f):
    nc = netcdf_file(D + f, "r", mmap=False); return nc.variables["z"][:].astype(np.float32), float(nc.variables["x"][-1])
tmean, half = grd("polar_south_80_Tmean.grd"); tmax, _ = grd("polar_south_80_Tmax.grd")
zit = tifffile.imread(D + "polar_south_80_zit_float32.tif").astype(np.float32)
N = tmean.shape[0]; PX = 2 * half * R / (N - 1)            # node spacing, m
sun = PolarDEM(D + "AVGVISIB_65S_240M_201608.IMG", 6420, 240, 3209.5)
def variants(a):                                             # all eight orientations; returns arrays indexed [row from +y, col from -x] like LOLA
    out = {}
    for name, b in (("as stored", a), ("transposed", a.T)):
        for fy in (0, 1):
            for fx in (0, 1):
                c = b[::-1] if fy else b; c = c[:, ::-1] if fx else c; out[f"{name}, flipY={fy}, flipX={fx}"] = c
    return out
# sample NASA sunlight on the Diviner node grid (LOLA convention: row 0 = +y, col 0 = -x)
ax = (np.arange(N) - (N - 1) / 2) * PX; X, Y = np.meshgrid(ax, -ax)
i, j = sun.xy2ij(X, Y); S = np.asarray(sun.a)[np.clip(np.round(i).astype(int), 0, 6419), np.clip(np.round(j).astype(int), 0, 6419)].astype(np.float32)
best = None
for name, c in variants(tmax).items():
    ok = np.isfinite(c); r = float(np.corrcoef(c[ok], S[ok])[0, 1]); print(f"  {name:36s} correlation of Tmax with sunlight {r:+.3f}")
    if best is None or r > best[1]: best = (name, r)
print("orientation:", best)
pick = lambda a: variants(a)[best[0]]
TM, TX = pick(tmean), pick(tmax)
# the ice-depth map is a GeoTIFF and is stored the other way up than the two grids: checked the same way,
# against the mean temperature (ice survives where it is cold). The right orientation gives r = +0.79, the other seven below +0.2.
zbest = None
for name, c in variants(zit).items():
    m = np.isfinite(c) & np.isfinite(TM); r = float(np.corrcoef(c[m], TM[m])[0, 1])
    if zbest is None or r > zbest[1]: zbest = (name, r)
print("ice map orientation:", zbest); ZI = variants(zit)[zbest[0]]
def at_ice(lat, lon):
    x, y = sun.ll2xy(lat, lon); r, c = (N - 1) / 2 - y / PX, (N - 1) / 2 + x / PX
    if not (1 <= r < N - 2 and 1 <= c < N - 2): return "out"
    w = ZI[int(round(r)) - 1:int(round(r)) + 2, int(round(c)) - 1:int(round(c)) + 2]
    return None if np.isfinite(w).sum() < 5 else float(np.nanmedian(w))          # None: no depth in the modelled layer at which ice survives
def at(a, lat, lon):
    x, y = sun.ll2xy(lat, lon); r, c = (N - 1) / 2 - y / PX, (N - 1) / 2 + x / PX
    if not (1 <= r < N - 2 and 1 <= c < N - 2): return None
    w = a[int(round(r)) - 1:int(round(r)) + 2, int(round(c)) - 1:int(round(c)) + 2]          # 3 x 3 pixels, about 700 m
    return None if not np.isfinite(w).any() else float(np.nanmedian(w))
sites = json.load(open(DATA + 'sites.json')); out = {}
for s in sites:
    if s['lat'] > -80.05: continue
    a, b, z = at(TM, s['lat'], s['lon']), at(TX, s['lat'], s['lon']), at_ice(s['lat'], s['lon'])
    psr_cold = None
    if a is not None: out[s['id']] = dict(tmean=round(a), tmax=round(b), ice=None if z in (None, 'out') else round(z, 2))
    print(f"{s['id']:10s} lat {s['lat']:8.3f}  mean {a and round(a)} K  max {b and round(b)} K  ice depth {z if z in (None, 'out') else round(z, 2)} m   sunlight (NASA) {s.get('nasa_sun_pct')}")
# a coarser copy for the browser, so that a point you click or load also gets a temperature: blocks of 2 x 2 pixels (480 m), median.
# One picture, three channels: red = mean temperature in K, green = highest temperature / 2 in K, blue = ice depth / 0.005 m (255 = no stable ice).
import warnings
BL = 2; n2 = N // BL
def blocks(a, need=1):
    v = a[:n2 * BL, :n2 * BL].reshape(n2, BL, n2, BL).transpose(0, 2, 1, 3).reshape(n2, n2, BL * BL)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore"); m = np.nanmedian(v, axis=2)
    m[np.isfinite(v).sum(axis=2) < need] = np.nan; return m
bm, bx, bi = blocks(TM), blocks(TX), blocks(ZI, need=BL * BL // 2)
rgb = np.zeros((n2, n2, 3), np.uint8)
rgb[..., 0] = np.where(np.isfinite(bm), np.clip(np.round(bm), 1, 254), 0)
rgb[..., 1] = np.where(np.isfinite(bx), np.clip(np.round(bx / 2), 1, 254), 0)
rgb[..., 2] = np.where(np.isfinite(bi), np.clip(np.round(bi / 0.005), 0, 254), 255)
x0c = ((BL - 1) / 2 - (N - 1) / 2) * PX; raster = dict(file="diviner_480m.png", n=n2, px=round(BL * PX, 3), x0=round(x0c, 1), y0=round(-x0c, 1), sum=int(rgb.astype(np.int64).sum() % 1000000007),
              note="pixel (row, col): x = x0 + col*px, y = y0 - row*px in the south polar stereographic plane of the LOLA maps (x = rho sin lon, y = rho cos lon, metres); red = mean K, green*2 = highest K, blue*0.005 = ice depth in m, blue 255 = no stable ice, red 0 = no data")
# check of the coarse copy at the named sites
gap = []
for s in sites:
    if s['id'] not in out: continue
    x, y = sun.ll2xy(s['lat'], s['lon']); c = int(round((x - x0c) / (BL * PX))); r = int(round((-x0c - y) / (BL * PX)))
    if 0 <= r < n2 and 0 <= c < n2 and rgb[r, c, 0]: gap.append((abs(int(rgb[r, c, 0]) - out[s['id']]['tmean']), abs(2 * int(rgb[r, c, 1]) - out[s['id']]['tmax'])))
print("node spacing", round(PX, 2), "m; coarse copy", rgb.shape, "; at", len(gap), "named sites the coarse copy differs from the 240 m value by up to", max(g[0] for g in gap), "K (mean) and", max(g[1] for g in gap), "K (highest); typical", float(np.median([g[0] for g in gap])), "and", float(np.median([g[1] for g in gap])), "K")
raster["check"] = dict(sites=len(gap), max_mean_k=int(max(g[0] for g in gap)), max_highest_k=int(max(g[1] for g in gap)), typ_mean_k=float(np.median([g[0] for g in gap])), typ_highest_k=float(np.median([g[1] for g in gap])))
if "--write" in sys.argv:
    from PIL import Image
    Image.fromarray(rgb, "RGB").save(DATA + 'diviner_480m.png', optimize=True)
    import os; print("diviner_480m.png", os.path.getsize(DATA + 'diviner_480m.png') // 1024, "KB")
    P = DATA + 'expert.json'
    try: e = json.load(open(P))
    except Exception: e = {}
    e['diviner'] = dict(src="LRO Diviner polar maps, 240 m per pixel: Schorghofer & Williams 2020, PSJ 1, 54", orientation=best[0], check_r=round(best[1], 3), ice_orientation=zbest[0], ice_check_r=round(zbest[1], 3), ice_max_m=round(float(np.nanmax(zit)), 2), raster=raster, sites=out)
    json.dump(e, open(P, 'w'), separators=(',', ':')); print('written', P)
