// Site worker — a real human figure (replaces the blocky CompositeAsset parts).
// Registered as MACHINE_COMPONENTS['site_worker'] so SceneRenderer/AssetInspector
// route to it with the standard machine-component props. Procedural geometry
// only, tapered capsule limbs + rounded torso, seeded per-worker variation,
// distance-driven gait (never skates), idle micro-motion, LOD, PPE part toggles.
//
// Named parts (PPE toggling): helmet, hair, head, torso_vest, torso_body,
// arm_l/r_upper, arm_l/r_lower, hand_l/r, glove_l/r, pelvis, leg_l/r_upper,
// leg_l/r_lower, boot_l/r. config.ppe {helmet,hiVis,boots,gloves} — false hides
// that part and reveals what's underneath.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { registerWorker, unregisterWorker } from '../../lib/workerPosMap'
import { useSafetyLayer } from '../../lib/safetyLayer'

// ── proportions (metres, crown ≈ 1.75) ──
const P = {
  hip: 0.90, pelvisH: 0.17, torsoH: 0.55, torsoW: 0.34, torsoD: 0.24, shoulderW: 0.45,
  neckY: 1.50, headY: 1.645, headR: 0.115,
  upperArmLen: 0.30, forearmLen: 0.27, thighLen: 0.42, calfLen: 0.40,
}

