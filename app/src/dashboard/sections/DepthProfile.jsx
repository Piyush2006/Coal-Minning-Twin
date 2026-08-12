// Section · Depth Profile — drilling analytics. Three sub-views:
//   Depth Profile — compare boreholes' drilling curves (depth vs time/diesel) + KPIs
//   Formation    — one hole's rock-layer breakdown, banded curve + strata editor
//   Predict      — forecast a planned hole's time/fuel/cost (via Bruce)
// Self-contained: it uses its own borehole selectors, not the global date range.
import { useMemo, useState } from 'react'
import { useDash } from '../store'
import { BOREHOLES, boreholeDetail } from '../data/boreholes'
import { ROCKS, ROCK_OPTIONS } from '../data/geology'
import { buildDepthCompare, rockBaselines } from '../calc/depth'
import { predictWithBruce } from '../lib/brucePredict'
import { NUM, fmt } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { Panel, Dropdown, MultiSelect, Modal } from '../components/primitives'
import { usePagination, Pager, Segmented, Pill, th, td } from '../components/ui'
import { KpiStat } from '../components/KpiStat'
import { StrataColumn } from '../components/StrataColumn'
import { DepthCurve } from '../components/DepthCurve'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

const AXIS_OPTS = [{ id: 'time', name: 'Depth vs Time' }, { id: 'diesel', name: 'Depth vs Diesel' }, { id: 'both', name: 'Both (dual axis)' }]

// categorical borehole colours — from the redesign chart palette (violet #8B5CF6 is
// a chart series colour, distinct from the Bruce brand accent).
const HOLE_COLORS = ['#3E6DF4', '#0E9F6E', '#F59E0B', '#8B5CF6', '#E5484D', '#00B4D8']
const colorFor = (id) => HOLE_COLORS[BOREHOLES.findIndex(b => b.id === id) % HOLE_COLORS.length]
const toRGBA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }

const SUBTABS = [{ id: 'profile', label: 'Depth Profile' }, { id: 'formation', label: 'Formation' }, { id: 'predict', label: 'Predict' }]

export function DepthProfile() {
  const [view, setView] = useState('profile')
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const strataByHole = useDash(s => s.boreholeStrata)
  const ctx = useMemo(() => buildBruceContext({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan }), [range, mineId, areaId, equipTypeId, shiftMode, settings, plan])
  const anyUnreliable = useMemo(() => BOREHOLES.some(b => !boreholeDetail(b.id, strataByHole[b.id]).reliable), [strataByHole])

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <BruceInsight
        variant="rail"
        context={ctx}
        tone={anyUnreliable ? 'warning' : 'normal'}
        task="In 15-20 words, compare drilling performance across the boreholes — name the biggest speed or fuel outlier and any survey-depth mismatch to check."
        detail="Explain drilling performance across boreholes — rate of penetration, fuel intensity, geology differences, and any survey/recorded-depth mismatches." />

      <Segmented options={SUBTABS} value={view} onChange={setView} />

      {view === 'profile' && <ProfileView />}
      {view === 'formation' && <FormationView />}
      {view === 'predict' && <PredictView />}
    </div>
  )
}

