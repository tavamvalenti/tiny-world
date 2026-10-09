// Solid things that aren't made of building cells (the London Eye's rim, hub and legs; flagpoles; poles): Rick's ship
// and the vehicles collide with them like walls, and they can be knocked down or broken.
// Each solid: { test(p) -> { n, pen } | null (n: world normal out of it), hit?(p, speed), alive }
import * as THREE from 'three';

export const solids = [];
export function clearSolids() { solids.length = 0; }
export function solidHit(p) {
  for (const s of solids) { if (s.alive === false) continue; const r = s.test(p); if (r) return { ...r, solid: s }; }
  return null;
}
// a capsule (pole, strut) from a to b, radius r
export function capsuleTest(a, b, r) {
  const ab = new THREE.Vector3().subVectors(b, a), L2 = ab.lengthSq(), q = new THREE.Vector3();
  return (p) => {
    const t = Math.max(0, Math.min(1, q.subVectors(p, a).dot(ab) / L2));
    const c = a.clone().addScaledVector(ab, t), d = p.clone().sub(c), dist = d.length();
    if (dist >= r) return null;
    return { n: dist > 1e-6 ? d.multiplyScalar(1 / dist) : new THREE.Vector3(0, 1, 0), pen: r - dist };
  };
}
