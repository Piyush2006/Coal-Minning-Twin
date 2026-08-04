// Dev-time path validator + generator for every PathDrive mover.
//
//   node scripts/validate-paths.mjs            # validate paths in the twin spec
//   node scripts/validate-paths.mjs --write    # ALSO write generated paths + dumpAt into the spec
//
// Samples each vehicle's Catmull-Rom curve (same class/params as PathDrive)
// every ~1 m and tests each sample on the 2D ground plane against every solid
// obstacle footprint (auto-derived from component-spec part AABBs, inflated by
// half the vehicle's width as safety margin), plus pit-specific rules: inside
// the pit's bench annulus a vehicle must be on the ramp corridor. Output: one
// line per vehicle — PASS, or the exact spans (positions + nearest waypoints)
// clipping which object.
import * as THREE from 'three'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SPEC = join(ROOT, 'coal-mine-twin', '03-twin-spec.json')
const spec = JSON.parse(readFileSync(SPEC, 'utf8'))
const objects = spec.objects
const types = {}
for (const [slug, t] of Object.entries(spec.customAssetTypes ?? {})) types[slug] = t
// component specs on disk are authoritative (scene-export may lag)
import { readdirSync } from 'fs'
const compDir = join(ROOT, 'coal-mine-twin', '02-components')
for (const f of readdirSync(compDir)) {
  if (f.endsWith('.json')) types[f.replace('.json', '')] = JSON.parse(readFileSync(join(compDir, f), 'utf8'))
}

// ── pit geometry (must mirror BowlPit + the twin data) ─────────────────────
const PIT = { cx: -150, cz: 4, floorR: 26, rimR: 61.66, depth: 14.4 }
const rOf = (y) => 21 + y * 2.754                       // ramp deck centreline radius at climb height y
const D2R = Math.PI / 180
const polar = (r, deg, y = 0) => [PIT.cx + Math.cos(deg * D2R) * r, y - PIT.depth, PIT.cz + Math.sin(deg * D2R) * r]
// ramp centreline (theta°, climb y) — same table the terrain decks use
const RAMP_TABLE = [[260, 0], [225, 1.68], [190, 3.36], [155, 5.04], [130, 6.24], [105, 7.2], [75, 9.6], [45, 12.0], [14, 14.4]]
const RAMP_CL = []
for (let i = 0; i < RAMP_TABLE.length - 1; i++) {
  const [t0, y0] = RAMP_TABLE[i], [t1, y1] = RAMP_TABLE[i + 1]
  const steps = Math.max(1, Math.round(Math.abs(t1 - t0) / 8))
  for (let k = 0; k < steps; k++) {
    const f = k / steps
    RAMP_CL.push(polar(rOf(y0 + (y1 - y0) * f), t0 + (t1 - t0) * f, y0 + (y1 - y0) * f))
  }
}
RAMP_CL.push(polar(rOf(14.4), 14, 14.4))
RAMP_CL.push(polar(66, 12, 14.4))          // exit throat onto the grade apron
RAMP_CL.push(polar(63, 4, 14.4))           // southern approach into the throat
const RAMP_HALF = 2.9                                    // drivable half-width inside the berms

