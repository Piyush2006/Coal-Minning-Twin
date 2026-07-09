// ─────────────────────────────────────────────────────────────────────────────
// Cement Plant template — JSW Nandyal. Modelled directly on the reference render
// in references/cement-plant-jsw-nandyal/. Blue/white livery on a white floor:
//
//   • blue-bodied silos with white bands, flat railed tops, cone bottoms on legs
//   • soft-serve "swirl" blending tanks (blue drum base + white swirl)
//   • horizontal grinding/blending drums with white dashed rings — two of them
//     elevated up top and joined by a THICK BLUE OVERHEAD PIPE BRIDGE
//   • a folded-plate-roof crusher, a big cone-bottom homogenising silo
//   • a finned bag-filter/ESP on a white steel platform
//   • an inclined rotary kiln + a tall WHITE preheater tower (cyclones, spiral
//     stair, irregular top stacks)
//   • a blue-roof dispatch/packing building complex
//   • a white-frame pump house and a blue-cyclone compressor skid
//
// Every unit is tied together by thick blue process pipes. Grouped into an ISA-95
// hierarchy mirroring the UNS (jsw/nandyal/<area>); key parameters bound LIVE to
// real UNS tags via resolveAndCompute (uns:ws_3pH1ZiSwUq://…:last).
// ─────────────────────────────────────────────────────────────────────────────

const WS = 'ws_3pH1ZiSwUq'
const T = (path) => `uns:${WS}://${path}:last`

// App theme (src/ui/theme.js): Apple-minimal light — accent #0a84ff on light
// brushed-steel/white bodies. Blue is the ACCENT (bands, rings, trim, pipes), not
// the body colour.
const M = {
  blue:    { color: '#3550c8', metalness: 0.42, roughness: 0.42, finish: 'paintedSteel' },  // accent (original royal blue)
  blueDk:  { color: '#26399a', metalness: 0.45, roughness: 0.45, finish: 'paintedSteel' },
  blueLt:  { color: '#5b74e6', metalness: 0.35, roughness: 0.45, finish: 'paintedSteel' },
  white:   { color: '#f5f5f7', metalness: 0.1,  roughness: 0.62, finish: 'paintedSteel' },
  offwht:  { color: '#e8ebf0', metalness: 0.1,  roughness: 0.7,  finish: 'paintedSteel' },
  body:    { color: '#e9edf2', metalness: 0.5,  roughness: 0.34, finish: 'brushedMetal' },  // light steel body
  steel:   { color: '#aab2bd', metalness: 0.65, roughness: 0.35, finish: 'brushedMetal' },
  dark:    { color: '#3a3a3f', metalness: 0.35, roughness: 0.55, finish: 'paintedSteel' },
  concrete:{ color: '#e6e8ec', metalness: 0.03, roughness: 0.95, finish: 'concrete', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 },
}
// Cylinders are intentionally STATIC — no continuous 360° revolution (looks like
// pointless flicker). Running status is shown via the beacon.

let _pid = 0
const P = (label, geometry, dims, position, opts = {}) => ({
  id: opts.id || `cp_${++_pid}`,
  label, geometry, dims, position,
  rotation: opts.rot || [0, 0, 0], scale: opts.scale || [1, 1, 1],
  parentId: opts.parentId || null, material: opts.mat || M.blue, animate: null,
})
const legs4 = (w, d, h, mat = M.steel, y0 = 0) =>
  [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]].map(([x, z]) =>
    P('Leg', 'box', { width: 0.22, height: h, depth: 0.22 }, [x, y0 + h / 2, z], { mat }))
const port = (id, dir, offset, type = 'pipe') => ({ id, type, direction: dir, offset })
const num = (key, label, unit, def, min, max) => ({ key, label, unit, default: def, min, max })

const SPECS = {}
const spec = (id, label, category, parts, o = {}) => (SPECS[id] = {
  id, label, category, layer: o.layer || 'equipment', schemaVersion: 1,
  parts, ports: o.ports || [],
  config: [{ key: 'enabled', label: 'Animate', type: 'boolean', default: true }, { key: 'speed', label: 'Speed', type: 'number', default: 1, min: 0, max: 3, step: 0.05 }],
  parameters: o.parameters || [], states: null, beacon: { offset: [0, o.beaconY || 5, 0] }, defaultConfig: { enabled: true, speed: 1 },
})

// ── Foundation slab (scaled per instance) ────────────────────────────────────
spec('cem_pad', 'Foundation Pad', 'Civil', [
  P('Slab', 'box', { width: 1, height: 0.3, depth: 1 }, [0, 0.15, 0], { mat: M.concrete }),
], { layer: 'structural', beaconY: 0.6 })

