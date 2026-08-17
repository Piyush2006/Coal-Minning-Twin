// Plan Management — upload an Excel operational plan or enter one manually. The
// active plan becomes the source of every Plan-vs-Actual comparison (see
// calc/plan.js). Two modes (Upload / Manual) + an active-plan summary with
// Replace / Clear. All Excel I/O is delegated to lib/planParse (SheetJS).
import { useEffect, useRef, useState } from 'react'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@faclon-labs/design-sdk/Drawer'
import { Button } from '@faclon-labs/design-sdk/Button'
import { Divider } from '@faclon-labs/design-sdk/Divider'
import { useDash } from '../store'
import { useMarkDrawer } from '../lib/drawerPresence'
import { NUM, fmt } from '../calc/format'
import { Dropdown } from './primitives'
import { Pill, Segmented, usePagination, Pager, th, td } from './ui'
import { PLAN_COLUMNS, LEVELS, emptyRowsFor } from '../data/planSchema'
import { parseWorkbook, validatePlan, toStoredRows, manualToRows, downloadTemplate } from '../lib/planParse'
import { StrataManager } from './StrataManager'

// columns shown in the preview / manual grid (period + shift handled separately)
const VALUE_COLS = PLAN_COLUMNS.filter(c => !['period', 'shift'].includes(c.key))
const nowISO = () => new Date().toISOString()

// function declarations (hoisted) so StrataManager can import them despite the
// parent/child import cycle between these two files.
export function Note({ tone = 'info', children }) {
  const bg = { info: 'var(--background-surface-subtle)', ok: 'var(--background-positive-secondary, #e7f5ec)', err: 'var(--background-error-secondary, #fdecec)' }[tone]
  const col = { info: 'var(--text-gray-secondary)', ok: 'var(--text-positive-default)', err: 'var(--text-error-default)' }[tone]
  return <div className="BodySmallRegular" style={{ padding: '10px 12px', borderRadius: 'var(--global-border-radius-medium)', background: bg, color: col }}>{children}</div>
}

// ghost-pill secondary action — the "Sensor data" / "Manage strata" pattern
export function GhostBtn({ onClick, icon, children }) {
  return (
    <button onClick={onClick} className="BodySmallSemibold"
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
      {icon}
      {children}
    </button>
  )
}
export function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
}

const PANELS = [{ id: 'plan', label: 'Operational Plan' }, { id: 'strata', label: 'Borehole Strata' }]
const MODES = [{ id: 'upload', label: 'Upload Plan' }, { id: 'manual', label: 'Add Manually' }]

