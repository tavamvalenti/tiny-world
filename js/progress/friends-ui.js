// FRIENDS: send a request by name (or tap a name in the world chat), accept / decline requests, see who's online,
// and private messages between friends (only the two of you see them).
// Accounts only; the server decides everything (server/friends.sql: friend_request / friend_respond / friend_list).
import { CSS as IV_CSS } from './invite-ui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = IV_CSS.split('#invitePanel').join('#friendsPanel') + `
#friendsPanel .add{display:flex;gap:8px} #friendsPanel .add input{flex:1;min-width:0;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;font:500 14px -apple-system,Inter,sans-serif;outline:none}
#friendsPanel .fr{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:14px;background:rgba(255,255,255,.05);margin-bottom:6px}
#friendsPanel .fr .av{width:34px;height:34px;border-radius:50%;flex:none;background:rgba(255,255,255,.14) center/cover;display:grid;place-items:center;font-size:16px}
#friendsPanel .fr .nm{flex:1;min-width:0;font:600 14px -apple-system,Inter,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#friendsPanel .fr .nm small{display:block;font:500 11.5px -apple-system,Inter,sans-serif;color:rgba(235,235,245,.55)}
#friendsPanel .fr .nm small.on{color:#30d158}
#friendsPanel .fr button{padding:7px 12px;font-size:12px}
#friendsPanel .ub{min-width:18px;height:18px;border-radius:9px;background:#ff3b30;color:#fff;font:800 10.5px Inter;display:inline-grid;place-items:center;padding:0 5px;margin-left:6px}
#friendsPanel .dmh{display:flex;align-items:center;gap:10px;margin-bottom:10px} #friendsPanel .dmh .av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.14) center/cover;display:grid;place-items:center}
#friendsPanel .dml{height:min(46vh,380px);overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:16px;background:rgba(0,0,0,.25)}
#friendsPanel .bub{max-width:78%;padding:8px 12px;border-radius:16px;font:500 14px/1.35 -apple-system,Inter,sans-serif;background:rgba(255,255,255,.12);align-self:flex-start;word-wrap:break-word}
#friendsPanel .bub.me{align-self:flex-end;background:linear-gradient(180deg,#2b95ff,#0a6ee6)} #friendsPanel .bub i{display:block;font-style:normal;font-size:10px;opacity:.55;margin-top:2px}
#friendsPanel .dmf{display:flex;gap:8px;margin-top:10px} #friendsPanel .dmf input{flex:1;min-width:0;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;font:500 14px -apple-system,Inter,sans-serif;outline:none}
#friendsPanel .empty{font:500 12.5px -apple-system,Inter,sans-serif;color:rgba(235,235,245,.5);padding:4px 2px}
#menuFriends{position:absolute;right:var(--pad);z-index:7;width:210px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;color:var(--fg);background:var(--panel);border:1px solid rgba(191,90,242,.5);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:-apple-system,Inter,sans-serif}
#menuFriends:hover{transform:translateY(-2px)} #menuFriends b{display:block;font:800 10px Inter;letter-spacing:.2em} #menuFriends small{display:block;margin-top:3px;font:600 11.5px -apple-system,Inter,sans-serif;color:#da8fff}
#menuFriends .bd{margin-left:auto;min-width:20px;height:20px;border-radius:10px;background:#ff3b30;color:#fff;font:800 11px Inter;display:none;place-items:center;padding:0 5px}
#menuFriends .bd.on{display:grid}
#menu.diving #menuFriends{opacity:0;pointer-events:none}
@media (max-width:520px){#menuFriends{display:none!important}}`;

const css = () => { if (!document.getElementById('frCss')) { const st = document.createElement('style'); st.id = 'frCss'; st.textContent = CSS; document.head.appendChild(st); } };
const rpc = (progress, fn, body) => { const A = progress.account; if (!progress.lb.provider) return Promise.resolve(null); if (!A || !A.signedIn) return Promise.resolve({ ok: false, reason: 'account' });
  return progress.lb.provider.rpc(fn, { p_player: A.a.player, p_token: A.a.token, ...body }).catch(() => null); };
const WHY = { account: 'Create an account in Profile first to add friends.', 'no such player': 'No player with that name.', self: "That's you!", guest: "That player hasn't made an account yet.", limit: 'Too many requests today. Try tomorrow.', full: 'Your friends list is full.' };
export const friendsState = { incoming: 0, friends: [], online: 0 };
const ago = (t) => { if (!t) return 'Not seen yet'; const m = (Date.now() - new Date(t)) / 6e4; return m < 60 ? `${Math.max(1, Math.round(m))} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export async function sendFriendRequest(progress, name) {
  const r = await rpc(progress, 'friend_request', { p_name: name });
  if (!r) return { ok: false, text: "Couldn't reach the server." };
  if (!r.ok) return { ok: false, text: WHY[r.reason] || 'Could not send.' };
  return { ok: true, text: r.state === 'friends' ? `You and ${name} are now friends!` : `Friend request sent to ${name}.` };
}

let panel = null, timer = 0;
export function openFriends(progress, prefill = '', dmWith = null) {
  css();
  if (!panel) {
    panel = document.createElement('div'); panel.id = 'friendsPanel'; document.body.appendChild(panel);
    panel.addEventListener('click', (e) => { if (e.target === panel || e.target.closest('.x')) { panel.classList.remove('open'); clearInterval(timer); } });
    for (const ev of ['pointerdown', 'keydown', 'keyup']) panel.addEventListener(ev, (e) => e.stopPropagation());
  }
  let data = null, say = '', bad = false, dm = null;   // dm: { name, avatar, msgs, last }
  const signed = progress.account && progress.account.signedIn;
  const row = (f, btns, sub = '') => `<div class="fr"><span class="av" style="${f.avatar ? `background-image:url('${esc(f.avatar)}')` : ''}">${f.avatar ? '' : '👤'}</span><span class="nm">${esc(f.name)}${sub}</span>${btns}</div>`;
  const tm = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const renderDm = () => {
    const l0 = panel.querySelector('.dml'), atEnd = !l0 || l0.scrollHeight - l0.scrollTop - l0.clientHeight < 40, draft = panel.querySelector('#dmIn') ? panel.querySelector('#dmIn').value : '';
    panel.innerHTML = `<div class="iv"><button class="x">✕</button><div class="dmh"><button class="ghost" data-a="back">‹ Friends</button><span class="av" style="${dm.avatar ? `background-image:url('${esc(dm.avatar)}')` : ''}">${dm.avatar ? '' : '👤'}</span><b style="font:700 17px -apple-system,Inter,sans-serif">${esc(dm.name)}</b></div>
      <div class="dml">${dm.msgs.length ? dm.msgs.map((m) => `<div class="bub ${m.mine ? 'me' : ''}">${esc(m.body)}<i>${tm(m.at)}</i></div>`).join('') : '<div class="empty" style="margin:auto">Say hi to your friend. Only the two of you can see this.</div>'}</div>
      <form class="dmf"><input id="dmIn" maxlength="500" placeholder="Message ${esc(dm.name)}…" autocomplete="off"><button>Send</button></form><div class="msg bad">${esc(say)}</div></div>`;
    const l = panel.querySelector('.dml'); if (atEnd) l.scrollTop = l.scrollHeight;
    const inp = panel.querySelector('#dmIn'); inp.value = draft;
    panel.querySelector('.dmf').onsubmit = async (e) => { e.preventDefault(); const t = inp.value.trim(); if (!t) return;
      const r = await rpc(progress, 'dm_send', { p_name: dm.name, p_body: t }); say = r && r.ok ? '' : r && r.reason === 'slow down' ? 'Slow down a little.' : 'Could not send.';
      if (r && r.ok) inp.value = ''; await loadDm(); setTimeout(() => { const i = panel.querySelector('#dmIn'); if (i) i.focus(); }, 0); };
  };
  const loadDm = async () => { if (!dm) return; const r = await rpc(progress, 'dm_list', { p_name: dm.name, p_after: dm.last });
    if (r && r.ok && r.msgs.length) { dm.msgs = dm.msgs.concat(r.msgs).slice(-200); dm.last = r.msgs[r.msgs.length - 1].id; }
    if (dm) renderDm(); };
  const render = () => {
    if (dm) { renderDm(); return; }
    const inp = panel.querySelector('#frName'), keep = inp ? inp.value : prefill;
    const D = data || { friends: [], incoming: [], outgoing: [] };
    panel.innerHTML = `<div class="iv"><button class="x">✕</button><h2>Friends</h2>
      <p class="lede">Add players by their name, or tap a name in the World chat.</p>
      ${signed ? '' : '<p class="note" style="color:#ff9f0a">Create an account in Profile (it takes a second) to send and accept friend requests.</p>'}
      <div class="add"><input id="frName" maxlength="24" placeholder="Player name" autocomplete="off" value="${esc(keep)}"><button data-a="add">Add friend</button></div>
      <div class="msg ${bad ? 'bad' : ''}">${esc(say)}</div>
      ${D.incoming.length ? `<h4>Friend requests (${D.incoming.length})</h4>${D.incoming.map((f) => row(f, `<button class="collect" data-a="yes" data-n="${esc(f.name)}">Accept</button><button class="ghost" data-a="no" data-n="${esc(f.name)}">Decline</button>`)).join('')}` : ''}
      <h4>Your friends (${D.friends.length})</h4>
      ${D.friends.length ? D.friends.map((f) => row(f, `<button data-a="dm" data-n="${esc(f.name)}">Message${f.unread ? `<span class="ub">${f.unread}</span>` : ''}</button><button class="ghost" data-a="rm" data-n="${esc(f.name)}" title="Remove friend">✕</button>`, f.online ? '<small class="on">● Online now</small>' : `<small>${ago(f.seen)}</small>`)).join('') : `<div class="empty">${data ? 'No friends yet. Add someone!' : signed ? 'Loading…' : 'Sign in to see your friends.'}</div>`}
      ${D.outgoing.length ? `<h4>Sent requests</h4>${D.outgoing.map((f) => row(f, `<button class="ghost" data-a="no" data-n="${esc(f.name)}">Cancel</button>`, '<small>Waiting for them to accept</small>')).join('')}` : ''}
    </div>`;
  };
  const load = async () => { const r = await rpc(progress, 'friend_list', {}); if (r && r.ok) { data = r; friendsState.incoming = r.incoming.length; if (!dm) render(); } };
  panel.onclick = async (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const a = b.dataset.a, n = b.dataset.n;
    if (a === 'back') { dm = null; say = ''; await load(); render(); return; }
    if (a === 'dm') { const f = (data.friends || []).find((x) => x.name === n) || { name: n }; dm = { name: n, avatar: f.avatar, msgs: [], last: 0 }; say = ''; await loadDm(); setTimeout(() => { const i = panel.querySelector('#dmIn'); if (i) i.focus(); }, 0); return; }
    if (a === 'add') { const name = panel.querySelector('#frName').value.trim(); if (!name) return; const r = await sendFriendRequest(progress, name); say = r.text; bad = !r.ok; if (r.ok) panel.querySelector('#frName').value = ''; await load(); render(); return; }
    if (a === 'rm' && !confirm(`Remove ${n} from your friends?`)) return;
    const r = await rpc(progress, 'friend_respond', { p_name: n, p_yes: a === 'yes' });
    say = r && r.ok ? (a === 'yes' ? `You and ${n} are now friends!` : a === 'rm' ? `${n} removed.` : 'Done.') : 'Could not do that right now.'; bad = !(r && r.ok);
    await load(); render();
  };
  panel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'frName') panel.querySelector('[data-a="add"]').click(); });
  render(); panel.classList.add('open'); load().then(() => { if (dmWith) { const f = (data && data.friends || []).find((x) => x.name.toLowerCase() === dmWith.toLowerCase()); if (f) { dm = { name: f.name, avatar: f.avatar, msgs: [], last: 0 }; loadDm(); } } });
  clearInterval(timer); let tick = 0; timer = setInterval(() => { if (!panel.classList.contains('open')) return; tick++; if (dm) loadDm(); else if (tick % 4 === 0) load(); }, 3000);
}

// the menu bubble (desktop): friends online, and a red badge for new requests
export function setupFriendsBubble(progress, { menu, below }) {
  css();
  const bub = document.createElement('div'); bub.id = 'menuFriends';
  bub.innerHTML = '<span style="font-size:20px">👥</span><div><b>FRIENDS</b><small>Add friends</small></div><span class="bd"></span>';
  menu.appendChild(bub);
  bub.addEventListener('click', (e) => { e.stopPropagation(); openFriends(progress); });
  bub.addEventListener('pointerdown', (e) => e.stopPropagation());
  const place = () => { const a = below(); if (a) bub.style.top = `${a.offsetTop + a.offsetHeight + 10}px`; };
  setInterval(place, 200); place();
  const poll = async () => {
    const r = await rpc(progress, 'friend_list', {}); if (!r || !r.ok) return;
    friendsState.incoming = r.incoming.length; friendsState.friends = r.friends; friendsState.online = r.friends.filter((f) => f.online).length;
    const bd = bub.querySelector('.bd'); const unread = r.friends.reduce((n, f) => n + (+f.unread || 0), 0); bd.textContent = r.incoming.length + unread; bd.classList.toggle('on', r.incoming.length + unread > 0); friendsState.unread = unread;
    bub.querySelector('small').textContent = unread ? `${unread} new message${unread > 1 ? 's' : ''}` : r.incoming.length ? `${r.incoming.length} new request${r.incoming.length > 1 ? 's' : ''}` : r.friends.length ? `${friendsState.online} of ${r.friends.length} online` : 'Add friends';
  };
  poll(); setInterval(poll, 30000);
  return bub;
}
