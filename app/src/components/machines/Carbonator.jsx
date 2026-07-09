import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { StatusBeacon } from '../StatusBeacon'

// Monochromatic white industrial palette
const SS  = { color: '#edf0f5', metalness: 0.08, roughness: 0.38 }  // body panels
const FR  = { color: '#526070', metalness: 0.18, roughness: 0.50 }  // frame / structure
const PIP = { color: '#d4dce8', metalness: 0.10, roughness: 0.46 }  // pipes / conduit

function PressureVessel({ r, h, color = '#edf0f5' }) {
  const mat = { color, metalness: 0.08, roughness: 0.38 }
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, h, 36]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <sphereGeometry args={[r, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0, -h / 2, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <sphereGeometry args={[r, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  )
}

export function Carbonator({ position = [0, 0, 0], status = 'running', config = {}, label = 'Carbonator', onClick }) {
  const { enabled = true, pulseRate = 0.8 } = config
  const gaugeRef = useRef()
  useFrame(({ clock }) => {
    if (!gaugeRef.current) return
    gaugeRef.current.material.emissiveIntensity = (enabled && status === 'running')
      ? 0.5 + Math.sin(clock.elapsedTime * pulseRate) * 0.15
      : 0.1
  })

  return (
    <group position={position} onClick={onClick}>
      {/* base frame */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.44, 2.2]} />
        <meshStandardMaterial {...FR} />
      </mesh>
      {/* 4 support legs */}
      {[[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.1, z]} castShadow>
          <boxGeometry args={[0.1, 1.88, 0.1]} />
          <meshStandardMaterial {...FR} />
        </mesh>
      ))}
      {/* base cross-braces */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.6, 0.06, 0.08]} />
        <meshStandardMaterial {...FR} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.08, 0.06, 1.6]} />
        <meshStandardMaterial {...FR} />
      </mesh>

      {/* PRESSURE VESSEL */}
      <group position={[0, 3.1, 0]}>
        <PressureVessel r={0.82} h={2.6} />
        {/* weld seam ring */}
        <mesh position={[0, 0.4, 0]}>
          <torusGeometry args={[0.825, 0.018, 8, 36]} />
          <meshStandardMaterial color="#dde4ee" metalness={0.08} roughness={0.48} />
        </mesh>
        {/* insulation bands */}
        {[-0.7, 0, 0.7].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <cylinderGeometry args={[0.86, 0.86, 0.12, 36]} />
            <meshStandardMaterial color="#e4eaf2" metalness={0.06} roughness={0.52} />
          </mesh>
        ))}
      </group>

      {/* CO2 supply pipe (top) */}
      <mesh position={[0, 5.0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 1.2, 10]} />
        <meshStandardMaterial {...PIP} />
      </mesh>
      {/* CO2 valve */}
      <mesh position={[0, 5.65, 0]}>
        <boxGeometry args={[0.22, 0.16, 0.22]} />
        <meshStandardMaterial color="#7a9ec4" metalness={0.08} roughness={0.50} />
      </mesh>

      {/* product in pipe */}
      <mesh position={[-0.88, 2.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.55, 10]} />
        <meshStandardMaterial {...PIP} />
      </mesh>
      {/* product out pipe */}
      <mesh position={[0.88, 2.0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.55, 10]} />
        <meshStandardMaterial {...PIP} />
      </mesh>

      {/* pressure gauge */}
      <mesh ref={gaugeRef} position={[0.88, 3.5, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#001133" emissive="#00cc88" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.95, 3.5, 0]}>
        <boxGeometry args={[0.04, 0.22, 0.22]} />
        <meshStandardMaterial color="#c8d0dc" metalness={0.08} roughness={0.48} />
      </mesh>

      {/* safety relief valve (top) */}
      <mesh position={[0.3, 4.45, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.35, 10]} />
        <meshStandardMaterial {...PIP} />
      </mesh>
      <mesh position={[0.3, 4.64, 0]}>
        <cylinderGeometry args={[0.12, 0.08, 0.08, 12]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.08} roughness={0.52} />
      </mesh>

      {/* temperature sensor */}
      <mesh position={[-0.3, 3.0, 0.84]}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#c8d0dc" metalness={0.10} roughness={0.48} />
      </mesh>

      {/* control panel */}
      <mesh position={[1.22, 1.5, 0]} castShadow>
        <boxGeometry args={[0.5, 2.0, 1.4]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.06} roughness={0.58} />
      </mesh>
      <mesh position={[1.48, 1.62, 0]}>
        <boxGeometry args={[0.025, 0.8, 1.0]} />
        <meshStandardMaterial color="#001133" emissive="#0055cc" emissiveIntensity={0.5} />
      </mesh>

      <StatusBeacon status={status} position={[0, 6.5, 0]} />
    </group>
  )
}
