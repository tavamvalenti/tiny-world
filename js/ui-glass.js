// The game's panels in one look: Apple's San Francisco type, a touch of liquid glass (frosted, see-through, a bright
// top edge), capsule tabs with icons, vivid buttons that respond to the pointer. Loaded after each panel's own styles
// so it restyles them all: the profile panel (and its shop and wallet), settings, the mini-game cards and results.
export const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Inter, system-ui, sans-serif";

// small line icons in the spirit of SF Symbols (24 x 24, drawn with currentColor)
const P = {
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  stopwatch: '<circle cx="12" cy="13" r="7.5"/><path d="M12 13V9M10 2.5h4M18.5 6.5l1.3-1.3"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10 4 6.5 5 8 7.5c.8 1.2 4 1 4 1zM12 8.5c2-4.5 5.5-3.5 4-1-.8 1.2-4 1-4 1z"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9a4 4 0 010 6M19 6.5a7.5 7.5 0 010 11"/>',
  gamepad: '<path d="M6.5 8h11a4 4 0 013.9 4.8l-.9 4.4a2 2 0 01-3.5.9L15 16H9l-2 2.1a2 2 0 01-3.5-.9l-.9-4.4A4 4 0 016.5 8z"/><path d="M8 11v3M6.5 12.5h3M15.5 11.5h.01M17.5 13.5h.01"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  car: '<path d="M3 15l2-5c.5-1.2 1.5-2 3-2h8c1.5 0 2.5.8 3 2l2 5v3H3z"/><circle cx="7.5" cy="18" r="1.6"/><circle cx="16.5" cy="18" r="1.6"/>',
  flame: '<path d="M12 22c-4 0-7-3-7-7 0-4 4-6 4-10 3 2 5 5 5 8 1-1 2-3 2-4 2 2 3 4 3 6 0 4-3 7-7 7z"/>',
  snow: '<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  drone: '<path d="M4 7h6M14 7h6M7 7l3 5h4l3-5"/><rect x="9" y="11" width="6" height="4" rx="1"/><path d="M12 15v4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  jet: '<rect x="6" y="5" width="4" height="12" rx="2"/><rect x="14" y="5" width="4" height="12" rx="2"/><path d="M8 17l-1 4M16 17l1 4M10 9h4"/>',
  balloon: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>',
  badge: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 13h3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const icon = (k, s = 16, w = 1.8) => `<svg class="gi" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || ''}</svg>`;

// each tab its own colour (Apple's system colours)
export const TAB_STYLE = {
  profile: ['person', '#0a84ff'], shop: ['bag', '#30d158'], wallet: ['cash', '#34c759'], ach: ['trophy', '#ff9f0a'], chal: ['flag', '#ff375f'],
  rec: ['stopwatch', '#bf5af2'], rew: ['gift', '#5e5ce6'], lb: ['crown', '#64d2ff'],
};

const CSS = `
/* ---------- shared glass ---------- */
#progPanel,#settings,#actCard,#actRes{font-family:${SF};-webkit-font-smoothing:antialiased}
#progPanel,#settings,#actCard{background:rgba(4,6,10,.38)!important;backdrop-filter:blur(4px)!important}
#progPanel .pp,#settings .sp,#actCard .ac-p,#actRes .ac-p{
  background:linear-gradient(180deg,rgba(52,56,68,.66),rgba(24,26,33,.78))!important;backdrop-filter:blur(30px) saturate(180%)!important;-webkit-backdrop-filter:blur(30px) saturate(180%)!important;
  border:1px solid rgba(255,255,255,.14)!important;border-radius:24px!important;
  box-shadow:0 34px 90px -24px rgba(0,0,0,.7),0 0 0 .5px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.2)!important;color:#f5f5f7}
/* headings: SF, sentence weight, no wide tracking */
#progPanel header h2,#settings .sp h2,#actCard .ac-hd h2{font:700 26px ${SF}!important;letter-spacing:-.01em!important}
#progPanel h4,#settings .sp h3,#actCard .ac-b h4{display:flex;align-items:center;gap:7px;font:600 12.5px ${SF}!important;letter-spacing:.02em!important;text-transform:none;color:rgba(235,235,245,.62)!important;margin:20px 0 10px!important}
#progPanel h4 .gi,#settings .sp h3 .gi,#actCard .ac-b h4 .gi{color:var(--hc,#0a84ff)}
#progPanel *,#settings *,#actCard *,#actRes *{font-family:${SF}}
#progPanel header .x,#settings .sp-x{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.1);opacity:1!important;font-size:0!important;cursor:pointer;transition:background .15s,transform .15s;color:#fff}
#progPanel header .x:hover{background:rgba(255,255,255,.2);transform:scale(1.06)}
#progPanel header .x::before{content:'';width:12px;height:12px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M5 5l14 14M19 5L5 19'/%3E%3C/svg%3E") center/contain no-repeat}
/* ---------- capsule tabs with icons ---------- */
#progPanel nav{gap:4px!important;padding:6px!important;margin:0 18px 4px;border:0!important;border-radius:16px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.08)}
#progPanel nav span{display:inline-flex!important;align-items:center;gap:6px;padding:7px 12px!important;border-radius:11px;border:0!important;font:600 12.5px ${SF}!important;letter-spacing:0!important;color:rgba(235,235,245,.7)!important;text-transform:none;cursor:pointer;transition:background .15s,color .15s,transform .15s}
#progPanel nav span .gi{color:var(--tc)}
#progPanel nav span:hover{background:rgba(255,255,255,.1);color:#fff!important;transform:translateY(-1px)}
#progPanel nav span.on{background:var(--tc)!important;color:#fff!important;box-shadow:0 6px 16px -6px var(--tc),inset 0 1px 0 rgba(255,255,255,.3)}
#progPanel nav span.on .gi{color:#fff}
/* ---------- tiles ---------- */
#progPanel .it{border-radius:16px!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.08)!important;padding:12px 14px!important;transition:transform .15s,background .15s,border-color .15s}
#progPanel .it:hover{background:rgba(255,255,255,.09)!important;transform:translateY(-1px)}
#progPanel .it.done{border-color:rgba(255,159,10,.55)!important;background:linear-gradient(180deg,rgba(255,159,10,.14),rgba(255,159,10,.05))!important}
#progPanel .it.eq{cursor:pointer} #progPanel .it.eq.on{outline:2px solid #0a84ff!important;outline-offset:-1px}
#progPanel .it b{font:600 13.5px ${SF}!important;letter-spacing:0!important} #progPanel .it p{font:400 12px ${SF}!important;color:rgba(235,235,245,.6)!important}
#progPanel .it .pb{height:5px!important;border-radius:3px!important} #progPanel .it .pb i{background:linear-gradient(90deg,#ff9f0a,#ff375f)!important}
#progPanel .note{font:400 12px ${SF}!important;color:rgba(235,235,245,.6)!important}
#progPanel .bal{font:700 36px ${SF}!important;letter-spacing:-.02em;background:linear-gradient(90deg,#30d158,#64d2ff);-webkit-background-clip:text;background-clip:text;color:transparent!important}
#progPanel .shop-it .pr{font:700 15px ${SF}!important;color:#30d158!important}
#progPanel .sw{border-radius:50%!important;width:14px!important;height:14px!important;box-shadow:0 0 0 2px rgba(255,255,255,.12)}
#progPanel table td{font-family:${SF}} #progPanel tr.me td{color:#ff9f0a!important}
/* ---------- buttons: vivid, they lift under the pointer and press in ---------- */
#progPanel button,#settings .sp-foot button,#actCard .ac-mode .go,#actRes .ar-btns button,#progPanel .shop-it button{
  cursor:pointer;font:600 12.5px ${SF}!important;letter-spacing:.01em!important;text-transform:none;border:0!important;border-radius:999px!important;padding:8px 16px!important;color:#fff!important;
  background:linear-gradient(180deg,#2b95ff,#0a6ee6)!important;box-shadow:0 6px 16px -8px rgba(10,132,255,.9),inset 0 1px 0 rgba(255,255,255,.3)!important;transition:transform .12s,filter .15s,box-shadow .15s!important}
#progPanel button:hover,#settings .sp-foot button:hover,#actRes .ar-btns button:hover,#actCard .ac-mode:hover .go{transform:translateY(-2px)!important;filter:brightness(1.12) saturate(1.1)}
#progPanel button:active,#settings .sp-foot button:active,#actRes .ar-btns button:active{transform:scale(.96)!important}
#progPanel button:disabled,#progPanel .shop-it button:disabled,#progPanel .shop-it button[data-buy]:disabled{background:rgba(255,255,255,.1)!important;color:rgba(235,235,245,.62)!important;box-shadow:none!important;cursor:not-allowed;transform:none!important;filter:none;animation:none}
#progPanel .shop-it button[data-eq]:disabled{background:rgba(94,92,230,.22)!important;color:#c8c6ff!important}
#progPanel .shop-it button[data-buy]{background:linear-gradient(180deg,#3ee06a,#25b34a)!important;box-shadow:0 6px 16px -8px rgba(48,209,88,.9),inset 0 1px 0 rgba(255,255,255,.35)!important}
#progPanel .shop-it button.confirm{background:linear-gradient(180deg,#ffb340,#ff8a00)!important;box-shadow:0 6px 18px -6px rgba(255,159,10,.95)!important;animation:gConfirm 1s ease-in-out infinite}
@keyframes gConfirm{50%{filter:brightness(1.15)}}
#progPanel .shop-it button[data-eq]{background:linear-gradient(180deg,#8e8cff,#5e5ce6)!important;box-shadow:0 6px 16px -8px rgba(94,92,230,.9)!important}
#progPanel button[data-a="retry"],#progPanel button[data-a="close"]{background:rgba(255,255,255,.12)!important;box-shadow:none!important}
#settings .sp-foot button.primary,#actRes .ar-btns button.pri{background:linear-gradient(180deg,#ffb340,#ff8a00)!important;box-shadow:0 8px 20px -8px rgba(255,159,10,.95),inset 0 1px 0 rgba(255,255,255,.35)!important;color:#fff!important}
#settings .sp-foot button:not(.primary),#actRes .ar-btns button:not(.pri){background:rgba(255,255,255,.12)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)!important}
#progPanel select,#progPanel input{font:500 13px ${SF}!important;border-radius:10px!important;background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.14)!important;padding:8px 10px!important;color:#fff!important;cursor:pointer}
#progPanel input{cursor:text}
#progPanel select:hover,#progPanel input:hover{border-color:rgba(10,132,255,.7)!important}
/* ---------- settings ---------- */
#settings .sp{width:min(540px,100%)!important}
#settings .sp h2{padding:22px 24px 10px!important}
#settings .sp-row{font:500 14px ${SF}!important;border-bottom:1px solid rgba(255,255,255,.07)!important;padding:11px 4px!important;border-radius:10px;transition:background .12s}
#settings .sp-row:hover{background:rgba(255,255,255,.05)}
#settings .sp-name small{font:400 12px ${SF}!important;color:rgba(235,235,245,.55)!important}
#settings .sp-val{font:500 13px ${SF}!important;color:rgba(235,235,245,.7)!important}
#settings .sp-row input[type=range]{accent-color:#0a84ff;cursor:pointer}
#settings .sp-row select{border-radius:10px!important;background:rgba(255,255,255,.1)!important;border:1px solid rgba(255,255,255,.14)!important;font:500 13px ${SF}!important;padding:7px 10px!important;cursor:pointer;color:#fff!important}
#settings .sp-switch{width:44px!important;height:26px!important;border-radius:13px!important;background:rgba(120,120,128,.36)!important;cursor:pointer}
#settings .sp-switch::after{top:3px!important;left:3px!important;width:20px!important;height:20px!important;box-shadow:0 2px 4px rgba(0,0,0,.3)}
#settings .sp-row input:checked + .sp-switch{background:#30d158!important}
#settings .sp-row input:checked + .sp-switch::after{left:21px!important}
#settings .sp-foot{border-top:1px solid rgba(255,255,255,.08)!important}
/* ---------- mini-game cards and results ---------- */
#actCard .ac-hd p,#actCard .ac-mode p,#actCard .ac-note{font-family:${SF}!important;font-size:12.5px!important}
#actCard .ac-mode{border-radius:18px!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.1)!important;cursor:pointer}
#actCard .ac-mode:hover{background:rgba(48,209,88,.12)!important;border-color:rgba(48,209,88,.6)!important}
#actCard .ac-mode b{font:700 13px ${SF}!important;letter-spacing:.02em!important}
#actCard .ac-mode .go{display:inline-block;background:linear-gradient(180deg,#3ee06a,#25b34a)!important;box-shadow:0 6px 16px -8px rgba(48,209,88,.9)!important}
#actCard .ac-hd .x{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.1);font-size:18px!important;cursor:pointer;transition:background .15s}
#actCard .ac-hd .x:hover{background:rgba(255,255,255,.2)}
#actCard .ac-keys .key,#actHud .key{border-radius:6px!important;font-family:${SF}!important}
#actRes .ar-big{font:800 44px ${SF}!important;letter-spacing:-.02em!important}
#actRes .ar-sub{font:600 11.5px ${SF}!important;letter-spacing:.08em!important}
#actRes .ar-grid{font:500 13px ${SF}!important}
#actRes .ar-btns button{padding:12px 16px!important;font-size:13px!important}
/* ---------- the chips on the map ---------- */
#progChip,#cashChip,.pt{font-family:${SF}!important}
#progChip,#cashChip{backdrop-filter:blur(16px) saturate(170%)!important;box-shadow:0 8px 22px -10px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.16)!important}
`;
export function installGlassUI() {
  // (again) at the end of the page's styles, so it comes after each panel's own
  let st = document.getElementById('glassCss');
  if (!st) { st = document.createElement('style'); st.id = 'glassCss'; st.textContent = CSS; }
  document.head.appendChild(st);
}
