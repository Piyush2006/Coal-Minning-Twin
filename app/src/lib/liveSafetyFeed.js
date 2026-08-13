// Live safety feed — the bridge from TWIN scripted safety events (PPE violation
// scans, proximity near-misses) into the MANAGEMENT dashboard's Safety data.
// The twin pushes management-dashboard-shaped evidence records here; the
// dashboard's buildSafety() merges them into the evidence log + violation counts
// (so a violation seen in the 3D twin shows up on the Safety tab in real time).
import { create } from 'zustand'

export const useLiveSafetyFeed = create((set, get) => ({
  events: [],
  // e: { cat, severity, description, location, camera } — id/ts/image filled in
  push: (e) => {
    const evts = get().events
    const now = Date.now()
    // de-dupe: ignore an identical (cat+description) event within 4s of the last
    if (evts[0] && evts[0].cat === e.cat && evts[0].description === e.description && now - evts[0].ts < 4000) return
    const rec = {
      id: `live-${now}-${evts.length}`,
      ts: now,
      cat: e.cat, severity: e.severity || 'High',
      description: e.description, location: e.location || 'Site',
      camera: e.camera || 'CV-01',
      confidence: e.confidence || 95,
      image: e.image || (e.cat === 'PPE' ? '/vision/ppe_compliance.webp' : '/vision/lane_monitoring.webp'),
      resolved: false, live: true,
    }
    set({ events: [rec, ...evts].slice(0, 40) })
  },
  clear: () => set({ events: [] }),
}))

// non-React accessor for the twin's per-frame code
export const pushLiveSafety = (e) => useLiveSafetyFeed.getState().push(e)

if (import.meta.env.DEV && typeof window !== 'undefined') window.__pushSafety = pushLiveSafety
