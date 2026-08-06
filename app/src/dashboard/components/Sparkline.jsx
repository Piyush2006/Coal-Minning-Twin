// Tiny inline trend line for sensor/fuel-efficiency trends in drill-downs.
export function Sparkline({ data, width = 130, height = 34, color = 'var(--background-info-default)' }) {
  if (!data || !data.length) return null
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const x = (i) => (i / (data.length - 1)) * width
  const y = (v) => height - 4 - ((v - min) / span) * (height - 8)
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="2.4" fill={color} />
    </svg>
  )
}
