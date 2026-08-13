// Fixture recorder — runs the app's OWN simulator headless (via Vite SSR module
// loading, so import.meta.glob / env all behave), with a fixed seed and a
// virtual clock, drives it through the golden-shift scenario timeline using the
// existing demoScenarios trigger machinery + the mass-balance chain stepper,
// and RECORDS the output into a columnar time-indexed store.
//
//   node scripts/fixture/record-fixture.mjs            → golden shift (8 h @ 1 Hz)
//   node scripts/fixture/record-fixture.mjs --history  → 30-day trailing @ 15 min
//   --assert-hash <sha256>                             → fail if output differs
//
// Nothing recorded is ever hand-edited. Tuning = edit goldenConfig.js, re-record.
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createHash } from 'crypto'
import fs from 'fs'

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(APP, 'public', 'fixtures')
fs.mkdirSync(OUT, { recursive: true })

/* ── determinism: seeded RNG + virtual clock + storage shim, BEFORE app modules load ── */
import { SEED, T0, SHIFT_MIN, HISTORY_DAYS, DAY_MS, CHAIN_EVENTS, SCENARIO_TIMELINE, TIER_A, CV_BASE_TEMP, cvResidual, cvShiftResidual, goldenScenarioDefs, SIM_TUNING, HISTORY_INCIDENTS, BLASTS, oversizeByDay, bucketPayloadByDay } from '../../src/dashboardV3/data/goldenConfig.js'
import { createChainSim, STAGES, RATED, YIELD, BUFFERS } from '../../src/dashboardV3/data/chainSim.js'
import { arbitrate } from '../../src/dashboardV3/data/arbitration.js'
import { createMotorThermal } from '../../src/dashboardV3/data/motorThermal.js'

const HISTORY = process.argv.includes('--history')
const assertIdx = process.argv.indexOf('--assert-hash')
const ASSERT_HASH = assertIdx > 0 ? process.argv[assertIdx + 1] : null

const mulberry = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const rng = mulberry(SEED)
Math.random = rng                                            // the sim's randomness → deterministic

const CLOCK_START = HISTORY ? T0 - HISTORY_DAYS * DAY_MS : T0
let VNOW = CLOCK_START
Date.now = () => VNOW
globalThis.performance = { now: () => VNOW - CLOCK_START }   // demoScenarios ramps use this
const mem = new Map()
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear(), key: i => [...mem.keys()][i], get length() { return mem.size } }
globalThis.__simTuning = SIM_TUNING                          // re-pace demo-scale trends/rates for a shift-length recording

/* ── boot the app's module graph ── */
const { createServer } = await import('vite')
const vite = await createServer({ root: APP, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } })
const { COAL_MINE } = await vite.ssrLoadModule('/src/lib/templates/coalMine.js')
const { stepSimulation } = await vite.ssrLoadModule('/src/lib/oee.js')
const { paramFreqMs } = await vite.ssrLoadModule('/src/lib/parameterSchemas.js')
const scen = await vite.ssrLoadModule('/src/lib/demoScenarios.js')
const { evaluateAlerts } = await vite.ssrLoadModule('/src/lib/alertsEngine.js')

const scene = COAL_MINE()
let objects = scene.objects
const customAssetTypes = scene.customAssetTypes || {}

/* cv-01 carries the thermal story — give the belt its drive-motor params if the
   spec/normaliser didn't (custom params, real refresh frequency). */
{
  const cv = objects['cv-01']
  const injected = cv.parameters?.motorTemp == null
  cv.parameters = { ...cv.parameters, motorTemp: CV_BASE_TEMP + (HISTORY ? cvResidual(0) : cvResidual(30)), motorCurrent: 142, vibration: 2.1 }
  cv.paramMeta = { ...cv.paramMeta,
    motorTemp: { custom: true, label: 'Drive Motor Temp', unit: '°C', frequency: '5s' },
    motorCurrent: { custom: true, label: 'Drive Motor Current', unit: 'A', frequency: '5s' },
    // flat vibration — the visible rule-out on Screen 4 (thermal drift with
    // steady vibration ⇒ cooling path, not a bearing)
    vibration: { custom: true, label: 'Drive Vibration', unit: 'mm/s', frequency: '5s' } }
  console.log(`cv-01 motor params: ${injected ? 'injected at load (spec lacks them)' : 'present in spec'}`)
}

