// Mass-balance production-chain stepper for Blackridge — an INPUT layer of the
// simulator (the recorder records its output; nothing downstream is ever
// hand-edited). The existing sim random-walks each parameter independently,
// which can't satisfy the brief's physical-consistency rule; this stepper makes
// the chain parameters (throughputs, buffer levels, boundary output) obey mass
// balance, and the recorder writes them into the same object/parameter shapes
// the live plane uses.
//
// Chain (product-equivalent t/h — ROM rates × CHP yield so every stage is
// comparable and the boundary measures saleable coal):
//   face (EX-02 + WL-01) → haul (HT-01..03) → crush (CR-01)
//     →[surge bin]→ chp (SC-01+CHPP) →[product stockpile]→ dispatch (TLO+SL)
//   ROM pad buffer sits after haul.
//
// Events modulate capabilities with a cause; the stepper integrates flows and
// buffers at dt seconds, accumulates a per-minute arbitration table, and adds
// small seeded flow texture (the honest source of the residual bucket).

export const YIELD = 0.78

export const STAGES = [
  { id: 'face', bucket: 'faceLoading', assets: ['exc-coal-1'] },
  { id: 'haul', bucket: 'haulage', assets: ['truck-1', 'truck-2', 'truck-3'] },
  { id: 'crush', bucket: 'crushing', assets: ['crusher-1'] },
  { id: 'chp', bucket: 'chp', assets: ['screen-1', 'chpp-1'] },
  { id: 'dispatch', bucket: 'dispatch', assets: ['loadout-1', 'ship-1'] },
]

// rated capabilities, product-equivalent t/h (haul = 8-truck fleet; never the
// chain bottleneck — the reference R stays the face at 585)
export const RATED = { face: 585, haul: 1650, crush: 936, chp: 660, dispatch: 800 }

// buffers: AFTER the named stage. The shift opens hand-to-mouth — the previous
// shift's rake drew the ready-to-load stockpile down — so upstream events
// genuinely reach the boundary instead of vanishing into buffer cover. (This is
// an authored INITIAL CONDITION of the simulation, annotated in the fixture.)
export const BUFFERS = {
  haul: { cap: 60, init: 25 },       // ROM pad (pe-t)
  crush: { cap: 40, init: 15 },      // surge bin
  chp: { cap: 1600, init: 25 },      // ready-to-load product — drawn down by Shift A's rake
}

const mulberry = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

export function createChainSim({ seed = 1, events = [], texture = 0.02 } = {}) {
  const rnd = mulberry(seed * 2654435761)
  const buf = { haul: BUFFERS.haul.init, crush: BUFFERS.crush.init, chp: BUFFERS.chp.init }
  // per-stage slow texture state (plateau-y, not sine): random walk with holds
  const tex = { face: 0, haul: 0, crush: 0, chp: 0, dispatch: 0 }
  const texHold = { face: 0, haul: 0, crush: 0, chp: 0, dispatch: 0 }

  // minute aggregation for the arbitration table
  let minAcc = null
  const minutes = []
  const resetMin = (t) => { minAcc = { t, n: 0, act: 0, cap: { face: 0, haul: 0, crush: 0, chp: 0, dispatch: 0 } } }

  const activeAt = (tMin) => events.filter(e => tMin >= e.start && tMin < e.end)

  function step(tSec, dt) {
    const tMin = tSec / 60
    const act = activeAt(tMin)
    // effective capability per stage (worst event wins), with cause + state
    const cap = {}, cause = {}, state = {}
    for (const s of STAGES) {
      let c = RATED[s.id], cz = null, st = 'running'
      for (const e of act) {
        if (e.stage !== s.id) continue
        const ec = e.capFactor != null ? RATED[s.id] * e.capFactor : (e.cap ?? 0)
        if (ec < c) { c = ec; cz = e.cause; st = e.state ?? (ec <= 1 ? 'down' : 'running') }
      }
      // plateau texture: hold a small offset for 3–9 minutes at a time
      if (texHold[s.id] <= tSec) { tex[s.id] = (rnd() * 2 - 1) * texture; texHold[s.id] = tSec + (180 + rnd() * 360) }
      cap[s.id] = Math.max(0, c * (1 + (st === 'running' ? tex[s.id] : 0)))
      cause[s.id] = cz; state[s.id] = st
    }

    // mass balance at dt (pe-t): flows limited by capability, upstream supply, downstream room
    const h = dt / 3600
    const faceOut = cap.face * h
    const haulIn = Math.min(faceOut, cap.haul * h)                       // face→trucks (no face buffer)
    const haulOut = Math.min((buf.haul + haulIn), cap.haul * h)          // ROM pad draw
    const crushIn = Math.min(haulOut, cap.crush * h, BUFFERS.crush.cap - buf.crush + cap.chp * h)
    buf.haul = clamp(buf.haul + haulIn - crushIn, 0, BUFFERS.haul.cap)
    const chpIn = Math.min(buf.crush + crushIn, cap.chp * h)
    buf.crush = clamp(buf.crush + crushIn - chpIn, 0, BUFFERS.crush.cap)
    // dispatch draws at ≤ R with small downward texture — weighbridge/positioning
    // micro-stops nobody logs. This is the honest source of the residual bucket.
    const Rh = Math.min(...Object.values(RATED)) * h
    const dispatchDemand = Math.min(cap.dispatch * h, Rh * (1 + Math.min(0, tex.dispatch)))
    const dispatched = Math.min(dispatchDemand, buf.chp + chpIn)
    buf.chp = clamp(buf.chp + chpIn - dispatched, 0, BUFFERS.chp.cap)

    // minute table for arbitration
    if (!minAcc) resetMin(tSec)
    minAcc.n++; minAcc.act += dispatched
    for (const s of STAGES) minAcc.cap[s.id] += cap[s.id]
    if (minAcc.n * dt >= 60) {
      const n = minAcc.n
      minutes.push({
        cap: Object.fromEntries(STAGES.map(s => [s.id, (minAcc.cap[s.id] / n) / 60])),   // pe-t/min
        state: { ...state }, cause: { ...cause },
        buf: { haul: buf.haul, crush: buf.crush, chp: buf.chp },
        bufCap: { haul: BUFFERS.haul.cap, crush: BUFFERS.crush.cap, chp: BUFFERS.chp.cap },
        boundaryAct: minAcc.act,                                                          // pe-t this minute
      })
      resetMin(tSec + dt)
    }

    return {
      cap, state, cause, buf: { ...buf },
      flows: { faceOut: faceOut / h, haulOut: haulOut / h, crushIn: crushIn / h, chpIn: chpIn / h, dispatched: dispatched / h }, // pe-t/h
      dispatchedT: dispatched,
    }
  }

  return {
    step,
    minutes,
    ratedPerMin: Object.fromEntries(STAGES.map(s => [s.id, RATED[s.id] / 60])),
  }
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
