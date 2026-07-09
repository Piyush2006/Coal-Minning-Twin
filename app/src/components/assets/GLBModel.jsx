import { Suspense, useMemo, Component } from 'react'
import { useGLTF, Clone } from '@react-three/drei'
import { Box3, Vector3 } from 'three'

// ── Imported glTF / GLB model asset ─────────────────────────────────────────
// Loads a real 3D model (config.url — a public path like "/models/pump.glb" or a
// CORS-enabled https URL) and renders it in place. Auto-fits: centres on X/Z,
// sits the base on the floor, and scales the largest dimension to `fit` metres
// (× `scale`), so any model — whatever units/origin it ships with — lands sensibly.
// A missing/failed URL shows a wireframe placeholder instead of crashing the scene.
// draco + meshopt compression work out of the box (drei's default decoders).

function Placeholder() {
  return (
    <mesh position={[0, 0.9, 0]}>
      <boxGeometry args={[1.6, 1.8, 1.6]} />
      <meshStandardMaterial color="#8aa0b4" wireframe transparent opacity={0.5} />
    </mesh>
  )
}

function Loaded({ url, scale, yaw, fit }) {
  const { scene } = useGLTF(url)
  const { norm, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const size = new Vector3(); box.getSize(size)
    const center = new Vector3(); box.getCenter(center)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    return { norm: ((fit || 4) / maxDim) * (scale || 1), offset: [-center.x, -box.min.y, -center.z] }
  }, [scene, scale, fit])
  return (
    <group rotation={[0, yaw, 0]} scale={norm}>
      <group position={offset}>
        <Clone object={scene} castShadow receiveShadow />
      </group>
    </group>
  )
}

// Catches a failed load (bad URL / CORS / parse) → placeholder, never a blank scene.
class ModelBoundary extends Component {
  constructor(p) { super(p); this.state = { err: false } }
  static getDerivedStateFromError() { return { err: true } }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: false }) }
  render() { return this.state.err ? this.props.fallback : this.props.children }
}

export function GLBModel({ config = {} }) {
  const url = (config.url || '').trim()
  if (!url) return <Placeholder />
  const yaw = ((config.yaw ?? 0) * Math.PI) / 180
  return (
    <ModelBoundary resetKey={url} fallback={<Placeholder />}>
      <Suspense fallback={<Placeholder />}>
        <Loaded url={url} scale={config.scale ?? 1} yaw={yaw} fit={config.fit ?? 4} />
      </Suspense>
    </ModelBoundary>
  )
}
