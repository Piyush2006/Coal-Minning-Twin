import { useState } from 'react'
import { C, R, FONT } from '../ui/theme'

// A simple Bruce insight card that floats in a CORNER of a 3D view (never over the
// centred model). Collapsible to a small badge so it never blocks the scene.
// Presentational: pass a `title` (context) + `recs` ({ id, tone, title, recommendation|detail|summary }).

const CHECK = { critical: '#ff3b30', warn: '#ff8c1a', info: '#2bbf6a' }
const HEADER = 'linear-gradient(135deg, #a779f0 0%, #5b5bf0 100%)'

const Mark = ({ size = 28 }) => (
  <img src="/bruce-ai-logo.svg" alt="Bruce" width={size} height={size} style={{ borderRadius: size * 0.28, display: 'block', flexShrink: 0 }} />
)

export function BruceCard({ title, recs = [], offsetLeft = 16 }) {
  const [open, setOpen] = useState(false)   // collapsed to a small badge by default
  if (!recs.length) return null

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ position: 'absolute', top: 74, left: offsetLeft, zIndex: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 13px 6px 6px', borderRadius: R.pill, border: 'none', background: '#fff', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(40,40,90,0.16)', fontFamily: FONT }}>
        <Mark size={26} /><span style={{ fontSize: 13.5, fontWeight: 700, color: '#1d1d1f' }}>Bruce</span>
      </button>
    )
  }

  return (
    <div style={{ position: 'absolute', top: 74, left: offsetLeft, zIndex: 8, width: 300, maxWidth: 'calc(100% - 32px)', maxHeight: 'calc(100% - 88px)',
      display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: R.lg, overflow: 'hidden', fontFamily: FONT,
      boxShadow: '0 14px 40px rgba(40,40,90,0.20)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: HEADER, color: '#fff' }}>
        <Mark size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.1 }}>Bruce Insight</div>
          {title && <div style={{ fontSize: 11.5, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
        </div>
        <button onClick={() => setOpen(false)} title="Hide"
          style={{ width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>
      {/* actions */}
      <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3, margin: '0 0 8px' }}>Recommended actions</p>
        {recs.slice(0, 5).map(r => {
          const color = CHECK[r.tone] || CHECK.info
          const line = r.recommendation || r.detail || r.summary
          return (
            <div key={r.id} style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${color}1f`, color, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{r.title}</p>
                {line && <p style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.45, marginTop: 2 }}>{line}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
