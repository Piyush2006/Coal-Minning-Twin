// Zone model — the mine divided into six analytical zones, mapped from the
// existing namespace groups. Fixed order pit → power. Zone health, throughputs
// and membership all derive from the SAME live objects + alert rules the
// health wall and 3D rings use — no second source of truth.
import { paramStatus, worst } from './kpiStatus'
import { isMachine } from './accumulators'
import { getModel } from './mineModel'

// each zone: member group ids (assets under them) + extra attached asset ids,
// a fly-to focus, the headline metric, and its energy flavour.
export const ZONES = [
  { id: 'pit',    name: 'Pit',                 groups: ['grp_mine', 'grp_drillblast', 'grp_extraction', 'grp_haulage', 'grp_pitcivil'], extra: ['pm-1'], focus: 'exc-coal-1', energy: 'diesel' },
  { id: 'proc',   name: 'Processing (CHPP)',   groups: ['grp_chpp', 'grp_crushing', 'grp_washing', 'grp_water'], extra: [], focus: 'crusher-1', energy: 'kwh' },
  { id: 'yard',   name: 'Stockyard & Blending', groups: ['grp_yard'], extra: ['pm-2'], focus: 'stacker-1', energy: 'kwh' },
  { id: 'rail',   name: 'Rail Load-Out',       groups: ['grp_rail'], extra: [], focus: 'loadout-1', energy: 'diesel' },
  { id: 'port',   name: 'Port & Shipping',     groups: ['grp_port'], extra: [], focus: 'shiploader-1', energy: 'kwh' },
  { id: 'power',  name: 'Power Station',       groups: ['grp_enduse'], extra: [], focus: 'power-1', energy: 'kwh' },
]
export const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]))
const WORKER_KEY = { pit: 'workersPit', proc: 'workersPlant', yard: 'workersPlant', rail: 'workersRail', port: 'workersPort', power: 'workersPort' }

// asset ids that belong to a zone (skip hidden data-only carriers)
export function zoneAssetIds(objects, zone) {
  const set = new Set(zone.extra)
  for (const id in objects) {
    const o = objects[id]
    if (o.config?.hidden) continue
    if (zone.groups.includes(o.parentId)) set.add(id)
  }
  return [...set]
}
export function zoneAssets(objects, zone) {
  return zoneAssetIds(objects, zone).map(id => objects[id]).filter(o => o && isMachine(o))
}

