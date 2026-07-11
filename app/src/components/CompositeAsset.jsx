import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshTransmissionMaterial, Edges } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three-stdlib'
import { LatheGeometry, ExtrudeGeometry, Shape, Vector2 } from 'three'
import { finishFor, getFinishMaps } from '../lib/textures'
import { resolveColor } from '../lib/paletteTokens'
import { ALERT_SEVERITY_COLOR } from '../lib/alertsEngine'
import { pathFillMap } from '../lib/loadStateMap'
import { useSceneStore } from '../store/sceneStore'
import { useDayNight, NIGHT_DEFAULTS } from '../lib/dayNight'
import { Primitive } from './Primitive'
import { GLBModel } from './assets/GLBModel'
import { StatusBeacon } from './StatusBeacon'
import { ParticleEmitter } from './effects/ParticleEmitter'
import { MACHINE_COMPONENTS } from '../lib/machineLibrary'
import { getCustomTypes } from '../lib/customTypesRef'
import { getDefaultConfig } from '../lib/assetSchemas'

// Deterministic 0..1 hash from a part id — used for per-instance material
// variation (`material.vary`) so sibling parts don't look injection-moulded.
function hash01(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return ((h >>> 0) % 1000) / 1000
}

// Map a weathering declaration → procedural finish + roughness bias.
// material.weather = { kind: 'rust'|'dust'|'concrete'|'paint', amount: 0..1 }
const WEATHER_FINISH = { rust: 'rust', dust: 'dust', concrete: 'concrete', paint: 'paintedSteel' }

// Renders a multi-part Component Spec. Each part is either a primitive (geometry +
// PBR material + optional config-driven animation) or a reference to another
// component (built-in machine or custom type) placed in-line — so users can build
// on top of / around existing assets. Falls back to the single-shape Primitive for
// legacy custom types (no `parts`), so existing scenes render unchanged.

// Bevelled box — manufactured edges (three-stdlib RoundedBoxGeometry).
function RoundedBoxGeo({ w, h, d, bevel }) {
  const geo = useMemo(() => {
    const b = Math.max(0.005, Math.min(bevel, Math.min(w, h, d) / 2 - 0.001))
    return new RoundedBoxGeometry(w, h, d, 3, b)
  }, [w, h, d, bevel])
  return <primitive object={geo} attach="geometry" />
}

// Lathe-profile pressure vessel: cylindrical shell + dished (elliptical) heads.
function VesselGeo({ r, h }) {
  const geo = useMemo(() => {
    const head = Math.min(r * 0.55, h * 0.25)          // dished head depth
    const straight = Math.max(0.02, h - 2 * head)
    const pts = []
    for (let i = 0; i <= 8; i++) {                     // bottom head (ellipse quarter)
      const a = (i / 8) * Math.PI / 2
      pts.push(new Vector2(Math.sin(a) * r, head - Math.cos(a) * head))
    }
    pts.push(new Vector2(r, head + straight))          // shell
    for (let i = 8; i >= 0; i--) {                     // top head
      const a = (i / 8) * Math.PI / 2
      pts.push(new Vector2(Math.sin(a) * r, h - head + Math.cos(a) * head))
    }
    const g = new LatheGeometry(pts, 40)
    g.translate(0, -h / 2, 0)                          // centre on origin like other prims
    return g
  }, [r, h])
  return <primitive object={geo} attach="geometry" />
}

