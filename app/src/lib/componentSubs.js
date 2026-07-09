// ── Sub-components ───────────────────────────────────────────────────────────
// A component TYPE can declare named sub-assemblies (e.g. a Reduction Pot has 40
// anodes + 76 shell windows). Definitions are declarative — count + layout + a
// per-instance parameter/state schema — so we never hand-place or store hundreds
// of entities. Per-instance values are DERIVED, with sparse per-instance overrides
// stored on the object (obj.subOverrides[subId][index]).
//
//   def = { id, label, count, layout, part, parameters[], states[]|null,
//           scene?, derive? , spreadKey? }
//
// General: nothing here is pot-specific except the BUILTIN_SUBS registry entry.

// ── layout resolvers: (layout, count) → [{ index, position, rotation }] ──
function resolveLayout(layout = {}, count = 0) {
  const out = []
  const rot = layout.rotation || [0, 0, 0]
  switch (layout.kind) {
    case 'doubleRow': {
      // two rows on ±Z, `perRow` each, evenly spaced along X (x0 + (k+0.5)*step)
      const { perRow = Math.ceil(count / 2), x0 = -2.85, step = 0.285, z = 0.95, y = 2.3 } = layout
      for (let i = 0; i < count; i++) {
        const side = i < perRow ? 1 : -1, k = i % perRow
        out.push({ index: i, position: [x0 + (k + 0.5) * step, y, side * z], rotation: rot })
      }
      return out
    }
    case 'perimeter': {
      // along ±Z faces, `perSide` each, spread along X; far side flipped 180°
      const { perSide = Math.ceil(count / 2), x0 = -3.1, step = 0.163, z = 1.52, y = 0.6 } = layout
      for (let i = 0; i < count; i++) {
        const side = i < perSide ? 1 : -1, k = i % perSide
        out.push({ index: i, position: [x0 + (k + 0.5) * step, y, side * z], rotation: [0, side > 0 ? 0 : Math.PI, 0] })
      }
      return out
    }
    case 'skirtSlits': {
      // thin vertical slits laid ON a two-sided slanted skirt (e.g. the pot's lower
      // covers): spaced along X, tilted to match the skirt, pushed proud of its face.
      const { perSide = Math.ceil(count / 2), x0 = -3.0, step = 0.158, y = 0.925, z = 1.575, tilt = 0.698, proud = 0.07 } = layout
      const ny = Math.cos(tilt) * proud, nz = Math.sin(tilt) * proud
      for (let i = 0; i < count; i++) {
        const side = i < perSide ? 1 : -1, k = i % perSide
        out.push({ index: i, position: [x0 + (k + 0.5) * step, y + ny, side * (z + nz)], rotation: [side * tilt, 0, 0] })
      }
      return out
    }
    case 'grid': {
      const { cols = Math.ceil(Math.sqrt(count)), dx = 1, dz = 1, y = 0 } = layout
      for (let i = 0; i < count; i++) {
        const c = i % cols, r = Math.floor(i / cols)
        out.push({ index: i, position: [(c - (cols - 1) / 2) * dx, y, (r) * dz], rotation: rot })
      }
      return out
    }
    case 'ring': {
      const { radius = 2, y = 0 } = layout
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        out.push({ index: i, position: [Math.cos(a) * radius, y, Math.sin(a) * radius], rotation: [0, -a, 0] })
      }
      return out
    }
    default: {
      const { step = 1, y = 0 } = layout
      for (let i = 0; i < count; i++) out.push({ index: i, position: [(i - (count - 1) / 2) * step, y, 0], rotation: rot })
      return out
    }
  }
}
export { resolveLayout }

const firstNumericKey = (def) => (def.parameters || []).find(p => typeof p.default === 'number')?.key
// deterministic pseudo-random in [0,1) — stable across reloads (no Math.random)
const hash01 = (i, salt = 0) => { const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x) }
const round2 = (v) => Math.round(v * 100) / 100
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Minimum healthy individual-anode current (kA). An anode below this is flagged
// cold/degraded — ≈0.75× the 15 kA nominal share (600 kA line / 40 anodes), the
// common pot-room threshold for a problem anode.
const ANODE_I_THRESHOLD = 11.5

