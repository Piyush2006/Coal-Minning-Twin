import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useDetailsStore } from '../../store/detailsStore'
import { useSceneStore } from '../../store/sceneStore'
import { useStudioStore } from '../../store/studioStore'
import { MACHINE_COMPONENTS } from '../../lib/machineLibrary'
import { CompositeAsset } from '../CompositeAsset'
import { SubComponentsLayer } from '../SubComponentsLayer'
import { getSubComponents, subInstanceValue } from '../../lib/componentSubs'
import { effectiveParamDefs, coerceParameterValue, paramFreqKey } from '../../lib/parameterSchemas'
import { BruceCard } from '../BruceCard'
import { bruceRecommendations } from '../../lib/recommendations'
import { SubTree, PartsTree } from './SubTree'
import { TrendChart, trendAxes } from './TrendChart'
import { FONT, C, R, glass, SHADOW } from '../../ui/theme'

const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.md, padding: '10px 12px', boxShadow: SHADOW.card }
const inp = { width: '100%', padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: R.sm, fontFamily: FONT, fontSize: 12.5, color: C.text, background: C.surface, outline: 'none' }
const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : Number(v.toFixed(2))) : v)

// ── 3D model (rotating); selected instance highlighted ──
function RootModel({ obj, customTypes, subs, focus, onPick, highlightId }) {
  const Built = MACHINE_COMPONENTS[obj.type]
  return (
    <group>
      {Built
        ? <Built status={obj.status} state={obj.state} config={obj.config} />
        : <CompositeAsset typeDef={customTypes[obj.type]} config={obj.config} status={obj.status} highlightId={highlightId} />}
      {subs.map(d => (
        <SubComponentsLayer key={d.id} obj={obj} def={d} pickable selectedIndex={focus?.subId === d.id ? focus.index : -1} onPick={onPick} />
      ))}
    </group>
  )
}
function DetailsCanvas({ obj, customTypes, subs, focus, onPick, highlightId }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [9, 6, 11], fov: 40, near: 0.25, far: 300 }}
      gl={{ logarithmicDepthBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
      <color attach="background" args={['#eef1f6']} />
      <ambientLight intensity={0.5} color="#d8eaf8" />
      <hemisphereLight args={['#ffffff', '#b8c2cc', 0.4]} />
      <directionalLight position={[12, 20, 14]} intensity={2.2} color="#fff8f2" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-14, 12, -10]} intensity={0.5} color="#cce4ff" />
      <Suspense fallback={null}><Environment preset="warehouse" /></Suspense>
      <gridHelper args={[60, 60, '#c4cdd8', '#dfe5ec']} />
      <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={60} blur={2.6} far={30} resolution={512} color="#1a2433" />
      <RootModel obj={obj} customTypes={customTypes} subs={subs} focus={focus} onPick={onPick} highlightId={highlightId} />
      <OrbitControls makeDefault enablePan autoRotate={!highlightId && !focus} autoRotateSpeed={0.6} target={[0, 1.2, 0]} minDistance={3} maxDistance={80} />
    </Canvas>
  )
}

function ReadParam({ label, value, unit, note }) {
  return (
    <div style={card}>
      <p style={{ fontSize: 11, color: C.text3, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{fmt(value)} <span style={{ fontSize: 11.5, fontWeight: 500, color: C.text3 }}>{unit}</span></p>
      {note && <p style={{ fontSize: 10.5, color: C.text3, marginTop: 3 }}>{note}</p>}
    </div>
  )
}
function EditParam({ def, value, onChange }) {
  const ranged = def.min != null && def.max != null
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: ranged ? 4 : 0 }}>
        <span style={{ fontSize: 11, color: C.text3 }}>{def.label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{fmt(value)} <span style={{ fontSize: 11, color: C.text3 }}>{def.unit}</span></span>
      </div>
      {ranged
        ? <input type="range" min={def.min} max={def.max} step={(def.max - def.min) / 100} value={value} onChange={e => onChange(coerceParameterValue(def, e.target.value))} style={{ width: '100%' }} />
        : <input type="number" value={value} onChange={e => onChange(coerceParameterValue(def, e.target.value))} style={{ ...inp, marginTop: 4 }} />}
    </div>
  )
}

function StateBadge({ def, stateKey }) {
  const s = (def.states || []).find(x => x.key === stateKey)
  if (!s) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: R.pill, background: 'rgba(0,0,0,0.04)', border: `1px solid ${C.line}`, fontSize: 12, fontWeight: 600, color: C.text }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />{s.label}
    </span>
  )
}

