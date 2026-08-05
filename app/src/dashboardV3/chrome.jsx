// Shared dashboard chrome — extracted from Screen 0 so every screen is just its
// own main content. TopBar (screen switcher + global scrubber), NavRail (twin
// navigator), ActionRail (policy-filtered alerts). The scrub store is a module
// singleton, so scrub time carries across screens for free.
import { useEffect, useMemo, useState } from 'react'
import './tokens.css'
import { StatusPatternDefs } from './patterns'
import { Card, AlertCard } from './ui'
import { useScrub, useFixtures, ensureFixtures, startReplayDriver, SHIFT_MIN } from './screen0/store'
import { deriveShift, NAV_TREE } from './screen0/derive'
import { dedupeEpisodes, presentAlertMsg } from './data/alertPolicy'

export const STATUS_DOT = { running: '#12A16E', idle: '#E0A32E', fault: '#E04B4B', off: '#DCE1E9' }
export const OWNER = {
  Proximity: ['Shift In-charge', 'now'], 'Worker Safety': ['Safety Officer', 'now'], Geofence: ['Safety Officer', '4 h'],
  TPMS: ['Dispatch', '4 h'], Haulage: ['Dispatch', '2 h'], 'HEMM PdM': ['Reliability', '48 h'],
  'Vibration CBM': ['Reliability', '7 d'], 'Conveyor Vision': ['CHP Control', '2 h'], 'CHP SEC': ['Energy', '7 d'], 'Dust & Env': ['Environment', '1 h'],
}
export const sevOf = (e) => (e.sev === 'critical' ? (e.useCase === 'Proximity' || e.useCase === 'Worker Safety' ? 'P1' : 'P2') : e.sev === 'warn' ? 'P3' : 'P4')

// short asset tag so two different trucks with the same rule don't read as a
// duplicate card (e.g. HT-01 vs HT-02 both idling)
const ASSET_TAG = { 'truck-1': 'HT-01', 'truck-2': 'HT-02', 'truck-3': 'HT-03', 'truck-4': 'HT-04', 'truck-5': 'HT-05', 'truck-6': 'HT-06', 'truck-7': 'HT-07', 'truck-8': 'HT-08', 'crusher-1': 'CR-01', 'cv-01': 'CV-01', 'exc-coal-1': 'EX-02', 'exc-ob-1': 'EX-01', 'chpp-1': 'CHPP', 'screen-1': 'SC-01', 'safety-1': 'Site' }
const assetTag = (id) => ASSET_TAG[id] ?? id?.replace(/-/g, '').toUpperCase() ?? ''

// screen switcher — Report (Screen 8) intentionally absent
const SCREENS = [
  ['#/mine-pulse', 'Pulse'], ['#/production', 'Flow'], ['#/fleet', 'Fleet'],
  ['#/plant', 'Plant'], ['#/health', 'Health'], ['#/energy', 'Energy'], ['#/safety', 'Safety'],
]

/* ── screen frame: loads fixtures, drives replay, wraps chrome around main ──
   renderMain receives { fx, derived, m }. Screens never touch the chrome. */
export function ScreenFrame({ title, hideNav, hideActions, renderMain }) {
  const { fx, error } = useFixtures()
  useEffect(() => { ensureFixtures(); return startReplayDriver() }, [])
  const tMin = useScrub(s => s.tMin)
  const m = Math.floor(tMin)
  const derived = useMemo(() => (fx ? deriveShift(fx) : null), [fx])

  if (error) return <Shell><Card title="Fixture failed to load"><div className="dv3-support">{String(error)}</div></Card></Shell>
  if (!fx || !derived) return <Shell><Card title={title}><div className="dv3-support">Loading golden shift…</div></Card></Shell>

  return (
    <div className="dv3" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StatusPatternDefs />
      <TopBar title={title} derived={derived} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {!hideNav && <NavRail fx={fx} m={m} derived={derived} />}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', minWidth: 0 }}>
          {renderMain({ fx, derived, m })}
        </main>
        {!hideActions && <ActionRail derived={derived} m={m} />}
      </div>
    </div>
  )
}

