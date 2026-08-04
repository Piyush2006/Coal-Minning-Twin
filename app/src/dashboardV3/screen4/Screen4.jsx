// Screen 4 — Asset Health. The CV-01 diagnosis end to end: ranked health table
// (transparent AHI), the load-aware thermal story (temp falls while the belt
// runs empty but the deviation keeps climbing → not load), flat vibration as
// the visible rule-out, predictive horizons with maturity badges (never a raw
// RUL above L4), and the act-now-vs-defer decision with a transparent trip calc.
import { useMemo, useState } from 'react'
import { Card, Reading, MaturityBadge, ConfidenceBadge } from '../ui'
import { ScreenFrame } from '../chrome'
import { useScrub } from '../screen0/store'
import { rankAssets, assetHealth, cvExpectedTemp, ASSET_LABEL } from './assetHealth'
import { useFixtures } from '../screen0/store'

export default function Screen4() {
  return <ScreenFrame title="Asset Health" renderMain={(ctx) => <HealthMain {...ctx} />} />
}

const ahiColor = (a) => (a >= 80 ? '#12A16E' : a >= 60 ? '#E0A32E' : '#E04B4B')

function HealthMain({ fx, derived, m }) {
  const { hist } = useFixtures()
  const select = useScrub(s => s.select)
  const selection = useScrub(s => s.selection)
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])
  const ranked = useMemo(() => rankAssets(snap), [snap])
  const focusId = ranked.some(r => r.id === selection) ? selection : 'cv-01'
  const focus = ranked.find(r => r.id === focusId) ?? ranked[0]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.95fr) minmax(0,1.4fr)', gap: 16 }}>
        <Card title="Fleet health — ranked by risk" density="working">
          <div style={{ display: 'grid', gap: 3 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 70px', fontSize: 10.5, color: 'var(--text-tertiary)', padding: '0 8px 4px' }}>
              <span>Asset</span><span style={{ textAlign: 'right' }}>AHI</span><span style={{ textAlign: 'right' }}>risk×crit</span>
            </div>
            {ranked.slice(0, 11).map(r => {
              const sel = r.id === focusId
              return (
                <button key={r.id} onClick={() => select(r.id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 44px 70px', alignItems: 'center', gap: 4, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: sel ? 'var(--accent-soft)' : 'transparent', borderRadius: 7, padding: '5px 8px', fontFamily: 'var(--font-ui)' }}>
                  <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? 'var(--accent)' : 'var(--text-primary)' }}>{ASSET_LABEL[r.id] ?? r.id}</span>
                  <span className="dv3-mono" style={{ textAlign: 'right', fontWeight: 700, color: ahiColor(r.ahi) }}>{r.ahi}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, r.riskScore * 200)}%`, height: '100%', background: ahiColor(r.ahi) }} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <Reading>Risk ranks by (100 − health) × criticality, so a mildly degraded critical asset outranks a badly degraded spare. CV-01 leads — its thermal residual is the single largest contributor on site.</Reading>
        </Card>

        <Card title={`${ASSET_LABEL[focus.id]} — health breakdown`} density="working"
          right={<span className="dv3-mono" style={{ fontSize: 20, fontWeight: 700, color: ahiColor(focus.ahi) }}>AHI {focus.ahi}</span>}>
          <div style={{ display: 'grid', gap: 8 }}>
            {focus.factors.map(f => (
              <div key={f.name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 150px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
                <div className="dv3-well" style={{ height: 9, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${f.sev * 100}%`, height: '100%', background: f.sev > 0.66 ? '#E04B4B' : f.sev > 0.33 ? '#E0A32E' : '#12A16E', borderRadius: 5 }} />
                </div>
                <span className="dv3-mono dv3-tert" style={{ fontSize: 11, textAlign: 'right' }}>{f.detail}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}><ConfidenceBadge level="full" note={`weighted composite · criticality ${focus.crit.toFixed(2)}`} /></div>
        </Card>
      </div>

      {focus.id === 'cv-01'
        ? <CVDetail fx={fx} hist={hist} derived={derived} m={m} />
        : <GenericHorizon focus={focus} snap={snap} />}
    </>
  )
}

