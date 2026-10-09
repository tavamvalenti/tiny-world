// CASH: Tiny World's one currency. A single wallet in the player's profile (so it's the same on every map and
// survives reloads), changed only through credit() and debit() here: every change has a reason, an amount and the
// balance after it, and goes into the history. One-time rewards carry a claim key and can only ever be paid once
// (an achievement, a first gold medal, a finished run's payout), however often the code that pays them runs.
// XP and Cash are separate: XP is rank, Cash is spent. A leaderboard submission never pays anything.
// Every amount is set here (ECONOMY) so the whole economy can be balanced in one place.

export const ECONOMY = {
  starter: 1000,                 // the wallet opens with this (once)
  rescue: 250,                   // once ever, if you're down to nothing (cash < rescueBelow)
  rescueBelow: 25,
  // a mini-game's run payout shrinks after many runs of the same game in one UTC day (no farming the easy part)
  diminish: [[8, 1], [20, 0.5], [Infinity, 0.2]],
  tierMult: { bronze: 1.25, silver: 1.6, gold: 2.2 },          // a medal run pays more
  firstMedal: { bronze: 300, silver: 750, gold: 2000 },        // once per game, mode and medal
  personalBest: 75, personalBestMax: 3,                        // per record beaten in a run
  achievementPerXp: 2,                                         // an achievement pays twice its XP in Cash, once
  daily: 400, weekly: 2000, mapChallenge: 800,                 // challenge completions
  firstVisit: 200, firstRun: 250,                              // first time on a map / first finished run of a game
  traffic: { complete: 100, perThousand: 12, perKm: 45, nearMiss: 2, nearMissMax: 150, combo: 8, clean500: 20, collision: -10 },
  sled: { complete: 150, perJumpMetre: 1.5, perfect: 20, perfectMax: 10, shortcut: 100, clean: 150, stuntPerThousand: 15 },
  casino: { challengeBuyIn: 500, jackpotSeed: 25000 },
};

export class Wallet {
  constructor(progress) { this.p = progress; }
  get W() {
    const P = this.p.P;
    return (P.wallet ||= { cash: 0, earned: 0, spent: 0, byAct: {}, largest: null, tx: [], seq: 0, claims: {}, opened: false, rescued: false });
  }
  get cash() { return this.W.cash; }
  claimed(key) { return !!this.W.claims[key]; }
  // money in. Returns what was paid (0 if refused or already claimed)
  credit(amount, reason, o = {}) {
    const W = this.W; amount = Math.round(amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 50e6) return 0;
    if (o.claim) { if (W.claims[o.claim]) return 0; W.claims[o.claim] = Date.now(); }
    W.cash += amount; W.earned += amount;
    if (o.act) W.byAct[o.act] = (W.byAct[o.act] || 0) + amount;
    if (!W.largest || amount > W.largest.amount) W.largest = { amount, reason, at: Date.now() };
    this.log(amount, reason, o);
    if (!o.quiet) this.p.emit('cash', { amount, reason, balance: W.cash });
    this.p.touch(true);
    return amount;
  }
  // money out: refused if there isn't enough
  debit(amount, reason, o = {}) {
    const W = this.W; amount = Math.round(amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > W.cash) return false;
    W.cash -= amount; W.spent += amount;
    if (o.act) W.byAct[o.act] = (W.byAct[o.act] || 0) - amount;
    this.log(-amount, reason, o);
    if (!o.quiet) this.p.emit('cash', { amount: -amount, reason, balance: W.cash });
    this.p.touch(true);
    return true;
  }
  // the history: the latest 60; a stream of small changes of one kind (a casino session) is kept as one line
  log(amount, reason, o) {
    const W = this.W, now = Date.now(), last = W.tx[0];
    if (o.merge && last && last.merge === o.merge && now - last.at < 120e3) { last.amount += amount; last.n = (last.n || 0) + (o.count ? 1 : 0); last.at = now; last.bal = W.cash; last.reason = o.mergeReason || reason; return; }
    W.tx.unshift({ id: ++W.seq, at: now, amount, reason: o.mergeReason || reason, bal: W.cash, merge: o.merge || null, n: o.count ? 1 : 0 });
    if (W.tx.length > 60) W.tx.length = 60;
  }
  // the first time the wallet is looked at: the starter grant, and back pay for achievements already earned
  open() {
    const W = this.W; if (W.opened) return;
    W.opened = true;
    this.credit(ECONOMY.starter, 'Starter cash', { claim: 'starter', quiet: true });
    let back = 0;
    for (const id of Object.keys(this.p.P.ach)) { const a = this.p.achDef(id); if (a && a.xp) back += this.credit(a.xp * ECONOMY.achievementPerXp, `Achievement: ${a.name}`, { claim: `ach:${id}`, quiet: true }); }
    if (back) this.p.emit('cash', { amount: back, reason: 'Back pay for your achievements', balance: W.cash });
  }
  // down to nothing: one rescue, ever
  rescueIfBroke() {
    const W = this.W;
    if (W.cash >= ECONOMY.rescueBelow || W.rescued) return 0;
    W.rescued = true;
    return this.credit(ECONOMY.rescue, 'One-time fresh start', { claim: 'rescue' });
  }
}

// ---------------- what a finished, validated run pays (a breakdown the results card shows)
export function runPayout(id, mode, r, medal) {
  const E = ECONOMY, lines = [];
  const add = (label, amount) => { amount = Math.round(amount); if (amount) lines.push([label, amount]); };
  const s = r.stats || {};
  if (id === 'traffic') {
    const T = E.traffic;
    add('Run completed', T.complete);
    if (mode === 'score90') add(`Score ${Math.round(r.score || 0).toLocaleString()}`, (r.score || 0) / 1000 * T.perThousand);
    else add(`${(s.km || 0).toFixed(2)} km survived`, (s.km || 0) * T.perKm);
    add(`${s.nearMisses || 0} near misses`, Math.min(T.nearMissMax, (s.nearMisses || 0) * T.nearMiss));
    if ((s.max_combo || 0) >= 5) add(`x${s.max_combo} combo`, s.max_combo * T.combo);
    add('Clean driving', Math.floor((s.cleanM || 0) / 500) * T.clean500);
    if (s.collisions) add(`${s.collisions} collision${s.collisions > 1 ? 's' : ''}`, s.collisions * T.collision);
  } else if (id === 'sled') {
    const T = E.sled;
    add('Lap completed', T.complete);
    if (s.bestJump) add(`Longest jump ${s.bestJump.toFixed(0)} m`, s.bestJump * T.perJumpMetre);
    if (s.perfects) add(`${s.perfects} perfect landing${s.perfects > 1 ? 's' : ''}`, Math.min(T.perfectMax, s.perfects) * T.perfect);
    if (s.shortcut) add('Took the shortcut', T.shortcut);
    if (s.clean) add('Clean lap', T.clean);
    if (mode === 'stunt' && s.stunt) add(`Stunt score ${s.stunt.toLocaleString()}`, s.stunt / 1000 * T.stuntPerThousand);
  }
  let total = lines.reduce((a, l) => a + l[1], 0);
  if (medal && total > 0) { const k = E.tierMult[medal]; add(`${medal[0].toUpperCase() + medal.slice(1)} medal x${k}`, total * (k - 1)); total = lines.reduce((a, l) => a + l[1], 0); }
  return { lines, total: Math.max(0, Math.round(total)) };
}
export const diminishFor = (runsToday) => { for (const [n, k] of ECONOMY.diminish) if (runsToday < n) return k; return 0.2; };
export const fmtCash = (v) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;
