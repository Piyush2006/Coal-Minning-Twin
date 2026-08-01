// Asset Inspector — modal overlay with a rotating 3D machine and part-level
// health. Renders the SAME component the twin uses for the asset's type in a
// second R3F canvas; every material is CLONED before any tint/emissive change
// so the main twin and preview stay pixel-identical. Subsystem banding comes
// from subsystems.js (built on the Pass-3 health selector).
import { useState, useEffect, useRef, useMemo, Suspense, Component as ReactComponent } from 'react'
import { createRoot, events, useFrame } from '@react-three/fiber'
import { Bounds, ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { MACHINE_COMPONENTS } from '../../lib/machineLibrary'
import { CompositeAsset } from '../CompositeAsset'
import { buildInspectorModel, partSubsystem } from '../../lib/subsystems'
import { assetHeadlineParam } from '../../lib/zones'
import { recordParam, getParamHistory } from '../../lib/paramHistory'
import { HealthRing, MiniSpark } from './Charts'
import { T, ty, rel, useDashSnapshot, REDUCED_MOTION, linkStyle } from './tokens'

const BAND3 = { red: new THREE.Color('#F04438'), amber: new THREE.Color('#F79009'), green: new THREE.Color('#12B76A') }
const CHIP = {
  red: { bg: '#FEF3F2', fg: '#B42318', label: 'Critical' },
  amber: { bg: '#FFFAEB', fg: '#B54708', label: 'Attention' },
  green: { bg: '#F2F4F7', fg: '#667085', label: 'Normal' },
}

// walk a mesh's ancestor names to its owning subsystem
function subsystemForMesh(node, type, singleBody) {
  if (singleBody) return 'Hull/Body'
  let n = node
  while (n) {
    if (n.name) { const sub = partSubsystem(n.name, type); if (sub) return sub }
    n = n.parent
  }
  return 'Structure'
}

// inside-canvas layer: incremental material cloning + registry, emissive pulse
function StageAsset({ obj, typeDef, bandBySub, isolate, singleBody, registryRef, onRegistry }) {
  const groupRef = useRef()
  const Comp = MACHINE_COMPONENTS[obj.type] ?? (typeDef ? CompositeAsset : null)
  useFrame(({ clock }) => {
    const g = groupRef.current
    if (!g) return
    let added = false
    g.traverse((n) => {
      if (n.isMesh && n.material && !n.userData.__insp) {
        const mats = (Array.isArray(n.material) ? n.material : [n.material]).map((m) => {
          const c = m.clone()
          c.userData.__base = c.color ? c.color.clone() : null
          c.userData.__baseOpacity = c.opacity
          c.userData.__baseTransparent = c.transparent
          return c
        })
        n.material = Array.isArray(n.material) ? mats : mats[0]
        n.userData.__insp = subsystemForMesh(n, obj.type, singleBody)
        registryRef.current.push({ sub: n.userData.__insp, mats })
        added = true
      }
    })
    if (added) onRegistry()
    // emissive pulse on problem subsystems (both modes); static under reduced motion
    const osc = REDUCED_MOTION ? 0.3 : 0.15 + (Math.sin(clock.elapsedTime * (Math.PI * 2 / 1.6)) * 0.5 + 0.5) * 0.3
    for (const e of registryRef.current) {
      const band = bandBySub.get(e.sub)
      if (band !== 'red' && band !== 'amber') continue
      for (const m of e.mats) {
        if (!m.emissive) continue
        m.emissive.copy(BAND3[band])
        m.emissiveIntensity = osc
      }
    }
  })
  if (!Comp) return null
  return (
    <group ref={groupRef}>
      <Comp typeDef={typeDef} config={obj.config || {}} status={obj.status || 'running'} objId={obj.id} />
    </group>
  )
}

// zoom clamp 0.6×–2× of the Bounds fit distance, measured once after fit
function ZoomClamp({ controlsRef }) {
  useEffect(() => {
    const t = setTimeout(() => {
      const c = controlsRef.current
      if (!c) return
      const d0 = c.object.position.distanceTo(c.target)
      if (Number.isFinite(d0) && d0 > 0.1) { c.minDistance = d0 * 0.6; c.maxDistance = d0 * 2 }
    }, 700)
    return () => clearTimeout(t)
  }, [controlsRef])
  return null
}

function StageRoot({ children }) {
  const hostRef = useRef(null)
  const rootRef = useRef(null)
  useEffect(() => {
    const host = hostRef.current
    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    host.appendChild(canvas)
    const root = createRoot(canvas)
    rootRef.current = root
    const configure = () => {
      const r = host.getBoundingClientRect()
      root.configure({
        events,
        dpr: Math.min(2, window.devicePixelRatio || 1),
        size: { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)), top: r.top, left: r.left },
        gl: { antialias: true },
        camera: { fov: 40, position: [7, 5, 9] },
        shadows: false,
      })
      root.render(rootRef.currentChildren ?? children)
    }
    configure()
    const ro = new ResizeObserver(configure)
    ro.observe(host)
    return () => { ro.disconnect(); root.unmount(); canvas.remove(); rootRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (rootRef.current) { rootRef.current.currentChildren = children; rootRef.current.render(children) }
  }, [children])
  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
}

