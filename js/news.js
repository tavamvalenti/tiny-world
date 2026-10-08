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
  LOCAL: ['#f4c20d', '#10183a'], FESTIVAL: ['#8a2be2', '#fff'], SPORTS: ['#1f9d55', '#fff'], URGENT: ['#c3001a', '#fff'],
};
const ES_TAG = { BREAKING: 'ÚLTIMA HORA', 'TRAFFIC ALERT': 'ALERTA VIAL', WEATHER: 'CLIMA', UPDATE: 'ACTUALIZACIÓN', LOCAL: 'LOCAL', FESTIVAL: 'FESTIVAL', SPORTS: 'DEPORTES', URGENT: 'URGENTE' };
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
  INCIDENT: ['Servicios de emergencia atienden un reporte {w}', 'Policía y bomberos atienden una emergencia {w}'],
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

// ---------- casualties: reported as they happen, in an urgent tone that grows with the toll ----------
// {n} dead, {i} injured, {w} where, {N} the city's running toll
const K_EN = {
  one: ['One person killed {w}', 'A person has been killed {w}; emergency crews racing to the scene', 'Fatality confirmed {w}'],
  few: ['{n} people killed {w}', 'Deadly scene {w}: {n} confirmed dead', '{n} dead {w}; officials urge everyone to stay away'],
  many: ['Mass casualties {w}: at least {n} dead', 'Horror {w}: {n} killed, many more hurt', 'At least {n} dead {w}; hospitals on alert'],
  worst: ['Catastrophe {w}: death toll climbs past {n}', 'Devastation {w}: at least {n} feared dead', 'City in shock as {n} are killed {w}'],
  rise: ['Death toll rises to {n} {w}', 'Grim update {w}: {n} now confirmed dead', 'More bodies found {w}; toll now {n}'],
  hurt: ['{i} people injured {w}; ambulances on the way', 'Multiple injuries reported {w}: at least {i} hurt'],
  total: ['Death toll across {c} climbs to {N}', '{c} reeling: {N} dead so far', 'Officials confirm {N} deaths across {c}; residents told to shelter'],
  explosion: ['Explosion kills {n} {w}', 'Deadly blast {w}: {n} dead'], meteor: ['Meteor strike kills {n} {w}', 'Sky falls {w}: {n} killed'],
  laser: ['Mysterious beam kills {n} {w}'], rick: ['Rick and Morty rampage {w}: {n} dead', '{n} killed {w} as Rick and Morty strike again', 'Rick and Morty attack leaves {n} dead {w}'], wind: ['Freak winds leave {n} dead {w}'], shooting: ['Deadly shooting {w}: {n} killed', 'Gunfire {w} leaves {n} dead'],
};
const K_ES = {
  one: ['Muere una persona {w}', 'Reportan una persona sin vida {w}', 'Confirman un fallecido {w}'],
  few: ['{n} muertos {w}', 'Tragedia {w}: {n} personas sin vida', '{n} muertos {w}; piden evitar la zona'],
  many: ['Masacre {w}: al menos {n} muertos', 'Horror {w}: {n} muertos y decenas de heridos', 'Al menos {n} muertos {w}; hospitales en alerta'],
  worst: ['Catástrofe {w}: más de {n} muertos', 'Devastación {w}: se temen al menos {n} muertos', 'Conmoción en La Playa: {n} muertos {w}'],
  rise: ['Sube a {n} la cifra de muertos {w}', 'Ya son {n} los muertos {w}'],
  hurt: ['{i} heridos {w}; ambulancias en camino', 'Reportan al menos {i} heridos {w}'],
  total: ['Sube a {N} la cifra de muertos en La Playa', 'La Playa en duelo: {N} muertos hasta ahora'],
  explosion: ['Explosión deja {n} muertos {w}'], meteor: ['Meteorito deja {n} muertos {w}'], laser: ['Misterioso rayo deja {n} muertos {w}'], rick: ['Ataque de Rick y Morty deja {n} muertos {w}', '{n} muertos {w}: Rick y Morty atacan de nuevo'],
  wind: ['Vientos dejan {n} muertos {w}'], shooting: ['Balacera deja {n} muertos {w}', 'Ataque armado {w}: {n} muertos'],
};
// ---------- Rick and Morty: regulars in the news. Everyone in town knows the green saucer by now ----------
const RM_EN = {
  sighted: ['Rick and Morty spotted over {w} again; residents told to stay indoors', "Here we go again: Rick Sanchez's saucer seen {w}", 'Green portal opens {w}; witnesses say it\'s Rick and Morty. Again', 'Rick and Morty are back {w}; police say they are "monitoring the situation"', "Rick Sanchez's ship hovering {w}; schools on lockdown, as usual"],
  laser: ['Rick and Morty open fire {w}', 'Green laser fire {w}: witnesses blame Rick and Morty, again', 'Rick Sanchez shooting up {w}; Morty reportedly "really not okay with this"', 'Laser blasts rake {w}; Rick and Morty suspected, as always', 'Rick and Morty strafe {w}; insurers stop answering the phone'],
  bomb: ['Rick and Morty drop a bomb {w}', 'Another Rick and Morty bombing {w}; officials "not even surprised anymore"', 'Bomb falls from Rick Sanchez\'s saucer {w}', 'Explosion {w}; the green saucer seen speeding away', 'Rick and Morty level part of {w}; city council calls an emergency session, again'],
  collapse: ['Building comes down {w}; Rick and Morty seen flying off', 'Collapse {w} as Rick and Morty\'s rampage goes on', 'Structure falls {w}; residents: "it\'s Rick and Morty, it\'s always Rick and Morty"'],
  crash: ["Rick and Morty's saucer clips a building {w}; witnesses say the pilot looked drunk", 'Flying saucer bounces off a building {w}; Rick Sanchez seen swigging from a flask', "Rick's ship scrapes the rooftops {w}; Morty heard screaming"],
  damage: ['Rick and Morty damage bill climbs {w}: {n} building sections destroyed', '{n} sections down {w}; city adds it to the Rick Sanchez tab', 'Mayor: Rick and Morty have now destroyed {n} sections {w}'],
  gone: ["Rick and Morty's saucer vanishes; cleanup crews move in", 'The green saucer is gone, for now; residents start sweeping up', 'Rick and Morty leave town; officials expect them back by the weekend'],
};
const RM_ES = {
  sighted: ['Avistan otra vez a Rick y Morty {w}; piden no salir de casa', 'Ahí van de nuevo: el platillo de Rick Sánchez {w}', 'Se abre un portal verde {w}; testigos dicen que son Rick y Morty, otra vez'],
  laser: ['Rick y Morty abren fuego {w}', 'Rayos verdes {w}: culpan de nuevo a Rick y Morty', 'Rick Sánchez dispara {w}; Morty "no está de acuerdo", dicen testigos'],
  bomb: ['Rick y Morty sueltan una bomba {w}', 'Otro bombardeo de Rick y Morty {w}; autoridades "ya ni se sorprenden"', 'Cae una bomba del platillo de Rick Sánchez {w}'],
  collapse: ['Se derrumba un edificio {w}; ven a Rick y Morty alejarse', 'Derrumbe {w}: "siempre son Rick y Morty", dicen vecinos'],
  crash: ['El platillo de Rick y Morty choca con un edificio {w}; el piloto parecía ebrio', 'La nave de Rick roza los techos {w}; se escuchan gritos de Morty'],
  damage: ['Crece la factura de Rick y Morty {w}: {n} secciones destruidas', '{n} secciones destruidas {w}; todo a la cuenta de Rick Sánchez'],
  gone: ['Desaparece el platillo de Rick y Morty; comienza la limpieza', 'Rick y Morty se van de La Playa; esperan que vuelvan pronto'],
};
const MILESTONES = [10, 25, 50, 100, 200, 350, 500, 750, 1000];

