import { create } from 'zustand'

// In-memory 3D-thumbnail cache + capture queue (NOT persisted, never sent to the
// cloud). The ThumbnailFactory renders queued scenes in a hidden Canvas and writes
// the captured JPEG dataURL back here; ProjectCard reads the cache (falling back to
// the 2D schematic) and enqueues (re)generation when its entry is missing or stale.
//   sig = String(project.updatedAt) — a save bumps updatedAt, invalidating the thumb.
export const useThumbStore = create((set, get) => ({
  cache: {},   // { [projectId]: { sig, url } }
  jobs: [],    // [{ id, scene, sig }] — processed one at a time, jobs[0] is current

  enqueue: ({ id, scene, sig }) => {
    const { cache, jobs } = get()
    if (cache[id]?.sig === sig) return                         // already have a fresh thumb
    if (jobs.some(j => j.id === id && j.sig === sig)) return    // already queued
    // drop any stale job for the same project, then append the fresh one
    set({ jobs: [...jobs.filter(j => j.id !== id), { id, scene, sig }] })
  },

  complete: (id, sig, url) => set(s => ({
    cache: { ...s.cache, [id]: { sig, url } },
    jobs: s.jobs.filter(j => !(j.id === id && j.sig === sig)),
  })),

  // Drop a job that failed to capture, so the queue keeps moving.
  fail: (id, sig) => set(s => ({ jobs: s.jobs.filter(j => !(j.id === id && j.sig === sig)) })),

  // ── one-off component-spec snapshots (Bruce's vision critique loop) ──
  // Renders a single CompositeAsset spec instead of a whole scene; the caller
  // awaits the cache entry via snapshotSpec() and evicts it when done.
  enqueueSpec: (spec, { w = 640, h = 400 } = {}) => {
    const id = `spec_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
    set(s => ({ jobs: [...s.jobs, { id, kind: 'spec', spec, sig: '1', w, h }] }))
    return id
  },
  evict: (id) => set(s => { const cache = { ...s.cache }; delete cache[id]; return { cache } }),
}))
