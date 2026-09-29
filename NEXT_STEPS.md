# Tiny World — where we left off

## Done (2026-09-28)
- **Petco Park** tested and tuned (bigger field, calmer crowd, Western Metal behind the left-field wall, plaza sign).
- **Harbor**: detailed cruise ships (lit balconies, bridge wings, funnel, lido deck + slide, lifeboats), glass terminals,
  gangways, bollards, fenders, tour buses; bridge traffic with cars, trucks and buses with head/tail lights.
- **Chicago, Illinois** (was Glockton): dense run-down walk-up neighbourhood with alleys, garages, vacant lots,
  boarded/fire-scarred buildings, corner stores, a courtyard building and potholed streets. Illinois flag in `assets/`.
- **Random incidents** (`js/chaos.js`): car crashes and street shootings, emergency response, scenes clear and
  wrecks get towed. Settings > World > Random incidents (Off / Low / Normal / High).
- **Summer Smash** (`js/concert.js`) in Chicago: drill beat (muffled, quiet), 7k-fan jumping crowd, performers, beams, pyro.
  Only player weapons make the crowd evacuate (gate + two emergency exits, around the stands, out to the street).
- Artifact republished: https://claude.ai/artifact/71DVzhiQHyfQR28ge9C7TV

## Publishing
Strip doctype/html/head/meta/body lines from index.html (add `color-scheme:dark` to `:root`), then publish that page
to the artifact URL with `js/*` and `assets/*` as supporting files.

## Notes
- Run locally with `Start Tiny World.command`. Git history has every step.
