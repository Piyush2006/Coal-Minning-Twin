// Reusable plain-SVG charts for the dashboard — same visual language as the
// Sparkline (accent line, soft fill), a little larger with min/max labels.
// No chart libraries. Data are plain number arrays from the history service.
import { C } from '../../ui/theme'
import { STATUS_COLOR } from '../../lib/kpiStatus'

const W = 320
const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Math.round(v * 10) / 10)

// Single trend line over `data` with min/max/last labels.
export function LineChart({ data = [], height = 96, stroke = C.accent, fill = 'rgba(10,132,255,0.10)', unit = '', label }) {
  const H = height
  if (!data || data.length < 2) return <ChartFrame H={H} label={label}><Empty H={H} /></ChartFrame>
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1
  const y = (v) => H - 16 - ((v - lo) / span) * (H - 26)
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <ChartFrame H={H} label={label}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={`0,${H - 16} ${pts} ${W},${H - 16}`} fill={fill} stroke="none" />
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <Axis lo={lo} hi={hi} last={data[data.length - 1]} unit={unit} />
    </ChartFrame>
  )
}

// Alerts-over-time: stacked warn (amber) + crit (red) columns.
export function AlertsChart({ warn = [], crit = [], height = 96, label }) {
  const H = height, n = Math.max(warn.length, crit.length)
  if (n < 2) return <ChartFrame H={H} label={label}><Empty H={H} /></ChartFrame>
  const peak = Math.max(1, ...warn.map((w, i) => (w || 0) + (crit[i] || 0)))
  const bw = W / n
  const y = (v) => (v / peak) * (H - 24)
  return (
    <ChartFrame H={H} label={label}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {Array.from({ length: n }).map((_, i) => {
          const c = crit[i] || 0, w = warn[i] || 0, hc = y(c), hw = y(w), x = i * bw
          return (
            <g key={i}>
              {w > 0 && <rect x={x} y={H - 16 - hw - hc} width={Math.max(0.6, bw - 0.4)} height={hw} fill={STATUS_COLOR.amber} opacity="0.9" />}
              {c > 0 && <rect x={x} y={H - 16 - hc} width={Math.max(0.6, bw - 0.4)} height={hc} fill={STATUS_COLOR.red} />}
            </g>
          )
        })}
        <line x1="0" y1={H - 16} x2={W} y2={H - 16} stroke={C.line} strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 9.5, color: C.text3, marginTop: 2 }}>
        <Legend color={STATUS_COLOR.amber} text="Warning" /><Legend color={STATUS_COLOR.red} text="Critical" />
        <span style={{ marginLeft: 'auto' }}>60 min</span>
      </div>
    </ChartFrame>
  )
}

// Horizontal bar comparison across zones — bars coloured by each zone's health.
export function CompareBars({ rows = [], unit = '' }) {
  const peak = Math.max(1, ...rows.map(r => r.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <button key={r.id} onClick={r.onClick} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 74px', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
          <span style={{ fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          <span style={{ height: 16, background: 'rgba(0,0,0,0.04)', borderRadius: 5, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(r.value / peak) * 100}%`, background: STATUS_COLOR[r.status] || C.accent, borderRadius: 5, transition: 'width 0.4s ease' }} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, textAlign: 'right' }}>{fmt(r.value)}<span style={{ fontSize: 9.5, fontWeight: 600, color: C.text3, marginLeft: 3 }}>{unit}</span></span>
        </button>
      ))}
    </div>
  )
}

// ── small internals ──
function ChartFrame({ H, label, children }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: C.surface, border: `1px solid ${C.line}` }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text3, marginBottom: 6 }}>{label}</div>}
      {children}
    </div>
  )
}
function Axis({ lo, hi, last, unit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: C.text3, marginTop: 2 }}>
      <span>min {fmt(lo)}</span>
      <span style={{ color: C.text2, fontWeight: 600 }}>now {fmt(last)}{unit ? ` ${unit}` : ''}</span>
      <span>max {fmt(hi)}</span>
    </div>
  )
}
const Empty = ({ H }) => <div style={{ height: H - 16, display: 'grid', placeItems: 'center', fontSize: 11, color: C.text3 }}>collecting…</div>
const Legend = ({ color, text }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{text}</span>
