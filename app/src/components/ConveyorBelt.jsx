import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ChainConveyor }  from './ChainConveyor'
import { RollerConveyor } from './RollerConveyor'
import { StatusBeacon }   from './StatusBeacon'
import { ITEM_MAP }       from '../lib/itemLibrary'

// One product riding the belt, built from an ITEM_LIBRARY descriptor.
export function ConveyorItem({ item }) {
  if (!item) return null
  if (item.shape === 'box') {
    return (
      <mesh position={[0, item.height / 2, 0]} castShadow>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial color={item.color} metalness={0.1} roughness={0.6} />
      </mesh>
    )
  }
  if (item.shape === 'can') {
    return (
      <mesh position={[0, item.height / 2, 0]} castShadow>
        <cylinderGeometry args={[item.radius, item.radius, item.height, 16]} />
        <meshStandardMaterial color={item.color} metalness={0.6} roughness={0.25} />
      </mesh>
    )
  }
  // bottle: translucent body + neck
  return (
    <group>
      <mesh position={[0, item.height * 0.4, 0]} castShadow>
        <cylinderGeometry args={[item.radius, item.radius, item.height * 0.8, 16]} />
        <meshStandardMaterial color={item.color} transparent opacity={0.6} metalness={0.1} roughness={0.15} />
      </mesh>
      <mesh position={[0, item.height * 0.9, 0]}>
        <cylinderGeometry args={[item.radius * 0.42, item.radius * 0.55, item.height * 0.28, 12]} />
        <meshStandardMaterial color={item.color} transparent opacity={0.6} metalness={0.1} roughness={0.2} />
      </mesh>
    </group>
  )
}

// Parametric, configurable conveyor belt. Rendered centered on its local origin
// so its dynamic ports (±length/2, see getPorts in machineLibrary) line up with
// the geometry as `length` changes. Drag-and-snap connects it between machines.
export function ConveyorBelt({ status = 'running', config = {} }) {
  const {
    running     = true,
    speed       = 1.2,
    beltStyle   = 'chain',
    length      = 8,
    itemType    = 'pet_bottle',
    itemSpacing = 1.4,
  } = config

  const half   = length / 2
  const item   = ITEM_MAP[itemType]
  const itemY  = beltStyle === 'roller' ? 1.20 : 0.96

  // Evenly spaced starting offsets along the belt.
  const starts = useMemo(() => {
    const n = Math.max(0, Math.floor(length / itemSpacing))
    return Array.from({ length: n }, (_, i) => -half + i * itemSpacing + itemSpacing * 0.5)
  }, [length, itemSpacing, half])

  const refs = useRef([])

  useFrame((_, dt) => {
    if (!(running && status === 'running')) return
    for (let i = 0; i < starts.length; i++) {
      const g = refs.current[i]
      if (!g) continue
      let x = g.position.x + dt * speed
      if (x > half) x -= length      // wrap around
      g.position.x = x
    }
  })

  return (
    <group>
      {beltStyle === 'roller'
        ? <RollerConveyor start={-half} end={half} z={0} />
        : <ChainConveyor  start={-half} end={half} z={0} />}

      {item && starts.map((x, i) => (
        <group key={i} ref={el => (refs.current[i] = el)} position={[x, itemY, 0]}>
          <ConveyorItem item={item} />
        </group>
      ))}

      <StatusBeacon status={status} position={[half + 0.5, 0.6, 0]} />
    </group>
  )
}
