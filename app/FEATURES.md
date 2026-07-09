# Digital Twin Workbench — Feature Document

A browser-based tool to **design, populate, simulate and share 3D digital twins of any shopfloor** (beverage, aluminium, pharma, CNC, chemical, …). Built with React + React-Three-Fiber + Zustand, with an embedded AI assistant ("Bruce"), a component authoring Studio, and optional IOsense cloud sync.

This document lists features exhaustively — down to individual interactions (e.g. "drag a part," "nudge with arrow keys").

---

## 1. Projects & Home

- **Project library / launcher** (home screen) — grid of saved projects with name, timestamps, and a live 3D thumbnail.
- **Create new (blank) project** — opens straight into build mode.
- **Create from template** — pick a starter layout; opens in **view mode** on a populated scene.
- **Open project** — hydrates its scene + its own chat.
- **Rename project** (home and in‑editor top bar).
- **Duplicate project** (deep copy).
- **Delete project** (also hides its cloud versions).
- **Search projects** by name; **filter** All / Cloud / Local; **"My projects"** filter (by signed‑in account).
- **Per‑project isolated chat** with Bruce (persists across reload).
- **Provisional project** — a blank you start editing is discarded if you leave without saving (no empty "Untitled" left behind).
- **Hard refresh → home; normal refresh → stay** on the current view.
- **Dirty tracking** — unsaved‑changes indicator; **leave‑confirmation** prompt (Save / Discard / Cancel) when navigating away dirty.
- **Manual save** (local) + optional **"Save to cloud?"** prompt after saving.
- **Account avatar** with initials; **sign‑in/connect** via IOsense.

## 2. Modes & layout

- **Build mode ↔ View mode** toggle.
  - *Build*: edit the scene; left = hierarchy + inspector drawer; right = Bruce chat.
  - *View*: monitor; left = hierarchy (read‑only); right = Overview / Asset inspector; floating Bruce insight card.
- **Scene ↔ Process‑Flow split** (`paneMode`): 3D scene only, or scene + node‑graph.
- **Resizable, collapsible sidebars** (drag the inner edge; chevron tab to collapse/expand) on both left and right.
- **Inspector drawer** slides out next to the hierarchy when something is selected (build mode); collapses when deselected.
- **Unified top bar**: project name, mode toggle, pane toggle, undo/redo, Components button, Clear, Import/Export, Save, Home.

## 3. 3D scene — interaction & editing

- **Orbit / pan / zoom** camera (damped); **gizmo viewport** cube (axis indicator).
- **Click to select** an asset; **click empty space to deselect**.
- **Transform gizmo** with **Move / Rotate / Scale** modes (segmented control + keyboard `G`/`R`/`S`).
- **Drag to move / rotate / scale** the selected asset (gizmo); orbit is frozen while dragging.
- **Keyboard nudge** of selected asset: arrows = X/Z, **⌘/Ctrl+↑↓ = Y**; **Shift** = coarse (2 m), **Alt** = fine (0.1 m).
- **Rotate by keyboard**: `[` / `]` (Shift = 45°, else 15°).
- **Scale by keyboard**: `-` / `=` (Shift = 0.25, else 0.1).
- **Frame/fly to** selected asset (`F`) or group.
- **Duplicate** (⌘/Ctrl+D), **Delete** (Del/Backspace).
- **Copy / Paste** assets and **whole groups** (⌘/Ctrl+C / ⌘/Ctrl+V) — group paste clones the subtree with fresh ids, offset.
- **Cycle status** (click the state badge) through the asset's state machine.
- **Snap‑to‑connect**: drag an asset so a port aligns with another's → auto‑creates a connection.
- **Hint chips** over the canvas (⌘K search, ⌨ shortcuts).
- **Command palette** (⌘/Ctrl+K) — fuzzy search to add assets / jump to objects.
- **Hierarchy quick‑search** with keyboard navigation + scope.
- **Shortcuts overlay** (`?`).
- **Grid system** + floor + shopfloor environment; **fog**, soft shadows, contact shadows.

## 4. Hierarchy / UNS namespace tree (left panel)

