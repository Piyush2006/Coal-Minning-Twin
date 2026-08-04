// The 10 monitoring use cases as SLIM tiles for the Overview rail — one number
// each, a status from the shared severity source, and a compact detail set for
// the click-popover. All values read the coherent mineModel + live objects.
import { paramStatus, bandStatus, worst, kpiBand } from './kpiStatus'
import { getModel, shipFillPct } from './mineModel'
import { fleetRunning, lowestRul, worstVibration, isMachine } from './accumulators'
import { getAlertLog } from './alertsEngine'

// TCS KPI bands (exact) shared with the ledger traffic-light renderer.
export const KPI_BANDS = {
  unauthorized:   { warn: 1, bad: 3, dir: 'high' },
  proximity:      { warn: 3, bad: 6, dir: 'high' },
  geofenceRate:   { warn: 1.0, bad: 3.0, dir: 'high' },
  closest:        { warn: 25, bad: 15, dir: 'low' },
  dieselIntensity:{ warn: 0.42, bad: 0.46, dir: 'high' },
  ppe:            { warn: 98, bad: 95, dir: 'low' },
}
const logCount = (tag) => getAlertLog().filter(e => e.useCase === tag).length

const num = (o, k) => Number(o?.parameters?.[k])
const n0 = (v) => (Number.isFinite(+v) ? Math.round(+v).toLocaleString() : '—')
const n1 = (v) => (Number.isFinite(+v) ? (Math.round(+v * 10) / 10).toLocaleString() : '—')

export function domainAlertCount(objects, tags, alerts) {
  return alerts.filter(a => tags.includes(a.useCase)).length
}
function healthCounts(objects) {
  let g = 0, a = 0, r = 0
  for (const o of Object.values(objects)) {
    if (!isMachine(o)) continue
    const rul = num(o, 'rulHours'); if (!Number.isFinite(rul)) continue
    if (rul < 250) r++; else if (rul < 400) a++; else g++
  }
  return { g, a, r, status: r ? 'red' : a ? 'amber' : 'green' }
}