// ── Storage silo — blue body, white bands, FLAT railed top, cone bottom on legs ─
const siloParts = (r = 1.5) => {
  const p = [
    P('Foundation', 'box', { width: r * 2.4, height: 0.3, depth: r * 2.4 }, [0, 0.15, 0], { mat: M.concrete }),
    ...legs4(r * 1.5, r * 1.5, 1.4, M.steel, 0.3),
    P('Hopper', 'cone', { radius: r, height: 1.4 }, [0, 2.2, 0], { rot: [Math.PI, 0, 0], mat: M.blue }),
    P('Body', 'cylinder', { radius: r, height: 5.4 }, [0, 5.4, 0], { mat: M.body }),
    // blue accent bands on the steel shell
    P('Band 1', 'cylinder', { radius: r + 0.015, height: 0.95 }, [0, 3.5, 0], { mat: M.blue }),
    P('Band 2', 'cylinder', { radius: r + 0.015, height: 0.95 }, [0, 5.6, 0], { mat: M.blue }),
    P('Band 3', 'cylinder', { radius: r + 0.015, height: 0.95 }, [0, 7.5, 0], { mat: M.blue }),
    // flat railed top
    P('Top Deck', 'cylinder', { radius: r + 0.05, height: 0.18 }, [0, 8.2, 0], { mat: M.white }),
    P('Handrail', 'torus', { radius: r - 0.15, tube: 0.05 }, [0, 8.7, 0], { rot: [Math.PI / 2, 0, 0], mat: M.steel }),
    P('Vent', 'cylinder', { radius: 0.28, height: 0.5 }, [0, 8.5, 0], { mat: M.steel }),
    P('Ladder', 'box', { width: 0.45, height: 7, depth: 0.07 }, [r + 0.02, 4.5, 0], { mat: M.steel }),
  ]
  return p
}
spec('cem_silo', 'Storage Silo', 'Storage', siloParts(1.5), {
  beaconY: 9.2, ports: [port('in_top', 'in', [1.4, 7.6, 0]), port('out_bot', 'out', [1.4, 1, 0])],
})

// ── Blending / homogenising "swirl" tank — blue drum base + white soft-serve top ─
spec('cem_blender', 'Blending Tank', 'Raw Milling', [
  P('Foundation', 'box', { width: 4.6, height: 0.3, depth: 4.6 }, [0, 0.15, 0], { mat: M.concrete }),
  P('Drum Base', 'cylinder', { radius: 2.0, height: 2.4 }, [0, 1.5, 0], { mat: M.body }),
  P('Rim', 'torus', { radius: 2.0, tube: 0.12 }, [0, 2.7, 0], { rot: [Math.PI / 2, 0, 0], mat: M.blueDk }),
  // soft-serve swirl (stacked shrinking cones, slightly offset → organic swirl)
  P('Swirl 1', 'cone', { radius: 1.5, height: 1.4 }, [0, 3.5, 0], { mat: M.white }),
  P('Swirl 2', 'cone', { radius: 1.05, height: 1.2 }, [0.18, 4.4, 0.05], { mat: M.white }),
  P('Swirl 3', 'cone', { radius: 0.62, height: 1.0 }, [0.32, 5.15, 0.1], { rot: [0, 0, -0.25], mat: M.white }),
  P('Swirl Tip', 'sphere', { radius: 0.22 }, [0.48, 5.7, 0.12], { mat: M.white }),
], { beaconY: 6.2, ports: [port('out_bot', 'out', [1.9, 1.4, 0])] })

// ── Big cone-bottom homogenising silo — blue body, white dome, hopper bottom ────
spec('cem_conesilo', 'Homogenising Silo', 'Storage', [
  P('Foundation', 'box', { width: 7, height: 0.35, depth: 7 }, [0, 0.18, 0], { mat: M.concrete }),
  ...legs4(4.4, 4.4, 1.8, M.steel, 0.35),
  P('Hopper', 'cone', { radius: 2.7, height: 2.6 }, [0, 3.1, 0], { rot: [Math.PI, 0, 0], mat: M.blue }),
  P('Body', 'cylinder', { radius: 2.7, height: 3.6 }, [0, 5.9, 0], { mat: M.body }),
  P('Band', 'cylinder', { radius: 2.72, height: 1.1 }, [0, 5.9, 0], { mat: M.blue }),
  P('Dome', 'sphere', { radius: 2.7 }, [0, 7.7, 0], { scale: [1, 0.45, 1], mat: M.white }),
  P('Handrail', 'torus', { radius: 2.5, tube: 0.05 }, [0, 8.0, 0], { rot: [Math.PI / 2, 0, 0], mat: M.steel }),
  P('Cap', 'cylinder', { radius: 0.5, height: 0.7 }, [0, 8.6, 0], { mat: M.steel }),
  P('Ladder', 'box', { width: 0.5, height: 6, depth: 0.08 }, [2.72, 5, 0], { mat: M.steel }),
], { beaconY: 9.2, ports: [port('in_top', 'in', [2.4, 7.6, 0]), port('out_bot', 'out', [2.5, 1.8, 0])] })

