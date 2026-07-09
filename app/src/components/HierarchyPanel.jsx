import { useEffect, useMemo, useRef, useState } from 'react'
import { useSceneStore } from '../store/sceneStore'
import { buildTree, childrenOf, descendantObjectIds, groupCentroidBounds } from '../lib/hierarchy'
import { stateMeta } from '../lib/stateSchemas'
import { MACHINE_LIBRARY } from '../lib/machineLibrary'
import { C, R, glass } from '../ui/theme'

// Left navigation tree = the UNS namespace. Unlimited nested groups + assets.
// Create groups, add components inside a group, drag to reparent/reorder, click
// a group to select+frame the whole group. Renders its own scroll column; the
// caller places it inside COL_L (view) or a tab body (build).

const ROW_H = 30

export function HierarchyPanel({ editMode }) {
  const objects        = useSceneStore(s => s.objects)
  const groups         = useSceneStore(s => s.groups)
  const selectedId     = useSceneStore(s => s.selectedId)
  const selectedGroupId= useSceneStore(s => s.selectedGroupId)
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const {
    selectObject, selectGroup, flyToObject, flyToGroup,
    addGroup, renameGroup, removeGroup, removeObject, moveNode, addObject, setFlowNodePosition,
  } = useSceneStore()

  const tree = useMemo(() => buildTree(objects, groups), [objects, groups])

  const [collapsed, setCollapsed] = useState({})        // { [groupId]: true }
  const [editing, setEditing] = useState(null)          // { id, name }
  const [drag, setDrag] = useState(null)                // dragging node id
  const [dropAt, setDropAt] = useState(null)            // { id, pos: 'into'|'before'|'after' }
  const [picker, setPicker] = useState(null)            // group id for "+ component"
  const [pq, setPq] = useState('')

  // Auto-reveal: expand ancestors of the current selection (search / canvas click).
  useEffect(() => {
    const id = selectedGroupId ?? selectedId
    if (!id) return
    const anc = []
    let cur = groups[id] ? groups[id].parentId : objects[id]?.parentId
    const guard = new Set()
    while (cur && !guard.has(cur)) { guard.add(cur); anc.push(cur); cur = groups[cur]?.parentId ?? null }
    if (anc.length) setCollapsed(c => { const n = { ...c }; anc.forEach(g => { delete n[g] }); return n })
  }, [selectedId, selectedGroupId]) // eslint-disable-line

  // Scroll the selected row into view (after ancestors expand + re-render).
  const selRef = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => selRef.current?.scrollIntoView({ block: 'nearest' }), 0)
    return () => clearTimeout(t)
  }, [selectedId, selectedGroupId])

  const toggle = (id) => setCollapsed(c => ({ ...c, [id]: !c[id] }))
  const parentOf = (id) => (groups[id]?.parentId ?? objects[id]?.parentId ?? null)

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    const dragId = drag, target = dropAt
    setDrag(null); setDropAt(null)
    if (!dragId || !target || dragId === target.id) return
    if (target.pos === 'into') { moveNode(dragId, target.id, null); return }
    const parent = parentOf(target.id)
    const sibs = childrenOf(useSceneStore.getState().objects, useSceneStore.getState().groups, parent)
    const idx = sibs.findIndex(c => c.id === target.id)
    if (target.pos === 'before') moveNode(dragId, parent, target.id)
    else moveNode(dragId, parent, sibs[idx + 1]?.id ?? null)
  }

  const addComponent = (type, layer) => {
    const { center } = groupCentroidBounds(useSceneStore.getState().objects, useSceneStore.getState().groups, picker)
    const pos = [center[0] + (Math.random() - 0.5) * 4, 0, center[2] + (Math.random() - 0.5) * 4]
    const id = addObject(type, pos, layer ?? 'equipment', {}, picker)
    const n = Object.keys(useSceneStore.getState().objects).length
    setFlowNodePosition(id, { x: 40 + (n * 46) % 460, y: 40 + Math.floor((n * 46) / 460) * 130 })
    setPicker(null); setPq('')
  }

  // ── recursive row rendering ──
  const rows = []
  const walk = (nodes, depth) => {
    for (const c of nodes) {
      const isGroup = c.kind === 'group'
      const id = c.id
      const open = !collapsed[id]
      const selected = isGroup ? selectedGroupId === id : selectedId === id
      const dropHere = dropAt?.id === id
      const indent = 8 + depth * 14

      const onDragOver = (e) => {
        e.preventDefault(); e.stopPropagation()
        const r = e.currentTarget.getBoundingClientRect()
        const y = (e.clientY - r.top) / r.height
        let pos = 'into'
        if (isGroup) pos = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'into'
        else pos = y < 0.5 ? 'before' : 'after'
        if (!dropAt || dropAt.id !== id || dropAt.pos !== pos) setDropAt({ id, pos })
      }

      rows.push(
        <div key={id}
          ref={selected ? selRef : undefined}
          draggable={editMode && editing?.id !== id}
          onDragStart={(e) => { e.stopPropagation(); setDrag(id) }}
          onDragEnd={() => { setDrag(null); setDropAt(null) }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => { if (isGroup) { selectGroup(id); flyToGroup(id) } else { selectObject(id); flyToObject(id) } }}
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
            height: ROW_H, paddingLeft: indent, paddingRight: 8, margin: '1px 6px',
            borderRadius: R.sm, cursor: 'pointer', userSelect: 'none',
            background: selected ? C.accentSoft : (dropHere && dropAt.pos === 'into' ? 'rgba(10,132,255,0.10)' : 'transparent'),
            boxShadow: dropHere && dropAt.pos !== 'into'
              ? `inset 0 ${dropAt.pos === 'before' ? '2px' : '-2px'} 0 0 ${C.accent}` : 'none',
            opacity: drag === id ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.035)' }}
          onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = (dropHere && dropAt.pos === 'into') ? 'rgba(10,132,255,0.10)' : 'transparent' }}
        >
          {/* caret / dot */}
          {isGroup ? (
            <span onClick={(e) => { e.stopPropagation(); toggle(id) }}
              style={{ width: 14, textAlign: 'center', color: C.text3, fontSize: 9, flexShrink: 0 }}>
              {open ? '▼' : '▶'}
            </span>
          ) : (
            <span style={{ width: 14, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateMeta(c.node.type, c.node.state).color }} />
            </span>
          )}

          {/* name (editable for groups) */}
          {editing?.id === id ? (
            <input autoFocus value={editing.name}
              onChange={(e) => setEditing({ id, name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => { renameGroup(id, editing.name.trim() || 'Group'); setEditing(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null) }}
              style={{ flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 13, padding: '2px 6px',
                border: `1px solid ${C.accent}`, borderRadius: 5, color: C.text, background: C.surface }} />
          ) : (
            <span onDoubleClick={(e) => { if (isGroup && editMode) { e.stopPropagation(); setEditing({ id, name: c.node.name }) } }}
              style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontSize: 13, fontWeight: isGroup ? 600 : 400, color: selected ? C.accent : C.text }}>
              {c.node.name}
              {isGroup && <span style={{ color: C.text3, fontWeight: 400 }}> · {childrenOf(objects, groups, id).length}</span>}
            </span>
          )}

          {/* hover actions (groups only — edit mode only) */}
          {isGroup && editMode && (
            <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <IconMini title="Add sub-group" onClick={(e) => { e.stopPropagation(); const g = addGroup('New Group', id); setCollapsed(c2 => ({ ...c2, [id]: false })); setEditing({ id: g, name: 'New Group' }) }}>＋▣</IconMini>
              <IconMini title="Add component" onClick={(e) => { e.stopPropagation(); setPicker(id); setPq('') }}>＋</IconMini>
            </span>
          )}
        </div>
      )
      if (isGroup && open) walk(c.children, depth + 1)
    }
  }
  walk(tree, 0)

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      onDragOver={(e) => { e.preventDefault() }}
      onDrop={(e) => { /* drop on empty area → root */ if (drag) { moveNode(drag, null, null); setDrag(null); setDropAt(null) } }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>Namespace</span>
        {editMode && (
          <button onClick={() => { const g = addGroup('New Group', null); setEditing({ id: g, name: 'New Group' }) }}
            title="New root group"
            style={{ background: 'rgba(120,120,128,0.12)', border: 'none', borderRadius: R.sm, cursor: 'pointer',
              color: C.text2, fontSize: 12, fontWeight: 600, padding: '3px 9px' }}>＋ Group</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 10 }}>
        {rows}
        {rows.length === 0 && (
          <p style={{ fontSize: 12.5, color: C.text3, padding: '10px 16px' }}>No assets yet. Add a group, then components.</p>
        )}
      </div>

      {/* component picker sheet */}
      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(0,0,0,0.10)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '70%', display: 'flex', flexDirection: 'column',
            ...glass, borderTop: `1px solid ${C.line}`, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg }}>
            <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${C.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Add to “{groups[picker]?.name}”</span>
                <button onClick={() => setPicker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 16 }}>×</button>
              </div>
              <input autoFocus placeholder="Search components…" value={pq} onChange={(e) => setPq(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontFamily: 'inherit', fontSize: 12.5,
                  border: `1px solid ${C.line}`, borderRadius: R.sm, color: C.text, background: 'rgba(120,120,128,0.08)' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
              {MACHINE_LIBRARY.map(({ category, items }) => {
                const shown = items.filter(it => !pq.trim() || it.label.toLowerCase().includes(pq.toLowerCase().trim()))
                if (!shown.length) return null
                return (
                  <div key={category}>
                    <p style={{ padding: '8px 16px 4px', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>{category}</p>
                    {shown.map(it => (
                      <div key={it.type} onClick={() => addComponent(it.type, it.layer)} style={{
                        padding: '7px 16px', cursor: 'pointer', fontSize: 13, color: C.text }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{it.label}</div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IconMini({ children, title, onClick }) {
  return (
    <button title={title} onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: C.text3,
      fontSize: 11, lineHeight: 1, padding: '2px 3px', borderRadius: 4,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = 'rgba(120,120,128,0.16)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.background = 'none' }}>{children}</button>
  )
}
