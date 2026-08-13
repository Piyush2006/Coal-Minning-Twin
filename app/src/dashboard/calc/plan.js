// Plan aggregation — turns the stored operational plan into the planned values
// the KPI layer needs for the selected global range + filter scope.
//
// The plan may be monthly / daily / shift-wise; this expands it to a per-day
// planned-coal map, sums the covered days, and derives the intensity targets
// (Energy/T, Fuel/T, Man-Hours/T) as a planned-tonnage-weighted average. Extensive
// quantities (coal, overburden) scale by scope.factor exactly like the actuals;
// intensive targets do not. All output is memo-friendly and pure.
import { eachDay, dayKey } from '../data/rng'

const TARGET_KEYS = ['energyTarget', 'fuelTarget', 'manpowerTarget']
const monthOf = (dk) => dk.slice(0, 7)                        // "YYYY-MM-DD" → "YYYY-MM"
const daysInMonth = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate() }

// Index the stored rows once into daily / shift / monthly lookups.
function indexPlan(rows) {
  const byDay = {}, byDayShift = {}, byMonth = {}
  for (const r of rows) {
    if (r.plannedCoal == null) continue
    if (r.shift === 0 || r.shift === 1) {
      (byDayShift[r.period] ||= {})[r.shift] = r
    } else if (r.isMonth) {
      byMonth[r.period] = r
    } else {
      byDay[r.period] = r
    }
  }
  return { byDay, byDayShift, byMonth }
}

// Planned figures for a single calendar day at whole-op scale (pre scope.factor),
// or null if the plan does not cover that day. Returns coal, ob, per-shift coal
// (when shift-level) and the day's intensity targets.
function dayPlan(dk, idx) {
  const sh = idx.byDayShift[dk]
  if (sh) {
    const s0 = sh[0], s1 = sh[1]
    const coal = (s0?.plannedCoal || 0) + (s1?.plannedCoal || 0)
    const ob = (s0?.plannedOB || 0) + (s1?.plannedOB || 0)
    const out = { coal, ob: ob || null, shiftCoal: [s0?.plannedCoal ?? null, s1?.plannedCoal ?? null], targets: {} }
    // coal-weighted average of the shift targets
    for (const k of TARGET_KEYS) {
      let num = 0, den = 0
      for (const s of [s0, s1]) { if (s && s[k] != null) { num += s[k] * (s.plannedCoal || 0); den += (s.plannedCoal || 0) } }
      out.targets[k] = den ? num / den : (s0?.[k] ?? s1?.[k] ?? null)
    }
    return out
  }
  const d = idx.byDay[dk]
  if (d) return { coal: d.plannedCoal, ob: d.plannedOB ?? null, shiftCoal: null, targets: pick(d) }
  const m = idx.byMonth[monthOf(dk)]
  if (m) { const div = daysInMonth(monthOf(dk)); return { coal: m.plannedCoal / div, ob: m.plannedOB != null ? m.plannedOB / div : null, shiftCoal: null, targets: pick(m) } }
  return null
}
const pick = (r) => ({ energyTarget: r.energyTarget ?? null, fuelTarget: r.fuelTarget ?? null, manpowerTarget: r.manpowerTarget ?? null })

export function planForRange(plan, range, scope, settings) {
  const empty = {
    hasPlan: false, level: null, coveredDays: 0, totalDays: 0, plannedCoal: 0, plannedOB: 0,
    plannedByDay: {}, plannedShiftByDay: {}, energyTarget: null, fuelTarget: null, manpowerTarget: null, throughputTarget: null,
  }
  if (!plan || !plan.rows || !plan.rows.length) return empty

  const idx = indexPlan(plan.rows)
  const f = scope.factor
  const days = eachDay(range)
  const plannedByDay = {}, plannedShiftByDay = {}
  let plannedCoal = 0, plannedOB = 0, covered = 0
  // weighted-target accumulators
  const tNum = { energyTarget: 0, fuelTarget: 0, manpowerTarget: 0 }
  const tDen = { energyTarget: 0, fuelTarget: 0, manpowerTarget: 0 }

  for (const d of days) {
    const dk = dayKey(d)
    const dp = dayPlan(dk, idx)
    if (!dp) continue
    covered++
    const coal = dp.coal * f
    plannedByDay[dk] = coal
    plannedCoal += coal
    if (dp.ob != null) plannedOB += dp.ob * f
    if (dp.shiftCoal) plannedShiftByDay[dk] = dp.shiftCoal.map(v => v == null ? null : v * f)
    for (const k of TARGET_KEYS) {
      if (dp.targets[k] != null) { tNum[k] += dp.targets[k] * dp.coal; tDen[k] += dp.coal }
    }
  }

  const wavg = (k) => (tDen[k] > 0 ? tNum[k] / tDen[k] : null)
  const throughputTarget = covered > 0 && settings.plannedOperatingHoursPerDay
    ? (plannedCoal / covered) / settings.plannedOperatingHoursPerDay : null

  return {
    hasPlan: covered > 0, level: plan.level, coveredDays: covered, totalDays: days.length,
    plannedCoal, plannedOB, plannedByDay, plannedShiftByDay,
    energyTarget: wavg('energyTarget'), fuelTarget: wavg('fuelTarget'), manpowerTarget: wavg('manpowerTarget'),
    throughputTarget,
  }
}
