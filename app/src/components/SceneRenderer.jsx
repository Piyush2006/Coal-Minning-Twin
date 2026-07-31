import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { TransformControls, useHelper, Html } from '@react-three/drei'
import { BoxHelper, Vector3, Box3, CatmullRomCurve3, RingGeometry, CircleGeometry, SphereGeometry } from 'three'
import { useSceneStore } from '../store/sceneStore'
import { useActiveAlerts, alertSeverityMap, ALERT_SEVERITY_COLOR } from '../lib/alertsEngine'
import { useFeedStore } from './CameraFeed'
import { pathFillMap } from '../lib/loadStateMap'
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
function PathDrive({ obj, editMode, children }) {
  const ref = useRef()
  const path = obj.config?.path
  const key = JSON.stringify(path?.waypoints ?? null)
  const curve = useMemo(() => {
    const wps = path?.waypoints
    if (!Array.isArray(wps) || wps.length < 2) return null
    return new CatmullRomCurve3(wps.map(w => new Vector3(w[0], w[1] ?? 0, w[2])), path.loop !== false, 'centripetal')
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g || !curve) return
    if (editMode || obj.status !== 'running' || obj.config?.enabled === false) {
      g.position.set(0, 0, 0); g.rotation.y = 0
      return
    }
    const len = curve.getLength()
    if (!len) return
    const speed = path.speed ?? 3
    const dwell = Math.max(0, Number(path.dwell) || 0)
    const travel = len / speed                       // seconds to drive the loop once
    const cycle = travel + dwell
    const u = (clock.elapsedTime + (path.phase ?? 0) * cycle) % cycle
    const t = u < dwell ? 0 : Math.min((u - dwell) / travel, 0.9999)   // park at waypoint 0, then drive

    // ── load state (generic): parts flagged material.loadState read this ──
    // While dwelling at waypoint 0 the load RAMPS 0→1 (being loaded, e.g. by
    // the excavator's dig-swings); it stays full until `loadState.dumpAt`
    // (fraction of the loop where the vehicle tips), then empty for the
    // return leg. Vehicles without loadState stay permanently full (legacy).
    const ls = path.loadState
    // path.loadedSlow (>1): the LOADED leg (up to dumpAt) is driven that much
    // slower, the empty return correspondingly faster — same cycle time. f is
    // the warped ARC fraction; position and load state both read it so trucks
    // still flip loaded/empty exactly at the dump point.
    let f = t
    const slow = Number(path.loadedSlow) || 0
    if (ls && slow > 1) {
      const dA = ls.dumpAt ?? 0.5
      const TA = dA * slow, T = TA + (1 - dA)
      const tau = t * T
      f = tau < TA ? tau / slow : dA + (tau - TA)
    }
    if (ls) {
      let fill
      if (dwell > 0 && u < dwell) fill = Math.min(1, u / (dwell * 0.85))
      else fill = f < (ls.dumpAt ?? 0.5) ? 1 : 0
      pathFillMap[obj.id] = fill
    }
    const p = curve.getPointAt(f)
    const tan = curve.getTangentAt(f)
    g.position.set(p.x - obj.position[0], p.y - obj.position[1], p.z - obj.position[2])
    // vehicle forward = +X; yaw from the path tangent, minus the authored yaw
    g.rotation.y = Math.atan2(-tan.z, tan.x) - (obj.rotation?.[1] ?? 0)
  })
  if (!curve) return children
  return <group ref={ref}>{children}</group>
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

function SceneObject({ obj, orbitRef, glowColor, allowLight, inGroup, pointRef, setHoveredId, alertSev }) {
  const groupRef  = useRef()
  const visualRef = useRef()   // the asset visual only — measured by AlertIndicator
  const [mounted, setMounted] = useState(false)

  const {
    selectedId, editMode, transformMode, layers, customAssetTypes,
    selectObject, flyToObject, updateObject, commitTransform, addConnection, clearSelection,
  } = useSceneStore()

  const isSelected = selectedId === obj.id
  const layer      = layers[obj.layer]
  const popRef     = useRef(0)
  // Ground planes (built-in Floor, or any custom type flagged `ground` e.g. a
  // plant grade/apron) cover the whole scene — skip pop/lift/fly cues AND don't
  // grab selection on click (a click on the ground deselects, like empty space).
  const isGround   = obj.type === 'Floor' || customAssetTypes[obj.type]?.ground === true

  useEffect(() => { setMounted(true) }, [])

  // Selection "pop": in view mode, the selected asset (or every member of a
  // selected group/line) lifts + scales up slightly — a clearer cue than a
  // ground ring. Never runs in edit mode so it can't fight the gizmo transform.
  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const want = !editMode && !isGround && (isSelected || inGroup)
    if (!want && popRef.current === 0) return
    if (editMode) { popRef.current = 0; return }
    const target = want ? LIFT : 0
    popRef.current += (target - popRef.current) * 0.14
    if (popRef.current < 0.003) popRef.current = 0
    g.position.y = obj.position[1] + popRef.current
    const k = 1 + popRef.current * 0.03
    g.scale.set(obj.scale[0] * k, obj.scale[1] * k, obj.scale[2] * k)
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
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
        onClick={handleClick}
        onPointerOver={(e) => { if (editMode || isGround || !setHoveredId) return; e.stopPropagation(); if (e.point && pointRef) pointRef.current.copy(e.point); setHoveredId(obj.id) }}
        onPointerMove={(e) => { if (editMode || isGround || !pointRef) return; e.stopPropagation(); if (e.point) pointRef.current.copy(e.point) }}
        onPointerOut={(e) => { if (editMode || !setHoveredId) return; e.stopPropagation(); setHoveredId(cur => (cur === obj.id ? null : cur)) }}
      >
        <PathDrive obj={obj} editMode={editMode}>
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
        </PathDrive>
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

export function SceneRenderer({ orbitRef, glowMap = {} }) {
  const { objects, groups, selectedGroupId, editMode, clearSelection } = useSceneStore()
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
    <group onClick={(e) => { if (e.object.type === 'Mesh') return; clearSelection() }}>
      {Object.values(objects).map(obj => (
        <SceneObject key={obj.id} obj={obj} orbitRef={orbitRef}
          glowColor={glowMap[obj.id] ?? null}
          allowLight={lightAllowed.has(obj.id)}
          inGroup={groupMembers?.has(obj.id) ?? false}
          pointRef={pointRef} setHoveredId={setHoveredId}
          alertSev={alertMap[obj.id] ?? null} />
      ))}
      {editMode && selectedGroupId && groupMembers?.size > 0 && (
        <GroupGizmo key={selectedGroupId} groupId={selectedGroupId} orbitRef={orbitRef} />
      )}
      {!editMode && <HoverTooltips hoveredId={hoveredId} pointRef={pointRef} />}
    </group>
  )
}
