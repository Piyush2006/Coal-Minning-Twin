// Screen 2 — Fleet & Cycle. The what-if allocation control promoted to full
// size (T5). Transparent Match-Factor arithmetic: move trucks between the coal
// and OB circuits and watch MF, shovel hang, truck queue and projected tonnes
// recompute, with the current allocation shown as a ghost so the delta is
// visible. Reuses the Gantt (truck rows) and MiniSeries.
import { useMemo, useState } from 'react'
import { Card, Thesis, Sparkline } from '../ui'
import { ScreenFrame } from '../chrome'
import { MiniSeries } from '../viz'
import { Gantt } from '../screen0/Gantt'
import { deriveGantt } from '../screen0/derive'
import { YIELD } from '../data/chainSim'

// planning model (ROM basis). Load time derives from each shovel's dig ceiling,
// so the coal ceiling (750 ROM t/h) reconciles with the chain's face cap
// (585 pe = 750/0.78). The teaching point: both circuits are over-trucked — the
// constraint is dig rate at the face, not the number of trucks.
const P = 190                     // avg payload, ROM t
const Tt = 21 / 60                // fixed travel (spot+haul+dump+return), h
const CEIL = { coal: 750, ob: 900 }
const CURRENT = { coal: 5, ob: 3 }

function circuit(kind, n) {
  const ceil = CEIL[kind]
  const Lt = P / ceil                       // load time, h
  const cycle = Tt + Lt
  const deliver = n > 0 ? (n * P) / cycle : 0
  const tph = Math.min(ceil, deliver)
  const MF = (n * Lt) / cycle               // = deliver / ceil
  const hang = Math.max(0, 1 - MF)          // shovel idle fraction
  const queue = MF > 1 ? 1 - 1 / MF : 0     // truck waiting fraction
  return { kind, n, ceil, Lt, cycle, tph, MF, hang, queue, saleable: kind === 'coal' ? tph * YIELD : 0 }
}

export default function Screen2() {
  return <ScreenFrame title="Fleet & Cycle" renderMain={(ctx) => <FleetMain {...ctx} />} />
}

