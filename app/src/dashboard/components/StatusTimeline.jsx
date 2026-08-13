// Status timeline — a slim rounded band, proportional segments across the
// selected period. Hovering shows a dark tooltip (state · window · duration),
// rendered OUTSIDE the clipped band so it is actually visible.
import { useRef, useState } from 'react'
import { FLEET_STATE } from '../data/assets'
import { fmtStamp } from '../data/time'
import { NUM } from '../calc/format'

const durText = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h ${m}m` : `${m}m` }

export function StatusTimeline({ segments, height = 14 }) {
  const total = segments.reduce((a, s) => a + s.durMin, 0) || 1
  const ref = useRef()
  const [tip, setTip] = useState(null)
  const onMove = (e, s) => {
    const b = ref.current.getBoundingClientRect()
    const x = Math.max(40, Math.min(b.width - 40, e.clientX - b.left))
    setTip({ x, s })
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
      {/* tooltip layer — above the band, never clipped */}
      {tip && (
        <div style={{ position: 'absolute', left: tip.x, bottom: height + 10, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 20,
          background: '#0F1728', color: '#fff', fontSize: 11.5, fontWeight: 600, ...NUM, padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap',
          boxShadow: '0 6px 16px rgba(16,24,40,0.28)' }}>
          <span style={{ color: FLEET_STATE[tip.s.state].color }}>●</span>
          <span style={{ marginLeft: 6 }}>{tip.s.state}</span>
          <span style={{ marginLeft: 8, color: '#98A2B3', fontWeight: 500 }}>{fmtStamp(tip.s.start)} → {fmtStamp(tip.s.end)} · {durText(tip.s.durMin)}</span>
        </div>
      )}

      {/* the band */}
      <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', background: 'var(--background-surface-subtle)' }}>
        {segments.map((s, i) => (
          <div key={i} onMouseMove={(e) => onMove(e, s)}
            style={{ width: `${(s.durMin / total) * 100}%`, background: FLEET_STATE[s.state].color, opacity: tip && tip.s !== s ? 0.45 : 1, transition: 'opacity 120ms', cursor: 'default' }} />
        ))}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 9 }}>
        {Object.keys(FLEET_STATE).map(k => (
          <span key={k} className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-gray-tertiary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: FLEET_STATE[k].color }} />{k}
          </span>
        ))}
      </div>
    </div>
  )
}
