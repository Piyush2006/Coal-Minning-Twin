import { useEffect, useRef, useState } from 'react'
import { subInstanceValue, subInstanceColor } from '../../lib/componentSubs'
import { C, R, FONT } from '../../ui/theme'

// Hierarchy tree for a component's sub-assemblies — like the UNS namespace tree.
//   Component → sub-groups (Anodes, Shell Windows…) → instances (color-coded by state).
const singular = (label) => label.replace(/s$/, '')

function Row({ depth, active, onClick, label, count, chevron, dot, bold, innerRef }) {
  return (
    <div ref={innerRef} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, paddingLeft: 8 + depth * 14, paddingRight: 8, cursor: 'pointer',
        borderRadius: R.sm, background: active ? C.accentSoft : 'transparent', color: active ? C.accent : C.text,
        fontWeight: bold ? 700 : 500, fontSize: 12.5 }}>
      <span style={{ width: 12, color: C.text3, fontSize: 10 }}>{chevron || ''}</span>
      {dot && <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null && <span style={{ fontSize: 11, color: C.text3 }}>{count}</span>}
    </div>
  )
}

// Read-only PARTS hierarchy (for custom components built from a parts tree) — the
// same nested structure the Studio shows, so Details and Build match.
const PART_ICON = { group: '▸', logical: '◌', component: '◈' }
const partLabel = (p, customTypes) =>
  p.label || (p.kind === 'component' ? (customTypes?.[p.ref]?.label || p.ref)
    : p.kind === 'group' ? 'Group' : p.kind === 'logical' ? 'General Part' : (p.geometry || 'Shape'))
const partChildren = (parts, idSet, pid) =>
  parts.filter(p => { const x = p.parentId || null; return pid === null ? (x === null || !idSet.has(x)) : x === pid })

export function PartsTree({ parts, customTypes, selId, onSelect, baseDepth = 1 }) {
  const [open, setOpen] = useState({})
  const idSet = new Set(parts.map(p => p.id))
  const render = (pid, depth) => partChildren(parts, idSet, pid).map(p => {
    const kids = partChildren(parts, idSet, p.id)
    const isOpen = !!open[p.id]
    const icon = PART_ICON[p.kind] || '▢'
    return (
      <div key={p.id}>
        <Row depth={depth} active={selId === p.id} label={`${icon}  ${partLabel(p, customTypes)}`}
          count={kids.length || null} chevron={kids.length ? (isOpen ? '▾' : '▸') : ''}
          onClick={() => { onSelect(p.id); if (kids.length) setOpen(o => ({ ...o, [p.id]: !o[p.id] })) }} />
        {isOpen && render(p.id, depth + 1)}
      </div>
    )
  })
  return <div>{render(null, baseDepth)}</div>
}

export function SubTree({ obj, subs, sel, rootLabel, onRoot, onGroup, onInstance }) {
  const [open, setOpen] = useState({})
  const toggle = (id) => setOpen(o => ({ ...o, [id]: !o[id] }))
  const selRef = useRef(null)

  // Auto-expand the selected group (e.g. when a part is clicked in the 3D model).
  useEffect(() => { if (sel?.subId) setOpen(o => (o[sel.subId] ? o : { ...o, [sel.subId]: true })) }, [sel?.subId])
  // Scroll the selected row into view after expand/re-render.
  useEffect(() => { const t = setTimeout(() => selRef.current?.scrollIntoView({ block: 'nearest' }), 0); return () => clearTimeout(t) }, [sel?.subId, sel?.index])

  return (
    <div style={{ fontFamily: FONT }}>
      <Row depth={0} active={!sel} onClick={onRoot} label={rootLabel} bold innerRef={!sel ? selRef : undefined} />
      {subs.map(d => {
        const groupSel = sel?.subId === d.id && sel.index == null
        const isOpen = !!open[d.id]
        return (
          <div key={d.id}>
            <Row depth={1} active={groupSel} chevron={isOpen ? '▾' : '▸'} count={d.count} label={d.label}
              innerRef={groupSel ? selRef : undefined}
              onClick={() => { onGroup(d.id); toggle(d.id) }} />
            {isOpen && Array.from({ length: d.count }, (_, i) => {
              const { state } = subInstanceValue(d, i, obj)
              const on = sel?.subId === d.id && sel.index === i
              return <Row key={i} depth={2} active={on} dot={subInstanceColor(d, state)} label={`${singular(d.label)} ${i + 1}`}
                innerRef={on ? selRef : undefined} onClick={() => onInstance(d.id, i)} />
            })}
          </div>
        )
      })}
    </div>
  )
}