// ── obstacle footprints ─────────────────────────────────────────────────────
// AABB of a component's parts in local XZ (approx: top-level positions ± dims)
function partsAABB(typeDef) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const p of typeDef?.parts ?? []) {
    const d = p.dims
    if (!d) continue
    const [px, py, pz] = p.position ?? [0, 0, 0]
    const h = d.height ?? (d.radius ? d.radius * 2 : 1)
    if (py - h / 2 > 2.0) continue                       // overhead part — not a wheel obstacle
    const ex = (d.width ?? (d.radius ? d.radius * 2 : 0.5)) / 2
    const ez = (d.depth ?? (d.radius ? d.radius * 2 : 0.5)) / 2
    x0 = Math.min(x0, px - ex); x1 = Math.max(x1, px + ex)
    z0 = Math.min(z0, pz - ez); z1 = Math.max(z1, pz + ez)
  }
  if (!isFinite(x0)) return null
  return { x0, x1, z0, z1 }
}
const MOVER_TYPES = new Set(['haul_truck', 'light_vehicle'])
const BUILTIN_R = { Pump: 1.3, Tank: 2.4, Valve: 0.7, PipeSegment: 2.0 }
const obstacles = []                                     // {name, kind:'circle'|'rect'|'poly', ...}
for (const [id, o] of Object.entries(objects)) {
  if (MOVER_TYPES.has(o.type)) continue
  if (o.config?.path) continue                           // walking worker is a mover too
  if (o.type === 'PitTerrain') continue                  // handled by the annulus rule
  if (['bulk_carrier', 'shiploader'].includes(o.type)) { /* wharf side — still add */ }
  const [x, , z] = o.position
  if (o.type === 'haul_road') continue                   // roads are DRIVABLE, not obstacles
  if (o.type === 'TerrainMound') {
    obstacles.push({ name: id, kind: 'circle', x, z, r: (o.config?.radius ?? 9) * 1.15 })
    continue
  }
  if (BUILTIN_R[o.type]) { obstacles.push({ name: id, kind: 'circle', x, z, r: BUILTIN_R[o.type] }); continue }
  if (o.type === 'ConveyorBelt') {
    const L = o.config?.length ?? 8
    obstacles.push({ name: id, kind: 'rect', x, z, hx: L / 2, hz: 0.7, rot: o.rotation?.[1] ?? 0 })
    continue
  }
  const box = partsAABB(types[o.type])
  if (!box) { obstacles.push({ name: id, kind: 'circle', x, z, r: 1.0 }); continue }
  obstacles.push({
    name: id, kind: 'rect', x: x + (box.x0 + box.x1) / 2, z: z + (box.z0 + box.z1) / 2,
    hx: (box.x1 - box.x0) / 2, hz: (box.z1 - box.z0) / 2, rot: o.rotation?.[1] ?? 0,
  })
}
// pit muck piles + sump (polar, on floor/benches — trucks share those levels)
for (const m of objects['pit-1']?.config?.muckAt ?? []) {
  const [x, , z] = polar(m.r, m.theta, m.y ?? 0)
  obstacles.push({ name: `muck@${m.theta}`, kind: 'circle', x, z, r: (m.radius ?? 3) + 0.4 })
}
{
  const su = objects['pit-1']?.config?.sump
  if (su) {
    const [x, , z] = polar(su.r ?? 16, su.theta ?? 235, 0)
    obstacles.push({ name: 'sump', kind: 'circle', x, z, r: (su.radius ?? 7) + 1.8 })
  }
}
// conveyor connection runs (straight port→port approximation, generous width)
function portOffset(o, portId) {
  if (o.type === 'ConveyorBelt') {
    const L = o.config?.length ?? 8
    return portId?.includes('out') || portId === 'right' ? [L / 2, 0, 0] : [-L / 2, 0, 0]
  }
  const p = (types[o.type]?.ports ?? []).find(pp => pp.id === portId)
  return p?.offset ?? [0, 0, 0]
}
function worldPort(o, off) {
  const e = new THREE.Euler(o.rotation?.[0] ?? 0, o.rotation?.[1] ?? 0, o.rotation?.[2] ?? 0)
  const v = new THREE.Vector3(...off).applyEuler(e)
  return [o.position[0] + v.x, o.position[2] + v.z]
}
for (const [id, o] of Object.entries(objects)) {
  for (const c of o.connections ?? []) {
    const tgt = objects[c.targetId]
    if (!tgt || !(c.connectorConfig?.material || c.connectorType === 'conveyor')) continue
    const A = worldPort(o, portOffset(o, c.sourcePort))
    const B = worldPort(tgt, portOffset(tgt, c.targetPort))
    obstacles.push({ name: `belt:${id}>${c.targetId}`, kind: 'seg', ax: A[0], az: A[1], bx: B[0], bz: B[1], r: 0.9 })
  }
}

