// Plant template validator — run after ANY template edit (node scripts/validate-template.mjs).
// Checks the classes of defect the user kept catching by screenshot:
//   1. CONTINUITY  — every FlowConveyor end sits INSIDE a machine footprint (tuck ≥ 0.15 m)
//   2. OVERLAP     — no cross-asset AABB intersections beyond whitelisted pass-throughs
//   3. FLOATING    — every spec part touches ground/foundation/another part (nothing hovers)
// Exit code 1 on any failure.
import { execSync } from 'child_process'
import fs from 'fs'

const ROOT = new URL('..', import.meta.url).pathname
// extensionless-import shim (template imports '../pipeMedia' etc.)
for (const f of ['pipeMedia', 'detailKit']) {
  const link = `${ROOT}src/lib/${f}`
  try { fs.symlinkSync(`${f}.js`, link) } catch {}
}
const cleanup = () => { for (const f of ['pipeMedia', 'detailKit']) { try { fs.unlinkSync(`${ROOT}src/lib/${f}`) } catch {} } }

const { BOTTLING_PLANT } = await import(`${ROOT}src/lib/templates/bottlingPlant.js`)
const { objects, customAssetTypes } = BOTTLING_PLANT()
let fails = 0
const fail = (m) => { fails++; console.log('✗', m) }
const ok = (m) => console.log('✓', m)

// ── helpers: world AABB of a placed asset (from its spec parts, coarse) ──
function partAABB(p) {
  const d = p.dims || {}
  let hx, hy, hz
  if (p.geometry === 'box' || p.geometry === 'roundedBox') { hx = (d.width ?? 1) / 2; hy = (d.height ?? 1) / 2; hz = (d.depth ?? 1) / 2 }
  else if (p.geometry === 'sphere') hx = hy = hz = d.radius ?? 0.5
  else if (p.geometry === 'torus') { hx = hz = (d.radius ?? 0.5) + (d.tube ?? 0.1); hy = d.tube ?? 0.1 }
  else if (p.geometry === 'ibeam') { hx = (d.width ?? 0.3) / 2; hy = (d.height ?? 0.4) / 2; hz = (d.depth ?? 2) / 2 }
  else { hx = hz = d.radius ?? 0.5; hy = (d.height ?? 1) / 2 }
  // coarse: ignore rotation for slender parts; swap for 90° X/Z rotations
  const r = p.rotation || [0, 0, 0]
  if (Math.abs(Math.abs(r[2]) - Math.PI / 2) < 0.2) [hx, hy] = [hy, hx]
  if (Math.abs(Math.abs(r[0]) - Math.PI / 2) < 0.2) [hy, hz] = [hz, hy]
  const c = p.position || [0, 0, 0]
  return [c[0] - hx, c[1] - hy, c[2] - hz, c[0] + hx, c[1] + hy, c[2] + hz]
}
function assetAABB(o) {
  const spec = customAssetTypes[o.type]
  if (!spec) return null
  let box = null
  for (const p of spec.parts || []) {
    if (p.kind === 'group' || p.kind === 'logical') continue
    const b = partAABB(p)
    box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.min(box[2], b[2]),
                 Math.max(box[3], b[3]), Math.max(box[4], b[4]), Math.max(box[5], b[5])] : b
  }
  if (!box) return null
  const [x, y, z] = o.position
  return [box[0] + x, box[1] + y, box[2] + z, box[3] + x, box[4] + y, box[5] + z]
}
const inter = (a, b) => Math.max(0, Math.min(a[3], b[3]) - Math.max(a[0], b[0]))
  * Math.max(0, Math.min(a[4], b[4]) - Math.max(a[1], b[1]))
  * Math.max(0, Math.min(a[5], b[5]) - Math.max(a[2], b[2]))

// ── 1. continuity: FlowConveyor ends inside machine footprints ──
const FOOT = {   // machine → half-width of the swallowing body along X
  bp_depal: 2.0, bp_filler: 3.5, bp_labeller: 2.1, bp_case_packer: 2.1,
}
const machines = Object.values(objects).filter(o => FOOT[o.type])
for (const o of Object.values(objects).filter(o => o.type === 'FlowConveyor')) {
  const s = o.position[0], e = s + (o.config.length ?? 8)
  for (const [label, x] of [['start', s], ['end', e]]) {
    const host = machines.find(m => x > m.position[0] - FOOT[m.type] + 0.15 && x < m.position[0] + FOOT[m.type] - 0.15)
    host ? ok(`${o.id} ${label} tucked in ${host.id}`) : fail(`${o.id} ${label} (x=${x.toFixed(1)}) is BARE — not inside any machine`)
  }
}

// ── 2. cross-asset overlap (machines/structures only; conveyors + markup pass) ──
const SKIP = new Set(['FlowConveyor', 'bp_pipe_rack', 'bp_hall', 'bp_office', 'bp_parking', 'bp_green'])
const solid = Object.values(objects).filter(o => customAssetTypes[o.type] && !SKIP.has(o.type))
for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
  const a = assetAABB(solid[i]), b = assetAABB(solid[j])
  if (!a || !b) continue
  const v = inter(a, b)
  if (v > 0.5) fail(`OVERLAP ${solid[i].id} × ${solid[j].id} (${v.toFixed(2)} m³)`)
}
ok(`overlap scan: ${solid.length} assets pairwise`)

// ── 3. floating parts: each part touches ground/foundation/another part ──
for (const id in customAssetTypes) {
  const parts = (customAssetTypes[id].parts || []).filter(p => !p.kind)
  const boxes = parts.map(partAABB)
  let floaters = 0
  const INTENDED = /bolt|loose bottle|rung|smoke|vapour|steam wisp|vent steam|caro |chute bottle|web |wrap film|beacon/i
  parts.forEach((p, i) => {
    const b = boxes[i]
    if (INTENDED.test(p.label || '')) return      // by-design floaters / curved-surface hardware
    if (b[1] < 0.25) return                       // touches ground
    const touches = boxes.some((o2, j) => j !== i &&
      inter([b[0] - 0.06, b[1] - 0.12, b[2] - 0.06, b[3] + 0.06, b[4] + 0.12, b[5] + 0.06], o2) > 0)
    if (!touches) { floaters++; if (floaters <= 2) fail(`${id}: "${p.label}" floats (y ${b[1].toFixed(2)}..${b[4].toFixed(2)})`) }
  })
  if (!floaters) ok(`${id}: no floating parts (${parts.length})`)
}

cleanup()
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL CHECKS PASSED')
process.exit(fails ? 1 : 0)
