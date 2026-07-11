// Gradient sky dome — a big inward-facing sphere with a vertical zenith→horizon
// gradient, plus matching scene fog for aerial depth. Config-driven from the
// scene's `environment.sky` block (any twin can opt in):
//   environment: { sky: { zenith, horizon, ground, fog: { near, far } } }
// Pure shader — no network HDRIs, works offline and in headless capture.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { resolveColor } from '../lib/paletteTokens'
import { nightMix, NIGHT_DEFAULTS } from '../lib/dayNight'

const _day = new THREE.Color(), _night = new THREE.Color()
const mixInto = (target, dayHex, nightHex) => target.copy(_day.set(dayHex)).lerp(_night.set(nightHex), nightMix.v)

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAG = /* glsl */ `
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround;
  varying vec3 vWorld;
  void main() {
    float h = normalize(vWorld).y;                    // -1 .. 1
    vec3 c = h >= 0.0
      ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.7));
    gl_FragColor = vec4(c, 1.0);
  }
`

export function SkyDome({ config = {} }) {
  const zenith  = resolveColor(config.zenith,  '#b9cbd8')   // soft overcast blue-grey
  const horizon = resolveColor(config.horizon, '#e8ecee')
  const ground  = resolveColor(config.ground,  '#cfd4d8')
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uZenith:  { value: new THREE.Color(zenith) },
      uHorizon: { value: new THREE.Color(horizon) },
      uGround:  { value: new THREE.Color(ground) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.BackSide, depthWrite: false, fog: false,
  }), [zenith, horizon, ground])
  const fog = config.fog === false ? null : { color: config.fog?.color ?? horizon, near: config.fog?.near ?? 260, far: config.fog?.far ?? 1400 }

  // Night blend — sky uniforms + scene fog follow nightMix each frame so the
  // day/night cross-fade is smooth and distance fade keeps melting correctly.
  const { scene } = useThree()
  const night = { ...NIGHT_DEFAULTS, ...(config.night ?? {}) }
  useFrame(() => {
    const u = mat.uniforms
    mixInto(u.uZenith.value, zenith, night.zenith)
    mixInto(u.uHorizon.value, horizon, night.horizon)
    mixInto(u.uGround.value, ground, night.ground)
    if (fog && scene.fog) mixInto(scene.fog.color, fog.color, night.fog)
  })
  return (
    <>
      <mesh material={mat} renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[1800, 32, 16]} />
      </mesh>
      {fog && <fog attach="fog" args={[fog.color, fog.near, fog.far]} />}
      {config.ridges !== false && <HorizonRidges config={config.ridges === true ? {} : (config.ridges ?? {})} horizon={horizon} nightColor={night.horizon} />}
    </>
  )
}

// ── Distant terrain silhouettes ─────────────────────────────────────────────
// A ring of big, flat, low-poly hills far outside the site, heavily melted
// into the haze by the scene fog — a sense of landscape, not a mountain range.
// Config (environment.sky.ridges): { distance, height, color, count } or false.
const h01 = (i, s2) => { const n = Math.sin(i * 127.1 + s2 * 311.7) * 43758.5453; return n - Math.floor(n) }
const RIDGE_GEO = new THREE.ConeGeometry(1, 1, 7, 1)
const _ro = new THREE.Object3D()

function HorizonRidges({ config = {}, horizon, nightColor = '#25303f' }) {
  const ref = useRef()
  const count = Math.min(28, Math.round(config.count ?? 18))
  const dist = config.distance ?? 820
  const hMax = config.height ?? 46
  const color = resolveColor(config.color, '#98a2ad')
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color }), [color])
  useFrame(() => { mixInto(mat.color, color, nightColor) })
  useEffect(() => {
    const m = ref.current
    if (!m) return
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + h01(i, 1) * 0.25
      const d = dist * (0.85 + h01(i, 2) * 0.35)
      const h = hMax * (0.35 + h01(i, 3) * 0.65)
      const w = 130 + h01(i, 4) * 190
      _ro.position.set(Math.cos(a) * d, h * 0.32, Math.sin(a) * d)   // slightly sunk, wide + flat
      _ro.scale.set(w, h, w * (0.7 + h01(i, 5) * 0.5))
      _ro.rotation.set(0, h01(i, 6) * Math.PI, 0)
      _ro.updateMatrix()
      m.setMatrixAt(i, _ro.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [count, dist, hMax])
  return <instancedMesh ref={ref} args={[RIDGE_GEO, mat, count]} frustumCulled={false} renderOrder={-500} />
}
