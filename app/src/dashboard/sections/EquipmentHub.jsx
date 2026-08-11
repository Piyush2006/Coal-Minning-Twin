// Equipment — one section, two sub-views (existing content, reorganized only):
//   Performance        → utilisation, downtime & plant-process health (ex "Equipment & Downtime")
//   Fleet & Scheduling → readiness, monitor, assignment & planned downtime (ex "Equipment & Resources")
import { useState } from 'react'
import { Segmented } from '../components/ui'
import { EquipmentDowntime } from './EquipmentDowntime'
import { EquipmentResources } from './EquipmentResources'

const TABS = [
  { id: 'performance', label: 'Performance' },
  { id: 'fleet', label: 'Fleet & Scheduling' },
]

export function EquipmentHub() {
  const [view, setView] = useState('performance')
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Segmented options={TABS} value={view} onChange={setView} />
      <div key={view} className="dash-fade">
        {view === 'performance' ? <EquipmentDowntime /> : <EquipmentResources />}
      </div>
    </div>
  )
}
