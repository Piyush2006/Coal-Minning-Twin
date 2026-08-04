// Screen 0 — Mine Pulse. Airy density. One question: will we make the number,
// and what is the single biggest thing stopping us?
// Chrome built in: global time scrubber (T3 — the whole screen, including the
// Gantt, alerts and waterfall, is a function of scrub time), twin navigator
// (left), action-center rail (right). Replay plane; Live lands with plane
// unification (pre-Screen-4 gate).
import { useEffect, useMemo, useState } from 'react'
import '../tokens.css'
import { StatusPatternDefs, STATUS } from '../patterns'
import { Card, Reading, ConfidenceBadge, MaturityBadge, Pill, Segmented, AlertCard } from '../ui'
import { useScrub, useFixtures, ensureFixtures, startReplayDriver, SHIFT_MIN } from './store'
import { deriveShift, deriveGantt, NAV_TREE, BUCKET_LABEL, STAGE_LABEL } from './derive'
import { Waterfall } from './Waterfall'
import { Ribbon, ConstraintShares } from './Ribbon'
import { Gantt } from './Gantt'

const mono = 'var(--font-mono)'
const STATUS_DOT = { running: '#12A16E', idle: '#E0A32E', fault: '#E04B4B', off: '#DCE1E9' }
const OWNER = {
  Proximity: ['Shift In-charge', 'now'], 'Worker Safety': ['Safety Officer', 'now'], Geofence: ['Safety Officer', '4 h'],
  TPMS: ['Dispatch', '4 h'], Haulage: ['Dispatch', '2 h'], 'HEMM PdM': ['Reliability', '48 h'],
  'Vibration CBM': ['Reliability', '7 d'], 'Conveyor Vision': ['CHP Control', '2 h'], 'CHP SEC': ['Energy', '7 d'], 'Dust & Env': ['Environment', '1 h'],
}
const sevOf = (e) => (e.sev === 'critical' ? (e.useCase === 'Proximity' || e.useCase === 'Worker Safety' ? 'P1' : 'P2') : e.sev === 'warn' ? 'P3' : 'P4')

export default function Screen0() {
  const { fx, error } = useFixtures()
  useEffect(() => { ensureFixtures(); return startReplayDriver() }, [])
  if (error) return <Shell><Card title="Fixture failed to load"><div className="dv3-support">{error}</div></Card></Shell>
  if (!fx) return <Shell><Card title="Mine Pulse"><div className="dv3-support">Loading golden shift…</div></Card></Shell>
  return <Loaded fx={fx} />
}

const Shell = ({ children }) => (
  <div className="dv3" style={{ minHeight: '100vh', padding: 32 }}>{children}</div>
)

function Loaded({ fx }) {
  const tMin = useScrub(s => s.tMin)
  const m = Math.floor(tMin)
  const derived = useMemo(() => deriveShift(fx), [fx])
  const gantt = useMemo(() => deriveGantt(fx), [fx])
  const snap = useMemo(() => derived.atMinute(m), [derived, m])
  const drill = useScrub(s => s.drill)

  return (
    <div className="dv3" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StatusPatternDefs />
      <TopBar derived={derived} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <NavRail fx={fx} m={m} derived={derived} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', minWidth: 0 }}>
          <K1 derived={derived} snap={snap} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(0,1fr)', gap: 16, marginTop: 16 }}>
            <Card title={`Production loss attribution — to ${derived.fmt(m)}`} density="airy">
              <Waterfall snap={snap} width={660} />
            </Card>
            <Card title="Shift constraint — bottleneck of record">
              <Ribbon derived={derived} m={m} width={430} />
              <ConstraintShares derived={derived} m={m} />
              <ConstraintReading derived={derived} snap={snap} m={m} />
            </Card>
          </div>
          <Card title="Equipment state timeline" density="working" style={{ marginTop: 16 }}>
            <Gantt rows={gantt} derived={derived} m={m} width={1020} />
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginTop: 16 }}>
            <SafetyCard fx={fx} derived={derived} m={m} />
            <RiskCard fx={fx} derived={derived} m={m} />
            <StrippingCard fx={fx} derived={derived} m={m} />
          </div>
        </main>
        <ActionRail derived={derived} m={m} />
      </div>
      {drill && <DrillOverlay derived={derived} m={m} />}
    </div>
  )
}

