// ─────────────────────────────────────────────────────────────────────────────
// Component-spec lint — the app's half of the Bruce feedback loop. Pure JS
// physical sanity checks on an authored Component Spec (same math family as
// scripts/validate-template.mjs, plus WORLD-SPACE resolution: group children
// use parent-relative positions, so we accumulate position×scale up the
// parentId chain before AABB'ing). Defects are fed back to the model as a
// lint report for one corrective round.
// ─────────────────────────────────────────────────────────────────────────────

// Coarse half-extents for one part in its LOCAL frame (rotation only handled
// as 90° axis swaps — good enough to catch floaters/clipping, not exact).
function halfExtents(p) {
  const d = p.dims || {}
  let hx, hy, hz
  if (p.geometry === 'box' || p.geometry === 'roundedBox' || p.geometry === 'ibeam') {
    hx = (d.width ?? 1) / 2; hy = (d.height ?? 1) / 2; hz = (d.depth ?? 1) / 2
  } else if (p.geometry === 'sphere') hx = hy = hz = d.radius ?? 0.5
  else if (p.geometry === 'torus') { hx = hz = (d.radius ?? 0.5) + (d.tube ?? 0.1); hy = d.tube ?? 0.1 }
  else { hx = hz = d.radius ?? 0.5; hy = (d.height ?? 1) / 2 }   // cylinder/capsule/vessel/cone
  const r = p.rotation || [0, 0, 0]
  if (Math.abs(Math.abs(r[2]) - Math.PI / 2) < 0.2) [hx, hy] = [hy, hx]
  if (Math.abs(Math.abs(r[0]) - Math.PI / 2) < 0.2) [hy, hz] = [hz, hy]
  return [hx, hy, hz]
}

// World AABBs for every geometry part, resolving the parentId chain
// (position scaled by ancestor scale; group rotation ignored — coarse).
export function partWorldBoxes(spec) {
  const parts = spec?.parts || []
  const byId = Object.fromEntries(parts.map(p => [p.id, p]))
  const world = (p) => {
    let x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1
    const chain = []
    for (let n = p, guard = 0; n && guard < 32; n = byId[n.parentId], guard++) chain.unshift(n)
    for (const n of chain) {
      const pos = n.position || [0, 0, 0]
      x += pos[0] * sx; y += pos[1] * sy; z += pos[2] * sz
      const s = n.scale || [1, 1, 1]
      sx *= s[0] ?? 1; sy *= s[1] ?? 1; sz *= s[2] ?? 1
    }
    return { x, y, z, sx, sy, sz }
  }
  const out = []
  for (const p of parts) {
    if (p.kind) continue   // group/logical/component/model — no own geometry
    const w = world(p)     // w.s* already includes the part's own scale
    const [hx0, hy0, hz0] = halfExtents(p)
    const hx = hx0 * Math.abs(w.sx), hy = hy0 * Math.abs(w.sy), hz = hz0 * Math.abs(w.sz)
    out.push({ part: p, box: [w.x - hx, w.y - hy, w.z - hz, w.x + hx, w.y + hy, w.z + hz] })
  }
  return out
}

// Union AABB of a whole spec (local space) → [minX,minY,minZ,maxX,maxY,maxZ] | null.
export function specBounds(spec) {
  let b = null
  for (const { box } of partWorldBoxes(spec)) {
    b = b ? [Math.min(b[0], box[0]), Math.min(b[1], box[1]), Math.min(b[2], box[2]),
             Math.max(b[3], box[3]), Math.max(b[4], box[4]), Math.max(b[5], box[5])] : [...box]
  }
  return b
}

export const boxOverlap = (a, b) =>
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[4], b[4]) - Math.max(a[1], b[1])) *
  Math.max(0, Math.min(a[5], b[5]) - Math.max(a[2], b[2]))

// Parts that legitimately float / sit on curved surfaces / drift.
const INTENDED_FLOATER = /bolt|smoke|steam|vapour|vapor|beacon|rung|wisp|puff|plume|drip|label|decal|spray/i

