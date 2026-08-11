// Section 3 · Equipment Utilisation & Downtime — "How effectively are machines
// operating, and where are we losing time?" Utilisation = Running / Planned
// operating time (NOT availability), with breakdown by type; downtime by reason
// and top contributors, ranked so the biggest losses are obvious. The three plant
// processes (crusher, conveyor, thickener) are grouped as "Plant process health".
import { useMemo, useState } from 'react'
import { Chart, dashedTarget } from '../components/Chart'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { buildEquipment } from '../calc/equipment'
import { buildCrusher } from '../calc/crusher'
import { buildConveyor } from '../calc/conveyor'
import { buildThickener } from '../calc/thickener'
import { NUM, STATUS, fmt, utilStatus } from '../calc/format'
import { EQUIP_TYPES } from '../data/taxonomy'
import { assetCondition } from '../data/assets'
import { rosterById, simplifyStatus } from '../data/resources'
import { downtimeActiveNow } from '../data/plannedDowntime'
import { KpiStat } from '../components/KpiStat'
import { Panel, Modal } from '../components/primitives'
import { CARD, Eyebrow, MiniKpi } from '../components/ui'
import { BeltAnomaliesModal } from '../components/BeltAnomalies'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'
import { EquipmentDrawer } from '../components/EquipmentDrawer'
import { UnitsDrillModal } from '../components/UnitsDrill'

// dashed grey target plotLine (single-value helper)
const target = dashedTarget
// dual-axis spline config for the process-health trend MODALS — labelled axes,
// interactive legend (click to hide/show a line), drag-to-zoom
const dualSpline = (categories, axes, seriesDefs) => ({
  chart: { type: 'spline', zooming: { type: 'x' } },
  xAxis: { categories },
  yAxis: axes,
  legend: { enabled: true },
  tooltip: { shared: true },
  plotOptions: { spline: { marker: { enabled: categories.length <= 31, radius: 3 } } },
  series: seriesDefs,
})

