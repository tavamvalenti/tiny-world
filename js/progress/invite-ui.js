// The INVITE FRIENDS panel (from the menu, or from the profile): the two rewards with their progress, your link, Copy
// invite (message + link) / Share, and the message itself, editable (your link is put in for you).
import { SF, icon } from '../ui-glass.js';
import { REWARDS, DEFAULT_MSG } from './referral.js';

export const CSS = `
#invitePanel{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(4,6,12,.55);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);font-family:${SF};color:#f5f5f7}
#invitePanel.open{display:flex;animation:ivFade .25s ease-out}
@keyframes ivFade{from{opacity:0}to{opacity:1}}
#invitePanel .iv{position:relative;width:min(600px,100%);max-height:calc(100% - 8px);overflow:auto;padding:24px 22px 20px;border-radius:26px;
  background:linear-gradient(180deg,rgba(52,46,72,.8),rgba(20,18,30,.92));border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);
  box-shadow:0 34px 90px -24px rgba(0,0,0,.75),0 0 70px -24px rgba(255,159,10,.45),inset 0 1px 0 rgba(255,255,255,.22);animation:ivIn .45s cubic-bezier(.2,1.25,.35,1)}
@keyframes ivIn{from{opacity:0;transform:scale(.92) translateY(14px)}to{opacity:1;transform:none}}
#invitePanel .x{position:absolute;right:16px;top:16px;width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;font-size:17px;cursor:pointer}
#invitePanel .x:hover{background:rgba(255,255,255,.22)}
#invitePanel button.x{display:grid;place-items:center;padding:0;font-size:0;box-shadow:none;transform:none;filter:none} #invitePanel button.x::before{content:'';width:12px;height:12px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 5l14 14M19 5L5 19'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 5l14 14M19 5L5 19'/%3E%3C/svg%3E") center/contain no-repeat}
#invitePanel h2{margin:0;font:700 26px ${SF};letter-spacing:-.01em}
#invitePanel .lede{margin:6px 0 16px;font:500 13.5px ${SF};color:rgba(235,235,245,.7)}
#invitePanel .lede b{color:#30d158}
#invitePanel .rw{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:540px){#invitePanel .rw{grid-template-columns:1fr}}
#invitePanel .card{padding:14px 15px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:7px}
#invitePanel .card.done{border-color:rgba(48,209,88,.5);background:linear-gradient(180deg,rgba(48,209,88,.14),rgba(48,209,88,.04))}
#invitePanel .card .top{display:flex;align-items:center;gap:8px;font:600 14px ${SF}}
#invitePanel .card .top .gi{color:#ff9f0a}
#invitePanel .card .amt{font:800 30px ${SF};letter-spacing:-.02em;background:linear-gradient(90deg,#30d158,#64d2ff);-webkit-background-clip:text;background-clip:text;color:transparent}
#invitePanel .card p{margin:0;font:400 12px/1.45 ${SF};color:rgba(235,235,245,.62)}
#invitePanel .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden} #invitePanel .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff9f0a,#30d158);transition:width .6s}
#invitePanel .prog{font:600 12.5px ${SF};color:#fff}
#invitePanel button{cursor:pointer;border:0;border-radius:999px;padding:10px 16px;font:600 13px ${SF};color:#fff;background:linear-gradient(180deg,#2b95ff,#0a6ee6);box-shadow:0 6px 16px -8px rgba(10,132,255,.9),inset 0 1px 0 rgba(255,255,255,.3);transition:transform .12s,filter .15s}
#invitePanel button:hover{transform:translateY(-2px);filter:brightness(1.12)} #invitePanel button:active{transform:scale(.96)}
#invitePanel button.collect{background:linear-gradient(180deg,#3ee06a,#25b34a);box-shadow:0 6px 18px -6px rgba(48,209,88,.95)}
#invitePanel button.ghost{background:rgba(255,255,255,.12);box-shadow:none}
#invitePanel button:disabled{background:rgba(255,255,255,.1);color:rgba(235,235,245,.5);box-shadow:none;cursor:default;transform:none}
#invitePanel .state{font:700 12.5px ${SF};color:#30d158}
#invitePanel h4{display:flex;align-items:center;gap:7px;margin:18px 0 8px;font:600 12.5px ${SF};color:rgba(235,235,245,.62)}
#invitePanel .link{display:flex;gap:8px;align-items:center;padding:6px 6px 6px 14px;border-radius:14px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12)}
#invitePanel .link code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 14px ui-monospace,'SF Mono',Menlo,monospace;color:#fff}
#invitePanel .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#invitePanel .acts button{flex:1 1 150px}
#invitePanel textarea{width:100%;box-sizing:border-box;min-height:92px;resize:vertical;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#fff;font:500 13.5px/1.5 ${SF}}
#invitePanel .note{margin:10px 0 0;font:500 12px/1.5 ${SF};color:rgba(235,235,245,.55)}
#invitePanel .msg{min-height:18px;margin-top:10px;font:600 13px ${SF};color:#30d158}
#invitePanel .msg.bad{color:#ff9f0a}
`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let panel = null;
export function openInvite(progress) {
  if (!document.getElementById('ivCss')) { const st = document.createElement('style'); st.id = 'ivCss'; st.textContent = CSS; document.head.appendChild(st); }
  if (!panel) {
    panel = document.createElement('div'); panel.id = 'invitePanel'; document.body.appendChild(panel);
    panel.addEventListener('click', (e) => { if (e.target === panel || e.target.closest('.x')) panel.classList.remove('open'); });
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('keydown', (e) => e.stopPropagation());
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && panel.classList.contains('open')) { panel.classList.remove('open'); e.stopPropagation(); } }, true);
  }
  const R = progress.referral, A = progress.account;
  const state = { code: progress.P.refCode || null, st: null };
  const say = (t, bad = false) => { const m = panel.querySelector('.msg'); if (m) { m.textContent = t; m.classList.toggle('bad', bad); clearTimeout(m._t); m._t = setTimeout(() => { m.textContent = ''; }, 3500); } };
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); say(`${what} copied.`); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); say(`${what} copied.`); } catch { say('Couldn\'t copy: select it and copy it yourself.', true); } ta.remove(); } };
  const render = () => {
    const s = state.st || { joined: 0, qualified: 0, claimed: {} }, q = Number(s.qualified) || 0, j = Number(s.joined) || 0, claimed = s.claimed || {};
    const card = (kind, ic, title, desc) => {
      const R2 = REWARDS[kind], done = !!claimed[kind], ready = !done && q >= R2.need;
      const prog = kind === 'five' ? `<div class="bar"><i style="width:${Math.min(100, (q / 5) * 100)}%"></i></div><span class="prog">${Math.min(q, 5)} / 5 friends joined</span>` : `<span class="prog">${q >= 1 ? 'Your first friend has joined' : 'Waiting for your first friend'}</span>`;
      return `<div class="card ${done ? 'done' : ''}"><div class="top">${icon(ic, 18)}${title}</div><div class="amt">$${R2.amount.toLocaleString()}</div><p>${desc}</p>${prog}
        ${done ? '<span class="state">✓ Collected</span>' : `<button class="collect" data-claim="${kind}" ${ready ? '' : 'disabled'}>${ready ? `Collect $${R2.amount.toLocaleString()}` : 'Not yet'}</button>`}</div>`;
    };
    const link = state.code ? R.link(state.code) : '';
    panel.innerHTML = `<div class="iv"><button class="x" aria-label="Close">×</button>
      <h2>Invite friends</h2><p class="lede">Share your link. When friends join and play, you earn up to <b>$13,000 Cash</b>.</p>
      <div class="rw">${card('share', 'gift', 'Share Tiny World', 'Paid when your first friend joins with your link: they create an account and play to 300 XP.')}${card('five', 'person', 'Invite 5 friends', 'Five different friends join with your link, each with a new account that reaches 300 XP.')}</div>
      <p class="note">${j ? `${j} friend${j > 1 ? 's have' : ' has'} joined with your link${j > q ? ` · ${j - q} still getting to 300 XP` : ''}. ` : ''}${A && A.signedIn ? 'Rewards go into your wallet when you collect them.' : 'Your friends count from now on, but rewards are paid to an account: create one in Profile to collect them.'}</p>
      <h4>${icon('tag', 15)} Your link</h4>
      <div class="link"><code>${link ? esc(link) : 'Getting your link…'}</code><button data-a="copy-link" ${link ? '' : 'disabled'}>Copy invite</button></div>
      <div class="acts"><button data-a="share" ${link ? '' : 'disabled'}>${navigator.share ? 'Share…' : 'Share (copies the invite)'}</button></div>
      <h4>${icon('card', 15)} Your invite message</h4>
      <textarea id="ivMsg" maxlength="600">${esc(link ? R.message(state.code) : R.template())}</textarea>
      <div class="acts" style="margin-top:6px"><button class="ghost" data-a="reset-msg">Reset message</button></div>
      <p class="note">Only brand-new accounts count, each friend once, and not on your own internet connection. Sharing on its own doesn't pay: a friend has to join and play.</p>
      <div class="msg"></div></div>`;
  };
  // the message, with your link put back if you took it out
  const currentMsg = () => { const t = (panel.querySelector('#ivMsg') || {}).value || ''; const link = R.link(state.code); return t.includes(link) ? t : `${t.trim()} ${link}`; };
  const saveMsg = () => { const ta = panel.querySelector('#ivMsg'); if (ta && state.code) R.saveTemplate(ta.value.split(R.link(state.code)).join('{link}')); };
  panel.onclick = null;
  panel.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.claim) {
      b.disabled = true; b.textContent = 'Collecting…';
      const r = await R.claim(b.dataset.claim);
      if (r.ok) { say(`+$${r.amount.toLocaleString()} paid into your wallet.`); state.st = await R.status() || state.st; render(); }
      else { say(r.reason === 'account' ? 'Create an account in Profile first: rewards are paid to an account.' : r.reason === 'already' ? 'Already collected.' : r.reason === 'not yet' ? 'Not yet: your friends need to join and reach 300 XP.' : 'Couldn\'t reach the server. Try again.', true); state.st = await R.status() || state.st; render(); }
      return;
    }
    const a = b.dataset.a;
    if (a === 'copy-link') { saveMsg(); copy(currentMsg(), 'Invite with your link'); }
    if (a === 'reset-msg') { R.saveTemplate(DEFAULT_MSG); const ta = panel.querySelector('#ivMsg'); if (ta) ta.value = R.message(state.code, DEFAULT_MSG); say('Message reset.'); }
    if (a === 'share') {
      saveMsg(); const text = currentMsg();
      if (navigator.share) { try { await navigator.share({ title: 'Tiny World', text }); say('Shared. You\'ll earn when a friend joins and plays.'); } catch (err) { if (err && err.name !== 'AbortError') copy(text, 'Invite message'); } }
      else copy(text, 'Invite message');
    }
  };
  panel.addEventListener('input', (e) => { if (e.target.id === 'ivMsg') saveMsg(); });
  render(); panel.classList.add('open');
  // fill in the link and the progress
  (async () => {
    state.code = await R.code(); state.st = await R.status(); if (!panel.classList.contains('open')) return;
    if (!state.code) { render(); const m = panel.querySelector('.msg'); if (m) { m.textContent = R.available ? 'Couldn\'t reach the server for your link. Try again in a moment.' : 'Invites need the online service, which isn\'t available here.'; m.classList.add('bad'); } return; }
    render();
  })();
}
