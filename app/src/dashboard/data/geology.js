// Rock-type registry for the Depth Profile tool. Each rock's hardness drives the
// derived drilling rates (harder rock → slower ROP, more diesel, higher cost).
// `texture` maps to an SVG <pattern> drawn behind the layer colour in the
// stratigraphic column. Base rates are for a nominal blast-hole rig; the borehole
// layer builds scale them by rig factor + seeded noise.
export const ROCKS = {
  soil:      { id: 'soil',      name: 'Soil / Overburden', color: '#a9855f', texture: 'dots',  hardness: 1 },
  sandstone: { id: 'sandstone', name: 'Sandstone',         color: '#d9c08a', texture: 'stipple', hardness: 3 },
  shale:     { id: 'shale',     name: 'Shale',             color: '#7d8a97', texture: 'hlines', hardness: 4 },
  coal:      { id: 'coal',      name: 'Coal',              color: '#2b2b2f', texture: 'hlines', hardness: 2 },
  limestone: { id: 'limestone', name: 'Limestone',         color: '#c4cdd3', texture: 'brick',  hardness: 6 },
  basalt:    { id: 'basalt',    name: 'Basalt',            color: '#4a4560', texture: 'cross',  hardness: 9 },
}
export const ROCK_LIST = Object.values(ROCKS)
export const ROCK_OPTIONS = ROCK_LIST.map(r => ({ id: r.id, name: r.name }))

// Derive nominal drilling metrics for a rock from its hardness. Softer rock
// drills fast and cheap; basalt is the time/fuel/cost sink.
export function rockRates(rockId) {
  const r = ROCKS[rockId] || ROCKS.sandstone
  const h = r.hardness
  return {
    rop: Math.max(3, 34 - h * 3.3),          // m/h — fast in soil (~30), slow in basalt (~5)
    fuelPerM: 1.1 + h * 0.55,                // L/m — thirstier in hard rock
    rpm: 60 + h * 6,                         // rpm
    spp: 70 + h * 14,                        // bar — standpipe pressure
    hookLoad: 12 + h * 1.6,                  // t
    costPerM: 180 + h * 95,                  // ₹/m
  }
}
