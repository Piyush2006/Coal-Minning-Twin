// ParticleEmitter — shared smoke / steam / dust / exhaust plume module.
// Generic + config-driven; usable two ways:
//   • as a Component-Spec part:  { kind: 'emitter', position, emitter: { preset, … } }
//   • directly by engine components (e.g. TerrainMound dust) as <ParticleEmitter/>
//
// Implementation: ONE THREE.Points per emitter with a custom shader — the whole
// particle sim lives in the VERTEX SHADER (position/size/alpha are functions of
// uTime and per-particle seeds), so per-frame cost is a single uniform write:
// no CPU loops, no attribute uploads, no allocations. Every particle is a soft
// camera-facing billboard sprite that:
//   rises → grows → spreads outward → leans with the wind → fades out,
// with per-particle variation in size, speed and lifetime. That combination is
// what reads as smoke rather than "grey balls".
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { resolveColor } from '../../lib/paletteTokens'

const SNAP_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('snap')

// soft radial sprite (shared, built once)
let _sprite = null
function spriteTexture() {
  if (_sprite) return _sprite
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 31)
  grad.addColorStop(0, 'rgba(255,255,255,0.75)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.42)')
  grad.addColorStop(0.7, 'rgba(255,255,255,0.14)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  _sprite = new THREE.CanvasTexture(c)
  return _sprite
}

// Tuning keys (all overridable per emitter via the part's `emitter` config):
//   count, color, opacity, size (m at birth), grow (× size over life),
//   lifetime (s), rise (m/s), spread (mouth radius, m), spreadGrow (× over
//   life), wind [x, z m/s], turb (sideways wobble, m), scale (whole plume ×)
export const EMITTER_PRESETS = {
  smoke:   { count: 120, color: '#a7afb7', opacity: 0.34, size: 1.3, grow: 3.4, lifetime: 7.0, rise: 1.35, spread: 0.5,  spreadGrow: 2.8, wind: [0.55, 0.12], turb: 0.35 },
  steam:   { count: 130, color: '#f1f4f6', opacity: 0.30, size: 1.5, grow: 3.8, lifetime: 5.5, rise: 1.6,  spread: 0.9,  spreadGrow: 3.2, wind: [0.4, 0.1],   turb: 0.5 },
  dust:    { count: 60,  color: '#b7a689', opacity: 0.24, size: 1.0, grow: 2.2, lifetime: 4.5, rise: 0.5,  spread: 1.7,  spreadGrow: 2.0, wind: [0.5, 0.15],  turb: 0.5 },
  exhaust: { count: 40,  color: '#c2c8cf', opacity: 0.30, size: 0.35, grow: 2.6, lifetime: 2.6, rise: 1.2, spread: 0.12, spreadGrow: 1.8, wind: [0.35, 0.05], turb: 0.35 },
  spray:   { count: 30,  color: '#bcd8ee', opacity: 0.38, size: 0.5, grow: 1.5, lifetime: 1.6, rise: 1.0,  spread: 0.7,  spreadGrow: 1.4, wind: [0.2, 0],     turb: 0.6 },
}

const h01 = (i, s) => { const n = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return n - Math.floor(n) }

const VERT = /* glsl */ `
  uniform float uTime, uSize, uGrow, uLifetime, uRise, uSpread, uSpreadGrow, uTurb, uScale;
  uniform vec2 uWind;
  attribute vec4 aSeed;            // phase, dirX, dirZ, variation
  varying float vAlpha;
  void main() {
    float vr = mix(0.72, 1.28, aSeed.w);                 // per-particle life/size variation
    float life = uLifetime * vr;
    float p = fract(uTime / life + aSeed.x);             // 0..1 through this particle's life
    float h = p * uRise * life;                          // height risen so far
    float wob = sin(uTime * 0.8 + aSeed.x * 6.2831 + h * 0.6);
    float spread = uSpread * (0.35 + p * uSpreadGrow);
    vec3 pos = vec3(
      aSeed.y * spread + uWind.x * h + wob * uTurb * p,
      h,
      aSeed.z * spread + uWind.y * h + cos(uTime * 0.63 + aSeed.x * 6.2831) * uTurb * p * 0.6
    ) * uScale;
    // dense at the mouth, dissipating at the top — never pops out
    vAlpha = smoothstep(0.0, 0.1, p) * (1.0 - smoothstep(0.42, 0.92, p));
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float size = uSize * mix(0.7, 1.3, aSeed.w) * (0.55 + p * uGrow) * uScale;
    gl_PointSize = size * (240.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform sampler2D uMap;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

export function ParticleEmitter({ preset = 'dust', active = true, scale = 1, ...overrides }) {
  const cfg = { ...(EMITTER_PRESETS[preset] || EMITTER_PRESETS.dust), ...overrides }
  const n = Math.min(220, Math.max(8, Math.round(cfg.count)))

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))  // computed in-shader
    const seeds = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      // unit-disc direction jitter + stable phase + variation seed
      const a = h01(i, 2) * Math.PI * 2, r = Math.sqrt(h01(i, 3))
      seeds[i * 4] = h01(i, 1)
      seeds[i * 4 + 1] = Math.cos(a) * r
      seeds[i * 4 + 2] = Math.sin(a) * r
      seeds[i * 4 + 3] = h01(i, 4)
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    return g
  }, [n])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(resolveColor(cfg.color)) },
      uOpacity: { value: cfg.opacity }, uSize: { value: cfg.size }, uGrow: { value: cfg.grow },
      uLifetime: { value: cfg.lifetime }, uRise: { value: cfg.rise },
      uSpread: { value: cfg.spread }, uSpreadGrow: { value: cfg.spreadGrow },
      uWind: { value: new THREE.Vector2(cfg.wind?.[0] ?? 0.5, cfg.wind?.[1] ?? 0.1) },
      uTurb: { value: cfg.turb ?? 0.4 }, uScale: { value: scale },
      uMap: { value: spriteTexture() },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  }), [cfg.color, cfg.opacity, cfg.size, cfg.grow, cfg.lifetime, cfg.rise, cfg.spread, cfg.spreadGrow, cfg.turb, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  const ref = useRef()
  useFrame(({ clock }) => {
    const pts = ref.current
    if (!pts) return
    pts.visible = active !== false
    if (pts.visible) mat.uniforms.uTime.value = clock.elapsedTime   // the ONLY per-frame work
  })

  if (SNAP_MODE) return null
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
}