// tile: { id, title, tag, focus, value(m,o), unit, status(m,o,alerts), detail(m,o)->rows }
export const TILES = [
  { id: 'ops', spark: null, title: 'Mine Operations', tag: 'Optimization', focus: 'crusher-1',
    value: (m) => (Math.abs(m.plan.deltaPct) <= 2 ? 'On plan' : `${m.plan.deltaPct > 0 ? '+' : ''}${m.plan.deltaPct.toFixed(1)}%`), unit: '',
    status: (m) => (m.bottleneck ? 'amber' : Math.abs(m.plan.deltaPct) > 8 ? 'amber' : 'green'),
    detail: (m) => [
      { label: 'ROM ex-pit', value: n0(m.rates.rom), unit: 't/h' },
      { label: 'Plant feed', value: n0(m.rates.chppFeed), unit: 't/h' },
      { label: 'Constraint', value: m.bottleneck ? cap(m.bottleneck) : 'None', unit: '', status: m.bottleneck ? 'amber' : 'green' },
      { label: 'vs plan', value: sgn(m.plan.deltaPct), unit: '%', status: m.plan.deltaPct < -8 ? 'amber' : 'green' },
    ] },
  { id: 'workers', spark: 'workers', title: 'Worker Monitoring', tag: 'Worker Safety', focus: 'exc-coal-1', vision: 'ppe',
    value: (m, o) => n0(num(o['safety-1'], 'workersOnSite')), unit: 'on site',
    status: (m, o, al) => worst([domainAlertCount(o, ['Worker Safety'], al) ? 'amber' : 'green', kpiBand(m.tcs.unauthorizedEntriesToday, KPI_BANDS.unauthorized), kpiBand(m.tcs.ppeCompliance, KPI_BANDS.ppe)]),
    detail: (m, o) => [
      { label: 'On site', value: n0(num(o['safety-1'], 'workersOnSite')), unit: '' },
      { label: 'Pit · Plant · Rail · Port', value: `${n0(num(o['safety-1'], 'workersPit'))}·${n0(num(o['safety-1'], 'workersPlant'))}·${n0(num(o['safety-1'], 'workersRail'))}·${n0(num(o['safety-1'], 'workersPort'))}`, unit: '' },
      { label: 'Unauthorized entries', value: n0(num(o['safety-1'], 'unauthorizedEntriesToday')), unit: 'today' },
    ] },
  { id: 'prox', spark: 'prox', title: 'Proximity Safety', tag: 'Proximity', focus: 'exc-coal-1', vision: 'lane',
    value: (m) => n0(m.tcs.proximityAlertsToday), unit: 'alerts today',
    status: (m) => worst([kpiBand(m.tcs.proximityAlertsToday, KPI_BANDS.proximity), kpiBand(m.tcs.closestApproach, KPI_BANDS.closest), kpiBand(m.tcs.geofenceRate, KPI_BANDS.geofenceRate)]),
    detail: (m, o) => [
      { label: 'Closest worker–vehicle', value: n0(num(o['safety-1'], 'minWorkerVehicleDistance')), unit: 'm', status: bandStatus(num(o['safety-1'], 'minWorkerVehicleDistance'), { warn: 15, crit: 8, dir: 'low' }) },
      { label: 'Proximity alerts', value: n0(num(o['safety-1'], 'proximityAlertsToday')), unit: 'today' },
      { label: 'Geofence violations', value: n0(num(o['safety-1'], 'geofenceViolationsToday')), unit: 'today' },
    ] },
  { id: 'fleet', spark: 'fleetFuel', title: 'Fleet & Equipment', tag: 'Haulage', focus: 'truck-1',
    value: (m) => `${m.fleet.running}/${m.fleet.total}`, unit: 'running',
    status: (m) => (m.fleet.running < m.fleet.total * 0.6 ? 'amber' : 'green'),
    detail: (m) => [
      { label: 'Fleet running', value: `${m.fleet.running}/${m.fleet.total}`, unit: '' },
      { label: 'Avg cycle time', value: m.fleet.cycleMin, unit: 'min' },
      { label: 'Utilization', value: m.fleet.utilPct, unit: '%', status: m.fleet.utilPct < 80 ? 'amber' : 'green' },
      { label: 'Fuel burn', value: n0(m.fleet.fuelLh), unit: 'L/h' },
    ] },
  { id: 'pdm', spark: 'rul', title: 'Predictive Maintenance', tag: 'HEMM PdM', focus: 'exc-ob-1',
    value: (m, o) => { const r = lowestRul(o); return r.h == null ? '—' : n0(r.h) }, unit: 'h RUL',
    status: (m, o) => { const r = lowestRul(o); return r.h == null ? 'green' : r.h < 250 ? 'red' : r.h < 400 ? 'amber' : 'green' },
    detail: (m, o) => { const r = lowestRul(o), h = healthCounts(o); return [
      { label: 'Lowest RUL', value: r.h == null ? '—' : n0(r.h), unit: 'h', sub: r.name, status: r.h != null && r.h < 250 ? 'red' : r.h != null && r.h < 400 ? 'amber' : 'green' },
      { label: 'Fleet health (G·A·R)', value: `${h.g}·${h.a}·${h.r}`, unit: '', status: h.status },
    ] } },
  { id: 'asset', spark: 'vib', title: 'Asset Performance', tag: 'Vibration CBM', focus: 'crusher-1', vision: 'coal',
    value: (m, o) => n1(worstVibration(o).v), unit: 'mm/s',
    status: (m, o) => bandStatus(worstVibration(o).v, { warn: 6, crit: 10, dir: 'high' }),
    detail: (m, o) => { const w = worstVibration(o); return [
      { label: 'Worst vibration', value: n1(w.v), unit: 'mm/s', sub: w.name, status: bandStatus(w.v, { warn: 6, crit: 10, dir: 'high' }) },
      { label: 'Crusher throughput', value: n0(m.rates.crusher), unit: 't/h' },
      { label: 'CHPP yield', value: n0(m.yield), unit: '%' },
    ] } },
  { id: 'prod', spark: 'prod', title: 'Production', tag: 'Optimization', focus: 'stacker-1',
    value: (m) => n0(m.today.production), unit: 't today',
    status: (m) => (m.plan.deltaPct < -8 ? 'amber' : 'green'),
    detail: (m) => [
      { label: 'Tonnes today', value: n0(m.today.production), unit: 't' },
      { label: 'Plan to now', value: n0(m.plan.toNow), unit: 't' },
      { label: 'vs plan', value: sgn(m.plan.deltaPct), unit: '%', status: m.plan.deltaPct < -8 ? 'amber' : 'green' },
      { label: 'Saleable product', value: n0(m.today.product), unit: 't' },
    ] },
  { id: 'energy', spark: 'dieselLh', title: 'Energy & Sustainability', tag: 'Specific Energy', focus: 'screen-1',
    value: (m) => n0(m.energy.dieselTodayL), unit: 'L',
    status: (m) => kpiBand(m.energy.dieselIntensity, KPI_BANDS.dieselIntensity),
    detail: (m) => [
      { label: 'Diesel today', value: n0(m.energy.dieselTodayL), unit: 'L' },
      { label: 'Diesel intensity', value: m.energy.dieselIntensity.toFixed(2), unit: 'L/t', status: kpiBand(m.energy.dieselIntensity, KPI_BANDS.dieselIntensity) },
      { label: 'CO₂ today', value: n1(m.energy.co2TodayT), unit: 't' },
      { label: 'CHPP specific energy', value: n1(m.energy.sec), unit: 'kWh/t' },
    ] },
  { id: 'env', spark: 'pm10', title: 'Environmental', tag: 'Dust & Env', focus: 'pm-1',
    value: (m, o) => n0(num(o['pm-1'], 'pm10')), unit: 'µg/m³ PM10',
    status: (m, o) => worst([paramStatus(o['pm-1'], 'pm10'), paramStatus(o['pm-2'], 'pm10')]),
    detail: (m, o) => [
      { label: 'PM10 (ROM pad)', value: n0(num(o['pm-1'], 'pm10')), unit: 'µg/m³', status: paramStatus(o['pm-1'], 'pm10') },
      { label: 'PM10 (stockyard)', value: n0(num(o['pm-2'], 'pm10')), unit: 'µg/m³', status: paramStatus(o['pm-2'], 'pm10') },
      { label: 'Noise', value: n0(num(o['pm-1'], 'noise')), unit: 'dB(A)' },
    ] },
  { id: 'supply', spark: 'stock', title: 'Supply Chain', tag: 'Logistics', focus: 'loadout-1',
    value: (m) => n0(m.stock.total), unit: 't stock',
    status: (m) => (m.stock.daysSupply < 1.5 ? 'amber' : 'green'),
    detail: (m, o) => [
      { label: 'Stock on ground', value: n0(m.stock.total), unit: 't' },
      { label: 'Days of supply', value: m.stock.daysSupply.toFixed(1), unit: 'days', status: m.stock.daysSupply < 1.5 ? 'amber' : 'green' },
      { label: 'Rail load-out', value: n0(m.rates.rail), unit: 't/h' },
      { label: 'Ship fill', value: shipFillPct(o), unit: '%' },
    ] },
]

