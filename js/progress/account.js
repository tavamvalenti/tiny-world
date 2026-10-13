// ACCOUNTS: a username (the player's unique leaderboard name), a password or a PIN, and an account ID (the player
// id). With an account, the whole profile (XP, Cash, purchases, records, achievements...) is kept on the server too,
// so you can sign in on any device and carry on. The game keeps only a sign-in token (in this browser), never the
// password. Simple by design (server/accounts.sql): enough to own your name and your progress.
const AKEY = 'tinyworld.account', PKEY = 'tinyworld.profile';
const read = () => { try { return JSON.parse(localStorage.getItem(AKEY) || 'null'); } catch { return null; } };
const write = (a) => { try { if (a) localStorage.setItem(AKEY, JSON.stringify(a)); else localStorage.removeItem(AKEY); } catch { /* ignore */ } };

export const REASONS = {
  'bad name': 'Usernames are 3–18 letters, numbers, spaces, dots, dashes or underscores.',
  'bad pin': 'A PIN is 4 to 8 digits.', 'bad password': 'A password is 4 to 64 characters.',
  taken: 'That username belongs to someone else.', exists: 'This profile already has an account. Sign in instead.',
  'no account': 'No account with that username.', wrong: 'That password or PIN isn\'t right.', locked: 'Too many tries. Wait a minute and try again.',
  'slow down': 'Too many tries at once. Wait a moment.', 'bad picture': 'That picture couldn\'t be used. Try another (JPG or PNG).', 'signed out': 'You were signed out (the password or PIN was changed elsewhere). Sign in again.',
  offline: 'Can\'t reach the server right now. Check your connection and try again.',
};

