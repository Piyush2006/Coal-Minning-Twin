// ─────────────────────────────────────────────────────────────────────────────
// UNS live values via the OFFICIAL resolveAndCompute API — the widget mini-engine's
// call (iosense SDK widget architecture §3/§11). This replaces the device-data
// path. Topics MUST be canonical:
//   uns:<workspaceId>://<absoluteNodePath>:<operator>   (operator: last|min|max|sum)
//
//   POST connector/api/account/uns/resolveAndCompute
//   { graph, config:[{key,topic,type?}], startTime, endTime(ms) }
//   → { data:[{ key, value }] }  |  per-item { key, error }  (e.g. "no value returned for key")
//
// Returns: { [key]: { value, error } }  — value is number|string|null; error is a
// string when the item couldn't resolve/return a value.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BASE = 'https://connector.iosense.io/api'
const DEFAULT_GRAPH = 'iosense_test_uns'   // graph is not gating; kept per the SDK spec

export async function resolveAndCompute({ token, base = DEFAULT_BASE, graph = DEFAULT_GRAPH }, items, { startTime, endTime } = {}) {
  const t = (token || '').trim()
  if (!t || !items?.length) return {}
  const bearer = /^bearer\s/i.test(t) ? t : `Bearer ${t}`
  const now = Date.now()
  const body = {
    graph,
    config: items.map(it => ({ key: it.key, topic: it.topic, ...(it.type ? { type: it.type } : {}) })),
    startTime: startTime ?? now - 86_400_000,
    endTime: endTime ?? now,
  }
  const res = await fetch(`${base.replace(/\/$/, '')}/account/uns/resolveAndCompute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: bearer },
    body: JSON.stringify(body),
  })
  if (res.status === 401) { const e = new Error('UNS session expired'); e.code = 'auth'; throw e }
  const j = await res.json().catch(() => null)
  if (!res.ok) { const e = new Error(j?.errors?.[0] || j?.message || `resolve ${res.status}`); e.code = 'http'; throw e }
  const out = {}
  for (const d of (j?.data || [])) out[d.key] = { value: d.error ? null : (d.value ?? null), error: d.error || null }
  return out
}

// Build a canonical resolveAndCompute topic from a workspace id + absolute node path.
export const unsTopic = (wsId, nodePath, operator = 'last') => `uns:${wsId}://${nodePath}:${operator}`
