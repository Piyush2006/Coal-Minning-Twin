// Seeded, deterministic series that back the two Use-Cases rows without an
// existing calc (Environmental Monitoring · Supply Chain & Logistics). Same
// mulberry(hash(dayKey·scope)) pattern as the rest of data/ — stable per reload,
// coherent per filter/date.
import { mulberry, hash, dayKey, scopeOf } from './rng'

const rngFor = (range, mineId, areaId, equipTypeId, salt) => {
  const scope = scopeOf({ mineId, areaId, equipTypeId })
  return { r: mulberry(hash(`${dayKey(range.end)}|${scope.key}|${salt}`)), factor: scope.factor }
}

// PM10 dust concentration (µg/m³) — intensive, does not scale with scope size.
// Sits in the elevated-but-below-action band (100–150 → amber) around ~144.
export function buildEnvironment({ range, mineId, areaId, equipTypeId }) {
  const { r } = rngFor(range, mineId, areaId, equipTypeId, 'pm10')
  const pm10 = Math.round(138 + r() * 10)         // 138–148 µg/m³ (action level 150)
  return { pm10 }
}

// ROM stockpile level (t) + rail dispatch rate (t/h) against their targets —
// both kept inside the ±5% "on-band" green window.
export function buildLogistics({ range, mineId, areaId, equipTypeId }) {
  const { r, factor } = rngFor(range, mineId, areaId, equipTypeId, 'logi')
  const stockTarget = Math.round(48000 * factor)
  const dispatchTarget = 650
  const stockpile = Math.round(stockTarget * (0.97 + r() * 0.05))   // −3%…+2%
  const dispatch = Math.round(dispatchTarget * (0.97 + r() * 0.05))
  return { stockpile, stockTarget, dispatch, dispatchTarget }
}