// Extruded structural I-section, length along Z, centred.
function IBeamGeo({ w, h, len }) {
  const geo = useMemo(() => {
    const fl = h * 0.14                                // flange thickness
    const wb = Math.max(0.02, w * 0.14)                // web thickness
    const s = new Shape()
    const hw = w / 2, hh = h / 2, hwb = wb / 2
    s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, -hh + fl); s.lineTo(hwb, -hh + fl)
    s.lineTo(hwb, hh - fl); s.lineTo(hw, hh - fl); s.lineTo(hw, hh); s.lineTo(-hw, hh)
    s.lineTo(-hw, hh - fl); s.lineTo(-hwb, hh - fl); s.lineTo(-hwb, -hh + fl); s.lineTo(-hw, -hh + fl)
    s.closePath()
    const g = new ExtrudeGeometry(s, { depth: len, bevelEnabled: false })
    g.translate(0, 0, -len / 2)
    return g
  }, [w, h, len])
  return <primitive object={geo} attach="geometry" />
}

export function PartGeometry({ part }) {
  const d = part.dims || {}
  switch (part.geometry) {
    case 'roundedBox': return <RoundedBoxGeo w={d.width ?? 1} h={d.height ?? 1} d={d.depth ?? 1} bevel={d.bevel ?? 0.06} />
    case 'cylinder': return <cylinderGeometry args={[d.radius ?? 0.6, d.radius ?? 0.6, d.height ?? 1.5, 32]} />
    case 'capsule':  return <capsuleGeometry args={[d.radius ?? 0.6, Math.max(0.02, (d.height ?? 2) - 2 * (d.radius ?? 0.6)), 8, 24]} />
    case 'vessel':   return <VesselGeo r={d.radius ?? 0.8} h={d.height ?? 2.4} />
    case 'sphere':   return <sphereGeometry args={[d.radius ?? 0.7, 32, 24]} />
    case 'cone':     return <coneGeometry args={[d.radius ?? 0.7, d.height ?? 1.4, 32]} />
    case 'torus':    return <torusGeometry args={[d.radius ?? 0.7, d.tube ?? 0.18, 16, 48]} />
    case 'ibeam':    return <IBeamGeo w={d.width ?? 0.3} h={d.height ?? 0.4} len={d.depth ?? 2} />
    default:         return <boxGeometry args={[d.width ?? 1, d.height ?? 1, d.depth ?? 1]} />
  }
}

// Resolve a 'component' part → render the referenced built-in or custom component.
function RefBlock({ refType, depth }) {
  if (!refType || depth > 4) return null
  const custom = getCustomTypes()
  const Built = MACHINE_COMPONENTS[refType]
  if (Built) return <Built status="running" config={getDefaultConfig(refType, custom)} />
  const t = custom[refType]
  if (t) return <CompositeAsset typeDef={t} config={getDefaultConfig(refType, custom)} status="running" _depth={depth + 1} />
  return null
}

const HILITE = '#0a84ff'
const AXIS_IDX = { x: 0, y: 1, z: 2 }

// Shared 0→1→0 articulation wave for sweep/slide. `config.animPhase` is a
// per-INSTANCE stagger (set on the scene object's config) so two machines of
// the same type don't move in lockstep, while parts WITHIN one machine keep
// their authored relative phases (a coordinated dig cycle).
function articulationWave(t, anim, spd, config) {
  const period = Math.max(0.5, (anim.period ?? 8) / (spd || 1))
  const ph = (anim.phase ?? 0) + (Number(config.animPhase) || 0)
  return 0.5 - 0.5 * Math.cos((t / period + ph) * Math.PI * 2)
}
const articulationValue = (t, anim, spd, config) => {
  const w = articulationWave(t, anim, spd, config)
  const from = anim.from ?? -0.3, to = anim.to ?? 0.3
  return from + (to - from) * w
}

