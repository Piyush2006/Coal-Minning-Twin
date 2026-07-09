// ─────────────────────────────────────────────────────────────────────────────
// Per-asset-type STATE schema — the operational/process state machine each asset
// can be in (Normal, Anode Change, Tapping, Anode Effect, Off-line, …). The
// FOURTH parallel registry alongside assetSchemas / parameterSchemas /
// connectorSchemas, and the reusable "global configurator item" for any twin.
//
// `state` is the rich, per-type SOURCE OF TRUTH on each object. The legacy
// 3-value `status` (running/idle/fault) is DERIVED from a state's `severity`, so
// every existing status-driven visual (status lights, beacons, TopBar counts,
// theme colours, rules) keeps working unchanged.
//
//   stateDef = { key, label, color, severity }   severity ∈ 'ok' | 'warn' | 'down'
// ─────────────────────────────────────────────────────────────────────────────

const s = (key, label, color, severity) => ({ key, label, color, severity })

// Default set — covers every type WITHOUT an explicit schema (beverage machines,
// pumps, valves, custom assets). Mirrors the original running/idle/fault enum so
// those assets behave exactly as before.
export const DEFAULT_STATES = [
  s('running', 'Running', '#34c759', 'ok'),
  s('idle',    'Idle',    '#ff9f0a', 'warn'),
  s('fault',   'Fault',   '#ff3b30', 'down'),
]

export const STATE_SCHEMAS = {
  // ── Aluminium smelter ────────────────────────────────────────────
  ReductionPot: [
    s('normal',       'Normal',        '#34c759', 'ok'),
    s('feeding',      'Feeding',       '#30b0c7', 'ok'),
    s('tapping',      'Tapping',       '#5ac8fa', 'ok'),
    s('beamRaise',    'Beam Raise',    '#ffd60a', 'warn'),
    s('anodeChange',  'Anode Change',  '#ff9f0a', 'warn'),
    s('anodeEffect',  'Anode Effect',  '#ff3b30', 'down'),
    s('offline',      'Off-line',      '#8e8e93', 'down'),
  ],
  PotTendingMachine: [
    s('idle',         'Idle',           '#34c759', 'ok'),
    s('travelling',   'Travelling',     '#5ac8fa', 'ok'),
    s('changingAnode','Changing Anode', '#ff9f0a', 'warn'),
    s('offline',      'Off-line',       '#8e8e93', 'down'),
  ],
  AluminaSilo: [
    s('normal',    'Normal',    '#34c759', 'ok'),
    s('feeding',   'Feeding',   '#30b0c7', 'ok'),
    s('low',       'Low Level', '#ff9f0a', 'warn'),
    s('refilling', 'Refilling', '#5ac8fa', 'ok'),
    s('empty',     'Empty',     '#ff3b30', 'down'),
  ],
  TappingCrucible: [
    s('idle',    'Idle',     '#34c759', 'ok'),
    s('tapping', 'Tapping',  '#ff9f0a', 'ok'),   // severity ok → molten glow stays on
    s('full',    'Full',     '#5ac8fa', 'ok'),
    s('offline', 'Off-line', '#8e8e93', 'down'),
  ],

  // ── Environment ──────────────────────────────────────────────────
  // Static props — a single neutral state (no running/fault cycling).
  Floor: [
    s('placed', 'Placed', '#8e8e93', 'ok'),
  ],
  Light: [
    s('on', 'On', '#ffd60a', 'ok'),
  ],

  // ── Terrain & Civil ──────────────────────────────────────────────
  PitTerrain: [
    s('active',     'Active Mining',      '#34c759', 'ok'),
    s('restricted', 'Restricted (Blast)', '#ff9f0a', 'warn'),
    s('evacuated',  'Evacuated',          '#ff3b30', 'down'),
  ],
  TerrainMound: [
    s('normal',     'Normal',           '#34c759', 'ok'),
    s('monitoring', 'Under Monitoring', '#ff9f0a', 'warn'),
    s('slipRisk',   'Slip Risk',        '#ff3b30', 'down'),
  ],
}

import { getCustomTypes } from './customTypesRef'

export const SEVERITY_TO_STATUS = { ok: 'running', warn: 'idle', down: 'fault' }

export function getStateSchema(type) {
  if (STATE_SCHEMAS[type]) return STATE_SCHEMAS[type]
  // Custom Component Spec may declare its own states; else fall back to default.
  const custom = getCustomTypes()[type]
  if (custom?.states?.length) return custom.states
  return DEFAULT_STATES
}

export function defaultState(type) {
  return getStateSchema(type)[0].key
}

export function stateMeta(type, key) {
  const schema = getStateSchema(type)
  return schema.find(st => st.key === key) ?? schema[0]
}

export function severityOf(type, key) {
  return stateMeta(type, key).severity
}

// Derive the legacy 3-value status from a rich state's severity.
export function statusFromState(type, key) {
  return SEVERITY_TO_STATUS[severityOf(type, key)] ?? 'running'
}

// Reverse map (migration only): given a legacy status, pick the first state of
// matching severity, so an existing running/idle/fault is preserved on v2→v3.
export function stateFromStatus(type, status) {
  const want = status === 'fault' ? 'down' : status === 'idle' ? 'warn' : 'ok'
  const schema = getStateSchema(type)
  return (schema.find(st => st.severity === want) ?? schema[0]).key
}
