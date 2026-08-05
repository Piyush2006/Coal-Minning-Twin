// Screen 6 — Safety. Leading indicators, not a lagging incident count. Reuses
// the SiteMap (zones + live event pins), the alert-policy episode stream (the
// promoted proximity auto-stop line), an environmental strip vs statutory
// limits, and per-zone PPE coverage — never a single mine-wide % that hides the
// one bad area. Assembly of existing primitives.
import { useMemo } from 'react'
import { Card, Reading, Thesis } from '../ui'
import { ScreenFrame } from '../chrome'
import { SiteMap } from '../viz'
import { dedupeEpisodes, presentAlertMsg } from '../data/alertPolicy'

export default function Screen6() {
  return <ScreenFrame title="Safety" renderMain={(ctx) => <SafetyMain {...ctx} />} />
}

const ZONES = [
  { label: 'Active Blast Area', x0: -185, z0: -70, x1: -110, z1: -30, fill: 'rgba(224,75,75,0.10)', stroke: 'rgba(224,75,75,0.5)' },
  { label: 'Crusher Bay', x0: -40, z0: -18, x1: 0, z1: 18, fill: 'rgba(229,135,31,0.10)', stroke: 'rgba(229,135,31,0.5)' },
  { label: 'Rail Corridor', x0: 55, z0: -34, x1: 118, z1: -14, fill: 'rgba(123,94,167,0.10)', stroke: 'rgba(123,94,167,0.5)' },
]
const PPE_ZONES = [
  ['Plant Walkway', 'ppe-cam-1'], ['Crusher Bay', 'ppe-cam-2'], ['Rail Corridor', 'ppe-cam-3'], ['Workshop', 'ppe-cam-4'],
]