// Per-instance DEFAULTS (before overrides). Produces realistic VARIATION so a fleet
// reads as a fleet (not all identical): the spreadKey ramps across its [min,max];
// other numeric params jitter deterministically around their default; and states
// are distributed (≈72% ok / 18% warn / 10% down) so colours vary.
export function deriveSubInstance(def, i, obj = null) {
  // A def may supply an explicit physical model (params + state as a function of
  // index, and the parent object) when the parameters are RELATED (e.g. anode
  // current depends on age) or must ALIGN with the parent's condition — keeps the
  // engine general while the realism lives in the registry entry.
  if (typeof def.model === 'function') {
    const m = def.model(i, def, obj) || {}
    return { params: m.params || {}, state: m.state ?? def.states?.[0]?.key ?? null }
  }
  const params = {}
  const n = Math.max(1, def.count - 1)
  const spreadKey = def.spreadKey || (def.derive === 'spread' ? firstNumericKey(def) : null)
  ;(def.parameters || []).forEach((p, pi) => {
    if (typeof p.default !== 'number') { params[p.key] = p.default; return }
    const lo = p.min ?? 0, hi = p.max ?? 100
    if (p.key === spreadKey) {
      params[p.key] = round2(lo + (i / n) * (hi - lo))
    } else {
      const r = hash01(i, pi + 1)
      params[p.key] = round2(clamp(p.default + (r - 0.5) * 0.6 * (hi - lo), lo, hi))
    }
  })
  let state = def.states?.[0]?.key ?? null
  if (def.states?.length > 1) {
    const r = hash01(i, 99)
    if (def.states.length >= 3 && r > 0.9) state = def.states[2].key
    else if (r > 0.72) state = def.states[1].key
  }
  return { params, state }
}

// Derived ⊕ sparse override (obj.subOverrides[def.id][i]).
export function subInstanceValue(def, i, obj) {
  const base = deriveSubInstance(def, i, obj)
  const ov = obj?.subOverrides?.[def.id]?.[i]
  if (!ov) return base
  return { params: { ...base.params, ...(ov.params || {}) }, state: ov.state ?? base.state }
}

// "Anodes" → "Anode", "Shell Windows" → "Shell Window" (for per-instance labels).
const singular = (label) => String(label || 'Item').replace(/s$/, '')

// Expand a declarative sub-assembly into LITERAL individual parts (primitives) under
// a parent group — so each instance becomes a real, selectable, parameterised node
// in the component's parts tree (instead of one collapsed "Anodes ×40" node). Each
// part bakes its derived state colour + carries the per-instance parameters as its
// own editable parameter fields.
export function expandSubToParts(def, groupId) {
  const layout = resolveLayout(def.layout, def.count)
  const m = def.part?.material || {}
  return layout.map(inst => {
    const { params, state } = deriveSubInstance(def, inst.index)
    const parameters = (def.parameters || []).map(p => ({ ...p, default: params[p.key] ?? p.default }))
    return {
      id: `part_${def.id}_${inst.index}`,
      label: `${singular(def.label)} ${inst.index + 1}`,
      parentId: groupId,
      geometry: def.part?.geometry || 'box',
      dims: { ...(def.part?.dims || {}) },
      position: inst.position, rotation: inst.rotation || [0, 0, 0], scale: [1, 1, 1],
      material: {
        color: subInstanceColor(def, state),
        metalness: m.metalness ?? 0.4, roughness: m.roughness ?? 0.5,
        // bias proud of the shell so coplanar faces don't z-fight
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      },
      animate: null,
      parameters,
    }
  })
}

// Color for an instance from its state (def.states severity), else a neutral steel.
export function subInstanceColor(def, stateKey) {
  const st = (def.states || []).find(s => s.key === stateKey)
  if (st?.color) return st.color
  return def.part?.material?.color || '#9fb2c4'
}

// ── registry of built-in component sub-definitions ──
const n = (key, label, unit, def, min, max) => ({ key, label, unit, default: def, min, max })
const st = (key, label, color, severity) => ({ key, label, color, severity })

