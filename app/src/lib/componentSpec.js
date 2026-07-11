import { nanoid } from 'nanoid'

// ── Component Spec ───────────────────────────────────────────────────────────
// A user-authored custom asset type. Procedural only: parts (primitives) +
// materials + animation + ports + config/parameters/states schemas. Stored in
// sceneStore.customAssetTypes, serialized in the Twin Spec, rendered by
// CompositeAsset, and resolved by the schema/port registries.
//
//   { id, label, category, layer, schemaVersion,
//     parts:[{ id, geometry, dims, position, rotation, scale, material, animate? }],
//     ports:[{ id, type, direction, offset }],
//     config:[fieldDef], parameters:[fieldDef], states:[{key,label,color,severity}]|null,
//     beacon:{offset}|null, defaultConfig }

// Allowed geometries + their dimension fields (drives the Studio form + renderer).
export const GEOMETRY_DEFS = {
  box:        { label: 'Box',      dims: [['width', 1], ['height', 1], ['depth', 1]] },
  // Bevelled box — manufactured edges that catch highlights. PREFER over `box`
  // for machine bodies/casings; keep plain box for thin panels/trim.
  roundedBox: { label: 'Rounded Box', dims: [['width', 1], ['height', 1], ['depth', 1], ['bevel', 0.06]] },
  cylinder:   { label: 'Cylinder', dims: [['radius', 0.6], ['height', 1.5]] },
  // Cylinder with hemispherical ends — horizontal drums, receivers, headers.
  capsule:    { label: 'Capsule',  dims: [['radius', 0.6], ['height', 2]] },
  // Lathe-profile pressure vessel with dished heads — tanks, drums, columns.
  vessel:     { label: 'Vessel',   dims: [['radius', 0.8], ['height', 2.4]] },
  sphere:     { label: 'Sphere',   dims: [['radius', 0.7]] },
  cone:       { label: 'Cone',     dims: [['radius', 0.7], ['height', 1.4]] },
  torus:      { label: 'Torus',    dims: [['radius', 0.7], ['tube', 0.18]] },
  // Extruded structural I-section (length along Z) — frames, columns, rails.
  ibeam:      { label: 'I-Beam',   dims: [['width', 0.3], ['height', 0.4], ['depth', 2]] },
}
export const GEOMETRIES = Object.keys(GEOMETRY_DEFS)
// sweep = oscillating rotation about one axis (articulated booms, masts);
// slide = oscillating translation along one axis (drill carriages, rams).
// Both take { axis, from, to, period (s), phase (0..1) } alongside speedKey.
export const ANIMATIONS = ['none', 'spinY', 'spinX', 'pulse', 'bob', 'rise', 'sweep', 'slide', 'fill']
export const PORT_TYPES = ['product', 'conveyor', 'utility', 'co2', 'power']
export const PORT_DIRECTIONS = ['in', 'out', 'bidirectional']

const triple = (v, d) => (Array.isArray(v) && v.length === 3 ? v.map(Number) : [d, d, d])

export function defaultDims(geometry) {
  const out = {}
  for (const [k, v] of (GEOMETRY_DEFS[geometry] || GEOMETRY_DEFS.box).dims) out[k] = v
  return out
}

