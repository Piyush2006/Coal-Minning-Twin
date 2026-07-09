// ── Central colour palette tokens ────────────────────────────────────────────
// Named industrial colour tokens usable ANYWHERE a colour string is accepted
// (component-spec part materials, connectorConfig, environment config) via the
// "@token" syntax — e.g. material.color: "@miningYellow". resolveColor() maps a
// token to its hex; plain hex strings pass through untouched, so every existing
// scene keeps rendering identically.
export const PALETTE = {
  // equipment / mobile plant
  miningYellow:  '#d9a41f',
  equipmentBlue: '#2a5fa5',
  // structures / civil
  structureGrey: '#8a929b',
  darkSteel:     '#5b626b',
  concrete:      '#c9ccd1',
  rubberDark:    '#2b2f36',
  copper:        '#b87333',
  // safety
  safetyOrange:  '#ff7a1a',
  safetyRed:     '#e03a2f',
  // sensors / security (CCTV, scanners) — distinct from equipment & water hues
  securityWhite: '#e9edf1',
  visionViolet:  '#7d5ce6',
  // water infrastructure
  waterBlue:     '#2f7fd0',
  waterTeal:     '#2bb6c4',
  waterGreen:    '#2fa45a',
  // bulk solids / terrain
  coalBlack:     '#23262b',
  earthBrown:    '#8a7a64',
  earthDark:     '#6e6257',
}

export function resolveColor(c, fallback = '#b0c4d0') {
  if (typeof c !== 'string' || !c) return fallback
  if (c[0] === '@') return PALETTE[c.slice(1)] ?? fallback
  return c
}

// Blend two hex colours (t = 0 → a, 1 → b). Used e.g. to "mute" grid colours
// toward the background (drei's Grid has no true opacity control).
export function mixHex(a, b, t) {
  const pa = parseInt(resolveColor(a).slice(1), 16), pb = parseInt(resolveColor(b).slice(1), 16)
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}
