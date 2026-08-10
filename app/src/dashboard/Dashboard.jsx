// Coal Mining & Processing — Management Overview.
// Single-scroll narrative (Target → Actual → Gap → Cause → Efficiency → Asset
// Risk → Action → Safety) with a pinned global control bar + sticky jump-nav.
// Built on @faclon-labs/design-sdk. Delivered in phases — Phase 1 ships the
// global controls, Settings, and Section 1 (Production Performance); the rest
// are placeholders that keep the structure and nav intact.
import { useEffect, useRef } from 'react'
import { useDash } from './store'
import { GlobalControls } from './components/GlobalControls'
import { SectionNav } from './components/SectionNav'
import { PlanManager } from './components/PlanManager'
import { BruceChat } from './components/BruceChat'
import { ProductionPerformance } from './sections/ProductionPerformance'
import { Efficiency } from './sections/Efficiency'
import { EquipmentDowntime } from './sections/EquipmentDowntime'
import { EquipmentResources } from './sections/EquipmentResources'
import { Predictive } from './sections/Predictive'
import { Safety } from './sections/Safety'
import { DepthProfile } from './sections/DepthProfile'
import { Placeholder } from './sections/Placeholder'

const COMPONENTS = { production: ProductionPerformance, efficiency: Efficiency, equipment: EquipmentDowntime, resources: EquipmentResources, predictive: Predictive, safety: Safety, depth: DepthProfile }
const SECTIONS = [
  { id: 'production', label: 'Production' },
  { id: 'efficiency', label: 'Efficiency & Cost', title: 'Efficiency & Cost', question: 'Are we operating efficiently and within the expected cost?' },
  { id: 'equipment', label: 'Equipment & Downtime', title: 'Equipment Utilisation & Downtime', question: 'How effectively are machines operating, and where are we losing time?' },
  { id: 'resources', label: 'Equipment & Resources', title: 'Equipment & Resources', question: 'Is our equipment available, effective, scheduled and healthy?' },
  { id: 'predictive', label: 'Predictive Maintenance', title: 'Predictive Maintenance — Assets Needing Attention', question: 'Which assets need attention right now?' },
  { id: 'safety', label: 'Safety', title: 'Safety', question: 'Are operations safe and compliant?' },
  { id: 'depth', label: 'Depth Profile', title: 'Depth Profile', question: 'How are boreholes drilled — speed, fuel, and geology?' },
]
export default function Dashboard() {
  const planOpen = useDash(s => s.planOpen)
  const setPlanOpen = useDash(s => s.setPlanOpen)
  const openPlan = useDash(s => s.openPlan)
  const active = useDash(s => s.tab)
  const setActive = useDash(s => s.setTab)
  const refresh = useDash(s => s.refresh)
  const didInit = useRef(false)
  const scrollRef = useRef(null)

  useEffect(() => { if (!didInit.current) { didInit.current = true; refresh() } }, [refresh])
  // reset scroll to the top whenever the tab changes
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [active])

  const idx = Math.max(0, SECTIONS.findIndex(s => s.id === active))
  const current = SECTIONS[idx]
  const Comp = COMPONENTS[active]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background-surface-moderate)', color: 'var(--text-gray-primary)' }}>
      {/* fixed header — does not scroll */}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 20 }}>
        <GlobalControls onOpenPlan={() => openPlan('plan')} />
        <SectionNav sections={SECTIONS} activeId={active} onChange={setActive} />
      </div>

      {/* the only scroll container — renders just the active tab's page */}
      <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 24px 96px' }}>
          <section key={active}>
            {Comp ? <Comp /> : <Placeholder n={idx + 1} title={current.title} question={current.question} />}
          </section>
        </div>
      </main>

      <PlanManager isOpen={planOpen} onClose={() => setPlanOpen(false)} />
      <BruceChat />
    </div>
  )
}