/* ── CV-01 end-to-end thermal diagnosis ── */
function CVDetail({ fx, hist, derived, m }) {
  const tempS = useMemo(() => fx.series('cv-01·motorTemp', derived.t0, derived.t0 + derived.N * 60000, derived.N), [fx, derived])
  const loadS = useMemo(() => fx.series('cv-01·load', derived.t0, derived.t0 + derived.N * 60000, derived.N), [fx, derived])
  const vibS = useMemo(() => fx.series('cv-01·vibration', derived.t0, derived.t0 + derived.N * 60000, derived.N), [fx, derived])
  const now = derived.t0 + m * 60000
  const temp = fx.at('cv-01·motorTemp', now), load = fx.at('cv-01·load', now) ?? 0, vib = fx.at('cv-01·vibration', now)
  const resid = temp != null ? temp - cvExpectedTemp(load) : 0

  // trip projection from the trailing dT/dt over the last 60 min
  const shown = Math.max(2, Math.floor((m / derived.N) * tempS.length))
  const w = Math.min(30, shown - 1)
  const dTdt = w > 0 ? ((tempS[shown - 1]?.[1] ?? temp) - (tempS[shown - 1 - w]?.[1] ?? temp)) / (w * (derived.N / tempS.length) / 60) : 0  // °C/h
  const TRIP = 95
  const hoursToTrip = dTdt > 0.05 ? (TRIP - temp) / dTdt : Infinity

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, marginTop: 16 }}>
        <Card title="Drive motor — temperature vs load-aware expected" density="working">
          <ThermalChart tempS={tempS} loadS={loadS} m={m} N={derived.N} fmt={derived.fmt} chainEvents={derived.chainEvents} />
          <Reading><b>Temperature deviation increased while the belt ran empty — the rise isn't load.</b> During the 16:52–17:47 starvation the absolute temperature fell toward the no-load expectation, yet the gap to expected kept widening at ~3.1 °C/h. That rules out load and points to a degrading cooling path.</Reading>
        </Card>
        <Card title="Rule-out — vibration flat">
          <VibChart vibS={vibS} m={m} N={derived.N} fmt={derived.fmt} />
          <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
            <Metric2 label="Residual now" v={`+${resid.toFixed(1)} °C`} col={resid > 8 ? '#E04B4B' : '#E0A32E'} />
            <Metric2 label="Drift" v={`${dTdt >= 0 ? '+' : ''}${dTdt.toFixed(1)} °C/h`} col="var(--text-primary)" />
            <Metric2 label="Vibration" v={`${(vib ?? 2.1).toFixed(1)} mm/s`} col="#12A16E" sub="steady" />
          </div>
          <Reading>Steady vibration removes the bearing hypothesis: a spalling bearing would climb here. Thermal-only drift is consistent with fouled cooling fins / airflow.</Reading>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 16, marginTop: 16 }}>
        <Card title="30-day residual runway">
          <HistoryTrend hist={hist} />
          <Reading>The residual was flat until ~day 16, then drifted monotonically over the trailing two weeks — a slow-developing fault with 14 days of warning, not a step change.</Reading>
        </Card>
        <DeferralCard temp={temp} dTdt={dTdt} hoursToTrip={hoursToTrip} derived={derived} m={m} />
      </div>
    </>
  )
}

const Metric2 = ({ label, v, col, sub }) => (
  <div><div className="dv3-tert" style={{ fontSize: 10.5 }}>{label}</div><div className="dv3-mono" style={{ fontWeight: 700, color: col, fontSize: 15 }}>{v}</div>{sub && <div className="dv3-tert" style={{ fontSize: 9.5 }}>{sub}</div>}</div>
)

