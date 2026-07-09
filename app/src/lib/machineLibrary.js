import { Carbonator }    from '../components/machines/Carbonator'
import { PETFiller }     from '../components/machines/PETFiller'
import { RotaryCapper }  from '../components/machines/RotaryCapper'
import { Labeller }      from '../components/machines/Labeller'
import { CheckWeigher }  from '../components/machines/CheckWeigher'
import { CanFiller }     from '../components/machines/CanFiller'
import { CanSeamer }     from '../components/machines/CanSeamer'
import { DateCoder }     from '../components/machines/DateCoder'
import { BottleWasher }  from '../components/machines/BottleWasher'
import { GlassFiller }   from '../components/machines/GlassFiller'
import { CrownCapper }   from '../components/machines/CrownCapper'
import { EBIInspector }  from '../components/machines/EBIInspector'
import { ConveyorBelt }  from '../components/ConveyorBelt'
import { FlowConveyor, flowConveyorEnd } from '../components/FlowConveyor'
import { Tank }          from '../components/assets/Tank'
import { Pump }          from '../components/assets/Pump'
import { Valve }         from '../components/assets/Valve'
import { PipeSegment }   from '../components/assets/PipeSegment'
import { MountingStand } from '../components/assets/MountingStand'
import { ReductionPot }      from '../components/assets/ReductionPot'
import { PotTendingMachine } from '../components/assets/PotTendingMachine'
import { AluminaSilo }       from '../components/assets/AluminaSilo'
import { TappingCrucible }   from '../components/assets/TappingCrucible'
import { FloorPlane }        from '../components/assets/FloorPlane'
import { OverheadLight }     from '../components/assets/OverheadLight'
import { GLBModel }          from '../components/assets/GLBModel'
import { PPBoiler }          from '../components/assets/PPBoiler'
import { PitTerrain }        from '../components/terrain/PitTerrain'
import { TerrainMound }      from '../components/terrain/TerrainMound'
import { getCustomTypes }    from './customTypesRef'

export const MACHINE_COMPONENTS = {
  Carbonator,
  PETFiller,
  RotaryCapper,
  Labeller,
  CheckWeigher,
  CanFiller,
  CanSeamer,
  DateCoder,
  BottleWasher,
  GlassFiller,
  CrownCapper,
  EBIInspector,
  ConveyorBelt,
  FlowConveyor,
  Tank,
  Pump,
  Valve,
  PipeSegment,
  MountingStand,
  ReductionPot,
  PotTendingMachine,
  AluminaSilo,
  TappingCrucible,
  Floor: FloorPlane,
  Light: OverheadLight,
  Model: GLBModel,
  pp_boiler: PPBoiler,
  PitTerrain,
  TerrainMound,
}

