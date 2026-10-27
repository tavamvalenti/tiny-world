// SAN DIEGO BAY, the shape of it (world units: +x east, +z south; the Gaslamp grid sits at -66..66).
// Traced from the satellite view and squeezed so the whole bay fits one map:
//   - the mainland shore: the downtown seawall (x = -74), then south-east past Barrio Logan to Naval Base San Diego
//   - Coronado: Naval Air Station North Island to the north, the village in the middle, the Hotel del on the ocean
//     beach at the south end, the Silver Strand running on south-east until the map stops
//   - the Coronado Bridge: a high curve from Barrio Logan (over Chicano Park) across the bay to the village
// Everything west of the island is the Pacific; there is no Point Loma.

// the mainland's shoreline: land is east of this (x > sdShoreX(z))
const SHORE = [[-999, -74], [70, -74], [96, -62], [122, -48], [150, -32], [182, -16], [220, -2], [262, 10], [320, 22], [999, 30]];
export function sdShoreX(z) {
  for (let i = 1; i < SHORE.length; i++) {
    const [z0, x0] = SHORE[i - 1], [z1, x1] = SHORE[i];
    if (z <= z1) return x0 + (x1 - x0) * (z - z0) / (z1 - z0);
  }
  return SHORE[SHORE.length - 1][1];
}

// Coronado Island (with North Island) and the start of the Silver Strand, clockwise from the bay side of North Island
export const CORONADO = [
  [-150, -78], [-139, -46], [-136, -8], [-138, 30], [-144, 70], [-146, 98],          // North Island's bay shore (the carrier piers)
  [-142, 122], [-136, 146], [-138, 168],                                                // the village's bay front, the bridge comes down here
  [-150, 182], [-163, 190], [-164, 206], [-150, 216],                                   // Glorietta Bay
  [-136, 234], [-118, 262], [-100, 296], [-94, 320],                                    // the Strand, bay side
  [-112, 320], [-122, 298], [-140, 268], [-160, 252], [-186, 249], [-214, 245],       // the Strand, ocean side, to the Hotel del
  [-242, 233], [-264, 212], [-280, 184], [-288, 150],                                   // Central Beach round to the north-west
  [-292, 110], [-292, 64], [-286, 18], [-274, -22], [-256, -56], [-230, -80], [-200, -94], [-172, -92],   // North Island's ocean side
];
export function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export const onCoronado = (x, z) => inPoly(CORONADO, x, z);
// North Island (the naval air station) is the island north of the fence along z = NAS_FENCE
export const NAS_FENCE = 96;
export const onNAS = (x, z) => z < NAS_FENCE && onCoronado(x, z);
// Naval Base San Diego: the mainland south of the bridge (Gate 7 on Harbor Drive at the north end)
export const NBSD = { z0: 186, z1: 318, x1: 108 };
export const onNBSD = (x, z) => z > NBSD.z0 && z < NBSD.z1 && x > sdShoreX(z) - 0.5 && x < NBSD.x1;
export const onMainland = (x, z) => x > sdShoreX(z);
export const isLand = (x, z) => onMainland(x, z) || onCoronado(x, z);

// the whole San Diego world (the second ground, the water mask, the camera)
export const WORLD = { x0: -300, x1: 110, z0: -105, z1: 305 };

// the Coronado Bridge: deck centre line (x, deck height, z), Barrio Logan end first
export const BRIDGE = [[44, 0.25, 110], [30, 2.8, 113], [12, 6.2, 121], [-12, 10.5, 133], [-42, 15.5, 147], [-76, 20, 158],
  [-106, 19, 158], [-126, 14, 150], [-140, 8, 140], [-149, 3, 134], [-154, 0.25, 132]];
// the street corners it joins (Barrio Logan, Coronado)
export const BRIDGE_ENDS = [[44, 110], [-154, 132]];
// Chicano Park: under the bridge's Barrio Logan approach
export const CHICANO = { x0: 0, x1: 44, z0: 108, z1: 132 };
export const BRIDGE_W = 3.8;
// the village, where its street grid runs (the bridge lands at its north-east corner)
export const VILLAGE = { x0: -264, x1: -154, z0: 110, z1: 198 };
// the Hotel del Coronado's grounds, on the ocean front at the south end of the village
export const HOTEL = { x: -205, z: 226, w: 44, d: 16 };