/* ── replica of sceneStore.simulateTick's frequency gating (same code path deps) ── */
function gatedStep(prev) {
  const stepped = stepSimulation(prev, customAssetTypes)
  const now = Date.now()
  const out = {}
  for (const id in stepped) {
    const po = prev[id], so = stepped[id]
    if (!po) { out[id] = so; continue }
    const times = { ...(po.paramTimes || {}) }
    const params = { ...so.parameters }
    for (const k in params) {
      if (po.paramMeta?.[k]?.topic) { params[k] = po.parameters[k]; continue }
      const ms = paramFreqMs(po, k, customAssetTypes)
      if (ms == null) { params[k] = po.parameters[k]; continue }
      if (now - (times[k] ?? 0) >= ms) times[k] = now
      else params[k] = po.parameters[k]
    }
    out[id] = { ...so, parameters: params, paramTimes: times, paramMeta: po.paramMeta }
  }
  return out
}

/* ── chain → object parameter/state writes (the simulator's own write path) ── */
const railShare = 0.62
const COAL_TRUCKS = ['truck-1', 'truck-2', 'truck-4', 'truck-5', 'truck-7']   // crusher circuit
const OB_TRUCKS = ['truck-3', 'truck-6', 'truck-8']                            // waste circuit — unaffected by a choke
let trainT = 0
function writeChain(o, c, thermal, residual, dt) {
  const set = (id, patch, st) => { const x = o[id]; if (!x) return; x.parameters = { ...x.parameters, ...patch }; if (st) { x.state = st.state ?? x.state; x.status = st.status ?? x.status } }
  const romTph = c.flows.crushIn / YIELD
  set('crusher-1', { throughput: r1(romTph) }, c.state.crush === 'down' ? { state: 'fault', status: 'fault' } : { state: 'crushing', status: 'running' })
  // Downstream of the crusher: when almost no feed reaches a stage it is STARVED
  // — the status must say idle so the Gantt and Screen-1 chain agree with the
  // arbitration classifier (waiting-on-feed, not a fault of its own).
  const RmH = Math.min(...Object.values(RATED)) / 60          // reference t/min
  const chpStarved = c.flows.chpIn / 60 < RmH * 0.05           // <5% of reference into CHP
  const dispStarved = c.flows.dispatched / 60 < RmH * 0.05
  set('screen-1', { feedRate: r1(c.flows.chpIn / YIELD) }, chpStarved ? { status: 'idle' } : { status: 'running' })
  set('chpp-1', { feedRate: r1(c.flows.chpIn / YIELD), yield: r1(YIELD * 100) }, chpStarved ? { status: 'idle' } : { status: 'running' })
  set('stacker-1', {}, chpStarved ? { status: 'idle' } : { status: 'running' })
  // CV-01: belt load + LOAD-AWARE drive thermal model. During starvation the
  // absolute temp falls toward no-load expected while the residual keeps
  // climbing — load is thereby ruled out as the cause. NB: CV-01 stays RUNNING
  // with load → 0 (the empty-belt story) — it is not idle, it is running empty.
  const cvLoad = clamp(c.flows.chpIn / RATED.chp, 0, 1)
  const mt = thermal.step(cvLoad, residual, dt)
  set('cv-01', { load: r1(cvLoad * 100), motorTemp: mt.temp, motorCurrent: mt.current, vibration: r1(2.05 + cvLoad * 0.18) }, { status: 'running' })
  set('pile-1', { stockTonnes: r1(480 + c.buf.chp) })
  const disp = c.flows.dispatched
  trainT += (disp * railShare) / 3600 * dt
  set('loadout-1', { loadRate: r1(disp * railShare), trainLoadedT: r1(trainT), wagonsLoaded: Math.floor(trainT / 64) }, dispStarved ? { status: 'idle' } : { status: 'running' })
  set('shiploader-1', { loadRate: r1(disp * (1 - railShare)), loadedThisShift: r1((o['shiploader-1']?.parameters?.loadedThisShift ?? 0) + disp * (1 - railShare) / 3600 * dt) }, dispStarved ? { status: 'idle' } : { status: 'running' })
  const faceIdle = c.state.face === 'idle'
  set('exc-coal-1', {}, faceIdle ? { status: 'idle' } : { status: 'running' })
  set('loader-1', {}, faceIdle ? { status: 'idle' } : { status: 'running' })
  const queued = c.state.crush === 'down' && c.buf.haul >= BUFFERS.haul.cap - 1
  for (const t of COAL_TRUCKS) set(t, {}, queued ? { status: 'idle' } : { status: 'running' })
  for (const t of OB_TRUCKS) set(t, {}, { status: 'running' })
}
const r1 = v => Math.round(v * 10) / 10
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