/* ── top bar with the global scrubber ── */
function TopBar({ derived }) {
  const { tMin, playing, speed, setT, setPlaying, setSpeed } = useScrub()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', background: 'var(--surface)', boxShadow: 'var(--card-shadow)', zIndex: 5 }}>
      <div style={{ fontWeight: 650, fontSize: 15, letterSpacing: '-0.01em' }}>Blackridge · Mine Pulse</div>
      <span className="dv3-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>Shift B · 04 Aug</span>
      <span style={{ flex: 0.06 }} />
      <button className="dv3-btn dv3-btn--ghost" style={{ padding: '6px 12px', fontSize: 14 }} onClick={() => setPlaying(!playing)}>{playing ? '❚❚' : '▶'}</button>
      <input type="range" min={0} max={SHIFT_MIN} step={0.5} value={tMin} onChange={e => setT(+e.target.value)}
        style={{ flex: 1, accentColor: 'var(--accent)' }} aria-label="shift time scrubber" />
      <span className="dv3-mono" style={{ fontSize: 13, fontWeight: 700, width: 46 }}>{derived.fmt(Math.floor(tMin))}</span>
      <Segmented options={['60×', '120×', '240×']} value={`${speed}×`} onChange={v => setSpeed(parseInt(v))} />
      <span className="dv3-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}>REPLAY</span>
      <span className="dv3-chip" title="Live binding lands with plane unification (before Screen 4)" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>LIVE ·soon</span>
      <a href="#/design-system" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>design system →</a>
    </div>
  )
}

/* ── K1: coal vs plan + projection ── */
function K1({ derived, snap }) {
  const att = Math.round(snap.attain * 100)
  const delta = Math.round(snap.actual - snap.planTo)
  const lr = { actual: Math.round(snap.actual), plan: Math.round(snap.planTo), proj: Math.round(snap.proj), lo: Math.round(snap.projLo), hi: Math.round(snap.projHi) }
  return (
    <Card density="airy">
      <div style={{ display: 'flex', gap: 36, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 300 }}>
          <div className="dv3-cardhead">Saleable coal · vs plan to now</div>
          <div className="dv3-hero dv3-hero--xl">{lr.actual.toLocaleString()}<span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8 }}>t</span></div>
          <div className="dv3-support" style={{ marginTop: 6, fontSize: 14 }}>
            <span style={{ color: delta < 0 ? 'var(--st-down-u)' : 'var(--st-operating)', fontWeight: 650 }}>{delta < 0 ? '−' : '+'}{Math.abs(delta).toLocaleString()} t vs plan</span>
            <span className="dv3-tert"> · {att}%</span>
          </div>
          <div className="dv3-support" style={{ marginTop: 10 }}>
            {snap.m >= derived.N
              ? <>Shift closed at <b style={{ color: 'var(--text-primary)' }}>{att}%</b><span className="dv3-tert"> · plan {Math.round(derived.plan).toLocaleString()} t</span></>
              : <>Projected close <b style={{ color: 'var(--text-primary)' }}>{lr.proj.toLocaleString()} t</b>
                <span className="dv3-tert"> · P10–P90 {lr.lo.toLocaleString()}–{lr.hi.toLocaleString()} · plan {Math.round(derived.plan).toLocaleString()}</span></>}
          </div>
          <K1Reading derived={derived} snap={snap} />
        </div>
        <div style={{ flex: 1, minWidth: 420 }}>
          <PaceChart derived={derived} snap={snap} />
        </div>
      </div>
    </Card>
  )
}

