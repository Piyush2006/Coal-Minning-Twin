// ModelSwap — swap a procedural composite asset for a realistic GLB model,
// config-driven and bulletproof:
//
//   config.model = {
//     file: '/models/ship.glb',   // public path (plain GLB — no draco/meshopt)
//     scale: 1,                   // fine-tune multiplier on the auto-fit
//     fit: 48,                    // target horizontal footprint in metres
//                                 //   (defaults to the procedural asset's footprint)
//     rotationYDeg: 90,           // heading correction
//     yOffset: 0,                 // lift/sink after grounding at y = 0
//     hide: ['rail30'],           // node names to hide (also excluded from fit)
//     keepParts: [...],           // procedural part ids to render ALONGSIDE the
//     overrides: { id: {...} },   //   GLB (emitters, water planes …) — handled
//   }                             //   by CompositeAsset, not here
//
// The GLB auto-normalizes: measured bounding box (visible nodes only) → scaled
// so its horizontal footprint matches `fit`, centred on X/Z, base grounded at
// y = 0. While loading AND on any load/parse failure the procedural `fallback`
// renders instead — never a broken or empty asset.
import { Suspense, useMemo, Component as ReactComponent } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Clone } from '@react-three/drei'
import * as THREE from 'three'

const _b = new THREE.Box3()

// Expand `box` by every VISIBLE mesh (Box3.setFromObject ignores visibility).
function expandVisible(box, obj) {
  if (obj.visible === false) return
  if (obj.isMesh && obj.geometry) {
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox()
    _b.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld)
    box.union(_b)
  }
  for (const c of obj.children) expandVisible(box, c)
}

function LoadedModel({ model, fitDefault }) {
  const { scene } = useLoader(GLTFLoader, model.file)
  const { k, offset } = useMemo(() => {
    // Hide unwanted nodes on the (cached) source — Clone carries visibility over.
    const hide = new Set(model.hide ?? [])
    if (hide.size) scene.traverse(o => { if (hide.has(o.name)) o.visible = false })
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3()
    expandVisible(box, scene)
    if (box.isEmpty()) return { k: 1, offset: [0, 0, 0] }
    const size = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)
    const horiz = Math.max(size.x, size.z) || 1
    const k = ((Number(model.fit) || fitDefault || 10) / horiz) * (Number(model.scale) || 1)
    return { k, offset: [-center.x, -box.min.y + (Number(model.yOffset) || 0), -center.z] }
  }, [scene, model.fit, model.scale, model.yOffset, model.hide, fitDefault])
  return (
    <group rotation={[0, ((Number(model.rotationYDeg) || 0) * Math.PI) / 180, 0]} scale={k}>
      <group position={offset}>
        <Clone object={scene} castShadow receiveShadow />
      </group>
    </group>
  )
}

// A failed load (bad path / parse error) falls back to the procedural asset.
class SwapBoundary extends ReactComponent {
  constructor(p) { super(p); this.state = { err: false } }
  static getDerivedStateFromError() { return { err: true } }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: false }) }
  render() { return this.state.err ? this.props.fallback : this.props.children }
}

export function ModelSwap({ model, fallback, fitDefault }) {
  if (!model?.file) return fallback
  return (
    <SwapBoundary resetKey={model.file} fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedModel model={model} fitDefault={fitDefault} />
      </Suspense>
    </SwapBoundary>
  )
}
