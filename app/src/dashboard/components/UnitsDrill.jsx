// Ranked-units drill for the Equipment KPIs — same drill language as
// MetricDrill (summary wells + clean table). Two modes over the SAME per-unit
// stats the tab already computes: 'utilisation' (worst first) and 'downtime'
// (biggest first, with each unit's top downtime reason). Click a row → the
// shared equipment drawer.
import { useMemo } from 'react'
import { Modal } from './primitives'
import { Pill, th, td, usePagination, Pager } from './ui'
import { NUM, fmt } from '../calc/format'
import { filterUnits, unitStats } from '../data/equipment'

const Well = ({ label, value, sub, color }) => (
  <div style={{ display: 'grid', gap: 3, padding: '12px 14px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', minWidth: 0 }}>
    <span className="eyebrow">{label}</span>
    <span className="BodyLargeSemibold" style={{ color: color || 'var(--text-gray-primary)', ...NUM }}>{value}</span>
    {sub && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{sub}</span>}
  </div>
)

const utilTone = (u) => (u >= 85 ? 'positive' : u >= 70 ? 'warning' : 'critical')
const BAR_FILL = { positive: 'var(--background-positive-default)', warning: 'var(--background-warning-default)', critical: 'var(--background-error-default)' }
const Track = ({ pct, tone }) => (
  <span style={{ display: 'block', height: 7, borderRadius: 999, background: 'var(--background-surface-subtle)', overflow: 'hidden' }}>
    <span style={{ display: 'block', height: '100%', width: `${Math.max(3, Math.min(100, pct))}%`, borderRadius: 999, background: BAR_FILL[tone] }} />
  </span>
)

export function UnitsDrillModal({ isOpen, onClose, mode = 'utilisation', typeFilter = null, typeName = null, filters, days, settings, overallUtil, onUnitClick }) {
  const rows = useMemo(() => {
    if (!isOpen) return []
    const units = filterUnits(filters).filter(u => !typeFilter || u.type === typeFilter)
    const stats = units.map(u => unitStats(u, overallUtil, days, settings))
    return stats
      .map(s => ({ ...s, downH: s.downtimeMin / 60, topReason: [...s.reasons].sort((a, b) => b.min - a.min)[0]?.name }))
      .sort(mode === 'utilisation' ? (a, b) => a.util - b.util : (a, b) => b.downH - a.downH)
  }, [isOpen, filters, typeFilter, overallUtil, days, settings, mode])
  const pg = usePagination(rows, { resetKey: `${mode}|${typeFilter || ''}` })

  if (!isOpen) return null
  const isUtil = mode === 'utilisation'
  const avg = rows.length ? rows.reduce((s, r) => s + r.util, 0) / rows.length : 0
  const totDown = rows.reduce((s, r) => s + r.downH, 0)
  const worst = rows[0]
  const maxDown = rows[0]?.downH || 1

  return (
    <Modal isOpen onClose={onClose}
      title={isUtil ? `Utilisation by unit${typeName ? ` — ${typeName}` : ''}` : 'Downtime by unit'}
      subtitle={`${rows.length} unit${rows.length === 1 ? '' : 's'} · ${isUtil ? 'lowest first' : 'most hours lost first'} · click a unit for full detail`}
      maxWidth={680}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {isUtil ? (
            <>
              <Well label="Average" value={`${fmt(avg, 1)}%`} />
              <Well label="Lowest" value={worst ? `${fmt(worst.util, 1)}%` : '—'} sub={worst?.id} color="var(--text-error-default)" />
              <Well label="Highest" value={rows.length ? `${fmt(rows[rows.length - 1].util, 1)}%` : '—'} sub={rows[rows.length - 1]?.id} color="var(--text-positive-default)" />
            </>
          ) : (
            <>
              <Well label="Total" value={`${fmt(totDown)} h`} />
              <Well label="Worst unit" value={worst ? `${fmt(worst.downH, 1)} h` : '—'} sub={worst?.id} color="var(--text-error-default)" />
              <Well label="Its top reason" value={worst?.topReason || '—'} />
            </>
          )}
        </div>

        <div style={{ borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-subtle)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th()}>Unit</th>
                  <th style={{ ...th(), width: '34%' }}>{isUtil ? 'Utilisation' : 'Downtime'}</th>
                  <th style={th('right')}>{isUtil ? '%' : 'Hours'}</th>
                  <th style={th()}>{isUtil ? '' : 'Top reason'}</th>
                  <th style={{ ...th(), width: 20 }} />
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map(r => {
                  const tone = utilTone(r.util)
                  return (
                    <tr key={r.id} onClick={() => onUnitClick?.(r.id)} title={`Open ${r.id} detail`}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      style={{ cursor: 'pointer', transition: 'background 120ms' }}>
                      <td style={td()}>
                        <b className="BodySmallSemibold" style={NUM}>{r.id}</b>
                        <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{r.typeName}</div>
                      </td>
                      <td style={td()}><Track pct={isUtil ? r.util : (r.downH / maxDown) * 100} tone={isUtil ? tone : (r === worst ? 'critical' : 'warning')} /></td>
                      <td style={{ ...td('right'), ...NUM }} className="BodySmallSemibold">{isUtil ? `${fmt(r.util, 1)}%` : `${fmt(r.downH, 1)} h`}</td>
                      <td style={td()}>{isUtil ? (r.util < 70 ? <Pill tone="critical">Low</Pill> : null) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{r.topReason}</span>}</td>
                      <td style={{ ...td(), color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</td>
                    </tr>
                  )
                })}
                {!rows.length && <tr><td colSpan={5} style={{ ...td(), textAlign: 'center', color: 'var(--text-gray-tertiary)', padding: '26px 0' }}>No units match the current filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager {...pg} />
        </div>
      </div>
    </Modal>
  )
}
