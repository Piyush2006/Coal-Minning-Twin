// Section · Use Cases — the landing overview. One table, one row per operational
// use case: live STATUS pill + the single most-telling KPI, each traced to a real
// calc (or the seeded PM10 / logistics series). Clicking a row navigates to the
// section that owns that use case. No new modals/charts/persisted state.
import { useMemo } from 'react'
import { useDash } from '../store'
import { useLiveSafetyFeed } from '../../lib/liveSafetyFeed'
import { buildProduction } from '../calc/production'
import { buildResources } from '../calc/resources'
import { buildPdm } from '../calc/pdm'
import { buildSafety } from '../calc/safety'
import { buildEnvironment, buildLogistics } from '../data/usecases'
import { UNITS } from '../data/equipment'
import { NUM, fmt } from '../calc/format'
import { CARD, Pill, th, td } from '../components/ui'

const PLANT_IDS = new Set(UNITS.filter(u => u.side === 'plant').map(u => u.id))

// status → Pill tone helpers (all resolve to positive | warning | critical)
const achieveTone = (pct) => (pct >= 95 ? 'positive' : pct >= 88 ? 'warning' : 'critical')   // existing plan tolerance
const countTone = (n) => (n === 0 ? 'positive' : n <= 2 ? 'warning' : 'critical')
const availTone = (pct) => (pct >= 90 ? 'positive' : pct >= 80 ? 'warning' : 'critical')
const healthTone = (h) => (h >= 70 ? 'positive' : h >= 45 ? 'warning' : 'critical')
const energyTone = (v, t) => (v <= t ? 'positive' : v <= t * 1.1 ? 'warning' : 'critical')
const pm10Tone = (v) => (v < 100 ? 'positive' : v <= 150 ? 'warning' : 'critical')
const devTone = (d) => (d <= 0.05 ? 'positive' : d <= 0.1 ? 'warning' : 'critical')
const TONE_LABEL = { positive: 'Good', warning: 'Watch', critical: 'Critical' }

