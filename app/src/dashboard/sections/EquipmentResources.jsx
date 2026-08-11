// Section · Equipment & Resources — operational-readiness view. Overview →
// Equipment at Risk → Equipment Monitor (type filter, row → drill-down drawer) →
// interactive Job Assignment + Conflicts → Planned Downtime. Reuses the shared
// asset-condition/health/PDM, timeline and utilisation; standalone demo jobs.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDash } from '../store'
import { buildResources, candidatesForType } from '../calc/resources'
import { rosterById, typeLabel, EQUIP_STATE, RESOURCE_TYPE_OPTIONS } from '../data/resources'
import { PLANNED_DOWNTIME, downtimeWindow } from '../data/plannedDowntime'
import { NUM, STATUS, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel, Dropdown } from '../components/primitives'
import { CARD, Eyebrow, Pill, HealthBar, th, td } from '../components/ui'
import { EquipmentDrawer } from '../components/EquipmentDrawer'

const PRIO_TONE = { P1: 'critical', P2: 'warning', P3: 'neutral' }
const StatusPill = ({ status }) => {
  const e = EQUIP_STATE[status] || EQUIP_STATE.Idle
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color, flexShrink: 0 }} /><span className="BodySmallRegular">{status}</span></span>
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
  const [statusFilter, setStatusFilter] = useState(null)   // null | status string | 'unavailable'
  const [atRiskOpen, setAtRiskOpen] = useState(false)      // collapsed by default
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState(null)
  const ov = rd.overview
  const monitorRows = rd.rows
    .filter(r => monType === 'all' || r.type === monType)
    .filter(r => !statusFilter ? true
      : statusFilter === 'unavailable' ? (r.status === 'Breakdown' || r.status === 'Under Maintenance')
      : r.status === statusFilter)
  // paginate the monitor — 10 rows/page, page 1 by default; reset when the filter changes
  const PER_PAGE = 10
  useEffect(() => { setPage(0) }, [monType, statusFilter])
  const totalPages = Math.max(1, Math.ceil(monitorRows.length / PER_PAGE))
  const curPage = Math.min(page, totalPages - 1)
  const pagedRows = monitorRows.slice(curPage * PER_PAGE, curPage * PER_PAGE + PER_PAGE)
  const availColor = ov.availability >= 85 ? 'var(--text-positive-default)' : ov.availability >= 70 ? 'var(--text-warning-default)' : 'var(--text-error-default)'
  const stats = [
    { label: 'Total', value: ov.total, filter: null },
    { label: 'Running', value: ov.Running, color: EQUIP_STATE.Running.text, filter: 'Running' },
    { label: 'Idle', value: ov.Idle, color: EQUIP_STATE.Idle.text, filter: 'Idle' },
    { label: 'Breakdown', value: ov.Breakdown, color: ov.Breakdown ? EQUIP_STATE.Breakdown.text : undefined, filter: 'Breakdown' },
    { label: 'Under Maint.', value: ov['Under Maintenance'], color: EQUIP_STATE['Under Maintenance'].text, filter: 'Under Maintenance' },
    { label: 'Utilisation', value: `${ov.overallUtil}%` },   // non-clickable — its per-unit detail IS the monitor table
    { label: 'Availability', value: `${ov.availability}%`, color: availColor, filter: 'unavailable' },
  ]
  // click a status stat → filter the monitor table in place; click the active one again → clear
  const applyFilter = (f) => setStatusFilter(cur => (cur === f ? null : f))
  const FILTER_LABEL = { Running: 'Running only', Idle: 'Idle only', Breakdown: 'Breakdown only', 'Under Maintenance': 'Under Maintenance only', unavailable: 'Unavailable only' }
  const FILTER_TONE = { Breakdown: 'critical', unavailable: 'critical', 'Under Maintenance': 'info', Running: 'positive', Idle: 'neutral' }

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      {/* 1 · Equipment Overview — one strip, 7 mini-stats split by hairlines */}
      <div style={{ ...CARD, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', overflow: 'hidden' }}>
        {stats.map((s, i) => {
          const clickable = 'filter' in s
          const active = clickable && s.filter !== null && statusFilter === s.filter
          const title = !clickable ? undefined
            : s.filter === null ? 'Show all units'
            : `Show only ${FILTER_LABEL[s.filter].replace(' only', '')} units`
          return (
            <div key={s.label} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} title={title}
              onClick={clickable ? () => applyFilter(s.filter) : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyFilter(s.filter) } } : undefined}
              onMouseEnter={clickable ? (e) => { if (!active) e.currentTarget.style.background = 'var(--background-surface-subtle)' } : undefined}
              onMouseLeave={clickable ? (e) => { if (!active) e.currentTarget.style.background = 'transparent' } : undefined}
              style={{ padding: '14px 16px', display: 'grid', gap: 6, alignContent: 'start', borderLeft: i ? '1px solid var(--border-gray-subtle)' : 'none', cursor: clickable ? 'pointer' : 'default', background: active ? 'var(--background-surface-subtle)' : 'transparent', transition: 'background 150ms' }}>
              <Eyebrow>{s.label}</Eyebrow>
              <span className="HeadingLargeSemibold" style={{ color: s.color || 'var(--text-gray-primary)', ...NUM, fontSize: 21, lineHeight: 1 }}>{s.value}</span>
            </div>
          )
        })}
      </div>

      {/* 2 · Equipment at Risk — collapsible, closed by default */}
      <Panel style={{ display: 'grid', gap: atRiskOpen ? 10 : 0 }}>
        <button onClick={() => setAtRiskOpen(o => !o)} aria-expanded={atRiskOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
          <span className="BodyLargeSemibold">Equipment at Risk</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{rd.atRisk.length} needing attention</span>
          <span style={{ flex: 1 }} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--text-gray-tertiary)', transform: atRiskOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {atRiskOpen && (rd.atRisk.length ? (
          <div style={{ display: 'grid', gap: 2 }}>
            {rd.atRisk.map((r, i) => (
              <div key={r.id} role="button" tabIndex={0} title={`Open ${r.id} detail`}
                onClick={() => setSel({ unit: rosterById(r.id), status: rd.statusOf(r.id) })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel({ unit: rosterById(r.id), status: rd.statusOf(r.id) }) } }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px', borderRadius: 'var(--global-border-radius-medium)', cursor: 'pointer', transition: 'background 120ms' }}>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', width: 16, ...NUM }}>{i + 1}</span>
                <span style={{ minWidth: 120 }}><b className="BodySmallSemibold" style={NUM}>{r.id}</b> <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{r.typeName}</span></span>
                <StatusPill status={r.status} />
                <span className="BodySmallRegular" style={{ flex: 1, color: 'var(--text-gray-secondary)' }}>{r.reason}</span>
                <HealthBar value={r.health} />
                <span aria-hidden style={{ color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</span>
              </div>
            ))}
          </div>
        ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>All equipment healthy — nothing needs attention.</span>)}
      </Panel>

      {/* 3 · Equipment Monitor */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="BodyLargeSemibold">Equipment Monitor</span>
            {statusFilter && (
              <button onClick={() => setStatusFilter(null)} title="Clear filter"
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>
                <Pill tone={FILTER_TONE[statusFilter] || 'neutral'}>{FILTER_LABEL[statusFilter]} ×</Pill>
              </button>
            )}
          </div>
          <Dropdown label="Equipment type" value={monType} options={RESOURCE_TYPE_OPTIONS} onChange={setMonType} width={220} />
        </div>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr><th style={th()}>Equipment</th><th style={th()}>Status</th><th style={th('right')}>Utilisation</th><th style={th('right')}>Downtime</th><th style={th()}>Current job / activity</th><th style={{ ...th(), width: 20 }} /></tr>
              </thead>
              <tbody>
                {monitorRows.map(r => (
                  <tr key={r.id} onClick={() => setSel({ unit: rosterById(r.id), status: r.status })} style={{ cursor: 'pointer', transition: 'background 120ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={td()}><b className="BodySmallSemibold" style={NUM}>{r.id}</b> <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{r.typeName}</span></td>
                    <td style={td()}><StatusPill status={r.status} /></td>
                    <td style={{ ...td('right'), ...NUM }}>{r.util}%</td>
                    <td style={{ ...td('right'), ...NUM }}>{fmt(r.downtimeH, 1)} h</td>
                    <td style={{ ...td(), color: r.currentJob ? 'var(--text-gray-primary)' : 'var(--text-gray-tertiary)' }} className="BodySmallRegular">{r.currentJob || '—'}</td>
                    <td style={{ ...td(), color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</td>
                  </tr>
                ))}
                {!monitorRows.length && <tr><td colSpan={6} style={{ ...td(), textAlign: 'center', color: 'var(--text-gray-tertiary)', padding: '24px 0' }}>{statusFilter ? 'No equipment matches this filter.' : 'No equipment for this type.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4 · Equipment Assignment (interactive) — 2-col job cards */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="BodyLargeSemibold">Equipment Assignment</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{rd.jobRows.length} jobs · {rd.problemCount} need attention</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12, alignItems: 'stretch' }}>
          {rd.jobRows.map(r => {
            const rail = (r.conflict || r.unitUnavailable) ? 'var(--background-error-default)' : r.unassigned ? 'var(--background-warning-default)' : null
            return (
              <div key={r.job.id} style={{ ...CARD, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderLeft: rail ? `3px solid ${rail}` : undefined }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Pill tone={PRIO_TONE[r.priority]}>{r.priority}</Pill>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="BodySmallSemibold">{r.job.title}</div>
                    <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{r.job.id} · needs {r.reqLabel} · {fmtStamp(r.win.start)}–{fmtStamp(r.win.end)}</div>
                  </div>
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

      {/* 5 · Scheduling & downtime — conflicts + planned downtime, one section */}
      <div style={{ display: 'grid', gap: 12 }}>
        <Eyebrow>Scheduling &amp; downtime</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14, alignItems: 'stretch' }}>

          <Panel style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <span className="BodyMediumSemibold">Conflicts</span>
            {rd.conflicts.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {rd.conflicts.map((c, i) => (
                  <div key={i} role="button" tabIndex={0} title={`Open ${c.unitId} detail`}
                    onClick={() => setSel({ unit: rosterById(c.unitId), status: rd.statusOf(c.unitId) })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel({ unit: rosterById(c.unitId), status: rd.statusOf(c.unitId) }) } }}
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
            <div style={{ padding: '14px 16px' }}><span className="BodyMediumSemibold">Planned Downtime</span></div>
            <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-gray-subtle)' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr><th style={th()}>Unit</th><th style={th()}>Kind</th><th style={th()}>Reason</th><th style={th('right')}>Window</th><th style={{ ...th(), width: 20 }} /></tr></thead>
                <tbody>
                  {PLANNED_DOWNTIME.map((d, i) => {
                    const u = rosterById(d.unitId); const w = downtimeWindow(d, now)
                    return (
                      <tr key={i} role="button" tabIndex={0} title={`Open ${d.unitId} detail`}
                        onClick={() => setSel({ unit: rosterById(d.unitId), status: rd.statusOf(d.unitId) })}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel({ unit: rosterById(d.unitId), status: rd.statusOf(d.unitId) }) } }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        style={{ cursor: 'pointer', transition: 'background 120ms' }}>
                        <td style={td()}><b className="BodySmallSemibold" style={NUM}>{d.unitId}</b> <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{u ? typeLabel(u.type) : ''}</span></td>
                        <td style={td()}><Pill tone={d.kind === 'Recurring' ? 'info' : 'neutral'}>{d.kind}</Pill></td>
                        <td style={{ ...td(), whiteSpace: 'normal' }} className="BodySmallRegular">{d.reason}</td>
                        <td style={{ ...td('right'), ...NUM, color: 'var(--text-gray-tertiary)' }} className="BodyXSmallRegular">{w ? `${fmtStamp(w.start)} → ${fmtStamp(w.end)}` : `${d.cadence} · ${d.window}`}</td>
                        <td style={{ ...td(), color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {sel && sel.unit && (
        <EquipmentDrawer unit={sel.unit} status={sel.status} range={range} settings={settings} assignments={assignments} now={now} onClose={() => setSel(null)} />
      )}
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
        <div ref={popRef} className="dash-theme" style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 220), maxHeight: 280, overflowY: 'auto', zIndex: 9999, background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-default)', borderRadius: 'var(--global-border-radius-medium)', boxShadow: 'var(--fds-shadow-md)', padding: 4 }}>
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
