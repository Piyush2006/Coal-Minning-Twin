# Blackridge Coal — Management Dashboard · Handover

A conference-grade operations dashboard for a coal mining + CHPP (Coal Handling &
Preparation Plant) operation. It is a self-contained React surface that ships
**inside the 3D Digital Twin app** and is reached at the hash route
**`#/dashboard`** (lazy-loaded — nothing in it loads for normal twin users).

---

## 1. Run & build

All commands from the app root (`app/`):

```bash
# dev server (used throughout the build; port is arbitrary)
node node_modules/vite/bin/vite.js --port 5420 --strictPort --host
#   → open  http://localhost:5420/#/dashboard

# production build / compile check
node node_modules/vite/bin/vite.js build
```

- **Stack:** React 18 + Vite. State via **zustand** (with `persist`). Charts via
  **Highcharts 13** (`highcharts-react-official`). UI shell from
  **`@faclon-labs/design-sdk` v0.6.7** (Drawer, Button, Dropdown, DatePicker,
  DropdownMenu, TextInput — charts are **not** from the SDK).
- **Fonts (locked):** **Manrope** for headings / numerics / card values
  (weight 700–800, tabular-nums), **Inter** for body / UI / table cells. Loaded
  via Google-Fonts `@import` in `theme.css`.

---

## 2. Where things live (`src/dashboard/`)

```
Dashboard.jsx        # shell: sidebar + top bar + section registry + Bruce chat
theme.css            # design tokens (scoped to .dash-theme) + fonts
store.js             # zustand store (all state + persistence)
sections/            # one file per section (the screens)
components/          # shared UI: primitives, KpiStat, drill modals, drawers, TopBar, Sidebar…
calc/                # pure functions that turn data → metrics (buildX(...))
data/                # synthetic, deterministic source data + domain constants
lib/                 # Bruce AI client/context, Excel parsing, chart theme
```

**Data flow:** `data/*` (deterministic synthetic source) → `calc/*` `buildX({range,
filters,settings})` → section component renders → drill-downs re-slice the same
calc output. There is **no backend**; everything is computed client-side from
seeded generators so the demo is stable and reproducible.

---

## 3. Navigation & sections (in sidebar order)

Left sidebar (collapsible). Each section is registered in `Dashboard.jsx`
`SECTIONS[]` with the business question it answers.

| # | Section | Answers | Sub-tabs |
|---|---------|---------|----------|
| 1 | **Production** | Are we hitting the production target, and if not why? | — |
| 2 | **Efficiency & Cost** | Are we efficient and within cost? | — |
| 3 | **Equipment** | Are machines effective, available, scheduled, healthy? | Performance · Monitor · Scheduling |
| 4 | **Predictive** | Which assets need attention right now? | — |
| 5 | **Safety** | Are operations safe and compliant? | — |
| 6 | **Depth Profile** | How are boreholes drilled — speed, fuel, geology? | Depth Profile · Formation |

The **Predictive** sidebar item shows a subtle red ring / heartbeat when any
Critical PdM alert exists (driven by `buildPdm(...).counts.Critical`).

### 3.1 Production (`sections/ProductionPerformance.jsx`)
Plan-vs-actual coal production, throughput, coal yield, operating cost KPIs +
shift breakdown. KPI tiles drill into the daily **MetricDrillModal**; the hero
plan card drills into **PlanDrillModal** (plan vs actual by day). Monthly plan
model (labels read "Plan · <Month>").

### 3.2 Efficiency & Cost (`sections/Efficiency.jsx`)
Energy intensity, fuel intensity, manpower, cost variance. Small-multiple charts;
KPI drill-downs; the cost table opens **CostTableModal** (per-shift cost grid).

### 3.3 Equipment (`sections/EquipmentHub.jsx`) — 3 sub-tabs
- **Performance** (`EquipmentDowntime.jsx`) — utilisation, availability, top
  equipment by downtime; drills to **UnitsDrill** (ranked units) + the
  **EquipmentDrawer** (per-machine).
- **Monitor** (`EquipmentResources.jsx`) — clickable status strip, collapsible
  "Equipment at Risk", paginated Equipment Monitor table. Row → EquipmentDrawer.