// Port definitions per machine type.
// offset = [x, y, z] local-space position relative to machine group origin.
// type: 'product' | 'conveyor' | 'utility' | 'co2'
// direction: 'in' | 'out' | 'bidirectional'
export const MACHINE_PORTS = {
  Carbonator: [
    { id: 'water_in',   type: 'utility',   direction: 'in',  offset: [-1.5, 0.5,  0] },
    { id: 'co2_in',     type: 'co2',       direction: 'in',  offset: [   0, 1.8,  0.8] },
    { id: 'product_out',type: 'product',   direction: 'out', offset: [ 1.5, 0.5,  0] },
  ],
  PETFiller: [
    { id: 'product_in', type: 'product',   direction: 'in',  offset: [-2.5, 0.5,  0] },
    { id: 'product_out',type: 'product',   direction: 'out', offset: [ 2.5, 0.5,  0] },
    { id: 'conveyor_in',type: 'conveyor',  direction: 'in',  offset: [-2.5, 0,    0] },
    { id: 'conveyor_out',type:'conveyor',  direction: 'out', offset: [ 2.5, 0,    0] },
  ],
  CanFiller: [
    { id: 'product_in', type: 'product',   direction: 'in',  offset: [-2.5, 0.5,  0] },
    { id: 'product_out',type: 'product',   direction: 'out', offset: [ 2.5, 0.5,  0] },
    { id: 'conveyor_in',type: 'conveyor',  direction: 'in',  offset: [-2.5, 0,    0] },
    { id: 'conveyor_out',type:'conveyor',  direction: 'out', offset: [ 2.5, 0,    0] },
  ],
  GlassFiller: [
    { id: 'product_in', type: 'product',   direction: 'in',  offset: [-2.5, 0.5,  0] },
    { id: 'product_out',type: 'product',   direction: 'out', offset: [ 2.5, 0.5,  0] },
    { id: 'conveyor_in',type: 'conveyor',  direction: 'in',  offset: [-2.5, 0,    0] },
    { id: 'conveyor_out',type:'conveyor',  direction: 'out', offset: [ 2.5, 0,    0] },
  ],
  BottleWasher: [
    { id: 'bottle_in',  type: 'conveyor',  direction: 'in',  offset: [-3,   0,    0] },
    { id: 'bottle_out', type: 'conveyor',  direction: 'out', offset: [ 3,   0,    0] },
    { id: 'water_in',   type: 'utility',   direction: 'in',  offset: [ 0,   0.5, -1.5] },
  ],
  RotaryCapper: [
    { id: 'bottle_in',  type: 'conveyor',  direction: 'in',  offset: [-2,   0,    0] },
    { id: 'bottle_out', type: 'conveyor',  direction: 'out', offset: [ 2,   0,    0] },
    { id: 'cap_feed',   type: 'utility',   direction: 'in',  offset: [ 0,   2,    1] },
  ],
  CanSeamer: [
    { id: 'can_in',     type: 'conveyor',  direction: 'in',  offset: [-1.5, 0,    0] },
    { id: 'can_out',    type: 'conveyor',  direction: 'out', offset: [ 1.5, 0,    0] },
    { id: 'lid_feed',   type: 'utility',   direction: 'in',  offset: [ 0,   1.5,  1] },
  ],
  CrownCapper: [
    { id: 'bottle_in',  type: 'conveyor',  direction: 'in',  offset: [-1.5, 0,    0] },
    { id: 'bottle_out', type: 'conveyor',  direction: 'out', offset: [ 1.5, 0,    0] },
    { id: 'crown_feed', type: 'utility',   direction: 'in',  offset: [ 0,   2,    0.8] },
  ],
  Labeller: [
    { id: 'bottle_in',  type: 'conveyor',  direction: 'in',  offset: [-2,   0,    0] },
    { id: 'bottle_out', type: 'conveyor',  direction: 'out', offset: [ 2,   0,    0] },
  ],
  DateCoder: [
    { id: 'product_in', type: 'conveyor',  direction: 'in',  offset: [-1,   0,    0] },
    { id: 'product_out',type: 'conveyor',  direction: 'out', offset: [ 1,   0,    0] },
  ],
  CheckWeigher: [
    { id: 'product_in', type: 'conveyor',  direction: 'in',  offset: [-1.5, 0,    0] },
    { id: 'product_out',type: 'conveyor',  direction: 'out', offset: [ 1.5, 0,    0] },
    { id: 'reject_out', type: 'conveyor',  direction: 'out', offset: [ 0,   0,    1.5] },
  ],
  EBIInspector: [
    { id: 'bottle_in',  type: 'conveyor',  direction: 'in',  offset: [-2,   0,    0] },
    { id: 'bottle_out', type: 'conveyor',  direction: 'out', offset: [ 2,   0,    0] },
    { id: 'reject_out', type: 'conveyor',  direction: 'out', offset: [ 0,   0,    1.5] },
  ],

  // ── Material handling / utilities (some overridden dynamically below) ──
  ConveyorBelt: [
    { id: 'conveyor_in',  type: 'conveyor', direction: 'in',  offset: [-4, 0, 0] },
    { id: 'conveyor_out', type: 'conveyor', direction: 'out', offset: [ 4, 0, 0] },
  ],
  Tank: [
    { id: 'outlet', type: 'utility', direction: 'out', offset: [0, 0.5, 1.0] },
  ],
  Pump: [
    { id: 'inlet',  type: 'utility', direction: 'in',  offset: [-0.45, 0.3, 0] },
    { id: 'outlet', type: 'utility', direction: 'out', offset: [ 0.45, 0.3, 0] },
  ],
  Valve: [
    { id: 'inlet',  type: 'utility', direction: 'in',  offset: [-0.35, 0.3, 0] },
    { id: 'outlet', type: 'utility', direction: 'out', offset: [ 0.35, 0.3, 0] },
  ],
  // Reduction pots are placed side-by-side TRANSVERSE (rotated 90° about Y), so
  // power ports sit on the local ±Z long faces → after rotation they face along
  // the row (world ±X), where the series bus bars connect adjacent pots.
  ReductionPot: [
    { id: 'power_in',  type: 'power', direction: 'in',  offset: [0, 0.5, -2.0] },
    { id: 'power_out', type: 'power', direction: 'out', offset: [0, 0.5,  2.0] },
  ],
  AluminaSilo: [
    { id: 'outlet', type: 'utility', direction: 'out', offset: [0, 1.8, 0] },
  ],
  // Terrain: material leaves the pit at the ramp toe (east edge of the floor).
  PitTerrain: [
    { id: 'coal_out', type: 'product', direction: 'out', offset: [30, 1, 5] },
  ],
  TerrainMound: [
    { id: 'waste_in', type: 'product', direction: 'in', offset: [0, 3, 0] },
  ],
}

