# Tiny World Map Standard

**Mandatory.** Read this file before creating, expanding, or remodeling any Tiny World map.

## Purpose

Tiny World now has a set of finished core maps: Gaslamp District (San Diego), Chicago, La Playa, Las Vegas, London and Sisimiut (Greenland). Together they set the visual, gameplay, density, detail and performance standard for the whole game.

Future maps must feel like they belong in the same finished game, not like separate prototypes.

- Do **not** lower the quality standard because a city is difficult to build.
- Do **not** create simplified "beta" versions of future cities unless the owner explicitly asks for one.

## Reference standard

The existing maps are the production benchmark. The standard is their actual implementation and feel, not a generic checklist.

When creating a new map:

1. Inspect the existing maps and their systems.
2. Identify how they achieve density, realism, activity, visual detail and performance.
3. Reuse those underlying systems.
4. Replace only the city-specific content.
5. Add enough local detail that the new map feels equally complete.

A new map should never feel like:

- a landmark showcase
- an empty terrain demo
- a handful of buildings surrounded by blank space
- a city of generic buildings with a few famous landmarks
- a temporary prototype

## Every map must have

### Environment

- A clear geographic identity
- Appropriate terrain and elevation
- Dense, believable development where appropriate
- Natural transitions between developed and undeveloped areas
- Parks, open areas, waterfronts, outskirts or other geography appropriate to the city

### Streets

- A believable road network
- Intersections and side streets
- Alleys where appropriate
- Sidewalks, crosswalks and road markings
- Traffic signals and signage where appropriate
- Parking areas
- Local road characteristics

### Buildings

- Strong architectural identity
- Residential buildings, commercial buildings and local businesses
- Background buildings
- Varied building heights and shapes
- Rooftop details
- Signs, awnings, windows, doors, balconies, utility equipment and other small details

### City life

The map must feel occupied. Include whichever of these fit:

- Pedestrians, workers and tourists
- Cars, trucks, buses, and service and emergency vehicles
- Businesses operating
- Local activities
- Traffic and ambient movement

Use the existing Tiny World simulation systems rather than inventing new AI systems for every map.

### Local identity

Every city needs details that make it recognizable even without its name on screen. Draw on whichever of these fit:

- Architecture, businesses, signage and advertising
- Vehicles, license plates, transit and road markings
- Clothing
- Flags and street furniture
- Vegetation and weather
- Audio
- Local events and landmarks

Ask: *"If the map title disappeared, would this still obviously feel like the correct city?"* If not, the map is not finished.

## Landmarks

- Major landmarks should be recognizable and correctly placed within the surrounding city.
- Never build a famous landmark as an isolated object surrounded by generic scenery. It should sit in a believable neighborhood and streetscape.
- Landmarks should interact with existing Tiny World systems where appropriate. At minimum they should be destructible buildings, with dressing hung on their cells.

## Vehicles and transit

Vehicles must match the location. Use the existing vehicle framework and add local vehicles where needed, for example:

- Local buses and taxis
- Police, fire and ambulance vehicles
- Delivery and construction vehicles
- Transit vehicles
- Boats and tourist vehicles

Add vehicles when they improve the city's identity or gameplay, not just to raise the count.

## Audio

Each map should have appropriate local audio:

- Ambient city noise and traffic
- Transit sounds and emergency sirens
- Local music
- Business and environment sounds
- Weather and waterfront sounds
- Event sounds
- Appropriate NPC dialogue

Do not accidentally reuse highly recognizable city-specific audio from another map.

## Events and activity

Maps should contain things that make the city feel alive. Use existing systems wherever possible:

- Festivals, concerts and sports
- Construction
- Emergency incidents, police activity, fires and traffic incidents
- Waterfront activity
- Local events
- Businesses operating and normal daily activity

Don't overload the map with constant events. The city should feel alive mainly through normal activity, with unusual events appearing occasionally (the director, `js/director.js`, paces them).

## Destruction

Every map must work with Tiny World's existing destruction systems:

- Weapons, explosions and fire
- Structural damage and rubble
- Emergency response
- Persistent destruction where supported

Don't create beautiful buildings that are disconnected from destruction unless there is a technical reason.

## Cross-map contamination audit

