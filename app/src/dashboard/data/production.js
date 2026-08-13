// Raw per-day production "measured" signals (mock IoT). This layer produces
// SIGNALS only — tonnes, hours, kWh, litres, downtime — coherently linked so
// that a bad day (more downtime, slower rate) simultaneously lowers actual
// output, raises production loss, and worsens energy/fuel intensity. All KPI
// FORMULAS live in calc/production.js; UI never touches this file directly.
import { mulberry, hash, dayKey } from './rng'

export const DOWNTIME_REASONS = ['Mechanical', 'Electrical', 'Planned Maintenance', 'No Feed', 'Operational', 'Other']
const REASON_W = [0.30, 0.18, 0.16, 0.14, 0.14, 0.08]

// One coherent day for the given scope (whole op or a filtered subset).
// `plannedCoalForDay` (already scope-scaled) is the plan's target for this day,
// or null when no plan covers it — then the mine's capacity baseline sets the
// scale so the synthetic ACTUAL telemetry still looks right. `plannedShiftForDay`
// is a per-shift [s0,s1] planned split when the plan is shift-level.
export function productionDay(date, scope, s, plannedCoalForDay = null, plannedShiftForDay = null) {
  const r = mulberry(hash(`${dayKey(date)}|${scope.key}`) ^ 0xA17)
  const dow = date.getDay()

  // basis = what the day's ACTUAL output is generated around: the plan when it
  // covers this day, otherwise the mine's capacity baseline.
  const basis = plannedCoalForDay != null ? plannedCoalForDay : s.capacityPerDay * scope.factor
  const plannedOpH = s.plannedOperatingHoursPerDay
  const nominalRate = basis / plannedOpH                            // T/hr around which actual is built

  const bad = r() < 0.16                                            // ~1 in 6 days runs rough
  // downtime hours: baseline wear + a bad-day event + Sunday maintenance
  let downH = 0.6 + r() * 1.8 + (bad ? 2.4 + r() * 3.4 : 0) + (dow === 0 ? 1.4 + r() * 1.4 : 0)
  downH = Math.min(downH, plannedOpH * 0.55)
  const operatingHours = Math.max(plannedOpH * 0.35, plannedOpH - downH)

  // throughput efficiency (achieved rate vs the rate needed for plan)
  const rateEff = bad ? 0.82 + r() * 0.08 : 0.94 + r() * 0.10
  const actualRate = nominalRate * rateEff
  const actualTonnes = operatingHours * actualRate

  // production loss decomposition — sums to (basis − actual) on a shortfall day
  const lossDowntime = downH * nominalRate
  const lossThroughput = operatingHours * Math.max(0, nominalRate - actualRate)
  const lossOther = Math.max(0, basis - actualTonnes - lossDowntime - lossThroughput)

  // yield / recovery
  const yieldAct = s.nominalCoalYield * (0.985 + r() * 0.05) - (bad ? 1.6 : 0)   // %
  const saleable = actualTonnes
  const rawInput = saleable / (yieldAct / 100)

  // energy & fuel intensities drift up on bad days → worse kWh/T & L/T
  const energyPerTon = s.baseEnergyPerTon * (0.96 + r() * 0.09 + (bad ? 0.07 : 0))
  const fuelPerTon = s.baseFuelPerTon * (0.95 + r() * 0.11 + (bad ? 0.06 : 0))
  const kwh = saleable * energyPerTon
  const litres = saleable * fuelPerTon

  // manpower → man-shifts (→ man-hours) for labour intensity. Crew is ~stable
  // day to day, so a low-output day raises man-hours/ton (mh/T) naturally.
  const attend = 0.93 + r() * 0.06
  const manShiftsDay = s.plannedManpowerPerShift * 2 * attend * scope.factor

  // downtime by reason (minutes), normalised to the day's downtime
  const downMin = downH * 60
  const reasons = DOWNTIME_REASONS.map((name, i) => ({ name, min: REASON_W[i] * (0.7 + r() * 0.6) }))
  const wtot = reasons.reduce((a, x) => a + x.min, 0) || 1
  reasons.forEach(x => { x.min = (x.min / wtot) * downMin })

  // shift split (Shift 1 / Shift 2) — every extensive signal splits, so per-shift
  // throughput / yield / cost stay coherent while shift TOTALS genuinely differ.
  const s1 = 0.5 + (r() - 0.5) * 0.08
  // per-shift planned: use the plan's explicit shift split when present, else
  // fraction the day's plan (null when no plan covers the day).
  const shiftPlanned = (i, f) => {
    if (plannedShiftForDay && plannedShiftForDay[i] != null) return plannedShiftForDay[i]
    return plannedCoalForDay != null ? plannedCoalForDay * f : null
  }
  const mk = (i, f) => {
    const at = actualTonnes * f
    return {
      actualTonnes: at, plannedTonnes: shiftPlanned(i, f), kwh: kwh * f, litres: litres * f,
      downtimeMin: downMin * f, operatingHours: operatingHours * f, rawInput: at / (yieldAct / 100),
    }
  }

  return {
    date,
    plannedTonnes: plannedCoalForDay, actualTonnes, operatingHours, plannedOpHours: plannedOpH,
    rawInput, saleableTonnes: saleable, yieldAct, kwh, litres, manShifts: manShiftsDay,
    downtimeMin: downMin, downtimeReasons: reasons,
    loss: { downtime: lossDowntime, throughput: lossThroughput, other: lossOther },
    shifts: [
      { name: s.shift1?.name || 'Shift 1', ...mk(0, s1), manShifts: manShiftsDay / 2 },
      { name: s.shift2?.name || 'Shift 2', ...mk(1, 1 - s1), manShifts: manShiftsDay / 2 },
    ],
  }
}
