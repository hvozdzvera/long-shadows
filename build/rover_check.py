"""Independent check of the rover route planner: the same rules written a second time in Python (heapq, plain loops),
working from the files the browser gets. Writes reference results that the browser test compares with."""
import sys, json, heapq, math, base64, numpy as np
sys.path.insert(0, '.')
from PIL import Image
from ephem import azel
D = '../site/data/'
M = json.load(open(D + 'rover.json')); G = M['grid']; CELL = M['cell_m']
HZ = np.asarray(Image.open(D + M['file'])).astype(float) * M['q'] - M['off']          # (G*G, 360) degrees
SL = np.frombuffer(base64.b64decode(M['slope_b64']), np.uint8).astype(float) * M['slope_q']
plan = json.load(open(D + 'plan.json')); HALF = plan['size_m'] / 2
S = np.load('ephem_2023_2028.npz')['sun']
SAZ, SEL = azel(S, plan['lat'], plan['lon'], topocentric=False)
RM = 1737400.0
def sun(t):
    i = max(0, min(len(SAZ) - 2, int(math.floor(t)))); f = min(1.0, max(0.0, t - i)); d = ((SAZ[i + 1] - SAZ[i] + 540) % 360) - 180
    return SAZ[i] + d * f, SEL[i] + (SEL[i + 1] - SEL[i]) * f
def en(k): return (k % G + 0.5) * CELL - HALF, HALF - (k // G + 0.5) * CELL
def margin(k, az, el):
    x = (az % 360) - 0.5; j = math.floor(x); f = x - j
    h = HZ[k, j % 360] * (1 - f) + HZ[k, (j + 1) % 360] * f
    e, n = en(k); a = math.radians(az)
    return el + math.degrees((e * math.sin(a) + n * math.cos(a)) / RM) - h
MOVES = []
for dy in range(-2, 3):
    for dx in range(-2, 3):
        a, b = abs(dx), abs(dy)
        if (a, b) in ((0, 0), (2, 2), (2, 0), (0, 2)): continue
        mids = ([(0, dy // 2), (dx, dy // 2)] if b == 2 else [(dx // 2, 0), (dx // 2, dy)]) if a + b == 3 else []
        MOVES.append((dx, dy, math.hypot(dx, dy), mids))
def search(a, b, t0, lam, speed, lim):
    v = speed * 1000; cost = {a: 0.0}; time = {a: 0.0}; prev = {}; done = set(); pq = [(0.0, a)]
    while pq:
        cu, u = heapq.heappop(pq)
        if u in done: continue
        done.add(u)
        if u == b: break
        ur, uc = divmod(u, G)
        for dx, dy, ln, mids in MOVES:
            r, c = ur + dy, uc + dx
            if not (0 <= r < G and 0 <= c < G): continue
            w = r * G + c
            if w in done or SL[w] > lim: continue
            if mids and any(SL[(ur + my) * G + uc + mx] > lim for mx, my in mids): continue
            dt = ln * CELL / v; tt = time[u] + dt; az, el = sun(t0 + tt)
            nc = cu + dt * ((1 + lam) if margin(w, az, el) < 0 else 1)
            if nc < cost.get(w, 1e18): cost[w] = nc; time[w] = tt; prev[w] = u; heapq.heappush(pq, (nc, w))
    if b not in done: return None
    p = [b]
    while p[-1] != a: p.append(prev[p[-1]])
    return p[::-1], cost[b]
def sim(path, t0, ch0, speed, batt):
    v = speed * 1000; t = ln = shadow = 0.0; ch = ch0; dead = None; steep = SL[path[0]]
    for k in range(1, len(path)):
        (e0, n0), (e1, n1) = en(path[k - 1]), en(path[k]); d = math.hypot(e1 - e0, n1 - n0); dt = d / v
        az, el = sun(t0 + t + dt)
        if margin(path[k], az, el) < 0:
            if dead is None and ch - dt < 0: dead = (ln + d * ch / dt) / 1000
            ch -= dt; shadow += dt
        else: ch = min(batt, ch + dt)
        t += dt; ln += d; steep = max(steep, SL[path[k]])
    return dict(len=ln, time=t, shadow=shadow, end=max(0.0, ch), dead=dead, steep=float(steep))
def cell(e, n): return max(0, min(G - 1, int(math.floor((HALF - n) / CELL)))) * G + max(0, min(G - 1, int(math.floor((e + HALF) / CELL))))
if __name__ == "__main__":
    import datetime as dt
    i0 = int((dt.datetime(2027, 10, 20, tzinfo=dt.timezone.utc) - dt.datetime(2023, 8, 1, tzinfo=dt.timezone.utc)).total_seconds() // 3600)
    out = {"i0": i0, "margins": [], "routes": []}
    rng = np.random.default_rng(7)
    for _ in range(300):
        k = int(rng.integers(0, G * G)); t = i0 + float(rng.uniform(0, 700)); az, el = sun(t)
        out["margins"].append([k, t, margin(k, az, el)])
    cases = [((60, -60), (-1700, 0), 0, 0.7, 15, 2), ((60, -60), (-1700, 0), 4, 0.7, 15, 2), ((60, -60), (-1300, 100), 8, 0.7, 15, 1.5), ((60, -60), (0, -1400), 0, 0.7, 15, 2),
             ((60, -60), (600, 600), 0, 0.4, 12, 2), ((-900, -900), (700, 500), 2, 1.2, 18, 3), ((60, -60), (-620, 760), 0, 0.7, 10, 2), ((300, 300), (-1500, -200), 20, 0.3, 15, 1),
             ((60, -60), (-1700, 0), 0, 0.7, 15, 2, 300), ((60, -60), (-1700, 0), 4, 0.7, 15, 2, 300), ((-500, 900), (900, -1100), 1, 2.0, 20, 4, 450)]
    for cs in cases:
        (a, b, lam, speed, lim, batt), dt_h = cs[:6], (cs[6] if len(cs) > 6 else 0)
        r = search(cell(*a), cell(*b), i0 + dt_h, lam, speed, lim)
        rec = dict(a=a, b=b, lam=lam, speed=speed, lim=lim, batt=batt, t0=i0 + dt_h)
        if r is None: rec["none"] = True
        else: rec.update(sim(r[0], i0 + dt_h, batt, speed, batt), cost=r[1], cells=len(r[0]))
        out["routes"].append(rec); print(rec)
    json.dump(out, open('rover_ref.json', 'w'))
