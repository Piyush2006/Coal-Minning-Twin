// TerrainMound — a noise-displaced raised mound (waste/overburden dump, ore
// heap, soil stockpile …). Config-driven and generic:
//   config = { radius, height, lobes, irregular, color, pad }
// Each lobe is a displaced hemisphere; deterministic noise keeps geometry
// stable across renders. Cheap: one geometry per lobe, built once per config.
import { useMemo } from 'react'
import * as THREE from 'three'
import { resolveColor } from '../../lib/paletteTokens'
import { getFinishMaps } from '../../lib/textures'
import { ParticleEmitter } from '../effects/ParticleEmitter'

const hashNoise = (x, y, z) => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

// deterministic lobe placement around the origin
const LOBE_SEEDS = [
  { dx: 0, dz: 0, s: 1.0 },
  { dx: 0.75, dz: 0.45, s: 0.68 },
  { dx: -0.7, dz: -0.35, s: 0.55 },
  { dx: 0.2, dz: -0.8, s: 0.45 },
  { dx: -0.5, dz: 0.7, s: 0.4 },
]

// Exported for reuse: PitTerrain builds its loose muck piles from the same
// displaced-hemisphere geometry (broken rock/coal look, not smooth cones).
export function moundGeo(radius, height, irregular, seed) {
  const g = new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
  g.scale(1, height / radius, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const k = 1 + hashNoise(x * 0.35 + seed, y * 0.35, z * 0.35 - seed) * irregular * 0.5
      + hashNoise(x * 1.1 - seed, y * 1.1, z * 1.1 + seed) * irregular * 0.18
    p.setX(i, x * k); p.setZ(i, z * k)
    if (y > 0.01) p.setY(i, y * (1 + hashNoise(x * 0.5, 7.3 + seed, z * 0.5) * irregular * 0.35))
  }
  g.computeVertexNormals()
  return g
}

export function TerrainMound({ config = {} }) {
  const radius    = Number(config.radius) || 9
  const height    = Number(config.height) || 5.5
  const lobes     = Math.max(1, Math.min(LOBE_SEEDS.length, Math.round(Number(config.lobes) || 3)))
  const irregular = Number(config.irregular ?? 0.35)
  const color     = resolveColor(config.color, '#8a7a64')

  const geos = useMemo(
    () => LOBE_SEEDS.slice(0, lobes).map((l, i) => ({
      geo: moundGeo(radius * l.s, height * l.s, irregular, i * 3.7),
      pos: [l.dx * radius, 0, l.dz * radius],
    })),
    [radius, height, lobes, irregular],
  )
  const maps = getFinishMaps('concrete')

  return (
    <group>
      {config.pad !== false && (
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[radius * 1.45, radius * 1.45, 0.08, 36]} />
          <meshStandardMaterial color={resolveColor(config.padColor, '#7a6c58')} metalness={0.02} roughness={0.96} />
        </mesh>
      )}
      {geos.map((l, i) => (
        <mesh key={i} geometry={l.geo} position={l.pos} castShadow receiveShadow>
          <meshStandardMaterial color={color} metalness={0.02} roughness={0.95}
            roughnessMap={maps?.roughnessMap ?? null} normalMap={maps?.normalMap ?? null}
            normalScale={maps?.normalScale ? [maps.normalScale, maps.normalScale] : undefined} />
        </mesh>
      ))}
      {/* active tip-head dust (config.dust) — shared particle module */}
      {config.dust && (
        <group position={[0, height * 0.85, 0]}>
          <ParticleEmitter preset="dust" scale={radius / 7} />
        </group>
      )}
    </group>
  )
}
