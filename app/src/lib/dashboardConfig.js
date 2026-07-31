// The 10 monitoring use cases as SLIM tiles for the Overview rail — one number
// each, a status from the shared severity source, and a compact detail set for
// the click-popover. All values read the coherent mineModel + live objects.
import { paramStatus, bandStatus, worst } from './kpiStatus'
import { getModel, shipFillPct } from './mineModel'
import { fleetRunning, lowestRul, worstVibration, isMachine } from './accumulators'

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
  { id: 'ops', spark: 'flow_pit', title: 'Mine Operations', tag: 'Optimization', focus: 'crusher-1',
    value: (m) => (m.bottleneck ? cap(m.bottleneck) : 'On plan'), unit: '',
    status: (m) => (m.bottleneck ? 'amber' : Math.abs(m.plan.deltaPct) > 8 ? 'amber' : 'green'),
    detail: (m) => [
      { label: 'ROM ex-pit', value: n0(m.rates.rom), unit: 't/h' },
      { label: 'Plant feed', value: n0(m.rates.chppFeed), unit: 't/h' },
      { label: 'Constraint', value: m.bottleneck ? cap(m.bottleneck) : 'None', unit: '', status: m.bottleneck ? 'amber' : 'green' },
      { label: 'vs plan', value: sgn(m.plan.deltaPct), unit: '%', status: m.plan.deltaPct < -8 ? 'amber' : 'green' },
    ] },
  { id: 'workers', spark: 'workers', title: 'Worker Monitoring', tag: 'Worker Safety', focus: 'exc-coal-1', vision: 'ppe',
    value: (m, o) => n0(num(o['safety-1'], 'workersOnSite')), unit: 'on site',
    status: (m, o, al) => (domainAlertCount(o, ['Worker Safety'], al) ? 'amber' : 'green'),
    detail: (m, o) => [
      { label: 'On site', value: n0(num(o['safety-1'], 'workersOnSite')), unit: '' },
      { label: 'Pit · Plant · Rail · Port', value: `${n0(num(o['safety-1'], 'workersPit'))}·${n0(num(o['safety-1'], 'workersPlant'))}·${n0(num(o['safety-1'], 'workersRail'))}·${n0(num(o['safety-1'], 'workersPort'))}`, unit: '' },
      { label: 'Unauthorized entries', value: n0(num(o['safety-1'], 'unauthorizedEntriesToday')), unit: 'today' },
    ] },
  { id: 'prox', spark: 'prox', title: 'Proximity Safety', tag: 'Proximity', focus: 'exc-coal-1', vision: 'lane',
    value: (m, o) => n0(num(o['safety-1'], 'minWorkerVehicleDistance')), unit: 'm min',
    status: (m, o) => bandStatus(num(o['safety-1'], 'minWorkerVehicleDistance'), { warn: 15, crit: 8, dir: 'low' }),
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
  { id: 'energy', spark: 'sec', title: 'Energy & Sustainability', tag: 'Specific Energy', focus: 'screen-1',
    value: (m) => n1(m.energy.co2TodayT), unit: 't CO₂',
    status: () => 'green',
    detail: (m) => [
      { label: 'Specific energy', value: n1(m.energy.sec), unit: 'kWh/t' },
      { label: 'Fleet diesel', value: n0(m.energy.dieselLh), unit: 'L/h' },
      { label: 'CO₂ today', value: n1(m.energy.co2TodayT), unit: 't' },
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
export function overallStatus(m, objects, alerts) { return worst(TILES.map(t => tileStatus(t, m, objects, alerts))) }
export function attentionCount(m, objects, alerts) { return TILES.filter(t => tileStatus(t, m, objects, alerts) !== 'green').length }
