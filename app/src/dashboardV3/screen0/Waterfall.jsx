// Production loss waterfall — the centrepiece (§7.1). Hand-rolled SVG,
// horizontal: plan → ordered loss bars (width ∝ tonnes) → actual. Fill encodes
// controllability (solid = controllable, hatch = external, stripe = residual).
// Displayed integers come from largest-remainder allocation and the component
// ASSERTS the rendered values reconcile — a failure renders a defect chip.
import { useMemo } from 'react'
import { largestRemainder } from '../data/arbitration'
import { BUCKET_LABEL } from './derive'
import { useScrub } from './store'

const ORDER = ['crushing', 'faceLoading', 'dispatch', 'external', 'residual']
const FILL = {
  crushing: '#E5871F', faceLoading: '#E5871F', dispatch: '#E5871F',
  external: 'url(#wf-ext)', residual: 'url(#wf-res)',
}
const BAR_H = 26, GAP = 9, LABEL_W = 118

export function WaterfallDefs() {
  return (
    <defs>
      <pattern id="wf-ext" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="#8A94A6" />
        <line x1="0" y1="0" x2="0" y2="7" stroke="#fff" strokeWidth="2.4" strokeOpacity="0.55" />
      </pattern>
      <pattern id="wf-res" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#C6CDD8" />
        <rect width="3" height="6" fill="#fff" fillOpacity="0.7" />
      </pattern>
    </defs>
  )
}

export function Waterfall({ snap, width = 640 }) {
  const openDrill = useScrub(s => s.openDrill)

  const model = useMemo(() => {
    const liveBuckets = ORDER.map(b => snap.buckets[b] ?? 0)
    const planTo = snap.planTo
    // rendered integers: [actual, ...buckets] must sum to displayed plan exactly
    const lr = largestRemainder([snap.actual, ...liveBuckets], planTo)
    const [actualD, ...bucketD] = lr.parts
    const planD = lr.total
    const ok = actualD + bucketD.reduce((a, b) => a + b, 0) === planD
    return { planD, actualD, bucketD, ok }
  }, [snap])

  const rows = ORDER.map((b, i) => ({ b, t: model.bucketD[i] })).filter(r => r.t > 0)
  const H = (rows.length + 2) * (BAR_H + GAP) + 18
  const scale = (width - LABEL_W - 76) / Math.max(1, model.planD)
  let xEnd = LABEL_W + model.planD * scale

  return (
    <div>
      <svg width={width} height={H} style={{ display: 'block', maxWidth: '100%' }}>
        <WaterfallDefs />
        {/* plan */}
        <text x={LABEL_W - 10} y={BAR_H / 2 + 4} textAnchor="end" fontSize="12" fill="var(--text-secondary)">Plan to now</text>
        <rect x={LABEL_W} y={0} width={model.planD * scale} height={BAR_H} rx={5} fill="var(--surface-2)" stroke="#A9B2C1" strokeDasharray="5 4" strokeWidth="1.5" />
        <text x={LABEL_W + 10} y={BAR_H / 2 + 4} fontSize="12.5" fontWeight="600" fill="var(--text-primary)">{model.planD.toLocaleString()} t</text>

        {rows.map((r, i) => {
          const w = Math.max(1.5, r.t * scale)
          const y = (i + 1) * (BAR_H + GAP)
          const x = xEnd - w
          xEnd = x
          return (
            <g key={r.b} style={{ cursor: 'pointer' }} onClick={() => openDrill(r.b)}>
              <line x1={x + w} y1={y - GAP} x2={x + w} y2={y + BAR_H / 2} stroke="var(--hairline)" strokeWidth="1" />
              <rect x={x} y={y} width={w} height={BAR_H} rx={4} fill={FILL[r.b]} opacity={0.92} />
              <text x={x - 8} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize="12" fill="var(--text-secondary)">
                {BUCKET_LABEL[r.b]} <tspan fontWeight="700" fill="var(--text-primary)">−{r.t.toLocaleString()} t</tspan>
              </text>
            </g>
          )
        })}

        {/* actual */}
        <text x={LABEL_W - 10} y={H - 18 - BAR_H / 2 + 4} textAnchor="end" fontSize="12" fill="var(--text-secondary)">Actual</text>
        <line x1={xEnd} y1={H - 18 - BAR_H - GAP + BAR_H / 2} x2={xEnd} y2={H - 18 - BAR_H / 2} stroke="var(--hairline)" strokeWidth="1" />
        <rect x={LABEL_W} y={H - 18 - BAR_H} width={Math.max(1, model.actualD * scale)} height={BAR_H} rx={5} fill="var(--accent)" />
        <text x={LABEL_W + 10} y={H - 18 - BAR_H / 2 + 4} fontSize="12.5" fontWeight="700" fill="#fff">{model.actualD.toLocaleString()} t</text>
      </svg>
      {!model.ok && (
        <span className="dv3-chip" style={{ background: '#FDECEC', color: '#B42318', fontFamily: 'var(--font-mono)' }}>
          ⚠ RENDER DEFECT — waterfall does not sum
        </span>
      )}
      <div className="dv3-support" style={{ fontSize: 11.5, marginTop: 2, display: 'flex', gap: 14 }}>
        <span><svg width="12" height="10"><rect width="12" height="10" rx="2" fill="#E5871F" /></svg> controllable</span>
        <span><svg width="12" height="10"><rect width="12" height="10" rx="2" fill="url(#wf-ext)" /></svg> external</span>
        <span><svg width="12" height="10"><rect width="12" height="10" rx="2" fill="url(#wf-res)" /></svg> residual</span>
        <span className="dv3-tert">click a bar to open its loss events</span>
      </div>
    </div>
  )
}
