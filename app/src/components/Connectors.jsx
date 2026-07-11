import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../store/sceneStore'
import { worldPortPos } from '../lib/snapEngine'
import { getPorts } from '../lib/machineLibrary'
import { flattenConnections } from '../lib/connectionSelectors'
import { useActiveAlerts, ALERT_SEVERITY_COLOR } from '../lib/alertsEngine'
import { ConveyorItem }   from './ConveyorBelt'
import { ITEM_MAP }       from '../lib/itemLibrary'
import { resolveColor }   from '../lib/paletteTokens'

// ── Conveyor belt swept along the connector curve ──────────────────────────
// One CONTINUOUS belt (gray surface + amber guide rails + legs) that bends to
// follow the curve, so it reads the same as a straight belt — just curved.
// Builds a horizontal ribbon centered on the curve, optionally shifted sideways
// (for the rails). yOff = height above the curve; shift = lateral offset (m).
const CHAIN_Y = 0.92, ROLLER_Y = 1.05, RAIL_OFF = 0.26, RAIL_W = 0.06
function curveRibbon(curve, width, segs, yOff, shift = 0) {
  const up = new THREE.Vector3(0, 1, 0)
  const len = curve.getLength()
  const pos = [], uv = [], idx = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const p = curve.getPoint(t)
    let side = new THREE.Vector3().crossVectors(curve.getTangent(t), up)
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
    side.normalize()
    const c = p.clone().add(side.clone().multiplyScalar(shift))
    const h = side.clone().multiplyScalar(width / 2)
    pos.push(c.x - h.x, c.y + yOff, c.z - h.z, c.x + h.x, c.y + yOff, c.z + h.z)
    uv.push(t * len, 0, t * len, 1)          // u = metres along the run → texture repeats per metre
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

// Chevron/slat texture for the moving belt surface (shared per style).
let _beltTex = null
function beltTexture() {
  if (_beltTex) return _beltTex
  const c = document.createElement('canvas')
  c.width = 64; c.height = 32
  const g = c.getContext('2d')
  g.fillStyle = '#77879a'; g.fillRect(0, 0, 64, 32)
  g.strokeStyle = '#5d6c7d'; g.lineWidth = 6
  g.beginPath(); g.moveTo(8, 34); g.lineTo(30, 16); g.lineTo(8, -2); g.stroke()   // chevron
  g.strokeStyle = '#8b9aab'; g.lineWidth = 2
  g.beginPath(); g.moveTo(46, 0); g.lineTo(46, 32); g.stroke()                    // slat seam
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 1)                        // uv.u is metres → 1 chevron / metre
  _beltTex = t
  return t
}