// ── Horizontal drum (grinding / blending mill) — blue drum, white dashed rings,
// white end caps, saddle supports. Used for Raw/Ball/Cement/Slag mills; the last
// two sit ELEVATED and are wired by the overhead pipe bridge. ───────────────────
const drumParts = (elevate = 0) => {
  const cy = 2.0 + elevate
  const p = [
    P('Pad', 'box', { width: 8.5, height: 0.35, depth: 3.8 }, [0, 0.18, 0], { mat: M.concrete }),
    P('Drum', 'cylinder', { radius: 1.55, height: 6 }, [0, cy, 0], { rot: [0, 0, Math.PI / 2], mat: M.body }),
    P('End L', 'cylinder', { radius: 1.35, height: 0.4 }, [-3.05, cy, 0], { rot: [0, 0, Math.PI / 2], mat: M.blue }),
    P('End R', 'cylinder', { radius: 1.35, height: 0.4 }, [3.05, cy, 0], { rot: [0, 0, Math.PI / 2], mat: M.blue }),
  ]
  // white "dashed" rings (bolt circles) — thin white rings along the drum
  for (const x of [-2.1, -1.05, 0, 1.05, 2.1]) p.push(P('Ring', 'torus', { radius: 1.58, tube: 0.09 }, [x, cy, 0], { rot: [0, Math.PI / 2, 0], mat: M.blue }))
  if (elevate > 0) {
    // saddle supports lifting the drum into the pipe bridge
    for (const x of [-2.4, 2.4]) p.push(P('Saddle', 'box', { width: 0.9, height: cy - 0.9, depth: 3 }, [x, (cy - 0.9) / 2 + 0.35, 0], { mat: M.white }))
  } else {
    for (const x of [-2.6, 2.6]) p.push(P('Trunnion', 'box', { width: 0.9, height: 1.5, depth: 2.4 }, [x, 1.1, 0], { mat: M.blueDk }))
    p.push(P('Drive', 'box', { width: 1.5, height: 1.3, depth: 1.5 }, [3, 0.85, 2.4], { mat: M.dark }))
  }
  return p
}
const drumSpec = (id, label, elevate) => spec(id, label, elevate ? 'Cement Milling' : 'Grinding', drumParts(elevate), {
  ports: [port('feed_in', 'in', [-3.6, 2.0 + elevate, 0]), port('mat_out', 'out', [3.6, 2.0 + elevate, 0])],
  parameters: [num('power_kw', 'Motor Power', 'kW', 2400, 0, 6000), num('energy_kwh', 'Energy', 'kWh', 0, 0, 1e7),
    num('temperature', 'Bearing Temp', '°C', 55, 0, 120), num('rpm', 'Mill Speed', 'rpm', 15, 0, 40),
    num('feed_tph', 'Feed Rate', 't/h', 180, 0, 500), num('current', 'Motor Current', 'A', 300, 0, 800),
    num('pressure', 'Bearing Press', 'bar', 6, 0, 12), num('load_pct', 'Mill Load', '%', 42, 0, 100)],
  beaconY: 4.2 + elevate,
})
drumSpec('cem_mill', 'Grinding Mill', 0)
drumSpec('cem_mill_hi', 'Grinding Mill (elevated)', 3)

// ── Vertical roller mill (coal mill) — squat blue body, cone base, classifier top ─
spec('cem_vmill', 'Vertical Mill', 'Grinding', [
  P('Pad', 'box', { width: 4.5, height: 0.35, depth: 4.5 }, [0, 0.18, 0], { mat: M.concrete }),
  P('Cone Base', 'cone', { radius: 1.7, height: 1.6 }, [0, 1.2, 0], { rot: [Math.PI, 0, 0], mat: M.blueDk }),
  P('Body', 'cylinder', { radius: 1.6, height: 2.6 }, [0, 3.2, 0], { mat: M.body }),
  P('Band', 'cylinder', { radius: 1.62, height: 0.7 }, [0, 3.2, 0], { mat: M.blue }),
  P('Classifier', 'cone', { radius: 1.4, height: 1.6 }, [0, 5.1, 0], { mat: M.blueLt }),
  P('Outlet', 'cylinder', { radius: 0.4, height: 1.2 }, [0, 6.2, 0], { mat: M.steel }),
  P('Motor', 'box', { width: 1.4, height: 1.2, depth: 1.4 }, [2.2, 0.85, 0], { mat: M.dark }),
], {
  ports: [port('feed_in', 'in', [-1.8, 3.2, 0]), port('mat_out', 'out', [1.8, 3.2, 0])],
  parameters: [num('power_kw', 'Motor Power', 'kW', 1600, 0, 4000), num('energy_kwh', 'Energy', 'kWh', 0, 0, 1e7),
    num('temperature', 'Outlet Temp', '°C', 75, 0, 150), num('feed_tph', 'Feed', 't/h', 45, 0, 120)],
  beaconY: 6.6,
})

// ── LS Crusher — blue trapezoid hopper base, white folded-plate roof, feed hole ──
spec('cem_crusher', 'Crusher', 'Crushing', [
  P('Pad', 'box', { width: 7, height: 0.4, depth: 5.5 }, [0, 0.2, 0], { mat: M.concrete }),
  P('Hopper', 'box', { width: 5, height: 2.2, depth: 4 }, [0, 1.5, 0], { mat: M.body }),          // trapezoid-ish base (steel)
  P('Rim', 'box', { width: 5.4, height: 0.35, depth: 4.4 }, [0, 2.7, 0], { mat: M.blueDk }),
  P('Feed Hole', 'cylinder', { radius: 0.7, height: 0.5 }, [0, 2.4, 2.05], { rot: [Math.PI / 2, 0, 0], mat: M.dark }),
  // folded-plate origami roof — angled white plates forming peaks
  P('Roof A', 'box', { width: 1.6, height: 0.2, depth: 4.2 }, [-1.7, 3.6, 0], { rot: [0, 0, 0.6], mat: M.white }),
  P('Roof B', 'box', { width: 1.6, height: 0.2, depth: 4.2 }, [-0.6, 3.9, 0], { rot: [0, 0, -0.6], mat: M.white }),
  P('Roof C', 'box', { width: 1.6, height: 0.2, depth: 4.2 }, [0.6, 3.9, 0], { rot: [0, 0, 0.6], mat: M.white }),
  P('Roof D', 'box', { width: 1.6, height: 0.2, depth: 4.2 }, [1.7, 3.6, 0], { rot: [0, 0, -0.6], mat: M.white }),
  P('Gable', 'box', { width: 3.6, height: 1.4, depth: 0.15 }, [0, 3.4, -2 ], { mat: M.white }),
  P('Discharge', 'box', { width: 1.2, height: 1, depth: 1.2 }, [3, 0.9, 0], { mat: M.steel }),
], {
  ports: [port('mat_out', 'out', [2.6, 2.6, 0])],
  parameters: [num('power_kw', 'Motor Power', 'kW', 900, 0, 3000), num('energy_kwh', 'Energy', 'kWh', 0, 0, 1e7),
    num('feed_tph', 'Throughput', 't/h', 650, 0, 1500), num('current', 'Motor Current', 'A', 210, 0, 600)],
  beaconY: 4.6,
})

