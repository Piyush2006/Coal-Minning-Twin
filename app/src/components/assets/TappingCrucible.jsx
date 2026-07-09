import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Vacuum tapping crucible — a refractory-lined ladle on a wheeled base with a
// siphon tube, used to siphon molten aluminium from the pots. Glows when tapping.
export function TappingCrucible({ status = 'running', config = {} }) {
  const { tapping = true } = config
  const glowRef = useRef()
  useFrame(({ clock }) => {
    if (!glowRef.current) return
    glowRef.current.material.emissiveIntensity = (tapping && status === 'running')
      ? 0.7 + Math.sin(clock.elapsedTime * 3) * 0.25 : 0.05
  })
  const SHELL = { color: '#5b6470', metalness: 0.4, roughness: 0.5 }
  return (
    <group>
      {/* wheeled base */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[2.2, 0.5, 1.6]} />
        <meshStandardMaterial color="#3a3f46" metalness={0.4} roughness={0.5} />
      </mesh>
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * 0.9, 0.18, sz * 0.65]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.22, 14]} />
          <meshStandardMaterial color="#1f2228" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {/* crucible body */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[1.0, 0.85, 1.8, 28]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      {/* rim */}
      <mesh position={[0, 2.32, 0]}>
        <torusGeometry args={[1.0, 0.08, 10, 28]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#6b7480" metalness={0.45} roughness={0.4} />
      </mesh>
      {/* molten surface glow */}
      <mesh ref={glowRef} position={[0, 2.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.92, 28]} />
        <meshStandardMaterial color="#ff7a1a" emissive="#ff6a00" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      {/* siphon tube */}
      <mesh position={[0.8, 2.7, 0]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 1.8, 14]} />
        <meshStandardMaterial color="#7c8794" metalness={0.3} roughness={0.55} />
      </mesh>
    </group>
  )
}
