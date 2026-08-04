// Screen-0 state: the global scrubber (T3 — puts the whole screen into a past
// state) + fixture loading + selection. Replay plane only for now; the Live
// binding lands with plane unification (gated before Screen 4).
import { create } from 'zustand'
import { loadFixture } from '../data/fixtureStore'

export const SHIFT_MIN = 480

export const useScrub = create((set, get) => ({
  tMin: SHIFT_MIN,            // minutes from shift open; default = shift close
  playing: false,
  speed: 120,                 // replay speed ×
  selection: null,            // navigator-selected asset id
  drill: null,                // { bucket } | { bucket, event } — waterfall drill-down
  live: false,                // REPLAY (fixture) vs LIVE (now-only) plane
  liveReady: false,           // flipped on once plane unification lands (Prereq C)
  setT: (t) => set({ tMin: Math.max(0, Math.min(SHIFT_MIN, t)) }),
  setPlaying: (p) => set({ playing: p }),
  setSpeed: (s) => set({ speed: s }),
  setLive: (v) => set({ live: v, playing: false, ...(v ? { tMin: 0 } : {}) }),  // engage LIVE → stream from shift open
  setLiveReady: (v) => set({ liveReady: v }),
  select: (id) => set(s => ({ selection: s.selection === id ? null : id })),
  openDrill: (bucket) => set({ drill: { bucket } }),
  drillEvent: (event) => set(s => ({ drill: s.drill ? { ...s.drill, event } : { event } })),
  closeDrill: () => set({ drill: null }),
}))

// replay + live driver — call once from the screen root. In LIVE the plane
// streams the coherent shift forward in real time (60×) pinned to the live edge
// and the scrubber is locked; in REPLAY the play button drives it. The live
// data is the same mass-balanced shift the recorder produced, so there is no
// character discontinuity between planes and Screen 4's diagnosis has no hole.
let rafId = null
export function startReplayDriver() {
  let last = performance.now()
  const loop = (now) => {
    const { playing, speed, tMin, setT, setPlaying, live } = useScrub.getState()
    const dt = (now - last) / 1000
    last = now
    if (live) {
      const next = tMin + (dt * 60) / 60          // 60× live tail
      setT(next >= SHIFT_MIN ? SHIFT_MIN : next)  // hold at the live edge (shift close)
    } else if (playing) {
      const next = tMin + (dt * speed) / 60
      if (next >= SHIFT_MIN) { setT(SHIFT_MIN); setPlaying(false) }
      else setT(next)
    }
    rafId = requestAnimationFrame(loop)
  }
  if (!rafId) rafId = requestAnimationFrame(loop)
  return () => { cancelAnimationFrame(rafId); rafId = null }
}

// fixtures (module singletons — loaded once, shared by every component)
export const useFixtures = create((set) => ({ fx: null, hist: null, error: null }))
let loading = false
export function ensureFixtures() {
  if (loading) return
  loading = true
  Promise.all([loadFixture('/fixtures/golden-shift'), loadFixture('/fixtures/history-30d')])
    .then(([fx, hist]) => { useFixtures.setState({ fx, hist }); useScrub.getState().setLiveReady(true) })
    .catch((e) => useFixtures.setState({ error: String(e) }))
}
