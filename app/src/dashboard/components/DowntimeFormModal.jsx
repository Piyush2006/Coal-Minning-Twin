// Plan / edit / delete downtime for a machine — one modal, same language as the
// job form. One-time entries carry an absolute start; recurring entries are
// STRUCTURED (weekday + start time + duration) so they genuinely flip the unit
// to "Under Maintenance" inside their weekly window. Display strings (cadence /
// window) are derived at save time so all existing renderers just work.
import { useEffect, useMemo, useState } from 'react'
import { Modal, Dropdown } from './primitives'
import { ROSTER, typeLabel } from '../data/resources'
import { downtimeWindow } from '../data/plannedDowntime'

const INK = '#0F1728'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_OPTS = DAYS.map((d, i) => ({ id: String(i), name: d }))

const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const hmPlus = (hm, hours) => {
  const [h, m] = hm.split(':').map(Number)
  const t = (h * 60 + m + Math.round(hours * 60)) % (24 * 60)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
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

// parse a built-in recurring entry's display strings for prefill
const parseCadence = (d) => {
  const dow = DAYS.findIndex(x => (d.cadence || '').includes(x))
  const m = (d.window || '').match(/(\d{2}:\d{2})\s*—\s*(\d{2}:\d{2})/)
  let durH = 2
  if (m) {
    const [h1, m1] = m[1].split(':').map(Number), [h2, m2] = m[2].split(':').map(Number)
    durH = Math.max(0.5, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60)
  }
  return { dow: dow >= 0 ? dow : 1, startHM: m ? m[1] : '07:00', durH }
}

export function DowntimeFormModal({ isOpen, onClose, entry, now, onSave, onDelete }) {
  const editing = !!entry
  const [unitId, setUnitId] = useState(ROSTER[0]?.id || '')
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState('One-time')
  const [start, setStart] = useState('')
  const [durH, setDurH] = useState(4)
  const [dow, setDow] = useState('6')
  const [startHM, setStartHM] = useState('07:00')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setConfirmDel(false)
    if (entry) {
      setUnitId(entry.unitId); setReason(entry.reason); setKind(entry.kind)
      if (entry.kind === 'One-time') {
        const w = downtimeWindow(entry, now)
        setStart(toLocalInput(w.start)); setDurH(entry.durH)
      } else {
        const p = entry.dow != null ? { dow: entry.dow, startHM: entry.startHM, durH: entry.durH } : parseCadence(entry)
        setDow(String(p.dow)); setStartHM(p.startHM); setDurH(p.durH)
      }
    } else {
      setUnitId(ROSTER[0]?.id || ''); setReason(''); setKind('One-time')
      setStart(toLocalInput(new Date(now.getTime() + 3600e3))); setDurH(4)
      setDow('6'); setStartHM('07:00')
    }
  }, [isOpen, entry, now])

  const unitOpts = useMemo(() => ROSTER.map(u => ({ id: u.id, name: `${u.id} · ${typeLabel(u.type)}` })), [])
  const valid = reason.trim().length > 0 && Number(durH) > 0 && (kind === 'One-time' ? !!start : !!startHM)

  const save = () => {
    if (!valid) return
    const base = { id: entry ? entry.id : `UPD-${Date.now().toString(36).toUpperCase()}`, unitId, reason: reason.trim(), kind, durH: Number(durH) }
    onSave(kind === 'One-time'
      ? { ...base, startISO: new Date(start).toISOString() }
      : { ...base, dow: Number(dow), startHM, cadence: `Every ${DAYS[Number(dow)]} (Weekly)`, window: `${startHM} — ${hmPlus(startHM, Number(durH))}` })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={480}
      title={editing ? `Edit downtime — ${entry.unitId}` : 'Plan downtime'}
      subtitle="While a window is active the machine goes Under Maintenance — availability, jobs and assignment all react">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Machine"><Dropdown value={unitId} options={unitOpts} onChange={setUnitId} width="100%" /></Field>
          <Field label="Type"><Dropdown value={kind} options={[{ id: 'One-time', name: 'One-time' }, { id: 'Recurring', name: 'Recurring (weekly)' }]} onChange={setKind} width="100%" /></Field>
        </div>
        <Field label="Reason">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Hydraulic service" style={inputStyle} autoFocus />
        </Field>
        {kind === 'One-time' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Starts"><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} /></Field>
            <Field label="Duration (hours)"><input type="number" min="0.5" step="0.5" value={durH} onChange={e => setDurH(e.target.value)} style={inputStyle} /></Field>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Every"><Dropdown value={dow} options={DAY_OPTS} onChange={setDow} width="100%" /></Field>
            <Field label="From"><input type="time" value={startHM} onChange={e => setStartHM(e.target.value)} style={inputStyle} /></Field>
            <Field label="Duration (hours)"><input type="number" min="0.5" step="0.5" value={durH} onChange={e => setDurH(e.target.value)} style={inputStyle} /></Field>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {editing && (
            <button onClick={() => (confirmDel ? (onDelete(entry.id), onClose()) : setConfirmDel(true))}
              className="BodySmallSemibold"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-error-secondary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = confirmDel ? 'var(--background-error-secondary)' : 'transparent' }}
              style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid var(--background-error-default)', background: confirmDel ? 'var(--background-error-secondary)' : 'transparent', color: 'var(--text-error-default)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
              {confirmDel ? 'Confirm delete' : 'Delete downtime'}
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
            {editing ? 'Save changes' : 'Plan downtime'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
