// Production loss waterfall — the centrepiece (§7.1). Plan and Actual are
// full-width reference bars (top and bottom); the loss cascade BETWEEN them is
// scaled to the GAP (plan − actual), not to zero, so it fills the card width and
// is readable. Each step descends from the plan line to the actual line, its
// width ∝ its share of the gap, fill encoding controllability. Displayed
// integers come from largest-remainder allocation and the component ASSERTS the
// rendered values reconcile — a failure renders a defect chip.
import { useMemo } from 'react'
import { largestRemainder } from '../data/arbitration'
import { BUCKET_LABEL } from './derive'
import { useScrub } from './store'

const ORDER = ['crushing', 'faceLoading', 'dispatch', 'external', 'residual']
const FILL = {
  crushing: '#E5871F', faceLoading: '#E5871F', dispatch: '#E5871F',
  external: 'url(#wf-ext)', residual: 'url(#wf-res)',
}
const L = 8, R = 12, BAR_H = 24, PLAN_Y = 4, BAND_TOP = 40, BAND_H = 156

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

export function Waterfall({ snap, width = 660 }) {
  const openDrill = useScrub(s => s.openDrill)

  const model = useMemo(() => {
    const liveBuckets = ORDER.map(b => snap.buckets[b] ?? 0)
    const lr = largestRemainder([snap.actual, ...liveBuckets], snap.planTo)
    const [actualD, ...bucketD] = lr.parts
    const planD = lr.total
    const ok = actualD + bucketD.reduce((a, b) => a + b, 0) === planD
    return { planD, actualD, bucketD, ok }
  }, [snap])

  const rows = ORDER.map((b, i) => ({ b, t: model.bucketD[i] })).filter(r => r.t > 0)
  const totalLoss = Math.max(1, model.planD - model.actualD)
  const usableW = width - L - R
  const yTop = BAND_TOP, yBot = BAND_TOP + BAND_H
  const actualY = yBot + 18
  const H = actualY + BAR_H + 8

  // cascade geometry: each step's x spans its share of the gap (full width),
  // its top edge steps down from plan level to actual level.
  let cum = 0
  const steps = rows.map(r => {
    const f0 = cum / totalLoss, f1 = (cum + r.t) / totalLoss
    cum += r.t
    const xA = L + f0 * usableW, xB = L + f1 * usableW
    const topY = yTop + f0 * (yBot - yTop)
    return { ...r, xA, xB, topY, w: xB - xA, mid: (xA + xB) / 2 }
  })

  return (
    <div>
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} style={{ display: 'block', width: '100%' }}>
        <WaterfallDefs />

        {/* Plan reference — full width */}
        <rect x={L} y={PLAN_Y} width={usableW} height={BAR_H} rx={5} fill="var(--surface-2)" stroke="#A9B2C1" strokeDasharray="5 4" strokeWidth="1.5" />
        <text x={L + 10} y={PLAN_Y + BAR_H / 2 + 4} fontSize="12" fill="var(--text-secondary)">Plan to now</text>
        <text x={L + usableW - 10} y={PLAN_Y + BAR_H / 2 + 4} textAnchor="end" fontSize="12.5" fontWeight="700" fill="var(--text-primary)">{model.planD.toLocaleString()} t</text>

        {/* loss cascade — fills the gap between plan and actual */}
        {steps.map((s) => {
          const showName = s.w > 66, showT = s.w > 30
          return (
            <g key={s.b} style={{ cursor: 'pointer' }} onClick={() => openDrill(s.b)}>
              <rect x={s.xA + 0.5} y={s.topY} width={Math.max(1, s.w - 1)} height={yBot - s.topY} rx={2} fill={FILL[s.b]} opacity={0.9} />
              {/* step tread along the top edge */}
              <line x1={s.xA} y1={s.topY} x2={s.xB} y2={s.topY} stroke="rgba(16,24,40,0.28)" strokeWidth="1.2" />
              {showName && <text x={s.mid} y={s.topY + 16} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{BUCKET_LABEL[s.b]}</text>}
              {showT && <text x={s.mid} y={s.topY + (showName ? 30 : 16)} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="700">−{s.t.toLocaleString()}</text>}
              {/* tick + tiny label under the band for narrow steps */}
              {!showName && <text x={s.mid} y={yBot + 12} textAnchor="middle" fontSize="9" fill="var(--text-tertiary)">{BUCKET_LABEL[s.b].split(' ')[0]}</text>}
            </g>
          )
        })}
        {/* connective: plan line steps down to actual */}
        <polyline points={`${L},${yTop} ${steps.length ? steps[0].xA : L},${yTop} ${steps.map(s => `${s.xB},${s.topY + (s.xB - s.xA >= 0 ? 0 : 0)}`).join(' ')} ${L + usableW},${yBot}`}
          fill="none" stroke="rgba(16,24,40,0.25)" strokeWidth="1" strokeDasharray="2 3" />

        {/* Actual reference — full width */}
        <rect x={L} y={actualY} width={usableW} height={BAR_H} rx={5} fill="var(--accent)" />
        <text x={L + 10} y={actualY + BAR_H / 2 + 4} fontSize="12" fill="#fff" opacity={0.85}>Actual</text>
        <text x={L + usableW - 10} y={actualY + BAR_H / 2 + 4} textAnchor="end" fontSize="12.5" fontWeight="700" fill="#fff">{model.actualD.toLocaleString()} t</text>
      </svg>

      {!model.ok && (
        <span className="dv3-chip" style={{ background: '#FDECEC', color: '#B42318', fontFamily: 'var(--font-mono)' }}>⚠ RENDER DEFECT — waterfall does not sum</span>
      )}
      <div className="dv3-support" style={{ fontSize: 11.5, marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span className="dv3-tert">bar widths show the gap ({(model.planD - model.actualD).toLocaleString()} t), not zero</span>
        <span><svg width="12" height="10"><rect width="12" height="10" rx="2" fill="#E5871F" /></svg> controllable</span>
        <span><svg width="12" height="10"><rect width="12" height="10" rx="2" fill="url(#wf-ext)" /></svg> external</span>
        <span><svg width="12" height="10"><rect width="12" height="10" rx="2" fill="url(#wf-res)" /></svg> residual</span>
        <span className="dv3-tert">click a step to open its loss events</span>
      </div>
    </div>
  )
}