export class Account {
  constructor(progress) {
    this.p = progress; this.a = read();
    progress.afterSave = () => this.queueCloud();
    // leaving the page: one last save to the account
    addEventListener('pagehide', () => { if (this.signedIn && this.cloudDirty) this.cloudSave(true); });
    if (this.signedIn) setTimeout(() => this.pull(), 1500);
  }
  get lb() { return this.p.lb; }
  get available() { return !!this.lb.provider; }
  get signedIn() { return !!(this.a && this.a.token && this.a.player === this.p.P.id); }
  get name() { return this.a ? this.a.name : null; }
  get kind() { return this.a ? this.a.kind : null; }
  // the account ID people can quote: TW- and the first eight characters of the player id
  get accountId() { return `TW-${String(this.p.P.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`; }
  async call(fn, ...args) {
    if (!this.available) return { ok: false, reason: 'offline' };
    try { return (await this.lb.provider[fn](...args)) || { ok: false, reason: 'offline' }; } catch { return { ok: false, reason: 'offline' }; }
  }
  // turn this profile (and its progress) into an account
  async create(name, secret, kind) {
    name = String(name || '').trim();
    this.p.save();
    const r = await this.call('accountCreate', this.p.P.id, name, secret, kind, this.p.P);
    if (!r.ok) return r;
    this.a = { player: r.player, name: r.name, token: r.token, kind }; write(this.a);
    const P = this.p.P; P.name = r.name; P.nameAuto = false; P.nameClaimed = r.name; P.nameStatus = 'ok'; this.p.touch(true);
    if (P.avatar) this.call('accountAvatar', r.player, r.token, P.avatar);       // a picture chosen before: up it goes
    return r;
  }
  // sign in: this browser takes on the account's progress (the progress that was here is kept aside, not lost)
  async login(name, secret) {
    const r = await this.call('accountLogin', String(name || '').trim(), secret);
    if (!r.ok) return r;
    try {
      const cur = localStorage.getItem(PKEY);
      if (cur && !cur.includes(r.player)) localStorage.setItem(`${PKEY}.before-sign-in-${Date.now()}`, cur);
      const prof = r.profile && typeof r.profile === 'object' ? r.profile : { xp: 0 };
      const m = cur && /"__rev":(\d+)/.exec(cur);
      prof.id = r.player; prof.name = r.name; prof.nameClaimed = r.name; prof.nameStatus = 'ok'; prof.__rev = Math.max(prof.__rev || 0, m ? +m[1] : 0) + 1;
      localStorage.setItem(PKEY, JSON.stringify(prof));
    } catch { return { ok: false, reason: 'offline' }; }
    this.a = { player: r.player, name: r.name, token: r.token, kind: r.kind }; write(this.a);
    setTimeout(() => location.reload(), 600);
    return r;
  }
  async changeSecret(oldS, newS, kind) {
    if (!this.signedIn) return { ok: false, reason: 'signed out' };
    const r = await this.call('accountChange', this.a.player, this.a.token, oldS, newS, kind);
    if (r.ok) { this.a.token = r.token; this.a.kind = kind; write(this.a); }
    return r;
  }
  // the profile picture: kept in the profile (so it travels with it) and, with an account, shown on the boards
  async setAvatar(dataUrl) {
    this.p.P.avatar = dataUrl || null; this.p.P.avatarWaiting = true; this.p.touch(true);
    if (!this.signedIn) return { ok: true, local: true };
    return this.sendAvatar();
  }
  // up to the account (for the boards); if that can't happen now, it's sent the next time the game connects
  async sendAvatar() {
    if (!this.signedIn) return { ok: false, reason: 'signed out' };
    const r = await this.call('accountAvatar', this.a.player, this.a.token, this.p.P.avatar || null);
    if (r.ok) { this.p.P.avatarWaiting = false; this.p.touch(true); return r; }
    return r.reason === 'bad picture' ? r : { ok: true, waiting: true };
  }
  // delete the account (and its scores and name) for good; this browser starts over as a guest
  async deleteAccount() {
    if (!this.signedIn) return { ok: false, reason: 'signed out' };
    const r = await this.call('accountDelete', this.a.player, this.a.token);
    if (!r.ok) return r;
    try { const cur = localStorage.getItem(PKEY); if (cur) localStorage.setItem(`${PKEY}.deleted-${Date.now()}`, cur); localStorage.removeItem(PKEY); } catch { /* ignore */ }
    this.a = null; write(null); this.p.save = () => {};
    setTimeout(() => location.reload(), 900);
    return r;
  }
  // sign out: the progress stays safe in the account; this browser starts over as a guest
  signOut() {
    this.cloudSave(true);
    try { const cur = localStorage.getItem(PKEY); if (cur) localStorage.setItem(`${PKEY}.signed-out-${Date.now()}`, cur); localStorage.removeItem(PKEY); } catch { /* ignore */ }
    this.a = null; write(null);
    this.p.save = () => {};                        // don't write the old profile back on the way out
    setTimeout(() => location.reload(), 300);
  }
  // keeping the account's copy current: a few seconds after changes, and when the page goes away
  queueCloud() {
    if (!this.signedIn) return;
    this.cloudDirty = true;
    clearTimeout(this.cloudT); this.cloudT = setTimeout(() => this.cloudSave(), 8000);
  }
  async cloudSave(keepalive = false) {
    if (!this.signedIn || this.saving) return;
    this.saving = true; this.cloudDirty = false;
    const r = await this.call('accountSave', this.a.player, this.a.token, this.p.P, keepalive);
    this.saving = false;
    if (!r.ok) {
      if (r.reason === 'signed out') { this.a = null; write(null); this.p.emit('change'); return; }
      if (r.reason === 'older') { this.pull(); return; }                 // another device has played since: take its progress
      this.cloudDirty = true; clearTimeout(this.cloudT); this.cloudT = setTimeout(() => this.cloudSave(), 30000);   // try again later
    } else { this.lastCloud = Date.now(); this.p.emit('change'); }
  }
  // another device may have played since: take the account's copy if it's newer than this one
  async pull() {
    if (!this.signedIn) return;
    const r = await this.call('accountLoad', this.a.player, this.a.token);
    if (!r.ok) { if (r.reason === 'signed out') { this.a = null; write(null); this.p.emit('change'); } return; }
    const prof = r.profile;
    if (prof && typeof prof === 'object' && (prof.savedAt || 0) > (this.p.P.savedAt || 0) + 1000) {
      prof.__rev = Math.max(prof.__rev || 0, this.p.P.__rev || 0) + 1;
      if (this.p.adopt(prof)) { this.p.save(); this.p.emit('toast', { text: 'Progress loaded from your account' }); }
    }
    if (r.name && r.name !== this.a.name) { this.a.name = r.name; write(this.a); }
    if (this.p.P.avatarWaiting) this.sendAvatar();
  }
}
