import { useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { StencilLabel } from './StencilLabel'
import { stateMeta } from '../../lib/stateSchemas'

// Hall-Héroult prebake reduction cell. Silhouette matched to the references:
// a BOLD DARK trapezoidal superstructure cap dominates the top (control box +
// stencil + status light on the aisle-facing local +X end), with the lighter
// corrugated X-braced slant covers as a LOWER BAND, A-frame jacking trusses
// over the top, and a gas duct + per-compartment risers. Placed transverse
// (rotated 90° in the template) so +X faces the aisle and ±Z faces the row.
const LEN = 6.4, WID = 3.0
const STATUS_COLORS = { running: '#34c759', idle: '#ff9f0a', fault: '#ff3b30' }
const BAYS = [-LEN / 3, 0, LEN / 3]
const clampX = (k) => -LEN / 2 + 0.35 + (k + 0.5) * ((LEN - 0.7) / 20)

// Instanced box row — `place` (translation) or `matrixOf` (full matrix, for angled parts).
function Instanced({ count, args, color, metalness = 0.5, roughness = 0.45, place, matrixOf }) {
  const ref = useRef()
  useLayoutEffect(() => {
    if (!ref.current) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      if (matrixOf) m.copy(matrixOf(i))
      else { const [x, y, z] = place(i); m.makeTranslation(x, y, z) }
      ref.current.setMatrixAt(i, m)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [count])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </instancedMesh>
  )
}

// Lower-band galvanised slant cover with three X-braced compartments.
function Cover({ side }) {
  const COVER = { color: '#dfe5ec', metalness: 0.35, roughness: 0.42 }
  const RIB = '#9aa3ad'
  return (
    <group position={[0, 0.925, side * 1.575]} rotation={[side * 0.698, 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[LEN, 0.07, 1.63]} />
        <meshStandardMaterial {...COVER} />
      </mesh>
      {/* 3 compartments × crossed diagonals */}
      <Instanced count={6} args={[0.06, 0.06, 2.5]} color={RIB} metalness={0.4} roughness={0.45}
        matrixOf={(i) => {
          const bay = Math.floor(i / 2), dir = i % 2 === 0 ? 0.99 : -0.99
          return new THREE.Matrix4().makeTranslation(BAYS[bay], 0.05, 0)
            .multiply(new THREE.Matrix4().makeRotationY(dir))
        }} />
      {/* compartment dividers + bottom kick rail */}
      {[-3.12, -1.05, 1.05, 3.12].map((x, i) => (
        <mesh key={i} position={[x, 0.05, 0]}>
          <boxGeometry args={[0.07, 0.07, 1.6]} />
          <meshStandardMaterial color={RIB} metalness={0.4} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0.74]}>
        <boxGeometry args={[LEN, 0.09, 0.1]} />
        <meshStandardMaterial color={RIB} metalness={0.4} roughness={0.45} />
      </mesh>
    </group>
  )
}

// Bath glow strip peeking at the cap/cover seam (one per side).
function BathGlow({ side, status, showGlow, glowIntensity }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const live = status === 'running' && showGlow
    ref.current.material.emissiveIntensity = live ? (0.8 + Math.sin(clock.elapsedTime * 2.2) * 0.22) * glowIntensity : 0.05
  })
  return (
    <mesh ref={ref} position={[0, 1.46, side * 0.86]}>
      <boxGeometry args={[LEN * 0.9, 0.05, 0.18]} />
      <meshStandardMaterial color="#ff7a1a" emissive="#ff6a00" emissiveIntensity={0.8} toneMapped={false} />
    </mesh>
  )
}

export function ReductionPot({ status = 'running', state, config = {}, name = '' }) {
  const { showGlow = true, glowIntensity = 1 } = config
  const statusRef = useRef()
  useFrame(({ clock }) => {
    if (!statusRef.current) return
    const t = clock.elapsedTime
    statusRef.current.material.emissiveIntensity = status === 'fault'
      ? (Math.sin(t * 9) > 0 ? 3 : 0.1)
      : status === 'idle' ? 0.7 + Math.sin(t * 1.8) * 0.4 : 2.2
  })

  const SHELL = { color: '#363b42', metalness: 0.4, roughness: 0.55 }
  const DARK  = { color: '#23262b', metalness: 0.45, roughness: 0.5 }
  const PIPE  = { color: '#8a94a0', metalness: 0.3, roughness: 0.55 }
  // Rich per-state colour (Normal/Tapping/Anode Effect/…); pulse stays keyed on
  // the severity-derived status above. Falls back to legacy colours pre-migration.
  const statusColor = state ? stateMeta('ReductionPot', state).color : (STATUS_COLORS[status] ?? '#8e8e93')
  const label = (name || '').split(' ').pop()

  return (
    <group>
      {/* curb + shell (shell hidden behind covers/cap) */}
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <boxGeometry args={[LEN + 0.6, 0.32, WID + 2.0]} />
        <meshStandardMaterial color="#2b2e33" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[LEN, 0.9, WID]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>

      {/* lower-band slant covers */}
      <Cover side={1} />
      <Cover side={-1} />

      {/* base collector stubs + ±Z copper bus-flex lugs */}
      <Instanced count={12} args={[0.5, 0.2, 0.24]} color="#b87333" metalness={0.65} roughness={0.35}
        place={(i) => { const side = i < 6 ? 1 : -1, k = i % 6; return [-2.4 + k * 0.96, 0.32, side * 2.3] }} />
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 0.5, s * 2.0]} castShadow>
          <boxGeometry args={[1.1, 0.42, 0.34]} />
          <meshStandardMaterial color="#b87333" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      {/* ── DARK TRAPEZOIDAL SUPERSTRUCTURE CAP (the hero) ── */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <boxGeometry args={[LEN, 1.0, 1.3]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 1.62, s * 0.82]} rotation={[s * 0.55, 0, 0]} castShadow>
          <boxGeometry args={[LEN, 0.5, 0.55]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[LEN, 0.18, 0.95]} />
        <meshStandardMaterial color="#3a3f46" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* visible anode clamps along the cap/cover seam */}
      <Instanced count={40} args={[0.14, 0.34, 0.16]} color="#565c64" metalness={0.6} roughness={0.4}
        place={(i) => { const side = i < 20 ? 1 : -1, k = i % 20; return [clampX(k), 1.5, side * 0.95] }} />

      {/* bath glow at the seam */}
      {showGlow && <BathGlow side={1} status={status} showGlow={showGlow} glowIntensity={glowIntensity} />}
      {showGlow && <BathGlow side={-1} status={status} showGlow={showGlow} glowIntensity={glowIntensity} />}

      {/* ── A-FRAME jacking trusses over the cap ── */}
      <Instanced count={8} args={[0.1, 1.2, 0.1]} color="#2e333a" metalness={0.5} roughness={0.45}
        matrixOf={(i) => {
          const af = Math.floor(i / 2), side = i % 2 === 0 ? 1 : -1
          const xA = [-2.4, -0.8, 0.8, 2.4][af]
          return new THREE.Matrix4().makeTranslation(xA, 3.0, side * 0.4)
            .multiply(new THREE.Matrix4().makeRotationX(-side * 0.62))
        }} />
      <mesh position={[0, 3.55, 0]} castShadow>
        <boxGeometry args={[LEN - 0.3, 0.13, 0.13]} />
        <meshStandardMaterial color="#3a3f46" metalness={0.5} roughness={0.4} />
      </mesh>
      {[-1.8, 0, 1.8].map((x, i) => (
        <mesh key={i} position={[x, 2.6, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
          <meshStandardMaterial color="#3a3f46" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* alumina header pipe + point feeders (centre top) */}
      <mesh position={[0, 2.78, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, LEN, 14]} />
        <meshStandardMaterial {...PIPE} />
      </mesh>
      {BAYS.map((x, i) => (
        <mesh key={i} position={[x, 2.6, 0]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#5a8ec0" metalness={0.1} roughness={0.5} />
        </mesh>
      ))}

      {/* gas-collection duct (+Z side) + one riser per compartment */}
      <mesh position={[0, 2.95, 1.75]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, LEN, 16]} />
        <meshStandardMaterial {...PIPE} />
      </mesh>
      {BAYS.map((x, i) => (
        <group key={i}>
          <mesh position={[x, 1.7, 1.35]}>
            <boxGeometry args={[0.32, 0.3, 0.32]} />
            <meshStandardMaterial color="#6b7480" metalness={0.3} roughness={0.55} />
          </mesh>
          <mesh position={[x, 2.35, 1.55]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 1.4, 12]} />
            <meshStandardMaterial {...PIPE} />
          </mesh>
        </group>
      ))}

      {/* aisle-facing end (+X): control cabinet + HMI + status light + stencil */}
      <mesh position={[LEN / 2 + 0.55, 0.95, 1.0]} castShadow>
        <boxGeometry args={[0.8, 1.7, 1.1]} />
        <meshStandardMaterial color="#6a7888" metalness={0.1} roughness={0.6} />
      </mesh>
      <mesh position={[LEN / 2 + 0.96, 1.15, 1.0]}>
        <boxGeometry args={[0.03, 0.55, 0.72]} />
        <meshStandardMaterial color="#001133" emissive="#0a84ff" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh ref={statusRef} position={[LEN / 2 + 0.55, 1.92, 1.0]}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      {label && (
        <StencilLabel text={label} position={[LEN / 2 + 0.02, 2.0, 0]} rotation={[0, Math.PI / 2, 0]} />
      )}
    </group>
  )
}
