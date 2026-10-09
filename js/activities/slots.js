// The slot machines' rules: pure data and pure functions (no graphics), so the odds can be checked exactly.
// Each machine has three reels; each reel is a fixed strip of symbols (built from symbol counts, shuffled once with
// a fixed seed so every player's machine is the same). A spin picks one stop per reel uniformly at random; the
// window shows the symbol above, at and below each stop. Paylines are read left to right; WILD stands in for any
// paying symbol; scatters (BONUS) count anywhere in the window. Pays are multiples of the bet per line.
// rtp(machine) works out the exact long-run return by going through every possible stop combination.
// Fictional casino credits only: nothing here can be bought or cashed out.

export const SYM = {
  BLANK: { label: '', color: '#000' },
  CH: { label: '🍒', color: '#e2263a' }, LEMON: { label: '🍋', color: '#f2d22a' }, PLUM: { label: '🍇', color: '#8a3ae2' }, BELL: { label: '🔔', color: '#f2b21a' },
  BAR: { label: 'BAR', color: '#f2f2f2' }, BB: { label: 'BAR\nBAR', color: '#f2f2f2' }, BBB: { label: 'BAR\nBAR\nBAR', color: '#f2f2f2' },
  SEVEN: { label: '7', color: '#ff2a3a' }, DIA: { label: '💎', color: '#4ad8ff' }, WILD: { label: 'WILD', color: '#ffd23a' }, BONUS: { label: 'BONUS', color: '#ff4ad8' },
  DRAGON: { label: '🐉', color: '#3ae27a' }, GOLD: { label: '👑', color: '#ffd23a' }, PEARL: { label: '🔮', color: '#c8a2ff' }, COIN: { label: '🪙', color: '#e2b23a' }, JP: { label: 'JACKPOT', color: '#ff3a2a' },
};
const BARS = ['BAR', 'BB', 'BBB'];

// the lines across the 3 x 3 window (row index per reel: 0 top, 1 middle, 2 bottom)
export const LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];

export const MACHINES = [
  {
    id: 'lucky7', name: 'LUCKY 7s', sub: 'Classic · 1 line · steady small wins', risk: 'LOW', color: 0xc8102e, lines: 1, bets: [1, 2, 5, 10, 25, 50],
    reels: [
      { BLANK: 17, CH: 4, BAR: 7, BB: 5, BBB: 3, SEVEN: 2, WILD: 1 },
      { BLANK: 16, CH: 3, BAR: 7, BB: 5, BBB: 3, SEVEN: 2, WILD: 1 },
      { BLANK: 18, CH: 3, BAR: 7, BB: 4, BBB: 3, SEVEN: 2, WILD: 1 },
    ],
    pays: { SEVEN: 200, WILD: 400, BBB: 60, BB: 30, BAR: 15, CH: 20, ANYBAR: 5, CH2: 5, CH1: 2 },
  },
  {
    id: 'diamond', name: 'DIAMOND RUSH', sub: '5 lines · free spins bonus', risk: 'MEDIUM', color: 0x1e6fd8, lines: 5, bets: [1, 2, 5, 10, 20],
    reels: [
      { BLANK: 5, CH: 4, LEMON: 6, PLUM: 5, BELL: 4, DIA: 2, WILD: 1, BONUS: 2 },
      { BLANK: 6, CH: 3, LEMON: 6, PLUM: 5, BELL: 4, DIA: 2, WILD: 1, BONUS: 2 },
      { BLANK: 6, CH: 3, LEMON: 6, PLUM: 5, BELL: 4, DIA: 2, WILD: 1, BONUS: 2 },
    ],
    pays: { DIA: 100, WILD: 250, BELL: 40, PLUM: 20, LEMON: 10, CH: 15, CH2: 3, CH1: 1 },
    bonus: { kind: 'free', spins: 8, mult: 2, scatterPay: 2 },   // 3 BONUS anywhere: 8 free spins at double pay, plus 2x the total bet
  },
  {
    id: 'dragon', name: "DRAGON'S HOARD", sub: '5 lines · pick-a-chest bonus · progressive jackpot', risk: 'HIGH', color: 0x1a8a4a, lines: 5, bets: [2, 5, 10, 25, 50],
    reels: [
      { BLANK: 10, COIN: 6, PEARL: 4, GOLD: 2, DRAGON: 1, WILD: 1, BONUS: 2, JP: 1 },
      { BLANK: 11, COIN: 6, PEARL: 4, GOLD: 2, DRAGON: 1, WILD: 1, BONUS: 2, JP: 1 },
      { BLANK: 11, COIN: 5, PEARL: 4, GOLD: 2, DRAGON: 1, WILD: 1, BONUS: 2, JP: 1 },
    ],
    pays: { DRAGON: 400, WILD: 1000, GOLD: 120, PEARL: 40, COIN: 15, JP: 1000 },
    bonus: { kind: 'pick', picks: [5, 10, 10, 25, 25, 50, 100], scatterPay: 0 },   // 3 BONUS anywhere: pick a chest, it pays that many times the total bet
    jackpot: { seed: 25000, share: 0.02 },                     // JACKPOT x3 on the centre line at the top bet wins the progressive pot (2% of every bet feeds it); otherwise 1,000x the line bet
  },
];