// ── geometry tests ──────────────────────────────────────────────────────────
function hitObstacle(px, pz, margin, skip) {
  for (const ob of obstacles) {
    if (skip && skip.has(ob.name)) continue
    if (ob.kind === 'circle') {
      if (Math.hypot(px - ob.x, pz - ob.z) < ob.r + margin) return ob.name
    } else if (ob.kind === 'rect') {
      const c = Math.cos(-(ob.rot ?? 0)), s = Math.sin(-(ob.rot ?? 0))
      const lx = (px - ob.x) * c - (pz - ob.z) * s
      const lz = (px - ob.x) * s + (pz - ob.z) * c
      if (Math.abs(lx) < ob.hx + margin && Math.abs(lz) < ob.hz + margin) return ob.name
    } else if (ob.kind === 'seg') {
      const dx = ob.bx - ob.ax, dz = ob.bz - ob.az
      const L2 = dx * dx + dz * dz
      const t = L2 ? Math.max(0, Math.min(1, ((px - ob.ax) * dx + (pz - ob.az) * dz) / L2)) : 0
      const qx = ob.ax + dx * t, qz = ob.az + dz * t
      if (Math.hypot(px - qx, pz - qz) < ob.r + margin) return ob.name
    }
  }
  return null
}
function distToPolyline(px, pz, pts) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][2], bx = pts[i + 1][0], bz = pts[i + 1][2]
    const dx = bx - ax, dz = bz - az
    const L2 = dx * dx + dz * dz
    const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0
    best = Math.min(best, Math.hypot(px - (ax + dx * t), pz - (az + dz * t)))
  }
  return best
}
// inside the pit's bench annulus, a mover must be on the ramp corridor, the
// switchback platform, or the loading spur beside it
const PLATFORM = polar(rOf(7.2), 105, 7.2)
const SPUR = [polar(rOf(7.2), 105, 7.2), polar(40.5, 95, 7.2), polar(40.5, 81, 7.2)]
function pitAnnulusViolation(px, pz) {
  const d = Math.hypot(px - PIT.cx, pz - PIT.cz)
  if (d <= PIT.floorR - 0.5 || d >= PIT.rimR + 0.5) return false
  if (Math.hypot(px - PLATFORM[0], pz - PLATFORM[2]) < 8.5) return false
  if (distToPolyline(px, pz, SPUR) < 4) return false
  return distToPolyline(px, pz, RAMP_CL) > RAMP_HALF ? 'pit-benches(off-ramp)' : false
}

