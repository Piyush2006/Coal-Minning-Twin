// ── Procedural mechanical detail kit ─────────────────────────────────────────
// Reusable generators for the small "machine furniture" that makes equipment read
// as real: bolt circles, flanged joints, stiffener ribs, handrails, ladders,
// gauges, valve handwheels, nameplates. Each returns an ARRAY of plain Component
// Spec parts (geometry/dims/position/rotation/material) — spread them into any
// spec's `parts` (templates, Studio, AI). Keep counts modest: these are low-poly
// on purpose (bolts render at 8 segments etc. via standard primitives).

let _n = 0
const id = (tag) => `dk_${tag}_${++_n}`
const part = (tag, label, geometry, dims, position, extra = {}) => ({
  id: id(tag), label, geometry, dims, position,
  rotation: extra.rot || [0, 0, 0], scale: [1, 1, 1],
  material: extra.mat || { color: '#6b7280', metalness: 0.8, roughness: 0.4 },
  ...(extra.animate ? { animate: extra.animate } : {}),
})

const DK_STEEL = { color: '#7a828c', metalness: 0.85, roughness: 0.35, finish: 'brushedMetal' }
const DK_DARK  = { color: '#3c434c', metalness: 0.7,  roughness: 0.45 }
const DK_SAFE  = { color: '#e8b53a', metalness: 0.3,  roughness: 0.55, finish: 'paintedSteel' }

// Ring of n bolt heads on a horizontal circle (axis='y') or vertical face (axis='z'/'x').
export function boltCircle({ center, r, n = 8, axis = 'y', boltR = 0.045, boltH = 0.07, mat = DK_DARK }) {
  const out = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const dx = Math.cos(a) * r, dz = Math.sin(a) * r
    const pos = axis === 'y' ? [center[0] + dx, center[1], center[2] + dz]
      : axis === 'x' ? [center[0], center[1] + dx, center[2] + dz]
      : [center[0] + dx, center[1] + dz, center[2]]
    const rot = axis === 'y' ? [0, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
    out.push(part('bolt', 'Bolt', 'cylinder', { radius: boltR, height: boltH }, pos, { rot, mat }))
  }
  return out
}

// Bolted flange joint: disc + bolt ring. axis as boltCircle.
export function flangeJoint({ center, r, thick = 0.08, bolts = 8, axis = 'y', mat = DK_STEEL }) {
  const rot = axis === 'y' ? [0, 0, 0] : axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]
  return [
    part('flange', 'Flange', 'cylinder', { radius: r, height: thick }, center, { rot, mat }),
    ...boltCircle({ center, r: r * 0.82, n: bolts, axis, boltR: Math.max(0.03, r * 0.07), boltH: thick + 0.03 }),
  ]
}

// Vertical stiffener ribs along a face. from/to are [x,y,z] endpoints of the run.
export function ribs({ from, to, count = 4, height = 1, thick = 0.06, depth = 0.12, mat = DK_STEEL }) {
  const out = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const p = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + height / 2, from[2] + (to[2] - from[2]) * t]
    out.push(part('rib', 'Stiffener Rib', 'box', { width: thick, height, depth }, p, { mat }))
  }
  return out
}

// Straight handrail run (safety yellow): top + mid rail and posts.
// from/to = [x,y,z] at WALKING level (rails sit above it).
export function handrail({ from, to, h = 1.05, postEvery = 1.6, railR = 0.035, mat = DK_SAFE }) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]
  const len = Math.hypot(dx, dy, dz) || 1
  const yaw = Math.atan2(dz, dx)
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
  const rot = [0, -yaw, Math.PI / 2]
  const out = [
    part('rail', 'Handrail Top', 'cylinder', { radius: railR, height: len }, [mid[0], mid[1] + h, mid[2]], { rot, mat }),
    part('rail', 'Handrail Mid', 'cylinder', { radius: railR * 0.8, height: len }, [mid[0], mid[1] + h * 0.55, mid[2]], { rot, mat }),
  ]
  const posts = Math.max(2, Math.round(len / postEvery) + 1)
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1)
    out.push(part('post', 'Handrail Post', 'cylinder', { radius: railR, height: h },
      [from[0] + dx * t, from[1] + dy * t + h / 2, from[2] + dz * t], { mat }))
  }
  return out
}

