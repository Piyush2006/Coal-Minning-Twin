import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }

function CanNozzles({ r, count }) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return (
      <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.055, 0.038, 0.42, 10]} />
          <meshStandardMaterial color="#dde4ee" {...SS} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <cylinderGeometry args={[0.055, 0.08, 0.1, 12]} />
          <meshStandardMaterial color="#e4eaf2" {...SS} />
        </mesh>
      </group>
    )
  })
}

export function CanFiller({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 0.55 } = config
  const carouselRef = useRef()
  useFrame((_, dt) => {
    if (carouselRef.current && enabled && status === 'running') carouselRef.current.rotation.y += dt * speed
  })

  return (
    <group position={position} onClick={onClick}>
      {/* base / drip tray */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.85, 1.85, 0.36, 36]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* machine body */}
      <mesh position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[1.68, 1.68, 0.28, 36]} />
        <meshStandardMaterial color="#ccd8e4" {...SS} />
      </mesh>

      {/* ROTATING CAROUSEL */}
      <group ref={carouselRef} position={[0, 1.52, 0]}>
        {/* outer shroud */}
        <mesh castShadow>
          <cylinderGeometry args={[1.58, 1.58, 1.85, 36, 1, true]} />
          <meshStandardMaterial color="#e8ecf4" {...SS} side={2} />
        </mesh>
        {/* top plate */}
        <mesh position={[0, 0.92, 0]} castShadow>
          <cylinderGeometry args={[1.58, 1.58, 0.09, 36]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        {/* bottom plate */}
        <mesh position={[0, -0.92, 0]} castShadow>
          <cylinderGeometry args={[1.58, 1.58, 0.09, 36]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        {/* manifold ring */}
        <mesh position={[0, 0.75, 0]}>
          <torusGeometry args={[1.4, 0.065, 8, 36]} />
          <meshStandardMaterial color="#ccd4e0" {...SS} />
        </mesh>
        {/* filling nozzles */}
        <group position={[0, 0.52, 0]}>
          <CanNozzles r={1.4} count={28} />
        </group>
        {/* central column */}
        <mesh>
          <cylinderGeometry args={[0.18, 0.18, 1.85, 16]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      </group>

      {/* CO2 pressure pipe overhead */}
      <mesh position={[0, 3.55, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.88, 12]} />
        <meshStandardMaterial color="#d4dce8" {...SS} />
      </mesh>

      {/* star wheel guides */}
      {[-1.6, 1.6].map((dx, i) => (
        <mesh key={i} position={[dx, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 1.65, 20]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      {/* drive housing */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.48, 24]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* control cabinet */}
      <mesh position={[2.12, 1.28, 0]} castShadow>
        <boxGeometry args={[0.58, 2.5, 1.4]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.06} roughness={0.58} />
      </mesh>
      <mesh position={[2.42, 1.38, 0]}>
        <boxGeometry args={[0.025, 0.82, 1.05]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 4.8, 0]} />
    </group>
  )
}
