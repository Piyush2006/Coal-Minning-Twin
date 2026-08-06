// Not-yet-built section — keeps the narrative structure and the jump-nav intact
// while the dashboard is delivered in phases.
import { SectionHeading } from '../components/primitives'

export function Placeholder({ n, title, question }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SectionHeading n={n} title={title} question={question} />
      <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--background-surface-intense)', borderRadius: 'var(--global-border-radius-large)', boxShadow: 'var(--fds-shadow-xs)', border: '1px dashed var(--border-gray-default)' }}>
        <div className="BodyMediumRegular" style={{ color: 'var(--text-gray-secondary)' }}>Coming in the next build phase.</div>
      </div>
    </div>
  )
}
