# Blackridge Coal — Management Dashboard · Full Design Context

A complete end-to-end spec of the current dashboard (structure, every tab, every KPI with its formula/unit/target, every filter, and every interaction) — written so a design AI can propose a visual overhaul without seeing the code. **Goal of the overhaul:** keep all functionality and data, elevate the visual design/UX. It is a **light-mode, management-level** analytics dashboard for an opencast coal mine + coal-handling & preparation plant (CHPP).

---

## 1. Product, audience, tech

- **Domain:** "Blackridge Coal" — an opencast coal mine (OC) and a CHPP plant. Management overview, not an operator tool.
- **Audience:** mine/plant management. Answers: are we hitting the plan, operating efficiently, using equipment well, safe, and is anything about to fail?
- **Stack:** React + Vite. Charts via **Highcharts** (wrapped by the `@faclon-labs/design-sdk` — LineChart, ColumnChart, HorizontalGroupBarChart). All UI uses the **Faclon design-sdk** components + CSS tokens. **Light mode only.** Currency **₹** (INR).
- **Data:** 100% deterministic **mock** (seeded), no live IoT, not correlated to any digital twin. Values are coherent (a rough day lowers output, raises downtime + intensities together).
- **Persistence:** localStorage (zustand) for the operational plan, borehole strata, safety actions, and equipment assignments.

### Design tokens currently in use (the redesign should keep this token vocabulary)
- **Surfaces:** `--background-surface-intense` (cards), `--background-surface-moderate` (page), `--background-surface-subtle` (rows/wells).
- **Semantic fills:** `--background-positive/warning/error/info/brand-default` (+ `…-secondary` tints).
- **Text:** `--text-gray-primary/secondary/tertiary`; `--text-positive/warning/error/brand-default`.
- **Borders:** `--border-gray-subtle` / `--border-gray-default`. **Radius:** `--global-border-radius-medium/large/max`. **Shadow:** `--fds-shadow-xs/sm/md/lg`.
- **Type ramp (class names):** `DisplayMediumSemibold`, `HeadingLarge/Medium/SmallSemibold`, `BodyLarge/Medium/Small/XSmall` in `Regular`/`Semibold`.
- **Status colour convention:** green = positive/on-target, amber = warning/watch, red = critical/off-target, grey = neutral. Colour is used **only to convey state**.
- **KPI tile pattern (`KpiStat`):** bordered card (`--background-surface-intense`, 1px `--border-gray-subtle`, large radius); label (Body Small, grey-secondary) + optional ⓘ tooltip; big value (Heading Large) coloured by status; "Target X" line + a signed variance **Badge**; optional clickable → arrow.

### Layout / chrome (fixed)
- **Header bar (does not scroll):** a **Global Controls** row + a **tab nav** (custom underline tabs). Below: the single scroll container renders only the active tab; content is max-width ~1320px, centred, generous padding.
- **Floating "Ask Bruce" AI assistant** pill, bottom-right, on every tab (see §4).

---

## 2. Global Controls (top toolbar — applies to all tabs except Depth Profile)

Left→right:
1. **Date range** — preset buttons: `Today · This Shift · Yesterday · Last 7 Days · Last 30 Days · This Month`, plus a **custom date-range picker** (opens a calendar popover). Selected preset is highlighted. Everything recomputes on change.
2. **Mine filter** (dropdown): `All Operations · Blackridge Opencast · Mine · Blackridge CHPP · Plant`.
3. **Area filter** (dropdown): `All Areas · Pit · Drill & Blast · Excavation & Loading · Haulage · Crushing · Washery · CHPP · Stockyard & Dispatch`. Area/Equipment options auto-filter to the chosen Mine's side (mine vs plant).
4. **Equipment filter** (dropdown): `All Equipment · Blast-Hole Drill · Shovel / Excavator · Wheel Loader · Haul Truck · Crusher · Conveyor · Screen`.
5. **Shift-wise toggle** (switch): when ON, KPIs add a Shift 1 / Shift 2 breakdown.
6. **🗓 Plan** button (right) → opens **Plan Management** drawer (see §5). Shows "— set up" until a plan exists.

