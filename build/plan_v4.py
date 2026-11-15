# Base-plan data in a TRUE local frame: up = north (away from the south pole), right = east.
import sys, json, base64, numpy as np
from paths import NASA, DATA
sys.path.insert(0, '.')
from PIL import Image
from scipy.ndimage import gaussian_filter
from skimage.measure import find_contours, approximate_polygon
from dem import PolarDEM
import os
SITE = os.environ.get('LS_SITE', 'ridge'); SUF = '' if SITE == 'ridge' else '_' + SITE          # which site the box is centred on; files of other sites carry its id
D = NASA
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)
OUT = DATA
ridge = next(s for s in json.load(open('sites_out.json')) if s['id'] == SITE)
lat, lon = ridge['lat'], ridge['lon']
x0, y0 = ultra.ll2xy(lat, lon); nrm = np.hypot(x0, y0)
nx, ny = x0 / nrm, y0 / nrm            # north = away from the pole
ex, ey = ny, -nx                       # east = direction of increasing longitude
# self-check against real coordinates
xn, yn = ultra.ll2xy(lat + 0.01, lon); xe, ye = ultra.ll2xy(lat, lon + 0.05)
tn = np.array([xn - x0, yn - y0]); te = np.array([xe - x0, ye - y0])
assert tn @ [nx, ny] > 0.99 * np.linalg.norm(tn) and te @ [ex, ey] > 0.99 * np.linalg.norm(te)
L, NL = 4000.0, 800; px = L / NL
g = (np.arange(NL) + 0.5) * px - L / 2
Eg, Ng = np.meshgrid(g, -g)            # row 0 = north edge, col 0 = west edge
HL = ultra.height(x0 + Eg * ex + Ng * nx, y0 + Eg * ey + Ng * ny).astype(float)
h0 = float(ultra.height(x0, y0))
Hs = gaussian_filter(HL, 3.0)
gy, gx = np.gradient(Hs, px)           # gy: toward south (row down), gx: toward east
# light from the upper left (north-west), as on printed maps
lx, ly, lz = -np.cos(np.radians(35)) * np.sin(np.radians(45)), np.cos(np.radians(35)) * np.cos(np.radians(45)), np.sin(np.radians(35))
nxs, nys = -gx, gy                     # surface normal: east = -dz/de, north = -dz/dn = +gy (rows go south)
hs = np.clip((nxs * lx + nys * ly + lz) / np.sqrt(nxs**2 + nys**2 + 1), 0, 1)
lo_, hi_ = np.percentile(hs, [2, 98]); hs = np.clip((hs - lo_) / (hi_ - lo_), 0, 1)
Image.fromarray((168 + 82 * hs).astype(np.uint8)).save(OUT + f'plan_relief{SUF}.jpg', quality=86)
Hc = gaussian_filter(HL, 4.0) - h0
lines = []
for z in np.arange(np.floor(Hc.min() / 25) * 25, Hc.max(), 25):
    for c in find_contours(Hc, z):
        c = approximate_polygon(c, tolerance=0.35)
        if len(c) < 4: continue
        lines.append({"z": int(round(z)), "major": int(round(z)) % 100 == 0,
                      "pts": [[round((cc + 0.5) * px - L / 2, 1), round(L / 2 - (rr + 0.5) * px, 1)] for rr, cc in c]})
G = 100
gg = (np.arange(G) + 0.5) * (L / G) - L / 2
Eh, Nh = np.meshgrid(gg, -gg)
HG = ultra.height(x0 + Eh * ex + Nh * nx, y0 + Eh * ey + Nh * ny) - h0
plan = {"site": SITE, "lat": lat, "lon": lon, "size_m": L, "img_px": NL, "grid": G, "h0_m": round(h0),
        "frame": "local east-north: up = north (away from the south pole), right = east; row 0 = north edge, col 0 = west edge",
        "pole_km": round(1737.4 * np.radians(90 + lat), 1),
        "height_b64": base64.b64encode(np.round(HG).astype('<i2').tobytes()).decode(),
        "contours": lines, "contour_note": "metres relative to the site, every 25 m, from LOLA 20 m DEM smoothed"}
json.dump(plan, open(OUT + f'plan{SUF}.json', 'w'), separators=(',', ':'))
print('ok', len(lines), 'contours; pole', plan['pole_km'], 'km; h range', HG.min(), HG.max())
