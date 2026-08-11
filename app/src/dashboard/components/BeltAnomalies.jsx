// Vision-Based Belt Anomalies — a MODAL drill-down (opened from the Conveyor
// card's "Active Anomalies" mini-KPI). Top: the selected camera frame with its
// metadata. Below: the full evidence table in the dashboard's table language
// (uppercase hairline headers, hover rows, severity pills). Click a row to
// preview its frame.
import { useEffect, useState } from 'react'
import { Modal } from './primitives'
import { Pill, th, td } from './ui'
import { SeverityBadge, fmtEvidenceTime } from './EvidenceModal'

const Meta = ({ label, children }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <span className="eyebrow">{label}</span>
    <span className="BodySmallSemibold">{children}</span>
  </div>
)

export function BeltAnomaliesModal({ isOpen, onClose, anomalies, activeCount }) {
  const [sel, setSel] = useState(null)
  // preview the first (latest) anomaly whenever the modal opens
  useEffect(() => { if (isOpen) setSel(anomalies[0] || null) }, [isOpen, anomalies])

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth={920}
      title="Vision-Based Belt Anomalies"
      subtitle={`${anomalies.length} detected in range · ${activeCount} active`}>

      {/* selected frame preview */}
      {sel && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) 1fr', gap: 20, marginBottom: 18, padding: 16, borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
          <img src={sel.image} alt="belt camera frame" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-subtle)' }} />
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="BodyLargeSemibold">{sel.type}</span>
              <SeverityBadge level={sel.severity} />
              {sel.active && <Pill tone="critical">Active</Pill>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Meta label="Detected">{fmtEvidenceTime(sel.ts)}</Meta>
              <Meta label="Location">{sel.location}</Meta>
              <Meta label="Camera">{sel.camera}</Meta>
              <Meta label="Confidence">{sel.confidence}%</Meta>
            </div>
          </div>
        </div>
      )}

      {/* full-length evidence table */}
      <div style={{ borderRadius: 'var(--global-border-radius-medium)', border: '1px solid var(--border-gray-subtle)', overflow: 'hidden' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr><th style={th()}>Frame</th><th style={th()}>Anomaly</th><th style={th()}>Severity</th><th style={th('right')}>Detected</th></tr>
          </thead>
          <tbody>
            {anomalies.map(a => {
              const on = sel?.id === a.id
              return (
                <tr key={a.id} onClick={() => setSel(a)}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
                  style={{ cursor: 'pointer', background: on ? 'var(--background-surface-subtle)' : 'transparent', transition: 'background 120ms' }}>
                  <td style={td()}>
                    <img src={a.image} alt="belt frame" style={{ width: 76, height: 46, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-gray-subtle)', display: 'block' }} />
                  </td>
                  <td style={td()}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span className="BodySmallSemibold" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{a.type}{a.active && <Pill tone="critical">Active</Pill>}</span>
                      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{a.location} · {a.camera}</span>
                    </div>
                  </td>
                  <td style={td()}><SeverityBadge level={a.severity} /></td>
                  <td style={{ ...td('right'), fontVariantNumeric: 'tabular-nums' }} className="BodySmallRegular">{fmtEvidenceTime(a.ts)}</td>
                </tr>
              )
            })}
            {!anomalies.length && <tr><td colSpan={4} style={{ ...td(), textAlign: 'center', color: 'var(--text-gray-tertiary)', padding: '26px 0' }}>No belt anomalies detected in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
