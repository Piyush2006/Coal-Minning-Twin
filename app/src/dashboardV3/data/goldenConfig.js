// Golden-shift configuration — the single source of truth for BOTH recorder
// modes (8-hour golden shift and 30-day trailing history), so pre-history and
// shift are continuous: the CV-01 thermal residual at 14:00 on shift day is
// exactly where the 14-day drift left it.
//
// Everything here is an INPUT to the simulator. The recorded output is never
// edited — story tuning happens by changing these numbers and re-recording.

export const SEED = 20260804
export const T0 = new Date('2026-08-04T14:00:00+05:30').getTime()   // Shift B opens
export const SHIFT_MIN = 480
export const HISTORY_DAYS = 30
export const DAY_MS = 86400e3

/* ── narrative beats → chain capability events (minutes from shift open) ──
   face capFactor 0.87 ≈ fill factor 0.97 → 0.89 plus the cycle-time drag of
   digging poorly fragmented Bench-4 material (B-114). */
export const CHAIN_EVENTS = [
  { start: 38, end: 48, stage: 'face', capFactor: 0, cause: 'external', state: 'idle', label: 'Scheduled blast window (Bench 5)' },
  { start: 70, end: 285, stage: 'face', capFactor: 0.85, cause: 'own', state: 'running', label: 'EX-02 fill factor 0.97→0.89 — B-114 fragmentation' },
  { start: 155, end: 172, stage: 'crush', capFactor: 0.75, cause: 'own', state: 'running', label: 'CR-01 feed destabilising — oversize' },
  { start: 172, end: 203, stage: 'crush', capFactor: 0, cause: 'own', state: 'down', label: 'CR-01 choke — hard down' },
  { start: 203, end: 227, stage: 'crush', capFactor: 0.55, cause: 'own', state: 'running', label: 'CR-01 clear-out at reduced rate' },
  { start: 365, end: 399, stage: 'dispatch', capFactor: 0.60, cause: 'own', state: 'running', label: 'Rake 4482 weighbridge queue — loading held' },
]

/* ── CV-01 drive-motor thermal residual (°C above load-and-ambient expected) ──
   dayIdx: 0..30 where 30 = shift day; fractional inside the shift.
   Flat until day 16, then monotonic drift — 14 days of visible runway. */
export function cvResidual(dayIdx) {
  if (dayIdx <= 16) return 0.4
  const d = dayIdx - 16
  return 0.4 + d * d * 0.028 + d * 0.19   // gentle acceleration → ≈ +8.2 °C at day 30.0
}
export const CV_BASE_TEMP = 58.5           // expected at typical load/ambient
// inside the shift: residual continues 14:00 → 22:00 (+3.1 °C/h from 16:30)
export function cvShiftResidual(minFromOpen) {
  const atOpen = cvResidual(30)
  if (minFromOpen <= 150) return atOpen + (minFromOpen / 150) * 1.1        // ~0.44 °C/h drizzle
  return atOpen + 1.1 + ((minFromOpen - 150) / 60) * 3.1                   // 3.1 °C/h from 16:30
}

/* ── decorative scenario schedule (drives the EXISTING demoScenarios trigger
   machinery — defs are injected into SCENARIOS at recorder start). Values are
   piecewise-continuous: each stage of a param hands over at the value the
   previous stage ended on, so nothing jumps when a scenario clears. ── */
const M = 60          // seconds per minute (ramp `over` is in seconds)
// NOTE: cv-01 motorTemp/motorCurrent are NOT scenario ramps — they come from the
// load-aware motorThermal model (residual × live belt load), written by the
// simulator each tick. During the choke starvation the absolute temp FALLS while
// the residual keeps climbing — which is what rules load out as the cause.
export function goldenScenarioDefs() {
  return {
    'gs-fill-drop': { objId: 'exc-coal-1', ramp: { param: 'bucketPayload', from: 52.4, to: 46.6, over: 22 * M } },
    'gs-fill-hold': { objId: 'exc-coal-1', set: { bucketPayload: 46.6 } },
    'gs-fill-recover': { objId: 'exc-coal-1', ramp: { param: 'bucketPayload', from: 46.6, to: 51.8, over: 28 * M } },
    'gs-fill-post': { objId: 'exc-coal-1', set: { bucketPayload: 51.8 } },
    'gs-oversize': { objId: 'screen-1', ramp: { param: 'oversizeRate', from: 5.9, to: 6.4, over: 155 * M } },
    'gs-oversize-late': { objId: 'screen-1', set: { oversizeRate: 6.0 } },
    'gs-cr-current-up': { objId: 'crusher-1', ramp: { param: 'motorCurrent', from: 152, to: 197, over: 17 * M } },
    'gs-cr-choked': { objId: 'crusher-1', set: { motorCurrent: 11, vibration: 1.2 } },
    'gs-cr-restart': { objId: 'crusher-1', ramp: { param: 'motorCurrent', from: 11, to: 152, over: 9 * M } },
    'gs-queue': { objId: 'truck-1', ramp: { param: 'idleTime', from: 21, to: 63, over: 45 * M } },
    'gs-queue2': { objId: 'truck-2', ramp: { param: 'idleTime', from: 19, to: 58, over: 45 * M } },
    'gs-rake-bin': { objId: 'loadout-1', set: { binLevel: 93 } },
    // headless runs have no real PPE/vision detection — pin the PPE cameras to
    // quiet compliance for the whole recorded shift (this narrative has no PPE
    // beat; random walks crossing violation thresholds would be fake events)
    'gs-ppe-quiet-1': { objId: 'ppe-cam-1', set: { ppeViolations: 0, complianceRate: 100, ppeDetected: 1 } },
    'gs-ppe-quiet-2': { objId: 'ppe-cam-2', set: { ppeViolations: 0, complianceRate: 100, ppeDetected: 2 } },
    'gs-ppe-quiet-3': { objId: 'ppe-cam-3', set: { ppeViolations: 0, complianceRate: 100, ppeDetected: 1 } },
    'gs-ppe-quiet-4': { objId: 'ppe-cam-4', set: { ppeViolations: 0, complianceRate: 100, ppeDetected: 3 } },
  }
}
export const SIM_TUNING = { safetyEventScale: 0.02, trendPeriodScale: 40, trendAmpScale: 0.55, walkScale: 0.35 }

