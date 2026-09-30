// A subtle local news ticker styled like a TV lower third: one short headline at a time, now and then, written
// from templates about things that actually happened in the world (events raised through world.js, venue
// schedules, weather, sightings). Breaking stories jump the queue; everyday items only fill long quiet spells.
// La Playa's channel is in Spanish (only the banner: menus and settings stay English).
import { G, pick } from './core.js';
import { settings } from './settings.js';

const SHOW = 6;                                     // seconds a headline stays up
const GAP = { 2: 2.5, 1: 18 };                      // minimum quiet before a breaking / an everyday item

// channel look per tag: [tag colour, tag text colour]
const TAGS = {
  BREAKING: ['#d7141c', '#fff'], 'TRAFFIC ALERT': ['#f28a0f', '#fff'], WEATHER: ['#0f8fb8', '#fff'], UPDATE: ['#f4c20d', '#10183a'],
  LOCAL: ['#f4c20d', '#10183a'], FESTIVAL: ['#8a2be2', '#fff'], SPORTS: ['#1f9d55', '#fff'],
};
const ES_TAG = { BREAKING: 'ÚLTIMA HORA', 'TRAFFIC ALERT': 'ALERTA VIAL', WEATHER: 'CLIMA', UPDATE: 'ACTUALIZACIÓN', LOCAL: 'LOCAL', FESTIVAL: 'FESTIVAL', SPORTS: 'DEPORTES' };
const CHANNEL = { downtown: ['SAN DIEGO', 'LIVE', 'CHANNEL 7 NEWS'], suburbs: ['CHICAGO', 'LIVE', 'CHANNEL 7 NEWS'], tropical: ['LA PLAYA', 'EN VIVO', 'NOTICIAS 7'] };

