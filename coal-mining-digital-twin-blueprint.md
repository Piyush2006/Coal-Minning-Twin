# Coal Mining Digital Twin — Dashboard Blueprint

**Prepared for:** Faclon Labs — Mining Vertical
**Audience:** Product Designer, Solution Architect, Delivery Lead, Client Stakeholders
**Status:** v1.0 design specification, ready for design sprint
**Deliverable type:** Product + UX + data architecture blueprint (not a visual mock)

---

## 0. Scope, assumptions, and what must be confirmed before design starts

This blueprint is written for the most common Indian coal asset: a **large opencast mine**. Everything below changes materially if the assumptions are wrong, so confirm these in the kickoff workshop before a designer opens Figma.

| # | Assumption | Why it matters | If wrong, what changes |
|---|---|---|---|
| A1 | Opencast, 3–15 MTPA, shovel–dumper fleet with some surface miners | Drives the whole fleet-cycle layer | Underground → replace Screens 2–3 with the UG module (Appendix A); gas, strata and ventilation become Tier 0 |
| A2 | Coal Handling Plant with primary crusher, screens, overland conveyor, silo/rapid loading | Drives fixed-plant and conveying screens | No CHP (direct road sale) → collapse Screens 3 and 7, weighbridge becomes the primary measurement node |
| A3 | Mixed dispatch: rail rakes + road trucks | Drives dispatch KPIs and demurrage exposure | Pure conveyor-to-pithead-power-plant → dispatch becomes a throughput problem, not a logistics one |
| A4 | Significant MDO / contractor fleet | Contractor equipment data is contractually, not technically, gated | If client-owned fleet, Wave 1 instrumentation gets 3–4 weeks faster |
| A5 | Existing SCADA at CHP, siloed OEM telematics, ERP for maintenance/dispatch, no unified historian | Determines integration effort vs. greenfield instrumentation | Existing historian (PI/Ignition) → Wave 0 shrinks to connectors, not gateways |
| A6 | 3 × 8-hour shifts, monsoon shutdown/derate period | Every "vs. plan" comparison and every ML baseline is shift- and season-aware | Continuous ops → simpler baselining |

**Non-negotiable design constraint:** this is a **safety-adjacent industrial system in a DGMS-regulated environment**. Nothing in this product replaces a statutory instrument or a statutory record. Gas monitoring, ventilation, and collision-avoidance displays are **advisory overlays** on top of the legally mandated systems. This must be visible in the UI, not buried in a T&C.

---

## 1. Problem understanding — the actual job to be done

A mine manager does not have a data problem. They have three problems, in this order:

1. **"Am I going to make the number this shift, and if not, what is stopping me right now?"** — answerable only with live equipment state, and today it is answered by radio calls and a whiteboard.
2. **"Why did I miss last month, in tonnes, attributed to a cause I can act on?"** — today answered by a post-hoc production meeting where every department blames the other, because nobody has timestamped, arbitrated loss attribution.
3. **"What is going to break, and can I fix it in a window that doesn't cost me coal?"** — today answered by calendar-based PM and breakdown response.

Everything in this dashboard exists to answer one of those three. **If a proposed KPI does not serve one of them, it does not ship.**

The reason this cannot be a BI dashboard: none of those three questions can be answered from ERP data. ERP knows a truck was in the workshop; it does not know the truck spent 41 minutes queued behind a choked crusher, that the choke was caused by oversize from a poorly fragmented blast on Bench 4, and that the same signature has occurred eleven times this month. **That chain — from raw signal to arbitrated cause to a named owner with a deadline — is the product.**

---

## 2. Six challenges to the proposed structure

The brief proposed nine tabs. I am recommending a different structure. Here is the reasoning, because the designer will need to defend it.

**Challenge 1 — Do not organise the product by data type.**
"Safety & Computer Vision", "AI / Predictive Insights", "Energy" as sibling tabs organises the UI around *how Faclon collected the data*, which is a vendor-centric taxonomy. The user does not think "let me go to the CV tab." They think "why is the crusher stopping." **Organise by decision, not by sensor modality.** AI and CV are not sections; they are the substrate of every section. A "AI Insights" tab is an admission that AI has not been integrated into the workflow.

**Challenge 2 — The digital twin is not a tab, it is the navigation spine.**
If the twin is a page you visit, it is a screensaver. The twin should be the *object model* the entire product navigates through: every drill-down is a traversal of the asset/process graph. There should be a persistent twin navigator (map + process chain) that changes what every other screen is scoped to.

**Challenge 3 — The Action Center is not a tab, it is a persistent rail.**
Alerts placed in a tab are alerts nobody reads. It must be a persistent right-hand rail present on every screen, and it must be a **work queue with mandatory closure reason codes** — because those reason codes are the only realistic source of supervised training labels for years 1–2. This is the single highest-leverage design decision in the document.

**Challenge 4 — Merge "Equipment / Asset Health" and "Maintenance & Reliability".**
Separating condition (what the sensor says) from work (what the technician does) institutionalises the exact handoff gap that kills every CBM programme. One workspace, two modes: *Condition* and *Work*, sharing one asset list.

**Challenge 5 — The brief is missing the layer where the money actually leaks: Coal Quality & Dispatch.**
Grade slippage against GCV bands, blend deviation, rake demurrage, and road-sale reconciliation are frequently worth more per year than a few percent of availability, and they are largely invisible to the client today. Add it as a first-class screen.

**Challenge 6 — The executive screen should be one object, not a KPI grid.**
A tile wall of twelve numbers is the failure mode of every mining dashboard ever built. The executive screen should be dominated by **one instrument: the Production Loss Waterfall**, with the pace-to-target line above it. Everything else is supporting context.

---

## 3. The intellectual core — the Signal Ladder

This is the framework the whole product is built on and the thing that differentiates Faclon from a Power BI deployment. Every signal in the mine climbs six rungs. **The dashboard's job is to show rungs 2–5, not rung 0.**

| Rung | Name | What it is | Who produces it |
|---|---|---|---|
| **L0** | Raw measurement | The number the device emitted | Sensor / PLC / meter / camera frame |
| **L1** | Contextualised | The same number, with operating context attached (load, ambient, run-hours, product, shift, operator, location) | Edge + asset model |
| **L2** | Derived feature | Deviation from expected, rate of change, residual against a learned baseline, statistical stability | Feature engineering layer |
| **L3** | Diagnostic | A named failure mode or loss cause, with evidence | Rule library + multivariate models |
| **L4** | Predictive | Bounded-horizon probability of a specific event | ML models with maturity rating |
| **L5** | Prescriptive | A specific action, a window to do it in, an owner, and a quantified consequence of inaction | Optimiser + business rules |

### Worked example A — conveyor drive motor temperature (the brief's example, completed)

| Rung | Output |
|---|---|
| L0 | Winding temp 82 °C, motor current 148 A, sampled 1 Hz |
| L1 | 82 °C at 78% rated load, 41 °C ambient, 4 h 12 min continuous run, belt loading 61% |
| L2 | **ΔT = +11 °C above the load-and-ambient-expected baseline** (baseline learned from 90 days of the same operating envelope). **dT/dt = 3.1 °C/h vs. 0.8 °C/h historical.** Temp-vs-current residual has drifted monotonically for 14 days. Vibration velocity RMS unchanged (ISO 20816 Zone B). |
| L3 | Signature = rising temp + rising current + **flat vibration** + falling cooling-air ΔT → **degraded cooling path (fouled fins / blocked filter)**, *not* a bearing fault. Vibration being flat is what rules the bearing out — this is the diagnostic content, and it is invisible on any single-sensor chart. |
| L4 | At current drift, thermal trip threshold reached in ~62 running hours. P(trip before end of Thursday B-shift) = 0.34. Model maturity: **Medium** (physics-informed, 3 confirmed historical instances). |
| L5 | **Clean cooling fins during the 14:00 belt changeover window (est. 25 min, no production loss).** If deferred: expected 3.2 h unplanned conveyor stoppage ≈ 2,100 t deferred coal ≈ ₹X at realised grade. Owner: Electrical Maintenance. SLA: 48 h. |

**Design rule for the designer:** *no L0 value may appear on any screen above Hierarchy Level 4 without an L2 companion.* "82 °C" alone is banned above the parameter view. "82 °C (+11 °C vs. expected, rising 3.1 °C/h)" is permitted.

### Worked example B — haul truck payload

L0: 218 t recorded on strut pressure. → L1: 218 t on a 220 t-rated unit, uphill route R3, Shovel 2, operator shift B, tyre temp 71 °C. → L2: **payload compliance vs. the 10/10/20 policy** (≤10% of loads over 110%, none over 120%); fill-factor 0.91 vs. 0.97 fleet median; **cycle time +2.3 min vs. route baseline**. → L3: chronic underloading on Shovel 2 correlates with poor fragmentation (P80 up 34% since Blast B-114) — the shovel cannot fill the bucket. → L4: at current fill factor, projected shift shortfall 640 t. → L5: **Re-sequence to Shovel 1 for the next 3 h; issue fragmentation feedback to the drill-and-blast engineer for Bench 4 pattern.** The blast is the root cause of a haulage KPI. No BI tool will ever find that.

### Worked example C — a camera on the crusher feed

L0: video frame. → L1: frame + belt speed + belt weigher TPH + crusher power draw. → L2: **particle size distribution P80 = 412 mm; oversize fraction 6.1%; foreign object detected (confidence 0.87)**. → L3: choke event predicted; feed instability index elevated. → L4: P(choke within 20 min) = 0.61. → L5: **reduce apron feeder speed 15% for 8 min**, or dispatch to divert. Consequence of inaction: 45–90 min crusher clear-out plus a truck queue cascade.

**This is the message to the client:** a camera is not a video feed, a thermocouple is not a temperature, and a GPS is not a dot on a map. Each is the bottom rung of a ladder whose top rung is a decision.

---

## 4. Information hierarchy

Five levels, exactly as the brief proposed, with the addition of hard navigation rules.

| Level | Scope | Primary question | Typical dwell time |
|---|---|---|---|
| **L1** | Mine | Are we making the number? What is stopping us? | 30 s, checked 5–10×/day |
| **L2** | Area / process stage (Pit, Haulage, Crushing, Conveying, CHP, Dispatch, Dewatering) | Which stage is constraining, and why? | 2–5 min |
| **L3** | Equipment / unit (Shovel 2, Conveyor CV-04, Crusher 1, Truck 214, Pump P-7) | What is this machine's state, health, and history? | 5–15 min |
| **L4** | Sensor / parameter | What is the raw and derived signal doing? | Specialist only |
| **L5** | AI diagnosis, root cause, recommended action | What do I do, by when, and what happens if I don't? | The destination |

### Navigation rules (enforce in design review)

