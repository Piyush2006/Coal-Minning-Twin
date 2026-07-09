# Digital Twin Workbench — Twin Spec Authoring Guide (for any LLM)

You are authoring a **Twin Spec**: one JSON object describing a complete 3D industrial
digital twin (a shopfloor/plant). A human will paste your JSON into a file and use the
app's **Import** button, which loads it directly — so your output must be exactly one
valid JSON object and nothing else.

The human will describe the plant they want below/after this document. Follow their
brief; where they are silent, apply the defaults and quality standards in this guide.

---

## 0. Output rules (non-negotiable)

- Reply with **exactly ONE JSON object** — no prose, no markdown fences, no comments,
  no trailing commas. Strict `JSON.parse`-able.
- All ids are strings you invent: short, unique, stable (`filler-1`, `grp_line_a`).
- Units are **metres**, Y is up, assets sit on the floor (`position[1] = 0` unless stacking parts inside a component).
- Angles are **radians** in `rotation` / part `rot`.

## 1. Top-level shape

```json
{
  "meta": { "title": "My Plant", "description": "one line" },
  "objects": { "<objId>": { } },
  "groups": { "<groupId>": { "name": "Line A", "parentId": null, "order": 0 } },
  "customAssetTypes": { "<typeId>": { } }
}
```

## 2. Scene object (an instance placed in the world)

```json
"filler-1": {
  "type": "PETFiller",
  "name": "PET Filler 1",
  "position": [x, 0, z],
  "rotation": [0, 0, 0],
  "scale": [1, 1, 1],
  "layer": "equipment",
  "parentId": "grp_line_a",
  "order": 0,
  "config": { "enabled": true, "speed": 1 },
  "parameters": { "throughput": 312 },
  "rules": [ { "enabled": true, "parameter": "throughput", "operator": "<", "compareMode": "constant", "value": 100, "color": "#ff3b30" } ],
  "connections": [ { "targetId": "capper-1", "sourcePort": "conveyor_out", "targetPort": "bottle_in" } ],
  "tooltip": { "enabled": true, "params": ["throughput", "fillVolume"] }
}
```

- `type` must be a built-in catalog type (§3) **or** a key of your `customAssetTypes` (§4).
- `layer` ∈ `equipment | conveyors | piping | structural | annotations`.
- **Every object needs a `parentId` group** — never leave assets at the root.
- `parameters`: give every machine realistic values, **varied across siblings** (dashboards
  must not look cloned).
- `tooltip`: ONLY on the few hero/main machines per line (2–3 headline param keys that
  exist on the type). Never on groups.
- `rules`: optional glow-on-threshold; `operator ∈ > >= < <= == !=`.

### Groups (the UNS hierarchy)
`{ "name": "Filling Line", "parentId": null, "order": 0 }` — nest freely
(Site → Area → Line). Optional `kpis` on a line group:
`"kpis": [{ "key": "rate", "label": "Line Rate", "unit": "bpm", "assetType": "PETFiller", "parameter": "throughput", "agg": "sum" }]`
(`agg ∈ avg|sum|min|max|count`).

## 3. Built-in catalog types (use these `type` names + port ids verbatim)

**Beverage machines** (all ~4–6 m wide, product flows −X → +X):

| type | ports (id · type · dir) |
|---|---|
| `Carbonator` | water_in·utility·in, co2_in·co2·in, product_out·product·out |
| `PETFiller` / `CanFiller` / `GlassFiller` | product_in·product·in, product_out·product·out, conveyor_in·conveyor·in, conveyor_out·conveyor·out |
| `BottleWasher` | bottle_in·conveyor·in, bottle_out·conveyor·out, water_in·utility·in |
| `RotaryCapper` | bottle_in·conveyor·in, bottle_out·conveyor·out, cap_feed·utility·in |
| `CanSeamer` | can_in·conveyor·in, can_out·conveyor·out, lid_feed·utility·in |
| `CrownCapper` | bottle_in·conveyor·in, bottle_out·conveyor·out, crown_feed·utility·in |
| `Labeller` | bottle_in·conveyor·in, bottle_out·conveyor·out |
| `DateCoder` | product_in·conveyor·in, product_out·conveyor·out |
| `CheckWeigher` | product_in·conveyor·in, product_out·conveyor·out, reject_out·conveyor·out |
| `EBIInspector` | bottle_in·conveyor·in, bottle_out·conveyor·out, reject_out·conveyor·out |

