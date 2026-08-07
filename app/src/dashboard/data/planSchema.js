// The operational-plan column contract — the single source of truth for what an
// uploaded/entered plan may contain, which columns are required vs optional, and
// how header text maps to our internal keys. Used by the Excel parser, the
// template generator, the manual-entry grid and the preview table.
//
// A plan can be provided at three LEVELS of granularity:
//   monthly  — Period = "YYYY-MM"        (distributed to days: total ÷ days-in-month)
//   daily    — Period = "YYYY-MM-DD"
//   shift    — Period = "YYYY-MM-DD" + a Shift column (Shift 1 / Shift 2)
// The optional cost columns become the Efficiency targets (Energy/T, Fuel/T,
// Man-Hours/T); Overburden is stored for reference (no OB KPI exists yet).

// kind drives coercion + which internal field a column feeds.
export const PLAN_COLUMNS = [
  { key: 'period',       label: 'Date / Period',              unit: '',           required: true,  kind: 'period',
    aliases: ['date', 'period', 'date / period', 'date/period', 'month', 'day'] },
  { key: 'shift',        label: 'Shift',                      unit: '',           required: false, kind: 'shift',
    aliases: ['shift', 'shift name', 'shift no', 'shift number'] },
  { key: 'plannedCoal',  label: 'Planned Coal Production',    unit: 'T',          required: true,  kind: 'coal',
    aliases: ['planned coal production', 'planned coal', 'coal production', 'planned production', 'coal', 'production'] },
  { key: 'plannedOB',    label: 'Planned Overburden',         unit: 'BCM',        required: false, kind: 'ob',
    aliases: ['planned overburden', 'overburden', 'ob', 'planned ob'] },
  { key: 'energyTarget', label: 'Cost Energy / Ton',          unit: 'kWh/T',      required: false, kind: 'energy',
    aliases: ['cost energy / ton', 'cost energy/ton', 'energy / ton', 'energy per ton', 'energy/ton', 'energy target', 'kwh/t'] },
  { key: 'fuelTarget',   label: 'Cost Fuel / Ton',            unit: 'L/T',        required: false, kind: 'fuel',
    aliases: ['cost fuel / ton', 'cost fuel/ton', 'fuel / ton', 'fuel per ton', 'fuel/ton', 'fuel target', 'l/t'] },
  { key: 'manpowerTarget', label: 'Cost Manpower Productivity', unit: 'mh/T',     required: false, kind: 'manpower',
    aliases: ['cost manpower productivity', 'manpower productivity', 'man-hours / ton', 'man hours per ton', 'manpower', 'man-hours', 'mh/t'] },
]

export const COL_BY_KEY = Object.fromEntries(PLAN_COLUMNS.map(c => [c.key, c]))
export const NUMERIC_KEYS = PLAN_COLUMNS.filter(c => ['coal', 'ob', 'energy', 'fuel', 'manpower'].includes(c.kind)).map(c => c.key)
export const OPTIONAL_TARGET_KEYS = ['energyTarget', 'fuelTarget', 'manpowerTarget']

export const LEVELS = [
  { id: 'monthly', label: 'Monthly', hint: 'One row per month (Period = YYYY-MM)' },
  { id: 'daily',   label: 'Daily',   hint: 'One row per day (Period = YYYY-MM-DD)' },
  { id: 'shift',   label: 'Shift-wise', hint: 'One row per day per shift' },
]
export const SHIFT_NAMES = ['Shift 1', 'Shift 2']

// normalize a header cell for alias matching
export const normHeader = (h) => String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

// map a raw header → our column key (or null if unrecognised)
export function matchColumn(rawHeader) {
  const h = normHeader(rawHeader)
  if (!h) return null
  for (const col of PLAN_COLUMNS) {
    if (col.aliases.some(a => a === h) || normHeader(col.label) === h) return col.key
  }
  return null
}

// A period cell → { level-hint, monthKey?, dayKey? }. Accepts Date, "YYYY-MM",
// "YYYY-MM-DD", "DD/MM/YYYY", "DD-MMM-YYYY" and Excel serials-as-strings.
const pad2 = (n) => String(n).padStart(2, '0')
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function parsePeriod(raw) {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !isNaN(raw)) {
    return { isMonth: false, dayKey: `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}` }
  }
  const s = String(raw).trim()
  // YYYY-MM (month only)
  let m = s.match(/^(\d{4})[-/](\d{1,2})$/)
  if (m) return { isMonth: true, monthKey: `${m[1]}-${pad2(+m[2])}` }
  // YYYY-MM-DD
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) return { isMonth: false, dayKey: `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}` }
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) return { isMonth: false, dayKey: `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}` }
  // DD-MMM-YYYY (e.g. 05-Aug-2026)
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})$/)
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
    if (mi >= 0) return { isMonth: false, dayKey: `${m[3]}-${pad2(mi + 1)}-${pad2(+m[1])}` }
  }
  // MMM-YYYY (month only, e.g. Aug-2026)
  m = s.match(/^([A-Za-z]{3,})[-\s](\d{4})$/)
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
    if (mi >= 0) return { isMonth: true, monthKey: `${m[2]}-${pad2(mi + 1)}` }
  }
  return null
}

// which shift index (0/1) a shift cell refers to, or null
export function parseShift(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw).trim().toLowerCase()
  if (/(^|\D)1($|\D)/.test(s) || s.includes('day') || s === 'a') return 0
  if (/(^|\D)2($|\D)/.test(s) || s.includes('night') || s === 'b') return 1
  return null
}

// Detect the plan level from normalized rows (post header-map).
export function detectLevel(rows) {
  const anyShift = rows.some(r => r.shift != null && r.shift !== '')
  if (anyShift) return 'shift'
  const anyMonth = rows.some(r => { const p = parsePeriod(r.period); return p && p.isMonth })
  const anyDay = rows.some(r => { const p = parsePeriod(r.period); return p && !p.isMonth })
  if (anyMonth && !anyDay) return 'monthly'
  return 'daily'
}

// A representative sample row for the downloadable template (daily level).
export const TEMPLATE_ROWS = [
  { period: '2026-08-01', shift: '', plannedCoal: 9000, plannedOB: 32000, energyTarget: 12.0, fuelTarget: 0.42, manpowerTarget: 0.28 },
  { period: '2026-08-02', shift: '', plannedCoal: 9000, plannedOB: 32000, energyTarget: 12.0, fuelTarget: 0.42, manpowerTarget: 0.28 },
]

// Build empty editable rows for the manual-entry grid at a given level + period.
// period = { start: Date, end: Date }. Reuses date helpers inline to avoid a cycle.
export function emptyRowsFor(level, period) {
  const rows = []
  const start = new Date(period.start.getFullYear(), period.start.getMonth(), level === 'monthly' ? 1 : period.start.getDate())
  const end = period.end
  if (level === 'monthly') {
    let d = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (d <= last && rows.length < 60) {
      rows.push({ period: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`, shift: '', plannedCoal: '', plannedOB: '', energyTarget: '', fuelTarget: '', manpowerTarget: '' })
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return rows
  }
  let d = new Date(start)
  while (d <= end && rows.length < 372) {
    const dk = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    if (level === 'shift') {
      SHIFT_NAMES.forEach(sh => rows.push({ period: dk, shift: sh, plannedCoal: '', plannedOB: '', energyTarget: '', fuelTarget: '', manpowerTarget: '' }))
    } else {
      rows.push({ period: dk, shift: '', plannedCoal: '', plannedOB: '', energyTarget: '', fuelTarget: '', manpowerTarget: '' })
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  return rows
}