const cap = (s) => ({ pit: 'Pit', crush: 'Crusher', chpp: 'CHPP', stock: 'Stockpile', rail: 'Rail', port: 'Port' }[s] || s)
const sgn = (v) => (v >= 0 ? '+' : '') + (Math.round(v * 10) / 10)

export function tileStatus(tile, m, objects, alerts) { return tile.status(m, objects, alerts) }

// ── Drawer KPI grids (client's named sets). Each returns {label,value,unit,st,cap}.
// st: traffic-light status; cap: threshold caption. Omits any KPI with no honest
// data source rather than inventing one.
const planTol = (d) => (Math.abs(d) <= 2 ? 'green' : Math.abs(d) <= 5 ? 'amber' : 'red')
const K = (label, value, unit, st, cap) => ({ label, value, unit, st: st || 'green', cap })
const faultCount = (o) => Object.values(o).filter(x => (Number(x.parameters?.faultCode) || 0) > 0).length
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

export function tileKpis(tile, m, o, pm10Series = []) {
  switch (tile.id) {
    case 'ops': return [
      K('Production vs plan', sgn(m.plan.deltaPct), '%', planTol(m.plan.deltaPct), 'target ±2%'),
      K('Throughput', n0(m.rates.crusher), 't/h', 'green', 'nominal 1,380 t/h'),
      K('Current bottleneck', m.bottleneck ? cap(m.bottleneck) : 'None', '', m.bottleneck ? 'amber' : 'green', 'flow constraint'),
      K('Plan pace', Math.round(m.plan.toNow > 0 ? (m.today.production / m.plan.toNow) * 100 : 100), '%', 'green', 'target 100%'),
    ]
    case 'workers': return [
      K('Workers on site', n0(num(o['safety-1'], 'workersOnSite')), '', 'green', 'headcount'),
      K('Unauthorized zone entries', n0(m.tcs.unauthorizedEntriesToday), 'today', kpiBand(m.tcs.unauthorizedEntriesToday, KPI_BANDS.unauthorized), '0 expected'),
      K('PPE compliance', m.tcs.ppeCompliance.toFixed(1), '%', kpiBand(m.tcs.ppeCompliance, KPI_BANDS.ppe), 'target ≥98%'),
      K('Workers in restricted zones', n0(m.tcs.workersInRestrictedNow), 'now', m.tcs.workersInRestrictedNow > 0 ? 'red' : 'green', '0 expected'),
    ]
    case 'prox': return [
      K('Proximity alerts', n0(m.tcs.proximityAlertsToday), 'today', kpiBand(m.tcs.proximityAlertsToday, KPI_BANDS.proximity), '0–2 acceptable'),
      K('Closest approach', n0(m.tcs.closestApproach), 'm', kpiBand(m.tcs.closestApproach, KPI_BANDS.closest), '>25 m clearance'),
      K('Geofence violation rate', m.tcs.geofenceRate.toFixed(1), '/100 veh-h', kpiBand(m.tcs.geofenceRate, KPI_BANDS.geofenceRate), '<1.0 target'),
      K('Vehicles in interaction zones', n0(m.tcs.vehiclesInInteraction), 'now', m.tcs.vehiclesInInteraction > 0 ? 'amber' : 'green', 'monitor'),
    ]
    case 'fleet': return [
      K('Units running', `${m.fleet.running}/${m.fleet.total}`, '', m.fleet.running < m.fleet.total * 0.6 ? 'amber' : 'green', 'mobile fleet'),
      K('Availability', Math.round((m.fleet.running / Math.max(1, m.fleet.total)) * 100), '%', 'green', 'target ≥90%'),
      K('Avg cycle time', m.fleet.cycleMin, 'min', 'green', 'target 18–24 min'),
      K('Idle time', Math.max(0, 100 - m.fleet.utilPct), '%', (100 - m.fleet.utilPct) > 22 ? 'amber' : 'green', 'target <20%'),
    ]
    case 'pdm': { const r = lowestRul(o); return [
      K('Lowest RUL', r.h == null ? '—' : n0(r.h), 'h', r.h != null && r.h < 250 ? 'red' : r.h != null && r.h < 400 ? 'amber' : 'green', 'plan below 400 h'),
      K('Assets with fault codes', n0(faultCount(o)), '', faultCount(o) > 0 ? 'amber' : 'green', '0 expected'),
      K('Open PdM alerts', n0(logCount('HEMM PdM')), 'today', logCount('HEMM PdM') > 0 ? 'amber' : 'green', 'session'),
    ] }
    case 'asset': { const w = worstVibration(o); return [
      K('Worst vibration', n1(w.v), 'mm/s', bandStatus(w.v, { warn: 6, crit: 10, dir: 'high' }), 'ISO zone <6 mm/s'),
      K('CV detections', n0(logCount('Conveyor Vision')), 'today', logCount('Conveyor Vision') > 0 ? 'amber' : 'green', 'session'),
      K('CHPP yield', n0(m.yield), '%', 'green', 'target ~75%'),
    ] }
    case 'prod': return [
      K('Tonnes today', n0(m.today.production), 't', 'green', 'ROM produced'),
      K('vs plan', sgn(m.plan.deltaPct), '%', planTol(m.plan.deltaPct), 'target ±2%'),
      K('ROM ex-pit', n0(m.rates.rom), 't/h', 'green', 'nominal 1,400 t/h'),
      K('CHPP product', n0(m.rates.product), 't/h', 'green', 'nominal 1,010 t/h'),
    ]
    case 'energy': return [
      K('Diesel today', n0(m.energy.dieselTodayL), 'L', 'green', 'mobile fleet'),
      K('Diesel intensity', m.energy.dieselIntensity.toFixed(2), 'L/t', kpiBand(m.energy.dieselIntensity, KPI_BANDS.dieselIntensity), 'target 0.40 L/t'),
      K('CO₂ today', n1(m.energy.co2TodayT), 't', 'green', 'diesel + grid'),
      K('CHPP specific energy', n1(m.energy.sec), 'kWh/t', 'green', 'target 1.05 kWh/t'),
    ]
    case 'env': { const pm10 = num(o['pm-1'], 'pm10'); const avg = pm10Series.length ? mean(pm10Series) : pm10; const exc = pm10Series.filter(v => v > 150).length; return [
      K('PM10 now', n0(pm10), 'µg/m³', paramStatus(o['pm-1'], 'pm10'), 'limit 150 µg/m³'),
      K('PM10 24h avg', n0(avg), 'µg/m³', avg > 150 ? 'amber' : 'green', 'limit 150 µg/m³'),
      K('Exceedances', n0(exc), 'today', exc > 0 ? 'amber' : 'green', '0 expected'),
      K('Dust suppression', num(o['pm-1'], 'suppressionActive') > 0 ? 'On' : 'Off', '', num(o['pm-1'], 'suppressionActive') > 0 ? 'green' : 'amber', 'active during haul'),
    ] }
    case 'supply': return [
      K('Stock on ground', n0(m.stock.total), 't', 'green', `${m.stock.daysSupply.toFixed(1)} days supply`),
      K('Stock trend', `${m.stock.trend >= 0 ? '+' : ''}${n0(m.rates.product - m.rates.rail)}`, 't/h', 'green', 'product − rail'),
      K('Rail dispatch', n0(m.rates.rail), 't/h', 'green', 'nominal 1,000 t/h'),
      K('Port loading', n0(m.rates.ship), 't/h', 'green', 'while berthed'),
    ]
    default: return []
  }
}

