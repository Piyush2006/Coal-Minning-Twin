// Global date-range presets + shift-window helpers. "now" is the real clock —
// the mock-data layer is seeded per day, so any range resolves to populated data.
import { startOfDay, endOfDay } from './rng'

const hm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0) }

export const PRESETS = ['Today', 'This Shift', 'Yesterday', 'Last 7 Days', 'This Month']

// Which shift (by configured timings) contains instant `t`, and that shift's
// [start,end] window. Handles a shift that wraps past midnight (e.g. 18:00→06:00).
export function shiftWindowAt(t, settings) {
  const shifts = [
    { name: 'Shift 1', ...settings.shift1 },
    { name: 'Shift 2', ...settings.shift2 },
  ]
  const mins = t.getHours() * 60 + t.getMinutes()
  for (const s of shifts) {
    const a = hm(s.start), b = hm(s.end)
    const wraps = b <= a
    const inside = wraps ? (mins >= a || mins < b) : (mins >= a && mins < b)
    if (inside) {
      const start = new Date(t)
      start.setHours(Math.floor(a / 60), a % 60, 0, 0)
      if (wraps && mins < b) start.setDate(start.getDate() - 1) // early-morning tail of a night shift
      return { name: s.name, start, end: new Date(t) }
    }
  }
  return { name: shifts[0].name, start: startOfDay(t), end: new Date(t) }
}

export function presetRange(name, settings) {
  const now = new Date()
  if (name === 'Today') return { start: startOfDay(now), end: now, preset: name }
  if (name === 'Yesterday') { const y = new Date(now); y.setDate(now.getDate() - 1); return { start: startOfDay(y), end: endOfDay(y), preset: name } }
  if (name === 'Last 7 Days') { const s = new Date(now); s.setDate(now.getDate() - 6); return { start: startOfDay(s), end: now, preset: name } }
  if (name === 'This Month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, preset: name }
  if (name === 'This Shift') { const w = shiftWindowAt(now, settings); return { start: w.start, end: w.end, preset: name } }
  return { start: startOfDay(now), end: now, preset: name }
}

export const fmtStamp = (d) => d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
export const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
