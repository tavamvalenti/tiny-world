// LAS VEGAS — CASINO JACKPOT CHALLENGE. Through the doors of Caesars Palace onto a casino floor (built when you walk
// in, taken away when you leave): carpet, chandeliers, neon, banks of machines, the casino floor's own sound. Three
// machines in the middle are yours to play (js/activities/slots.js has their exact rules and odds):
//   LUCKY 7s (low risk, one line), DIAMOND RUSH (five lines, free spins), DRAGON'S HOARD (high risk, a pick-a-chest
//   bonus and a progressive jackpot).
// It plays with your Cash (the one wallet, js/progress/economy.js): fictional game money, never bought, never cashed
// out. Every spin is settled the moment you press SPIN (the bet out, the win in, saved), then the reels show it: so a
// reload, a double click or a held key can't pay twice or undo a loss, and you can't bet more than you have. The
// 50-spin challenge is a $500 buy-in for 50 spins at $10; what you win is paid in as you go (unplayed spins refunded).
import * as THREE from 'three';
import { G, clamp, rand } from '../core.js';
import { sfx } from '../audio.js';
import { MACHINES, SYM, LINES, evaluate, randomStops, strips, rtp } from './slots.js';

const O = new THREE.Vector3(0, 0, -2600);           // the casino floor, far out of town (it's "inside")
const SP = 2.3;                                     // machine spacing along the bank
const CHALLENGE_SPINS = 50, CHALLENGE_BET = 10;
const BUYIN = CHALLENGE_SPINS * CHALLENGE_BET;

export class Casino {
  constructor(hub, def) { this.hub = hub; this.def = def; this.objs = []; this.usesR = true; }
  start(mode) {
    if (G.mapName !== 'vegas') { this.hub.exit(); return; }
    this.mode = mode;
    const P = G.progress, C = P ? P.casino() : { pot: 25000 };
    this.C = C; this.W = P && P.wallet;
    // the challenge's buy-in, up front (and only if you can cover it)
    if (mode === 'challenge') {
      if (!this.W || !this.W.debit(BUYIN, 'Casino: 50-spin challenge buy-in', { act: 'casino' })) { this.blocked = `THE CHALLENGE COSTS $${BUYIN} · PLAY THE OTHER GAMES TO EARN MORE`; }
    }
    this.buildRoom();
    this.mi = 1; this.camX = this.machineX(this.mi); this.bet = {}; for (const m of MACHINES) this.bet[m.id] = m.bets[Math.min(1, m.bets.length - 1)];
    this.state = 'idle'; this.free = 0; this.freeMult = 1; this.streak = 0; this.shown = this.cash; this.lastWin = 0; this.pick = null; this.info = false;
    if (mode === 'challenge') { this.ch = { left: CHALLENGE_SPINS, won: 0, spins: 0, biggest: 0, bestStreak: 0 }; this.shown = 0; }
    this.buildHud();
    this.amb = sfx.loop ? sfx.loop('casino', O.x, O.z - 2) : null; if (this.amb) this.amb.set(0.5, 1);
    if (this.blocked) { this.over = true; this.message(this.blocked); }
    this.render(0);
  }
  get cash() { return this.W ? this.W.cash : 0; }
  machineX(i) { return O.x + (i - 1) * SP * 1.0; }
  get m() { return MACHINES[this.mi]; }

