// A slim "Bruce Insight" strip that leads a panel with the one-line reasoning of
// what's going on and why. The supporting numbers live behind a "Show numbers"
// toggle (pass them as children). "Ask Bruce →" escalates to the full chat,
// seeded with `detail`, for a deeper conversational drill-down + charts.
import { useState } from 'react'
import { useDash } from '../store'
import { useBruceInsight } from '../lib/bruceInsights'

const LOGO = '/bruce-logo.svg'
const GRADIENT = 'linear-gradient(135deg, #a779f0 0%, #5b5bf0 100%)'
const DOT = {
  critical: 'var(--background-error-default)', warning: 'var(--background-warning-default)',
  positive: 'var(--background-positive-default)', normal: 'var(--text-gray-tertiary)',
}
const linkBtn = { background: 'none', border: 'none', padding: 0, color: 'var(--text-brand-default)', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }

// one-time shimmer keyframes
const SHIMMER_CSS = '@keyframes bruceShimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}'

export function BruceInsight({ context, task, tone = 'normal', detail, children }) {
  const { text, loading, error, refresh } = useBruceInsight(context, task)
  const askBruce = useDash(s => s.askBruce)
  const [showNums, setShowNums] = useState(false)

  return (
    <div style={{ display: 'grid', gap: (children && showNums) ? 12 : 0, padding: '12px 14px', borderRadius: 'var(--global-border-radius-large)', border: '1px solid var(--border-gray-subtle)', background: 'var(--background-surface-intense)', boxShadow: 'var(--fds-shadow-xs)' }}>
      <style>{SHIMMER_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: GRADIENT, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <img src={LOGO} width={22} height={22} style={{ borderRadius: 6 }} alt="Bruce" />
        </span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[tone] || DOT.normal, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? <Shimmer />
            : error ? <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Insight unavailable · <button onClick={refresh} style={linkBtn}>retry</button></span>
            : <span className="BodyMediumRegular" style={{ color: 'var(--text-gray-primary)' }}><b style={{ color: 'var(--text-brand-default)', fontWeight: 600 }}>Bruce&nbsp;·&nbsp;</b>{text}</span>}
        </div>
        {detail && !loading && !error && <button onClick={() => askBruce(detail)} className="BodyXSmallSemibold" style={linkBtn}>Ask Bruce →</button>}
        {children && <button onClick={() => setShowNums(s => !s)} className="BodyXSmallRegular" style={{ ...linkBtn, color: 'var(--text-gray-secondary)' }}>{showNums ? 'Hide numbers' : 'Show numbers'}</button>}
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
