// Collision & Proximity layer. A staged, legible story around the real Stage-2
// AUTO-STOP: raised "fence" detection zones follow each HEMM; entering the warn
// zone fires an amber pulse ring; entering the danger zone fires a red shockwave,
// snaps a thick tether to the worker, and raises an AUTO-STOP banner + brake glow
// over the truck while vehicleMotion actually brings it to a halt; clearing it
// shows RESUMING. Detection is always on (feeds liveSafety → safety-1); the
// visuals are gated on the safety layer OR a live breach.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { useSafetyLayer } from '../../lib/safetyLayer'
import { workerPosMap } from '../../lib/workerPosMap'
import { vehicleState, setSpeedTarget, clearSpeedTarget, requestStop, releaseStop } from '../../lib/vehicleMotion'
import { proximityStateMap, workerBreach, zonesFor, zoneTest, zoneOutline } from '../../lib/proximity'
import { liveSafety, seedCounters } from '../../lib/liveSafety'
import { phantom } from '../../lib/nearMissDirector'
import { SiteWorker } from '../assets/SiteWorker'
import { fenceMat, shockMat, flowMat } from './safetyShaders'

// The near-miss "phantom": a real worker figure the director places on a haul
// road, module-controlled so the sim can't revert it. Parked far when idle.
export function NearMissActor() {
  const grp = useRef()
  useFrame(() => {
    const g = grp.current
    if (!g) return
    if (phantom.active) { g.position.set(phantom.x, phantom.y, phantom.z); g.visible = true }
    else { g.position.set(5000, 0, 5000); g.visible = false }
  })
  return (
    <group ref={grp} position={[5000, 0, 5000]} visible={false}>
      <SiteWorker objId="nearmiss-actor" status="running" name="Haul Road Worker"
        config={{ ppe: { helmet: true, hiVis: true, boots: true, gloves: true } }} />
    </group>
  )
}

const WARN_COLOR = '#F79009', DANGER_COLOR = '#F04438', OK_COLOR = '#2E90FA'
const WALL_H = 0.42

// Egg-zone geometry: line + filled fan + a vertical "fence" wall around the
// outline. Shared per (f,r,s).
const _geoCache = new Map()
function zoneGeo(f, r, s) {
  const key = `${f},${r},${s}`
  let g = _geoCache.get(key)
  if (g) return g
  const pts = zoneOutline(f, r, s, 48)
  const n = pts.length
  const line = new Float32Array(n * 3)
  pts.forEach(([x, z], i) => { line[i * 3] = x; line[i * 3 + 1] = 0; line[i * 3 + 2] = z })
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(line, 3))
  const pos = new Float32Array((n + 1) * 3)
  pts.forEach(([x, z], i) => { pos[(i + 1) * 3] = x; pos[(i + 1) * 3 + 1] = 0; pos[(i + 1) * 3 + 2] = z })
  const idx = []; for (let i = 1; i < n; i++) idx.push(0, i, i + 1)
  const fillGeo = new THREE.BufferGeometry(); fillGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fillGeo.setIndex(idx)
  // wall ribbon (vertical quads along the outline) with aY (0 bottom→1 top) and
  // aU (0..1 around the loop) so the fence shader can top-fade + flow energy
  const wv = [], wy = [], wu = []
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n]
    const u0 = i / n, u1 = (i + 1) / n
    wv.push(x0, 0, z0, x1, 0, z1, x1, WALL_H, z1, x0, 0, z0, x1, WALL_H, z1, x0, WALL_H, z0)
    wy.push(0, 0, 1, 0, 1, 1)
    wu.push(u0, u1, u1, u0, u1, u0)
  }
  const wallGeo = new THREE.BufferGeometry()
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3))
  wallGeo.setAttribute('aY', new THREE.Float32BufferAttribute(wy, 1))
  wallGeo.setAttribute('aU', new THREE.Float32BufferAttribute(wu, 1))
  const topLine = new Float32Array(n * 3)
  pts.forEach(([x, z], i) => { topLine[i * 3] = x; topLine[i * 3 + 1] = WALL_H; topLine[i * 3 + 2] = z })
  const topGeo = new THREE.BufferGeometry(); topGeo.setAttribute('position', new THREE.BufferAttribute(topLine, 3))
  g = { lineGeo, fillGeo, wallGeo, topGeo }; _geoCache.set(key, g)
  return g
}

const SHOCK_GEO = new THREE.RingGeometry(0.86, 1.0, 44)
const BRAKE_GEO = new THREE.BoxGeometry(1.0, 0.14, 0.14)

