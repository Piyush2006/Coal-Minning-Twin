// Config schema for auto-created connectors (conveyor / pipe). Uses the SAME
// field-def shape as assetSchemas.js so the connector inspector renders through
// the existing ConfigField widget. Also the source of connectorConfig defaults.

import { ITEM_OPTIONS } from './itemLibrary'

export const CONNECTOR_SCHEMAS = {
  conveyor: [
    { key: 'running',     label: 'Running',     type: 'boolean', default: true },
    { key: 'speed',       label: 'Speed',       type: 'number',  default: 1.2, min: 0, max: 5, step: 0.1 },
    { key: 'beltStyle',   label: 'Belt Style',  type: 'select',  default: 'chain',
      options: [{ value: 'chain', label: 'Chain' }, { value: 'roller', label: 'Roller' }] },
    { key: 'itemType',    label: 'Item',        type: 'select',  default: 'pet_bottle', options: ITEM_OPTIONS },
    { key: 'itemSpacing', label: 'Item Spacing',type: 'number',  default: 1.4, min: 0.4, max: 6, step: 0.1 },
  ],
  pipe: [
    { key: 'flowing',   label: 'Flowing',   type: 'boolean', default: true },
    { key: 'speed',     label: 'Flow Speed',type: 'number',  default: 1.2, min: 0, max: 5, step: 0.1 },
    { key: 'direction', label: 'Direction', type: 'select',  default: 'forward',
      options: [{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }] },
    { key: 'radius',    label: 'Radius',    type: 'number',  default: 0.12, min: 0.03, max: 0.6, step: 0.01 },
    { key: 'color',     label: 'Color',     type: 'color',   default: '#9fb0c0' },
  ],
  busbar: [
    { key: 'bars',  label: 'Bars',  type: 'number', default: 3, min: 1, max: 4, step: 1 },
    { key: 'width', label: 'Width', type: 'number', default: 0.28, min: 0.05, max: 0.6, step: 0.01 },
    { key: 'color', label: 'Color', type: 'color',  default: '#b87333' },
  ],
}

export function getConnectorSchema(connectorType) {
  return CONNECTOR_SCHEMAS[connectorType] ?? []
}

export function getDefaultConnectorConfig(connectorType) {
  const schema = getConnectorSchema(connectorType)
  const cfg = {}
  for (const f of schema) cfg[f.key] = f.default
  return cfg
}
