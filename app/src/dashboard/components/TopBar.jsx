// Compact top bar (reference style) — section title on the left; on the right a
// single date pill (presets + custom range), one Filters popover (Mine / Area /
// Equipment + shift toggle) with an active-count badge, and the ink Plan button.
// Same filters/behaviour as before — only the presentation is condensed.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DatePicker } from '@faclon-labs/design-sdk/DatePicker'
import { useDash } from '../store'
import { MINES, AREAS, EQUIP_TYPES, sideOf } from '../data/taxonomy'
import { PRESETS, presetRange } from '../data/time'
import { Dropdown } from './primitives'

const INK = '#0F1728'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// plans are monthly — label the button with the month the selected range sits in
function planLabel(plan, range) {
  if (!plan || !plan.rows?.length) return 'Set up plan'
  const d = range?.end || new Date()
  const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const covered = plan.rows.some(r => String(r.period || '').startsWith(mk))
  return covered ? `Plan · ${MONTHS[d.getMonth()]}` : `Plan · ${MONTHS[d.getMonth()]} missing`
}
const fmtD = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`

function AnchoredPopover({ anchorRef, open, onClose, align = 'right', style, children }) {
  const popRef = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 8, left: align === 'right' ? undefined : r.left, right: align === 'right' ? window.innerWidth - r.right : undefined })
    }
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open, anchorRef, align])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (anchorRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return; onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose, anchorRef])
  if (!open || !pos) return null
  return createPortal(
    <div ref={popRef} className="dash-theme" style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right, zIndex: 9999,
      background: 'var(--background-surface-intense)', borderRadius: 16, boxShadow: 'var(--fds-shadow-lg)', padding: 8, ...style }}>
      {children}
    </div>, document.body)
}

// white pill trigger shared by date + filters — compact
const pill = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 31, padding: '0 11px', borderRadius: 999,
  border: 'none', background: 'var(--background-surface-intense)', boxShadow: active ? 'var(--fds-shadow-md)' : 'var(--fds-shadow-xs)',
  cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'box-shadow 150ms',
})
const pillText = { color: 'var(--text-gray-primary)', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 600 }

function DatePill({ range, settings, onRange }) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const ref = useRef(null)
  const label = range.preset === 'Custom' ? `${fmtD(range.start)} – ${fmtD(range.end)}` : range.preset
  return (
    <>
      <button ref={ref} onClick={() => { setOpen(o => !o); setPicking(false) }} style={pill(open)}>
        <CalIcon />
        <span style={pillText}>{label}</span>
        <Chev open={open} />
      </button>
      <AnchoredPopover anchorRef={ref} open={open} onClose={() => setOpen(false)} style={{ width: picking ? 272 : 176 }}>
        {!picking ? (
          <div style={{ display: 'grid', gap: 1 }}>
            {PRESETS.map(p => {
              const on = range.preset === p
              return (
                <button key={p} onClick={() => { onRange(presetRange(p, settings)); setOpen(false) }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12.5, textAlign: 'left',
                    background: on ? INK : 'transparent', color: on ? '#fff' : 'var(--text-gray-primary)' }}>
                  {p}{on && <span style={{ fontSize: 10 }}>✓</span>}
                </button>
              )
            })}
            <div style={{ height: 1, background: 'var(--border-gray-subtle)', margin: '3px 6px' }} />
            <button onClick={() => setPicking(true)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-surface-subtle)'}
              onMouseLeave={(e) => e.currentTarget.style.background = range.preset === 'Custom' ? 'var(--background-surface-subtle)' : 'transparent'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12.5, textAlign: 'left',
                background: range.preset === 'Custom' ? 'var(--background-surface-subtle)' : 'transparent', color: 'var(--text-gray-primary)' }}>
              Custom range… <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>→</span>
            </button>
          </div>
        ) : (
          <div style={{ padding: 2, fontSize: 12.5 }}>
            <DatePicker mode="range" placeholder="Custom range" rangeValue={{ start: range.start, end: range.end }}
              onRangeChange={(r) => { if (r) { onRange({ start: r.start, end: r.end, preset: 'Custom' }); setOpen(false) } }} />
          </div>
        )}
      </AnchoredPopover>
    </>
  )
}

function FiltersPill() {
  const { mineId, areaId, equipTypeId, shiftMode, setFilter, setShiftMode } = useDash()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
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
  const count = [mineId, areaId, equipTypeId].filter(v => v !== 'all').length + (shiftMode ? 1 : 0)

  return (
    <>
      <button ref={ref} onClick={() => setOpen(o => !o)} style={pill(open)}>
        <FilterIcon />
        <span style={pillText}>Filters</span>
        {count > 0 && (
          <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 999, background: INK, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 10, fontWeight: 600 }}>{count}</span>
        )}
        <Chev open={open} />
      </button>
      <AnchoredPopover anchorRef={ref} open={open} onClose={() => setOpen(false)} style={{ width: 248, padding: 13 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Dropdown label="Mine" value={mineId} options={MINES} onChange={onMine} width="100%" />
          <Dropdown label="Area" value={areaId} options={areaOpts} onChange={(v) => setFilter('areaId', v)} width="100%" />
          <Dropdown label="Equipment" value={equipTypeId} options={equipOpts} onChange={(v) => setFilter('equipTypeId', v)} width="100%" />
          <div style={{ height: 1, background: 'var(--border-gray-subtle)' }} />
          <button onClick={() => setShiftMode(!shiftMode)} role="switch" aria-checked={shiftMode}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-primary)' }}>Shift-wise breakdown</span>
            <span style={{ width: 34, height: 20, borderRadius: 999, padding: 2, background: shiftMode ? INK : 'var(--border-gray-default)', display: 'inline-flex', alignItems: 'center', transition: 'background 150ms' }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: shiftMode ? 'translateX(14px)' : 'translateX(0)', transition: 'transform 150ms', boxShadow: '0 1px 2px rgba(16,24,40,0.25)' }} />
            </span>
          </button>
        </div>
      </AnchoredPopover>
    </>
  )
}

export function TopBar({ title, onOpenPlan }) {
  const { range, settings, plan, setRange } = useDash()
  return (
    // same container geometry as the page content, so the title starts exactly
    // where the cards below start
    <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '18px 32px 14px', flexWrap: 'wrap' }}>
      <h1 className="HeadingMediumSemibold" style={{ margin: 0, marginRight: 'auto', fontSize: 21 }}>{title}</h1>
      <DatePill range={range} settings={settings} onRange={setRange} />
      <FiltersPill />
      <button onClick={onOpenPlan} title="Plan Management"
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-xs)' }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 31, padding: '0 13px', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12.5, fontWeight: 600, background: INK, color: '#fff', boxShadow: 'var(--fds-shadow-xs)', transition: 'transform 150ms, box-shadow 150ms' }}>
        {planLabel(plan, range)}
      </button>
    </div>
  )
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const CalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...S} style={{ color: 'var(--text-gray-tertiary)' }}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v3.5M16 3v3.5" />
  </svg>
)
const FilterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" {...S} style={{ color: 'var(--text-gray-tertiary)' }}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
)
const Chev = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" {...S} style={{ color: 'var(--text-gray-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
