import numpy as np
from dem import PolarDEM, R
NB = 720                      # azimuth bins of 0.5 deg
def unit(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la)*np.cos(lo), np.cos(la)*np.sin(lo), np.sin(la)], axis=-1)

def horizon(lat, lon, h_obs, dems, near_km=25.0, far_km=300.0, nrays=1440):
    """Terrain horizon elevation (deg) in NB azimuth bins for an observer h_obs metres above ground.
    dems: list of (PolarDEM, max_distance_km) from finest to coarsest."""
    x0, y0 = dems[0][0].ll2xy(lat, lon)
    fine = next(dm for dm, _ in dems if dm.covers(x0, y0))
    h0 = float(fine.height(x0, y0))
    up = unit(lat, lon); east = np.array([-np.sin(np.radians(lon)), np.cos(np.radians(lon)), 0.0]); north = np.cross(up, east)
    O = (R + h0 + h_obs) * up
    best = np.full(NB, -90.0)
    bear = np.radians(np.arange(nrays) * 360.0 / nrays)
    nrm = np.hypot(x0, y0) or 1.0
    nx, ny = -x0 / nrm, -y0 / nrm          # local north in the map plane points to the pole
    ex, ey = -ny, nx                        # local east
    dprev = 0.0
    for li, (dem, dmax) in enumerate(dems):
        step = dem.scale * 0.7
        d = np.arange(step, dmax * 1000.0, step)
        for k in range(0, nrays, 90):
            b = bear[k:k+90][:, None]
            px = x0 + d[None, :] * (np.cos(b) * nx + np.sin(b) * ex)
            py = y0 + d[None, :] * (np.cos(b) * ny + np.sin(b) * ey)
            ok = dem.covers(px, py)
            if li > 0:   # use a coarser DEM only beyond the finer range or where finer DEMs have no data
                finer = np.zeros_like(ok)
                for fd, fmax in dems[:li]:
                    finer |= fd.covers(px, py) & (d[None, :] < fmax * 1000.0)
                ok &= ~finer
            if not ok.any():
                continue
            hh = dem.height(np.where(ok, px, x0), np.where(ok, py, y0))
            la, lo = dem.xy2ll(px, py)
            P = (R + hh)[..., None] * unit(la, lo)
            V = P - O
            dist = np.linalg.norm(V, axis=-1)
            el = np.degrees(np.arcsin((V @ up) / dist))
            az = np.degrees(np.arctan2(V @ east, V @ north)) % 360
            el = np.where(ok, el, -90.0)
            idx = (az / (360.0 / NB)).astype(int) % NB
            np.maximum.at(best, idx.ravel(), el.ravel())
    # fill empty bins (should not happen) by neighbours
    bad = best <= -89
    if bad.any():
        good = np.where(~bad)[0]
        best[bad] = np.interp(np.where(bad)[0], good, best[good], period=NB)
    return best, h0