1. **Any alert reaches L5 in ≤2 clicks.** Not "click alert → asset page → find the AI tab."
2. **Context carries down and back.** Time window, shift, area filter and the twin selection persist across every level. Breadcrumb is always visible and always clickable.
3. **L5 is reachable from L1.** The loss waterfall bars are the shortcut: click "Crushing losses — 1,840 t" → the ranked list of crushing loss events → the diagnosis for the largest one.
4. **The global time scrubber changes everything.** A single shift/date/time-range control at the top puts the *entire application*, including the twin map and equipment states, into that historical state. This is "Shift Replay" (§9) and it is the answer to "what happened during that shift?"
5. **No dead ends.** Every number on every screen either drills down or explicitly states "terminal metric."

---

## 5. Screen architecture

Nine screens, three persistent elements. Not nine tabs of KPIs.

| # | Screen | Primary persona | The one question it answers | Refresh |
|---|---|---|---|---|
| **0** | **Mine Pulse** | GM, Mine Manager, Owner | Will we make the number, and what is the single biggest thing stopping us? | 30 s |
| **1** | **Production Flow & Constraint** | Production Manager, Shift In-charge, Control Room | Where is the chain constrained right now, and where is coal being lost? | 10 s |
| **2** | **Fleet & Cycle Intelligence** | Mine Captain, Dispatch, Fleet Manager | Are shovels and trucks matched, and where is cycle time leaking? | 30 s |
| **3** | **Fixed Plant & Conveying** | CHP Manager, Control Room Operator | Is the plant running stable, loaded, and clear? | 5–10 s |
| **4** | **Asset Health & Reliability** | Reliability Engineer, Maintenance Planner, Electrical Head | Which assets are degrading, what is the failure mode, when do I intervene? | 5 min |
| **5** | **Energy & Consumables** | Energy Manager, Finance, Mine Manager | What are we spending per tonne, and where is it being wasted? | 1 min |
| **6** | **Safety, Environment & Compliance** | Safety Officer, Environment Officer, Mine Manager | Are we exposed right now, and are we defensible to DGMS/CPCB? | Real-time for critical, 5 min otherwise |
| **7** | **Coal Quality & Dispatch** | Quality/Sales, Dispatch Manager, Finance | Are we selling the grade we think we are, and are we losing money on logistics? | 5 min |
| **8** | **Shift Report & Analysis** | Everyone, at handover | What happened, who owns what, what carries to the next shift? | On demand |

### Three persistent elements (present on all screens)

- **Twin Navigator (left rail, collapsible):** the mine as an object tree + a toggle to the geo-map. Selecting a node scopes the entire screen. This is the twin doing work.
- **Action Center (right rail, collapsible):** the live, owned, SLA-bound work queue. Never hidden behind a tab.
- **Time Scrubber (top bar):** Live / Shift / Day / Custom. Puts the whole app into replay.

### Persona → landing screen mapping (configurable, with a sane default)

| Role | Lands on | Also has |
|---|---|---|
| Mine GM / Owner | Mine Pulse | Weekly digest email, mobile summary |
| Production Manager / Shift In-charge | Production Flow & Constraint | Fleet, Shift Report |
| Control Room Operator | Fixed Plant & Conveying | Production Flow, Action Center expanded |
| Reliability / Maintenance | Asset Health & Reliability | Energy, Action Center expanded |
| Safety Officer | Safety, Environment & Compliance | Shift Report |
| Quality / Dispatch | Coal Quality & Dispatch | Production Flow |
| Energy Manager | Energy & Consumables | Fixed Plant |

Enterprise requirements assumed throughout: SSO/SAML, RBAC down to area and asset-class level, full audit log on every acknowledgement and threshold change, per-tenant configurability of thresholds and shift calendars, and export/API access for the client's own BI team (which will exist and will want the data — do not fight it, expose a clean semantic layer).

---

## 6. The KPI set — 20 operational KPIs, not 50

Discipline statement: **six KPIs appear on the landing screen. Twenty exist in the entire product.** Everything else is a drill-down attribute, not a KPI. A rejected list follows in §7 — read it, because saying no is the harder half of the work.

Each KPI is specified with the ten fields requested. Classification key:

- **Category:** Monitoring / Analytics / Diagnostic / Predictive / Prescriptive
- **Type:** Real-time (RT) / Lagging (LAG) / Leading (LEAD) / Predictive (PRED)

---

### TIER 0 — Mine Pulse (6 KPIs)

---

#### K1. Saleable Coal Dispatched vs. Plan (with Projected Shift Close)

1. **Name:** Coal Dispatched vs. Plan / Projected Close
2. **Measures:** Cumulative saleable tonnes across the measurement boundary (CHP outfeed weigher + weighbridge + wagon load) against the shift/day/month plan, plus a forward projection of where the shift will end at the current realised rate.
3. **Why it matters:** It is the only number the GM is judged on. The *projection* is the innovation — it converts a lagging score into a leading warning with 4–6 hours of runway to react, which is the difference between recovering a shift and reporting a miss.
4. **Formula:**
   `Actual = Σ belt weigher net tonnes (CHP outfeed) + Σ weighbridge net (road) — internal transfers`
   `Pace-normalised projection = Actual + (Remaining productive minutes × Realised TPH_trailing60min × Availability-adjusted derate)`
   `Attainment % = Actual / Plan_to_date`
5. **Data sources:** Belt weighers (outfeed + wagon loading), weighbridge, rake loading system, shift plan from ERP/production plan, live equipment states.
6. **Origin:** IoT sensors (belt weighers) + PLC/SCADA (weighbridge, RLS) + ERP (plan) + AI/ML (projection model). **Combination.**
7. **Timing:** Real-time with a lagging comparator and a predictive projection.
8. **Action:** Below pace by >5% at the 3-hour mark → shift in-charge re-sequences the fleet, defers a planned stoppage, or escalates. Above pace → release a maintenance window.
9. **Visualisation:** Large numeric + **cumulative step-line vs. a straight pace-to-target line**, with a shaded projection cone (P10–P90) to shift end. Not a gauge; gauges hide rate.
10. **Drill-down:** → K2 Loss Waterfall → the loss category → the specific events → L5 diagnosis.

---

#### K2. Production Loss Attribution Tree ★ *the centrepiece of the product*

1. **Name:** Production Loss Attribution (Loss Waterfall)
2. **Measures:** The gap between planned and actual coal, decomposed into **mutually exclusive, tonnage-denominated loss buckets** with arbitrated causation.
3. **Why it matters:** Today the production meeting is an argument. This ends the argument. It is also the only structure that lets the client rank improvement projects by tonnes rather than by opinion. **This single instrument justifies the deployment.**
4. **Formula:** For each loss bucket *b*:
   `Loss_b (t) = Σ (constrained_minutes_b × reference_TPH_of_the_constrained_stage)`
   with **cascade arbitration**: when Stage *n* stops and Stages *n−1..1* subsequently idle, the entire tonnage is attributed to Stage *n*; downstream idling is recorded as a *consequence*, not a separate loss. Buckets: Face/Loading · Haulage · Crushing · Conveying · CHP/Plant · Dispatch · External (weather, blasting window, power outage, statutory, labour). Residual/unexplained is its own bucket and must be shown — hiding it destroys trust.
5. **Data sources:** Equipment state timelines (all assets), belt weighers, buffer/bin levels, GPS/geofence for queueing, weather station, grid meter, ERP downtime codes for corroboration.
6. **Origin:** **Combination** — PLC/SCADA + IoT + AI/ML (the arbitration engine is the ML component; naive attribution double-counts and will be rejected by the client within a week).
7. **Timing:** Real-time accumulating, lagging at shift close, with a leading component (open losses still accruing are flagged live).
8. **Action:** Weekly: the top bucket becomes the improvement project. Live: the currently-accruing bucket tells the shift in-charge what to attack in the next 20 minutes.
9. **Visualisation:** **Horizontal waterfall**, plan at top, actual at bottom, each bar sized in tonnes and colour-coded by controllability (controllable / partially / external). Secondary: a stacked-area "loss accumulation over the shift" so timing is visible.
10. **Drill-down:** Bucket → ranked event list (duration, tonnes, asset, arbitrated cause) → event → L5 diagnosis + evidence charts + linked work order.

---

#### K3. Overburden Removal & Stripping Ratio Adherence

1. **Name:** OB Removal vs. Plan / Stripping Ratio Adherence
2. **Measures:** Bank cubic metres of overburden moved vs. plan, and the realised stripping ratio (BCM OB per tonne coal) against the mine plan ratio.
3. **Why it matters:** OB is the leading indicator of *next quarter's* coal. A mine that hits coal targets while under-stripping is borrowing from the future and will hit a wall in 2–3 quarters. This is the single most under-monitored strategic risk in opencast coal.
4. **Formula:**
   `OB BCM = Σ (truck payload_t / in-situ density) or drone/LiDAR volumetric differencing (authoritative)`
   `Realised SR = Cumulative OB BCM / Cumulative Coal t`
   `Adherence = Realised SR / Planned SR`
5. **Data sources:** Truck onboard payload + material-type classification (from load location geofence), shovel payload, drone photogrammetry / LiDAR survey (monthly authoritative reconciliation).
6. **Origin:** IoT sensors (payload) + GPS/geofencing + drone survey + ERP mine plan. **Combination.**
7. **Timing:** Real-time accumulating, **leading indicator** for future production.
8. **Action:** SR adherence <0.95 for two consecutive months → re-balance fleet allocation toward OB, or escalate to the mine plan review. This is a board-level conversation.
9. **Visualisation:** Dual-axis cumulative curve (coal + OB vs. their plans) with a **SR adherence trend band**; sequencing-risk callout when adherence breaches.
10. **Drill-down:** → by bench/block → by shovel-dump pair → haul distance trend (rising haul distance is the usual hidden cause of OB shortfall) → survey vs. sensor variance.

---

#### K4. Shift Constraint (Bottleneck) Index

1. **Name:** Shift Constraint Index / Bottleneck of Record
2. **Measures:** For every minute of the shift, which stage of the chain was the binding constraint on mine output, and what percentage of the shift each stage held that title.
3. **Why it matters:** Mines chronically optimise non-constraints — buying trucks when the crusher is the limit. Naming the constraint, minute by minute, redirects capital and attention to the only place where improvement converts to tonnes.
4. **Formula:** Per minute, compute available throughput capability for each stage:
   `Cap_stage = Σ(units in Operating state × their rated TPH × current derate)`
   `Constraint(t) = argmin(Cap_stage(t))`, adjusted for buffer state (a full surge bin temporarily decouples upstream from downstream)
   `Constraint share_stage = minutes as argmin / total productive minutes`
