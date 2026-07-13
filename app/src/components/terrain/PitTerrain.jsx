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
  if (config.bowl) return <BowlPit config={config} />
  return <LinearPit config={config} />
}

function LinearPit({ config = {} }) {
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
          // CCW as seen FROM THE PIT (−Z / above): a→c→b, a→d→c. The previous
          // a→b→c winding pointed the normals INTO the hill, so FrontSide
          // culling made the slant faces invisible from the pit side.
          pushV(...a, cA); pushV(...c, cC); pushV(...b, cB)
          pushV(...a, cA); pushV(...d, cD); pushV(...c, cC)
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
      {/* side=DoubleSide as belt-and-braces: terrain must NEVER be see-through
          from any orbit angle, even if a future edit slips a winding */}
      <mesh geometry={benchGeo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors metalness={0.02} roughness={0.95} side={THREE.DoubleSide}
          roughnessMap={earthMaps?.roughnessMap ?? null} normalMap={earthMaps?.normalMap ?? null}
          normalScale={earthMaps?.normalScale ? [earthMaps.normalScale, earthMaps.normalScale] : undefined} />
      </mesh>
      {config.seam !== false && (
        <mesh geometry={seamGeo}>
          <meshStandardMaterial color={seamCol} metalness={0.06} roughness={0.85} side={THREE.DoubleSide}
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


// ── BowlPit — full open-cut bowl (config.bowl = true) ───────────────────────
// A polar sweep of the same stepped face/tread profile: four (config) benches
// descending from grade to a floor `depth` below, wrapping the pit except for
// an `openingDeg` gap facing +X (the haul exit). Local origin = centre of the
// pit FLOOR — place the object at y = -depth so the rim lands at grade.
// Includes: per-bench geology tinting (lighter overburden up high, coal-dark
// lowest face + granular seam band), noise-jittered faces with planar treads,
// arc end caps, a dusty displaced floor, a grade apron ring, a spiral haul
// ramp of stepped deck segments with outer-edge berms and one switchback
// platform, an optional murky water sump, and polar-placed muck piles.
const D2R = Math.PI / 180
function BowlPit({ config = {} }) {
  const benches  = Math.max(2, Math.round(Number(config.benches) || 4))
  const H        = Number(config.benchHeight) || 3.6
  const faceAng  = THREE.MathUtils.degToRad(Number(config.faceAngle) || 62)
  const tread    = Number(config.benchDepth) || 8
  const floorR   = Number(config.floorRadius) || 26
  const openDeg  = Number(config.openingDeg) || 56
  const earth    = new THREE.Color(resolveColor(config.earthColor, '#8a7a64'))
  const floorCol = resolveColor(config.floorColor, '#6e6257')
  const seamCol  = resolveColor(config.seamColor, '#23262b')
  const depth    = benches * H
  const run      = H / Math.tan(faceAng)
  const crestPad = 4
  const rimR     = floorR + benches * run + (benches - 1) * tread + crestPad

  const { benchGeo, seamGeo, floorGeo, apronGeo } = useMemo(() => {
    const th0 = (openDeg / 2) * D2R, th1 = (360 - openDeg / 2) * D2R
    const A = 72                                              // arc subdivisions
    const rock = new THREE.Color('#7d7466')
    const light = new THREE.Color('#a39a88')                  // upper-bench overburden
    const coalFace = new THREE.Color('#3a3d42')               // lowest face reads coaly

    // radial profile (like the linear pit, radial instead of z)
    const segs = []
    let r = floorR, y = 0
    for (let b = 0; b < benches; b++) {
      segs.push({ r0: r, y0: y, r1: r + run, y1: y + H, face: true, bench: b }); r += run; y += H
      const t = b === benches - 1 ? crestPad : tread
      segs.push({ r0: r, y0: y, r1: r + t, y1: y, face: false, bench: b }); r += t
    }

    const jit = (th, yy, rr, amp) => {
      const edge = Math.min(1, Math.min(th - th0, th1 - th) / 0.12)   // pin the arc ends
      const n1 = hashNoise(th * 21 + yy * 0.7, rr * 0.23)
      const n2 = hashNoise(th * 57, rr * 0.55 + yy)
      return (n1 * 0.75 + n2 * 0.25) * amp * Math.max(0, edge)
    }
    const pos = [], col = []
    const pushV = (v, c) => { pos.push(v[0], v[1], v[2]); col.push(c.r, c.g, c.b) }
    const vColor = (th, yy, rr, face, bench) => {
      let base
      if (face && bench === 0) base = earth.clone().lerp(coalFace, 0.62)          // exposed seam zone
      else if (face) base = earth.clone().lerp(rock, 0.55).lerp(light, bench / benches * 0.5)
      else base = earth.clone().lerp(new THREE.Color('#9a8d76'), 0.5).lerp(light, bench / benches * 0.35)
      const local = (yy % H) / H
      if (face && bench > 0 && local < 0.3) base.lerp(new THREE.Color('#4c463d'), 0.3 * (1 - local / 0.3))
      base.offsetHSL(0, 0, hashNoise(th * 40, rr * 0.35 + yy * 0.9) * 0.09)
      return base
    }
    const P = (th, sgm, f) => {
      let yy = sgm.y0 + (sgm.y1 - sgm.y0) * f
      let rr = sgm.r0 + (sgm.r1 - sgm.r0) * f
      const midRow = sgm.face && f > 0.01 && f < 0.99
      rr += jit(th, yy, rr, midRow ? 0.6 : (yy > 0.01 ? 0.2 : 0))
      if (midRow) yy += jit(th + 1.7, rr, yy, 0.28)
      return [Math.cos(th) * rr, yy, Math.sin(th) * rr]
    }
    for (const sgm of segs) {
      const rows = sgm.face ? 3 : 2
      for (let rI = 0; rI < rows - 1; rI++) {
        const f0 = rI / (rows - 1), f1 = (rI + 1) / (rows - 1)
        for (let i = 0; i < A; i++) {
          const ta = th0 + ((th1 - th0) * i) / A, tb = th0 + ((th1 - th0) * (i + 1)) / A
          const a = P(ta, sgm, f0), b = P(tb, sgm, f0), c = P(tb, sgm, f1), d = P(ta, sgm, f1)
          const cA = vColor(ta, a[1], floorR, sgm.face, sgm.bench), cB = vColor(tb, b[1], floorR, sgm.face, sgm.bench)
          const cC = vColor(tb, c[1], floorR + 1, sgm.face, sgm.bench), cD = vColor(ta, d[1], floorR + 1, sgm.face, sgm.bench)
          // wind so normals face the pit interior (decreasing radius direction)
          pushV(a, cA); pushV(b, cB); pushV(c, cC)
          pushV(a, cA); pushV(c, cC); pushV(d, cD)
        }
      }
    }
    // arc end caps: vertical fans closing the profile at both opening edges
    for (const [thE, flip] of [[th0, false], [th1, true]]) {
      const capC = earth.clone().lerp(rock, 0.45)
      const pts = [[floorR, 0]]
      for (const sgm of segs) pts.push([sgm.r1, sgm.y1])
      const cxE = Math.cos(thE), szE = Math.sin(thE)
      for (let i = 0; i < pts.length - 1; i++) {
        const [ra, ya] = pts[i], [rb, yb] = pts[i + 1]
        const v0 = [cxE * pts[pts.length - 1][0], 0, szE * pts[pts.length - 1][0]]
        const v1 = [cxE * ra, ya, szE * ra], v2 = [cxE * rb, yb, szE * rb]
        if (flip) { pushV(v0, capC); pushV(v2, capC); pushV(v1, capC) }
        else { pushV(v0, capC); pushV(v1, capC); pushV(v2, capC) }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()

    // seam band on the LOWEST face, hugging the jittered wall
    const sPos = [], sUv = []
    const sSeg = segs[0]
    const off = 0.14
    for (let i = 0; i < A; i++) {
      const ta = th0 + ((th1 - th0) * i) / A, tb = th0 + ((th1 - th0) * (i + 1)) / A
      const SP = (th, f) => {
        const fz = 0.08 + 0.52 * f
        let yy = sSeg.y0 + H * fz
        let rr = sSeg.r0 + run * fz - off
        rr += jit(th, yy, rr, 0.4)
        return [Math.cos(th) * rr, yy, Math.sin(th) * rr]
      }
      const a = SP(ta, 0), b = SP(tb, 0), c = SP(tb, 1), d = SP(ta, 1)
      sPos.push(...a, ...b, ...c, ...a, ...c, ...d)
      sUv.push(i, 0, i + 1, 0, i + 1, 1, i, 0, i + 1, 1, i, 1)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3))
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2))
    sg.computeVertexNormals()

    // dusty displaced floor
    const fg = new THREE.CircleGeometry(floorR + 1.5, 56)
    fg.rotateX(-Math.PI / 2)
    const fp = fg.attributes.position
    for (let i = 0; i < fp.count; i++) {
      const px = fp.getX(i), pz = fp.getZ(i)
      const edge = Math.min(1, (floorR - Math.hypot(px, pz)) / 5)
      if (edge > 0) fp.setY(i, (hashNoise(px * 0.18, pz * 0.18) * 0.18 + hashNoise(px * 0.5, pz * 0.5) * 0.07) * edge)
    }
    fg.computeVertexNormals()

    // grade apron ring just outside the rim (feathers the crater join)
    const ag = new THREE.RingGeometry(rimR - 1, rimR + 9, 64)
    ag.rotateX(-Math.PI / 2)
    ag.translate(0, depth + 0.05, 0)
    return { benchGeo: g, seamGeo: sg, floorGeo: fg, apronGeo: ag }
  }, [benches, H, faceAng, tread, floorR, openDeg, depth, run, rimR, earth.getHex()]) // eslint-disable-line react-hooks/exhaustive-deps

  // spiral haul ramp: stepped deck segments hugging the wall, one switchback.
  // Leg 1 climbs CCW from the floor toe to half depth; a flat platform turns
  // it; leg 2 climbs CW and exits at grade through the opening. Outer-edge
  // (drop-side) berm mounds run along every deck — real pits demand them.
  const ramp = useMemo(() => {
    if (config.ramp === false) return null
    const halfY = depth / 2
    const rOf = (yy) => floorR + (yy * (run + tread)) / H - 5
    const legs = [
      { thA: 260, thB: 105, yA: 0, yB: halfY },
      { thA: 105, thB: 14, yA: halfY, yB: depth },
    ]
    const decks = []
    for (const leg of legs) {
      const N = 10
      for (let i = 0; i < N; i++) {
        const f0 = i / N, f1 = (i + 1) / N
        const th0 = (leg.thA + (leg.thB - leg.thA) * f0) * D2R
        const th1 = (leg.thA + (leg.thB - leg.thA) * f1) * D2R
        const y0 = leg.yA + (leg.yB - leg.yA) * f0, y1 = leg.yA + (leg.yB - leg.yA) * f1
        const r0 = rOf(y0), r1 = rOf(y1)
        const a = [Math.cos(th0) * r0, y0, Math.sin(th0) * r0]
        const b = [Math.cos(th1) * r1, y1, Math.sin(th1) * r1]
        const yMid = (y0 + y1) / 2
        const mid = [(a[0] + b[0]) / 2, yMid - 0.25, (a[2] + b[2]) / 2]   // box top = nominal ramp height
        const L = Math.hypot(b[0] - a[0], b[2] - a[2]) + 1.2
        const yaw = -Math.atan2(b[2] - a[2], b[0] - a[0])
        // berm on the drop side (toward pit centre), grounded on the deck top
        const inward = Math.atan2(-mid[2], -mid[0])
        const bx = mid[0] + Math.cos(inward) * 4.6, bz = mid[2] + Math.sin(inward) * 4.6
        decks.push({ mid, L, yaw, berm: [bx, yMid + 0.3, bz] })
      }
    }
    const pTh = 105 * D2R, pR = rOf(halfY)
    // platform top 2 cm below the deck joint — never coplanar with deck ends
    return { decks, platform: [Math.cos(pTh) * pR, halfY - 0.27, Math.sin(pTh) * pR] }
  }, [config.ramp, depth, floorR, run, tread, H])

  // polar muck piles: config.muckAt = [{ theta, r, radius, height, coal }]
  const muck = useMemo(() => {
    const list = Array.isArray(config.muckAt) ? config.muckAt : []
    return list.map((m, i) => ({
      geo: moundGeo(m.radius ?? 3.5, m.height ?? 2, 0.55, i * 4.3),
      pos: [Math.cos((m.theta ?? 0) * D2R) * (m.r ?? 10), m.y ?? 0, Math.sin((m.theta ?? 0) * D2R) * (m.r ?? 10)],
      coal: m.coal !== false,
    }))
  }, [JSON.stringify(config.muckAt)]) // eslint-disable-line react-hooks/exhaustive-deps

  const sump = config.sump
  const earthMaps = getFinishMaps('concrete')
  const dustMaps  = getFinishMaps('dust')
  const coalMaps  = getFinishMaps('granular')
  const earthHex  = resolveColor(config.earthColor, '#8a7a64')

  return (
    <group>
      <mesh geometry={benchGeo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors metalness={0.02} roughness={0.95} side={THREE.DoubleSide}
          roughnessMap={earthMaps?.roughnessMap ?? null} normalMap={earthMaps?.normalMap ?? null}
          normalScale={earthMaps?.normalScale ? [earthMaps.normalScale, earthMaps.normalScale] : undefined} />
      </mesh>
      {config.seam !== false && (
        <mesh geometry={seamGeo}>
          <meshStandardMaterial color={seamCol} metalness={0.06} roughness={0.85} side={THREE.DoubleSide}
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
      <mesh geometry={apronGeo} receiveShadow>
        <meshStandardMaterial color={earthHex} metalness={0.02} roughness={0.96} />
      </mesh>
      {ramp && ramp.decks.map((d, i) => (
        <group key={i}>
          <mesh position={d.mid} rotation={[0, d.yaw, 0]} castShadow receiveShadow>
            <boxGeometry args={[d.L, 0.5, 9]} />
            <meshStandardMaterial color="#5a544d" metalness={0.02} roughness={0.95} />
          </mesh>
          <mesh position={d.berm} rotation={[0, d.yaw, 0]} castShadow>
            <boxGeometry args={[d.L, 1.1, 1.4]} />
            <meshStandardMaterial color={earthHex} metalness={0.02} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {ramp && (
        <mesh position={ramp.platform} castShadow receiveShadow>
          <boxGeometry args={[16, 0.5, 14]} />
          <meshStandardMaterial color="#5a544d" metalness={0.02} roughness={0.95} />
        </mesh>
      )}
      {sump && (
        <group position={[Math.cos((sump.theta ?? 235) * D2R) * (sump.r ?? 16), 0.34, Math.sin((sump.theta ?? 235) * D2R) * (sump.r ?? 16)]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[(sump.radius ?? 7) + 1.6, 36]} />
            <meshStandardMaterial color="#4a423a" metalness={0.02} roughness={0.98} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <circleGeometry args={[sump.radius ?? 7, 36]} />
            <meshStandardMaterial color="#5c5648" metalness={0.35} roughness={0.25} />
          </mesh>
        </group>
      )}
      {muck.map((m, i) => (
        <mesh key={i} geometry={m.geo} position={m.pos} castShadow receiveShadow>
          {m.coal ? (
            <meshStandardMaterial color="#2a2d33" metalness={0.06} roughness={0.85}
              map={coalMaps?.map ?? null} roughnessMap={coalMaps?.roughnessMap ?? null}
              normalMap={coalMaps?.normalMap ?? null}
              normalScale={coalMaps?.normalScale ? [coalMaps.normalScale, coalMaps.normalScale] : undefined} />
          ) : (
            <meshStandardMaterial color={earthHex} metalness={0.02} roughness={0.95}
              roughnessMap={earthMaps?.roughnessMap ?? null} normalMap={earthMaps?.normalMap ?? null}
              normalScale={earthMaps?.normalScale ? [earthMaps.normalScale, earthMaps.normalScale] : undefined} />
          )}
        </mesh>
      ))}
    </group>
  )
}
