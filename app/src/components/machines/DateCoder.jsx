import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const PAN = { color: '#6a7888', metalness: 0.08, roughness: 0.60 }

export function DateCoder({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, pulseRate = 6 } = config
  const matRef = useRef()
  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.emissiveIntensity =
      (enabled && status === 'running') ? 0.6 + Math.sin(clock.elapsedTime * pulseRate) * 0.25 : 0.05
  })

  return (
    <group position={position} onClick={onClick}>
      <mesh position={[-0.55, 1.22, 0]} castShadow>
        <boxGeometry args={[0.1, 2.0, 0.1]} />
        <meshStandardMaterial color="#c4d0dc" metalness={0.08} roughness={0.52} />
      </mesh>
      <mesh position={[0.55, 1.22, 0]} castShadow>
        <boxGeometry args={[0.1, 2.0, 0.1]} />
        <meshStandardMaterial color="#c4d0dc" metalness={0.08} roughness={0.52} />
      </mesh>
      <mesh position={[0, 2.24, 0]} castShadow>
        <boxGeometry args={[1.22, 0.1, 0.55]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>

      {/* PRINT HEAD housing */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <boxGeometry args={[0.55, 0.35, 0.42]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>
      {/* ink reservoir */}
      <mesh position={[0.22, 1.62, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 12]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7a9ec4" metalness={0.08} roughness={0.50} />
      </mesh>

      {/* PRINT nozzle (inkjet head) */}
      <group position={[0, 1.42, 0]}>
        <mesh>
          <boxGeometry args={[0.35, 0.08, 0.08]} />
          <meshStandardMaterial ref={matRef} color="#001133" emissive="#00aaff" emissiveIntensity={0.6} />
        </mesh>
        {/* nozzle array dots */}
        {[-0.12, -0.06, 0, 0.06, 0.12].map((dx, i) => (
          <mesh key={i} position={[dx, -0.05, 0]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshStandardMaterial color="#001133" emissive="#00aaff" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>

      {/* control box */}
      <mesh position={[0.72, 0.9, 0]} castShadow>
        <boxGeometry args={[0.48, 1.4, 0.45]} />
        <meshStandardMaterial {...PAN} />
      </mesh>
      {/* display */}
      <mesh position={[0.97, 0.95, 0]}>
        <boxGeometry args={[0.025, 0.55, 0.38]} />
        <meshStandardMaterial color="#001133" emissive="#00cc88" emissiveIntensity={0.55} />
      </mesh>

      <mesh position={[0.35, 1.75, 0]} rotation={[0, 0, 0.6]}>
        <cylinderGeometry args={[0.018, 0.018, 0.85, 8]} />
        <meshStandardMaterial color="#c4d0dc" metalness={0.08} roughness={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 3.0, 0]} />
    </group>
  )
}
