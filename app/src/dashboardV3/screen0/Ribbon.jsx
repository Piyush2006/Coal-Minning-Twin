// Constraint ribbon (§7.2) — the shift as a horizontal timeline segmented by
// which stage was binding. Legible with no legend: run labels are inline, the
// callout carries the plain-language reading. Hand-rolled SVG.
import { useMemo } from 'react'
import { STAGE_LABEL } from './derive'

const COLOR = { crush: '#E5871F', face: '#12A594', dispatch: '#7B5EA7', haul: '#5B6B7F', chp: '#2B5CE7', '·residual': '#C6CDD8', '·external': '#9AA4B4' }
const SHORT = { crush: 'CR-01', face: 'Face', dispatch: 'Dispatch', haul: 'Haul', chp: 'CHP', '·residual': '', '·external': 'Blast' }

export function Ribbon({ derived, m, width = 420, height = 20 }) {
  const runs = useMemo(() => {
    const out = []
    for (let i = 0; i < derived.N; i++) {
      const r = derived.rootAtMin[i]
      const last = out[out.length - 1]
      if (last && last.r === r) last.len++
      else out.push({ r, start: i, len: 1 })
    }
    return out
  }, [derived])

  const px = width / derived.N
  return (
    <svg width={width} height={height + 16} style={{ display: 'block', maxWidth: '100%' }}>
      <rect x={0} y={0} width={width} height={height} rx={5} fill="var(--surface-2)" />
      {runs.map((run, i) => {
        if (run.start >= m) return null
        const w = (Math.min(run.start + run.len, m) - run.start) * px
        if (!run.r) return null
        return (
          <g key={i}>
            <rect x={run.start * px} y={0} width={Math.max(1, w)} height={height} fill={COLOR[run.r] ?? '#C6CDD8'} rx={2} />
            {run.len * px > 34 && SHORT[run.r] && (
              <text x={run.start * px + w / 2} y={height / 2 + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{SHORT[run.r]}</text>
            )}
          </g>
        )
      })}
      {/* scrub cursor + hour ticks */}
      <line x1={m * px} y1={-2} x2={m * px} y2={height + 2} stroke="var(--text-primary)" strokeWidth="1.5" />
      {[0, 60, 120, 180, 240, 300, 360, 420, 480].map(t => (
        <text key={t} x={t * px} y={height + 13} textAnchor={t === 0 ? 'start' : t === 480 ? 'end' : 'middle'} fontSize="9.5" fill="var(--text-tertiary)">
          {derived.fmt(t)}
        </text>
      ))}
    </svg>
  )
}

export function ConstraintShares({ derived, m }) {
  const { list } = derived.constraintShares(m)
  if (!list.length) return <div className="dv3-support">No binding constraint yet — chain on pace.</div>
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
      {list.slice(0, 3).map(({ root, mins, share }) => (
        <div key={root} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 68px', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{STAGE_LABEL[root] ?? root}</span>
          <div className="dv3-well" style={{ height: 10, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, share * 100)}%`, height: '100%', background: COLOR[root] ?? '#C6CDD8', borderRadius: 4 }} />
          </div>
          <span className="dv3-mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{mins} min · {Math.round(share * 100)}%</span>
        </div>
      ))}
    </div>
  )
}
