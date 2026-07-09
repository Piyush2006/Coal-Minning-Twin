import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

// Pot Tending Machine — yellow double-girder overhead gantry that spans the line
// (across Z) on elevated rails and travels along the line (X). Lifts/changes all
// 40 anodes of a pot. `span` ≈ line width, `travel` ≈ how far it tracks in X.
const YEL = { color: '#f5b50a', metalness: 0.3, roughness: 0.55 }
const STL = { color: '#4a5560', metalness: 0.5, roughness: 0.45 }

export function PotTendingMachine({ status = 'running', config = {} }) {
  const { enabled = true, speed = 0.8, span = 22, travel = 32, railHeight = 7, bayLength = 80 } = config
  const ref = useRef()

  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.x = (enabled && status === 'running')
      ? Math.sin(clock.elapsedTime * 0.12 * speed) * travel : 0
  })

  const halfS = span / 2
  return (
    <group>
      {/* elevated runway rails — span the full bay */}
      {[halfS, -halfS].map((z, i) => (
        <mesh key={i} position={[0, railHeight, z]}>
          <boxGeometry args={[bayLength, 0.45, 0.5]} />
          <meshStandardMaterial {...STL} />
        </mesh>
      ))}

      {/* travelling bridge */}
      <group ref={ref}>
        {/* twin girders spanning the width (beefy) */}
        {[0.9, -0.9].map((dx, i) => (
          <mesh key={i} position={[dx, railHeight + 0.7, 0]} castShadow>
            <boxGeometry args={[1.3, 1.0, span]} />
            <meshStandardMaterial {...YEL} />
          </mesh>
        ))}
        {/* end trucks */}
        {[halfS, -halfS].map((z, i) => (
          <mesh key={i} position={[0, railHeight + 0.2, z]}>
            <boxGeometry args={[3.4, 0.8, 0.9]} />
            <meshStandardMaterial {...STL} />
          </mesh>
        ))}
        {/* orange operator cab (hangs below a girder) */}
        <mesh position={[1.8, railHeight - 0.7, halfS - 3]} castShadow>
          <boxGeometry args={[1.3, 1.3, 1.3]} />
          <meshStandardMaterial color="#e8631a" metalness={0.25} roughness={0.5} />
        </mesh>
        <mesh position={[1.8, railHeight - 0.5, halfS - 3.66]}>
          <boxGeometry args={[1.0, 0.7, 0.04]} />
          <meshStandardMaterial color="#0a2a4a" metalness={0.2} roughness={0.2} transparent opacity={0.55} />
        </mesh>
        {/* blue hoist trolleys on the girders */}
        {[5, -5].map((z, i) => (
          <mesh key={i} position={[0, railHeight + 1.0, z]} castShadow>
            <boxGeometry args={[2.2, 0.6, 1.4]} />
            <meshStandardMaterial color="#1f6fb5" metalness={0.4} roughness={0.45} />
          </mesh>
        ))}

        {/* anode-handling trolley + hoist hanging down */}
        <group position={[0, railHeight, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[2.0, 0.5, 2.4]} />
            <meshStandardMaterial {...STL} />
          </mesh>
          {[-0.7, 0.7].map((z, i) => (
            <mesh key={i} position={[0, -1.6, z]}>
              <boxGeometry args={[0.12, 3.2, 0.12]} />
              <meshStandardMaterial color="#2a2d33" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, -3.3, 0]} castShadow>
            <boxGeometry args={[1.6, 0.4, 2.2]} />
            <meshStandardMaterial color="#3a3f46" metalness={0.45} roughness={0.5} />
          </mesh>
        </group>
      </group>

      <StatusBeacon status={status} position={[0, railHeight + 1.4, -halfS]} />
    </group>
  )
}
