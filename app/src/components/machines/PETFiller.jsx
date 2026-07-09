import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }

function FillingNozzles({ r, count }) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return (
      <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.038, 0.024, 0.52, 10]} />
          <meshStandardMaterial color="#dde4ee" {...SS} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <boxGeometry args={[0.08, 0.12, 0.08]} />
          <meshStandardMaterial color="#5a8ec0" metalness={0.08} roughness={0.52} />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.024, 0.012, 0.08, 8]} />
          <meshStandardMaterial color="#e4eaf2" {...SS} />
        </mesh>
      </group>
    )
  })
}

export function PETFiller({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 0.38 } = config
  const carouselRef = useRef()
  useFrame((_, dt) => {
    if (carouselRef.current && enabled && status === 'running') carouselRef.current.rotation.y += dt * speed
  })

  return (
    <group position={position} onClick={onClick}>
      {/* base / drip tray */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.35, 2.35, 0.36, 40]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* machine bed */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[2.1, 2.1, 0.28, 40]} />
        <meshStandardMaterial color="#ccd8e4" {...SS} />
      </mesh>

      {/* ROTATING CAROUSEL */}
      <group ref={carouselRef} position={[0, 1.7, 0]}>
        {/* outer shroud */}
        <mesh castShadow>
          <cylinderGeometry args={[1.98, 1.98, 2.2, 40, 1, true]} />
          <meshStandardMaterial color="#e8ecf4" {...SS} side={2} />
        </mesh>
        {/* top plate */}
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[1.98, 1.98, 0.1, 40]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        {/* bottom plate */}
        <mesh position={[0, -1.1, 0]} castShadow>
          <cylinderGeometry args={[1.98, 1.98, 0.1, 40]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
        {/* product manifold ring */}
        <mesh position={[0, 0.92, 0]}>
          <torusGeometry args={[1.78, 0.07, 8, 40]} />
          <meshStandardMaterial color="#ccd4e0" {...SS} />
        </mesh>
        {/* filling nozzles */}
        <group position={[0, 0.65, 0]}>
          <FillingNozzles r={1.78} count={36} />
        </group>
        {/* central column */}
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 2.2, 18]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      </group>

      {/* overhead product supply pipe */}
      <mesh position={[0, 4.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1.0, 14]} />
        <meshStandardMaterial color="#d4dce8" {...SS} />
      </mesh>
      {/* swivel coupling */}
      <mesh position={[0, 3.62, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.18, 20]} />
        <meshStandardMaterial color="#e4eaf2" {...SS} />
      </mesh>

      {/* infeed star wheel guide */}
      <mesh position={[-2.0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 2.0, 24]} />
        <meshStandardMaterial color="#b8c4d2" {...SS} />
      </mesh>
      {/* outfeed star wheel guide */}
      <mesh position={[2.0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 2.0, 24]} />
        <meshStandardMaterial color="#b8c4d2" {...SS} />
      </mesh>

      {/* drip deflector skirt */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[2.08, 2.28, 0.18, 40, 1, true]} />
        <meshStandardMaterial color="#ccd8e4" {...SS} side={2} />
      </mesh>

      {/* drive unit housing */}
      <mesh position={[0, 0.64, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.65, 0.52, 28]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* control cabinet */}
      <mesh position={[2.5, 1.3, 0]} castShadow>
        <boxGeometry args={[0.62, 2.6, 1.5]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.06} roughness={0.58} />
      </mesh>
      <mesh position={[2.82, 1.42, 0]}>
        <boxGeometry args={[0.025, 0.85, 1.1]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 5.5, 0]} />
    </group>
  )
}
