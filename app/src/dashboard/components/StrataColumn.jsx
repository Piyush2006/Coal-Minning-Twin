// Stratigraphic column — the hole's rock layers drawn to scale (height ∝
// thickness), each filled with its rock colour + texture pattern, with depth
// ticks and per-layer labels. Pure SVG, no chart lib.
import { ROCKS, TEXTURE_DEFS, TEXTURE_URL } from '../data/geology'
import { fmt } from '../calc/format'

export function StrataColumn({ strata, height = 360, width = 150 }) {
  const total = strata.reduce((a, l) => a + Math.max(0.1, l.thickness), 0) || 1
  const colX = 34, colW = width - colX - 4
  const y = (d) => (d / total) * (height - 2) + 1

  let acc = 0
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs dangerouslySetInnerHTML={{ __html: TEXTURE_DEFS }} />
      {strata.map((L, i) => {
        const t = Math.max(0.1, L.thickness)
        const top = acc; acc += t
        const yTop = y(top), h = y(acc) - yTop
        const rock = ROCKS[L.rock] || {}
        const showLabel = h > 15
        return (
          <g key={i}>
            <rect x={colX} y={yTop} width={colW} height={h} fill={rock.color || '#999'} stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
            <rect x={colX} y={yTop} width={colW} height={h} fill={TEXTURE_URL[rock.texture] || 'none'} />
            {showLabel && (
              <text x={colX + colW / 2} y={yTop + h / 2} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 10.5, fontWeight: 600, fill: isDark(rock.color) ? '#fff' : '#1d1d1f' }}>
                {rock.name || L.rock}
              </text>
            )}
            {/* depth tick at each boundary */}
            <line x1={colX - 4} y1={yTop} x2={colX} y2={yTop} stroke="var(--border-gray-default)" strokeWidth="1" />
            <text x={colX - 6} y={yTop + 3} textAnchor="end" style={{ fontSize: 9, fill: 'var(--text-gray-tertiary)' }}>{fmt(top, 0)}</text>
          </g>
        )
      })}
      {/* bottom depth */}
      <line x1={colX - 4} y1={height - 1} x2={colX} y2={height - 1} stroke="var(--border-gray-default)" strokeWidth="1" />
      <text x={colX - 6} y={height - 3} textAnchor="end" style={{ fontSize: 9, fill: 'var(--text-gray-tertiary)' }}>{fmt(total, 0)}m</text>
    </svg>
  )
}

// crude luminance check to pick label colour
function isDark(hex) {
  if (!hex || hex[0] !== '#') return false
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140
}
