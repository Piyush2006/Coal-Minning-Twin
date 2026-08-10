// Primary-crusher (CHPP) per-day signals — feed/product size, energy, throughput.
// The three crusher KPIs are all intensive ratios (reduction ratio, power/ton,
// feed rate), so they don't scale with the filter scope; scope only seeds the RNG
// for deterministic-yet-varying values. A "rough" day lowers throughput, coarsens
// the product (lower reduction ratio) and lifts power/ton — coherently.
import { mulberry, hash, dayKey } from './rng'

// Internal performance targets (not user inputs).
export const CRUSHER_TARGETS = { reductionRatio: 7, powerPerTon: 0.6, feedRate: 1000 }

export function crusherDay(date, scope) {
  const r = mulberry(hash(`${dayKey(date)}|${scope.key}|crush`) ^ 0xC0)
  const bad = r() < 0.16

  const opHours = Math.max(14, 20 - (bad ? 3 + r() * 3 : r() * 2))            // h/day the crusher ran
  const feedRate = 1000 * (0.94 + r() * 0.12) - (bad ? 90 : 0)                // T/hr
  const fed = feedRate * opHours                                             // T fed that day
  const processed = fed * (0.985 + r() * 0.01)                              // T through (slight fines/moisture loss)

  const feedSize = 950 + r() * 160                                          // mm — ROM top size in
  const productSize = 140 + r() * 40 + (bad ? 20 : 0)                       // mm — product top size out (coarser on bad days)

  const powerPerTon = 0.6 * (0.9 + r() * 0.16) + (bad ? 0.08 : 0)           // kWh/T
  const energyKwh = powerPerTon * processed                                // total kWh that day

  return { opHours, feedRate, fed, processed, feedSize, productSize, energyKwh }
}
