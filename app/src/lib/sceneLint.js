// ─────────────────────────────────────────────────────────────────────────────
// Scene lint — layout sanity checks on a freshly assembled (validated) Twin
// Spec, before it's loaded. Catches what the model gets wrong when placing
// blind: machines clipping into each other, stacked placements, and hero
// equipment left unconnected. Defects go back to the assemble step for one
// corrective round.
// ─────────────────────────────────────────────────────────────────────────────
import { specBounds, formatDefects } from './componentLint'

export { formatDefects }

// Union AABB of a custom-spec asset in world space (coarse; yaw ≈ 90° swaps X/Z).
function assetAABB(obj, spec) {
  let b = specBounds(spec)
  if (!b) return null
  b = [...b]
  const yaw = (obj.rotation || [0, 0, 0])[1] || 0
  if (Math.abs(Math.abs(yaw) - Math.PI / 2) < 0.3) {
    const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2
    const hx = (b[3] - b[0]) / 2, hz = (b[5] - b[2]) / 2
    b = [cx - hz, b[1], cz - hx, cx + hz, b[4], cz + hx]
  }
  const [x, y, z] = obj.position || [0, 0, 0]
  return [b[0] + x, b[1] + y, b[2] + z, b[3] + x, b[4] + y, b[5] + z]
}

const SKIP_LAYERS = new Set(['structural', 'annotations', 'conveyors', 'piping'])

export function lintScene(scene, customAssetTypes = {}) {
  const defects = []
  const add = (code, message) => defects.push({ code, severity: 'error', message })
  const objects = Object.values(scene?.objects || {})
  const types = { ...(customAssetTypes || {}), ...(scene?.customAssetTypes || {}) }

  // machines = placed custom-spec assets on the equipment layer
  const machines = objects.filter(o => {
    const t = types[o.type]
    return t?.parts?.length && !SKIP_LAYERS.has(t.layer ?? o.layer ?? 'equipment')
  })

  // 1. pairwise overlap / clearance — prescriptive, with numbers the model can
  // apply directly (the corrective round works far better as arithmetic).
  for (let i = 0; i < machines.length; i++) for (let j = i + 1; j < machines.length; j++) {
    const A = machines[i], B = machines[j]
    const a = assetAABB(A, types[A.type])
    const b = assetAABB(B, types[B.type])
    if (!a || !b) continue
    if (Math.min(a[4], b[4]) - Math.max(a[1], b[1]) <= 0) continue   // no vertical overlap
    const ovX = Math.min(a[3], b[3]) - Math.max(a[0], b[0])
    const ovZ = Math.min(a[5], b[5]) - Math.max(a[2], b[2])
    if (ovX > 0.15 && ovZ > 0.15) {
      const [axis, ov] = ovX <= ovZ ? ['X', ovX] : ['Z', ovZ]
      add('overlap', `"${A.id}" (${A.type}) INTERSECTS "${B.id}" (${B.type}) — footprints overlap ${ovX.toFixed(1)} m on X × ${ovZ.toFixed(1)} m on Z; move "${B.id}" at least ${(ov + 3).toFixed(1)} m further on ${axis}`)
    } else {
      const gap = Math.hypot(Math.max(0, -ovX), Math.max(0, -ovZ))
      if (gap < 0.5) add('clearance', `"${A.id}" and "${B.id}" are only ${gap.toFixed(1)} m apart — machines need a 3–6 m conveyor run in-line or a ≥2 m aisle; spread them out`)
    }
  }

  // 2. stacked / near-identical positions (any two placed objects)
  for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
    const a = objects[i].position || [0, 0, 0], b = objects[j].position || [0, 0, 0]
    const d = Math.hypot(a[0] - b[0], a[2] - b[2])
    if (d < 0.5 && objects[i].type === objects[j].type) add('stacked', `"${objects[i].id}" and "${objects[j].id}" (both ${objects[i].type}) sit at the same spot — space them out`)
  }

  // 3. declared ports but no connection in either direction
  const connected = new Set()
  for (const o of objects) for (const c of o.connections || []) { connected.add(o.id); connected.add(c.targetId) }
  for (const o of machines) {
    const ports = types[o.type]?.ports || []
    if (ports.length && !connected.has(o.id)) add('unconnected', `"${o.id}" (${o.type}) declares ports (${ports.map(p => p.id).join(', ')}) but has NO connection — wire it into the line (upstream out → its in, its out → downstream in)`)
  }

  return { defects, errors: defects }
}
