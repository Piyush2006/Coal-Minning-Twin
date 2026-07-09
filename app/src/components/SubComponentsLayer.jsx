import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PartGeometry } from './CompositeAsset'
import { resolveLayout, subInstanceValue, subInstanceColor } from '../lib/componentSubs'

// Renders one sub-component definition's instances at their resolved layout.
//  • pickable=false (main scene): a single InstancedMesh — cheap, decorative.
//  • pickable=true  (details view): individual meshes, clickable + state-tinted.

function InstancedBoxes({ instances, dims, material = {} }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    instances.forEach((inst, i) => {
      o.position.set(...inst.position)
      o.rotation.set(...(inst.rotation || [0, 0, 0]))
      o.scale.set(...(inst.scale || [1, 1, 1]))
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [instances])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, instances.length]} castShadow receiveShadow>
      <boxGeometry args={[dims.width ?? 0.2, dims.height ?? 0.2, dims.depth ?? 0.2]} />
      {/* polygonOffset biases these mounted slits/anodes to win the depth test over
          the surface they sit flush against → no coplanar z-fighting. */}
      <meshStandardMaterial color={material.color ?? '#1a3550'} metalness={material.metalness ?? 0.5} roughness={material.roughness ?? 0.4}
        polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </instancedMesh>
  )
}

export function SubComponentsLayer({ obj, def, pickable = false, selectedIndex = -1, onPick }) {
  const instances = useMemo(() => resolveLayout(def.layout, def.count), [def])

  if (!pickable) {
    // Scene: instanced boxes (windows etc.). Only box parts are instanced; others skip.
    if ((def.part?.geometry ?? 'box') !== 'box') return null
    return <InstancedBoxes instances={instances} dims={def.part?.dims || {}} material={def.part?.material || {}} />
  }

  // Details: individual, pickable, tinted by per-instance state.
  return (
    <group>
      {instances.map(inst => {
        const { state } = subInstanceValue(def, inst.index, obj)
        const color = subInstanceColor(def, state)
        const on = inst.index === selectedIndex
        return (
          <mesh key={inst.index} position={inst.position} rotation={inst.rotation} castShadow receiveShadow
            onClick={(e) => { e.stopPropagation(); onPick?.(def.id, inst.index) }}>
            <PartGeometry part={def.part} />
            <meshStandardMaterial color={color} metalness={def.part?.material?.metalness ?? 0.4} roughness={def.part?.material?.roughness ?? 0.5}
              emissive={on ? color : '#000000'} emissiveIntensity={on ? 0.9 : 0}
              polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
          </mesh>
        )
      })}
    </group>
  )
}
