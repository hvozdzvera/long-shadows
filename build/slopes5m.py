"""Ground slope at lander scale from the LOLA 5 m site maps (Barker et al. 2021, PGDA product 78), Expert mode.

The maps (SiteNN_final_adj_5mpp_slp.tif) are in the same south polar stereographic projection as the LOLA polar maps
(x = rho sin lon, y = rho cos lon, metres), 5 m per pixel. For every site of ours that falls inside one of them we read
the slope in circles of 100 m and 500 m around the point: typical (median), steepest parts (95th percentile), and the
share gentler than 10 deg. The 500 m circle is the same one used for the 80 m map, so the two can be compared directly.
Check of the georeferencing: heights of the 5 m map of Site01 against the LOLA 20 m polar map at the same points.
Writes into site/data/expert.json."""
import sys, json, glob, numpy as np, tifffile
sys.path.insert(0, '.')
from dem import PolarDEM
D = "/mnt/user-data/uploads/Астрономия/SpaceApps2026/"
NAMES = {"01": "Connecting Ridge", "04": "Shackleton Rim", "07": "Peak near Shackleton", "11": "de Gerlache Rim", "20": "Leibnitz Beta Plateau", "23": "Malapert Massif"}
ultra = PolarDEM(D + "LDEM_875S_20M.IMG", 7584, 20, 3791.5)

def load(f):
    with tifffile.TiffFile(f) as t:
        p = t.pages[0]; sc = p.tags["ModelPixelScaleTag"].value; tp = p.tags["ModelTiepointTag"].value
        return p.asarray(), tp[3], tp[4], sc[0]            # array, x of the left edge, y of the top edge, pixel size (m)

def circle(a, x0, y0, px, x, y, r):
    c, rw = (x - x0) / px - 0.5, (y0 - y) / px - 0.5      # pixel centres
    n = a.shape[0]; k = int(np.ceil(r / px)) + 1; ci, ri = int(round(c)), int(round(rw))
    if ci - k < 0 or ri - k < 0 or ci + k >= a.shape[1] or ri + k >= n: return None
    w = a[ri - k:ri + k + 1, ci - k:ci + k + 1]; yy, xx = np.mgrid[-k:k + 1, -k:k + 1]
    v = w[(xx * px) ** 2 + (yy * px) ** 2 <= r * r]; v = v[np.isfinite(v)]
    return v if v.size > 20 else None

maps = {f.split("Site")[1][:2]: load(f) for f in sorted(glob.glob(D + "Site*_5mpp_slp.tif"))}
sites = json.load(open('/home/claude/ls/site/data/sites.json')); out = {}
for s in sites:
    if s['lat'] > -80: continue
    x, y = ultra.ll2xy(s['lat'], s['lon'])
    for k, (a, x0, y0, px) in maps.items():
        v5, v1 = circle(a, x0, y0, px, x, y, 500), circle(a, x0, y0, px, x, y, 100)
        if v5 is None or v1 is None: continue
        at = circle(a, x0, y0, px, x, y, 12)
        out[s['id']] = dict(map=NAMES[k], at=round(float(np.median(at)), 1),
                            r100=dict(typ=round(float(np.median(v1)), 1), p95=round(float(np.percentile(v1, 95)), 1), ok10=round(100 * float((v1 <= 10).mean()))),
                            r500=dict(typ=round(float(np.median(v5)), 1), p95=round(float(np.percentile(v5, 95)), 1), ok10=round(100 * float((v5 <= 10).mean()))))
        o = out[s['id']]; old = s.get('slope') or {}
        print(f"{s['id']:10s} in map {k} ({NAMES[k]}): at the point {o['at']} | 100 m: typ {o['r100']['typ']} p95 {o['r100']['p95']} <=10deg {o['r100']['ok10']}% | 500 m: typ {o['r500']['typ']} p95 {o['r500']['p95']} <=10deg {o['r500']['ok10']}%   || 80 m map, 500 m: typ {old.get('typ')} p95 {old.get('p95')} <=10deg {old.get('ok10')}%")
        break
# georeferencing check on Site01: 5 m heights against the LOLA 20 m polar map
chk = None
try:
    h, x0, y0, px = load(D + "Site01_final_adj_5mpp_surf.tif")
    rng = np.random.default_rng(3); ci = rng.integers(40, h.shape[1] - 40, 4000); ri = rng.integers(40, h.shape[0] - 40, 4000)
    X, Y = x0 + (ci + 0.5) * px, y0 - (ri + 0.5) * px
    h5 = np.array([h[r - 2:r + 2, c - 2:c + 2].mean() for r, c in zip(ri, ci)]); h20 = ultra.height(X, Y)
    if np.nanmedian(np.abs(h5)) > 100000: h5 = h5 - 1737400.0          # radius instead of height
    d = h5 - h20; r = float(np.corrcoef(h5, h20)[0, 1])
    # the same test with the map shifted by 100 m must come out worse
    h20s = ultra.height(X + 100, Y); rs = float(np.corrcoef(h5, h20s)[0, 1])
    print(f"georeferencing check, Site01: 4000 points, correlation of heights {r:.5f}, median difference {np.median(d):.1f} m, spread (MAD) {np.median(np.abs(d - np.median(d))):.1f} m; shifted by 100 m: correlation {rs:.5f}, spread {np.median(np.abs((h5 - h20s) - np.median(h5 - h20s))):.1f} m")
    chk = dict(points=4000, r=round(r, 5), mad_m=round(float(np.median(np.abs(d - np.median(d)))), 1), mad_shifted_100m=round(float(np.median(np.abs((h5 - h20s) - np.median(h5 - h20s)))), 1))
except Exception as e: print("height check skipped:", e)
if "--write" in sys.argv:
    P = '/home/claude/ls/site/data/expert.json'; e = json.load(open(P))
    e['slope5m'] = dict(src="LOLA 5 m site maps (Barker et al. 2021), slope files", check=chk, sites=out)
    json.dump(e, open(P, 'w'), separators=(',', ':')); print('written', len(out), 'sites')
