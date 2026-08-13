// Section 2 · Efficiency & Cost — "Are we operating efficiently and within the
// expected cost?" Cost Variance + Energy/Ton + Fuel/Ton (no separate energy-cost
// or fuel-cost KPIs, by spec), plus small-multiple intensity trends vs target.
import { useMemo, useState } from 'react'
import { Chart, dashedTarget } from '../components/Chart'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { NUM, STATUS, fmt, fmtSigned } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { fmtStamp } from '../data/time'
import { KpiStat } from '../components/KpiStat'
import { MetricDrillModal } from '../components/MetricDrill'
import { Panel } from '../components/primitives'
import { CARD, Pill, toneOf } from '../components/ui'
import { CostTableModal } from '../components/CostTableModal'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

const BUDGET_LABEL = { positive: 'Under budget', normal: 'On budget', warning: 'Over budget', critical: 'Over budget' }

export function Efficiency() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const kp = useMemo(
    () => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings, plan],
  )

  const [costOpen, setCostOpen] = useState(false)
  const [drill, setDrill] = useState(null)   // 'energy' | 'fuel' | 'labour' | null
  const ctx = useMemo(
    () => buildBruceContext({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings, plan],
  )
  const cost = kp.cost
  const cSt = STATUS[cost.status]
  const t = kp.trend
  const tg = kp.targets   // plan-derived intensity targets (null when the plan omits them)

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      {/* slim insight strip with a 3px purple rail */}
      <BruceInsight
        variant="rail"
        context={ctx}
        tone={cost.status}
        task="In 15-20 words, say what is driving the operating-cost / efficiency position — name which of fuel, energy or man-hours per ton is over target and why (e.g. downtime, idling)."
        detail="Explain what's driving our operating cost per ton and which efficiency intensities (energy, fuel, man-hours) are over target and why." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'stretch' }}>
        {/* Cost Variance — the whole card IS the drill-down into the daily cost table */}
        <div role="button" tabIndex={0} title="Open the daily cost table"
          onClick={() => setCostOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCostOpen(true) } }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-sm)'; e.currentTarget.style.transform = 'none' }}
          style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', transition: 'box-shadow 150ms, transform 150ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Cost Variance</span>
            <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-brand-default)', fontSize: 14, lineHeight: 1 }}>→</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="HeadingLargeSemibold" style={{ color: cSt.text, ...NUM, fontSize: 27, lineHeight: 1 }}>{fmtSigned(cost.variance, 1)}%</span>
            <Pill tone={toneOf(cost.status)}>{BUDGET_LABEL[cost.status]}</Pill>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-gray-subtle)' }}>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>
              {CURRENCY}{fmt(cost.actual)}/T vs {CURRENCY}{fmt(cost.target)}/T target
            </span>
          </div>
        </div>

        <KpiStat label="Energy / Ton" value={kp.energy.actual} unit="kWh/T" dp={2} kpi={kp.energy} onClick={() => setDrill('energy')} />
        <KpiStat label="Fuel / Ton" value={kp.fuel.actual} unit="L/T" dp={3} kpi={kp.fuel} onClick={() => setDrill('fuel')} />
        <KpiStat label="Man-Hours / Ton" value={kp.manHours.actual} unit="mh/T" dp={3} kpi={kp.manHours} onClick={() => setDrill('labour')} />
      </div>

      {shiftMode && (
        <Panel>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Shift breakdown</div>
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

      {/* Small multiples — one intensity each, so trend + target read at a glance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Intensity title="Energy Intensity" unit="kWh/T" color="#3E6DF4" data={t.energyPerTon} categories={t.categories} target={tg.energy} dp={2} />
        <Intensity title="Fuel Intensity" unit="L/T" color="#F59E0B" data={t.fuelPerTon} categories={t.categories} target={tg.fuel} dp={2} />
        <Intensity title="Labour Intensity" unit="mh/T" color="#0E9F6E" data={t.manHoursPerTon} categories={t.categories} target={tg.manHours} dp={2} />
      </div>

      <CostTableModal isOpen={costOpen} onClose={() => setCostOpen(false)}
        costByDay={kp.costByDay} shiftMode={shiftMode}
        shiftNames={[kp.shifts[0]?.name || 'Shift 1', kp.shifts[1]?.name || 'Shift 2']} />

      {/* KPI drill-downs — daily values vs target, one shared language */}
      <MetricDrillModal isOpen={drill === 'energy'} onClose={() => setDrill(null)}
        title="Energy / Ton" subtitle="kWh consumed per saleable tonne, per day" unit="kWh/T" dp={2}
        categories={t.categories} values={t.energyPerTon} target={tg.energy} goodIfHigh={false} />
      <MetricDrillModal isOpen={drill === 'fuel'} onClose={() => setDrill(null)}
        title="Fuel / Ton" subtitle="Diesel litres per saleable tonne, per day" unit="L/T" dp={3}
        categories={t.categories} values={t.fuelPerTon} target={tg.fuel} goodIfHigh={false} color="#F59E0B" />
      <MetricDrillModal isOpen={drill === 'labour'} onClose={() => setDrill(null)}
        title="Man-Hours / Ton" subtitle="Man-hours per saleable tonne, per day" unit="mh/T" dp={3}
        categories={t.categories} values={t.manHoursPerTon} target={tg.manHours} goodIfHigh={false} color="#0E9F6E" />
    </div>
  )
}

// One intensity trend vs its plan target — compact card in the small-multiple grid.
const Intensity = ({ title, unit, color, data, categories, target, dp = 2 }) => (
  <Panel style={{ padding: 18, minWidth: 0 }}>
    <Chart title={title} height={225} options={{
      chart: { type: 'spline' },
      xAxis: { categories },
      yAxis: { title: { text: null }, labels: { format: `{value} ${unit}` }, plotLines: target != null ? [dashedTarget(target, `Target ${fmt(target, dp)}`, 'right')] : [] },
      legend: { enabled: false },
      tooltip: { valueSuffix: ` ${unit}` },
      plotOptions: { spline: { marker: { enabled: categories.length <= 31, radius: 3 } } },
      series: [{ name: title, data, color }],
    }} />
  </Panel>
)

const ShiftRow = ({ sh }) => (
  <>
    <span className="BodySmallSemibold">{sh.name}</span>
    <span className="BodySmallRegular" style={NUM}>{CURRENCY}{fmt(sh.costPerTon)}</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.energyPerTon, 2)} kWh/T</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.fuelPerTon, 3)} L/T</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.manHoursPerTon, 3)} mh/T</span>
  </>
)
