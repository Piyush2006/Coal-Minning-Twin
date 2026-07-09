import * as THREE from 'three'
import { getPorts } from './machineLibrary'

const SNAP_RADIUS = 4.0

export function worldPortPos(obj, offset) {
  const euler = new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2])
  const v = new THREE.Vector3(...offset).applyEuler(euler)
  return new THREE.Vector3(
    obj.position[0] + v.x,
    obj.position[1] + v.y,
    obj.position[2] + v.z,
  )
}

function portsCompatible(a, b) {
  if (a.type !== b.type) return false
  if (a.direction === 'bidirectional' || b.direction === 'bidirectional') return true
  return (a.direction === 'in' && b.direction === 'out') ||
         (a.direction === 'out' && b.direction === 'in')
}

// Returns snap result or null.
// { position: [x,y,z], sourcePort, targetId, targetPort }
export function findSnap(objects, draggedId) {
  const dragged = objects[draggedId]
  if (!dragged) return null

  const draggedPorts = getPorts(dragged)
  if (draggedPorts.length === 0) return null

  let best     = null
  let bestDist = SNAP_RADIUS

  for (const [id, target] of Object.entries(objects)) {
    if (id === draggedId) continue
    const targetPorts = getPorts(target)

    for (const dp of draggedPorts) {
      for (const tp of targetPorts) {
        if (!portsCompatible(dp, tp)) continue

        const wDp = worldPortPos(dragged, dp.offset)
        const wTp = worldPortPos(target, tp.offset)
        const dist = wDp.distanceTo(wTp)

        if (dist < bestDist) {
          bestDist = dist
          const delta = wTp.clone().sub(wDp)
          best = {
            position: [
              dragged.position[0] + delta.x,
              dragged.position[1] + delta.y,
              dragged.position[2] + delta.z,
            ],
            sourcePort: dp.id,
            targetId:   id,
            targetPort: tp.id,
          }
        }
      }
    }
  }

  return best
}
