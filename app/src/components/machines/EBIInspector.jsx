import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }
const PAN = { color: '#6a7888', metalness: 0.08, roughness: 0.60 }

export function EBIInspector({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, pulseRate = 4 } = config
  const lightRef = useRef()
  useFrame(({ clock }) => {
    if (!lightRef.current) return
    lightRef.current.intensity =
      (enabled && status === 'running') ? 1.2 + Math.sin(clock.elapsedTime * pulseRate) * 0.3 : 0
  })

  return (
    <group position={position} onClick={onClick}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.44, 1.1]} />
        <meshStandardMaterial {...FR} />
      </mesh>

      <mesh position={[0, 1.28, 0]} castShadow>
        <boxGeometry args={[1.88, 1.68, 0.95]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>

      {[-1.0, 1.0].map((dx, i) => (
        <group key={i} position={[dx, 1.28, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.12, 1.62, 0.9]} />
            <meshStandardMaterial color="#c8d4e0" {...SS} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <boxGeometry args={[0.12, 0.08, 0.92]} />
            <meshStandardMaterial color="#7a9ec4" metalness={0.08} roughness={0.50} />
          </mesh>
        </group>
      ))}

      {/* INTERNAL LIGHT BOOTH (visible through arch openings) */}
      <mesh position={[0, 1.22, 0]}>
        <boxGeometry args={[1.62, 1.42, 0.75]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={status === 'running' ? 0.5 : 0.02} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 1.22, 0]} color="#ffffff" intensity={1.2} distance={3} decay={2} />

      {/* CAMERA HOUSINGS — side inspection cameras (very distinctive) */}
      {[-0.5, 0, 0.5].map((dx, i) => (
        <group key={i}>
          {/* camera port side A */}
          <mesh position={[dx, 1.28, 0.52]} castShadow>
            <boxGeometry args={[0.18, 0.2, 0.22]} />
            <meshStandardMaterial color="#111122" roughness={0.8} />
          </mesh>
          <mesh position={[dx, 1.28, 0.64]}>
            <cylinderGeometry args={[0.065, 0.065, 0.04, 12]} />
            <meshStandardMaterial color="#000011" emissive="#0044aa" emissiveIntensity={status === 'running' ? 0.8 : 0.1} />
          </mesh>
          {/* camera port side B */}
          <mesh position={[dx, 1.28, -0.52]} castShadow>
            <boxGeometry args={[0.18, 0.2, 0.22]} />
            <meshStandardMaterial color="#111122" roughness={0.8} />
          </mesh>
          <mesh position={[dx, 1.28, -0.64]}>
            <cylinderGeometry args={[0.065, 0.065, 0.04, 12]} />
            <meshStandardMaterial color="#000011" emissive="#0044aa" emissiveIntensity={status === 'running' ? 0.8 : 0.1} />
          </mesh>
        </group>
      ))}

      {/* TOP CAMERA (base inspection) */}
      <mesh position={[0, 2.16, 0]}>
        <boxGeometry args={[0.5, 0.2, 0.38]} />
        <meshStandardMaterial color="#111122" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.15, 10]} />
        <meshStandardMaterial color="#000011" emissive="#0044aa" emissiveIntensity={status === 'running' ? 0.8 : 0.1} />
      </mesh>

      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[2.05, 0.04, 0.44]} />
        <meshStandardMaterial color="#ccd8e4" {...SS} />
      </mesh>
      {[-0.24, 0.24].map((dz, i) => (
        <mesh key={i} position={[0, 0.97, dz]}>
          <boxGeometry args={[2.0, 0.1, 0.04]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      <mesh position={[1.12, 0.88, 0.52]}>
        <boxGeometry args={[0.85, 0.04, 0.38]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>
      <mesh position={[0.88, 0.9, 0.32]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.06, 0.35, 0.42]} />
        <meshStandardMaterial color="#7a9ec4" metalness={0.08} roughness={0.50} />
      </mesh>

      {/* CONTROL TOWER */}
      <mesh position={[1.12, 0.7, -0.52]} castShadow>
        <boxGeometry args={[0.12, 1.38, 0.12]} />
        <meshStandardMaterial color="#c4d0dc" metalness={0.08} roughness={0.52} />
      </mesh>
      <mesh position={[1.12, 1.45, -0.52]} castShadow>
        <boxGeometry args={[0.58, 0.42, 0.12]} />
        <meshStandardMaterial {...PAN} />
      </mesh>
      <mesh position={[1.12, 1.45, -0.45]}>
        <boxGeometry args={[0.48, 0.32, 0.025]} />
        <meshStandardMaterial color="#001133" emissive="#00cc88" emissiveIntensity={0.55} />
      </mesh>

      <StatusBeacon status={status} position={[0, 3.1, 0]} />
    </group>
  )
}
