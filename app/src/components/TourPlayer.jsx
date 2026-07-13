// TourPlayer — guided cinematic tour. A generic, config-driven camera player:
// the scene declares `tour.beats` = ordered [{ position, target, hold, travel,
// title, subtitle }] and the player flies the OrbitControls camera through
// them with eased crane-style moves, a slow drift during each hold, and a
// lower-third title overlay. The coal-mine tour is just data in the twin spec.
//
// Camera takeover contract (see CameraController): OrbitControls is the single
// camera authority. While touring we disable user input (ctrl.enabled=false),
// write ctrl.target / ctrl.object.position each frame at useFrame priority 1
// (after CameraController, so a stray fly-to can never fight the tour) and call
// ctrl.update(). Exit just stops writing and re-enables input — the camera
// stays exactly where the tour left it, no snap.
//
// No per-frame allocations: segments (with Vector3s) are built once on start;
// the frame loop only mutates module-level temps. The overlay is DOM — the
// store is written only at beat boundaries, never per frame.
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSceneStore } from '../store/sceneStore'
import { useDayNight } from '../lib/dayNight'
import { useBlastStore } from './effects/BlastFX'
import { useFeedStore } from './CameraFeed'
import { useViewTab } from '../lib/viewTab'
import { triggerScenario, clearScenario, clearAllScenarios, setScenarioExclusive } from '../lib/demoScenarios'
import { C, R, FONT, glass, SHADOW } from '../ui/theme'

export const useTourStore = create((set) => ({
  active: false,
  paused: false,
  card: null,                    // { title, subtitle } | null — lower-third content
  start: () => set({ active: true, paused: false, card: null }),
  stop:  () => set({ active: false, paused: false, card: null }),
  togglePause: () => set(s => (s.active ? { paused: !s.paused } : {})),
  _setCard: (card) => set({ card }),
}))

const DRIFT_RATE = 0.045         // rad/s yaw around the target during holds
const CARD_IN_AT = 0.72          // fade the title in over the last 28% of a move
const smootherstep = (u) => u * u * u * (u * (u * 6 - 15) + 10)

const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _off = new THREE.Vector3()

// Close everything a beat may have opened — runs between beats and on exit,
// so panels/feeds never leak past their beat and manual use is untouched after.
function tourCleanupUI() {
  try {
    const feed = useFeedStore.getState()
    if (feed.feedId) feed.closeFeed()
    if (feed.scale !== 1) useFeedStore.setState({ scale: 1 })
    useSceneStore.getState().clearSelection?.()
    useViewTab.getState().setTab('overview')
  } catch { /* never stall the tour */ }
}

// Timed beat action — every type fails soft (log in dev, tour keeps flying).
function runTourAction(a, segIndex) {
  let ok = true
  try {
    const objects = useSceneStore.getState().objects
    const resolve = (t) => (objects[t] ? t : Object.keys(objects).find(id => objects[id].name === t))
    switch (a.type) {
      case 'triggerScenario': ok = triggerScenario(a.target); break
      case 'clearScenario':   ok = clearScenario(a.target); break
      case 'blast':           useBlastStore.getState().trigger({ beaconSec: a.params?.beaconSec }); break
      case 'openFeed': {
        const id = resolve(a.target)
        if (!id) { ok = false; break }
        if ((a.params?.size ?? 1) === 2) useFeedStore.setState({ scale: 2 })
        useFeedStore.getState().openFeed(id)
        break
      }
      case 'closeFeed':       useFeedStore.getState().closeFeed(); break
      case 'switchTab':       useViewTab.getState().setTab(a.target); break
      case 'openDrilldown': {
        const id = resolve(a.target)
        if (!id) { ok = false; break }
        useSceneStore.getState().selectObject?.(id)      // panel effect flips to the Asset tab
        useViewTab.getState().setTab('asset')
        break
      }
      case 'closePanels':     tourCleanupUI(); break
      default: ok = false
    }
  } catch { ok = false }
  if (import.meta.env.DEV) console.log(`[tour] B${segIndex + 1} ${a.type} ${a.target ?? ''} ${ok ? 'ok' : 'FAILED (continuing)'}`)
  return ok
}

