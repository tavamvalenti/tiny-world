// PHONES AND TABLETS: everything to ride and play, by touch (html.touch only; the desktop never builds any of this).
//   - two round buttons above the weapon dock: RIDE (Rick's ship, the drone, the balloon chair, the jetpack) and
//     PLAY (this map's mini-games and Drone Combat), each opening a bottom sheet;
//   - while flying (any vehicle, Rick's ship, Drone Combat): drag anywhere on the screen to aim / steer; a direction
//     pad to fly where you point, up / down, FIRE (hold), a second weapon, BOOST, the camera and EXIT;
//   - while driving (Highway Cut-Up, the snowmobile): big ◀ ▶ to steer, GAS, BRAKE, BOOST and the handbrake;
//   - the casino needs only its own panel (and EXIT).
// The buttons press the same keys a keyboard would (the game's own key handler routes them), so every vehicle and
// game behaves exactly as it does on a computer. No joystick, by request: buttons and a drag.
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
#tpBtns .tb{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(14px) saturate(170%);-webkit-backdrop-filter:blur(14px) saturate(170%);box-shadow:0 8px 22px -8px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.3);color:#fff;position:relative}
#tpBtns .tb svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#tpBtns .tb[data-t="play"] svg{fill:#fff;stroke:none}
#tpBtns .tb.ride{background:linear-gradient(180deg,rgba(255,159,10,.85),rgba(200,90,10,.85))}
#tpBtns .tb.play{background:linear-gradient(180deg,rgba(48,209,88,.9),rgba(30,150,60,.9))}
#tpBtns .tb small{position:absolute;bottom:-15px;left:50%;transform:translateX(-50%);font:800 8.5px -apple-system,Inter,sans-serif;letter-spacing:.14em;color:#fff;text-shadow:0 1px 3px #000}
#tpBtns .tb:active{transform:scale(.92)}
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
#tpPad{display:none;position:fixed;inset:0;z-index:9;pointer-events:none;font-family:-apple-system,'SF Pro Text',Inter,sans-serif}
html.touch #tpPad.on{display:block}
#tpPad .look{position:absolute;inset:0;pointer-events:auto;touch-action:none}
#tpPad .k{position:absolute;pointer-events:auto;touch-action:none;display:grid;place-items:center;border-radius:50%;color:#fff;font:800 11px -apple-system,Inter,sans-serif;letter-spacing:.08em;user-select:none;-webkit-user-select:none;
  background:rgba(20,22,28,.42);border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 16px -8px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.22);transition:transform .08s,background .08s}
#tpPad .k.down{transform:scale(.9);background:rgba(255,255,255,.3)}
#tpPad .k svg{width:24px;height:24px;fill:#fff}
#tpPad .k.fire{background:rgba(255,55,95,.55);border-color:rgba(255,120,140,.7)} #tpPad .k.fire.down{background:rgba(255,55,95,.85)}
#tpPad .k.alt{background:rgba(255,159,10,.5)} #tpPad .k.gas{background:rgba(48,209,88,.55);border-radius:22px} #tpPad .k.gas.down{background:rgba(48,209,88,.85)}
#tpPad .k.brake{background:rgba(255,69,58,.45);border-radius:18px} #tpPad .k.boost{background:rgba(10,132,255,.5)} #tpPad .k.boost.down{background:rgba(10,132,255,.85)}
#tpPad .k.steer{border-radius:24px}
#tpPad .top{position:absolute;left:50%;top:calc(var(--st,0px) + 10px);transform:translateX(-50%);display:flex;gap:8px;pointer-events:auto}
#tpPad .top span{padding:9px 16px;border-radius:999px;font:700 12px -apple-system,Inter,sans-serif;color:#fff;background:rgba(20,22,28,.55);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
#tpPad .top span.x{background:rgba(255,69,58,.55)}
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
html.touch body.veh-on #mapname,html.touch body.act-on #mapname,html.touch body.rick-on #mapname{opacity:.6}
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
      html = `<h3>Ride</h3>${this.rick ? item('rick:', '🛸', "Rick's ship", 'Fly the space cruiser · lasers and bombs') : ''}
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
    this.pad.addEventListener('pointerdown', (e) => {
      if (!e.target.classList.contains('look')) return;
      this.lookP = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { e.target.setPointerCapture(e.pointerId); } catch { /* fine without */ }
    });
    this.pad.addEventListener('pointermove', (e) => {
      const L = this.lookP; if (!L || L.id !== e.pointerId) return;
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
      html = `${btn(tri(-90), 'KeyA', 'steer', `left:calc(14px + ${sl});bottom:calc(${sb} + 24px)`, 76)}${btn(tri(90), 'KeyD', 'steer', `left:calc(100px + ${sl});bottom:calc(${sb} + 24px)`, 76)}
        ${btn('GAS', 'KeyW', 'gas', `right:calc(14px + ${sr});bottom:calc(${sb} + 24px);height:110px`, 76)}${btn('BRAKE', 'KeyS', 'brake', `right:calc(100px + ${sr});bottom:calc(${sb} + 24px)`, 64)}
        ${btn('BOOST', 'ShiftLeft', 'boost', `right:calc(100px + ${sr});bottom:calc(${sb} + 98px)`, 58)}${btn('DRIFT', 'Space', '', `right:calc(14px + ${sr});bottom:calc(${sb} + 144px)`, 54)}
        <div class="top"><span data-k="Escape" class="x">✕ Exit</span><span data-k="KeyR">↻ Restart</span><span data-k="KeyV">Camera</span></div>`;
    } else if (mode === 'casino') {
      html = `<div class="top"><span data-k="Escape" class="x">✕ Leave the casino</span></div>`;
    } else {
      const F = FLY[kind] || FLY.drone;
      html = `<div class="look"></div>
        ${btn(tri(0), 'KeyW', '', `left:calc(76px + ${sl});bottom:calc(${sb} + 124px)`, 58)}${btn(tri(180), 'KeyS', '', `left:calc(76px + ${sl});bottom:calc(${sb} + 20px)`, 58)}
        ${F.strafe ? `${btn(tri(-90), 'KeyA', '', `left:calc(14px + ${sl});bottom:calc(${sb} + 72px)`, 58)}${btn(tri(90), 'KeyD', '', `left:calc(138px + ${sl});bottom:calc(${sb} + 72px)`, 58)}` : ''}
        ${btn(F.up[0], F.up[1], '', `left:calc(14px + ${sl});bottom:calc(${sb} + 196px)`, 56)}${F.down ? btn(F.down[0], F.down[1], '', `left:calc(76px + ${sl});bottom:calc(${sb} + 196px)`, 56) : ''}
        ${btn(F.fire, 'Mouse0', 'fire', `right:calc(18px + ${sr});bottom:calc(${sb} + 30px)`, 86)}${btn(F.alt[0], F.alt[1], 'alt', `right:calc(116px + ${sr});bottom:calc(${sb} + 26px)`, 62)}
        ${btn('BOOST', 'ShiftLeft', 'boost', `right:calc(30px + ${sr});bottom:calc(${sb} + 132px)`, 60)}
        <div class="top"><span data-k="Escape" class="x">✕ Exit</span>${this.hub && this.hub.active ? '<span data-k="KeyR">↻ Restart</span>' : ''}<span data-k="KeyV">Camera</span></div>
        <div class="hint on">Drag anywhere to aim</div>`;
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
    clearTimeout(this.hintT); this.hintT = setTimeout(() => this.hideHint(), 4000);
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
