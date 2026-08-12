// Equipment — one section, three sub-views (existing content, reorganized):
//   Performance → utilisation, downtime & plant-process health
//   Monitor     → live machine state: overview, at-risk, monitor table
//   Scheduling  → the work surface: job assignment + conflicts + planned downtime
// The Scheduling tab carries an amber count when jobs need attention, so the
// alert stays visible from the sibling views.
import { useMemo, useState } from 'react'
import { useDash } from '../store'
import { buildResources } from '../calc/resources'
import { Segmented } from '../components/ui'
import { EquipmentDowntime } from './EquipmentDowntime'
import { EquipmentResources } from './EquipmentResources'
import { EquipmentScheduling } from './EquipmentScheduling'

export function EquipmentHub() {
  const [view, setView] = useState('performance')
  const { range, mineId, areaId, equipTypeId, settings } = useDash()
  const assignments = useDash(s => s.resourceAssignments)
  const jobOverrides = useDash(s => s.jobOverrides)
  const downtimeOverrides = useDash(s => s.downtimeOverrides)
  const now = useMemo(() => new Date(), [])
  // attention count for the Scheduling tab badge (same calc the pages use)
  const problemCount = useMemo(
    () => buildResources({ range, mineId, areaId, equipTypeId, settings, assignments, jobOverrides, downtimeOverrides, now }).problemCount,
    [range, mineId, areaId, equipTypeId, settings, assignments, jobOverrides, downtimeOverrides, now],
  )

  const TABS = [
    { id: 'performance', label: 'Performance' },
    { id: 'monitor', label: 'Monitor' },
    { id: 'scheduling', label: 'Scheduling', badge: problemCount },
  ]

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Segmented options={TABS} value={view} onChange={setView} />
      <div key={view} className="dash-fade">
        {view === 'performance' ? <EquipmentDowntime /> : view === 'monitor' ? <EquipmentResources /> : <EquipmentScheduling />}
      </div>
    </div>
  )
}
