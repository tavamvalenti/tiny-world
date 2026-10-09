// MINI-GAMES: the hub every activity runs through.
//   - in the world: a glowing start beacon at each activity's start point with a label you click;
//   - in the bottom bar: the PLAY button lists the activities on this map (and the ones that work anywhere);
//   - the activity card: what it is, the modes, the controls, your bests and the bronze / silver / gold targets;
//   - while one runs: its own HUD, Esc leaves, R restarts at once; it takes over the camera like the vehicles do;
//   - at the end: a results card (score breakdown, personal bests, medal) with RETRY / MODES / EXIT, and the run is
//     handed to the progression system (records, leaderboards, XP, achievements) only when it genuinely finished.
// Each activity is a class with start(mode) / update(dt) / applyCamera(dt) / key(e, down) / dispose(); it calls
// hub.finish(result) when a run is over. Everything an activity creates is removed in dispose().
import * as THREE from 'three';
import { G, clamp } from '../core.js';
import { sfx } from '../audio.js';
import { RECORDS } from '../progress/defs.js';

const CSS = `
#actBtn{position:relative;display:flex;align-items:center;font:800 11px Inter;letter-spacing:.2em;color:#e6fff6;padding:8px 16px 8px 46px;border-radius:999px;margin:-3px 0 -3px 10px;cursor:pointer;user-select:none;
  border:1px solid rgba(90,240,190,.55);background:linear-gradient(90deg,rgba(20,140,110,.6),rgba(12,36,32,.55));backdrop-filter:blur(8px);
  box-shadow:0 0 16px -3px rgba(60,230,170,.7),inset 0 0 12px rgba(120,255,210,.2);text-shadow:0 0 8px rgba(120,255,210,.8);transition:transform .25s cubic-bezier(.2,1.4,.4,1),filter .2s,box-shadow .3s}
#actBtn:hover,#actBtn.open{transform:translateY(-3px);filter:brightness(1.15);box-shadow:0 0 28px 0 rgba(60,230,170,.9),inset 0 0 14px rgba(120,255,210,.3)}
#actBtn .ab-icon{position:absolute;left:8px;top:50%;width:30px;height:30px;margin-top:-15px;pointer-events:none;transition:transform .35s cubic-bezier(.2,1.4,.4,1)}
#actBtn:hover .ab-icon{transform:scale(1.15) rotate(-8deg)}
#actBtn .ab-icon i{position:absolute;inset:2px;border-radius:50%;background:radial-gradient(circle,rgba(170,255,225,.9),rgba(40,220,160,.3) 50%,transparent 72%);animation:abPulse 1.8s ease-in-out infinite}
@keyframes abPulse{50%{transform:scale(1.18);opacity:.7}}
#actMenu{position:absolute;bottom:calc(100% + 14px);left:0;display:none;flex-direction:column;gap:4px;padding:8px;border-radius:14px;min-width:270px;
  background:rgba(10,22,20,.9);border:1px solid rgba(90,240,190,.35);backdrop-filter:blur(12px);box-shadow:0 18px 40px -12px rgba(0,0,0,.7),0 0 24px -8px rgba(60,230,170,.6);cursor:default}
#actBtn.open #actMenu{display:flex;animation:abUp .22s cubic-bezier(.2,.9,.3,1)}
@keyframes abUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
#actMenu .am-h{font:700 9px Inter;letter-spacing:.24em;color:rgba(160,255,220,.6);padding:6px 10px 2px}
#actMenu .am-i{display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .2s,transform .2s;letter-spacing:.12em}
#actMenu .am-i:hover{background:rgba(60,230,170,.16);transform:translateX(3px)}
#actMenu .am-i.off{opacity:.45;cursor:default} #actMenu .am-i.off:hover{background:none;transform:none}
#actMenu .am-i b{display:block;font:800 11px Inter;color:#eafff7}
#actMenu .am-i small{display:block;margin-top:3px;font:500 9.5px Inter;letter-spacing:.04em;color:rgba(200,255,235,.6);text-shadow:none}
#actMenu .am-i .em{font-size:20px;text-align:center;text-shadow:none}
html.touch #actBtn{display:none}
body.act-on #weapons .w,body.act-on #weapons .sep,body.act-on #worldBtn,body.act-on #tiltCtl,body.act-on #help,body.act-on #placeHint,body.act-on #worldMenu,
body.act-on #vehBtn,body.act-on #rickBtn,body.act-on #actBtn,body.act-on .act-tag{display:none!important}
body.act-on #progChip{opacity:.5}
/* start beacons' labels */
.act-tag{position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;white-space:nowrap;
  font:800 10px Inter;letter-spacing:.2em;color:#eafff7;background:rgba(8,30,26,.78);border:1px solid rgba(90,240,190,.6);box-shadow:0 0 18px -4px rgba(60,230,170,.9);backdrop-filter:blur(6px);transition:transform .2s,filter .2s}
.act-tag:hover{filter:brightness(1.2);transform:translate(-50%,-100%) translateY(-3px)}
.act-tag .em{font-size:15px} .act-tag small{display:block;font:600 8px Inter;letter-spacing:.18em;color:rgba(170,255,225,.7)}
.act-tag:after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-1px;width:2px;height:7px;background:rgba(90,240,190,.8)}
/* the activity card and the results card */
#actCard,#actRes{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif;color:#eef6f3}
#actCard{background:rgba(4,8,8,.55);backdrop-filter:blur(5px)}
#actCard.open,#actRes.open{display:flex}
#actRes{pointer-events:none}
.ac-p{width:min(640px,100%);max-height:90vh;overflow:auto;background:rgba(12,20,19,.96);border:1px solid rgba(90,240,190,.28);border-radius:8px;box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 40px -14px rgba(60,230,170,.5);pointer-events:auto}
.ac-hd{display:flex;align-items:flex-start;gap:14px;padding:18px 20px 8px}
.ac-hd .em{font-size:34px;line-height:1}
.ac-hd h2{margin:0;font:500 24px 'Playfair Display',serif;letter-spacing:.06em}
.ac-hd p{margin:4px 0 0;font:500 12px/1.5 Inter;color:rgba(220,240,235,.72)}
.ac-hd .x{margin-left:auto;cursor:pointer;font:400 22px Inter;opacity:.7;padding:0 4px}
.ac-b{padding:6px 20px 18px}
.ac-b h4{margin:14px 0 8px;font:700 9.5px Inter;letter-spacing:.26em;color:#7ff0c8}
.ac-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.ac-mode{padding:12px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:background .2s,border-color .2s,transform .2s}
.ac-mode:hover{background:rgba(60,230,170,.12);border-color:rgba(90,240,190,.6);transform:translateY(-2px)}
.ac-mode b{display:block;font:800 11px Inter;letter-spacing:.16em}
.ac-mode p{margin:5px 0 8px;font:500 11px/1.45 Inter;color:rgba(220,240,235,.65)}
.ac-mode .go{display:inline-block;font:800 9.5px Inter;letter-spacing:.2em;color:#0c1a16;background:#6ff0c4;padding:5px 10px;border-radius:999px}
.ac-mode .pb{display:block;margin-top:8px;font:600 10px Inter;color:#ffd46b}
.ac-meds{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.ac-med{font:700 9px Inter;letter-spacing:.1em;padding:3px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.55)}
.ac-med.got{color:#141414;border-color:transparent} .ac-med.bronze.got{background:#d08a4a} .ac-med.silver.got{background:#d6dde4} .ac-med.gold.got{background:#ffd34a}
.ac-keys{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px 14px;font:500 11px Inter;color:rgba(220,240,235,.8)}
.ac-keys .key{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:17px;padding:0 5px;margin-right:7px;border-radius:3px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);font:600 9px Inter;color:#fff}
.ac-note{font:500 10.5px/1.5 Inter;color:rgba(220,240,235,.55);margin-top:12px}
.ar-big{font:800 40px Inter;letter-spacing:.02em;color:#fff;margin:4px 0 2px}
.ar-sub{font:700 10px Inter;letter-spacing:.24em;color:#7ff0c8}
.ar-grid{display:grid;grid-template-columns:1fr auto;gap:5px 18px;font:500 12px Inter;margin-top:12px}
.ar-grid span:nth-child(even){text-align:right;color:#fff;font-weight:700}
.ar-pb{margin-top:10px;font:800 10px Inter;letter-spacing:.2em;color:#ffd46b}
.ar-medal{display:inline-flex;align-items:center;gap:8px;margin-top:10px;font:800 11px Inter;letter-spacing:.2em;padding:6px 12px;border-radius:999px;color:#151515}
.ar-medal.bronze{background:#d08a4a} .ar-medal.silver{background:#d6dde4} .ar-medal.gold{background:#ffd34a} .ar-medal.none{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
.ar-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.ar-btns button{flex:1;min-width:110px;font:800 10px Inter;letter-spacing:.2em;padding:11px 12px;border-radius:999px;border:1px solid rgba(90,240,190,.5);background:rgba(60,230,170,.1);color:#eafff7;cursor:pointer}
.ar-btns button.pri{background:#6ff0c4;color:#0c1a16;border-color:transparent}
.ar-btns button:hover{filter:brightness(1.15)}
.ar-btns .key{font:600 8px Inter;opacity:.7;margin-left:6px}
.ar-invalid{margin-top:10px;font:600 11px Inter;color:#ff9a7a}
/* the shared in-run HUD pieces */
#actHud{position:absolute;inset:0;pointer-events:none;display:none;font-family:Inter,system-ui,sans-serif}
body.act-on #actHud{display:block}
#actHud .ah-keys{position:absolute;right:16px;bottom:calc(4.2vh + 14px);display:flex;flex-direction:column;align-items:flex-end;gap:4px;font:600 9.5px Inter;letter-spacing:.12em;text-transform:uppercase;color:rgba(235,255,248,.7);text-shadow:0 1px 3px rgba(0,0,0,.8)}
#actHud .key{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:15px;padding:0 4px;margin-left:6px;border-radius:3px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);font:600 8.5px Inter;color:#fff;letter-spacing:0}
#actHud .ah-pop{position:absolute;left:50%;top:34%;transform:translate(-50%,0);display:flex;flex-direction:column;align-items:center;gap:4px}
#actHud .ah-pop span{font:900 15px Inter;letter-spacing:.18em;color:#fff;text-shadow:0 0 14px var(--c,rgba(80,240,190,.9)),0 2px 4px rgba(0,0,0,.7);animation:ahPop 1.3s ease-out forwards}
#actHud .ah-pop span.big{font-size:22px}
@keyframes ahPop{0%{opacity:0;transform:scale(.6)}12%{opacity:1;transform:scale(1.12)}22%{transform:scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-26px)}}
#actHud .ah-count{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font:900 80px Inter;color:#fff;text-shadow:0 0 30px rgba(80,240,190,.9);opacity:0}
#actHud .ah-count.show{animation:ahCount .9s ease-out}
@keyframes ahCount{0%{opacity:0;transform:translate(-50%,-50%) scale(1.8)}20%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(.8)}}
`;

