// Items that ride on conveyor belts. Pure data only (no JSX) so this module is
// safe to import from the store and the schema registry. ConveyorBelt.jsx reads
// these descriptors and builds the meshes generically.
//
// shape: 'bottle' | 'can' | 'box' — how ConveyorBelt renders it.

export const ITEM_LIBRARY = [
  { value: 'pet_bottle',   label: 'PET Bottle',   shape: 'bottle', radius: 0.09,  height: 0.50, color: '#bfe3ff' },
  { value: 'can',          label: 'Can',          shape: 'can',    radius: 0.085, height: 0.30, color: '#d8dde2' },
  { value: 'glass_bottle', label: 'Glass Bottle', shape: 'bottle', radius: 0.085, height: 0.46, color: '#3f7f55' },
  { value: 'crate',        label: 'Crate',        shape: 'box',    width: 0.45,   height: 0.30, depth: 0.45, color: '#c08040' },
  { value: 'coal',         label: 'Coal',         shape: 'box',    width: 0.40,   height: 0.26, depth: 0.40, color: '#23262b' },
  { value: 'ash',          label: 'Ash',          shape: 'box',    width: 0.34,   height: 0.22, depth: 0.34, color: '#9aa0a8' },
]

export const ITEM_MAP = Object.fromEntries(ITEM_LIBRARY.map(i => [i.value, i]))

// [{ value, label }] for the conveyor's `itemType` select field.
export const ITEM_OPTIONS = ITEM_LIBRARY.map(i => ({ value: i.value, label: i.label }))
