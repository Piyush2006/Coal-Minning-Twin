# Digital Twin Creator — Progress Tracker

## Project
**Location:** `/Users/siddharthjha/Documents/digitaltwincreator`  
**Stack:** Vite + React + React Three Fiber + @react-three/drei + Three.js + Zustand  
**Run:** `npm run dev` → http://localhost:5173

---

## ✅ Done

### Project Launcher (Home) + JSON import/export (multi-project shell)
- **`src/store/projectStore.js`** — project library (`faclon-dt-projects`): projects map +
  `activeId` + `view`. Actions: createBlank / createFromTemplate / createFromScene / openProject /
  saveActiveScene / goHome / rename / duplicate / delete / **seedFromCurrentScene** (first-run
  migration of the existing single scene → "My Project"). sceneStore stays the live editor doc.
- **`src/Root.jsx`** + main.jsx — app shell: framer-motion `AnimatePresence` crossfade between
  **HomeScreen** and the **editor (App)**; re-hydrates the editor from the active project on reload;
  autosaves (10s interval + visibilitychange/beforeunload; goHome saves too).
- **Home** (`src/components/home/`): `HomeScreen` (hero header + CTAs + projects grid + toast),
  `ProjectCard` (auto top-down **schematic** thumbnail via `src/lib/thumbnail.js`, rename/duplicate/
  export/delete menu, spring hover), `TemplatePicker` (modal over `TEMPLATES` with mini schematics),
  `HeroTwin` (lightweight auto-rotating 3D graphic, no PostFX). framer-motion transitions throughout.
- **`src/lib/twinSpec.js`** — `validateSpec` (tolerant: coerce ranges, strip dangling connections,
  drop unknown types, warn), `exportSpec`, `downloadJSON`. Manual **Upload JSON** on Home →
  validates → new project; editor TopBar gains **Import** (replace, confirm) + **Export** (download)
  and an editable **project name** + **‹ Projects** back button.
- `sceneStore.loadScene` now accepts a full snapshot (customAssetTypes + flowLayout) and added
  `getSceneSnapshot()`; the old auto-`INITIAL_SCENE` boot is removed (projects drive the scene).
  framer-motion added. Build clean (1315 modules); dev on **5117**.

### UNS Hierarchy (nested namespace · group select/move · global search)
- **`src/lib/hierarchy.js`** — pure helpers over flat `objects` + new `groups` map:
  `buildTree`, `childrenOf`, `descendantObjectIds`, `nodePath`/`displayPath`/`unsTopic`,
  `isDescendantGroup` (cycle guard), `nextOrder`, `groupCentroidBounds`, `searchNodes`
  (substring + `/`-path queries), `normalizeHierarchy` (backfill parentId/order, convert
  legacy `obj.group` strings → group nodes).
- **Store**: `groups:{id,name,parentId,order}` slice + `selectedGroupId`; actions `addGroup`,
  `renameGroup`, `removeGroup` (reparents children up — never deletes assets), `moveNode`
  (reparent+reorder, cycle-guarded), `selectGroup`, `translateGroupBy` (no-history), `flyToGroup`;
  `addObject(type,pos,layer,cfg,parentId)`. Undo history now snapshots **{objects, groups}**.
  Persist **v3→v4** (migrate builds groups from legacy group strings). `loadScene` accepts
  `{objects,groups}` or a legacy plain map.
- **`src/components/HierarchyPanel.jsx`** — left navigation tree (both modes): nested groups +
  assets, native HTML5 drag-drop (reparent on group / reorder before-after), inline rename,
  **+ Group** / **+ Component** (MACHINE_LIBRARY picker adds into the group), delete; auto-expands
  ancestors of the selection.
- **`src/components/HierarchySearch.jsx`** — centered glassmorphism top-bar search with
  autocomplete + path queries (`smelter/row a/pot`); select → select+frame node.
- **`SceneRenderer`** — selecting a group halos all members + an **edit-mode translate gizmo**
  (proxy at centroid → delta applied to all descendants, single commit). Arrow keys nudge / Delete
  removes a selected group.
