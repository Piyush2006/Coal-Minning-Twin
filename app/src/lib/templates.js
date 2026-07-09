// Pre-built scene templates. Each resolves to a full objects map
// (same shape as INITIAL_SCENE) that loadScene() accepts directly.

import { statusFromState } from './stateSchemas'
import { THERMAL_POWER_PLANT } from './templates/thermalPowerPlant'
import { BOTTLING_PLANT } from './templates/bottlingPlant'
import { CEMENT_PLANT } from './templates/cementPlant'
import { COAL_MINE } from './templates/coalMine'

const baseObj = (id, type, name, position, status = 'running') => ({
  id, type, name,
  position, rotation: [0, 0, 0], scale: [1, 1, 1],
  layer: 'equipment', status, locked: false, visible: true,
  parentId: null, connections: [], dataBindings: [],
})

const PET_LINE = () => ({
  'p-carb': baseObj('p-carb', 'Carbonator',   'Carbonator',   [ -23, 0, 0]),
  'p-fill': baseObj('p-fill', 'PETFiller',    'PET Filler',   [ -13, 0, 0]),
  'p-cap':  baseObj('p-cap',  'RotaryCapper', 'Rotary Capper',[  -4, 0, 0]),
  'p-lab':  baseObj('p-lab',  'Labeller',     'Labeller',     [   4, 0, 0]),
  'p-cw':   baseObj('p-cw',   'CheckWeigher', 'Check Weigher',[  11, 0, 0]),
})

const CAN_LINE = () => ({
  'c-carb': baseObj('c-carb', 'Carbonator',   'Carbonator', [-23, 0, 0]),
  'c-fill': baseObj('c-fill', 'CanFiller',    'Can Filler', [-13, 0, 0]),
  'c-seam': baseObj('c-seam', 'CanSeamer',    'Can Seamer', [ -5, 0, 0]),
  'c-code': baseObj('c-code', 'DateCoder',    'Date Coder', [  2, 0, 0]),
  'c-cw':   baseObj('c-cw',   'CheckWeigher', 'Check Weigher',[ 9, 0, 0]),
})

const GLASS_LINE = () => ({
  'g-wash': baseObj('g-wash', 'BottleWasher', 'Bottle Washer', [-20, 0, 0]),
  'g-fill': baseObj('g-fill', 'GlassFiller',  'Glass Filler',  [-11, 0, 0]),
  'g-cap':  baseObj('g-cap',  'CrownCapper',  'Crown Capper',  [ -2, 0, 0]),
  'g-ebi':  baseObj('g-ebi',  'EBIInspector', 'EBI Inspector', [  6, 0, 0]),
  'g-cw':   baseObj('g-cw',   'CheckWeigher', 'Check Weigher', [ 13, 0, 0]),
})

const FULL_PLANT = () => {
  const ZA = 8.5, ZB = 0, ZC = -8.5
  const shift = (objs, dz) => {
    const out = {}
    for (const [id, o] of Object.entries(objs)) {
      out[id] = { ...o, position: [o.position[0], o.position[1], o.position[2] + dz] }
    }
    return out
  }
  return { ...shift(PET_LINE(), ZA), ...shift(CAN_LINE(), ZB), ...shift(GLASS_LINE(), ZC) }
}

const QUALITY_CLUSTER = () => ({
  'q-cw1': baseObj('q-cw1', 'CheckWeigher', 'Check Weigher 1', [-4, 0,  2]),
  'q-cw2': baseObj('q-cw2', 'CheckWeigher', 'Check Weigher 2', [-4, 0, -2]),
  'q-ebi': baseObj('q-ebi', 'EBIInspector', 'EBI Inspector',   [ 4, 0,  0]),
})

// ── Aluminium anode potline — authentic SIDE-BY-SIDE TRANSVERSE arrangement:
// two long dense rows of pots whose long axis is perpendicular to a central
// aisle (rotated 90° about Y), gable-ends + control cabinets facing the aisle,
// wired in series by base bus bars, with a full-bay PTM gantry, alumina silos
// and a tapping crucible. Each pot carries ACD telemetry + an "ACD high" glow rule.
// Demo condition per pot (global index 0..31) — the SINGLE SOURCE OF TRUTH for a
// pot's state. A realistic potroom spread: mostly Normal, a minority in various
// conditions. The simulation PRESERVES these (it only overlays rare transient
// events), and both the glow and the in-pot sub-parts derive from pot.state.
const POT_DEMO_STATE = {
  3: 'anodeChange', 6: 'anodeEffect', 9: 'beamRaise', 12: 'anodeChange', 14: 'offline',
  17: 'anodeEffect', 20: 'beamRaise', 23: 'anodeChange', 26: 'anodeEffect', 29: 'anodeChange',
}

