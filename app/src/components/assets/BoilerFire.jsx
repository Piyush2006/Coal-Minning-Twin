import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { extend, useFrame } from '@react-three/fiber'
import { shaderMaterial, Sparkles } from '@react-three/drei'

// ── Realistic furnace flame: a domain-warped fbm fire shader on tapered cones,
// additively blended + toneMapped:false so the scene Bloom (PostFX) makes it glow.
// Two nested cones (outer body + hotter inner core) read as a turbulent volume;
// ember Sparkles + a base glow disc + a warm point light sell the combustion. ──
const FlameMaterial = shaderMaterial(
  { uTime: 0, uIntensity: 1, uHot: new THREE.Color('#ffd76a'), uMid: new THREE.Color('#ff7a12'), uCool: new THREE.Color('#d81800') },
  /* glsl vertex */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  /* glsl fragment */`
    uniform float uTime, uIntensity;
    uniform vec3 uHot, uMid, uCool;
    varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
      return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
    float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
    void main(){
      float h = clamp(vUv.y, 0.0, 1.0);                 // 0 = base, 1 = tip
      vec2 p = vec2(vUv.x*4.0, vUv.y*2.6 - uTime*1.9);  // scroll the noise upward
      float n = fbm(p + 0.6*fbm(p*1.7));                // domain-warped turbulence
      float flame = smoothstep(0.16, 0.9, n*(1.15-h) + (1.0-h)*0.22);
      float a = flame * uIntensity * (0.35 + 0.65*(1.0-h));   // thinner licks up top
      if (a < 0.05) discard;
      vec3 col = mix(uCool, uMid, smoothstep(0.3, 0.65, flame));
      col = mix(col, uHot, smoothstep(0.78, 1.0, flame));     // only the very core goes yellow
      gl_FragColor = vec4(col * (0.5 + 1.3*flame), a);        // hot but not white-out
    }
  `,
)
extend({ FlameMaterial })
const noRay = () => null

function FlameCone({ radius, height, matRef, ...props }) {
  return (
    <mesh raycast={noRay} {...props}>
      <coneGeometry args={[radius, height, 28, 1, true]} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <flameMaterial ref={matRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function BoilerFire({ position = [0, 0, 0], radius = 2.6, height = 13, config = {} }) {
  const live = config.enabled !== false
  const outer = useRef()
  const inner = useRef()
  const light = useRef()
  const base = useMemo(() => radius * 1.25, [radius])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flick = 0.82 + 0.18 * Math.sin(t * 9.0) * Math.sin(t * 3.3)   // turbulent flicker
    const amp = live ? 1 : 0.28
    if (outer.current) { outer.current.uTime = t; outer.current.uIntensity = 0.85 * amp }
    if (inner.current) { inner.current.uTime = t * 1.25; inner.current.uIntensity = 0.95 * amp }
    if (light.current) light.current.intensity = (live ? 9 : 1.5) * flick
  })

  return (
    <group position={position}>
      <FlameCone radius={radius} height={height} matRef={outer} position={[0, height / 2, 0]} />
      <FlameCone radius={radius * 0.5} height={height * 0.78} matRef={inner} position={[0, height * 0.42, 0]} />
      {/* glowing bed of coals on the furnace floor */}
      <mesh raycast={noRay} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <circleGeometry args={[base, 32]} />
        <meshStandardMaterial color="#ff5a00" emissive="#ff4400" emissiveIntensity={live ? 3.2 : 0.5} toneMapped={false} transparent opacity={0.95} />
      </mesh>
      {/* rising embers + warm interior light */}
      <Sparkles count={44} scale={[base * 1.6, height * 0.95, base * 1.6]} position={[0, height * 0.42, 0]}
        size={4} speed={live ? 0.7 : 0.15} noise={2} color="#ffb14a" />
      <pointLight ref={light} position={[0, height * 0.28, 0]} color="#ff6a1a" intensity={9} distance={26} decay={2} />
    </group>
  )
}
