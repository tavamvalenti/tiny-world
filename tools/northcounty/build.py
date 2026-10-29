# nc.json (metres, coast-aligned frame) -> js/ncdata.js (game units): the North County map's geography.
# Scale 5.5 m per unit. The downtowns, the village, the Barrio, the lagoons and the harbor keep their real shape;
# only two stretches are squeezed along the coast: north of downtown Oceanside to the river (x0.55) and
# South Oceanside, Wisconsin Ave to Vista Way (x0.3). Inland of x = 700 m (past I-5) is squeezed x0.4.
import json, math, sys
SRC, OUT = sys.argv[1], sys.argv[2]
d = json.load(open(SRC))
S = 5.5
ZK = [(-1e9, 1.0), (-6000, 0.55), (-5150, 1.0), (-3650, 0.3), (-1250, 1.0)]   # (from z, slope) in metres
def F(z):
    v = 0.0
    for k, (z0, s) in enumerate(ZK):
        z1 = ZK[k + 1][0] if k + 1 < len(ZK) else 1e9
        a = max(z0, -20000) if k == 0 else z0
        if z <= a: break
        v += (min(z, z1) - a) * s
    return v
def FX(x): return x if x < 700 else 700 + (x - 700) * 0.4
# the origin: Carlsbad Blvd and Carlsbad Village Dr (the arch)
def near(nameA, nameB):
    A = [q for r in d['roads'] if r['n'] == nameA for q in r['p']]; Bp = [q for r in d['roads'] if r['n'] == nameB for q in r['p']]
    best = min(((math.hypot(a[0] - b[0], a[1] - b[1]), a, b) for a in A for b in Bp))
    return [(best[1][0] + best[2][0]) / 2, (best[1][1] + best[2][1]) / 2]
O = near('Carlsbad Boulevard', 'Carlsbad Village Drive')
OX, OZ = FX(O[0]), F(O[1])
def M(p): return [round((FX(p[0]) - OX) / S, 2), round((F(p[1]) - OZ) / S, 2)]
def MP(pts): return [M(p) for p in pts]
# the playable land: how far inland it runs (metres) at each point along the coast
def XMAX(z): return 1980 if z > -450 else 1000
Z_LO, Z_HI = -7060, 2320
inside = lambda p: Z_LO < p[1] < Z_HI and p[0] < XMAX(p[1]) + 60

out = {'S': S, 'origin_m': O, 'ZK': ZK}
b0, b1 = M([-1600, Z_LO]), M([2000, Z_HI])
out['bounds'] = {'x0': b0[0], 'z0': b0[1], 'x1': M([1980, 0])[0], 'z1': b1[1]}
out['xmaxCarlsbad'] = M([1980, 0])[0]; out['xmaxOceanside'] = M([1000, 0])[0]; out['eastBreakZ'] = M([0, -450])[1]

# ---------- coast: chain the coastline ways end to end ----------
ways = [w[:] for w in d['coast']]
chains = []
while ways:
    c = ways.pop(0); grown = True
    while grown:
        grown = False
        for w in ways:
            if w[0] == c[-1]: c += w[1:]; ways.remove(w); grown = True; break
            if w[-1] == c[0]: c = w[:-1] + c; ways.remove(w); grown = True; break
    chains.append(c)
chains.sort(key=len, reverse=True)
out['coast'] = [MP(c) for c in chains]
print('coast chains', [len(c) for c in chains], [(c[0], c[-1]) for c in chains])

# ---------- water bodies ----------
def joinRings(rings):
    rings = [r[:] for r in rings]; res = []
    while rings:
        c = rings.pop(0); grown = True
        while grown and c[0] != c[-1]:
            grown = False
            for w in rings:
                if w[0] == c[-1]: c += w[1:]; rings.remove(w); grown = True; break
                if w[-1] == c[-1]: c += w[::-1][1:]; rings.remove(w); grown = True; break
        res.append(c)
    return res
