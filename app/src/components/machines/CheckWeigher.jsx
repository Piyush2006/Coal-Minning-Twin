import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }
const PAN = { color: '#6a7888', metalness: 0.08, roughness: 0.60 }

export function CheckWeigher({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 0.4 } = config
  const rejectRef = useRef()
  const dir = useRef(1)

  useFrame((_, dt) => {
    if (!rejectRef.current || !enabled || status !== 'running') return
    rejectRef.current.rotation.y += dt * speed * dir.current
    if (Math.abs(rejectRef.current.rotation.y) > 0.55) dir.current *= -1
  })

  return (
    <group position={position} onClick={onClick}>
      {/* base frame */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.44, 1.0]} />
        <meshStandardMaterial {...FR} />
      </mesh>

      {/* infeed conveyor section */}
      <mesh position={[-0.55, 0.9, 0]}>
        <boxGeometry args={[0.8, 0.04, 0.45]} />
        <meshStandardMaterial color="#ccd4e0" {...SS} />
      </mesh>

      {/* WEIGH CELL housing */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.55, 0.16, 0.5]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>
      {/* weigh platter */}
      <mesh position={[0, 0.97, 0]}>
        <boxGeometry args={[0.52, 0.04, 0.46]} />
        <meshStandardMaterial color="#edf0f5" {...SS} />
      </mesh>
      {/* load cell feet */}
      {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.78, dz]}>
          <cylinderGeometry args={[0.025, 0.025, 0.14, 8]} />
          <meshStandardMaterial color="#c8d4e0" {...SS} />
        </mesh>
      ))}

      {/* outfeed conveyor section */}
      <mesh position={[0.55, 0.9, 0]}>
        <boxGeometry args={[0.8, 0.04, 0.45]} />
        <meshStandardMaterial color="#ccd4e0" {...SS} />
      </mesh>

      {/* guide rails */}
      {[-0.24, 0.24].map((dz, i) => (
        <mesh key={i} position={[0, 0.97, dz]}>
          <boxGeometry args={[2.05, 0.1, 0.04]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      {/* REJECT ARM (oscillates) */}
      <group ref={rejectRef} position={[0.7, 1.0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.08, 0.35, 0.6]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
        <mesh position={[0, 0, 0.35]}>
          <boxGeometry args={[0.06, 0.3, 0.06]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      </group>

      {/* reject chute */}
      <mesh position={[0.92, 0.65, 0.55]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.06, 0.35, 0.5]} />
        <meshStandardMaterial color="#b8c4d0" {...SS} />
      </mesh>

      {/* DISPLAY TOWER */}
      <mesh position={[0, 0.7, -0.58]} castShadow>
        <boxGeometry args={[0.12, 1.4, 0.12]} />
        <meshStandardMaterial {...FR} />
      </mesh>
      {/* display head */}
      <mesh position={[0, 1.45, -0.58]} castShadow>
        <boxGeometry args={[0.65, 0.5, 0.1]} />
        <meshStandardMaterial {...PAN} />
      </mesh>
      {/* screen */}
      <mesh position={[0, 1.45, -0.52]}>
        <boxGeometry args={[0.55, 0.38, 0.025]} />
        <meshStandardMaterial color="#001133" emissive="#00cc88" emissiveIntensity={0.55} />
      </mesh>
      {/* weight readout */}
      <mesh position={[0, 1.58, -0.52]}>
        <boxGeometry args={[0.44, 0.1, 0.025]} />
        <meshStandardMaterial color="#001133" emissive="#00ee55" emissiveIntensity={0.7} />
      </mesh>

      {/* legs */}
      {[[-0.8, -0.4], [-0.8, 0.4], [0.8, -0.4], [0.8, 0.4]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.54, dz]}>
          <cylinderGeometry args={[0.04, 0.04, 0.64, 8]} />
          <meshStandardMaterial {...FR} />
        </mesh>
      ))}
      {/* levelling pads */}
      {[[-0.8, -0.4], [-0.8, 0.4], [0.8, -0.4], [0.8, 0.4]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.22, dz]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}

      <StatusBeacon status={status} position={[0, 2.6, 0]} />
    </group>
  )
}
