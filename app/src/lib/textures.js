import * as THREE from 'three'

// ── Procedural surface textures ──────────────────────────────────────────────
// Runtime canvas-generated PBR detail maps — NO external asset files (keeps the
// "procedural only" architecture). A material declares a `finish` (or one is
// derived from its metalness/roughness), and we hand the renderer a cached set of
// { map, roughnessMap, normalMap, normalScale } shared across every mesh that uses
// that finish (build-once, reuse everywhere — cheap for 100s of meshes).

const SIZE = 256                         // power-of-two → tiling wrap works
const _cache = new Map()                 // finish → maps (built lazily, kept for app lifetime)

const mkCanvas = (s = SIZE) => { const c = document.createElement('canvas'); c.width = c.height = s; return c }

// Soft value-noise: fill a low-res canvas with random grey, upscale with smoothing
// → organic blobs at ~`cell` px. contrast spreads it around mid-grey.
function noiseCanvas(cell = 8, contrast = 1) {
  const n = Math.max(2, Math.round(SIZE / cell))
  const small = mkCanvas(n), sg = small.getContext('2d')
  const img = sg.createImageData(n, n)
  for (let i = 0; i < n * n; i++) {
    const v = Math.min(255, Math.max(0, (0.5 + (Math.random() - 0.5) * contrast) * 255)) | 0
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255
  }
  sg.putImageData(img, 0, 0)
  const out = mkCanvas(), g = out.getContext('2d')
  g.imageSmoothingEnabled = true
  g.drawImage(small, 0, 0, SIZE, SIZE)
  return out
}

// Derive a tangent-space normal map from a grayscale height canvas (wrapping Sobel).
function normalFromHeight(heightCanvas, strength = 2) {
  const h = heightCanvas.getContext('2d').getImageData(0, 0, SIZE, SIZE).data
  const out = mkCanvas(), og = out.getContext('2d'), nimg = og.createImageData(SIZE, SIZE)
  const M = SIZE - 1
  const at = (x, y) => h[(((y & M) * SIZE) + (x & M)) * 4] / 255
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * strength
    const dy = (at(x, y - 1) - at(x, y + 1)) * strength
    let nx = dx, ny = dy, nz = 1
    const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len
    const i = (y * SIZE + x) * 4
    nimg.data[i] = (nx * 0.5 + 0.5) * 255; nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255
    nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255
  }
  og.putImageData(nimg, 0, 0)
  return out
}

