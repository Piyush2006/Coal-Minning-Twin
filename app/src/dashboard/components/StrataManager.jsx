// Borehole-strata management inside Plan Management: enter a hole's rock layers
// manually or import them from Excel. Writes to the persisted boreholeStrata
// store slice that the Depth Profile · Formation view reads.
import { useRef, useState } from 'react'
import { Button } from '@faclon-labs/design-sdk/Button'
import { Divider } from '@faclon-labs/design-sdk/Divider'
import { useDash } from '../store'
import { NUM, fmt } from '../calc/format'
import { Dropdown } from './primitives'
import { Pill, Segmented, usePagination, Pager, th, td } from './ui'
import { Note, GhostBtn, DownloadIcon } from './PlanManager'
import { BOREHOLES, boreholeById, boreholeStrata } from '../data/boreholes'
import { ROCKS, ROCK_OPTIONS } from '../data/geology'
import { STRATA_COLS, parseStrataWorkbook, validateStrata, groupToStrata, downloadStrataTemplate } from '../lib/strataParse'

const MODES = [{ id: 'manual', label: 'Add Manually' }, { id: 'upload', label: 'Upload Strata' }]

export function StrataManager() {
  const [mode, setMode] = useState('manual')
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Note>Strata drive the Depth Profile · Formation view (rock layers, per-layer ROP / fuel / cost). Edits persist.</Note>
      <Segmented options={MODES} value={mode} onChange={setMode} />
      {mode === 'manual' ? <ManualStrata /> : <UploadStrata />}
    </div>
  )
}

const Well = ({ label, value, warn }) => (
  <div style={{ display: 'grid', gap: 3, padding: '10px 12px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', minWidth: 120 }}>
    <span className="eyebrow">{label}</span>
    <span className="BodySmallSemibold" style={{ ...NUM, color: warn ? 'var(--text-warning-default)' : 'var(--text-gray-primary)' }}>{value}</span>
  </div>
)

