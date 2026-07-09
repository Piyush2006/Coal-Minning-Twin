// PitTerrain — parametric open-pit highwall: REAL stepped-bench geometry with
// sloped faces, side caps, a haul ramp, an exposed seam band and muck piles.
// Fully config-driven (depth, bench count/height, face angle, ramp …) so ANY
// mining/quarry twin can use it; nothing here is coal-specific.
//
//   config = { depth, benches, benchDepth, faceAngle, floorWidth, floorDepth,
//              ramp, rampWidth, muck, seam, earthColor, floorColor, seamColor }
//
// Realism notes (all deterministic, built ONCE per config — no per-frame cost):
//   • faces/treads are subdivided and noise-jittered → rugged blasted rock,
//     while tread SURFACES stay planar (machines parked on benches don't clip)
//     and side columns stay pinned (no cracks against the side caps)
//   • per-vertex colour bakes strata: rockier grey face bands vs dustier
//     treads, ± noise brightness → the layering reads at a glance
//   • the seam band uses the shared GRANULAR finish (glinting broken coal)
//   • muck piles are noise-displaced mounds (TerrainMound geometry), not cones
// Local origin = centre of the pit floor; benches rise along +Z (rotate the
// object to orient the wall).
import { useMemo } from 'react'
import * as THREE from 'three'
import { resolveColor } from '../../lib/paletteTokens'
import { getFinishMaps } from '../../lib/textures'
import { moundGeo } from './TerrainMound'

