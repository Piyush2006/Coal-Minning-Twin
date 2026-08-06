// Fleet KPIs — current status of the mobile mining fleet + a per-vehicle row
// (status · health · utilisation · fuel/ton · alert). Utilisation over the
// selected period reuses the same per-unit model as Section 3.
import { eachDay } from '../data/rng'
import { mobileFleet, filterAssets, assetCondition } from '../data/assets'
import { unitStats } from '../data/equipment'

export function buildFleet({ range, mineId, areaId, equipTypeId, settings, overallUtil }) {
  const days = eachDay(range).length
  const units = filterAssets(mobileFleet(), { mineId, areaId, equipTypeId })
  const rows = units.map(u => {
    const c = assetCondition(u, settings)
    const util = Math.round(unitStats(u, overallUtil, days, settings).util)
    return { ...c, util }
  }).sort((a, b) => a.health - b.health)   // worst health first

  const counts = { total: rows.length, 'Running': 0, 'Idle — On Job': 0, 'Idle — Off Job': 0, 'Breakdown': 0 }
  for (const r of rows) counts[r.status] += 1
  const avgHealth = rows.length ? Math.round(rows.reduce((a, r) => a + r.health, 0) / rows.length) : 0
  return { rows, counts, avgHealth }
}