- **Scheduling** (`EquipmentScheduling.jsx`) — the work surface: job assignment
  cards with dropdown filters (job/type/priority), conflicts, planned downtime.
  **Full CRUD** for jobs (**JobFormModal**) and downtime (**DowntimeFormModal**).
  An amber "attention" badge on the sub-tab counts problems.

The **EquipmentDrawer** is the per-machine panel (status/health bands, "at a
glance" wells, Condition + **Sensor data** modal, status timeline, upcoming
schedule, planned downtime).

### 3.4 Predictive (`sections/Predictive.jsx`)
Assets-needing-attention **action list** (not a health score). Clickable
Critical/Warning count tiles filter the list; compact severity + fault-type
dropdowns; each alert opens the **AlertDrawer**: **Detect → Explain → Recommend
→ Act**, with an inline sensor-evidence table and a **"Sensor data"** button
opening the shared **SensorChartModal** (all sensors plotted as % of their own
warning threshold, drag-zoom, interactive legend). Engine: `calc/pdm.js`
`buildPdm(...)`.

### 3.5 Safety (`sections/Safety.jsx`)
Evidence-first. A CV **Safety Evidence Log** is the hero (snapshot + raise-action
CTA per violation), with **Category** and **Status** dropdown filters. Four KPI
tiles; **Compliance** and **Violations** drill into MetricDrillModal (the
Compliance drill also shows the per-shift split). Rows open **EvidenceModal**
(full snapshot + "raise action" workflow; raised actions persist).

### 3.6 Depth Profile (`sections/DepthProfile.jsx`) — 2 sub-tabs
- **Depth Profile** — compare boreholes' drilling curves (depth vs time/diesel).
  With **one** borehole selected the main chart shows the **formation bands**
  overlay + a formation legend (defaults to the latest borehole). KPI tiles
  ("Fastest drilling", "Most fuel-efficient") open a **ranked-borehole modal**.
- **Formation** — one hole's per-layer table (Layer · ROP · Fuel/m · RPM · SPP ·
  Hook · Hours · ₹/m) + header rollups + a "Manage strata" button.

---

## 4. State & persistence (`store.js`)

zustand store `useDash`, persisted under localStorage key
**`blackridge-mgmt-dash`, version 2**.

**Ephemeral (not persisted):** `range`, `mineId`, `areaId`, `equipTypeId`,
`shiftMode`, `tab`, `lastUpdated`, `planOpen`, `planPanel`, `bruceSeed`.

**Persisted (`partialize`):** `settings`, `plan`, `safetyActions`,
`boreholeStrata`, `resourceAssignments`, `jobOverrides`, `downtimeOverrides`.

**CRUD / override pattern:** built-in data arrays are layered with a
`{id: obj|null}` overrides map (`jobOverrides`, `downtimeOverrides`) merged by an
`effectiveX(overrides)` helper — so user-created/edited jobs and downtime flow
through the *same* calc as seeded data (conflict / availability detection applies
automatically). `settings` (cost rates, capacity, thresholds…) come from
`data/settingsDefaults.js` and drive every calc.

---

## 5. Design system & conventions

Tokens live in `theme.css`, scoped to `.dash-theme`. Reusable primitives in
`components/ui.jsx` and `components/primitives.jsx`.

- **KPI tiles:** always `KpiStat` — label + ⓘ tooltip · 27px Manrope value ·
  hairline footer (Target/delta); a `→` affordance + hover lift when clickable.
- **Charts:** always the shared `Chart.jsx` (Highcharts) + global theme in
  `lib/chartTheme.js` (palette `#3E6DF4,#F59E0B,#0E9F6E,#8B5CF6,#E5484D,#98A2B3`,
  dark tooltip pill, thick rounded bars, hidden axis titles).
- **Pills, not design-sdk Badges:** the shared `Pill` (tones positive/warning/
  critical/info/neutral) is the one chip everywhere.
- **Tables:** shared `th()/td()` (uppercase headers) + `usePagination`/`Pager`
  on **every** table (default 10 rows, pager auto-hides ≤10).
- **Controls:** compact; `Dropdown` filters (right-aligned in panel headers),
  `FilterChip`, `Segmented` for sub-tabs. Secondary actions are ghost-pill
  icon+label buttons; toolbar actions are icon-only with `title`.