/* ── columnar recorder ── */
function makeRecorder(tierAssets, nA, tierBAssets, nB) {
  const cols = new Map()   // `${id}·${param}` -> Float32Array ; `${id}·§status` -> Uint8Array
  const STATUS_ENUM = ['running', 'idle', 'fault', 'off']
  const col = (key, n, u8) => { let c = cols.get(key); if (!c) { c = u8 ? new Uint8Array(n) : new Float32Array(n).fill(NaN); cols.set(key, c) } return c }
  const sample = (o, i, ids, n, chain) => {
    for (const id of ids) {
      const x = id === '_chain' ? null : o[id]
      if (id === '_chain') {
        col('_chain·romTph', n).set?.[0]   // noop guard
        const f = chain.flows
        col('_chain·romTph', n)[i] = f.haulOut / YIELD
        col('_chain·productTph', n)[i] = f.chpIn
        col('_chain·dispatchedTph', n)[i] = f.dispatched
        col('_chain·bufRom', n)[i] = chain.buf.haul
        col('_chain·bufSurge', n)[i] = chain.buf.crush
        col('_chain·bufProduct', n)[i] = chain.buf.chp
        continue
      }
      if (!x) continue
      for (const [k, v] of Object.entries(x.parameters || {})) {
        if (typeof v !== 'number' || !isFinite(v)) continue
        col(`${id}·${k}`, n)[i] = v
      }
      col(`${id}·§status`, n, true)[i] = Math.max(0, STATUS_ENUM.indexOf(x.status ?? 'running'))
    }
  }
  return { cols, sample, STATUS_ENUM }
}

/* ── RAW alert transition log. Every fire/resolve is recorded — the §9
   anti-fatigue policy is applied at READ time (data/alertPolicy.js) so it can
   be retuned, and K22 alert-precision can be computed, without regenerating
   the fixture. ── */
function makeAlertLog() {
  const prev = new Set(); const log = []
  return { log, tick(o, t) {
    const now = evaluateAlerts(o); const seen = new Set()
    for (const a of now) { seen.add(a.key); if (!prev.has(a.key)) log.push({ t, type: 'fire', key: a.key, objId: a.objId, sev: a.severity, useCase: a.useCase, msg: a.message }) }
    for (const k of prev) if (!seen.has(k)) log.push({ t, type: 'resolve', key: k })
    prev.clear(); for (const k of seen) prev.add(k)
  } }
}

/* ═══════════════ GOLDEN SHIFT ═══════════════ */
async function recordGolden() {
  Object.assign(scen.SCENARIOS, goldenScenarioDefs())
  const chain = createChainSim({ seed: SEED, events: CHAIN_EVENTS })
  const nA = SHIFT_MIN * 60, nB = SHIFT_MIN * 6
  const tierB = Object.keys(objects).filter(id => !TIER_A.includes(id) && objects[id].parameters && Object.keys(objects[id].parameters).length)
  const rec = makeRecorder(TIER_A, nA, tierB, nB)
  const alerts = makeAlertLog()
  const timeline = [...SCENARIO_TIMELINE]
  const thermal = createMotorThermal()

  let c = null
  for (let i = 0; i < nA; i++) {
    VNOW = T0 + i * 1000
    const min = i / 60
    while (timeline.length && timeline[0].at <= min) {
      const e = timeline.shift()
      for (const n of e.clear ?? []) scen.clearScenario(n)
      for (const n of e.fire ?? []) scen.triggerScenario(n)
    }
    objects = gatedStep(objects)
    c = chain.step(i, 1)
    writeChain(objects, c, thermal, cvShiftResidual(min), 1)
    alerts.tick(objects, i)
    rec.sample(objects, i, [...TIER_A, '_chain'], nA, c)
    if (i % 10 === 0) rec.sample(objects, i / 10, tierB, nB, c)
  }

  const arb = arbitrate({ stages: STAGES.map(s => ({ id: s.id, bucket: s.bucket })), rated: chain.ratedPerMin, minutes: chain.minutes })
  return { rec, alerts, arb, chain, nA, nB, tierB }
}