function CurveConveyor({ curve, config }) {
  const { running = true, speed = 1.2, beltStyle = 'chain', itemType = 'pet_bottle', itemSpacing = 1.4 } = config
  const roller   = beltStyle === 'roller'
  const len      = curve.getLength()
  const item     = ITEM_MAP[itemType]
  const surfaceY = roller ? ROLLER_Y : CHAIN_Y           // belt-surface height (local, above curve)
  const itemY    = roller ? surfaceY + 0.15 : surfaceY + 0.04   // seat items ON the surface (no float)
  const railColor = roller ? '#3a3f4a' : '#cc7700'
  const segN     = Math.max(8, Math.round(len * 4))

  const built = useMemo(() => {
    // chain → one flat belt surface; roller → cross rollers (the style now shows).
    const surface = roller ? null : curveRibbon(curve, 0.48, segN, CHAIN_Y)
    const railL = curveRibbon(curve, RAIL_W, segN, surfaceY + (roller ? 0 : 0.08), -RAIL_OFF)
    const railR = curveRibbon(curve, RAIL_W, segN, surfaceY + (roller ? 0 : 0.08), +RAIL_OFF)
    const up = new THREE.Vector3(0, 1, 0)
    const sideAt = (t) => {
      const s = new THREE.Vector3().crossVectors(curve.getTangent(t), up)
      return s.lengthSq() < 1e-6 ? new THREE.Vector3(1, 0, 0) : s.normalize()
    }
    // rollers across the belt (roller style only)
    const rollers = []
    if (roller) {
      const nr = Math.max(4, Math.round(len / 0.45))
      for (let i = 0; i <= nr; i++) {
        const t = i / nr, p = curve.getPoint(t)
        const q = new THREE.Quaternion().setFromUnitVectors(up, sideAt(t))   // cylinder axis → across belt
        rollers.push({ pos: [p.x, p.y + ROLLER_Y, p.z], quat: [q.x, q.y, q.z, q.w] })
      }
    }
    // legs anchored to the FLOOR (y=0) up to the belt — so they follow when the belt is raised
    const nLegs = Math.max(2, Math.round(len / 1.8))
    const legs = []
    for (let i = 0; i <= nLegs; i++) {
      const t = i / nLegs, p = curve.getPoint(t)
      const s = sideAt(t).multiplyScalar(0.22)
      const topY = p.y + surfaceY
      legs.push([p.x - s.x, p.z - s.z, topY], [p.x + s.x, p.z + s.z, topY])
    }
    return { surface, railL, railR, rollers, legs }
  }, [curve, segN, roller, surfaceY])
  useEffect(() => () => { built.surface?.dispose(); built.railL.dispose(); built.railR.dispose() }, [built])

  // Items spaced evenly over the whole run (continuous stream, no batches).
  const n = Math.max(1, Math.round(len / itemSpacing))
  const prog = useRef(Array.from({ length: n }, (_, i) => i / n))
  const refs = useRef([])
  useFrame((_, dt) => {
    if (!running || !len) return
    for (let i = 0; i < n; i++) {
      let t = prog.current[i] + (dt * speed) / len
      if (t > 1) t -= 1
      prog.current[i] = t
      const g = refs.current[i]; if (!g) continue
      const p = curve.getPointAt(t)
      g.position.set(p.x, p.y + itemY, p.z)
    }
  })

  // Scrolling belt surface (opt-out via connectorConfig.beltScroll = false):
  // the chevron texture's offset advances with belt speed, so the SURFACE reads
  // as moving even between item spawns.
  const beltMap = useMemo(() => {
    if (config.beltScroll === false) return null
    const t = beltTexture().clone(); t.needsUpdate = true
    return t
  }, [config.beltScroll])
  useEffect(() => () => beltMap?.dispose(), [beltMap])
  useFrame((_, dt) => {
    if (!beltMap || !running) return
    beltMap.offset.x -= dt * speed          // uv.u is metres, so offset = m/s
  })

  return (
    <group>
      {built.surface && <mesh geometry={built.surface} receiveShadow><meshStandardMaterial color="#7a8a9a" metalness={0.6} roughness={0.45} side={THREE.DoubleSide} map={beltMap} /></mesh>}
      {built.rollers.map((r, i) => (
        <mesh key={i} position={r.pos} quaternion={r.quat} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.5, 12]} />
          <meshStandardMaterial color="#505a66" metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
      <mesh geometry={built.railL}><meshStandardMaterial color={railColor} metalness={0.55} roughness={0.45} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={built.railR}><meshStandardMaterial color={railColor} metalness={0.55} roughness={0.45} side={THREE.DoubleSide} /></mesh>
      {built.legs.map(([x, z, topY], i) => (
        <mesh key={i} position={[x, topY / 2, z]}>
          <boxGeometry args={[0.06, Math.max(0.1, topY), 0.06]} />
          <meshStandardMaterial color="#2e3c4a" metalness={0.65} roughness={0.4} />
        </mesh>
      ))}
      {item && Array.from({ length: n }).map((_, i) => (
        <group key={i} ref={el => (refs.current[i] = el)}><ConveyorItem item={item} /></group>
      ))}
    </group>
  )
}

// Bus-bar connector: heavy copper/aluminium conductor bars spanning the gap
// (pots wired electrically in series). Centered on origin along local X.
function BusBarConnector({ len, config }) {
  const { bars = 3, width = 0.28 } = config
  const color = resolveColor(config.color, '#b87333')
  const offsets = bars === 1 ? [0] : Array.from({ length: bars }, (_, i) => -((bars - 1) / 2) * 0.32 + i * 0.32)
  return (
    <group>
      {offsets.map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh castShadow>
            <boxGeometry args={[len, width, width]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.35} />
          </mesh>
          {[-len / 2, len / 2].map((x, j) => (
            <mesh key={j} position={[x, 0, 0]}>
              <boxGeometry args={[0.18, width * 1.6, width * 1.6]} />
              <meshStandardMaterial color="#5b6470" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ── Curve + basis helpers ─────────────────────────────────────────────────
// Outward (horizontal) world normal at a port — the direction the run should
// leave/enter the machine face. Falls back to the run direction for centered ports.
function portWorldNormal(obj, port, fallbackDir) {
  const o = port.offset || [0, 0, 0]
  const local = new THREE.Vector3(o[0], 0, o[2])
  if (local.lengthSq() < 1e-6) {
    const f = fallbackDir.clone(); f.y = 0
    return f.lengthSq() < 1e-6 ? new THREE.Vector3(1, 0, 0) : f.normalize()
  }
  const e = new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2])
  return local.applyEuler(e).setY(0).normalize()
}

// Upright basis (no roll) + midpoint for a straight A→B span (conveyor/busbar).
function basisFromAB(A, B) {
  const dir = new THREE.Vector3().subVectors(B, A)
  const xAxis = dir.clone().normalize()
  let up = new THREE.Vector3(0, 1, 0)
  if (Math.abs(xAxis.dot(up)) > 0.999) up = new THREE.Vector3(0, 0, 1)
  const zAxis = new THREE.Vector3().crossVectors(up, xAxis).normalize()
  const yAxis = new THREE.Vector3().crossVectors(xAxis, zAxis).normalize()
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis))
  const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5)
  return { mid, quat }
}

// ── Orthogonal pipe routing with rounded elbows ───────────────────────────
// Real plant piping runs in straight axis-aligned segments joined by radiused
// elbows — not free-form S-curves. orthoRoute() leaves port A along its normal,
// staircases to B along world axes, and enters B along its normal; roundedPath()
// turns those corners into a CurvePath (straight runs + quadratic elbows).
function dominantAxis(n) {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
  return ay >= ax && ay >= az ? 'y' : ax >= az ? 'x' : 'z'
}
function orthoRoute(A, nA, B, nB) {
  const stub = 1.0
  const a1 = A.clone().addScaledVector(nA, stub)
  const b1 = B.clone().addScaledVector(nB, stub)
  const order = { y: ['y', 'x', 'z'], x: ['x', 'z', 'y'], z: ['z', 'x', 'y'] }[dominantAxis(nA)]
  const pts = [A.clone(), a1.clone()]
  let cur = a1.clone()
  for (const axis of order) {
    cur = cur.clone()
    cur[axis] = b1[axis]
    pts.push(cur.clone())
  }
  pts.push(B.clone())
  return pts
}
function roundedPath(ptsIn, r = 1.0) {
  const pts = ptsIn.filter((p, i) => i === 0 || p.distanceTo(ptsIn[i - 1]) > 1e-3)
  const path = new THREE.CurvePath()
  if (pts.length < 2) return path
  if (pts.length === 2) { path.add(new THREE.LineCurve3(pts[0], pts[1])); return path }
  let cursor = pts[0].clone()
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], next = pts[i + 1]
    const dIn = new THREE.Vector3().subVectors(cur, prev), lenIn = dIn.length()
    const dOut = new THREE.Vector3().subVectors(next, cur), lenOut = dOut.length()
    if (lenIn < 1e-4 || lenOut < 1e-4) continue
    dIn.normalize(); dOut.normalize()
    const rr = Math.min(r, lenIn / 2, lenOut / 2)
    const pIn = cur.clone().addScaledVector(dIn, -rr)
    const pOut = cur.clone().addScaledVector(dOut, rr)
    if (cursor.distanceTo(pIn) > 1e-3) path.add(new THREE.LineCurve3(cursor.clone(), pIn.clone()))
    path.add(new THREE.QuadraticBezierCurve3(pIn.clone(), cur.clone(), pOut.clone()))
    cursor = pOut.clone()
  }
  const last = pts[pts.length - 1]
  if (cursor.distanceTo(last) > 1e-3) path.add(new THREE.LineCurve3(cursor.clone(), last.clone()))
  return path
}

