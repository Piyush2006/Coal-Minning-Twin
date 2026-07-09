// Flatten every object's per-object connections[] into a single global list.
// Consumed by both the flow graph (edges) and the 3D Connectors renderer.
// Returns [{ id, sourceId, targetId, sourcePort, targetPort, connectorType, connectorConfig }]
export function flattenConnections(objects) {
  const out = []
  for (const sourceId in objects) {
    const src = objects[sourceId]
    for (const c of src.connections ?? []) {
      if (!objects[c.targetId]) continue   // skip dangling (defensive; removeObject also cleans up)
      out.push({
        id: c.id,
        sourceId,
        targetId: c.targetId,
        sourcePort: c.sourcePort,
        targetPort: c.targetPort,
        connectorType: c.connectorType ?? 'pipe',
        connectorConfig: c.connectorConfig ?? {},
      })
    }
  }
  return out
}
