# Soft relief image + vector contour lines for the base-plan map (local frame, metres)
import sys, json, base64, numpy as np
sys.path.insert(0, '.')
from PIL import Image
from scipy.ndimage import gaussian_filter
from skimage.measure import find_contours, approximate_polygon
from dem import PolarDEM
import os
SITE = os.environ.get('LS_SITE', 'ridge'); SUF = '' if SITE == 'ridge' else '_' + SITE          # which site the box is centred on; files of other sites carry its id
D = "/mnt/user-data/uploads/Астрономия/SpaceApps2026/"
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)
OUT = '../site/data/'
sites = json.load(open('sites_out.json')); ridge = next(s for s in sites if s['id'] == SITE)
x0, y0 = ultra.ll2xy(ridge['lat'], ridge['lon'])
nrm = np.hypot(x0, y0); nx, ny = -x0 / nrm, -y0 / nrm; ex, ey = -ny, nx
L, NL = 4000.0, 800; px = L / NL
g = (np.arange(NL) + 0.5) * px - L / 2
Eg, Ng = np.meshgrid(g, -g)
HL = ultra.height(x0 + Eg * ex + Ng * nx, y0 + Eg * ey + Ng * ny).astype(float)
h0 = float(ultra.height(x0, y0))
Hs = gaussian_filter(HL, 3.0)
gy, gx = np.gradient(Hs, px); slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
az, alt = np.radians(135), np.radians(35)
hs = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
lo_, hi_ = np.percentile(hs, [2, 98]); hs = np.clip((hs - lo_) / (hi_ - lo_), 0, 1)
Image.fromarray((168 + 82 * hs).astype(np.uint8)).save(OUT + f'plan_relief{SUF}.jpg', quality=86)
Hc = gaussian_filter(HL, 4.0) - h0
lines = []
for z in np.arange(np.floor(Hc.min() / 25) * 25, Hc.max(), 25):
    for c in find_contours(Hc, z):
        c = approximate_polygon(c, tolerance=0.35)
        if len(c) < 4: continue
        pts = [[round((cc + 0.5) * px - L / 2, 1), round(L / 2 - (rr + 0.5) * px, 1)] for rr, cc in c]
        lines.append({"z": int(round(z)), "major": int(round(z)) % 100 == 0, "pts": pts})
plan = json.load(open(OUT + f'plan{SUF}.json'))
plan["contours"] = lines; plan["contour_note"] = "metres relative to the site, every 25 m, from LOLA 20 m DEM smoothed"
json.dump(plan, open(OUT + f'plan{SUF}.json', 'w'), separators=(',', ':'))
print(len(lines), 'contour lines;', sum(len(l['pts']) for l in lines), 'points; plan.json', len(open(OUT + f'plan{SUF}.json').read()) // 1024, 'KB')
