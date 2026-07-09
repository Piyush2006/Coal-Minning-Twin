// ─────────────────────────────────────────────────────────────────────────────
// Process simulation engine.
//
// Owns SIM — a module-level, NON-PERSISTED, non-reactive Map keyed by object id —
// holding per-asset phase clocks and event timers. Kept out of the store/persist
// on purpose: persisting timers would bloat saved scenes, and routing them through
// undo history would pollute it. The store's simulateTick calls stepSimulation()
// (no-history) once per ~second, then gates each parameter to its configured
// refresh frequency so values don't churn every tick.
//
// This is the seam for LIVE DATA later: replace the body of step*() with values
// from a real source (UNS/MQTT/REST) and everything downstream (states, derived
// status, KPIs, glow) keeps working unchanged.
//
// Pacing target: 1 tick ≈ 1 s real-time, and a real pot runs "Normal" for years —
// so events (anode effects, anode changes) are rare and slow, never per-second.
// ─────────────────────────────────────────────────────────────────────────────

import { getParameterSchema } from './parameterSchemas'
import { statusFromState, defaultState } from './stateSchemas'

const SIM = new Map()

// Tunable knobs (1 tick ≈ 1 second real-time). A real pot runs "Normal" for
// years — events are rare and slow, NOT per-second. These are paced so a pot
// sits at Normal almost always, with the occasional isolated upset.
const DAYS_PER_TICK     = 0.002  // 28-day anode cycle spans ~4 h of viewing
const AE_CHANCE         = 0.0002 // per-pot anode-effect probability per tick (~1/pot/80min)
const AE_DURATION       = 150    // ticks an anode effect lasts (~2.5 min)
const CHANGE_DURATION   = 120    // ticks an anode change lasts (~2 min)
const TAP_PERIOD        = 95     // ticks between alumina/metal feed-tap cycles
const TAP_DURATION      = 12
const FEED_PERIOD       = 16     // ticks between alumina feed pulses
const FEED_DURATION     = 3

const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const round2 = (v) => Math.round(v * 100) / 100

// Drift `cur` toward `center` with a little noise, clamped to [lo,hi].
function walk(cur, center, pull, noise, lo, hi) {
  return round2(clamp(cur + (center - cur) * pull + (Math.random() - 0.5) * noise, lo, hi))
}

// Seed a per-id record with a deterministic phase offset (so 32 pots desync
// without Math.random at seed time, which would make resume non-deterministic).
// `agePhase` spreads each pot's starting point in the 28-day anode cycle, so
// they don't all reach an anode change at the same instant.
function seed(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const rec = {
    t: h % 100,
    aeTimer: 0, changeTimer: 0,
    tapTimer: h % TAP_PERIOD, feedTimer: h % FEED_PERIOD,
    agePhase: (h % 280) / 10,   // 0–28 days, deterministic per pot
    refilling: false, draining: false,
  }
  SIM.set(id, rec)
  return rec
}

export function resetSim() { SIM.clear() }

// ── Per-type step functions — each returns a patch {parameters?, state?, config?}

function stepPot(o, rec) {
  const p = { ...o.parameters }

  // anode consumption → 28-day cycle → anode change → reset. Each pot starts at
  // its own phase (agePhase) so they don't all change anodes together.
  if (!rec.ageInit) { p.anodeAge = round2(rec.agePhase); rec.ageInit = true }
  if (rec.changeTimer > 0) rec.changeTimer -= 1
  p.anodeAge = round2((p.anodeAge ?? 0) + DAYS_PER_TICK)
  if (p.anodeAge >= 28) { p.anodeAge = 0; rec.changeTimer = CHANGE_DURATION }

  // anode-effect upset events — rare; a real pot sits at Normal almost always
  if (rec.aeTimer > 0) rec.aeTimer -= 1
  else if (Math.random() < AE_CHANCE) rec.aeTimer = AE_DURATION
  const aeActive = rec.aeTimer > 0

  // feed/tap cycles — INTERNAL ONLY; they drive the alumina/metal curves but are
  // routine sub-operations, NOT a headline state an operator watches flip.
  rec.tapTimer = (rec.tapTimer + 1) % TAP_PERIOD
  const tapping = rec.tapTimer < TAP_DURATION
  rec.feedTimer = (rec.feedTimer + 1) % FEED_PERIOD
  const feeding = rec.feedTimer < FEED_DURATION

  // alumina sawtooth (depletes, refilled by feed pulses)
  let conc = p.aluminaConc ?? 3
  conc = feeding ? conc + 0.45 : conc - 0.05
  p.aluminaConc = round2(clamp(conc, 1.5, 4.5))

  // metal pad rises with production, drops on tap
  let mh = p.metalHeight ?? 18
  mh = tapping ? mh - 0.7 : mh + 0.05
  p.metalHeight = round2(clamp(mh, 8, 24))

  // electricals (voltage is continuously measured; bath/metal temp are manual)
  p.acd       = walk(p.acd ?? 30, 30, 0.05, 1.4, 18, 48)
  p.currentEff= walk(p.currentEff ?? 94, 94, 0.05, 0.5, 88, 96)
  p.current   = walk(p.current ?? 600, 600, 0.2, 1.4, 590, 610)
  const vBase = 3.9 + (p.acd - 20) * 0.02
  p.voltage   = aeActive ? walk(p.voltage ?? 4.2, 8.5, 0.45, 0.6, 6, 12)
                         : walk(p.voltage ?? 4.2, vBase, 0.25, 0.08, 3.6, 5.2)

  // headline state: PRESERVE the pot's standing condition (the demo / authored
  // state is the single source of truth), and only OVERLAY rare transient events.
  let state = o.state || 'normal'
  if (aeActive) state = 'anodeEffect'
  else if (rec.changeTimer > 0) state = 'anodeChange'

  return { parameters: p, state }
}

