// Section 1 · Production Performance — Target → Actual → Gap → Cause.
// Answers "Are we achieving our production target, and if not, why?"
import { useMemo, useState } from 'react'
import { Chart, dashedTarget } from '../components/Chart'
import { Button } from '@faclon-labs/design-sdk/Button'
import { Eyebrow, Pill, toneOf, CARD } from '../components/ui'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { NUM, STATUS, fmt } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { fmtStamp } from '../data/time'
import { KpiStat } from '../components/KpiStat'
import { MetricDrillModal, PlanDrillModal } from '../components/MetricDrill'
import { Panel, SegmentBar, Modal } from '../components/primitives'
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
    ? [{ name: t.shift1Name, data: t.shift1, color: '#3E6DF4' },
       { name: t.shift2Name, data: t.shift2, color: '#0E9F6E' }]
    : [{ name: 'Actual', data: t.actual, color: '#3E6DF4' },
       { name: 'Planned', data: t.planned, color: '#DFE5F1' }]
  const planPerDay = ach ? Math.round(ach.planned / Math.max(1, kp.days)) : null
  // drill-down: click a day's bar → that day's breakdown
  const [dayIdx, setDayIdx] = useState(null)
  // drill-down: hero % → plan-vs-actual by day; KPI cards → daily detail
  const [drill, setDrill] = useState(null)   // 'plan' | 'throughput' | 'yield' | null
  const prodChart = {
    chart: { type: 'column', ...(t.categories.length > 31 ? { scrollablePlotArea: { minWidth: 900, scrollPositionX: 1 } } : {}) },
    xAxis: { categories: t.categories },
    yAxis: {
      labels: { format: '{value} T' },
      plotLines: shiftMode && planPerDay ? [dashedTarget(planPerDay, `Plan/day ${fmt(planPerDay)} T`)] : [],
    },
    legend: { enabled: true },
    tooltip: { shared: true, valueSuffix: ' T' },
    plotOptions: {
      column: { stacking: shiftMode ? 'normal' : undefined },
      series: { cursor: 'pointer', point: { events: { click: function () { setDayIdx(this.index ?? this.x) } } } },
    },
    series,
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Hero — Plan vs Actual / Achievement, with the gap broken down by cause.
          When no plan covers the range, an empty state prompts to set one up. */}
      {/* Fused hero — the number, the gap and the "why" in ONE card. */}
      {!ach ? (
        <PlanEmptyState onOpen={() => setPlanOpen(true)} coveredNote={kp.plan} />
      ) : (
        <div style={{ ...CARD, borderRadius: 20, boxShadow: 'var(--fds-shadow-sm)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(300px, 1.25fr)', gap: 28, alignItems: 'center', padding: '26px 28px' }}>
            <div role="button" tabIndex={0} title="See plan vs actual, day by day"
              onClick={() => setDrill('plan')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrill('plan') } }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              style={{ display: 'grid', gap: 10, cursor: 'pointer', margin: -10, padding: 10, borderRadius: 'var(--global-border-radius-medium)', transition: 'background 150ms' }}>
              <Eyebrow>Production Plan vs Actual · {fmtStamp(range.start)} – {fmtStamp(range.end)}</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span className="DisplayMediumSemibold" style={{ color: achSt.text, ...NUM, fontSize: 58, lineHeight: 1 }}>{fmt(ach.pct, 1)}%</span>
                <Pill tone={toneOf(ach.status)}>{achSt.label}</Pill>
                <span aria-hidden style={{ color: 'var(--text-brand-default)', fontSize: 15, lineHeight: 1 }}>→</span>
              </div>
              <span className="BodyMediumRegular" style={{ color: 'var(--text-gray-secondary)', ...NUM }}>{fmt(ach.actual)} T produced of {fmt(ach.planned)} T planned</span>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <StatBlock label="Expected" value={`${fmt(ach.planned)} T`} />
                <StatBlock label="Actual" value={`${fmt(ach.actual)} T`} color={achSt.text} />
                <StatBlock label="Gap" value={`${gap >= 0 ? '' : '+'}${fmt(-gap)} T`} color={gap > 0 ? 'var(--text-error-default)' : 'var(--text-positive-default)'} />
              </div>
              {shiftMode && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {kp.shifts.map(sh => (
                    <span key={sh.name} className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'var(--background-surface-subtle)', ...NUM }}>
                      {sh.name} <b>{fmt(sh.actual)} T</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* fused: the cause of the shortfall (Bruce line + loss-by-cause on demand) */}
          {kp.loss.total > 0 && (
            <div style={{ borderTop: '1px solid var(--border-gray-subtle)', background: 'rgba(124,92,240,0.04)', padding: '14px 24px' }}>
              <BruceInsight variant="bare" context={ctx} tone={ach.status}
                task="Explain in 15-20 words what specifically caused the production shortfall versus plan — name the reason, the culprit unit(s) and fault if any — and the practical takeaway."
                detail="Explain in detail what caused the production shortfall this period, the main contributing factors, and how to recover it.">
                <div style={{ display: 'grid', gap: 8 }}>
                  <SegmentBar segments={kp.loss.byCause.map(c => ({ label: c.cause, value: c.value, color: CAUSE_COLOR[c.cause] }))} height={12} />
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {kp.loss.byCause.map(c => {
                      const pct = kp.loss.total ? (c.value / kp.loss.total) * 100 : 0
                      return (
                        <span key={c.cause} className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-gray-secondary)' }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: CAUSE_COLOR[c.cause] }} />
                          {c.cause} <b style={{ color: 'var(--text-gray-primary)', ...NUM }}>{fmt(c.value)} T</b>
                          <span style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>· {fmt(pct)}%</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </BruceInsight>
            </div>
          )}
        </div>
      )}

      {shiftMode && (
        <Panel>
          <div style={{ marginBottom: 8 }}><span className="eyebrow">Shift breakdown</span></div>
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

      {/* Asymmetric row — the trend dominates (2/3), the KPI column supports (1/3) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', gap: 16, alignItems: 'stretch' }}>
        <Panel style={{ padding: 18, minWidth: 0 }}>
          <Chart title="Production vs Plan" sub={`${fmtStamp(range.start)} → ${fmtStamp(range.end)} · click a bar for the day's breakdown`}
            height={400} options={prodChart} />
        </Panel>
        <div style={{ display: 'grid', gap: 14, gridTemplateRows: '1fr 1fr 1fr' }}>
          <KpiStat label="Throughput" value={kp.throughput.actual} unit="T/hr" kpi={kp.throughput} onClick={() => setDrill('throughput')} />
          <KpiStat label="Coal Yield / Recovery" value={kp.yield.actual} unit="%" dp={1} kpi={kp.yield} sub="Saleable ÷ raw coal, this period" onClick={() => setDrill('yield')} />
          <KpiStat label="Operating Cost / Ton" value={kp.cost.actual} unit={`${CURRENCY}/T`} kpi={kp.cost} onClick={() => setTab('efficiency')} />
        </div>
      </div>

      {/* day drill-down — everything the dashboard knows about the clicked day */}
      <DayModal idx={dayIdx} t={t} onClose={() => setDayIdx(null)} shiftMode={shiftMode} />

      {/* KPI drill-downs — one shared language: wells · daily chart · day table */}
      <PlanDrillModal isOpen={drill === 'plan'} onClose={() => setDrill(null)}
        subtitle={`${fmtStamp(range.start)} → ${fmtStamp(range.end)}`}
        categories={t.categories} planned={t.planned} actual={t.actual} />
      <MetricDrillModal isOpen={drill === 'throughput'} onClose={() => setDrill(null)}
        title="Throughput" subtitle="Tonnes processed per operating hour, per day" unit="T/hr"
        categories={t.categories} values={t.throughput} target={kp.throughput.target ?? null} />
      <MetricDrillModal isOpen={drill === 'yield'} onClose={() => setDrill(null)}
        title="Coal Yield / Recovery" subtitle="Saleable ÷ raw coal, per day" unit="%" dp={1}
        categories={t.categories} values={t.yieldPct} color="#0E9F6E" />

    </div>
  )
}

// Per-day breakdown behind a bar click on Production vs Plan. Reads the same
// per-day trend series the chart renders — no new metrics.
function DayModal({ idx, t, onClose, shiftMode }) {
  if (idx == null || !t.categories[idx]) return null
  const planned = t.planned?.[idx]
  const actual = t.actual[idx]
  const gap = planned != null ? planned - actual : null
  const achPct = planned ? (actual / planned) * 100 : null
  const achSt = achPct != null ? STATUS[achPct >= 95 ? 'positive' : achPct >= 85 ? 'warning' : 'critical'] : null
  const rows = [
    { label: 'Planned', value: planned != null ? `${fmt(planned)} T` : '—' },
    { label: 'Actual', value: `${fmt(actual)} T`, color: achSt?.text },
    { label: 'Gap', value: gap != null ? `${gap > 0 ? '-' : '+'}${fmt(Math.abs(gap))} T` : '—', color: gap > 0 ? 'var(--text-error-default)' : 'var(--text-positive-default)' },
    { label: 'Throughput', value: `${fmt(t.throughput[idx])} T/hr` },
    { label: 'Yield', value: `${fmt(t.yieldPct[idx], 1)}%` },
    { label: 'Cost / Ton', value: `${CURRENCY}${fmt(t.costPerTon[idx])}` },
    { label: 'Energy / Ton', value: `${fmt(t.energyPerTon[idx], 2)} kWh/T` },
    { label: 'Fuel / Ton', value: `${fmt(t.fuelPerTon[idx], 3)} L/T` },
  ]
  return (
    <Modal isOpen onClose={onClose} title={`${t.categories[idx]} — day breakdown`}
      subtitle={achPct != null ? `${fmt(achPct, 1)}% of plan achieved` : 'No plan covers this day'} maxWidth={560}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'grid', gap: 4, padding: '12px 14px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{r.label}</span>
            <span className="BodyLargeSemibold" style={{ color: r.color || 'var(--text-gray-primary)', ...NUM }}>{r.value}</span>
          </div>
        ))}
      </div>
      {shiftMode && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Pill tone="info">{t.shift1Name} · {fmt(t.shift1[idx])} T</Pill>
          <Pill tone="positive">{t.shift2Name} · {fmt(t.shift2[idx])} T</Pill>
        </div>
      )}
    </Modal>
  )
}

