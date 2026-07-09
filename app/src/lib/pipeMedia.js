// ── Pipe fluid-medium taxonomy ───────────────────────────────────────────────
// Single source of truth for colouring pipe connectors BY the fluid they carry.
// Pure (no store/UI imports) so both the template and the scene store can import
// it without a cycle (mirrors libraryRef / customTypesRef).
//
// The medium is derived from the PORT NAMES (steam_out, water_in, flue_out…) so
// colouring is a real system rather than hand-maintained per-link literals.

// medium → { color, radius } — a clear, distinct P&ID-style palette.
export const MEDIUM_STYLE = {
  steam:      { color: '#e0533d', radius: 0.42 },  // red-orange — hot, high energy
  feedwater:  { color: '#2fa45a', radius: 0.36 },  // green
  condensate: { color: '#2bb6c4', radius: 0.32 },  // teal
  cooling:    { color: '#2f7fd0', radius: 0.36 },  // blue
  makeup:     { color: '#8fcf7a', radius: 0.34 },  // light green — raw / treated water
  flue:       { color: '#4f555c', radius: 0.55 },  // charcoal
  air:        { color: '#a9d3ef', radius: 0.48 },  // sky blue — combustion air
}

// Old template pipe colours + the schema default — the migration only recolours
// pipes still carrying one of these, so genuinely user-customised colours survive.
export const LEGACY_PIPE_COLORS = new Set([
  '#cdd6e2', '#3b82c4', '#5aa0d0', '#6b727b', '#aeb6bf', '#9fb0c0',
])

// Classify a single port name → medium key (or null when unknown/generic in/out).
// Order matters: more specific tokens first; cooling/makeup before generic water.
function classify(id) {
  const s = String(id || '').toLowerCase()
  if (!s) return null
  if (s.includes('steam')) return 'steam'
  if (s.includes('flue')) return 'flue'
  if (s.includes('air')) return 'air'
  if (s.includes('cond')) return 'condensate'
  if (s.includes('warm') || s.includes('cool') || s.includes('cw')) return 'cooling'
  if (s.includes('raw') || s.includes('treated') || s.includes('tw')) return 'makeup'
  if (s.includes('water')) return 'feedwater'
  return null
}

// Resolve the medium for a pipe from its source port first, falling back to the
// target when the source is a generic in/out (e.g. ID-fan `out` → chimney `flue_in`).
export function mediumOf(sourcePort, targetPort) {
  return classify(sourcePort) || classify(targetPort) || 'feedwater'
}

// Convenience: the full pipe connectorConfig for a medium derived from ports.
export function pipeConfigFor(sourcePort, targetPort, extra = {}) {
  return { ...MEDIUM_STYLE[mediumOf(sourcePort, targetPort)], flowing: true, ...extra }
}
