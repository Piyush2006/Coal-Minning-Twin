// Live production-chain simulator — the plane-unification fix. The recorded
// fixture runs mass-balanced flow integration; the live sim used to random-walk
// each parameter independently, so Live and Replay had a different *character*
// and Screen 4's CV-01 diagnosis had a hole in Live. This ticks the SAME mass
// balance + load-aware motor model each second, but derives stage capabilities
// from the LIVE object states — so twin interactions (fault a crusher, park a
// truck) actually move the chain and the dashboard.
//
// Reuses RATED/YIELD/BUFFERS and createMotorThermal from the pure twin-sim data
// modules (relocated into lib/ when the old dashboards were removed) so Live and
// Replay share one physics definition.
import { RATED, YIELD, BUFFERS } from './chainSim'
import { createMotorThermal } from './motorThermal'

const COAL_TRUCKS = ['truck-1', 'truck-2', 'truck-3']
const isDown = (o) => !o || o.status === 'fault' || o.status === 'idle' || o.status === 'off'
const num = (o, k, d = 0) => { const v = Number(o?.parameters?.[k]); return Number.isFinite(v) ? v : d }

let S = null
function init() {
  S = {
    buf: { haul: 30, crush: 20, chp: 400 },
    thermal: createMotorThermal(),
    resid: 4.0,                 // live cooling-path residual (°C) — slow drift
    lastT: Date.now(),
    trainT: 0,
  }
}
export function resetChainLive() { S = null }

// derive product-equiv stage capabilities (t/h) from live object states
function capsFrom(o) {
  const faceUp = !isDown(o['exc-coal-1'])
  const runCoalTrucks = COAL_TRUCKS.filter(id => o[id] && !isDown(o[id])).length
  const crushUp = o['crusher-1'] && o['crusher-1'].status !== 'fault' && o['crusher-1'].status !== 'off'
  const chpUp = !isDown(o['screen-1']) && !isDown(o['chpp-1'])
  const dispUp = !isDown(o['loadout-1']) || !isDown(o['shiploader-1'])
  return {
    face: faceUp ? RATED.face : 0,
    haul: (runCoalTrucks / COAL_TRUCKS.length) * RATED.haul,
    crush: crushUp ? RATED.crush : 0,
    chp: chpUp ? RATED.chp : 0,
    dispatch: dispUp ? RATED.dispatch : 0,
  }
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const r1 = (v) => Math.round(v * 10) / 10

// Called once per second from the live sim tick, AFTER simulateTick. No-op on
// scenes without the coal chain (e.g. the beverage template).
export function tickChainSim(objects, patchParams) {
  if (!objects || !objects['crusher-1'] || !objects['cv-01']) return
  if (!S) init()
  const now = Date.now()
  const dt = clamp((now - S.lastT) / 1000, 0, 5); S.lastT = now
  if (dt <= 0) return
  const h = dt / 3600

  const cap = capsFrom(objects)
  // mass balance (product-equiv t), identical shape to the recorder's chainSim
  const faceOut = cap.face * h
  const haulIn = Math.min(faceOut, cap.haul * h)
  const haulOut = Math.min(S.buf.haul + haulIn, cap.haul * h)
  const crushIn = Math.min(haulOut, cap.crush * h, BUFFERS.crush.cap - S.buf.crush + cap.chp * h)
  S.buf.haul = clamp(S.buf.haul + haulIn - crushIn, 0, BUFFERS.haul.cap)
  const chpIn = Math.min(S.buf.crush + crushIn, cap.chp * h)
  S.buf.crush = clamp(S.buf.crush + crushIn - chpIn, 0, BUFFERS.crush.cap)
  const Rh = Math.min(...Object.values(RATED)) * h
  const dispatched = Math.min(cap.dispatch * h, Rh, S.buf.chp + chpIn)
  S.buf.chp = clamp(S.buf.chp + chpIn - dispatched, 0, BUFFERS.chp.cap)

  const tph = { crushIn: crushIn / h, chpIn: chpIn / h, haulOut: haulOut / h, dispatched: dispatched / h }

  // load-aware CV-01 motor: residual drifts slowly; absolute temp follows load
  S.resid = clamp(S.resid + dt * (3.1 / 3600) * 0.4, 0, 40)   // gentle live drift
  const cvLoad = clamp(tph.chpIn / RATED.chp, 0, 1)
  const mt = S.thermal.step(cvLoad, S.resid, dt)

  const chpStarved = tph.chpIn < Math.min(...Object.values(RATED)) * 0.05
  const dispStarved = tph.dispatched < Math.min(...Object.values(RATED)) * 0.05
  S.trainT += dispatched * 0.62

  const patches = {
    'crusher-1': { throughput: r1(tph.crushIn / YIELD) },
    'screen-1': { feedRate: r1(tph.chpIn / YIELD) },
    'chpp-1': { feedRate: r1(tph.chpIn / YIELD), yield: r1(YIELD * 100) },
    'cv-01': { load: r1(cvLoad * 100), motorTemp: mt.temp, motorCurrent: mt.current, vibration: r1(2.05 + cvLoad * 0.18) },
    'pile-1': { stockTonnes: r1(480 + S.buf.chp) },
    'loadout-1': { loadRate: r1(tph.dispatched * 0.62) },
    'shiploader-1': { loadRate: r1(tph.dispatched * 0.38) },
  }
  patchParams(patches)
  // expose a compact snapshot for any live consumer (dashboard-v3 live plane)
  window.__chainLive = { t: now, cap, tph, buf: { ...S.buf }, cvLoad, motor: mt, resid: S.resid }
}
