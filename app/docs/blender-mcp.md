# Blender MCP — hero-component authoring pipeline

Author **detailed, accurate hero machines** by driving Blender from an AI agent
(Claude Code / Claude Desktop) over MCP, then export glTF into `public/models/` where
the app already loads it (`Model` asset type → `GLBModel.jsx`, or a `kind:"model"`
part inside a Component Spec).

This is an **offline asset factory** — Blender + the MCP run on a workstation, NOT at
app runtime. Use it for the handful of assets a customer would scrutinise (a SAG mill,
a reduction pot). For the long tail of background props, use `scripts/gen-model.mjs`
(text-to-3D) instead — see the two-tier strategy at the bottom.

## Prerequisites
- **Blender 4.x** installed and running.
- A **Blender MCP server**. Options:
  - Official Blender MCP (Blender dev team; endorsed for Claude) — https://www.blender.org/lab/mcp-server/
  - `ahujasid/blender-mcp` (popular community add-on) — https://github.com/ahujasid/blender-mcp
  - `RFingAdam/mcp-blender` (218 tools + built-in text/image-to-3D backends: Rodin/Meshy/Tripo/Hunyuan3D) — https://github.com/RFingAdam/mcp-blender

Follow the add-on's install steps (a Blender add-on + a local MCP socket/stdio server).

## Wire it to Claude Code (this repo)
Add the server so the agent can call Blender. Either:

```bash
claude mcp add blender -- uvx blender-mcp        # example — use your server's launch cmd
```

…or commit a `.mcp.json` at the repo root (copy `.mcp.json.example`):

```jsonc
{
  "mcpServers": {
    "blender": { "command": "uvx", "args": ["blender-mcp"] }   // match your server's docs
  }
}
```

Start Blender (with the add-on's server enabled) BEFORE launching the agent, so the
MCP connects.

## Authoring workflow (what to ask the agent)
1. **Model to spec** — "Model an industrial SAG mill: horizontal rotating drum on two
   trunnion bearings, feed chute, discharge, drive motor + girth gear. Real-world scale
   (~10 m). Stainless `#b0c4d0`, metalness 0.85, roughness 0.12." Keep it to the real
   silhouette; correct dimensions matter for a twin.
2. **Materials + detail** — PBR (Principled BSDF); bake a **normal map** from a high-poly
   pass for surface detail without polycount; optionally bake AO.
3. **Export glTF 2.0** to `public/models/<slug>/<slug>.glb`:
   - `+Y up` (default), **Apply Modifiers**, **Draco** mesh compression on.
   - Textures 1k–2k, JPEG. Keep the file a few MB.
   - (Or export `.gltf`+`.bin`+`/textures` like the shipped Poly Haven models.)
4. **Optimise** (if not Draco'd on export): `npx @gltf-transform/cli optimize in.glb out.glb`.
   The app's loader decodes draco/meshopt out of the box.

## Place it in the app
- **Standalone prop / hero:** add a `Model` asset and set **Model URL** = `/models/<slug>/<slug>.glb`
  (catalog → "3D Models"), or map a template unit via a `HERO_MODELS` entry
  (see `src/lib/templates/thermalPowerPlant.js`).
- **Detailed body INSIDE an animated/connectable component:** add a `kind:"model"` part to
  the Component Spec (now supported — `CompositeAsset.jsx`):

  ```jsonc
  { "id": "part_body", "label": "SAG Mill Body", "kind": "model",
    "url": "/models/sag_mill/sag_mill.glb", "fit": 8,
    "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1],
    "animate": { "kind": "spinY", "speedKey": "speed" } }   // the drum can still rotate
  ```
  Combine it with procedural parts (ports, spinning drive, status beacon) so the
  photoreal body keeps the twin's animation + process connections.

## Two-tier strategy (both tools, by role)
| Tier | Tool |
|---|---|
| Hero machines (accurate, specific, on-brand) | **Blender MCP** (this doc) — or import real CAD (Fusion/SketchUp MCP → glTF) when the customer has it. |
| Background / context props (plausible is enough) | **`scripts/gen-model.mjs`** — text-to-3D (Meshy/Tripo), fully headless. |

## Licensing
Blender output is yours. Text/image-to-3D services (Meshy, Tripo, Rodin) carry
commercial terms — verify per asset. `public/models/README.md` enforces CC0-only for
sourced assets; keep attribution where required.
