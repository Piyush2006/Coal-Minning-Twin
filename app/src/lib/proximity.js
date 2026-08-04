// Collision & proximity math + shared state for the Stage-4 layer. The zones are
// ASYMMETRIC (a haul truck's rear blind-spot extends ~2x its front), so the test
// is an egg-shaped ellipse in the vehicle's own frame, not a circle. Pure helpers
// here; the layer component drives detection + auto-stop + rendering.

export const proximityStateMap = new Map()   // objId (vehicle or worker) -> 'ok' | 'warn' | 'danger'
export function proximityState(id) { return proximityStateMap.get(id) || 'ok' }

// per-type zone extents (metres): f = front, r = rear (blind spot), s = side.
export const PROX_ZONES = {
  haul_truck:    { outer: { f: 14, r: 26, s: 9 },   inner: { f: 7, r: 13, s: 5 } },
  light_vehicle: { outer: { f: 8, r: 15, s: 6 },    inner: { f: 4, r: 8, s: 3.5 } },
  mining_excavator: { outer: { f: 11, r: 11, s: 11 }, inner: { f: 6, r: 6, s: 6 } },
}
export const zonesFor = (type) => PROX_ZONES[type] || PROX_ZONES.haul_truck

// A target (tx,tz) relative to a vehicle at (vx,vz) heading `yaw` (vehicle forward
// = +X → world (cos yaw, -sin yaw)). Returns {long, lat, inside} for the given
// extent set — long>0 ahead, long<0 behind; the longitudinal extent switches
// front→rear by sign, giving the asymmetric egg.
export function zoneTest(vx, vz, yaw, tx, tz, z) {
  const dx = tx - vx, dz = tz - vz
  const c = Math.cos(yaw), s = Math.sin(yaw)
  const long = dx * c - dz * s          // + ahead, - behind
  const lat = dx * s + dz * c           // lateral offset
  const extL = long >= 0 ? z.f : z.r
  const inside = (long / extL) ** 2 + (lat / z.s) ** 2 <= 1
  return { long, lat, inside }
}

// Boundary outline of an egg zone in the vehicle's local XZ frame (x = forward,
// z = lateral), for drawing the ring + fill. front half uses f, rear half r.
export function zoneOutline(f, r, s, N = 48) {
  const pts = []
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2
    const extL = Math.cos(th) >= 0 ? f : r
    pts.push([extL * Math.cos(th), s * Math.sin(th)])   // [x=long, z=lat]
  }
  return pts
}
