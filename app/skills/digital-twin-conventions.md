---
name: digital-twin-conventions
description: >
  Shared industrial conventions for EVERY Digital Twin skill (generate, manipulate,
  demo-data, create-component, edit-component). These standards make twins of ANY
  shopfloor — beverage, pharma, CNC machining, chemical, food, packaging, metals,
  warehousing — come out uniform, realistic and useful. Always applied; the other
  skills reference this.
version: 1.1
source: ISA-95, ISA-18.2, ISA-101, OPC-UA / Sparkplug B naming; src/lib/parameterSchemas.js (FREQUENCIES), stateSchemas.js, textures.js (FINISHES)
---

# Digital Twin — Industrial Conventions (apply to every skill)

These are the rules that keep output **uniform across any industry**. The asset
catalog and worked examples in the other skills are just *illustrations* — the
method below is what generalises.

## 1. Model ANY asset — catalog OR custom (never block)
For each real piece of equipment:
1. If a built-in catalog `type` fits (or is close), **use it**.
2. If nothing fits, **declare a custom asset** rather than skipping it — a labelled
   primitive placeholder (`box`/`cylinder`/`tank` via `customAssetTypes`, or a
   multi-part custom component via the create-component skill). Geometry can be a
   simple block now and be refined in the Studio later; what matters is that the
   **structure, hierarchy and telemetry are complete**.
So a reactor, oven, CNC, robot cell, AGV, palletiser, extruder, blister-packer,
mixer, kiln, press, dryer, etc. are all representable — even if not in the catalog.

## 2. Hierarchy & UNS (ISA-95) — REQUIRED, every asset grouped
Group by **physical / process structure**, never by machine category. Standard
levels (use as many as the plant needs):
`Enterprise → Site → Area → Line / Cell → Unit → Asset`.
The grouped tree IS the Unified Namespace. A node's **UNS topic** is its ancestor
path, lowercased and slash-joined, plus the metric:
`acme/pune/packaging/line_1/filler_2/throughput`.
Per-parameter `topic` (when bound to live data) follows this address (OPC-UA /
Sparkplug B style). One `Utilities`/`Services` group for shared kit.

## 3. Telemetry by signal type (units + cadence) — pick realistically
Give every asset a few **meaningful** parameters. Choose them by what the asset
physically does; ALWAYS declare an engineering **unit** (SI preferred) and a
sampling **`freq`** matched to the signal's physics — do **not** make everything
real-time.

| signal family | examples (unit) | typical `freq` |
|---|---|---|
| electrical / fast process | current (A), voltage (V), flow (m³/h), speed (rpm, m/s) | `realtime`–`5s` |
| pressure / level / position | pressure (bar), level (%), valve position (%) | `5s`–`30s` |
| temperature | temp (°C) | `30s`–`5m` |
| efficiency / quality | OEE/CE (%), reject (%), defects (ppm) | `5m`–`1h` |
| consumables / counters | reel/ink/fill level (%), runtime (h), energy (kWh) | `1m`–`1h` |
| lab / hand-sampled | bath/metal temp, assay, moisture, pH (manually probed) | `manual` |

`freq ∈ realtime | 5s | 30s | 1m | 5m | 15m | 1h | manual`. `manual` values are
operator/lab entries — they don't stream; treat them as a steady last reading.

## 4. States & alarms (ISA-18.2)
Each asset sits in one clear `state`; states carry a `severity`:
`ok` = normal · `warn` = warning (attention) · `down` = alarm/fault (action).
Most assets are normal at any moment; reserve `warn`/`down` for the genuinely
abnormal. This severity drives status + glow automatically.

## 5. HMI colour (ISA-101 / high-performance HMI)
Green = ok, amber = warn, red = down. Keep the palette muted and reserve saturated
colour for the abnormal — a healthy plant should look calm, problems should pop.

## 6. Naming & values
- Parameter **keys**: short, stable, `lowerCamel` or `snake_case`; human `label` + `unit` always set.
- Asset/group **names**: what the thing IS ("Filler 2", "Mixing Reactor R-101", "CNC Mill 3").
- Keep every value **within its range**, and **vary** values across sibling assets so dashboards read as live, not cloned.

## 7. A twin must look WORKING — connected & moving
- **Connect the process flow.** Lay each line as a chain in process order and link **every adjacent machine** (upstream `connections: [{targetId, sourcePort, targetPort}]`, out → in). The app draws the connector (conveyor / pipe / busbar from the source port type) — so a connected product line shows **moving conveyors**. Never leave machines scattered and unlinked.
- **Give equipment connectable ports** (an inlet + outlet for line machines) — without ports, nothing can be wired.
- **Motion.** Components should include at least one animated part where the real machine moves; leave assets running and animations enabled so the scene is alive out of the box. Animation kinds: `spinY`/`spinX` (rotors, fans, agitators, mixers, wheels, rollers), `bob` (floats, liquid surfaces, hoists), `pulse` (indicators, flames, glowing elements), `rise` (smoke / steam / vapour / exhaust plumes that drift up off stacks, vents, cooling towers, quench). Drive the speed from a `config` key (`speedKey`) so it responds to run state; a per-part `rate` multiplier lets parts sharing one speed key move in ratio (counter-rotating starwheel `rate:-0.5`, fast idler `rate:2`). Rotating assemblies (carousels, turrets) animate their **group** part so children orbit together.

