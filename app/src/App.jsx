import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Lightformer, GizmoHelper, GizmoViewport, SoftShadows } from '@react-three/drei'
import { PostFX } from './components/PostFX'
import { Button }    from '@faclon-labs/design-sdk/Button'

import { useSceneStore }      from './store/sceneStore'
import { useProjectStore }    from './store/projectStore'
import { useAIStore }         from './store/aiStore'
import { useDetailsStore }    from './store/detailsStore'
import { useStudioStore }     from './store/studioStore'
import { validateSpec, exportSpec, downloadJSON } from './lib/twinSpec'
import { TEMPLATES }          from './lib/templates'
import { getSchema, coerceConfigValue } from './lib/assetSchemas'
import { effectiveParamDefs, paramFreqKey, FREQUENCIES } from './lib/parameterSchemas'
import { getConnectorSchema }   from './lib/connectorSchemas'
import { RuleEditor }           from './components/RuleEditor'
import { SceneRenderer }      from './components/SceneRenderer'
import { Connectors }         from './components/Connectors'
import { MaterialFlowLayer }  from './components/effects/MaterialFlow'
import { CameraFeedRenderer, CameraFeedPanel } from './components/CameraFeed'
import { ShopFloorEnvironment } from './components/ShopFloorEnvironment'
import { MACHINE_LIBRARY }    from './lib/machineLibrary'
import { dragGuard }          from './lib/interactionGuard'
import { computeGlowMap }     from './lib/rulesEngine'
import { GridSystem }         from './components/GridSystem'
import { SkyDome }            from './components/SkyDome'
import { Floor }              from './components/Floor'
import { CameraController }   from './components/CameraController'
import { TourDriver, TourOverlay, useTourStore } from './components/TourPlayer'
import { Kpi3DLayer, useKpiStore } from './components/Kpi3D'
import { AssetSparklines, AssetAlertHistory } from './components/AssetDrilldown'
import { DayNightDriver, SiteLights } from './components/DayNight'
import { BlastLayer, useBlastStore } from './components/effects/BlastFX'
import { OpsDashboard } from './components/dashboard/OpsDashboard'
import { DashboardPreviewRenderer } from './components/dashboard/DashboardPreview'
import { useDashboard, syncDashboardForScene } from './lib/dashboardStore'
import { tickMineModel } from './lib/mineModel'
import { tickZoneHistory } from './lib/zoneHistory'
import { useDayNight } from './lib/dayNight'
import { useViewTab } from './lib/viewTab'
import { CommandPalette }     from './components/CommandPalette'
import { confirmDialog, alertDialog } from './components/dialogs'
import { FlowPane }           from './components/flow/FlowPane'
import { AssetLibraryModal } from './components/ai/AssetLibraryModal'
import { OverviewPanel }      from './components/OverviewPanel'
import { AssetTrendCharts }   from './components/AssetCharts'
import { HierarchyPanel }     from './components/HierarchyPanel'
import { HierarchySearch }    from './components/HierarchySearch'
import { ChatPanel }          from './components/ai/ChatPanel'
import { FloatingPanel }      from './components/SidebarShell'
import { useUIStore }         from './store/uiStore'
import { BruceCard }          from './components/BruceCard'
import { shopfloorRecommendations } from './lib/recommendations'
import { AnimatePresence, motion } from 'framer-motion'
import { stateMeta }          from './lib/stateSchemas'
import { nodePath, displayPath, unsTopic, descendantObjectIds } from './lib/hierarchy'
import { UnsPathField } from './components/UnsPathField'
import { FONT, C, R, glass, SHADOW, STATUS_COLOR } from './ui/theme'

/* ── Error Boundary ──────────────────────────────────────────────── */
class SceneErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
        justifyContent:'center', background:'#fff', color:'#ff3344',
        fontFamily:'monospace', fontSize:13, padding:32, whiteSpace:'pre-wrap', zIndex:10 }}>
        {'Scene error: ' + this.state.error.message}
      </div>
    )
    return this.props.children
  }
}

/* ── Shared tokens ───────────────────────────────────────────────── */
// Flush vibrancy sidebar (no shadow — separated by hairlines).
const PANEL = { ...glass }
const BORDER_R = { borderRight: `1px solid ${C.line}` }
const BORDER_L = { borderLeft:  `1px solid ${C.line}` }
const BORDER_B = { borderBottom:`1px solid ${C.line}` }

// Panel body fills its floating card (the FloatingPanel supplies the rounded
// border + shadow). Solid surface — no glass/edge border of its own.
const COL_L = { width: '100%', height: '100%', flexShrink: 0, background: C.surface, display: 'flex', flexDirection: 'column' }
const COL_R = { width: '100%', height: '100%', flexShrink: 0, background: C.surface, display: 'flex', flexDirection: 'column' }

/* ── Small Apple-style primitives ────────────────────────────────── */
function IconBtn({ label, title, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      height: 30, minWidth: 32, padding: '0 10px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      background: active ? C.accentSoft : 'transparent',
      border: 'none', borderRadius: R.sm,
      color: disabled ? C.text3 : (active ? C.accent : C.text),
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
    }}>{label}</button>
  )
}

// Apple segmented control.
function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', flexShrink: 0, gap: 2, padding: 2,
      background: 'rgba(120,120,128,0.12)', borderRadius: R.sm }}>
      {options.map(o => {
        const on = value === o.value
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            height: 26, padding: '0 12px', border: 'none', borderRadius: 6, whiteSpace: 'nowrap',
            background: on ? C.surface : 'transparent',
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
            color: on ? C.text : C.text2, fontFamily: 'inherit', fontSize: 12.5,
            fontWeight: on ? 600 : 500, cursor: 'pointer',
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

function SectionTitle({ children, style }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
      color: C.text3, padding: '14px 16px 6px', ...style }}>{children}</p>
  )
}

function StatusDot({ status, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: '50%',
    background: STATUS_COLOR[status] ?? C.text3, flexShrink: 0 }} />
}

/* ── Determine line group from Z position ────────────────────────── */
const LINE_INFO = {
  A: { label: 'Line A — PET',  color: 'var(--text-positive-default)' },
  B: { label: 'Line B — Cans', color: 'var(--text-brand-default)'    },
  C: { label: 'Line C — Glass',color: 'var(--text-warning-default)'  },
}

function getLine(position) {
  const z = position[2]
  if (z > 4)  return 'A'
  if (z > -4) return 'B'
  return 'C'
}

/* ── View mode: left panel — always the grouped asset list ───────── */
const TYPE_LABEL = {}
MACHINE_LIBRARY.forEach(c => c.items.forEach(it => { TYPE_LABEL[it.type] = it.label }))
const labelOf = (o, customAssetTypes = {}) => TYPE_LABEL[o.type] ?? customAssetTypes[o.type]?.label ?? o.type

function ViewPanel({ objects }) {
  const { selectObject, flyToObject, selectedId, customAssetTypes } = useSceneStore()
  const [collapsed, setCollapsed] = useState({})

  // Grouped asset list (group key is template-specific: obj.group ?? type label)
  const groups = {}
  const order = []
  Object.values(objects).forEach(o => {
    const key = o.group ?? labelOf(o, customAssetTypes)
    if (!groups[key]) { groups[key] = []; order.push(key) }
    groups[key].push(o)
  })

  return (
    <div style={COL_L}>
      <SectionTitle>Assets</SectionTitle>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {order.map(key => {
          const items = groups[key]
          const isCollapsed = !!collapsed[key]
          return (
            <div key={key}>
              <div onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 16px', cursor: 'pointer', userSelect: 'none',
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text2 }}>
                  {key} <span style={{ color: C.text3 }}>· {items.length}</span>
                </span>
                <span style={{ color: C.text3, fontSize: 9 }}>{isCollapsed ? '▶' : '▼'}</span>
              </div>
              {!isCollapsed && items.map(o => {
                const on = selectedId === o.id
                return (
                  <div key={o.id} onClick={() => { selectObject(o.id); flyToObject(o.id) }} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    margin: '1px 8px', padding: '7px 8px 7px 16px', borderRadius: R.sm,
                    background: on ? C.accentSoft : 'transparent', cursor: 'pointer',
                  }}>
                    <StatusDot status={o.status} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontSize: 13, fontWeight: on ? 600 : 400, color: on ? C.accent : C.text }}>{o.name}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── A rich per-state pill (label + colour from the state schema) ── */
function StateBadge({ obj, size = 9 }) {
  const m = stateMeta(obj.type, obj.state)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: C.text2 }}>{m.label}</span>
    </span>
  )
}

/* Format a parameter-entry timestamp ("12:30:45" → "as of …"). */
function fmtParamTime(ts) {
  if (!ts) return null
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return null }
}

/* One parameter row in the view-mode inspector — a clean faceplate readout (no
 * progress bars, no frequency tags). Every param shows value + unit the same way;
 * manual-entry params just carry a "Manual data entry" caption (+ entry time). */
