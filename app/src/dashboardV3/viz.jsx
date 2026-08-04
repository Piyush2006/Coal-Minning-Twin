// Shared SVG viz primitives reused across screens — the 2D site map (Screens 1
// & 6) and small charts (throughput-vs-capability mini series, control-chart
// band). Hand-rolled, theme-token styled. No chart library.
import { useMemo } from 'react'
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

export function SiteMap({ fx, derived, m, height = 300, zones = [], events = [], showLabels = true }) {
  const selection = useScrub(s => s.selection)
  const select = useScrub(s => s.select)
  const W = 1000, pad = 30
  const H = height
  const sx = (x) => pad + ((x - BOUNDS.minx) / (BOUNDS.maxx - BOUNDS.minx)) * (W - 2 * pad)
  const sy = (z) => pad + ((z - BOUNDS.minz) / (BOUNDS.maxz - BOUNDS.minz)) * (H - 2 * pad)
  const snap = useMemo(() => fx.snapshot(derived.t0 + m * 60000), [fx, m, derived])

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 620 }}>
        {/* backdrop zones (stylised): pit, plant strip, stockyard, port water */}
        <rect x={sx(-195)} y={sy(-78)} width={sx(-95) - sx(-195)} height={sy(46) - sy(-78)} rx={16} fill="#EFE7DC" opacity="0.6" />
        <text x={sx(-150)} y={sy(40)} fontSize="12" fill="#9A8C78" fontWeight="600">PIT — Bench 4/5</text>
        <rect x={sx(-42)} y={sy(-20)} width={sx(18) - sx(-42)} height={sy(20) - sy(-20)} rx={10} fill="#E6EBF2" opacity="0.7" />
        <text x={sx(-12)} y={sy(-16)} fontSize="11" fill="#8A94A6" fontWeight="600" textAnchor="middle">CHP</text>
        <rect x={sx(80)} y={sy(2)} width={W - pad - sx(80)} height={sy(30) - sy(2)} rx={10} fill="#DCE8F0" opacity="0.6" />
        <text x={sx(100)} y={sy(26)} fontSize="11" fill="#7C93A6" fontWeight="600">PORT</text>

        {/* zone overlays (safety screen) */}
        {zones.map((z, i) => (
          <g key={i}>
            <rect x={sx(z.x0)} y={sy(z.z0)} width={sx(z.x1) - sx(z.x0)} height={sy(z.z1) - sy(z.z0)} rx={8}
              fill={z.fill ?? 'rgba(224,75,75,0.10)'} stroke={z.stroke ?? 'rgba(224,75,75,0.4)'} strokeWidth="1.2" strokeDasharray="4 3" />
            <text x={sx(z.x0) + 6} y={sy(z.z0) + 13} fontSize="10" fill={z.stroke ?? '#B42318'} fontWeight="600">{z.label}</text>
          </g>
        ))}

        {/* flow spine face → plant → port */}
        <polyline points={[[-164, 0], [-88, 13], [-30, 0], [8, 0], [36, 0], [68, -13], [96, 14]].map(([x, z]) => `${sx(x)},${sy(z)}`).join(' ')}
          fill="none" stroke="#C6CDD8" strokeWidth="2.5" strokeDasharray="2 5" strokeLinecap="round" />

        {/* asset dots */}
        {Object.entries(SITE_POS).map(([id, [x, z, label]]) => {
          const st = snap[id]?.status ?? 'running'
          const sel = selection === id
          return (
            <g key={id} style={{ cursor: 'pointer' }} onClick={() => select(id)}>
              <circle cx={sx(x)} cy={sy(z)} r={sel ? 9 : 6.5} fill={STATUS_COL[st] ?? '#C6CDD8'} stroke="#fff" strokeWidth={sel ? 2.5 : 1.5} />
              {sel && <circle cx={sx(x)} cy={sy(z)} r={13} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
              {showLabels && <text x={sx(x)} y={sy(z) - 11} fontSize="9.5" textAnchor="middle" fill="var(--text-secondary)" fontWeight={sel ? 700 : 500} fontFamily="var(--font-mono)">{label}</text>}
            </g>
          )
        })}

        {/* event pins (safety screen) */}
        {events.map((e, i) => (
          <g key={i}>
            <circle cx={sx(e.x)} cy={sy(e.z)} r={5} fill={e.color ?? '#E04B4B'} opacity="0.9">
              <animate attributeName="r" values="5;9;5" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
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
