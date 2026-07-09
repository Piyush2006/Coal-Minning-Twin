// ─────────────────────────────────────────────────────────────────────────────
// UNS (Unified Namespace) hierarchy helpers — pure functions over the flat
// `objects` map + the `groups` map. Groups form an unlimited-depth namespace
// (Warehouse → Line → Machine); each node's UNS path is the chain of ancestor
// group names. Used by the left navigation tree, the top-bar search, group
// selection/move and the group inspector. No store imports → trivially testable.
//
//   group = { id, name, parentId, order }      parentId null = root
//   object.parentId = group id | null          object.order = sibling order
// ─────────────────────────────────────────────────────────────────────────────

import { categoryForType } from './machineLibrary'

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name))
const slug = (s) => 'grp_auto_' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Ordered direct children of a parent (groups first by order, then objects by
// order), as a flat array of { kind, id, node }.
export function childrenOf(objects, groups, parentId) {
  const childGroups = Object.values(groups)
    .filter(g => (g.parentId ?? null) === (parentId ?? null))
    .sort(byOrder)
    .map(g => ({ kind: 'group', id: g.id, node: g }))
  const childObjects = Object.values(objects)
    .filter(o => (o.parentId ?? null) === (parentId ?? null))
    .sort(byOrder)
    .map(o => ({ kind: 'object', id: o.id, node: o }))
  return [...childGroups, ...childObjects]
}

// Full nested tree from the root (parentId null). Each group node gets a
// `children` array (recursive); object nodes are leaves.
export function buildTree(objects, groups) {
  const walk = (parentId) =>
    childrenOf(objects, groups, parentId).map(c =>
      c.kind === 'group' ? { ...c, children: walk(c.id) } : c)
  return walk(null)
}

// All asset ids contained anywhere under a group (recursive).
export function descendantObjectIds(objects, groups, groupId) {
  const out = new Set()
  const walk = (gid) => {
    for (const o of Object.values(objects)) if ((o.parentId ?? null) === gid) out.add(o.id)
    for (const g of Object.values(groups)) if ((g.parentId ?? null) === gid) walk(g.id)
  }
  walk(groupId)
  return out
}

// Ancestor group names from root → node's parent (NOT including the node itself).
function ancestorNames(groups, parentId) {
  const names = []
  let cur = parentId ?? null
  const guard = new Set()
  while (cur && groups[cur] && !guard.has(cur)) {
    guard.add(cur)
    names.unshift(groups[cur].name)
    cur = groups[cur].parentId ?? null
  }
  return names
}

// Display path segments for a node, including its own name, e.g.
// ['Warehouse','Line 1','Filler 1'].
export function nodePath(objects, groups, id) {
  if (groups[id]) return [...ancestorNames(groups, groups[id].parentId), groups[id].name]
  const o = objects[id]
  if (o) return [...ancestorNames(groups, o.parentId), o.name]
  return []
}

export const displayPath = (segs) => segs.join(' / ')

// UNS topic form: lowercase, non-alphanumerics → underscore, slash-joined.
export const unsTopic = (segs) =>
  segs.map(s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')).join('/')

// Would moving `node` under `targetGroupId` create a cycle? (targetGroupId is a
// descendant of node, or is node itself.) Only meaningful when node is a group.
export function isDescendantGroup(groups, ancestorId, targetGroupId) {
  let cur = targetGroupId ?? null
  const guard = new Set()
  while (cur && !guard.has(cur)) {
    if (cur === ancestorId) return true
    guard.add(cur)
    cur = groups[cur]?.parentId ?? null
  }
  return false
}

// Max sibling order + 1 within a parent (groups and objects share one order space).
export function nextOrder(objects, groups, parentId) {
  let max = -1
  for (const g of Object.values(groups)) if ((g.parentId ?? null) === (parentId ?? null)) max = Math.max(max, g.order ?? 0)
  for (const o of Object.values(objects)) if ((o.parentId ?? null) === (parentId ?? null)) max = Math.max(max, o.order ?? 0)
  return max + 1
}

// Centroid + radius of a group's descendant assets (for camera framing).
export function groupCentroidBounds(objects, groups, groupId) {
  const ids = descendantObjectIds(objects, groups, groupId)
  const pts = [...ids].map(id => objects[id]?.position).filter(Boolean)
  if (pts.length === 0) return { center: [0, 0, 0], radius: 6 }
  const c = [0, 0, 0]
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2] }
  c[0] /= pts.length; c[1] /= pts.length; c[2] /= pts.length
  let r = 0
  for (const p of pts) {
    const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])
    if (d > r) r = d
  }
  return { center: c, radius: Math.max(6, r) }
}

