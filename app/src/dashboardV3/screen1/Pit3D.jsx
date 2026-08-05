// Screen 1 — 3D pit view (§5). Stylised, NOT survey-accurate: concentric bench
// terraces, a haul-road spiral, dump mounds, the CHP block. Matte clay in one
// canvas-family hue range (#DDE2EB–#F0F2F6); the ONLY colour in the scene is the
// equipment markers, coloured by live status. Soft ambient + one weak
// directional, contact-shadow AO only — no cast shadows, no specular. Locked
// iso-ish orbit with snap-back. Scrubber-reactive: CR-01 goes red at 16:52 and
// the downstream markers change with it. Graceful fallback to the 2D SiteMap.
import { useMemo, useRef, useEffect, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SITE_POS, SiteMap } from '../viz'
import { STATUS_DOT } from '../chrome'
import { useScrub } from '../screen0/store'

// spec (x,z) → scene units. Spec bounds x −195..128, z −78..46.
const S = 1 / 8
const sx = (x) => x * S
const sz = (z) => z * S
// clay hues (canvas family) — depth read comes from value within the range
const C = { base: '#F0F2F6', block: '#E9EDF3', road: '#E4E8F0', mound: '#E2E6EE' }
const TERRACE = ['#E6EAF1', '#E0E5EE', '#DAE0EA', '#D4DBE6', '#CED6E2']   // rim → floor, descending
const PIT = { x: sx(-150), z: sz(4) }              // pit-1 centre
const TARGET = [-6, 0, -1]

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