- **Drill-down language (shared):** `MetricDrill.jsx` (`MetricDrillModal` /
  `PlanDrillModal`), `UnitsDrill.jsx`, `SensorChartModal.jsx`, `EquipmentDrawer`,
  `AlertDrawer` (exported from Predictive), `EvidenceModal`, `CostTableModal`.
- **Portals** (Dropdown/Modal/Drawer bodies) carry `className="dash-theme"` (they
  render outside the themed root); dropdown menu portals sit at **z-index 10500**
  (above the Modal overlay at 10000).
- **Cards** are borderless (shadow-only depth); no cards-inside-cards (detail
  tables become modal/drawer drill-downs); equal card heights per row.

---

## 6. Bruce (AI assistant)

- **`BruceInsight`** — the top "rail" on most sections: a one-line AI summary
  from `lib/bruceContext.js` (`buildBruceContext`) + `lib/bruceClient.js`. Tone
  reflects section status. "Ask Bruce" / "Show numbers" are icon-only.
- **`BruceChat`** — the floating bottom-right assistant; `askBruce(q)` routes a
  question from anywhere (via the `bruceSeed` store slice) into the chat.
- Insights are best-effort: if the Bruce API is unreachable the rail shows
  "Insight unavailable · retry" and the rest of the dashboard is unaffected.

---

## 7. Plan Management (`components/PlanManager.jsx` + `StrataManager.jsx`)

The "Set up plan" drawer (design-sdk Drawer). Two panels via `Segmented`:
- **Operational Plan** — set the monthly production plan by **Excel upload**
  (template download + validated preview) or **manual entry** (level → month
  range → generate rows → fill → save). Parsing in `lib/planParse.js` (SheetJS).
  The active plan drives every Plan-vs-Actual comparison (`calc/plan.js`).
- **Borehole Strata** — per-borehole rock-layer editing (manual add/remove or
  Excel import via `lib/strataParse.js`); feeds Depth Profile.

Both tables use shared `th/td` + pagination; Required/Optional shown as Pills.

---

## 8. Digital-twin integration (Predictive Maintenance)

The dashboard's PdM engine is surfaced **inside the 3D twin**:
- `src/lib/pdmBridge.jsx` maps twin machine ids → dashboard asset ids (static
  plant only: drills BD-01..03, excavators EX-01/02, crusher CR-01, screen
  SC-01) and re-runs `buildPdm(...)` against the persisted dashboard state.
- `components/PdmBadgeLayer.jsx` floats a wrench badge over any flagged machine
  (amber Warning / red Critical, constant screen size).
- Clicking a badge opens the dashboard's **`AlertDrawer`** over the twin
  (`components/PdmDrawerHost.jsx` imports `theme.css` + the exported drawer).
- The tour's **Predictive Maintenance** beat auto-opens this drawer.

So the twin and dashboard share one PdM source of truth — what's Critical on the
Predictive tab is exactly what's badged in 3D.

---

## 9. Extending it (common tasks)

- **New KPI drill-down:** feed the existing `MetricDrillModal` with
  `categories`/`values` from the relevant `calc/*` output — don't build a new
  modal shape.
- **New table:** shared `th()/td()` + `usePagination`/`Pager`. Never render all
  rows.
- **New chart:** `Chart.jsx` only, palette from `chartTheme.js`.
- **New tile:** `KpiStat` (never a bespoke card).
- **New persisted state:** add the slice + action in `store.js`, include it in
  `partialize` **and** `merge`, and **bump `version`** if the shape changes.
- **New CRUD entity:** follow the override-layering pattern (built-in array +
  `{id:obj|null}` overrides + `effectiveX()` through the calc).

---

## 10. Constraints & notes

- **No backend / real telemetry** — all data is deterministic synthetic
  generators (`data/*` + `data/rng.js`). Swapping in live data means replacing
  the `data/*` sources feeding each `calc/*`; the UI layer is agnostic.
- **Light theme only.** No 3D / heavy animation in the dashboard itself.
- **Insight IDs are intentionally never populated** anywhere.
- Charts must re-measure on width change — `Dashboard.jsx` runs a `ResizeObserver`
  that nudges a debounced window-resize so Highcharts reflows on sidebar toggle.
- Verification during the build was compile/build checks + headless click-tests
  (see `scratchpad/*.mjs`) + a 36-config overlap audit; no visual-diff loop.

---

_Sections registry: `Dashboard.jsx` · Store: `store.js` · Tokens: `theme.css`._
