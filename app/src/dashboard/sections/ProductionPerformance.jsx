// Section 1 · Production Performance — Target → Actual → Gap → Cause.
// Answers "Are we achieving our production target, and if not, why?"
import { useMemo } from 'react'
import { ColumnChart } from '@faclon-labs/design-sdk/ColumnChart'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Button } from '@faclon-labs/design-sdk/Button'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { NUM, STATUS, fmt } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { fmtStamp } from '../data/time'
import { KpiStat } from '../components/KpiStat'
import { Panel, SegmentBar } from '../components/primitives'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

const CAUSE_COLOR = {
  'Equipment Downtime': 'var(--background-error-default)',
  'Low Throughput': 'var(--background-warning-default)',
  'Other Operational Loss': 'var(--text-gray-tertiary)',
}

export function ProductionPerformance() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const setTab = useDash(s => s.setTab)
  const setPlanOpen = useDash(s => s.setPlanOpen)
  const kp = useMemo(
    () => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings, plan],
  )
  const ctx = useMemo(
    () => buildBruceContext({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }),
    [range, mineId, areaId, equipTypeId, shiftMode, settings, plan],
  )

  const ach = kp.achievement
  const achSt = ach ? STATUS[ach.status] : null
  const gap = ach ? ach.planned - ach.actual : 0

  const t = kp.trend
  const series = shiftMode
    ? [{ name: t.shift1Name, data: t.shift1, color: 'var(--background-info-default)' },
       { name: t.shift2Name, data: t.shift2, color: 'var(--background-positive-default)' }]
    : [{ name: 'Actual', data: t.actual, color: 'var(--background-info-default)' },
       { name: 'Planned', data: t.planned, color: 'var(--text-gray-tertiary)' }]
  const planPerDay = ach ? Math.round(ach.planned / Math.max(1, kp.days)) : null
  const hcOpts = shiftMode && planPerDay
    ? { yAxis: { plotLines: [{ value: planPerDay, color: 'var(--text-gray-secondary)', width: 1.5, dashStyle: 'Dash', zIndex: 5, label: { text: `Plan/day ${fmt(planPerDay)} T`, style: { color: 'var(--text-gray-secondary)', fontSize: '11px' } } }] } }
    : undefined

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Hero — Plan vs Actual / Achievement, with the gap broken down by cause.
          When no plan covers the range, an empty state prompts to set one up. */}
      {!ach ? (
        <PlanEmptyState onOpen={() => setPlanOpen(true)} coveredNote={kp.plan} />
      ) : (
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
      )}

      {/* Bruce Insight — the cause of the shortfall, in one line. Numbers on demand. */}
      {ach && kp.loss.total > 0 && (
        <BruceInsight
          context={ctx}
          tone={ach.status}
          task="Explain in 15-20 words what specifically caused the production shortfall versus plan — name the reason, the culprit unit(s) and fault if any — and the practical takeaway."
          detail="Explain in detail what caused the production shortfall this period, the main contributing factors, and how to recover it.">
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
        </BruceInsight>
      )}

      {/* Secondary KPIs — each its own bordered tile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <KpiStat label="Throughput" value={kp.throughput.actual} unit="T/hr" kpi={kp.throughput} />
        <KpiStat label="Coal Yield / Recovery" value={kp.yield.actual} unit="%" dp={1} kpi={kp.yield} />
        <KpiStat label="Operating Cost / Ton" value={kp.cost.actual} unit={`${CURRENCY}/T`} kpi={kp.cost} onClick={() => setTab('efficiency')} />
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

// Shown in place of Plan-vs-Actual when no operational plan covers the range.
const PlanEmptyState = ({ onOpen, coveredNote }) => (
  <Panel style={{ display: 'grid', gap: 12, justifyItems: 'start', padding: 28 }}>
    <Badge color="Warning" emphasis="Subtle" size="Small">No plan for this range</Badge>
    <span className="HeadingMediumSemibold">Add an operational plan to see Plan vs Actual</span>
    <span className="BodyMediumRegular" style={{ color: 'var(--text-gray-secondary)', maxWidth: 560 }}>
      Upload an Excel plan or enter one manually (monthly, daily or shift-wise). The selected date range then
      aggregates the planned coal automatically, and targets, gap and loss-by-cause populate here.
      {coveredNote?.hasPlan === false && coveredNote?.level ? ' A plan exists but doesn’t cover the selected dates — adjust the range or extend the plan.' : ''}
    </span>
    <Button variant="Primary" size="Medium" onClick={onOpen}>🗓 Open Plan Management</Button>
  </Panel>
)

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