Tokens: the toolbar is a light `--background-surface-intense` strip; filters are pill-style bordered dropdowns; dropdown menus portal above content.

**Tab nav (7 tabs):** `Production · Efficiency & Cost · Equipment & Downtime · Equipment & Resources · Predictive Maintenance · Safety · Depth Profile`.

---

## 3. Tabs — every KPI, chart and interaction

### TAB 1 — Production Performance
*"Are we achieving our production target, and if not, why?"*
- **Hero panel — Production Plan vs Actual:** a big **achievement %** (Display Medium, status-coloured) + a status badge; "X T actual of Y T planned"; three hero stats **Expected / Actual / Gap (T)**. Requires a plan; otherwise shows an **empty state** ("Add an operational plan to see Plan vs Actual", button opens Plan Management).
- **Bruce Insight strip** (below hero): one live AI line explaining the shortfall cause, with a **"Show numbers"** toggle that reveals the **loss-by-cause** breakdown — a segmented bar + chips: *Equipment Downtime / Low Throughput / Other Operational Loss* (each with tonnes + %), reconciled to sum to the Gap. Plus **"Ask Bruce →"**.
- **Secondary KPI tiles (3):**
  - **Throughput** = saleable tonnes ÷ operating hours — unit **T/hr**, target from plan.
  - **Coal Yield / Recovery** = saleable ÷ raw × 100 — unit **%** (no target; higher is better; status by absolute band).
  - **Operating Cost / Ton** = measurable operating cost ÷ saleable — unit **₹/T**; **clickable → jumps to Efficiency & Cost**.
- **Shift breakdown** (when shift toggle on): small table — Shift · Actual · Throughput · Yield · Cost/T.
- **Chart — "Production vs Plan":** ColumnChart, Actual vs Planned per day (or Shift 1/Shift 2 stacked in shift mode), plan/day dashed line.

### TAB 2 — Efficiency & Cost
*"Are we operating efficiently and within the expected cost?"*
- **Bruce Insight strip** (cost/efficiency driver).
- **KPI tiles (4):**
  - **Cost Variance** — signed % vs planned cost/ton; badge "Under/On/Over budget"; sub "₹X/T actual vs ₹Y/T planned"; a **"⤢ Daily cost table"** button → **modal**.
  - **Energy / Ton** = kWh ÷ saleable — **kWh/T**, target from plan.
  - **Fuel / Ton** = litres ÷ saleable — **L/T**, target from plan.
  - **Man-Hours / Ton** = man-hours ÷ saleable — **mh/T** (labour intensity, lower better), target from plan.
- **Shift breakdown table** (shift mode): Cost/T · Energy/T · Fuel/T · Man-Hrs/T.
- **Chart — "Energy, Fuel & Labour Intensity vs Target":** LineChart, 3 series on 3 y-axes (kWh/T, L/T, mh/T) each with a dashed target line.
- **Daily cost table modal:** columns **Operating Cost (₹) · Ton · Energy (kWh) · Man-Hours · Fuel Cost (₹)**, one row/day + Total; in shift mode a **two-level grouped header** (Day | Shift 1 [5 metrics] | Shift 2 [5 metrics]); **"⬇ Export to Excel"** (mirrors the on-screen layout).

### TAB 3 — Equipment & Downtime
*"How effectively are machines operating, and where are we losing time?"*
- **Bruce Insight strip** (downtime driver).
- **Headline KPIs (3):** **Equipment Utilisation %** (running ÷ planned time), **Total Downtime (h)** (units·days; shift chips in shift mode), **Production lost to downtime (T)**.
- **Chart — Utilisation by Equipment Type** (ColumnChart, %, with a fleet-mean dashed line, data labels).
- **Downtime by Reason** (HorizontalGroupBarChart, hours, largest-first: Mechanical / Electrical / Planned Maintenance / No Feed / Operational / Other) **+ Top Equipment by Downtime** (a ranked list with mini bars).
- **Crusher Performance group (3 KPIs + trend):**
  - **Crusher Reduction Ratio** = Avg Feed Size ÷ Avg Product Size — unit `:1`, target 7.
  - **Crusher Power / Ton** = Crusher Energy (kWh) ÷ Coal Processed (T) — `kWh/T`, target 0.6.
  - **Crusher Feed Rate** = Coal Fed (T) ÷ Operating Hours — `T/hr`, target 1000.
  - Dual-axis trend (Feed Rate + Power/Ton vs target). All KPIs have ⓘ formula tooltips.
