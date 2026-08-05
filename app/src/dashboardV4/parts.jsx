// Shared visual parts for the operations dashboard — the state timeline bar,
// its legend, and the rejection-rate chart. Hand-rolled SVG, dv3 tokens, and the
// dv3 status pattern fills (CVD-safe).
import { statusFill } from '../dashboardV3/patterns'
import { STATE, STATE_ORDER, SHIFT_MIN, fmt } from './mockData'

// horizontal state timeline (runs in minutes over a [from,to] window)
export function TimelineBar({ runs, height = 12, ticks = false, rounded = true, from = 0, to = SHIFT_MIN }) {
  const W = 1000, span = Math.max(1, to - from)
  const x = (m) => ((m - from) / span) * W
  const H = ticks ? height + 16 : height
  const tickVals = ticks ? Array.from({ length: 7 }, (_, i) => from + (span * i) / 6) : []
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block', borderRadius: rounded ? 5 : 0, overflow: 'hidden' }}>
      <rect x={0} y={0} width={W} height={height} fill="var(--surface-2)" />
      {runs.map((r, i) => (
        <rect key={i} x={x(r.start)} y={0} width={Math.max(0.5, x(r.end) - x(r.start))} height={height} fill={statusFill(STATE[r.state].patKey)} preserveAspectRatio="none" />
      ))}
      {tickVals.map((t, i) => (
        <text key={i} x={x(t)} y={height + 12} fontSize="11" fill="var(--text-tertiary)" textAnchor={i === 0 ? 'start' : i === 6 ? 'end' : 'middle'}>{fmt(t)}</text>
      ))}
    </svg>
  )
}

export function StateLegend({ totals }) {
  const denom = totals ? Math.max(1, STATE_ORDER.reduce((a, s) => a + totals[s], 0)) : SHIFT_MIN
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
      {STATE_ORDER.map(s => {
        const pct = totals ? Math.round((totals[s] / denom) * 100) : null
        return (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <svg width="20" height="13" style={{ borderRadius: 3, flexShrink: 0 }}><rect width="20" height="13" rx="3" fill={statusFill(STATE[s].patKey)} /></svg>
            {STATE[s].label}{pct != null && <b style={{ color: 'var(--text-primary)', marginLeft: 2 }}>{pct}%</b>}
          </span>
        )
      })}
    </div>
  )
}

// rejection-rate bars per 30-min bucket + a target line, over a [from,to] window
export function RejectChart({ series, target = 8, height = 150, from = 0, to = SHIFT_MIN }) {
  const W = 640, pad = 6
  if (!series.length) return <div className="dv3-support" style={{ padding: '20px 0' }}>No production in this window.</div>
  const max = Math.max(target * 1.4, ...series.map(s => s.rate)) * 1.1 || 1
  const bw = (W - pad * 2) / series.length
  const y = (v) => (height - 20) - (v / max) * (height - 30)
  const span = Math.max(1, to - from)
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: 'block' }}>
      {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="#EDF0F5" />)}
      {series.map((s, i) => {
        const over = s.rate > target
        const h = (height - 20) - y(s.rate)
        return <rect key={i} x={pad + i * bw + 1} y={y(s.rate)} width={Math.max(1, bw - 2)} height={Math.max(0, h)} rx={2} fill={over ? '#E5871F' : '#2B5CE7'} opacity={0.9} />
      })}
      <line x1={pad} x2={W - pad} y1={y(target)} y2={y(target)} stroke="#E04B4B" strokeWidth="1.3" strokeDasharray="5 4" />
      <text x={W - pad} y={y(target) - 3} textAnchor="end" fontSize="10" fill="#B42318">target {target}%</text>
      {Array.from({ length: 4 }, (_, i) => from + (span * i) / 3).map((t, i) => (
        <text key={i} x={pad + ((t - from) / span) * (W - pad * 2)} y={height - 4} fontSize="10" textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} fill="var(--text-tertiary)">{fmt(t)}</text>
      ))}
    </svg>
  )
}

export const StatusDot = ({ state, size = 9 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: STATE[state]?.color ?? '#DCE1E9', display: 'inline-block', flexShrink: 0 }} />
)
