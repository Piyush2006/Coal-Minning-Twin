// Collision & Proximity layer (Stage 4). A different visual language from the
// PPE cameras: RF/radar-style asymmetric detection zones that follow each HEMM,
// real breach detection against workers AND other vehicles, and a genuine
// AUTO-STOP — the breach calls the Stage-2 vehicleMotion API (requestStop /
// setSpeedTarget), so the truck decelerates smoothly to a halt, not a teleport.
//
// Detection is ALWAYS on (it feeds the liveSafety bridge → safety-1
// minWorkerVehicleDistance / proximityEvent / proximityAlertsToday → the existing
// prox-crit + prox-near rules → Proximity ledger row). The zone rings, sensor
// pods, distance label and AUTO-STOP chip are gated on the safety layer so the
// base scene is unchanged.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { useSafetyLayer } from '../../lib/safetyLayer'
import { workerPosMap } from '../../lib/workerPosMap'
import { vehicleState, setSpeedTarget, clearSpeedTarget, requestStop, releaseStop } from '../../lib/vehicleMotion'
import { proximityStateMap, zonesFor, zoneTest, zoneOutline } from '../../lib/proximity'
import { liveSafety, seedCounters } from '../../lib/liveSafety'
import { phantom } from '../../lib/nearMissDirector'
import { SiteWorker } from '../assets/SiteWorker'

// The near-miss "phantom": a real worker figure the director places on a haul
// road. It registers in workerPosMap like any worker (so proximity sees it), but
// its position is module-controlled — the sim can't revert it. Parked far in X/Z
// when idle. Mounted always (independent of the safety layer).
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

// Egg-zone geometry (line + filled fan) in the vehicle's local XZ frame. Shared
// per (f,r,s) so all trucks reuse one pair.
const _geoCache = new Map()
function zoneGeo(f, r, s) {
  const key = `${f},${r},${s}`
  let g = _geoCache.get(key)
  if (g) return g
  const pts = zoneOutline(f, r, s, 48)
  const line = new Float32Array(pts.length * 3)
  pts.forEach(([x, z], i) => { line[i * 3] = x; line[i * 3 + 1] = 0; line[i * 3 + 2] = z })
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(line, 3))
  const n = pts.length
  const pos = new Float32Array((n + 1) * 3)
  pts.forEach(([x, z], i) => { pos[(i + 1) * 3] = x; pos[(i + 1) * 3 + 1] = 0; pos[(i + 1) * 3 + 2] = z })
  const idx = []; for (let i = 1; i < n; i++) idx.push(0, i, i + 1)
  const fillGeo = new THREE.BufferGeometry(); fillGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fillGeo.setIndex(idx)
  g = { lineGeo, fillGeo }; _geoCache.set(key, g)
  return g
}

