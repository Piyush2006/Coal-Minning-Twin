import { useEffect, useRef, useState } from 'react'
import { useAIStore } from '../store/aiStore'
import { listWorkspaces, listChildren, searchNodes } from '../lib/unsBrowse'
import { C, R, glass, SHADOW } from '../ui/theme'

// ─────────────────────────────────────────────────────────────────────────────
// UNS topic picker — a cascading namespace browser that drops under the UNS input
// in ParamRow. Drills workspaces → nodes (skeleton) one level at a time; typing
// (≥2 chars) inside a workspace switches to SERVER-SIDE search across the whole
// tree (UNS-TREE-API.md §7) so you jump straight to a tag instead of drilling.
// Picking a node returns its `path` (e.g. "jsw/nandyal/ballmill/demand15"), which
// is what the resolve poller consumes. Auth = the SSO-exchanged session
// (unsBrowseToken), routed through the same-origin /uns-api proxy.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_TINT = {
  Enterprise: '#7c8b9c', Division: '#7c8b9c', Site: '#5a8fb8', Building: '#5a8fb8',
  Floor: '#4fa3a0', Zone: '#4fa3a0', Area: '#4fa3a0', Line: '#6f8fd0',
  WorkStation: '#6f8fd0', Cell: '#9a7fd0', Asset: '#c0893f', Machine: '#c0893f',
  Device: '#c0893f', Gateway: '#c0893f', Sensor: C.accent, Variable: C.accent,
  Tag: C.accent, Alarm: '#e5564b', ComputeFlow: '#8a929b', Cluster: '#8a929b',
}

function Badge({ type }) {
  const c = TYPE_TINT[type] || C.text3
  return (
    <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
      color: c, background: `${c}22`, border: `1px solid ${c}44`, borderRadius: 4, padding: '1px 5px' }}>
      {type || 'node'}
    </span>
  )
}

