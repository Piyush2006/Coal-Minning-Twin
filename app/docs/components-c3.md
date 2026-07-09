# Components Phase C3 (Bruce skill + Import/Export) — DONE

Status: **complete**. C1 (spec + `CompositeAsset` + registry wiring), C2 (Component Studio),
C2.5 (in-canvas gizmos + nested-component parts), and C3 are all done.

C3 delivered: (1) `skills/digital-twin-create-component.md` + wired into `buildSystemPrompt`;
(2) Bruce `component` mode + a `clarify` mode (asks high-impact questions first), dispatched in
`ChatPanel.jsx` → `validateComponentSpec` → `addCustomAssetType` → `openEdit`; (3) Import/Export
component JSON in the Studio top bar (`downloadJSON` / `validateComponentSpec` → `setDraftSpec`)
and Import in the Components modal; (4) the `＋ Add Component` 3-way chooser
(**Build** · **Describe to Bruce** · **Import JSON**). (Original scope below for reference.)

## Scope of C3
1. **Bruce `create-component` skill** — `skills/digital-twin-create-component.md`:
   - Defines the Component Spec contract (parts/ports/config/parameters/states/beacon) plus
     the **house style** (steel PBR materials, beacon placement, port conventions, naming) so
     AI-authored components are visually uniform with the rest of the app.
   - Register it in `buildSystemPrompt` (`src/lib/ai/prompt.js`) alongside the generate/manipulate skills.
2. **Chat mode `component`** — handle an envelope `{ mode:'component', message, spec }` in
   `src/components/ai/ChatPanel.jsx` + `src/lib/ai/execute.js`:
   - `validateComponentSpec(spec)` (already exists in `src/lib/componentSpec.js`),
   - register via `useSceneStore.addCustomAssetType(spec)`,
   - then `useStudioStore.openEdit(id)` so the user previews/tweaks before it's final
     (AI proposes, user confirms).
3. **Import / Export Spec JSON** — in the Components modal (`AssetLibraryModal.jsx`) and the
   Studio top bar:
   - Export: `twinSpec.downloadJSON(spec, name)` for one component.
   - Import: file/paste → `validateComponentSpec` → `addCustomAssetType`. Reuse the tolerant
     validate pattern from `twinSpec.js`.
4. **`＋ Add Component` becomes a 3-way chooser** — **Build** (Studio) · **Describe to Bruce**
   (chat) · **Import JSON**. Today it directly opens the Studio (Build).

## Reuse already in place
- `src/lib/componentSpec.js` — `validateComponentSpec`, `blankSpec`, `GEOMETRY_DEFS`, etc.
- `src/store/studioStore.js` — `openNew`/`openEdit`/`close`/`save`.
- `src/lib/ai/*` — `chat`, `extractJSON`, `buildSystemPrompt`, `applyCommands`.
- `src/lib/twinSpec.js` — `downloadJSON` + tolerant validation pattern.

## Verification (when resumed)
Build from project root, dev on 5117. Then: "Bruce, make a 4-roller transfer unit with an in
and out product port" → previews in Studio → save; Export a component to JSON and re-Import it
on a fresh project; the 3-way Add chooser routes correctly.
