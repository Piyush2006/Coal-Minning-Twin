// Operations dashboard — the 10 mining use cases as a FIXED-ORDER wall of KPI
// cards. Every value ticks live from the existing simulator; statuses come
// from the shared traffic-light engine (kpiStatus) so cards and 3D rings agree.
// Card definitions are code (KPI getters are functions of the live objects +
// session accumulators); no per-frame allocation happens here — getters are
// called at the 1 Hz sim cadence by the dashboard render.
import { paramStatus, bandStatus, worst } from './kpiStatus'
import { getAcc, fleetRunning, stockOnGround, lowestRul, worstVibration, wagonsLoaded } from './accumulators'

// emission + grid factors (config, not magic numbers)
export const FACTORS = { dieselKgPerL: 2.68, gridKgPerKwh: 0.82, bottleneckSpreadPct: 18 }

const n1 = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : '—')
const n0 = (v) => (Number.isFinite(+v) ? Math.round(+v) : '—')
const nk = (v) => (Number.isFinite(+v) ? Math.round(+v).toLocaleString() : '—')

// stage throughputs → the current bottleneck (lowest stage; amber if the
// spread between stages is wide)
function bottleneck(o) {
  const stages = [
    ['Pit',    (Number(o['exc-coal-1']?.parameters?.bucketPayload) || 0) * 60],  // rough t/h from bucket cycles
    ['Crusher', Number(o['crusher-1']?.parameters?.throughput) || 0],
    ['CHPP',    Number(o['chpp-1']?.parameters?.feedRate) || Number(o['screen-1']?.parameters?.feedRate) || 0],
    ['Load-out', Number(o['blend-1']?.parameters?.throughput) || 0],
  ].filter(s => s[1] > 0)
  if (!stages.length) return { name: '—', status: 'green' }
  let lo = stages[0], hi = stages[0]
  for (const s of stages) { if (s[1] < lo[1]) lo = s; if (s[1] > hi[1]) hi = s }
  const spread = hi[1] ? (hi[1] - lo[1]) / hi[1] * 100 : 0
  return { name: lo[0], status: spread > FACTORS.bottleneckSpreadPct ? 'amber' : 'green' }
}

export function fleetDiesel(o) {
  // sum truck+excavator fuel burn (L/h); fall back to a nominal per-unit rate
  let l = 0
  for (const x of Object.values(o)) {
    if (['haul_truck', 'mining_excavator', 'wheel_loader'].includes(x.type) && x.status === 'running') {
      l += Number(x.parameters?.fuelBurn) || 55
    }
  }
  return Math.round(l)
}

// A KPI: { key, label, unit, headline?, get(o)->value, status(o)->'green'|'amber'|'red' }
// Default status derives from paramStatus when {objId,param} given.
const P = (objId, param, label, unit, opts = {}) => ({
  key: `${objId}.${param}`, label, unit, headline: !!opts.headline, fmt: opts.fmt || n1,
  get: (o) => (opts.map ? opts.map(o) : o[objId]?.parameters?.[param]),
  status: (o) => (opts.band ? bandStatus(opts.map ? opts.map(o) : o[objId]?.parameters?.[param], opts.band)
    : (o[objId] ? paramStatus(o[objId], param) : 'green')),
  sub: opts.sub,
})

