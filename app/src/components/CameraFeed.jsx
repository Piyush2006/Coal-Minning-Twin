// CameraFeed — clickable CCTV camera feeds. Clicking any asset that declares a
// belt watch binding (config.watch — the conveyor-vision cameras) opens a small
// control-room style feed panel showing the LIVE scene rendered FROM THAT
// CAMERA'S POINT OF VIEW, aimed at its belt watch-point.
//
// Performance design (the critical constraint):
//   • exactly ONE feed at a time — a single shared PerspectiveCamera
//   • rendered as a scissor/viewport second pass into a small corner region of
//     the MAIN canvas (no FBO, no texture copies, no second WebGL context)
//   • region is ~360×202 CSS px → a few % of the pixels; one extra scene pass
//   • ZERO work when no feed is open (the useFrame early-returns)
// DOM chrome (name / REC / LIVE / timestamp / close / scanlines / severity
// border / detection bounding box) overlays the region exactly.
import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSceneStore } from '../store/sceneStore'
import { useActiveAlerts, alertSeverityMap, ALERT_SEVERITY_COLOR } from '../lib/alertsEngine'
import { beltWatchWorldPos } from './Connectors'
import { nightMix } from '../lib/dayNight'
import { C, R, FONT, glass, SHADOW } from '../ui/theme'

// panel geometry (CSS px, anchored bottom-left clear of the namespace panel)
export const FEED_W = 384, FEED_H = 216, FEED_LEFT = 300, FEED_BOTTOM = 24

export const useFeedStore = create((set) => ({
  feedId: null,
  // detection box projected into the feed (updated by the renderer, throttled)
  box: null,                       // { x, y, w, h } in 0..1 panel coords, or null
  scale: 1,                        // 1x default; 2x for big-screen demos
  openFeed: (id) => set({ feedId: id, box: null }),
  closeFeed: () => set({ feedId: null, box: null }),
  toggleScale: () => set(st => ({ scale: st.scale === 1 ? 2 : 1 })),
  _setBox: (box) => set({ box }),
}))

const _eye = new THREE.Vector3(), _tgt = new THREE.Vector3(), _dir = new THREE.Vector3()
const _proj = new THREE.Vector3()

// ── Inside-canvas scissor pass (mount inside <Canvas>, after PostFX) ────────
export function CameraFeedRenderer() {
  const camRef = useRef()
  if (!camRef.current) camRef.current = new THREE.PerspectiveCamera(52, FEED_W / FEED_H, 1.0, 900)
  const frame = useRef(0)

  useFrame(({ gl, scene, size }) => {
    const { feedId, _setBox, box, scale } = useFeedStore.getState()
    if (!feedId) return                                     // zero cost when closed
    const objects = useSceneStore.getState().objects
    const obj = objects[feedId]
    const watchPos = obj && beltWatchWorldPos(objects, feedId)
    if (!obj || !watchPos) return

    // eye at the camera head, looking just above the belt-surface watch point
    _tgt.set(watchPos[0], watchPos[1] + 0.3, watchPos[2])
    _eye.set(obj.position[0], obj.position[1] + 3.6, obj.position[2])
    _dir.subVectors(_tgt, _eye).normalize()
    _eye.addScaledVector(_dir, 0.55)                        // step past the housing
    const fc = camRef.current
    fc.position.copy(_eye)
    fc.lookAt(_tgt)
    fc.updateProjectionMatrix()

    // second pass into the panel region (device px, GL origin = bottom-left)
    const dpr = gl.getPixelRatio()
    const x = Math.round(FEED_LEFT * dpr), y = Math.round(FEED_BOTTOM * dpr)
    const w = Math.round(FEED_W * scale * dpr), h = Math.round(FEED_H * scale * dpr)
    const prevAutoClear = gl.autoClear
    gl.autoClear = false
    gl.setScissorTest(true)
    gl.setScissor(x, y, w, h)
    gl.setViewport(x, y, w, h)
    gl.clear(true, true, false)
    const prevExposure = gl.toneMappingExposure
    gl.toneMappingExposure = prevExposure * (1 + 0.55 * nightMix.v)   // night gain: raw feed stays legible
    gl.render(scene, fc)
    gl.toneMappingExposure = prevExposure
    gl.setScissorTest(false)
    gl.setViewport(0, 0, Math.round(size.width * dpr), Math.round(size.height * dpr))
    gl.autoClear = prevAutoClear

    // throttled: project the detection point into panel coords for the bbox overlay
    if ((frame.current++ % 10) === 0) {
      _proj.set(watchPos[0], watchPos[1] + 0.1, watchPos[2]).project(fc)   // box sits ON the spot
      if (_proj.z < 1 && Math.abs(_proj.x) < 1.2 && Math.abs(_proj.y) < 1.2) {
        const nb = { x: (_proj.x + 1) / 2, y: 1 - (_proj.y + 1) / 2 }
        if (!box || Math.abs(box.x - nb.x) > 0.01 || Math.abs(box.y - nb.y) > 0.01) _setBox(nb)
      } else if (box) _setBox(null)
    }
  }, 100)   // AFTER the EffectComposer pass

  return null
}

