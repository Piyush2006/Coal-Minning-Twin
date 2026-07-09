# Imported 3D models (glTF / GLB)

Drop `.glb` files here, then add an **Imported Model (glTF)** asset in the app
(catalog → "3D Models") and set its **Model URL** to `/models/<file>.glb`.

You can also point the URL at a CORS-enabled `https://…` link instead of a local file.

## How it renders
- The model is auto-fitted: centred on X/Z, its base sat on the floor, and its
  largest dimension scaled to the **Fit Size (m)** you set (× **Scale**). So any
  model lands sensibly regardless of the units/origin it was exported with.
- **draco** and **meshopt** compressed GLBs load out of the box.
- A missing or unreachable URL shows a wireframe placeholder (never crashes the scene).

## Where to get models (use CC0 / clearly-licensed only)
- **Poly Haven** (CC0) — models + HDRIs, no attribution required.
- **ambientCG** (CC0) — models + PBR textures.
- **Kenney** / **Quaternius** (CC0) — stylised low-poly factory/industrial kits.
- **Khronos glTF Sample Assets** (mostly CC0/CC-BY) — good for testing.

Prefer **CC0**. Sources like Sketchfab and GrabCAD carry per-item licenses (many
are not free for commercial/redistribution use) — verify each model's license and
keep a note of attribution where required before shipping.

## Thermal Power Plant — "Imported Models" variant
The template **"Thermal Power Plant · Imported Models"** swaps hero units for real
imported models. It ships with two **CC0 models from Poly Haven** (no attribution
required, but credit is nice):

| Shipped file | Used as | Source |
|---|---|---|
| `exterior_aircon_unit/exterior_aircon_unit_1k.gltf` | Condenser (air-cooled unit) | polyhaven.com/a/exterior_aircon_unit |
| `power_box_01/power_box_01_1k.gltf` | Transformer (power cabinet) | polyhaven.com/a/power_box_01 |

Units without a shipped model (turbine, generator, cooling tower, …) stay as the
**detailed procedural components** — never a placeholder cube. To swap more units,
add a folder/file here and extend `HERO_MODELS` in
`src/lib/templates/thermalPowerPlant.js` (or just place an "Imported Model (glTF)"
asset manually and set its URL). Swapped units drop their pipe/bus-bar connections,
since an imported model has no ports.

## Tips
- Keep files reasonably small (a few MB); very heavy meshes will slow the scene.
- If a model needs different lighting, it still uses the scene's environment/lights.
- Remote URLs must send permissive CORS headers or the browser will block them.
