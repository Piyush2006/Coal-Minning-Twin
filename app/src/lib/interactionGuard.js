// Tiny non-reactive guard shared between the transform gizmos and the Canvas's
// onPointerMissed deselect. Dragging a TransformControls handle isn't a hit in
// R3F's raycaster, so the drag's pointer-up registers as a "miss" and would clear
// the selection. We flip this flag while a gizmo drag is active and clear it on
// the next tick (after onPointerMissed has run for that pointer-up), so the
// selection survives a drag. Kept out of the store to avoid re-renders mid-drag.
export const dragGuard = { transforming: false }

export function beginTransform() {
  dragGuard.transforming = true
}

export function endTransform() {
  // Defer the reset: onPointerMissed for this same pointer-up fires synchronously
  // before any timer, so the guard is still true when it checks.
  setTimeout(() => { dragGuard.transforming = false }, 0)
}