// ── shared geometry cache (built once, reused across all 7 workers) ──
const _geo = new Map()
const G = (key, make) => { let g = _geo.get(key); if (!g) { g = make(); _geo.set(key, g) } return g }
// tapered limb: capsule gives smooth rounded ends; radial 6 / caps 2 keeps tris low
const capsule = (r, len) => G(`cap${r}_${len}`, () => new THREE.CapsuleGeometry(r, Math.max(0.02, len), 1, 4))
const sphere = (r, w = 6, h = 4) => G(`sph${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h))
const rbox = (w, h, d, rad = 0.03) => G(`rb${w}_${h}_${d}_${rad}`, () => new RoundedBoxGeometry(w, h, d, 1, rad))
const cyl = (rt, rb, h, s = 6) => G(`cy${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s))
const box = (w, h, d) => G(`bx${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d))
const disc = G('disc', () => new THREE.CircleGeometry(0.36, 14))
const dome = G('dome', () => new THREE.SphereGeometry(0.155, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.62))
const brim = G('brim', () => new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10))
const ring = G('ring', () => new THREE.RingGeometry(0.34, 0.4, 24))

// ── material cache (by variant key — never per-instance) ──
const _mat = new Map()
const M = (key, make) => { let m = _mat.get(key); if (!m) { m = make(); _mat.set(key, m) } return m }
const std = (color, rough, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...opts })
const SKIN = ['#C08A63', '#9C6B45', '#E0B48C']
const HIVIS = '#F5A524', BAND = '#E8EDF2'
const shirtMat = (i) => M(`shirt${i}`, () => std(new THREE.Color('#2C4A63').offsetHSL(0, 0, (i - 1) * 0.06), 0.85))
const trouserMat = (i) => M(`trou${i}`, () => std(new THREE.Color('#3A4550').offsetHSL(0, 0, (i - 1) * 0.06), 0.9))
const skinMat = (i) => M(`skin${i}`, () => std(SKIN[i], 0.75))
const vestMat = M('vest', () => std(HIVIS, 0.55, { emissive: HIVIS, emissiveIntensity: 0.06 }))
const bandMat = M('band', () => std(BAND, 0.25, { metalness: 0.15 }))
const helmetMat = (sup) => M(sup ? 'helmSup' : 'helm', () => std(sup ? '#FFFFFF' : '#F2C230', 0.35))
const hairMat = M('hair', () => std('#241a12', 0.8))
const bootMat = M('boot', () => std('#2A2A2E', 0.6))
const gloveMat = M('glove', () => std('#1F2933', 0.7))
const shadowMat = M('wshadow', () => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }))

// FNV-1a + a murmur3 finalizer. The finalizer matters: worker ids share the
// long "worker-" prefix and differ only in the last char(s), and plain FNV-1a
// avalanches those tiny tail diffs poorly (shirt/height collapse to one value).
// The xorshift-multiply avalanche spreads near-identical inputs across [0,1).
const hash01 = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 15; h = Math.imul(h, 2246822519)
  h ^= h >>> 13; h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function SiteWorker({ status = 'running', config = {}, objId = 'worker', name = 'Worker', alertSev = null }) {
  const root = useRef()
  const legL = useRef(), legR = useRef(), calfL = useRef(), calfR = useRef()
  const armL = useRef(), armR = useRef(), foreL = useRef(), foreR = useRef()
  const torso = useRef(), headG = useRef(), pelvis = useRef()
  const tag = useRef(), ringRef = useRef()
  const prevPos = useRef(new THREE.Vector3())
  const stride = useRef(0), initDone = useRef(false)
  const { camera } = useThree()
  const safetyOn = useSafetyLayer((s) => s.on)

  // deterministic per-worker variation
  const v = useMemo(() => {
    const r = hash01(objId)
    const role = config.role || (r < 0.18 ? 'supervisor' : r < 0.34 ? 'maintenance' : 'operator')
    return {
      skin: Math.floor(hash01(objId + 's') * 3), shirt: Math.floor(hash01(objId + 'h') * 3),
      trouser: Math.floor(hash01(objId + 't') * 3), height: 0.94 + hash01(objId + 'z') * 0.12,
      phase: r * Math.PI * 2, twist: (hash01(objId + 'w') - 0.5) * 0.14, role,
      hipDrop: hash01(objId + 'd') * 0.012,
    }
  }, [objId, config.role])
  const ppe = { helmet: true, hiVis: true, boots: true, gloves: true, ...(config.ppe || {}) }
  const supervisor = v.role === 'supervisor'
  const reg = useMemo(() => registerWorker(objId), [objId])
  useEffect(() => () => unregisterWorker(objId), [objId])

  useFrame(({ clock }, dt) => {
    const g = root.current; if (!g) return
    const t = clock.elapsedTime + v.phase
    // world position → distance walked this frame (drives gait, never skates)
    g.getWorldPosition(reg.pos)
    if (!initDone.current) { prevPos.current.copy(reg.pos); initDone.current = true }
    const moved = reg.pos.distanceTo(prevPos.current)
    prevPos.current.copy(reg.pos)
    reg.ppeOk = ppe.helmet && ppe.hiVis && ppe.boots && ppe.gloves

    // LOD: freeze idle/gait maths far away (geometry stays; cheap)
    const dist = camera.position.distanceTo(reg.pos)
    if (dist > 60) return

    const walking = moved > 1e-4
    if (walking) {
      stride.current += moved / 0.72                    // step length ~0.72 m
      const s = stride.current * Math.PI * 2
      const sw = 0.55
      if (legL.current) legL.current.rotation.x = Math.sin(s) * sw
      if (legR.current) legR.current.rotation.x = Math.sin(s + Math.PI) * sw
      if (calfL.current) calfL.current.rotation.x = Math.max(0, -Math.cos(s)) * 0.7
      if (calfR.current) calfR.current.rotation.x = Math.max(0, -Math.cos(s + Math.PI)) * 0.7
      if (armL.current) armL.current.rotation.x = 0.14 + Math.sin(s + Math.PI) * sw * 0.6
      if (armR.current) armR.current.rotation.x = 0.14 + Math.sin(s) * sw * 0.6
      if (torso.current) torso.current.position.y = Math.abs(Math.sin(s)) * 0.015
    } else {
      // idle: breathing, weight shift, occasional head turn — seeded, unsynced
      if (torso.current) torso.current.scale.y = 1 + Math.sin(t * 1.5) * 0.008
      if (pelvis.current) pelvis.current.position.x = Math.sin(t * 1.0) * 0.012
      if (headG.current) headG.current.rotation.y = Math.sin(t * 0.35) * 0.25
      // ease legs/arms back toward the resting pose
      for (const ref of [legL, legR, calfL, calfR]) if (ref.current) ref.current.rotation.x *= 0.9
      if (armL.current) armL.current.rotation.x += (0.12 - armL.current.rotation.x) * 0.1
      if (armR.current) armR.current.rotation.x += (0.12 - armR.current.rotation.x) * 0.1
    }
    // wearable tag pulse + compliance ring (safety layer only)
    if (safetyOn && tag.current) tag.current.scale.setScalar(1 + Math.sin(t * 3) * 0.15)
  })

  const skin = skinMat(v.skin), shirt = shirtMat(v.shirt), trouser = trouserMat(v.trouser)
  const ringColor = reg.prox === 'danger' ? '#F04438' : reg.prox === 'warn' ? '#F79009' : (reg.ppeOk ? '#12B76A' : '#F04438')

  return (
    <group ref={root} scale={[v.height, v.height, v.height]} rotation={[0, 0, v.twist * 0.3]}>
      {/* soft contact shadow */}
      <mesh geometry={disc} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} />

      {/* legs (hip pivots at y=hip) */}
      {[[-0.135, legL, calfL], [0.135, legR, calfR]].map(([z, lref, cref], i) => (
        <group key={i} ref={lref} position={[0, P.hip - (i === 0 ? v.hipDrop : 0), z]} rotation={[0, 0, (i ? 1 : -1) * 0.03]}>
          <mesh name={i ? 'leg_r_upper' : 'leg_l_upper'} geometry={capsule(0.075, P.thighLen)} material={trouser}
            position={[0, -P.thighLen / 2, 0]} castShadow />
          <group ref={cref} position={[0, -P.thighLen, 0]}>
            <mesh name={i ? 'leg_r_lower' : 'leg_l_lower'} geometry={capsule(0.055, P.calfLen)} material={trouser}
              position={[0, -P.calfLen / 2, 0]} castShadow />
            {/* hi-vis calf band */}
            <mesh geometry={cyl(0.062, 0.062, 0.05)} material={ppe.hiVis ? vestMat : trouser} position={[0, -P.calfLen * 0.55, 0]} />
            {/* boot */}
            <mesh name={i ? 'boot_r' : 'boot_l'} geometry={capsule(0.05, 0.14)} material={ppe.boots ? bootMat : trouser}
              position={[0, -P.calfLen - 0.03, -0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[1.0, 1.0, 1.35]} castShadow />
          </group>
        </group>
      ))}

      {/* pelvis + torso stack */}
      <group ref={pelvis} position={[0, 0, 0]}>
        <mesh name="pelvis" geometry={box(0.33, P.pelvisH, 0.22)} material={trouser} position={[0, P.hip + 0.02, 0]} castShadow />
        <group ref={torso} position={[0, 0, 0]}>
          <mesh name="torso_body" geometry={rbox(P.shoulderW, P.torsoH, P.torsoD, 0.04)} material={shirt}
            position={[0, P.hip + 0.05 + P.torsoH / 2, 0]} castShadow receiveShadow />
          {ppe.hiVis && (
            <group position={[0, P.hip + 0.05 + P.torsoH / 2, 0]}>
              <mesh name="torso_vest" geometry={box(P.shoulderW + 0.02, P.torsoH * 0.82, P.torsoD + 0.02)} material={vestMat} />
              {/* reflective bands: chest + shoulders */}
              <mesh geometry={box(P.shoulderW + 0.03, 0.05, P.torsoD + 0.03)} material={bandMat} position={[0, 0.02, 0]} />
              <mesh geometry={box(0.05, P.torsoH * 0.7, 0.05)} material={bandMat} position={[0.14, 0.02, 0.12]} rotation={[0, 0, 0.15]} />
              <mesh geometry={box(0.05, P.torsoH * 0.7, 0.05)} material={bandMat} position={[-0.14, 0.02, 0.12]} rotation={[0, 0, -0.15]} />
            </group>
          )}
          {/* maintenance tool belt */}
          {v.role === 'maintenance' && (
            <mesh geometry={G('belt', () => new THREE.TorusGeometry(0.19, 0.03, 4, 10))} material={gloveMat}
              position={[0, P.hip + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} />
          )}

          {/* arms (shoulder pivots) */}
          {[[-0.24, armL, foreL, -8], [0.24, armR, foreR, 8]].map(([z, aref, fref, splay], i) => (
            <group key={i} ref={aref} position={[0, P.hip + 0.05 + P.torsoH - 0.03, z]} rotation={[0.12, 0, (splay * Math.PI) / 180]}>
              <mesh name={i ? 'arm_r_upper' : 'arm_l_upper'} geometry={capsule(0.05, P.upperArmLen)} material={ppe.hiVis ? vestMat : shirt}
                position={[0, -P.upperArmLen / 2, 0]} castShadow />
              <group ref={fref} position={[0, -P.upperArmLen, 0]} rotation={[0.2, 0, 0]}>
                <mesh name={i ? 'arm_r_lower' : 'arm_l_lower'} geometry={capsule(0.042, P.forearmLen)} material={shirt}
                  position={[0, -P.forearmLen / 2, 0]} castShadow />
                <mesh name={i ? (ppe.gloves ? 'glove_r' : 'hand_r') : (ppe.gloves ? 'glove_l' : 'hand_l')}
                  geometry={sphere(0.05, 5, 4)} material={ppe.gloves ? gloveMat : skin} position={[0, -P.forearmLen - 0.03, 0]} castShadow />
              </group>
            </group>
          ))}

          {/* clipboard prop for supervisor */}
          {supervisor && (
            <mesh geometry={rbox(0.16, 0.22, 0.02, 0.01)} material={M('clip', () => std('#d8d2c4', 0.6))}
              position={[0.2, P.hip + 0.35, 0.16]} rotation={[0.3, 0.4, 0]} />
          )}

          {/* neck + head */}
          <mesh geometry={cyl(0.045, 0.05, 0.08)} material={skin} position={[0, P.neckY, 0]} />
          <group ref={headG} position={[0, P.headY, 0]} rotation={[0.05, 0, 0]}>
            <mesh name="head" geometry={sphere(P.headR, 7, 5)} material={skin} scale={[1, 1.15, 0.95]} castShadow />
            <mesh geometry={box(0.15, 0.08, 0.14)} material={skin} position={[0, -0.05, 0.01]} />{/* jaw mass */}
            {/* hair cap — shown only when bare-headed (helmet fully covers it) */}
            {!ppe.helmet && <mesh name="hair" geometry={dome} material={hairMat} position={[0, 0.01, 0]} scale={[0.82, 0.7, 0.82]} />}
            {ppe.helmet && (
              <group name="helmet">
                <mesh geometry={dome} material={helmetMat(supervisor)} position={[0, 0.03, 0]} castShadow />
                <mesh geometry={brim} material={helmetMat(supervisor)} position={[0, 0.05, 0.05]} />
                  </group>
            )}
          </group>
        </group>
      </group>

      {/* wearable tag + compliance ring (safety layer only) */}
      {safetyOn && (
        <>
          <mesh ref={tag} geometry={sphere(0.03, 6, 5)} material={M(`tag${ringColor}`, () => std(ringColor, 0.4, { emissive: ringColor, emissiveIntensity: 0.6, toneMapped: false }))}
            position={[0.16, P.hip + 0.45, 0.14]} />
          <mesh ref={ringRef} geometry={ring} material={M(`wring${ringColor}`, () => new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.6, side: 2, depthWrite: false, toneMapped: false }))}
            rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
        </>
      )}
    </group>
  )
}
