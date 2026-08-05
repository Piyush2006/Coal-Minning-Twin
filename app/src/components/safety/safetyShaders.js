// Premium look for the safety visuals — small, robust gradient ShaderMaterials
// (additive, bloom-friendly) that replace flat-opacity primitives. Each factory
// returns a fresh THREE.ShaderMaterial so a layer can mutate its uniforms every
// frame. Colours are pushed >1 so the scene's bloom pass makes them glow.
import * as THREE from 'three'

const base = {
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide, toneMapped: false,
}

// FOV cone — bright at the camera apex, fading to the watched footprint.
// geometry supplies attribute `aT` (1 apex → 0 ground ring).
export function coneMat() {
  return new THREE.ShaderMaterial({
    ...base,
    uniforms: { uColor: { value: new THREE.Color('#38B6FF') }, uOpacity: { value: 0.12 }, uTime: { value: 0 } },
    vertexShader: `attribute float aT; varying float vT; varying vec3 vP;
      void main(){ vT=aT; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime; varying float vT; varying vec3 vP;
      void main(){
        float grad = pow(vT, 1.4);                       // dense near apex
        float scan = 0.5 + 0.5*sin(vP.y*3.0 - uTime*4.0);// faint volumetric striations
        float a = uOpacity * (0.35 + 0.65*grad) * (0.8 + 0.2*scan);
        gl_FragColor = vec4(uColor*(1.0+grad*0.6), a);
      }`,
  })
}

// Radar sweep sector — bright leading edge, trailing fade. attribute `aAng` (0
// centre/leading → 1 trailing).
export function sweepMat() {
  return new THREE.ShaderMaterial({
    ...base,
    uniforms: { uColor: { value: new THREE.Color('#38B6FF') }, uOpacity: { value: 0.2 } },
    vertexShader: `attribute float aAng; varying float vA; void main(){ vA=aAng; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ float a = uOpacity * pow(1.0-vA, 1.6); gl_FragColor = vec4(uColor*1.4, a); }`,
  })
}

// Detection-zone "energy fence" — vertical top-fade + a bright band flowing around
// the perimeter. attributes `aY` (0 bottom → 1 top), `aU` (0..1 around the loop).
export function fenceMat(color = '#38B6FF') {
  return new THREE.ShaderMaterial({
    ...base,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.25 }, uTime: { value: 0 }, uFlow: { value: 1 } },
    vertexShader: `attribute float aY; attribute float aU; varying float vY, vU;
      void main(){ vY=aY; vU=aU; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime, uFlow; varying float vY, vU;
      void main(){
        float topFade = pow(1.0 - vY, 1.3);
        float m = fract(vU*2.0 - uTime*0.28);
        float band = exp(-pow(m-0.5, 2.0)/0.006) * uFlow;   // marching energy band
        float a = uOpacity * (topFade*(0.5 + 0.9*band) + 0.12*topFade);
        gl_FragColor = vec4(uColor*(1.0+band*1.4), a);
      }`,
  })
}

// Body-scan slab — a feathered plane with a hot centre line (uses plane uv).
export function scanMat() {
  return new THREE.ShaderMaterial({
    ...base,
    uniforms: { uColor: { value: new THREE.Color('#5CC8FF') }, uOpacity: { value: 0.9 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime; varying vec2 vUv;
      void main(){
        float d = length(vUv-0.5)*2.0;
        float disc = smoothstep(1.0, 0.25, d);
        float line = exp(-pow(vUv.y-0.5, 2.0)/0.012);
        float shim = 0.85 + 0.15*sin(vUv.x*40.0 + uTime*10.0);
        float a = uOpacity * (0.35*disc + 0.95*line) * shim;
        gl_FragColor = vec4(uColor*(1.0+line*1.2), a);
      }`,
  })
}

// Beam / tether — flowing energy along a unit cylinder (uv.y = length).
export function flowMat(color = '#5CC8FF') {
  return new THREE.ShaderMaterial({
    ...base,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.9 }, uTime: { value: 0 }, uDir: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uTime, uDir; varying vec2 vUv;
      void main(){
        float flow = fract(vUv.y*4.0 - uTime*1.6*uDir);
        float pk = exp(-pow(flow-0.5,2.0)/0.02);
        float edge = 0.6 + 0.4*sin(vUv.x*6.2831);        // round the tube
        float a = uOpacity * (0.28 + 0.9*pk) * edge;
        gl_FragColor = vec4(uColor*(1.0+pk*1.5), a);
      }`,
  })
}

// Expanding shockwave ring (RingGeometry uv radial). Bright leading edge.
export function shockMat() {
  return new THREE.ShaderMaterial({
    ...base,
    uniforms: { uColor: { value: new THREE.Color('#F04438') }, uOpacity: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main(){ float r = length(vUv-0.5)*2.0; float edge = smoothstep(0.55,0.9,r)*smoothstep(1.02,0.9,r); gl_FragColor=vec4(uColor*1.7, uOpacity*edge); }`,
  })
}
