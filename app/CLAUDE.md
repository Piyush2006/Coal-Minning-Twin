# Digital Twin Creator — Project Instructions

## What This Is
3D Digital Twin simulation of a beverage manufacturing shopfloor.  
Built with Vite + React Three Fiber + @react-three/drei + Three.js.  
Target audience: enterprise solutions architects / industrial IoT buyers.

## Run
```bash
npm run dev   # http://localhost:5173
npm run build # production build check
```

## Current State
See `PROGRESS.md` for full task checklist, what's done, what's next.

## Architecture Rules

### 3D Scene
- All geometry is **procedural Three.js only** — no external .glb/.gltf files
- Use `LatheGeometry` for rotational parts (drums, spools, insulators, vessels)
- Use `TubeGeometry` for pipes, hoses, helix screws
- Use `meshStandardMaterial` for all surfaces — PBR, responds to lighting
- Machine materials: stainless steel = `color="#b0c4d0" metalness={0.85} roughness={0.12}`
- Never use pure black backgrounds — use deep navy `#070c18`

### React / R3F Patterns
- `useRef` + `useFrame` for animations — NEVER attach ref to `<group>` if you need `.material` or `.intensity` (groups have neither — attach to `<mesh>` or `<pointLight>`)
- Labels in 3D: use `<Html>` from drei, NOT `<Text>` (Text suspends waiting for CDN font)
- `Environment` must be in its **own** `<Suspense>` — never share with scene geometry or geometry won't render while HDRI loads
- Error boundary wraps the whole app — if 3D throws, show error message not blank screen

### File Layout
```
src/
  App.jsx                  ← Canvas, lights, error boundary, HUD
  components/
    ShopFloor.jsx           ← Assembles 3 lines + conveyors
    Floor.jsx               ← Floor grid + ceiling
    ChainConveyor.jsx       ← Between-machine conveyors
    StatusBeacon.jsx        ← Reusable status beacon (green/amber/red)
    geoHelpers.js           ← drumProfile(), helixCurve() utilities
    machines/               ← One file per machine type
```

### Machine Status System
- Status values: `'running'` | `'idle'` | `'fault'`
- Click machine → cycles status (running → idle → fault → running)
- Each machine accepts `{ status, config, onClick }` props (SceneRenderer passes `status` + `config`; position/rotation/scale are on the wrapping `<group>`)
- `StatusBeacon` handles visual + light animation per status

### Asset Config System ("nothing static")
- Every object has a free-form `config: {}`. Configurable fields are DECLARED per type in `src/lib/assetSchemas.js` (`ASSET_SCHEMAS`), NOT hardcoded.
- Adding a new asset type? (1) add an `ASSET_SCHEMAS[type]` entry, (2) read those keys in the component via `config` with `?? default` fallbacks. The `BuildRightPanel` settings form is auto-generated from the schema — no per-type form code.
- Animation reads config (`config.speed`, `config.pulseRate`, `config.enabled`) instead of literals. Defaults MUST equal prior hardcoded values so existing scenes are unchanged.
- Connectable parametric assets (ConveyorBelt, PipeSegment) derive ports from config via `getPorts(obj)` in `machineLibrary.js` — never store port offsets.
- Custom user assets: generic `Primitive.jsx` (geometry from config) + persisted `customAssetTypes` store slice. SceneRenderer maps unknown-but-custom types → `Primitive`.
- Persist is versioned: bump `version` + add a `migrate` step when the object/config shape changes.

