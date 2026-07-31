// Session accumulators — "today" figures that build up while the project is
// open and survive switching between Dashboard and 3D Twin. Fed once per
// second from the same simulator tick; module-level so any view can read them.
import { recordParam } from './paramHistory'

const acc = {
  productionToday: 0,     // t, integral of crusher throughput
  tonnesToday: 0,         // t, plant product (blend throughput)
  rakesLoadedToday: 0,    // completed rail rakes
  shipTonnesToday: 0,     // t loaded to the ship
  startedAt: Date.now(),
  _rakeT: 0,
}
let started = false

export function tickAccumulators(objects) {
  const dt = 1 / 3600                                   // one tick ≈ 1 s → hours
  const crusher = Number(objects['crusher-1']?.parameters?.throughput) || 0
  const blend   = Number(objects['blend-1']?.parameters?.throughput) || 0
  acc.productionToday += crusher * dt
  acc.tonnesToday     += blend * dt
  acc.shipTonnesToday += (Number(objects['shiploader-1']?.parameters?.throughput) || blend * 0.4) * dt
  // a rail rake (4 wagons) completes roughly every ~95 s under load-out
  acc._rakeT += 1
  if (acc._rakeT >= 95) { acc._rakeT = 0; acc.rakesLoadedToday += 1 }
  started = true

  // headline-KPI sparkline histories (dashboard reads these)
  recordParam('dash', 'prodRate', crusher)
  recordParam('dash', 'workers', Number(objects['safety-1']?.parameters?.workersOnSite) || 0)
  recordParam('dash', 'proximity', Number(objects['safety-1']?.parameters?.minWorkerVehicleDistance) || 0)
  recordParam('dash', 'fleetRun', fleetRunning(objects).run)
  recordParam('dash', 'lowRul', lowestRul(objects).h)
  recordParam('dash', 'crusherTph', crusher)
  recordParam('dash', 'tonnes', acc.productionToday)
  recordParam('dash', 'sec', Number(objects['screen-1']?.parameters?.kwhPerTonne) || 0)
  recordParam('dash', 'pm10', Number(objects['pm-1']?.parameters?.pm10) || 0)
  recordParam('dash', 'stock', stockOnGround(objects))
}

export function getAcc() { return acc }
export function accStarted() { return started }
export function resetAccumulators() {
  acc.productionToday = acc.tonnesToday = acc.shipTonnesToday = acc.rakesLoadedToday = acc._rakeT = 0
  acc.startedAt = Date.now(); started = false
}

// ── shared derived helpers (used by cards + accumulators) ──
export function fleetRunning(objects) {
  const fleet = Object.values(objects).filter(o => ['haul_truck', 'mining_excavator', 'wheel_loader', 'blasthole_drill_rig'].includes(o.type))
  const run = fleet.filter(o => o.status === 'running').length
  return { run, total: fleet.length }
}
export function stockOnGround(objects) {
  return (Number(objects['pile-1']?.parameters?.stockTonnes) || 0) + (Number(objects['pile-2']?.parameters?.stockTonnes) || 0)
}
export function lowestRul(objects) {
  let h = Infinity, name = '—'
  for (const o of Object.values(objects)) {
    const r = Number(o.parameters?.rulHours)
    if (Number.isFinite(r) && r < h) { h = r; name = o.name }
  }
  return Number.isFinite(h) ? { h: Math.round(h), name } : { h: null, name: '—' }
}
export function worstVibration(objects) {
  let v = 0, name = '—'
  for (const o of Object.values(objects)) {
    const vv = Number(o.parameters?.vibration ?? o.parameters?.vibrationRms)
    if (Number.isFinite(vv) && vv > v) { v = vv; name = o.name }
  }
  return { v: Math.round(v * 10) / 10, name }
}
export function wagonsLoaded(objects) {
  return Object.values(objects).filter(o => o.type === 'coal_wagon' && (Number(o.parameters?.coalHeap ?? 1) > 0)).length
}
