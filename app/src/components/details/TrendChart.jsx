import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { subInstanceValue, subInstanceColor } from '../../lib/componentSubs'
import { FONT, C } from '../../ui/theme'

// Scatter trend across all instances of a sub-component: y vs x (e.g. Anode Current
// vs Anode Age). The selected instance is highlighted. Axes come from def.chart
// ({x,y} param keys) or the first two numeric parameters.
function numericKeys(def) {
  return (def.parameters || []).filter(p => typeof p.default === 'number').map(p => p.key)
}
export function trendAxes(def) {
  if (def.chart?.x && def.chart?.y) return [def.chart.x, def.chart.y]
  const keys = numericKeys(def)
  return keys.length >= 2 ? [keys[0], keys[1]] : [null, null]
}

export function TrendChart({ obj, def, selIndex }) {
  const [xKey, yKey] = trendAxes(def)
  if (!xKey || !yKey) return null
  const xDef = (def.parameters || []).find(p => p.key === xKey) || { label: xKey }
  const yDef = (def.parameters || []).find(p => p.key === yKey) || { label: yKey }
  const pts = Array.from({ length: def.count }, (_, i) => {
    const inst = subInstanceValue(def, i, obj)
    return { x: Number(inst.params[xKey]), y: Number(inst.params[yKey]), i, color: subInstanceColor(def, inst.state) }
  })
  const sorted = [...pts].sort((a, b) => a.x - b.x)
  // The x-axis is age → time. The selected instance is "now"; anything past it is
  // the future, so the trend only runs UP TO the selected point (never beyond).
  const selX = selIndex != null ? pts.find(p => p.i === selIndex)?.x : null
  const visible = selX != null ? sorted.filter(p => p.x <= selX) : sorted
  const chosen = (selIndex != null ? pts.filter(p => p.i === selIndex) : []).map(p => [p.x, p.y])
  const axLabel = (d) => `${d.label}${d.unit ? ` (${d.unit})` : ''}`
  const thr = def.chart?.threshold   // { y, label } — draws a "below this is a fault" line + band

  const options = {
    chart: { type: 'line', height: 280, backgroundColor: 'transparent', style: { fontFamily: FONT }, spacing: [8, 8, 8, 8] },
    title: { text: `${yDef.label} vs ${xDef.label}`, style: { fontSize: '13px', color: C.text, fontWeight: '600' } },
    credits: { enabled: false }, legend: { enabled: false },
    xAxis: { title: { text: axLabel(xDef), style: { color: C.text3, fontSize: '11px' } }, gridLineColor: 'rgba(0,0,0,0.06)', lineColor: C.line, tickColor: C.line, labels: { style: { color: C.text3 } } },
    yAxis: {
      title: { text: axLabel(yDef), style: { color: C.text3, fontSize: '11px' } },
      gridLineColor: 'rgba(0,0,0,0.06)', labels: { style: { color: C.text3 } },
      plotBands: thr ? [{ from: -1e9, to: thr.y, color: 'rgba(255,59,48,0.07)' }] : [],
      plotLines: thr ? [{
        value: thr.y, color: '#ff3b30', width: 1.5, dashStyle: 'Dash', zIndex: 4,
        label: { text: thr.label, align: 'left', style: { color: '#ff3b30', fontSize: '10px' } },
      }] : [],
    },
    tooltip: { headerFormat: '', pointFormat: `${xDef.label}: {point.x}<br/>${yDef.label}: {point.y}` },
    series: [
      { type: 'line', name: yDef.label, color: 'rgba(10,132,255,0.45)', lineWidth: 1.5, zIndex: 1,
        data: visible.map(p => ({ x: p.x, y: p.y, marker: { fillColor: p.color, lineColor: '#fff', lineWidth: 1, radius: 4 } })),
        marker: { enabled: true } },
      { type: 'scatter', name: 'Selected', color: '#0a84ff', data: chosen, marker: { radius: 8, symbol: 'circle', lineColor: '#0a84ff', lineWidth: 2.5, fillColor: 'rgba(10,132,255,0.15)' }, zIndex: 5 },
    ],
  }
  return <HighchartsReact highcharts={Highcharts} options={options} />
}