**Utilities & structure:** `Tank` (outlet·utility·out; config: radius, height, fillLevel, color) ·
`Pump` (inlet/outlet·utility; config: speed, color) · `Valve` (inlet/outlet·utility) ·
`PipeSegment` (config: length) · `MountingStand` · `Floor` (config: width, depth, color,
reflective, showLanes) · `Light`. **Smelter:** `ReductionPot` (power_in/power_out·power),
`PotTendingMachine`, `AluminaSilo`, `TappingCrucible`.

**`ConveyorBelt`** — connector-style belt asset. config: `{ "running": true, "speed": 1.2, "beltStyle": "chain"|"roller", "length": 8, "itemType": "pet_bottle", "itemSpacing": 1.4 }`. Ports conveyor_in/out at ±length/2.

**`FlowConveyor`** — a belt **PACKED with flowing product** (instanced bottles) — use for
hero filling/packing lines. Path starts at the object's origin and runs +X.
config: `{ "running": true, "length": 8, "curve": "none"|"left"|"right", "curveRadius": 2, "lanes": 1, "laneGap": 0.24, "spacing": 0.22, "speed": 0.7, "capColor": "#2f6fb0", "label": "" }` —
set `label` to a hex colour on conveyors **downstream of a labeller** so bottles carry a
wrap-around label band. Ports: conveyor_in at origin, conveyor_out at the path end.

**`Model`** — imported glTF (config: url, fit, scale, yaw). Only use if the human names a model URL.

## 4. Custom components (`customAssetTypes`) — build any machine

When no catalog type fits, author a **multi-part component** and place instances of it.

```json
"my_kiln": {
  "label": "Rotary Kiln", "category": "Cement", "layer": "equipment", "schemaVersion": 1,
  "defaultConfig": { "enabled": true, "speed": 1 },
  "parts": [ ...see below... ],
  "ports": [ { "id": "feed_in", "type": "utility", "direction": "in", "offset": [-4, 1.2, 0] } ],
  "config": [ { "key": "enabled", "label": "Running", "type": "boolean", "default": true },
              { "key": "speed", "label": "Speed", "type": "number", "default": 1, "min": 0, "max": 3, "step": 0.1 } ],
  "parameters": [ { "key": "kilnTemp", "label": "Kiln Temp", "unit": "°C", "default": 1450, "min": 0, "max": 1600, "freq": "30s" } ],
  "states": null, "subComponents": [], "beacon": null
}
```

### Parts
```json
{ "id": "p1", "label": "Shell", "geometry": "roundedBox",
  "dims": { "width": 4, "height": 2.4, "depth": 3, "bevel": 0.1 },
  "position": [0, 1.4, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1],
  "material": { "color": "#c3ccd4", "metalness": 0.85, "roughness": 0.16, "finish": "brushedMetal" },
  "animate": null, "parentId": null }
```

**Geometries** (dims fields):
`roundedBox` (width,height,depth,bevel — **PREFER over `box` for bodies**: bevelled,
manufactured edges) · `box` (thin panels/structure) · `cylinder` (radius,height) ·
`capsule` (radius,height — drums with hemispherical ends) · `vessel` (radius,height —
pressure vessel with dished heads) · `sphere` · `cone` (radius,height) · `torus`
(radius,tube) · `ibeam` (width,height,depth=length along Z — structural steel).

**Materials** — pick real surfaces, never flat-grey everything:
- stainless `#c3ccd4` m.85 r.16 finish `brushedMetal` · painted steel `#8a929b` m.7 r.35 finish `paintedSteel` · concrete `#c9ccd1` m.04 r.92 finish `concrete` · grating finish `grating` · rubber/dark `#2b2f36` m.2 r.8 · safety yellow `#e8c11c`
- glass/guards: `{ "color": "#dfeaf2", "metalness": 0.1, "roughness": 0.08, "transparent": true, "opacity": 0.15 }`
- glowing: add `"emissive": "#ff5200", "emissiveIntensity": 1.5`
- thin overlay flush ON another face: add `"polygonOffset": true, "polygonOffsetFactor": -2, "polygonOffsetUnits": -2` (base slabs use `+1`). **Never leave two faces exactly coplanar** — inset ≥ 0.02 m or use the offset.

**Animation** — `"animate": { "kind": "spinY"|"spinX"|"pulse"|"bob"|"rise", "speedKey": "speed", "rate": 1 }`
- `rise` = smoke/steam plumes (translucent spheres above stacks).
- **`rate` matters**: rotor surface speed must match belt speed. `rate = beltSpeed / (0.96 × workingRadius)`; negative = counter-rotation. E.g. belt 0.7 m/s: carousel r1.2 → 0.61; starwheel r0.46 → −1.58.
- **Orbiting assemblies**: a part with `"kind": "group"` (no geometry, has position/rotation/scale + `animate`) spins its children — put bottles/valves with `"parentId": "<groupId>"` on a carousel so they orbit. This is how fillers/labellers look real.

