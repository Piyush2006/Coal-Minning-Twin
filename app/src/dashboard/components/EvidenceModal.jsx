// Safety-evidence detail + "raise action" workflow. Shows the CV snapshot and
// full metadata; if no action has been raised yet it shows a small form
// (assignee / priority / note), otherwise the raised-action record. Raised
// actions persist in the store (survive tab switches / reload).
import { useState } from 'react'
import { Button } from '@faclon-labs/design-sdk/Button'
import { Modal, Dropdown } from './primitives'
import { Pill } from './ui'
import { useDash } from '../store'

// severity → pill tone, shared with the evidence table + belt anomalies
export const SEV_TONE = { Critical: 'critical', High: 'warning', Medium: 'neutral', Low: 'neutral' }
export const SeverityBadge = ({ level }) => (
  <Pill tone={SEV_TONE[level] || 'neutral'}>{level}</Pill>
)
export const fmtEvidenceTime = (ts) =>
  new Date(ts).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const ASSIGNEES = ['Safety Officer', 'Shift Supervisor', 'HSE Manager', 'Area Foreman']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const Meta = ({ label, children }) => (
  <div style={{ display: 'grid', gap: 2 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodySmallSemibold">{children}</span>
  </div>
)

export function EvidenceModal({ evidence, onClose }) {
  const raiseSafetyAction = useDash(s => s.raiseSafetyAction)
  const raised = useDash(s => (evidence ? s.safetyActions[evidence.id] : null))
  const [assignee, setAssignee] = useState('Safety Officer')
  const [priority, setPriority] = useState('High')
  const [note, setNote] = useState('')

  // seed the priority from the event severity each time a new evidence opens
  const [seededFor, setSeededFor] = useState(null)
  if (evidence && seededFor !== evidence.id) {
    setSeededFor(evidence.id)
    setPriority(evidence.severity)
    setNote('')
    setAssignee('Safety Officer')
  }

  const submit = () => {
    raiseSafetyAction(evidence.id, { assignee, priority, note: note.trim() })
    onClose()
  }

  return (
    <Modal isOpen={!!evidence} onClose={onClose} maxWidth={860}
      title="Safety evidence"
      subtitle={evidence ? `${evidence.cat} · ${evidence.location} · ${evidence.camera}` : ''}>
      {evidence && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.1fr) 1fr', gap: 20 }}>
            <img src={evidence.image} alt="CV evidence snapshot"
              style={{ width: '100%', height: 240, objectFit: 'cover', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-subtle)' }} />
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span className="HeadingSmallSemibold">{evidence.description}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Pill tone="neutral">{evidence.cat}</Pill>
                  <SeverityBadge level={evidence.severity} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Meta label="Date & time">{fmtEvidenceTime(evidence.ts)}</Meta>
                <Meta label="Location">{evidence.location}</Meta>
                <Meta label="Camera">{evidence.camera}</Meta>
                <Meta label="Detection confidence">{evidence.confidence}%</Meta>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-gray-subtle)' }} />

          {raised ? (
            <div style={{ display: 'grid', gap: 8, padding: 14, borderRadius: 'var(--global-border-radius-large)', background: 'var(--background-positive-secondary, var(--background-surface-subtle))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pill tone="positive">✓ Action raised</Pill>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{fmtEvidenceTime(raised.at)}</span>
              </div>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                <Meta label="Assigned to">{raised.assignee}</Meta>
                <Meta label="Priority">{raised.priority}</Meta>
              </div>
              {raised.note && <Meta label="Note">{raised.note}</Meta>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              <span className="BodySmallSemibold" style={{ color: 'var(--text-gray-secondary)' }}>Raise a safety action</span>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <Dropdown label="Assign to" value={assignee} options={ASSIGNEES.map(a => ({ id: a, name: a }))} onChange={setAssignee} width={200} />
                <Dropdown label="Priority" value={priority} options={PRIORITIES.map(p => ({ id: p, name: p }))} onChange={setPriority} width={150} />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Note (optional)</span>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Corrective action, follow-up owner, deadline…"
                  style={{ resize: 'vertical', padding: '8px 10px', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', font: 'inherit', color: 'var(--text-gray-primary)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="Gray" size="Medium" onClick={onClose}>Cancel</Button>
                <Button variant="Primary" size="Medium" onClick={submit}>Raise action</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
