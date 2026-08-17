import { create } from 'zustand'
import { throttledStorage } from '../lib/persistThrottle'
import { persist }  from 'zustand/middleware'
import { nanoid }   from 'nanoid'
import { getDefaultConfig, withConfigDefaults } from '../lib/assetSchemas'
import { getDefaultParameters, withParameterDefaults, getParameterSchema, coerceParameterValue, paramFreqMs } from '../lib/parameterSchemas'
import { getDefaultConnectorConfig } from '../lib/connectorSchemas'
import { getPorts, defaultLayerForType, MACHINE_LIBRARY } from '../lib/machineLibrary'
import { defaultState, statusFromState, stateFromStatus, getStateSchema } from '../lib/stateSchemas'
import { stepSimulation, resetSim } from '../lib/oee'
import { nextOrder, descendantObjectIds, isDescendantGroup, groupCentroidBounds, childrenOf, normalizeHierarchy } from '../lib/hierarchy'
import { setCustomTypes } from '../lib/customTypesRef'
import { getLibraryComponents } from '../lib/libraryRef'
import { THERMAL_POWER_PLANT, TOOLTIP_DEFAULTS, MAIN_MACHINES } from '../lib/templates/thermalPowerPlant'
import { BOTTLING_PLANT } from '../lib/templates/bottlingPlant'
import { COAL_MINE } from '../lib/templates/coalMine'
import { MEDIUM_STYLE, mediumOf, LEGACY_PIPE_COLORS } from '../lib/pipeMedia'

// Derive the connector kind from the source port type:
// conveyor → belt, power → bus bar, everything else → pipe.
function deriveConnectorType(sourceObj, sourcePortId) {
  const sp = getPorts(sourceObj).find(p => p.id === sourcePortId)
  if (sp?.type === 'conveyor') return 'conveyor'
  if (sp?.type === 'power') return 'busbar'
  return 'pipe'
}

const MAX_HISTORY = 50

function clone(x) {
  return JSON.parse(JSON.stringify(x))
}

// Appends a SCENE snapshot ({objects, groups}) and returns history delta.
// history[_historyIndex] = current scene; undo = go to [index-1]. Groups default
// to the current store groups so existing single-arg callers stay correct.
function pushHistory(state, newObjects, newGroups = state.groups) {
  const trimmed = state._history.slice(0, state._historyIndex + 1)
  trimmed.push({ objects: clone(newObjects), groups: clone(newGroups ?? {}) })
  if (trimmed.length > MAX_HISTORY) trimmed.shift()
  return { _history: trimmed, _historyIndex: trimmed.length - 1 }
}

// Resolve an object's hover-tooltip on load: auto-enable MAIN machines that lack
// one, and drop the auto-default from non-main machines (over-applied by an older
// build). A user-customised selection (params differ from the default) is kept.
const sameParams = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i])
function resolveTooltip(type, tooltip) {
  const def = TOOLTIP_DEFAULTS[type]
  if (!tooltip) return (def && MAIN_MACHINES.has(type)) ? { enabled: true, params: [...def] } : undefined
  if (def && !MAIN_MACHINES.has(type) && tooltip.enabled && sameParams(tooltip.params, def)) return undefined
  return tooltip
}