class StageBoundary extends ReactComponent {
  constructor(p) { super(p); this.state = { err: false } }
  static getDerivedStateFromError() { return { err: true } }
  render() { return this.state.err ? this.props.fallback : this.props.children }
}

export function AssetInspector() {
  const dash = useDashboard()
  const id = useDashboard((s) => s.inspectorAssetId)
  const snap = useDashSnapshot()
  const { objects, alerts } = snap
  const customAssetTypes = useSceneStore((s) => s.customAssetTypes)
  const obj = objects[id]
  const typeDef = customAssetTypes?.[obj?.type]
  const model = useMemo(() => buildInspectorModel(objects, alerts, id, typeDef), [objects, alerts, id, typeDef])
  const { row, subsystems, singleBody, worstSub } = model
  const bandBySub = useMemo(() => new Map(subsystems.map((s) => [s.name, s.band])), [subsystems])

  const [isolate, setIsolate] = useState(null)        // subsystem name | null
  const [regVersion, setRegVersion] = useState(0)
  const registryRef = useRef([])
  const controlsRef = useRef()

  // Esc closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') dash.closeAssetInspector() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dash])

  // natural materials everywhere; ONLY warn/critical subsystem parts are
  // tinted toward their band colour (plus the emissive pulse) — healthy parts
  // keep their original look
  useEffect(() => {
    for (const e of registryRef.current) {
      const band = bandBySub.get(e.sub) ?? 'green'
      for (const m of e.mats) {
        if (m.color && m.userData.__base) {
          m.color.copy(m.userData.__base)
          if (band === 'red' || band === 'amber') m.color.lerp(BAND3[band], 0.55)
        }
        const dim = isolate && e.sub !== isolate
        if (dim) { m.transparent = true; m.opacity = 0.12 }
        else { m.transparent = m.userData.__baseTransparent; m.opacity = m.userData.__baseOpacity }
        m.needsUpdate = true
      }
    }
  }, [isolate, bandBySub, regVersion])

  // dispose cloned materials on unmount (geometries are shared — never disposed)
  useEffect(() => () => {
    for (const e of registryRef.current) for (const m of e.mats) m.dispose()
    registryRef.current = []
  }, [])

  // trend: the asset's drill-down series — seed once, then record per snapshot
  const hp = obj ? assetHeadlineParam(obj) : null
  useEffect(() => {
    if (!hp || !id) return
    if (getParamHistory(id, hp.key).length < 8) {
      let v = Number(hp.value) || 1
      for (let i = 0; i < 64; i++) { v = v * (1 + Math.sin(i * 0.7 + id.length) * 0.012 + Math.sin(i * 0.23) * 0.008); recordParam(id, hp.key, v) }
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hp && id) recordParam(id, hp.key, Number(obj?.parameters?.[hp.key]))
  }, [snap.t]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!obj) return null
  const chip = CHIP[row.band]
  const viewInTwin = () => {
    dash.closeAssetInspector()
    dash.openTwin()
    useSceneStore.getState().selectObject(id)
    setTimeout(() => useSceneStore.getState().flyToObject(id), 90)
  }
  const activeAlerts = row.alerts.slice(0, 3)

  return (
    <div className="insp-backdrop" role="dialog" aria-modal="true" aria-label={obj.name || id}
      onClick={dash.closeAssetInspector}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(16,24,40,.45)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', fontFamily: T.font }}>
      <div className="insp-panel" onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(960px, 92vw)', height: 'min(640px, 88vh)', background: '#FFFFFF', borderRadius: 16, border: `1px solid ${T.line}`,
          boxShadow: '0 24px 48px rgba(16,24,40,.18)', display: 'grid', gridTemplateColumns: '54% 46%', overflow: 'hidden', position: 'relative' }}>
        <button onClick={dash.closeAssetInspector} aria-label="Close"
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 3, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: T.ink2, lineHeight: 1, padding: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.ink)} onMouseLeave={(e) => (e.currentTarget.style.color = T.ink2)}>✕</button>

        {/* ── 3D stage ── */}
        <div style={{ minWidth: 0, minHeight: 0, padding: 16 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 12, border: '1px solid #EFF1F4', background: 'linear-gradient(#FAFBFC, #F1F3F6)', overflow: 'hidden' }}>
            <StageBoundary fallback={
              <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                <div style={{ textAlign: 'center', color: '#98A2B3' }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>⚙</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{obj.name || id}</div>
                  <div style={{ fontSize: 12 }}>3D preview unavailable</div>
                </div>
              </div>
            }>
              <StageRoot>
                <>
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[5, 8, 4]} intensity={0.9} />
                  <directionalLight position={[-6, 4, -5]} intensity={0.35} />
                  <Suspense fallback={null}>
                    <Bounds fit clip observe margin={1.2}>
                      <StageAsset obj={{ ...obj, id }} typeDef={typeDef} bandBySub={bandBySub} isolate={isolate}
                        singleBody={singleBody} registryRef={registryRef} onRegistry={() => setRegVersion((v) => v + 1)} />
                    </Bounds>
                    <ContactShadows opacity={0.3} blur={2.5} scale={30} far={12} />
                  </Suspense>
                  <OrbitControls ref={controlsRef} makeDefault enablePan={false}
                    minPolarAngle={0.15 * Math.PI} maxPolarAngle={0.55 * Math.PI} />
                  <ZoomClamp controlsRef={controlsRef} />
                </>
              </StageRoot>
            </StageBoundary>
            {isolate && (
              <button onClick={() => setIsolate(null)} style={{ position: 'absolute', bottom: 10, left: 10, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: '4px 10px', borderRadius: 999, border: `1px solid ${T.line}`, background: '#fff', color: T.ink2, cursor: 'pointer' }}>All parts</button>
            )}
          </div>
        </div>

        {/* ── info column ── */}
        <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 20, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0, paddingRight: 24 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj.name || id}</div>
              <div style={{ fontSize: 12, color: T.ink2 }}>{id} · {obj.type}</div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: chip.bg, color: chip.fg }}>{chip.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <HealthRing health={row.health} band={row.band} halo={row.band === 'red'} size={64} fontSize={20} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.ink2 }}>Overall health</div>
              {worstSub && <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>Worst: {worstSub.name}</div>}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ ...ty.cardTitle, marginBottom: 2 }}>Subsystems</div>
              {subsystems.map((sub) => {
                const canIsolate = !singleBody && sub.name !== 'Operational'
                const sel = isolate === sub.name
                return (
                  <div key={sub.name} onClick={() => canIsolate && setIsolate(sel ? null : sub.name)} className="row-hover"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 30, padding: '2px 4px', borderTop: '1px solid #F2F4F7', cursor: canIsolate ? 'pointer' : 'default', background: sel ? '#F5F8FF' : undefined, borderRadius: sel ? 6 : 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: sub.band === 'red' ? T.bad : sub.band === 'amber' ? T.warn : T.good, opacity: sub.band === 'green' ? 0.5 : 1 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, flexShrink: 0 }}>{sub.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: T.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{sub.note}</span>
                  </div>
                )
              })}
            </div>
            <div>
              <div style={{ ...ty.cardTitle, marginBottom: 2 }}>Active Alerts</div>
              {activeAlerts.length === 0 && <div style={{ fontSize: 12, color: '#98A2B3', padding: '6px 0' }}>No active alerts</div>}
              {activeAlerts.map((a) => (
                <div key={a.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', borderTop: '1px solid #F2F4F7' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: a.severity === 'critical' ? T.bad : T.warn }} />
                  <span style={{ minWidth: 0, fontSize: 12, color: T.ink, lineHeight: 1.35 }}>{a.message}{a.cam ? ` (${a.cam})` : ''}<span style={{ color: T.ink2, whiteSpace: 'nowrap' }}> · {rel(a.since)}</span></span>
                </div>
              ))}
            </div>
            {hp && (
              <div>
                <div style={{ ...ty.cardTitle, marginBottom: 2 }}>Trend</div>
                <div style={{ fontSize: 12, color: T.ink2, marginBottom: 2 }}>{hp.label}{hp.unit ? ` (${hp.unit})` : ''}</div>
                <MiniSpark data={getParamHistory(id, hp.key)} w={380} h={32} />
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={viewInTwin} className="link-twin"
              style={{ flex: 1, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: T.accent, color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1743B3')} onMouseLeave={(e) => (e.currentTarget.style.background = T.accent)}>View in Twin →</button>
            <button onClick={dash.closeAssetInspector} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${T.line}`, background: '#fff', color: T.ink2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
