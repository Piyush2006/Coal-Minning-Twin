// Operation taxonomy — the demo ships one mine + one plant, a handful of areas
// and equipment types. Filters genuinely scope the views where it makes sense
// (utilisation / downtime / fleet); selectors are disabled where they don't apply.
export const CURRENCY = '₹'

export const MINES = [
  { id: 'all', name: 'All Operations' },
  { id: 'oc', name: 'Blackridge Opencast · Mine' },
  { id: 'chpp', name: 'Blackridge CHPP · Plant' },
]

export const AREAS = [
  { id: 'all', name: 'All Areas', side: 'both' },
  { id: 'pit', name: 'Pit · Drill & Blast', side: 'mine' },
  { id: 'load', name: 'Excavation & Loading', side: 'mine' },
  { id: 'haul', name: 'Haulage', side: 'mine' },
  { id: 'crush', name: 'Crushing', side: 'plant' },
  { id: 'wash', name: 'Washery · CHPP', side: 'plant' },
  { id: 'dispatch', name: 'Stockyard & Dispatch', side: 'plant' },
]

export const EQUIP_TYPES = [
  { id: 'all', name: 'All Equipment', side: 'both' },
  { id: 'drill', name: 'Blast-Hole Drill', side: 'mine' },
  { id: 'shovel', name: 'Shovel / Excavator', side: 'mine' },
  { id: 'loader', name: 'Wheel Loader', side: 'mine' },
  { id: 'truck', name: 'Haul Truck', side: 'mine' },
  { id: 'crusher', name: 'Crusher', side: 'plant' },
  { id: 'conveyor', name: 'Conveyor', side: 'plant' },
  { id: 'screen', name: 'Screen', side: 'plant' },
]

// which "side" the current mine/plant selection restricts to
export const sideOf = (mineId) => (mineId === 'oc' ? 'mine' : mineId === 'chpp' ? 'plant' : 'both')
