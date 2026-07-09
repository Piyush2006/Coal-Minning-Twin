import { useEffect, useMemo, useState } from 'react'
import { UNSPathInput } from '@faclon-labs/design-sdk/UNSPathInput'
import { useAIStore } from '../store/aiStore'
import { listWorkspaces, listChildren } from '../lib/unsBrowse'
import { C } from '../ui/theme'

// ── UNS binding field — the OFFICIAL design-sdk UNSPathInput ────────────────
// Replaces the custom slash-browser: the SDK component provides type-"/"-to-
// browse tree navigation over a nested path tree. We feed it the namespace tree
// (workspaces → nodes via the browse API, cached per session) and translate
// between its `{{wsName/path}}` display bindings and the canonical topics the
// resolver consumes (`uns:<wsId>://<path>:last`).

const _cache = new Map()   // `${base}|${token}` → Promise<{ tree, wsByName, wsById }>
const MAX_NODES_PER_WS = 600
const MAX_DEPTH = 7

async function buildTree(ctx) {
  const wss = await listWorkspaces(ctx)
  const tree = {}, wsByName = {}, wsById = {}
  for (const ws of (wss || []).slice(0, 6)) {
    wsByName[ws.name] = ws.id
    wsById[ws.id] = ws.name
    const root = {}
    tree[ws.name] = root
    let count = 0
    const walk = async (parentId, into, depth) => {
      if (depth > MAX_DEPTH || count > MAX_NODES_PER_WS) return
      let kids = []
      try { kids = await listChildren(ctx, ws.id, parentId) } catch { return }
      for (const k of kids) {
        if (++count > MAX_NODES_PER_WS) return
        if (k.hasChildren) { into[k.name] = {}; await walk(k.id, into[k.name], depth + 1) }
        else into[k.name] = null
      }
    }
    await walk(null, root, 1)
  }
  return { tree, wsByName, wsById }
}

function loadTree(token, base) {
  const key = `${base}|${token}`
  if (!_cache.has(key)) _cache.set(key, buildTree({ token, base }).catch((e) => { _cache.delete(key); throw e }))
  return _cache.get(key)
}

// canonical `uns:wsId://path:op` → display `{{wsName/path}}`
function canonicalToDisplay(topic, wsById) {
  const m = /^uns:([^:]+):\/\/(.+?)(?::[a-z_]+)?$/i.exec(topic || '')
  if (!m) return topic || ''
  return `{{${wsById[m[1]] || m[1]}/${m[2]}}}`
}
// display `{{wsName/path}}` → canonical (first segment = workspace); anything
// else (raw canonical topic, plain path, partial typing) passes through as-is.
function displayToCanonical(v, wsByName) {
  const m = /^\{\{(.+)\}\}$/.exec((v || '').trim())
  if (!m) return v
  const segs = m[1].split('/').filter(Boolean)
  const wsId = wsByName[segs[0]]
  return wsId && segs.length > 1 ? `uns:${wsId}://${segs.slice(1).join('/')}:last` : v
}

export function UnsPathField({ topic, onTopic }) {
  const token = useAIStore((s) => s.iosenseJWT || s.unsBrowseToken)   // platform session powers UNS
  const base = useAIStore((s) => s.unsBrowseBaseUrl)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let live = true
    setErr(null)
    if (!token) return
    loadTree(token, base).then((d) => { if (live) setData(d) }).catch((e) => { if (live) setErr(e.message) })
    return () => { live = false }
  }, [token, base])

  const display = useMemo(() => (data ? canonicalToDisplay(topic, data.wsById) : topic || ''), [topic, data])

  // Fallback paste field while unconnected / loading / on browse errors —
  // manual canonical topics still work.
  if (!token || err || !data) {
    return (
      <input value={topic || ''} onChange={(e) => onTopic(e.target.value)}
        placeholder={!token ? 'connect IOsense in Settings, or paste a topic' : err ? 'namespace unavailable — paste a topic' : 'loading namespace…'}
        style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: `1px solid ${topic ? C.accent : C.line}`, borderRadius: 6,
          fontFamily: 'ui-monospace, monospace', fontSize: 11, color: C.text, background: C.surface, outline: 'none' }} />
    )
  }

  return (
    <UNSPathInput
      tree={data.tree}
      label="UNS Path"
      helpText="Type / to browse the namespace"
      value={display}
      onChange={(v) => onTopic(displayToCanonical(v, data.wsByName))}
    />
  )
}
