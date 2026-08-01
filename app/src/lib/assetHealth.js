// Asset-health model for the Overview rail. Derives EVERYTHING from the
// existing asset registry + the live alerts array (the same single source the
// status rings read) — no second derivation, no per-tick randomness.
// Health scores are seeded per asset id and move only when the alert band or
// count changes.

// monitored equipment only — scenery, people, sensors and vessels excluded
export const MONITORED_TYPES = new Set([
  'mining_excavator', 'haul_truck', 'wheel_loader', 'blasthole_drill_rig',
  'primary_crusher', 'vibrating_screen', 'ConveyorBelt', 'chpp_dmc_module',
  'thickener', 'Pump', 'stacker_reclaimer', 'rail_loadout', 'locomotive',
  'coal_wagon', 'shiploader', 'blending_plant', 'power_station',
])

// camera → belt fallback for cameras whose watch config points at a
// connection rather than the conveyor asset itself
const CAMERA_BELT_MAP = { 'cam-7': 'cv-01', 'cam-8': 'cv-01' }

export function beltForCamera(objects, camId) {
  const w = objects[camId]?.config?.watch
  if (w?.assetId && objects[w.assetId]) return w.assetId
  if (CAMERA_BELT_MAP[camId] && objects[CAMERA_BELT_MAP[camId]]) return CAMERA_BELT_MAP[camId]
  if (w?.sourceId && objects[w.sourceId]) return w.sourceId
  return null
}

// deterministic [0,1) from the asset id — stable across ticks and sessions
function seeded(id) {
  let h = 1779033703 ^ id.length
  for (let i = 0; i < id.length; i++) { h = Math.imul(h ^ id.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const BAND_RANK = { red: 0, amber: 1, green: 2 }

export function assetHealthModel(objects, alerts) {
  // effective per-asset alerts: camera detections attach to the belt they watch
  const byAsset = new Map()
  for (const a of alerts) {
    const src = objects[a.objId]
    let tid = a.objId, cam = null
    if (src?.type === 'cv_camera') {
      const belt = beltForCamera(objects, a.objId)
      if (belt) { tid = belt; cam = (src.name || a.objId).replace(/^CV Cam - /, '') }
    }
    if (!byAsset.has(tid)) byAsset.set(tid, [])
    byAsset.get(tid).push({ ...a, cam })
  }
  const rows = []
  for (const id in objects) {
    const o = objects[id]
    if (!MONITORED_TYPES.has(o.type) || o.config?.hidden) continue
    const list = byAsset.get(id) ?? []
    const worst = list.find(a => a.severity === 'critical') ?? list[0] ?? null
    const band = worst ? (worst.severity === 'critical' ? 'red' : 'amber') : 'green'
    const r = seeded(id)
    const floor = band === 'red' ? 25 : band === 'amber' ? 60 : 88
    const span = band === 'green' ? 11 : 15
    const health = Math.min(99, Math.round(Math.max(floor, floor + r * span - Math.max(0, list.length - 1) * 4)))
    const recent = list.reduce((m, a) => Math.max(m, a.since || 0), 0)
    rows.push({ id, name: o.name ?? id, band, health, alerts: list, worst, recent })
  }
  rows.sort((x, y) => x.health - y.health || BAND_RANK[x.band] - BAND_RANK[y.band] || y.recent - x.recent || x.name.localeCompare(y.name))
  const counts = {
    red: rows.filter(r2 => r2.band === 'red').length,
    amber: rows.filter(r2 => r2.band === 'amber').length,
    green: rows.filter(r2 => r2.band === 'green').length,
  }
  return { rows, counts }
}
