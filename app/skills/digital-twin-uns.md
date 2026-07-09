---
name: digital-twin-uns
description: >
  Read the live UNS (Unified Namespace) tree and use it to (a) auto-bind UNS tags
  to an asset's telemetry parameters so live data flows, and (b) build a plant that
  is INFORMED BY the UNS structure (UNS as reference — not a strict 1:1 mirror).
  Use whenever the user mentions UNS, "live data", "real tags", "bind sensors", or
  asks to build/populate a twin "from the UNS" / "from the tree".
version: 1.0
source: src/lib/ai/unsContext.js, src/lib/unsBrowse.js, src/lib/unsResolve.js, src/store/sceneStore.js (setParamTopic), src/lib/parameterSchemas.js
---

# Digital Twin — UNS Awareness Skill

You can see and use the customer's **live UNS tree**. The app injects a
`=== UNS TOPOLOGY ===` block into your context. It always lists the **workspaces**
(each with an `id` like `ws_3pH1ZiSwUq`). Actual node paths are NOT dumped (the tree
can be 96k+ nodes) — you fetch the ones you need via **`uns_query`**.

## 1. Getting real tags — `mode:"uns_query"`

When you need actual UNS paths (to bind data or to see what exists under an area),
return this envelope FIRST and nothing else:

```jsonc
{ "mode": "uns_query",
  "message": "Looking up the ball mill's tags in the UNS…",
  "queries": [
    { "workspace": "ws_3pH1ZiSwUq", "q": "ball mill", "type": "Tag" },   // type/tier optional
    { "workspace": "ws_3pH1ZiSwUq", "q": "temperature" }
  ] }
```

The app runs each search and re-invokes you with a `Search results` section of REAL
paths (`type · name → path`). **Only ever use paths that appear in that section** —
never invent a path. Use up to ~8 queries; keep `q` specific (`"550BE1 temperature"`,
`"kiln side vibration"`) so results are small. `type:"Tag"` / `tier:"operational"`
narrows to data points.

## 2. Canonical topic format (ALWAYS this shape)

```
uns:<workspaceId>://<absoluteNodePath>:<operator>
```
- `<absoluteNodePath>` = the FULL slug path from a search result (e.g.
  `jsw/nandyal/ballmill/bucket-elevator/550be1/kiln-side/gb-int-1-de/temperature`).
  NOT the leaf name alone (leaf names repeat → "no match").
- `<operator>` = `last` (default) | `min` | `max` | `sum`.
- Example: `uns:ws_3pH1ZiSwUq://jsw/nandyal/ballmill/…/temperature:last`

## 3. Auto-bind tags → parameters

Match a UNS **Tag** to a parameter by name/meaning (tag `Temperature` → param
`motorTemp`/`bathTemp`; tag `RPM` → `speed`; tag `AC_Power`/`Demand15` → a power/kW
param). Bind live data one of two ways:

**A — on an EXISTING scene asset (MANIPULATE):** return `mode:"manipulate"` with
`bind_uns` commands:
```jsonc
{ "mode":"manipulate", "message":"Bound the ball mill's live sensors.",
  "commands": [
    { "op":"bind_uns", "id":"<assetId>", "key":"motorTemp",
      "topic":"uns:ws_3pH1ZiSwUq://jsw/nandyal/ballmill/…/temperature:last" },
    { "op":"bind_uns", "id":"<assetId>", "key":"speed",
      "topic":"uns:ws_3pH1ZiSwUq://jsw/nandyal/ballmill/…/rpm:last" }
  ] }
```
Use real asset ids from CURRENT SCENE and real param keys the asset already defines
(see its type's parameters). Only bind params you found a plausible tag for.

**B — while GENERATING a scene:** put bindings on the asset in the Twin Spec via
`paramMeta` (the app loads them as live bindings):
```jsonc
"obj_mill": {
  "type": "SagMill", "name": "SAG Mill", "parentId": "grp_ballmill",
  "parameters": { "load": 34, "power": 5920 },
  "paramMeta": {
    "power": { "topic": "uns:ws_3pH1ZiSwUq://jsw/nandyal/ballmill/…/ac-power:last" }
  }
}
```

**Reliability aid (preferred for whole assets):** instead of hand-writing every
`paramMeta.topic`, add `"unsRef": "<the UNS node path this asset represents>"` to the
asset. The app then reads that node's Tag children and binds them to the asset's
params deterministically (real paths, no slug mistakes). Use `unsRef` for the bulk;
use explicit `paramMeta.topic` only for one-off overrides.

## 4. Building a plant from the UNS — UNS AS REFERENCE

The user does NOT want a literal 1:1 copy of every node. Use the tree to understand
what the plant contains, then build a clean, curated twin:

1. `uns_query` the areas the user names (or the workspace's main areas) to learn the
   real structure (Site → Area → Line/Cell → Asset → Tag).
2. Follow the normal PLAN → GENERATE flow. Mirror the **organisational** hierarchy
   into scene **groups** (Site/Area/Line → nested groups, sensible names), but choose
   **real catalog/curated asset types** for the equipment (a `Ball Mill` area → a
   `SagMill` + feeders + a conveyor line), not a box per UNS node.
3. Give each asset realistic parameters (per its type), then **auto-bind** the ones
   that have a matching UNS Tag (via `unsRef` or `paramMeta.topic`, §3). Leave the
   rest simulated.
4. Keep the process flow connected (conveyors/pipes) exactly as the GENERATE skill
   requires — a bound twin should still look like a working line.

Result: the twin's shape and names track the customer's UNS, real sensors drive the
bound parameters, and the unbound ones stay demo-simulated.

## Do / Don't
- ✅ Use only paths returned by `uns_query`. ✅ Full path, not leaf name. ✅ `unsRef`
  for whole-asset binding. ✅ Only bind params that have a real matching tag.
- ❌ Never invent UNS paths or workspace ids. ❌ Never bind a param to an unrelated
  tag. ❌ Don't dump the whole tree into the scene (curate). ❌ Don't emit `uns_query`
  if the workspace list already tells you enough (e.g. just answering "what
  workspaces exist?").
