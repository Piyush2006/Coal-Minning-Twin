// MaterialFlow — visible bulk material moving through the process. Generic +
// config-driven; a stage opts in via data:
//   • conveyor CONNECTION:  connectorConfig.material = 'coal'  → a stream of
//     instanced chunks rides the same bezier the belt renders with
//   • ConveyorBelt ASSET:   config.material = 'coal'           → chunks ride
//     the straight run between its ports
//   • any object:           config.chunkDrops = [{ at:[x,y,z] (local), drop,
//     spread?, count?, size? }]  → a falling chunk stream at transfer /
//     discharge points (crusher feed & discharge, load-out chute, stacker boom…)
//
// Cheap by construction: ONE InstancedMesh per stream/drop (single draw call),
// all instances updated in one useFrame with module-level temp objects — no
// per-frame allocations. Chunk look = low-poly dodecahedra with the shared
// granular coal finish, per-instance size/rotation/lane variation.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { getFinishMaps } from '../../lib/textures'
import { buildConnectorCurve } from '../Connectors'
import { worldPortPos } from '../../lib/snapEngine'

const SNAP_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('snap')

const CHUNK_GEO = new THREE.DodecahedronGeometry(1, 0)
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _obj = new THREE.Object3D()
const h01 = (i, s) => { const n = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return n - Math.floor(n) }

// one shared coal-lump material for every stream (granular finish reused)
let _mat = null
function chunkMat() {
  if (_mat) return _mat
  const maps = getFinishMaps('granular')
  _mat = new THREE.MeshStandardMaterial({
    color: '#26292e', metalness: 0.05, roughness: 0.88,
    map: maps?.map ?? null, roughnessMap: maps?.roughnessMap ?? null,
    normalMap: maps?.normalMap ?? null,
  })
  if (maps?.normalScale) _mat.normalScale = new THREE.Vector2(maps.normalScale, maps.normalScale)
  return _mat
}