Every new map **must** pass a dedicated cross-map contamination audit before it counts as complete. Check for accidental reuse of:

- Signs, businesses, storefronts and ads
- Road markings and license plates
- Transit, police, fire and ambulance branding
- NPC clothing and local props
- Architecture and flags
- Music and ambient audio
- Weather, vegetation and terrain
- City-specific colors
- Events and news text
- Hardcoded city names or references to another map

Underlying systems may be shared. City identity assets may not bleed between maps.

## Performance

Visual density must not destroy performance. Prefer:

- Instancing (`InstancedMesh`) to cut draw calls for repeated geometry
- Shared geometry and materials
- Level of detail: cheaper versions of distant content
- Lightweight distant objects and simplified background simulation
- Reusable assets and efficient scene organization

Never solve performance problems by making the city empty. Make distant content cheaper instead. Dispose of obsolete map resources when switching maps where appropriate.

## External resources and SFX (always ask)

Before building or remodeling a map, Claude must **always** give the owner a concrete list of every SFX, music track, dialogue clip and external resource that would materially improve the map, and ask the owner to supply them. Never ask vaguely for "more references". Each item must say:

- **what** exactly is needed (for example "Big Ben bell strike recording, ~10 s", "street-level photo of a Sisimiut house entrance and steps"),
- **why** it matters,
- **which part** of the map it improves.

Possible resources:

- **Images and references:** reference images, street-view and aerial references, building references, landmark references, vehicle references, local signage
- **Geography:** maps, terrain and elevation data, geographic information
- **Audio:** ambient audio, SFX, music, NPC dialogue
- **Assets:** textures, 3D models

Until the resources arrive, build with what exists and say clearly which parts are placeholders. When the owner supplies audio, trim and compress it like the existing assets (mono AAC, `afconvert`) and wire it in.

## Most important rule

Do not reinvent Tiny World for every city. **The city changes; the quality standard does not.**

Reuse the game's existing systems wherever possible: simulation, destruction, traffic, pedestrians, emergency response, weather, audio, events, UI and performance architecture. Build new systems only when the city genuinely needs something the existing architecture cannot provide.

Every future map should feel like another fully finished Tiny World city, not another prototype.

## Map completion test

Before declaring a map finished, compare it directly against the existing finished maps on each of these:

| Area | Area | Area | Area |
|---|---|---|---|
| Density | Building detail | Street detail | Pedestrian activity |
| Vehicle activity | Businesses | Local identity | Landmarks |
| Transit | Audio | Events | Destruction compatibility |
| Background scenery | Skyline | Terrain | Small environmental details |
| Performance | | | |

Then run three final audits:

1. **Completeness:** does this feel like a finished Tiny World map?
2. **City identity:** could someone identify the city without seeing its name?
3. **Cross-contamination:** did anything from another city carry over?

If any answer is no, keep improving the map.

---

## Implementation reference: how the existing maps are built

This section is practical knowledge taken from the current code. Reuse these pieces.

### Files per map

- `js/<city>.js` exports two things:
  - **The map function `<city>(B)`.** It builds the road graph and ground (`netCtx` and `paintNetwork` from `js/mapkit.js`), adds destructible buildings with `B.add`, and fills `city.*` data. It returns `{ ...ctx, agents, fog, start, zMin, zMax, xMin, maxD, yaw, ownBackdrop, terrainH? }`.
  - **The class `<City>`.** It builds the decor hung on buildings (`hangOn`, `topOf`, `skinOn`, `deck`), the water, boats, vehicles overlay, background (`world()`), sounds, `update(dt)` and `onBlast(...)`.
- Look at these for patterns:
  - `js/vegas.js`: resorts, signs, rooftop clubs, bridges, crowds
  - `js/london.js`: sunken river and bridges, instanced background city, vehicle overlays, horses, scooters, guards, knife fights
  - `js/greenland.js`: height-field terrain, sea and icebergs, chimney smoke, football pitch

### Registration checklist

Every new map must be added to all of these:

