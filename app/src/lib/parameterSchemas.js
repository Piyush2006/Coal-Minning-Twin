// ─────────────────────────────────────────────────────────────────────────────
// Per-asset-type PARAMETER schema — the telemetry-style fields a Visual Rule can
// read (voltage, speed, current, temperature, …). Distinct from assetSchemas.js
// (which holds settings that drive geometry/animation). Mirrors that module's API.
//
// Values are editable in the inspector now; later they can be fed by live data
// through updateParameter without any change to rules/glow.
//
// fieldDef = { key, label, unit, default, min?, max? }
// ─────────────────────────────────────────────────────────────────────────────

// freq = how often this value refreshes (industry-standard default per field).
// 'manual' params are never auto-driven — an operator enters them (with a timestamp).
const n = (key, label, unit, def, min, max, freq) => ({ key, label, unit, default: def, min, max, freq })

export const FREQUENCIES = [
  { key: 'realtime', label: 'Real-time (1s)', ms: 1000 },
  { key: '5s', label: 'Every 5 sec', ms: 5000 },
  { key: '30s', label: 'Every 30 sec', ms: 30000 },
  { key: '1m', label: 'Every 1 min', ms: 60000 },
  { key: '5m', label: 'Every 5 min', ms: 300000 },
  { key: '15m', label: 'Every 15 min', ms: 900000 },
  { key: '1h', label: 'Every 1 hour', ms: 3600000 },
  { key: 'manual', label: 'Manual entry', ms: null },
]
const FREQ_MS = Object.fromEntries(FREQUENCIES.map(f => [f.key, f.ms]))
export const DEFAULT_FREQ = '30s'   // sensible default so values don't churn every second

// Electrical params reused across motorised machines (honours voltage/current ask).
const VOLTAGE = n('voltage', 'Voltage', 'V', 415, 0, 600)
const CURRENT = n('current', 'Current', 'A', 12, 0, 100)

export const PARAMETER_SCHEMAS = {
  Carbonator:   [n('co2Level','CO₂ Volumes','vol',3.8,0,6), n('pressure','Pressure','bar',4.5,0,8), n('temp','Temperature','°C',6,0,30)],
  PETFiller:    [n('throughput','Throughput','bpm',600,0,1200), n('fillTemp','Fill Temp','°C',8,0,40), VOLTAGE, CURRENT],
  CanFiller:    [n('throughput','Throughput','cpm',900,0,2000), n('pressure','Pressure','bar',2.4,0,6), VOLTAGE, CURRENT],
  GlassFiller:  [n('throughput','Throughput','bpm',420,0,1000), n('fillTemp','Fill Temp','°C',10,0,40), VOLTAGE, CURRENT],
  RotaryCapper: [n('throughput','Throughput','cpm',600,0,1200), n('torque','Cap Torque','Nm',1.8,0,10), CURRENT],
  CanSeamer:    [n('throughput','Throughput','cpm',900,0,2000), n('seamPressure','Seam Pressure','bar',3.1,0,8), CURRENT],
  CrownCapper:  [n('throughput','Throughput','cpm',520,0,1200), n('torque','Cap Torque','Nm',2.2,0,10), CURRENT],
  Labeller:     [n('throughput','Throughput','lpm',600,0,1200), n('reelLevel','Reel Level','%',80,0,100), VOLTAGE],
  DateCoder:    [n('throughput','Throughput','upm',600,0,1200), n('inkLevel','Ink Level','%',72,0,100)],
  BottleWasher: [n('throughput','Throughput','bpm',500,0,1200), n('waterTemp','Water Temp','°C',62,0,95), n('detergent','Detergent','%',2.5,0,10)],
  CheckWeigher: [n('throughput','Throughput','upm',600,0,1200), n('rejectRate','Reject Rate','%',1.2,0,100), n('targetWeight','Target Weight','g',500,0,2000)],
  EBIInspector: [n('throughput','Throughput','upm',600,0,1200), n('rejectRate','Reject Rate','%',0.8,0,100), n('defects','Defects','ppm',120,0,5000)],

  // ── Aluminium smelter ────────────────────────────────────────────
  ReductionPot:    [n('voltage','Pot Voltage','V',4.2,0,8,'5s'), n('bathTemp','Bath Temp','°C',960,800,1100,'manual'), n('metalTemp','Metal Temp','°C',905,800,1000,'manual'), n('current','Line Current','kA',320,0,500,'5s'), n('acd','ACD','mm',30,0,80,'1m'), n('currentEff','Current Efficiency','%',94,80,100,'1h')],
  PotTendingMachine: [n('position','Travel','%',0,0,100), n('lift','Hoist Load','t',12,0,40)],
  AluminaSilo:     [n('level','Level','%',70,0,100), n('feedRate','Feed Rate','kg/h',420,0,2000)],
  TappingCrucible: [n('metalTemp','Metal Temp','°C',900,700,1000), n('fill','Fill','%',40,0,100)],

  ConveyorBelt: [n('lineSpeed','Line Speed','m/s',0.6,0,3), n('load','Load','%',55,0,100),
    // drive-motor telemetry — the CV-01 thermal diagnosis (Screen 4) reads these
    // in Live, not only in the recorded fixture. motorTemp is load-aware (see
    // chainLive); vibration stays flat so a rise is a cooling-path issue, not a bearing.
    { ...n('motorTemp','Drive Motor Temp','°C',58,20,110), freq: '5s' },
    { ...n('motorCurrent','Drive Motor Current','A',142,0,260), freq: '5s' },
    { ...n('vibration','Drive Vibration','mm/s',2.1,0,12), freq: '5s' }],
  Tank:         [n('level','Level','%',60,0,100), n('temp','Temperature','°C',18,0,90), n('pressure','Pressure','bar',1.2,0,10)],
  Pump:         [n('flowRate','Flow Rate','m³/h',24,0,200), n('pressure','Pressure','bar',3.5,0,16), n('vibration','Vibration','mm/s',1.8,0,20)],
  Valve:        [n('position','Open Position','%',100,0,100), n('flowRate','Flow Rate','m³/h',24,0,200)],
  PipeSegment:  [n('flowRate','Flow Rate','m³/h',24,0,200), n('pressure','Pressure','bar',2.0,0,16)],
  MountingStand:[n('load','Load','kg',120,0,2000)],

  // ── Terrain & Civil ──────────────────────────────────────────────
  PitTerrain:   [n('pitDepth','Pit Depth','m',42,0,300,'manual'), n('stripRatio','Strip Ratio','m3/t',4.2,0,20,'manual'), n('coalExposed','Ore Exposed','t',65000,0,500000,'manual')],
  TerrainMound: [n('dumpTonnes','Material In Dump','t',480000,0,2000000,'15m'), n('stability','Slope Stability','%',92,0,100,'manual')],
}

