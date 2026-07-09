import { Component, Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { MACHINE_COMPONENTS } from '../../lib/machineLibrary'
import { CompositeAsset } from '../CompositeAsset'
import { SceneConnectors } from '../Connectors'
import { useThumbStore } from '../../store/thumbStore'
import { getLibraryComponents } from '../../lib/libraryRef'

// ── Real 3D gallery thumbnails ───────────────────────────────────────────────
// A hidden, fixed-size Canvas renders queued scenes (clean studio backdrop, soft
// shadow) and captures a fitted 3/4 perspective screenshot via toDataURL. It is
// mounted once by HomeScreen and only renders a Canvas while jobs are queued.

const CAP_W = 420, CAP_H = 236
const STUDIO_BG = '#eef1f6'

// Environment fixtures are excluded from thumbnails: the studio has its own
// backdrop/shadow, and a huge Floor slab would dominate the bounding-box fit and
// shrink the actual machines to specks (Lights would also overexpose the studio).
const THUMB_SKIP = new Set(['Floor', 'Light'])

// Prop-driven mini-renderer — mirrors SceneObject's render minus store/selection.
function ThumbScene({ scene }) {
  // Saved snapshots EXCLUDE shared-library component defs (getSceneSnapshot keeps
  // only project-local types), so merge the library back in — otherwise objects
  // using library components resolve to null, the bbox is empty, and capture fails
  // back to the 2D schematic.
  const custom = { ...getLibraryComponents(), ...(scene?.customAssetTypes || {}) }
  return (
    <>
      {Object.values(scene?.objects || {}).map(o => {
        if (o.visible === false || THUMB_SKIP.has(o.type)) return null
        const Comp = MACHINE_COMPONENTS[o.type] ?? (custom[o.type] ? CompositeAsset : null)
        if (!Comp) return null
        return (
          <group key={o.id} position={o.position} rotation={o.rotation} scale={o.scale}>
            <Comp status={o.status} state={o.state} config={o.config} typeDef={custom[o.type]} name={o.name} />
          </group>
        )
      })}
      {/* conveyors / pipes / busbars between machines (off-store, non-interactive) */}
      <SceneConnectors objects={scene?.objects || {}} />
    </>
  )
}

// The warehouse HDRI comes from a CDN — a blocked/rate-limited fetch throws in
// drei's loader and would crash the WHOLE factory Canvas (job wedged, no thumbs,
// no critique renders). Degrade to lights-only instead.
class EnvBoundary extends Component {
  constructor(props) { super(props); this.state = { dead: false } }
  static getDerivedStateFromError() { return { dead: true } }
  render() { return this.state.dead ? null : this.props.children }
}

// Lights + environment + backdrop (matches the editor look; no aisle floor).
function Studio() {
  const { scene } = useThree()
  useEffect(() => { scene.background = new THREE.Color(STUDIO_BG) }, [scene])
  return (
    <>
      <ambientLight intensity={0.5} color="#d8eaf8" />
      <hemisphereLight args={['#ffffff', '#b8c2cc', 0.4]} />
      <directionalLight position={[10, 28, 15]} intensity={2.4} color="#fff8f2" />
      <directionalLight position={[-18, 20, -10]} intensity={0.6} color="#cce4ff" />
      <directionalLight position={[0, -8, 20]} intensity={0.25} color="#e8f0ff" />
      <EnvBoundary><Suspense fallback={null}><Environment preset="warehouse" /></Suspense></EnvBoundary>
      <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={140} blur={2.6} far={45} resolution={512} color="#1a2433" />
    </>
  )
}

// Frames the content at a fixed 3/4 perspective and captures one JPEG.
function CaptureRig({ job, groupRef }) {
  const { gl, scene, camera } = useThree()
  const done = useRef(false)
  const frames = useRef(0)
  useFrame(() => {
    if (done.current) return
    frames.current++
    if (frames.current < 10) return   // let the scene settle
    // wait for the warehouse HDRI (async behind Suspense) so materials read
    // correctly — capped at 60 frames so an offline fetch can't wedge the queue
    if (!scene.environment && frames.current < 60) return
    const g = groupRef.current
    if (!g) return
    done.current = true
    try {
      const box = new THREE.Box3().setFromObject(g)
      if (box.isEmpty()) { console.warn('[thumbs] empty bbox — group children:', g.children.length); useThumbStore.getState().fail(job.id, job.sig); return }
      const sphere = box.getBoundingSphere(new THREE.Sphere())
      const center = sphere.center
      const fov = 38
      const dist = (sphere.radius / Math.sin((fov * Math.PI / 180) / 2)) * 1.25
      const el = 35 * Math.PI / 180, az = 45 * Math.PI / 180   // 35° up, 45° around
      const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))
      camera.fov = fov
      camera.position.copy(center).add(dir.multiplyScalar(dist))
      camera.near = Math.max(0.1, dist - sphere.radius * 2)
      camera.far = dist + sphere.radius * 4
      camera.lookAt(center)
      camera.updateProjectionMatrix()
      gl.render(scene, camera)
      const url = gl.domElement.toDataURL('image/jpeg', job.kind === 'spec' ? 0.85 : 0.78)
      useThumbStore.getState().complete(job.id, job.sig, url)
    } catch (e) {
      console.warn('[thumbs] capture failed:', e.message)
      useThumbStore.getState().fail(job.id, job.sig)
    }
  })
  return null
}

// One component spec on the studio floor (Bruce's vision-critique renders).
function ThumbSpec({ spec }) {
  const cfg = { ...Object.fromEntries((spec.config || []).map(f => [f.key, f.default])), ...(spec.defaultConfig || {}) }
  return <CompositeAsset typeDef={spec} status="running" config={cfg} />
}

function CaptureGroup({ job }) {
  const groupRef = useRef()
  return (
    <>
      <group ref={groupRef}>
        {job.kind === 'spec' ? <ThumbSpec spec={job.spec} /> : <ThumbScene scene={job.scene} />}
      </group>
      <CaptureRig job={job} groupRef={groupRef} />
    </>
  )
}

export function ThumbnailFactory() {
  const jobs = useThumbStore(s => s.jobs)
  if (!jobs.length) return null   // no WebGL context unless there's work
  const job = jobs[0]
  const W = job.w ?? CAP_W, H = job.h ?? CAP_H
  return (
    <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: W, height: H, pointerEvents: 'none', opacity: 0.01, zIndex: -1 }}>
      <Canvas key={`${W}x${H}`}
        gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ fov: 38, near: 0.1, far: 2000, position: [40, 30, 40] }}
        dpr={1.5} frameloop="always">
        <Studio />
        <CaptureGroup key={`${job.id}|${job.sig}`} job={job} />
      </Canvas>
    </div>
  )
}
