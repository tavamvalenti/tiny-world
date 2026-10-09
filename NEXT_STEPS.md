# Tiny World — where we left off

## PAUSED HERE (2026-10-09): Drone Combat mini-game (phase 4 of the mini-games spec)
**Status:** not built yet. Only the opt-in hooks in `js/vehicles.js` exist (they do nothing unless `veh.combat` is set):
- `veh.combat.assist(muzzle, dir)` nudges machine-gun bullets onto a target (aim assist)
- `veh.combat.rayHit(origin, dir, len)` → `{ enemy, t }` and `veh.combat.bulletHit(enemy, point)` (bullets hit enemy drones)
- `veh.combat.fireMissile()` replaces the grenade (right click / G) while a combat mode is on
- `veh.combat.playerDown()` is called instead of the drone-crash record when the drone is destroyed

**To build next: `js/activities/dogfight.js`**, registered in `js/activities/index.js` as `{ id: 'dogfight', map: '*', usesVehicle: true, ... }`.
- It enters `G.veh.enter('drone')`, sets `G.veh.combat = this`, and on dispose clears it and calls `G.veh.exit()`.
- `hub.key` must let keys through to the drone: add a `passKeys` flag, so Esc / R are handled by the hub and everything else returns false.
- Enemy drones (one type first): pursue, keep distance, 3D steering with an acceleration limit, stay above roofs, avoid buildings, line-of-sight checks throttled, fire back with red tracers, evade missiles (hard turn + flares), lose and reacquire the player, flash when hit, smoke when low, explode and fall. Max ~6 alive, pooled meshes.
- Weapons: the machine gun with aim assist in a configurable cone (the reticle shows when assist is on); lock-on missiles (aim near a target for ~1.2 s to lock, a lock box that shrinks, LOCKED tone, homing with a limited turn rate, proximity fuse, 4 missiles reloading one per ~6 s, despawn after ~6 s).
- HUD: health, missiles, lock box, target health, hit markers, missile warning, wave / kills / timer.
- Modes:
  - Survival waves: the run ends when you're destroyed.
  - 2-minute time attack: respawn with a penalty.
  - Boss: more health, readable patterns (strafing fans, slow homing rockets, a telegraphed dash).
- Records, already defined in `server/minigames.sql` but still to add to `js/progress/defs.js`: `dogfight_wave`, `dogfight_kills`, `dogfight_boss` (low is better, minimum 15 s), `dogfight_score`. Also add achievements.
- Cash: add a `dogfight` entry to `ECONOMY` (per kill, per wave, boss) and a `runPayout` branch in `js/progress/economy.js`.
- The minimap: the activity provides `pilot()` and `minimap()` (enemies as red dots).
- Then **phase 5** of the spec: test all four games, exits, map changes, no console errors or leaks, and give the final report.

