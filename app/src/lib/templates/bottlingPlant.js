// ─────────────────────────────────────────────────────────────────────────────
// Bottling Plant template — a Tecnomatix-style dairy/beverage plant: office block
// + cut-away production hall (roof trusses, window bands), milk silo farm,
// mixing / pasteurising / CIP skids, and a filling line whose conveyors are
// PACKED with instanced bottles (FlowConveyor). Every machine is a dissectable
// multi-part Component Spec with bolted flanges, rails, valves, gauges & plates.
// ─────────────────────────────────────────────────────────────────────────────

import { pipeConfigFor } from '../pipeMedia'
import { boltCircle, flangeJoint, handrail, valveWheel, nameplate, junctionBox, gauge as dial } from '../detailKit'

const M = {
  ss:      { color: '#c3ccd4', metalness: 0.88, roughness: 0.16, finish: 'brushedMetal' },   // dairy stainless
  ssDull:  { color: '#9fa9b2', metalness: 0.75, roughness: 0.3,  finish: 'brushedMetal' },
  frame:   { color: '#7d8790', metalness: 0.7,  roughness: 0.4,  finish: 'paintedSteel' },
  wall:    { color: '#e2dbc6', metalness: 0.05, roughness: 0.8,  finish: 'paintedSteel', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 },
  wallIn:  { color: '#efe9d8', metalness: 0.05, roughness: 0.85, finish: 'paintedSteel' },
  glass:   { color: '#dfeaf2', metalness: 0.1,  roughness: 0.08, transparent: true, opacity: 0.13 },
  bright:  { color: '#dde3e8', metalness: 0.8,  roughness: 0.22 },   // clean machine stainless, no heavy brushing (close-up parts)
  white:   { color: '#f2f4f6', metalness: 0.08, roughness: 0.5 },    // plain white (labels, screws) — NO polygonOffset
  labelTan:{ color: '#d8b23a', metalness: 0.05, roughness: 0.5 },
  blue:    { color: '#5b7fd4', metalness: 0.4,  roughness: 0.45, finish: 'paintedSteel' },
  amber:   { color: '#e0a225', metalness: 0.4,  roughness: 0.5,  finish: 'paintedSteel' },
  red:     { color: '#b8483a', metalness: 0.3,  roughness: 0.6,  finish: 'paintedSteel' },
  dark:    { color: '#2f353c', metalness: 0.4,  roughness: 0.6,  finish: 'paintedSteel' },
  concrete:{ color: '#c9ccd1', metalness: 0.04, roughness: 0.92, finish: 'concrete', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 },
  asphalt: { color: '#3a3f45', metalness: 0.1,  roughness: 0.9,  finish: 'concrete' },
  paint:   { color: '#e8e8e8', metalness: 0.2,  roughness: 0.6,  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
  grass:   { color: '#6fae5c', metalness: 0.0,  roughness: 1.0 },
  leaf:    { color: '#4c8f57', metalness: 0.0,  roughness: 0.9 },
  trunk:   { color: '#6b4f35', metalness: 0.0,  roughness: 0.9 },
  cabY:    { color: '#e3d36a', metalness: 0.3,  roughness: 0.5,  finish: 'paintedSteel' },
  tyre:    { color: '#23262a', metalness: 0.1,  roughness: 0.85 },
  milk:    { color: '#f4f6f2', metalness: 0.05, roughness: 0.35 },
}

const SPIN  = { kind: 'spinY', speedKey: 'speed' }
const PULSE = { kind: 'pulse', speedKey: 'speed' }
const BOB   = { kind: 'bob',   speedKey: 'speed' }
const RISE  = { kind: 'rise',  speedKey: 'speed' }
// Rated spin: surface speed matched to the 0.7 m/s belts (rate = 0.73/r at the
// working radius; negative = counter-rotation) so nothing looks slippy/fake.
const SPINR = (rate) => ({ kind: 'spinY', speedKey: 'speed', rate })

// Bump when PLACEMENTS/config metering changes — loadScene auto-syncs template
// objects whose layoutV is older, so existing projects pick up line re-meters
// without being recreated.
export const BOTTLING_LAYOUT_V = 3

let _pid = 0
const P = (label, geometry, dims, position, opts = {}) => ({
  id: `bp_part_${++_pid}`, label, geometry, dims, position,
  rotation: opts.rot || [0, 0, 0], scale: opts.scale || [1, 1, 1],
  parentId: opts.parentId || null, material: opts.mat || M.ss,
  animate: opts.animate || null,
})
const port = (id, type, direction, offset) => ({ id, type, direction, offset })
const pr = (key, label, unit, def, min, max, freq) => ({
  key, label, unit, default: def,
  ...(min != null ? { min } : {}), ...(max != null ? { max } : {}), ...(freq ? { freq } : {}),
})
const CONFIG = [
  { key: 'enabled', label: 'Running', type: 'boolean', default: true },
  { key: 'speed',   label: 'Speed',   type: 'number',  default: 1, min: 0, max: 3, step: 0.1 },
]
const spec = ({ id, label, layer = 'equipment', parts, ports = [], params = [], pad = null, ground = false }) => ({
  id, label, category: 'Bottling Plant', layer, schemaVersion: 1,
  defaultConfig: { enabled: true, speed: 1 },
  ...(ground ? { ground: true } : {}),
  parts: [
    ...(pad ? [P('Foundation', 'box', { width: pad[0], height: 0.25, depth: pad[1] }, [0, 0.125, 0], { mat: M.concrete })] : []),
    ...parts,
  ],
  ports, config: CONFIG, parameters: params, states: null, subComponents: [], beacon: null,
})
const legs4 = (w, d, h, mat = M.frame) =>
  [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]].map(([x, z]) =>
    P('Leg', 'box', { width: 0.14, height: h, depth: 0.14 }, [x, h / 2, z], { mat }))
const ladder = (x, z, y0, h) => P('Ladder', 'box', { width: 0.08, height: h, depth: 0.45 }, [x, y0 + h / 2, z], { mat: M.frame })

