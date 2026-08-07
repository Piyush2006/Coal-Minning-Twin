// Global control bar — one compact toolbar. Date range (presets + custom in a
// popover) and the shift toggle recompute all data; Mine/Area/Equipment scope
// the views where it makes sense. Popovers render through a body portal so they
// always sit above the page, regardless of the header's stacking context.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@faclon-labs/design-sdk/Button'
import { DatePicker } from '@faclon-labs/design-sdk/DatePicker'
import { DropdownMenu } from '@faclon-labs/design-sdk/DropdownMenu'
import { ActionListItem } from '@faclon-labs/design-sdk/ActionListItem'
import { useDash } from '../store'
import { MINES, AREAS, EQUIP_TYPES, sideOf } from '../data/taxonomy'
import { PRESETS, presetRange, fmtStamp } from '../data/time'
import { NUM } from '../calc/format'

// A popover portaled to <body>, anchored under a trigger element and pinned with
// position:fixed + a high z-index — immune to any ancestor stacking context.
function AnchoredPopover({ anchorRef, open, onClose, style, children }) {
  const popRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => { const r = anchorRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: r.left }) }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, anchorRef])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (anchorRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return; onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose, anchorRef])
  if (!open) return null
  return createPortal(
    <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, ...style }}>{children}</div>,
    document.body,
  )
}

// compact inline dropdown (label · value ▾)
function FilterSelect({ label, value, options, onChange, max = 168 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const cur = options.find(o => o.id === value)
  return (
    <>
      <button ref={ref} onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 10px', maxWidth: max, borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', cursor: 'pointer', font: 'inherit' }}>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
        <span className="BodySmallSemibold" style={{ color: 'var(--text-gray-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur?.name ?? '—'}</span>
        <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>▾</span>
      </button>
      <AnchoredPopover anchorRef={ref} open={open} onClose={() => setOpen(false)} style={{ minWidth: 200 }}>
        <DropdownMenu>
          {options.map(o => <ActionListItem key={o.id} title={o.name} isSelected={o.id === value} onClick={() => { onChange(o.id); setOpen(false) }} />)}
        </DropdownMenu>
      </AnchoredPopover>
    </>
  )
}

// date range: one control; popover holds presets + calendar
function DateRangeControl({ range, settings, onRange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const label = range.preset && range.preset !== 'Custom' ? range.preset : `${fmtStamp(range.start)} – ${fmtStamp(range.end)}`
  return (
    <>
      <button ref={ref} onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', cursor: 'pointer', font: 'inherit' }}>
        <span style={{ fontSize: 14 }}>🗓</span>
        <span className="BodySmallSemibold" style={{ color: 'var(--text-gray-primary)', ...NUM }}>{label}</span>
        <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>▾</span>
      </button>
      <AnchoredPopover anchorRef={ref} open={open} onClose={() => setOpen(false)}
        style={{ background: 'var(--background-surface-intense)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-lg)', border: '1px solid var(--border-gray-subtle)', padding: 12, display: 'grid', gap: 10, width: 300 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <Button key={p} size="XSmall" variant={range.preset === p ? 'Secondary' : 'Gray'} onClick={() => onRange(presetRange(p, settings))}>{p}</Button>
          ))}
        </div>
        <DatePicker mode="range" placeholder="Custom range"
          rangeValue={{ start: range.start, end: range.end }}
          onRangeChange={(r) => r && onRange({ start: r.start, end: r.end, preset: 'Custom' })} />
      </AnchoredPopover>
    </>
  )
}

export function GlobalControls({ onOpenPlan }) {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan, setRange, setFilter, setShiftMode } = useDash()
  const side = sideOf(mineId)
  const areaOpts = AREAS.filter(a => a.side === 'both' || side === 'both' || a.side === side)
  const equipOpts = EQUIP_TYPES.filter(e => e.side === 'both' || side === 'both' || e.side === side)

  const onMine = (id) => {
    setFilter('mineId', id)
    const s = sideOf(id)
    const okArea = AREAS.find(a => a.id === areaId)
    const okEquip = EQUIP_TYPES.find(e => e.id === equipTypeId)
    if (okArea && okArea.side !== 'both' && s !== 'both' && okArea.side !== s) setFilter('areaId', 'all')
    if (okEquip && okEquip.side !== 'both' && s !== 'both' && okEquip.side !== s) setFilter('equipTypeId', 'all')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, rowGap: 10, padding: '10px 20px', background: 'var(--background-surface-intense)', flexWrap: 'wrap' }}>
      <DateRangeControl range={range} settings={settings} onRange={setRange} />
      <FilterSelect label="Mine" value={mineId} options={MINES} onChange={onMine} />
      <FilterSelect label="Area" value={areaId} options={areaOpts} onChange={(v) => setFilter('areaId', v)} />
      <FilterSelect label="Equip" value={equipTypeId} options={equipOpts} onChange={(v) => setFilter('equipTypeId', v)} />

      <button onClick={() => setShiftMode(!shiftMode)} role="switch" aria-checked={shiftMode} aria-label="Shift-wise breakdown"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-gray-default)', cursor: 'pointer', font: 'inherit', background: shiftMode ? 'var(--background-brand-secondary, var(--background-surface-subtle))' : 'var(--background-surface-intense)' }}>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Shift-wise</span>
        <span style={{ width: 34, height: 20, borderRadius: 10, padding: 2, background: shiftMode ? 'var(--background-brand-default)' : 'var(--border-gray-default)', display: 'inline-flex', alignItems: 'center', transition: 'background 120ms' }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: shiftMode ? 'translateX(14px)' : 'translateX(0)', transition: 'transform 120ms', boxShadow: '0 1px 2px rgba(16,24,40,0.3)' }} />
        </span>
        <span className="BodyXSmallRegular" style={{ color: shiftMode ? 'var(--text-brand-default)' : 'var(--text-gray-tertiary)', fontWeight: 600 }}>{shiftMode ? 'On' : 'Off'}</span>
      </button>

      <span style={{ flex: 1, minWidth: 8 }} />
      <Button variant={plan ? 'Secondary' : 'Primary'} size="Small" onClick={onOpenPlan}>🗓 Plan{plan ? '' : ' — set up'}</Button>
    </div>
  )
}
