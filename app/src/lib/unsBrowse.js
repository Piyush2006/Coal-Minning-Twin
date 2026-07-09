// ─────────────────────────────────────────────────────────────────────────────
// UNS namespace BROWSER client (topology service — uns-backend-server.iosense.io).
// Separate from resolveAndCompute (uns.js, the DATA service): this walks the UNS
// tree so a user can pick a topic PATH by drilling workspaces → nodes, instead of
// typing "plant/line/dev/tag" by hand.
//
// Auth: Authorization: Bearer <session JWT>. That JWT comes from exchanging a
// one-time SSO token (see exchangeSSOToken in iosense.js) — and the exchange
// returns it ALREADY prefixed with "Bearer ", so we normalise (never double it).
// The session is short-lived → a 401 surfaces as { code:'auth' } so the UI can
// prompt the user to reconnect in Settings → IOsense.
//
// Endpoints (confirmed against prod):
//   GET /workspaces
//     → { items: [ { workspace: { id, name, color, nodeCount, hierarchy[] } } ] }
//   GET /workspaces/{ws}/nodes/skeleton?parent={nodeId}
//     → [ { id, type, name, path, parentId, childCount, hasChildren } ]  (DIRECT children)
//   The no-parent call returns a flattened skeleton — we filter to parentId===null
//   to get the true top level. `path` on a leaf (hasChildren:false, usually a Tag)
//   is exactly the topic string the resolve service consumes.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_UNS_BROWSE_BASE = 'https://uns-backend-server.iosense.io'

// The exchange returns the token already carrying "Bearer " — don't add a second.
function authHeader(token) {
  const t = (token || '').trim()
  if (!t) return null
  return /^bearer\s/i.test(t) ? t : `Bearer ${t}`
}

// The UNS server sends no Access-Control-Allow-Origin for our origin, so a direct
// browser fetch always fails CORS. Route the default UNS host through the
// same-origin Vite proxy (/uns-api → uns-backend-server, see vite.config) — the
// browser then calls same-origin and Vite forwards it server-side (no CORS).
// A genuinely different custom base is respected as-is.
function resolveBase(base) {
  const b = (base || DEFAULT_UNS_BROWSE_BASE).replace(/\/$/, '')
  if (b === DEFAULT_UNS_BROWSE_BASE || b.includes('uns-backend-server')) return '/uns-api'
  return b
}

async function call(base, path, token) {
  const auth = authHeader(token)
  if (!auth) { const e = new Error('No UNS session — connect IOsense in Settings.'); e.code = 'no-token'; throw e }
  const url = `${resolveBase(base)}${path}`
  let res
  try {
    res = await fetch(url, { headers: { Authorization: auth } })
  } catch { const e = new Error('Network error reaching UNS.'); e.code = 'network'; throw e }
  if (res.status === 401) { const e = new Error('UNS session expired — reconnect in Settings → IOsense.'); e.code = 'auth'; throw e }
  const json = await res.json().catch(() => null)
  if (!res.ok) { const e = new Error(json?.message || `UNS ${res.status}`); e.code = 'http'; throw e }
  return json
}

// → [{ id, name, color, nodeCount }]
export async function listWorkspaces({ token, base }) {
  const j = await call(base, '/workspaces', token)
  return (j?.items || [])
    .map(it => it?.workspace)
    .filter(Boolean)
    .map(w => ({ id: w.id, name: w.name, color: w.color, nodeCount: w.nodeCount }))
}

const mapSkeleton = (n) => ({
  id: n.id, type: n.type, name: n.name, path: n.path,
  parentId: n.parentId ?? null,
  childCount: n.childCount ?? 0,
  hasChildren: n.hasChildren ?? (n.childCount ?? 0) > 0,
})

// Direct children of a node. Pass parentId=null for the workspace root
// (the API's canonical root marker is `parent=root`, per UNS-TREE-API.md §1).
// → [{ id, type, name, path, parentId, childCount, hasChildren }]
export async function listChildren({ token, base }, wsId, parentId = null) {
  const parent = parentId || 'root'
  const j = await call(base, `/workspaces/${encodeURIComponent(wsId)}/nodes/skeleton?parent=${encodeURIComponent(parent)}`, token)
  const arr = Array.isArray(j) ? j : (j?.nodes || j?.items || [])
  return arr.map(mapSkeleton)
}

// Server-side search across the WHOLE workspace (UNS-TREE-API.md §7) — jump
// straight to a node instead of drilling. `q` = case-insensitive substring over
// name/path/tags/aliases. → [{ id, type, name, path, parentId }] (no childCount).
export async function searchNodes({ token, base }, wsId, query, { limit = 50, type, tier } = {}) {
  const q = String(query || '').trim()
  if (!q) return []
  const params = new URLSearchParams({ q, limit: String(limit) })
  if (type) params.set('type', type)
  if (tier) params.set('tier', tier)
  const j = await call(base, `/workspaces/${encodeURIComponent(wsId)}/nodes/search?${params}`, token)
  const items = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
  return items.map(n => ({ id: n.id, type: n.type, name: n.name, path: n.path, parentId: n.parentId ?? null }))
}

// Full node incl. `metadata` (legacyDevID / legacySensorID / unit) — UNS-TREE-API.md §6.
export async function getNode({ token, base }, wsId, nodeId) {
  return call(base, `/workspaces/${encodeURIComponent(wsId)}/nodes/${encodeURIComponent(nodeId)}`, token)
}

// Find a node by its EXACT path within a workspace (search `path` glob; no '*' = exact).
export async function findNodeByPath({ token, base }, wsId, path) {
  const j = await call(base, `/workspaces/${encodeURIComponent(wsId)}/nodes/search?path=${encodeURIComponent(path)}&limit=5`, token)
  const items = Array.isArray(j?.items) ? j.items : []
  return items.find(n => n.path === path) || null
}

// Resolve a topic PATH → { wsId, nodeId, devID, sensor, unit } by locating the node
// across `wsIds` and reading its metadata. Returns null if not found / unmapped.
export async function resolvePathToDevice({ token, base }, wsIds, path) {
  for (const wsId of wsIds || []) {
    let hit = null
    try { hit = await findNodeByPath({ token, base }, wsId, path) } catch { continue }
    if (!hit) continue
    let node = hit
    try { node = await getNode({ token, base }, wsId, hit.id) } catch { /* fall back to skeleton */ }
    const m = node?.metadata || {}
    return { wsId, nodeId: hit.id, devID: m.legacyDevID || null, sensor: m.legacySensorID || null, unit: m.unit || '' }
  }
  return null
}
