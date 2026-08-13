// One chart, every sensor as a line. Units differ wildly (rpm vs mm/s), so each
// line is plotted as % OF ITS OWN WARNING THRESHOLD — one honest, labelled
// y-axis for all sensors, with the warning line at 100%. Tooltips show the real
// reading with its unit. The legend is interactive: click to hide/show a line.
// Shared by the equipment drawer and the predictive alert drawer — `unit` can be
// any asset-condition object (it just needs id + the sensor fields spread on it).
import { useMemo } from 'react'
import { Modal } from './primitives'
import { Chart } from './Chart'
import { assetSensorTrend } from '../data/assets'

export const SENSOR_COLORS = ['#3E6DF4', '#F59E0B', '#0E9F6E', '#8B5CF6', '#E5484D', '#00B4D8']

export function SensorChartModal({ isOpen, onClose, unit, sensors }) {
  const options = useMemo(() => {
    if (!isOpen) return null
    const N = 24
    const cats = Array.from({ length: N }, (_, i) => (i === N - 1 ? 'now' : `−${N - 1 - i}h`))
    return {
      chart: { type: 'spline', zooming: { type: 'x' } },   // drag a region to zoom; Reset zoom appears
      xAxis: { categories: cats, labels: { step: 3, rotation: 0 } },
      yAxis: {
        title: { text: null },
        labels: { format: '{value}%' },
        plotLines: [{ value: 100, color: '#E5484D', width: 1.4, dashStyle: 'Dash', zIndex: 4, label: { text: 'Warning threshold', align: 'right', x: -6, style: { color: '#C02434', fontSize: '10px' } } }],
      },
      legend: { enabled: true },
      tooltip: {
        shared: true,
        formatter: function () {
          const head = `<span style="font-size:10.5px;color:#98A2B3">${this.x}</span><br/>`
          return head + this.points.map(p =>
            `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${p.point.raw}</b> <span style="color:#98A2B3">· ${p.y}% of warn</span>`).join('<br/>')
        },
      },
      plotOptions: { spline: { marker: { enabled: false } } },
      series: sensors.map((s, i) => ({
        name: `${s.label} (${s.unit})`,
        // "closeness to warning": above the red line = past the warning threshold,
        // for BOTH directions (low-is-bad sensors are inverted so the rule holds)
        data: assetSensorTrend(unit, s, N).map(v => ({
          y: Math.round((s.low ? (s.warn || 1) / Math.max(0.01, v) : v / (s.warn || 1)) * 1000) / 10,
          raw: `${v} ${s.unit}`,
        })),
        color: SENSOR_COLORS[i % SENSOR_COLORS.length],
      })),
    }
  }, [isOpen, unit, sensors])

  if (!isOpen) return null
  return (
    <Modal isOpen onClose={onClose} maxWidth={760}
      title={`${unit.id} — sensor data`}
      subtitle="Last 24 hours · lines show closeness to each sensor's warning threshold (above the red line = past warning) · drag to zoom · click a legend item to hide or show it">
      <Chart height={320} options={options} />
    </Modal>
  )
}
