import * as THREE from 'three'

export const v2 = (x, y) => new THREE.Vector2(x, y)

/** Flanged spool/drum lathe profile */
export function drumProfile(inner, barrel, flange, halfH, ft) {
  return [
    [inner,  -(halfH + ft)], [inner,  -halfH],
    [flange, -halfH],        [flange, -(halfH - ft)],
    [barrel, -(halfH - ft * 2)],
    [barrel,  (halfH - ft * 2)],
    [flange,  (halfH - ft)], [flange,  halfH],
    [inner,   halfH],        [inner,   (halfH + ft)],
  ].map(([x, y]) => new THREE.Vector2(x, y))
}

/** Helix curve for screw/coil geometry */
export function helixCurve(radius, height, turns, steps = 160) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = t * turns * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height - height / 2, Math.sin(a) * radius))
  }
  return new THREE.CatmullRomCurve3(pts)
}
