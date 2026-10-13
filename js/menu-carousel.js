// PHONE MENU: profile, players, invite friends, friends and world chat share one small strip above the destinations, sliding
// to the next card every few seconds (swipe to flip by hand). Each card opens the same thing as its desktop bubble.
const CSS = `
#mCar{display:none}
@media (max-width:520px){
  #mCar{display:block;margin:0 0 8px;pointer-events:auto}
  #mCar .tr{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;touch-action:pan-x;border-radius:14px}
  #mCar .tr::-webkit-scrollbar{display:none}
  #mCar .sl{flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box;display:flex;align-items:center;gap:11px;height:60px;padding:0 14px;border-radius:14px;cursor:pointer;color:#fff;
    background:linear-gradient(120deg,var(--a),var(--b));border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);font-family:-apple-system,'SF Pro Text',Inter,sans-serif}
  #mCar .sl .e{font-size:24px;flex:none} #mCar .sl .x{flex:1;min-width:0}
  #mCar .sl b{display:block;font:800 10px Inter;letter-spacing:.2em;opacity:.85}
  #mCar .sl small{display:block;margin-top:3px;font:600 13.5px -apple-system,Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mCar .sl .g{font:700 18px Inter;opacity:.8}
  #mCar .dots{display:flex;justify-content:center;gap:5px;margin-top:6px}
  #mCar .dots i{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.3);transition:all .3s} #mCar .dots i.on{width:14px;border-radius:3px;background:#fff}
  #menuChat{display:none!important}
  .gm-dest{max-height:none!important} .gm-list{max-height:30dvh}
  .gm-row{padding:8px 0!important} .gm-row .t b{font-size:14px!important} .gm-row .t small{font-size:10.5px!important;margin-top:1px!important}
  .gm-row .go{width:26px!important;height:26px!important} .gm-dest .gm-k{margin-bottom:4px}
}`;
import { friendsState } from './progress/friends-ui.js';
export function setupMenuCarousel(progress, { menu, profile, players, invite, friends }) {
  const dest = menu.querySelector('.gm-dest'); if (!dest) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const car = document.createElement('div'); car.id = 'mCar';
  const S = [
    { k: 'p', e: '👤', t: 'PROFILE', a: 'rgba(10,132,255,.42)', b: 'rgba(94,92,230,.36)', go: () => profile.click() },
    { k: 'n', e: '🌍', t: 'PLAYERS', a: 'rgba(255,159,10,.4)', b: 'rgba(255,90,40,.32)', go: () => players.click() },
    { k: 'i', e: '🎁', t: 'INVITE FRIENDS', a: 'rgba(48,209,88,.38)', b: 'rgba(20,150,110,.32)', go: () => invite.click() },
    { k: 'f', e: '👥', t: 'FRIENDS', a: 'rgba(191,90,242,.4)', b: 'rgba(120,60,230,.32)', go: () => friends() },
    { k: 'c', e: '💬', t: 'WORLD CHAT', a: 'rgba(100,210,255,.36)', b: 'rgba(40,120,255,.32)', go: () => { const c = document.getElementById('menuChat'); if (c) c.click(); } },
  ];
  car.innerHTML = `<div class="tr">${S.map((s) => `<div class="sl" data-k="${s.k}" style="--a:${s.a};--b:${s.b}"><span class="e">${s.e}</span><span class="x"><b>${s.t}</b><small></small></span><span class="g">›</span></div>`).join('')}</div><div class="dots">${S.map(() => '<i></i>').join('')}</div>`;
  dest.insertBefore(car, dest.firstChild);
  const tr = car.querySelector('.tr'), dots = [...car.querySelectorAll('.dots i')], sl = [...car.querySelectorAll('.sl')];
  sl.forEach((el, i) => { el.addEventListener('click', (e) => { e.stopPropagation(); S[i].go(); }); el.addEventListener('pointerdown', (e) => e.stopPropagation()); });
  tr.addEventListener('pointerdown', (e) => e.stopPropagation());
  const fill = () => {
    const P = progress.P, cash = progress.wallet ? progress.wallet.cash : 0, txt = (sel) => { const n = document.querySelector(sel); return n ? n.textContent.trim() : ''; };
    const set = (k, v) => { car.querySelector(`[data-k="${k}"] small`).textContent = v; };
    set('p', `${P.name} · ${P.xp.toLocaleString()} XP · $${cash.toLocaleString()}`);
    const n = txt('#menuPlayers .mpl-n'), on = txt('#menuPlayers .mpl-o span');
    set('n', n && n !== '0' ? `${n} players${on ? ` · ${on}` : ''}` : 'Everyone who has played');
    set('i', 'Earn up to $13,000 in Cash');
    const fi = friendsState.incoming || 0, fu = friendsState.unread || 0, fl = (friendsState.friends || []).length;
    set('f', fu ? `${fu} new message${fu > 1 ? 's' : ''}` : fi ? `${fi} friend request${fi > 1 ? 's' : ''}` : fl ? `${friendsState.online || 0} of ${fl} online` : 'Add friends and message them');
    const last = txt('#menuChat small'); set('c', last || 'Talk to everyone playing');
  };
  let idx = 0, touched = 0;
  const show = (i, smooth = true) => { idx = (i + S.length) % S.length; tr.scrollTo({ left: idx * tr.clientWidth, behavior: smooth ? 'smooth' : 'auto' }); };
  tr.addEventListener('scroll', () => { const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); if (i !== idx && Date.now() - touched < 1500) idx = i; dots.forEach((d, j) => d.classList.toggle('on', j === Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)))); }, { passive: true });
  tr.addEventListener('touchstart', () => { touched = Date.now(); }, { passive: true });
  dots[0].classList.add('on'); fill();
  setInterval(fill, 1500);
  setInterval(() => { if (Date.now() - touched > 8000 && car.offsetParent) show(idx + 1); }, 4000);
}
