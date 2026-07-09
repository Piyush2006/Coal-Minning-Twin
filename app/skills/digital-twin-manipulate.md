---
name: digital-twin-manipulate
description: >
  Edit an EXISTING Digital Twin scene in the Faclon Digital Twin Creator by
  emitting a command list. Use when the user wants to change a scene already on
  screen — add/remove/move/rename assets or groups, connect things, retune
  telemetry, add visual rules, duplicate a line, regroup, etc. ("add a third
  line", "raise all pot voltages 5%", "duplicate Line A as Line C", "flag
  overheating pots red"). Pairs with digital-twin-generate (which owns the asset
  catalog — load it alongside this skill).
version: 1.2
source: src/store/sceneStore.js (actions), src/lib/ai/execute.js, src/lib/{machineLibrary,hierarchy}.js; see digital-twin-conventions
---

# Digital Twin — Scene Manipulation Skill

You receive the **current scene** (a Twin Spec or a summary of objects + groups)
plus a user instruction, and you return an **ordered command list** that mutates
the scene. Each command maps 1:1 to an app action, so the result is identical to
a user editing by hand. The asset catalog (valid `type`s, config/parameter keys
& ranges, ports, states) lives in **digital-twin-generate.md** — obey it here too.

Follow the shared **CONVENTIONS**: keep new assets inside an ISA-95/UNS group
(never at the root), give new params SI units + a sensible `freq`, and use ISA-18.2
state severities (`ok`/`warn`/`down`). For assets not in the catalog, add a custom
type (per GENERATE §8) rather than forcing a wrong `type`.

**Output:** emit **only** a JSON array of command objects, in execution order.
Nothing else. (Hosts may also expose these as native tool-calls — same names/params.)

```json
[ { "op": "add_group", "name": "Line C", "ref": "lineC" },
  { "op": "add_asset", "type": "PETFiller", "name": "Filler C1", "parentId": "ref:lineC", "position": [-12,0,-8] } ]
```

---

## 1. Referencing entities

- **Existing** nodes: prefer the `id` from the supplied scene. You may also target
  by exact `name` or by **UNS path** (`Line A/Pot A3`) — resolve it to the id
  yourself from the scene; if two nodes share a name/path, pick none and return a
  single clarifying question instead (see §6).
- **New** nodes you create in this same list: give the creating op a `ref` alias,
  then reference it elsewhere as `"ref:<alias>"` in any `id` / `parentId` /
  `targetId` / `sourceId` / `groupId` / `nodeId` field. The host resolves aliases
  to real ids in order. Only reference a `ref` after the op that defines it.

---

## 2. Command vocabulary

Each op below lists its params and the underlying action. Optional params in
`( )`. Coordinates are world metres (Y up); see generate skill §1/§6.