function InspectorParam({ obj, def }) {
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const manual = paramFreqKey(obj, def.key, customAssetTypes) === 'manual'
  const v = +(obj.parameters?.[def.key] ?? def.default)
  const ts = obj.paramTimes?.[def.key]
  const dp = def.max != null && def.min != null && (def.max - def.min) <= 10 ? 1 : 0

  return (
    <div style={{ padding: '11px 0', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, color: C.text2 }}>
          {def.label}
          {def.topic && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 600, color: C.accent }}>● UNS</span>}
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
          {v.toFixed(dp)}<span style={{ color: C.text3, fontWeight: 400, fontSize: 11 }}> {def.unit}</span>
        </span>
      </div>
      {manual && (
        <div style={{ marginTop: 4, fontSize: 10.5, color: C.text3 }}>
          Manual data entry{ts ? ` · entered ${fmtParamTime(ts)}` : ''}
        </div>
      )}
    </div>
  )
}

/* ── View mode: per-asset detail (parameters + manual entry + state) ── */
function AssetDetail({ obj, onClose }) {
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  if (!obj) return null
  const defs = effectiveParamDefs(obj, customAssetTypes)
  return (
    <>
      <div style={{ padding: '16px 16px 14px', ...BORDER_B, display: 'flex',
        justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>
            {labelOf(obj, customAssetTypes)}{obj.group ? ` · ${obj.group}` : ''}
          </p>
          <h3 onClick={() => useDetailsStore.getState().open(obj.id)} title="View component details"
            style={{ fontSize: 22, fontWeight: 700, color: C.text, overflow: 'hidden', cursor: 'pointer',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.15 }}
            onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
            onMouseLeave={e => (e.currentTarget.style.color = C.text)}>{obj.name}</h3>
          <button onClick={() => useDetailsStore.getState().open(obj.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, padding: 0,
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 600, color: C.accent }}>
            View component details →
          </button>
          <div style={{ marginTop: 8 }}><StateBadge obj={obj} /></div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: C.text3, fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        <div style={{ padding: '16px 0 6px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>Parameters</span>
        </div>
        {defs.length === 0 && <p style={{ fontSize: 12.5, color: C.text3 }}>No parameters for this asset.</p>}
        {defs.map(d => <InspectorParam key={d.key} obj={obj} def={d} />)}
        <AssetSparklines obj={obj} defs={defs} />
        <AssetAlertHistory obj={obj} />
        <AssetTrendCharts obj={obj} />
      </div>
    </>
  )
}

/* ── View mode: right panel — tabbed Overview (line dashboard) / Asset ── */
function ViewRightPanel({ objects, selectedObj, onClose }) {
  const tab = useViewTab(s => s.tab)
  const setTab = useViewTab(s => s.setTab)
  useEffect(() => { setTab(selectedObj ? 'asset' : 'overview') }, [selectedObj?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={COL_R}>
      <TabBar tabs={['overview', 'asset']} value={tab} onChange={setTab} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {tab === 'overview' && <OverviewPanel objects={objects} />}
        {tab === 'asset' && (selectedObj
          ? <AssetDetail obj={selectedObj} onClose={onClose} />
          : <p style={{ fontSize: 13, color: C.text3, padding: 24, textAlign: 'center', lineHeight: 1.5 }}>
              Select an asset to see its live detail.
            </p>)}
      </div>
    </div>
  )
}

/* ── Unified top bar (title · mode · actions) ────────────────────── */
function TopBar(props) {
  const {
    editMode, setEditMode, paneMode, setPaneMode,
    canUndo, canRedo, undo, redo, assetLibraryOpen, toggleAssetLibrary,
    counts, onClear, onHome, projectName, onRenameProject, onExport, onImport, onSave, dirty,
  } = props
  return (
    <div style={{
      height: 50, display: 'flex', alignItems: 'center',
      padding: '0 10px 0 12px', gap: 12, background: C.surface,
      border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.panel,
      userSelect: 'none',
    }}>
      {/* Left: back-to-projects + editable project name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button onClick={onHome} title="Back to projects" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 10px 0 8px',
          border: 'none', borderRadius: R.sm, background: 'transparent', cursor: 'pointer', color: C.text2,
          fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
        }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,120,128,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: `linear-gradient(135deg, ${C.accent}, #5ac8fa)` }} />
          <span style={{ fontSize: 14 }}>‹</span> Projects
        </button>
        <span style={{ width: 1, height: 20, background: C.line }} />
        <input value={projectName ?? ''} onChange={(e) => onRenameProject?.(e.target.value)} title="Rename project"
          style={{ minWidth: 60, maxWidth: 240, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: C.text,
            border: 'none', outline: 'none', background: 'transparent', padding: '4px 4px', borderRadius: 6 }} />
      </div>

      {/* Center: namespace search (+ pane toggle in build mode) */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {editMode && (
          <Segmented value={paneMode} onChange={setPaneMode}
            options={[{ value: 'scene', label: '3D Scene' }, { value: 'flow', label: 'Process Flow' }]} />
        )}
        <HierarchySearch />
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {!editMode && counts && (
          <div style={{ display: 'flex', gap: 12, marginRight: 6 }}>
            {[['running', counts.running], ['idle', counts.idle], ['fault', counts.fault]].map(([k, n]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: C.text2 }}>
                <StatusDot status={k} size={7} />{n}
              </span>
            ))}
          </div>
        )}
        <button onClick={onSave} disabled={!dirty} title={dirty ? 'Save project' : 'All changes saved'} style={{
          height: 30, padding: '0 14px', border: 'none', borderRadius: R.sm, cursor: dirty ? 'pointer' : 'default',
          background: dirty ? C.accent : 'rgba(120,120,128,0.12)', color: dirty ? '#fff' : C.text3,
          fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>{dirty ? 'Save' : 'Saved'}</button>
        <IconBtn label="↑ Import" title="Import a Twin Spec JSON (replaces this scene)" onClick={onImport} />
        <IconBtn label="↓ Export" title="Download this scene as JSON" onClick={onExport} />
        {editMode && <>
          <span style={{ width: 1, height: 20, background: C.line, margin: '0 2px' }} />
          <IconBtn label="↩" title="Undo (⌘Z)" disabled={!canUndo} onClick={undo} />
          <IconBtn label="↪" title="Redo (⌘⇧Z)" disabled={!canRedo} onClick={redo} />
          <span style={{ width: 1, height: 20, background: C.line, margin: '0 2px' }} />
          <IconBtn label="⊞ Components" title="Pin component library" active={assetLibraryOpen} onClick={toggleAssetLibrary} />
          <IconBtn label="Clear" title="Clear scene" onClick={onClear} />
        </>}
        <span style={{ width: 1, height: 20, background: C.line, margin: '0 2px' }} />
        <button onClick={() => setEditMode(!editMode)} style={{
          height: 30, padding: '0 14px', border: 'none', borderRadius: R.sm,
          background: editMode ? 'rgba(120,120,128,0.12)' : C.accent,
          color: editMode ? C.text : '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>{editMode ? 'Done' : 'Build'}</button>
      </div>
    </div>
  )
}

/* ── Tab bar (shared) ────────────────────────────────────────────── */
function TabBar({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', padding: '0 8px', ...BORDER_B }}>
      {tabs.map(t => {
        const on = value === t
        return (
          <button key={t} onClick={() => onChange(t)} style={{
            flex: 1, padding: '11px 4px 9px', background: 'none', border: 'none',
            borderBottom: on ? `2px solid ${C.accent}` : '2px solid transparent',
            color: on ? C.text : C.text2, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: on ? 600 : 500, textTransform: 'capitalize',
          }}>{t}</button>
        )
      })}
    </div>
  )
}

/* ── Generic confirm modal (in-app, replaces window.confirm) ─────── */
function ConfirmModal({ title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(20,24,32,0.32)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px, 92vw)', borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: C.text2, marginTop: 8, lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={{ padding: '9px 16px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '9px 18px', border: 'none', borderRadius: R.sm, background: danger ? C.bad : C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>{confirmLabel}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── Build mode: Left panel (Layers / Templates) ─────────────────── */
function BuildLeftPanel() {
  const { layers, toggleLayerVisibility, toggleLayerLock, loadScene, activeLayer, editMode, objects } = useSceneStore()
  const selectedId = useSceneStore(s => s.selectedId)
  const selectedGroupId = useSceneStore(s => s.selectedGroupId)
  const [tab, setTab] = useState('hierarchy')
  const [confirmTmpl, setConfirmTmpl] = useState(null)   // template awaiting reset confirmation

  // Selecting something (e.g. clicking it in the scene) jumps to the Hierarchy tab
  // so it auto-reveals + highlights there.
  useEffect(() => { if (selectedId || selectedGroupId) setTab('hierarchy') }, [selectedId, selectedGroupId])

  const applyTemplate = (tmpl) => { loadScene(tmpl.build()); useSceneStore.getState().setEditMode(false); useProjectStore.getState().markDirty() }
  const handleLoad = (tmpl) => {
    // Replacing a non-empty scene needs confirmation; an empty scene loads straight away.
    if (Object.keys(objects).length > 0) setConfirmTmpl(tmpl)
    else applyTemplate(tmpl)
  }

  return (
    <div style={COL_L}>
      <TabBar tabs={['hierarchy', 'layers', 'templates']} value={tab} onChange={setTab} />

      {tab === 'hierarchy' && <div style={{ flex: 1, minHeight: 0 }}><HierarchyPanel editMode={editMode} /></div>}

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: tab === 'hierarchy' ? 'none' : 'block' }}>
        {tab === 'layers' && Object.entries(layers).map(([key, layer]) => {
          const on = key === activeLayer
          return (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 10px', margin: '1px 0', borderRadius: R.sm,
              background: on ? C.accentSoft : 'transparent', opacity: layer.locked ? 0.55 : 1,
            }}>
              <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: on ? C.accent : C.text }}>{layer.name}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => toggleLayerVisibility(key)} title="Toggle visibility"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                    opacity: layer.visible ? 1 : 0.4 }}>{layer.visible ? '👁' : '🙈'}</button>
                <button onClick={() => toggleLayerLock(key)} title="Toggle lock"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>{layer.locked ? '🔒' : '🔓'}</button>
              </div>
            </div>
          )
        })}

        {tab === 'templates' && (
          <>
            <SectionTitle style={{ padding: '8px 8px 6px' }}>Starter Layouts</SectionTitle>
            {TEMPLATES.map(t => (
              <div key={t.id} onClick={() => handleLoad(t)} style={{
                padding: '10px', margin: '1px 0', borderRadius: R.sm, cursor: 'pointer',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{t.name}</p>
                <p style={{ fontSize: 12, color: C.text3, lineHeight: 1.4 }}>{t.description}</p>
              </div>
            ))}
          </>
        )}
      </div>

      <AnimatePresence>
        {confirmTmpl && (
          <ConfirmModal
            title="Replace current scene?"
            body={<>Loading <b style={{ color: C.text }}>{confirmTmpl.name}</b> will reset the current scene. Unsaved changes will be lost.</>}
            confirmLabel="Load template"
            onConfirm={() => { applyTemplate(confirmTmpl); setConfirmTmpl(null) }}
            onCancel={() => setConfirmTmpl(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Generic schema-driven field control ─────────────────────────── */
// Source-agnostic: caller supplies the field def, current value, an onLive
// (apply without history) and onCommit (apply WITH history) callback. Used by
// object config, asset parameters, and connector config alike.
function ConfigField({ field, value, onLive, onCommit }) {
  const v = value ?? field.default
  const live   = (raw) => (onLive ?? onCommit)(coerceConfigValue(field, raw))
  const commit = (raw) => onCommit(coerceConfigValue(field, raw))

  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '9px 0', borderBottom: `1px solid ${C.line}` }
  const lbl = { fontSize: 12.5, color: C.text2, flexShrink: 0 }
  const pill = (on) => ({
    padding: '3px 12px', borderRadius: R.sm, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
    border: 'none', background: on ? C.accent : 'rgba(120,120,128,0.14)', color: on ? '#fff' : C.text2,
  })

  if (field.type === 'boolean') {
    return (
      <div style={row}>
        <span style={lbl}>{field.label}</span>
        <button onClick={() => commit(!v)} style={pill(v)}>{v ? 'On' : 'Off'}</button>
      </div>
    )
  }

  if (field.type === 'select') {
    // Native dropdown — clean and consistent for any number of options (the old
    // wrapping segmented control looked cramped with 3+ / long labels).
    return (
      <div style={row}>
        <span style={lbl}>{field.label}</span>
        <select value={v} onChange={(e) => commit(e.target.value)}
          style={{ minWidth: 130, maxWidth: 170, padding: '5px 8px', border: `1px solid ${C.line}`, borderRadius: 6,
            fontFamily: 'inherit', fontSize: 12, color: C.text, background: C.surface, outline: 'none', cursor: 'pointer' }}>
          {(field.options ?? []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    )
  }

  if (field.type === 'color') {
    return (
      <div style={row}>
        <span style={lbl}>{field.label}</span>
        <input type="color" value={v} onChange={(e) => live(e.target.value)} onBlur={() => commit(v)}
          style={{ width: 34, height: 24, border: `1px solid ${C.line}`, borderRadius: 6, background: 'none', cursor: 'pointer', padding: 0 }} />
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <div style={row}>
        <span style={lbl}>{field.label}</span>
        <input type="text" value={v} onChange={(e) => live(e.target.value)} onBlur={() => commit(v)}
          style={{ width: 120, padding: '5px 8px', border: `1px solid ${C.line}`, borderRadius: 6,
            fontFamily: 'inherit', fontSize: 12, color: C.text, background: C.surface }} />
      </div>
    )
  }

  // number → live slider + readout
  return (
    <div style={{ padding: '9px 0', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={lbl}>{field.label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
          {(+v).toFixed(field.step && field.step < 1 ? 2 : 0)}
        </span>
      </div>
      <input type="range" min={field.min ?? 0} max={field.max ?? 10} step={field.step ?? 0.1} value={v}
        onChange={(e) => live(e.target.value)} onPointerUp={() => commit(v)} onBlur={() => commit(v)}
        style={{ width: '100%' }} />
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
      color: C.text3, marginTop: 18, marginBottom: 6 }}>{children}</p>
  )
}

// Asset settings (geometry/animation) — schema from assetSchemas.
function ConfigSection({ obj }) {
  const { updateObject, updateConfig } = useSceneStore()
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const schema = getSchema(obj.type, customAssetTypes)
  if (schema.length === 0) return null
  return (
    <div key={obj.id}>
      <SectionLabel>CONFIGURATION</SectionLabel>
      {schema.map(f => (
        <ConfigField key={f.key} field={f} value={obj.config?.[f.key]}
          onLive={(val) => updateObject(obj.id, { config: { ...obj.config, [f.key]: val } })}
          onCommit={(val) => updateConfig(obj.id, f.key, val)} />
      ))}
    </div>
  )
}

const fmtParam = (v) => { const n = +v; return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : String(v) }

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
)
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /></svg>
)
function IconAction({ title, onClick, hover, children }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.text3, flexShrink: 0 }}
      onMouseEnter={(e) => { e.currentTarget.style.color = hover; e.currentTarget.style.background = 'rgba(120,120,128,0.14)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.background = 'transparent' }}>{children}</button>
  )
}

// One parameter row. Collapsed: static value (no live ticking) + Edit / Delete.
// Edit reveals the value editor + the UNS topic binding.
function ParamRow({ obj, def, tipOn = false, checked = false, onToggleTip }) {
  const { updateParameter, removeParameter, setParamTopic, setParamFrequency } = useSceneStore()
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const [editing, setEditing] = useState(false)
  // snapshot so the live simulator doesn't make the readout flicker in build mode
  const [val, setVal] = useState(obj.parameters?.[def.key] ?? def.default ?? 0)
  const [topic, setTopic] = useState(def.topic || '')
  const [freq, setFreq] = useState(paramFreqKey(obj, def.key, customAssetTypes))
  const hasRange = def.min != null && def.max != null

  const openEdit = () => { setVal(obj.parameters?.[def.key] ?? def.default ?? 0); setTopic(def.topic || ''); setFreq(paramFreqKey(obj, def.key, customAssetTypes)); setEditing(true) }
  const save = () => { updateParameter(obj.id, def.key, Number(val) || 0); setParamTopic(obj.id, def.key, topic.trim()); setParamFrequency(obj.id, def.key, freq); setEditing(false) }
  const del = async () => { if (await confirmDialog({ title: 'Delete parameter?', body: `Delete parameter “${def.label}”?`, confirmLabel: 'Delete', danger: true })) removeParameter(obj.id, def.key) }

  const miniBtn = (color) => ({ padding: '4px 10px', border: `1px solid ${C.line}`, borderRadius: 6, background: 'transparent',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color })

  if (!editing) return (
    <div className="paramRow" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 0', borderBottom: `1px solid ${C.line}` }}>
      {tipOn && (
        <input type="checkbox" checked={checked} onChange={onToggleTip} title="Show in hover tooltip"
          style={{ flexShrink: 0, width: 14, height: 14, accentColor: C.accent, cursor: 'pointer' }} />
      )}
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {def.label}
        {def.unit && <span style={{ marginLeft: 6, fontSize: 10.5, color: C.text3 }}>{def.unit}</span>}
        {def.topic && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: C.accent }}>● UNS</span>}
        <span style={{ marginLeft: 6, fontSize: 10, color: paramFreqKey(obj, def.key, customAssetTypes) === 'manual' ? C.accent : C.text3 }}>
          {paramFreqKey(obj, def.key, customAssetTypes) === 'manual' ? '✎ manual' : FREQUENCIES.find(f => f.key === paramFreqKey(obj, def.key, customAssetTypes))?.label}
        </span>
      </span>
      <IconAction title="Edit" onClick={openEdit} hover={C.accent}><EditIcon /></IconAction>
      <IconAction title="Delete" onClick={del} hover={C.bad}><TrashIcon /></IconAction>
    </div>
  )

  return (
    <div style={{ padding: 12, margin: '6px 0', borderRadius: R.sm, border: `1px solid ${C.line}`, background: 'rgba(10,132,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: C.text2 }}>{def.label}{def.unit ? ` (${def.unit})` : ''}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtParam(val)}</span>
      </div>
      {hasRange ? (
        <input type="range" min={def.min} max={def.max} step={(def.max - def.min) > 50 ? 1 : 0.1} value={val}
          onChange={(e) => setVal(+e.target.value)} style={{ width: '100%' }} />
      ) : (
        <input type="number" value={val} onChange={(e) => setVal(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'inherit', fontSize: 12.5, color: C.text, background: C.surface }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.text3, flexShrink: 0, width: 64 }}>Frequency</span>
        <select value={freq} onChange={(e) => setFreq(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: '5px 8px', border: `1px solid ${C.line}`, borderRadius: 6,
            fontFamily: 'inherit', fontSize: 11.5, color: C.text, background: C.surface, outline: 'none' }}>
          {FREQUENCIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>
      {/* Official design-sdk UNS binding field (type "/" to browse the namespace) */}
      <div style={{ marginTop: 8 }}>
        <UnsPathField topic={topic} onTopic={setTopic} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <button onClick={() => setEditing(false)} style={miniBtn(C.text2)}>Cancel</button>
        <button onClick={save} style={{ padding: '4px 14px', border: 'none', borderRadius: 6, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>Done</button>
      </div>
    </div>
  )
}

// Telemetry parameters — editable values, per-parameter UNS bindings, add/delete.
function ParametersSection({ obj }) {
  const { addParameter, setObjectTooltip } = useSceneStore()
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const defs = effectiveParamDefs(obj, customAssetTypes)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const submit = () => { if (name.trim()) addParameter(obj.id, name.trim(), unit.trim()); setName(''); setUnit(''); setAdding(false) }

  const tip = obj.tooltip ?? { enabled: false, params: [] }
  const tipParams = tip.params ?? []
  const tipPill = (on) => ({ padding: '4px 14px', borderRadius: R.pill, border: `1px solid ${on ? C.accent : C.line}`,
    background: on ? C.accent : 'transparent', color: on ? '#fff' : C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600 })
  const toggleTipParam = (key) => {
    const next = tipParams.includes(key) ? tipParams.filter(k => k !== key) : [...tipParams, key]
    setObjectTooltip(obj.id, { params: next })
  }
  return (
    <div key={obj.id}>
      {/* Hover tooltip: enable + multi-select which params show on hover (view mode) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0 12px', borderBottom: `1px solid ${C.line}`, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>Tooltip</span>
          <span style={{ display: 'block', fontSize: 10.5, color: C.text3, marginTop: 1 }}>
            {tip.enabled ? 'tick params to show on hover (view mode)' : 'shown on hover in view mode'}
          </span>
        </div>
        <button onClick={() => setObjectTooltip(obj.id, { enabled: !tip.enabled, params: tipParams })} style={tipPill(tip.enabled)}>{tip.enabled ? 'On' : 'Off'}</button>
      </div>

      {defs.length === 0 && <p style={{ fontSize: 12.5, color: C.text3, padding: '10px 0' }}>No parameters yet.</p>}
      {defs.map(def => (
        <ParamRow key={def.key} obj={obj} def={def}
          tipOn={tip.enabled} checked={tipParams.includes(def.key)} onToggleTip={() => toggleTipParam(def.key)} />
      ))}

      {adding ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '10px 0' }}>
          <input autoFocus placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            style={{ flex: 2, minWidth: 0, padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'inherit', fontSize: 12.5, color: C.text, background: C.surface }} />
          <input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            style={{ flex: 1, minWidth: 0, width: 50, padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'inherit', fontSize: 12.5, color: C.text, background: C.surface }} />
          <button onClick={submit} style={{ padding: '6px 12px', border: 'none', borderRadius: 6, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600 }}>Add</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ marginTop: 12, padding: '8px 12px', width: '100%', border: `1px dashed ${C.lineStrong}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600 }}>＋ Add parameter</button>
      )}
    </div>
  )
}

// Visual rules — when true, the asset glows the chosen color.
function RulesSection({ obj }) {
  const { addRule } = useSceneStore()
  return (
    <div key={obj.id}>
      <p className="BodyXSmallRegular" style={{ color:'var(--text-default-tertiary)', marginBottom:'var(--spacing-03)' }}>
        When a rule is true, this asset glows the chosen colour.
      </p>
      {(obj.rules ?? []).map(rule => <RuleEditor key={rule.id} obj={obj} rule={rule} />)}
      <Button label="+ Add Rule" variant="Secondary" color="Primary" size="Small" isFullWidth
        onClick={() => addRule(obj.id)} />
    </div>
  )
}

// Inspector shown when a connection (connector) is selected in 3D or the flow.
function ConnectorInspector({ connId }) {
  const { objects, updateConnectionConfig, removeConnectionById } = useSceneStore()

  let conn = null, owner = null
  for (const o of Object.values(objects)) {
    const found = (o.connections ?? []).find(c => c.id === connId)
    if (found) { conn = found; owner = o; break }
  }

  if (!conn || !owner) return (
    <div style={{ ...COL_R, alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: C.text3, padding: 20 }}>Connection not found.</p>
    </div>
  )

  const tgt = objects[conn.targetId]
  const schema = getConnectorSchema(conn.connectorType)

  return (
    <div style={COL_R}>
      <div style={{ padding: '16px 16px 14px', ...BORDER_B }}>
        <p style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>CONNECTOR · {conn.connectorType.toUpperCase()}</p>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{owner.name} → {tgt?.name ?? conn.targetId}</h3>
        <p style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{conn.sourcePort} → {conn.targetPort}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        <SectionLabel>Connector Settings</SectionLabel>
        {schema.map(f => (
          <ConfigField key={f.key} field={f} value={conn.connectorConfig?.[f.key]}
            onCommit={(val) => updateConnectionConfig(connId, f.key, val)} />
        ))}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${C.line}` }}>
        <Button label="Remove Connection" variant="Secondary" color="Negative" size="Small" isFullWidth
          onClick={() => removeConnectionById(connId)} />
      </div>
    </div>
  )
}

/* ── Inspector for a selected GROUP (UNS node) — a scoped Line Overview ── */
function GroupInspector({ groupId }) {
  const objects = useSceneStore(s => s.objects)
  const groups  = useSceneStore(s => s.groups)
  const { renameGroup, removeGroup, flyToGroup, clearSelection, addGroup, selectGroup, setGroupTooltip } = useSceneStore()
  const g = groups[groupId]
  if (!g) return (
    <div style={{ ...COL_R, alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: C.text3, padding: 20 }}>Group not found.</p>
    </div>
  )
  const segs = nodePath(objects, groups, groupId)
  // Scope the overview to just this group's descendant assets.
  const subset = {}
  for (const oid of descendantObjectIds(objects, groups, groupId)) subset[oid] = objects[oid]

  return (
    <div style={COL_R}>
      <div style={{ padding: '16px 16px 12px', ...BORDER_B, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>GROUP · {displayPath(segs.slice(0, -1)) || 'ROOT'}</p>
          <input value={g.name} onChange={(e) => renameGroup(groupId, e.target.value)}
            style={{ fontSize: 17, fontWeight: 600, color: C.text, border: 'none', outline: 'none',
              background: 'transparent', width: '100%', fontFamily: 'inherit' }} />
          <p style={{ fontSize: 11, color: C.text3, marginTop: 3, fontFamily: 'ui-monospace, monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unsTopic(segs)}</p>
        </div>
        <button onClick={clearSelection} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>Tooltip</span>
          <span style={{ display: 'block', fontSize: 10.5, color: C.text3, marginTop: 1 }}>show line KPIs on hover (view mode)</span>
        </div>
        <button onClick={() => setGroupTooltip(groupId, { enabled: !(g.tooltip?.enabled) })}
          style={{ padding: '4px 14px', borderRadius: R.pill, border: `1px solid ${g.tooltip?.enabled ? C.accent : C.line}`,
            background: g.tooltip?.enabled ? C.accent : 'transparent', color: g.tooltip?.enabled ? '#fff' : C.text2,
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600 }}>{g.tooltip?.enabled ? 'On' : 'Off'}</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {Object.keys(subset).length > 0
          ? <OverviewPanel objects={subset} kpiDefs={g.kpis} title={`${g.name} Overview`} />
          : <p style={{ fontSize: 12.5, color: C.text3, padding: '16px' }}>Empty group. Add components from the tree.</p>}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8 }}>
        <Button label="Frame" variant="Secondary" color="Primary" size="Small" isFullWidth onClick={() => flyToGroup(groupId)} />
        <Button label="+ Group" variant="Secondary" color="Primary" size="Small" isFullWidth
          onClick={() => { const id = addGroup('New Group', groupId); selectGroup(id) }} />
        <Button label="Delete" variant="Secondary" color="Negative" size="Small" isFullWidth onClick={() => removeGroup(groupId)} />
      </div>
    </div>
  )
}

/* ── Replace-component picker (swaps a component in place) ───────── */
function ReplacePicker({ currentType, onPick, onClose }) {
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const [q, setQ] = useState('')
  const match = (label) => !q.trim() || label.toLowerCase().includes(q.toLowerCase().trim())
  const customs = Object.values(customAssetTypes).filter(ct => match(ct.label))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(360px, 92vw)', maxHeight: '70vh',
        display: 'flex', flexDirection: 'column', borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`,
        boxShadow: SHADOW.panel, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Replace with…</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 18 }}>×</button>
          </div>
          <input autoFocus placeholder="Search components…" value={q} onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontFamily: 'inherit', fontSize: 13,
              border: `1px solid ${C.line}`, borderRadius: R.sm, color: C.text, background: 'rgba(120,120,128,0.08)' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
          {MACHINE_LIBRARY.map(({ category, items }) => {
            const shown = items.filter(it => match(it.label))
            if (!shown.length) return null
            return (
              <div key={category}>
                <p style={{ padding: '8px 16px 4px', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>{category}</p>
                {shown.map(it => (
                  <div key={it.type} onClick={() => onPick(it.type)} style={{
                    padding: '7px 16px', cursor: it.type === currentType ? 'default' : 'pointer', fontSize: 13,
                    color: it.type === currentType ? C.text3 : C.text, opacity: it.type === currentType ? 0.5 : 1,
                    display: 'flex', justifyContent: 'space-between' }}
                    onMouseEnter={(e) => { if (it.type !== currentType) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    {it.label}{it.type === currentType && <span style={{ fontSize: 11 }}>current</span>}
                  </div>
                ))}
              </div>
            )
          })}
          {customs.length > 0 && (
            <div>
              <p style={{ padding: '8px 16px 4px', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>Custom</p>
              {customs.map(ct => (
                <div key={ct.id} onClick={() => onPick(ct.id)} style={{
                  padding: '7px 16px', cursor: ct.id === currentType ? 'default' : 'pointer', fontSize: 13,
                  color: ct.id === currentType ? C.text3 : C.text, opacity: ct.id === currentType ? 0.5 : 1,
                  display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={(e) => { if (ct.id !== currentType) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  {ct.label}{ct.id === currentType && <span style={{ fontSize: 11 }}>current</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Build mode: Right properties panel ─────────────────────────── */
function BuildRightPanel() {
  const { objects, selectedId, selectedConnectionId, transformMode, setTransformMode, cycleStatus, removeObject, replaceObject, updateObject } = useSceneStore()
  const [tab, setTab] = useState('settings')
  const [replacing, setReplacing] = useState(false)
  const obj = selectedId ? objects[selectedId] : null

  // A selected connection takes over the inspector.
  if (selectedConnectionId) return <ConnectorInspector connId={selectedConnectionId} />

  if (!obj) return (
    <div style={{ ...COL_R, alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: C.text3, padding: 24, textAlign: 'center', lineHeight: 1.5 }}>
        Select an asset to edit its settings, parameters and rules.
      </p>
    </div>
  )

  const modes = [
    { value: 'translate', label: 'Move' },
    { value: 'rotate', label: 'Rotate' },
    { value: 'scale', label: 'Scale' },
  ]
  const numRow = (axis, val, digits) => (
    <div key={axis} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 12, color: C.text2 }}>{axis}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{val.toFixed(digits)}</span>
    </div>
  )

  return (
    <div style={COL_R}>
      <div style={{ padding: '16px 16px 14px', ...BORDER_B, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>{obj.type.toUpperCase()} · {obj.layer.toUpperCase()}</p>
          <input value={obj.name} onChange={(e) => updateObject(obj.id, { name: e.target.value })}
            title="Click to rename"
            style={{ fontSize: 17, fontWeight: 600, color: C.text, border: 'none', outline: 'none',
              background: 'transparent', width: '100%', fontFamily: 'inherit', padding: 0 }} />
        </div>
        <button onClick={() => cycleStatus(obj.id)} title="Cycle state"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(120,120,128,0.12)',
            border: 'none', borderRadius: R.pill, padding: '4px 10px', cursor: 'pointer', flexShrink: 0 }}>
          <StateBadge obj={obj} size={8} />
        </button>
      </div>

      {/* Seamless: jump straight into the Component Studio editing this component
          (custom → edit in place; built-in → an editable copy). No save-then-build. */}
      <button onClick={() => useStudioStore.getState().buildCopyOf(obj.type)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, margin: '0 16px 10px',
          padding: '9px 12px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: C.surface,
          color: C.accent, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
        ✎ Edit this component
      </button>

      <TabBar tabs={['settings', 'parameters', 'rules']} value={tab} onChange={setTab} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>

        {tab === 'parameters' && <ParametersSection obj={obj} />}
        {tab === 'rules' && <RulesSection obj={obj} />}

        {tab === 'settings' && (<>
          <SectionLabel>Transform</SectionLabel>
          <div style={{ marginBottom: 8 }}>
            <Segmented value={transformMode} onChange={setTransformMode} options={modes} />
          </div>

          <SectionLabel>Position</SectionLabel>
          {[['X', 0], ['Y', 1], ['Z', 2]].map(([axis, i]) => numRow(axis, +obj.position[i], 2))}

          <SectionLabel>Rotation</SectionLabel>
          {[['X', 0], ['Y', 1], ['Z', 2]].map(([axis, i]) => numRow(axis, +obj.rotation[i], 3))}

          {obj.connections.length > 0 && (
            <>
              <SectionLabel>Connections ({obj.connections.length})</SectionLabel>
              {obj.connections.map((c, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${C.line}`,
                  display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.text2 }}>{c.sourcePort} → {c.targetPort}</span>
                  <span style={{ fontSize: 11, color: C.text3 }}>{c.connectorType}</span>
                </div>
              ))}
            </>
          )}

          <ConfigSection obj={obj} />
        </>)}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Button label="Replace" variant="Secondary" size="Small" isFullWidth
            onClick={() => setReplacing(true)} />
        </div>
        <div style={{ flex: 1 }}>
          <Button label="Delete Object" variant="Secondary" color="Negative" size="Small" isFullWidth
            onClick={() => removeObject(obj.id)} />
        </div>
      </div>

      {replacing && (
        <ReplacePicker currentType={obj.type}
          onPick={(type) => { replaceObject(obj.id, type); setReplacing(false) }}
          onClose={() => setReplacing(false)} />
      )}
    </div>
  )
}

/* ── Keyboard shortcuts overlay ──────────────────────────────────── */
const SHORTCUT_GROUPS = [
  { title: 'Move selected', rows: [
    [['←', '→'], 'Move along X'],
    [['↑', '↓'], 'Move along Z (floor)'],
    [['⌘/Ctrl', '↑↓'], 'Move up / down (Y)'],
    [['Shift'], 'Bigger step (2.0)'],
    [['Alt'], 'Fine step (0.1)'],
  ]},
  { title: 'Transform', rows: [
    [['[', ']'], 'Rotate Y (Shift = 45°)'],
    [['-', '='], 'Scale down / up'],
    [['G', 'R', 'S'], 'Gizmo: Move / Rotate / Scale'],
  ]},
  { title: 'Object', rows: [
    [['⌘/Ctrl', 'C'], 'Copy'],
    [['⌘/Ctrl', 'V'], 'Paste (cascades)'],
    [['⌘/Ctrl', 'D'], 'Duplicate'],
    [['Delete'], 'Remove'],
    [['F'], 'Focus camera on it'],
  ]},
  { title: 'Global', rows: [
    [['⌘/Ctrl', 'K'], 'Search palette'],
    [['⌘/Ctrl', 'Z'], 'Undo'],
    [['⌘/Ctrl', '⇧', 'Z'], 'Redo'],
    [['Esc'], 'Deselect'],
    [['?'], 'Toggle this help'],
  ]},
]

function Kbd({ children }) {
  return (
    <span style={{
      display:'inline-block', minWidth:20, textAlign:'center', padding:'2px 7px', margin:'0 2px',
      background:'rgba(120,120,128,0.12)', border:`1px solid ${C.line}`, borderRadius:6,
      color:C.text2, fontSize:11, lineHeight:'16px', fontFamily:'inherit', fontWeight:500,
    }}>{children}</span>
  )
}

function ShortcutsOverlay({ onClose }) {
  return (
    <div onClick={onClose} style={{ position:'absolute', inset:0, zIndex:40,
      background:'rgba(0,0,0,0.18)', backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)',
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:540, maxHeight:'80vh', overflowY:'auto',
        background:'rgba(255,255,255,0.92)', ...glass, border:`1px solid ${C.line}`,
        borderRadius:R.lg, boxShadow:SHADOW.panel }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'16px 20px', borderBottom:`1px solid ${C.line}` }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:C.text }}>Keyboard Shortcuts</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            color:C.text3, fontSize:18, lineHeight:1, padding:0 }}>×</button>
        </div>
        <div style={{ padding:'8px 20px 20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 32px' }}>
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <p style={{ fontSize:11, fontWeight:600, letterSpacing:0.4, textTransform:'uppercase',
                color:C.text3, margin:'16px 0 6px' }}>{group.title}</p>
              {group.rows.map(([keys, label], i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0' }}>
                  <span style={{ fontSize:12.5, color:C.text2 }}>{label}</span>
                  <span style={{ flexShrink:0, marginLeft:16 }}>{keys.map((k, j) => <Kbd key={j}>{k}</Kbd>)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Unsaved-changes warning when leaving a project ──────────────── */
function LeaveConfirm({ projectName, onSave, onDiscard, onCancel }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(20,24,32,0.32)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(420px, 92vw)', borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel, padding: 24 }}>
        <button onClick={onCancel} title="Close" style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: C.text3, fontSize: 20, lineHeight: 1 }}>×</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, paddingRight: 28 }}>Unsaved changes</h2>
        <p style={{ fontSize: 13.5, color: C.text2, marginTop: 8, lineHeight: 1.5 }}>
          You have unsaved changes in <b style={{ color: C.text }}>{projectName}</b>. If you leave now, your progress will be lost.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 22, flexWrap: 'nowrap' }}>
          <button onClick={onDiscard} style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 14px', border: `1px solid rgba(255,59,48,0.4)`, borderRadius: R.sm, background: 'transparent', color: C.bad, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Leave without saving</button>
          <button onClick={onSave} style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '9px 16px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Save &amp; leave</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// After a local save, offer to also push the project to the connected IOsense
// insight. Self-contained: handles the push and shows progress/result inline.
function CloudSaveModal({ projectName, onClose }) {
  const cloudPush = useProjectStore(s => s.cloudPush)
  const [phase, setPhase] = useState('ask')   // 'ask' | 'saving' | 'done'
  const [ok, setOk] = useState(false)
  const [msg, setMsg] = useState('')
  const doSave = async () => {
    setPhase('saving')
    const id = useProjectStore.getState().activeId
    await cloudPush(id)
    const err = useProjectStore.getState().cloudErr
    setOk(!err); setMsg(err || 'Saved to your IOsense insight.'); setPhase('done')
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={phase === 'saving' ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(20,24,32,0.32)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(420px, 92vw)', borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Save to cloud?</h2>
        {phase !== 'done' ? (
          <p style={{ fontSize: 13.5, color: C.text2, marginTop: 8, lineHeight: 1.5 }}>
            <b style={{ color: C.text }}>{projectName}</b> is saved on this device. Also push it to your connected IOsense insight so it's available everywhere?
          </p>
        ) : (
          <p style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.5, color: ok ? C.good : C.bad, wordBreak: 'break-word' }}>{ok ? '✓ ' : '⚠️ '}{msg}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          {phase === 'ask' && <>
            <button onClick={onClose} style={{ padding: '9px 16px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Not now</button>
            <button onClick={doSave} style={{ padding: '9px 18px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Save to cloud</button>
          </>}
          {phase === 'saving' && <span style={{ fontSize: 13, color: C.text2 }}>Saving…</span>}
          {phase === 'done' && <button onClick={onClose} style={{ padding: '9px 18px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Done</button>}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── Floating viewport controls (zoom · reset view · undo · redo) ── */
function ViewportControls({ orbitRef, leftEdge }) {
  const tourActive = useTourStore(s => s.active)
  const hasTour = useSceneStore(s => (s.tour?.beats?.length ?? 0) > 0)
  const kpiShown = useKpiStore(s => s.shown)
  const nightOn = useDayNight(s => s.night)
  const hasBlast = useSceneStore(s => Object.values(s.objects).some(o => o.config?.blast?.from))
  const dolly = (factor) => {
    const oc = orbitRef.current; if (!oc) return
    const off = oc.object.position.clone().sub(oc.target)
    const d = Math.max(oc.minDistance ?? 1, Math.min(oc.maxDistance ?? 1e4, off.length() * factor))
    off.setLength(d); oc.object.position.copy(oc.target.clone().add(off)); oc.update()
  }
  const reset = () => {
    const oc = orbitRef.current; if (!oc) return
    oc.object.position.set(-5, 32, 55); oc.target.set(-5, 2, 0); oc.update()
  }
  // Orbit the camera around the target about the world Y axis (~18° per click).
  const rotate = (dir) => {
    const oc = orbitRef.current; if (!oc) return
    const a = dir * 0.32, cos = Math.cos(a), sin = Math.sin(a)
    const ox = oc.object.position.x - oc.target.x, oz = oc.object.position.z - oc.target.z
    oc.object.position.x = oc.target.x + ox * cos - oz * sin
    oc.object.position.z = oc.target.z + ox * sin + oz * cos
    oc.update()
  }
  const bs = { width: 40, height: 38, border: 'none', background: 'transparent', cursor: 'pointer',
    color: C.text2, fontSize: 16, lineHeight: 1, display: 'grid', placeItems: 'center', fontFamily: 'inherit' }
  const enter = (e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.05)' }
  const leave = (e) => { e.currentTarget.style.background = 'transparent' }
  const sep = { height: 1, background: C.line, margin: '2px 7px' }
  return (
    <div style={{ position: 'absolute', left: leftEdge, bottom: 18, zIndex: 8, display: 'flex', flexDirection: 'column',
      background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.panel, overflow: 'hidden', pointerEvents: 'auto' }}>
      {!tourActive && <>
        <button title="Zoom in"      onClick={() => dolly(0.82)} style={bs} onMouseEnter={enter} onMouseLeave={leave}>+</button>
        <button title="Zoom out"     onClick={() => dolly(1.22)} style={bs} onMouseEnter={enter} onMouseLeave={leave}>−</button>
        <div style={sep} />
        <button title="Reset view"   onClick={reset} style={bs} onMouseEnter={enter} onMouseLeave={leave}>⌂</button>
        <div style={sep} />
        <button title="Rotate left"  onClick={() => rotate(-1)} style={bs} onMouseEnter={enter} onMouseLeave={leave}>↺</button>
        <button title="Rotate right" onClick={() => rotate(1)}  style={bs} onMouseEnter={enter} onMouseLeave={leave}>↻</button>
      </>}
      {!tourActive && hasBlast && <>
        <div style={sep} />
        <button title="Fire blast sequence (demo)"
          onClick={() => useBlastStore.getState().trigger()}
          style={{ ...bs, fontSize: 10.5, fontWeight: 700, color: '#ff9f0a' }}
          onMouseEnter={enter} onMouseLeave={leave}>BLAST</button>
      </>}
      {!tourActive && <>
        <div style={sep} />
        <button title={nightOn ? 'Switch to day' : 'Switch to night'}
          onClick={() => useDayNight.getState().toggle()}
          style={{ ...bs, fontSize: 14, color: nightOn ? C.accent : C.text2 }}
          onMouseEnter={enter} onMouseLeave={leave}>{nightOn ? '☾' : '☀'}</button>
        <button title={kpiShown ? 'Hide 3D KPI labels' : 'Show 3D KPI labels'}
          onClick={() => useKpiStore.getState().toggle()}
          style={{ ...bs, fontSize: 11, fontWeight: 700, color: kpiShown ? C.accent : C.text3 }}
          onMouseEnter={enter} onMouseLeave={leave}>KPI</button>
      </>}
      {hasTour && <>
        {!tourActive && <div style={sep} />}
        <button
          title={tourActive ? 'Exit tour (Esc)' : 'Play guided tour'}
          onClick={() => (tourActive ? useTourStore.getState().stop() : useTourStore.getState().start())}
          style={{ ...bs, color: tourActive ? '#ff3b30' : C.accent, fontSize: 13 }}
          onMouseEnter={enter} onMouseLeave={leave}>{tourActive ? '■' : '▶'}</button>
      </>}
    </div>
  )
}

// Headless-snapshot mode (?snap=1): skip GPU-heavy passes that crawl under
// software WebGL so scripts/snap.mjs can capture frames quickly.
const SNAP_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('snap')

/* ── Root App ────────────────────────────────────────────────────── */
export default function App() {
  const orbitRef = useRef()
  const tourActive = useTourStore(s => s.active)
  // Dev-only: expose the orbit controls for headless screenshot tooling.
  useEffect(() => { if (import.meta.env.DEV) window.__dt = { ...(window.__dt || {}), orbit: orbitRef } }, [])
  const {
    loadScene, objects, selectedId, selectedConnectionId, selectedGroupId, editMode, setEditMode,
    selectObject, clearSelection, paneMode, setPaneMode,
    assetLibraryOpen, toggleAssetLibrary, clearScene,
    undo, redo, _historyIndex, _history, environment,
  } = useSceneStore()

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // floating-panel geometry (for placing the inspector card + HUD beside the nav)
  const leftW = useUIStore(s => s.leftW)
  const leftCollapsed = useUIStore(s => s.leftCollapsed)
  const leftEdge = leftCollapsed ? 54 : 24 + leftW   // x where content clears the left panel

  // Project shell wiring (name in the top bar, back-to-home, import/export).
  const projectName = useProjectStore(s => (s.activeId ? s.projects[s.activeId]?.name : '') ?? 'Untitled')
  const activeId    = useProjectStore(s => s.activeId)
  const goHome      = useProjectStore(s => s.goHome)
  const saveActive  = useProjectStore(s => s.saveActiveScene)
  const dirty       = useProjectStore(s => s.dirty)
  const renameActive= useProjectStore(s => s.renameProject)
  const cloudConnected = useAIStore(s => !!(s.iosenseJWT && s.insightId))
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [cloudAsk, setCloudAsk] = useState(false)
  // Save locally (always), then — if an IOsense insight is connected — offer to
  // push to the cloud. Local save is the source of truth; cloud is opt-in.
  const handleSave = () => { saveActive(); if (cloudConnected) setCloudAsk(true) }
  const requestHome = () => { if (useProjectStore.getState().dirty) setLeaveOpen(true); else goHome() }
  const importRef   = useRef()
  const handleExport = () => downloadJSON(exportSpec(useSceneStore.getState().getSceneSnapshot(), { title: projectName }), projectName)
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const res = validateSpec(JSON.parse(await file.text()))
      if (!res.ok) { alertDialog({ title: 'Invalid Twin Spec', body: res.errors[0] || 'Invalid Twin Spec.' }); return }
      if (!(await confirmDialog({ title: 'Import scene?', body: 'Import will replace the current scene. Continue?', confirmLabel: 'Import' }))) return
      loadScene(res.scene)
      useProjectStore.getState().markDirty()   // imported scene is unsaved
    } catch (err) { alertDialog({ title: 'Import failed', body: 'Could not parse JSON: ' + err.message }) }
  }

  // The active project drives the scene now (hydrated by projectStore on open);
  // no auto-INITIAL_SCENE here.

  // Live-data simulation — gently moves every asset's parameters so readouts
  // and rule glows feel alive (no undo history).
  useEffect(() => {
    const tick = () => {
      if (import.meta.env.DEV && window.__dtNoSim) return   // parity harness drives ticks explicitly
      if (import.meta.env.DEV) performance.mark('dt-tick-a')
      useSceneStore.getState().simulateTick(); const o = useSceneStore.getState().objects; tickMineModel(o); tickZoneHistory(o)
      if (import.meta.env.DEV) { performance.mark('dt-tick-b'); performance.measure('dt-tick', 'dt-tick-a', 'dt-tick-b') }
    }
    const t = setInterval(tick, 1000)
    if (import.meta.env.DEV) window.__dt = { ...(window.__dt || {}), simTimer: t, tick: () => { useSceneStore.getState().simulateTick(); const o = useSceneStore.getState().objects; tickMineModel(o); tickZoneHistory(o) } }
    return () => clearInterval(t)
  }, [])

  // Land on the operations dashboard when the scene declares one.
  useEffect(() => { syncDashboardForScene() }, [])
  const dashMode = useDashboard(s => s.mode)
  const dashOn = dashMode === 'dashboard' && !editMode

  // Build-mode keyboard editing: nudge / rotate / scale / copy-paste / duplicate.
  // Reads fresh state via getState() so the listener never needs rebinding.
  useEffect(() => {
    const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' || el.isContentEditable)
    const NUDGE = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, 0, -1], ArrowDown: [0, 0, 1] }
    let commitTimer = null
    const scheduleCommit = () => {
      clearTimeout(commitTimer)
      commitTimer = setTimeout(() => useSceneStore.getState().commitTransform(), 350)
    }

    const handler = (e) => {
      if (isTyping(document.activeElement)) return
      // Don't let scene-edit shortcuts fire while interacting with the flow graph.
      if (e.target?.closest?.('[data-flowpane]') || document.activeElement?.closest?.('[data-flowpane]')) return
      const mod = e.metaKey || e.ctrlKey

      // ? — toggle shortcuts overlay (any mode)
      if (e.key === '?') { e.preventDefault(); setHelpOpen(h => !h); return }

      const s = useSceneStore.getState()
      if (!s.editMode) return

      // Clipboard: copy / paste a selected GROUP (whole subtree) or object.
      if (mod && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        if (s.selectedGroupId) s.copyGroup(s.selectedGroupId)
        else if (s.selectedId) s.copyObject(s.selectedId)
        return
      }
      if (mod && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        if (s._groupClipboard) s.pasteGroup()
        else if (s._clipboard) s.pasteObject()
        return
      }

      // A selected GROUP nudges/deletes as a whole (translate only).
      if (s.selectedGroupId) {
        const gid = s.selectedGroupId
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.removeGroup(gid); return }
        if (NUDGE[e.key]) {
          e.preventDefault()
          const step = e.shiftKey ? 2.0 : (e.altKey ? 0.1 : 0.5)
          let [dx, dy, dz] = NUDGE[e.key]
          if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { dy = e.key === 'ArrowUp' ? 1 : -1; dz = 0 }
          s.translateGroupBy(gid, [dx * step, dy * step, dz * step])
          scheduleCommit(); return
        }
        return
      }

      const id  = s.selectedId
      const obj = id ? s.objects[id] : null
      if (!obj) return

      const layer = s.layers[obj.layer]
      if (obj.locked || layer?.locked) return

      // Duplicate / Delete (copy/paste handled above)
      if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); s.duplicateObject(id); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); s.removeObject(id); return }

      // Unmodified letter shortcuts
      if (!mod) {
        if (e.key === 'g' || e.key === 'G') { e.preventDefault(); s.setTransformMode('translate'); return }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); s.setTransformMode('rotate'); return }
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); s.setTransformMode('scale'); return }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); s.flyToObject(id); return }

        // Rotate around Y: [ ccw  ] cw   (Shift = 45°, else 15°)
        if (e.key === '[' || e.key === ']') {
          e.preventDefault()
          const amt = (e.shiftKey ? Math.PI / 4 : Math.PI / 12) * (e.key === ']' ? 1 : -1)
          s.updateObject(id, { rotation: [obj.rotation[0], obj.rotation[1] + amt, obj.rotation[2]] })
          scheduleCommit(); return
        }

        // Uniform scale: -/_ down, =/+ up   (Shift = bigger increment)
        if (e.key === '-' || e.key === '=' || e.key === '+' || e.key === '_') {
          e.preventDefault()
          const inc = (e.shiftKey ? 0.25 : 0.1) * (e.key === '=' || e.key === '+' ? 1 : -1)
          const f = Math.max(0.1, obj.scale[0] + inc)
          s.updateObject(id, { scale: [f, f, f] })
          scheduleCommit(); return
        }
      }

      // Movement nudge (arrows). Step: Shift = 2.0 coarse, Alt = 0.1 fine, else 0.5.
      if (NUDGE[e.key]) {
        e.preventDefault()
        const step = e.shiftKey ? 2.0 : (e.altKey ? 0.1 : 0.5)
        let [dx, dy, dz] = NUDGE[e.key]
        if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {   // Ctrl/⌘ + ↑↓ → vertical (Y)
          dy = e.key === 'ArrowUp' ? 1 : -1
          dz = 0
        }
        s.updateObject(id, { position: [
          obj.position[0] + dx * step,
          obj.position[1] + dy * step,
          obj.position[2] + dz * step,
        ] })
        scheduleCommit(); return
      }
    }

    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); clearTimeout(commitTimer) }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Cmd+Z / Cmd+Shift+Z — undo / redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo()
      }
      // Cmd+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setPaletteOpen(p => !p)
      }
      // Escape — close help / palette / deselect
      if (e.key === 'Escape') {
        if (helpOpen) setHelpOpen(false)
        else if (!paletteOpen) clearSelection()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, paletteOpen, helpOpen, clearSelection])

  const selectedObj = selectedId ? objects[selectedId] : null
  const canUndo = _historyIndex > 0
  const canRedo = _historyIndex < _history.length - 1

  // Visual-rule glow: recompute only when objects (parameters/rules) change.
  const glowMap = useMemo(() => computeGlowMap(objects), [objects])

  const counts = useMemo(() => {
    const c = { running: 0, idle: 0, fault: 0 }
    Object.values(objects).forEach(o => { if (c[o.status] != null) c[o.status]++ })
    return c
  }, [objects])

  const showFlow = editMode && paneMode === 'flow'

  const chip = {
    ...glass, border: `1px solid ${C.line}`, borderRadius: R.pill,
    padding: '6px 12px', fontSize: 12, color: C.text2, boxShadow: SHADOW.card,
  }

  return (
    <SceneErrorBoundary>
      <div style={{ width:'100vw', height:'100vh', position:'relative',
        background:C.bg, color:C.text, fontFamily:FONT, overflow:'hidden' }}>

        <input ref={importRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />

        {/* ── BASE LAYER: full-bleed 3D canvas (+ process flow) fills the window ── */}
        <div style={{ position:'absolute', inset:0, zIndex:0 }}>
          {/* Bruce insight card — view mode, beside the floating nav (collapsible) */}
          {!editMode && !showFlow && !dashOn && <BruceCard title="Shopfloor" recs={shopfloorRecommendations(objects)} offsetLeft={leftEdge} />}
          {!editMode && !showFlow && !dashOn && <CameraFeedPanel />}
          {!showFlow && <TourOverlay />}
          <div style={{ position:'absolute', inset:0,
            visibility: showFlow ? 'hidden' : 'visible',
            pointerEvents: showFlow ? 'none' : 'auto' }}>
              <Canvas
                camera={{ position:[-5, 32, 55], fov:60, near:1.2, far:2400 }}
                shadows="soft"
                gl={{ antialias:true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
                onPointerMissed={() => { if (!dragGuard.transforming) clearSelection() }}
              >
                {/* PCSS soft shadows — real penumbrae instead of hard edges */}
                {!SNAP_MODE && <SoftShadows size={26} samples={12} focus={0.85} />}
                <SiteLights />
                <DayNightDriver />

                {environment?.sky ? (
                  // Scene opted into an outdoor sky: gradient dome + procedural
                  // soft/overcast IBL built from Lightformers — no network HDRI.
                  <>
                    <SkyDome config={environment.sky === true ? {} : environment.sky} />
                    <Suspense fallback={null}>
                      <Environment resolution={64} frames={1}>
                        <Lightformer intensity={1.6} rotation-x={Math.PI / 2} position={[0, 60, 0]} scale={[120, 120, 1]} color="#e8f0f6" />
                        <Lightformer intensity={0.55} position={[-60, 14, -40]} scale={[120, 40, 1]} color="#dde6ec" />
                        <Lightformer intensity={0.45} position={[60, 10, 40]} scale={[120, 30, 1]} color="#f4efe4" />
                      </Environment>
                    </Suspense>
                  </>
                ) : (
                  <Suspense fallback={null}>
                    <Environment preset="warehouse" />
                  </Suspense>
                )}

                <Floor />
                {/* Fallback backdrop only when the scene has no Floor object
                    (old projects / imports). New projects ship an editable Floor. */}
                {!Object.values(objects).some(o => o.type === 'Floor') && <ShopFloorEnvironment />}
                <GridSystem editMode={editMode} />
                <SceneRenderer orbitRef={orbitRef} glowMap={glowMap} />
                <Connectors />
                <MaterialFlowLayer />
                <CameraController orbitRef={orbitRef} />
                <TourDriver orbitRef={orbitRef} />
                {!dashOn && <Kpi3DLayer />}
                <BlastLayer />
                {!SNAP_MODE && !dashOn && <PostFX />}
                <CameraFeedRenderer />
                <DashboardPreviewRenderer />
                {import.meta.env.DEV && <DevFreezeHook />}
                <ShadowCadence on={dashOn} />

                <OrbitControls
                  ref={orbitRef}
                  target={[-5, 2, 0]}
                  minDistance={4} maxDistance={700}
                  maxPolarAngle={Math.PI / 2.05}
                  enableDamping dampingFactor={0.08}
                />

                {!tourActive && (
                  <GizmoHelper alignment="bottom-center" margin={[80, 80]}>
                    <GizmoViewport axisColors={['#ff3b30', '#34c759', '#0a84ff']} labelColor="#1d1d1f" />
                  </GizmoHelper>
                )}
              </Canvas>

              {/* viewport controls — zoom / reset view / undo / redo */}
              {!dashOn && <ViewportControls orbitRef={orbitRef} leftEdge={leftEdge} />}
            </div>

            {/* Process Flow fully replaces the 3D view when active */}
            {showFlow && (
              <div style={{ position:'absolute', inset:0 }}>
                <FlowPane />
              </div>
            )}

        </div>{/* ── end base layer ── */}

        {/* ── OPERATIONS DASHBOARD overlay (landing view) ── */}
        {dashOn && <OpsDashboard />}

        {/* ── FLOATING top bar (hidden while the tour records or dashboard shows) ── */}
        {!tourActive && !dashOn && <div style={{ position:'absolute', top:12, left:12, right:12, zIndex:30 }}>
          <TopBar
            editMode={editMode} setEditMode={setEditMode}
            paneMode={paneMode} setPaneMode={setPaneMode}
            canUndo={canUndo} canRedo={canRedo} undo={undo} redo={redo}
            assetLibraryOpen={assetLibraryOpen} toggleAssetLibrary={toggleAssetLibrary}
            counts={counts}
            onClear={async () => { if (await confirmDialog({ title: 'Clear scene?', body: 'Remove every object from the scene? This can be undone with ⌘Z.', confirmLabel: 'Clear', danger: true })) clearScene() }}
            onHome={requestHome}
            projectName={projectName}
            onRenameProject={(n) => activeId && renameActive(activeId, n)}
            onExport={handleExport}
            onImport={() => importRef.current?.click()}
            onSave={handleSave}
            dirty={dirty}
          />
        </div>}

        {/* ── FLOATING left nav (UNS namespace tree) — hidden under the dashboard ── */}
        {!dashOn && <FloatingPanel side="left">
          {editMode ? <BuildLeftPanel /> : <div style={COL_L}><HierarchyPanel editMode={false} /></div>}
        </FloatingPanel>}

        {/* ── FLOATING inspector — build mode, on selection (sits next to the nav) ── */}
        <AnimatePresence>
          {editMode && (selectedGroupId || selectedId || selectedConnectionId) && (
            <motion.div key="inspector" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{ position: 'absolute', left: leftEdge, top: 74, bottom: 12, width: 300, zIndex: 20,
                background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.panel, overflow: 'hidden', display: 'flex' }}>
              {selectedGroupId ? <GroupInspector groupId={selectedGroupId} /> : <BuildRightPanel />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FLOATING right panel — build: AI assistant · view: overview/inspector ── */}
        {!dashOn && <FloatingPanel side="right">
          {editMode
            ? <ChatPanel surface="scene" />
            : (selectedGroupId
                ? <GroupInspector groupId={selectedGroupId} />
                : <ViewRightPanel objects={objects} selectedObj={selectedObj} onClose={clearSelection} />)}
        </FloatingPanel>}

        {/* ── Window-level overlays ── */}
        <AnimatePresence>
          {editMode && assetLibraryOpen && <AssetLibraryModal onClose={toggleAssetLibrary} />}
        </AnimatePresence>
        <AnimatePresence>
          {leaveOpen && (
            <LeaveConfirm projectName={projectName}
              onSave={() => { saveActive(); setLeaveOpen(false); goHome() }}
              onDiscard={() => { setLeaveOpen(false); goHome() }}
              onCancel={() => setLeaveOpen(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {cloudAsk && <CloudSaveModal projectName={projectName} onClose={() => setCloudAsk(false)} />}
        </AnimatePresence>
        {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
        {helpOpen && <ShortcutsOverlay onClose={() => setHelpOpen(false)} />}
      </div>
    </SceneErrorBoundary>
  )
}


// Dev-only determinism hook for the visual-parity harness: freezes the R3F
// clock + frame loop at a fixed time so screenshots are reproducible, and
// exposes a useFrame-subscriber census for perf tracking.
function DevFreezeHook() {
  const three = useThree()
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__dt = {
      ...(window.__dt || {}),
      freeze: (t = 42) => {
        clearInterval(window.__dt?.simTimer)
        three.set({ frameloop: 'never' })
        three.clock.stop()
        three.clock.elapsedTime = t
        three.advance(t); three.advance(t)
        window.__dt.step = () => three.advance(t)
      },
      frameSubCount: () => three.internal.subscribers.length,
      workerTris: () => { let n = 0; three.scene.traverse(o => { for (let a = o; a; a = a.parent) if (a.name === 'worker-1') { if (o.isMesh && o.geometry) { const g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3 } break } }); return Math.round(n) },
      // Structural digest: every mesh's identity/transform/material — the
      // deterministic "did anything visible change" check (rotation excluded:
      // spin parts accumulate per rendered frame, load-timing-dependent)
      sceneDigest: () => {
        const v = new THREE.Vector3()
        const out = []
        three.scene.traverse((n) => {
          if (!n.isMesh) return
          // walking workers: gait phase is RNG-order/float-accumulation volatile
          for (let a = n; a; a = a.parent) if (a.name && a.name.startsWith('worker-')) return
          const m = Array.isArray(n.material) ? n.material[0] : n.material
          const nm = n.name || n.parent?.name || '?'
          // Unnamed meshes are helper/overlay visuals (alert rings, beacons,
          // selection FX) whose pulse phase / throttled measurements are
          // animation-timing volatile — reduce them to existence + colour.
          if (nm === '?') { out.push(['V', n.geometry?.type || '', n.visible ? 1 : 0, m?.color ? m.color.getHexString() : ''].join('|')); return }
          n.getWorldPosition(v)
          out.push([nm, n.geometry?.type || '',
            n.visible ? 1 : 0,
            Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10, Math.round(v.z * 10) / 10,
            Math.round(n.scale.x * 100) / 100, Math.round(n.scale.y * 100) / 100,
            m?.color ? m.color.getHexString() : '', m?.emissive ? m.emissive.getHexString() : '',
            Math.round((m?.opacity ?? 1) * 100), Math.round((m?.emissiveIntensity ?? 0) * 100)].join('|'))
        })
        return out.sort().join('\n')
      },
    }
  }, [three])
  return null
}


// While the dashboard overlay fully covers the main view (only the small live
// preview shows 3D), regenerating the 4096^2 PCSS shadow map every frame is
// waste — pulse it at 2 Hz instead, restoring full auto-update on the twin.
function ShadowCadence({ on }) {
  const gl = useThree((s2) => s2.gl)
  useEffect(() => {
    if (!on) return
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    const iv = setInterval(() => { gl.shadowMap.needsUpdate = true }, 500)
    return () => { clearInterval(iv); gl.shadowMap.autoUpdate = true; gl.shadowMap.needsUpdate = true }
  }, [on, gl])
  return null
}