// ── generated road-following paths (written with --write) ──────────────────
// Dense ramp lanes: one waypoint every ~15 deg of arc so the Catmull spline
// stays on the deck in BOTH plan and height (sparse chords cut into the wall
// and dipped below the stepped decks — trucks read as swallowed by the pit).
function rampLane(side, fromIdx = 0, toIdx = RAMP_TABLE.length - 1) {
  const pts = []
  for (let i = fromIdx; i < toIdx; i++) {
    const [t0, y0] = RAMP_TABLE[i], [t1, y1] = RAMP_TABLE[i + 1]
    const steps = Math.max(1, Math.round(Math.abs(t1 - t0) / 15))
    for (let k = i === fromIdx ? 0 : 1; k <= steps; k++) {
      const f = k / steps, y = y0 + (y1 - y0) * f
      pts.push(polar(rOf(y) + side, t0 + (t1 - t0) * f, y))
    }
  }
  return pts
}
const rampUp = (side) => rampLane(side, 0)
const rampDown = (side) => [...rampLane(side, 0)].reverse()
const GEN = {
  'truck-1': {
    dwell: 14, speed: 6.0, phase: 0, loadedSlow: 1.45, dump: [-39.5, 0],
    wps: [
      polar(21, 203, 0),                                   // load beside EX-02 (dwell)
      polar(20, 228, 0), polar(20.5, 244, 0),              // flat floor run — keeps the climb tangent level
      ...rampUp(1.1),                                      // climb, outer side (toe included, dense)
      [-86, 0, 15.5], [-66, 0, 10], [-50, 0, 5], [-42, 0, 1],
      [-39.5, 0, 0],                                       // DUMP: ROM bin, west of the crusher
      [-44, 0, -3.5], [-58, 0, 1.5], [-76, 0, 9], [-87.5, 0, 16.8],
      ...rampDown(-1.1),                                   // descend, inner side
      polar(20.5, 246, 0), polar(21, 226, 0),
    ],
  },
  'truck-2': { same: 'truck-1', dwell: 10, speed: 6.2, phase: 0.5 },
  'truck-4': { same: 'truck-1', dwell: 12, speed: 6.1, phase: 0.2 },
  'truck-5': { same: 'truck-1', dwell: 13, speed: 5.9, phase: 0.7 },
  'truck-6': { same: 'truck-3', dwell: 11, speed: 6.4, phase: 0.55 },
  'truck-7': { same: 'truck-1', dwell: 14, speed: 6.0, phase: 0.35 },
  'truck-8': { same: 'truck-3', dwell: 12, speed: 6.3, phase: 0.8 },
  'truck-3': {
    dwell: 12, speed: 6.5, phase: 0.3, loadedSlow: 1.4, dump: [-108.5, -63.5],
    wps: [
      polar(40.5, 82, 7.2),                                // load in the tread-1 bay beside EX-01
      polar(40.5, 88, 7.2), polar(40.5, 96, 7.2), polar(rOf(7.2) + 1.2, 104, 7.2),
      ...rampLane(1.2, 5),                                 // leg 2 up, outer side (dense)
      [-84, 0, 8], [-87, 0, -18], [-97, 0, -44],
      [-108.5, 0, -63.5],                                  // DUMP: tipping edge, off the mound
      [-99, 0, -42], [-89, 0, -14], [-86, 0, 13],
      ...[...rampLane(-1.2, 5)].reverse(),
      polar(rOf(7.2) - 0.5, 103, 7.2), polar(40.5, 96, 7.2), polar(40.5, 88, 7.2),
    ],
  },
  'lv-1': {
    speed: 2.4, loop: true,
    wps: [[2, 0, -20], [14, 0, -24], [18, 0, -33], [50, 0, -37], [82, 0, -35], [96, 0, -27],
          [107, 0, -6], [108, 0, 11], [104, 0, 20], [82, 0, 20], [64, 0, 17], [52, 0, 20], [40, 0, 27],
          [24, 0, 35], [-6, 0, 35], [-26, 0, 16], [-55, 0, 6], [-82, 0, 16],
          [-58, 0, 11], [-42, 0, -9], [-24, 0, -12], [-12, 0, -11], [-4, 0, -16]],
  },
  'worker-7': { speed: 0.85, loop: true, wps: [[2.5, 0, 9], [11, 0, 8.2], [13, 0, 12], [4.5, 0, 13.8]] },
  // patrols: worker-1 loops the CHP walkway (in/out of the PPE-04 camera zone),
  // worker-6 loops the stockyard walkway (through the ppe-cam-2 zone).
  'worker-1': { speed: 0.8, loop: true, wps: [[-1, 0, 6.5], [3, 0, 6.2], [4, 0, 8.8], [-1, 0, 8.8]] },
  'worker-6': { speed: 0.8, loop: true, wps: [[20, 0, 9.5], [25, 0, 9.5], [25, 0, 13], [20, 0, 13]] },
}
const HALF_W = { 'truck-1': 1.75, 'truck-2': 1.75, 'truck-3': 1.75, 'truck-4': 1.75, 'truck-5': 1.75, 'truck-6': 1.75, 'truck-7': 1.75, 'truck-8': 1.75, 'lv-1': 1.0, 'worker-7': 0.35, 'worker-1': 0.35, 'worker-6': 0.35 }
// a mover may hug the thing it services (its excavator / the crusher bin edge);
// patrol workers skip their OWN static footprint (they become movers).
const SKIP = {
  'truck-1': new Set(['exc-coal-1']), 'truck-2': new Set(['exc-coal-1']),
  'truck-4': new Set(['exc-coal-1']), 'truck-5': new Set(['exc-coal-1']), 'truck-7': new Set(['exc-coal-1']),
  'truck-3': new Set(['exc-ob-1']), 'truck-6': new Set(['exc-ob-1']), 'truck-8': new Set(['exc-ob-1']),
  'worker-1': new Set(['worker-1']), 'worker-6': new Set(['worker-6']),
}

// vertical clearance to the NEAREST drivable surface at (x,z) — several
// levels overlap in plan (deck over floor at the toe, spur beside leg 2), so
// a vehicle passes if it sits on ANY of them
function terrainDy(px, pz, py) {
  const d = Math.hypot(px - PIT.cx, pz - PIT.cz)
  const cands = []
  if (d >= PIT.rimR - 0.3) cands.push(0)                   // grade / apron / roads
  if (Math.hypot(px - PLATFORM[0], pz - PLATFORM[2]) < 8.5) cands.push(-PIT.depth + 7.2)
  let best = Infinity, bestY = null
  for (const p of RAMP_CL) {
    const dd = Math.hypot(px - p[0], pz - p[2])
    if (dd < best) { best = dd; bestY = p[1] }
  }
  if (best <= 4.6) cands.push(bestY)                       // ramp deck
  if (distToPolyline(px, pz, SPUR) < 4.5) cands.push(-PIT.depth + 7.2)
  if (d <= PIT.floorR + 0.5) cands.push(-PIT.depth)        // pit floor
  if (!cands.length) return null                           // bench wall — 2D rule fails there
  let dy = Infinity
  for (const y of cands) if (Math.abs(py - y) < Math.abs(dy)) dy = py - y
  return dy
}

