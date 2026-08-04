// Equipment state timeline (§7.3) — one row per unit, status colours WITH the
// mandatory pattern fills, x-axis synced to the global scrubber. Runs are
// precomputed once (RLE); the scrubber only moves the cursor line.
import { statusFill, StatusChip } from '../patterns'
import { useScrub } from './store'

const ROW_H = 15, ROW_GAP = 4, LABEL_W = 56

export function Gantt({ rows, derived, m, width = 1040 }) {
  const selection = useScrub(s => s.selection)
  const select = useScrub(s => s.select)
  const timeW = width - LABEL_W
  const px = timeW / derived.N
  const H = rows.length * (ROW_H + ROW_GAP) + 22

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={H} style={{ display: 'block' }}>
        {rows.map((row, ri) => {
          const y = ri * (ROW_H + ROW_GAP)
          const dim = selection && selection !== row.id
          return (
            <g key={row.id} opacity={dim ? 0.3 : 1} style={{ cursor: 'pointer' }} onClick={() => select(row.id)}>
              <text x={LABEL_W - 8} y={y + ROW_H / 2 + 3.5} textAnchor="end" fontSize="10.5" fontWeight={selection === row.id ? 700 : 500}
                fill={selection === row.id ? 'var(--text-primary)' : 'var(--text-secondary)'} fontFamily="var(--font-mono)">{row.label}</text>
              {row.runs.map((run, i) => {
                if (run.start >= m) return null
                const w = (Math.min(run.start + run.len, Math.ceil(m)) - run.start) * px
                return <rect key={i} x={LABEL_W + run.start * px} y={y} width={Math.max(0.5, w - 0.5)} height={ROW_H} rx={2} fill={statusFill(run.k)} />
              })}
              {/* not-yet-scrubbed remainder as faint track */}
              <rect x={LABEL_W + m * px} y={y} width={Math.max(0, (derived.N - m) * px)} height={ROW_H} rx={2} fill="var(--surface-2)" />
            </g>
          )
        })}
        {/* hour gridticks + cursor */}
        {[60, 120, 180, 240, 300, 360, 420].map(t => (
          <line key={t} x1={LABEL_W + t * px} y1={0} x2={LABEL_W + t * px} y2={H - 22} stroke="rgba(16,24,40,0.05)" strokeWidth="1" />
        ))}
        <line x1={LABEL_W + m * px} y1={-2} x2={LABEL_W + m * px} y2={H - 20} stroke="var(--text-primary)" strokeWidth="1.5" />
        {[0, 120, 240, 360, 480].map(t => (
          <text key={t} x={LABEL_W + t * px} y={H - 6} textAnchor={t === 0 ? 'start' : t === 480 ? 'end' : 'middle'} fontSize="9.5" fill="var(--text-tertiary)">{derived.fmt(t)}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
        {['operating', 'idleJ', 'idleU', 'downU', 'nodata'].map(k => <StatusChip key={k} k={k} />)}
      </div>
    </div>
  )
}
