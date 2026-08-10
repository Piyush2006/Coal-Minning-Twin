// Drilling-progress curve — cumulative Depth (m, increasing DOWNWARD) vs one or
// two x-axes. Custom responsive SVG so x is truly numeric (uneven spacing:
// steep = fast, flat = stalled) and depth reads top→down. Supports a dual-axis
// mode: Time on the bottom axis + Diesel on the top axis sharing the depth axis
// (each borehole = a solid time curve + a dashed diesel curve). Optional
// formation bands shade depth ranges behind the curve.
import { useRef, useState } from 'react'
import { fmt } from '../calc/format'

const VW = 640
const niceMax = (v) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
const ticks = (max, n = 5) => Array.from({ length: n + 1 }, (_, i) => (max / n) * i)

// series: [{ name, color, points:[{x,y}], axis=0, dash=false }]
// xAxes:  [{ label, position:'bottom'|'top' }]  (1 or 2)
export function DepthCurve({ series, xAxes, height = 340, bands = null }) {
  // legend toggle — clicking a name hides that borehole's line(s)
  const [hidden, setHidden] = useState(() => new Set())
  const toggle = (name) => setHidden(h => { const n = new Set(h); n.has(name) ? n.delete(name) : n.add(name); return n })
  const shown = series.filter(s => !hidden.has(s.name))

  // hover tooltip
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null)
  const onPoint = (s, p) => (e) => {
    const r = wrapRef.current?.getBoundingClientRect(); if (!r) return
    setHover({ name: s.name, color: s.color, depth: p.y, xVal: p.x, xLabel: xAxes[s.axis || 0].label, left: e.clientX - r.left, top: e.clientY - r.top })
  }

  const hasTop = xAxes.some(a => a.position === 'top')
  const PAD = { l: 46, r: 14, t: hasTop ? 34 : 10, b: 34 }
  const VH = height
  const plotW = VW - PAD.l - PAD.r
  const plotH = VH - PAD.t - PAD.b
  // axes scale to the VISIBLE series (rescale as lines are toggled off)
  const scaleSrc = shown.length ? shown : series
  const yMax = niceMax(Math.max(1, ...scaleSrc.flatMap(s => s.points.map(p => p.y))))
  const xMax = xAxes.map((_, ai) => niceMax(Math.max(1, ...scaleSrc.filter(s => (s.axis || 0) === ai).flatMap(s => s.points.map(p => p.x)))))
  const sx = (x, ai) => PAD.l + (x / xMax[ai]) * plotW
  const sy = (y) => PAD.t + (y / yMax) * plotH

  // dedupe legend by hole name
  const legend = []; const seen = new Set()
  for (const s of series) { if (!seen.has(s.name)) { seen.add(s.name); legend.push(s) } }

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
        {legend.map(s => {
          const off = hidden.has(s.name)
          return (
            <button key={s.name} onClick={() => toggle(s.name)} title={off ? 'Show' : 'Hide'} className="BodyXSmallRegular"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0, color: 'var(--text-gray-secondary)', opacity: off ? 0.4 : 1, textDecoration: off ? 'line-through' : 'none' }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />{s.name}
            </button>
          )
        })}
        {hasTop && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', marginLeft: 'auto' }}>—— {xAxes[0].label} · - - {xAxes[1].label}</span>}
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        {bands && bands.map((b, i) => (
          <rect key={i} x={PAD.l} y={sy(b.from)} width={plotW} height={sy(b.to) - sy(b.from)} fill={b.color} />
        ))}
        {/* depth grid + labels (shared y) */}
        {ticks(yMax).map((d, i) => (
          <g key={`y${i}`}>
            <line x1={PAD.l} y1={sy(d)} x2={PAD.l + plotW} y2={sy(d)} stroke="var(--border-gray-subtle)" strokeWidth="1" />
            <text x={PAD.l - 6} y={sy(d) + 3} textAnchor="end" style={{ fontSize: 10, fill: 'var(--text-gray-tertiary)' }}>{fmt(d, 0)}</text>
          </g>
        ))}
        {/* x-axes (bottom / top) */}
        {xAxes.map((ax, ai) => {
          const top = ax.position === 'top'
          const yTickLabel = top ? PAD.t - 6 : VH - PAD.b + 16
          const yTitle = top ? 12 : VH - 2
          return (
            <g key={`ax${ai}`}>
              {ticks(xMax[ai]).map((x, i) => (
                <g key={i}>
                  {!top && <line x1={sx(x, ai)} y1={PAD.t} x2={sx(x, ai)} y2={PAD.t + plotH} stroke="var(--border-gray-subtle)" strokeWidth={i === 0 ? 0 : 0.5} />}
                  <text x={sx(x, ai)} y={yTickLabel} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--text-gray-tertiary)' }}>{fmt(x, 0)}</text>
                </g>
              ))}
              <text x={PAD.l + plotW / 2} y={yTitle} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--text-gray-secondary)' }}>{ax.label}</text>
            </g>
          )
        })}
        <text transform={`translate(11 ${PAD.t + plotH / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--text-gray-secondary)' }}>Depth (m)</text>
        {/* curves (visible only) */}
        {shown.map((s, i) => (
          <polyline key={i} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={s.dash ? '6 4' : undefined}
            points={s.points.map(p => `${sx(p.x, s.axis || 0)},${sy(p.y)}`).join(' ')} />
        ))}
        {/* hover point markers (each formation boundary) */}
        {shown.map((s, si) => s.points.map((p, pi) => {
          const cx = sx(p.x, s.axis || 0), cy = sy(p.y)
          const active = hover && hover.name === s.name && hover.depth === p.y && hover.xVal === p.x
          return (
            <g key={`pt${si}-${pi}`}>
              <circle cx={cx} cy={cy} r={active ? 4.5 : 2.6} fill={s.color} />
              <circle cx={cx} cy={cy} r={10} fill="transparent" style={{ cursor: 'crosshair' }}
                onMouseMove={onPoint(s, p)} onMouseLeave={() => setHover(null)} />
            </g>
          )
        }))}
      </svg>
      {hover && (
        <div style={{ position: 'absolute', left: hover.left + 12, top: hover.top + 12, pointerEvents: 'none', zIndex: 5, background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-default)', borderRadius: 8, boxShadow: 'var(--fds-shadow-md)', padding: '7px 10px', whiteSpace: 'nowrap' }}>
          <div className="BodyXSmallSemibold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: hover.color }} />{hover.name}</div>
          <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-secondary)', marginTop: 2 }}>
            Depth {fmt(hover.depth, 1)} m · {hover.xLabel} {fmt(hover.xVal, /diesel/i.test(hover.xLabel) ? 0 : 1)}
          </div>
        </div>
      )}
    </div>
  )
}
