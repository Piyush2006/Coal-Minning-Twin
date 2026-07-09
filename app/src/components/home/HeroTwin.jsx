import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

// Lightweight, self-contained 3D hero for the Home header — a stylised twin that
// slowly auto-rotates. Deliberately cheap: a few meshes, two lights, NO
// postprocessing / environment / grid. Transparent background.

const ACCENT = '#0a84ff'
const TEAL = '#5ac8fa'

function MachineBlock({ x, z }) {
  return (
    <group position={[x, 0.35, z]}>
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.7, 0.9]} />
        <meshStandardMaterial color="#2b3440" metalness={0.5} roughness={0.45} />
      </mesh>
      {/* emissive top strip */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[1.3, 0.06, 0.5]} />
        <meshStandardMaterial color={TEAL} emissive={TEAL} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Node({ p, delay = 0 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 2 + delay) * 0.8
  })
  return (
    <mesh ref={ref} position={p}>
      <sphereGeometry args={[0.13, 16, 12]} />
      <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.6} toneMapped={false} />
    </mesh>
  )
}

function Twin() {
  const g = useRef()
  useFrame(({ clock }) => { if (g.current) g.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.08 })
  const xs = [-2.4, -0.8, 0.8, 2.4]
  return (
    <group ref={g}>
      {/* platform */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[7.4, 0.18, 4.2]} />
        <meshStandardMaterial color="#e9edf3" metalness={0.1} roughness={0.8} />
      </mesh>
      {/* two rows of machines */}
      {xs.map((x, i) => <MachineBlock key={`a${i}`} x={x} z={-1.1} />)}
      {xs.map((x, i) => <MachineBlock key={`b${i}`} x={x} z={1.1} />)}
      {/* gantry beam across the aisle */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.4, 0.18, 4.6]} />
        <meshStandardMaterial color="#f5b50a" metalness={0.3} roughness={0.5} />
      </mesh>
      {[-2.0, 2.0].map((z, i) => (
        <mesh key={i} position={[0, 0.75, z]}>
          <boxGeometry args={[0.16, 1.5, 0.16]} />
          <meshStandardMaterial color="#8a929c" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* floating UNS nodes + links */}
      <Node p={[-2.4, 1.9, -1.1]} delay={0} />
      <Node p={[0.8, 2.2, 1.1]} delay={1.5} />
      <Node p={[2.4, 1.7, 0]} delay={3} />
    </group>
  )
}

export function HeroTwin() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [6.5, 5, 8], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <ambientLight intensity={0.7} color="#dce8f5" />
      <directionalLight position={[6, 9, 5]} intensity={1.7} color="#fff6ee" />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} color="#bcd8ff" />
      <Twin />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.9}
        minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 2.4} />
    </Canvas>
  )
}
