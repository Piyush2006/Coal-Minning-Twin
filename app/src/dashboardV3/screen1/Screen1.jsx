// Screen 1 — Production Flow & Constraint. The chain strip promoted to full
// hero, plus the 2D pit view. Assembly of existing pieces: ScreenFrame chrome,
// the fixture/derive layer, the arbitration buckets, plus two new shared viz
// primitives (ProcessChain, SiteMap). Every card carries a Reading.
import { useMemo } from 'react'
import { Card, Thesis } from '../ui'
import { ScreenFrame } from '../chrome'
import { SiteMap, MiniSeries } from '../viz'
import { YIELD, RATED } from '../data/chainSim'
import { BUCKET_LABEL, STAGE_LABEL } from '../screen0/derive'
import { BUCKETS } from '../data/arbitration'
import { ProcessChain } from './ProcessChain'

export default function Screen1() {
  return <ScreenFrame title="Production Flow" renderMain={(ctx) => <FlowMain {...ctx} />} />
}

const STAGE_SM = [
  { id: 'face', col: (rom) => rom * YIELD, label: 'Face / Loading' },
  { id: 'haul', col: (rom) => rom * YIELD, label: 'Haulage' },
  { id: 'crush', col: null, label: 'Crushing CR-01' },
  { id: 'chp', col: null, label: 'CHP' },
  { id: 'dispatch', col: null, label: 'Dispatch' },
]

function FlowMain({ fx, derived, m }) {
  // precompute per-stage product-equiv series once
  const series = useMemo(() => {
    const romS = fx.series('_chain·romTph', derived.t0, derived.t0 + derived.N * 60000, derived.N)
    const prodS = fx.series('_chain·productTph', derived.t0, derived.t0 + derived.N * 60000, derived.N)
    const dispS = fx.series('_chain·dispatchedTph', derived.t0, derived.t0 + derived.N * 60000, derived.N)
    const rom = romS.map(p => p[1] * YIELD)
    const prod = prodS.map(p => p[1]), disp = dispS.map(p => p[1])
    return { face: rom.map(v => Math.min(v, RATED.face)), haul: rom.map(v => Math.min(v, RATED.haul)), crush: prod, chp: prod, dispatch: disp }
  }, [fx, derived])

  const snap = derived.atMinute(m)
  const bindingRoot = derived.rootAtMin[Math.min(m, derived.N - 1)]

  const bound = bindingRoot && bindingRoot !== '·residual' && bindingRoot !== '·external'
  return (
    <>
      <Thesis>
        {bound
          ? <>{STAGE_LABEL[bindingRoot] ?? bindingRoot} is the binding constraint at {derived.fmt(m)} — the chain moves at its rate, and everything downstream of it is starved by construction.</>
          : <>Chain running at reference rate at {derived.fmt(m)} — no single stage is holding the line back.</>}
      </Thesis>
      <Card title={`Production chain — live at ${derived.fmt(m)}`} density="airy">
        <ProcessChain fx={fx} derived={derived} m={m} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, marginTop: 16 }}>
        <Card title="Stage throughput vs capability" density="working">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            {STAGE_SM.map(s => (
              <div key={s.id}>
                <MiniSeries series={series[s.id]} cap={RATED[s.id]} m={m} N={derived.N} label={s.label}
                  color={bindingRoot === s.id ? '#E5871F' : 'var(--series-1)'} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Where the tonnes went — cumulative loss">
          <LossArea derived={derived} m={m} />
        </Card>
      </div>

      <SiteViewCard fx={fx} derived={derived} m={m} />
    </>
  )
}

/* site view — the 2D cartographic plan (SiteMap). Markers carry live status;
   CR-01's core turns red at the choke. Screen 6 uses the same map as its base. */
function SiteViewCard({ fx, derived, m }) {
  return (
    <Card title="Pit-to-port site view" density="working" style={{ marginTop: 16 }}>
      <SiteMap fx={fx} derived={derived} m={m} height={320} />
    </Card>
  )
}

/* cumulative loss stacked area from derive.cumBuckets */
function LossArea({ derived, m }) {
  const W = 380, H = 190, pad = 6
  const order = ['crushing', 'faceLoading', 'dispatch', 'external', 'residual']
  const COL = { crushing: '#E5871F', faceLoading: '#12A594', dispatch: '#7B5EA7', external: '#9AA4B4', residual: '#C6CDD8' }
  const maxLoss = order.reduce((a, b) => a + (derived.cumBuckets[b]?.[derived.N] ?? 0), 0) * 1.05 || 1
  const x = (mm) => pad + (mm / derived.N) * (W - 2 * pad)
  const y = (v) => H - 16 - (v / maxLoss) * (H - 24)
  // build stacked polygons up to m
  const step = 3
  const layers = []
  let baseArr = new Float64Array(derived.N + 1)
  for (const b of order) {
    const top = new Float64Array(derived.N + 1)
    for (let i = 0; i <= derived.N; i++) top[i] = baseArr[i] + (derived.cumBuckets[b]?.[i] ?? 0)
    const pts = []
    for (let i = 0; i <= m; i += step) pts.push(`${x(i)},${y(top[i])}`)
    pts.push(`${x(m)},${y(top[m])}`)
    for (let i = m; i >= 0; i -= step) pts.push(`${x(i)},${y(baseArr[i])}`)
    layers.push({ b, pts: pts.join(' ') })
    baseArr = top
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={pad} x2={W - pad} y1={y(maxLoss * f)} y2={y(maxLoss * f)} stroke="#EDF0F5" />)}
      {layers.map(l => <polygon key={l.b} points={l.pts} fill={COL[l.b]} opacity="0.85" />)}
      <line x1={x(m)} y1={4} x2={x(m)} y2={H - 16} stroke="var(--text-primary)" strokeWidth="1" />
      {[0, 120, 240, 360, 480].map(t => <text key={t} x={x(t)} y={H - 3} fontSize="9" textAnchor={t === 0 ? 'start' : t === 480 ? 'end' : 'middle'} fill="var(--text-tertiary)">{derived.fmt(t)}</text>)}
      <text x={pad + 2} y={12} fontSize="9.5" fill="var(--text-tertiary)">cumulative loss · {Math.round(order.reduce((a, b) => a + (derived.cumBuckets[b]?.[m] ?? 0), 0))} t to now</text>
    </svg>
  )
}
