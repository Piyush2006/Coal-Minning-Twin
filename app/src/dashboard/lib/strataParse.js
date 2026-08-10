// Borehole-strata Excel glue (SheetJS). One row per layer:
//   Borehole | Rock | Thickness (m)   — rows top→bottom per borehole.
// Parses → validates (known borehole + rock, numeric thickness) → groups into
// { [boreholeId]: [{rock,thickness}] } for the store. Also builds the template.
import { BOREHOLES, boreholeById } from '../data/boreholes'
import { ROCK_LIST } from '../data/geology'

const loadXLSX = () => import('xlsx')
const norm = (s) => String(s ?? '').trim().toLowerCase()

export const STRATA_COLS = [
  { key: 'borehole', label: 'Borehole', aliases: ['borehole', 'bh', 'hole', 'borehole id', 'hole id'] },
  { key: 'rock', label: 'Rock', aliases: ['rock', 'rock type', 'formation', 'stratum', 'layer', 'lithology'] },
  { key: 'thickness', label: 'Thickness (m)', aliases: ['thickness (m)', 'thickness', 'thickness m', 'thick', 'm'] },
]
const matchHeader = (h) => { const n = norm(h); return STRATA_COLS.find(c => c.aliases.includes(n) || norm(c.label) === n)?.key || null }

export function resolveBorehole(v) {
  const m = String(v ?? '').toUpperCase().match(/BH[-\s]?0*(\d+)/)
  if (!m) return null
  const id = `BH-${String(m[1]).padStart(2, '0')}`
  return boreholeById(id)?.id || null
}
export function resolveRock(v) {
  const n = norm(v)
  if (!n) return null
  const first = n.split(/[\s/]+/)[0]
  for (const r of ROCK_LIST) {
    const rn = norm(r.name), rf = rn.split(/[\s/]+/)[0]
    if (n === r.id || n === rn || first === r.id || first === rf) return r.id
  }
  return null
}
const toNum = (v) => { if (v === '' || v == null) return null; const x = Number(String(v).replace(/[, ]/g, '')); return String(v).trim() === '' ? null : x }

export async function parseStrataWorkbook(file) {
  const XLSX = await loadXLSX()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const recs = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })
  const headerMap = {}
  if (recs.length) for (const h of Object.keys(recs[0])) { const k = matchHeader(h); if (k && !headerMap[k]) headerMap[k] = h }
  const found = Object.keys(headerMap)
  const rows = recs.map(rec => { const row = {}; for (const c of STRATA_COLS) row[c.key] = headerMap[c.key] != null ? rec[headerMap[c.key]] : ''; return row })
  return { rows, found, fileName: file.name }
}

export function validateStrata(rows, found) {
  const missing = STRATA_COLS.filter(c => !found.includes(c.key)).map(c => c.label)
  const out = rows.map(r => {
    const issues = {}
    const bh = resolveBorehole(r.borehole); if (!bh) issues.borehole = r.borehole === '' ? 'Missing' : `Unknown: "${r.borehole}"`
    const rock = resolveRock(r.rock); if (!rock) issues.rock = r.rock === '' ? 'Missing' : `Unknown rock: "${r.rock}"`
    const t = toNum(r.thickness)
    if (t == null) issues.thickness = 'Missing'
    else if (Number.isNaN(t)) issues.thickness = `Not a number: "${r.thickness}"`
    else if (t <= 0 || t > 500) issues.thickness = 'Out of range'
    return { ...r, _bh: bh, _rock: rock, _t: t, _issues: issues }
  })
  const cellIssues = out.reduce((a, r) => a + Object.keys(r._issues).length, 0)
  const holes = [...new Set(out.map(r => r._bh).filter(Boolean))]
  return { ok: missing.length === 0 && cellIssues === 0 && out.length > 0, missing, rows: out, cellIssues, holes }
}

// validated rows → { [boreholeId]: [{rock,thickness}] } in file order
export function groupToStrata(rows) {
  const map = {}
  for (const r of rows) {
    if (!r._bh || !r._rock || r._t == null || Number.isNaN(r._t)) continue
    ;(map[r._bh] || (map[r._bh] = [])).push({ rock: r._rock, thickness: r._t })
  }
  return map
}

export async function downloadStrataTemplate() {
  const XLSX = await loadXLSX()
  const headers = ['Borehole', 'Rock', 'Thickness (m)']
  const sample = [
    ['BH-01', 'Soil', 6], ['BH-01', 'Sandstone', 14], ['BH-01', 'Coal', 5], ['BH-01', 'Basalt', 12],
    ['BH-02', 'Soil', 5], ['BH-02', 'Shale', 18], ['BH-02', 'Coal', 4], ['BH-02', 'Basalt', 10],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]); ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }]
  const notes = [
    ['Column', 'Notes'],
    ['Borehole', `Must match an existing hole: ${BOREHOLES.map(b => b.id).join(', ')}`],
    ['Rock', ROCK_LIST.map(r => r.name.split(' /')[0]).join(', ')],
    ['Thickness (m)', 'Layer thickness; list rows top → bottom per borehole'],
  ]
  const wsn = XLSX.utils.aoa_to_sheet(notes); wsn['!cols'] = [{ wch: 16 }, { wch: 64 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Strata')
  XLSX.utils.book_append_sheet(wb, wsn, 'Instructions')
  XLSX.writeFile(wb, 'blackridge-strata-template.xlsx')
}
