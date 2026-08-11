// Global control bar — brand mark + segmented date presets + Mine/Area/Equipment
// pill dropdowns + shift toggle + Plan. Frosted, sticky. Popovers portal to body
// so they always sit above the page. Same filters/behaviour, restyled only.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DatePicker } from '@faclon-labs/design-sdk/DatePicker'
import { DropdownMenu } from '@faclon-labs/design-sdk/DropdownMenu'
import { ActionListItem } from '@faclon-labs/design-sdk/ActionListItem'
import { useDash } from '../store'
import { MINES, AREAS, EQUIP_TYPES, sideOf } from '../data/taxonomy'
import { PRESETS, presetRange } from '../data/time'

const INK = '#0F1728'
const SHORT = { 'Today': 'Today', 'This Shift': 'Shift', 'Yesterday': 'Yest', 'Last 7 Days': '7D', 'Last 30 Days': '30D', 'This Month': 'Month' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function planCoverage(plan) {
  const ps = plan.rows.map(r => r.period).filter(Boolean).sort()
  if (!ps.length) return 'active'
  const m = (s) => MONTHS[(+s.slice(5, 7) || 1) - 1]
  const a = m(ps[0]), b = m(ps[ps.length - 1])
  return `${a}${a !== b ? '–' + b : ''} active`
}

function AnchoredPopover({ anchorRef, open, onClose, style, children }) {
  const popRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => { const r = anchorRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, left: r.left }) }
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, anchorRef])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (anchorRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return; onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose, anchorRef])
  if (!open) return null
  return createPortal(<div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, ...style }}>{children}</div>, document.body)
}

// pill dropdown with the filter name as a muted prefix inside the pill
function FilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const cur = options.find(o => o.id === value)
  return (
    <>
      <button ref={ref} onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', maxWidth: 220, borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', boxShadow: 'var(--fds-shadow-xs)', cursor: 'pointer', font: 'inherit' }}>
        <span className="BodySmallSemibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: 'var(--text-gray-tertiary)' }}>{label} · </span>
          <span style={{ color: 'var(--text-gray-primary)' }}>{cur?.name ?? '—'}</span>
        </span>
        <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>▾</span>
      </button>
      <AnchoredPopover anchorRef={ref} open={open} onClose={() => setOpen(false)} style={{ minWidth: 210 }}>
        <DropdownMenu>
          {options.map(o => <ActionListItem key={o.id} title={o.name} isSelected={o.id === value} onClick={() => { onChange(o.id); setOpen(false) }} />)}
        </DropdownMenu>
      </AnchoredPopover>
    </>
  )
}

// segmented preset control (+ calendar icon → custom range popover)
function DateSegments({ range, settings, onRange }) {
  const [open, setOpen] = useState(false)
  const calRef = useRef(null)
  const custom = range.preset === 'Custom'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 999, background: 'var(--background-surface-subtle)', border: '1px solid var(--border-gray-subtle)' }}>
      {PRESETS.map(p => {
        const on = range.preset === p
        return (
          <button key={p} onClick={() => onRange(presetRange(p, settings))} className="BodyXSmallSemibold"
            style={{ padding: '5px 11px', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', background: on ? INK : 'transparent', color: on ? '#fff' : 'var(--text-gray-secondary)', transition: 'background 150ms, color 150ms' }}>
            {SHORT[p] || p}
          </button>
        )
      })}
      <button ref={calRef} onClick={() => setOpen(o => !o)} title="Custom range" aria-label="Custom range"
        style={{ display: 'inline-grid', placeItems: 'center', width: 28, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: custom ? INK : 'transparent', color: custom ? '#fff' : 'var(--text-gray-secondary)', fontSize: 13 }}>🗓</button>
      <AnchoredPopover anchorRef={calRef} open={open} onClose={() => setOpen(false)}
        style={{ background: 'var(--background-surface-intense)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-lg)', border: '1px solid var(--border-gray-subtle)', padding: 12, width: 300 }}>
        <DatePicker mode="range" placeholder="Custom range" rangeValue={{ start: range.start, end: range.end }}
          onRangeChange={(r) => { if (r) { onRange({ start: r.start, end: r.end, preset: 'Custom' }); setOpen(false) } }} />
      </AnchoredPopover>
    </div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, rowGap: 10, padding: '10px 28px', background: 'rgba(244,246,251,.86)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', flexWrap: 'wrap' }}>
      {/* brand mark */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginRight: 4 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: INK, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12.5, fontFamily: "'Space Grotesk', sans-serif" }}>BC</span>
        <div style={{ display: 'grid', lineHeight: 1.15 }}>
          <span className="BodySmallSemibold">Blackridge Coal</span>
          <span className="eyebrow" style={{ fontSize: 9.5 }}>OC MINE · CHPP</span>
        </div>
      </div>

      <DateSegments range={range} settings={settings} onRange={setRange} />
      <FilterSelect label="Mine" value={mineId} options={MINES} onChange={onMine} />
      <FilterSelect label="Area" value={areaId} options={areaOpts} onChange={(v) => setFilter('areaId', v)} />
      <FilterSelect label="Equipment" value={equipTypeId} options={equipOpts} onChange={(v) => setFilter('equipTypeId', v)} />

      <button onClick={() => setShiftMode(!shiftMode)} role="switch" aria-checked={shiftMode} aria-label="Shift-wise breakdown"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px', borderRadius: 999, border: `1px solid ${shiftMode ? 'transparent' : 'var(--border-gray-default)'}`, cursor: 'pointer', font: 'inherit', background: shiftMode ? 'var(--background-brand-secondary)' : 'var(--background-surface-intense)' }}>
        <span className="BodyXSmallRegular" style={{ color: shiftMode ? 'var(--text-brand-default)' : 'var(--text-gray-secondary)', fontWeight: 600 }}>Shift-wise</span>
        <span style={{ width: 32, height: 18, borderRadius: 999, padding: 2, background: shiftMode ? 'var(--background-brand-default)' : 'var(--border-gray-default)', display: 'inline-flex', alignItems: 'center', transition: 'background 150ms' }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', transform: shiftMode ? 'translateX(14px)' : 'translateX(0)', transition: 'transform 150ms', boxShadow: '0 1px 2px rgba(16,24,40,0.25)' }} />
        </span>
      </button>

      <span style={{ flex: 1, minWidth: 8 }} />

      <button onClick={onOpenPlan} title="Plan Management"
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-sm)' }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 15px', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', background: INK, color: '#fff', boxShadow: 'var(--fds-shadow-sm)', transition: 'transform 150ms, box-shadow 150ms' }}>
        <span style={{ fontSize: 13 }}>🗓</span>
        <span className="BodySmallSemibold">Plan{plan ? ` · ${planCoverage(plan)}` : ' — set up'}</span>
      </button>
    </div>
  )
}
