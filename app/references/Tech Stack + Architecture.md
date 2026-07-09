  Tech Stack + Architecture — Digital Twin Builder

  Current Reality

  We have a static visualizer dressed as a builder. Real builder needs fundamental architectural changes.

  Proposed Stack

  3D Engine:      Three.js + React Three Fiber (keep — mature, web-native)
  State:          Zustand (scene graph, layers, selection, history)
  History:        Immer + custom undo/redo stack
  Transform:      @react-three/drei TransformControls (move/rotate/scale)
  Selection:      three-mesh-bvh (fast raycasting at scale)
  UI:             @faclon-labs/design-sdk (already integrated)
  Persistence:    Scene JSON → IOsense backend / localStorage

  Application Architecture

  ┌─────────────────────────────────────────────────┐
  │                   Scene Store (Zustand)          │
  │                                                  │
  │  layers[]          objects[]        selection    │
  │  ├─ Infrastructure ├─ SceneObject   activeLayer  │
  │  ├─ Equipment      │   ├─ id        editMode     │
  │  ├─ Piping         │   ├─ type      camera       │
  │  └─ Annotations    │   ├─ position              │
  │                    │   ├─ rotation              │
  │                    │   ├─ parentId  (mounting)  │
  │                    │   ├─ connections[]  (pipes) │
  │                    │   └─ dataBindings[]        │
  │                    └─ ...                        │
  └─────────────────────────────────────────────────┘
           │                    │
      3D Canvas              UI Shell
      ─────────              ────────
      SceneGraph             LayerPanel
      TransformGizmo         ObjectLibrary
      GridSystem (LOD)       PropertiesPanel
      SnapEngine             CommandPalette
      SelectionOutline       UndoHistory

  Layer System (like Illustrator)

  Layer 0 — Infrastructure  (floor slab, building boundary)
  Layer 1 — Equipment       (machines, tanks)
  Layer 2 — Piping          (pipe connections between machines)
  Layer 3 — Conveyors       (belt paths, routing)
  Layer 4 — Annotations     (data widgets, labels)
  Layer 5 — Structural      (mounting stands, platforms, stairs)
  Each layer: visible, locked, highlighted toggle. Clicking object auto-selects its layer.
  
  Object Library (Plant Knowledge Base)

  Pre-built machine components with:
  - Geometry (procedural Three.js)
  - Mounting footprint (snap dimensions)
  - Connection points (pipe in/out, conveyor in/out)
  - Default metadata schema (capacity, speed, manufacturer)
  - Template configurations (e.g. "PET 12,000 bph line" loads a pre-arranged set)

  Object-to-Object System

  - Each machine has defined connection ports (pipe stubs, conveyor ends)
  - Hover near port → snaps to nearest compatible port
  - Connected → pipe/conveyor auto-routes between ports
  - "Lock together" → relative position locked, move one = move all

  Grid LOD System

  View mode:      no grid
  Edit mode:      5m coarse grid (Faclon blue)
  Zoom < 30u:     1m medium grid fades in
  Zoom < 10u:     0.25m fine grid fades in
  Driven by useFrame reading camera.position.length() → adjusts two <Grid> component opacities.