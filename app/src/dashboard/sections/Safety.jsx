// Section 6 · Safety — evidence-first. A CV "Safety Evidence Log" is the hero:
// each violation (danger-zone crossing, missing PPE, unsafe vehicle move) is a
// row with a snapshot + a Raise-action CTA. KPIs sit on top; Compliance and
// Violations drill into the shared MetricDrillModal (Compliance also carries the
// per-shift split). Category + status dropdowns filter the whole tab.
import { useMemo, useState } from 'react'
import { Button } from '@faclon-labs/design-sdk/Button'
import { useDash } from '../store'
import { buildSafety, complianceStatus } from '../calc/safety'
import { NUM, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { CARD, Pill, usePagination, Pager, th, td } from '../components/ui'
import { Dropdown } from '../components/primitives'
import { KpiStat } from '../components/KpiStat'
import { MetricDrillModal } from '../components/MetricDrill'
import { EvidenceModal, SeverityBadge, fmtEvidenceTime } from '../components/EvidenceModal'
import { BruceInsight } from '../components/BruceInsight'
import { buildBruceContext } from '../lib/bruceContext'

const CAT_OPTS = [{ id: 'all', name: 'All categories' }, { id: 'PPE', name: 'PPE' }, { id: 'Restricted Area', name: 'Restricted Area' }, { id: 'Vehicle Safety', name: 'Vehicle Safety' }, { id: 'Other', name: 'Other' }]
const STATUS_OPTS = [{ id: 'all', name: 'All evidence' }, { id: 'open', name: 'Open only' }]

export function Safety() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan } = useDash()
  const actions = useDash(s => s.safetyActions)
  const sf = useMemo(() => buildSafety({ range, mineId, areaId, equipTypeId, settings }), [range, mineId, areaId, equipTypeId, settings])
  const ctx = useMemo(() => buildBruceContext({ range, mineId, areaId, equipTypeId, shiftMode, settings, plan, safetyActions: actions }), [range, mineId, areaId, equipTypeId, shiftMode, settings, plan, actions])
  const [cat, setCat] = useState('all')
  const [status, setStatus] = useState('all')   // all | open
  const [selected, setSelected] = useState(null)
  const [drill, setDrill] = useState(null)   // null | 'compliance' | 'violations'

  const cur = sf.totalsByKey[cat] || sf.total
  const catLabel = cat !== 'all' ? ` — ${cat}` : ''

  const catEvidence = useMemo(() => sf.evidence.filter(e => cat === 'all' || e.cat === cat), [sf.evidence, cat])
  const rows = useMemo(() => catEvidence.filter(e => status !== 'open' || !actions[e.id]), [catEvidence, status, actions])
  const highCrit = catEvidence.filter(e => e.severity === 'High' || e.severity === 'Critical').length
  const raisedCount = catEvidence.filter(e => actions[e.id]).length
  const openCount = catEvidence.length - raisedCount
  const capped = sf.evidenceTotal > sf.evidence.length
  const ev = usePagination(rows, { resetKey: `${cat}|${status}` })

  const shiftWells = sf.shifts.map(s => ({ label: s.name, value: `${fmt(s.compliancePct, 1)} %`, sub: `${fmt(s.violations)} violations · ${fmt(s.checks)} checks` }))

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      <BruceInsight
        variant="rail"
        context={ctx}
        tone={complianceStatus(sf.total.compliancePct)}
        task="In 15-20 words, say what is driving safety violations — name the top category and the specific pattern/location — and what needs action."
        detail="Explain the safety situation — the main violation types, where they occur, and which need actions raised." />

      {/* dropdown filters — category + status */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Dropdown value={cat} options={CAT_OPTS} onChange={setCat} width={190} />
        <Dropdown value={status} options={STATUS_OPTS} onChange={setStatus} width={160} />
      </div>

      {/* KPI row — Compliance & Violations drill; the two counts are context */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'stretch' }}>
        <KpiStat label={`Safety Compliance${cat !== 'all' ? ` · ${cat}` : ''}`} value={cur.compliancePct} dp={1} unit="%"
          kpi={{ status: complianceStatus(cur.compliancePct) }} footer={`${fmt(cur.checks)} checks`}
          tooltip="Share of safety checks that passed. Click for the daily trend and per-shift split."
          onClick={() => setDrill('compliance')} />
        <KpiStat label="Violations" value={cur.violations} dp={0}
          kpi={{ status: cur.violations ? 'critical' : 'positive' }} footer="over selected period"
          tooltip="Total violations detected. Click for the daily trend." onClick={() => setDrill('violations')} />
        <KpiStat label="High / Critical" value={highCrit} dp={0}
          kpi={{ status: highCrit ? 'critical' : 'normal' }} footer="in evidence log" />
        <KpiStat label="Actions raised" value={raisedCount} dp={0}
          kpi={{ status: openCount > 0 ? 'warning' : 'positive' }} footer={`${fmt(openCount)} open · ${fmt(catEvidence.length)} total`} />
      </div>

      {/* Safety Evidence Log — the hero */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '15px 16px' }}>
          <span className="HeadingSmallSemibold">Safety Evidence Log</span>
          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>
            {rows.length} {rows.length === 1 ? 'record' : 'records'}{capped ? ` · latest ${sf.evidence.length} of ${sf.evidenceTotal}` : ''}
          </span>
        </div>
        <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-gray-subtle)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...th('left'), width: 180 }}>Date &amp; time</th>
                <th style={{ ...th('left'), width: 120 }}>Evidence</th>
                <th style={th('left')}>Description</th>
                <th style={{ ...th('right'), width: 160 }}>Action</th>
                <th style={{ ...th('left'), width: 34 }} aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {ev.pageItems.map(e => {
                const raised = actions[e.id]
                return (
                  <tr key={e.id} onClick={() => setSelected(e)} title="Open evidence detail"
                    style={{ transition: 'background 120ms', cursor: 'pointer' }}
                    onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--background-surface-subtle)' }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}>
                    <td style={{ ...td(), verticalAlign: 'middle' }}><span style={NUM} className="BodySmallRegular">{fmtEvidenceTime(e.ts)}</span></td>
                    <td style={{ ...td(), verticalAlign: 'middle' }}>
                      <img src={e.image} alt="evidence"
                        style={{ width: 84, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-gray-subtle)', cursor: 'pointer', display: 'block' }} />
                    </td>
                    <td style={{ ...td(), whiteSpace: 'normal', verticalAlign: 'middle' }}>
                      <div style={{ display: 'grid', gap: 5 }}>
                        <span className="BodySmallSemibold">{e.description}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Pill tone="neutral">{e.cat}</Pill>
                          <SeverityBadge level={e.severity} />
                          <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{e.location} · {e.camera}</span>
                        </span>
                      </div>
                    </td>
                    <td style={{ ...td('right'), verticalAlign: 'middle' }}>
                      {raised
                        ? <span style={{ display: 'inline-grid', gap: 3, justifyItems: 'end' }}>
                            <Pill tone="positive">✓ Action raised</Pill>
                            <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{raised.assignee}</span>
                          </span>
                        : <Button size="XSmall" variant="Primary" onClick={(ev) => { ev.stopPropagation(); setSelected(e) }}>Raise action</Button>}
                    </td>
                    <td style={{ ...td('right'), verticalAlign: 'middle', color: 'var(--text-gray-tertiary)' }} aria-hidden>›</td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={5} style={{ ...td(), textAlign: 'center', color: 'var(--text-gray-tertiary)', padding: '28px 0' }}>
                  {status === 'open' ? 'No open evidence — all actioned 🎉' : 'No safety evidence for this filter.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager {...ev} style={{ padding: '10px 16px' }} />
      </div>

      {/* KPI drill-downs — shared MetricDrillModal language */}
      <MetricDrillModal isOpen={drill === 'compliance'} onClose={() => setDrill(null)}
        title={`Safety Compliance${catLabel}`} subtitle={`Daily compliance · ${fmtStamp(range.start)} → ${fmtStamp(range.end)}`}
        unit="%" dp={1} categories={sf.categories} values={sf.trend.compliance[cat]} goodIfHigh color="#0E9F6E"
        extraWells={shiftWells} />
      <MetricDrillModal isOpen={drill === 'violations'} onClose={() => setDrill(null)}
        title={`Violations${catLabel}`} subtitle={`Daily violations · ${fmtStamp(range.start)} → ${fmtStamp(range.end)}`}
        unit="" dp={0} categories={sf.categories} values={sf.trend.violations[cat]} goodIfHigh={false} color="#E5484D" />

      <EvidenceModal evidence={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
