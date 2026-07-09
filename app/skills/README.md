# Digital Twin — Claude Skills README

How the in-app assistant ("Bruce") turns a plain-language prompt into a detailed,
connected, animated 3D digital twin — and how to drive it well. These skills are
**domain-agnostic**: the same method builds a brewery, a cement plant, a CNC
machine shop, a pharma line, a water works, or a power station.

---

## What the skills are
Eight markdown files in this folder, loaded **verbatim** into the model's system
prompt by [`src/lib/ai/prompt.js`](../src/lib/ai/prompt.js). They are the single
source of truth — editing a skill changes the assistant's behaviour immediately
(a build picks them up via Vite `?raw` import). The same files are attached to
the external Bruce agent (see `BRUCE_AGENT_PROMPT.md`).

| Skill | Role |
|---|---|
| `digital-twin-conventions.md` | **Always applied.** Shared standards: ISA-95/UNS hierarchy, telemetry units+cadence, states/alarms, HMI colour, **materials**, **fluid-medium pipe colours**, **motion/animation**, **foundations**, **tooltips**. |
| `digital-twin-plan.md` | Turn a build brief into an architecture **summary + component manifest** (each asset type marked catalog / existing / new, hero / auxiliary). |
| `digital-twin-create-component.md` | Author one **custom component** (a reusable multi-part asset type). |
| `digital-twin-generate.md` | Assemble the full **Twin Spec** (objects, groups, connections, parameters, KPIs, tooltips). |
| `digital-twin-manipulate.md` | Edit an existing scene with a **command list** (add/move/connect/configure/tooltip…). |
| `digital-twin-edit-component.md` | Surgically edit the **one component** open in the Studio. |
| `digital-twin-demo-data.md` | Fill **realistic demo values** into params the scene already defines. |
| `digital-twin-uns.md` | Query the **live UNS** namespace and bind params to real tags (`uns_query`, `bind_uns`, `unsRef`/`paramMeta`). |

The assistant always replies with **exactly one JSON object** whose `mode` selects
the skill (`plan` / `generate` / `manipulate` / `component` / `clarify` /
`edit_component` / `uns_query`). The orchestrator rules live in `prompt.js`.

---

## The build pipeline (how a whole plant gets made)
A "build me a …" request is **never** answered with one giant spec. It runs in
app-driven stages so every missing machine becomes a real component, not a box:

```
You: "Build a detailed brewery"
        │
        ▼
1. PLAN        → architecture summary + manifest (brewhouse, fermenters, filler … ;
                 each tagged catalog/existing/new, hero/auxiliary)
        │  (app authors each NEW type…)
        ▼
2. CREATE      → one detailed Component Spec per new type (20–60 parts, foundation,
   COMPONENT     ports, materials, an animation)
        │  (app LINTS the spec — floating/clipping/thin → one corrective round)
        ▼
3. GENERATE    → the Twin Spec: places every asset in UNS groups, lays each line in
                 process order, CONNECTS adjacent machines, colours pipes by medium,
                 enables tooltips on hero machines, leaves it running
        │  (app lints the LAYOUT — overlaps/stacked/unconnected → one fix round)
        ▼
   A live, connected, colour-coded, animated twin.
```

> Image input + render-critique loops are built (imageUtil / snapshotSpec /
> componentLint) but dormant: the Bruce Agents platform chat API is text-only
> (`{message, session_id}`). They switch on when the platform accepts images.

Incremental changes to an existing scene skip the pipeline and go straight to
**MANIPULATE** (or **DEMO DATA** for values).

---

## Prompting recipes
- **Whole plant:** *"Build a detailed cement plant — quarry intake, crusher, raw mill, preheater tower, rotary kiln, clinker cooler, cement mill, packing; utilities and stacks."* The more real units you name, the richer the manifest.
- **One line:** *"Add a PET bottling line: rinser → filler → capper → labeller → case packer, connected, with a CIP skid."*
- **One component:** *"Create a rotary kiln component"* → a detailed multi-part asset is authored and dropped into the scene.
- **Edit:** *"Move the cooling tower 10 m north and connect its outlet to the condenser with a cooling-water pipe."*
- **Make it look live:** *"Populate realistic demo data"* or *"stage an upset on the kiln."*
- **Tooltips:** *"Show drum pressure and steam flow on the boiler when I hover it."*
- **Clarify:** for an underspecified component the assistant may ask ≤3 high-impact questions (size class, counts, optional sub-assemblies) — answer them and it builds.