// Resolve a breadcrumb of (lowercased) group-name segments to a group id by
// walking down from the root, preferring exact name matches then substrings.
// Returns null if any segment doesn't resolve. Used by the drill-down search.
export function resolveScopePath(objects, groups, segs) {
  let parentId = null, scopeId = null
  for (const seg of segs) {
    const cands = Object.values(groups).filter(g => (g.parentId ?? null) === parentId)
    const m = cands.find(g => g.name.toLowerCase() === seg) || cands.find(g => g.name.toLowerCase().includes(seg))
    if (!m) return null
    scopeId = m.id; parentId = m.id
  }
  return scopeId
}

// Normalize a scene for the hierarchy: ensure every group/object has
// `parentId` + `order`, and convert any legacy `obj.group` STRING into a real
// root group node (idempotent — deterministic group ids from the name).
export function normalizeHierarchy(objects, groups = {}) {
  const outGroups = {}
  for (const [id, g] of Object.entries(groups || {})) {
    // spread first so author-declared extras (e.g. `kpis`) survive normalization
    outGroups[id] = { ...g, id, name: g.name ?? 'Group', parentId: g.parentId ?? null, order: g.order ?? 0 }
  }
  let order = Object.keys(outGroups).length
  const groupIdForName = (name) => {
    const gid = 'grp_' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    if (!outGroups[gid]) outGroups[gid] = { id: gid, name, parentId: null, order: order++ }
    return gid
  }

  const outObjects = {}
  let idx = 0
  for (const [id, o] of Object.entries(objects || {})) {
    let parentId = o.parentId ?? null
    if (parentId == null && typeof o.group === 'string' && o.group.trim()) parentId = groupIdForName(o.group)
    outObjects[id] = { ...o, parentId, order: o.order ?? idx }
    idx++
  }

  // GUARANTEE hierarchy: any object still at the root gets bucketed into an
  // auto-group named after its library category, so the namespace is never flat.
  for (const o of Object.values(outObjects)) {
    if (o.parentId) continue
    const cat = categoryForType(o.type)
    const gid = slug(cat)
    if (!outGroups[gid]) outGroups[gid] = { id: gid, name: cat, parentId: null, order: order++ }
    o.parentId = gid
  }

  return { objects: outObjects, groups: outGroups }
}

// Search the namespace. Plain query → substring match on node names; each GROUP
// result carries a preview of its direct children (`children` + `childCount`) so
// the dropdown can show "further suggestions" / let you drill in. Query with '/'
// → path-scoped drill: the leading segments filter the ancestor path and the
// last segment filters the node name (a trailing '/' lists everything under the
// scope), e.g. `line a/` → Line A's children, `line a/pot` → its pots.
export function searchNodes(objects, groups, query, limit = 8) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []

  const decorate = (id, kind, name, score) => {
    const segs = nodePath(objects, groups, id)
    const r = { id, kind, name, path: segs, display: displayPath(segs), topic: unsTopic(segs), score }
    if (kind === 'group') {
      const kids = childrenOf(objects, groups, id)
      r.childCount = kids.length
      r.children = kids.slice(0, 6).map(c => {
        const s = nodePath(objects, groups, c.id)
        return { id: c.id, kind: c.kind, name: c.node.name, path: s, display: displayPath(s), topic: unsTopic(s) }
      })
    }
    return r
  }

  const all = [
    ...Object.values(groups).map(g => ({ id: g.id, kind: 'group', name: g.name })),
    ...Object.values(objects).map(o => ({ id: o.id, kind: 'object', name: o.name })),
  ]

  if (q.includes('/')) {
    const segs = q.split('/').map(s => s.trim())
    const leaf = segs[segs.length - 1]
    const prefix = segs.slice(0, -1).filter(Boolean)
    if (!prefix.length) return []
    const out = []
    for (const m of all) {
      const path = nodePath(objects, groups, m.id).map(s => s.toLowerCase())
      const own = path[path.length - 1] ?? ''
      const ancestors = path.slice(0, -1)
      if (leaf && !own.includes(leaf)) continue
      if (ancestors.length < prefix.length) continue
      const tail = ancestors.slice(ancestors.length - prefix.length)
      let ok = true
      for (let i = 0; i < prefix.length; i++) if (!tail[i].includes(prefix[i])) { ok = false; break }
      if (!ok) continue
      out.push(decorate(m.id, m.kind, m.name, 100 - path.length))
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  const scored = []
  for (const m of all) {
    const name = m.name.toLowerCase()
    const idx = name.indexOf(q)
    if (idx < 0) continue
    const score = idx === 0 ? 3 : /\s/.test(name[idx - 1] || '') ? 2 : 1
    scored.push(decorate(m.id, m.kind, m.name, score))
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit)
}