export function lintComponentSpec(spec) {
  const defects = []
  const add = (code, severity, message, partId) => defects.push({ code, severity, message, partId })
  const parts = spec?.parts || []
  const geoParts = parts.filter(p => !p.kind)
  const boxes = partWorldBoxes(spec)

  for (const { part: p, box: b } of boxes) {
    // below floor
    if (b[1] < -0.05) add('below-floor', 'error', `part "${p.label || p.id}" extends below the floor (bottom y=${b[1].toFixed(2)}) — raise it or shrink it`, p.id)
    // degenerate / giant dims
    const dims = Object.values(p.dims || {})
    if (dims.some(v => typeof v === 'number' && v > 50)) add('degenerate-dims', 'warn', `part "${p.label || p.id}" has a dimension > 50 m — implausible for one machine`, p.id)
  }

  // floating: nothing beneath/adjacent within tolerance
  for (const { part: p, box: b } of boxes) {
    if (b[1] < 0.25) continue                                   // touches/near ground
    if (INTENDED_FLOATER.test(p.label || p.id || '')) continue
    if (p.animate && (p.animate.kind === 'rise' || p.animate.kind === 'bob')) continue
    const grown = [b[0] - 0.06, b[1] - 0.14, b[2] - 0.06, b[3] + 0.06, b[4] + 0.14, b[5] + 0.06]
    const touches = boxes.some(({ part: q, box: o }) => q !== p && boxOverlap(grown, o) > 0)
    if (!touches) add('floating', 'error', `part "${p.label || p.id}" floats in mid-air (y ${b[1].toFixed(2)}..${b[4].toFixed(2)}) with no support below or beside it — add a support/leg/bracket or attach it to the body`, p.id)
  }

  // z-fight: coplanar faces between box-family parts, neither offset
  const boxFamily = boxes.filter(({ part: p }) => ['box', 'roundedBox', 'ibeam'].includes(p.geometry))
  for (let i = 0; i < boxFamily.length; i++) for (let j = i + 1; j < boxFamily.length; j++) {
    const A = boxFamily[i], B = boxFamily[j]
    if (A.part.material?.polygonOffset || B.part.material?.polygonOffset) continue
    for (const axis of [0, 1, 2]) {
      const [lo, hi] = [axis, axis + 3]
      // SAME-side faces only (two tops / two fronts): both visible → real fight.
      // Opposite-face contact (a part resting ON another) is benign stacking.
      const faces = [[A.box[lo], B.box[lo]], [A.box[hi], B.box[hi]]]
      const coplanar = faces.some(([fa, fb]) => Math.abs(fa - fb) < 0.005)
      if (!coplanar) continue
      const others = [0, 1, 2].filter(a => a !== axis)
      const overlapsOther = others.every(a =>
        Math.min(A.box[a + 3], B.box[a + 3]) - Math.max(A.box[a], B.box[a]) > 0.01)
      if (overlapsOther) {
        add('z-fight', 'warn', `parts "${A.part.label || A.part.id}" and "${B.part.label || B.part.id}" have exactly coplanar faces — inset one by ≥0.02 or give the thin one polygonOffset`, A.part.id)
        break
      }
    }
  }

  // duplicates: identical geometry+dims+world position
  const sig = new Map()
  for (const { part: p, box: b } of boxes) {
    const k = `${p.geometry}|${JSON.stringify(p.dims)}|${b.map(v => v.toFixed(2)).join(',')}`
    if (sig.has(k)) add('dup-part', 'warn', `parts "${sig.get(k)}" and "${p.label || p.id}" are identical shapes at the identical position — remove one or move it`, p.id)
    else sig.set(k, p.label || p.id)
  }

  // whole-spec checks
  if (!parts.some(p => p.animate?.kind && p.animate.kind !== 'none')) add('no-animation', 'warn', 'no part is animated — real machines move; add spin/bob to the working element')
  if ((spec?.layer ?? 'equipment') === 'equipment' && !(spec?.ports || []).length) add('no-ports', 'warn', 'no ports declared — equipment must expose its process connections (in/out)')
  if (geoParts.length < 8) add('thin', 'warn', `only ${geoParts.length} geometry parts — too basic; compose the real machine (frame, body, stations, furniture)`)

  return { defects, errors: defects.filter(d => d.severity === 'error') }
}

export function formatDefects(defects) {
  return defects.map(d => `- [${d.code}] ${d.message}`).join('\n')
}
