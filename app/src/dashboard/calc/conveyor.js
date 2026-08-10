// Conveyor-belt KPIs — belt loading, belt-speed deviation, and vision anomalies
// (with an active count) aggregated over the selected range, plus per-day trends.
import { eachDay, scopeOf, fmtDay } from '../data/rng'
import { conveyorDay, CONVEYOR } from '../data/conveyor'
import { metric } from './format'

// speed deviation is a "closer to zero is better" metric (target 0), so it can't
// use the ratio-based metric() — classify by absolute deviation instead.
const deviationStatus = (d) => { const a = Math.abs(d); return a <= 2 ? 'positive' : a <= 5 ? 'normal' : a <= 8 ? 'warning' : 'critical' }
const ACTIVE_WINDOW_MS = 2 * 86400e3

export function buildConveyor({ range, mineId, areaId, equipTypeId }) {
  const scope = scopeOf({ mineId, areaId, equipTypeId })
  const dates = eachDay(range)
  const days = dates.map(d => conveyorDay(d, scope))
  const avg = (f) => (days.length ? days.reduce((a, d) => a + f(d), 0) / days.length : 0)

  const loading = avg(d => d.loadingPct)
  const beltLoading = metric(loading, CONVEYOR.targetLoading, { goodIfHigh: true, band: 8 })

  const dev = avg(d => d.speedDev)
  const speedDeviation = { actual: dev, status: deviationStatus(dev) }

  // anomalies — newest first; "active" = detected within the last 2 days of the range
  const cutoff = range.end.getTime() - ACTIVE_WINDOW_MS
  const anomalies = days.flatMap(d => d.events).sort((a, b) => b.ts - a.ts).map(e => ({ ...e, active: e.ts >= cutoff }))
  const activeCount = anomalies.filter(e => e.active).length
  const bySeverity = ['Critical', 'High', 'Medium', 'Low'].map(s => ({ severity: s, count: anomalies.filter(e => e.severity === s).length }))

  return {
    beltLoading, speedDeviation, targets: CONVEYOR,
    anomalies: anomalies.slice(0, 120), anomalyTotal: anomalies.length, activeCount, bySeverity,
    trend: {
      categories: dates.map(d => fmtDay(d)),
      loading: days.map(d => Math.round(d.loadingPct * 10) / 10),
      speedDev: days.map(d => Math.round(d.speedDev * 10) / 10),
    },
  }
}
