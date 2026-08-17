import { memo, useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { TransformControls, useHelper, Html } from '@react-three/drei'
import { BoxHelper, Vector3, Box3, CatmullRomCurve3, RingGeometry, CircleGeometry, SphereGeometry } from 'three'
import { useSceneStore } from '../store/sceneStore'
import { useTourStore } from './TourPlayer'
import { useActiveAlerts, alertSeverityMap, ALERT_SEVERITY_COLOR } from '../lib/alertsEngine'
import { useFeedStore } from './CameraFeed'
import { pathFillMap } from '../lib/loadStateMap'
import { vehicleMotion, accelFor, effectiveCap, integrate, stoppingSpeed, convoyFor, convoyLeave } from '../lib/vehicleMotion'
import { MACHINE_COMPONENTS, getPorts } from '../lib/machineLibrary'
import { CompositeAsset } from './CompositeAsset'
import { SubComponentsLayer } from './SubComponentsLayer'
import { getSubComponents } from '../lib/componentSubs'
import { findSnap } from '../lib/snapEngine'
import { descendantObjectIds, groupCentroidBounds } from '../lib/hierarchy'
import { beginTransform, endTransform } from '../lib/interactionGuard'
import { getParameterSchema } from '../lib/parameterSchemas'
import { C, FONT } from '../ui/theme'
import { ComponentCard, GroupCard } from './HoverCards'

const PORT_COLORS = {
  product:  '#00c8ff',
  conveyor: '#00ffcc',
  utility:  '#ffaa00',
  co2:      '#88ffaa',
}

// Standalone connector-geometry assets — don't auto-record a connection on snap
// (they'd double up with the Connectors renderer).
const CONNECTOR_ASSET_TYPES = new Set(['ConveyorBelt', 'PipeSegment'])

// Rule-driven glow: emissive halo ring (always) + a capped pulsing point light
// that tints the machine's PBR materials. Lives in its own component so its
// useFrame doesn't perturb SceneObject's hook order.
function Glow({ color, allowLight }) {
  const lightRef = useRef()
  useFrame(({ clock }) => {
    if (lightRef.current) lightRef.current.intensity = 1.1 + Math.sin(clock.elapsedTime * 3) * 0.5
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.6, 2.5, 40]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6}
          transparent opacity={0.35} side={2} />
      </mesh>
      {allowLight && (
        <pointLight ref={lightRef} color={color} distance={6} decay={2} intensity={1.2} position={[0, 1.4, 0]} />
      )}
    </group>
  )
}

function PortDots({ obj, isSelected }) {
  const ports = getPorts(obj)
  if (ports.length === 0) return null
  return (
    <>
      {ports.map(port => (
        <mesh key={port.id} position={port.offset}>
          <sphereGeometry args={[0.13, 8, 8]} />
          <meshStandardMaterial
            color={PORT_COLORS[port.type] ?? '#ffffff'}
            emissive={PORT_COLORS[port.type] ?? '#ffffff'}
            emissiveIntensity={isSelected ? 1.4 : 0.25}
            roughness={0.2}
            metalness={0}
          />
        </mesh>
      ))}
    </>
  )
}

function SelectionOutline({ groupRef }) {
  useHelper(groupRef, BoxHelper, 0x00c8ff)
  return null
}

// Light base halo used to mark members of a selected GROUP (kept subtle).
function SelectionHalo() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.06
    ref.current.scale.set(s, s, s)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[2.2, 2.55, 48]} />
      <meshBasicMaterial color="#0a84ff" transparent opacity={0.45} side={2} toneMapped={false} />
    </mesh>
  )
}

const noRaycast = () => null
const LIFT = 1.0   // how far a selected asset / line "pops" up (view mode)

// ── Path-follow drive (generic) ────────────────────────────────────────────
// Any asset opts in via config.path = { waypoints: [[x,y,z],…], speed (m/s),
// loop?: true, phase?: 0..1, dwell?: seconds } — the VISUAL travels a smooth
// loop through the world-space waypoints (haul trucks, AGVs, shuttle cars …).
// `dwell` parks the vehicle at the FIRST waypoint for that many seconds each
// cycle (e.g. waiting under an excavator to be loaded) before driving the
// loop. The store object keeps its authored position (selection, connectors
// and snapping unaffected); only the rendered mesh is offset. Paused in edit
// mode and when not running.
// Hook-free gate: only actual path-driven movers mount PathDrive (and its
// per-frame subscription); everything else renders children directly.
const _pdPos = new Vector3(), _pdTan = new Vector3()

