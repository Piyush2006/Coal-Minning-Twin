---
name: digital-twin-generate
description: >
  Generate a Digital Twin scene (a "Twin Spec" JSON document) for the Faclon
  Digital Twin Creator from a natural-language brief and optional reference
  images. Use whenever the user asks to create, scaffold, mock up, or lay out a
  plant / production line / shopfloor (e.g. "build a 2-line bottling plant",
  "make an aluminium potline", "lay out a tank farm"). Pairs with
  digital-twin-manipulate (load both when the user will also edit afterwards).
version: 1.2
source: src/lib/{assetSchemas,parameterSchemas,connectorSchemas,stateSchemas,machineLibrary,templates}.js, src/store/sceneStore.js
---

# Digital Twin — Scene Generation Skill

You generate a **Twin Spec**: a single JSON document that the app loads with
`loadScene(spec)`. You do **not** write 3D code. You **compose** a scene, position
assets sensibly, group them into a UNS namespace, and optionally wire connections,
telemetry and visual rules. The app back-fills every default, so your spec can be
**partial** — only specify what matters.

> **Works for ANY shopfloor** — beverage, pharma, CNC machining, chemical, food,
> packaging, metals, warehousing… The built-in catalog (§2) is a **toolbox of
> examples, not a ceiling**: map each real asset to the closest catalog type, and
> for anything that doesn't fit, declare a **custom asset** (§8) — never skip it.
> First apply the shared **CONVENTIONS** (ISA-95/UNS hierarchy, telemetry units +
> cadence, ISA-18.2 states, ISA-101 colour) — that's what makes every twin uniform.

**Generic method (any industry):**
1. **Decompose** the plant into the ISA-95 hierarchy (Site → Area → Line/Cell → Unit → Asset).
2. **Place** assets along their process flow (§6 layout).
3. For each asset, **pick a catalog type or define a custom asset** (§2 / §8).
4. **Attach standards-based telemetry** (units + `freq` by signal type), **states** (ISA-18.2 severity), and **connections** (§4).
5. Add **line/area KPIs** and any **visual rules** (§7).

**Output:** emit **only** the Twin Spec as one JSON object. No prose, no
Markdown fences in the final answer unless the host asks for them.

---

## 1. Output contract (Twin Spec)

```jsonc
{
  "meta": { "title": "string", "description": "string", "units": "meters", "prompt": "the user brief" },  // optional, provenance only
  "objects": {
    "<objId>": {
      "type": "<catalog type or custom type id>",   // REQUIRED — must exist in the catalog or in customAssetTypes
      "name": "Human Name",                          // REQUIRED — shown in the tree/inspector
      "position": [x, y, z],                          // REQUIRED — world meters, Y up. Keep y = 0 (assets sit on the floor) unless stacking.
      "rotation": [rx, ry, rz],                       // optional radians, default [0,0,0]
      "scale": [sx, sy, sz],                          // optional, default [1,1,1]
      "layer": "equipment|conveyors|piping|structural|annotations",  // optional, defaults per type
      "parentId": "<groupId>|null",                   // optional — the UNS group this belongs to
      "order": 0,                                      // optional — sibling order within the parent
      "config": { },                                   // optional — geometry/animation (see catalog "config")
      "parameters": { },                               // optional — telemetry values (see catalog "parameters")
      "rules": [ ],                                    // optional — visual threshold rules (§7)
      "connections": [                                 // optional — outbound links FROM this object (§4)
        { "targetId": "<objId>", "sourcePort": "<portId>", "targetPort": "<portId>" }
      ],
      "tooltip": { "enabled": true, "params": ["key1","key2"] },  // optional — hover card; set ONLY on HERO machines, 2–3 key param keys (§7a). Never on auxiliaries or groups.
      "unsRef": "<UNS node path>",                     // optional — live-data binding for the whole asset (UNS skill §3; only with a real path from uns_query)
      "paramMeta": { "<paramKey>": { "topic": "uns:…" } }  // optional — per-parameter live binding override (UNS skill §3)
    }
  },
  "groups": {
    "<groupId>": { "name": "Line A", "parentId": "<groupId>|null", "order": 0 }
  },
  "flowLayout": { },                                   // optional — 2D node-graph positions; omit (auto-assigned)
  "customAssetTypes": {                                // optional — only when no built-in type fits (§8)
    "<typeId>": { "label": "string", "primitive": "box|cylinder|tank", "layer": "equipment", "defaultConfig": { } }
  }
}
```

**Auto-filled for you (do not bother emitting unless overriding):** any missing
`config`/`parameters` (defaults from the catalog), `state`/`status` (derived),
connection `id` + `connectorType` + `connectorConfig` (derived, §4), group
`order`, and `rules[].id`. Legacy form — a bare `{ "<objId>": {...} }` map with no
`groups` — is also accepted (all assets land at the root).

