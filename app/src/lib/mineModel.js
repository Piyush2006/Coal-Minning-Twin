// mineModel — ONE coherent operating model the whole dashboard reads. Nominal
// design rates + a slow physically-consistent drift, mass-balanced pit→port,
// with integrating "today" counters and stockpile levels. Everything (Overview,
// Zone Analytics, history, KPIs) derives from here, so numbers agree.
//
// Ticked once per second off the existing sim interval. getModel() returns a
// cheap computed snapshot; the integrators (today, stock, downtime) live in
// module state seeded as if the shift started SHIFT_START_H hours ago.
import { fleetRunning, lowestRul, worstVibration } from './accumulators'
import { recordParam, getParamHistory } from './paramHistory'

// ── config: nominal rates (t/h) + plan + factors ──
export const SHIP_CAPACITY = 82000   // t — used for ship fill %
export function shipFillPct(objects) {
  const c = Number(objects?.['ship-1']?.parameters?.cargoLoaded) || 0
  return Math.min(100, Math.max(0, Math.round((c / SHIP_CAPACITY) * 100)))
}
export const NOM = {
  romExPit: 1400, crusherOut: 1380, chppFeed: 1350, product: 1010, rejects: 340,
  railOut: 1000, shipLoad: 2500, powerBurn: 320, yield: 0.75,
}
export const CFG = {
  dailyPlan: 16800,        // t ROM / 12 h shift → coherent with romExPit
  shiftHours: 12, shiftStartH: 6,
  stock0: { A: 46000, B: 38000 }, stockMin: 18000, stockMax: 120000,
  truckFuelLh: 210,        // nominal per running truck
  cycleMin: 21,            // nominal haul cycle (minutes)
  utilNom: 88,             // % target utilisation
  dieselKgPerL: 2.68, gridKgPerKwh: 0.82, secKwhPerT: 1.05,
  shipBerthed: true,
}

const H = 3600
let S = null            // integrator state

// smooth drift around a nominal: slow sine + micro-noise + occasional step.
// Deterministic in tH so backfill and live agree. Band ≈ ±8%.
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
export function drift(nominal, seed, tH, amp = 0.06) {
  const slow = Math.sin(tH * (0.6 + seed * 0.11) + seed * 1.7) * amp
  const fast = Math.sin(tH * (2.3 + seed * 0.05) + seed) * amp * 0.35
  const step = (Math.floor(tH * 1.5 + seed) % 11 === 0) ? amp * 0.6 : 0
  const noise = (hash(Math.floor(tH * 360) + seed * 10) - 0.5) * amp * 0.25
  return nominal * (1 + slow + fast - step + noise)
}

// live rates at elapsed hours tH, mass-balanced (downstream ≤ upstream).
// ── 24 h plan profile: 30,000 t/day; shift changeovers 05:30–06:30 and
// 17:30–18:30 at 35% of base; blast window 14:00–14:30 at 0; 30-min ramps
// back to base. planCumulative() is the normalized integral (t from midnight).
export const DAY_PLAN_T = 30000
export function dayRate(h) {
  const ramp = (a, b, from, to) => from + ((h - a) / (b - a)) * (to - from)
  if (h >= 5.5 && h < 6.5) return 0.35
  if (h >= 6.5 && h < 7) return ramp(6.5, 7, 0.35, 1)
  if (h >= 14 && h < 14.5) return 0
  if (h >= 14.5 && h < 15) return ramp(14.5, 15, 0, 1)
  if (h >= 17.5 && h < 18.5) return 0.35
  if (h >= 18.5 && h < 19) return ramp(18.5, 19, 0.35, 1)
  return 1
}
// Prefix-sum cache on the fixed 0.05 grid — arithmetic-order-identical to the
// original loop (sequential full steps + the same half-step partial term), so
// results match to FP-accumulation noise. ~18k iterations per hero-curve build
// become ~50 O(1) lookups.
const _intStep = 0.05
const _intCum = [0]                    // _intCum[n] = integral over [0, n*step]
function dayIntegralRaw(h) {
  const n = Math.max(0, Math.min(480, Math.floor(h / _intStep + 1e-9)))
  while (_intCum.length <= n) {
    const i = _intCum.length
    _intCum.push(_intCum[i - 1] + dayRate((i - 1) * _intStep + _intStep / 2) * _intStep)
  }
  const t = n * _intStep
  return _intCum[n] + (h > t + 1e-12 ? dayRate(t + _intStep / 2) * (h - t) : 0)
}
let _dayTotal = null
export function planCumulative(hClock) {
  if (_dayTotal == null) _dayTotal = dayIntegralRaw(24)
  return DAY_PLAN_T * dayIntegralRaw(Math.min(24, Math.max(0, hClock))) / _dayTotal
}
// deterministic smoothed-walk noise for the ACTUAL series, clamped 0.90–1.08 —
// the same multiplier drives live rates, today-counters and the hero chart,
// so the chart delta and the glance delta are one number by construction.
function hashN(i, seed) { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x) }
function vnoise(t, seed) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hashN(i, seed) * (1 - u) + hashN(i + 1, seed) * u }
export function actualNoise(tH) {
  const n = 0.6 * vnoise(tH * 0.9, 7) + 0.4 * vnoise(tH * 3.1, 13)
  return Math.max(0.90, Math.min(1.08, 0.90 + n * 0.18))
}