// One frame subscriber animates the selection pop for whichever objects want
// it (the selected one / selected-group members) — byte-identical math to the
// old per-object callbacks, minus 63 idle subscriptions.
const popRegistry = new Map()
function SelectionPopDriver() {
  useFrame(() => {
    for (const e of popRegistry.values()) {
      const g = e.g.current
      if (!g) continue
      if (!e.want && e.v === 0) continue
      if (e.edit) { e.v = 0; continue }
      const target = e.want ? LIFT : 0
      e.v += (target - e.v) * 0.14
      if (e.v < 0.003) e.v = 0
      g.position.y = e.baseY + e.v
      const k = 1 + e.v * 0.03
      g.scale.set(e.baseScale[0] * k, e.baseScale[1] * k, e.baseScale[2] * k)
    }
  })
  return null
}

function MaybePathDrive({ obj, editMode, children }) {
  const wps = obj.config?.path?.waypoints
  if (!Array.isArray(wps) || wps.length < 2) return children
  return <PathDrive obj={obj} editMode={editMode}>{children}</PathDrive>
}

// Motion-shaping constants (all subtle by design — see self-check "lean/dip
// subtle"). Curvature slows the vehicle in bends; yaw eases toward the tangent
// instead of snapping; pitch/roll come from longitudinal / lateral accel.
const CURVE_K = 6, CURVE_FLOOR = 0.4       // v_limit = max·clamp(1−κ·K, FLOOR, 1)
const YAW_K = 5                            // yaw ease rate (higher = snappier)
const PITCH_K = 0.020, PITCH_MAX = 0.026   // ~1.5° nose dip/lift from accel
const ROLL_K = 0.016, ROLL_MAX = 0.035     // ~2° bank into corners
const _clampf = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