### IDs & coordinates
- IDs are short, unique, stable strings you mint: assets like `pet-filler-1`,
  groups like `grp_lineA`. Every `targetId`/`parentId` must reference an id that
  exists in the same spec.
- **Coordinate system:** Y is up; **1 unit ≈ 1 metre**. Lay production lines
  along **X**; separate parallel lines along **Z**. Floor is y = 0.
- **Transverse placement** (asset's long axis perpendicular to the aisle): set
  `rotation: [0, Math.PI/2, 0]` (≈ `1.5708`) or `[0, -1.5708, 0]`.

---

## 2. Asset catalog (the ONLY valid built-in `type` values — 26)

Notation: `config` = `key=default` (range / options); `params` = `key=default unit`;
`ports` = `id(type,dir)`. States are the default `running/idle/fault` unless listed.
Every machine also takes `enabled=true` (toggle animation) where shown.

### Filling & Processing (layer: equipment)
- **Carbonator** — config: `enabled`, `pulseRate=0.8 (0–12)`. params: `co2Level=3.8 vol (0–6)`, `pressure=4.5 bar (0–8)`, `temp=6 °C (0–30)`. ports: `water_in(utility,in)`, `co2_in(co2,in)`, `product_out(product,out)`.
- **PETFiller** — config: `enabled`, `speed=0.38 (0–3)`. params: `throughput=600 bpm (0–1200)`, `fillTemp=8 °C`, `voltage=415 V (0–600)`, `current=12 A (0–100)`. ports: `product_in(product,in)`, `product_out(product,out)`, `conveyor_in(conveyor,in)`, `conveyor_out(conveyor,out)`.
- **CanFiller** — config: `enabled`, `speed=0.55`. params: `throughput=900 cpm (0–2000)`, `pressure=2.4 bar`, `voltage`, `current`. ports: same 4 as PETFiller.
- **GlassFiller** — config: `enabled`, `speed=0.28`. params: `throughput=420 bpm`, `fillTemp=10 °C`, `voltage`, `current`. ports: same 4 as PETFiller.
- **BottleWasher** — config: `enabled`, `pulseRate=1.2` (Steam Rate). params: `throughput=500 bpm`, `waterTemp=62 °C (0–95)`, `detergent=2.5 % (0–10)`. ports: `bottle_in(conveyor,in)`, `bottle_out(conveyor,out)`, `water_in(utility,in)`.

### Capping & Sealing (layer: equipment)
- **RotaryCapper** — config: `enabled`, `speed=0.55`. params: `throughput=600 cpm`, `torque=1.8 Nm (0–10)`, `current=12 A`. ports: `bottle_in(conveyor,in)`, `bottle_out(conveyor,out)`, `cap_feed(utility,in)`.
- **CanSeamer** — config: `enabled`, `speed=0.75`. params: `throughput=900 cpm`, `seamPressure=3.1 bar (0–8)`, `current`. ports: `can_in(conveyor,in)`, `can_out(conveyor,out)`, `lid_feed(utility,in)`.
- **CrownCapper** — config: `enabled`, `speed=1.0`. params: `throughput=520 cpm`, `torque=2.2 Nm`, `current`. ports: `bottle_in(conveyor,in)`, `bottle_out(conveyor,out)`, `crown_feed(utility,in)`.

### Packaging & Coding (layer: equipment)
- **Labeller** — config: `enabled`, `speed=1.0 (0–4)` (Reel Speed). params: `throughput=600 lpm`, `reelLevel=80 %`, `voltage=415 V`. ports: `bottle_in(conveyor,in)`, `bottle_out(conveyor,out)`.
- **DateCoder** — config: `enabled`, `pulseRate=6` (Print Pulse). params: `throughput=600 upm`, `inkLevel=72 %`. ports: `product_in(conveyor,in)`, `product_out(conveyor,out)`.

### Quality Control (layer: equipment)
- **CheckWeigher** — config: `enabled`, `speed=0.4` (Reject Arm Speed). params: `throughput=600 upm`, `rejectRate=1.2 %`, `targetWeight=500 g (0–2000)`. ports: `product_in(conveyor,in)`, `product_out(conveyor,out)`, `reject_out(conveyor,out)`.
- **EBIInspector** — config: `enabled`, `pulseRate=4` (Inspect Light). params: `throughput=600 upm`, `rejectRate=0.8 %`, `defects=120 ppm (0–5000)`. ports: `bottle_in(conveyor,in)`, `bottle_out(conveyor,out)`, `reject_out(conveyor,out)`.

### Material Handling
- **ConveyorBelt** (layer: conveyors) — config: `running=true`, `speed=1.2 (0–5)`, `beltStyle=chain (chain|roller)`, `length=8 (2–40)`, `itemType=pet_bottle (pet_bottle|can|glass_bottle|crate)`, `itemSpacing=1.4 (0.4–6)`. params: `lineSpeed=0.6 m/s`, `load=55 %`. ports (derived from `length`): `conveyor_in(conveyor,in)` at `-length/2`, `conveyor_out(conveyor,out)` at `+length/2`. Use as a standalone belt OR rely on conveyor connectors (§4).
- **FlowConveyor** (layer: conveyors) — a DENSE single-file product stream (bottles nose-to-tail, the "full line" look), optionally curving at the end. config: `running=true`, `length=8 (2–60)`, `curve=none (none|left|right)`, `curveRadius=2 (0.8–8)`, `lanes=1 (1–8)`, `laneGap=0.24`, `spacing=0.22 (0.16–2)` (product pitch), `speed=0.6 (0–3)`, `capColor=#2f6fb0`, `label=""` (hex colour → bottles carry a label band; set downstream of a labeller). ports: `conveyor_in(conveyor,in)` at the start, `conveyor_out(conveyor,out)` at the (possibly curved) end. Prefer this over ConveyorBelt for beverage main lines where product should visibly stream; use ConveyorBelt for spaced items/crates.

### Utilities & Structure
- **Tank** (layer: piping) — config: `radius=1.1 (0.3–5)`, `height=3.2 (0.5–12)`, `fillLevel=60 % (0–100)`, `color=#cdd6e2`. params: `level=60 %`, `temp=18 °C`, `pressure=1.2 bar`. ports: `outlet(utility,out)`.
- **Pump** (layer: piping) — config: `enabled`, `speed=1.4 (0–6)` (Impeller Speed), `color=#3f7fa8`. params: `flowRate=24 m³/h`, `pressure=3.5 bar`, `vibration=1.8 mm/s`. ports: `inlet(utility,in)`, `outlet(utility,out)`.
- **Valve** (layer: piping) — config: `open=true`, `color=#a8442f`. params: `position=100 %`, `flowRate=24 m³/h`. ports: `inlet(utility,in)`, `outlet(utility,out)`.
- **PipeSegment** (layer: piping) — config: `length=4 (0.5–30)`, `radius=0.12 (0.03–0.6)`, `color=#c8d4e0`. params: `flowRate=24 m³/h`, `pressure=2.0 bar`. ports (derived from `length`): `pipe_in(utility,in)`, `pipe_out(utility,out)`.
- **MountingStand** (layer: structural) — config: `width=2`, `height=0.9`, `depth=2`, `color=#526070`. params: `load=120 kg`. **No ports.**

### Environment & Imports
- **Floor** (layer: structural) — a finished factory floor slab with optional aisle lane markings. config: `width=150 (4–400)`, `depth=56 (4–400)`, `color=#f2f2f3`, `roughness=0.95`, `metalness=0`, `showLanes=true`, `laneColor=#e8b53a`, `reflective=true`. **No ports, no telemetry** (single static state). ONE per scene, centred under the plant and sized to cover it — a big build reads far more finished on a real floor.
- **Light** (layer: structural) — an overhead linear highbay fixture that actually casts light. config: `on=true`, `length=9 (0.5–24)`, `intensity=6 (0–20)`, `range=34`, `mountHeight=6 (0–14)`, `color=#eaf2ff`. **No ports, no telemetry.** Place a sparse row above each main line/aisle (every ~15–20 m) — 2–6 per scene, not per machine.
- **Model** (layer: equipment) — an imported glTF/GLB placed as an asset. config: `url` (the .glb URL), `fit=4 (0.2–60)` (target size, m), `scale=1`, `yaw=0 (°)`. **Only use when the user supplies a model URL — NEVER invent one.** No ports.

### Aluminium Smelter
- **ReductionPot** (layer: equipment) — config: `showGlow=true`, `glowIntensity=1 (0–2)`. params: `voltage=4.2 V (0–8) [5s]`, `bathTemp=960 °C (800–1100) [manual]`, `metalTemp=905 °C (800–1000) [manual]`, `current=600 kA (0–800) [5s]`, `acd=30 mm (0–80) [1m]`, `currentEff=94 % (80–100) [1h]`. (`[…]` = sampling cadence per CONVENTIONS; bath/metal temp are manual lab probes — steady readings, not streamed.) ports: `power_in(power,in)` at local `[0,0.5,-2]`, `power_out(power,out)` at `[0,0.5,2]` (on the ±Z long faces → after transverse rotation they face along the row, where series **busbars** connect adjacent pots). states: `normal, feeding, tapping, beamRaise, anodeChange, anodeEffect, offline`.
- **PotTendingMachine** (layer: structural) — config: `enabled=true`, `speed=0.8`, `span=22 (6–40)`, `travel=32 (0–60)`, `bayLength=80 (20–160)`. params: `position=0 %`, `lift=12 t`. **No ports.** states: `idle, travelling, changingAnode, offline`. A gantry crane spanning the aisle; place at the line centre.
- **AluminaSilo** (layer: structural) — config: `radius=1.6`, `height=4.5`, `fillLevel=70 %`, `color=#dfe4ea`. params: `level=70 %`, `feedRate=420 kg/h`. ports: `outlet(utility,out)`. states: `normal, feeding, low, refilling, empty`.
- **TappingCrucible** (layer: equipment) — config: `tapping=true`. params: `metalTemp=900 °C (700–1000)`, `fill=40 %`. **No ports.** states: `idle, tapping, full, offline`.

> Use **exact** type strings above — an unknown built-in `type` will not render.
> But this list is **not exhaustive**: for any real asset it doesn't cover (reactor,
> oven, CNC, robot, AGV, palletiser, mixer, kiln, press, dryer…), **define a custom
> asset** (§8) instead of forcing a wrong type. Assets marked **No ports** cannot be
> connected — never emit `connections` to/from them.