// ── zone metrics (live) ─────────────────────────────────────────────────────
const num = (o, k) => Number(o?.parameters?.[k])
// Flow story: a single site rate cascades pit → power with small per-zone
// factor + lag so a downstream zone's in-rate tracks the upstream out-rate.
export function zoneThroughput(objects, zone) {
  const r = getModel(objects).rates
  const map = {
    pit:   { in: r.rom * 1.0, out: r.crusher },
    proc:  { in: r.crusher, out: r.chppFeed },
    yard:  { in: r.product, out: r.rail + r.ship },
    rail:  { in: r.rail, out: r.rail },
    port:  { in: r.ship, out: r.ship },
    power: { in: r.power, out: r.power },
  }
  const m = map[zone.id] || { in: 0, out: 0 }
  return { in: Math.max(0, Math.round(m.in)), out: Math.max(0, Math.round(m.out)) }
}
const ZONE_UTIL_OFFSET = { pit: 2, proc: -3, yard: 4, rail: -5, port: 1, power: 5 }
export function zoneUtilization(objects, zone) {
  const assets = zoneAssets(objects, zone)
  const runFrac = assets.length ? assets.filter(o => o.status === 'running').length / assets.length : 1
  const base = getModel(objects).fleet.utilPct + (ZONE_UTIL_OFFSET[zone.id] || 0)   // 78–96 drift, never pinned
  return Math.round(Math.max(40, Math.min(96, base * (0.85 + 0.15 * runFrac))))
}
// energy intensity — comparable units: diesel zones L/t, plant zones kWh/t
export function zoneEnergy(objects, zone) {
  const m = getModel(objects)
  const tph = Math.max(1, zoneThroughput(objects, zone).out)
  if (zone.energy === 'diesel') {
    const share = zone.id === 'pit' ? m.fleet.fuelLh : m.fleet.fuelLh * 0.12
    return { value: Math.round((share / tph) * 10) / 10, unit: 'L/t', abs: Math.round(share), absUnit: 'L/h' }
  }
  return { value: Math.round(m.energy.sec * 100) / 100, unit: 'kWh/t', abs: Math.round(tph * m.energy.sec), absUnit: 'kWh' }
}
export function zoneWorkers(objects, zone) {
  return Math.round(num(objects['safety-1'], WORKER_KEY[zone.id]) || 0)
}
export function zoneAlerts(objects, zone, alerts) {
  const ids = new Set(zoneAssetIds(objects, zone))
  // the safety monitor is hidden but its Proximity/Worker alerts belong to the Pit
  if (zone.id === 'pit') ids.add('safety-1')
  const za = alerts.filter(a => ids.has(a.objId))
  return { list: za, warn: za.filter(a => a.severity === 'warn').length, crit: za.filter(a => a.severity === 'critical').length }
}
// zone health = worst asset status (rings) OR firing zone alert — same source
export function zoneStatus(objects, zone, alerts) {
  const za = zoneAlerts(objects, zone, alerts)
  if (za.crit) return 'red'
  let st = za.warn ? 'amber' : 'green'
  const statuses = [st]
  for (const o of zoneAssets(objects, zone)) {
    for (const r of o.config?.alertRules ?? []) statuses.push(paramStatus(o, r.param))
    if (o.status === 'fault') statuses.push('red')
  }
  return worst(statuses)
}
export function zoneHeadline(objects, zone) {
  const m = getModel(objects)
  switch (zone.id) {
    case 'pit':   return { label: 'ROM', value: Math.round(m.rates.rom), unit: 't/h' }
    case 'proc':  return { label: 'Yield', value: Math.round(m.yield), unit: '%', sub: `${Math.round(m.rates.chppFeed)} t/h` }
    case 'yard':  return { label: 'Stock', value: Math.round(m.stock.total).toLocaleString(), unit: 't', sub: `${m.stock.daysSupply.toFixed(1)} days` }
    case 'rail':  return { label: 'Load-out', value: Math.round(m.rates.rail), unit: 't/h' }
    case 'port':  return { label: 'Ship fill', value: Math.min(100, Math.round(num(objects['ship-1'], 'cargoLoaded') || 0)), unit: '%', sub: `${Math.round(m.today.ship).toLocaleString()} t` }
    case 'power': return { label: 'Generation', value: Math.round(num(objects['power-1'], 'generationMW') || 620), unit: 'MW' }
    default: return { label: 'Throughput', value: zoneThroughput(objects, zone).out, unit: 't/h' }
  }
}
// worst assets in a zone, ranked by firing severity then vibration/health proxy
export function topProblemAssets(objects, zone, alerts, n = 3) {
  const sevMap = {}
  for (const a of alerts) sevMap[a.objId] = a.severity === 'critical' ? 2 : Math.max(sevMap[a.objId] || 0, 1)
  const scored = zoneAssets(objects, zone).map(o => {
    let s = (sevMap[o.id] || 0) * 100
    const vib = num(o, 'vibration') ?? num(o, 'vibrationRms'); if (Number.isFinite(vib)) s += vib
    const rul = num(o, 'rulHours'); if (Number.isFinite(rul)) s += Math.max(0, (500 - rul) / 20)
    if (o.status === 'fault') s += 50
    return { o, s }
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n)
  return scored.map(x => x.o)
}
const PARAM_META = {
  vibration: ['Vibration', 'mm/s'], vibrationRms: ['Vibration', 'mm/s'], engineHealth: ['Health', '/100'],
  rulHours: ['RUL', 'h'], tyreTemp: ['Tyre', '°C'], pm10: ['PM10', 'µg/m³'], throughput: ['Rate', 't/h'], kwhPerTonne: ['SEC', 'kWh/t'],
}
export function assetHeadlineParam(o) {
  for (const key of Object.keys(PARAM_META)) {
    const v = Number(o.parameters?.[key]); if (Number.isFinite(v)) return { key, value: v, label: PARAM_META[key][0], unit: PARAM_META[key][1] }
  }
  const k = Object.keys(o.parameters || {})[0]
  return k ? { key: k, value: o.parameters[k], label: k, unit: '' } : null
}
export function assetStatus(o) {
  const st = []
  for (const r of o.config?.alertRules ?? []) st.push(paramStatus(o, r.param))
  if (o.status === 'fault') st.push('red')
  return worst(st.length ? st : ['green'])
}
