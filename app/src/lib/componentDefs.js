// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for a component's WHOLE definition.
//
// A built-in component (e.g. ReductionPot) has its pieces spread across several
// registries — geometry (MACHINE_COMPONENTS), config (assetSchemas), parameters
// (parameterSchemas), states (stateSchemas), sub-components (componentSubs), and
// ports (machineLibrary). `getComponentDef` is the ONE accessor that assembles
// them into a single definition object, so anything that needs "the component"
// (notably Studio's Build/copy) reads it from one place and never drifts.
//
// Implemented as a read-through aggregator (not a monolithic data table) so the
// leaf registries stay the canonical storage and there are no circular imports.
//
//   def = { type, label, category, layer, render, config, parameters, states,
//           subComponents, ports, beacon }
// ─────────────────────────────────────────────────────────────────────────────

import { getSchema, getDefaultConfig } from './assetSchemas'
import { getParameterSchema } from './parameterSchemas'
import { getStateSchema } from './stateSchemas'
import { getSubComponents } from './componentSubs'
import { getPorts, MACHINE_COMPONENTS, MACHINE_LIBRARY, defaultLayerForType } from './machineLibrary'

function labelForType(type, customAssetTypes = {}) {
  const item = MACHINE_LIBRARY.flatMap(c => c.items).find(it => it.type === type)
  return item?.label || customAssetTypes[type]?.label || type
}

// Full, current definition of a component type (built-in or custom). For ports of
// parametric types we pass a synthetic object at default config so the offsets
// resolve correctly.
export function getComponentDef(type, customAssetTypes = {}) {
  const isBuiltIn = !!MACHINE_COMPONENTS[type]
  const ports = getPorts({ type, config: getDefaultConfig(type, customAssetTypes) })
  return {
    type,
    label: labelForType(type, customAssetTypes),
    category: customAssetTypes[type]?.category || 'Custom',
    layer: defaultLayerForType(type),
    render: isBuiltIn ? type : null,            // key into MACHINE_COMPONENTS (geometry renderer)
    config: getSchema(type, customAssetTypes),
    parameters: getParameterSchema(type, customAssetTypes),
    states: getStateSchema(type),
    subComponents: getSubComponents(type, customAssetTypes),
    ports: Array.isArray(ports) ? ports : [],
    beacon: customAssetTypes[type]?.beacon ?? null,
  }
}
