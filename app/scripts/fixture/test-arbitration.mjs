// Arbitration gate suite — six hand-constructed cases with known answers, plus
// a seeded property sweep. Run: node scripts/fixture/test-arbitration.mjs
// Convention: buffer levels are recorded at minute END (post-draw).
import { arbitrate, minuteRow } from '../../src/dashboardV3/data/arbitration.js'

const STAGES = [
  { id: 'face', bucket: 'faceLoading' },
  { id: 'haul', bucket: 'haulage' },
  { id: 'crush', bucket: 'crushing' },
  { id: 'dispatch', bucket: 'dispatch' },
]
const RATED = { face: 12, haul: 11, crush: 10, dispatch: 14 }   // R = 10 (crusher)

let pass = 0, fail = 0
const eq = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}
const run = (minutes) => arbitrate({ stages: STAGES, rated: RATED, minutes })

/* ── 1. constraint stops for own fault → all loss to it ── */
{
  const mins = []
  for (let m = 0; m < 10; m++) mins.push(minuteRow(STAGES, RATED, { cap: { crush: 0 }, state: { crush: 'down' }, cause: { crush: 'own' }, buf: { crush: 0 }, bufCap: { crush: 60 }, boundaryAct: 0 }))
  const r = run(mins)
  console.log('Case 1 — constraint down, own fault')
  check('all 100 t to crushing', eq(r.buckets.crushing, 100), JSON.stringify(r.buckets))
  check('reconciles', r.reconciles)
}

/* ── 2. non-constraint stops, absorbed by spare capacity → zero loss ── */
{
  const mins = []
  for (let m = 0; m < 10; m++) mins.push(minuteRow(STAGES, RATED, { cap: { haul: 10.4 }, state: { haul: 'running' }, boundaryAct: 10 }))
  const r = run(mins)
  console.log('Case 2 — one truck down, fleet still feeds the crusher')
  check('zero loss in every bucket', Object.values(r.buckets).every(v => eq(v, 0)), JSON.stringify(r.buckets))
  check('no events', r.events.length === 0)
}

/* ── 3. downstream stops, upstream blocks → loss downstream, upstream = zero-t consequence ── */
{
  const mins = []
  for (let m = 0; m < 10; m++) mins.push(minuteRow(STAGES, RATED, {
    cap: { dispatch: 0 }, state: { dispatch: 'down' }, cause: { dispatch: 'own' },
    buf: { crush: 60 }, bufCap: { crush: 60 },            // product stockpile full → crusher blocked
    boundaryAct: 0,
  }))
  const r = run(mins)
  console.log('Case 3 — dispatch down, crusher blocked behind full stockpile')
  check('all 100 t to dispatch', eq(r.buckets.dispatch, 100), JSON.stringify(r.buckets))
  check('zero tonnes to crushing', eq(r.buckets.crushing, 0))
  const ev = r.events.find(e => e.root === 'dispatch')
  check('crusher nested as blocked consequence', ev && ev.consequences.crush?.kind === 'blocked' && ev.consequences.crush.minutes === 10, JSON.stringify(ev?.consequences))
}

/* ── 4. upstream stops, buffer drains, downstream starves → drain minutes free ── */
{
  const mins = []
  for (let m = 0; m < 20; m++) {
    const bufEnd = Math.max(0, 50 - (m + 1) * 10)          // 50 t cover, 10 t/min draw → 5 free minutes
    const covered = 50 - m * 10 > 0
    mins.push(minuteRow(STAGES, RATED, {
      cap: { crush: 0 }, state: { crush: 'down' }, cause: { crush: 'own' },
      buf: { crush: bufEnd }, bufCap: { crush: 60 },
      boundaryAct: covered ? 10 : 0,
    }))
  }
  const r = run(mins)
  console.log('Case 4 — crusher down 20 min, stockpile covers the first 5')
  check('loss = 150 t (15 min), not 200', eq(r.buckets.crushing, 150), JSON.stringify(r.buckets))
  const ev = r.events.find(e => e.root === 'crush')
  check('event starts at exhaustion (m=5)', ev && ev.start === 5, `start=${ev?.start}`)
  check('dispatch nested as starved', ev && ev.consequences.dispatch?.kind === 'starved', JSON.stringify(ev?.consequences))
  check('reconciles', r.reconciles)
}

