// Crusher KPIs — reduction ratio, power/ton, feed rate — aggregated over the
// selected range, each compared to its target, plus per-day trends. Pure.
import { eachDay, scopeOf, fmtDay } from '../data/rng'
import { crusherDay, CRUSHER_TARGETS } from '../data/crusher'
import { metric } from './format'

export function buildCrusher({ range, mineId, areaId, equipTypeId }) {
  const scope = scopeOf({ mineId, areaId, equipTypeId })
  const dates = eachDay(range)
  const days = dates.map(d => crusherDay(d, scope))
  const sum = (f) => days.reduce((a, d) => a + f(d), 0)
  const avg = (f) => (days.length ? sum(f) / days.length : 0)

  // Reduction Ratio = avg feed size / avg product size
  const feedSize = avg(d => d.feedSize)
  const productSize = avg(d => d.productSize)
  const rr = productSize ? feedSize / productSize : 0

  // Power / Ton = total crusher energy / coal processed
  const energy = sum(d => d.energyKwh)
  const processed = sum(d => d.processed)
  const ppt = processed ? energy / processed : 0

  // Feed Rate = coal fed / operating hours
  const fed = sum(d => d.fed)
  const opHours = sum(d => d.opHours)
  const fr = opHours ? fed / opHours : 0

  return {
    reductionRatio: metric(rr, CRUSHER_TARGETS.reductionRatio, { goodIfHigh: true, band: 8 }),
    powerPerTon: metric(ppt, CRUSHER_TARGETS.powerPerTon, { goodIfHigh: false, band: 8 }),
    feedRate: metric(fr, CRUSHER_TARGETS.feedRate, { goodIfHigh: true, band: 6 }),
    targets: CRUSHER_TARGETS,
    feedSize, productSize, energy, processed, fed, opHours,
    trend: {
      categories: dates.map(d => fmtDay(d)),
      feedRate: days.map(d => Math.round(d.feedRate)),
      powerPerTon: days.map(d => Math.round((d.energyKwh / d.processed) * 100) / 100),
      reductionRatio: days.map(d => Math.round((d.feedSize / d.productSize) * 10) / 10),
    },
  }
}
