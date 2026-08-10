// Section · Equipment & Resources — operational-readiness view. Overview →
// Equipment at Risk → Equipment Monitor (type filter, row → drill-down drawer) →
// interactive Job Assignment + Conflicts → Planned Downtime. Reuses the shared
// asset-condition/health/PDM, timeline and utilisation; standalone demo jobs.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Indicator } from '@faclon-labs/design-sdk/Indicator'
import { useDash } from '../store'
import { buildResources, candidatesForType } from '../calc/resources'
import { rosterById, typeLabel, EQUIP_STATE, RESOURCE_TYPE_OPTIONS } from '../data/resources'
import { PLANNED_DOWNTIME, downtimeWindow } from '../data/plannedDowntime'
import { NUM, STATUS, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel, KpiTile, Dropdown } from '../components/primitives'
import { EquipmentDrawer } from '../components/EquipmentDrawer'

const th = (a = 'left') => ({ padding: '9px 12px', textAlign: a, color: 'var(--text-gray-secondary)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 })
const td = (a = 'left') => ({ padding: '9px 12px', textAlign: a, whiteSpace: 'nowrap', borderTop: '1px solid var(--border-gray-subtle)' })
const PRIO_BADGE = { P1: 'Negative', P2: 'Notice', P3: 'Neutral' }
const StatusPill = ({ status }) => {
  const e = EQUIP_STATE[status] || EQUIP_STATE.Idle
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color }} /><span className="BodySmallRegular">{status}</span></span>
}
const hColor = (hs) => STATUS[hs]?.text || 'var(--text-gray-primary)'

