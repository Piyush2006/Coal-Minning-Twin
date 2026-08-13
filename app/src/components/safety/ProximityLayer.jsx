// Worker–Vehicle Proximity layer. WORKER safety only — a vehicle reacts when a
// WORKER enters its detection zone (vehicle-vs-vehicle proximity is intentionally
// not modelled). Entering the warn zone slows the truck + shows a soft underglow;
// entering the danger zone snaps a thick tether to the worker, fires a shockwave
// + brake glow, and vehicleMotion brings the truck to an AUTO-STOP. Detection is
// always on (feeds liveSafety → safety-1); visuals gate on the safety layer OR a
// live breach.
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { useSafetyLayer } from '../../lib/safetyLayer'
import { workerPosMap, registerWorker, unregisterWorker } from '../../lib/workerPosMap'
import { vehicleState, setSpeedTarget, clearSpeedTarget, requestStop, releaseStop } from '../../lib/vehicleMotion'
import { proximityStateMap, workerBreach, zonesFor, zoneTest } from '../../lib/proximity'
import { liveSafety, seedCounters } from '../../lib/liveSafety'
import { phantom } from '../../lib/nearMissDirector'
import { pushLiveSafety } from '../../lib/liveSafetyFeed'
import { shockMat, flowMat } from './safetyShaders'

// The near-miss "intruder" is a LIGHT VEHICLE (not a worker) straying into a
// haul truck's path. It's registered in workerPosMap so the truck's proximity
// system detects it exactly like any ground actor and triggers the AUTO-STOP.
export function NearMissActor() {
  const grp = useRef()
  useEffect(() => { registerWorker('nearmiss-actor'); return () => unregisterWorker('nearmiss-actor') }, [])
  useFrame(() => {
    const g = grp.current
    if (!g) return
    const reg = workerPosMap.get('nearmiss-actor')
    if (phantom.active) { g.position.set(phantom.x, phantom.y, phantom.z); g.visible = true; if (reg) reg.pos.set(phantom.x, phantom.y, phantom.z) }
    else { g.position.set(5000, 0, 5000); g.visible = false; if (reg) reg.pos.set(5000, 0, 5000) }
  })
  return (
    <group ref={grp} position={[5000, 0, 5000]} visible={false}>
      {/* light-vehicle proxy: white ute body + cab + amber roof beacon + hi-vis */}
      <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[2.0, 0.9, 4.4]} /><meshStandardMaterial color="#e8eaed" metalness={0.2} roughness={0.6} /></mesh>
      <mesh position={[0, 1.35, 0.5]} castShadow><boxGeometry args={[1.8, 0.7, 1.9]} /><meshStandardMaterial color="#dfe3e8" metalness={0.2} roughness={0.5} /></mesh>
      <mesh position={[0, 1.78, 0.5]}><boxGeometry args={[0.5, 0.16, 0.3]} /><meshStandardMaterial color="#F79009" emissive="#F79009" emissiveIntensity={1.2} toneMapped={false} /></mesh>
      <mesh position={[0, 0.7, 2.21]}><boxGeometry args={[2.0, 0.32, 0.02]} /><meshStandardMaterial color="#F79009" emissive="#F79009" emissiveIntensity={0.4} toneMapped={false} /></mesh>
    </group>
  )
}

const WARN_COLOR = '#F79009', DANGER_COLOR = '#F04438', OK_COLOR = '#2E90FA'

const SHOCK_GEO = new THREE.RingGeometry(0.86, 1.0, 44)
const BRAKE_GEO = new THREE.BoxGeometry(1.0, 0.14, 0.14)

// soft radial underglow — bright centre fading to transparent, laid flat under the
// vehicle. Colour + opacity are driven per-frame; only shown in warn/breach.
const GLOW_GEO = new THREE.PlaneGeometry(1, 1)
const GLOW_TEX = (() => {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.40)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t
})()

// ── one vehicle's pod + zones + fence + shockwave + banner ──
function VehicleZone({ id, type }) {
  const grp = useRef(), podLed = useRef(), zonesGrp = useRef(), glow = useRef()
  const shock = useRef(), brake = useRef()
  const wave = useRef({ t: 99, kind: 'warn' }), prevState = useRef('ok')
  const z = zonesFor(type)
  const glowR = Math.max(5, z.inner.r * 0.7)   // underglow radius — hugs the chassis base
  const mats = useMemo(() => ({ shock: shockMat() }), [])

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

    // proximity — a soft underglow hugging the vehicle's base, drawn only while
    // this vehicle is in a warn/breach state (amber → red). It's attached to the
    // vehicle (no ground ring), so tight clusters never stack into overlapping
    // soup. Idle trucks show just the cab radar pod.
    if (zonesGrp.current) zonesGrp.current.visible = warn || breach
    if ((warn || breach) && glow.current) {
      glow.current.material.color.set(breach ? DANGER_COLOR : WARN_COLOR)
      glow.current.material.opacity = (breach ? 0.5 : 0.34) + 0.22 * pulse
    }
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

    // brake glow while halted
    if (brake.current) { brake.current.visible = breach; brake.current.material.opacity = breach ? 0.5 + 0.5 * pulse : 0 }
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
      {/* shockwave ring on zone entry */}
      <mesh ref={shock} geometry={SHOCK_GEO} material={mats.shock} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} visible={false} renderOrder={3} />
      {/* proximity underglow — soft glow at the vehicle base, hidden until warn/breach */}
      <group ref={zonesGrp} visible={false}>
        <mesh ref={glow} geometry={GLOW_GEO} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[glowR * 2, glowR * 2, 1]} renderOrder={2}>
          <meshBasicMaterial map={GLOW_TEX} color={WARN_COLOR} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
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
  const nmPushed = useRef(false)
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
      // WORKERS ONLY — vehicle-vs-vehicle proximity is intentionally not modelled.
      const consider = (tx, tz, tid) => {
        const dx = tx - veh.x, dz = tz - veh.z, dist = Math.hypot(dx, dz)
        if (dist < siteMinWorker) siteMinWorker = dist
        if (zoneTest(veh.x, veh.z, veh.yaw, tx, tz, z.inner).inside) {
          worst = 'danger'
          anyInnerWorker = true; noteWorker(tid, 2, veh.id, dist)
          if (dist < closestDangerDist) { closestDangerDist = dist; closestTarget = { x: tx, z: tz } }
          return
        }
        if (zoneTest(veh.x, veh.z, veh.yaw, tx, tz, z.outer).inside) { if (worst === 'ok') worst = 'warn'; noteWorker(tid, 1, veh.id, dist) }
      }
      for (const w of workers) consider(w.x, w.z, w.id)

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

    // near-miss AUTO-STOP → write a Vehicle-Safety violation to the management
    // Safety data (once per near-miss activation)
    if (phantom.active) {
      const nm = wInfo.get('nearmiss-actor')
      if (nm && nm.rank === 2 && !nmPushed.current) {
        nmPushed.current = true
        pushLiveSafety({ cat: 'Vehicle Safety', severity: 'Critical', description: 'Light-vehicle proximity — haul truck AUTO-STOP', location: 'Haul Road', camera: 'CV-11' })
      }
    } else nmPushed.current = false
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
