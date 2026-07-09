// ─────────────────────────────────────────────────────────────────────────────
// Promise wrapper over the ThumbnailFactory queue: render ONE Component Spec
// offscreen and hand back a JPEG data-URL — the "eyes" of Bruce's critique
// loop. Rejects (never hangs) on empty geometry, render errors, or timeout;
// callers treat it as best-effort.
// ─────────────────────────────────────────────────────────────────────────────
import { useThumbStore } from '../../store/thumbStore'

export function snapshotSpec(spec, { timeoutMs = 15000, w = 640, h = 400 } = {}) {
  return new Promise((resolve, reject) => {
    const id = useThumbStore.getState().enqueueSpec(spec, { w, h })
    let settled = false
    let unsub = () => {}
    let timer
    const finish = (ok, val) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsub()
      ok ? resolve(val) : reject(val)
    }
    const check = (s) => {
      const hit = s.cache[id]
      if (hit) {
        finish(true, hit.url)                // settle FIRST — evict() below re-enters check()
        useThumbStore.getState().evict(id)   // one-shot — don't hold ~150 KB in memory
        return
      }
      // job vanished without a cache entry → the factory's fail() path fired
      if (!s.jobs.some(j => j.id === id)) finish(false, new Error('Snapshot failed (empty or render error).'))
    }
    unsub = useThumbStore.subscribe(check)
    timer = setTimeout(() => {
      finish(false, new Error('Snapshot timed out.'))   // settle FIRST — fail() below re-triggers check
      useThumbStore.getState().fail(id, '1')             // then dequeue so project thumbs keep flowing
    }, timeoutMs)
    check(useThumbStore.getState())
  })
}