export function ratesAt(tH, objects) {
  const profile = dayRate(CFG.shiftStartH + tH) * actualNoise(tH)
  const rom = Math.max(0, drift(NOM.romExPit, 1, tH) * profile)
  const crusher = Math.min(NOM.crusherOut, rom * 0.986 + drift(0, 2, tH, 8))
  const chppFeed = Math.min(NOM.chppFeed, crusher * 0.98)
  const product = chppFeed * NOM.yield
  const rejects = chppFeed - product
  const railLoading = ((Math.floor(tH * 2) % 3) !== 2)     // rail loads ~2/3 of the time
  const rail = railLoading ? Math.min(NOM.railOut, product * 0.62) : 0
  const berthed = CFG.shipBerthed && (objects?.['ship-1'])
  const shipReclaim = berthed ? Math.min(NOM.shipLoad, product * 0.5) : 0
  const power = drift(NOM.powerBurn, 5, tH, 0.04)
  return { rom, crusher, chppFeed, product, rejects, rail, ship: shipReclaim, power }
}

export function initMineModel(objects) {
  if (S) return
  const t0 = Date.now() - CFG.shiftStartH * H * 1000
  const stock = { A: CFG.stock0.A, B: CFG.stock0.B }
  // seed today counters by integrating the drift model across the elapsed shift
  const today = { rom: 0, product: 0, rail: 0, ship: 0, rejects: 0 }
  const stepH = 1 / 60                                     // integrate at 1-min resolution
  for (let tH = 0; tH < CFG.shiftStartH; tH += stepH) {
    const r = ratesAt(tH, objects)
    today.rom += r.rom * stepH; today.product += r.product * stepH
    today.rail += r.rail * stepH; today.ship += r.ship * stepH; today.rejects += r.rejects * stepH
    stock.A += (r.product * 0.55 - r.rail * 0.55) * stepH
    stock.B += (r.product * 0.45 - r.rail * 0.45) * stepH
    stock.A = Math.min(CFG.stockMax, Math.max(CFG.stockMin, stock.A))
    stock.B = Math.min(CFG.stockMax, Math.max(CFG.stockMin, stock.B))
  }
  S = { t0, stock, today, downtime: {}, prevStockTotal: stock.A + stock.B, trend: 0 }
}

export function tickMineModel(objects) {
  if (!S) initMineModel(objects)
  const tH = elapsedH()
  const r = ratesAt(tH, objects)
  const dtH = 1 / H
  S.today.rom += r.rom * dtH; S.today.product += r.product * dtH
  S.today.rail += r.rail * dtH; S.today.ship += r.ship * dtH; S.today.rejects += r.rejects * dtH
  // stockpile integrates (in from product, out to rail + ship reclaim)
  S.stock.A = clamp(S.stock.A + (r.product * 0.55 - r.rail * 0.55) * dtH)
  S.stock.B = clamp(S.stock.B + (r.product * 0.45 - r.rail * 0.45) * dtH)
  const total = S.stock.A + S.stock.B
  S.trend = total - S.prevStockTotal; S.prevStockTotal = total
  recordDashSeries(objects, r)
}