function AnimatedPrimitive({ part, config, status, highlighted, alertSev, objId }) {
  // Night shift: emissive lamps brighten so floodlights/beacons pay off under
  // the dimmed rig (environment.sky.night.emissiveBoost; re-renders on toggle only).
  const nightOn = useDayNight(s => s.night)
  const emissiveNightBoost = nightOn && part.material?.emissive
    ? (useSceneStore.getState().environment?.sky?.night?.emissiveBoost ?? NIGHT_DEFAULTS.emissiveBoost)
    : 1
  const ref = useRef()
  const phase = useRef(Math.random())   // stable per-instance offset → staggered loops (rising smoke)
  // Generic alert indicator light: a part flagged material.alertGlow renders
  // its normal calm emissive when idle, and switches to the shared alert
  // severity colour (amber/red), brightens and PULSES while the owning object
  // has an active alert — camera "caught it" lights, stack lamps, beacons.
  const glowSev = part.material?.alertGlow ? alertSev : null
  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    if (part.material?.alertGlow) {
      const k = glowSev ? 1.45 + 0.35 * Math.sin(clock.elapsedTime * 5) : 1
      g.scale.setScalar(k)
    }
    // load-state part (truck bed heap …): follow the vehicle's fill 0..1,
    // scaling toward its own base so the heap grows/vanishes in place
    if (part.material?.loadState) {
      const f = objId != null ? pathFillMap[objId] : undefined
      if (f !== undefined) {
        g.visible = f > 0.04
        const sy = 0.12 + 0.88 * f
        g.scale.y = sy
        g.position.y = ((part.dims?.height ?? 1) * (sy - 1)) / 2
      }
    }
    if (!part.animate) return
    const live = config.enabled !== false && status === 'running'
    // per-part `rate` scales the shared config speed — lets a starwheel counter-
    // rotate faster than its carousel so surface speeds MATCH the conveyors.
    const spd = ((part.animate.speedKey ? Number(config[part.animate.speedKey]) : 1) || 1) * (part.animate.rate ?? 1)
    const t = clock.elapsedTime
    switch (part.animate.kind) {
      case 'spinY': if (live) g.rotation.y += 0.016 * spd; break
      case 'spinX': if (live) g.rotation.x += 0.016 * spd; break
      case 'pulse': { const k = live ? 1 + 0.06 * Math.sin(t * 2 * spd) : 1; g.scale.set(k, k, k); break }
      case 'bob':   { g.position.y = live ? 0.12 * Math.sin(t * 2 * spd) : 0; break }
      case 'rise': {
        // continuously rises and recycles, expanding as it goes — smoke / vapour plume
        if (!live) { g.position.y = 0; g.scale.setScalar(1); break }
        const p = (t * spd * 0.18 + phase.current) % 1                 // 0..1 loop
        g.position.y = p * ((part.dims?.radius ?? 1.5) * 4)            // rise height ∝ puff size
        g.scale.setScalar(0.4 + p * 1.1)                              // grow as it rises
        break
      }
      // articulated oscillations — rotate about / translate along one axis,
      // between `from`..`to`, over `period` s, offset by `phase` (0..1 cycles)
      case 'sweep': {
        const ax = part.animate.axis ?? 'y'
        g.rotation[ax] = live ? articulationValue(t, part.animate, spd, config) : 0
        break
      }
      case 'slide': {
        const ax = part.animate.axis ?? 'y'
        g.position[ax] = live ? articulationValue(t, part.animate, spd, config) : 0
        break
      }
      // slow breathe between from..to (stockpiles growing on stack, drawing
      // down on reclaim) — sine cycle, base-anchored, period in seconds
      case 'level': {
        const period = Math.max(1, (part.animate.period ?? 300) / (spd || 1))
        const ph = (part.animate.phase ?? 0) + (Number(config.animPhase) || 0)
        const w = 0.5 - 0.5 * Math.cos((((t / period + ph) % 1 + 1) % 1) * Math.PI * 2)
        const lo = part.animate.from ?? 0.6, hi = part.animate.to ?? 1
        const sy = live ? lo + (hi - lo) * w : hi
        g.scale.y = sy
        g.position.y = ((part.dims?.height ?? 1) * (sy - 1)) / 2
        break
      }
      // track a LIVE parameter as a level (bin sight-gauges): scale.y follows
      // (param - min) / (max - min), smoothed, base-anchored
      case 'paramLevel': {
        const key = part.animate.param
        if (!key || objId == null) break
        const o = useSceneStore.getState().objects[objId]
        const v = Number(o?.parameters?.[key])
        if (!Number.isFinite(v)) break
        const min = part.animate.min ?? 0, max = part.animate.max ?? 100
        const f = Math.max(0, Math.min(1, (v - min) / ((max - min) || 1)))
        const lo = part.animate.from ?? 0.05, hi = part.animate.to ?? 1
        const target = lo + (hi - lo) * f
        const sy = g.scale.y + (target - g.scale.y) * Math.min(1, dt * 2)
        g.scale.y = sy
        g.position.y = ((part.dims?.height ?? 1) * (sy - 1)) / 2
        break
      }
      // container fill cycle: level rises (78% of the period), holds full,
      // then resets — wagons under a load-out, ship holds under a shiploader.
      // Uses from/to as min/max Y-scale; base of the part stays fixed.
      case 'fill': {
        const period = Math.max(1, (part.animate.period ?? 40) / (spd || 1))
        const ph = (part.animate.phase ?? 0) + (Number(config.animPhase) || 0)
        const pr = ((t / period + ph) % 1 + 1) % 1
        const v = live ? Math.min(1, pr / 0.78) : 1
        const lo = part.animate.from ?? 0.06, hi = part.animate.to ?? 1
        const sy = lo + (hi - lo) * v
        g.scale.y = sy
        g.position.y = ((part.dims?.height ?? 1) * (sy - 1)) / 2
        break
      }
      default: break
    }
  })
  const m = part.material || {}
  // Weathering (rust/dust/concrete/paint film) picks the procedural finish;
  // `granular` is shorthand for the bulk-solids finish (coal/ore/aggregate).
  const weather = m.weather && WEATHER_FINISH[m.weather.kind] ? m.weather : null
  const finish = m.granular ? 'granular' : (weather ? WEATHER_FINISH[weather.kind] : finishFor(m))
  const tx = useMemo(() => getFinishMaps(finish), [finish])
  // Per-part deterministic roughness/metalness variation (material.vary = 0..1).
  const v = m.vary ? (hash01(part.id) - 0.5) * m.vary : 0
  const rough = Math.min(1, Math.max(0, (m.roughness ?? 0.35) + v * 0.3 + (weather ? weather.amount * 0.25 : 0)))
  const metal = Math.min(1, Math.max(0, (m.metalness ?? 0.6) + v * -0.2 - (weather ? weather.amount * 0.15 : 0)))
  // Animated water surface: scroll the normal/detail maps for a live shimmer.
  const waterMat = useRef()
  useFrame((_, dt) => {
    const wm = waterMat.current
    if (!wm || !m.water) return
    const s = (m.waterSpeed ?? 1) * dt * 0.02
    if (wm.normalMap) { wm.normalMap.offset.x += s; wm.normalMap.offset.y += s * 0.6 }
    if (wm.roughnessMap) wm.roughnessMap.offset.x -= s * 0.7
  })
  const waterTx = useMemo(() => (m.water ? getFinishMaps('rubber') : null), [m.water])  // fine pebbling reads as wavelets
  return (
    <mesh ref={ref} castShadow receiveShadow>
      <PartGeometry part={part} />
      {m.transmission ? (
        // Real refractive glass / liquid (opt-in — costly, use sparingly on hero parts).
        <MeshTransmissionMaterial color={resolveColor(m.color, '#ffffff')} roughness={m.roughness ?? 0.08}
          transmission={1} thickness={m.thickness ?? 0.6} ior={m.ior ?? 1.45}
          chromaticAberration={0.02} anisotropy={0.1} distortion={0.1} distortionScale={0.2} />
      ) : m.water ? (
        // Live water: low roughness + scrolling micro-normals (shimmer/ripples).
        <meshStandardMaterial ref={waterMat}
          color={resolveColor(m.color, '#2f6fb0')} metalness={m.metalness ?? 0.1} roughness={m.roughness ?? 0.22}
          envMapIntensity={m.envMapIntensity ?? 0.9}
          transparent={!!m.transparent} opacity={m.opacity ?? 1} depthWrite={m.transparent ? false : true} side={m.transparent ? 2 : 0}
          normalMap={waterTx?.normalMap ?? null} normalScale={[m.waterRipple ?? 0.35, m.waterRipple ?? 0.35]}
          roughnessMap={waterTx?.roughnessMap ?? null} />
      ) : (
        <meshStandardMaterial
          color={glowSev ? ALERT_SEVERITY_COLOR[glowSev] : resolveColor(m.color, '#b0c4d0')} metalness={metal} roughness={rough}
          envMapIntensity={m.envMapIntensity ?? 1.25}
          transparent={!!m.transparent} opacity={m.opacity ?? 1} depthWrite={m.transparent ? false : true} side={m.transparent ? 2 : 0}
          map={tx?.map ?? null} roughnessMap={tx?.roughnessMap ?? null}
          normalMap={tx?.normalMap ?? null} normalScale={tx?.normalScale ? [tx.normalScale, tx.normalScale] : undefined}
          emissive={highlighted ? HILITE : (glowSev ? ALERT_SEVERITY_COLOR[glowSev] : resolveColor(m.emissive, '#000000'))}
          emissiveIntensity={highlighted ? 0.7 : (glowSev ? 3 : (m.emissive ? (m.emissiveIntensity ?? 1) * emissiveNightBoost : 0))}
          toneMapped={glowSev ? false : (m.toneMapped === false ? false : true)}
          polygonOffset={!!m.polygonOffset} polygonOffsetFactor={m.polygonOffsetFactor ?? 0} polygonOffsetUnits={m.polygonOffsetUnits ?? 0} />
      )}
      {/* opt-in crisp edge outlines (CAD-style compartment lines) */}
      {m.edges && <Edges threshold={m.edgeThreshold ?? 15} color={m.edgeColor ?? '#2b3440'} />}
    </mesh>
  )
}

