"""Which NASA Deep Space Network complex has the Moon in its sky, hour by hour (Expert mode).

Moon: JPL DE421 (the same ephemeris as the rest of the site). Earth's turn: precession (IAU 1976) and
Greenwich mean sidereal time (IAU 1982), UT1 taken equal to UTC; nutation left out. Together that is good to about 0.01 deg,
far finer than the 10 deg line used here. Checked below against an independent library (astropy / ERFA).
Writes site/data/dsn.json: elevation of the Moon at the three complexes for every hour, in whole degrees."""
import sys, json, base64, numpy as np, datetime as dt
from paths import NASA, DATA
sys.path.insert(0, '.')
from ephem import E, jd_tdb
STATIONS = [  # 70 m antennas; geodetic latitude, east longitude, height above the ellipsoid (m)
    ("gds", "Goldstone", "California, USA", 35.4259, 243.1105, 1001.0),
    ("mad", "Madrid", "Spain", 40.4314, 355.7520, 865.0),
    ("cbr", "Canberra", "Australia", -35.4024, 148.9813, 689.0)]
MIN_EL = 10.0
T0 = dt.datetime(2023, 8, 1, tzinfo=dt.timezone.utc); N = 47520

def R1(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, s], [0, -s, c]])
def R2(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])
def R3(a): c, s = np.cos(a), np.sin(a); return np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])

def earth_fixed(jd_ut, jd_tt):
    """Matrix from ICRF (J2000 equator) to the Earth-fixed frame."""
    T = (jd_tt - 2451545.0) / 36525.0; asec = np.radians(1 / 3600)
    zeta = (2306.2181 * T + 0.30188 * T**2 + 0.017998 * T**3) * asec
    z = (2306.2181 * T + 1.09468 * T**2 + 0.018203 * T**3) * asec
    theta = (2004.3109 * T - 0.42665 * T**2 - 0.041833 * T**3) * asec
    P = R3(-z) @ R2(theta) @ R3(-zeta)                      # mean equator and equinox of date
    Tu = (jd_ut - 2451545.0) / 36525.0
    gmst = (280.46061837 + 360.98564736629 * (jd_ut - 2451545.0) + 0.000387933 * Tu**2 - Tu**3 / 38710000.0) % 360
    return R3(np.radians(gmst)) @ P

def station_frame(lat, lon, h):
    a, f = 6378137.0, 1 / 298.257223563; e2 = f * (2 - f); la, lo = np.radians(lat), np.radians(lon)
    n = a / np.sqrt(1 - e2 * np.sin(la)**2)
    r = np.array([(n + h) * np.cos(la) * np.cos(lo), (n + h) * np.cos(la) * np.sin(lo), (n * (1 - e2) + h) * np.sin(la)]) / 1000.0     # km
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    return r, up

def elevations(times):
    jd_ut = np.array([2440587.5 + t.timestamp() / 86400.0 for t in times]); jd_t = np.array([jd_tdb(t) for t in times])
    moon = E.position('moon', jd_t)                          # Earth -> Moon, km, ICRF
    fr = [station_frame(s[3], s[4], s[5]) for s in STATIONS]; out = np.zeros((len(STATIONS), len(times)))
    for k in range(len(times)):
        m = earth_fixed(jd_ut[k], jd_t[k]) @ moon[:, k]
        for j, (r, up) in enumerate(fr):
            v = m - r; out[j, k] = np.degrees(np.arcsin(v @ up / np.linalg.norm(v)))
    return out

if __name__ == "__main__":
    times = [T0 + dt.timedelta(hours=i) for i in range(N)]
    el = elevations(times); up = el >= MIN_EL
    print("share of hours with the Moon above", MIN_EL, "deg:", {s[1]: round(100 * up[j].mean(), 1) for j, s in enumerate(STATIONS)})
    print("hours with no complex:", int((~up.any(0)).sum()), "of", N, f"({100 * (~up.any(0)).mean():.2f}%);  with two or three: {100 * (up.sum(0) >= 2).mean():.1f}%")
    # independent check: astropy (ERFA: IAU 2006 Earth rotation, its own Moon series)
    try:
        import warnings; warnings.simplefilter("ignore")
        from astropy.time import Time; from astropy.coordinates import EarthLocation, AltAz, get_body, solar_system_ephemeris
        from astropy.utils import iers; iers.conf.auto_download = False; iers.conf.iers_degraded_accuracy = "ignore"
        import astropy.units as u
        idx = np.random.default_rng(7).choice(N, 400, replace=False); t = Time([times[i] for i in idx]); worst = 0; flips = 0
        with solar_system_ephemeris.set("builtin"):
            for j, s in enumerate(STATIONS):
                loc = EarthLocation(lat=s[3] * u.deg, lon=s[4] * u.deg, height=s[5] * u.m)
                alt = get_body("moon", t, loc).transform_to(AltAz(obstime=t, location=loc)).alt.deg
                d = np.abs(alt - el[j, idx]); worst = max(worst, float(d.max())); flips += int(((alt >= MIN_EL) != (el[j, idx] >= MIN_EL)).sum())
        print(f"check against astropy at 400 random hours x 3 complexes: largest gap {worst:.3f} deg; different answer to 'above {MIN_EL:.0f} deg?' in {flips} of 1200")
        chk = dict(lib="astropy (ERFA)", hours=400, max_gap_deg=round(worst, 3), flips=flips)
    except Exception as e:
        print("astropy check skipped:", e); chk = None
    if "--write" in sys.argv:
        q = np.clip(np.floor(el), -90, 90).astype(np.int8)          # rounded down, so that 'stored value >= 10' means exactly 'at least 10 deg up'
        d = dict(stations=[dict(id=s[0], name=s[1], where=s[2], lat=s[3], lon=s[4]) for s in STATIONS], min_el=MIN_EL, n=N,
                 none_pct=round(100 * float((~up.any(0)).mean()), 2), check=chk,
                 note="el_b64: int8, three rows of n hours (Goldstone, Madrid, Canberra) from 2023-08-01T00Z: elevation of the Moon in whole degrees, rounded down",
                 el_b64=base64.b64encode(q.tobytes()).decode())
        json.dump(d, open(DATA + 'dsn.json', 'w'), separators=(',', ':')); import os; print('written dsn.json', os.path.getsize(DATA + 'dsn.json') // 1024, 'KB')
