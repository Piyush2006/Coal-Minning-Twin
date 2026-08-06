// Section 1 · Production Performance — Target → Actual → Gap → Cause.
// Answers "Are we achieving our production target, and if not, why?"
import { useMemo } from 'react'
import { ColumnChart } from '@faclon-labs/design-sdk/ColumnChart'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { NUM, STATUS, fmt } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { fmtStamp } from '../data/time'
import { KpiStat } from '../components/KpiStat'
import { Panel, SegmentBar } from '../components/primitives'

const CAUSE_COLOR = {
  'Equipment Downtime': 'var(--background-error-default)',
  'Low Throughput': 'var(--background-warning-default)',
  'Other Operational Loss': 'var(--text-gray-tertiary)',
}

export function ProductionPerformance() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings } = useDash()
  const kp = useMemo(
    () => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings],
  )

  const ach = kp.achievement
  const achSt = STATUS[ach.status]
  const gap = ach.planned - ach.actual

  const t = kp.trend
  const series = shiftMode
    ? [{ name: t.shift1Name, data: t.shift1, color: 'var(--background-info-default)' },
       { name: t.shift2Name, data: t.shift2, color: 'var(--background-positive-default)' }]
    : [{ name: 'Actual', data: t.actual, color: 'var(--background-info-default)' },
       { name: 'Planned', data: t.planned, color: 'var(--text-gray-tertiary)' }]
  const planPerDay = Math.round(ach.planned / Math.max(1, kp.days))
  const hcOpts = shiftMode
    ? { yAxis: { plotLines: [{ value: planPerDay, color: 'var(--text-gray-secondary)', width: 1.5, dashStyle: 'Dash', zIndex: 5, label: { text: `Plan/day ${fmt(planPerDay)} T`, style: { color: 'var(--text-gray-secondary)', fontSize: '11px' } } }] } }
    : undefined

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Hero — Plan vs Actual / Achievement, with the gap broken down by cause */}
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 1.5fr)', gap: 28, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Production Plan vs Actual</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span className="DisplayMediumSemibold" style={{ color: achSt.text, ...NUM }}>{fmt(ach.pct, 1)}%</span>
              <Badge color={achSt.badge} emphasis="Subtle" size="Medium">{achSt.label}</Badge>
            </div>
            <span className="BodyMediumRegular" style={{ color: 'var(--text-gray-secondary)', ...NUM }}>
              {fmt(ach.actual)} T actual of {fmt(ach.planned)} T planned
            </span>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
              <HeroStat label="Expected" value={`${fmt(ach.planned)} T`} />
              <HeroStat label="Actual" value={`${fmt(ach.actual)} T`} color={achSt.text} />
              <HeroStat label="Gap" value={`${gap >= 0 ? '' : '+'}${fmt(-gap)} T`} color={gap > 0 ? 'var(--text-error-default)' : 'var(--text-positive-default)'} />
            </div>
            {kp.loss.total > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                <SegmentBar segments={kp.loss.byCause.map(c => ({ label: c.cause, value: c.value, color: CAUSE_COLOR[c.cause] }))} height={12} />
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {kp.loss.byCause.map(c => {
                    const pct = kp.loss.total ? (c.value / kp.loss.total) * 100 : 0
                    return (
                      <span key={c.cause} className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-gray-secondary)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: CAUSE_COLOR[c.cause] }} />
                        {c.cause} <b style={{ color: 'var(--text-gray-primary)', ...NUM }}>{fmt(c.value)} T</b>
                        <span style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>· {fmt(pct)}%</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
            {shiftMode && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {kp.shifts.map(sh => (
                  <span key={sh.name} className="BodySmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--global-border-radius-max)', background: 'var(--background-surface-subtle)', ...NUM }}>
                    {sh.name} <b>{fmt(sh.actual)} T</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Secondary KPIs — each its own bordered tile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <KpiStat label="Throughput" value={kp.throughput.actual} unit="T/hr" kpi={kp.throughput} />
        <KpiStat label="Coal Yield / Recovery" value={kp.yield.actual} unit="%" dp={1} kpi={kp.yield} />
        <KpiStat label="Operating Cost / Ton" value={kp.cost.actual} unit={`${CURRENCY}/T`} kpi={kp.cost} />
      </div>
      {shiftMode && (
        <Panel>
          <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Shift breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(4, 1fr)', gap: 8, alignItems: 'center' }}>
            {['', 'Actual', 'Throughput', 'Yield', 'Cost/T'].map((h, i) => (
              <span key={i} className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{h}</span>
            ))}
            {kp.shifts.map(sh => (
              <ShiftRow key={sh.name} sh={sh} />
            ))}
          </div>
        </Panel>
      )}

      {/* Production vs Plan trend (interactive) */}
      <div style={{ height: 380 }}>
        <ColumnChart
          title="Production vs Plan"
          duration={`${fmtStamp(range.start)} → ${fmtStamp(range.end)}`}
          categories={t.categories}
          series={series}
          stacked={shiftMode}
          showLegend
          yAxisUnit=" T"
          xAxisTitle="Day"
          yAxisTitle="Tonnes"
          scrollable={t.categories.length > 31}
          highchartsOptions={hcOpts}
        />
      </div>

    </div>
  )
}

const HeroStat = ({ label, value, color }) => (
  <div style={{ display: 'grid', gap: 2 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodyLargeSemibold" style={{ color: color || 'var(--text-gray-primary)', ...NUM }}>{value}</span>
  </div>
)

const ShiftRow = ({ sh }) => (
  <>
    <span className="BodySmallSemibold">{sh.name}</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.actual)} T</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.throughput)} T/hr</span>
    <span className="BodySmallRegular" style={NUM}>{fmt(sh.yieldPct, 1)}%</span>
    <span className="BodySmallRegular" style={NUM}>{CURRENCY}{fmt(sh.costPerTon)}</span>
  </>
)