export function blankPart(geometry = 'box', parentId = null) {
  return {
    id: `part_${nanoid(5)}`, label: '', parentId, geometry, dims: defaultDims(geometry),
    position: [0, geometry === 'box' ? 0.5 : 0.75, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    material: { color: '#b0c4d0', metalness: 0.6, roughness: 0.35 },
    animate: null, parameters: [],
  }
}

// A part that references an existing component (built-in machine or custom type),
// rendered in place — lets users build on top of / around existing assets.
export function blankComponentPart(ref, parentId = null) {
  return { id: `part_${nanoid(5)}`, label: '', parentId, kind: 'component', ref, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parameters: [] }
}

// A GROUP part: a folder/transform node with no geometry. Its transform applies
// to its children (parts whose parentId === this id).
export function blankGroupPart(parentId = null) {
  return { id: `part_${nanoid(5)}`, label: 'Group', parentId, kind: 'group', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parameters: [] }
}

// A LOGICAL ("general") part: a non-visual, data-only node — no geometry, no
// transform. Useful purely to organise the hierarchy / hang parameters off.
export function blankLogicalPart(parentId = null) {
  return { id: `part_${nanoid(5)}`, label: 'General Part', parentId, kind: 'logical', parameters: [] }
}

export function blankSpec() {
  return {
    label: 'New Component', category: 'Custom', layer: 'equipment', schemaVersion: 1,
    parts: [blankPart('box')],
    ports: [],
    config: [{ key: 'enabled', label: 'Enabled', type: 'boolean', default: true }],
    parameters: [],
    subComponents: [],
    states: null,
    beacon: { offset: [0, 2.4, 0] },
    defaultConfig: {},
  }
}

// Back-fill a full spec from a legacy single-primitive custom type. Used by the
// Studio to load older custom assets into editable parts. (Rendering of legacy
// types stays delegated to Primitive by CompositeAsset, so this is lossless-enough
// for editing rather than pixel-exact.)
export function normalizeSpec(type) {
  if (!type) return blankSpec()
  if (Array.isArray(type.parts) && type.parts.length) {
    return { ...blankSpec(), ...type, parts: type.parts, schemaVersion: type.schemaVersion || 1 }
  }
  const prim = type.primitive || 'box'
  const geometry = prim === 'tank' ? 'cylinder' : prim          // tank ≈ cylinder for editing
  const part = blankPart(geometry)
  const cfg = type.defaultConfig || {}
  if (geometry === 'cylinder') { part.dims = { radius: cfg.radius ?? 0.8, height: cfg.height ?? 1.6 } }
  else { part.dims = { width: cfg.width ?? 1.5, height: cfg.height ?? 1.5, depth: cfg.depth ?? 1.5 } }
  if (cfg.color) part.material.color = cfg.color
  part.position = [0, (part.dims.height ?? 1.5) / 2, 0]
  return { ...blankSpec(), label: type.label || 'Custom', layer: type.layer || 'equipment', category: type.category || 'Custom', parts: [part], beacon: null }
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

// Optional articulation fields carried on sweep/slide animations (and harmless
// elsewhere): axis + from/to range + period/phase timing.
function animExtras(raw = {}) {
  return {
    ...(['x', 'y', 'z'].includes(raw.axis) ? { axis: raw.axis } : {}),
    ...(Number.isFinite(Number(raw.from)) ? { from: Number(raw.from) } : {}),
    ...(Number.isFinite(Number(raw.to)) ? { to: Number(raw.to) } : {}),
    ...(Number.isFinite(Number(raw.period)) ? { period: Number(raw.period) } : {}),
    ...(Number.isFinite(Number(raw.phase)) ? { phase: Number(raw.phase) } : {}),
  }
}
// A colour is a hex literal OR a "@token" palette reference (lib/paletteTokens).
const isColor = (c) => typeof c === 'string' && (HEX.test(c) || (c[0] === '@' && c.length > 1))
const clampNum = (v, d, lo = -1e4, hi = 1e4) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

// Per-part parameter defs (authoring only — telemetry binding is future work).
function cleanPartParams(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter(p => p && p.key).map(p => ({
    key: String(p.key), label: String(p.label || p.key), unit: String(p.unit || ''),
    default: Number.isFinite(Number(p.default)) ? Number(p.default) : 0,
    ...(Number.isFinite(Number(p.min)) ? { min: Number(p.min) } : {}),
    ...(Number.isFinite(Number(p.max)) ? { max: Number(p.max) } : {}),
    ...(p.freq ? { freq: String(p.freq) } : {}),
    ...(p.topic ? { topic: String(p.topic) } : {}),
  }))
}

// Per-part visual rules (authoring; threshold-on-own-parameter → glow colour).
function cleanPartRules(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter(r => r && r.parameter).map(r => ({
    id: r.id || `rule_${nanoid(4)}`, enabled: r.enabled !== false,
    parameter: String(r.parameter), operator: ['>', '>=', '<', '<=', '==', '!='].includes(r.operator) ? r.operator : '>',
    value: Number.isFinite(Number(r.value)) ? Number(r.value) : 0,
    color: HEX.test(r.color) ? r.color : '#ff3b30',
  }))
}

function cleanPart(raw) {
  const base = {
    id: raw?.id || `part_${nanoid(5)}`,
    label: typeof raw?.label === 'string' ? raw.label.slice(0, 60) : '',
    parentId: raw?.parentId || null,
    parameters: cleanPartParams(raw?.parameters),
    rules: cleanPartRules(raw?.rules),
  }
  // LOGICAL ("general") part: data-only, no geometry / no transform.
  if (raw?.kind === 'logical') return { ...base, kind: 'logical' }
  // EMITTER part: a particle effect (dust/smoke/steam/spray — effects/ParticleEmitter).
  if (raw?.kind === 'emitter') {
    return {
      ...base, kind: 'emitter',
      position: triple(raw.position, 0),
      emitter: (raw.emitter && typeof raw.emitter === 'object') ? raw.emitter : { preset: 'dust' },
    }
  }
  // GROUP part: transform-only container (applies to children), no geometry.
  // May animate (spinY etc.) — children orbit/move with it (e.g. a carousel).
  if (raw?.kind === 'group') {
    const gAnim = ANIMATIONS.includes(raw?.animate?.kind) && raw.animate.kind !== 'none' ? raw.animate.kind : null
    return {
      ...base, kind: 'group',
      position: triple(raw.position, 0), rotation: triple(raw.rotation, 0),
      scale: triple(raw.scale, 1).map(n => clampNum(n, 1, 0.01, 100)),
      ...(gAnim ? { animate: { kind: gAnim, speedKey: raw.animate.speedKey || undefined, ...(Number.isFinite(raw.animate.rate) ? { rate: raw.animate.rate } : {}), ...animExtras(raw.animate) } } : {}),
    }
  }
  // Component-reference part: render another asset type in place (transform only).
  if (raw?.kind === 'component') {
    return {
      ...base, kind: 'component', ref: String(raw.ref || ''),
      position: triple(raw.position, 0), rotation: triple(raw.rotation, 0),
      scale: triple(raw.scale, 1).map(n => clampNum(n, 1, 0.01, 100)),
    }
  }
  // MODEL part: an imported glTF/GLB sub-mesh (Blender / text-to-3D authored) placed
  // in-line — photoreal detail inside an otherwise procedural, animated component.
  if (raw?.kind === 'model') {
    const mAnim = ANIMATIONS.includes(raw?.animate?.kind) && raw.animate.kind !== 'none' ? raw.animate.kind : null
    return {
      ...base, kind: 'model',
      url: String(raw.url || '').slice(0, 300),
      fit: clampNum(raw.fit, 2, 0.05, 200),
      position: triple(raw.position, 0), rotation: triple(raw.rotation, 0),
      scale: triple(raw.scale, 1).map(n => clampNum(n, 1, 0.01, 100)),
      ...(mAnim ? { animate: { kind: mAnim, speedKey: raw.animate.speedKey || undefined, ...(Number.isFinite(raw.animate.rate) ? { rate: raw.animate.rate } : {}) } } : {}),
    }
  }
  const geometry = GEOMETRIES.includes(raw?.geometry) ? raw.geometry : 'box'
  const dd = defaultDims(geometry); const dims = {}
  for (const k in dd) dims[k] = clampNum(raw?.dims?.[k], dd[k], 0.01, 200)
  const m = raw?.material || {}
  const animKind = ANIMATIONS.includes(raw?.animate?.kind) && raw.animate.kind !== 'none' ? raw.animate.kind : null
  return {
    ...base, geometry, dims,
    position: triple(raw?.position, 0), rotation: triple(raw?.rotation, 0), scale: triple(raw?.scale, 1).map(n => clampNum(n, 1, 0.01, 100)),
    material: {
      color: isColor(m.color) ? m.color : '#b0c4d0',
      metalness: clampNum(m.metalness, 0.6, 0, 1), roughness: clampNum(m.roughness, 0.35, 0, 1),
      ...(isColor(m.emissive) ? { emissive: m.emissive, emissiveIntensity: clampNum(m.emissiveIntensity, 1, 0, 10) } : {}),
      ...(m.polygonOffset ? { polygonOffset: true, polygonOffsetFactor: clampNum(m.polygonOffsetFactor, -2, -10, 10), polygonOffsetUnits: clampNum(m.polygonOffsetUnits, -2, -10, 10) } : {}),
      ...(typeof m.finish === 'string' ? { finish: m.finish.slice(0, 24) } : {}),   // procedural surface texture (textures.js)
      ...(m.transparent ? { transparent: true, opacity: clampNum(m.opacity, 0.25, 0.02, 1) } : {}),   // see-through (guard glass etc.)
      ...(m.edges ? { edges: true, edgeColor: HEX.test(m.edgeColor) ? m.edgeColor : '#2b3440', ...(Number.isFinite(Number(m.edgeThreshold)) ? { edgeThreshold: clampNum(m.edgeThreshold, 15, 1, 90) } : {}) } : {}),   // crisp panel outlines (glass walls)
      // ── generic realism opt-ins (CompositeAsset) ──
      ...(Number.isFinite(Number(m.vary)) && Number(m.vary) > 0 ? { vary: clampNum(m.vary, 0, 0, 1) } : {}),               // per-part rough/metal variation
      ...(m.granular ? { granular: true } : {}),                                                                            // bulk-solids finish (coal/ore)
      ...(m.weather && m.weather.kind ? { weather: { kind: String(m.weather.kind), amount: clampNum(m.weather.amount, 0.5, 0, 1) } } : {}),  // rust/dust/concrete/paint film
      ...(m.water ? { water: true, waterRipple: clampNum(m.waterRipple, 0.35, 0, 2), waterSpeed: clampNum(m.waterSpeed, 1, 0, 10) } : {}),   // animated shimmer surface
      ...(m.alertGlow ? { alertGlow: true } : {}),
      ...(m.loadState ? { loadState: true } : {}),                                                                              // heap follows the vehicle's path-fill state                                                                              // indicator light driven by the owning object's alert severity
      ...(Number.isFinite(Number(m.envMapIntensity)) ? { envMapIntensity: clampNum(m.envMapIntensity, 1.25, 0, 4) } : {}),
    },
    ...(animKind ? { animate: { kind: animKind, speedKey: raw.animate.speedKey || undefined, ...(Number.isFinite(raw.animate.rate) ? { rate: raw.animate.rate } : {}), ...animExtras(raw.animate) } } : { animate: null }),
  }
}

function cleanPort(raw) {
  return {
    id: raw?.id || `port_${nanoid(4)}`,
    type: PORT_TYPES.includes(raw?.type) ? raw.type : 'product',
    direction: PORT_DIRECTIONS.includes(raw?.direction) ? raw.direction : 'in',
    offset: triple(raw?.offset, 0),
  }
}

// Tolerant validator (mirrors twinSpec): coerce/clamp/default, never throw.
// Returns { ok, spec, errors[], warnings[] }.
export function validateComponentSpec(raw) {
  const errors = [], warnings = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['Not a component object.'], warnings, spec: null }
  const partsRaw = Array.isArray(raw.parts) ? raw.parts : []
  if (!partsRaw.length) errors.push('A component needs at least one part.')
  const parts = partsRaw.map(cleanPart)
  const ports = (Array.isArray(raw.ports) ? raw.ports : []).map(cleanPort)
  const config = Array.isArray(raw.config) ? raw.config : []
  const parameters = Array.isArray(raw.parameters) ? raw.parameters : []
  const states = Array.isArray(raw.states) && raw.states.length ? raw.states : null
  const spec = {
    label: String(raw.label || 'Custom Component').slice(0, 60),
    category: String(raw.category || 'Custom').slice(0, 40),
    layer: raw.layer || 'equipment',
    schemaVersion: 1,
    parts, ports, config, parameters, states,
    subComponents: Array.isArray(raw.subComponents) ? raw.subComponents : [],   // declarative sub-assemblies (carried through)
    beacon: raw.beacon === null ? null : { offset: triple(raw.beacon?.offset, 0).map((n, i) => (i === 1 ? clampNum(n, 2.4, 0, 50) : clampNum(n, 0, -50, 50))) },
    defaultConfig: (raw.defaultConfig && typeof raw.defaultConfig === 'object') ? raw.defaultConfig : {},
  }
  return { ok: errors.length === 0, spec, errors, warnings }
}
