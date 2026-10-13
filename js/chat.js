// WORLD CHAT (prototype): one public room for everyone playing. The big room opens from the menu bubble; in game a
// small window (bottom left) shows the latest lines and expands to type. "Live" = the newest messages every 3 seconds.
// Server: server/chat.sql (chat_send / chat_list).
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `
#chatModal{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(6px)}
#chatModal.on{display:flex}
.chatBox{display:flex;flex-direction:column;background:rgba(22,24,30,.82);border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 20px 50px -20px rgba(0,0,0,.8);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:#fff;font:14px -apple-system,'SF Pro Text',Inter,sans-serif;overflow:hidden}
#chatModal .chatBox{width:min(640px,92vw);height:min(620px,82vh)}
.chatBox .ch-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.1);font:800 11px Inter;letter-spacing:.2em}
.chatBox .ch-h span{flex:1} .chatBox .ch-h button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}
.chatBox .ch-l{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:6px}
.chatBox .ch-m b{color:#64d2ff;margin-right:6px} .chatBox .ch-m.mine b{color:#ffb340} .chatBox .ch-m i{color:rgba(255,255,255,.4);font-style:normal;font-size:11px;margin-left:6px}
.chatBox .ch-e{color:rgba(255,255,255,.45);text-align:center;margin:auto}
.chatBox form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.1)}
.chatBox input{flex:1;min-width:0;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:9px 11px;color:#fff;font:14px -apple-system,Inter,sans-serif;outline:none}
.chatBox form button{background:linear-gradient(180deg,#0a84ff,#0060df);border:0;border-radius:10px;color:#fff;font:700 13px Inter;padding:0 14px;cursor:pointer}
#chatMini{position:fixed;left:14px;bottom:14px;z-index:40;display:none}
#chatMini.on{display:block}
#chatMini .chatBox{width:300px;height:230px}
#chatMini.small .chatBox{height:auto;width:260px} #chatMini.small form{display:none}
#chatMini.small .ch-l{max-height:66px;overflow:hidden;opacity:.85}
#menuChat{position:absolute;right:var(--pad);z-index:7;width:210px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;color:var(--fg);background:var(--panel);border:1px solid rgba(100,210,255,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:-apple-system,Inter,sans-serif;transition:transform .25s}
#menuChat:hover{transform:translateY(-2px)} #menuChat b{display:block;font:800 10px Inter;letter-spacing:.2em} #menuChat small{display:block;margin-top:3px;font:600 11.5px -apple-system,Inter,sans-serif;color:#64d2ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
#menu.diving #menuChat{opacity:0;pointer-events:none}
@media (max-width:520px){#menuChat{left:var(--pad);right:auto;bottom:90px;top:auto!important} #chatMini .chatBox{width:240px}}`;

export function setupChat(progress, { menu, below }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  let msgs = [], last = 0, sending = false;
  const rpc = (fn, body) => progress.lb.provider ? progress.lb.provider.rpc(fn, body) : Promise.reject(new Error('offline'));
  const box = (title, close) => `<div class="chatBox"><div class="ch-h">💬 <span>${title}</span><button type="button" class="ch-x">${close}</button></div>
    <div class="ch-l"></div><form><input maxlength="200" placeholder="Say something to everyone…" autocomplete="off"><button>Send</button></form></div>`;
  const modal = document.createElement('div'); modal.id = 'chatModal'; modal.innerHTML = box('WORLD CHAT', '✕');
  const mini = document.createElement('div'); mini.id = 'chatMini'; mini.className = 'small'; mini.innerHTML = box('WORLD CHAT', '⤢');
  document.body.append(modal, mini);
  const bub = document.createElement('div'); bub.id = 'menuChat'; bub.innerHTML = '<span style="font-size:20px">💬</span><div><b>WORLD CHAT</b><small>Talk to everyone playing</small></div>';
  menu.appendChild(bub);
  const place = () => { const a = below(); if (a) bub.style.top = `${a.offsetTop + a.offsetHeight + 10}px`; };
  setInterval(place, 1000); setTimeout(place, 0);

  const render = () => {
    const me = progress.P.id;
    const html = msgs.length ? msgs.map((m) => `<div class="ch-m ${m.me === me ? 'mine' : ''}"><b>${esc(m.name)}</b>${esc(m.body)}<i>${new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</i></div>`).join('')
      : `<div class="ch-e">${progress.lb.provider ? 'No messages yet. Say hi!' : 'Chat is offline right now.'}</div>`;
    for (const l of document.querySelectorAll('.chatBox .ch-l')) { const end = l.scrollHeight - l.scrollTop - l.clientHeight < 40; l.innerHTML = html; if (end || l.closest('.small')) l.scrollTop = l.scrollHeight; }
    const lm = msgs[msgs.length - 1]; bub.querySelector('small').textContent = lm ? `${lm.name}: ${lm.body}` : 'Talk to everyone playing';
  };
  const poll = async () => {
    try { const r = await rpc('chat_list', { p_after: last }); if (Array.isArray(r) && r.length) { msgs = msgs.concat(r).slice(-150); last = r[r.length - 1].id; render(); } } catch { /* offline */ }
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
  bub.addEventListener('click', (e) => { e.stopPropagation(); modal.classList.add('on'); render(); poll(); setTimeout(() => modal.querySelector('input').focus(), 50); });
  modal.querySelector('.ch-x').onclick = () => modal.classList.remove('on');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('on'); });
  mini.querySelector('.ch-x').onclick = () => { mini.classList.toggle('small'); render(); if (!mini.classList.contains('small')) mini.querySelector('input').focus(); };
  mini.querySelector('.ch-l').onclick = () => { if (mini.classList.contains('small')) mini.querySelector('.ch-x').onclick(); };
  // the small window shows only in game (menu hidden)
  setInterval(() => { const cs = getComputedStyle(menu), inGame = cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1 || menu.classList.contains('hidden'); mini.classList.toggle('on', inGame); }, 700);
  render(); poll(); setInterval(poll, 3000);
}
