// Section 5 · Predictive Maintenance — Assets Needing Attention. An ACTION list
// (no PdM score). Abnormal sensor signals are grouped into a diagnosed fault
// with evidence + recommendation. Click an alert → Detect → Explain → Recommend
// → Act. Count tiles + severity/fault-type dropdowns filter the list (they share
// one `sev` state, so a tile click and the dropdown stay in sync).
import { useState } from 'react'
import { Drawer, DrawerHeader, DrawerBody } from '@faclon-labs/design-sdk/Drawer'
import { useMemo } from 'react'
import { useDash } from '../store'
import { buildPdm } from '../calc/pdm'
import { FLEET_STATE } from '../data/assets'
import { NUM, STATUS } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel, Dropdown } from '../components/primitives'
import { CARD, Pill, usePagination, Pager, th, td } from '../components/ui'
import { SensorChartModal } from '../components/SensorChartModal'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

const SENS_TEXT = { normal: 'var(--text-positive-default)', warn: 'var(--text-warning-default)', crit: 'var(--text-error-default)' }
const SEV_COLOR = { Critical: 'critical', Warning: 'warning', Normal: 'positive' }
const SEV_RAIL = { critical: 'var(--background-error-default)', warning: 'var(--background-warning-default)', positive: 'var(--background-positive-default)' }

