// Coal Mine template — pit-to-port coal mining process flow, authored via the
// digital-twin skills pipeline (PLAN → CREATE COMPONENT → GENERATE).
// Component specs + twin spec live in ./coalMine/ as plain JSON; the twin spec
// is run through validateSpec so it gets the same tolerant normalisation an
// AI-generated spec would.

import { validateSpec } from '../twinSpec'
import twinSpec from './coalMine/twinSpec.json'

// Eagerly import every component spec; key = file name slug (matches the
// `type` ids used by twinSpec.json objects).
const componentModules = import.meta.glob('./coalMine/components/*.json', { eager: true })

const customAssetTypes = {}
for (const [path, mod] of Object.entries(componentModules)) {
  const slug = path.split('/').pop().replace(/\.json$/, '')
  customAssetTypes[slug] = { id: slug, ...(mod.default ?? mod) }
}

export const COAL_MINE = () => {
  // Derive terrain geometry from telemetry: a PitTerrain's visual wall depth is
  // read from the pit object's own pitDepth parameter (0.3 visual scale) unless
  // the spec pins config.depth explicitly.
  const objects = {}
  for (const [id, obj] of Object.entries(twinSpec.objects)) {
    if (obj.type === 'PitTerrain' && obj.parameters?.pitDepth && obj.config?.depth == null) {
      objects[id] = { ...obj, config: { ...obj.config, depth: Math.round(obj.parameters.pitDepth * 0.3 * 10) / 10 } }
    } else objects[id] = obj
  }
  const { scene } = validateSpec({ ...twinSpec, objects, customAssetTypes })
  return scene
}
