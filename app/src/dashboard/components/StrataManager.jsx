// Borehole-strata management inside Plan Management: enter a hole's rock layers
// manually or import them from Excel. Writes to the persisted boreholeStrata
// store slice that the Depth Profile · Formation view reads.
import { useRef, useState } from 'react'
import { Button } from '@faclon-labs/design-sdk/Button'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Divider } from '@faclon-labs/design-sdk/Divider'
import { useDash } from '../store'
import { fmt } from '../calc/format'
import { Dropdown } from './primitives'
import { BOREHOLES, boreholeById, boreholeStrata } from '../data/boreholes'
import { ROCKS, ROCK_OPTIONS } from '../data/geology'
import { STRATA_COLS, parseStrataWorkbook, validateStrata, groupToStrata, downloadStrataTemplate } from '../lib/strataParse'

const Tab = ({ id, active, onClick, children }) => (
  <button onClick={() => onClick(id)} className="BodySmallSemibold"
    style={{ padding: '8px 4px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--text-brand-default)' : 'transparent'}`, color: active ? 'var(--text-brand-default)' : 'var(--text-gray-secondary)', cursor: 'pointer', font: 'inherit' }}>{children}</button>
)
const Note = ({ tone = 'info', children }) => {
  const bg = { info: 'var(--background-surface-subtle)', ok: 'var(--background-positive-secondary, #e7f5ec)', err: 'var(--background-error-secondary, #fdecec)' }[tone]
  const col = { info: 'var(--text-gray-secondary)', ok: 'var(--text-positive-default)', err: 'var(--text-error-default)' }[tone]
  return <div className="BodySmallRegular" style={{ padding: '10px 12px', borderRadius: 'var(--global-border-radius-medium)', background: bg, color: col }}>{children}</div>
}
const th = (a = 'left') => ({ padding: '7px 10px', textAlign: a, color: 'var(--text-gray-secondary)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12, borderBottom: '1px solid var(--border-gray-default)' })

export function StrataManager() {
  const [mode, setMode] = useState('manual')
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Note>Strata drive the Depth Profile · Formation view (rock layers, per-layer ROP / fuel / cost). Edits persist.</Note>
      <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border-gray-subtle)' }}>
        <Tab id="manual" active={mode === 'manual'} onClick={setMode}>Add Manually</Tab>
        <Tab id="upload" active={mode === 'upload'} onClick={setMode}>Upload Strata</Tab>
      </div>
      {mode === 'manual' ? <ManualStrata /> : <UploadStrata />}
    </div>
  )
}

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
        <div style={{ display: 'grid', gap: 2, textAlign: 'right' }}>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Survey vs recorded</span>
          <span className="BodySmallSemibold" style={{ color: mismatch ? 'var(--text-warning-default)' : 'var(--text-gray-primary)' }}>{fmt(survey, 1)} m / {fmt(recorded, 1)} m</span>
        </div>
      </div>
      {mismatch && <Note tone="err">Survey depth is more than 5% off the recorded depth — the Formation view will hide per-layer numbers until reconciled.</Note>}

      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((L, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: (ROCKS[L.rock] || {}).color, flexShrink: 0 }} />
            <div style={{ width: 160 }}><Dropdown value={L.rock} options={ROCK_OPTIONS} onChange={(v) => edit(i, { rock: v })} width={160} /></div>
            <input type="number" value={L.thickness} min="0.1" step="0.5" onChange={e => edit(i, { thickness: Math.max(0.1, Number(e.target.value) || 0) })}
              style={{ width: 90, height: 34, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', font: 'inherit', textAlign: 'right', color: 'var(--text-gray-primary)' }} />
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>m</span>
            <button onClick={() => remove(i)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray-tertiary)', fontSize: 16, marginLeft: 'auto' }}>×</button>
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
      <div style={{ display: 'grid', gap: 4 }}>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expected columns</span>
        {STRATA_COLS.map(c => <span key={c.key} className="BodySmallRegular">{c.label} <Badge color="Warning" emphasis="Subtle" size="Small">Required</Badge></span>)}
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>One row per layer, listed top → bottom per borehole.</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="Secondary" size="Small" onClick={() => downloadStrataTemplate()}>⬇ Download template</Button>
        <Button variant="Primary" size="Small" onClick={() => fileRef.current?.click()}>⬆ Choose Excel file</Button>
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
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-medium)', maxHeight: 320, overflowY: 'auto' }}>
          <table className="BodyXSmallRegular" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--background-surface-subtle)' }}><tr>
              {STRATA_COLS.map(c => <th key={c.key} style={th()}>{c.label}</th>)}
            </tr></thead>
            <tbody>
              {preview.rows.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  {STRATA_COLS.map(c => {
                    const bad = r._issues[c.key]
                    return <td key={c.key} title={bad || ''} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-gray-subtle)', background: bad ? 'var(--background-error-secondary, #fdecec)' : 'transparent', color: bad ? 'var(--text-error-default)' : 'var(--text-gray-primary)' }}>{r[c.key] === '' ? (bad ? '—' : '') : String(r[c.key])}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="Primary" size="Medium" disabled={!preview.ok} onClick={doImport}>Import strata</Button>
        </div>
      </>}
    </div>
  )
}