- **`GroupInspector`** (right) — rename, **UNS path + topic**, asset/sub-group counts, Frame, delete.
- ANODE_POTLINE template reworked into a real namespace: `Smelter → Potline → Row A/B` + `Utilities`.
  Build clean (908 modules); dev on **5117**.

### Process & Functionality Layer (state machine · OEE · KPIs · process sim)
Reusable global configurator items, built as schema-registries (work for any twin):
- **Asset State Machine** — `src/lib/stateSchemas.js`: per-type states `{key,label,color,severity}`
  (ReductionPot: normal/feeding/tapping/beamRaise/anodeChange/anodeEffect/offline; PTM/Silo/Crucible
  sets; `DEFAULT_STATES` = running/idle/fault for everything else). `obj.state` is the source of truth;
  legacy `obj.status` is DERIVED from severity so all status visuals/counts keep working.
- **Process-accurate simulation** — `src/lib/oee.js` `stepSimulation()`: state-driven (anode-change
  28-day cycle, periodic tapping, occasional anode effects + voltage spike, alumina feed/depletion,
  silo drain/refill, crucible fill, PTM travel/change). Transient phase timers + OEE accumulators live
  in a module `SIM` Map (NOT persisted, NOT in undo). Mirrors silo level/crucible fill into `config`
  so geometry reacts. Replaces the old random-walk `simulateTick` (now ~1s).
- **OEE / uptime-downtime** — `oee.js` `getAssetOEE()` / `computeLineOEE()` (A·P·Q + uptime%,
  session-cumulative).
- **KPI dashboard** — `src/lib/kpiSchemas.js` declarative defs (auto-hide when assetType absent) +
  `src/components/OverviewPanel.jsx`. Shown as the **Overview** tab of the view-mode right panel
  (default when nothing selected); **Asset** tab adds a state badge + asset OEE to live params.
- Build-mode header pill now cycles the rich **state** (was status). Persist bumped **v2→v3**
  (migrate backfills `state`, reverse-mapped from legacy status). New pot params: aluminaConc,
  currentEff, metalHeight. Build clean (905 modules); dev on **5117**.

### Foundation — Beverage 3D Models
12 procedural machines, all Three.js geometry (no external files):

| Machine | File | Notes |
|---|---|---|
| Carbonator | `Carbonator.jsx` | Pressure vessel + CO₂ column |
| PET Filler | `PETFiller.jsx` | Rotary carousel |
| Rotary Capper | `RotaryCapper.jsx` | |
| Labeller | `Labeller.jsx` | |
| Check Weigher | `CheckWeigher.jsx` | |
| Can Filler | `CanFiller.jsx` | |
| Can Seamer | `CanSeamer.jsx` | |
| Date Coder | `DateCoder.jsx` | matRef on meshStandardMaterial (not group) |
| Bottle Washer | `BottleWasher.jsx` | |
| Glass Filler | `GlassFiller.jsx` | |
| Crown Capper | `CrownCapper.jsx` | |
| EBI Inspector | `EBIInspector.jsx` | |

3 production lines at Z = +8.5 / 0 / -8.5.  
Status beacons: running=green, idle=amber, fault=red (animated).

**Material palette (white monochromatic — all 12 machines):**
- `SS` body panels: `#edf0f5` / `metalness:0.08` / `roughness:0.38` — near-white, semi-specular
- `FR` structural frames/bases: `#526070` / `metalness:0.18` / `roughness:0.50` — dark blue-gray steel
- `PAN` control cabinets: `#6a7888` / `metalness:0.08` / `roughness:0.60` — medium gray housing
- Body range: `#dde4ee` → `#edf0f5` (light panel surfaces)
- Emissive screens, UV light booth, camera lenses — all preserved unchanged

**Lighting rig (App.jsx):**
- `ambientLight intensity=0.35` — low fill, preserves shadow gradients
- Key directional `[10,28,15]` intensity=2.8 — strong shadows + highlights
- Fill directional `[-18,20,-10]` intensity=0.6
- Rim directional `[0,-8,20]` intensity=0.25