function SafetyMain({ fx, derived, m }) {
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])
  const s = snap['safety-1']?.parameters ?? {}
  const pm = snap['pm-1']?.parameters ?? {}
  const eps = useMemo(() => derived.episodes(m), [derived, m])
  const safetyEps = dedupeEpisodes(eps.filter(e => ['Proximity', 'Worker Safety', 'Geofence'].includes(e.useCase))).sort((a, b) => b.firstT - a.firstT)
  // live event pins near their zone
  const activeProx = eps.find(e => e.useCase === 'Proximity' && e.active)
  const pins = []
  if (activeProx) pins.push({ x: -20, z: 6, color: '#E04B4B' })
  if (s.unauthorizedEvent) pins.push({ x: -150, z: -50, color: '#E5871F' })

  const envRows = [
    { name: 'PM10 dust', v: pm.pm10 ?? 0, unit: 'µg/m³', limit: 250, warn: 200 },
    { name: 'PM2.5 dust', v: pm.pm25 ?? 0, unit: 'µg/m³', limit: 60, warn: 45 },
    { name: 'Noise', v: pm.noise ?? 0, unit: 'dBA', limit: 85, warn: 80 },
  ]

  const autoStops = Math.round((s.proximityAlertsToday ?? 0) * 0.4)
  return (
    <>
      <Thesis>
        Exposure is being caught live at {derived.fmt(m)} — closest approach {Math.round(s.minWorkerVehicleDistance ?? 0)} m, {Math.round(s.proximityAlertsToday ?? 0)} proximity breaches triggering {autoStops} vehicle auto-stops. Leading signals, not a lagging incident tally.
      </Thesis>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16 }}>
        <Card title="Site safety map" density="working"
          right={<span className="dv3-support" style={{ fontSize: 11 }}>zones + live events at {derived.fmt(m)}</span>}>
          <SiteMap fx={fx} derived={derived} m={m} height={210} zones={ZONES} events={pins} showLabels={false} />
          <Reading more={`Restricted zones with live worker–vehicle events. ${s.workersOnSite ? Math.round(s.workersOnSite) : 'Crew'} workers across pit, plant, rail and port — where exposure is right now, not a site-wide average.`}>Where exposure is now, not a site average</Reading>
        </Card>
        <Card title="Leading safety signals">
          <div style={{ display: 'flex', gap: 22, marginBottom: 6 }}>
            <Big label="Closest approach" v={`${Math.round(s.minWorkerVehicleDistance ?? 0)} m`} col={(s.minWorkerVehicleDistance ?? 99) < 8 ? '#E04B4B' : '#12A16E'} />
            <Big label="Proximity events" v={Math.round(s.proximityAlertsToday ?? 0)} sub="today" />
            <Big label="Auto-stops" v={autoStops} sub="triggered" />
          </div>
          <Reading more="A proximity breach under 6 m triggers a real vehicle auto-stop — a prevented incident, counted as a leading win, not waited on as a lagging statistic.">Breach under 6 m → real vehicle auto-stop</Reading>
          <div style={{ marginTop: 8, display: 'grid', gap: 5, maxHeight: 150, overflowY: 'auto' }}>
            {safetyEps.slice(0, 6).map(e => (
              <div key={e.key + e.firstT} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
                <span className="dv3-mono dv3-tert">{derived.fmt(Math.floor(e.firstT / 60))}</span>
                <span className="dv3-chip" style={{ background: e.sev === 'critical' ? '#FDECEC' : 'var(--surface-2)', color: e.sev === 'critical' ? '#B42318' : 'var(--text-secondary)' }}>{e.useCase}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{presentAlertMsg(e.msg)}</span>
                {e.count > 1 && <span className="dv3-mono dv3-tert" style={{ marginLeft: 'auto' }}>×{e.count}</span>}
              </div>
            ))}
            {safetyEps.length === 0 && <div className="dv3-support">No safety episodes by {derived.fmt(m)}.</div>}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 16 }}>
        <Card title="Environmental — vs statutory limits" density="working">
          <div style={{ display: 'grid', gap: 12 }}>
            {envRows.map(r => {
              const pct = Math.min(1, r.v / r.limit)
              const col = r.v >= r.limit ? '#E04B4B' : r.v >= r.warn ? '#E0A32E' : '#12A16E'
              return (
                <div key={r.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span className="dv3-mono" style={{ color: col, fontWeight: 700 }}>{Math.round(r.v)} <span className="dv3-tert" style={{ fontWeight: 400 }}>/ {r.limit} {r.unit}</span></span>
                  </div>
                  <div className="dv3-well" style={{ height: 10, borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: `${(r.warn / r.limit) * 100}%`, top: 0, bottom: 0, width: 1.5, background: '#E0A32E', opacity: 0.6 }} />
                    <div style={{ width: `${pct * 100}%`, height: '100%', background: col, borderRadius: 5 }} />
                  </div>
                </div>
              )
            })}
          </div>
          <Reading more={`${(pm.pm10 ?? 0) >= 200 ? 'PM10 is riding near the exceedance limit — dust suppression should be active on the haul roads.' : 'Dust and noise within limits.'} Suppression ${pm.suppressionActive ? 'on' : 'off'}.`}>{(pm.pm10 ?? 0) >= 200 ? 'PM10 near limit · suppression on' : 'Within limits · suppression on'}</Reading>
        </Card>

        <Card title="PPE compliance — per zone" density="working">
          {(() => {
            const zones = PPE_ZONES.map(([zone, cam]) => ({ zone, rate: snap[cam]?.parameters?.complianceRate ?? 100 }))
            const flagged = zones.filter(z => z.rate < 98)
            // all compliant → one chip + coverage note, not a row of identical 100%s
            if (flagged.length === 0) return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span className="dv3-chip" style={{ background: '#E7F6EF', color: '#0E7A54', fontWeight: 700, fontSize: 13, padding: '5px 12px' }}>✓ All {zones.length} zones compliant</span>
                  <span className="dv3-mono dv3-tert" style={{ fontSize: 12 }}>100% · {zones.length} of 6 mandated zones instrumented</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {zones.map(z => <span key={z.zone} className="dv3-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 11 }}>{z.zone}</span>)}
                </div>
              </div>
            )
            // exceptions surface as bars — the one walkway that needs attention
            return (
              <div style={{ display: 'grid', gap: 9 }}>
                {zones.map(({ zone, rate }) => {
                  const col = rate >= 98 ? '#12A16E' : rate >= 92 ? '#E0A32E' : '#E04B4B'
                  return (
                    <div key={zone} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 46px', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12.5 }}>{zone}</span>
                      <div className="dv3-well" style={{ height: 9, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${rate}%`, height: '100%', background: col, borderRadius: 5 }} />
                      </div>
                      <span className="dv3-mono" style={{ textAlign: 'right', fontWeight: 700, color: col, fontSize: 12 }}>{Math.round(rate)}%</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          <Reading more="Coverage per zone, never a single site-wide number — a 99% average would hide the one walkway that needs attention. Exceptions surface as bars; a compliant site collapses to one chip.">Per zone — a site average hides the bad walkway</Reading>
        </Card>
      </div>
    </>
  )
}

const Big = ({ label, v, sub, col }) => (
  <div><div className="dv3-tert" style={{ fontSize: 10.5 }}>{label}</div><div style={{ fontWeight: 700, fontSize: 22, color: col ?? 'var(--text-primary)' }}>{v}</div>{sub && <div className="dv3-tert" style={{ fontSize: 10 }}>{sub}</div>}</div>
)
