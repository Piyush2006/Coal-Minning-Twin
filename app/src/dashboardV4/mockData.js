// Mock operations data for the two-screen operator dashboard. Deterministic per
// machine (seeded from its id) so it's stable across reloads/screenshots, and
// coherent per machine class. NOT tied to the 3D twin sim — it's presentation
// mock data by design.
//
// Every machine gets one 12-hour day shift (06:00–18:00) decomposed into four
// states — working / idle-on-job / idle-off-job / down — plus a downtime event
// log and a rejection-rate (quality) series.

export const SHIFT_MIN = 720          // 06:00 → 18:00
const START_H = 6
export const fmt = (min) => {
  const h = START_H + Math.floor(min / 60), m = Math.round(min) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// 4-state visual language (maps onto the dv3 status pattern system for CVD-safety)
export const STATE = {
  working: { patKey: 'operating', label: 'Working', color: '#12A16E' },
  idleOn: { patKey: 'idleJ', label: 'Idle · on job', color: '#E0A32E' },
  idleOff: { patKey: 'downP', label: 'Idle · off job', color: '#9AA4B4' },
  down: { patKey: 'downU', label: 'Down', color: '#E04B4B' },
}
export const STATE_ORDER = ['working', 'idleOn', 'idleOff', 'down']

// ── machine roster ──────────────────────────────────────────────────────────
export const MINING_GROUPS = [
  {
    group: 'Drilling & Blasting', profile: 'drill', unit: 'holes',
    machines: [['BD-01', 'Blast-Hole Drill'], ['BD-02', 'Blast-Hole Drill'], ['BD-03', 'Blast-Hole Drill']],
  },
  {
    group: 'Excavation & Loading', profile: null, unit: null,
    machines: [['EX-01', 'Overburden Shovel', 'obShovel', 'BCM'], ['EX-02', 'Coal Shovel', 'coalShovel', 't'], ['WL-01', 'Wheel Loader', 'loader', 't']],
  },
  {
    group: 'Haulage', profile: 'truck', unit: 'loads',
    machines: [['HT-01', 'Haul Truck'], ['HT-02', 'Haul Truck'], ['HT-03', 'Haul Truck'], ['HT-04', 'Haul Truck'],
      ['HT-05', 'Haul Truck'], ['HT-06', 'Haul Truck'], ['HT-07', 'Haul Truck'], ['HT-08', 'Haul Truck']],
  },
]

// per-class behaviour: state mix (how the shift tends to split), typical run
// lengths, downtime reason pool, rejection model.
const PROFILES = {
  drill: {
    mix: { working: 0.70, idleOn: 0.08, idleOff: 0.16, down: 0.06 },
    reasons: ['Bit / hammer change', 'Compressor over-temp', 'Tramming to next pattern', 'Rod-handling jam', 'Awaiting survey mark-up'],
    unit: 'holes', ratePerMin: 1 / 17, rej: { base: 3.2, spike: 0, label: 'Re-drills (hole deviation / collapse)' },
  },
  obShovel: {
    mix: { working: 0.80, idleOn: 0.10, idleOff: 0.05, down: 0.05 },
    reasons: ['Hydraulic hose burst', 'GET (teeth) change', 'Awaiting blast clearance', 'Track tension'],
    unit: 'BCM', ratePerMin: 15, rej: { base: 2.0, spike: 0, label: 'Dilution / contamination in waste' },
  },
  coalShovel: {
    mix: { working: 0.78, idleOn: 0.11, idleOff: 0.04, down: 0.07 },
    reasons: ['Boom-pin lubrication', 'Face clean-up (B-114)', 'Fragmentation re-dig', 'Bucket cylinder seal'],
    unit: 't', ratePerMin: 12, rej: { base: 5.5, spike: 7.5, label: 'Coal rejected — ash / rock dilution' },
  },
  loader: {
    mix: { working: 0.66, idleOn: 0.10, idleOff: 0.18, down: 0.06 },
    reasons: ['Refuelling', 'Operator break', 'Bucket cylinder seal', 'Re-handle wait'],
    unit: 't', ratePerMin: 9, rej: { base: 3.0, spike: 0, label: 'Off-spec re-handle' },
  },
  truck: {
    mix: { working: 0.74, idleOn: 0.14, idleOff: 0.07, down: 0.05 },
    reasons: ['Tyre over-temp (TPMS)', 'Engine derate', 'Awaiting shovel', 'Weighbridge queue', 'Scheduled service'],
    unit: 'loads', ratePerMin: 1 / 22, rej: { base: 6.0, spike: 0, label: 'Loads outside 90–110% payload band' },
  },
}

// ── seeded RNG ──
const mulberry = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const pick = (rng, dist) => { let r = rng(), acc = 0; for (const k in dist) { acc += dist[k]; if (r <= acc) return k } return Object.keys(dist)[0] }
const durOf = (state, rng) => {
  if (state === 'working') return 22 + Math.floor(rng() * 55)
  if (state === 'idleOn') return 5 + Math.floor(rng() * 14)
  if (state === 'idleOff') return 12 + Math.floor(rng() * 34)
  return 15 + Math.floor(rng() * 42)   // down
}

function buildTimeline(rng, prof) {
  const runs = []
  let t = 0
  // shift-start pre-op check is idle-off for mobile fleet
  let state = 'idleOff'
  let first = true
  while (t < SHIFT_MIN) {
    let dur = first ? 8 + Math.floor(rng() * 14) : durOf(state, rng)
    first = false
    const end = Math.min(SHIFT_MIN, t + dur)
    const last = runs[runs.length - 1]
    if (last && last.state === state) last.end = end          // merge
    else runs.push({ state, start: t, end })
    t = end
    if (t >= SHIFT_MIN) break
    // next state ≠ current (avoid trivial repeats), drawn from the class mix
    let next = state
    for (let g = 0; g < 4 && next === state; g++) next = pick(rng, prof.mix)
    state = next
  }
  return runs
}

export const DEFAULT_DAY = '2026-08-05'

const memo = new Map()
export function machine(id, type, profileKey, unitOverride, dayKey = DEFAULT_DAY) {
  const key = `${id}|${dayKey}`
  if (memo.has(key)) return memo.get(key)
  const prof = PROFILES[profileKey] || PROFILES.truck
  const rng = mulberry(hash(`${id}|${dayKey}`) ^ 0x51ed)

  const runs = buildTimeline(rng, prof)
  const totals = { working: 0, idleOn: 0, idleOff: 0, down: 0 }
  for (const r of runs) totals[r.state] += r.end - r.start

  // downtime event log = the down runs, each with a reason
  const downEvents = runs.filter(r => r.state === 'down').map((r, i) => ({
    start: r.start, end: r.end, dur: r.end - r.start,
    reason: prof.reasons[(hash(id) + i * 7) % prof.reasons.length],
  }))
  const downtimeMin = totals.down

  // rejection-rate series (per 30-min bucket)
  const buckets = SHIFT_MIN / 30
  const rejSeries = []
  let rejSum = 0
  for (let bkt = 0; bkt < buckets; bkt++) {
    const midShift = Math.exp(-Math.pow((bkt - buckets * 0.55) / (buckets * 0.14), 2))   // mid-shift bump for spike models
    const rate = Math.max(0, prof.rej.base + (rng() - 0.5) * 2.4 + prof.rej.spike * midShift)
    rejSeries.push({ t: bkt * 30, rate: Math.round(rate * 10) / 10 })
    rejSum += rate
  }
  const rejAvg = Math.round((rejSum / buckets) * 10) / 10

  // production units (from working time) + accepted/rejected split
  const unitCount = Math.round(totals.working * prof.ratePerMin)
  const rejected = Math.round(unitCount * rejAvg / 100)
  const accepted = unitCount - rejected

  const status = runs[runs.length - 1]?.state || 'working'
  const util = Math.round((totals.working / SHIFT_MIN) * 100)
  const avail = Math.round(((SHIFT_MIN - downtimeMin) / SHIFT_MIN) * 100)

  const out = {
    id, type, unit: unitOverride || prof.unit, profileKey, ratePerMin: prof.ratePerMin,
    runs, totals, downEvents, downtimeMin, rejSeries, rejAvg, rejLabel: prof.rej.label,
    units: { count: unitCount, accepted, rejected }, status, util, avail,
    winStart: 0, winEnd: SHIFT_MIN,
  }
  memo.set(key, out)
  return out
}

// Scope a full-shift machine record to a [a,b] minute window (relative to shift
// start). Every KPI — timeline, downtime, quality, utilisation — recomputes for
// just that window, so the date/time picker actually filters.
const clampN = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export function scope(full, a, b) {
  a = clampN(a, 0, SHIFT_MIN); b = clampN(b, 0, SHIFT_MIN)
  const win = Math.max(1, b - a)
  const runs = full.runs.map(r => { const s = Math.max(r.start, a), e = Math.min(r.end, b); return e > s ? { state: r.state, start: s, end: e } : null }).filter(Boolean)
  const totals = { working: 0, idleOn: 0, idleOff: 0, down: 0 }
  for (const r of runs) totals[r.state] += r.end - r.start
  const downEvents = full.downEvents.map(e => { const s = Math.max(e.start, a), en = Math.min(e.end, b); return en > s ? { ...e, start: s, end: en, dur: en - s } : null }).filter(Boolean)
  const rejSeries = full.rejSeries.filter(s => s.t + 30 > a && s.t < b)
  const rejAvg = rejSeries.length ? Math.round((rejSeries.reduce((x, s) => x + s.rate, 0) / rejSeries.length) * 10) / 10 : 0
  const unitCount = Math.round(totals.working * full.ratePerMin)
  const rejected = Math.round(unitCount * rejAvg / 100)
  const status = runs.length ? runs[runs.length - 1].state : 'idleOff'
  return {
    ...full, runs, totals, downEvents, downtimeMin: totals.down, rejSeries, rejAvg,
    units: { count: unitCount, accepted: unitCount - rejected, rejected },
    status, util: Math.round((totals.working / win) * 100), avail: Math.round(((win - totals.down) / win) * 100),
    winStart: a, winEnd: b,
  }
}

// flatten roster → machine data for a given day, with the right profile
export function miningMachines(dayKey = DEFAULT_DAY) {
  const out = []
  for (const g of MINING_GROUPS) {
    const rows = g.machines.map(m => {
      const [id, type, profileKey, unit] = m.length >= 3 ? m : [m[0], m[1], g.profile, g.unit]
      return machine(id, type, profileKey || g.profile, unit || g.unit, dayKey)
    })
    out.push({ group: g.group, rows })
  }
  return out
}