function PathDrive({ obj, editMode, children }) {
  const ref = useRef()      // outer: position + yaw
  const tilt = useRef()     // inner: body pitch/roll/settle (vehicle-local frame)
  const path = obj.config?.path
  const key = JSON.stringify(path?.waypoints ?? null)
  // curve + arc length + a curvature LUT (κ per sample), all memoised together.
  const geom = useMemo(() => {
    const wps = path?.waypoints
    if (!Array.isArray(wps) || wps.length < 2) return null
    const curve = new CatmullRomCurve3(wps.map(w => new Vector3(w[0], w[1] ?? 0, w[2])), path.loop !== false, 'centripetal')
    const len = curve.getLength() || 1
    const N = 96
    const curv = new Float32Array(N)
    const a = new Vector3(), b = new Vector3()
    for (let i = 0; i < N; i++) {
      curve.getTangentAt(i / N, a)
      curve.getTangentAt(((i + 1) % N) / N, b)       // wrap to 0 on the last cell (loop)
      let d = a.dot(b); d = d > 1 ? 1 : d < -1 ? -1 : d
      curv[i] = Math.acos(d) / (len / N)             // κ ≈ dθ/ds
    }
    return { curve, len, curv, N }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // convoy membership cleanup on unmount / path change
  useEffect(() => {
    if (!path?.convoy) return
    return () => convoyLeave(key, obj.id)
  }, [key, obj.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((rootState, delta) => {
    const g = ref.current
    if (!g || !geom) return
    const st = vehicleMotion(obj.id)
    // parked (edit / not running / disabled): sit at the authored pose, freeze.
    if (editMode || obj.status !== 'running' || obj.config?.enabled === false) {
      g.position.set(0, 0, 0); g.rotation.y = 0
      if (tilt.current) { tilt.current.rotation.set(0, 0, 0); tilt.current.position.y = 0 }
      st.v = 0
      return
    }
    const { curve, len, curv, N } = geom
    const dtc = Math.min(delta || 0.016, 0.05)   // clamp dt (tab-refocus spikes)
    const maxSpeed = path.speed ?? 3
    const dwell = Math.max(0, Number(path.dwell) || 0)
    const { accel, decel } = accelFor(obj.type)
    const ls = path.loadState
    const convoy = !!path.convoy
    const crawl = path.crawl || {}
    const cBefore = Math.max(0, Number(crawl.before) || 0)   // crawl-zone metres before wp0
    const cAfter = Math.max(0, Number(crawl.after) || 0)     // …and after it
    const cSpeed = Number(crawl.speed) || 0.7

    if (convoy) {
      // ── convoy mode: all members ride ONE master arc-clock at equal offsets —
      //    constant spacing by construction, overlap impossible. The dwell stop
      //    is replaced by the loading-crawl zone around wp0.
      const cv = convoyFor(key)
      cv.members.set(obj.id, true)
      const ids = [...cv.members.keys()].sort()
      const n = ids.length
      const slot = ids.indexOf(obj.id)
      // advance the master exactly once per frame (first member to tick it)
      if (cv.frame !== rootState.clock.elapsedTime) {
        cv.frame = rootState.clock.elapsedTime
        if (!cv.inited) { cv.arc = 0; cv.v = maxSpeed; cv.inited = true }
        // master target = MIN over members of (curvature cap, crawl zone, external caps/stops)
        let target = maxSpeed
        for (let i = 0; i < n; i++) {
          const ai = (cv.arc + (i * len) / n) % len
          const kappa = curv[Math.min(N - 1, Math.floor((ai / len) * N))] || 0
          let cap = maxSpeed * _clampf(1 - kappa * CURVE_K, CURVE_FLOOR, 1)
          if ((cBefore > 0 || cAfter > 0) && (ai > len - cBefore || ai < cAfter)) cap = Math.min(cap, cSpeed)
          cap = effectiveCap(vehicleMotion(ids[i]), cap)   // folds any external caps/stops
          if (cap < target) target = cap
        }
        const dv = target - cv.v
        const a = dv >= 0 ? accel : decel
        cv.v += Math.sign(dv) * Math.min(Math.abs(dv), a * dtc)
        if (cv.v < 0) cv.v = 0
        cv.arc = (cv.arc + cv.v * dtc) % len
      }
      st.prevV = st.v
      st.v = cv.v
      st.arc = (cv.arc + (slot * len) / n) % len
      if (!st.initDone) {
        curve.getTangentAt(_clampf(st.arc / len, 0, 0.999999), _pdTan)
        st.yaw = Math.atan2(-_pdTan.z, _pdTan.x) - (obj.rotation?.[1] ?? 0)
        st.initDone = true
      }
    } else {
      // ── independent mode (original): own integration + dwell at wp0 ──
      // first running frame: distribute along the loop from path.phase and start
      // at cruise (so the fleet doesn't visibly spin up from a standstill on load).
      if (!st.initDone) {
        st.arc = (((path.phase ?? 0) % 1) + 1) % 1 * len
        curve.getTangentAt(_clampf(st.arc / len, 0, 0.999999), _pdTan)
        st.yaw = Math.atan2(-_pdTan.z, _pdTan.x) - (obj.rotation?.[1] ?? 0)
        st.v = maxSpeed
        st.initDone = true
      }

      // ── speed target = MIN of cruise / loadedSlow / curvature / dwell-approach,
      //    then folded with any external caps + hard stops ─
      const f0 = st.arc / len
      let cruise = maxSpeed
      const slow = Number(path.loadedSlow) || 0
      if (ls && slow > 1 && f0 < (ls.dumpAt ?? 0.5)) cruise = maxSpeed / slow   // slower while loaded
      const kappa = curv[Math.min(N - 1, Math.floor(f0 * N))] || 0
      let cap = Math.min(cruise, maxSpeed * _clampf(1 - kappa * CURVE_K, CURVE_FLOOR, 1))
      // anticipate the dwell stop at waypoint 0 (ease OUT, not screech to a halt)
      if (dwell > 0 && st.dwellT <= 0) cap = Math.min(cap, stoppingSpeed(len - st.arc, decel))
      // hold during the dwell
      if (st.dwellT > 0) { st.dwellT = Math.max(0, st.dwellT - dtc); cap = 0 }

      integrate(st, effectiveCap(st, cap), accel, decel, dtc)

      // arrival at wp0 → begin the dwell; plain loop wrap otherwise
      if (dwell > 0 && st.dwellT <= 0 && (len - st.arc) < 0.25 && st.v < 0.4) {
        st.arc = 0; st.v = 0; st.dwellT = dwell
      }
      if (st.arc >= len) st.arc = path.loop !== false ? st.arc - len : len
    }
    const prevYaw = st.yaw
    const f = _clampf(st.arc / len, 0, 0.999999)

    // ── load fill: convoy → ramps 0→1 while creeping through the loading-crawl
    //    zone; independent → ramps while parked at the dwell. Then 1 until
    //    dumpAt, 0 for the return leg. Rising edge kicks a load-settle dip.
    if (ls) {
      let fill
      if (convoy) {
        const zone = cBefore + cAfter
        const dIn = st.arc > len - cBefore ? st.arc - (len - cBefore) : (st.arc < cAfter ? st.arc + cBefore : -1)
        fill = zone > 0 && dIn >= 0 ? Math.min(1, dIn / (zone * 0.85)) : (f < (ls.dumpAt ?? 0.5) ? 1 : 0)
      } else {
        fill = st.dwellT > 0 ? Math.min(1, (1 - st.dwellT / dwell) / 0.85)
          : f < (ls.dumpAt ?? 0.5) ? 1 : 0
      }
      if ((st._fill ?? 0) < 0.9 && fill >= 0.9) st.settle = 1
      st._fill = fill
      pathFillMap[obj.id] = fill
    }

    // position (p is the world point on the curve; keep the live world pos readable)
    const p = curve.getPointAt(f, _pdPos)
    st.wx = p.x; st.wy = p.y; st.wz = p.z
    g.position.set(p.x - obj.position[0], p.y - obj.position[1], p.z - obj.position[2])

    // yaw: damped shortest-angle ease toward the tangent (kills the corner snap)
    const tan = curve.getTangentAt(f, _pdTan)
    const targetYaw = Math.atan2(-tan.z, tan.x) - (obj.rotation?.[1] ?? 0)
    let dy = targetYaw - st.yaw
    while (dy > Math.PI) dy -= 2 * Math.PI
    while (dy < -Math.PI) dy += 2 * Math.PI
    st.yaw += dy * Math.min(1, dtc * YAW_K)
    g.rotation.y = st.yaw

    // body dynamics (inner group, vehicle frame): pitch from accel, roll from
    // lateral accel (v·yawRate), plus a decaying settle when freshly loaded.
    if (tilt.current) {
      const accelInst = (st.v - st.prevV) / Math.max(dtc, 1e-4)
      const yawRate = ((st.yaw - prevYaw)) / Math.max(dtc, 1e-4)
      const pitchT = _clampf(-accelInst * PITCH_K, -PITCH_MAX, PITCH_MAX)
      const rollT = _clampf(st.v * yawRate * ROLL_K, -ROLL_MAX, ROLL_MAX)
      st.pitch += (pitchT - st.pitch) * Math.min(1, dtc * 6)
      st.roll += (rollT - st.roll) * Math.min(1, dtc * 6)
      if (st.settle > 0.001) st.settle *= Math.pow(0.05, dtc); else st.settle = 0
      tilt.current.rotation.z = st.pitch          // nose up/down
      tilt.current.rotation.x = st.roll           // bank
      tilt.current.position.y = -0.03 * st.settle // load squat, recovers
    }
  })
  if (!geom) return children
  return <group ref={ref}><group ref={tilt}>{children}</group></group>
}

// ── AlertIndicator (generic, replaces the old StatusLamp) ──────────────────
// Marks any asset with an ACTIVE alert, driven by the asset's highest-severity
// alert — the SAME severity the alerts panel derives (alertsEngine) and the
// SAME severity→colour source (ALERT_SEVERITY_COLOR), so ring and panel row
// always agree. Behaviour:
//   warn      → steady amber ground ring sized to the asset footprint
//   critical  → pulsing red ground ring + small floating beacon above the
//               asset (visible when the ring is occluded)
//   no alert  → nothing rendered
// Opt-out per asset via config.alertIndicator = false. Cheap: shared unit
// geometries scaled per instance, one throttled bbox remeasure, no per-frame
// allocations. `targetRef` must be the asset VISUAL only (a sibling group the
// indicator is NOT inside) — measuring a group containing the indicator itself
// would feed the ring's own extent back into the radius and inflate it.
const ALERT_RING_GEO = new RingGeometry(0.78, 1, 48)
const ALERT_FILL_GEO = new CircleGeometry(0.78, 48)
const ALERT_MARKER_GEO = new SphereGeometry(1, 12, 10)
const _alertWorldPos = new Vector3()

function AlertIndicator({ severity, targetRef }) {
  const ringRef = useRef(), ringMat = useRef(), fillRef = useRef(), markerRef = useRef()
  const box = useRef(new Box3())
  const dims = useRef({ r: 2, top: 3 })
  const frame = useRef(0)
  const critical = severity === 'critical'
  const color = ALERT_SEVERITY_COLOR[severity] ?? ALERT_SEVERITY_COLOR.warn
  useFrame(({ clock }) => {
    const g = targetRef.current
    if (!g) return
    if ((frame.current++ % 30) === 0) {           // throttled bbox remeasure of the asset visual only
      box.current.setFromObject(g)
      if (isFinite(box.current.min.x) && !box.current.isEmpty()) {
        g.getWorldPosition(_alertWorldPos)
        const rx = (box.current.max.x - box.current.min.x) / 2
        const rz = (box.current.max.z - box.current.min.z) / 2
        // Circumscribed footprint radius (hypot, not max): rectangular bases —
        // foundation pads/skids — would otherwise swallow the ring along their
        // long sides. This keeps the band just outside ANY footprint, fixed to
        // the asset's own measured radius.
        dims.current.r = Math.max(1.6, Math.hypot(rx, rz))
        dims.current.top = box.current.max.y - _alertWorldPos.y + 1.0
      }
    }
    const t = clock.elapsedTime
    if (ringRef.current) {
      ringRef.current.scale.setScalar(dims.current.r)                  // constant size — no scale pulse
      if (ringMat.current) ringMat.current.opacity = critical ? 0.75 + 0.2 * Math.sin(t * 4) : 0.85
    }
    if (fillRef.current) fillRef.current.scale.setScalar(dims.current.r)
    if (markerRef.current) {
      markerRef.current.position.y = dims.current.top + 0.22 * Math.sin(t * 2)
    }
  })
  return (
    <group>
      <mesh ref={ringRef} geometry={ALERT_RING_GEO} raycast={noRaycast}
        rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} renderOrder={3}>
        <meshBasicMaterial ref={ringMat} color={color} transparent opacity={0.85}
          depthWrite={false} side={2} toneMapped={false} />
      </mesh>
      {/* faint filled disc inside the band — makes the alert footprint read
          clearly even on busy ground textures */}
      <mesh ref={fillRef} geometry={ALERT_FILL_GEO} raycast={noRaycast}
        rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.105, 0]} renderOrder={2}>
        <meshBasicMaterial color={color} transparent opacity={0.14}
          depthWrite={false} side={2} toneMapped={false} />
      </mesh>
      {critical && (
        <mesh ref={markerRef} geometry={ALERT_MARKER_GEO} raycast={noRaycast} position={[0, 3, 0]} scale={0.24}>
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

// A bobbing pin floating above the SINGLE selected asset (no ground ring) —
// tracks the live world bounding box top, so it sits just above any asset and
// rises with the selection lift. World space; updated imperatively in useFrame.
function SelectionFX({ groupRef, color = '#0a84ff' }) {
  const pin = useRef()
  const box = useRef(new Box3()), ctr = useRef(new Vector3())
  useFrame(({ clock }) => {
    const g = groupRef.current
    if (!g || !pin.current) return
    box.current.setFromObject(g)
    if (!isFinite(box.current.min.x) || box.current.isEmpty()) return
    box.current.getCenter(ctr.current)
    pin.current.position.set(ctr.current.x, box.current.max.y + 1.1 + Math.sin(clock.elapsedTime * 2.5) * 0.2, ctr.current.z)
  })
  return (
    <group ref={pin}>
      <mesh raycast={noRaycast} position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
      <mesh raycast={noRaycast} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.26, 0.5, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  )
}

function SceneObjectImpl({ obj, orbitRef, glowColor, allowLight, inGroup, pointRef, setHoveredId, alertSev }) {
  const groupRef  = useRef()
  const visualRef = useRef()   // the asset visual only — measured by AlertIndicator
  const [mounted, setMounted] = useState(false)

  // Narrow subscriptions: primitives / stable slices only, so the 1 Hz
  // telemetry tick (which rebuilds the objects map) re-renders an object ONLY
  // when a field its 3D actually consumes changed (see memo comparator below).
  const isSelected = useSceneStore(s => s.selectedId === obj.id)
  const editMode = useSceneStore(s => s.editMode)
  const transformMode = useSceneStore(s => s.transformMode)
  const layer = useSceneStore(s => s.layers[obj.layer])
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  // zustand actions are stable references — read once, no subscription
  const { selectObject, flyToObject, updateObject, commitTransform, addConnection, clearSelection } = useSceneStore.getState()
  // Ground planes (built-in Floor, or any custom type flagged `ground` e.g. a
  // plant grade/apron) cover the whole scene — skip pop/lift/fly cues AND don't
  // grab selection on click (a click on the ground deselects, like empty space).
  const isGround   = obj.type === 'Floor' || customAssetTypes[obj.type]?.ground === true

  useEffect(() => { setMounted(true) }, [])

  // Selection "pop": in view mode, the selected asset (or every member of a
  // selected group/line) lifts + scales up slightly — a clearer cue than a
  // ground ring. Never runs in edit mode so it can't fight the gizmo transform.
  // Selection pop is driven by ONE global subscriber (SelectionPopDriver) —
  // register this object's group + base transform; keep them fresh on change.
  useEffect(() => {
    popRegistry.set(obj.id, { g: groupRef, baseY: obj.position[1], baseScale: obj.scale, isGround, want: false, v: 0 })
    return () => { popRegistry.delete(obj.id) }
  }, [obj.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const e = popRegistry.get(obj.id)
    if (e) { e.baseY = obj.position[1]; e.baseScale = obj.scale; e.isGround = isGround; e.want = !editMode && !isGround && (isSelected || inGroup); e.edit = editMode }
  })

  if (obj.config?.hidden) return null            // data-only object (KPIs/alerts, no 3D)
  if (!obj.visible || !layer?.visible) return null

  // Built-in component, or a user-defined custom type → generic Primitive.
  const typeDef   = customAssetTypes[obj.type]
  const Component = MACHINE_COMPONENTS[obj.type] ?? (typeDef ? CompositeAsset : null)
  if (!Component) return null

  const handleClick = (e) => {
    e.stopPropagation()
    if (layer?.locked) return
    // Clicking the ground plane deselects (select/edit it from the namespace tree).
    if (isGround) { clearSelection(); return }
    selectObject(obj.id)
    if (!editMode) flyToObject(obj.id)   // view mode: clicking an asset frames + zooms onto it
    // watch-capable assets (CCTV cameras) also open their live feed panel
    if (!editMode && obj.config?.watch) useFeedStore.getState().openFeed(obj.id)
  }

  const handleTransformChange = () => {
    const g = groupRef.current
    if (!g) return
    updateObject(obj.id, {
      position: g.position.toArray(),
      rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
      scale:    g.scale.toArray(),
    })
  }

  const handleMouseUp = () => {
    if (orbitRef?.current) orbitRef.current.enabled = true
    endTransform()   // keep selection through the drag's pointer-up (see interactionGuard)

    // Sync final drag position to store
    const g = groupRef.current
    if (g) {
      updateObject(obj.id, {
        position: g.position.toArray(),
        rotation: [g.rotation.x, g.rotation.y, g.rotation.z],
        scale:    g.scale.toArray(),
      })
    }

    // Check snap using freshest store state
    const latestObjects = useSceneStore.getState().objects
    const snap = findSnap(latestObjects, obj.id)
    if (snap && g) {
      updateObject(obj.id, { position: snap.position })
      g.position.set(...snap.position)
      // Record a logical connection (auto-creates a connector) unless the dragged
      // object is itself a connector-geometry asset. addConnection snapshots history.
      if (!CONNECTOR_ASSET_TYPES.has(obj.type)) {
        addConnection(obj.id, snap.sourcePort, snap.targetId, snap.targetPort)
        return
      }
    }

    commitTransform()
  }

  return (
    <>
      <group
        ref={groupRef}
        name={obj.id}
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
        onClick={handleClick}
        onPointerOver={(e) => { if (editMode || isGround || !setHoveredId) return; e.stopPropagation(); if (e.point && pointRef) pointRef.current.copy(e.point); setHoveredId(obj.id) }}
        onPointerMove={(e) => { if (editMode || isGround || !pointRef) return; e.stopPropagation(); if (e.point) pointRef.current.copy(e.point) }}
        onPointerOut={(e) => { if (editMode || !setHoveredId) return; e.stopPropagation(); setHoveredId(cur => (cur === obj.id ? null : cur)) }}
      >
        <MaybePathDrive obj={obj} editMode={editMode}>
          {/* visualRef wraps ONLY the asset's own visual — the AlertIndicator
              measures it as a sibling, so its ring never inflates itself */}
          <group ref={visualRef}>
            <Component status={obj.status} state={obj.state} config={obj.config} typeDef={typeDef} name={obj.name} alertSev={alertSev} objId={obj.id} />
            {getSubComponents(obj.type, customAssetTypes).filter(d => d.scene).map(d => (
              <SubComponentsLayer key={d.id} obj={obj} def={d} />
            ))}
          </group>
          {!isGround && obj.config?.alertIndicator !== false && alertSev && mounted && (
            <AlertIndicator severity={alertSev} targetRef={visualRef} />
          )}
        </MaybePathDrive>
        {editMode && <PortDots obj={obj} isSelected={isSelected} />}
        {glowColor && <Glow color={glowColor} allowLight={allowLight} />}
      </group>

      {/* single-asset selection marker — floating pin (the asset itself lifts) */}
      {isSelected && !isGround && mounted && groupRef.current && <SelectionFX groupRef={groupRef} />}

      {editMode && isSelected && mounted && groupRef.current && (
        <SelectionOutline groupRef={groupRef} />
      )}

      {editMode && isSelected && mounted && groupRef.current && !layer?.locked && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          size={0.8}
          onMouseDown={() => { beginTransform(); if (orbitRef?.current) orbitRef.current.enabled = false }}
          onMouseUp={handleMouseUp}
          onChange={handleTransformChange}
        />
      )}
    </>
  )
}

// Translate-only gizmo for a whole selected group. An invisible proxy mesh at
// the group centroid carries TransformControls; each move applies the delta to
// every descendant asset (no history) and commits on release.
function GroupGizmo({ groupId, orbitRef }) {
  const proxyRef = useRef()
  const last = useRef(null)
  const [mounted, setMounted] = useState(false)
  const { objects, groups, translateGroupBy, commitTransform } = useSceneStore()

  useEffect(() => {
    const { center } = groupCentroidBounds(objects, groups, groupId)
    if (proxyRef.current) {
      proxyRef.current.position.set(center[0], center[1] + 1, center[2])
      last.current = proxyRef.current.position.clone()
    }
    setMounted(true)
  }, [groupId]) // eslint-disable-line

  const onChange = () => {
    const p = proxyRef.current?.position
    if (!p || !last.current) return
    const d = new Vector3().subVectors(p, last.current)
    if (d.lengthSq() === 0) return
    translateGroupBy(groupId, [d.x, d.y, d.z])
    last.current.copy(p)
  }

  return (
    <>
      <mesh ref={proxyRef} visible={false}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshBasicMaterial />
      </mesh>
      {mounted && proxyRef.current && (
        <TransformControls object={proxyRef.current} mode="translate" size={1.1}
          onMouseDown={() => { beginTransform(); if (orbitRef?.current) orbitRef.current.enabled = false }}
          onMouseUp={() => { if (orbitRef?.current) orbitRef.current.enabled = true; commitTransform(); endTransform() }}
          onChange={onChange} />
      )}
    </>
  )
}

const MAX_GLOW_LIGHTS = 8

// ── Hover tooltips (view mode) — the cards live in HoverCards.jsx so bespoke
// assets (e.g. the boiler's internal-zone hovers) reuse the exact same look. ──
// A stack of Html cards pinned to the live cursor point (so it never flies up
// with rising smoke/clouds and never covers the machine). `pointRef` is updated
// imperatively on pointer-move; we read it each frame — no React re-renders.
function HoverCard({ pointRef, children }) {
  const pin = useRef()
  useFrame(() => { if (pin.current && pointRef.current) pin.current.position.copy(pointRef.current) })
  return (
    <group ref={pin}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ transform: 'translate(-50%, calc(-100% - 18px))', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      </Html>
    </group>
  )
}


// Renders the hovered object's param card + the nearest ancestor group's fleet
// summary, stacked and pinned to the cursor (each gated on `tooltip.enabled`).
function HoverTooltips({ hoveredId, pointRef }) {
  const objects = useSceneStore(s => s.objects)
  const groups = useSceneStore(s => s.groups)
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const obj = hoveredId ? objects[hoveredId] : null
  if (!obj) return null

  // Explicit tooltip config wins; otherwise EVERY asset falls back to a generic
  // gauge of its first three schema parameters (key params + units) — so state
  // and telemetry are inspectable on hover across the whole twin.
  const schema = getParameterSchema(obj.type, customAssetTypes)
  const explicit = obj.tooltip?.enabled && obj.tooltip.params?.length ? obj.tooltip.params : null
  const fallback = !explicit && Object.keys(obj.parameters ?? {}).length
    ? schema.filter(d => obj.parameters[d.key] !== undefined).slice(0, 3).map(d => d.key)
    : null
  const tipKeys = explicit ?? fallback
  const compTip = tipKeys?.length ? { params: tipKeys } : null
  let rows = []
  if (compTip) {
    rows = compTip.params.map(key => {
      const def = schema.find(d => d.key === key) || { key, label: key, unit: '' }
      return { key, label: def.label, unit: def.unit, value: obj.parameters?.[key] }
    })
  }

  // nearest ancestor group with a tooltip enabled → fleet summary over its assets
  let gid = obj.parentId, groupTip = null
  while (gid) { const g = groups[gid]; if (!g) break; if (g.tooltip?.enabled) { groupTip = g; break } gid = g.parentId }
  let fleet = null
  if (groupTip) {
    fleet = { total: 0, running: 0, idle: 0, fault: 0 }
    for (const oid of descendantObjectIds(objects, groups, groupTip.id)) {
      const o = objects[oid]; if (!o) continue
      fleet.total++
      if (o.status === 'fault') fleet.fault++
      else if (o.status === 'idle') fleet.idle++
      else fleet.running++
    }
  }

  if (!compTip && !groupTip) return null
  return (
    <HoverCard pointRef={pointRef}>
      {groupTip && fleet?.total > 0 && <GroupCard name={groupTip.name} {...fleet} />}
      {compTip && rows.length > 0 && <ComponentCard name={obj.name} status={obj.status} rows={rows} />}
    </HoverCard>
  )
}


const _arrEq = (a, b) => a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]))
const _objEq = (a, b) => a === b || (
  a.id === b.id && a.type === b.type && a.name === b.name &&
  a.visible === b.visible && a.layer === b.layer &&
  a.status === b.status && a.state === b.state &&
  a.config === b.config && a.subOverrides === b.subOverrides && a.connections === b.connections &&
  _arrEq(a.position, b.position) && _arrEq(a.rotation, b.rotation) && _arrEq(a.scale, b.scale)
)
// NOTE for future work: any NEW render-time read of obj.<field> inside the
// SceneObject tree must be added to _objEq — parameters etc. are intentionally
// ignored here (imperative/self-subscribed consumers only).
const SceneObject = memo(SceneObjectImpl, (p, n) =>
  _objEq(p.obj, n.obj) && p.glowColor === n.glowColor && p.allowLight === n.allowLight &&
  p.inGroup === n.inGroup && p.alertSev === n.alertSev)

export function SceneRenderer({ orbitRef, glowMap = {} }) {
  const objects = useSceneStore(s => s.objects)
  const tourActive = useTourStore(s => s.active)   // the tour hides all floating asset overlays
  const groups = useSceneStore(s => s.groups)
  const selectedGroupId = useSceneStore(s => s.selectedGroupId)
  const editMode = useSceneStore(s => s.editMode)
  const [hoveredId, setHoveredId] = useState(null)
  const pointRef = useRef(new Vector3())   // live cursor hit-point → tooltip anchor
  useEffect(() => { if (editMode) setHoveredId(null) }, [editMode])

  // Generic alert layer: worst active severity per asset drives its AlertIndicator.
  const alerts = useActiveAlerts()
  const alertMap = useMemo(() => alertSeverityMap(alerts), [alerts])

  // Cap dynamic glow lights — first N glowing objects get a light, the rest show
  // only the (cheap) emissive halo ring.
  const lightAllowed = new Set(Object.keys(glowMap).slice(0, MAX_GLOW_LIGHTS))
  const groupMembers = selectedGroupId ? descendantObjectIds(objects, groups, selectedGroupId) : null

  return (
    <group onClick={(e) => { if (e.object.type === 'Mesh') return; useSceneStore.getState().clearSelection() }}>
      {Object.values(objects).map(obj => (
        <SceneObject key={obj.id} obj={obj} orbitRef={orbitRef}
          glowColor={tourActive ? null : (glowMap[obj.id] ?? null)}
          allowLight={lightAllowed.has(obj.id)}
          inGroup={groupMembers?.has(obj.id) ?? false}
          pointRef={pointRef} setHoveredId={setHoveredId}
          alertSev={tourActive ? null : (alertMap[obj.id] ?? null)} />
      ))}
      {editMode && selectedGroupId && groupMembers?.size > 0 && (
        <GroupGizmo key={selectedGroupId} groupId={selectedGroupId} orbitRef={orbitRef} />
      )}
      <SelectionPopDriver />
      {!editMode && <HoverTooltips hoveredId={hoveredId} pointRef={pointRef} />}
    </group>
  )
}