const Shell = ({ children }) => <div className="dv3" style={{ minHeight: '100vh', padding: 32 }}>{children}</div>

export function TopBar({ title = 'Mine Pulse', derived }) {
  const { tMin, playing, speed, setT, setPlaying, setSpeed, live } = useScrub()
  const hash = window.location.hash || '#/mine-pulse'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', background: 'var(--surface)', boxShadow: 'var(--card-shadow)', zIndex: 5 }}>
      <div style={{ fontWeight: 650, fontSize: 15, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Blackridge</div>
      {/* screen switcher */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 9, padding: 2 }}>
        {SCREENS.map(([href, label]) => {
          const active = hash.startsWith(href) || (href === '#/mine-pulse' && hash.startsWith('#/dashboard'))
          return (
            <a key={href} href={href} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 12.5, textDecoration: 'none', fontWeight: active ? 650 : 500,
              background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', boxShadow: active ? 'var(--card-shadow)' : 'none' }}>{label}</a>
          )
        })}
      </div>
      <span style={{ flex: 0.04 }} />
      <button className="dv3-btn dv3-btn--ghost" style={{ padding: '5px 11px', fontSize: 14 }} onClick={() => setPlaying(!playing)} disabled={live}>{playing ? '❚❚' : '▶'}</button>
      <input type="range" min={0} max={SHIFT_MIN} step={0.5} value={tMin} onChange={e => setT(+e.target.value)} disabled={live}
        style={{ flex: 1, accentColor: 'var(--accent)', opacity: live ? 0.4 : 1 }} aria-label="shift time scrubber" />
      <span className="dv3-mono" style={{ fontSize: 13, fontWeight: 700, width: 44 }}>{derived.fmt(Math.floor(tMin))}</span>
      <Segmented options={['60×', '120×', '240×']} value={`${speed}×`} onChange={v => setSpeed(parseInt(v))} />
      <ModeToggle />
    </div>
  )
}

// REPLAY / LIVE toggle. Live is wired once plane unification lands; until then
// the pill shows the current mode and Live is the disabled affordance.
function ModeToggle() {
  const live = useScrub(s => s.live)
  const setLive = useScrub(s => s.setLive)
  const liveReady = useScrub(s => s.liveReady)
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 2 }}>
      <button onClick={() => setLive(false)} className="dv3-chip" style={{ border: 'none', cursor: 'pointer', fontWeight: 700,
        background: !live ? 'var(--accent-soft)' : 'transparent', color: !live ? 'var(--accent)' : 'var(--text-tertiary)' }}>REPLAY</button>
      <button onClick={() => liveReady && setLive(true)} disabled={!liveReady} title={liveReady ? 'Live plane' : 'Live binding lands with plane unification'}
        className="dv3-chip" style={{ border: 'none', cursor: liveReady ? 'pointer' : 'not-allowed', fontWeight: 700,
        background: live ? 'var(--accent-soft)' : 'transparent', color: live ? 'var(--accent)' : 'var(--text-tertiary)' }}>LIVE{liveReady ? '' : ' ·soon'}</button>
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 2 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{ border: 'none', cursor: 'pointer', padding: '4px 9px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)',
          background: o === value ? 'var(--surface)' : 'transparent', color: o === value ? 'var(--text-primary)' : 'var(--text-tertiary)', boxShadow: o === value ? 'var(--card-shadow)' : 'none' }}>{o}</button>
      ))}
    </div>
  )
}

export function NavRail({ fx, m, derived }) {
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

export function ActionRail({ derived, m }) {
  const eps = useMemo(() => dedupeEpisodes(derived.episodes(m)).sort((a, b) => b.firstT - a.firstT), [derived, m])
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
            <AlertCard key={e.key + e.firstT} compact severity={sevOf(e)}
              asset={`${derived.fmt(Math.floor(e.firstT / 60))} · ${assetTag(e.objId)}${e.count > 1 ? `  ×${e.count}` : ''}`}
              hypothesis={presentAlertMsg(e.msg)} owner={owner} sla={sla} />
          )
        })}
      </div>
    </aside>
  )
}
