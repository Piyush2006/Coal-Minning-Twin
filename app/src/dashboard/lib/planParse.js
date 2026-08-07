// Excel <-> plan glue built on SheetJS. All XLSX use is isolated here so the
// heavy library stays out of the main bundle (dynamic import per call).
//   parseWorkbook(File)       → { rows, headerMap, unmatched }   (raw, pre-validate)
//   validatePlan(rows)        → { level, ok, requiredMissing, rows(with _issues), summary }
//   downloadTemplate()        → saves plan-template.xlsx
//   manualToRows(level, grid) → normalized rows in the same shape as an upload
// A "row" after normalization: { period, shift, plannedCoal, plannedOB,
//   energyTarget, fuelTarget, manpowerTarget, _issues: {key:msg} }
import {
  PLAN_COLUMNS, COL_BY_KEY, NUMERIC_KEYS, matchColumn, parsePeriod, parseShift, detectLevel, TEMPLATE_ROWS,
} from '../data/planSchema'

const loadXLSX = () => import('xlsx')

// sane numeric bounds per kind → flags obviously wrong cells
const BOUNDS = {
  plannedCoal: [0, 5_000_000], plannedOB: [0, 50_000_000],
  energyTarget: [0, 200], fuelTarget: [0, 50], manpowerTarget: [0, 50],
}

function coerceNumber(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  const n = Number(String(v).replace(/[, ]/g, ''))
  return String(v).trim() === '' ? null : n
}

// Map a sheet's array-of-objects (SheetJS sheet_to_json with header row) →
// normalized rows + which of our columns were found.
function mapRows(records) {
  // Build header→key map from the first record's keys (sheet_to_json uses headers as keys)
  const found = {}
  const headerMap = {}
  if (records.length) {
    for (const rawHeader of Object.keys(records[0])) {
      const key = matchColumn(rawHeader)
      if (key && !headerMap[key]) { headerMap[key] = rawHeader; found[key] = true }
    }
  }
  const rows = records.map(rec => {
    const row = { _issues: {} }
    for (const col of PLAN_COLUMNS) {
      const src = headerMap[col.key]
      row[col.key] = src != null ? rec[src] : (col.key === 'shift' ? '' : '')
    }
    return row
  })
  return { rows, headerMap, foundKeys: Object.keys(found) }
}

export async function parseWorkbook(file) {
  const XLSX = await loadXLSX()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
  const { rows, headerMap, foundKeys } = mapRows(records)
  return { rows, headerMap, foundKeys, fileName: file.name }
}

// Validate + tag each row's cells. Mutates a copy with `_issues` per bad key.
export function validatePlan(rawRows, foundKeys = []) {
  const level = detectLevel(rawRows)
  // a column is required if flagged required AND (it's not the shift column, or we're shift-level)
  const requiredKeys = PLAN_COLUMNS.filter(c => c.required && (c.key !== 'shift' || level === 'shift')).map(c => c.key)
  const missing = requiredKeys.filter(k => !foundKeys.includes(k))

  const rows = rawRows.map((r) => {
    const issues = {}
    // period
    const p = parsePeriod(r.period)
    if (!p) issues.period = r.period === '' || r.period == null ? 'Missing date/period' : `Unrecognised: "${r.period}"`
    // shift (only meaningful at shift level)
    if (level === 'shift') {
      if (r.shift === '' || r.shift == null) issues.shift = 'Missing shift'
      else if (parseShift(r.shift) == null) issues.shift = `Unrecognised shift: "${r.shift}"`
    }
    // numerics
    for (const k of NUMERIC_KEYS) {
      const has = foundKeys.includes(k)
      const n = coerceNumber(r[k])
      if (k === 'plannedCoal') {
        if (n == null) issues[k] = 'Missing planned coal'
        else if (Number.isNaN(n)) issues[k] = `Not a number: "${r[k]}"`
        else if (n < BOUNDS[k][0] || n > BOUNDS[k][1]) issues[k] = 'Out of range'
      } else if (has && r[k] !== '' && r[k] != null) {
        if (Number.isNaN(n)) issues[k] = `Not a number: "${r[k]}"`
        else if (BOUNDS[k] && (n < BOUNDS[k][0] || n > BOUNDS[k][1])) issues[k] = 'Out of range'
      }
    }
    return { ...r, _issues: issues }
  })

  const rowIssueCount = rows.reduce((a, r) => a + Object.keys(r._issues).length, 0)
  const ok = missing.length === 0 && rowIssueCount === 0 && rows.length > 0
  const summary = {
    rows: rows.length,
    level,
    cellIssues: rowIssueCount,
    optionalPresent: ['plannedOB', 'energyTarget', 'fuelTarget', 'manpowerTarget'].filter(k => foundKeys.includes(k)),
  }
  return { level, ok, requiredMissing: missing, rows, summary }
}

// Turn validated rows into the compact, JSON-safe rows stored in the plan slice.
export function toStoredRows(rows) {
  return rows.map(r => {
    const p = parsePeriod(r.period)
    const out = { period: p?.isMonth ? p.monthKey : p?.dayKey, isMonth: !!p?.isMonth }
    const sh = parseShift(r.shift)
    if (sh != null) out.shift = sh
    for (const k of NUMERIC_KEYS) {
      const n = coerceNumber(r[k])
      if (n != null && !Number.isNaN(n)) out[k] = n
    }
    return out
  }).filter(r => r.period && r.plannedCoal != null)
}

// Manual grid (array of {period, shift, plannedCoal,...} strings) → same stored shape.
export function manualToRows(gridRows) {
  const validated = validatePlan(gridRows.map(r => ({ ...r })), Object.keys(gridRows[0] || {}).filter(k => k !== '_issues'))
  return { ...validated, stored: toStoredRows(validated.rows) }
}

// Generate + download the .xlsx template (headers + sample + a notes sheet).
export async function downloadTemplate() {
  const XLSX = await loadXLSX()
  const headers = PLAN_COLUMNS.map(c => c.label)
  const keys = PLAN_COLUMNS.map(c => c.key)
  const aoa = [headers, ...TEMPLATE_ROWS.map(r => keys.map(k => r[k] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = headers.map(h => ({ wch: Math.max(14, h.length + 2) }))
  const notes = [
    ['Column', 'Required?', 'Unit', 'Notes'],
    ...PLAN_COLUMNS.map(c => [
      c.label,
      c.required ? (c.key === 'shift' ? 'Only for shift-wise plans' : 'Required') : 'Optional',
      c.unit || '—',
      c.kind === 'period' ? 'YYYY-MM (monthly) or YYYY-MM-DD (daily/shift)'
        : c.kind === 'shift' ? 'Shift 1 / Shift 2 — leave blank for monthly/daily plans'
        : c.kind === 'coal' ? 'Planned saleable coal for the period'
        : c.kind === 'ob' ? 'Planned overburden removed'
        : 'Optional target — overrides the matching Efficiency target when present',
    ]),
  ]
  const wsNotes = XLSX.utils.aoa_to_sheet(notes)
  wsNotes['!cols'] = [{ wch: 26 }, { wch: 26 }, { wch: 8 }, { wch: 60 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plan')
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Instructions')
  XLSX.writeFile(wb, 'blackridge-plan-template.xlsx')
}

export { PLAN_COLUMNS, COL_BY_KEY }
