// A slim "Bruce Insight" strip that leads a panel with the one-line reasoning of
// what's going on and why. The supporting numbers live behind a "Show numbers"
// toggle (pass them as children). "Ask Bruce →" escalates to the full chat,
// seeded with `detail`, for a deeper conversational drill-down + charts.
import { useState } from 'react'
import { useDash } from '../store'
import { useBruceInsight } from '../lib/bruceInsights'
import { BRUCE_GRADIENT as GRADIENT } from './ui'

const LOGO = '/bruce-logo.svg'
const DOT = {
  critical: 'var(--background-error-default)', warning: 'var(--background-warning-default)',
  positive: 'var(--background-positive-default)', normal: 'var(--text-gray-tertiary)',
}
const linkBtn = { background: 'none', border: 'none', padding: 0, color: 'var(--text-brand-default)', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }
// compact round icon button (ghost) — tooltip carries the label
const iconBtn = {
  width: 26, height: 26, borderRadius: 999, border: 'none', background: 'transparent',
  display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: 'var(--text-gray-tertiary)',
  flexShrink: 0, transition: 'background 150ms, color 150ms',
}
const SVG = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

// one-time shimmer keyframes
const SHIMMER_CSS = '@keyframes bruceShimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}'

export function BruceInsight({ context, task, tone = 'normal', detail, children, variant = 'card' }) {
  const { text, loading, error, refresh } = useBruceInsight(context, task)
  const askBruce = useDash(s => s.askBruce)
  const [showNums, setShowNums] = useState(false)

  const base = { display: 'grid', gap: (children && showNums) ? 12 : 0 }
  const wrap = variant === 'bare' ? base
    : variant === 'rail' ? { ...base, padding: '12px 14px 12px 16px', borderRadius: 'var(--global-border-radius-large)', border: '1px solid var(--border-gray-subtle)', borderLeft: '3px solid #6b5bf0', background: 'var(--background-surface-intense)', boxShadow: 'var(--fds-shadow-xs)' }
    : { ...base, padding: '12px 14px', borderRadius: 'var(--global-border-radius-large)', border: '1px solid var(--border-gray-subtle)', background: 'var(--background-surface-intense)', boxShadow: 'var(--fds-shadow-xs)' }

  return (
    <div style={wrap}>
      <style>{SHIMMER_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: GRADIENT, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <img src={LOGO} width={22} height={22} style={{ borderRadius: 6 }} alt="Bruce" />
        </span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[tone] || DOT.normal, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? <Shimmer />
            : error ? <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Insight unavailable · <button onClick={refresh} style={linkBtn}>retry</button></span>
            : <span className="BodyMediumRegular" style={{ color: 'var(--text-gray-primary)' }}>{text}</span>}
        </div>
        {detail && !loading && !error && (
          <button onClick={() => askBruce(detail)} title="Ask Bruce about this" aria-label="Ask Bruce about this"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(107,91,240,0.10)'; e.currentTarget.style.color = '#6b5bf0' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-gray-tertiary)' }}
            style={iconBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" {...SVG}><path d="M7 17 17 7M9 7h8v8" /></svg>
          </button>
        )}
        {children && (
          <button onClick={() => setShowNums(s => !s)} title={showNums ? 'Hide numbers' : 'Show numbers'} aria-label={showNums ? 'Hide numbers' : 'Show numbers'} aria-expanded={showNums}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,24,40,0.05)'; e.currentTarget.style.color = 'var(--text-gray-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-gray-tertiary)' }}
            style={iconBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" {...SVG} style={{ transform: showNums ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><path d="m6 9 6 6 6-6" /></svg>
          </button>
        )}
      </div>
      {children && showNums && <div>{children}</div>}
    </div>
  )
}

const Shimmer = () => (
  <span style={{ display: 'inline-block', width: '70%', height: 12, borderRadius: 6,
    background: 'linear-gradient(90deg, var(--background-surface-subtle) 0px, var(--border-gray-subtle) 80px, var(--background-surface-subtle) 160px)',
    backgroundSize: '400px 100%', animation: 'bruceShimmer 1.1s linear infinite' }} />
)
