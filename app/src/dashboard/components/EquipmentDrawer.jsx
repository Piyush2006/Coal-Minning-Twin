// Per-equipment drill-down (right-side drawer) for the Equipment & Resources tab.
// Reuses the shared asset-condition (sensors, explainable health, PDM fault +
// recommendation), the status timeline, and per-unit utilisation — plus this
// tab's jobs (current + upcoming, next-available) and planned downtime.
import { useMemo } from 'react'
import { Drawer, DrawerHeader, DrawerBody } from '@faclon-labs/design-sdk/Drawer'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Indicator } from '@faclon-labs/design-sdk/Indicator'
import { eachDay } from '../data/rng'
import { assetCondition, assetTimeline, assetSensorTrend, FLEET_STATE } from '../data/assets'
import { unitStats } from '../data/equipment'
import { typeLabel, EQUIP_STATE } from '../data/resources'
import { currentJobFor, upcomingFor } from '../data/resourceJobs'
import { downtimesForUnit, downtimeWindow } from '../data/plannedDowntime'
import { STATUS, NUM, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { StatusTimeline } from './StatusTimeline'
import { Sparkline } from './Sparkline'

const SENS_TEXT = { normal: 'var(--text-positive-default)', warn: 'var(--text-warning-default)', crit: 'var(--text-error-default)' }
const SENS_BADGE = { normal: 'Positive', warn: 'Notice', crit: 'Negative' }
const SENS_LABEL = { normal: 'Normal', warn: 'Warning', crit: 'Critical' }
const BASELINE_UTIL = 82

export function EquipmentDrawer({ unit, status, range, settings, assignments, now, onClose }) {
  const cond = useMemo(() => assetCondition(unit, settings), [unit, settings])
  const stats = useMemo(() => unitStats(unit, BASELINE_UTIL, eachDay(range).length, settings), [unit, range, settings])
  const timeline = useMemo(() => assetTimeline(unit, range, cond.status), [unit, range, cond.status])

  const current = currentJobFor(unit.id, assignments, now)
  const upcoming = upcomingFor(unit.id, assignments, now)
  const downtimes = downtimesForUnit(unit.id)
  const hSt = STATUS[cond.healthStatus]
  const eSt = EQUIP_STATE[status] || EQUIP_STATE.Idle

  // next available: maintenance end → current job end → now
  let nextAvail = 'Now'
  if (status === 'Under Maintenance') {
    const active = downtimes.map(d => downtimeWindow(d, now)).find(w => w && w.start <= now && now < w.end)
    if (active) nextAvail = fmtStamp(active.end)
  } else if (current) nextAvail = fmtStamp(current.end)

  const fuel = cond.fuelPerTon != null ? `${fmt(cond.fuelPerTon, 2)} L/T` : 'Electric'
  const opHours = stats.runningMin / 60, downH = stats.downtimeMin / 60

  return (
    <Drawer isOpen onDismiss={onClose} accessibilityLabel={`${unit.id} details`}>
      <DrawerHeader title={unit.id} subtitle={`${typeLabel(unit.type)} · ${unit.area}`} />
      <DrawerBody>
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <Metric label="Status" node={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Indicator intent={eSt.intent} size="Medium" />{status}</span>} />
            <Metric label="Current job / activity" node={current ? current.title : (status === 'Under Maintenance' ? 'Maintenance' : 'Idle · available')} />
            <Metric label="Next available" node={nextAvail} />
            <Metric label="Utilisation" node={<b style={NUM}>{Math.round(stats.util)}%</b>} />
            <Metric label="Operating hours" node={<b style={NUM}>{fmt(opHours, 1)} h</b>} />
            <Metric label="Downtime" node={<b style={NUM}>{fmt(downH, 1)} h</b>} />
            <Metric label="Fuel consumption" node={<b style={NUM}>{fuel}</b>} />
            <Metric label="Health score" node={<b style={{ color: hSt.text, ...NUM }}>{cond.health}</b>} />
          </div>

          {/* sensors / predictive maintenance */}
          <Block title="Sensors & Predictive Maintenance"
            right={<Badge color={cond.severity === 'Critical' ? 'Negative' : cond.severity === 'Warning' ? 'Notice' : 'Positive'} emphasis="Subtle" size="Small">{cond.severity}</Badge>}>
            {cond.diagnosis && cond.severity !== 'Normal' && (
              <div style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 'var(--global-border-radius-large)', background: cond.severity === 'Critical' ? 'var(--background-error-secondary, #fdecec)' : 'var(--background-warning-secondary, #fff6e6)', marginBottom: 4 }}>
                <span className="BodySmallSemibold" style={{ color: cond.severity === 'Critical' ? 'var(--text-error-default)' : 'var(--text-warning-default)' }}>{cond.diagnosis.fault} · {cond.diagnosis.faultType}</span>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Recommendation: {cond.diagnosis.rec}</span>
              </div>
            )}
            {cond.contributors.length > 0 && (
              <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Health lowered by: {cond.contributors.slice(0, 3).map(c => `${c.label} (−${c.impact})`).join(' · ')}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 0.8fr 0.8fr 120px', gap: 8, alignItems: 'center' }}>
              {['Sensor', 'Value', 'Normal', 'State', 'Trend'].map(h => <span key={h} className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{h}</span>)}
              {cond.sensors.filter(s => s.isPdm).map(s => <SensorRow key={s.key} s={s} unit={unit} />)}
            </div>
          </Block>

          {/* status/activity timeline */}
          <Block title="Equipment Timeline" right={<span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{fmtStamp(range.start)} → {fmtStamp(range.end)}</span>}>
            <StatusTimeline segments={timeline} />
          </Block>

          {/* upcoming schedule */}
          <Block title="Upcoming Schedule" right={<span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Next available: {nextAvail}</span>}>
            {upcoming.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {upcoming.map(j => (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
                    <Badge color={j.priority === 'P1' ? 'Negative' : j.priority === 'P2' ? 'Notice' : 'Neutral'} emphasis="Subtle" size="Small">{j.priority}</Badge>
                    <span className="BodySmallSemibold" style={{ flex: 1 }}>{j.title}</span>
                    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{fmtStamp(j.start)} · {j.durH}h</span>
                  </div>
                ))}
              </div>
            ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>No upcoming jobs scheduled.</span>}
          </Block>

          {/* planned downtime */}
          <Block title="Planned Downtime">
            {downtimes.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {downtimes.map((d, i) => {
                  const w = downtimeWindow(d, now)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
                      <Badge color={d.kind === 'Recurring' ? 'Information' : 'Neutral'} emphasis="Subtle" size="Small">{d.kind}</Badge>
                      <span className="BodySmallSemibold" style={{ flex: 1 }}>{d.reason}</span>
                      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{w ? `${fmtStamp(w.start)} → ${fmtStamp(w.end)}` : `${d.cadence} · ${d.window}`}</span>
                    </div>
                  )
                })}
              </div>
            ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>No planned downtime scheduled.</span>}
          </Block>
        </div>
      </DrawerBody>
    </Drawer>
  )
}

const Metric = ({ label, node }) => (
  <div style={{ display: 'grid', gap: 3, minWidth: 90 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodyMediumSemibold">{node}</span>
  </div>
)
const Block = ({ title, right, children }) => (
  <div style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="BodyMediumSemibold">{title}</span><span style={{ flex: 1 }} />{right}</div>
    {children}
  </div>
)
const SensorRow = ({ s, unit }) => {
  const trend = useMemo(() => assetSensorTrend(unit, s, 20), [unit, s])
  return (
    <>
      <span className="BodySmallRegular">{s.label}</span>
      <span className="BodySmallRegular" style={{ color: SENS_TEXT[s.state], ...NUM }}>{s.value} {s.unit}</span>
      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{s.normalRange}</span>
      <span><Badge color={SENS_BADGE[s.state]} emphasis="Subtle" size="Small">{SENS_LABEL[s.state]}</Badge></span>
      <Sparkline data={trend} width={120} height={26} color={SENS_TEXT[s.state]} />
    </>
  )
}