export function EquipmentDowntime() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const assignments = useDash(s => s.resourceAssignments)
  // drill-down: click a unit row → the shared per-equipment drawer
  const [sel, setSel] = useState(null)
  // drill-down: "Active Anomalies" mini-KPI → full vision-evidence modal
  const [anomOpen, setAnomOpen] = useState(false)
  // drill-down: Utilisation / Downtime KPIs + chart bars → ranked units modal
  const [unitsDrill, setUnitsDrill] = useState(null)   // { mode, typeFilter?, typeName? } | null
  // drill-down: process card "View trend" → full chart modal
  const [trendOpen, setTrendOpen] = useState(null)     // 'crusher' | 'conveyor' | 'thickener' | null
  const now = useMemo(() => new Date(), [])
  const openUnit = (id) => {
    const unit = rosterById(id)
    if (!unit) return
    const status = downtimeActiveNow(unit.id, now) ? 'Under Maintenance' : simplifyStatus(assetCondition(unit, settings).status)
    setSel({ unit, status })
  }
  const kp = useMemo(
    () => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings, plan],
  )
  const eq = useMemo(
    () => buildEquipment({ range, mineId, areaId, equipTypeId, settings, overallUtil: kp.utilization.pct }),
    [range, mineId, areaId, equipTypeId, settings, kp.utilization.pct],
  )

  const ctx = useMemo(
    () => buildBruceContext({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings, plan],
  )
  const cr = useMemo(() => buildCrusher({ range, mineId, areaId, equipTypeId }), [range, mineId, areaId, equipTypeId])
  const cv = useMemo(() => buildConveyor({ range, mineId, areaId, equipTypeId }), [range, mineId, areaId, equipTypeId])
  const tk = useMemo(() => buildThickener({ range, mineId, areaId, equipTypeId }), [range, mineId, areaId, equipTypeId])

  const anomStatus = cv.activeCount ? (cv.anomalies.some(a => a.active && a.severity === 'Critical') ? 'critical' : 'warning') : 'positive'
  const cvChart = dualSpline(cv.trend.categories, [
    { title: { text: null }, labels: { format: '{value}%' }, plotLines: [target(cv.targets.targetLoading, `Target ${cv.targets.targetLoading}%`)] },
    { title: { text: null }, labels: { format: '{value}%' }, opposite: true, plotLines: [target(0, 'Target 0%', 'right')] },
  ], [
    { name: 'Belt Loading (%)', data: cv.trend.loading, color: '#3E6DF4', yAxis: 0 },
    { name: 'Speed Deviation (%)', data: cv.trend.speedDev, color: '#F59E0B', yAxis: 1 },
  ])
  const tkChart = dualSpline(tk.trend.categories, [
    { title: { text: null }, labels: { format: '{value}%' }, plotLines: [target(tk.targets.targetDensity, `Target ${tk.targets.targetDensity}%`)] },
    { title: { text: null }, labels: { format: '{value}' }, opposite: true, plotLines: [target(tk.targets.targetTurbidity, `Target ${tk.targets.targetTurbidity}`, 'right')] },
  ], [
    { name: 'Underflow Density (%)', data: tk.trend.density, color: '#3E6DF4', yAxis: 0 },
    { name: 'Overflow Turbidity (NTU)', data: tk.trend.turbidity, color: '#F59E0B', yAxis: 1 },
  ])
  const crChart = dualSpline(cr.trend.categories, [
    { title: { text: null }, labels: { format: '{value}' }, plotLines: [target(cr.targets.feedRate, `Target ${cr.targets.feedRate}`)] },
    { title: { text: null }, labels: { format: '{value}' }, opposite: true, plotLines: [target(cr.targets.powerPerTon, `Target ${cr.targets.powerPerTon}`, 'right')] },
  ], [
    { name: 'Feed Rate (T/hr)', data: cr.trend.feedRate, color: '#3E6DF4', yAxis: 0 },
    { name: 'Power / Ton (kWh/T)', data: cr.trend.powerPerTon, color: '#F59E0B', yAxis: 1 },
  ])
  const uSt = STATUS[utilStatus(eq.utilizationPct)]
  // shift split of the fleet downtime, allocated by the production shift ratio
  const s1d = kp.shifts[0].downtimeHours, s2d = kp.shifts[1].downtimeHours
  const s1share = (s1d + s2d) ? s1d / (s1d + s2d) : 0.5

  const byType = eq.byType
  const utilChart = {
    chart: { type: 'column' },
    xAxis: { categories: byType.map(g => typeName(g.type)) },
    yAxis: { max: 100, labels: { format: '{value}%' }, plotLines: [target(eq.utilizationPct, `Fleet ${fmt(eq.utilizationPct)}%`)] },
    legend: { enabled: false },
    tooltip: { valueSuffix: '%' },
    plotOptions: {
      column: { dataLabels: { enabled: true, format: '{point.y:.0f}%', style: { fontSize: '11px', fontWeight: '600', color: '#5B6577', textOutline: 'none' } } },
      // click a type's bar → the units of that type, ranked by utilisation
      series: { cursor: 'pointer', point: { events: { click: function () { const g = byType[this.index ?? this.x]; if (g) setUnitsDrill({ mode: 'utilisation', typeFilter: g.type, typeName: typeName(g.type) }) } } } },
    },
    series: [{ name: 'Utilisation', data: byType.map(g => Math.round(g.util * 10) / 10), color: '#3E6DF4' }],
  }
  const reasonChart = {
    chart: { type: 'bar' },
    xAxis: { categories: eq.byReason.map(r => r.name) },
    yAxis: { title: { text: null }, labels: { format: '{value} h' } },
    legend: { enabled: false },
    tooltip: { valueSuffix: ' h' },
    series: [{ name: 'Downtime', data: eq.byReason.map(r => Math.round(r.hours * 10) / 10), color: '#F59E0B' }],
  }
  const maxDownUnit = eq.topUnits[0]?.hours || 1
  const lostT = kp.loss.byCause.find(c => c.cause === 'Equipment Downtime')?.value || 0

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      <BruceInsight
        variant="rail"
        context={ctx}
        tone={utilStatus(eq.utilizationPct)}
        task="In 15-20 words, say what is dragging equipment availability — name the top downtime reason and the worst unit(s) — and the practical takeaway."
        detail="Explain what's causing equipment downtime — the main reasons and the worst units — and what to prioritise." />

      {/* headline KPIs — one shared anatomy: label / value / pinned footer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, alignItems: 'stretch' }}>
        <ClickCard title="See utilisation per unit" onClick={() => setUnitsDrill({ mode: 'utilisation' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Equipment Utilisation</span>
            <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-brand-default)', fontSize: 14, lineHeight: 1 }}>→</span>
          </div>
          <span className="HeadingLargeSemibold" style={{ color: uSt.text, ...NUM, fontSize: 27, lineHeight: 1 }}>{fmt(eq.utilizationPct, 1)}%</span>
          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-gray-subtle)' }}>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Running ÷ planned operating time</span>
          </div>
        </ClickCard>
        <ClickCard title="See downtime per unit" onClick={() => setUnitsDrill({ mode: 'downtime' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Total Downtime</span>
            <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-brand-default)', fontSize: 14, lineHeight: 1 }}>→</span>
          </div>
          <span className="HeadingLargeSemibold" style={{ ...NUM, fontSize: 27, lineHeight: 1 }}>{fmt(eq.downtimeHours)} h</span>
          {shiftMode && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ShiftChip name={kp.shifts[0].name} h={eq.downtimeHours * s1share} />
              <ShiftChip name={kp.shifts[1].name} h={eq.downtimeHours * (1 - s1share)} />
            </div>
          )}
          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-gray-subtle)' }}>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{eq.unitCount} units · {kp.days} day{kp.days === 1 ? '' : 's'}</span>
          </div>
        </ClickCard>
        <KpiStat label="Production lost to downtime" value={lostT} unit="T" kpi={{ status: 'warning' }} sub="Tonnes not produced while machines were down" />
      </div>

      {/* utilisation by type + downtime by reason — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        <Panel style={{ padding: 18, minWidth: 0 }}>
          <Chart title="Utilisation by Equipment Type" height={300} options={utilChart} />
        </Panel>
        <Panel style={{ padding: 18, minWidth: 0 }}>
          <Chart title="Downtime by Reason" sub="Hours lost, largest first" height={300} options={reasonChart} />
        </Panel>
      </div>

      {/* top equipment by downtime — click a row for the unit's full detail */}
      <Panel>
        <div style={{ display: 'grid', gap: 12 }}>
          <span className="BodyLargeSemibold">Top Equipment by Downtime</span>
          <div style={{ display: 'grid', gap: 2 }}>
            {eq.topUnits.map((u, i) => (
              <div key={u.id} role="button" tabIndex={0} title={`Open ${u.id} detail`}
                onClick={() => openUnit(u.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUnit(u.id) } }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                style={{ display: 'grid', gridTemplateColumns: '78px 1fr 62px 14px', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--global-border-radius-medium)', cursor: 'pointer', transition: 'background 120ms' }}>
                <span><b className="BodySmallSemibold" style={NUM}>{u.id}</b><div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{u.typeName}</div></span>
                <span style={{ height: 8, background: 'var(--background-surface-subtle)', borderRadius: 999, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(u.hours / maxDownUnit) * 100}%`, borderRadius: 999, background: i === 0 ? 'var(--background-error-default)' : 'var(--background-warning-default)' }} />
                </span>
                <span className="BodySmallRegular" style={{ textAlign: 'right', ...NUM }}>{fmt(u.hours, 1)} h</span>
                <span aria-hidden style={{ color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Plant process health — crusher / conveyor / thickener, one card each */}
      <div style={{ display: 'grid', gap: 12 }}>
        <Eyebrow>Plant process health</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, alignItems: 'stretch' }}>

          <ProcessCard title="Crusher" subtitle="Primary crusher · CHPP">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <MiniKpi label="Reduction Ratio" value={cr.reductionRatio.actual} unit=":1" dp={1} kpi={cr.reductionRatio} />
              <MiniKpi label="Power / Ton" value={cr.powerPerTon.actual} unit="kWh/T" dp={2} kpi={cr.powerPerTon} />
              <MiniKpi label="Feed Rate" value={cr.feedRate.actual} unit="T/hr" dp={0} kpi={cr.feedRate} />
            </div>
            <TrendButton onClick={() => setTrendOpen('crusher')} />
          </ProcessCard>

          <ProcessCard title="Conveyor Belt" subtitle="CHPP belts">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <MiniKpi label="Belt Loading" value={cv.beltLoading.actual} unit="%" dp={1} kpi={cv.beltLoading} />
              <MiniKpi label="Speed Deviation" value={cv.speedDeviation.actual} unit="%" dp={1} kpi={cv.speedDeviation} />
              <MiniKpi label="Active Anomalies" value={cv.activeCount} dp={0} tone={anomStatus}
                onClick={() => setAnomOpen(true)} title="Open the vision evidence log" />
            </div>
            <TrendButton onClick={() => setTrendOpen('conveyor')} />
          </ProcessCard>

          <ProcessCard title="Thickener" subtitle="CHPP tailings">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <MiniKpi label="Underflow Density" value={tk.underflowDensity.actual} unit="%" dp={1} kpi={tk.underflowDensity} />
              <MiniKpi label="Overflow Turbidity" value={tk.overflowTurbidity.actual} unit="NTU" dp={1} kpi={tk.overflowTurbidity} />
            </div>
            <TrendButton onClick={() => setTrendOpen('thickener')} />
          </ProcessCard>
        </div>
      </div>

      {/* process trend modals — full chart: labelled axes, legend toggles, drag-to-zoom */}
      {trendOpen === 'crusher' && (
        <Modal isOpen onClose={() => setTrendOpen(null)} maxWidth={820} title="Crusher — Feed Rate & Power / Ton"
          subtitle="Per day over the selected range · drag to zoom · click a legend item to hide or show a line">
          <Chart height={400} options={crChart} />
        </Modal>
      )}
      {trendOpen === 'conveyor' && (
        <Modal isOpen onClose={() => setTrendOpen(null)} maxWidth={820} title="Conveyor Belt — Loading & Speed Deviation"
          subtitle="Per day over the selected range · drag to zoom · click a legend item to hide or show a line">
          <Chart height={400} options={cvChart} />
        </Modal>
      )}
      {trendOpen === 'thickener' && (
        <Modal isOpen onClose={() => setTrendOpen(null)} maxWidth={820} title="Thickener — Underflow Density & Overflow Turbidity"
          subtitle="Per day over the selected range · drag to zoom · click a legend item to hide or show a line">
          <Chart height={400} options={tkChart} />
        </Modal>
      )}

      {sel && (
        <EquipmentDrawer unit={sel.unit} status={sel.status} range={range} settings={settings} assignments={assignments} now={now} onClose={() => setSel(null)} />
      )}
      <BeltAnomaliesModal isOpen={anomOpen} onClose={() => setAnomOpen(false)} anomalies={cv.anomalies} activeCount={cv.activeCount} />
      <UnitsDrillModal isOpen={!!unitsDrill} onClose={() => setUnitsDrill(null)}
        mode={unitsDrill?.mode} typeFilter={unitsDrill?.typeFilter} typeName={unitsDrill?.typeName}
        filters={{ mineId, areaId, equipTypeId }} days={kp.days} settings={settings} overallUtil={kp.utilization.pct}
        onUnitClick={(id) => { setUnitsDrill(null); openUnit(id) }} />
    </div>
  )
}

// ghost pill that opens a process's full trend modal — same anatomy as the
// equipment drawer's "Sensor data" button (the ONE style for "open a chart")
const TrendButton = ({ onClick }) => (
  <button onClick={onClick} title="Open the full trend chart" className="BodySmallSemibold"
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" /></svg>
    View trend
  </button>
)

// clickable KPI card shell — same anatomy/hover as KpiStat
const ClickCard = ({ title, onClick, children }) => (
  <div role="button" tabIndex={0} title={title}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-sm)'; e.currentTarget.style.transform = 'none' }}
    style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', transition: 'box-shadow 150ms, transform 150ms' }}>
    {children}
  </div>
)

// One plant-process card — header (name) over its KPIs and trend. No status tag:
// the per-KPI delta pills already carry the state. Flex column: the trend (last
// child) pins to the bottom so all cards in the row read as equal blocks.
const ProcessCard = ({ title, subtitle, children }) => {
  const kids = Array.isArray(children) ? children : [children]
  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'grid', gap: 1 }}>
        <span className="BodyLargeSemibold">{title}</span>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{subtitle}</span>
      </div>
      {kids.slice(0, -1)}
      <div style={{ marginTop: 'auto', minWidth: 0 }}>{kids[kids.length - 1]}</div>
    </Panel>
  )
}

const typeName = (id) => EQUIP_TYPES.find(t => t.id === id)?.name || id
const ShiftChip = ({ name, h }) => (
  <span className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'var(--background-surface-subtle)', ...NUM }}>
    {name} <b>{fmt(h, 1)} h</b>
  </span>
)