def area(r): return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(r, r[1:] + r[:1]))) / 2
out['water'] = []
for w in d['water']:
    if w['k'] in ('fountain', 'wastewater'): continue
    for r in joinRings(w['rings']):
        if len(r) < 4 or area(r) < 2000: continue
        out['water'].append({'n': w['n'] or ('San Luis Rey River' if w['k'] == 'river' else 'Buena Vista Lagoon'), 'p': MP(r)})
out['river'] = [{'n': r['n'], 'p': MP(r['p'])} for r in d['river'] if r['n'] in ('San Luis Rey River', 'Loma Alta Creek', 'Buena Vista Creek', 'Agua Hedionda Creek')]
out['beach'] = [{'n': b['n'], 'p': MP(b['p'])} for b in d['beach'] if len(b['p']) > 3]
out['piers'] = [{'n': p['n'], 'k': p['k'], 'p': MP(p['p'])} for p in d['piers'] if any(inside(q) for q in p['p'])]
out['rail'] = [{'s': r['s'], 'p': MP(r['p'])} for r in d['rail'] if any(inside(q) for q in r['p'])]
out['poi'] = [{'n': p['n'], 'k': p['k'], 'x': M([p['x'], p['z']])[0], 'z': M([p['x'], p['z']])[1]} for p in d['poi'] if inside([p['x'], p['z']])]

# ---------- roads ----------
DRIVE = ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street')
MAJOR = ('primary', 'secondary', 'tertiary')
WIDTH = {'motorway': 7.0, 'trunk': 5.0, 'primary': 5.0, 'secondary': 4.6, 'tertiary': 4.2, 'residential': 3.6, 'unclassified': 3.4, 'living_street': 3.0, 'motorway_link': 2.6, 'trunk_link': 2.6, 'pedestrian': 2.2}
def slope(z): return [s for z0, s in ZK if z >= z0][-1]
segs = []   # (axis, coord, t0, t1, w, roadIndex, segIndex)
paint, freeway = [], []
for ri, r in enumerate(d['roads']):
    h = r['h']
    if h not in WIDTH: continue
    if not any(inside(q) for q in r['p']): continue
    P = MP(r['p'])
    if h in ('motorway', 'motorway_link', 'trunk', 'trunk_link'):
        freeway.append({'n': r['n'], 'h': h, 'w': WIDTH[h], 'p': P, 'b': r['b']}); continue
    loose = []
    for k, ((x0, z0), (x1, z1)) in enumerate(zip(P, P[1:])):
        mz = (r['p'][k][1] + r['p'][k + 1][1]) / 2
        dx, dz = x1 - x0, z1 - z0; L = math.hypot(dx, dz)
        ok = h in DRIVE and r['p'][k][0] < XMAX(mz) and Z_LO + 200 < mz < Z_HI - 80
        if ok and L >= 2.5 and abs(dx) <= 0.08 * abs(dz) and (slope(mz) == 1.0 or True):
            segs.append(['v', (x0 + x1) / 2, min(z0, z1), max(z0, z1), WIDTH[h], ri, k, h]); continue
        if ok and L >= 2.5 and abs(dz) <= 0.08 * abs(dx) and (slope(mz) == 1.0 or h in MAJOR):
            segs.append(['h', (z0 + z1) / 2, min(x0, x1), max(x0, x1), WIDTH[h], ri, k, h]); continue
        loose.append(k)
    # what's not on the grid gets painted as it is (runs of consecutive loose segments)
    run = []
    for k in loose:
        if run and k != run[-1] + 1: paint.append({'h': h, 'w': WIDTH[h], 'p': P[run[0]:run[-1] + 2], 'n': r['n']}); run = []
        run.append(k)
    if run: paint.append({'h': h, 'w': WIDTH[h], 'p': P[run[0]:run[-1] + 2], 'n': r['n']})

def cluster(vals, tol):
    vals = sorted(vals); groups = []
    for v, w in vals:
        if groups and v - groups[-1][-1][0] < tol: groups[-1].append((v, w))
        else: groups.append([(v, w)])
    return [sum(v * w for v, w in g) / sum(w for v, w in g) for g in groups]
