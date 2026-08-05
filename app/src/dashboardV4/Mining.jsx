// Coal Mining screen — every machine in the mining process (drilling, digging,
// hauling) as a clickable card. Click → 3-logger drill-down.
import { useMemo } from 'react'
import { miningMachines, scope, STATE, SHIFT_MIN } from './mockData'
import { TimelineBar, StatusDot } from './parts'

const hm = (min) => { const h = Math.floor(min / 60), m = Math.round(min) % 60; return h ? `${h}h ${m}m` : `${m}m` }
const utilColor = (u) => (u >= 70 ? 'var(--st-operating)' : u >= 55 ? 'var(--st-idle-j)' : 'var(--st-down-u)')

function MachineCard({ m, onOpen }) {
  return (
    <button onClick={() => onOpen(m)}
      className="dv3-card dv3-card--working" style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--hairline)', display: 'grid', gap: 8, transition: 'box-shadow 120ms, transform 120ms' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,24,40,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <StatusDot state={m.status} size={10} />
        <div style={{ minWidth: 0 }}>
          <div className="dv3-mono" style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>{m.id}</div>
          <div className="dv3-tert" style={{ fontSize: 11 }}>{m.type}</div>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div className="dv3-mono" style={{ fontSize: 17, fontWeight: 700, color: utilColor(m.util), lineHeight: 1 }}>{m.util}%</div>
          <div className="dv3-tert" style={{ fontSize: 9.5 }}>utilisation</div>
        </div>
      </div>
      <TimelineBar runs={m.runs} height={9} from={m.winStart} to={m.winEnd} />
      <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
        <span>Down <b className="dv3-mono" style={{ color: m.downtimeMin ? 'var(--st-down-u)' : 'var(--st-operating)' }}>{hm(m.downtimeMin)}</b></span>
        <span>Reject <b className="dv3-mono" style={{ color: m.rejAvg > 8 ? 'var(--st-down-u)' : 'var(--text-primary)' }}>{m.rejAvg}%</b></span>
        <span className="dv3-tert">{m.avail}% avail</span>
      </div>
    </button>
  )
}

export function Mining({ onOpen, dayKey, winA, winB }) {
  const groups = useMemo(() => {
    const raw = miningMachines(dayKey)
    return raw.map(g => ({ group: g.group, rows: g.rows.map(m => scope(m, winA, winB)) }))
  }, [dayKey, winA, winB])
  // fleet roll-up
  const all = groups.flatMap(g => g.rows)
  const avgUtil = Math.round(all.reduce((a, m) => a + m.util, 0) / all.length)
  const downNow = all.filter(m => m.status === 'down').length
  const totalDownMin = all.reduce((a, m) => a + m.downtimeMin, 0)

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 550, color: 'var(--text-primary)' }}>
          {all.length} mining machines · fleet utilisation <b>{avgUtil}%</b> · {downNow} down now · {Math.round(totalDownMin / 60)} h total downtime this shift.
        </div>
        <span className="dv3-support" style={{ fontSize: 12 }}>click any machine for its downtime, timeline & quality</span>
      </div>

      {groups.map(g => (
        <section key={g.group} style={{ marginBottom: 22 }}>
          <div className="dv3-cardhead" style={{ marginBottom: 10 }}>{g.group} · {g.rows.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: 14 }}>
            {g.rows.map(m => <MachineCard key={m.id} m={m} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
