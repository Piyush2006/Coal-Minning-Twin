// Screen 3 — Fixed Plant. The crushing/conveying/CHP train: a simplified P&ID
// with live values, the CV-01 conveyor strip with empty-run shading, and the
// crusher feed-stability control chart with the choke marked. Assembly of the
// ControlChart primitive + fixture reads. Every card carries a Reading.
import { useMemo } from 'react'
import { Card, Reading, Thesis, SensorValue } from '../ui'
import { ScreenFrame } from '../chrome'
import { ControlChart } from '../viz'
import { dedupeEpisodes, presentAlertMsg } from '../data/alertPolicy'
import { useScrub } from '../screen0/store'

export default function Screen3() {
  return <ScreenFrame title="Fixed Plant" renderMain={(ctx) => <PlantMain {...ctx} />} />
}

const PID = [
  { id: 'crusher-1', label: 'CR-01', sub: 'Primary crusher', param: 'throughput', unit: 't/h', design: 1200 },
  { id: 'cv-01', label: 'CV-01', sub: 'Overland conveyor', param: 'load', unit: '%', design: 100 },
  { id: 'screen-1', label: 'SC-01', sub: 'Vibrating screen', param: 'feedRate', unit: 't/h', design: 900 },
  { id: 'chpp-1', label: 'CHPP', sub: 'DMC module', param: 'feedRate', unit: 't/h', design: 850 },
  { id: 'stacker-1', label: 'SR-01', sub: 'Stacker-reclaimer', param: 'stackRate', unit: 't/h', design: 1000 },
]
const STCOL = { running: '#12A16E', idle: '#E0A32E', fault: '#E04B4B', off: '#C6CDD8' }