export function EquipmentResources() {
  const { range, mineId, areaId, equipTypeId, settings } = useDash()
  const assignments = useDash(s => s.resourceAssignments)
  const setAssign = useDash(s => s.setResourceAssignment)
  const now = useMemo(() => new Date(), [])
  const rd = useMemo(
    () => buildResources({ range, mineId, areaId, equipTypeId, settings, assignments, now }),
    [range, mineId, areaId, equipTypeId, settings, assignments, now],
  )
  const [monType, setMonType] = useState('all')
  const [sel, setSel] = useState(null)
  const ov = rd.overview
  const monitorRows = monType === 'all' ? rd.rows : rd.rows.filter(r => r.type === monType)

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      {/* 1 · Equipment Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <Ov label="Total Equipment" value={ov.total} />
        <Ov label="Running" value={ov.Running} color={EQUIP_STATE.Running.text} />
        <Ov label="Idle" value={ov.Idle} color={EQUIP_STATE.Idle.text} />
        <Ov label="Breakdown" value={ov.Breakdown} color={ov.Breakdown ? EQUIP_STATE.Breakdown.text : undefined} />
        <Ov label="Under Maintenance" value={ov['Under Maintenance']} color={EQUIP_STATE['Under Maintenance'].text} />
        <Ov label="Overall Utilisation" value={`${ov.overallUtil}%`} />
        <Ov label="Overall Availability" value={`${ov.availability}%`} color={ov.availability >= 85 ? 'var(--text-positive-default)' : ov.availability >= 70 ? 'var(--text-warning-default)' : 'var(--text-error-default)'} />
      </div>

      {/* 2 · Equipment at Risk */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span className="BodyMediumSemibold">Equipment at Risk</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{rd.atRisk.length} needing attention</span>
        </div>
        {rd.atRisk.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {rd.atRisk.map((r, i) => (
              <div key={r.id} onClick={() => setSel({ unit: rosterById(r.id), status: rd.statusOf(r.id) })}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 'var(--global-border-radius-medium)', background: i % 2 ? 'transparent' : 'var(--background-surface-subtle)', cursor: 'pointer' }}>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', width: 16, ...NUM }}>{i + 1}</span>
                <span style={{ minWidth: 120 }}><b className="BodySmallSemibold" style={NUM}>{r.id}</b> <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{r.typeName}</span></span>
                <StatusPill status={r.status} />
                <span className="BodySmallRegular" style={{ flex: 1, color: 'var(--text-gray-secondary)' }}>{r.reason}</span>
                <span className="BodySmallSemibold" style={{ color: hColor(r.healthStatus), ...NUM }}>{r.health}</span>
              </div>
            ))}
          </div>
        ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>All equipment healthy — nothing needs attention.</span>}
      </Panel>

      {/* 3 · Equipment Monitor */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span className="BodyMediumSemibold">Equipment Monitor</span>
          <Dropdown label="Equipment type" value={monType} options={RESOURCE_TYPE_OPTIONS} onChange={setMonType} width={220} />
        </div>
        <Panel pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead style={{ background: 'var(--background-surface-subtle)' }}>
                <tr><th style={th()}>Equipment</th><th style={th()}>Status</th><th style={th('right')}>Utilisation</th><th style={th('right')}>Downtime</th><th style={th('right')}>Health</th><th style={th()}>Current job / activity</th></tr>
              </thead>
              <tbody>
                {monitorRows.map(r => (
                  <tr key={r.id} onClick={() => setSel({ unit: rosterById(r.id), status: r.status })} style={{ cursor: 'pointer' }}>
                    <td style={td()}><b className="BodySmallSemibold" style={NUM}>{r.id}</b> <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{r.typeName}</span></td>
                    <td style={td()}><StatusPill status={r.status} /></td>
                    <td style={{ ...td('right'), ...NUM }}>{r.util}%</td>
                    <td style={{ ...td('right'), ...NUM }}>{fmt(r.downtimeH, 1)} h</td>
                    <td style={{ ...td('right'), ...NUM, color: hColor(r.healthStatus), fontWeight: 600 }}>{r.health}</td>
                    <td style={{ ...td(), color: r.currentJob ? 'var(--text-gray-primary)' : 'var(--text-gray-tertiary)' }} className="BodySmallRegular">{r.currentJob || '—'}</td>
                  </tr>
                ))}
                {!monitorRows.length && <tr><td colSpan={6} style={{ ...td(), textAlign: 'center', color: 'var(--text-gray-tertiary)', padding: '24px 0' }}>No equipment for this type.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* 4 · Equipment Assignment (interactive) */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span className="BodyMediumSemibold">Equipment Assignment</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{rd.jobRows.length} jobs · {rd.problemCount} need attention</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {rd.jobRows.map(r => {
            const problem = r.unassigned || r.unitUnavailable || r.conflict
            return (
              <div key={r.job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--global-border-radius-medium)', border: `1px solid ${problem ? 'var(--background-error-default)' : 'var(--border-gray-subtle)'}`, background: problem ? 'var(--background-error-secondary, #fdecec)' : 'var(--background-surface-intense)', flexWrap: 'wrap' }}>
                <Badge color={PRIO_BADGE[r.priority]} emphasis="Subtle" size="Small">{r.priority}</Badge>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div className="BodySmallSemibold">{r.job.title}</div>
                  <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{r.job.id} · needs {r.reqLabel} · {fmtStamp(r.win.start)}–{fmtStamp(r.win.end)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.conflict && <Badge color="Negative" emphasis="Subtle" size="Small">Conflict</Badge>}
                  {r.unitUnavailable && <Badge color="Negative" emphasis="Subtle" size="Small">Unit unavailable</Badge>}
                  {r.unassigned && <Badge color="Warning" emphasis="Subtle" size="Small">Unassigned</Badge>}
                </div>
                <AssignPicker jobId={r.job.id} value={r.eff} reqType={r.reqType} statusOf={rd.statusOf} onPick={(u) => setAssign(r.job.id, u)} />
              </div>
            )
          })}
        </div>
      </Panel>

      {/* 5 · Equipment Conflicts */}
      <Panel>
        <span className="BodyMediumSemibold">Equipment Conflicts</span>
        {rd.conflicts.length ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {rd.conflicts.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-error-secondary, #fdecec)' }}>
                <b className="BodySmallSemibold" style={NUM}>{c.unitId}</b>
                <span className="BodySmallRegular" style={{ flex: 1, color: 'var(--text-gray-secondary)' }}>{c.a.id} “{c.a.title}” ↔ {c.b.id} “{c.b.title}”</span>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-error-default)', ...NUM }}>overlap {fmtStamp(c.overlapStart)}–{fmtStamp(c.overlapEnd)}</span>
              </div>
            ))}
          </div>
        ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)', display: 'block', marginTop: 8 }}>No scheduling conflicts — no equipment is double-booked.</span>}
      </Panel>

      {/* 6 · Planned Downtime */}
      <Panel>
        <span className="BodyMediumSemibold">Planned Downtime</span>
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {PLANNED_DOWNTIME.map((d, i) => {
            const u = rosterById(d.unitId); const w = downtimeWindow(d, now)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--global-border-radius-medium)', background: i % 2 ? 'transparent' : 'var(--background-surface-subtle)' }}>
                <span style={{ minWidth: 150 }}><b className="BodySmallSemibold" style={NUM}>{d.unitId}</b> <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{u ? typeLabel(u.type) : ''}</span></span>
                <Badge color={d.kind === 'Recurring' ? 'Information' : 'Neutral'} emphasis="Subtle" size="Small">{d.kind}</Badge>
                <span className="BodySmallRegular" style={{ flex: 1 }}>{d.reason}</span>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{w ? `${fmtStamp(w.start)} → ${fmtStamp(w.end)}` : `${d.cadence} · ${d.window}`}</span>
              </div>
            )
          })}
        </div>
      </Panel>

      {sel && sel.unit && (
        <EquipmentDrawer unit={sel.unit} status={sel.status} range={range} settings={settings} assignments={assignments} now={now} onClose={() => setSel(null)} />
      )}
    </div>
  )
}

const Ov = ({ label, value, color }) => (
  <KpiTile>
    <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{label}</span>
    <span className="HeadingLargeSemibold" style={{ color: color || 'var(--text-gray-primary)', ...NUM }}>{value}</span>
  </KpiTile>
)

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
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 11px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', cursor: 'pointer', font: 'inherit', width: '100%' }}>
        <span className="BodySmallRegular" style={{ flex: 1, textAlign: 'left', color: value ? 'var(--text-gray-primary)' : 'var(--text-gray-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || 'Assign…'}</span>
        <span style={{ color: 'var(--text-gray-tertiary)', fontSize: 10 }}>▾</span>
      </button>
      {open && createPortal(
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 220), maxHeight: 280, overflowY: 'auto', zIndex: 9999, background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-default)', borderRadius: 10, boxShadow: 'var(--fds-shadow-md)', padding: 4 }}>
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