// sparkline histories the Overview reads (flow nodes + use-case tiles)
function recordDashSeries(objects, r) {
  recordParam('dash', 'flow_pit', r.rom); recordParam('dash', 'flow_crush', r.crusher)
  recordParam('dash', 'flow_chpp', r.chppFeed); recordParam('dash', 'flow_stock', S.stock.A + S.stock.B)
  recordParam('dash', 'flow_rail', r.rail); recordParam('dash', 'flow_port', r.ship)
  recordParam('dash', 'stockFlow', S.stock.A + S.stock.B)
  recordParam('dash', 'prod', S.today.rom)
  recordParam('dash', 'workers', Number(objects['safety-1']?.parameters?.workersOnSite) || 0, true)
  recordParam('dash', 'prox', Number(objects['safety-1']?.parameters?.minWorkerVehicleDistance) || 0)
  recordParam('dash', 'fleetFuel', fleetRunning(objects).run, true)
  recordParam('dash', 'rul', lowestRul(objects).h ?? 0)
  recordParam('dash', 'vib', worstVibration(objects).v)
  recordParam('dash', 'pm10', Number(objects['pm-1']?.parameters?.pm10) || 0)
  recordParam('dash', 'sec', Number(objects['screen-1']?.parameters?.kwhPerTonne) || 0)
  recordParam('dash', 'stock', S.stock.A + S.stock.B)
}
const clamp = (v) => Math.min(CFG.stockMax, Math.max(CFG.stockMin, v))
function elapsedH() { return Math.min(CFG.shiftHours, (Date.now() - S.t0) / (H * 1000)) }

// ── the snapshot every view reads ──
export function getModel(objects) {
  if (!S) initMineModel(objects)
  if (!S.dashSeeded) { S.dashSeeded = true; backfillDash(objects) }
  const tH = elapsedH()
  const r = ratesAt(tH, objects)
  const fleet = fleetRunning(objects)
  const trucks = Object.values(objects).filter(o => o.type === 'haul_truck')
  const runTrucks = trucks.filter(o => o.status === 'running').length
  const cycleMin = Math.round(drift(CFG.cycleMin, 7, tH, 0.07))
  const utilPct = Math.round(Math.min(96, Math.max(78, drift(CFG.utilNom, 3, tH, 0.06))))
  const fuelLh = Math.round(runTrucks * drift(CFG.truckFuelLh, 4, tH, 0.05))
  const elapsedFrac = tH / CFG.shiftHours
  const planToNow = planCumulative(CFG.shiftStartH + tH) - planCumulative(CFG.shiftStartH)
  const productionToday = S.today.rom
  const deltaPct = planToNow > 0 ? ((productionToday - planToNow) / planToNow) * 100 : 0
  const stockTotal = S.stock.A + S.stock.B
  const offtakeTPerDay = Math.max(1, (r.rail + r.ship) * 24)
  const daysSupply = stockTotal / offtakeTPerDay
  const sec = CFG.secKwhPerT                             // kWh/t
  const kwh = Math.round(r.product * sec)
  const co2Today = (S.today.rom * 0 + fuelLh * CFG.dieselKgPerL + kwh * CFG.gridKgPerKwh) / 1000  // t/h basis → we report today below
  const co2TodayT = (dieselTodayL(objects) * CFG.dieselKgPerL + S.today.product * sec * CFG.gridKgPerKwh) / 1000

  const stages = [
    { id: 'pit',   zone: 'pit',   label: 'Pit',       rate: r.rom,      nominal: NOM.romExPit },
    { id: 'crush', zone: 'proc',  label: 'Crusher',   rate: r.crusher,  nominal: NOM.crusherOut },
    { id: 'chpp',  zone: 'proc',  label: 'CHPP',      rate: r.product,  nominal: NOM.product, feed: r.chppFeed, reject: r.rejects },
    { id: 'stock', zone: 'yard',  label: 'Stockpile', rate: r.product,  nominal: NOM.product, level: stockTotal, trend: r.product - r.rail },
    { id: 'rail',  zone: 'rail',  label: 'Rail',      rate: r.rail,     nominal: NOM.railOut },
    { id: 'port',  zone: 'port',  label: 'Port',      rate: r.ship,     nominal: NOM.shipLoad },
  ]
  // constraint = stage running furthest below its nominal (rail/port idle phases excluded)
  let bottleneck = null, worstRatio = Infinity
  for (const st of stages) {
    if (st.id === 'port' || st.id === 'stock') continue  // batch loading / level node
    const ratio = st.rate / st.nominal
    if (ratio < worstRatio) { worstRatio = ratio; bottleneck = st.id }
  }

  if (import.meta.env.DEV) console.assert(Math.sign(stages[3].trend) === Math.sign(r.product - r.rail), '[mineModel] stock arrow decoupled')
  return {
    tH, elapsedFrac, rates: r, stages, bottleneck,
    plan: { daily: CFG.dailyPlan, toNow: planToNow, deltaPct },
    today: { production: productionToday, product: S.today.product, rail: S.today.rail, ship: S.today.ship, rejects: S.today.rejects },
    stock: { A: S.stock.A, B: S.stock.B, total: stockTotal, trend: S.trend, daysSupply },
    fleet: { running: fleet.run, total: fleet.total, runTrucks, totalTrucks: trucks.length, cycleMin, utilPct, fuelLh },
    energy: { kwh, sec, co2TodayT, dieselLh: fuelLh },
    yield: NOM.yield * 100,
  }
}