export class ActivityHub {
  constructor(scene, camera, post, cam, renderer, defs) {
    this.scene = scene; this.camera = camera; this.post = post; this.cam = cam; this.renderer = renderer;
    this.defs = defs.filter((d) => d.map === '*' || d.map === G.mapName);
    this.others = defs.filter((d) => !this.defs.includes(d));
    this.cur = null; this.curDef = null; this.mode = null; this.resultsUp = false;
    G.hub = this;
    if (!document.getElementById('actCss')) { const st = document.createElement('style'); st.id = 'actCss'; st.textContent = CSS; document.head.appendChild(st); }
    this.buildUi(); this.buildBeacons();
  }
  get active() { return !!this.cur; }

  // ---------------- UI: the PLAY button, the card, the results, the shared HUD
  buildUi() {
    const bar = document.getElementById('weapons');
    this.btn = document.createElement('span'); this.btn.id = 'actBtn'; this.btn.title = 'Mini-games on this map';
    const item = (d, off) => `<div class="am-i ${off ? 'off' : ''}" data-id="${d.id}"><span class="em">${d.icon}</span><span><b>${d.name.toUpperCase()}</b><small>${off ? `In ${d.where}` : d.tag}</small></span></div>`;
    this.btn.innerHTML = `<span class="ab-icon"><i></i><svg viewBox="0 0 30 30" style="position:absolute;inset:0"><path d="M11 9l11 6-11 6z" fill="#eafff7"/></svg></span>PLAY
      <div id="actMenu"><div class="am-h">ON THIS MAP</div>${this.defs.map((d) => item(d)).join('') || '<div class="am-i off"><span class="em">·</span><span><small>No mini-games here yet</small></span></div>'}${this.others.length ? `<div class="am-h">ELSEWHERE</div>${this.others.map((d) => item(d, true)).join('')}` : ''}</div>`;
    const anchor = document.getElementById('vehBtn') || document.getElementById('rickBtn');
    if (anchor && anchor.parentNode === bar) anchor.after(this.btn); else bar.appendChild(this.btn);
    this.btn.addEventListener('click', (e) => {
      e.stopPropagation(); sfx.unlock();
      const it = e.target.closest('.am-i');
      if (it) { if (it.classList.contains('off')) return; this.btn.classList.remove('open'); this.openCard(it.dataset.id); return; }
      this.btn.classList.toggle('open');
    });
    this.onDocClick = (e) => { if (!this.btn.contains(e.target)) this.btn.classList.remove('open'); };
    document.addEventListener('click', this.onDocClick);
    const hud = document.getElementById('hud');
    this.hud = document.createElement('div'); this.hud.id = 'actHud';
    this.hud.innerHTML = '<div class="ah-game"></div><div class="ah-keys"></div><div class="ah-pop"></div><div class="ah-count"></div>';
    hud.appendChild(this.hud);
    this.gameEl = this.hud.querySelector('.ah-game'); this.popEl = this.hud.querySelector('.ah-pop'); this.countEl = this.hud.querySelector('.ah-count');
    this.card = document.createElement('div'); this.card.id = 'actCard'; document.body.appendChild(this.card);
    this.res = document.createElement('div'); this.res.id = 'actRes'; document.body.appendChild(this.res);
    this.card.addEventListener('click', (e) => {
      if (e.target === this.card || e.target.closest('[data-a="close"]')) { this.closeCard(); return; }
      const m = e.target.closest('[data-mode]'); if (m) { const id = this.card.dataset.id; this.closeCard(); this.start(id, m.dataset.mode); }
    });
    this.res.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'retry') this.restart(); else if (b.dataset.a === 'modes') { const id = this.curDef.id; this.exit(); this.openCard(id); } else this.exit();
    });
  }
  // the start beacons: a ring and a soft column of light, with a label to click
  buildBeacons() {
    this.beacons = [];
    for (const d of this.defs) {
      const at = d.at && d.at(G.city); if (!at) continue;
      const y = at.y ?? (G.buildings ? G.buildings.surfaceAt(at.x, at.z, 999).y : 0);
      const g = new THREE.Group(); g.position.set(at.x, y, at.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 1.6), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.y = 0.06;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 14, 24, 1, true).translate(0, 7, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.4, 1), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      g.add(ring, col); this.scene.add(g);
      const tag = document.createElement('div'); tag.className = 'act-tag'; tag.innerHTML = `<span class="em">${d.icon}</span><span>${d.name.toUpperCase()}<small>CLICK TO PLAY</small></span>`;
      tag.addEventListener('click', (e) => { e.stopPropagation(); sfx.unlock(); this.openCard(d.id); });
      document.getElementById('hud').appendChild(tag);
      this.beacons.push({ d, g, ring, col, tag, p: new THREE.Vector3(at.x, y + (at.tagH ?? 6), at.z) });
    }
  }
  // the labels follow their beacons on screen (god view only)
  updateBeacons() {
    const show = !this.cur && !(G.rick && G.rick.active) && !(G.veh && G.veh.active);
    const cam = this.camera, w = innerWidth, h = innerHeight, v = new THREE.Vector3();
    for (const b of this.beacons) {
      b.g.visible = !this.cur;
      b.ring.material.opacity = 0.55 + Math.sin(G.time * 3) * 0.3;
      if (!show) { b.tag.style.display = 'none'; continue; }
      v.copy(b.p).project(cam);
      const d = cam.position.distanceTo(b.p);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1 || d > 420) { b.tag.style.display = 'none'; continue; }
      b.tag.style.display = 'flex';
      b.tag.style.left = `${((v.x + 1) / 2) * w}px`; b.tag.style.top = `${((1 - v.y) / 2) * h}px`;
      b.tag.style.opacity = clamp(1.4 - d / 300, 0.35, 1);
    }
  }

  openCard(id) {
    const d = this.defs.find((x) => x.id === id); if (!d) return;
    if (document.pointerLockElement) document.exitPointerLock();
    const P = G.progress, st = P ? P.actStats(d.id) : null;
    const modes = d.modes.map((m) => {
      const med = d.medals && d.medals[m.id], best = st && st.best[m.id];
      const got = st && st.medals[m.id];
      const meds = med ? `<div class="ac-meds">${['bronze', 'silver', 'gold'].map((k) => `<span class="ac-med ${k} ${got && MEDAL_RANK[got] >= MEDAL_RANK[k] ? 'got' : ''}">${k.toUpperCase()} ${fmtVal(med[k], med.unit)}</span>`).join('')}</div>` : '';
      return `<div class="ac-mode" data-mode="${m.id}"><b>${m.name.toUpperCase()}</b><p>${m.desc}</p><span class="go">START ▸</span>${best != null && med ? `<span class="pb">Your best: ${fmtVal(best, med.unit)}</span>` : ''}${meds}</div>`;
    }).join('');
    const recs = (d.records || []).map((k) => { const r = RECORDS[k], v = P && P.P.records[k]; return r ? `<span>${r.label.replace(/^[^:]*: /, '')}</span><span>${v ? fmtVal(v.value, r.unit) : '—'}</span>` : ''; }).join('');
    this.card.dataset.id = d.id;
    this.card.innerHTML = `<div class="ac-p"><div class="ac-hd"><span class="em">${d.icon}</span><div><h2>${d.name}</h2><p>${d.desc}</p></div><span class="x" data-a="close">×</span></div>
      <div class="ac-b"><h4>CHOOSE A MODE</h4><div class="ac-modes">${modes}</div>
      <h4>CONTROLS</h4><div class="ac-keys">${d.controls.map(([k, t]) => `<span>${k.split(' / ').map((x) => `<b class="key">${x}</b>`).join('')}${t}</span>`).join('')}</div>
      ${recs ? `<h4>YOUR RECORDS</h4><div class="ar-grid">${recs}</div>` : ''}
      ${d.note ? `<p class="ac-note">${d.note}</p>` : ''}</div></div>`;
    this.card.classList.add('open');
  }
  closeCard() { this.card.classList.remove('open'); }
  get cardOpen() { return this.card.classList.contains('open'); }

  // ---------------- the run
  start(id, mode) {
    const d = this.defs.find((x) => x.id === id); if (!d || !G.buildings) return;
    if (G.rick && G.rick.active) G.rick.exit();
    if (G.veh && G.veh.active && !d.usesVehicle) G.veh.exit();
    if (this.cur) this.dispose();
    sfx.unlock();
    this.curDef = d; this.mode = mode; this.resultsUp = false; this.res.classList.remove('open');
    this.gameEl.innerHTML = ''; this.popEl.innerHTML = '';
    this.hud.querySelector('.ah-keys').innerHTML = (d.hudKeys || d.controls).map(([k, t]) => `<span>${t}${k.split(' / ').map((x) => `<b class="key">${x}</b>`).join('')}</span>`).join('');
    document.body.classList.add('act-on'); document.body.classList.toggle('act-map', !!d.minimap);
    this.cur = new d.make(this, d);
    this.cur.start(mode);
    G.progress && G.progress.activityStarted && G.progress.activityStarted(d.id, mode);
  }
  restart() { if (!this.curDef) return; this.start(this.curDef.id, this.mode); }
  dispose() {
    if (!this.cur) return;
    try { this.cur.dispose(); } catch (e) { console.error(e); }
    this.cur = null;
    this.gameEl.innerHTML = ''; this.popEl.innerHTML = '';
  }
  exit() {
    if (!this.cur) { this.res.classList.remove('open'); return; }
    const where = this.cur.where ? this.cur.where() : null;
    this.dispose();
    this.curDef = null; this.resultsUp = false; this.res.classList.remove('open');
    document.body.classList.remove('act-on', 'act-map');
    if (document.pointerLockElement) document.exitPointerLock();
    const C = this.cam;
    if (where) { C.x = clamp(where.x, C.xMin ?? -C.half, C.xMax ?? C.half); C.z = clamp(where.z, C.zMin ?? -C.half, C.zMax ?? C.half); }
    C.distT = 70; C.tiltT = 0;
    if (this.scene.fog) { this.scene.fog.near = 60; this.scene.fog.far = 400; }
  }
  // a run has ended: score it through the progression system (only valid, finished runs), show the results
  finish(r) {
    if (!this.cur || this.resultsUp) return;           // one result per run, however often it's called
    this.resultsUp = true;
    const d = this.curDef, med = d.medals && d.medals[this.mode];
    let medal = null;
    if (r.valid && med && r.medalValue != null) {
      const better = (a, b) => (med.better === 'low' ? a <= b : a >= b);
      medal = better(r.medalValue, med.gold) ? 'gold' : better(r.medalValue, med.silver) ? 'silver' : better(r.medalValue, med.bronze) ? 'bronze' : null;
    }
    const out = r.valid && G.progress ? G.progress.activityRun(d.id, { title: d.name, better: med ? med.better : 'high', mode: this.mode, medal, best: r.medalValue, records: r.records || {}, evidence: r.evidence || {}, xp: r.xp || 0, stats: r.stats || {} }) : { pbs: [], xp: 0 };
    const pbLabels = out.pbs.map((k) => (RECORDS[k] ? RECORDS[k].label.replace(/^[^:]*: /, '') : k));
    this.res.innerHTML = `<div class="ac-p" style="width:min(420px,100%)"><div class="ac-b" style="padding-top:18px">
      <div class="ar-sub">${esc(r.title || d.name.toUpperCase())}</div>
      <div class="ar-big">${esc(r.headline)}</div><div class="ar-sub" style="color:rgba(220,240,235,.6)">${esc(r.headlineLabel || '')}</div>
      ${r.valid ? '' : `<div class="ar-invalid">${esc(r.invalidWhy || 'This run doesn\'t count.')}</div>`}
      ${med ? `<div class="ar-medal ${medal || 'none'}">${medal ? `${medal.toUpperCase()} MEDAL` : `NO MEDAL · BRONZE AT ${fmtVal(med.bronze, med.unit)}`}</div>` : ''}
      ${pbLabels.length ? `<div class="ar-pb">★ NEW PERSONAL BEST: ${esc(pbLabels.join(' · ').toUpperCase())}</div>` : ''}
      <div class="ar-grid">${(r.lines || []).map(([a, b]) => `<span>${esc(a)}</span><span>${esc(b)}</span>`).join('')}${out.xp ? `<span>XP earned</span><span style="color:#ffd46b">+${out.xp}</span>` : ''}</div>
      <div class="ar-btns"><button class="pri" data-a="retry">RETRY<span class="key">R</span></button><button data-a="modes">MODES</button><button data-a="exit">EXIT<span class="key">ESC</span></button></div></div></div>`;
    this.res.classList.add('open');
    if (document.pointerLockElement) document.exitPointerLock();
    if (medal || pbLabels.length) sfx.cheer && sfx.cheer(this.camera.position.x, this.camera.position.z, 0.4);
  }

  // ---------------- per frame and input (main.js calls these like the vehicles')
  update(dt) {
    this.updateBeacons();
    if (!this.cur) return;
    this.cur.update(dt);
    const w = this.cur.where && this.cur.where();
    if (w) { const C = this.cam; C.x = w.x; C.z = w.z; C.dist = C.distT = 26; C.ty = w.y || 0; }
  }
  applyCamera(dt) { if (this.cur && this.cur.applyCamera) this.cur.applyCamera(dt); }
  key(e, down) {
    if (this.cardOpen) { if (down && e.code === 'Escape') { this.closeCard(); return true; } return false; }
    if (!this.cur) return false;
    const c = e.code;
    if (c === 'KeyM' || c === 'KeyT' || /^F\d+$/.test(c)) return false;
    if (down && !e.repeat) {
      if (c === 'Escape') { this.exit(); e.preventDefault(); return true; }
      if (this.resultsUp && (c === 'KeyR' || c === 'Enter')) { this.restart(); return true; }
      if (!this.resultsUp && c === 'KeyR' && !(this.cur.usesR)) { this.restart(); return true; }
    }
    if (this.resultsUp) return true;
    const used = this.cur.key ? this.cur.key(e, down) : false;
    if (used !== false) e.preventDefault();
    return true;
  }
  wheel(e) { if (this.cur && this.cur.wheel) this.cur.wheel(e); }
  mousedown(e) { return this.cur && this.cur.mousedown ? this.cur.mousedown(e) : !!this.cur; }

  // ---------------- helpers for activities
  pop(text, color, big = false) {
    const s = document.createElement('span'); s.textContent = text; if (big) s.className = 'big'; if (color) s.style.setProperty('--c', color);
    this.popEl.appendChild(s); while (this.popEl.children.length > 4) this.popEl.firstChild.remove();
    setTimeout(() => s.remove(), 1350);
  }
  count(text) { const el = this.countEl; el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  // shadows follow the activity rather than the (map-clamped) overhead view
  followSun(x, z) { G.followSun && G.followSun(x, z); }
}

export const MEDAL_RANK = { bronze: 1, silver: 2, gold: 3 };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function fmtVal(v, unit) {
  if (v == null || !isFinite(v)) return '—';
  if (unit === 's') { const m = Math.floor(v / 60), s = v - m * 60; return m ? `${m}:${s.toFixed(2).padStart(5, '0')}` : `${s.toFixed(2)} s`; }
  if (unit === 'm') return v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${Math.round(v)} m`;
  if (unit === 'x') return `x${Math.round(v)}`;
  return `${Math.round(v).toLocaleString()}${unit ? ' ' + unit : ''}`;
}