// ── Chunks riding a belt curve ──────────────────────────────────────────────
export function ChunkStream({ curve, speed = 1.2, count = 24, surfaceY = 1.0, width = 0.3, size = 0.16, beltHalf = 0.24, running = true }) {
  const ref = useRef()
  const len = useMemo(() => curve.getLength(), [curve])
  const seeds = useMemo(() => {
    // realism rules: lump diameter ≤ ~1/3 of the belt width; every lump fully
    // inside the belt edges; even spacing with small jitter (no end blobs)
    const maxR = beltHalf * 0.66                          // radius cap → diameter ≤ belt/3 · 2
    const laneMax = Math.max(0.01, Math.min(width, beltHalf - maxR - 0.02))
    return Array.from({ length: count }, (_, i) => ({
      phase: (i + 0.5 + (h01(i, 7) - 0.5) * 0.6) / count, // even slots, ±0.3-slot jitter
      lane: (h01(i, 2) - 0.5) * 2 * laneMax,              // clamped inside the belt edges
      s: Math.min(size * (0.6 + h01(i, 3) * 0.9), maxR),
      rx: h01(i, 4) * Math.PI, ry: h01(i, 5) * Math.PI * 2,
      dy: h01(i, 6) * 0.04,
    }))
  }, [count, width, size, beltHalf])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    m.visible = running !== false
    if (!m.visible || !len) return
    const head = (clock.elapsedTime * speed) / len
    for (let i = 0; i < count; i++) {
      const sd = seeds[i]
      const u = (head + sd.phase) % 1
      curve.getPointAt(u, _p)
      curve.getTangentAt(u, _t)
      _s.crossVectors(_t, _up)
      if (_s.lengthSq() < 1e-6) _s.set(1, 0, 0)
      _s.normalize()
      _obj.position.set(_p.x + _s.x * sd.lane, _p.y + surfaceY + sd.dy, _p.z + _s.z * sd.lane)
      _obj.rotation.set(sd.rx, sd.ry, 0)
      _obj.scale.setScalar(sd.s)
      _obj.updateMatrix()
      m.setMatrixAt(i, _obj.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  if (SNAP_MODE) return null
  return <instancedMesh ref={ref} args={[CHUNK_GEO, chunkMat(), count]} castShadow frustumCulled={false} />
}

// ── Chunks falling at a transfer / discharge point ──────────────────────────
export function ChunkFall({ position = [0, 0, 0], drop = 3, spread = 0.4, count = 14, size = 0.15, duration = 0.85, running = true }) {
  const ref = useRef()
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    phase: h01(i, 11),
    dx: (h01(i, 12) - 0.5) * 2, dz: (h01(i, 13) - 0.5) * 2,
    s: size * (0.55 + h01(i, 14) * 0.9),
    spin: h01(i, 15) * Math.PI * 2,
  })), [count, size])

  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    m.visible = running !== false
    if (!m.visible) return
    const t = clock.elapsedTime / duration
    for (let i = 0; i < count; i++) {
      const sd = seeds[i]
      const u = (t + sd.phase) % 1
      const shrink = u > 0.92 ? Math.max(0.01, 1 - (u - 0.92) / 0.08) : 1   // bury AT the landing surface, not mid-air
      _obj.position.set(
        position[0] + sd.dx * spread * (0.4 + u * 0.6),
        position[1] - drop * u * u,                                          // accelerating fall
        position[2] + sd.dz * spread * (0.4 + u * 0.6),
      )
      _obj.rotation.set(sd.spin + u * 5, sd.spin * 1.7, 0)                   // tumble
      _obj.scale.setScalar(sd.s * shrink)
      _obj.updateMatrix()
      m.setMatrixAt(i, _obj.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  if (SNAP_MODE) return null
  return <instancedMesh ref={ref} args={[CHUNK_GEO, chunkMat(), count]} castShadow frustumCulled={false} />
}

// ── Scene layer: collects every opted-in stream & drop from the store ───────
export function MaterialFlowLayer() {
  const objects = useSceneStore(s => s.objects)

  const streams = useMemo(() => {
    const out = []
    for (const id in objects) {
      const src = objects[id]
      // conveyor connections carrying material
      for (const c of src.connections ?? []) {
        if (c.connectorType !== 'conveyor' || !c.connectorConfig?.material) continue
        const tgt = objects[c.targetId]
        if (!tgt) continue
        const built = buildConnectorCurve(src, tgt, c)
        if (!built) continue
        const cc = c.connectorConfig
        const len = built.bezier.getLength()
        const roller = cc.beltStyle === 'roller'
        out.push({
          key: c.id ?? `${id}->${c.targetId}`, curve: built.bezier,
          speed: cc.speed ?? 1.2,
          count: cc.chunkCount ?? Math.min(60, Math.max(3, Math.round(len * 1.2))),
          surfaceY: (roller ? 1.05 : 0.92) + 0.06,
          beltHalf: roller ? 0.3 : 0.24,                 // chain deck ribbon is 0.48 wide
          running: src.status === 'running',
        })
      }
      // ConveyorBelt assets carrying material (straight run between ports)
      if (src.type === 'ConveyorBelt' && src.config?.material) {
        const L = src.config.length ?? 8
        const A = worldPortPos(src, [-L / 2, 0, 0])
        const B = worldPortPos(src, [L / 2, 0, 0])
        out.push({
          key: `${id}:belt`, curve: new THREE.LineCurve3(A, B),
          speed: src.config.speed ?? 1.2,
          count: Math.min(40, Math.max(4, Math.round(L * 1.4))),
          surfaceY: 1.0,
          beltHalf: src.config.beltStyle === 'roller' ? 0.3 : 0.24,
          running: src.status === 'running' && src.config.running !== false,
        })
      }
    }
    return out
  }, [objects])

  const drops = useMemo(() => {
    const out = []
    const e = new THREE.Euler()
    for (const id in objects) {
      const o = objects[id]
      if (!Array.isArray(o.config?.chunkDrops)) continue
      o.config.chunkDrops.forEach((d, i) => {
        e.set(o.rotation?.[0] ?? 0, o.rotation?.[1] ?? 0, o.rotation?.[2] ?? 0)
        const v = new THREE.Vector3(...(d.at ?? [0, 0, 0])).applyEuler(e)
        out.push({
          key: `${id}:drop${i}`,
          position: [v.x + o.position[0], v.y + o.position[1], v.z + o.position[2]],
          drop: d.drop ?? 3, spread: d.spread ?? 0.4, count: d.count ?? 14, size: d.size ?? 0.15,
          running: o.status === 'running' && o.config?.enabled !== false,
        })
      })
    }
    return out
  }, [objects])

  return (
    <>
      {streams.map(s => <ChunkStream {...s} key={s.key} />)}
      {drops.map(d => <ChunkFall {...d} key={d.key} />)}
    </>
  )
}