export function Pit3D({ fx, derived, m, height = 300 }) {
  const [failed] = useState(!webglOK())
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])
  // graceful fallback: no WebGL → the 2D plan, silently
  if (failed) return <SiteMap fx={fx} derived={derived} m={m} height={height - 40} />

  return (
    <div style={{ height, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(180deg,#F4F6FA,#EAEEF4)' }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [TARGET[0] + 9, 20, TARGET[2] + 9], fov: 30, near: 1, far: 200 }}
        onCreated={({ gl, scene }) => { gl.setClearColor(0x000000, 0); scene.background = null }}
      >
        <TriBudgetLog />
        <ambientLight intensity={0.82} />
        <directionalLight position={[7, 16, 4]} intensity={0.5} />
        <Terrain />
        <CHPBlock />
        <Markers snap={snap} />
        <ContactShadows position={[TARGET[0], -0.02, TARGET[2]]} scale={46} resolution={512} blur={2.6} opacity={0.28} far={12} frames={1} color="#8A94A6" />
        <LockedOrbit />
        <Invalidate dep={m} />
      </Canvas>
    </div>
  )
}

/* dev-only triangle-count proof (must stay < 30k) */
function TriBudgetLog() {
  const gl = useThree(s => s.gl)
  useEffect(() => {
    const t = setTimeout(() => { if (import.meta.env.DEV) console.log('[Pit3D] triangles:', gl.info.render.triangles) }, 400)
    return () => clearTimeout(t)
  }, [gl])
  return null
}

/* re-render on scrub change under frameloop=demand */
function Invalidate({ dep }) {
  const invalidate = useThree(s => s.invalidate)
  useEffect(() => { invalidate() }, [dep, invalidate])
  return null
}

/* ── terrain: a contained model base with a SUNK terraced pit (concentric
   benches descending), a haul-road spiral, and dump mounds. Depth reads via
   value steps within the canvas hue range + the weak directional light. ── */
function Terrain() {
  const RIM = 5.8, FLOOR_R = 1.3, DEPTH = 3.4, RINGS = 5
  const benches = useMemo(() => {
    const rows = []
    for (let i = 0; i < RINGS; i++) {
      const t = i / (RINGS - 1)
      const rOuter = RIM - t * (RIM - FLOOR_R)
      const y = -t * DEPTH                                   // descending
      rows.push({ rOuter, y, wall: (i === RINGS - 1 ? DEPTH / RINGS + FLOOR_R * 0.2 : DEPTH / RINGS + 0.35), col: TERRACE[i] })
    }
    return rows
  }, [])
  const road = useMemo(() => {
    const pts = []
    const turns = 1.7, steps = 46
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const a = t * Math.PI * 2 * turns + 0.4
      const r = RIM - 0.2 - t * (RIM - FLOOR_R - 0.4)
      pts.push(new THREE.Vector3(PIT.x + Math.cos(a) * r, -t * DEPTH + 0.05, PIT.z + Math.sin(a) * r))
    }
    return new THREE.CatmullRomCurve3(pts)
  }, [])
  // ground as a flat clay surface with a circular HOLE at the pit, so the
  // descending terraces are actually visible (a solid slab would bury them)
  const groundGeo = useMemo(() => {
    const w = 42, d = 19, cx = TARGET[0], cz = TARGET[2]
    const s = new THREE.Shape()
    s.moveTo(cx - w / 2, -(cz - d / 2)); s.lineTo(cx + w / 2, -(cz - d / 2))
    s.lineTo(cx + w / 2, -(cz + d / 2)); s.lineTo(cx - w / 2, -(cz + d / 2)); s.closePath()
    const hole = new THREE.Path()
    hole.absarc(PIT.x, -PIT.z, RIM + 0.05, 0, Math.PI * 2, true)
    s.holes.push(hole)
    const g = new THREE.ShapeGeometry(s, 12)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  return (
    <group>
      {/* clay ground surface (with the pit opening) */}
      <mesh geometry={groundGeo} position={[0, 0, 0]}>
        <meshStandardMaterial color={C.base} roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* thin model-base rim (4 edges) for an architectural-model read */}
      {[[0, -9.5, 42, 0.5], [0, 9.5, 42, 0.5], [-21, 0, 0.5, 19], [21, 0, 0.5, 19]].map(([dx, dz, w, d], i) => (
        <mesh key={i} position={[TARGET[0] + dx, -0.16, TARGET[2] + dz]}>
          <boxGeometry args={[w, 0.32, d]} />
          <meshStandardMaterial color={C.mound} roughness={1} metalness={0} />
        </mesh>
      ))}
      {/* sunk pit: each bench is a short cylinder wall at its depth; decreasing
          radius + descending y forms the terraced hole */}
      {benches.map((b, i) => (
        <mesh key={i} position={[PIT.x, b.y - b.wall / 2, PIT.z]}>
          <cylinderGeometry args={[b.rOuter, b.rOuter, b.wall, 44]} />
          <meshStandardMaterial color={b.col} roughness={1} metalness={0} />
        </mesh>
      ))}
      {/* haul-road spiral (thin ribbon tube) */}
      <mesh>
        <tubeGeometry args={[road, 50, 0.2, 5, false]} />
        <meshStandardMaterial color={C.road} roughness={1} metalness={0} />
      </mesh>
      {/* dump mounds outside the rim */}
      {[[sx(-108), sz(-56), 1.4], [sx(-90), sz(-62), 1.05]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.08, z]}>
          <coneGeometry args={[r, r * 0.62, 22]} />
          <meshStandardMaterial color={C.mound} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

/* ── CHP / stockyard / port block cluster (matte boxes + stockpile cones) ── */
function CHPBlock() {
  const box = (id, w, h, d) => { const [x, z] = SITE_POS[id] ?? [0, 0]; return { p: [sx(x), h / 2, sz(z)], a: [w, h, d] } }
  const boxes = [
    box('crusher-1', 1.6, 1.3, 1.6), box('screen-1', 1.3, 0.9, 1.3), box('chpp-1', 1.5, 1.4, 1.5),
    box('stacker-1', 1.2, 1.0, 1.2), box('blend-1', 1.1, 0.8, 1.1), box('loadout-1', 1.4, 0.7, 1.0),
    box('shiploader-1', 1.2, 1.5, 1.2),
  ]
  return (
    <group>
      {boxes.map((b, i) => (
        <RoundedBox key={i} args={b.a} radius={0.08} smoothness={2} position={b.p}>
          <meshStandardMaterial color={C.block} roughness={1} metalness={0} />
        </RoundedBox>
      ))}
      {/* product stockpile cones */}
      {['pile-1', 'pile-2'].map((id) => { const [x, z] = SITE_POS[id]; return (
        <mesh key={id} position={[sx(x), 0.55, sz(z)]}>
          <coneGeometry args={[1.05, 1.1, 22]} />
          <meshStandardMaterial color={C.mound} roughness={1} metalness={0} />
        </mesh>
      ) })}
    </group>
  )
}

// lift markers that sit on a block/pile so the pill floats clearly above it
const MARK_LIFT = { 'crusher-1': 1.3, 'screen-1': 0.9, 'chpp-1': 1.4, 'stacker-1': 1.0, 'blend-1': 0.8, 'loadout-1': 0.7, 'shiploader-1': 1.5, 'pile-1': 1.1, 'pile-2': 1.1 }

/* ── markers: the only colour in the scene ── */
function Markers({ snap }) {
  const selection = useScrub(s => s.selection)
  const select = useScrub(s => s.select)
  return (
    <group>
      {Object.entries(SITE_POS).map(([id, [x, z, label]]) => {
        const st = snap[id]?.status ?? 'running'
        const col = STATUS_DOT[st] ?? '#C6CDD8'
        const sel = selection === id
        const px = sx(x), pz = sz(z), lift = MARK_LIFT[id] ?? 0
        return (
          <group key={id} position={[px, lift, pz]}>
            {/* thin stem so a lifted pill reads as anchored to its block */}
            {lift > 0.01 && (
              <mesh position={[0, -lift / 2, 0]}>
                <cylinderGeometry args={[0.02, 0.02, lift, 6]} />
                <meshStandardMaterial color="#B8C0CE" roughness={1} />
              </mesh>
            )}
            <mesh position={[0, 0.5, 0]} onClick={(e) => { e.stopPropagation(); select(id) }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = '' }}>
              <capsuleGeometry args={[0.16, 0.52, 4, 12]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.22} roughness={0.65} metalness={0} />
            </mesh>
            {sel && (
              <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.4, 0.5, 28]} />
                <meshBasicMaterial color="#2B5CE7" transparent opacity={0.9} />
              </mesh>
            )}
            <Html position={[0, 1.0, 0]} center distanceFactor={22} style={{ pointerEvents: 'none' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: sel ? '#2B5CE7' : '#5B6B7F', fontWeight: sel ? 700 : 500, whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(255,255,255,0.95)' }}>{label}</div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/* ── locked iso-ish orbit with snap-back ── */
function LockedOrbit() {
  const ref = useRef()
  const home = useRef(null)
  const dragging = useRef(false)
  const invalidate = useThree(s => s.invalidate)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    home.current = { az: c.getAzimuthalAngle(), pol: c.getPolarAngle() }
    const onStart = () => { dragging.current = true }
    const onEnd = () => { dragging.current = false; invalidate() }
    c.addEventListener('start', onStart); c.addEventListener('end', onEnd)
    return () => { c.removeEventListener('start', onStart); c.removeEventListener('end', onEnd) }
  }, [invalidate])

  useFrame(() => {
    const c = ref.current, h = home.current
    if (!c || !h || dragging.current) return
    const az = c.getAzimuthalAngle(), pol = c.getPolarAngle()
    const daz = h.az - az, dpol = h.pol - pol
    if (Math.abs(daz) < 1e-3 && Math.abs(dpol) < 1e-3) return
    c.setAzimuthalAngle(az + daz * 0.12)
    c.setPolarAngle(pol + dpol * 0.12)
    c.update()
    invalidate()                            // keep frames coming until settled
  })

  return (
    <OrbitControls ref={ref} target={TARGET} makeDefault
      enablePan={false}
      minPolarAngle={0.42} maxPolarAngle={0.78}      // narrow pitch band (iso-ish)
      minAzimuthAngle={Math.PI / 4 - 0.6} maxAzimuthAngle={Math.PI / 4 + 0.6}
      minDistance={18} maxDistance={32}
      enableDamping dampingFactor={0.12} />
  )
}

export default Pit3D