---

## 3. Layers
`equipment` (machines), `conveyors` (belts), `piping` (tanks/pumps/valves/pipes),
`structural` (cranes, silos, stands), `annotations`. Defaults are per the catalog;
override via `layer` only when it helps the user organise visibility.

---

## 4. Connections (links between ports)

Emit outbound links on the **source** object's `connections[]`. You normally only
provide `{ targetId, sourcePort, targetPort }` — the app **auto-derives** the
connector type from the source port's type:

| source port type | connector | typical use |
|---|---|---|
| `conveyor` | **conveyor** belt | machine → machine product flow |
| `power` | **busbar** | generator/transformer → switchgear, series electrical |
| anything else (`utility`, `product`, `co2`) | **pipe** | tank/pump/valve/vessel/process plumbing |

Both ports must exist on their objects (see catalog) and should match in spirit
(out → in). Override the derived type/config when you want to style the link:
```jsonc
{ "targetId":"gen-1","sourcePort":"power_out","targetPort":"power_in",
  "connectorType":"busbar", "connectorConfig": { "bars":3, "width":0.28, "color":"#b87333" } }
```
Connector configs: **conveyor** `{running, speed=1.2, beltStyle:chain|roller, itemType, itemSpacing=1.4}` · **pipe** `{flowing, radius=0.12, color}` · **busbar** `{bars=3 (1–4), width=0.28, color}`.

