// Native Highcharts chart — replaces the design-sdk chart shells inside the
// dashboard. One thin wrapper: our card header typography (Manrope), an
// EXPLICIT canvas height (deterministic in every browser), tight native
// legends, and width-only reflow. Theme comes from lib/chartTheme.js.
import { useEffect, useRef } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import '../lib/chartTheme'

export function Chart({ title, sub, height = 300, options, style }) {
  const ref = useRef(null)

  // width-only reflow on window resize (the dashboard's ResizeObserver converts
  // container-width changes into window resize events)
  useEffect(() => {
    const onResize = () => ref.current?.chart?.reflow()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const opts = Highcharts.merge(
    {
      chart: { height, styledMode: false },
      title: { text: undefined },   // header is HTML (below) — keeps typography identical to cards
      credits: { enabled: false },
    },
    options,
  )

  return (
    <div style={{ minWidth: 0, ...style }}>
      {(title || sub) && (
        <div style={{ display: 'grid', gap: 2, marginBottom: 10 }}>
          {title && <span className="BodyLargeSemibold" style={{ fontSize: 15 }}>{title}</span>}
          {sub && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{sub}</span>}
        </div>
      )}
      <HighchartsReact ref={ref} highcharts={Highcharts} options={opts} />
    </div>
  )
}

// shared helpers for common option shapes
export const dashedTarget = (value, label, align = 'left') => ({
  value, color: '#98A2B3', width: 1.4, dashStyle: 'Dash', zIndex: 4,
  label: { text: label, align, x: align === 'right' ? -6 : 6, style: { color: '#98A2B3', fontSize: '10px' } },
})