export function Predictive() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const pdm = useMemo(() => buildPdm({ range, mineId, areaId, equipTypeId, settings }), [range, mineId, areaId, equipTypeId, settings])
  const ctx = useMemo(() => buildBruceContext({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }), [range, mineId, areaId, equipTypeId, shiftMode, settings, plan])
  const [sev, setSev] = useState('all')
  const [ft, setFt] = useState('all')
  const [sel, setSel] = useState(null)

  const alerts = pdm.alerts.filter(a => (sev === 'all' || a.severity === sev) && (ft === 'all' || a.diagnosis?.faultType === ft))
  const sevOpts = [{ id: 'all', name: 'All severities' }, { id: 'Critical', name: 'Critical' }, { id: 'Warning', name: 'Warning' }]
  const ftOpts = [{ id: 'all', name: 'All fault types' }, ...pdm.faultTypes.map(f => ({ id: f, name: f }))]
  const total = pdm.assets.length
  const pg = usePagination(alerts, { resetKey: `${sev}|${ft}` })
  // a tile toggles its severity filter (click the active one to clear)
  const tileClick = (s) => setSev(cur => (cur === s ? 'all' : s))

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      <BruceInsight
        variant="rail"
        context={ctx}
        tone={pdm.counts.Critical > 0 ? 'critical' : pdm.counts.Warning > 0 ? 'warning' : 'positive'}
        task="In 15-20 words, name the single highest-risk asset, its fault and health, and what to do first."
        detail="Explain which assets are at highest risk, their diagnosed faults and health, and the maintenance priorities." />

      {/* alert counts — Critical/Warning filter the list; Normal is a plain count */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, alignItems: 'stretch' }}>
        <CountTile label="Critical" value={pdm.counts.Critical} status="critical" total={total} onClick={() => tileClick('Critical')} active={sev === 'Critical'} />
        <CountTile label="Warning" value={pdm.counts.Warning} status="warning" total={total} onClick={() => tileClick('Warning')} active={sev === 'Warning'} />
        <CountTile label="Normal" value={pdm.counts.Normal} status="positive" total={total} />
      </div>

      {/* alert list */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span className="BodyLargeSemibold">Assets needing attention</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{alerts.length} alert{alerts.length === 1 ? '' : 's'}</span>
          <span style={{ flex: 1 }} />
          <Dropdown value={sev} options={sevOpts} onChange={setSev} width={160} />
          <Dropdown value={ft} options={ftOpts} onChange={setFt} width={180} />
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {alerts.length === 0 && <div className="BodyMediumRegular" style={{ color: 'var(--text-gray-secondary)', padding: '16px 0' }}>No assets need attention for this selection.</div>}
          {pg.pageItems.map(a => {
            const sc = STATUS[SEV_COLOR[a.severity]]
            return (
              <button key={a.id} onClick={() => setSel(a)} title={`Open ${a.id} detail`}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--fds-shadow-xs)' }}
                style={{ ...CARD, borderLeft: `3px solid ${SEV_RAIL[SEV_COLOR[a.severity]]}`, display: 'grid', gap: 10, textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit', padding: '14px 16px', transition: 'transform 150ms, box-shadow 150ms' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <b className="BodyMediumSemibold" style={NUM}>{a.id}</b>
                  <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{a.typeName} · {a.area}</span>
                  <Pill tone={SEV_COLOR[a.severity]}>{a.severity}</Pill>
                  <span style={{ flex: 1 }} />
                  <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{fmtStamp(a.detectedAt)}</span>
                  <span aria-hidden style={{ color: 'var(--text-gray-tertiary)', fontSize: 12 }}>›</span>
                </div>
                <span className="BodyMediumSemibold" style={{ color: sc.text }}>{a.diagnosis.fault}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.abnormal.slice(0, 4).map(s => (
                    <span key={s.key} className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'var(--background-surface-subtle)', color: SENS_TEXT[s.state], ...NUM }}>
                      {s.label} {s.deltaText}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
        <Pager {...pg} style={{ marginTop: 12 }} />
      </Panel>

      {sel && <AlertDrawer a={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

const CountTile = ({ label, value, status, total, onClick, active }) => {
  const st = STATUS[status]
  const clickable = typeof onClick === 'function'
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      onMouseEnter={clickable ? (e) => { if (!active) { e.currentTarget.style.boxShadow = 'var(--fds-shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' } } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.boxShadow = 'var(--fds-shadow-sm)'; e.currentTarget.style.transform = 'none' } : undefined}
      title={clickable ? (active ? 'Show all alerts' : `Show only ${label} alerts`) : undefined}
      style={{ ...CARD, padding: 18, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: `3px solid ${SEV_RAIL[status]}`, cursor: clickable ? 'pointer' : 'default', background: active ? 'var(--background-surface-subtle)' : 'var(--background-surface-intense)', transition: 'box-shadow 150ms, transform 150ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{label}</span>
        {clickable && <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--text-brand-default)', fontSize: 14, lineHeight: 1 }}>→</span>}
      </div>
      <span className="HeadingLargeSemibold" style={{ color: st.text, ...NUM, fontSize: 27, lineHeight: 1 }}>{value}</span>
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-gray-subtle)' }}>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>of {total} assets</span>
      </div>
    </div>
  )
}

// exported: the 3D twin reuses this drawer for its PdM badges (see PdmDrawerHost)
export function AlertDrawer({ a, onClose }) {
  const [sensorsOpen, setSensorsOpen] = useState(false)
  const sc = STATUS[SEV_COLOR[a.severity]]
  const eSt = FLEET_STATE[a.status]
  const pdmSensors = a.sensors.filter(s => s.isPdm)
  const maintTone = a.maintenance === 'Overdue' ? 'critical' : a.maintenance === 'Due' ? 'warning' : 'positive'

  return (
    <Drawer isOpen onDismiss={onClose} accessibilityLabel={`${a.id} alert`}>
      <DrawerHeader title={`${a.id} — ${a.severity}`} subtitle={`${a.typeName} · ${a.area}`} />
      <DrawerBody>
        {/* the Drawer portals outside the themed root — re-apply the theme here */}
        <div className="dash-theme" style={{ display: 'grid', gap: 20 }}>
          {/* DETECT */}
          <Stage tag="Detect" color={sc.text}>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Field label="Detected" value={fmtStamp(a.detectedAt)} />
              <Field label="Severity" node={<Pill tone={SEV_COLOR[a.severity]}>{a.severity}</Pill>} />
              <Field label="Current status" node={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 999, background: 'var(--background-surface-subtle)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: eSt.color }} />
                  <span className="BodySmallSemibold">{a.status}</span>
                </span>} />
            </div>
          </Stage>

          {/* EXPLAIN — the evidence IS the diagnosis; kept inline, raw trends behind the button */}
          <Stage tag="Explain" color={sc.text}>
            <span className="BodyLargeSemibold" style={{ color: sc.text }}>{a.diagnosis.fault}</span>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Fault type · {a.diagnosis.faultType}</span>
            <div style={{ border: '1px solid var(--border-gray-subtle)', borderRadius: 'var(--global-border-radius-medium)', overflow: 'hidden', marginTop: 2 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr><th style={th()}>Sensor</th><th style={th('right')}>Value</th><th style={th('right')}>Normal</th><th style={th('right')}>Deviation</th></tr></thead>
                <tbody>
                  {a.abnormal.map(s => (
                    <tr key={s.key}>
                      <td style={td()} className="BodySmallRegular">{s.label}</td>
                      <td style={{ ...td('right'), ...NUM, color: SENS_TEXT[s.state] }} className="BodySmallSemibold">{s.value} {s.unit}</td>
                      <td style={{ ...td('right'), ...NUM, color: 'var(--text-gray-tertiary)' }} className="BodyXSmallRegular">{s.normalRange}</td>
                      <td style={{ ...td('right'), color: SENS_TEXT[s.state] }} className="BodyXSmallRegular">{s.deltaText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setSensorsOpen(true)} className="BodySmallSemibold"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, marginTop: 2, transition: 'background 150ms' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" /></svg>
              Sensor data
            </button>
          </Stage>

          {/* RECOMMEND — well + info rail (tints + rails, not full-tint) */}
          <Stage tag="Recommend" color="var(--text-brand-default)">
            <div style={{ padding: '12px 14px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', borderLeft: '3px solid var(--background-info-default)' }}>
              <span className="BodyMediumSemibold">{a.diagnosis.rec}</span>
            </div>
          </Stage>

          {/* ACT */}
          <Stage tag="Act" color="var(--text-gray-secondary)">
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Field label="Maintenance" node={<Pill tone={maintTone}>{a.maintenance}</Pill>} />
              <Field label="Recent breakdowns" value={String(a.breakdowns)} />
              <Field label="Active fault codes" value={String(a.faultCodes)} />
              <Field label="Downtime (period)" value={`${a.downtimeHours} h`} />
            </div>
          </Stage>
        </div>
      </DrawerBody>

      <SensorChartModal isOpen={sensorsOpen} onClose={() => setSensorsOpen(false)} unit={a} sensors={pdmSensors} />
    </Drawer>
  )
}

const Stage = ({ tag, color, children }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <span className="eyebrow" style={{ color }}>{tag}</span>
    {children}
  </div>
)
const Field = ({ label, value, node }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodyMediumSemibold" style={NUM}>{node || value}</span>
  </div>
)
