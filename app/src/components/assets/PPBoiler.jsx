import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CompositeAsset } from '../CompositeAsset'
import { ComponentCard } from '../HoverCards'
import { BoilerFire } from './BoilerFire'

const noRay = () => null
const UP = new THREE.Vector3(0, 1, 0)

// ── Hoverable internal compartments — point at the superheater / economiser /
// reheater / furnace / drum and get a name + info chip and a compartment outline.
// Invisible proxy boxes; clicks still bubble to the boiler (selection intact). ──
// NOTE: zone boxes extend slightly OUTSIDE the glass casing (depth 10.8 > casing 10)
// so they win the raycast over the glass walls — otherwise the wall eats the hover.
// Cards use the app's standard ComponentCard (same as machine hover tooltips).
const ZONES = [
  { name: 'Steam Drum',  pos: [-6, 28.5, 0],  size: [11, 3.8, 4],
    rows: [{ key: 'p', label: 'Pressure', unit: 'bar', value: 165 }, { key: 'l', label: 'Drum Level', unit: '%', value: 52 }] },
  { name: 'Superheater', pos: [-5.9, 21.8, 0],  size: [9.9, 8.6, 10.8],
    rows: [{ key: 'st', label: 'Steam Temp', unit: '°C', value: 540 }, { key: 'mt', label: 'Metal Temp', unit: '°C', value: 580 }] },
  { name: 'Furnace',     pos: [-5.9, 12.4, 0],  size: [9.9, 10, 10.8],
    rows: [{ key: 't', label: 'Zone Temp', unit: '°C', value: 1250 }, { key: 'o2', label: 'Flue O₂', unit: '%', value: 3.2 }] },
  { name: 'Burners',     pos: [-11.4, 12.5, 0], size: [3.4, 9, 10.8],
    rows: [{ key: 'n', label: 'In Service', unit: 'of 9', value: 9 }, { key: 'af', label: 'Air Flow', unit: 't/h', value: 512 }] },
  { name: 'Crossover',   pos: [-0.9, 24.7, 0],  size: [4.4, 4.6, 10.8],
    rows: [{ key: 't', label: 'Gas Temp', unit: '°C', value: 850 }] },
  { name: 'Reheater',    pos: [2.75, 18.4, 0], size: [6.7, 5.2, 10.8],
    rows: [{ key: 'st', label: 'RH Steam', unit: '°C', value: 540 }, { key: 'gt', label: 'Gas Temp', unit: '°C', value: 620 }] },
  { name: 'Economiser',  pos: [2.75, 11.2, 0], size: [6.7, 7.4, 10.8],
    rows: [{ key: 'gi', label: 'Gas In', unit: '°C', value: 360 }, { key: 'wo', label: 'Water Out', unit: '°C', value: 245 }] },
  { name: 'Ash Hoppers', pos: [-2, 3.8, 0],     size: [17.4, 6.4, 10.8],
    rows: [{ key: 'lvl', label: 'Ash Level', unit: '%', value: 34 }] },
]

function ZoneHovers() {
  const [hover, setHover] = useState(-1)
  return (
    <group>
      {ZONES.map((z, i) => (
        <group key={z.name} position={z.pos}>
          <mesh
            onPointerOver={(e) => { e.stopPropagation(); setHover(i) }}
            onPointerOut={() => setHover(cur => (cur === i ? -1 : cur))}>
            <boxGeometry args={z.size} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {hover === i && (
            <>
              <mesh raycast={noRay}>
                <boxGeometry args={z.size} />
                <meshBasicMaterial color="#0a84ff" wireframe transparent opacity={0.55} />
              </mesh>
              <Html position={[0, 0, z.size[2] / 2 + 0.6]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ transform: 'translate(-50%, calc(-100% - 12px))' }}>
                  <ComponentCard name={z.name} status="running" rows={z.rows} />
                </div>
              </Html>
            </>
          )}
        </group>
      ))}
    </group>
  )
}

// Animated flue-gas arrows riding the REAL gas path — up the furnace, over the
// nose through the crossover opening, down the back pass past reheater/economiser,
// out toward the flue. Colour = heat: orange when hot, cooling to grey — the
// continuity cue for "what moves where".
function GasFlow({ enabled = true }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6, 9, 0), new THREE.Vector3(-6.3, 15, 0), new THREE.Vector3(-5.6, 20.5, 0),
    new THREE.Vector3(-3.6, 23.6, 0), new THREE.Vector3(-0.5, 24.9, 0), new THREE.Vector3(2.4, 22.5, 0),
    new THREE.Vector3(2.6, 17, 0), new THREE.Vector3(2.4, 11, 0), new THREE.Vector3(4.9, 8.3, 0),
  ]), [])
  const N = 14
  const refs = useRef([])
  const hot = useMemo(() => new THREE.Color('#ff8a2a'), [])
  const cold = useMemo(() => new THREE.Color('#9fb2c4'), [])
  useFrame(({ clock }) => {
    const t0 = clock.elapsedTime * (enabled ? 0.045 : 0.008)
    for (let i = 0; i < N; i++) {
      const m = refs.current[i]; if (!m) continue
      const t = (t0 + i / N) % 1
      m.position.copy(curve.getPointAt(t))
      m.quaternion.setFromUnitVectors(UP, curve.getTangentAt(t))
      m.material.color.lerpColors(hot, cold, t)
      m.material.emissive.copy(m.material.color)
      m.material.emissiveIntensity = 1.7 * (1 - t) + 0.08
    }
  })
  return (
    <group>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} raycast={noRay}>
          <coneGeometry args={[0.26, 0.95, 10]} />
          <meshStandardMaterial color="#ff8a2a" emissive="#ff8a2a" emissiveIntensity={1.5}
            toneMapped={false} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// Boiler = the generic CompositeAsset casing/structure (single glass shell with the
// divider + crossover, coils, drum) PLUS a bespoke shader fire and the animated
// gas-flow arrows. Registered for type 'pp_boiler'; selection/tooltips/ports intact.
export function PPBoiler({ status = 'running', config = {}, typeDef }) {
  // drop any legacy emissive "Flame …" parts — the fire is owned by <BoilerFire>
  const casing = useMemo(
    () => (typeDef?.parts ? { ...typeDef, parts: typeDef.parts.filter(p => !(p.label || '').startsWith('Flame')) } : typeDef),
    [typeDef],
  )
  return (
    <>
      <CompositeAsset typeDef={casing} config={config} status={status} />
      <BoilerFire position={[-6, 7.3, 0]} radius={2.8} height={13} config={config} />
      <GasFlow enabled={config.enabled !== false} />
      <ZoneHovers />
    </>
  )
}
