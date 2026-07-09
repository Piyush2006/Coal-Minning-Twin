import { EffectComposer, Bloom, SMAA, N8AO, Vignette, DepthOfField } from '@react-three/postprocessing'
import { useSceneStore } from '../store/sceneStore'

// Clean post-processing: N8AO ambient occlusion, bloom that catches emissives
// (status lamps, molten glow, water glints), a mild depth-of-field, subtle
// vignette + SMAA/MSAA anti-aliasing. Scene-tunable via `environment.postfx`:
//   { dof: false | { focusDistance, focalLength, bokehScale }, bloom?: { intensity, threshold } }
// multisampling = MSAA: stabilises thin geometry (lattice members, frames, grid)
// so edges don't crawl/shimmer while orbiting; SMAA alone can't hold sub-pixel lines.
export function PostFX() {
  const pfx = useSceneStore(s => s.environment)?.postfx ?? {}
  const dof = pfx.dof
  return (
    <EffectComposer multisampling={4}>
      {/* Ambient occlusion — contact darkening in crevices / where parts meet.
          Kept SUBTLE: strong settings read as a grey haze over large flat floors. */}
      <N8AO halfRes aoRadius={1.1} distanceFalloff={0.9} intensity={1.0} color="#0a1016" />
      <Bloom luminanceThreshold={pfx.bloom?.threshold ?? 0.95} luminanceSmoothing={0.25} intensity={pfx.bloom?.intensity ?? 0.55} mipmapBlur />
      {dof !== false && (
        <DepthOfField
          focusDistance={dof?.focusDistance ?? 0.03}
          focalLength={dof?.focalLength ?? 0.32}
          bokehScale={dof?.bokehScale ?? 1.3}
        />
      )}
      <Vignette offset={0.26} darkness={0.32} eskil={false} />
      <SMAA />
    </EffectComposer>
  )
}
