import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Centrifugal pump — volute housing with a spinning impeller shaft and inlet/
// outlet stubs that match the `inlet`/`outlet` utility ports.
export function Pump({ status = 'running', config = {} }) {
  const { enabled = true, speed = 1.4, color = '#3f7fa8' } = config
  const ref = useRef()

  useFrame((_, dt) => {
    if (ref.current && enabled && status === 'running') ref.current.rotation.x += dt * speed
  })

  return (
    <group>
      {/* base plate */}
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.0, 0.2, 0.7]} />
        <meshStandardMaterial color="#526070" metalness={0.2} roughness={0.5} />
      </mesh>

      {/* volute housing */}
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.4, 24]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
      </mesh>

      {/* spinning impeller shaft + vanes */}
      <group ref={ref} position={[0, 0.45, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.55, 12]} />
          <meshStandardMaterial color="#c8d4e0" metalness={0.6} roughness={0.25} />
        </mesh>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} rotation={[(i * Math.PI) / 2, 0, 0]}>
            <boxGeometry args={[0.42, 0.02, 0.16]} />
            <meshStandardMaterial color="#aab6c4" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* inlet / outlet stubs */}
      {[-0.45, 0.45].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.3, 12]} />
          <meshStandardMaterial color="#c8d4e0" metalness={0.3} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}