## 8. Materials — pick by what the surface REALLY is (PBR)
Never flat-grey everything. Choose a `material {color, metalness, roughness}` per surface family (emissive for things that glow), plus a procedural `finish` texture. A reusable palette (tune freely):

| surface | color | metalness | roughness | finish | notes |
|---|---|---|---|---|---|
| stainless steel (house default) | `#b0c4d0` | 0.85 | 0.12 | `brushedMetal` | shiny process steel |
| painted / structural steel | `#8a929b` | 0.7 | 0.35 | `paintedSteel` | frames, casings |
| dark steel / cast iron | `#5b626b` | 0.6 | 0.5 | `brushedMetal` | bases, heavy duty |
| copper / brass / busbar | `#b87333` | 0.9 | 0.3 | `brushedMetal` | electrical, heat-exchange |
| concrete (foundation/skid) | `#c9ccd1` | 0.04 | 0.92 | `concrete` | pads, plinths, civil |
| glass / sight-glass / acrylic | `#cfe6f2` | 0.1 | 0.05 | `none` | + `transparent:true, opacity:0.05–0.35`; add `edges:true, edgeColor:"#2b3440"` on big panels |
| rubber belt / hose | `#2b2f36` | 0.2 | 0.8 | `rubber` | conveyors, flexible lines |
| walkway / platform deck | `#3a4048` | 0.5 | 0.5 | `grating` | chequer/grating decks |
| weathered / old iron | `#7a5a3c` | 0.6 | 0.7 | `rust` | outdoor, legacy kit |
| safety yellow | `#e8b53a` | 0.3 | 0.55 | `paintedSteel` | handrails, bollards, hazard kit |
| plastic | (product colour) | 0.1 | 0.5 | — | totes, guards, caps |
| liquid / water | `#2f6fb0` | 0.2 | 0.25 | `none` | tank contents, basins |
| hot metal / ember (emissive) | `#3a3030` + emissive `#ff5a1f` | 0.6 | 0.6 | `none` | furnace glow, molten |
| smoke / steam / vapour (translucent) | `#d8dde4` | 0 | 1 | `none` | plumes — `transparent:true`, low opacity + `rise` |

`finish ∈ brushedMetal | paintedSteel | concrete | rubber | grating | rust | none`
(omit → auto-derived from metalness/roughness). Finishes add the micro surface
detail — brush streaks, paint scuffs, aggregate — that stops surfaces reading as
flat CGI plastic. **Glass-walled heroes:** a transparent enclosure with visible,
animated internals (fire, drum, impeller) is the house signature for main
machines — model what's inside, don't leave the box empty.

**Never place two faces exactly coplanar** (it z-fights — a sparkly speckle that crawls as the camera moves). A panel / window / door / label / road-marking that sits *on* another surface must either be **inset/proud by ≥0.02 m** so the faces don't coincide, **or** use a **decal material** (`"polygonOffset": true, "polygonOffsetFactor": -2, "polygonOffsetUnits": -2`) to win the depth test; base slabs/pads use a *positive* offset (`+1`) so things on top win. Same rule for two stacked thin parts — give them distinct positions.

## 9. Process media — colour pipes by what they carry
A pipe/duct's colour tells the operator the fluid. Colour **every** connection by medium and size mains thicker (`radius`), with `flowing:true`. Generic palette (extend as needed):

| medium | color | medium | color |
|---|---|---|---|
| steam | `#e0533d` | process / flue gas | `#4f555c` |
| hot / feed water | `#2fa45a` | air | `#a9d3ef` |
| cooling water | `#2f7fd0` | oil / fuel | `#b9892f` |
| condensate | `#2bb6c4` | chemical / acid | `#b05ec8` |
| make-up / treated water | `#8fcf7a` | drain / waste | `#6b7280` |

Pick `radius` by duty: branch ~0.12–0.3, header/main ~0.35–0.55, large duct/flue ~0.5+.

## 9b. Manufactured detail — silhouettes must read as machined
Use `roundedBox` (bevelled edges) for machine bodies — razor-sharp `box` edges are
the #1 "CGI tell". Dished-head `vessel`/`capsule` for tanks & drums, `ibeam` for
structure. Dress hero equipment with its mechanical furniture: bolt circles on
flanges/lids, split-casing flange joints, handrails + ladders on platforms, dial
gauges, valve handwheels, junction boxes, a nameplate. Sparse, sharp-edged models
read as toys; detailed, bevelled ones read as plant.

## 10. Foundations & supports
Heavy, floor-standing equipment reads as real when grounded: sit it on a **concrete pad / skid** (a flat box part in the concrete material at the base), put vessels on **legs or saddles**, and stand tall structures on **footings**. (There is no scene-level "pad" field — author it as a part of the component.)

## 11. Tooltips — headline metrics on the main machines only
The **hero / main** machines of a line (the ones an operator watches) expose a hover **tooltip** listing 2–3 headline parameters. Auxiliaries, small in-line parts and structural/civil items do **not** (avoid clutter). Tooltips are per-asset only — never on groups.
