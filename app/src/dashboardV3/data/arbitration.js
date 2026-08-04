// Loss-attribution (cascade arbitration) engine — the product's centrepiece.
// Pure, dependency-free, consumed identically by the fixture recorder, the test
// suite and (later) the live plane.
//
// INPUT — a per-minute table of the production chain, upstream → downstream:
//   shift = {
//     stages: [{ id, bucket }...]            // order matters; bucket ∈ BUCKETS
//     rated:  { [stageId]: t/min }           // rated capability (loss-free reference)
//     minutes: [{
//       cap:   { [stageId]: t/min },         // effective capability THIS minute (derates, chokes, downtime)
//       state: { [stageId]: 'running'|'down'|'idle' },
//       cause: { [stageId]: 'own'|'external'|'justified'|null },
//       buf:   { [stageId]: t },             // level of the buffer AFTER this stage (absent = no buffer)
//       bufCap:{ [stageId]: t },             // capacity of that buffer
//       boundaryAct: t/min,                  // what actually crossed the mine output boundary
//     }...]
//   }
//
// RULES (in order, from the approved spec):
//   1. Loss is measured at the boundary only; buckets sum to plan − actual exactly.
//   2. Downtime on a non-constraint costs zero unless it moves the constraint.
//   3. Buffered minutes are free — loss starts at buffer exhaustion.
//   4. blocked / starved are zero-tonnage consequences nested under the root.
//   5. The root cause owns the full tonnage for the window it constrains.
//   6. Constraint migration re-attributes per minute.
//
// OUTPUT: { R, plan, actual, buckets, events[], perMinute[], reconciles }
//   plan = Σ R  (the loss-free reference — "plan is a derived number")
//   residual bucket absorbs unexplained shortfall so rule 1 holds by construction.

const EPS = 1e-6
export const BUCKETS = ['faceLoading', 'haulage', 'crushing', 'chp', 'dispatch', 'external', 'residual']

export function arbitrate(shift) {
  const { stages, rated, minutes } = shift
  const n = stages.length
  const idx = Object.fromEntries(stages.map((s, i) => [s.id, i]))
  // loss-free reference rate: the rated bottleneck of the chain
  const R = Math.min(...stages.map(s => rated[s.id]))

  const perMinute = []
  const buckets = Object.fromEntries(BUCKETS.map(b => [b, 0]))
  let actual = 0

  for (let m = 0; m < minutes.length; m++) {
    const mm = minutes[m]
    actual += mm.boundaryAct
    const lossM = Math.max(0, R - mm.boundaryAct)

    // ── classify every stage this minute ──
    // starved/blocked are judged against the CHAIN reference R, not the stage's
    // own rating — an oversized crusher behind a smaller face is not "starved",
    // it is normal operation.
    const cls = {}
    for (let i = 0; i < n; i++) {
      const s = stages[i]
      const st = mm.state[s.id] ?? 'running'
      const cause = mm.cause[s.id] ?? null
      const upBufEmpty = i > 0 && (mm.buf[stages[i - 1].id] ?? Infinity) <= EPS
      const upShort = i > 0 && (mm.cap[stages[i - 1].id] ?? Infinity) < R - EPS
      const downBufFull = (mm.buf[s.id] != null && mm.bufCap[s.id] != null) && mm.buf[s.id] >= mm.bufCap[s.id] - EPS
      if (st === 'down' && cause === 'own') cls[s.id] = 'down-own-cause'
      else if ((st === 'idle' || st === 'down') && (cause === 'justified' || cause === 'external')) cls[s.id] = 'idle-justified'
      else if (st !== 'down' && upBufEmpty && upShort) cls[s.id] = 'starved'
      else if (downBufFull && (mm.cap[stages[i + 1]?.id] ?? Infinity) < R - EPS) cls[s.id] = 'blocked'
      else cls[s.id] = 'running'
    }

    // ── find the binding root (rule 5) ──
    // candidates: stages whose OWN capability is below the reference rate.
    // a candidate binds the boundary only if every buffer between it and the
    // boundary is exhausted (rule 3 — buffered minutes are free).
    let root = null
    if (lossM > EPS) {
      let best = null
      for (let i = 0; i < n; i++) {
        const s = stages[i]
        if ((mm.cap[s.id] ?? rated[s.id]) >= R - EPS) continue
        let reaches = true
        for (let j = i; j < n - 1; j++) {
          if ((mm.buf[stages[j].id] ?? 0) > EPS) { reaches = false; break }
        }
        if (!reaches) continue
        if (!best || mm.cap[s.id] < mm.cap[best.id] - EPS) best = s
      }
      root = best
    }

    // ── attribute the minute's loss (rules 1, 2, 6) ──
    let bucket = null
    if (lossM > EPS) {
      const cause = root ? mm.cause[root.id] : null
      if (root && cause) {
        bucket = (cause === 'external' || cause === 'justified') ? 'external' : root.bucket
      } else {
        // no reachable cause, or capability merely dipped with no named event
        // (flow texture) — reported honestly as residual, never smeared onto a
        // stage bucket
        bucket = 'residual'
        if (root == null || !cause) root = null
      }
      buckets[bucket] += lossM
    }

    perMinute.push({ m, loss: lossM, root: root?.id ?? null, bucket, cls })
  }

  // ── group consecutive same-root minutes into events, nest consequences (rule 4) ──
  const events = []
  let cur = null
  for (const pm of perMinute) {
    const key = pm.root ?? (pm.bucket === 'residual' && pm.loss > EPS ? '·residual' : null)
    if (key && cur && cur.key === key) {
      cur.end = pm.m; cur.tonnes += pm.loss
      for (const [sid, c] of Object.entries(pm.cls)) {
        if ((c === 'starved' || c === 'blocked') && sid !== pm.root) {
          cur.consequences[sid] = cur.consequences[sid] || { kind: c, minutes: 0 }
          cur.consequences[sid].minutes++
        }
      }
    } else if (key) {
      if (cur) events.push(cur)
      cur = { key, root: pm.root, bucket: pm.bucket, start: pm.m, end: pm.m, tonnes: pm.loss, consequences: {} }
      for (const [sid, c] of Object.entries(pm.cls)) {
        if ((c === 'starved' || c === 'blocked') && sid !== pm.root) cur.consequences[sid] = { kind: c, minutes: 1 }
      }
    } else if (cur) { events.push(cur); cur = null }
  }
  if (cur) events.push(cur)

  const plan = R * minutes.length
  const lossTotal = Object.values(buckets).reduce((a, b) => a + b, 0)
  const reconciles = Math.abs((plan - actual) - lossTotal) < 1e-3
  return { R, plan, actual, buckets, events, perMinute, reconciles }
}

/* helper for building per-minute tables in tests and in the recorder */
export function minuteRow(stages, rated, over = {}) {
  const cap = {}, state = {}, cause = {}, buf = {}, bufCap = {}
  for (const s of stages) {
    cap[s.id] = over.cap?.[s.id] ?? rated[s.id]
    state[s.id] = over.state?.[s.id] ?? 'running'
    cause[s.id] = over.cause?.[s.id] ?? null
    if (over.buf && s.id in over.buf) buf[s.id] = over.buf[s.id]
    if (over.bufCap && s.id in over.bufCap) bufCap[s.id] = over.bufCap[s.id]
  }
  return { cap, state, cause, buf, bufCap, boundaryAct: over.boundaryAct ?? 0 }
}
