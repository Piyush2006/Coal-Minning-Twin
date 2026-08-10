// Thickener KPIs — underflow density (% solids) and overflow turbidity (NTU)
// aggregated over the range, each vs its configured target, plus per-day trends.
import { eachDay, scopeOf, fmtDay } from '../data/rng'
import { thickenerDay, THICKENER } from '../data/thickener'
import { metric } from './format'

export function buildThickener({ range, mineId, areaId, equipTypeId }) {
  const scope = scopeOf({ mineId, areaId, equipTypeId })
  const dates = eachDay(range)
  const days = dates.map(d => thickenerDay(d, scope))
  const sum = (f) => days.reduce((a, d) => a + f(d), 0)
  const avg = (f) => (days.length ? sum(f) / days.length : 0)

  // Underflow Density = solids mass / total underflow slurry mass × 100
  const solids = sum(d => d.solidsMass), slurry = sum(d => d.slurryMass)
  const density = slurry ? (solids / slurry) * 100 : 0
  const underflowDensity = metric(density, THICKENER.targetDensity, { goodIfHigh: true, band: 6 })

  // Overflow Turbidity (NTU) — lower is better vs the configured target
  const turbidity = avg(d => d.turbidity)
  const overflowTurbidity = metric(turbidity, THICKENER.targetTurbidity, { goodIfHigh: false, band: 12 })

  return {
    underflowDensity, overflowTurbidity, targets: THICKENER,
    solids, slurry,
    trend: {
      categories: dates.map(d => fmtDay(d)),
      density: days.map(d => Math.round((d.solidsMass / d.slurryMass) * 1000) / 10),
      turbidity: days.map(d => Math.round(d.turbidity * 10) / 10),
    },
  }
}