/* fire/clear times (minutes from shift open) */
export const SCENARIO_TIMELINE = [
  { at: 0, fire: ['gs-oversize', 'gs-ppe-quiet-1', 'gs-ppe-quiet-2', 'gs-ppe-quiet-3', 'gs-ppe-quiet-4'] },
  { at: 70, fire: ['gs-fill-drop'] },
  { at: 92, clear: ['gs-fill-drop'], fire: ['gs-fill-hold'] },
  { at: 155, clear: ['gs-oversize'], fire: ['gs-cr-current-up'] },
  { at: 172, clear: ['gs-cr-current-up'], fire: ['gs-cr-choked', 'gs-queue', 'gs-queue2'] },
  { at: 224, clear: ['gs-cr-choked'], fire: ['gs-cr-restart'] },
  { at: 233, clear: ['gs-cr-restart', 'gs-queue', 'gs-queue2'] },
  { at: 270, clear: ['gs-fill-hold'], fire: ['gs-fill-recover'] },
  { at: 298, clear: ['gs-fill-recover'], fire: ['gs-fill-post', 'gs-oversize-late'] },
  { at: 365, fire: ['gs-rake-bin'] },
  { at: 399, clear: ['gs-rake-bin'] },
]

/* ── tiering: 1 Hz for the narrative cast, 10 s for the rest ── */
export const TIER_A = [
  'exc-coal-1', 'exc-ob-1', 'loader-1', 'truck-1', 'truck-2', 'truck-3',
  'cv-01', 'crusher-1', 'screen-1', 'chpp-1', 'stacker-1', 'pile-1', 'pile-2',
  'blend-1', 'loadout-1', 'shiploader-1', 'safety-1', 'pm-1', 'cam-2',
]

/* ── 30-day history: incident schedule (dayIdx 0..29; 30 = shift day) ── */
export const HISTORY_INCIDENTS = [
  { day: 9, stage: 'haul', startMin: 610, durMin: 150, capFactor: 0.30, cause: 'own', label: 'HT-02 + HT-05 hub temp — pulled for 2.5 h' },
  { day: 14, stage: 'chp', startMin: 300, durMin: 180, capFactor: 0, cause: 'justified', label: 'CHPP planned liner change (3 h)' },
  { day: 17, stage: 'dispatch', startMin: 820, durMin: 55, capFactor: 0.5, cause: 'own', label: 'Weighbridge software fault' },
  { day: 21, stage: 'crush', startMin: 450, durMin: 35, capFactor: 0, cause: 'own', label: 'CR-01 tramp metal trip' },
]
export const BLASTS = [
  { day: 13, id: 'B-108', bench: 'Bench 3', p80Shift: 0 },
  { day: 20, id: 'B-111', bench: 'Bench 3', p80Shift: 0 },
  { day: 27, id: 'B-114', bench: 'Bench 4', p80Shift: +34 },   // the bad one — 3 days before the shift
]
// oversize % at the screen, by day (fragmentation runway for the fill-factor story)
export function oversizeByDay(dayIdx) {
  if (dayIdx < 27) return 4.2
  return 5.6 + (dayIdx - 27) * 0.17     // → ≈ 6.1 % by shift day
}
export function bucketPayloadByDay(dayIdx) {
  if (dayIdx < 27) return 52.4
  return 52.4 - (dayIdx - 27) * 0.38    // slight decline after B-114 → ~51.3
}
