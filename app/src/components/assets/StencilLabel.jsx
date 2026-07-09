import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

// A stencilled pot number painted via CanvasTexture (no font-CDN dependency —
// avoids the drei <Text> suspense gotcha). toneMapped=false keeps it crisp under ACES.
export function StencilLabel({ text = '', width = 1.4, height = 0.7, ...props }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 128
    const g = c.getContext('2d')
    g.clearRect(0, 0, 256, 128)
    // dark plate
    g.fillStyle = 'rgba(20,22,26,0.92)'
    g.beginPath(); g.roundRect(6, 6, 244, 116, 12); g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.stroke()
    // stencilled number
    g.fillStyle = '#eef1f4'
    g.font = '700 78px -apple-system, "SF Pro Display", Inter, system-ui, sans-serif'
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(String(text).slice(0, 5), 128, 70)
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 4
    return t
  }, [text])

  useEffect(() => () => tex.dispose(), [tex])

  return (
    <mesh {...props}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}