// ── Rotary kiln — inclined blue tube, white support platform + stairs, riser duct ─
spec('cem_kiln', 'Rotary Kiln', 'Pyroprocessing', [
  P('Pad', 'box', { width: 18, height: 0.35, depth: 4.5 }, [0, 0.18, 0], { mat: M.concrete }),
  P('Pier 1', 'box', { width: 1.3, height: 1.2, depth: 2.6 }, [-6.5, 0.6, 0], { mat: M.white }),
  P('Pier 2', 'box', { width: 1.3, height: 1.6, depth: 2.6 }, [0, 0.8, 0], { mat: M.white }),
  P('Pier 3', 'box', { width: 1.3, height: 2.1, depth: 2.6 }, [6.5, 1.05, 0], { mat: M.white }),
  P('Kiln Tube', 'cylinder', { radius: 1.15, height: 16.5 }, [0, 2.3, 0], { rot: [0, 0, Math.PI / 2 - 0.06], mat: M.blue }),
  P('Tyre 1', 'torus', { radius: 1.28, tube: 0.17 }, [-5.5, 2.0, 0], { rot: [0, Math.PI / 2, 0], mat: M.steel }),
  P('Tyre 2', 'torus', { radius: 1.28, tube: 0.17 }, [5.5, 2.6, 0], { rot: [0, Math.PI / 2, 0], mat: M.steel }),
  P('Firing Hood', 'box', { width: 2.2, height: 2.5, depth: 2.8 }, [8.4, 1.5, 0], { mat: M.blueDk }),
  P('Riser Duct', 'cylinder', { radius: 0.6, height: 5 }, [-9.2, 3.4, 0], { rot: [0, 0, 0.35], mat: M.blue }),
  P('Inlet Platform', 'box', { width: 3.5, height: 0.15, depth: 4 }, [-8.4, 2.4, 0], { mat: M.white }),
  P('Stair', 'box', { width: 0.6, height: 2.6, depth: 3.2 }, [-8.4, 1.3, 2.4], { rot: [0.5, 0, 0], mat: M.steel }),
], {
  ports: [port('feed_in', 'in', [-9.8, 5, 0]), port('fuel_in', 'in', [8.4, 3.4, 0]), port('clinker_out', 'out', [9.2, 0.9, 0])],
  parameters: [num('rpm', 'Kiln Speed', 'rpm', 3.2, 0, 6), num('temperature', 'Burning Zone', '°C', 1450, 0, 1600),
    num('feed_tph', 'Feed', 't/h', 210, 0, 400), num('power_kw', 'Drive Power', 'kW', 640, 0, 1500), num('energy_kwh', 'Energy', 'kWh', 0, 0, 1e7)],
  beaconY: 4.4,
})

// ── Preheater tower — tall WHITE/steel: cyclone stages, spiral stair, platforms,
// irregular top stacks. The plant's landmark. ──────────────────────────────────
spec('cem_preheater', 'Preheater Tower', 'Pyroprocessing', (() => {
  const parts = [P('Foundation', 'box', { width: 6, height: 0.5, depth: 6 }, [0, 0.25, 0], { mat: M.concrete })]
  parts.push(P('Core', 'box', { width: 2.6, height: 17, depth: 2.6 }, [-0.6, 8.7, 0], { mat: M.white }))
  for (const [x, z] of [[-2.2, 2.2], [1, 2.2], [-2.2, -2.2], [1, -2.2]])
    parts.push(P('Column', 'box', { width: 0.32, height: 17.5, depth: 0.32 }, [x, 8.7, z], { mat: M.steel }))
  for (let i = 0; i < 6; i++)
    parts.push(P('Platform', 'box', { width: 5, height: 0.15, depth: 5 }, [-0.6, 3.2 + i * 2.7, 0], { mat: M.offwht }))
  // white cyclone stages on the +X face + riser ducts
  for (let i = 0; i < 5; i++) {
    const y = 4 + i * 2.7, r = 1.35 - i * 0.05
    parts.push(P('Cyclone', 'cylinder', { radius: r, height: 1.8 }, [1.8, y + 0.9, 0], { mat: M.white }))
    parts.push(P('Cyclone Cone', 'cone', { radius: r, height: 1.4 }, [1.8, y - 0.3, 0], { rot: [Math.PI, 0, 0], mat: M.offwht }))
    parts.push(P('Riser', 'box', { width: 0.55, height: 2.7, depth: 0.85 }, [0.6, y + 0.5, 0], { mat: M.steel }))
  }
  // spiral staircase + centre pole
  parts.push(P('Stair Pole', 'cylinder', { radius: 0.12, height: 16.5 }, [-0.6, 8.4, 2.9], { mat: M.steel }))
  for (let i = 0; i < 44; i++) {
    const a = i * 0.42, y = 1.2 + i * 0.35
    parts.push(P('Step', 'box', { width: 1.0, height: 0.08, depth: 0.42 }, [-0.6 + Math.cos(a) * 2.9, y, Math.sin(a) * 2.9], { rot: [0, -a, 0], mat: M.steel }))
  }
  // irregular top stacks / ducting (the ragged silhouette in the reference)
  parts.push(P('Top Box', 'box', { width: 3, height: 1.8, depth: 3 }, [-0.6, 18, 0], { mat: M.white }))
  parts.push(P('Stack 1', 'box', { width: 0.7, height: 2.4, depth: 0.7 }, [-1.4, 19.6, -0.6], { mat: M.white }))
  parts.push(P('Stack 2', 'box', { width: 0.6, height: 3.2, depth: 0.6 }, [-0.2, 20, 0.4], { mat: M.offwht }))
  parts.push(P('Duct', 'cylinder', { radius: 0.5, height: 5 }, [2.8, 13, 0], { rot: [0, 0, 0.3], mat: M.steel }))
  return parts
})(), {
  ports: [port('meal_in', 'in', [-2.6, 16, 0]), port('kiln_out', 'out', [2.4, 2, 0])],
  parameters: [num('temperature', 'Preheater Temp', '°C', 890, 0, 1100), num('draft', 'ID Fan Draft', 'mmWC', 320, 0, 700),
    num('power_kw', 'ID Fan Power', 'kW', 1200, 0, 3000), num('o2_pct', 'O₂', '%', 3.2, 0, 12)],
  beaconY: 21,
})

