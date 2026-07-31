// Metric-history service — per zone, a ring buffer at ~5 s resolution covering
// the last 60 minutes (720 samples). Backfilled once on start with plausible
// synthetic history (seeded per zone so they differ believably), then live
// ticks append seamlessly. Cheap: plain capped arrays, one push + one shift
// per metric per 5 s. Independent of the 3D view.
import { ZONES, zoneThroughput, zoneUtilization, zoneEnergy, zoneWorkers, zoneAlerts } from './zones'
import { evaluateAlerts } from './alertsEngine'

const CAP = 720            // 60 min at 5 s
const STEP_TICKS = 5       // append every 5th sim tick (~5 s)
const METRICS = ['tin', 'tout', 'util', 'energy', 'warn', 'crit', 'workers']

// buf[zoneId][metric] = number[]
const buf = {}
const downtimeMin = {}     // zoneId → accumulated down-minutes this session
let tickN = 0, ready = false

const seeded = (seed) => { let x = Math.sin(seed * 999.13) * 43758.5453; return () => { x = Math.sin(x * 12.9898 + seed) * 43758.5453; return x - Math.floor(x) } }

export function initZoneHistory(objects) {
  if (ready) return
  const alerts = evaluateAlerts(objects)
  ZONES.forEach((z, zi) => {
    buf[z.id] = {}; downtimeMin[z.id] = 0
    const rnd = seeded(zi + 3)
    // anchor at the live value, walk BACKWARDS with drift + occasional spikes
    const t = zoneThroughput(objects, z), e = zoneEnergy(objects, z), a = zoneAlerts(objects, z, alerts)
    const anchor = { tin: t.in, tout: t.out, util: zoneUtilization(objects, z), energy: e.value, warn: a.warn, crit: a.crit, workers: zoneWorkers(objects, z) }
    for (const m of METRICS) {
      const arr = new Array(CAP)
      let v = anchor[m]
      for (let i = CAP - 1; i >= 0; i--) {
        arr[i] = Math.max(0, Math.round(v * 100) / 100)
        const wobble = (rnd() - 0.5) * (m === 'util' ? 6 : m === 'workers' ? 1.2 : anchor[m] * 0.06 + 1)
        const spike = rnd() < 0.03 ? (rnd() - 0.5) * (anchor[m] * 0.25 + 2) : 0
        v = Math.max(0, v - wobble - spike)          // going back in time
        if (m === 'warn' || m === 'crit') v = Math.max(0, Math.round(anchor[m] + (rnd() < 0.08 ? 1 : 0) - (rnd() < 0.05 ? 1 : 0)))
      }
      buf[z.id][m] = arr
    }
  })
  ready = true
}

export function tickZoneHistory(objects) {
  if (!ready) initZoneHistory(objects)
  // downtime accrues every second an in-zone asset is down
  for (const z of ZONES) {
    let down = 0
    for (const id in objects) {
      const o = objects[id]
      if (o.config?.hidden || !o.status) continue
      if (z.groups.includes(o.parentId) || z.extra.includes(id)) if (o.status !== 'running') down++
    }
    downtimeMin[z.id] += down / 60        // asset-seconds → asset-minutes
  }
  if ((tickN++ % STEP_TICKS) !== 0) return
  const alerts = evaluateAlerts(objects)
  for (const z of ZONES) {
    const t = zoneThroughput(objects, z), e = zoneEnergy(objects, z), a = zoneAlerts(objects, z, alerts)
    const s = { tin: t.in, tout: t.out, util: zoneUtilization(objects, z), energy: e.value, warn: a.warn, crit: a.crit, workers: zoneWorkers(objects, z) }
    for (const m of METRICS) { const arr = buf[z.id][m]; arr.push(s[m]); if (arr.length > CAP) arr.shift() }
  }
}

export function zoneSeries(zoneId, metric) { return buf[zoneId]?.[metric] ?? [] }
export function zoneDowntimeMin(zoneId) { return Math.round(downtimeMin[zoneId] || 0) }
export function zoneHistoryReady() { return ready }
export function resetZoneHistory() { ready = false; tickN = 0; for (const k in downtimeMin) downtimeMin[k] = 0 }