**Tips for the best output**
- Name the **process flow in order** — it lays lines as connected chains.
- Say **"detailed"** and call out sub-assemblies you care about.
- Mention **fluids** ("steam header", "cooling-water loop") → pipes get colour-coded.
- Mark which machines are the **mains** → they get hover tooltips.
- It runs in **build mode**; tooltips and flow animation show in **view mode**.

---

## What "good" looks like (the bar these skills enforce)
- **Complete hierarchy** — every asset in an ISA-95/UNS group; nothing at the root.
- **Connected & moving** — adjacent machines linked; conveyors/pipes/busbars animate.
- **Colour-coded pipes** — every pipe coloured by what it carries; mains thicker.
- **Real materials** — steel/concrete/copper/glass/liquid/translucent smoke, not flat grey.
- **Detailed components** — heroes 20–60 parts on a foundation, with ≥1 animated part.
- **Meaningful telemetry** — sensible params with units + cadence; line KPIs; hero tooltips.
- **Calm HMI** — healthy plant looks calm; only abnormal states pop (amber/red).

---

## Capabilities cheat-sheet (what the assistant may emit)
- **Twin Spec object fields:** `type, name, position, rotation, scale, layer, parentId, order, config, parameters, rules, connections[], tooltip{enabled,params[]}, unsRef, paramMeta`. Group: `name, parentId, order, kpis[]`. *(Group tooltips are ignored — heroes only.)*
- **Connections:** `{targetId, sourcePort, targetPort, connectorType?, connectorConfig?}` — connector auto-derived from the source port (`conveyor`→belt, `power`→busbar, else pipe); `connectorConfig` styles it (`color`, `radius`, `flowing`, …).
- **Component Spec:** `parts[]` (roundedBox/box/cylinder/capsule/vessel/sphere/cone/torus/ibeam; or group/component/logical/model), `ports[] (product|conveyor|utility|co2|power)`, `config[]`, `parameters[]` (+ per-part params & rules), `states[]`, `beacon`. Animations: `spinY|spinX|pulse|bob|rise` (+ per-part `rate`; groups may animate — carousels). Materials: PBR + `finish` (brushedMetal|paintedSteel|concrete|rubber|grating|rust), `transparent/opacity`, `edges`, `emissive`, `polygonOffset`. *(No `pad` field — author a concrete foundation part.)*
- **Catalog extras:** `FlowConveyor` (dense product stream, curves/lanes), `Floor` (finished slab + aisle lanes), `Light` (overhead highbay), `Model` (user-supplied glTF URL only).
- **MANIPULATE ops:** `add_asset, add_group, connect (+connectorConfig), disconnect, set_config, set_parameter, bind_uns, set_state, set_tooltip, add_rule, remove_rule, move, move_group, reparent, rename, duplicate, duplicate_group, delete, delete_group, frame`.

---

## Maintaining the skills
- **Keep them generic.** Use multi-industry illustrations; never hard-code one template's asset ids. The thermal-power-plant template is a *reference for the detail bar*, not content to copy.
- **Match the code contracts.** Object/group fields pass through [`twinSpec.js`](../src/lib/twinSpec.js); component limits live in [`componentSpec.js`](../src/lib/componentSpec.js) (`GEOMETRY_DEFS`, `ANIMATIONS`, `PORT_TYPES`); MANIPULATE verbs are executed in [`src/lib/ai/execute.js`](../src/lib/ai/execute.js). If you document a new field/verb, wire it there too.
- **Palettes:** the fluid-medium colours mirror [`src/lib/pipeMedia.js`](../src/lib/pipeMedia.js); keep them in sync.
- A successful `npm run build` proves the skills still import cleanly (they're bundled via `?raw`).