// ── Coal Mill (vertical roller mill) — blue finned casing on a white multi-level
// steel platform. Per the labelled reference this tall finned structure IS the coal
// mill (station 05), not a stand-alone bag filter. ──────────────────────────────
spec('cem_bagfilter', 'Coal Mill', 'Pyroprocessing', (() => {
  const parts = [
    P('Pad', 'box', { width: 6, height: 0.4, depth: 5 }, [0, 0.2, 0], { mat: M.concrete }),
    // white support steel + platforms + stair
    P('Platform', 'box', { width: 5, height: 0.18, depth: 4.4 }, [0, 3.4, 0], { mat: M.offwht }),
    P('Platform 2', 'box', { width: 5, height: 0.18, depth: 4.4 }, [0, 5.2, 0], { mat: M.offwht }),
    P('Stair', 'box', { width: 0.55, height: 3.5, depth: 0.9 }, [3, 1.75, 2 ], { rot: [0.5, 0, 0], mat: M.steel }),
  ]
  for (const [x, z] of [[-2.2, 1.9], [2.2, 1.9], [-2.2, -1.9], [2.2, -1.9]]) parts.push(P('Col', 'box', { width: 0.25, height: 5.4, depth: 0.25 }, [x, 3, z], { mat: M.steel }))
  // dust hoppers under the casing
  for (const x of [-1.4, 0, 1.4]) parts.push(P('Hopper', 'cone', { radius: 0.8, height: 1.4 }, [x, 3, 0], { rot: [Math.PI, 0, 0], mat: M.blueDk }))
  // blue casing
  parts.push(P('Casing', 'box', { width: 4.2, height: 3.4, depth: 2.6 }, [0, 5.9, 0], { mat: M.body }))
  // vertical fins / pleats on the front face
  for (let i = 0; i < 9; i++) parts.push(P('Fin', 'box', { width: 0.12, height: 3.4, depth: 0.35 }, [-1.9 + i * 0.47, 5.9, 1.35], { mat: M.blue }))
  parts.push(P('Roof', 'box', { width: 4.4, height: 0.3, depth: 2.8 }, [0, 7.75, 0], { rot: [0, 0, 0.12], mat: M.blueDk }))
  parts.push(P('Fan', 'cylinder', { radius: 0.7, height: 1 }, [2.6, 8.2, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel }))
  parts.push(P('Stack', 'cylinder', { radius: 0.35, height: 3 }, [-1.6, 9, 0], { mat: M.white }))
  return parts
})(), {
  ports: [port('gas_in', 'in', [-2.4, 5.9, 0]), port('gas_out', 'out', [2.4, 8.2, 0])],
  parameters: [num('draft', 'Draft', 'mmWC', 180, 0, 500), num('dp', 'Bag ΔP', 'mmWC', 120, 0, 300),
    num('power_kw', 'Fan Power', 'kW', 750, 0, 2000), num('temperature', 'Gas Temp', '°C', 110, 0, 300)],
  beaconY: 10.5,
})

// ── Dispatch / packing building complex — blue sloped roofs, white walls ────────
spec('cem_dispatch', 'Packing & Dispatch', 'Dispatch', [
  P('Pad', 'box', { width: 12, height: 0.4, depth: 7 }, [0, 0.2, 0], { mat: M.concrete }),
  // main hall
  P('Hall', 'box', { width: 6, height: 3.6, depth: 5 }, [-2.5, 2.2, 0], { mat: M.white }),
  P('Hall Roof', 'box', { width: 6.4, height: 0.3, depth: 5.4 }, [-2.5, 4.2, 0], { rot: [0, 0, 0.12], mat: M.blue }),
  // stepped-down annexes with blue sloped roofs
  P('Annex 1', 'box', { width: 3.4, height: 2.8, depth: 4 }, [1.6, 1.8, 0.4], { mat: M.white }),
  P('Annex 1 Roof', 'box', { width: 3.8, height: 0.28, depth: 4.3 }, [1.6, 3.35, 0.4], { rot: [0, 0, -0.18], mat: M.blue }),
  P('Annex 2', 'box', { width: 3, height: 2.2, depth: 3.4 }, [4.7, 1.5, -0.4], { mat: M.offwht }),
  P('Annex 2 Roof', 'box', { width: 3.4, height: 0.26, depth: 3.7 }, [4.7, 2.75, -0.4], { rot: [0, 0, 0.16], mat: M.blue }),
  // louvered side + truck loadout
  P('Louvers', 'box', { width: 0.15, height: 2.4, depth: 4.6 }, [-5.5, 1.6, 0], { mat: M.blueLt }),
  P('Loadout', 'box', { width: 2, height: 1.8, depth: 2.4 }, [-2.5, 1.1, 3.6], { mat: M.blueDk }),
  P('Silo', 'cylinder', { radius: 1, height: 3 }, [-0.5, 5, 0], { mat: M.blue }),
  P('Silo Band', 'cylinder', { radius: 1.02, height: 0.7 }, [-0.5, 5, 0], { mat: M.white }),
], {
  ports: [port('cement_in', 'in', [-5.8, 3, 0])],
  parameters: [num('energy_kwh', 'Energy', 'kWh', 0, 0, 1e7), num('temperature', 'Gearbox Temp', '°C', 48, 0, 100),
    num('rate_tph', 'Pack Rate', 't/h', 240, 0, 400), num('power_kw', 'Power', 'kW', 200, 0, 800)],
  beaconY: 5.5,
})

