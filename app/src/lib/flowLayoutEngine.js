// Layered (left-to-right) auto-layout for the process-flow graph.
// Pure: takes the scene `objects` map and returns { [id]: {x, y} } 2D positions.
// Column = longest-path depth from a root; row = order within the column.
// Dependency-free — no dagre/elk.

import { flattenConnections } from './connectionSelectors'

const COL_PITCH = 260   // horizontal gap between layers
const ROW_PITCH = 150   // vertical gap between siblings in a layer

export function layeredLayout(objects, opts = {}) {
  const colPitch = opts.colPitch ?? COL_PITCH
  const rowPitch = opts.rowPitch ?? ROW_PITCH

  const ids = Object.keys(objects)
  if (!ids.length) return {}

  // Build adjacency (source → targets) + indegree from the flat connection list.
  const out = new Map(ids.map(id => [id, []]))
  const indeg = new Map(ids.map(id => [id, 0]))
  for (const c of flattenConnections(objects)) {
    if (!out.has(c.sourceId) || !out.has(c.targetId)) continue
    out.get(c.sourceId).push(c.targetId)
    indeg.set(c.targetId, indeg.get(c.targetId) + 1)
  }

  // Longest-path layering. Roots (no inbound) start at layer 0; a node's layer is
  // max(layer(predecessor)) + 1. Cycle-safe via a visited-on-stack guard.
  const layer = new Map(ids.map(id => [id, 0]))
  const onStack = new Set()
  const visit = (id) => {
    if (onStack.has(id)) return layer.get(id)   // cycle — don't recurse
    onStack.add(id)
    for (const t of out.get(id)) {
      if (layer.get(t) < layer.get(id) + 1) {
        layer.set(t, layer.get(id) + 1)
        visit(t)
      }
    }
    onStack.delete(id)
    return layer.get(id)
  }
  // Seed from roots first, then any remaining (covers fully-cyclic islands).
  ids.filter(id => indeg.get(id) === 0).forEach(visit)
  ids.forEach(visit)

  // Group ids by layer; keep a stable order (existing y if any, else insertion order).
  const byCol = new Map()
  for (const id of ids) {
    const col = layer.get(id)
    if (!byCol.has(col)) byCol.set(col, [])
    byCol.get(col).push(id)
  }

  const pos = {}
  let maxRows = 0
  for (const rows of byCol.values()) maxRows = Math.max(maxRows, rows.length)
  const midY = ((maxRows - 1) * rowPitch) / 2

  for (const [col, rows] of byCol) {
    // center each column vertically around midY
    const colMid = ((rows.length - 1) * rowPitch) / 2
    rows.forEach((id, row) => {
      pos[id] = { x: col * colPitch, y: midY - colMid + row * rowPitch }
    })
  }
  return pos
}