---

### Builder Architecture (COMPLETE)

#### State — `src/store/sceneStore.js`
- Zustand store with `persist` middleware → `localStorage: faclon-dt-scene`
- Objects: `{ id, type, name, position, rotation, scale, layer, status, locked, visible, parentId, connections[], dataBindings[] }`
- Layers: equipment / conveyors / piping / structural / annotations
- **Undo/Redo**: `_history[]` + `_historyIndex`, correct post-action snapshot design
- `flyToObject(id)` → sets `cameraFlyTarget` for camera lerp
- `commitTransform()` → snapshot after drag end

#### 3D Scene — `src/components/`
| File | Purpose |
|---|---|
| `SceneRenderer.jsx` | Reads store, renders each object; TransformControls; SelectionOutline (BoxHelper); port indicator dots |
| `GridSystem.jsx` | LOD 3-layer grid (2m/0.5m/0.1m) — base layer visible in both modes (dimmer in view mode), fine layer build only |
| `Floor.jsx` | Invisible point lights grid (no geometry) |
| `CameraController.jsx` | `useFrame` lerp of OrbitControls.target to `cameraFlyTarget` |

#### Object Library — `src/lib/`
| File | Purpose |
|---|---|
| `machineLibrary.js` | `MACHINE_COMPONENTS` map + `MACHINE_LIBRARY` categories + `MACHINE_PORTS` per-type port definitions |
| `initialScene.js` | 15 hardcoded objects (3 lines) loaded on first run |
| `snapEngine.js` | `findSnap(objects, draggedId)` — port-compatible snap within 4 unit radius |
| `templates.js` | 5 templates: Full Plant, PET Line, Can Line, Glass Line, Quality Cluster |

#### UI — `src/App.jsx` + `src/components/CommandPalette.jsx`

**View Mode:**
- Left tree panel — collapsible Line A/B/C with status dots, click → select + fly-to
- Right inspector — position readout, status indicator, enter-build hint
- `⌘K` hint bottom-right

**Build Mode:**
- Top-center toolbar — undo/redo buttons + `BUILD MODE` label
- Left panel — Library / Layers / Templates tabs; Clear scene button
- Right panel — Transform gizmo mode, position/rotation readout, connections list, cycle status, delete

**Command Palette (`⌘K`):**
- Search existing scene objects (select + fly-to)
- Search machine types to add (addObject)
- Keyboard nav: ↑↓ arrows, Enter, Escape

**Keyboard shortcuts:**
| Key | Action |
|---|---|
| `⌘K` | Open command palette |
| `⌘Z` | Undo |
| `⌘⇧Z` / `⌘Y` | Redo |
| `Escape` | Deselect / close palette |

**Port indicators:**
- Colored dots in build mode (blue=product, teal=conveyor, amber=utility, green=CO₂)
- Bright on selected object, dim on all others

**Snap engine:**
- After drag end: checks all port pairs for compatible type + opposite direction within 2 unit radius
- Auto-snaps object position so ports align

---

### Config System + Connectable Conveyors + Extensible Library (COMPLETE — arsh-updates)

Turned the builder into a configurable authoring tool. "Nothing static — every asset is configurable."

#### Per-asset config system — `src/lib/assetSchemas.js`
- `ASSET_SCHEMAS`: per-type field declarations `{ key, label, type, default, min/max/step/options }`.
  type ∈ `number | boolean | select | text | color`.
- Each object now has a free-form `config: {}` (added in `addObject`, back-filled in `loadScene` + persist `migrate`).
- `getSchema()` / `getDefaultConfig()` / `coerceConfigValue()` / `withConfigDefaults()` drive both the auto-form and runtime.
- **Machine defaults equal the old hardcoded constants** (e.g. PETFiller `speed:0.38`) → unedited scenes identical.
- All 12 machines refactored to read `config` (`enabled` gate + `speed` or `pulseRate`) instead of constants.