function ThermalChart({ tempS, loadS, m, N, fmt, chainEvents }) {
  const W = 560, H = 200, B = 20
  const shown = Math.max(2, Math.floor((m / N) * tempS.length))
  const x = (i) => 6 + (i / Math.max(1, tempS.length - 1)) * (W - 12)
  const yT = (v) => (H - B) - ((v - 45) / 55) * (H - B - 10)   // temp 45..100
  const yL = (v) => (H - B) - (v / 100) * (H - B - 10)          // load 0..100
  const expOf = (i) => 47 + 21 * ((loadS[i]?.[1] ?? 0) / 100)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      {[50, 60, 70, 80, 90].map(t => <g key={t}><line x1={6} x2={W - 6} y1={yT(t)} y2={yT(t)} stroke="#EDF0F5" /><text x={6} y={yT(t) - 2} fontSize="8" fill="var(--text-tertiary)">{t}°</text></g>)}
      {/* choke window shading */}
      {chainEvents.filter(e => e.stage === 'crush' && e.state === 'down').map((e, i) => (
        <rect key={i} x={x(Math.floor(e.start / N * tempS.length))} y={4} width={x(Math.floor(e.end / N * tempS.length)) - x(Math.floor(e.start / N * tempS.length))} height={H - B - 4} fill="rgba(224,163,46,0.10)" />
      ))}
      {/* expected(load) band */}
      <polyline points={loadS.slice(0, shown).map((_, i) => `${x(i)},${yT(expOf(i))}`).join(' ')} fill="none" stroke="#A9B2C1" strokeWidth="1.4" strokeDasharray="5 4" />
      {/* load (secondary, faint) */}
      <polyline points={loadS.slice(0, shown).map((p, i) => `${x(i)},${yL(p[1])}`).join(' ')} fill="none" stroke="#C6CDD8" strokeWidth="1" opacity="0.7" />
      {/* actual temp */}
      <polyline points={tempS.slice(0, shown).map((p, i) => `${x(i)},${yT(p[1])}`).join(' ')} fill="none" stroke="#E04B4B" strokeWidth="2" strokeLinecap="round" />
      <text x={W - 8} y={16} textAnchor="end" fontSize="9.5" fill="#E04B4B" fontWeight="600">motor temp</text>
      <text x={W - 8} y={28} textAnchor="end" fontSize="9" fill="#8A94A6">expected(load) dashed · load faint</text>
      {[0, 120, 240, 360, 480].map(t => <text key={t} x={x(Math.floor(t / N * tempS.length))} y={H - 5} fontSize="9" textAnchor="middle" fill="var(--text-tertiary)">{fmt(t)}</text>)}
    </svg>
  )
}

function VibChart({ vibS, m, N, fmt }) {
  const W = 300, H = 96
  const shown = Math.max(2, Math.floor((m / N) * vibS.length))
  const x = (i) => 4 + (i / Math.max(1, vibS.length - 1)) * (W - 8)
  const y = (v) => H - 16 - (v / 10) * (H - 24)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      <line x1={4} x2={W - 4} y1={y(6)} y2={y(6)} stroke="#E0A32E" strokeWidth="1" strokeDasharray="4 3" /><text x={W - 5} y={y(6) - 2} textAnchor="end" fontSize="8" fill="#B0721A">ISO alarm 6</text>
      <polyline points={vibS.slice(0, shown).map((p, i) => `${x(i)},${y(p[1])}`).join(' ')} fill="none" stroke="#12A16E" strokeWidth="1.8" />
      {[0, 240, 480].map(t => <text key={t} x={x(Math.floor(t / N * vibS.length))} y={H - 3} fontSize="8.5" textAnchor="middle" fill="var(--text-tertiary)">{fmt(t)}</text>)}
    </svg>
  )
}

function HistoryTrend({ hist }) {
  const roll = hist?.manifest?.dailyRollups?.['cv-01·motorTemp']
  if (!roll) return <div className="dv3-support">history loading…</div>
  const W = 400, H = 130
  const means = roll.map(d => d?.[1]).filter(v => v != null)
  const min = Math.min(...means) - 1, max = Math.max(...means) + 1
  const x = (i) => 6 + (i / (roll.length - 1)) * (W - 12)
  const y = (v) => H - 18 - ((v - min) / (max - min)) * (H - 28)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      <rect x={x(16)} y={4} width={W - 6 - x(16)} height={H - 22} fill="rgba(224,75,75,0.06)" />
      <text x={x(16) + 3} y={14} fontSize="8.5" fill="#B42318">drift onset ~day 16</text>
      <polyline points={roll.map((d, i) => d ? `${x(i)},${y(d[1])}` : '').filter(Boolean).join(' ')} fill="none" stroke="#E04B4B" strokeWidth="1.8" />
      {[0, 7, 14, 21, 29].map(d => <text key={d} x={x(d)} y={H - 4} fontSize="8.5" textAnchor="middle" fill="var(--text-tertiary)">d{d}</text>)}
      <text x={6} y={12} fontSize="9" fill="var(--text-tertiary)">daily mean motor temp °C</text>
    </svg>
  )
}

