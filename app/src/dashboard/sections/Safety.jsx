// Section 6 · Safety — evidence-first. A CV "Safety Evidence Log" is the hero:
// each violation (danger-zone crossing, missing PPE, unsafe vehicle move) is a
// row with a snapshot + a Raise-action CTA. Compact KPIs sit on top; the
// compliance trend + violations-by-category charts are kept as a strip below.
import { useMemo, useState } from 'react'
import { Chart } from '../components/Chart'
import { Button } from '@faclon-labs/design-sdk/Button'
import { useDash } from '../store'
import { buildSafety, complianceStatus } from '../calc/safety'
import { NUM, STATUS, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel } from '../components/primitives'
import { CARD, Pill, toneOf } from '../components/ui'
import { EvidenceModal, SeverityBadge, fmtEvidenceTime } from '../components/EvidenceModal'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

const CHIPS = [{ id: 'all', name: 'All' }, { id: 'PPE', name: 'PPE' }, { id: 'Restricted Area', name: 'Restricted Area' }, { id: 'Vehicle Safety', name: 'Vehicle Safety' }, { id: 'Other', name: 'Other' }]
const INK = '#0F1728'

export function Safety() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const actions = useDash(s => s.safetyActions)
  const sf = useMemo(() => buildSafety({ range, mineId, areaId, equipTypeId, settings }), [range, mineId, areaId, equipTypeId, settings])
  const ctx = useMemo(() => buildBruceContext({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan, safetyActions: actions }), [range, mineId, areaId, equipTypeId, shiftMode, settings, plan, actions])
  const [cat, setCat] = useState('all')
  const [openOnly, setOpenOnly] = useState(false)
  const [selected, setSelected] = useState(null)

  const cur = sf.totalsByKey[cat] || sf.total
  const st = STATUS[complianceStatus(cur.compliancePct)]

  const catEvidence = useMemo(() => sf.evidence.filter(e => cat === 'all' || e.cat === cat), [sf.evidence, cat])
  const rows = useMemo(() => catEvidence.filter(e => !openOnly || !actions[e.id]), [catEvidence, openOnly, actions])
  const highCrit = catEvidence.filter(e => e.severity === 'High' || e.severity === 'Critical').length
  const raisedCount = catEvidence.filter(e => actions[e.id]).length
  const capped = sf.evidenceTotal > sf.evidence.length

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      <BruceInsight
        variant="rail"
        context={ctx}
        tone={complianceStatus(sf.total.compliancePct)}
        task="In 15-20 words, say what is driving safety violations — name the top category and the specific pattern/location — and what needs action."
        detail="Explain the safety situation — the main violation types, where they occur, and which need actions raised." />

      {/* pill category filters + open-only toggle */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {CHIPS.map(c => (
          <FilterChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</FilterChip>
        ))}
        <span style={{ flex: 1 }} />
        <button onClick={() => setOpenOnly(o => !o)} role="switch" aria-checked={openOnly}
          className="BodyXSmallRegular"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 11px', borderRadius: 999, border: '1px solid var(--border-gray-default)', cursor: 'pointer', font: 'inherit', color: 'var(--text-gray-secondary)', background: 'var(--background-surface-intense)' }}>
          <span style={{ width: 30, height: 18, borderRadius: 9, padding: 2, background: openOnly ? INK : 'var(--border-gray-default)', display: 'inline-flex', transition: 'background 150ms' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', transform: openOnly ? 'translateX(12px)' : 'translateX(0)', transition: 'transform 120ms' }} />
          </span>
          Open only
        </button>
      </div>

      {/* compact KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Stat label={`Safety Compliance${cat !== 'all' ? ` · ${cat}` : ''}`} value={`${fmt(cur.compliancePct, 1)}%`} color={st.text} pill={<Pill tone={toneOf(complianceStatus(cur.compliancePct))}>{st.label}</Pill>} />
        <Stat label="Violations" value={fmt(cur.violations)} color={cur.violations ? 'var(--text-error-default)' : 'var(--text-positive-default)'} sub={`${fmt(cur.checks)} checks`} />
        <Stat label="High / Critical" value={fmt(highCrit)} color={highCrit ? 'var(--text-error-default)' : 'var(--text-gray-primary)'} sub="in evidence log" />
        <Stat label="Actions raised" value={`${fmt(raisedCount)}/${fmt(catEvidence.length)}`}
          color={catEvidence.length - raisedCount > 0 ? 'var(--text-warning-default)' : 'var(--text-positive-default)'}
          pill={catEvidence.length - raisedCount > 0 ? <Pill tone="warning">Follow-through gap</Pill> : <Pill tone="positive">All actioned</Pill>}
          sub={`${fmt(catEvidence.length - raisedCount)} open`} />
      </div>

      {/* Safety Evidence Log — the hero */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '15px 16px' }}>
          <span className="HeadingSmallSemibold">Safety Evidence Log</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>
            {rows.length} {rows.length === 1 ? 'record' : 'records'}{capped ? ` · latest ${sf.evidence.length} of ${sf.evidenceTotal}` : ''}
          </span>
        </div>
        <div style={{ maxHeight: 460, overflow: 'auto', borderTop: '1px solid var(--border-gray-subtle)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={th('left', 180)}>Date &amp; time</th>
                <th style={th('left', 120)}>Evidence</th>
                <th style={th('left')}>Description</th>
                <th style={th('right', 160)}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(e => {
                const raised = actions[e.id]
                return (
                  <tr key={e.id} style={{ transition: 'background 120ms' }}
                    onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}>
                    <td style={td()}><span style={NUM} className="BodySmallRegular">{fmtEvidenceTime(e.ts)}</span></td>
                    <td style={td()}>
                      <img src={e.image} alt="evidence" onClick={() => setSelected(e)}
                        style={{ width: 84, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-gray-subtle)', cursor: 'pointer', display: 'block' }} />
                    </td>
                    <td style={td()}>
                      <div style={{ display: 'grid', gap: 5 }}>
                        <span className="BodySmallSemibold" style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>{e.description}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Pill tone="neutral">{e.cat}</Pill>
                          <SeverityBadge level={e.severity} />
                          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{e.location} · {e.camera}</span>
                        </span>
                      </div>
                    </td>
                    <td style={{ ...td(), textAlign: 'right' }}>
                      {raised
                        ? <span style={{ display: 'inline-grid', gap: 3, justifyItems: 'end' }}>
                            <Pill tone="positive">✓ Action raised</Pill>
                            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{raised.assignee}</span>
                          </span>
                        : <Button size="XSmall" variant="Primary" onClick={() => setSelected(e)}>Raise action</Button>}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={4} style={{ ...td(), textAlign: 'center', color: 'var(--text-gray-tertiary)', padding: '28px 0' }}>
                  {openOnly ? 'No open evidence — all actioned 🎉' : 'No safety evidence for this filter.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* analytics strip — kept, demoted below the evidence log */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <Panel style={{ padding: 18, minWidth: 0 }}>
          <Chart title={`Compliance Trend${cat !== 'all' ? ` · ${cat}` : ''}`} sub={`${fmtStamp(range.start)} → ${fmtStamp(range.end)}`} height={230} options={{
            chart: { type: 'spline' },
            xAxis: { categories: sf.categories },
            yAxis: { labels: { format: '{value}%' } },
            legend: { enabled: false },
            tooltip: { valueSuffix: '%' },
            plotOptions: { spline: { marker: { enabled: sf.categories.length <= 31, radius: 3 } } },
            series: [{ name: 'Compliance', data: sf.trend.compliance[cat], color: '#0E9F6E' }],
          }} />
        </Panel>
        <Panel style={{ padding: 18, minWidth: 0 }}>
          <Chart title="Violations by Category" sub="Count over the selected period, largest first" height={230} options={{
            chart: { type: 'bar' },
            xAxis: { categories: sf.byCategory.map(c => c.cat) },
            yAxis: { title: { text: null } },
            legend: { enabled: false },
            series: [{ name: 'Violations', data: sf.byCategory.map(c => c.violations), color: '#E5484D' }],
          }} />
        </Panel>
      </div>

      <EvidenceModal evidence={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

const th = (align = 'left', w) => ({ padding: '10px 14px', textAlign: align, color: 'var(--text-gray-tertiary)', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', width: w, background: 'var(--background-surface-subtle)', borderBottom: '1px solid var(--border-gray-subtle)' })
const td = () => ({ padding: '12px 14px', verticalAlign: 'middle', borderTop: '1px solid var(--border-gray-subtle)' })

const FilterChip = ({ active, children, onClick }) => (
  <button onClick={onClick} className="BodyXSmallSemibold"
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--background-surface-intense)' }}
    style={{ padding: '6px 13px', borderRadius: 999, cursor: 'pointer', font: 'inherit', transition: 'background 150ms',
      border: `1px solid ${active ? INK : 'var(--border-gray-default)'}`,
      background: active ? INK : 'var(--background-surface-intense)',
      color: active ? '#fff' : 'var(--text-gray-secondary)' }}>
    {children}
  </button>
)

function Stat({ label, value, color, sub, pill }) {
  return (
    <div style={{ ...CARD, padding: 18, display: 'grid', gap: 6, alignContent: 'start' }}>
      <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="HeadingLargeSemibold" style={{ color: color || 'var(--text-gray-primary)', ...NUM, fontSize: 27, lineHeight: 1 }}>{value}</span>
        {pill}
      </div>
      {sub && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{sub}</span>}
    </div>
  )
}