// An imported glTF/GLB sub-mesh as a part — lets a procedural component carry a
// photoreal/detailed body (authored in Blender or generated text-to-3D) while its
// other parts stay parametric + animated + connectable. The part's own group
// applies position/rotation/scale (and animation); GLBModel handles fit/scale.
function ModelVisual({ part }) {
  return <GLBModel config={{ url: part.url || '', fit: part.fit ?? 2, scale: 1, yaw: 0 }} />
}

// The visual of a single part WITHOUT its outer transform (the caller applies
// position/rotation/scale on a wrapping group — so the Studio can attach a gizmo).
export function PartVisual({ part, config = {}, status = 'running', depth = 0, highlighted = false, alertSev = null, objId = null }) {
  if (part.kind === 'component') return <RefBlock refType={part.ref} depth={depth} />
  if (part.kind === 'model') return <ModelVisual part={part} />
  if (part.kind === 'emitter') return <ParticleEmitter {...(part.emitter || {})} active={config.enabled !== false && status === 'running'} />
  return <AnimatedPrimitive part={part} config={config} status={status} highlighted={highlighted} alertSev={alertSev} objId={objId} />
}

function autoBeaconY(parts) {
  let top = 0
  for (const p of parts) {
    const y = p.position?.[1] ?? 0
    const d = p.dims || {}
    const h = d.height ?? (d.radius ? d.radius * 2 : 1)
    top = Math.max(top, y + h / 2)
  }
  return top + 0.5
}

