// The progression UI: a compact rank chip with an XP bar under the map name, small notifications (XP, rank-ups,
// achievements, challenges, records, rewards, discoveries), and the PROFILE panel (P): profile, achievements,
// challenges, records, rewards and leaderboards, with a downloadable profile card.
import { G } from '../core.js';
import { sfx } from '../audio.js';
import * as D from './defs.js';

const CSS = `
#progChip{position:absolute;left:16px;top:calc(4.2vh + 70px);display:flex;align-items:center;gap:9px;padding:6px 12px 6px 6px;border-radius:999px;cursor:pointer;pointer-events:auto;user-select:none;
  background:rgba(12,14,18,.55);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(8px);font:600 10px Inter;letter-spacing:.16em;color:#f2f4f6;transition:transform .2s,border-color .2s}
#progChip:hover{transform:translateY(-1px);border-color:rgba(255,214,120,.6)}
#progChip .em{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font:800 11px Inter;color:#14161a;background:linear-gradient(135deg,#ffd46b,#f08a2a);box-shadow:0 0 10px rgba(255,180,80,.5)}
#progChip .xpb{display:block;width:84px;height:3px;border-radius:2px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:4px}
#progChip .xpb i{display:block;height:100%;background:linear-gradient(90deg,#ffd46b,#ff7a3a);transition:width .6s}
#progChip small{display:block;font:500 9px Inter;letter-spacing:.08em;color:rgba(255,255,255,.55);margin-top:3px}
html.touch #progChip{top:calc(var(--st,0px) + 54px);left:12px;transform:scale(.9);transform-origin:left top}
body.rick-on #progChip,body.veh-on #progChip{opacity:.55}
#progToasts{position:absolute;left:50%;top:calc(4.2vh + 58px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:6}
.pt{display:flex;align-items:center;gap:9px;padding:7px 14px;border-radius:999px;background:rgba(12,14,18,.72);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(8px);font:600 11px Inter;letter-spacing:.06em;color:#f2f4f6;
  box-shadow:0 8px 24px -10px rgba(0,0,0,.6);animation:ptIn .3s cubic-bezier(.2,1.2,.4,1),ptOut .4s ease-in forwards;animation-delay:0s,var(--life,3s)}
.pt b{font-weight:800;color:var(--c,#ffd46b)} .pt .k{font:700 9px Inter;letter-spacing:.2em;color:var(--c,#ffd46b);opacity:.85}
.pt.xp{padding:4px 11px;font-size:10px;background:rgba(12,14,18,.5)}
.pt.big{padding:12px 22px;font-size:13px;border-color:rgba(255,214,120,.7);box-shadow:0 0 30px rgba(255,170,60,.45),0 10px 30px -10px rgba(0,0,0,.7)}
.pt.big b{font-size:16px;letter-spacing:.12em}
@keyframes ptIn{from{opacity:0;transform:translateY(-8px) scale(.94)}to{opacity:1;transform:none}}
@keyframes ptOut{to{opacity:0;transform:translateY(-6px)}}
#progPanel{position:fixed;inset:0;z-index:31;display:none;align-items:center;justify-content:center;background:rgba(6,7,9,.6);backdrop-filter:blur(6px);padding:16px;font-family:Inter,system-ui,sans-serif;color:#eef0f2}
#progPanel.open{display:flex}
#progPanel .pp{width:min(860px,100%);max-height:88vh;display:flex;flex-direction:column;background:rgba(18,20,24,.97);border:1px solid rgba(255,255,255,.1);border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}
#progPanel header{flex:none;display:flex;align-items:center;gap:14px;padding:16px 20px 10px}
#progPanel header h2{margin:0;font:500 24px 'Playfair Display',serif;letter-spacing:.1em;flex:1}
#progPanel header .x{cursor:pointer;font:400 22px Inter;opacity:.7;padding:0 6px}
#progPanel nav{flex:none;display:flex;flex-wrap:wrap;gap:0 4px;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.08)}
#progPanel nav span{padding:9px 12px;font:700 10px Inter;letter-spacing:.2em;color:rgba(255,255,255,.55);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
#progPanel nav span.on{color:#ffd46b;border-color:#ffd46b}
#progPanel .body{flex:1 1 auto;min-height:0;overflow:auto;padding:16px 20px 20px}
#progPanel h4{margin:16px 0 8px;font:700 10px Inter;letter-spacing:.25em;color:#ffd46b}
#progPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
#progPanel .it{padding:10px 12px;border-radius:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
#progPanel .it.done{border-color:rgba(255,214,120,.45);background:rgba(255,200,90,.07)}
#progPanel .it.locked{opacity:.55}
#progPanel .it b{display:block;font:700 12px Inter;letter-spacing:.04em} #progPanel .it p{margin:3px 0 0;font:400 11px Inter;color:rgba(255,255,255,.62);line-height:1.4}
#progPanel .it .pb{height:4px;border-radius:2px;background:rgba(255,255,255,.1);margin-top:7px;overflow:hidden} #progPanel .it .pb i{display:block;height:100%;background:linear-gradient(90deg,#ffd46b,#ff7a3a)}
#progPanel .it .meta{display:flex;justify-content:space-between;font:500 10px Inter;color:rgba(255,255,255,.5);margin-top:5px}
#progPanel .it.eq{cursor:pointer} #progPanel .it.eq.on{outline:2px solid #ffd46b}
#progPanel .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#progPanel button,#progPanel select,#progPanel input{font:600 11px Inter;letter-spacing:.06em;color:#eef0f2;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:7px 10px}
#progPanel button{cursor:pointer} #progPanel button:hover{border-color:#ffd46b}
#progPanel table{width:100%;border-collapse:collapse;font:500 12px Inter} #progPanel td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06)} #progPanel tr.me td{color:#ffd46b}
#progPanel .note{font:400 11px Inter;color:rgba(255,255,255,.6);line-height:1.5;margin:6px 0}
#progPanel .card{max-width:100%;border-radius:6px;margin-top:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#progPanel .sw{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:6px;border:1px solid rgba(255,255,255,.3)}
`;
const ICON = {
  boom: '<path d="M12 2l2 6 6-3-3 6 6 2-6 2 3 6-6-3-2 6-2-6-6 3 3-6-6-2 6-2-3-6 6 3z"/>', fire: '<path d="M12 22c-4 0-7-3-7-7 0-4 4-6 4-10 3 2 5 5 5 8 1-1 2-3 2-4 2 2 3 4 3 6 0 4-3 7-7 7z"/>',
  hand: '<path d="M7 12V6a1.5 1.5 0 013 0v5M10 11V4a1.5 1.5 0 013 0v7M13 11V5a1.5 1.5 0 013 0v8M16 9a1.5 1.5 0 013 0v5c0 4-3 8-7 8-3 0-5-2-6-4l-3-5a1.5 1.5 0 012.5-1.5L7 14"/>',
  drone: '<path d="M4 7h6M14 7h6M7 7l3 5h4l3-5"/><rect x="9" y="11" width="6" height="4" rx="1"/><path d="M12 15v4"/>', jet: '<rect x="6" y="5" width="4" height="12" rx="2"/><rect x="14" y="5" width="4" height="12" rx="2"/><path d="M8 17l-1 4M16 17l1 4"/>',
  balloon: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7"/>', boat: '<path d="M3 15h18l-3 5H6zM12 4v11M12 4l6 8h-6"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  tower: '<path d="M8 22V8l4-6 4 6v14M8 12h8M8 17h8"/>', car: '<path d="M3 15l2-5c.5-1.2 1.5-2 3-2h8c1.5 0 2.5.8 3 2l2 5v3H3z"/><circle cx="7.5" cy="18" r="1.6"/><circle cx="16.5" cy="18" r="1.6"/>',
  sled: '<path d="M3 17h13l5-3M6 17l2-5h6l3 3M9 12l1-4h3"/><path d="M2 20h14"/>', chip: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 12H5z"/>',
};
const svg = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ICON.boom}</svg>`;
const fmt = (v, unit) => {
  if (unit === 'm') return v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${(+v).toFixed(1)} m`;
  if (unit === 's') { const m = Math.floor(v / 60), x = v - m * 60; return m ? `${m}:${x.toFixed(2).padStart(5, '0')}` : `${(+v).toFixed(2)} s`; }
  if (unit === 'x') return `x${Math.round(v)}`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
};
const money = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class ProgressUI {
  constructor(progress) {
    this.p = progress; this.tab = 'profile';
    if (!document.getElementById('progCss')) { const st = document.createElement('style'); st.id = 'progCss'; st.textContent = CSS; document.head.appendChild(st); }
    const hud = document.getElementById('hud');
    this.chip = document.createElement('div'); this.chip.id = 'progChip'; this.chip.title = 'Your profile (P)'; hud.appendChild(this.chip);
    this.toasts = document.createElement('div'); this.toasts.id = 'progToasts'; hud.appendChild(this.toasts);
    this.panel = document.createElement('div'); this.panel.id = 'progPanel'; document.body.appendChild(this.panel);
    this.chip.addEventListener('click', (e) => { e.stopPropagation(); this.open(); });
    this.panel.addEventListener('click', (e) => this.click(e));
    this.panel.addEventListener('change', (e) => this.change(e));
    progress.on((type, d) => this.onEvent(type, d));
    this.renderChip();
  }
  // ---------- the chip ----------
  renderChip() {
    const p = this.p, r = p.rank, n = p.nextRank, xp = p.P.xp;
    const pct = n ? Math.min(100, ((xp - r.xp) / (n.xp - r.xp)) * 100) : 100;
    this.chip.innerHTML = `<span class="em">${p.rankIndex + 1}</span><span>${r.name.toUpperCase()}<span class="xpb"><i style="width:${pct}%"></i></span><small>${xp.toLocaleString()} XP${n ? ` · ${(n.xp - xp).toLocaleString()} to ${n.name}` : ''}</small></span>`;
  }
  // ---------- notifications ----------
  toast(html, o = {}) {
    while (this.toasts.children.length >= (o.xp ? 4 : 3)) this.toasts.firstChild.remove();
    const el = document.createElement('div'); el.className = `pt${o.big ? ' big' : ''}${o.xp ? ' xp' : ''}`; el.innerHTML = html;
    if (o.color) el.style.setProperty('--c', o.color); el.style.setProperty('--life', `${o.life || 3}s`);
    this.toasts.appendChild(el); setTimeout(() => el.remove(), ((o.life || 3) + 0.5) * 1000);
  }
  onEvent(type, d) {
    if (type === 'change') {
      this.renderChip();
      // keep an open panel current, but not while typing in it, and not more than once a second
      const typing = this.panel.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName);
      if (this.isOpen && !typing && this.tab !== 'lb' && performance.now() - (this.lastRender || 0) > 1000) { this.lastRender = performance.now(); this.render(); }
      return;
    }
    const T = G.camTarget || { x: 0, z: 0 };
    if (type === 'xp') { const now = performance.now(); if (now - (this.lastXp || 0) > 700 || d.xp >= 50) { this.toast(`<b>+${d.xp} XP</b> ${esc(d.reason)}`, { xp: true, life: 2.2 }); this.lastXp = now; } }
    if (type === 'rankup') { this.toast(`<span class="k">RANK UP</span><b>${esc(d.rank.name.toUpperCase())}</b>`, { big: true, life: 4.5 }); sfx.cheer && sfx.cheer(T.x, T.z, 0.4); }
    if (type === 'achievement') { this.toast(`<span class="k">ACHIEVEMENT</span><b>${esc(d.name)}</b>${d.xp ? ` +${d.xp} XP` : ''}`, { life: 4 }); sfx.bell && sfx.bell(T.x, T.z); }
    if (type === 'challenge') this.toast(`<span class="k">${d.kind === 'day' ? 'DAILY' : d.kind === 'week' ? 'WEEKLY' : 'CHALLENGE'} DONE</span><b>${esc(d.name)}</b>`, { life: 4, color: '#7ce0a0' });
    if (type === 'record') this.toast(`<span class="k">${d.prev == null ? 'FIRST RECORD' : 'NEW RECORD'}</span><b>${esc(fmt(d.value, d.unit))}</b> ${esc(d.label)}`, { life: 3.5, color: '#7cc8ff' });
    if (type === 'reward') this.toast(`<span class="k">UNLOCKED</span><b>${esc(d.label)}</b>`, { life: 3.5, color: '#e0a0ff' });
    if (type === 'discover') this.toast(`<span class="k">DISCOVERED</span><b>${esc(d.name)}</b>`, { life: 2.6, color: '#9ff5d2' });
    if (type === 'landmark') this.toast(`<span class="k">LANDMARK DOWN</span><b>${esc(d.name)}</b>`, { life: 3.5, color: '#ff8a6a' });
  }
  // ---------- the panel ----------
  open(tab) { if (tab) this.tab = tab; this.panel.classList.add('open'); this.render(); if (document.pointerLockElement) document.exitPointerLock(); }
  close() { this.panel.classList.remove('open'); }
  toggle() { this.panel.classList.contains('open') ? this.close() : this.open(); }
  get isOpen() { return this.panel.classList.contains('open'); }
  render() {
    const tabs = [['profile', 'PROFILE'], ['ach', 'ACHIEVEMENTS'], ['chal', 'CHALLENGES'], ['rec', 'RECORDS'], ['rew', 'REWARDS'], ['lb', 'LEADERBOARDS']];
    this.panel.innerHTML = `<div class="pp"><header><h2>PROFILE</h2><span class="x" data-a="close">×</span></header><nav>${tabs.map(([k, l]) => `<span data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${l}</span>`).join('')}</nav><div class="body">${this['tab_' + this.tab]()}</div></div>`;
    if (this.tab === 'lb') this.loadBoard();
    if (this.tab === 'profile') this.drawCard();
  }
  click(e) {
    if (e.target === this.panel) return this.close();
    const t = e.target.closest('[data-tab],[data-a],[data-eq]'); if (!t) return;
    if (t.dataset.tab) { this.tab = t.dataset.tab; this.render(); return; }
    if (t.dataset.eq) { const [slot, id] = t.dataset.eq.split('|'); this.p.equip(slot, id); this.render(); return; }
    const a = t.dataset.a;
    if (a === 'close') this.close();
    if (a === 'name') {
      const v = this.panel.querySelector('#ppName').value, msg = this.panel.querySelector('#ppNameMsg');
      msg.textContent = 'Checking…'; this.busy = true;
      this.p.setName(v).then((r) => {
        this.busy = false;
        if (r.ok) { this.render(); const m = this.panel.querySelector('#ppNameMsg'); if (m) m.textContent = r.local || r.offline ? 'Saved. It will be checked when the leaderboards are reachable.' : 'Saved. That name is yours.'; }
        else msg.textContent = r.reason === 'taken' ? 'That name is already taken by another player. Try a different one.' : 'Use 3 to 18 letters, numbers, spaces, dots, dashes or underscores.';
      });
    }
    if (a === 'card') this.downloadCard();
    if (a === 'retry') { this.p.lb.flush().then(() => this.render()); }
  }
  change(e) { if (e.target.id === 'lbCat' || e.target.id === 'lbMap') { this.lbCat = this.panel.querySelector('#lbCat').value; this.lbMap = (this.panel.querySelector('#lbMap') || {}).value; this.loadBoard(); } }

  tab_profile() {
    const p = this.p, P = p.P, S = P.stats, n = p.nextRank;
    const visited = Object.keys(S.maps).length, places = Object.values(S.discovered).reduce((a, b) => a + b.length, 0);
    const fav = Object.entries(S.mapStats).sort((a, b) => (b[1].time || 0) - (a[1].time || 0))[0];
    const h = Math.floor(S.time / 3600), m = Math.floor((S.time % 3600) / 60);
    return `<div class="row"><input id="ppName" value="${esc(P.name)}" maxlength="18" aria-label="Display name"><button data-a="name">SAVE NAME</button><span id="ppNameMsg" class="note">${P.nameStatus === 'taken' ? 'Your name is taken by another player: choose a new one to keep sending scores.' : 'Your name on the leaderboards (each name is unique). No real names needed.'}</span></div>
      <h4>RANK</h4><div class="it"><b>${esc(p.rank.name)} · ${P.xp.toLocaleString()} XP</b><div class="pb"><i style="width:${n ? Math.min(100, ((P.xp - p.rank.xp) / (n.xp - p.rank.xp)) * 100) : 100}%"></i></div><div class="meta"><span>${n ? `${(n.xp - P.xp).toLocaleString()} XP to ${esc(n.name)}` : 'Top rank'}</span><span>${p.unlockedCount} / ${D.ACHIEVEMENTS.length} achievements</span></div></div>
      <h4>LIFETIME</h4><div class="grid">
        ${[['Blocks destroyed', S.cells.toLocaleString()], ['Property damage', money(S.damage)], ['Landmarks brought down', Object.values(S.landmarks).reduce((a, b) => a + b.length, 0)], ['Boats sunk', S.boats], ['Cities visited', `${visited} / ${D.ALL_MAPS.length}`], ['Places discovered', places], ['Challenges completed', S.challengesDone], ['Time played', `${h}h ${m}m`], ['Favourite city', fav ? D.MAP_LABELS[fav[0]] : '—']].map(([k, v]) => `<div class="it"><p>${k}</p><b>${v}</b></div>`).join('')}</div>
      <h4>PROFILE CARD</h4><canvas id="ppCard" class="card" width="1200" height="630" style="width:100%;max-width:600px"></canvas><div class="row" style="margin-top:8px"><button data-a="card">DOWNLOAD CARD</button></div>`;
  }
  tab_ach() {
    const cats = [...new Set(D.ACHIEVEMENTS.map((a) => a.cat))];
    return cats.map((c) => `<h4>${c.toUpperCase()}</h4><div class="grid">${D.ACHIEVEMENTS.filter((a) => a.cat === c).map((a) => { const g = this.p.achProgress(a); return `<div class="it ${g.done ? 'done' : ''}"><b>${g.done ? '★ ' : ''}${esc(a.name)}</b><p>${esc(a.desc)}</p>${g.done ? `<div class="meta"><span>Unlocked ${new Date(this.p.P.ach[a.id]).toLocaleDateString()}</span><span>${a.xp ? `+${a.xp} XP` : ''}</span></div>` : `<div class="pb"><i style="width:${(g.have / g.need) * 100}%"></i></div><div class="meta"><span>${g.have.toLocaleString()} / ${g.need.toLocaleString()}</span><span>${a.xp ? `+${a.xp} XP` : ''}</span></div>`}</div>`; }).join('')}</div>`).join('');
  }
  tab_chal() {
    const card = (c, have, need, done) => `<div class="it ${done ? 'done' : ''}"><b>${done ? '✓ ' : ''}${esc(c.name)}</b><p>${esc(c.desc)}</p><div class="pb"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></div><div class="meta"><span>${Math.round(have).toLocaleString()} / ${need.toLocaleString()}</span><span>+${c.xp} XP</span></div></div>`;
    const day = this.p.period('day'), week = this.p.period('week'), map = this.p.map;
    const left = (k) => { const now = new Date(); const end = k === 'day' ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) : (() => { const d = now.getUTCDay() || 7; return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 8 - d); })(); const h = Math.round((end - now) / 36e5); return h > 48 ? `${Math.round(h / 24)} days left` : `${h} h left`; };
    return `<h4>DAILY · ${day ? day.key : ''} UTC · ${left('day')}</h4><div class="grid">${this.p.periodList('day').map((c) => card(c, c.have, c.target, c.done)).join('')}</div>
      <h4>WEEKLY · ${week ? week.key : ''} · ${left('week')}</h4><div class="grid">${this.p.periodList('week').map((c) => card(c, c.have, c.target, c.done)).join('')}</div>
      <h4>${esc((D.MAP_LABELS[map] || '').toUpperCase())} CHALLENGES</h4><div class="grid">${this.p.mapChallengeList(map).map((c) => card(c, c.have, c.need, c.done)).join('')}</div>
      <h4>OTHER CITIES</h4><div class="grid">${D.ALL_MAPS.filter((m) => m !== map).map((m) => { const L = this.p.mapChallengeList(m); return `<div class="it"><b>${D.MAP_LABELS[m]}</b><p>${L.filter((c) => c.done).length} / ${L.length} challenges done</p></div>`; }).join('')}</div>
      <p class="note">Daily challenges change at midnight UTC, weekly ones on Mondays (UTC). They're picked from the date, so reloading won't change them.</p>`;
  }
  tab_rec() {
    const P = this.p.P;
    const groups = [...new Set(Object.values(D.RECORDS).map((r) => r.group || 'Sandbox'))];
    return groups.map((grp) => `<h4>${esc(grp.toUpperCase())}</h4><div class="grid">${Object.entries(D.RECORDS).filter(([, r]) => (r.group || 'Sandbox') === grp).map(([id, r]) => { const rec = P.records[id]; const perMap = r.perMap ? D.ALL_MAPS.map((m) => P.records[`${id}:${m}`] ? `${D.MAP_LABELS[m]}: ${fmt(P.records[`${id}:${m}`].value, r.unit)}` : null).filter(Boolean) : [];
      return `<div class="it ${rec ? 'done' : 'locked'}"><b>${svg(r.icon, 14)} ${esc(r.label)}</b>${rec ? `<p style="font-size:16px;color:#fff;margin-top:6px">${fmt(rec.value, r.unit)}</p><div class="meta"><span>${rec.map ? D.MAP_LABELS[rec.map] || '' : ''} · ${new Date(rec.date).toLocaleDateString()}</span><span>${rec.prev != null ? `was ${fmt(rec.prev, r.unit)}` : ''}</span></div>${perMap.length > 1 ? `<p>${perMap.join(' · ')}</p>` : ''}${this.globalLine(id, r, rec)}` : '<p>No record yet.</p>'}</div>`; }).join('')}</div>`).join('');
  }
  // the global standing of a record, from the last time it was sent (or still waiting to go)
  globalLine(id, r, rec) {
    if (!r.board) return '';
    const P = this.p.P, key = `${id}:${r.perMap ? rec.map || '' : ''}`, g = (P.global || {})[key];
    if (P.pending.some((s) => s.category === id)) return '<p style="color:#7cc8ff">Global: waiting to be sent</p>';
    return g && g.rank ? `<p style="color:#7cc8ff">Global rank #${g.rank}${r.perMap ? ` in ${D.MAP_LABELS[rec.map] || ''}` : ''}</p>` : '';
  }
  tab_rew() {
    const P = this.p.P, slots = [['title', 'TITLE'], ['drone_paint', 'DRONE PAINT'], ['jetpack_paint', 'JETPACK TANKS'], ['chair_balloons', 'BALLOON CHAIR BALLOONS'], ['badge', 'BADGES (UP TO 3 ON YOUR CARD)']];
    return slots.map(([slot, l]) => `<h4>${l}</h4><div class="grid">${D.REWARDS.filter((r) => r.slot === slot).map((r) => { const has = !!P.unlocked[r.id], on = slot === 'badge' ? P.equipped.badges.includes(r.id) : P.equipped[slot] === r.id;
      const sw = typeof r.value === 'number' ? `<span class="sw" style="background:#${r.value.toString(16).padStart(6, '0')}"></span>` : typeof r.value === 'string' ? `<span class="sw" style="background:linear-gradient(90deg,${D.BALLOON_PALETTES[r.value].slice(0, 4).map((c) => '#' + c.toString(16).padStart(6, '0')).join(',')})"></span>` : r.icon ? svg(r.icon, 14) + ' ' : '';
      return `<div class="it ${has ? 'eq' : 'locked'} ${on ? 'on' : ''}" ${has ? `data-eq="${slot}|${r.id}"` : ''}><b>${sw}${esc(r.label)}${on ? ' · EQUIPPED' : ''}</b><p>${has ? (slot === 'badge' ? 'Click to show or hide on your card' : 'Click to equip') : `Locked: ${esc(this.p.howText(r))}`}</p></div>`; }).join('')}</div>`).join('');
  }
  tab_lb() {
    const lb = this.p.lb, P = this.p.P, cats = Object.entries(D.RECORDS).filter(([, r]) => r.board);
    this.lbCat ||= cats[0][0]; const def = D.RECORDS[this.lbCat]; this.lbMap ||= this.p.map || 'downtown';
    const local = def.perMap ? P.records[`${this.lbCat}:${this.lbMap}`] : P.records[this.lbCat];
    const pend = P.pending.length;
    return `<div class="row"><select id="lbCat">${[...new Set(cats.map(([, r]) => r.group || 'Sandbox'))].map((g) => `<optgroup label="${esc(g)}">${cats.filter(([, r]) => (r.group || 'Sandbox') === g).map(([k, r]) => `<option value="${k}" ${k === this.lbCat ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</optgroup>`).join('')}</select>${def.perMap ? `<select id="lbMap">${D.ALL_MAPS.map((m) => `<option value="${m}" ${m === this.lbMap ? 'selected' : ''}>${D.MAP_LABELS[m]}</option>`).join('')}</select>` : ''}</div>
      <h4>GLOBAL TOP 10 · PLAYERS EVERYWHERE</h4><div id="lbBox">${lb.configured ? (this.lbCache && this.lbCache[`${this.lbCat}:${def.perMap ? this.lbMap : ''}`] || '<p class="note">Loading…</p>') : `<p class="note">Global leaderboards aren't switched on yet. Your best scores are kept here${pend ? ` (${pend} waiting to be sent)` : ''} and will be sent automatically as soon as they are.</p>`}</div>
      <h4>YOUR LOCAL BEST (THIS BROWSER)</h4><div class="it"><b>${local ? fmt(local.value, def.unit) : 'No score yet'}</b></div>
      ${lb.configured ? `<div class="row"><span class="note">${pend ? `${pend} score${pend > 1 ? 's' : ''} waiting to be sent.` : 'All your scores are sent.'} ${lb.status === 'error' ? `Last attempt failed (${esc(lb.lastError)}).` : lb.status === 'offline' ? 'You\'re offline.' : ''}</span>${pend ? '<button data-a="retry">SEND NOW</button>' : ''}</div>` : ''}`;
  }
  async loadBoard() {
    const lb = this.p.lb; if (!lb.configured) return;
    const cat = this.lbCat, def = D.RECORDS[cat], map = def.perMap ? this.lbMap : '', key = `${cat}:${map}`;
    const put = (html) => { (this.lbCache ||= {})[key] = html; const box = this.panel.querySelector('#lbBox'); if (box && this.lbCat === cat && (!def.perMap || this.lbMap === map)) box.innerHTML = html; };   // into the box on screen now
    try {
      if (this.p.P.pending.length) await lb.flush();                 // send anything waiting first, so your own score is on it
      const [top, me] = await Promise.all([lb.top(cat, map, 10), lb.mine(cat, map)]);
      const box = { innerHTML: '' };
      box.innerHTML = top.length ? `<table>${top.map((r) => `<tr class="${r.name.toLowerCase() === this.p.P.name.toLowerCase() ? 'me' : ''}"><td>#${r.rank}</td><td>${esc(r.name)}</td><td style="text-align:right">${fmt(r.value, def.unit)}</td><td style="text-align:right;opacity:.6">${new Date(r.created_at).toLocaleDateString()}</td></tr>`).join('')}</table>` : '<p class="note">No scores yet. Be the first.</p>';
      box.innerHTML += me && me.rank ? `<p class="note" style="color:#ffd46b">You: #${me.rank} of ${me.total} with ${fmt(me.value, def.unit)}</p>` : '<p class="note">You don\'t have a global score in this category yet.</p>';
      put(box.innerHTML);
    } catch (e) { put(`<p class="note">Couldn't reach the leaderboards right now (${esc(e.message)}). Your local scores are safe and will be sent later.</p>`); }
  }
  // ---------- the profile card: drawn on a canvas in the game's own look ----------
  drawCard(cv = this.panel.querySelector('#ppCard')) {
    if (!cv) return null;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, p = this.p, P = p.P, S = P.stats;
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0d1220'); g.addColorStop(0.55, '#1a1430'); g.addColorStop(1, '#2a1a12'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; c.fillRect(Math.random() * W, Math.random() * H * 0.6, 2, 2); }
    // a little skyline along the bottom
    c.fillStyle = 'rgba(0,0,0,.45)'; let x = 0; while (x < W) { const w = 30 + Math.random() * 60, h = 40 + Math.random() * 140; c.fillRect(x, H - h, w - 4, h); x += w; }
    c.strokeStyle = 'rgba(255,212,107,.5)'; c.lineWidth = 3; c.strokeRect(18, 18, W - 36, H - 36);
    c.fillStyle = '#ffd46b'; c.font = '700 22px Inter, sans-serif'; c.fillText('TINY WORLD', 60, 80);
    c.fillStyle = '#ffffff'; c.font = '600 64px "Playfair Display", serif'; c.fillText(P.name, 60, 160);
    const title = p.equipped('title') || p.rank.name; c.fillStyle = '#ffb35a'; c.font = '700 26px Inter, sans-serif'; c.fillText(title.toUpperCase(), 62, 205);
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '500 24px Inter, sans-serif'; c.fillText(`${p.rank.name} · ${P.xp.toLocaleString()} XP · ${p.unlockedCount}/${D.ACHIEVEMENTS.length} achievements`, 62, 250);
    // the best things they've done
    const recs = Object.entries(D.RECORDS).map(([id, r]) => P.records[id] && { r, v: P.records[id].value }).filter(Boolean).slice(0, 3);
    const lines = [[`${S.cells.toLocaleString()}`, 'blocks destroyed'], [money(S.damage), 'property damage'], ...recs.map((o) => [fmt(o.v, o.r.unit), o.r.label.toLowerCase()])].slice(0, 4);
    lines.forEach(([v, l], i) => { const bx = 62 + i * 270; c.fillStyle = '#ffffff'; c.font = '700 34px Inter, sans-serif'; c.fillText(v, bx, 340); c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '500 17px Inter, sans-serif'; c.fillText(l.length > 26 ? l.slice(0, 25) + '…' : l, bx, 368); });
    const badges = P.equipped.badges.map((id) => D.REWARDS.find((r) => r.id === id)).filter(Boolean);
    badges.forEach((b, i) => { const bx = W - 120 - i * 96; c.beginPath(); c.arc(bx, 120, 38, 0, 6.283); c.fillStyle = 'rgba(255,200,90,.18)'; c.fill(); c.strokeStyle = '#ffd46b'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#ffd46b'; c.font = '700 13px Inter'; c.textAlign = 'center'; c.fillText(b.label.split(' ')[0].toUpperCase(), bx, 175); c.textAlign = 'left'; });
    c.fillStyle = 'rgba(255,255,255,.45)'; c.font = '500 16px Inter, sans-serif'; c.fillText(`${Object.keys(S.maps).length} cities · ${Object.values(S.discovered).reduce((a, b) => a + b.length, 0)} places discovered · tavamadethis.com`, 62, H - 50);
    return cv;
  }
  downloadCard() {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630; this.drawCard(cv);
    const a = document.createElement('a'); a.download = `tiny-world-${this.p.P.name.replace(/\s+/g, '-')}.png`; a.href = cv.toDataURL('image/png'); a.click();
  }
}
