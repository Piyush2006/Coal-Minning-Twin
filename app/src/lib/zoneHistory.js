// Metric-history service — per zone, ring buffers at ~5 s resolution over the
// last 60 min (720 samples). Backfilled from the coherent mineModel (smooth
// drift, band ≈ ±8%), live ticks append. Alert history is SPARSE believable
// events (a few per hour with one cluster), not a solid wall, and agrees with
// current active counts. Plain capped arrays, ticked off the sim interval.
import { ZONES, zoneThroughput, zoneUtilization, zoneEnergy, zoneWorkers, zoneAlerts } from './zones'
import { getModel } from './mineModel'
import { evaluateAlerts } from './alertsEngine'

const CAP = 720, STEP_TICKS = 5
const METRICS = ['tout', 'util', 'energy']       // smooth numeric series
const buf = {}, alertBuf = {}, downtimeMin = {}
let tickN = 0, ready = false
const rnd = (n) => { const x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x) }

export function initZoneHistory(objects) {
  if (ready) return
  getModel(objects)
  const alerts = evaluateAlerts(objects)
  ZONES.forEach((z, zi) => {
    buf[z.id] = {}; downtimeMin[z.id] = 0
    const tout = zoneThroughput(objects, z).out, util = zoneUtilization(objects, z), en = zoneEnergy(objects, z).value
    const base = { tout, util, energy: en }
    for (const m of METRICS) {
      const arr = new Array(CAP)
      for (let i = 0; i < CAP; i++) {
        const tMin = (i - CAP) / 12                              // minutes ago (neg) → now
        const slow = Math.sin((tMin / 18) + zi) * 0.05 + Math.sin((tMin / 7) + zi * 2) * 0.02
        arr[i] = Math.max(0, Math.round(base[m] * (1 + slow) * 100) / 100)
      }
      buf[z.id][m] = arr
    }
    // sparse alert events over the hour: 3–8, plus one cluster; severity split
    const events = []
    const nEv = 3 + Math.floor(rnd(zi + 1) * 5)
    for (let e = 0; e < nEv; e++) {
      const at = Math.floor(rnd(zi * 7 + e) * CAP)
      events.push({ i: at, sev: rnd(zi + e * 3) < 0.3 ? 'crit' : 'warn' })
    }
    const clusterAt = Math.floor(CAP * (0.55 + rnd(zi) * 0.3))
    for (let c = 0; c < 3; c++) events.push({ i: clusterAt + c * 2, sev: rnd(zi + c) < 0.4 ? 'crit' : 'warn' })
    // reconcile the tail with CURRENT active alerts so the chart agrees
    const za = zoneAlerts(objects, z, alerts)
    for (let c = 0; c < za.crit; c++) events.push({ i: CAP - 1 - c, sev: 'crit' })
    for (let w = 0; w < za.warn; w++) events.push({ i: CAP - 2 - w, sev: 'warn' })
    alertBuf[z.id] = events
  })
  ready = true
}

export function tickZoneHistory(objects) {
  if (!ready) initZoneHistory(objects)
  for (const z of ZONES) {
    let down = 0
    for (const id in objects) {
      const o = objects[id]
      if (o.config?.hidden || !o.status) continue
      if ((z.groups.includes(o.parentId) || z.extra.includes(id)) && o.status !== 'running') down++
    }
    downtimeMin[z.id] += down / 60
  }
  if ((tickN++ % STEP_TICKS) !== 0) return
  const alerts = evaluateAlerts(objects)
  for (const z of ZONES) {
    const s = { tout: zoneThroughput(objects, z).out, util: zoneUtilization(objects, z), energy: zoneEnergy(objects, z).value }
    for (const m of METRICS) { const arr = buf[z.id][m]; arr.push(s[m]); if (arr.length > CAP) arr.shift() }
    // shift alert events left; append a tick if an active alert exists in-zone
    const evs = alertBuf[z.id].map(e => ({ i: e.i - 1, sev: e.sev })).filter(e => e.i >= 0)
    const za = zoneAlerts(objects, z, alerts)
    if (za.crit) evs.push({ i: CAP - 1, sev: 'crit' })
    else if (za.warn) evs.push({ i: CAP - 1, sev: 'warn' })
    alertBuf[z.id] = evs
  }
}

export function zoneSeries(zoneId, metric) { return buf[zoneId]?.[metric] ?? [] }
export function zoneAlertEvents(zoneId) { return alertBuf[zoneId] ?? [] }
export function zoneDowntimeMin(zoneId) { return Math.round(downtimeMin[zoneId] || 0) }
export function resetZoneHistory() { ready = false; tickN = 0; for (const k in downtimeMin) downtimeMin[k] = 0 }
