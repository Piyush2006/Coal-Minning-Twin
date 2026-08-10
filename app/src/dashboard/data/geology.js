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

// SVG <defs> patterns for the stratigraphic column. Rendered once by StrataColumn.
export const TEXTURE_DEFS = (
  '<pattern id="tx-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="rgba(0,0,0,0.28)"/></pattern>' +
  '<pattern id="tx-stipple" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.7" fill="rgba(0,0,0,0.22)"/><circle cx="4.5" cy="4" r="0.7" fill="rgba(0,0,0,0.22)"/></pattern>' +
  '<pattern id="tx-hlines" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="none"/><path d="M0 3 H6" stroke="rgba(0,0,0,0.3)" stroke-width="1"/></pattern>' +
  '<pattern id="tx-brick" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M0 0 H12 M0 4 H12 M0 0 V4 M6 4 V8 M0 8 H12" stroke="rgba(0,0,0,0.24)" stroke-width="0.8" fill="none"/></pattern>' +
  '<pattern id="tx-cross" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0 L8 8 M8 0 L0 8" stroke="rgba(0,0,0,0.28)" stroke-width="0.9"/></pattern>'
)
export const TEXTURE_URL = { dots: 'url(#tx-dots)', stipple: 'url(#tx-stipple)', hlines: 'url(#tx-hlines)', brick: 'url(#tx-brick)', cross: 'url(#tx-cross)' }
