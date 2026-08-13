// Create / edit / delete a job — one modal form in the dashboard's language.
// User jobs (and edited built-ins) carry an absolute start (`startISO`) so they
// don't drift with "now". Deleting uses a two-step confirm on the same button.
// Saved jobs flow through the SAME calc as built-ins, so conflict / unassigned /
// unavailable detection applies to them automatically.
import { useEffect, useMemo, useState } from 'react'
import { Modal, Dropdown } from './primitives'
import { ROSTER, typeLabel, RESOURCE_TYPE_OPTIONS } from '../data/resources'
import { jobWindow } from '../data/resourceJobs'

// keep created jobs' `area` coherent with the machine type they need
const AREA_BY_TYPE = { truck: 'haul', shovel: 'load', loader: 'load', drill: 'pit', crusher: 'crush', conveyor: 'crush', screen: 'wash', thickener: 'wash' }
const INK = '#0F1728'

const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const inputStyle = {
  height: 36, padding: '0 12px', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-default)',
  background: 'var(--background-surface-intense)', font: 'inherit', fontSize: 13, color: 'var(--text-gray-primary)', width: '100%',
}
const Field = ({ label, children }) => (
  <div style={{ display: 'grid', gap: 6 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    {children}
  </div>
)

export function JobFormModal({ isOpen, onClose, job, now, onSave, onDelete }) {
  const editing = !!job
  const [title, setTitle] = useState('')
  const [reqType, setReqType] = useState('truck')
  const [priority, setPriority] = useState('P2')
  const [start, setStart] = useState('')
  const [durH, setDurH] = useState(6)
  const [unit, setUnit] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  // prefill on open (edit) or reset (create)
  useEffect(() => {
    if (!isOpen) return
    setConfirmDel(false)
    if (job) {
      const w = jobWindow(job, now)
      setTitle(job.title); setReqType(job.reqType); setPriority(job.priority)
      setStart(toLocalInput(w.start)); setDurH(job.durH); setUnit(job.defaultUnit || '')
    } else {
      setTitle(''); setReqType('truck'); setPriority('P2')
      setStart(toLocalInput(new Date(now.getTime() + 3600e3))); setDurH(6); setUnit('')
    }
  }, [isOpen, job, now])

  const typeOpts = RESOURCE_TYPE_OPTIONS.filter(o => o.id !== 'all')
  const unitOpts = useMemo(() => [
    { id: '', name: 'Unassigned' },
    ...ROSTER.filter(u => u.type === reqType).map(u => ({ id: u.id, name: `${u.id} · ${typeLabel(u.type)}` })),
  ], [reqType])
  // if the type changes, the selected unit may no longer fit
  useEffect(() => { if (unit && !ROSTER.some(u => u.id === unit && u.type === reqType)) setUnit('') }, [reqType])   // eslint-disable-line

  const valid = title.trim().length > 0 && start && Number(durH) > 0

  const save = () => {
    if (!valid) return
    onSave({
      id: job ? job.id : `UJOB-${Date.now().toString(36).toUpperCase()}`,
      title: title.trim(),
      area: job?.area || AREA_BY_TYPE[reqType] || 'haul',
      priority, reqType,
      startISO: new Date(start).toISOString(),
      durH: Number(durH),
      defaultUnit: unit || null,
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={480}
      title={editing ? `Edit job — ${job.id}` : 'New job'}
      subtitle={editing ? 'Changes apply immediately and persist' : 'The job joins scheduling like any other — conflicts and coverage are checked automatically'}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Job title">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Haul cycle — Pit → Crusher" style={inputStyle} autoFocus />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Machine type"><Dropdown value={reqType} options={typeOpts} onChange={setReqType} width="100%" /></Field>
          <Field label="Priority"><Dropdown value={priority} options={[{ id: 'P1', name: 'P1' }, { id: 'P2', name: 'P2' }, { id: 'P3', name: 'P3' }]} onChange={setPriority} width="100%" /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Starts">
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Duration (hours)">
            <input type="number" min="0.5" step="0.5" value={durH} onChange={e => setDurH(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <Field label="Assign unit (optional)"><Dropdown value={unit} options={unitOpts} onChange={setUnit} width="100%" /></Field>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {editing && (
            <button onClick={() => (confirmDel ? (onDelete(job.id), onClose()) : setConfirmDel(true))}
              className="BodySmallSemibold"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-error-secondary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = confirmDel ? 'var(--background-error-secondary)' : 'transparent' }}
              style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid var(--background-error-default)', background: confirmDel ? 'var(--background-error-secondary)' : 'transparent', color: 'var(--text-error-default)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
              {confirmDel ? 'Confirm delete' : 'Delete job'}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="BodySmallSemibold"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            style={{ padding: '8px 15px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-secondary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
            Cancel
          </button>
          <button onClick={save} disabled={!valid}
            className="BodySmallSemibold"
            style={{ padding: '8px 17px', borderRadius: 999, border: 'none', background: valid ? INK : 'var(--border-gray-default)', color: '#fff', cursor: valid ? 'pointer' : 'default', font: 'inherit', fontSize: 12.5 }}>
            {editing ? 'Save changes' : 'Create job'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