function stepSilo(o, rec) {
  const p = { ...o.parameters }
  let level = p.level ?? 70
  if (rec.refilling) {
    level += 1.4
    if (level >= 98) rec.refilling = false
  } else {
    level -= 0.10 * ((p.feedRate ?? 420) / 420)
    if (level <= 12) rec.refilling = true
  }
  p.level = round2(clamp(level, 0, 100))
  p.feedRate = walk(p.feedRate ?? 420, 420, 0.05, 10, 200, 700)

  let state = 'feeding'
  if (rec.refilling) state = 'refilling'
  else if (p.level <= 7) state = 'empty'
  else if (p.level <= 25) state = 'low'

  // mirror level into config so the geometry level-band moves
  return { parameters: p, state, config: { ...o.config, fillLevel: p.level } }
}

function stepCrucible(o, rec) {
  const p = { ...o.parameters }
  let fill = p.fill ?? 40
  if (rec.draining) {
    fill -= 2.6
    if (fill <= 2) rec.draining = false
  } else {
    fill += 0.8
    if (fill >= 100) rec.draining = true
  }
  p.fill = round2(clamp(fill, 0, 100))
  p.metalTemp = walk(p.metalTemp ?? 900, 900, 0.06, 2.2, 820, 970)

  const state = rec.draining ? 'idle' : (p.fill >= 99 ? 'full' : 'tapping')
  return { parameters: p, state, config: { ...o.config, tapping: state === 'tapping' } }
}

function stepPTM(o, rec) {
  const p = { ...o.parameters }
  rec.t = rec.t ?? 0
  const changing = (rec.t % 150) < 20
  const pos = changing ? (p.position ?? 50) : round2(50 + Math.sin(rec.t * 0.03) * 50)
  p.position = round2(clamp(pos, 0, 100))
  p.lift = walk(p.lift ?? 12, changing ? 28 : 5, 0.2, 1.2, 0, 40)
  return { parameters: p, state: changing ? 'changingAnode' : 'travelling' }
}

// Generic gentle random-walk (beverage machines, pumps, custom types). Preserves
// the asset's current state — matches the original simulateTick behaviour.
function stepGeneric(o, customAssetTypes) {
  const schema = getParameterSchema(o.type, customAssetTypes)
  if (!schema.length) return {}
  const p = { ...o.parameters }
  for (const f of schema) {
    const cur = p[f.key]
    if (typeof cur !== 'number') continue
    const span = (f.max ?? 100) - (f.min ?? 0)
    let v = cur + (Math.random() - 0.5) * span * 0.02
    if (f.min != null) v = Math.max(f.min, v)
    if (f.max != null) v = Math.min(f.max, v)
    p[f.key] = round2(v)
  }
  return { parameters: p }
}

// One simulation step over the whole scene → a fresh objects map (no history).
export function stepSimulation(objects, customAssetTypes = {}) {
  const out = {}
  for (const id in objects) {
    const o = objects[id]
    const rec = SIM.get(id) ?? seed(id)
    rec.t = (rec.t ?? 0) + 1

    let patch
    switch (o.type) {
      case 'ReductionPot':      patch = stepPot(o, rec); break
      case 'AluminaSilo':       patch = stepSilo(o, rec); break
      case 'TappingCrucible':   patch = stepCrucible(o, rec); break
      case 'PotTendingMachine': patch = stepPTM(o, rec); break
      default:                  patch = stepGeneric(o, customAssetTypes); break
    }

    const nextState = patch.state ?? o.state ?? defaultState(o.type)
    let params      = patch.parameters ?? o.parameters
    // Don't let the simulator move parameters bound to a UNS topic — those are
    // driven by the live poller.
    if (o.paramMeta) for (const k in o.paramMeta) if (o.paramMeta[k]?.topic && o.parameters && k in o.parameters) params[k] = o.parameters[k]

    // ── MOCK / DEMO scenario trends ───────────────────────────────────────
    // config.demoTrends = [{ param, min, max, period (s), offset? }] sweeps a
    // parameter min→max→min on a slow loop so threshold alerts fire reliably
    // in demos WITHOUT a real feed. Clearly-labelled mock aid: delete the
    // asset's config.demoTrends to turn it off. Overrides the random drift for
    // just those parameters; everything else keeps drifting normally.
    if (Array.isArray(o.config?.demoTrends)) {
      params = { ...params }
      for (const tr of o.config.demoTrends) {
        if (!tr?.param) continue
        const period = Math.max(10, Number(tr.period) || 120)         // one tick ≈ 1 s
        const phase = ((rec.t + (Number(tr.offset) || 0)) % period) / period
        const wave = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI)        // 0 → 1 → 0
        const lo = Number(tr.min) || 0, hi = Number(tr.max) || 0
        params[tr.param] = Math.round((lo + (hi - lo) * wave) * 100) / 100
      }
    }

    out[id] = {
      ...o,
      parameters: params,
      state: nextState,
      status: statusFromState(o.type, nextState),
      ...(patch.config ? { config: patch.config } : {}),
    }
  }
  return out
}