5. **Data sources:** All stage throughputs and states, buffer/bin/stockpile levels, rated capacities from the asset master.
6. **Origin:** PLC/SCADA + IoT + asset master. **Combination**, light on ML.
7. **Timing:** Real-time, with lagging shift/week rollup.
8. **Action:** Capital and improvement prioritisation. Live: shift in-charge stops adding trucks to a queue behind a constrained crusher.
9. **Visualisation:** **Constraint ribbon** — a horizontal timeline across the shift, coloured by which stage was constraining. Plus a "constraint share" bar for the period. This is one of the most immediately legible visualisations in the product.
10. **Drill-down:** Ribbon segment → the stage's throughput vs. capability chart for that window → the specific unit that dragged capability down → L5.

---

#### K5. Critical Asset Risk Index

1. **Name:** Critical Asset Risk Index
2. **Measures:** A production-weighted count of assets currently in an elevated failure-risk state — not a count of anomalies.
3. **Why it matters:** The GM needs one number for "how fragile am I this week." A single degraded overland conveyor gearbox is worth more attention than fifteen degraded light vehicles, and a flat anomaly count cannot express that.
4. **Formula:**
   `CARI = Σ_assets (Risk_score_asset × Criticality_weight_asset)` normalised 0–100,
   where `Criticality_weight` = tonnes-per-hour at risk if the asset stops × (1 / redundancy factor). Single-string overland conveyor → weight 1.0; one of 40 trucks → weight ~0.02.
5. **Data sources:** Asset Health Index (K13), Failure Risk Forecast (K14), asset criticality register, process topology (for redundancy).
6. **Origin:** **AI/ML** on top of IoT + PLC data.
7. **Timing:** Predictive / leading.
8. **Action:** Rising index → protect or bring forward the next maintenance window; feed the weekly planning meeting.
9. **Visualisation:** Single index with a 30-day sparkline, plus a **top-5 contributing assets list** with their weight and risk. The list matters more than the index — always show both.
10. **Drill-down:** → asset → K13 health breakdown → K14 failure mode and horizon → L5 recommended action and window.

---

#### K6. Safety Exposure Index

1. **Name:** Safety Exposure Index
2. **Measures:** A composite of *leading* safety signals, deliberately excluding lagging incident counts.
3. **Why it matters:** Lagging safety metrics (LTIFR) tell you about last quarter's failures. Leading exposure signals — a person in a restricted zone, a proximity near-miss, a speed violation on a haul road, a dust or gas exceedance — tell you where the next incident is being manufactured. This is also the client's DGMS defensibility record.
4. **Formula:** `SEI = Σ (event_count_type × severity_weight_type) / exposure_hours`, normalised. Components: proximity/collision near-miss events, restricted-zone intrusions, PPE non-compliance in mandated zones, overspeed on haul roads, fatigue/distraction events, gas and dust exceedances, and **critical-safety-device bypass** events (belt pull-cord and interlock overrides — an underrated and highly predictive signal).
5. **Data sources:** Collision-avoidance/proximity system, CV cameras (zone + PPE), GPS/telematics speed, in-cab driver monitoring, gas and dust analysers, PLC interlock/bypass logs.
6. **Origin:** Cameras/CV + IoT sensors + PLC/SCADA. **Combination.**
7. **Timing:** Real-time for critical events; leading indicator in aggregate.
8. **Action:** Zone-level intervention: retrain, re-route, re-signage, re-engineer the pinch point. Critical events trigger immediate control-room response.
9. **Visualisation:** Index + **spatial heatmap on the mine map** showing where exposure concentrates. Spatial is essential — safety exposure is always geographically clustered, and the map turns a number into a work order.
10. **Drill-down:** Zone → event type → individual event with video clip, timestamp, and location → investigation record.

> **Mandatory UI treatment:** every safety component must carry a **coverage badge** (e.g. "PPE detection: 6 of 9 mandated zones covered; confidence degraded 18:00–06:00 and during dust events"). Presenting a mine-wide PPE compliance percentage without a coverage denominator is a fabrication, and a safety officer will catch it in the first demo.

---

### TIER 1 — Process and Asset (14 KPIs)

---

#### K7. Time Usage Model: Physical Availability / Use of Availability / Effective Utilisation

1. **Name:** Time Usage Model (PA / UA / EU)
2. **Measures:** Every hour of every asset's calendar time, classified into a mutually exclusive, exhaustive tree: Calendar → Scheduled/Unscheduled → Available/Down (planned, unplanned) → Operating/Idle → Productive/Non-productive.
3. **Why it matters:** This is the mining industry's standard accounting language for equipment time. Without it, "utilisation" means five different things to five departments. It is also the raw material for K2's loss tree. **Adopt the GMG/industry time model rather than inventing one — the client's OEM reports already use it, and matching them buys instant credibility.**
4. **Formula:**
   `PA = (Scheduled hours − Down hours) / Scheduled hours`
   `UA = Operating hours / Available hours`
   `EU = Productive hours / Calendar hours`
   Note: **Idle** must be split into *justified* (waiting for blast, shift change, refuelling, no rake) and *unjustified* (queueing, no operator, waiting for instruction). The split is where the money is.
5. **Data sources:** Engine/motor run signals, hydraulic activity, GPS motion, payload events, PLC run/stop, operator login, ERP work orders for planned-vs-unplanned classification.
6. **Origin:** PLC/SCADA + OEM telematics + IoT sensors + ERP. **Combination.** State inference (distinguishing "idle at face" from "queued" from "parked") is an ML classification task, not a threshold.
7. **Timing:** Real-time state, lagging aggregate.
8. **Action:** Unjustified idle >15% → dispatch/sequencing intervention. PA decline → reliability review. UA decline with flat PA → an operations problem, not a maintenance one. **That diagnostic split alone stops months of misdirected blame.**
9. **Visualisation:** **State timeline (Gantt) per unit** across the shift — the single most useful maintenance/production artefact in the product — plus a stacked bar of the time tree. Never a pie chart.
10. **Drill-down:** Unit → state segment → the signals that produced the state classification → for down states, the linked work order and fault codes.

---

#### K8. Truck–Shovel Match Factor

1. **Name:** Match Factor
2. **Measures:** The balance between hauling capacity and loading capacity. MF ≈ 1 is balanced; <1 shovels are starved; >1 trucks are queueing.
3. **Why it matters:** The most actionable fleet KPI that exists, purely IoT-derived, requiring zero new capital. Most mines run persistently mismatched by shift and by route without knowing it, burning either shovel hang time or truck queue time — both of which are pure loss.
4. **Formula:** `MF = (N_trucks × Loading cycle time) / (N_shovels_effective × Truck cycle time)`, computed per shovel-route pair on a rolling 60-minute window.
5. **Data sources:** GPS/geofence arrival-departure events, payload events, shovel bucket-count/pass-count, equipment states.
6. **Origin:** IoT (GPS, payload) + OEM telematics + PLC. **Combination**, with light ML for cycle-phase segmentation.
7. **Timing:** Real-time, with a leading character (a drifting MF predicts a shortfall before the tonnage shows it).
8. **Action:** Live re-allocation of trucks between shovels; shift-level fleet sizing; contract negotiation with the MDO on fleet commitment.
9. **Visualisation:** MF gauge band (0.85–1.10 target) over time, with a **dual-area chart of shovel hang minutes vs. truck queue minutes** underneath. The dual area is what makes it actionable — it shows which side of 1.0 you are on and what it costs.
10. **Drill-down:** → per shovel → per route → K9 cycle decomposition → the specific queue events.

---

#### K9. Haul Cycle Decomposition & Queue Loss

1. **Name:** Haul Cycle Decomposition
2. **Measures:** Each truck trip broken into spot, load, haul-loaded, dump, haul-empty, and queue time, with drift against a route baseline.
3. **Why it matters:** "Cycle time is up 8%" is not actionable. "Haul-empty on Route R3 is up 3.1 min because the road condition has degraded since the rain" is a grader dispatch. Decomposition converts an aggregate into a work order.
4. **Formula:** Segment each trip from GPS + payload + geofence transitions; compute per-phase median and IQR by route/material/shift; flag `phase_drift = current_median − 30-day baseline_median` with statistical significance. `Queue loss (t) = Σ queue minutes × effective TPH per truck`.
5. **Data sources:** GPS (1 Hz minimum), payload sensor, geofences (face, dump, crusher, workshop, fuel), speed and engine load.
6. **Origin:** IoT sensors + OEM telematics + AI/ML (phase segmentation). **Combination.**
7. **Timing:** Real-time and lagging analytical.
8. **Action:** Rising haul-empty → road maintenance/grading. Rising spot time → face layout or operator coaching. Rising queue → K8 rebalance or upstream constraint fix.
9. **Visualisation:** **Stacked horizontal bar per phase with a baseline ghost overlay**, plus box plots by route to expose variance (variance matters more than mean — a route with a wide IQR is an unreliable route). Speed heatmap on the haul road map for the road-condition case.
10. **Drill-down:** Phase → route segment → individual trips → GPS trace replay of the slowest trips.

---

#### K10. Payload Compliance & Fill Factor

1. **Name:** Payload Compliance / Bucket Fill Factor
2. **Measures:** Distribution of truck payloads against rated capacity and the 10/10/20 policy, plus shovel bucket fill factor.
3. **Why it matters:** Underloading silently destroys capacity — 5% underloading across a 40-truck fleet is equivalent to losing two trucks. Overloading destroys frames, tyres, and suspension struts, and voids OEM warranty. Both are invisible without onboard weighing.
4. **Formula:** `Compliance = % loads within 90–110% of rated`, policy check: ≤10% of loads in 110–120%, 0% above 120%. `Fill factor = actual bucket payload / nominal bucket capacity × density correction`.
5. **Data sources:** Truck onboard weighing (strut pressure or OEM payload system), shovel payload measurement, material density by bench.
6. **Origin:** IoT sensors + OEM telematics. Mostly **direct measurement**, with derived analytics.
7. **Timing:** Real-time per load, lagging distribution.
8. **Action:** Coaching by operator/shovel; recalibration of payload systems; fragmentation feedback to drill & blast when fill factor drops without an operator cause.
9. **Visualisation:** **Histogram with policy bands overlaid**, faceted by shovel and by shift. Faceting is what reveals whether the cause is a machine, a person, or the material.
10. **Drill-down:** → by shovel → by operator (see §7 caution on operator-level display) → by bench/material → correlation with fragmentation P80.

---

#### K11. Conveyor Throughput Utilisation & Empty-Belt Running Hours

1. **Name:** Belt Loading Utilisation / Empty-Belt Hours
2. **Measures:** Actual TPH as a fraction of design TPH, and the hours a belt runs while carrying effectively nothing.
3. **Why it matters:** **The highest ROI-per-rupee-of-instrumentation KPI in the entire product.** Overland conveyors are multi-hundred-kW to multi-MW machines. Running one empty for two hours a shift, every shift, is a large, permanent, entirely avoidable energy bill plus needless belt and idler wear. Almost every mine does it. It requires only a belt weigher and a run signal to detect.
4. **Formula:**
   `Belt loading % = TPH_actual / TPH_design`
   `Empty-belt hours = Σ time where (belt_speed > 0) AND (TPH < 5% design) for > 3 continuous minutes`
   `Wasted energy = Empty-belt hours × no-load motor power`