- **Conveyor Belt group:**
  - **Belt Loading** = Actual Throughput ÷ Rated Capacity × 100 — `%`, target 85.
  - **Belt Speed Deviation** = (Actual − Target Speed) ÷ Target Speed × 100 — `%`, target 0 (±2% on-spec).
  - **Active Belt Anomalies** count.
  - Dual-axis trend (Loading + Speed Deviation).
  - **Vision-Based Belt Anomalies** panel: list of detected events (Belt Tear / Foreign Object / Material Spillage / Misalignment) with **camera thumbnail, severity badge, timestamp, camera id, Active flag**; **row click → modal** with the enlarged camera frame + metadata.
- **Thickener group:**
  - **Underflow Density** = Solids Mass ÷ Total Underflow Slurry Mass × 100 — `%`, target 60.
  - **Overflow Turbidity** = current NTU vs configured target — `NTU`, target 30 (lower better).
  - Dual-axis trend (Density + Turbidity).

### TAB 4 — Equipment & Resources
*"Is our equipment available, effective, scheduled and healthy?"* (single scrolling page + a right-side drill-down drawer)
- **Equipment Overview** — 7 KPI tiles: **Total Equipment · Running · Idle · Breakdown · Under Maintenance · Overall Utilisation % · Overall Availability %** (availability = not-broken-not-in-maintenance share).
- **Equipment at Risk** — a compact ranked list (worst first): rank · ID + type · status pill · one-line reason (breakdown / critical PDM fault / low health) · health score. Rows click → drawer.
- **Equipment Monitor** — a **resource-type dropdown** (All / Excavators / Dump Trucks / Drilling Rigs / Wheel Loaders / Crushers / Conveyors / Screens / Thickeners) + a table: **Equipment (ID+type) · Status · Utilisation · Downtime · Health · Current job/activity**. Row click → drawer.
- **Equipment Assignment (interactive)** — every operational job as a card: **priority badge (P1/P2/P3), title, job id, required equipment type, time window**, and an **assign picker** (dropdown of candidate units; Available/idle selectable, **Breakdown/Under-Maintenance disabled**, "— Unassign —" option). Problem cards are red-outlined and badged **Conflict / Unit unavailable / Unassigned**. Header shows "N jobs · M need attention". Assignments persist.
- **Equipment Conflicts** — list of double-bookings (same unit, overlapping windows) with the overlap window.
- **Planned Downtime** — read-only list: unit + type · **One-time/Recurring** badge · reason · date-time window (or recurrence cadence).
- **Drill-down drawer** (right side, on any equipment): header (ID, type · area, status); metric row **Status · Current job/activity · Next available · Utilisation · Operating hours · Downtime · Fuel consumption · Health score**; **Sensors & Predictive Maintenance** block (vibration/temperature/current with **sparkline trends**, value vs normal range, state badge; a diagnosed **fault + faultType + recommendation** banner when abnormal; "health lowered by…" contributors); **Equipment Timeline** (proportional status segments Running→Idle→Breakdown, hover → start/end/duration, legend); **Upcoming Schedule** (+ next-available); **Planned Downtime** for the unit.

### TAB 5 — Predictive Maintenance
*"Which assets need attention right now?"* — an **action list**, not a score.
- **Bruce Insight strip** (top asset risk).
- **Count tiles (3):** **Critical · Warning · Normal**.
- **Filters:** severity dropdown (All/Critical/Warning) + fault-type dropdown (All + derived fault types: Mechanical/Hydraulic/Thermal/Electrical…).
- **Alert list** (worst first): each asset with severity badge, health, diagnosed fault. **Click → drawer**: **Detect → Explain → Recommend → Act** — the abnormal sensors (with a sensor-trend LineChart), the grouped fault + evidence, and a recommendation.

