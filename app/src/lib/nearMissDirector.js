// Scripted near-miss — deterministic, repeatable on cue (tour action or dev
// trigger). A dedicated "phantom" worker is placed on the haul road AHEAD of a
// moving truck; the REAL proximity geometry then does the rest — the truck's
// forward zone catches the worker, Stage-2 easing brings it to a genuine
// AUTO-STOP, the distance label counts down, and safety-1 proximityEvent flips
// (→ the existing prox-crit critical rule → Proximity row). After a hold the
// worker steps clear and the truck resumes.
//
// Why a phantom (not a real site_worker moved via updateObject): the 1 Hz sim
// tick rebuilds the objects map and would restore a moved worker to its spec
// position within a second. The phantom is a plain module-controlled point that
// the NearMissActor renders (a real SiteWorker figure) and registers in
// workerPosMap — so the proximity system sees it like any worker, but nothing in
// the store/sim can revert it.
import { useSceneStore } from '../store/sceneStore'
import { vehicleState } from './vehicleMotion'
import { useSafetyLayer } from './safetyLayer'

export const phantom = { active: false, x: 5000, y: 0, z: 5000 }   // parked far in X/Z when idle
let retreatTimer = null

// nearest truck that is actually rolling (not dwelling), so it drives up to the
// worker within the hold window.
function pickTruck(objects) {
  let best = null, bestV = 0
  for (const id of ['truck-1', 'truck-2', 'truck-3']) {
    const st = vehicleState(id)
    if (st && st.initDone && st.v > bestV) { bestV = st.v; best = { id, st } }
  }
  return best
}

export function startNearMiss({ truckId = null, holdMs = 8000 } = {}) {
  stopNearMiss()
  const store = useSceneStore.getState()
  const chosen = truckId ? { id: truckId, st: vehicleState(truckId) } : pickTruck(store.objects)
  const truck = chosen?.st
  if (!truck || !truck.initDone) return false
  // PathDrive publishes a point ~20 m AHEAD along the curve (in travel order), so
  // the truck is guaranteed to drive up to it — no straight-extrapolation misses,
  // no waypoint that was actually just passed.
  phantom.x = truck.aheadX; phantom.y = truck.aheadY; phantom.z = truck.aheadZ; phantom.active = true
  useSafetyLayer.getState().setOn(true)
  retreatTimer = setTimeout(() => { phantom.active = false; retreatTimer = null }, holdMs)
  return chosen.id
}

export function stopNearMiss() {
  if (retreatTimer) { clearTimeout(retreatTimer); retreatTimer = null }
  phantom.active = false
}
export function nearMissActive() { return phantom.active }
