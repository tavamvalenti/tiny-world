// PHONES AND TABLETS: everything to ride and play, by touch (html.touch only; the desktop never builds any of this).
//   - two round buttons above the weapon dock: RIDE (Rick's ship, the drone, the balloon chair, the jetpack) and
//     PLAY (this map's mini-games and Drone Combat), each opening a bottom sheet;
//   - while flying (any vehicle, Rick's ship, Drone Combat): drag anywhere on the screen to aim / steer; a joystick
//     to fly where you point, up / down, FIRE (hold), a second weapon, BOOST, the camera and EXIT;
//   - while driving (Highway Cut-Up, the snowmobile): a joystick (up gas, down brake, sideways steer), BOOST and the handbrake;
//   - the casino needs only its own panel (and EXIT).
// The buttons press the same keys a keyboard would (the game's own key handler routes them), so every vehicle and
// game behaves exactly as it does on a computer. Moving is a joystick (it holds W/A/S/D); two fingers pinch to zoom.
import { G, clamp } from './core.js';
import { sfx } from './audio.js';

const ICON = {
  ride: '<svg viewBox="0 0 24 24"><path d="M4 7h6M14 7h6M7 7l3 5h4l3-5"/><rect x="9" y="11" width="6" height="4" rx="1"/><path d="M12 15v4"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>',
};
const CSS = `
#tpBtns{display:none}
html.touch #tpBtns{display:flex;position:absolute;left:calc(14px + var(--sl,0px));bottom:calc(var(--sb,0px) + 96px);gap:10px;pointer-events:auto;z-index:8}
html.touch body.veh-on #tpBtns,html.touch body.act-on #tpBtns,html.touch body.rick-on #tpBtns{display:none}
/* the round buttons, in the WORLD button's style: a see-through gradient, a coloured rim, a glow and a passing sheen */
#tpBtns .tb{--a:rgba(255,159,10,.5);--b:rgba(255,69,58,.42);--rim:rgba(255,190,120,.7);--glow:rgba(255,140,60,.75);
  width:60px;height:60px;border-radius:50%;display:grid;place-items:center;position:relative;overflow:visible;color:#fff;
  background:linear-gradient(135deg,var(--a),var(--b));border:1px solid var(--rim);backdrop-filter:blur(14px) saturate(170%);-webkit-backdrop-filter:blur(14px) saturate(170%);
  box-shadow:0 0 18px -3px var(--glow),0 10px 22px -10px rgba(0,0,0,.65),inset 0 0 14px rgba(255,255,255,.18),inset 0 1px 0 rgba(255,255,255,.45);
  animation:tpGlow 2.8s ease-in-out infinite;transition:transform .18s cubic-bezier(.2,1.4,.4,1),filter .18s}
#tpBtns .tb::after{content:'';position:absolute;inset:0;border-radius:50%;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.4) 50%,transparent 70%);background-size:250% 100%;animation:tpSheen 4.5s ease-in-out infinite;pointer-events:none}
@keyframes tpSheen{0%,55%{background-position:120% 0}100%{background-position:-120% 0}}
@keyframes tpGlow{50%{box-shadow:0 0 26px 0 var(--glow),0 10px 22px -10px rgba(0,0,0,.65),inset 0 0 16px rgba(255,255,255,.25),inset 0 1px 0 rgba(255,255,255,.45)}}
#tpBtns .tb svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(255,255,255,.7))}
#tpBtns .tb[data-t="play"] svg{fill:#fff;stroke:none}
#tpBtns .tb.ride{--a:rgba(255,179,64,.55);--b:rgba(255,69,58,.45);--rim:rgba(255,200,130,.75);--glow:rgba(255,140,60,.8)}
#tpBtns .tb.play{--a:rgba(48,209,88,.55);--b:rgba(20,170,160,.45);--rim:rgba(140,255,190,.75);--glow:rgba(48,209,88,.8)}
#tpBtns .tb small{position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);font:800 8.5px -apple-system,Inter,sans-serif;letter-spacing:.16em;color:#fff;text-shadow:0 0 8px var(--glow),0 1px 3px #000}
#tpBtns .tb:active{transform:scale(.9);filter:brightness(1.25)}
/* the sheet */
#tpSheet{display:none;position:fixed;inset:0;z-index:62;background:rgba(0,0,0,.35)}
#tpSheet.open{display:block}
#tpSheet .sh{position:absolute;left:0;right:0;bottom:0;max-height:76vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 16px calc(var(--sb,0px) + 18px);border-radius:24px 24px 0 0;
  background:linear-gradient(180deg,rgba(44,46,56,.92),rgba(20,22,28,.97));backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%);border-top:1px solid rgba(255,255,255,.16);animation:tpUp .28s cubic-bezier(.2,.9,.3,1);font-family:-apple-system,'SF Pro Text',Inter,sans-serif;color:#fff}
@keyframes tpUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
#tpSheet .grab{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,.25);margin:0 auto 10px}
#tpSheet h3{margin:6px 2px 10px;font:700 20px -apple-system,'SF Pro Display',Inter,sans-serif}
#tpSheet h4{margin:16px 2px 8px;font:600 12px -apple-system,Inter,sans-serif;color:rgba(235,235,245,.6)}
#tpSheet .it{display:flex;align-items:center;gap:14px;padding:14px;border-radius:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);margin-bottom:8px}
#tpSheet .it:active{background:rgba(255,255,255,.14);transform:scale(.99)}
#tpSheet .it .em{font-size:28px;width:40px;text-align:center}
#tpSheet .it b{display:block;font:600 16px -apple-system,Inter,sans-serif} #tpSheet .it small{display:block;margin-top:3px;font:400 12.5px -apple-system,Inter,sans-serif;color:rgba(235,235,245,.6)}
#tpSheet .it.off{opacity:.45}
/* the control pad */
html.touch #fsBtn,html.touch #menu button.menu-fs,html.touch #resetView{display:none!important}
#tpPad{display:none;position:fixed;inset:0;z-index:9;pointer-events:none;font-family:-apple-system,'SF Pro Text',Inter,sans-serif}
html.touch #tpPad.on{display:block}
#tpPad .look{position:absolute;inset:0;pointer-events:auto;touch-action:none}
#tpPad .k{--a:rgba(120,140,170,.34);--b:rgba(60,70,100,.3);--rim:rgba(220,230,255,.5);--glow:rgba(150,180,255,.45);
  position:absolute;pointer-events:auto;touch-action:none;display:grid;place-items:center;border-radius:50%;color:#fff;font:800 10.5px -apple-system,Inter,sans-serif;letter-spacing:.1em;text-shadow:0 0 6px rgba(255,255,255,.5),0 1px 2px rgba(0,0,0,.6);user-select:none;-webkit-user-select:none;overflow:hidden;
  background:linear-gradient(135deg,var(--a),var(--b));border:1px solid var(--rim);backdrop-filter:blur(14px) saturate(170%);-webkit-backdrop-filter:blur(14px) saturate(170%);
  box-shadow:0 0 14px -4px var(--glow),0 8px 18px -8px rgba(0,0,0,.7),inset 0 0 12px rgba(255,255,255,.14),inset 0 1px 0 rgba(255,255,255,.4);transition:transform .08s,filter .08s,box-shadow .12s}
#tpPad .k::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.3) 50%,transparent 70%);background-size:250% 100%;animation:tpSheen 5.5s ease-in-out infinite;pointer-events:none}
#tpPad .k.down{transform:scale(.9);filter:brightness(1.4) saturate(1.2);box-shadow:0 0 24px 2px var(--glow),inset 0 0 18px rgba(255,255,255,.3)}
#tpPad .k svg{width:24px;height:24px;fill:#fff;filter:drop-shadow(0 0 4px rgba(255,255,255,.7))}
#tpPad .k.fire{--a:rgba(255,55,95,.6);--b:rgba(200,20,60,.5);--rim:rgba(255,150,170,.8);--glow:rgba(255,55,95,.85);font-size:12px}
#tpPad .k.alt{--a:rgba(255,179,64,.55);--b:rgba(255,120,20,.45);--rim:rgba(255,210,150,.75);--glow:rgba(255,159,10,.8)}
#tpPad .k.boost{--a:rgba(10,132,255,.55);--b:rgba(94,92,230,.45);--rim:rgba(150,200,255,.8);--glow:rgba(10,132,255,.85)}
#tpPad .k.gas{--a:rgba(48,209,88,.6);--b:rgba(20,160,90,.5);--rim:rgba(150,255,190,.8);--glow:rgba(48,209,88,.85);border-radius:24px}
#tpPad .k.brake{--a:rgba(255,69,58,.5);--b:rgba(180,30,30,.42);--rim:rgba(255,160,150,.75);--glow:rgba(255,69,58,.8);border-radius:20px}
#tpPad .k.steer{--a:rgba(120,150,255,.42);--b:rgba(150,70,255,.36);--rim:rgba(190,200,255,.7);--glow:rgba(130,140,255,.75);border-radius:26px}
#tpPad .joy{position:absolute;width:132px;height:132px;border-radius:50%;pointer-events:auto;touch-action:none;
  background:radial-gradient(circle,rgba(120,150,255,.16),rgba(150,70,255,.26));border:1.5px solid rgba(190,200,255,.55);box-shadow:0 10px 30px -10px rgba(0,0,0,.6),inset 0 0 22px rgba(160,170,255,.35);backdrop-filter:blur(12px) saturate(160%);-webkit-backdrop-filter:blur(12px) saturate(160%)}
#tpPad .joy b{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;pointer-events:none;
  background:linear-gradient(150deg,rgba(255,255,255,.55),rgba(150,160,255,.35));border:1px solid rgba(255,255,255,.75);box-shadow:0 6px 16px -4px rgba(0,0,0,.6),0 0 18px rgba(140,150,255,.7)}
#tpPad .top{position:absolute;left:calc(10px + var(--sl,0px));top:calc(var(--st,0px) + 10px);display:flex;gap:7px;pointer-events:auto}
#tpPad .top span.ic{width:40px;height:40px;padding:0;display:grid;place-items:center;font-size:17px}
#tpPad .top span{padding:9px 16px;border-radius:999px;font:700 12px -apple-system,Inter,sans-serif;color:#fff;text-shadow:0 0 6px rgba(255,255,255,.4);
  background:linear-gradient(120deg,rgba(40,110,255,.4),rgba(150,70,255,.36));border:1px solid rgba(170,190,255,.6);backdrop-filter:blur(14px) saturate(170%);-webkit-backdrop-filter:blur(14px) saturate(170%);
  box-shadow:0 0 14px -4px rgba(120,140,255,.7),0 8px 18px -8px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.35)}
#tpPad .top span.x{background:linear-gradient(120deg,rgba(255,69,58,.55),rgba(255,55,120,.45));border-color:rgba(255,160,160,.7);box-shadow:0 0 14px -4px rgba(255,69,58,.8),0 8px 18px -8px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.35)}
#tpPad .top span:active{transform:scale(.93)}
#tpPad .hint{position:absolute;left:50%;top:38%;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.45);font:600 12px -apple-system,Inter,sans-serif;color:#fff;opacity:0;transition:opacity .4s;white-space:nowrap}
#tpPad .hint.on{opacity:1}
/* touch versions of the game's own HUDs: no keyboard hints, nothing under the thumbs */
html.touch #vehHud .vh-keys,html.touch #vehHud .vh-tip,html.touch #actHud .ah-keys,html.touch #rickHud .rk-keys,html.touch #rickHud .rk-tip{display:none!important}
html.touch body.veh-on #weapons,html.touch body.act-on #weapons,html.touch body.rick-on #weapons,html.touch body.veh-on #worldBtn,html.touch body.act-on #worldBtn,html.touch body.rick-on #worldBtn,
html.touch body.veh-on #tiltCtl,html.touch body.act-on #tiltCtl,html.touch body.rick-on #tiltCtl,html.touch body.veh-on #resetView,html.touch body.act-on #resetView,html.touch body.rick-on #resetView{display:none!important}
html.touch body.veh-on #backBtn,html.touch body.act-on #backBtn,html.touch body.rick-on #backBtn{display:none!important}
html.touch #minimap{display:none!important}
html.touch body.veh-on #minimap,html.touch body.rick-on #minimap,html.touch body.act-map #minimap{display:block!important;left:auto!important;right:calc(10px + var(--sr,0px));bottom:auto!important;top:calc(var(--st,0px) + 58px);width:128px!important;height:96px!important;border-radius:16px!important}
html.touch #minimap .mm-btn,html.touch #minimap .mm-place{display:none}
html.touch #minimap .mm-pill{bottom:6px;font-size:9.5px}
html.touch .tc-spd,html.touch .sl-spd{bottom:calc(var(--sb,0px) + 168px)!important}
html.touch .tc-spd b,html.touch .sl-spd b{font-size:30px!important}
html.touch .tc-top,html.touch .sl-top,html.touch .dg-top{top:calc(var(--st,0px) + 56px)!important}
html.touch .tc-score,html.touch .sl-time{font-size:26px!important}
html.touch .tc-combo{top:calc(var(--st,0px) + 124px)!important}
html.touch .sl-tgt{top:calc(var(--st,0px) + 160px)!important;right:10px!important;font-size:8.5px!important}
html.touch .dg-bot{bottom:calc(var(--sb,0px) + 188px)!important;transform:translateX(-50%) scale(.85)!important}
html.touch #actHud .ah-pop{top:30%;right:12px}
html.touch #progChip,html.touch #cashChip{z-index:7}
html.touch body.veh-on #progChip,html.touch body.act-on #progChip,html.touch body.rick-on #progChip,html.touch body.veh-on #cashChip,html.touch body.act-on #cashChip,html.touch body.rick-on #cashChip{display:none}
html.touch body.veh-on #mapname,html.touch body.act-on #mapname,html.touch body.rick-on #mapname{display:none}
/* the casino on a phone: the panel wraps, every button finger-sized */
html.touch .cs{bottom:calc(var(--sb,0px) + 12px)!important;padding:10px 12px!important}
html.touch .cs-row{grid-template-columns:repeat(2,1fr)!important}
html.touch .cs-btns{flex-wrap:wrap}
html.touch .cs-btns button{flex:1 1 22%;padding:12px 6px!important}
html.touch .cs-btns .spin{flex:1 1 100%!important;order:-1;font-size:16px!important;padding:16px!important}
html.touch .cs-btns .key{display:none}
html.touch .cs-pick button{width:88px;height:80px}
/* cards and results */
html.touch #actCard,html.touch #actRes{padding:calc(var(--st,0px) + 10px) 10px calc(var(--sb,0px) + 10px)!important}
html.touch #actCard .ac-p,html.touch #actRes .ac-p{max-height:100%!important}
html.touch #actCard .ac-keys{display:none}
html.touch #actCard .ac-b h4:has(+ .ac-keys){display:none}
html.touch #actRes .ar-btns button{padding:15px 12px!important;font-size:14px!important}
`;

