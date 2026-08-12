// Shared design-system primitives for the redesign — ONE pill, one delta pill,
// one table style, one card language. Everything reads the overridden tokens.
import { useEffect, useState } from 'react'
import { fmt } from '../calc/format'

export const BRUCE_GRADIENT = 'linear-gradient(135deg, #a779f0 0%, #5b5bf0 100%)'

// ── ONE pagination for every table on the dashboard ──
// Default 10 per page; `pageItems` is the current slice; the `<Pager>` footer
// only renders when there's more than one page, so tables with ≤10 rows are
// unchanged. Pass a `resetKey` (e.g. the active filter) to jump back to page 1.
export function usePagination(items, { perPage = 10, resetKey } = {}) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [resetKey])
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / perPage))
  const cur = Math.min(page, pages - 1)
  const start = cur * perPage
  return { pageItems: items.slice(start, start + perPage), page: cur, pages, total, perPage, start, setPage }
}

const PagerBtn = ({ disabled, onClick, dir }) => (
  <button onClick={onClick} disabled={disabled} aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-secondary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, transition: 'background 150ms' }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === 'prev' ? 'rotate(90deg)' : 'rotate(-90deg)' }}><path d="m6 9 6 6 6-6" /></svg>
  </button>
)

// footer for a paginated table — spread the hook's return onto it: <Pager {...p} />
export function Pager({ page, pages, total, perPage, start, setPage, style }) {
  if (pages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--border-gray-subtle)', ...style }}>
      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{start + 1}–{Math.min(start + perPage, total)} of {total}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PagerBtn disabled={page === 0} onClick={() => setPage(page - 1)} dir="prev" />
        <span className="BodyXSmallSemibold" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-gray-secondary)', padding: '0 4px' }}>{page + 1} / {pages}</span>
        <PagerBtn disabled={page >= pages - 1} onClick={() => setPage(page + 1)} dir="next" />
      </div>
    </div>
  )
}

const PILL = {
  positive: { bg: 'var(--background-positive-secondary)', fg: 'var(--text-positive-default)' },
  warning:  { bg: 'var(--background-warning-secondary)',  fg: 'var(--text-warning-default)' },
  critical: { bg: 'var(--background-error-secondary)',    fg: 'var(--text-error-default)' },
  info:     { bg: 'var(--background-info-secondary)',     fg: 'var(--text-info-default)' },
  brand:    { bg: 'var(--background-brand-secondary)',    fg: 'var(--text-brand-default)' },
  neutral:  { bg: 'var(--background-surface-subtle)',     fg: 'var(--text-gray-secondary)' },
}
// the ONE pill/badge component — tinted bg + semantic text, fully rounded, 11px
export function Pill({ tone = 'neutral', children, style }) {
  const t = PILL[tone] || PILL.neutral
  return (
    <span className="BodyXSmallSemibold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: t.bg, color: t.fg, whiteSpace: 'nowrap', lineHeight: 1.55, ...style }}>
      {children}
    </span>
  )
}

// map the metric() status → pill tone
export const toneOf = (status) => (status === 'positive' ? 'positive' : status === 'warning' ? 'warning' : status === 'critical' ? 'critical' : 'neutral')

// signed delta pill — colour by good/bad state (status), arrow by sign
export function DeltaPill({ variance, status = 'normal', dp = 1 }) {
  if (variance == null || Number.isNaN(variance)) return null
  return <Pill tone={toneOf(status)}>{variance >= 0 ? '▲' : '▾'} {fmt(Math.abs(variance), dp)}%</Pill>
}

export const Eyebrow = ({ children, style }) => (
  <span className="eyebrow" style={style}>{children}</span>
)

