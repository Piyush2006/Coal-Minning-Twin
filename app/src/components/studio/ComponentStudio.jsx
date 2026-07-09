import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStudioStore } from '../../store/studioStore'
import { useSceneStore } from '../../store/sceneStore'
import { PartVisual } from '../CompositeAsset'
import { SubComponentsLayer } from '../SubComponentsLayer'
import { StatusBeacon } from '../StatusBeacon'
import { MACHINE_LIBRARY } from '../../lib/machineLibrary'
import { GEOMETRY_DEFS, GEOMETRIES, ANIMATIONS, PORT_TYPES, PORT_DIRECTIONS, defaultDims, validateComponentSpec } from '../../lib/componentSpec'
import { FREQUENCIES } from '../../lib/parameterSchemas'
import { downloadJSON } from '../../lib/twinSpec'
import { ChatPanel } from '../ai/ChatPanel'
import { StudioTree } from './StudioTree'
import { nanoid } from 'nanoid'
import { FONT, C, R, glass, SHADOW } from '../../ui/theme'

const SUB_LAYOUTS = ['doubleRow', 'perimeter', 'grid', 'ring', 'row']

const PORT_COLOR = { product: '#00c8ff', conveyor: '#00ffcc', utility: '#ffaa00', co2: '#88ffaa', power: '#ff7ad9' }

// Components that can be NESTED as a building block: all built-ins + custom types
// (minus the one being edited, to avoid self-reference).
const BUILTIN_REFS = MACHINE_LIBRARY.flatMap(c => c.items.map(it => ({ value: it.type, label: it.label })))
const refOptions = (editingId) => [
  ...BUILTIN_REFS,
  ...Object.values(useSceneStore.getState().customAssetTypes).filter(ct => ct.id !== editingId).map(ct => ({ value: ct.id, label: ct.label })),
]
const refLabel = (ref) => BUILTIN_REFS.find(o => o.value === ref)?.label || useSceneStore.getState().customAssetTypes[ref]?.label || ref
const FIELD_TYPES = ['number', 'boolean', 'select', 'color', 'text']
const SEVERITIES = ['ok', 'warn', 'down']

// ── small styled inputs ──────────────────────────────────────────────────────
const inp = { width: '100%', padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: R.sm, fontFamily: FONT, fontSize: 12.5, color: C.text, background: C.surface, outline: 'none' }
const lbl = { fontSize: 11, fontWeight: 600, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.3 }
const Row = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
    <span style={{ ...lbl, width: 64, flexShrink: 0 }}>{label}</span>{children}
  </div>
)
const Num = ({ value, onChange, step = 0.1, w }) => (
  <input type="number" step={step} value={value ?? 0} onChange={e => onChange(Number(e.target.value))}
    style={{ ...inp, width: w ?? 64, textAlign: 'right' }} />
)
const Vec3 = ({ value = [0, 0, 0], onChange, step = 0.1 }) => (
  <div style={{ display: 'flex', gap: 5, flex: 1 }}>
    {[0, 1, 2].map(i => (
      <input key={i} type="number" step={step} value={value[i] ?? 0}
        onChange={e => { const v = [...value]; v[i] = Number(e.target.value); onChange(v) }}
        style={{ ...inp, textAlign: 'right', padding: '6px 6px' }} />
    ))}
  </div>
)
const btn = (on) => ({ padding: '6px 10px', borderRadius: R.sm, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600,
  border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : 'transparent', color: on ? '#fff' : C.text2 })
