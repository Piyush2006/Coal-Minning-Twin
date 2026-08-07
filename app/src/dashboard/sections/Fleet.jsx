// Section 4 · Fleet — current status of the mobile mining fleet, a per-vehicle
// table, and a click-through vehicle drill-down (status timeline, explainable
// health by sensor, faults / maintenance / downtime history, fuel-efficiency).
import { useMemo, useState } from 'react'
import { Drawer, DrawerHeader, DrawerBody } from '@faclon-labs/design-sdk/Drawer'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Indicator } from '@faclon-labs/design-sdk/Indicator'
import { useDash } from '../store'
import { buildProduction } from '../calc/production'
import { buildFleet } from '../calc/fleet'
import { assetTimeline, assetSensorTrend, FLEET_STATE, SEVERITY } from '../data/assets'
import { NUM, STATUS, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel, SegmentBar } from '../components/primitives'
import { StatusTimeline } from '../components/StatusTimeline'
import { Sparkline } from '../components/Sparkline'

const SENS_TEXT = { normal: 'var(--text-positive-default)', warn: 'var(--text-warning-default)', crit: 'var(--text-error-default)' }
const SENS_BADGE = { normal: 'Positive', warn: 'Notice', crit: 'Negative' }
const SENS_LABEL = { normal: 'Normal', warn: 'Warning', crit: 'Critical' }
const STATUS_KEYS = ['Running', 'Idle — On Job', 'Idle — Off Job', 'Breakdown']

export function Fleet() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const kp = useMemo(() => buildProduction({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }), [range, mineId, areaId, equipTypeId, shiftMode, settings, plan])
  const fleet = useMemo(() => buildFleet({ range, mineId, areaId, equipTypeId, settings, overallUtil: kp.utilization.pct }), [range, mineId, areaId, equipTypeId, settings, kp.utilization.pct])
  const [sel, setSel] = useState(null)

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      {/* live status band */}
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 0.7fr) 2fr', gap: 28, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Total Vehicles</span>
            <span className="DisplayMediumSemibold" style={NUM}>{fleet.counts.total}</span>
            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Avg fleet health <b style={{ color: STATUS[fleet.avgHealth >= 85 ? 'positive' : fleet.avgHealth >= 70 ? 'warning' : 'critical'].text }}>{fleet.avgHealth}</b></span>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <SegmentBar height={14} segments={STATUS_KEYS.map(k => ({ label: k, value: fleet.counts[k], color: FLEET_STATE[k].color }))} />
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {STATUS_KEYS.map(k => (
                <span key={k} className="BodySmallRegular" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-gray-secondary)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: FLEET_STATE[k].color }} />{k} <b style={{ color: 'var(--text-gray-primary)', ...NUM }}>{fleet.counts[k]}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* fleet table */}
      <Panel pad={0}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.1fr 0.8fr 1fr 1fr', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--border-gray-subtle)' }}>
          {['Vehicle', 'Status', 'Health', 'Utilisation', 'Fuel/Ton', 'Current Alert'].map(h => (
            <span key={h} className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>
        {fleet.rows.map((v, i) => {
          const hSt = STATUS[v.healthStatus]
          return (
            <button key={v.id} onClick={() => setSel(v)}
              style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.1fr 0.8fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '11px 18px', width: '100%', textAlign: 'left', border: 'none', borderTop: i ? '1px solid var(--border-gray-subtle)' : 'none', background: 'transparent', cursor: 'pointer', font: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <span><b className="BodySmallSemibold" style={NUM}>{v.id}</b><div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{v.typeName}</div></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }} className="BodySmallRegular">
                <Indicator intent={FLEET_STATE[v.status].intent} size="Medium" />{v.status}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, height: 6, background: 'var(--background-surface-subtle)', borderRadius: 4, overflow: 'hidden', minWidth: 40 }}>
                  <span style={{ display: 'block', height: '100%', width: `${v.health}%`, background: hSt.fill }} />
                </span>
                <b className="BodySmallSemibold" style={{ color: hSt.text, width: 22, ...NUM }}>{v.health}</b>
              </span>
              <span className="BodySmallRegular" style={NUM}>{v.util}%</span>
              <span className="BodySmallRegular" style={NUM}>{v.fuelPerTon != null ? `${fmt(v.fuelPerTon, 2)} L/T` : '—'}</span>
              <span><Badge color={SEVERITY[v.severity].badge} emphasis="Subtle" size="Small">{v.severity}</Badge></span>
            </button>
          )
        })}
      </Panel>

      {sel && <VehicleDrawer v={sel} range={range} onClose={() => setSel(null)} />}
    </div>
  )
}

