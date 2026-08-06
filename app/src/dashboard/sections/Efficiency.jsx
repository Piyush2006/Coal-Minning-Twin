// Section 2 · Efficiency & Cost — "Are we operating efficiently and within the
// expected cost?" Cost Variance + Energy/Ton + Fuel/Ton (no separate energy-cost
// or fuel-cost KPIs, by spec), plus an intensity trend of the same two KPIs.
import { useMemo } from 'react'
import { LineChart } from '@faclon-labs/design-sdk/LineChart'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { NUM, STATUS, fmt, fmtSigned } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { fmtStamp } from '../data/time'
import { KpiStat } from '../components/KpiStat'
import { Panel, KpiTile } from '../components/primitives'

const BUDGET_LABEL = { positive: 'Under budget', normal: 'On budget', warning: 'Over budget', critical: 'Over budget' }

export function Efficiency() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings } = useDash()
  const kp = useMemo(
    () => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings],
  )

  const cost = kp.cost
  const cSt = STATUS[cost.status]
  const t = kp.trend
  const hcOpts = {
    yAxis: [
      { title: { text: 'kWh/T' }, plotLines: [{ value: settings.targetEnergyPerTon, color: 'var(--background-info-default)', width: 1.4, dashStyle: 'Dash', label: { text: `Target ${settings.targetEnergyPerTon}`, style: { color: 'var(--text-info-default)', fontSize: '10px' } } }] },
      { title: { text: 'L/T' }, opposite: true, plotLines: [{ value: settings.targetFuelPerTon, color: 'var(--background-warning-default)', width: 1.4, dashStyle: 'Dash', label: { text: `Target ${settings.targetFuelPerTon}`, style: { color: 'var(--text-warning-default)', fontSize: '10px' }, align: 'right' } }] },
    ],
    series: [{ yAxis: 0 }, { yAxis: 1 }],
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
        </KpiTile>

        <KpiStat label="Energy / Ton" value={kp.energy.actual} unit="kWh/T" dp={2} kpi={kp.energy} />
        <KpiStat label="Fuel / Ton" value={kp.fuel.actual} unit="L/T" dp={3} kpi={kp.fuel} />
      </div>

      {shiftMode && (
        <Panel>
          <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Shift breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(3, 1fr)', gap: 8, alignItems: 'center' }}>
            {['', 'Cost/T', 'Energy/T', 'Fuel/T'].map((h, i) => (
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
          title="Energy & Fuel Intensity vs Target"
          duration={`${fmtStamp(range.start)} → ${fmtStamp(range.end)}`}
          categories={t.categories}
          series={[
            { name: 'Energy (kWh/T)', data: t.energyPerTon, color: 'var(--background-info-default)' },
            { name: 'Fuel (L/T)', data: t.fuelPerTon, color: 'var(--background-warning-default)' },
          ]}
          showLegend
          smooth
          showMarkers={t.categories.length <= 31}
          xAxisTitle="Day"
          highchartsOptions={hcOpts}
        />
      </div>
    </div>
  )
}

const ShiftRow = ({ sh }) => (
  <>
    <span className="BodySmallSemibold">{sh.name}</span>
    <span className="BodySmallRegular" style={NUM}>{CURRENCY}{fmt(sh.costPerTon)}</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.energyPerTon, 2)} kWh/T</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.fuelPerTon, 3)} L/T</span>
  </>
)
