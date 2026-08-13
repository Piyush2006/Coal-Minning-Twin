// The per-day cost & consumption breakdown behind Operating Cost / Ton, shown in
// a modal. In shift mode the header becomes two levels — a shift group spanning
// its metric columns (Day | Shift 1 [metrics] | Shift 2 [metrics]).
import { Modal } from './primitives'
import { usePagination, Pager, th, td } from './ui'
import { NUM, fmt } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'

const loadXLSX = () => import('xlsx')

// mixed units by design (Operating Cost & Fuel Cost in ₹, Ton, Energy kWh, Man-Hours)
const METRICS = [
  { key: 'opCost', label: 'Operating Cost', unit: CURRENCY, money: true },
  { key: 'ton', label: 'Ton', unit: 'T' },
  { key: 'energyKwh', label: 'Energy', unit: 'kWh' },
  { key: 'manHours', label: 'Man-Hours', unit: 'mh' },
  { key: 'fuelCost', label: 'Fuel Cost', unit: CURRENCY, money: true },
]
const val = (m, v) => (m.money ? `${CURRENCY}${fmt(v, 0)}` : fmt(v, 0))
const sumBy = (rows, get, key) => rows.reduce((a, r) => a + get(r)[key], 0)

// Export the exact on-screen layout to .xlsx. In shift mode the header is two
// rows with merged shift-group cells (Day | Shift 1 [metrics] | Shift 2 [metrics]).
async function exportXlsx(rows, shiftMode, shiftNames) {
  const XLSX = await loadXLSX()
  const heads = METRICS.map(m => `${m.label} (${m.unit})`)
  const rnd = (o, m) => Math.round(o[m.key])
  let aoa, merges
  if (shiftMode) {
    const blanks = Array(METRICS.length - 1).fill('')
    aoa = [
      ['Day', shiftNames[0], ...blanks, shiftNames[1], ...blanks],
      ['', ...heads, ...heads],
      ...rows.map(r => [r.date, ...METRICS.map(m => rnd(r.shifts[0], m)), ...METRICS.map(m => rnd(r.shifts[1], m))]),
      ['Total', ...[0, 1].flatMap(si => METRICS.map(m => Math.round(sumBy(rows, x => x.shifts[si], m.key))))],
    ]
    merges = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 0, c: METRICS.length } },
      { s: { r: 0, c: METRICS.length + 1 }, e: { r: 0, c: METRICS.length * 2 } },
    ]
  } else {
    aoa = [
      ['Day', ...heads],
      ...rows.map(r => [r.date, ...METRICS.map(m => rnd(r.total, m))]),
      ['Total', ...METRICS.map(m => Math.round(sumBy(rows, x => x.total, m.key)))],
    ]
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  if (merges) ws['!merges'] = merges
  const widthHeads = shiftMode ? [...heads, ...heads] : heads
  ws['!cols'] = [{ wch: 10 }, ...widthHeads.map(h => ({ wch: Math.max(13, h.length + 1) }))]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, shiftMode ? 'Cost per shift' : 'Cost per day')
  XLSX.writeFile(wb, `blackridge-operating-cost-${shiftMode ? 'shiftwise' : 'daily'}.xlsx`)
}

// the two-row shift-group spanning header is the one thing shared th() can't
// express — keep it bespoke; everything else uses shared th()/td().
const GROUP = { textAlign: 'center', borderLeft: '1px solid var(--border-gray-subtle)' }
const LEFTBORDER = { borderLeft: '1px solid var(--border-gray-subtle)' }

export function CostTableModal({ isOpen, onClose, costByDay = [], shiftMode, shiftNames = ['Shift 1', 'Shift 2'] }) {
  const rows = costByDay
  const pg = usePagination(rows, { resetKey: `${isOpen}|${shiftMode}` })
  const metricHead = (prefix) => METRICS.map((m, i) => (
    <th key={prefix + m.key} style={{ ...th('right'), ...(i === 0 ? LEFTBORDER : null) }}>
      {m.label}<span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', fontWeight: 400, textTransform: 'none' }}> ({m.unit})</span>
    </th>
  ))
  const metricCells = (row) => METRICS.map((m, i) => (
    <td key={m.key} style={{ ...td('right'), ...NUM, ...(i === 0 ? LEFTBORDER : null) }}>{val(m, row[m.key])}</td>
  ))

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={shiftMode ? 'Operating cost & consumption — per shift' : 'Operating cost & consumption — per day'}
      subtitle={`${rows.length} rows · the detail behind Operating Cost / Ton`}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => exportXlsx(rows, shiftMode, shiftNames)} disabled={!rows.length}
          title="Export to Excel" aria-label="Export to Excel"
          onMouseEnter={(e) => { if (rows.length) { e.currentTarget.style.background = 'var(--background-surface-subtle)'; e.currentTarget.style.color = 'var(--text-gray-primary)' } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-gray-secondary)' }}
          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-secondary)', display: 'inline-grid', placeItems: 'center', cursor: rows.length ? 'pointer' : 'not-allowed', opacity: rows.length ? 1 : 0.5, transition: 'background 150ms, color 150ms' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v11M7.5 9.5 12 14l4.5-4.5" /><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
          </svg>
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="BodySmallRegular" style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            {shiftMode ? (
              <>
                <tr>
                  <th rowSpan={2} style={th('left')}>Day</th>
                  <th colSpan={METRICS.length} style={{ ...th('center'), ...GROUP }}>{shiftNames[0]}</th>
                  <th colSpan={METRICS.length} style={{ ...th('center'), ...GROUP }}>{shiftNames[1]}</th>
                </tr>
                <tr>
                  {metricHead('s0-')}
                  {metricHead('s1-')}
                </tr>
              </>
            ) : (
              <tr>
                <th style={th('left')}>Day</th>
                {metricHead('t-')}
              </tr>
            )}
          </thead>
          <tbody>
            {pg.pageItems.map((r) => (
              <tr key={r.date}>
                <td style={{ ...td('left'), fontWeight: 600 }}>{r.date}</td>
                {shiftMode
                  ? <>{metricCells(r.shifts[0])}{metricCells(r.shifts[1])}</>
                  : metricCells(r.total)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--background-surface-intense)' }}>
              <td style={{ ...td('left'), fontWeight: 700 }}>Total</td>
              {shiftMode
                ? [0, 1].map(si => METRICS.map((m, i) => (
                    <td key={si + m.key} style={{ ...td('right'), ...NUM, fontWeight: 700, ...(i === 0 ? LEFTBORDER : null) }}>
                      {val(m, sumBy(rows, r => r.shifts[si], m.key))}
                    </td>
                  )))
                : METRICS.map(m => (
                    <td key={m.key} style={{ ...td('right'), ...NUM, fontWeight: 700 }}>{val(m, sumBy(rows, r => r.total, m.key))}</td>
                  ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <Pager {...pg} />
    </Modal>
  )
}
