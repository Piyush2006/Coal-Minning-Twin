// Section 3 · Equipment Utilisation & Downtime — "How effectively are machines
// operating, and where are we losing time?" Utilisation = Running / Planned
// operating time (NOT availability), with breakdown by type; downtime by reason
// and top contributors, ranked so the biggest losses are obvious.
import { useMemo } from 'react'
import { ColumnChart } from '@faclon-labs/design-sdk/ColumnChart'
import { HorizontalGroupBarChart } from '@faclon-labs/design-sdk/HorizontalGroupBarChart'
import { LineChart } from '@faclon-labs/design-sdk/LineChart'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { buildEquipment } from '../calc/equipment'
import { buildCrusher } from '../calc/crusher'
import { buildConveyor } from '../calc/conveyor'
import { buildThickener } from '../calc/thickener'
import { NUM, STATUS, fmt, utilStatus } from '../calc/format'
import { EQUIP_TYPES } from '../data/taxonomy'
import { KpiStat } from '../components/KpiStat'
import { Panel, KpiTile } from '../components/primitives'
import { BeltAnomalies } from '../components/BeltAnomalies'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

export function EquipmentDowntime() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
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
  const cr = useMemo(
    () => buildCrusher({ range, mineId, areaId, equipTypeId }),
    [range, mineId, areaId, equipTypeId],
  )
  const cv = useMemo(
    () => buildConveyor({ range, mineId, areaId, equipTypeId }),
    [range, mineId, areaId, equipTypeId],
  )
  const cvHc = {
    yAxis: [
      { title: { text: 'Loading %' }, plotLines: [{ value: cv.targets.targetLoading, color: 'var(--background-info-default)', width: 1.4, dashStyle: 'Dash', label: { text: `Target ${cv.targets.targetLoading}%`, style: { color: 'var(--text-info-default)', fontSize: '10px' } } }] },
      { title: { text: 'Speed dev %' }, opposite: true, plotLines: [{ value: 0, color: 'var(--text-gray-secondary)', width: 1.2, dashStyle: 'Dash', label: { text: 'Target 0%', style: { color: 'var(--text-gray-secondary)', fontSize: '10px' }, align: 'right' } }] },
    ],
    series: [{ yAxis: 0 }, { yAxis: 1 }],
  }
  const anomStatus = cv.activeCount ? (cv.anomalies.some(a => a.active && a.severity === 'Critical') ? 'critical' : 'warning') : 'positive'
  const tk = useMemo(
    () => buildThickener({ range, mineId, areaId, equipTypeId }),
    [range, mineId, areaId, equipTypeId],
  )
  const tkHc = {
    yAxis: [
      { title: { text: 'Density %' }, plotLines: [{ value: tk.targets.targetDensity, color: 'var(--background-info-default)', width: 1.4, dashStyle: 'Dash', label: { text: `Target ${tk.targets.targetDensity}%`, style: { color: 'var(--text-info-default)', fontSize: '10px' } } }] },
      { title: { text: 'Turbidity NTU' }, opposite: true, plotLines: [{ value: tk.targets.targetTurbidity, color: 'var(--background-warning-default)', width: 1.4, dashStyle: 'Dash', label: { text: `Target ${tk.targets.targetTurbidity}`, style: { color: 'var(--text-warning-default)', fontSize: '10px' }, align: 'right' } }] },
    ],
    series: [{ yAxis: 0 }, { yAxis: 1 }],
  }
  const crHc = {
    yAxis: [
      { title: { text: 'T/hr' }, plotLines: [{ value: cr.targets.feedRate, color: 'var(--background-info-default)', width: 1.4, dashStyle: 'Dash', label: { text: `Target ${cr.targets.feedRate}`, style: { color: 'var(--text-info-default)', fontSize: '10px' } } }] },
      { title: { text: 'kWh/T' }, opposite: true, plotLines: [{ value: cr.targets.powerPerTon, color: 'var(--background-warning-default)', width: 1.4, dashStyle: 'Dash', label: { text: `Target ${cr.targets.powerPerTon}`, style: { color: 'var(--text-warning-default)', fontSize: '10px' }, align: 'right' } }] },
    ],
    series: [{ yAxis: 0 }, { yAxis: 1 }],
  }
  const uSt = STATUS[utilStatus(eq.utilizationPct)]
  // shift split of the fleet downtime, allocated by the production shift ratio
  const s1d = kp.shifts[0].downtimeHours, s2d = kp.shifts[1].downtimeHours
  const s1share = (s1d + s2d) ? s1d / (s1d + s2d) : 0.5

  const utilByType = {
    yAxis: { max: 100, plotLines: [{ value: eq.utilizationPct, color: 'var(--text-gray-secondary)', width: 1.4, dashStyle: 'Dash', zIndex: 5, label: { text: `Fleet ${fmt(eq.utilizationPct)}%`, style: { color: 'var(--text-gray-secondary)', fontSize: '10px' } } }] },
  }
  const maxDownUnit = eq.topUnits[0]?.hours || 1

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      <BruceInsight
        context={ctx}
        tone={utilStatus(eq.utilizationPct)}
        task="In 15-20 words, say what is dragging equipment availability — name the top downtime reason and the worst unit(s) — and the practical takeaway."
        detail="Explain what's causing equipment downtime — the main reasons and the worst units — and what to prioritise." />

      {/* headline KPIs — each its own bordered tile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, alignItems: 'stretch' }}>
        <KpiTile>
          <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Equipment Utilisation</span>
          <span className="DisplaySmallSemibold" style={{ color: uSt.text, ...NUM }}>{fmt(eq.utilizationPct, 1)}%</span>
        </KpiTile>
        <KpiTile>
          <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Total Downtime</span>
          <span className="HeadingLargeSemibold" style={{ ...NUM }}>{fmt(eq.downtimeHours)} h</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{eq.unitCount} units · {kp.days} day{kp.days === 1 ? '' : 's'}</span>
          {shiftMode && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <ShiftChip name={kp.shifts[0].name} h={eq.downtimeHours * s1share} />
              <ShiftChip name={kp.shifts[1].name} h={eq.downtimeHours * (1 - s1share)} />
            </div>
          )}
        </KpiTile>
        <KpiStat label="Production lost to downtime" value={kp.loss.byCause.find(c => c.cause === 'Equipment Downtime')?.value || 0} unit="T"
          kpi={{ status: 'warning' }} />
      </div>

      {/* utilisation by equipment type */}
      <div style={{ height: 320 }}>
        <ColumnChart
          title="Utilisation by Equipment Type"
          categories={eq.byType.map(g => typeName(g.type))}
          series={[{ name: 'Utilisation', data: eq.byType.map(g => Math.round(g.util * 10) / 10), color: 'var(--background-info-default)' }]}
          showLegend={false}
          showDataLabels
          dataLabelFormat="{point.y:.0f}%"
          yAxisUnit=" %"
          yAxisTitle="Utilisation %"
          xAxisTitle="Equipment type"
          highchartsOptions={utilByType}
        />
      </div>

      {/* downtime by reason + top equipment */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
        <div style={{ height: 320 }}>
          <HorizontalGroupBarChart
            title="Downtime by Reason"
            duration="Hours lost, largest first"
            categories={eq.byReason.map(r => r.name)}
            series={[{ name: 'Downtime (h)', data: eq.byReason.map(r => Math.round(r.hours * 10) / 10), color: 'var(--background-warning-default)' }]}
          />
        </div>

        <Panel>
          <div style={{ display: 'grid', gap: 12 }}>
            <span className="BodyMediumSemibold">Top Equipment by Downtime</span>
            <div style={{ display: 'grid', gap: 2 }}>
              {eq.topUnits.map((u, i) => (
                <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 62px', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--global-border-radius-large)', background: i % 2 ? 'transparent' : 'var(--background-surface-subtle)' }}>
                  <span><b className="BodySmallSemibold" style={NUM}>{u.id}</b><div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{u.typeName}</div></span>
                  <span style={{ height: 8, background: 'var(--background-surface-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${(u.hours / maxDownUnit) * 100}%`, background: i === 0 ? 'var(--background-error-default)' : 'var(--background-warning-default)' }} />
                  </span>
                  <span className="BodySmallRegular" style={{ textAlign: 'right', ...NUM }}>{fmt(u.hours, 1)} h</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Crusher performance — primary crusher (CHPP) */}
      <div style={{ display: 'grid', gap: 14 }}>
        <span className="BodyMediumSemibold">Crusher Performance</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          <KpiStat label="Crusher Reduction Ratio" value={cr.reductionRatio.actual} unit=":1" dp={1} kpi={cr.reductionRatio}
            tooltip="Average Feed Size ÷ Average Product Size — how much the crusher reduces top size (higher = more reduction)." />
          <KpiStat label="Crusher Power / Ton" value={cr.powerPerTon.actual} unit="kWh/T" dp={2} kpi={cr.powerPerTon}
            tooltip="Crusher Energy Consumption (kWh) ÷ Coal Processed (T) — crushing energy intensity (lower = better)." />
          <KpiStat label="Crusher Feed Rate" value={cr.feedRate.actual} unit="T/hr" dp={0} kpi={cr.feedRate}
            tooltip="Coal Fed (T) ÷ Operating Hours — average throughput while the crusher is running." />
        </div>
        <div style={{ height: 300 }}>
          <LineChart
            title="Crusher Feed Rate & Power / Ton vs Target"
            categories={cr.trend.categories}
            series={[
              { name: 'Feed Rate (T/hr)', data: cr.trend.feedRate, color: 'var(--background-info-default)' },
              { name: 'Power / Ton (kWh/T)', data: cr.trend.powerPerTon, color: 'var(--background-warning-default)' },
            ]}
            showLegend
            smooth
            showMarkers={cr.trend.categories.length <= 31}
            xAxisTitle="Day"
            highchartsOptions={crHc}
          />
        </div>
      </div>

      {/* Conveyor belt performance — CHPP belts */}
      <div style={{ display: 'grid', gap: 14 }}>
        <span className="BodyMediumSemibold">Conveyor Belt</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          <KpiStat label="Belt Loading" value={cv.beltLoading.actual} unit="%" dp={1} kpi={cv.beltLoading}
            tooltip="Actual Throughput ÷ Rated Conveyor Capacity × 100 — how full the belt runs (target 85%)." />
          <KpiStat label="Belt Speed Deviation" value={cv.speedDeviation.actual} unit="%" dp={1} kpi={cv.speedDeviation}
            sub="Target 0% · within ±2% is on-spec"
            tooltip="(Actual Belt Speed − Target Belt Speed) ÷ Target Belt Speed × 100 — closer to 0% is better." />
          <KpiStat label="Active Belt Anomalies" value={cv.activeCount} dp={0} kpi={{ status: anomStatus }}
            sub={`${cv.anomalyTotal} detected in range`}
            tooltip="Vision-detected belt events currently active — belt tear, foreign object, spillage or misalignment." />
        </div>
        <div style={{ height: 300 }}>
          <LineChart
            title="Belt Loading & Speed Deviation vs Target"
            categories={cv.trend.categories}
            series={[
              { name: 'Belt Loading (%)', data: cv.trend.loading, color: 'var(--background-info-default)' },
              { name: 'Speed Deviation (%)', data: cv.trend.speedDev, color: 'var(--background-warning-default)' },
            ]}
            showLegend
            smooth
            showMarkers={cv.trend.categories.length <= 31}
            xAxisTitle="Day"
            highchartsOptions={cvHc}
          />
        </div>
        <BeltAnomalies anomalies={cv.anomalies} activeCount={cv.activeCount} />
      </div>

      {/* Thickener performance — CHPP tailings */}
      <div style={{ display: 'grid', gap: 14 }}>
        <span className="BodyMediumSemibold">Thickener</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          <KpiStat label="Underflow Density" value={tk.underflowDensity.actual} unit="%" dp={1} kpi={tk.underflowDensity}
            tooltip="Solids Mass ÷ Total Underflow Slurry Mass × 100 — how dewatered the underflow is (higher = denser)." />
          <KpiStat label="Overflow Turbidity" value={tk.overflowTurbidity.actual} unit="NTU" dp={1} kpi={tk.overflowTurbidity}
            tooltip="Overflow water clarity in NTU vs the configured target (lower = clearer)." />
        </div>
        <div style={{ height: 300 }}>
          <LineChart
            title="Underflow Density & Overflow Turbidity vs Target"
            categories={tk.trend.categories}
            series={[
              { name: 'Underflow Density (%)', data: tk.trend.density, color: 'var(--background-info-default)' },
              { name: 'Overflow Turbidity (NTU)', data: tk.trend.turbidity, color: 'var(--background-warning-default)' },
            ]}
            showLegend
            smooth
            showMarkers={tk.trend.categories.length <= 31}
            xAxisTitle="Day"
            highchartsOptions={tkHc}
          />
        </div>
      </div>
    </div>
  )
}

const typeName = (id) => EQUIP_TYPES.find(t => t.id === id)?.name || id
const ShiftChip = ({ name, h }) => (
  <span className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--global-border-radius-max)', background: 'var(--background-surface-subtle)', ...NUM }}>
    {name} <b>{fmt(h, 1)} h</b>
  </span>
)
