# High-resolution heights around the south pole for the home hero and the 3D view: 2048 px, 400 km across (195 m per pixel), from LOLA LDEM_80S_80M.
import numpy as np, json
from PIL import Image
from dem import PolarDEM
D = "/mnt/user-data/uploads/Астрономия/SpaceApps2026/"
fine = PolarDEM(D + "LDEM_80S_80M.IMG", 7600, 80, 3799.5)
OUT = '../site/data/'; OFF = 20000; N = 2048; px = 400000.0 / N
g = (np.arange(N) + 0.5) * px - N * px / 2
X, Y = np.meshgrid(g, -g)
H = np.zeros((N, N)); sub = (np.arange(3) + 0.5) / 3 - 0.5
for dy in sub:
    for dx in sub: H += fine.height(X + dx * px, Y + dy * px)
H /= 9
v = np.clip(np.round(H + OFF), 0, 65535).astype(np.uint16)
rgb = np.zeros((N, N, 3), np.uint8); rgb[..., 0] = v >> 8; rgb[..., 1] = v & 255
Image.fromarray(rgb, 'RGB').save(OUT + 'pole_hi.png', optimize=True)
p = json.load(open(OUT + 'pole.json'))
p['hi'] = {"file": "pole_hi.png", "n": N, "px": px, "q": 1, "sum": int(v.astype(np.uint64).sum() % 1000000007), "source": "LOLA LDEM_80S_80M, averaged to 195 m per pixel"}
json.dump(p, open(OUT + 'pole.json', 'w'), separators=(',', ':'))
print(H.min(), H.max(), p['hi'])
