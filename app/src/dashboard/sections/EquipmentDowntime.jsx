// Section 3 · Equipment Utilisation & Downtime — "How effectively are machines
// operating, and where are we losing time?" Utilisation = Running / Planned
// operating time (NOT availability), with breakdown by type; downtime by reason
// and top contributors, ranked so the biggest losses are obvious.
import { useMemo } from 'react'
import { ColumnChart } from '@faclon-labs/design-sdk/ColumnChart'
import { HorizontalGroupBarChart } from '@faclon-labs/design-sdk/HorizontalGroupBarChart'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { buildEquipment } from '../calc/equipment'
import { NUM, STATUS, fmt, utilStatus } from '../calc/format'
import { EQUIP_TYPES } from '../data/taxonomy'
import { KpiStat } from '../components/KpiStat'
import { Panel, KpiTile } from '../components/primitives'

export function EquipmentDowntime() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings } = useDash()
  const kp = useMemo(
    () => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings],
  )
  const eq = useMemo(
    () => buildEquipment({ range, mineId, areaId, equipTypeId, settings, overallUtil: kp.utilization.pct }),
    [range, mineId, areaId, equipTypeId, settings, kp.utilization.pct],
  )

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
    </div>
  )
}

const typeName = (id) => EQUIP_TYPES.find(t => t.id === id)?.name || id
const ShiftChip = ({ name, h }) => (
  <span className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--global-border-radius-max)', background: 'var(--background-surface-subtle)', ...NUM }}>
    {name} <b>{fmt(h, 1)} h</b>
  </span>
)
