// Seeded RNG + date helpers for the management dashboard's mock-data layer.
// Everything is deterministic per (dayKey · scope) so the dashboard is stable
// across reloads yet varies coherently day-to-day and by filter selection.

export const mulberry = (s) => () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
export const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

const pad2 = (n) => String(n).padStart(2, '0')
export const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const fmtDay = (d) => `${pad2(d.getDate())} ${MONTHS[d.getMonth()]}`
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
export const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

// every calendar day in [start,end] inclusive (capped so a huge range can't hang)
export function eachDay(range, cap = 186) {
  const out = []
  let d = startOfDay(range.start)
  const end = startOfDay(range.end)
  while (d <= end && out.length < cap) { out.push(d); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) }
  if (!out.length) out.push(startOfDay(range.start))
  return out
}

// Filter → a deterministic sub-scope of the whole operation. Only EXTENSIVE
// quantities (tonnes, hours, kWh, litres, loss) scale by `factor`; intensive
// KPIs (throughput rate, per-ton intensities, yield %) do not.
export function scopeOf({ mineId = 'all', areaId = 'all', equipTypeId = 'all' } = {}) {
  let factor = 1
  const parts = ['op']
  if (mineId !== 'all') { factor *= mineId === 'oc' ? 0.62 : 0.46; parts.push(mineId) }
  if (areaId !== 'all') { factor *= 0.34; parts.push(areaId) }
  if (equipTypeId !== 'all') { factor *= 0.45; parts.push(equipTypeId) }
  return { factor, key: parts.join('|') }
}
