// Live-safety bridge. The 3D safety systems (PPE vision, restricted zones, and
// the Stage-4 proximity layer) write REAL, twin-driven values here each tick;
// `tickSafetyBridge` mirrors the managed ones into the EXISTING safety-1
// parameters via updateObject — so one scripted event in the twin becomes one
// number change on safety-1, which the existing alertRules + m.tcs + dashboard
// already consume. No parallel counters, no new dashboard fields.
//
// A field left `null` means "no live system is managing this — leave stepSafety's
// synthetic walk alone." A non-null field takes over that safety-1 param (or, for
// ppeCompliance, is read directly by mineModel). This is why the bridge writes
// AFTER simulateTick and refreshes every tick: it bypasses the 30 s commit gate
// that schema-less site_safety params are otherwise subject to, so live events
// surface within one second.
import { useSceneStore } from '../store/sceneStore'

export const liveSafety = {
  // read by mineModel (NOT a safety-1 param): site PPE compliance %, or null → fallback
  ppeCompliance: null,
  // restricted-zone occupancy (Stage 3) — these ARE safety-1 params
  unauthorizedEvent: null,           // 0/1
  restrictedZone: null,              // zone name string
  unauthorizedEntriesToday: null,    // running total (seeded from safety-1 on engage)
  // proximity + geofence (Stage 4) — declared now, written there
  minWorkerVehicleDistance: null,    // m
  proximityEvent: null,              // 0/1
  proximityAlertsToday: null,
  geofenceEvent: null,               // 0/1
  geofenceViolationsToday: null,
}

// safety-1 params the bridge may take over (ppeCompliance is NOT here — mineModel
// reads it directly). A param is written only when its liveSafety field != null.
const BRIDGED = [
  'unauthorizedEvent', 'restrictedZone', 'unauthorizedEntriesToday',
  'minWorkerVehicleDistance', 'proximityEvent', 'proximityAlertsToday',
  'geofenceEvent', 'geofenceViolationsToday',
]

// Seed the running counters from the current safety-1 values the first time a
// live system takes over, so today's totals continue rather than reset to 0.
let seeded = false
export function seedCounters(safetyParams) {
  if (seeded) return
  seeded = true
  if (liveSafety.unauthorizedEntriesToday == null) liveSafety.unauthorizedEntriesToday = Number(safetyParams?.unauthorizedEntriesToday) || 0
  if (liveSafety.proximityAlertsToday == null) liveSafety.proximityAlertsToday = Number(safetyParams?.proximityAlertsToday) || 0
  if (liveSafety.geofenceViolationsToday == null) liveSafety.geofenceViolationsToday = Number(safetyParams?.geofenceViolationsToday) || 0
}

// Mirror the managed live values into safety-1 params. Runs each sim tick AFTER
// simulateTick (so it wins over stepSafety's walk for managed params only).
export function tickSafetyBridge(objects) {
  const s = objects['safety-1']
  if (!s) return
  const cur = s.parameters || {}
  let diff = false
  const next = { ...cur }
  for (const k of BRIDGED) {
    const v = liveSafety[k]
    if (v == null) continue
    if (next[k] !== v) { next[k] = v; diff = true }
  }
  if (diff) useSceneStore.getState().updateObject('safety-1', { parameters: next })
}