// Default span used when a ConveyorBelt has no config yet.
const CONVEYOR_DEFAULT_LENGTH = 8

// Resolve the port list for a placed object. For parametric assets
// (ConveyorBelt, PipeSegment) the port offsets are DERIVED from config.length
// so they track the geometry as the user resizes it — never stored. Everything
// else uses the static MACHINE_PORTS table. Consumed by SceneRenderer (PortDots)
// and snapEngine (findSnap), keeping geometry, port dots and snapping in lockstep.
export function getPorts(obj) {
  if (!obj) return []
  if (obj.type === 'ConveyorBelt') {
    const L = obj.config?.length ?? CONVEYOR_DEFAULT_LENGTH
    return [
      { id: 'conveyor_in',  type: 'conveyor', direction: 'in',  offset: [-L / 2, 0, 0] },
      { id: 'conveyor_out', type: 'conveyor', direction: 'out', offset: [ L / 2, 0, 0] },
    ]
  }
  if (obj.type === 'FlowConveyor') {
    return [
      { id: 'conveyor_in',  type: 'conveyor', direction: 'in',  offset: [0, 0.95, 0] },
      { id: 'conveyor_out', type: 'conveyor', direction: 'out', offset: flowConveyorEnd(obj.config) },
    ]
  }
  if (obj.type === 'PipeSegment') {
    const L = obj.config?.length ?? 4
    return [
      { id: 'pipe_in',  type: 'utility', direction: 'in',  offset: [-L / 2, 0.4, 0] },
      { id: 'pipe_out', type: 'utility', direction: 'out', offset: [ L / 2, 0.4, 0] },
    ]
  }
  if (MACHINE_PORTS[obj.type]) return MACHINE_PORTS[obj.type]
  // Custom Component Spec declares its own ports.
  const custom = getCustomTypes()[obj.type]
  return Array.isArray(custom?.ports) ? custom.ports : []
}

// The single representative IN / OUT port for an asset — used by the process-flow
// graph (one clean handle per side, n8n-style). Prefers material-flow ports so
// the common machine→machine link materialises as a conveyor.
const OUT_PREF = ['conveyor', 'product', 'co2', 'utility']
const IN_PREF  = ['conveyor', 'product', 'utility', 'co2']
export function primaryPort(obj, direction) {
  const ports = getPorts(obj).filter(p => p.direction === direction || p.direction === 'bidirectional')
  if (ports.length === 0) return null
  const pref = direction === 'out' ? OUT_PREF : IN_PREF
  for (const t of pref) { const m = ports.find(p => p.type === t); if (m) return m }
  return ports[0]
}

