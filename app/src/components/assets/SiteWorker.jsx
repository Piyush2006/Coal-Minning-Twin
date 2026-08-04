// Site worker — a real rigged GLB human (construction+worker model), with a
// procedural body as the automatic fallback while loading / on any load failure.
// Registered as MACHINE_COMPONENTS['site_worker'] so SceneRenderer/AssetInspector
// route to it with the standard machine-component props.
//
// The GLB ships as ONE fused skinned mesh with the albedo mis-assigned to the
// metalness slot. At load (once) we: rewire the texture, and SPLIT the helmet
// triangles into their own skinned mesh so the hard hat can genuinely be hidden
// for the PPE-violation story (config.ppe.helmet === false → helmet gone + a
// procedural hair cap shows under it). Every instance is a SkeletonUtils clone
// (skinned meshes need their skeletons rebound — drei <Clone> won't do that).
//
// Motion (distance-driven gait + idle) is bone-driven; the outer component owns
// world-position tracking (workerPosMap), LOD, and the safety ring/tag.
import { useRef, useMemo, useEffect, Suspense, Component } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry, SkeletonUtils } from 'three-stdlib'
import { registerWorker, unregisterWorker } from '../../lib/workerPosMap'
import { useSafetyLayer } from '../../lib/safetyLayer'

const MODEL_URL = '/models/site_worker.glb'
useGLTF.preload(MODEL_URL)
const MODEL_YAW = Math.PI            // model faces -X in bind pose → rotate to +X (PathDrive forward); tuned by screenshot
const TARGET_H = 1.78                // crown height (m) before per-worker height scale

