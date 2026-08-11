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
import { Panel, KpiTile, Dropdown, MultiSelect } from '../components/primitives'
import { StrataColumn } from '../components/StrataColumn'
import { DepthCurve } from '../components/DepthCurve'

const AXIS_OPTS = [{ id: 'time', name: 'Depth vs Time' }, { id: 'diesel', name: 'Depth vs Diesel' }, { id: 'both', name: 'Both (dual axis)' }]

// categorical borehole colours — from the redesign chart palette (violet #8B5CF6 is
// a chart series colour, distinct from the Bruce brand accent).
const HOLE_COLORS = ['#3E6DF4', '#0E9F6E', '#F59E0B', '#8B5CF6', '#E5484D', '#00B4D8']
const colorFor = (id) => HOLE_COLORS[BOREHOLES.findIndex(b => b.id === id) % HOLE_COLORS.length]
const toRGBA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }

const SUBTABS = [{ id: 'profile', label: 'Depth Profile' }, { id: 'formation', label: 'Formation' }, { id: 'predict', label: 'Predict' }]
const SegBtn = ({ active, onClick, children }) => (
  <button onClick={onClick} className="BodySmallSemibold"
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-gray-primary)' }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-gray-secondary)' }}
    style={{ padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', font: 'inherit', transition: 'color 150ms',
      background: active ? 'var(--background-surface-intense)' : 'transparent',
      color: active ? 'var(--text-gray-primary)' : 'var(--text-gray-secondary)',
      boxShadow: active ? 'var(--fds-shadow-sm)' : 'none' }}>
    {children}
  </button>
)
const th = (a = 'right') => ({ padding: '10px 10px', textAlign: a, color: 'var(--text-gray-tertiary)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-gray-subtle)', background: 'var(--background-surface-subtle)' })
const td = (a = 'right') => ({ padding: '9px 10px', textAlign: a, whiteSpace: 'nowrap', borderTop: '1px solid var(--border-gray-subtle)', ...NUM })

