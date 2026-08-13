// Equipment › Scheduling — the WORK surface (vs Fleet's monitoring surface):
// interactive job assignment with filters (default = the actionable subset),
// plus its true context on the same screen — conflicts and planned downtime.
// Rows/cards drill into the shared equipment drawer.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDash } from '../store'
import { buildResources, candidatesForType } from '../calc/resources'
import { rosterById, typeLabel, EQUIP_STATE } from '../data/resources'
import { effectiveDowntimes, downtimeWindow, recurringWindowToday } from '../data/plannedDowntime'
import { NUM, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel, Dropdown } from '../components/primitives'
import { CARD, Pill, th, td } from '../components/ui'
import { EquipmentDrawer } from '../components/EquipmentDrawer'
import { JobFormModal } from '../components/JobFormModal'
import { DowntimeFormModal } from '../components/DowntimeFormModal'

const PRIO_TONE = { P1: 'critical', P2: 'warning', P3: 'neutral' }
const StatusPill = ({ status }) => {
  const e = EQUIP_STATE[status] || EQUIP_STATE.Idle
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color, flexShrink: 0 }} /><span className="BodySmallRegular">{status}</span></span>
}

export function EquipmentScheduling() {
  const { range, mineId, areaId, equipTypeId, settings } = useDash()
  const assignments = useDash(s => s.resourceAssignments)
  const setAssign = useDash(s => s.setResourceAssignment)
  const jobOverrides = useDash(s => s.jobOverrides)
  const downtimeOverrides = useDash(s => s.downtimeOverrides)
  const saveJob = useDash(s => s.saveJob)
  const deleteJob = useDash(s => s.deleteJob)
  const saveDowntime = useDash(s => s.saveDowntime)
  const deleteDowntime = useDash(s => s.deleteDowntime)
  const now = useMemo(() => new Date(), [])
  const rd = useMemo(
    () => buildResources({ range, mineId, areaId, equipTypeId, settings, assignments, jobOverrides, downtimeOverrides, now }),
    [range, mineId, areaId, equipTypeId, settings, assignments, jobOverrides, downtimeOverrides, now],
  )
  const [sel, setSel] = useState(null)
  // job form: false = closed, null = create, job object = edit
  const [jobForm, setJobForm] = useState(false)
  // downtime form: false = closed, null = create, entry object = edit
  const [dtForm, setDtForm] = useState(false)
  const downtimes = effectiveDowntimes(downtimeOverrides)

  // ── job filters — default to the actionable subset ──
  const [jobFilter, setJobFilter] = useState('attention')
  const [jobType, setJobType] = useState('all')
  const [jobPrio, setJobPrio] = useState('all')
  // if nothing needs attention, "attention" would be an empty default — fall back to all
  const effJobFilter = jobFilter === 'attention' && rd.problemCount === 0 ? 'all' : jobFilter
  const jobFilterOpts = [
    { id: 'attention', name: 'Needs attention' },
    { id: 'conflict', name: 'Conflict' },
    { id: 'unavailable', name: 'Unit unavailable' },
    { id: 'unassigned', name: 'Unassigned' },
    { id: 'all', name: 'All jobs' },
  ]
  const jobTypeOpts = [{ id: 'all', name: 'All machine types' },
    ...[...new Set(rd.jobRows.map(r => r.reqType))].map(t => ({ id: t, name: typeLabel(t) }))]
  const jobPrioOpts = [{ id: 'all', name: 'All priorities' }, { id: 'P1', name: 'P1' }, { id: 'P2', name: 'P2' }, { id: 'P3', name: 'P3' }]
  const filteredJobs = rd.jobRows
    .filter(r => effJobFilter === 'all' ? true
      : effJobFilter === 'attention' ? (r.conflict || r.unitUnavailable || r.unassigned)
      : effJobFilter === 'conflict' ? r.conflict
      : effJobFilter === 'unavailable' ? r.unitUnavailable
      : r.unassigned)
    .filter(r => jobType === 'all' || r.reqType === jobType)
    .filter(r => jobPrio === 'all' || r.priority === jobPrio)

  const openUnit = (id) => setSel({ unit: rosterById(id), status: rd.statusOf(id) })

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      {/* Equipment Assignment (interactive) — filtered job cards */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="BodyLargeSemibold">Equipment Assignment</span>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{rd.jobRows.length} jobs · {rd.problemCount} need attention</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Dropdown value={effJobFilter} options={jobFilterOpts} onChange={setJobFilter} width={170} />
            <Dropdown value={jobType} options={jobTypeOpts} onChange={setJobType} width={180} />
            <Dropdown value={jobPrio} options={jobPrioOpts} onChange={setJobPrio} width={130} />
            <button onClick={() => setJobForm(null)} className="BodySmallSemibold"
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-xs)' }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 15px', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12.5, background: '#0F1728', color: '#fff', boxShadow: 'var(--fds-shadow-xs)', transition: 'transform 150ms, box-shadow 150ms' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              New job
            </button>
          </div>
        </div>
        {!filteredJobs.length && (
          <Panel style={{ padding: 22 }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>
              {jobFilter === 'attention' && rd.problemCount === 0
                ? 'All jobs are assigned and conflict-free.'
                : 'No jobs match these filters.'}
            </span>
          </Panel>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12, alignItems: 'stretch' }}>
          {filteredJobs.map(r => {
            const rail = (r.conflict || r.unitUnavailable) ? 'var(--background-error-default)' : r.unassigned ? 'var(--background-warning-default)' : null
            return (
              <div key={r.job.id} style={{ ...CARD, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderLeft: rail ? `3px solid ${rail}` : undefined }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Pill tone={PRIO_TONE[r.priority]}>{r.priority}</Pill>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="BodySmallSemibold">{r.job.title}</div>
                    <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{r.job.id} · needs {r.reqLabel} · {fmtStamp(r.win.start)}–{fmtStamp(r.win.end)}</div>
                  </div>
                  <button onClick={() => setJobForm(r.job)} title={`Edit ${r.job.id}`} aria-label={`Edit ${r.job.id}`}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)'; e.currentTarget.style.color = 'var(--text-gray-primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-gray-tertiary)' }}
                    style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 'var(--global-border-radius-medium)', border: 'none', background: 'transparent', color: 'var(--text-gray-tertiary)', cursor: 'pointer', flexShrink: 0, transition: 'background 150ms, color 150ms' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                  </button>
                </div>
                {(r.conflict || r.unitUnavailable || r.unassigned) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.conflict && <Pill tone="critical">Conflict</Pill>}
                    {r.unitUnavailable && <Pill tone="critical">Unit unavailable</Pill>}
                    {r.unassigned && <Pill tone="warning">Unassigned</Pill>}
                  </div>
                )}
                <div style={{ marginTop: 'auto' }}>
                  <AssignPicker jobId={r.job.id} value={r.eff} reqType={r.reqType} statusOf={rd.statusOf} onPick={(u) => setAssign(r.job.id, u)} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* conflicts + planned downtime — the context the assignment decisions need */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, alignItems: 'stretch' }}>

        <Panel style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <span className="BodyMediumSemibold">Conflicts</span>
          {rd.conflicts.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {rd.conflicts.map((c, i) => (
                <div key={i} role="button" tabIndex={0} title={`Open ${c.unitId} detail`}
                  onClick={() => openUnit(c.unitId)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUnit(c.unitId) } }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-moderate)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', borderLeft: '3px solid var(--background-error-default)', cursor: 'pointer', transition: 'background 120ms' }}>
                  <b className="BodySmallSemibold" style={NUM}>{c.unitId}</b>
                  <span className="BodySmallRegular" style={{ flex: 1, color: 'var(--text-gray-secondary)' }}>{c.a.id} “{c.a.title}” ↔ {c.b.id} “{c.b.title}”</span>
                  <span className="BodyXSmallRegular" style={{ color: 'var(--text-error-default)', ...NUM }}>overlap {fmtStamp(c.overlapStart)}–{fmtStamp(c.overlapEnd)}</span>
                  <span aria-hidden style={{ color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</span>
                </div>
              ))}
            </div>
          ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>No equipment is double-booked.</span>}
        </Panel>

        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="BodyMediumSemibold">Planned Downtime</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => setDtForm(null)} className="BodySmallSemibold"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Plan downtime
            </button>
          </div>
          <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-gray-subtle)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th style={th()}>Unit</th><th style={th()}>Kind</th><th style={th()}>Reason</th><th style={th('right')}>Window</th><th style={{ ...th(), width: 20 }} /><th style={{ ...th(), width: 20 }} /></tr></thead>
              <tbody>
                {downtimes.map((d, i) => {
                  const u = rosterById(d.unitId); const w = downtimeWindow(d, now)
                  return (
                    <tr key={i} role="button" tabIndex={0} title={`Open ${d.unitId} detail`}
                      onClick={() => openUnit(d.unitId)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUnit(d.unitId) } }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      style={{ cursor: 'pointer', transition: 'background 120ms' }}>
                      <td style={td()}><b className="BodySmallSemibold" style={NUM}>{d.unitId}</b> <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{u ? typeLabel(u.type) : ''}</span></td>
                      <td style={td()}><Pill tone={d.kind === 'Recurring' ? 'info' : 'neutral'}>{d.kind}</Pill></td>
                      <td style={{ ...td(), whiteSpace: 'normal' }} className="BodySmallRegular">{d.reason}</td>
                      <td style={{ ...td('right'), ...NUM, color: 'var(--text-gray-tertiary)' }} className="BodyXSmallRegular">{w ? `${fmtStamp(w.start)} → ${fmtStamp(w.end)}` : `${d.cadence} · ${d.window}`}</td>
                      <td style={td()}>
                        <button onClick={(e) => { e.stopPropagation(); setDtForm(d) }} title={`Edit downtime ${d.id}`} aria-label={`Edit downtime ${d.id}`}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-moderate)'; e.currentTarget.style.color = 'var(--text-gray-primary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-gray-tertiary)' }}
                          style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 'var(--global-border-radius-medium)', border: 'none', background: 'transparent', color: 'var(--text-gray-tertiary)', cursor: 'pointer', transition: 'background 150ms, color 150ms' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                        </button>
                      </td>
                      <td style={{ ...td(), color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sel && sel.unit && (
        <EquipmentDrawer unit={sel.unit} status={sel.status} range={range} settings={settings} assignments={assignments} now={now} onClose={() => setSel(null)} />
      )}
      <JobFormModal isOpen={jobForm !== false} onClose={() => setJobForm(false)} job={jobForm || null} now={now}
        onSave={saveJob} onDelete={deleteJob} />
      <DowntimeFormModal isOpen={dtForm !== false} onClose={() => setDtForm(false)} entry={dtForm || null} now={now}
        onSave={saveDowntime} onDelete={deleteDowntime} />
    </div>
  )
}

// interactive assign picker — Available/idle selectable; Breakdown/Under
// Maintenance disabled. "Unassign" clears it. Portaled list (like primitives).
function AssignPicker({ jobId, value, reqType, statusOf, onPick }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null), popRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const cands = candidatesForType(reqType, statusOf)

  useLayoutEffect(() => {
    if (!open) return
    const update = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width }) }
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return; setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])

  const disabled = (s) => s === 'Breakdown' || s === 'Under Maintenance'
  return (
    <div style={{ width: 190 }}>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 11px', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', cursor: 'pointer', font: 'inherit', width: '100%' }}>
        <span className="BodySmallRegular" style={{ flex: 1, textAlign: 'left', color: value ? 'var(--text-gray-primary)' : 'var(--text-gray-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || 'Assign…'}</span>
        <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={popRef} className="dash-theme" style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 220), maxHeight: 280, overflowY: 'auto', zIndex: 10500, background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-default)', borderRadius: 'var(--global-border-radius-medium)', boxShadow: 'var(--fds-shadow-md)', padding: 4 }}>
          <button onClick={() => { onPick(''); setOpen(false) }} className="BodySmallRegular" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-gray-tertiary)', font: 'inherit' }}>— Unassign —</button>
          {cands.map(o => {
            const dis = disabled(o.status)
            return (
              <button key={o.id} disabled={dis} onClick={() => { if (!dis) { onPick(o.id); setOpen(false) } }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none', background: o.id === value ? 'var(--background-surface-subtle)' : 'none', cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.5 : 1, font: 'inherit', textAlign: 'left' }}>
                <span className="BodySmallRegular" style={{ flex: 1, color: 'var(--text-gray-primary)' }}>{o.name}</span>
                <StatusPill status={o.status} />
              </button>
            )
          })}
        </div>, document.body)}
    </div>
  )
}
