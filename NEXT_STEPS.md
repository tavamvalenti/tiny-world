# Tiny World — where we left off

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
