// Shared SVG viz primitives reused across screens — the 2D site map (Screens 1
// & 6) and small charts (throughput-vs-capability mini series, control-chart
// band). Hand-rolled, theme-token styled. No chart library.
import { useMemo, useId } from 'react'
import { useScrub } from './screen0/store'

const STATUS_COL = { running: '#12A16E', operating: '#12A16E', idle: '#E0A32E', fault: '#E04B4B', down: '#E04B4B', off: '#C6CDD8' }

// key asset plan positions (x,z) from the twin spec — static, so inlined to
// avoid pulling the whole spec into the bundle. z flipped to screen-y downstream.
export const SITE_POS = {
  'exc-coal-1': [-164, 0, 'EX-02'], 'exc-ob-1': [-141, 42, 'EX-01'], 'loader-1': [-88, 26, 'WL-01'],
  'crusher-1': [-30, 0, 'CR-01'], 'cv-01': [-19, 0, 'CV-01'], 'screen-1': [-7, 0, 'SC-01'],
  'chpp-1': [8, 0, 'CHPP'], 'stacker-1': [30, 0, 'SR-01'], 'pile-1': [36, 14, 'Pile A'],
  'pile-2': [36, -14, 'Pile B'], 'blend-1': [52, -16, 'Blend'], 'loadout-1': [68, -26, 'TLO-01'],
  'shiploader-1': [96, 14, 'SL-01'],
}
const BOUNDS = { minx: -195, maxx: 128, minz: -78, maxz: 46 }

// arrowhead triangle at the midpoint of a→b, pointing downstream
function arrow(ax, ay, bx, by, size = 4) {
  const mx = (ax + bx) / 2, my = (ay + by) / 2
  const a = Math.atan2(by - ay, bx - ax)
  const p = (t, o) => `${mx + Math.cos(a) * t - Math.sin(a) * o},${my + Math.sin(a) * t + Math.cos(a) * o}`
  return `${p(size, 0)} ${p(-size, size * 0.7)} ${p(-size, -size * 0.7)}`
}

