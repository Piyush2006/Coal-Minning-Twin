import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }
const PAN = { color: '#6a7888', metalness: 0.08, roughness: 0.60 }

function GravityNozzles({ r, count }) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return (
      <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
        {/* gravity fill tube */}
        <mesh castShadow>
          <cylinderGeometry args={[0.045, 0.035, 0.55, 10]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.18, 12]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.06, 0.1, 0.1, 12]} />
          <meshStandardMaterial color="#c8d4e0" {...SS} />
        </mesh>
      </group>
    )
  })
}

export function GlassFiller({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 0.28 } = config
  const carouselRef = useRef()
  useFrame((_, dt) => {
    if (carouselRef.current && enabled && status === 'running') carouselRef.current.rotation.y += dt * speed
  })

  return (
    <group position={position} onClick={onClick}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.25, 2.25, 0.4, 40]} />
        <meshStandardMaterial {...FR} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[2.08, 2.08, 0.32, 40]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>

      {/* ROTATING CAROUSEL */}
      <group ref={carouselRef} position={[0, 1.68, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[2.05, 2.05, 2.35, 40, 1, true]} />
          <meshStandardMaterial color="#ccd8e4" {...SS} side={2} />
        </mesh>
        <mesh position={[0, 1.18, 0]} castShadow>
          <cylinderGeometry args={[2.05, 2.05, 0.12, 40]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        <mesh position={[0, -1.18, 0]} castShadow>
          <cylinderGeometry args={[2.05, 2.05, 0.12, 40]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <torusGeometry args={[1.82, 0.1, 10, 40]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
        <group position={[0, 0.6, 0]}>
          <GravityNozzles r={1.82} count={30} />
        </group>
        <mesh>
          <cylinderGeometry args={[0.28, 0.28, 2.35, 20]} />
          <meshStandardMaterial color="#c4d0dc" {...SS} />
        </mesh>
      </group>

      <mesh position={[0, 4.22, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 1.1, 14]} />
        <meshStandardMaterial color="#d4dce8" {...SS} />
      </mesh>
      <mesh position={[0, 3.68, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.22, 22]} />
        <meshStandardMaterial color="#c8d4e0" {...SS} />
      </mesh>

      {[-2.08, 2.08].map((dx, i) => (
        <mesh key={i} position={[dx, 1.12, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 2.05, 24]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      <mesh position={[0, 0.66, 0]} castShadow>
        <cylinderGeometry args={[0.72, 0.72, 0.52, 28]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      <mesh position={[2.6, 1.3, 0]} castShadow>
        <boxGeometry args={[0.62, 2.6, 1.5]} />
        <meshStandardMaterial {...PAN} />
      </mesh>
      <mesh position={[2.92, 1.42, 0]}>
        <boxGeometry args={[0.025, 0.85, 1.1]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 5.65, 0]} />
    </group>
  )
}
