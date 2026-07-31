# Technical Architecture — Faclon Digital Twin Creator (Blackridge Coal Mine)

A technical reference for the application, written so a non-engineer can
follow it. Each section names the real technology, then says in plain words
what it does.

---

## 1. Technology stack

| Layer | Technology | In plain words |
|---|---|---|
| Language / UI | **React 18 + JavaScript (Vite)** | The framework the whole interface is written in; Vite is the tool that bundles it into a website. |
| 3D engine | **Three.js r169 via React-Three-Fiber** | The graphics library that draws the mine using your computer's graphics card (WebGL). |
| 3D helpers | **@react-three/drei, @react-three/postprocessing** | Ready-made building blocks: camera controls, HTML labels in 3D, and the "photo filters" (bloom, depth of field, colour grade). |
| State | **Zustand** | Small shared memory boxes that every part of the app reads from and writes to. |
| Persistence | **Browser localStorage** | Projects are saved inside the browser itself — no server, no database. |
| 3D assets | **glTF/GLB models + procedural geometry** | Two ways of making shapes: artist-made model files, and shapes computed from numbers. |
| Deployment | **Static site (Vite build → `dist/`)** | The finished app is plain files any web host can serve. |

There is **no backend**. Everything — rendering, simulation, alerts —
runs client-side in the browser. The only optional network dependency is
the IOsense platform for live sensor data (see §7).

---

## 2. High-level architecture

```
        ┌───────────────────────────────────────────────────────────┐
        │                    Browser (single page)                  │
        │                                                           │
        │  DATA FILES              STORES (Zustand)      RENDER     │
        │  ─────────────           ────────────────      ─────────  │
        │  Twin Spec JSON  ──────▶ sceneStore  ────────▶ R3F Canvas │
        │  Component JSONs ──────▶ (objects,             (3D scene, │
        │  Template files          environment,           post-FX,  │
        │                          tour config)           CCTV pass)│
        │                              ▲                     │      │
        │  Simulator (1 Hz tick) ──────┘                     ▼      │
        │  Scenario API                DOM UI (panels, overlays,    │
        │  [IOsense UNS poll]          alerts, tour lower-third)    │
        └───────────────────────────────────────────────────────────┘
```

One-way flow: **data files describe the world → stores hold the live state →
the renderer and the panels both draw from the same stores.** Nothing talks
to the 3D scene directly; everything goes through the stores.

---

## 3. Data contracts (everything is config)

The application is generic; the coal mine is *data*, not code.

- **Twin Spec** (`03-twin-spec.json`) — one file describing the whole site:
  every object (id, type, position, rotation, per-object `config`), the
  groups hierarchy, the environment (sky, fog, ground, post-FX), and the
  tour script. Validated and normalised by `lib/twinSpec.js` on load.
- **Component Specs** (`02-components/*.json`) — one file per machine type
  (26 of them). Each lists *parts* (box/cylinder/cone with size, position,
  material, optional animation), *parameters* (the vital signs with default
  values and ranges), and *ports* (where conveyors/pipes connect).
