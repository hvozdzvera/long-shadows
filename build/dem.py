import numpy as np
R = 1737400.0
class PolarDEM:
    """LOLA polar stereographic DEM (south pole, spherical). Heights in metres relative to 1737.4 km."""
    def __init__(self, path, n, scale, offset=None):
        self.a = np.memmap(path, dtype='<i2', mode='r', shape=(n, n))
        self.n, self.scale = n, float(scale)
        self.off = (n - 1) / 2.0 if offset is None else offset
    def ll2xy(self, lat, lon):
        lat, lon = np.radians(lat), np.radians(lon)
        rho = 2 * R * np.tan(np.pi / 4 + lat / 2)
        return rho * np.sin(lon), rho * np.cos(lon)
    def xy2ll(self, x, y):
        rho = np.hypot(x, y)
        lat = 2 * np.arctan(rho / (2 * R)) - np.pi / 2
        return np.degrees(lat), np.degrees(np.arctan2(x, y)) % 360
    def xy2ij(self, x, y):
        # south pole product: column (sample) grows with x, row (line) decreases with y
        return self.off - y / self.scale, self.off + x / self.scale
    def covers(self, x, y, margin=2):
        i, j = self.xy2ij(np.asarray(x, float), np.asarray(y, float))
        return (i > margin) & (j > margin) & (i < self.n - 1 - margin) & (j < self.n - 1 - margin)
    def height(self, x, y):
        """Bilinear height (m) at map coordinates x, y (m)."""
        i, j = self.xy2ij(np.asarray(x, float), np.asarray(y, float))
        i0 = np.clip(np.floor(i).astype(int), 0, self.n - 2); j0 = np.clip(np.floor(j).astype(int), 0, self.n - 2)
        di, dj = i - i0, j - j0
        a = self.a
        h = (a[i0, j0] * (1 - di) * (1 - dj) + a[i0 + 1, j0] * di * (1 - dj) +
             a[i0, j0 + 1] * (1 - di) * dj + a[i0 + 1, j0 + 1] * di * dj)
        return h * 0.5