| File | What to add |
|---|---|
| `js/main.js` | Import, `MAPS.<id>`, `MAP_NAMES`, construct the class as `G.<id>`, call `update(dt)` in `step`, `G.terrainH` if the map has terrain, and World menu label overrides |
| `js/menu.js` | A `PLACES` entry: lat, lon, flag badge (`assets/flag-*.svg`), color |
| `index.html` | A menu button with region and flag |
| `js/core.js` | `G.<id> && G.<id>.onBlast(...)` in `blast()` |
| `js/news.js` | `CHANNEL`, `CITY`, `STREETS` (one name per grid line), plus local incident wording if needed |
| `js/director.js` | `POOL` (event mix), `WEATHER`, `story()` lines |
| `js/ambience.js` | `RATES` and `BEDS` (the class crashes without them) |
| `js/sky.js` | `MAP` (planes, helicopters, birds) |
| `js/signs.js` | `NAMES` (16 shop names), `ADS_BY_MAP` (8 local ads), `STRIP3` road sign. Without these, other cities' ads leak in |
| `js/pets.js` | `DOGS` |
| `js/construction.js` | `LIMIT` and `CRANES` |
| `js/station.js` | `LOCALE`, if the map has a police HQ (`policeHQ` in `js/maps.js`) |
| `js/roles.js` | A `staff<City>()` for local roles and accessories (hats, tools) |
| `js/agents.js` | `LOOKS` for local outfits; `act` poses for crowd spots |

### Systems to reuse

- **Buildings.** `B.add({ x, z, w, d, floors, style, tint, cell, gh, fh, gable, roofTint, base, setbacks })` gives destructible cells.
  - Facade styles live in `js/textures.js` `makeFacades()`. Add a style there, and an `HP` and `ROOF` entry in `js/buildings.js`.
  - Painted trim that should keep its own color goes in the green channel of the mask.
  - Decor hung with `hangOn` or `cell.props` disappears with its cell.
  - A building resting on another uses the `rests` pattern in London.
- **People.**
  - Crowd spots (`city.crowds`: `look`, `act`, `stay`, `face`, `y`, `tag`, `speaker`) and wander zones.
  - Roles (`js/roles.js`) add uniforms, hats and tools, and run jobs: vendors, guards, staff.
- **Vehicles.**
  - `city.vehicles` sets colors, taxi share, bus kinds and moto share.
  - Local models are drawn as an overlay on the generic cars (London's `vehiclesInit` and `updateVehicles`).
- **Water.**
  - `js/water.js`: `waterMaterial()` and `addRipples()` give current ripples and boat wakes.
  - `buildPools()` turns `city.pools` and `city.ponds` into real water.
  - `gatherWakes()` collects the boats; register new boat lists there.
  - Give each water material its own `customProgramCacheKey`.
- **Events.** World events, the director, chaos incidents, responders and the news ticker are all shared. Change only the local wording and behavior: for example, London has knife fights instead of shootings.
- **Audio.**
  - `SFX_FILES` and `sfx.once`/`sfx.loop` in `js/audio.js`.
  - `beachRadio.setList()` plays local music from spots in the world.
  - Recorded dialogue clips (`CLIPS`) can be made map-specific.
- **Terrain.** Return `terrainH` from the map. Buildings, people, pets and raycasts all follow it (see Sisimiut).
- **Raycasts.** `G.rayExtra` lets non-building objects, such as icebergs and the sea surface, be weapon targets. It is reset on every map load.

### Pitfalls already hit (don't repeat them)

- An empty geometry list passed to `merged()` crashes. Guard with `if (P.length)`.
- Materials whose `onBeforeCompile` code text is identical share one compiled shader unless they have a `customProgramCacheKey`.
- `smoothstep(edge0, edge1, x)` with `edge0 > edge1` is undefined in GLSL. Use `1.0 - smoothstep(a, b, x)`.
- Setting `city.shoreX` creates the San Diego harbor (cruise ships). Only the Gaslamp map should set it.
- World snow puts a flat white layer over the whole map, water included. Turn it off where the ground is already snowy (`js/world.js`).
- Faint effects can vanish against snow or light ground. Test them visibly.
- Check that no other city's ads, signs, road signs or landmark signs show up. `js/signs.js` falls back to San Diego defaults.
- Testing: the browser pane throttles `requestAnimationFrame` when hidden. Drive frames with `G.step(dt)`, and measure cost with `gl.finish()` rather than the on-screen FPS counter.
