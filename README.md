# Blackridge Coal Mine — Digital Twin

A complete, self-contained mock digital twin of a coal mining operation
(pit → CHPP → stockyard → rail/port → end-use), plus the Digital Twin Creator
app (with all custom engine features) needed to render it.

| Folder | What it is |
|---|---|
| [`coal-mine-twin/`](coal-mine-twin/) | The twin **data**: build plan, 23 component specs, twin spec, merged `scene-export.json`, verification reports (`POLISH_REPORT.json`, `USECASE_REPORT.json`) and screenshots. |
| [`app/`](app/) | The Digital Twin Creator app snapshot (React + three.js / React-Three-Fiber) including every engine feature the twin uses: generic alert/threshold layer + alerts panel + severity rings, parametric benched pit terrain, GPU particle plumes, part-level articulation (dig cycles, drills), path-follow vehicles with dwell + visible load states (trucks haul loaded / return empty, wagons & ship holds fill), conveyor-vision CCTV with belt-point detection highlights, palette tokens, weathered/granular materials, sky + terrain environment. |

## Run it

```bash
cd app
npm install
npm run dev            # then open the printed URL
```

From the home screen: **From Template → "Coal Mine · Blackridge (Pit to Port)"**.
The template ships inside the app at `app/src/lib/templates/coalMine/` (same
content as `coal-mine-twin/`). Demo alert/detection trends fire on slow loops
within ~3 minutes.

## Notes

- **All data is mock/simulated.** No live feeds, no UNS topic bindings, and no
  insight IDs are configured anywhere. (The app source includes Faclon's
  optional IOsense cloud-sync feature, but it is dormant unless an account and
  target insight are connected in Settings — nothing here uses it.)
- `app/public/models/` binaries (optional CC0 glTF demo models for an unrelated
  template) are excluded to keep the repo small; see the README in that folder.
