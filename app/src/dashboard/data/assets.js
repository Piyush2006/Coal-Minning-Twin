// Shared asset-condition engine for Fleet + Predictive Maintenance. For each
// asset it produces: current sensor readings vs configured thresholds, an
// EXPLAINABLE health score (contributing conditions listed), a live status,
// a grouped predictive-maintenance fault (when multiple signals agree), plus a
// status timeline, sensor trends and maintenance/fault/downtime history.
// Deterministic per asset so the dashboard is stable. No IoT — mock by design.
import { mulberry, hash, dayKey } from './rng'
import { UNITS } from './equipment'
import { sideOf } from './taxonomy'

export const MOBILE_TYPES = ['truck', 'shovel', 'loader', 'drill']
export const PDM_KEYS = ['vibration', 'temperature', 'current', 'pressure', 'rpm']
export const FLEET_STATE = {
  'Running':        { color: 'var(--background-positive-default)', intent: 'Positive' },
  'Idle — On Job':  { color: 'var(--background-warning-default)', intent: 'Notice' },
  'Idle — Off Job': { color: 'var(--text-gray-tertiary)', intent: 'Neutral' },
  'Breakdown':      { color: 'var(--background-error-default)', intent: 'Negative' },
}
export const SEVERITY = {
  Critical: { status: 'critical', badge: 'Negative' },
  Warning:  { status: 'warning', badge: 'Notice' },
  Normal:   { status: 'positive', badge: 'Positive' },
}
const TYPE_FUEL = { truck: 0.34, shovel: 0.15, loader: 0.30, drill: 0.22, crusher: 0, conveyor: 0, screen: 0 }

// coherent multi-signal fault patterns (grouping abnormal signals into one issue)
const PATTERNS = [
  { sensors: ['vibration', 'temperature', 'current'], fault: 'Possible Bearing / Motor Issue', rec: 'Inspect bearing condition, lubrication and motor alignment.', faultType: 'Mechanical' },
  { sensors: ['pressure', 'current'], fault: 'Possible Hydraulic Fault', rec: 'Inspect hydraulic pump, hoses and relief-valve pressure.', faultType: 'Hydraulic' },
  { sensors: ['temperature', 'current'], fault: 'Motor Overheating', rec: 'Check cooling and load; allow to cool before restart.', faultType: 'Thermal' },
  { sensors: ['rpm', 'vibration'], fault: 'Overspeed / Drivetrain', rec: 'Check governor, load and drivetrain condition.', faultType: 'Mechanical' },
]
const SINGLE = {
  vibration: { fault: 'Imbalance / Mechanical Wear', faultType: 'Mechanical', rec: 'Inspect for imbalance, looseness and component wear.' },
  temperature: { fault: 'Overheating', faultType: 'Thermal', rec: 'Check cooling system and load.' },
  current: { fault: 'Electrical Overload', faultType: 'Electrical', rec: 'Check electrical load and connections.' },
  pressure: { fault: 'Pressure Loss', faultType: 'Hydraulic', rec: 'Inspect hydraulic circuit and seals.' },
  rpm: { fault: 'Overspeed', faultType: 'Mechanical', rec: 'Check governor and load conditions.' },
}
function diagnose(keys) {
  let best = null, bestN = 1
  for (const p of PATTERNS) { const n = p.sensors.filter(s => keys.includes(s)).length; if (n >= 2 && n > bestN) { best = p; bestN = n } }
  if (best) return best
  return SINGLE[keys[0]] || { fault: 'Abnormal Reading', faultType: 'Other', rec: 'Investigate the sensor trend.' }
}

