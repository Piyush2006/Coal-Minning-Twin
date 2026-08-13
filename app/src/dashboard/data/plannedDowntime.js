// Scheduled maintenance / planned downtime. A window that contains "now" makes
// the unit "Under Maintenance" and unavailable for assignment.
// Built-ins: one-time entries are offsets (hours) from now; recurring built-ins
// are display-only text. User-created/edited entries (layered via overrides)
// carry absolute `startISO` (one-time) or structured `{dow, startHM, durH}`
// (recurring) — structured recurring DOES activate inside its weekly window.
const H = 3600e3

export const PLANNED_DOWNTIME = [
  { id: 'PD-1', unitId: 'HT-04', kind: 'One-time', reason: 'Brake system overhaul', offStart: 20, durH: 10 },       // scheduled (upcoming)
  { id: 'PD-2', unitId: 'CR-02', kind: 'One-time', reason: 'Annual liner change & load test', offStart: 44, durH: 8 }, // scheduled (upcoming)
  { id: 'PD-3', unitId: 'EX-02', kind: 'One-time', reason: 'Hydraulic service', offStart: 26, durH: 6 },
  { id: 'PD-4', unitId: 'BD-03', kind: 'Recurring', reason: 'Weekly inspection & greasing', cadence: 'Every Saturday (Weekly)', window: '06:00 — 10:00' },
  { id: 'PD-5', unitId: 'CV-02', kind: 'Recurring', reason: 'Belt tracking & idler check', cadence: 'Every Monday (Weekly)', window: '07:00 — 09:00' },
]

// the live list: built-ins minus deletions, with edits applied, plus created ones
export function effectiveDowntimes(overrides = {}) {
  const builtin = PLANNED_DOWNTIME.filter(d => overrides[d.id] !== null).map(d => overrides[d.id] || d)
  const created = Object.values(overrides).filter(o => o && !PLANNED_DOWNTIME.some(d => d.id === o.id))
  return [...builtin, ...created]
}

export const downtimesForUnit = (unitId, overrides = {}) => effectiveDowntimes(overrides).filter(d => d.unitId === unitId)

export function downtimeWindow(d, now) {
  if (d.kind !== 'One-time') return null
  const start = d.startISO ? new Date(d.startISO) : new Date(now.getTime() + d.offStart * H)
  return { start, end: new Date(start.getTime() + d.durH * H) }
}

// this week's occurrence window for a STRUCTURED recurring entry (else null)
export function recurringWindowToday(d, now) {
  if (d.kind !== 'Recurring' || d.dow == null || !d.startHM) return null
  if (now.getDay() !== d.dow) return null
  const [h, m] = d.startHM.split(':').map(Number)
  const start = new Date(now); start.setHours(h, m, 0, 0)
  return { start, end: new Date(start.getTime() + d.durH * H) }
}

export function downtimeActiveNow(unitId, now, overrides = {}) {
  return downtimesForUnit(unitId, overrides).some(d => {
    const w = downtimeWindow(d, now) || recurringWindowToday(d, now)
    return w && w.start <= now && now < w.end
  })
}
