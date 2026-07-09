// Build the per-request message for the REAL Bruce agent (IOsense AI Agents
// platform). The agent has the skill files attached platform-side, but its
// tool round is broken (read_skill runs → final message comes back EMPTY), so
// we ship the orchestrator contract + the per-surface skill text INLINE in the
// message — the exact content the old client-side system prompt proved out —
// and tell Bruce not to call read_skill. Bruce replies with one envelope JSON
// object (parsed by extractJSON below). Sessions/model/billing stay platform-side.
import GENERATE_SKILL from '../../../skills/digital-twin-generate.md?raw'
import MANIPULATE_SKILL from '../../../skills/digital-twin-manipulate.md?raw'
import DEMO_DATA_SKILL from '../../../skills/digital-twin-demo-data.md?raw'
import CREATE_COMPONENT_SKILL from '../../../skills/digital-twin-create-component.md?raw'
import EDIT_COMPONENT_SKILL from '../../../skills/digital-twin-edit-component.md?raw'
import CONVENTIONS from '../../../skills/digital-twin-conventions.md?raw'
import PLAN_SKILL from '../../../skills/digital-twin-plan.md?raw'
import UNS_SKILL from '../../../skills/digital-twin-uns.md?raw'
import { specBounds } from '../componentLint'

// Compact list of components the model can REUSE (existing custom + shared library)
// so it doesn't recreate them and can tell what's already available. Each entry
// carries its real FOOTPRINT [width X, depth Z, height Y] (metres, from the part
// AABBs) + port offsets — the assembler can only space machines correctly if it
// can see how big they are.
export function componentsCatalog(customAssetTypes = {}) {
  const list = Object.values(customAssetTypes).map(t => {
    const row = { id: t.id, label: t.label, category: t.category || 'Custom' }
    try {
      const b = specBounds(t)
      if (b) row.footprint = [b[3] - b[0], b[5] - b[2], b[4] - b[1]].map(v => Math.round(v * 10) / 10)
      if (t.ports?.length) row.ports = t.ports.map(p => ({ id: p.id, type: p.type, dir: p.direction, offset: (p.offset || [0, 0, 0]).map(v => Math.round(v * 10) / 10) }))
    } catch { /* footprint is best-effort */ }
    return row
  })
  return list.length
    ? `(footprint = [width X, depth Z, height Y] in metres — placements must keep footprints from overlapping)\n${JSON.stringify(list)}`
    : 'NONE (only built-in catalog types + anything you author)'
}

// Compact, token-light view of the live scene so MANIPULATE can reference ids.
export function sceneSummary(objects, groups) {
  const g = Object.values(groups || {}).map(x => ({ id: x.id, name: x.name, parentId: x.parentId ?? null }))
  const o = Object.values(objects || {}).map(x => ({
    id: x.id, type: x.type, name: x.name, parentId: x.parentId ?? null,
    position: (x.position || [0, 0, 0]).map(n => Math.round(n * 10) / 10),
  }))
  if (o.length === 0) return 'EMPTY (no objects yet)'
  return JSON.stringify({ groups: g, objects: o })
}

// Compact view of the component open in the Studio so EDIT COMPONENT can target ids.
export function componentSummary(draft) {
  if (!draft) return 'NONE'
  const parts = (draft.parts || []).map(p => ({
    id: p.id, label: p.label || '', kind: p.kind || 'shape', parentId: p.parentId ?? null,
    ...(p.geometry ? { geometry: p.geometry } : {}), ...(p.ref ? { ref: p.ref } : {}),
    ...(p.parameters?.length ? { params: p.parameters.map(x => x.key) } : {}),
  }))
  const ports = (draft.ports || []).map(p => ({ id: p.id, type: p.type, direction: p.direction }))
  return JSON.stringify({ label: draft.label, layer: draft.layer, parts, ports, parameters: (draft.parameters || []).map(x => x.key) })
}

const NO_TOOLS = 'IMPORTANT: do NOT call read_skill or any other tool — the full text of every skill you need is provided below. Answer directly with the envelope JSON.'

