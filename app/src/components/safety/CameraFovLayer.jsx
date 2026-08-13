// PPE camera "watching" visual — the missing half of the PPE story. Each
// ppe_camera projects a volumetric FOV cone (bright at the head, fading to the
// footprint it watches), a crisp glowing footprint ring, and a radar sweep
// rotating inside it. Idle = faint (covering ground); on a live detection the
// whole rig brightens and a one-shot flash fires on a NEW detection. Bloom does
// the glow. All imperative — no per-frame React.
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { useSafetyLayer } from '../../lib/safetyLayer'
import { ppeCameraDetections } from '../../lib/ppeVision'
import { coneMat, sweepMat } from './safetyShaders'

const HEAD_Y = 3.6
const BLUE = new THREE.Color('#38B6FF'), REDC = new THREE.Color('#FF5A4D')

function buildGeos(apex, r) {
  const N = 56
  const ring = []
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2; ring.push([Math.cos(a) * r, 0.05, Math.sin(a) * r]) }
  // cone side (apex→ring) with aT (1 apex, 0 ring)
  const cp = [], ct = []
  for (let i = 0; i < N; i++) {
    cp.push(apex[0], apex[1], apex[2], ring[i][0], ring[i][1], ring[i][2], ring[i + 1][0], ring[i + 1][1], ring[i + 1][2])
    ct.push(1, 0, 0)
  }
  const coneGeo = new THREE.BufferGeometry()
  coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3))
  coneGeo.setAttribute('aT', new THREE.Float32BufferAttribute(ct, 1))
  // radar sweep sector (~48°) with aAng (0 leading → 1 trailing)
  const spread = 0.84, M = 12
  const sp = [0, 0.06, 0], sa = [0]
  for (let i = 0; i <= M; i++) { const a = (i / M) * spread; sp.push(Math.cos(a) * r, 0.06, Math.sin(a) * r); sa.push(i / M) }
  const sidx = []; for (let i = 1; i <= M; i++) sidx.push(0, i, i + 1)
  const sweepGeo = new THREE.BufferGeometry()
  sweepGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3))
  sweepGeo.setAttribute('aAng', new THREE.Float32BufferAttribute(sa, 1))
  sweepGeo.setIndex(sidx)
  return { coneGeo, sweepGeo, r }
}

function CameraFov({ cam }) {
  const coneRef = useRef(), sweepGrp = useRef(), sweepRef = useRef(), ringRef = useRef(), discRef = useRef()
  const prevCount = useRef(0), flash = useRef(0)
  const mats = useMemo(() => ({ cone: coneMat(), sweep: sweepMat() }), [cam.id])
  const { center, geos } = useMemo(() => {
    const p = cam.position || [0, 0, 0], w = cam.config?.watch
    const c = Array.isArray(w?.point) ? [w.point[0], 0.06, w.point[2]] : [p[0], 0.06, p[2]]
    const r = w?.radius ?? 12
    return { center: c, geos: buildGeos([p[0] - c[0], HEAD_Y, p[2] - c[2]], r) }
  }, [cam.id])

  useFrame(({ clock }, dt) => {
    const dets = ppeCameraDetections(cam.id)
    const n = dets.length, hasViol = dets.some(d => !d.compliant)
    if (n > prevCount.current) flash.current = 0.4
    prevCount.current = n
    flash.current = Math.max(0, flash.current - dt)
    const active = n > 0, t = clock.elapsedTime
    const pulse = 0.5 + 0.5 * Math.sin(t * 3)
    const col = hasViol && active ? REDC : BLUE
    const glow = (active ? (hasViol ? 0.30 : 0.22) : 0.08) + flash.current * 0.6
    mats.cone.uniforms.uColor.value.copy(col); mats.cone.uniforms.uOpacity.value = glow; mats.cone.uniforms.uTime.value = t
    mats.sweep.uniforms.uColor.value.copy(col); mats.sweep.uniforms.uOpacity.value = (active ? 0.42 : 0.18) + flash.current * 0.5
    if (sweepGrp.current) sweepGrp.current.rotation.y = t * (active ? 1.5 : 0.65)
    if (ringRef.current) { ringRef.current.material.color.copy(col); ringRef.current.material.opacity = (active ? 0.85 + 0.15 * pulse : 0.5) }
    if (discRef.current) { discRef.current.material.color.copy(col); discRef.current.material.opacity = (active ? 0.14 : 0.05) + flash.current * 0.25 }
  })

  return (
    <group position={center}>
      <mesh geometry={geos.coneGeo} material={mats.cone} renderOrder={2} />
      {/* faint footprint fill + crisp glowing boundary ring */}
      <mesh ref={discRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={1}>
        <circleGeometry args={[geos.r, 56]} />
        <meshBasicMaterial color={BLUE} transparent opacity={0.035} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={3}>
        <ringGeometry args={[geos.r - 0.22, geos.r, 64]} />
        <meshBasicMaterial color={BLUE} transparent opacity={0.4} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <group ref={sweepGrp}><mesh ref={sweepRef} geometry={geos.sweepGeo} material={mats.sweep} renderOrder={2} /></group>
    </group>
  )
}

export function CameraFovLayer() {
  const on = useSafetyLayer(s => s.on)   // gated like the other safety overlays — the projector beam in DetectionBoxLayer conveys scanning
  const camKey = useSceneStore(s => Object.keys(s.objects).filter(id => s.objects[id].type === 'ppe_camera').sort().join(','))
  const cams = useMemo(() => {
    const o = useSceneStore.getState().objects
    return (camKey ? camKey.split(',') : []).map(id => ({ id, position: o[id].position, config: o[id].config }))
  }, [camKey])
  if (!on) return null
  return <>{cams.map(c => <CameraFov key={c.id} cam={c} />)}</>
}