export const MACHINE_LIBRARY = [
  {
    category: 'Filling & Processing',
    items: [
      { type: 'Carbonator',   label: 'Carbonator'    },
      { type: 'PETFiller',    label: 'PET Filler'    },
      { type: 'CanFiller',    label: 'Can Filler'    },
      { type: 'GlassFiller',  label: 'Glass Filler'  },
      { type: 'BottleWasher', label: 'Bottle Washer' },
    ],
  },
  {
    category: 'Capping & Sealing',
    items: [
      { type: 'RotaryCapper', label: 'Rotary Capper' },
      { type: 'CanSeamer',    label: 'Can Seamer'    },
      { type: 'CrownCapper',  label: 'Crown Capper'  },
    ],
  },
  {
    category: 'Packaging & Coding',
    items: [
      { type: 'Labeller',     label: 'Labeller'      },
      { type: 'DateCoder',    label: 'Date Coder'    },
    ],
  },
  {
    category: 'Quality Control',
    items: [
      { type: 'CheckWeigher', label: 'Check Weigher' },
      { type: 'EBIInspector', label: 'EBI Inspector' },
    ],
  },
  {
    category: 'Material Handling',
    items: [
      { type: 'ConveyorBelt', label: 'Conveyor Belt', layer: 'conveyors' },
      { type: 'FlowConveyor', label: 'Flow Conveyor (dense product)', layer: 'conveyors' },
    ],
  },
  {
    category: 'Utilities & Structure',
    items: [
      { type: 'Tank',          label: 'Tank',           layer: 'piping' },
      { type: 'Pump',          label: 'Pump',           layer: 'piping' },
      { type: 'Valve',         label: 'Valve',          layer: 'piping' },
      { type: 'PipeSegment',   label: 'Pipe Segment',   layer: 'piping' },
      { type: 'MountingStand', label: 'Mounting Stand', layer: 'structural' },
      { type: 'Floor',         label: 'Floor',          layer: 'structural' },
      { type: 'Light',         label: 'Light',          layer: 'structural' },
    ],
  },
  {
    category: '3D Models',
    items: [
      { type: 'Model', label: 'Imported Model (glTF)', layer: 'equipment' },
    ],
  },
  {
    category: 'Aluminium Smelter',
    items: [
      { type: 'ReductionPot',      label: 'Reduction Pot',      layer: 'equipment' },
      { type: 'PotTendingMachine', label: 'Pot Tending Machine', layer: 'structural' },
      { type: 'AluminaSilo',       label: 'Alumina Silo',       layer: 'structural' },
      { type: 'TappingCrucible',   label: 'Tapping Crucible',   layer: 'equipment' },
    ],
  },
  {
    category: 'Terrain & Civil',
    items: [
      { type: 'PitTerrain',   label: 'Open Pit (Benched)', layer: 'structural' },
      { type: 'TerrainMound', label: 'Terrain Mound',      layer: 'structural' },
    ],
  },
]

// type → default layer (from the library), so imported/partial specs that omit
// `layer` still land on a real, visible layer.
const TYPE_LAYER = {}
const TYPE_CATEGORY = {}
MACHINE_LIBRARY.forEach(c => c.items.forEach(it => {
  TYPE_LAYER[it.type] = it.layer ?? 'equipment'
  TYPE_CATEGORY[it.type] = c.category
}))
export const defaultLayerForType = (type) => TYPE_LAYER[type] ?? 'equipment'
// type → library category, used to auto-bucket any ungrouped asset so the
// namespace is never flat ("always organized in hierarchy").
export const categoryForType = (type) => TYPE_CATEGORY[type] ?? 'General'

// Library category for a CUSTOM asset type. Uses the type's own `category` when it
// is meaningful; otherwise infers one from the label so imported/AI-generated
// components don't all pile under a single flat "Custom" bucket.
const CUSTOM_CAT_RULES = [
  [/barrel|drum|\btank\b|silo|hopper|vessel|cistern/i, 'Tanks & Vessels'],
  [/extinguisher|hydrant|alarm|\bsafety\b|guard|railing|bollard|sign/i, 'Safety'],
  [/cabinet|drawer|\bbox\b|container|case|crate|\brack\b|shelf|pallet|storage|bin|tote/i, 'Storage & Props'],
  [/condenser|air.?con|hvac|transformer|power|switchgear|panel|busbar|cable|pump|valve|pipe|compressor|blower|fan|utility/i, 'Utilities'],
  [/light|lamp|fixture|beacon|sconce|luminaire/i, 'Lighting'],
  [/mill|crusher|conveyor|filler|capper|labeller|seamer|mixer|reactor|press|spindle|\bcnc\b|machine|motor|drive|gearbox|robot|arm|kiln|furnace|turbine|generator/i, 'Equipment'],
]
export function customCategory(ct) {
  const c = (ct?.category || '').trim()
  if (c && !/^custom(\s|$)/i.test(c)) return c            // a real, non-default category wins
  const label = ct?.label || ''
  for (const [re, cat] of CUSTOM_CAT_RULES) if (re.test(label)) return cat
  return 'Custom'
}

// Group a customAssetTypes map into [{ category, items }] for the library panels,
// filtered by `match(label)`, with the catch-all "Custom" bucket sorted last.
export function groupCustomTypes(customAssetTypes = {}, match = () => true) {
  const by = {}
  for (const ct of Object.values(customAssetTypes)) {
    if (!match(ct.label)) continue
    ;(by[customCategory(ct)] ??= []).push(ct)
  }
  return Object.keys(by)
    .sort((a, b) => (a === 'Custom' ? 1 : b === 'Custom' ? -1 : a.localeCompare(b)))
    .map(category => ({ category, items: by[category].sort((x, y) => (x.label || '').localeCompare(y.label || '')) }))
}
