// Status timeline — proportional segments across the selected period. Each
// segment exposes its state, start, end and duration on hover.
import { useRef, useState } from 'react'
import { FLEET_STATE } from '../data/assets'
import { fmtStamp } from '../data/time'
import { NUM } from '../calc/format'

const durText = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h}h ${m}m` : `${m}m` }

export function StatusTimeline({ segments, height = 26 }) {
  const total = segments.reduce((a, s) => a + s.durMin, 0) || 1
  const ref = useRef(); const [tip, setTip] = useState(null)
  const onMove = (e, s) => { const b = ref.current.getBoundingClientRect(); setTip({ x: e.clientX - b.left, s }) }
  return (
    <div>
      <div ref={ref} style={{ position: 'relative', display: 'flex', height, borderRadius: 6, overflow: 'hidden', background: 'var(--background-surface-subtle)' }} onMouseLeave={() => setTip(null)}>
        {segments.map((s, i) => (
          <div key={i} onMouseMove={(e) => onMove(e, s)} style={{ width: `${(s.durMin / total) * 100}%`, background: FLEET_STATE[s.state].color, cursor: 'crosshair' }} />
        ))}
        {tip && (
          <div style={{ position: 'absolute', left: tip.x, top: 0, transform: 'translate(-50%, -115%)', pointerEvents: 'none', zIndex: 20, background: 'var(--text-gray-primary)', color: 'var(--background-surface-intense)', fontSize: 'var(--global-fz-12)', fontWeight: 600, ...NUM, padding: '5px 9px', borderRadius: 6, whiteSpace: 'nowrap', boxShadow: 'var(--fds-shadow-md)' }}>
            <span style={{ color: FLEET_STATE[tip.s.state].color }}>●</span> {tip.s.state} · {fmtStamp(tip.s.start)}–{fmtStamp(tip.s.end)} · {durText(tip.s.durMin)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        {Object.keys(FLEET_STATE).map(k => (
          <span key={k} className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-gray-secondary)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: FLEET_STATE[k].color }} />{k}
          </span>
        ))}
      </div>
    </div>
  )
}