// what each kind of ride gets on the pad: [label, key, class]; FIRE / ALT use the vehicle's own mouse buttons
const FLY = {
  drone: { up: ['UP', 'Space'], fire: 'FIRE', alt: ['GRENADE', 'KeyG'], strafe: true },
  jetpack: { up: ['THRUST', 'Space'], fire: 'FIRE', alt: ['GRENADE', 'KeyG'], strafe: true },
  chair: { up: ['RISE', 'KeyR'], down: ['SINK', 'KeyF'], fire: 'FIRE', alt: ['FIREWORK', 'KeyG'], strafe: true },
  dogfight: { up: ['UP', 'Space'], fire: 'FIRE', alt: ['MISSILE', 'KeyG'], strafe: true },
  rick: { up: ['UP', 'KeyR'], down: ['DOWN', 'KeyF'], fire: 'FIRE', alt: ['BOMB', 'KeyG'], strafe: false },
};

export class TouchPlay {
  constructor(o) {
    this.rick = o.rick; this.veh = o.veh; this.hub = o.hub; this.mode = null; this.held = new Map();
    if (!document.getElementById('tpCss')) { const st = document.createElement('style'); st.id = 'tpCss'; st.textContent = CSS; document.head.appendChild(st); }
    const hud = document.getElementById('hud');
    this.btns = document.createElement('div'); this.btns.id = 'tpBtns';
    this.btns.innerHTML = `<span class="tb ride" data-t="ride">${ICON.ride}<small>RIDE</small></span><span class="tb play" data-t="play">${ICON.play}<small>PLAY</small></span>`;
    hud.appendChild(this.btns);
    this.btns.addEventListener('click', (e) => { const b = e.target.closest('.tb'); if (!b) return; sfx.unlock(); this.openSheet(b.dataset.t); });
    this.sheet = document.createElement('div'); this.sheet.id = 'tpSheet'; document.body.appendChild(this.sheet);
    this.sheet.addEventListener('click', (e) => {
      if (e.target === this.sheet) { this.closeSheet(); return; }
      const it = e.target.closest('.it'); if (!it || it.classList.contains('off')) return;
      this.closeSheet(); sfx.unlock();
      const [kind, id] = it.dataset.go.split(':');
      if (kind === 'rick') this.rick && this.rick.enter();
      else if (kind === 'veh') this.veh && this.veh.enter(id);
      else if (kind === 'act') this.hub && this.hub.openCard(id);
    });
    this.pad = document.createElement('div'); this.pad.id = 'tpPad'; document.body.appendChild(this.pad);
    this.bindLook();
  }

