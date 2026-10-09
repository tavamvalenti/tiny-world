// The mini-games: what each is, where it starts, its modes, controls and medal targets. The hub (hub.js) shows them
// in the PLAY menu and at their start beacons; `make` is the class that runs one.
import { TrafficCutUp, TRAFFIC_CFG } from './traffic.js';

export const ACTIVITY_DEFS = [
  {
    id: 'traffic', map: 'vegas', where: 'Las Vegas', name: 'Highway Cut-Up', icon: '🏎️', tag: 'Weave through I-15 traffic at full speed',
    desc: 'A sports car on the northbound side of I-15. Pass cars as close as you dare: near misses build a combo, the combo multiplies the points, and it all banks when the combo runs out. Touch anything and the combo is gone.',
    modes: [
      { id: 'score90', name: '90-second score attack', desc: 'Score as much as you can in 90 seconds. A crash spins you out, then you carry on.' },
      { id: 'endless', name: 'Endless survival', desc: 'Drive until a serious crash ends it. The traffic thickens the further you go.' },
    ],
    controls: [['W / ↑', 'accelerate'], ['S / ↓', 'brake · reverse'], ['A D / ← →', 'steer'], ['Shift', 'boost (near misses refill it)'], ['Space', 'handbrake'], ['V', 'camera distance'], ['R', 'restart'], ['Esc', 'leave']],
    hudKeys: [['W S', 'throttle · brake'], ['A D', 'steer'], ['Shift', 'boost'], ['R', 'restart'], ['Esc', 'leave']],
    medals: { score90: { bronze: 8000, silver: 20000, gold: 40000, unit: 'pts', better: 'high' }, endless: { bronze: 3000, silver: 8000, gold: 15000, unit: 'm', better: 'high' } },
    records: ['traffic_score90', 'traffic_distance', 'traffic_combo', 'traffic_clean'],
    note: 'Near misses only count at speed while actually overtaking, once per car. Scraping a car or the barrier loses the combo; a hard hit is a crash.',
    at: () => ({ x: TRAFFIC_CFG.I15 + 11, z: 150, y: 0, tagH: 5 }),
    minimap: true, make: TrafficCutUp,
  },
];