const ORCHESTRATOR = `The user asks you to create or modify a 3D industrial digital twin. You have the following capabilities, each fully specified by a SKILL below:

- PLAN — for ANY full build ("build / make / create / lay out / scaffold a <plant / line / shopfloor / cell>", or generate a whole scene from a brief): you MUST return \`mode:"plan"\` FIRST (per the PLAN skill) — an architecture summary + a component MANIFEST marking each needed asset as catalog / existing / new, with a DETAILED brief for each NEW one. The app then authors every NEW component (via CREATE COMPONENT) and asks you to assemble. **This is the only correct first response to a build request.**
- GENERATE — assemble the Twin Spec. ⚠️ This is an APP-INVOKED step only — do NOT choose it yourself in response to a user build request (the app will explicitly tell you "now produce the scene as mode generate" after components exist). When asked, reference components from AVAILABLE COMPONENTS by id; never redefine or placeholder them.
- MANIPULATE — produce a COMMAND LIST that edits the CURRENT scene. Use for incremental changes (add / move / connect / configure / rename / group / delete) to an existing scene.
- DEMO DATA — when the user asks to add/fill demo or sample data ("populate values", "make it look live", "stage an upset"), return mode "manipulate" with ONLY set_parameter / set_state commands per the DEMO DATA skill (fill values for params the scene already defines; never invent params/assets).
- COMPONENT — produce a custom COMPONENT (a reusable multi-part asset TYPE) per the CREATE COMPONENT skill. Use when the user asks to "create / design / make a [thing] component" or "build a custom asset". Returns a Component Spec; the app registers it AND places one in the current scene (the user stays in the scene).
- CLARIFY — ask the user a FEW high-impact questions before building. Use ONLY for COMPONENT requests that are materially underspecified, and ONLY for variables whose answer changes the component (scale/size class, counts of key repeated elements, which optional sub-assemblies/features, critical parameter units/ranges). NEVER ask about things you can sensibly default (colours, exact dims, cosmetic detail). Ask at most 3 questions, each with suggested options and a default. If the brief already has enough to build sensibly, SKIP clarify and emit the component directly.
- UNS_QUERY — when the user wants live UNS data (bind sensors / build from the UNS tree) and you need REAL tag paths, return \`mode:"uns_query"\` FIRST (per the UNS skill) — a list of targeted searches. The app runs them and re-invokes you with the matching real paths; you then bind (bind_uns / paramMeta) or build. The UNS TOPOLOGY block below lists the workspaces; only answer directly (no query) if the workspace list alone already answers the user.

Respond with EXACTLY ONE JSON object and NOTHING else (no prose, no code fences):
{
  "mode": "plan" | "generate" | "manipulate" | "component" | "clarify" | "uns_query",
  "message": "<one or two short sentences — for clarify, a one-line lead-in>",
  "summary": "<architecture summary — ONLY when mode = 'plan'>",
  "components": [ ...component manifest per the PLAN skill... ],   // ONLY when mode = "plan"
  "spec": { ... },                                        // Twin Spec (mode "generate") OR Component Spec (mode "component")
  "commands": [ ...per the MANIPULATE skill... ],         // ONLY when mode = "manipulate" (incl. bind_uns per the UNS skill)
  "queries": [ { "workspace": "ws_…", "q": "ball mill", "type": "Tag" } ],   // ONLY when mode = "uns_query"
  "questions": [ { "question": "…", "options": ["…","…"], "default": "…" } ]   // ONLY when mode = "clarify" (≤3, each high-impact)
}

Hard rules:
- **A build/create-a-scene request → ALWAYS \`mode:"plan"\`.** Never emit \`mode:"generate"\` on your own; generate is produced ONLY when the app explicitly asks you to assemble. (This is what makes missing equipment become detailed components instead of placeholder boxes.)
- Follow the relevant skill exactly (valid catalog types, fields in range, ports that exist, etc.).
- ALWAYS keep everything grouped into a clean UNS hierarchy — never leave an asset at the root.
- When editing, reference real ids from the CURRENT SCENE below. When creating new nodes mid-list, use the "ref:" alias mechanism from the MANIPULATE skill.
- Output STRICT, MINIFIED JSON on a single line: double quotes, NO comments, NO trailing commas, no code fences, no prose. (The skills use // comments for explanation only — never put comments in your output.)`