export function SiteMap({ fx, derived, m, height = 300, zones = [], events = [], showLabels = true }) {
  const selection = useScrub(s => s.selection)
  const select = useScrub(s => s.select)
  const uid = useId().replace(/:/g, '')
  const W = 1000, pad = 30
  const H = height
  const sx = (x) => pad + ((x - BOUNDS.minx) / (BOUNDS.maxx - BOUNDS.minx)) * (W - 2 * pad)
  const sy = (z) => pad + ((z - BOUNDS.minz) / (BOUNDS.maxz - BOUNDS.minz)) * (H - 2 * pad)
  const P = (x, z) => [sx(x), sy(z)]
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])

  // pit extent → proportional ellipse benches (scale with map height)
  const [pcx, pcy] = P(-148, 6)
  const prx = (sx(-104) - sx(-192)) / 2, pry = (sy(46) - sy(-38)) / 2
  const benchCol = ['#EAEEF4', '#E2E7EF', '#DAE0EA', '#D2D9E4']

  // conveyor + rail polylines (px)
  const conv = [[-30, 0], [-19, 0], [-7, 0], [8, 0], [30, 0], [40, 6]].map(([x, z]) => P(x, z))
  const rail = [[68, -26], [98, -34], [126, -42]].map(([x, z]) => P(x, z))
  const haul = [[-150, 8], [-120, 20], [-88, 26], [-58, 12], [-34, 2]].map(([x, z]) => P(x, z))

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 640 }}>
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F7F9FC" /><stop offset="1" stopColor="#EDF1F6" />
          </linearGradient>
          <radialGradient id={`pit-${uid}`} cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#D2D9E4" /><stop offset="1" stopColor="#E4E9F0" />
          </radialGradient>
          <filter id={`sh-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#16233F" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* frame + wash */}
        <rect x={2} y={2} width={W - 4} height={H - 4} rx={14} fill={`url(#bg-${uid})`} stroke="#E2E6EE" strokeWidth="1.5" />

        {/* port water band + berth */}
        <path d={`M ${sx(78)} ${sy(-2)} L ${W - 8} ${sy(-2)} L ${W - 8} ${sy(32)} L ${sx(78)} ${sy(32)} Q ${sx(72)} ${sy(15)} ${sx(78)} ${sy(-2)} Z`} fill="#DCE8F2" opacity="0.75" />
        <line x1={sx(84)} y1={sy(-2)} x2={sx(84)} y2={sy(32)} stroke="#B9CEDE" strokeWidth="2" strokeDasharray="1 4" />
        <text x={sx(108)} y={sy(29)} fontSize="10.5" fill="#7C93A6" fontWeight="600" letterSpacing="0.5">PORT</text>

        {/* CHP apron pad */}
        <rect x={sx(-44)} y={sy(-19)} width={sx(44) - sx(-44)} height={sy(19) - sy(-19)} rx={12} fill="#E9EDF3" opacity="0.85" />
        <text x={sx(0)} y={sy(-13)} fontSize="10" fill="#98A2B3" fontWeight="600" textAnchor="middle" letterSpacing="0.5">COAL HANDLING PLANT</text>

        {/* pit: concentric bench ellipses + rim */}
        <g>
          <ellipse cx={pcx} cy={pcy} rx={prx} ry={pry} fill={`url(#pit-${uid})`} />
          {[0.82, 0.62, 0.42, 0.24].map((f, i) => (
            <ellipse key={i} cx={pcx} cy={pcy - i * 3} rx={prx * f} ry={pry * f} fill={benchCol[i]} stroke="#C7CFDB" strokeWidth="0.75" />
          ))}
          {/* spiral haul-road hint inside the pit */}
          <path d={`M ${pcx - prx * 0.7} ${pcy} A ${prx * 0.7} ${pry * 0.7} 0 1 1 ${pcx + prx * 0.34} ${pcy + pry * 0.3}`} fill="none" stroke="#CBD3DF" strokeWidth="1.4" strokeDasharray="3 3" />
          <text x={pcx} y={pcy - pry - 6} fontSize="10.5" fill="#9AA4B4" fontWeight="600" textAnchor="middle" letterSpacing="0.5">PIT · BENCH 4/5</text>
        </g>

        {/* spoil / dump mounds (contour circles) */}
        {[[-104, -56], [-84, -66]].map(([x, z], i) => { const [cx, cy] = P(x, z); return (
          <g key={i}>{[10, 6.5, 3].map((r, k) => <circle key={k} cx={cx} cy={cy} r={r} fill="none" stroke="#D6DCE6" strokeWidth="1" />)}</g>
        ) })}

        {/* haul road: wide band + dashed centreline */}
        <polyline points={haul.map(p => p.join(',')).join(' ')} fill="none" stroke="#E4E8F0" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={haul.map(p => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="4 5" strokeLinecap="round" />

        {/* overland conveyor: slate line + downstream arrowheads */}
        <polyline points={conv.map(p => p.join(',')).join(' ')} fill="none" stroke="#8A94A6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {conv.slice(0, -1).map((p, i) => <polygon key={i} points={arrow(p[0], p[1], conv[i + 1][0], conv[i + 1][1])} fill="#8A94A6" />)}

        {/* rail: line + sleeper ticks */}
        <polyline points={rail.map(p => p.join(',')).join(' ')} fill="none" stroke="#A6AEBD" strokeWidth="2" strokeLinecap="round" />
        {(() => { const ticks = []; for (let t = 0; t <= 1; t += 0.14) { const ax = rail[0][0] + (rail[2][0] - rail[0][0]) * t, ay = rail[0][1] + (rail[2][1] - rail[0][1]) * t; const a = Math.atan2(rail[2][1] - rail[0][1], rail[2][0] - rail[0][0]) + Math.PI / 2; ticks.push(<line key={t} x1={ax + Math.cos(a) * 3.5} y1={ay + Math.sin(a) * 3.5} x2={ax - Math.cos(a) * 3.5} y2={ay - Math.sin(a) * 3.5} stroke="#A6AEBD" strokeWidth="1.4" />) } return ticks })()}

        {/* stockpiles: filled circles sized by live stock tonnes */}
        {['pile-1', 'pile-2'].map((id) => { const [x, z] = SITE_POS[id]; const [cx, cy] = P(x, z); const t = Number(snap[id]?.parameters?.stockTonnes) || 500; const r = 8 + Math.min(9, (t - 480) / 90); return (
          <g key={id}><circle cx={cx} cy={cy} r={r} fill="#DBE1EA" stroke="#C7CFDB" strokeWidth="1" /><circle cx={cx} cy={cy} r={r * 0.55} fill="#CFD6E1" /></g>
        ) })}

        {/* zone overlays (safety screen) */}
        {zones.map((z, i) => (
          <g key={i}>
            <rect x={sx(z.x0)} y={sy(z.z0)} width={sx(z.x1) - sx(z.x0)} height={sy(z.z1) - sy(z.z0)} rx={10}
              fill={z.fill ?? 'rgba(224,75,75,0.09)'} stroke={z.stroke ?? 'rgba(224,75,75,0.4)'} strokeWidth="1.2" strokeDasharray="5 3" />
            <text x={sx(z.x0) + 7} y={sy(z.z0) + 14} fontSize="10" fill={z.stroke ?? '#B42318'} fontWeight="700" letterSpacing="0.3">{z.label}</text>
          </g>
        ))}

        {/* asset badge markers — white badge + coloured status core */}
        {Object.entries(SITE_POS).map(([id, [x, z, label]]) => {
          const st = snap[id]?.status ?? 'running'
          const col = STATUS_COL[st] ?? '#C6CDD8'
          const sel = selection === id
          const [cx, cy] = P(x, z)
          return (
            <g key={id} style={{ cursor: 'pointer' }} onClick={() => select(id)}>
              {sel && <circle cx={cx} cy={cy} r={13} fill="none" stroke="var(--accent)" strokeWidth="1.8" />}
              <circle cx={cx} cy={cy} r={sel ? 9 : 7.5} fill="#fff" filter={`url(#sh-${uid})`} />
              <circle cx={cx} cy={cy} r={sel ? 5 : 4} fill={col} />
              {showLabels && (
                <text x={cx} y={cy - 12} fontSize="9.5" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight={sel ? 700 : 600}
                  fill={sel ? 'var(--accent)' : '#5B6B7F'} stroke="#fff" strokeWidth="2.6" paintOrder="stroke" style={{ strokeLinejoin: 'round' }}>{label}</text>
              )}
            </g>
          )
        })}

        {/* event pins (safety screen) */}
        {events.map((e, i) => { const [cx, cy] = P(e.x, e.z); return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={9} fill={e.color ?? '#E04B4B'} opacity="0.18"><animate attributeName="r" values="7;13;7" dur="1.8s" repeatCount="indefinite" /></circle>
            <circle cx={cx} cy={cy} r={4.5} fill={e.color ?? '#E04B4B'} stroke="#fff" strokeWidth="1.5" />
          </g>
        ) })}

        {/* status legend */}
        <g transform={`translate(${16}, ${H - 16})`}>
          {[['#12A16E', 'running'], ['#E0A32E', 'idle'], ['#E04B4B', 'fault']].map(([c, l], i) => (
            <g key={l} transform={`translate(${i * 78}, 0)`}>
              <circle cx={5} cy={-4} r={4} fill="#fff" filter={`url(#sh-${uid})`} /><circle cx={5} cy={-4} r={2.4} fill={c} />
              <text x={13} y={-1} fontSize="9.5" fill="var(--text-tertiary)">{l}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

/* mini throughput-vs-capability series — actual line inside a faint capability
   band, with the scrub cursor. Used by the stage small-multiples. */
export function MiniSeries({ series, cap, m, N, fmt, color = 'var(--series-1)', label, unit = 't/h', w = 300, h = 74 }) {
  const shown = Math.floor((m / N) * series.length)
  const max = cap * 1.15
  const x = (i) => (i / Math.max(1, series.length - 1)) * w
  const y = (v) => h - 4 - (Math.max(0, v) / max) * (h - 10)
  const pts = series.slice(0, Math.max(1, shown)).map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={w} height={h + 2} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${w} ${h + 2}`}>
      <rect x={0} y={y(cap)} width={w} height={h - 4 - y(cap)} fill="rgba(18,161,110,0.06)" />
      <line x1={0} y1={y(cap)} x2={w} y2={y(cap)} stroke="#A9B2C1" strokeWidth="1.2" strokeDasharray="5 4" />
      <text x={w - 2} y={y(cap) - 3} textAnchor="end" fontSize="8.5" fill="var(--text-tertiary)">cap {Math.round(cap)}</text>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {label && <text x={2} y={11} fontSize="10" fontWeight="600" fill="var(--text-secondary)">{label}</text>}
    </svg>
  )
}

/* control-chart band: series with mean ± kσ band, out-of-band points flagged.
   Used by fixed-plant (crusher feed) and energy (SEC). */
export function ControlChart({ series, m, N, k = 2, fmt, unit = '', w = 560, h = 150, markFrom, markTo, markLabel, color = 'var(--series-1)' }) {
  const shown = Math.max(2, Math.floor((m / N) * series.length))
  const vis = series.slice(0, shown).filter(v => Number.isFinite(v))
  const mean = vis.reduce((a, b) => a + b, 0) / Math.max(1, vis.length)
  const sd = Math.sqrt(vis.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, vis.length))
  const lo = mean - k * sd, hi = mean + k * sd
  const allMin = Math.min(...vis, lo), allMax = Math.max(...vis, hi)
  const pad = (allMax - allMin) * 0.12 || 1
  const x = (i) => 4 + (i / Math.max(1, series.length - 1)) * (w - 8)
  const y = (v) => h - 16 - ((v - (allMin - pad)) / ((allMax + pad) - (allMin - pad))) * (h - 24)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '100%' }}>
      <rect x={4} y={y(hi)} width={w - 8} height={Math.max(0, y(lo) - y(hi))} fill="rgba(43,92,231,0.06)" />
      <line x1={4} y1={y(mean)} x2={w - 4} y2={y(mean)} stroke="#A9B2C1" strokeWidth="1" strokeDasharray="4 3" />
      <text x={w - 5} y={y(mean) - 3} textAnchor="end" fontSize="8.5" fill="var(--text-tertiary)">x̄ {mean.toFixed(1)}{unit} · ±{k}σ</text>
      {markFrom != null && (
        <>
          <rect x={x(markFrom)} y={2} width={x(markTo) - x(markFrom)} height={h - 16} fill="rgba(229,135,31,0.09)" />
          {markLabel && <text x={x(markFrom) + 3} y={12} fontSize="9" fill="#B0721A" fontWeight="600">{markLabel}</text>}
        </>
      )}
      <polyline points={vis.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {vis.map((v, i) => (v > hi || v < lo) ? <circle key={i} cx={x(i)} cy={y(v)} r={2.2} fill="#E04B4B" /> : null)}
    </svg>
  )
}
