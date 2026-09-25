# Tiny World — where we left off

## In progress (code written, NOT yet tested in the browser)
- **Petco Park** in Gaslamp District (`js/petco.js`, wired into `maps.js`, `main.js`, `signs.js`, `ambience.js`).
  Takes the 2x2 block site in the south-east (blocks 4,4 / 5,4 / 4,5 / 5,5); streets inside are closed via `city.closeArea()`.
  Includes seating bowl, light towers, PADRES video board, Western Metal Supply Co. building, berm, crowd cheers.
  -> Next: load `?map=downtown`, check for console errors, look at it, tune positions/sizes.

## Still to do from the last requests
1. Higher-quality **cruise ships, docks/terminal and bridge cars** in `js/harbor.js`
   (balcony-textured superstructure, bridge wings, funnel, pool deck, lifeboats; bollards, fenders, glass terminal,
   gangways, buses; bridge traffic using `carGeos()` exported from `agents.js` with head/tail lights and trucks/buses).
2. **Glockton** rebuild to look like a dense, run-down Chicago-style neighbourhood (reference photo in chat):
   brick 2-3 flat walk-ups close together, flat roofs, rear alleys with garages, weathered/boarded buildings
   (pre-set cell damage/soot), vacant lots, fences, dumpsters, potholes.
3. **Random civilian incidents** in all maps (new `js/chaos.js`): car crashes and shootings (non-graphic:
   gunshot sounds, muzzle flashes, people flee / knocked down), police + ambulances respond via `G.emergency.report()`.
   Add a Settings option "Random incidents: Off / Low / Normal / High".
4. After all of the above: test every map, commit, then republish the artifact
   (https://claude.ai/artifact/71DVzhiQHyfQR28ge9C7TV) using the build steps (strip doctype/head/body from index.html,
   copy js/ + assets/, publish tiny-world.html with root + files list).

## Notes
- SD logo: game looks for `assets/sd-logo.png` (user still needs to save the image there).
- Run locally with `Start Tiny World.command`. Git history has every step.
