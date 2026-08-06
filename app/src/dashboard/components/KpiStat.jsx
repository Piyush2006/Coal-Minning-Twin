// Reusable secondary KPI tile — value + unit, target line, and a semantic
// variance badge. Colour is used only to signal state.
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { NUM, STATUS, fmt, fmtSigned } from '../calc/format'

export function KpiStat({ label, value, unit, dp = 0, kpi, targetSuffix, sub }) {
  const st = STATUS[kpi?.status] || STATUS.normal
  return (
    <div style={{ background: 'var(--background-surface-intense)', border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-large)', padding: 16, display: 'grid', gap: 6, alignContent: 'start' }}>
      <div className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{label}</div>
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
