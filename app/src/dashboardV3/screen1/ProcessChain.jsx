// Screen 1 hero — live production chain (§7.4). Hand-rolled SVG. Nodes
// Face → Haul → [ROM] → Crush → [surge] → CHP → [stockpile] → Dispatch, each
// showing current product-equivalent throughput vs capability, unit counts from
// live statuses, and buffer fill between them. The binding constraint node is
// emphasised. With the Prereq-A status fix, starvation is now visible end to
// end: when CR-01 chokes, everything downstream reads starved, not "operating".
import { useMemo } from 'react'
import { YIELD, RATED } from '../data/chainSim'
import { useScrub } from '../screen0/store'

const NODES = [
  { id: 'face', label: 'Face / Loading', sub: 'EX-02 · WL-01', assets: ['exc-coal-1', 'loader-1'] },
  { id: 'haul', label: 'Haulage', sub: '8 trucks', assets: ['truck-1', 'truck-2', 'truck-3', 'truck-4', 'truck-5', 'truck-6', 'truck-7', 'truck-8'] },
  { id: 'crush', label: 'Crushing', sub: 'CR-01', assets: ['crusher-1'] },
  { id: 'chp', label: 'CHP', sub: 'SC-01 · CHPP', assets: ['screen-1', 'chpp-1'] },
  { id: 'dispatch', label: 'Dispatch', sub: 'TLO-01 · SL-01', assets: ['loadout-1', 'shiploader-1'] },
]
// buffers sit AFTER these node ids
const BUFS = { haul: { col: 'bufRom', cap: 60, label: 'ROM pad' }, crush: { col: 'bufSurge', cap: 40, label: 'Surge bin' }, chp: { col: 'bufProduct', cap: 1600, label: 'Stockpile' } }
const ROOT_TO_NODE = { face: 'face', haul: 'haul', crush: 'crush', chp: 'chp', dispatch: 'dispatch' }

export function ProcessChain({ fx, derived, m }) {
  const select = useScrub(s => s.select)
  const selection = useScrub(s => s.selection)
  const at = (col) => fx.at(`_chain·${col}`, derived.t0 + m * 60000) ?? 0
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])

  const rom = at('romTph') * YIELD, prod = at('productTph'), disp = at('dispatchedTph')
  const tph = { face: Math.min(rom, RATED.face), haul: Math.min(rom, RATED.haul), crush: prod, chp: prod, dispatch: disp }
  const bindingRoot = derived.rootAtMin[Math.min(m, derived.N - 1)]
  const bindingNode = ROOT_TO_NODE[bindingRoot] ?? null

  const W = 1040, H = 190, NW = 150, gap = (W - NODES.length * NW) / (NODES.length - 1)
  const nodeX = (i) => i * (NW + gap)
  const cy = 78

  const unitCounts = (assets) => {
    let run = 0, tot = 0
    for (const a of assets) { if (!snap[a]) continue; tot++; if (snap[a].status === 'running') run++ }
    return { run, tot }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 760 }}>
        {NODES.map((n, i) => {
          const x = nodeX(i)
          const util = Math.min(1, tph[n.id] / RATED[n.id])
          const isBind = bindingNode === n.id
          const { run, tot } = unitCounts(n.assets)
          const starved = tph[n.id] < RATED[n.id] * 0.05 && i > 0 && tph[NODES[i - 1].id] < RATED[NODES[i - 1].id] * 0.05
          const col = isBind ? '#E5871F' : starved ? '#E0A32E' : 'var(--accent)'
          const sel = n.assets.includes(selection)
          return (
            <g key={n.id}>
              {/* edge to next node — stroke ∝ flow */}
              {i < NODES.length - 1 && (() => {
                const nextX = nodeX(i + 1)
                const flow = Math.min(tph[n.id], tph[NODES[i + 1].id])
                const sw = 1.5 + (flow / 600) * 7
                const buf = BUFS[n.id]
                return (
                  <g>
                    <line x1={x + NW} y1={cy} x2={nextX} y2={cy} stroke={flow < 20 ? '#E0A32E' : '#9FB4D8'} strokeWidth={sw} strokeLinecap="round" opacity={flow < 20 ? 0.9 : 0.7} />
                    {flow < 20 && <text x={(x + NW + nextX) / 2} y={cy - 8} fontSize="9" fill="#B0721A" textAnchor="middle" fontWeight="700">starved</text>}
                    {buf && (() => {
                      const lvl = Math.min(1, at(buf.col) / buf.cap)
                      const bx = (x + NW + nextX) / 2 - 16
                      return (
                        <g>
                          <rect x={bx} y={cy + 8} width={32} height={7} rx={2} fill="var(--surface-2)" stroke="var(--hairline)" />
                          <rect x={bx} y={cy + 8} width={32 * lvl} height={7} rx={2} fill={lvl > 0.92 ? '#E04B4B' : lvl < 0.08 ? '#E0A32E' : '#7C93A6'} />
                          <text x={bx + 16} y={cy + 26} fontSize="8" fill="var(--text-tertiary)" textAnchor="middle">{buf.label} {Math.round(lvl * 100)}%</text>
                        </g>
                      )
                    })()}
                  </g>
                )
              })()}

              {/* node card */}
              <g style={{ cursor: 'pointer' }} onClick={() => select(n.assets[0])}>
                <rect x={x} y={cy - 44} width={NW} height={88} rx={10} fill="var(--surface)"
                  stroke={isBind ? '#E5871F' : sel ? 'var(--accent)' : 'var(--hairline)'} strokeWidth={isBind || sel ? 2.4 : 1.2} />
                {isBind && <text x={x + NW / 2} y={cy - 50} fontSize="9.5" fill="#B0721A" fontWeight="700" textAnchor="middle">CONSTRAINT</text>}
                <text x={x + 12} y={cy - 26} fontSize="12.5" fontWeight="650" fill="var(--text-primary)">{n.label}</text>
                <text x={x + 12} y={cy - 12} fontSize="9.5" fill="var(--text-tertiary)" fontFamily="var(--font-mono)">{n.sub}</text>
                <text x={x + 12} y={cy + 8} fontSize="15" fontWeight="700" fill={col} fontFamily="var(--font-mono)">{Math.round(tph[n.id])}</text>
                <text x={x + 12 + String(Math.round(tph[n.id])).length * 9 + 4} y={cy + 8} fontSize="9" fill="var(--text-tertiary)">/ {RATED[n.id]} t/h</text>
                {/* util bar */}
                <rect x={x + 12} y={cy + 15} width={NW - 24} height={5} rx={2} fill="var(--surface-2)" />
                <rect x={x + 12} y={cy + 15} width={(NW - 24) * util} height={5} rx={2} fill={col} />
                <text x={x + 12} y={cy + 34} fontSize="9.5" fill="var(--text-secondary)">{run}/{tot} running</text>
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
