// Shared dashboard charts — one calm visual style: a single accent line over a
// soft area, an optional shaded target band, always labelled with units and
// min/now/max. Plain SVG, no libraries. Data are number arrays from the model.
import { C } from '../../ui/theme'
import { STATUS_COLOR } from '../../lib/kpiStatus'

const W = 320
const ACCENT = C.accent
const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Math.round(v * 10) / 10)

// Trend line with optional target band [lo,hi] shaded behind it.
export function LineChart({ data = [], height = 92, unit = '', label, band = null, accent = ACCENT }) {
  const H = height
  if (!data || data.length < 2) return <Frame H={H} label={label}><Empty H={H} /></Frame>
  let lo = Math.min(...data), hi = Math.max(...data)
  if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]) }
  const span = hi - lo || 1
  const y = (v) => H - 16 - ((v - lo) / span) * (H - 26)
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <Frame H={H} label={label}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {band && <rect x="0" y={y(band[1])} width={W} height={Math.max(1, y(band[0]) - y(band[1]))} fill="rgba(52,199,89,0.10)" />}
        <polyline points={`0,${H - 16} ${pts} ${W},${H - 16}`} fill={`${accent}14`} stroke="none" />
        <polyline points={pts} fill="none" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <Axis lo={lo} hi={hi} last={data[data.length - 1]} unit={unit} />
    </Frame>
  )
}

// Production S-curve: actual cumulative vs linear plan, target band shaded.
export function SCurveChart({ actual = [], plan = [], height = 130, unit = 't', label }) {
  const H = height
  if (actual.length < 2) return <Frame H={H} label={label}><Empty H={H} /></Frame>
  const hi = Math.max(...plan, ...actual) || 1
  const y = (v) => H - 18 - (v / hi) * (H - 28)
  const px = (i, n) => (i / (n - 1)) * W
  const aPts = actual.map((v, i) => `${px(i, actual.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const pPts = plan.map((v, i) => `${px(i, plan.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <Frame H={H} label={label}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={`0,${H - 18} ${aPts} ${px(actual.length - 1, actual.length)},${H - 18}`} fill={`${ACCENT}16`} stroke="none" />
        <polyline points={pPts} fill="none" stroke={C.text3} strokeWidth="1.4" strokeDasharray="4 4" />
        <polyline points={aPts} fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 9.5, color: C.text3, marginTop: 3 }}>
        <Legend color={ACCENT} text="Actual" /><Legend color={C.text3} text="Plan" dash />
        <span style={{ marginLeft: 'auto', color: C.text2, fontWeight: 600 }}>{fmt(actual[actual.length - 1])} {unit}</span>
      </div>
    </Frame>
  )
}

// Alerts as SPARSE severity ticks on a 60-min timeline.
export function AlertsChart({ events = [], cap = 720, height = 92, label }) {
  const H = height
  return (
    <Frame H={H} label={label}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <line x1="0" y1={H - 16} x2={W} y2={H - 16} stroke={C.line} strokeWidth="1" />
        {events.map((e, k) => {
          const x = (e.i / (cap - 1)) * W
          const h = e.sev === 'crit' ? H - 26 : (H - 26) * 0.6
          return <line key={k} x1={x.toFixed(1)} y1={H - 16} x2={x.toFixed(1)} y2={(H - 16 - h).toFixed(1)}
            stroke={e.sev === 'crit' ? STATUS_COLOR.red : STATUS_COLOR.amber} strokeWidth="2" />
        })}
        {events.length === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="10" fill={C.text3}>no events</text>}
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 9.5, color: C.text3, marginTop: 2 }}>
        <Legend color={STATUS_COLOR.amber} text="Warning" tick /><Legend color={STATUS_COLOR.red} text="Critical" tick />
        <span style={{ marginLeft: 'auto' }}>60 min</span>
      </div>
    </Frame>
  )
}

// Cross-zone comparison bars, coloured by each zone's health, filling width.
export function CompareBars({ rows = [], unit = '' }) {
  const peak = Math.max(1, ...rows.map(r => r.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(r => (
        <button key={r.id} onClick={r.onClick} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 84px', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', padding: '3px 0', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
          <span style={{ fontSize: 12.5, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          <span style={{ height: 18, background: 'rgba(0,0,0,0.04)', borderRadius: 5, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(r.value / peak) * 100}%`, background: r.status === 'green' ? ACCENT : STATUS_COLOR[r.status], borderRadius: 5, transition: 'width 0.4s ease' }} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: r.status === 'green' ? C.text : STATUS_COLOR[r.status], textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.value)}<span style={{ fontSize: 9.5, fontWeight: 500, color: C.text3, marginLeft: 3 }}>{unit}</span></span>
        </button>
      ))}
    </div>
  )
}

function Frame({ H, label, children }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: C.surface, border: `1px solid ${C.line}` }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, color: C.text2, marginBottom: 6 }}>{label}</div>}
      {children}
    </div>
  )
}
function Axis({ lo, hi, last, unit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: C.text3, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
      <span>{fmt(lo)}</span>
      <span style={{ color: C.text2, fontWeight: 600 }}>{fmt(last)}{unit ? ` ${unit}` : ''}</span>
      <span>{fmt(hi)}</span>
    </div>
  )
}
const Empty = ({ H }) => <div style={{ height: H - 16, display: 'grid', placeItems: 'center', fontSize: 11, color: C.text3 }}>collecting…</div>
const Legend = ({ color, text, dash, tick }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: tick ? 3 : 10, height: tick ? 9 : (dash ? 0 : 2), borderTop: dash ? `2px dashed ${color}` : 'none', background: tick || !dash ? color : 'none', borderRadius: 1 }} />{text}
  </span>
)
