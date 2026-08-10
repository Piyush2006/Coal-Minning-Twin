// Depth Profile calc — cross-borehole comparison KPIs, historical per-rock
// baselines (for Predict), and the local prediction fallback. Pure functions.
import { BOREHOLES, boreholeDetail } from '../data/boreholes'
import { ROCKS } from '../data/geology'

// Compare selected holes → per-hole totals + time/diesel curves, with the
// "best" hole flagged for each KPI (fastest ROP, lowest fuel intensity).
export function buildDepthCompare(ids, strataByHole = {}) {
  const holes = ids.map(id => {
    const d = boreholeDetail(id, strataByHole[id])
    return {
      id, name: d.name, rig: d.rig, totals: d.totals,
      curveTime: d.curve.map(p => [p.timeH, p.depth]),
      curveDiesel: d.curve.map(p => [p.diesel, p.depth]),
    }
  })
  let bestROP = null, bestFuel = null
  for (const h of holes) {
    if (!bestROP || h.totals.rop > bestROP.totals.rop) bestROP = h
    if (!bestFuel || (h.totals.fuelIntensity > 0 && h.totals.fuelIntensity < bestFuel.totals.fuelIntensity)) bestFuel = h
  }
  return { holes, bestROP, bestFuel }
}

// Average observed per-rock rates across ALL boreholes — the historical table
// used by Predict (sent to Bruce and used by the local fallback).
export function rockBaselines() {
  const agg = {}
  for (const b of BOREHOLES) {
    for (const L of boreholeDetail(b.id).strata) {
      const a = agg[L.rock] || (agg[L.rock] = { rop: 0, fuelPerM: 0, costPerM: 0, n: 0 })
      a.rop += L.rop; a.fuelPerM += L.fuelPerM; a.costPerM += L.costPerM; a.n += 1
    }
  }
  const out = {}
  for (const rock of Object.keys(ROCKS)) {
    const a = agg[rock]
    out[rock] = a && a.n
      ? { rop: round(a.rop / a.n, 1), fuelPerM: round(a.fuelPerM / a.n, 2), costPerM: Math.round(a.costPerM / a.n) }
      : null
  }
  return out
}

// Deterministic local forecast from planned layers + baselines. Used as the
// fallback whenever the Bruce call fails, so Predict always renders.
export function predictLocal(plannedLayers, baselines) {
  let top = 0, hours = 0, diesel = 0, costRs = 0
  const curve = [{ depth: 0, timeH: 0, diesel: 0 }]
  const perLayer = plannedLayers.filter(l => l.rock && l.thickness > 0).map(l => {
    const b = baselines[l.rock] || { rop: 12, fuelPerM: 3, costPerM: 500 }
    const t = l.thickness
    const lh = t / b.rop, ld = t * b.fuelPerM, lc = t * b.costPerM
    top = round(top + t, 1); hours += lh; diesel += ld; costRs += lc
    curve.push({ depth: top, timeH: round(hours, 2), diesel: Math.round(diesel) })
    return { rock: l.rock, thicknessM: t, hours: round(lh, 1), diesel: Math.round(ld), costRs: Math.round(lc) }
  })
  const depthM = top
  return {
    source: 'estimate',
    perLayer,
    totals: {
      depthM, hours: round(hours, 1), diesel: Math.round(diesel), costRs: Math.round(costRs),
      rop: hours ? round(depthM / hours, 1) : 0, fuelIntensity: depthM ? round(diesel / depthM, 2) : 0,
    },
    curve,
    rationale: 'Estimated from historical average rates per rock type.',
  }
}

const round = (n, dp) => { const f = 10 ** dp; return Math.round(n * f) / f }