// Render parts as a TREE (by parentId). Every part has its own transform group;
// children render INSIDE it so they inherit the parent's transform (scene-graph).
//   group   → transform container, no visual of its own
//   logical → non-visual data node, no transform (passthrough wrapper)
//   else    → primitive / component visual
// A transform GROUP that animates (spinY etc.) — children orbit/move with it.
// Used for e.g. a labeller carousel carrying mock bottles around its axis.
function AnimatedGroup({ part, config, status, children }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g || !part.animate) return
    const live = config.enabled !== false && status === 'running'
    const spd = ((part.animate.speedKey ? Number(config[part.animate.speedKey]) : 1) || 1) * (part.animate.rate ?? 1)
    const t = clock.elapsedTime
    switch (part.animate.kind) {
      case 'spinY': if (live) g.rotation.y += 0.016 * spd; break
      case 'spinX': if (live) g.rotation.x += 0.016 * spd; break
      case 'pulse': { const k = live ? 1 + 0.06 * Math.sin(t * 2 * spd) : 1; g.scale.set(k, k, k); break }
      case 'bob':   { g.position.y = (part.position?.[1] ?? 0) + (live ? 0.12 * Math.sin(t * 2 * spd) : 0); break }
      // Pivot-group articulation: the GROUP is the hinge — children (boom,
      // stick, bucket, drill carriage …) swing/slide with it. Base transform
      // comes from the authored part transform; the wave adds on top.
      case 'sweep': {
        const ax = part.animate.axis ?? 'y'
        const base = part.rotation?.[AXIS_IDX[ax] ?? 1] ?? 0
        g.rotation[ax] = base + (live ? articulationValue(t, part.animate, spd, config) : 0)
        break
      }
      case 'slide': {
        const ax = part.animate.axis ?? 'y'
        const base = part.position?.[AXIS_IDX[ax] ?? 1] ?? 0
        g.position[ax] = base + (live ? articulationValue(t, part.animate, spd, config) : 0)
        break
      }
      default: break
    }
  })
  return (
    <group ref={ref} position={part.position || [0, 0, 0]} rotation={part.rotation || [0, 0, 0]} scale={part.scale || [1, 1, 1]}>
      {children}
    </group>
  )
}

