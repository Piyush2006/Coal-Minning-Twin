// Asset helpers shared across the dashboard. Integration of "today" figures and
// stockpile levels now lives in the coherent mineModel; these are pure readers
// over the live objects map (no state), imported by mineModel and the cards.
export function fleetRunning(objects) {
  const fleet = Object.values(objects).filter(o => ['haul_truck', 'mining_excavator', 'wheel_loader', 'blasthole_drill_rig'].includes(o.type))
  const run = fleet.filter(o => o.status === 'running').length
  return { run, total: fleet.length }
}
export function stockOnGround(objects) {
  return (Number(objects['pile-1']?.parameters?.stockTonnes) || 0) + (Number(objects['pile-2']?.parameters?.stockTonnes) || 0)
}
export function lowestRul(objects) {
  let h = Infinity, name = '—'
  for (const o of Object.values(objects)) {
    if (o.config?.hidden || isRoad(o)) continue
    const r = Number(o.parameters?.rulHours)
    if (Number.isFinite(r) && r < h) { h = r; name = o.name }
  }
  return Number.isFinite(h) ? { h: Math.round(h), name } : { h: null, name: '—' }
}
export function worstVibration(objects) {
  let v = 0, name = '—'
  for (const o of Object.values(objects)) {
    if (o.config?.hidden || isRoad(o)) continue
    const vv = Number(o.parameters?.vibration ?? o.parameters?.vibrationRms)
    if (Number.isFinite(vv) && vv > v) { v = vv; name = o.name }
  }
  return { v: Math.round(v * 10) / 10, name }
}
export function wagonsLoaded(objects) {
  return Object.values(objects).filter(o => o.type === 'coal_wagon' && (Number(o.parameters?.coalHeap ?? 1) > 0)).length
}
// non-machine types excluded from health / asset lists (integrity rule)
const NON_ASSET = new Set(['haul_road', 'PitTerrain', 'TerrainMound', 'site_safety', 'flood_light', 'windsock', 'cv_camera', 'PipeSegment', 'Valve'])
export function isRoad(o) { return NON_ASSET.has(o.type) }
export function isMachine(o) { return o.status && !o.config?.hidden && !NON_ASSET.has(o.type) }