const ghost = { padding: '6px 10px', border: `1px dashed ${C.lineStrong}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600 }

// ── live 3D preview ──────────────────────────────────────────────────────────
function PortDots({ ports, sel }) {
  return ports.map(p => (
    <mesh key={p.id} position={p.offset || [0, 0, 0]}>
      <sphereGeometry args={[p.id === sel ? 0.22 : 0.16, 16, 16]} />
      <meshStandardMaterial color={PORT_COLOR[p.type] || '#fff'} emissive={PORT_COLOR[p.type] || '#fff'} emissiveIntensity={p.id === sel ? 1.4 : 0.5} />
    </mesh>
  ))
}
// One node in the editable preview, rendered as a TREE so a group's transform
// cascades to its children. Click to select; a gizmo moves/rotates/scales the
// selected node and writes its LOCAL transform back to the draft.
function EditableNode({ part, parts, idSet, selPart, mode, onSelect, cfg, orbitRef }) {
  const ref = useRef()      // THIS part's transform group — the gizmo attaches here directly
  const tcRef = useRef()    // the TransformControls instance
  const selected = part.id === selPart

  // Commit the LOCAL transform when a drag ENDS (and freeze the camera mid-drag).
  // We attach the gizmo to `ref` via the `object` prop — NOT by wrapping children —
  // so the dragged object IS this group and `ref.current` holds the real result.
  useEffect(() => {
    if (!selected) return
    const c = tcRef.current
    if (!c) return
    const onDrag = (e) => {
      if (orbitRef.current) orbitRef.current.enabled = !e.value
      if (!e.value && ref.current) {
        const o = ref.current
        useStudioStore.getState().updatePart(part.id, {
          position: o.position.toArray(),
          rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
          scale: o.scale.toArray(),
        })
      }
    }
    c.addEventListener('dragging-changed', onDrag)
    return () => c.removeEventListener('dragging-changed', onDrag)
  }, [selected, part.id]) // eslint-disable-line

  const kids = parts.filter(p => (p.parentId || null) === part.id)
  const childNodes = kids.map(c => (
    <EditableNode key={c.id} part={c} parts={parts} idSet={idSet} selPart={selPart} mode={mode} onSelect={onSelect} cfg={cfg} orbitRef={orbitRef} />
  ))
  // Logical (general) part: non-visual passthrough — no transform, not clickable.
  if (part.kind === 'logical') return <group>{childNodes}</group>

  return (
    <>
      <group ref={ref} position={part.position} rotation={part.rotation} scale={part.scale}
        onClick={(e) => { e.stopPropagation(); onSelect(part.id) }}>
        {part.kind !== 'group' && <PartVisual part={part} config={cfg} status="running" />}
        {childNodes}
      </group>
      {selected && <TransformControls ref={tcRef} object={ref} mode={mode} size={0.8} />}
    </>
  )
}

function Preview({ draft, selPart, selPort, mode, selectPart, onMissed }) {
  const orbitRef = useRef()
  const cfg = useMemo(() => {
    const c = { enabled: true }
    for (const f of draft.config || []) c[f.key] = f.default
    return c
  }, [draft.config])
  const idSet = new Set(draft.parts.map(p => p.id))
  const tops = draft.parts.filter(p => { const pid = p.parentId || null; return pid === null || !idSet.has(pid) })
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [6, 5, 7.5], fov: 42, near: 0.25, far: 200 }}
      onPointerMissed={onMissed}
      gl={{ logarithmicDepthBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
      <color attach="background" args={['#eef1f6']} />
      <ambientLight intensity={0.5} color="#d8eaf8" />
      <hemisphereLight args={['#ffffff', '#b8c2cc', 0.4]} />
      <directionalLight position={[10, 18, 12]} intensity={2.2} color="#fff8f2" castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-12, 12, -8]} intensity={0.5} color="#cce4ff" />
      <Suspense fallback={null}><Environment preset="warehouse" /></Suspense>
      <gridHelper args={[40, 40, '#c4cdd8', '#dfe5ec']} position={[0, 0, 0]} />
      <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={40} blur={2.4} far={20} resolution={512} color="#1a2433" />
      {tops.map(p => (
        <EditableNode key={p.id} part={p} parts={draft.parts} idSet={idSet} selPart={selPart} mode={mode} onSelect={selectPart} cfg={cfg} orbitRef={orbitRef} />
      ))}
      {/* sub-assemblies (anodes, windows, …) so the preview matches the View */}
      {(draft.subComponents || []).map(d => <SubComponentsLayer key={d.id} def={d} />)}
      {draft.beacon && <StatusBeacon status="running" position={draft.beacon.offset || [0, 2.4, 0]} />}
      <PortDots ports={draft.ports || []} sel={selPort} />
      <OrbitControls ref={orbitRef} makeDefault enablePan target={[0, 1, 0]} minDistance={2} maxDistance={40} />
    </Canvas>
  )
}

const miniBtn = { width: 20, height: 20, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: C.text3, fontSize: 13, lineHeight: 1 }

// ── inspector tabs (right) ─────────────────────────────────────────────────────
// One per-node parameter — mirrors the main-screen ParamRow: collapsed readout
// with a frequency tag + UNS dot, expanding to edit label/unit/value/frequency/UNS.
function PartParamRow({ part, p }) {
  const { updatePartParam, removePartParam } = useStudioStore()
  const [editing, setEditing] = useState(false)
  const freqKey = p.freq || '30s'
  const freqLabel = FREQUENCIES.find(f => f.key === freqKey)?.label || freqKey

  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.label}
        {p.unit && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.text3 }}>{p.unit}</span>}
        {p.topic && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: C.accent }}>● UNS</span>}
        <span style={{ marginLeft: 6, fontSize: 10, color: freqKey === 'manual' ? C.accent : C.text3 }}>{freqKey === 'manual' ? '✎ manual' : freqLabel}</span>
      </span>
      <button onClick={() => setEditing(true)} title="Edit" style={{ ...miniBtn, color: C.text3 }}>✎</button>
      <button onClick={() => removePartParam(part.id, p.key)} title="Delete" style={{ ...miniBtn, color: C.bad }}>×</button>
    </div>
  )

  return (
    <div style={{ padding: '10px 0', borderBottom: `1px solid ${C.line}`, background: 'rgba(10,132,255,0.04)' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={p.label} onChange={e => updatePartParam(part.id, p.key, { label: e.target.value })} placeholder="Label" style={{ ...inp, flex: 1 }} />
        <input value={p.unit || ''} onChange={e => updatePartParam(part.id, p.key, { unit: e.target.value })} placeholder="unit" style={{ ...inp, width: 56 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ ...lbl, width: 64 }}>Value</span><Num value={p.default ?? 0} onChange={v => updatePartParam(part.id, p.key, { default: v })} w={90} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ ...lbl, width: 64 }}>Frequency</span>
        <select value={freqKey} onChange={e => updatePartParam(part.id, p.key, { freq: e.target.value })} style={{ ...inp, flex: 1 }}>
          {FREQUENCIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ ...lbl, width: 64, color: p.topic ? C.accent : C.text3 }}>UNS</span>
        <input value={p.topic || ''} placeholder="topic path… e.g. plant/line/dev/value/lastdp"
          onChange={e => updatePartParam(part.id, p.key, { topic: e.target.value })}
          style={{ ...inp, flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 11, border: `1px solid ${p.topic ? C.accent : C.line}` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setEditing(false)} style={{ padding: '4px 14px', border: 'none', borderRadius: 6, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600 }}>Done</button>
      </div>
    </div>
  )
}

function PartParams({ part }) {
  const { addPartParam } = useStudioStore()
  const params = part.parameters || []
  return (
    <Section title="Parameters">
      {params.length === 0 && <p style={{ fontSize: 12, color: C.text3, margin: '0 0 8px' }}>No parameters. Add telemetry/data fields for this node.</p>}
      {params.map(p => <PartParamRow key={p.key} part={part} p={p} />)}
      <button onClick={() => addPartParam(part.id, 'Parameter', '')} style={{ ...ghost, width: '100%', marginTop: 8 }}>＋ Add parameter</button>
    </Section>
  )
}

// The "Settings" tab — kind-specific geometry/transform/material/animation/ref.
function PartSettings({ part }) {
  const { editingId, updatePart } = useStudioStore()
  if (part.kind === 'logical') {
    return <p style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5 }}>A general part is non-visual — it holds data/parameters and organises the hierarchy, with no geometry in the scene.</p>
  }
  if (part.kind === 'group') {
    return (
      <div>
        <p style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5, margin: '0 0 12px' }}>A group is a folder — its transform applies to every child node.</p>
        <Section title="Transform">
          <Row label="Position"><Vec3 value={part.position} onChange={v => updatePart(part.id, { position: v })} /></Row>
          <Row label="Rotation"><Vec3 value={part.rotation} onChange={v => updatePart(part.id, { rotation: v })} step={0.05} /></Row>
          <Row label="Scale"><Vec3 value={part.scale} onChange={v => updatePart(part.id, { scale: v })} step={0.05} /></Row>
        </Section>
      </div>
    )
  }
  if (part.kind === 'component') {
    const opts = refOptions(editingId)
    return (
      <div>
        <Section title="Component reference">
          <Row label="Source">
            <select value={part.ref} onChange={e => updatePart(part.id, { ref: e.target.value })} style={inp}>
              {!opts.find(o => o.value === part.ref) && <option value={part.ref}>{refLabel(part.ref)}</option>}
              {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Row>
          <p style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5, margin: '2px 0 0' }}>A nested component renders as-is; position it with the gizmo and build primitives around it.</p>
        </Section>
        <Section title="Transform">
          <Row label="Position"><Vec3 value={part.position} onChange={v => updatePart(part.id, { position: v })} /></Row>
          <Row label="Rotation"><Vec3 value={part.rotation} onChange={v => updatePart(part.id, { rotation: v })} step={0.05} /></Row>
          <Row label="Scale"><Vec3 value={part.scale} onChange={v => updatePart(part.id, { scale: v })} step={0.05} /></Row>
        </Section>
      </div>
    )
  }
  const dims = part.dims || {}
  const setDim = (k, v) => updatePart(part.id, { dims: { ...dims, [k]: v } })
  const setMat = (k, v) => updatePart(part.id, { material: { ...part.material, [k]: v } })
  const m = part.material || {}
  const anim = part.animate?.kind || 'none'
  return (
    <div>
      <Section title="Geometry">
        <Row label="Shape">
          <select value={part.geometry} onChange={e => { const g = e.target.value; updatePart(part.id, { geometry: g, dims: defaultDims(g) }) }} style={inp}>
            {GEOMETRIES.map(g => <option key={g} value={g}>{GEOMETRY_DEFS[g].label}</option>)}
          </select>
        </Row>
        {GEOMETRY_DEFS[part.geometry].dims.map(([k]) => (
          <Row key={k} label={k}><Num value={dims[k]} onChange={v => setDim(k, v)} w={80} /></Row>
        ))}
      </Section>
      <Section title="Transform">
        <Row label="Position"><Vec3 value={part.position} onChange={v => updatePart(part.id, { position: v })} /></Row>
        <Row label="Rotation"><Vec3 value={part.rotation} onChange={v => updatePart(part.id, { rotation: v })} step={0.05} /></Row>
        <Row label="Scale"><Vec3 value={part.scale} onChange={v => updatePart(part.id, { scale: v })} step={0.05} /></Row>
      </Section>
      <Section title="Material">
        <Row label="Color"><input type="color" value={m.color || '#b0c4d0'} onChange={e => setMat('color', e.target.value)} style={{ ...inp, padding: 2, height: 30, width: 56 }} /></Row>
        <Row label="Metal"><Num value={m.metalness ?? 0.6} onChange={v => setMat('metalness', Math.max(0, Math.min(1, v)))} step={0.05} /></Row>
        <Row label="Rough"><Num value={m.roughness ?? 0.35} onChange={v => setMat('roughness', Math.max(0, Math.min(1, v)))} step={0.05} /></Row>
      </Section>
      <Section title="Animation">
        <Row label="Type">
          <select value={anim} onChange={e => { const k = e.target.value; updatePart(part.id, { animate: k === 'none' ? null : { kind: k, speedKey: part.animate?.speedKey || 'speed' } }) }} style={inp}>
            {ANIMATIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Row>
        {anim !== 'none' && (
          <Row label="Speed key">
            <input value={part.animate?.speedKey || ''} placeholder="config key (e.g. speed)"
              onChange={e => updatePart(part.id, { animate: { ...part.animate, speedKey: e.target.value || undefined } })} style={inp} />
          </Row>
        )}
      </Section>
    </div>
  )
}

// The "Rules" tab — glow this node when one of its own parameters crosses a threshold.
const RULE_OPS = ['>', '>=', '<', '<=', '==', '!=']
function PartRules({ part }) {
  const updatePart = useStudioStore(s => s.updatePart)
  const params = part.parameters || []
  const rules = part.rules || []
  const setRules = (next) => updatePart(part.id, { rules: next })
  const add = () => setRules([...rules, { id: `rule_${nanoid(4)}`, enabled: true, parameter: params[0]?.key || '', operator: '>', value: 0, color: '#ff3b30' }])
  const update = (i, patch) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <Section title="Rules (glow on threshold)">
      {params.length === 0
        ? <p style={{ fontSize: 12, color: C.text3, margin: '0 0 8px' }}>Add a parameter first (Parameters tab) — rules trigger on a node's own parameter.</p>
        : <>
            {rules.length === 0 && <p style={{ fontSize: 12, color: C.text3, margin: '0 0 8px' }}>No rules. Glow this node when a parameter crosses a value.</p>}
            {rules.map((r, i) => (
              <div key={r.id || i} style={{ padding: 8, marginBottom: 8, borderRadius: R.sm, border: `1px solid ${C.line}` }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={r.parameter} onChange={e => update(i, { parameter: e.target.value })} style={{ ...inp, flex: 1, minWidth: 90 }}>
                    {params.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <select value={r.operator} onChange={e => update(i, { operator: e.target.value })} style={{ ...inp, width: 56 }}>
                    {RULE_OPS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <Num value={r.value ?? 0} onChange={v => update(i, { value: v })} w={64} />
                  <input type="color" value={r.color || '#ff3b30'} onChange={e => update(i, { color: e.target.value })} style={{ ...inp, padding: 2, height: 28, width: 40 }} />
                  <button onClick={() => setRules(rules.filter((_, j) => j !== i))} style={{ ...miniBtn, color: C.bad }}>×</button>
                </div>
              </div>
            ))}
            <button onClick={add} style={{ ...ghost, width: '100%' }}>＋ Add rule</button>
          </>}
    </Section>
  )
}

function PartInspector() {
  const selPart = useStudioStore(s => s.selPart)
  const part = useStudioStore(s => s.draft?.parts.find(p => p.id === selPart))
  const [ptab, setPtab] = useState('settings')
  if (!part) return <Empty>Select a node in the hierarchy.</Empty>
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, margin: '0 0 14px' }}>
        {[['settings', 'Settings'], ['parameters', 'Parameters'], ['rules', 'Rules']].map(([k, label]) => (
          <button key={k} onClick={() => setPtab(k)} style={{ ...btn(ptab === k), flex: 1, padding: '6px 0', fontSize: 11.5 }}>{label}</button>
        ))}
      </div>
      {ptab === 'settings' && <PartSettings part={part} />}
      {ptab === 'parameters' && <PartParams part={part} />}
      {ptab === 'rules' && <PartRules part={part} />}
    </div>
  )
}

function PortsInspector() {
  const { draft, selPort, addPort, updatePort, removePort, selectPort } = useStudioStore()
  return (
    <div>
      <Section title="Ports">
        {(draft.ports || []).length === 0 && <p style={{ fontSize: 12, color: C.text3, margin: '0 0 8px' }}>No ports. Ports let this component snap & connect to others.</p>}
        {(draft.ports || []).map(p => {
          const on = p.id === selPort
          return (
            <div key={p.id} onClick={() => selectPort(p.id)} style={{ padding: 8, marginBottom: 8, borderRadius: R.sm, border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : 'transparent' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <select value={p.type} onChange={e => updatePort(p.id, { type: e.target.value })} style={{ ...inp, flex: 1 }}>{PORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <select value={p.direction} onChange={e => updatePort(p.id, { direction: e.target.value })} style={{ ...inp, flex: 1 }}>{PORT_DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select>
                <button onClick={e => { e.stopPropagation(); removePort(p.id) }} style={{ ...miniBtn, color: C.bad }}>×</button>
              </div>
              <Vec3 value={p.offset} onChange={v => updatePort(p.id, { offset: v })} />
            </div>
          )
        })}
        <button onClick={addPort} style={{ ...ghost, width: '100%' }}>＋ Add port</button>
      </Section>
    </div>
  )
}

// generic field-def list editor (config + parameters)
function SchemaEditor({ which }) {
  const { draft, setSchema } = useStudioStore()
  const defs = draft[which] || []
  const update = (i, patch) => setSchema(which, defs.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const add = () => setSchema(which, [...defs, which === 'parameters'
    ? { key: `param${defs.length + 1}`, label: 'New Parameter', unit: '', default: 0, min: 0, max: 100 }
    : { key: `field${defs.length + 1}`, label: 'New Field', type: 'number', default: 0, min: 0, max: 10, step: 0.1 }])
  const remove = (i) => setSchema(which, defs.filter((_, j) => j !== i))
  return (
    <Section title={which === 'parameters' ? 'Parameters (telemetry)' : 'Settings'}>
      {defs.length === 0 && <p style={{ fontSize: 12, color: C.text3, margin: '0 0 8px' }}>No {which === 'parameters' ? 'parameters' : 'settings'} yet.</p>}
      {defs.map((d, i) => (
        <div key={i} style={{ padding: 8, marginBottom: 8, borderRadius: R.sm, border: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={d.key} onChange={e => update(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="key" style={{ ...inp, flex: 1, fontFamily: 'ui-monospace, monospace' }} />
            <button onClick={() => remove(i)} style={{ ...miniBtn, color: C.bad }}>×</button>
          </div>
          <input value={d.label} onChange={e => update(i, { label: e.target.value })} placeholder="Label" style={{ ...inp, marginBottom: 6 }} />
          {which === 'config' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <select value={d.type} onChange={e => update(i, { type: e.target.value })} style={{ ...inp, flex: 1 }}>{FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...lbl }}>default</span>
            {d.type === 'boolean'
              ? <input type="checkbox" checked={!!d.default} onChange={e => update(i, { default: e.target.checked })} />
              : d.type === 'color'
                ? <input type="color" value={d.default || '#9fb2c4'} onChange={e => update(i, { default: e.target.value })} style={{ ...inp, padding: 2, height: 28, width: 48 }} />
                : <input value={d.default ?? ''} onChange={e => update(i, { default: d.type === 'number' || which === 'parameters' ? Number(e.target.value) : e.target.value })} style={{ ...inp, width: 80 }} />}
            {(which === 'parameters' || d.type === 'number') && <>
              <span style={lbl}>min</span><Num value={d.min ?? 0} onChange={v => update(i, { min: v })} w={56} />
              <span style={lbl}>max</span><Num value={d.max ?? 100} onChange={v => update(i, { max: v })} w={56} />
            </>}
            {which === 'parameters' && <input value={d.unit || ''} onChange={e => update(i, { unit: e.target.value })} placeholder="unit" style={{ ...inp, width: 56 }} />}
          </div>
        </div>
      ))}
      <button onClick={add} style={{ ...ghost, width: '100%' }}>＋ Add {which === 'parameters' ? 'parameter' : 'field'}</button>
    </Section>
  )
}

function StatesInspector() {
  const { draft, patch } = useStudioStore()
  const custom = Array.isArray(draft.states)
  const setStates = (arr) => patch({ states: arr })
  const states = draft.states || []
  const update = (i, p) => setStates(states.map((s, j) => (j === i ? { ...s, ...p } : s)))
  return (
    <Section title="States">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.text2, marginBottom: 10 }}>
        <input type="checkbox" checked={custom} onChange={e => patch({ states: e.target.checked ? [{ key: 'running', label: 'Running', color: '#00dd66', severity: 'ok' }] : null })} />
        Custom states (otherwise: Running / Idle / Fault)
      </label>
      {custom && <>
        {states.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input value={s.key} onChange={e => update(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="key" style={{ ...inp, flex: 1, fontFamily: 'ui-monospace, monospace' }} />
            <input value={s.label} onChange={e => update(i, { label: e.target.value })} placeholder="Label" style={{ ...inp, flex: 1 }} />
            <input type="color" value={s.color || '#00dd66'} onChange={e => update(i, { color: e.target.value })} style={{ ...inp, padding: 2, height: 28, width: 40 }} />
            <select value={s.severity} onChange={e => update(i, { severity: e.target.value })} style={{ ...inp, width: 70 }}>{SEVERITIES.map(x => <option key={x} value={x}>{x}</option>)}</select>
            <button onClick={() => setStates(states.filter((_, j) => j !== i))} style={{ ...miniBtn, color: C.bad }}>×</button>
          </div>
        ))}
        <button onClick={() => setStates([...states, { key: `state${states.length + 1}`, label: 'State', color: '#8aa0b4', severity: 'ok' }])} style={{ ...ghost, width: '100%' }}>＋ Add state</button>
      </>}
    </Section>
  )
}

// Declarative sub-assemblies (e.g. 40 anodes). Define count + layout + a per-instance
// param schema here; per-instance values are derived and edited in the Details view.
// Edit a single sub-assembly def (count + layout + per-instance params). `onRemove`
// optional (shown in the root list; hidden in the focused per-node view).
function SubCard({ s, onRemove }) {
  const patch = useStudioStore(st => st.patch)
  const subs = useStudioStore(st => st.draft.subComponents) || []
  const update = (p) => patch({ subComponents: subs.map(x => (x.id === s.id ? { ...x, ...p } : x)) })
  const setParams = (defs) => update({ parameters: defs })
  return (
    <div style={{ padding: 10, marginBottom: 10, borderRadius: R.sm, border: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input value={s.label} onChange={e => update({ label: e.target.value })} placeholder="Label" style={{ ...inp, flex: 1 }} />
        {onRemove && <button onClick={onRemove} style={{ ...miniBtn, color: C.bad }}>×</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <span style={lbl}>count</span><Num value={s.count} onChange={v => update({ count: Math.max(1, Math.round(v)) })} step={1} w={64} />
        <span style={lbl}>layout</span>
        <select value={s.layout?.kind || 'row'} onChange={e => update({ layout: { ...s.layout, kind: e.target.value } })} style={{ ...inp, flex: 1 }}>
          {SUB_LAYOUTS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text2, marginBottom: 8 }}>
        <input type="checkbox" checked={!!s.scene} onChange={e => update({ scene: e.target.checked })} /> Show in main scene
      </label>
      <p style={{ ...lbl, marginBottom: 4 }}>Per-instance parameters</p>
      {(s.parameters || []).map((p, pi) => (
        <div key={pi} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={p.label} onChange={e => setParams(s.parameters.map((x, j) => j === pi ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ ...inp, flex: 1, minWidth: 80 }} />
          <input value={p.unit || ''} onChange={e => setParams(s.parameters.map((x, j) => j === pi ? { ...x, unit: e.target.value } : x))} placeholder="unit" style={{ ...inp, width: 44 }} />
          <Num value={p.default ?? 0} onChange={v => setParams(s.parameters.map((x, j) => j === pi ? { ...x, default: v } : x))} w={52} />
          <button onClick={() => setParams(s.parameters.filter((_, j) => j !== pi))} style={{ ...miniBtn, color: C.bad }}>×</button>
        </div>
      ))}
      <button onClick={() => setParams([...(s.parameters || []), { key: `p${(s.parameters || []).length + 1}`, label: 'Value', unit: '', default: 0, min: 0, max: 100 }])} style={{ ...ghost, width: '100%', marginTop: 4 }}>＋ Add parameter</button>
    </div>
  )
}

function SubsInspector() {
  const { draft, patch } = useStudioStore()
  const subs = draft.subComponents || []
  const remove = (id) => patch({ subComponents: subs.filter(s => s.id !== id) })
  const add = () => patch({ subComponents: [...subs, { id: `sub_${nanoid(4)}`, label: 'New Sub-assembly', count: 6, layout: { kind: 'row', step: 1, y: 0.5 }, part: { geometry: 'box', dims: { width: 0.3, height: 0.4, depth: 0.3 }, material: { color: '#8aa0b4' } }, parameters: [], states: null, derive: 'uniform', scene: true }] })
  return (
    <Section title="Sub-components">
      <p style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5, margin: '0 0 10px' }}>Declarative sub-assemblies (count + layout + per-instance parameters). Values are derived and edited in the Details view — no manual placement.</p>
      {subs.map(s => <SubCard key={s.id} s={s} onRemove={() => remove(s.id)} />)}
      <button onClick={add} style={{ ...ghost, width: '100%' }}>＋ Add sub-component</button>
    </Section>
  )
}

// Focused editor for ONE sub-assembly (selected in the hierarchy).
function SubInspector({ subId }) {
  const s = useStudioStore(st => (st.draft.subComponents || []).find(x => x.id === subId))
  if (!s) return <Empty>Sub-assembly not found.</Empty>
  return (
    <div>
      <Section title="Sub-assembly">
        <p style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5, margin: '0 0 10px' }}>{s.count} instances, laid out automatically. Per-instance values are derived and edited in the Details view.</p>
      </Section>
      <SubCard s={s} />
    </div>
  )
}

function MetaInspector() {
  const { draft, patch } = useStudioStore()
  const layers = Object.keys(useSceneStore.getState().layers)
  const beaconOn = draft.beacon !== null
  return (
    <div>
      <Section title="Component">
        <Row label="Name"><input value={draft.label} onChange={e => patch({ label: e.target.value })} style={inp} /></Row>
        <Row label="Category"><input value={draft.category || ''} onChange={e => patch({ category: e.target.value })} style={inp} /></Row>
        <Row label="Layer">
          <select value={draft.layer} onChange={e => patch({ layer: e.target.value })} style={inp}>{layers.map(l => <option key={l} value={l}>{l}</option>)}</select>
        </Row>
      </Section>
      <Section title="Status beacon">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.text2, marginBottom: 8 }}>
          <input type="checkbox" checked={beaconOn} onChange={e => patch({ beacon: e.target.checked ? { offset: [0, 2.4, 0] } : null })} /> Show status beacon
        </label>
        {beaconOn && <Row label="Offset"><Vec3 value={draft.beacon.offset} onChange={v => patch({ beacon: { offset: v } })} /></Row>}
      </Section>
    </div>
  )
}

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 16 }}>
    <p style={{ ...lbl, marginBottom: 8 }}>{title}</p>{children}
  </div>
)
const Empty = ({ children }) => <p style={{ fontSize: 12.5, color: C.text3 }}>{children}</p>

// ── shell ──────────────────────────────────────────────────────────────────
// Left INSPECTOR DRAWER (mirrors the main scene): slides out only when something
// is selected. Root → component-level tabs; a part → its editor; a sub → its editor.
function InspectorDrawer() {
  const { draft, selPart, selSub, rootSel, deselect, updatePart } = useStudioStore()
  const [rootTab, setRootTab] = useState('meta')
  const ROOT_TABS = [['meta', 'Meta'], ['schema', 'Settings'], ['subs', 'Subs'], ['states', 'States'], ['ports', 'Ports']]
  const part = selPart ? draft.parts.find(p => p.id === selPart) : null
  const partName = part ? (part.label || (part.kind === 'component' ? refLabel(part.ref) : part.kind === 'group' ? 'Group' : part.kind === 'logical' ? 'General Part' : (part.geometry || 'Shape'))) : ''

  return (
    <motion.div key="studio-inspector" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -16, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      style={{ width: 296, flexShrink: 0, borderRight: `1px solid ${C.line}`, background: C.surface, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* Part: editable name right in the heading (no separate Name field). */}
        {part ? (
          <input value={partName} onChange={e => updatePart(part.id, { label: e.target.value })} title="Rename"
            style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: C.text, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, padding: 0 }} />
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rootSel ? 'Component' : selSub ? 'Sub-assembly' : 'Node'}</span>
        )}
        <button onClick={deselect} title="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 17, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>
      {rootSel && (
        <div style={{ display: 'flex', gap: 2, padding: 8, borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
          {ROOT_TABS.map(([k, label]) => (
            <button key={k} onClick={() => setRootTab(k)} style={{ ...btn(rootTab === k), flex: 1, padding: '6px 0', fontSize: 11.5 }}>{label}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {rootSel ? (
          <>
            {rootTab === 'meta' && <MetaInspector />}
            {rootTab === 'schema' && <><SchemaEditor which="config" /><SchemaEditor which="parameters" /></>}
            {rootTab === 'subs' && <SubsInspector />}
            {rootTab === 'states' && <StatesInspector />}
            {rootTab === 'ports' && <PortsInspector />}
          </>
        ) : selSub ? <SubInspector subId={selSub} /> : <PartInspector />}
      </div>
    </motion.div>
  )
}

// Right bar = the real Bruce assistant (same chat as the main scene). Describe a
// component and Bruce builds it (component mode → opens here in the Studio).
function BrucePanel() {
  return (
    <div style={{ width: 320, flexShrink: 0, height: '100%' }}>
      <ChatPanel surface="component" />
    </div>
  )
}

export function ComponentStudio() {
  const { draft, editingId, patch, close, save, setDraftSpec, selPart, selSub, rootSel, selPort, gizmoMode, setGizmoMode, selectPart, deselect } = useStudioStore()
  const [err, setErr] = useState('')
  const [confirmSave, setConfirmSave] = useState(null)   // null | { addToScene } — copy-vs-update choice
  const usageCount = useSceneStore(s => editingId ? Object.values(s.objects).filter(o => o.type === editingId).length : 0)
  const fileRef = useRef()

  // Keyboard: nudge (arrows = X/Z, PageUp/Down = Y; Shift = larger), Delete, Esc.
  // MUST run unconditionally (above the `!draft` guard) or hook order breaks on save.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return
      const st = useStudioStore.getState()
      const id = st.selPart
      if (!id) return
      const part = st.draft?.parts.find(p => p.id === id)
      if (!part) return
      if (e.key === 'Delete' || e.key === 'Backspace') { st.removePart(id); e.preventDefault(); return }
      if (e.key === 'Escape') { st.deselect(); return }
      const step = e.shiftKey ? 0.5 : 0.1
      const pos = [...(part.position || [0, 0, 0])]
      const moves = { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [2, -step], ArrowDown: [2, step], PageUp: [1, step], PageDown: [1, -step] }
      const mv = moves[e.key]
      if (!mv) return
      pos[mv[0]] += mv[1]
      st.updatePart(id, { position: pos })
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!draft) return null
  const doSave = (addToScene, asCopy = false) => { const r = save({ addToScene, asCopy }); if (!r.ok) setErr(r.error) }
  // Editing an existing type changes every placed instance — ask copy vs update first.
  const onSaveClick = (addToScene) => { editingId ? setConfirmSave({ addToScene }) : doSave(addToScene) }
  const doExport = () => { const r = validateComponentSpec(draft); downloadJSON(r.spec, draft.label || 'component') }
  const doImport = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const r = validateComponentSpec(raw.spec ?? raw)
      if (!r.ok) { setErr(r.errors[0] || 'Invalid component file.'); return }
      setDraftSpec(r.spec); setErr('')
    } catch (e2) { setErr(`Couldn't read that file: ${e2.message}`) }
  }
  const drawerOpen = rootSel || !!selPart || !!selSub

  return (
    <div style={{ width: '100vw', height: '100vh', background: C.bg, color: C.text, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: `1px solid ${C.line}`, ...glass }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text2 }}>Component Studio</span>
        <input value={draft.label} onChange={e => patch({ label: e.target.value })}
          style={{ ...inp, width: 280, fontSize: 14, fontWeight: 600 }} placeholder="Component name" />
        <span style={{ fontSize: 11.5, color: C.text3 }}>{editingId ? 'Editing' : 'New'}</span>
        <span style={{ flex: 1 }} />
        {err && <span style={{ fontSize: 12, color: C.bad }}>{err}</span>}
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} title="Import a component JSON" style={{ padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>⭳ Import</button>
        <button onClick={doExport} title="Export this component as JSON" style={{ padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>⭱ Export</button>
        <button onClick={close} style={{ padding: '8px 14px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>Cancel</button>
        <button onClick={() => onSaveClick(false)} style={{ padding: '8px 14px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>Save</button>
        <button onClick={() => onSaveClick(true)} style={{ padding: '8px 16px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>Save &amp; add to scene</button>
      </div>

      {/* Save choice — editing an existing component changes every occurrence. */}
      {confirmSave && (
        <div onClick={() => setConfirmSave(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center', background: 'rgba(20,24,32,0.35)', backdropFilter: 'blur(3px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(440px, 92vw)', borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel, padding: 22 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>Save “{draft.label}”</h3>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, marginBottom: 16 }}>
              Updating the existing component changes <b style={{ color: C.text }}>every place it's used</b>{usageCount > 0 ? ` (${usageCount} in this scene)` : ''}. Or save your changes as a new copy and keep the original untouched.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { doSave(confirmSave.addToScene, false); setConfirmSave(null) }}
                style={{ textAlign: 'left', padding: '11px 14px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700 }}>
                Update existing<div style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.9 }}>Applies the changes to all occurrences.</div>
              </button>
              <button onClick={() => { doSave(confirmSave.addToScene, true); setConfirmSave(null) }}
                style={{ textAlign: 'left', padding: '11px 14px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: C.surface, color: C.text, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700 }}>
                Save as a new copy<div style={{ fontSize: 11.5, fontWeight: 500, color: C.text3 }}>Creates a new component; the original is unchanged.</div>
              </button>
              <button onClick={() => setConfirmSave(null)} style={{ padding: '8px', border: 'none', background: 'transparent', color: C.text3, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* body — Hierarchy tree · inspector drawer (on selection) · preview · Bruce */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <StudioTree />
        <AnimatePresence>{drawerOpen && <InspectorDrawer />}</AnimatePresence>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Preview draft={draft} selPart={selPart} selPort={selPort} mode={gizmoMode} selectPart={selectPart} onMissed={deselect} />
          {/* gizmo mode toolbar */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 4, padding: 4, borderRadius: R.pill, ...glass, border: `1px solid ${C.line}` }}>
            {[['translate', 'Move'], ['rotate', 'Rotate'], ['scale', 'Scale']].map(([m, l]) => (
              <button key={m} onClick={() => setGizmoMode(m)} style={{ ...btn(gizmoMode === m), borderRadius: R.pill, padding: '6px 12px' }}>{l}</button>
            ))}
          </div>
          {!selPart && (
            <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: C.text3, ...glass, padding: '6px 12px', borderRadius: R.pill, border: `1px solid ${C.line}` }}>
              Select a node in the hierarchy, or click a part to transform it
            </div>
          )}
        </div>
        <BrucePanel />
      </div>
    </div>
  )
}