function K1Reading({ derived, snap }) {
  const cs = derived.constraintShares(snap.m)
  const worst = Object.entries(snap.buckets).sort((a, b) => b[1] - a[1])[0]
  if (!worst || worst[1] < 5) return <Reading>On pace — no material loss accrued yet.</Reading>
  return (
    <Reading>
      {BUCKET_LABEL[worst[0]]} is the biggest loss so far — about {Math.round(worst[1])} t
      {cs.top ? ` · ${STAGE_LABEL[cs.top.root] ?? cs.top.root} has been the constraint for ${Math.round(cs.top.share * 100)}% of the shift` : ''}.
    </Reading>
  )
}

/* pace chart: cumulative vs plan pace + projection cone + annotation rules */
function PaceChart({ derived, snap }) {
  const W = 560, H = 156, L = 8, B = 18
  const maxY = derived.plan * 1.04
  const x = (mm) => L + (mm / derived.N) * (W - L - 4)
  const y = (t) => (H - B) - (t / maxY) * (H - B - 8)
  const pts = []
  for (let mm = 0; mm <= snap.m; mm += 4) pts.push(`${x(mm)},${y(derived.cumActual[mm])}`)
  pts.push(`${x(snap.m)},${y(snap.actual)}`)
  const areaPts = [`${x(0)},${y(0)}`, ...pts, `${x(snap.m)},${y(0)}`]
  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%' }}>
      <defs>
        <linearGradient id="k1g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B5CE7" stopOpacity="0.16" /><stop offset="1" stopColor="#2B5CE7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={L} x2={W - 4} y1={y(maxY * f)} y2={y(maxY * f)} stroke="#EDF0F5" />)}
      {/* annotations (R3) */}
      {derived.chainEvents.filter(e => e.start <= snap.m).map((e, i) => (
        <g key={i}>
          <line x1={x(e.start)} x2={x(e.start)} y1={10} y2={H - B} stroke="rgba(16,24,40,0.15)" strokeWidth="1" />
          <text x={x(e.start) + 3} y={16 + (i % 3) * 10} fontSize="8.5" fill="var(--text-tertiary)">{e.label.split(' — ')[0].slice(0, 22)}</text>
        </g>
      ))}
      {/* plan pace — dashed grey behind */}
      <line x1={x(0)} y1={y(0)} x2={x(derived.N)} y2={y(derived.plan)} stroke="#A9B2C1" strokeWidth="1.5" strokeDasharray="5 4" />
      {/* projection cone */}
      {snap.m < derived.N && (
        <polygon points={`${x(snap.m)},${y(snap.actual)} ${x(derived.N)},${y(snap.projHi)} ${x(derived.N)},${y(snap.projLo)}`} fill="rgba(43,92,231,0.08)" />
      )}
      <polyline points={areaPts.join(' ')} fill="url(#k1g)" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke="#2B5CE7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(snap.m)} cy={y(snap.actual)} r="4" fill="#2B5CE7" stroke="#fff" strokeWidth="2" />
      {[0, 120, 240, 360, 480].map(t => (
        <text key={t} x={x(t)} y={H - 4} textAnchor={t === 0 ? 'start' : t === 480 ? 'end' : 'middle'} fontSize="9.5" fill="var(--text-tertiary)">{derived.fmt(t)}</text>
      ))}
    </svg>
  )
}

function ConstraintReading({ derived, snap, m }) {
  const cs = derived.constraintShares(m)
  if (!cs.top) return <Reading>The chain has run at reference rate so far.</Reading>
  const t = Math.round(snap.buckets[{ crush: 'crushing', face: 'faceLoading', dispatch: 'dispatch', haul: 'haulage', chp: 'chp' }[cs.top.root]] ?? 0)
  return <Reading>{STAGE_LABEL[cs.top.root] ?? cs.top.root} has been the constraint for {Math.round(cs.top.share * 100)}% of this shift — about {t} t.</Reading>
}