  // ---------------------------------------------------------------- the room and the machines
  buildRoom() {
    const add = (o) => { G.scene.add(o); this.objs.push(o); return o; };
    const W = 34, D = 22, H = 6.5, z0 = O.z;
    // carpet: a classic casino pattern
    const carpet = canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#5a0f1c'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const cx = x * 64 + 32, cy = y * 64 + 32;
        c.strokeStyle = '#c89a3a'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 18, 0, 6.283); c.stroke();
        c.fillStyle = '#1c3a6a'; c.beginPath(); c.moveTo(cx, cy - 12); c.lineTo(cx + 12, cy); c.lineTo(cx, cy + 12); c.lineTo(cx - 12, cy); c.fill();
        c.fillStyle = '#e8b84a'; c.beginPath(); c.arc(cx, cy, 4, 0, 6.283); c.fill();
        c.strokeStyle = 'rgba(232,184,74,.4)'; c.lineWidth = 1.5; c.strokeRect(x * 64 + 3, y * 64 + 3, 58, 58);
      }
    });
    carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(W / 4, D / 4);
    const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 })));
    floor.position.set(O.x, 0.01, z0); floor.receiveShadow = true;
    // walls: dark wood below, deep red damask above, a gold rail between
    const wallTex = canvasTexture(128, 256, (c, w, h) => { c.fillStyle = '#3a0a12'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(200,150,60,.18)'; for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { c.beginPath(); c.ellipse(x + 16 + ((y / 32) % 2) * 16, y + 16, 7, 12, 0, 0, 6.283); c.fill(); } c.fillStyle = '#2a160c'; c.fillRect(0, h * 0.62, w, h * 0.38); c.fillStyle = '#d8a84a'; c.fillRect(0, h * 0.6, w, 5); });
    wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(10, 1);
    const wm = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, side: THREE.DoubleSide });
    for (const [w, x, z, ry] of [[W, O.x, z0 - D / 2, 0], [W, O.x, z0 + D / 2, Math.PI], [D, O.x - W / 2, z0, Math.PI / 2], [D, O.x + W / 2, z0, -Math.PI / 2]]) {
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, H), wm)); m.position.set(x, H / 2, z); m.rotation.y = ry;
    }
    // the ceiling: dark, coffered, lit from the chandeliers (it casts no shadow, so the room stays bright)
    const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a0c08, roughness: 0.9 })));
    ceil.position.set(O.x, H, z0);
    const lightM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.3) });
    for (let x = -12; x <= 12; x += 6) for (const z of [-4, 4]) {
      const ch = new THREE.Group(); ch.position.set(O.x + x, H - 0.9, z0 + z);
      ch.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: 0xc89a3a, metalness: 0.8, roughness: 0.3 })));
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283, b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lightM); b.position.set(Math.cos(a) * 0.55, Math.sin(k * 1.7) * 0.06, Math.sin(a) * 0.55); ch.add(b); }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lightM); ch.add(core);
      add(ch);
    }
    this.lights = [new THREE.PointLight(0xffd8a0, 30, 22, 1.4), new THREE.PointLight(0xffc890, 22, 20, 1.4), new THREE.HemisphereLight(0xffe0c0, 0x3a0a12, 0.7)];
    this.lights[0].position.set(O.x - 4, H - 1.2, z0 + 1); this.lights[1].position.set(O.x + 6, H - 1.2, z0 + 3);
    for (const l of this.lights) add(l);
    // neon on the back wall
    const neon = (text, x, y, col) => { const t = canvasTexture(512, 128, (c, w, h) => { c.font = '900 84px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 24; c.fillStyle = col; c.fillText(text, w / 2, h / 2); c.shadowBlur = 8; c.fillStyle = '#fff'; c.fillText(text, w / 2, h / 2); });
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }))); m.position.set(x, y, z0 - D / 2 + 0.05); return m; };
    this.neons = [neon('CASINO', O.x, 4.9, '#ff3ab8'), neon('SLOTS', O.x - 9, 4.6, '#3ad8ff'), neon('JACKPOT', O.x + 9, 4.6, '#ffd23a')];
    // the bank of machines: the three in the middle are playable, the rest dressing (lit screens, blinking)
    this.machines = [];
    const bankZ = z0 - 3.2;
    for (let i = -4; i <= 6; i++) {
      const play = i >= 0 && i <= 2, M = play ? MACHINES[i] : null;
      const mm = buildMachine(M, i);
      mm.root.position.set(O.x + (i - 1) * SP, 0, bankZ); add(mm.root);
      if (play) this.machines[i] = mm; else (this.deco ||= []).push(mm);
    }
    // a second bank behind you, backs turned, and tables to the sides
    for (let i = -4; i <= 6; i++) { const mm = buildMachine(null, i + 20); mm.root.position.set(O.x + (i - 1) * SP, 0, z0 + 6.5); mm.root.rotation.y = Math.PI; add(mm.root); (this.deco ||= []).push(mm); }
    for (const [x, z] of [[-13, 2], [13, 2], [-13, -6], [13, -6]]) add(buildTable(O.x + x, z0 + z));
    // the doors you came in by
    const door = add(new THREE.Mesh(new THREE.PlaneGeometry(4, 3.4), new THREE.MeshStandardMaterial({ color: 0xc89a3a, metalness: 0.7, roughness: 0.35 })));
    door.position.set(O.x, 1.7, z0 + D / 2 - 0.05); door.rotation.y = Math.PI;
  }

  buildHud() {
    const el = this.hub.gameEl;
    el.innerHTML = `<style>
      .cs{position:absolute;left:50%;bottom:calc(4.2vh + 14px);transform:translateX(-50%);pointer-events:auto;width:min(720px,calc(100% - 32px));padding:12px 16px;border-radius:16px;font-family:Inter,system-ui,sans-serif;color:#fff;
        background:linear-gradient(180deg,rgba(40,14,10,.86),rgba(18,6,6,.9));border:1px solid rgba(232,184,74,.55);box-shadow:0 18px 40px -14px rgba(0,0,0,.8),0 0 30px -10px rgba(255,180,60,.5),inset 0 1px 0 rgba(255,230,170,.25);backdrop-filter:blur(8px)}
      .cs-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px}
      .cs-top b{font:900 13px Inter;letter-spacing:.2em;color:#ffd46b} .cs-top span{font:700 9.5px Inter;letter-spacing:.18em;color:rgba(255,230,200,.6)}
      .cs-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      .cs-box{background:rgba(0,0,0,.35);border:1px solid rgba(232,184,74,.25);border-radius:9px;padding:6px 9px}
      .cs-box small{display:block;font:800 8.5px Inter;letter-spacing:.2em;color:rgba(255,212,107,.75)} .cs-box b{font:900 18px Inter;font-variant-numeric:tabular-nums}
      .cs-box.win b{color:#7ff0a8}
      .cs-btns{display:flex;gap:8px;margin-top:9px;align-items:center}
      .cs-btns button{font:800 10px Inter;letter-spacing:.16em;padding:10px 12px;border-radius:999px;border:1px solid rgba(232,184,74,.5);background:rgba(232,184,74,.12);color:#ffe9c0;cursor:pointer}
      .cs-btns button:hover{filter:brightness(1.25)} .cs-btns button:disabled{opacity:.4;cursor:default}
      .cs-btns .spin{flex:1;font-size:14px;letter-spacing:.3em;padding:12px;background:linear-gradient(180deg,#ffd46b,#e88a1a);color:#2a1004;border:0;box-shadow:0 4px 16px rgba(255,160,40,.5)}
      .cs-btns .key{font:600 8px Inter;opacity:.7;margin-left:5px}
      .cs-msg{position:absolute;left:50%;top:calc(4.2vh + 64px);transform:translateX(-50%);font:900 13px Inter;letter-spacing:.24em;color:#ffd46b;text-shadow:0 0 14px rgba(255,160,40,.9),0 2px 4px #000;text-align:center}
      .cs-info{position:absolute;left:50%;top:50%;transform:translate(-50%,-55%);pointer-events:auto;width:min(560px,calc(100% - 32px));max-height:62vh;overflow:auto;padding:14px 18px;border-radius:14px;background:rgba(18,6,6,.95);border:1px solid rgba(232,184,74,.55);font:500 11.5px/1.5 Inter;color:#f2e6d6;display:none}
      .cs-info.on{display:block} .cs-info h3{margin:0 0 6px;font:900 13px Inter;letter-spacing:.2em;color:#ffd46b} .cs-info table{width:100%;border-collapse:collapse;margin:6px 0} .cs-info td{padding:3px 6px;border-bottom:1px solid rgba(232,184,74,.15)} .cs-info td:last-child{text-align:right;font-weight:800}
      .cs-pick{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);pointer-events:auto;display:none;gap:18px;text-align:center}
      .cs-pick.on{display:flex} .cs-pick button{width:110px;height:96px;border-radius:14px;border:2px solid #ffd46b;background:linear-gradient(180deg,#8a4a1a,#4a2208);color:#ffd46b;font:900 30px Inter;cursor:pointer;box-shadow:0 0 24px rgba(255,180,60,.6)}
      .cs-pick button:hover{transform:translateY(-4px)} .cs-pick button.open{background:#2a1408;font-size:16px}
      .cs-pick p{position:absolute;left:50%;top:-38px;transform:translateX(-50%);white-space:nowrap;font:900 14px Inter;letter-spacing:.24em;color:#ffd46b;text-shadow:0 0 12px rgba(255,160,40,.9)}
    </style>
    <div class="cs-msg"></div>
    <div class="cs-info"></div>
    <div class="cs-pick"><p>PICK A CHEST</p><button data-c="0">?</button><button data-c="1">?</button><button data-c="2">?</button></div>
    <div class="cs">
      <div class="cs-top"><b class="nm"></b><span class="sub"></span></div>
      <div class="cs-row"><div class="cs-box"><small class="crL">CASH</small><b class="cr">0</b></div><div class="cs-box"><small>BET</small><b class="bt">0</b></div><div class="cs-box win"><small>WIN</small><b class="wn">0</b></div><div class="cs-box"><small class="x1L">STREAK</small><b class="x1">0</b></div></div>
      <div class="cs-btns"><button data-a="prev">◀<span class="key">←</span></button><button data-a="down">BET −<span class="key">↓</span></button><button class="spin" data-a="spin">SPIN<span class="key">SPACE</span></button><button data-a="up">BET +<span class="key">↑</span></button><button data-a="max">MAX</button><button data-a="info">PAYS<span class="key">I</span></button><button data-a="next">▶<span class="key">→</span></button></div>
    </div>`;
    const q = (s) => el.querySelector(s);
    this.el = { nm: q('.nm'), sub: q('.sub'), cr: q('.cr'), crL: q('.crL'), bt: q('.bt'), wn: q('.wn'), x1: q('.x1'), x1L: q('.x1L'), msg: q('.cs-msg'), info: q('.cs-info'), pick: q('.cs-pick'), spin: q('.spin'), panel: q('.cs') };
    el.querySelector('.cs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.action(b.dataset.a); });
    this.el.pick.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && this.pick && !this.pick.done) this.choose(+b.dataset.c); });
    if (this.mode === 'challenge') this.el.crL.textContent = 'SPINS LEFT';
    this.paint();
  }
  // the bet: line bet x lines; the challenge is a fixed 10 credits a spin on any machine
  lineBet(m = this.m) { return this.mode === 'challenge' ? CHALLENGE_BET / m.lines : this.bet[m.id]; }
  totalBet(m = this.m) { return this.lineBet(m) * m.lines; }
  action(a) {
    if (a === 'spin') return this.spin();
    if (a === 'info') { this.info = !this.info; this.paint(); return; }
    if (this.state !== 'idle' || this.pick) return;
    const m = this.m, bets = m.bets, i = bets.indexOf(this.bet[m.id]);
    if (a === 'up' && this.mode !== 'challenge') this.bet[m.id] = bets[Math.min(bets.length - 1, i + 1)];
    if (a === 'down' && this.mode !== 'challenge') this.bet[m.id] = bets[Math.max(0, i - 1)];
    if (a === 'max' && this.mode !== 'challenge') this.bet[m.id] = bets[bets.length - 1];
    if (a === 'prev') this.mi = Math.max(0, this.mi - 1);
    if (a === 'next') this.mi = Math.min(MACHINES.length - 1, this.mi + 1);
    sfx.slot && sfx.slot('button', O.x, O.z);
    this.paint();
  }
  key(e, down) {
    if (!down || e.repeat) return true;
    const c = e.code;
    if (c === 'Space' || c === 'Enter') this.action('spin');
    else if (c === 'ArrowUp' || c === 'KeyW') this.action('up');
    else if (c === 'ArrowDown' || c === 'KeyS') this.action('down');
    else if (c === 'ArrowLeft' || c === 'KeyA') this.action('prev');
    else if (c === 'ArrowRight' || c === 'KeyD') this.action('next');
    else if (c === 'KeyI') this.action('info');
    else if (c === 'Digit1' || c === 'Digit2' || c === 'Digit3') { if (this.pick && !this.pick.done) this.choose(+c.slice(5) - 1); }
    return true;
  }
  where() { return { x: -17, y: 0, z: -38 }; }      // outside: Caesars Palace's doors

  // ---------------------------------------------------------------- a spin: settled first, shown after
  spin() {
    if (this.state !== 'idle' || this.pick || this.over) return;
    const m = this.m, C = this.C, P = G.progress, lb = this.lineBet(m), total = lb * m.lines, isFree = this.free > 0;
    if (this.mode === 'challenge') { if (!isFree && this.ch.left <= 0) return; }
    else if (!isFree && this.cash < total) {
      // not enough Cash: lower the bet, or (down to nothing) the one-time fresh start; otherwise earn it elsewhere
      const minBet = m.bets[0] * m.lines;
      if (this.cash < minBet && this.W && this.W.rescueIfBroke()) { this.hub.pop('FRESH START · ONE TIME ONLY', 'rgba(255,212,107,.95)', true); this.shown = this.cash; this.paint(); }
      else this.message(this.cash < minBet ? 'OUT OF CASH · WIN SOME IN THE OTHER MINI-GAMES AND CHALLENGES' : 'NOT ENOUGH CASH · LOWER THE BET');
      return;
    }
    const top = lb === m.bets[m.bets.length - 1] && this.mode !== 'challenge';
    const stops = randomStops(m), r = evaluate(m, stops, { lineBet: lb, mult: isFree ? this.freeMult : 1, atTopBet: top });
    let win = r.pay;
    if (r.jackpot) { win += C.pot; this.jpWon = C.pot; C.pot = m.jackpot.seed; }
    if (m.jackpot && !isFree && this.mode !== 'challenge') C.pot += Math.round(total * m.jackpot.share);
    // settle now: the bet out, the win in, saved
    const bet = isFree ? 0 : total;
    let bonusWin = 0;
    if (r.bonus === 'pick') { const picks = m.bonus.picks, k = Math.floor(rand(0, picks.length)); bonusWin = picks[k] * total; this.pendingPick = { prize: picks[k], win: bonusWin, others: [picks[Math.floor(rand(0, picks.length))], picks[Math.floor(rand(0, picks.length))]] }; }
    // the money: the bet out (the challenge's spins are already paid for), the win in, as one line in the history
    const W = this.W, mo = { act: 'casino', merge: 'casino', mergeReason: `Casino: ${m.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}`, quiet: true };
    if (this.mode === 'challenge') { if (!isFree) this.ch.left--; this.ch.spins++; this.ch.won += win + bonusWin; this.ch.biggest = Math.max(this.ch.biggest, win + bonusWin); }
    else if (bet && !(W && W.debit(bet, 'Casino bet', { ...mo, count: true }))) { this.message('NOT ENOUGH CASH'); return; }
    if (W && win + bonusWin > 0) W.credit(win + bonusWin, r.jackpot ? 'Casino: JACKPOT' : 'Casino win', { ...mo, count: !bet, merge: r.jackpot ? null : 'casino', quiet: !r.jackpot });
    if (isFree) this.free--;
    if (r.bonus === 'free') { this.free += m.bonus.spins; this.freeMult = m.bonus.mult; }
    this.streak = win + bonusWin > 0 ? this.streak + 1 : 0;
    if (this.mode === 'challenge') this.ch.bestStreak = Math.max(this.ch.bestStreak, this.streak);
    P && P.casinoSpin({ bet, win: win + bonusWin, streak: this.streak, jackpot: r.jackpot, bonus: !!r.bonus, machine: m.id });
    // now show it
    this.result = { ...r, win, bonusWin, stops, isFree };
    this.state = 'spinning'; this.t = 0; this.lastWin = 0; this.el.msg.textContent = isFree ? `FREE SPIN · ${this.free} LEFT · x${this.freeMult}` : '';
    const M = this.machines[this.mi]; M.startSpin(stops, strips(m)); M.lever = 1;
    sfx.slot && sfx.slot('spin', M.root.position.x, M.root.position.z);
    this.paint();
  }
  // all three reels stopped: show the wins, then hand back (or run the next free spin / the bonus)
  settled() {
    const r = this.result, m = this.m, M = this.machines[this.mi], x = M.root.position.x, z = M.root.position.z;
    M.showWins(r);
    const total = r.total;
    this.lastWin = r.win;
    if (r.jackpot) { this.hub.pop(`JACKPOT!  +${this.jpWon.toLocaleString()}`, 'rgba(255,90,60,.98)', true); sfx.slot && sfx.slot('jackpot', x, z); this.coins(80); this.flash = 4; }
    else if (r.win >= total * 25) { this.hub.pop(`BIG WIN  +${r.win.toLocaleString()}`, 'rgba(255,212,107,.98)', true); sfx.slot && sfx.slot('big', x, z); this.coins(40); this.flash = 2; }
    else if (r.win > 0) { this.hub.pop(`WIN  +${r.win.toLocaleString()}`, 'rgba(127,240,168,.95)'); sfx.slot && sfx.slot('win', x, z, Math.round(Math.log2(1 + r.win / total))); this.coins(Math.min(16, 3 + Math.round(r.win / total))); }
    if (this.streak >= 3 && r.win > 0) this.hub.pop(`${this.streak} WINS IN A ROW`, 'rgba(255,140,220,.95)');
    if (r.bonus === 'free') { this.hub.pop(`FREE SPINS!  ${m.bonus.spins} AT x${m.bonus.mult}`, 'rgba(120,220,255,.98)', true); sfx.slot && sfx.slot('big', x, z); }
    if (r.bonus === 'pick') { this.pick = { ...this.pendingPick, done: false }; this.pendingPick = null; this.el.pick.classList.add('on'); this.el.pick.querySelectorAll('button').forEach((b) => { b.className = ''; b.textContent = '?'; }); sfx.slot && sfx.slot('big', x, z); }
    this.state = 'show'; this.t = 0;
  }
  choose(i) {
    const p = this.pick; if (!p || p.done) return;
    p.done = true;
    const btns = [...this.el.pick.querySelectorAll('button')], others = [...p.others];
    btns.forEach((b, k) => { b.classList.add('open'); b.textContent = k === i ? `x${p.prize}` : `x${others.pop()}`; b.style.opacity = k === i ? 1 : 0.45; });
    this.hub.pop(`TREASURE  x${p.prize}  +${p.win.toLocaleString()}`, 'rgba(255,212,107,.98)', true);
    this.lastWin = (this.lastWin || 0) + p.win; this.coins(30);
    sfx.slot && sfx.slot('win', O.x, O.z, 6);
    setTimeout(() => { this.el.pick.classList.remove('on'); this.pick = null; this.paint(); }, 1600);
  }
  message(t) { this.el.msg.textContent = t; clearTimeout(this.msgT); this.msgT = setTimeout(() => { if (this.el) this.el.msg.textContent = ''; }, 2600); }
  coins(n) { const M = this.machines[this.mi], p = M.root.position; if (G.fx) G.fx.sparks(p.x, 0.9, p.z + 0.5, n, 2.6, 2.0, 0.4, 4); for (let i = 0; i < Math.min(6, n / 5); i++) setTimeout(() => sfx.slot && sfx.slot('coin', p.x, p.z), i * 90); }

  update(dt) {
    if (!this.machines) return;
    this.t += dt;
    for (const [i, M] of this.machines.entries()) M.update(dt, i === this.mi);
    for (const M of this.deco || []) M.update(dt, false);
    for (const [k, n] of this.neons.entries()) n.material.opacity = 0.75 + 0.25 * Math.sin(G.time * (2 + k) + k);
    if (this.state === 'spinning' && this.machines[this.mi].stopped()) this.settled();
    if (this.state === 'show' && this.t > (this.result.win > 0 ? 1.0 : 0.35) && !this.pick) {
      this.state = 'idle';
      if (this.free > 0) setTimeout(() => this.spin(), 450);
      else if (this.mode === 'challenge' && this.ch.left <= 0) this.endChallenge();
    }
    // the credits count up to the real number
    const real = this.mode === 'challenge' ? this.ch.won : this.cash;
    this.shown += (real - this.shown) * (1 - Math.exp(-dt * 6)); if (Math.abs(real - this.shown) < 0.5) this.shown = real;
    this.flash = Math.max(0, (this.flash || 0) - dt);
    this.paint(true);
  }
  endChallenge() {
    if (this.over) return; this.over = true;
    const c = this.ch;
    setTimeout(() => this.hub.finish({
      valid: c.spins >= CHALLENGE_SPINS, title: 'CASINO · 50-SPIN CHALLENGE', headline: `$${c.won.toLocaleString()}`, headlineLabel: 'WON IN 50 SPINS (PAID IN AS YOU PLAYED)',
      medalValue: c.won, lines: [['Spins (incl. free spins)', c.spins], ['Biggest single win', `$${c.biggest.toLocaleString()}`], ['Longest win streak', c.bestStreak], ['Buy-in', `$${BUYIN}`], ['Net', `${c.won - BUYIN < 0 ? '−' : '+'}$${Math.abs(c.won - BUYIN).toLocaleString()}`]],
      records: { casino_session: c.won }, evidence: { spins: c.spins, bet: CHALLENGE_BET },
      xp: Math.min(60, 20 + c.won / 100), stats: { challenges: 1 },
    }), 600);
  }
  paint(light) {
    const e = this.el; if (!e) return;
    const m = this.m;
    if (!light) { e.nm.textContent = m.name; e.sub.textContent = `${m.risk} RISK · ${m.sub.toUpperCase()}`; this.renderInfo(); }
    e.cr.textContent = this.mode === 'challenge' ? `${this.ch.left}` : `$${Math.round(this.shown).toLocaleString()}`;
    if (this.mode === 'challenge') { e.x1L.textContent = 'WON SO FAR'; e.x1.textContent = `$${Math.round(this.shown).toLocaleString()}`; }
    else { e.x1L.textContent = this.free > 0 ? 'FREE SPINS' : 'STREAK'; e.x1.textContent = this.free > 0 ? `${this.free} · x${this.freeMult}` : `${this.streak}`; }
    e.bt.textContent = `$${this.totalBet()}${m.lines > 1 ? ` · ${m.lines} LINES` : ''}`;
    e.wn.textContent = this.state === 'spinning' ? '…' : `$${(this.lastWin || 0).toLocaleString()}`;
    e.spin.disabled = this.state !== 'idle' || !!this.pick || this.over;
    e.spin.firstChild.textContent = this.free > 0 ? 'FREE SPIN' : 'SPIN';
    e.info.classList.toggle('on', !!this.info);
  }
  renderInfo() {
    const m = this.m, R = (this.rtpCache ||= {})[m.id] ||= rtp(m), lb = this.lineBet(m), sym = (k) => SYM[k] ? SYM[k].label.replace(/\n/g, ' ') : k;
    const rows = Object.entries(m.pays).map(([k, v]) => {
      const name = k === 'ANYBAR' ? 'Any 3 bars' : k === 'CH2' ? `${sym('CH')} ${sym('CH')} from the left` : k === 'CH1' ? `${sym('CH')} on the first reel` : `${sym(k)} ${sym(k)} ${sym(k)}`;
      return `<tr><td>${name}</td><td>${(v * lb).toLocaleString()}</td></tr>`;
    }).join('');
    this.el.info.innerHTML = `<h3>${m.name} · PAYS</h3><p>Per line, at your current bet (${lb} a line, ${m.lines} line${m.lines > 1 ? 's' : ''}). WILD stands in for any symbol${m.jackpot ? ' (except JACKPOT)' : ''}.</p>
      <table>${rows}${m.bonus ? `<tr><td>${sym('BONUS')} on all three reels</td><td>${m.bonus.kind === 'free' ? `${m.bonus.spins} free spins at x${m.bonus.mult}` : 'Pick a chest: 5x–100x the bet'}</td></tr>` : ''}${m.jackpot ? `<tr><td>JACKPOT x3 on the centre line at the top bet</td><td>${this.C.pot.toLocaleString()} (progressive)</td></tr>` : ''}</table>
      <p>Return to player <b>${(R.rtp * 100).toFixed(1)}%</b> · wins on ${(R.hit * 100).toFixed(0)}% of spins${R.bonusEvery ? ` · bonus about 1 in ${R.bonusEvery}` : ''}${R.jackpotEvery ? ` · jackpot line about 1 in ${R.jackpotEvery.toLocaleString()}` : ''}. Worked out exactly from the reel strips. Played with your Cash: game money only — never bought, never cashed out.</p>`;
  }
  render() {}
  applyCamera(dt) {
    if (!this.machines) return;
    const cam = G.camera, M = this.machines[this.mi], p = M.root.position;
    this.camX += (p.x - this.camX) * (1 - Math.exp(-dt * 6));
    const sh = (this.flash || 0) > 0 ? Math.sin(G.time * 60) * 0.01 * this.flash : 0;
    const back = 2.75 * Math.max(1, 1.25 / cam.aspect);         // a narrow window steps back so the whole machine fits
    cam.position.set(this.camX + sh, 1.75 + back * 0.08, p.z + back); cam.up.set(0, 1, 0); cam.lookAt(this.camX, 1.45, p.z);
    cam.fov = 52; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    G.post.maxBlur = 0; G.post.band = 1;
    if (G.scene.fog) { G.scene.fog.near = 200; G.scene.fog.far = 600; }
    this.hub.followSun(O.x, O.z);
  }
  dispose() {
    if (this.mode === 'challenge' && this.ch && !this.over && !this.blocked && this.ch.left > 0 && this.W) this.W.credit(this.ch.left * CHALLENGE_BET, `Casino: ${this.ch.left} unplayed challenge spins refunded`, { act: 'casino' });
    for (const o of this.objs) { G.scene.remove(o); o.traverse && o.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); const ms = Array.isArray(c.material) ? c.material : [c.material]; for (const mt of ms) { if (mt.map) mt.map.dispose(); mt.dispose(); } } }); }
    this.objs.length = 0; this.machines = null; this.deco = null;
    if (this.amb) { this.amb.stop(); this.amb = null; }
    clearTimeout(this.msgT);
  }
}

