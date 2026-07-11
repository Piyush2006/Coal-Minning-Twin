import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, SMAA, N8AO, Vignette, DepthOfField, BrightnessContrast, HueSaturation, Sepia } from '@react-three/postprocessing'
import { useSceneStore } from '../store/sceneStore'

// Clean post-processing: N8AO ambient occlusion, bloom that catches emissives
// (status lamps, molten glow, water glints), a mild depth-of-field, a subtle
// final colour grade, vignette + SMAA/MSAA anti-aliasing. Tone mapping itself
// is ACES filmic at the renderer (Canvas gl props) — materials tone-map during
// the scene pass, so composer effects operate on the filmic image, and the raw
// CCTV scissor pass (rendered outside the composer) still gets ACES with no
// effects: intentionally "straight off the camera".
//
// Scene-tunable via `environment.postfx`:
//   exposure: 1.05                      — ACES exposure re-tune
//   bloom:    { intensity, threshold }
//   dof:      false | { focusDistance, focalLength, bokehScale }
//   grade:    false | { contrast, brightness, saturation, warmth }  — default barely-there
//   vignette: { offset, darkness }
// (No SSR pass: the available implementation requires dropping the MSAA the
// whole scene relies on and shimmers on large outdoor planes — deliberately
// omitted rather than shipped broken.)
// multisampling = MSAA: stabilises thin geometry (lattice members, frames, grid)
// so edges don't crawl/shimmer while orbiting; SMAA alone can't hold sub-pixel lines.
export function PostFX() {
  const pfx = useSceneStore(s => s.environment)?.postfx ?? {}
  const gl = useThree(s => s.gl)

  // Exposure re-tune against ACES — scene data can lift the hazy horizon
  // without touching the Canvas props.
  useEffect(() => {
    const prev = gl.toneMappingExposure
    gl.toneMappingExposure = Number(pfx.exposure) || 1.05
    return () => { gl.toneMappingExposure = prev }
  }, [gl, pfx.exposure])

  const dof = pfx.dof
  const grade = pfx.grade === false ? null : (pfx.grade ?? {})
  const vig = pfx.vignette ?? {}
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
      {/* Final grade — slight contrast lift + gentle warmth suited to the
          overcast IBL. Deliberately faint; `grade: false` restores the raw chain. */}
      {grade && <BrightnessContrast brightness={grade.brightness ?? 0} contrast={grade.contrast ?? 0.06} />}
      {grade && <HueSaturation saturation={grade.saturation ?? 0.05} hue={0} />}
      {grade && <Sepia intensity={grade.warmth ?? 0.05} />}
      <Vignette offset={vig.offset ?? 0.26} darkness={vig.darkness ?? 0.32} eskil={false} />
      <SMAA />
    </EffectComposer>
  )
}
