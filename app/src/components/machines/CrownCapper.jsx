import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }
const PAN = { color: '#6a7888', metalness: 0.08, roughness: 0.60 }

function CrownCaps({ n = 8 }) {
  return Array.from({ length: n }, (_, i) => (
    <mesh key={i} position={[0, -0.28 + i * 0.1, 0]}>
      <cylinderGeometry args={[0.068, 0.068, 0.025, 16]} />
      <meshStandardMaterial color="#dde4ee" metalness={0.10} roughness={0.45} />
    </mesh>
  ))
}

export function CrownCapper({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 1.0 } = config
  const headRef  = useRef()
  const sortRef  = useRef()

  useFrame((_, dt) => {
    if (!enabled || status !== 'running') return
    if (headRef.current)  headRef.current.rotation.y  -= dt * speed
    if (sortRef.current)  sortRef.current.rotation.y  += dt * speed * 2.5  // sorter bowl spins faster
  })

  return (
    <group position={position} onClick={onClick}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.44, 28]} />
        <meshStandardMaterial {...FR} />
      </mesh>

      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 0.82, 28]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>

      {/* CAPPING HEAD TURRET */}
      <group ref={headRef} position={[0, 1.72, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.82, 0.82, 0.38, 28]} />
          <meshStandardMaterial color="#ccd8e4" {...SS} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <group key={i} position={[Math.cos(a) * 0.62, -0.12, Math.sin(a) * 0.62]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.045, 0.04, 0.35, 10]} />
                <meshStandardMaterial color="#d4dce8" {...SS} />
              </mesh>
              <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.04, 0.055, 0.08, 10]} />
                <meshStandardMaterial color="#c8d4e0" {...SS} />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* CROWN CAP MAGAZINE */}
      <group position={[1.1, 1.8, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.095, 0.09, 2.5, 14]} />
          <meshStandardMaterial color="#c8d4e0" {...SS} />
        </mesh>
        <CrownCaps n={12} />
        <mesh position={[-0.62, -1.1, 0]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[1.1, 0.1, 0.12]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      </group>

      <group position={[1.32, 3.45, 0]}>
        <group ref={sortRef}>
          <mesh castShadow>
            <cylinderGeometry args={[0.45, 0.35, 0.55, 24, 1, true]} />
            <meshStandardMaterial color="#c4d0dc" {...SS} side={2} />
          </mesh>
          <mesh position={[0, -0.28, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.04, 24]} />
            <meshStandardMaterial color="#b8c4d2" {...SS} />
          </mesh>
        </group>
      </group>

      {[-1.0, 1.0].map((dx, i) => (
        <mesh key={i} position={[dx, 0.78, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 1.1, 16]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      <mesh position={[-1.25, 1.25, 0]} castShadow>
        <boxGeometry args={[0.48, 1.9, 1.05]} />
        <meshStandardMaterial {...PAN} />
      </mesh>
      <mesh position={[-1.5, 1.38, 0]}>
        <boxGeometry args={[0.025, 0.68, 0.82]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 4.5, 0]} />
    </group>
  )
}