// Vertical access ladder against a face at (x,z), climbing y0→y1.
export function ladder({ x, z, y0 = 0, y1 = 4, width = 0.45, mat = DK_STEEL, rungEvery = 0.32 }) {
  const h = y1 - y0, cy = y0 + h / 2
  const out = [
    part('ladder', 'Ladder Rail L', 'cylinder', { radius: 0.03, height: h }, [x - width / 2, cy, z], { mat }),
    part('ladder', 'Ladder Rail R', 'cylinder', { radius: 0.03, height: h }, [x + width / 2, cy, z], { mat }),
  ]
  for (let y = y0 + rungEvery; y < y1; y += rungEvery) {
    out.push(part('rung', 'Rung', 'cylinder', { radius: 0.02, height: width }, [x, y, z], { rot: [0, 0, Math.PI / 2], mat }))
  }
  return out
}

// Round dial gauge on a face (dial + pulsing needle hub).
export function gauge({ pos, r = 0.16, mat = { color: '#e8edf2', metalness: 0.2, roughness: 0.3 }, face = 'z' }) {
  const rot = face === 'z' ? [Math.PI / 2, 0, 0] : face === 'x' ? [0, 0, Math.PI / 2] : [0, 0, 0]
  return [
    part('gauge', 'Gauge', 'cylinder', { radius: r, height: 0.06 }, pos, { rot, mat }),
    part('gauge', 'Gauge Hub', 'cylinder', { radius: r * 0.22, height: 0.09 }, pos,
      { rot, mat: { color: '#c2382e', metalness: 0.3, roughness: 0.4, emissive: '#c2382e', emissiveIntensity: 0.4 }, animate: { kind: 'pulse', speedKey: 'speed' } }),
  ]
}

// Valve handwheel: rim + spokes + stem, on a vertical stem at pos.
export function valveWheel({ pos, r = 0.22, mat = { color: '#b8483a', metalness: 0.4, roughness: 0.5, finish: 'paintedSteel' } }) {
  return [
    part('valve', 'Handwheel', 'torus', { radius: r, tube: r * 0.14 }, pos, { rot: [Math.PI / 2, 0, 0], mat, animate: { kind: 'spinY', speedKey: 'speed' } }),
    part('valve', 'Wheel Spoke A', 'box', { width: r * 2, height: 0.04, depth: 0.04 }, pos, { mat }),
    part('valve', 'Wheel Spoke B', 'box', { width: 0.04, height: 0.04, depth: r * 2 }, pos, { mat }),
    part('valve', 'Valve Stem', 'cylinder', { radius: 0.04, height: 0.3 }, [pos[0], pos[1] - 0.15, pos[2]], { mat: DK_STEEL }),
  ]
}

// Equipment nameplate — small plaque on a face.
export function nameplate({ pos, w = 0.6, h = 0.28, mat = { color: '#dfe4ea', metalness: 0.6, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }) {
  return [part('plate', 'Nameplate', 'box', { width: w, height: h, depth: 0.03 }, pos, { mat })]
}

// Electrical junction box with conduit stub.
export function junctionBox({ pos, mat = DK_DARK }) {
  return [
    part('jbox', 'Junction Box', 'roundedBox', { width: 0.34, height: 0.44, depth: 0.18, bevel: 0.02 }, pos, { mat }),
    part('jbox', 'Conduit', 'cylinder', { radius: 0.035, height: 0.8 }, [pos[0], pos[1] - 0.6, pos[2]], { mat: DK_STEEL }),
  ]
}