// headline templates, English and Spanish ({w} = where)
const T_EN = {
  FIRE: ['Firefighters responding to a structure fire {w}', 'Crews called to a building fire {w}', 'Smoke reported {w}; fire units en route'],
  TRAFFIC_ACCIDENT: ['Collision reported {w}; expect delays', 'Crash {w}; police and paramedics responding'],
  TRAFFIC_JAM: ['Heavy congestion reported {w}', 'Stalled vehicle causing backups {w}'],
  SHOOTING: ['Shots fired {w}; police on scene', 'Police respond to reports of gunfire {w}'],
  GANG_CONFLICT: ['Gunfire between rival crews {w}; officers responding'],
  RIOT: ['Unrest {w}; officers moving in'],
  DISTURBANCE: ['Police called to a disturbance {w}', 'Officers responding to a street fight {w}'],
  EVACUATION: ['Area {w} being evacuated', 'Evacuation under way {w}; avoid the area'],
  INCIDENT: ['Emergency crews responding {w}', 'Police and fire units rushing to a scene {w}'],
};
const T_ES = {
  FIRE: ['Bomberos atienden un incendio {w}', 'Reportan humo {w}; unidades en camino'],
  TRAFFIC_ACCIDENT: ['Choque reportado {w}; se esperan retrasos', 'Accidente vial {w}; policía y paramédicos en camino'],
  TRAFFIC_JAM: ['Tráfico intenso {w}', 'Vehículo averiado provoca filas {w}'],
  SHOOTING: ['Reportan disparos {w}; policía en el lugar', 'Policía atiende reporte de balazos {w}'],
  GANG_CONFLICT: ['Enfrentamiento armado {w}; agentes en camino'],
  RIOT: ['Disturbios {w}; policía interviene'],
  DISTURBANCE: ['Policía atiende una riña {w}', 'Reportan pelea callejera {w}'],
  EVACUATION: ['Evacúan la zona {w}', 'Evacuación en curso {w}; eviten el área'],
  INCIDENT: ['Servicios de emergencia atienden un reporte {w}', 'Policía y bomberos se dirigen {w}'],
};
// the player's destruction: explosions by weapon, collapses, the damage adding up
const B_EN = {
  explosion: ['Explosion {w}', 'Massive blast reported {w}', 'Witnesses report a huge explosion {w}'],
  meteor: ['Meteor strike {w}!', 'Object falls from the sky {w}; heavy damage', 'Impact crater reported {w}'],
  wind: ['Violent winds reported {w}', 'Freak windstorm {w}'],
  energy: ['Mysterious energy blast {w}', 'Unexplained energy surge {w}'],
  laser: ['Beam of light sets buildings ablaze {w}', 'Mysterious beam causes fires {w}'],
  collapse: ['Building collapses {w}', 'Part of a building comes down {w}', 'Structure collapse reported {w}'],
  damage: ['Damage mounting {w}: {n} building sections destroyed', 'Officials survey the destruction {w}: {n} sections down'],
};
const B_ES = {
  explosion: ['Fuerte explosión {w}', 'Reportan una gran explosión {w}'],
  meteor: ['¡Cae un meteorito {w}!', 'Objeto cae del cielo {w}; graves daños'],
  wind: ['Vientos violentos {w}', 'Ventarrón inesperado {w}'],
  energy: ['Misteriosa descarga de energía {w}', 'Extraño estallido de energía {w}'],
  laser: ['Rayo de luz incendia edificios {w}', 'Misterioso rayo causa incendios {w}'],
  collapse: ['Se derrumba un edificio {w}', 'Derrumbe reportado {w}'],
  damage: ['Aumentan los daños {w}: {n} secciones destruidas', 'Autoridades evalúan la destrucción {w}: {n} secciones'],
};
const R_EN = {
  FIRE: 'Fire {w} is out; crews clearing the scene', TRAFFIC_ACCIDENT: 'Road reopened {w} after earlier crash', SHOOTING: 'Police have secured the area {w}',
  GANG_CONFLICT: 'Police have secured the area after the earlier gunfire', RIOT: 'Calm returning {w}', DISTURBANCE: 'Disturbance {w} broken up; no injuries reported',
  EVACUATION: 'Residents allowed back {w}', TRAFFIC_JAM: 'Traffic moving again {w}',
};
const R_ES = {
  FIRE: 'Controlado el incendio {w}', TRAFFIC_ACCIDENT: 'Reabren la vialidad {w} tras el choque', SHOOTING: 'La policía asegura la zona {w}',
  GANG_CONFLICT: 'La policía asegura la zona tras los disparos', RIOT: 'Vuelve la calma {w}', DISTURBANCE: 'Controlada la riña {w}; sin heridos',
  EVACUATION: 'Vecinos regresan {w}', TRAFFIC_JAM: 'Se normaliza el tráfico {w}',
};
const W_EN = { rain: 'Rain moving into {c}', storm: 'Storm approaching {c}; lightning possible', snow: 'Snow falling across Chicago; roads slick', clear: 'Skies clearing over {c}' };
const W_ES = { rain: 'Lluvias llegan a La Playa', storm: 'Tormenta se acerca a La Playa; posibles rayos', clear: 'Cielos despejados en La Playa' };
const CITY = { downtown: 'San Diego', suburbs: 'Chicago', tropical: 'La Playa' };

const CSS = `
#newsTicker{position:fixed;left:50%;bottom:96px;width:clamp(320px,calc(100vw - 540px),600px);z-index:6;pointer-events:none;font-family:Inter,system-ui,sans-serif;
  opacity:0;transform:translate(-50%,12px);transition:opacity .4s ease,transform .5s cubic-bezier(.2,.8,.2,1);
  background:rgba(12,14,19,.72);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);overflow:hidden}
#newsTicker.on{opacity:1;transform:translate(-50%,0)}
#newsTicker .top{display:flex;align-items:center;gap:12px;padding:11px 16px 4px}
#newsTicker .tag{flex:none;display:inline-flex;align-items:center;gap:7px;padding:4px 9px 4px 8px;border-radius:6px;background:var(--tagbg);color:var(--tagfg);
  font:800 10px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
#newsTicker .tag:before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;animation:newsPulse 1.2s ease-in-out infinite}
@keyframes newsPulse{0%,100%{opacity:1}50%{opacity:.25}}
#newsTicker .head{flex:1;min-width:0;color:#f5f6f8;font:600 14.5px/1.3 Inter,system-ui,sans-serif;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#newsTicker .meta{display:flex;align-items:center;gap:8px;padding:2px 16px 10px;color:rgba(235,238,245,.5);font:500 10.5px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
#newsTicker .live{display:inline-flex;align-items:center;gap:5px;color:#ff4d4d;font-weight:700}
#newsTicker .live:before{content:'';width:5px;height:5px;border-radius:50%;background:#ff4d4d}
#newsTicker .bar{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--accent);transform-origin:left;opacity:.85}
@media (max-width:760px){#newsTicker{width:calc(100vw - 32px)}#newsTicker .head{font-size:13px}}
html.touch #newsTicker{top:calc(env(safe-area-inset-top,0px) + 64px);bottom:auto;left:10px;right:10px;width:auto;transform:translateY(-10px);border-radius:14px}
html.touch #newsTicker.on{transform:none}
html.touch #newsTicker .top{padding:10px 14px 3px}html.touch #newsTicker .meta{padding:2px 14px 9px}
html.touch #newsTicker .head{white-space:normal;font-size:13px;line-height:1.3}
`;

