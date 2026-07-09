// ─────────────────────────────────────────────────────────────────────────────
// UNS context for the in-app assistant (Bruce). Bruce is single-shot / not agentic,
// so the APP fetches UNS structure and injects it into the system prompt. Two levels:
//   1. always-on: the workspace LIST (tiny — scales past 96k nodes without dumping).
//   2. on demand: when Bruce returns mode:"uns_query", the app runs targeted
//      searchNodes calls and re-prompts with the matching nodes (real paths).
// Reuses src/lib/unsBrowse.js.
// ─────────────────────────────────────────────────────────────────────────────
import { listWorkspaces, searchNodes } from '../unsBrowse'

// Always-on: compact workspace list → [{ id, name, nodeCount }].
export async function fetchWorkspaceList({ token, base }) {
  if (!token) return []
  try {
    const ws = await listWorkspaces({ token, base })
    return ws.map(w => ({ id: w.id, name: w.name, nodeCount: w.nodeCount }))
  } catch { return [] }
}

// On demand: run the searches Bruce asked for. queries = [{ workspace, q, type?, tier? }].
// → [{ workspace, q, matches: [{ path, type, name }] }]  (real paths, capped).
export async function runQueries({ token, base }, queries, { perQuery = 25 } = {}) {
  if (!token || !Array.isArray(queries)) return []
  const out = []
  for (const req of queries.slice(0, 8)) {
    const wsId = req?.workspace
    const q = req?.q
    if (!wsId || !q) continue
    try {
      const rows = await searchNodes({ token, base }, wsId, q, { limit: perQuery, type: req.type, tier: req.tier })
      out.push({ workspace: wsId, q, matches: rows.map(n => ({ path: n.path, type: n.type, name: n.name })) })
    } catch (e) {
      out.push({ workspace: wsId, q, error: e.message })
    }
  }
  return out
}

// Token-light text block for the system prompt.
export function formatUnsContext({ workspaces = [], queryResults = null } = {}) {
  const lines = []
  if (workspaces.length) {
    lines.push('Workspaces (use the id as <workspaceId> in topics `uns:<workspaceId>://<path>:last`):')
    for (const w of workspaces) lines.push(`  ${w.id} · ${w.name}${Number.isFinite(w.nodeCount) ? ` · ${w.nodeCount} nodes` : ''}`)
    lines.push('To see actual tags/paths, return mode:"uns_query" with queries:[{workspace,q,type?}] — the app runs the search and returns matching nodes.')
  } else {
    lines.push('No UNS session connected — UNS binding/build unavailable until the user connects IOsense in Settings.')
  }
  if (Array.isArray(queryResults)) {
    lines.push('\nSearch results (real paths — bind topics as `uns:<workspace>://<path>:last`; only use paths that appear here):')
    for (const r of queryResults) {
      lines.push(`  [${r.workspace}] q="${r.q}"${r.error ? ` — error: ${r.error}` : ''}`)
      for (const m of (r.matches || []).slice(0, 40)) lines.push(`    ${m.type} · ${m.name} → ${m.path}`)
      if (!r.error && !(r.matches || []).length) lines.push('    (no matches)')
    }
  }
  return lines.join('\n')
}
