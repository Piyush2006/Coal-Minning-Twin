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
export function ratesAt(tH, objects) {
  const rom = Math.max(0, drift(NOM.romExPit, 1, tH))
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
    stock.A += (r.product * 0.55 - r.rail * 0.5 - r.ship * 0.5) * stepH
    stock.B += (r.product * 0.45 - r.rail * 0.5 - r.ship * 0.5) * stepH
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
  S.stock.A = clamp(S.stock.A + (r.product * 0.55 - r.rail * 0.5 - r.ship * 0.5) * dtH)
  S.stock.B = clamp(S.stock.B + (r.product * 0.45 - r.rail * 0.5 - r.ship * 0.5) * dtH)
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
  recordParam('dash', 'workers', Number(objects['safety-1']?.parameters?.workersOnSite) || 0)
  recordParam('dash', 'prox', Number(objects['safety-1']?.parameters?.minWorkerVehicleDistance) || 0)
  recordParam('dash', 'fleetFuel', 78 + (r.rom / NOM.romExPit) * 14)
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
  const planToNow = CFG.dailyPlan * planFrac(tH)
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
    { id: 'chpp',  zone: 'proc',  label: 'CHPP',      rate: r.chppFeed, nominal: NOM.chppFeed, reject: r.rejects },
    { id: 'stock', zone: 'yard',  label: 'Stockpile', rate: r.product,  nominal: NOM.product, level: stockTotal, trend: S.trend },
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

// planned rate multiplier across the shift: startup ramp, mid-shift crib dip,
// recovery — gives the plan line its S-curve shape. planFrac() is the
// normalized cumulative integral so plan-to-now and the hero share one truth.
function planProfile(h) {
  if (h < 0.75) return 0.55 + (h / 0.75) * 0.45
  if (h < 3.5) return 1.04
  if (h < 4.25) return 0.72
  if (h < 5) return 0.72 + ((h - 4.25) / 0.75) * 0.31
  return 1.03
}
function planIntegral(h) {
  const step = 0.05
  let a = 0
  for (let t = 0; t < h; t += step) a += planProfile(t + step / 2) * Math.min(step, h - t)
  return a
}
let _planTotal = null
export function planFrac(h) {
  if (_planTotal == null) _planTotal = planIntegral(CFG.shiftHours)
  return Math.max(0, Math.min(1, planIntegral(Math.min(h, CFG.shiftHours)) / _planTotal))
}

// cumulative production S-curve (actual drift-integrated vs S-curve plan) for the hero
export function productionCurve(objects, points = 48) {
  if (!S) initMineModel(objects)
  const tH = elapsedH()
  const actual = [], plan = []
  const stepH = tH / points
  let cum = 0
  for (let i = 0; i <= points; i++) {
    const a = i * stepH
    // integrate rom over [a-step, a]
    if (i > 0) { const mid = a - stepH / 2; cum += ratesAt(mid, objects).rom * stepH }
    actual.push(cum)
    plan.push(CFG.dailyPlan * planFrac(a))
  }
  return { actual, plan, target: CFG.dailyPlan * planFrac(tH) }
}

function backfillDash(objects) {
  if (getParamHistory('dash', 'flow_pit').length > 8) return
  const tH = elapsedH()
  const wob = (i, k, m) => Math.sin(i * 0.37 + k) * m + Math.sin(i * 1.31 + k * 2.7) * m * 0.35
  const anchor = (id, key, dflt) => { const v = Number(objects[id]?.parameters?.[key]); return Number.isFinite(v) ? v : dflt }
  const rul0 = lowestRul(objects).h
  for (let i = 0; i < 63; i++) {
    const f = i / 62
    const h = Math.max(0.05, tH - (1 - f) * 1.0)
    const r = ratesAt(h, objects)
    recordParam('dash', 'flow_pit', r.rom + wob(i, 1, 6))
    recordParam('dash', 'flow_crush', r.crusher + wob(i, 2, 5))
    recordParam('dash', 'flow_chpp', r.chppFeed + wob(i, 3, 5))
    recordParam('dash', 'flow_rail', r.rail + wob(i, 4, 8))
    recordParam('dash', 'flow_port', r.ship + wob(i, 5, 9))
    const lvl = (S.stock.A + S.stock.B) - (1 - f) * 260 + wob(i, 6, 40)
    recordParam('dash', 'flow_stock', lvl); recordParam('dash', 'stockFlow', lvl); recordParam('dash', 'stock', lvl)
    recordParam('dash', 'prod', Math.max(0, S.today.rom - (1 - f) * r.rom) + wob(i, 7, 12))
    recordParam('dash', 'workers', 11 + Math.round(Math.sin(i * 0.5) * 1.2))
    recordParam('dash', 'prox', anchor('safety-1', 'minWorkerVehicleDistance', 34) + wob(i, 8, 6))
    recordParam('dash', 'fleetFuel', 78 + (r.rom / NOM.romExPit) * 14 + wob(i, 9, 1.5))
    if (rul0 != null) recordParam('dash', 'rul', rul0 + (1 - f) * 1.4 + wob(i, 10, 0.4))
    recordParam('dash', 'vib', anchor('crusher-1', 'vibration', 7.4) + wob(i, 11, 0.8))
    recordParam('dash', 'pm10', anchor('pm-1', 'pm10', 205) + wob(i, 12, 16))
    recordParam('dash', 'sec', anchor('screen-1', 'kwhPerTonne', 1.12) + wob(i, 13, 0.05))
  }
}

export function resetMineModel() { S = null }
export function modelReady() { return !!S }