// ── proportions (metres) — used by the procedural FALLBACK body ──
const P = {
  hip: 0.90, pelvisH: 0.17, torsoH: 0.55, torsoW: 0.34, torsoD: 0.24, shoulderW: 0.45,
  neckY: 1.50, headY: 1.645, headR: 0.115,
  upperArmLen: 0.30, forearmLen: 0.27, thighLen: 0.42, calfLen: 0.40,
}
const _geo = new Map()
const G = (key, make) => { let g = _geo.get(key); if (!g) { g = make(); _geo.set(key, g) } return g }
const capsule = (r, len) => G(`cap${r}_${len}`, () => new THREE.CapsuleGeometry(r, Math.max(0.02, len), 1, 4))
const sphere = (r, w = 6, h = 4) => G(`sph${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h))
const rbox = (w, h, d, rad = 0.03) => G(`rb${w}_${h}_${d}_${rad}`, () => new RoundedBoxGeometry(w, h, d, 1, rad))
const cyl = (rt, rb, h, s = 6) => G(`cy${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s))
const box = (w, h, d) => G(`bx${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d))
const disc = G('disc', () => new THREE.CircleGeometry(0.36, 14))
const dome = G('dome', () => new THREE.SphereGeometry(0.155, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.62))
const brim = G('brim', () => new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10))
const ring = G('ring', () => new THREE.RingGeometry(0.34, 0.4, 24))
const hairDome = G('hairDome', () => new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62))

const _mat = new Map()
const M = (key, make) => { let m = _mat.get(key); if (!m) { m = make(); _mat.set(key, m) } return m }
const std = (color, rough, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...opts })
const SKIN = ['#C08A63', '#9C6B45', '#E0B48C']
const HAIR = ['#241a12', '#3a2a1a', '#1a1a1a', '#5a4632']
const HIVIS = '#F5A524', BAND = '#E8EDF2'
const shirtMat = (i) => M(`shirt${i}`, () => std(new THREE.Color('#2C4A63').offsetHSL(0, 0, (i - 1) * 0.06), 0.85))
const trouserMat = (i) => M(`trou${i}`, () => std(new THREE.Color('#3A4550').offsetHSL(0, 0, (i - 1) * 0.06), 0.9))
const skinMat = (i) => M(`skin${i}`, () => std(SKIN[i], 0.75))
const vestMat = M('vest', () => std(HIVIS, 0.55, { emissive: HIVIS, emissiveIntensity: 0.06 }))
const bandMat = M('band', () => std(BAND, 0.25, { metalness: 0.15 }))
const helmetMat = (sup) => M(sup ? 'helmSup' : 'helm', () => std(sup ? '#FFFFFF' : '#F2C230', 0.35))
const hairMatOf = (i) => M(`hair${i}`, () => std(HAIR[i % HAIR.length], 0.85))
const bootMat = M('boot', () => std('#2A2A2E', 0.6))
const gloveMat = M('glove', () => std('#1F2933', 0.7))
const shadowMat = M('wshadow', () => new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }))

const hash01 = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 15; h = Math.imul(h, 2246822519)
  h ^= h >>> 13; h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// ─────────────────────────────────────────────────────────────────────────
//  GLB source preparation (runs ONCE on the shared cached gltf scene)
// ─────────────────────────────────────────────────────────────────────────
let _prepared = null
function decodeAlbedoSampler(texture) {
  // returns (u,v) -> [r,g,b] in 0..1 from the texture image, or null
  try {
    const img = texture.image
    const w = img.width, h = img.height
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, w, h).data
    return (u, vv) => {
      const x = Math.min(w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * w)))
      const y = Math.min(h - 1, Math.max(0, Math.floor((1 - (vv - Math.floor(vv))) * h)))
      const o = (y * w + x) * 4
      return [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255]
    }
  } catch { return null }
}

function prepareSource(gltf) {
  if (_prepared) return _prepared
  const scene = gltf.scene
  let skinned = null
  scene.traverse((o) => { if (o.isSkinnedMesh) skinned = o })
  if (!skinned) { _prepared = scene; return scene }

  // texture rewire: the albedo atlas ships in the metalnessRoughness slot
  const mat = skinned.material
  if (mat && mat.metalnessMap && !mat.map) {
    mat.map = mat.metalnessMap
    mat.map.colorSpace = THREE.SRGBColorSpace
    mat.map.flipY = false
    mat.metalnessMap = null; mat.roughnessMap = null
    mat.metalness = 0.05; mat.roughness = 0.82; mat.side = THREE.FrontSide
    mat.needsUpdate = true
  }
  skinned.frustumCulled = false
  skinned.castShadow = true; skinned.receiveShadow = true

  // ── helmet split ──────────────────────────────────────────────────────
  const geo = skinned.geometry
  const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight
  const uv = geo.attributes.uv || geo.attributes.texcoord_0
  const index = geo.index
  const bones = skinned.skeleton.bones
  const headBone = new Set()
  bones.forEach((b, i) => { if (/^(Head|NeckTwist)/.test(b.name)) headBone.add(i) })
  const sampler = mat?.map ? decodeAlbedoSampler(mat.map) : null

  const n = pos.count
  const isHelmet = new Uint8Array(n)
  for (let v = 0; v < n; v++) {
    let hw = 0
    for (let k = 0; k < 4; k++) { if (headBone.has(si.getComponent(v, k))) hw += sw.getComponent(v, k) }
    if (hw < 0.35) continue
    const y = pos.getY(v), r = Math.hypot(pos.getX(v), pos.getZ(v))
    let yellow = false
    if (sampler && uv) {
      const [rr, gg, bb] = sampler(uv.getX(v), uv.getY(v))
      yellow = rr > 0.5 && gg > 0.38 && bb < 0.55 && (rr + gg) > 2.05 * bb
    }
    // helmet: head-bound AND (clearly yellow paint) OR (above the brow / bulging dome)
    isHelmet[v] = (yellow || y > 0.90 || (y > 0.85 && r > 0.072)) ? 1 : 0
  }
  const bodyIdx = [], helmIdx = []
  const A = new Uint32Array(3)
  for (let t = 0; t < index.count; t += 3) {
    A[0] = index.getX(t); A[1] = index.getX(t + 1); A[2] = index.getX(t + 2)
    if (isHelmet[A[0]] && isHelmet[A[1]] && isHelmet[A[2]]) helmIdx.push(A[0], A[1], A[2])
    else bodyIdx.push(A[0], A[1], A[2])
  }

  if (helmIdx.length > 30) {
    const makeMesh = (indices, nm) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', pos)
      if (geo.attributes.normal) g.setAttribute('normal', geo.attributes.normal)
      if (uv) g.setAttribute('uv', uv)
      g.setAttribute('skinIndex', si); g.setAttribute('skinWeight', sw)
      g.setIndex(indices.length > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1))
      const m = new THREE.SkinnedMesh(g, mat)
      m.name = nm; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true
      m.bind(skinned.skeleton, skinned.bindMatrix)
      return m
    }
    const bodyMesh = makeMesh(bodyIdx, 'worker_body')
    const helmMesh = makeMesh(helmIdx, 'worker_helmet')
    const parent = skinned.parent
    parent.add(bodyMesh); parent.add(helmMesh)
    parent.remove(skinned)
  } else {
    skinned.name = 'worker_body'   // split failed — one mesh, helmet not removable
  }
  _prepared = scene
  return scene
}

// ─────────────────────────────────────────────────────────────────────────
//  GLB body (primary) — one SkeletonUtils clone per worker
// ─────────────────────────────────────────────────────────────────────────
const _q = new THREE.Quaternion(), _e = new THREE.Euler()
const rotQ = (x, y, z) => _q.setFromEuler(_e.set(x, y, z)).clone()

// Aim a bone so its segment (bone→childBone) points along a WORLD direction — no
// per-rig axis guessing. Used to fold the model out of its wide A-pose bind into
// a natural standing rest (arms down, legs together). Parent must be aimed first.
const _bw = new THREE.Vector3(), _cw = new THREE.Vector3(), _cur = new THREE.Vector3()
const _tgt = new THREE.Vector3(), _rot = new THREE.Quaternion(), _ow = new THREE.Quaternion(), _pw = new THREE.Quaternion()
function aimBone(bone, child, tx, ty, tz) {
  if (!bone || !child) return
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(true, false)
  _bw.setFromMatrixPosition(bone.matrixWorld); _cw.setFromMatrixPosition(child.matrixWorld)
  _cur.subVectors(_cw, _bw); if (_cur.lengthSq() < 1e-8) return; _cur.normalize()
  _tgt.set(tx, ty, tz).normalize()
  _rot.setFromUnitVectors(_cur, _tgt)
  bone.getWorldQuaternion(_ow)
  bone.parent.getWorldQuaternion(_pw)
  bone.quaternion.copy(_pw.invert().multiply(_rot).multiply(_ow))
  bone.updateWorldMatrix(true, true)
}

function GLBBody({ v, ppe, motion, supervisor }) {
  const { scene } = useGLTF(MODEL_URL)
  const built = useMemo(() => {
    const src = prepareSource({ scene })
    const inst = SkeletonUtils.clone(src)
    // measure → scale to TARGET_H, ground feet at y=0
    const bbox = new THREE.Box3().setFromObject(inst)
    const size = new THREE.Vector3(); bbox.getSize(size)
    const scale = TARGET_H / (size.y || 1)
    inst.scale.setScalar(scale)                 // normalize crown to TARGET_H
    inst.position.y = -bbox.min.y * scale       // ground feet at y=0
    // bones + helmet + head
    const bone = {}
    let helmet = null, head = null
    inst.traverse((o) => {
      if (o.isBone) bone[o.name] = o
      if (o.name === 'worker_helmet') helmet = o
      if (o.name === 'Head') head = o
    })
    // per-instance material tint (clone so the shared source stays neutral)
    const tint = 0.90 + hash01(v.objId + 'c') * 0.16
    inst.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.multiplyScalar(tint) } })
    // hair cap under the helmet (shown only when helmet is off)
    let hair = null
    if (head) {
      hair = new THREE.Mesh(hairDome, hairMatOf(v.hairIdx))
      hair.name = 'worker_hair'; hair.scale.setScalar(1.15); hair.position.set(0, 0.02, 0)
      hair.castShadow = true
      head.add(hair)
    }
    // rest-pose correction: fold the wide A-pose bind into a natural stand — aim
    // each limb segment along a world direction (parent segment first).
    aimBone(bone.L_Upperarm, bone.L_Forearm, 0.14, -1, 0.05)   // arms hang down, tucked slightly in
    aimBone(bone.L_Forearm, bone.L_Hand, 0.05, -1, 0.12)
    aimBone(bone.R_Upperarm, bone.R_Forearm, -0.14, -1, 0.05)
    aimBone(bone.R_Forearm, bone.R_Hand, -0.05, -1, 0.12)
    aimBone(bone.L_Thigh, bone.L_Calf, 0.02, -1, 0)            // legs straighten + close
    aimBone(bone.L_Calf, bone.L_Foot, 0, -1, 0.02)
    aimBone(bone.R_Thigh, bone.R_Calf, -0.02, -1, 0)
    aimBone(bone.R_Calf, bone.R_Foot, 0, -1, 0.02)
    inst.updateMatrixWorld(true)
    // stored base quats include the correction; gait modulates around them.
    const base = {}
    for (const nm of ['L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'L_Upperarm', 'R_Upperarm', 'Spine01', 'Head', 'Pelvis']) {
      if (bone[nm]) base[nm] = bone[nm].quaternion.clone()
    }
    return { inst, scale, bone, base, helmet, head, hair }
  }, [scene, v.objId, v.hairIdx])

  // helmet / hair visibility from PPE (cheap; runs on ppe change)
  useEffect(() => {
    if (built.helmet) built.helmet.visible = ppe.helmet !== false
    if (built.hair) built.hair.visible = ppe.helmet === false
  }, [built, ppe.helmet])

  const stride = useRef(0)
  useFrame(() => {
    const m = motion.current
    const { bone, base } = built
    if (m.dist > 60) return                       // LOD: freeze bone writes far away
    const set = (nm, dx, dz = 0) => { const b = bone[nm]; if (b && base[nm]) { b.quaternion.copy(base[nm]).multiply(rotQ(dx, 0, dz)) } }
    if (m.walking) {
      stride.current += m.moved / 0.78
      const s = stride.current * Math.PI * 2, sw = 0.55
      set('L_Thigh', Math.sin(s) * sw); set('R_Thigh', Math.sin(s + Math.PI) * sw)
      set('L_Calf', Math.max(0, -Math.cos(s)) * 0.75); set('R_Calf', Math.max(0, -Math.cos(s + Math.PI)) * 0.75)
      set('L_Upperarm', 0, Math.sin(s + Math.PI) * 0.30); set('R_Upperarm', 0, -Math.sin(s) * 0.30)
      if (built.head) built.head.position.y = built.head.userData.baseY ?? built.head.position.y
    } else {
      // idle: subtle breathing + head sway; ease limbs back to base
      const t = m.t
      set('L_Thigh', 0); set('R_Thigh', 0); set('L_Calf', 0); set('R_Calf', 0)
      set('L_Upperarm', 0, 0); set('R_Upperarm', 0, 0)
      if (bone.Spine01 && base.Spine01) bone.Spine01.quaternion.copy(base.Spine01).multiply(rotQ(Math.sin(t * 1.3) * 0.012, 0, 0))
      if (bone.Head && base.Head) bone.Head.quaternion.copy(base.Head).multiply(rotQ(0, Math.sin(t * 0.35) * 0.20, 0))
    }
  })

  return <group rotation={[0, MODEL_YAW, 0]}><primitive object={built.inst} /></group>
}

// ─────────────────────────────────────────────────────────────────────────
//  Procedural body (FALLBACK while loading / on GLB failure) — self-contained
// ─────────────────────────────────────────────────────────────────────────
function ProceduralBody({ v, ppe, supervisor, motion }) {
  const legL = useRef(), legR = useRef(), calfL = useRef(), calfR = useRef()
  const armL = useRef(), armR = useRef(), foreL = useRef(), foreR = useRef()
  const torso = useRef(), headG = useRef(), pelvis = useRef()
  const stride = useRef(0)
  useFrame(() => {
    const m = motion.current
    if (m.dist > 60) return
    if (m.walking) {
      stride.current += m.moved / 0.72
      const s = stride.current * Math.PI * 2, sw = 0.55
      if (legL.current) legL.current.rotation.x = Math.sin(s) * sw
      if (legR.current) legR.current.rotation.x = Math.sin(s + Math.PI) * sw
      if (calfL.current) calfL.current.rotation.x = Math.max(0, -Math.cos(s)) * 0.7
      if (calfR.current) calfR.current.rotation.x = Math.max(0, -Math.cos(s + Math.PI)) * 0.7
      if (armL.current) armL.current.rotation.x = 0.14 + Math.sin(s + Math.PI) * sw * 0.6
      if (armR.current) armR.current.rotation.x = 0.14 + Math.sin(s) * sw * 0.6
      if (torso.current) torso.current.position.y = Math.abs(Math.sin(s)) * 0.015
    } else {
      const t = m.t
      if (torso.current) torso.current.scale.y = 1 + Math.sin(t * 1.5) * 0.008
      if (pelvis.current) pelvis.current.position.x = Math.sin(t * 1.0) * 0.012
      if (headG.current) headG.current.rotation.y = Math.sin(t * 0.35) * 0.25
      for (const ref of [legL, legR, calfL, calfR]) if (ref.current) ref.current.rotation.x *= 0.9
      if (armL.current) armL.current.rotation.x += (0.12 - armL.current.rotation.x) * 0.1
      if (armR.current) armR.current.rotation.x += (0.12 - armR.current.rotation.x) * 0.1
    }
  })
  const skin = skinMat(v.skin), shirt = shirtMat(v.shirt), trouser = trouserMat(v.trouser)
  return (
    <>
      {[[-0.135, legL, calfL], [0.135, legR, calfR]].map(([z, lref, cref], i) => (
        <group key={i} ref={lref} position={[0, P.hip - (i === 0 ? v.hipDrop : 0), z]} rotation={[0, 0, (i ? 1 : -1) * 0.03]}>
          <mesh geometry={capsule(0.075, P.thighLen)} material={trouser} position={[0, -P.thighLen / 2, 0]} castShadow />
          <group ref={cref} position={[0, -P.thighLen, 0]}>
            <mesh geometry={capsule(0.055, P.calfLen)} material={trouser} position={[0, -P.calfLen / 2, 0]} castShadow />
            <mesh geometry={cyl(0.062, 0.062, 0.05)} material={ppe.hiVis ? vestMat : trouser} position={[0, -P.calfLen * 0.55, 0]} />
            <mesh geometry={capsule(0.05, 0.14)} material={ppe.boots ? bootMat : trouser} position={[0, -P.calfLen - 0.03, -0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[1.0, 1.0, 1.35]} castShadow />
          </group>
        </group>
      ))}
      <group ref={pelvis}>
        <mesh geometry={box(0.33, P.pelvisH, 0.22)} material={trouser} position={[0, P.hip + 0.02, 0]} castShadow />
        <group ref={torso}>
          <mesh geometry={rbox(P.shoulderW, P.torsoH, P.torsoD, 0.04)} material={shirt} position={[0, P.hip + 0.05 + P.torsoH / 2, 0]} castShadow receiveShadow />
          {ppe.hiVis && (
            <group position={[0, P.hip + 0.05 + P.torsoH / 2, 0]}>
              <mesh geometry={box(P.shoulderW + 0.02, P.torsoH * 0.82, P.torsoD + 0.02)} material={vestMat} />
              <mesh geometry={box(P.shoulderW + 0.03, 0.05, P.torsoD + 0.03)} material={bandMat} position={[0, 0.02, 0]} />
            </group>
          )}
          {[[-0.24, armL, foreL, -8], [0.24, armR, foreR, 8]].map(([z, aref, fref, splay], i) => (
            <group key={i} ref={aref} position={[0, P.hip + 0.05 + P.torsoH - 0.03, z]} rotation={[0.12, 0, (splay * Math.PI) / 180]}>
              <mesh geometry={capsule(0.05, P.upperArmLen)} material={ppe.hiVis ? vestMat : shirt} position={[0, -P.upperArmLen / 2, 0]} castShadow />
              <group ref={fref} position={[0, -P.upperArmLen, 0]} rotation={[0.2, 0, 0]}>
                <mesh geometry={capsule(0.042, P.forearmLen)} material={shirt} position={[0, -P.forearmLen / 2, 0]} castShadow />
                <mesh geometry={sphere(0.05, 5, 4)} material={ppe.gloves ? gloveMat : skin} position={[0, -P.forearmLen - 0.03, 0]} castShadow />
              </group>
            </group>
          ))}
          <mesh geometry={cyl(0.045, 0.05, 0.08)} material={skin} position={[0, P.neckY, 0]} />
          <group ref={headG} position={[0, P.headY, 0]} rotation={[0.05, 0, 0]}>
            <mesh geometry={sphere(P.headR, 7, 5)} material={skin} scale={[1, 1.15, 0.95]} castShadow />
            {!ppe.helmet && <mesh geometry={dome} material={hairMatOf(v.hairIdx)} position={[0, 0.01, 0]} scale={[0.82, 0.7, 0.82]} />}
            {ppe.helmet && (
              <group>
                <mesh geometry={dome} material={helmetMat(supervisor)} position={[0, 0.03, 0]} castShadow />
                <mesh geometry={brim} material={helmetMat(supervisor)} position={[0, 0.05, 0.05]} />
              </group>
            )}
          </group>
        </group>
      </group>
    </>
  )
}

class GLBBoundary extends Component {
  constructor(p) { super(p); this.state = { err: false } }
  static getDerivedStateFromError() { return { err: true } }
  render() { return this.state.err ? this.props.fallback : this.props.children }
}

// ─────────────────────────────────────────────────────────────────────────
//  SiteWorker (outer) — world-position tracking, LOD, safety ring/tag
// ─────────────────────────────────────────────────────────────────────────
export function SiteWorker({ status = 'running', config = {}, objId = 'worker', name = 'Worker', alertSev = null }) {
  const root = useRef()
  const tag = useRef()
  const prevPos = useRef(new THREE.Vector3())
  const initDone = useRef(false)
  const motion = useRef({ moved: 0, walking: false, t: 0, dist: 0 })
  const { camera } = useThree()
  const safetyOn = useSafetyLayer((s) => s.on)

  const v = useMemo(() => {
    const r = hash01(objId)
    const role = config.role || (r < 0.18 ? 'supervisor' : r < 0.34 ? 'maintenance' : 'operator')
    return {
      objId, skin: Math.floor(hash01(objId + 's') * 3), shirt: Math.floor(hash01(objId + 'h') * 3),
      trouser: Math.floor(hash01(objId + 't') * 3), height: 0.94 + hash01(objId + 'z') * 0.12,
      phase: r * Math.PI * 2, twist: (hash01(objId + 'w') - 0.5) * 0.14, role,
      hipDrop: hash01(objId + 'd') * 0.012, hairIdx: Math.floor(hash01(objId + 'r') * 4),
    }
  }, [objId, config.role])
  const ppe = { helmet: true, hiVis: true, boots: true, gloves: true, ...(config.ppe || {}) }
  const supervisor = v.role === 'supervisor'
  const reg = useMemo(() => registerWorker(objId), [objId])
  useEffect(() => () => unregisterWorker(objId), [objId])

  useFrame(({ clock }) => {
    const g = root.current; if (!g) return
    const m = motion.current
    m.t = clock.elapsedTime + v.phase
    g.getWorldPosition(reg.pos)
    if (!initDone.current) { prevPos.current.copy(reg.pos); initDone.current = true }
    m.moved = reg.pos.distanceTo(prevPos.current)
    prevPos.current.copy(reg.pos)
    m.walking = m.moved > 1e-4
    reg.ppeOk = ppe.helmet && ppe.hiVis && ppe.boots && ppe.gloves
    m.dist = camera.position.distanceTo(reg.pos)
    if (safetyOn && tag.current && m.dist <= 60) tag.current.scale.setScalar(1 + Math.sin(m.t * 3) * 0.15)
  })

  const ringColor = reg.prox === 'danger' ? '#F04438' : reg.prox === 'warn' ? '#F79009' : (reg.ppeOk ? '#12B76A' : '#F04438')
  const fallback = <ProceduralBody v={v} ppe={ppe} supervisor={supervisor} motion={motion} />

  return (
    <group ref={root} scale={[v.height, v.height, v.height]} rotation={[0, 0, v.twist * 0.3]}>
      <mesh geometry={disc} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} />
      <GLBBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <GLBBody v={v} ppe={ppe} motion={motion} supervisor={supervisor} />
        </Suspense>
      </GLBBoundary>
      {safetyOn && (
        <>
          <mesh ref={tag} geometry={sphere(0.03, 6, 5)} material={M(`tag${ringColor}`, () => std(ringColor, 0.4, { emissive: ringColor, emissiveIntensity: 0.6, toneMapped: false }))}
            position={[0.16, P.hip + 0.45, 0.14]} />
          <mesh geometry={ring} material={M(`wring${ringColor}`, () => new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.6, side: 2, depthWrite: false, toneMapped: false }))}
            rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
        </>
      )}
    </group>
  )
}
