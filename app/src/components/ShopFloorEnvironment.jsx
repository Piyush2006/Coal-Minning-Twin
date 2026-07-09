// Site ground backdrop. Two config-driven styles (scene `environment.ground`):
//   (default)                → clean concrete slab with painted aisle lanes
//   { style: 'earth', … }    → noise-displaced natural terrain (open-cast sites,
//                              yards, quarries): gentle heightmap undulation, no
//                              lanes, matte earth material.
//   options: color, noiseAmp (m), noiseScale (m per undulation), margin
// The slab AUTO-SIZES to the twin: it always covers every placed object with a
// generous margin, quantised to 20 m steps so the geometry isn't reallocated on
// every drag/sim tick — big generated plants never hang off the edge.
import { useMemo } from 'react'
import * as THREE from 'three'
import { useSceneStore } from '../store/sceneStore'
import { resolveColor } from '../lib/paletteTokens'
import { getFinishMaps } from '../lib/textures'

const BASE_LEN = 130   // minimum slab along X
const BASE_W   = 46    // minimum slab along Z
const MARGIN   = 18    // clearance beyond the outermost object
const STEP     = 20    // resize quantum

// deterministic value noise (stable across renders)
const hashNoise = (x, z) => {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

export function ShopFloorEnvironment() {
  const objects = useSceneStore(s => s.objects)
  const ground = useSceneStore(s => s.environment)?.ground ?? {}
  const isEarth = ground.style === 'earth'

  const { len, wid, cx, cz } = useMemo(() => {
    let minX = -BASE_LEN / 2, maxX = BASE_LEN / 2, minZ = -BASE_W / 2, maxZ = BASE_W / 2
    const margin = ground.margin ?? MARGIN
    for (const o of Object.values(objects || {})) {
      const [x, , z] = o.position || [0, 0, 0]
      if (Number.isFinite(x)) { minX = Math.min(minX, x - margin); maxX = Math.max(maxX, x + margin) }
      if (Number.isFinite(z)) { minZ = Math.min(minZ, z - margin); maxZ = Math.max(maxZ, z + margin) }
    }
    const q = (v) => Math.ceil(v / STEP) * STEP
    return { len: q(maxX - minX), wid: q(maxZ - minZ), cx: Math.round((minX + maxX) / 2), cz: Math.round((minZ + maxZ) / 2) }
  }, [objects, ground.margin])

  // Earth mode: displaced heightmap plane — dips DOWN only (undulation must not
  // poke through floor-standing assets, which sit at y = 0).
  const earthGeo = useMemo(() => {
    if (!isEarth) return null
    const amp = ground.noiseAmp ?? 0.35
    const scale = ground.noiseScale ?? 55
    const segX = Math.min(180, Math.round(len / 4)), segZ = Math.min(140, Math.round(wid / 4))
    const g = new THREE.PlaneGeometry(len, wid, segX, segZ)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      const n = hashNoise(x / scale, z / scale) * 0.7 + hashNoise(x / (scale * 0.31), z / (scale * 0.31)) * 0.3
      p.setY(i, -Math.abs(n) * amp - 0.02)
    }
    g.computeVertexNormals()
    return g
  }, [isEarth, len, wid, ground.noiseAmp, ground.noiseScale])

  const maps = isEarth ? getFinishMaps('concrete') : null

  if (isEarth) {
    return (
      <group position={[cx, 0, cz]}>
        <mesh geometry={earthGeo} receiveShadow>
          <meshStandardMaterial color={resolveColor(ground.color, '#a99c86')} metalness={0.02} roughness={0.97}
            roughnessMap={maps?.roughnessMap ?? null} normalMap={maps?.normalMap ?? null}
            normalScale={maps?.normalScale ? [maps.normalScale, maps.normalScale] : undefined} />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[cx, 0, cz]}>
      {/* concrete floor — does NOT receive the directional shadow map (that
          painted blocky/aliased dark patches across the slab as machines moved);
          ground shadowing comes from the clean dynamic ContactShadows instead. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[len, wid]} />
        <meshStandardMaterial color={resolveColor(ground.color, '#f2f2f3')} metalness={0} roughness={0.95} />
      </mesh>
      {/* painted aisle lanes flanking the central aisle */}
      {[-3.4, 3.4].map((z, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z - cz]}>
          <planeGeometry args={[len - 36, 0.18]} />
          <meshStandardMaterial color="#e8b53a" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}
