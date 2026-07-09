---
name: digital-twin-demo-data
description: >
  Generate realistic DEMO telemetry for an existing Digital Twin scene — fill in
  values for the parameters the scene already defines, so machine readouts and
  line/group overviews look alive without a real data source. Use when the user
  asks to "add demo data", "populate / fill values", "make it look live", or
  "stage a <scenario>". Pairs with digital-twin-generate (which DEFINES the
  parameters) and digital-twin-manipulate (whose command format this reuses).
version: 1.1
source: src/lib/{parameterSchemas,stateSchemas}.js; see digital-twin-conventions
---

# Digital Twin — Demo Data Skill

You **only assign VALUES** to parameters/states that already exist on the scene's
assets — you do **not** invent new parameters, KPIs, assets, groups or
connections. Parameter definitions are decided by the GENERATE skill (per-asset
`parameters` + per-line `kpis`); line/group KPIs are aggregated automatically from
the machine values you set here, so you never set group values directly.

**Output:** the standard envelope with `mode: "manipulate"` and a command list of
**only** `set_parameter` and `set_state` ops (per the MANIPULATE skill):
```json
{ "mode": "manipulate", "message": "Loaded normal-operations demo data.",
  "commands": [
    { "op": "set_parameter", "id": "pot-A1", "key": "voltage", "value": 4.18 },
    { "op": "set_state", "id": "pot-A7", "state": "anodeEffect" }
  ] }
```

## Rules
- Reference real asset `id`s from the CURRENT SCENE. Only set parameter **keys
  that exist on that asset's type** (catalog in GENERATE, or its custom params) and
  keep every value **in range**.
- **Vary** values across similar assets (each machine slightly different) so
  dashboards and per-line averages look real — never set them all identical.
- Set `state` only to stage a few assets in a non-normal condition (ISA-18.2 — see
  scenarios). Most assets stay normal/`ok`.
- One `set_parameter` per (asset, key). Populate **every** asset.

## Realistic values by SIGNAL TYPE (works for any industry)
Pick by what the value physically is, then keep it in the asset's range:
- **throughput / rate / speed** — near nominal **±5 %** (a line runs at its design rate, with small jitter).
- **temperature** — drifts a few degrees around the process **setpoint**; not random.
- **pressure / level / flow** — mid-band; levels of buffers/silos/tanks **vary widely** across assets (some near-full, maybe one low).
- **vibration / wear** — mostly **low**, with the **occasional** elevated unit (a hint of a developing fault).
- **quality / reject / defects** — **low** (reject < ~2 %, defects in the low ppm); one slightly worse is realistic.
- **consumables (reel/ink/fill %)** — spread across the range so some are due for refill.
- **`manual` / lab params** (e.g. bath/metal temp, assay) — a **believable steady last reading** near setpoint; these are hand-sampled, so don't scatter them.

### Example ranges (illustrative — derive the same way for any asset)
- **ReductionPot** — `voltage` 4.0–4.3, `current` ~595–605 kA (≈line constant), `acd` 26–34, `currentEff` 92–95; `bathTemp` 955–965 & `metalTemp` 945–960 (**manual** — steady).
- **Fillers** — `throughput` near nominal ±5 %, `fillTemp` 6–12, `voltage` ~410–420, `current` 10–16.
- **CheckWeigher/EBI** — `rejectRate` 0.3–2.5, `defects` 50–400. **Pump** — `flowRate`/`pressure` mid, `vibration` low (one elevated). **Tank/Silo** — `level` 20–90 (vary).

## Scenarios (pick from the user's ask; default = "normal")
- **normal** — everything healthy; values comfortably mid-range; all states `ok`.
- **busy / ramp-up** — rates near the top of range; buffers/silos draining (lower levels).
- **upset** — stage a few **ISA-18.2 alarm** conditions: 1–2 assets in a `down` state (e.g. a pot in `anodeEffect`, a machine in `fault`), a buffer/silo `low`, one quality station with high reject. Keep the rest normal.
- **maintenance** — one line/cell `idle`; a service machine in its maintenance state.

## Self-check
- [ ] Output is the envelope with `mode:"manipulate"` and only `set_parameter` / `set_state` commands.
- [ ] Every `id` exists in the current scene; every `key` exists on that asset's type; every value is in range; states are valid for the type.
- [ ] Values are varied across similar assets; no new params/assets/groups/kpis introduced.

---
*Parameter keys/ranges come from `src/lib/parameterSchemas.js`; valid states from `src/lib/stateSchemas.js`. Keep in sync with the catalog in digital-twin-generate.md.*
