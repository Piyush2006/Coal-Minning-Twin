// Shared per-object load/fill state (0 = empty … 1 = full), written by the
// path-follow drive each frame and read by any component part flagged
// `material.loadState` (visible coal heaps in truck beds, buckets, skips …).
// A plain mutable map — no store, no re-renders, zero allocation.
export const pathFillMap = {}
