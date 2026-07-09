import { create } from 'zustand'
import { useProjectStore } from './projectStore'
import { useSceneStore } from './sceneStore'
import { blankSpec, blankPart, blankComponentPart, blankGroupPart, blankLogicalPart, validateComponentSpec, normalizeSpec } from '../lib/componentSpec'
import { getComponentDef } from '../lib/componentDefs'
import { expandSubToParts } from '../lib/componentSubs'
import { nanoid } from 'nanoid'

// All descendant part ids of `id` (for cycle-guard + cascade delete).
function descendantPartIds(parts, id) {
  const out = new Set(), stack = [id]
  while (stack.length) {
    const pid = stack.pop()
    for (const p of parts) if ((p.parentId || null) === pid) { out.add(p.id); stack.push(p.id) }
  }
  return out
}

// Holds the in-progress Component Spec for the full-screen Component Studio.
// Opening flips projectStore.view → 'studio'; closing returns to 'editor'.
// Not persisted — a draft only lives for the authoring session.
export const useStudioStore = create((set, get) => ({
  editingId: null,   // custom type id being edited, or null when authoring a new one
  draft: null,       // the working Component Spec
  selPart: null,     // selected part id (a node in the hierarchy)
  selSub: null,      // selected sub-component id (anodes / windows / …)
  rootSel: false,    // the component itself ("root") is selected
  selPort: null,
  tab: 'part',
  gizmoMode: 'translate',   // 'translate' | 'rotate' | 'scale' — in-canvas part gizmo
  returnView: 'editor',     // where Cancel/close returns (the view the Studio was opened from)

  openNew: () => {
    const d = blankSpec()
    const returnView = useProjectStore.getState().view === 'details' ? 'details' : 'editor'
    set({ editingId: null, draft: d, selPart: null, rootSel: false, selPort: null, returnView })
    useProjectStore.setState({ view: 'studio' })
  },
  openEdit: (id) => {
    const t = useSceneStore.getState().customAssetTypes[id]
    if (!t) return
    const d = normalizeSpec(t)
    const returnView = useProjectStore.getState().view === 'details' ? 'details' : 'editor'
    set({ editingId: id, draft: d, selPart: null, rootSel: false, selPort: null, returnView })
    useProjectStore.setState({ view: 'studio' })
  },
  close: () => { const rv = get().returnView || 'editor'; set({ draft: null, editingId: null }); useProjectStore.setState({ view: rv }) },

  // Replace the working draft with an imported spec (saving creates a NEW type).
  setDraftSpec: (spec) => set({ editingId: null, draft: spec, selPart: null, selSub: null, rootSel: false, selPort: null }),

  // Apply an incremental EDIT-COMPONENT command list from Bruce to the live draft.
  // Mirrors execute.applyCommands (ref aliases + per-op try/catch). editingId is
  // left untouched, so edits are in-place and Save updates the same type.
  applyComponentEdit: (commands) => {
    if (!Array.isArray(commands)) return { applied: 0, errors: ['Commands must be an array.'] }
    const draft = get().draft
    if (!draft) return { applied: 0, errors: ['No component open.'] }
    let parts = [...(draft.parts || [])]
    let ports = [...(draft.ports || [])]
    let parameters = [...(draft.parameters || [])]
    let states = draft.states
    const meta = { label: draft.label, category: draft.category, layer: draft.layer, beacon: draft.beacon }
    const refs = {}
    const rid = (v) => (typeof v === 'string' && v.startsWith('ref:') ? refs[v.slice(4)] : v) ?? null
    const setParam = (list, cmd) => {
      const key = cmd.key || `p_${nanoid(4)}`
      const field = { key, label: cmd.label || key, unit: cmd.unit || '', default: cmd.default ?? 0,
        ...(cmd.min != null ? { min: cmd.min } : {}), ...(cmd.max != null ? { max: cmd.max } : {}),
        ...(cmd.freq ? { freq: cmd.freq } : {}), ...(cmd.topic ? { topic: cmd.topic } : {}) }
      const i = list.findIndex(x => x.key === key)
      if (i >= 0) list[i] = { ...list[i], ...field }; else list.push(field)
      return list
    }
    let applied = 0; const errors = []
    for (const cmd of commands) {
      try {
        switch (cmd.op) {
          case 'set_meta':
            if (cmd.label != null) meta.label = String(cmd.label)
            if (cmd.category != null) meta.category = String(cmd.category)
            if (cmd.layer != null) meta.layer = String(cmd.layer)
            if ('beacon' in cmd) meta.beacon = cmd.beacon
            break
          case 'add_part': {
            const parentId = rid(cmd.parentId)
            let p = cmd.kind === 'group' ? blankGroupPart(parentId)
              : cmd.kind === 'logical' ? blankLogicalPart(parentId)
              : cmd.kind === 'component' ? blankComponentPart(cmd.componentRef || '', parentId)
              : blankPart(cmd.geometry || 'box', parentId)
            if (cmd.label != null) p.label = String(cmd.label)
            if (cmd.dims) p.dims = { ...(p.dims || {}), ...cmd.dims }
            if (cmd.position) p.position = cmd.position
            if (cmd.rotation) p.rotation = cmd.rotation
            if (cmd.scale) p.scale = cmd.scale
            if (cmd.material) p.material = { ...(p.material || {}), ...cmd.material }
            parts.push(p)
            if (cmd.alias) refs[cmd.alias] = p.id
            break
          }
          case 'update_part': {
            const id = rid(cmd.id); const i = parts.findIndex(p => p.id === id)
            if (i < 0) throw new Error(`unknown part ${id}`)
            const patch = cmd.patch || {}; const cur = parts[i]
            parts[i] = { ...cur, ...patch,
              ...(patch.dims ? { dims: { ...(cur.dims || {}), ...patch.dims } } : {}),
              ...(patch.material ? { material: { ...(cur.material || {}), ...patch.material } } : {}) }
            break
          }
          case 'remove_part': {
            const id = rid(cmd.id); const kill = descendantPartIds(parts, id); kill.add(id)
            parts = parts.filter(p => !kill.has(p.id))
            break
          }
          case 'add_repeated': {
            const parentId = rid(cmd.parentId)
            const group = blankGroupPart(parentId); group.label = cmd.groupLabel || 'Group'
            parts.push(group)
            if (cmd.alias) refs[cmd.alias] = group.id
            const def = { id: group.id, label: group.label, count: Math.max(1, Math.min(200, Math.round(cmd.count || 1))),
              layout: cmd.layout || { kind: 'row', step: 1, y: 0 },
              part: cmd.part || { geometry: 'box', dims: { width: 0.2, height: 0.2, depth: 0.2 }, material: {} },
              parameters: Array.isArray(cmd.parameters) ? cmd.parameters : [] }
            parts.push(...expandSubToParts(def, group.id))
            break
          }
          case 'add_port':
            ports.push({ id: `port_${nanoid(4)}`, type: cmd.type || 'utility', direction: cmd.direction || 'in', offset: cmd.offset || [0, 0.5, 0] })
            break
          case 'update_port': {
            const id = rid(cmd.id); const i = ports.findIndex(p => p.id === id)
            if (i < 0) throw new Error(`unknown port ${id}`)
            ports[i] = { ...ports[i], ...(cmd.patch || {}) }
            break
          }
          case 'remove_port':
            ports = ports.filter(p => p.id !== rid(cmd.id)); break
          case 'set_part_param': {
            const id = rid(cmd.partId); const i = parts.findIndex(p => p.id === id)
            if (i < 0) throw new Error(`unknown part ${id}`)
            parts[i] = { ...parts[i], parameters: setParam([...(parts[i].parameters || [])], cmd) }
            break
          }
          case 'remove_part_param': {
            const id = rid(cmd.partId)
            parts = parts.map(x => x.id === id ? { ...x, parameters: (x.parameters || []).filter(pp => pp.key !== cmd.key) } : x)
            break
          }
          case 'set_component_param':
            parameters = setParam([...parameters], cmd); break
          case 'set_states':
            states = Array.isArray(cmd.states) && cmd.states.length ? cmd.states : null; break
          default:
            throw new Error(`Unknown op "${cmd.op}"`)
        }
        applied++
      } catch (e) { errors.push(`${cmd.op}: ${e.message}`) }
    }
    set(s => ({ draft: { ...s.draft, ...meta, parts, ports, parameters, states } }))
    return { applied, errors }
  },

  // "Create editable copy": custom types open as-is; a BUILT-IN is cloned into a
  // custom spec that NESTS the built-in (component-ref part) + carries its config/
  // parameters/states/sub-components — looks identical, now extensible in the Studio.
  buildCopyOf: (objType) => {
    const scene = useSceneStore.getState()
    if (scene.customAssetTypes[objType]) { get().openEdit(objType); return }
    // Pull the WHOLE current definition from the single accessor so the copy is
    // faithful — config, parameters, states, ports.
    const def = getComponentDef(objType, scene.customAssetTypes)
    // The shell geometry as a nested-component part, then EACH sub-assembly expanded
    // into its own group of literal, individually editable parts (anodes, windows…).
    const parts = [{ id: `part_${nanoid(5)}`, kind: 'component', ref: objType, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], parentId: null, label: def.label, parameters: [] }]
    for (const sub of (def.subComponents || [])) {
      const group = blankGroupPart(null)
      group.label = sub.label
      parts.push(group, ...expandSubToParts(sub, group.id))
    }
    const id = scene.addCustomAssetType({
      label: `${def.label} (copy)`, category: 'Custom', layer: def.layer,
      parts,
      config: def.config,
      parameters: def.parameters,
      states: def.states,
      subComponents: [],            // now represented as literal parts above
      ports: def.ports,
      beacon: null,
    })
    get().openEdit(id)
  },

  setTab: (tab) => set({ tab }),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  patch: (p) => set(s => ({ draft: { ...s.draft, ...p } })),

  // ── selection (mutually exclusive: a part, a sub-component, or the root) ──
  selectPart: (id) => set({ selPart: id, selSub: null, rootSel: false }),
  selectSub: (id) => set({ selSub: id, selPart: null, rootSel: false }),
  selectRoot: () => set({ rootSel: true, selPart: null, selSub: null }),
  deselect: () => set({ selPart: null, selSub: null, rootSel: false }),

  // ── parts (a hierarchy: each part has parentId; group/logical/shape/component) ──
  addPart: (geometry = 'box', parentId = null) => set(s => { const p = blankPart(geometry, parentId); return { draft: { ...s.draft, parts: [...s.draft.parts, p] }, selPart: p.id, selSub: null, rootSel: false } }),
  addComponentPart: (ref, parentId = null) => set(s => { const p = blankComponentPart(ref, parentId); return { draft: { ...s.draft, parts: [...s.draft.parts, p] }, selPart: p.id, selSub: null, rootSel: false } }),
  addGroupPart: (parentId = null) => set(s => { const p = blankGroupPart(parentId); return { draft: { ...s.draft, parts: [...s.draft.parts, p] }, selPart: p.id, selSub: null, rootSel: false } }),
  addLogicalPart: (parentId = null) => set(s => { const p = blankLogicalPart(parentId); return { draft: { ...s.draft, parts: [...s.draft.parts, p] }, selPart: p.id, selSub: null, rootSel: false } }),
  updatePart: (id, patch) => set(s => ({ draft: { ...s.draft, parts: s.draft.parts.map(pt => (pt.id === id ? { ...pt, ...patch } : pt)) } })),
  removePart: (id) => set(s => {
    const kill = descendantPartIds(s.draft.parts, id); kill.add(id)
    const parts = s.draft.parts.filter(pt => !kill.has(pt.id))
    return { draft: { ...s.draft, parts }, selPart: kill.has(s.selPart) ? (parts[0]?.id ?? null) : s.selPart }
  }),
  // Reparent + reorder a part (drop "before" beforeId, or append under newParentId).
  // Cycle-guarded: a part can't move under itself or a descendant.
  moveNodePart: (id, newParentId = null, beforeId = null) => set(s => {
    if (id === newParentId) return {}
    if (newParentId && descendantPartIds(s.draft.parts, id).has(newParentId)) return {}
    const moved = s.draft.parts.find(p => p.id === id)
    if (!moved) return {}
    const rest = s.draft.parts.filter(p => p.id !== id)
    const updated = { ...moved, parentId: newParentId || null }
    let idx = rest.length
    if (beforeId) { const bi = rest.findIndex(p => p.id === beforeId); if (bi >= 0) idx = bi }
    rest.splice(idx, 0, updated)
    return { draft: { ...s.draft, parts: rest } }
  }),
  movePart: (id, dir) => set(s => {
    const parts = [...s.draft.parts]; const i = parts.findIndex(p => p.id === id); const j = i + dir
    if (i < 0 || j < 0 || j >= parts.length) return {}
    ;[parts[i], parts[j]] = [parts[j], parts[i]]
    return { draft: { ...s.draft, parts } }
  }),

  // ── per-part parameters (authoring; telemetry binding is future work) ──
  addPartParam: (partId, label = 'Parameter', unit = '') => set(s => ({
    draft: { ...s.draft, parts: s.draft.parts.map(pt => pt.id === partId
      ? { ...pt, parameters: [...(pt.parameters || []), { key: `p_${nanoid(4)}`, label, unit, default: 0 }] } : pt) },
  })),
  updatePartParam: (partId, key, patch) => set(s => ({
    draft: { ...s.draft, parts: s.draft.parts.map(pt => pt.id === partId
      ? { ...pt, parameters: (pt.parameters || []).map(pp => pp.key === key ? { ...pp, ...patch } : pp) } : pt) },
  })),
  removePartParam: (partId, key) => set(s => ({
    draft: { ...s.draft, parts: s.draft.parts.map(pt => pt.id === partId
      ? { ...pt, parameters: (pt.parameters || []).filter(pp => pp.key !== key) } : pt) },
  })),

  // ── ports ──
  selectPort: (id) => set({ selPort: id }),
  addPort: () => set(s => { const p = { id: `port_${nanoid(4)}`, type: 'product', direction: 'in', offset: [0, 0.5, 0] }; return { draft: { ...s.draft, ports: [...s.draft.ports, p] }, selPort: p.id } }),
  updatePort: (id, patch) => set(s => ({ draft: { ...s.draft, ports: s.draft.ports.map(pt => (pt.id === id ? { ...pt, ...patch } : pt)) } })),
  removePort: (id) => set(s => ({ draft: { ...s.draft, ports: s.draft.ports.filter(pt => pt.id !== id) }, selPort: s.selPort === id ? null : s.selPort })),

  // ── schema (config / parameters) ──
  setSchema: (which, defs) => set(s => ({ draft: { ...s.draft, [which]: defs } })),   // which: 'config' | 'parameters'

  // ── save ──
  // Validates the draft, then either UPDATES the existing type in place (every
  // placed instance changes) or saves a NEW copy (original preserved) — the Studio
  // asks which when editing. `asCopy` forces a new type. Optionally drops one into
  // the scene. Returns the type id (or null on error).
  save: ({ addToScene = false, asCopy = false } = {}) => {
    const { draft, editingId } = get()
    const res = validateComponentSpec(draft)
    if (!res.ok) return { ok: false, error: res.errors[0] || 'Invalid component.' }
    const scene = useSceneStore.getState()
    let id = editingId
    if (id && !asCopy) scene.updateCustomAssetType(id, res.spec)   // edit existing → all occurrences update
    else id = scene.addCustomAssetType(res.spec)                   // new, or a copy that preserves the original
    // The component stays PROJECT-LOCAL (it travels in the project snapshot). It
    // reaches the shared cloud library only when the PROJECT is saved to cloud
    // (projectStore.cloudPush publishes the project's components).
    if (addToScene) {
      const pos = [(Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8]
      const oid = scene.addObject(id, pos, res.spec.layer || 'equipment')
      scene.selectObject?.(oid)
    }
    get().close()
    return { ok: true, id }
  },
}))
