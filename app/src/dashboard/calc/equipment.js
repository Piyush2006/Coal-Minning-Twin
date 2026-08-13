// Equipment KPIs — FORMULAS. Utilisation headline comes from production (Running
// / Planned), and the per-unit fleet breakdown is anchored on it so everything
// reconciles: utilisation-by-type, downtime-by-reason, and top contributors.
import { eachDay } from '../data/rng'
import { filterUnits, unitStats, DOWNTIME_REASONS } from '../data/equipment'

export function buildEquipment({ range, mineId, areaId, equipTypeId, settings, overallUtil }) {
  const days = eachDay(range).length
  const units = filterUnits({ mineId, areaId, equipTypeId })
  const perUnit = units.map(u => unitStats(u, overallUtil, days, settings))

  const plannedMin = perUnit.reduce((a, u) => a + u.plannedMin, 0)
  const runningMin = perUnit.reduce((a, u) => a + u.runningMin, 0)
  const downtimeMin = perUnit.reduce((a, u) => a + u.downtimeMin, 0)
  const utilizationPct = plannedMin ? (runningMin / plannedMin) * 100 : 0

  // utilisation by equipment type (planned-weighted mean)
  const byTypeMap = {}
  for (const u of perUnit) {
    const g = byTypeMap[u.type] || (byTypeMap[u.type] = { type: u.type, typeName: u.typeName, planned: 0, running: 0 })
    g.planned += u.plannedMin; g.running += u.runningMin
  }
  const byType = Object.values(byTypeMap)
    .map(g => ({ ...g, util: g.planned ? (g.running / g.planned) * 100 : 0 }))
    .sort((a, b) => b.util - a.util)

  // downtime by reason (hours), largest first
  const reasonMap = Object.fromEntries(DOWNTIME_REASONS.map(r => [r, 0]))
  for (const u of perUnit) for (const r of u.reasons) reasonMap[r.name] += r.min
  const byReason = DOWNTIME_REASONS
    .map(name => ({ name, hours: reasonMap[name] / 60 }))
    .sort((a, b) => b.hours - a.hours)

  // top equipment contributing to downtime (hours), largest first
  const topUnits = [...perUnit]
    .map(u => ({ id: u.id, typeName: u.typeName, area: u.area, hours: u.downtimeMin / 60, util: u.util }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8)

  return {
    unitCount: perUnit.length,
    utilizationPct,
    downtimeHours: downtimeMin / 60,
    byType,
    byReason,
    topUnits,
  }
}