function PlantMain({ fx, derived, m }) {
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])
  const throS = useMemo(() => fx.series('crusher-1·throughput', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const oversizeS = useMemo(() => fx.series('screen-1·oversizeRate', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const loadS = useMemo(() => fx.series('cv-01·load', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const speedS = useMemo(() => fx.series('cv-01·lineSpeed', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const tempS = useMemo(() => fx.series('cv-01·motorTemp', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const choke = derived.chainEvents.find(e => e.stage === 'crush' && e.state === 'down')
  const chokeFrom = choke ? Math.floor(choke.start / derived.N * throS.length) : null
  const chokeTo = choke ? Math.floor((choke.end + 22) / derived.N * throS.length) : null
  const camEps = useMemo(() => dedupeEpisodes(derived.episodes(m).filter(e => e.useCase === 'Conveyor Vision')), [derived, m])

  const crFault = snap['crusher-1']?.status === 'fault'
  return (
    <>
      <Thesis>
        {crFault
          ? <>CR-01 is down at {derived.fmt(m)} and the whole CHP train has starved behind it — the plant is feed-limited, not plant-limited.</>
          : <>The CHP train is running to feed at {derived.fmt(m)} — every stage moves only as fast as CR-01 feeds it, so the plant is feed-limited, not plant-limited.</>}
      </Thesis>
      <Card title={`CHP train — live at ${derived.fmt(m)}`} density="airy">
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox="0 0 1000 130" width="100%" style={{ display: 'block', minWidth: 720 }}>
            {PID.map((n, i) => {
              const x = i * 200 + 10
              const st = snap[n.id]?.status ?? 'running'
              const val = snap[n.id]?.parameters?.[n.param]
              const util = val != null ? Math.min(1, val / n.design) : 0
              return (
                <g key={n.id}>
                  {i < PID.length - 1 && <line x1={x + 170} y1={62} x2={x + 200 + 10} y2={62} stroke={st === 'idle' || st === 'fault' ? '#E0A32E' : '#9FB4D8'} strokeWidth={3} />}
                  <rect x={x} y={30} width={170} height={66} rx={9} fill="var(--surface)" stroke={st === 'fault' ? '#E04B4B' : st === 'idle' ? '#E0A32E' : 'var(--hairline)'} strokeWidth={st === 'fault' ? 2.4 : 1.2} />
                  <circle cx={x + 14} cy={44} r={4} fill={STCOL[st]} />
                  <text x={x + 26} y={48} fontSize="12.5" fontWeight="700" fill="var(--text-primary)">{n.label}</text>
                  <text x={x + 12} y={64} fontSize="9" fill="var(--text-tertiary)">{n.sub}</text>
                  <text x={x + 12} y={84} fontSize="14" fontWeight="700" fontFamily="var(--font-mono)" fill="var(--text-primary)">{val != null ? Math.round(val) : '—'}<tspan fontSize="9" fill="var(--text-tertiary)" fontWeight="400"> {n.unit}</tspan></text>
                  <rect x={x + 90} y={76} width={70} height={5} rx={2} fill="var(--surface-2)" /><rect x={x + 90} y={76} width={70 * util} height={5} rx={2} fill={STCOL[st]} />
                </g>
              )
            })}
          </svg>
        </div>
        <Reading more="The pit-to-CHP train left to right with live throughput against design. When CR-01 faults, the amber links show the starvation propagating downstream.">Amber links show starvation propagating downstream</Reading>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 16, marginTop: 16 }}>
        <Card title="CR-01 feed stability — control chart" density="working">
          <ControlChart series={throS} m={m} N={derived.N} k={2} unit=" t/h" markFrom={chokeFrom} markTo={chokeTo} markLabel="choke 16:52–17:47" color="#E5871F" />
          <Reading more="Feed throughput with ±2σ control limits. Instability builds from 16:35 (oversize destabilising the feed) before the hard choke — motor-current variance and throughput swing are the corroborated cause.">Instability builds from 16:35, before the choke</Reading>
        </Card>
        <Card title="Oversize rate — SC-01" density="working">
          <ControlChart series={oversizeS} m={m} N={derived.N} k={2} unit=" %" color="#7B5EA7" />
          <Reading more="Oversize climbs through the shift as B-114 fragmented material works through — corroborating evidence for the choke, not its trigger. Feed-rate control at the tip is the durable fix.">Corroborates the choke; not its trigger</Reading>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, marginTop: 16 }}>
        <Card title="CV-01 conveyor strip" density="working">
          <ConveyorStrip loadS={loadS} speedS={speedS} tempS={tempS} m={m} N={derived.N} fmt={derived.fmt} />
          <Reading more="Belt load vs the shaded empty-run windows (line speed > 0 but load < 5%): the belt ran nearly empty for ~41 min during the choke clear-out — motor energy spent moving nothing, and the thermal residual Screen 4 diagnoses.">~41 min run empty — energy moving nothing</Reading>
        </Card>
        <Card title="Conveyor-vision detections" density="working">
          <div style={{ display: 'grid', gap: 6 }}>
            {camEps.length === 0 && <div className="dv3-support">No conveyor-vision events by {derived.fmt(m)}.</div>}
            {camEps.slice(-7).reverse().map(e => (
              <div key={e.key + e.firstT} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'baseline' }}>
                <span className="dv3-mono dv3-tert">{derived.fmt(Math.floor(e.firstT / 60))}</span>
                <span className="dv3-chip" style={{ background: e.sev === 'critical' ? '#FDECEC' : 'var(--surface-2)', color: e.sev === 'critical' ? '#B42318' : 'var(--text-secondary)' }}>{e.sev === 'critical' ? 'CRIT' : 'WARN'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{presentAlertMsg(e.msg)}</span>
                {e.count > 1 && <span className="dv3-mono dv3-tert" style={{ marginLeft: 'auto' }}>×{e.count}</span>}
              </div>
            ))}
          </div>
          <Reading more="Belt-vision episodes (idler hotspots, tramp metal, tracking) after the anti-fatigue policy — raw detections filtered on read, so precision stays computable.">Filtered on read — precision stays computable</Reading>
        </Card>
      </div>
    </>
  )
}

function ConveyorStrip({ loadS, speedS, tempS, m, N, fmt }) {
  const W = 560, H = 150
  const shown = Math.max(2, Math.floor((m / N) * loadS.length))
  const x = (i) => 6 + (i / Math.max(1, loadS.length - 1)) * (W - 12)
  const yL = (v) => H - 30 - (v / 100) * (H - 44)
  // empty-run windows: speed>0 & load<5
  const empties = []
  let run = null
  for (let i = 0; i < shown; i++) {
    const empty = (speedS[i] ?? 0) > 0.05 && (loadS[i] ?? 0) < 5
    if (empty && !run) run = { s: i }
    else if (!empty && run) { run.e = i; empties.push(run); run = null }
  }
  if (run) { run.e = shown; empties.push(run) }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      {empties.map((e, i) => <rect key={i} x={x(e.s)} y={6} width={Math.max(1, x(e.e) - x(e.s))} height={H - 36} fill="rgba(224,75,75,0.10)" />)}
      {empties.length > 0 && <text x={x(empties[0].s) + 3} y={18} fontSize="9" fill="#B42318">empty run</text>}
      <line x1={6} x2={W - 6} y1={yL(5)} y2={yL(5)} stroke="#E0A32E" strokeWidth="1" strokeDasharray="3 3" /><text x={W - 6} y={yL(5) - 2} textAnchor="end" fontSize="8" fill="#B0721A">5% empty threshold</text>
      <polyline points={loadS.slice(0, shown).map((v, i) => `${x(i)},${yL(v)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      <text x={8} y={16} fontSize="9.5" fill="var(--text-tertiary)">belt load %</text>
      {[0, 120, 240, 360, 480].map(t => <text key={t} x={x(Math.floor(t / N * loadS.length))} y={H - 4} fontSize="9" textAnchor="middle" fill="var(--text-tertiary)">{fmt(t)}</text>)}
    </svg>
  )
}
