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
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}>
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

// plain content surface (used sparingly)
export function Panel({ children, style, pad = 20 }) {
  return (
    <div style={{ background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-xs)', padding: pad, ...style }}>
      {children}
    </div>
  )
}

// bordered KPI tile — gives each metric its own boundary so they don't visually merge
export function KpiTile({ children, style }) {
  return (
    <div style={{ background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-large)', padding: 16, display: 'grid', gap: 6, alignContent: 'start', ...style }}>
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