// Generic params for user-defined custom asset types (so rules work on them too).
const CUSTOM_PARAMS = [n('value', 'Value', '', 0, 0, 1000), n('temperature', 'Temperature', '°C', 20, -40, 200)]

export function getParameterSchema(type, customAssetTypes = {}) {
  if (PARAMETER_SCHEMAS[type]) return PARAMETER_SCHEMAS[type]
  const custom = customAssetTypes[type]
  if (custom) return (Array.isArray(custom.parameters) && custom.parameters.length) ? custom.parameters : CUSTOM_PARAMS
  return []
}

// Effective refresh frequency for a parameter: a per-object override (paramMeta)
// wins, else the schema default, else the global default.
export function paramFreqKey(obj, key, customAssetTypes = {}) {
  const override = obj?.paramMeta?.[key]?.frequency
  if (override) return override
  const def = getParameterSchema(obj?.type, customAssetTypes).find(d => d.key === key)
  return def?.freq || DEFAULT_FREQ
}
export function paramFreqMs(obj, key, customAssetTypes = {}) {
  const ms = FREQ_MS[paramFreqKey(obj, key, customAssetTypes)]
  return ms === undefined ? FREQ_MS[DEFAULT_FREQ] : ms   // null = manual
}

export function getDefaultParameters(type, customAssetTypes = {}) {
  const schema = getParameterSchema(type, customAssetTypes)
  const p = {}
  for (const f of schema) p[f.key] = f.default
  return p
}

export function withParameterDefaults(type, parameters, customAssetTypes = {}) {
  return { ...getDefaultParameters(type, customAssetTypes), ...(parameters ?? {}) }
}

// Effective parameter list for an object: the type schema (minus any the user
// removed) plus user-added custom params, each annotated with its UNS `topic`.
// `obj.paramMeta[key] = { label?, unit?, topic?, custom?, removed? }`.
export function effectiveParamDefs(obj, customAssetTypes = {}) {
  const schema = getParameterSchema(obj?.type, customAssetTypes)
  const meta = obj?.paramMeta || {}
  const out = []
  for (const f of schema) {
    if (meta[f.key]?.removed) continue
    out.push({ ...f, topic: meta[f.key]?.topic || '', custom: false })
  }
  for (const [key, m] of Object.entries(meta)) {
    if (!m || m.removed || m.custom !== true) continue
    if (schema.some(f => f.key === key)) continue
    out.push({ key, label: m.label || key, unit: m.unit || '', default: 0, topic: m.topic || '', custom: true })
  }
  return out
}

export function coerceParameterValue(field, raw) {
  let v = Number(raw)
  if (Number.isNaN(v)) return field.default
  if (field.min != null) v = Math.max(field.min, v)
  if (field.max != null) v = Math.min(field.max, v)
  return v
}