/* ── twin navigator ── */
function NavRail({ fx, m, derived }) {
  const [open, setOpen] = useState(true)
  const selection = useScrub(s => s.selection)
  const select = useScrub(s => s.select)
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])
  if (!open) return <div style={{ width: 26, display: 'flex', alignItems: 'flex-start', padding: 6 }}><button className="dv3-btn dv3-btn--ghost" style={{ padding: '4px 7px' }} onClick={() => setOpen(true)}>›</button></div>
  return (
    <aside style={{ width: 212, flexShrink: 0, overflowY: 'auto', padding: '14px 10px 24px 16px', borderRight: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div className="dv3-cardhead">Twin navigator</div><span style={{ flex: 1 }} />
        <button className="dv3-btn dv3-btn--ghost" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => setOpen(false)}>‹</button>
      </div>
      {NAV_TREE.map(g => (
        <div key={g.label} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0 4px' }}>{g.label}</div>
          {g.assets.map(([id, label]) => {
            const st = snap[id]?.status ?? 'running'
            return (
              <button key={id} onClick={() => select(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: selection === id ? 'var(--accent-soft)' : 'transparent', borderRadius: 7, padding: '4px 8px', fontSize: 12.5,
                  color: selection === id ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[st] ?? '#DCE1E9', flexShrink: 0 }} />
                {label}
              </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

/* ── action-center rail ── */
function ActionRail({ derived, m }) {
  const eps = useMemo(() => derived.episodes(m).slice().sort((a, b) => b.firstT - a.firstT), [derived, m])
  const activeish = eps.filter(e => e.active || m * 60 - e.lastT < 1800).slice(0, 7)
  return (
    <aside style={{ width: 296, flexShrink: 0, overflowY: 'auto', padding: '14px 16px 24px 10px', borderLeft: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div className="dv3-cardhead">Action center</div>
        <span className="dv3-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{activeish.length} open</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {activeish.length === 0 && <div className="dv3-support">Nothing needs attention at {derived.fmt(m)}.</div>}
        {activeish.map(e => {
          const [owner, sla] = OWNER[e.useCase] ?? ['—', '—']
          return (
            <AlertCard key={e.key + e.firstT} compact severity={sevOf(e)} asset={`${derived.fmt(Math.floor(e.firstT / 60))} · ${e.useCase}`}
              hypothesis={e.msg} owner={owner} sla={sla} />
          )
        })}
      </div>
    </aside>
  )
}

/* ── row-2 cards ── */
function SafetyCard({ fx, derived, m }) {
  const p = fx.snapshot(derived.t0 + m * 60000, ['safety-1'])['safety-1']?.parameters ?? {}
  const prox = useMemo(() => derived.episodes(m).filter(e => e.useCase === 'Proximity' && e.sev === 'critical').pop(), [derived, m])
  return (
    <Card title="Safety exposure · leading">
      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline' }}>
        <div className="dv3-hero dv3-hero--md">{Math.round(p.proximityAlertsToday ?? 0) + Math.round(p.unauthorizedEntriesToday ?? 0)}</div>
        <div className="dv3-support">events today · closest approach <b>{Math.round(p.minWorkerVehicleDistance ?? 0)} m</b></div>
      </div>
      <Reading>
        {prox ? `${derived.fmt(Math.floor(prox.firstT / 60))} — ${prox.msg}.` : 'No proximity incidents this shift.'}
        {' '}PPE zones quiet ({Math.round(p.workersOnSite ?? 0)} workers on site).
      </Reading>
    </Card>
  )
}

function RiskCard({ fx, derived, m }) {
  const t = derived.t0 + m * 60000
  const temp = fx.at('cv-01·motorTemp', t)
  const load = fx.at('cv-01·load', t) ?? 0
  const expected = 47 + 21 * (load / 100)
  const resid = temp != null ? temp - expected : null
  const series = useMemo(() => fx.series('cv-01·motorTemp', derived.t0, derived.t0 + 480 * 60000, 240), [fx, derived])
  const loadS = useMemo(() => fx.series('cv-01·load', derived.t0, derived.t0 + 480 * 60000, 240), [fx, derived])
  const shownIdx = Math.floor((m / 480) * series.length)
  return (
    <Card title="Critical asset risk · CV-01 drive">
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="dv3-mono" style={{ fontSize: 15, fontWeight: 700 }}>{temp?.toFixed(1)} °C</span>
        <span className="dv3-mono" style={{ fontSize: 12.5, color: 'var(--st-degraded)' }}>+{resid?.toFixed(1)} vs expected</span>
        <MaturityBadge level="stat" />
      </div>
      <MiniDual a={series.slice(0, shownIdx)} b={loadS.slice(0, shownIdx)} />
      <Reading>Temperature deviation kept climbing while the belt ran empty — the rise isn't load. Degraded cooling path; clean fins at the 22:00 changeover.</Reading>
    </Card>
  )
}

function MiniDual({ a, b }) {
  const W = 260, H = 64
  if (!a.length) return <div style={{ height: H }} />
  const t0 = a[0][0], t1 = a[a.length - 1][0] || t0 + 1
  const x = (t) => ((t - t0) / (t1 - t0 || 1)) * W
  const ya = (v) => H - 4 - ((v - 55) / 45) * (H - 8)
  const yb = (v) => H - 4 - (v / 100) * (H - 8)
  return (
    <svg width={W} height={H} style={{ display: 'block', margin: '8px 0 2px' }}>
      <polyline points={b.map(([t, v]) => `${x(t)},${yb(v)}`).join(' ')} fill="none" stroke="#A9B2C1" strokeWidth="1.2" strokeDasharray="4 3" />
      <polyline points={a.map(([t, v]) => `${x(t)},${ya(v)}`).join(' ')} fill="none" stroke="var(--st-degraded)" strokeWidth="1.8" strokeLinecap="round" />
      <text x={W - 2} y={10} textAnchor="end" fontSize="9" fill="var(--text-tertiary)">temp · load (dashed)</text>
    </svg>
  )
}

function StrippingCard({ fx, derived, m }) {
  const t = derived.t0 + m * 60000
  const sr = fx.at('pit-1·stripRatio', t)
  const exposed = fx.at('pit-1·coalExposed', t)
  return (
    <Card title="Overburden & stripping">
      <div style={{ display: 'flex', gap: 20, alignItems: 'baseline' }}>
        <div className="dv3-hero dv3-hero--md">{sr?.toFixed(2) ?? '—'}</div>
        <div className="dv3-support">realised SR · plan 3.10</div>
      </div>
      <Reading>
        {sr != null && sr < 3.1
          ? `Under-stripping vs plan — OB is being borrowed from next quarter (coal exposed ${Math.round(exposed ?? 0)} kt).`
          : `Stripping on plan · coal exposed ${Math.round(exposed ?? 0)} kt.`}
      </Reading>
      <ConfidenceBadge level="partial" note="Survey reconciliation monthly — sensor-derived" />
    </Card>
  )
}

/* ── waterfall drill-down: bucket → events → diagnosis (2 clicks) ── */
function DrillOverlay({ derived, m }) {
  const drill = useScrub(s => s.drill)
  const drillEvent = useScrub(s => s.drillEvent)
  const closeDrill = useScrub(s => s.closeDrill)
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') closeDrill() }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [closeDrill])
  const events = derived.events.filter(e => e.bucket === drill.bucket && e.start < m)
  const ev = drill.event
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.28)', zIndex: 40, display: 'flex', justifyContent: 'flex-end' }} onClick={closeDrill}>
      <div className="dv3" style={{ width: 480, height: '100%', overflowY: 'auto', background: 'var(--canvas)', padding: 20, boxShadow: '-12px 0 40px rgba(16,24,40,0.18)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 650, fontSize: 15 }}>{BUCKET_LABEL[drill.bucket]} — loss events</div>
          <span style={{ flex: 1 }} />
          <button className="dv3-btn dv3-btn--ghost" onClick={closeDrill}>Esc ✕</button>
        </div>
        {!ev && (
          <div style={{ display: 'grid', gap: 10 }}>
            {events.length === 0 && <Card density="working"><div className="dv3-support">No {BUCKET_LABEL[drill.bucket]} losses accrued by {derived.fmt(m)}.</div></Card>}
            {events.map((e, i) => (
              <Card key={i} density="working" style={{ cursor: 'pointer' }}>
                <div onClick={() => drillEvent(e)}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span className="dv3-mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{derived.fmt(e.start)}–{derived.fmt(Math.min(e.end + 1, m))}</span>
                    <span style={{ fontWeight: 650 }}>−{Math.round(e.tonnes)} t</span>
                    <span className="dv3-tert" style={{ fontSize: 12 }}>{STAGE_LABEL[e.root] ?? 'texture'}</span>
                    <span style={{ flex: 1 }} /><span style={{ color: 'var(--accent)', fontSize: 12 }}>diagnosis →</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {ev && <Diagnosis derived={derived} ev={ev} m={m} back={() => drillEvent(null)} />}
      </div>
    </div>
  )
}

function Diagnosis({ derived, ev, m, back }) {
  const cause = derived.chainEvents.find(c => c.stage === ev.root && ev.start >= c.start && ev.start < c.end)
    ?? derived.chainEvents.find(c => c.stage === ev.root && ev.start >= c.start - 30 && ev.start <= c.end + 5)
  const alerts = useMemo(() => derived.episodes(Math.min(m, ev.end + 30)).filter(a => a.firstT / 60 >= ev.start - 10 && a.firstT / 60 <= ev.end + 30), [derived, ev, m])
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button className="dv3-btn dv3-btn--ghost" style={{ justifySelf: 'start' }} onClick={back}>← events</button>
      <AlertCard severity="P2" asset={`${STAGE_LABEL[ev.root] ?? ev.root} · ${derived.fmt(ev.start)}–${derived.fmt(ev.end + 1)}`}
        maturity="rule"
        hypothesis={cause?.label ?? 'Unattributed flow shortfall (texture)'}
        evidence={[`−${Math.round(ev.tonnes)} t at boundary`, ...Object.entries(ev.consequences).map(([sid, q]) => `${STAGE_LABEL[sid] ?? sid} ${q.kind} ${q.minutes} min · 0 t`)]}
        consequence={`${Math.round(ev.tonnes)} t attributed to this root — downstream idling is a consequence, not a separate loss`}
        action={ev.root === 'crush' ? 'Feed-rate interlock + oversize screening at the tip' : ev.root === 'face' ? 'Fragmentation feedback to drill & blast (B-114 pattern)' : 'Review weighbridge sequencing'}
        window={ev.root === 'crush' ? 'next planned window' : '48 h'} owner={ev.root === 'dispatch' ? 'Dispatch' : 'Production'} sla="48 h" />
      <Card density="working" title="Alerts inside this window">
        <div style={{ display: 'grid', gap: 6 }}>
          {alerts.length === 0 && <div className="dv3-support">No alert episodes in this window.</div>}
          {alerts.map(a => (
            <div key={a.key + a.firstT} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'baseline' }}>
              <span className="dv3-mono" style={{ color: 'var(--text-tertiary)' }}>{derived.fmt(Math.floor(a.firstT / 60))}</span>
              <span className="dv3-chip" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{a.useCase}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{a.msg}</span>
            </div>
          ))}
        </div>
      </Card>
      <Reading>Buffered minutes cost nothing; the loss began when the product stockpile ran out. Sum of nested consequences is 0 t by rule.</Reading>
    </div>
  )
}