function DeferralCard({ temp, dTdt, hoursToTrip, derived, m }) {
  const [defer, setDefer] = useState(false)
  const R = derived.R
  const pTrip = Number.isFinite(hoursToTrip) ? Math.max(0, Math.min(1, (14 - hoursToTrip) / 14)) : 0   // vs next-shift horizon ~14 h
  const stoppageT = Math.round(R * 60 * 3)   // ~3 h unplanned clear if it trips mid-shift
  return (
    <Card title="Decision — act now or defer" density="working"
      right={<div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 2 }}>
        <button onClick={() => setDefer(false)} className="dv3-chip" style={{ border: 'none', cursor: 'pointer', fontWeight: 700, background: !defer ? 'var(--accent-soft)' : 'transparent', color: !defer ? 'var(--accent)' : 'var(--text-tertiary)' }}>Act now</button>
        <button onClick={() => setDefer(true)} className="dv3-chip" style={{ border: 'none', cursor: 'pointer', fontWeight: 700, background: defer ? 'var(--accent-soft)' : 'transparent', color: defer ? 'var(--accent)' : 'var(--text-tertiary)' }}>Defer</button>
      </div>}>
      {!defer ? (
        <div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
            <Metric2 label="Window" v="22:00 changeover" col="var(--text-primary)" />
            <Metric2 label="Duration" v="~25 min" col="var(--text-primary)" />
            <Metric2 label="Production cost" v="0 t" col="#12A16E" sub="buffered by changeover" />
          </div>
          <Reading>Clean the cooling fins at the scheduled 22:00 shift changeover. It fits inside the handover gap, so the production cost is zero — the residual resets and the runway clears.</Reading>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
            <Metric2 label="Temp now" v={`${temp?.toFixed(1)} °C`} col="#E0A32E" />
            <Metric2 label="Hours to 95 °C trip" v={Number.isFinite(hoursToTrip) ? `${hoursToTrip.toFixed(1)} h` : '—'} col="#E04B4B" sub={`at ${dTdt.toFixed(1)} °C/h`} />
            <Metric2 label="P(trip before Thu B)" v={`${Math.round(pTrip * 100)}%`} col="#E04B4B" />
          </div>
          <Reading>Defer past 22:00 and the drive is projected to reach its 95 °C trip in {Number.isFinite(hoursToTrip) ? hoursToTrip.toFixed(1) : '—'} h at the current rate. An unplanned mid-shift trip would cost about {stoppageT.toLocaleString()} t at the reference rate — far more than the free changeover clean. <b>Act now.</b></Reading>
        </div>
      )}
      <div style={{ marginTop: 8 }}><MaturityBadge level="stat" /></div>
    </Card>
  )
}

/* ── generic horizon for non-CV assets (horizon bar + maturity, no raw RUL) ── */
function GenericHorizon({ focus, snap }) {
  const p = snap[focus.id]?.parameters ?? {}
  const rul = p.rulHours
  const horizon = rul == null ? null : rul > 400 ? 'Weeks' : rul > 150 ? 'This week' : 'Days'
  return (
    <Card title={`${ASSET_LABEL[focus.id]} — predictive horizon`} density="working" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {horizon ? (
          <>
            <div><div className="dv3-tert" style={{ fontSize: 11 }}>Estimated horizon</div><div style={{ fontWeight: 700, fontSize: 18 }}>{horizon}</div></div>
            <div style={{ flex: 1, maxWidth: 320 }}>
              <div className="dv3-well" style={{ height: 12, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(6, Math.min(100, (1 - Math.min(1, (rul) / 700)) * 100))}%`, height: '100%', background: rul < 150 ? '#E04B4B' : rul < 400 ? '#E0A32E' : '#12A16E' }} />
              </div>
            </div>
            <MaturityBadge level="stat" />
          </>
        ) : <div className="dv3-support">No predictive model matured for this asset yet — condition-monitored only.</div>}
      </div>
      <Reading>Horizons are shown as bands with a maturity badge, never as a false-precision hours figure. The raw RUL estimate appears only in the L4 parameter list for reliability engineers.</Reading>
    </Card>
  )
}