const sensorState = (v, t) => t.low ? (v <= t.crit ? 'crit' : v <= t.warn ? 'warn' : 'normal') : (v >= t.crit ? 'crit' : v >= t.warn ? 'warn' : 'normal')
function sensorValue(t, rng, elevate) {
  if (elevate === 'crit') return t.low ? t.crit * (0.84 + rng() * 0.1) : t.crit * (1.03 + rng() * 0.13)
  if (elevate === 'warn') return t.low ? t.crit + (t.warn - t.crit) * (0.3 + rng() * 0.45) : t.warn + (t.crit - t.warn) * (0.15 + rng() * 0.5)
  return t.low ? t.warn * (1.1 + rng() * 0.2) : t.warn * (0.6 + rng() * 0.24)
}
const round = (v, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp

// current condition for one asset (stable snapshot)
export function assetCondition(u, settings) {
  const rng = mulberry(hash(`${u.id}|cond`) ^ 0x2b1d)
  const bucket = hash(u.id) % 100
  const klass = bucket < 16 ? 'critical' : bucket < 42 ? 'warning' : 'normal'
  const pattern = PATTERNS[hash(u.id + 'p') % PATTERNS.length]

  // decide which sensors to elevate
  const elevated = {}
  if (klass === 'critical') for (const s of pattern.sensors) elevated[s] = 'crit'
  else if (klass === 'warning') { const k = PDM_KEYS[hash(u.id + 'w') % PDM_KEYS.length]; elevated[k] = 'warn' }

  const sensors = Object.entries(settings.thresholds).map(([key, t]) => {
    const v = round(sensorValue(t, rng, elevated[key]), key === 'batteryVoltage' || key === 'pressure' || key === 'oilPressure' ? 1 : key === 'vibration' ? 1 : 0)
    const state = sensorState(v, t)
    const devPct = t.low ? ((t.warn - v) / t.warn) * 100 : ((v - t.warn) / t.warn) * 100
    const deltaText = state === 'normal' ? 'within normal'
      : (key === 'temperature' || key === 'coolantTemp')
        ? `+${Math.round(v - t.warn)}${t.unit} above normal`
        : t.low ? `−${Math.round(Math.abs(devPct))}% below normal` : `+${Math.round(devPct)}% above normal`
    const normalRange = t.low ? `≥ ${t.warn} ${t.unit}` : `≤ ${t.warn} ${t.unit}`
    return { key, label: t.label, unit: t.unit, value: v, warn: t.warn, crit: t.crit, low: !!t.low, state, devPct, deltaText, normalRange, isPdm: PDM_KEYS.includes(key) }
  })

  // reliability inputs
  const faultCodes = klass === 'critical' ? 1 + Math.floor(rng() * 3) : klass === 'warning' ? Math.floor(rng() * 2) : 0
  const breakdowns = klass === 'critical' ? 1 + Math.floor(rng() * 3) : Math.floor(rng() * 2)
  const downtimeHours = round(2 + rng() * (klass === 'critical' ? 26 : 12), 1)
  const maintenance = klass === 'critical' ? (rng() < 0.5 ? 'Overdue' : 'Due') : klass === 'warning' ? (rng() < 0.4 ? 'Due' : 'OK') : (rng() < 0.15 ? 'Due' : 'OK')

  // ── explainable health score ──
  let score = 100
  const contributors = []
  const add = (label, impact, detail) => { score -= impact; contributors.push({ label, impact: Math.round(impact), detail }) }
  for (const s of sensors) {
    if (s.state === 'crit') add(`${s.label} critical`, 16 + rng() * 4, `${s.value} ${s.unit} · limit ${s.warn}`)
    else if (s.state === 'warn') add(`${s.label} high`, 7 + rng() * 3, `${s.value} ${s.unit} · limit ${s.warn}`)
  }
  if (faultCodes) add(`${faultCodes} active fault code${faultCodes > 1 ? 's' : ''}`, faultCodes * 5, 'ECU diagnostic')
  if (breakdowns) add(`${breakdowns} recent breakdown${breakdowns > 1 ? 's' : ''}`, breakdowns * 4, 'reliability history')
  if (downtimeHours > 12) add('High downtime', Math.min(12, downtimeHours * 0.3), `${downtimeHours} h in period`)
  if (maintenance === 'Overdue') add('Maintenance overdue', 12, 'service schedule')
  else if (maintenance === 'Due') add('Maintenance due', 5, 'service schedule')
  const fuelBase = TYPE_FUEL[u.type] || 0
  const health = Math.max(30, Math.round(score))
  const healthBand = health >= 85 ? 'good' : health >= 70 ? 'watch' : 'alert'
  const healthStatus = health >= 85 ? 'positive' : health >= 70 ? 'warning' : 'critical'
  contributors.sort((a, b) => b.impact - a.impact)

  // fuel efficiency (worse when unhealthy)
  const fuelPerTon = fuelBase ? round(fuelBase * (1 + (100 - health) / 100 * 0.5 + (rng() - 0.5) * 0.1), 2) : null

  // predictive-maintenance alert (from abnormal PdM sensors)
  const abnormal = sensors.filter(s => s.isPdm && s.state !== 'normal')
  const severity = abnormal.some(s => s.state === 'crit') ? 'Critical' : abnormal.length ? 'Warning' : 'Normal'
  const dx = abnormal.length ? diagnose(abnormal.map(s => s.key)) : null

  // live status (coherent with alert/health)
  const status = pickStatus(rng, severity, health)

  return {
    ...u, sensors, abnormal, severity, diagnosis: dx,
    faultCodes, breakdowns, downtimeHours, maintenance,
    health, healthBand, healthStatus, contributors, fuelPerTon, status,
  }
}

const STATUS_LIST = ['Running', 'Idle — On Job', 'Idle — Off Job', 'Breakdown']
function pickStatus(rng, severity, health) {
  if (severity === 'Critical') return rng() < 0.55 ? 'Breakdown' : rng() < 0.6 ? 'Idle — Off Job' : 'Running'
  const x = rng()
  if (health < 68 && x < 0.14) return 'Breakdown'
  if (x < 0.62) return 'Running'
  if (x < 0.82) return 'Idle — On Job'
  if (x < 0.95) return 'Idle — Off Job'
  return 'Breakdown'
}
function pickWeighted(rng, weights) {
  const r = rng(); let acc = 0
  for (const k in weights) { acc += weights[k]; if (r <= acc) return k }
  return Object.keys(weights)[0]
}

// status timeline segments across the selected range (hover → start/end/duration)
export function assetTimeline(u, range, currentStatus) {
  const rng = mulberry(hash(`${u.id}|${dayKey(range.start)}|${dayKey(range.end)}|tl`) ^ 0x9c)
  const end = range.end.getTime()
  const segs = []
  let t = range.start.getTime()
  const weights = { 'Running': 0.55, 'Idle — On Job': 0.2, 'Idle — Off Job': 0.13, 'Breakdown': 0.12 }
  let guard = 0
  while (t < end && guard++ < 120) {
    const state = pickWeighted(rng, weights)
    const durH = state === 'Breakdown' ? 1 + rng() * 3.5 : 1.5 + rng() * 6
    const segEnd = Math.min(end, t + durH * 3600e3)
    segs.push({ state, start: new Date(t), end: new Date(segEnd), durMin: (segEnd - t) / 60000 })
    t = segEnd
  }
  if (segs.length) segs[segs.length - 1].state = currentStatus
  return segs
}

// a short sensor trend leading up to the current value (for the drill-down chart)
export function assetSensorTrend(u, sensor, points = 24) {
  const rng = mulberry(hash(`${u.id}|${sensor.key}|trend`) ^ 0x51)
  const arr = []
  for (let i = 0; i < points; i++) {
    const f = i / (points - 1)
    const base = sensor.value * (0.72 + 0.28 * f)          // drifts up toward the current reading
    arr.push(round(base * (0.94 + rng() * 0.12), 2))
  }
  arr[points - 1] = sensor.value
  return arr
}

const FAULT_MSGS = ['Overtemp warning', 'Vibration alarm', 'Low oil pressure', 'Coolant high', 'Overcurrent trip', 'Sensor fault', 'Brake wear', 'Filter clogged']
const MAINT_MSGS = ['250h service', 'Oil & filter change', 'Track/tyre inspection', 'Hydraulic service', 'Brake overhaul', 'Engine tune']
export function assetHistory(u, range) {
  const rng = mulberry(hash(`${u.id}|${dayKey(range.start)}|hist`) ^ 0x3f)
  const span = Math.max(1, (range.end - range.start))
  const dateIn = () => new Date(range.start.getTime() + rng() * span)
  const faults = Array.from({ length: Math.floor(rng() * 3) + (hash(u.id) % 100 < 42 ? 1 : 0) }, () => ({ at: dateIn(), msg: FAULT_MSGS[Math.floor(rng() * FAULT_MSGS.length)] })).sort((a, b) => b.at - a.at)
  const maintenance = Array.from({ length: 1 + Math.floor(rng() * 2) }, () => ({ at: dateIn(), msg: MAINT_MSGS[Math.floor(rng() * MAINT_MSGS.length)] })).sort((a, b) => b.at - a.at)
  const downtime = Array.from({ length: Math.floor(rng() * 3) }, () => ({ at: dateIn(), hours: round(0.5 + rng() * 5, 1), reason: FAULT_MSGS[Math.floor(rng() * FAULT_MSGS.length)] })).sort((a, b) => b.at - a.at)
  return { faults, maintenance, downtime }
}

// rosters
export const mobileFleet = () => UNITS.filter(u => MOBILE_TYPES.includes(u.type))
export function filterAssets(all, { mineId = 'all', areaId = 'all', equipTypeId = 'all' } = {}) {
  const side = sideOf(mineId)
  return all.filter(u =>
    (side === 'both' || u.side === side) &&
    (areaId === 'all' || u.area === areaId) &&
    (equipTypeId === 'all' || u.type === equipTypeId))
}