export const CARDS = [
  { id: 'ops', title: 'Mine Operations Optimization', tag: 'Optimization', focus: 'crusher-1', spark: 'prodRate', kpis: [
    P('crusher-1', 'throughput', 'Production rate', 't/h', { headline: true, fmt: nk }),
    P('chpp-1', 'feedRate', 'Plant feed', 't/h', { fmt: nk, map: o => o['chpp-1']?.parameters?.feedRate ?? o['screen-1']?.parameters?.feedRate }),
    P('exc-coal-1', 'engineLoad', 'Utilization', '%', { fmt: n0, band: { warn: 55, crit: 40, dir: 'low' } }),
    { key: 'bottleneck', label: 'Current bottleneck', unit: '', fmt: v => v, get: o => bottleneck(o).name, status: o => bottleneck(o).status },
  ] },
  { id: 'workers', title: 'Worker Monitoring', tag: 'Worker Safety', focus: 'safety-1', spark: 'workers', kpis: [
    P('safety-1', 'workersOnSite', 'Workers on site', '', { headline: true, fmt: n0 }),
    { key: 'zones', label: 'By zone (pit·plant·rail·port)', unit: '', fmt: v => v, get: o => {
        const s = o['safety-1']?.parameters || {}; return `${n0(s.workersPit)}·${n0(s.workersPlant)}·${n0(s.workersRail)}·${n0(s.workersPort)}` },
      status: () => 'green' },
    P('safety-1', 'unauthorizedEntriesToday', 'Unauthorized entries today', '', { fmt: n0, band: { warn: 1, crit: 4, dir: 'high' } }),
  ] },
  { id: 'proximity', title: 'Collision & Proximity Safety', tag: 'Proximity', focus: 'safety-1', spark: 'proximity', kpis: [
    P('safety-1', 'proximityAlertsToday', 'Proximity alerts today', '', { fmt: n0, band: { warn: 3, crit: 8, dir: 'high' } }),
    P('safety-1', 'geofenceViolationsToday', 'Geofence violations today', '', { fmt: n0, band: { warn: 2, crit: 6, dir: 'high' } }),
    P('safety-1', 'minWorkerVehicleDistance', 'Closest worker–vehicle', 'm', { headline: true, fmt: n0, band: { warn: 15, crit: 8, dir: 'low' } }),
  ] },
  { id: 'fleet', title: 'Fleet & Equipment', tag: 'Haulage', focus: 'truck-1', spark: 'fleetRun', kpis: [
    { key: 'fleetrun', label: 'Fleet running', unit: '', fmt: v => v, headline: true, get: o => { const f = fleetRunning(o); return `${f.run}/${f.total}` },
      status: o => { const f = fleetRunning(o); return f.run < f.total * 0.6 ? 'amber' : 'green' } },
    P('exc-coal-1', 'cycleTime', 'Avg cycle time', 's', { fmt: n0, band: { warn: 240, crit: 300, dir: 'high' } }),
    P('truck-1', 'idleTime', 'Idle', 'min', { fmt: n0 }),
    { key: 'fuel', label: 'Fleet fuel burn', unit: 'L/h', fmt: nk, get: o => fleetDiesel(o), status: () => 'green' },
  ] },
  { id: 'pdm', title: 'Predictive Maintenance', tag: 'HEMM PdM', focus: 'exc-ob-1', spark: 'lowRul', kpis: [
    { key: 'gar', label: 'Assets (green·amber·red)', unit: '', fmt: v => v, get: o => healthCounts(o).label, status: o => healthCounts(o).status },
    { key: 'rul', label: 'Lowest RUL', unit: 'h', fmt: v => v, headline: true, get: o => { const r = lowestRul(o); return r.h == null ? '—' : `${r.h}` },
      status: o => { const r = lowestRul(o); return r.h == null ? 'green' : r.h < 250 ? 'red' : r.h < 400 ? 'amber' : 'green' }, sub: o => lowestRul(o).name },
    { key: 'openpdm', label: 'Open PdM alerts', unit: '', fmt: n0, get: o => domainAlertCount(o, ['HEMM PdM', 'Vibration CBM']), status: () => 'green' },
  ] },
  { id: 'asset', title: 'Asset Performance', tag: 'Vibration CBM', focus: 'crusher-1', spark: 'crusherTph', kpis: [
    P('crusher-1', 'throughput', 'Crusher throughput', 't/h', { headline: true, fmt: nk }),
    { key: 'vib', label: 'Worst vibration', unit: 'mm/s', fmt: v => v, get: o => `${worstVibration(o).v}`, sub: o => worstVibration(o).name,
      status: o => bandStatus(worstVibration(o).v, { warn: 6, crit: 10, dir: 'high' }) },
    P('chpp-1', 'availability', 'CHPP availability', '%', { fmt: n0, band: { warn: 92, crit: 85, dir: 'low' }, map: o => o['chpp-1']?.parameters?.availability ?? 96 }),
  ] },
  { id: 'prod', title: 'Production & Productivity', tag: 'Optimization', focus: 'stacker-1', spark: 'tonnes', kpis: [
    { key: 'tday', label: 'Tonnes today', unit: 't', fmt: nk, headline: true, get: () => getAcc().productionToday, status: () => 'green' },
    { key: 'sog', label: 'Stock on ground', unit: 't', fmt: nk, get: o => stockOnGround(o), status: () => 'green' },
    { key: 'rakes', label: 'Rakes loaded today', unit: '', fmt: n0, get: () => getAcc().rakesLoadedToday, status: () => 'green' },
    P('ship-1', 'cargoLoaded', 'Ship fill', '%', { fmt: n0, map: o => shipFill(o), band: null }),
  ] },
  { id: 'energy', title: 'Energy & Sustainability', tag: 'Specific Energy', focus: 'screen-1', spark: 'sec', kpis: [
    P('screen-1', 'kwhPerTonne', 'Specific energy', 'kWh/t', { headline: true, fmt: n1 }),
    { key: 'diesel', label: 'Fleet diesel burn', unit: 'L/h', fmt: nk, get: o => fleetDiesel(o), status: () => 'green' },
    { key: 'co2', label: 'CO₂ today', unit: 't', fmt: n1, get: o => co2TodayT(o), status: () => 'green' },
  ] },
  { id: 'env', title: 'Environmental', tag: 'Dust & Env', focus: 'pm-1', spark: 'pm10', kpis: [
    P('pm-1', 'pm10', 'PM10 now', 'µg/m³', { headline: true, fmt: n0 }),
    P('pm-1', 'noise', 'Noise', 'dB(A)', { fmt: n0 }),
    { key: 'exc', label: 'Exceedances today', unit: '', fmt: n0, get: o => domainAlertCount(o, ['Dust & Env']), status: () => 'green' },
  ] },
  { id: 'supply', title: 'Supply Chain & Logistics', tag: 'Logistics', focus: 'loadout-1', spark: 'stock', kpis: [
    P('pile-1', 'stockTonnes', 'Stockpile A', 't', { headline: true, fmt: nk }),
    P('pile-2', 'stockTonnes', 'Stockpile B', 't', { fmt: nk }),
    { key: 'wag', label: 'Wagons loaded', unit: '/4', fmt: v => v, get: o => `${wagonsLoaded(o)}`, status: () => 'green' },
    P('ship-1', 'cargoLoaded', 'Ship fill', '%', { fmt: n0, map: o => shipFill(o) }),
  ] },
]