#### Auto-generated settings form — `BuildRightPanel` (App.jsx)
- `ConfigSection` + `ConfigField` map a type's schema to controls generically (slider/toggle/button-row/color/text).
  Adding a schema entry creates UI with **zero per-type form code**.
- Sliders/color update live (no history) while dragging, snapshot once on release; discrete controls snapshot immediately.
- Store: new `updateConfig(id, key, value)` (history-snapshotting), live edits via `updateObject`.

#### Conveyor belt as a connectable asset — `src/components/ConveyorBelt.jsx`
- Config: `running, speed, beltStyle (chain|roller), length, itemType, itemSpacing`.
- Reuses (formerly orphaned) `ChainConveyor.jsx` / `RollerConveyor.jsx` as sub-renderers; animates items along the belt.
- **Dynamic ports**: `getPorts(obj)` in `machineLibrary.js` derives `conveyor_in/out` from `config.length` (never stored),
  so `PortDots` + `snapEngine` track geometry as length changes. Connect = **drag-and-snap** (existing snap engine).
- Items defined in `src/lib/itemLibrary.js` (PET bottle, can, glass bottle, crate).

#### Expanded library + custom assets
- New built-in procedural assets (`src/components/assets/`): Tank, Pump, Valve, PipeSegment, MountingStand.
  New library categories: **Material Handling**, **Utilities & Structure** (library items carry an optional `layer`).
- **Custom assets**: `src/components/Primitive.jsx` is one generic component whose geometry (box/cylinder/tank) + color
  come entirely from `config`. Store slice `customAssetTypes` (persisted) + `addCustomAssetType()` / `removeCustomAssetType()`.
  "+ New Custom Asset" creator in `BuildLeftPanel`. SceneRenderer maps unknown-but-custom types → `Primitive`.

#### Persistence
- Persist `version: 1` + `migrate` back-fills `config`; `partialize` now stores `{ objects, customAssetTypes }`.
- `customAssetTypes` intentionally OUT of undo history (matches layers/UI-state convention).

#### Keyboard editing (Build mode) — App.jsx (dedicated `keydown` effect, reads `getState()`)
- **Move**: `←→` = X, `↑↓` = Z, `⌘/Ctrl+↑↓` = Y. Step: `Shift` coarse (2.0), `Alt` fine (0.1), else 0.5.
- **Rotate** `[` `]` (Y, Shift = 45°); **Scale** `-` `=` (uniform).
- **Gizmo** `G/R/S` (move/rotate/scale); **Focus** `F` (fly-to).
- **Copy/Paste** `⌘/Ctrl+C` / `⌘/Ctrl+V` (clipboard in store `_clipboard`, paste cascades); **Duplicate** `⌘/Ctrl+D`; **Delete** `Delete`/`Backspace`.
- Nudges update live via `updateObject` + debounced `commitTransform` (one undo step per burst). Guards against firing while typing in inputs.
- Store actions added: `duplicateObject`, `copyObject`, `pasteObject`. Discoverable `⌨ Shortcuts` overlay toggled by `?` (chip bottom-right).

---

### TwinMaker-style Workspace: Process Flow + Smart Connectors + Visual Rules (COMPLETE — arsh-updates)

Dual synchronized editors over one store, auto-fitting connectors, per-asset parameters, and rule-driven glow.

#### Dual-pane workspace (Process Flow ⟷ Scene)
- **React Flow** (`@xyflow/react`) node graph beside the 3D scene; toggle in `BuildToolbar` (`Scene` / `⌗ Flow`), draggable divider.
- `src/components/flow/FlowPane.jsx` + `FlowNode.jsx` — nodes = objects (status, type, param chips, typed handles from `getPorts`), edges = connections. **Controlled**: nodes/edges derived from store via `useMemo`; gestures write back (`onConnect`→`addConnection`, node drag→`setFlowNodePosition`, click→select). Flow node positions live in `flowLayout`, **independent of 3D `position`**.
- Selection is shared (`selectedId`) → click a node ⇄ highlights/selects the 3D asset.

