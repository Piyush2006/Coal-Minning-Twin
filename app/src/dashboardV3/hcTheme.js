// Shared Highcharts theme targeting brief §3.3 exactly. One place; every
// standard line/area chart consumes this. The four bespoke components
// (waterfall, ribbon, Gantt, process chain) are hand-built SVG and never
// touch Highcharts.
//
// §3.3 requirements encoded here:
//   • horizontal gridlines only, max 4, #EDF0F5 — never vertical on time axes
//   • plan/actual convention: dashed #A9B2C1 behind, solid #2B5CE7 in front
//   • gradient area fill on the primary series only, accent 16% → 0
//   • 2px lines, round cap/join; 8px end-dot with 2px white ring
//   • black-pill tooltip + 1px accent crosshair at 30%
//   • no legend (the convention replaces it), no credits, no animations on data

const FONT_UI = "'Inter Var', 'Inter', system-ui, sans-serif"

export function dv3BaseOptions() {
  return {
    chart: {
      backgroundColor: 'transparent',
      style: { fontFamily: FONT_UI },
      spacing: [8, 4, 4, 4],
      animation: false,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: { enabled: false },
    accessibility: { enabled: false },
    plotOptions: {
      series: {
        animation: false,                        // never animate data (§3.1)
        lineWidth: 2,
        linecap: 'round',
        marker: { enabled: false, symbol: 'circle' },
        states: { hover: { lineWidthPlus: 0 } },
      },
    },
    xAxis: {
      type: 'datetime',
      gridLineWidth: 0,                          // never vertical gridlines
      lineColor: '#EDF0F5',
      tickWidth: 0,
      // control-room convention: 24-hour clock, always
      dateTimeLabelFormats: { hour: '%H:%M', minute: '%H:%M', day: '%H:%M' },
      labels: { style: { color: '#8A94A6', fontSize: '11px' } },
      crosshair: { width: 1, color: 'rgba(43,92,231,0.30)' },
    },
    yAxis: {
      title: { text: null },
      gridLineColor: '#EDF0F5',
      tickAmount: 4,                             // max 4 horizontal gridlines
      labels: { style: { color: '#8A94A6', fontSize: '11px' } },
    },
    tooltip: {
      useHTML: true,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadow: false,
      padding: 0,
      style: { fontFamily: FONT_UI },
    },
  }
}

/* plan series — ALWAYS this, ALWAYS dashed, ALWAYS behind */
export const planSeries = (data, name = 'Plan') => ({
  name, data,
  type: 'line',
  color: '#A9B2C1',
  dashStyle: 'Dash',
  lineWidth: 1.5,
  zIndex: 1,
  enableMouseTracking: false,
})

/* actual series — solid accent in front, gradient 16% → 0, end-dot on last point */
export function actualSeries(data, name = 'Actual') {
  const d = data.slice()
  const last = d[d.length - 1]
  d[d.length - 1] = { x: last[0], y: last[1], marker: { enabled: true, radius: 4, fillColor: '#2B5CE7', lineColor: '#FFFFFF', lineWidth: 2 } }
  return {
    name, data: d,
    type: 'area',
    color: '#2B5CE7',
    zIndex: 2,
    fillColor: {
      linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
      stops: [[0, 'rgba(43,92,231,0.16)'], [1, 'rgba(43,92,231,0)']],
    },
  }
}

/* annotation layer (R3): thin vertical rule + small label */
export const annotation = (ts, text) => ({
  value: ts,
  color: 'rgba(16,24,40,0.18)',
  width: 1,
  zIndex: 4,
  label: { text, rotation: 0, y: 12, x: 4, style: { fontSize: '10px', color: '#8A94A6', fontWeight: '500' } },
})