### Workspace: Process Flow + Connectors + Rules (TwinMaker-style)
- **Two synced editors, one store**: 3D Scene + a React Flow node graph (`src/components/flow/`). `paneMode: 'scene'|'split'`. FlowPane is CONTROLLED — derive nodes/edges from the store via `useMemo`, write back only on discrete gestures (no `useNodesState` source of truth). Flow node positions live in `flowLayout` and are INDEPENDENT of 3D `position`.
- **Three parallel schema registries**, all mirroring `assetSchemas.js`: `assetSchemas` (settings → geometry/animation), `parameterSchemas` (telemetry values rules read), `connectorSchemas` (per-connector config). Adding a field anywhere auto-generates UI via the generic `ConfigField` (`{field,value,onLive,onCommit}`).
- **Connections are first-class & visual**: per-object `connections[]` records `{id,targetId,sourcePort,targetPort,connectorType,connectorConfig}`. `addConnection` (called by flow `onConnect` AND scene drag-snap) derives type from the source port. `src/components/Connectors.jsx` renders auto-fit geometry — endpoints via `worldPortPos` (exported from snapEngine), upright `makeBasis` orientation, length = port distance; it's a PURE render of the two objects' transforms so it re-fits on move with no stored transform. `removeObject` strips inbound connections.
- **Visual rules → glow**: per-object `rules[]`; `rulesEngine.computeGlowMap(objects)` (pure, memoized on `objects`) → `{id: color}`; `SceneRenderer` renders a halo ring + capped (≤8) point light. Don't evaluate rules in `useFrame` — only the glow pulse animates per-frame.
- Selection: `selectedId` and `selectedConnectionId` are mutually exclusive (set in store actions). Keyboard handler bails inside `[data-flowpane]`.

### UI / Layout (Apple-minimal)
- Design tokens live in `src/ui/theme.js` (`FONT`, `C` colours, `R` radii, `glass`, `SHADOW`, `STATUS_COLOR`); `src/index.css` applies the SF system font to the design-sdk type classes. Prefer these tokens over `var(--…)` for new chrome. Accent is Apple blue `#0a84ff`.
- Layout is a **flex column**: `TopBar` + a content row. Sidebars are flush columns at the window edges (`COL_L`/`COL_R` in App.jsx) — NEVER `position:absolute` inside the scene pane (that caused the sidebar-in-the-middle bug in split mode). The Flow/Scene split lives in the center column; the divider measures `centerRef`, not the window.
- Reusable primitives in App.jsx: `Segmented`, `IconBtn`, `TabBar`, `SectionLabel`/`SectionTitle`, `StatusDot`. Panels use frosted glass (`...glass`) + hairline borders (`C.line`).

### Production Lines
| Line | Z position | Machines |
|---|---|---|
| A — PET | +8.5 | Carbonator, PETFiller, RotaryCapper, Labeller, CheckWeigher |
| B — Cans | 0 | Carbonator, CanFiller, CanSeamer, DateCoder, CheckWeigher |
| C — Glass | -8.5 | BottleWasher, GlassFiller, CrownCapper, EBIInspector, CheckWeigher |

## Design System (use these exact values)
```
bg-primary:   #070c18   (deep navy — never pure black)
bg-panel:     #0d1428
border:       rgba(0, 200, 255, 0.15)
border-hi:    rgba(0, 200, 255, 0.4)
accent:       #00c8ff   (electric CAD blue)
accent2:      #00ffcc   (teal)
text-primary: #c0d4e8
text-dim:     #5a7a9a
success:      #00dd66
warning:      #ffaa00
fault:        #ff3344
```
Font: `'Courier New', monospace` — engineering aesthetic

## Known Gotchas (don't repeat these bugs)
1. `Environment` + `ShopFloor` in same `<Suspense>` → scene blank until HDRI loads. Always separate.
2. `ref` on `<group>` then `ref.current.material.x = y` → TypeError (groups have no material).
3. Fog `near` too close to camera → entire scene invisible. Keep near ≥ 80 units.
4. `<Text>` from drei → suspends scene while font CDN loads → use `<Html>` instead.

## Update This File When
- New machine type added
- Architecture pattern changes (new geometry approach, new state system)
- New major UI component added
- Bug discovered that could recur

## Progress Tracking
Full task list and session notes in `PROGRESS.md`.