#### Smart connectors (auto-create on link) — `src/components/Connectors.jsx`
- Drawing an edge (or snapping in the scene) calls `addConnection`, which derives `connectorType` (conveyor ports → belt, else pipe) and seeds `connectorConfig`.
- Connectors render inside `<Canvas>`: endpoints from `worldPortPos(src,port)`/`worldPortPos(tgt,port)`; group at midpoint, oriented by an upright orthonormal basis (`makeBasis`, local +X along the run), length = port distance. **Pure function of object transforms → re-fits automatically when machines move.** Belt reuses `ChainConveyor`/`RollerConveyor` + animated `ConveyorItem`; pipe = capped cylinder. Clickable via an invisible fat proxy → `selectConnection`.
- `removeObject` strips inbound connections (cleanup). Scene drag-snap records a connection unless the dragged asset is itself a connector (`ConveyorBelt`/`PipeSegment`).

#### Per-asset Parameters — `src/lib/parameterSchemas.js`
- `PARAMETER_SCHEMAS[type]=[{key,label,unit,default,min,max}]` (throughput/temp/pressure/voltage/current/…). Editable in the inspector **Parameters** tab via `updateParameter`. Live-data-ready (write into `parameters` later).

#### Visual Rules → glow — `src/lib/rulesEngine.js`
- Per-asset `rules[]`: `{ parameter, operator, compareMode: constant|asset, value | (refAssetId, refParameter), color }`. `evaluateRules`/`computeGlowMap` (pure) → first matching enabled rule's color. Memoized over `objects` (recompute on param/rule change, not per-frame).
- Authored in the **Rules** tab via `src/components/RuleEditor.jsx`. Glow in `SceneRenderer` `<Glow>`: emissive halo ring (always) + a pulsing `<pointLight>` capped to ≤8 concurrent.

#### Inspector tabs + Asset Library flyout
- `BuildRightPanel` → tabs **Settings · Parameters · Rules**; selecting a connection swaps in a **connector inspector** (`getConnectorSchema` form + Remove). `ConfigField` generalized to `{ field, value, onLive, onCommit }` (serves object config, parameters, connector config).
- `src/components/AssetLibraryFlyout.jsx` — "Asset Library" button opens a slide-out palette beside the sidebar (categorized built-ins + custom + creator + search); importing seeds a flow position. Library tab removed from `BuildLeftPanel` (Layers/Templates kept).

#### Persistence
- Persist **`version: 2`** + idempotent `migrate` back-fills `parameters`, `rules`, connection-record fields; `partialize` adds `flowLayout`. `loadScene` back-fills the same.

#### Verified
- 824 modules transform in production build (`vite build`), zero errors; dev transform-check of all changed modules green; `rulesEngine` logic unit-checked in Node.

---

### UI Overhaul — Apple-minimal, proper flex layout (COMPLETE — arsh-updates)

- **Fixed the "sidebar in the middle" bug**: panels were `position:absolute` inside the scene pane, so in Flow (split) mode they landed mid-screen. Replaced with a real **flex layout**: a unified **TopBar** + a content row where sidebars are flush columns at the window edges (`COL_L`/`COL_R`) and the Flow/Scene split lives in the center. Divider drag now measures the center container (ref), not the window.
- **Unified `TopBar`** (`src/App.jsx`) — wordmark · centered `Scene / Flow+Scene` segmented control · undo/redo, Asset Library toggle, Clear, and the Build/Done button. Replaces the floating `BuildToolbar` + the in-panel mode/library/clear buttons.
- **Apple design system** in `src/ui/theme.js` (FONT, colours, radii, glass/vibrancy, shadows, status colours) + `src/index.css` (SF system font applied to design-sdk type classes, light `#f5f5f7` bg, thin overlay scrollbars, accent-tinted range/color inputs). Frosted-glass panels, hairline dividers, 8pt spacing, Apple blue `#0a84ff` accent.
- Reusable primitives: `Segmented`, `IconBtn`, `TabBar`, `SectionTitle`/`SectionLabel`, `StatusDot`. Inspector tabs + `ConfigField` controls restyled as Apple segmented/sliders; `ViewInspector` is now a right column; `AssetLibraryFlyout` is a flush column (no overlap); chips + shortcuts overlay restyled as glass.
- Verified: production `vite build` (825 modules) zero errors; transform-check green.

