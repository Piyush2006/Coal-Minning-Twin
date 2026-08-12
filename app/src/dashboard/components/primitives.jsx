// Small shared UI building blocks — all on design-sdk tokens/typography. Kept
// deliberately minimal (soft surface, no heavy borders) per the design brief.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DropdownMenu } from '@faclon-labs/design-sdk/DropdownMenu'
import { ActionListItem } from '@faclon-labs/design-sdk/ActionListItem'
import { NUM } from '../calc/format'

export function useOutside(ref, cb) {
  const saved = useRef(cb); saved.current = cb
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) saved.current() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref])
}

// single-select (options: [{id,name}]). The menu renders through a body portal
// so it sits above everything, and the outside-click check covers both the
// trigger AND the portaled menu — so choosing an option actually registers.
export function Dropdown({ label, value, options, onChange, disabled = false, width = 200 }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const cur = options.find(o => o.id === value)

  useLayoutEffect(() => {
    if (!open) return
    const update = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width }) }
    update()
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return; setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div style={{ display: 'grid', gap: 6, width }}>
      {label && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>}
      <button ref={btnRef} disabled={disabled} onClick={() => { if (!disabled) setOpen(o => !o) }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', cursor: disabled ? 'default' : 'pointer', font: 'inherit', width: '100%' }}>
        <span className="BodySmallRegular" style={{ color: 'var(--text-gray-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{cur?.name ?? '—'}</span>
        <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={popRef} className="dash-theme" style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 10500 }}>
          <DropdownMenu>
            {options.map(o => (
              <ActionListItem key={o.id} title={o.name} isSelected={o.id === value}
                onClick={() => { onChange(o.id); setOpen(false) }} />
            ))}
          </DropdownMenu>
        </div>,
        document.body,
      )}
    </div>
  )
}

// centered modal — portal + overlay, Esc / overlay-click / X to dismiss. Header
// shows a title + optional subtitle; body scrolls (wide tables scroll inside it).
export function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = 1040 }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])
  if (!isOpen) return null
  return createPortal(
    <div onMouseDown={onClose} className="dash-theme" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--background-overlay-default, rgba(16,24,40,0.55))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--background-surface-intense)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border-gray-subtle)' }}>
          <div style={{ display: 'grid', gap: 2, flex: 1 }}>
            <span className="HeadingSmallSemibold">{title}</span>
            {subtitle && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{subtitle}</span>}
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--text-gray-tertiary)', padding: 2 }}>×</button>
        </div>
        <div style={{ overflow: 'auto', padding: 20 }}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// multi-select (options: [{id,name}]). Portaled panel with a checklist; button
// shows a count. Same dual-ref outside-click handling as Dropdown.
export function MultiSelect({ label, values = [], options, onToggle, width = 230 }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const set = new Set(values)
  const text = set.size === 0 ? 'None selected' : set.size === options.length ? `All ${options.length}` : `${set.size} selected`

  useLayoutEffect(() => {
    if (!open) return
    const update = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width }) }
    update()
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return; setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div style={{ display: 'grid', gap: 6, width }}>
      {label && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>}
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', cursor: 'pointer', font: 'inherit', width: '100%' }}>
        <span className="BodySmallRegular" style={{ color: 'var(--text-gray-primary)', flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
        <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={popRef} className="dash-theme" style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: 300, overflowY: 'auto', zIndex: 10500, background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-default)', borderRadius: 10, boxShadow: 'var(--fds-shadow-md)', padding: 4 }}>
          {options.map(o => {
            const on = set.has(o.id)
            return (
              <button key={o.id} onClick={() => onToggle(o.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${on ? 'var(--background-brand-default)' : 'var(--border-gray-default)'}`, background: on ? 'var(--background-brand-default)' : 'transparent', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11 }}>{on ? '✓' : ''}</span>
                <span className="BodySmallRegular" style={{ color: 'var(--text-gray-primary)' }}>{o.name}</span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

// plain content surface — v2: borderless, floating on the canvas via shadow
export function Panel({ children, style, pad = 20 }) {
  return (
    <div style={{ background: 'var(--background-surface-intense)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-sm)', padding: pad, ...style }}>
      {children}
    </div>
  )
}

// KPI tile — same borderless card language
export function KpiTile({ children, style }) {
  return (
    <div style={{ background: 'var(--background-surface-intense)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-sm)', padding: 18, display: 'grid', gap: 6, alignContent: 'start', ...style }}>
      {children}
    </div>
  )
}

export function SectionHeading({ n, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      {n != null && <span className="BodySmallSemibold" style={{ color: 'var(--text-brand-default)', ...NUM }}>{String(n).padStart(2, '0')}</span>}
      <h2 className="HeadingMediumSemibold" style={{ margin: 0 }}>{title}</h2>
    </div>
  )
}

// horizontal segmented breakdown bar (part-to-whole), tokenised — no chart lib
export function SegmentBar({ segments, height = 12 }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  return (
    <span style={{ display: 'flex', height, borderRadius: 6, overflow: 'hidden', background: 'var(--background-surface-subtle)' }}>
      {segments.map((s, i) => s.value > 0 && (
        <span key={i} title={`${s.label}: ${Math.round(s.value)}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
      ))}
    </span>
  )
}