// Shown in place of Plan-vs-Actual when no operational plan covers the range.
const PlanEmptyState = ({ onOpen, coveredNote }) => (
  <Panel style={{ display: 'grid', gap: 12, justifyItems: 'start', padding: 28 }}>
    <Pill tone="warning">No plan for this range</Pill>
    <span className="HeadingMediumSemibold">Add an operational plan to see Plan vs Actual</span>
    <span className="BodyMediumRegular" style={{ color: 'var(--text-gray-secondary)', maxWidth: 560 }}>
      Upload an Excel plan or enter one manually (monthly, daily or shift-wise). The selected date range then
      aggregates the planned coal automatically, and targets, gap and loss-by-cause populate here.
      {coveredNote?.hasPlan === false && coveredNote?.level ? ' A plan exists but doesn’t cover the selected dates — adjust the range or extend the plan.' : ''}
    </span>
    <Button variant="Primary" size="Medium" onClick={onOpen}>🗓 Open Plan Management</Button>
  </Panel>
)

// Well-tinted stat block used inside the fused hero (Expected / Actual / Gap).
const StatBlock = ({ label, value, color }) => (
  <div style={{ display: 'grid', gap: 3, padding: '10px 12px', borderRadius: 12, background: 'var(--background-surface-subtle)' }}>
    <span className="eyebrow">{label}</span>
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
