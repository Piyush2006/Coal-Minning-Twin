// Kpi3D — small live KPI cards floating in the 3D scene. Generic + config-
// driven: any object opts in via
//   config.kpi3d = { param: 'load', label: 'Belt Load', unit: '%',
//                    offset: [0, 6, 0], decimals?: 0 }
// The card shows the asset's live mock parameter (same value the panels read)
// and updates as the simulator ticks. Distance-faded: readable in mid shots,
// gone when far away or nearly under the camera. Globally toggleable via the
// small KPI button in the viewport controls (default ON).
//
// Cheap by construction: one drei <Html> per label (max a handful per scene),
// value updates via a narrow store subscription (only that label re-renders,
// 1 Hz), and the distance fade writes DOM opacity directly in useFrame — no
// React state, no per-frame allocations.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useTourStore } from './TourPlayer'
import { create } from 'zustand'
import { useSceneStore } from '../store/sceneStore'
import { C, FONT, SHADOW } from '../ui/theme'

export const useKpiStore = create((set) => ({
  shown: true,
  toggle: () => set(s => ({ shown: !s.shown })),
}))

const _anchor = new THREE.Vector3()
const FAR_END = 170, FAR_SPAN = 45     // fully faded beyond FAR_END, full at FAR_END-FAR_SPAN
const NEAR_END = 10, NEAR_SPAN = 8     // fades out when closer than NEAR_END+NEAR_SPAN
const clamp01 = (v) => Math.max(0, Math.min(1, v))

function KpiLabel({ id, kpi, position }) {
  const value = useSceneStore(s => s.objects[id]?.parameters?.[kpi.param])
  const boxRef = useRef()
  const anchor = useMemo(() => {
    const o = kpi.offset ?? [0, 6, 0]
    return [position[0] + (o[0] ?? 0), position[1] + (o[1] ?? 0), position[2] + (o[2] ?? 0)]
  }, [kpi.offset, position])

  useFrame(({ camera }) => {
    const el = boxRef.current
    if (!el) return
    _anchor.set(anchor[0], anchor[1], anchor[2])
    const d = camera.position.distanceTo(_anchor)
    const o = clamp01((FAR_END - d) / FAR_SPAN) * clamp01((d - NEAR_END) / NEAR_SPAN)
    el.style.opacity = o.toFixed(2)
    el.style.visibility = o < 0.02 ? 'hidden' : 'visible'
  })

  const n = Number(value)
  const text = Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: kpi.decimals ?? 0, minimumFractionDigits: kpi.decimals ?? 0 })
    : '—'
  return (
    <Html position={anchor} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={boxRef} style={{
        fontFamily: FONT, textAlign: 'center', whiteSpace: 'nowrap',
        background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: SHADOW.card,
        padding: '5px 10px 6px', transform: 'translateY(-50%)',
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: C.text3 }}>{kpi.label ?? kpi.param}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.15 }}>
          {text}<span style={{ fontSize: 10.5, fontWeight: 600, color: C.text2, marginLeft: 3 }}>{kpi.unit ?? ''}</span>
        </div>
      </div>
    </Html>
  )
}

export function Kpi3DLayer() {
  const shown = useKpiStore(s => s.shown)
  const editMode = useSceneStore(s => s.editMode)
  const tourActive = useTourStore(s => s.active)   // hide floating KPI labels during the tour
  const objects = useSceneStore(s => s.objects)
  // Anchors change only when the scene's kpi3d config changes — key by a cheap signature.
  const anchors = useMemo(() => {
    const out = []
    for (const id in objects) {
      const o = objects[id]
      if (o.config?.kpi3d?.param) out.push({ id, kpi: o.config.kpi3d, position: o.position })
    }
    return out
  }, [objects])
  if (!shown || editMode || tourActive) return null
  return <>{anchors.map(a => <KpiLabel key={a.id} {...a} />)}</>
}