function renderPartTree(parts, idSet, parentId, config, status, depth, highlightId, alertSev, objId) {
  return parts
    .filter(p => { const pid = p.parentId || null; return parentId === null ? (pid === null || !idSet.has(pid)) : pid === parentId })
    .map(part => {
      const children = renderPartTree(parts, idSet, part.id, config, status, depth, highlightId, alertSev, objId)
      if (part.kind === 'logical') return <group key={part.id}>{children}</group>
      if ((part.kind === 'group' || part.kind === 'model') && part.animate) {
        return (
          <AnimatedGroup key={part.id} part={part} config={config} status={status}>
            {part.kind === 'model' ? <ModelVisual part={part} /> : null}
            {children}
          </AnimatedGroup>
        )
      }
      const visual = part.kind === 'group' ? null : <PartVisual part={part} config={config} status={status} depth={depth} highlighted={!!highlightId && part.id === highlightId} alertSev={alertSev} objId={objId} />
      return (
        <group key={part.id} position={part.position || [0, 0, 0]} rotation={part.rotation || [0, 0, 0]} scale={part.scale || [1, 1, 1]}>
          {visual}
          {children}
        </group>
      )
    })
}

export function CompositeAsset({ config = {}, status = 'running', typeDef, _depth = 0, highlightId = null, alertSev = null, objId = null }) {
  if (!typeDef?.parts?.length) return <Primitive config={config} typeDef={typeDef} />
  const beaconPos = typeDef.beacon === null ? null : (typeDef.beacon?.offset ?? [0, autoBeaconY(typeDef.parts), 0])
  const idSet = new Set(typeDef.parts.map(p => p.id))
  return (
    <group>
      {renderPartTree(typeDef.parts, idSet, null, config, status, _depth, highlightId, alertSev, objId)}
      {beaconPos && <StatusBeacon status={status} position={beaconPos} />}
    </group>
  )
}
