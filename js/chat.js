// WORLD CHAT: one public room for everyone. The big room opens from the menu bubble; in game it's a small round 💬
// button on the left edge (with a count of new lines) that opens a compact panel, and it disappears completely
// while riding, flying or in a mini-game so it never covers the action. Each line shows the sender's picture; tap a
// name to add them as a friend (or message them, if they already are). New lines every 3 seconds.
// Server: server/chat.sql + server/friends.sql (chat_send / chat_list2).
import { openFriends, friendsState } from './progress/friends-ui.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `
#chatModal{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(6px)}
#chatModal.on{display:flex}
.chatBox{display:flex;flex-direction:column;background:rgba(22,24,30,.84);border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 20px 50px -20px rgba(0,0,0,.8);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:#fff;font:14px -apple-system,'SF Pro Text',Inter,sans-serif;overflow:hidden}
#chatModal .chatBox{width:min(640px,92vw);height:min(620px,82vh)}
.chatBox .ch-h{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1);font:800 11px Inter;letter-spacing:.2em}
.chatBox .ch-h span{flex:1} .chatBox .ch-h button{background:rgba(255,255,255,.1);border:0;border-radius:999px;color:#fff;font:700 12px -apple-system,Inter,sans-serif;padding:6px 10px;cursor:pointer;letter-spacing:0}
.chatBox .ch-l{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:9px}
.chatBox .ch-m{display:flex;gap:9px;align-items:flex-start}
.chatBox .ch-m .av{width:30px;height:30px;border-radius:50%;flex:none;background:rgba(255,255,255,.14) center/cover;display:grid;place-items:center;font-size:14px}
.chatBox .ch-m .tx{min-width:0;word-wrap:break-word;line-height:1.35}
.chatBox .ch-m b{color:#64d2ff;margin-right:6px;cursor:pointer} .chatBox .ch-m b:hover{text-decoration:underline} .chatBox .ch-m.mine b{color:#ffb340;cursor:default;text-decoration:none}
.chatBox .ch-m i{color:rgba(255,255,255,.4);font-style:normal;font-size:11px;margin-left:6px}
.chatBox .ch-e{color:rgba(255,255,255,.45);text-align:center;margin:auto}
.chatBox form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.1)}
.chatBox input{flex:1;min-width:0;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:9px 11px;color:#fff;font:14px -apple-system,Inter,sans-serif;outline:none}
.chatBox form button{background:linear-gradient(180deg,#0a84ff,#0060df);border:0;border-radius:10px;color:#fff;font:700 13px Inter;padding:0 14px;cursor:pointer}
.chatBox .ch-h button.ch-x{width:28px;height:28px;padding:0;display:grid;place-items:center;font-size:0;border-radius:50%} .chatBox .ch-x::before{content:'';width:11px;height:11px;background:#fff;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 5l14 14M19 5L5 19'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 5l14 14M19 5L5 19'/%3E%3C/svg%3E") center/contain no-repeat}
#chatBtn{position:fixed;left:12px;top:50%;z-index:40;width:44px;height:44px;margin-top:-22px;border-radius:50%;display:none;place-items:center;font-size:19px;cursor:pointer;
  background:linear-gradient(150deg,rgba(100,210,255,.42),rgba(40,120,255,.34));border:1px solid rgba(170,220,255,.6);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 8px 22px -8px rgba(0,0,0,.6)}
#chatBtn.on{display:grid} #chatBtn b{position:absolute;right:-3px;top:-3px;min-width:17px;height:17px;border-radius:9px;background:#ff3b30;color:#fff;font:800 10px Inter;display:none;place-items:center;padding:0 4px}
#chatBtn b.on{display:grid}
#chatMini{position:fixed;left:64px;top:50%;transform:translateY(-50%);z-index:41;display:none}
#chatMini.on{display:block} #chatMini .chatBox{width:320px;height:300px}
#menuChat{position:absolute;right:var(--pad);z-index:7;width:210px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;color:var(--fg);background:var(--panel);border:1px solid rgba(100,210,255,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:-apple-system,Inter,sans-serif;transition:transform .25s}
#menuChat:hover{transform:translateY(-2px)} #menuChat b{display:block;font:800 10px Inter;letter-spacing:.2em} #menuChat small{display:block;margin-top:3px;font:600 11.5px -apple-system,Inter,sans-serif;color:#64d2ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
#menu.diving #menuChat{opacity:0;pointer-events:none}
@media (max-width:520px){#chatMini{left:8px;right:8px;top:auto;bottom:calc(var(--sb,0px) + 84px);transform:none} #chatMini .chatBox{width:auto;height:min(300px,42vh)} #chatBtn{left:8px}}`;

export function setupChat(progress, { menu, below, busy = () => false }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  let msgs = [], last = 0, sending = false, unread = 0, v2 = true;
  const rpc = (fn, body) => progress.lb.provider ? progress.lb.provider.rpc(fn, body) : Promise.reject(new Error('offline'));
  const box = (title) => `<div class="chatBox"><div class="ch-h">💬 <span>${title}</span><button type="button" class="ch-f" title="Friends and messages">👥 Friends</button><button type="button" class="ch-x">✕</button></div>
    <div class="ch-l"></div><form><input maxlength="200" placeholder="Say something to everyone…" autocomplete="off"><button>Send</button></form></div>`;
  const modal = document.createElement('div'); modal.id = 'chatModal'; modal.innerHTML = box('WORLD CHAT');
  const mini = document.createElement('div'); mini.id = 'chatMini'; mini.innerHTML = box('WORLD CHAT');
  const btn = document.createElement('div'); btn.id = 'chatBtn'; btn.title = 'World chat'; btn.innerHTML = '💬<b></b>';
  document.body.append(modal, mini, btn);
  const bub = document.createElement('div'); bub.id = 'menuChat'; bub.innerHTML = '<span style="font-size:20px">💬</span><div><b>WORLD CHAT</b><small>Talk to everyone playing</small></div>';
  menu.appendChild(bub);
  const place = () => { if (menu.style.display === 'none') return; const a = below(); if (a) bub.style.top = `${a.offsetTop + a.offsetHeight + 10}px`; };   // (not while a map plays: it forces a layout)
  setInterval(place, 200); place();

  const render = () => {
    const html = msgs.length ? msgs.map((m) => `<div class="ch-m ${m.mine ? 'mine' : ''}"><span class="av" style="${m.av ? `background-image:url('${esc(m.av)}')` : ''}">${m.av ? '' : '👤'}</span>
      <span class="tx"><b data-n="${esc(m.name)}">${esc(m.name)}</b>${esc(m.body)}<i>${new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</i></span></div>`).join('')
      : `<div class="ch-e">${progress.lb.provider ? 'No messages yet. Say hi!' : 'Chat is offline right now.'}</div>`;
    for (const l of document.querySelectorAll('.chatBox .ch-l')) { const end = l.scrollHeight - l.scrollTop - l.clientHeight < 40; l.innerHTML = html; if (end) l.scrollTop = l.scrollHeight; }
    const lm = msgs[msgs.length - 1]; bub.querySelector('small').textContent = lm ? `${lm.name}: ${lm.body}` : 'Talk to everyone playing';
    const b = btn.querySelector('b'); b.textContent = unread > 9 ? '9+' : unread; b.classList.toggle('on', unread > 0);
  };
  const poll = async () => {
    let r = null;
    try { r = v2 ? await rpc('chat_list2', { p_after: last, p_me: progress.P.id }) : await rpc('chat_list', { p_after: last }); }
    catch (e) { if (v2 && /chat_list2|404|PGRST202/.test(String(e && (e.message || e.status)))) { v2 = false; return poll(); } return; }
    if (Array.isArray(r) && r.length) {
      if (last && !mini.classList.contains('on') && !modal.classList.contains('on')) unread += r.filter((m) => !m.mine).length;
      msgs = msgs.concat(r.map((m) => ({ ...m, mine: m.mine === true || m.me === progress.P.id }))).slice(-150); last = r[r.length - 1].id; render();
    }
  };
  for (const f of document.querySelectorAll('.chatBox form')) {
    const inp = f.querySelector('input');
    // typing in chat never drives the car / plane
    for (const ev of ['keydown', 'keyup', 'keypress']) inp.addEventListener(ev, (e) => { e.stopPropagation(); if (e.key === 'Escape' && ev === 'keydown') inp.blur(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const t = inp.value.trim(); if (!t || sending) return; sending = true;
      try { const r = await rpc('chat_send', { p_player: progress.P.id, p_name: progress.P.name, p_body: t }); if (r && r.ok) { inp.value = ''; await poll(); } else inp.placeholder = r && r.reason === 'slow down' ? 'Slow down a little…' : 'Could not send'; }
      catch { inp.placeholder = 'Chat is offline right now'; }
      sending = false;
    });
  }
  // tap a name: add them as a friend, or open your messages with them if you're friends already
  document.addEventListener('click', (e) => {
    const n = e.target.closest('.chatBox .ch-m:not(.mine) b[data-n]'); if (!n) return;
    const name = n.dataset.n, fr = (friendsState.friends || []).some((f) => f.name.toLowerCase() === name.toLowerCase());
    openFriends(progress, fr ? '' : name, fr ? name : null);
  });
  for (const el of [modal, mini]) el.querySelector('.ch-f').onclick = () => openFriends(progress);
  const openMini = (on) => { mini.classList.toggle('on', on); if (on) { unread = 0; render(); const l = mini.querySelector('.ch-l'); l.scrollTop = l.scrollHeight; } };
  bub.addEventListener('click', (e) => { e.stopPropagation(); modal.classList.add('on'); unread = 0; render(); poll(); setTimeout(() => modal.querySelector('input').focus(), 50); });
  modal.querySelector('.ch-x').onclick = () => modal.classList.remove('on');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('on'); });
  mini.querySelector('.ch-x').onclick = () => openMini(false);
  btn.addEventListener('click', () => openMini(!mini.classList.contains('on')));
  for (const el of [btn, mini, modal]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  // in game only, and never while riding / flying / in a mini-game
  setInterval(() => {
    const cs = getComputedStyle(menu), inGame = cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1;
    const show = inGame && !busy();
    btn.classList.toggle('on', show); if (!show && mini.classList.contains('on')) openMini(false);
  }, 400);
  render(); poll(); setInterval(poll, 3000);
}
