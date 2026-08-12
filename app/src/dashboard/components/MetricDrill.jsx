// The ONE drill-down language for KPI cards: a modal with (1) summary wells,
// (2) a compact per-day column chart vs the dashed target, (3) a clean
// scrollable day table. Every KPI drill on the dashboard uses this shape so
// the interaction always feels the same.
import { Modal } from './primitives'
import { Chart, dashedTarget } from './Chart'
import { Pill, th, td, usePagination, Pager } from './ui'
import { NUM, fmt } from '../calc/format'

const Well = ({ label, value, sub, color }) => (
  <div style={{ display: 'grid', gap: 3, padding: '12px 14px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', minWidth: 0 }}>
    <span className="eyebrow">{label}</span>
    <span className="BodyLargeSemibold" style={{ color: color || 'var(--text-gray-primary)', ...NUM }}>{value}</span>
    {sub && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{sub}</span>}
  </div>
)

// Generic per-day metric drill. `values` pairs with `categories`; `target` is
// optional; `goodIfHigh` orients best/worst day and delta colouring.
export function MetricDrillModal({ isOpen, onClose, title, subtitle, unit = '', dp = 0, categories = [], values = [], target = null, goodIfHigh = true, color = '#3E6DF4', extraWells = null }) {
  const pg = usePagination(categories.map((c, i) => ({ c, i })), { resetKey: `${title}|${isOpen}` })
  if (!isOpen) return null
  const n = values.length || 1
  const avg = values.reduce((a, b) => a + b, 0) / n
  let bestI = 0, worstI = 0
  values.forEach((v, i) => {
    if (goodIfHigh ? v > values[bestI] : v < values[bestI]) bestI = i
    if (goodIfHigh ? v < values[worstI] : v > values[worstI]) worstI = i
  })
  const deltaPct = (v) => target ? ((v - target) / target) * 100 : null
  const deltaTone = (v) => {
    const d = deltaPct(v)
    if (d == null || Math.abs(d) <= 3) return 'neutral'
    return (d > 0) === goodIfHigh ? 'positive' : 'critical'
  }

  return (
    <Modal isOpen onClose={onClose} title={title} subtitle={subtitle} maxWidth={720}>
      <div style={{ display: 'grid', gap: 16 }}>
        {/* summary wells */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${target != null ? 4 : 3}, 1fr)`, gap: 10 }}>
          <Well label="Average" value={`${fmt(avg, dp)}${unit ? ` ${unit}` : ''}`} />
          <Well label="Best day" value={`${fmt(values[bestI], dp)}${unit ? ` ${unit}` : ''}`} sub={categories[bestI]} color="var(--text-positive-default)" />
          <Well label="Worst day" value={`${fmt(values[worstI], dp)}${unit ? ` ${unit}` : ''}`} sub={categories[worstI]} color="var(--text-error-default)" />
          {target != null && <Well label="Target" value={`${fmt(target, dp)}${unit ? ` ${unit}` : ''}`} />}
        </div>

        {/* optional second wells row (e.g. per-shift split) */}
        {extraWells && extraWells.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${extraWells.length}, 1fr)`, gap: 10 }}>
            {extraWells.map((w, i) => <Well key={i} label={w.label} value={w.value} sub={w.sub} color={w.color} />)}
          </div>
        )}

        {/* per-day chart — spline so day-to-day movement stays readable */}
        <Chart height={200} options={{
          chart: { type: 'spline' },
          xAxis: { categories },
          yAxis: { title: { text: null }, labels: { format: `{value}` }, plotLines: target != null ? [dashedTarget(target, `Target ${fmt(target, dp)}`, 'right')] : [] },
          legend: { enabled: false },
          tooltip: { valueSuffix: unit ? ` ${unit}` : '' },
          plotOptions: { spline: { marker: { enabled: categories.length <= 31, radius: 3 } } },
          series: [{ name: title, data: values, color }],
        }} />

        {/* day table */}
        <div style={{ borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-subtle)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr><th style={th()}>Day</th><th style={th('right')}>{title}</th>{target != null && <th style={th('right')}>vs target</th>}</tr>
              </thead>
              <tbody>
                {pg.pageItems.map(({ c, i }) => (
                  <tr key={c}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    style={{ transition: 'background 120ms' }}>
                    <td style={td()} className="BodySmallRegular">{c}</td>
                    <td style={{ ...td('right'), ...NUM }} className="BodySmallSemibold">{fmt(values[i], dp)}{unit ? ` ${unit}` : ''}</td>
                    {target != null && (
                      <td style={{ ...td('right') }}>
                        <Pill tone={deltaTone(values[i])}>{deltaPct(values[i]) >= 0 ? '▲' : '▾'} {fmt(Math.abs(deltaPct(values[i])), 1)}%</Pill>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager {...pg} />
        </div>
      </div>
    </Modal>
  )
}

// Plan vs Actual by day — the hero's drill. Same language, plan-specific columns.
export function PlanDrillModal({ isOpen, onClose, subtitle, categories = [], planned = [], actual = [] }) {
  const rows = categories.map((c, i) => {
    const p = planned[i], a = actual[i]
    const pct = p ? (a / p) * 100 : null
    return { c, p, a, gap: p != null ? p - a : null, pct }
  })
  const pg = usePagination(rows, { resetKey: `${subtitle}|${isOpen}` })
  if (!isOpen) return null
  const totP = rows.reduce((s, r) => s + (r.p || 0), 0)
  const totA = rows.reduce((s, r) => s + (r.a || 0), 0)
  const achTone = (pct) => pct == null ? 'neutral' : pct >= 95 ? 'positive' : pct >= 85 ? 'warning' : 'critical'

  return (
    <Modal isOpen onClose={onClose} title="Plan vs Actual — day by day" subtitle={subtitle} maxWidth={760}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Well label="Planned" value={`${fmt(totP)} T`} />
          <Well label="Actual" value={`${fmt(totA)} T`} />
          <Well label="Gap" value={`${totP - totA > 0 ? '-' : '+'}${fmt(Math.abs(totP - totA))} T`} color={totP - totA > 0 ? 'var(--text-error-default)' : 'var(--text-positive-default)'} />
          <Well label="Achievement" value={totP ? `${fmt((totA / totP) * 100, 1)}%` : '—'} />
        </div>

        <div style={{ borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-subtle)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr><th style={th()}>Day</th><th style={th('right')}>Planned</th><th style={th('right')}>Actual</th><th style={th('right')}>Gap</th><th style={th('right')}>Achievement</th></tr>
              </thead>
              <tbody>
                {pg.pageItems.map(r => (
                  <tr key={r.c}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    style={{ transition: 'background 120ms' }}>
                    <td style={td()} className="BodySmallRegular">{r.c}</td>
                    <td style={{ ...td('right'), ...NUM }} className="BodySmallRegular">{r.p != null ? `${fmt(r.p)} T` : '—'}</td>
                    <td style={{ ...td('right'), ...NUM }} className="BodySmallSemibold">{fmt(r.a)} T</td>
                    <td style={{ ...td('right'), ...NUM, color: r.gap > 0 ? 'var(--text-error-default)' : 'var(--text-positive-default)' }} className="BodySmallRegular">
                      {r.gap != null ? `${r.gap > 0 ? '-' : '+'}${fmt(Math.abs(r.gap))} T` : '—'}
                    </td>
                    <td style={{ ...td('right') }}>{r.pct != null ? <Pill tone={achTone(r.pct)}>{fmt(r.pct, 1)}%</Pill> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager {...pg} />
        </div>
      </div>
    </Modal>
  )
}
