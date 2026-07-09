import { useMemo, useCallback, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow,
  BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react'
import { useSceneStore } from '../../store/sceneStore'
import { getPorts, primaryPort, MACHINE_LIBRARY, groupCustomTypes } from '../../lib/machineLibrary'
import { getParameterSchema } from '../../lib/parameterSchemas'
import { flattenConnections } from '../../lib/connectionSelectors'
import { FlowNode } from './FlowNode'

const nodeTypes = { asset: FlowNode }

// Flow node positions MIRROR the 3D scene: 2D (x,y) ⇆ 3D (x,z), scaled. Moving a
// card moves the machine and vice-versa. ~26 px per metre keeps a typical line in view.
const M_TO_PX = 26
// Environment fixtures aren't process nodes — never show them in the flow graph.
const FLOW_HIDE = new Set(['Floor', 'Light'])

// Selectable connector types (the "connector library"). Mirrors CONNECTOR_SCHEMAS keys.
const CONNECTOR_TYPES = [
  { type: 'conveyor', label: 'Conveyor Belt', desc: 'Moving belt carrying items' },
  { type: 'pipe',     label: 'Pipe',          desc: 'Fluid / utility line' },
  { type: 'busbar',   label: 'Bus Bar',       desc: 'Electrical power bus' },
]
// Same rule as the store's deriveConnectorType, for pre-selecting the default in the UI.
function defaultConnectorType(srcObj, sourcePortId) {
  const sp = getPorts(srcObj).find(p => p.id === sourcePortId)
  if (sp?.type === 'conveyor') return 'conveyor'
  if (sp?.type === 'power') return 'busbar'
  return 'pipe'
}

// Edge with n8n-style midpoint buttons: a "+" to insert a component on the line
// (shown on hover or when selected) and a "×" to delete (shown when selected).
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, selected, data }) {
  const removeConnectionById = useSceneStore(s => s.removeConnectionById)
  const [hover, setHover] = useState(false)
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const show = hover || selected
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div className="nodrag nopan"
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all', display: 'flex', alignItems: 'center', gap: 6, padding: 8 }}>
          <button title="Insert component here"
            onClick={(e) => { e.stopPropagation(); data?.onInsert?.(id, e) }}
            style={{ display: show ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', background: '#0a84ff', color: '#fff',
              fontSize: 17, lineHeight: 1, cursor: 'pointer', boxShadow: '0 2px 8px rgba(10,132,255,0.45)' }}>+</button>
          <button title="Remove connection"
            onClick={(e) => { e.stopPropagation(); removeConnectionById(id) }}
            style={{ display: selected ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', background: '#ff3b30', color: '#fff',
              fontSize: 14, lineHeight: 1, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>×</button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
const edgeTypes = { deletable: DeletableEdge }

const CONNECTOR_STROKE = { conveyor: '#0a84ff', pipe: '#8e8e93', busbar: '#b87333' }

/* ── Component picker (the "+" menu) ─────────────────────────────── */
function AddPicker({ at, onPick, onClose }) {
  const customAssetTypes = useSceneStore(s => s.customAssetTypes)
  const [q, setQ] = useState('')
  const query = q.toLowerCase().trim()
  const match = (label) => !query || label.toLowerCase().includes(query)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
      <div style={{
        position: 'fixed', left: Math.min(at.x, window.innerWidth - 280), top: Math.min(at.y, window.innerHeight - 360),
        width: 260, maxHeight: 360, zIndex: 50, display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, boxShadow: '0 16px 50px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}>
        <input autoFocus placeholder="Add component…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ margin: 10, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13,
            border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, color: '#1d1d1f' }} />
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {MACHINE_LIBRARY.map(({ category, items }) => {
            const shown = items.filter(it => match(it.label))
            if (!shown.length) return null
            return (
              <div key={category}>
                <p style={{ padding: '8px 12px 4px', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
                  textTransform: 'uppercase', color: '#a1a1a6' }}>{category}</p>
                {shown.map(it => (
                  <div key={it.type} onClick={() => onPick(it.type, it.layer)} style={{
                    padding: '7px 12px', margin: '0 6px', borderRadius: 7, fontSize: 13, color: '#1d1d1f', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,132,255,0.10)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{it.label}</div>
                ))}
              </div>
            )
          })}
          {groupCustomTypes(customAssetTypes, match).map(({ category, items }) => (
            <div key={category}>
              <p style={{ padding: '8px 12px 4px', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
                textTransform: 'uppercase', color: '#a1a1a6' }}>{category}</p>
              {items.map(ct => (
                <div key={ct.id} onClick={() => onPick(ct.id, ct.layer)} style={{
                  padding: '7px 12px', margin: '0 6px', borderRadius: 7, fontSize: 13, color: '#1d1d1f', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,132,255,0.10)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{ct.label}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ── Connector-type chooser (pops on connect) ────────────────────── */
function ConnectorPicker({ at, defaultType, onPick, onClose }) {
  const ordered = [...CONNECTOR_TYPES].sort((a, b) => (a.type === defaultType ? -1 : b.type === defaultType ? 1 : 0))
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
      <div style={{
        position: 'fixed', left: Math.min(at.x, window.innerWidth - 260), top: Math.min(at.y, window.innerHeight - 220),
        width: 240, zIndex: 50, padding: 6,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, boxShadow: '0 16px 50px rgba(0,0,0,0.22)',
      }}>
        <p style={{ padding: '8px 10px 6px', fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', color: '#a1a1a6' }}>Connector type</p>
        {ordered.map(ct => (
          <div key={ct.type} onClick={() => onPick(ct.type)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', margin: '0 2px 2px', borderRadius: 8, cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10,132,255,0.10)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: CONNECTOR_STROKE[ct.type] }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1d1d1f' }}>
                {ct.label}{ct.type === defaultType ? ' ·' : ''}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#a1a1a6' }}>{ct.desc}</span>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function FlowPaneInner() {
  const objects              = useSceneStore(s => s.objects)
  const selectedId           = useSceneStore(s => s.selectedId)
  const selectedConnectionId = useSceneStore(s => s.selectedConnectionId)
  const customAssetTypes     = useSceneStore(s => s.customAssetTypes)
  const updateObject         = useSceneStore(s => s.updateObject)
  const commitTransform      = useSceneStore(s => s.commitTransform)
  const addConnection        = useSceneStore(s => s.addConnection)
  const addObject            = useSceneStore(s => s.addObject)
  const selectObject         = useSceneStore(s => s.selectObject)
  const selectConnection     = useSceneStore(s => s.selectConnection)
  const clearSelection       = useSceneStore(s => s.clearSelection)
  const removeObject         = useSceneStore(s => s.removeObject)
  const removeConnectionById = useSceneStore(s => s.removeConnectionById)

  const { screenToFlowPosition } = useReactFlow()

  // picker state + a pending connection captured from a handle-drag
  const [picker, setPicker] = useState(null)        // { x, y, mode:'add'|'insert' } or null
  const [connPicker, setConnPicker] = useState(null) // { x, y, pending, defaultType } or null
  const pendingConnect = useRef(null)               // { nodeId, handleId } | null  (handle-drag)
  const pendingFlowPos = useRef(null)               // { x, y } flow coords | null
  const pendingInsert  = useRef(null)               // connId being split | null
  const justConnected  = useRef(false)              // suppress add-picker right after a real connect

  // "+" on an edge → open the component picker in insert mode for that connection.
  // Capture the click point so the inserted node lands between the two machines.
  const openInsert = useCallback((connId, e) => {
    pendingInsert.current = connId
    pendingConnect.current = null
    pendingFlowPos.current = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setPicker({ x: e.clientX, y: e.clientY + 8, mode: 'insert' })
  }, [screenToFlowPosition])

  // Node position MIRRORS the 3D scene (x,z) — moving a card moves the machine.
  const nodes = useMemo(() => Object.values(objects).filter(o => !FLOW_HIDE.has(o.type)).map(o => ({
    id: o.id, type: 'asset',
    position: { x: (o.position?.[0] ?? 0) * M_TO_PX, y: (o.position?.[2] ?? 0) * M_TO_PX },
    selected: o.id === selectedId,
    data: {
      name: o.name, type: o.type, status: o.status,
      inPort:  primaryPort(o, 'in')?.id ?? null,
      outPort: primaryPort(o, 'out')?.id ?? null,
      // Parameter NAMES only — no live values on the cards.
      params: getParameterSchema(o.type, customAssetTypes).slice(0, 4).map(f => f.label),
    },
  })), [objects, selectedId, customAssetTypes])

  const edges = useMemo(() => flattenConnections(objects)
    .filter(c => !FLOW_HIDE.has(objects[c.sourceId]?.type) && !FLOW_HIDE.has(objects[c.targetId]?.type))
    .map(c => {
      const stroke = c.id === selectedConnectionId ? '#0a84ff' : (CONNECTOR_STROKE[c.connectorType] ?? '#8e8e93')
      return {
        id: c.id, source: c.sourceId, target: c.targetId,
        sourceHandle: c.sourcePort, targetHandle: c.targetPort,
        type: 'deletable',
        selected: c.id === selectedConnectionId,
        animated: c.connectorType === 'conveyor' || (c.connectorType === 'pipe' && c.connectorConfig?.flowing !== false),
        data: { onInsert: openInsert },
        style: { stroke, strokeWidth: c.id === selectedConnectionId ? 3.5 : 2.5 },
      }
    }), [objects, selectedConnectionId, openInsert])

  // Dragging a card writes back to the machine's 3D position (live, no history).
  const onNodesChange = useCallback((changes) => {
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position) {
        const o = useSceneStore.getState().objects[ch.id]
        if (o) updateObject(ch.id, { position: [ch.position.x / M_TO_PX, o.position?.[1] ?? 0, ch.position.y / M_TO_PX] })
      }
    }
  }, [updateObject])

  // Connecting two nodes → ask for the connector type, then create it.
  const onConnect = useCallback((c) => {
    if (c.source && c.target && c.source !== c.target) {
      justConnected.current = true   // suppress the add-component picker in onConnectEnd
      const srcObj = useSceneStore.getState().objects[c.source]
      setConnPicker({
        x: window.innerWidth / 2, y: window.innerHeight / 2,
        defaultType: defaultConnectorType(srcObj, c.sourceHandle),
        pending: { source: c.source, sourceHandle: c.sourceHandle, target: c.target, targetHandle: c.targetHandle },
      })
    }
  }, [])

  const handleConnectorPick = (connectorType) => {
    const p = connPicker?.pending
    if (p) addConnection(p.source, p.sourceHandle, p.target, p.targetHandle, connectorType)
    setConnPicker(null)
  }

  // n8n: start a drag from an output handle…
  const onConnectStart = useCallback((_, params) => {
    pendingConnect.current = params?.handleType === 'source'
      ? { nodeId: params.nodeId, handleId: params.handleId } : null
  }, [])

  // …release on empty canvas → open the picker, pre-wired to auto-connect.
  const onConnectEnd = useCallback((event) => {
    // A real connection just fired (onConnect runs first) → connector picker only,
    // never the add-component menu.
    if (justConnected.current) { justConnected.current = false; pendingConnect.current = null; return }
    const droppedOnPane = event.target?.classList?.contains?.('react-flow__pane')
    if (pendingConnect.current && droppedOnPane) {
      const { clientX, clientY } = event.changedTouches?.[0] ?? event
      pendingFlowPos.current = screenToFlowPosition({ x: clientX, y: clientY })
      setPicker({ x: clientX, y: clientY, mode: 'add' })
    } else {
      pendingConnect.current = null
    }
  }, [screenToFlowPosition])

  const openAddMenu = (e) => {
    pendingConnect.current = null
    pendingInsert.current = null
    pendingFlowPos.current = screenToFlowPosition({ x: e.clientX + 40, y: e.clientY + 10 })
    setPicker({ x: e.clientX, y: e.clientY + 8, mode: 'add' })
  }

  // Place a newly-added node at the flow drop point, mapped to a 3D position.
  const placeAtDrop = (id) => {
    const fp = pendingFlowPos.current
    if (!fp) return
    const o = useSceneStore.getState().objects[id]
    updateObject(id, { position: [fp.x / M_TO_PX, o?.position?.[1] ?? 0, fp.y / M_TO_PX] })
  }

  const handlePick = (type, layer) => {
    const id = addObject(type, [0, 0, 0], layer)
    const newObj = useSceneStore.getState().objects[id]

    if (pendingInsert.current) {
      // Insert the new component on an existing connection: A→B becomes A→new→B.
      const conn = flattenConnections(useSceneStore.getState().objects).find(c => c.id === pendingInsert.current)
      const inP = primaryPort(newObj, 'in')
      const outP = primaryPort(newObj, 'out')
      if (conn && inP && outP) {
        removeConnectionById(conn.id)
        addConnection(conn.sourceId, conn.sourcePort, id, inP.id, conn.connectorType)
        addConnection(id, outP.id, conn.targetId, conn.targetPort, conn.connectorType)
        placeAtDrop(id)
        selectObject(id)
        closePicker()
        return
      }
      // Component has no in/out port — can't splice; leave it placed but unconnected.
      console.warn('[FlowPane] inserted component lacks in/out ports; left unconnected:', type)
    }

    placeAtDrop(id)
    // auto-connect when the node was created by dragging from a handle
    const src = pendingConnect.current
    if (src) {
      const inP = primaryPort(newObj, 'in')
      if (inP) addConnection(src.nodeId, src.handleId, id, inP.id)
    }
    selectObject(id)
    closePicker()
  }

  const closePicker = () => {
    setPicker(null)
    pendingConnect.current = null
    pendingFlowPos.current = null
    pendingInsert.current = null
  }

  return (
    <div data-flowpane style={{ position: 'relative', width: '100%', height: '100%', background: '#f0f2f6' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={() => commitTransform()}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={(_, n) => selectObject(n.id)}
        onEdgeClick={(_, e) => selectConnection(e.id)}
        onPaneClick={() => clearSelection()}
        onEdgesDelete={(eds) => eds.forEach(e => removeConnectionById(e.id))}
        onNodesDelete={(nds) => nds.forEach(n => removeObject(n.id))}
        deleteKeyCode={['Delete', 'Backspace']}
        selectionKeyCode={null}
        connectionLineStyle={{ stroke: '#0a84ff', strokeWidth: 2.5 }}
        defaultEdgeOptions={{ type: 'deletable', style: { stroke: '#0a84ff', strokeWidth: 2.5 } }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1.5} color="#cfd6e0" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.06)" />
      </ReactFlow>

      {/* Add-component button (n8n-style) — top-centre so the floating nav doesn't cover it */}
      <button onClick={openAddMenu} title="Add component" style={{
        position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
        height: 38, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#0a84ff', color: '#fff', border: 'none', borderRadius: 10,
        boxShadow: '0 4px 14px rgba(10,132,255,0.35)', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span> Add Component
      </button>

      {!Object.keys(objects).length && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', color: '#8e8e93', fontSize: 14 }}>
          Click “＋ Add Component” to start your process flow
        </div>
      )}

      {picker && <AddPicker at={picker} onPick={handlePick} onClose={closePicker} />}
      {connPicker && <ConnectorPicker at={connPicker} defaultType={connPicker.defaultType}
        onPick={handleConnectorPick} onClose={() => setConnPicker(null)} />}
    </div>
  )
}

export function FlowPane() {
  return (
    <ReactFlowProvider>
      <FlowPaneInner />
    </ReactFlowProvider>
  )
}
