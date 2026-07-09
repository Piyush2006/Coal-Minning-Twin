// Generate a top-down schematic preview of a scene as a data URL — a faint grid
// with one dot per asset (placed by world x/z, coloured by status). Cheap, no
// WebGL capture, always in sync with the project's layout. Used by ProjectCard.
import { STATUS_COLOR, C } from '../ui/theme'

export function renderSchematic(scene, { w = 520, h = 300, dpr = 2 } = {}) {
  const objects = scene?.objects ?? {}
  const list = Object.values(objects)
  const cnv = document.createElement('canvas')
  cnv.width = w * dpr; cnv.height = h * dpr
  const ctx = cnv.getContext('2d')
  ctx.scale(dpr, dpr)

  // background
  ctx.fillStyle = '#eef1f6'
  ctx.fillRect(0, 0, w, h)

  // faint grid
  ctx.strokeStyle = 'rgba(10,132,255,0.10)'
  ctx.lineWidth = 1
  const step = 26
  for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

  if (list.length === 0) return cnv.toDataURL('image/png')

  // fit world x/z into the canvas with padding
  const xs = list.map(o => o.position?.[0] ?? 0)
  const zs = list.map(o => o.position?.[2] ?? 0)
  let minX = Math.min(...xs), maxX = Math.max(...xs)
  let minZ = Math.min(...zs), maxZ = Math.max(...zs)
  if (maxX - minX < 1) { minX -= 5; maxX += 5 }
  if (maxZ - minZ < 1) { minZ -= 5; maxZ += 5 }
  const pad = 26
  const sx = (w - pad * 2) / (maxX - minX)
  const sz = (h - pad * 2) / (maxZ - minZ)
  const s = Math.min(sx, sz)
  const ox = (w - (maxX - minX) * s) / 2
  const oz = (h - (maxZ - minZ) * s) / 2
  const px = (x) => ox + (x - minX) * s
  const pz = (z) => oz + (z - minZ) * s

  // dots
  for (const o of list) {
    const x = px(o.position?.[0] ?? 0)
    const y = pz(o.position?.[2] ?? 0)
    ctx.beginPath()
    ctx.arc(x, y, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = STATUS_COLOR[o.status] ?? C.accent
    ctx.globalAlpha = 0.9
    ctx.fill()
  }
  ctx.globalAlpha = 1
  return cnv.toDataURL('image/png')
}
