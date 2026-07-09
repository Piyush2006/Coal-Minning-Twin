import { useState } from 'react'
import { useStudioStore } from '../../store/studioStore'
import { useSceneStore } from '../../store/sceneStore'
import { MACHINE_LIBRARY } from '../../lib/machineLibrary'
import { GEOMETRIES } from '../../lib/componentSpec'
import { C, R, glass } from '../../ui/theme'

// Studio hierarchy — same look & interactions as the main builder's HierarchyPanel
// (carets, child counts, inline rename, hover add, drag into/before/after), but
// over the draft Component Spec: the component root, group parts, primitive/
// component/general parts, and the declarative sub-assemblies — one unified tree.

const ROW_H = 30
const BUILTIN_REFS = MACHINE_LIBRARY.flatMap(c => c.items.map(it => ({ value: it.type, label: it.label })))
const refLabel = (ref) => BUILTIN_REFS.find(o => o.value === ref)?.label
  || useSceneStore.getState().customAssetTypes[ref]?.label || ref

const KIND_ICON = { logical: '◌', component: '◈', shape: '▢', sub: '▦' }
function partName(p) {
  if (p.label) return p.label
  if (p.kind === 'component') return refLabel(p.ref)
  if (p.kind === 'group') return 'Group'
  if (p.kind === 'logical') return 'General Part'
  return p.geometry || 'Shape'
}

function IconMini({ children, title, onClick }) {
  return (
    <button title={title} onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 11, lineHeight: 1, padding: '2px 3px', borderRadius: 4 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = 'rgba(120,120,128,0.16)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.background = 'none' }}>{children}</button>
  )
}