**Create**
- `add_asset` — `{ type, (name), parentId, position:[x,y,z], (config{}), (parameters{}), (ref) }` → adds an asset (layer auto-set from the catalog) into a group. **Always set `parentId`** to an existing group or a `ref:` from an `add_group` earlier in the list — never add an asset to the root. `position` required (don't stack on others).
- `add_group` — `{ name, (parentId), (ref) }` → creates a group (UNS node). Add one first if no suitable group exists for the assets you're adding.

**Connect**
- `connect` — `{ sourceId, sourcePort, targetId, targetPort, (connectorType), (connectorConfig{}) }` → links two ports; connector type auto-derived (conveyor/busbar/pipe — generate skill §4). Both ports must exist on their assets. **`connectorConfig` is applied** — colour a pipe by fluid medium and size mains via `{ "color":"#2f7fd0", "radius":0.4, "flowing":true }` (CONVENTIONS §9), tune a conveyor `{ "speed":1.4, "beltStyle":"roller" }`, or a busbar `{ "bars":3, "color":"#b87333" }`.
- `disconnect` — `{ connectionId }` **or** `{ sourceId, targetId }` → removes a link.

**Configure / telemetry / state**
- `set_config` — `{ id, key, value }` → one geometry/animation field (catalog `config`). One key per command.
- `set_parameter` — `{ id, key, value }` → one telemetry field (catalog `parameters`). One key per command.
- `bind_uns` — `{ id, key, topic }` → bind a telemetry parameter to a LIVE UNS tag so real data drives it. `topic` MUST be canonical `uns:<workspaceId>://<absolutePath>:last` from a `uns_query` result (see the UNS skill). One key per command; only bind params with a real matching tag.
- `set_state` — `{ id, state }` → sets the asset's operational state (must be a valid state for its type).
- `add_rule` — `{ id, rule: { parameter, operator, (compareMode="constant"), (value), (refAssetId), (refParameter), color } }` → adds a visual threshold rule (glow). `operator ∈ > >= < <= == !=`.
- `remove_rule` — `{ id, ruleId }`.
- `set_tooltip` — `{ id, (enabled=true), params:[ "key1","key2" ] }` → shows a hover card (view mode) with those parameter keys. Use only on **hero/main** machines (2–3 keys that exist on the asset); omit on auxiliaries. `{ enabled:false }` turns it off. (Per-asset only — not groups.)

**Transform / organise**
- `move` — `{ id, position:[x,y,z] }` **or** `{ id, delta:[dx,dy,dz] }` → moves one asset.
- `move_group` — `{ groupId, delta:[dx,dy,dz] }` → translates a whole group/line (members move together, layout preserved).
- `reparent` — `{ nodeId, parentId|null, (beforeNodeId) }` → moves an asset or group under a new parent / reorders it (cannot move a group into its own descendant).
- `rename` — `{ id, name }` → renames an asset **or** group.

**Duplicate / delete**
- `duplicate` — `{ id, (ref) }` → clones one asset next to the original.
- `duplicate_group` — `{ groupId, (name), (ref) }` → clones a whole group subtree as a new parallel group (auto-named `Name (n)` unless `name` given); copies assets, sub-groups, and internal connections.
- `delete` — `{ id }` → removes one asset.
- `delete_group` — `{ groupId }` → removes a group; its children **reparent up** (assets are never deleted by this).

**View (optional UX)**
- `frame` — `{ id }` or `{ groupId }` → flies the camera to frame the asset/group.

---

## 3. Validation & safety (check before returning)

- **Keep the hierarchy intact:** every added asset goes into a group (`add_group` first if needed); never leave assets at the root. Prefer `reparent` to organise rather than orphan.
- Only catalog `type`s; `config`/`parameter` keys & ranges per the catalog; `state` valid for the type.
- `connect` ports must **exist** on both assets and be sensible (out→in); never connect **No-port** assets (PotTendingMachine, TappingCrucible, MountingStand, Floor, Light, Model, primitive custom types). Custom **components** connect via the ports their spec declares.
- Never create a group cycle (`reparent` a group under itself/its descendant).
- Every referenced `id`/path resolves in the scene, or is a `ref:` you defined earlier.
- Destructive scope: for "delete everything in X" or bulk deletes, prefer the smallest correct ops and, if the instruction is broad/risky, return a clarifying question (§6) instead of guessing.

---

## 4. Multi-step patterns

- **Add a line:** `add_group {ref:L}` → N× `add_asset {parentId:"ref:L", position}` → `connect` consecutive `conveyor_out→conveyor_in`.
- **Duplicate a line:** `duplicate_group {groupId, name}` (one op — copies assets + busbars/conveyors, offsets it, renames).
- **Bulk retune:** one `set_parameter` per target asset (e.g. raise voltage on each pot). Compute new values within range.
- **Flag a condition:** `add_rule` on each relevant asset (e.g. `bathTemp > 970 → #ff3b30`).
- **Reorganise:** `add_group` then `reparent` assets into it.

---

## 5. Worked examples

**"Duplicate Line A and call it Line C."**
```json
[ { "op": "duplicate_group", "groupId": "grp_lineA", "name": "Line C" } ]
```

**"Add a 3-machine can line at z = -8 and connect it."**
```json
[
  { "op": "add_group", "name": "Line B — Cans", "ref": "lineB" },
  { "op": "add_asset", "type": "CanFiller",   "name": "Can Filler", "parentId": "ref:lineB", "position": [-8,0,-8], "ref": "f" },
  { "op": "add_asset", "type": "CanSeamer",   "name": "Can Seamer", "parentId": "ref:lineB", "position": [0,0,-8],  "ref": "s" },
  { "op": "add_asset", "type": "CheckWeigher","name": "Check Weigher","parentId": "ref:lineB", "position": [8,0,-8], "ref": "cw" },
  { "op": "connect", "sourceId": "ref:f", "sourcePort": "conveyor_out", "targetId": "ref:s",  "targetPort": "can_in" },
  { "op": "connect", "sourceId": "ref:s", "sourcePort": "can_out",      "targetId": "ref:cw", "targetPort": "product_in" }
]
```

**"Raise every pot's voltage by 0.2 V and flag any over 4.6 V."** (pots `pot-A1`, `pot-A2` in scene)
```json
[
  { "op": "set_parameter", "id": "pot-A1", "key": "voltage", "value": 4.4 },
  { "op": "set_parameter", "id": "pot-A2", "key": "voltage", "value": 4.35 },
  { "op": "add_rule", "id": "pot-A1", "rule": { "parameter": "voltage", "operator": ">", "value": 4.6, "color": "#ff9f0a" } },
  { "op": "add_rule", "id": "pot-A2", "rule": { "parameter": "voltage", "operator": ">", "value": 4.6, "color": "#ff9f0a" } }
]
```

**"Move the Utilities group 10 m back and frame it."**
```json
[ { "op": "move_group", "groupId": "grp_util", "delta": [0,0,-10] },
  { "op": "frame", "groupId": "grp_util" } ]
```

---

## 6. When unsure

If the target is ambiguous (e.g. two assets named "Filler") or the request is
destructive and broad, return a single clarifying question instead of commands:
```json
{ "ask": "There are two 'Filler' assets — Line A/Filler or Line B/Filler?" }
```

---

## 7. Self-check before returning
- [ ] Output is a JSON array of commands (or one `{ "ask": ... }`), nothing else.
- [ ] Every `id`/path resolves in the scene, or is a `ref:` defined earlier in the list.
- [ ] Types/keys/values/states are catalog-valid and in range; ports exist for every `connect`.
- [ ] No group cycles; deletes are intentional and scoped.
- [ ] Commands are ordered so creates precede their references.

---

*Command names map to store actions in `src/store/sceneStore.js`
(addObject, addGroup, addConnection, removeConnectionById/removeConnection,
updateConfig, updateParameter, setState, addRule/removeRule, updateObject,
translateGroupBy, moveNode, renameGroup, duplicateObject, copyGroup+pasteGroup,
removeObject, removeGroup, flyToObject/flyToGroup). The asset catalog is in
digital-twin-generate.md — keep both in sync with the registries.*