// ONE overall-status selector: derived from the live alerts array ONLY.
// any critical → red · any warn → amber · none → green. Every consumer
// (header dot, glance) reads this — no parallel derivations.
export function overallStatus(alerts) {
  return alerts.some(a => a.severity === 'critical') ? 'red' : alerts.length ? 'amber' : 'green'
}

// FIX 4 — every alert tag maps to exactly ONE ledger row (no orphans).
export const ALERT_ROW_MAP = {
  'HEMM PdM': 'pdm',
  'Vibration CBM': 'asset', 'Conveyor Vision': 'asset',
  'Haulage': 'fleet', 'TPMS': 'fleet',
  'CHP SEC': 'energy',
  'Dust & Env': 'env',
  'Worker Safety': 'workers',
  'Proximity': 'prox', 'Geofence': 'prox',
  'Logistics': 'supply', 'Rail': 'supply', 'Shiploading': 'supply',
  'Optimization': 'ops', 'Production': 'prod',
}
const _warned = new Set()
export function rowAlertsFor(tileId, alerts) {
  const out = []
  for (const a of alerts) {
    const row = ALERT_ROW_MAP[a.useCase]
    if (row === undefined && !_warned.has(a.useCase)) { _warned.add(a.useCase); console.warn(`[dashboard] active alert tag "${a.useCase}" has no ledger-row mapping`) }
    if (row === tileId) out.push(a)
  }
  return out
}