// deterministic hash noise (stable geometry across re-renders)
const hashNoise = (x, z) => {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

export function PitTerrain({ config = {} }) {
  const depth      = Number(config.depth) || 12.6
  const benches    = Math.max(1, Math.round(Number(config.benches) || 3))
  const benchDepth = Number(config.benchDepth) || 10
  const faceAngle  = THREE.MathUtils.degToRad(Number(config.faceAngle) || 62)
  const W          = Number(config.floorWidth) || 76
  const D          = Number(config.floorDepth) || 50
  const rampOn     = config.ramp !== false
  const rampW      = Number(config.rampWidth) || 8
  const earth      = new THREE.Color(resolveColor(config.earthColor, '#8a7a64'))
  const floorCol   = resolveColor(config.floorColor, '#6e6257')
  const seamCol    = resolveColor(config.seamColor, '#23262b')

  const H = depth / benches                      // bench height
  const run = H / Math.tan(faceAngle)            // horizontal run of a sloped face
  const zStart = D / 2 - 10                      // where the first face leaves the floor
  const crestPad = 4

  const { benchGeo, seamGeo, floorGeo, profileEnd } = useMemo(() => {
    const hw = W / 2
    const SEG = 26                                             // subdivision across the wall
    const rock = new THREE.Color('#7d7466')                    // exposed rock tint (faces)
    const dustTone = new THREE.Color('#9a8d76')                // loose dusty tint (treads)

    // ── stepped profile as segments: [{z0,y0,z1,y1,isFace}] face, tread … ──
    const segs = []
    let z = zStart, y = 0
    for (let b = 0; b < benches; b++) {
      segs.push({ z0: z, y0: y, z1: z + run, y1: y + H, face: true }); z += run; y += H
      const t = b === benches - 1 ? crestPad : benchDepth
      segs.push({ z0: z, y0: y, z1: z + t, y1: y, face: false }); z += t
    }
    const zEnd = z

    // Jitter that is zero on the side columns (no cracks against the caps),
    // zero at y=0 (floor toe) and zero on tread PLANES (y stays exact there).
    const xzJit = (x, yy, zz, amp) => {
      const edge = 1 - Math.pow(Math.abs(x) / hw, 8)           // pin x = ±hw
      const n1 = hashNoise(x * 0.21 + yy * 0.7, zz * 0.23)
      const n2 = hashNoise(x * 0.6, zz * 0.55 + yy)
      return (n1 * 0.75 + n2 * 0.25) * amp * edge
    }

    const pos = [], col = []
    const pushV = (x, yy, zz, c) => { pos.push(x, yy, zz); col.push(c.r, c.g, c.b) }
    const vColor = (x, yy, zz, face) => {
      // strata: faces read as rock, treads as compacted dust; ±10% noise; a
      // slightly darker toe band low on each face
      const base = face ? earth.clone().lerp(rock, 0.55) : earth.clone().lerp(dustTone, 0.5)
      const local = (yy % H) / H
      if (face && local < 0.3) base.lerp(new THREE.Color('#4c463d'), 0.35 * (1 - local / 0.3))
      const n = hashNoise(x * 0.35, zz * 0.35 + yy * 0.9) * 0.1
      base.offsetHSL(0, 0, n)
      return base
    }

    for (const s of segs) {
      const rows = s.face ? 3 : 2                              // faces get a jittered mid row
      for (let r = 0; r < rows - 1; r++) {
        const f0 = r / (rows - 1), f1 = (r + 1) / (rows - 1)
        for (let i = 0; i < SEG; i++) {
          const g0 = i / SEG, g1 = (i + 1) / SEG
          const corner = (fx, fz) => {
            const x = -hw + fx * W
            let yy = s.y0 + (s.y1 - s.y0) * fz
            let zz = s.z0 + (s.z1 - s.z0) * fz
            const midRow = s.face && fz > 0.01 && fz < 0.99
            const amp = midRow ? 0.5 : (yy > 0.01 ? 0.16 : 0)
            zz += xzJit(x, yy, zz, amp)
            if (midRow) yy += xzJit(zz, x, yy, 0.22)
            return [x, yy, zz]
          }
          const a = corner(g0, f0), b = corner(g1, f0), c = corner(g1, f1), d = corner(g0, f1)
          const cA = vColor(a[0], a[1], a[2], s.face), cB = vColor(b[0], b[1], b[2], s.face)
          const cC = vColor(c[0], c[1], c[2], s.face), cD = vColor(d[0], d[1], d[2], s.face)
          pushV(...a, cA); pushV(...b, cB); pushV(...c, cC)
          pushV(...a, cA); pushV(...c, cC); pushV(...d, cD)
        }
      }
    }
    // back wall
    const bw = vColor(0, depth / 2, zEnd, true)
    pushV(-hw, depth, zEnd, bw); pushV(hw, depth, zEnd, bw); pushV(hw, 0, zEnd, bw)
    pushV(-hw, depth, zEnd, bw); pushV(hw, 0, zEnd, bw); pushV(-hw, 0, zEnd, bw)
    // side caps — triangle fan from the bottom-back corner (star-shaped profile)
    const profPts = [[zStart, 0]]
    for (const s of segs) profPts.push([s.z1, s.y1])
    profPts.push([zEnd, depth])
    for (const sx of [-hw, hw]) {
      const capC = vColor(sx, depth * 0.4, (zStart + zEnd) / 2, true)
      for (let i = 0; i < profPts.length - 1; i++) {
        const [za, ya] = profPts[i], [zb, yb] = profPts[i + 1]
        if (sx > 0) { pushV(sx, 0, zEnd, capC); pushV(sx, ya, za, capC); pushV(sx, yb, zb, capC) }
        else { pushV(sx, 0, zEnd, capC); pushV(sx, yb, zb, capC); pushV(sx, ya, za, capC) }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()

    // ── seam band: subdivided strip low on the FIRST face, pushed out, with
    //    matching jitter so it hugs the rugged wall (granular material) ──
    const sPos = [], sUv = []
    const nz = -Math.sin(faceAngle), ny = Math.cos(faceAngle)   // face normal (toward -z, up)
    const off = 0.12
    const s0 = 0.08, s1 = 0.58                                  // fraction of face height covered
    for (let i = 0; i < SEG; i++) {
      const g0 = i / SEG, g1 = (i + 1) / SEG
      const P = (gx, fz) => {
        const x = -hw + 1 + gx * (W - 2)
        const yy = H * (s0 + (s1 - s0) * fz)
        let zz = zStart + run * (s0 + (s1 - s0) * fz)
        zz += xzJit(x, yy, zz, 0.35)
        return [x, yy + ny * off, zz + nz * off]
      }
      const a = P(g0, 0), b = P(g1, 0), c = P(g1, 1), d = P(g0, 1)
      sPos.push(...a, ...b, ...c, ...a, ...c, ...d)
      sUv.push(g0 * 12, 0, g1 * 12, 0, g1 * 12, 1, g0 * 12, 0, g1 * 12, 1, g0 * 12, 1)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3))
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2))
    sg.computeVertexNormals()

    // ── noise-displaced pit floor ──
    const fD = zStart + D / 2
    const fg = new THREE.PlaneGeometry(W, fD, 40, 24)
    fg.rotateX(-Math.PI / 2)
    fg.translate(0, 0, (zStart - D / 2) / 2)
    const p = fg.attributes.position
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i)
      const edge = Math.min(1, (zStart - pz) / 6)              // flatten toward the bench toe
      if (edge > 0) p.setY(i, (hashNoise(px * 0.18, pz * 0.18) * 0.16 + hashNoise(px * 0.5, pz * 0.5) * 0.06) * edge)
    }
    fg.computeVertexNormals()
    return { benchGeo: g, seamGeo: sg, floorGeo: fg, profileEnd: zEnd }
  }, [depth, benches, benchDepth, faceAngle, W, D, zStart, earth.getHex()]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── haul ramp: an inclined deck + windrow berms climbing the wall on +X ──
  const ramp = useMemo(() => {
    if (!rampOn) return null
    const z0 = zStart - 6, z1 = profileEnd + 1
    const dz = z1 - z0, L = Math.hypot(dz, depth)
    const ang = Math.atan2(depth, dz)
    return { mid: [W / 2 - rampW / 2 - 1.5, depth / 2 + 0.1, (z0 + z1) / 2], ang: -ang, L }
  }, [rampOn, zStart, profileEnd, depth, W, rampW])

  // ── muck piles: irregular displaced mounds of broken coal + one rubble ──
  const muck = useMemo(() => {
    if (config.muck === false) return null
    return [
      { geo: moundGeo(4.6, 2.6, 0.5, 2.1), pos: [4, 0, 12], coal: true },
      { geo: moundGeo(3.1, 1.9, 0.55, 5.7), pos: [12, 0, 9], coal: true },
      { geo: moundGeo(2.2, 1.3, 0.6, 9.3), pos: [8, 0, 14.5], coal: true },
      { geo: moundGeo(2.6, 1.5, 0.5, 13.9), pos: [-14, 0, 13], coal: false },   // overburden rubble
    ]
  }, [config.muck])

  const earthMaps = getFinishMaps('concrete')   // mottled matte detail reads as compacted earth
  const dustMaps  = getFinishMaps('dust')       // pale film for the trafficked floor
  const coalMaps  = getFinishMaps('granular')   // glinting broken coal (seam + muck)

  return (
    <group>
      <mesh geometry={benchGeo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors metalness={0.02} roughness={0.95}
          roughnessMap={earthMaps?.roughnessMap ?? null} normalMap={earthMaps?.normalMap ?? null}
          normalScale={earthMaps?.normalScale ? [earthMaps.normalScale, earthMaps.normalScale] : undefined} />
      </mesh>
      {config.seam !== false && (
        <mesh geometry={seamGeo}>
          <meshStandardMaterial color={seamCol} metalness={0.06} roughness={0.85}
            map={coalMaps?.map ?? null} roughnessMap={coalMaps?.roughnessMap ?? null}
            normalMap={coalMaps?.normalMap ?? null}
            normalScale={coalMaps?.normalScale ? [coalMaps.normalScale, coalMaps.normalScale] : undefined}
            polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      <mesh geometry={floorGeo} receiveShadow>
        <meshStandardMaterial color={floorCol} metalness={0.02} roughness={0.96}
          map={dustMaps?.map ?? null} roughnessMap={dustMaps?.roughnessMap ?? null}
          normalMap={dustMaps?.normalMap ?? null}
          normalScale={dustMaps?.normalScale ? [dustMaps.normalScale, dustMaps.normalScale] : undefined} />
      </mesh>
      {ramp && (
        <group position={ramp.mid} rotation={[ramp.ang, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[rampW, 0.2, ramp.L]} />
            <meshStandardMaterial color="#55504a" metalness={0.02} roughness={0.95} />
          </mesh>
          {[-1, 1].map(s => (
            <mesh key={s} position={[s * (rampW / 2 - 0.3), 0.3, 0]} castShadow>
              <boxGeometry args={[0.6, 0.5, ramp.L]} />
              <meshStandardMaterial color={resolveColor(config.earthColor, '#8a7a64')} metalness={0.02} roughness={0.95} />
            </mesh>
          ))}
        </group>
      )}
      {muck && muck.map((m, i) => (
        <mesh key={i} geometry={m.geo} position={m.pos} castShadow receiveShadow>
          {m.coal ? (
            <meshStandardMaterial color="#2a2d33" metalness={0.06} roughness={0.85}
              map={coalMaps?.map ?? null} roughnessMap={coalMaps?.roughnessMap ?? null}
              normalMap={coalMaps?.normalMap ?? null}
              normalScale={coalMaps?.normalScale ? [coalMaps.normalScale, coalMaps.normalScale] : undefined} />
          ) : (
            <meshStandardMaterial color={resolveColor(config.earthColor, '#8a7a64')} metalness={0.02} roughness={0.95}
              roughnessMap={earthMaps?.roughnessMap ?? null} normalMap={earthMaps?.normalMap ?? null}
              normalScale={earthMaps?.normalScale ? [earthMaps.normalScale, earthMaps.normalScale] : undefined} />
          )}
        </mesh>
      ))}
    </group>
  )
}