export class News {
  constructor(mapName, city) {
    this.map = mapName; this.city = city;
    this.queue = []; this.showT = 0; this.quiet = 10; this.last = {}; this.lastDestroyed = 0; this.dmgT = 0;
    if (!document.getElementById('newsCss')) { const st = document.createElement('style'); st.id = 'newsCss'; st.textContent = CSS; document.head.appendChild(st); }
    document.getElementById('newsTicker')?.remove();
    const el = document.createElement('div');
    el.id = 'newsTicker';
    el.innerHTML = '<div class="top"><span class="tag"></span><span class="head"></span></div><div class="meta"><span class="live"></span><span class="where"></span></div><div class="bar"></div>';
    document.body.appendChild(el);
    this.el = el;
    G.news = this;
  }

  get es() { return this.map === 'tropical' && settings.spanish !== false; }
  // "near Petco Park", "on the waterfront", "en la playa"... or just the part of town
  where(x, z) {
    const C = this.city, near = (S, m = 12) => S && x > S.x0 - m && x < S.x1 + m && z > S.z0 - m && z < S.z1 + m;
    if (this.es) {
      if (C.policeHQ && Math.hypot(x - C.policeHQ.x, z - C.policeHQ.z) < 25) return 'frente a la comandancia';
      if (z > 100 && Math.abs(x - 22) < 20) return 'en el mirador del Cristo';
      if (z > 64) return pick(['en los cerros', 'en el barrio del cerro']);
      return z < -14 ? pick(['en la playa', 'en el malecón']) : pick(['en La Playa', 'en el centro']);
    }
    if (near(C.concert, 25)) return 'near Summer Smash';
    if (near(C.court, 10)) return 'by the streetball courts';
    if (near(C.petco, 14)) return 'near Petco Park';
    if (C.policeHQ && Math.hypot(x - C.policeHQ.x, z - C.policeHQ.z) < 25) return 'outside police headquarters';
    if (C.shoreX != null && x < C.shoreX + 12) return 'on the waterfront';
    if (G.gangs && G.gangs.zones) { const Z = G.gangs.zones; if (near(Z.blue, 4)) return 'in Blue Line'; if (near(Z.red, 4)) return 'in Red Row'; }
    if (this.map === 'tropical') return z > 100 && Math.abs(x - 22) < 20 ? 'at the Cristo lookout' : z > 64 ? pick(['up in the hills', 'in the hillside barrio']) : z < -14 ? pick(['on the beachfront', 'on the malecón']) : pick(['in La Playa', 'in the old town']);
    if (this.map === 'downtown') return pick(['downtown', 'in the Gaslamp Quarter']);
    return pick(['on the South Side', 'in Chicago']);
  }
  post(tag, text, prio = 1, key = null) {
    // the same kind of story isn't repeated back to back
    if (key && G.time - (this.last[key] ?? -1e9) < (prio > 1 ? 12 : 120)) return;
    if (key) this.last[key] = G.time;
    // breaking news goes ahead of everyday items; the queue stays short so what's shown is current
    if (prio > 1) { const k = this.queue.findIndex((q) => q.prio <= 1); this.queue.splice(k < 0 ? this.queue.length : k, 0, { tag, text, prio }); this.queue = this.queue.slice(0, 5); }
    else if (this.queue.length < 3) this.queue.push({ tag, text, prio });
  }
  // a world event was raised
  event(ev) {
    const T = ev.type, fill = (s) => s.replace('{w}', this.where(ev.x, ev.z)).replace('{c}', CITY[this.map]);
    let tag, text;
    if (T === 'WEATHER_EVENT') { tag = 'WEATHER'; const t = (this.es ? W_ES : W_EN)[ev.news]; text = t && fill(t); }
    else if (T === 'FESTIVAL_EVENT') { tag = ev.tag || 'FESTIVAL'; text = ev.news; }
    else {
      const t = (this.es ? T_ES : T_EN)[T];
      if (!t) return;
      tag = { TRAFFIC_ACCIDENT: 'TRAFFIC ALERT', TRAFFIC_JAM: 'TRAFFIC ALERT', DISTURBANCE: 'LOCAL' }[T] || 'BREAKING';
      text = fill(pick(t));
    }
    if (!text) return;
    this.post(tag, text, ['WEATHER_EVENT', 'FESTIVAL_EVENT', 'DISTURBANCE', 'TRAFFIC_JAM'].includes(T) ? 1.5 : 2, T);
  }
  // the player's weapons (only the big ones make the news; one story per kind every few seconds)
  onBlast(x, y, z, r, power, kind) {
    if (!B_EN[kind] || kind === 'collapse' || (kind !== 'laser' && power < 5)) return;
    const t = pick((this.es ? B_ES : B_EN)[kind]).replace('{w}', this.where(x, z));
    this.post('BREAKING', t, 2, 'blast-' + kind);
  }
  destruction(x, z, many) {
    if (many < 4) return;
    this.post('BREAKING', pick((this.es ? B_ES : B_EN).collapse).replace('{w}', this.where(x, z)), 2, 'collapse');
  }
  // ...and wrapped up (usually: most scenes get a follow-up)
  resolved(ev) {
    if (Math.random() > 0.75) return;
    const t = (this.es ? R_ES : R_EN)[ev.type];
    if (t) this.post('UPDATE', t.replace('{w}', this.where(ev.x, ev.z)), 1.2, 'up-' + ev.type);
  }
  update(dt) {
    this.quiet += dt;
    // banners switched off in Settings: nothing shows (and nothing piles up for later)
    if (settings.news === false) { if (this.showT > 0 || this.queue.length) { this.showT = 0; this.queue.length = 0; this.el.classList.remove('on'); } return; }
    // the damage adds up: a running tally every so often while things are being destroyed
    if ((this.dmgT -= dt) <= 0) {
      this.dmgT = 20;
      const n = G.buildings ? G.buildings.destroyed : 0;
      if (n - this.lastDestroyed >= 15) { this.lastDestroyed = n; this.post('UPDATE', pick((this.es ? B_ES : B_EN).damage).replace('{w}', this.es ? 'en La Playa' : 'in ' + CITY[this.map]).replace('{n}', n), 1.5, 'damage'); }
    }
    if (this.showT > 0) {
      if ((this.showT -= dt) <= 0) { this.el.classList.remove('on'); this.quiet = 0; }
      return;
    }
    const q = this.queue[0];
    if (!q || this.quiet < GAP[q.prio > 1 ? 2 : 1]) return;
    this.queue.shift();
    const [bg, fg] = TAGS[q.tag] || TAGS.LOCAL, ch = this.map === 'tropical' && !this.es ? ['LA PLAYA', 'LIVE', 'CHANNEL 7 NEWS'] : CHANNEL[this.map] || CHANNEL.downtown;
    const tag = this.el.querySelector('.tag');
    tag.textContent = this.es ? ES_TAG[q.tag] || q.tag : q.tag;
    tag.style.setProperty('--tagbg', bg); tag.style.setProperty('--tagfg', fg);
    this.el.style.setProperty('--accent', bg);
    this.el.querySelector('.head').textContent = q.text;
    this.el.querySelector('.live').textContent = ch[1];
    const d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    this.el.querySelector('.where').textContent = `${ch[2]} · ${ch[0]} · ${hh}:${mm}`;
    // a thin line along the bottom runs down while the story is up
    const bar = this.el.querySelector('.bar');
    bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)'; void bar.offsetWidth;
    bar.style.transition = `transform ${SHOW}s linear`; bar.style.transform = 'scaleX(0)';
    this.el.classList.add('on');
    this.showT = SHOW;
  }
}