// ── validate ────────────────────────────────────────────────────────────────
const WRITE = process.argv.includes('--write')
let allPass = true
const report = []
for (const [vid, gen] of Object.entries(GEN)) {
  const src = gen.same ? GEN[gen.same] : gen
  const wps = src.wps
  const curve = new THREE.CatmullRomCurve3(wps.map(w => new THREE.Vector3(w[0], w[1] ?? 0, w[2])), true, 'centripetal')
  const len = curve.getLength()
  const N = Math.max(64, Math.round(len))
  const pts = curve.getSpacedPoints(N)
  const margin = HALF_W[vid]
  const fails = []
  for (let i = 0; i <= N; i++) {
    const p = pts[i]
    let hit = hitObstacle(p.x, p.z, margin, SKIP[vid]) || (margin > 0.5 ? pitAnnulusViolation(p.x, p.z) : null)
    if (!hit && margin > 0.5) {
      const dy = terrainDy(p.x, p.z, p.y)
      if (dy != null && Math.abs(dy) > 0.9) hit = `terrain(dy ${dy.toFixed(1)})`
    }
    if (hit) fails.push({ f: i / N, x: +p.x.toFixed(1), z: +p.z.toFixed(1), hit })
  }
  // collapse consecutive fails into spans
  const spans = []
  for (const f of fails) {
    const last = spans[spans.length - 1]
    if (last && f.f - last.f1 < 2.5 / N && last.hit === f.hit) { last.f1 = f.f; last.x1 = f.x; last.z1 = f.z }
    else spans.push({ hit: f.hit, f0: f.f, f1: f.f, x0: f.x, z0: f.z, x1: f.x, z1: f.z })
  }
  // dumpAt: travel fraction of the closest sample to the designated dump point
  let dumpAt = null
  if (src.dump) {
    const dumpPoint = src.dump
    let bi = 0, bd = Infinity
    for (let i = 0; i <= N; i++) {
      const d = Math.hypot(pts[i].x - dumpPoint[0], pts[i].z - dumpPoint[1])
      if (d < bd) { bd = d; bi = i }
    }
    dumpAt = +(bi / N).toFixed(3)
  }
  const ok = spans.length === 0
  allPass = allPass && ok
  report.push({ vid, ok, spans, dumpAt, len: +len.toFixed(0) })
  if (WRITE && ok) {
    const o = objects[vid]
    o.config = o.config || {}
    const path = { waypoints: wps.map(w => w.map(v => +(+v).toFixed(2))), speed: src.speed, loop: true }
    if (src.dwell) path.dwell = src.dwell
    if (gen.phase ?? src.phase) path.phase = gen.phase ?? src.phase
    if (dumpAt != null) path.loadState = { dumpAt }
    if (src.loadedSlow) path.loadedSlow = src.loadedSlow
    o.config.path = path
    if (margin > 1) o.position = path.waypoints[0]
  }
}
for (const r of report) {
  if (r.ok) console.log(`${r.vid}: PASS  (len ${r.len}m${r.dumpAt != null ? `, dumpAt ${r.dumpAt}` : ''})`)
  else {
    console.log(`${r.vid}: FAIL`)
    for (const s of r.spans) console.log(`   ${(s.f0 * 100).toFixed(1)}%–${(s.f1 * 100).toFixed(1)}%  [${s.x0},${s.z0}]→[${s.x1},${s.z1}]  clips ${s.hit}`)
  }
}
if (WRITE && allPass) {
  writeFileSync(SPEC, JSON.stringify(spec, null, 2))
  console.log('spec updated (paths + dumpAt written)')
} else if (WRITE) console.log('NOT written — fix FAILs first')
