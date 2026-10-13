// INVITE FRIENDS: every player's own link (tavamadethis.com/?ref=CODE). A friend who opens it is remembered (here,
// for two weeks); when they create an account the server is told who sent them, and it decides whether that counts
// (server/referrals.sql: a genuinely new account, not you, not on your connection, once per friend) and when the
// friend qualifies (300 XP played). Rewards are collected through the server (once each, ever, from any device) and
// paid into the Cash wallet only when the server says the reward is new.
const RKEY = 'tinyworld.ref';
export const SITE = 'https://tavamadethis.com/';
export const REWARDS = { share: { amount: 3000, need: 1 }, five: { amount: 10000, need: 5 } };
export const DEFAULT_MSG = 'Come check out Tiny World — an interactive miniature destruction sandbox where you can explore cities, cause chaos, play mini-games, and compete with other players. Try it here: {link}';

export class Referral {
  constructor(progress) {
    this.p = progress;
    // arriving through someone's link: keep the code until there's an account to attach it to
    const m = /[?&]ref=([A-Za-z0-9]{5,12})\b/.exec(location.search);
    if (m) { try { if (!localStorage.getItem(RKEY)) localStorage.setItem(RKEY, JSON.stringify({ code: m[1].toUpperCase(), at: Date.now() })); } catch { /* fine */ } }
  }
  get lb() { return this.p.lb; }
  get available() { return !!this.lb.provider; }
  pending() {
    try { const r = JSON.parse(localStorage.getItem(RKEY) || 'null'); if (r && Date.now() - r.at < 14 * 864e5) return r; } catch { /* none */ }
    return null;
  }
  clearPending() { try { localStorage.removeItem(RKEY); } catch { /* fine */ } }
  async rpc(fn, body) { if (!this.available) return null; try { return await this.lb.provider.rpc(fn, body); } catch { return null; } }
  // my code (made by the server the first time), kept in the profile
  async code() {
    if (this.p.P.refCode) return this.p.P.refCode;
    const r = await this.rpc('ref_code', { p_player: this.p.P.id });
    if (r && r.ok && r.code) { this.p.P.refCode = r.code; this.p.touch(true); return r.code; }
    return null;
  }
  link(code) { return `${SITE}?ref=${code}`; }
  message(code, template) { const link = this.link(code), t = (template || this.template()); return t.includes('{link}') ? t.split('{link}').join(link) : `${t.trim()} ${link}`; }
  template() { try { return localStorage.getItem('tinyworld.inviteMsg') || DEFAULT_MSG; } catch { return DEFAULT_MSG; } }
  saveTemplate(t) { try { if (!t || t.trim() === DEFAULT_MSG) localStorage.removeItem('tinyworld.inviteMsg'); else localStorage.setItem('tinyworld.inviteMsg', t); } catch { /* fine */ } }
  async status() { return this.rpc('ref_status', { p_player: this.p.P.id }); }
  // a brand-new account: tell the server who sent us (once). Kept for later only if the server couldn't be reached
  async attachAfterCreate() {
    const r0 = this.pending(), A = this.p.account; if (!r0 || !A || !A.signedIn) return null;
    if (this.p.P.refCode && this.p.P.refCode === r0.code) { this.clearPending(); return { ok: false, reason: 'self' }; }
    const r = await this.rpc('ref_attach', { p_player: A.a.player, p_token: A.a.token, p_code: r0.code });
    if (r) this.clearPending();
    return r;
  }
  // collect a reward: the server records it (once, ever) and only then is the Cash paid
  async claim(kind) {
    const A = this.p.account;
    if (!A || !A.signedIn) return { ok: false, reason: 'account' };
    const r = await this.rpc('ref_claim', { p_player: A.a.player, p_token: A.a.token, p_kind: kind });
    if (!r) return { ok: false, reason: 'offline' };
    if (r.ok) this.p.wallet.credit(r.amount, kind === 'share' ? 'Invite reward: your first friend joined' : 'Invite reward: five friends joined', { claim: `ref:${kind}`, act: 'invite' });
    return r;
  }
}
