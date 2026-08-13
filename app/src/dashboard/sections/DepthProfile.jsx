// Section · Depth Profile — drilling analytics. Two sub-views:
//   Depth Profile — compare boreholes' drilling curves (depth vs time/diesel) + KPIs
//   Formation    — one hole's rock-layer breakdown, banded curve + strata editor
// Self-contained: it uses its own borehole selectors, not the global date range.
import { useMemo, useState } from 'react'
import { useDash } from '../store'
import { BOREHOLES, boreholeDetail } from '../data/boreholes'
import { ROCKS } from '../data/geology'
import { buildDepthCompare } from '../calc/depth'
import { NUM, fmt } from '../calc/format'
import { CURRENCY } from '../data/taxonomy'
import { Panel, Dropdown, MultiSelect, Modal } from '../components/primitives'
import { usePagination, Pager, Segmented, th, td } from '../components/ui'
import { KpiStat } from '../components/KpiStat'
import { Chart } from '../components/Chart'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

const AXIS_OPTS = [{ id: 'time', name: 'Depth vs Time' }, { id: 'diesel', name: 'Depth vs Diesel' }, { id: 'both', name: 'Both (dual axis)' }]

// categorical borehole colours — from the redesign chart palette (violet #8B5CF6 is
// a chart series colour, distinct from the Bruce brand accent).
const HOLE_COLORS = ['#3E6DF4', '#0E9F6E', '#F59E0B', '#8B5CF6', '#E5484D', '#00B4D8']
const colorFor = (id) => HOLE_COLORS[BOREHOLES.findIndex(b => b.id === id) % HOLE_COLORS.length]
const toRGBA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` }

const SUBTABS = [{ id: 'profile', label: 'Depth Profile' }, { id: 'formation', label: 'Formation' }]

export function DepthProfile() {
  const [view, setView] = useState('profile')
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const strataByHole = useDash(s => s.boreholeStrata)
  const openPlan = useDash(s => s.openPlan)
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Segmented options={SUBTABS} value={view} onChange={setView} />
        <span style={{ flex: 1 }} />
        <button onClick={() => openPlan('strata')} className="BodySmallSemibold"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--border-gray-default)', background: 'transparent', color: 'var(--text-gray-primary)', cursor: 'pointer', font: 'inherit', fontSize: 12.5, transition: 'background 150ms' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          Manage strata
        </button>
      </div>

      {view === 'profile' && <ProfileView />}
      {view === 'formation' && <FormationView />}
    </div>
  )
}

// ── 1) Depth Profile ──────────────────────────────────────────────────────────
function ProfileView() {
  const strataByHole = useDash(s => s.boreholeStrata)
  // default to the latest (most recently started) borehole — one hole → banded formation view
  const [sel, setSel] = useState(() => new Set([BOREHOLES[BOREHOLES.length - 1].id]))
  const [axis, setAxis] = useState('time')       // time | diesel | both
  const [rank, setRank] = useState(null)         // null | 'rop' | 'fuel'
  const ids = BOREHOLES.filter(b => sel.has(b.id)).map(b => b.id)
  const cmp = useMemo(() => buildDepthCompare(ids, strataByHole), [ids.join(','), strataByHole])

  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const has = cmp.holes.length > 0
  // exactly one hole selected → overlay its geology as formation bands (merged view)
  const single = ids.length === 1
  const bandDetail = useMemo(() => (single ? boreholeDetail(ids[0], strataByHole[ids[0]]) : null), [single, ids[0], strataByHole])
  const bands = bandDetail ? bandDetail.strata.map(L => ({ from: L.top, to: L.bottom, color: toRGBA((ROCKS[L.rock] || {}).color || '#999', 0.42) })) : undefined
  // formation legend — unique rocks top→bottom, solid swatch to match each band
  const legendRocks = bandDetail ? [...new Map(bandDetail.strata.map(L => [L.rock, { id: L.rock, name: (ROCKS[L.rock] || {}).name || L.rock, color: (ROCKS[L.rock] || {}).color || '#999' }])).values()] : []

  // shared-Chart options — the SAME Highcharts language as every other chart.
  // Depth grows downward (reversed y); x is elapsed time or diesel burned.
  const mkSeries = (key, extra = {}) => cmp.holes.map(h => ({
    name: extra.suffix ? `${h.id} · ${extra.suffix}` : h.id,
    color: colorFor(h.id),
    data: h[key].map(([x, y]) => [x, y]),
    dashStyle: extra.dash ? 'Dash' : 'Solid',
    xAxis: extra.xAxis || 0,
  }))
  const xAxisFor = (label, opposite = false) => ({
    title: { text: null }, opposite,
    labels: { format: label === 'time' ? '{value} h' : '{value} L' },
  })
  const chartOptions = {
    chart: { type: 'spline', height: axis === 'both' ? 400 : 340 },
    xAxis: axis === 'both' ? [xAxisFor('time'), xAxisFor('diesel', true)] : [xAxisFor(axis === 'diesel' ? 'diesel' : 'time')],
    yAxis: {
      reversed: true,
      title: { text: null },
      labels: { format: '{value} m' },
      plotBands: bands ? bands.map(b => ({ from: b.from, to: b.to, color: b.color })) : [],
    },
    legend: { enabled: cmp.holes.length > 1 || axis === 'both' },
    tooltip: {
      formatter: function () {
        const unit = this.series.userOptions.xAxis === 1 || axis === 'diesel' ? 'L' : 'h'
        return `<span style="color:${this.color}">●</span> ${this.series.name}<br/>Depth <b>${this.y} m</b> · ${this.x} ${unit}`
      },
    },
    plotOptions: { spline: { marker: { enabled: false } } },
    series: axis === 'both'
      ? [...mkSeries('curveTime', { suffix: 'Time' }), ...mkSeries('curveDiesel', { suffix: 'Diesel', dash: true, xAxis: 1 })]
      : mkSeries(axis === 'diesel' ? 'curveDiesel' : 'curveTime'),
  }

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
          <Chart
            title={(axis === 'both' ? 'Depth vs Time & Diesel' : axis === 'diesel' ? 'Depth vs Diesel — fuel efficiency' : 'Depth vs Time — drilling speed') + (bands ? ' · banded by formation' : '')}
            sub={axis === 'both' ? 'Depth in metres · solid = hours drilled (bottom axis), dashed = diesel burned (top axis)' : axis === 'diesel' ? 'Depth in metres vs diesel burned' : 'Depth in metres vs hours drilled'}
            height={axis === 'both' ? 400 : 340}
            options={chartOptions} />

          {legendRocks.length > 0 && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-gray-subtle)' }}>
              <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Formation</span>
              {legendRocks.map(r => (
                <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: r.color, border: '1px solid var(--border-gray-subtle)', flexShrink: 0 }} />
                  <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{r.name}</span>
                </span>
              ))}
            </div>
          )}
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
  const settings = useDash(s => s.settings)
  const [id, setId] = useState(BOREHOLES[0].id)
  const detail = useMemo(() => boreholeDetail(id, strataByHole[id]), [id, strataByHole])
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
    </div>
  )
}
const Roll = ({ label, value }) => (
  <div style={{ display: 'grid', gap: 2 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="BodyLargeSemibold" style={{ ...NUM }}>{value}</span>
  </div>
)
