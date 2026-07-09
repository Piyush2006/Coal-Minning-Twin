// Apple-minimal design tokens. Single source of truth for the app chrome so
// every panel/control stays consistent. Plain JS (no JSX) — import anywhere.

export const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, 'Segoe UI', sans-serif"

// Colour system (Apple light)
export const C = {
  accent:     '#0a84ff',
  accentSoft: 'rgba(10,132,255,0.12)',
  text:       '#1d1d1f',
  text2:      '#6e6e73',
  text3:      '#a1a1a6',
  bg:         '#f5f5f7',
  surface:    '#ffffff',
  line:       'rgba(0,0,0,0.08)',
  lineStrong: 'rgba(0,0,0,0.14)',
  good:       '#34c759',
  warn:       '#ff9f0a',
  bad:        '#ff3b30',
}

export const R = { sm: 8, md: 12, lg: 16, pill: 999 }

// Frosted-glass surface (vibrancy)
export const glass = {
  background: 'rgba(250,250,252,0.78)',
  backdropFilter: 'saturate(180%) blur(20px)',
  WebkitBackdropFilter: 'saturate(180%) blur(20px)',
}

export const SHADOW = {
  card:  '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.10)',
  panel: '0 16px 50px rgba(0,0,0,0.16)',
}

export const STATUS_COLOR = { running: C.good, idle: C.warn, fault: C.bad }

// 8pt-ish spacing scale
export const S = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32 }
