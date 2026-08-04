// Restricted-zone layer. Renders each hazard zone (safety-1.config.restrictedZones)
// as a ground outline + faint fill + label, and detects any worker standing inside
// it. Detection is ALWAYS on (it feeds the liveSafety bridge → safety-1
// unauthorizedEvent / restrictedZone / unauthorizedEntriesToday → the existing
// "unauth" alertRule → Worker Safety row); the VISUALS are gated on the safety
// layer so the base scene is unchanged. One worker crossing in = one counter
// increment = one alert, in the twin and the dashboard together.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { useSafetyLayer } from '../../lib/safetyLayer'
import { workerPosMap } from '../../lib/workerPosMap'
import { liveSafety, seedCounters } from '../../lib/liveSafety'

const RING_GEO = new THREE.RingGeometry(0.94, 1, 72)   // unit annulus, scaled to radius
const FILL_GEO = new THREE.CircleGeometry(0.985, 72)

export function RestrictedZones() {
  const on = useSafetyLayer(s => s.on)
  const zones = useSceneStore(s => s.objects['safety-1']?.config?.restrictedZones)
  const occupied = useRef(new Map())          // zoneName -> bool (edge detection for the counter)
  const ringMats = useRef([])                 // per-zone ring material refs (pulse)

  const list = useMemo(() => (Array.isArray(zones) ? zones.filter(z => Array.isArray(z.center) && z.radius > 0) : []), [zones])

  useFrame(({ clock }) => {
    if (!list.length) return
    seedCounters(useSceneStore.getState().objects['safety-1']?.parameters)
    let anyInside = false, hitZone = null
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4)
    for (let zi = 0; zi < list.length; zi++) {
      const z = list[zi]
      const cx = z.center[0], cz = z.center[2], r = z.radius
      let inside = false
      for (const [, w] of workerPosMap) {
        const dx = w.pos.x - cx, dz = w.pos.z - cz
        if (dx * dx + dz * dz <= r * r) { inside = true; break }
      }
      // edge: worker just entered → one counter increment
      const was = occupied.current.get(z.name) || false
      if (inside && !was) {
        liveSafety.unauthorizedEntriesToday = (liveSafety.unauthorizedEntriesToday || 0) + 1
      }
      occupied.current.set(z.name, inside)
      if (inside) { anyInside = true; hitZone = z.name }
      // pulse the ring red while occupied (visuals only)
      const m = ringMats.current[zi]
      if (m) {
        m.color.set(inside ? '#F04438' : '#F79009')
        m.opacity = inside ? 0.55 + 0.4 * pulse : 0.42
      }
    }
    // bridge: live restricted-zone occupancy replaces stepSafety's synthetic walk
    liveSafety.unauthorizedEvent = anyInside ? 1 : 0
    if (hitZone) liveSafety.restrictedZone = hitZone
  })

  if (!on || !list.length) return null
  return (
    <group>
      {list.map((z, i) => (
        <group key={z.name} position={[z.center[0], (z.center[1] ?? 0) + 0.05, z.center[2]]}>
          <mesh geometry={RING_GEO} rotation={[-Math.PI / 2, 0, 0]} scale={[z.radius, z.radius, 1]}>
            <meshBasicMaterial ref={el => (ringMats.current[i] = el)} color="#F79009" transparent opacity={0.42} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          <mesh geometry={FILL_GEO} rotation={[-Math.PI / 2, 0, 0]} scale={[z.radius, z.radius, 1]}>
            <meshBasicMaterial color="#F79009" transparent opacity={0.06} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          <Html position={[0, 0.2, 0]} center distanceFactor={40} style={{ pointerEvents: 'none' }}>
            <div style={{ fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
              color: '#fff', background: 'rgba(180,60,20,0.72)', border: '1px solid rgba(255,150,80,0.6)',
              borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
              ⛔ {z.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}