### TAB 6 — Safety
*"Are operations safe and compliant?"* — **evidence-first**.
- **Bruce Insight strip** (violation driver).
- **Filters:** category chips (All / PPE / Restricted Area / Vehicle Safety / Other) that filter the whole tab; an **"Open only"** toggle.
- **Compact KPI row:** **Safety Compliance %** (= (checks − violations)/checks × 100) · **Violations** (+ checks) · **High/Critical** (in evidence) · **Actions raised**.
- **Safety Evidence Log (hero):** a table — **Date & time · Evidence (CV thumbnail) · Description (+ category badge, severity dot, location · camera) · Action**. Each row is a real violation (e.g. "Personnel crossing haul-road danger zone", "Missing hard hat near crusher"). The Action cell shows **"Raise action"** (→ modal: enlarged frame + metadata + a form: Assign to / Priority / Note) or a green **"✓ Action raised"** with assignee. Actions persist.
- **Analytics strip (demoted):** **Compliance Trend** (LineChart, %/day) + **Violations by Category** (HorizontalGroupBarChart).

### TAB 7 — Depth Profile  *(self-contained; ignores the global date range/filters)*
Drilling analytics with **3 sub-tabs**:
1. **Depth Profile** — a **multi-select borehole dropdown** + an **axis dropdown** (Depth vs Time / Depth vs Diesel / **Both** = one chart, dual x-axis: Time bottom + Diesel top). Custom SVG curve: **depth increases downward** (steep = drilling fast, flat = stalled); each borehole a coloured curve; **interactive legend** (click to hide a line) + **hover tooltips** (borehole, depth, x-value). Below the chart, two KPIs: **Fastest drilling · ROP (m/h)** = total depth ÷ drilling time, and **Most fuel-efficient · Fuel Intensity (L/m)** = diesel ÷ depth — each naming the winning hole.
2. **Formation** — pick one borehole → a **to-scale stratigraphic column** (rock colours + textures + depth ticks), a **per-layer metrics table** (ROP · Fuel/m · RPM · SPP · Hook load · Hours · ₹/m), a **roll-up strip** (depth · overall ROP · diesel · fuel cost), a **depth-vs-time curve banded by formation** (flattens in hard rock), a **reliability guard** (hides per-layer numbers when survey depth disagrees with recorded depth), and a **"Manage strata →"** link (strata are edited in Plan Management, manual or Excel).
3. **Predict** — build a planned column (rock + thickness rows) → **"Predict with Bruce"** → forecast **depth · time · diesel · ₹ · ROP · L/m** + per-layer table + rationale + predicted curve (falls back to a local estimate if the agent is offline).

---

## 4. Bruce — the embedded AI assistant (cross-cutting)
- **Floating "Ask Bruce"** pill (bottom-right) → a chat panel (gradient purple header, Bruce logo, reset ↺, minimise). Every user question is sent to an IOsense agent **with a live data-context** built from exactly what's on screen (respects filters/range), so answers cite the real numbers. Replies render **markdown + charts (```chart JSON) + diagrams (```mermaid)**. Suggested-prompt chips on first open.
- **Inline "Bruce Insight" strips** at the top of Production, Efficiency, Equipment, Predictive and Safety: one live, specific, cause-first sentence (e.g. "Mechanical breakdowns on HT-04 & CR-01 drove most of the 8,624 T miss — availability, not processing"), with **"Ask Bruce →"** escalation and (on Production) a "Show numbers" reveal.
- Visual identity: a purple gradient (`#a779f0→#5b5bf0`) + a small Bruce logo mark. This is the one place with a brand-colour accent distinct from the status palette.

## 5. Plan Management drawer (🗓 Plan)
A right-side drawer with a two-way switch: **Operational Plan** | **Borehole Strata**.
- **Operational Plan:** *Upload Plan* (download an `.xlsx` template → upload → validated preview with red-flagged cells → import) or *Add Manually* (Monthly/Daily/Shift-wise grid). Columns: Date/Period, Shift, Planned Coal Production, Planned Overburden, Cost Energy/Ton, Cost Fuel/Ton, Cost Manpower Productivity. The active plan drives **all Plan-vs-Actual** comparisons and the efficiency targets. Shows an active-plan summary + clear.
- **Borehole Strata:** *Add Manually* (pick borehole → edit rock/thickness rows, survey-vs-recorded reconciliation) or *Upload Strata* (Borehole · Rock · Thickness template). Feeds the Depth Profile · Formation view.

