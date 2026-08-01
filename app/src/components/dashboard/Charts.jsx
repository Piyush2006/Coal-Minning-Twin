// Dashboard charts — accent-only, titled, axis-labelled, per the design spec.
// A ChartCard wraps every chart: CardTitle top-left, current value KPI-M
// top-right, then the SVG with three #F2F4F7 gridlines and 12px axis labels.
import { useState, useEffect } from 'react'
import { T, ty, fmt, Unit, SHADOW_CARD, NumberFlow, REDUCED_MOTION } from './tokens'

const W = 320

// health donut — shared by the asset rail (28px) and the inspector (64px)
export const BAND_COLOR = { red: T.bad, amber: T.warn, green: T.good }
export function HealthRing({ health, band, halo, size = 28, fontSize = 9 }) {
  const sw = size >= 48 ? 5 : 3
  const R = (size - sw) / 2, C = 2 * Math.PI * R
  const [on, setOn] = useState(REDUCED_MOTION)
  useEffect(() => { if (!REDUCED_MOTION) { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id) } }, [])
  return (
    <span className={halo ? 'ring-halo' : undefined} style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#EAECF0" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={BAND_COLOR[band]} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={C.toFixed(2)} strokeDashoffset={(C * (1 - (on ? health / 100 : 0))).toFixed(2)}
          style={{ transition: REDUCED_MOTION ? 'none' : 'stroke-dashoffset 600ms ease-out, stroke 300ms ease' }} />
      </svg>
      <span style={{ fontSize, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: T.ink }}><NumberFlow value={health} format={(v) => String(Math.round(v))} /></span>
    </span>
  )
}

export function ChartCard({ title, value, unit, height = '100%', children }) {
  return (
    <div className="panel-in" style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radius, boxShadow: SHADOW_CARD, padding: 20, height, minHeight: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={ty.cardTitle}>{title}</span>
        {value != null && <span style={{ ...ty.kpiM, marginLeft: 'auto' }}>{value}{unit ? <Unit>{unit}</Unit> : null}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  )
}

// accent line + soft area, optional 8% target band (dashed edges), 3 gridlines
export function TrendChart({ data = [], band = null, xLabels = ['60m', '30m', 'now'] }) {
  if (!data || data.length < 2) return <Empty />
  let lo = Math.min(...data), hi = Math.max(...data)
  if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]) }
  const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad
  const H = 100, span = hi - lo || 1
  const y = (v) => H - ((v - lo) / span) * H
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const gl = [0.25, 0.5, 0.75].map(f => H * f)
  return (
    <>
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {gl.map((gy, i) => <line key={i} x1="0" y1={gy} x2={W} y2={gy} stroke={T.grid} strokeWidth="1" />)}
          {band && <g>
            <rect x="0" y={y(band[1])} width={W} height={Math.max(1, y(band[0]) - y(band[1]))} fill="rgba(18,183,106,0.08)" />
            <line x1="0" y1={y(band[1])} x2={W} y2={y(band[1])} stroke={T.good} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <line x1="0" y1={y(band[0])} x2={W} y2={y(band[0])} stroke={T.good} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          </g>}
          <polyline points={`0,${H} ${pts} ${W},${H}`} fill={T.accentSoft} stroke="none" />
          <polyline points={pts} fill="none" stroke={T.accent} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <Axis labels={xLabels} />
    </>
  )
}

