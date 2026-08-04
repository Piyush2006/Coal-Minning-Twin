// Screen-0 derivations over the fixture — computed once per fixture load and
// memoised; the scrubber then indexes into precomputed arrays (never transforms
// in render). All tonnage displayed on screen goes through largestRemainder so
// rendered integers always reconcile (item 1).
import { BUCKETS } from '../data/arbitration'
import { applyAlertPolicy } from '../data/alertPolicy'

export const BUCKET_LABEL = {
  crushing: 'Crushing', faceLoading: 'Face / Loading', dispatch: 'Dispatch',
  external: 'External', residual: 'Residual', haulage: 'Haulage', chp: 'CHP',
}
export const STAGE_LABEL = {
  face: 'Face / Loading', haul: 'Haulage', crush: 'Crushing CR-01', chp: 'CHP', dispatch: 'Dispatch',
}

const memo = new WeakMap()
export function deriveShift(fx) {
  if (memo.has(fx)) return memo.get(fx)
  const man = fx.manifest
  const arb = man.arbitration
  const pm = arb.perMinute
  const N = pm.length
  const R = arb.R                                     // t/min reference

  // cumulative actual + per-bucket accrual, minute-indexed
  const cumActual = new Float64Array(N + 1)
  const cumBuckets = {}
  for (const b of BUCKETS) cumBuckets[b] = new Float64Array(N + 1)
  for (let m = 0; m < N; m++) {
    cumActual[m + 1] = cumActual[m] + (R - pm[m].loss)
    for (const b of BUCKETS) cumBuckets[b][m + 1] = cumBuckets[b][m] + (pm[m].bucket === b ? pm[m].loss : 0)
  }

  // constraint-of-record shares (loss-weighted minutes per binding root);
  // external-cause windows keep their own identity (never shown as the stage)
  const rootAtMin = pm.map(p => (p.loss > 0.05 ? (p.bucket === 'external' ? '·external' : p.root ?? '·residual') : null))

  // 30-day baseline for the projection comparator (per-shift thirds of daily totals)
  const events = man.arbitration.events
  const out = {
    N, R,
    plan: arb.plan, actual: arb.actual, buckets: arb.buckets, events,
    chainEvents: man.chainEvents, alertsRaw: man.alerts,
    cumActual, cumBuckets, rootAtMin,
    t0: man.t0,
    fmt(m) { return new Date(man.t0 + m * 60000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) },

    atMinute(m) {
      m = Math.max(0, Math.min(N, Math.round(m)))
      const actual = cumActual[m]
      const planTo = R * m
      const buckets = {}
      let lossTotal = 0
      for (const b of BUCKETS) { buckets[b] = cumBuckets[b][m]; lossTotal += buckets[b] }
      // projection: trailing 60-min realised rate ± 1σ → close
      const w = Math.min(60, m)
      const rates = []
      for (let i = m - w; i < m; i++) rates.push(cumActual[i + 1] - cumActual[i])
      const rate = w ? (actual - cumActual[m - w]) / w : R
      const sd = rates.length ? Math.sqrt(rates.reduce((a, r) => a + (r - rate) ** 2, 0) / rates.length) : 0
      const rem = N - m
      const proj = actual + rate * rem
      return {
        m, actual, planTo, attain: planTo > 0 ? actual / planTo : 1,
        buckets, lossTotal,
        proj, projLo: actual + Math.max(0, rate - sd) * rem, projHi: actual + (rate + sd) * rem,
        rate,
      }
    },

    constraintShares(m) {
      const counts = {}
      let total = 0
      for (let i = 0; i < Math.min(m, N); i++) {
        const r = rootAtMin[i]
        if (!r || r === '·residual') continue
        counts[r] = (counts[r] || 0) + 1; total++
      }
      const list = Object.entries(counts).map(([root, mins]) => ({ root, mins, share: mins / Math.max(1, m) })).sort((a, b) => b.mins - a.mins)
      return { list, total, top: list[0] ?? null }
    },

    episodes(m) { return applyAlertPolicy(man.alerts, m * 60) },
  }
  memo.set(fx, out)
  return out
}

