# North County map data

`js/ncdata.js` (Carlsbad & Oceanside) is generated from OpenStreetMap (© OpenStreetMap contributors, ODbL).

1. Download three Overpass extracts into a folder (keep them out of the repo):
   - `all.json`: roads, rail, coastline, water, waterways, piers, beaches for bbox `33.135,-117.385,33.215,-117.30`
   - `poi.json`: stations, schools, parks, hotels, museums, civic buildings (`out center tags`)
   - `harbor.json`: every `highway` way in `33.196,-117.405,33.216,-117.375` (the harbor reaches past the first bbox)
2. `python3 -I gen.py <folder> nc.json` turns them into metres in a frame turned 34.85° so the coast runs along z.
3. `python3 -I build.py nc.json ../../js/ncdata.js` maps that to game units (5.5 m per unit; two stretches squeezed along the
   coast and the ground past I-5 squeezed inland), snaps the streets that run on the grid into the road lattice, and
   writes the module.

`roads.html` (serve the repo root, open `/tools/northcounty/roads.html`) draws every OSM street faintly under the streets the map
keeps (`ROADS` in js/northcounty.js) and the bridges; `?z0=&z1=&k=` picks the stretch and the scale. `refs/` holds the
owner's reference photos.