  // ---------------- the sheets
  openSheet(t) {
    const item = (go, em, name, sub, off) => `<div class="it ${off ? 'off' : ''}" data-go="${go}"><span class="em">${em}</span><span><b>${name}</b><small>${sub}</small></span></div>`;
    let html = '';
    if (t === 'ride') {
      html = `<h3>Ride</h3>${this.rick ? item('rick:', '🛸', 'Wubba Lubba Dub-Dub ship', 'Fly the space cruiser · lasers and bombs') : ''}
        <h4>Vehicles</h4>${item('veh:drone', '🚁', 'Armed drone', 'Machine gun and grenades · rams explode')}${item('veh:chair', '🎈', 'Balloon chair', 'Fireballs and a firework · rise and sink')}${item('veh:jetpack', '🚀', 'Jetpack', 'Real gravity · machine gun and grenades')}`;
    } else {
      const H = this.hub, here = H ? H.defs : [], other = H ? H.others : [];
      html = `<h3>Play</h3>${here.map((d) => item(`act:${d.id}`, d.icon, d.name, d.tag)).join('') || '<p style="opacity:.6">No mini-games here yet.</p>'}
        ${other.length ? `<h4>Elsewhere</h4>${other.map((d) => item(`act:${d.id}`, d.icon, d.name, `In ${d.where}`, true)).join('')}` : ''}`;
    }
    this.sheet.innerHTML = `<div class="sh"><div class="grab"></div>${html}</div>`;
    this.sheet.classList.add('open');
  }
  closeSheet() { this.sheet.classList.remove('open'); }

