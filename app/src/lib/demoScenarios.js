// Scripted mock scenarios with an ON-DEMAND trigger API — the tour (or a dev
// console) fires a named scenario and its alert appears on the next sim tick;
// clearScenario returns the parameter to its normal value so every run is
// identical. While `exclusive` is on (tour presentation), the free-running
// demoTrends sweeps are pinned to their defaults so ONLY scripted scenarios
// fire — deterministic back-to-back recordings.
const ACTIVE = new Map()          // name → { def, t0 }
let exclusive = false

export const SCENARIOS = {
  'ex01-engine': { objId: 'exc-ob-1',  set: { engineHealth: 33, rulHours: 260 } },      // HEMM PdM critical
  'ht01-idle':   { objId: 'truck-1',   set: { idleTime: 31 } },                          // haulage warn
  'ht03-tyre':   { objId: 'truck-3',   set: { tyreTemp: 92 } },                          // TPMS critical
  'crusher-vib': { objId: 'crusher-1', ramp: { param: 'vibration', from: 5.2, to: 12.2, over: 7 } },  // CBM sweep → critical mid-hold
  'cv01-idler':  { objId: 'cam-2',     set: { hotspotConf: 92 } },                       // conveyor vision critical
  'sec-dev':     { objId: 'screen-1',  set: { kwhPerTonne: 1.27 } },                     // CHP SEC warn
  'pm10':        { objId: 'pm-1',      set: { pm10: 285 } },                             // dust critical
}

export function triggerScenario(name) {
  const def = SCENARIOS[name]
  if (def) ACTIVE.set(name, { def, t0: (typeof performance !== 'undefined' ? performance.now() : 0) })
  return !!def
}
export function clearScenario(name) { if (name) ACTIVE.delete(name); else ACTIVE.clear(); return true }
export function clearAllScenarios() { ACTIVE.clear() }
export function setScenarioExclusive(on) { exclusive = !!on }
export function scenarioExclusive() { return exclusive }

/** Merged {param: value} override for one object this tick, or null. */
export function scenarioPatch(objId) {
  let out = null
  for (const { def, t0 } of ACTIVE.values()) {
    if (def.objId !== objId) continue
    out = out || {}
    if (def.set) Object.assign(out, def.set)
    if (def.ramp) {
      const f = Math.min(1, ((typeof performance !== 'undefined' ? performance.now() : 0) - t0) / (def.ramp.over * 1000))
      out[def.ramp.param] = Math.round((def.ramp.from + (def.ramp.to - def.ramp.from) * f) * 100) / 100
    }
  }
  return out
}