function VehicleDrawer({ v, range, onClose }) {
  const timeline = useMemo(() => assetTimeline(v, range, v.status), [v, range])
  const hSt = STATUS[v.healthStatus]

  return (
    <Drawer isOpen onDismiss={onClose} accessibilityLabel={`${v.id} details`}>
      <DrawerHeader title={v.id} subtitle={`${v.typeName} · ${v.area}`} />
      <DrawerBody>
        <div style={{ display: 'grid', gap: 20 }}>
          {/* header metrics */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Metric label="Status" node={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Indicator intent={FLEET_STATE[v.status].intent} size="Medium" />{v.status}</span>} />
            <Metric label="Health" node={<b style={{ color: hSt.text, ...NUM }}>{v.health}</b>} />
            <Metric label="Utilisation" node={<b style={NUM}>{v.util}%</b>} />
            <Metric label="Fuel/Ton" node={<b style={NUM}>{v.fuelPerTon != null ? `${fmt(v.fuelPerTon, 2)} L/T` : '—'}</b>} />
          </div>

          {/* status timeline */}
          <Block title="Status Timeline" right={<span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{fmtStamp(range.start)} → {fmtStamp(range.end)}</span>}>
            <StatusTimeline segments={timeline} />
          </Block>

          {/* explainable health */}
          <Block title="Vehicle Health" right={<Badge color={SENS_BADGE[v.healthBand === 'good' ? 'normal' : v.healthBand === 'watch' ? 'warn' : 'crit']} emphasis="Subtle" size="Small">Score {v.health}</Badge>}>
            {v.contributors.length > 0 && (
              <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-secondary)', marginBottom: 10 }}>
                Lowered by: {v.contributors.slice(0, 3).map(c => `${c.label} (−${c.impact})`).join(' · ')}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 0.8fr 0.8fr 130px', gap: 8, alignItems: 'center' }}>
              {['Sensor', 'Value', 'Normal', 'State', 'Trend'].map(h => <span key={h} className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{h}</span>)}
              {v.sensors.map(s => (
                <SensorRow key={s.key} s={s} v={v} />
              ))}
            </div>
          </Block>
        </div>
      </DrawerBody>
    </Drawer>
  )
}

const Metric = ({ label, node }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodyMediumSemibold">{node}</span>
  </div>
)
const Block = ({ title, right, children }) => (
  <div style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="BodyMediumSemibold">{title}</span><span style={{ flex: 1 }} />{right}
    </div>
    {children}
  </div>
)
const SensorRow = ({ s, v }) => {
  const trend = useMemo(() => assetSensorTrend(v, s, 20), [v, s])
  return (
    <>
      <span className="BodySmallRegular">{s.label}</span>
      <span className="BodySmallRegular" style={{ color: SENS_TEXT[s.state], ...NUM }}>{s.value} {s.unit}</span>
      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{s.normalRange}</span>
      <span><Badge color={SENS_BADGE[s.state]} emphasis="Subtle" size="Small">{SENS_LABEL[s.state]}</Badge></span>
      <Sparkline data={trend} width={130} height={28} color={SENS_TEXT[s.state]} />
    </>
  )
}