export function UnsTopicPicker({ onPick, onClose }) {
  const token = useAIStore(s => s.iosenseJWT || s.unsBrowseToken)   // platform session powers UNS
  const base = useAIStore(s => s.unsBrowseBaseUrl)

  const [level, setLevel] = useState('ws')   // 'ws' (choose workspace) | 'nodes' (drilling/searching)
  const [wsList, setWsList] = useState(null)
  const [ws, setWs] = useState(null)          // { id, name }
  const [nodes, setNodes] = useState([])
  const [crumbs, setCrumbs] = useState([])    // node stack under the workspace: [{ id, name }]
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)        // { message, code }
  const [filter, setFilter] = useState('')
  const [results, setResults] = useState(null)  // search results (null = not searching)
  const [searching, setSearching] = useState(false)
  const rootRef = useRef(null)

  // Close on outside-click / Escape.
  useEffect(() => {
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  // Load workspaces on open.
  useEffect(() => {
    let live = true
    if (!token) { setErr({ message: 'Connect IOsense in Settings.', code: 'no-token' }); return }
    setLoading(true); setErr(null)
    listWorkspaces({ token, base })
      .then(r => { if (live) { setWsList(r); setLoading(false) } })
      .catch(e => { if (live) { setErr({ message: e.message, code: e.code }); setLoading(false) } })
    return () => { live = false }
  }, [token, base])

  // Server-side search: when inside a workspace and the query is ≥2 chars,
  // search the whole tree (debounced). Clearing it returns to the drill view.
  const searchMode = level === 'nodes' && !!ws && filter.trim().length >= 2
  useEffect(() => {
    if (!searchMode) { setResults(null); setSearching(false); return }
    let live = true
    setSearching(true)
    const h = setTimeout(async () => {
      try { const r = await searchNodes({ token, base }, ws.id, filter.trim()); if (live) setResults(r) }
      catch (e) { if (live) { setErr({ message: e.message, code: e.code }); setResults([]) } }
      finally { if (live) setSearching(false) }
    }, 300)
    return () => { live = false; clearTimeout(h) }
  }, [filter, searchMode, ws, token, base])

  const fetchChildren = async (parentId) => {
    setLoading(true); setErr(null)
    try { setNodes(await listChildren({ token, base }, ws?.id, parentId)) }
    catch (e) { setErr({ message: e.message, code: e.code }) }
    finally { setLoading(false) }
  }

  const openWorkspace = async (w) => {
    setWs(w); setCrumbs([]); setLevel('nodes'); setFilter(''); setResults(null); setLoading(true); setErr(null)
    try { setNodes(await listChildren({ token, base }, w.id, null)) }
    catch (e) { setErr({ message: e.message, code: e.code }) }
    finally { setLoading(false) }
  }

  const onDrillRow = async (n) => {
    if (!n.hasChildren) { onPick(`uns:${ws.id}://${n.path}:last`); onClose(); return }   // leaf → bind canonical uns topic (full path resolves; leaf-name is ambiguous in JSW)
    setCrumbs(c => [...c, { id: n.id, name: n.name }]); setFilter('')
    await fetchChildren(n.id)
  }

  // Jump up: idx = -1 → workspace root; else back to crumbs[idx].
  const jumpTo = async (idx) => {
    const next = idx < 0 ? [] : crumbs.slice(0, idx + 1)
    setCrumbs(next); setFilter('')
    await fetchChildren(next.length ? next[next.length - 1].id : null)
  }

  const backToWorkspaces = () => { setLevel('ws'); setWs(null); setCrumbs([]); setNodes([]); setFilter(''); setResults(null); setErr(null) }

  const f = filter.trim().toLowerCase()
  const wsRows = (wsList || []).filter(w => !f || w.name.toLowerCase().includes(f))
  const drillRows = nodes.filter(n => !f || n.name.toLowerCase().includes(f) || (n.path || '').toLowerCase().includes(f))

  const crumbSeg = (labelText, onClick, active) => (
    <button type="button" onClick={onClick} disabled={active}
      style={{ background: 'none', border: 'none', padding: 0, cursor: active ? 'default' : 'pointer',
        color: active ? C.text : C.accent, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', maxWidth: 90,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {labelText}
    </button>
  )

  return (
    <div ref={rootRef} onKeyDown={(e) => e.stopPropagation()}
      style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
        display: 'flex', flexDirection: 'column', maxHeight: 340, ...glass, border: `1px solid ${C.line}`,
        borderRadius: R.md, boxShadow: SHADOW.panel, overflow: 'hidden' }}>

      {/* header — breadcrumb + close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
        {crumbSeg('UNS', backToWorkspaces, level === 'ws')}
        {ws && <><span style={{ color: C.text3, fontSize: 11 }}>›</span>{crumbSeg(ws.name, () => jumpTo(-1), crumbs.length === 0 && !searchMode)}</>}
        {!searchMode && crumbs.map((c, i) => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: C.text3, fontSize: 11 }}>›</span>
            {crumbSeg(c.name, () => jumpTo(i), i === crumbs.length - 1)}
          </span>
        ))}
        {searchMode && <><span style={{ color: C.text3, fontSize: 11 }}>›</span><span style={{ fontSize: 11, color: C.text3 }}>search</span></>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onClose} title="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      {/* filter / search */}
      <div style={{ padding: '8px 10px 6px' }}>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus
          placeholder={level === 'ws' ? 'Filter workspaces…' : 'Search this workspace…'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: `1px solid ${searchMode ? C.accent : C.line}`, borderRadius: 6,
            fontFamily: 'inherit', fontSize: 11.5, color: C.text, background: C.surface, outline: 'none' }} />
      </div>

      {/* body */}
      <div style={{ overflowY: 'auto', padding: '2px 6px 8px' }}>
        {(loading || searching) && <div style={{ padding: '10px 8px', fontSize: 12, color: C.text3 }}>{searching ? 'Searching…' : 'Loading…'}</div>}

        {!loading && !searching && err && (
          <div style={{ padding: '10px 8px', fontSize: 12, color: C.bad, lineHeight: 1.5 }}>
            {err.message}
            {(err.code === 'auth' || err.code === 'no-token') &&
              <div style={{ marginTop: 4, color: C.text3 }}>Open Settings → IOsense and connect.</div>}
          </div>
        )}

        {/* SEARCH RESULTS (whole-workspace) */}
        {!loading && !searching && !err && searchMode && (
          (results || []).length === 0
            ? <div style={{ padding: '10px 8px', fontSize: 12, color: C.text3 }}>No matches.</div>
            : (results || []).map(n => (
              <button key={n.id} type="button" onClick={() => { onPick(`uns:${ws.id}://${n.path}:last`); onClose() }} title={n.path}
                style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <Badge type={n.type} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                  <span style={{ color: C.accent, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>use</span>
                </span>
                <span style={{ fontSize: 10, color: C.text3, fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{n.path}</span>
              </button>
            ))
        )}

        {/* WORKSPACE LIST */}
        {!loading && !searching && !err && !searchMode && level === 'ws' && (
          wsRows.length === 0
            ? <div style={{ padding: '10px 8px', fontSize: 12, color: C.text3 }}>No workspaces.</div>
            : wsRows.map(w => (
              <button key={w.id} type="button" onClick={() => openWorkspace(w)} style={rowStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: w.color || C.text3, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                {Number.isFinite(w.nodeCount) && <span style={{ fontSize: 10, color: C.text3, flexShrink: 0 }}>{w.nodeCount.toLocaleString()}</span>}
                <span style={{ color: C.text3, fontSize: 12, flexShrink: 0 }}>›</span>
              </button>
            ))
        )}

        {/* DRILL LIST (direct children) */}
        {!loading && !searching && !err && !searchMode && level === 'nodes' && (
          drillRows.length === 0
            ? <div style={{ padding: '10px 8px', fontSize: 12, color: C.text3 }}>Empty — type to search the whole workspace.</div>
            : drillRows.map(n => (
              <button key={n.id} type="button" onClick={() => onDrillRow(n)} title={n.path} style={rowStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <Badge type={n.type} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                {n.hasChildren
                  ? <span style={{ color: C.text3, fontSize: 12, flexShrink: 0 }}>›</span>
                  : <span style={{ color: C.accent, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>use</span>}
              </button>
            ))
        )}
      </div>
    </div>
  )
}

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  padding: '7px 8px', margin: '1px 0', borderRadius: R.sm, border: 'none',
  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
}
