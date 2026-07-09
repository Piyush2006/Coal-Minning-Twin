import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { FONT, C } from '../ui/theme'

// Per-asset trend charts shown on the selected asset's panel. Data-driven: each
// chart appears only when the asset has the relevant parameter (so non-potline
// assets show nothing). There's no historical store, so series are DETERMINISTIC
// synthetic trends around the asset's current value (no flicker, no Math.random).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rnd = (i) => { const s = Math.sin((i + 1) * 12.9898) * 43758.5453; return s - Math.floor(s) }

const base = (h) => ({
  chart: { height: h, backgroundColor: 'transparent', style: { fontFamily: FONT }, spacing: [6, 4, 6, 4] },
  credits: { enabled: false }, legend: { enabled: false },
})

export function AssetTrendCharts({ obj }) {
  const p = obj?.parameters || {}
  const hasV = typeof p.voltage === 'number'
  const hasCE = typeof p.currentEff === 'number'
  if (!hasV && !hasCE) return null

  // Pot Voltage — recent readings, bounded 3.0–4.5 V.
  const vBase = clamp(Number(p.voltage ?? 4.2), 3, 4.5)
  const vData = Array.from({ length: 24 }, (_, i) => +clamp(vBase + (rnd(i) - 0.5) * 0.5, 3, 4.5).toFixed(2))
  const vOpts = {
    ...base(180),
    title: { text: 'Pot Voltage', style: { fontSize: '12px', color: C.text, fontWeight: '600' } },
    xAxis: { labels: { enabled: false }, lineColor: C.line, tickColor: C.line },
    yAxis: { min: 3, max: 4.5, tickInterval: 0.5, title: { text: 'V', style: { color: C.text3, fontSize: '10px' } },
      gridLineColor: 'rgba(0,0,0,0.06)', labels: { style: { color: C.text3 } } },
    tooltip: { headerFormat: '', pointFormat: '<b>{point.y} V</b>' },
    plotOptions: { areaspline: { color: '#0a84ff', fillOpacity: 0.12, lineWidth: 2, marker: { enabled: false } } },
    series: [{ type: 'areaspline', name: 'Pot Voltage', data: vData }],
  }

  // Current Efficiency — last 14 days.
  const ceBase = clamp(Number(p.currentEff ?? 94), 80, 100)
  const days = 14
  const today = new Date()
  const ceCats = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i))
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  })
  const ceData = Array.from({ length: days }, (_, i) => +clamp(ceBase + (rnd(i + 100) - 0.5) * 3, 80, 100).toFixed(1))
  const ceOpts = {
    ...base(180),
    title: { text: 'Current Efficiency — daily', style: { fontSize: '12px', color: C.text, fontWeight: '600' } },
    xAxis: { categories: ceCats, lineColor: C.line, tickColor: C.line, labels: { step: 2, style: { color: C.text3, fontSize: '9px' } } },
    yAxis: { title: { text: '%', style: { color: C.text3, fontSize: '10px' } }, gridLineColor: 'rgba(0,0,0,0.06)', labels: { style: { color: C.text3 } } },
    tooltip: { headerFormat: '{point.key}<br/>', pointFormat: '<b>{point.y}%</b>' },
    plotOptions: { areaspline: { color: '#00b386', fillOpacity: 0.14, lineWidth: 2, marker: { enabled: false } } },
    series: [{ type: 'areaspline', name: 'Current Efficiency', data: ceData }],
  }

  const card = { padding: 8, borderRadius: 10, background: C.surface, border: `1px solid ${C.line}`, marginTop: 10 }
  return (
    <div>
      <div style={{ padding: '16px 0 6px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>Trends</span>
      </div>
      {hasV && <div style={card}><HighchartsReact highcharts={Highcharts} options={vOpts} /></div>}
      {hasCE && <div style={card}><HighchartsReact highcharts={Highcharts} options={ceOpts} /></div>}
    </div>
  )
}