// ── 1. Milk Silo (vertical stainless storage) ──
const silo = spec({
  id: 'bp_silo', label: 'Milk Silo', layer: 'equipment', pad: [4.4, 4.4],
  parts: [
    P('Skirt', 'cylinder', { radius: 1.55, height: 1.2 }, [0, 0.85, 0], { mat: M.ssDull }),
    P('Shell', 'vessel', { radius: 1.5, height: 8.4 }, [0, 5.4, 0], { mat: M.ss }),
    P('Top Motor', 'cylinder', { radius: 0.32, height: 0.7 }, [0, 9.95, 0], { mat: M.blue, animate: SPIN }),
    P('Vent', 'cylinder', { radius: 0.1, height: 0.5 }, [0.8, 9.85, 0], { mat: M.ss }),
    P('Strip Housing', 'box', { width: 0.16, height: 6.7, depth: 0.07 }, [0, 5.2, 1.52], { mat: M.dark }),
    P('Level Strip', 'box', { width: 0.08, height: 6.5, depth: 0.04 }, [0, 5.2, 1.56], { mat: { ...M.amber, emissive: '#e0a225', emissiveIntensity: 0.35 }, animate: PULSE }),
    // intake drop pipe: top inlet → down the shell to the base valve
    P('Inlet Drop', 'cylinder', { radius: 0.06, height: 9.0 }, [-1.62, 4.9, 0], { mat: M.ssDull }),
    P('Inlet Elbow', 'sphere', { radius: 0.08 }, [-1.62, 9.45, 0], { mat: M.ssDull }),
    P('Inlet Sweep', 'cylinder', { radius: 0.06, height: 1.4 }, [-0.9, 9.45, 0], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    ladder(1.62, 0, 0.3, 9.2),
    P('Crown Ring', 'torus', { radius: 1.52, tube: 0.05 }, [0, 9.4, 0], { rot: [Math.PI / 2, 0, 0], mat: M.ssDull }),
    ...handrail({ from: [-1.1, 9.55, -1.1], to: [1.1, 9.55, -1.1], h: 0.8, postEvery: 1.1 }),
    ...flangeJoint({ center: [0, 0.35, 1.62], r: 0.2, bolts: 8, axis: 'z' }),
    ...valveWheel({ pos: [0, 0.85, 2.0], r: 0.16 }),
    ...nameplate({ pos: [0.8, 1.7, 1.56] }),
  ],
  ports: [port('milk_out', 'utility', 'out', [0, 0.4, 2.1]), port('milk_in', 'utility', 'in', [0, 9.9, -0.8])],
  params: [pr('level', 'Level', '%', 74, 0, 100, '1m'), pr('temp', 'Temp', '°C', 4, 0, 12, '5m'), pr('agitator', 'Agitator', 'rpm', 22, 0, 40, '30s')],
})

// ── 2. Mixing / Standardisation skid ──
const mixerParts = []
for (const [x, label] of [[-1.6, 'Mix Vessel A'], [1.6, 'Mix Vessel B']]) {
  mixerParts.push(
    P(label, 'vessel', { radius: 1.1, height: 3.6 }, [x, 2.6, 0], { mat: M.ss }),
    P('Agitator Motor', 'cylinder', { radius: 0.24, height: 0.6 }, [x, 4.75, 0], { mat: M.blue, animate: SPIN }),
    P('Agitator Shaft', 'cylinder', { radius: 0.05, height: 1.6 }, [x, 3.6, 0], { mat: M.ssDull, animate: SPIN }),
    ...boltCircle({ center: [x, 4.42, 0], r: 0.5, n: 8, axis: 'y' }),
    ...dial({ pos: [x + 0.6, 2.9, 1.06] }),
  )
}
const mixer = spec({
  id: 'bp_mixer', label: 'Mixing Skid', pad: [7, 4],
  parts: [
    ...mixerParts,
    P('Transfer Line', 'cylinder', { radius: 0.09, height: 3.2 }, [0, 3.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('Dosing Pump', 'cylinder', { radius: 0.3, height: 0.7 }, [0, 0.65, 1.2], { mat: M.amber, animate: SPIN }),
    ...legs4(5.6, 2.6, 0.8, M.frame),
    ...handrail({ from: [-2.8, 0.25, 1.9], to: [2.8, 0.25, 1.9] }),
    ...valveWheel({ pos: [-0.8, 1.15, 1.2], r: 0.15 }),
    ...valveWheel({ pos: [0.8, 1.15, 1.2], r: 0.15 }),
    ...nameplate({ pos: [2.2, 1.02, 1.06] }),
    ...junctionBox({ pos: [-2.4, 1.1, 1.34] }),
  ],
  ports: [port('milk_in', 'utility', 'in', [-2.8, 1.4, 0]), port('milk_out', 'utility', 'out', [2.8, 1.4, 0])],
  params: [pr('batchLevel', 'Batch Level', '%', 58, 0, 100, '30s'), pr('fat', 'Fat', '%', 3.5, 0, 6, '15m'), pr('mixSpeed', 'Agitation', 'rpm', 45, 0, 90, '30s')],
})

// ── 3. Pasteuriser (plate heat-exchanger skid) ──
const pastParts = []
for (let i = 0; i < 26; i++) {
  pastParts.push(P('HX Plate', 'box', { width: 0.05, height: 1.5, depth: 1.0 }, [-1.4 + i * 0.075, 1.85, -0.6], { mat: i % 2 ? M.ss : M.ssDull }))
}
const pasteuriser = spec({
  id: 'bp_pasteuriser', label: 'Pasteuriser', pad: [7, 4.6],
  parts: [
    ...pastParts,
    P('Frame Rail', 'box', { width: 3.4, height: 0.16, depth: 1.1 }, [-0.35, 0.95, -0.6], { mat: M.frame }),
    P('Follower', 'box', { width: 0.22, height: 1.7, depth: 1.15 }, [0.75, 1.85, -0.6], { mat: M.blue }),
    P('Tie Bar', 'cylinder', { radius: 0.05, height: 3.5 }, [-0.35, 2.5, -0.6], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('Balance Tank', 'vessel', { radius: 0.7, height: 1.9 }, [-2.6, 1.55, 0.9], { mat: M.ss }),
    P('Booster Pump', 'cylinder', { radius: 0.32, height: 0.8 }, [-1.2, 0.7, 1.1], { rot: [0, 0, Math.PI / 2], mat: M.amber, animate: SPIN }),
    P('Pump Pedestal', 'box', { width: 0.5, height: 0.4, depth: 0.4 }, [-1.2, 0.2, 1.1], { mat: M.frame }),
    P('Holding Tube', 'torus', { radius: 0.9, tube: 0.09 }, [1.9, 2.3, 0.9], { rot: [Math.PI / 2, 0, 0], mat: M.ssDull }),
    P('Tube Post A', 'box', { width: 0.08, height: 2.2, depth: 0.08 }, [1.2, 1.1, 0.9], { mat: M.frame }),
    P('Tube Post B', 'box', { width: 0.08, height: 2.2, depth: 0.08 }, [2.6, 1.1, 0.9], { mat: M.frame }),
    P('Hot Water Set', 'roundedBox', { width: 1.2, height: 1.5, depth: 1, bevel: 0.05 }, [2.6, 1.05, -0.6], { mat: M.red }),
    P('Steam Wisp', 'sphere', { radius: 0.22 }, [2.6, 2.0, -0.6], { mat: { color: '#eef2f5', metalness: 0, roughness: 1, transparent: true, opacity: 0.45 }, animate: RISE }),
    ...legs4(5.8, 3.2, 0.6, M.frame),
    ...flangeJoint({ center: [-2.6, 0.5, 1.62], r: 0.16, bolts: 6, axis: 'z' }),
    ...valveWheel({ pos: [0.4, 1.0, 1.3], r: 0.15 }),
    ...valveWheel({ pos: [1.2, 1.0, 1.3], r: 0.15 }),
    ...dial({ pos: [2.6, 1.9, -0.06] }),
    ...dial({ pos: [-0.4, 2.4, 0.0], face: 'z' }),
    ...nameplate({ pos: [-2.0, 1.0, 1.42] }),
    ...junctionBox({ pos: [2.9, 0.9, 0.6] }),
  ],
  ports: [port('milk_in', 'utility', 'in', [-3.1, 1.4, 0.9]), port('milk_out', 'utility', 'out', [3.1, 1.6, 0])],
  params: [pr('pasteTemp', 'Pasteur Temp', '°C', 74.5, 60, 90, '5s'), pr('flow', 'Flow', 'L/h', 12000, 0, 20000, '30s'), pr('holdTime', 'Hold', 's', 16, 0, 30, '5m')],
})

// ── 4. CIP skid ──
const cip = spec({
  id: 'bp_cip', label: 'CIP Station', pad: [7.6, 4],
  parts: [
    P('Caustic Tank', 'vessel', { radius: 0.85, height: 2.6 }, [-2.2, 1.85, 0], { mat: M.amber }),
    P('Acid Tank', 'vessel', { radius: 0.85, height: 2.6 }, [0, 1.85, 0], { mat: M.red }),
    P('Water Tank', 'vessel', { radius: 0.85, height: 2.6 }, [2.2, 1.85, 0], { mat: M.ss }),
    P('Manifold', 'cylinder', { radius: 0.1, height: 5.4 }, [0, 0.8, 1.3], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('CIP Pump A', 'cylinder', { radius: 0.28, height: 0.7 }, [-1.1, 0.55, 1.3], { rot: [0, 0, Math.PI / 2], mat: M.blue, animate: SPIN }),
    P('CIP Pump B', 'cylinder', { radius: 0.28, height: 0.7 }, [1.1, 0.55, 1.3], { rot: [0, 0, Math.PI / 2], mat: M.blue, animate: SPIN }),
    ...[-2.2, 0, 2.2].flatMap((x) => valveWheel({ pos: [x, 1.15, 1.3], r: 0.14 })),
    ...[-2.2, 0, 2.2].flatMap((x) => boltCircle({ center: [x, 3.2, 0], r: 0.35, n: 6, axis: 'y' })),
    P('Control Panel', 'roundedBox', { width: 0.9, height: 1.3, depth: 0.3, bevel: 0.04 }, [3.3, 0.95, 1.2], { mat: M.dark }),
    ...dial({ pos: [3.3, 1.35, 1.38] }),
    ...nameplate({ pos: [3.3, 0.62, 1.36] }),
  ],
  ports: [port('cip_out', 'utility', 'out', [3.8, 0.8, 1.3]), port('cip_ret', 'utility', 'in', [-3.8, 0.8, 1.3])],
  params: [pr('conductivity', 'Conductivity', 'mS', 48, 0, 100, '1m'), pr('cipTemp', 'CIP Temp', '°C', 78, 0, 95, '30s')],
})

// ── 5. Rotary Filler-Capper monoblock (HERO — image-3 style) ──
const fillerParts = []
// yellow safety-fence cell (Tecnomatix-style): posts + rails + wire-mesh panels,
// with openings on both sides where the bottle lane passes through (z ≈ 0.9)
const FY = { color: '#e8c11c', metalness: 0.4, roughness: 0.5, finish: 'paintedSteel' }
const MESHP = { color: '#aab3ba', metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.2 }
{
  const X = 3.5, Z = 2.7, H = 1.9
  // front & back runs (full)
  for (const z of [-Z, Z]) {
    for (let x = -X; x <= X + 0.01; x += 1.4) fillerParts.push(P('Fence Post', 'box', { width: 0.07, height: H, depth: 0.07 }, [x, H / 2, z], { mat: FY }))
    fillerParts.push(P('Fence Rail', 'box', { width: X * 2, height: 0.06, depth: 0.05 }, [0, H - 0.05, z], { mat: FY }))
    fillerParts.push(P('Fence Rail', 'box', { width: X * 2, height: 0.06, depth: 0.05 }, [0, 0.55, z], { mat: FY }))
    fillerParts.push(P('Fence Mesh', 'box', { width: X * 2, height: H - 0.75, depth: 0.02 }, [0, (H + 0.55) / 2 - 0.05, z], { mat: MESHP }))
  }
  // side runs with a lane opening at z 0.4..1.5
  for (const x of [-X, X]) {
    for (const z of [-Z, -1.35, 0.05, 1.85 + 0.85]) fillerParts.push(P('Fence Post', 'box', { width: 0.07, height: H, depth: 0.07 }, [x, H / 2, z], { mat: FY }))
    // lower/back segment (z -2.7 .. 0.4)
    fillerParts.push(P('Fence Rail', 'box', { width: 0.05, height: 0.06, depth: 3.1 }, [x, H - 0.05, -1.15], { mat: FY }))
    fillerParts.push(P('Fence Mesh', 'box', { width: 0.02, height: H - 0.75, depth: 3.1 }, [x, (H + 0.55) / 2 - 0.05, -1.15], { mat: MESHP }))
    // upper/front segment (z 1.5 .. 2.7)
    fillerParts.push(P('Fence Rail', 'box', { width: 0.05, height: 0.06, depth: 1.2 }, [x, H - 0.05, 2.1], { mat: FY }))
    fillerParts.push(P('Fence Mesh', 'box', { width: 0.02, height: H - 0.75, depth: 1.2 }, [x, (H + 0.55) / 2 - 0.05, 2.1], { mat: MESHP }))
  }
}
// filling carousel: base drive + a SPINNING GROUP that carries the disc, the 12
// fill valves AND 12 bottles under them — bottles visibly ride the carousel
// while being filled (valve stems dip into the bottle mouths).
fillerParts.push(
  P('Drive Base', 'cylinder', { radius: 1.15, height: 0.9 }, [-1, 0.75, 0], { mat: M.ssDull }),
  { id: 'bpf_caro', label: 'Filling Carousel', kind: 'group', position: [-1, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parentId: null, animate: SPINR(0.61), material: M.ss },
  P('Top Bowl', 'vessel', { radius: 0.68, height: 0.85 }, [-1, 2.95, 0], { mat: M.bright }),
  P('Centre Column', 'cylinder', { radius: 0.2, height: 2.2 }, [-1, 2.0, 0], { mat: M.ssDull }),
  P('Carousel Disc', 'cylinder', { radius: 1.35, height: 0.22 }, [0, 1.35, 0], { parentId: 'bpf_caro', mat: M.ssDull }),
  // upper manifold ring the valves hang FROM (no more floating "candles")
  P('Valve Manifold', 'cylinder', { radius: 1.28, height: 0.12 }, [0, 2.36, 0], { parentId: 'bpf_caro', mat: M.ssDull }),
)
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2, vx = Math.cos(a) * 1.2, vz = Math.sin(a) * 1.2
  const rx = Math.cos(a) * 1.34, rz = Math.sin(a) * 1.34
  fillerParts.push(
    // one full filling STATION per index: outer guide rod + spring sleeve on the
    // ring, valve body + bell over the bottle (reference-density rim assemblies)
    P('Station Rod', 'cylinder', { radius: 0.022, height: 0.95 }, [rx, 1.92, rz], { parentId: 'bpf_caro', mat: M.bright }),
    P('Station Spring', 'cylinder', { radius: 0.045, height: 0.3 }, [rx, 2.16, rz], { parentId: 'bpf_caro', mat: M.ssDull }),
    P('Fill Valve', 'cylinder', { radius: 0.045, height: 0.58 }, [vx, 2.06, vz], { parentId: 'bpf_caro', mat: M.bright }),
    P('Valve Bell', 'cone', { radius: 0.08, height: 0.12 }, [vx, 1.74, vz], { parentId: 'bpf_caro', mat: M.bright }),
    P('Caro Bottle', 'cylinder', { radius: 0.078, height: 0.26 }, [vx, 1.6, vz], { parentId: 'bpf_caro', mat: M.white }),
  )
}
fillerParts.push(
  // rim ring plates tying the stations together (top of rods + above bottles)
  P('Upper Ring Plate', 'torus', { radius: 1.34, tube: 0.045 }, [0, 2.4, 0], { parentId: 'bpf_caro', rot: [Math.PI / 2, 0, 0], mat: M.ssDull }),
  P('Lower Ring Plate', 'torus', { radius: 1.34, tube: 0.045 }, [0, 1.46, 0], { parentId: 'bpf_caro', rot: [Math.PI / 2, 0, 0], mat: M.ssDull }),
)
// starwheels in/out + capper turret (a spinning group carrying caps to be applied)
// continuous transfer track through the machine at bed height — the bottle lane
// (z 0.9) runs: infeed star → carousel tangent → discharge star → capper → belt
fillerParts.push(
  P('Transfer Track', 'box', { width: 3.5, height: 0.03, depth: 0.5 }, [-1.05, 0.94, 0.9], { mat: M.ssDull }),
  P('Track Rail Outer', 'cylinder', { radius: 0.02, height: 3.5 }, [-1.05, 1.1, 1.17], { rot: [0, 0, Math.PI / 2], mat: M.bright }),
  P('Track Rail In A', 'cylinder', { radius: 0.02, height: 1.0 }, [-2.2, 1.1, 0.63], { rot: [0, 0, Math.PI / 2], mat: M.bright }),
    ...[-2.4, -1.0].map((x) => P('Track Post', 'box', { width: 0.08, height: 0.92, depth: 0.08 }, [x, 0.46, 0.9], { mat: M.frame })),
)
// Notched, spoked transfer starwheels (reference-style) — spinning assemblies:
// disc + hub + 4 spokes + 8 pocket fingers (the gaps between fingers are the
// bottle pockets), each on a pedestal.
function starwheel(gid, x, z) {
  const out = [
    P('Star Pedestal', 'cylinder', { radius: 0.09, height: 1.02 }, [x, 0.53, z], { mat: M.frame }),
    { id: gid, label: 'Starwheel', kind: 'group', position: [x, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1], parentId: null, animate: SPINR(-1.58), material: M.blue },
    P('Star Disc', 'cylinder', { radius: 0.44, height: 0.045 }, [0, 1.06, 0], { parentId: gid, mat: M.blue }),
    P('Star Hub', 'cylinder', { radius: 0.08, height: 0.36 }, [0, 1.2, 0], { parentId: gid, mat: M.ssDull }),
  ]
  for (let i = 0; i < 4; i++) {
    out.push(P('Star Spoke', 'box', { width: 0.82, height: 0.03, depth: 0.07 }, [0, 1.1, 0], { parentId: gid, rot: [0, (i / 4) * Math.PI, 0], mat: M.ssDull }))
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    out.push(P('Pocket Finger', 'box', { width: 0.13, height: 0.1, depth: 0.09 },
      [Math.cos(a) * 0.46, 1.12, Math.sin(a) * 0.46], { parentId: gid, rot: [0, -a, 0], mat: M.blue }))
  }
  return out
}
fillerParts.push(
  ...starwheel('bpf_starA', -2.4, 0.9),
  ...starwheel('bpf_starB', 0.4, 0.9),
  P('Capper Pedestal', 'cylinder', { radius: 0.42, height: 1.3 }, [1.7, 0.65, 0], { mat: M.ssDull }),
  { id: 'bpf_capper', label: 'Capper Turret', kind: 'group', position: [1.7, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parentId: null, animate: SPINR(-1.62), material: M.blue },
  P('Capper Body', 'cylinder', { radius: 0.55, height: 0.9 }, [0, 1.75, 0], { parentId: 'bpf_capper', mat: M.blue }),
  P('Capper Head Ring', 'torus', { radius: 0.45, tube: 0.07 }, [0, 2.25, 0], { rot: [Math.PI / 2, 0, 0], parentId: 'bpf_capper', mat: M.ssDull }),
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => {
    const a = (i / 8) * Math.PI * 2, cx = Math.cos(a) * 0.45, cz = Math.sin(a) * 0.45
    return [
      P('Chuck Rod', 'cylinder', { radius: 0.02, height: 0.55 }, [cx, 1.85, cz], { parentId: 'bpf_capper', mat: M.bright }),
      P('Capper Chuck', 'cylinder', { radius: 0.05, height: 0.22 }, [cx, 1.42, cz], { parentId: 'bpf_capper', mat: M.blue }),
      P('Chuck Spring', 'cylinder', { radius: 0.038, height: 0.16 }, [cx, 1.62, cz], { parentId: 'bpf_capper', mat: M.ssDull }),
    ]
  }),
  P('Cap Hopper', 'roundedBox', { width: 1.0, height: 0.8, depth: 1.0, bevel: 0.05 }, [2.4, 3.4, -1.4], { mat: M.ssDull }),
  P('Hopper Stand', 'box', { width: 0.14, height: 3.0, depth: 0.14 }, [2.4, 1.5, -1.4], { mat: M.frame }),
  P('Hopper Brace', 'box', { width: 0.1, height: 0.1, depth: 0.9 }, [2.4, 2.9, -0.95], { rot: [0.35, 0, 0], mat: M.frame }),
  P('Cap Chute', 'box', { width: 0.24, height: 1.6, depth: 0.1 }, [2.05, 2.55, -0.85], { rot: [0.6, 0, 0], mat: M.amber }),
  P('HMI Panel', 'roundedBox', { width: 0.8, height: 1.1, depth: 0.24, bevel: 0.04 }, [3.15, 1.3, 1.6], { mat: M.dark }),
  P('Status Beacon', 'sphere', { radius: 0.09 }, [3.15, 2.0, 1.6], { mat: { ...M.amber, emissive: '#ffb020', emissiveIntensity: 1.4 }, animate: PULSE }),
)
const filler = spec({
  id: 'bp_filler', label: 'Rotary Filler-Capper', pad: [7.4, 5.6],
  parts: [
    ...fillerParts,
    ...boltCircle({ center: [-1, 0.32, 0], r: 1.05, n: 12, axis: 'y' }),
    ...dial({ pos: [3.15, 1.75, 1.74] }),
    ...nameplate({ pos: [0, 0.5, 2.84] }),
    ...junctionBox({ pos: [-3.2, 0.9, 2.4] }),
  ],
  ports: [
    port('milk_in', 'utility', 'in', [-1, 3.5, -2.6]),
    port('bottles_in', 'conveyor', 'in', [-3.7, 0.95, 0.9]),
    port('bottles_out', 'conveyor', 'out', [3.7, 0.95, 0.9]),
  ],
  params: [pr('throughput', 'Throughput', 'bpm', 320, 0, 500, '5s'), pr('fillVolume', 'Fill Vol', 'mL', 500, 0, 1500, '5m'), pr('capTorque', 'Cap Torque', 'Nm', 1.6, 0, 4, '5m'), pr('reject', 'Rejects', '%', 0.4, 0, 5, '15m')],
})

// ── 5b. Bottle Feeder / Unscrambler — the LINE'S START: empty bottles hopper →
// elevator → unscrambler bowl → discharge chute onto the belt (bed height 0.95),
// so the infeed conveyor emerges from a machine instead of starting bare.
const depal = spec({
  id: 'bp_depal', label: 'Bottle Feeder', pad: [4.2, 4.2],
  parts: [
    P('Hopper Bin', 'roundedBox', { width: 1.8, height: 1.4, depth: 1.8, bevel: 0.07 }, [-0.9, 0.95, -1.0], { mat: M.ssDull }),
    P('Elevator', 'box', { width: 2.4, height: 0.14, depth: 0.7 }, [-0.1, 1.6, -1.0], { rot: [0, 0, 0.45], mat: M.frame }),
    ...[0, 1, 2, 3].map((i) => P('Cleat', 'box', { width: 0.06, height: 0.1, depth: 0.66 },
      [-1.0 + i * 0.55, 1.14 + i * 0.26, -1.0], { rot: [0, 0, 0.45], mat: M.amber })),
    P('Unscrambler Bowl', 'cylinder', { radius: 0.85, height: 0.5 }, [0.9, 2.15, -1.0], { mat: M.ss, animate: SPIN }),
    P('Bowl Rim', 'torus', { radius: 0.85, tube: 0.06 }, [0.9, 2.42, -1.0], { rot: [Math.PI / 2, 0, 0], mat: M.ssDull }),
    P('Bowl Column', 'cylinder', { radius: 0.18, height: 1.9 }, [0.9, 1.0, -1.0], { mat: M.frame }),
    // empty bottles tumbling around the bowl (orbiting group, tilted at random)
    { id: 'bpd_bowl', label: 'Bowl Bottles', kind: 'group', position: [0.9, 0, -1.0], rotation: [0, 0, 0], scale: [1, 1, 1], parentId: null, animate: SPIN, material: M.white },
    ...[0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2
      return P('Loose Bottle', 'cylinder', { radius: 0.075, height: 0.24 },
        [Math.cos(a) * 0.55, 2.5, Math.sin(a) * 0.55], { parentId: 'bpd_bowl', rot: [0.5 * Math.sin(a * 3), 0, 0.4 * Math.cos(a * 2)], mat: M.white })
    }),
    // bottles queued down the discharge chute
    ...[0, 1, 2].map((i) => P('Chute Bottle', 'cylinder', { radius: 0.075, height: 0.24 },
      [1.15, 1.75 - i * 0.28, -0.7 + i * 0.28], { rot: [0.6, 0, 0], mat: M.white })),
    // discharge chute: bowl → belt line (z 0) at bed height
    P('Chute', 'box', { width: 0.5, height: 0.1, depth: 1.3 }, [1.15, 1.6, -0.35], { rot: [0.6, 0, 0], mat: M.ssDull }),
    P('Chute Rail L', 'box', { width: 0.04, height: 0.12, depth: 1.3 }, [0.93, 1.68, -0.35], { rot: [0.6, 0, 0], mat: M.frame }),
    P('Chute Rail R', 'box', { width: 0.04, height: 0.12, depth: 1.3 }, [1.37, 1.68, -0.35], { rot: [0.6, 0, 0], mat: M.frame }),
    P('Discharge Deck', 'box', { width: 1.6, height: 0.08, depth: 0.7 }, [1.15, 0.95, 0], { mat: M.ssDull }),
    // guarding + electrics
    ...[[-1.9, 0.2], [1.9, 0.2]].map(([x, z]) => P('Guard Post', 'box', { width: 0.1, height: 2.4, depth: 0.1 }, [x, 1.2, z + 0.6], { mat: M.frame })),
    P('Guard Glass', 'box', { width: 3.9, height: 1.1, depth: 0.05 }, [0, 1.6, 0.85], { mat: M.glass }),
    P('HMI Panel', 'roundedBox', { width: 0.55, height: 0.75, depth: 0.16, bevel: 0.03 }, [-1.9, 1.5, 1.0], { mat: M.dark }),
    ...dial({ pos: [-1.9, 1.82, 1.1] }),
    ...nameplate({ pos: [-0.6, 0.9, 0.9] }),
    ...junctionBox({ pos: [1.7, 0.9, 1.0] }),
  ],
  ports: [port('bottles_out', 'conveyor', 'out', [1.9, 0.95, 0])],
  params: [pr('feedRate', 'Feed Rate', 'bpm', 330, 0, 500, '5s'), pr('hopperLevel', 'Hopper', '%', 66, 0, 100, '5m')],
})

// ── 6. Labeller — proper rotary architecture, scaled to the real bottle
// (0.35 m tall, belt bed 0.95): machine table UNDER the belt → infeed timing
// screw → infeed starwheel → carousel turntable with hold-down bell → vacuum
// label drum fed by a vertical-axis reel/web station → discharge starwheel.
const labeller = spec({
  id: 'bp_labeller', label: 'Labeller', pad: [4.6, 4.2],
  parts: [
    // machine table: solid cabinet whose top deck sits just UNDER the belt line
    P('Base Cabinet', 'roundedBox', { width: 3.4, height: 0.78, depth: 2.2, bevel: 0.06 }, [0, 0.42, -0.35], { mat: M.ss }),
    P('Table Deck', 'box', { width: 3.5, height: 0.05, depth: 2.3 }, [0, 0.855, -0.35], { mat: M.ssDull }),
    // deadplate flush with the belt across the seam + slim bottle guide rails
    P('Deadplate', 'box', { width: 2.5, height: 0.025, depth: 0.5 }, [0, 0.945, 0], { mat: M.ssDull }),
    P('Guide Rail F', 'cylinder', { radius: 0.02, height: 2.5 }, [0, 1.1, 0.26], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('Guide Rail B', 'cylinder', { radius: 0.02, height: 2.5 }, [0, 1.1, -0.26], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    ...[[-1.0, 0.26], [1.0, 0.26], [-1.0, -0.26], [1.0, -0.26]].map(([x, z]) =>
      P('Rail Bracket', 'box', { width: 0.03, height: 0.16, depth: 0.03 }, [x, 1.02, z], { mat: M.frame })),
    // infeed timing screw (spins about its own axis beside the bottles)
    P('Timing Screw', 'cylinder', { radius: 0.07, height: 1.1 }, [-1.35, 1.06, 0.28], { rot: [0, 0, Math.PI / 2], mat: M.white, animate: { kind: 'spinX', speedKey: 'speed', rate: 4 } }),
    ...[0, 1, 2, 3, 4].map((i) => P('Screw Flight', 'torus', { radius: 0.085, tube: 0.018 }, [-1.75 + i * 0.2, 1.06, 0.28], { rot: [0, 0.35, Math.PI / 2], mat: M.white, animate: { kind: 'spinX', speedKey: 'speed' } })),
    P('Screw Bracket A', 'box', { width: 0.05, height: 0.3, depth: 0.2 }, [-1.85, 1.0, 0.3], { mat: M.frame }),
    P('Screw Bracket B', 'box', { width: 0.05, height: 0.3, depth: 0.2 }, [-0.85, 1.0, 0.3], { mat: M.frame }),
    // in/out starwheels — notched discs at bottle-body height, tangent to the lane
    P('Infeed Starwheel', 'cylinder', { radius: 0.34, height: 0.05 }, [-0.85, 1.06, -0.3], { mat: M.blue, animate: SPINR(-2.1) }),
    P('Infeed Star Hub', 'cylinder', { radius: 0.07, height: 0.5 }, [-0.85, 0.95, -0.3], { mat: M.ssDull, animate: SPINR(-2.1) }),
    P('Discharge Starwheel', 'cylinder', { radius: 0.34, height: 0.05 }, [0.85, 1.06, -0.3], { mat: M.blue, animate: SPINR(-2.1) }),
    P('Discharge Star Hub', 'cylinder', { radius: 0.07, height: 0.5 }, [0.85, 0.95, -0.3], { mat: M.ssDull, animate: SPINR(-2.1) }),
    // carousel: turntable under the bottles + hold-down bell above the caps.
    // A spinning GROUP carries mock bottles around the axis — naked on the drum
    // side, labelled after it → you can SEE labels being applied.
    { id: 'bp_caro_group', label: 'Carousel Bottles', kind: 'group', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parentId: null, animate: SPINR(2.0), material: M.ss },
    ...[0, 1, 2, 3, 4, 5].flatMap((i) => {
      const a = (i / 6) * Math.PI * 2, bx = Math.cos(a) * 0.36, bz = Math.sin(a) * 0.36
      const labelled = Math.sin(a) > 0.15   // bottles past the drum (-z side applies) carry a label
      return [
        P('Caro Bottle', 'cylinder', { radius: 0.082, height: 0.26 }, [bx, 1.09, bz], { parentId: 'bp_caro_group', mat: M.white }),
        P('Caro Cap', 'cylinder', { radius: 0.04, height: 0.04 }, [bx, 1.26, bz], { parentId: 'bp_caro_group', mat: M.blue }),
        ...(labelled ? [P('Caro Label', 'cylinder', { radius: 0.086, height: 0.11 }, [bx, 1.06, bz], { parentId: 'bp_caro_group', mat: M.labelTan })] : []),
      ]
    }),
    P('Turntable', 'cylinder', { radius: 0.52, height: 0.035 }, [0, 0.935, 0], { mat: M.bright, animate: SPINR(2.0) }),
    P('Hold-down Bell', 'cone', { radius: 0.42, height: 0.18 }, [0, 1.5, 0], { mat: M.bright, animate: SPINR(2.0) }),
    P('Bell Plate', 'cylinder', { radius: 0.44, height: 0.03 }, [0, 1.42, 0], { mat: M.ssDull, animate: SPINR(2.0) }),
    // C-frame from the station side carries the hold-down spindle (no slab canopy)
    P('Support Column', 'box', { width: 0.22, height: 2.3, depth: 0.22 }, [0, 1.15, -1.35], { mat: M.frame }),
    P('Support Arm', 'box', { width: 0.2, height: 0.16, depth: 1.35 }, [0, 2.22, -0.68], { mat: M.frame }),
    P('Spindle', 'cylinder', { radius: 0.06, height: 0.72 }, [0, 1.84, 0], { mat: M.bright, animate: SPINR(2.0) }),
    // vacuum label drum tangent to the carousel, at label (body) height
    P('Vacuum Drum', 'cylinder', { radius: 0.2, height: 0.42 }, [0, 1.12, -0.55], { mat: M.bright, animate: SPINR(-3.6) }),
    // reel stand: vertical-axis reels with flanges, close to the drum, web strip to it
    P('Reel Table', 'cylinder', { radius: 0.55, height: 0.04 }, [-0.35, 0.98, -1.15], { mat: M.ssDull }),
    P('Reel Table Post', 'cylinder', { radius: 0.07, height: 0.95 }, [-0.35, 0.5, -1.15], { mat: M.frame }),
    P('Label Reel A', 'cylinder', { radius: 0.34, height: 0.09 }, [-0.55, 1.06, -1.25], { mat: M.white, animate: SPIN }),
    P('Reel Flange A', 'cylinder', { radius: 0.37, height: 0.015 }, [-0.55, 1.12, -1.25], { mat: M.bright, animate: SPIN }),
    P('Rewind Reel B', 'cylinder', { radius: 0.18, height: 0.09 }, [0.05, 1.06, -1.35], { mat: M.dark, animate: SPIN }),
    P('Reel Flange B', 'cylinder', { radius: 0.21, height: 0.015 }, [0.05, 1.12, -1.35], { mat: M.bright, animate: SPIN }),
    // label web: a visible tape running reel → rollers → drum
    P('Web Strip A', 'box', { width: 0.55, height: 0.11, depth: 0.008 }, [-0.35, 1.1, -0.92], { rot: [0, 0.5, 0], mat: M.white }),
    P('Web Strip B', 'box', { width: 0.35, height: 0.11, depth: 0.008 }, [-0.08, 1.1, -0.68], { rot: [0, 0.9, 0], mat: M.white }),
    ...[[-0.2, -0.82], [0.05, -0.6]].map(([x, z], i) =>
      P(`Web Roller ${i + 1}`, 'cylinder', { radius: 0.03, height: 0.4 }, [x, 1.1, z], { mat: M.bright, animate: SPIN })),
    // guarding: corner posts + clear panels (ends open for the belt)
    ...[[-1.75, 0.75], [1.75, 0.75], [-1.75, -1.85], [1.75, -1.85]].map(([x, z]) =>
      P('Guard Post', 'box', { width: 0.09, height: 1.9, depth: 0.09 }, [x, 0.95, z], { mat: M.frame })),
    P('Guard Front', 'box', { width: 3.5, height: 1.0, depth: 0.04 }, [0, 1.45, 0.75], { mat: M.glass }),
    P('Guard Rear', 'box', { width: 3.5, height: 1.0, depth: 0.04 }, [0, 1.45, -1.85], { mat: M.glass }),
    // HMI on an arm from the front-right post + status beacon
    P('HMI Arm', 'box', { width: 0.06, height: 0.06, depth: 0.4 }, [1.75, 1.7, 0.95], { mat: M.frame }),
    P('HMI Panel', 'roundedBox', { width: 0.5, height: 0.62, depth: 0.14, bevel: 0.03 }, [1.75, 1.55, 1.25], { mat: M.dark }),
    P('HMI Screen', 'box', { width: 0.36, height: 0.4, depth: 0.02 }, [1.75, 1.6, 1.33], { mat: { color: '#9fd0ff', metalness: 0.2, roughness: 0.2, emissive: '#5b9fd8', emissiveIntensity: 0.5 } }),
    P('Beacon', 'sphere', { radius: 0.06 }, [1.75, 2.02, 0.75], { mat: { ...M.amber, emissive: '#ffb020', emissiveIntensity: 1.4 }, animate: PULSE }),
    ...nameplate({ pos: [-1.2, 0.6, 0.78] }),
    ...junctionBox({ pos: [1.3, 0.5, 0.78] }),
  ],
  ports: [port('bottles_in', 'conveyor', 'in', [-2.3, 0.95, 0]), port('bottles_out', 'conveyor', 'out', [2.3, 0.95, 0])],
  params: [pr('labelRate', 'Rate', 'bpm', 315, 0, 500, '5s'), pr('reelRemaining', 'Reel', '%', 62, 0, 100, '15m'), pr('missingLabel', 'Missed', '%', 0.2, 0, 3, '15m')],
})

// ── 7. Case Packer ──
const casePacker = spec({
  id: 'bp_case_packer', label: 'Case Packer', pad: [5.6, 4.6],
  parts: [
    P('Enclosure', 'roundedBox', { width: 4.2, height: 2.6, depth: 3.4, bevel: 0.08 }, [0, 1.55, 0], { mat: M.ss }),
    ...[[-2.05, -1.65], [2.05, -1.65], [-2.05, 1.65], [2.05, 1.65]].map(([x, z]) =>
      P('Corner Post', 'box', { width: 0.12, height: 2.7, depth: 0.12 }, [x, 1.55, z], { mat: M.frame })),
    P('Window F', 'box', { width: 1.8, height: 1.0, depth: 0.04 }, [-0.6, 1.75, 1.73], { mat: M.glass }),
    P('Window S', 'box', { width: 0.04, height: 1.0, depth: 1.6 }, [2.13, 1.75, 0], { mat: M.glass }),
    // visible machinery behind the window: pusher ram + grouping grid
    P('Pusher Ram', 'box', { width: 0.9, height: 0.3, depth: 0.3 }, [-0.6, 1.5, 0.6], { mat: M.blue, animate: { kind: 'bob', speedKey: 'speed' } }),
    P('Grouping Grid', 'box', { width: 1.1, height: 0.05, depth: 1.0 }, [-0.4, 1.15, 0.2], { mat: M.ssDull }),
    P('Infeed Funnel L', 'box', { width: 1.4, height: 0.5, depth: 0.06 }, [-2.6, 1.15, 0.35], { rot: [0, 0.35, 0], mat: M.ssDull }),
    P('Infeed Funnel R', 'box', { width: 1.4, height: 0.5, depth: 0.06 }, [-2.6, 1.15, -0.35], { rot: [0, -0.35, 0], mat: M.ssDull }),
    // film wrap unit on the roof
    P('Film Roll', 'cylinder', { radius: 0.3, height: 1.8 }, [0, 3.05, 0], { rot: [Math.PI / 2, 0, 0], mat: M.paint, animate: SPIN }),
    P('Film Idler', 'cylinder', { radius: 0.09, height: 1.8 }, [0.55, 2.95, 0], { rot: [Math.PI / 2, 0, 0], mat: M.ssDull, animate: SPIN }),
    P('Heat Bar', 'box', { width: 0.16, height: 0.12, depth: 1.8 }, [0.95, 2.9, 0], { mat: { ...M.red, emissive: '#ff5200', emissiveIntensity: 0.6 } }),
    P('Roll Stand A', 'box', { width: 0.08, height: 0.5, depth: 0.08 }, [0, 2.85, 0.95], { mat: M.frame }),
    P('Roll Stand B', 'box', { width: 0.08, height: 0.5, depth: 0.08 }, [0, 2.85, -0.95], { mat: M.frame }),
    // discharge roller conveyor with cases
    ...[0, 1, 2, 3, 4, 5].map((i) => P('Out Roller', 'cylinder', { radius: 0.05, height: 0.7 },
      [2.35 + i * 0.42, 0.56, 0], { rot: [Math.PI / 2, 0, 0], mat: M.ssDull, animate: SPIN })),
    P('Roller Frame L', 'box', { width: 2.7, height: 0.06, depth: 0.05 }, [3.4, 0.56, 0.38], { mat: M.frame }),
    P('Roller Frame R', 'box', { width: 2.7, height: 0.06, depth: 0.05 }, [3.4, 0.56, -0.38], { mat: M.frame }),
    ...[0, 1].map((i) => P('Roller Leg', 'box', { width: 0.07, height: 0.53, depth: 0.07 }, [2.6 + i * 1.6, 0.27, 0.3], { mat: M.frame })),
    ...[0, 1, 2].map((i) => P(`Out Case ${i + 1}`, 'roundedBox', { width: 0.62, height: 0.5, depth: 0.42, bevel: 0.03 }, [2.6 + i * 0.75, 0.88, 0], { mat: M.cabY })),
    P('Status Beacon', 'sphere', { radius: 0.08 }, [2.05, 3.0, 1.65], { mat: { ...M.amber, emissive: '#ffb020', emissiveIntensity: 1.4 }, animate: PULSE }),
    ...dial({ pos: [1.6, 2.1, 1.74] }),
    ...dial({ pos: [1.1, 2.1, 1.74] }),
    ...nameplate({ pos: [0.8, 1.0, 1.74] }),
    ...junctionBox({ pos: [-1.8, 0.8, 1.74] }),
  ],
  ports: [port('bottles_in', 'conveyor', 'in', [-2.9, 0.95, 0]), port('cases_out', 'conveyor', 'out', [4.6, 0.6, 0])],
  params: [pr('caseRate', 'Cases', 'cpm', 26, 0, 60, '30s'), pr('filmRemaining', 'Film', '%', 47, 0, 100, '15m')],
})

// ── 8. Palletiser ──
const palletiser = spec({
  id: 'bp_palletiser', label: 'Palletiser', pad: [5.6, 5.6],
  parts: [
    ...[[-2, -2], [2, -2], [-2, 2], [2, 2]].map(([x, z]) => P('Column', 'ibeam', { width: 0.24, height: 0.3, depth: 4.4 }, [x, 2.2, z], { rot: [Math.PI / 2, 0, 0], mat: M.frame })),
    P('Top Frame', 'box', { width: 4.5, height: 0.25, depth: 4.5 }, [0, 4.45, 0], { mat: M.frame }),
    P('Hoist Guide A', 'box', { width: 0.1, height: 4.0, depth: 0.1 }, [-0.75, 2.3, 0], { mat: M.frame }),
    P('Hoist Guide B', 'box', { width: 0.1, height: 4.0, depth: 0.1 }, [0.75, 2.3, 0], { mat: M.frame }),
    P('Hoist Carriage', 'roundedBox', { width: 1.6, height: 0.5, depth: 1.6, bevel: 0.05 }, [0, 3.4, 0], { mat: M.blue, animate: BOB }),
    // rotary stretch-wrap arm orbiting the pallet (boom + arm + film roll)
    { id: 'bpp_wrap', label: 'Wrap Arm', kind: 'group', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parentId: null, animate: SPIN, material: M.frame },
    P('Wrap Boom', 'box', { width: 1.5, height: 0.14, depth: 0.14 }, [0.75, 4.2, 0], { parentId: 'bpp_wrap', mat: M.frame }),
    P('Wrap Arm', 'box', { width: 0.12, height: 3.1, depth: 0.12 }, [1.5, 2.6, 0], { parentId: 'bpp_wrap', mat: M.frame }),
    P('Film Carriage', 'roundedBox', { width: 0.3, height: 0.5, depth: 0.26, bevel: 0.03 }, [1.5, 1.5, 0], { parentId: 'bpp_wrap', mat: M.blue }),
    P('Wrap Film Roll', 'cylinder', { radius: 0.11, height: 0.45 }, [1.5, 1.5, 0.22], { parentId: 'bpp_wrap', mat: M.white }),
    P('Pallet', 'box', { width: 1.7, height: 0.16, depth: 1.35 }, [0, 0.42, 0], { mat: M.trunk }),
    ...[0, 1, 2].flatMap((layer) => [0, 1].flatMap((r) => [0, 1, 2].map((c) =>
      P('Case', 'roundedBox', { width: 0.52, height: 0.44, depth: 0.6, bevel: 0.03 }, [-0.56 + c * 0.56, 0.75 + layer * 0.46, -0.33 + r * 0.66], { mat: M.cabY })))),
    ...handrail({ from: [-2.6, 0.25, 2.6], to: [2.6, 0.25, 2.6] }),
    ...nameplate({ pos: [2.0, 1.0, 2.13] }),
    ...junctionBox({ pos: [-2.3, 1.2, 2.32] }),
  ],
  ports: [port('cases_in', 'conveyor', 'in', [-2.9, 0.6, 0]), port('pallets_out', 'conveyor', 'out', [0, 0.3, 2.9])],
  params: [pr('palletRate', 'Pallets', 'pph', 18, 0, 40, '5m'), pr('layerCount', 'Layers', '', 3, 0, 6, '5m')],
})

// ── 9. Production hall (cut-away: walls + window band + roof trusses) ──
const hallParts = []
const HW = 56, HD = 26, WH = 4.6
// perimeter walls with a window band (front wall has a doorway gap)
hallParts.push(
  P('Wall Back', 'box', { width: HW, height: WH, depth: 0.35 }, [0, WH / 2, -HD / 2], { mat: M.wall }),
  P('Wall Left', 'box', { width: 0.35, height: WH, depth: HD }, [-HW / 2, WH / 2, 0], { mat: M.wall }),
  P('Wall Right', 'box', { width: 0.35, height: WH, depth: HD }, [HW / 2, WH / 2, 0], { mat: M.wall }),
  P('Wall Front L', 'box', { width: HW * 0.42, height: WH, depth: 0.35 }, [-HW * 0.29, WH / 2, HD / 2], { mat: M.wall }),
  P('Wall Front R', 'box', { width: HW * 0.42, height: WH, depth: 0.35 }, [HW * 0.29, WH / 2, HD / 2], { mat: M.wall }),
  P('Door Lintel', 'box', { width: HW * 0.16, height: 1.1, depth: 0.35 }, [0, WH - 0.55, HD / 2], { mat: M.wall }),
  P('Window Band F', 'box', { width: HW * 0.8, height: 0.9, depth: 0.1 }, [0, 3.1, HD / 2 + 0.02], { mat: M.glass }),
  P('Window Band B', 'box', { width: HW * 0.9, height: 0.9, depth: 0.1 }, [0, 3.1, -HD / 2 - 0.02], { mat: M.glass }),
)
// fully open top — no roof structure (trusses/purlins/skylights removed so the
// plant reads clean from above; walls + window bands remain).
const hall = spec({
  id: 'bp_hall', label: 'Production Hall', layer: 'structural', parts: hallParts,
  params: [pr('hallTemp', 'Hall Temp', '°C', 18, 0, 35, '5m')],
})

// ── 10. Office block (cut-away floor plan like the reference) ──
const officeParts = []
const OW = 20, OD = 26
officeParts.push(
  P('Office Slab', 'box', { width: OW, height: 0.3, depth: OD }, [0, 0.15, 0], { mat: M.concrete }),
  P('O Wall N', 'box', { width: OW, height: 3, depth: 0.3 }, [0, 1.5, -OD / 2], { mat: M.wall }),
  P('O Wall S', 'box', { width: OW, height: 3, depth: 0.3 }, [0, 1.5, OD / 2], { mat: M.wall }),
  P('O Wall W', 'box', { width: 0.3, height: 3, depth: OD }, [-OW / 2, 1.5, 0], { mat: M.wall }),
)
// interior partitions — corridor down the middle + offices off it
officeParts.push(P('Corridor Wall A', 'box', { width: 0.18, height: 2.6, depth: OD - 4 }, [-2, 1.3, 0], { mat: M.wallIn }))
officeParts.push(P('Corridor Wall B', 'box', { width: 0.18, height: 2.6, depth: OD - 4 }, [2, 1.3, 0], { mat: M.wallIn }))
for (let i = 0; i < 5; i++) {
  const z = -OD / 2 + 3 + i * 5
  officeParts.push(P('Partition L', 'box', { width: OW / 2 - 2.2, height: 2.6, depth: 0.16 }, [-(OW / 4 + 1), 1.3, z], { mat: M.wallIn }))
  officeParts.push(P('Partition R', 'box', { width: OW / 2 - 2.2, height: 2.6, depth: 0.16 }, [OW / 4 + 1, 1.3, z], { mat: M.wallIn }))
}
// furniture in each room (cut-away detail): desk + chair + cabinet
for (let i = 0; i < 4; i++) {
  const z = -OD / 2 + 5.5 + i * 5
  for (const s of [-1, 1]) {
    const x = s * (OW / 4 + 1)
    officeParts.push(
      P('Desk', 'box', { width: 1.5, height: 0.08, depth: 0.7 }, [x, 0.75, z], { mat: M.trunk }),
      P('Desk Legs', 'box', { width: 1.4, height: 0.7, depth: 0.08 }, [x, 0.38, z - 0.28], { mat: M.frame }),
      P('Monitor', 'box', { width: 0.5, height: 0.32, depth: 0.04 }, [x, 1.0, z - 0.15], { mat: M.dark }),
      P('Chair Seat', 'box', { width: 0.45, height: 0.08, depth: 0.45 }, [x, 0.48, z + 0.7], { mat: M.blue }),
      P('Chair Back', 'box', { width: 0.45, height: 0.5, depth: 0.07 }, [x, 0.8, z + 0.9], { mat: M.blue }),
      P('Cabinet', 'roundedBox', { width: 0.5, height: 1.1, depth: 0.45, bevel: 0.03 }, [x + s * 2.4, 0.55, z], { mat: M.wallIn }),
    )
  }
}
const office = spec({
  id: 'bp_office', label: 'Office Block', layer: 'structural', parts: officeParts,
  params: [pr('occupancy', 'Occupancy', '', 34, 0, 80, '15m')],
})

// ── 11. Milk tanker truck ──
const truck = spec({
  id: 'bp_truck', label: 'Milk Tanker', layer: 'structural', noNozzles: true,
  parts: [
    P('Chassis', 'box', { width: 7.6, height: 0.3, depth: 1.9 }, [0, 0.75, 0], { mat: M.dark }),
    P('Cab', 'roundedBox', { width: 1.9, height: 1.7, depth: 2.1, bevel: 0.12 }, [-2.9, 1.75, 0], { mat: M.cabY }),
    P('Windshield', 'box', { width: 0.06, height: 0.7, depth: 1.7 }, [-3.82, 2.05, 0], { mat: M.glass }),
    P('Tank', 'capsule', { radius: 1.05, height: 5.4 }, [1, 2.0, 0], { rot: [0, 0, Math.PI / 2], mat: M.ss }),
    P('Tank Band A', 'torus', { radius: 1.07, tube: 0.035 }, [-0.4, 2.0, 0], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('Tank Band B', 'torus', { radius: 1.07, tube: 0.035 }, [2.4, 2.0, 0], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('Manhole', 'cylinder', { radius: 0.3, height: 0.2 }, [1, 3.1, 0], { mat: M.ssDull }),
    P('Top Walkway', 'box', { width: 3.4, height: 0.05, depth: 0.4 }, [1, 3.06, 0.55], { mat: M.frame }),
    P('Rear Ladder', 'box', { width: 0.07, height: 1.9, depth: 0.4 }, [3.85, 1.95, 0.6], { mat: M.frame }),
    P('Fuel Tank', 'cylinder', { radius: 0.3, height: 1.1 }, [-1.6, 0.95, 0.95], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('Exhaust Stack', 'cylinder', { radius: 0.07, height: 1.3 }, [-2.0, 2.2, -0.95], { mat: M.dark }),
    P('Mirror Arm', 'box', { width: 0.3, height: 0.04, depth: 0.04 }, [-3.85, 2.45, 0.95], { rot: [0, 0.5, 0], mat: M.dark }),
    P('Mirror L', 'box', { width: 0.05, height: 0.35, depth: 0.2 }, [-3.95, 2.35, 1.05], { mat: M.dark }),
    P('Headlight L', 'sphere', { radius: 0.09 }, [-3.86, 1.25, 0.7], { mat: { ...M.paint, emissive: '#fff6d8', emissiveIntensity: 0.8 } }),
    P('Headlight R', 'sphere', { radius: 0.09 }, [-3.86, 1.25, -0.7], { mat: { ...M.paint, emissive: '#fff6d8', emissiveIntensity: 0.8 } }),
    P('Hose Cabinet', 'roundedBox', { width: 0.9, height: 0.5, depth: 0.4, bevel: 0.04 }, [2.6, 1.05, 0.95], { mat: M.cabY }),
    // unloading hose deployed from the cabinet to a ground coupling (milk intake)
    P('Unload Hose A', 'cylinder', { radius: 0.06, height: 1.3 }, [2.9, 0.7, 1.5], { rot: [0.7, 0, 0.3], mat: M.dark }),
    P('Unload Hose B', 'cylinder', { radius: 0.06, height: 0.9 }, [3.3, 0.25, 2.1], { rot: [1.35, 0, 0.15], mat: M.dark }),
    P('Hose Coupling', 'cylinder', { radius: 0.09, height: 0.18 }, [3.55, 0.12, 2.5], { rot: [Math.PI / 2, 0, 0], mat: M.bright }),
    ...[-2.9, -0.4, 1.4, 3.0].flatMap((x) => [[x, 0.95], [x, -0.95]]).map(([x, z]) =>
      P('Wheel', 'cylinder', { radius: 0.55, height: 0.35 }, [x, 0.55, z], { rot: [Math.PI / 2, 0, 0], mat: M.tyre })),
    ...[-2.9, -0.4, 1.4, 3.0].flatMap((x) => [[x, 1.14], [x, -1.14]]).map(([x, z]) =>
      P('Hub', 'cylinder', { radius: 0.18, height: 0.06 }, [x, 0.55, z], { rot: [Math.PI / 2, 0, 0], mat: M.ssDull })),
    ...boltCircle({ center: [3.9, 1.4, 0], r: 0.3, n: 6, axis: 'x' }),
  ],
  params: [pr('loadLevel', 'Load', '%', 88, 0, 100, '15m')],
})

// ── 12. Yard: parking + green strip ──
const parking = spec({
  id: 'bp_parking', label: 'Parking / Yard', layer: 'structural', noNozzles: true, ground: true,
  parts: [
    P('Apron', 'box', { width: 40, height: 0.08, depth: 14 }, [0, 0.04, 0], { mat: M.asphalt }),
    ...[0, 1, 2, 3, 4].map((i) => P('Bay Line', 'box', { width: 0.14, height: 0.03, depth: 8 }, [-14 + i * 7, 0.09, -1], { mat: M.paint })),
    P('Kerb', 'box', { width: 40, height: 0.18, depth: 0.3 }, [0, 0.09, 7.1], { mat: M.concrete }),
  ],
})
const green = spec({
  id: 'bp_green', label: 'Green Strip', layer: 'structural', noNozzles: true, ground: true,
  parts: [
    P('Lawn', 'box', { width: 90, height: 0.06, depth: 10 }, [0, 0.03, 0], { mat: M.grass }),
    ...[-30, -10, 10, 30].flatMap((x) => [
      P('Trunk', 'cylinder', { radius: 0.14, height: 1.2 }, [x, 0.6, 0], { mat: M.trunk }),
      P('Canopy', 'cone', { radius: 1.2, height: 2.2 }, [x, 2.4, 0], { mat: M.leaf }),
    ]),
  ],
})

// ── 7b. Lane Divider — fans 1 lane out to 4 (image-4 style diverging rails) ──
const laneDivider = spec({
  id: 'bp_lane_divider', label: 'Lane Divider', pad: [2.6, 2.2],
  parts: [
    P('Divider Deck', 'box', { width: 2.0, height: 0.05, depth: 1.4 }, [0, 0.925, 0], { mat: M.ssDull }),
    ...[[-0.55, 0], [0.55, 0]].flatMap(([x]) => [
      P('Deck Leg A', 'box', { width: 0.08, height: 0.9, depth: 0.08 }, [x, 0.45, 0.55], { mat: M.frame }),
      P('Deck Leg B', 'box', { width: 0.08, height: 0.9, depth: 0.08 }, [x, 0.45, -0.55], { mat: M.frame }),
    ]),
    // fanning guide rails: single lane in (−X) → 4 lanes out (+X)
    ...[-0.45, -0.15, 0.15, 0.45].flatMap((zOut, i) => {
      const yaw = Math.atan2(zOut, 1.9)
      return [P(`Fan Rail ${i + 1}`, 'cylinder', { radius: 0.018, height: 2.0 },
        [0, 1.08, zOut / 2], { rot: [0, -yaw, Math.PI / 2], mat: M.bright })]
    }),
    P('Fan Rail Outer A', 'cylinder', { radius: 0.018, height: 2.0 }, [0, 1.08, 0.32], { rot: [0, -Math.atan2(0.62, 1.9), Math.PI / 2], mat: M.bright }),
    P('Fan Rail Outer B', 'cylinder', { radius: 0.018, height: 2.0 }, [0, 1.08, -0.32], { rot: [0, Math.atan2(0.62, 1.9), Math.PI / 2], mat: M.bright }),
    ...nameplate({ pos: [0, 0.7, 0.72] }),
  ],
  ports: [port('bottles_in', 'conveyor', 'in', [-1.0, 0.95, 0]), port('bottles_out', 'conveyor', 'out', [1.0, 0.95, 0])],
  params: [pr('lanesOpen', 'Lanes Open', '', 4, 0, 4, '15m')],
})

// ── 8b. Valve Matrix — the dairy "valve forest" (reference close-up): a grid of
// vertical valve bodies with dome actuators, tied together by header pipes at two
// levels with vertical drops, on a floor frame.
const vmxParts = []
const VC = 7, VR = 3, PITCH = 0.44
for (let c = 0; c < VC; c++) for (let r = 0; r < VR; r++) {
  const x = (c - (VC - 1) / 2) * PITCH, z = (r - (VR - 1) / 2) * PITCH
  const actuating = (c + r) % 3 === 0   // a third of the valves visibly stroke
  vmxParts.push(
    P('Valve Body', 'cylinder', { radius: 0.065, height: 0.5 }, [x, 1.15, z], { mat: M.ss }),
    P('Valve Dome', 'sphere', { radius: 0.075 }, [x, 1.45, z], { mat: M.ssDull }),
    P('Actuator Cap', 'cylinder', { radius: 0.05, height: 0.14 }, [x, 1.56, z], { mat: actuating ? M.bright : M.ss, ...(actuating ? { animate: BOB } : {}) }),
  )
}
for (let r = 0; r < VR; r++) {
  const z = (r - (VR - 1) / 2) * PITCH
  vmxParts.push(P('Header Pipe', 'cylinder', { radius: 0.045, height: VC * PITCH + 0.5 }, [0, 0.88, z], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }))
}
for (const c of [0, 3, 6]) {
  const x = (c - (VC - 1) / 2) * PITCH
  vmxParts.push(P('Cross Pipe', 'cylinder', { radius: 0.045, height: VR * PITCH + 0.4 }, [x, 0.7, 0], { rot: [Math.PI / 2, 0, 0], mat: M.ssDull }))
}
for (const [x, z] of [[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.5], [1.4, 0.5]]) {
  vmxParts.push(P('Drop Pipe', 'cylinder', { radius: 0.045, height: 0.7 }, [x, 0.35, z], { mat: M.ssDull }))
}
vmxParts.push(
  P('Frame Rail A', 'box', { width: VC * PITCH + 0.4, height: 0.08, depth: 0.08 }, [0, 0.5, -0.66], { mat: M.frame }),
  P('Frame Rail B', 'box', { width: VC * PITCH + 0.4, height: 0.08, depth: 0.08 }, [0, 0.5, 0.66], { mat: M.frame }),
)
const valveMatrix = spec({
  id: 'bp_valve_matrix', label: 'Valve Matrix', pad: [4.2, 2.4],
  parts: [...vmxParts, ...nameplate({ pos: [1.5, 0.6, 0.72] })],
  ports: [port('milk_in', 'utility', 'in', [-1.9, 0.9, 0]), port('milk_out', 'utility', 'out', [1.9, 0.9, 0])],
  params: [pr('routesActive', 'Routes', '', 6, 0, 21, '1m'), pr('cipMode', 'CIP Mode', '', 0, 0, 1, '5m')],
})

// ── 8c. Pump Row — staggered floor pumps (reference bottom-left) ──
const pumpRowParts = []
for (let i = 0; i < 5; i++) {
  const x = -1.7 + i * 0.85, z = -0.5 + i * 0.28
  pumpRowParts.push(
    P('Pump Base', 'box', { width: 0.7, height: 0.12, depth: 0.34 }, [x, 0.06, z], { mat: M.concrete }),
    P('Pump Motor', 'cylinder', { radius: 0.16, height: 0.5 }, [x - 0.12, 0.32, z], { rot: [0, 0, Math.PI / 2], mat: M.ssDull, animate: SPIN }),
    P('Volute', 'cylinder', { radius: 0.14, height: 0.18 }, [x + 0.28, 0.32, z], { rot: [0, 0, Math.PI / 2], mat: M.ss }),
    P('Discharge Riser', 'cylinder', { radius: 0.05, height: 0.7 }, [x + 0.38, 0.72, z], { mat: M.ssDull }),
  )
}
const pumpRow = spec({
  id: 'bp_pump_row', label: 'Transfer Pumps', pad: [5, 2.6],
  parts: [...pumpRowParts, ...junctionBox({ pos: [2.1, 0.7, 0.9] }), ...nameplate({ pos: [-2.1, 0.5, 0.9] })],
  ports: [port('milk_in', 'utility', 'in', [-2.4, 0.4, 0]), port('milk_out', 'utility', 'out', [2.4, 0.4, 0])],
  params: [pr('pumpsRunning', 'Running', '', 4, 0, 5, '1m'), pr('dischargeBar', 'Discharge', 'bar', 3.2, 0, 8, '30s')],
})

// ── 8d. Buffer Tank — reference-style: legs, dished head, LEVEL STRIP, sight
// port, agitator stub, swept pipe drop over the side, side pump at the base.
const bufferTank = spec({
  id: 'bp_buffer_tank', label: 'Buffer Tank', pad: [3.4, 3.4],
  parts: [
    ...[[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].map(([x, z]) =>
      P('Tank Leg', 'box', { width: 0.16, height: 1.0, depth: 0.16 }, [x, 0.5, z], { rot: [x * 0.12, 0, -z * 0.12], mat: M.ssDull })),
    P('Bottom Cone', 'cone', { radius: 0.95, height: 0.6 }, [0, 1.05, 0], { rot: [Math.PI, 0, 0], mat: M.ss }),
    P('Tank Body', 'vessel', { radius: 1.0, height: 3.0 }, [0, 2.85, 0], { mat: M.ss }),
    P('Agitator Stub', 'cylinder', { radius: 0.12, height: 0.5 }, [0, 4.55, 0], { mat: M.ssDull, animate: SPIN }),
    P('Top Nut', 'box', { width: 0.22, height: 0.1, depth: 0.22 }, [0, 4.4, 0], { mat: M.ssDull }),
    // level indicator strip (the yellow/orange stripe in the reference)
    P('Strip Housing', 'box', { width: 0.14, height: 2.6, depth: 0.06 }, [0, 2.8, 1.02], { mat: M.dark }),
    P('Level Strip', 'box', { width: 0.07, height: 2.4, depth: 0.03 }, [0, 2.8, 1.06], { mat: { ...M.amber, emissive: '#e0a225', emissiveIntensity: 0.35 }, animate: PULSE }),
    // sight port
    P('Sight Frame', 'roundedBox', { width: 0.3, height: 0.4, depth: 0.08, bevel: 0.03 }, [0.75, 2.4, 0.72], { rot: [0, -0.6, 0], mat: M.dark }),
    P('Sight Glass', 'box', { width: 0.18, height: 0.26, depth: 0.04 }, [0.78, 2.4, 0.75], { rot: [0, -0.6, 0], mat: { color: '#5b2440', metalness: 0.3, roughness: 0.2 } }),
    // swept pipe: top → over the side → floor
    P('Pipe Top', 'cylinder', { radius: 0.05, height: 0.5 }, [-0.5, 4.6, 0], { mat: M.ssDull }),
    P('Pipe Sweep', 'cylinder', { radius: 0.05, height: 1.1 }, [-1.05, 4.75, 0], { rot: [0, 0, Math.PI / 2], mat: M.ssDull }),
    P('Pipe Elbow', 'sphere', { radius: 0.07 }, [-1.6, 4.75, 0], { mat: M.ssDull }),
    P('Pipe Drop', 'cylinder', { radius: 0.05, height: 4.3 }, [-1.6, 2.6, 0], { mat: M.ssDull }),
    // side discharge pump at the base
    P('Outlet Pump', 'cylinder', { radius: 0.14, height: 0.5 }, [0.55, 0.5, 1.0], { rot: [0.5, 0, Math.PI / 2], mat: M.ssDull, animate: SPIN }),
    ...dial({ pos: [-0.7, 1.9, 0.78], face: 'z' }),
    ...nameplate({ pos: [0.5, 1.6, 0.9] }),
  ],
  ports: [port('milk_in', 'utility', 'in', [-1.6, 0.4, 0]), port('milk_out', 'utility', 'out', [0.9, 0.4, 1.2])],
  params: [pr('level', 'Level', '%', 52, 0, 100, '1m'), pr('temp', 'Temp', '°C', 5, 0, 15, '5m')],
})

// ── 8e. Homogeniser (high-pressure plunger block) ──
const homogeniser = spec({
  id: 'bp_homogeniser', label: 'Homogeniser', pad: [4, 3.2],
  parts: [
    P('Body', 'roundedBox', { width: 2.2, height: 1.3, depth: 1.6, bevel: 0.08 }, [0, 0.9, 0], { mat: M.ss }),
    P('Drive Motor', 'cylinder', { radius: 0.42, height: 1.1 }, [-1.5, 0.9, 0], { rot: [0, 0, Math.PI / 2], mat: M.blue, animate: SPIN }),
    ...[0, 1, 2].map((i) => P(`Plunger ${i + 1}`, 'cylinder', { radius: 0.09, height: 0.5 }, [0.6, 1.8, -0.45 + i * 0.45], { mat: M.bright, animate: BOB })),
    P('HP Head', 'roundedBox', { width: 0.6, height: 0.55, depth: 1.5, bevel: 0.05 }, [1.05, 1.35, 0], { mat: M.ssDull }),
    ...boltCircle({ center: [1.36, 1.35, 0], r: 0.2, n: 6, axis: 'x' }),
    ...dial({ pos: [0.2, 1.75, 0.82] }),
    ...dial({ pos: [-0.3, 1.75, 0.82] }),
    ...nameplate({ pos: [0.7, 0.8, 0.82] }),
    ...junctionBox({ pos: [-1.5, 0.5, 0.9] }),
  ],
  ports: [port('milk_in', 'utility', 'in', [-1.1, 1.4, -0.8]), port('milk_out', 'utility', 'out', [1.4, 1.35, 0.4])],
  params: [pr('pressure', 'Pressure', 'bar', 180, 0, 250, '5s'), pr('flow', 'Flow', 'L/h', 11500, 0, 18000, '1m')],
})

// ── 8f. Cream Separator (centrifuge) ──
const separator = spec({
  id: 'bp_separator', label: 'Separator', pad: [3.4, 3.4],
  parts: [
    P('Base Frame', 'roundedBox', { width: 1.8, height: 0.5, depth: 1.8, bevel: 0.06 }, [0, 0.5, 0], { mat: M.frame }),
    P('Bowl', 'vessel', { radius: 0.75, height: 1.3 }, [0, 1.6, 0], { mat: M.ss, animate: SPIN }),
    P('Bowl Hood', 'cone', { radius: 0.75, height: 0.55 }, [0, 2.5, 0], { mat: M.ssDull }),
    P('Inlet Column', 'cylinder', { radius: 0.08, height: 1.0 }, [0, 3.2, 0], { mat: M.ssDull }),
    P('Drive Housing', 'cylinder', { radius: 0.35, height: 0.7 }, [0.9, 0.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.blue, animate: SPIN }),
    ...boltCircle({ center: [0, 2.28, 0], r: 0.62, n: 10, axis: 'y' }),
    ...dial({ pos: [0.6, 1.5, 0.6] }),
    ...nameplate({ pos: [-0.6, 0.9, 0.92] }),
  ],
  ports: [port('milk_in', 'utility', 'in', [0, 3.6, 0]), port('milk_out', 'utility', 'out', [1.0, 1.2, 0.5])],
  params: [pr('bowlSpeed', 'Bowl', 'rpm', 6500, 0, 8000, '5s'), pr('creamFat', 'Cream Fat', '%', 40, 0, 60, '15m')],
})

// ── 8g. Overhead pipe rack segment (plant-wide pipe runs) ──
const rackParts = []
const RACK_L = 8
for (const x of [-RACK_L / 2 + 0.4, RACK_L / 2 - 0.4]) {
  rackParts.push(P('Rack Post', 'box', { width: 0.12, height: 3.2, depth: 0.12 }, [x, 1.6, 0], { mat: M.frame }))
  rackParts.push(P('Rack Arm', 'box', { width: 0.12, height: 0.1, depth: 1.2 }, [x, 3.1, 0], { mat: M.frame }))
}
const RACK_PIPES = [['#f2efe6', 0.09], ['#f2efe6', 0.07], ['#b05ec8', 0.06], ['#5b7fd4', 0.07], ['#c8d2da', 0.05]]
RACK_PIPES.forEach(([color, r], i) => {
  rackParts.push(P('Rack Pipe', 'cylinder', { radius: r, height: RACK_L }, [0, 3.28, -0.44 + i * 0.22],
    { rot: [0, 0, Math.PI / 2], mat: { color, metalness: 0.6, roughness: 0.35 } }))
})
const pipeRack = spec({
  id: 'bp_pipe_rack', label: 'Pipe Rack', layer: 'piping', noNozzles: true,
  parts: rackParts,
  params: [pr('lines', 'Lines', '', 5, 0, 8, '1h')],
})

// ── 8h. Forklift + pallet stack (yard/warehouse corner) ──
const forklift = spec({
  id: 'bp_forklift', label: 'Forklift', layer: 'structural',
  parts: [
    P('Body', 'roundedBox', { width: 1.5, height: 0.9, depth: 1.1, bevel: 0.08 }, [0, 0.75, 0], { mat: M.cabY }),
    P('Cage', 'box', { width: 1.0, height: 1.0, depth: 1.0 }, [-0.1, 1.8, 0], { mat: M.frame }),
    P('Counterweight', 'roundedBox', { width: 0.5, height: 0.6, depth: 1.0, bevel: 0.06 }, [-0.95, 0.6, 0], { mat: M.dark }),
    P('Mast', 'box', { width: 0.12, height: 2.2, depth: 0.7 }, [0.95, 1.1, 0], { mat: M.frame }),
    P('Fork L', 'box', { width: 1.0, height: 0.05, depth: 0.12 }, [1.55, 0.15, 0.25], { mat: M.dark }),
    P('Fork R', 'box', { width: 1.0, height: 0.05, depth: 0.12 }, [1.55, 0.15, -0.25], { mat: M.dark }),
    ...[[-0.55, 0.62], [0.55, 0.62], [-0.55, -0.62], [0.55, -0.62]].map(([x, z]) =>
      P('Wheel', 'cylinder', { radius: 0.28, height: 0.2 }, [x, 0.28, z], { rot: [Math.PI / 2, 0, 0], mat: M.tyre })),
    P('Beacon', 'sphere', { radius: 0.07 }, [-0.1, 2.4, 0], { mat: { ...M.amber, emissive: '#ffb020', emissiveIntensity: 1.5 }, animate: PULSE }),
  ],
  params: [pr('battery', 'Battery', '%', 76, 0, 100, '15m')],
})
const palletStack = spec({
  id: 'bp_pallet_stack', label: 'Pallet Stack', layer: 'structural',
  parts: [
    P('Pallet A', 'box', { width: 1.7, height: 0.15, depth: 1.35 }, [0, 0.1, 0], { mat: M.trunk }),
    ...[0, 1].flatMap((layer) => [0, 1].flatMap((r) => [0, 1, 2].map((c) =>
      P('Case', 'roundedBox', { width: 0.52, height: 0.44, depth: 0.6, bevel: 0.03 }, [-0.56 + c * 0.56, 0.42 + layer * 0.46, -0.33 + r * 0.66], { mat: M.cabY })))),
    P('Wrap', 'box', { width: 1.72, height: 1.0, depth: 1.4 }, [0, 0.75, 0], { mat: { ...M.glass, color: '#dbe6ee' } }),
  ],
})

const SPECS = [silo, mixer, pasteuriser, cip, depal, filler, labeller, laneDivider, casePacker, palletiser,
  valveMatrix, pumpRow, bufferTank, homogeniser, separator, pipeRack, forklift, palletStack,
  hall, office, truck, parking, green]

const GROUPS = {
  g_yard:    { id: 'g_yard',    name: 'Yard & Intake',   parentId: null, order: 0 },
  g_tanks:   { id: 'g_tanks',   name: 'Tank Farm',       parentId: null, order: 1 },
  g_process: { id: 'g_process', name: 'Processing',      parentId: null, order: 2 },
  g_filling: { id: 'g_filling', name: 'Filling Line',    parentId: null, order: 3 },
  g_pack:    { id: 'g_pack',    name: 'Packaging',       parentId: null, order: 4 },
  g_civil:   { id: 'g_civil',   name: 'Buildings',       parentId: null, order: 5 },
}

// [type, id, name, pos, group, layer, rot?, scl?, config?]
const PLACEMENTS = [
  ['bp_hall',   'obj_hall',   'Production Hall', [4, 0, -4],  'g_civil', 'structural'],
  ['bp_office', 'obj_office', 'Office Block',    [-38, 0, -4],'g_civil', 'structural'],
  ['bp_parking','obj_parking','Truck Apron',     [-24, 0, 18],'g_yard',  'structural'],
  ['bp_green',  'obj_green',  'Green Strip',     [0, 0, -22], 'g_civil', 'structural'],
  ['bp_truck',  'obj_truck1', 'Tanker 1',        [-32, 0, 16],'g_yard',  'structural'],
  ['bp_truck',  'obj_truck2', 'Tanker 2',        [-20, 0, 16],'g_yard',  'structural', [0, 0.18, 0]],
  // tank farm (right rear of the hall)
  ['bp_silo', 'obj_silo1', 'Silo 1', [18, 0, -10], 'g_tanks', 'equipment'],
  ['bp_silo', 'obj_silo2', 'Silo 2', [24, 0, -10], 'g_tanks', 'equipment'],
  ['bp_silo', 'obj_silo3', 'Silo 3', [18, 0, -4],  'g_tanks', 'equipment'],
  ['bp_silo', 'obj_silo4', 'Silo 4', [24, 0, -4],  'g_tanks', 'equipment'],
  // process skids (mid hall)
  ['bp_mixer',      'obj_mixer', 'Mixing Skid',  [-14, 0, -9], 'g_process', 'equipment'],
  ['bp_pasteuriser','obj_past',  'Pasteuriser',  [-2, 0, -9],  'g_process', 'equipment'],
  ['bp_cip',        'obj_cip',   'CIP Station',  [8, 0, -9],   'g_process', 'equipment'],
  // filling line (front of the hall, left → right). Every conveyor END tucks
  // inside the next machine's body (and START inside the previous one) so belts
  // emerge from equipment — no bare ends, and the bottle-loop wrap is hidden.
  ['bp_depal', 'obj_depal', 'Bottle Feeder', [-21.5, 0, 3.1], 'g_filling', 'equipment'],
  ['FlowConveyor', 'obj_fc0', 'Infeed Conveyor', [-20.2, 0, 3.1], 'g_filling', 'conveyors', null, null,
    { running: true, length: 5.8, curve: 'none', lanes: 1, spacing: 0.24, speed: 0.7, capColor: '#2f6fb0' }],
  ['bp_filler', 'obj_filler', 'Rotary Filler-Capper', [-12, 0, 2.2], 'g_filling', 'equipment'],
  ['FlowConveyor', 'obj_fc1', 'Filler Discharge', [-11.4, 0, 3.1], 'g_filling', 'conveyors', null, null,
    { running: true, length: 12.0, curve: 'none', lanes: 1, spacing: 0.2, speed: 0.7, capColor: '#2f6fb0' }],
  ['bp_labeller', 'obj_lab', 'Labeller', [0.8, 0, 3.1], 'g_filling', 'equipment'],
  // one lane in → one lane out: a single continuous labelled lane to the packer
  ['FlowConveyor', 'obj_fc2', 'Labelled Discharge', [1.0, 0, 3.1], 'g_filling', 'conveyors', null, null,
    { running: true, length: 11.8, curve: 'none', lanes: 1, spacing: 0.2, speed: 0.7, capColor: '#2f6fb0', label: '#d8b23a' }],
  ['bp_case_packer', 'obj_pack', 'Case Packer', [14.4, 0, 3.1], 'g_pack', 'equipment'],
  ['bp_palletiser',  'obj_pal',  'Palletiser',  [22.6, 0, 3.1], 'g_pack', 'equipment'],
  // process cellar (valve forest · pumps · buffer tanks — reference close-up)
  ['bp_separator',   'obj_sep',   'Separator',    [-21, 0, -9],  'g_process', 'equipment'],
  ['bp_homogeniser', 'obj_homog', 'Homogeniser',  [-8, 0, -9],   'g_process', 'equipment'],
  ['bp_valve_matrix','obj_vmx',   'Valve Matrix', [1, 0, -14],   'g_process', 'equipment'],
  ['bp_pump_row',    'obj_pumps', 'Transfer Pumps', [-5, 0, -14],'g_process', 'equipment'],
  ['bp_buffer_tank', 'obj_buf1',  'Buffer Tank 1', [10, 0, -14], 'g_tanks', 'equipment'],
  ['bp_buffer_tank', 'obj_buf2',  'Buffer Tank 2', [13.4, 0, -14], 'g_tanks', 'equipment'],
  ['bp_buffer_tank', 'obj_buf3',  'Buffer Tank 3', [16.8, 0, -14], 'g_tanks', 'equipment'],
  // overhead pipe racks threading the hall
  ['bp_pipe_rack', 'obj_rack1', 'Pipe Rack 1', [-14, 0, -6], 'g_process', 'piping'],
  ['bp_pipe_rack', 'obj_rack2', 'Pipe Rack 2', [-6, 0, -6],  'g_process', 'piping'],
  ['bp_pipe_rack', 'obj_rack3', 'Pipe Rack 3', [2, 0, -6],   'g_process', 'piping'],
  // warehouse corner
  ['bp_forklift',     'obj_fork', 'Forklift',      [17, 0, 6.5], 'g_pack', 'structural', [0, 0.6, 0]],
  ['bp_pallet_stack', 'obj_ps1',  'Pallet Stack A', [28, 0, 6.5], 'g_pack', 'structural'],
  ['bp_pallet_stack', 'obj_ps2',  'Pallet Stack B', [30, 0, 2.5], 'g_pack', 'structural', [0, 0.4, 0]],
]

// pipes (milk = cream-white; CIP = purple)
const MILK = { color: '#f2efe6', radius: 0.16, flowing: true }
const CIPC = { color: '#b05ec8', radius: 0.12, flowing: true }
const LINKS = [
  // raw milk: silos → valve matrix → separator/mixer chain
  ['obj_silo1', 'milk_out', 'obj_mixer', 'milk_in', 'pipe', MILK],
  ['obj_silo3', 'milk_out', 'obj_mixer', 'milk_in', 'pipe', MILK],
  ['obj_silo2', 'milk_out', 'obj_vmx', 'milk_in', 'pipe', MILK],
  ['obj_silo4', 'milk_out', 'obj_vmx', 'milk_in', 'pipe', MILK],
  ['obj_vmx', 'milk_out', 'obj_pumps', 'milk_in', 'pipe', MILK],
  ['obj_pumps', 'milk_out', 'obj_buf2', 'milk_in', 'pipe', MILK],
  // process chain: mixer → separator → homogeniser → pasteuriser → buffer → filler
  ['obj_mixer', 'milk_out', 'obj_sep', 'milk_in', 'pipe', MILK],
  ['obj_sep', 'milk_out', 'obj_homog', 'milk_in', 'pipe', MILK],
  ['obj_homog', 'milk_out', 'obj_past', 'milk_in', 'pipe', MILK],
  ['obj_past', 'milk_out', 'obj_buf1', 'milk_in', 'pipe', MILK],
  ['obj_buf1', 'milk_out', 'obj_filler', 'milk_in', 'pipe', MILK],
  ['obj_buf3', 'milk_out', 'obj_filler', 'milk_in', 'pipe', MILK],
  // CIP loops
  ['obj_cip', 'cip_out', 'obj_past', 'milk_in', 'pipe', CIPC],
  ['obj_cip', 'cip_out', 'obj_vmx', 'milk_in', 'pipe', CIPC],
]

const TOOLTIPS = {
  bp_filler:      ['throughput', 'fillVolume', 'reject'],
  bp_pasteuriser: ['pasteTemp', 'flow', 'holdTime'],
  bp_palletiser:  ['palletRate', 'layerCount'],
  bp_silo:        ['level', 'temp'],
  bp_buffer_tank: ['level', 'temp'],
  bp_homogeniser: ['pressure', 'flow'],
}

export const BOTTLING_PLANT = () => {
  const customAssetTypes = {}
  for (const s of SPECS) customAssetTypes[s.id] = s

  const objects = {}
  const orderByGroup = {}
  for (const [type, id, name, pos, group, layer, rot, scl, cfg] of PLACEMENTS) {
    const isCustom = !!customAssetTypes[type]
    const order = (orderByGroup[group] = (orderByGroup[group] ?? -1) + 1)
    objects[id] = {
      id, type, name,
      position: pos, rotation: rot || [0, 0, 0], scale: scl || [1, 1, 1],
      layer, status: 'running', state: 'running', locked: false, visible: true,
      parentId: group, order, dataBindings: [], connections: [],
      config: cfg ? { enabled: true, speed: 1, ...cfg } : { enabled: true, speed: 1 },
      parameters: {}, rules: [], layoutV: BOTTLING_LAYOUT_V,
    }
    if (isCustom && TOOLTIPS[type]) objects[id].tooltip = { enabled: true, params: [...TOOLTIPS[type]] }
  }

  for (const [src, sPort, tgt, tPort, ct, cfg] of LINKS) {
    if (!objects[src] || !objects[tgt]) continue
    objects[src].connections.push({
      id: `c_${src}_${tgt}`, targetId: tgt,
      sourcePort: sPort, targetPort: tPort, connectorType: ct,
      connectorConfig: cfg ? { ...cfg } : pipeConfigFor(sPort, tPort),
    })
  }

  return { objects, groups: { ...GROUPS }, customAssetTypes }
}