function FleetMain({ fx, derived, m }) {
  const [nCoal, setNCoal] = useState(CURRENT.coal)
  const nOB = 8 - nCoal
  const what = { coal: circuit('coal', nCoal), ob: circuit('ob', nOB) }
  const cur = { coal: circuit('coal', CURRENT.coal), ob: circuit('ob', CURRENT.ob) }

  const fullGantt = useMemo(() => deriveGantt(fx), [fx])
  // fleet utilisation series (fraction of trucks running per minute)
  const util = useMemo(() => {
    const arr = []
    for (let mm = 0; mm < derived.N; mm += 2) {
      const snap = fx.snapshot(derived.t0 + mm * 60000)
      let run = 0, tot = 0
      for (let i = 1; i <= 8; i++) { const s = snap[`truck-${i}`]; if (!s) continue; tot++; if (s.status === 'running') run++ }
      arr.push(tot ? (run / tot) * 100 : 0)
    }
    return arr
  }, [fx, derived])

  const dSaleable = Math.round((what.coal.saleable - cur.coal.saleable) * 8)
  const dOB = Math.round((what.ob.tph - cur.ob.tph) * 8)

  // headroom: coal trucks removable with saleable coal unchanged (the primary output)
  let minKeep = CURRENT.coal
  for (let n = CURRENT.coal; n >= 1; n--) { if (circuit('coal', n).saleable >= cur.coal.saleable - 0.5) minKeep = n; else break }
  const headroom = CURRENT.coal - minKeep

  return (
    <>
      <Thesis>
        The coal circuit is over-trucked — {headroom} truck{headroom === 1 ? '' : 's'} can move to overburden at zero coal cost. The constraint is dig rate at the face, not the number of trucks.
      </Thesis>
      <Card title="Fleet allocation — what-if" density="airy"
        right={<span className="dv3-support" style={{ fontSize: 11 }}>planning model · ROM basis · ghost = current 5 / 3</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <CircuitPanel c={what.coal} ghost={cur.coal} title="Coal circuit · EX-02" onInc={() => setNCoal(v => Math.min(7, v + 1))} onDec={() => setNCoal(v => Math.max(1, v - 1))} accent="#2B5CE7" />
          <CircuitPanel c={what.ob} ghost={cur.ob} title="OB circuit · EX-01" onInc={() => setNCoal(v => Math.max(1, v - 1))} onDec={() => setNCoal(v => Math.min(7, v + 1))} accent="#7B5EA7" invert />
        </div>
        {/* primary output: headroom */}
        <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 17, fontWeight: 650, color: 'var(--text-primary)' }}>
            {headroom > 0
              ? <><span style={{ color: 'var(--accent)' }}>{headroom} coal truck{headroom === 1 ? '' : 's'}</span> can move to OB at zero coal cost</>
              : <>No coal headroom — moving a truck now costs saleable tonnes</>}
          </div>
          <button className="dv3-btn dv3-btn--ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setNCoal(CURRENT.coal)}>reset to current</button>
        </div>
        {/* secondary: the delta of the current what-if setting */}
        <div style={{ display: 'flex', gap: 20, marginTop: 6, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 12.5 }}>
          <span className="dv3-tert">this setting vs current:</span>
          <span><b style={{ color: dSaleable < 0 ? 'var(--st-down-u)' : dSaleable > 0 ? 'var(--st-operating)' : 'var(--text-secondary)' }}>{dSaleable >= 0 ? '+' : ''}{dSaleable.toLocaleString()} t</b> <span className="dv3-tert">coal</span></span>
          <span><b style={{ color: dOB > 0 ? 'var(--st-operating)' : dOB < 0 ? 'var(--st-down-u)' : 'var(--text-secondary)' }}>{dOB >= 0 ? '+' : ''}{dOB.toLocaleString()} t</b> <span className="dv3-tert">overburden</span></span>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginTop: 16 }}>
        <Card title="Fleet utilisation over shift" density="working">
          {(() => {
            const shown = util.slice(0, Math.max(2, Math.floor((m / derived.N) * util.length)))
            const nowPct = Math.round(shown[shown.length - 1] ?? 0)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div><div className="dv3-hero dv3-hero--md">{nowPct}%</div><div className="dv3-tert" style={{ fontSize: 10.5 }}>trucks running</div></div>
                <Sparkline points={shown.length ? shown : [0]} w={220} h={40} color="var(--series-1)" />
              </div>
            )
          })()}
        </Card>
        <Card title="Cycle decomposition" density="working">
          <CycleBars />
        </Card>
      </div>

      <Card title="Equipment state timeline" density="working" style={{ marginTop: 16 }}>
        <Gantt rows={fullGantt} derived={derived} m={m} width={1020} />
      </Card>
    </>
  )
}

