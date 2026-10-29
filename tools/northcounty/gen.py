# OSM extract -> North County data in metres, in the coast-aligned frame (up-coast = -z, inland = +x)
import json, math, sys
D, OUT = sys.argv[1], sys.argv[2]
d = json.load(open(D + '/all.json'))
p = json.load(open(D + '/poi.json'))
# the harbor's streets reach past the first extract's northern edge: add them from the harbor extract
seen = {e['id'] for e in d['elements']}
for e in json.load(open(D + '/harbor.json'))['elements']:
    if e['id'] not in seen and 'highway' in e.get('tags', {}): d['elements'].append(e); seen.add(e['id'])
LAT0, LON0, TH = 33.16115, -117.35045, 34.85
def loc(lat, lon):
    e = (lon - LON0) * math.cos(math.radians(LAT0)) * 111320; n = (lat - LAT0) * 110540
    t = math.radians(TH)
    return (e * math.cos(t) + n * math.sin(t), -(-e * math.sin(t) + n * math.cos(t)))
X0, X1, Z0, Z1 = -1400, 2300, -7300, 2600
def inb(pt, m=0): return X0 - m < pt[0] < X1 + m and Z0 - m < pt[1] < Z1 + m
def dp(pts, eps):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    if math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6:          # a closed ring: simplify each half
        h = len(pts) // 2
        return dp(pts[:h + 1], eps)[:-1] + dp(pts[h:], eps)
    dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1e-9
    best, bi = -1, 0
    for i in range(1, len(pts) - 1):
        q = pts[i]; dist = abs(dz * (q[0] - a[0]) - dx * (q[1] - a[1])) / L
        if dist > best: best, bi = dist, i
    if best > eps: return dp(pts[:bi + 1], eps)[:-1] + dp(pts[bi:], eps)
    return [a, b]
R = lambda pts: [[round(x), round(z)] for x, z in pts]
out = {'roads': [], 'rail': [], 'coast': [], 'water': [], 'river': [], 'piers': [], 'beach': [], 'poi': []}
for e in d['elements']:
    t = e.get('tags', {})
    if 'geometry' in e: pts = [loc(g['lat'], g['lon']) for g in e['geometry']]
    elif 'members' in e: pts = None
    else: continue
    if pts is not None and not any(inb(q, 200) for q in pts): continue
    if 'highway' in t:
        out['roads'].append({'n': t.get('name') or t.get('ref') or '', 'h': t['highway'], 'p': R(dp(pts, 2.5)), 'o': 1 if t.get('oneway') == 'yes' else 0, 'b': 1 if t.get('bridge') == 'yes' else 0, 'l': t.get('lanes', '')})
    elif t.get('railway') == 'rail':
        out['rail'].append({'n': t.get('name', ''), 's': t.get('service', ''), 'p': R(dp(pts, 2))})
    elif t.get('natural') == 'coastline':
        out['coast'].append(R(dp(pts, 2)))
    elif t.get('natural') == 'water' or t.get('waterway') in ('riverbank', 'dock'):
        if pts is None:
            rings = []
            for m in e['members']:
                if m.get('role') == 'outer' and 'geometry' in m: rings.append(R(dp([loc(g['lat'], g['lon']) for g in m['geometry']], 3)))
            out['water'].append({'n': t.get('name', ''), 'k': t.get('water', ''), 'rings': rings})
        else: out['water'].append({'n': t.get('name', ''), 'k': t.get('water', ''), 'rings': [R(dp(pts, 3))]})
    elif 'waterway' in t:
        out['river'].append({'n': t.get('name', ''), 'k': t['waterway'], 'p': R(dp(pts, 3))})
    elif 'man_made' in t:
        out['piers'].append({'n': t.get('name', ''), 'k': t['man_made'], 'p': R(dp(pts, 1)), 'area': 1 if t.get('area') == 'yes' else 0})
    elif t.get('natural') == 'beach':
        out['beach'].append({'n': t.get('name', ''), 'p': R(dp(pts, 3))})
for e in p['elements']:
    t = e.get('tags', {}); c = e.get('center') or e
    if 'lat' not in c or not t.get('name'): continue
    x, z = loc(c['lat'], c['lon'])
    if not inb((x, z)): continue
    k = [t[k] for k in ('railway', 'public_transport', 'amenity', 'leisure', 'tourism', 'historic') if k in t]
    out['poi'].append({'n': t['name'], 'k': k[0] if k else '', 'x': round(x), 'z': round(z)})
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()})
