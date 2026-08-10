// Scheduled maintenance / planned downtime for the Equipment & Resources tab.
// A downtime window that contains "now" makes the unit "Under Maintenance" and
// unavailable for assignment. One-time windows are offsets (hours) from now so a
// couple are active right now; recurring items show their cadence. Read-only.
const H = 3600e3

// One-time: { offStart, durH } relative to now. Recurring: { cadence, window } text.
export const PLANNED_DOWNTIME = [
  { unitId: 'HT-04', kind: 'One-time', reason: 'Brake system overhaul', offStart: -3, durH: 10 },       // active now
  { unitId: 'CR-02', kind: 'One-time', reason: 'Annual liner change & load test', offStart: -1, durH: 8 }, // active now
  { unitId: 'EX-02', kind: 'One-time', reason: 'Hydraulic service', offStart: 26, durH: 6 },
  { unitId: 'BD-03', kind: 'Recurring', reason: 'Weekly inspection & greasing', cadence: 'Every Saturday (Weekly)', window: '06:00 — 10:00' },
  { unitId: 'CV-02', kind: 'Recurring', reason: 'Belt tracking & idler check', cadence: 'Every Monday (Weekly)', window: '07:00 — 09:00' },
]

export const downtimesForUnit = (unitId) => PLANNED_DOWNTIME.filter(d => d.unitId === unitId)

export function downtimeWindow(d, now) {
  if (d.kind !== 'One-time') return null
  const start = new Date(now.getTime() + d.offStart * H)
  return { start, end: new Date(start.getTime() + d.durH * H) }
}
export function downtimeActiveNow(unitId, now) {
  return downtimesForUnit(unitId).some(d => { const w = downtimeWindow(d, now); return w && w.start <= now && now < w.end })
}