/* ═══════════════ 30-DAY HISTORY ═══════════════ */
async function recordHistory() {
  const dayRng = mulberry(SEED ^ 0x5eed)
  const events = []
  for (let d = 0; d < HISTORY_DAYS; d++) {
    // downside-skewed day quality: output is capped at R by the chain, so the
    // believable spread comes from bad days, not symmetric wiggle
    const dip = Math.max(0, (dayRng() + dayRng() + dayRng()) / 1.5 - 1) * 0.16 + dayRng() * 0.02
    events.push({ start: d * 1440, end: (d + 1) * 1440, stage: 'face', capFactor: Math.min(1, 1 - dip), cause: null, state: 'running' })
    const nStops = 1 + (dayRng() < 0.6 ? 1 : 0)                    // 1–2 minor stoppages most days
    for (let k = 0; k < nStops; k++) {
      const st = d * 1440 + 240 + Math.floor(dayRng() * 1000)
      const stage = ['crush', 'chp', 'dispatch', 'face'][Math.floor(dayRng() * 4)]
      events.push({ start: st, end: st + 15 + Math.floor(dayRng() * 75), stage, capFactor: dayRng() < 0.45 ? 0 : 0.5, cause: 'own', state: 'down' })
    }
    if (dayRng() < 0.12) {                                          // the occasional genuinely bad day
      const st = d * 1440 + 300 + Math.floor(dayRng() * 600)
      events.push({ start: st, end: st + 120 + Math.floor(dayRng() * 140), stage: ['crush', 'face'][Math.floor(dayRng() * 2)], capFactor: dayRng() * 0.3, cause: 'own', state: 'down' })
    }
  }
  for (const inc of HISTORY_INCIDENTS) events.push({ start: inc.day * 1440 + inc.startMin, end: inc.day * 1440 + inc.startMin + inc.durMin, stage: inc.stage, capFactor: inc.capFactor, cause: inc.cause, state: inc.capFactor === 0 ? 'down' : 'running' })

  const chain = createChainSim({ seed: SEED + 1, events })
  const totalMin = HISTORY_DAYS * 1440
  const nS = totalMin / 15                                     // 15-min samples
  const rec = makeRecorder(TIER_A, nS, [], 0)
  const daily = Array.from({ length: HISTORY_DAYS }, () => ({ product: 0 }))

  let c = null
  const thermal = createMotorThermal()
  for (let m = 0; m < totalMin; m++) {
    VNOW = CLOCK_START + m * 60000
    const day = m / 1440
    objects = gatedStep(objects)
    c = chain.step(m * 60, 60)
    writeChain(objects, c, thermal, cvResidual(day), 60)
    // history runway (the simulator's decorative layer, day-resolution)
    objects['screen-1'].parameters = { ...objects['screen-1'].parameters, oversizeRate: r1(oversizeByDay(day) + (Math.random() - 0.5) * 0.4) }
    objects['exc-coal-1'].parameters = { ...objects['exc-coal-1'].parameters, bucketPayload: r1(bucketPayloadByDay(day) + (Math.random() - 0.5) * 0.8) }
    daily[Math.floor(day)].product += c.dispatchedT
    if (m % 15 === 0) rec.sample(objects, m / 15, [...TIER_A, '_chain'], nS, c)
  }
  const totals = daily.map(d => d.product)
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length
  const cov = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length) / mean
  const rollups = {}
  for (const [key, arr] of rec.cols) {
    if (arr instanceof Uint8Array) continue
    const days = []
    const perDay = nS / HISTORY_DAYS
    for (let d = 0; d < HISTORY_DAYS; d++) {
      let mn = Infinity, mx = -Infinity, sum = 0, n = 0
      for (let s = d * perDay; s < (d + 1) * perDay; s++) { const v = arr[s]; if (isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; n++ } }
      days.push(n ? [r1(mn), r1(sum / n), r1(mx)] : null)
    }
    rollups[key] = days
  }
  return { rec, nS, cov, dailyTotals: totals.map(t => Math.round(t)), rollups }
}

/* ── serialise: manifest JSON + concatenated typed arrays, sha256 over both ── */
function serialise(name, rec, extraMeta) {
  const order = [...rec.cols.keys()].sort()
  let bytes = 0
  const parts = []
  const colMeta = {}
  for (const k of order) {
    const a = rec.cols.get(k)
    const buf = Buffer.from(a.buffer, a.byteOffset, a.byteLength)
    colMeta[k] = { type: a instanceof Uint8Array ? 'u8' : 'f32', offset: bytes, length: a.length }
    bytes += buf.length
    parts.push(buf)
  }
  const bin = Buffer.concat(parts)
  const manifest = { name, seed: SEED, t0: T0, clockStart: CLOCK_START, statusEnum: rec.STATUS_ENUM ?? ['running', 'idle', 'fault', 'off'], cols: colMeta, ...extraMeta }
  const hash = createHash('sha256').update(bin).update(JSON.stringify(manifest)).digest('hex')
  manifest.hash = hash
  fs.writeFileSync(join(OUT, `${name}.bin`), bin)
  fs.writeFileSync(join(OUT, `${name}.meta.json`), JSON.stringify(manifest))
  return { hash, bytes: bin.length, metaBytes: JSON.stringify(manifest).length }
}