/* ── state-timeline rows (computed once — the scrubber only moves the cursor) ── */
const GANTT_ASSETS = [
  ['exc-coal-1', 'EX-02'], ['exc-ob-1', 'EX-01'], ['loader-1', 'WL-01'],
  ['truck-1', 'HT-01'], ['truck-2', 'HT-02'], ['truck-3', 'HT-03'], ['truck-4', 'HT-04'],
  ['truck-5', 'HT-05'], ['truck-6', 'HT-06'], ['truck-7', 'HT-07'], ['truck-8', 'HT-08'],
  ['crusher-1', 'CR-01'], ['screen-1', 'SC-01'], ['chpp-1', 'CHPP'], ['cv-01', 'CV-01'],
  ['stacker-1', 'SR-01'], ['loadout-1', 'TLO-01'], ['shiploader-1', 'SL-01'],
]
const COAL_TRUCKS = new Set(['truck-1', 'truck-2', 'truck-4', 'truck-5', 'truck-7'])

const ganttMemo = new WeakMap()
export function deriveGantt(fx) {
  if (ganttMemo.has(fx)) return ganttMemo.get(fx)
  const man = fx.manifest
  const chokeWin = man.chainEvents.filter(e => e.stage === 'crush' && e.state === 'down')
  const blastWin = man.chainEvents.filter(e => e.cause === 'external')
  const N = 480
  const rows = GANTT_ASSETS.filter(([id]) => fx.cols.includes(`${id}·§status`) || fx.cols.some(c => c.startsWith(id + '·'))).map(([id, label]) => {
    // sample status per minute → map to dv3 status keys → RLE runs
    const seq = []
    for (let m = 0; m < N; m++) {
      const t = man.t0 + (m * 60 + 30) * 1000
      const snap = fx.snapshot(t, [id])[id]
      let k = { running: 'operating', idle: 'idleJ', fault: 'downU', off: 'nodata' }[snap?.status ?? 'running']
      // idle semantics: queued behind the choke = UNjustified; blast window = justified
      if (k === 'idleJ') {
        const inChoke = chokeWin.some(w => m >= w.start && m < w.end + 10)
        if (COAL_TRUCKS.has(id) && inChoke) k = 'idleU'
        else if (!blastWin.some(w => m >= w.start - 2 && m < w.end + 4)) k = COAL_TRUCKS.has(id) ? 'idleU' : 'idleJ'
      }
      seq.push(k)
    }
    const runs = []
    for (let m = 0; m < N; m++) {
      const last = runs[runs.length - 1]
      if (last && last.k === seq[m]) last.len++
      else runs.push({ k: seq[m], start: m, len: 1 })
    }
    return { id, label, runs }
  })
  ganttMemo.set(fx, rows)
  return rows
}

/* twin navigator tree (static structure; live status dots come from snapshots) */
export const NAV_TREE = [
  { label: 'Mine Operations', assets: [['exc-coal-1', 'EX-02 Coal Shovel'], ['exc-ob-1', 'EX-01 OB Shovel'], ['loader-1', 'WL-01 Loader']] },
  { label: 'Haulage', assets: [['truck-1', 'HT-01'], ['truck-2', 'HT-02'], ['truck-3', 'HT-03'], ['truck-4', 'HT-04'], ['truck-5', 'HT-05'], ['truck-6', 'HT-06'], ['truck-7', 'HT-07'], ['truck-8', 'HT-08']] },
  { label: 'Crushing & Conveying', assets: [['crusher-1', 'CR-01 Crusher'], ['screen-1', 'SC-01 Screen'], ['cv-01', 'CV-01 Overland']] },
  { label: 'CHP & Stockyard', assets: [['chpp-1', 'CHPP DMC'], ['stacker-1', 'SR-01'], ['pile-1', 'Stockpile A']] },
  { label: 'Dispatch', assets: [['loadout-1', 'TLO-01 Rail'], ['shiploader-1', 'SL-01 Ship']] },
  { label: 'Site', assets: [['safety-1', 'Safety Monitor'], ['pm-1', 'PM Monitor']] },
]
