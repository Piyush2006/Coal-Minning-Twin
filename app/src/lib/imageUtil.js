// ─────────────────────────────────────────────────────────────────────────────
// Image helpers for chat attachments + vision calls. Everything stays client-
// side: uploads are downscaled to JPEG data-URLs before they touch the model
// APIs (Anthropic caps 5 MB/image; big photos waste tokens) and a tiny thumb
// is what gets PERSISTED in chat history (localStorage budget).
// ─────────────────────────────────────────────────────────────────────────────

let _seq = 0

// File/Blob/dataURL → JPEG data-URL, longest edge ≤ maxDim. White background
// (transparent PNGs would go black in JPEG); EXIF orientation respected.
export async function downscaleToDataUrl(source, { maxDim = 1024, quality = 0.8 } = {}) {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source
  if (!/^image\//.test(blob.type)) throw new Error(`Not an image (${blob.type || 'unknown type'})`)
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } finally { bmp.close?.() }
}

// One chat attachment: `full` goes to the model (current turn only, never
// persisted), `thumb` is what chat history stores and renders.
export async function fileToAttachment(file) {
  const [full, thumb] = await Promise.all([
    downscaleToDataUrl(file, { maxDim: 1024, quality: 0.8 }),
    downscaleToDataUrl(file, { maxDim: 160, quality: 0.6 }),
  ])
  return { id: `att_${Date.now().toString(36)}_${_seq++}`, name: file.name || 'image', full, thumb }
}

// data:image/jpeg;base64,… → { mime, b64 } for the provider payloads.
export function dataUrlParts(dataUrl) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl || '')
  return m ? { mime: m[1], b64: m[2] } : { mime: 'image/jpeg', b64: '' }
}