// Where the hold's drift leaves the camera — the next move starts from here so
// segments chain with no position jump.
function driftEnd(out, pos, tgt, hold) {
  const a = hold * DRIFT_RATE, cos = Math.cos(a), sin = Math.sin(a)
  _off.subVectors(pos, tgt)
  return out.set(tgt.x + _off.x * cos - _off.z * sin, tgt.y + _off.y, tgt.z + _off.x * sin + _off.z * cos)
}

export function TourDriver({ orbitRef }) {
  const active = useTourStore(s => s.active)
  const segs = useRef(null)
  const time = useRef(0)
  const mem = useRef({ prevEnabled: true, lastCardKey: '', lastSegI: -1, fired: new Set() })
  const { gl } = useThree()

  // Build the timeline + take over the controls when the tour starts.
  useEffect(() => {
    const ctrl = orbitRef.current
    if (!active || !ctrl) return
    const beats = useSceneStore.getState().tour?.beats ?? []
    if (!beats.length) { useTourStore.getState().stop(); return }
    // Live tokens — computed at tour start so titles can never go stale.
    const assetCount = Object.keys(useSceneStore.getState().objects).length
    const fill = (str) => String(str ?? '').replace(/\{assetCount\}/g, String(assetCount))
    let start = 0
    let prevP = ctrl.object.position.clone(), prevT = ctrl.target.clone()
    const built = beats.map((b, i) => {
      const p1 = new THREE.Vector3(...(b.position ?? [0, 30, 60]))
      const t1 = new THREE.Vector3(...(b.target ?? [0, 0, 0]))
      const travel = Math.max(0.1, Number(b.travel) || 4)
      const hold = Math.max(0, Number(b.hold) || 6)
      const seg = {
        i, p0: prevP, t0: prevT, p1, t1, start, travel, hold,
        dist: prevP.distanceTo(p1), title: fill(b.title), subtitle: fill(b.subtitle), tag: b.tag ?? null, night: !!b.night, blast: !!b.blast, actions: Array.isArray(b.actions) ? b.actions : null,
      }
      start += travel + hold
      prevP = driftEnd(new THREE.Vector3(), p1, t1, hold)
      prevT = t1
      return seg
    })
    built.total = start
    segs.current = built
    time.current = 0
    mem.current.prevEnabled = ctrl.enabled
    mem.current.lastCardKey = ''
    mem.current.lastSegI = -1
    ctrl.enabled = false                            // block user orbit input
    useSceneStore.getState().clearFlyTarget?.()     // cancel any pending fly-to
    useSceneStore.getState().clearSelection?.()     // demo polish: no highlight/gizmo
    mem.current.fired = new Set()
    clearAllScenarios()
    setScenarioExclusive(!!useSceneStore.getState().tour?.presentation)
    tourCleanupUI()
    return () => {
      ctrl.enabled = mem.current.prevEnabled        // handback — camera stays put
      segs.current = null
      useDayNight.getState().setNight(false)        // tour always hands back daylight
      tourCleanupUI()                               // close anything a beat opened
      clearAllScenarios()
      setScenarioExclusive(false)                   // demo trends resume
    }
  }, [active, orbitRef])

  // Exit / pause affordances while touring.
  useEffect(() => {
    if (!active) return
    const st = useTourStore.getState()
    const onKey = (e) => {
      if (e.key === 'Escape') st.stop()
      else if (e.code === 'Space') { e.preventDefault(); st.togglePause() }
    }
    const onDown = () => st.stop()                  // click / drag on the canvas exits
    window.addEventListener('keydown', onKey)
    const el = gl.domElement
    el.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); el.removeEventListener('pointerdown', onDown) }
  }, [active, gl])

  useFrame((_, dt) => {
    const ctrl = orbitRef.current, S = segs.current
    if (!active || !ctrl || !S) return
    const { paused, _setCard } = useTourStore.getState()
    // Dev-only escape hatch: headless verification pins the timeline directly
    // (software-GL frames are seconds long, so real-time polling can't keep up).
    // While __dtTourSeek is set the clock is frozen there; clear it to resume.
    const seek = import.meta.env.DEV && typeof window !== 'undefined' ? window.__dtTourSeek : null
    if (seek != null) time.current = Math.max(0, Number(seek) || 0)
    // Cap huge hitches (tab switch) but let slow frames advance in real time.
    else if (!paused) time.current += Math.min(dt, 1.5)
    if (time.current >= S.total) { useTourStore.getState().stop(); return }
    let seg = S[0]
    for (let i = 1; i < S.length && time.current >= S[i].start; i++) seg = S[i]
    const local = time.current - seg.start
    if (local < seg.travel) {
      const e = smootherstep(Math.min(local / seg.travel, 1))
      _p.lerpVectors(seg.p0, seg.p1, e)
      _p.y += Math.sin(e * Math.PI) * Math.min(seg.dist * 0.12, 24)   // crane arc on long hops
      _t.lerpVectors(seg.t0, seg.t1, e)
      ctrl.object.position.copy(_p)
      ctrl.target.copy(_t)
    } else {
      // Hold: slow yaw drift around the target so the frame never feels frozen.
      const a = (local - seg.travel) * DRIFT_RATE, cos = Math.cos(a), sin = Math.sin(a)
      _off.subVectors(seg.p1, seg.t1)
      ctrl.object.position.set(seg.t1.x + _off.x * cos - _off.z * sin, seg.t1.y + _off.y, seg.t1.z + _off.x * sin + _off.z * cos)
      ctrl.target.copy(seg.t1)
    }
    ctrl.update()
    // Night beats: flip the mode when a beat is entered — the ~5 s cross-fade
    // runs inside the beat's travel, so night arrives with the framing.
    if (seg.i !== mem.current.lastSegI) {
      mem.current.lastSegI = seg.i
      tourCleanupUI()                               // previous beat's panels/feeds close as the move starts
      clearAllScenarios()                           // beats fully reset scenarios even if a clear action was skipped
      const { night, setNight } = useDayNight.getState()
      if (night !== seg.night) setNight(seg.night)
      if (seg.blast) useBlastStore.getState().trigger()   // legacy blast flag (actions preferred)
    }
    // timed beat actions — each fires once at its offset into the beat
    if (seg.actions) {
      for (let ai = 0; ai < seg.actions.length; ai++) {
        const a = seg.actions[ai]
        const key = `${seg.i}:${ai}`
        if (local >= (a.at ?? 0) && !mem.current.fired.has(key)) {
          mem.current.fired.add(key)
          runTourAction(a, seg.i)
        }
      }
    }
    // Lower third — store write only when the phase flips, never per frame.
    const key = local >= seg.travel * CARD_IN_AT ? `${seg.i}:hold` : ''
    if (key !== mem.current.lastCardKey) {
      mem.current.lastCardKey = key
      _setCard(key ? { title: seg.title, subtitle: seg.subtitle, tag: seg.tag } : null)
    }
  }, 1)

  return null
}

