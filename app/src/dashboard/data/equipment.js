// Equipment roster + per-unit utilisation/downtime allocation. Per-unit stats
// are ANCHORED on the operation's overall utilisation (from production) so the
// fleet breakdown always averages back to the headline KPI — internally
// self-consistent and directionally coherent with Section 1.
import { mulberry, hash } from './rng'
import { sideOf } from './taxonomy'

export const UNITS = [
  // ── Mine ──
  { id: 'BD-01', type: 'drill', typeName: 'Blast-Hole Drill', area: 'pit', side: 'mine' },
  { id: 'BD-02', type: 'drill', typeName: 'Blast-Hole Drill', area: 'pit', side: 'mine' },
  { id: 'BD-03', type: 'drill', typeName: 'Blast-Hole Drill', area: 'pit', side: 'mine' },
  { id: 'EX-01', type: 'shovel', typeName: 'Shovel / Excavator', area: 'load', side: 'mine' },
  { id: 'EX-02', type: 'shovel', typeName: 'Shovel / Excavator', area: 'load', side: 'mine' },
  { id: 'WL-01', type: 'loader', typeName: 'Wheel Loader', area: 'load', side: 'mine' },
  { id: 'HT-01', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  { id: 'HT-02', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  { id: 'HT-03', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  { id: 'HT-04', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  { id: 'HT-05', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  { id: 'HT-06', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  { id: 'HT-07', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  { id: 'HT-08', type: 'truck', typeName: 'Haul Truck', area: 'haul', side: 'mine' },
  // ── Plant ──
  { id: 'CR-01', type: 'crusher', typeName: 'Crusher', area: 'crush', side: 'plant' },
  { id: 'CV-01', type: 'conveyor', typeName: 'Conveyor', area: 'crush', side: 'plant' },
  { id: 'CV-02', type: 'conveyor', typeName: 'Conveyor', area: 'wash', side: 'plant' },
  { id: 'SC-01', type: 'screen', typeName: 'Screen', area: 'wash', side: 'plant' },
]

export const DOWNTIME_REASONS = ['Mechanical', 'Electrical', 'Planned Maintenance', 'No Feed', 'Operational', 'Other']
const REASON_W = [0.30, 0.18, 0.16, 0.14, 0.14, 0.08]

export function filterUnits({ mineId = 'all', areaId = 'all', equipTypeId = 'all' } = {}) {
  const side = sideOf(mineId)
  return UNITS.filter(u =>
    (side === 'both' || u.side === side) &&
    (areaId === 'all' || u.area === areaId) &&
    (equipTypeId === 'all' || u.type === equipTypeId))
}

// Per-unit stats for the selected period. `overallUtil` (0–100) anchors the mean;
// a stable per-unit offset makes a few units chronically worse (consistent "top
// contributors"). Downtime scales with the number of days in the window.
export function unitStats(u, overallUtil, days, settings) {
  const r = mulberry(hash(`${u.id}|equip`) ^ 0x5eed)
  const offset = (r() - 0.5) * 16 - (r() < 0.22 ? 10 + r() * 12 : 0)  // occasional chronic under-performer
  const util = Math.max(38, Math.min(99, overallUtil + offset))
  const plannedMin = settings.plannedOperatingHoursPerDay * 60 * days
  const downtimeMin = (1 - util / 100) * plannedMin
  const runningMin = plannedMin - downtimeMin
  // reason split (per-unit weights, jittered)
  const w = REASON_W.map(x => x * (0.7 + r() * 0.6))
  const wtot = w.reduce((a, b) => a + b, 0) || 1
  const reasons = DOWNTIME_REASONS.map((name, i) => ({ name, min: (w[i] / wtot) * downtimeMin }))
  return { ...u, util, plannedMin, downtimeMin, runningMin, reasons }
}