export function PlanManager({ isOpen, onClose }) {
  useMarkDrawer(isOpen)
  const { plan, setPlan, clearPlan } = useDash()
  const planPanel = useDash(s => s.planPanel)
  const [mode, setMode] = useState('upload')
  const [panel, setPanel] = useState('plan')     // 'plan' | 'strata'
  // sync to the requested panel whenever the drawer opens (deep-link support)
  useEffect(() => { if (isOpen) setPanel(planPanel || 'plan') }, [isOpen, planPanel])

  return (
    <Drawer isOpen={isOpen} onDismiss={onClose} accessibilityLabel="Plan management">
      <DrawerHeader title="Plan Management" subtitle="Operational plan and borehole strata" />
      <DrawerBody>
        {/* the Drawer portals outside the themed root — re-apply the theme here */}
        <div className="dash-theme" style={{ display: 'grid', gap: 18, paddingBottom: 8 }}>
          <Segmented options={PANELS} value={panel} onChange={setPanel} />

          {panel === 'plan' ? (
            <>
              {plan && <ActivePlan plan={plan} onClear={clearPlan} />}
              <Segmented options={MODES} value={mode} onChange={setMode} />
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

// ── Active-plan summary — a well, not a nested card ──────────────────────────
function ActivePlan({ plan, onClear }) {
  const periods = plan.rows.map(r => r.period).sort()
  const coal = plan.rows.reduce((a, r) => a + (r.plannedCoal || 0), 0)
  const span = periods.length ? `${periods[0]} → ${periods[periods.length - 1]}` : '—'
  return (
    <div style={{ display: 'grid', gap: 10, padding: '12px 14px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill tone="positive">Active plan</Pill>
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
  <div style={{ display: 'grid', gap: 3 }}>
    <span className="eyebrow">{label}</span>
    <span className="BodySmallSemibold" style={NUM}>{value}</span>
  </div>
)

// ── Expected-columns reference ────────────────────────────────────────────────
function ColumnSpec() {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span className="eyebrow">Expected columns</span>
      <div style={{ display: 'grid', gap: 4 }}>
        {PLAN_COLUMNS.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="BodySmallRegular" style={{ minWidth: 190 }}>{c.label}{c.unit ? ` (${c.unit})` : ''}</span>
            <Pill tone={c.required ? 'warning' : 'neutral'}>
              {c.required ? (c.key === 'shift' ? 'Shift-wise only' : 'Required') : 'Optional'}
            </Pill>
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
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <GhostBtn onClick={() => downloadTemplate()} icon={<DownloadIcon />}>Download template</GhostBtn>
        <Button variant="Primary" size="Small" onClick={() => fileRef.current?.click()}>Choose Excel file</Button>
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
  const pg = usePagination(preview.rows, { resetKey: preview.fileName })
  const cell = (r, key) => {
    const bad = r._issues[key]
    return (
      <td key={key} title={bad || ''} className="BodyXSmallRegular"
        style={{ ...td(key === 'period' || key === 'shift' ? 'left' : 'right'), padding: '7px 10px', ...NUM,
          background: bad ? 'var(--background-error-secondary, #fdecec)' : 'transparent', color: bad ? 'var(--text-error-default)' : 'var(--text-gray-primary)' }}>
        {r[key] === '' || r[key] == null ? (bad ? '—' : '') : String(r[key])}
      </td>
    )
  }
  return (
    <div style={{ border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-medium)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th('left'), padding: '8px 10px' }}>Period</th>
              {showShift && <th style={{ ...th('left'), padding: '8px 10px' }}>Shift</th>}
              {cols.map(c => <th key={c.key} style={{ ...th('right'), padding: '8px 10px' }}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}
            </tr>
          </thead>
          <tbody>
            {pg.pageItems.map((r, i) => (
              <tr key={i}>
                {cell(r, 'period')}
                {showShift && cell(r, 'shift')}
                {cols.map(c => cell(r, c.key))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </div>
  )
}

// ── Manual pane ───────────────────────────────────────────────────────────────
function ManualPane({ onSave }) {
  const [level, setLevel] = useState('monthly')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [grid, setGrid] = useState(null)
  const [result, setResult] = useState(null)
  const isMonthly = level === 'monthly'

  const toDate = (s, monthly) => {
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
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{grid.length} rows</span>
          <Button variant="Primary" size="Medium" onClick={save}>Save plan</Button>
        </div>
      </>}
    </div>
  )
}
const inputStyle = { height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', font: 'inherit', color: 'var(--text-gray-primary)' }

function ManualGrid({ grid, level, onCell }) {
  const showShift = level === 'shift'
  const pg = usePagination(grid, { resetKey: `${level}|${grid.length}` })
  return (
    <div style={{ border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-medium)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th('left'), padding: '8px 10px' }}>Period</th>
              {showShift && <th style={{ ...th('left'), padding: '8px 10px' }}>Shift</th>}
              {VALUE_COLS.map(c => <th key={c.key} style={{ ...th('right'), padding: '8px 10px' }}>{c.label}{c.unit ? ` (${c.unit})` : ''}{c.required ? ' *' : ''}</th>)}
            </tr>
          </thead>
          <tbody>
            {pg.pageItems.map((r, i) => {
              const gi = pg.start + i           // global row index — edits address the full grid
              return (
                <tr key={r.period + (r.shift || '') }>
                  <td className="BodyXSmallRegular" style={{ ...td('left'), padding: '6px 10px', ...NUM }}>{r.period}</td>
                  {showShift && <td className="BodyXSmallRegular" style={{ ...td('left'), padding: '6px 10px' }}>{r.shift}</td>}
                  {VALUE_COLS.map(c => (
                    <td key={c.key} style={{ ...td('right'), padding: '5px 10px' }}>
                      <input type="number" value={r[c.key]} onChange={e => onCell(gi, c.key, e.target.value)}
                        placeholder={c.required ? 'required' : '—'}
                        style={{ width: 90, height: 28, textAlign: 'right', padding: '0 6px', borderRadius: 6, border: '1px solid var(--border-gray-subtle)', background: 'var(--background-surface-moderate, transparent)', font: 'inherit', color: 'var(--text-gray-primary)', fontVariantNumeric: 'tabular-nums' }} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </div>
  )
}