// Studio orchestrator — Bruce edits the ONE open component, nothing else.
const COMPONENT_ORCHESTRATOR = `The user is editing ONE component in the Component Studio (its current spec is in COMPONENT below). Your job is to EDIT THAT COMPONENT per the EDIT COMPONENT skill — nothing else.

Respond with EXACTLY ONE JSON object and NOTHING else:
{
  "mode": "edit_component" | "clarify",
  "message": "<one short sentence on what you changed>",
  "commands": [ ...per the EDIT COMPONENT skill... ],   // ONLY when mode = "edit_component"
  "questions": [ { "question":"…","options":["…"],"default":"…" } ]   // ONLY when mode = "clarify"
}

Hard rules:
- Reference REAL part ids from COMPONENT; use "ref:" aliases for parts you add in the same list. Make the smallest set of commands that does the job.
- You CANNOT change the plant/scene here. If the user asks to add lines/machines, place assets, or fill scene data, do NOT emit commands — reply mode "edit_component" with empty commands and a short message telling them to go back to the scene.
- Follow the house style (procedural geometry; steel #b0c4d0/0.85/0.12; flush-mounted parts use polygonOffset; severities drive glow).
- Output STRICT, MINIFIED JSON on a single line — double quotes, NO comments, NO trailing commas, no fences, no prose.`

// Focused orchestrators for the build PIPELINE sub-steps — deliberately WITHOUT the
// scene orchestrator's "always plan" rule, so authoring/assembling isn't pushed
// back into planning.
const CREATE_ORCHESTRATOR = `You author ONE custom industrial component, following the CREATE COMPONENT skill and CONVENTIONS below. The user message is a component brief.
Return EXACTLY ONE JSON object and NOTHING else: { "mode":"component", "message":"<short>", "spec": { ...Component Spec... } }.
The spec MUST be a DETAILED multi-part component — a HERO machine is 20–60 parts, a simpler auxiliary 8–20: the real silhouette (foundation/skid + frame + body + the defining features/stations), grouped sub-assemblies (\`kind:"group"\` for carousels, station rings, reel stacks — spin the GROUP), AND mechanical furniture (bolt circles, gauges, handrails, nameplates). Use real per-surface materials + finishes, parameters (units + cadence), and states. NEVER a single bare box, NEVER an all-grey blob.
REQUIRED for line equipment: include PORTS so it connects into the process flow — an inlet + an outlet (\`{type:"conveyor",direction:"in"}\`/\`{...,direction:"out"}\` for product-flow machines, or \`product\`/\`utility\` for vessels), positioned on the correct faces (offset roughly ±half the body length on X). Also include at least ONE animated part (a \`spinY\`/\`spinX\`/\`pulse\`/\`bob\` driven by a config key) where the machine actually moves, so the twin looks alive.
Output STRICT, MINIFIED JSON on a single line — double quotes, no comments, no trailing commas, no code fences, no prose.`

const ASSEMBLE_ORCHESTRATOR = `You assemble a complete scene ("Twin Spec"), following the GENERATE skill and CONVENTIONS below.
Return EXACTLY ONE JSON object and NOTHING else: { "mode":"generate", "message":"<short>", "spec": { ...Twin Spec... } }.
Reference components from AVAILABLE COMPONENTS by id (and catalog types by name); NEVER redefine or placeholder them. Group everything into a clean ISA-95/UNS hierarchy and give realistic per-asset parameters + per-line kpis.
LAY IT OUT LIKE A REAL PLANT (use each component's footprint [width,depth,height] from AVAILABLE COMPONENTS — footprints must NEVER overlap):
- **Zone the site first**: production hall(s) holding the process lines; a tank-farm / utilities yard at the rear (−Z); warehouse/dispatch at the discharge end of the line; office block in a front corner; a clear truck road along the front (+Z). Frame the zones with the structural/civil assets (Floor sized to cover everything, hall, racks, lights).
- **Lines follow process order but need NOT be straight**: straight, L-shaped or U-shaped (FlowConveyor supports a 90° curve at its end) — pick what fits the hall and looks like a real factory. Parallel lines sit 8–12 m apart on Z sharing an aisle.
- **Spacing arithmetic**: gap between adjacent machine footprints along a line = 3–6 m (that's the conveyor run); side aisles ≥ 2 m clear; check each placement against the neighbours' footprints before you commit it.
- **Utilities live off-line**: tanks, silos, pumps, compressors, boilers, CIP cluster in the utility zone — never inline with product flow — and connect via their utility/product ports (pipes route along the rear).
- **Orientations**: yaw 0 or ±1.5708 only ([0,±1.5708,0]); machines face the flow direction.
CONNECT THE PROCESS FLOW (critical — a twin must look working, not scattered):
- **Link every adjacent machine** with a connection (\`connections:[{targetId, sourcePort, targetPort}]\` on the upstream asset) so the app draws a moving conveyor / pipe between them. The app derives the connector (conveyor / pipe / busbar) from the source port type — so an outlet→inlet link on product-flow machines becomes a running conveyor belt.
- Do NOT leave machines unconnected. Use the real port ids each component declares (out → in). Utilities (tanks→pumps→valves) link via their utility/product ports (pipes).
- Leave assets in their normal/running state and animations enabled — the result should be a moving, connected line out of the box.
Output STRICT, MINIFIED JSON on a single line — double quotes, no comments, no trailing commas, no code fences, no prose.`

