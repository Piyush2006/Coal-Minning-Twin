// The Equipment & Resources tab's own roster + presentation helpers. It EXTENDS
// the shared UNITS roster locally (adds a couple of plant units, e.g. a Thickener)
// WITHOUT modifying UNITS — so Predictive / Equipment / etc. are unaffected.
import { UNITS, filterUnits } from './equipment'

// extra plant units this management view surfaces (not in the base UNITS roster)
const EXTRA = [
  { id: 'CR-02', type: 'crusher', typeName: 'Crusher', area: 'wash', side: 'plant' },
  { id: 'TH-01', type: 'thickener', typeName: 'Thickener', area: 'wash', side: 'plant' },
]
export const ROSTER = [...UNITS, ...EXTRA]

// internal type → management-friendly label
export const TYPE_LABELS = {
  drill: 'Drilling Rig', shovel: 'Excavator', loader: 'Wheel Loader', truck: 'Dump Truck',
  crusher: 'Crusher', conveyor: 'Conveyor', screen: 'Screen', thickener: 'Thickener',
}
export const typeLabel = (t) => TYPE_LABELS[t] || t

// resource-type filter options (only types actually present in the roster)
export const RESOURCE_TYPE_OPTIONS = [
  { id: 'all', name: 'All Equipment' },
  ...[...new Set(ROSTER.map(u => u.type))].map(t => ({ id: t, name: TYPE_LABELS[t] || t })),
]

export const rosterById = (id) => ROSTER.find(u => u.id === id)

// filter the roster with the global mine/area/type filters (reuses UNITS logic)
export function filterRoster({ mineId = 'all', areaId = 'all', equipTypeId = 'all' } = {}) {
  const base = filterUnits({ mineId, areaId, equipTypeId })
  const ids = new Set(base.map(u => u.id))
  const extra = EXTRA.filter(u =>
    (mineId === 'all' || (mineId === 'oc' ? u.side === 'mine' : u.side === 'plant')) &&
    (areaId === 'all' || u.area === areaId) &&
    (equipTypeId === 'all' || u.type === equipTypeId))
  return [...base, ...extra.filter(u => !ids.has(u.id))]
}

// collapse the 4 live states into the tab's 3 (maintenance is overlaid separately)
export const simplifyStatus = (s) => (s === 'Running' ? 'Running' : s === 'Breakdown' ? 'Breakdown' : 'Idle')

// tab status → colour/intent (Under Maintenance is a 4th management state)
export const EQUIP_STATE = {
  'Running': { color: 'var(--background-positive-default)', intent: 'Positive', text: 'var(--text-positive-default)' },
  'Idle': { color: 'var(--background-warning-default)', intent: 'Notice', text: 'var(--text-warning-default)' },
  'Breakdown': { color: 'var(--background-error-default)', intent: 'Negative', text: 'var(--text-error-default)' },
  'Under Maintenance': { color: 'var(--text-brand-default)', intent: 'Information', text: 'var(--text-brand-default)' },
}