- **Unlimited nested groups** (Enterprise→Site→Area→Line→Unit, ISA‑95 shaped) + assets — the tree *is* the Unified Namespace.
- **Expand/collapse** groups; **child‑count** badges; **status dot** per asset (state colour).
- **Select** asset/group (click) → highlights + frames; **auto‑reveal** (expands ancestors) when selected elsewhere; **scroll‑into‑view**.
- **Create group** (header "+ Group"); **add sub‑group** / **add component** via per‑row hover buttons (component picker sheet).
- **Inline rename** (double‑click a group).
- **Drag‑to‑reparent / reorder** with into / before / after drop indicators (cycle‑guarded); drop on empty → root.
- **Delete group** (reparents children up — no asset loss).
- **Group inspector** (view mode): scoped line/area overview + KPIs; **Frame** the group; add sub‑group; delete.
- **View‑mode safety**: all create/edit/rename/drag affordances are **hidden in view mode** (navigation only).

## 5. Asset inspector (build mode)

- **Editable name**, type + layer labels, **state badge** (click to cycle).
- **Tabs: Settings / Parameters / Rules.**
- **Settings**: transform (position/rotation as numeric rows + gizmo mode), connections list, auto‑generated **configuration form** (per‑type schema → number/boolean/select/color/text controls).
- **"✎ Edit this component"** — jump straight into the Component Studio editing this type (custom → in place; built‑in → editable copy).
- **Delete object**.

## 6. Parameters (telemetry) — per asset & per node

- **Add / edit / delete** parameters; auto‑generated key + label + unit.
- **Value editor** (range slider when min/max exist, else number input).
- **Frequency** dropdown per parameter (real‑time / 5s / 30s / 1m / 5m / 15m / 1h / **manual**) — industry‑standard cadences.
- **UNS topic binding** per parameter (free‑text path; ● UNS indicator) — for live data.
- **Manual data‑entry** parameters: shown read‑only with a "Manual data entry" caption + entry timestamp (operator/lab readings, e.g. bath/metal temp).
- **View‑mode readout**: clean SCADA‑style faceplate (value + unit; manual params labelled; no clutter).

## 7. Visual rules → glow

- **Per‑object rules**: `parameter operator value` (operators `> >= < <= == !=`).
- **Compare against a constant** or **another asset's parameter**.
- **Glow colour** when a rule matches (halo ring + pulsing point light, capped at 8 lights).
- **Automatic severity glow**: any asset in a warn/down state glows **amber/red** even without an explicit rule (ISA‑101 colours).
- **Enable/disable** individual rules; add/remove.

## 8. States, status & live simulation

- **Rich per‑type state machine** (e.g. pot: normal/feeding/tapping/beamRaise/anodeChange/anodeEffect/offline); legacy running/idle/fault for others.
- **Severity** (ok/warn/down → ISA‑18.2 priority) drives status, beacon, glow, and Bruce recommendations.
- **Status beacons** (animated dome: steady=running, slow pulse=idle, fast flash=fault).
- **Process simulation** — per‑second tick evolves parameters + state realistically; **gated by each parameter's frequency** (values don't churn every second; manual params never auto‑move).
- **Real‑time pacing** — pots stay "Normal" for long stretches; rare anode‑effect / anode‑change events; staggered anode ages.
- **State is the single source of truth** — sub‑parts, glow and recommendations all derive from it.

## 9. Connections, connectors & ports

- **Ports** per asset (type: product / conveyor / utility / co2 / power; direction in/out/bidirectional), shown as coloured dots.
- **Connect** via Flow graph `onConnect`, scene snap‑drag, or AI commands.
- **Auto‑derived connector type** from the source port: **conveyor belt**, **pipe**, or **busbar**.
- **Visual connectors** auto‑fit between the two assets (re‑fit on move; no stored transform); **per‑connector config** (e.g. busbar bars/width/colour, conveyor speed/style/item).
- **Select / edit / remove** a connection; removing an object strips its inbound links.
- **Parametric ports** (ConveyorBelt, PipeSegment) derive port offsets from `config.length` so they track geometry.

## 10. Process‑Flow graph (n8n / TwinMaker‑style)

