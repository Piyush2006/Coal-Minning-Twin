// Gradient sky dome — a big inward-facing sphere with a vertical zenith→horizon
// gradient, plus matching scene fog for aerial depth. Config-driven from the
// scene's `environment.sky` block (any twin can opt in):
//   environment: { sky: { zenith, horizon, ground, fog: { near, far } } }
// Pure shader — no network HDRIs, works offline and in headless capture.
import { useMemo } from 'react'
import * as THREE from 'three'
import { resolveColor } from '../lib/paletteTokens'

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
  return (
    <>
      <mesh material={mat} renderOrder={-1000} frustumCulled={false}>
        <sphereGeometry args={[1800, 32, 16]} />
      </mesh>
      {fog && <fog attach="fog" args={[fog.color, fog.near, fog.far]} />}
    </>
  )
}
