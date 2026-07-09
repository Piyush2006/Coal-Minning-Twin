# Unreal Engine "showcase mode" via Pixel Streaming — architecture & roadmap

> Planning doc only — **no code in this repo**. This is the path to Unreal-grade
> (Lumen/Nanite) fidelity in the browser, for when a client wants cinematic quality
> and will fund GPU. The default product stays the three.js twin (editable, cheap,
> scales to many users). Unreal is an optional *render backend for presentation*.

## Why it's not an "npm integration"
Unreal is a native C++ engine; it does not run inside a web page (the old HTML5/WASM
target was removed). The only way to show UE visuals in a browser is **Pixel
Streaming**: UE renders on a GPU server and streams H.264/VP8 video over **WebRTC**;
the browser shows the video and sends input back. So this is an *architecture + infra*
decision, not a library you import into the React app.

## Architecture (hybrid — keep this app as the shell)
```
┌─────────────────── Browser (this React app) ───────────────────┐
│  HUD / tree / inspectors / tooltips / data panels  (unchanged)  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  <PixelStreamView>  — WebRTC <video> + input forwarding    │  │
│  └───────────────▲───────────────────────────┬───────────────┘  │
└──────────────────│ WebRTC (video+input)      │ data (WS/MQTT)───┘
                   │                            │
        ┌──────────┴─────────┐        ┌─────────▼──────────┐
        │ Signalling server  │        │  Data bridge        │
        │ (matchmaker/STUN/   │        │  UNS/telemetry →    │
        │  TURN)              │        │  UE (JSON descr.)   │
        └──────────▲─────────┘        └─────────┬──────────┘
                   │ WebRTC                      │
        ┌──────────┴──────────────────────────── ▼ ─────────┐
        │  GPU server: Unreal app + Pixel Streaming plugin   │
        │  (Lumen GI, Nanite, path-traced materials)          │
        └────────────────────────────────────────────────────┘
```
- **Keep the React app** as the UI/data shell. Swap only the 3D `<Canvas>` for a
  `<PixelStreamView>` in "showcase mode"; everything else (auth, projects, panels,
  UNS binding) is reused.
- **Data bridge:** stream live values into UE via the Pixel Streaming *input/data
  channel* (`emitUIInteraction` / custom messages) or a side WebSocket/MQTT the UE
  app subscribes to. UE drives materials/gauges/animation from that data — same UNS
  topics you already resolve.

## What you build in Unreal (the real work)
1. **Rebuild/curate the twin in UE** — the three.js scene does **not** transfer.
   Import CAD/geometry via **Datasmith**, author PBR/Lumen materials, lay out the plant.
2. **Data-driven blueprints** — map incoming topic values → material params, emissive
   states, gauges, flow FX, alarm glows (mirror the app's rules/telemetry).
3. **Pixel Streaming plugin** — enable, expose the input channel, build a dedicated server.
4. **Camera/interaction parity** — orbit/select/frame driven by forwarded input so it
   feels like the app.

## Infra
- **GPU instances** (e.g. NVIDIA T4/A10-class) — one UE instance per *concurrent*
  session (a matchmaker can queue/rotate). Cost scales with concurrency, not signups.
- **Signalling + STUN/TURN** servers (Epic ships reference implementations).
- Autoscaling + session timeouts to control spend; a "request a live demo" gate rather
  than always-on.

## Effort & cost (rough, validate before committing)
| Item | Est. |
|---|---|
| UE project: rebuild plant + Datasmith + Lumen materials | weeks (largest chunk) |
| Data-driven blueprints (UNS → UE) | ~1–2 weeks |
| Pixel Streaming + signalling + matchmaker deploy | ~1 week |
| React `<PixelStreamView>` embed + input + data bridge | ~2–4 days |
| **Cloud GPU** | ~$0.5–1.5 / GPU-hour × concurrent sessions (ballpark) |

## Trade-offs vs staying on three.js
| | three.js (this app) | UE Pixel Streaming |
|---|---|---|
| Fidelity ceiling | very high (IBL, SSGI, path-tracer stills) — not Lumen/Nanite | cinematic |
| Cost / concurrent user | ~free (client device) | GPU $$ per session |
| Scale to many users | excellent | expensive |
| Editable, data-driven twin | native | rebuilt in UE |
| Runs on phone/laptop | yes | yes (it's video) |
| Ops burden | minimal | signalling + GPU fleet + autoscale |

## Not shortcuts
- **UE → glTF export** gives geometry + basic PBR only; Lumen/Nanite/materials do **not**
  export, so you lose the reason to use UE. It won't give "UE looks" in three.js.
- **Omniverse/USD** can interchange geometry, but three.js USD support is limited and
  still won't carry UE's realtime lighting.

## Recommendation / phasing
1. **Now:** push the free three.js realism stack (IBL + AgX + soft/contact shadows +
   N8AO + reflector floor + transmission + post grade; optionally SSGI via
   `realism-effects`, and a `three-gpu-pathtracer` "photo mode" for photoreal stills).
   This covers ~80–90% of perceived realism at ~zero marginal cost.
2. **Only if a client demands cinematic fidelity and funds GPU:** stand up a **UE
   Pixel Streaming showcase mode** as a *separate render backend*, embedded in this
   app via `<PixelStreamView>`, fed by the same UNS data bridge. Keep three.js as the
   default, scalable, editable product.

**Decision rule:** many concurrent web users + editing + low cost → three.js. A few
high-value, cinematic, presenter-led sessions with a GPU budget → UE Pixel Streaming.
