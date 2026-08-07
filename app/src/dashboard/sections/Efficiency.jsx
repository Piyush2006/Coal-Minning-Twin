// Section 2 · Efficiency & Cost — "Are we operating efficiently and within the
// expected cost?" Cost Variance + Energy/Ton + Fuel/Ton (no separate energy-cost
// or fuel-cost KPIs, by spec), plus an intensity trend of the same two KPIs.
import { useMemo, useState } from 'react'
import { LineChart } from '@faclon-labs/design-sdk/LineChart'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { NUM, STATUS, fmt, fmtSigned } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { fmtStamp } from '../data/time'
import { KpiStat } from '../components/KpiStat'
import { Panel, KpiTile } from '../components/primitives'
import { CostTableModal } from '../components/CostTableModal'

const BUDGET_LABEL = { positive: 'Under budget', normal: 'On budget', warning: 'Over budget', critical: 'Over budget' }

export function Efficiency() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const kp = useMemo(
    () => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings, plan],
  )

  const [costOpen, setCostOpen] = useState(false)
  const cost = kp.cost
  const cSt = STATUS[cost.status]
  const t = kp.trend
  const tg = kp.targets   // plan-derived intensity targets (null when the plan omits them)
  // a dashed target plotLine only when the plan supplies that target
  const plot = (val, color, textColor, align) => val != null
    ? [{ value: val, color, width: 1.4, dashStyle: 'Dash', label: { text: `Target ${val}`, style: { color: textColor, fontSize: '10px' }, align } }]
    : []
  const hcOpts = {
    yAxis: [
      { title: { text: 'kWh/T' }, plotLines: plot(tg.energy, 'var(--background-info-default)', 'var(--text-info-default)', 'left') },
      { title: { text: 'L/T' }, opposite: true, plotLines: plot(tg.fuel, 'var(--background-warning-default)', 'var(--text-warning-default)', 'right') },
      { title: { text: 'mh/T' }, opposite: true, offset: 52, plotLines: plot(tg.manHours, 'var(--background-positive-default)', 'var(--text-positive-default)', 'right') },
    ],
    series: [{ yAxis: 0 }, { yAxis: 1 }, { yAxis: 2 }],
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {/* Cost Variance — the only cost KPI */}
        <KpiTile>
          <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Cost Variance</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="HeadingLargeSemibold" style={{ color: cSt.text, ...NUM }}>{fmtSigned(cost.variance, 1)}%</span>
            <Badge color={cSt.badge} emphasis="Subtle" size="Small">{BUDGET_LABEL[cost.status]}</Badge>
          </div>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>
            {CURRENCY}{fmt(cost.actual)}/T actual vs {CURRENCY}{fmt(cost.target)}/T planned
          </span>
          <button onClick={() => setCostOpen(true)}
            style={{ marginTop: 4, justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', color: 'var(--text-brand-default)', cursor: 'pointer', font: 'inherit' }}
            className="BodyXSmallSemibold">⤢ Daily cost table</button>
        </KpiTile>

        <KpiStat label="Energy / Ton" value={kp.energy.actual} unit="kWh/T" dp={2} kpi={kp.energy} />
        <KpiStat label="Fuel / Ton" value={kp.fuel.actual} unit="L/T" dp={3} kpi={kp.fuel} />
        <KpiStat label="Man-Hours / Ton" value={kp.manHours.actual} unit="mh/T" dp={3} kpi={kp.manHours} />
      </div>

      {shiftMode && (
        <Panel>
          <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Shift breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(4, 1fr)', gap: 8, alignItems: 'center' }}>
            {['', 'Cost/T', 'Energy/T', 'Fuel/T', 'Man-Hrs/T'].map((h, i) => (
              <span key={i} className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{h}</span>
            ))}
            {kp.shifts.map(sh => (
              <ShiftRow key={sh.name} sh={sh} />
            ))}
          </div>
        </Panel>
      )}

      <div style={{ height: 360 }}>
        <LineChart
          title="Energy, Fuel & Labour Intensity vs Target"
          duration={`${fmtStamp(range.start)} → ${fmtStamp(range.end)}`}
          categories={t.categories}
          series={[
            { name: 'Energy (kWh/T)', data: t.energyPerTon, color: 'var(--background-info-default)' },
            { name: 'Fuel (L/T)', data: t.fuelPerTon, color: 'var(--background-warning-default)' },
            { name: 'Man-Hours (mh/T)', data: t.manHoursPerTon, color: 'var(--background-positive-default)' },
          ]}
          showLegend
          smooth
          showMarkers={t.categories.length <= 31}
          xAxisTitle="Day"
          highchartsOptions={hcOpts}
        />
      </div>

      <CostTableModal isOpen={costOpen} onClose={() => setCostOpen(false)}
        costByDay={kp.costByDay} shiftMode={shiftMode}
        shiftNames={[kp.shifts[0]?.name || 'Shift 1', kp.shifts[1]?.name || 'Shift 2']} />
    </div>
  )
}

const ShiftRow = ({ sh }) => (
  <>
    <span className="BodySmallSemibold">{sh.name}</span>
    <span className="BodySmallRegular" style={NUM}>{CURRENCY}{fmt(sh.costPerTon)}</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.energyPerTon, 2)} kWh/T</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.fuelPerTon, 3)} L/T</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.manHoursPerTon, 3)} mh/T</span>
  </>
)