// ── Pump house — white open-frame building with blue pump/motor sets ────────────
spec('cem_pumphouse', 'Pump House', 'Utilities', [
  P('Pad', 'box', { width: 8, height: 0.4, depth: 5.5 }, [0, 0.2, 0], { mat: M.concrete }),
  ...legs4(7, 4.6, 4, M.white, 0.4),
  P('Back Wall', 'box', { width: 7.2, height: 4, depth: 0.15 }, [0, 2.4, -2.3], { mat: M.white }),
  P('Roof', 'box', { width: 7.6, height: 0.3, depth: 5, }, [0, 4.55, 0], { mat: M.white }),
  P('Header', 'cylinder', { radius: 0.28, height: 7 }, [0, 4.2, 1.6], { rot: [0, 0, Math.PI / 2], mat: M.blue }),
  ...[-2.2, 0, 2.2].flatMap((x) => ([
    P('Plinth', 'box', { width: 1.5, height: 0.5, depth: 1.8 }, [x, 0.65, 0], { mat: M.concrete }),
    P('Pump', 'cylinder', { radius: 0.55, height: 1.1 }, [x, 1.3, 0.5], { rot: [Math.PI / 2, 0, 0], mat: M.blue }),
    P('Volute', 'sphere', { radius: 0.6 }, [x, 1.3, 1.0], { mat: M.blue }),
    P('Motor', 'cylinder', { radius: 0.45, height: 1.2 }, [x, 1.3, -0.55], { rot: [Math.PI / 2, 0, 0], mat: M.steel }),
    P('Riser', 'cylinder', { radius: 0.16, height: 2.9 }, [x, 2.7, 0.5], { mat: M.blue }),
  ])),
], {
  ports: [port('water_out', 'out', [3.6, 3.2, 0])],
  parameters: [num('power_kw', 'Power', 'kW', 320, 0, 2000), num('energy_kwh', 'Energy', 'kWh', 0, 0, 1e7),
    num('pressure', 'Discharge Press', 'bar', 6.5, 0, 12), num('flow', 'Flow', 'm³/h', 480, 0, 1200), num('run_hrs', 'Run Hours', 'h', 0, 0, 1e6)],
  beaconY: 5,
})

// ── Compressor — blue cyclone separator (with fan disc) + overhead pipe + white
// compressor skid with vertical receivers + access ladder. ──────────────────────
spec('cem_compressor', 'Compressor', 'Utilities', [
  P('Pad', 'box', { width: 9, height: 0.4, depth: 6 }, [0, 0.2, 0], { mat: M.concrete }),
  // blue cyclone separator (trapezoid narrowing down)
  P('Separator', 'box', { width: 3, height: 4, depth: 3 }, [-3, 2.4, 0], { mat: M.body }),
  P('Sep Hopper', 'cone', { radius: 1.3, height: 1.6 }, [-3, 0.9, 0], { rot: [Math.PI, 0, 0], mat: M.blueDk }),
  P('Fan Disc', 'cylinder', { radius: 1.3, height: 0.4 }, [-4.55, 2.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel }),
  P('Ladder', 'box', { width: 0.5, height: 4.4, depth: 0.08 }, [-1.4, 2.2, 1.4], { mat: M.steel }),
  // overhead blue pipe from separator to skid
  P('Arch Pipe', 'cylinder', { radius: 0.35, height: 4.5 }, [-1.4, 4.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.blue }),
  P('Arch Down', 'cylinder', { radius: 0.35, height: 2, }, [0.85, 3.6, 0], { mat: M.blue }),
  // white compressor skid + receivers
  P('Skid', 'box', { width: 4.5, height: 0.5, depth: 3.5 }, [2.2, 0.65, 0], { mat: M.offwht }),
  P('Compressor Pkg', 'box', { width: 2.6, height: 1.8, depth: 2 }, [1.6, 1.8, 0], { mat: M.white }),
  P('Receiver 1', 'cylinder', { radius: 0.5, height: 2.6 }, [3.6, 2.2, -0.9], { mat: M.white }),
  P('Receiver 2', 'cylinder', { radius: 0.5, height: 2.6 }, [3.6, 2.2, 0.4], { mat: M.white }),
  P('Cooler', 'box', { width: 1.4, height: 1.2, depth: 1.6 }, [3.8, 1.2, 1.4], { mat: M.steel }),
], {
  ports: [port('air_out', 'out', [4.6, 2.2, 0])],
  parameters: [num('power_kw', 'Power', 'kW', 450, 0, 2000), num('energy_kwh', 'Energy', 'kWh', 0, 0, 1e7),
    num('pressure', 'Line Pressure', 'bar', 7, 0, 12), num('run_hrs', 'Run Hours', 'h', 0, 0, 1e6)],
  beaconY: 5,
})