// One request message for Bruce: surface marker + orchestrator contract +
// context blocks + inline skill text + the user's actual message.
// ctx = { surface:'scene'|'component'|'create'|'assemble', objects, groups,
//         component, customAssetTypes, uns }
export function buildBruceMessage(ctx = {}, userText = '') {
  const surface = ctx.surface || 'scene'
  const parts = [`=== SURFACE ===\n${surface}`, NO_TOOLS]
  if (surface === 'create') {
    parts.push(CREATE_ORCHESTRATOR,
      `=== CONVENTIONS (industry standards — always apply) ===\n${CONVENTIONS}`,
      `=== SKILL: CREATE COMPONENT ===\n${CREATE_COMPONENT_SKILL}`)
  } else if (surface === 'assemble') {
    parts.push(ASSEMBLE_ORCHESTRATOR,
      `=== CONVENTIONS (industry standards — always apply) ===\n${CONVENTIONS}`,
      `=== AVAILABLE COMPONENTS (reuse by id; don't recreate) ===\n${componentsCatalog(ctx.customAssetTypes)}`,
      ...(ctx.uns ? [`=== UNS TOPOLOGY (bind real tags via paramMeta/unsRef per the UNS skill) ===\n${ctx.uns}`, `=== SKILL: UNS ===\n${UNS_SKILL}`] : []),
      `=== SKILL: GENERATE ===\n${GENERATE_SKILL}`)
  } else if (surface === 'component') {
    parts.push(COMPONENT_ORCHESTRATOR,
      `=== CONVENTIONS (industry standards — always apply) ===\n${CONVENTIONS}`,
      `=== COMPONENT (the one you are editing) ===\n${componentSummary(ctx.component)}`,
      `=== SKILL: EDIT COMPONENT ===\n${EDIT_COMPONENT_SKILL}`,
      `=== REFERENCE: COMPONENT SPEC CONTRACT ===\n${CREATE_COMPONENT_SKILL}`)
  } else {
    parts.push(ORCHESTRATOR,
      `=== CONVENTIONS (industry standards — always apply) ===\n${CONVENTIONS}`,
      `=== CURRENT SCENE ===\n${sceneSummary(ctx.objects, ctx.groups)}`,
      `=== AVAILABLE COMPONENTS (reuse by id; don't recreate) ===\n${componentsCatalog(ctx.customAssetTypes)}`,
      `=== UNS TOPOLOGY (live namespace — for binding / build-from-UNS) ===\n${ctx.uns || 'No UNS session connected.'}`,
      `=== SKILL: PLAN ===\n${PLAN_SKILL}`,
      `=== SKILL: GENERATE ===\n${GENERATE_SKILL}`,
      `=== SKILL: MANIPULATE ===\n${MANIPULATE_SKILL}`,
      `=== SKILL: DEMO DATA ===\n${DEMO_DATA_SKILL}`,
      `=== SKILL: CREATE COMPONENT ===\n${CREATE_COMPONENT_SKILL}`,
      `=== SKILL: UNS ===\n${UNS_SKILL}`)
  }
  parts.push(userText)
  return parts.join('\n\n')
}

// Strip JSONC-isms models often emit (// and /* */ comments, trailing commas)
// without touching string contents.
function looseParse(slice) {
  const cleaned = slice
    .replace(/\/\*[\s\S]*?\*\//g, '')               // /* block comments */
    .replace(/([^:"'\\])\/\/[^\n\r]*/g, '$1')        // // line comments (skip ://)
    .replace(/,(\s*[}\]])/g, '$1')                   // trailing commas
  return JSON.parse(cleaned)
}

// Pull the first JSON object out of a model reply (tolerates ```json fences,
// stray prose, and JSONC comments / trailing commas).
export function extractJSON(text) {
  if (!text) throw new Error('Empty response.')
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end < 0 || end < start) throw new Error('No JSON object found in the response.')
  const slice = body.slice(start, end + 1)
  try { return JSON.parse(slice) }
  catch (e1) {
    try { return looseParse(slice) }
    catch (e2) {
      throw new Error(`Couldn't parse Bruce's JSON (${e1.message}). It may have included comments/trailing commas, or been cut off — try again.`)
    }
  }
}