**Colour pipes by fluid medium** (legibility — an operator should read the network by colour). For every pipe set `connectorConfig.color` from the medium it carries and size mains thicker via `radius` (CONVENTIONS §9): e.g. steam `#e0533d`, feed/hot water `#2fa45a`, cooling water `#2f7fd0`, condensate `#2bb6c4`, gas/flue `#4f555c` (r≈0.5), air `#a9d3ef`, oil/fuel `#b9892f`, chemical `#b05ec8`, drain `#6b7280`. Keep `flowing:true` so flow animates.

---

## 5. Hierarchy & UNS namespace — REQUIRED

**Every object MUST belong to a group** (`parentId` → a real group id). **Never
leave an asset at the root.** The grouped tree IS the UNS namespace: each node's
path is the chain of ancestor group names (`Smelter/Potline/Row A` → topic
`smelter/potline/row_a`). A flat scene has no usable UNS, so always build the
hierarchy explicitly and semantically.

**Standard UNS shape (ISA-95-ish — follow it):**
`Site → Area / Line → [Cell / Section] → Asset`. Use as many levels as the plant
needs, but always group by **physical/process structure** (line, area, utility
block) — *not* by machine category.

Rules:
- One group per **production line** (`Line A`, `Line B`, …); a `Utilities` (or
  `Services`) group for shared kit (silos, cranes, tanks, crucible, compressors).
- Bigger plants: nest a top `Site`/plant group, then `Area`/`Line`, then assets
  (e.g. `Smelter → Potline → Row A → Pot A1`).
- Name groups for what they are; give each a unique id and an `order`.
- Group ids are referenced by objects' `parentId` and by child groups' `parentId`.

```jsonc
"groups": {
  "grp_lineA": { "name": "Line A", "parentId": null, "order": 0 },
  "grp_util":  { "name": "Utilities", "parentId": null, "order": 1 }
}
```

> Safety net: if you ever omit a `parentId`, the app auto-buckets that asset into
> a group by its category so the tree is never flat — but that yields generic
> category groups, **not** a clean line/area UNS. Always group explicitly.

---

