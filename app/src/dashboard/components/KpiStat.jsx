// Reusable secondary KPI tile — value + unit, target line, and a semantic
// variance badge. Colour is used only to signal state. Pass `onClick` to make
// the whole tile a clickable navigation target (shows a → affordance).
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { NUM, STATUS, fmt, fmtSigned } from '../calc/format'

export function KpiStat({ label, value, unit, dp = 0, kpi, targetSuffix, sub, onClick }) {
  const st = STATUS[kpi?.status] || STATUS.normal
  const clickable = typeof onClick === 'function'
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-gray-default)' } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border-gray-subtle)' } : undefined}
      style={{ background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-large)', padding: 16, display: 'grid', gap: 6, alignContent: 'start', cursor: clickable ? 'pointer' : 'default', transition: 'box-shadow 120ms, border-color 120ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{label}</span>
        {clickable && <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-brand-default)', fontSize: 13, lineHeight: 1 }}>→</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="HeadingLargeSemibold" style={{ color: st.text, ...NUM }}>{fmt(value, dp)}</span>
        {unit && <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{unit}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {kpi?.target != null && (
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>
            Target {fmt(kpi.target, dp)}{targetSuffix ?? (unit ? ` ${unit}` : '')}
          </span>
        )}
        {kpi?.variance != null && (
          <Badge color={st.badge} emphasis="Subtle" size="Small">{fmtSigned(kpi.variance, 1)}%</Badge>
        )}
      </div>
      {sub && <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{sub}</div>}
    </div>
  )
}