// Import STATUS lazily inside the component to avoid a cycle-free small helper.
// Compact stat block (label + value/unit + optional delta pill) on a subtle well
// — used inside grouped cards where a full bordered KPI tile would be too heavy.
const MINI_TEXT = { positive: 'var(--text-positive-default)', warning: 'var(--text-warning-default)', critical: 'var(--text-error-default)', normal: 'var(--text-gray-primary)' }
export function MiniKpi({ label, value, unit, dp, kpi, tone, onClick, title }) {
  const status = kpi?.status || tone || 'normal'
  const clickable = typeof onClick === 'function'
  return (
    <div
      onClick={onClick} title={title}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = 'var(--background-surface-moderate)' } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' } : undefined}
      style={{ display: 'grid', gap: 5, justifyItems: 'start', padding: '11px 13px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', minWidth: 0, cursor: clickable ? 'pointer' : 'default', transition: 'background 150ms' }}>
      <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {label}
        {clickable && <span aria-hidden style={{ color: 'var(--text-brand-default)', fontSize: 11, lineHeight: 1, textTransform: 'none', letterSpacing: 0 }}>→</span>}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span className="BodyLargeSemibold" style={{ color: MINI_TEXT[status] || MINI_TEXT.normal, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmt(value, dp)}</span>
        {unit && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{unit}</span>}
      </div>
      {kpi?.target != null && <DeltaPill variance={kpi.variance} status={kpi.status} />}
    </div>
  )
}

// status dot + label (tables/rows) — colour only ever encodes state
const DOT = { positive: 'var(--background-positive-default)', warning: 'var(--background-warning-default)', critical: 'var(--background-error-default)', info: 'var(--background-info-default)', neutral: 'var(--text-gray-tertiary)' }
export const StatusDot = ({ tone = 'neutral', label, size = 9, color }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    <span style={{ width: size, height: size, borderRadius: '50%', background: color || DOT[tone] || DOT.neutral, flexShrink: 0 }} />
    {label != null && <span className="BodySmallRegular">{label}</span>}
  </span>
)

// health score → small progress track + number, coloured by band
export const healthBand = (h) => (h >= 85 ? 'positive' : h >= 70 ? 'warning' : 'critical')
export function HealthBar({ value, width = 44 }) {
  const tone = healthBand(value)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width, height: 6, borderRadius: 999, background: 'var(--background-surface-subtle)', overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.max(4, Math.min(100, value))}%`, background: DOT[tone], borderRadius: 999 }} />
      </span>
      <b className="BodySmallSemibold" style={{ color: `var(--text-${tone === 'critical' ? 'error' : tone}-default)`, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
    </span>
  )
}

// ── card + table style tokens (import into components) ──
// v2: BORDERLESS — white on soft canvas, depth from one soft shadow only.
export const CARD = { background: 'var(--background-surface-intense)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-sm)' }

// filter chip — single-select pill row (ink when active); optional muted count
export function FilterChip({ active, onClick, count, children }) {
  return (
    <button onClick={onClick} className="BodyXSmallSemibold" aria-pressed={active}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--background-surface-intense)' }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, cursor: 'pointer', font: 'inherit', transition: 'background 150ms',
        border: `1px solid ${active ? '#0F1728' : 'var(--border-gray-default)'}`,
        background: active ? '#0F1728' : 'var(--background-surface-intense)',
        color: active ? '#fff' : 'var(--text-gray-secondary)' }}>
      {children}
      {count != null && <span style={{ fontVariantNumeric: 'tabular-nums', color: active ? 'rgba(255,255,255,0.65)' : 'var(--text-gray-tertiary)' }}>{count}</span>}
    </button>
  )
}

// segmented pill control (sub-tabs) — track well + white active pill w/ shadow.
// An option may carry `badge` (a number): shown as a small amber count so
// attention items stay visible from sibling tabs.
export function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--background-surface-subtle)', justifySelf: 'start' }}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button key={o.id} onClick={() => onChange(o.id)} className="BodySmallSemibold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', transition: 'color 150ms, background 150ms',
              background: on ? 'var(--background-surface-intense)' : 'transparent',
              color: on ? 'var(--text-gray-primary)' : 'var(--text-gray-secondary)',
              boxShadow: on ? 'var(--fds-shadow-sm)' : 'none' }}>
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 999, background: 'var(--background-warning-secondary)', color: 'var(--text-warning-default)', display: 'inline-grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{o.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
export const th = (align = 'left') => ({ padding: '10px 14px', textAlign: align, color: 'var(--text-gray-tertiary)', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-gray-subtle)', background: 'var(--background-surface-subtle)' })
export const td = (align = 'left') => ({ padding: '12px 14px', textAlign: align, whiteSpace: 'nowrap', borderTop: '1px solid var(--border-gray-subtle)', color: 'var(--text-gray-primary)' })
