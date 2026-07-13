// BlastFX — production-blast sequence, styled on real open-cut footage:
// NO fire, NO flames, NO glow — an amber warning beacon, then a line of
// grey-brown DUST columns erupting sequentially, merging into a cloud that
// drifts downwind and settles, revealing a fresh broken-rock muck pile.
//
// Config-gated per scene: any object may declare
//   config.blast = {
//     from: [x,y,z], to: [x,y,z],   // world-space blast line (a bench crest)
//     columns: 7,                   // dust columns fired along the line
//     autoIntervalSec: null,        // optional slow auto-repeat
//   }
// config.blast falsy → nothing renders, no store, no cost.
//
// Timeline (trigger at t=0):
//   0.0 – 5.0   amber beacon flashes on the bench (stand clear)
//   5.0 – 5.8   columns fire sequentially, 120 ms apart (strong upward dust)
//   6.5 – 14.5  columns merge into one cloud drifting with the wind, fading
//   8.0         fresh muck pile revealed under the line (persists)
//   15.0        sequence ends (idle again)
//
// Triggers: the Blast button (view controls), config.blast.autoIntervalSec,
// and tour beats flagged { blast: true } (fired on beat entry — the ~5 s
// beacon runs during the camera move so columns erupt as the hold begins).
import { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { create } from 'zustand'
import { useSceneStore } from '../../store/sceneStore'
import { ParticleEmitter } from './ParticleEmitter'
import { moundGeo } from '../terrain/TerrainMound'

export const useBlastStore = create((set) => ({
  firing: false,
  mucked: false,                       // a blast has happened this session
  trigger: () => set(s => (s.firing ? {} : { firing: true })),
  _finish: () => set({ firing: false, mucked: true }),
}))

// column burst: hard upward punch of grey-brown dust — no fire, no glow
const COLUMN = {
  count: 80, color: '#8d7f6c', opacity: 0.5, size: 2.0, grow: 3.6,
  lifetime: 2.6, rise: 7.5, spread: 0.9, spreadGrow: 2.4, wind: [1.1, 0.3], turb: 0.9,
}
// merged cloud: wide, slow, leans downwind, fades as it settles
const CLOUD = {
  count: 130, color: '#98897a', opacity: 0.3, size: 4.5, grow: 3.2,
  lifetime: 6.0, rise: 0.8, spread: 7, spreadGrow: 3.4, wind: [2.4, 0.7], turb: 0.7,
}

// timeline boundaries that change WHAT is mounted (coarse React state; the
// per-particle motion itself is all GPU shader time)
const BEACON_END = 5.0, COL_STEP = 0.12, COL_DUR = 3.2
const CLOUD_START = 6.5, CLOUD_FADE = 12.5, MUCK_AT = 8.0, DONE = 15.0

function BlastSequence({ cfg }) {
  const firing = useBlastStore(s => s.firing)
  const mucked = useBlastStore(s => s.mucked)
  const start = useRef(null)
  const [now, setNow] = useState(0)                 // coarse elapsed, boundary-stepped
  const beaconMat = useRef()

  const line = useMemo(() => {
    const from = cfg.from ?? [0, 0, 0], to = cfg.to ?? [10, 0, 0]
    const n = Math.max(3, Math.min(10, Math.round(cfg.columns ?? 7)))
    const pts = Array.from({ length: n }, (_, i) => {
      const f = n === 1 ? 0.5 : i / (n - 1)
      return [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f, from[2] + (to[2] - from[2]) * f]
    })
    const mid = pts[Math.floor(n / 2)]
    return { pts, mid, n }
  }, [cfg.from, cfg.to, cfg.columns])

  useFrame(({ clock }) => {
    if (!firing) { start.current = null; return }
    if (start.current == null) { start.current = clock.elapsedTime; setNow(0) }
    let e = clock.elapsedTime - start.current
    // Dev-only: headless verification pins the sequence clock (frames there are
    // seconds apart, so the whole 15 s event can fall between two frames).
    const seek = import.meta.env.DEV && typeof window !== 'undefined' ? window.__dtBlastSeek : null
    if (seek != null) e = Math.max(0, Number(seek) || 0)
    // beacon pulse (only while armed)
    if (beaconMat.current) beaconMat.current.emissiveIntensity = e < BEACON_END ? 2.2 + 1.8 * Math.sin(e * 12) : 0
    // step coarse state only when the mounted set actually changes
    const boundaries = [BEACON_END]
    for (let i = 0; i < line.n; i++) {
      boundaries.push(BEACON_END + i * COL_STEP, BEACON_END + i * COL_STEP + COL_DUR)
    }
    boundaries.push(CLOUD_START, MUCK_AT, CLOUD_FADE, DONE)
    let stepped = 0
    for (const b of boundaries) if (e >= b) stepped = Math.max(stepped, b)
    if (stepped !== now) setNow(stepped)
    if (e >= DONE) useBlastStore.getState()._finish()
  })

  const e = now
  const showBeacon = firing && e < BEACON_END
  const showCloud = firing && e >= CLOUD_START
  const cloudOpacity = e >= CLOUD_FADE ? CLOUD.opacity * 0.4 : CLOUD.opacity
  const showMuck = mucked || (firing && e >= MUCK_AT)
  const muckGeo = useMemo(() => moundGeo(6.5, 2.4, 0.6, 7.7), [])

  return (
    <group>
      {/* warning beacon — amber flash, stand-clear */}
      <group position={[line.pts[0][0], line.pts[0][1], line.pts[0][2]]} visible={showBeacon}>
        <mesh position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 3.2]} />
          <meshStandardMaterial color="#5c636a" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 3.4, 0]}>
          <sphereGeometry args={[0.42, 14, 12]} />
          <meshStandardMaterial ref={beaconMat} color="#ffb020" emissive="#ffb020" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      </group>
      {/* dust columns — sequential along the line */}
      {firing && line.pts.map((p, i) => {
        const t0 = BEACON_END + i * COL_STEP
        const on = e >= t0 && e < t0 + COL_DUR
        return on ? (
          <group key={i} position={p}>
            <ParticleEmitter preset="dust" {...COLUMN} />
          </group>
        ) : null
      })}
      {/* merged drifting cloud */}
      {showCloud && (
        <group position={[line.mid[0], line.mid[1] + 1.5, line.mid[2]]}>
          <ParticleEmitter preset="dust" {...CLOUD} opacity={cloudOpacity} />
        </group>
      )}
      {/* fresh broken-rock muck along the fired block (persists this session) */}
      {showMuck && (
        <mesh geometry={muckGeo} position={[line.mid[0], line.mid[1] - 0.2, line.mid[2]]} castShadow receiveShadow>
          <meshStandardMaterial color="#6b6154" metalness={0.03} roughness={0.95} />
        </mesh>
      )}
    </group>
  )
}

// Scene layer: mounts one sequence per object declaring config.blast, plus
// the optional slow auto-repeat.
export function BlastLayer() {
  const objects = useSceneStore(s => s.objects)
  const cfgs = useMemo(() => {
    const out = []
    for (const id in objects) {
      const b = objects[id].config?.blast
      if (b && b.from && b.to) out.push({ id, cfg: b })
    }
    return out
  }, [objects])
  const auto = cfgs.find(c => Number(c.cfg.autoIntervalSec) > 0)
  useEffect(() => {
    if (!auto) return
    const iv = setInterval(() => useBlastStore.getState().trigger(), Math.max(30, Number(auto.cfg.autoIntervalSec)) * 1000)
    return () => clearInterval(iv)
  }, [auto?.cfg.autoIntervalSec]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!cfgs.length) return null
  return <>{cfgs.map(c => <BlastSequence key={c.id} cfg={c.cfg} />)}</>
}