**Waiting on the user:** run `server/minigames.sql` in the Supabase SQL Editor (it registers all four games' boards; copy it with `pbcopy < server/minigames.sql`).
New-board scores wait in the pending queue until then.

**Testing tips:**
- Block Supabase fetches in test pages and clear `G.progress.P.pending` afterwards, so bot scores never reach the live boards.
- Images can be posted to a local receiver (scratchpad `recv.py` on port 8791).
- Check imports in the browser: `node --check` missed a real syntax error once.


## Done (2026-09-28)
- **Petco Park** tested and tuned (bigger field, calmer crowd, Western Metal behind the left-field wall, plaza sign).
- **Harbor**: detailed cruise ships (lit balconies, bridge wings, funnel, lido deck + slide, lifeboats), glass terminals,
  gangways, bollards, fenders, tour buses; bridge traffic with cars, trucks and buses with head/tail lights.
- **Chicago, Illinois** (was Glockton): dense run-down walk-up neighbourhood with alleys, garages, vacant lots,
  boarded/fire-scarred buildings, corner stores, a courtyard building and potholed streets. Illinois flag in `assets/`.
- **Random incidents** (`js/chaos.js`): car crashes and street shootings, emergency response, scenes clear and
  wrecks get towed. Settings > World > Random incidents (Off / Low / Normal / High).
- **Summer Smash** (`js/concert.js`) in Chicago: plays a four-song set shuffled (every song once per round, never back-to-back) (`assets/omerta.mp3` 151.5 BPM, `2am.mp3` 126, `free-smurk.mp3` 123.25, `testimony.mp3` 139.75; tempos measured) with a crowd cheer between songs, muffled by distance, 7k-fan jumping crowd, performers, beams, pyro.
  Only player weapons make the crowd evacuate (gate + two emergency exits, around the stands, out to the street).
- **Streetball courts** (`js/court.js`) in the lot north of the festival: two courts, tall chain-link, graffiti wall, lights,
  live 3-on-3 games (dribble, pass, shots, dunks, rebounds); players scatter from weapons and the games restart.
- **Rival crews** (`js/gangs.js`): fictional Blue Line (block 3,0) vs Red Row (block 3,1), border = street at z=-33.
  Strict territory zones, civilians kept out (city.noPeds), 3 armed groups a side, border firefights every ~40 s.
- **Living world foundation** (2026-09-29): typed world events (`G.world.raise`, stored as the emergency incidents in
  agents.js), responders on foot (`js/responders.js`: police / firefighters / paramedics exit, work the scene, return,
  leave), car doors + drivers entering/exiting parked and curb-parked cars, WORLD menu (spawn people, vehicles,
  events, weather) in `js/world.js`, minimal rain/storm/lightning. Not yet: full weather, birds, planes, missions.
- **2026-09-30**: WORLD placement stays armed (click / hold to keep placing; 1–5, Esc or right-click back to weapons);
  placed people work (patrol, fight fires, treat the injured); police HQ on every map (`js/station.js` + guard detail in
  responders.js, threats near it are shot at once; police dispatch from HQ); motorcycles with riders in traffic;
  faster fire response (trucks roll in ~1 s, traffic pulls over, crews spray as soon as they're in range).
- **Phase 2, people with reasons to be there** (2026-09-30): `js/roles.js` adds roles on existing pedestrians (no extra NPCs):
  uniforms plus instanced accessories and one shared job runner (walk, act, carry, go inside, talk). Staffing is per map:
  Gaslamp has hotel, restaurant, harbor and stadium crews; Chicago has festival staff, security, cleanup and vendors;
  La Playa has resort staff, lifeguards, beach crew and tourists. Delivery vans stop and unload, and parked drivers run errands and drive off.
  `js/construction.js` adds 3–6 unfinished buildings per map (bare top floors, steel frame, scaffolding with netting,
  hoarding, materials, a mixer truck), tower cranes that lift loads, and window-washer gondolas on the Gaslamp towers.
  Distance LOD: far jobs tick at 4 Hz, accessories are hidden when far, and both distances pull in when the FPS drops.
  Not yet: La Playa rebuild, birds, planes, news, big event library.
- **Phase 3, a world that runs on its own** (2026-09-30):
  - `js/director.js` starts autonomous events (accident, small fire, disturbance, traffic jam, gas-leak evacuation,
    Chicago gang flare-ups, weather) through the same functions the WORLD menu uses. Events are rare (about one
    every 80 s on Normal). At most 2 majors are started from here at once, and the director backs off after player
    chaos. `chaos.js` no longer schedules anything itself.
  - `js/news.js` runs the TV lower-third ticker from real events plus everyday stories; La Playa's channel is in Spanish.
  - `js/sky.js` adds airliners, small planes, helicopters (sometimes circling emergency scenes) and bird flocks
    that scatter from explosions.
  - Weather covers clear, rain (wet roads, umbrellas, people hurry), storm and snow. Snow is Chicago only: it
    settles on ground and roofs and melts slowly.
  - Summer Smash has a day: setup, show, walk-out, cleanup, then fans arriving again. Petco has game days
    (stands empty, fans leave, traffic builds, staff clean). Cruise ships board, depart and return.
  - Streetball spectators drift in and out.
  - Far pedestrians update every third frame.
- Artifact republished: https://claude.ai/artifact/71DVzhiQHyfQR28ge9C7TV

## Publishing
Strip doctype/html/head/meta/body lines from index.html (add `color-scheme:dark` to `:root`), then publish that page
to the artifact URL with `js/*` and `assets/*` as supporting files.

## Notes
- Run locally with `Start Tiny World.command`. Git history has every step.
