// ─────────────────────────────────────────────────────────────────────────────
// Per-asset-type configuration schema registry — the heart of "nothing static".
//
// Each asset type declares its configurable fields here. Two consumers read it:
//   1. the store (addObject / migrate / loadScene) → populates `config` defaults
//   2. BuildRightPanel → auto-generates a settings form from these field defs
// Components then read `config` to drive animation instead of hardcoded constants.
//
// fieldDef = { key, label, type, default, min?, max?, step?, options? }
//   type: 'number' | 'boolean' | 'select' | 'text' | 'color'
//
// IMPORTANT: machine `speed`/`pulseRate` defaults equal the values that were
// previously hardcoded in each component, so unedited scenes look identical.
// ─────────────────────────────────────────────────────────────────────────────

import { ITEM_OPTIONS } from './itemLibrary'

const enabledField = { key: 'enabled', label: 'Animate', type: 'boolean', default: true }
const speed = (def) => ({ key: 'speed', label: 'Speed', type: 'number', default: def, min: 0, max: 3, step: 0.05 })
const pulse = (def) => ({ key: 'pulseRate', label: 'Pulse Rate', type: 'number', default: def, min: 0, max: 12, step: 0.1 })

export const ASSET_SCHEMAS = {
  // ── Imported glTF/GLB model (real 3D asset — see GLBModel.jsx) ─────────
  Model: [
    { key: 'url',   label: 'Model URL (.glb)', type: 'text',   default: '' },
    { key: 'fit',   label: 'Fit Size (m)',     type: 'number', default: 4, min: 0.2, max: 60, step: 0.2 },
    { key: 'scale', label: 'Scale ×',          type: 'number', default: 1, min: 0.05, max: 20, step: 0.05 },
    { key: 'yaw',   label: 'Yaw (°)',          type: 'number', default: 0, min: 0, max: 360, step: 5 },
  ],

  // ── Rotating / oscillating machines (read config.speed) ───────────────
  PETFiller:    [enabledField, speed(0.38)],
  CanFiller:    [enabledField, speed(0.55)],
  GlassFiller:  [enabledField, speed(0.28)],
  CanSeamer:    [enabledField, speed(0.75)],
  RotaryCapper: [enabledField, speed(0.55)],
  CrownCapper:  [enabledField, speed(1.0)],
  CheckWeigher: [enabledField, { ...speed(0.4), label: 'Reject Arm Speed' }],
  Labeller:     [enabledField, { ...speed(1.0), label: 'Reel Speed', max: 4 }], // multiplier on per-reel base

  // ── Emissive / light pulse machines (read config.pulseRate) ───────────
  Carbonator:   [enabledField, { ...pulse(0.8), label: 'Gauge Pulse' }],
  DateCoder:    [enabledField, { ...pulse(6),   label: 'Print Pulse' }],
  BottleWasher: [enabledField, { ...pulse(1.2), label: 'Steam Rate' }],
  EBIInspector: [enabledField, { ...pulse(4),   label: 'Inspect Light' }],

  // ── Conveyor belt (Material Handling) ─────────────────────────────────
  ConveyorBelt: [
    { key: 'running',     label: 'Running',     type: 'boolean', default: true },
    { key: 'speed',       label: 'Speed',       type: 'number',  default: 1.2, min: 0, max: 5, step: 0.1 },
    { key: 'beltStyle',   label: 'Belt Style',  type: 'select',  default: 'chain',
      options: [{ value: 'chain', label: 'Chain' }, { value: 'roller', label: 'Roller' }] },
    { key: 'length',      label: 'Length',      type: 'number',  default: 8, min: 2, max: 40, step: 0.5 },
    { key: 'itemType',    label: 'Item',        type: 'select',  default: 'pet_bottle', options: ITEM_OPTIONS },
    { key: 'itemSpacing', label: 'Item Spacing',type: 'number',  default: 1.4, min: 0.4, max: 6, step: 0.1 },
  ],

  // ── Flow conveyor — conveyor packed with instanced product ─────────────
  FlowConveyor: [
    { key: 'running',     label: 'Running',      type: 'boolean', default: true },
    { key: 'length',      label: 'Length',       type: 'number',  default: 8, min: 2, max: 60, step: 0.5 },
    { key: 'curve',       label: 'End Curve',    type: 'select',  default: 'none',
      options: [{ value: 'none', label: 'Straight' }, { value: 'left', label: 'Curve Left' }, { value: 'right', label: 'Curve Right' }] },
    { key: 'curveRadius', label: 'Curve Radius', type: 'number',  default: 2, min: 0.8, max: 8, step: 0.1 },
    { key: 'lanes',       label: 'Lanes',        type: 'number',  default: 1, min: 1, max: 8, step: 1 },
    { key: 'laneGap',     label: 'Lane Gap',     type: 'number',  default: 0.24, min: 0.16, max: 0.6, step: 0.01 },
    { key: 'spacing',     label: 'Bottle Pitch', type: 'number',  default: 0.22, min: 0.16, max: 2, step: 0.01 },
    { key: 'speed',       label: 'Speed',        type: 'number',  default: 0.6, min: 0, max: 3, step: 0.05 },
    { key: 'capColor',    label: 'Cap Color',    type: 'color',   default: '#2f6fb0' },
    { key: 'label',       label: 'Label Band',   type: 'text',    default: '' },   // hex color → bottles carry a label (set downstream of a labeller)
  ],

  // ── Utilities & structure (parametric procedural assets) ──────────────
  Tank: [
    { key: 'radius', label: 'Radius', type: 'number', default: 1.1, min: 0.3, max: 5, step: 0.1 },
    { key: 'height', label: 'Height', type: 'number', default: 3.2, min: 0.5, max: 12, step: 0.1 },
    { key: 'fillLevel', label: 'Fill %', type: 'number', default: 60, min: 0, max: 100, step: 1 },
    { key: 'color',  label: 'Color',  type: 'color',  default: '#cdd6e2' },
  ],
  Pump: [
    enabledField,
    { ...speed(1.4), label: 'Impeller Speed', max: 6 },
    { key: 'color', label: 'Color', type: 'color', default: '#3f7fa8' },
  ],
  Valve: [
    { key: 'open',  label: 'Open',  type: 'boolean', default: true },
    { key: 'color', label: 'Color', type: 'color',   default: '#a8442f' },
  ],
  PipeSegment: [
    { key: 'length', label: 'Length', type: 'number', default: 4, min: 0.5, max: 30, step: 0.5 },
    { key: 'radius', label: 'Radius', type: 'number', default: 0.12, min: 0.03, max: 0.6, step: 0.01 },
    { key: 'color',  label: 'Color',  type: 'color',  default: '#c8d4e0' },
  ],
  MountingStand: [
    { key: 'width',  label: 'Width',  type: 'number', default: 2, min: 0.3, max: 8, step: 0.1 },
    { key: 'height', label: 'Height', type: 'number', default: 0.9, min: 0.2, max: 4, step: 0.1 },
    { key: 'depth',  label: 'Depth',  type: 'number', default: 2, min: 0.3, max: 8, step: 0.1 },
    { key: 'color',  label: 'Color',  type: 'color',  default: '#526070' },
  ],

  // ── Aluminium smelter (Anode Potline) ─────────────────────────────
  ReductionPot: [
    { key: 'showGlow',      label: 'Molten Glow', type: 'boolean', default: true },
    { key: 'glowIntensity', label: 'Glow',        type: 'number',  default: 1, min: 0, max: 2, step: 0.05 },
  ],
  PotTendingMachine: [
    { key: 'enabled',   label: 'Travelling', type: 'boolean', default: true },
    { key: 'speed',     label: 'Speed',      type: 'number',  default: 0.8, min: 0, max: 3, step: 0.05 },
    { key: 'span',      label: 'Span',       type: 'number',  default: 22, min: 6, max: 40, step: 0.5 },
    { key: 'travel',    label: 'Travel',     type: 'number',  default: 32, min: 0, max: 60, step: 1 },
    { key: 'bayLength', label: 'Bay Length', type: 'number',  default: 80, min: 20, max: 160, step: 1 },
  ],
  AluminaSilo: [
    { key: 'radius',    label: 'Radius',  type: 'number', default: 1.6, min: 0.5, max: 4, step: 0.1 },
    { key: 'height',    label: 'Height',  type: 'number', default: 4.5, min: 1, max: 12, step: 0.1 },
    { key: 'fillLevel', label: 'Fill %',  type: 'number', default: 70, min: 0, max: 100, step: 1 },
    { key: 'color',     label: 'Color',   type: 'color',  default: '#dfe4ea' },
  ],
  TappingCrucible: [
    { key: 'tapping', label: 'Tapping', type: 'boolean', default: true },
  ],

  // ── Environment ───────────────────────────────────────────────────
  Floor: [
    { key: 'width',     label: 'Width',      type: 'number',  default: 150, min: 4, max: 400, step: 1 },
    { key: 'depth',     label: 'Depth',      type: 'number',  default: 56,  min: 4, max: 400, step: 1 },
    { key: 'color',     label: 'Color',      type: 'color',   default: '#f2f2f3' },
    { key: 'roughness', label: 'Roughness',  type: 'number',  default: 0.95, min: 0, max: 1, step: 0.01 },
    { key: 'metalness', label: 'Metalness',  type: 'number',  default: 0,    min: 0, max: 1, step: 0.01 },
    { key: 'showLanes', label: 'Aisle Lanes',type: 'boolean', default: true },
    { key: 'laneColor', label: 'Lane Color', type: 'color',   default: '#e8b53a' },
    { key: 'reflective',label: 'Reflective', type: 'boolean', default: true },
  ],
  Light: [
    { key: 'on',          label: 'On',           type: 'boolean', default: true },
    { key: 'length',      label: 'Length',       type: 'number',  default: 9,  min: 0.5, max: 24, step: 0.5 },
    { key: 'intensity',   label: 'Intensity',    type: 'number',  default: 6,  min: 0, max: 20, step: 0.5 },
    { key: 'range',       label: 'Range',        type: 'number',  default: 34, min: 2, max: 80, step: 1 },
    { key: 'mountHeight', label: 'Mount Height', type: 'number',  default: 6,  min: 0, max: 14, step: 0.1 },
    { key: 'color',       label: 'Color',        type: 'color',   default: '#eaf2ff' },
  ],

  // ── Terrain & Civil (see components/terrain) ─────────────────────
  PitTerrain: [
    { key: 'depth',      label: 'Wall Depth (m)',   type: 'number',  default: 12.6, min: 3,  max: 60,  step: 0.5 },
    { key: 'benches',    label: 'Bench Count',      type: 'number',  default: 3,    min: 1,  max: 8,   step: 1 },
    { key: 'benchDepth', label: 'Bench Tread (m)',  type: 'number',  default: 10,   min: 2,  max: 30,  step: 0.5 },
    { key: 'faceAngle',  label: 'Face Angle (°)',   type: 'number',  default: 62,   min: 30, max: 85,  step: 1 },
    { key: 'floorWidth', label: 'Floor Width (m)',  type: 'number',  default: 76,   min: 20, max: 300, step: 2 },
    { key: 'floorDepth', label: 'Floor Depth (m)',  type: 'number',  default: 50,   min: 20, max: 200, step: 2 },
    { key: 'ramp',       label: 'Haul Ramp',        type: 'boolean', default: true },
    { key: 'rampWidth',  label: 'Ramp Width (m)',   type: 'number',  default: 8,    min: 4,  max: 20,  step: 0.5 },
    { key: 'seam',       label: 'Exposed Seam',     type: 'boolean', default: true },
    { key: 'muck',       label: 'Muck Piles',       type: 'boolean', default: true },
    { key: 'earthColor', label: 'Earth Color',      type: 'color',   default: '#8a7a64' },
    { key: 'floorColor', label: 'Floor Color',      type: 'color',   default: '#6e6257' },
    { key: 'seamColor',  label: 'Seam Color',       type: 'color',   default: '#23262b' },
  ],
  TerrainMound: [
    { key: 'radius',    label: 'Radius (m)',    type: 'number',  default: 9,    min: 2, max: 60, step: 0.5 },
    { key: 'height',    label: 'Height (m)',    type: 'number',  default: 5.5,  min: 1, max: 40, step: 0.5 },
    { key: 'lobes',     label: 'Lobes',         type: 'number',  default: 3,    min: 1, max: 5,  step: 1 },
    { key: 'irregular', label: 'Irregularity',  type: 'number',  default: 0.35, min: 0, max: 1,  step: 0.05 },
    { key: 'pad',       label: 'Ground Pad',    type: 'boolean', default: true },
    { key: 'dust',      label: 'Tip-Head Dust', type: 'boolean', default: false },
    { key: 'color',     label: 'Color',         type: 'color',   default: '#8a7a64' },
  ],
}

