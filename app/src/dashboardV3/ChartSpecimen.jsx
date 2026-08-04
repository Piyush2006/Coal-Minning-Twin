// Chart-language specimen for the Step-1 gate. One Highcharts line/area proving
// the §3.3 theme (plan/actual convention, annotation layer, black-pill tooltip,
// crosshair, gradient, end-dot), plus the hand-rolled ghost-track bars (actual
// inside capacity — the mining pattern used heavily from Step 4 on).
//
// Data here is a deterministic preview of the golden-shift shape (Step 2 builds
// the real fixture): rate-segmented cumulative tonnes, 14:00 → 22:00, closing at
// 4,180 t vs 4,800 t plan. No Math.random anywhere.
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { dv3BaseOptions, planSeries, actualSeries, annotation } from './hcTheme'

const T0 = Date.UTC(2026, 7, 4, 14, 0)   // 14:00 shift open (fixed date — deterministic)
const MIN = 60_000
const at = (h, m) => Date.UTC(2026, 7, 4, h, m)

// rate segments (t/min) following the §8 narrative shape
const SEGMENTS = [
  { until: at(15, 10), rate: 10.0 },   // on pace
  { until: at(16, 35), rate: 8.9 },    // SH-02 fill factor down
  { until: at(16, 52), rate: 7.0 },    // feed destabilising
  { until: at(17, 44), rate: 0.9 },    // CR-01 choke + clear-out
  { until: at(18, 30), rate: 8.0 },    // restart ramp
  { until: at(19, 15), rate: 11.0 },   // re-sequenced recovery
  { until: at(20, 5), rate: 10.5 },
  { until: at(20, 39), rate: 8.5 },    // weighbridge queue
  { until: at(22, 0), rate: 10.86 },
]

function buildActual() {
  const pts = []
  let t = T0, v = 0
  while (t <= at(22, 0)) {
    pts.push([t, Math.round(v)])
    const seg = SEGMENTS.find(s => t < s.until) ?? SEGMENTS[SEGMENTS.length - 1]
    v += seg.rate * 10
    t += 10 * MIN
  }
  const k = 4180 / pts[pts.length - 1][1]           // normalise close to exactly 4,180 t
  return pts.map(([x, y]) => [x, Math.round(y * k)])
}
const ACTUAL = buildActual()
const PLAN = [[T0, 0], [at(22, 0), 4800]]

const fmtT = (ts) => Highcharts.dateFormat('%H:%M', ts)

export function ShiftLineSpecimen() {
  const options = {
    ...dv3BaseOptions(),
    chart: { ...dv3BaseOptions().chart, height: 260 },
    xAxis: {
      ...dv3BaseOptions().xAxis,
      plotLines: [
        annotation(at(14, 20), 'CV-01 drift'),
        annotation(at(16, 52), 'CR-01 choke'),
        annotation(at(18, 30), 'Re-sequence'),
        annotation(at(20, 5), 'Rake delay'),
      ],
    },
    yAxis: { ...dv3BaseOptions().yAxis, max: 5000 },
    tooltip: {
      ...dv3BaseOptions().tooltip,
      shared: false,
      formatter() {
        const planAt = Math.round(((this.x - T0) / (at(22, 0) - T0)) * 4800)
        const d = this.y - planAt
        return `<div class="dv3-tooltip"><div style="font-size:11px;opacity:.65;margin-bottom:3px">${fmtT(this.x)} · Shift B</div>` +
          `<div style="display:flex;gap:10px;align-items:baseline"><b>${this.y.toLocaleString()} t</b>` +
          `<span style="opacity:.75">plan ${planAt.toLocaleString()} t</span>` +
          `<span style="color:${d < 0 ? '#F97066' : '#6CE9A6'}">${d < 0 ? '−' : '+'}${Math.abs(d).toLocaleString()}</span></div></div>`
      },
    },
    series: [planSeries(PLAN), actualSeries(ACTUAL)],
  }
  return (
    <div>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <div className="dv3-support" style={{ marginTop: 4, display: 'flex', gap: 16, fontSize: 12 }}>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px solid var(--series-1)', verticalAlign: 'middle', marginRight: 6 }} />Actual</span>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px dashed var(--baseline)', verticalAlign: 'middle', marginRight: 6 }} />Plan</span>
        <span className="dv3-tert">hover for the tooltip + crosshair · vertical rules are the annotation layer (R3)</span>
      </div>
    </div>
  )
}

/* ── ghost-track bars: actual TPH drawn inside its capacity track (§3.3) ── */
const STAGES = [
  { id: 'Loading', actual: 950, cap: 1400 },
  { id: 'Haulage', actual: 1010, cap: 1500 },
  { id: 'Crushing', actual: 780, cap: 1200, constraint: true },
  { id: 'Conveying', actual: 1080, cap: 1800 },
  { id: 'CHP', actual: 900, cap: 1300 },
]
export function GhostTrackSpecimen() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {STAGES.map(s => (
        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '86px 1fr 130px', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: s.constraint ? 600 : 400, color: s.constraint ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {s.id}{s.constraint && <span className="dv3-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', marginLeft: 6 }}>constraint</span>}
          </div>
          <div className="dv3-well" style={{ height: 16, borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${(s.actual / s.cap) * 100}%`,
              background: s.constraint ? 'var(--series-1)' : 'rgba(43,92,231,0.45)', borderRadius: 5 }} />
          </div>
          <div className="dv3-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {s.actual.toLocaleString()} / {s.cap.toLocaleString()} TPH
          </div>
        </div>
      ))}
    </div>
  )
}
