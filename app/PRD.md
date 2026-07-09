# Product Requirements Document — Digital Twin Workbench

| | |
|---|---|
| **Product** | Digital Twin Workbench (Faclon / IOsense) |
| **Status** | Living document — describes the product the current build implements |
| **Owner** | Solutions / Platform |
| **Related** | `FEATURES.md` (exhaustive feature inventory), `skills/` (AI authoring rules), `CLAUDE.md` (architecture rules) |

---

## 1. Summary

The Digital Twin Workbench is a **browser-based authoring and monitoring tool for 3D digital twins of industrial shopfloors**. A user describes or draws a plant, the tool builds a navigable 3D scene organised as a **Unified Namespace (UNS)**, attaches **telemetry, states and rules**, and can **simulate live behaviour** or bind to **real IOsense data**. An embedded AI assistant ("Bruce") can generate, edit, and populate twins from natural language, and author reusable **components**. Twins and components are **saved and shared** through the IOsense cloud.

The product's wedge: **go from "describe my plant" to a credible, standards-shaped, live-looking 3D twin in minutes — for any industry — without 3D or CAD skills.**

---

## 2. Background & problem

Industrial digital twins today are expensive and slow to stand up: they need CAD/3D specialists, bespoke models per asset, and hand-wired data plumbing. For **pre-sales, solution design, training, and operations visualisation**, teams need something far faster and more flexible.

Problems we solve:
- **Time-to-twin is too long.** Mocking a plant for a demo/POC takes days of 3D work.
- **Twins are bespoke and inconsistent.** Each one is modelled differently; no shared conventions → unusable namespaces, ad-hoc telemetry.
- **They look dead.** Static models with no live values don't convince buyers or train operators.
- **They're locked to one domain.** Tools are hardcoded to a vertical; you can't represent arbitrary equipment.
- **No reuse.** Every project re-models the same pump/skid/cell from scratch.

---

## 3. Goals & non-goals

### Goals
- **G1 — Minutes, not days.** Stand up a believable multi-line plant twin from a brief or a few clicks.
- **G2 — Any shopfloor.** Beverage, aluminium, pharma, CNC, chemical, food, packaging, warehousing — via a catalog **plus** custom components.
- **G3 — Uniform & standards-based.** Every twin follows ISA-95/UNS hierarchy, SI units + sampling cadence, ISA-18.2 state severities, ISA-101 colour — automatically.
- **G4 — Alive.** Realistic simulation out of the box; optional binding to real UNS data.
- **G5 — AI-native authoring.** Describe → generate/edit/populate; AI clarifies before guessing.
- **G6 — Reuse & share.** Author components once; share across projects/users via the cloud library.
- **G7 — No 3D skills required.** Procedural geometry, gizmos, and forms — never code.

### Non-goals
- Not a CAD / mechanical-design tool (no precise engineering geometry, tolerances, GD&T).
- Not a control system / SCADA of record (read/visualise; not safety-rated control).
- Not a physics/CFD simulator (process simulation is representative, not high-fidelity).
- Not a generic 3D scene editor (scope is industrial assets + namespaces + telemetry).
- Not a multi-user real-time co-editing tool (single-editor; cloud sync is supersede-based).

---

## 4. Target users & personas

- **Solutions architect / pre-sales engineer (primary).** Builds demo/POC twins for prospects; needs speed, polish, and "it looks live."
- **Industrial IoT buyer / plant stakeholder (viewer).** Explores the twin in view mode, reads KPIs and recommendations; doesn't edit.
- **Operations / process engineer.** Monitors states/telemetry, stages scenarios, drills into assets/sub-components.
- **Component author / power user.** Builds reusable custom components in the Studio and publishes them to the shared library.
- **Trainer / trainee.** Uses a populated twin (with upset scenarios) for familiarisation.

---

## 5. Key use cases / journeys

1. **Describe-to-twin.** "Build a 2-line bottling plant with demo data" → Bruce generates an ISA-95-grouped scene with realistic telemetry; user opens it in view mode.
2. **Template start.** Pick "Anode Potline" → lands in view mode on a populated, running plant.
3. **Hand-build.** Drag assets from the library into groups, connect ports, set parameters/rules.
4. **Populate & stage.** "Fill with realistic demo data" / "stage an upset" → values + alarm states applied.
5. **Author a component.** Build a custom asset in the Studio (parts tree, params, ports, states) → save → auto-published to the shared library → placeable everywhere.
6. **Conversational edit.** In the Studio, "add a cooling jacket / 6 bolts around the flange / make it taller" → incremental edits.
7. **Monitor & act.** View mode: read line KPIs, see problem assets glow red, open Bruce's recommendations, drill into a pot's anodes and trend chart.
8. **Share.** Save project to cloud; teammate on the same org pulls it (and the shared components).