function dieselTodayL(objects) {
  // running trucks × nominal L/h × elapsed hours (coherent single fuel figure)
  const run = Object.values(objects).filter(o => o.type === 'haul_truck' && o.status === 'running').length
  return run * CFG.truckFuelLh * (S ? elapsedH() : CFG.shiftStartH)
}

// cumulative production S-curve for the hero: plan = 24h-profile integral over
// the shift window; actual = the live rate model integrated, pinned to the
// today-counter so the chart delta EQUALS the glance delta.
export function productionCurve(objects, points = 48) {
  if (!S) initMineModel(objects)
  const tH = elapsedH()
  const actual = [], plan = []
  const stepH = tH / points
  const plan0 = planCumulative(CFG.shiftStartH)
  let cum = 0
  for (let i = 0; i <= points; i++) {
    const a = i * stepH
    if (i > 0) { const mid = a - stepH / 2; cum += ratesAt(mid, objects).rom * stepH }
    actual.push(cum)
    plan.push(planCumulative(CFG.shiftStartH + a) - plan0)
  }
  const k = actual[points] > 0 ? S.today.rom / actual[points] : 1
  for (let i = 0; i <= points; i++) actual[i] *= k
  if (import.meta.env.DEV && plan[points] > 0) {
    const chartDelta = ((actual[points] - plan[points]) / plan[points]) * 100
    const modelDelta = ((S.today.rom - plan[points]) / plan[points]) * 100
    if (Math.abs(chartDelta - modelDelta) >= 0.05) console.warn('[mineModel] hero delta mismatch', chartDelta, modelDelta)
  }
  return { actual, plan, target: plan[points] }
}

function backfillDash(objects) {
  if (getParamHistory('dash', 'flow_pit').length > 8) return
  const tH = elapsedH()
  const mkWalk = (seed) => { let st = seed >>> 0, v = 0; const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296 }; return () => { v = Math.max(-1, Math.min(1, v + (rnd() - 0.5) * 0.55)); return v } }
  const walks = Array.from({ length: 14 }, (_, k) => mkWalk(97 + k * 31))
  const anchor = (id, key, dflt) => { const v = Number(objects[id]?.parameters?.[key]); return Number.isFinite(v) ? v : dflt }
  const rul0 = lowestRul(objects).h
  let wInt = 11, fInt = 9, prox = anchor('safety-1', 'minWorkerVehicleDistance', 34)
  for (let i = 0; i < 63; i++) {
    const f = i / 62
    const h = Math.max(0.05, tH - (1 - f) * 1.0)
    const r = ratesAt(h, objects)
    recordParam('dash', 'flow_pit', r.rom + walks[0]() * 6)
    recordParam('dash', 'flow_crush', r.crusher + walks[1]() * 5)
    recordParam('dash', 'flow_chpp', r.product + walks[2]() * 4)
    recordParam('dash', 'flow_rail', r.rail + walks[3]() * 8)
    recordParam('dash', 'flow_port', r.ship + walks[4]() * 9)
    const lvl = (S.stock.A + S.stock.B) - (1 - f) * (r.product - r.rail) + walks[5]() * 30
    recordParam('dash', 'flow_stock', lvl); recordParam('dash', 'stockFlow', lvl); recordParam('dash', 'stock', lvl)
    recordParam('dash', 'prod', Math.max(0, S.today.rom - (1 - f) * r.rom) + walks[6]() * 10)
    if (i % 5 === 0) { wInt = Math.max(9, Math.min(13, wInt + Math.round((walks[7]() * 1.6)))) }
    recordParam('dash', 'workers', wInt, true)
    if (i % 9 === 0) { fInt = Math.max(8, Math.min(9, fInt + Math.round(walks[8]() * 1.2))) }
    recordParam('dash', 'fleetFuel', fInt, true)
    prox = Math.max(20, Math.min(48, prox + walks[9]() * 3))
    recordParam('dash', 'prox', prox)
    if (rul0 != null) recordParam('dash', 'rul', rul0 + (1 - f) * 1.4 + walks[10]() * 0.4)
    recordParam('dash', 'vib', anchor('crusher-1', 'vibration', 7.4) + walks[11]() * 0.8)
    recordParam('dash', 'pm10', anchor('pm-1', 'pm10', 205) + walks[12]() * 16)
    recordParam('dash', 'sec', anchor('screen-1', 'kwhPerTonne', 1.12) + walks[13]() * 0.05)
  }
}

export function resetMineModel() { S = null }
export function modelReady() { return !!S }
