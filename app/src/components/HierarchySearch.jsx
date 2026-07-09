import { useEffect, useMemo, useRef, useState } from 'react'
import { useSceneStore } from '../store/sceneStore'
import { searchNodes, childrenOf, resolveScopePath, nodePath } from '../lib/hierarchy'
import { C, R, glass, SHADOW } from '../ui/theme'

// Centered glassmorphism namespace search as a BREADCRUMB DRILL navigator.
//   • Plain text ("Line") → matching nodes only (Line A, Line B).
//   • Pick a non-leaf → the bar becomes "Line A/" and the options below become
//     that line's children; the line is highlighted (popped) in 3D.
//   • Keep picking to go deeper — the highlighted area narrows each level.
//   • Pick a leaf (asset) → select + frame it (the smallest highlight) and close.
// The query string itself is the breadcrumb: segments before the last "/" are
// the committed path, the trailing text filters the current level's children.
export function HierarchySearch() {
  const objects = useSceneStore(s => s.objects)
  const groups  = useSceneStore(s => s.groups)
  const { selectObject, selectGroup, flyToObject, flyToGroup } = useSceneStore()

  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const blurT = useRef(null)

  const parts     = q.split('/')
  const inScope   = q.includes('/')
  const filter    = (parts[parts.length - 1] ?? '').trim().toLowerCase()
  const committed = parts.slice(0, -1).map(s => s.trim().toLowerCase()).filter(Boolean)
  const scopeId   = useMemo(() => (inScope ? resolveScopePath(objects, groups, committed) : null), [q, objects, groups]) // eslint-disable-line

  // Options: children of the current scope (filtered), or global name matches.
  const rows = useMemo(() => {
    if (inScope) {
      if (!scopeId) return []
      return childrenOf(objects, groups, scopeId)
        .filter(c => !filter || c.node.name.toLowerCase().includes(filter))
        .map(c => ({ id: c.id, kind: c.kind, name: c.node.name }))
    }
    return searchNodes(objects, groups, q).map(r => ({ id: r.id, kind: r.kind, name: r.name, display: r.display }))
  }, [q, objects, groups, scopeId]) // eslint-disable-line

  useEffect(() => { setActive(0) }, [q])

  // Live 3D highlight follows the current scope group — narrows as you drill.
  useEffect(() => {
    if (open && scopeId) { selectGroup(scopeId); flyToGroup(scopeId) }
  }, [scopeId, open]) // eslint-disable-line

  const drill = (node) => { setQ(nodePath(objects, groups, node.id).join('/') + '/'); setOpen(true) }
  const finalize = (node) => { selectObject(node.id); flyToObject(node.id); setQ(''); setOpen(false) }
  const pick = (node) => { if (!node) return; node.kind === 'group' ? drill(node) : finalize(node) }

  const onKey = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(rows.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(rows[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
    else if (e.key === 'Backspace' && inScope && filter === '') {
      // step back up one breadcrumb level
      e.preventDefault()
      setQ(committed.length > 1 ? committed.slice(0, -1).join('/') + '/' : '')
    }
  }

  const crumb = scopeId ? nodePath(objects, groups, scopeId) : []

  return (
    <div style={{ position: 'relative', width: 'min(440px, 42vw)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 12px',
        ...glass, border: `1px solid ${open ? C.accent : C.line}`, borderRadius: R.pill,
        boxShadow: open ? `0 0 0 3px ${C.accentSoft}` : SHADOW.card }}>
        <span style={{ color: C.text3, fontSize: 13 }}>⌕</span>
        <input
          value={q}
          placeholder="Search namespace…  pick a line to drill in"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurT.current = setTimeout(() => setOpen(false), 140) }}
          onKeyDown={onKey}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'inherit', fontSize: 13, color: C.text }} />
        {q && <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(''); setOpen(false) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 14, padding: 0 }}>×</button>}
      </div>

      {open && q.trim() && (
        <div onMouseDown={() => clearTimeout(blurT.current)} style={{ position: 'absolute', top: 40, left: 0, right: 0, zIndex: 50,
          ...glass, border: `1px solid ${C.line}`, borderRadius: R.md, boxShadow: SHADOW.panel, overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>

          {/* breadcrumb header while drilled into a scope */}
          {scopeId && (
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11.5, color: C.text2 }}>
              <span style={{ color: C.text3 }}>in</span>
              {crumb.map((seg, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: C.text3 }}>/</span>}
                  <span style={{ fontWeight: 600, color: i === crumb.length - 1 ? C.accent : C.text2 }}>{seg}</span>
                </span>
              ))}
            </div>
          )}

          {rows.length === 0 && <p style={{ padding: '12px 14px', fontSize: 12.5, color: C.text3 }}>
            {inScope && !scopeId ? 'Unknown path.' : 'No matches.'}
          </p>}

          {rows.map((r, i) => {
            const isActive = i === active
            const isGroup = r.kind === 'group'
            return (
              <div key={r.id} onMouseEnter={() => setActive(i)} onClick={() => pick(r)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px',
                  background: isActive ? C.accentSoft : 'transparent' }}>
                <span style={{ width: 16, textAlign: 'center', fontSize: 12, color: C.text3 }}>{isGroup ? '▣' : '▸'}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isActive ? C.accent : C.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  {r.display && <div style={{ fontSize: 11, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display}</div>}
                </div>
                {isGroup && <span style={{ color: isActive ? C.accent : C.text3, fontSize: 14, flexShrink: 0 }}>›</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