// ---------------------------------------------------------------- the cabinet
function canvasTexture(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const DECO_SYMS = ['CH', 'SEVEN', 'BAR', 'BELL', 'DIA', 'LEMON', 'PLUM'];
function buildMachine(M, seed) {
  const root = new THREE.Group();
  const color = M ? M.color : [0x6a1aa8, 0x1a7aa8, 0xa86a1a, 0x1aa86a, 0xa81a4a][Math.abs(seed) % 5];
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 }), chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8de, metalness: 0.95, roughness: 0.18 }), dark = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.5 });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; root.add(o); return o; };
  box(1.3, 1.0, 0.85, body, 0, 0.5, 0);                    // base
  box(1.3, 1.05, 0.7, body, 0, 1.5, -0.07);                 // screen housing
  box(1.36, 0.08, 0.9, chrome, 0, 1.02, 0.02);              // chrome trim
  const deck = box(1.24, 0.12, 0.42, dark, 0, 1.0, 0.5); deck.rotation.x = 0.25;
  box(1.4, 0.62, 0.75, body, 0, 2.35, -0.1);                // top box
  // the sign on top
  const signTex = canvasTexture(512, 192, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a0a18'); g.addColorStop(1, '#3a0a28'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.font = `900 ${M ? 78 : 64}px Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#ffd23a'; c.shadowBlur = 18; c.fillStyle = '#ffe28a'; c.fillText(M ? M.name : ['HOT 7s', 'TRIPLE BAR', 'GOLD RUSH', 'WILD CHERRY', 'MEGA BELLS'][Math.abs(seed) % 5], w / 2, h / 2, w * 0.92); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.5), new THREE.MeshBasicMaterial({ map: signTex })); sign.position.set(0, 2.36, 0.28); root.add(sign);
  // the screen: the reels drawn on a canvas
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 380; const sc = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.77), new THREE.MeshBasicMaterial({ map: tex })); screen.position.set(0, 1.52, 0.285); root.add(screen);
  box(1.12, 0.06, 0.04, chrome, 0, 1.92, 0.29); box(1.12, 0.06, 0.04, chrome, 0, 1.12, 0.29); box(0.06, 0.86, 0.04, chrome, -0.55, 1.52, 0.29); box(0.06, 0.86, 0.04, chrome, 0.55, 1.52, 0.29);
  // buttons and the lever
  const btnM = [new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.4, 0.3) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.8, 0.5) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.6, 0.4) })];
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), btnM[k % 3]); b.position.set(-0.42 + k * 0.21, 1.1, 0.55); b.rotation.x = 0.25; root.add(b); }
  const lever = new THREE.Group(); lever.position.set(0.72, 1.35, 0); root.add(lever);
  lever.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6).translate(0, 0.3, 0), chrome));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8202a, roughness: 0.3 })); knob.position.y = 0.6; lever.add(knob);
  box(0.1, 0.18, 0.18, chrome, 0.68, 1.35, 0);
  // a chase of bulbs round the sign
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), 22);
  for (let k = 0; k < 22; k++) { const t = k / 22, per = 2 * (1.32 + 0.52); let d = t * per, x, y; if (d < 1.32) { x = -0.66 + d; y = 2.63; } else if ((d -= 1.32) < 0.52) { x = 0.66; y = 2.63 - d; } else if ((d -= 0.52) < 1.32) { x = 0.66 - d; y = 2.11; } else { d -= 1.32; x = -0.66; y = 2.11 + d; } bulbs.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, y, 0.3)); bulbs.setColorAt(k, new THREE.Color(2, 1.6, 0.6)); }
  root.add(bulbs);
  // a stool
  const stool = new THREE.Group(); stool.position.set(0, 0, 1.15); root.add(stool);
  stool.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.75, 8).translate(0, 0.37, 0), chrome));
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x5a0f1c, roughness: 0.6 })); seat.position.y = 0.8; stool.add(seat);

  // reels state
  const S = M ? strips(M) : DECO_SYMS.map(() => DECO_SYMS.slice().sort(() => Math.random() - 0.5));
  const reels = [0, 1, 2].map((i) => ({ pos: Math.floor(Math.random() * S[i].length), from: 0, to: 0, t: 0, dur: 0, spinning: false }));
  let wins = null, winT = 0, attract = Math.random() * 10, dirty = true, chase = 0;
  const api = {
    root, lever: 0,
    startSpin(stops, strs) {
      wins = null;
      reels.forEach((r, i) => { const n = strs[i].length, cur = ((Math.round(r.pos) % n) + n) % n, d = ((stops[i] - cur) % n + n) % n; r.from = r.pos; r.to = r.pos + n * (2 + i) + d; r.t = 0; r.dur = 0.75 + i * 0.38; r.spinning = true; r.n = n; });
    },
    stopped() { return reels.every((r) => !r.spinning); },
    showWins(r) { wins = r; winT = 0; dirty = true; },
    update(dt, active) {
      // the lever springs back
      api.lever = Math.max(0, api.lever - dt * 2.5); lever.rotation.x = Math.sin(Math.min(1, api.lever) * Math.PI) * 0.9;
      let moving = false;
      for (const [i, r] of reels.entries()) {
        if (!r.spinning) continue; moving = true;
        r.t += dt; const k = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - k, 3);
        r.pos = r.from + (r.to - r.from) * e + (k > 0.85 ? Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.08 : 0);
        if (k >= 1) { r.pos = r.to; r.spinning = false; if (active && sfx.slot) sfx.slot('stop', root.position.x + (i - 1) * 0.3, root.position.z); }
      }
      // dressing machines: the reels turn over every so often on their own
      if (!M) { attract -= dt; if (attract < 0) { attract = rand(4, 12); reels.forEach((r, i) => { r.from = r.pos; r.to = r.pos + 7 + i * 3; r.t = 0; r.dur = 0.8 + i * 0.3; r.spinning = true; }); } }
      if (wins) winT += dt;
      chase += dt * (wins && wins.pay > 0 ? 14 : 4);
      for (let k = 0; k < 22; k++) bulbs.setColorAt(k, (Math.floor(chase) + k) % 3 === 0 ? new THREE.Color(2.4, 2.0, 0.8) : new THREE.Color(0.5, 0.3, 0.12));
      bulbs.instanceColor.needsUpdate = true;
      if (moving || dirty || (wins && winT < 3) || (M && active && Math.random() < 0.1)) { draw(); dirty = false; }
    },
  };
  // the screen: three reels of symbols, the middle row under the pay line, wins outlined
  function draw() {
    const w = cv.width, h = cv.height, rw = w / 3, rh = h / 3;
    sc.fillStyle = '#0c0a10'; sc.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const g = sc.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d8d4cc'); g.addColorStop(0.5, '#fffdf6'); g.addColorStop(1, '#d8d4cc');
      sc.fillStyle = g; sc.fillRect(i * rw + 6, 4, rw - 12, h - 8);
      const r = reels[i], s = S[i], n = s.length, base = Math.floor(r.pos), frac = r.pos - base;
      sc.save(); sc.beginPath(); sc.rect(i * rw + 6, 4, rw - 12, h - 8); sc.clip();
      for (let row = -1; row <= 3; row++) {
        const idx = (((base + row - 1) % n) + n) % n, k = s[idx], y = (row - frac) * rh + rh / 2;
        drawSym(sc, k, i * rw + rw / 2, y, rh * 0.62, r.spinning);
      }
      sc.restore();
    }
    // the pay lines in play
    if (M) {
      const cx = (i) => i * rw + rw / 2, cy = (row) => row * rh + rh / 2;
      sc.strokeStyle = 'rgba(200,20,40,.35)'; sc.lineWidth = 3; sc.beginPath(); sc.moveTo(4, h / 2); sc.lineTo(w - 4, h / 2); sc.stroke();
      if (wins && wins.wins.length && Math.floor(winT * 3) % 2 === 0) {
        for (const wn of wins.wins) { const L = LINES[wn.line]; sc.strokeStyle = wn.jackpot ? '#ff3a2a' : '#ffd23a'; sc.lineWidth = 7; sc.shadowColor = '#ffd23a'; sc.shadowBlur = 14; sc.beginPath(); for (let i = 0; i < 3; i++) { const X = cx(i), Y = cy(L[i]); i ? sc.lineTo(X, Y) : sc.moveTo(X, Y); } sc.stroke(); sc.shadowBlur = 0; }
      }
      if (wins && wins.pay > 0 && winT < 3) { sc.fillStyle = 'rgba(0,0,0,.65)'; sc.fillRect(w * 0.2, h * 0.84, w * 0.6, h * 0.14); sc.fillStyle = '#ffd23a'; sc.font = '900 40px Arial, sans-serif'; sc.textAlign = 'center'; sc.textBaseline = 'middle'; sc.fillText(`WIN ${Math.round(wins.pay).toLocaleString()}`, w / 2, h * 0.91); }
    }
    tex.needsUpdate = true;
  }
  draw();
  return api;
}
function drawSym(c, k, x, y, size, blur) {
  const s = SYM[k] || SYM.BLANK; if (!s.label) return;
  c.save(); c.globalAlpha = blur ? 0.7 : 1; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (k === 'BAR' || k === 'BB' || k === 'BBB') {
    const n = k === 'BAR' ? 1 : k === 'BB' ? 2 : 3, bh = size * 0.26;
    for (let i = 0; i < n; i++) { const yy = y + (i - (n - 1) / 2) * bh * 1.15; c.fillStyle = '#141414'; c.fillRect(x - size * 0.48, yy - bh / 2, size * 0.96, bh); c.fillStyle = '#fff'; c.font = `900 ${bh * 0.78}px Arial`; c.fillText('BAR', x, yy + 1); }
  } else if (k === 'SEVEN') { c.font = `900 ${size * 1.05}px Georgia, serif`; c.lineWidth = 6; c.strokeStyle = '#7a0010'; c.strokeText('7', x, y + 4); c.fillStyle = '#ff2a3a'; c.fillText('7', x, y + 4); }
  else if (k === 'WILD' || k === 'BONUS' || k === 'JP') { const col = s.color; c.fillStyle = col; c.beginPath(); c.roundRect(x - size * 0.55, y - size * 0.32, size * 1.1, size * 0.64, 10); c.fill(); c.fillStyle = '#fff'; c.font = `900 ${size * (k === 'JP' ? 0.22 : 0.3)}px Arial`; c.fillText(s.label, x, y + 2); }
  else { c.font = `${size * 0.82}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.fillText(s.label, x, y + 3); }
  c.restore();
}
function buildTable(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 28, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0f5a2a, roughness: 0.9 })); felt.position.y = 0.92; g.add(felt);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 6, 28, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3a1a0c, roughness: 0.5 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.96; g.add(rim);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0x2a140a })); leg.position.y = 0.45; g.add(leg);
  for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * Math.PI, s = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x5a0f1c })); s.position.set(Math.cos(a) * 2, 0.7, Math.sin(a) * 2); g.add(s); }
  const chips = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 10), new THREE.MeshStandardMaterial({ color: 0xc8102e })); chips.position.set(0.3, 1.05, 0.5); g.add(chips);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