- **React‑Flow node graph** synced to the scene (controlled; derived from the store).
- **Nodes per asset, edges per connection**; **drag to connect** (creates a real connection).
- **Add node** picker; **delete edge** (inline ✕).
- **Background grid, zoom Controls, MiniMap** (pannable/zoomable).
- **Independent flow layout** positions (don't affect 3D positions).

## 11. Asset library / catalog

- **Catalog of built‑in asset types** across categories (Filling & Processing, Capping, Packaging, QC, Material Handling, Utilities & Structure, Aluminium Smelter).
- **Components modal** (⊞ Components) — searchable tiles with 3D glyphs; **click to drop** into the scene (named after the component's label, not its id).
- **Custom types section** with edit (✎) per type.
- **3‑way "Add Component" chooser**: **Build** (Studio) · **Describe to Bruce** (seeds the chat) · **Import JSON**.
- **Asset library flyout** (pinned) and **in‑hierarchy picker** for adding into a specific group.

## 12. Component Studio (author custom components)

- **Full‑screen authoring view** mirroring the main editor.
- **Hierarchy tree** of the component's **parts** — same UX as the main builder (carets, child counts, drag‑to‑reparent/reorder, inline rename, hover add).
- **Part kinds**: **primitive** (box/cylinder/sphere/cone/torus), **nested component** (reference another built‑in/custom type), **group** (transform folder), **general/logical** (non‑visual data node).
- **＋ Add** popover: Group · General part · Shape · Component (adds under the selected group/root).
- **Live 3D preview** with **Move/Rotate/Scale gizmos**; **drag a part** to position it (orbit frozen during drag; commits on release).
- **Keyboard in Studio**: arrows = X/Z nudge, PageUp/Down = Y, Shift = larger; Delete; Esc.
- **Left inspector drawer** (selection‑driven): per‑node **transform / geometry / material / animation / label**; root → Meta / Settings / Subs / States / Ports tabs.
- **Per‑node parameters** — add/edit/delete with **unit + frequency + UNS topic** (same control as the main screen).
- **Material editor**: colour, metalness, roughness, emissive, polygon‑offset (for flush‑mounted parts to avoid z‑fighting).
- **Animation binding**: spinY/spinX/pulse/bob driven by a config key.
- **Ports editor** (type/direction/offset, shown as dots in preview).
- **Config & Parameters schema editors**; **States editor** (custom state machine with severities).
- **Beacon** toggle + offset.
- **Import / Export** a component as JSON (top bar).
- **Save** with a **copy‑vs‑update choice** when editing an existing type — *Update existing* (changes every placed instance, shows count affected) or *Save as a new copy* (preserves the original).
- **Save & add to scene**.
- **Bruce assistant docked right** (component context) to edit the component conversationally.
- **Cancel returns to where you came from** (e.g. the component Details page, not the shopfloor).

## 13. Sub‑components & Component Details view

- **Declarative sub‑assemblies** for built‑ins (e.g. a Reduction Pot's 40 anodes + 76 windows) — count + layout (doubleRow/perimeter/grid/ring/skirtSlits) + per‑instance parameter/state schema; derived values with **sparse per‑instance overrides**.
- **Component Details ("View more")** — immersive screen: rotating 3D model + **structure tree** + parameters + trend chart.
- **Structure tree** shows the full nested hierarchy — sub‑assemblies expand into individual instances (Anode 1…40), and **custom components show their parts tree** (matches the Studio).
- **Select a part / sub‑instance → highlights it** in the 3D model (accent glow; auto‑rotate pauses).
- **Per‑instance editing** (build mode) — set an individual anode's parameters/state (writes a sparse override).
- **Trend chart** (Highcharts) — e.g. Anode Current vs Age, **coloured by state**, with a **min‑healthy threshold band**; truncates at the selected ("now") point; click a node to highlight.
- **"Build" / "Edit"** from Details → opens the Studio.
- **← Back** to the scene.
- **Literal‑parts copies**: building a copy explodes sub‑assemblies into individual, editable parts grouped under "Anodes" / "Shell Windows."

## 14. Bruce AI assistant

- **Embedded chat** (per‑project, persisted), powered by the user's own model/API key (Anthropic / OpenAI / Gemini); settings modal.
- **Context‑aware** — same thread, but capabilities switch by surface (header chip shows **Scene · project** vs **Component · name**):
  - **Scene**: generate / manipulate / demo‑data / create‑component.
  - **Component (Studio)**: edit *this* component only; politely declines plant requests.
- **Modes**:
  - **Generate** a full scene (Twin Spec) from a brief.
  - **Manipulate** — incremental scene edits (add/move/connect/configure/rename/group/duplicate/delete…).
  - **Demo data** — fill realistic values/states.
  - **Create component** — design a custom component (from the scene it's created **and placed**; offers "refine in Studio").
  - **Edit component** — incremental component edits (add/remove/resize parts, `add_repeated` rows, ports, params, states) on the open draft.
  - **Clarify** — asks a few high‑impact questions first when a request is underspecified.
- **Skill‑driven & standards‑based** — shared conventions (ISA‑95/UNS, units, telemetry cadence, ISA‑18.2 severities, ISA‑101 colours) injected into every prompt for **uniform output across any industry**.
- **Context‑aware suggestion chips** + input placeholder; **starter prompt seeding** from the Components modal.
- **Floating "Bruce Insight" card** on the 3D plane (view mode, collapsible) — operator recommendations:
  - **Shopfloor**: plant‑wide (anode‑effect breaking, alumina/AlF₃ flow, anode‑change scheduling, silo refills), with "See in 3D" to frame the asset.
  - **Component**: per‑pot recommendations aligned to its state.
- **Tolerant JSON parsing** + one corrective retry; per‑command error reporting.

## 15. Shared component library (cloud)

- **Auto‑publish** every component saved in the Studio to the org's IOsense insight (tagged `component`, superseded by stable key).
- **Pull** all shared components on connect → **merged into the asset library** for every project/user.
- **Offline‑first** — persisted locally; publishes on reconnect.
- **Remove** a component (hides all its cloud versions).
- Components are **excluded from per‑project snapshots** (synced separately, no duplication).

## 16. Cloud sync (IOsense) & data

- **Connect IOsense account** (SSO token / PAT); fetch user meta + insights.
- **Cloud push/pull projects** — newest‑doc‑per‑key supersede model; add‑only pull; never clobbers local.
- **Deleted‑keys** tracking so removed projects/components stay hidden.
- **UNS live‑data binding** scaffold (per‑parameter `topic`; resolveAndCompute host config) — simulator won't overwrite UNS‑bound values.

## 17. Import / Export

- **Export scene** as Twin Spec JSON (top bar).
- **Import scene** JSON (replaces current scene, tolerant‑validated).
- **Export / Import component** JSON (Studio + Components modal).

## 18. Templates

- **Starter layouts** (e.g. Anode Potline, beverage lines) — load fresh (with confirm if replacing a non‑empty scene); open in view mode.

## 19. Layers

- **Named layers** (equipment / conveyors / piping / structural / annotations).
- **Toggle visibility** and **lock** per layer; active‑layer highlight.

## 20. Rendering & visual system

- **Procedural geometry only** (no external models); PBR `meshStandardMaterial`; stainless‑steel house values.
- **Bloom + SMAA** post‑processing (emissive bath/lights only).
- **Logarithmic depth buffer + tuned near/far + polygon offset** to eliminate z‑fighting/flicker.
- **Apple‑minimal UI** — design tokens (fonts, colours, radii, glass, shadows); accent blue; status colours.
- **Real 3D thumbnails** on home + template picker.

## 21. Resilience

- **App‑level error boundary** — any render crash shows a "Something went wrong / Reload / Reset & reload" screen (never a blank), with an option to clear local data.
- **Stale‑module auto‑recovery** — detects chunk/module load failures and force‑reloads once (cache‑busting), with a loop guard.
- **Scene error boundary** around the 3D subtree.
- **Versioned persistence + migrations** for scene, projects, AI settings, and the component library.

## 22. Keyboard shortcuts (reference)

| Action | Key |
|---|---|
| Command palette | ⌘/Ctrl + K |
| Shortcuts overlay | ? |
| Undo / Redo | ⌘/Ctrl + Z / ⌘/Ctrl + ⇧Z (or Ctrl+Y) |
| Copy / Paste (asset or group) | ⌘/Ctrl + C / V |
| Duplicate | ⌘/Ctrl + D |
| Delete | Del / Backspace |
| Move gizmo / Rotate / Scale | G / R / S |
| Frame selected | F |
| Nudge (X/Z) | Arrows (Shift coarse, Alt fine) |
| Nudge (Y) | ⌘/Ctrl + ↑ / ↓ |
| Rotate | [ / ] (Shift = 45°) |
| Scale | - / = (Shift = 0.25) |
| Deselect / close | Esc |
| Studio: nudge/Y/delete/deselect | Arrows · PageUp/Down · Del · Esc |

---

*Generated as an inventory of current behaviour. The catalog of built‑in asset types and exact parameter sets live in `src/lib/*Schemas.js` and `skills/digital-twin-generate.md`; the AI's authoring rules live in `skills/`.*
