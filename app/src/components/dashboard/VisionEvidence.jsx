// Vision-AI evidence — a reusable compact media card that opens a modal viewer
// (CCTV-panel styling: dark chrome, title, close/Esc). Videos autoplay muted +
// loop in the modal only; the grid card shows a static poster (no video load).
// The coal analysis renders as an image + stats + size-distribution widget.
import { useEffect } from 'react'
import { create } from 'zustand'
import { VISION, VISION_LABEL, visionCoalPSD } from '../../lib/visionConfig'
import { C, R, FONT } from '../../ui/theme'

export const useVision = create((set) => ({ open: null, show: (id) => set({ open: id }), close: () => set({ open: null }) }))

const mono = "'SF Mono', ui-monospace, Menlo, monospace"

// small discoverability chip for tiles with evidence
export function VisionChip() {
  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, color: '#7d5ce6', background: 'rgba(125,92,230,0.10)', border: '1px solid rgba(125,92,230,0.25)', borderRadius: R.pill, padding: '1px 7px' }}>Vision AI</span>
}

// compact 16:9 media card
export function VisionCard({ id }) {
  const item = VISION[id]
  const show = useVision(s => s.show)
  if (!item) return null
  return (
    <button onClick={() => show(id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: 0, border: `1px solid ${C.line}`, borderRadius: R.md, overflow: 'hidden', background: C.surface }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: item.kind === 'image' ? '#0d1016' : 'linear-gradient(135deg,#1b2430,#0d1016)' }}>
        {item.kind === 'image'
          ? <img src={item.src} alt={item.caption} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', display: 'grid', placeItems: 'center' }}>
                <span style={{ marginLeft: 3, borderLeft: '13px solid #fff', borderTop: '8px solid transparent', borderBottom: '8px solid transparent' }} />
              </span>
            </span>}
        <span style={{ position: 'absolute', top: 8, left: 8, fontFamily: mono, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3, color: '#fff', background: 'rgba(10,12,16,0.6)', borderRadius: R.pill, padding: '2px 7px' }}>{VISION_LABEL}</span>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <VisionChip />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.caption}</span>
      </div>
    </button>
  )
}

// coal size analysis widget — image + stats row + PSD bar chart
export function CoalSizeWidget({ compact = false }) {
  const show = useVision(s => s.show)
  const { stats, classes } = visionCoalPSD
  const peak = Math.max(1, ...classes.map(c => c.value))
  const cell = { fontSize: 15, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <VisionChip />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Coal Size Analysis — AI Vision</span>
        <span style={{ marginLeft: 'auto', fontSize: 9.5, color: C.text3 }}>{VISION_LABEL}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '200px 1fr', gap: 14, alignItems: 'start' }}>
        <button onClick={() => show('coal')} style={{ padding: 0, border: `1px solid ${C.line}`, borderRadius: R.md, overflow: 'hidden', cursor: 'pointer', background: '#0d1016' }}>
          <img src={VISION.coal.src} alt="Coal size analysis" loading="lazy" style={{ width: '100%', display: 'block', aspectRatio: '2 / 1', objectFit: 'cover' }} />
        </button>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            <Stat label="Particles analyzed" value={stats.particles.toLocaleString()} />
            <Stat label="Total area" value={stats.areaMm2.toLocaleString()} unit="mm²" />
            <Stat label="Est. volume" value={stats.volumeMm3.toLocaleString()} unit="mm³" />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: C.text3, marginBottom: 6 }}>Size distribution (mm)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 70 }}>
            {classes.map(c => (
              <div key={c.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{c.value}</span>
                <div style={{ width: '100%', height: (c.value / peak) * 44 + 4, background: C.accent, borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontSize: 9, color: C.text3 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
const Stat = ({ label, value, unit }) => (
  <div style={{ padding: '7px 9px', borderRadius: R.md, background: C.bg, border: `1px solid ${C.line}` }}>
    <div style={{ fontSize: 9.5, fontWeight: 600, color: C.text3 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{value}{unit ? <span style={{ fontSize: 9.5, fontWeight: 600, color: C.text3, marginLeft: 2 }}>{unit}</span> : null}</div>
  </div>
)

// modal viewer — CCTV-panel dark chrome
export function VisionModal() {
  const open = useVision(s => s.open)
  const close = useVision(s => s.close)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])
  if (!open) return null
  const item = VISION[open]
  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(8,10,14,0.72)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(900px, 92vw)', maxHeight: '88vh', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(20,26,32,0.9)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', background: '#0d1016', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'linear-gradient(rgba(8,10,14,0.9),rgba(8,10,14,0.65))', color: '#e8edf2' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#12B76A' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</span>
          <span style={{ fontFamily: mono, fontSize: 9.5, color: '#9fb0c0', marginLeft: 4 }}>{VISION_LABEL}</span>
          <button onClick={close} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e8edf2', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ background: '#000', display: 'grid', placeItems: 'center', minHeight: 0, flex: 1 }}>
          {item.kind === 'video'
            ? <video src={item.src} autoPlay muted loop controls playsInline style={{ maxWidth: '100%', maxHeight: '78vh', display: 'block' }} />
            : <img src={item.src} alt={item.title} style={{ maxWidth: '100%', maxHeight: '78vh', display: 'block' }} />}
        </div>
      </div>
    </div>
  )
}
