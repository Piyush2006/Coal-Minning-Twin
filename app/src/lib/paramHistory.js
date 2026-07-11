// In-memory ring buffers of recent parameter values for the drill-down
// sparklines. Deliberately tiny: recording starts when an asset's detail
// panel subscribes (nothing buffers for unwatched assets), one number array
// per displayed param, hard cap. Module-level — survives panel close/reopen
// within a session, costs nothing when idle.
const CAP = 64                        // ~last minute at the 1 Hz sim tick

const BUF = new Map()                 // `${objId}:${param}` → number[]

export function recordParam(objId, key, v) {
  if (!Number.isFinite(v)) return
  const k = objId + ':' + key
  let a = BUF.get(k)
  if (!a) { a = []; BUF.set(k, a) }
  if (a.length && a[a.length - 1] === v) return   // sim not ticked yet — skip dupes
  a.push(v)
  if (a.length > CAP) a.shift()
}

export function getParamHistory(objId, key) {
  return BUF.get(objId + ':' + key) ?? []
}