export function ComponentDetails() {
  const { objId, sel, close, selectRoot, selectGroup, selectInstance } = useDetailsStore()
  const obj = useSceneStore(s => (objId ? s.objects[objId] : null))
  const customTypes = useSceneStore(s => s.customAssetTypes)
  const setSubOverride = useSceneStore(s => s.setSubOverride)
  const editMode = useSceneStore(s => s.editMode)   // values are editable only in build mode
  const buildCopyOf = useStudioStore(s => s.buildCopyOf)

  const [selPartId, setSelPartId] = useState(null)
  // Clear any selected part whenever the sub-assembly selection changes.
  useEffect(() => { setSelPartId(null) }, [sel?.subId, sel?.index])
  useEffect(() => { if (!objId || !obj) close() }, [objId, obj, close])
  if (!obj) return null

  const subs = getSubComponents(obj.type, customTypes)
  const parts = customTypes[obj.type]?.parts || []          // custom components: the nested parts tree
  const assetName = obj.name || customTypes[obj.type]?.label || obj.type
  const selDef = sel ? subs.find(d => d.id === sel.subId) : null
  const isInstance = selDef && sel.index != null
  const focus = isInstance ? { subId: sel.subId, index: sel.index } : null
  const instVal = isInstance ? subInstanceValue(selDef, sel.index, obj) : null
  const selPart = selPartId ? parts.find(p => p.id === selPartId) : null
  const assetParams = effectiveParamDefs(obj, customTypes)
  const showChart = selDef && trendAxes(selDef)[0]
  const selectPart = (id) => { selectRoot(); setSelPartId(id) }   // selecting a part clears sub selection
  const headerLabel = selPart ? (selPart.label || 'Part') : isInstance ? `${selDef.label} #${sel.index + 1}` : (selDef ? selDef.label : assetName)

  return (
    <div style={{ width: '100vw', height: '100vh', background: C.bg, color: C.text, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${C.line}`, ...glass }}>
        <button onClick={close} title="Back to the scene"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: C.surface, color: C.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>← Back</button>
        <span style={{ width: 1, height: 20, background: C.line }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{assetName}</span>
        {selDef && <span style={{ fontSize: 12.5, color: C.text3 }}>/ {headerLabel}</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => buildCopyOf(obj.type)} title="Open in the Component Studio to extend it"
          style={{ padding: '8px 16px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>Build</button>
        <button onClick={close} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: 'transparent', cursor: 'pointer', color: C.text2, fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* LEFT — hierarchy tree only */}
        <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${C.line}`, background: C.surface, overflowY: 'auto', padding: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3, margin: '2px 0 8px 6px' }}>Structure</p>
          <SubTree obj={obj} subs={subs} sel={!selPart ? sel : { subId: '__none__' }} rootLabel={assetName}
            onRoot={() => { selectRoot(); setSelPartId(null) }} onGroup={(id) => { selectGroup(id); setSelPartId(null) }} onInstance={(id, i) => { selectInstance(id, i); setSelPartId(null) }} />
          {parts.length > 0 && <PartsTree parts={parts} customTypes={customTypes} selId={selPartId} onSelect={selectPart} />}
        </div>

        {/* CENTER — rotating model */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {!editMode && <BruceCard title={assetName} recs={bruceRecommendations(obj)} />}
          <DetailsCanvas obj={obj} customTypes={customTypes} subs={subs} focus={focus} onPick={selectInstance} highlightId={selPartId} />
        </div>

        {/* RIGHT — parameters (read-only in view mode) + trend chart */}
        <div style={{ width: 380, flexShrink: 0, borderLeft: `1px solid ${C.line}`, background: C.surface, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>{headerLabel}</p>

          {/* parameters */}
          {selPart ? (
            (selPart.parameters || []).length > 0
              ? (selPart.parameters || []).map(d => <ReadParam key={d.key} label={d.label} value={d.default} unit={d.unit} />)
              : <p style={{ fontSize: 12.5, color: C.text3 }}>This part has no parameters.</p>
          ) : !selDef && <>
            {assetParams.map(d => {
              const manual = paramFreqKey(obj, d.key, customTypes) === 'manual'
              const ts = obj.paramTimes?.[d.key]
              const note = manual ? (ts ? `Manual · entered ${new Date(ts).toLocaleTimeString()}` : 'Manual entry') : null
              return <ReadParam key={d.key} label={d.label} value={obj.parameters?.[d.key] ?? d.default} unit={d.unit} note={note} />
            })}
          </>}
          {selDef && !isInstance && (
            <p style={{ fontSize: 12.5, color: C.text2 }}>{selDef.count} instances. Expand the group in the tree (or click the chart) to inspect one.</p>
          )}
          {isInstance && <>
            {selDef.states?.length > 0 && (
              editMode ? (
                <div style={card}>
                  <p style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>State</p>
                  <select value={instVal.state || ''} onChange={e => setSubOverride(obj.id, selDef.id, sel.index, { state: e.target.value })} style={inp}>
                    {selDef.states.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              ) : <div><StateBadge def={selDef} stateKey={instVal.state} /></div>
            )}
            {(selDef.parameters || []).map(d => (
              editMode
                ? <EditParam key={d.key} def={d} value={instVal.params[d.key] ?? d.default} onChange={v => setSubOverride(obj.id, selDef.id, sel.index, { params: { [d.key]: v } })} />
                : <ReadParam key={d.key} label={d.label} value={instVal.params[d.key] ?? d.default} unit={d.unit} />
            ))}
          </>}

          {/* trend chart */}
          {showChart && (
            <div style={{ marginTop: 4 }}>
              <div style={card}><TrendChart obj={obj} def={selDef} selIndex={isInstance ? sel.index : null} /></div>
              <p style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5, marginTop: 8 }}>Each point is one {selDef.label.replace(/s$/, '').toLowerCase()}, coloured by its state.{selDef.chart?.threshold ? ' Points in the red band are below the minimum healthy current — the degraded, end-of-life anodes flagged Spent.' : ''}{isInstance ? ' The selected one is ringed.' : ' Click a node in the tree to highlight it.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
