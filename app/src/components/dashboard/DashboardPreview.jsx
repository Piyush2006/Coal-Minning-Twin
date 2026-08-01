// Live 3D mini-preview for the operations dashboard. Same single-render-target
// scissor technique as the CCTV feed: a second pass renders a fixed site-wide
// 3/4 vantage into the preview CARD's on-screen rectangle. Runs ONLY while the
// dashboard is visible, at a reduced frame rate; zero cost otherwise. The card
// itself is a transparent hole punched through the dashboard overlay, so the
// scissor render shows through exactly where the card sits.
import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { C, R } from '../../ui/theme'

// the preview card registers its DOM node here (single source of truth for the rect)
export const usePreviewEl = create((set) => ({ el: null, setEl: (el) => set({ el }) }))

const _eye = new THREE.Vector3(), _tgt = new THREE.Vector3()
const DEFAULT_POS = [66, 78, 150], DEFAULT_TGT = [8, 2, 4]

export function DashboardPreviewRenderer() {
  const camRef = useRef()
  if (!camRef.current) camRef.current = new THREE.PerspectiveCamera(46, 16 / 9, 1, 2400)
  const frame = useRef(0)

  useFrame(({ gl, scene, size }) => {
    if (useDashboard.getState().mode !== 'dashboard') return       // zero cost in twin view
    if (useDashboard.getState().inspectorAssetId) return           // paused while the inspector is open
    const el = usePreviewEl.getState().el
    if (!el || !el.isConnected) return
    // Render EVERY frame: the composer redraws the whole canvas each frame, so
    // the hole must be re-overdrawn with the preview camera every frame or it
    // flickers between the main scene and the preview (this was the glitch).
    const pr = el.getBoundingClientRect()
    if (pr.width < 8 || pr.height < 8) return
    const cr = gl.domElement.getBoundingClientRect()
    const x = pr.left - cr.left, y = cr.height - (pr.bottom - cr.top), w = pr.width, h = pr.height

    const dash = useSceneStore.getState().dashboard?.preview || {}
    const pos = dash.position || DEFAULT_POS, tgt = dash.target || DEFAULT_TGT
    const fc = camRef.current
    _eye.set(pos[0], pos[1], pos[2]); _tgt.set(tgt[0], tgt[1], tgt[2])
    fc.position.copy(_eye); fc.lookAt(_tgt)
    if (fc.aspect !== w / h) { fc.aspect = w / h }
    fc.updateProjectionMatrix()

    const prevAutoClear = gl.autoClear
    gl.autoClear = false
    gl.setScissorTest(true)
    gl.setScissor(x, y, w, h)
    gl.setViewport(x, y, w, h)
    gl.clear(true, true, false)
    gl.render(scene, fc)
    gl.setScissorTest(false)
    gl.setViewport(0, 0, size.width, size.height)
    gl.autoClear = prevAutoClear
  }, 101)                                                          // after PostFX + CCTV pass

  return null
}

// The transparent card the preview renders into (mounts in the dashboard DOM).
export function DashboardPreviewCard({ onOpen, label = 'Open 3D Twin', fill = false }) {
  const setEl = usePreviewEl(s => s.setEl)
  return (
    <button onClick={onOpen} title="Open the 3D twin"
      ref={el => setEl(el)}
      style={fill
        ? { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', overflow: 'hidden', background: 'transparent', cursor: 'pointer', padding: 0 }
        : { position: 'relative', width: '100%', aspectRatio: '16 / 9', border: '1px solid #EAECF0', borderRadius: 12, overflow: 'hidden', background: 'transparent', cursor: 'pointer', padding: 0, boxShadow: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)' }}>
      {/* chrome only — the 3D shows THROUGH the transparent background */}
      <span style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#fff',
        background: 'rgba(10,12,16,0.55)', borderRadius: R.pill, padding: '3px 9px', pointerEvents: 'none' }}>
        <span className="breathe" style={{ width: 7, height: 7, borderRadius: '50%', background: '#12B76A' }} />LIVE
      </span>
      <span style={{ position: 'absolute', bottom: 10, right: 12, fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
        color: '#fff', background: 'rgba(10,12,16,0.55)', borderRadius: 999, padding: '3px 10px', pointerEvents: 'none' }}>{label} →</span>
    </button>
  )
}

// Opaque backdrop that covers the whole screen EXCEPT the preview card's rect,
// so the scissor-rendered 3D shows through a genuine hole (the dashboard root
// is transparent; every other region is covered by these four bands).
export function PreviewBackdrop() {
  const [r, setR] = useState(null)
  useEffect(() => {
    let raf
    const loop = () => {
      const el = usePreviewEl.getState().el
      if (el && el.isConnected) {
        const b = el.getBoundingClientRect()
        setR(prev => (!prev || Math.abs(prev.top - b.top) > 1 || Math.abs(prev.left - b.left) > 1 ||
          Math.abs(prev.width - b.width) > 1 || Math.abs(prev.height - b.height) > 1)
          ? { top: b.top, left: b.left, width: b.width, height: b.height, bottom: b.bottom, right: b.right } : prev)
      } else setR(prev => (prev ? null : prev))    // no preview → fully opaque (no stale hole)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  const bg = '#F6F7F9'   // spec page background
  const band = (st, k) => <div key={k} style={{ position: 'fixed', background: bg, zIndex: 0, ...st }} />
  if (!r) return band({ inset: 0 }, 'all')          // no hole until measured (no canvas flash)
  return (
    <>
      {band({ left: 0, top: 0, width: '100vw', height: Math.max(0, r.top) }, 'top')}
      {band({ left: 0, top: r.bottom, width: '100vw', bottom: 0 }, 'bot')}
      {band({ left: 0, top: r.top, width: Math.max(0, r.left), height: r.height }, 'left')}
      {band({ left: r.right, top: r.top, right: 0, height: r.height }, 'right')}
    </>
  )
}
