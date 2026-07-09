import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── FlowConveyor — a conveyor PACKED with product, Tecnomatix-style ─────────
// Renders a bed/rails/legs along a straight or 90°-curved path and a dense
// stream of bottles flowing along it — all via THREE.InstancedMesh, so a line
// of 300 bottles costs a handful of draw calls. Path starts at the local origin
// and runs along +X; `curve` adds a quarter-turn at the end (left = -Z).
//   config: { length, curve:'none'|'left'|'right', curveRadius, lanes, laneGap,
//             speed, spacing, running, capColor }

const BED_Y = 0.95            // walking-height bed (like real bottling lines)
const SAMPLE = 0.1            // path sample resolution (m)

// Composite path: straight run + optional quarter arc. Returns { pts, tans, len }.
function buildPath(length, curve, radius) {
  const path = new THREE.CurvePath()
  const L = Math.max(1, length)
  path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(L, 0, 0)))
  if (curve !== 'none') {
    const s = curve === 'left' ? -1 : 1
    // quarter circle from (L,0,0) heading +X, turning to ±Z, centre at (L,0,s*r)
    const r = Math.max(0.8, radius)
    const arc = new THREE.Curve()
    arc.getPoint = (t, target = new THREE.Vector3()) => {
      const a = t * Math.PI / 2
      return target.set(L + Math.sin(a) * r, 0, s * r - s * Math.cos(a) * r)
    }
    path.add(arc)
  }
  const len = path.getLength()
  const n = Math.max(8, Math.ceil(len / SAMPLE))
  const pts = path.getSpacedPoints(n)
  const tans = pts.map((p, i) => {
    const q = pts[Math.min(i + 1, n)]
    const t = new THREE.Vector3().subVectors(q, p)
    return t.lengthSq() < 1e-8 ? new THREE.Vector3(1, 0, 0) : t.normalize()
  })
  return { pts, tans, len }
}

// World-space end offset for ports (mirrors buildPath's arc maths).
export function flowConveyorEnd(config = {}) {
  const L = Math.max(1, config.length ?? 8)
  const r = Math.max(0.8, config.curveRadius ?? 2)
  if ((config.curve ?? 'none') === 'none') return [L, BED_Y, 0]
  const s = config.curve === 'left' ? -1 : 1
  return [L + r, BED_Y, s * r - 0]     // arc exit: (L + r·sin90, ·, s·r − s·r·cos90) = (L+r, ·, s·r)
}

