// Global leaderboards: asynchronous score competition (no multiplayer). The rest of the game talks to this
// service only; providers are swappable. Scores wait in a local queue (saved in the profile) and are sent when the
// service is available; nothing in the game waits on it. Local records are never shown as global rankings.
import { LEADERBOARD } from './config.js';
import { RECORDS } from './defs.js';

const VERSION = 'tw-1';

class SupabaseProvider {
  constructor(cfg) { this.url = cfg.url.replace(/\/$/, ''); this.key = cfg.anonKey; }
  async rpc(fn, body) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(`${this.url}/rest/v1/rpc/${fn}`, { method: 'POST', signal: ac.signal, headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
      if (!r.ok) { const e = new Error((data && data.message) || `HTTP ${r.status}`); e.status = r.status; throw e; }
      return data;
    } finally { clearTimeout(t); }
  }
  claim(player, name) { return this.rpc('claim_name', { p_player: player, p_name: name }); }
  submit(s) { return this.rpc('submit_score', { p_player: s.player, p_name: s.name, p_category: s.category, p_map: s.map || '', p_value: s.value, p_evidence: s.evidence || {}, p_version: VERSION }); }
  top(category, map, limit) { return this.rpc('top_scores', { p_category: category, p_map: map || '', p_limit: limit }); }
  mine(category, map, player) { return this.rpc('my_rank', { p_category: category, p_map: map || '', p_player: player }); }
}

export class Leaderboard {
  constructor(progress) {
    this.progress = progress;
    const c = LEADERBOARD;
    this.provider = c.provider === 'supabase' && c.url && c.anonKey ? new SupabaseProvider(c) : null;
    this.status = this.provider ? 'ready' : 'off';       // off | ready | offline | error
    this.lastError = '';
    if (this.provider) { setTimeout(() => this.flush(), 5000); addEventListener('online', () => this.flush()); }
  }
  get configured() { return !!this.provider; }
  get pending() { return this.progress.P.pending; }
  // a new personal best in a board category: keep the best per category + map waiting to go
  offer(category, value, map, evidence) {
    const def = RECORDS[category]; if (!def || !def.board) return;
    const P = this.progress.P, mapKey = def.perMap ? map || '' : '';
    const i = P.pending.findIndex((s) => s.category === category && s.map === mapKey);
    const s = { category, map: mapKey, value, evidence: { ...(evidence || {}), map: map || '' }, at: Date.now() };
    if (i >= 0) { const o = P.pending[i]; if (def.better === 'low' ? value < o.value : value > o.value) P.pending[i] = s; } else P.pending.push(s);
    clearTimeout(this.flushT); this.flushT = setTimeout(() => this.flush(), 3000);
  }
  // names are unique across all players (the server decides). A random default name that clashes is re-rolled; a
  // name the player chose that turns out to be taken pauses sending until they pick another
  async claimName(name) {
    if (!this.provider) return { ok: true, local: true };
    try {
      const r = await this.provider.claim(this.progress.P.id, name);
      if (r && r.ok) { this.progress.P.nameClaimed = name; return { ok: true }; }
      return { ok: false, reason: (r && r.reason) || 'taken' };
    } catch (e) { if (e.status === 400 && /bad name/.test(e.message)) return { ok: false, reason: 'bad' }; return { ok: true, offline: true }; }
  }
  async ensureName() {
    const P = this.progress.P;
    if (P.nameClaimed && P.nameClaimed === P.name) return true;
    for (let k = 0; k < 6; k++) {
      const r = await this.claimName(P.name);
      if (r.ok) { if (!r.offline) P.nameStatus = 'ok'; return !r.offline; }
      if (r.reason === 'taken' && /^Player-\d+$/.test(P.name)) { P.name = `Player-${Math.floor(1000 + Math.random() * 9000)}${k > 2 ? Math.floor(Math.random() * 10) : ''}`; continue; }
      P.nameStatus = 'taken'; this.status = 'name'; this.lastError = 'That name belongs to another player: choose a different one in your profile.'; return false;
    }
    return false;
  }
  async flush() {
    if (!this.provider || this.flushing) return;
    if (!navigator.onLine) { this.status = 'offline'; return; }
    this.flushing = true;
    const P = this.progress.P;
    try {
      for (const q of P.pending) delete q.skip;
      if (P.pending.length && !(await this.ensureName())) return;
      while (P.pending.length) {
        const s = P.pending[0];
        try {
          const res = await this.provider.submit({ ...s, player: P.id, name: P.name });
          (P.global ||= {})[`${s.category}:${s.map}`] = { value: s.value, rank: res && res.rank, at: Date.now() };
          P.pending.shift(); this.status = 'ready';
        } catch (e) {
          if (/name taken/i.test(e.message)) { P.nameClaimed = null; if (!(await this.ensureName())) break; continue; }   // someone has that name now
          if (/unknown category/i.test(e.message)) { const k = P.pending.shift(); P.pending.push(k); this.status = 'error'; this.lastError = 'This board isn\'t set up on the server yet'; if (P.pending.every((q) => q.skip)) break; k.skip = true; continue; }   // a new game's board the server doesn't know yet: keep it, try the rest
          if (e.status >= 400 && e.status < 500 && e.status !== 429 && !/slow down/i.test(e.message)) { (P.rejected ||= []).push({ ...s, why: e.message }); P.pending.shift(); this.lastError = e.message; continue; }   // refused by the server's checks
          this.status = e.status === 429 ? 'ready' : 'error'; this.lastError = e.message; break;                                                                          // try again later
        }
      }
    } finally { this.flushing = false; this.progress.touch(true); }
    if (P.pending.length) { clearTimeout(this.retryT); this.retryT = setTimeout(() => this.flush(), 120000); }
  }
  async top(category, map, limit = 10) { if (!this.provider) throw new Error('not configured'); return (await this.provider.top(category, map, limit)) || []; }
  async mine(category, map) { if (!this.provider) throw new Error('not configured'); return this.provider.mine(category, map, this.progress.P.id); }
}