## 6. Layout rules (avoid overlaps — this is where mockups usually fail)

**Think like a plant designer, not a diagram: ZONE the site first, then place.**
- **Zones**: production hall(s) with the process lines in the middle; tank farm /
  utilities yard at the rear (−Z); warehouse & dispatch at the discharge end;
  office block in a front corner; truck road clear along the front (+Z). Frame the
  zones with the structural/civil assets (Floor over everything, hall, racking,
  lights) so the plant reads as a SITE, not a row of machines on a void.
- **Lines follow process order but need NOT be straight** — straight, L-shaped or
  U-shaped (FlowConveyor supports a 90° `curve` at its end; a U-line = two
  parallel runs joined by one curved conveyor). Pick the shape that fits the hall.
- **Spacing is arithmetic, not vibes**: every AVAILABLE COMPONENT lists its real
  `footprint` [width X, depth Z, height Y]. Adjacent machines in a line get a
  **3–6 m clear gap between footprints** (that's the conveyor run); side aisles
  **≥ 2 m**; footprints must NEVER overlap. Check each placement against its
  neighbours' footprints before committing it.
- **Utilities live OFF-line**: tanks, silos, pumps, compressors, boilers, CIP
  cluster in the utility zone (never inline with product flow) and connect via
  utility/product ports — pipes route along the rear.
- **Orientations**: yaw 0 or ±1.5708 only; machines face the flow direction.
- Catalog **beverage / inline machines** without a listed footprint are ~5–6 m
  (ports at ±2.5): pitch 8–10 along the run.
- **Parallel lines:** separate by **8–12 m** in Z (e.g. z = 8, 0, −8), sharing aisles.

### Worked layout sketch — U-line plant with zones (copy this SHAPE)
Positions only (machines are ~5 m wide unless their footprint says otherwise):
```jsonc
// PRODUCTION HALL (lines): U-shape — outbound run at z=0, return run at z=10
{ "type":"depalletiser", "position":[-18,0,0] }               // line start
{ "type":"filler",       "position":[-8,0,0] }                //  gap 5 m
{ "type":"capper",       "position":[2,0,0] }
{ "type":"FlowConveyor", "position":[7,0,0],  "config":{ "length":10, "curve":"left", "curveRadius":3 } }  // turns the corner
{ "type":"labeller",     "position":[12,0,10], "rotation":[0,3.1416,0] }   // return run, facing back
{ "type":"case_packer",  "position":[2,0,10],  "rotation":[0,3.1416,0] }
{ "type":"palletiser",   "position":[-10,0,10],"rotation":[0,3.1416,0] }   // discharge → warehouse
// UTILITY YARD (rear, −Z): off-line, piped to the line
{ "type":"Tank", "position":[-16,0,-12] } { "type":"Tank", "position":[-11,0,-12] }
{ "type":"Pump", "position":[-6,0,-12] }  { "type":"CIPSkid", "position":[0,0,-12] }
// SITE: floor covers everything; warehouse at discharge; office front corner; road along +Z
{ "type":"Floor", "position":[0,0,0], "config":{ "width":70, "depth":50 } }
{ "type":"warehouse", "position":[-24,0,14] }
{ "type":"office",    "position":[20,0,16] }
```
Note the shape: the flow SNAKES (out along z=0, corner, back along z=10), the
return-run machines are ROTATED to face the flow, utilities sit in their own
rear zone, and every gap between footprints is a real 3–6 m conveyor run.
- **Conveyors between machines:** either drop short `ConveyorBelt` assets in the
  gaps, or just link `conveyor_out → conveyor_in` and let the connector draw the belt.
- **Reduction pots (transverse, dense):** N per row, `pitch 5`, two rows at
  `z = +6` / `z = −6`, `rotation [0, 1.5708, 0]` (row A) and `[0, -1.5708, 0]`
  (row B). `x = -((N-1)*5)/2 + i*5`. Series-link adjacent pots
  `power_out → power_in` (busbar lands in the gap). Put silos at the line ends
  (`x = ±(HALF+6), z = 12`), the tapping crucible in the aisle (`x = HALF+6, z = 0`),
  and one PotTendingMachine at `[0,0,0]`.
- Keep `y = 0` for all floor assets.
- **Dress the environment:** one `Floor` sized to cover the whole plant (+~10 m
  margin each side) in an `Environment`/`Site` group, plus a sparse row of `Light`
  fixtures over the main aisles. This is cheap and makes any build read finished.

---

## 7. Parameters at EVERY level — REQUIRED (you DECIDE the params here)

You define the parameters at both levels; a separate demo-data step only fills
in values later.

**Machine level — `parameters` on every asset.** ALWAYS set a `parameters` block
on every object (environment props — Floor / Light / Model — are the one
exception: they carry no telemetry), with realistic, **varied** values within the catalog ranges
(don't leave them all default/identical — that makes dashboards look dead). These
drive the machine-wise readouts. Vary across siblings (e.g. each pot a slightly
different `acd`/`voltage`/`currentEff`). Choose units + cadence per CONVENTIONS.

**Line / area level — `kpis` on the group.** Each line/area group SHOULD declare
the aggregate parameters it exposes (its "line overview"). These are computed by
the app from the group's member assets — groups hold no raw telemetry themselves.
Shape (on a group):
```jsonc
"kpis": [
  { "key": "throughput", "label": "Total Throughput", "unit": "bpm", "assetType": "PETFiller", "parameter": "throughput", "agg": "sum" },
  { "key": "avgVolt",     "label": "Avg Pot Voltage",  "unit": "V",   "assetType": "ReductionPot", "parameter": "voltage", "agg": "avg" },
  { "key": "count",       "label": "Machines",         "unit": "",                                   "agg": "count" }
]
```
`agg ∈ avg | sum | min | max | count`; `assetType` optional (omit = all assets in
the group); `parameter` must exist on that type (see catalog). Pick 3–6 KPIs that
make sense for that line (throughput, avg fill temp, reject rate, avg voltage,
current efficiency, # machines, …). Availability / OEE are added automatically.

**Visual rules** (optional) — glow an asset a colour when a threshold is met:
```jsonc
"rules": [
  { "enabled": true, "parameter": "acd", "operator": ">", "compareMode": "constant", "value": 40, "color": "#ff3b30" }
]
```
`operator ∈ > >= < <= == !=`. `compareMode: "constant"` vs `value`; `"asset"` vs
another asset via `refAssetId` + `refParameter`.

> Initial `state` is optional (the live simulator evolves states); set one only
> to stage a specific situation.

### 7a. Tooltips — headline metrics on the HERO machines
On each line's **hero/main** machines (the ones operators watch), set a per-object
`tooltip: { "enabled": true, "params": ["k1","k2","k3"] }` listing 2–3 of that
asset's most telling parameter keys (must exist on the type). The app shows them as
a hover card in view mode. Do **NOT** add tooltips to auxiliaries, small in-line
parts, or structural/civil items, and **never** to groups (group tooltips are
ignored). A few heroes per line is right — not every asset.

---

## 8. Custom assets — reference pre-authored components; primitives only as a fallback

Most builds run through the **PLAN** flow: missing equipment is authored as a proper
detailed component FIRST, then this GENERATE step just **references it by id** from
**AVAILABLE COMPONENTS** (don't redefine or placeholder those). Reuse `catalog` and
`existing` types as-is.

Only declare a `customAssetTypes` **primitive** here for a **trivial static prop**
(a fence, a pallet, a sign) or as a last-resort fallback when a component wasn't
created — never for real process equipment (that should be a component). Give any
such custom asset sensible parameters too (§7).
```jsonc
"customAssetTypes": {
  "ct_mixer": { "label": "Mixer Vessel", "primitive": "tank", "layer": "piping",
                "defaultConfig": { "radius": 1.4, "height": 3.5, "color": "#9fb2c4" } }
},
"objects": { "mixer-1": { "type": "ct_mixer", "name": "Mixer 1", "position": [0,0,0] } }
```
Primitives & their config: **box** `{width,height,depth,color}` · **cylinder**
`{radius,height,color}` · **tank** `{radius,height,color}`. Custom assets have no
ports (can't be connected) and only generic `value`/`temperature` parameters.

---

## 9. Worked examples (few-shot)

### A. PET bottle line (5 machines, one group — note group `kpis` + per-machine `parameters`)
```json
{
  "meta": { "title": "PET Line", "units": "meters" },
  "groups": { "grp_pet": { "name": "Line A — PET", "parentId": null, "order": 0,
    "kpis": [
      { "key": "rate", "label": "Avg Throughput", "unit": "bpm", "parameter": "throughput", "agg": "avg" },
      { "key": "reject", "label": "Avg Reject", "unit": "%", "assetType": "CheckWeigher", "parameter": "rejectRate", "agg": "avg" },
      { "key": "n", "label": "Machines", "unit": "", "agg": "count" }
    ] } },
  "objects": {
    "carb":  { "type": "Carbonator",   "name": "Carbonator",   "position": [-20,0,0], "parentId": "grp_pet", "order": 0, "parameters": { "pressure": 4.4, "temp": 6 } },
    "fill":  { "type": "PETFiller",    "name": "PET Filler",   "position": [-12,0,0], "parentId": "grp_pet", "order": 1, "parameters": { "throughput": 612, "fillTemp": 8 },
               "connections": [ { "targetId": "cap", "sourcePort": "conveyor_out", "targetPort": "bottle_in" } ] },
    "cap":   { "type": "RotaryCapper", "name": "Rotary Capper","position": [-4,0,0],  "parentId": "grp_pet", "order": 2, "parameters": { "throughput": 605, "torque": 1.9 },
               "connections": [ { "targetId": "lab", "sourcePort": "bottle_out", "targetPort": "bottle_in" } ] },
    "lab":   { "type": "Labeller",     "name": "Labeller",     "position": [4,0,0],   "parentId": "grp_pet", "order": 3, "parameters": { "throughput": 600, "reelLevel": 78 },
               "connections": [ { "targetId": "cw", "sourcePort": "bottle_out", "targetPort": "product_in" } ] },
    "cw":    { "type": "CheckWeigher", "name": "Check Weigher","position": [12,0,0],  "parentId": "grp_pet", "order": 4, "parameters": { "throughput": 598, "rejectRate": 1.3 } }
  }
}
```

### B. Aluminium potline (one row of 6, busbars, a silo)
```json
{
  "meta": { "title": "Mini Potline", "units": "meters" },
  "groups": {
    "grp_lineA": { "name": "Line A", "parentId": null, "order": 0,
      "kpis": [
        { "key": "avgVolt", "label": "Avg Pot Voltage", "unit": "V", "assetType": "ReductionPot", "parameter": "voltage", "agg": "avg" },
        { "key": "avgCE",   "label": "Avg Current Eff.", "unit": "%", "assetType": "ReductionPot", "parameter": "currentEff", "agg": "avg" },
        { "key": "pots",    "label": "Pots", "unit": "", "assetType": "ReductionPot", "agg": "count" }
      ] },
    "grp_util":  { "name": "Utilities", "parentId": null, "order": 1 }
  },
  "objects": {
    "pot-A1": { "type": "ReductionPot", "name": "Pot A1", "position": [-12.5,0,6], "rotation": [0,1.5708,0], "parentId": "grp_lineA", "order": 0,
                "parameters": { "acd": 28 }, "rules": [ { "enabled": true, "parameter": "acd", "operator": ">", "compareMode": "constant", "value": 40, "color": "#ff3b30" } ],
                "connections": [ { "targetId": "pot-A2", "sourcePort": "power_out", "targetPort": "power_in" } ] },
    "pot-A2": { "type": "ReductionPot", "name": "Pot A2", "position": [-7.5,0,6], "rotation": [0,1.5708,0], "parentId": "grp_lineA", "order": 1,
                "connections": [ { "targetId": "pot-A3", "sourcePort": "power_out", "targetPort": "power_in" } ] },
    "pot-A3": { "type": "ReductionPot", "name": "Pot A3", "position": [-2.5,0,6], "rotation": [0,1.5708,0], "parentId": "grp_lineA", "order": 2 },
    "silo-1": { "type": "AluminaSilo", "name": "Alumina Silo 1", "position": [-18,0,12], "parentId": "grp_util", "order": 0 },
    "ptm":    { "type": "PotTendingMachine", "name": "Pot Tending Machine", "position": [0,0,0], "parentId": "grp_util", "order": 1 }
  }
}
```

### C. Utility skid (tank → pump → pipe)
```json
{
  "objects": {
    "tank-1": { "type": "Tank", "name": "Feed Tank", "position": [0,0,0], "layer": "piping",
                "connections": [ { "targetId": "pump-1", "sourcePort": "outlet", "targetPort": "inlet" } ] },
    "pump-1": { "type": "Pump", "name": "Transfer Pump", "position": [3,0,0], "layer": "piping",
                "connections": [ { "targetId": "pipe-1", "sourcePort": "outlet", "targetPort": "pipe_in" } ] },
    "pipe-1": { "type": "PipeSegment", "name": "Header", "position": [6,0,0], "layer": "piping" }
  }
}
```

### D. CNC machining cell (no catalog type fits → custom assets + ISA-95 cell)
```json
{
  "meta": { "title": "Machining Cell 1", "units": "meters" },
  "customAssetTypes": {
    "ct_cnc":   { "label": "CNC Mill",  "primitive": "box", "layer": "equipment", "defaultConfig": { "width": 2.2, "height": 2.4, "depth": 2.4, "color": "#8a93a6" } },
    "ct_robot": { "label": "Load Robot","primitive": "cylinder", "layer": "equipment", "defaultConfig": { "radius": 0.5, "height": 1.6, "color": "#d08a2c" } },
    "ct_cmm":   { "label": "CMM (QC)",  "primitive": "box", "layer": "equipment", "defaultConfig": { "width": 1.6, "height": 1.8, "depth": 1.6, "color": "#9fb2c4" } }
  },
  "groups": { "grp_cell": { "name": "Machining Cell 1", "parentId": null, "order": 0,
    "kpis": [ { "key": "rate", "label": "Avg Spindle Load", "unit": "%", "parameter": "spindleLoad", "agg": "avg" }, { "key": "n", "label": "Machines", "unit": "", "agg": "count" } ] } },
  "objects": {
    "mill-1":  { "type": "ct_cnc",   "name": "CNC Mill 1", "position": [-4,0,0], "parentId": "grp_cell", "order": 0, "parameters": { "spindleSpeed": 9200, "spindleLoad": 62, "feedRate": 1100, "vibration": 1.6 } },
    "mill-2":  { "type": "ct_cnc",   "name": "CNC Mill 2", "position": [0,0,0],  "parentId": "grp_cell", "order": 1, "parameters": { "spindleSpeed": 8800, "spindleLoad": 71, "feedRate": 980,  "vibration": 2.1 } },
    "robot-1": { "type": "ct_robot", "name": "Load Robot", "position": [-2,0,3], "parentId": "grp_cell", "order": 2, "parameters": { "cycleTime": 38, "reach": 1.8 } },
    "cmm-1":   { "type": "ct_cmm",   "name": "CMM 1",      "position": [4,0,0],  "parentId": "grp_cell", "order": 3, "parameters": { "rejectRate": 0.6, "throughput": 30 } }
  }
}
```

### E. Chemical mixing skid (catalog piping generalises + one custom reactor)
```json
{
  "meta": { "title": "Mixing Skid", "units": "meters" },
  "customAssetTypes": {
    "ct_reactor": { "label": "Mixing Reactor", "primitive": "tank", "layer": "piping", "defaultConfig": { "radius": 1.4, "height": 3.4, "color": "#9fb2c4" } }
  },
  "groups": { "grp_skid": { "name": "Reactor Skid R-101", "parentId": null, "order": 0,
    "kpis": [ { "key": "temp", "label": "Avg Temp", "unit": "°C", "parameter": "temp", "agg": "avg" } ] } },
  "objects": {
    "tank-1":  { "type": "Tank",        "name": "Feed Tank",  "position": [0,0,0],  "layer": "piping", "parentId": "grp_skid", "order": 0, "parameters": { "level": 72, "temp": 24 },
                 "connections": [ { "targetId": "pump-1", "sourcePort": "outlet", "targetPort": "inlet" } ] },
    "pump-1":  { "type": "Pump",        "name": "Charge Pump","position": [3,0,0],  "layer": "piping", "parentId": "grp_skid", "order": 1, "parameters": { "flowRate": 18, "pressure": 4.1, "vibration": 1.4 },
                 "connections": [ { "targetId": "rx-1", "sourcePort": "outlet", "targetPort": "outlet" } ] },
    "rx-1":    { "type": "ct_reactor", "name": "Reactor R-101","position": [6,0,0], "parentId": "grp_skid", "order": 2, "parameters": { "temp": 78, "pressure": 2.6, "level": 55, "agitatorSpeed": 120 } },
    "valve-1": { "type": "Valve",      "name": "Discharge Valve","position": [9,0,0], "layer": "piping", "parentId": "grp_skid", "order": 3, "parameters": { "position": 100 } }
  }
}
```

> Note D & E: same uniform shape — ISA-95 group + per-asset params (units) + KPIs —
> across machining and chemical, using **custom assets** where no built-in fits.

---

## 10. Hard constraints & self-check (verify before returning)

- [ ] Every `type` is a catalog type **or** declared in `customAssetTypes`.
- [ ] All numeric `config`/`parameters` are within the listed ranges; selects use listed options.
- [ ] Object & group `id`s are unique; every `parentId`/`targetId` references an id in this spec.
- [ ] **EVERY object has a `parentId` pointing to a real group — no asset left at the root** (§5); groups form a sensible line/area UNS tree.
- [ ] **EVERY asset has a `parameters` block with realistic, varied values; every line/area group declares a `kpis` list** (§7) — params are defined at both levels. (Floor/Light/Model exempt.)
- [ ] Every `connections` entry uses **ports that exist** on both objects (catalog), out→in; no connections on **No-port** assets.
- [ ] No group cycle (a group is never its own ancestor); every object's `parentId` is null or a real group.
- [ ] Assets don't overlap (respect §6 pitch/spacing); `y = 0`.
- [ ] Output is a **single JSON object** — nothing else.

---

*Catalog is sourced verbatim from `src/lib/assetSchemas.js`,
`parameterSchemas.js`, `connectorSchemas.js`, `stateSchemas.js`,
`machineLibrary.js` and `src/store/sceneStore.js`. If those registries change,
regenerate this section (a future `buildCatalog()` can emit it automatically).*