5. **Data sources:** Belt weigher, belt speed/zero-speed switch, motor run status, motor power (energy meter or VFD).
6. **Origin:** IoT sensors + PLC/SCADA + energy meters. **Combination.**
7. **Timing:** Real-time, lagging aggregation.
8. **Action:** Sequenced start/stop logic, load-following belt speed control (VFD), interlocking belts to upstream feed presence. A clear, costed automation project with a payback measured in months.
9. **Visualisation:** Throughput-vs-capacity area chart with **empty-run periods shaded in a warning colour**, plus a weekly "empty hours and cost" bar. The shaded band is what makes the waste undeniable in a client meeting.
10. **Drill-down:** → per conveyor → per empty-run event → what upstream stage was down at that time → K2 attribution.

---

#### K12. Crusher Feed Stability & Choke Loss (with Fragmentation P80)

1. **Name:** Feed Stability Index / Choke Loss
2. **Measures:** Variability of crusher feed rate and power draw, oversize fraction at the feed, and tonnes lost to choke and blockage events.
3. **Why it matters:** Crushers are frequently the constraint (K4). Unstable feed causes chokes; chokes cause 45–90 minute clear-outs; clear-outs cascade into truck queues and shovel hang. And the root cause is usually upstream in drill-and-blast, which is a department that never sees crusher data. **Closing that loop is a genuinely novel capability for most mines.**
4. **Formula:**
   `Feed Stability Index = 1 − (σ(TPH_5min) / μ(TPH_5min))` over the shift
   `Choke loss (t) = Σ choke duration × reference TPH`
   `P80 = 80th percentile particle size from CV sizing at the feed`
   Track `corr(P80, choke frequency)` and `corr(P80, crusher specific energy)` by blast pattern.
5. **Data sources:** Feed belt weigher, crusher motor power/current, CSS (closed side setting), apron feeder speed, CV fragmentation camera, hydraulic pressures, blast records from ERP.
6. **Origin:** PLC/SCADA + IoT + **Cameras/CV** + AI/ML + ERP. **Full combination — this is a showcase KPI for Faclon's breadth.**
7. **Timing:** Real-time (stability, choke prediction is predictive), lagging (loss).
8. **Action:** Live: throttle feeder before choke. Weekly: feed fragmentation data back to blast design — powder factor, burden/spacing, initiation timing.
9. **Visualisation:** Feed rate **control chart** with ±2σ limits and choke events marked, alongside a P80 trend annotated with blast IDs. The annotation is the insight: you can see fragmentation degrade after a specific pattern change.
10. **Drill-down:** Choke event → 10-minute pre-event signal replay (feed rate, power, camera frames) → source bench/blast → blast design parameters.

---

#### K13. Asset Health Index

1. **Name:** Asset Health Index (0–100, per asset)
2. **Measures:** A composite condition score from independent evidence streams, with the contributing factors always exposed.
3. **Why it matters:** Reliability engineers need triage across hundreds of assets. But — critically — **a health score is only trusted if you can immediately see what dragged it down.** A black-box score gets ignored within a month. The score is navigation; the breakdown is the product.
4. **Formula:** Weighted, per asset class:
   `AHI = 100 − Σ (w_i × normalised_severity_i)`
   Contributors, per class:
   - *Vibration:* ISO 20816 zone (A/B/C/D) + envelope/demodulation defect-frequency energy (BPFO/BPFI/BSF/FTF for bearings, GMF sidebands for gearboxes)
   - *Thermal:* ΔT vs. load-and-ambient-expected baseline, dT/dt
   - *Electrical:* current unbalance, MCSA sidebands (rotor bar, eccentricity), insulation resistance trend, power factor drift
   - *Lubrication:* oil analysis (wear metals, viscosity, water) where sampled; oil temp and pressure where sensed
   - *Process:* efficiency/throughput degradation vs. baseline at equivalent load
   - *Utilisation stress:* duty cycle severity, starts/hour, overload events
5. **Data sources:** Triaxial vibration sensors on drive trains, RTDs/thermocouples/thermal cameras, CTs/power analysers, oil sensors + lab results, process instruments, PLC counters.
6. **Origin:** IoT sensors + PLC/SCADA + energy meters + AI/ML + lab (ERP/LIMS). **Combination.**
7. **Timing:** Analytical/diagnostic; leading indicator.
8. **Action:** Triage into: monitor / inspect at next opportunity / plan intervention / intervene now. Feeds the maintenance planning meeting with a ranked list instead of a calendar.
9. **Visualisation:** **Sortable asset table with a health sparkline per row and a horizontal contributing-factor stacked bar** — the bar is what makes the score credible. Asset detail: a small-multiples grid of every contributor's trend with baseline bands.
10. **Drill-down:** Asset → contributor → raw + derived signal at L4 → spectrum/waveform view for vibration → K14 failure risk → L5 action with a maintenance window.

---

#### K14. Failure Risk Forecast (Horizon-Bounded)

1. **Name:** Failure Risk Forecast
2. **Measures:** For a *named failure mode* on a *named asset*, the probability of occurrence within a bounded horizon, with a model maturity rating.
3. **Why it matters:** This is the capability the client is buying. But it must be delivered honestly. **Do not display "RUL = 43 days."** With realistic failure history you cannot support that precision, and one confidently wrong number destroys trust in the whole platform. Deliver "elevated risk of drive-end bearing failure within 14 days, confidence Medium, based on 3 similar historical signatures" — which is defensible, actionable, and survives being wrong.
4. **Formula:** Per failure mode: `P(failure within H | current features)` from a survival or classification model over the L2 feature set, plus a physics/rule prior for cold start. Every output carries: horizon H, probability, confidence interval, **model maturity badge** (Rule-based / Statistical / Learned-Low-N / Learned-Validated), and the evidence that triggered it.
5. **Data sources:** All K13 inputs plus historical failure records, work order history, fault code history.
6. **Origin:** **AI/ML** over IoT + PLC + ERP.
7. **Timing:** **Predictive.**
8. **Action:** Schedule the intervention inside an existing planned window; pre-position spares (link to ERP MM stock); adjust duty in the interim.
9. **Visualisation:** **Ranked risk list with horizon bars** — not gauges, not a single number. Each row: asset, failure mode, horizon, probability, maturity badge, production criticality, recommended window.
10. **Drill-down:** → the evidence (which features moved, when, by how much) → similar historical cases → recommended procedure → create work order.

> **Design mandate:** every AI output in this product carries a maturity badge and an "evidence" affordance. Confidence theatre is the fastest way to lose an industrial client.

---

#### K15. Specific Energy Consumption by Node & Idle Energy

1. **Name:** Specific Energy Consumption (kWh/t, L/BCM) + Idle Energy
2. **Measures:** Energy per unit of output at each node of the chain, plus energy consumed while producing nothing.
3. **Why it matters:** Energy is typically the second or third largest controllable cost, and SEC is a **dual-purpose metric** — it is a cost KPI and a machine-degradation KPI. A crusher whose kWh/t rises 12% at constant throughput has worn liners. Efficiency and health are the same signal.
4. **Formula:**
   `SEC_node = kWh_node / tonnes through node` (electrical)
   `Diesel intensity = litres / BCM` or `litres / t-km` (fleet — t-km is the fairer normalisation because haul distance grows over mine life and litres/BCM will drift for reasons nobody controls)
   `Idle energy = Σ (power drawn while output = 0)` — split into conveyor no-load, compressor unloaded, pumps recirculating, engines idling
