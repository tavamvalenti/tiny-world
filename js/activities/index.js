// The mini-games: what each is, where it starts, its modes, controls and medal targets. The hub (hub.js) shows them
// in the PLAY menu and at their start beacons; `make` is the class that runs one.
import { TrafficCutUp, TRAFFIC_CFG } from './traffic.js';
import { SnowmobileTrial } from './sled.js';
import { Casino } from './casino.js';

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
  {
    id: 'sled', map: 'greenland', where: 'Sisimiut', name: 'Snowmobile Jump & Time Trial', icon: '🏂', tag: 'A snowcross loop with big jumps',
    desc: 'A groomed snowcross track on the snowfield east of town: a tabletop, rollers, a big gap jump, a risky shortcut over a mega gap, ice and rocks to dodge. Land clean to score; pass every gate for the lap to count.',
    modes: [
      { id: 'trial', name: 'Time trial', desc: 'One lap against the clock. The time starts as you cross the line; every checkpoint, in order.' },
      { id: 'stunt', name: 'Stunt run', desc: 'One lap scored on jumps: distance, airtime and clean landings, chained together.' },
    ],
    controls: [['W / ↑', 'throttle · in the air: lean forward'], ['S / ↓', 'brake · in the air: lean back'], ['A D / ← →', 'steer'], ['Shift', 'boost'], ['Space', 'handbrake slide'], ['V', 'camera distance'], ['R', 'restart'], ['Esc', 'leave']],
    hudKeys: [['W S', 'throttle · lean'], ['A D', 'steer'], ['Shift', 'boost'], ['R', 'restart'], ['Esc', 'leave']],
    medals: { trial: { bronze: 42, silver: 35, gold: 31, unit: 's', better: 'low' }, stunt: { bronze: 2500, silver: 4500, gold: 7000, unit: 'pts', better: 'high' } },
    records: ['sled_time', 'sled_clean', 'sled_jump', 'sled_stunt'],
    note: 'Landing matched to the slope is PERFECT; nose-first or flat on the back is a wipeout. Jumps only score taken off the course, and taking off from the same spot again and again pays less each time. The shortcut is faster if you clear the gap.',
    at: () => ({ x: 106, z: 20, tagH: 6 }),
    minimap: true, make: SnowmobileTrial,
  },
  {
    id: 'casino', map: 'vegas', where: 'Las Vegas', name: 'Casino Jackpot Challenge', icon: '🎰', tag: 'Slots inside Caesars Palace',
    desc: 'Step through the doors of Caesars Palace onto the casino floor. Three machines to play: Lucky 7s (low risk), Diamond Rush (free spins) and Dragon\'s Hoard (high risk, a chest bonus and a progressive jackpot). You bet your Cash.',
    modes: [
      { id: 'floor', name: 'Casino floor', desc: 'Play any machine with your Cash. Wins are paid straight into your wallet.' },
      { id: 'challenge', name: '50-spin challenge', desc: 'A $500 buy-in for exactly 50 spins at $10. Win as much as you can; unplayed spins are refunded.' },
    ],
    controls: [['Space / Enter', 'spin'], ['↑ ↓', 'bet up / down'], ['← →', 'next machine'], ['I', 'paytable and odds'], ['1 2 3', 'pick a chest (bonus)'], ['Esc', 'leave the casino']],
    hudKeys: [],                                     // the machine's panel shows its own keys
    medals: { challenge: { bronze: 600, silver: 1000, gold: 2000, unit: 'cash', better: 'high' } },
    records: ['casino_jackpot', 'casino_session', 'casino_streak'],
    note: 'Every spin is decided and paid the moment you press SPIN, then the reels show it, so nothing can pay twice. The odds are fixed and shown on each machine (I). Cash is game money only: never bought, never cashed out.',
    at: () => ({ x: -17, z: -38, tagH: 6 }),
    minimap: false, make: Casino,
  },
];
