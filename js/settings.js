// Player settings: schema, persistence (localStorage, best effort) and the settings panel UI.
// v2: new default mix (bumping the key applies the new defaults once)
import { icon, installGlassUI } from './ui-glass.js';
const SECTION_ICON = { Audio: ['speaker', '#ff375f'], Controls: ['gamepad', '#0a84ff'], Graphics: ['sparkles', '#bf5af2'], World: ['globe', '#30d158'] };
const KEY = 'tinyworld.settings.v2';

export const SCHEMA = [
  { section: 'Audio' },
  { id: 'master', label: 'Master volume', type: 'range', min: 0, max: 100, def: 80, unit: '%' },
  { id: 'sfx', label: 'Weapons & destruction', type: 'range', min: 0, max: 100, def: 50, unit: '%' },
  { id: 'ambience', label: 'City ambience', type: 'range', min: 0, max: 100, def: 35, unit: '%' },
  { id: 'music', label: 'Concert music', type: 'range', min: 0, max: 100, def: 60, unit: '%', hint: 'Summer Smash in Chicago' },
  { id: 'voices', label: 'Crowd voices', type: 'range', min: 0, max: 100, def: 15, unit: '%' },
  { id: 'rickTalk', label: 'Rick & Morty dialogue', type: 'toggle', def: true, hint: 'Off: Rick and Morty stay quiet in the ship' },
  { section: 'Controls' },
  { id: 'moveSpeed', label: 'Camera move speed', type: 'range', min: 25, max: 250, def: 100, unit: '%' },
  { id: 'zoomSpeed', label: 'Zoom sensitivity', type: 'range', min: 25, max: 250, def: 100, unit: '%' },
  { id: 'rotateSpeed', label: 'Rotate speed (Q / E)', type: 'range', min: 25, max: 250, def: 100, unit: '%' },
  { id: 'invertZoom', label: 'Invert scroll zoom', type: 'toggle', def: false },
  { id: 'shake', label: 'Camera shake', type: 'range', min: 0, max: 200, def: 100, unit: '%' },
  { section: 'Graphics' },
  { id: 'quality', label: 'Quality', type: 'select', def: 'high', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], hint: 'Resolution and shadow detail' },
  { id: 'tiltShift', label: 'Tilt-shift blur', type: 'range', min: 0, max: 200, def: 100, unit: '%' },
  { id: 'grain', label: 'Film grain', type: 'range', min: 0, max: 200, def: 100, unit: '%' },
  { section: 'World' },
  { id: 'incidents', label: 'Random incidents', type: 'select', def: 'normal', options: [['off', 'Off'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], hint: 'Car crashes and shootings the police and ambulances respond to' },
  { id: 'gore', label: 'Blood & gore', type: 'select', def: 'on', options: [['on', 'On'], ['off', 'Off']], hint: 'Blood, and limbs lost in explosions' },
  { id: 'crowds', label: 'Crowd density', type: 'select', def: 'normal', options: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], hint: 'Applies when a map loads' },
  { id: 'news', label: 'Breaking news banners', type: 'toggle', def: true, hint: 'Headlines about what happens in the city' },
  { id: 'spanish', label: 'La Playa news in Spanish', type: 'toggle', def: true, hint: 'Off: La Playa headlines in English' },
];

// phones and tablets start lighter: lower render quality and thinner crowds (both can be raised in Settings)
const TOUCH = typeof document !== 'undefined' && document.documentElement.classList.contains('touch');
const TOUCH_DEFAULTS = { quality: 'low', crowds: 'low' };
const defaults = () => Object.fromEntries(SCHEMA.filter((f) => f.id).map((f) => [f.id, TOUCH && f.id in TOUCH_DEFAULTS ? TOUCH_DEFAULTS[f.id] : f.def]));

function load() {
  const s = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      for (const f of SCHEMA) if (f.id && saved[f.id] !== undefined && typeof saved[f.id] === typeof f.def) s[f.id] = saved[f.id];
    }
  } catch { /* storage unavailable: use defaults */ }
  return s;
}

export const settings = load();
const listeners = new Set();
export function onSettingsChange(fn) { listeners.add(fn); fn(settings); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not persisted */ }
  for (const fn of listeners) fn(settings);
}

const fmt = (f, v) => (f.type === 'range' ? `${v}${f.unit || ''}` : '');

export function buildSettingsPanel(root, { onClose } = {}) {
  root.innerHTML = '';
  installGlassUI();
  const panel = document.createElement('div');
  panel.className = 'sp';
  panel.innerHTML = '<h2>Settings</h2>';
  const body = document.createElement('div');
  body.className = 'sp-body';
  for (const f of SCHEMA) {
    if (f.section) { const h = document.createElement('h3'); const [ic, c] = SECTION_ICON[f.section] || ['sparkles', '#0a84ff']; h.style.setProperty('--hc', c); h.innerHTML = `${icon(ic, 16)}${f.section}`; body.appendChild(h); continue; }
    const row = document.createElement('label');
    row.className = 'sp-row';
    const name = document.createElement('span');
    name.className = 'sp-name';
    name.innerHTML = `${f.label}${f.hint ? `<small>${f.hint}</small>` : ''}`;
    row.appendChild(name);
    let input;
    if (f.type === 'range') {
      input = document.createElement('input');
      Object.assign(input, { type: 'range', min: f.min, max: f.max, step: 5, value: settings[f.id] });
      const val = document.createElement('span');
      val.className = 'sp-val'; val.textContent = fmt(f, settings[f.id]);
      input.addEventListener('input', () => { settings[f.id] = +input.value; val.textContent = fmt(f, settings[f.id]); save(); });
      row.append(input, val);
    } else if (f.type === 'toggle') {
      input = document.createElement('input');
      input.type = 'checkbox'; input.checked = settings[f.id];
      input.addEventListener('change', () => { settings[f.id] = input.checked; save(); });
      const sw = document.createElement('span'); sw.className = 'sp-switch';
      row.append(input, sw);
    } else {
      input = document.createElement('select');
      for (const [v, t] of f.options) { const o = document.createElement('option'); o.value = v; o.textContent = t; input.appendChild(o); }
      input.value = settings[f.id];
      input.addEventListener('change', () => { settings[f.id] = input.value; save(); });
      row.appendChild(input);
    }
    input.dataset.id = f.id;
    body.appendChild(row);
  }
  panel.appendChild(body);
  const foot = document.createElement('div');
  foot.className = 'sp-foot';
  const reset = document.createElement('button'); reset.textContent = 'Reset to defaults';
  const done = document.createElement('button'); done.textContent = 'Done'; done.className = 'primary';
  reset.addEventListener('click', () => { Object.assign(settings, defaults()); save(); buildSettingsPanel(root, { onClose }); });
  done.addEventListener('click', () => onClose && onClose());
  foot.append(reset, done);
  panel.appendChild(foot);
  root.appendChild(panel);
}
