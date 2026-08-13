// Global Highcharts theme for the dashboard redesign. design-sdk uses the same
// top-level highcharts instance, so setOptions here restyles every chart.
// v2 — reference-grade minimal: naked axes (no titles — hidden via CSS too),
// whisper gridlines, thick rounded bars, round-capped 2.5px lines with markers
// only on hover, slim legend, and a dark floating tooltip pill.
import Highcharts from 'highcharts'

Highcharts.setOptions({
  colors: ['#3E6DF4', '#F59E0B', '#0E9F6E', '#8B5CF6', '#E5484D', '#98A2B3'],
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: "'Inter', system-ui, sans-serif" },
    spacing: [14, 8, 8, 6],
  },
  title: { style: { color: '#0F1728', fontFamily: "'Manrope', 'Inter', sans-serif", fontWeight: '700', fontSize: '14.5px' }, align: 'left', margin: 20 },
  subtitle: { style: { color: '#98A2B3', fontSize: '11px' }, align: 'left' },
  xAxis: {
    lineColor: '#EEF1F7', tickLength: 0, gridLineWidth: 0,
    labels: { style: { color: '#98A2B3', fontSize: '11px' } },
  },
  yAxis: {
    gridLineColor: '#EEF1F7', gridLineWidth: 1, lineWidth: 0, tickWidth: 0, tickPixelInterval: 72,
    labels: { style: { color: '#98A2B3', fontSize: '11px' } },
  },
  legend: {
    itemStyle: { color: '#5B6577', fontWeight: '500', fontSize: '11.5px' },
    itemHoverStyle: { color: '#0F1728' },
    symbolRadius: 5, symbolHeight: 9, symbolWidth: 9, itemDistance: 18,
  },
  // dark floating pill (reference style) — white text, no border, soft drop
  tooltip: {
    backgroundColor: '#0F1728', borderColor: 'transparent', borderRadius: 10, borderWidth: 0,
    shadow: { color: 'rgba(16,24,40,0.28)', offsetX: 0, offsetY: 6, width: 12, opacity: 0.28 },
    padding: 10,
    style: { color: '#FFFFFF', fontSize: '11.5px' },
    headerFormat: '<span style="font-size:10.5px;color:#98A2B3">{point.key}</span><br/>',
  },
  plotOptions: {
    column: { borderRadius: 7, borderWidth: 0, groupPadding: 0.16, pointPadding: 0.06, maxPointWidth: 30 },
    bar: { borderRadius: 7, borderWidth: 0, maxPointWidth: 22 },
    series: {
      animation: { duration: 260 },
      marker: { enabled: false, radius: 3, lineWidth: 0, symbol: 'circle', states: { hover: { enabled: true, radius: 4 } } },
    },
    line: { lineWidth: 2.5, linecap: 'round' },
    spline: { lineWidth: 2.5, linecap: 'round' },
    area: { lineWidth: 2.5, fillOpacity: 0.08, marker: { enabled: false } },
    areaspline: { lineWidth: 2.5, fillOpacity: 0.08, marker: { enabled: false } },
  },
  credits: { enabled: false },
})

export default Highcharts
