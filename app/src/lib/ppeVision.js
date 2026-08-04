// PPE-vision detection. For each ppe_camera, find the workers standing in its
// watched area (a radius around config.watch.point), classify each one's PPE
// from its LIVE config.ppe (helmet / hi-vis / boots / gloves), and:
//   • write the camera's ppeDetected / ppeViolations / complianceRate params
//     (→ existing alertRules fire, drill-down sparklines record, watchLed glows);
//   • expose per-camera detections for the feed multi-box overlay;
//   • report site-wide PPE compliance into the liveSafety bridge (→ mineModel
//     ppeCompliance → dashboard workers row).
// Runs at 1 Hz from the existing sim tick (clone of tickMineModel), NOT per frame.
import { workerPosMap } from './workerPosMap'
import { liveSafety } from './liveSafety'
import { useSceneStore } from '../store/sceneStore'

export const PPE_ITEMS = ['helmet', 'hiVis', 'boots', 'gloves']
export const PPE_LABEL = { helmet: 'Helmet', hiVis: 'Hi-Vis', boots: 'Boots', gloves: 'Gloves' }
const COMPLIANCE_WEIGHT = 4.8   // each missing item costs 4.8% site compliance (TCS band)

const camDetections = new Map()  // camId -> [{ id, compliant, missing:[keys], pos:[x,y,z], conf }]
export function ppeCameraDetections(camId) { return camDetections.get(camId) || [] }

const _seed = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return ((h >>> 0) % 1000) / 1000 }
const ppeOf = (obj) => ({ helmet: true, hiVis: true, boots: true, gloves: true, ...(obj?.config?.ppe || {}) })

// Site-wide compliance from EVERY worker's config (not just those in frame), so
// the dashboard number reflects the whole crew. 100 − missingItems·4.8, floored
// at 90 (one helmet off → 95.2, amber against the ppe band warn=98).
export function siteCompliance(objects) {
  let missing = 0, workers = 0
  for (const id in objects) {
    const o = objects[id]
    if (o.type !== 'site_worker') continue
    workers++
    const ppe = ppeOf(o)
    for (const k of PPE_ITEMS) if (ppe[k] === false) missing++
  }
  if (!workers) return 100
  return Math.max(90, Math.min(100, 100 - missing * COMPLIANCE_WEIGHT))
}

// One detection pass. Called once per sim tick with the current objects map.
export function tickPpeVision(objects) {
  const store = useSceneStore.getState()
  for (const id in objects) {
    const cam = objects[id]
    if (cam.type !== 'ppe_camera') continue
    const watch = cam.config?.watch
    if (!Array.isArray(watch?.point)) { camDetections.set(id, []); continue }
    const cx = watch.point[0], cz = watch.point[2]
    const radius = watch.radius ?? 14
    const dets = []
    for (const [wid, w] of workerPosMap) {
      const dx = w.pos.x - cx, dz = w.pos.z - cz
      if (Math.hypot(dx, dz) > radius) continue
      const wo = objects[wid]
      if (!wo) continue
      const ppe = ppeOf(wo)
      const missing = PPE_ITEMS.filter(k => ppe[k] === false)
      dets.push({ id: wid, compliant: missing.length === 0, missing, pos: [w.pos.x, w.pos.y, w.pos.z], conf: 90 + Math.round(_seed(wid) * 7) })
    }
    camDetections.set(id, dets)
    // write params (guarded — only on change, so no needless re-render)
    const violations = dets.filter(d => !d.compliant).length
    const rate = dets.length ? Math.round((1 - violations / dets.length) * 100) : 100
    const p = cam.parameters || {}
    if (p.ppeDetected !== dets.length || p.ppeViolations !== violations || p.complianceRate !== rate) {
      store.updateObject(id, { parameters: { ...p, ppeDetected: dets.length, ppeViolations: violations, complianceRate: rate } })
    }
  }
  // site compliance → bridge (mineModel reads liveSafety.ppeCompliance)
  liveSafety.ppeCompliance = siteCompliance(objects)
}
