// Per-equipment drill-down — right-side panel in the dashboard's own language:
// status + health BANDS in the header area (no numeric score), an at-a-glance
// well grid, a Condition section whose raw sensor readings live behind a
// "Sensor data" button (one multi-line chart, interactive legend), the slim
// status timeline with hover tooltips, then schedule + planned downtime.
import { useMemo, useState } from 'react'
import { Drawer, DrawerHeader, DrawerBody } from '@faclon-labs/design-sdk/Drawer'
import { useDash } from '../store'
import { eachDay } from '../data/rng'
import { assetCondition, assetTimeline } from '../data/assets'
import { unitStats } from '../data/equipment'
import { typeLabel, EQUIP_STATE } from '../data/resources'
import { currentJobFor, upcomingFor } from '../data/resourceJobs'
import { downtimesForUnit, downtimeWindow } from '../data/plannedDowntime'
import { NUM, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { StatusTimeline } from './StatusTimeline'
import { SensorChartModal } from './SensorChartModal'
import { Pill, Eyebrow } from './ui'
import { useMarkDrawer } from '../lib/drawerPresence'

const BASELINE_UTIL = 82
const HEALTH_LABEL = { positive: 'Normal', warning: 'Warning', critical: 'Critical' }
const HEALTH_TONE = { positive: 'positive', warning: 'warning', critical: 'critical' }
const PRIO_TONE = { P1: 'critical', P2: 'warning', P3: 'neutral' }

export function EquipmentDrawer({ unit, status, range, settings, assignments, now, onClose }) {
  useMarkDrawer()
  const cond = useMemo(() => assetCondition(unit, settings), [unit, settings])
  const stats = useMemo(() => unitStats(unit, BASELINE_UTIL, eachDay(range).length, settings), [unit, range, settings])
  const timeline = useMemo(() => assetTimeline(unit, range, cond.status), [unit, range, cond.status])
  const [sensorsOpen, setSensorsOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)   // collapsed by default
  const jobOverrides = useDash(s => s.jobOverrides)
  const downtimeOverrides = useDash(s => s.downtimeOverrides)

  const current = currentJobFor(unit.id, assignments, now, jobOverrides)
  const upcoming = upcomingFor(unit.id, assignments, now, jobOverrides)
  const downtimes = downtimesForUnit(unit.id, downtimeOverrides)
  const eSt = EQUIP_STATE[status] || EQUIP_STATE.Idle
  const healthKey = cond.healthStatus === 'critical' ? 'critical' : cond.healthStatus === 'warning' ? 'warning' : 'positive'

  // next available: maintenance end → current job end → now
  let nextAvail = 'Now'
  if (status === 'Under Maintenance') {
    const active = downtimes.map(d => downtimeWindow(d, now)).find(w => w && w.start <= now && now < w.end)
    if (active) nextAvail = fmtStamp(active.end)
  } else if (current) nextAvail = fmtStamp(current.end)

  const fuel = cond.fuelPerTon != null ? `${fmt(cond.fuelPerTon, 2)} L/T` : 'Electric'
  const opHours = stats.runningMin / 60, downH = stats.downtimeMin / 60
  const pdmSensors = cond.sensors.filter(s => s.isPdm)

  return (
    <Drawer isOpen onDismiss={onClose} accessibilityLabel={`${unit.id} details`}>
      <DrawerHeader title={unit.id} subtitle={`${typeLabel(unit.type)} · ${unit.area}`} />
      <DrawerBody>
        {/* the Drawer portals outside the themed root — re-apply the theme here */}
        <div className="dash-theme" style={{ display: 'grid', gap: 22 }}>

          {/* state bands — status + qualitative health, no numbers */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="BodySmallSemibold" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 999, background: 'var(--background-surface-subtle)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: eSt.color }} />{status}
            </span>
            <Pill tone={HEALTH_TONE[healthKey]}>Health · {HEALTH_LABEL[healthKey]}</Pill>
          </div>

          {/* at a glance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Well label="Current job / activity" value={current ? current.title : (status === 'Under Maintenance' ? 'Maintenance' : 'Idle · available')} />
            <Well label="Next available" value={nextAvail} num />
            <Well label="Utilisation" value={`${Math.round(stats.util)}%`} num />
            <Well label="Operating hours" value={`${fmt(opHours, 1)} h`} num />
            <Well label="Downtime" value={`${fmt(downH, 1)} h`} num />
            <Well label="Fuel consumption" value={fuel} num />
          </div>

          {/* condition — diagnosis + recommendation; raw readings behind a button.
              No status chip here: the header's "Health · …" pill already carries it. */}
          <Section label="Condition">
            {cond.diagnosis && cond.severity !== 'Normal' && (
              <div style={{ display: 'grid', gap: 4, padding: '11px 14px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', borderLeft: `3px solid ${cond.severity === 'Critical' ? 'var(--background-error-default)' : 'var(--background-warning-default)'}` }}>
                <span className="BodySmallSemibold" style={{ color: cond.severity === 'Critical' ? 'var(--text-error-default)' : 'var(--text-warning-default)' }}>{cond.diagnosis.fault} · {cond.diagnosis.faultType}</span>
                <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Recommendation: {cond.diagnosis.rec}</span>
              </div>
            )}
            {cond.contributors.length > 0 && (
              <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>
                Health lowered by {cond.contributors.slice(0, 3).map(c => c.label.toLowerCase()).join(' · ')}
              </span>
            )}
            <button onClick={() => setSensorsOpen(true)} className="BodySmallSemibold"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" /></svg>
              Sensor data
            </button>
          </Section>

          {/* timeline — collapsible, closed by default */}
          <Section label="Timeline" collapsible open={timelineOpen} onToggle={() => setTimelineOpen(o => !o)}
            right={timelineOpen ? <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{fmtStamp(range.start)} → {fmtStamp(range.end)}</span> : undefined}>
            <StatusTimeline segments={timeline} />
          </Section>

          {/* upcoming schedule */}
          <Section label="Upcoming schedule" right={<span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Next available: {nextAvail}</span>}>
            {upcoming.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {upcoming.map(j => (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
                    <Pill tone={PRIO_TONE[j.priority]}>{j.priority}</Pill>
                    <span className="BodySmallSemibold" style={{ flex: 1 }}>{j.title}</span>
                    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{fmtStamp(j.start)} · {j.durH}h</span>
                  </div>
                ))}
              </div>
            ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>No upcoming jobs scheduled.</span>}
          </Section>

          {/* planned downtime */}
          <Section label="Planned downtime">
            {downtimes.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {downtimes.map((d, i) => {
                  const w = downtimeWindow(d, now)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
                      <Pill tone={d.kind === 'Recurring' ? 'info' : 'neutral'}>{d.kind}</Pill>
                      <span className="BodySmallSemibold" style={{ flex: 1 }}>{d.reason}</span>
                      <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{w ? `${fmtStamp(w.start)} → ${fmtStamp(w.end)}` : `${d.cadence} · ${d.window}`}</span>
                    </div>
                  )
                })}
              </div>
            ) : <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>No planned downtime scheduled.</span>}
          </Section>
        </div>
      </DrawerBody>

      <SensorChartModal isOpen={sensorsOpen} onClose={() => setSensorsOpen(false)} unit={unit} sensors={pdmSensors} />
    </Drawer>
  )
}

const Well = ({ label, value, num }) => (
  <div style={{ display: 'grid', gap: 3, padding: '11px 13px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', minWidth: 0 }}>
    <span className="eyebrow">{label}</span>
    <span className="BodySmallSemibold" style={num ? NUM : undefined}>{value}</span>
  </div>
)

const Chevron = ({ open }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ color: 'var(--text-gray-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
const Section = ({ label, right, children, collapsible, open, onToggle }) => (
  <div style={{ display: 'grid', gap: (!collapsible || open) ? 10 : 0 }}>
    {collapsible ? (
      <button onClick={onToggle} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
        <Eyebrow>{label}</Eyebrow>
        <Chevron open={open} />
        <span style={{ flex: 1 }} />
        {right}
      </button>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Eyebrow>{label}</Eyebrow><span style={{ flex: 1 }} />{right}
      </div>
    )}
    {(!collapsible || open) && children}
  </div>
)