- **Per-object `config`** — the extension point. Examples: `config.path`
  (waypoints a vehicle drives), `config.alertRules` (thresholds), 
  `config.kpi3d` (a floating KPI card), `config.model` (swap in a GLB file),
  `config.blast` (the blast line), `config.watch` (a camera's belt target).
  New behaviour is added by adding config keys, not by editing components.

---

## 4. State management (who owns what)

| Store | Owns |
|---|---|
| `sceneStore` | All objects and their live parameters, selection, environment, tour config, undo history. |
| `projectStore` | Saved projects, active project, home/editor navigation; refreshes the tour config from the template on every open. |
| `useFeedStore` | Which CCTV feed is open and at what size. |
| `useTourStore` / `useBlastStore` / `useDayNight` / `useViewTab` / `useKpiStore` | Tour playback, blast sequence, day-night mode, right-panel tab, KPI visibility. |

Rule of thumb: user clicks and tour actions call **the same store
functions**, so anything a user can do, the tour can script.

---

## 5. Rendering pipeline

1. **Scene pass** — React-Three-Fiber draws all objects. Composite assets are
   built from their part lists; GLB assets load through `ModelSwap` (with
   automatic scaling/grounding and a silent fallback to the procedural
   version). Terrain (`PitTerrain`) is generated geometry: benches, ramp,
   seam, sump from a parameter recipe.
2. **Effects pass** — the composer applies ambient occlusion, bloom, depth
   of field, a colour grade and vignette (all tunable from the Twin Spec;
   tone mapping is ACES at the renderer).
3. **CCTV pass** — when a feed is open, the scene is rendered a second time
   from that camera into exactly the panel's rectangle (viewport+scissor
   derived from the DOM panel each frame). Intentionally *raw*: no effects.
4. **Particles** — smoke/steam/dust/blast columns are GPU point shaders;
   the CPU only advances one clock uniform per frame.
5. **Motion** — `PathDrive` moves vehicles along Catmull-Rom splines built
   from waypoints, with dwell (loading pause), load-state (visible cargo
   appears/disappears at load/dump points) and a loaded-slow speed warp.

---

## 6. Simulation & scenarios (the data heartbeat)

- `stepSimulation` (`lib/oee.js`) runs **once per second**, drifting every
  parameter realistically and applying `demoTrends` (slow scripted sweeps
  so alerts fire periodically in demos).
- `lib/demoScenarios.js` is the **on-demand scenario API**: named failures
  (`triggerScenario('crusher-vib')`) that set or ramp parameters past their
  alert thresholds instantly, and clear back to normal. During the tour,
  an *exclusive mode* pins the background sweeps to defaults so **only**
  scripted scenarios fire — identical recordings every run.

---

## 7. Live data (production path)

The same parameter slots the simulator writes can be fed by the **IOsense
platform**: a 12-second poller (`Root.jsx`) resolves every parameter bound
to a UNS topic (`paramMeta.topic`) through the official `resolveAndCompute`
API and writes real values into the store. Simulated and real data are
indistinguishable downstream — alerts, panels, KPIs and the tour behave the
same.

---

## 8. Alerting pipeline (one rule book, many surfaces)

```
config.alertRules ─▶ evaluateAlerts() ─▶ active alerts list
                                          ├─ alerts panel rows
                                          ├─ 3D severity ring on the asset
                                          ├─ belt-point marker (camera watches)
                                          ├─ asset drill-down: sparklines + history
                                          └─ CCTV feed DET box + banner
```

Rules live on objects as data; a single evaluator computes active alerts
each tick; every visual surface renders from that one result. A ring buffer
keeps the fired-alert history per asset.

---

## 9. The tour system

The tour is data in the Twin Spec: 14 *beats*, each with camera position/
target, travel/hold durations, title/subtitle/tag, and an `actions` list
(`triggerScenario`, `openDrilldown`, `openFeed 2x`, `blast`, `closePanels`…)
timed in seconds from the beat start. `TourDriver` flies the camera (eased
moves, drift during holds), executes actions through the normal store
functions, verifies each action actually changed state, auto-cleans between
beats, and hands the camera back untouched on exit. During the tour the
top bar and controls hide; presentation mode also hides demo chrome.

---

## 10. Persistence & deployment

- **Projects**: serialized scene snapshots in browser localStorage
  (versioned, migratable). Import/Export moves a Twin Spec as a JSON file.
- **Build**: `npm run build` produces a static `dist/` — deployable on any
  static host (framework preset: Vite, root directory `app`).
- **Dev tooling**: `scripts/validate-paths.mjs` (proves vehicle routes never
  clip objects or terrain), `scripts/optimize-model.sh` (compresses future
  GLB models), and dev-only hooks for automated screenshot/verification runs.
