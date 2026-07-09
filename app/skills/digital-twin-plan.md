---
name: digital-twin-plan
description: >
  Plan a full shopfloor build BEFORE generating it. Use whenever the user asks to
  build/create/scaffold a whole plant, line, or scene from a brief. You produce an
  architecture summary + a COMPONENT MANIFEST: every asset type the build needs,
  each marked catalog / existing / new, with a detailed brief for the new ones. The
  app then authors every NEW component (via create-component) and finally generates
  the scene — so missing equipment becomes a proper detailed component, not a box.
version: 1.1
source: digital-twin-generate, digital-twin-create-component, digital-twin-conventions
---

# Digital Twin — Build Plan Skill

A full build runs in three app-driven steps: **PLAN (you, now)** → app authors each
NEW component → **GENERATE** (you assemble the scene). Your job here is only the plan.

**Output:** EXACTLY ONE JSON object:
```jsonc
{
  "mode": "plan",
  "message": "<one line: what you'll build>",
  "summary": "<2–4 sentences: the plant's architecture — areas/lines/cells, process flow, key equipment, utilities>",
  "components": [
    { "key": "blister_packer",        // stable slug you'll reuse to refer to it
      "label": "Blister Packer",
      "source": "new",                // catalog | existing | new
      "tier": "hero",                 // hero (main machine, gets a tooltip) | auxiliary
      "brief": "Detailed ask for create-component (only when source = new). Name: the SILHOUETTE + key sub-assemblies, the parameters w/ units + cadence, the ports (type+direction+face), the moving part (animation), and the foundation. e.g. 'Forming + sealing + perforation stations on a welded frame, lidding-foil reel on top, on a concrete skid; params blisterRate (ppm, 5s), sealTemp (°C, 30s), reject (%, 5m); ports product_in (conveyor,in,-X) / product_out (conveyor,out,+X); seal drum spins (spinX); states running/idle/fault.'" }
  ]
}
```

## How to plan
1. **Decompose** the plant into the ISA-95 hierarchy and process flow (per CONVENTIONS). Capture this in `summary`.
2. **Enumerate every distinct ASSET TYPE** the build needs (don't list every instance — list each *type* once). For each, set `source`:
   - **`catalog`** — a built-in type from the GENERATE catalog fits (give its catalog `type` as `label` hint in the brief).
   - **`existing`** — it's already in **AVAILABLE COMPONENTS** (reuse it; put its id in the brief).
   - **`new`** — nothing fits → must be authored. Give a **detailed brief**.
3. **Briefs for `new` must be rich** (this drives quality): name the real sub-parts/stations, the parameters that matter with **units + sampling cadence**, the ports (type/direction/face), the **moving part** (which animation — including group-spun carousels and `rise` plumes), the **foundation/support**, the states, and for **hero** machines the showpiece treatment — surface finishes (brushed/painted/concrete/grating), mechanical furniture (bolt circles, handrails, gauges, nameplate) and, where it fits the machine, a **glass-walled side showing animated internals** (the house signature — e.g. "glass furnace wall revealing the fire and tube banks").
4. **Tier each type** `hero | auxiliary`: heroes are the main machines an operator watches (they get a hover tooltip at generate time); auxiliaries are small/support kit and structural/civil. Be honest — most lines have a few heroes and many auxiliaries.
5. Don't over-fragment: one component per real equipment type; shared utilities (pumps/tanks/valves) usually map to catalog. But DO cover everything real — process machines, vessels, utilities, AND the structural/civil context (buildings, racks, stacks) so the scene feels complete. Environment dressing (a `Floor`, overhead `Light`s, dense `FlowConveyor` product streams) is **catalog** — never plan those as `new`.

## Rules
- Mark `source` accurately against the catalog + AVAILABLE COMPONENTS you were given — **reuse `existing`/`catalog`; only mark `new` when truly needed.**
- **Heroes default to `source:"new"`** so they get authored in full detail — map a hero to `existing` only when that component is already a rich multi-part match (never to a thin placeholder), and to `catalog` only when a catalog machine genuinely IS that machine.
- `key` is a stable slug (snake_case); you'll reference these when the scene is generated.
- Keep it to the **types** actually needed for the brief — a rich plant is typically 6–20 entries; a single line 3–8.
- STRICT, MINIFIED JSON — double quotes, no comments, no trailing commas, no fences, no prose.
