import { useUIStore } from '../store/uiStore'
import { C, glass, R, SHADOW } from '../ui/theme'

const MIN = 210, MAX = 560

// Floating, solid, rounded sidebar card overlaying the full-bleed viewport.
// Width-adjustable (drag inner edge) + collapsible (frees the whole viewport).
const TOP = 74, MARGIN = 12, GAP = 12
export function FloatingPanel({ side, children, leftBase = MARGIN }) {
  const width = useUIStore(s => (side === 'left' ? s.leftW : s.rightW))
  const collapsed = useUIStore(s => (side === 'left' ? s.leftCollapsed : s.rightCollapsed))
  const setWidth = useUIStore(s => s.setWidth)
  const toggle = useUIStore(s => s.toggleCollapsed)
  const inner = side === 'left' ? 'right' : 'left'   // edge facing the canvas

  if (collapsed) {
    return (
      <button onClick={() => toggle(side)} title="Expand panel"
        style={{ position: 'absolute', [side]: MARGIN, top: TOP, zIndex: 21,
          width: 30, height: 46, borderRadius: R.md, border: `1px solid ${C.line}`, background: C.surface,
          boxShadow: SHADOW.panel, cursor: 'pointer', color: C.text2, fontSize: 16, lineHeight: 1, padding: 0 }}>
        {side === 'left' ? '›' : '‹'}
      </button>
    )
  }

  const startDrag = (e) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = width
    const move = (ev) => {
      const dx = ev.clientX - x0
      const nw = side === 'left' ? w0 + dx : w0 - dx
      setWidth(side, Math.max(MIN, Math.min(MAX, Math.round(nw))))
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.body.style.cursor = 'col-resize'
  }

  // left panels can be pushed right (e.g. the inspector card sits next to the nav)
  const sideStyle = side === 'left' ? { left: leftBase } : { right: MARGIN }
  return (
    <>
      <div style={{ position: 'absolute', ...sideStyle, top: TOP, bottom: MARGIN, width, zIndex: 20,
        background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.panel,
        overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
        {/* resize handle along the inner edge */}
        <div onPointerDown={startDrag} title="Drag to resize"
          style={{ position: 'absolute', top: 0, [inner]: 0, width: 6, height: '100%', cursor: 'col-resize', zIndex: 6, background: 'transparent', transition: 'background 0.15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,132,255,0.28)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} />
      </div>
      {/* collapse tab — straddles the inner edge, outside the clipped card */}
      <button onClick={() => toggle(side)} title="Collapse panel"
        style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          [side]: (side === 'left' ? leftBase : MARGIN) + width - 11, zIndex: 21,
          width: 20, height: 42, borderRadius: 6, border: `1px solid ${C.line}`, background: C.surface,
          boxShadow: '0 2px 8px rgba(0,0,0,0.14)', cursor: 'pointer', color: C.text2, fontSize: 13, lineHeight: 1, padding: 0 }}>
        {side === 'left' ? '‹' : '›'}
      </button>
    </>
  )
}

// Wraps a sidebar panel to make it width-adjustable (drag the inner edge) and
// collapsible (chevron tab). The panel inside fills 100% width/height.
export function SidebarShell({ side, children }) {
  const width = useUIStore(s => (side === 'left' ? s.leftW : s.rightW))
  const collapsed = useUIStore(s => (side === 'left' ? s.leftCollapsed : s.rightCollapsed))
  const setWidth = useUIStore(s => s.setWidth)
  const toggle = useUIStore(s => s.toggleCollapsed)
  const inner = side === 'left' ? 'right' : 'left'   // the edge facing the canvas

  if (collapsed) {
    return (
      <div style={{ width: 18, height: '100%', flexShrink: 0, ...glass, display: 'grid', placeItems: 'center',
        [side === 'left' ? 'borderRight' : 'borderLeft']: `1px solid ${C.line}` }}>
        <button onClick={() => toggle(side)} title="Expand panel"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.text2, fontSize: 13, padding: 4 }}>
          {side === 'left' ? '›' : '‹'}
        </button>
      </div>
    )
  }

  const startDrag = (e) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = width
    const move = (ev) => {
      const dx = ev.clientX - x0
      const nw = side === 'left' ? w0 + dx : w0 - dx
      setWidth(side, Math.max(MIN, Math.min(MAX, Math.round(nw))))
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.body.style.cursor = 'col-resize'
  }

  return (
    <div style={{ position: 'relative', width, height: '100%', flexShrink: 0, display: 'flex' }}>
      {children}
      {/* resize handle along the inner edge */}
      <div onPointerDown={startDrag} title="Drag to resize"
        style={{ position: 'absolute', top: 0, [inner]: 0, width: 6, height: '100%', cursor: 'col-resize', zIndex: 6, background: 'transparent', transition: 'background 0.15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,132,255,0.28)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} />
      {/* collapse tab — straddles the panel's inner edge in the gutter so it
          never overlaps the panel content (e.g. parameter rows) */}
      <button onClick={() => toggle(side)} title="Collapse panel"
        style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [inner]: -9, zIndex: 7,
          width: 18, height: 40, borderRadius: 5, border: `1px solid ${C.line}`, background: C.surface,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)', cursor: 'pointer', color: C.text2, fontSize: 12, lineHeight: 1, padding: 0 }}>
        {side === 'left' ? '‹' : '›'}
      </button>
    </div>
  )
}
