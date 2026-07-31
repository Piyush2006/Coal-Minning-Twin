// ─────────────────────────────────────────────────────────────────────────────
// Twin Spec import / export — the JSON contract a chatbot (or a human) produces
// per skills/digital-twin-generate.md, and what we download for round-trip.
//
// validateSpec is intentionally TOLERANT: it coerces values into range, strips
// dangling connections, drops unknown-type objects, and reports warnings — so a
// slightly-imperfect LLM spec still loads. loadScene() then back-fills the rest.
// ─────────────────────────────────────────────────────────────────────────────

import { ASSET_SCHEMAS, coerceConfigValue } from './assetSchemas'
import { PARAMETER_SCHEMAS, coerceParameterValue } from './parameterSchemas'

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

function coerceConfig(type, config) {
  const schema = ASSET_SCHEMAS[type]
  if (!schema || !isObj(config)) return config ?? {}
  const out = { ...config }
  for (const f of schema) if (out[f.key] !== undefined) out[f.key] = coerceConfigValue(f, out[f.key])
  return out
}
function coerceParams(type, parameters) {
  const schema = PARAMETER_SCHEMAS[type]
  if (!schema || !isObj(parameters)) return parameters ?? {}
  const out = { ...parameters }
  for (const f of schema) if (out[f.key] !== undefined) out[f.key] = coerceParameterValue(f, out[f.key])
  return out
}

/**
 * Validate + normalise a raw parsed Twin Spec into a scene snapshot.
 * @returns { ok, scene, errors[], warnings[], stats }
 *   scene = { objects, groups, customAssetTypes, flowLayout } ready for loadScene.
 */
export function validateSpec(raw) {
  const errors = [], warnings = []
  if (!isObj(raw)) return { ok: false, errors: ['Top level must be a JSON object.'], warnings: [], scene: null, stats: {} }

  // Accept { objects, groups, … } OR a legacy bare objects map.
  const rawObjects = isObj(raw.objects) ? raw.objects : (raw.objects === undefined && !raw.groups && !raw.meta ? raw : null)
  if (!isObj(rawObjects)) return { ok: false, errors: ['Spec has no "objects" map.'], warnings: [], scene: null, stats: {} }

  const customAssetTypes = isObj(raw.customAssetTypes) ? raw.customAssetTypes : {}
  const knownType = (t) => !!ASSET_SCHEMAS[t] || !!customAssetTypes[t]

  // ── objects ──
  const objects = {}
  let dropped = 0
  for (const [id, o] of Object.entries(rawObjects)) {
    if (!isObj(o) || typeof o.type !== 'string') { warnings.push(`Skipped "${id}": missing type.`); dropped++; continue }
    if (!knownType(o.type)) { warnings.push(`Skipped "${id}": unknown type "${o.type}".`); dropped++; continue }
    const pos = Array.isArray(o.position) && o.position.length === 3 ? o.position.map(Number) : [0, 0, 0]
    objects[id] = {
      ...o,
      id,
      type: o.type,
      name: typeof o.name === 'string' ? o.name : o.type,
      position: pos,
      rotation: Array.isArray(o.rotation) ? o.rotation.map(Number) : [0, 0, 0],
      scale: Array.isArray(o.scale) ? o.scale.map(Number) : [1, 1, 1],
      config: coerceConfig(o.type, o.config),
      parameters: coerceParams(o.type, o.parameters),
      rules: Array.isArray(o.rules) ? o.rules : [],
      connections: Array.isArray(o.connections) ? o.connections : [],
      parentId: o.parentId ?? null,
    }
  }
  if (Object.keys(objects).length === 0) errors.push('No valid objects after validation.')

  // ── strip dangling connections (target must exist) ──
  let strippedConns = 0
  for (const o of Object.values(objects)) {
    const kept = o.connections.filter(c => c && objects[c.targetId])
    strippedConns += o.connections.length - kept.length
    o.connections = kept
  }
  if (strippedConns) warnings.push(`Removed ${strippedConns} connection(s) pointing to missing assets.`)

  // ── groups: keep valid {name,parentId,order}; drop parent refs that vanish ──
  const groups = {}
  if (isObj(raw.groups)) {
    for (const [gid, g] of Object.entries(raw.groups)) {
      if (!isObj(g)) continue
      groups[gid] = { ...g, id: gid, name: typeof g.name === 'string' ? g.name : 'Group', parentId: g.parentId ?? null, order: Number(g.order) || 0,
        kpis: Array.isArray(g.kpis) ? g.kpis : undefined }
    }
    // null out parents that don't resolve (object parents handled by normalizeHierarchy)
    for (const g of Object.values(groups)) if (g.parentId && !groups[g.parentId]) g.parentId = null
    for (const o of Object.values(objects)) if (o.parentId && !groups[o.parentId]) o.parentId = null
  }

  const flowLayout = isObj(raw.flowLayout) ? raw.flowLayout : {}
  // Scene-level environment config (sky, ground/terrain, grid, postfx tuning) —
  // carried verbatim; renderer features read it defensively with defaults.
  const environment = isObj(raw.environment) ? raw.environment : {}
  // Guided-tour config ({ beats: [...] }) — carried verbatim; TourPlayer reads defensively.
  const tour = isObj(raw.tour) ? raw.tour : {}
  const dashboard = isObj(raw.dashboard) ? raw.dashboard : {}
  const stats = { assets: Object.keys(objects).length, groups: Object.keys(groups).length, dropped }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    scene: { objects, groups, customAssetTypes, flowLayout, environment, tour, dashboard },
    meta: isObj(raw.meta) ? raw.meta : null,
    stats,
  }
}

/** Build a downloadable Twin Spec from a live scene snapshot. */
export function exportSpec(snapshot, meta = {}) {
  return {
    meta: { title: meta.title ?? 'Digital Twin Scene', units: 'meters', exportedAt: new Date().toISOString(), ...meta },
    objects: snapshot.objects ?? {},
    groups: snapshot.groups ?? {},
    customAssetTypes: snapshot.customAssetTypes ?? {},
    flowLayout: snapshot.flowLayout ?? {},
    ...(snapshot.environment && Object.keys(snapshot.environment).length ? { environment: snapshot.environment } : {}),
    ...(snapshot.tour && Object.keys(snapshot.tour).length ? { tour: snapshot.tour } : {}),
    ...(snapshot.dashboard && Object.keys(snapshot.dashboard).length ? { dashboard: snapshot.dashboard } : {}),
  }
}

/** Trigger a browser download of a JS object as pretty JSON. */
export function downloadJSON(obj, filename = 'twin-scene.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