// ── 1) Depth Profile ──────────────────────────────────────────────────────────
function ProfileView() {
  const strataByHole = useDash(s => s.boreholeStrata)
  const [sel, setSel] = useState(() => new Set(BOREHOLES.slice(0, 3).map(b => b.id)))
  const [axis, setAxis] = useState('time')       // time | diesel | both
  const [rank, setRank] = useState(null)         // null | 'rop' | 'fuel'
  const ids = BOREHOLES.filter(b => sel.has(b.id)).map(b => b.id)
  const cmp = useMemo(() => buildDepthCompare(ids, strataByHole), [ids.join(','), strataByHole])

  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const mkSeries = (key, ax = 0, dash = false) => cmp.holes.map(h => ({ name: h.id, color: colorFor(h.id), points: h[key].map(([x, y]) => ({ x, y })), axis: ax, dash }))
  const has = cmp.holes.length > 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <MultiSelect label="Boreholes" values={[...sel]} options={BOREHOLES.map(b => ({ id: b.id, name: b.name }))} onToggle={toggle} width={240} />
        <Dropdown label="Axis" value={axis} options={AXIS_OPTS} onChange={setAxis} width={200} />
      </div>

      {!has ? (
        <Panel><span className="BodyMediumRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Select one or more boreholes to compare their drilling curves.</span></Panel>
      ) : (
        <Panel>
          <div className="BodySmallSemibold" style={{ marginBottom: 6 }}>
            {axis === 'both' ? 'Depth vs Time & Diesel' : axis === 'diesel' ? 'Depth vs Diesel — fuel efficiency' : 'Depth vs Time — drilling speed'}
          </div>
          {axis === 'both'
            ? <DepthCurve height={400} series={[...mkSeries('curveTime', 0, false), ...mkSeries('curveDiesel', 1, true)]} xAxes={[{ label: 'Time (h)', position: 'bottom' }, { label: 'Diesel (L)', position: 'top' }]} />
            : axis === 'diesel'
              ? <DepthCurve series={mkSeries('curveDiesel', 0)} xAxes={[{ label: 'Diesel (L)', position: 'bottom' }]} />
              : <DepthCurve series={mkSeries('curveTime', 0)} xAxes={[{ label: 'Time (h)', position: 'bottom' }]} />}
        </Panel>
      )}

      {/* KPIs — click to rank all selected boreholes on that metric */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, alignItems: 'stretch' }}>
        <KpiStat label="Fastest drilling · ROP" value={cmp.bestROP ? cmp.bestROP.totals.rop : 0} dp={1} unit="m/h"
          kpi={{ status: 'positive' }}
          footer={cmp.bestROP ? `${cmp.bestROP.name} · ${cmp.bestROP.rig}` : 'select boreholes'}
          tooltip="Highest rate of penetration among the selected boreholes. Click to rank them all."
          onClick={has ? () => setRank('rop') : undefined} />
        <KpiStat label="Most fuel-efficient · Fuel Intensity" value={cmp.bestFuel ? cmp.bestFuel.totals.fuelIntensity : 0} dp={2} unit="L/m"
          kpi={{ status: 'positive' }}
          footer={cmp.bestFuel ? `${cmp.bestFuel.name} · ${cmp.bestFuel.rig}` : 'select boreholes'}
          tooltip="Least diesel burned per metre among the selected boreholes. Click to rank them all."
          onClick={has ? () => setRank('fuel') : undefined} />
      </div>

      <HoleRankModal mode={rank} holes={cmp.holes} onClose={() => setRank(null)} />
    </div>
  )
}

