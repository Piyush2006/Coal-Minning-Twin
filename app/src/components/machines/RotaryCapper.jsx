import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }

function CappingHeads({ r, count }) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return (
      <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.055, 0.38, 12]} />
          <meshStandardMaterial color="#dde4ee" {...SS} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.2, 10]} />
          <meshStandardMaterial color="#c8d4e0" {...SS} />
        </mesh>
      </group>
    )
  })
}

export function RotaryCapper({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 0.55 } = config
  const turretRef = useRef()
  const bowlRef   = useRef()

  useFrame((_, dt) => {
    if (!enabled || status !== 'running') return
    if (turretRef.current) turretRef.current.rotation.y -= dt * speed
    if (bowlRef.current)   bowlRef.current.rotation.y   += dt * speed * 2.18  // bowl spins faster than turret
  })

  return (
    <group position={position} onClick={onClick}>
      {/* base */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.44, 36]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* main machine body */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[1.35, 1.35, 1.12, 36]} />
        <meshStandardMaterial color="#ccd8e4" {...SS} />
      </mesh>

      {/* CAPPING TURRET (rotates) */}
      <group ref={turretRef} position={[0, 1.98, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[1.28, 1.28, 0.5, 36]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[1.28, 1.28, 0.08, 36]} />
          <meshStandardMaterial color="#dde4ee" {...SS} />
        </mesh>
        <group position={[0, 0.22, 0]}>
          <CappingHeads r={1.08} count={12} />
        </group>
      </group>

      {/* star wheel guides */}
      {[-1.35, 1.35].map((dx, i) => (
        <mesh key={i} position={[dx, 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 1.0, 20]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      {/* CAP BOWL FEEDER */}
      <group position={[1.85, 0, -1.2]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.6, 0.8, 28]} />
          <meshStandardMaterial color="#c4d0dc" {...SS} />
        </mesh>
        <group ref={bowlRef} position={[0, 0.85, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.68, 0.55, 0.55, 28, 1, true]} />
            <meshStandardMaterial color="#d4dce8" {...SS} side={2} />
          </mesh>
          <mesh position={[0, -0.28, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.04, 28]} />
            <meshStandardMaterial color="#c8d4e0" {...SS} />
          </mesh>
        </group>
        {/* cap chute to turret */}
        <mesh position={[-0.82, 1.5, 0.55]} rotation={[0, 0.5, -0.35]} castShadow>
          <boxGeometry args={[0.12, 1.6, 0.1]} />
          <meshStandardMaterial color="#ccd4e0" {...SS} />
        </mesh>
      </group>

      {/* drive motor housing */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.45, 22]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* control panel */}
      <mesh position={[-1.72, 1.3, 0]} castShadow>
        <boxGeometry args={[0.5, 2.2, 1.2]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.06} roughness={0.58} />
      </mesh>
      <mesh position={[-1.98, 1.42, 0]}>
        <boxGeometry args={[0.025, 0.75, 0.95]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 4.0, 0]} />
    </group>
  )
}
