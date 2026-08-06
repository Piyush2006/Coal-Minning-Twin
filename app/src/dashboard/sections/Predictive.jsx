// Section 5 · Predictive Maintenance — Assets Needing Attention. An ACTION list
// (no PdM score). Abnormal sensor signals are grouped into a diagnosed fault
// with evidence + recommendation. Click an alert → Detect → Explain → Recommend
// → Act. Filter by severity / fault type (equipment · area · time come from the
// global controls).
import { useMemo, useState } from 'react'
import { LineChart } from '@faclon-labs/design-sdk/LineChart'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Indicator } from '@faclon-labs/design-sdk/Indicator'
import { Drawer, DrawerHeader, DrawerBody } from '@faclon-labs/design-sdk/Drawer'
import { useDash } from '../store'
import { buildPdm } from '../calc/pdm'
import { assetSensorTrend, FLEET_STATE, SEVERITY } from '../data/assets'
import { NUM, STATUS, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel, Dropdown } from '../components/primitives'

const SENS_TEXT = { normal: 'var(--text-positive-default)', warn: 'var(--text-warning-default)', crit: 'var(--text-error-default)' }
const SENS_BADGE = { normal: 'Positive', warn: 'Notice', crit: 'Negative' }
const SEV_COLOR = { Critical: 'critical', Warning: 'warning', Normal: 'positive' }

