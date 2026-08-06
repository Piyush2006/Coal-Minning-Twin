// Production KPIs — the FORMULAS. Consumes raw signals from data/production.js,
// aggregates over the selected range/scope, and applies the spec's formulas.
// Pure: given the same inputs it returns the same KPIs. UI calls buildProduction().
import { eachDay, scopeOf, fmtDay } from '../data/rng'
import { productionDay, DOWNTIME_REASONS } from '../data/production'
import { metric, achievementStatus } from './format'

export function buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings }) {
  const scope = scopeOf({ mineId, areaId, equipTypeId })
  const days = eachDay(range).map(d => productionDay(d, scope, settings))
  const sum = (f) => days.reduce((a, d) => a + f(d), 0)

  const actual = sum(d => d.actualTonnes)
  const planned = sum(d => d.plannedTonnes)
  const opHours = sum(d => d.operatingHours)
  const raw = sum(d => d.rawInput)
  const saleable = sum(d => d.saleableTonnes)
  const kwh = sum(d => d.kwh)
  const litres = sum(d => d.litres)
  const downtimeMin = sum(d => d.downtimeMin)

  // ── Production Plan vs Actual ──
  const achievementPct = planned ? (actual / planned) * 100 : 0

  // ── Throughput = tonnes processed / operating hours (T/hr) ──
  const throughput = metric(opHours ? saleable / opHours : 0, settings.targetThroughput, { goodIfHigh: true, band: 4 })

  // ── Coal Yield / Recovery = saleable / raw × 100 ──
  const yieldPct = raw ? (saleable / raw) * 100 : 0
  const yieldKpi = metric(yieldPct, settings.targetCoalYield, { goodIfHigh: true, band: 2 })

  // ── IoT-derived Operating Cost / Ton (measurable only — NOT full accounting) ──
  const elecCost = kwh * settings.electricityCostPerKwh
  const fuelCost = litres * settings.fuelCostPerLitre
  const measurableCost = elecCost + fuelCost
  const costPerTon = saleable ? measurableCost / saleable : 0
  // compared to plan for context, but flagged as measurable-only
  const costKpi = metric(costPerTon, settings.plannedCostPerTon, { goodIfHigh: false, band: 5 })

  // ── Efficiency intensities (kWh/T, L/T) — no separate cost KPIs by design ──
  const energyPerTon = saleable ? kwh / saleable : 0
  const energy = metric(energyPerTon, settings.targetEnergyPerTon, { goodIfHigh: false, band: 6 })
  const fuelPerTon = saleable ? litres / saleable : 0
  const fuel = metric(fuelPerTon, settings.targetFuelPerTon, { goodIfHigh: false, band: 6 })

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
    const plan = sum(d => d.shifts[i].plannedTonnes)
    const oh = sum(d => d.shifts[i].operatingHours)
    const rw = sum(d => d.shifts[i].rawInput)
    const kw = sum(d => d.shifts[i].kwh)
    const lt = sum(d => d.shifts[i].litres)
    const dmin = sum(d => d.shifts[i].downtimeMin)
    const cost = kw * settings.electricityCostPerKwh + lt * settings.fuelCostPerLitre
    return {
      name: shiftNames[i], actual: sale, planned: plan, achievementPct: plan ? (sale / plan) * 100 : 0,
      throughput: oh ? sale / oh : 0, yieldPct: rw ? (sale / rw) * 100 : 0, costPerTon: sale ? cost / sale : 0,
      energyPerTon: sale ? kw / sale : 0, fuelPerTon: sale ? lt / sale : 0, downtimeHours: dmin / 60,
    }
  })

  // ── Trend series (per day) for the Production vs Plan chart ──
  const categories = days.map(d => fmtDay(d.date))
  const trend = {
    categories,
    actual: days.map(d => Math.round(d.actualTonnes)),
    planned: days.map(d => Math.round(d.plannedTonnes)),
    shift1: days.map(d => Math.round(d.shifts[0].actualTonnes)),
    shift2: days.map(d => Math.round(d.shifts[1].actualTonnes)),
    shift1Name: days[0]?.shifts[0].name || 'Shift 1',
    shift2Name: days[0]?.shifts[1].name || 'Shift 2',
    energyPerTon: days.map(d => Math.round((d.kwh / d.saleableTonnes) * 100) / 100),
    fuelPerTon: days.map(d => Math.round((d.litres / d.saleableTonnes) * 1000) / 1000),
  }

  return {
    scope, days: days.length, shiftMode,
    totals: { actual, planned, opHours, raw, saleable, kwh, litres, downtimeMin, measurableCost, elecCost, fuelCost },
    achievement: { actual, planned, pct: achievementPct, status: achievementStatus(achievementPct) },
    throughput, yield: yieldKpi, cost: { ...costKpi, measurableCost, elecCost, fuelCost },
    energy, fuel,
    utilization: { pct: utilizationPct, downtimeHours, opHours, plannedHours },
    loss: { total: lossTotal, byCause: lossByCause },
    shifts, trend,
  }
}

export { DOWNTIME_REASONS }
