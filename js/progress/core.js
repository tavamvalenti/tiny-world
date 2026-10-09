// Progression: the player's profile (saved in localStorage, versioned, survives reloads and map changes), XP and
// ranks, records, achievements, map / daily / weekly challenges and unlockable rewards.
// The game reports real events here (G.progress.cell(), .throwLanded(), .boatSunk(), ...); nothing is inferred from
// UI clicks or timers. Daily and weekly challenges rotate on UTC dates: the set for a period is chosen from the date
// and stored, so reloading can't reroll it. The clock is the player's own, so none of this is tamper-proof.
import { G } from '../core.js';
import * as D from './defs.js';
import { Leaderboard } from './leaderboard.js';

const KEY = 'tinyworld.profile', VERSION = 1;
const STYLE_VALUE = { office: 42000, concrete: 36000, glass: 52000, gothic: 140000, limestone: 260000, islamic: 120000, brick: 18000, house: 14000, stucco: 16000, flat: 15000, cairo: 9000, cairobrick: 7000, nordic: 12000, boarded: 6000, garage: 8000, site: 10000 };

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
function defaults() {
  return {
    v: VERSION, id: uuid(), name: `Player-${Math.floor(1000 + Math.random() * 9000)}`, created: Date.now(), xp: 0,
    stats: { cells: 0, damage: 0, time: 0, maps: {}, discovered: {}, mapPlaces: {}, tools: {}, vehicles: {}, landmarks: {}, boats: 0, splats: 0, events: {}, best: {}, recordMaps: {}, mapStats: {}, challengesDone: 0, acts: {} },
    records: {},          // id or id:map -> { value, prev, date, map }
    ach: {},              // achievement id -> date unlocked
    mapc: {},             // map challenge id -> date completed
    periods: { day: null, week: null },
    unlocked: {}, equipped: { title: null, drone_paint: 'p_drone_black', jetpack_paint: 'p_jet_red', chair_balloons: 'p_bal_party', badges: [] },
    pending: [],          // leaderboard submissions waiting for the service
  };
}
// fill in anything missing (older saves, partial data) without throwing away what's there
function merge(base, saved) {
  if (saved === null || typeof saved !== 'object' || Array.isArray(base) !== Array.isArray(saved)) return base;
  if (Array.isArray(base)) return saved;
  const out = { ...base };
  for (const k of Object.keys(saved)) out[k] = k in base && base[k] !== null && typeof base[k] === 'object' ? merge(base[k], saved[k]) : saved[k];
  return out;
}
// future save formats: each step upgrades from version n to n + 1
const MIGRATIONS = { /* 1: (p) => { ...; p.v = 2; return p; } */ };

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const weekKey = (d = new Date()) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, '0')}`; };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

export class Progress {
  constructor() {
    this.listeners = [];
    this.P = this.load();
    this.lb = new Leaderboard(this);
    this.map = null; this.frameCells = 0; this.frameDamage = 0;
    this.burst = { n: 0, last: -99 }; this.buckets = new Array(60).fill(0); this.bucketT = 0; this.bucketI = 0;
    this.xpBucket = { tokens: 600, t: performance.now() }; this.recCool = {};
    this.discT = 0; this.lmT = 0; this.checkT = 0; this.saveT = 0; this.dirty = false;
    this.session = { boats: 0 };
    this.ensurePeriods();
    this.unlockRewards(true);
    G.progress = this;
    addEventListener('beforeunload', () => this.save());
  }

  // ---------- storage ----------
  load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { /* storage blocked: play on without saving */ }
    if (!raw) return defaults();
    try {
      let p = JSON.parse(raw);
      while (p && p.v < VERSION && MIGRATIONS[p.v]) p = MIGRATIONS[p.v](p);
      if (!p || typeof p !== 'object' || typeof p.xp !== 'number' || !isFinite(p.xp) || p.xp < 0) throw new Error('bad profile');
      return merge(defaults(), p);
    } catch {
      try { localStorage.setItem(`${KEY}.corrupt-${Date.now()}`, raw); } catch { /* nowhere to keep it */ }
      return defaults();
    }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.P)); this.dirty = false; } catch { /* not persisted */ } }
  touch(now = false) { this.dirty = true; if (now) this.save(); this.emit('change'); }

  // ---------- notifications to the UI ----------
  on(fn) { this.listeners.push(fn); }
  emit(type, data) { for (const f of this.listeners) { try { f(type, data); } catch (e) { console.error(e); } } }

  // ---------- XP and ranks ----------
  get rankIndex() { let r = 0; for (let i = 0; i < D.RANKS.length; i++) if (this.P.xp >= D.RANKS[i].xp) r = i; return r; }
  get rank() { return D.RANKS[this.rankIndex]; }
  get nextRank() { return D.RANKS[this.rankIndex + 1] || null; }
  get unlockedCount() { return Object.keys(this.P.ach).length; }
  // destruction XP drips from a refilling allowance (so hours of bombing the same block can't farm it); everything
  // else is paid in full
  award(xp, reason, kind = 'other') {
    if (!(xp > 0)) return 0;
    if (kind === 'destruction') {
      const now = performance.now(), B = this.xpBucket;
      B.tokens = Math.min(600, B.tokens + (now - B.t) / 1000 * 2); B.t = now;           // 120 XP a minute, 600 banked at most
      xp = Math.min(xp, B.tokens); B.tokens -= xp;
      if (xp < 1) return 0;
    }
    xp = Math.round(xp);
    const before = this.rankIndex;
    this.P.xp += xp;
    const w = this.period('week'); if (w) w.counters.xp = (w.counters.xp || 0) + xp;
    if (kind !== 'destruction' || xp >= 20) this.emit('xp', { xp, reason });
    else { this.dripXp = (this.dripXp || 0) + xp; if (this.dripXp >= 25) { this.emit('xp', { xp: this.dripXp, reason: 'Destruction' }); this.dripXp = 0; } }
    if (this.rankIndex > before) { this.emit('rankup', { rank: this.rank, xp: this.P.xp }); this.unlockRewards(); this.checkAchievements(); this.touch(true); }
    else this.touch();
    return xp;
  }

  // ---------- events the game reports ----------
  mapLoaded(name, city) {
    this.map = name; this.city = city; this.session = { boats: 0 };
    const S = this.P.stats, first = !S.maps[name];
    S.maps[name] = (S.maps[name] || 0) + 1;
    this.counter('maps', name);
    if (first) this.award(150, `First visit: ${D.MAP_LABELS[name] || name}`);
    this.places = null; this.landmarkSets = null;      // built once the map has finished loading
    this.touch(true);
  }
  // a block of a building was destroyed
  cell(c) {
    this.frameCells++;
    this.frameDamage += (STYLE_VALUE[c.style] || 20000) * (c.b && c.b.landmark ? 3 : 1);
  }
  toolUse(id) {
    const S = this.P.stats; if (!S.tools[id]) { S.tools[id] = 1; this.touch(); } else S.tools[id]++;
    this.counter('tools', id);
  }
  vehicle(kind) { const S = this.P.stats; S.vehicles[kind] = (S.vehicles[kind] || 0) + 1; this.counter('vehicles', kind); this.touch(); }
  boatSunk() {
    const S = this.P.stats; S.boats++; this.ms().boats = (this.ms().boats || 0) + 1; this.session.boats++;
    this.counter('boats'); this.award(15, 'Boat sunk');
    this.setRecord('boats_session', this.session.boats, this.map, { silentBelow: 3 });
  }
  // something thrown by the Free Hand came down: how far from where it was let go
  throwLanded(kind, dist) {
    const m = dist * D.M_PER_UNIT; if (!(m > 2)) return;
    const id = kind === 'car' ? 'car_throw' : 'person_throw';
    this.setRecord(id, Math.round(m * 10) / 10, this.map, { evidence: { dist: m } });
    if (kind === 'car') { const ms = this.ms(); ms.carThrow = Math.max(ms.carThrow || 0, m); if (m >= 25) this.counter('carThrow25'); }
  }
  droneCrash() { this.droneWatch = { start: G.buildings ? G.buildings.destroyed : 0, t: 2.5 }; }
  jetpackLanded(dropUnits, died) {
    if (died) { this.P.stats.splats++; this.touch(); return; }
    const m = dropUnits * D.M_PER_UNIT; if (m > 4) this.setRecord('jetpack_fall', Math.round(m * 10) / 10, this.map, { silentBelow: 8 });
  }
  event(id) { const S = this.P.stats; S.events[id] = (S.events[id] || 0) + 1; this.award(id === 'london_eye' ? 200 : 60, id === 'london_eye' ? 'The London Eye toppled' : 'Iceberg broken up'); this.checkAchievements(); }

  ms() { const S = this.P.stats; return (S.mapStats[this.map] ||= {}); }

  // ---------- per-frame bookkeeping ----------
  update(dt) {
    if (!this.map) return;
    const S = this.P.stats, now = G.time;
    S.time += dt; const ms = this.ms(); ms.time = (ms.time || 0) + dt;
    // destruction this frame: totals, damage, XP, bursts and the 60-second rampage window
    if (this.frameCells) {
      const n = this.frameCells; this.frameCells = 0;
      S.cells += n; S.damage += this.frameDamage; ms.cells = (ms.cells || 0) + n; this.frameDamage = 0;
      this.counter('cells', null, n);
      this.award(n * 0.3, 'Destruction', 'destruction');
      if (now - this.burst.last > 2.5) this.burst.n = 0;
      this.burst.n += n; this.burst.last = now; this.burst.open = true;
      this.buckets[this.bucketI] += n;
    }
    if (this.burst.open && now - this.burst.last > 2.5) this.endBurst();
    if ((this.bucketT += dt) >= 1) {
      this.bucketT = 0;
      const sum = this.buckets.reduce((a, b) => a + b, 0);
      if (sum >= 50) this.setRecord('rampage_60', sum, this.map, { quietUntilDone: true });
      this.bucketI = (this.bucketI + 1) % 60; this.buckets[this.bucketI] = 0;
    }
    // a drone crash: what it took with it over the next couple of seconds
    if (this.droneWatch && (this.droneWatch.t -= dt) <= 0) {
      const n = (G.buildings ? G.buildings.destroyed : 0) - this.droneWatch.start; this.droneWatch = null;
      if (n > 0) this.setRecord('drone_kamikaze', n, this.map);
    }
    // the balloon chair's height above the ground
    const V = G.veh;
    if (V && V.active && V.kind === 'chair' && !V.dead) {
      const B = G.buildings, g = B ? B.surfaceAt(V.pos.x, V.pos.z, V.pos.y + 0.5).y : 0, m = (V.pos.y - g) * D.M_PER_UNIT;
      this.chairMax = Math.max(this.chairMax || 0, m);
      if (this.chairMax > 30 && m < this.chairMax - 15) { this.setRecord('chair_altitude', Math.round(this.chairMax), this.map); this.chairMax = m; }
    } else if (this.chairMax) { if (this.chairMax > 30) this.setRecord('chair_altitude', Math.round(this.chairMax), this.map); this.chairMax = 0; }
    if ((this.discT -= dt) <= 0) { this.discT = 0.5; this.discover(); }
    if ((this.lmT -= dt) <= 0) { this.lmT = 2; this.landmarkCheck(); }
    if ((this.checkT -= dt) <= 0) { this.checkT = 1; this.ensurePeriods(); this.checkAchievements(); this.checkChallenges(); }
    if ((this.saveT -= dt) <= 0) { this.saveT = 5; if (this.dirty) this.save(); }
  }
  endBurst() {
    const n = this.burst.n; this.burst.open = false; this.burst.n = 0;
    if (n < 20) return;
    this.setRecord('destruction_event', n, this.map);
    if (n >= 150) this.counter('bigEvent150');
    if (n >= 100) this.award(n >= 1000 ? 250 : n >= 400 ? 120 : 50, `Destruction event: ${n.toLocaleString()} blocks`);
  }

  // ---------- places: reaching a named place discovers it ----------
  buildPlaces() {
    if (this.places || !G.news || !G.news.lms) return;
    const seen = new Set(), list = [];
    for (const l of G.news.lms()) {
      const name = l.S; if (!name || l.street || seen.has(name)) continue;
      seen.add(name); list.push({ name, x0: l.x0, x1: l.x1, z0: l.z0, z1: l.z1 });
    }
    this.places = list;
    this.P.stats.mapPlaces[this.map] = list.length;
    // the buildings that make each place a landmark (only places with real buildings standing in them count)
    const B = G.buildings;
    this.landmarkSets = list.map((p) => {
      const cells = [];
      for (const b of B.list) if (b.x > p.x0 && b.x < p.x1 && b.z > p.z0 && b.z < p.z1) cells.push(...b.cells);
      return cells.length >= 30 ? { name: p.name, cells, total: cells.length } : null;
    }).filter(Boolean);
  }
  where() {
    const R = G.rick, V = G.veh;
    if (R && R.active) return R.pos;
    if (V && V.active) return V.pos;
    return G.camTarget;
  }
  discover() {
    this.buildPlaces(); if (!this.places) return;
    const p = this.where(); if (!p) return;
    const S = this.P.stats, got = (S.discovered[this.map] ||= []);
    for (const pl of this.places) {
      if (p.x < pl.x0 || p.x > pl.x1 || p.z < pl.z0 || p.z > pl.z1 || got.includes(pl.name)) continue;
      got.push(pl.name); this.counter('discover');
      this.emit('discover', { name: pl.name });
      this.award(30, `Discovered ${pl.name}`);
      this.touch(true);
    }
  }
  landmarkCheck() {
    if (!this.landmarkSets) return;
    const S = this.P.stats, down = (S.landmarks[this.map] ||= []);
    for (const L of this.landmarkSets) {
      if (L.done) continue;
      let alive = 0; for (const c of L.cells) if (c.alive) alive++;
      if (alive > L.total * 0.35) continue;
      L.done = true;
      if (!down.includes(L.name)) { down.push(L.name); this.award(120, `Brought down ${L.name}`); }
      else this.award(30, `Brought down ${L.name} again`);
      this.counter('landmarks'); this.emit('landmark', { name: L.name }); this.touch(true);
    }
  }

  // ---------- personal records ----------
  record(id, map) { return this.P.records[map ? `${id}:${map}` : id] || null; }
  setRecord(id, value, map, o = {}) {
    const def = D.RECORDS[id]; if (!def || !isFinite(value)) return false;
    if (def.max && value > def.max) return false;                  // impossible: ignore it
    if (def.min && value < def.min) return false;
    const better = (a, b) => (def.better === 'low' ? a < b : a > b);
    const S = this.P.stats;
    const put = (k) => {
      const cur = this.P.records[k];
      if (cur && !better(value, cur.value)) return false;
      this.P.records[k] = { value, prev: cur ? cur.value : null, date: Date.now(), map };
      return cur || true;
    };
    const was = put(id); if (def.perMap && map) put(`${id}:${map}`);
    if (!was) return false;
    S.best[id] = value; if (map) S.recordMaps[map] = true;
    const prev = was === true ? null : was.value;
    const notable = !(o.silentBelow && value < o.silentBelow);
    // tell the player (and pay a little) only for a real improvement, and not every second during a rampage
    const nowS = G.time, cool = this.recCool[id] || -99;
    if (notable && (prev == null || Math.abs(value - prev) >= Math.max(1, Math.abs(prev) * 0.05)) && nowS - cool > (o.quietUntilDone ? 15 : 3)) {
      this.recCool[id] = nowS;
      this.emit('record', { id, label: def.label, value, unit: def.unit, prev });
      if (prev != null) { this.counter('records'); this.award(40, `New record: ${def.label}`); }
    }
    if (def.board) this.lb.offer(id, value, map, o.evidence);
    this.touch();
    return true;
  }

  // ---------- mini-games (js/activities/) ----------
  // each activity's lifetime numbers: runs, best per mode, medals per mode, running totals
  actStats(id) { const A = (this.P.stats.acts ||= {}); return (A[id] ||= { runs: 0, best: {}, medals: {}, totals: {} }); }
  // a finished, validated run. Records go through setRecord (personal bests, leaderboards); XP comes from medals won
  // for the first time (once per mode, ever) and a small per-run amount that stops after a daily allowance per
  // activity, so replaying the easy part can't farm it. Returns what was earned, for the results card.
  activityRun(id, run) {
    const st = this.actStats(id), S = this.P.stats, low = run.better === 'low';
    st.runs++;
    if (run.best != null && isFinite(run.best) && (st.best[run.mode] == null || (low ? run.best < st.best[run.mode] : run.best > st.best[run.mode]))) st.best[run.mode] = run.best;
    for (const [k, v] of Object.entries(run.stats || {})) { if (typeof v === 'number' && isFinite(v)) { if (k.startsWith('max_')) st.totals[k] = Math.max(st.totals[k] || 0, v); else st.totals[k] = (st.totals[k] || 0) + v; } }
    const pbs = [];
    for (const [cat, v] of Object.entries(run.records || {})) {
      if (v == null || !isFinite(v) || v <= 0) continue;
      const had = this.P.records[cat];
      if (this.setRecord(cat, v, this.map, { evidence: { ...(run.evidence || {}), mode: run.mode } }) && had) pbs.push(cat);
    }
    let xp = 0;
    const R = { bronze: 1, silver: 2, gold: 3 }, PAY = { bronze: 100, silver: 200, gold: 400 };
    if (run.medal) {
      const had = R[st.medals[run.mode]] || 0;
      for (const m of ['bronze', 'silver', 'gold']) if (R[m] <= R[run.medal] && R[m] > had) xp += this.award(PAY[m], `${m[0].toUpperCase() + m.slice(1)} medal`);
      if (R[run.medal] > had) st.medals[run.mode] = run.medal;
      this.counter('medals'); if (run.medal === 'gold') this.counter('golds');
    }
    const day = this.period('day'), key = `actxp_${id}`, used = (day && day.counters[key]) || 0, room = Math.max(0, 400 - used);
    const runXp = Math.min(room, Math.round(run.xp || 0) + (pbs.length ? 40 : 0));
    if (runXp > 0) { const got = this.award(runXp, `Mini-game: ${run.title || id}`); xp += got; if (day) day.counters[key] = used + got; }
    this.counter('actRuns'); this.counter('acts', id);
    this.checkAchievements(); this.checkChallenges(); this.touch(true);
    return { pbs, xp };
  }

  // ---------- achievements ----------
  checkAchievements() {
    const S = this.P.stats;
    for (const a of D.ACHIEVEMENTS) {
      if (this.P.ach[a.id]) continue;
      const [have, need] = a.test(S, this);
      if (have >= need) {
        this.P.ach[a.id] = Date.now();
        this.emit('achievement', a);
        if (a.xp) this.award(a.xp, `Achievement: ${a.name}`);
        this.unlockRewards(); this.touch(true);
      }
    }
  }
  achProgress(a) { const [have, need] = a.test(this.P.stats, this); return { have: Math.min(have, need), need, done: !!this.P.ach[a.id] }; }

  // ---------- challenges ----------
  period(kind) { return this.P.periods[kind]; }
  ensurePeriods() {
    const pick = (pool, key, n) => {
      const r = seeded(hash(key)), S = this.P.stats;
      const total = Object.values(S.mapPlaces).reduce((a, b) => a + b, 0), found = Object.values(S.discovered).reduce((a, b) => a + b.length, 0);
      const ok = pool.filter((c) => !c.needsUndiscovered || total - found >= c.needsUndiscovered);
      const out = []; const left = ok.slice();
      while (out.length < n && left.length) out.push(left.splice(Math.floor(r() * left.length), 1)[0].id);
      return out;
    };
    const d = dayKey(), w = weekKey();
    if (!this.P.periods.day || this.P.periods.day.key !== d) this.P.periods.day = { key: d, ids: pick(D.DAILY_POOL, `day:${d}`, 3), counters: {}, sets: {}, done: [] };
    if (!this.P.periods.week || this.P.periods.week.key !== w) this.P.periods.week = { key: w, ids: pick(D.WEEKLY_POOL, `week:${w}`, 3), counters: {}, sets: {}, done: [] };
  }
  // a period counter: plain counts, or distinct things (maps, tools, vehicles) when a value is given
  counter(key, distinct = null, n = 1) {
    for (const kind of ['day', 'week']) {
      const p = this.P.periods[kind]; if (!p) continue;
      if (distinct != null) { const s = (p.sets[key] ||= []); if (!s.includes(distinct)) s.push(distinct); p.counters[key] = s.length; }
      else p.counters[key] = (p.counters[key] || 0) + n;
    }
  }
  periodList(kind) {
    const p = this.P.periods[kind], pool = kind === 'day' ? D.DAILY_POOL : D.WEEKLY_POOL; if (!p) return [];
    return p.ids.map((id) => { const c = pool.find((x) => x.id === id); return c && { ...c, have: Math.min(p.counters[c.key] || 0, c.target), done: p.done.includes(id) }; }).filter(Boolean);
  }
  mapChallengeList(map) { return D.MAP_CHALLENGES.filter((c) => !map || c.map === map).map((c) => { const [have, need] = c.test(this.P.stats); return { ...c, have: Math.min(have, need), need, done: !!this.P.mapc[c.id] }; }); }
  checkChallenges() {
    for (const kind of ['day', 'week']) for (const c of this.periodList(kind)) {
      if (c.done || c.have < c.target) continue;
      this.P.periods[kind].done.push(c.id); this.P.stats.challengesDone++;
      if (kind === 'day') this.counter('dailies');
      this.emit('challenge', { name: c.name, kind });
      this.award(c.xp, `${kind === 'day' ? 'Daily' : 'Weekly'} challenge: ${c.name}`); this.touch(true);
    }
    for (const c of D.MAP_CHALLENGES) {
      if (this.P.mapc[c.id]) continue;
      const [have, need] = c.test(this.P.stats);
      if (have >= need) { this.P.mapc[c.id] = Date.now(); this.P.stats.challengesDone++; this.emit('challenge', { name: c.name, kind: 'map' }); this.award(c.xp, `${D.MAP_LABELS[c.map]} challenge: ${c.name}`); this.unlockRewards(); this.touch(true); }
    }
  }

  // ---------- rewards ----------
  earned(r) { const h = r.how; return h.rank != null ? this.rankIndex >= h.rank : h.ach ? !!this.P.ach[h.ach] : h.mapc ? !!this.P.mapc[h.mapc] : false; }
  howText(r) { const h = r.how; if (h.rank != null) return `Reach the rank of ${D.RANKS[h.rank].name}`; if (h.ach) { const a = D.ACHIEVEMENTS.find((x) => x.id === h.ach); return `Achievement: ${a ? a.name : h.ach}`; } if (h.mapc) { const c = D.MAP_CHALLENGES.find((x) => x.id === h.mapc); return `${c ? D.MAP_LABELS[c.map] + ' challenge: ' + c.name : h.mapc}`; } return ''; }
  unlockRewards(silent = false) {
    for (const r of D.REWARDS) {
      if (this.P.unlocked[r.id] || !this.earned(r)) continue;
      this.P.unlocked[r.id] = Date.now();
      if (!silent && !(r.how.rank === 0)) this.emit('reward', r);
    }
  }
  equip(slot, id) {
    const r = D.REWARDS.find((x) => x.id === id); if (!r || r.slot !== slot || !this.P.unlocked[id]) return false;
    if (slot === 'badge') { const b = this.P.equipped.badges; const i = b.indexOf(id); if (i >= 0) b.splice(i, 1); else { b.push(id); if (b.length > 3) b.shift(); } }
    else this.P.equipped[slot] = id;
    this.touch(true); return true;
  }
  // what's equipped in a slot (the value for paint and palettes; the label for titles)
  equipped(slot) { const id = this.P.equipped[slot], r = D.REWARDS.find((x) => x.id === id); return r && this.P.unlocked[id] ? (r.value ?? r.label) : null; }
  // a new display name: checked with the leaderboard service, which keeps every name unique
  async setName(n) {
    const clean = String(n || '').replace(/[^A-Za-z0-9 _.\-]/g, '').trim().slice(0, 18);
    if (clean.length < 3) return { ok: false, reason: 'bad' };
    if (clean.toLowerCase() === (this.P.nameClaimed || '').toLowerCase() && clean === this.P.name) return { ok: true };
    const r = await this.lb.claimName(clean);
    if (!r.ok) return r;
    this.P.name = clean; this.P.nameStatus = r.local || r.offline ? 'unchecked' : 'ok'; if (r.local || r.offline) this.P.nameClaimed = null;
    this.touch(true); this.lb.flush();
    return r;
  }
}