// ── manual ────────────────────────────────────────────────────────────────────
function ManualStrata() {
  const strataByHole = useDash(s => s.boreholeStrata)
  const setBoreholeStrata = useDash(s => s.setBoreholeStrata)
  const resetBoreholeStrata = useDash(s => s.resetBoreholeStrata)
  const [id, setId] = useState(BOREHOLES[0].id)

  const rows = strataByHole[id] || boreholeStrata(id).map(L => ({ rock: L.rock, thickness: L.thickness }))
  const edited = !!strataByHole[id]
  const survey = rows.reduce((a, r) => a + (Number(r.thickness) || 0), 0)
  const recorded = boreholeById(id)?.recordedDepth || 0
  const mismatch = recorded ? Math.abs(survey - recorded) / recorded > 0.05 : false

  const write = (next) => setBoreholeStrata(id, next)
  const edit = (i, patch) => write(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const add = () => write([...rows, { rock: 'sandstone', thickness: 5 }])
  const remove = (i) => write(rows.filter((_, idx) => idx !== i))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Dropdown label="Borehole" value={id} options={BOREHOLES.map(b => ({ id: b.id, name: b.name }))} onChange={setId} width={230} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Well label="Survey depth" value={`${fmt(survey, 1)} m`} warn={mismatch} />
          <Well label="Recorded depth" value={`${fmt(recorded, 1)} m`} />
        </div>
      </div>
      {mismatch && <Note tone="err">Survey depth is more than 5% off the recorded depth — the Formation view will hide per-layer numbers until reconciled.</Note>}

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((L, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: (ROCKS[L.rock] || {}).color, flexShrink: 0 }} />
            <div style={{ width: 160 }}><Dropdown value={L.rock} options={ROCK_OPTIONS} onChange={(v) => edit(i, { rock: v })} width={160} /></div>
            <input type="number" value={L.thickness} min="0.1" step="0.5" onChange={e => edit(i, { thickness: Math.max(0.1, Number(e.target.value) || 0) })}
              style={{ width: 90, height: 34, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', font: 'inherit', textAlign: 'right', color: 'var(--text-gray-primary)', fontVariantNumeric: 'tabular-nums' }} />
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>m</span>
            <button onClick={() => remove(i)} title="Remove layer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray-tertiary)', fontSize: 16, marginLeft: 'auto' }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={add} className="BodySmallSemibold" style={{ background: 'none', border: 'none', color: 'var(--text-brand-default)', cursor: 'pointer' }}>+ Add layer</button>
        {edited && <button onClick={() => resetBoreholeStrata(id)} className="BodyXSmallSemibold" style={{ background: 'none', border: 'none', color: 'var(--text-brand-default)', cursor: 'pointer' }}>Reset to survey</button>}
      </div>
    </div>
  )
}

// ── upload ────────────────────────────────────────────────────────────────────
function UploadStrata() {
  const setBoreholeStrata = useDash(s => s.setBoreholeStrata)
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true); setError(''); setDone(''); setPreview(null)
    try {
      const parsed = await parseStrataWorkbook(file)
      setPreview({ ...validateStrata(parsed.rows, parsed.found), fileName: parsed.fileName })
    } catch (err) { setError(`Could not read the file: ${err?.message || err}`) }
    finally { setBusy(false) }
  }
  const doImport = () => {
    const groups = groupToStrata(preview.rows)
    const ids = Object.keys(groups)
    ids.forEach(id => setBoreholeStrata(id, groups[id]))
    setDone(`Imported strata for ${ids.length} borehole${ids.length > 1 ? 's' : ''}: ${ids.join(', ')}.`)
    setPreview(null)
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <span className="eyebrow">Expected columns</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STRATA_COLS.map(c => (
            <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="BodySmallRegular">{c.label}</span><Pill tone="warning">Required</Pill>
            </span>
          ))}
        </div>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>One row per layer, listed top → bottom per borehole.</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <GhostBtn onClick={() => downloadStrataTemplate()} icon={<DownloadIcon />}>Download template</GhostBtn>
        <Button variant="Primary" size="Small" onClick={() => fileRef.current?.click()}>Choose Excel file</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={pick} style={{ display: 'none' }} />
      </div>
      {busy && <Note>Reading workbook…</Note>}
      {error && <Note tone="err">{error}</Note>}
      {done && <Note tone="ok">✓ {done}</Note>}
      {preview && <>
        <Divider />
        {preview.missing.length > 0
          ? <Note tone="err">Missing required column{preview.missing.length > 1 ? 's' : ''}: {preview.missing.join(', ')}</Note>
          : preview.ok
            ? <Note tone="ok">✓ {preview.rows.length} layers across {preview.holes.length} borehole(s). Ready to import.</Note>
            : <Note tone="err">{preview.cellIssues} cell issue(s) — fix the highlighted cells before importing.</Note>}
        <StrataPreviewTable preview={preview} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="Primary" size="Medium" disabled={!preview.ok} onClick={doImport}>Import strata</Button>
        </div>
      </>}
    </div>
  )
}

function StrataPreviewTable({ preview }) {
  const pg = usePagination(preview.rows, { resetKey: preview.fileName })
  return (
    <div style={{ border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-medium)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{STRATA_COLS.map(c => <th key={c.key} style={{ ...th('left'), padding: '8px 10px' }}>{c.label}</th>)}</tr></thead>
          <tbody>
            {pg.pageItems.map((r, i) => (
              <tr key={i}>
                {STRATA_COLS.map(c => {
                  const bad = r._issues[c.key]
                  return <td key={c.key} title={bad || ''} className="BodyXSmallRegular" style={{ ...td('left'), padding: '7px 10px', background: bad ? 'var(--background-error-secondary, #fdecec)' : 'transparent', color: bad ? 'var(--text-error-default)' : 'var(--text-gray-primary)' }}>{r[c.key] === '' ? (bad ? '—' : '') : String(r[c.key])}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </div>
  )
}