5. **Data sources:** Feeder-level energy meters at MCC, VFD data, fuel flow/level sensors, refuelling records, belt weighers, production counts.
6. **Origin:** Energy meters + PLC/SCADA + IoT + ERP. **Combination.**
7. **Timing:** Real-time and lagging; the *degradation trend* is a leading maintenance indicator.
8. **Action:** Idle-energy elimination projects; tariff/load-shifting (max demand management against the state utility's ToD tariff); liner/wear-part replacement triggered by SEC drift rather than by hours.
9. **Visualisation:** **SEC control chart per node** with the learned baseline band, plus a **Sankey of mine energy flow** for the executive view. The Sankey is genuinely persuasive in client meetings and is otherwise rarely justified — use it here.
10. **Drill-down:** Node → asset → energy vs. throughput scatter with the efficiency frontier → time-of-day profile → max-demand events.

---

#### K16. Dewatering Specific Energy & Pump Efficiency

1. **Name:** Dewatering Specific Energy (kWh/m³) / Pump Efficiency
2. **Measures:** Energy to remove a cubic metre of water, pump hydraulic efficiency, and sump level headroom.
3. **Why it matters:** Mine dewatering is an unglamorous, continuously running, energy-intensive system that nobody watches until a pit floods during monsoon and stops production for days. Degrading pump efficiency is both a cost leak and a flood-risk leading indicator. Strong, low-competition value area.
4. **Formula:**
   `SEC = kWh / m³ pumped`
   `η_pump = (ρ·g·Q·H) / (P_electrical × η_motor)`
   `Flood risk headroom = (sump capacity − current level) / (net inflow rate)` → hours to critical, with a rainfall-forecast-adjusted variant
5. **Data sources:** Flow meters on discharge, pressure transmitters (suction/discharge), level sensors in sumps, motor energy meters, vibration on pump/motor, rainfall gauge + forecast API.
6. **Origin:** IoT sensors + energy meters + PLC + external weather data + AI/ML. **Combination.**
7. **Timing:** Real-time; **predictive** for flood risk.
8. **Action:** Pump overhaul scheduling by efficiency decay rather than hours; pre-monsoon capacity planning; live escalation when headroom drops below a threshold.
9. **Visualisation:** Efficiency trend vs. commissioning baseline; **hours-to-critical countdown** per sump during rain events (this is the one place a countdown is the right visual).
10. **Drill-down:** Pump → performance curve (actual operating point vs. manufacturer curve — deviation shows wear or throttling) → vibration/cavitation signature → work order.

---

#### K17. Coal Quality Conformance & Blend Deviation

1. **Name:** Grade Conformance / Blend Deviation
2. **Measures:** Realised GCV, ash, and moisture against the declared/contracted grade band, per dispatch lot.
3. **Why it matters:** **Frequently the largest single monetised item on this list.** Grade slippage against the declared band means direct revenue loss and penalty exposure per rake, every day. Yet quality is typically known only after lab results — days later, when the coal has already left. Online analysis moves the decision from post-hoc to in-line.
4. **Formula:**
   `Conformance % = lots within declared band / total lots`
   `Blend deviation = |realised GCV − target GCV|`, weighted by lot tonnage
   `Penalty exposure (₹) = Σ (tonnes in slipped lots × grade differential rate)`
5. **Data sources:** Online coal analyser at the belt (PGNAA or dual-energy X-ray), belt moisture (microwave), belt weigher for lot tonnage, source-tracking (which bench fed which lot — from truck geofence + dump-to-hopper timestamps), lab results for calibration and statutory record.
6. **Origin:** IoT/analytical instruments + PLC + ERP/LIMS + AI/ML (source attribution and blend optimisation). **Combination.**
7. **Timing:** Near-real-time (analyser) and lagging (lab-confirmed).
8. **Action:** **Live blend correction** — divert or mix from an alternate stockpile before the rake is loaded. This is a closed-loop, money-in-the-bank use case and the strongest commercial story in the deployment.
9. **Visualisation:** GCV/ash trend with the **declared grade band as a shaded corridor**, breaches highlighted and costed; per-lot conformance strip.
10. **Drill-down:** Lot → contributing benches/sources (traced via the twin) → the trucks and shovels that fed it → recommended blend correction.

> **Honest caveat for the sales conversation:** online analysers are a significant capex item and require careful calibration against lab results over several weeks. Position this as Wave 3, quantified with the client's own penalty history. Do not promise GCV inference from an RGB camera (see §7).

---

#### K18. Rake / Dispatch Cycle Performance

1. **Name:** Rake Cycle Performance / Demurrage Exposure
2. **Measures:** Time from rake placement to release, decomposed into positioning, loading, weighment, and documentation, against the free-time allowance.
3. **Why it matters:** Demurrage is a recurring, precisely quantified, entirely avoidable cash cost. It is also a pure measurement-and-coordination problem — exactly what an IIoT platform solves — and the ROI arithmetic is trivially demonstrable to a CFO.
4. **Formula:** `Cycle = t_release − t_placement`, decomposed by phase; `Demurrage exposure = max(0, Cycle − free time) × rate × wagons`; plus `Loading rate (t/min)` and `wagon load variance` (underloaded wagons are lost revenue; overloaded wagons attract penalties).
5. **Data sources:** Rapid loading system PLC, in-motion weighbridge / wagon weighbridge, silo level, rake placement notification (railway interface or manual entry), CV camera for wagon counting and spillage.
6. **Origin:** PLC/SCADA + IoT + Cameras/CV + ERP. **Combination.**
7. **Timing:** Real-time with a countdown against free time; lagging financial rollup.
8. **Action:** Live escalation when a phase overruns; silo pre-fill scheduling ahead of placement; root-cause the recurring phase (it is almost always weighment or documentation, not loading).
9. **Visualisation:** **Rake cycle Gantt** with the free-time boundary marked, plus a monthly demurrage-cost trend.
10. **Drill-down:** Rake → phase → the delay event → the responsible stage (silo empty? loading system fault? weighbridge queue?) → K2 attribution.

---

#### K19. Production Reconciliation Gap

1. **Name:** Mass Balance / Reconciliation Gap
2. **Measures:** Tonnage variance between successive measurement nodes: shovel payload → truck payload → crusher feed weigher → CHP outfeed weigher → dispatch (weighbridge + wagon) → survey volumetric.
3. **Why it matters:** An unappreciated but powerful KPI. It simultaneously detects **(a)** instrument drift, **(b)** unrecorded stock movement, **(c)** measurement methodology errors, and **(d)** losses that should not be occurring. It is also the metric that makes every other tonnage number in the product *trustworthy* — without it, the client will quietly disbelieve the dashboard and keep using their own spreadsheet.
4. **Formula:** `Gap_n→n+1 (%) = (Measured_n − Measured_n+1 − Known_stock_change) / Measured_n`, with a statistical control limit per node pair derived from each instrument's accuracy class.
5. **Data sources:** All weighing instruments, stockpile volume (drone/LiDAR), silo/bin levels, geofenced material movement.
6. **Origin:** IoT sensors + PLC + drone survey + ERP. **Combination.**
7. **Timing:** Daily/shift lagging with real-time accumulation.
8. **Action:** Gap beyond control limits → instrument calibration check first, then physical investigation. Persistent one-directional gaps at a single node are the classic signature worth investigating.
9. **Visualisation:** **Sankey of mass flow with variance annotated at each junction**, plus a per-node-pair control chart. The Sankey is the natural fit here.
10. **Drill-down:** Node pair → time-series of the gap → instrument calibration history → the specific shifts or lots driving the variance.

---

#### K20. TKPH / Tyre Thermal Risk

1. **Name:** TKPH Compliance / Tyre Thermal Risk
2. **Measures:** Tonne-kilometre-per-hour duty on each tyre position against its rating, plus live tyre pressure and temperature.
3. **Why it matters:** OTR tyres are among the largest consumables in an opencast mine, with long lead times, and thermal failure is both expensive and a serious safety event. TKPH is a well-established OEM constraint that almost no mine monitors continuously, because doing so requires exactly the sensor fusion Faclon provides: payload + speed + haul distance + ambient temperature + TPMS. **A high-credibility differentiator with a hard, defensible ROI number.**
4. **Formula:** `TKPH = Mean tyre load (t) × Mean speed (km/h)`, where mean tyre load accounts for the loaded/empty duty split; apply the ambient-temperature correction factor; compare against the tyre's rated TKPH. Flag `TKPH ratio > 0.9` and any tyre temperature above threshold.
5. **Data sources:** Onboard payload, GPS speed and haul profile, TPMS (pressure + temperature per position), ambient temperature, tyre master data (rating, position, fitment date).
6. **Origin:** IoT sensors (TPMS) + OEM telematics + AI/ML. **Combination.**
7. **Timing:** Real-time (temperature/pressure) and analytical (TKPH duty).
8. **Action:** Route or speed restriction for the affected unit; rotate the truck to a shorter or flatter cycle; correct pressure; escalate tyre spec at the next procurement cycle.
9. **Visualisation:** Heatmap of trucks × tyre positions coloured by TKPH ratio; live temperature/pressure exception list.
10. **Drill-down:** Truck → position → duty history → route contribution → tyre life projection vs. fleet benchmark.

---

### TIER 2 — Programme Health (4 meta-KPIs)

These do not measure the mine. They measure whether the platform deserves to be trusted. **Ship them in v1.** Every industrial IoT deployment that skips these degrades silently and is quietly abandoned in year two.

| KPI | Formula | Why | Timing | Visualisation |
|---|---|---|---|---|
| **K21. Data Integrity & Coverage Score** | % of expected tags reporting within SLA × % passing range/stuck-value/drift checks, weighted by KPI dependency | A dead sensor produces a *confidently wrong* KPI, which is worse than a missing one. Every KPI must degrade visibly when its inputs degrade. | Real-time | Coverage matrix by area; per-KPI confidence badge |
| **K22. Alert Precision & Response SLA** | Precision = alerts closed as "valid" / total; plus median time-to-acknowledge and time-to-close by severity | Alert fatigue is the #1 killer of industrial dashboards. If precision drops below ~60%, the product is being ignored regardless of what usage stats say. | Weekly | Precision trend by alert type; SLA breach list |
| **K23. Model Performance** | Per model: hit rate, false alarm rate, median lead time, drift in input distribution | Models silently decay when the mine changes (new bench, new fleet, monsoon regime). Without this, decay is invisible until a client complains. | Monthly | Per-model scorecard with maturity badge |
| **K24. Value Realised** | Avoided downtime hours × reference TPH; energy saved vs. baseline; demurrage avoided; tonnes recovered from constraint interventions | Renewal depends on this. Compute against a **frozen pre-deployment baseline period**, state the attribution method openly, and never claim causation you cannot defend. | Monthly | Cumulative benefit waterfall with methodology footnote |

---

## 7. KPIs I am explicitly recommending against

The brief asked for this, and it is the section that will earn the most client trust. Each of these will be proposed by someone in the project — here is the prepared answer.

| Rejected | Why | What to do instead |
|---|---|---|
| **OEE for mobile fleet** | The Quality term is meaningless for a haul truck, and Performance double-counts what Match Factor already says. Applying a manufacturing metric to a mining fleet signals a vendor who does not know mining. | PA / UA / Effective Utilisation (K7) + Match Factor (K8) |
| **RUL in days for most assets** | Requires many labelled run-to-failure examples per failure mode. No mine has this at the start, and a wrong precise number destroys credibility permanently. | Horizon-bounded risk with maturity badge (K14) |
| **Stockpile volume from fixed RGB cameras** | Accuracy is poor (single viewpoint, no scale reference, occlusion, dust, lighting). Presenting it as a number invites a survey comparison that will embarrass the platform. | Drone photogrammetry or fixed LiDAR/laser scanner on the stacker boom; cameras only for *change detection* and reclaim activity, not volume |
| **GCV / ash from camera imagery** | The information is not physically recoverable from visible-spectrum reflectance at useful accuracy. Any demo that appears to work is fitting to a confounder. | PGNAA/XRF online analyser (K17) |
| **MTBF/MTTR on small populations** | With fewer than ~8–10 like units and a handful of failures, the confidence interval is wider than any change you would act on. It generates false trends and unproductive meetings. | Report failure counts and health index trend; reserve MTBF for large fleets, and always show the CI |
| **"Anomalies detected today" as a headline count** | An anomaly without a named failure mode is not actionable. This number goes up when the mine does something new, which trains users to ignore it. | Only surface anomalies that map to a diagnosis or that persist beyond a threshold; report K22 precision alongside |
| **3D game-engine walkthrough of the mine as an operational screen** | High cost, high maintenance, and operators do not make decisions inside it. It is a sales asset masquerading as a product feature. | Build it deliberately as a *demo/showcase* asset; operational twin is the process graph + geo-map + periodic survey surface (§9) |
| **Mine-wide PPE compliance %** | The denominator is undefined (compliance among *detected* people, in *covered* zones, at *usable* confidence). It is a number that cannot survive scrutiny. | Per-zone, per-camera compliance with an explicit coverage and confidence badge (K6) |
| **Live ₹ cost-per-tonne** | Depends on finance master data that is updated monthly and allocations that are contested. A live rupee figure will be disputed and will drag the whole dashboard's credibility with it. | Live *physical* intensity (kWh/t, L/BCM, min/cycle); convert to currency in a monthly reconciled view |
| **Vibration alarms without machine-class context** | A raw mm/s threshold across a mixed asset base generates constant false alarms on large slow machines and misses faults on small fast ones. | ISO 20816 zone classification by machine class + envelope defect-frequency analysis (K13) |
| **Operator leaderboards in v1** | Real industrial-relations and union risk in Indian coal, and it converts the platform from "our tool" to "management's surveillance tool" — which loses you the operators whose cooperation you need for data quality. | Aggregate and anonymised coaching insights in v1; named views only with HR/union agreement and a stated purpose, in a later phase |
| **A standalone ESG/carbon dashboard in v1** | Valuable, but it has a different audience, a different data governance regime, and different assurance requirements. Bolting it on dilutes v1 focus. | Collect the underlying energy and fuel data correctly in v1 (K15) so the ESG module is a later query, not a re-instrumentation |
| **Generic "AI Insights" feed** | A stream of model outputs with no owner and no SLA is read for two weeks and then never again. | Every model output enters the Action Center as an owned, SLA-bound item (§8) |

---

## 8. Screen-by-screen specification

Layout notation: 12-column grid, desktop-first (control room + office), with a responsive tablet variant for supervisors in the field. Mobile is **summary + alerts only** — do not attempt to port the analysis screens to a phone.

---

### Screen 0 — Mine Pulse

**Persona:** GM, Mine Manager, Owner. **Dwell:** 30 seconds, many times a day. **Refresh:** 30 s.

| Zone | Cols | Content |
|---|---|---|
| Header strip | 12 | Shift context (shift, elapsed/remaining), **K1** big number + attainment %, projection to shift close with a P10–P90 cone, month-to-date attainment |
| Hero | 8 | **K2 Production Loss Waterfall** — the dominant object on the screen. Plan → loss bars → actual. Colour-coded by controllability. Every bar clickable. |
| Hero side | 4 | **K4 Constraint ribbon** for the shift + "constraint of record" callout in plain language: *"Crushing has been the constraint for 41% of this shift."* |
| Row 2 | 4 / 4 / 4 | **K3** Coal + OB cumulative vs. plan with SR adherence · **K5** Critical Asset Risk with top-5 contributors · **K6** Safety Exposure Index with mine-map heat thumbnail |
| Footer | 12 | Top 5 Action Center items by production impact, with owner and SLA |

**What the user gets:** in one glance — whether the number is achievable, what is preventing it, whether tomorrow is being mortgaged (SR), what is fragile, and whether anyone is at risk.

**Drill-downs:** waterfall bar → loss events → L5. Constraint ribbon → Screen 1 scoped to that stage and time window. Risk contributor → Screen 4 asset detail. Safety heat → Screen 6 zone.

**Degraded state:** if K21 data coverage for any input falls below threshold, the affected instrument shows a muted state with "partial data — N of M sources reporting." **Never render a confident number on incomplete data.**

---

### Screen 1 — Production Flow & Constraint

**Persona:** Production Manager, Shift In-charge, Control Room. **Refresh:** 10 s.

- **Hero: the live process chain.** A horizontal node-link diagram of the actual mine: Faces → Loading → Haulage → Crusher(s) → Conveyors → CHP → Stockpile/Silo → Dispatch. Each node shows: current TPH, capability TPH, state colour, and unit count operating/idle/down. Each edge shows flow rate. Buffers (surge bin, stockpile, silo) show fill level. **The constraint node is visually emphasised.** This is the digital twin doing operational work, and it is the screen the client will remember.
- **Below hero:** stage-level throughput vs. capability over the shift (small multiples, one per stage), so you can see *when* each stage lost capability.
- **Right:** live loss accumulation (K2) as a stacked area, updating through the shift.
- **KPIs on screen:** K2, K4, K11, K12, K19 (reconciliation banner), plus K1 pace.
- **Data sources:** belt weighers, all PLC states, bin/silo levels, GPS geofence counts, weighbridge.
- **Insight delivered:** "The chain is currently limited by Crusher 1 at 780 TPH against 1,100 design; the surge bin is at 12% and falling; the belt will starve in ~18 minutes unless feed recovers."
- **Drill-downs:** node → stage detail (Screen 2 for mobile stages, Screen 3 for fixed plant) → equipment → L5.

---

### Screen 2 — Fleet & Cycle Intelligence

**Persona:** Mine Captain, Dispatch, Fleet Manager. **Refresh:** 30 s.

- **Left/hero: live mine map** with truck and shovel positions, haul road network, geofences, and a speed/congestion heat layer. Trucks coloured by state (loading, hauling loaded, dumping, hauling empty, queued, down).
- **Right: K8 Match Factor** per shovel with the shovel-hang vs. truck-queue dual-area chart.
- **Below: K7 state timeline (Gantt)** for the fleet — the artefact the maintenance and production teams will argue over, productively, every morning.
- **Also:** K9 cycle decomposition with baseline ghosts, K10 payload histogram faceted by shovel, K20 tyre exception list.
- **Data sources:** GPS/telematics (ISO 15143-3 where available), onboard payload, engine data, geofences, fuel.
- **Insight delivered:** "Route R3 haul-empty is +3.1 min since Tuesday's rain; grader dispatch will recover ~340 t/shift." / "Shovel 2 is hanging 22 min/hour — move two trucks from Shovel 4."
- **Drill-downs:** truck → trip list → GPS replay of a specific trip → engine/payload signals at L4 → health (Screen 4).

---

### Screen 3 — Fixed Plant & Conveying

**Persona:** CHP Manager, Control Room Operator. **Refresh:** 5–10 s.

- **Hero: P&ID-style live schematic** of the CHP — feeders, crushers, screens, conveyors, stackers, reclaimers, silos — with live values inline and states by colour. This is the twin at the plant level.
- **Conveyor strip per belt:** TPH vs. design, belt loading profile, drive motor current/temperature (with L2 deviation, per the design rule), **empty-run shading (K11)**, and protection-device status (pull cords, belt sway, zero-speed, rip detection, tramp metal).
- **Crusher panel:** K12 feed stability control chart, power draw, CSS, choke events, fragmentation P80 with blast annotations, live CV feed with detections overlaid.
- **KPIs:** K11, K12, K13 (fixed plant subset), K15 (plant SEC), K19.
- **Data sources:** PLC/SCADA (OPC UA), belt weighers, energy meters, vibration and thermal on drives, CV cameras at transfer points and the crusher feed.
- **Insight delivered:** "CV-04 drive motor is +11 °C above expected with flat vibration — cooling path, not bearing; clean during the 14:00 changeover." / "Idler bank at chainage 340 m is running 18 °C hot — inspect before it seizes and burns the belt."
- **Drill-downs:** equipment → K13 health → contributor trends → spectrum view → work order.

---

### Screen 4 — Asset Health & Reliability

**Persona:** Reliability Engineer, Maintenance Planner, Electrical Head. Two modes on one screen.

- **Condition mode:** ranked asset table (K13) with health sparkline + contributing-factor bars + criticality weight, filterable by area, class, and risk. Selecting an asset opens a detail pane: small-multiples of every contributor with learned baseline bands, vibration spectrum/waveform, thermal trend, electrical signature, oil results, and a **failure-mode panel (K14)** with horizon, probability, maturity badge, and evidence.
- **Work mode:** the same asset list joined to ERP work orders — open, planned, overdue, spares availability, and the next planned window. **The critical interaction: "Schedule into window" — one action that converts a prediction into a work order with the recommended procedure attached, written back to the client's ERP.** Without ERP write-back, the platform is advice; with it, it is part of the workflow.
- **Also:** backlog aging, planned vs. unplanned ratio trend, PM compliance, and the **Condition-Based-Maintenance conversion rate** (what fraction of interventions are now driven by condition rather than calendar) — the single best measure of programme maturity.
- **Drill-downs:** asset → failure mode → evidence → similar historical cases → procedure → work order → post-work verification (did the signal recover? this closes the learning loop and produces labels).

---

### Screen 5 — Energy & Consumables

**Persona:** Energy Manager, Finance, Mine Manager. **Refresh:** 1 min.

- **Hero: energy Sankey** — grid + DG in, distributed across CHP, conveying, dewatering, workshops, lighting, ventilation; diesel shown as a parallel flow.
- **K15 SEC control charts** per node with baselines; **idle-energy panel** ranked by cost (empty belts, unloaded compressors, recirculating pumps, idling engines) — this panel alone typically funds the deployment.
- **Max demand and power factor** against the utility contract, with ToD tariff overlay and load-shifting opportunities.
- **K16 dewatering** efficiency and monsoon headroom.
- **Consumables:** diesel intensity, tyre TKPH exposure (K20), crusher liner and pick wear inferred from SEC drift and throughput.
- **Insight delivered:** "Overland conveyor ran empty 2.4 h/shift average this week — ₹X/month and avoidable with feed-presence interlocking." / "Max demand penalty incurred 6 times this month, all between 18:30 and 19:15; shift the reclaim cycle."

---

### Screen 6 — Safety, Environment & Compliance

**Persona:** Safety Officer, Environment Officer, Mine Manager.

- **Hero: mine map with live exposure layers** — people and vehicle positions, restricted zones, proximity events, PPE-monitored zones with coverage shading, dust and gas monitor readings.
- **Live event stream** with video clips: zone intrusion, PPE non-compliance, proximity near-miss, overspeed, fatigue/distraction, smoke/fire, unusual dust plume.
- **Environmental compliance strip:** PM10/PM2.5 continuous readings against statutory limits, noise, water discharge quality, with a defensible **audit-ready export** — this is the DGMS/CPCB deliverable and a genuine reason the safety officer will log in daily.
- **K6 index** with trend and per-zone breakdown.
- **Mandatory UI treatments:** coverage/confidence badge on every CV-derived number; a persistent notice that gas and ventilation displays are advisory overlays on statutory systems; full audit trail on every acknowledgement.
- **Drill-downs:** zone → event → clip + telemetry at that moment → investigation record → corrective action in the Action Center.

**What CV can and cannot do — set this expectation in the UI, not just the SOW.**

*Production-grade today:* person and vehicle detection; helmet and hi-vis detection at 5–15 m in good light; restricted-zone and geofence intrusion; vehicle counting and ANPR at controlled gate positions; conveyor mistracking and spillage; chute and hopper blockage; oversize and foreign-object detection at feed points; truck-bed load asymmetry, carryback, and oversize boulders; smoke and fire; dust plume detection; fragmentation sizing; in-cab fatigue and distraction; water-spray verification.

*Degraded and must be labelled as such:* PPE detection at night, in heavy dust, in rain, or beyond ~30 m; small-PPE classes (gloves, earplugs, spectacles) at any realistic distance.

*Do not promise:* coal quality or GCV from RGB; precise tonnage from cameras; stockpile volume from fixed cameras; individual identification without a lawful basis and a policy the client has actually signed.

---

### Screen 7 — Coal Quality & Dispatch

**Persona:** Quality/Sales, Dispatch Manager, Finance.

- **K17 grade conformance:** GCV/ash trend inside the declared band corridor, per-lot conformance strip, live penalty exposure, and **source attribution** — which benches fed the lot, traced through the twin.
- **Blend advisory:** given current stockpile grades (analyser + lab + source model) and the next rake's target, recommend the reclaim mix. This is the prescriptive showcase.
- **K18 rake cycle Gantt** with free-time boundary and live countdown; demurrage exposure trend.
- **Road dispatch:** weighbridge throughput, queue time, ANPR-to-weighbridge-to-gate reconciliation, and **route deviation flags** on dispatched trucks — the standard control for road-sale leakage.
- **K19 reconciliation** banner tying quality lots back to production.

---

### Screen 8 — Shift Report & Analysis

**Persona:** everyone, at handover. **This is the screen that creates the daily habit.**

Auto-generated at shift close, editable, exportable, and archived:

1. Production: planned vs. actual, K2 waterfall for the shift, constraint of record.
2. Equipment: state summary, all downtime events with arbitrated cause and duration, units still down at handover.
3. Health & risk: assets that changed risk state during the shift; open predictions with horizons that expire in the next shift.
4. Safety & environment: all events, all exceedances, all open corrective actions.
5. Quality & dispatch: lots produced, conformance, rakes loaded, demurrage incurred.
6. **Carry-forward:** open Action Center items with owner and SLA, explicitly handed to the incoming shift.
7. **Free-text supervisor commentary** — do not omit this. Human context is the highest-value annotation in the system, it is what makes the report *theirs*, and over time it becomes labelled training data.

**Plus: Shift Replay.** The global time scrubber lets any user re-run the shift — the twin map animates, equipment states change, alerts fire, the loss waterfall builds. For incident investigation and for training new supervisors, this is the most compelling thing in the product and the clearest possible demonstration that Faclon is not doing BI.

---

## 9. Action Center design (the most important design work in the project)

Alerts are where industrial dashboards die. Design this before designing charts.

### The alert object

Every item — whether from a threshold, a rule, a model, or a CV detection — is the same object:

```
{
  id, created_at, source (rule | model | cv | manual), model_maturity,
  severity (P1 Safety-critical | P2 Production-critical | P3 Degradation | P4 Advisory),
  asset, area, twin_node,
  hypothesis        // "Degraded cooling path on CV-04 drive motor"
  evidence[]        // the L2 features that fired, with charts, pre-rendered
  consequence       // quantified: "3.2 h stoppage ≈ 2,100 t if unaddressed"
  recommended_action, recommended_window,
  owner, sla_due,
  status, closure_reason_code, closure_notes, verification_result
}
```

**No alert ships without `hypothesis`, `consequence`, `recommended_action`, `owner`, and `sla_due`.** If those five cannot be populated, it is not an alert — it is a chart annotation.

### Cascade suppression

When a conveyor stops and six trucks go idle and two shovels hang, the system raises **one** P2 with nine linked consequences. Naive systems raise nine alerts, and the operator mutes the category within a week. The arbitration engine from K2 does double duty here.

### The label flywheel — the strategic reason this design matters

Closure requires a **reason code** from a controlled vocabulary (confirmed-and-fixed / confirmed-but-deferred / real-but-not-actionable / false-positive-sensor / false-positive-model / duplicate / operational-change). Optionally, a post-work verification check ("did the signal return to baseline?").

Those codes are the only realistic source of supervised labels in years 1–2. **The Action Center is not a notification feature; it is the data-labelling pipeline disguised as a workflow.** Design it accordingly, and instrument K22/K23 from day one.

### Anti-fatigue rules

Minimum event duration and deadbands before firing; shift-change and blast-window suppression; per-user and per-role subscription rather than broadcast; a hard weekly cap on P4 volume with the surplus rolled into a digest; and an automatic review of any alert type whose precision drops below 60% — it gets tuned or retired, not left to rot.

---

## 10. Digital twin representation strategy

Four tiers. Be deliberate about which ones are operational and which are sales assets.

| Tier | What it is | Operational value | Cost | Verdict |
|---|---|---|---|---|
| **T1 — Process/asset graph** | Nodes (assets), edges (material flow), buffers, states, capacities. The semantic model everything navigates. | **Very high** — powers constraint detection, cascade arbitration, drill-down, and source attribution | Low | **Build first. This is the actual twin.** |
| **T2 — 2D geo-map** | Pit outline, benches, haul roads, dumps, CHP, live asset positions, geofences, exposure layers | **Very high** — spatial context is how mining people think | Low–medium | **Build in v1.** |
| **T3 — Periodic 3D surface** | Drone photogrammetry / LiDAR surface, monthly or weekly, with volume differencing and design-vs-actual comparison | **High** — authoritative OB and stockpile volumes, K19 reconciliation, bench design conformance | Medium | **Build in v1.5.** |
| **T4 — Real-time 3D walkthrough** | Game-engine CHP or pit model with live data bound to 3D geometry | **Low** — visually impressive, but nobody makes a decision inside it; high build and maintenance cost | High | **Build only as a scoped demo/showcase asset. Do not put it in the operational navigation.** |

**Say this to the client explicitly.** Every competitor will show them a rotating 3D mine. Faclon's differentiated position is: *the twin's value is in the model and the live state binding, not in the rendering.* That is a more credible and more defensible pitch, and it is true.

---

## 11. Data acquisition plan — what to instrument, in waves

Sequenced by value-per-rupee and by dependency. Each wave has an exit criterion so the programme cannot drift.

### Wave 0 — Weeks 0–6 · Integrate what already exists

| Source | Signals | Method | Enables |
|---|---|---|---|
| CHP SCADA/PLC | Run/stop, faults, interlocks, feeder speeds, CSS, bin levels | **OPC UA** (preferred) or Modbus TCP via edge gateway | K7, K11, K12, K2, K4 |
| Belt weighers | Instantaneous TPH, totalised tonnes | Existing PLC tags or direct integrator interface | K1, K2, K11, K19 |
| Energy meters at MCC feeders | kWh, kW, kVAr, PF, max demand, per feeder | Modbus RTU/TCP; retrofit meters where absent | K15, K13 (electrical) |
| Weighbridge | Net weight, vehicle ID, timestamp | Database/serial integration | K1, K19 |
| ERP (SAP PM/MM or Coalnet) | Work orders, plan, material master, spares, downtime codes | REST/IDoc/flat-file, **bidirectional** | K7, K14 (write-back), K24 |
| OEM telematics | Whatever is already licensed | **ISO 15143-3 (AEMP 2.0) API** — the correct mixed-fleet approach; avoids per-OEM bespoke integration | K7, K9, K15 |

**Exit criterion:** K1, K2 (partial), K4, K7, K11, K15 live and reconciling to the client's own shift report within ±3%. **Deliver a working loss waterfall in week 6.** Early credibility is worth more than early completeness.

### Wave 1 — Weeks 6–16 · Mobile fleet and the pit

- **GPS/telematics on every HEMM** (1 Hz), including MDO fleet — negotiate the data clause into the contract early, it is the long pole.
- **Onboard payload** (strut pressure or OEM payload system) on trucks; **shovel payload** where supported.
- **Geofences** for faces, dumps, crusher tips, workshop, fuel bay, weighbridge.
- **TPMS** (pressure + temperature per position) on the haul fleet.
- **Fuel level/flow** sensors + refuelling integration.
- **In-pit network:** private LTE/5G or Wi-Fi 6 mesh (mobility and handover matter more than peak bandwidth); LoRaWAN/NB-IoT for static low-rate points (sump level, tank level, ambient).
- **Edge gateways with store-and-forward** — non-negotiable in a pit. Connectivity *will* drop. Buffer locally for ≥72 hours and reconcile on reconnect, or every KPI will have holes exactly when it matters most.
- **Gate/ANPR cameras** and weighbridge cameras.

**Exit criterion:** K8, K9, K10, K20 live; K2 loss tree complete with haulage attribution.

### Wave 2 — Weeks 16–28 · Condition monitoring and vision

- **Triaxial vibration** (with envelope/demodulation capability) on: conveyor drives and pulleys, crusher main shaft and drive, screens, stacker/reclaimer drives, dewatering pumps, shovel swing/hoist gearboxes. Prioritise strictly by criticality × redundancy — do not instrument everything.
- **Thermal:** RTDs on motor windings and bearings; **fixed thermal cameras on idler runs** (idler failure is a leading cause of belt fires) and on MCC panels.
- **Electrical:** power quality analysers and CTs for MCSA on critical drives.
- **CV models:** conveyor mistracking and spillage, chute blockage, oversize/foreign object at the crusher feed, truck-bed condition, PPE and zone monitoring, smoke/dust.
- **Environment:** continuous PM10/PM2.5, noise, weather station.
- **Dewatering:** flow, suction/discharge pressure, sump level.

**Exit criterion:** K13, K14 (statistical maturity), K6, K16 live; first confirmed prevented failure documented.

### Wave 3 — Weeks 28+ · High-value specialist

- **Online coal analyser** (PGNAA or dual-energy X-ray) + belt moisture — justify against the client's own penalty and demurrage history.
- **Fragmentation cameras** at shovel face and crusher feed.
- **Drone/LiDAR survey** programme with automated volume differencing.
- **In-cab driver monitoring** (fatigue/distraction) — sequence *after* the IR groundwork.
- **Proximity detection/collision avoidance integration** (DGMS-mandated for opencast HEMM — integrate the existing system rather than replacing it).
- **Rapid loading system and silo instrumentation** for K18.

### Cross-cutting foundations — do these in Wave 0 or regret them

1. **Time synchronisation (NTP, PTP where sub-second matters).** Every correlation, cascade arbitration, and root-cause replay in this document depends on trustworthy timestamps. Clock skew across gateways silently invalidates the analytics and is agonising to debug later. This is the single most commonly skipped foundation.
2. **Asset naming and hierarchy standard** (ISA-95-style or the client's KKS if they have one), agreed with the client and enforced by the ingestion layer. Without it the twin is unmaintainable at 5,000 tags.
3. **Unit and material-type master data** — densities by bench, rated capacities, tyre ratings, grade bands. These are boring and they gate half the KPIs.
4. **Data contract and quality checks at ingestion** — range, stuck-value, rate-of-change, and staleness — feeding K21.
5. **Environmental hardening spec:** IP66/IP67 minimum, dust-rated enclosures, camera lens washers, blast-zone survivability plan (mounting, standoff, replacement stock), and a monsoon plan. Cheap hardware fails in month four and the client blames the software.

---

## 12. Analytics and AI maturity path

Do not start with deep learning. Start with what works on day one and earn the right to escalate.

| Stage | Method | Data needed | Delivers | When |
|---|---|---|---|---|
| **S1 — Physics & rules** | Engineering limits, OEM specs, ISO 20816 zones, mass balance, thermodynamic checks | None historical | Immediate diagnostics, ~40% of value | Week 1 |
| **S2 — Contextual baselining** | Learned normal operating envelopes conditioned on load, ambient, material, shift | 4–8 weeks | The L2 layer: deviation, drift, residuals — this is what makes the product feel intelligent | Week 8 |
| **S3 — Multivariate anomaly** | PCA/autoencoder residuals per asset, unsupervised | 8–12 weeks | Cold-start detection with no failure labels required | Week 12 |
| **S4 — Failure-mode models** | Supervised classification/survival per named failure mode | 6–18 months of labels from the Action Center flywheel | K14 with real confidence | Month 9+ |
| **S5 — Prescriptive optimisation** | Constrained optimisation for blend, dispatch, and maintenance windowing | S1–S4 + business constraints | Recommendations, then optionally closed loop | Month 12+ |

**Governance rules:** every model carries a maturity badge visible to the user; every model has a named owner and a monthly K23 scorecard; drift in input distributions triggers review; **no closed-loop control in v1** — advisory only, with a documented path to supervisory control (the natural first candidate is load-following conveyor speed, which is low-risk and high-value).

---

## 13. Reference architecture (summary)

```
PHYSICAL          Sensors · Cameras · PLCs · Meters · Telematics · Analysers · Drones
   │
EDGE              Gateways: protocol translation (OPC UA / Modbus / MQTT / CAN-J1939),
                  time sync, buffering (≥72 h), local CV inference, safety-critical local rules
   │              [survives network loss — mandatory in-pit]
PLATFORM          Ingestion & data contracts → Time-series store + object store (video/images)
                  → Asset/twin model (topology, hierarchy, criticality, capacities)
                  → Feature layer (L1/L2) → Model serving (L3/L4) → Rules & arbitration engine
                  → Semantic/metrics layer (single definition of every KPI)
   │
APPLICATION       9 screens · Action Center · Twin navigator · Shift Replay · Reports · API
   │
INTEGRATION       ERP (bidirectional: work orders, plan, spares) · LIMS · Railway/dispatch ·
                  Weather · BI export
```

**Two architectural insistences.** First, the **semantic/metrics layer**: every KPI defined once, versioned, and consumed identically by the UI, the reports, the API, and the client's own BI tool. Without it you will end up with three different values for "availability" and a credibility crisis. Second, **edge autonomy**: safety-critical detection and buffering must work with the platform unreachable.

---

## 14. Risks, edge cases, and failure modes

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **MDO/contractor refuses fleet data** | High | Blocks Screen 2 entirely | Contractual data clause negotiated before Wave 1; interim fallback to geofence-only tracking via independent GPS units the client owns |
| **OEM data lockout / warranty concerns on CAN tap** | High | Delays payload and engine data | Use ISO 15143-3 API and licensed OEM portals first; only tap CAN with written OEM/dealer agreement |
| **Connectivity gaps in the pit** | Certain | Silent KPI holes | Edge store-and-forward ≥72 h; explicit "data gap" rendering in the UI — never interpolate silently |
| **Sensor drift / stuck values** | Certain over time | Confidently wrong KPIs | K21 quality checks; K19 reconciliation as an independent cross-check; scheduled calibration workflow |
| **Blast damage and dust ingress to field hardware** | High | Recurring cost and outages | Standoff mounting, blast-window relocation SOP, IP66+, lens washers, on-site spares kit |
| **Monsoon regime change breaks ML baselines** | Certain, annually | False alarm storm | Season-aware baselining from day one; explicit regime labels; suppression policy during shutdown |
| **Alert fatigue** | High if undesigned | Product abandonment | §9 in full; K22 monitored weekly; automatic retirement of low-precision alert types |
| **Union/IR resistance to operator monitoring** | Medium–high | Programme-level risk | Aggregate-first, anonymised-first; named views only with signed agreement; frame as fatigue *safety*, not surveillance |
| **Statutory conflict (gas, ventilation, collision)** | Medium | Legal exposure | Advisory-overlay labelling in the UI; never present platform data as the statutory record; legal review before go-live |
| **Client's BI team builds a competing shadow dashboard** | High | Fragmentation | Do not resist — expose the semantic layer via API and make Faclon the source of truth rather than a walled garden |
| **Attribution disputes over K2** | Certain in month 1 | Trust erosion | Publish the arbitration logic openly, make every bar auditable to its source events, and run a joint validation fortnight against the client's manual records before go-live |
| **Value cannot be demonstrated at renewal** | Medium | Churn | Freeze a pre-deployment baseline period *before* Wave 0 completes; K24 from day one; conservative, stated attribution |

**Edge cases the designer must handle explicitly:** partial data (per-KPI confidence badges); planned shutdown and monsoon periods (excluded from baselines and from availability calculations, with the exclusion visible); mid-shift plan revisions; assets that move between areas; new assets with no baseline (explicit "learning — N days remaining" state); shift-boundary events that span two shifts; and clock-skew detection with a visible warning.

---

## 15. Implementation plan

| Phase | Weeks | Scope | Exit criterion |
|---|---|---|---|
| **P0 — Discovery** | 0–3 | Asset register, criticality ranking, tag survey, network survey, KPI definition workshop, **baseline freeze** | Signed KPI definitions and asset hierarchy |
| **P1 — Foundation** | 3–8 | Wave 0 integration, twin T1+T2, Screen 0 + Screen 1, Action Center v1 | **Loss waterfall live and reconciling to the client's shift report within ±3%** |
| **P2 — Fleet** | 8–18 | Wave 1 instrumentation, Screens 2 and 8, Shift Replay | Match Factor and cycle decomposition driving daily dispatch decisions |
| **P3 — Reliability** | 16–30 | Wave 2 condition monitoring and CV, Screens 3, 4, 6 | First documented prevented failure; ERP work-order write-back live |
| **P4 — Efficiency & Commercial** | 26–40 | Screens 5 and 7, Wave 3 selectively, T3 survey twin | Documented energy saving and demurrage reduction against baseline |
| **P5 — Intelligence** | 36+ | S4 failure-mode models, prescriptive blend and dispatch, optional supervisory control | K23 scorecard showing validated models with useful lead time |

**Sequencing principle:** every phase must produce a number the client can take to their own management. P1 delivering a credible loss waterfall in week 8 is worth more than P1–P3 delivering a complete but unvalidated platform in week 30.

---

## 16. How we will know this worked

Targets to agree with the client at kickoff, measured against the frozen baseline, with the attribution method stated in writing.

| Outcome | Target | How measured | Realistic timeframe |
|---|---|---|---|
| Coal output uplift via constraint and match-factor intervention | +2–4% | K1 vs. baseline, controlled for plan, geology, and weather | 6–9 months |
| Unplanned downtime on instrumented critical assets | −15–25% | K7 unplanned down hours | 9–12 months |
| Specific energy (plant + conveying) | −5–8% | K15 vs. baseline at equivalent throughput | 4–6 months |
| Empty-belt running hours | −70% | K11 | 2–3 months (**fastest visible win — lead with it**) |
| Demurrage cost | −30–50% | K18 | 3–6 months |
| Grade slippage penalty exposure | −20–40% | K17 | 6–12 months, gated on analyser |
| Leading safety exposure events | −30% | K6 | 6–12 months |
| CBM conversion rate | >40% of interventions condition-driven | Screen 4 | 12–18 months |
| Alert precision | >70% | K22 | Month 6 |
| Daily active use by shift in-charges | >85% of shifts | Product analytics + Screen 8 completion | Month 3 |

**Be honest about attribution.** Mining output is confounded by geology, weather, plan changes, and market demand. Agree the attribution method *before* the numbers are favourable, not after — it is the difference between a renewal conversation and an argument.

---

## Appendix A — Underground module (if applicable)

If the client operates underground sections, Screens 2–3 are replaced and three domains become Tier 0. **This module is materially harder: every device requires flameproof or intrinsically safe certification and DGMS approval, communications infrastructure is far more constrained, and the statutory overlay is much heavier. Do not quote it as a variant of the opencast scope.**

**A1. Ventilation & gas.** Real-time CH4, CO, CO₂, O₂, air velocity and quantity at fixed points and on machines; main fan performance (pressure, power, efficiency); ventilation network model with live balance; auxiliary fan status. Derived: ventilation adequacy per district, deterioration trend, and quantity-vs-requirement per working face. **All advisory to the statutory methanometer and monitoring system.**

**A2. Spontaneous heating detection.** The highest-value AI application in underground coal. Trend CO make, **Graham's ratio (CO / O₂ deficiency)**, and **Trickett's ratio** across sealed areas and goaf; combine with fibre-optic distributed temperature sensing where installed and thermal imaging at accessible points. Early detection here prevents district sealing — a multi-crore event. This is a genuinely differentiating capability and one very few IIoT vendors can credibly claim.

**A3. Strata and roof.** Tell-tale and roof-extensometer readings, stress-cell data, powered-support leg pressures on longwall, convergence rate. Derived: convergence acceleration and support-pressure anomaly patterns as leading indicators of roof instability.

**A4. Underground production and people.** Continuous miner or shearer cutting rate and availability, AFC/BSL loading and motor current, section conveyors, man-riding system status, and personnel tracking by district (statutory in many jurisdictions and essential for emergency response). Dewatering pumps carry even higher criticality than on surface.

---

## Appendix B — Designer handoff checklist

**Component inventory to build:** KPI tile (with confidence badge and drill affordance) · Waterfall · Constraint ribbon · State timeline/Gantt · Control chart with learned baseline band · Small-multiples trend grid · Sankey · Process chain node-link · Mine geo-map with layer control · P&ID schematic · Health table row (sparkline + factor bars) · Risk list row (horizon bar + maturity badge) · Alert card (hypothesis / evidence / consequence / action / owner / SLA) · Event card with video clip · Rake Gantt · Payload histogram with policy bands · Time scrubber · Twin navigator tree · Breadcrumb · Coverage/confidence badge · Degraded-data state · Learning state · Data-gap state.

**Design system requirements:** Material Design 3 foundation with an industrial density profile (control-room screens need higher information density than consumer M3 defaults). Dark theme is the **default**, not an option — these screens run 24/7 in control rooms and in bright pit-side cabins; both benefit, and a light theme must also exist for office and printed reports. Status colour semantics must be fixed once and never reused decoratively (operating / idle / down-planned / down-unplanned / degraded / no-data), and must be **colour-blind safe with a non-colour secondary encoding** — this is a safety product and a meaningful share of the male-dominated user base has some form of CVD. Numeric type must be tabular-lining. Every chart needs a defined empty, loading, partial, and error state. Minimum touch target 44 px for the tablet variant, usable with gloves.

**Accessibility and environment:** WCAG 2.2 AA minimum; readable at 2 m for wall-mounted control-room displays (design a dedicated "wall board" variant of Screen 0 and Screen 1); high-contrast mode for pit-side tablets in direct sun; and no reliance on hover for any critical information, since wall displays have no cursor.

**Questions for the client before design begins:** confirm §0 assumptions · shift calendar and plan granularity · declared grade bands and penalty structure · existing SCADA tag list and historian · OEM telematics licences held · MDO contract data clauses · DGMS-approved systems already installed · the client's own current definition of availability and utilisation (**match it, do not correct it, in v1**) · and who, by name, owns each alert severity.
