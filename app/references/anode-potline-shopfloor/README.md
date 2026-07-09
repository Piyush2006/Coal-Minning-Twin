# Anode Potline Shopfloor — Template Resources

Drop everything you have for the aluminium **anode potline / reduction shopfloor** here.
I'll use these to recreate it as a **procedural Three.js template** (new entry in
`src/lib/templates.js` + any new machine components in `src/components/`), following
the project's "procedural geometry only" rule.

## Where to put things
- **Reference photos / renders** → `images/` (jpg/png — wide shots, close-ups, top-down/plot plans)
- **Drawings / specs / PDFs** → this folder (layout drawings, P&IDs, equipment lists, dimensions)
- **Branding** (logos, colours) → this folder

## Most useful uploads (in priority order)
1. **Overall layout / plot plan** — how pots are arranged (rows, side-by-side vs end-to-end, spacing, aisle width, how many pots per line).
2. **A single pot / reduction cell** — shape, size, anode stubs/risers on top, the steel shell, tap-hole side.
3. **Pot Tending Machine (PTM) / overhead crane** — the gantry that travels the line.
4. **Bus bars & anode rods** — the conductor runs between pots.
5. **Alumina feed / hoppers, gas-collection ducting** above the pots.
6. **Materials & colours** — steel shades, anode carbon black, hot-metal glow, hall lighting.
7. **Dimensions** — pot length/width/height, line length, bay height (even rough numbers help scale it correctly).

## What I'll build from them
- Procedural components (e.g. `ReductionPot`, `PotTendingCrane`, `BusBar`, `AnodeRod`, `AluminaHopper`) with per-asset **config** (settings) + **parameters** (telemetry for rules) like the existing machines.
- A **"Anode Potline"** template that lays out a full line, wired into the Templates tab.
- Sensible **status/animation** (e.g. crane travel, anode glow) and **ports** so pots/connections snap and render connectors.

## Notes
- Tell me the **target scale** (real metres) if you know it, so the new line matches the existing beverage lines' grid.
- If any image shows a layout you specifically want replicated, point me to the filename.
