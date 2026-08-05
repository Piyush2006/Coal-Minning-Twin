// Operations dashboard — two screens: Coal Mining (mining machines) and Coal
// Processing (crushing → port). Every machine is clickable → a 3-logger
// drill-down (downtime · timeline · quality). A From/To date-time range picker
// scopes every KPI to the chosen window. Reuses the dv3 design system.
import { useState } from 'react'
import '../dashboardV3/tokens.css'
import { StatusPatternDefs } from '../dashboardV3/patterns'
import { Mining } from './Mining'
import { DrillDown } from './DrillDown'
import { DEFAULT_DAY } from './mockData'

const TABS = ['Coal Mining', 'Coal Processing']
const SHIFT_FROM = `${DEFAULT_DAY}T06:00`, SHIFT_TO = `${DEFAULT_DAY}T18:00`
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const minsOf = (dt) => { const t = (dt.split('T')[1] || '06:00').split(':'); return clamp(+t[0] * 60 + +t[1] - 360, 0, 720) } // rel to 06:00, clamped to the shift

export default function Dashboard() {
  const initial = window.location.hash.startsWith('#/coal-processing') ? 'Coal Processing' : 'Coal Mining'
  const [tab, setTab] = useState(initial)
  const [sel, setSel] = useState(null)
  const [from, setFrom] = useState(SHIFT_FROM)
  const [to, setTo] = useState(SHIFT_TO)

  const dayKey = from.split('T')[0]
  let winA = minsOf(from), winB = minsOf(to)
  if (winB <= winA) winB = Math.min(720, winA + 30)
  const full = winA === 0 && winB === 720

  return (
    <div className="dv3" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StatusPatternDefs />
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 22px', background: 'var(--surface)', boxShadow: 'var(--card-shadow)', position: 'sticky', top: 0, zIndex: 5, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: '-0.01em' }}>Blackridge · Operations</div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 9, padding: 3 }}>
          {TABS.map(t => {
            const active = t === tab
            return (
              <button key={t} onClick={() => { setTab(t); setSel(null) }}
                style={{ border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: active ? 650 : 500, fontFamily: 'var(--font-ui)',
                  background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', boxShadow: active ? 'var(--card-shadow)' : 'none' }}>{t}</button>
            )
          })}
        </div>
        <span style={{ flex: 1 }} />
        {/* date-time range picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dv3-tert" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</span>
          <DateTime value={from} onChange={setFrom} />
          <span className="dv3-tert" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</span>
          <DateTime value={to} onChange={setTo} />
          {!full && <button onClick={() => { setFrom(SHIFT_FROM); setTo(SHIFT_TO) }} className="dv3-btn dv3-btn--ghost" style={{ fontSize: 11.5, padding: '5px 9px' }}>full shift</button>}
        </div>
      </div>

      <main style={{ flex: 1, padding: '20px 24px 48px', overflowY: 'auto' }}>
        {tab === 'Coal Mining'
          ? <Mining onOpen={setSel} dayKey={dayKey} winA={winA} winB={winB} />
          : <Processing />}
      </main>

      {sel && <DrillDown m={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

function DateTime({ value, onChange }) {
  return (
    <input type="datetime-local" value={value} onChange={e => onChange(e.target.value)}
      style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-primary)', background: 'var(--surface-2)',
        border: '1px solid var(--hairline)', borderRadius: 8, padding: '5px 8px', outline: 'none', accentColor: 'var(--accent)' }} />
  )
}

// Coal Processing — built next (crushing → conveying → prep → stockyard → dispatch)
function Processing() {
  return (
    <div style={{ maxWidth: 900, margin: '40px auto 0' }}>
      <div className="dv3-card dv3-card--airy" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Coal Processing — next</div>
        <div className="dv3-support">The processing machines (CR-01 crusher → CV-01 conveyor → SC-01 / CHPP washery → SR-01 stockyard → TLO-01 / SL-01 dispatch), each with the same downtime · timeline · quality drill-down.</div>
      </div>
    </div>
  )
}