export function UseCases() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const setTab = useDash(s => s.setTab)
  const safetyActions = useDash(s => s.safetyActions)
  const assignments = useDash(s => s.resourceAssignments)
  const jobOverrides = useDash(s => s.jobOverrides)
  const downtimeOverrides = useDash(s => s.downtimeOverrides)
  const liveEvents = useLiveSafetyFeed(s => s.events)

  const rows = useMemo(() => {
    const filt = { range, mineId, areaId, equipTypeId }
    const prod = buildProduction({ ...filt, shiftMode, settings, plan })
    const res = buildResources({ ...filt, settings, assignments, jobOverrides, downtimeOverrides, now: new Date() })
    const pdm = buildPdm({ ...filt, settings })
    const sf = buildSafety({ ...filt, settings, liveEvents })
    const env = buildEnvironment(filt)
    const logi = buildLogistics(filt)

    // production vs plan (fall back to saleable-capacity target so it always resolves)
    const planned = prod.achievement?.planned ?? (settings.capacityPerDay * prod.days)
    const actual = prod.achievement?.actual ?? prod.totals.actual
    const prodPct = planned ? (actual / planned) * 100 : 100

    // OPEN-NOW safety violations = today's events not yet resolved/actioned
    const isToday = (ts) => { const d = new Date(ts), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate() }
    const openBy = (kw) => sf.evidence.filter(e => isToday(e.ts) && new RegExp(kw, 'i').test(e.cat) && !e.resolved && !safetyActions[e.id]).length
    const resolvedBy = (kw) => sf.evidence.filter(e => isToday(e.ts) && new RegExp(kw, 'i').test(e.cat) && (e.resolved || safetyActions[e.id])).length
    const ppeOpen = openBy('ppe|restricted'), ppeResolved = resolvedBy('ppe|restricted')
    const proxOpen = openBy('vehicle|proximity')

    // worst plant-asset health
    const plantRows = res.rows.filter(r => PLANT_IDS.has(r.id))
    const worst = plantRows.reduce((w, r) => (w == null || r.health < w.health ? r : w), null)

    // energy intensity vs target
    const eInt = prod.totals.saleable ? prod.totals.kwh / prod.totals.saleable : 0
    const eTarget = settings.baseEnergyPerTon

    // logistics deviation (worse of stockpile / dispatch)
    const dev = Math.max(
      Math.abs(logi.stockpile - logi.stockTarget) / logi.stockTarget,
      Math.abs(logi.dispatch - logi.dispatchTarget) / logi.dispatchTarget,
    )

    return [
      { name: 'Mine Operations Optimization', tab: 'production', tone: achieveTone(prodPct),
        kpi: `${fmt(prodPct, 1)}%`, detail: `${fmt(actual)} T produced vs ${fmt(planned)} T planned` },
      { name: 'Real-Time Worker Monitoring', tab: 'safety', tone: countTone(ppeOpen),
        kpi: fmt(ppeOpen), detail: `${fmt(ppeOpen)} open person/PPE violation${ppeOpen === 1 ? '' : 's'} · ${fmt(ppeResolved)} resolved today` },
      { name: 'Collision & Proximity Safety', tab: 'safety', tone: countTone(proxOpen),
        kpi: fmt(proxOpen), detail: `${fmt(proxOpen)} open vehicle-proximity violation${proxOpen === 1 ? '' : 's'} · today` },
      { name: 'Fleet & Equipment Management', tab: 'equipment', tone: availTone(res.overview.availability),
        kpi: `${fmt(res.overview.availability)}%`, detail: `${res.overview.Running} running · ${res.overview.availability}% available` },
      { name: 'Predictive Maintenance', tab: 'predictive', tone: pdm.counts.Critical > 0 ? 'critical' : pdm.counts.Warning > 0 ? 'warning' : 'positive',
        kpi: `${fmt(pdm.counts.Critical)} / ${fmt(pdm.counts.Warning)}`, detail: `${pdm.counts.Critical} critical · ${pdm.counts.Warning} warning of ${pdm.assets.length} assets` },
      { name: 'Asset Performance Management', tab: 'equipment', tone: worst ? healthTone(worst.health) : 'positive',
        kpi: worst ? fmt(worst.health) : '—', detail: worst ? `worst plant asset ${worst.id} · health ${worst.health}` : 'all plant assets healthy' },
      { name: 'Production & Productivity Management', tab: 'production', tone: achieveTone(prodPct),
        kpi: `${fmt(actual)} T`, detail: `${fmt(actual)} T vs ${fmt(planned)} T plan (${fmt(prodPct, 1)}%)` },
      { name: 'Energy & Sustainability Management', tab: 'efficiency', tone: energyTone(eInt, eTarget),
        kpi: `${fmt(eInt, 2)} kWh/T`, detail: `${fmt(eInt, 2)} vs ${fmt(eTarget, 1)} kWh/T target` },
      { name: 'Environmental Monitoring', tab: 'safety', tone: pm10Tone(env.pm10),
        kpi: `${fmt(env.pm10)} µg/m³`, detail: `PM10 dust · action level 150 µg/m³` },
      { name: 'Supply Chain & Logistics', tab: 'production', tone: devTone(dev),
        kpi: `${fmt(logi.stockpile)} T`, detail: `stockpile vs ${fmt(logi.stockTarget)} T · dispatch ${fmt(logi.dispatch)} t/h` },
    ]
  }, [range, mineId, areaId, equipTypeId, shiftMode, settings, plan, safetyActions, assignments, jobOverrides, downtimeOverrides, liveEvents])

  return (
    <div style={{ ...CARD, overflow: 'hidden' }}>
      <div style={{ padding: '15px 16px' }}>
        <span className="HeadingSmallSemibold">Use Cases</span>
        <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', marginLeft: 10 }}>Live status across the operation — click a row to open its section</span>
      </div>
      <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-gray-subtle)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th('left')}>Use case</th>
              <th style={{ ...th('left'), width: 120 }}>Status</th>
              <th style={{ ...th('right'), width: 150 }}>Key KPI</th>
              <th style={th('left')}>Detail</th>
              <th style={{ ...th('left'), width: 34 }} aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} onClick={() => setTab(r.tab)} title={`Open ${r.name}`}
                style={{ cursor: 'pointer', transition: 'background 120ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ ...td(), verticalAlign: 'middle' }} className="BodySmallSemibold">{r.name}</td>
                <td style={{ ...td(), verticalAlign: 'middle' }}><Pill tone={r.tone}>{TONE_LABEL[r.tone]}</Pill></td>
                <td style={{ ...td('right'), ...NUM, verticalAlign: 'middle' }} className="BodyMediumSemibold">{r.kpi}</td>
                <td style={{ ...td(), whiteSpace: 'normal', verticalAlign: 'middle' }} className="BodySmallRegular"><span style={{ color: 'var(--text-gray-secondary)' }}>{r.detail}</span></td>
                <td style={{ ...td('right'), verticalAlign: 'middle', color: 'var(--text-gray-tertiary)' }} aria-hidden>›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