// ── Build ────────────────────────────────────────────────────────────────────
const baseObj = (id, type, name, position, opts = {}) => ({
  id, type, name, position, rotation: opts.rot || [0, 0, 0], scale: opts.scale || [1, 1, 1],
  layer: opts.layer || 'equipment', status: 'running', state: 'running', locked: false, visible: true,
  parentId: opts.parentId || null, order: opts.order ?? 0, connections: opts.connections || [], dataBindings: [],
  config: { enabled: true, speed: 1 }, parameters: {}, paramMeta: opts.paramMeta || {}, rules: opts.rules || [],
})
const bind = (map) => Object.fromEntries(Object.entries(map).map(([k, path]) => [k, { topic: T(path) }]))
const pipe = (targetId, sourcePort, targetPort, o = {}) => ({
  id: `pipe_${sourcePort}_${targetId}_${targetPort}`, targetId, sourcePort, targetPort,
  connectorType: 'pipe',
  connectorConfig: { radius: o.r ?? 0.2, color: o.color ?? '#2f47c4', flowing: true, speed: o.speed ?? 0.5, direction: 'forward' },
})

export const CEMENT_PLANT = () => {
  const groups = {
    g_crush:  { id: 'g_crush',  name: 'Crushing',           parentId: null, order: 0 },
    g_raw:    { id: 'g_raw',    name: 'Raw Milling',        parentId: null, order: 1 },
    g_pyro:   { id: 'g_pyro',   name: 'Pyroprocessing',     parentId: null, order: 2 },
    g_cem:    { id: 'g_cem',    name: 'Cement Milling',     parentId: null, order: 3 },
    g_pack:   { id: 'g_pack',   name: 'Packing & Dispatch', parentId: null, order: 4 },
    g_util:   { id: 'g_util',   name: 'Utilities',          parentId: null, order: 5 },
    g_store:  { id: 'g_store',  name: 'Storage',            parentId: null, order: 6 },
  }
  const o = {}
  const add = (obj) => { o[obj.id] = obj }
  const pad = (id, pos, sx, sz, group) => add(baseObj(id, 'cem_pad', 'Foundation', pos, { parentId: group, layer: 'structural', scale: [sx, 1, sz] }))

  // Identities verified against references/…/labeled jsw nandyal reference.png
  // (JSW maintenance dashboard leader-lines). Positions reproduce the render:
  // X = left→right, +Z = front/viewer, −Z = back. Ground pipes source from LOW
  // ports (hug the floor); only the elevated Raw+Ball mill drums ride the overhead
  // bridge. Pipe radii: bridge 0.26, process 0.2, service 0.13–0.14.

  // ── FRONT-LEFT: 2 Slag Mills (both swirl tanks) + Raw-Meal silo farm + 2 Front Silos
  // Flow: Slag Mill 1 → Front Silo 2, Slag Mill 2 → Front Silo 1
  add(baseObj('cp_slagmill', 'cem_blender', 'Slag Mill 1', [-51, 0, 11], { parentId: 'g_cem', order: 1, layer: 'structural',
    paramMeta: bind({ pressure: 'jsw/nandyal/slagmill/1-idle-rp2/act-extraction-pressure' }),
    connections: [pipe('cp_silo_front2', 'out_bot', 'in_top')] }))
  add(baseObj('cp_blend2', 'cem_blender', 'Slag Mill 2', [-45, 0, 6], { parentId: 'g_cem', order: 2, layer: 'structural',
    connections: [pipe('cp_silo_front', 'out_bot', 'in_top')] }))
  // Raw-Meal silos 1–4 → each pipes into the Cement Mill (combine at the mill feed)
  let si = 0
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    si++
    add(baseObj(`cp_silo_farm${si}`, 'cem_silo', `Raw Meal Silo ${si}`, [-49 + c * 5, 0, -6 + r * 5], { parentId: 'g_store', order: si, layer: 'structural',
      connections: [pipe('cp_cementmill', 'out_bot', 'feed_in')] }))
  }
  // 2 Front Silos → the 4 Blending Silos (Front 1 → Blending 1 & 3, Front 2 → Blending 2 & 4)
  add(baseObj('cp_silo_front', 'cem_silo', 'Front Silo 1', [-36, 0, 7], { parentId: 'g_store', order: 0, layer: 'structural',
    connections: [pipe('cp_silo_ctr1', 'out_bot', 'in_top'), pipe('cp_silo_ctr3', 'out_bot', 'in_top')] }))
  add(baseObj('cp_silo_front2', 'cem_silo', 'Front Silo 2', [-36, 0, 12], { parentId: 'g_store', order: 1, layer: 'structural',
    connections: [pipe('cp_silo_ctr2', 'out_bot', 'in_top'), pipe('cp_silo_ctr4', 'out_bot', 'in_top')] }))
  pad('pad_left', [-46, 0, 3], 28, 30, 'g_store')

  // ── CRUSHING: 01 LS Crusher (folded roof), behind the big ground drum ─────────
  add(baseObj('cp_crusher', 'cem_crusher', 'LS Crusher', [-35, 0, -12], { parentId: 'g_crush', order: 0,
    paramMeta: bind({ power_kw: 'jsw/nandyal/crusher/bag-filter/211fn1-kw1', energy_kwh: 'jsw/nandyal/crusher/belt-conveyor/221bc2/kwh' }),
    connections: [pipe('cp_rawmill', 'mat_out', 'feed_in', { r: 0.26 })] }))   // → overhead bridge start

  // ── CEMENT MILLING: 06 Cement Mill (big GROUND drum) ─────────────────────────
  // Cement Mill: fed by the 4 Raw-Meal Silos → discharges to the Homogenising Silo
  add(baseObj('cp_cementmill', 'cem_mill', 'Cement Mill', [-32, 0, -4], { parentId: 'g_cem', order: 0,
    paramMeta: bind({ power_kw: 'jsw/nandyal/cementmill/1/11kv-incomer1-power', energy_kwh: 'jsw/nandyal/cementmill/1/520fn5-kwh' }),
    connections: [pipe('cp_conesilo', 'mat_out', 'in_top')] }))
  pad('pad_cem', [-32, 0, -4], 12, 12, 'g_cem')

  // ── RAW MILLING: 02 Raw Mill + 03 Ball Mill = the ELEVATED bridge drums ───────
  add(baseObj('cp_rawmill', 'cem_mill_hi', 'Raw Mill', [-16, 0, -14], { parentId: 'g_raw', order: 0,
    paramMeta: bind({ power_kw: 'jsw/nandyal/rawmill/361md-avg-kw', current: 'jsw/nandyal/rawmill/351sg6-current' }),
    connections: [pipe('cp_ballmill', 'mat_out', 'feed_in', { r: 0.26 })] }))
  add(baseObj('cp_ballmill', 'cem_mill_hi', 'Ball Mill', [-4, 0, -14], { parentId: 'g_raw', order: 1,
    paramMeta: bind({ power_kw: 'jsw/nandyal/ballmill/ac-power', temperature: 'jsw/nandyal/ballmill/bucket-elevator/550be1/kiln-side/gb-int-1-de/temperature', rpm: 'jsw/nandyal/ballmill/bucket-elevator/550be1/kiln-side/gb-int-1-de/rpm' }),
    connections: [pipe('cp_preheater', 'mat_out', 'meal_in', { r: 0.26 })] }))
  pad('pad_raw', [-10, 0, -14], 28, 8, 'g_raw')

  // ── STORAGE (center): homogenising silo + 2×2 blending-silo cluster ──────────
  // Homogenising Silo → Coal Mill (which then feeds the Kiln)
  add(baseObj('cp_conesilo', 'cem_conesilo', 'Homogenising Silo', [-20, 0, -3], { parentId: 'g_store', order: 10, layer: 'structural',
    connections: [pipe('cp_coalmill', 'out_bot', 'gas_in')] }))
  // 4 Blending Silos (fed by the Front Silos) → one pipe out to the Packaging Plant
  let ci = 0
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    ci++
    add(baseObj(`cp_silo_ctr${ci}`, 'cem_silo', `Blending Silo ${ci}`, [-22 + c * 5, 0, 6 + r * 5], { parentId: 'g_store', order: 10 + ci, layer: 'structural',
      connections: ci === 2 ? [pipe('cp_dispatch', 'out_bot', 'cement_in')] : [] }))
  }
  pad('pad_ctr', [-19, 0, 3], 16, 22, 'g_store')

  // ── PYROPROCESSING: 05 Coal Mill (finned), 04 Kiln, preheater, clinker silo ──
  add(baseObj('cp_coalmill', 'cem_bagfilter', 'Coal Mill', [-8, 0, -6], { parentId: 'g_pyro', order: 0, layer: 'structural',
    paramMeta: bind({ power_kw: 'jsw/nandyal/coalmill/ac-power', energy_kwh: 'jsw/nandyal/coalmill/311bc2-kwh' }),
    connections: [pipe('cp_kiln', 'gas_out', 'fuel_in', { r: 0.14, color: '#26399a' })] }))
  add(baseObj('cp_kiln', 'cem_kiln', 'Kiln', [6, 0, -3], { parentId: 'g_pyro', order: 1,
    paramMeta: bind({ rpm: 'jsw/nandyal/kiln/120fp1-rpm' }),
    connections: [pipe('cp_silo_tall', 'clinker_out', 'in_top')] }))
  add(baseObj('cp_preheater', 'cem_preheater', 'Preheater Tower', [18, 0, -9], { parentId: 'g_pyro', order: 2, layer: 'structural',
    paramMeta: bind({ temperature: 'jsw/nandyal/kiln/preheater-temp' }),
    connections: [pipe('cp_kiln', 'kiln_out', 'feed_in')] }))
  add(baseObj('cp_silo_tall', 'cem_silo', 'Clinker Silo', [11, 0, -12], { parentId: 'g_store', order: 20, layer: 'structural' }))
  pad('pad_pyro', [6, 0, -6], 34, 22, 'g_pyro')

  // ── PACKING & DISPATCH: 08 Packaging Plant (blue-roof complex) ───────────────
  add(baseObj('cp_dispatch', 'cem_dispatch', 'Packaging Plant', [2, 0, 10], { parentId: 'g_pack', order: 0,
    paramMeta: bind({ energy_kwh: 'jsw/nandyal/packingplant/200kw-kwh/kwh', temperature: 'jsw/nandyal/packingplant/461md1/gb-input-de/extra-temperature' }) }))
  pad('pad_pack', [2, 0, 10], 14, 9, 'g_pack')

  // ── UTILITIES: 09 Pump House (back) + 10 Compressor (front) ──────────────────
  add(baseObj('cp_pumphouse', 'cem_pumphouse', 'Pump House', [36, 0, -8], { parentId: 'g_util', order: 0,
    paramMeta: bind({ energy_kwh: 'jsw/nandyal/utilities/jsw75-kw-pump/kwh', power_kw: 'jsw/nandyal/utilities/dg/dg-power-consumption' }) }))
  add(baseObj('cp_compressor', 'cem_compressor', 'Compressor', [38, 0, 9], { parentId: 'g_util', order: 1,
    paramMeta: bind({ power_kw: 'jsw/nandyal/utilities/air-compressor-and-run-hours/total-compressor-power-post-pyro' }) }))
  pad('pad_util', [37, 0, 1], 14, 30, 'g_util')

  return { objects: o, groups, customAssetTypes: { ...SPECS } }
}
