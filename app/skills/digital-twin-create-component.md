---
name: digital-twin-create-component
description: >
  Author a custom COMPONENT (a reusable, multi-part asset type) for the Faclon
  Digital Twin Workbench from a natural-language brief. Use when the user asks to
  "create / design / make a [thing] component", "build a custom asset", or
  "make a reusable [machine]" (e.g. "create a motor-pump skid", "design a mixing
  tank with an agitator"). The component is then placeable in the scene like any
  built-in. Distinct from digital-twin-generate (whole scenes) and
  digital-twin-manipulate (editing the current scene).
version: 1.3
source: src/lib/componentSpec.js (validateComponentSpec, GEOMETRY_DEFS, blankPart),
        src/components/CompositeAsset.jsx (renderer), src/lib/componentSubs.js (expandSubToParts),
        src/lib/textures.js (FINISHES), src/lib/detailKit.js (mechanical-furniture recipes),
        src/lib/parameterSchemas.js (FREQUENCIES), src/store/sceneStore.js (addCustomAssetType)
---

# Digital Twin — Create Component Skill

You author a **Component Spec**: one JSON document that the app registers with
`addCustomAssetType(spec)` and renders with `CompositeAsset`. You do **not** write
3D code — you **compose** a component from procedural primitives, nested existing
components, groups and data nodes, then declare its knobs, telemetry, states and
ports. The app back-fills every default, so the spec can be **partial**.

**A component is just a tree of parts.** Everything else (config, parameters,
states, ports, beacon) hangs off that tree. Components are how *any* non-catalog
asset gets modelled. Apply the shared **CONVENTIONS**: SI `unit`s, a `freq` cadence
by signal type, `topic` as the UNS/OPC-UA address, and ISA-18.2 `severity` on states.

**Be thorough — quality matters.** Author a believable **multi-part** asset:
primitives composed into the real silhouette (foundation/skid + base/frame + body +
the defining features — stations, nozzles, rollers, vessels, arms, ducts, ladders),
grouped into named sub-assemblies; proper materials (per surface); the **ports** it
connects by; **parameters that matter** with units + cadence; and a real **state
machine**. **Never** return a single bare box — that's the failure mode this skill
exists to prevent.
- **Detail bar:** a **hero** machine ≈ **20–60 parts** (use `group` parts for sub-assemblies and repeated elements); a simpler auxiliary ~8–20. Add a **foundation/support** (§4) and **≥1 animated part** (§5). More real detail is better — this is what makes any shopfloor look genuinely engineered.

**Output:** emit **only** the Component Spec as one strict, minified JSON object.

---

## 0. Clarify first — but only when it matters

If the brief leaves a **high-impact variable** genuinely ambiguous, ask the user
BEFORE building, by returning the `clarify` envelope:
```jsonc
{ "mode":"clarify", "message":"Quick check before I build it:",
  "questions":[ { "question":"…", "options":["…","…"], "default":"…" } ] }   // ≤3 questions
```

Ask ONLY about things whose answer **changes the component**:
- **Scale / size class** (benchtop vs industrial; small/medium/large).
- **Counts of key repeated elements** (how many cells / nozzles / bays / anodes).
- **Which optional sub-assemblies or features** to include (e.g. "with an agitator?", "include a cooling jacket?").
- **Critical parameter units / ranges** only when truly ambiguous (e.g. flow in m³/h vs L/min).
- **Connectivity** when it affects the design (inlet/outlet sides, power feed).

NEVER ask about things you can sensibly default: colours, exact dimensions,
material finish, cosmetic detail, naming. Keep it to **≤3 questions**, each with
2–4 concrete `options` and a `default`. If the brief is already specific enough to
build something sensible, **skip clarify entirely** and emit the component. Once
the user answers, produce the Component Spec.

---

## 1. Output contract (Component Spec)

```jsonc
{
  "label": "Motor-Pump Skid",          // REQUIRED — display name
  "category": "Custom",                 // optional — library grouping
  "layer": "equipment",                 // equipment | piping | structural | conveyors | annotations
  "parts": [ … ],                       // REQUIRED — ≥1 part (the visual + structure; see §2)
  "ports": [ … ],                       // optional — connection points (§7)
  "config": [ … ],                      // optional — settings/knobs that drive geometry & animation (§5)
  "parameters": [ … ],                  // optional — telemetry fields (§6)
  "states": [ … ] | null,               // optional — operational state machine (§8); null → Running/Idle/Fault
  "beacon": { "offset": [x,y,z] } | null // optional — status light position; null = none, omit = auto
}
```

When used by the assistant, wrap it in the envelope: `{"mode":"component","message":"…","spec":{…}}`.

---

## 2. Parts — the building blocks

Each part has `id`, optional `label`, `parentId` (null = top level → a tree),
optional `parameters` (§6, per-part telemetry) and optional `rules` (§6a, per-part
glow thresholds). There are five KINDS:

```jsonc
// (a) PRIMITIVE — a procedural shape (the default kind; no `kind` field)
{ "id":"body", "label":"Pump Body", "parentId":null,
  "geometry":"cylinder",                       // roundedBox | box | cylinder | capsule | vessel | sphere | cone | torus | ibeam (§3)
  "dims":{ "radius":0.5, "height":1.2 },
  "position":[0,0.6,0], "rotation":[0,0,0], "scale":[1,1,1],
  "material":{ "color":"#b0c4d0", "metalness":0.85, "roughness":0.12 },   // §4
  "animate":{ "kind":"spinY", "speedKey":"speed" } }                       // optional (§5)

// (b) GROUP — a transform folder with NO geometry; moving it moves its children.
// A group may ALSO `animate` — its children move together (THE way to build a
// rotating carousel/turret/starwheel: spin the group, not each pocket).
{ "id":"carousel", "label":"Filler Carousel", "parentId":null, "kind":"group",
  "position":[0,0,0], "rotation":[0,0,0], "scale":[1,1,1],
  "animate":{ "kind":"spinY", "speedKey":"speed" } }

// (c) COMPONENT — nest an existing built-in or custom type in place (transform only)
{ "id":"pump", "parentId":null, "kind":"component", "ref":"Pump",
  "position":[2,0,0], "rotation":[0,0,0], "scale":[1,1,1] }

// (d) LOGICAL — a non-visual data node (organisation + parameters only)
{ "id":"controller", "label":"PLC", "parentId":null, "kind":"logical",
  "parameters":[ … ] }

// (e) MODEL — an imported glTF/GLB sub-mesh placed in-line (photoreal detail inside
// an otherwise procedural component). `url` MUST be a real, user-supplied .glb URL —
// NEVER invent one; default to procedural parts. `fit` = target size in metres.
{ "id":"scan", "label":"Scanned Head", "parentId":null, "kind":"model",
  "url":"https://…/head.glb", "fit":2, "position":[0,1,0] }
```

**Repeated elements → a GROUP + individual parts.** For rows of bolts, nozzles,
anodes, windows, cells, etc., create one `group` part and a child primitive part
per element, laid out with explicit `position`s. Each child is then individually
selectable and parameterised — e.g. a Reduction Pot's **Anodes** group holds 40
`Anode N` parts, each with its own `current` / `age` parameters (§6). This is the
default — prefer literal parts so every element is editable.

> Advanced: for very large arrays where individual editing isn't needed, the engine
> also supports a declarative `subComponents` array (count + layout, rendered
> instanced; layout kinds: `row | ring | grid | doubleRow | perimeter`). Default to
> literal grouped parts unless asked otherwise.

---

## 3. Geometry catalog (procedural only — no imported meshes)

| geometry     | dims fields                          | use for |
|--------------|--------------------------------------|---------|
| `roundedBox` | `width`, `height`, `depth`, `bevel`  | **machine bodies / casings / cabinets — PREFER over `box`** (bevelled, manufactured edges) |
| `box`        | `width`, `height`, `depth`           | thin panels, trim, structure |
| `cylinder`   | `radius`, `height`                   | shafts, pipes, rollers |
| `capsule`    | `radius`, `height`                   | horizontal drums, receivers, headers (hemispherical ends) |
| `vessel`     | `radius`, `height`                   | pressure vessels / tanks / columns (lathe profile with dished heads) |
| `sphere`     | `radius`                             | domes, ends |
| `cone`       | `radius`, `height`                   | hoppers, stack tips |
| `torus`      | `radius`, `tube`                     | rings, handwheels, platforms |
| `ibeam`      | `width`, `height`, `depth` (length)  | structural steel frames, columns, rails |

Build any shape by composing these in groups. Keep parts on/above the floor
(`y ≥ 0`) unless deliberately stacking. Real objects have no razor-sharp edges —
a `bevel` ≈ 3–6 % of the smallest dimension reads as fabricated metal.

**Mechanical furniture (what makes it look REAL).** Detailed equipment carries the
small hardware of real machines — add them as low-poly parts. Proven recipes (these
exact proportions ship in the app's own detail kit — reuse them):
- **bolt circle** on a flange/lid/end-cover of radius `r`: 6–12 cylinders (`radius max(0.03, r*0.07)`, `height 0.07–0.12`) evenly on a ring at `r*0.82`, dark steel `#3c434c`/0.7/0.45.
- **flanged joint** where casings split: a disc (`radius r`, `height ~0.08`) + its bolt circle.
- **stiffener ribs** along a shell/casing face: 3–6 thin boxes (`width 0.06, depth 0.12`, height of the run), evenly spaced.
- **handrail** on platforms/walkways (safety yellow `#e8b53a`/0.3/0.55): top rail cylinder (`radius 0.035`) at +1.05 m, mid rail (`radius 0.028`) at +0.58 m, posts every ~1.6 m.
- **ladder** up tall kit: 2 rails (`radius 0.03`, 0.45 m apart) + rungs (`radius 0.02`) every 0.32 m.
- **dial gauge**: thin cylinder (`radius 0.16, height 0.06`) face-mounted + a small red hub (`radius ~0.035`, emissive `#c2382e`, `animate:{"kind":"pulse"}`).
- **valve handwheel**: torus (`radius 0.22, tube 0.03`) + 2 crossed spoke boxes + a stem cylinder, painted red `#b8483a`; `animate:{"kind":"spinY"}` if it should turn.
- **junction box + conduit**: roundedBox `0.34×0.44×0.18` (bevel 0.02) + a conduit cylinder (`radius 0.035`) running down.
- **nameplate**: plaque box `0.6×0.28×0.03` in `#dfe4ea` with the decal offset (`polygonOffset:true, factor −2`).
A hero machine should include several of these — bolts on its flanges, a rail on its
platform, a gauge near its controls — not just the big silhouette.

## 4. Materials & house style
- `meshStandard` PBR only: `{ color:"#hex", metalness:0..1, roughness:0..1 }`.
- **Pick a real material per surface from the CONVENTIONS §8 palette** — stainless `#b0c4d0`/0.85/0.12 (default), painted steel `#8a929b`/0.7/0.35, copper `#b87333`/0.9/0.3, concrete `#c9ccd1`/0.04/0.92, glass `#cfe6f2`/0.1/0.05, rubber `#2b2f36`/0.2/0.8, liquid `#2f6fb0`/0.2/0.25, translucent smoke/steam `#d8dde4`. Don't flat-grey everything.
- **`finish` — procedural surface texture** (adds micro-detail so surfaces don't read as flat CGI plastic): `"finish":"brushedMetal"|"paintedSteel"|"concrete"|"rubber"|"grating"|"rust"|"none"`. Use `brushedMetal` on bare/stainless steel, `paintedSteel` on painted casings & safety-yellow kit, `concrete` on pads/plinths/civil, `rubber` on belts/hoses, `grating` on walkway/platform decks, `rust` for weathered/old iron. Omit it and a sensible finish is auto-derived from metalness/roughness; `"none"` forces untextured (use on glass, liquid, smoke, emissive glow parts).
- Optional `emissive`:"#hex" + `emissiveIntensity` for glowing parts (gauges, lights, furnace glow, molten metal).
- **See-through parts**: `"transparent":true, "opacity":0.05–0.35` for guard glass, sight-glasses, enclosure windows, smoke/steam plumes. Optional crisp panel outlines: `"edges":true, "edgeColor":"#2b3440"` (great on large glass walls so they stay visible). A glass wall that lets you SEE the working internals (fire, drum, impeller) is a signature move for hero equipment — model the internals behind it.
- **Never leave two faces exactly coplanar** — it z-fights (sparkly speckle that crawls when the camera moves). A thin part mounted **flush** on another surface (a window/vent on a shell, a label on a panel) must be **inset/proud by ≥0.02 m** OR use a decal offset: `"polygonOffset": true, "polygonOffsetFactor": -2, "polygonOffsetUnits": -2` so it wins the depth test cleanly. Base slabs/pads take a *positive* offset (`+1`).
- Never pure black. Keep it clean and industrial.

**Foundations & supports.** There is no scene "pad" field — author grounding as parts: floor-standing equipment gets a flat **concrete pad/skid** box at the base (`#c9ccd1`/0.04/0.92, e.g. `height 0.4`, slightly larger than the footprint, at `y≈0.2`); vessels get **legs or saddles**; tall structures get **footings**. This makes heavy kit read as real, not floating.

## 5. Config (the knobs) + animation
`config` field defs drive geometry/animation at runtime (auto-generated form):
```jsonc
{ "key":"speed", "label":"Speed", "type":"number", "default":1, "min":0, "max":3, "step":0.05 }
// type: number | boolean | select(+options:[{value,label}]) | color | text
```
A primitive, group or model part may `animate`: `{ "kind":"spinY|spinX|pulse|bob|rise", "speedKey":"<config key>", "rate":1 }`.
- `spinY`/`spinX` — rotors, fans, agitators, mixers, wheels, rollers, drums.
- `bob` — floats, liquid surfaces, hoists (gentle up/down).
- `pulse` — indicators, flames, glowing elements (scale throb).
- `rise` — smoke / steam / vapour / exhaust **plumes**: the part drifts upward, grows and recycles. Use a translucent light-grey material (CONVENTIONS §8) on a few stacked puff spheres above a stack/vent/cooling-tower/quench.
- `rate` (optional, default 1) multiplies the shared speed **per part** — so several parts can share one `speedKey` yet move in ratio (a starwheel counter-rotating at `rate:-0.5` against the main carousel, an idler roller at `rate:2`).
- **Animate the GROUP for assemblies that rotate as one** (carousel, turret, agitator with blades): put `animate` on the `kind:"group"` part and its children orbit together.
Animation runs only when `config.enabled !== false` and the asset status is running,
scaled by the referenced config value. **Include at least one** animated part where the real machine moves.

## 6. Parameters (telemetry)
Telemetry fields that rules/charts/Bruce read. **Every node carries its own** —
put a parameter on the component, on a group, or on an individual part (e.g. each
anode's `current`). Same field shape everywhere:
```jsonc
{ "key":"flowRate", "label":"Flow Rate", "unit":"m³/h", "default":24, "min":0, "max":200,
  "freq":"5s",                       // realtime | 5s | 30s | 1m | 5m | 15m | 1h | manual — industry-standard cadence ("manual" = operator-entered)
  "topic":"plant/line/dev/flow/lastdp" }   // optional UNS path that binds this value to live data
```
- `freq` sets how often the value refreshes (don't make everything realtime — pick the real cadence; physical lab readings are usually `manual`).
- `topic` is optional; set it only when the value should come from a real UNS/tag source.

### 6a. Per-part rules (threshold → glow)
Any part may carry `rules` — thresholds on its **own** parameters that glow that
part a colour when met (a hot bearing glows red, a starved feeder amber):
```jsonc
"rules":[ { "parameter":"temp", "operator":">", "value":85, "color":"#ff3b30" } ]
// operator: > >= < <= == !=  ·  parameter must exist in that part's own `parameters`
```
Use sparingly — one or two on the parts an operator genuinely watches.

## 7. Ports (snapping / process flow)
```jsonc
{ "id":"inlet", "type":"utility", "direction":"in", "offset":[-0.5,0.4,0] }
// type: product | conveyor | utility | co2 | power   ·   direction: in | out | bidirectional
```

## 8. States (drive status + glow)
```jsonc
{ "key":"running","label":"Running","color":"#34c759","severity":"ok" }
// severity: ok | warn | down   →   down glows RED, warn glows amber automatically
```
Omit/`null` to use the default Running / Idle / Fault machine.

## 9. Beacon
`beacon:{offset:[x,y,z]}` places the status light; `null` = none; omit = auto (above the tallest part).

---

## 10. Recipe (the order to think in)
1. **Identity** — `label`, `category`, `layer`.
2. **Parts tree** — block out major shapes as primitives; wrap repeated elements in `group`s with one part each; nest existing components with `kind:"component"`.
3. **Materials** — steel by default; emissive for indicators.
4. **Config** — expose the knobs (speed, sizes, colors); bind animation `speedKey`s.
5. **Parameters** — the telemetry that matters, on the right node, with units + `freq` (+ `topic` only if UNS-bound).
6. **States** — the operational machine, with severities.
7. **Ports** — where it connects.
8. Emit the spec.

### Worked example — a rotary capping machine (hero-tier density: THIS is the bar)
Note what it demonstrates: a foundation pad; a `group` carousel that `spinY`s with
6 station children (rod + chuck each); a **counter-rotating** starwheel (`rate:-1.6`);
transparent guard panels; a flange with a bolt ring; a gauge, nameplate (decal
`polygonOffset`) and HMI on a pole; conveyor in/out ports on the correct faces.
```json
{"mode":"component","message":"Created a 6-head rotary capper.","spec":{
  "label":"Rotary Capping Machine","category":"Packaging","layer":"equipment",
  "parts":[
    {"id":"pad","label":"Foundation Pad","parentId":null,"geometry":"box","dims":{"width":3.6,"height":0.3,"depth":2.8},"position":[0,0.15,0],"material":{"color":"#c9ccd1","metalness":0.04,"roughness":0.92,"polygonOffset":true,"polygonOffsetFactor":1,"polygonOffsetUnits":1}},
    {"id":"base","label":"Machine Base","parentId":null,"geometry":"roundedBox","dims":{"width":3,"height":0.9,"depth":2.2,"bevel":0.04},"position":[0,0.75,0],"material":{"color":"#8a929b","metalness":0.7,"roughness":0.35}},
    {"id":"col","label":"Turret Column","parentId":null,"geometry":"cylinder","dims":{"radius":0.25,"height":1.2},"position":[0,1.5,0],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"flange","label":"Column Flange","parentId":null,"geometry":"cylinder","dims":{"radius":0.4,"height":0.06},"position":[0,2.08,0],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"bolts","label":"Flange Bolts","parentId":null,"kind":"group","position":[0,2.14,0]},
    {"id":"b1","label":"Bolt 1","parentId":"bolts","geometry":"cylinder","dims":{"radius":0.035,"height":0.06},"position":[0.32,0,0],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"b2","label":"Bolt 2","parentId":"bolts","geometry":"cylinder","dims":{"radius":0.035,"height":0.06},"position":[-0.32,0,0],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"b3","label":"Bolt 3","parentId":"bolts","geometry":"cylinder","dims":{"radius":0.035,"height":0.06},"position":[0,0,0.32],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"b4","label":"Bolt 4","parentId":"bolts","geometry":"cylinder","dims":{"radius":0.035,"height":0.06},"position":[0,0,-0.32],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"caro","label":"Capping Carousel","parentId":null,"kind":"group","position":[0,2.2,0],"animate":{"kind":"spinY","speedKey":"speed"}},
    {"id":"turret","label":"Turret Plate","parentId":"caro","geometry":"cylinder","dims":{"radius":0.9,"height":0.12},"position":[0,0,0],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"r1","label":"Head Rod 1","parentId":"caro","geometry":"cylinder","dims":{"radius":0.05,"height":0.5},"position":[0.7,-0.3,0],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"c1","label":"Chuck 1","parentId":"caro","geometry":"cone","dims":{"radius":0.09,"height":0.12},"position":[0.7,-0.62,0],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"r2","label":"Head Rod 2","parentId":"caro","geometry":"cylinder","dims":{"radius":0.05,"height":0.5},"position":[0.35,-0.3,0.61],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"c2","label":"Chuck 2","parentId":"caro","geometry":"cone","dims":{"radius":0.09,"height":0.12},"position":[0.35,-0.62,0.61],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"r3","label":"Head Rod 3","parentId":"caro","geometry":"cylinder","dims":{"radius":0.05,"height":0.5},"position":[-0.35,-0.3,0.61],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"c3","label":"Chuck 3","parentId":"caro","geometry":"cone","dims":{"radius":0.09,"height":0.12},"position":[-0.35,-0.62,0.61],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"r4","label":"Head Rod 4","parentId":"caro","geometry":"cylinder","dims":{"radius":0.05,"height":0.5},"position":[-0.7,-0.3,0],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"c4","label":"Chuck 4","parentId":"caro","geometry":"cone","dims":{"radius":0.09,"height":0.12},"position":[-0.7,-0.62,0],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"r5","label":"Head Rod 5","parentId":"caro","geometry":"cylinder","dims":{"radius":0.05,"height":0.5},"position":[-0.35,-0.3,-0.61],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"c5","label":"Chuck 5","parentId":"caro","geometry":"cone","dims":{"radius":0.09,"height":0.12},"position":[-0.35,-0.62,-0.61],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"r6","label":"Head Rod 6","parentId":"caro","geometry":"cylinder","dims":{"radius":0.05,"height":0.5},"position":[0.35,-0.3,-0.61],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"c6","label":"Chuck 6","parentId":"caro","geometry":"cone","dims":{"radius":0.09,"height":0.12},"position":[0.35,-0.62,-0.61],"material":{"color":"#5b626b","metalness":0.6,"roughness":0.5}},
    {"id":"star","label":"Infeed Starwheel","parentId":null,"kind":"group","position":[-1.35,1.35,0.6],"animate":{"kind":"spinY","speedKey":"speed","rate":-1.6}},
    {"id":"starp","label":"Starwheel Plate","parentId":"star","geometry":"cylinder","dims":{"radius":0.42,"height":0.1},"position":[0,0,0],"material":{"color":"#e8b53a","metalness":0.3,"roughness":0.5}},
    {"id":"starped","label":"Starwheel Pedestal","parentId":"star","geometry":"cylinder","dims":{"radius":0.08,"height":1.3},"position":[0,-0.62,0],"material":{"color":"#8a929b","metalness":0.7,"roughness":0.35}},
    {"id":"hstand","label":"Cap Hopper Stand","parentId":null,"geometry":"cylinder","dims":{"radius":0.07,"height":1.5},"position":[0.9,1.95,-0.6],"material":{"color":"#8a929b","metalness":0.7,"roughness":0.35}},
    {"id":"hopper","label":"Cap Hopper","parentId":null,"geometry":"cone","dims":{"radius":0.5,"height":0.7},"position":[0.9,3,-0.6],"rotation":[3.1416,0,0],"material":{"color":"#b0c4d0","metalness":0.85,"roughness":0.12}},
    {"id":"guardL","label":"Guard Panel L","parentId":null,"geometry":"box","dims":{"width":0.06,"height":1.5,"depth":2.2},"position":[1.52,1.95,0],"material":{"color":"#cfe6f2","metalness":0.1,"roughness":0.05,"transparent":true,"opacity":0.22}},
    {"id":"guardR","label":"Guard Panel R","parentId":null,"geometry":"box","dims":{"width":0.06,"height":1.5,"depth":2.2},"position":[-1.52,1.95,0],"material":{"color":"#cfe6f2","metalness":0.1,"roughness":0.05,"transparent":true,"opacity":0.22}},
    {"id":"gauge","label":"Pressure Gauge","parentId":null,"geometry":"cylinder","dims":{"radius":0.09,"height":0.06},"position":[-1,0.95,1.14],"rotation":[1.5708,0,0],"material":{"color":"#eef2f5","metalness":0.2,"roughness":0.3}},
    {"id":"ghub","label":"Gauge Hub","parentId":null,"geometry":"cylinder","dims":{"radius":0.02,"height":0.03},"position":[-1,0.95,1.18],"rotation":[1.5708,0,0],"material":{"color":"#ff3b30","metalness":0.2,"roughness":0.4}},
    {"id":"plate","label":"Nameplate","parentId":null,"geometry":"box","dims":{"width":0.5,"height":0.25,"depth":0.02},"position":[0.8,0.85,1.11],"material":{"color":"#2c3540","metalness":0.3,"roughness":0.4,"polygonOffset":true,"polygonOffsetFactor":-2,"polygonOffsetUnits":-2}},
    {"id":"hmipole","label":"HMI Pole","parentId":null,"geometry":"cylinder","dims":{"radius":0.06,"height":2},"position":[1.7,1,1],"material":{"color":"#8a929b","metalness":0.7,"roughness":0.35}},
    {"id":"hmi","label":"HMI Panel","parentId":null,"geometry":"roundedBox","dims":{"width":0.5,"height":0.35,"depth":0.08,"bevel":0.02},"position":[1.7,2.1,1],"material":{"color":"#2c3540","metalness":0.3,"roughness":0.4,"emissive":"#3aa0ff","emissiveIntensity":0.35}}
  ],
  "ports":[
    {"id":"bottles_in","type":"conveyor","direction":"in","offset":[-1.8,0.55,0.6]},
    {"id":"bottles_out","type":"conveyor","direction":"out","offset":[1.8,0.55,0.6]},
    {"id":"caps_in","type":"utility","direction":"in","offset":[0.9,3.4,-0.6]}
  ],
  "config":[{"key":"enabled","label":"Animate","type":"boolean","default":true},{"key":"speed","label":"Carousel Speed","type":"number","default":1.2,"min":0,"max":4,"step":0.05}],
  "parameters":[
    {"key":"throughput","label":"Throughput","unit":"bph","default":18000,"min":0,"max":36000,"freq":"5s"},
    {"key":"capTorque","label":"Cap Torque","unit":"N·m","default":1.8,"min":0,"max":5,"freq":"5s"},
    {"key":"rejects","label":"Rejects","unit":"%","default":0.4,"min":0,"max":10,"freq":"5m"}
  ],
  "states":[{"key":"running","label":"Running","color":"#34c759","severity":"ok"},{"key":"idle","label":"Idle","color":"#ff9f0a","severity":"warn"},{"key":"fault","label":"Fault","color":"#ff3b30","severity":"down"}],
  "beacon":{"offset":[0,3.6,0]}
}}
```

---

## 11. Hard constraints (checklist before you emit)
- At least **one** part; every part `id` unique.
- `geometry` ∈ {roundedBox, box, cylinder, capsule, vessel, sphere, cone, torus, ibeam}; `dims` use that geometry's fields (§3). Prefer `roundedBox` for bodies, `vessel`/`capsule` for tanks & drums, `ibeam` for structure.
- `animate.kind` ∈ {spinY, spinX, pulse, bob, rise}; `kind:"model"` parts only with a real user-supplied `url`.
- `material.finish` (if set) ∈ {brushedMetal, paintedSteel, concrete, rubber, grating, rust, none}.
- `parentId` references an existing part id or `null`; **no cycles**.
- Colours are `#rrggbb`; numeric fields within sensible ranges.
- **Repeated elements are grouped** (a `group` + one part each), never one giant blob.
- `parameters[].freq` is one of the allowed cadences; pick the industry-standard rate. `topic` is optional (UNS binding) — omit unless asked.
- Part `rules[].parameter` keys exist in that part's own `parameters`.
- `states[].severity` ∈ {ok, warn, down}.
- Output is **STRICT, MINIFIED JSON** — double quotes, no comments, no trailing commas, no code fences, no prose.
