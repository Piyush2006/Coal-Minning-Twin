// Coal Mining & Processing — Management Overview.
// v2 chrome: left sidebar navigation + compact top bar (title · date pill ·
// Filters popover · Plan). Six sections — Equipment & Downtime and Equipment &
// Resources are merged under one "Equipment" hub with sub-tabs. Content scrolls
// in a single container; Bruce floats bottom-right.
import { useEffect, useMemo, useRef } from 'react'
import './theme.css'
import './lib/chartTheme'
import { useDash } from './store'
import { buildPdm } from './calc/pdm'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { PlanManager } from './components/PlanManager'
import { BruceChat } from './components/BruceChat'
import { ProductionPerformance } from './sections/ProductionPerformance'
import { Efficiency } from './sections/Efficiency'
import { EquipmentHub } from './sections/EquipmentHub'
import { Predictive } from './sections/Predictive'
import { Safety } from './sections/Safety'
import { DepthProfile } from './sections/DepthProfile'

const COMPONENTS = { production: ProductionPerformance, efficiency: Efficiency, equipment: EquipmentHub, predictive: Predictive, safety: Safety, depth: DepthProfile }
const SECTIONS = [
  { id: 'production', label: 'Production', title: 'Production', question: 'Are we achieving our production target, and if not, why?' },
  { id: 'efficiency', label: 'Efficiency & Cost', title: 'Efficiency & Cost', question: 'Are we operating efficiently and within the expected cost?' },
  { id: 'equipment', label: 'Equipment', title: 'Equipment', question: 'Are machines effective, available, scheduled and healthy?' },
  { id: 'predictive', label: 'Predictive', title: 'Predictive Maintenance', question: 'Which assets need attention right now?' },
  { id: 'safety', label: 'Safety', title: 'Safety', question: 'Are operations safe and compliant?' },
  { id: 'depth', label: 'Depth Profile', title: 'Depth Profile', question: 'How are boreholes drilled — speed, fuel, and geology?' },
]

export default function Dashboard() {
  const planOpen = useDash(s => s.planOpen)
  const setPlanOpen = useDash(s => s.setPlanOpen)
  const openPlan = useDash(s => s.openPlan)
  const rawTab = useDash(s => s.tab)
  const setActive = useDash(s => s.setTab)
  const refresh = useDash(s => s.refresh)
  const { range, mineId, areaId, equipTypeId, settings } = useDash()
  const didInit = useRef(false)
  const scrollRef = useRef(null)
  // legacy tab ids from before the Equipment merge both land on the hub
  const active = rawTab === 'resources' ? 'equipment' : rawTab
  // red dot on the Predictive item when critical alerts exist
  const pdmCritical = useMemo(() => buildPdm({ range, mineId, areaId, equipTypeId, settings }).counts.Critical, [range, mineId, areaId, equipTypeId, settings])

  useEffect(() => { if (!didInit.current) { didInit.current = true; refresh() } }, [refresh])
  // reset scroll to the top whenever the section changes
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [active])
  // Highcharts only reflows on WINDOW resize — when the content area itself
  // changes width (sidebar collapse/expand, grid re-wrap) charts keep their old
  // size and paint over neighbouring cards. Observe the content container and
  // nudge a resize event (debounced) so every chart re-measures.
  const contentRef = useRef(null)
  useEffect(() => {
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let w = el.clientWidth, t = null
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth
      if (Math.abs(nw - w) < 2) return
      w = nw
      clearTimeout(t)
      t = setTimeout(() => window.dispatchEvent(new Event('resize')), 220)
    })
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [])

  const current = SECTIONS.find(s => s.id === active) || SECTIONS[0]
  const Comp = COMPONENTS[current.id]

  return (
    <div className="dash-theme" style={{ height: '100vh', display: 'flex', background: 'var(--background-surface-moderate)', color: 'var(--text-gray-primary)' }}>
      <Sidebar sections={SECTIONS} activeId={current.id} onChange={setActive} dots={{ predictive: pdmCritical > 0 }} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar title={current.title} onOpenPlan={() => openPlan('plan')} />
        <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
          <div ref={contentRef} style={{ maxWidth: 1280, margin: '0 auto', padding: '4px 32px 96px' }}>
            <section key={current.id} className="dash-fade">
              <Comp />
            </section>
          </div>
        </main>
      </div>

      <PlanManager isOpen={planOpen} onClose={() => setPlanOpen(false)} />
      <BruceChat />
    </div>
  )
}
