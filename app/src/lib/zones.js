// Zone model — the mine divided into six analytical zones, mapped from the
// existing namespace groups. Fixed order pit → power. Zone health, throughputs
// and membership all derive from the SAME live objects + alert rules the
// health wall and 3D rings use — no second source of truth.
import { paramStatus, bandStatus, worst } from './kpiStatus'
import { fleetRunning as _fleetRunning } from './accumulators'

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
  return zoneAssetIds(objects, zone).map(id => objects[id]).filter(Boolean)
}

// ── zone metrics (live) ─────────────────────────────────────────────────────
const num = (o, k) => Number(o?.parameters?.[k])
// Flow story: a single site rate cascades pit → power with small per-zone
// factor + lag so a downstream zone's in-rate tracks the upstream out-rate.
export function zoneThroughput(objects, zone) {
  const crusher = num(objects['crusher-1'], 'throughput') || 0
  const feed    = num(objects['chpp-1'], 'feedRate') || crusher
  const product = num(objects['blend-1'], 'throughput') || feed * 0.94
  const map = {
    pit:   { in: crusher * 1.02, out: crusher },
    proc:  { in: crusher, out: feed },
    yard:  { in: feed, out: product },
    rail:  { in: product * 0.6, out: product * 0.6 },
    port:  { in: product * 0.4, out: num(objects['shiploader-1'], 'throughput') || product * 0.4 },
    power: { in: (num(objects['power-1'], 'coalBurnRate') || 260), out: (num(objects['power-1'], 'generationMW') || 620) },
  }
  const m = map[zone.id] || { in: 0, out: 0 }
  return { in: Math.max(0, Math.round(m.in)), out: Math.max(0, Math.round(m.out)) }
}
export function zoneUtilization(objects, zone) {
  const assets = zoneAssets(objects, zone).filter(o => o.status)
  if (!assets.length) return 100
  const run = assets.filter(o => o.status === 'running').length
  return Math.round((run / assets.length) * 100)
}
export function zoneEnergy(objects, zone) {
  if (zone.energy === 'diesel') {
    let l = 0
    for (const o of zoneAssets(objects, zone)) if (o.status === 'running') l += num(o, 'fuelBurn') || 55
    return { value: Math.round(l), unit: 'L/h' }
  }
  const tph = zoneThroughput(objects, zone).out
  const sec = num(objects['screen-1'], 'kwhPerTonne') || 1.1
  const kwh = zone.id === 'power' ? (num(objects['power-1'], 'generationMW') || 620) * 1000 : Math.round(tph * sec)
  return { value: kwh, unit: zone.id === 'power' ? 'kWh out' : 'kWh' }
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
  if (zone.id === 'power') return { label: 'Generation', value: Math.round(num(objects['power-1'], 'generationMW') || 620), unit: 'MW' }
  if (zone.id === 'port') return { label: 'Ship fill', value: Math.min(100, Math.round(num(objects['ship-1'], 'cargoLoaded') || 0)), unit: '%' }
  return { label: 'Throughput', value: zoneThroughput(objects, zone).out, unit: 't/h' }
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
export function assetHeadlineParam(o) {
  for (const key of ['vibration', 'vibrationRms', 'engineHealth', 'rulHours', 'tyreTemp', 'pm10', 'throughput', 'kwhPerTonne']) {
    const v = Number(o.parameters?.[key]); if (Number.isFinite(v)) return { key, value: v }
  }
  const k = Object.keys(o.parameters || {})[0]
  return k ? { key: k, value: o.parameters[k] } : null
}
export function assetStatus(o) {
  const st = []
  for (const r of o.config?.alertRules ?? []) st.push(paramStatus(o, r.param))
  if (o.status === 'fault') st.push('red')
  return worst(st.length ? st : ['green'])
}
