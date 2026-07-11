// Day/night driver + the site lights it modulates. The night palette is data
// (environment.sky.night — see NIGHT_DEFAULTS for the shape); deep blue-grey,
// never pitch black, so the site stays legible. NO new lights are added at
// night — the existing sun/fill rig and the IBL just dim, letting the scene's
// emissive lamps (floodlights, beacons, camera indicators) and bloom carry it.
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSceneStore } from '../store/sceneStore'
import { useDayNight, nightMix, NIGHT_DEFAULTS } from '../lib/dayNight'

const lerp = (a, b, k) => a + (b - a) * k

export function DayNightDriver() {
  const { gl, scene } = useThree()
  useFrame((_, dt) => {
    const target = useDayNight.getState().night ? 1 : 0
    const step = Math.min(dt, 0.5) / 5                       // full fade ≈ 5 s
    if (nightMix.v !== target) {
      nightMix.v = target > nightMix.v ? Math.min(target, nightMix.v + step) : Math.max(target, nightMix.v - step)
    }
    const env = useSceneStore.getState().environment ?? {}
    const night = { ...NIGHT_DEFAULTS, ...(env.sky?.night ?? {}) }
    const baseExposure = Number(env.postfx?.exposure) || 1.05
    scene.environmentIntensity = lerp(1, night.dim, nightMix.v)
    gl.toneMappingExposure = baseExposure * lerp(1, night.exposure, nightMix.v)
  })
  return null
}

// The scene's light rig (moved out of App so night can dim it per frame).
export function SiteLights() {
  const amb = useRef(), key = useRef(), fillA = useRef(), fillB = useRef()
  useFrame(() => {
    const k = nightMix.v
    if (amb.current)   amb.current.intensity   = lerp(0.32, 0.10, k)
    if (key.current)   key.current.intensity   = lerp(2.8, 0.4, k)
    if (fillA.current) fillA.current.intensity = lerp(0.6, 0.10, k)
    if (fillB.current) fillB.current.intensity = lerp(0.25, 0.05, k)
  })
  return (
    <>
      <ambientLight ref={amb} intensity={0.32} color="#d8eaf8" />
      <directionalLight
        ref={key}
        position={[10, 28, 15]} intensity={2.8} color="#ffffff" castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-100} shadow-camera-right={100}
        shadow-camera-top={70}    shadow-camera-bottom={-70}
        shadow-camera-far={260}   shadow-bias={-0.0008}
      />
      <directionalLight ref={fillA} position={[-18, 20, -10]} intensity={0.6} color="#cce4ff" />
      <directionalLight ref={fillB} position={[0, -8, 20]} intensity={0.25} color="#e8f0ff" />
    </>
  )
}
