// Screen 5 — Energy. A 2-level energy Sankey (grid + diesel → consumers), SEC
// control charts with 30-day baseline bands (SEC drift doubles as a wear
// signal), and the idle-energy panel ranked with empty-belt hours leading — the
// fastest win on the screen. Assembly + one new hand-rolled Sankey.
import { useMemo } from 'react'
import { Card, Reading, Thesis } from '../ui'
import { ScreenFrame } from '../chrome'
import { ControlChart } from '../viz'

export default function Screen5() {
  return <ScreenFrame title="Energy" renderMain={(ctx) => <EnergyMain {...ctx} />} />
}

const NOLOAD_KW = 185   // CV-01 drive no-load draw

function EnergyMain({ fx, derived, m }) {
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])
  const secCr = useMemo(() => fx.series('crusher-1·kwhPerTonne', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const secSc = useMemo(() => fx.series('screen-1·kwhPerTonne', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const secCh = useMemo(() => fx.series('chpp-1·kwhPerTonne', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])
  const loadS = useMemo(() => fx.series('cv-01·load', derived.t0, derived.t0 + derived.N * 60000, derived.N).map(p => p[1]), [fx, derived])

  // empty-belt minutes to now (load<5%)
  const shown = Math.floor((m / derived.N) * loadS.length)
  let emptyMin = 0
  for (let i = 0; i < shown; i++) if ((loadS[i] ?? 0) < 5) emptyMin += derived.N / loadS.length
  const emptyKWh = Math.round((emptyMin / 60) * NOLOAD_KW)

  // idle trucks fuel (rough): count idle coal trucks × idle burn
  let idleTrucks = 0
  for (let i = 1; i <= 8; i++) if (snap[`truck-${i}`]?.status === 'idle') idleTrucks++
  const idleFuelLh = idleTrucks * 32   // L/h at idle

  const wasters = [
    { name: 'CV-01 empty-belt running', v: `${emptyKWh.toLocaleString()} kWh`, detail: `${Math.round(emptyMin)} min empty × ${NOLOAD_KW} kW no-load`, sev: 1, fix: 'Belt-load interlock — stop the drive when starved' },
    { name: 'Idle haul trucks', v: `${Math.round(idleTrucks * idleFuelLh / 8 * 8) || idleFuelLh} L/h`, detail: `${idleTrucks} trucks idling now`, sev: idleTrucks > 2 ? 0.7 : 0.3, fix: 'Auto stop-start policy > 3 min idle' },
    { name: 'CHP recirculation', v: '~120 kWh', detail: 'off-spec re-treat during oversize', sev: 0.4, fix: 'Tighten screen aperture control' },
  ]

  return (
    <>
      <Thesis>
        The empty-belt drive is the fastest win at {derived.fmt(m)} — the same starvation that cost tonnes also burned {emptyKWh.toLocaleString()} kWh moving an empty belt. One belt-load interlock fixes tonnes, SEC drift and thermal residual at once.
      </Thesis>
      <Card title={`Energy flow — live at ${derived.fmt(m)}`} density="airy">
        <EnergySankey snap={snap} />
        <Reading more="Grid feeds the fixed plant; diesel feeds the mobile fleet. The overland conveyor and crusher are the two largest electrical draws; haulage dominates diesel. Sized to live throughput at the scrub time.">Conveyor + crusher lead grid; haulage leads diesel</Reading>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginTop: 16 }}>
        <Card title="CR-01 specific energy" density="working">
          <ControlChart series={secCr} m={m} N={derived.N} k={2} unit=" kWh/t" color="#E5871F" h={120} />
          <Reading more="kWh/t rises when the crusher runs starved or on oversize — SEC drift is an early wear signal as much as an energy line.">SEC drift is an early wear signal</Reading>
        </Card>
        <Card title="SC-01 specific energy" density="working">
          <ControlChart series={secSc} m={m} N={derived.N} k={2} unit=" kWh/t" color="#7B5EA7" h={120} />
          <Reading more="Screen SEC tracks oversize load; the mid-shift climb mirrors the B-114 fragmentation.">Climb mirrors the B-114 fragmentation</Reading>
        </Card>
        <Card title="CHPP specific energy" density="working">
          <ControlChart series={secCh} m={m} N={derived.N} k={2} unit=" kWh/t" color="#2B5CE7" h={120} />
          <Reading more="DMC energy per tonne is steady — the plant is efficient when fed; the loss is upstream, not here.">Steady — the loss is upstream, not here</Reading>
        </Card>
      </div>

      <Card title="Idle & waste energy — ranked" density="working" style={{ marginTop: 16 }}
        right={<span className="dv3-support" style={{ fontSize: 11 }}>fastest win first</span>}>
        <div style={{ display: 'grid', gap: 8 }}>
          {wasters.map(w => (
            <div key={w.name} style={{ display: 'grid', gridTemplateColumns: '210px 100px 1fr', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{w.name}</span>
              <span className="dv3-mono" style={{ fontWeight: 700, color: w.sev > 0.66 ? '#E04B4B' : w.sev > 0.33 ? '#E0A32E' : '#12A16E' }}>{w.v}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="dv3-well" style={{ flex: '0 0 120px', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${w.sev * 100}%`, height: '100%', background: w.sev > 0.66 ? '#E04B4B' : w.sev > 0.33 ? '#E0A32E' : '#12A16E' }} />
                </div>
                <span className="dv3-tert" style={{ fontSize: 11 }}>{w.detail} · <span style={{ color: 'var(--accent)' }}>{w.fix}</span></span>
              </div>
            </div>
          ))}
        </div>
        <Reading more={`The empty-belt drive leads: the same starvation that cost tonnes also burned ${emptyKWh.toLocaleString()} kWh. A belt-load interlock is the single fastest energy-and-wear win.`}>Empty-belt drive leads — one interlock fixes three problems</Reading>
      </Card>
    </>
  )
}

/* 2-level Sankey: two sources → six consumers. Ribbon widths ∝ kW. */
function EnergySankey({ snap }) {
  const p = (id, k, d = 0) => Number(snap[id]?.parameters?.[k]) || d
  // electrical (kW, rough): crusher, conveyor, screen, chpp
  const eCrush = p('crusher-1', 'throughput') * p('crusher-1', 'kwhPerTonne', 0.6)
  const eConv = 185 + p('cv-01', 'load') * 6
  const eScreen = p('screen-1', 'feedRate') * p('screen-1', 'kwhPerTonne', 0.3)
  const eChpp = p('chpp-1', 'feedRate') * p('chpp-1', 'kwhPerTonne', 0.5)
  // diesel (kW-equiv): haulage, loading
  let trucksRun = 0; for (let i = 1; i <= 8; i++) if (snap[`truck-${i}`]?.status === 'running') trucksRun++
  const dHaul = trucksRun * 640
  const dLoad = 1200
  const consumers = [
    { name: 'Crushing', v: eCrush, src: 'grid', col: '#E5871F' },
    { name: 'Conveying', v: eConv, src: 'grid', col: '#2B5CE7' },
    { name: 'Screening', v: eScreen, src: 'grid', col: '#7B5EA7' },
    { name: 'CHP', v: eChpp, src: 'grid', col: '#12A594' },
    { name: 'Haulage', v: dHaul, src: 'diesel', col: '#5B6B7F' },
    { name: 'Loading', v: dLoad, src: 'diesel', col: '#8A6D3B' },
  ]
  const gridTot = consumers.filter(c => c.src === 'grid').reduce((a, c) => a + c.v, 0)
  const dieselTot = consumers.filter(c => c.src === 'diesel').reduce((a, c) => a + c.v, 0)
  const W = 1000, H = 300, total = gridTot + dieselTot || 1
  const GAP = 6, NGAPS = consumers.length - 1
  const scale = (H - 24 - NGAPS * GAP) / total
  const srcX = 40, dstX = 640
  const gridH = gridTot * scale, dieselH = dieselTot * scale
  // consumer y positions
  let cy = 10
  const nodes = consumers.map(c => { const h = Math.max(6, c.v * scale); const node = { ...c, y: cy, h }; cy += h + GAP; return node })
  let gCursor = 10, dCursor = 10 + gridH + 14
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 640, maxHeight: 260 }}>
        {/* sources */}
        <rect x={srcX - 22} y={10} width={22} height={gridH} rx={3} fill="#2B5CE7" />
        <text x={srcX - 26} y={10 + gridH / 2} textAnchor="end" fontSize="11" fontWeight="700" fill="#2B5CE7" transform={`rotate(-90 ${srcX - 26} ${10 + gridH / 2})`}>GRID {Math.round(gridTot)} kW</text>
        <rect x={srcX - 22} y={10 + gridH + 14} width={22} height={dieselH} rx={3} fill="#5B6B7F" />
        <text x={srcX - 26} y={10 + gridH + 14 + dieselH / 2} textAnchor="end" fontSize="11" fontWeight="700" fill="#5B6B7F" transform={`rotate(-90 ${srcX - 26} ${10 + gridH + 14 + dieselH / 2})`}>DIESEL {Math.round(dieselTot)} kWe</text>
        {/* ribbons */}
        {nodes.map((n, i) => {
          const srcY = n.src === 'grid' ? gCursor : dCursor
          if (n.src === 'grid') gCursor += n.h; else dCursor += n.h
          const x0 = srcX, x1 = dstX
          const path = `M ${x0} ${srcY} C ${(x0 + x1) / 2} ${srcY}, ${(x0 + x1) / 2} ${n.y}, ${x1} ${n.y} L ${x1} ${n.y + n.h} C ${(x0 + x1) / 2} ${n.y + n.h}, ${(x0 + x1) / 2} ${srcY + n.h}, ${x0} ${srcY + n.h} Z`
          return <path key={i} d={path} fill={n.col} opacity="0.32" />
        })}
        {/* consumer nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            <rect x={dstX} y={n.y} width={16} height={n.h} rx={3} fill={n.col} />
            <text x={dstX + 24} y={n.y + n.h / 2 + 4} fontSize="12" fill="var(--text-primary)" fontWeight="600">{n.name} <tspan className="dv3-mono" fill="var(--text-tertiary)" fontWeight="400">{Math.round(n.v)} kW</tspan></text>
          </g>
        ))}
      </svg>
    </div>
  )
}