// production S-curve: accent actual vs dashed plan; the actual-plan gap is
// shaded good-tint when ahead / bad-tint when behind; 3 labelled y gridlines.
export function SCurve({ actual = [], plan = [] }) {
  if (actual.length < 2 || plan.length < 2) return <Empty />
  const hi = Math.max(...plan, ...actual) || 1, H = 100
  const n = Math.min(actual.length, plan.length)
  const y = (v) => H - (v / hi) * H
  const x = (i) => (i / (n - 1)) * W
  const aPts = [], pPts = []
  for (let i = 0; i < n; i++) { aPts.push([x(i), y(actual[i])]); pPts.push([x(i), y(plan[i])]) }
  const P = (pts) => pts.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')
  const bands = []                                   // same-sign runs of the gap
  const sign = (i) => (actual[i] >= plan[i] ? 1 : -1)
  let s0 = 0
  for (let i = 1; i <= n; i++) {
    if (i === n || sign(i) !== sign(s0)) {
      const seg = []
      for (let k = s0; k < i; k++) seg.push(aPts[k])
      for (let k = i - 1; k >= s0; k--) seg.push(pPts[k])
      bands.push({ d: P(seg), good: sign(s0) > 0 })
      s0 = i
    }
  }
  const rawStep = hi / 4
  const pow = 10 ** Math.floor(Math.log10(rawStep))
  const stepV = [1, 2, 2.5, 5, 10].map(c => c * pow).find(c => hi / c <= 4) || 10 * pow
  const ticks = []
  for (let v = stepV; v < hi * 0.98; v += stepV) ticks.push(v)
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {ticks.map((v, i) => <line key={i} x1="0" y1={y(v)} x2={W} y2={y(v)} stroke={T.grid} strokeWidth="1" />)}
          {bands.map((b, i) => <polygon key={i} points={b.d} fill={b.good ? 'rgba(18,183,106,0.10)' : 'rgba(240,68,56,0.10)'} stroke="none" />)}
          <polyline points={P(pPts)} fill="none" stroke={T.ink2} strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <polyline points={P(aPts)} fill="none" stroke={T.accent} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {ticks.map((v, i) => (
          <span key={i} style={{ position: 'absolute', left: 0, top: `${(y(v) / H) * 100}%`, transform: 'translateY(-115%)', ...ty.label }}>{fmt(v)} t</span>
        ))}
      </div>
      <Axis labels={['start', 'shift', 'now']} legend />
    </>
  )
}

// sparse severity ticks on a 60-min axis (NOT bars/walls)
export function AlertTimeline({ events = [], cap = 720 }) {
  const H = 100
  return (
    <>
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={T.line} strokeWidth="1" />
          {events.map((e, k) => {
            const x = (e.i / (cap - 1)) * W, h = e.sev === 'crit' ? H * 0.8 : H * 0.45
            return <line key={k} x1={x.toFixed(1)} y1={H - 1} x2={x.toFixed(1)} y2={(H - 1 - h).toFixed(1)} stroke={e.sev === 'crit' ? T.bad : T.warn} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          })}
          {events.length === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="9" fill={T.ink2}>no events</text>}
        </svg>
      </div>
      <Axis labels={['60m', '30m', 'now']} />
    </>
  )
}

// tiny inline sparkline (flow-strip nodes, tiles) — accent, no axis
export function MiniSpark({ data = [], w = 40, h = 16, step = false }) {
  if (!data || data.length < 2) return <span style={{ display: 'inline-block', width: w, height: h }} />
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1
  const stride = Math.max(1, Math.ceil(data.length / 48))
  const src = data.filter((_, i) => i % stride === 0 || i === data.length - 1)
  const X = (i) => (i / (src.length - 1)) * w
  const Y = (v) => (h - 1 - ((v - lo) / span) * (h - 2))
  const pts = step
    ? src.map((v, i) => (i === 0 ? `${X(0)},${Y(v).toFixed(1)}` : `${X(i).toFixed(1)},${Y(src[i - 1]).toFixed(1)} ${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).join(' ')
    : src.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  return <svg width={w} height={h} style={{ display: 'block' }}><polyline className="spark-draw" pathLength="1" points={pts} fill="none" stroke={T.accent} strokeOpacity="0.9" strokeWidth="1.5" strokeLinejoin="round" /></svg>
}

// compare bars — accent, non-green zones use their status colour
export function CompareBars({ rows = [], unit = '' }) {
  const peak = Math.max(1, ...rows.map(r => r.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(r => (
        <button key={r.id} onClick={r.onClick} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 90px', alignItems: 'center', gap: 16, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
          <span style={{ ...ty.body, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          <span style={{ height: 20, background: '#F2F4F7', borderRadius: 6, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(r.value / peak) * 100}%`, background: r.status === 'green' ? T.accent : STATUSC(r.status), borderRadius: 6, transition: 'width 200ms ease' }} />
          </span>
          <span style={{ ...ty.kpiM, fontSize: 16, textAlign: 'right' }}>{fmt(r.value)}{unit ? <Unit>{unit}</Unit> : null}</span>
        </button>
      ))}
    </div>
  )
}
const STATUSC = (s) => (s === 'red' ? T.bad : s === 'amber' ? T.warn : T.good)

function Axis({ labels, legend }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, ...ty.label }}>
      {legend
        ? <><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: T.accent }} />Actual</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, borderTop: `2px dashed ${T.ink2}` }} />Plan</span></>
        : labels.map((l, i) => <span key={i}>{l}</span>)}
    </div>
  )
}
const Empty = () => <div style={{ flex: 1, display: 'grid', placeItems: 'center', ...ty.label }}>collecting…</div>