// Shared bottle geometry (lathe profile: body → shoulder → neck) + cap.
let _bottleGeo = null, _capGeo = null, _labelGeo = null
function bottleGeos() {
  if (!_bottleGeo) {
    const pts = [
      [0, 0], [0.085, 0], [0.09, 0.02], [0.09, 0.2], [0.075, 0.24],
      [0.045, 0.27], [0.038, 0.29], [0.038, 0.32],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    _bottleGeo = new THREE.LatheGeometry(pts, 14)
    _capGeo = new THREE.CylinderGeometry(0.041, 0.041, 0.035, 12)
    _labelGeo = new THREE.CylinderGeometry(0.094, 0.094, 0.12, 14)   // wrap-around label band
  }
  return { body: _bottleGeo, cap: _capGeo, label: _labelGeo }
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1)
const UP = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3()

export function FlowConveyor({ config = {}, status = 'running' }) {
  const length = config.length ?? 8
  const curve = config.curve ?? 'none'
  const radius = config.curveRadius ?? 2
  const lanes = Math.max(1, Math.round(config.lanes ?? 1))
  const laneGap = config.laneGap ?? 0.24
  const spacing = Math.max(0.16, config.spacing ?? 0.22)
  const speed = config.speed ?? 0.6
  const capColor = config.capColor ?? '#2f6fb0'
  const labelColor = config.label || null          // set downstream of a labeller → bottles carry a label band
  const live = config.running !== false && status === 'running'

  const { pts, tans, len } = useMemo(() => buildPath(length, curve, radius), [length, curve, radius])
  const width = lanes * laneGap + 0.22

  // ── structure (bed slats, side rails, legs) as instanced matrices ──
  const structure = useMemo(() => {
    const slat = [], railL = [], railR = [], legs = []
    const side = new THREE.Vector3()
    for (let d = 0; d < len; d += 0.35) {
      const i = Math.min(pts.length - 1, Math.round(d / SAMPLE))
      side.crossVectors(UP, tans[i]).normalize()
      const yaw = Math.atan2(tans[i].x, tans[i].z) - Math.PI / 2   // box X along tangent
      const at = (off, y) => new THREE.Matrix4().compose(
        V.copy(pts[i]).addScaledVector(side, off).setY(y).clone(),
        Q.setFromAxisAngle(UP, yaw), S1.clone())
      slat.push(at(0, BED_Y))
      railL.push(at(width / 2, BED_Y + 0.14))
      railR.push(at(-width / 2, BED_Y + 0.14))
      if (d % 2.1 < 0.35) { legs.push(at(width / 2 - 0.05, BED_Y / 2)); legs.push(at(-width / 2 + 0.05, BED_Y / 2)) }
    }
    return { slat, railL, railR, legs }
  }, [pts, tans, len, width])

  // ── bottles ──
  const perLane = Math.max(1, Math.floor(len / spacing))
  const count = perLane * lanes
  const bodyRef = useRef(), capRef = useRef(), labelRef = useRef()
  const offset = useRef(0)
  const { body, cap, label } = bottleGeos()

  const placeBottles = (off) => {
    const bodyIM = bodyRef.current, capIM = capRef.current, labelIM = labelRef.current
    if (!bodyIM || !capIM) return
    const side = new THREE.Vector3()
    let k = 0
    for (let lane = 0; lane < lanes; lane++) {
      const laneOff = (lane - (lanes - 1) / 2) * laneGap
      for (let b = 0; b < perLane; b++) {
        const d = (b * spacing + off) % len
        // interpolate between path samples → continuous, smooth motion
        const f = d / SAMPLE
        const i = Math.min(pts.length - 2, Math.floor(f))
        const t = f - i
        side.crossVectors(UP, tans[i]).normalize()
        V.copy(pts[i]).lerp(pts[i + 1], t).addScaledVector(side, laneOff).setY(BED_Y + 0.03)
        M4.compose(V, Q.identity(), S1)
        bodyIM.setMatrixAt(k, M4)
        if (labelIM) { V.y += 0.115; M4.compose(V, Q.identity(), S1); labelIM.setMatrixAt(k, M4); V.y -= 0.115 }
        V.y += 0.335
        M4.compose(V, Q.identity(), S1)
        capIM.setMatrixAt(k, M4)
        k++
      }
    }
    bodyIM.instanceMatrix.needsUpdate = true
    capIM.instanceMatrix.needsUpdate = true
    if (labelIM) labelIM.instanceMatrix.needsUpdate = true
  }

  useEffect(() => { placeBottles(0) }, [count, pts])   // eslint-disable-line
  useFrame((_, dt) => {
    if (!live) return
    offset.current = (offset.current + dt * speed) % len
    placeBottles(offset.current)
  })

  // structure instanced meshes (static matrices)
  const setStatic = (ref, mats) => (im) => {
    if (!im || im.userData.done === mats) return
    mats.forEach((m, i) => im.setMatrixAt(i, m))
    im.instanceMatrix.needsUpdate = true
    im.userData.done = mats
  }

  return (
    <group>
      <instancedMesh ref={setStatic(null, structure.slat)} args={[null, null, structure.slat.length]} receiveShadow>
        <boxGeometry args={[0.36, 0.07, width]} />
        <meshStandardMaterial color="#9aa4ad" metalness={0.8} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={setStatic(null, structure.railL)} args={[null, null, structure.railL.length]}>
        <boxGeometry args={[0.38, 0.05, 0.04]} />
        <meshStandardMaterial color="#c8d2da" metalness={0.85} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={setStatic(null, structure.railR)} args={[null, null, structure.railR.length]}>
        <boxGeometry args={[0.38, 0.05, 0.04]} />
        <meshStandardMaterial color="#c8d2da" metalness={0.85} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={setStatic(null, structure.legs)} args={[null, null, structure.legs.length]} castShadow>
        <boxGeometry args={[0.08, BED_Y, 0.08]} />
        <meshStandardMaterial color="#7d8790" metalness={0.7} roughness={0.4} />
      </instancedMesh>
      {/* product stream */}
      <instancedMesh ref={bodyRef} args={[body, null, count]} castShadow>
        <meshStandardMaterial color="#f4f6f2" metalness={0.05} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[cap, null, count]}>
        <meshStandardMaterial color={capColor} metalness={0.2} roughness={0.4} />
      </instancedMesh>
      {labelColor && (
        <instancedMesh ref={labelRef} args={[label, null, count]}>
          <meshStandardMaterial color={labelColor} metalness={0.05} roughness={0.5} />
        </instancedMesh>
      )}
    </group>
  )
}