There is **no Settings panel** — cost rates are internal config; planned values come from the plan.

---

## 6. Current visual character & overhaul opportunities
- **Now:** clean, flat, light, tokenised; bordered white cards on a light-grey page; restrained colour (status-only) with the single purple Bruce accent; Highcharts default look; custom underline tabs; drawers/modals for depth. Functional but fairly generic/"admin".
- **Likely overhaul goals to brief the AI:** stronger visual hierarchy and a distinctive but professional identity; a cohesive KPI-card system (states, sparklines, deltas); better chart styling consistent with the brand; clearer "hero → detail" rhythm per tab; a refined data-table style (used a lot); consistent iconography; a considered light **and** optional dark theme; density/spacing scale; motion for drill-downs. Constraints to preserve: **light-mode-first, Faclon design-sdk tokens/components + Highcharts, ₹, all existing KPIs/filters/interactions, and the Bruce purple accent.**

## 8. The "why" — purpose + visualisation of every KPI & feature
*(For each item: **[viz]** = how it's shown, then **why it exists**. Default KPI viz = a bordered number **tile** with a status-coloured value + "Target X" + a signed variance badge + optional ⓘ formula tooltip.)*

**Global filters**
- **Date range** *(pill buttons + calendar popover)* — management reviews different windows (today/shift/period); all KPIs recompute for the chosen window.
- **Mine / Area / Equipment** *(dropdowns)* — scope the whole dashboard to a mine vs plant / a specific area / an equipment class to isolate a problem.
- **Shift-wise toggle** *(switch → adds Shift 1/2 columns)* — the mine runs two shifts; managers compare shift performance.
- **🗓 Plan** *(drawer)* — the operational plan is the source of truth for every target; without it there is no "vs plan".

**Bruce (AI)**
- **Floating chat** *(panel; markdown + rendered charts/diagrams)* — ask anything about the on-screen data and get cause/analysis without digging.
- **Inline insight strips** *(one-line strip, logo + severity dot + "Ask Bruce →")* — deliver the "so what / why" at the top of a tab so managers don't have to infer it from the numbers.

**Production Performance** — *are we hitting plan, and why not?*
- **Achievement %** *(giant number + badge + Expected/Actual/Gap stats)* — the headline plan-attainment number; the Gap quantifies the miss.
- **Loss-by-cause** *(segmented bar + chips, behind "Show numbers")* — attributes the Gap to Equipment Downtime / Low Throughput / Other so you know what to fix.
- **Throughput** *(tile)* — processing rate (T/hr) vs the rate needed to hit plan.
- **Coal Yield / Recovery** *(tile)* — % of raw that becomes saleable → product loss / plant efficiency.
- **Operating Cost / Ton** *(clickable tile → Efficiency)* — unit economics; entry point to cost detail.
- **Production vs Plan** *(grouped/stacked column, per day)* — shows which days drove the shortfall.

**Efficiency & Cost** — *are we efficient and on budget?*
- **Cost Variance** *(tile, signed %)* — within budget per ton or not.
- **Energy/Ton · Fuel/Ton · Man-Hours/Ton** *(tiles)* — the three cost drivers as intensities (electricity, diesel, labour) vs target — where inefficiency hides.
- **Intensity trend** *(multi-axis line + target lines)* — drift of the three intensities over time.
- **Daily cost table** *(modal table + shift-grouped header + Excel export)* — the ₹ breakdown behind the KPIs, exportable for finance.

**Equipment & Downtime** — *how well are machines used; where is time lost?*
- **Utilisation %** *(tile)* — running vs planned time. **Total Downtime / Production lost to downtime** *(tiles)* — lost hours and their tonnage cost.
- **Utilisation by type** *(column + fleet-mean line)* — which classes underperform. **Downtime by reason** *(horizontal bar)* — biggest time-loss causes. **Top equipment by downtime** *(ranked mini-bars)* — worst individual units.
- **Crusher Reduction Ratio / Power-per-Ton / Feed Rate** *(tiles + dual-axis trend)* — crushing effectiveness, energy efficiency and throughput of the primary crusher.
- **Belt Loading / Speed Deviation / Active Anomalies** *(tiles + dual-axis trend)* — is the conveyor running full, at the right speed, and issue-free.
- **Vision-Based Belt Anomalies** *(evidence table + image modal)* — CV early-warning of tears/foreign objects/spillage/misalignment before a failure.
- **Underflow Density / Overflow Turbidity** *(tiles + dual-axis trend)* — thickener dewatering performance and recycle-water clarity (compliance).

**Equipment & Resources** — *is equipment available, effective, scheduled, healthy?*
- **Overview tiles** (Total/Running/Idle/Breakdown/Under-Maintenance/Utilisation/Availability) — at-a-glance operational readiness (how much of the fleet is usable now).
- **Equipment at Risk** *(ranked list)* — management triage: what needs attention first, and why.
- **Equipment Monitor** *(table + type filter)* — every unit's status/util/downtime/health/current-job in one place.
- **Drill-down drawer** *(drawer: metrics + sensor sparklines + status timeline + schedule + downtime)* — the full per-unit picture to make a call.
- **Equipment Assignment** *(job cards + assign pickers, red-flagged problems)* — allocate equipment to jobs and expose gaps. **Conflicts** *(list)* — catch double-bookings before delays. **Planned Downtime** *(list)* — scheduled maintenance that removes units from availability.

**Predictive Maintenance** — *what's about to fail?*
- **Critical/Warning/Normal** *(count tiles)* — asset-risk posture.
- **Alert list → drawer** *(card list; drawer = Detect → Explain → Recommend, with a sensor-trend line chart + abnormal-sensor chips)* — catch failures early with cause + recommended action; the chips are the evidence. **Severity/fault-type filters** *(dropdowns)* — focus the list.

**Safety** — *are we safe & compliant?*
- **Compliance %** *(tile)* — adherence vs target. **Violations / High-Critical / Actions raised** *(tiles)* — scale, severity and follow-through.
- **Safety Evidence Log** *(table with CV thumbnails, severity, Raise-action)* — evidence-first: each violation is a concrete, actionable CV-detected event, not a bare count. **Raise-action modal** *(enlarged frame + assign form)* — accountability + closure tracking. **Compliance trend + Violations by category** *(line + horizontal bar)* — are we improving; what dominates.

**Depth Profile** — *how were boreholes drilled; forecast the next?*
- **Depth-vs-time/diesel curves** *(custom SVG, depth increasing downward, interactive legend + hover, dual x-axis for "Both")* — compare drilling speed and fuel use; steep = fast, flat = stalled. **ROP + Fuel Intensity** *(tiles)* — flag the fastest and most fuel-efficient hole.
- **Formation** *(to-scale strata column + per-layer table + formation-banded curve; reliability guard)* — see which rock strata eat time/fuel/₹; hides numbers it can't trust.
- **Predict** *(planned-column form → forecast tiles/table/curve, Bruce-powered)* — forecast a new hole's time/fuel/cost from planned geology.

**Plan Management** — **Operational plan** defines the targets the whole dashboard compares against; **Borehole strata** provides the geology behind the Formation view. Both support Excel upload + manual entry.

---

## 7. Screens to capture (shot list, in order)
Production (with a plan loaded, Last 30 Days) · same with Shift-wise ON · the Bruce Insight "Show numbers" expanded · Efficiency & Cost · the Daily-cost-table modal (normal + shift-grouped) · Equipment & Downtime (Crusher, Conveyor incl. the belt-anomaly panel + its modal, Thickener) · Equipment & Resources (overview, at-risk, monitor, an open drill-down drawer, the assignment picker open, conflicts, planned downtime) · Predictive (list + an alert drawer) · Safety (evidence log + the raise-action modal) · Depth Profile (all three sub-tabs, dual-axis "Both" chart, formation column) · the Bruce chat panel open · the Plan Management drawer (both panels) · the global toolbar with a filter dropdown open.
