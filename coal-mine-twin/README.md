# Blackridge Coal Mine — Pit-to-Port Digital Twin

A complete digital twin of the coal mining process flow (upstream mine operations →
processing plant → downstream logistics & shipping), authored with the Digital Twin
skill pipeline: **PLAN → CREATE COMPONENT → GENERATE**.

## Contents

| File | Pipeline stage | What it is |
|---|---|---|
| `01-plan.json` | PLAN | Architecture summary + component manifest (each type tagged catalog/new, hero/auxiliary) |
| `02-components/*.json` | CREATE COMPONENT | 17 reusable Component Specs (register each with `addCustomAssetType(spec)`) |
| `03-twin-spec.json` | GENERATE | The full Twin Spec (load with `loadScene(spec)`) |

## Load order

1. Register every component in `02-components/` via `addCustomAssetType(spec)`.
   The Twin Spec references them by **type id = file name without `.json`**
   (`mining_excavator`, `haul_truck`, `primary_crusher`, …). If your registry
   assigns different ids, remap the `type` fields in `03-twin-spec.json` accordingly.
2. Load `03-twin-spec.json` with `loadScene(spec)`.

## Process-flow coverage (all 16 stations of the reference diagram)

- **1–6 Mine Operations** — exploration rig, blast-hole drill, excavators EX-01
  (overburden) / EX-02 (coal), wheel loader, 3-truck haul fleet. Mobile plant, so
  no fixed connectors — material reaches the crusher by truck.
- **7–12 Processing Plant** — connected chain: Primary Crusher CR-01 →
  Overland Conveyor CV-01 (catalog `ConveyorBelt`) → Sizing Screen SC-01 →
  CHPP Module 1 (dense-media cyclone) → Stacker-Reclaimer SR-01 → stockpiles.
  Dewatering via Tailings Thickener TH-01 with a **closed water circuit**:
  CHPP effluent → thickener (slurry, `#6b7280`), overflow → recycle pump → CHPP
  (`#8fcf7a`), make-up tank → valve → pump → CHPP (`#8fcf7a`), underflow →
  tailings header (`#6b7280`).
- **13–14 Rail** — Train Load-Out TLO-01 over a rake (loco DL-401 + 4 hopper wagons).
- **14A–15 Port (OR branch)** — yard conveyor → Shiploader SL-01 → berthed bulk
  carrier MV Blackridge Trader.
- **16 Customer / End Use** — representative Westport Power Station (structural).

## Conventions applied

- **ISA-95/UNS tree** — Site → Area → Cell → Asset; nothing at the root. Topics
  derive from the path, e.g. `blackridge_coal_mine/processing_plant_(chpp)/washing_&_dewatering/chpp_module_1_(dmc)/yield`.
- **Telemetry** — SI units + cadence per signal physics (`5s` rates/currents,
  `30s` temperatures, `5m` quality, `15m` consumables, `manual` for lab values like
  stockpile moisture and crusher CSS). Values varied across siblings.
- **KPIs** — each area group aggregates its members (fleet payload, plant feed,
  yield, ash, stock on ground, loading rates, generation).
- **States (ISA-18.2)** — ok/warn/down severities per component; scene loads with
  everything running (calm HMI). HT-03's low fuel (12 %) trips its amber rule —
  the one staged abnormality.
- **Rules** — truck fuel < 15 % (amber), crusher bearing > 85 °C (red),
  thickener rake torque > 70 % (amber), product ash > 12 % (amber).
- **Tooltips** — hero machines only: excavators, HT-01, crusher, CHPP module,
  thickener, stacker-reclaimer, load-out, shiploader.
- **Motion** — every powered component has ≥1 animated part (spinning wheels,
  flywheels, drill strings, rakes, bucket wheel; bobbing screen deck and chute;
  pulsing beacons; rising smoke/steam plumes) plus flowing pipe/conveyor connectors.

## Deliberate scope notes

- No `topic` bindings and **no insight IDs anywhere** — the twin is fully
  self-contained demo data; bind live sources later if needed.
- Mobile assets (trucks, excavators, drills, train, ship) have no ports by design;
  the CHPP `reject_out` port is intentionally left unwired (reject bin off-scene).
- Nothing has been committed to git — all files are uncommitted working-tree
  additions.
