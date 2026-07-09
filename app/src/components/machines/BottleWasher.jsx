import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }

export function BottleWasher({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, pulseRate = 1.2 } = config
  const steamRef = useRef()
  useFrame(({ clock }) => {
    if (!steamRef.current) return
    steamRef.current.material.opacity =
      (enabled && status === 'running') ? 0.15 + Math.sin(clock.elapsedTime * pulseRate) * 0.08 : 0
  })

  return (
    <group position={position} onClick={onClick}>
      {/* long base frame */}
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.5, 0.48, 2.2]} />
        <meshStandardMaterial {...FR} />
      </mesh>

      {/* main tunnel body */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[6.4, 2.0, 2.0]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>

      {/* insulation jacket */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[6.46, 2.06, 2.06]} />
        <meshStandardMaterial color="#e4eaf2" {...SS} transparent opacity={0.3} />
      </mesh>

      {/* inspection windows */}
      {[-3, -1.5, 0, 1.5, 3].map((dx, i) => (
        <group key={i}>
          <mesh position={[dx, 1.58, 1.06]}>
            <boxGeometry args={[0.65, 0.55, 0.04]} />
            <meshStandardMaterial color="#aaccee" transparent opacity={0.45} roughness={0.05} />
          </mesh>
          <mesh position={[dx, 1.58, -1.06]}>
            <boxGeometry args={[0.65, 0.55, 0.04]} />
            <meshStandardMaterial color="#aaccee" transparent opacity={0.45} roughness={0.05} />
          </mesh>
        </group>
      ))}

      {/* entry mouth */}
      <mesh position={[-3.35, 1.5, 0]}>
        <boxGeometry args={[0.12, 1.6, 1.5]} />
        <meshStandardMaterial color="#c8d4e0" {...SS} />
      </mesh>
      {/* entry bottle guide */}
      {[-0.4, 0.4].map((dz, i) => (
        <mesh key={i} position={[-3.44, 1.38, dz]}>
          <boxGeometry args={[0.1, 0.1, 0.06]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      {/* exit mouth */}
      <mesh position={[3.35, 1.5, 0]}>
        <boxGeometry args={[0.12, 1.6, 1.5]} />
        <meshStandardMaterial color="#c8d4e0" {...SS} />
      </mesh>

      {/* steam / hot water pipes on top */}
      {[-2.5, -1.25, 0, 1.25, 2.5].map((dx, i) => (
        <group key={i} position={[dx, 2.58, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.55, 10]} />
            <meshStandardMaterial color="#d4dce8" {...SS} />
          </mesh>
          {/* pipe cap valve */}
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.18, 0.12, 0.18]} />
            <meshStandardMaterial color="#7a9ec4" metalness={0.08} roughness={0.50} />
          </mesh>
        </group>
      ))}

      {/* longitudinal steam header pipe */}
      <mesh position={[0, 2.72, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, 6.2, 12]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ccd8e4" {...SS} />
      </mesh>

      {/* drain manifold */}
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 6.0, 10]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c8d4e0" {...SS} />
      </mesh>
      {/* drain drop legs */}
      {[-2.5, 0, 2.5].map((dx, i) => (
        <mesh key={i} position={[dx, 0.32, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.46, 8]} />
          <meshStandardMaterial color="#c4d0dc" {...SS} />
        </mesh>
      ))}

      {/* steam cloud effect */}
      <mesh ref={steamRef} position={[3.4, 2.2, 0]}>
        <sphereGeometry args={[0.55, 12, 8]} />
        <meshStandardMaterial color="#ddeeff" transparent opacity={0} />
      </mesh>

      {/* hot water tank (end) */}
      <group position={[-3.8, 1.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.55, 1.8, 1.9]} />
          <meshStandardMaterial color="#c4d0dc" {...SS} />
        </mesh>
        {/* level gauge */}
        <mesh position={[0.3, 0.1, 0]}>
          <boxGeometry args={[0.04, 1.2, 0.07]} />
          <meshStandardMaterial color="#aaccee" transparent opacity={0.6} roughness={0.05} />
        </mesh>
      </group>

      {/* control panel */}
      <mesh position={[3.65, 1.3, -0.88]} castShadow>
        <boxGeometry args={[0.52, 2.1, 1.35]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.06} roughness={0.58} />
      </mesh>
      <mesh position={[3.92, 1.42, -0.88]}>
        <boxGeometry args={[0.025, 0.85, 1.05]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 3.8, 0]} />
    </group>
  )
}