// ranked-borehole drill — same language as the equipment ranked drill
function HoleRankModal({ mode, holes, onClose }) {
  if (!mode) return null
  const isRop = mode === 'rop'
  const metric = (h) => isRop ? h.totals.rop : h.totals.fuelIntensity
  const ranked = [...holes].sort((a, b) => isRop ? metric(b) - metric(a) : metric(a) - metric(b))
  const vals = ranked.map(metric)
  const maxV = Math.max(...vals, 0.0001), minV = Math.min(...vals)
  const barPct = (v) => Math.max(6, Math.round((isRop ? v / maxV : minV / v) * 100))
  return (
    <Modal isOpen onClose={onClose} maxWidth={620}
      title={isRop ? 'Rate of penetration — ranked' : 'Fuel intensity — ranked'}
      subtitle={`${ranked.length} selected borehole${ranked.length === 1 ? '' : 's'} · ${isRop ? 'fastest first' : 'least diesel per metre first'}`}>
      <div style={{ display: 'grid', gap: 8 }}>
        {ranked.map((h, i) => {
          const v = metric(h)
          return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)' }}>
              <span className="BodySmallSemibold" style={{ width: 16, color: 'var(--text-gray-tertiary)', ...NUM }}>{i + 1}</span>
              <div style={{ minWidth: 130 }}>
                <div className="BodySmallSemibold">{h.name}</div>
                <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{h.rig}</div>
              </div>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--border-gray-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${barPct(v)}%`, height: '100%', borderRadius: 999, background: colorFor(h.id) }} />
              </div>
              <span className="BodySmallSemibold" style={{ ...NUM, width: 86, textAlign: 'right' }}>{fmt(v, isRop ? 1 : 2)} {isRop ? 'm/h' : 'L/m'}</span>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ── 2) Formation ──────────────────────────────────────────────────────────────
function FormationView() {
  const strataByHole = useDash(s => s.boreholeStrata)
  const openPlan = useDash(s => s.openPlan)
  const settings = useDash(s => s.settings)
  const [id, setId] = useState(BOREHOLES[0].id)
  const detail = useMemo(() => boreholeDetail(id, strataByHole[id]), [id, strataByHole])
  const bands = detail.strata.map(L => ({ from: L.top, to: L.bottom, color: toRGBA((ROCKS[L.rock] || {}).color || '#999', 0.16) }))
  const fuelCost = Math.round(detail.totals.diesel * settings.fuelCostPerLitre)
  const pg = usePagination(detail.strata, { resetKey: id })

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Dropdown label="Borehole" value={id} options={BOREHOLES.map(b => ({ id: b.id, name: b.name }))} onChange={setId} width={230} />
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Roll label="Total depth" value={`${fmt(detail.totals.depth, 1)} m`} />
          <Roll label="Overall ROP" value={`${fmt(detail.totals.rop, 1)} m/h`} />
          <Roll label="Total diesel" value={`${fmt(detail.totals.diesel)} L`} />
          <Roll label="Fuel cost" value={`${CURRENCY}${fmt(fuelCost)}`} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 18, alignItems: 'start' }}>
        <Panel style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Strata</span>
          <StrataColumn strata={detail.strata} />
        </Panel>

        <div style={{ display: 'grid', gap: 16 }}>
          {!detail.reliable ? (
            <Panel style={{ borderColor: 'var(--background-warning-default)' }}>
              <div className="BodySmallSemibold" style={{ color: 'var(--text-warning-default)', marginBottom: 4 }}>Per-layer metrics hidden — survey mismatch</div>
              <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>
                Survey depth ({fmt(detail.surveyDepth, 1)} m) disagrees with the recorded depth ({fmt(detail.recordedDepth, 1)} m) beyond tolerance, so per-layer figures aren't shown. Adjust the strata to reconcile.
              </span>
            </Panel>
          ) : (
            <Panel pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead><tr>
                    <th style={th('left')}>Layer</th><th style={th('right')}>ROP (m/h)</th><th style={th('right')}>Fuel/m (L)</th><th style={th('right')}>RPM</th><th style={th('right')}>SPP (bar)</th><th style={th('right')}>Hook (t)</th><th style={th('right')}>Hours</th><th style={th('right')}>{CURRENCY}/m</th>
                  </tr></thead>
                  <tbody>
                    {pg.pageItems.map((L) => (
                      <tr key={L.top}>
                        <td style={td('left')}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: (ROCKS[L.rock] || {}).color }} />{(ROCKS[L.rock] || {}).name}</span></td>
                        <td style={{ ...td('right'), ...NUM }}>{fmt(L.rop, 1)}</td><td style={{ ...td('right'), ...NUM }}>{fmt(L.fuelPerM, 2)}</td><td style={{ ...td('right'), ...NUM }}>{fmt(L.rpm)}</td><td style={{ ...td('right'), ...NUM }}>{fmt(L.spp)}</td><td style={{ ...td('right'), ...NUM }}>{fmt(L.hookLoad, 1)}</td><td style={{ ...td('right'), ...NUM }}>{fmt(L.hours, 1)}</td><td style={{ ...td('right'), ...NUM }}>{CURRENCY}{fmt(L.costPerM)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager {...pg} />
            </Panel>
          )}

          <Panel>
            <div className="BodySmallSemibold" style={{ marginBottom: 6 }}>Depth vs Time — banded by formation</div>
            <DepthCurve series={[{ name: id, color: colorFor(id), points: detail.curve.map(p => ({ x: p.timeH, y: p.depth })), axis: 0 }]} xAxes={[{ label: 'Time (h)', position: 'bottom' }]} bands={bands} height={300} />
          </Panel>

          {/* strata are edited in Plan Management */}
          <Panel style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Strata are managed in Plan Management — add layers manually or import them from Excel.</span>
            <button onClick={() => openPlan('strata')} className="BodySmallSemibold"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              Manage strata
            </button>
          </Panel>
        </div>
      </div>
    </div>
  )
}
const Roll = ({ label, value }) => (
  <div style={{ display: 'grid', gap: 2 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodyLargeSemibold" style={{ ...NUM }}>{value}</span>
  </div>
)

// ── 3) Predict ────────────────────────────────────────────────────────────────
function PredictView() {
  const baselines = useMemo(() => rockBaselines(), [])
  const [layers, setLayers] = useState([{ rock: 'soil', thickness: 8 }, { rock: 'sandstone', thickness: 20 }, { rock: 'coal', thickness: 6 }, { rock: 'basalt', thickness: 12 }])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const pgp = usePagination(result?.perLayer || [], { resetKey: result })

  const setLayer = (i, patch) => setLayers(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const addLayer = () => setLayers(ls => [...ls, { rock: 'sandstone', thickness: 10 }])
  const removeLayer = (i) => setLayers(ls => ls.filter((_, idx) => idx !== i))

  const run = async () => {
    setBusy(true)
    try { setResult(await predictWithBruce(baselines, layers)) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 18, alignItems: 'start' }}>
      {/* planned column builder */}
      <Panel>
        <div className="BodySmallSemibold" style={{ marginBottom: 10 }}>Planned column (top → bottom)</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {layers.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: (ROCKS[l.rock] || {}).color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><Dropdown value={l.rock} options={ROCK_OPTIONS} onChange={(v) => setLayer(i, { rock: v })} width={140} /></div>
              <input type="number" value={l.thickness} min="0.1" step="1" onChange={e => setLayer(i, { thickness: Math.max(0.1, Number(e.target.value) || 0) })}
                style={{ width: 72, height: 34, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', font: 'inherit', textAlign: 'right', color: 'var(--text-gray-primary)' }} />
              <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>m</span>
              <button onClick={() => removeLayer(i)} title="Remove layer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray-tertiary)', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <button onClick={addLayer} className="BodySmallSemibold" style={{ background: 'none', border: 'none', color: 'var(--text-brand-default)', cursor: 'pointer' }}>+ Add layer</button>
          <button onClick={run} disabled={busy} className="BodySmallSemibold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, border: 'none', color: '#fff', cursor: busy ? 'default' : 'pointer', background: busy ? 'var(--border-gray-default)' : 'linear-gradient(135deg,#a779f0,#5b5bf0)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 5.6L19.5 9l-5.8 1.4L12 16l-1.7-5.6L4.5 9l5.8-1.4z" /></svg>
            {busy ? 'Predicting…' : 'Predict with Bruce'}
          </button>
        </div>
      </Panel>

      {/* forecast */}
      {!result ? (
        <Panel><span className="BodyMediumRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Build a planned column and run the forecast — Bruce estimates drilling time, diesel and cost from the historical per-rock rates.</span></Panel>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <Well label="Depth" value={`${fmt(result.totals.depthM, 1)} m`} />
            <Well label="Time" value={`${fmt(result.totals.hours, 1)} h`} />
            <Well label="Diesel" value={`${fmt(result.totals.diesel)} L`} />
            <Well label="Cost" value={`${CURRENCY}${fmt(result.totals.costRs)}`} />
            <Well label="ROP" value={`${fmt(result.totals.rop, 1)} m/h`} />
            <Well label="Fuel/m" value={`${fmt(result.totals.fuelIntensity, 2)} L/m`} />
          </div>
          <Panel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="BodySmallSemibold">Forecast</span>
              <Pill tone={result.source === 'bruce' ? 'info' : 'neutral'}>{result.source === 'bruce' ? 'Bruce' : 'estimate'}</Pill>
            </div>
            {result.rationale && <div className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)', marginBottom: 10 }}>{result.rationale}</div>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr><th style={th('left')}>Layer</th><th style={th('right')}>Thickness (m)</th><th style={th('right')}>Hours</th><th style={th('right')}>Diesel (L)</th><th style={th('right')}>{CURRENCY}</th></tr></thead>
                <tbody>
                  {pgp.pageItems.map((l, i) => (
                    <tr key={i}><td style={td('left')}>{ROCKS[l.rock]?.name || l.rock}</td><td style={{ ...td('right'), ...NUM }}>{fmt(l.thicknessM, 1)}</td><td style={{ ...td('right'), ...NUM }}>{fmt(l.hours, 1)}</td><td style={{ ...td('right'), ...NUM }}>{fmt(l.diesel)}</td><td style={{ ...td('right'), ...NUM }}>{CURRENCY}{fmt(l.costRs)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...pgp} />
          </Panel>
          {result.curve && result.curve.length > 1 && (
            <Panel><div className="BodySmallSemibold" style={{ marginBottom: 6 }}>Predicted depth vs time</div><DepthCurve series={[{ name: 'Forecast', color: '#5b5bf0', points: result.curve.map(p => ({ x: p.timeH, y: p.depth })), axis: 0 }]} xAxes={[{ label: 'Time (h)', position: 'bottom' }]} height={280} /></Panel>
          )}
        </div>
      )}
    </div>
  )
}
// forecast summary well — a modal-style well, not a page-level KPI card
const Well = ({ label, value }) => (
  <div style={{ display: 'grid', gap: 3, padding: '12px 14px', borderRadius: 'var(--global-border-radius-medium)', background: 'var(--background-surface-subtle)', minWidth: 0 }}>
    <span className="eyebrow">{label}</span>
    <span className="BodyLargeSemibold" style={{ ...NUM }}>{value}</span>
  </div>
)
