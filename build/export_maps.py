import sys, json, numpy as np
from paths import NASA, DATA
sys.path.insert(0, '.')
from PIL import Image
from dem import PolarDEM, R
D = NASA
coarse = PolarDEM(D + "LDEM_60S_240M.IMG", 7760, 240, 3879.5)
fine = PolarDEM(D + "LDEM_80S_80M.IMG", 7600, 80, 3799.5)
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)
sunm = PolarDEM(D + "AVGVISIB_65S_240M_201608.IMG", 6420, 240, 3209.5)
earm = PolarDEM(D + "AVGVISIB_65S_240M_201608_EARTH.IMG", 6420, 240, 3209.5)
OUT = DATA
def hillshade(H, px, az_deg=135, alt_deg=25):
    gy, gx = np.gradient(H, px)          # rows = y, cols = x
    slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
    az, alt = np.radians(az_deg), np.radians(alt_deg)
    hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(hs, 0, 1)
# ---- 1. polar overview map: radius 320 km, north (lon 0) up, 1200 px
N, RAD = 1200, 320000.0
px = 2 * RAD / N
xs = (np.arange(N) + 0.5) * px - RAD
X, Y = np.meshgrid(xs, -xs)          # image row 0 = +y (lon 0 side up)
H = coarse.height(X, Y).astype(float)
inside = fine.covers(X, Y)
H[inside] = fine.height(X[inside], Y[inside])
hs = hillshade(H, px)
base = (25 + 200 * hs ** 0.8).astype(np.uint8)
Image.fromarray(base).save(OUT + 'map_relief.jpg', quality=82)
for name, m, col in (('sun', sunm, (255, 196, 61)), ('earth', earm, (94, 182, 255))):
    v = np.clip(m.height(X, Y) * 2 * 0.00004, 0, 1)
    rgba = np.zeros((N, N, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = col
    rgba[..., 3] = (np.clip((v - 0.35) / 0.6, 0, 1) ** 1.2 * 215).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(OUT + f'map_{name}.png', optimize=True)
json.dump({"radius_m": RAD, "size_px": N, "projection": "south polar stereographic, lon 0 up, east to the right"},
          open(OUT + 'map.json', 'w'))
print('overview done')
# ---- 2. local base-plan map around Connecting Ridge site, local ENU (north = toward pole) 4 km x 4 km
sites = json.load(open('sites_out.json'))
ridge = next(s for s in sites if s['id'] == 'ridge')
lat, lon = ridge['lat'], ridge['lon']
x0, y0 = ultra.ll2xy(lat, lon)
nrm = np.hypot(x0, y0); nx, ny = -x0 / nrm, -y0 / nrm; ex, ey = -ny, nx
L, NL = 4000.0, 400                     # 4 km box, 10 m sampling (DEM 20 m, bilinear)
g = (np.arange(NL) + 0.5) * (L / NL) - L / 2
Eg, Ng = np.meshgrid(g, -g)             # row 0 = north
MX = x0 + Eg * ex + Ng * nx; MY = y0 + Eg * ey + Ng * ny
HL = ultra.height(MX, MY).astype(float)
h0 = float(ultra.height(x0, y0))
hsL = hillshade(HL, L / NL, az_deg=135, alt_deg=35)
lo_, hi_ = np.percentile(hsL, [2, 98]); hsL = np.clip((hsL - lo_) / (hi_ - lo_), 0, 1)
img = (30 + 170 * hsL).astype(float)
cont = (np.floor(HL / 25.0) != np.floor(np.roll(HL, 1, 0) / 25.0)) | (np.floor(HL / 25.0) != np.floor(np.roll(HL, 1, 1) / 25.0))
major = (np.floor(HL / 100.0) != np.floor(np.roll(HL, 1, 0) / 100.0)) | (np.floor(HL / 100.0) != np.floor(np.roll(HL, 1, 1) / 100.0))
img[cont] = img[cont] * 0.75 + 255 * 0.25; img[major] = img[major] * 0.5 + 255 * 0.5
Image.fromarray(img.astype(np.uint8)).save(OUT + 'plan_relief.jpg', quality=85)
G = 100                                  # height grid 100 x 100 (40 m) for the browser
gg = (np.arange(G) + 0.5) * (L / G) - L / 2
Eh, Nh = np.meshgrid(gg, -gg)
HG = ultra.height(x0 + Eh * ex + Nh * nx, y0 + Eh * ey + Nh * ny) - h0
np.round(HG).astype('<i2').tofile(OUT + 'plan_height.bin')
json.dump({"site": "ridge", "lat": lat, "lon": lon, "size_m": L, "img_px": NL, "grid": G, "h0_m": round(h0),
           "height_bin": "int16 metres relative to site, row 0 = north edge, col 0 = west edge",
           "note": "local frame: north = toward the south pole, east = 90 deg clockwise"},
          open(OUT + 'plan.json', 'w'))
print('plan done', HG.min(), HG.max())
# ---- 3. sites.json for the app
for s in sites:
    s.pop('refine', None)
json.dump(sites, open(OUT + 'sites.json', 'w'), separators=(',', ':'))
import os
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(OUT + f))