function tex(canvas, { srgb = false, repeat = 3 } = {}) {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

// ── Finish generators (rich, industrial) ────────────────────────────────────
const GEN = {
  // Brushed / rolled steel — fine horizontal streaks.
  brushedMetal() {
    const height = mkCanvas(), g = height.getContext('2d')
    g.fillStyle = '#808080'; g.fillRect(0, 0, SIZE, SIZE)
    g.globalAlpha = 0.5; g.drawImage(noiseCanvas(3, 0.5), 0, 0)          // grain
    g.globalAlpha = 0.55
    for (let i = 0; i < 900; i++) {                                      // brush streaks
      const y = Math.random() * SIZE, l = 30 + Math.random() * 120
      g.strokeStyle = Math.random() > 0.5 ? '#9a9a9a' : '#666'
      g.lineWidth = 0.6 + Math.random()
      g.beginPath(); g.moveTo(Math.random() * SIZE, y); g.lineTo(Math.random() * SIZE + l, y + (Math.random() - 0.5)); g.stroke()
    }
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#b8b8b8'; rg.fillRect(0, 0, SIZE, SIZE)
    rg.globalAlpha = 0.6; rg.drawImage(height, 0, 0)
    return { roughnessMap: tex(rough, { repeat: 2 }),
      normalMap: tex(normalFromHeight(height, 1.2), { repeat: 2 }), normalScale: 0.2 }
  },
  // Painted / powder-coated steel — micro speckle + faint scuffs.
  paintedSteel() {
    const height = mkCanvas(), g = height.getContext('2d')
    g.fillStyle = '#808080'; g.fillRect(0, 0, SIZE, SIZE)
    g.globalAlpha = 0.35; g.drawImage(noiseCanvas(2, 0.6), 0, 0)
    g.globalAlpha = 0.5; g.drawImage(noiseCanvas(20, 0.5), 0, 0)         // gentle undulation
    g.globalAlpha = 0.5
    for (let i = 0; i < 60; i++) {                                       // scuffs
      g.strokeStyle = Math.random() > 0.5 ? '#adadad' : '#5c5c5c'; g.lineWidth = 0.6
      g.beginPath(); const x = Math.random() * SIZE, y = Math.random() * SIZE
      g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40); g.stroke()
    }
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#c8c8c8'; rg.fillRect(0, 0, SIZE, SIZE); rg.globalAlpha = 0.4; rg.drawImage(height, 0, 0)
    return { roughnessMap: tex(rough, { repeat: 2 }),
      normalMap: tex(normalFromHeight(height, 0.8), { repeat: 2 }), normalScale: 0.18 }
  },
  // Concrete — aggregate mottle, matte.
  concrete() {
    const height = mkCanvas(), g = height.getContext('2d')
    g.fillStyle = '#808080'; g.fillRect(0, 0, SIZE, SIZE)
    g.globalAlpha = 0.6; g.drawImage(noiseCanvas(24, 0.7), 0, 0)         // large mottle
    g.globalAlpha = 0.4; g.drawImage(noiseCanvas(4, 0.9), 0, 0)          // aggregate
    g.globalAlpha = 0.9
    for (let i = 0; i < 500; i++) {                                      // pits / aggregate specks
      g.fillStyle = Math.random() > 0.5 ? '#6a6a6a' : '#9c9c9c'
      const r = 0.5 + Math.random() * 1.6
      g.beginPath(); g.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, 7); g.fill()
    }
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#e6e6e6'; rg.fillRect(0, 0, SIZE, SIZE); rg.globalAlpha = 0.5; rg.drawImage(height, 0, 0)
    return { roughnessMap: tex(rough, { repeat: 3 }),
      normalMap: tex(normalFromHeight(height, 1.6), { repeat: 3 }), normalScale: 0.5 }
  },
  // Rubber / matte plastic — fine even pebbling.
  rubber() {
    const height = noiseCanvas(2.5, 0.7)
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#dcdcdc'; rg.fillRect(0, 0, SIZE, SIZE); rg.globalAlpha = 0.3; rg.drawImage(height, 0, 0)
    return { roughnessMap: tex(rough, { repeat: 4 }), normalMap: tex(normalFromHeight(height, 0.7), { repeat: 4 }), normalScale: 0.15 }
  },
  // Steel grating / chequer plate — raised bars.
  grating() {
    const height = mkCanvas(), g = height.getContext('2d')
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, SIZE, SIZE)
    g.fillStyle = '#d0d0d0'; const step = 32, bar = 8
    for (let p = 0; p < SIZE; p += step) { g.fillRect(p, 0, bar, SIZE); g.fillRect(0, p, SIZE, bar) }
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#8a8a8a'; rg.fillRect(0, 0, SIZE, SIZE)
    return { map: tex(height, { srgb: true, repeat: 4 }), roughnessMap: tex(rough, { repeat: 4 }),
      normalMap: tex(normalFromHeight(height, 3), { repeat: 4 }), normalScale: 0.6 }
  },
  // Dust / dirt film — pale sandy mottle multiplied over the base colour, matte.
  // Weathering for outdoor plant: structures, mobile equipment, civil kit.
  dust() {
    const map = mkCanvas(), g = map.getContext('2d')
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, SIZE, SIZE)
    g.globalAlpha = 0.28; g.fillStyle = '#cbb894'
    for (let i = 0; i < 700; i++) { const r = 2 + Math.random() * 14; g.beginPath(); g.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, 7); g.fill() }
    g.globalAlpha = 0.18; g.fillStyle = '#a89877'
    for (let i = 0; i < 350; i++) { const r = 1 + Math.random() * 6; g.beginPath(); g.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, 7); g.fill() }
    const height = noiseCanvas(6, 0.7)
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#e8e8e8'; rg.fillRect(0, 0, SIZE, SIZE); rg.globalAlpha = 0.4; rg.drawImage(height, 0, 0)
    return { map: tex(map, { srgb: true, repeat: 2 }), roughnessMap: tex(rough, { repeat: 2 }),
      normalMap: tex(normalFromHeight(height, 0.9), { repeat: 2 }), normalScale: 0.25 }
  },
  // Granular bulk solid — high-frequency speckle with glinting grains + strong
  // micro-normals. For coal, ore, aggregate stockpiles and loads.
  granular() {
    const map = mkCanvas(), g = map.getContext('2d')
    g.fillStyle = '#8f8f8f'; g.fillRect(0, 0, SIZE, SIZE)
    for (const [c, n] of [['#6e6e6e', 1600], ['#b5b5b5', 900], ['#4c4c4c', 900], ['#dadada', 260]]) {
      g.fillStyle = c
      for (let i = 0; i < n; i++) { const r = 0.6 + Math.random() * 2.2; g.beginPath(); g.arc(Math.random() * SIZE, Math.random() * SIZE, r, 0, 7); g.fill() }
    }
    const height = noiseCanvas(2.2, 1.0)
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#d6d6d6'; rg.fillRect(0, 0, SIZE, SIZE)
    rg.globalAlpha = 0.9; rg.drawImage(map, 0, 0)   // bright grains → shinier glints
    return { map: tex(map, { srgb: true, repeat: 4 }), roughnessMap: tex(rough, { repeat: 4 }),
      normalMap: tex(normalFromHeight(height, 2.4), { repeat: 4 }), normalScale: 0.7 }
  },
  // Weathered / rusty steel — patchy orange-brown mottle (albedo-led).
  rust() {
    const map = mkCanvas(), g = map.getContext('2d')
    g.fillStyle = '#7a4a2c'; g.fillRect(0, 0, SIZE, SIZE)
    for (const [c, n, rmax] of [['#8a5a34', 900, 10], ['#5a3720', 500, 7], ['#b0763f', 400, 5], ['#3a2a20', 300, 4]]) {
      g.fillStyle = c
      for (let i = 0; i < n; i++) { g.beginPath(); g.arc(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * rmax, 0, 7); g.fill() }
    }
    const height = noiseCanvas(5, 0.8)
    const rough = mkCanvas(), rg = rough.getContext('2d')
    rg.fillStyle = '#dedede'; rg.fillRect(0, 0, SIZE, SIZE); rg.globalAlpha = 0.5; rg.drawImage(height, 0, 0)
    return { map: tex(map, { srgb: true, repeat: 2 }), roughnessMap: tex(rough, { repeat: 2 }),
      normalMap: tex(normalFromHeight(height, 1.4), { repeat: 2 }), normalScale: 0.4 }
  },
}

export const FINISHES = Object.keys(GEN)

// Choose a finish for a material: explicit `finish` wins ('none' → untextured);
// otherwise derive from metalness/roughness. Glowing (emissive) and glassy/liquid
// (shiny) surfaces stay clean.
export function finishFor(m = {}) {
  if (m.finish) return m.finish === 'none' ? null : (GEN[m.finish] ? m.finish : deriveFinish(m))
  return deriveFinish(m)
}
function deriveFinish(m) {
  if (m.emissive) return null
  const metal = m.metalness ?? 0.6, rough = m.roughness ?? 0.35
  if (rough <= 0.32 && metal <= 0.32) return null       // glass / liquids / lacquer
  if (metal >= 0.55) return 'brushedMetal'
  if (metal <= 0.18 && rough >= 0.85) return 'concrete'
  return 'paintedSteel'
}

// Cached detail maps for a finish key (or null). Returns { map?, roughnessMap?,
// normalMap?, normalScale? } — the SAME objects every call, shared across meshes.
export function getFinishMaps(finish) {
  if (!finish || !GEN[finish]) return null
  if (!_cache.has(finish)) _cache.set(finish, GEN[finish]())
  return _cache.get(finish)
}
