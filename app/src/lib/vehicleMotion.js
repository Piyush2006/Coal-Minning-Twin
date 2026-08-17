// Per-vehicle kinematic state for smooth, STATEFUL path motion. Module map
// (the pathFillMap / loadStateMap pattern) so nothing re-renders and so other
// systems can stack speed targets and hard stops onto a moving vehicle without
// prop-drilling. PathDrive owns the
// curve geometry and calls in here to integrate; this owns the state and the
// reason-stack API.
//
// Before this, PathDrive was pure f(t): position = curve.getPointAt(elapsed%cycle)
// with an instantaneous atan2 yaw (the visible "snap" at every corner). Now each
// vehicle carries {arc, v, yaw, pitch, roll, …}; velocity eases toward a target
// that is the MIN of its cruise speed, a curvature limit, an anticipated dwell
// stop, and any external speed caps / hard stops. Curves are unchanged, so
// path-validation still holds.

// accel / decel (m/s²) by asset type. Trucks are heavy (gentle), light vehicles
// nimble, workers effectively instant so Stage-1 gait is unaffected.
export const ACCEL_BY_TYPE = {
  haul_truck:        { accel: 1.0, decel: 1.7 },
  mining_excavator:  { accel: 0.8, decel: 1.2 },
  wheel_loader:      { accel: 1.0, decel: 1.6 },
  blasthole_drill_rig: { accel: 0.8, decel: 1.2 },
  light_vehicle:     { accel: 2.5, decel: 3.5 },
  site_worker:       { accel: 8.0, decel: 10.0 },
}
const DEFAULT_ACCEL = { accel: 1.2, decel: 1.8 }
export const accelFor = (type) => ACCEL_BY_TYPE[type] || DEFAULT_ACCEL

const S = new Map()   // objId -> state

export function vehicleMotion(id) {
  let st = S.get(id)
  if (!st) {
    st = {
      arc: 0, v: 0, yaw: 0, prevV: 0,
      pitch: 0, roll: 0, settle: 0,       // body dynamics
      dwellT: 0,                          // remaining dwell seconds (>0 = parked at wp0)
      wx: 0, wy: 0, wz: 0,                // live world position (written by PathDrive)
      targets: new Map(),                 // reason -> speed cap (m/s)
      stops: new Set(),                   // reasons forcing a hard stop
      initDone: false,
    }
    S.set(id, st)
  }
  return st
}
export function clearVehicle(id) { S.delete(id) }
export function vehicleState(id) { return S.get(id) || null }   // read-only peek

// ── reason-stacked speed caps + hard stops ────────────────────────────────
// Multiple systems (dwell, convoy…) can each pin a cap or a stop under their
// own reason; they compose without clobbering each other.
export function setSpeedTarget(id, target, reason) { vehicleMotion(id).targets.set(reason, target) }
export function clearSpeedTarget(id, reason) { const st = S.get(id); if (st) st.targets.delete(reason) }
export function requestStop(id, reason) { vehicleMotion(id).stops.add(reason) }
export function releaseStop(id, reason) { const st = S.get(id); if (st) st.stops.delete(reason) }
export function hasStop(id, reason) { const st = S.get(id); return !!st && st.stops.has(reason) }
export function isHalted(id) { const st = S.get(id); return !!st && st.v < 0.06 && (st.stops.size > 0 || st.dwellT > 0) }

// Effective speed cap = 0 if any hard stop, else the tightest of the cruise cap
// and every external speed target.
export function effectiveCap(st, cruiseCap) {
  if (st.stops.size) return 0
  let t = cruiseCap
  for (const val of st.targets.values()) if (val < t) t = val
  return t
}

// One integration step toward `target` with asymmetric accel/decel. Advances
// arc by v·dt. Frame-rate independent; caller clamps dt.
export function integrate(st, target, accel, decel, dt) {
  st.prevV = st.v
  const dv = target - st.v
  const a = dv >= 0 ? accel : decel
  const stepMag = Math.min(Math.abs(dv), a * dt)
  st.v += Math.sign(dv) * stepMag
  if (st.v < 0) st.v = 0
  st.arc += st.v * dt
  return st.v
}

// Anticipatory braking: the max speed from which a vehicle can still decelerate
// to a full stop within `dist` metres (v² = 2·decel·dist). Used to ease INTO
// the dwell at waypoint 0 instead of screeching to a halt on top of it.
export const stoppingSpeed = (dist, decel) => Math.sqrt(Math.max(0, 2 * decel * dist))

// ── convoy master clocks — one per shared loop (path.convoy) ──────────────
// All members of a loop are pinned at EQUAL arc offsets from a single master
// arc-clock, so their spacing is constant by construction: they can never
// catch up, lap, or overlap. The clock's speed is the MIN of every member's
// local allowance (curvature, loading-crawl zone, external caps/hard stops),
// so a stop on any one truck freezes the whole circuit — exactly what a
// blocked one-lane haul road does.
const CONVOYS = new Map()   // pathKey -> { arc, v, members: Map, frame, inited }
export function convoyFor(key) {
  let c = CONVOYS.get(key)
  if (!c) { c = { arc: 0, v: 0, members: new Map(), frame: -1, inited: false }; CONVOYS.set(key, c) }
  return c
}
export function convoyLeave(key, id) {
  const c = CONVOYS.get(key)
  if (c) { c.members.delete(id); if (!c.members.size) CONVOYS.delete(key) }
}