// ── DOM chrome overlay (mount in the app layout, view mode) ────────────────
const mono = "'SF Mono', ui-monospace, Menlo, monospace"

export function CameraFeedPanel() {
  const feedId = useFeedStore(s => s.feedId)
  const box = useFeedStore(s => s.box)
  const scale = useFeedStore(s => s.scale)
  const closeFeed = useFeedStore(s => s.closeFeed)
  const toggleScale = useFeedStore(s => s.toggleScale)
  const obj = useSceneStore(s => (feedId ? s.objects[feedId] : null))
  const alerts = useActiveAlerts()
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString())

  useEffect(() => {
    if (!feedId) return
    const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000)
    const onKey = (e) => { if (e.key === 'Escape') closeFeed() }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(t); window.removeEventListener('keydown', onKey) }
  }, [feedId, closeFeed])

  if (!feedId || !obj) return null
  const sevMap = alertSeverityMap(alerts)
  const sev = sevMap[feedId] ?? null
  const sevColor = sev ? ALERT_SEVERITY_COLOR[sev] : null
  const camAlert = alerts.find(a => a.objId === feedId)

  return (
    <div style={{ position: 'absolute', left: FEED_LEFT, bottom: FEED_BOTTOM, width: FEED_W * scale, height: FEED_H * scale,
      zIndex: 30, pointerEvents: 'none', fontFamily: FONT,
      border: `2px solid ${sevColor ?? 'rgba(20,26,32,0.85)'}`, borderRadius: 10, overflow: 'hidden',
      boxShadow: SHADOW.panel, ...(sev === 'critical' ? { animation: 'feedPulse 1.2s ease-in-out infinite' } : {}) }}>
      <style>{`@keyframes feedPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.55) } 50% { box-shadow: 0 0 22px 4px rgba(255,59,48,0.55) } }
        @keyframes recBlink { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>

      {/* scanlines + vignette — cheap CSS "camera footage" feel */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 3px)',
        mixBlendMode: 'multiply' }} />
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.28) 100%)' }} />

      {/* top chrome bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26, display: 'flex', alignItems: 'center',
        gap: 8, padding: '0 8px', background: 'linear-gradient(rgba(8,10,14,0.82), rgba(8,10,14,0.45))',
        color: '#e8edf2', fontFamily: mono, fontSize: 10.5, pointerEvents: 'auto' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30', animation: 'recBlink 1.1s steps(1) infinite' }} />
        <span style={{ fontWeight: 700, letterSpacing: 0.4 }}>{obj.name}</span>
        <span style={{ marginLeft: 'auto', color: '#8fe08f', fontWeight: 700 }}>LIVE</span>
        <button onClick={toggleScale} title={scale === 1 ? 'Enlarge feed (2x)' : 'Shrink feed (1x)'}
          style={{ background: 'none', border: '1px solid rgba(232,237,242,0.4)', borderRadius: 3, color: '#e8edf2',
            fontFamily: 'inherit', fontSize: 9, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: '2px 5px' }}>
          {scale === 1 ? '2×' : '1×'}</button>
        <span>{clock}</span>
        <button onClick={closeFeed}
          style={{ background: 'none', border: 'none', color: '#e8edf2', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>

      {/* detection tag + fake vision-model bounding box */}
      {camAlert && (
        <div style={{ position: 'absolute', bottom: 6, left: 8, right: 8, display: 'flex', pointerEvents: 'none' }}>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#0b0e12',
            background: sevColor, borderRadius: 4, padding: '2px 7px', maxWidth: '100%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ▲ {camAlert.message}
          </span>
        </div>
      )}
      {camAlert && box && (
        <div style={{ position: 'absolute', left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: 64, height: 46, transform: 'translate(-50%, -50%)',
          border: `2px solid ${sevColor}`, borderRadius: 3,
          boxShadow: `0 0 8px ${sevColor}66` }}>
          <span style={{ position: 'absolute', top: -14, left: -2, fontFamily: mono, fontSize: 9,
            fontWeight: 700, color: sevColor, whiteSpace: 'nowrap' }}>
            DET {(0.72 + ((camAlert.value ?? 50) % 25) / 100).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}