// ── Lower-third title overlay (DOM, mounts in the app layout) ──────────────
export function TourOverlay() {
  const active = useTourStore(s => s.active)
  const paused = useTourStore(s => s.paused)
  const card = useTourStore(s => s.card)
  const [shown, setShown] = useState(null)          // sticky content through the fade-out
  useEffect(() => { if (card) setShown(card) }, [card])
  if (!active) return null
  return (
    <>
      <div data-tour-card style={{ position: 'absolute', left: '50%', bottom: 58, zIndex: 24, pointerEvents: 'none',
        transform: `translateX(-50%) translateY(${card ? 0 : 12}px)`, opacity: card ? 1 : 0,
        transition: 'opacity 650ms ease, transform 650ms ease',
        fontFamily: FONT, textAlign: 'center', ...glass, border: `1px solid ${C.line}`,
        borderRadius: R.lg, boxShadow: SHADOW.panel, padding: '13px 28px', maxWidth: 620 }}>
        {shown?.tag ? (
          <div style={{ marginBottom: 5 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: C.text2,
              background: 'rgba(120,120,128,0.12)', borderRadius: 4, padding: '2px 8px' }}>{shown.tag}</span>
          </div>
        ) : null}
        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: 0.2, color: C.text, whiteSpace: 'nowrap' }}>{shown?.title}</div>
        {shown?.subtitle ? <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>{shown.subtitle}</div> : null}
      </div>
      {paused && (
        <div style={{ position: 'absolute', top: 74, left: '50%', transform: 'translateX(-50%)', zIndex: 24,
          pointerEvents: 'none', fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.text2,
          ...glass, border: `1px solid ${C.line}`, borderRadius: R.pill, padding: '6px 14px' }}>
          Paused — space to resume · esc to exit
        </div>
      )}
    </>
  )
}