---

### Process Flow → n8n-style, full-view toggle (COMPLETE — arsh-updates)

- **No more split screen.** `paneMode` is now `'scene' | 'flow'`; the TopBar segmented toggles **3D Scene** ⟷ **Process Flow** and each fills the whole center. The `<Canvas>` stays mounted (visibility-toggled) so camera/WebGL persist across switches; `FlowPane` overlays full-bleed when flow is active. Divider removed.
- **n8n-style flow** (`FlowPane.jsx`): one clean **input handle (left, grey)** + **output handle (right, blue)** per node (via `primaryPort` in machineLibrary — no more confusing multi-dot ports). A floating **"＋ Add Component"** button opens a searchable picker; **dragging from an output to empty canvas** opens the picker pre-wired to **add + auto-connect** the new node. Empty-state hint when there are no nodes.
- **Connections default to conveyors**: `primaryPort` prefers conveyor→product→utility, so machine→machine links materialise as belts (liquid/utility links stay pipes — domain-correct). Refined bezier edges (blue, animated for conveyors).
- `primaryPort(obj, direction)` added to `machineLibrary.js`; FlowNode rewritten; selection still syncs both ways via `selectedId`.

---

### Anode Potline template (aluminium smelter) (COMPLETE — arsh-updates)

Built from Vedanta "ACD Digital Monitoring" references in `references/anode-potline-shopfloor/`.

- **New procedural assets** (`src/components/assets/`): `ReductionPot` (steel shell, gabled removable covers, anode beam + **40 instanced anode rods** (20/side), control cabinet, fume riser, molten glow), `PotTendingMachine` (yellow double-girder gantry on rails that travels the line), `AluminaSilo`, `TappingCrucible` (siphon + molten glow). Registered in `machineLibrary` under **"Aluminium Smelter"**.
- **Bus-bar connector**: new `'busbar'` connector type — `ReductionPot` has `power` in/out ports; `deriveConnectorType` maps `power → busbar`; `Connectors.jsx` renders heavy copper conductor bars. Pots wire in **series** (domain-correct, not conveyors).
- **ACD telemetry** (`parameterSchemas`): ACD (mm), pot voltage (V), line current (kA), bath temp (°C), anode age (0–28 d). Each pot ships a default **visual rule** `acd > 40 → red glow`.
- **Template** `ANODE_POTLINE` (`templates.js`, first in the Templates tab): 2 rows × 10 pots wired in series by bus bars + PTM + 2 alumina silos + tapping crucible (24 objects, 18 bus bars). Verified via Node + production build.

---

### Anode Potline visual-fidelity pass (COMPLETE — arsh-updates)

- **Side-by-side transverse layout** — pots rotated 90° (template per-row rotation), packed 16/row in two rows flanking a central aisle, gable-ends/cabinets facing the aisle. Power ports moved to local ±Z faces (`machineLibrary`); bus bars auto-fit in the gaps via the existing `Connectors`/`worldPortPos` (verified in Node).
- **Pot silhouette rebuilt** (`ReductionPot.jsx`) to match the photos: a **bold dark trapezoidal superstructure cap** dominates the top (control box + status light + CanvasTexture **stencil** on the aisle end), with the galvanised **slant covers as a lower band** divided into **3 X-braced compartments**; **A-frame jacking trusses** over the top; **gas-collection duct + a riser per compartment**; copper bus-flex lugs + base collector stubs; bath glow.
- **Rendering** — added `@react-three/postprocessing`: ACES filmic tone-mapping + subtle Bloom (emissive-only) + N8AO + SMAA via `PostFX.jsx`; drei `ContactShadows` ground the line. Compact cabinet status light replaces the per-pot beacon poles.
- **PTM** — full-length runway rails + beefier girders (tunable `bayLength`); bus bars thickened (3 bars).
- `StencilLabel.jsx` (CanvasTexture, disposed). Repeated fittings (covers braces, clamps, collector stubs, A-frame legs) are instanced to stay performant across 32 pots. Verified via `vite build` (901 modules, 0 errors).