// ---------- places: street names on the road grid, named landmarks, and what kind of building got hit ----------
// Streets run along the map's grid lines (x = north-south streets, west to east; z = east-west streets, north to
// south). Downtown San Diego's are the real ones in the right order (the trolley runs down C Street; One America
// Plaza and the Westin sit on Broadway at Kettner, as they do); Chicago's are South Side streets; La Playa's are
// the kind of names every Mexican beach town has.
const STREETS = {
  downtown: { x: ['Kettner Boulevard', 'India Street', 'Columbia Street', 'Union Street', 'Front Street', 'Fourth Avenue', 'Fifth Avenue'], z: ['Ash Street', 'A Street', 'B Street', 'C Street', 'Broadway', 'Market Street', 'Harbor Drive'] },
  suburbs: { x: ['Wentworth Avenue', 'State Street', 'Michigan Avenue', 'King Drive', 'Cottage Grove Avenue'], z: ['Pershing Road', '43rd Street', '47th Street', '51st Street', 'Garfield Boulevard'] },
  tropical: { x: ['Calle Hidalgo', 'Calle Morelos', 'Calle Juárez', 'Calle Zaragoza', 'Calle Allende', 'Calle Guerrero'], z: ['Paseo del Malecón', 'Avenida México', 'Calle Insurgentes', 'Calle Independencia'] },
};
const RESORTS = ['Hotel Playa Dorada', 'Hotel Costa Azul', 'Hotel Las Palmas', 'Hotel Vista del Mar', 'Hotel Bahía Real', 'Hotel Marena', 'Hotel Sol y Arena', 'Hotel Coral'];
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const an = (s) => (/^[aeiou]|^eight|^eleven/i.test(s) ? 'an ' : 'a ') + s;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// a landmark: { S: subject ("OXXO", "The Manchester Grand Hyatt San Diego"), o: object ("an OXXO", "the Manchester
// Grand Hyatt San Diego"), es: Spanish ("un OXXO"), near: where-phrase when merely close by }
const LM = (S, o = S, es = o) => ({ S, o, es });
// landmark headlines (the subject is a named place) and everyday-building ones (the subject is "a three-story ...")
const L_EN = {
  FIRE: ['{S} catches fire', 'Fire breaks out at {o}', 'Flames reported at {o}; crews responding'],
  SHOOTING: ['Shots fired at {o}; police on scene'], EVACUATION: ['{S} being evacuated', 'Evacuation under way at {o}'],
  INCIDENT: ['Emergency crews responding to {o}'], explosion: ['Explosion at {o}', 'Blast rocks {o}'],
  meteor: ['Meteor slams into {o}!', 'Object falls from the sky onto {o}'], laser: ['Mysterious beam sets {o} ablaze'],
  wind: ['Violent winds batter {o}'], collapse: ['Part of {o} comes down', '{S} partially collapses'],
};
const L_ES = {
  FIRE: ['Se incendia {es}', 'Incendio en {es}; bomberos en camino'], SHOOTING: ['Reportan disparos en {es}'], EVACUATION: ['Evacúan {es}'],
  INCIDENT: ['Emergencia en {es}'], explosion: ['Explosión en {es}', 'Fuerte explosión sacude {es}'], meteor: ['¡Cae un meteorito sobre {es}!'],
  laser: ['Misterioso rayo incendia {es}'], wind: ['Fuertes vientos azotan {es}'], collapse: ['Se derrumba parte de {es}', 'Colapsa {es}'],
};
const D_EN = {
  FIRE: ['Fire tears through {d} {w}', 'Crews battle a fire at {d} {w}', 'Smoke pouring from {d} {w}'],
  explosion: ['Explosion rocks {d} {w}', 'Blast tears through {d} {w}'], meteor: ['Meteor smashes into {d} {w}!'],
  collapse: ['{D} collapses {w}', 'Part of {d} comes down {w}'],
};
const D_ES = {
  FIRE: ['Se incendia {d} {w}', 'Incendio en {d} {w}'], explosion: ['Explosión sacude {d} {w}'], meteor: ['¡Meteorito cae sobre {d} {w}!'],
  collapse: ['Se derrumba {d} {w}', 'Colapsa {d} {w}'],
};

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
#newsTicker.urgent{border-color:rgba(255,45,60,.75);animation:newsUrgent 1.1s ease-in-out infinite}
#newsTicker.urgent .head{font-weight:800}
@keyframes newsUrgent{0%,100%{box-shadow:0 0 0 1px rgba(255,40,55,.35),0 10px 34px rgba(170,0,20,.35)}50%{box-shadow:0 0 0 1px rgba(255,60,70,.8),0 10px 46px rgba(220,0,30,.65)}}
@media (prefers-reduced-motion: reduce){#newsTicker.urgent{animation:none}}
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
  // ---------- places ----------
  // named landmarks with their footprints (built on first use, once everything on the map exists)
  lms() {
    if (this._lms) return this._lms;
    const C = this.city, L = [];
    const rect = (r, lm, m = 0, extra = {}) => r && L.push({ ...lm, ...extra, x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });
    const bld = (b, lm) => b && L.push({ ...lm, x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
    const hq = C.policeHQ ? { x0: C.policeHQ.x - 9, x1: C.policeHQ.x + 9, z0: C.policeHQ.z - 9, z1: C.policeHQ.z + 9 } : null;
    if (this.map === 'downtown') {
      for (const l of C.landmarks || []) {
        if (l.kind === 'oneAmerica') bld(l.b, LM('One America Plaza'));
        if (l.kind === 'emerald') for (const t of l.towers) bld(t, LM('The Westin San Diego Bayview', 'the Westin San Diego Bayview'));
        if (l.kind === 'hyatt') for (const t of l.towers) bld(t, LM('The Manchester Grand Hyatt San Diego', 'the Manchester Grand Hyatt San Diego'));
      }
      for (const c of C.chains || []) L.push({ ...LM('In-N-Out', 'an In-N-Out'), street: true, x0: c.lot.lx0, x1: c.lot.lx1, z0: c.lot.lz0, z1: c.lot.lz1 });
      rect(C.petco, LM('Petco Park'), 3);
      rect(hq, LM('San Diego Police Headquarters'));
    } else if (this.map === 'suburbs') {
      for (const c of C.chains || []) L.push({ ...LM("Raising Cane's", "a Raising Cane's"), street: true, x0: c.x0 - 0.5, x1: c.px + c.pw / 2 + 0.5, z0: c.z0 - 0.5, z1: c.front + 1.5 });
      rect(C.concert, LM('Summer Smash', 'the Summer Smash grounds'), 2);
      rect(C.court, LM('The streetball courts', 'the streetball courts'), 1);
      rect(C.school, LM('Washington Park Elementary'));
      rect(hq, LM('The Chicago Police district station', 'the Chicago Police district station'));
    } else {
      const P = C.playa || {};
      for (const o of P.oxxo || []) L.push({ ...(o.gas ? LM('OXXO Gas', 'an OXXO Gas station', 'una gasolinera OXXO') : LM('OXXO', 'an OXXO', 'un OXXO')), street: true, x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z, z1: o.z + 3.6 });
      (P.hotels || []).forEach((h, k) => { const n = RESORTS[k % RESORTS.length]; bld(h, LM(n, n, 'el ' + n)); });
      for (const f of P.food || []) L.push({ ...(f.kind === 'taco' ? LM('A taco stand', 'a taco stand', 'un puesto de tacos') : LM('A fruit stand', 'a fruit stand', 'un puesto de fruta')), street: true, x0: f.x - 1, x1: f.x + 1, z0: f.z - 1, z1: f.z + 1 });
      for (const p of P.piers || []) L.push({ ...LM('The pier', 'the pier', 'el muelle'), x0: p.x - 1, x1: p.x + 1, z0: Math.min(p.z0, p.z1), z1: Math.max(p.z0, p.z1) });
      rect(hq, LM('Police headquarters', 'police headquarters', 'la comandancia'));
    }
    return (this._lms = L);
  }
  // the landmark at (x, z) (m = how close counts), the Coronado Bridge included
  landmarkAt(x, z, m = 0) {
    for (const l of this.lms()) if (x > l.x0 - m && x < l.x1 + m && z > l.z0 - m && z < l.z1 + m) return l;
    const P = this.city.bridgePath;
    if (P) for (let k = 0; k + 1 < P.length; k++) {
      const [ax, az] = P[k], [bx, bz] = P[k + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(ax + dx * t - x, az + dz * t - z) < 4 + m * 0.4) return { ...LM('The Coronado Bridge', 'the Coronado Bridge', 'el puente de Coronado'), bridge: true };
    }
    return null;
  }
  // the nearest street, or the intersection when it's right at a corner: { on } or { at: [a, b] }
  street(x, z) {
    const S = STREETS[this.map], C = this.city;
    if (!S || !C.xs || !C.zs) return null;
    const near = (arr, v) => arr.reduce((b, a, k) => (Math.abs(v - a) < b.d ? { k, d: Math.abs(v - a) } : b), { k: 0, d: 1e9 });
    const nx = near(C.xs, x), nz = near(C.zs, z), X = S.x[nx.k], Z = S.z[nz.k];
    if (!X || !Z) return null;
    if (nx.d < 6 && nz.d < 6) return { at: [Z, X] };
    return { on: nx.d < nz.d ? X : Z };
  }
  streetPhrase(x, z) {
    const s = this.street(x, z);
    if (!s) return null;
    if (this.es) return s.at ? `en ${s.at[0]} esquina con ${s.at[1]}` : `en ${s.on}`;
    return s.at ? `at ${s.at[0]} and ${s.at[1]}` : `on ${s.on}`;
  }
  // the ordinary building at a spot, described like a reporter would ("a three-story brick building", "a two-flat")
  buildingAt(x, z) {
    let best = null, bd = 2.2;
    G.buildings && G.buildings.query(x, z, 2.2, (c) => { if (!c.b) return; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c.b; } });
    if (!best) return null;
    const n = best.floors || 1, st = best.style, m = this.map;
    let kind = 'building', storeys = true;
    if (m === 'suburbs') {
      if (st === 'flat') { kind = n <= 2 ? 'two-flat' : n === 3 ? 'three-flat' : 'apartment building'; storeys = n > 3; }
      else if (st === 'house') { kind = 'home'; storeys = false; } else if (st === 'garage') { kind = 'garage'; storeys = false; }
      else if (st === 'boarded') kind = 'vacant building'; else if (st === 'brick') kind = 'brick building';
    } else if (m === 'downtown') {
      kind = (st === 'office' || st === 'concrete') ? (n >= 10 ? 'office tower' : 'office building') : st === 'brick' ? 'brick building' : 'building';
    } else {
      if (st === 'stucco' && n <= 2) { kind = 'home'; storeys = false; } else if (st === 'stucco') kind = 'apartment building';
    }
    const en = (storeys ? `${NUM[n] || n}-story ` : '') + kind;
    const es = m === 'tropical' && st === 'stucco' && n <= 2 ? 'una casa' : n <= 1 ? 'un local comercial' : `un edificio de ${n} pisos`;
    return { en: an(en), es };
  }
  // "near Petco Park", "at Fifth Avenue and Market Street", "in the Favelas", "en Calle Morelos"...
  where(x, z) {
    const C = this.city, near = (S, m = 12) => S && x > S.x0 - m && x < S.x1 + m && z > S.z0 - m && z < S.z1 + m;
    const L = this.landmarkAt(x, z, 6);
    if (L) {
      if (L.bridge) return this.es ? 'en el puente de Coronado' : 'on the Coronado Bridge';
      const at = this.landmarkAt(x, z, 0.5) === L;
      if (!L.street) return this.es ? (at ? 'en ' : 'cerca de ') + L.es : (at ? 'at ' : 'near ') + L.o;
    }
    if (this.map === 'tropical') {
      if (z > 100 && Math.abs(x - 22) < 20) return this.es ? 'en el mirador del Cristo' : 'at the Cristo lookout';
      if (z > 64) return this.es ? pick(['en las favelas', 'en las favelas del cerro']) : pick(['in the Favelas', 'up in the Favelas']);
      if (z < -14) return this.es ? pick(['en la playa', 'en el malecón']) : pick(['on the beach', 'on the malecón']);
    }
    if (this.map === 'downtown' && C.shoreX != null && x < C.shoreX + 10) return 'on the Embarcadero';
    if (G.gangs && G.gangs.zones) { const Z = G.gangs.zones; if (near(Z.blue, 4)) return 'in Blue Line'; if (near(Z.red, 4)) return 'in Red Row'; }
    return this.streetPhrase(x, z) || (this.es ? 'en La Playa' : 'in ' + CITY[this.map]);
  }
  // a headline about a named landmark: {S} subject, {o} object, {es} Spanish; chain stores get their street
  fillL(t, L, x, z) {
    const st = L.street ? this.street(x, z) : null, on = st ? (st.on || st.at[0]) : null;
    const S = on ? `${L.S} on ${on}` : L.S, o = on ? `${L.o} on ${on}` : L.o, es = on ? `${L.es} en ${on}` : L.es;
    return t.replace('{S}', S).replace('{o}', o).replace('{es}', es);
  }
  // the best headline for something that happened at (x, z): about the landmark, else the building, else null
  placeHeadline(kind, x, z, m = 0.8) {
    const L = this.landmarkAt(x, z, m), Lt = (this.es ? L_ES : L_EN)[kind];
    if (L && Lt) return this.fillL(pick(Lt), L, x, z);
    const b = this.buildingAt(x, z), Dt = (this.es ? D_ES : D_EN)[kind];
    if (b && Dt) { const d = this.es ? b.es : b.en; return pick(Dt).replace('{d}', d).replace('{D}', cap(d)).replace('{w}', this.streetPhrase(x, z) || this.where(x, z)); }
    return null;
  }
  post(tag, text, prio = 1, key = null) {
    if (this.es) text = text.replace(/\b([Dd])e el\b/g, '$1el').replace(/\b([Aa]) el\b/g, '$1l');   // Spanish contractions: del, al
    // the same kind of story isn't repeated back to back
    if (key && G.time - (this.last[key] ?? -1e9) < (prio > 1 ? 12 : 120)) return;
    if (key) this.last[key] = G.time;
    // breaking news goes ahead of everyday items; the queue stays short so what's shown is current
    if (prio > 2) { this.queue.unshift({ tag, text, prio }); this.queue = this.queue.slice(0, 5); }
    else if (prio > 1) { const k = this.queue.findIndex((q) => q.prio <= 1); this.queue.splice(k < 0 ? this.queue.length : k, 0, { tag, text, prio }); this.queue = this.queue.slice(0, 5); }
    else if (this.queue.length < 3) this.queue.push({ tag, text, prio });
  }
  // a world event was raised
  event(ev) {
    if (ev.type === 'SHOOTING' || ev.type === 'GANG_CONFLICT') this.cause = { kind: 'shooting', x: ev.x, z: ev.z, t: G.time };
    const T = ev.type, fill = (s) => s.replace('{w}', this.where(ev.x, ev.z)).replace('{c}', CITY[this.map]);
    let tag, text;
    if (T === 'WEATHER_EVENT') { tag = 'WEATHER'; const t = (this.es ? W_ES : W_EN)[ev.news]; text = t && fill(t); }
    else if (T === 'FESTIVAL_EVENT') { tag = ev.tag || 'FESTIVAL'; text = ev.news; }
    else {
      const t = (this.es ? T_ES : T_EN)[T];
      if (!t) return;
      tag = { TRAFFIC_ACCIDENT: 'TRAFFIC ALERT', TRAFFIC_JAM: 'TRAFFIC ALERT', DISTURBANCE: 'LOCAL' }[T] || 'BREAKING';
      // named when it's at a landmark ("OXXO catches fire") or a building ("Fire tears through a two-flat on 47th Street")
      text = (['FIRE', 'SHOOTING', 'EVACUATION', 'INCIDENT'].includes(T) && this.placeHeadline(T, ev.x, ev.z)) || fill(pick(t));
    }
    if (!text) return;
    this.post(tag, text, ['WEATHER_EVENT', 'FESTIVAL_EVENT', 'DISTURBANCE', 'TRAFFIC_JAM'].includes(T) ? 1.5 : 2, T);
  }
  // Rick and Morty in town: their own stories ('sighted', 'crash', 'gone'), and everything they wreck is theirs
  get rickOn() { return !!(G.rick && G.rick.active); }
  rick(kind, x, z, n) {
    const t = (this.es ? RM_ES : RM_EN)[kind]; if (!t) return;
    const w = x == null ? (this.es ? 'en La Playa' : 'in ' + CITY[this.map]) : this.where(x, z), text = pick(t).replace('{w}', w).replace('{n}', n);
    this.post(kind === 'gone' || kind === 'sighted' ? 'LOCAL' : 'BREAKING', text, kind === 'gone' ? 1.5 : 2, 'rick-' + kind);
  }
  // the player's weapons (only the big ones make the news; one story per kind every few seconds)
  onBlast(x, y, z, r, power, kind) {
    if (this.rickOn && (kind === 'laser' || kind === 'explosion')) {
      if (power >= 1.5) this.cause = { kind: 'rick', x, z, t: G.time };
      if (kind === 'laser' || power >= 5) this.rick(kind === 'laser' ? 'laser' : 'bomb', x, z);
      return;
    }
    if (kind !== 'collapse' && power >= 1.5) this.cause = { kind: kind === 'bomb' ? 'explosion' : kind, x, z, t: G.time };
    if (!B_EN[kind] || kind === 'collapse' || (kind !== 'laser' && power < 5)) return;
    const t = this.placeHeadline(kind, x, z, 1.5) || pick((this.es ? B_ES : B_EN)[kind]).replace('{w}', this.where(x, z));
    this.post('BREAKING', t, 2, 'blast-' + kind);
  }
  destruction(x, z, many) {
    if (many < 4) return;
    if (this.rickOn) return this.rick('collapse', x, z);
    this.post('BREAKING', this.placeHeadline('collapse', x, z, 1.5) || pick((this.es ? B_ES : B_EN).collapse).replace('{w}', this.where(x, z)), 2, 'collapse');
  }
  // ...and wrapped up (usually: most scenes get a follow-up)
  resolved(ev) {
    if (Math.random() > 0.75) return;
    const t = (this.es ? R_ES : R_EN)[ev.type];
    if (t) this.post('UPDATE', t.replace('{w}', this.where(ev.x, ev.z)), 1.2, 'up-' + ev.type);
  }
  // ---------- casualties ----------
  // n killed / i hurt at (x, z): gathered into one incident per place and moment, reported once it settles,
  // with follow-ups as the toll rises (the crowds at Petco and Summer Smash report theirs here too)
  casualty(x, z, n = 1, i = 0) {
    const inc = (this.incs ||= []).find((c) => Math.hypot(c.x - x, c.z - z) < 35 && G.time - c.last < 90);
    if (inc) { inc.dead += n; inc.hurt += i; inc.last = G.time; if (n) inc.lastDead = G.time; }
    else this.incs.push({ x, z, dead: n, hurt: i, t0: G.time, last: G.time, lastDead: n ? G.time : -1e9, said: 0, saidHurt: 0 });
    this.total = (this.total || 0) + n;
  }
  scanCasualties() {
    for (const p of G.agents ? G.agents.peds : []) {
      if (p.dead) { if (!p._toll) { p._toll = true; this.casualty(p.pos.x, p.pos.z, 1, 0); } }
      else { p._toll = false; if (p.state === 'down' || p.state === 'air') { if (!p._hurt && p.threat) { p._hurt = true; this.casualty(p.pos.x, p.pos.z, 0, 1); } } else if (p.state !== 'carried') p._hurt = false; }
    }
  }
  reportCasualties() {
    const K = this.es ? K_ES : K_EN;
    for (const c of this.incs || []) {
      // wait for things to settle a moment, but don't sit on a big toll
      if (c.dead > c.said && (G.time - c.lastDead > 2.5 || c.dead - c.said >= 12)) {
        const w = this.where(c.x, c.z), n = c.dead;
        const cause = this.cause && G.time - this.cause.t < 10 && Math.hypot(this.cause.x - c.x, this.cause.z - c.z) < 40 ? this.cause.kind : null;
        let t;
        if (c.said > 0) t = pick(K.rise);
        else if (n >= 20) t = pick(K.worst);
        else if (cause && K[cause] && n > 1 && Math.random() < 0.6) t = pick(K[cause]);
        else t = pick(n === 1 ? K.one : n < 6 ? K.few : K.many);
        let text = t.replace('{w}', w).replace('{n}', n);
        if (c.said === 0 && c.hurt >= 2 && n > 1) text += this.es ? `; ${c.hurt} heridos` : `; ${c.hurt} injured`;
        this.post('URGENT', text, 3, null);
        if (!c.said) this.nIncidents = (this.nIncidents || 0) + 1;
        c.said = n; c.saidHurt = c.hurt;
      } else if (c.said === 0 && c.dead === 0 && c.hurt - c.saidHurt >= 5 && G.time - c.last > 2.5) {
        this.post('BREAKING', pick(K.hurt).replace('{w}', this.where(c.x, c.z)).replace('{i}', c.hurt), 2, null);
        c.saidHurt = c.hurt;
      }
    }
    this.incs = (this.incs || []).filter((c) => G.time - c.last < 90);
    // milestones for the whole city
    const m = MILESTONES.filter((v) => v <= (this.total || 0)).pop();
    // (only once the deaths come from more than one scene, otherwise it just repeats the last report)
    if (m && m !== this.mile && (this.nIncidents || 0) > 1) { this.mile = m; this.post('URGENT', pick(K.total).replace('{N}', this.total).replace('{c}', CITY[this.map]), 3, null); }
  }
  update(dt) {
    this.quiet += dt;
    if ((this.casT = (this.casT || 0) - dt) <= 0) { this.casT = 0.25; this.scanCasualties(); this.reportCasualties(); }
    // banners switched off in Settings: nothing shows (and nothing piles up for later)
    if (settings.news === false) { if (this.showT > 0 || this.queue.length) { this.showT = 0; this.queue.length = 0; this.el.classList.remove('on'); } return; }
    // the damage adds up: a running tally every so often while things are being destroyed
    if ((this.dmgT -= dt) <= 0) {
      this.dmgT = 20;
      const n = G.buildings ? G.buildings.destroyed : 0;
      if (n - this.lastDestroyed >= 15 && this.rickOn) { this.lastDestroyed = n; this.rick('damage', null, null, n); }
      else if (n - this.lastDestroyed >= 15) { this.lastDestroyed = n; this.post('UPDATE', pick((this.es ? B_ES : B_EN).damage).replace('{w}', this.es ? 'en La Playa' : 'in ' + CITY[this.map]).replace('{n}', n), 1.5, 'damage'); }
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
    this.el.classList.toggle('urgent', q.tag === 'URGENT');
    this.el.classList.add('on');
    this.showT = q.tag === 'URGENT' ? SHOW + 2 : SHOW;
  }
}