// ── one vehicle's pod + zones + fence + shockwave + banner ──
function VehicleZone({ id, type }) {
  const grp = useRef(), podLed = useRef()
  const outerLine = useRef(), outerFill = useRef(), outerWall = useRef(), innerLine = useRef(), innerFill = useRef()
  const shock = useRef(), brake = useRef(), bannerGrp = useRef(), bannerDiv = useRef()
  const wave = useRef({ t: 99, kind: 'warn' }), prevState = useRef('ok')
  const z = zonesFor(type)
  const outer = zoneGeo(z.outer.f, z.outer.r, z.outer.s)
  const inner = zoneGeo(z.inner.f, z.inner.r, z.inner.s)
  const mats = useMemo(() => ({ fence: fenceMat('#2E90FA'), shock: shockMat() }), [])

  useFrame(({ clock }, dt) => {
    const st = vehicleState(id)
    const g = grp.current
    if (!g || !st || !st.initDone) { if (g) g.visible = false; return }
    const state = proximityStateMap.get(id) || 'ok'
    const breach = state === 'danger', warn = state === 'warn'
    g.visible = useSafetyLayer.getState().on || state !== 'ok'
    if (!g.visible) { prevState.current = state; return }
    g.position.set(st.wx, 0.08, st.wz); g.rotation.y = st.yaw
    const col = breach ? DANGER_COLOR : warn ? WARN_COLOR : OK_COLOR
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5)

    // transition → fire a wave (amber on warn entry, red shockwave on danger entry)
    if (state !== prevState.current) {
      if (state === 'warn' && prevState.current === 'ok') wave.current = { t: 0, kind: 'warn' }
      if (state === 'danger') wave.current = { t: 0, kind: 'danger' }
      prevState.current = state
    }

    // zones — flat rings/fills + the energy-fence wall (shader)
    const zc = warn || breach ? WARN_COLOR : OK_COLOR
    if (outerLine.current) { outerLine.current.material.color.set(zc); outerLine.current.material.opacity = warn || breach ? 0.55 + 0.4 * pulse : 0.34 }
    if (outerFill.current) outerFill.current.material.opacity = warn || breach ? 0.13 : 0.05
    mats.fence.uniforms.uColor.value.set(zc)
    mats.fence.uniforms.uTime.value = clock.elapsedTime
    mats.fence.uniforms.uOpacity.value = warn || breach ? 0.34 : 0.16
    mats.fence.uniforms.uFlow.value = warn || breach ? 1.0 : 0.35
    if (innerLine.current) { innerLine.current.material.color.set(DANGER_COLOR); innerLine.current.material.opacity = breach ? 0.7 + 0.3 * pulse : 0.32 }
    if (innerFill.current) innerFill.current.material.opacity = breach ? 0.20 : 0.05
    if (podLed.current) podLed.current.material.color.set(col)

    // shockwave ring on zone entry
    const wv = wave.current; wv.t += dt
    if (shock.current) {
      if (wv.t < 0.95) {
        shock.current.visible = true
        const big = wv.kind === 'danger' ? 3.6 : 2.3
        const sc = 1 + (wv.t / 0.95) * big
        shock.current.scale.set(sc, sc, sc)
        mats.shock.uniforms.uColor.value.set(wv.kind === 'danger' ? DANGER_COLOR : WARN_COLOR)
        mats.shock.uniforms.uOpacity.value = 0.75 * (1 - wv.t / 0.95)
      } else shock.current.visible = false
    }

    // brake glow + AUTO-STOP / RESUMING banner
    if (brake.current) { brake.current.visible = breach; brake.current.material.opacity = breach ? 0.5 + 0.5 * pulse : 0 }
    if (bannerGrp.current) {
      const show = breach
      bannerGrp.current.visible = show
      if (show && bannerDiv.current && bannerDiv.current._s !== 'stop') {
        bannerDiv.current.textContent = '■ AUTO-STOP · proximity'
        bannerDiv.current.style.background = 'rgba(200,32,24,0.94)'; bannerDiv.current._s = 'stop'
      }
    }
  })

  return (
    <group ref={grp}>
      {/* radar sensor pod on the cab roof */}
      <group position={[0.4, 2.4, 0]}>
        <mesh geometry={POD_GEO} material={POD_MAT} />
        <mesh geometry={ANT_GEO} material={POD_MAT} position={[0, 0.28, 0]} />
        <mesh ref={podLed} geometry={LED_GEO} position={[0, 0.16, 0]}><meshBasicMaterial color={OK_COLOR} toneMapped={false} /></mesh>
      </group>
      {/* rear brake glow (shown while halted) */}
      <mesh ref={brake} geometry={BRAKE_GEO} position={[-2.6, 0.9, 0]} visible={false}>
        <meshBasicMaterial color={DANGER_COLOR} transparent opacity={0} toneMapped={false} />
      </mesh>
      {/* AUTO-STOP banner over the truck */}
      <group ref={bannerGrp} position={[0, 3.5, 0]} visible={false}>
        <Html center distanceFactor={10} style={{ pointerEvents: 'none' }} zIndexRange={[50, 0]}>
          <div ref={bannerDiv} style={{ fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
            color: '#fff', background: 'rgba(200,32,24,0.94)', border: '1px solid rgba(255,150,130,0.8)', borderRadius: 6,
            padding: '3px 9px', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(180,20,15,0.5)' }}>■ AUTO-STOP · proximity</div>
        </Html>
      </group>
      {/* shockwave ring on zone entry */}
      <mesh ref={shock} geometry={SHOCK_GEO} material={mats.shock} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} visible={false} renderOrder={3} />
      {/* ground zones + energy-fence wall */}
      <lineLoop ref={outerLine} geometry={outer.lineGeo}><lineBasicMaterial color={OK_COLOR} transparent opacity={0.34} toneMapped={false} depthWrite={false} /></lineLoop>
      <mesh ref={outerFill} geometry={outer.fillGeo}><meshBasicMaterial color={WARN_COLOR} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
      <mesh ref={outerWall} geometry={outer.wallGeo} material={mats.fence} />
      <lineLoop geometry={outer.topGeo}><lineBasicMaterial color={OK_COLOR} transparent opacity={0.12} toneMapped={false} depthWrite={false} /></lineLoop>
      <lineLoop ref={innerLine} geometry={inner.lineGeo}><lineBasicMaterial color={DANGER_COLOR} transparent opacity={0.32} toneMapped={false} depthWrite={false} /></lineLoop>
      <mesh ref={innerFill} geometry={inner.fillGeo}><meshBasicMaterial color={DANGER_COLOR} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  )
}