## 🚧 Not Started Yet

### Performance
- [ ] `three-mesh-bvh` for fast raycasting (needed at >30 objects)
- [ ] LOD models (reduce triangle count for distant machines)

### 3D Quality
- [ ] Mounting stands under machines (structural layer)
- [ ] Pipe geometry between connected machines (piping layer)
- [ ] Conveyor belts wired to store (currently old `ChainConveyor.jsx` not integrated)
- [ ] More detailed machine geometry (reference: real plant photo in `/references/`)
- [ ] Further inline structural color pass (guide rails, star wheels — currently still light gray #b8c4d2, could be darkened)

### Builder Features
- [ ] Inline rename (double-click object name in tree or right panel)
- [ ] Multi-select (Shift+click, box select)
- [x] Duplicate object (`⌘D`) + copy/paste (`⌘C`/`⌘V`) + keyboard nudge/rotate/scale
- [ ] Lock/unlock individual object from right panel
- [ ] Visual pipe/connection line between connected ports
- [ ] `three-mesh-bvh` raycasting

### View Mode Enhancements
- [ ] Simulated sensor values (speed, fill %, pressure, temp, OEE%) in inspector
- [ ] Animated value noise via `setInterval`
- [ ] Production totals bottom bar (OEE, alarms, shift, timestamp)

---

## Known Gotchas (don't repeat)
1. `Environment` + `ShopFloor` in same `<Suspense>` → scene blank until HDRI loads. Always separate.
2. `ref` on `<group>` then `ref.current.material.x = y` → TypeError (groups have no material).
3. Fog `near` too close → entire scene invisible. Keep near ≥ 70 units.
4. `<Text>` from drei suspends scene while font CDN loads → use `<Html>`.
5. Undo/redo "push before action" design loses redo state → push POST-action snapshot. `_history[_historyIndex]` = current state.
6. `useHelper(groupRef, BoxHelper)` — only works when `groupRef.current` is set (mount after `useEffect`).

---

## File Structure (current)
```
src/
  App.jsx                        ← Root: Canvas, lights, all UI panels, keyboard shortcuts
  main.jsx                       ← @faclon-labs/design-sdk/styles.css import
  index.css                      ← Minimal resets
  store/
    sceneStore.js                ← Zustand + persist; objects, layers, undo/redo, flyTo
  lib/
    machineLibrary.js            ← MACHINE_COMPONENTS + MACHINE_LIBRARY + MACHINE_PORTS
    initialScene.js              ← 15 default objects (3 lines)
    snapEngine.js                ← findSnap() port-alignment logic
    templates.js                 ← 5 preset scene configs
  components/
    SceneRenderer.jsx            ← SceneObject + SelectionOutline + PortDots + ShadowFloor
    GridSystem.jsx               ← LOD 3-layer grid (build mode only)
    Floor.jsx                    ← Invisible point lights only (no floor geometry)
    CameraController.jsx         ← OrbitControls fly-to lerp
    CommandPalette.jsx           ← ⌘K search UI
    machines/                   ← 12 machine components
      Carbonator.jsx
      PETFiller.jsx
      RotaryCapper.jsx
      Labeller.jsx
      CheckWeigher.jsx
      CanFiller.jsx
      CanSeamer.jsx
      DateCoder.jsx
      BottleWasher.jsx
      GlassFiller.jsx
      CrownCapper.jsx
      EBIInspector.jsx
```

---

## Session Notes
- User: Siddharth @ Faclon (siddharth@faclon.com)
- Design system: `@faclon-labs/design-sdk` — light theme, Noto Sans, CSS tokens (`var(--spacing-*)`, `var(--text-default-*)`, etc.)
- 3D canvas: white bg + Faclon blue grid lines in build mode
- Geometry: procedural Three.js only — no .glb/.gltf
- Target: enterprise solutions architects / industrial IoT buyers
