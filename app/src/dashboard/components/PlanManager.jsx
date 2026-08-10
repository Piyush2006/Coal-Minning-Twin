// Plan Management — upload an Excel operational plan or enter one manually. The
// active plan becomes the source of every Plan-vs-Actual comparison (see
// calc/plan.js). Two modes (Upload / Manual) + an active-plan summary with
// Replace / Clear. All Excel I/O is delegated to lib/planParse (SheetJS).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@faclon-labs/design-sdk/Drawer'
import { Button } from '@faclon-labs/design-sdk/Button'
import { TextInput } from '@faclon-labs/design-sdk/TextInput'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Divider } from '@faclon-labs/design-sdk/Divider'
import { useDash } from '../store'
import { fmt } from '../calc/format'
import { Dropdown } from './primitives'
import { PLAN_COLUMNS, LEVELS, emptyRowsFor } from '../data/planSchema'
import { parseWorkbook, validatePlan, toStoredRows, manualToRows, downloadTemplate } from '../lib/planParse'
import { StrataManager } from './StrataManager'

// columns shown in the preview / manual grid (period + shift handled separately)
const VALUE_COLS = PLAN_COLUMNS.filter(c => !['period', 'shift'].includes(c.key))
const nowISO = () => new Date().toISOString()

const Tab = ({ id, active, onClick, children }) => (
  <button onClick={() => onClick(id)} className="BodySmallSemibold"
    style={{ padding: '8px 4px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--text-brand-default)' : 'transparent'}`,
      color: active ? 'var(--text-brand-default)' : 'var(--text-gray-secondary)', cursor: 'pointer', font: 'inherit' }}>
    {children}
  </button>
)

const Note = ({ tone = 'info', children }) => {
  const bg = { info: 'var(--background-surface-subtle)', ok: 'var(--background-positive-secondary, #e7f5ec)', err: 'var(--background-error-secondary, #fdecec)' }[tone]
  const col = { info: 'var(--text-gray-secondary)', ok: 'var(--text-positive-default)', err: 'var(--text-error-default)' }[tone]
  return <div className="BodySmallRegular" style={{ padding: '10px 12px', borderRadius: 'var(--global-border-radius-medium)', background: bg, color: col }}>{children}</div>
}

export function PlanManager({ isOpen, onClose }) {
  const { plan, setPlan, clearPlan } = useDash()
  const planPanel = useDash(s => s.planPanel)
  const [mode, setMode] = useState('upload')
  const [panel, setPanel] = useState('plan')     // 'plan' | 'strata'
  // sync to the requested panel whenever the drawer opens (deep-link support)
  useEffect(() => { if (isOpen) setPanel(planPanel || 'plan') }, [isOpen, planPanel])

  const Seg = ({ id, children }) => (
    <button onClick={() => setPanel(id)} className="BodySmallSemibold"
      style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', font: 'inherit', background: panel === id ? 'var(--background-brand-default)' : 'transparent', color: panel === id ? '#fff' : 'var(--text-gray-secondary)' }}>{children}</button>
  )

  return (
    <Drawer isOpen={isOpen} onDismiss={onClose} accessibilityLabel="Plan management">
      <DrawerHeader title="Plan Management" subtitle="Operational plan and borehole strata" />
      <DrawerBody>
        <div style={{ display: 'grid', gap: 18, paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--background-surface-subtle)' }}>
            <Seg id="plan">Operational Plan</Seg>
            <Seg id="strata">Borehole Strata</Seg>
          </div>

          {panel === 'plan' ? (
            <>
              {plan && <ActivePlan plan={plan} onClear={clearPlan} />}
              <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border-gray-subtle)' }}>
                <Tab id="upload" active={mode === 'upload'} onClick={setMode}>Upload Plan</Tab>
                <Tab id="manual" active={mode === 'manual'} onClick={setMode}>Add Manually</Tab>
              </div>
              {mode === 'upload'
                ? <UploadPane onImport={(p) => { setPlan(p); onClose() }} />
                : <ManualPane onSave={(p) => { setPlan(p); onClose() }} />}
            </>
          ) : (
            <StrataManager />
          )}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="Gray" color="Primary" size="Medium" onClick={onClose}>Close</Button>
      </DrawerFooter>
    </Drawer>
  )
}

// ── Active-plan summary ───────────────────────────────────────────────────────
function ActivePlan({ plan, onClear }) {
  const periods = plan.rows.map(r => r.period).sort()
  const coal = plan.rows.reduce((a, r) => a + (r.plannedCoal || 0), 0)
  const span = periods.length ? `${periods[0]} → ${periods[periods.length - 1]}` : '—'
  return (
    <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--global-border-radius-large)', background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge color="Positive" emphasis="Subtle" size="Small">Active plan</Badge>
        <span className="BodySmallSemibold" style={{ textTransform: 'capitalize' }}>{plan.level}</span>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>· {plan.source}{plan.fileName ? ` · ${plan.fileName}` : ''}</span>
        <Button variant="Gray" color="Danger" size="XSmall" onClick={onClear} style={{ marginLeft: 'auto' }}>Clear plan</Button>
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <Stat label="Rows" value={fmt(plan.rows.length)} />
        <Stat label="Coverage" value={span} />
        <Stat label="Total planned coal" value={`${fmt(coal)} T`} />
      </div>
      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Uploading or saving again replaces this plan.</span>
    </div>
  )
}
const Stat = ({ label, value }) => (
  <div style={{ display: 'grid', gap: 2 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodySmallSemibold">{value}</span>
  </div>
)

// ── Expected-columns reference ────────────────────────────────────────────────
function ColumnSpec() {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expected columns</span>
      <div style={{ display: 'grid', gap: 4 }}>
        {PLAN_COLUMNS.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="BodySmallRegular" style={{ minWidth: 190 }}>{c.label}{c.unit ? ` (${c.unit})` : ''}</span>
            <Badge color={c.required ? 'Warning' : 'Neutral'} emphasis="Subtle" size="Small">
              {c.required ? (c.key === 'shift' ? 'Shift-wise only' : 'Required') : 'Optional'}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Upload pane ───────────────────────────────────────────────────────────────
function UploadPane({ onImport }) {
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)   // { fileName, ok, level, requiredMissing, rows, summary, foundKeys }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''                      // allow re-selecting the same file
    if (!file) return
    setBusy(true); setError(''); setPreview(null)
    try {
      const parsed = await parseWorkbook(file)
      const v = validatePlan(parsed.rows, parsed.foundKeys)
      setPreview({ ...v, foundKeys: parsed.foundKeys, fileName: parsed.fileName })
    } catch (err) {
      setError(`Could not read the file: ${err?.message || err}`)
    } finally { setBusy(false) }
  }

  const doImport = () => {
    const rows = toStoredRows(preview.rows)
    onImport({ level: preview.level, source: 'upload', createdAt: nowISO(), fileName: preview.fileName, rows })
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <ColumnSpec />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="Secondary" size="Small" onClick={() => downloadTemplate()}>⬇ Download template</Button>
        <Button variant="Primary" size="Small" onClick={() => fileRef.current?.click()}>⬆ Choose Excel file</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={pick} style={{ display: 'none' }} />
      </div>
      {busy && <Note>Reading workbook…</Note>}
      {error && <Note tone="err">{error}</Note>}
      {preview && <>
        <Divider />
        {preview.requiredMissing.length > 0 && (
          <Note tone="err">Missing required column{preview.requiredMissing.length > 1 ? 's' : ''}: {preview.requiredMissing.map(k => PLAN_COLUMNS.find(c => c.key === k)?.label).join(', ')}</Note>
        )}
        {preview.requiredMissing.length === 0 && (
          preview.ok
            ? <Note tone="ok">✓ {preview.summary.rows} rows · {preview.level} plan · {preview.summary.optionalPresent.length} optional column(s). Ready to import.</Note>
            : <Note tone="err">{preview.summary.cellIssues} cell issue(s) — fix the highlighted cells (hover for detail) before importing.</Note>
        )}
        <PreviewTable preview={preview} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="Primary" size="Medium" disabled={!preview.ok} onClick={doImport}>Import plan</Button>
        </div>
      </>}
    </div>
  )
}

function PreviewTable({ preview }) {
  const cols = VALUE_COLS.filter(c => preview.foundKeys.includes(c.key) || c.key === 'plannedCoal')
  const showShift = preview.level === 'shift'
  const rows = preview.rows.slice(0, 60)
  const cell = (r, key) => {
    const bad = r._issues[key]
    return (
      <td key={key} title={bad || ''} style={{ padding: '5px 8px', whiteSpace: 'nowrap', textAlign: key === 'period' || key === 'shift' ? 'left' : 'right',
        background: bad ? 'var(--background-error-secondary, #fdecec)' : 'transparent', color: bad ? 'var(--text-error-default)' : 'var(--text-gray-primary)', borderBottom: '1px solid var(--border-gray-subtle)' }}>
        {r[key] === '' || r[key] == null ? (bad ? '—' : '') : String(r[key])}
      </td>
    )
  }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-medium)' }}>
      <table className="BodyXSmallRegular" style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr style={{ background: 'var(--background-surface-subtle)' }}>
            <th style={thStyle('left')}>Period</th>
            {showShift && <th style={thStyle('left')}>Shift</th>}
            {cols.map(c => <th key={c.key} style={thStyle('right')}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cell(r, 'period')}
              {showShift && cell(r, 'shift')}
              {cols.map(c => cell(r, c.key))}
            </tr>
          ))}
        </tbody>
      </table>
      {preview.rows.length > rows.length && (
        <div className="BodyXSmallRegular" style={{ padding: '6px 8px', color: 'var(--text-gray-tertiary)' }}>+{preview.rows.length - rows.length} more rows…</div>
      )}
    </div>
  )
}
const thStyle = (align) => ({ padding: '7px 8px', textAlign: align, color: 'var(--text-gray-secondary)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-gray-default)' })

// ── Manual pane ───────────────────────────────────────────────────────────────
function ManualPane({ onSave }) {
  const [level, setLevel] = useState('monthly')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [grid, setGrid] = useState(null)
  const [result, setResult] = useState(null)
  const isMonthly = level === 'monthly'

  const toDate = (s, monthly, isEnd) => {
    if (!s) return null
    if (monthly) { const [y, m] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, 1) }
    const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1)
  }
  const generate = () => {
    const sd = toDate(start, isMonthly), ed = toDate(end, isMonthly)
    if (!sd || !ed || ed < sd) { setResult({ error: 'Enter a valid start and end (end on/after start).' }); return }
    setGrid(emptyRowsFor(level, { start: sd, end: ed })); setResult(null)
  }
  const setCell = (i, key, val) => setGrid(g => g.map((r, idx) => idx === i ? { ...r, [key]: val } : r))

  const save = () => {
    const norm = manualToRows(grid)
    if (!norm.ok) { setResult({ error: `${norm.requiredMissing.length ? 'Missing planned coal on some rows. ' : ''}${norm.summary.cellIssues} cell issue(s) — every row needs a valid Planned Coal Production.` }); return }
    onSave({ level: norm.level, source: 'manual', createdAt: nowISO(), rows: norm.stored })
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Note>Enter the plan at the level you have it. Only Planned Coal Production is required; other columns are optional and become targets.</Note>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Dropdown label="Level" value={level} options={LEVELS.map(l => ({ id: l.id, name: l.label }))} onChange={(v) => { setLevel(v); setGrid(null) }} width={160} />
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{isMonthly ? 'From month' : 'From date'}</span>
          <input type={isMonthly ? 'month' : 'date'} value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{isMonthly ? 'To month' : 'To date'}</span>
          <input type={isMonthly ? 'month' : 'date'} value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
        </div>
        <Button variant="Secondary" size="Small" onClick={generate}>Generate rows</Button>
      </div>

      {result?.error && <Note tone="err">{result.error}</Note>}

      {grid && <>
        <ManualGrid grid={grid} level={level} onCell={setCell} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{grid.length} rows</span>
          <Button variant="Primary" size="Medium" onClick={save}>Save plan</Button>
        </div>
      </>}
    </div>
  )
}
const inputStyle = { height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', font: 'inherit', color: 'var(--text-gray-primary)' }

function ManualGrid({ grid, level, onCell }) {
  const showShift = level === 'shift'
  return (
    <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-medium)' }}>
      <table className="BodyXSmallRegular" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--background-surface-subtle)', position: 'sticky', top: 0 }}>
            <th style={thStyle('left')}>Period</th>
            {showShift && <th style={thStyle('left')}>Shift</th>}
            {VALUE_COLS.map(c => <th key={c.key} style={thStyle('right')}>{c.label}{c.unit ? ` (${c.unit})` : ''}{c.required ? ' *' : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.map((r, i) => (
            <tr key={i}>
              <td style={tdStyle('left')}>{r.period}</td>
              {showShift && <td style={tdStyle('left')}>{r.shift}</td>}
              {VALUE_COLS.map(c => (
                <td key={c.key} style={tdStyle('right')}>
                  <input type="number" value={r[c.key]} onChange={e => onCell(i, c.key, e.target.value)}
                    placeholder={c.required ? 'required' : '—'}
                    style={{ width: 90, height: 28, textAlign: 'right', padding: '0 6px', borderRadius: 6, border: '1px solid var(--border-gray-subtle)', background: 'var(--background-surface-moderate, transparent)', font: 'inherit', color: 'var(--text-gray-primary)' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
const tdStyle = (align) => ({ padding: '4px 8px', textAlign: align, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-gray-subtle)', color: 'var(--text-gray-primary)' })
