// Vision-Based Belt Anomalies — a compact evidence panel: each detected event
// (belt tear / foreign object / spillage / misalignment) with a camera thumbnail,
// severity, timestamp and camera id; click a row to enlarge the frame + metadata.
// Reuses the shared Modal and the Safety severity helpers.
import { useState } from 'react'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Panel, Modal } from './primitives'
import { SeverityBadge, fmtEvidenceTime } from './EvidenceModal'

const th = (a = 'left') => ({ padding: '8px 12px', textAlign: a, color: 'var(--text-gray-secondary)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 })
const Meta = ({ label, children }) => (
  <div style={{ display: 'grid', gap: 2 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodySmallSemibold">{children}</span>
  </div>
)

export function BeltAnomalies({ anomalies, activeCount }) {
  const [sel, setSel] = useState(null)
  const rows = anomalies.slice(0, 12)

  return (
    <Panel pad={0} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 16px' }}>
        <span className="BodyMediumSemibold">Vision-Based Belt Anomalies</span>
        <Badge color={activeCount ? 'Negative' : 'Positive'} emphasis="Subtle" size="Small">{activeCount} active</Badge>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', marginLeft: 'auto' }}>{anomalies.length} detected in range</span>
      </div>
      <div style={{ maxHeight: 340, overflow: 'auto', borderTop: '1px solid var(--border-gray-subtle)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--background-surface-subtle)' }}>
            <tr><th style={th()}>Frame</th><th style={th()}>Anomaly</th><th style={th()}>Severity</th><th style={th('right')}>Detected</th></tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} onClick={() => setSel(a)} style={{ borderTop: '1px solid var(--border-gray-subtle)', cursor: 'pointer' }}>
                <td style={{ padding: '8px 12px' }}>
                  <img src={a.image} alt="belt frame" style={{ width: 76, height: 46, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-gray-subtle)', display: 'block' }} />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'grid', gap: 3 }}>
                    <span className="BodySmallSemibold" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{a.type}{a.active && <Badge color="Negative" emphasis="Subtle" size="Small">Active</Badge>}</span>
                    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{a.location} · {a.camera}</span>
                  </div>
                </td>
                <td style={{ padding: '8px 12px' }}><SeverityBadge level={a.severity} /></td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}><span className="BodySmallRegular" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEvidenceTime(a.ts)}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} style={{ padding: '26px 0', textAlign: 'center', color: 'var(--text-gray-tertiary)' }} className="BodySmallRegular">No belt anomalies detected in this range.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!sel} onClose={() => setSel(null)} maxWidth={780}
        title={sel ? sel.type : ''} subtitle={sel ? `${sel.location} · ${sel.camera}` : ''}>
        {sel && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1.1fr) 1fr', gap: 20 }}>
            <img src={sel.image} alt="belt camera frame" style={{ width: '100%', height: 240, objectFit: 'cover', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-subtle)' }} />
            <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <SeverityBadge level={sel.severity} />
                {sel.active && <Badge color="Negative" emphasis="Subtle" size="Small">Active</Badge>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Meta label="Detected">{fmtEvidenceTime(sel.ts)}</Meta>
                <Meta label="Location">{sel.location}</Meta>
                <Meta label="Camera">{sel.camera}</Meta>
                <Meta label="Detection confidence">{sel.confidence}%</Meta>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </Panel>
  )
}
