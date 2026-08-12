// Equipment › Monitor — the MONITORING surface: overview strip (clickable status
// filters), collapsible at-risk ranking, and the paginated equipment monitor.
// Scheduling work (assignment/conflicts/downtime) lives on the Scheduling
// sub-tab (EquipmentScheduling.jsx).
import { useMemo, useState } from 'react'
import { useDash } from '../store'
import { buildResources } from '../calc/resources'
import { rosterById, EQUIP_STATE, RESOURCE_TYPE_OPTIONS } from '../data/resources'
import { NUM, fmt } from '../calc/format'
import { Panel, Dropdown } from '../components/primitives'
import { CARD, Eyebrow, Pill, HealthBar, th, td, usePagination, Pager } from '../components/ui'
import { EquipmentDrawer } from '../components/EquipmentDrawer'

const StatusPill = ({ status }) => {
  const e = EQUIP_STATE[status] || EQUIP_STATE.Idle
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color, flexShrink: 0 }} /><span className="BodySmallRegular">{status}</span></span>
}

export function EquipmentResources() {
  const { range, mineId, areaId, equipTypeId, settings } = useDash()
  const assignments = useDash(s => s.resourceAssignments)
  const jobOverrides = useDash(s => s.jobOverrides)
  const downtimeOverrides = useDash(s => s.downtimeOverrides)
  const now = useMemo(() => new Date(), [])
  const rd = useMemo(
    () => buildResources({ range, mineId, areaId, equipTypeId, settings, assignments, jobOverrides, downtimeOverrides, now }),
    [range, mineId, areaId, equipTypeId, settings, assignments, jobOverrides, downtimeOverrides, now],
  )
  const [monType, setMonType] = useState('all')
  const [statusFilter, setStatusFilter] = useState(null)   // null | status string | 'unavailable'
  const [atRiskOpen, setAtRiskOpen] = useState(false)      // collapsed by default
  const [sel, setSel] = useState(null)
  const ov = rd.overview
  const monitorRows = rd.rows
    .filter(r => monType === 'all' || r.type === monType)
    .filter(r => !statusFilter ? true
      : statusFilter === 'unavailable' ? (r.status === 'Breakdown' || r.status === 'Under Maintenance')
      : r.status === statusFilter)
  const mon = usePagination(monitorRows, { resetKey: `${monType}|${statusFilter}` })

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
                {mon.pageItems.map(r => (
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
          <Pager {...mon} />
        </div>
      </div>

      {sel && sel.unit && (
        <EquipmentDrawer unit={sel.unit} status={sel.status} range={range} settings={settings} assignments={assignments} now={now} onClose={() => setSel(null)} />
      )}
    </div>
  )
}