---

## 6. Functional requirements

Priority: **P0** = must-have (core), **P1** = important, **P2** = nice-to-have. (Exhaustive behaviour in `FEATURES.md`.)

### 6.1 Projects & persistence
- **FR-1 (P0)** Create blank / from template / from generated scene; open, rename, duplicate, delete projects.
- **FR-2 (P0)** Local persistence; manual save; dirty tracking + leave-confirmation; provisional projects discarded if abandoned.
- **FR-3 (P1)** Project search + filters (all/cloud/local/mine); 3D thumbnails.

### 6.2 Editing & navigation
- **FR-4 (P0)** Build/View mode toggle; Scene/Process-Flow split; resizable/collapsible sidebars.
- **FR-5 (P0)** Select/move/rotate/scale assets via gizmos and keyboard; duplicate/delete; copy-paste (assets + groups); frame/fly-to; undo/redo.
- **FR-6 (P0)** Command palette (⌘K), hierarchy search, shortcuts overlay.
- **FR-7 (P0)** UNS/ISA-95 hierarchy tree: nested groups, drag-reparent/reorder, rename, add, group inspector; **read-only in view mode**.

### 6.3 Asset configuration
- **FR-8 (P0)** Per-type auto-generated configuration form (geometry/animation knobs).
- **FR-9 (P0)** Parameters (telemetry): add/edit/delete, units, **per-parameter sampling frequency**, **UNS topic binding**, **manual-entry params with timestamp**.
- **FR-10 (P1)** Visual rules → glow (threshold vs constant or another asset's parameter); automatic severity-based glow.
- **FR-11 (P0)** States (rich per-type machine) with ISA-18.2 severities → status, beacon, glow.
- **FR-12 (P0)** Ports + connections; auto-derived connector type (conveyor/pipe/busbar); auto-fitting visual connectors; snap-to-connect.

### 6.4 Process-Flow graph
- **FR-13 (P1)** Node-graph synced to the scene; drag-to-connect; add node; delete edge; minimap/controls; independent flow layout.

### 6.5 Components
- **FR-14 (P0)** Asset catalog + custom asset types so **any** equipment is representable (catalog-or-custom rule).
- **FR-15 (P0)** Component Studio: parts **tree** (primitive / nested-component / group / general), gizmo drag + keyboard, per-node transform/material/animation, **per-node parameters** (unit/freq/topic), ports, config/parameters/states schemas, beacon.
- **FR-16 (P0)** Save with **copy-vs-update choice** when editing an existing type (with affected-instance count).
- **FR-17 (P1)** Component Import/Export (JSON).
- **FR-18 (P1)** Sub-components (declarative count+layout) and **Component Details** view (structure tree, 3D, per-instance edit, trend chart, part highlight).

### 6.6 AI assistant (Bruce)
- **FR-19 (P0)** Embedded chat; user-supplied model/API key (Anthropic/OpenAI/Gemini); per-project persisted thread.
- **FR-20 (P0)** Context-aware behaviour: scene surface (generate/manipulate/demo/create-component) vs component surface (edit-this-component); header context chip.
- **FR-21 (P0)** Modes: generate, manipulate, demo-data, create-component (create + place in scene), edit-component (incremental), **clarify** (ask high-impact questions first).
- **FR-22 (P0)** Skill + shared-conventions driven so output is standards-shaped and uniform across industries.
- **FR-23 (P1)** View-mode floating insight card with operator recommendations (shopfloor + per-asset), "see in 3D".

### 6.7 Live behaviour & data
- **FR-24 (P0)** Process simulation (per-tick), frequency-gated, realistic pacing; demo-data generation.
- **FR-25 (P1)** UNS live-data binding scaffold (per-parameter topic; simulator yields to bound values).

### 6.8 Cloud & sharing (IOsense)
- **FR-26 (P1)** Connect IOsense account; push/pull projects (supersede-by-key, add-only, never clobber local).
- **FR-27 (P1)** Shared **component library**: auto-publish on save, pull on connect, merged into the asset library for all users/projects; offline-first.

### 6.9 Import/Export & templates
- **FR-28 (P1)** Scene Import/Export (Twin Spec JSON); starter templates.

---

## 7. Non-functional requirements

- **NFR-1 Performance.** Smooth interaction with large scenes (e.g. 30+ machines, hundreds of instanced sub-parts) at interactive frame rates; instanced rendering for repeated elements.
- **NFR-2 Reliability/resilience.** App-level error boundary (no blank screens — recovery UI); stale-module auto-recovery; versioned persistence with migrations; scene error boundary.
- **NFR-3 Offline-first.** Works fully without cloud; localStorage cache; cloud is best-effort and never blocks.
- **NFR-4 Visual quality.** Procedural PBR geometry, ISA-101 muted palette, bloom/SMAA, no z-fighting (log depth + polygon offset); Apple-minimal UI.
- **NFR-5 Security/privacy.** User brings own AI key (stored locally; calls go direct to the provider); IOsense auth via token/PAT; no secrets in the repo.
- **NFR-6 Portability.** Modern browser; no plugins; no external 3D model files (all procedural).
- **NFR-7 Standards conformance.** ISA-95 hierarchy, UNS topic naming, ISA-18.2 severities, ISA-101 colour, SI units, OPC-UA/Sparkplug-style metric addressing.
- **NFR-8 Extensibility.** New asset type = one schema entry per registry (config/parameters/states/ports/subs) — UI auto-generates; nothing per-type hardcoded in the renderer.
- **NFR-9 Determinism of saved artifacts.** A saved project/component reproduces identically; AI generation is intentionally variable (creative), saved specs are the stable source.

---

## 8. Architecture & data model (summary)

- **Twin Spec** — JSON scene the app loads: `objects` (type, name, position, layer, parentId, config, parameters, rules, connections), `groups` (UNS namespace, KPIs), `customAssetTypes`, `flowLayout`.
- **Component Spec** — a custom asset type: `parts[]` tree (primitive/component/group/logical, each with transform, material, parameters), `ports`, `config`, `parameters`, `states`, `beacon`.
- **Single source of truth per component** — `getComponentDef(type)` assembles config/params/states/sub-components/ports/renderer.
- **State stores (Zustand, persisted)** — scene, projects (+ cloud sync), AI settings, component library; live-ref modules to avoid import cycles.
- **Conventions are centralised** (`skills/digital-twin-conventions.md`) and injected into every AI prompt for uniformity.
- **"Nothing static"** — geometry/animation read config; simulation drives parameters/state; state drives glow, recommendations, sub-parts.

---

## 9. Success metrics

- **Time-to-first-twin** — median minutes from new project to a populated, grouped scene (target: < 10 min via AI or template).
- **AI authoring success rate** — % of generate/edit requests that validate and render without manual fixes.
- **Reuse rate** — # of shared library components placed across projects.
- **Twin completeness** — % of assets that are grouped (UNS) and carry ≥1 parameter (target: 100% — enforced by skills).
- **Demo conversion / engagement** — sessions reaching view mode; insight-card interactions.
- **Stability** — crash/blank-screen rate (target ~0 via error boundary + recovery), cloud-sync error rate.

---

## 10. Assumptions, constraints, dependencies

- Users provide their own LLM API key; AI quality/latency depends on the chosen model.
- IOsense cloud uses a fixed projects insight; the platform's update endpoint is unreliable → **supersede-by-key** is the sync model.
- Built-in geometry is procedural and bespoke (not auto-generated from specs) — custom components use simple placeholder primitives unless authored richly.
- Single-editor model; concurrent edits resolve by newest-doc-per-key, not live merge.
- For stable shared/demo URLs, serve a **production build** (the dev server is for iteration).

---

## 11. Out of scope / roadmap

- **Out of scope (now):** physics-accurate simulation; real-time multi-user co-editing; control/write-back to PLCs; mobile/touch authoring; role-based access control on individual components.
- **Roadmap candidates:**
  - Runtime telemetry binding for **per-part** parameters (today authoring-only).
  - Studio-level **undo** and per-part 3D highlight on selection.
  - **Bruce voice/clarify chips** (clickable answers) and richer multi-industry reference recipes.
  - Component **versioning & permissions** in the shared library.
  - **Production-serving** pipeline + cache headers for shared URLs.
  - Sub-component **runtime simulation/UNS binding** per instance.

---

## 12. Risks

- **AI variability** — same prompt ≠ identical twin (mitigated by standards + saved-artifact determinism; reference recipes can tighten).
- **Cloud endpoint limitations** — no reliable update → supersede model (mitigated; documented).
- **Dev-server serving** — stale-module blanks behind a proxy (mitigated by auto-recovery; resolved fully by production serving).
- **Scope creep into CAD/SCADA** — guarded by explicit non-goals.

---

*Functional behaviour is enumerated exhaustively in `FEATURES.md`; AI authoring contracts live in `skills/`; architecture rules in `CLAUDE.md`.*
