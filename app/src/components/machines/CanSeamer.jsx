import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }

function SeamingHeads({ r, count }) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return (
      <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.28, 12]} />
          <meshStandardMaterial color="#dde4ee" {...SS} />
        </mesh>
        <mesh position={[0.07, -0.1, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.15, 10]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        <mesh position={[-0.07, -0.1, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.15, 10]} />
          <meshStandardMaterial color="#c8d4e0" {...SS} />
        </mesh>
      </group>
    )
  })
}

export function CanSeamer({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 0.75 } = config
  const turretRef = useRef()
  useFrame((_, dt) => {
    if (turretRef.current && enabled && status === 'running') turretRef.current.rotation.y -= dt * speed
  })

  return (
    <group position={position} onClick={onClick}>
      {/* base */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.1, 1.1, 0.44, 32]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* machine body */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.98, 0.98, 0.88, 32]} />
        <meshStandardMaterial color="#ccd8e4" {...SS} />
      </mesh>

      {/* SEAMING TURRET */}
      <group ref={turretRef} position={[0, 1.72, 0]}>
        {/* turret disc */}
        <mesh castShadow>
          <cylinderGeometry args={[0.95, 0.95, 0.42, 32]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        {/* seaming head plate */}
        <mesh position={[0, 0.24, 0]} castShadow>
          <cylinderGeometry args={[0.95, 0.95, 0.09, 32]} />
          <meshStandardMaterial color="#e4eaf2" {...SS} />
        </mesh>
        {/* seaming heads */}
        <group position={[0, 0.18, 0]}>
          <SeamingHeads r={0.76} count={10} />
        </group>
        {/* lid feed channel */}
        <mesh position={[0.5, 0.36, 0]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.85, 0.12, 0.1]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      </group>

      {/* lid magazine chute */}
      <group position={[1.15, 2.4, 0]} rotation={[0, 0, -0.5]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.075, 1.4, 14]} />
          <meshStandardMaterial color="#c8d4e0" {...SS} />
        </mesh>
        {/* lids visible as discs in chute */}
        {[0, 0.18, 0.36, 0.54].map((dy, i) => (
          <mesh key={i} position={[0, dy - 0.55, 0]}>
            <cylinderGeometry args={[0.073, 0.073, 0.02, 14]} />
            <meshStandardMaterial color="#e4eaf2" {...SS} />
          </mesh>
        ))}
      </group>

      {/* star wheel guides */}
      {[-1.05, 1.05].map((dx, i) => (
        <mesh key={i} position={[dx, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 1.4, 18]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      {/* drive housing */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.4, 20]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* control panel */}
      <mesh position={[-1.35, 1.25, 0]} castShadow>
        <boxGeometry args={[0.48, 2.0, 1.1]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.06} roughness={0.58} />
      </mesh>
      <mesh position={[-1.6, 1.38, 0]}>
        <boxGeometry args={[0.025, 0.72, 0.88]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 3.4, 0]} />
    </group>
  )
}
