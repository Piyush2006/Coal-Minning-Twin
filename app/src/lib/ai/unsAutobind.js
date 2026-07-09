// ─────────────────────────────────────────────────────────────────────────────
// Deterministic UNS auto-bind — the reliability backbone for "match tags to an
// asset's parameters". The model is good at MAPPING an asset to a UNS node; it's
// unreliable at reproducing 8-level slug paths exactly. So the app matches an
// asset's parameters to that node's Tag children here (by normalized name), using
// the REAL paths from the API → canonical `uns:<wsId>://<path>:last` topics.
// Reuses src/lib/unsBrowse.js + src/lib/unsResolve.js.
// ─────────────────────────────────────────────────────────────────────────────
import { listChildren, findNodeByPath } from '../unsBrowse'
import { unsTopic } from '../unsResolve'
import { effectiveParamDefs } from '../parameterSchemas'

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// Pure matcher. paramDefs:[{key,label,unit?}] · tags:[{name,path}] · wsId.
// → { [paramKey]: canonicalTopic } for the params that matched a tag.
export function matchParamsToTags(paramDefs, tags, wsId) {
  const out = {}
  const cand = (tags || []).map(t => ({ path: t.path, n: norm(t.name), leaf: norm(String(t.path || '').split('/').pop()) }))
  for (const p of paramDefs || []) {
    const keys = [norm(p.key), norm(p.label)].filter(Boolean)
    let hit = cand.find(t => keys.includes(t.n) || keys.includes(t.leaf))                       // exact
    if (!hit) hit = cand.find(t => keys.some(k => (t.n && (t.n.includes(k) || k.includes(t.n))))) // substring
    if (hit) out[p.key] = unsTopic(wsId, hit.path, 'last')
  }
  return out
}

// Given a UNS node PATH (what the model annotates on an asset), resolve it to the
// node, read its Tag children, and match them to the asset's params.
// → { [paramKey]: canonicalTopic }  (empty on any failure).
export async function autobindFromPath({ token, base }, wsId, nodePath, paramDefs) {
  if (!token || !wsId || !nodePath) return {}
  try {
    const node = await findNodeByPath({ token, base }, wsId, nodePath)
    const parentId = node?.id
    if (!parentId) return {}
    const kids = await listChildren({ token, base }, wsId, parentId)
    const tags = kids.filter(n => !n.hasChildren).map(n => ({ name: n.name, path: n.path }))
    return matchParamsToTags(paramDefs, tags, wsId)
  } catch { return {} }
}

// Parse an asset's `unsRef` (either "uns:<wsId>://<path>" or { workspace, path }).
function parseRef(ref) {
  if (!ref) return null
  if (typeof ref === 'object') return ref.workspace && ref.path ? { wsId: ref.workspace, path: ref.path } : null
  const m = String(ref).match(/^uns:([^/]+):\/\/(.+?)(?::[a-z]+)?$/i)
  return m ? { wsId: m[1], path: m[2] } : null
}

// Post-process a validated Twin Spec: for every asset carrying a `unsRef`, resolve
// that UNS node's tags and write real `paramMeta.topic` bindings onto the asset.
// Best-effort + mutates the scene in place; drops the `unsRef` marker after. Returns
// the number of parameters bound.
export async function autobindScene(scene, { token, base }) {
  if (!token || !scene?.objects) return 0
  const types = scene.customAssetTypes || {}
  let bound = 0
  for (const o of Object.values(scene.objects)) {
    const ref = parseRef(o.unsRef)
    if (o.unsRef) delete o.unsRef
    if (!ref) continue
    const defs = effectiveParamDefs(o, types)
    const map = await autobindFromPath({ token, base }, ref.wsId, ref.path, defs)
    const keys = Object.keys(map)
    if (keys.length) {
      o.paramMeta = { ...(o.paramMeta || {}) }
      for (const k of keys) o.paramMeta[k] = { ...(o.paramMeta[k] || {}), topic: map[k] }
      bound += keys.length
    }
  }
  return bound
}
