// Live world positions of every site worker, updated each frame by SiteWorker.
// Read by the PPE-vision and proximity-safety systems (Stages 3-4). Plain
// mutable module map — the pathFillMap / loadStateMap pattern; no store, no
// re-renders. Also tracks the worker's current PPE-compliance + proximity band
// so the 3D tag/ring and the detection systems share one source.
import * as THREE from 'three'

export const workerPosMap = new Map()   // objId -> { pos: Vector3, ppeOk: bool, prox: 'ok'|'warn'|'danger' }

export function registerWorker(id) {
  if (!workerPosMap.has(id)) workerPosMap.set(id, { pos: new THREE.Vector3(), ppeOk: true, prox: 'ok' })
  return workerPosMap.get(id)
}
export function unregisterWorker(id) { workerPosMap.delete(id) }
export function workerProxState(id) { return workerPosMap.get(id)?.prox ?? 'ok' }