// ── one vehicle's pod + zones; follows the vehicle, recolours by its state ──
function VehicleZone({ id, type }) {
  const grp = useRef(), podLed = useRef()
  const outerLine = useRef(), outerFill = useRef(), innerLine = useRef(), innerFill = useRef()
  const z = zonesFor(type)
  const outer = zoneGeo(z.outer.f, z.outer.r, z.outer.s)
  const inner = zoneGeo(z.inner.f, z.inner.r, z.inner.s)

  useFrame(({ clock }) => {
    const st = vehicleState(id)
    const g = grp.current
    if (!g || !st || !st.initDone) { if (g) g.visible = false; return }
    g.visible = true
    g.position.set(st.wx, 0.08, st.wz)
    g.rotation.y = st.yaw
    const state = proximityStateMap.get(id) || 'ok'
    const breach = state === 'danger', warn = state === 'warn'
    const col = breach ? DANGER_COLOR : warn ? WARN_COLOR : OK_COLOR
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5)
    // outer ring = warning colour; inner = danger colour. Dim when idle, bright + pulse on breach.
    if (outerLine.current) { outerLine.current.material.color.set(warn || breach ? WARN_COLOR : OK_COLOR); outerLine.current.material.opacity = warn || breach ? 0.5 + 0.4 * pulse : 0.32 }
    if (outerFill.current) outerFill.current.material.opacity = warn || breach ? 0.10 : 0.05
    if (innerLine.current) { innerLine.current.material.color.set(DANGER_COLOR); innerLine.current.material.opacity = breach ? 0.6 + 0.4 * pulse : 0.3 }
    if (innerFill.current) innerFill.current.material.opacity = breach ? 0.16 : 0.05
    if (podLed.current) podLed.current.material.color.set(col)
  })

  return (
    <group ref={grp}>
      {/* radar sensor pod on the cab roof + antenna */}
      <group position={[0.4, 2.4, 0]}>
        <mesh geometry={POD_GEO} material={POD_MAT} />
        <mesh geometry={ANT_GEO} material={POD_MAT} position={[0, 0.28, 0]} />
        <mesh ref={podLed} geometry={LED_GEO} position={[0, 0.16, 0]}>
          <meshBasicMaterial color={OK_COLOR} toneMapped={false} />
        </mesh>
      </group>
      {/* zones (on the ground, local XZ; group already rotated by yaw) */}
      <lineLoop ref={outerLine} geometry={outer.lineGeo}>
        <lineBasicMaterial color={OK_COLOR} transparent opacity={0.32} toneMapped={false} depthWrite={false} />
      </lineLoop>
      <mesh ref={outerFill} geometry={outer.fillGeo}>
        <meshBasicMaterial color={WARN_COLOR} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <lineLoop ref={innerLine} geometry={inner.lineGeo}>
        <lineBasicMaterial color={DANGER_COLOR} transparent opacity={0.3} toneMapped={false} depthWrite={false} />
      </lineLoop>
      <mesh ref={innerFill} geometry={inner.fillGeo}>
        <meshBasicMaterial color={DANGER_COLOR} transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

// shared pod geometry/material
const POD_GEO = new THREE.BoxGeometry(0.5, 0.22, 0.42)
const ANT_GEO = new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6)
const LED_GEO = new THREE.SphereGeometry(0.07, 8, 6)
const POD_MAT = new THREE.MeshStandardMaterial({ color: '#1f2933', metalness: 0.5, roughness: 0.5 })

const _va = new THREE.Vector3(), _vb = new THREE.Vector3()

