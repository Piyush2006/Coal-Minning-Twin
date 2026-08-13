// Borehole dataset for the Depth Profile tool. Strata are generated
// deterministically per hole (seeded), then per-layer drilling metrics + the
// cumulative-depth progress curve are derived from the rock rates × rig factor.
import { mulberry, hash } from './rng'
import { ROCKS, rockRates } from './geology'

// rig efficiency multipliers (BD-02 is the newest/fastest, BD-03 the oldest)
const RIG_FACTOR = { 'BD-01': 1.0, 'BD-02': 1.12, 'BD-03': 0.9 }

export const BOREHOLES = [
  { id: 'BH-01', name: 'BH-01 · North Bench', rig: 'BD-02', area: 'pit', recordedDepth: 42 },
  { id: 'BH-02', name: 'BH-02 · North Bench', rig: 'BD-01', area: 'pit', recordedDepth: 38 },
  { id: 'BH-03', name: 'BH-03 · East Ramp',  rig: 'BD-03', area: 'pit', recordedDepth: 51 },
  { id: 'BH-04', name: 'BH-04 · East Ramp',  rig: 'BD-02', area: 'pit', recordedDepth: 47 },
  { id: 'BH-05', name: 'BH-05 · South Wall', rig: 'BD-01', area: 'pit', recordedDepth: 55 },
  { id: 'BH-06', name: 'BH-06 · South Wall', rig: 'BD-03', area: 'pit', recordedDepth: 44 },
]
export const BOREHOLE_OPTIONS = BOREHOLES.map(b => ({ id: b.id, name: b.name }))
export const boreholeById = (id) => BOREHOLES.find(b => b.id === id)

// A plausible top→bottom sequence; deeper holes reach basalt. Thicknesses are
// seeded and scaled to the hole's recorded depth (so survey ≈ recorded).
const SEQUENCE = ['soil', 'sandstone', 'shale', 'coal', 'limestone', 'basalt']

export function boreholeStrata(id) {
  const b = boreholeById(id)
  if (!b) return []
  const r = mulberry(hash(id + '|strata') ^ 0xB0)
  // raw weights per layer, then normalise to recordedDepth
  const raw = SEQUENCE.map((rock, i) => {
    const base = [0.14, 0.24, 0.2, 0.12, 0.16, 0.3][i]
    return { rock, w: base * (0.7 + r() * 0.7) }
  })
  const wtot = raw.reduce((a, x) => a + x.w, 0)
  let top = 0
  const strata = raw.map(x => {
    const thickness = Math.round((x.w / wtot) * b.recordedDepth * 10) / 10
    const layer = { rock: x.rock, top: Math.round(top * 10) / 10, bottom: Math.round((top + thickness) * 10) / 10, thickness }
    top += thickness
    return layer
  })
  return strata
}

// Full derived detail for a hole given its strata (generated OR an edited override).
export function boreholeDetail(id, strataOverride) {
  const b = boreholeById(id)
  const strata0 = strataOverride && strataOverride.length ? strataOverride : boreholeStrata(id)
  const rig = RIG_FACTOR[b?.rig] || 1
  const r = mulberry(hash(id + '|detail') ^ 0x17)

  let top = 0, timeH = 0, diesel = 0, costRs = 0
  const curve = [{ depth: 0, timeH: 0, diesel: 0 }]
  const strata = strata0.map((L, i) => {
    const thick = Math.max(0.1, L.thickness)
    const base = rockRates(L.rock)
    const wobble = 0.9 + r() * 0.2
    const rop = base.rop * rig * wobble
    const fuelPerM = base.fuelPerM / rig * (0.95 + r() * 0.1)
    const costPerM = base.costPerM * (0.96 + r() * 0.08)
    const hours = thick / rop
    const lDiesel = thick * fuelPerM
    const lCost = thick * costPerM
    top = Math.round((top + thick) * 10) / 10
    timeH += hours; diesel += lDiesel; costRs += lCost
    curve.push({ depth: top, timeH: Math.round(timeH * 100) / 100, diesel: Math.round(diesel) })
    return {
      rock: L.rock, top: Math.round((top - thick) * 10) / 10, bottom: top, thickness: Math.round(thick * 10) / 10,
      rop: Math.round(rop * 10) / 10, fuelPerM: Math.round(fuelPerM * 100) / 100, rpm: Math.round(base.rpm * (0.95 + r() * 0.1)),
      spp: Math.round(base.spp * (0.95 + r() * 0.1)), hookLoad: Math.round(base.hookLoad * (0.95 + r() * 0.1) * 10) / 10,
      hours: Math.round(hours * 10) / 10, costPerM: Math.round(costPerM),
    }
  })

  const depth = strata.length ? strata[strata.length - 1].bottom : 0
  const totals = {
    depth, hours: Math.round(timeH * 10) / 10, diesel: Math.round(diesel), costRs: Math.round(costRs),
    rop: timeH ? Math.round((depth / timeH) * 10) / 10 : 0,
    fuelIntensity: depth ? Math.round((diesel / depth) * 100) / 100 : 0,
  }
  const surveyDepth = depth
  const recordedDepth = b?.recordedDepth ?? depth
  const reliable = recordedDepth ? Math.abs(surveyDepth - recordedDepth) / recordedDepth <= 0.05 : true

  return { id, rig: b?.rig, name: b?.name, strata, curve, totals, surveyDepth, recordedDepth, reliable }
}

export { ROCKS }
