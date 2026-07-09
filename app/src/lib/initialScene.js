// Current 3-line beverage layout expressed as scene store objects.

const ZA = 8.5, ZB = 0, ZC = -8.5

const obj = (id, type, name, position, status = 'running') => ({
  id, type, name,
  position, rotation: [0, 0, 0], scale: [1, 1, 1],
  layer: 'equipment', status, locked: false, visible: true,
  parentId:     null,
  connections:  [],
  dataBindings: [],
})

export const INITIAL_SCENE = {
  // Line A — PET Bottles
  'a-carb': obj('a-carb', 'Carbonator',   'Carbonator A',     [-23, 0, ZA]),
  'a-fill': obj('a-fill', 'PETFiller',    'PET Filler',       [-13, 0, ZA]),
  'a-cap':  obj('a-cap',  'RotaryCapper', 'Rotary Capper',    [ -4, 0, ZA], 'idle'),
  'a-lab':  obj('a-lab',  'Labeller',     'Labeller',         [  4, 0, ZA]),
  'a-cw':   obj('a-cw',   'CheckWeigher', 'Check Weigher A',  [ 11, 0, ZA]),

  // Line B — Cans
  'b-carb': obj('b-carb', 'Carbonator',   'Carbonator B',     [-23, 0, ZB]),
  'b-fill': obj('b-fill', 'CanFiller',    'Can Filler',       [-13, 0, ZB], 'fault'),
  'b-seam': obj('b-seam', 'CanSeamer',    'Can Seamer',       [ -5, 0, ZB]),
  'b-code': obj('b-code', 'DateCoder',    'Date Coder',       [  2, 0, ZB]),
  'b-cw':   obj('b-cw',   'CheckWeigher', 'Check Weigher B',  [  9, 0, ZB]),

  // Line C — Glass
  'c-wash': obj('c-wash', 'BottleWasher', 'Bottle Washer',    [-20, 0, ZC]),
  'c-fill': obj('c-fill', 'GlassFiller',  'Glass Filler',     [-11, 0, ZC]),
  'c-cap':  obj('c-cap',  'CrownCapper',  'Crown Capper',     [ -2, 0, ZC]),
  'c-ebi':  obj('c-ebi',  'EBIInspector', 'EBI Inspector',    [  6, 0, ZC], 'idle'),
  'c-cw':   obj('c-cw',   'CheckWeigher', 'Check Weigher C',  [ 13, 0, ZC]),
}