**Mechanical detail is REQUIRED for hero machines** (12–40+ parts): bolt circles (n small
cylinders r0.045 on a ring) on flanges/lids, handrails (top+mid rail cylinders + posts,
safety yellow) on platforms, ladders (2 rails + rungs), dial gauges (thin cylinder + red
hub), valve handwheels (torus + 2 crossed boxes + stem), nameplates, junction boxes,
pedestals under every starwheel/turret (**nothing floats** — every part must rest on the
foundation, another part, or the ground), and a **concrete foundation pad part** under
floor-standing equipment (`box`, height 0.25, at y 0.125, concrete material).

**Ports:** `{ "id", "type": "product|conveyor|utility|co2|power", "direction": "in|out|bidirectional", "offset": [x,y,z] }` — put fluid ports on faces AWAY from conveyor lanes (e.g. back-top) so pipes never route through the machine.

## 5. Connections (the process must be CONNECTED)

On the **source** object: `{ "targetId", "sourcePort", "targetPort", "connectorType"?, "connectorConfig"? }`.
Connector auto-derives from source port type: `conveyor`→belt, `power`→busbar, else pipe.

**Colour every pipe by medium** (`connectorConfig`): steam `#e0533d` · feed/hot water `#2fa45a` · cooling water `#2f7fd0` · condensate `#2bb6c4` · raw/treated water `#8fcf7a` · gas/flue `#4f555c` (radius .5) · air `#a9d3ef` · oil/fuel `#b9892f` · chemical/CIP `#b05ec8` · milk/product `#f2efe6`. Include `"flowing": true` and a `radius` (branch .12–.3, main .35–.55). Busbar: `{ "bars": 3, "width": 0.28, "color": "#b87333" }`.

## 6. Quality standards (the importer's owner WILL check these)

1. **Continuity** — every FlowConveyor/ConveyorBelt **starts inside the upstream machine's
   footprint and ends inside the downstream machine's** (tuck ≥ 0.2 m; machines ~±2–3.5 m
   about their position along the line axis). The line starts at a source machine
   (feeder/depalletiser) — never a bare belt start. Product must visibly be *carried*
   at every hand-off.
2. **No overlap / grounding** — assets must not intersect each other (leave ≥ 1 m between
   footprints except designed belt pass-throughs); every part supported; pipes routed
   via ports that face away from lines.
3. **Speed match** — belts on one line share one `speed`; every rotor gets a physical
   `rate` (see §4).
4. **Hierarchy** — every object in a group; groups form Site → Area → Line.
5. **Alive by default** — machines `"status": "running"` (default), animations on,
   conveyors `running: true`, pipes `flowing: true`.
6. Layout: line machines in process order along +X, pitch 8–10 m; parallel lines
   separated by 8–10 m in Z; tanks/utilities in their own area; keep everything within
   ~±60 m of the origin.

## 7. Minimal complete example (structure reference — expand to the human's brief)

