# Hourly Sun and Earth vectors for Aug 2023 – Dec 2028 (covers real past landings and the planning years)
import sys, json, base64, numpy as np, datetime as dt
sys.path.insert(0, '.')
from ephem import body_vectors, jd_tdb
t0 = dt.datetime(2023, 8, 1, tzinfo=dt.timezone.utc); t1 = dt.datetime(2029, 1, 1, tzinfo=dt.timezone.utc)
n = int((t1 - t0).total_seconds() // 3600)
jds = np.array([jd_tdb(t0 + dt.timedelta(hours=i)) for i in range(n)])
s, e = body_vectors(jds)
np.savez_compressed('ephem_2023_2028.npz', sun=s, earth=e, t0=t0.timestamp(), step_h=1)
arr = np.concatenate([s, e], axis=1).astype('<f4')
json.dump({"start_utc": "2023-08-01T00:00:00Z", "step_hours": 1, "n": n,
           "layout": "float32 little-endian, per hour: sun_x,sun_y,sun_z (unit vector), earth_x,earth_y,earth_z (km), Moon body-fixed frame: mean Earth / polar axis (ME), from DE421; the Sun direction includes the aberration of light",
           "source": "JPL DE421 planetary and lunar ephemeris (positions and lunar librations)",
           "made_with": "Computed by scripts written with the help of an AI assistant (Claude, Anthropic).",
           "data_b64": base64.b64encode(arr.tobytes()).decode()}, open('../site/data/ephem.json', 'w'))
print(n, arr.nbytes)
