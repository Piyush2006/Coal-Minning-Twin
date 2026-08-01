// Throttled write-behind PersistStorage for zustand v5.
//
// The default persist storage JSON.stringifies the whole partialized state and
// writes localStorage synchronously on EVERY set() — with the 1 Hz simulator
// that was a ~250 KB main-thread serialize+write every second (the "stutter
// every second"). This adapter keeps the latest state snapshot BY REFERENCE
// and serializes+writes at most once per `waitMs`, flushing immediately on
// pagehide / tab-hide so structural edits always land before unload.
export function throttledStorage({ key, waitMs = 5000 }) {
  let pending = null
  let timer = null
  const flush = () => {
    timer = null
    if (!pending) return
    const v = pending
    pending = null
    try { localStorage.setItem(key, JSON.stringify(v)) }
    catch (e) { console.warn('[persist] scene write dropped (quota?)', e) }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  }
  return {
    getItem: (k) => {
      const s = localStorage.getItem(k)
      return s ? JSON.parse(s) : null
    },
    setItem: (_k, value) => {
      pending = value                                  // no per-tick serialize — held by reference
      if (!timer) timer = setTimeout(flush, waitMs)    // trailing throttle: <= 1 write / waitMs
    },
    removeItem: (k) => { pending = null; localStorage.removeItem(k) },
  }
}