```json
{
  "meta": { "title": "Mini Juice Line" },
  "groups": {
    "grp_plant": { "name": "Juice Plant", "parentId": null, "order": 0 },
    "grp_line":  { "name": "Filling Line", "parentId": "grp_plant", "order": 0 },
    "grp_util":  { "name": "Utilities", "parentId": "grp_plant", "order": 1 }
  },
  "customAssetTypes": {
    "jx_feeder": {
      "label": "Bottle Feeder", "category": "Juice", "layer": "equipment", "schemaVersion": 1,
      "defaultConfig": { "enabled": true, "speed": 1 },
      "parts": [
        { "id": "f0", "label": "Foundation", "geometry": "box", "dims": { "width": 3.6, "height": 0.25, "depth": 3.2 }, "position": [0, 0.125, 0], "rotation": [0,0,0], "scale": [1,1,1], "material": { "color": "#c9ccd1", "metalness": 0.04, "roughness": 0.92, "finish": "concrete" }, "animate": null, "parentId": null },
        { "id": "f1", "label": "Hopper", "geometry": "roundedBox", "dims": { "width": 1.8, "height": 1.4, "depth": 1.8, "bevel": 0.07 }, "position": [-0.6, 0.95, -0.6], "rotation": [0,0,0], "scale": [1,1,1], "material": { "color": "#9fa9b2", "metalness": 0.75, "roughness": 0.3, "finish": "brushedMetal" }, "animate": null, "parentId": null },
        { "id": "f2", "label": "Unscrambler Bowl", "geometry": "cylinder", "dims": { "radius": 0.8, "height": 0.5 }, "position": [0.7, 2.0, -0.6], "rotation": [0,0,0], "scale": [1,1,1], "material": { "color": "#c3ccd4", "metalness": 0.85, "roughness": 0.16, "finish": "brushedMetal" }, "animate": { "kind": "spinY", "speedKey": "speed" }, "parentId": null },
        { "id": "f3", "label": "Bowl Column", "geometry": "cylinder", "dims": { "radius": 0.16, "height": 1.8 }, "position": [0.7, 0.9, -0.6], "rotation": [0,0,0], "scale": [1,1,1], "material": { "color": "#7d8790", "metalness": 0.7, "roughness": 0.4 }, "animate": null, "parentId": null },
        { "id": "f4", "label": "Discharge Deck", "geometry": "box", "dims": { "width": 1.4, "height": 0.08, "depth": 0.6 }, "position": [1.0, 0.95, 0], "rotation": [0,0,0], "scale": [1,1,1], "material": { "color": "#9fa9b2", "metalness": 0.75, "roughness": 0.3 }, "animate": null, "parentId": null }
      ],
      "ports": [ { "id": "bottles_out", "type": "conveyor", "direction": "out", "offset": [1.7, 0.95, 0] } ],
      "config": [ { "key": "enabled", "label": "Running", "type": "boolean", "default": true }, { "key": "speed", "label": "Speed", "type": "number", "default": 1, "min": 0, "max": 3, "step": 0.1 } ],
      "parameters": [ { "key": "feedRate", "label": "Feed Rate", "unit": "bpm", "default": 300, "min": 0, "max": 500, "freq": "5s" } ],
      "states": null, "subComponents": [], "beacon": null
    }
  },
  "objects": {
    "feeder": { "type": "jx_feeder", "name": "Bottle Feeder", "position": [-14, 0, 0], "rotation": [0,0,0], "scale": [1,1,1], "layer": "equipment", "parentId": "grp_line", "order": 0, "config": { "enabled": true, "speed": 1 }, "parameters": { "feedRate": 300 }, "tooltip": { "enabled": true, "params": ["feedRate"] }, "connections": [] },
    "fc1": { "type": "FlowConveyor", "name": "Infeed Conveyor", "position": [-12.6, 0, 0], "rotation": [0,0,0], "scale": [1,1,1], "layer": "conveyors", "parentId": "grp_line", "order": 1, "config": { "running": true, "length": 6.4, "lanes": 1, "spacing": 0.22, "speed": 0.7, "capColor": "#2f6fb0" }, "connections": [] },
    "filler": { "type": "PETFiller", "name": "Filler", "position": [-4, 0, 0], "rotation": [0,0,0], "scale": [1,1,1], "layer": "equipment", "parentId": "grp_line", "order": 2, "parameters": { "throughput": 310, "fillVolume": 500 }, "tooltip": { "enabled": true, "params": ["throughput", "fillVolume"] }, "connections": [ { "targetId": "cw", "sourcePort": "conveyor_out", "targetPort": "product_in" } ] },
    "cw": { "type": "CheckWeigher", "name": "Check Weigher", "position": [5, 0, 0], "rotation": [0,0,0], "scale": [1,1,1], "layer": "equipment", "parentId": "grp_line", "order": 3, "parameters": {}, "connections": [] },
    "tank": { "type": "Tank", "name": "Juice Tank", "position": [-4, 0, -8], "rotation": [0,0,0], "scale": [1,1,1], "layer": "piping", "parentId": "grp_util", "order": 0, "config": { "radius": 1.2, "height": 3.4, "fillLevel": 70, "color": "#cdd6e2" }, "connections": [ { "targetId": "filler", "sourcePort": "outlet", "targetPort": "product_in", "connectorConfig": { "color": "#f2efe6", "radius": 0.16, "flowing": true } } ] }
  }
}
```

## 8. Final self-check before you answer

- [ ] One JSON object, strictly parseable, no comments/fences/prose
- [ ] Every object's `type` exists (catalog §3 or your `customAssetTypes`)
- [ ] Every object has `parentId` → a defined group; groups nest sensibly
- [ ] Line is connected in process order; belts tucked inside machines both ends; a source machine starts the line
- [ ] Pipes coloured by medium, `flowing: true`; port ids match §3 / your specs exactly
- [ ] Hero machines: detailed parts (foundation + furniture + ≥1 animated part with a physical `rate`) and a `tooltip`
- [ ] Parameters realistic and varied; nothing floats; nothing overlaps; no coplanar faces