/* ── 5. two simultaneous independent roots → correct split, no double count ── */
{
  const mins = []
  for (let m = 0; m < 10; m++) mins.push(minuteRow(STAGES, RATED, {   // face 6 binds; crusher 8 masked
    cap: { face: 6, crush: 8 }, state: { face: 'running', crush: 'running' }, cause: { face: 'own', crush: 'own' },
    buf: { crush: 0 }, bufCap: { crush: 60 }, boundaryAct: 6,
  }))
  for (let m = 0; m < 10; m++) mins.push(minuteRow(STAGES, RATED, {   // face recovers; crusher 8 now binds
    cap: { crush: 8 }, state: { crush: 'running' }, cause: { crush: 'own' },
    buf: { crush: 0 }, bufCap: { crush: 60 }, boundaryAct: 8,
  }))
  const r = run(mins)
  console.log('Case 5 — simultaneous face 6 + crusher 8, then crusher alone')
  check('face owns the overlap (40 t)', eq(r.buckets.faceLoading, 40), JSON.stringify(r.buckets))
  check('crusher owns only its solo window (20 t)', eq(r.buckets.crushing, 20))
  check('total = plan − actual (no double count)', r.reconciles && eq(r.plan - r.actual, 60))
}

/* ── 6. constraint migrates mid-event → per-minute re-attribution ── */
{
  const mins = []
  for (let m = 0; m < 10; m++) mins.push(minuteRow(STAGES, RATED, { cap: { crush: 4 }, state: { crush: 'down' }, cause: { crush: 'own' }, buf: { crush: 0 }, bufCap: { crush: 60 }, boundaryAct: 4 }))
  for (let m = 0; m < 10; m++) mins.push(minuteRow(STAGES, RATED, { cap: { face: 7 }, state: { face: 'running' }, cause: { face: 'own' }, buf: { crush: 0 }, bufCap: { crush: 60 }, boundaryAct: 7 }))
  const r = run(mins)
  console.log('Case 6 — choke, then fragmentation: constraint migrates')
  check('crushing 60 t · face 30 t', eq(r.buckets.crushing, 60) && eq(r.buckets.faceLoading, 30), JSON.stringify(r.buckets))
  check('two distinct events with correct windows', r.events.length === 2 && r.events[0].root === 'crush' && r.events[0].end === 9 && r.events[1].root === 'face' && r.events[1].start === 10, JSON.stringify(r.events.map(e => [e.root, e.start, e.end])))
}

/* ── property sweep: seeded generated shifts — reconciliation exact, residual ~0 ── */
{
  console.log('Property — 25 seeded shifts, mass-balanced generator')
  const mulberry = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  let allOk = true, maxResidualPct = 0
  for (let seed = 1; seed <= 25; seed++) {
    const rnd = mulberry(seed * 7919)
    const N = 120
    // random capability windows with causes
    const winFor = () => {
      const caps = Array(N).fill(null)
      if (rnd() < 0.8) {
        const s = Math.floor(rnd() * 80), len = 5 + Math.floor(rnd() * 40)
        const lvl = rnd() < 0.5 ? 0 : rnd() * 8
        for (let m = s; m < Math.min(N, s + len); m++) caps[m] = lvl
      }
      return caps
    }
    const ev = { face: winFor(), haul: winFor(), crush: winFor(), dispatch: winFor() }
    const causeOf = { face: rnd() < 0.3 ? 'external' : 'own', haul: 'own', crush: 'own', dispatch: 'own' }
    let buf = 30 + rnd() * 30                              // product stockpile
    const BUFCAP = 90
    const mins = []
    for (let m = 0; m < N; m++) {
      const cap = {}
      for (const id of ['face', 'haul', 'crush', 'dispatch']) cap[id] = ev[id][m] != null ? ev[id][m] : RATED[id]
      const supply = Math.min(cap.face, cap.haul, cap.crush)              // into the stockpile
      const inflow = Math.min(supply, BUFCAP - buf + Math.min(cap.dispatch, 999)) // cannot overfill
      const draw = Math.min(cap.dispatch, RATED.crush, buf + inflow)      // boundary demand ≤ R
      const act = Math.max(0, Math.min(draw, 10))
      buf = Math.max(0, Math.min(BUFCAP, buf + inflow - act))
      mins.push(minuteRow(STAGES, RATED, {
        cap,
        state: Object.fromEntries(Object.keys(cap).map(id => [id, cap[id] === 0 ? 'down' : 'running'])),
        cause: Object.fromEntries(Object.keys(cap).map(id => [id, ev[id][m] != null ? causeOf[id] : null])),
        buf: { crush: buf }, bufCap: { crush: BUFCAP },
        boundaryAct: act,
      }))
    }
    const r = run(mins)
    const residPct = (r.buckets.residual / Math.max(1, r.plan)) * 100
    maxResidualPct = Math.max(maxResidualPct, residPct)
    if (!r.reconciles || Object.values(r.buckets).some(v => v < -1e-9)) { allOk = false; console.log(`  ✗ seed ${seed}: reconciles=${r.reconciles} buckets=${JSON.stringify(r.buckets)}`) }
  }
  check('all 25 shifts reconcile exactly, no negative bucket', allOk)
  check(`worst residual ≤ 1.5% of plan (got ${maxResidualPct.toFixed(2)}%)`, maxResidualPct <= 1.5)
}

console.log(`\n${fail === 0 ? 'GATE PASS' : 'GATE FAIL'} — ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