// ── Connector renderers (curved-aware) ─────────────────────────────────────
// Stripe alpha texture for the pipe-flow overlay (white band = visible ring).
// Built per pipe instance so each pipe animates its own offset.
function makeStripeTexture() {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 2
  const g = c.getContext('2d')
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 2)
  g.fillStyle = '#fff'; g.fillRect(0, 0, 24, 2)          // ~38% duty-cycle ring
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

function PipeCurve({ curve, config }) {
  const { radius = 0.12, flowing = true, speed = 1.2, direction = 'forward' } = config
  const color = resolveColor(config.color, '#9fb0c0')
  const len = curve.getLength()
  const segs = Math.max(12, Math.round(len * 4))
  const geo = useMemo(() => new THREE.TubeGeometry(curve, segs, radius, 12, false), [curve, radius, len])
  // Flow overlay: a slightly larger tube on the SAME curve with an animated
  // striped alpha texture — the rings follow every elbow exactly (the old
  // straight dash meshes chorded across bends and poked out of the pipe).
  const flowGeo = useMemo(() => (flowing ? new THREE.TubeGeometry(curve, segs, radius * 1.05, 12, false) : null), [curve, radius, len, flowing])
  const stripes = useMemo(() => makeStripeTexture(), [])
  const repeats = Math.max(2, Math.round(len / 1.4))
  useEffect(() => () => { geo.dispose(); flowGeo?.dispose() }, [geo, flowGeo])
  useEffect(() => () => stripes.dispose(), [stripes])
  const ends = [curve.getPoint(0), curve.getPoint(1)]

  const dir = direction === 'reverse' ? -1 : 1
  useFrame((_, dt) => {
    if (!flowing || !len) return
    stripes.repeat.set(repeats, 1)
    stripes.offset.x -= (dt * speed * dir * repeats) / len   // rings advance source→target
  })

  return (
    <group>
      <mesh geometry={geo} castShadow><meshStandardMaterial color={color} metalness={0.4} roughness={0.4} /></mesh>
      {ends.map((p, i) => (
        <mesh key={i} position={p.toArray()}>
          <sphereGeometry args={[radius * 1.7, 12, 8]} />
          <meshStandardMaterial color="#7f8c9a" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {flowing && flowGeo && (
        <mesh geometry={flowGeo}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2}
            transparent opacity={0.9} alphaMap={stripes} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

// Invisible fat tube along the curve so thin/curved connectors are clickable.
function ConnectorPickProxy({ curve, selected, onSelect }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, Math.max(8, Math.round(curve.getLength() * 2)), 0.4, 6, false), [curve])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group>
      <mesh geometry={geo} onClick={(e) => { e.stopPropagation(); onSelect() }}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {selected && <mesh geometry={geo}><meshBasicMaterial color="#00c8ff" wireframe /></mesh>}
    </group>
  )
}

// Positions children along a straight A→B span (upright, no roll).
function StraightSpan({ A, B, children }) {
  const { mid, quat } = basisFromAB(A, B)
  return <group position={mid.toArray()} quaternion={[quat.x, quat.y, quat.z, quat.w]}>{children}</group>
}

// Build the world-space curves for a connection between two machine ports —
// bezier (conveyors/busbars) + ortho elbows (pipes). EXPORTED so other layers
// can address a point ALONG a belt (t ∈ 0..1 on the same curve the renderer
// and moving items use — e.g. Conveyor-Vision event markers).
export function buildConnectorCurve(src, tgt, conn) {
  const sPort = getPorts(src).find(p => p.id === conn.sourcePort)
  const tPort = getPorts(tgt).find(p => p.id === conn.targetPort)
  if (!sPort || !tPort) return null
  const A = worldPortPos(src, sPort.offset)
  const B = worldPortPos(tgt, tPort.offset)
  const chord = new THREE.Vector3().subVectors(B, A)
  const dist = chord.length()
  if (dist < 1e-4) return null
  const nA = portWorldNormal(src, sPort, chord)               // unit, away from src
  const nB = portWorldNormal(tgt, tPort, chord.clone().negate()) // unit, away from tgt
  const d = Math.min(Math.max(dist * 0.4, 0.6), 6)
  // bezier = gentle curve (conveyors); ortho = right-angle run with rounded elbows (pipes)
  const bezier = new THREE.CubicBezierCurve3(
    A, A.clone().add(nA.clone().multiplyScalar(d)), B.clone().add(nB.clone().multiplyScalar(d)), B)
  const ortho = roundedPath(orthoRoute(A, nA, B, nB), 1.0)
  return { A, B, bezier, ortho }
}

// A single auto-fitting connector between two machine ports. Builds a smooth
// curve that LEAVES/ENTERS each port along the machine face, so offset machines
// connect cleanly instead of cutting a diagonal. Re-fits whenever either moves.
function Connector({ conn, src, tgt, selected, onSelect }) {
  // Recompute geometry only when an endpoint transform / port actually changes.
  const key = JSON.stringify([src.position, src.rotation, src.config?.length,
    tgt.position, tgt.rotation, tgt.config?.length, conn.sourcePort, conn.targetPort])
  const built = useMemo(() => buildConnectorCurve(src, tgt, conn), [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!built) return null
  const { A, B, bezier, ortho } = built
  const cfg = conn.connectorConfig
  const type = conn.connectorType
  const curve = type === 'pipe' ? ortho : bezier   // pipes route as elbows; conveyors stay gentle

  return (
    <group>
      {type === 'conveyor'
        ? <CurveConveyor curve={bezier} config={cfg} />
        : type === 'busbar'
        ? <StraightSpan A={A} B={B}><BusBarConnector len={A.distanceTo(B)} config={cfg} /></StraightSpan>
        : <PipeCurve curve={ortho} config={cfg} />}
      <ConnectorPickProxy curve={curve} selected={selected} onSelect={onSelect} />
    </group>
  )
}

// ── Conveyor-Vision belt-event highlights ───────────────────────────────────
// Any asset (CCTV camera, scanner …) that carries alert rules AND a
// config.watch binding gets its active detections marked at the EXACT belt
// point they fired:
//   config.watch = { sourceId, targetId, sourcePort? }   → a conveyor connector
//   config.watch = { assetId }                           → a ConveyorBelt asset
// The point along the route comes from the asset's `eventPos` parameter
// (0..100 % of the run). Colour/pulse reuse the shared alert severity system
// (warn = steady amber, critical = pulsing red) — no parallel visuals.

// World position of a watcher's belt event point (its `eventPos` % along the
// watched connector / belt asset). Shared by the detection markers AND the
// CCTV feed camera aim. Returns [x,y,z] or null.
export function beltWatchWorldPos(objects, watcherId) {
  const w = objects[watcherId]
  const watch = w?.config?.watch
  if (!watch) return null
  const t = Math.min(0.97, Math.max(0.03, (Number(w.parameters?.eventPos) || 50) / 100))
  if (watch.assetId && objects[watch.assetId]) {
    const belt = objects[watch.assetId]
    const L = belt.config?.length ?? 8
    const v = new THREE.Vector3(-L / 2 + L * t, 1.05, 0)
      .applyEuler(new THREE.Euler(belt.rotation?.[0] ?? 0, belt.rotation?.[1] ?? 0, belt.rotation?.[2] ?? 0))
      .add(new THREE.Vector3(belt.position[0], belt.position[1], belt.position[2]))
    return [v.x, v.y, v.z]
  }
  if (watch.sourceId && watch.targetId) {
    const src = objects[watch.sourceId], tgt = objects[watch.targetId]
    const conn = src?.connections?.find(c =>
      c.targetId === watch.targetId && (!watch.sourcePort || c.sourcePort === watch.sourcePort))
    if (src && tgt && conn) {
      const built = buildConnectorCurve(src, tgt, conn)
      if (built) {
        const p = built.bezier.getPointAt(t)
        return [p.x, p.y + 1.0, p.z]
      }
    }
  }
  return null
}

const noRay = () => null

function BeltEventMarker({ pos, severity }) {
  const ringMat = useRef(), beamMat = useRef()
  const critical = severity === 'critical'
  const color = ALERT_SEVERITY_COLOR[severity] ?? ALERT_SEVERITY_COLOR.warn
  useFrame(({ clock }) => {
    if (!critical) return
    const k = Math.sin(clock.elapsedTime * 4)
    if (ringMat.current) ringMat.current.opacity = 0.6 + 0.3 * k
    if (beamMat.current) beamMat.current.opacity = 0.22 + 0.14 * k
  })
  return (
    <group position={pos}>
      {/* spot ring lying ON the belt */}
      <mesh raycast={noRay} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]} renderOrder={4}>
        <ringGeometry args={[0.45, 0.78, 24]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent opacity={0.85} depthWrite={false} side={2} toneMapped={false} />
      </mesh>
      {/* translucent beacon column so the spot reads from a distance */}
      <mesh raycast={noRay} position={[0, 1.6, 0]} renderOrder={4}>
        <cylinderGeometry args={[0.1, 0.17, 3.1, 10, 1, true]} />
        <meshBasicMaterial ref={beamMat} color={color} transparent opacity={critical ? 0.3 : 0.2} depthWrite={false} side={2} toneMapped={false} />
      </mesh>
      <mesh raycast={noRay} position={[0, 3.3, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function BeltEventMarkers({ objects }) {
  const alerts = useActiveAlerts()
  const markers = useMemo(() => {
    // one marker per watching asset — worst severity wins
    const byWatcher = new Map()
    for (const a of alerts) {
      const watcher = objects[a.objId]
      if (!watcher?.config?.watch) continue
      const cur = byWatcher.get(a.objId)
      if (!cur || (a.severity === 'critical' && cur.severity !== 'critical')) byWatcher.set(a.objId, a)
    }
    const out = []
    for (const [wid, a] of byWatcher) {
      const pos = beltWatchWorldPos(objects, wid)
      if (pos) out.push({ key: a.key, pos, severity: a.severity })
    }
    return out
  }, [alerts, objects])
  return <>{markers.map(m => <BeltEventMarker key={m.key} pos={m.pos} severity={m.severity} />)}</>
}

export function Connectors() {
  const objects              = useSceneStore(s => s.objects)
  const layers               = useSceneStore(s => s.layers)
  const selectedConnectionId = useSceneStore(s => s.selectedConnectionId)
  const selectConnection     = useSceneStore(s => s.selectConnection)

  const conns = useMemo(() => flattenConnections(objects), [objects])

  return (
    <>
      <BeltEventMarkers objects={objects} />
      {conns.map((c, i) => {
        const src = objects[c.sourceId]
        const tgt = objects[c.targetId]
        if (!src || !tgt) return null
        if (layers[src.layer]?.visible === false || layers[tgt.layer]?.visible === false) return null
        return (
          <Connector key={`${c.sourceId}|${c.sourcePort ?? ''}>${c.targetId}|${c.targetPort ?? ''}#${i}`} conn={c} src={src} tgt={tgt}
            selected={c.id === selectedConnectionId}
            onSelect={() => selectConnection(c.id)} />
        )
      })}
    </>
  )
}

// Prop-driven connectors for off-store renderers (e.g. the thumbnail factory,
// which renders a scene snapshot, not the live store). Non-interactive.
export function SceneConnectors({ objects = {} }) {
  const conns = useMemo(() => flattenConnections(objects), [objects])
  return (
    <>
      {conns.map((c, i) => {
        const src = objects[c.sourceId]
        const tgt = objects[c.targetId]
        if (!src || !tgt) return null
        return <Connector key={`${c.sourceId}|${c.sourcePort ?? ''}>${c.targetId}|${c.targetPort ?? ''}#${i}`} conn={c} src={src} tgt={tgt} selected={false} onSelect={() => {}} />
      })}
    </>
  )
}