function shipFill(o) {
  const c = Number(o['ship-1']?.parameters?.cargoLoaded)
  return Number.isFinite(c) ? Math.min(100, Math.round(c)) : 0
}
function co2TodayT(o) {
  const acc = getAcc()
  const dieselL = fleetDiesel(o) * (acc.productionToday > 0 ? seconds(acc) / 3600 : 0)
  const kwh = acc.productionToday * (Number(o['screen-1']?.parameters?.kwhPerTonne) || 1)
  return (dieselL * FACTORS.dieselKgPerL + kwh * FACTORS.gridKgPerKwh) / 1000    // → tonnes
}
const seconds = (acc) => (Date.now() - acc.startedAt) / 1000
function healthCounts(o) {
  let g = 0, a = 0, r = 0
  for (const x of Object.values(o)) {
    const rul = Number(x.parameters?.rulHours); if (!Number.isFinite(rul)) continue
    if (rul < 250) r++; else if (rul < 400) a++; else g++
  }
  return { label: `${g}·${a}·${r}`, status: r ? 'red' : a ? 'amber' : 'green' }
}
export function domainAlertCount(objects, tags) {
  // counts active alerts whose useCase is in `tags`
  let n = 0
  for (const x of Object.values(objects)) {
    for (const rule of x.config?.alertRules ?? []) {
      if (!tags.includes(rule.useCase)) continue
      const v = Number(x.parameters?.[rule.param]); if (!Number.isFinite(v)) continue
      const t = rule.threshold
      const fires = rule.op === '>' ? v > +t : rule.op === '<' ? v < +t : Array.isArray(t) && v >= +t[0] && v <= +t[1]
      if (fires) n++
    }
  }
  return n
}

export function cardStatus(card, objects) { return worst(card.kpis.map(k => k.status(objects))) }
export function overallStatus(objects) { return worst(CARDS.map(c => cardStatus(c, objects))) }
export function attentionCount(objects) { return CARDS.filter(c => cardStatus(c, objects) !== 'green').length }