function CircuitPanel({ c, ghost, title, onInc, onDec, accent, invert }) {
  const mfCol = c.MF > 1.15 ? '#E0A32E' : c.MF < 0.85 ? '#E04B4B' : '#12A16E'
  return (
    <div style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 650, fontSize: 14 }}>{title}</div>
        <span style={{ flex: 1 }} />
        <button className="dv3-btn dv3-btn--ghost" style={{ padding: '2px 11px', fontSize: 16, lineHeight: 1 }} onClick={onDec}>−</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="dv3-mono" style={{ fontSize: 26, fontWeight: 700, color: accent }}>{c.n}</span>
          {ghost.n !== c.n && <span className="dv3-mono dv3-tert" style={{ fontSize: 12 }}>was {ghost.n}</span>}
        </div>
        <button className="dv3-btn dv3-btn--ghost" style={{ padding: '2px 10px', fontSize: 16, lineHeight: 1 }} onClick={onInc}>+</button>
        <span className="dv3-tert" style={{ fontSize: 11 }}>trucks</span>
      </div>
      {/* MF gauge */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 3 }}>
          <span>Match Factor</span><span className="dv3-mono" style={{ color: mfCol, fontWeight: 700 }}>{c.MF.toFixed(2)}</span>
        </div>
        <div className="dv3-well" style={{ height: 9, borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: `${(1 / 2) * 100}%`, top: 0, bottom: 0, width: 2, background: 'var(--text-tertiary)', opacity: 0.5 }} />
          <div style={{ width: `${Math.min(100, (c.MF / 2) * 100)}%`, height: '100%', background: mfCol, borderRadius: 5 }} />
          {ghost.MF !== c.MF && <div style={{ position: 'absolute', left: `${Math.min(100, (ghost.MF / 2) * 100)}%`, top: -1, bottom: -1, width: 2, background: 'var(--text-primary)', opacity: 0.35 }} />}
        </div>
        <div className="dv3-tert" style={{ fontSize: 10, marginTop: 2 }}>1.0 = matched · &lt;1 shovel waits · &gt;1 trucks queue</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
        <Stat label="Throughput" v={`${Math.round(c.tph)} t/h`} sub={`ceil ${c.ceil}`} />
        <Stat label={c.kind === 'coal' ? 'Saleable coal' : 'OB moved'} v={`${Math.round((c.kind === 'coal' ? c.saleable : c.tph) * 8).toLocaleString()} t`} sub="8 h shift" />
        <Stat label="Shovel hang" v={`${Math.round(c.hang * 100)}%`} sub="idle waiting" warn={c.hang > 0.1} />
        <Stat label="Truck queue" v={`${Math.round(c.queue * 100)}%`} sub="waiting to load" warn={c.queue > 0.25} />
      </div>
    </div>
  )
}

const Stat = ({ label, v, sub, warn }) => (
  <div>
    <div style={{ color: 'var(--text-tertiary)', fontSize: 10.5 }}>{label}</div>
    <div className="dv3-mono" style={{ fontWeight: 700, color: warn ? '#B0721A' : 'var(--text-primary)' }}>{v} <span className="dv3-tert" style={{ fontWeight: 400, fontSize: 10 }}>{sub}</span></div>
  </div>
)

// static cycle decomposition (planning constants), coal vs OB
function CycleBars() {
  const SEG = [['spot', 1.8, '#9FB4D8'], ['load', 4.0, '#2B5CE7'], ['haul', 9.5, '#12A594'], ['dump', 2.2, '#E5871F'], ['queue', 8.7, '#E04B4B']]
  const rows = [['Coal', SEG], ['OB', [['spot', 1.8, '#9FB4D8'], ['load', 3.6, '#2B5CE7'], ['haul', 8.4, '#12A594'], ['dump', 2.0, '#E5871F'], ['queue', 6.9, '#E04B4B']]]]
  const total = (segs) => segs.reduce((a, s) => a + s[1], 0)
  const W = 380
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {rows.map(([name, segs]) => {
        const tot = total(segs)
        let x = 0
        return (
          <div key={name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>{name} circuit</span><span className="dv3-mono dv3-tert">{tot.toFixed(1)} min cycle</span>
            </div>
            <svg width={W} height={20} viewBox={`0 0 ${W} 20`} style={{ width: '100%' }}>
              {segs.map(([lbl, v, col], i) => {
                const w = (v / tot) * W
                const el = <g key={i}><rect x={x} y={0} width={w - 1} height={20} rx={2} fill={col} opacity="0.88" />{w > 34 && <text x={x + w / 2} y={13} fontSize="9" fill="#fff" textAnchor="middle" fontWeight="600">{lbl}</text>}</g>
                x += w
                return el
              })}
            </svg>
          </div>
        )
      })}
    </div>
  )
}