// a fixed shuffle (so the strips are the same for everyone)
function seeded(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function strips(m) {
  if (m._strips) return m._strips;
  m._strips = m.reels.map((counts, ri) => {
    const s = []; for (const [k, n] of Object.entries(counts)) for (let i = 0; i < n; i++) s.push(k);
    const r = seeded(1000 + ri * 77 + m.id.length * 13);
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    return s;
  });
  return m._strips;
}
// the 3 x 3 window for a set of stops: window[reel][row]
export function windowAt(m, stops) { const S = strips(m); return stops.map((st, r) => { const s = S[r], n = s.length; return [s[(st - 1 + n) % n], s[st], s[(st + 1) % n]]; }); }

// one line's pay, in line bets (WILD substitutes for any paying symbol; three WILDs pay their own)
function linePay(m, a, b, c) {
  const P = m.pays, line = [a, b, c];
  if (a === 'WILD' && b === 'WILD' && c === 'WILD') return { pay: P.WILD || 0, sym: 'WILD', n: 3 };
  // the symbol the line is about: the first that isn't WILD
  const base = line.find((s) => s !== 'WILD');
  if (base && base !== 'BLANK' && base !== 'BONUS' && (base !== 'JP' || line.every((s) => s === 'JP')) && line.every((s) => s === base || (s === 'WILD' && base !== 'JP')) && P[base]) return { pay: P[base], sym: base, n: 3 };   // (the jackpot takes three real JACKPOTs)
  // any mix of bars
  if (P.ANYBAR && line.every((s) => BARS.includes(s) || s === 'WILD') && line.some((s) => BARS.includes(s))) return { pay: P.ANYBAR, sym: 'ANYBAR', n: 3 };
  // cherries from the left
  if (P.CH2 && (a === 'CH' || a === 'WILD') && (b === 'CH' || b === 'WILD') && (a === 'CH' || b === 'CH')) return { pay: P.CH2, sym: 'CH', n: 2 };
  if (P.CH1 && a === 'CH') return { pay: P.CH1, sym: 'CH', n: 1 };
  return null;
}
// the whole result of a spin. opts: { lineBet, mult (free spins), atTopBet }
export function evaluate(m, stops, opts) {
  const w = windowAt(m, stops), lb = opts.lineBet, mult = opts.mult || 1, total = lb * m.lines;
  const wins = []; let pay = 0, jackpot = false;
  for (let li = 0; li < m.lines; li++) {
    const L = LINES[li], a = w[0][L[0]], b = w[1][L[1]], c = w[2][L[2]];
    if (a === 'JP' && b === 'JP' && c === 'JP') {
      if (li !== 0) continue;                                                   // the jackpot pays on the centre line only
      if (m.jackpot && opts.atTopBet) { jackpot = true; wins.push({ line: li, sym: 'JP', n: 3, pay: 0, jackpot: true }); continue; }
    }
    const r = linePay(m, a, b, c); if (!r) continue;
    const p = r.pay * lb * mult; pay += p; wins.push({ line: li, sym: r.sym, n: r.n, pay: p });
  }
  const scatters = w.reduce((n, col) => n + (col.includes('BONUS') ? 1 : 0), 0);          // reels showing a BONUS: all three trigger it
  const bonus = m.bonus && scatters >= 3 ? m.bonus.kind : null;
  if (bonus && m.bonus.scatterPay) pay += m.bonus.scatterPay * total * mult;
  return { window: w, wins, pay, scatters, bonus, jackpot, total };
}
// the exact long-run return, the hit rate and the bonus rate, over every stop combination
export function rtp(m, lineBet = 1) {
  const S = strips(m), n = S.map((s) => s.length), total = lineBet * m.lines;
  let base = 0, hits = 0, bonusP = 0, jpP = 0, count = 0;
  for (let a = 0; a < n[0]; a++) for (let b = 0; b < n[1]; b++) for (let c = 0; c < n[2]; c++) {
    const r = evaluate(m, [a, b, c], { lineBet, atTopBet: false });
    count++; base += r.pay; if (r.pay > 0 || r.bonus) hits++; if (r.bonus) bonusP++; if (r.wins.some((x) => x.sym === 'JP')) jpP++;
  }
  base /= count * total; bonusP /= count; jpP /= count;
  // the bonuses' worth, in total bets: free spins pay the base game at the multiplier; the pick pays its average
  let bonusEV = 0;
  if (m.bonus && m.bonus.kind === 'free') bonusEV = m.bonus.spins * m.bonus.mult * base;
  if (m.bonus && m.bonus.kind === 'pick') bonusEV = m.bonus.picks.reduce((x, y) => x + y, 0) / m.bonus.picks.length;
  return { rtp: base + bonusP * bonusEV, base, hit: hits / count, bonusEvery: bonusP ? Math.round(1 / bonusP) : null, jackpotEvery: jpP ? Math.round(1 / jpP) : null };
}
// a fair random stop for each reel (the browser's cryptographic generator when there is one)
export function randomStops(m) {
  const S = strips(m), u = new Uint32Array(3);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(u); else for (let i = 0; i < 3; i++) u[i] = Math.floor(Math.random() * 4294967296);
  return S.map((s, i) => u[i] % s.length);
}
