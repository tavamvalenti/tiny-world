// A subtle local news ticker styled like a TV lower third: one short headline at a time, now and then, written
// from templates about things that actually happened in the world (events raised through world.js, venue
// schedules, weather, sightings). Breaking stories jump the queue; everyday items only fill long quiet spells.
// La Playa's channel is in Spanish (only the banner: menus and settings stay English).
import { G, pick } from './core.js';

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
#newsTicker{position:fixed;left:16px;bottom:96px;width:min(560px,calc(100vw - 32px));z-index:6;pointer-events:none;font-family:Inter,system-ui,sans-serif;
  opacity:0;transform:translateX(-24px);transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1)}
#newsTicker.on{opacity:1;transform:none}
#newsTicker .row{display:flex;align-items:stretch;height:34px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35))}
#newsTicker .globe{flex:none;width:40px;height:40px;margin:-3px -12px 0 0;border-radius:50%;z-index:2;align-self:center;
  background:radial-gradient(circle at 35% 30%,#bfe6ff 0,#3d8fe0 32%,#0d3f8f 70%,#071f4d 100%);box-shadow:0 0 0 2px rgba(255,255,255,.85),0 2px 8px rgba(0,0,0,.4);position:relative;overflow:hidden}
#newsTicker .globe:before{content:'';position:absolute;inset:0;border-radius:50%;
  background:repeating-linear-gradient(90deg,transparent 0 8px,rgba(255,255,255,.28) 8px 9px),repeating-linear-gradient(0deg,transparent 0 9px,rgba(255,255,255,.22) 9px 10px)}
#newsTicker .tag{flex:none;display:flex;align-items:center;padding:0 16px 0 20px;background:var(--tagbg);color:var(--tagfg);font-weight:900;font-style:italic;font-size:13px;letter-spacing:.04em;
  clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);position:relative;z-index:1;text-transform:uppercase;white-space:nowrap}
#newsTicker .head{flex:1;min-width:0;display:flex;align-items:center;margin-left:-12px;padding:0 18px 0 22px;color:#fff;font-weight:800;font-size:13px;letter-spacing:.02em;text-transform:uppercase;
  background:linear-gradient(180deg,#2c55d6 0,#1a3aa8 55%,#132d86 100%);clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#newsTicker .sub{display:flex;align-items:center;height:18px;margin:0 12px 0 28px;background:#0d0f14;color:#c9d0de;font-size:10px;font-weight:600;letter-spacing:.06em;overflow:hidden;
  clip-path:polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)}
#newsTicker .live{flex:none;position:relative;z-index:1;height:100%;display:flex;align-items:center;padding:0 8px;background:#f4c20d;color:#10183a;font-weight:900;font-style:italic;font-size:10px;letter-spacing:.08em}
#newsTicker .lane{flex:1;min-width:0;overflow:hidden;height:100%;display:flex;align-items:center}
#newsTicker .crawl{white-space:nowrap;padding-left:10px;animation:newsCrawl 14s linear infinite}
@keyframes newsCrawl{from{transform:translateX(30%)}to{transform:translateX(-100%)}}
@media (max-width:520px){#newsTicker .head{font-size:11px}#newsTicker .tag{font-size:11px;padding:0 12px 0 14px}#newsTicker .globe{display:none}}
`;

export class News {
  constructor(mapName, city) {
    this.map = mapName; this.city = city; this.es = mapName === 'tropical';
    this.queue = []; this.showT = 0; this.quiet = 10; this.last = {}; this.lastDestroyed = 0; this.dmgT = 0;
    if (!document.getElementById('newsCss')) { const st = document.createElement('style'); st.id = 'newsCss'; st.textContent = CSS; document.head.appendChild(st); }
    document.getElementById('newsTicker')?.remove();
    const el = document.createElement('div');
    el.id = 'newsTicker';
    el.innerHTML = '<div class="row"><div class="globe"></div><div class="tag"></div><div class="head"></div></div><div class="sub"><div class="live"></div><div class="lane"><div class="crawl"></div></div></div>';
    document.body.appendChild(el);
    this.el = el;
    G.news = this;
  }

  // "near Petco Park", "on the waterfront", "en la playa"... or just the part of town
  where(x, z) {
    const C = this.city, near = (S, m = 12) => S && x > S.x0 - m && x < S.x1 + m && z > S.z0 - m && z < S.z1 + m;
    if (this.es) {
      if (C.policeHQ && Math.hypot(x - C.policeHQ.x, z - C.policeHQ.z) < 25) return 'frente a la comandancia';
      return z < -14 ? pick(['en la playa', 'en el malecón']) : pick(['en La Playa', 'en el centro']);
    }
    if (near(C.concert, 25)) return 'near Summer Smash';
    if (near(C.court, 10)) return 'by the streetball courts';
    if (near(C.petco, 14)) return 'near Petco Park';
    if (C.policeHQ && Math.hypot(x - C.policeHQ.x, z - C.policeHQ.z) < 25) return 'outside police headquarters';
    if (C.shoreX != null && x < C.shoreX + 12) return 'on the waterfront';
    if (G.gangs && G.gangs.zones) { const Z = G.gangs.zones; if (near(Z.blue, 4)) return 'in Blue Line'; if (near(Z.red, 4)) return 'in Red Row'; }
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
    const [bg, fg] = TAGS[q.tag] || TAGS.LOCAL, ch = CHANNEL[this.map] || CHANNEL.downtown;
    const tag = this.el.querySelector('.tag');
    tag.textContent = this.es ? ES_TAG[q.tag] || q.tag : q.tag === 'BREAKING' ? 'BREAKING NEWS' : q.tag;
    tag.style.setProperty('--tagbg', `linear-gradient(180deg, ${bg}, ${shade(bg)})`); tag.style.setProperty('--tagfg', fg);
    this.el.querySelector('.head').textContent = q.text;
    this.el.querySelector('.live').textContent = ch[1];
    const d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    this.el.querySelector('.crawl').textContent = `${ch[2]}  ·  ${ch[0]}  ·  ${hh}:${mm}  ·  ${q.text}`;
    this.el.classList.add('on');
    this.showT = SHOW;
  }
}
// a darker stop for the tag's gradient
function shade(hex) {
  const n = parseInt(hex.slice(1), 16), k = 0.72;
  return `rgb(${Math.round((n >> 16) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}