// Field set for a custom asset built from a primitive. Geometry is fully
// config-driven by the generic Primitive component (see Primitive.jsx).
export function primitiveSchema(primitive = 'box') {
  const color = { key: 'color', label: 'Color', type: 'color', default: '#9fb2c4' }
  if (primitive === 'cylinder') {
    return [
      { key: 'radius', label: 'Radius', type: 'number', default: 0.8, min: 0.1, max: 6, step: 0.1 },
      { key: 'height', label: 'Height', type: 'number', default: 1.6, min: 0.1, max: 12, step: 0.1 },
      color,
    ]
  }
  if (primitive === 'tank') {
    return [
      { key: 'radius', label: 'Radius', type: 'number', default: 1.0, min: 0.2, max: 6, step: 0.1 },
      { key: 'height', label: 'Height', type: 'number', default: 3.0, min: 0.5, max: 14, step: 0.1 },
      color,
    ]
  }
  // box (default)
  return [
    { key: 'width',  label: 'Width',  type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1 },
    { key: 'height', label: 'Height', type: 'number', default: 1.5, min: 0.1, max: 12, step: 0.1 },
    { key: 'depth',  label: 'Depth',  type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1 },
    color,
  ]
}

// Resolve the schema for any type — built-in or user-defined custom type.
export function getSchema(type, customAssetTypes = {}) {
  if (ASSET_SCHEMAS[type]) return ASSET_SCHEMAS[type]
  const custom = customAssetTypes[type]
  if (custom) {
    // Multi-part Component Spec declares its own settings schema.
    if (Array.isArray(custom.config)) return custom.config
    // Legacy single-primitive custom type → primitive geometry fields.
    const base = primitiveSchema(custom.primitive)
    const overrides = custom.defaultConfig ?? {}
    return base.map(f => (overrides[f.key] !== undefined ? { ...f, default: overrides[f.key] } : f))
  }
  return []
}

// Reduce a schema into a { key: default } config object.
export function getDefaultConfig(type, customAssetTypes = {}) {
  const schema = getSchema(type, customAssetTypes)
  const cfg = {}
  for (const f of schema) cfg[f.key] = f.default
  return cfg
}

// Clamp / cast / validate a raw form value against its field definition.
export function coerceConfigValue(field, raw) {
  switch (field.type) {
    case 'number': {
      let n = Number(raw)
      if (Number.isNaN(n)) n = field.default
      if (field.min != null) n = Math.max(field.min, n)
      if (field.max != null) n = Math.min(field.max, n)
      return n
    }
    case 'boolean':
      return Boolean(raw)
    case 'select': {
      const ok = (field.options ?? []).some(o => o.value === raw)
      return ok ? raw : field.default
    }
    default:
      return raw == null ? field.default : String(raw)
  }
}

// Merge stored config over schema defaults so old/partial objects always have
// every key the component expects (defensive back-fill at render/load time).
export function withConfigDefaults(type, config, customAssetTypes = {}) {
  return { ...getDefaultConfig(type, customAssetTypes), ...(config ?? {}) }
}