  // ---------------- dragging on the screen: aim / steer
  bindLook() {
    this.lookP = null;
    this.pts = new Map();
    const zoom = (dy) => { const c = document.getElementById('game'); if (c) c.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true })); };
    this.pad.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('look')) this.pts.set(e.pointerId, [e.clientX, e.clientY]); }, true);
    this.pad.addEventListener('pointermove', (e) => {
      if (!this.pts.has(e.pointerId)) return; this.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.pts.size !== 2) return;
      const [a, b] = [...this.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!this.pinchD) { this.pinchD = d; return; }
      if (d > this.pinchD * 1.09) { zoom(-100); this.pinchD = d; } else if (d < this.pinchD / 1.09) { zoom(100); this.pinchD = d; }
    }, true);
    const lift = (e) => { this.pts.delete(e.pointerId); if (this.pts.size < 2) this.pinchD = 0; };
    this.pad.addEventListener('pointerup', lift, true); this.pad.addEventListener('pointercancel', lift, true);
    this.pad.addEventListener('pointerdown', (e) => {
      if (!e.target.classList.contains('look')) return;
      if (this.pts.size > 1) { this.lookP = null; return; }
      this.lookP = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { e.target.setPointerCapture(e.pointerId); } catch { /* fine without */ }
    });
    this.pad.addEventListener('pointermove', (e) => {
      const L = this.lookP; if (!L || L.id !== e.pointerId || this.pts.size > 1) return;
      const dx = e.clientX - L.x, dy = e.clientY - L.y; L.x = e.clientX; L.y = e.clientY;
      if (this.mode === 'rick' && this.rick) { this.rick.stick.x += dx * 0.012; this.rick.stick.y += dy * 0.012; this.rick.activity = Math.min(1, this.rick.activity + Math.hypot(dx, dy) * 0.003); }
      else if (this.veh && this.veh.active) { this.veh.look += dx * 0.0062; this.veh.aim = clamp(this.veh.aim - dy * 0.0052, -1.2, 0.95); }
      this.hideHint();
    });
    const end = (e) => { if (this.lookP && this.lookP.id === e.pointerId) this.lookP = null; };
    this.pad.addEventListener('pointerup', end); this.pad.addEventListener('pointercancel', end);
  }

  // ---------------- the buttons: a held button holds its key
  key(code, down) {
    if (code === 'Mouse0' || code === 'Mouse2') {
      const t = this.mode === 'rick' ? this.rick : this.veh; if (t) t.keys[code] = down;
      return;
    }
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code === 'Escape' ? 'Escape' : code.replace(/^Key/, '').toLowerCase(), bubbles: true, cancelable: true }));
  }
  build(mode, kind) {
    this.releaseAll();
    const P = this.pad, sb = 'var(--sb,0px)', sl = 'var(--sl,0px)', sr = 'var(--sr,0px)';
    const btn = (label, code, cls, pos, size = 60) => `<span class="k ${cls || ''}" data-k="${code}" style="${pos};width:${size}px;height:${size}px">${label}</span>`;
    const tri = (r) => `<svg viewBox="0 0 24 24" style="transform:rotate(${r}deg)"><path d="M12 5l7 12H5z"/></svg>`;
    let html = '';
    if (mode === 'drive') {
      html = `<div class="look"></div><div class="joy" data-x="KeyA,KeyD" data-y="KeyW,KeyS" style="left:calc(18px + ${sl});bottom:calc(${sb} + 26px)"><b></b></div>
        ${btn('BOOST', 'ShiftLeft', 'boost', `right:calc(18px + ${sr});bottom:calc(${sb} + 30px)`, 76)}${btn('DRIFT', 'Space', '', `right:calc(108px + ${sr});bottom:calc(${sb} + 26px)`, 60)}
        <div class="top"><span data-k="Escape" class="x">✕ Exit</span><span data-k="KeyR" class="ic" title="Restart">↻</span></div>`;
    } else if (mode === 'casino') {
      html = `<div class="top"><span data-k="Escape" class="x">✕ Leave the casino</span></div>`;
    } else {
      const F = FLY[kind] || FLY.drone;
      html = `<div class="look"></div>
        <div class="joy" data-x="${F.strafe ? 'KeyA,KeyD' : ''}" data-y="KeyW,KeyS" style="left:calc(14px + ${sl});bottom:calc(${sb} + 20px)"><b></b></div>
        ${btn(F.up[0], F.up[1], '', `left:calc(14px + ${sl});bottom:calc(${sb} + 168px)`, 56)}${F.down ? btn(F.down[0], F.down[1], '', `left:calc(80px + ${sl});bottom:calc(${sb} + 168px)`, 56) : ''}
        ${btn(F.fire, 'Mouse0', 'fire', `right:calc(18px + ${sr});bottom:calc(${sb} + 30px)`, 86)}${btn(F.alt[0], F.alt[1], 'alt', `right:calc(116px + ${sr});bottom:calc(${sb} + 26px)`, 62)}
        ${btn('BOOST', 'ShiftLeft', 'boost', `right:calc(30px + ${sr});bottom:calc(${sb} + 132px)`, 60)}
        <div class="top"><span data-k="Escape" class="x">✕ Exit</span>${this.hub && this.hub.active ? '<span data-k="KeyR" class="ic" title="Restart">↻</span>' : ''}</div>
        <div class="hint on">Joystick to move · drag to aim · pinch to zoom</div>`;
    }
    P.innerHTML = html;
    P.querySelectorAll('[data-k]').forEach((el) => {
      const code = el.dataset.k, tap = el.closest('.top');
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); sfx.unlock();
        if (tap) { this.key(code, true); this.key(code, false); return; }
        try { el.setPointerCapture(e.pointerId); } catch { /* fine without */ } el.classList.add('down'); this.held.set(e.pointerId, code); this.key(code, true);
        if (navigator.vibrate) navigator.vibrate(8);
      });
      const up = (e) => { if (!this.held.has(e.pointerId)) return; const c = this.held.get(e.pointerId); this.held.delete(e.pointerId); el.classList.remove('down'); this.key(c, false); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    });
    P.querySelectorAll('.joy').forEach((j) => this.bindJoy(j));
    clearTimeout(this.hintT); this.hintT = setTimeout(() => this.hideHint(), 4000);
  }
  // a joystick: the knob follows the thumb; past a small dead zone each direction holds its key (like WASD)
  bindJoy(j) {
    const knob = j.querySelector('b'), [xl, xr] = (j.dataset.x || ',').split(','), [yu, yd] = (j.dataset.y || ',').split(',');
    let id = null; const on = new Set();
    const set = (want) => { for (const c of [...on]) if (!want.has(c)) { on.delete(c); this.key(c, false); this.held.delete('j' + c); } for (const c of want) if (!on.has(c)) { on.add(c); this.key(c, true); this.held.set('j' + c, c); } };
    const move = (e) => {
      const r = j.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - r.left - R, dy = e.clientY - r.top - R;
      const d = Math.hypot(dx, dy), m = Math.min(d, R * 0.62); if (d > 0) { dx = dx / d * m; dy = dy / d * m; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const nx = dx / (R * 0.62), ny = dy / (R * 0.62), want = new Set();
      if (xl && nx < -0.38) want.add(xl); if (xr && nx > 0.38) want.add(xr);
      if (yu && ny < -0.38) want.add(yu); if (yd && ny > 0.38) want.add(yd);
      set(want);
    };
    j.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlock(); id = e.pointerId; try { j.setPointerCapture(id); } catch { /* fine */ } move(e); this.hideHint(); });
    j.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; set(new Set()); };
    j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end); j.addEventListener('lostpointercapture', end);
  }
  hideHint() { const h = this.pad.querySelector('.hint'); if (h) h.classList.remove('on'); }
  releaseAll() { for (const c of this.held.values()) this.key(c, false); this.held.clear(); }

  // ---------------- every frame: which pad (if any) should be up
  update() {
    const H = this.hub, cur = H && H.active ? H.curDef : null;
    let mode = null, kind = null;
    if (this.rick && this.rick.active) { mode = 'fly'; kind = 'rick'; }
    else if (cur && cur.id === 'casino') { mode = 'casino'; }
    else if (cur && (cur.id === 'traffic' || cur.id === 'sled')) { mode = 'drive'; }
    else if (this.veh && this.veh.active) { mode = 'fly'; kind = cur && cur.id === 'dogfight' ? 'dogfight' : this.veh.kind; }
    if (H && H.resultsUp) mode = mode === 'casino' ? mode : null;     // the results card takes the taps
    const sig = mode ? `${mode}:${kind}:${H && H.active}` : null;
    if (sig !== this.sig) { this.sig = sig; this.mode = kind === 'rick' ? 'rick' : mode; this.pad.classList.toggle('on', !!mode); if (mode) this.build(mode, kind); else { this.releaseAll(); this.pad.innerHTML = ''; } }
  }
}
