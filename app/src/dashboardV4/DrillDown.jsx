// Machine drill-down — opens on a machine click. Three loggers, stacked:
//   1. Downtime logger   — every stop this shift (time · duration · reason)
//   2. Machine timeline  — the shift split into working / idle-on / idle-off / down
//   3. Quality           — rejection rate over the shift (rate of rejection)
import { useEffect } from 'react'
import { Card } from '../dashboardV3/ui'
import { STATE, fmt, SHIFT_MIN } from './mockData'
import { TimelineBar, StateLegend, RejectChart, StatusDot } from './parts'

const hm = (min) => { const h = Math.floor(min / 60), m = Math.round(min) % 60; return h ? `${h}h ${m}m` : `${m}m` }

export function DrillDown({ m, onClose }) {
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [onClose])

  const acceptedPct = m.units.count ? Math.round((m.units.accepted / m.units.count) * 100) : 100

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.30)', zIndex: 40, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="dv3" style={{ width: 560, maxWidth: '94vw', height: '100%', overflowY: 'auto', background: 'var(--canvas)', boxShadow: '-14px 0 44px rgba(16,24,40,0.20)' }} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div style={{ position: 'sticky', top: 0, background: 'var(--surface)', boxShadow: 'var(--card-shadow)', padding: '14px 20px', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusDot state={m.status} size={11} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>{m.id}</div>
            <div className="dv3-tert" style={{ fontSize: 12 }}>{m.type} · {STATE[m.status].label}</div>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ textAlign: 'right', marginRight: 6 }}>
            <div className="dv3-mono" style={{ fontSize: 18, fontWeight: 700 }}>{m.util}%</div>
            <div className="dv3-tert" style={{ fontSize: 10.5 }}>utilisation</div>
          </div>
          <button className="dv3-btn dv3-btn--ghost" onClick={onClose} style={{ padding: '6px 10px' }}>Esc ✕</button>
        </div>

        <div style={{ padding: '18px 20px 40px', display: 'grid', gap: 16 }}>
          {/* 1 · Downtime logger */}
          <Card title="Downtime logger" density="working"
            right={<span className="dv3-mono" style={{ fontSize: 13, fontWeight: 700, color: m.downtimeMin ? 'var(--st-down-u)' : 'var(--st-operating)' }}>{hm(m.downtimeMin)} · {m.downEvents.length} stop{m.downEvents.length === 1 ? '' : 's'}</span>}>
            {m.downEvents.length === 0
              ? <div className="dv3-support">No downtime this shift — ran clean.</div>
              : (
                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '128px 62px 1fr', fontSize: 10.5, color: 'var(--text-tertiary)', padding: '0 8px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span>Window</span><span>Duration</span><span>Reason</span>
                  </div>
                  {m.downEvents.map((e, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '128px 62px 1fr', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 7, background: i % 2 ? 'transparent' : 'var(--surface-2)', fontSize: 12.5 }}>
                      <span className="dv3-mono">{fmt(e.start)}–{fmt(e.end)}</span>
                      <span className="dv3-mono" style={{ fontWeight: 700, color: 'var(--st-down-u)' }}>{hm(e.dur)}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{e.reason}</span>
                    </div>
                  ))}
                </div>
              )}
          </Card>

          {/* 2 · Machine timeline */}
          <Card title="Machine timeline" density="working"
            right={<span className="dv3-support" style={{ fontSize: 11 }}>{fmt(m.winStart)}–{fmt(m.winEnd)}</span>}>
            <TimelineBar runs={m.runs} height={30} ticks rounded from={m.winStart} to={m.winEnd} />
            <StateLegend totals={m.totals} />
          </Card>

          {/* 3 · Quality — rejection rate */}
          <Card title="Quality · rate of rejection" density="working"
            right={<span className="dv3-mono" style={{ fontSize: 13, fontWeight: 700, color: m.rejAvg > 8 ? 'var(--st-down-u)' : m.rejAvg > 5 ? 'var(--st-idle-j)' : 'var(--st-operating)' }}>{m.rejAvg}% avg</span>}>
            <RejectChart series={m.rejSeries} target={8} from={m.winStart} to={m.winEnd} />
            <div style={{ display: 'flex', gap: 22, marginTop: 8, flexWrap: 'wrap' }}>
              <Stat label={`Accepted (${m.unit})`} v={m.units.accepted.toLocaleString()} col="var(--st-operating)" sub={`${acceptedPct}%`} />
              <Stat label={`Rejected (${m.unit})`} v={m.units.rejected.toLocaleString()} col="var(--st-down-u)" sub={`${m.rejAvg}%`} />
              <Stat label="This shift" v={m.units.count.toLocaleString()} col="var(--text-primary)" sub={m.unit} />
            </div>
            <div className="dv3-tert" style={{ fontSize: 11.5, marginTop: 8 }}>{m.rejLabel}. Bars over the {8}% target are flagged amber.</div>
          </Card>
        </div>
      </div>
    </div>
  )
}

const Stat = ({ label, v, col, sub }) => (
  <div>
    <div className="dv3-tert" style={{ fontSize: 10.5 }}>{label}</div>
    <div className="dv3-mono" style={{ fontWeight: 700, fontSize: 16, color: col }}>{v} <span className="dv3-tert" style={{ fontSize: 10.5, fontWeight: 400 }}>{sub}</span></div>
  </div>
)
