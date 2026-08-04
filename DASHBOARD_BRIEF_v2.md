# Coal Mining Digital Twin — Dashboard Build Brief (v2)

**Read it completely before writing code.**

Companion: `coal-mining-digital-twin-blueprint.md` — that defines **what** (screens, KPIs, hierarchy, drill-downs). This defines **how** it looks, feels, and behaves, and where you have creative license.

Two things decide whether this succeeds: **the KPIs must be the ones a mine actually acts on**, and **the UI must be genuinely beautiful**. Neither alone is enough.

---

## 1. Your mandate, and your creative license

You know this codebase and the twin's actual data model. I don't. So:

**You must do this:**
- Inventory what the twin actually exposes: asset topology, live states, sensor streams, historical depth, alerts, spatial data.
- Map every KPI in §4 to one of: **fully supported** / **partially supported (say what's missing)** / **not supported**.
- Where a KPI isn't supported, **propose the closest thing the data genuinely supports** rather than faking it or silently substituting something that looks similar but means something different.

**You are explicitly encouraged to:**
- **Invent KPIs I haven't specified**, if the twin's data supports something more valuable. You know what's in there. Use it.
- Argue against anything in this brief that makes the product worse in practice. A reasoned objection is more useful than silent compliance.
- Design components I haven't described, if they serve the insight rules in §6 better.

**Every KPI — mine or yours — must pass one test:**

> Name the decision a mine manager, shift in-charge, or reliability engineer makes differently because of this number. If you can't name it in one sentence, cut the KPI.

---

## 2. The Twin Test — what separates this from a BI dashboard

A BI dashboard queries a database. A digital twin binds to a live model of a physical system. **All five of these must be visibly demonstrable in the UI**, or the product has failed its premise.

| # | Property | How it must show up |
|---|---|---|
| **T1** | **Live state binding** | What's on screen reflects the current physical state of named assets — not an aggregate query result. A truck is *queued at the crusher tip right now*, not "utilisation was 74% last week." |
| **T2** | **Topology awareness** | The system knows what's connected to what, so it can arbitrate cause. When the crusher chokes and six trucks queue, it raises **one** event with six linked consequences — not seven separate problems. |
| **T3** | **Time travel** | A global scrubber puts the *entire model* into a past state — asset states, alerts, flow rates, the map, all of it — and lets you watch the shift replay. Not a date filter on charts. |
| **T4** | **Spatial grounding** | Assets exist somewhere, and where they are matters. Queue congestion, exposure clustering, and haul-road degradation are spatial facts. |
| **T5** | **What-if** | You can ask the model a counterfactual and get an answer. |

**T5 is the cheapest high-impact feature in this build. Do not skip it.** Two concrete implementations, both small:

- **Screen 2 — fleet allocation slider.** Drag trucks between shovels. Match Factor, shovel hang time, truck queue time and projected shift tonnes all recompute live. Show the current allocation as a ghost so the delta is visible.
- **Screen 4 — deferral impact toggle.** On any predicted failure: "defer to next planned window" vs "act now." Show projected production impact, probability of failure before the window, and cost delta.

Both are transparent local calculations, not ML. Both are impossible in a BI tool. Both will be the most memorable thing in a demo.

---

## 3. Visual direction

The target aesthetic is **calm, minimal, premium light-mode SaaS** — soft white cards on a tinted canvas, large quiet numbers, generous space, almost no chart junk. Think Linear, Vercel dashboards, and the reference screenshots provided.

### 3.1 Tokens — implement once as CSS custom properties, never hardcode

**Surfaces**
```
--canvas:      #EBEEF4   /* tinted, NOT white — this is what makes white cards read as premium */
--surface:     #FFFFFF   /* cards */
--surface-2:   #F6F8FB   /* inner wells, table headers, chart tracks, inactive states */
--hairline:    rgba(16,24,40,0.06)   /* optional, only where a shadow isn't enough */
```

**Card treatment** — this is the single most important visual decision:
```
background: #FFFFFF;
border-radius: 16px;
box-shadow: 0 1px 3px rgba(16,24,40,0.04), 0 12px 32px -12px rgba(16,24,40,0.10);
border: none;
```
Soft, diffuse, low. Not a hard drop shadow. Cards float; they don't stamp.

**Text**
```
--text-primary:   #0D1117
--text-secondary: #525C6B
--text-tertiary:  #8A94A6
```

**Accent — exactly one**
```
--accent:      #2B5CE7
--accent-soft: #E9EFFE
```

**Chart series — max 5, never a rainbow**
```
--series-1: #2B5CE7   blue    (always "actual" / primary)
--series-2: #12A594   teal
--series-3: #E5871F   amber
--series-4: #7B5EA7   plum
--series-5: #5B6B7F   slate
--baseline: #A9B2C1   (plan, target, historical baseline — ALWAYS this, ALWAYS dashed, ALWAYS behind)
```
The plan/actual convention is absolute: dashed grey behind, solid blue in front, every chart, no exceptions. Applied consistently it removes the need for legends entirely.

**Status — locked semantics, never decorative**
```
Operating          #12A16E   solid fill
Idle (justified)   #E0A32E   wide diagonal hatch
Idle (unjustified) #EC7C30   tight diagonal hatch
Down — unplanned   #E04B4B   solid
Down — planned     #9AA4B4   cross-hatch
Degraded / at risk #F0913A   dotted
No data / gap      #DCE1E9   vertical stripe
```
These seven hues appear **only** to express asset state. Never as a chart series, never decoratively. The pattern fills are mandatory — this product will be used by people with colour vision deficiency, and status is safety information.

**Type**
- UI: **Inter**. Mono: **JetBrains Mono** for asset IDs, tag names, timestamps, raw values. The mono accent is a large part of what makes an industrial UI read as credible.
- **Every numeral uses `font-variant-numeric: tabular-nums lining-nums`.** Non-negotiable — proportional digits jitter on live values.
- Scale: `11 · 12 · 13 · 14 · 16 · 20 · 28 · 40 · 56 · 64`

**Invert the hierarchy — the single rule that does most of the work:**
- Card headings: **12px, uppercase, 0.06em tracking, `--text-tertiary`, weight 500.** Small and quiet.
- Hero numbers: **48–64px, weight 600, `--text-primary`, −0.025em tracking.**
- Supporting: 13px `--text-secondary`.

The number is the hero. The label is furniture. Every reference you sent does this.

**Shape and space**
- 4px base unit.
- Radius: cards 16, inner panels 12, controls 10, pills fully rounded, chips 6.
- Motion: 150ms ease-out. **Never animate a number counting up** — it reads as decorative and undermines trust in live data.

### 3.2 The density ladder

Your references run 4–6 cards per screen. That's correct for an executive view and wrong for an engineer's view. **Airiness decreases with depth. Same visual language, three settings.**

| Level | Screens | Card padding | Row height | Elements on screen |
|---|---|---|---|---|
| **Airy** | 0 (Mine Pulse) | 28px | — | 6–8 cards max, big hero numbers, lots of canvas showing |
| **Balanced** | 1, 5, 7 | 20px | 40px | 8–12 elements, hero numbers 40px |
| **Working** | 2, 3, 4, 6, 8 | 16px | 36px | Dense tables, timelines, 40+ rows — still white cards and soft shadows, just tighter |

This is what lets a minimal aesthetic survive real industrial data volume. Don't apply executive spacing to a 40-row asset table; it will require scrolling to see six assets and the product will feel useless.

### 3.3 Chart specifications

- **Gradient area fill: allowed**, single hue only, `--accent` from 16% → 0% opacity, on the primary series only. (Reference 3 does this well — match it.)
- **Bars:** 4–6px top radius, max 28px wide, square at baseline.
- **Ghost track bars:** put a `--surface-2` track behind each bar showing capacity/target, with the actual bar drawn inside it. This is the single best pattern for mining — *actual TPH inside design TPH*, *actual tonnes inside plan* — and it removes the need for a second series entirely. Use it heavily.
- **Lines:** 2px, round cap and join. End-dot 8px filled with a 2px white ring.
- **Gridlines:** horizontal only, max 4, `#EDF0F5`. Never vertical on a time axis.
- **Tooltip:** black pill — `#0D1117`, 8px radius, white 12px text, 8px/12px padding, with a 1px vertical crosshair in `--accent` at 30% opacity. Signature of your references; adopt it exactly.
- **Filters/selectors:** fully-rounded pills, `--surface-2` background, 13px, chevron. Not boxy selects.
- **Legends:** omit when ≤3 series and direct end-labels fit. Which, with the plan/actual convention, is most of the time.

### 3.4 Banned — automatic rejection

**Charts:** pie, donut, radial progress rings (sole exception: Match Factor, where the band genuinely matters) · 3D charts of any kind · dual y-axes · multi-hue rainbow series · vertical gridlines · bevels, outlined points, chart shadows · entry animations on data.

**Style:** glassmorphism, frosted panels, backdrop blur · purple→pink or blue→purple gradients · "AI sparkle" purple · emoji as icons · decorative cartoon illustrations · marketing hero banners · a uniform grid where every card is identical in size (hierarchy needs size variation) · skeleton loaders that don't match the shape of what they replace.

**Content:** `Math.random()` in any component · "Asset 1" / "Metric A" / lorem ipsum · any number without a comparator · any card without a plain-language reading (§6) · a section titled "Insights" or "AI Insights".

---

## 4. KPIs — tiered

### Tier A — must have. These earn the executive screen. Six, no more.

| KPI | The decision it changes |
|---|---|
| **Coal output vs plan + projected shift close** | Whether to intervene now or ride the shift out. The *projection* is what makes it leading rather than lagging. |
| **Production loss attribution (waterfall)** | Which of seven possible causes to attack, in tonnes. This is the centrepiece of the whole product. |
| **Shift constraint / bottleneck of record** | Where to spend the next hour, and where to spend the next capex. Stops mines optimising non-constraints. |
| **Fleet availability + utilisation (split justified vs unjustified idle)** | Whether the problem is maintenance or operations. That split alone ends months of misdirected blame. |
| **Critical asset risk (production-weighted)** | How fragile the week is. Production-weighted, so one overland conveyor outranks fifteen light vehicles. |
| **Safety exposure (leading, not lagging)** | Where the next incident is being manufactured. Proximity events, zone intrusions, overspeed — not last quarter's LTIFR. |

### Tier B — the core working set. Build all nine unless the data genuinely can't support one.

Truck–shovel match factor · haul cycle decomposition (spot/load/haul/dump/queue, with baseline drift) · payload compliance and bucket fill factor · belt loading utilisation and **empty-belt running hours** · crusher feed stability and choke loss · asset health index with visible contributing factors · failure risk forecast (**horizon-bounded, never "RUL = 43 days"**) · specific energy consumption by node · overburden removal and stripping ratio adherence.

Two notes:
- **Empty-belt running hours is the fastest visible win in the product.** A multi-MW conveyor running empty for two hours a shift is pure burned money, it's detectable from a belt weigher and a run signal alone, and the number is always shocking. Give it prominence.
- **Failure risk must be horizon-bounded with a maturity badge.** "Elevated risk of drive-end bearing failure within 14 days, confidence medium, based on 3 similar signatures" is defensible. "RUL: 43 days" is not, and one confidently wrong number destroys trust in every model in the platform.

### Tier C — good to have. Build only if the data supports it and time allows.

Coal quality conformance against grade bands · rake cycle and demurrage exposure · production reconciliation gap (node-to-node mass balance) · TKPH tyre thermal risk · dewatering specific energy and monsoon headroom.

### Mandatory regardless of tier

**Data confidence.** Every KPI knows the health of its own inputs and degrades visibly when they fail. A dead sensor producing a confidently wrong number is worse than a missing one. This isn't a displayed KPI — it's a property of every displayed KPI (see §6, R6).

---

## 5. 3D — exactly one, and it must be quiet

3D is permitted **once**, as a Pit View on Screen 1 (toggleable with a 2D map, which is the default on first load). Done wrong it destroys the minimalism instantly. The version that works:

**Do:**
- **Stylised, not survey-accurate.** Concentric bench terraces, a haul road spiral, dump areas, a CHP block. You don't have survey data and shouldn't pretend to.
- **Matte clay material**, one hue from the canvas family (`#DDE2EB`–`#F0F2F6` range). No textures, no maps, no specular.
- **Lighting:** soft ambient + one weak directional. Ambient occlusion only. No cast shadows that read as dramatic.
- **The only colour in the entire scene is equipment markers, coloured by status.** Small extruded cylinders or pills. That's it. The restraint is what makes it beautiful.
- **Camera:** locked isometric-ish orbit, limited pitch, snap-back. No free-fly.
- **Budget:** under 30k triangles, 60fps, graceful degradation to 2D.
- react-three-fiber + drei.

**Never:** 3D bar/pie charts · extruded text · glossy or metallic materials · rim lighting, bloom, God rays · particle effects · dust or weather VFX · a camera that swoops on load.

The test: **screenshot it in greyscale.** If it still reads as calm and architectural, it's right. If it looks like a video game, start over.

---

## 6. Insight rules — how this stops being pretty charts

Enforced, checkable in review.

**R1 — No naked numbers.** Every metric shows value + comparator + signed delta. `4,180 t` is a defect. `4,180 t · −620 vs plan · 87%` is correct.

**R2 — Every card carries one sentence of plain language.** Generated from the data, in the words a shift in-charge would use. Build it as a `<Reading>` component sitting under the hero number, 13px, `--text-secondary`.

> ✅ "Crushing has been the constraint for 41% of this shift — about 310 t."
> ✅ "CV-01's drive motor is 11 °C above expected but vibration is flat: cooling path, not a bearing."
> ❌ "This chart shows crusher throughput over time."

**If you can't write a meaningful reading for a card, the card shouldn't exist.** This rule alone will kill three or four cards you were about to build, and the dashboard will be better for it.

**R3 — Every time-series has an annotation layer.** Shift boundaries, blast events, rainfall, planned stoppages, alerts, maintenance actions — thin vertical rules with small labelled markers. This is what turns a line into an explanation and it's the highest-value chart feature in the product.

**R4 — Nothing is a dead end.** Every metric, bar and row either navigates deeper or is marked terminal. Any alert reaches its full diagnosis — hypothesis, evidence, consequence, recommended action, owner — in **two clicks or fewer**.

**R5 — Raw sensor values never appear alone.** `82 °C` is banned. `82 °C · +11 vs expected · ↑3.1 °C/h` is correct. Enforce with a `<SensorValue>` component that *requires* a deviation prop.

**R6 — Five states, all designed:** loading · empty · **partial data** (name which source is missing, mute the affected number) · **learning** (new asset, no baseline, "12 days to baseline") · **data gap** (render the stripe pattern — never interpolate silently).

**R7 — The comparison basis is user-selectable.** One control per screen: plan / previous shift / 7-day average / same shift last week. Every card on the screen responds.

---

## 7. Bespoke components — hand-build these

These four are the product's identity. Build as custom SVG. A chart library will make them look generic and you'll spend longer fighting it than writing the SVG.

1. **Loss attribution waterfall** — horizontal. Plan → ordered loss bars → actual. Width ∝ tonnes. Fill pattern encodes controllability. Consequences nest *inside* their cause, not beside it. Show the residual honestly. Give this the most care of anything in the build.
2. **Constraint ribbon** — horizontal shift timeline, segmented by which stage was binding. Must be legible with no legend.
3. **Equipment state timeline (Gantt)** — one row per unit, status colours and patterns. Canvas past ~30 rows. X-axis synced to the global scrubber.
4. **Live process chain** — node-link diagram: faces → loading → haulage → crusher → conveyors → CHP → silo → dispatch. Nodes show current/capability TPH and unit counts; edge stroke width ∝ flow; buffers show fill level; constraint node emphasised. This should be the most impressive thing in the app.

Standard lines, bars and areas may use the existing chart library, styled to §3.

---

## 8. Demo data — this decides whether the demo lands

Data is the difference between a beautiful shell and something a mining client believes. Build a **deterministic, seeded fixture** of one scripted 8-hour B-shift.

### The narrative

| Time | Event |
|---|---|
| 14:00 | Shift opens. Plan 4,800 t. On pace. |
| 14:20 | CV-01 conveyor drive motor begins drifting +0.4 °C/h above its load-and-ambient baseline. Vibration flat. |
| 15:10 | Shovel 2 fill factor falls 0.97 → 0.89. Source: Bench 4, fed by blast B-114, fragmentation P80 up 34%. |
| 16:35 | Oversize reaches the primary crusher. Feed rate destabilises, power draw goes erratic. |
| 16:52 | **Crusher 1 chokes.** 52-minute clear-out. |
| 16:55–17:44 | Cascade: surge bin empties, CV-01 runs effectively empty 41 min, six trucks queue at the tip, Shovel 1 hangs 28 min. |
| 18:30 | Recovery. Fleet re-sequenced to Shovel 1. |
| 19:15 | CV-01 now +11 °C, drifting 3.1 °C/h. Diagnosis fires: degraded cooling path, not a bearing. Recommended window 22:00 changeover. |
| 20:05 | Rake placed. Weighbridge queue delays release 34 min → demurrage. |
| 22:00 | Close: **4,180 t vs 4,800 t plan (87%)**. |

### Loss attribution must reconcile exactly

| Bucket | Tonnes |
|---|---|
| Crushing (choke + clear-out) | 310 |
| Face/loading (fill factor, from fragmentation) | 185 |
| Dispatch (weighbridge/rake delay) | 70 |
| External (scheduled blast window) | 40 |
| Unexplained / residual | 15 |
| **Total** | **620** |

Conveyor starvation and truck queueing are recorded as **consequences of the crushing event**, nested inside that bar — not as separate losses.

**This is the hard part and the point of the whole exercise.** A naive implementation double-counts the queue and the starvation and reports ~1,400 t of loss. The waterfall won't sum, and a mining client will spot it in the first meeting. Get the arbitration right.

### Realism rules

- **Physical consistency holds.** Energy tracks throughput. Motor temperature tracks load and ambient. A queued truck is not simultaneously recorded as hauling. Belt tonnage reconciles to summed truck payloads within a stated tolerance.
- **Realistic magnitudes.** Haul trucks 100–240 t. Overland conveyor 1,000–4,000 TPH. Primary crusher ~1,200 TPH. Conveyor drive motors 400–1,600 kW. GCV 3,400–4,200 kcal/kg. Ambient 28–44 °C.
- **Realistic naming.** `SH-02`, `DT-214`, `CV-01`, `CR-01`, `P-07`, `Bench-4`, `B-114`. Never "Asset 1".
- **Signals look human, not synthetic.** No smooth sine waves. Real data has plateaus, spikes, shift-change discontinuities, and occasional dropouts.
- **Include one deliberate data-quality defect** — a stuck sensor on a named asset — so the partial-data and confidence-badge states are demonstrable rather than theoretical.
- **Scale:** 40 haul trucks, 4 shovels, 2 surface miners, 1 primary crusher, 6 conveyors, 3 dewatering pumps, 12 health-scored assets, ~14 alerts across four severities, 3 rakes, and **30 days of trailing history** so every baseline, delta and comparator is real.

---

## 9. Build order — stop at every gate

**Step 0 — Reconnaissance, no code.** Report per §1: what the twin supports, what it doesn't, what you'd change in this brief, and your plan for Step 1 only. Wait for approval.

**Step 1 — Design system + component gallery** at `/design-system`. Every token, the type scale, all seven status colours with pattern fills, buttons/pills/badges/chips, `<Metric>`, `<Reading>`, `<SensorValue>`, confidence badge, alert card, table row, and **all five states from R6** for each.
*Gate: I approve the visual language here, once, before it's applied nine times. Expect 2–3 rounds. That's the point.*

**Step 2 — Data contract + golden-shift fixture**, including the cascade arbitration.
*Gate: the waterfall sums to 620 t with consequences correctly nested.*

**Step 3 — Persistent chrome.** Time scrubber (fully functional replay), twin navigator, action-center rail with reason-code closure.
*Gate: scrubbing to 16:52 visibly changes asset states, alerts and flow rates — not just chart ranges.*

**Step 4 — Screen 0: Mine Pulse.** Airy density. Loss waterfall and constraint ribbon as real components.
*Gate: from the "Crushing — 310 t" bar I reach the 16:52 choke diagnosis in two clicks.*

**Step 5 — Screen 1: Production Flow & Constraint**, with the process chain hero and the 3D pit view.
*Gate: the constraint node is identifiable in under three seconds without reading a label. The 3D passes the greyscale test.*

**Step 6 — Screen 2: Fleet**, including the what-if allocation slider (T5).

**Step 7 — Screen 4: Asset Health**, driven end-to-end by the CV-01 story, including the deferral-impact toggle (T5).
*Gate: the diagnosis correctly distinguishes cooling-path from bearing, and shows flat vibration as the visible evidence for why.*

**Step 8 — Remaining screens**, one at a time.

---

## 10. Acceptance — every screen passes all six

1. **Squint test.** Blur it. The most important thing must still dominate. If everything is equally loud, the hierarchy failed.
2. **Five-second test.** A shift in-charge glancing for five seconds can say what's wrong and where.
3. **"So what" test.** Point at any element; name the decision it changes. No answer → delete it.
4. **Screenshot test.** One screenshot must be immediately distinguishable from a generic BI dashboard. If it could be Power BI in different colours, §3 and §7 have failed.
5. **Degradation test.** Kill a data source and reload. The screen names the missing source and mutes the affected numbers. It doesn't render a confident wrong number and it doesn't crash.
6. **Twin test.** Point at where each of T1–T5 is visible on this screen, or explain why that property doesn't apply here.

---

## 11. Performance

Thousands of assets at 1 Hz in production. Build for it now.

Virtualise tables past 50 rows · downsample series before render (LTTB, ≤2,000 points) · canvas over SVG past ~30 timeline rows or ~5,000 points · memoise transforms, never transform in render · live updates patch state rather than refetch and remount · targets: first paint <1.5s, scrubber interaction <100ms, 60fps while scrubbing and while orbiting the 3D view.

---

## 12. When you're unsure

Ask. Specifically:

- If the data can't support a KPI, **say so and propose the closest honest alternative.** Never substitute something that looks similar but means something different — that's the one failure mode a domain expert will catch immediately and never forgive.
- If a drill-down has no data behind it, build the navigation and render the learning or partial-data state. Don't fabricate.
- If something here makes the product worse, argue it. This brief is opinionated on purpose, but it isn't infallible.
