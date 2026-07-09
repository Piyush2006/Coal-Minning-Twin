import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'
import { drumProfile } from '../geoHelpers'

const SS  = { metalness: 0.08, roughness: 0.38 }
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }
const PAN = { color: '#6a7888', metalness: 0.08, roughness: 0.60 }

const REEL_PTS = drumProfile(0.04, 0.14, 0.28, 0.32, 0.06)

function LabelReel({ position, rotation, spinning, speed = 0.8 }) {
  const ref = useRef()
  useFrame((_, dt) => {
    if (ref.current && spinning) ref.current.rotation.y += dt * speed
  })
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh castShadow>
        <latheGeometry args={[REEL_PTS, 22]} />
        <meshStandardMaterial color="#ccd4e0" {...SS} />
      </mesh>
      {/* label stock on reel */}
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.56, 22]} />
        <meshStandardMaterial color="#f5f5f0" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  )
}

export function Labeller({ position = [0, 0, 0], status = 'running', config = {}, onClick }) {
  const { enabled = true, speed = 1 } = config
  const spinning = enabled && status === 'running'
  return (
    <group position={position} onClick={onClick}>
      {/* machine bed */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.44, 1.8]} />
        <meshStandardMaterial {...FR} />
      </mesh>

      {/* main body housing */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[2.8, 1.3, 1.55]} />
        <meshStandardMaterial color="#dde4ee" {...SS} />
      </mesh>
      {/* front panel */}
      <mesh position={[0, 1.1, 0.79]}>
        <boxGeometry args={[2.75, 1.25, 0.04]} />
        <meshStandardMaterial color="#e4eaf2" {...SS} />
      </mesh>

      {/* LABEL REELS — LatheGeometry */}
      <LabelReel position={[-1.0, 2.45, 0]} rotation={[Math.PI / 2, 0, 0]} spinning={spinning} speed={0.7 * speed} />
      <LabelReel position={[-0.35, 2.45, 0]} rotation={[Math.PI / 2, 0, 0]} spinning={spinning} speed={0.6 * speed} />
      <LabelReel position={[1.0, 2.45, 0]} rotation={[Math.PI / 2, 0, 0]} spinning={spinning} speed={0.65 * speed} />
      <LabelReel position={[0.35, 2.45, 0]} rotation={[Math.PI / 2, 0, 0]} spinning={spinning} speed={0.72 * speed} />

      {/* reel mounting frame */}
      <mesh position={[0, 2.45, 0]}>
        <boxGeometry args={[2.6, 0.08, 0.1]} />
        <meshStandardMaterial color="#c4d0dc" {...SS} />
      </mesh>

      {/* glue station */}
      <group position={[-1.55, 1.22, 0.62]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.7, 16]} />
          <meshStandardMaterial color="#b8c4d0" {...SS} />
        </mesh>
        <mesh position={[0.2, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.015, 0.3, 8]} />
          <meshStandardMaterial color="#ccd4e0" {...SS} />
        </mesh>
      </group>

      {/* label application drum */}
      <group position={[0.6, 1.22, 0.72]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.88, 22]} />
          <meshStandardMaterial color="#d4dce8" {...SS} />
        </mesh>
      </group>

      {/* inspection camera */}
      <mesh position={[1.2, 1.62, 0.75]}>
        <boxGeometry args={[0.18, 0.18, 0.22]} />
        <meshStandardMaterial color="#111122" roughness={0.8} />
      </mesh>
      <mesh position={[1.2, 1.62, 0.87]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
        <meshStandardMaterial color="#1a2030" roughness={0.5} />
      </mesh>

      {/* conveyor guide rails */}
      {[-1.52, 1.52].map((dx, i) => (
        <mesh key={i} position={[dx, 0.92, 0]}>
          <boxGeometry args={[0.06, 0.04, 1.55]} />
          <meshStandardMaterial color="#b8c4d2" {...SS} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[3.05, 0.04, 0.46]} />
        <meshStandardMaterial color="#ccd4e0" {...SS} />
      </mesh>

      {/* control cabinet */}
      <mesh position={[-1.7, 1.3, -0.72]} castShadow>
        <boxGeometry args={[0.5, 2.1, 1.25]} />
        <meshStandardMaterial {...PAN} />
      </mesh>
      <mesh position={[-1.96, 1.42, -0.72]}>
        <boxGeometry args={[0.025, 0.78, 0.9]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.52} />
      </mesh>

      <StatusBeacon status={status} position={[0, 3.6, 0]} />
    </group>
  )
}
