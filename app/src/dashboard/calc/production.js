// Production KPIs — the FORMULAS. Consumes raw signals from data/production.js,
// aggregates over the selected range/scope, and applies the spec's formulas.
// Pure: given the same inputs it returns the same KPIs. UI calls buildProduction().
import { eachDay, scopeOf, fmtDay, dayKey } from '../data/rng'
import { productionDay, DOWNTIME_REASONS } from '../data/production'
import { metric, achievementStatus, recoveryStatus } from './format'
import { planForRange } from './plan'

// Intensity KPI with a plan target when present, else value-only (neutral, no
// target line / variance) so the tile still renders before a plan is uploaded.
const intensity = (actual, target, band) =>
  target != null ? metric(actual, target, { goodIfHigh: false, band }) : { actual, status: 'normal' }

export function buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }) {
  const scope = scopeOf({ mineId, areaId, equipTypeId })
  const pl = planForRange(plan, range, scope, settings)
  const days = eachDay(range).map(d =>
    productionDay(d, scope, settings, pl.plannedByDay[dayKey(d)] ?? null, pl.plannedShiftByDay[dayKey(d)] ?? null))
  const sum = (f) => days.reduce((a, d) => a + f(d), 0)

  const actual = sum(d => d.actualTonnes)
  const planned = pl.plannedCoal                     // from the operational plan (0 when no plan)
  const opHours = sum(d => d.operatingHours)
  const raw = sum(d => d.rawInput)
  const saleable = sum(d => d.saleableTonnes)
  const kwh = sum(d => d.kwh)
  const litres = sum(d => d.litres)
  const manShifts = sum(d => d.manShifts)
  const downtimeMin = sum(d => d.downtimeMin)

  // ── Production Plan vs Actual — only when the plan covers this range ──
  const achievement = pl.hasPlan && planned
    ? { actual, planned, pct: (actual / planned) * 100, status: achievementStatus((actual / planned) * 100), coveredDays: pl.coveredDays, totalDays: pl.totalDays }
    : null

  // ── Throughput = tonnes processed / operating hours (T/hr). Target is DERIVED
  //    from the plan (planned coal/day ÷ planned operating hours); none without a plan ──
  const throughputActual = opHours ? saleable / opHours : 0
  const throughput = pl.throughputTarget != null
    ? metric(throughputActual, pl.throughputTarget, { goodIfHigh: true, band: 4 })
    : { actual: throughputActual, status: 'normal' }

  // ── Coal Recovery = saleable / raw × 100. No target — the site maximises it;
  //    status reflects absolute recovery quality (higher is better). ──
  const yieldPct = raw ? (saleable / raw) * 100 : 0
  const yieldKpi = { actual: yieldPct, status: recoveryStatus(yieldPct) }

  // ── IoT-derived Operating Cost / Ton (measurable only — NOT full accounting) ──
  const elecCost = kwh * settings.electricityCostPerKwh
  const fuelCost = litres * settings.fuelCostPerLitre
  const measurableCost = elecCost + fuelCost
  const costPerTon = saleable ? measurableCost / saleable : 0
  // compared to the planned cost/ton input for context, but flagged as measurable-only
  const costKpi = metric(costPerTon, settings.plannedCostPerTon, { goodIfHigh: false, band: 5 })

  // ── Efficiency intensities (kWh/T, L/T) — targets come from the plan ──
  const energyPerTon = saleable ? kwh / saleable : 0
  const energy = intensity(energyPerTon, pl.energyTarget, 6)
  const fuelPerTon = saleable ? litres / saleable : 0
  const fuel = intensity(fuelPerTon, pl.fuelTarget, 6)

  // ── Labour intensity = man-hours ÷ saleable tonnes (mh/T, lower is better) ──
  const manHours = manShifts * settings.hoursPerManShift
  const manHoursPerTon = saleable ? manHours / saleable : 0
  const labour = intensity(manHoursPerTon, pl.manpowerTarget, 6)

  // ── Equipment utilisation = Running time / Planned operating time (NOT availability) ──
  const plannedHours = settings.plannedOperatingHoursPerDay * days.length
  const utilizationPct = plannedHours ? (opHours / plannedHours) * 100 : 0
  const downtimeHours = downtimeMin / 60

  // ── Production Loss by cause. Scaled so the three causes sum EXACTLY to the
  //    net gap (planned − actual), i.e. the headline Gap — numbers reconcile. ──
  const rawDown = sum(d => d.loss.downtime)
  const rawThr = sum(d => d.loss.throughput)
  const rawOther = sum(d => d.loss.other)
  const rawTotal = rawDown + rawThr + rawOther
  const netGap = Math.max(0, planned - actual)
  const k = rawTotal > 0 ? netGap / rawTotal : 0
  const lossTotal = netGap
  const lossByCause = [
    { cause: 'Equipment Downtime', value: rawDown * k },
    { cause: 'Low Throughput', value: rawThr * k },
    { cause: 'Other Operational Loss', value: rawOther * k },
  ].sort((a, b) => b.value - a.value)

  // ── Per-shift aggregates (for the shift-wise toggle) ──
  const shiftNames = [days[0]?.shifts[0].name || 'Shift 1', days[0]?.shifts[1].name || 'Shift 2']
  const shifts = [0, 1].map(i => {
    const sale = sum(d => d.shifts[i].actualTonnes)
    const plnd = sum(d => d.shifts[i].plannedTonnes || 0)
    const oh = sum(d => d.shifts[i].operatingHours)
    const rw = sum(d => d.shifts[i].rawInput)
    const kw = sum(d => d.shifts[i].kwh)
    const lt = sum(d => d.shifts[i].litres)
    const dmin = sum(d => d.shifts[i].downtimeMin)
    const ms = sum(d => d.shifts[i].manShifts)
    const cost = kw * settings.electricityCostPerKwh + lt * settings.fuelCostPerLitre
    return {
      name: shiftNames[i], actual: sale, planned: plnd, achievementPct: plnd ? (sale / plnd) * 100 : null,
      throughput: oh ? sale / oh : 0, yieldPct: rw ? (sale / rw) * 100 : 0, costPerTon: sale ? cost / sale : 0,
      energyPerTon: sale ? kw / sale : 0, fuelPerTon: sale ? lt / sale : 0, downtimeHours: dmin / 60,
      manHoursPerTon: sale ? (ms * settings.hoursPerManShift) / sale : 0,
    }
  })

  // ── Per-day cost & consumption breakdown (the detail behind Operating Cost /
  //    Ton). Mixed units by design: Operating Cost & Fuel Cost in ₹, Ton in
  //    tonnes, Energy in kWh, Man-Hours in hours. Each day carries a total plus a
  //    per-shift split so the modal can render a shift-grouped header. ──
  const eRate = settings.electricityCostPerKwh, fRate = settings.fuelCostPerLitre, hrs = settings.hoursPerManShift
  const costRow = (o) => {
    const fuelCostD = o.litres * fRate
    return { opCost: o.kwh * eRate + fuelCostD, ton: o.saleableTonnes ?? o.actualTonnes, energyKwh: o.kwh, manHours: o.manShifts * hrs, fuelCost: fuelCostD }
  }
  const costByDay = days.map(d => ({
    date: fmtDay(d.date),
    total: costRow(d),
    shifts: [costRow(d.shifts[0]), costRow(d.shifts[1])],
  }))

  // ── Trend series (per day) for the Production vs Plan chart ──
  const categories = days.map(d => fmtDay(d.date))
  const trend = {
    categories,
    actual: days.map(d => Math.round(d.actualTonnes)),
    planned: days.map(d => d.plannedTonnes != null ? Math.round(d.plannedTonnes) : null),
    shift1: days.map(d => Math.round(d.shifts[0].actualTonnes)),
    shift2: days.map(d => Math.round(d.shifts[1].actualTonnes)),
    shift1Name: days[0]?.shifts[0].name || 'Shift 1',
    shift2Name: days[0]?.shifts[1].name || 'Shift 2',
    energyPerTon: days.map(d => Math.round((d.kwh / d.saleableTonnes) * 100) / 100),
    fuelPerTon: days.map(d => Math.round((d.litres / d.saleableTonnes) * 1000) / 1000),
    manHoursPerTon: days.map(d => Math.round((d.manShifts * settings.hoursPerManShift / d.saleableTonnes) * 1000) / 1000),
  }

  return {
    scope, days: days.length, shiftMode,
    plan: { hasPlan: pl.hasPlan, level: pl.level, coveredDays: pl.coveredDays, totalDays: pl.totalDays },
    totals: { actual, planned, opHours, raw, saleable, kwh, litres, manShifts, manHours, downtimeMin, measurableCost, elecCost, fuelCost },
    achievement,
    throughput, yield: yieldKpi, cost: { ...costKpi, measurableCost, elecCost, fuelCost },
    energy, fuel, manHours: labour,
    targets: { energy: pl.energyTarget, fuel: pl.fuelTarget, manHours: pl.manpowerTarget },
    utilization: { pct: utilizationPct, downtimeHours, opHours, plannedHours },
    loss: { total: lossTotal, byCause: lossByCause },
    shifts, trend, costByDay,
  }
}

export { DOWNTIME_REASONS }