// Add popover (Group / General part / Shape / Component) scoped to a parent node.
function AddPopover({ parentId, onClose }) {
  const { addPart, addGroupPart, addLogicalPart, addComponentPart, editingId } = useStudioStore()
  const refs = [
    ...BUILTIN_REFS,
    ...Object.values(useSceneStore.getState().customAssetTypes).filter(ct => ct.id !== editingId).map(ct => ({ value: ct.id, label: ct.label })),
  ]
  const item = { padding: '7px 9px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: C.surface, color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, textAlign: 'left' }
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 40, left: 10, right: 10, zIndex: 30, padding: 8, ...glass, border: `1px solid ${C.line}`, borderRadius: R.md, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.3, margin: 0 }}>Add {parentId ? 'inside group' : 'to component'}</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...item, flex: 1 }} onClick={() => { addGroupPart(parentId); onClose() }}>▸ Group</button>
        <button style={{ ...item, flex: 1 }} onClick={() => { addLogicalPart(parentId); onClose() }}>◌ General part</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {GEOMETRIES.map(g => <button key={g} style={{ ...item, textTransform: 'capitalize', flex: '1 0 28%' }} onClick={() => { addPart(g, parentId); onClose() }}>{g}</button>)}
      </div>
      <select defaultValue="" onChange={e => { if (e.target.value) { addComponentPart(e.target.value, parentId); onClose() } }} style={{ ...item, width: '100%' }}>
        <option value="">Nest a component…</option>
        {refs.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function StudioTree() {
  const { draft, selPart, selSub, rootSel, selectPart, selectSub, selectRoot, addGroupPart, removePart, moveNodePart, updatePart } = useStudioStore()
  const parts = draft.parts || []
  const subs = draft.subComponents || []
  const idSet = new Set(parts.map(p => p.id))

  const [collapsed, setCollapsed] = useState({})
  const [editing, setEditing] = useState(null)     // { id, name }
  const [drag, setDrag] = useState(null)
  const [dropAt, setDropAt] = useState(null)        // { id, pos }
  const [addUnder, setAddUnder] = useState(undefined)

  const toggle = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }))
  const childParts = (pid) => parts.filter(p => { const x = p.parentId || null; return pid === null ? (x === null || !idSet.has(x)) : x === pid })
  const parentOf = (id) => parts.find(p => p.id === id)?.parentId || null

  const onDrop = () => {
    const dragId = drag, target = dropAt
    setDrag(null); setDropAt(null)
    if (!dragId || !target || dragId === target.id) return
    if (target.pos === 'into') { moveNodePart(dragId, target.id, null); return }
    const parent = parentOf(target.id)
    const sibs = childParts(parent)
    const idx = sibs.findIndex(c => c.id === target.id)
    if (target.pos === 'before') moveNodePart(dragId, parent, target.id)
    else moveNodePart(dragId, parent, sibs[idx + 1]?.id ?? null)
  }

  const rows = []

  const row = ({ id, depth, isGroup, isSub, selected, name, count, color, draggable, node }) => {
    const open = !collapsed[id]
    const dropHere = dropAt?.id === id
    const indent = 8 + depth * 14
    const onDragOver = (e) => {
      if (!draggable && !isGroup) return
      e.preventDefault(); e.stopPropagation()
      const r = e.currentTarget.getBoundingClientRect(); const y = (e.clientY - r.top) / r.height
      const pos = isGroup ? (y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'into') : (y < 0.5 ? 'before' : 'after')
      if (!dropAt || dropAt.id !== id || dropAt.pos !== pos) setDropAt({ id, pos })
    }
    rows.push(
      <div key={id}
        draggable={draggable && editing?.id !== id}
        onDragStart={(e) => { e.stopPropagation(); setDrag(id) }}
        onDragEnd={() => { setDrag(null); setDropAt(null) }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={node.onClick}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 6, height: ROW_H,
          paddingLeft: indent, paddingRight: 8, margin: '1px 6px', borderRadius: R.sm, cursor: 'pointer', userSelect: 'none',
          background: selected ? C.accentSoft : (dropHere && dropAt.pos === 'into' ? 'rgba(10,132,255,0.10)' : 'transparent'),
          boxShadow: dropHere && dropAt.pos !== 'into' ? `inset 0 ${dropAt.pos === 'before' ? '2px' : '-2px'} 0 0 ${C.accent}` : 'none',
          opacity: drag === id ? 0.4 : 1,
        }}
        onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.035)'; node.setHover?.(true) }}
        onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = (dropHere && dropAt.pos === 'into') ? 'rgba(10,132,255,0.10)' : 'transparent'; node.setHover?.(false) }}>
        {/* caret / icon */}
        {isGroup ? (
          <span onClick={(e) => { e.stopPropagation(); toggle(id) }} style={{ width: 14, textAlign: 'center', color: C.text3, fontSize: 9, flexShrink: 0 }}>{open ? '▼' : '▶'}</span>
        ) : (
          <span style={{ width: 14, display: 'flex', justifyContent: 'center', flexShrink: 0, color: C.text3, fontSize: 10 }}>
            {color ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} /> : (KIND_ICON[node.iconKey] || '▢')}
          </span>
        )}
        {/* name (editable) */}
        {editing?.id === id ? (
          <input autoFocus value={editing.name}
            onChange={(e) => setEditing({ id, name: e.target.value })} onClick={(e) => e.stopPropagation()}
            onBlur={() => { node.commitName?.(editing.name); setEditing(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null) }}
            style={{ flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 13, padding: '2px 6px', border: `1px solid ${C.accent}`, borderRadius: 5, color: C.text, background: C.surface }} />
        ) : (
          <span onDoubleClick={(e) => { if (node.commitName) { e.stopPropagation(); setEditing({ id, name }) } }}
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: (isGroup || node.bold) ? 600 : 400, color: selected ? C.accent : C.text }}>
            {name}{count != null && <span style={{ color: C.text3, fontWeight: 400 }}> · {count}</span>}
          </span>
        )}
        {/* hover add/delete */}
        <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>{node.actions}</span>
      </div>
    )
  }

  // recursive walk over part-children of a parent
  const walkParts = (pid, depth) => {
    for (const p of childParts(pid)) {
      const isGroup = p.kind === 'group'
      const selected = selPart === p.id
      const open = !collapsed[p.id]
      row({
        id: p.id, depth, isGroup, selected, name: partName(p),
        count: isGroup ? childParts(p.id).length : null, draggable: true,
        node: {
          iconKey: p.kind === 'component' ? 'component' : p.kind === 'logical' ? 'logical' : 'shape',
          onClick: () => selectPart(p.id),
          commitName: (n) => updatePart(p.id, { label: n.trim() }),
          actions: (
            <>
              {isGroup && <IconMini title="Add inside" onClick={(e) => { e.stopPropagation(); setCollapsed(c => ({ ...c, [p.id]: false })); setAddUnder(p.id) }}>＋</IconMini>}
              <IconMini title="Delete" onClick={(e) => { e.stopPropagation(); removePart(p.id) }}>✕</IconMini>
            </>
          ),
        },
      })
      if (isGroup && open) walkParts(p.id, depth + 1)
    }
  }

  // ── root (the component) ──
  const rootOpen = !collapsed.__root__
  row({
    id: '__root__', depth: 0, isGroup: true, selected: rootSel, name: draft.label || 'Component',
    count: childParts(null).length + subs.length, draggable: false,
    node: {
      bold: true,
      onClick: selectRoot,
      actions: <IconMini title="Add to component" onClick={(e) => { e.stopPropagation(); setCollapsed(c => ({ ...c, __root__: false })); setAddUnder(null) }}>＋</IconMini>,
      setHover: () => {},
    },
  })
  if (rootOpen) {
    walkParts(null, 1)
    for (const s of subs) {
      row({
        id: s.id, depth: 1, isGroup: false, selected: selSub === s.id, name: s.label, count: s.count,
        draggable: false,
        node: { iconKey: 'sub', onClick: () => selectSub(s.id) },
      })
    }
  }

  return (
    <div style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', background: C.surface, position: 'relative' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => { if (drag) { moveNodePart(drag, null, null); setDrag(null); setDropAt(null) } }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>Hierarchy</span>
        <button onClick={() => addGroupPart(null)} title="New group"
          style={{ background: 'rgba(120,120,128,0.12)', border: 'none', borderRadius: R.sm, cursor: 'pointer', color: C.text2, fontSize: 12, fontWeight: 600, padding: '3px 9px' }}>＋ Group</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 10 }}>{rows}</div>
      {addUnder !== undefined && (
        <div onClick={() => setAddUnder(undefined)} style={{ position: 'absolute', inset: 0, zIndex: 25 }}>
          <AddPopover parentId={addUnder} onClose={() => setAddUnder(undefined)} />
        </div>
      )}
    </div>
  )
}