// shared pod geometry/material
const POD_GEO = new THREE.BoxGeometry(0.5, 0.22, 0.42)
const ANT_GEO = new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6)
const LED_GEO = new THREE.SphereGeometry(0.07, 8, 6)
const POD_MAT = new THREE.MeshStandardMaterial({ color: '#1f2933', metalness: 0.5, roughness: 0.5 })
const TETHER_GEO = new THREE.CylinderGeometry(0.09, 0.09, 1, 10, 1, true)
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _mid = new THREE.Vector3(), _q = new THREE.Quaternion()

export function ProximityLayer() {
  const on = useSafetyLayer(s => s.on)
  const vehKey = useSceneStore(s => Object.keys(s.objects).filter(id => { const o = s.objects[id]; return o.config?.path?.waypoints && (o.type === 'haul_truck' || o.type === 'light_vehicle') }).sort().join(','))
  const vehicles = useMemo(() => (vehKey ? vehKey.split(',').map(id => ({ id, type: useSceneStore.getState().objects[id].type })) : []), [vehKey])
  const frame = useRef(0)
  const prevInner = useRef(false)
  const danger = useRef({ active: false, ax: 0, az: 0, bx: 0, bz: 0, dist: 0 })
  const tether = useRef(), labelRef = useRef(), labelWrapRef = useRef()
  const tetherMat = useMemo(() => flowMat('#FF6B5E'), [])

  // ── central detection (always on) ──
  useFrame(() => {
    if (!vehicles.length) return
    if ((frame.current++ % 4) !== 0) return
    seedCounters(useSceneStore.getState().objects['safety-1']?.parameters)
    const vs = []
    for (const v of vehicles) { const st = vehicleState(v.id); if (st && st.initDone) vs.push({ id: v.id, type: v.type, x: st.wx, z: st.wz, yaw: st.yaw }) }
    const workers = []
    for (const [wid, w] of workerPosMap) workers.push({ id: wid, x: w.pos.x, z: w.pos.z })

    let siteMinWorker = Infinity, anyInnerWorker = false
    const wInfo = new Map()
    const objects = useSceneStore.getState().objects
    let bestDanger = null
    const noteWorker = (tid, rank, vehId, dist) => { const cur = wInfo.get(tid); if (!cur || rank > cur.rank || (rank === cur.rank && dist < cur.dist)) wInfo.set(tid, { rank, vehId, dist }) }

    for (const veh of vs) {
      const z = zonesFor(veh.type)
      let worst = 'ok', closestDangerDist = Infinity, closestTarget = null
      const consider = (tx, tz, isWorker, tid) => {
        const dx = tx - veh.x, dz = tz - veh.z, dist = Math.hypot(dx, dz)
        if (isWorker && dist < siteMinWorker) siteMinWorker = dist
        if (zoneTest(veh.x, veh.z, veh.yaw, tx, tz, z.inner).inside) {
          worst = 'danger'
          if (isWorker) { anyInnerWorker = true; noteWorker(tid, 2, veh.id, dist) }
          if (dist < closestDangerDist) { closestDangerDist = dist; closestTarget = { x: tx, z: tz } }
          return
        }
        if (zoneTest(veh.x, veh.z, veh.yaw, tx, tz, z.outer).inside) { if (worst === 'ok') worst = 'warn'; if (isWorker) noteWorker(tid, 1, veh.id, dist) }
      }
      for (const w of workers) consider(w.x, w.z, true, w.id)
      for (const o of vs) if (o.id !== veh.id) consider(o.x, o.z, false, o.id)

      proximityStateMap.set(veh.id, worst)
      if (worst === 'danger') { requestStop(veh.id, 'proximity-danger'); clearSpeedTarget(veh.id, 'proximity-warning') }
      else { releaseStop(veh.id, 'proximity-danger'); if (worst === 'warn') { const ms = objects[veh.id]?.config?.path?.speed ?? 6; setSpeedTarget(veh.id, ms * 0.4, 'proximity-warning') } else clearSpeedTarget(veh.id, 'proximity-warning') }
      if (worst === 'danger' && closestTarget && closestDangerDist < (bestDanger?.dist ?? Infinity)) bestDanger = { ax: veh.x, az: veh.z, bx: closestTarget.x, bz: closestTarget.z, dist: closestDangerDist }
    }

    for (const w of workers) {
      const info = wInfo.get(w.id)
      const s = info ? (info.rank === 2 ? 'danger' : 'warn') : 'ok'
      proximityStateMap.set(w.id, s)
      const reg = workerPosMap.get(w.id); if (reg) reg.prox = s
      if (info) workerBreach.set(w.id, { state: s, vehId: info.vehId, vehName: objects[info.vehId]?.name || info.vehId, dist: info.dist })
      else workerBreach.delete(w.id)
    }

    liveSafety.minWorkerVehicleDistance = siteMinWorker === Infinity ? 60 : Math.round(siteMinWorker)
    liveSafety.proximityEvent = anyInnerWorker ? 1 : 0
    if (anyInnerWorker && !prevInner.current) liveSafety.proximityAlertsToday = (liveSafety.proximityAlertsToday || 0) + 1
    prevInner.current = anyInnerWorker
    danger.current = bestDanger ? { active: true, ...bestDanger } : { active: false }
  })

  // ── danger overlay: thick animated tether + distance/AUTO-STOP chip ──
  useFrame(({ clock }) => {
    const d = danger.current
    const t = tether.current, wrap = labelWrapRef.current
    if (!t || !wrap) return
    if (!d.active) { t.visible = false; wrap.visible = false; return }
    t.visible = true; wrap.visible = true
    const a = new THREE.Vector3(d.ax, 1.5, d.az), b = new THREE.Vector3(d.bx, 1.0, d.bz)
    _dir.subVectors(b, a); const len = _dir.length()
    _mid.addVectors(a, b).multiplyScalar(0.5)
    _q.setFromUnitVectors(_up, _dir.clone().normalize())
    t.position.copy(_mid); t.quaternion.copy(_q); t.scale.set(1, len, 1)
    tetherMat.uniforms.uTime.value = clock.elapsedTime; tetherMat.uniforms.uOpacity.value = 0.95   // flowing energy
    wrap.position.set(_mid.x, 2.0, _mid.z)
    if (labelRef.current) labelRef.current.textContent = `${d.dist.toFixed(1)} m · AUTO-STOP`
  })

  return (
    <group>
      {vehicles.map(v => <VehicleZone key={v.id} id={v.id} type={v.type} />)}
      <mesh ref={tether} geometry={TETHER_GEO} material={tetherMat} visible={false} renderOrder={999} />
      <group ref={labelWrapRef}>
        <Html center distanceFactor={9} style={{ pointerEvents: 'none' }}>
          <div ref={labelRef} style={{ fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 11, fontWeight: 800, letterSpacing: 0.2,
            color: '#fff', background: 'rgba(200,32,24,0.9)', border: '1px solid rgba(255,120,100,0.7)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }} /></Html>
      </group>
    </group>
  )
}