const fmtT = (min) => { const d = new Date(T0 + min * 60000); return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) }

if (!HISTORY) {
  const { rec, alerts, arb, chain, nA, nB, tierB } = await recordGolden()
  const stageName = { face: 'Face/Loading (EX-02)', haul: 'Haulage (HT-01..03)', crush: 'Crushing (CR-01)', chp: 'CHP (SC-01+DMC)', dispatch: 'Dispatch (TLO-01/SL-01)' }
  const { hash, bytes } = serialise('golden-shift', rec, {
    dt: 1, dtB: 10, tierA: TIER_A, tierB, shiftMin: SHIFT_MIN,
    arbitration: { R: arb.R, plan: r1(arb.plan), actual: r1(arb.actual), buckets: Object.fromEntries(Object.entries(arb.buckets).map(([k, v]) => [k, r1(v)])), events: arb.events.map(e => ({ ...e, tonnes: r1(e.tonnes) })), reconciles: arb.reconciles,
      // per-minute stream so the waterfall/ribbon/constraint callout rebuild at
      // any scrub position (loss + binding root per minute; ~20 KB)
      perMinute: arb.perMinute.map(pm => ({ m: pm.m, loss: r1(pm.loss), root: pm.root, bucket: pm.bucket })) },
    alerts: alerts.log, chainEvents: CHAIN_EVENTS, scenarioTimeline: SCENARIO_TIMELINE, stages: STAGES, ratedPerMin: chain.ratedPerMin,
  })
  console.log('\n═══ GOLDEN SHIFT ═══')
  console.log(`plan ${arb.plan.toFixed(0)} t · actual ${arb.actual.toFixed(0)} t · attainment ${(100 * arb.actual / arb.plan).toFixed(1)}%`)
  const lt = arb.plan - arb.actual
  for (const [b, v] of Object.entries(arb.buckets)) if (v > 0.01) console.log(`  ${b.padEnd(12)} ${v.toFixed(0).padStart(5)} t  (${(100 * v / lt).toFixed(0)}%)`)
  console.log(`reconciles: ${arb.reconciles}`)
  console.log(`size ${(bytes / 1e6).toFixed(2)} MB · sha256 ${hash}`)
  if (ASSERT_HASH) { if (hash !== ASSERT_HASH) { console.error('HASH MISMATCH'); process.exit(1) } console.log('hash assert OK') }
  // choke-window causal dump
  let txt = 'ARBITRATED EVENT LIST — choke window onward (16:52 →)\n'
  for (const e of arb.events) {
    if (e.end < 172) continue
    const nm = e.root ? stageName[e.root] : 'residual (flow texture)'
    txt += `\n[${fmtT(e.start)}–${fmtT(e.end + 1)}] root: ${nm} · bucket ${e.bucket} · ${e.tonnes.toFixed(0)} t\n`
    const ce = CHAIN_EVENTS.find(c => c.stage === e.root && e.start >= c.start - 30 && e.end <= c.end + 35)
    if (ce) txt += `    cause: ${ce.label}\n`
    for (const [sid, q] of Object.entries(e.consequences)) txt += `    ↳ ${stageName[sid] ?? sid}: ${q.kind} ${q.minutes} min · 0 t (consequence)\n`
  }
  txt += '\nALERT TRANSITIONS in window:\n'
  for (const a of alerts.log) { const min = a.t / 60; if (min >= 172 && min <= 300 && a.type === 'fire') txt += `  ${fmtT(min)} FIRE ${a.sev?.toUpperCase?.() ?? ''} [${a.useCase}] ${a.objId}: ${a.msg}\n` }
  fs.writeFileSync(join(OUT, 'golden-shift-choke-window.txt'), txt)
  console.log(txt)
} else {
  const { rec, nS, cov, dailyTotals, rollups } = await recordHistory()
  const { hash, bytes } = serialise('history-30d', rec, { dt: 900, samples: nS, days: HISTORY_DAYS, dailyRollups: rollups, dailyProductTotals: dailyTotals, cov: r1(cov * 1000) / 10, blasts: BLASTS, incidents: HISTORY_INCIDENTS })
  console.log('\n═══ 30-DAY HISTORY ═══')
  console.log(`daily product mean ${Math.round(dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length)} t · CoV ${(cov * 100).toFixed(1)}%`)
  console.log(`size ${(bytes / 1e6).toFixed(2)} MB · sha256 ${hash}`)
  if (ASSERT_HASH) { if (hash !== ASSERT_HASH) { console.error('HASH MISMATCH'); process.exit(1) } console.log('hash assert OK') }
}

await vite.close()
process.exit(0)
