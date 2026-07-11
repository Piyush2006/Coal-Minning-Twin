// ─────────────────────────────────────────────────────────────────────────────
// Thermal Power Plant template — a detailed, structured, fully-animated coal-fired
// station built from procedural primitives. Each unit is a dissectable multi-part
// Component Spec on a concrete foundation, with functional sub-assemblies and
// correct inlets/outlets (auto flanged nozzles: BLUE=in, AMBER=out). Connectors map
// BY MEDIUM: coal/ash=conveyor, fluids=pipe, electrical=bus bar. Laid out in three
// clean lanes (flue · steam/power spine · water) inside a boiler house, turbine
// hall and boundary wall.
// ─────────────────────────────────────────────────────────────────────────────

import { pipeConfigFor } from '../pipeMedia'
import { boltCircle, flangeJoint, handrail, valveWheel, nameplate, junctionBox, gauge as dial } from '../detailKit'

// Row of three round dial gauges on a face (local convenience over detailKit.gauge).
const gaugeCluster = (pos) => [
  ...dial({ pos: [pos[0] - 0.45, pos[1], pos[2]] }),
  ...dial({ pos }),
  ...dial({ pos: [pos[0] + 0.45, pos[1], pos[2]] }),
]

// `finish` = procedural surface texture (see src/lib/textures.js). Glowing/glassy
// materials omit it so they stay clean.
const M = {
  steel:    { color: '#8a929b', metalness: 0.72, roughness: 0.34, finish: 'brushedMetal' },
  steelDk:  { color: '#5c636c', metalness: 0.7,  roughness: 0.42, finish: 'brushedMetal' },
  // Base wall/shell skin — pushed back a touch so beams/columns/roofs/windows
  // mounted flush on it win the depth test instead of z-fighting.
  cladding: { color: '#aeb6bf', metalness: 0.55, roughness: 0.4, finish: 'paintedSteel', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 },
  red:      { color: '#b8483a', metalness: 0.3,  roughness: 0.6, finish: 'paintedSteel' },
  amber:    { color: '#e0a225', metalness: 0.4,  roughness: 0.5, finish: 'paintedSteel' },
  hot:      { color: '#ff7a1a', metalness: 0.2,  roughness: 0.5, emissive: '#ff5200', emissiveIntensity: 1.5 },
  ember:    { color: '#ffb020', metalness: 0.1,  roughness: 0.6, emissive: '#ff7300', emissiveIntensity: 2.2 },
  // Overlay/decal materials (sit flush ON another face) — pull toward camera so
  // they win the depth test cleanly instead of z-fighting.
  glass:    { color: '#bcd7e6', metalness: 0.1,  roughness: 0.12, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
  window:   { color: '#bcd7e6', metalness: 0.1,  roughness: 0.1, emissive: '#9fd0ff', emissiveIntensity: 0.32, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
  copper:   { color: '#b87333', metalness: 0.82, roughness: 0.3, finish: 'brushedMetal' },
  // Ground/base slabs — push back so markings/kerbs/pads on top win cleanly.
  concrete: { color: '#c9ccd1', metalness: 0.04, roughness: 0.92, finish: 'concrete', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 },
  grade:    { color: '#b9bdc4', metalness: 0.03, roughness: 0.95, finish: 'concrete', polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 },
  dark:     { color: '#2b2f36', metalness: 0.4,  roughness: 0.6, finish: 'paintedSteel' },
  grate:    { color: '#3a4048', metalness: 0.5,  roughness: 0.5, finish: 'grating' },
  water:    { color: '#3b82c4', metalness: 0.25, roughness: 0.18 },
  vapour:   { color: '#e9eef4', metalness: 0.0,  roughness: 1.0, emissive: '#ffffff', emissiveIntensity: 0.3 },
  smoke:    { color: '#3a3f47', metalness: 0.0,  roughness: 1.0, finish: 'none' },
  blueGlow: { color: '#6aa6ff', metalness: 0.2,  roughness: 0.4, emissive: '#2f6fff', emissiveIntensity: 1.3 },
  redGlow:  { color: '#ff5a5a', metalness: 0.2,  roughness: 0.4, emissive: '#ff2020', emissiveIntensity: 1.8 },
  insul:    { color: '#d9dde2', metalness: 0.2,  roughness: 0.7, finish: 'paintedSteel' },
  paintY:   { color: '#e8b53a', metalness: 0.3,  roughness: 0.6, finish: 'paintedSteel', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
}

const SPIN  = { kind: 'spinY', speedKey: 'speed' }
const PULSE = { kind: 'pulse', speedKey: 'speed' }
const BOB   = { kind: 'bob',   speedKey: 'speed' }
const RISE  = { kind: 'rise',  speedKey: 'speed' }   // smoke / vapour plume drifting upward

let _pid = 0
const P = (label, geometry, dims, position, opts = {}) => ({
  id: opts.id || `pp_part_${++_pid}`,
  label, geometry, dims, position,
  rotation: opts.rot || [0, 0, 0], scale: opts.scale || [1, 1, 1],
  parentId: opts.parentId || null,
  material: opts.mat || M.steel,
  animate: opts.animate || null,
})

// ── detail helpers ──
const legs4 = (w, d, h, mat = M.dark) =>
  [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]].map(([x, z]) =>
    P('Support Leg', 'box', { width: 0.35, height: h, depth: 0.35 }, [x, h / 2, z], { mat }))
const platform = (y, r, mat = M.steelDk) => P('Access Platform', 'torus', { radius: r, tube: 0.12 }, [0, y, 0], { rot: [Math.PI / 2, 0, 0], mat })
const ladder = (x, z, y0, h) => P('Ladder', 'box', { width: 0.07, height: h, depth: 0.5 }, [x, y0 + h / 2, z], { mat: M.steelDk })
const gauge = (pos) => P('Gauge Panel', 'box', { width: 0.3, height: 0.4, depth: 0.12 }, pos, { mat: M.amber, animate: PULSE })
const flange = (pos, r, rot = [0, 0, 0]) => P('Flange', 'cylinder', { radius: r, height: 0.14 }, pos, { rot, mat: M.steel })
const tubeBank = (n, mat, animate, y0, span, z = 0) =>
  Array.from({ length: n }, (_, i) =>
    P('Tube', 'cylinder', { radius: 0.11, height: 3 }, [-span + (i * (span * 2)) / (n - 1), y0, z], { mat, animate }))
const ductStub = (label, pos, dims, rot, mat = M.steelDk) => P(label, 'box', dims, pos, { rot, mat })

// Visible inlet/outlet NOZZLES from ports: flanged spool + coloured ring (BLUE in / AMBER out).
const NOZ_IN  = { color: '#2f6fff', metalness: 0.4, roughness: 0.4, emissive: '#2f6fff', emissiveIntensity: 0.55 }
const NOZ_OUT = { color: '#e0a225', metalness: 0.4, roughness: 0.4, emissive: '#e0a225', emissiveIntensity: 0.55 }
function nozzlesFor(ports = []) {
  const out = []
  for (const p of ports) {
    const [x, y, z] = p.offset
    const ax = Math.abs(x), az = Math.abs(z)
    let rot = [0, 0, 0], o = [0, Math.sign(y) || 1, 0]
    if (ax >= az && ax >= 0.3) { rot = [0, 0, Math.PI / 2]; o = [Math.sign(x), 0, 0] }
    else if (az >= 0.3) { rot = [Math.PI / 2, 0, 0]; o = [0, 0, Math.sign(z)] }
    const isConv = p.type === 'conveyor', isPow = p.type === 'power'
    const r = isConv ? 0.5 : isPow ? 0.18 : 0.28
    const mat = isConv ? M.grate : isPow ? M.copper : M.steel
    out.push(P(p.direction === 'in' ? 'Inlet Spool' : 'Outlet Spool', 'cylinder', { radius: r, height: 0.7 }, [x, y, z], { rot, mat }))
    out.push(P(p.direction === 'in' ? 'Inlet Flange' : 'Outlet Flange', 'cylinder', { radius: r * 1.35, height: 0.14 },
      [x + o[0] * 0.4, y + o[1] * 0.4, z + o[2] * 0.4], { rot, mat: p.direction === 'in' ? NOZ_IN : NOZ_OUT }))
  }
  return out
}

const port = (id, type, direction, offset) => ({ id, type, direction, offset })
const pr = (key, label, unit, def, min, max, freq) => ({
  key, label, unit, default: def,
  ...(min != null ? { min } : {}), ...(max != null ? { max } : {}), ...(freq ? { freq } : {}),
})
const CONFIG = [
  { key: 'enabled', label: 'Running', type: 'boolean', default: true },
  { key: 'speed',   label: 'Speed',   type: 'number',  default: 1, min: 0, max: 3, step: 0.1 },
]
// pad:[w,d] prepends a concrete foundation so nothing floats. noNozzles skips auto I/O.
const spec = ({ id, label, layer = 'equipment', parts, ports = [], params = [], states = null, noNozzles = false, pad = null, ground = false }) => ({
  id, label, category: 'Power Plant', layer, schemaVersion: 1,
  defaultConfig: { enabled: true, speed: 1 },
  ...(ground ? { ground: true } : {}),   // SceneRenderer: ground planes deselect on click
  parts: [
    ...(pad ? [P('Foundation', 'box', { width: pad[0], height: 0.4, depth: pad[1] }, [0, 0.2, 0], { mat: M.concrete })] : []),
    ...parts,
    ...(noNozzles ? [] : nozzlesFor(ports)),
  ],
  ports, config: CONFIG, parameters: params, states, subComponents: [], beacon: null,
})

// ── 1. Coal Handling Plant ──
const coalHandling = spec({
  id: 'pp_coal_handling', label: 'Coal Handling Plant', pad: [18, 10],
  parts: [
    P('Receiving Hopper', 'roundedBox', { width: 4, height: 3, depth: 4, bevel: 0.1 }, [-3, 1.9, 0], { mat: M.steelDk }),
    P('Hopper Grate', 'box', { width: 4, height: 0.2, depth: 4 }, [-3, 3.5, 0], { mat: M.grate }),
    P('Crusher House', 'roundedBox', { width: 5, height: 5, depth: 4.5, bevel: 0.12 }, [3, 2.9, 0], { mat: M.red }),
    P('Crusher Roof', 'box', { width: 5.4, height: 0.4, depth: 4.9 }, [3, 5.5, 0], { mat: M.dark }),
    P('Crusher Vent', 'cylinder', { radius: 0.4, height: 1.6 }, [4.4, 6.4, 0], { mat: M.steel }),
    P('Incline Gallery', 'box', { width: 8, height: 0.9, depth: 1.8 }, [2.5, 4.8, 3.6], { rot: [0.5, 0, 0], mat: M.paintY }),
    P('Gallery Truss', 'box', { width: 8, height: 0.1, depth: 1.4 }, [2.5, 5.4, 3.6], { rot: [0.5, 0, 0], mat: M.steelDk }),
    P('Head Pulley', 'cylinder', { radius: 0.7, height: 1.7 }, [5.6, 6.4, 4.0], { rot: [0, 0, Math.PI / 2], mat: M.steel, animate: SPIN }),
    P('Tail Pulley', 'cylinder', { radius: 0.5, height: 1.7 }, [-0.6, 3.2, 1.5], { rot: [0, 0, Math.PI / 2], mat: M.steel, animate: SPIN }),
    P('Stacker Column', 'cylinder', { radius: 0.5, height: 5 }, [-6, 3.9, 0], { mat: M.steel }),
    P('Stacker Boom', 'box', { width: 9, height: 0.4, depth: 0.5 }, [-6, 6.4, 0], { mat: M.paintY, animate: SPIN }),
    P('Boom Counterweight', 'box', { width: 1, height: 1, depth: 1 }, [-10, 6.4, 0], { mat: M.dark }),
    P('Transfer Tower', 'roundedBox', { width: 2.2, height: 6, depth: 2.2, bevel: 0.08 }, [5.6, 3.4, 4], { mat: M.steelDk }),
    ladder(5.2, 0, 0.4, 5),
    // hopper rim rail, crusher-house furniture
    ...handrail({ from: [-4.9, 3.5, -2], to: [-4.9, 3.5, 2] }),
    ...nameplate({ pos: [3.6, 2.1, 2.28] }),
    ...junctionBox({ pos: [1.6, 1.6, 2.3] }),
    ...dial({ pos: [4.4, 3.4, 2.28] }),
  ],
  ports: [port('coal_out', 'conveyor', 'out', [6.5, 1.5, 0])],
  params: [pr('feedRate', 'Coal Feed', 't/h', 210, 0, 400, '1m'), pr('stock', 'Stock Yard', '%', 72, 0, 100, '1h'), pr('crusherLoad', 'Crusher Load', '%', 64, 0, 100, '5s')],
})

// ── 2. Boiler — a big GLASS-walled furnace so you see straight inside: the fire,
// the water-wall tubes, and the SUPERHEATER + ECONOMISER coils (folded in, no
// longer separate objects). Deliberately clean — no boiler-house scaffold. ──
// Glass casing + steel structure, both with CAD-style EDGE outlines so the internal
// compartments read clearly (edges handled in CompositeAsset via material.edges).
const GLASS   = { color: '#cfe4f2', metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.09, edges: true, edgeColor: '#34434f' }
const STEEL_E = { ...M.steelDk, edges: true, edgeColor: '#1e2833' }
// Heat-graded materials — the COLOUR tells the temperature, hottest → coolest along
// the gas path: radiant platens glow orange-hot, the nose/reheater run warm, the
// economiser is cool steel. (Matches how a thermal camera would read the boiler.)
const EMBER_HOT = { color: '#ff9a3a', emissive: '#ff6a00', emissiveIntensity: 2.4, toneMapped: false, metalness: 0.1, roughness: 0.6 }
const HEAT_HI   = { color: '#5a3028', emissive: '#ff4400', emissiveIntensity: 1.15, metalness: 0.3, roughness: 0.55 }
const HEAT_MID  = { color: '#5c4136', emissive: '#e85a1a', emissiveIntensity: 0.5,  metalness: 0.4, roughness: 0.5 }
const HEAT_LOW  = { color: '#6a5a52', emissive: '#a04818', emissiveIntensity: 0.22, metalness: 0.5, roughness: 0.45 }
const COOL      = { color: '#8fa3b8', metalness: 0.6, roughness: 0.35 }
// (The furnace fire is now a bespoke shader effect — see components/assets/BoilerFire.jsx —
//  so the old emissive-cone flame parts are removed from this spec.)
// serpentine convection coils centred at (xc, z): `rows` horizontal passes stacked
// in y, joined end-to-end by short vertical returns (boustrophedon).
const serpentine = (label, xc, z, y0, rows, dy, spanX, mat) => {
  const arr = []
  for (let i = 0; i < rows; i++) {
    const y = y0 + i * dy
    arr.push(P(label, 'cylinder', { radius: 0.14, height: spanX * 2 }, [xc, y, z], { rot: [0, 0, Math.PI / 2], mat }))
    if (i < rows - 1) arr.push(P(label, 'cylinder', { radius: 0.14, height: dy }, [xc + (i % 2 === 0 ? spanX : -spanX), y + dy / 2, z], { mat }))
  }
  return arr
}
// 4 see-through glass walls of a rectangular pass, + its 4 corner posts
const glassBox = (cx, cz, w, d, yc, h) => [
  P('Glass Wall', 'box', { width: w, height: h, depth: 0.14 }, [cx, yc, cz + d / 2], { mat: GLASS }),
  P('Glass Wall', 'box', { width: w, height: h, depth: 0.14 }, [cx, yc, cz - d / 2], { mat: GLASS }),
  P('Glass Wall', 'box', { width: 0.14, height: h, depth: d }, [cx - w / 2, yc, cz], { mat: GLASS }),
  P('Glass Wall', 'box', { width: 0.14, height: h, depth: d }, [cx + w / 2, yc, cz], { mat: GLASS }),
]
const posts4 = (cx, cz, w, d, yc, h) =>
  [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([dx, dz]) =>
    P('Corner Post', 'box', { width: 0.3, height: h, depth: 0.3 }, [cx + dx, yc, cz + dz], { mat: M.steelDk }))
const boiler = spec({
  id: 'pp_boiler', label: 'Boiler', pad: [30, 16],
  parts: [
    // ═══ ONE connected two-pass casing: the FURNACE and the BACK PASS sit side-by-side
    //     sharing the x=-1 divider wall, unified by a continuous top penthouse hood.
    //     Glass walls carry EDGE outlines → the compartments read like the CAD ref. ═══
    // — ONE outer glass shell spanning BOTH passes (a single connected casing) —
    ...glassBox(-2.5, 0, 17, 10, 17, 20),
    ...posts4(-2.5, 0, 17, 10, 17, 20),
    // internal divider between the passes — STOPS SHORT of the roof, leaving the
    // crossover opening the gas flows over (furnace up → over the nose → back-pass down)
    P('Divider Wall', 'box', { width: 0.16, height: 15, depth: 10 }, [-1, 14.5, 0], { mat: GLASS }),
    P('Ash Hopper', 'cone', { radius: 5.2, height: 6.5 }, [-6, 4, 0], { rot: [Math.PI, 0, 0], mat: STEEL_E }),
    P('Hopper Throat', 'box', { width: 1.6, height: 1.4, depth: 2.6 }, [-6, 0.8, 0], { mat: M.steelDk }),
    P('Throat Ember', 'cylinder', { radius: 0.75, height: 0.3 }, [-6, 1.55, 0], { mat: EMBER_HOT }),
    // water-wall tube panel lining the rear furnace wall (radiant pickup — runs warm)
    ...Array.from({ length: 12 }, (_, i) => P('Water-wall Tube', 'cylinder', { radius: 0.09, height: 19 }, [-10.4 + i * 0.8, 16.5, -4.75], { mat: HEAT_LOW })),
    // burner assembly — windbox flush on the left wall, 3×3 burner guns firing INTO
    // the furnace through the wall, glowing muzzles where they enter
    P('Windbox', 'box', { width: 1.8, height: 8.4, depth: 8.6 }, [-11.9, 12.5, 0], { mat: STEEL_E }),
    ...[10, 12.5, 15].flatMap((y) => [-2.6, 0, 2.6].map((z) => P('Burner Gun', 'cylinder', { radius: 0.34, height: 2.6 }, [-10.8, y, z], { rot: [0, 0, Math.PI / 2], mat: M.dark }))),
    ...[10, 12.5, 15].flatMap((y) => [-2.6, 0, 2.6].map((z) => P('Burner Muzzle', 'sphere', { radius: 0.3 }, [-9.5, y, z], { mat: EMBER_HOT }))),
    // furnace nose — sloped baffle turning the gas into the back pass (runs hot)
    P('Furnace Nose', 'box', { width: 4.4, height: 0.4, depth: 9.9 }, [-3, 23.4, 0], { rot: [0, 0, -0.5], mat: HEAT_MID }),
    // superheater platens — RADIANT section, glowing hot — hung from the penthouse
    ...Array.from({ length: 6 }, (_, i) => P('Superheater Platen', 'box', { width: 0.18, height: 8.4, depth: 7.4 }, [-9 + i * 1.25, 21.8, 0], { mat: HEAT_HI })),
    ...Array.from({ length: 6 }, (_, i) => P('Platen Hanger', 'cylinder', { radius: 0.05, height: 1.0 }, [-9 + i * 1.25, 26.5, 0], { mat: M.steelDk })),
    P('SH Header', 'cylinder', { radius: 0.32, height: 7.8 }, [-6, 26.4, 0], { rot: [Math.PI / 2, 0, 0], mat: M.copper }),
    P('SH Riser L', 'cylinder', { radius: 0.22, height: 1.4 }, [-7.6, 27.1, 0], { mat: M.cladding }),
    P('SH Riser R', 'cylinder', { radius: 0.22, height: 1.4 }, [-4.4, 27.1, 0], { mat: M.cladding }),
    // — BACK PASS (2nd pass), the compartment on the other side of the divider —
    P('BP Hopper', 'cone', { radius: 3.6, height: 6 }, [2.5, 4, 0], { rot: [Math.PI, 0, 0], mat: STEEL_E }),
    // internal floor splitting reheater (upper, warm) from economiser (lower, cool) —
    // flush to the casing walls
    P('Pass Divider', 'box', { width: 7, height: 0.3, depth: 10 }, [2.5, 15.4, 0], { mat: STEEL_E }),
    ...serpentine('Reheater Coil', 2.5, 1.6, 18, 4, 0.8, 2.6, HEAT_MID),
    ...serpentine('Reheater Coil', 2.5, -1.6, 18, 4, 0.8, 2.6, HEAT_MID),
    ...serpentine('Economiser Coil', 2.5, 1.6, 9.5, 4, 0.8, 2.6, COOL),
    ...serpentine('Economiser Coil', 2.5, -1.6, 9.5, 4, 0.8, 2.6, COOL),
    // bank headers tying both coil banks to the casing wall (where water/steam enter)
    P('Coil Header', 'cylinder', { radius: 0.2, height: 11.6 }, [5.35, 15.3, 1.6], { mat: M.steel }),
    P('Coil Header', 'cylinder', { radius: 0.2, height: 11.6 }, [5.35, 15.3, -1.6], { mat: M.steel }),
    // ═══ TOP PENTHOUSE HOOD — one continuous casing spanning BOTH passes ═══
    P('Penthouse', 'box', { width: 17.4, height: 2.6, depth: 10.3 }, [-2.5, 28.3, 0], { mat: GLASS }),
    P('Hood Roof', 'box', { width: 18, height: 0.45, depth: 10.9 }, [-2.5, 29.8, 0], { mat: STEEL_E }),
    // steam drum (inside the penthouse) + downcomers plumbed INTO the drum ends
    P('Steam Drum', 'capsule', { radius: 1.5, height: 10 }, [-6, 28.5, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding }),
    P('Downcomer L', 'cylinder', { radius: 0.5, height: 22.5 }, [-11.5, 15.75, 3.6], { mat: M.steel }),
    P('Downcomer R', 'cylinder', { radius: 0.5, height: 22.5 }, [-11.5, 15.75, -3.6], { mat: M.steel }),
    P('Downcomer Elbow', 'sphere', { radius: 0.55 }, [-11.5, 27, 3.6], { mat: M.steel }),
    P('Downcomer Elbow', 'sphere', { radius: 0.55 }, [-11.5, 27, -3.6], { mat: M.steel }),
    P('Drum Feed', 'cylinder', { radius: 0.3, height: 2.8 }, [-10.9, 27.8, 2.4], { rot: [0.6, 0, -0.4], mat: M.steel }),
    P('Drum Feed', 'cylinder', { radius: 0.3, height: 2.8 }, [-10.9, 27.8, -2.4], { rot: [-0.6, 0, -0.4], mat: M.steel }),
  ],
  ports: [
    port('coal_in', 'conveyor', 'in', [-11.7, 8, 2.4]),
    port('air_in', 'utility', 'in', [-12.9, 12.5, 0]),
    port('water_in', 'utility', 'in', [6.2, 11, 0]),
    port('ash_out', 'conveyor', 'out', [-6, 0.5, 3]),
    port('flue_out', 'utility', 'out', [6.2, 8, 0]),
    port('steam_out', 'utility', 'out', [-6, 31, 0]),
  ],
  params: [
    pr('drumPressure', 'Drum Pressure', 'bar', 165, 0, 220, '5s'),
    pr('furnaceTemp', 'Furnace Temp', '°C', 1250, 0, 1600, '30s'),
    pr('steamFlow', 'Steam Flow', 't/h', 420, 0, 700, '5s'),
    pr('steamTemp', 'SH Steam Temp', '°C', 540, 0, 650, '5s'),
    pr('gasOutTemp', 'Econ Gas Out', '°C', 145, 0, 400, '30s'),
    pr('o2', 'Flue O₂', '%', 3.2, 0, 12, '30s'),
  ],
})

// ── 3. Economiser ──
const economiser = spec({
  id: 'pp_economiser', label: 'Economiser', pad: [7, 5],
  parts: [
    P('Casing', 'roundedBox', { width: 6, height: 5, depth: 4, bevel: 0.12 }, [0, 3.9, 0], { mat: M.steelDk }),
    P('Casing Lagging', 'roundedBox', { width: 6.2, height: 5.1, depth: 4.2, bevel: 0.14 }, [0, 3.9, 0], { mat: M.insul, scale: [1, 0.98, 1] }),
    P('Inlet Header', 'cylinder', { radius: 0.4, height: 4.2 }, [0, 6.6, 0], { rot: [Math.PI / 2, 0, 0], mat: M.cladding }),
    P('Outlet Header', 'cylinder', { radius: 0.4, height: 4.2 }, [0, 1.3, 0], { rot: [Math.PI / 2, 0, 0], mat: M.cladding }),
    ...tubeBank(8, M.hot, PULSE, 3.9, 2.4),
    ...tubeBank(8, M.hot, PULSE, 2.6, 2.4),
    P('Flue Duct', 'box', { width: 2, height: 2, depth: 2 }, [0, 7, 0], { mat: M.steel }),
    flange([3.1, 3.9, 0], 0.5, [0, 0, Math.PI / 2]),
    ladder(3.2, 0, 0.4, 5),
    // bolted header end-flanges, feed isolation valve, dial
    ...flangeJoint({ center: [0, 6.6, -2.15], r: 0.52, bolts: 8, axis: 'z' }),
    ...flangeJoint({ center: [0, 1.3, 2.15], r: 0.52, bolts: 8, axis: 'z' }),
    ...valveWheel({ pos: [1.4, 2.05, 1.7] }),
    ...dial({ pos: [-2, 4.6, 2.15] }),
  ],
  ports: [
    port('water_in', 'utility', 'in', [0, 6.6, -2.1]), port('flue_in', 'utility', 'in', [-3.1, 3.9, 0]),
    port('water_out', 'utility', 'out', [0, 1.3, 2.1]), port('flue_out', 'utility', 'out', [3.1, 3.9, 0]),
  ],
  params: [pr('gasInTemp', 'Gas In Temp', '°C', 360, 0, 600, '30s'), pr('waterOutTemp', 'Water Out Temp', '°C', 245, 0, 400, '30s')],
})

// ── 4. Superheater ──
const superheater = spec({
  id: 'pp_superheater', label: 'Superheater', pad: [7, 5],
  parts: [
    P('Casing', 'roundedBox', { width: 6, height: 5.5, depth: 4, bevel: 0.12 }, [0, 3.9, 0], { mat: M.steelDk }),
    P('Casing Lagging', 'roundedBox', { width: 6.2, height: 5.6, depth: 4.2, bevel: 0.14 }, [0, 3.9, 0], { mat: M.insul, scale: [1, 0.98, 1] }),
    P('Inlet Header', 'cylinder', { radius: 0.45, height: 4.2 }, [0, 6.8, 0], { rot: [Math.PI / 2, 0, 0], mat: M.cladding }),
    P('Outlet Header', 'cylinder', { radius: 0.45, height: 4.2 }, [0, 1.2, 0], { rot: [Math.PI / 2, 0, 0], mat: M.cladding }),
    ...tubeBank(9, M.ember, PULSE, 4.1, 2.5),
    ...tubeBank(9, M.ember, PULSE, 2.7, 2.5),
    P('Flue Duct', 'box', { width: 2.2, height: 2, depth: 2 }, [0, 7.1, 0], { mat: M.steel }),
    P('Safety Valve', 'cylinder', { radius: 0.25, height: 1 }, [1.5, 7.3, 0], { mat: M.copper }),
    flange([3.1, 3.9, 0], 0.55, [0, 0, Math.PI / 2]),
    ladder(3.2, 0, 0.4, 5.5),
    gauge([3.2, 4.4, 1.6]),
    // bolted header end-flanges + spray-control valve
    ...flangeJoint({ center: [0, 1.2, -2.15], r: 0.58, bolts: 8, axis: 'z' }),
    ...flangeJoint({ center: [0, 6.8, 2.15], r: 0.58, bolts: 8, axis: 'z' }),
    ...valveWheel({ pos: [-1.4, 2.0, 1.7] }),
  ],
  ports: [
    port('steam_in', 'utility', 'in', [0, 1.2, -2.1]), port('flue_in', 'utility', 'in', [-3.1, 3.9, 0]),
    port('steam_out', 'utility', 'out', [0, 6.8, 2.1]), port('flue_out', 'utility', 'out', [3.1, 3.9, 0]),
  ],
  params: [pr('steamTemp', 'Steam Temp', '°C', 540, 0, 650, '5s'), pr('metalTemp', 'Metal Temp', '°C', 580, 0, 700, '30s'), pr('spray', 'Spray Flow', 't/h', 12, 0, 60, '30s')],
})

// ── 5. Air Pre-heater (rotary / Ljungström) ──
const airPreheater = spec({
  id: 'pp_air_preheater', label: 'Air Pre-heater', pad: [7, 7],
  parts: [
    P('Casing', 'cylinder', { radius: 3, height: 4 }, [0, 3.4, 0], { mat: M.steelDk }),
    P('Rotor Wheel', 'cylinder', { radius: 2.7, height: 3 }, [0, 3.4, 0], { mat: M.amber, animate: SPIN }),
    P('Rotor Spoke A', 'box', { width: 5.2, height: 3.05, depth: 0.1 }, [0, 3.4, 0], { mat: M.steelDk, animate: SPIN }),
    P('Rotor Spoke B', 'box', { width: 0.1, height: 3.05, depth: 5.2 }, [0, 3.4, 0], { mat: M.steelDk, animate: SPIN }),
    P('Rotor Spoke C', 'box', { width: 3.7, height: 3.05, depth: 0.1 }, [0, 3.4, 0], { rot: [0, Math.PI / 4, 0], mat: M.steelDk, animate: SPIN }),
    P('Hub', 'cylinder', { radius: 0.4, height: 4.4 }, [0, 3.4, 0], { mat: M.steel }),
    P('Top Seal', 'torus', { radius: 2.7, tube: 0.2 }, [0, 5.5, 0], { rot: [Math.PI / 2, 0, 0], mat: M.steel }),
    ductStub('Air Duct', [-3.4, 3.4, 0], { width: 2, height: 2, depth: 2 }, [0, 0, 0], M.cladding),
    ductStub('Gas Duct', [3.4, 3.4, 0], { width: 2, height: 2, depth: 2 }, [0, 0, 0], M.steelDk),
    P('Drive Motor', 'cylinder', { radius: 0.4, height: 1 }, [2.6, 5.8, 0], { mat: M.amber, animate: SPIN }),
    platform(5.8, 3.2),
    ladder(3.1, 0, 0.4, 5),
    // bolted casing rim + drive electrics
    ...boltCircle({ center: [0, 5.44, 0], r: 2.86, n: 16, axis: 'y' }),
    ...junctionBox({ pos: [2.6, 4.6, 1.2] }),
    ...nameplate({ pos: [0, 2.2, 3.04] }),
  ],
  ports: [
    port('air_in', 'utility', 'in', [0, 1.4, -3.1]), port('flue_in', 'utility', 'in', [4.3, 3.4, 0]),
    port('air_out', 'utility', 'out', [-4.3, 3.4, 0]), port('flue_out', 'utility', 'out', [0, 5.4, 3.1]),
  ],
  params: [pr('gasOutTemp', 'Gas Out Temp', '°C', 145, 0, 400, '30s'), pr('leakage', 'Air Leakage', '%', 8, 0, 30, '1h'), pr('rpm', 'Rotor Speed', 'rpm', 1.5, 0, 4, '1m')],
})

// ── 6. ESP (Electrostatic Precipitator) ──
const esp = spec({
  id: 'pp_esp', label: 'Electrostatic Precipitator', pad: [9, 6],
  parts: [
    P('Casing', 'roundedBox', { width: 8, height: 6, depth: 5, bevel: 0.14 }, [0, 5.4, 0], { mat: M.cladding }),
    P('Casing Ribs', 'box', { width: 8.2, height: 0.2, depth: 5.2 }, [0, 7.4, 0], { mat: M.steelDk }),
    ...[-2.7, -0.9, 0.9, 2.7].map((x, i) => P(`Field ${i + 1} Plate`, 'box', { width: 0.1, height: 5, depth: 4.5 }, [x, 5.4, 0], { mat: M.blueGlow, animate: PULSE })),
    ...[-2.7, -0.9, 0.9, 2.7].map((x, i) => P(`Rapper ${i + 1}`, 'cylinder', { radius: 0.25, height: 0.4 }, [x, 8.4, 0], { mat: M.amber, animate: SPIN })),
    P('Inlet Plenum', 'box', { width: 1.6, height: 4, depth: 4.6 }, [-4.4, 5, 0], { mat: M.steelDk }),
    P('Outlet Plenum', 'box', { width: 1.6, height: 4, depth: 4.6 }, [4.4, 5, 0], { mat: M.steelDk }),
    P('Hopper 1', 'cone', { radius: 1.6, height: 2.2 }, [-2.2, 1.4, 0], { rot: [Math.PI, 0, 0], mat: M.steelDk }),
    P('Hopper 2', 'cone', { radius: 1.6, height: 2.2 }, [2.2, 1.4, 0], { rot: [Math.PI, 0, 0], mat: M.steelDk }),
    P('HV Transformer', 'box', { width: 1.2, height: 1, depth: 1 }, [0, 9.2, 0], { mat: M.dark }),
    P('HV Insulator', 'cylinder', { radius: 0.3, height: 1 }, [0, 8.5, 0], { mat: M.glass }),
    P('Roof', 'box', { width: 8.2, height: 0.4, depth: 5.2 }, [0, 8.5, 0], { mat: M.dark }),
    ladder(4.1, 0, 0.4, 8),
    // roof access rail + field electrics
    ...handrail({ from: [-3.9, 8.7, 2.4], to: [3.9, 8.7, 2.4] }),
    ...junctionBox({ pos: [-3.2, 3.4, 2.56] }),
    ...nameplate({ pos: [2.6, 3.2, 2.56] }),
  ],
  ports: [port('flue_in', 'utility', 'in', [-5.2, 5, 0]), port('flue_out', 'utility', 'out', [5.2, 5, 0])],
  params: [pr('efficiency', 'Collection Eff', '%', 99.4, 90, 100, '5m'), pr('dustOut', 'Dust Out', 'mg/Nm³', 28, 0, 200, '5m'), pr('fieldKV', 'Field Voltage', 'kV', 62, 0, 90, '30s')],
})

// ── 7 & 8. ID / FD Fan ──
const fanSpec = (id, label, inType, outType, params) => spec({
  id, label, pad: [7, 8],
  parts: [
    P('Volute Casing', 'cylinder', { radius: 2.2, height: 1.6 }, [0, 2.6, 0], { rot: [Math.PI / 2, 0, 0], mat: M.steelDk }),
    P('Volute Scroll', 'torus', { radius: 2.2, tube: 0.5 }, [0, 2.6, 0], { rot: [Math.PI / 2, 0, 0], mat: M.cladding }),
    P('Impeller Disc', 'cylinder', { radius: 1.9, height: 0.9 }, [0, 2.6, 0], { rot: [Math.PI / 2, 0, 0], mat: M.steel, animate: SPIN }),
    P('Blade A', 'box', { width: 3.6, height: 0.7, depth: 0.12 }, [0, 2.6, 0.1], { mat: M.cladding, animate: SPIN }),
    P('Blade B', 'box', { width: 0.12, height: 0.7, depth: 3.6 }, [0, 2.6, 0.1], { mat: M.cladding, animate: SPIN }),
    P('Blade C', 'box', { width: 2.6, height: 0.7, depth: 0.12 }, [0, 2.6, 0.1], { rot: [0, Math.PI / 4, 0], mat: M.cladding, animate: SPIN }),
    P('Inlet Damper Box', 'roundedBox', { width: 1.4, height: 1.6, depth: 1.6, bevel: 0.06 }, [0, 2.6, -2.4], { mat: M.steelDk }),
    P('Inlet Cone', 'cone', { radius: 1.2, height: 1.4 }, [0, 2.6, -1.7], { rot: [Math.PI / 2, 0, 0], mat: M.steel }),
    P('Discharge Evasé', 'roundedBox', { width: 1.6, height: 2.6, depth: 1.6, bevel: 0.07 }, [2.8, 3.6, 0], { mat: M.steelDk }),
    P('Drive Shaft', 'cylinder', { radius: 0.18, height: 2 }, [0, 2.6, 2], { rot: [Math.PI / 2, 0, 0], mat: M.steel, animate: SPIN }),
    P('Coupling Guard', 'box', { width: 0.6, height: 0.6, depth: 0.6 }, [0, 2.6, 2.6], { mat: M.paintY }),
    P('Motor', 'cylinder', { radius: 0.7, height: 1.8 }, [0, 2.6, 3.4], { rot: [Math.PI / 2, 0, 0], mat: M.amber }),
    P('Motor Fins', 'torus', { radius: 0.7, tube: 0.08 }, [0, 2.6, 3.4], { rot: [Math.PI / 2, 0, 0], mat: M.dark }),
    P('Bearing Pedestal', 'box', { width: 0.9, height: 1.6, depth: 0.9 }, [0, 1, 2.2], { mat: M.steelDk }),
    // bolted volute face + motor electrics
    ...boltCircle({ center: [0, 2.6, 0.84], r: 2.05, n: 12, axis: 'z' }),
    ...junctionBox({ pos: [0.9, 1.6, 3.4] }),
  ],
  ports: [port('in', inType, 'in', [0, 2.6, -3]), port('out', outType, 'out', [3.5, 3.6, 0])],
  params,
})
const idFan = fanSpec('pp_id_fan', 'ID Fan', 'utility', 'utility',
  [pr('flow', 'Gas Flow', 'm³/s', 480, 0, 800, '5s'), pr('draft', 'Draft', 'Pa', -250, -600, 0, '5s'), pr('rpm', 'Speed', 'rpm', 990, 0, 1500, '5s')])
const fdFan = fanSpec('pp_fd_fan', 'FD Fan', 'utility', 'utility',
  [pr('flow', 'Air Flow', 'm³/s', 360, 0, 700, '5s'), pr('dischargePressure', 'Discharge', 'kPa', 4.2, 0, 12, '5s'), pr('rpm', 'Speed', 'rpm', 740, 0, 1200, '5s')])

// ── 9. Chimney / Stack ──
const chimney = spec({
  id: 'pp_chimney', label: 'Chimney', layer: 'structural', pad: [9, 9],
  parts: [
    P('Base', 'cylinder', { radius: 3.5, height: 4 }, [0, 2.4, 0], { mat: M.concrete }),
    P('Flue Inlet Box', 'box', { width: 2.5, height: 3, depth: 2.5 }, [-3, 5.4, 0], { mat: M.steelDk }),
    P('Stack Lower', 'cylinder', { radius: 2.6, height: 12 }, [0, 11.4, 0], { mat: M.cladding }),
    P('Stack Upper', 'cylinder', { radius: 1.8, height: 12 }, [0, 23.4, 0], { mat: M.cladding }),
    P('Red Band 1', 'cylinder', { radius: 2.62, height: 1.4 }, [0, 16.4, 0], { mat: M.red }),
    P('Red Band 2', 'cylinder', { radius: 1.82, height: 1.4 }, [0, 28.4, 0], { mat: M.red }),
    P('Platform Ring', 'torus', { radius: 2, tube: 0.18 }, [0, 17.4, 0], { rot: [Math.PI / 2, 0, 0], mat: M.dark }),
    P('Service Ladder', 'box', { width: 0.1, height: 26, depth: 0.5 }, [2.4, 16, 0], { mat: M.steelDk }),
    P('Smoke 1', 'sphere', { radius: 2 }, [0, 30, 0], { mat: M.smoke, animate: RISE }),
    P('Smoke 2', 'sphere', { radius: 1.6 }, [0.6, 30.5, 0.4], { mat: M.smoke, animate: RISE }),
    P('Smoke 3', 'sphere', { radius: 1.3 }, [-0.6, 31, -0.4], { mat: M.smoke, animate: RISE }),
    // anchored base ring + ID plate
    ...boltCircle({ center: [0, 4.44, 0], r: 2.85, n: 16, axis: 'y' }),
    ...nameplate({ pos: [2.4, 2, 2.62] }),
  ],
  ports: [port('flue_in', 'utility', 'in', [-4.2, 5.4, 0])],
  params: [pr('gasTemp', 'Exit Temp', '°C', 135, 0, 300, '30s'), pr('opacity', 'Opacity', '%', 6, 0, 100, '5m'), pr('so2', 'SO₂', 'ppm', 180, 0, 800, '15m')],
})

// ── 10. Feed Water Heater ──
const feedWaterHeater = spec({
  id: 'pp_feed_water_heater', label: 'Feed Water Heater', pad: [9, 5],
  parts: [
    P('Shell', 'cylinder', { radius: 1.4, height: 7 }, [0, 2.9, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding }),
    P('Shell Lagging', 'cylinder', { radius: 1.5, height: 6.6 }, [0, 2.9, 0], { rot: [0, 0, Math.PI / 2], mat: M.insul }),
    P('Channel Head L', 'sphere', { radius: 1.4 }, [-3.5, 2.9, 0], { mat: M.steel }),
    P('Channel Head R', 'sphere', { radius: 1.4 }, [3.5, 2.9, 0], { mat: M.steel }),
    P('Manway', 'cylinder', { radius: 0.5, height: 0.3 }, [3.5, 2.9, 1.4], { rot: [Math.PI / 2, 0, 0], mat: M.dark }),
    P('Steam Nozzle', 'cylinder', { radius: 0.4, height: 1.4 }, [0, 4.4, 0], { mat: M.steel }),
    flange([0, 5, 0], 0.5),
    P('Level Glass', 'box', { width: 0.18, height: 1.6, depth: 0.18 }, [0, 2.9, 1.45], { mat: M.glass, animate: PULSE }),
    gauge([1.6, 4.1, 1.2]),
    P('Saddle L', 'box', { width: 0.8, height: 1.6, depth: 2.8 }, [-2.5, 1.1, 0], { mat: M.dark }),
    P('Saddle R', 'box', { width: 0.8, height: 1.6, depth: 2.8 }, [2.5, 1.1, 0], { mat: M.dark }),
    // bolted girth flanges at the channel heads + manway bolts + extraction valve
    ...flangeJoint({ center: [-2.95, 2.9, 0], r: 1.48, thick: 0.16, bolts: 12, axis: 'x' }),
    ...flangeJoint({ center: [2.95, 2.9, 0], r: 1.48, thick: 0.16, bolts: 12, axis: 'x' }),
    ...boltCircle({ center: [3.5, 2.9, 1.48], r: 0.42, n: 8, axis: 'z' }),
    ...valveWheel({ pos: [0, 5.55, 0] }),
  ],
  ports: [
    port('cond_in', 'utility', 'in', [-4.7, 2.9, 0]), port('steam_in', 'utility', 'in', [0, 4.9, 0]),
    port('water_out', 'utility', 'out', [4.7, 2.9, 0]),
  ],
  params: [pr('outletTemp', 'Outlet Temp', '°C', 220, 0, 400, '30s'), pr('level', 'Level', '%', 55, 0, 100, '30s'), pr('ttd', 'Term. Diff', '°C', 2.8, 0, 10, '5m')],
})

// ── 11. Deaerator ──
const deaerator = spec({
  id: 'pp_deaerator', label: 'Deaerator', layer: 'structural', pad: [10, 5],
  parts: [
    P('Dome Drum', 'capsule', { radius: 1.3, height: 8.6 }, [0, 7.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding }),
    P('Storage Tank', 'capsule', { radius: 1.8, height: 11.6 }, [0, 3.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel }),
    P('Spray Valve', 'cylinder', { radius: 0.3, height: 1.2 }, [0, 9.8, 0], { mat: M.amber }),
    P('Vent', 'cylinder', { radius: 0.25, height: 1.5 }, [2, 9.8, 0], { mat: M.steel }),
    P('Vent Steam', 'sphere', { radius: 0.7 }, [2, 11, 0], { mat: M.vapour, animate: BOB }),
    P('Down-leg', 'cylinder', { radius: 0.35, height: 3 }, [0, 5.4, 0], { mat: M.cladding }),
    P('Level Glass', 'box', { width: 0.2, height: 2, depth: 0.2 }, [0, 3.4, 1.9], { mat: M.glass, animate: PULSE }),
    P('Saddle L', 'box', { width: 0.8, height: 2.4, depth: 3.4 }, [-3, 1.2, 0], { mat: M.dark }),
    P('Saddle R', 'box', { width: 0.8, height: 2.4, depth: 3.4 }, [3, 1.2, 0], { mat: M.dark }),
    ladder(4.2, 0, 0.4, 9),
    // spray-header isolation valve, tank dial, drum access rail
    ...valveWheel({ pos: [-0.8, 10.15, 0] }),
    ...dial({ pos: [1.2, 4.1, 1.62] }),
    ...handrail({ from: [-2.6, 8.7, 0.8], to: [2.6, 8.7, 0.8] }),
  ],
  ports: [
    port('tw_in', 'utility', 'in', [-5.7, 3.4, 0]), port('cond_in', 'utility', 'in', [0, 9.8, -1.3]),
    port('steam_in', 'utility', 'in', [0, 1.4, -1.9]), port('water_out', 'utility', 'out', [5.7, 3.4, 0]),
  ],
  params: [pr('o2', 'Dissolved O₂', 'ppb', 7, 0, 50, '15m'), pr('tankLevel', 'Tank Level', '%', 62, 0, 100, '30s'), pr('pressure', 'Pressure', 'bar', 1.2, 0, 5, '30s')],
})

// ── 12. Steam Turbine ──
const steamTurbine = spec({
  id: 'pp_steam_turbine', label: 'Steam Turbine', pad: [16, 5],
  parts: [
    P('HP Casing', 'cylinder', { radius: 1.3, height: 3 }, [-3.5, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding }),
    P('IP Casing', 'cylinder', { radius: 1.7, height: 3.5 }, [0, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding }),
    P('LP Casing', 'cylinder', { radius: 2.3, height: 4.5 }, [4, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.steelDk }),
    P('HP Lagging', 'cylinder', { radius: 1.4, height: 2.8 }, [-3.5, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.insul }),
    P('Crossover Pipe', 'cylinder', { radius: 0.5, height: 4 }, [1.8, 4.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding }),
    P('Rotor Shaft', 'cylinder', { radius: 0.35, height: 14 }, [0, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel, animate: SPIN }),
    P('Blade Disc 1', 'cylinder', { radius: 1.1, height: 0.3 }, [-3.5, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding, animate: SPIN }),
    P('Blade Disc 2', 'cylinder', { radius: 1.5, height: 0.3 }, [0, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding, animate: SPIN }),
    P('Blade Disc 3', 'cylinder', { radius: 2.1, height: 0.4 }, [3, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding, animate: SPIN }),
    P('Blade Disc 4', 'cylinder', { radius: 2.1, height: 0.4 }, [5, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.cladding, animate: SPIN }),
    P('Exhaust Hood', 'roundedBox', { width: 3, height: 1.6, depth: 3, bevel: 0.08 }, [4, 0.9, 0], { mat: M.steelDk }),
    P('Front Bearing', 'roundedBox', { width: 1, height: 1.4, depth: 1.8, bevel: 0.06 }, [-6.2, 2, 0], { mat: M.steelDk }),
    P('Barring Gear', 'roundedBox', { width: 0.8, height: 1, depth: 1, bevel: 0.05 }, [6.6, 1.8, 0], { mat: M.amber }),
    P('Governor', 'roundedBox', { width: 1, height: 1.4, depth: 1.2, bevel: 0.06 }, [-7.35, 2.6, 0], { mat: M.amber }),
    P('Steam Chest', 'cylinder', { radius: 0.6, height: 2 }, [-5, 4.4, 0], { mat: M.cladding }),
    P('Lube Oil Console', 'roundedBox', { width: 1.6, height: 1.4, depth: 1.2, bevel: 0.06 }, [-3, 1.1, 2.4], { mat: M.red }),
    P('Coupling', 'cylinder', { radius: 0.5, height: 0.6 }, [6.8, 2.8, 0], { rot: [0, 0, Math.PI / 2], mat: M.copper, animate: SPIN }),
    gauge([-3.5, 4.8, 1.8]),
    // bolted casing split flanges between HP–IP and IP–LP, maintenance handrail
    // along the pedestal, nameplate on the exhaust hood
    ...flangeJoint({ center: [-1.9, 2.8, 0], r: 1.5, thick: 0.18, bolts: 12, axis: 'x' }),
    ...flangeJoint({ center: [1.8, 2.8, 0], r: 1.85, thick: 0.18, bolts: 14, axis: 'x' }),
    ...handrail({ from: [-7.6, 0.4, 2.3], to: [7.4, 0.4, 2.3] }),
    ...nameplate({ pos: [4, 1.1, 1.56] }),
    ...gaugeCluster([-4.6, 3.4, 1.2]),
  ],
  ports: [
    port('steam_in', 'utility', 'in', [-5, 5.4, 0]), port('steam_out', 'utility', 'out', [4, 0.5, 0]),
    port('shaft_out', 'power', 'out', [7.2, 2.8, 0]),
  ],
  params: [pr('speed', 'Speed', 'rpm', 3000, 0, 3600, '5s'), pr('power', 'Output', 'MW', 210, 0, 350, '5s'), pr('vibration', 'Vibration', 'µm', 35, 0, 150, '5s'), pr('bearingTemp', 'Bearing Temp', '°C', 78, 0, 120, '30s')],
})

// ── 13. Condenser ──
const condenser = spec({
  id: 'pp_condenser', label: 'Condenser', pad: [8, 6],
  parts: [
    P('Shell', 'roundedBox', { width: 6, height: 4, depth: 4, bevel: 0.12 }, [0, 3.4, 0], { mat: M.steelDk }),
    P('Steam Inlet Neck', 'roundedBox', { width: 3.2, height: 1.8, depth: 3.2, bevel: 0.08 }, [0, 5.8, 0], { mat: M.cladding }),
    P('Exhaust Hood', 'cylinder', { radius: 1.7, height: 1.4 }, [0, 7, 0], { mat: M.steelDk }),
    P('Water Box L', 'cylinder', { radius: 1.2, height: 1 }, [-3.4, 3.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel }),
    P('Water Box R', 'cylinder', { radius: 1.2, height: 1 }, [3.4, 3.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel }),
    P('Tube Sheet', 'box', { width: 5.6, height: 3.4, depth: 0.2 }, [0, 3.4, 0], { mat: M.copper }),
    P('Hotwell Water', 'box', { width: 5.6, height: 0.8, depth: 3.6 }, [0, 1.6, 0], { mat: M.water, animate: BOB }),
    P('CW Inlet Pipe', 'cylinder', { radius: 0.6, height: 2 }, [-4.5, 3.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.water }),
    P('CW Outlet Pipe', 'cylinder', { radius: 0.6, height: 2 }, [4.5, 3.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.water }),
    P('Air Ejector', 'cylinder', { radius: 0.3, height: 1.4 }, [2, 6.4, 0], { mat: M.amber }),
    P('Condensate Pump', 'cylinder', { radius: 0.4, height: 1 }, [0, 0.9, 2.3], { mat: M.amber, animate: SPIN }),
    gauge([3, 4.4, 2]),
    // bolted channel-head covers on the water boxes, top handrail, nameplate
    ...boltCircle({ center: [-3.95, 3.4, 0], r: 0.98, n: 12, axis: 'x' }),
    ...boltCircle({ center: [3.95, 3.4, 0], r: 0.98, n: 12, axis: 'x' }),
    ...handrail({ from: [-2.8, 5.42, 1.75], to: [2.8, 5.42, 1.75] }),
    ...nameplate({ pos: [2, 2.6, 2.08] }),
  ],
  ports: [
    port('steam_in', 'utility', 'in', [0, 7.4, 0]), port('cw_in', 'utility', 'in', [-5.5, 3.4, 0]),
    port('cond_out', 'utility', 'out', [0, 0.9, 2.1]), port('warm_out', 'utility', 'out', [5.5, 3.4, 0]),
  ],
  params: [pr('vacuum', 'Vacuum', 'kPa', 8, 0, 30, '5s'), pr('ctw', 'CW Out Temp', '°C', 38, 0, 60, '30s'), pr('hotwellLevel', 'Hotwell', '%', 50, 0, 100, '30s')],
})

// ── 14. Generator ──
const generator = spec({
  id: 'pp_generator', label: 'Generator', pad: [10, 5],
  parts: [
    P('Stator Casing', 'cylinder', { radius: 1.8, height: 6 }, [0, 2.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.steelDk }),
    P('Stator End L', 'cylinder', { radius: 1.85, height: 0.4 }, [-3, 2.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel }),
    P('Stator End R', 'cylinder', { radius: 1.85, height: 0.4 }, [3, 2.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel }),
    P('Rotor', 'cylinder', { radius: 0.9, height: 6.6 }, [0, 2.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.copper, animate: SPIN }),
    P('Cooling Fin A', 'box', { width: 0.1, height: 0.9, depth: 3.4 }, [0.3, 2.6, 0], { mat: M.cladding, animate: SPIN }),
    P('Cooling Fin B', 'box', { width: 0.1, height: 0.9, depth: 3.4 }, [-0.3, 2.6, 0], { mat: M.cladding, animate: SPIN }),
    P('Exciter', 'cylinder', { radius: 0.8, height: 1.6 }, [4.2, 2.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.amber, animate: SPIN }),
    P('Coupling', 'cylinder', { radius: 0.5, height: 0.6 }, [-3.4, 2.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.copper, animate: SPIN }),
    P('Terminal Box', 'roundedBox', { width: 1.6, height: 1.2, depth: 1.6, bevel: 0.06 }, [0, 4.8, 0], { mat: M.copper }),
    P('Bushing 1', 'cylinder', { radius: 0.16, height: 1 }, [-0.5, 5.6, 0], { mat: M.glass }),
    P('Bushing 2', 'cylinder', { radius: 0.16, height: 1 }, [0, 5.6, 0], { mat: M.glass }),
    P('Bushing 3', 'cylinder', { radius: 0.16, height: 1 }, [0.5, 5.6, 0], { mat: M.glass }),
    P('H₂ Cooler', 'roundedBox', { width: 1.4, height: 0.8, depth: 1, bevel: 0.05 }, [2, 4.4, 1.5], { mat: M.steel }),
    // bolted end-shield rings, dial cluster, nameplate + junction box
    ...boltCircle({ center: [-3.22, 2.6, 0], r: 1.55, n: 14, axis: 'x' }),
    ...boltCircle({ center: [3.22, 2.6, 0], r: 1.55, n: 14, axis: 'x' }),
    ...gaugeCluster([-1.4, 3.4, 1.64]),
    ...nameplate({ pos: [0.9, 2.2, 1.78] }),
    ...junctionBox({ pos: [-2.2, 1.1, 1.9] }),
  ],
  ports: [port('shaft_in', 'power', 'in', [-4.8, 2.6, 0]), port('power_out', 'power', 'out', [0, 6, 0])],
  params: [pr('power', 'Output', 'MW', 205, 0, 350, '5s'), pr('voltage', 'Voltage', 'kV', 21, 0, 30, '5s'), pr('freq', 'Frequency', 'Hz', 50, 48, 52, '5s'), pr('statorTemp', 'Stator Temp', '°C', 85, 0, 130, '30s')],
})

// ── 15. Transformer ──
const transformer = spec({
  id: 'pp_transformer', label: 'Transformer', pad: [5, 4],
  parts: [
    P('Tank', 'roundedBox', { width: 4, height: 3.5, depth: 3, bevel: 0.1 }, [0, 2.4, 0], { mat: M.steelDk }),
    P('Tank Lid', 'roundedBox', { width: 4.2, height: 0.3, depth: 3.2, bevel: 0.05 }, [0, 4.25, 0], { mat: M.dark }),
    P('HV Bushing 1', 'cylinder', { radius: 0.25, height: 1.8 }, [-1.2, 5, 0], { mat: M.glass }),
    P('HV Bushing 2', 'cylinder', { radius: 0.25, height: 1.8 }, [0, 5, 0], { mat: M.glass }),
    P('HV Bushing 3', 'cylinder', { radius: 0.25, height: 1.8 }, [1.2, 5, 0], { mat: M.glass }),
    P('LV Bushing', 'cylinder', { radius: 0.3, height: 1 }, [-1.8, 4.4, 1.2], { mat: M.glass }),
    P('Conservator', 'cylinder', { radius: 0.5, height: 3 }, [0, 5, -1.6], { rot: [0, 0, Math.PI / 2], mat: M.cladding }),
    P('Radiator A', 'box', { width: 0.3, height: 3, depth: 2.6 }, [2.3, 2.4, 0.6], { mat: M.steel }),
    P('Radiator B', 'box', { width: 0.3, height: 3, depth: 2.6 }, [2.5, 2.4, -0.6], { mat: M.steel }),
    P('Cooling Fan', 'cylinder', { radius: 0.7, height: 0.2 }, [2.9, 2.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.dark, animate: SPIN }),
    P('Fan Blade', 'box', { width: 1.3, height: 0.1, depth: 0.2 }, [2.95, 2.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.steelDk, animate: SPIN }),
    P('Buchholz Relay', 'cylinder', { radius: 0.2, height: 0.5 }, [0, 4.4, -0.9], { rot: [Math.PI / 2, 0, 0], mat: M.amber }),
    // lid bolt ring, oil-level dial, nameplate + LV junction box
    ...boltCircle({ center: [0, 4.44, 0], r: 1.75, n: 14, axis: 'y' }),
    ...dial({ pos: [-1.2, 3.2, 1.54] }),
    ...nameplate({ pos: [0.6, 2.2, 1.54] }),
    ...junctionBox({ pos: [-1.5, 1.3, 1.58] }),
  ],
  ports: [port('power_in', 'power', 'in', [0, 5.8, 0]), port('power_out', 'power', 'out', [-1.8, 4.4, 1.6])],
  params: [pr('loadMVA', 'Load', 'MVA', 240, 0, 400, '5s'), pr('oilTemp', 'Oil Temp', '°C', 62, 0, 110, '30s'), pr('windingTemp', 'Winding Temp', '°C', 78, 0, 130, '30s'), pr('tapPos', 'Tap', '', 9, 1, 17, 'manual')],
})

// ── 16. Transmission Tower (Grid) ──
// ── 16. Transmission Tower (Grid) — tapered lattice, double-circuit ──
const gridParts = () => {
  const out = []
  const ST = M.steel, DK = M.steelDk
  const Hb = 14, hwBot = 3, hwTop = 1.05
  const hwAt = (y) => hwBot - (y / Hb) * (hwBot - hwTop)
  // horizontal belt square at height y
  const belt = (y, hw, mat = DK, t = 0.12) => out.push(
    P('Belt', 'box', { width: 2 * hw, height: t, depth: t }, [0, y, hw], { mat }),
    P('Belt', 'box', { width: 2 * hw, height: t, depth: t }, [0, y, -hw], { mat }),
    P('Belt', 'box', { width: t, height: t, depth: 2 * hw }, [hw, y, 0], { mat }),
    P('Belt', 'box', { width: t, height: t, depth: 2 * hw }, [-hw, y, 0], { mat }))
  // X-bracing on all four faces of a panel
  const xbrace = (y0, y1, hw, mat = ST) => {
    const dy = y1 - y0, w = 2 * hw, len = Math.hypot(w, dy), cy = (y0 + y1) / 2, ang = Math.atan2(dy, w)
    for (const z of [hw, -hw]) {
      out.push(P('Brace', 'box', { width: len, height: 0.09, depth: 0.09 }, [0, cy, z], { rot: [0, 0, ang], mat }))
      out.push(P('Brace', 'box', { width: len, height: 0.09, depth: 0.09 }, [0, cy, z], { rot: [0, 0, -ang], mat }))
    }
    for (const x of [hw, -hw]) {
      out.push(P('Brace', 'box', { width: 0.09, height: 0.09, depth: len }, [x, cy, 0], { rot: [ang, 0, 0], mat }))
      out.push(P('Brace', 'box', { width: 0.09, height: 0.09, depth: len }, [x, cy, 0], { rot: [-ang, 0, 0], mat }))
    }
  }
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
  // tapered legs + concrete footings
  const tilt = Math.atan2(hwBot - hwTop, Hb), hwMid = (hwBot + hwTop) / 2
  for (const [sx, sz] of corners) {
    out.push(P('Leg', 'box', { width: 0.26, height: Hb + 0.4, depth: 0.26 }, [sx * hwMid, Hb / 2, sz * hwMid], { rot: [-sz * tilt, 0, sx * tilt], mat: ST }))
    out.push(P('Footing', 'box', { width: 0.8, height: 0.7, depth: 0.8 }, [sx * hwBot, 0.35, sz * hwBot], { mat: M.concrete }))
  }
  // body belts + X-bracing
  const levels = [0, 3, 6, 9, 11.5, 14]
  for (const y of levels) belt(y, hwAt(y))
  for (let i = 0; i < levels.length - 1; i++) xbrace(levels[i], levels[i + 1], hwAt((levels[i] + levels[i + 1]) / 2))
  // strut between two points in the transverse (x-y) plane — for arms + star top
  const memberXY = (x0, y0, x1, y1, mat = ST, th = 0.1) => {
    const dx = x1 - x0, dy = y1 - y0
    out.push(P('Member', 'box', { width: Math.hypot(dx, dy), height: th, depth: th },
      [(x0 + x1) / 2, (y0 + y1) / 2, 0], { rot: [0, 0, Math.atan2(dy, dx)], mat }))
  }
  // upper (cross-arm) body — slender square section near the top
  const topHw = 1.0, topLevels = [14, 15.6, 17, 18.4]
  for (const [sx, sz] of corners) out.push(P('Top Leg', 'box', { width: 0.2, height: 4.7, depth: 0.2 }, [sx * topHw, 16.2, sz * topHw], { mat: ST }))
  for (const y of topLevels) belt(y, topHw, DK, 0.09)
  for (let i = 0; i < topLevels.length - 1; i++) xbrace(topLevels[i], topLevels[i + 1], topHw)
  // three cross-arms per side (double circuit) — triangular trusses + hanging insulator strings
  const arm = (y, len, s) => {
    const root = s * topHw, tip = s * len
    memberXY(root, y + 0.4, tip, y, ST, 0.13)        // top chord → tip
    memberXY(root, y - 0.4, tip, y, ST, 0.13)        // bottom chord → tip
    const mx = root + (tip - root) * 0.45
    memberXY(root, y - 0.4, mx, y + 0.18, DK, 0.07)  // web diagonals
    memberXY(mx, y + 0.18, tip, y, DK, 0.07)
    out.push(P('Arm Tip', 'box', { width: 0.16, height: 0.8, depth: 0.5 }, [tip, y, 0], { mat: ST }))
    for (let d = 0; d < 6; d++) out.push(P('Insulator Disc', 'cylinder', { radius: 0.15 - d * 0.004, height: 0.16 }, [tip, y - 0.6 - d * 0.2, 0], { mat: M.glass }))
    out.push(P('Conductor Clamp', 'sphere', { radius: 0.15 }, [tip, y - 1.9, 0], { mat: DK }))
  }
  arm(14, 5.0, 1); arm(14, 5.0, -1)
  arm(16, 4.2, 1); arm(16, 4.2, -1)
  arm(18, 3.4, 1); arm(18, 3.4, -1)
  // double-peak "star" top — two earth-wire peaks with crossing diagonals
  const yT = 18.4, peakY = 22.2, px = 2.1
  memberXY(-topHw, yT, -px, peakY, ST, 0.12)        // outer rising chords
  memberXY(topHw, yT, px, peakY, ST, 0.12)
  memberXY(-topHw, yT, px, peakY, DK, 0.08)         // crossing X (the star)
  memberXY(topHw, yT, -px, peakY, DK, 0.08)
  memberXY(-px, peakY, 0, peakY - 1.0, DK, 0.08)    // central valley dip
  memberXY(px, peakY, 0, peakY - 1.0, DK, 0.08)
  out.push(P('Earth Peak L', 'box', { width: 0.12, height: 0.7, depth: 0.12 }, [-px, peakY + 0.35, 0], { mat: ST }))
  out.push(P('Earth Peak R', 'box', { width: 0.12, height: 0.7, depth: 0.12 }, [px, peakY + 0.35, 0], { mat: ST }))
  out.push(P('Earth Wire Clamp L', 'sphere', { radius: 0.1 }, [-px, peakY + 0.7, 0], { mat: DK }))
  out.push(P('Earth Wire Clamp R', 'sphere', { radius: 0.1 }, [px, peakY + 0.7, 0], { mat: DK }))
  out.push(P('Aviation Light', 'sphere', { radius: 0.2 }, [0, peakY - 0.7, 0], { mat: M.redGlow, animate: PULSE }))
  // line terminal at the incoming-feeder face (port lives here)
  out.push(P('Line Terminal', 'cylinder', { radius: 0.18, height: 0.8 }, [0, 12, -3], { rot: [Math.PI / 2, 0, 0], mat: M.copper }))
  return out
}
const grid = spec({
  id: 'pp_grid', label: 'Transmission Tower', layer: 'structural', noNozzles: true,
  parts: gridParts(),
  ports: [port('power_in', 'power', 'in', [0, 12, -3])],
  params: [pr('exportMW', 'Export', 'MW', 198, 0, 350, '5s'), pr('lineVoltage', 'Line Voltage', 'kV', 400, 0, 765, '5s'), pr('lineCurrent', 'Line Current', 'A', 290, 0, 600, '5s')],
})

// ── 17. Cooling Tower (natural draft) ──
const coolingTower = spec({
  id: 'pp_cooling_tower', label: 'Cooling Tower', layer: 'structural', pad: [18, 18],
  parts: [
    P('Basin', 'cylinder', { radius: 8, height: 1.2 }, [0, 1, 0], { mat: M.concrete }),
    P('Basin Water', 'cylinder', { radius: 7.6, height: 0.4 }, [0, 1.5, 0], { mat: M.water, animate: BOB }),
    P('Shell Lower', 'cylinder', { radius: 7, height: 8 }, [0, 5.4, 0], { mat: M.concrete }),
    P('Shell Waist', 'cylinder', { radius: 4.5, height: 8 }, [0, 13.4, 0], { mat: M.concrete }),
    P('Shell Throat', 'cylinder', { radius: 4, height: 5 }, [0, 19.4, 0], { mat: M.concrete }),
    P('Shell Rim', 'cylinder', { radius: 4.6, height: 1.5 }, [0, 22.4, 0], { mat: M.cladding }),
    P('Support A', 'box', { width: 0.5, height: 3, depth: 0.5 }, [-5, 2.4, 3], { rot: [0, 0, 0.3], mat: M.dark }),
    P('Support B', 'box', { width: 0.5, height: 3, depth: 0.5 }, [5, 2.4, 3], { rot: [0, 0, -0.3], mat: M.dark }),
    P('Support C', 'box', { width: 0.5, height: 3, depth: 0.5 }, [-5, 2.4, -3], { rot: [0, 0, 0.3], mat: M.dark }),
    P('Support D', 'box', { width: 0.5, height: 3, depth: 0.5 }, [5, 2.4, -3], { rot: [0, 0, -0.3], mat: M.dark }),
    P('Distribution Ring', 'torus', { radius: 5, tube: 0.2 }, [0, 4.4, 0], { rot: [Math.PI / 2, 0, 0], mat: M.water }),
    P('Vapour 1', 'sphere', { radius: 3 }, [0, 23, 0], { mat: M.vapour, animate: RISE }),
    P('Vapour 2', 'sphere', { radius: 2.4 }, [1.2, 23.5, 0.8], { mat: M.vapour, animate: RISE }),
    P('Vapour 3', 'sphere', { radius: 2 }, [-1.2, 24, -0.8], { mat: M.vapour, animate: RISE }),
    // rim inspection ring, shell access ladder, riser isolation valve
    P('Rim Walkway', 'torus', { radius: 4.95, tube: 0.14 }, [0, 23.15, 0], { rot: [Math.PI / 2, 0, 0], mat: M.steelDk }),
    ladder(7.05, 0, 1.6, 7),
    ...valveWheel({ pos: [-5.6, 4.75, 0] }),
    ...nameplate({ pos: [6.2, 2.4, 3.6], mat: undefined }),
  ],
  ports: [port('warm_in', 'utility', 'in', [-7, 2.9, 0]), port('cool_out', 'utility', 'out', [7, 1.6, 0])],
  params: [pr('approach', 'Approach', '°C', 5, 0, 15, '5m'), pr('rangeT', 'Range', '°C', 11, 0, 25, '5m'), pr('basinLevel', 'Basin Level', '%', 70, 0, 100, '15m')],
})

// ── 18. Water Source ──
const waterSource = spec({
  id: 'pp_water_source', label: 'Water Source', layer: 'structural', noNozzles: true,
  parts: [
    P('Reservoir', 'box', { width: 24, height: 1, depth: 10 }, [0, 0.5, 0], { mat: M.water }),
    P('Water Surface', 'box', { width: 23, height: 0.3, depth: 9 }, [0, 1.1, 0], { mat: M.water, animate: BOB }),
    P('Bank', 'box', { width: 25, height: 1.2, depth: 11 }, [0, 0.4, 0], { mat: M.concrete }),
    P('Intake Structure', 'box', { width: 3, height: 3, depth: 3 }, [-9, 2, 0], { mat: M.steelDk }),
    P('Intake Gate', 'box', { width: 0.2, height: 2.4, depth: 2 }, [-7.5, 1.6, 0], { mat: M.steel }),
    P('Pump House', 'roundedBox', { width: 4, height: 2.5, depth: 3, bevel: 0.08 }, [9, 2, 0], { mat: M.red }),
    P('Pump House Roof', 'box', { width: 4.4, height: 0.3, depth: 3.4 }, [9, 3.4, 0], { mat: M.dark }),
    P('Intake Screen', 'cylinder', { radius: 0.6, height: 2 }, [-9, 1.5, 2], { mat: M.steel, animate: SPIN }),
    P('Vent Stack', 'cylinder', { radius: 0.2, height: 1.5 }, [9, 4, 0], { mat: M.steel }),
    P('Outlet Flange', 'cylinder', { radius: 0.34, height: 0.5 }, [9, 2, 1.8], { rot: [Math.PI / 2, 0, 0], mat: NOZ_OUT }),
    // bank-edge safety rail + pump-house electrics
    ...handrail({ from: [-11.5, 1, 5.2], to: [11.5, 1, 5.2] }),
    ...junctionBox({ pos: [7.6, 1.6, 1.58] }),
  ],
  ports: [port('raw_out', 'utility', 'out', [9, 2, 1.6])],
  params: [pr('level', 'Reservoir Level', '%', 78, 0, 100, '1h'), pr('intakeFlow', 'Intake Flow', 'm³/h', 5200, 0, 9000, '1m'), pr('temp', 'Water Temp', '°C', 24, 0, 40, '15m')],
})

// ── 19. Water Treatment Plant ──
const waterTreatment = spec({
  id: 'pp_water_treatment', label: 'Water Treatment Plant', pad: [20, 8],
  parts: [
    P('Clarifier Tank', 'cylinder', { radius: 3, height: 3 }, [-3, 2, 0], { mat: M.cladding }),
    P('Clarifier Water', 'cylinder', { radius: 2.8, height: 0.3 }, [-3, 3.5, 0], { mat: M.water, animate: BOB }),
    P('Clarifier Bridge', 'box', { width: 6.2, height: 0.25, depth: 0.5 }, [-3, 3.9, 0], { mat: M.steel, animate: SPIN }),
    P('Rake Hub', 'cylinder', { radius: 0.3, height: 1 }, [-3, 3.8, 0], { mat: M.amber, animate: SPIN }),
    P('Filter Bed 1', 'roundedBox', { width: 2.5, height: 2, depth: 2.5, bevel: 0.07 }, [3, 1.9, -1.6], { mat: M.steelDk }),
    P('Filter Bed 2', 'roundedBox', { width: 2.5, height: 2, depth: 2.5, bevel: 0.07 }, [3, 1.9, 1.6], { mat: M.steelDk }),
    P('Filter Media', 'box', { width: 2.4, height: 0.3, depth: 2.4 }, [3, 2.8, -1.6], { mat: M.amber }),
    P('Chemical Dosing', 'vessel', { radius: 0.5, height: 2.5 }, [0, 2, 2.5], { mat: M.red }),
    P('Control Building', 'roundedBox', { width: 3, height: 3, depth: 4, bevel: 0.08 }, [7, 2, 0], { mat: M.red }),
    P('Building Roof', 'box', { width: 3.3, height: 0.3, depth: 4.3 }, [7, 3.6, 0], { mat: M.dark }),
    P('Pipe Manifold', 'cylinder', { radius: 0.3, height: 6 }, [3, 0.9, 0], { rot: [0, 0, Math.PI / 2], mat: M.water }),
    // manifold isolation valves + dosing dial
    ...valveWheel({ pos: [1.4, 1.45, 0] }),
    ...valveWheel({ pos: [4.6, 1.45, 0] }),
    ...dial({ pos: [7, 2.6, 2.04] }),
  ],
  ports: [port('raw_in', 'utility', 'in', [-6.2, 2, 0]), port('treated_out', 'utility', 'out', [8.6, 2, 0])],
  params: [pr('turbidity', 'Turbidity', 'NTU', 0.8, 0, 10, '15m'), pr('output', 'Output', 'm³/h', 480, 0, 900, '1m'), pr('ph', 'pH', '', 7.2, 0, 14, '15m')],
})

// ── 20. Ash Handling ──
const ashHandling = spec({
  id: 'pp_ash_handling', label: 'Ash Handling', pad: [10, 5],
  parts: [
    P('Hopper', 'cone', { radius: 1.8, height: 3 }, [0, 2.9, 0], { rot: [Math.PI, 0, 0], mat: M.steelDk }),
    P('Hopper Collar', 'cylinder', { radius: 1.85, height: 0.4 }, [0, 4.4, 0], { mat: M.dark }),
    P('Building', 'roundedBox', { width: 4, height: 3, depth: 3, bevel: 0.08 }, [3.5, 1.9, 0], { mat: M.red }),
    P('Building Roof', 'box', { width: 4.3, height: 0.3, depth: 3.3 }, [3.5, 3.5, 0], { mat: M.dark }),
    P('Slurry Pump Body', 'cylinder', { radius: 0.9, height: 1.4 }, [3.5, 1.4, 2.6], { rot: [Math.PI / 2, 0, 0], mat: M.amber }),
    P('Pump Impeller', 'cylinder', { radius: 0.7, height: 0.3 }, [3.5, 1.4, 1.7], { rot: [Math.PI / 2, 0, 0], mat: M.steel, animate: SPIN }),
    P('Pump Motor', 'cylinder', { radius: 0.5, height: 1 }, [3.5, 1.4, 3.6], { rot: [Math.PI / 2, 0, 0], mat: M.dark }),
    P('Conveyor', 'box', { width: 6, height: 0.4, depth: 1.2 }, [-2.5, 2, 0], { rot: [0.2, 0, 0], mat: M.grate }),
    P('Conveyor Head Drum', 'cylinder', { radius: 0.5, height: 1.4 }, [-5.5, 2.4, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel, animate: SPIN }),
    P('Conveyor Tail Drum', 'cylinder', { radius: 0.4, height: 1.4 }, [0.4, 1.6, 0], { rot: [0, 0, Math.PI / 2], mat: M.steel, animate: SPIN }),
  ],
  ports: [port('ash_in', 'conveyor', 'in', [0, 4.6, 0]), port('ash_out', 'conveyor', 'out', [-6, 2.4, 0])],
  params: [pr('ashFlow', 'Ash Flow', 't/h', 18, 0, 60, '1m'), pr('slurry', 'Slurry Conc', '%', 35, 0, 70, '5m'), pr('pumpLoad', 'Pump Load', '%', 58, 0, 100, '5s')],
})

// ── 21. Ash Storage (Silos) ──
const ashStorage = spec({
  id: 'pp_ash_storage', label: 'Ash Silos', layer: 'structural', pad: [10, 6],
  parts: [
    P('Silo 1 Body', 'cylinder', { radius: 2, height: 8 }, [-2.6, 5.4, 0], { mat: M.cladding }),
    P('Silo 1 Cone', 'cone', { radius: 2, height: 2.2 }, [-2.6, 1.3, 0], { rot: [Math.PI, 0, 0], mat: M.steelDk }),
    P('Silo 1 Roof', 'cone', { radius: 2.1, height: 0.8 }, [-2.6, 9.8, 0], { mat: M.dark }),
    P('Silo 2 Body', 'cylinder', { radius: 2, height: 8 }, [2.6, 5.4, 0], { mat: M.cladding }),
    P('Silo 2 Cone', 'cone', { radius: 2, height: 2.2 }, [2.6, 1.3, 0], { rot: [Math.PI, 0, 0], mat: M.steelDk }),
    P('Silo 2 Roof', 'cone', { radius: 2.1, height: 0.8 }, [2.6, 9.8, 0], { mat: M.dark }),
    P('Filling Head', 'box', { width: 7, height: 0.8, depth: 1.2 }, [0, 10, 0], { mat: M.amber }),
    P('Rotary Feeder 1', 'cylinder', { radius: 0.6, height: 0.8 }, [-2.6, 10.3, 0], { mat: M.steel, animate: SPIN }),
    P('Rotary Feeder 2', 'cylinder', { radius: 0.6, height: 0.8 }, [2.6, 10.3, 0], { mat: M.steel, animate: SPIN }),
    P('Bag Filter', 'cylinder', { radius: 0.5, height: 1.5 }, [0, 10.9, 0], { mat: M.steelDk }),
    P('Walkway', 'box', { width: 5.2, height: 0.15, depth: 1 }, [0, 9.2, 1.4], { mat: M.grate }),
    P('Support A', 'box', { width: 0.5, height: 2, depth: 0.5 }, [-2.6, 1.4, 1.6], { mat: M.dark }),
    P('Support B', 'box', { width: 0.5, height: 2, depth: 0.5 }, [2.6, 1.4, 1.6], { mat: M.dark }),
    ladder(-0.6, 1.4, 0.4, 9),
    // walkway safety rail + discharge valves under the cones
    ...handrail({ from: [-2.5, 9.28, 1.85], to: [2.5, 9.28, 1.85], h: 0.95 }),
    ...valveWheel({ pos: [-2.6, 0.35, 0], r: 0.18 }),
    ...valveWheel({ pos: [2.6, 0.35, 0], r: 0.18 }),
  ],
  ports: [port('ash_in', 'conveyor', 'in', [0, 10.4, 0])],
  params: [pr('silo1', 'Silo 1', '%', 64, 0, 100, '15m'), pr('silo2', 'Silo 2', '%', 41, 0, 100, '15m')],
})

// ── 22. Boiler House (open steel frame around the boiler) ──
const colTall = (x, z, h, mat = M.steel) => P('Steel Column', 'box', { width: 0.5, height: h, depth: 0.5 }, [x, h / 2, z], { mat })
const ringBeam = (y, w, d, mat = M.steelDk) => [
  P('Ring Beam', 'box', { width: w, height: 0.4, depth: 0.4 }, [0, y, d / 2], { mat }),
  P('Ring Beam', 'box', { width: w, height: 0.4, depth: 0.4 }, [0, y, -d / 2], { mat }),
  P('Ring Beam', 'box', { width: 0.4, height: 0.4, depth: d }, [w / 2, y, 0], { mat }),
  P('Ring Beam', 'box', { width: 0.4, height: 0.4, depth: d }, [-w / 2, y, 0], { mat }),
]
const boilerHouse = spec({
  id: 'pp_boiler_house', label: 'Boiler House', layer: 'structural', noNozzles: true,
  parts: [
    colTall(-9, -9, 28), colTall(9, -9, 28), colTall(-9, 9, 28), colTall(9, 9, 28),
    colTall(-9, 0, 28), colTall(9, 0, 28), colTall(0, -9, 28), colTall(0, 9, 28),
    ...ringBeam(9, 18, 18), ...ringBeam(18, 18, 18), ...ringBeam(27, 18, 18),
    P('Roof Slab', 'box', { width: 19, height: 0.5, depth: 19 }, [0, 27.6, 0], { mat: M.cladding }),
    P('Back Cladding', 'box', { width: 0.4, height: 26, depth: 18 }, [-9, 14, 0], { mat: M.cladding }),
    P('Side Cladding N', 'box', { width: 18, height: 12, depth: 0.4 }, [0, 21, -9], { mat: M.cladding }),
    P('Side Cladding S', 'box', { width: 18, height: 12, depth: 0.4 }, [0, 21, 9], { mat: M.cladding }),
    P('Stair Tower', 'box', { width: 2, height: 27, depth: 2 }, [9.5, 13.5, 9.5], { mat: M.steelDk }),
    P('Roof Vent Housing', 'box', { width: 3, height: 1.2, depth: 3 }, [4, 28.6, 4], { mat: M.steelDk }),
    P('Roof Vent Fan', 'cylinder', { radius: 1.2, height: 0.3 }, [4, 29.4, 4], { mat: M.dark, animate: SPIN }),
    P('Vent Fan Blade', 'box', { width: 2.2, height: 0.1, depth: 0.3 }, [4, 29.5, 4], { mat: M.steel, animate: SPIN }),
  ],
})

// ── 23. Turbine Hall (enclosing hall with gantry crane) ──
const turbineHall = spec({
  id: 'pp_turbine_hall', label: 'Turbine Hall', layer: 'structural', noNozzles: true,
  parts: [
    P('Back Wall', 'box', { width: 44, height: 12, depth: 0.5 }, [0, 6, -8], { mat: M.cladding }),
    P('Window Strip', 'box', { width: 40, height: 2, depth: 0.3 }, [0, 8, -7.7], { mat: M.window }),
    P('End Wall L', 'box', { width: 0.5, height: 12, depth: 16 }, [-22, 6, 0], { mat: M.cladding }),
    P('End Wall R', 'box', { width: 0.5, height: 12, depth: 16 }, [22, 6, 0], { mat: M.cladding }),
    P('Roof North', 'box', { width: 44, height: 0.4, depth: 9 }, [0, 13.5, -4], { rot: [-0.35, 0, 0], mat: M.steelDk }),
    P('Roof South', 'box', { width: 44, height: 0.4, depth: 9 }, [0, 13.5, 4], { rot: [0.35, 0, 0], mat: M.steelDk }),
    P('Ridge Beam', 'box', { width: 44, height: 0.4, depth: 0.4 }, [0, 15, 0], { mat: M.steel }),
    P('Front Column L', 'box', { width: 0.5, height: 12, depth: 0.5 }, [-22, 6, 8], { mat: M.steel }),
    P('Front Column M', 'box', { width: 0.5, height: 12, depth: 0.5 }, [0, 6, 8], { mat: M.steel }),
    P('Front Column R', 'box', { width: 0.5, height: 12, depth: 0.5 }, [22, 6, 8], { mat: M.steel }),
    P('Crane Rail N', 'box', { width: 44, height: 0.3, depth: 0.3 }, [0, 10.5, -6], { mat: M.paintY }),
    P('Crane Rail S', 'box', { width: 44, height: 0.3, depth: 0.3 }, [0, 10.5, 6], { mat: M.paintY }),
    P('Gantry Bridge', 'box', { width: 1.2, height: 0.6, depth: 14 }, [4, 10.8, 0], { mat: M.paintY }),
    P('Crane Hoist', 'box', { width: 1.4, height: 1, depth: 1.4 }, [4, 10, 0], { mat: M.dark }),
    P('Crane Hook', 'box', { width: 0.3, height: 2, depth: 0.3 }, [4, 8, 0], { mat: M.steel, animate: BOB }),
  ],
})

// ── 24. Control Room ──
const controlRoom = spec({
  id: 'pp_control_room', label: 'Control Room', layer: 'structural', noNozzles: true,
  parts: [
    P('Ground Floor', 'box', { width: 8, height: 3.2, depth: 6 }, [0, 1.6, 0], { mat: M.cladding }),
    P('Upper Floor', 'box', { width: 8, height: 3.2, depth: 6 }, [0, 4.9, 0], { mat: M.red }),
    P('Roof', 'box', { width: 8.4, height: 0.4, depth: 6.4 }, [0, 6.7, 0], { mat: M.dark }),
    P('Window Row 1', 'box', { width: 6.5, height: 1.2, depth: 0.2 }, [0, 2, 3.05], { mat: M.window }),
    P('Window Row 2', 'box', { width: 6.5, height: 1.2, depth: 0.2 }, [0, 5.2, 3.05], { mat: M.window }),
    P('Door', 'box', { width: 1.2, height: 2.2, depth: 0.2 }, [-2.5, 1.1, 3.05], { mat: M.steelDk }),
    P('Cable Tray', 'box', { width: 1.5, height: 0.2, depth: 2 }, [3.5, 3.3, 4], { mat: M.dark }),
    P('AC Unit', 'cylinder', { radius: 0.5, height: 0.4 }, [2.5, 7, -1.5], { mat: M.dark, animate: SPIN }),
  ],
})

// ── 25. Pipe Rack (elevated pipe support; placed multiple times) ──
const pipeRack = spec({
  id: 'pp_pipe_rack', label: 'Pipe Rack', layer: 'structural', noNozzles: true,
  parts: [
    ...[-9, -3, 3, 9].flatMap(x => [
      P('Rack Column', 'box', { width: 0.3, height: 5, depth: 0.3 }, [x, 2.5, -1.4], { mat: M.steelDk }),
      P('Rack Column', 'box', { width: 0.3, height: 5, depth: 0.3 }, [x, 2.5, 1.4], { mat: M.steelDk }),
      P('Rack Crossbeam', 'box', { width: 0.3, height: 0.3, depth: 3.4 }, [x, 5, 0], { mat: M.steel }),
    ]),
    P('Stringer A', 'box', { width: 20, height: 0.25, depth: 0.25 }, [0, 5, -1], { mat: M.steel }),
    P('Stringer B', 'box', { width: 20, height: 0.25, depth: 0.25 }, [0, 5, 1], { mat: M.steel }),
    P('Pipe 1', 'cylinder', { radius: 0.35, height: 20 }, [0, 5.5, -0.7], { rot: [0, 0, Math.PI / 2], mat: { color: '#cdd6e2', metalness: 0.6, roughness: 0.35 } }),
    P('Pipe 2', 'cylinder', { radius: 0.3, height: 20 }, [0, 5.5, 0.7], { rot: [0, 0, Math.PI / 2], mat: M.water }),
  ],
})

// ── 26. Boundary Wall (perimeter enclosure) ──
const boundaryWall = spec({
  id: 'pp_boundary_wall', label: 'Boundary Wall', layer: 'structural', noNozzles: true,
  parts: [
    P('Wall North', 'box', { width: 176, height: 3.5, depth: 0.5 }, [0, 1.75, -60], { mat: M.concrete }),
    P('Wall South L', 'box', { width: 78, height: 3.5, depth: 0.5 }, [-49, 1.75, 60], { mat: M.concrete }),
    P('Wall South R', 'box', { width: 78, height: 3.5, depth: 0.5 }, [49, 1.75, 60], { mat: M.concrete }),
    P('Wall West', 'box', { width: 0.5, height: 3.5, depth: 120 }, [-88, 1.75, 0], { mat: M.concrete }),
    P('Wall East', 'box', { width: 0.5, height: 3.5, depth: 120 }, [88, 1.75, 0], { mat: M.concrete }),
    P('Gate Post L', 'box', { width: 1, height: 4.5, depth: 1 }, [-10, 2.25, 60], { mat: M.steelDk }),
    P('Gate Post R', 'box', { width: 1, height: 4.5, depth: 1 }, [10, 2.25, 60], { mat: M.steelDk }),
    P('Corner NW', 'box', { width: 1, height: 4, depth: 1 }, [-88, 2, -60], { mat: M.steelDk }),
    P('Corner NE', 'box', { width: 1, height: 4, depth: 1 }, [88, 2, -60], { mat: M.steelDk }),
    P('Corner SW', 'box', { width: 1, height: 4, depth: 1 }, [-88, 2, 60], { mat: M.steelDk }),
    P('Corner SE', 'box', { width: 1, height: 4, depth: 1 }, [88, 2, 60], { mat: M.steelDk }),
  ],
})

// ── 27. Grade & Roads (concrete apron + painted aisle lanes) ──
// Road — a standalone, reusable straight road segment (asphalt + centre line +
// edge lines + kerbs), built along local X (100 m). Place it multiple times with
// rotation/scale for separate roads. A thin strip, so it doesn't blanket the plant.
const road = spec({
  id: 'pp_road', label: 'Road', layer: 'structural', noNozzles: true,
  parts: [
    P('Asphalt', 'box', { width: 100, height: 0.1, depth: 7 }, [0, 0.1, 0], { mat: M.dark }),
    P('Centre Line', 'box', { width: 94, height: 0.04, depth: 0.22 }, [0, 0.16, 0], { mat: M.paintY }),
    P('Edge Line L', 'box', { width: 96, height: 0.04, depth: 0.16 }, [0, 0.16, -3.1], { mat: { ...M.cladding, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }),
    P('Edge Line R', 'box', { width: 96, height: 0.04, depth: 0.16 }, [0, 0.16, 3.1], { mat: { ...M.cladding, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }),
    P('Kerb L', 'box', { width: 100, height: 0.22, depth: 0.3 }, [0, 0.11, -3.55], { mat: M.concrete }),
    P('Kerb R', 'box', { width: 100, height: 0.22, depth: 0.3 }, [0, 0.11, 3.55], { mat: M.concrete }),
  ],
})

// ── 28. Precipitator House (frame around ESP) ──
const precipHouse = spec({
  id: 'pp_precip_house', label: 'Precipitator House', layer: 'structural', noNozzles: true,
  parts: [
    colTall(-5.5, -4, 12), colTall(5.5, -4, 12), colTall(-5.5, 4, 12), colTall(5.5, 4, 12),
    ...ringBeam(11.5, 11, 8),
    P('Roof', 'box', { width: 12, height: 0.4, depth: 9 }, [0, 11.8, 0], { mat: M.cladding }),
    P('Side Cladding', 'box', { width: 11, height: 8, depth: 0.3 }, [0, 7, -4], { mat: M.cladding }),
  ],
})

// ── 29. Switchyard Fence (around transformer + grid) ──
const switchyard = spec({
  id: 'pp_switchyard', label: 'Switchyard Fence', layer: 'structural', noNozzles: true,
  parts: [
    P('Fence N', 'box', { width: 36, height: 2.4, depth: 0.15 }, [0, 1.2, -10], { mat: M.grate }),
    P('Fence S', 'box', { width: 36, height: 2.4, depth: 0.15 }, [0, 1.2, 10], { mat: M.grate }),
    P('Fence W', 'box', { width: 0.15, height: 2.4, depth: 20 }, [-18, 1.2, 0], { mat: M.grate }),
    P('Fence E', 'box', { width: 0.15, height: 2.4, depth: 20 }, [18, 1.2, 0], { mat: M.grate }),
    ...[-18, -6, 6, 18].flatMap(x => [-10, 10].map(z => P('Fence Post', 'box', { width: 0.25, height: 2.7, depth: 0.25 }, [x, 1.35, z], { mat: M.steelDk }))),
    P('Gantry Beam', 'box', { width: 36, height: 0.3, depth: 0.3 }, [0, 6, -3], { mat: M.steel }),
    P('Gantry Post L', 'box', { width: 0.3, height: 6, depth: 0.3 }, [-16, 3, -3], { mat: M.steel }),
    P('Gantry Post R', 'box', { width: 0.3, height: 6, depth: 0.3 }, [16, 3, -3], { mat: M.steel }),
  ],
})

// Superheater + Economiser are now folded INTO the boiler; boiler-house scaffold removed.
const SPECS = [coalHandling, boiler, airPreheater, esp, idFan, fdFan,
  chimney, feedWaterHeater, deaerator, steamTurbine, condenser, generator, transformer, grid,
  coolingTower, waterSource, waterTreatment, ashHandling, ashStorage,
  turbineHall, controlRoom, pipeRack, boundaryWall, road, precipHouse, switchyard]

const GROUPS = {
  g_fuel:   { id: 'g_fuel',   name: 'Fuel & Ash',       parentId: null, order: 0 },
  g_boiler: { id: 'g_boiler', name: 'Boiler Island',    parentId: null, order: 1 },
  g_flue:   { id: 'g_flue',   name: 'Flue Gas & Stack', parentId: null, order: 2 },
  g_steam:  { id: 'g_steam',  name: 'Steam Cycle',      parentId: null, order: 3 },
  g_elec:   { id: 'g_elec',   name: 'Electrical',       parentId: null, order: 4 },
  g_water:  { id: 'g_water',  name: 'Water System',     parentId: null, order: 5 },
  g_civil:  { id: 'g_civil',  name: 'Buildings & Civil', parentId: null, order: 6 },
}

// ── placements (a clean 3-lane grid; repeats allowed, e.g. pipe racks) ──
// [type, id, name, pos, group, layer, rot?]
const PLACEMENTS = [
  // mid spine (z≈0): fuel → steam → power
  ['pp_coal_handling', 'obj_coal', 'Coal Handling Plant', [-82, 0, 2], 'g_fuel', 'equipment'],
  ['pp_boiler', 'obj_boiler', 'Boiler', [-56, 0, 0], 'g_boiler', 'equipment'],
  ['pp_steam_turbine', 'obj_turbine', 'Steam Turbine', [4, 0, 0], 'g_steam', 'equipment'],
  ['pp_generator', 'obj_gen', 'Generator', [26, 0, 0], 'g_elec', 'equipment'],
  ['pp_transformer', 'obj_xfmr', 'Generator Transformer', [50, 0, 0], 'g_elec', 'equipment'],
  ['pp_grid', 'obj_grid', 'Transmission Tower', [68, 0, 0], 'g_elec', 'structural'],
  // top lane (z≈-30): boiler-island heat exchangers + flue path
  ['pp_air_preheater', 'obj_aph', 'Air Pre-heater', [-6, 0, -30], 'g_boiler', 'equipment'],
  ['pp_fd_fan', 'obj_fdfan', 'FD Fan', [-6, 0, -46], 'g_boiler', 'equipment'],
  ['pp_esp', 'obj_esp', 'ESP', [16, 0, -30], 'g_flue', 'equipment'],
  ['pp_id_fan', 'obj_idfan', 'ID Fan', [38, 0, -30], 'g_flue', 'equipment'],
  ['pp_chimney', 'obj_chimney', 'Chimney', [58, 0, -30], 'g_flue', 'structural'],
  // bottom lane (z≈+28): water cycle, cooling & ash
  ['pp_ash_handling', 'obj_ash', 'Ash Handling', [-72, 0, 20], 'g_fuel', 'equipment'],
  ['pp_ash_storage', 'obj_silos', 'Ash Silos', [-72, 0, 42], 'g_fuel', 'structural'],
  ['pp_water_treatment', 'obj_wtp', 'Water Treatment Plant', [-46, 0, 30], 'g_water', 'equipment'],
  ['pp_water_source', 'obj_water', 'Water Source', [-46, 0, 52], 'g_water', 'structural'],
  ['pp_feed_water_heater', 'obj_fwh', 'Feed Water Heater', [-22, 0, 26], 'g_steam', 'equipment'],
  ['pp_deaerator', 'obj_dea', 'Deaerator', [-4, 0, 28], 'g_steam', 'structural'],
  ['pp_condenser', 'obj_cond', 'Condenser', [6, 0, 14], 'g_steam', 'equipment'],
  ['pp_cooling_tower', 'obj_ct', 'Cooling Tower', [34, 0, 34], 'g_water', 'structural'],
  // buildings & civil
  ['pp_road', 'obj_road1', 'Service Road — Front', [0, 0, 14], 'g_civil', 'structural', [0, 0, 0], [1.6, 1, 1]],
  ['pp_road', 'obj_road2', 'Service Road — Cross', [14, 0, 0], 'g_civil', 'structural', [0, Math.PI / 2, 0], [1.0, 1, 1]],
  ['pp_boundary_wall', 'obj_wall', 'Boundary Wall', [-6, 0, 0], 'g_civil', 'structural'],
  ['pp_turbine_hall', 'obj_thall', 'Turbine Hall', [15, 0, 0], 'g_civil', 'structural'],
  ['pp_control_room', 'obj_ctrl', 'Control Room', [15, 0, 16], 'g_civil', 'structural'],
  ['pp_precip_house', 'obj_phouse', 'Precipitator House', [16, 0, -30], 'g_civil', 'structural'],
  ['pp_switchyard', 'obj_syard', 'Switchyard', [59, 0, 0], 'g_civil', 'structural'],
  ['pp_pipe_rack', 'obj_rack1', 'Pipe Rack — Steam', [-26, 0, -2], 'g_civil', 'structural'],
  ['pp_pipe_rack', 'obj_rack2', 'Pipe Rack — Water', [-13, 0, 27], 'g_civil', 'structural'],
  ['pp_pipe_rack', 'obj_rack3', 'Pipe Rack — Flue', [-15, 0, -30], 'g_civil', 'structural'],
]

// connector configs — conveyors/bus bars keep explicit configs; PIPE colours are
// derived from the port names by fluid medium (see pipeConfigFor / pipeMedia.js).
const COAL = { itemType: 'coal', speed: 0.9, itemSpacing: 0.8, beltStyle: 'chain' }
const ASHC = { itemType: 'ash', speed: 0.7, itemSpacing: 0.8, beltStyle: 'chain' }
const BUS  = { bars: 3, width: 0.32, color: '#b87333' }

// [src, sourcePort, tgt, targetPort, connectorType, connectorConfig?]
// Pipe rows omit the config — it's derived per fluid medium from the ports.
const LINKS = [
  ['obj_coal', 'coal_out', 'obj_boiler', 'coal_in', 'conveyor', COAL],
  ['obj_boiler', 'ash_out', 'obj_ash', 'ash_in', 'conveyor', ASHC],
  ['obj_ash', 'ash_out', 'obj_silos', 'ash_in', 'conveyor', ASHC],
  // superheater + economiser are internal to the boiler now: steam & flue go direct
  ['obj_boiler', 'steam_out', 'obj_turbine', 'steam_in', 'pipe'],
  ['obj_turbine', 'steam_out', 'obj_cond', 'steam_in', 'pipe'],
  ['obj_boiler', 'flue_out', 'obj_aph', 'flue_in', 'pipe'],
  ['obj_aph', 'flue_out', 'obj_esp', 'flue_in', 'pipe'],
  ['obj_esp', 'flue_out', 'obj_idfan', 'in', 'pipe'],
  ['obj_idfan', 'out', 'obj_chimney', 'flue_in', 'pipe'],
  ['obj_fdfan', 'out', 'obj_aph', 'air_in', 'pipe'],
  ['obj_aph', 'air_out', 'obj_boiler', 'air_in', 'pipe'],
  ['obj_fwh', 'water_out', 'obj_boiler', 'water_in', 'pipe'],
  ['obj_dea', 'water_out', 'obj_fwh', 'cond_in', 'pipe'],
  ['obj_cond', 'cond_out', 'obj_dea', 'cond_in', 'pipe'],
  ['obj_wtp', 'treated_out', 'obj_dea', 'tw_in', 'pipe'],
  ['obj_cond', 'warm_out', 'obj_ct', 'warm_in', 'pipe'],
  ['obj_ct', 'cool_out', 'obj_cond', 'cw_in', 'pipe'],
  ['obj_water', 'raw_out', 'obj_wtp', 'raw_in', 'pipe'],
  ['obj_turbine', 'shaft_out', 'obj_gen', 'shaft_in', 'busbar', BUS],
  ['obj_gen', 'power_out', 'obj_xfmr', 'power_in', 'busbar', BUS],
  ['obj_xfmr', 'power_out', 'obj_grid', 'power_in', 'busbar', BUS],
]

// The MAIN plant machines — only these get a tooltip auto-enabled (auxiliaries /
// heat-exchangers / structural items don't, to avoid clutter). Users can still
// turn a tooltip on for any component manually in build mode.
export const MAIN_MACHINES = new Set([
  'pp_boiler', 'pp_steam_turbine', 'pp_generator', 'pp_condenser', 'pp_cooling_tower', 'pp_transformer',
])

// Default hover-tooltip parameter selection per machine type (~3 headline params
// each). Used to pre-enable tooltips on new plants and to backfill existing ones.
export const TOOLTIP_DEFAULTS = {
  pp_coal_handling:    ['feedRate', 'stock', 'crusherLoad'],
  pp_boiler:           ['drumPressure', 'steamFlow', 'furnaceTemp'],
  pp_air_preheater:    ['gasOutTemp', 'leakage', 'rpm'],
  pp_esp:              ['efficiency', 'dustOut', 'fieldKV'],
  pp_id_fan:           ['flow', 'draft', 'rpm'],
  pp_fd_fan:           ['flow', 'dischargePressure', 'rpm'],
  pp_chimney:          ['gasTemp', 'opacity', 'so2'],
  pp_feed_water_heater:['outletTemp', 'level', 'ttd'],
  pp_deaerator:        ['o2', 'tankLevel', 'pressure'],
  pp_steam_turbine:    ['power', 'speed', 'vibration'],
  pp_condenser:        ['vacuum', 'hotwellLevel', 'ctw'],
  pp_generator:        ['power', 'voltage', 'freq'],
  pp_transformer:      ['loadMVA', 'oilTemp', 'windingTemp'],
  pp_grid:             ['exportMW', 'lineVoltage', 'lineCurrent'],
  pp_cooling_tower:    ['basinLevel', 'approach', 'rangeT'],
  pp_water_source:     ['level', 'intakeFlow', 'temp'],
  pp_water_treatment:  ['turbidity', 'output', 'ph'],
  pp_ash_handling:     ['ashFlow', 'slurry', 'pumpLoad'],
  pp_ash_storage:      ['silo1', 'silo2'],
}

// Hero units swapped for imported glTF models (opts.models). ONLY units with a
// real file shipped in public/models/ are listed — everything else stays the
// detailed procedural component (never a placeholder cube). Both models are CC0
// from Poly Haven; add more entries as you drop more files in (see the README).
const HERO_MODELS = {
  // (empty: the two CC0 files previously listed here are excluded from this
  // repo snapshot to keep it small — referencing them 404'd on every home-
  // screen thumbnail render. Re-add entries as files land in public/models/.)
}

// opts.models = true → swap the HERO_MODELS units to imported-glTF `Model` assets
// (they render /models/<slug>.glb, falling back to a placeholder until you add the
// file). Everything else stays procedural. Default (no opts) = the full procedural plant.
export const THERMAL_POWER_PLANT = (opts = {}) => {
  const useModels = opts.models === true
  const customAssetTypes = {}
  for (const s of SPECS) customAssetTypes[s.id] = s

  const objects = {}
  const orderByGroup = {}
  for (const [type, id, name, pos, group, layer, rot, scl] of PLACEMENTS) {
    if (!customAssetTypes[type]) continue
    const order = (orderByGroup[group] = (orderByGroup[group] ?? -1) + 1)
    const hero = useModels ? HERO_MODELS[type] : null
    const common = {
      id, name, position: pos, rotation: rot || [0, 0, 0], scale: scl || [1, 1, 1],
      layer, status: 'running', state: 'running', locked: false, visible: true,
      parentId: group, order, dataBindings: [], connections: [], parameters: {}, rules: [],
    }
    objects[id] = hero
      ? { ...common, type: 'Model', config: { enabled: true, speed: 1, url: hero.url, fit: hero.fit, yaw: hero.yaw ?? 0, scale: 1 } }
      : { ...common, type, config: { enabled: true, speed: 1 } }
  }

  for (const [src, sPort, tgt, tPort, ct, cfg] of LINKS) {
    if (!objects[src] || !objects[tgt]) continue
    // A swapped-in Model has no ports — skip links that would dangle off it.
    if (objects[src].type === 'Model' || objects[tgt].type === 'Model') continue
    const config = ct === 'pipe' ? pipeConfigFor(sPort, tPort) : { ...cfg }
    objects[src].connections.push({
      id: `c_${src}_${tgt}`, targetId: tgt,
      sourcePort: sPort, targetPort: tPort, connectorType: ct, connectorConfig: config,
    })
  }

  // Pre-enable hover tooltips on the MAIN machines only (groups have none).
  for (const id in objects) {
    const type = objects[id].type
    if (MAIN_MACHINES.has(type) && TOOLTIP_DEFAULTS[type]) objects[id].tooltip = { enabled: true, params: [...TOOLTIP_DEFAULTS[type]] }
  }

  return { objects, groups: { ...GROUPS }, customAssetTypes }
}