def lines(axis):
    S_ = [s for s in segs if s[0] == axis]
    c = cluster([(s[1], s[3] - s[2]) for s in S_], 2.2)
    # merge lines that ended up too close together
    c.sort(); m = []
    for v in c:
        if m and v - m[-1] < 5.0: m[-1] = (m[-1] + v) / 2
        else: m.append(v)
    return [round(v, 2) for v in m]
xs, zs = lines('v'), lines('h')
snap = lambda arr, v: min(range(len(arr)), key=lambda i: abs(arr[i] - v))
cover = {}; names = {}
for s in segs:
    arr, oth = (xs, zs) if s[0] == 'v' else (zs, xs)
    i = snap(arr, s[1])
    if abs(arr[i] - s[1]) > 3.2: continue
    cover.setdefault((s[0], i), []).append((s[2], s[3], s[4], s[7]))
    nm = d['roads'][s[5]]['n']
    if nm: names.setdefault((s[0], i), {}).setdefault(nm, 0); names[(s[0], i)][nm] += s[3] - s[2]
# each grid line's streets, longest first, with where each runs ([name, from, to] along the line)
def lineNames(ax, n):
    out_ = []
    for i in range(n):
        runs = []
        for s in segs:
            arr = xs if ax == 'v' else zs
            if s[0] != ax or snap(arr, s[1]) != i or abs(arr[i] - s[1]) > 3.2: continue
            nm = d['roads'][s[5]]['n']
            if not nm: continue
            hit = next((r for r in runs if r[0] == nm), None)
            if hit: hit[1] = min(hit[1], s[2]); hit[2] = max(hit[2], s[3])
            else: runs.append([nm, s[2], s[3]])
        out_.append([[r[0], round(r[1], 1), round(r[2], 1)] for r in sorted(runs, key=lambda r: r[1] - r[2])])
    return out_
E = []   # [axis, i, j, width]: v: node (i,j)-(i,j+1); h: node (j,i)... stored as (xi, zj) of the lower end
for (ax, i), iv in cover.items():
    oth = zs if ax == 'v' else xs
    for j in range(len(oth) - 1):
        a, b = oth[j], oth[j + 1]; L = b - a
        got = 0; w = 0
        for t0, t1, ww, h in iv:
            o = min(b, t1) - max(a, t0)
            if o > 0: got += o; w = max(w, ww)
        if got >= 0.6 * L:
            E.append([ax, i, j, w] if ax == 'v' else [ax, j, i, w])
out['xs'], out['zs'] = xs, zs
out['xn'], out['zn'] = lineNames('v', len(xs)), lineNames('h', len(zs))
out['edges'] = [[0 if e[0] == 'v' else 1, e[1], e[2], e[3]] for e in E]
# segments that ended up on the grid are drawn by the grid; keep the rest
on = set()
for s in segs:
    arr = xs if s[0] == 'v' else zs
    i = snap(arr, s[1])
    if abs(arr[i] - s[1]) <= 3.2: on.add((s[5], s[6]))
    else: paint.append({'h': s[7], 'w': s[4], 'p': MP(d['roads'][s[5]]['p'][s[6]:s[6] + 2]), 'n': d['roads'][s[5]]['n']})
out['paint'] = paint
out['freeway'] = freeway
print('lattice', len(xs), 'x', len(zs), 'edges', len(E), 'paint', len(paint), 'freeway', len(freeway))
print('bounds', out['bounds'], 'origin', O)
for k in ('coast', 'water', 'river', 'beach', 'piers', 'rail', 'poi'): print(k, len(out[k]))
js = '// North County (Carlsbad & Oceanside) geography in game units: generated from OpenStreetMap data\n// (c) OpenStreetMap contributors, ODbL. Built by a script from the OSM extract; see js/ncgeo.js for what it holds.\nexport default ' + json.dumps(out, separators=(',', ':')) + ';\n'
open(OUT, 'w').write(js)
print('bytes', len(js))
