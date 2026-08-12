// The single KPI-tile anatomy used across every tab: label + ⓘ tooltip · big
// Manrope value + muted unit · footer pinned to the card's bottom edge with
// "Target X" left and a signed delta pill right. Clickable tiles get a →
// affordance and a hover lift. Colour only encodes state.
import { NUM, STATUS, fmt } from '../calc/format'
import { CARD, DeltaPill } from './ui'

export function KpiStat({ label, value, unit, dp = 0, kpi, targetSuffix, sub, footer, onClick, tooltip }) {
  const st = STATUS[kpi?.status] || STATUS.normal
  const clickable = typeof onClick === 'function'

  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-sm)'; e.currentTarget.style.transform = 'none' } : undefined}
      style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: clickable ? 'pointer' : 'default', transition: 'box-shadow 150ms, transform 150ms' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{label}</span>
        {tooltip && <span title={tooltip} aria-label={tooltip} style={{ cursor: 'help', color: 'var(--text-gray-tertiary)', fontSize: 12, lineHeight: 1 }}>ⓘ</span>}
        {clickable && <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-brand-default)', fontSize: 14, lineHeight: 1 }}>→</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="HeadingLargeSemibold" style={{ color: st.text, ...NUM, fontSize: 27 }}>{fmt(value, dp)}</span>
        {unit && <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{unit}</span>}
      </div>

      {sub && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{sub}</span>}

      {/* plain-text footer on the card's bottom edge (used where there is no target/variance) */}
      {footer != null && kpi?.target == null && kpi?.variance == null && (
        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-gray-subtle)' }}>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{footer}</span>
        </div>
      )}

      {/* footer sits on the card's bottom edge, however tall the card stretches */}
      {(kpi?.target != null || kpi?.variance != null) && (
        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-gray-subtle)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {kpi?.target != null && (
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>
              Target {fmt(kpi.target, dp)}{targetSuffix ?? (unit ? ` ${unit}` : '')}
            </span>
          )}
          {kpi?.variance != null && <span style={{ marginLeft: 'auto' }}><DeltaPill variance={kpi.variance} status={kpi.status} /></span>}
        </div>
      )}
    </div>
  )
}
