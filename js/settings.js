// Player settings: schema, persistence (localStorage, best effort) and the settings panel UI.
const KEY = 'tinyworld.settings.v1';

export const SCHEMA = [
  { section: 'Audio' },
  { id: 'master', label: 'Master volume', type: 'range', min: 0, max: 100, def: 80, unit: '%' },
  { id: 'sfx', label: 'Weapons & destruction', type: 'range', min: 0, max: 100, def: 90, unit: '%' },
  { id: 'ambience', label: 'City ambience', type: 'range', min: 0, max: 100, def: 75, unit: '%' },
  { id: 'voices', label: 'Crowd voices', type: 'range', min: 0, max: 100, def: 70, unit: '%' },
  { id: 'speech', label: 'Spoken phrases', type: 'toggle', def: true, hint: 'Occasional clear lines like "Did you see that?"' },
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
  { id: 'crowds', label: 'Crowd density', type: 'select', def: 'normal', options: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], hint: 'Applies when a map loads' },
];

const defaults = () => Object.fromEntries(SCHEMA.filter((f) => f.id).map((f) => [f.id, f.def]));

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
  const panel = document.createElement('div');
  panel.className = 'sp';
  panel.innerHTML = '<h2>SETTINGS</h2>';
  const body = document.createElement('div');
  body.className = 'sp-body';
  for (const f of SCHEMA) {
    if (f.section) { const h = document.createElement('h3'); h.textContent = f.section.toUpperCase(); body.appendChild(h); continue; }
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
  const reset = document.createElement('button'); reset.textContent = 'RESET DEFAULTS';
  const done = document.createElement('button'); done.textContent = 'DONE'; done.className = 'primary';
  reset.addEventListener('click', () => { Object.assign(settings, defaults()); save(); buildSettingsPanel(root, { onClose }); });
  done.addEventListener('click', () => onClose && onClose());
  foot.append(reset, done);
  panel.appendChild(foot);
  root.appendChild(panel);
}