const store = (set, get) => ({
  // ── Scene objects ────────────────────────────────────────────────
  objects: {},

  // ── User-defined custom asset types (persisted, not in undo history) ─
  // key = custom type id, value = { id, label, primitive, layer, defaultConfig }
  customAssetTypes: {},

  // ── Layers ──────────────────────────────────────────────────────
  layers: {
    equipment:   { name: 'Equipment',   visible: true, locked: false },
    conveyors:   { name: 'Conveyors',   visible: true, locked: false },
    piping:      { name: 'Piping',      visible: true, locked: false },
    structural:  { name: 'Structural',  visible: true, locked: false },
    annotations: { name: 'Annotations', visible: true, locked: false },
  },

  // ── UNS hierarchy (persisted) — unlimited nested groups; objects carry
  // parentId (group id | null) + order. Tree is derived in src/lib/hierarchy.js.
  groups: {},

  // ── UI state ─────────────────────────────────────────────────────
  selectedId:           null,
  selectedConnectionId: null,
  selectedGroupId:      null,
  activeLayer:          'equipment',
  editMode:             false,
  transformMode:        'translate',

  // ── Workspace layout (dual-pane + asset library flyout) ──────────
  paneMode:         'scene',   // 'scene' | 'split'
  assetLibraryOpen: false,
  flowLayout:       {},        // { [objId]: { x, y } } — 2D node positions, independent of 3D position
  environment:      {},        // scene-level env config: { sky, ground, grid, postfx } — set by loadScene
  tour:             {},        // scene-level guided-tour config: { beats: [...] } — set by loadScene
  dashboard:        {},        // scene-level ops-dashboard config: { landing, preview } — set by loadScene

  setPaneMode:        (mode) => set({ paneMode: mode }),
  toggleAssetLibrary: ()     => set(s => ({ assetLibraryOpen: !s.assetLibraryOpen })),
  setFlowNodePosition: (id, pos) => set(s => ({ flowLayout: { ...s.flowLayout, [id]: pos } })),
  // Replace the whole flow layout in one shot (used by Tidy Up / auto-layout).
  setFlowLayout: (map) => set(() => ({ flowLayout: { ...map } })),

  // ── Undo/Redo history (not persisted) ────────────────────────────
  // _history[_historyIndex] = the current objects state.
  // Undo: go to [index-1]. Redo: go to [index+1].
  _history:      [],
  _historyIndex: -1,

  undo: () => {
    const { _history, _historyIndex } = get()
    if (_historyIndex <= 0) return
    const idx = _historyIndex - 1
    const snap = _history[idx]
    set({ objects: clone(snap.objects), groups: clone(snap.groups ?? {}),
      _historyIndex: idx, selectedId: null, selectedGroupId: null })
  },

  redo: () => {
    const { _history, _historyIndex } = get()
    if (_historyIndex >= _history.length - 1) return
    const idx = _historyIndex + 1
    const snap = _history[idx]
    set({ objects: clone(snap.objects), groups: clone(snap.groups ?? {}),
      _historyIndex: idx, selectedId: null, selectedGroupId: null })
  },

  // ── Object CRUD ──────────────────────────────────────────────────
  addObject: (type, position = [0, 0, 0], layer = 'equipment', initialConfig = {}, parentId = null) => {
    const id = nanoid(8)
    set(state => {
      const st = defaultState(type)
      // Name the object after its component's LABEL, not the raw type id
      // (custom types are `custom_xxx` — never show that to the user).
      const typeLabel = state.customAssetTypes[type]?.label
        || MACHINE_LIBRARY.flatMap(c => c.items).find(it => it.type === type)?.label
        || type
      const newObj = {
        id, type, name: typeLabel,
        position, rotation: [0, 0, 0], scale: [1, 1, 1],
        layer, state: st, status: statusFromState(type, st),
        locked: false, visible: true,
        parentId, order: nextOrder(state.objects, state.groups, parentId),
        connections: [], dataBindings: [],
        config: { ...getDefaultConfig(type, state.customAssetTypes), ...initialConfig },
        parameters: getDefaultParameters(type, state.customAssetTypes),
        rules: [],
      }
      const newObjects = { ...state.objects, [id]: newObj }
      return {
        objects: newObjects,
        selectedId: id,
        activeLayer: layer,
        ...pushHistory(state, newObjects),
      }
    })
    return id
  },

  removeObject: (id) => {
    set(state => {
      const { [id]: _, ...rest } = state.objects
      // strip any inbound connection targeting the removed object (connector cleanup)
      for (const k in rest) {
        if (rest[k].connections?.some(c => c.targetId === id)) {
          rest[k] = { ...rest[k], connections: rest[k].connections.filter(c => c.targetId !== id) }
        }
      }
      return {
        objects: rest,
        selectedId: state.selectedId === id ? null : state.selectedId,
        selectedConnectionId: null,
        ...pushHistory(state, rest),
      }
    })
  },

  // Swap an object's component type IN PLACE — keeps the exact transform
  // (position/rotation/scale), layer, parent and order, but resets config /
  // parameters / state to the new type's defaults. Connections are dropped (the
  // new component has different ports), including inbound ones from other objects.
  replaceObject: (id, newType) => {
    set(state => {
      const old = state.objects[id]
      if (!old || !newType || old.type === newType) return {}
      const st = defaultState(newType)
      const typeLabel = state.customAssetTypes[newType]?.label
        || MACHINE_LIBRARY.flatMap(c => c.items).find(it => it.type === newType)?.label
        || newType
      const replaced = {
        ...old,
        type: newType,
        name: typeLabel,
        state: st,
        status: statusFromState(newType, st),
        connections: [],
        config: getDefaultConfig(newType, state.customAssetTypes),
        parameters: getDefaultParameters(newType, state.customAssetTypes),
        rules: [],
      }
      const rest = { ...state.objects, [id]: replaced }
      // strip inbound connections that targeted the old object (ports changed)
      for (const k in rest) {
        if (k !== id && rest[k].connections?.some(c => c.targetId === id)) {
          rest[k] = { ...rest[k], connections: rest[k].connections.filter(c => c.targetId !== id) }
        }
      }
      return { objects: rest, activeLayer: replaced.layer, ...pushHistory(state, rest) }
    })
  },

  // Clone the object (offset, fresh id, no inherited connections) and select it.
  duplicateObject: (id) => {
    const src = get().objects[id]
    if (!src) return null
    const newId = nanoid(8)
    set(state => {
      const clone = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        name: `${src.name} copy`,
        position: [src.position[0] + 1.5, src.position[1], src.position[2] + 1.5],
        connections: [],
      }
      const newObjects = { ...state.objects, [newId]: clone }
      return { objects: newObjects, selectedId: newId, ...pushHistory(state, newObjects) }
    })
    return newId
  },

  // ── Clipboard (copy / paste) — session-only, not persisted ────────
  _clipboard: null,

  copyObject: (id) => {
    const src = get().objects[id]
    if (src) set({ _clipboard: JSON.parse(JSON.stringify(src)), _groupClipboard: null })
  },

  // Paste the clipboard as a new object; cascades on repeat pastes.
  pasteObject: () => {
    const clip = get()._clipboard
    if (!clip) return null
    const newId = nanoid(8)
    const pos = [clip.position[0] + 1.5, clip.position[1], clip.position[2] + 1.5]
    set(state => {
      const obj = {
        ...JSON.parse(JSON.stringify(clip)),
        id: newId,
        name: `${clip.name} copy`,
        position: pos,
        connections: [],
      }
      const newObjects = { ...state.objects, [newId]: obj }
      return {
        objects: newObjects,
        selectedId: newId,
        _clipboard: { ...clip, position: pos },   // cascade next paste
        ...pushHistory(state, newObjects),
      }
    })
    return newId
  },

  // ── Group clipboard — copy/paste a whole subtree (group + sub-groups +
  // assets) as a new parallel group named "Base (n)". Session-only.
  _groupClipboard: null,

  copyGroup: (id) => {
    const { objects, groups } = get()
    if (!groups[id]) return
    const grpList = [], objList = []
    const walk = (gid) => {
      for (const g of Object.values(groups)) if ((g.parentId ?? null) === gid) { grpList.push(g); walk(g.id) }
      for (const o of Object.values(objects)) if ((o.parentId ?? null) === gid) objList.push(o)
    }
    walk(id)
    set({ _groupClipboard: JSON.parse(JSON.stringify({ root: groups[id], groups: grpList, objects: objList, pastes: 0 })), _clipboard: null })
  },

  pasteGroup: () => {
    const clip = get()._groupClipboard
    if (!clip) return null
    let newRootId = null
    set(state => {
      const groups = { ...state.groups }
      const objects = { ...state.objects }
      const parentId = clip.root.parentId ?? null

      // unique sibling name "Base (n)"
      const base = clip.root.name.replace(/\s*\(\d+\)\s*$/, '')
      const names = new Set(Object.values(groups).filter(g => (g.parentId ?? null) === parentId).map(g => g.name))
      let n = 1; while (names.has(`${base} (${n})`)) n++

      // fresh ids for every group + object in the subtree
      const gMap = { [clip.root.id]: `grp_${nanoid(6)}` }
      for (const g of clip.groups) gMap[g.id] = `grp_${nanoid(6)}`
      const oMap = {}
      for (const o of clip.objects) oMap[o.id] = nanoid(8)

      const pastes = (clip.pastes ?? 0) + 1
      const DZ = 10 * pastes   // stack successive copies so they don't overlap

      groups[gMap[clip.root.id]] = { id: gMap[clip.root.id], name: `${base} (${n})`, parentId, order: nextOrder(objects, groups, parentId) }
      for (const g of clip.groups) {
        groups[gMap[g.id]] = { id: gMap[g.id], name: g.name, parentId: gMap[g.parentId] ?? null, order: g.order }
      }
      for (const o of clip.objects) {
        const nid = oMap[o.id]
        const conns = (o.connections ?? []).filter(c => oMap[c.targetId]).map(c => ({ ...c, id: nanoid(8), targetId: oMap[c.targetId] }))
        objects[nid] = {
          ...JSON.parse(JSON.stringify(o)),
          id: nid,
          parentId: gMap[o.parentId] ?? gMap[clip.root.id],
          position: [o.position[0], o.position[1], o.position[2] + DZ],
          connections: conns,
        }
      }
      newRootId = gMap[clip.root.id]
      return {
        objects, groups,
        selectedGroupId: newRootId, selectedId: null, selectedConnectionId: null,
        _groupClipboard: { ...clip, pastes },
        ...pushHistory(state, objects, groups),
      }
    })
    return newRootId
  },

  updateObject: (id, changes) => set(state => ({
    objects: { ...state.objects, [id]: { ...state.objects[id], ...changes } },
  })),

  // Batched parameter patch for the live simulators (chain, mine model) — one
  // store update for many assets so the per-second tick causes a single render.
  // patches = { id: { param: value, ... }, ... }. No undo history (live data).
  patchParams: (patches) => set(state => {
    const objects = { ...state.objects }
    for (const id in patches) {
      const o = objects[id]
      if (!o) continue
      objects[id] = { ...o, parameters: { ...o.parameters, ...patches[id] } }
    }
    return { objects }
  }),

  // Edit one config field. Snapshots into undo history (like cycleStatus).
  updateConfig: (id, key, value) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const newObjects = {
        ...state.objects,
        [id]: { ...obj, config: { ...obj.config, [key]: value } },
      }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Edit one telemetry parameter value (history-snapshotted like updateConfig).
  // Live data ingestion later should use a non-history batch setter instead.
  updateParameter: (id, key, value) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const newObjects = {
        ...state.objects,
        [id]: { ...obj, parameters: { ...obj.parameters, [key]: value } },
      }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Manual data entry (operator reading): set value + stamp the entry time.
  // No undo history (treated like live data, not a structural edit).
  setParameterValue: (id, key, value) => set(state => {
    const obj = state.objects[id]
    if (!obj) return {}
    const def = getParameterSchema(obj.type, state.customAssetTypes).find(d => d.key === key)
    const v = def ? coerceParameterValue(def, value) : Number(value)
    return { objects: { ...state.objects, [id]: { ...obj, parameters: { ...obj.parameters, [key]: v }, paramTimes: { ...(obj.paramTimes || {}), [key]: Date.now() } } } }
  }),

  // Set how often a parameter refreshes ('realtime' | '5s' | … | 'manual').
  setParamFrequency: (id, key, freq) => set(state => {
    const obj = state.objects[id]
    if (!obj) return {}
    const pm = { ...(obj.paramMeta || {}) }
    pm[key] = { ...(pm[key] || {}), frequency: freq }
    const objects = { ...state.objects, [id]: { ...obj, paramMeta: pm } }
    return { objects, ...pushHistory(state, objects) }
  }),

  // ── Custom parameters + UNS bindings (per asset) ─────────────────
  // Add a user-defined parameter (renders alongside the type's schema params).
  addParameter: (id, label, unit = '') => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const base = (label || 'param').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'param'
      let key = base, n = 1
      while (obj.parameters?.[key] !== undefined || obj.paramMeta?.[key]) key = `${base}_${n++}`
      const newObjects = {
        ...state.objects,
        [id]: { ...obj,
          parameters: { ...obj.parameters, [key]: 0 },
          paramMeta: { ...obj.paramMeta, [key]: { custom: true, label: label || key, unit, topic: '' } } },
      }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Remove a parameter — custom ones are dropped; schema ones are marked removed
  // (so the type default doesn't re-add them on reload).
  removeParameter: (id, key) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const params = { ...obj.parameters }; delete params[key]
      const meta = { ...obj.paramMeta }
      if (meta[key]?.custom) delete meta[key]
      else meta[key] = { ...meta[key], removed: true }
      const newObjects = { ...state.objects, [id]: { ...obj, parameters: params, paramMeta: meta } }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Bind a parameter to a UNS topic (empty string clears the binding).
  setParamTopic: (id, key, topic) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const meta = { ...obj.paramMeta, [key]: { ...obj.paramMeta?.[key], topic } }
      const newObjects = { ...state.objects, [id]: { ...obj, paramMeta: meta } }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // ── Hover tooltip config ─────────────────────────────────────────
  // Component tooltip: { enabled, params:[keys] } — merged onto obj.tooltip.
  setObjectTooltip: (id, tooltip) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const newObjects = { ...state.objects, [id]: { ...obj, tooltip: { ...obj.tooltip, ...tooltip } } }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Group tooltip: { enabled } — KPI card on hover (view mode).
  setGroupTooltip: (id, tooltip) => {
    set(state => {
      const g = state.groups[id]
      if (!g) return {}
      const newGroups = { ...state.groups, [id]: { ...g, tooltip: { ...g.tooltip, ...tooltip } } }
      return { groups: newGroups, ...pushHistory(state, state.objects, newGroups) }
    })
  },

  // ── Visual rules (per asset) ─────────────────────────────────────
  addRule: (id, partial = {}) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const firstParam = getParameterSchema(obj.type, state.customAssetTypes)[0]?.key ?? ''
      const rule = {
        id: nanoid(8), enabled: true,
        parameter: firstParam, operator: '>',
        compareMode: 'constant', value: 0,
        refAssetId: null, refParameter: '',
        color: '#ff3344',
        ...partial,
      }
      const newObjects = {
        ...state.objects,
        [id]: { ...obj, rules: [...(obj.rules ?? []), rule] },
      }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  updateRule: (id, ruleId, changes) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const rules = (obj.rules ?? []).map(r => (r.id === ruleId ? { ...r, ...changes } : r))
      const newObjects = { ...state.objects, [id]: { ...obj, rules } }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  removeRule: (id, ruleId) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const rules = (obj.rules ?? []).filter(r => r.id !== ruleId)
      const newObjects = { ...state.objects, [id]: { ...obj, rules } }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Snapshot current position into undo history — call on drag end.
  commitTransform: () => {
    set(state => ({ ...pushHistory(state, state.objects) }))
  },

  selectObject: (id) => {
    const obj = get().objects[id]
    set({ selectedId: id, selectedConnectionId: null, selectedGroupId: null, activeLayer: obj?.layer ?? get().activeLayer })
  },

  selectConnection: (id) => set({ selectedConnectionId: id, selectedId: null, selectedGroupId: null }),

  selectGroup: (id) => set({ selectedGroupId: id, selectedId: null, selectedConnectionId: null }),

  clearSelection: () => set({ selectedId: null, selectedConnectionId: null, selectedGroupId: null }),

  // ── UNS groups (nested namespace) ────────────────────────────────
  addGroup: (name = 'New Group', parentId = null) => {
    const id = `grp_${nanoid(6)}`
    set(state => {
      const groups = { ...state.groups, [id]: { id, name, parentId, order: nextOrder(state.objects, state.groups, parentId) } }
      return { groups, selectedGroupId: id, selectedId: null, selectedConnectionId: null,
        ...pushHistory(state, state.objects, groups) }
    })
    return id
  },

  renameGroup: (id, name) => {
    set(state => {
      const g = state.groups[id]
      if (!g) return {}
      const groups = { ...state.groups, [id]: { ...g, name } }
      return { groups, ...pushHistory(state, state.objects, groups) }
    })
  },

  // Delete a group, reparenting its direct children up to its own parent
  // (assets are never deleted).
  removeGroup: (id) => {
    set(state => {
      const g = state.groups[id]
      if (!g) return {}
      const up = g.parentId ?? null
      const objects = { ...state.objects }
      for (const k in objects) if ((objects[k].parentId ?? null) === id) objects[k] = { ...objects[k], parentId: up }
      const groups = { ...state.groups }
      for (const k in groups) if ((groups[k].parentId ?? null) === id) groups[k] = { ...groups[k], parentId: up }
      delete groups[id]
      return {
        objects, groups,
        selectedGroupId: state.selectedGroupId === id ? null : state.selectedGroupId,
        ...pushHistory(state, objects, groups),
      }
    })
  },

  // Reparent + reorder a node (group or object) under newParentId, inserted
  // before beforeNodeId (or appended when null). Cycle-guarded for groups.
  moveNode: (nodeId, newParentId = null, beforeNodeId = null) => {
    set(state => {
      const isGroup = !!state.groups[nodeId]
      if (isGroup && (nodeId === newParentId || isDescendantGroup(state.groups, nodeId, newParentId))) return {}

      const objects = { ...state.objects }
      const groups = { ...state.groups }

      // detach + reparent
      if (isGroup) groups[nodeId] = { ...groups[nodeId], parentId: newParentId }
      else         objects[nodeId] = { ...objects[nodeId], parentId: newParentId }

      // siblings under the new parent (excluding the moved node), in order
      const siblings = childrenOf(objects, groups, newParentId).filter(c => c.id !== nodeId)
      const insertAt = beforeNodeId ? Math.max(0, siblings.findIndex(c => c.id === beforeNodeId)) : siblings.length
      const ordered = [...siblings.slice(0, insertAt), { kind: isGroup ? 'group' : 'object', id: nodeId }, ...siblings.slice(insertAt)]
      ordered.forEach((c, i) => {
        if (groups[c.id]) groups[c.id] = { ...groups[c.id], order: i }
        else if (objects[c.id]) objects[c.id] = { ...objects[c.id], order: i }
      })
      return { objects, groups, ...pushHistory(state, objects, groups) }
    })
  },

  // Translate every asset under a group by a delta (no undo history; pairs with
  // commitTransform on drag/keyboard end — mirrors single-object move).
  translateGroupBy: (id, [dx, dy, dz]) => {
    set(state => {
      const ids = descendantObjectIds(state.objects, state.groups, id)
      if (ids.size === 0) return {}
      const objects = { ...state.objects }
      for (const oid of ids) {
        const o = objects[oid]
        objects[oid] = { ...o, position: [o.position[0] + dx, o.position[1] + dy, o.position[2] + dz] }
      }
      return { objects }
    })
  },

  flyToGroup: (id) => {
    const { objects, groups } = get()
    const { center, radius } = groupCentroidBounds(objects, groups, id)
    const [x, y, z] = center
    const d = Math.max(10, radius * 1.8)
    set({ cameraFlyTarget: [x, y + 1.5, z], cameraFlyPos: [x + d * 0.6, y + d * 0.7, z + d] })
  },

  // Set the rich per-type state; legacy status is derived from its severity.
  setState: (id, key) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const newObjects = {
        ...state.objects,
        [id]: { ...obj, state: key, status: statusFromState(obj.type, key) },
      }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Advance to the next state in this asset type's state machine (status derived).
  cycleStatus: (id) => {
    set(state => {
      const obj = state.objects[id]
      if (!obj) return {}
      const schema = getStateSchema(obj.type)
      const idx = Math.max(0, schema.findIndex(st => st.key === obj.state))
      const next = schema[(idx + 1) % schema.length].key
      const newObjects = {
        ...state.objects,
        [id]: { ...obj, state: next, status: statusFromState(obj.type, next) },
      }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // ── Connections (auto-create connectors) ────────────────────────
  // connectorTypeOverride (optional) lets the UI pick the connector type explicitly;
  // otherwise it's derived from the source port. Returns the new connection id (or null).
  addConnection: (sourceId, sourcePort, targetId, targetPort, connectorTypeOverride) => {
    const id = nanoid(8)
    let created = false
    set(state => {
      const src = state.objects[sourceId]
      const tgt = state.objects[targetId]
      if (!src || !tgt || sourceId === targetId) return {}
      // de-dupe identical edge
      const exists = src.connections.some(c =>
        c.targetId === targetId && c.sourcePort === sourcePort && c.targetPort === targetPort)
      if (exists) return {}
      const connectorType = connectorTypeOverride ?? deriveConnectorType(src, sourcePort)
      const record = {
        id,
        targetId, sourcePort, targetPort,
        connectorType,
        connectorConfig: getDefaultConnectorConfig(connectorType),
      }
      const newObjects = {
        ...state.objects,
        [sourceId]: { ...src, connections: [...src.connections, record] },
      }
      created = true
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
    return created ? id : null
  },

  removeConnection: (sourceId, targetId) => {
    set(state => {
      const newObjects = {
        ...state.objects,
        [sourceId]: {
          ...state.objects[sourceId],
          connections: state.objects[sourceId].connections.filter(c => c.targetId !== targetId),
        },
      }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // Remove a connection by its record id (finds the owning object).
  removeConnectionById: (connId) => {
    set(state => {
      let ownerId = null
      for (const k in state.objects) {
        if (state.objects[k].connections?.some(c => c.id === connId)) { ownerId = k; break }
      }
      if (!ownerId) return {}
      const owner = state.objects[ownerId]
      const newObjects = {
        ...state.objects,
        [ownerId]: { ...owner, connections: owner.connections.filter(c => c.id !== connId) },
      }
      return {
        objects: newObjects,
        selectedConnectionId: state.selectedConnectionId === connId ? null : state.selectedConnectionId,
        ...pushHistory(state, newObjects),
      }
    })
  },

  // Edit one field of a connector's config (by connection id).
  updateConnectionConfig: (connId, key, value) => {
    set(state => {
      let ownerId = null
      for (const k in state.objects) {
        if (state.objects[k].connections?.some(c => c.id === connId)) { ownerId = k; break }
      }
      if (!ownerId) return {}
      const owner = state.objects[ownerId]
      const connections = owner.connections.map(c =>
        c.id === connId ? { ...c, connectorConfig: { ...c.connectorConfig, [key]: value } } : c)
      const newObjects = { ...state.objects, [ownerId]: { ...owner, connections } }
      return { objects: newObjects, ...pushHistory(state, newObjects) }
    })
  },

  // ── Layers ───────────────────────────────────────────────────────
  toggleLayerVisibility: (key) => set(state => ({
    layers: { ...state.layers, [key]: { ...state.layers[key], visible: !state.layers[key].visible } },
  })),

  toggleLayerLock: (key) => set(state => ({
    layers: { ...state.layers, [key]: { ...state.layers[key], locked: !state.layers[key].locked } },
  })),

  setActiveLayer: (key) => set({ activeLayer: key }),

  // ── Camera fly-to (frames + zooms onto an object) ────────────────
  cameraFlyTarget: null,
  cameraFlyPos:    null,

  flyToObject: (id) => {
    const obj = get().objects[id]
    if (!obj) return
    const [x, y, z] = obj.position
    set({
      cameraFlyTarget: [x, y + 1.5, z],
      cameraFlyPos:    [x + 9, y + 8, z + 12],   // close 3/4 framing → the asset "pops"
    })
  },

  clearFlyTarget: () => set({ cameraFlyTarget: null, cameraFlyPos: null }),

  // ── Live-data simulation ─────────────────────────────────────────
  // Process-accurate state-driven step (anode-change cycle, tapping, anode
  // effects, alumina feed/depletion, silo/crucible levels). Drives parameters,
  // per-type state + derived status, and OEE accumulators. No undo history.
  // Each parameter only refreshes at its own frequency (industry default per type,
  // overridable per object). 'manual' and UNS-bound params are never auto-changed.
  // paramTimes[key] records the last refresh so the UI can show a timestamp.
  simulateTick: () => set(state => {
    const now = Date.now()
    const prev = state.objects
    const stepped = stepSimulation(prev, state.customAssetTypes)
    const objects = {}
    for (const id in stepped) {
      const po = prev[id], so = stepped[id]
      if (!po) { objects[id] = so; continue }
      const times = { ...(po.paramTimes || {}) }
      const params = { ...so.parameters }
      for (const k in params) {
        if (po.paramMeta?.[k]?.topic) { params[k] = po.parameters[k]; continue }   // UNS-bound: poll drives it
        const ms = paramFreqMs(po, k, state.customAssetTypes)
        if (ms == null) { params[k] = po.parameters[k]; continue }                  // manual: never auto
        if (now - (times[k] ?? 0) >= ms) times[k] = now                            // due → keep stepped value
        else params[k] = po.parameters[k]                                          // not due → hold previous
      }
      // Identity preservation: if no param was due this tick and state/status
      // didn't change, the new object is value-identical to the previous one —
      // reuse the old reference so memoized consumers skip re-rendering.
      let changed = so.state !== po.state || so.status !== po.status
      if (!changed) for (const k in params) { if (params[k] !== po.parameters?.[k]) { changed = true; break } }
      objects[id] = changed ? { ...so, parameters: params, paramTimes: times } : po
    }
    return { objects }
  }),

  // ── Mode ─────────────────────────────────────────────────────────
  setEditMode:      (v)    => set({ editMode: v, selectedId: null, selectedConnectionId: null, selectedGroupId: null }),
  setTransformMode: (mode) => set({ transformMode: mode }),

  // ── Custom asset types (user-defined Component Specs) ──────
  // Accepts either a legacy single-primitive ({label, primitive, layer, defaultConfig})
  // or a full Component Spec ({label, category, layer, parts, ports, config,
  // parameters, states, beacon, defaultConfig}). Extra keys are stored verbatim.
  addCustomAssetType: (spec = {}) => {
    const id = `custom_${nanoid(6)}`
    const entry = {
      id,
      label: spec.label || 'Custom Asset',
      category: spec.category || 'Custom',
      layer: spec.layer || 'equipment',
      schemaVersion: spec.schemaVersion || 1,
      defaultConfig: spec.defaultConfig || {},
      ...(spec.parts ? {
        parts: spec.parts, ports: spec.ports ?? [], config: spec.config ?? [],
        parameters: spec.parameters ?? [], states: spec.states ?? null,
        subComponents: spec.subComponents ?? [],
        beacon: spec.beacon === undefined ? null : spec.beacon,
      } : { primitive: spec.primitive || 'box' }),
    }
    set(state => ({ customAssetTypes: { ...state.customAssetTypes, [id]: entry } }))
    setCustomTypes(get().customAssetTypes)
    return id
  },

  // Edit an existing custom type in place (Studio save). Placed instances re-render
  // with the new geometry/schema since they reference the type by id.
  updateCustomAssetType: (id, patch) => {
    set(state => {
      const cur = state.customAssetTypes[id]
      if (!cur) return {}
      return { customAssetTypes: { ...state.customAssetTypes, [id]: { ...cur, ...patch, id } } }
    })
    setCustomTypes(get().customAssetTypes)
  },

  removeCustomAssetType: (id) => {
    set(state => {
      const inUse = Object.values(state.objects).some(o => o.type === id)
      if (inUse) return {}   // guard: don't orphan placed instances
      const { [id]: _, ...rest } = state.customAssetTypes
      return { customAssetTypes: rest }
    })
    setCustomTypes(get().customAssetTypes)
  },

  // ── Sub-component per-instance overrides (sparse) ─────────────────
  // obj.subOverrides[subId][index] = { params?, state? }. Editing one anode/window
  // in the Details view writes a single override; derived defaults cover the rest.
  setSubOverride: (objId, subId, index, patch) => set(state => {
    const o = state.objects[objId]
    if (!o) return {}
    const subs = { ...(o.subOverrides || {}) }
    const sub = { ...(subs[subId] || {}) }
    sub[index] = { ...(sub[index] || {}), ...patch, params: { ...(sub[index]?.params || {}), ...(patch.params || {}) } }
    subs[subId] = sub
    const objects = { ...state.objects, [objId]: { ...o, subOverrides: subs } }
    return { objects, ...pushHistory(state, objects) }
  }),
  clearSubOverride: (objId, subId, index) => set(state => {
    const o = state.objects[objId]
    if (!o?.subOverrides?.[subId]) return {}
    const subs = { ...o.subOverrides }
    const sub = { ...subs[subId] }; delete sub[index]
    subs[subId] = sub
    const objects = { ...state.objects, [objId]: { ...o, subOverrides: subs } }
    return { objects, ...pushHistory(state, objects) }
  }),

  // ── Scene load / clear ───────────────────────────────────────────
  // Accepts either { objects, groups } or a legacy plain objects map.
  loadScene: (scene) => {
    resetSim()
    // A full project snapshot may carry its own custom types + flow layout;
    // fall back to whatever is already in the store otherwise.
    // Merge the shared component library in so placed library types resolve in
    // every project (project-local types override by id).
    const customAssetTypes = { ...getLibraryComponents(), ...(scene?.customAssetTypes ?? get().customAssetTypes) }
    const rawObjects = scene?.objects ?? scene ?? {}
    const rawGroups  = scene?.groups ?? {}

    // One-time cleanup of retired template artifacts (e.g. the old full-plant
    // "Plant Grade" apron) so existing saved projects drop them on load.
    const RETIRED_TYPES = new Set(['pp_grade'])
    for (const t of RETIRED_TYPES) delete customAssetTypes[t]
    // Retired coal-mine scene extras (id -> expected type, so no other template
    // is affected): trucks 4-8 were fleet/proximity showcase additions that
    // crowded the pit; worker-5 stood at the pit mouth and was cut on review.
    const RETIRED_IDS = new Map([
      ['truck-4', 'haul_truck'], ['truck-5', 'haul_truck'], ['truck-6', 'haul_truck'],
      ['truck-7', 'haul_truck'], ['truck-8', 'haul_truck'],
      ['worker-5', 'site_worker'],
      ['loader-1', 'wheel_loader'],
    ])

    // Refresh ALL template-owned component specs from the current templates — their
    // geometry/materials are baked into the saved scene, so design fixes (e.g. the
    // z-fighting polygonOffset/coplanar work) only reach existing projects this way.
    try {
      const fresh = { ...THERMAL_POWER_PLANT().customAssetTypes, ...BOTTLING_PLANT().customAssetTypes }
      for (const id in fresh) if (customAssetTypes[id]) customAssetTypes[id] = fresh[id]
    } catch { /* template optional */ }

    // Refresh the coal-mine FLEET PATHS from the current template — the convoy
    // motion redesign (one shared circuit, master-clock spacing, loading-crawl)
    // lives in path config that is baked into saved scenes, so like the spec
    // refresh above it only reaches existing projects here. Guarded by id+type,
    // so non-coal templates and renamed objects are untouched.
    let _coalTpl = null
    const coalTpl = () => {
      if (_coalTpl === null) { try { _coalTpl = COAL_MINE().objects } catch { _coalTpl = {} } }
      return _coalTpl
    }
    const coalPathFor = (id) => {
      const t = coalTpl()[id]
      return t?.config?.path?.waypoints ? t : undefined
    }

    // Additive template migration: brand-new coal-template objects that existing
    // saved scenes must GAIN (the fill loop below only covers objects already in
    // the save). Guarded by anchors so no other template is affected.
    if (rawObjects['worker-2'] && rawObjects['ppe-cam-4']) {
      for (const nid of ['worker-8']) {
        if (!rawObjects[nid] && coalTpl()[nid]) rawObjects[nid] = coalTpl()[nid]
      }
    }

    // Proximity/collision retired: strip its alert rules + KPI params from saved
    // scenes so "Proximity incident" alerts can never fire again and the safety
    // panel shows no dead proximity numbers (the vehicle AUTO-STOP story was
    // removed — worker safety is told via camera detection instead).
    const PROX_PARAMS = ['proximityAlertsToday', 'proximityEvent', 'minWorkerVehicleDistance']
    for (const k in rawObjects) {
      const o = rawObjects[k]
      const rules = o?.config?.alertRules
      const hasRule = Array.isArray(rules) && rules.some(r => r?.useCase === 'Proximity' || PROX_PARAMS.includes(r?.param))
      const hasParam = o?.parameters && PROX_PARAMS.some(pk => pk in o.parameters)
      if (!hasRule && !hasParam) continue
      const next = { ...o }
      if (hasRule) next.config = { ...next.config, alertRules: rules.filter(r => r?.useCase !== 'Proximity' && !PROX_PARAMS.includes(r?.param)) }
      if (hasParam) { next.parameters = { ...next.parameters }; for (const pk of PROX_PARAMS) delete next.parameters[pk] }
      rawObjects[k] = next
    }

    // Upgrade legacy smoke/vapour parts to the rising-plume animation so existing
    // projects pick it up without re-creating from the template.
    const isPlume = (p) => /smoke|vapou?r/i.test(p?.label || '')
    for (const k in customAssetTypes) {
      const t = customAssetTypes[k]
      if (Array.isArray(t?.parts) && t.parts.some(isPlume)) {
        customAssetTypes[k] = { ...t, parts: t.parts.map(p => isPlume(p) ? { ...p, animate: { kind: 'rise', speedKey: 'speed' } } : p) }
      }
    }

    // Publish the resolved custom types BEFORE back-filling: connector-type
    // derivation (getPorts) must see custom components' declared ports.
    setCustomTypes(customAssetTypes)

    // Back-fill config/parameters/rules + state + connection-record fields so
    // templates and the initial scene gain them without editing every literal.
    const filled = {}
    for (const [id, o] of Object.entries(rawObjects)) {
      if (RETIRED_TYPES.has(o.type)) continue   // skip retired objects
      if (RETIRED_IDS.get(id) === o.type) continue   // retired scene extras
      const st = o.state ?? defaultState(o.type)
      // BD-03 was authored above the pit rim at surface level (y=0), not on a
      // bench like BD-01/02 — relocate it onto the bench-3 tread with the other
      // rigs. Baked into saved scenes, so like the fixes above it only reaches
      // existing projects here. Guarded to the exact old coords, so a user who
      // moved it deliberately is left untouched.
      let position = Array.isArray(o.position) ? o.position : [0, 0, 0]
      let rotation = Array.isArray(o.rotation) ? o.rotation : [0, 0, 0]
      if (id === 'bh-drill-3' && Math.abs(position[0] + 99.44) < 0.05 && Math.abs(position[1]) < 0.05 && Math.abs(position[2] - 46.42) < 0.05) {
        position = [-124.2, -3.6, -40.7]
      }
      // exc-ob-1 moved with truck-3's disjoint bench shuttle (SW bench, θ196) —
      // same guarded one-time relocation pattern as bh-drill-3 above. Matches
      // both the original spot and the short-lived intermediate one.
      if (id === 'exc-ob-1' && ((Math.abs(position[0] + 141.34) < 0.05 && Math.abs(position[2] - 41.51) < 0.05) ||
                                (Math.abs(position[0] + 127.92) < 0.05 && Math.abs(position[2] - 35.54) < 0.05))) {
        position = [-186.72, -7.2, -6.53]
        rotation = [0, -4.99, 0]
      }
      // worker-2 (PPE-beat violation worker) moved to the isolated pit-side gate
      // so only it + worker-8 are in the scan frame. Guarded to its original spot.
      if (id === 'worker-2' && ((Math.abs(position[0] - 7) < 0.05 && Math.abs(position[2] - 6.5) < 0.05) ||
                                (Math.abs(position[0] - 13.2) < 0.05 && Math.abs(position[2] + 15.4) < 0.05))) {
        position = [11.6, 0, -18]
        rotation = [0, 3.14, 0]
      }
      // worker-8 (the COMPLIANT partner) is only injected when missing — but a
      // saved scene from an earlier iteration has it at an OLD spot and never
      // relocates it, so only worker-2 was in frame. Relocate it to the gate too.
      if (id === 'worker-8' && !(Math.abs(position[0] - 9.6) < 0.05 && Math.abs(position[2] + 18) < 0.05)) {
        position = [9.6, 0, -18]
        rotation = [0, 3.14, 0]
      }
      // fleet-path refresh (see coalPathFor above): template path is authoritative
      // for the coal-mine movers so the convoy redesign reaches saved scenes.
      let config0 = o.config
      const tplMover = o.config?.path?.waypoints ? coalPathFor(id) : null
      if (tplMover && tplMover.type === o.type) config0 = { ...o.config, path: JSON.parse(JSON.stringify(tplMover.config.path)) }
      filled[id] = {
        ...o,
        // Defensive defaults so partial / imported specs (which often omit these)
        // still render — SceneObject bails on missing `visible`/`layer`.
        id,
        name: o.name ?? o.type,
        position,
        rotation,
        scale: Array.isArray(o.scale) ? o.scale : [1, 1, 1],
        layer: o.layer ?? defaultLayerForType(o.type),
        visible: o.visible ?? true,
        locked: o.locked ?? false,
        parentId: o.parentId ?? null,
        dataBindings: o.dataBindings ?? [],
        state: st,
        status: statusFromState(o.type, st),
        // Hover tooltips are auto-enabled on MAIN machines only. Backfill missing
        // ones; strip the auto-default off non-main machines (it was over-applied
        // by an earlier version), but keep any user-customised selection.
        tooltip: resolveTooltip(o.type, o.tooltip),
        config: (() => {
          const cfg = withConfigDefaults(o.type, config0, customAssetTypes)
          // Floor default re-tinted (old blue-grey read as dirty) — migrate floors
          // still on the old default; hand-picked colours are left alone.
          if (o.type === 'Floor' && (cfg.color || '').toLowerCase() === '#e7eaef') return { ...cfg, color: '#f2f2f3' }
          return cfg
        })(),
        parameters: withParameterDefaults(o.type, o.parameters, customAssetTypes),
        rules: o.rules ?? [],
        connections: (o.connections ?? []).map(c => {
          // Derive the connector kind from the source port when the spec doesn't
          // pin one (conveyor → belt, power → busbar, else pipe) — same rule as
          // interactive snapping, so spec-authored links render identically.
          const connectorType = c.connectorType ?? deriveConnectorType(o, c.sourcePort)
          let connectorConfig = c.connectorConfig ?? {}
          // Recolour template/default pipes by fluid medium (derived from port
          // names) so existing projects pick up the palette; a hand-picked colour
          // (not a legacy/default hex) is left untouched.
          const col = (connectorConfig.color || '').toLowerCase()
          if (connectorType === 'pipe' && (!col || LEGACY_PIPE_COLORS.has(col))) {
            connectorConfig = { ...connectorConfig, color: MEDIUM_STYLE[mediumOf(c.sourcePort, c.targetPort)].color }
          }
          return {
            id: c.id ?? nanoid(8),
            targetId: c.targetId, sourcePort: c.sourcePort, targetPort: c.targetPort,
            connectorType, connectorConfig,
          }
        }),
      }
    }
    const { objects, groups } = normalizeHierarchy(filled, rawGroups)
    // Template LAYOUT auto-sync: when a scene was created from the bottling
    // template and its placements have since been re-metered (layoutV bumped),
    // update those template objects' transforms/config/links in place — no need
    // to recreate the project. Gated on template fingerprint objects.
    try {
      if (objects.obj_filler && objects.obj_hall) {
        const tpl = BOTTLING_PLANT().objects
        for (const id in tpl) {
          const t = tpl[id], cur = objects[id]
          if (!cur) { objects[id] = t; continue }                       // newly added template asset
          if ((cur.layoutV ?? 0) < (t.layoutV ?? 0)) {
            objects[id] = { ...cur, position: t.position, rotation: t.rotation, scale: t.scale,
              config: { ...t.config }, connections: t.connections.map(c => ({ ...c })), layoutV: t.layoutV }
          }
        }
      }
    } catch { /* template optional */ }
    // Group tooltips are disabled by default — strip any (the earlier build
    // auto-enabled them on top-level groups).
    for (const gid in groups) {
      if (groups[gid].tooltip) groups[gid] = { ...groups[gid], tooltip: undefined }
    }
    set({
      objects, groups, customAssetTypes,
      selectedId: null,
      selectedConnectionId: null,
      selectedGroupId: null,
      flowLayout: scene?.flowLayout ?? {},
      environment: scene?.environment ?? {},
      tour: scene?.tour ?? {},
      dashboard: scene?.dashboard ?? {},
      _history:      [{ objects: clone(objects), groups: clone(groups) }],
      _historyIndex: 0,
    })
    setCustomTypes(customAssetTypes)
  },

  clearScene: () => {
    resetSim()
    set(state => ({ objects: {}, groups: {}, selectedId: null, selectedGroupId: null, ...pushHistory(state, {}, {}) }))
  },

  // Full serialisable scene snapshot for a project record / JSON export. Shared
  // library components are synced separately (their own insight docs), so exclude
  // them here — keep only project-local custom types to avoid baking + staling
  // the shared library into every project.
  getSceneSnapshot: () => {
    const { objects, groups, customAssetTypes, flowLayout, environment, tour, dashboard } = get()
    const lib = getLibraryComponents()
    const localTypes = {}
    for (const id in customAssetTypes) if (!lib[id]) localTypes[id] = customAssetTypes[id]
    return clone({ objects, groups, customAssetTypes: localTypes, flowLayout, environment, tour, dashboard })
  },
})

export const useSceneStore = create(
  persist(store, {
    name: 'faclon-dt-scene',
    version: 4,
    // Write-behind storage: at most one serialize+write per 5 s (flushed on
    // pagehide/tab-hide) instead of one per set() — the 1 Hz simulator was
    // paying a ~250 KB synchronous localStorage write every tick.
    storage: throttledStorage({ key: 'faclon-dt-scene' }),
    partialize: (state) => {
      // Persist only USER-LOCAL custom types — the shared component library
      // (~195 KB) is code, re-merged by loadScene on every load (same
      // exclusion getSceneSnapshot uses).
      const lib = getLibraryComponents()
      const customAssetTypes = {}
      for (const id in state.customAssetTypes) if (!lib[id]) customAssetTypes[id] = state.customAssetTypes[id]
      return {
        objects: state.objects,
        groups: state.groups,
        customAssetTypes,
        flowLayout: state.flowLayout,
      }
    },
    // Idempotent back-fill: v1 added `config`; v2 added `parameters`, `rules`,
    // connection-record fields; v3 added per-type `state`; v4 adds the UNS
    // hierarchy — `groups` + per-node `parentId`/`order`, converting any legacy
    // `obj.group` string into a real group node.
    migrate: (persisted, fromVersion) => {
      if (!persisted) return persisted
      const customAssetTypes = persisted.customAssetTypes ?? {}
      if (persisted.objects) {
        const objects = {}
        for (const [id, o] of Object.entries(persisted.objects)) {
          const st = o.state ?? stateFromStatus(o.type, o.status ?? 'running')
          objects[id] = {
            ...o,
            state: st,
            status: statusFromState(o.type, st),
            config: withConfigDefaults(o.type, o.config, customAssetTypes),
            parameters: withParameterDefaults(o.type, o.parameters, customAssetTypes),
            rules: o.rules ?? [],
            connections: (o.connections ?? []).map(c => ({
              id: c.id ?? nanoid(8),
              targetId: c.targetId, sourcePort: c.sourcePort, targetPort: c.targetPort,
              connectorType: c.connectorType ?? 'pipe',
              connectorConfig: c.connectorConfig ?? {},
            })),
          }
        }
        const norm = normalizeHierarchy(objects, persisted.groups ?? {})
        return { ...persisted, objects: norm.objects, groups: norm.groups, customAssetTypes }
      }
      return { ...persisted, groups: persisted.groups ?? {}, customAssetTypes }
    },
  })
)

// Seed the custom-types ref from persisted state (zustand persist hydrates
// synchronously), so getPorts/getStateSchema resolve custom assets on first load.
setCustomTypes(useSceneStore.getState().customAssetTypes)