export function Predictive() {
  const { range, mineId, areaId, equipTypeId, settings } = useDash()
  const pdm = useMemo(() => buildPdm({ range, mineId, areaId, equipTypeId, settings }), [range, mineId, areaId, equipTypeId, settings])
  const [sev, setSev] = useState('all')
  const [ft, setFt] = useState('all')
  const [sel, setSel] = useState(null)

  const alerts = pdm.alerts.filter(a => (sev === 'all' || a.severity === sev) && (ft === 'all' || a.diagnosis?.faultType === ft))
  const sevOpts = [{ id: 'all', name: 'All severities' }, { id: 'Critical', name: 'Critical' }, { id: 'Warning', name: 'Warning' }]
  const ftOpts = [{ id: 'all', name: 'All fault types' }, ...pdm.faultTypes.map(f => ({ id: f, name: f }))]

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      {/* alert counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <CountTile label="Critical" value={pdm.counts.Critical} status="critical" />
        <CountTile label="Warning" value={pdm.counts.Warning} status="warning" />
        <CountTile label="Normal" value={pdm.counts.Normal} status="positive" />
      </div>

      {/* filters + alert list */}
      <Panel>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
          <Dropdown label="Severity" value={sev} options={sevOpts} onChange={setSev} width={170} />
          <Dropdown label="Fault Type" value={ft} options={ftOpts} onChange={setFt} width={190} />
          <span style={{ flex: 1 }} />
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{alerts.length} alert{alerts.length === 1 ? '' : 's'}</span>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {alerts.length === 0 && <div className="BodyMediumRegular" style={{ color: 'var(--text-gray-secondary)', padding: '16px 0' }}>No assets need attention for this selection.</div>}
          {alerts.map(a => {
            const sc = STATUS[SEV_COLOR[a.severity]]
            return (
              <button key={a.id} onClick={() => setSel(a)}
                style={{ display: 'grid', gap: 10, textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit', padding: '14px 16px', borderRadius: 'var(--global-border-radius-large)',
                  border: `1px solid ${a.severity === 'Critical' ? 'var(--border-error-default)' : 'var(--border-warning-default)'}`,
                  background: a.severity === 'Critical' ? 'var(--background-error-secondary)' : 'var(--background-warning-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <b className="BodyMediumSemibold" style={NUM}>{a.id}</b>
                  <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{a.typeName} · {a.area}</span>
                  <Badge color={SEVERITY[a.severity].badge} emphasis="Intense" size="Small">{a.severity}</Badge>
                  <span style={{ flex: 1 }} />
                  <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{fmtStamp(a.detectedAt)}</span>
                </div>
                <span className="BodyMediumSemibold" style={{ color: sc.text }}>{a.diagnosis.fault}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.abnormal.slice(0, 4).map(s => (
                    <span key={s.key} className="BodyXSmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--global-border-radius-max)', background: 'var(--background-surface-intense)', color: SENS_TEXT[s.state], ...NUM }}>
                      {s.label} {s.deltaText}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </Panel>

      {sel && <AlertDrawer a={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

const CountTile = ({ label, value, status }) => {
  const st = STATUS[status]
  return (
    <Panel>
      <div style={{ display: 'grid', gap: 4 }}>
        <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{label}</span>
        <span className="DisplaySmallSemibold" style={{ color: st.text, ...NUM }}>{value}</span>
      </div>
    </Panel>
  )
}

function AlertDrawer({ a, onClose }) {
  const lead = a.abnormal.find(s => s.state === 'crit') || a.abnormal[0]
  const trend = useMemo(() => assetSensorTrend(a, lead, 24), [a, lead])
  const cats = Array.from({ length: 24 }, (_, i) => (i === 23 ? 'now' : `−${23 - i}h`))
  const sc = STATUS[SEV_COLOR[a.severity]]
  const hcOpts = {
    yAxis: {
      plotLines: [
        { value: lead.warn, color: 'var(--background-warning-default)', width: 1.3, dashStyle: 'Dash', label: { text: `Warn ${lead.warn}`, style: { color: 'var(--text-warning-default)', fontSize: '10px' } } },
        { value: lead.crit, color: 'var(--background-error-default)', width: 1.3, dashStyle: 'Dash', label: { text: `Crit ${lead.crit}`, style: { color: 'var(--text-error-default)', fontSize: '10px' } } },
      ],
    },
    tooltip: {
      enabled: true,
      outside: true,
      useHTML: true,
      headerFormat: '<span style="font-size:11px;color:#98A2B3">{point.key} before now</span><br/>',
      pointFormat: `${lead.label}: <b>{point.y} ${lead.unit}</b>`,
    },
  }

  return (
    <Drawer isOpen onDismiss={onClose} accessibilityLabel={`${a.id} alert`}>
      <DrawerHeader title={`${a.id} — ${a.severity}`} subtitle={`${a.typeName} · ${a.area}`} />
      <DrawerBody>
        <div style={{ display: 'grid', gap: 20 }}>
          {/* DETECT */}
          <Stage tag="Detect" color={sc.text}>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Field label="Detected" value={fmtStamp(a.detectedAt)} />
              <Field label="Severity" node={<Badge color={SEVERITY[a.severity].badge} emphasis="Subtle" size="Small">{a.severity}</Badge>} />
              <Field label="Current status" node={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Indicator intent={FLEET_STATE[a.status].intent} size="Medium" />{a.status}</span>} />
            </div>
          </Stage>

          {/* EXPLAIN */}
          <Stage tag="Explain" color={sc.text}>
            <span className="BodyLargeSemibold" style={{ color: sc.text }}>{a.diagnosis.fault}</span>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Fault type · {a.diagnosis.faultType}</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr 0.9fr 1.1fr', gap: 8, alignItems: 'center', marginTop: 4 }}>
              {['Sensor', 'Value', 'Normal', 'Deviation'].map(h => <span key={h} className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{h}</span>)}
              {a.abnormal.map(s => <EvidenceRow key={s.key} s={s} />)}
            </div>
            <div style={{ height: 260, marginTop: 8 }}>
              <LineChart title={`${lead.label} — trend before alert`} categories={cats}
                series={[{ name: `${lead.label} (${lead.unit})`, data: trend, color: SENS_TEXT[lead.state] }]}
                showLegend={false} smooth showMarkers xAxisTitle="Time before now" highchartsOptions={hcOpts} />
            </div>
          </Stage>

          {/* RECOMMEND */}
          <Stage tag="Recommend" color="var(--text-brand-default)">
            <div style={{ padding: '12px 14px', borderRadius: 'var(--global-border-radius-large)', background: 'var(--background-brand-secondary, var(--background-surface-subtle))' }}>
              <span className="BodyMediumSemibold">{a.diagnosis.rec}</span>
            </div>
          </Stage>

          {/* ACT */}
          <Stage tag="Act" color="var(--text-gray-secondary)">
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <Field label="Maintenance" node={<Badge color={a.maintenance === 'Overdue' ? 'Negative' : a.maintenance === 'Due' ? 'Notice' : 'Positive'} emphasis="Subtle" size="Small">{a.maintenance}</Badge>} />
              <Field label="Recent breakdowns" value={String(a.breakdowns)} />
              <Field label="Active fault codes" value={String(a.faultCodes)} />
              <Field label="Downtime (period)" value={`${a.downtimeHours} h`} />
            </div>
          </Stage>
        </div>
      </DrawerBody>
    </Drawer>
  )
}

const EvidenceRow = ({ s }) => (
  <>
    <span className="BodySmallRegular">{s.label}</span>
    <span className="BodySmallSemibold" style={{ color: SENS_TEXT[s.state], ...NUM }}>{s.value} {s.unit}</span>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{s.normalRange}</span>
    <span className="BodyXSmallRegular" style={{ color: SENS_TEXT[s.state] }}>{s.deltaText}</span>
  </>
)
const Stage = ({ tag, color, children }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <span className="BodyXSmallRegular" style={{ color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{tag}</span>
    {children}
  </div>
)
const Field = ({ label, value, node }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodyMediumSemibold" style={NUM}>{node || value}</span>
  </div>
)