export function DepthProfile() {
  const [view, setView] = useState('profile')
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--background-surface-subtle)', border: '1px solid var(--border-gray-subtle)', justifySelf: 'start' }}>
        {SUBTABS.map(t => <SegBtn key={t.id} active={view === t.id} onClick={() => setView(t.id)}>{t.label}</SegBtn>)}
      </div>
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
  const ids = BOREHOLES.filter(b => sel.has(b.id)).map(b => b.id)
  const cmp = useMemo(() => buildDepthCompare(ids, strataByHole), [ids.join(','), strataByHole])

  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const mkSeries = (key, ax = 0, dash = false) => cmp.holes.map(h => ({ name: h.id, color: colorFor(h.id), points: h[key].map(([x, y]) => ({ x, y })), axis: ax, dash }))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <MultiSelect label="Boreholes" values={[...sel]} options={BOREHOLES.map(b => ({ id: b.id, name: b.name }))} onToggle={toggle} width={240} />
        <Dropdown label="Axis" value={axis} options={AXIS_OPTS} onChange={setAxis} width={200} />
      </div>

      {!cmp.holes.length ? (
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

      {/* KPIs — below the chart, computed across the selected boreholes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <KpiTile>
          <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Fastest drilling · ROP</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="HeadingLargeSemibold" style={{ color: 'var(--text-positive-default)', ...NUM }}>{cmp.bestROP ? fmt(cmp.bestROP.totals.rop, 1) : '—'}</span>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>m/h</span>
          </div>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{cmp.bestROP ? `${cmp.bestROP.id} · fastest of ${cmp.holes.length} selected` : 'select boreholes'}</span>
        </KpiTile>
        <KpiTile>
          <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Most fuel-efficient · Fuel Intensity</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="HeadingLargeSemibold" style={{ color: 'var(--text-positive-default)', ...NUM }}>{cmp.bestFuel ? fmt(cmp.bestFuel.totals.fuelIntensity, 2) : '—'}</span>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>L/m</span>
          </div>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{cmp.bestFuel ? `${cmp.bestFuel.id} · least diesel per metre` : 'select boreholes'}</span>
        </KpiTile>
      </div>
    </div>
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
                  <thead><tr style={{ background: 'var(--background-surface-subtle)' }}>
                    <th style={th('left')}>Layer</th><th style={th()}>ROP (m/h)</th><th style={th()}>Fuel/m (L)</th><th style={th()}>RPM</th><th style={th()}>SPP (bar)</th><th style={th()}>Hook (t)</th><th style={th()}>Hours</th><th style={th()}>{CURRENCY}/m</th>
                  </tr></thead>
                  <tbody>
                    {detail.strata.map((L, i) => (
                      <tr key={i}>
                        <td style={td('left')}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: (ROCKS[L.rock] || {}).color }} />{(ROCKS[L.rock] || {}).name}</span></td>
                        <td style={td()}>{fmt(L.rop, 1)}</td><td style={td()}>{fmt(L.fuelPerM, 2)}</td><td style={td()}>{fmt(L.rpm)}</td><td style={td()}>{fmt(L.spp)}</td><td style={td()}>{fmt(L.hookLoad, 1)}</td><td style={td()}>{fmt(L.hours, 1)}</td><td style={td()}>{CURRENCY}{fmt(L.costPerM)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel>
            <div className="BodySmallSemibold" style={{ marginBottom: 6 }}>Depth vs Time — banded by formation</div>
            <DepthCurve series={[{ name: id, color: colorFor(id), points: detail.curve.map(p => ({ x: p.timeH, y: p.depth })), axis: 0 }]} xAxes={[{ label: 'Time (h)', position: 'bottom' }]} bands={bands} height={300} />
          </Panel>

          {/* strata are edited in Plan Management */}
          <Panel style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Strata are managed in Plan Management — add layers manually or import them from Excel.</span>
            <button onClick={() => openPlan('strata')} className="BodySmallSemibold" style={{ background: 'none', border: '1px solid var(--border-gray-default)', borderRadius: 'var(--global-border-radius-medium)', padding: '7px 12px', color: 'var(--text-brand-default)', cursor: 'pointer' }}>🗓 Manage strata →</button>
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
              <button onClick={() => removeLayer(i)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray-tertiary)', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <button onClick={addLayer} className="BodySmallSemibold" style={{ background: 'none', border: 'none', color: 'var(--text-brand-default)', cursor: 'pointer' }}>+ Add layer</button>
          <button onClick={run} disabled={busy} className="BodySmallSemibold"
            style={{ padding: '9px 14px', borderRadius: 10, border: 'none', color: '#fff', cursor: busy ? 'default' : 'pointer', background: busy ? 'var(--border-gray-default)' : 'linear-gradient(135deg,#a779f0,#5b5bf0)' }}>
            {busy ? 'Predicting…' : '✦ Predict with Bruce'}
          </button>
        </div>
      </Panel>

      {/* forecast */}
      {!result ? (
        <Panel><span className="BodyMediumRegular" style={{ color: 'var(--text-gray-tertiary)' }}>Build a planned column and run the forecast — Bruce estimates drilling time, diesel and cost from the historical per-rock rates.</span></Panel>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <Fc label="Depth" value={`${fmt(result.totals.depthM, 1)} m`} />
            <Fc label="Time" value={`${fmt(result.totals.hours, 1)} h`} />
            <Fc label="Diesel" value={`${fmt(result.totals.diesel)} L`} />
            <Fc label="Cost" value={`${CURRENCY}${fmt(result.totals.costRs)}`} />
            <Fc label="ROP" value={`${fmt(result.totals.rop, 1)} m/h`} />
            <Fc label="Fuel/m" value={`${fmt(result.totals.fuelIntensity, 2)} L/m`} />
          </div>
          <Panel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="BodySmallSemibold">Forecast</span>
              <span className="BodyXSmallRegular" style={{ padding: '2px 8px', borderRadius: 999, background: result.source === 'bruce' ? 'linear-gradient(135deg,#a779f0,#5b5bf0)' : 'var(--background-surface-subtle)', color: result.source === 'bruce' ? '#fff' : 'var(--text-gray-secondary)' }}>{result.source === 'bruce' ? 'Bruce' : 'estimate'}</span>
            </div>
            {result.rationale && <div className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)', marginBottom: 10 }}>{result.rationale}</div>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr style={{ background: 'var(--background-surface-subtle)' }}><th style={th('left')}>Layer</th><th style={th()}>Thickness (m)</th><th style={th()}>Hours</th><th style={th()}>Diesel (L)</th><th style={th()}>{CURRENCY}</th></tr></thead>
                <tbody>
                  {result.perLayer.map((l, i) => (
                    <tr key={i}><td style={td('left')}>{ROCKS[l.rock]?.name || l.rock}</td><td style={td()}>{fmt(l.thicknessM, 1)}</td><td style={td()}>{fmt(l.hours, 1)}</td><td style={td()}>{fmt(l.diesel)}</td><td style={td()}>{CURRENCY}{fmt(l.costRs)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          {result.curve && result.curve.length > 1 && (
            <Panel><div className="BodySmallSemibold" style={{ marginBottom: 6 }}>Predicted depth vs time</div><DepthCurve series={[{ name: 'Forecast', color: '#5b5bf0', points: result.curve.map(p => ({ x: p.timeH, y: p.depth })), axis: 0 }]} xAxes={[{ label: 'Time (h)', position: 'bottom' }]} height={280} /></Panel>
          )}
        </div>
      )}
    </div>
  )
}
const Fc = ({ label, value }) => (
  <KpiTile><span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span><span className="HeadingSmallSemibold" style={{ ...NUM }}>{value}</span></KpiTile>
)