export function ProximityLayer() {
  const on = useSafetyLayer(s => s.on)
  // vehicle set — re-subscribes only when the roster changes (template load)
  const vehKey = useSceneStore(s => Object.keys(s.objects).filter(id => { const o = s.objects[id]; return o.config?.path?.waypoints && (o.type === 'haul_truck' || o.type === 'light_vehicle') }).sort().join(','))
  const vehicles = useMemo(() => (vehKey ? vehKey.split(',').map(id => ({ id, type: useSceneStore.getState().objects[id].type })) : []), [vehKey])
  const frame = useRef(0)
  const prevInner = useRef(false)          // edge for the proximity counter
  const danger = useRef({ active: false, ax: 0, az: 0, bx: 0, bz: 0, dist: 0 })
  const lineRef = useRef(), labelRef = useRef(), labelWrapRef = useRef()

  // ── central detection (always on) ──
  useFrame(() => {
    if (!vehicles.length) return
    if ((frame.current++ % 4) !== 0) return                    // ~15 Hz math is plenty
    seedCounters(useSceneStore.getState().objects['safety-1']?.parameters)

    // gather live targets
    const vs = []
    for (const v of vehicles) { const st = vehicleState(v.id); if (st && st.initDone) vs.push({ id: v.id, type: v.type, x: st.wx, z: st.wz, yaw: st.yaw }) }
    const workers = []
    for (const [wid, w] of workerPosMap) workers.push({ id: wid, x: w.pos.x, z: w.pos.z })

    let siteMinWorker = Infinity, anyInnerWorker = false
    const workerWorst = new Map()
    let bestDanger = null

    for (const veh of vs) {
      const z = zonesFor(veh.type)
      let worst = 'ok', closestDangerDist = Infinity, closestTarget = null
      const consider = (tx, tz, isWorker, tid) => {
        const dx = tx - veh.x, dz = tz - veh.z
        const dist = Math.hypot(dx, dz)
        if (isWorker && dist < siteMinWorker) siteMinWorker = dist
        const inr = zoneTest(veh.x, veh.z, veh.yaw, tx, tz, z.inner)
        if (inr.inside) {
          worst = 'danger'
          if (isWorker) anyInnerWorker = true
          if (dist < closestDangerDist) { closestDangerDist = dist; closestTarget = { x: tx, z: tz } }
          if (isWorker) workerWorst.set(tid, 'danger')
          return
        }
        const out = zoneTest(veh.x, veh.z, veh.yaw, tx, tz, z.outer)
        if (out.inside) {
          if (worst === 'ok') worst = 'warn'
          if (isWorker && workerWorst.get(tid) !== 'danger') workerWorst.set(tid, 'warn')
        }
      }
      for (const w of workers) consider(w.x, w.z, true, w.id)
      for (const o of vs) if (o.id !== veh.id) consider(o.x, o.z, false, o.id)

      proximityStateMap.set(veh.id, worst)
      // auto-stop / slow via the Stage-2 API
      if (worst === 'danger') { requestStop(veh.id, 'proximity-danger'); clearSpeedTarget(veh.id, 'proximity-warning') }
      else {
        releaseStop(veh.id, 'proximity-danger')
        if (worst === 'warn') { const ms = useSceneStore.getState().objects[veh.id]?.config?.path?.speed ?? 6; setSpeedTarget(veh.id, ms * 0.4, 'proximity-warning') }
        else clearSpeedTarget(veh.id, 'proximity-warning')
      }
      if (worst === 'danger' && closestTarget && closestDangerDist < (bestDanger?.dist ?? Infinity)) {
        bestDanger = { ax: veh.x, az: veh.z, bx: closestTarget.x, bz: closestTarget.z, dist: closestDangerDist }
      }
    }

    // worker tag colours (read by SiteWorker's ring) + state map
    for (const w of workers) { const s = workerWorst.get(w.id) || 'ok'; proximityStateMap.set(w.id, s); const reg = workerPosMap.get(w.id); if (reg) reg.prox = s }

    // ── bridge → safety-1 (existing params/rules) ──
    liveSafety.minWorkerVehicleDistance = siteMinWorker === Infinity ? 60 : Math.round(siteMinWorker)
    liveSafety.proximityEvent = anyInnerWorker ? 1 : 0
    if (anyInnerWorker && !prevInner.current) liveSafety.proximityAlertsToday = (liveSafety.proximityAlertsToday || 0) + 1
    prevInner.current = anyInnerWorker

    danger.current = bestDanger ? { active: true, ...bestDanger } : { active: false }
  })

  // ── danger overlay: line + distance label + AUTO-STOP chip (imperative) ──
  useFrame(() => {
    const d = danger.current
    const ln = lineRef.current, wrap = labelWrapRef.current
    if (!ln || !wrap) return
    if (!on || !d.active) { ln.visible = false; wrap.visible = false; return }
    ln.visible = true; wrap.visible = true
    const pos = ln.geometry.attributes.position
    pos.setXYZ(0, d.ax, 1.4, d.az); pos.setXYZ(1, d.bx, 1.0, d.bz); pos.needsUpdate = true
    wrap.position.set((d.ax + d.bx) / 2, 2.0, (d.az + d.bz) / 2)
    if (labelRef.current) labelRef.current.textContent = `${d.dist.toFixed(1)} m · AUTO-STOP`
  })

  if (!on) return null
  return (
    <group>
      {vehicles.map(v => <VehicleZone key={v.id} id={v.id} type={v.type} />)}
      <line ref={lineRef}>
        <bufferGeometry><bufferAttribute attach="attributes-position" count={2} array={new Float32Array(6)} itemSize={3} /></bufferGeometry>
        <lineBasicMaterial color={DANGER_COLOR} transparent opacity={0.9} toneMapped={false} depthTest={false} />
      </line>
      <group ref={labelWrapRef}>
        <Html center distanceFactor={42} style={{ pointerEvents: 'none' }}>
          <div ref={labelRef} style={{ fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
            color: '#fff', background: 'rgba(200,32,24,0.85)', border: '1px solid rgba(255,120,100,0.7)',
            borderRadius: 6, padding: '3px 9px', whiteSpace: 'nowrap' }}>— m</div>
        </Html>
      </group>
    </group>
  )
}