const ANODE_POTLINE = () => {
  const N = 16, PITCH = 5, HALF = ((N - 1) * PITCH) / 2
  // rot orients each row so cabinet/stencil face the central aisle; dir sets the
  // series link direction so bus bars sit in the gap between adjacent pots.
  const ROWS = [
    { p: 'A', z: 6,  rot: [0,  Math.PI / 2, 0], dir: 'up',   group: 'grp_lineA' },
    { p: 'B', z: -6, rot: [0, -Math.PI / 2, 0], dir: 'down', group: 'grp_lineB' },
  ]
  // UNS namespace arranged by line: Line A · Line B · Utilities
  const groups = {
    grp_lineA:     { id: 'grp_lineA',     name: 'Line A',    parentId: null, order: 0 },
    grp_lineB:     { id: 'grp_lineB',     name: 'Line B',    parentId: null, order: 1 },
    grp_utilities: { id: 'grp_utilities', name: 'Utilities', parentId: null, order: 2 },
  }
  const objs = {}
  for (const row of ROWS) {
    const ids = []
    for (let i = 0; i < N; i++) {
      const id = `pot-${row.p}${i + 1}`
      ids.push(id)
      const x = -HALF + i * PITCH
      const gi = (row.p === 'A' ? 0 : N) + i           // global pot index 0..31
      const state = POT_DEMO_STATE[gi] || 'normal'
      objs[id] = {
        ...baseObj(id, 'ReductionPot', `Pot ${row.p}${i + 1}`, [x, 0, row.z], statusFromState('ReductionPot', state)),
        state,
        rotation: row.rot,
        parentId: row.group, order: i,
        parameters: {
          acd: 26 + (i % 5) * 4, voltage: 4.1 + (i % 3) * 0.15, current: 320,
          bathTemp: 955 + (i % 4) * 6, anodeAge: (i * 3) % 28,
        },
        rules: [
          { id: `acd-${id}`, enabled: true, parameter: 'acd', operator: '>',
            compareMode: 'constant', value: 40, refAssetId: null, refParameter: '', color: '#ff3b30' },
        ],
      }
    }
    // series bus bars in the gap between adjacent pots (direction depends on row rotation)
    for (let i = 0; i < N - 1; i++) {
      const [src, tgt] = row.dir === 'up' ? [ids[i], ids[i + 1]] : [ids[i + 1], ids[i]]
      objs[src].connections.push({
        id: `bb-${row.p}-${i}`, targetId: tgt,
        sourcePort: 'power_out', targetPort: 'power_in',
        connectorType: 'busbar', connectorConfig: {},
      })
    }
  }
  // PTM gantry spanning the aisle + both rows, travelling the full length
  objs['ptm'] = { ...baseObj('ptm', 'PotTendingMachine', 'Pot Tending Machine', [0, 0, 0]),
    layer: 'structural', parentId: 'grp_utilities', order: 0,
    config: { enabled: true, speed: 0.8, span: 22, travel: 32, bayLength: 80 } }
  // alumina silos at the line ends + tapping crucible in the aisle
  objs['silo-1']   = { ...baseObj('silo-1', 'AluminaSilo', 'Alumina Silo 1', [-HALF - 6, 0, 12]), layer: 'structural', parentId: 'grp_utilities', order: 1 }
  objs['silo-2']   = { ...baseObj('silo-2', 'AluminaSilo', 'Alumina Silo 2', [ HALF + 6, 0, 12]), layer: 'structural', parentId: 'grp_utilities', order: 2 }
  objs['crucible'] = { ...baseObj('crucible', 'TappingCrucible', 'Tapping Crucible', [HALF + 6, 0, 0]), parentId: 'grp_utilities', order: 3 }
  return { objects: objs, groups }
}

export const TEMPLATES = [
  {
    id: 'coal-mine',
    name: 'Coal Mine · Blackridge (Pit to Port)',
    description: 'Full coal mining process flow — pit fleet (drills, excavators, haul trucks), CHPP (crusher → conveyor → screen → DMC washing → thickener + water circuit), stockyard stacker-reclaimer, train load-out, shiploader & bulk carrier, end-use power station',
    build: COAL_MINE,
  },
  {
    id: 'cement-plant',
    name: 'Cement Plant · JSW Nandyal',
    description: 'Full cement line — crusher, raw/ball/coal/cement/slag mills, rotary kiln + preheater tower, silos, packing & utilities. Grouped to the UNS hierarchy with key params bound LIVE to JSW Nandyal tags.',
    build: CEMENT_PLANT,
  },
  {
    id: 'bottling-plant',
    name: 'Bottling Plant (Dairy)',
    description: 'Tecnomatix-style dairy — office + cut-away hall, silo farm, pasteuriser & CIP skids, and a filling line with conveyors packed with flowing bottles',
    build: BOTTLING_PLANT,
  },
  {
    id: 'thermal-power-plant',
    name: 'Thermal Power Plant',
    description: 'Coal-fired plant — boiler island, flue path, steam cycle, electrical & water systems',
    build: THERMAL_POWER_PLANT,
  },
  {
    id: 'thermal-power-plant-models',
    name: 'Thermal Power Plant · Imported Models',
    description: 'Same plant, hero units (turbine, generator, transformer, condenser, cooling tower) as imported glTF models — drop CC0 .glb files into public/models (see its README)',
    build: () => THERMAL_POWER_PLANT({ models: true }),
  },
  {
    id: 'anode-potline',
    name: 'Anode Potline',
    description: 'Aluminium smelter — 2×10 reduction pots, bus bars, PTM crane, silos',
    build: ANODE_POTLINE,
  },
  {
    id: 'full-plant',
    name: 'Full Beverage Plant',
    description: '3 lines — PET, Can, Glass — 15 machines',
    build: FULL_PLANT,
  },
  {
    id: 'pet-line',
    name: 'PET Bottle Line',
    description: 'Carbonator → Filler → Capper → Labeller → Check Weigher',
    build: PET_LINE,
  },
  {
    id: 'can-line',
    name: 'Can Line',
    description: 'Carbonator → Filler → Seamer → Date Coder → Check Weigher',
    build: CAN_LINE,
  },
  {
    id: 'glass-line',
    name: 'Glass Bottle Line',
    description: 'Washer → Filler → Crown Capper → EBI → Check Weigher',
    build: GLASS_LINE,
  },
  {
    id: 'quality-cluster',
    name: 'Quality Control Station',
    description: '2× Check Weighers + EBI Inspector',
    build: QUALITY_CLUSTER,
  },
]
