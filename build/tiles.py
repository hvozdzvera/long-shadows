# Terrain tiles for the browser (custom points) + validation of the browser horizon method
import sys, json, numpy as np
from paths import NASA, DATA
sys.path.insert(0, '.')
from PIL import Image
from dem import PolarDEM, R
D = NASA
coarse = PolarDEM(D + "LDEM_60S_240M.IMG", 7760, 240, 3879.5)
fine = PolarDEM(D + "LDEM_80S_80M.IMG", 7600, 80, 3799.5)
sunmap = PolarDEM(D + "AVGVISIB_65S_240M_201608.IMG", 6420, 240, 3209.5)
OUT = DATA
OFF = 20000
def tile(N, px, name, q=1):
    g = (np.arange(N) + 0.5) * px - N * px / 2
    X, Y = np.meshgrid(g, -g)
    # average the finer source over each output pixel (box filter) to avoid aliasing
    k = max(1, int(round(px / 240))); sub = (np.arange(k) + 0.5) / k - 0.5
    H = np.zeros((N, N))
    for dy in sub:
        for dx in sub: H += coarse.height(X + dx * px, Y + dy * px)
    H /= k * k
    v = np.clip(np.round((H + OFF) / q), 0, 65535).astype(np.uint16)
    rgb = np.zeros((N, N, 3), np.uint8); rgb[..., 0] = v >> 8; rgb[..., 1] = v & 255
    Image.fromarray(rgb, 'RGB').save(OUT + name, optimize=True)
    return (v.astype(float) * q - OFF), int(v.astype(np.uint64).sum() % 1000000007)
T1, c1 = tile(1520, 240.0, 'terrain_240m.png')
T2, c2 = tile(1200, 960.0, 'terrain_960m.png', q=4)
meta = {"offset": OFF, "t1": {"file": "terrain_240m.png", "n": 1520, "px": 240, "q": 1, "sum": c1}, "t2": {"file": "terrain_960m.png", "n": 1200, "px": 960, "q": 4, "sum": c2},
        "note": "LOLA LDEM_60S_240M resampled; height in metres = (R*256 + G) * q - offset, relative to a 1737.4 km sphere; south polar stereographic, lon 0 up, 90E right"}
json.dump(meta, open(OUT + 'terrain.json', 'w'))
import os
print({f: os.path.getsize(OUT + f) for f in ('terrain_240m.png', 'terrain_960m.png')})
np.savez_compressed('tiles.npz', T1=T1, T2=T2)