export const BUILTIN_SUBS = {
  ReductionPot: [
    {
      id: 'anodes', label: 'Anodes', count: 40,
      layout: { kind: 'doubleRow', perRow: 20, x0: -2.85, step: 0.285, z: 0.95, y: 2.35 },
      part: { geometry: 'box', dims: { width: 0.2, height: 0.7, depth: 0.85 }, material: { color: '#23262b', metalness: 0.35, roughness: 0.6 } },
      parameters: [n('age', 'Anode Age', 'days', 14, 0, 28), n('current', 'Anode Current', 'kA', 15, 0, 20), n('stubTemp', 'Stub Temp', '°C', 350, 100, 600)],
      states: [st('set', 'Operating', '#34c759', 'ok'), st('changing', 'Burning in', '#ff9f0a', 'warn'), st('spent', 'Spent', '#ff3b30', 'down')],
      // Realistic Hall-Héroult anode-current profile vs age (28-day cycle, ~15 kA
      // nominal share of a 600 kA / 40-anode pot). Cold burn-in for the first ~2.5
      // days (low current), steady full share mid-life, then declines near end of
      // life as the carbon is consumed → below the healthy threshold → "Spent".
      // Anodes are on a staggered change schedule, so ages spread evenly 0–28.
      model: (i, def, obj) => {
        const N = Math.max(1, def.count - 1)
        const age = round2((i / N) * 28)
        const NOMINAL = 15, THRESH = ANODE_I_THRESHOLD
        const jitter = (hash01(i, 3) - 0.5) * 0.7
        let current
        if (age < 2.5)        current = 8 + (age / 2.5) * 6.5          // cold burn-in 8 → 14.5 kA
        else if (age > 24)    current = NOMINAL - (age - 24) * 1.65    // end-of-life decline 15 → ~8.4 kA
        else                  current = NOMINAL + jitter               // steady full share ~14.6–15.4 kA
        current = current + (age >= 2.5 && age <= 24 ? 0 : jitter * 0.4)
        // ── ALIGN with the parent pot's condition (pot.state = single source) ──
        const ps = obj?.state
        const isOldest = i === def.count - 1
        if (ps === 'anodeEffect' || ps === 'offline') current -= 3.6   // struggling pot → anodes depressed (several read faulted)
        if (ps === 'beamRaise') current -= 1.4                          // beam raise → a mild dip
        current = round2(clamp(current, 5, 18))
        const stubTemp = round2(clamp(300 + (age / 28) * 150 + (hash01(i, 4) - 0.5) * 40 + (ps === 'anodeEffect' ? 120 : 0), 100, 700))
        let state = 'set'
        if (age < 2.5) state = 'changing'                              // freshly set, bedding in
        else if (current < THRESH) state = 'spent'                     // degraded → flag
        // a pot mid anode-change shows the oldest anode actively being swapped
        if (ps === 'anodeChange' && isOldest) state = 'changing'
        return { params: { age, current, stubTemp }, state }
      },
      chart: { x: 'age', y: 'current', threshold: { y: ANODE_I_THRESHOLD, label: 'Min. healthy current (≈0.75× nominal)' } }, scene: true,
    },
    {
      id: 'windows', label: 'Shell Windows', count: 76,
      // recessed vents along the dark base plinth (the curb, [LEN+0.6, 0.32, WID+2.0]
      // at y≈0.16, outer faces at z≈±2.5) — flat vertical slits, proud of the face.
      layout: { kind: 'perimeter', perSide: 38, x0: -3.3, step: 0.173, z: 2.52, y: 0.18 },
      part: { geometry: 'box', dims: { width: 0.08, height: 0.22, depth: 0.04 }, material: { color: '#4a525e', metalness: 0.4, roughness: 0.55 } },
      parameters: [n('crustTemp', 'Crust Temp', '°C', 720, 400, 1000)],
      states: [st('ok', 'Sealed', '#3a4a5c', 'ok'), st('feed', 'Feeding', '#30b0c7', 'ok'), st('breach', 'Breach', '#ff3b30', 'down')],
      scene: true, derive: 'uniform',
    },
  ],
}

// All sub-component definitions for a type (built-in registry ∪ custom spec).
export function getSubComponents(type, customAssetTypes = {}) {
  if (BUILTIN_SUBS[type]) return BUILTIN_SUBS[type]
  const custom = customAssetTypes[type]
  return Array.isArray(custom?.subComponents) ? custom.subComponents : []
}
