"""Sun and Earth vectors in the Moon body-fixed frame from JPL DE421 (positions + lunar librations)."""
import numpy as np, datetime as dt
from jplephem.ephem import Ephemeris
import de421
E = Ephemeris(de421)
EMRAT = 81.30056          # Earth/Moon mass ratio (DE421)
R_MOON = 1737.4           # km, LOLA reference radius
TT_MINUS_UTC = 69.184     # s (37 leap s + 32.184 s; no new leap seconds through 2026)

def jd_tdb(t_utc):
    return 2440587.5 + (t_utc.timestamp() + TT_MINUS_UTC) / 86400.0

def R1(a):
    c, s = np.cos(a), np.sin(a); return np.array([[1,0,0],[0,c,s],[0,-s,c]])
def R3(a):
    c, s = np.cos(a), np.sin(a); return np.array([[c,s,0],[-s,c,0],[0,0,1]])

def R2(a):
    c, s = np.cos(a), np.sin(a); return np.array([[c,0,-s],[0,1,0],[s,0,c]])
_AS = np.radians(1 / 3600.0)
# DE421: from the principal-axes frame to the mean Earth / polar axis frame, the one LOLA maps and JPL Horizons use (Williams et al. 2008)
PA2ME = R1(-0.30 * _AS) @ R2(-78.56 * _AS) @ R3(-67.92 * _AS)
C_KM_DAY = 299792.458 * 86400.0

def body_vectors(jds):
    """Return Sun unit vector and Earth vector (km) from Moon centre, in the lunar mean Earth / polar axis (ME) frame.
    The Sun's direction includes the aberration of light (about 0.006 deg), so it is where the light actually comes from."""
    jds = np.atleast_1d(jds)
    emb, v_emb = E.position_and_velocity('earthmoon', jds)          # SSB -> EMB, km and km/day, ICRF
    mgeo, v_mgeo = E.position_and_velocity('moon', jds)             # Earth -> Moon
    v_moon = v_emb - v_mgeo / (1.0 + EMRAT) + v_mgeo                # Moon's velocity against the Solar System barycentre
    sun = E.position('sun', jds)                # SSB -> Sun
    earth_ssb = emb - mgeo / (1.0 + EMRAT)
    moon_ssb = earth_ssb + mgeo
    v_sun = sun - moon_ssb
    v_earth = -mgeo
    lib = E.compute('librations', jds)[:3]      # phi, theta, psi
    out_s, out_e = [], []
    for k in range(jds.size):
        M = PA2ME @ R3(lib[2, k]) @ R1(lib[1, k]) @ R3(lib[0, k])   # ICRF -> PA -> ME
        u = v_sun[:, k] / np.linalg.norm(v_sun[:, k]) + v_moon[:, k] / C_KM_DAY      # aberration of sunlight
        s = M @ u; e = M @ v_earth[:, k]
        out_s.append(s / np.linalg.norm(s)); out_e.append(e)
    return np.array(out_s), np.array(out_e)

def enu(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    up = np.array([np.cos(la)*np.cos(lo), np.cos(la)*np.sin(lo), np.sin(la)])
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.cross(up, east)
    return up, east, north

def azel(vecs, lat, lon, h_km=0.0, topocentric=True):
    """Azimuth (from local north, clockwise) and elevation above the spherical horizon."""
    up, east, north = enu(lat, lon)
    v = vecs - (R_MOON + h_km) * up if topocentric else vecs
    v = v / np.linalg.norm(v, axis=1)[:, None]
    el = np.degrees(np.arcsin(v @ up))
    az = np.degrees(np.arctan2(v @ east, v @ north)) % 360
    return az, el
