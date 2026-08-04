// /design-system — the Step-1 gate artifact. Every token, primitive, state and
// the chart language on one page, with review toggles: greyscale (CVD / status
// patterns), squint (hierarchy), high-contrast (pit-side variant), density.
// This page is the only consumer of the dv3 system until Step 2 is approved.
import { useState } from 'react'
import './tokens.css'
import { STATUS, StatusPatternDefs, StatusChip, StatusBar, statusFill } from './patterns'
import {
  Card, Metric, Reading, SensorValue, ConfidenceBadge, MaturityBadge,
  Pill, Segmented, TooltipSpecimen, TickingNumber, Sparkline, Skel, AlertCard,
} from './ui'
import { ShiftLineSpecimen, GhostTrackSpecimen } from './ChartSpecimen'

const Section = ({ id, title, note, children }) => (
  <section id={id} style={{ marginBottom: 44 }}>
    <div style={{ marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
      {note && <span className="dv3-support" style={{ fontSize: 12.5 }}>{note}</span>}
    </div>
    {children}
  </section>
)

const Swatch = ({ c, name, sub }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 34, height: 34, borderRadius: 8, background: c, boxShadow: 'inset 0 0 0 1px rgba(16,24,40,0.06)' }} />
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{name}</div>
      <div className="dv3-mono dv3-tert" style={{ fontSize: 10.5 }}>{sub}</div>
    </div>
  </div>
)

export default function Gallery() {
  const [grey, setGrey] = useState(false)
  const [squint, setSquint] = useState(false)
  const [contrast, setContrast] = useState(false)
  const [density, setDensity] = useState('Balanced')
  const rowCls = density === 'Working' ? 'dv3-row dv3-row--working' : 'dv3-row'

  return (
    <div className="dv3" data-contrast={contrast ? 'high' : undefined} style={{ minHeight: '100vh' }}>
      <StatusPatternDefs />

      {/* sticky review toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(235,238,244,0.92)', backdropFilter: 'none',
        borderBottom: '1px solid var(--hairline)', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>Design System</div>
        <span className="dv3-mono dv3-tert" style={{ fontSize: 11 }}>dv3 · Step 1 gate</span>
        <span style={{ flex: 1 }} />
        <Pill active={grey} onClick={() => setGrey(v => !v)}>Greyscale</Pill>
        <Pill active={squint} onClick={() => setSquint(v => !v)}>Squint</Pill>
        <Pill active={contrast} onClick={() => setContrast(v => !v)}>High contrast</Pill>
        <Segmented options={['Balanced', 'Working']} value={density} onChange={setDensity} />
      </div>

      <div className={`${grey ? 'dv3-grey' : ''} ${squint ? 'dv3-squint' : ''}`} style={{ padding: '28px 32px 80px', maxWidth: 1180, margin: '0 auto', transition: 'filter 150ms ease-out' }}>

        {/* ── 1 · surfaces & card treatment ── */}
        <Section id="surfaces" title="Surfaces & density ladder" note="tinted canvas · floating white cards · airy 28 / balanced 20 / working 16">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
            <Card density="airy" title="Coal dispatched · Airy (Screen 0)">
              <Metric value="4,180" unit="t" comparator="plan" delta={-620} deltaPct={87} good={false} size="xl" />
              <Reading>Crushing has been the constraint for 41% of this shift — about 310 t.</Reading>
            </Card>
            <Card title="Belt loading · Balanced">
              <Metric value="61" unit="%" comparator="design" delta={-14} good={false} size="sm" />
              <Reading>CV-04 ran effectively empty for 41 min during the choke clear-out.</Reading>
            </Card>
            <Card density="working" title="Crusher feed · Working">
              <Metric value="780" unit="TPH" comparator="capability" delta={-420} good={false} size="sm" />
              <div style={{ marginTop: 8 }}><ConfidenceBadge level="partial" note="Feed weigher stale 4 min" /></div>
            </Card>
          </div>
        </Section>

        {/* ── 2 · type & numerals ── */}
        <Section id="type" title="Type & numerals" note="Inter var · JetBrains Mono var · tabular-lining everywhere">
          <Card>
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
              {[64, 56, 40, 28, 20, 16, 14, 13, 12, 11].map(s => (
                <div key={s} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: s, fontWeight: s >= 40 ? 600 : 500, letterSpacing: s >= 40 ? '-0.025em' : 0, lineHeight: 1.1 }}>{s >= 28 ? '4,180' : 'Aa 47'}</div>
                  <div className="dv3-mono dv3-tert" style={{ fontSize: 10, marginTop: 4 }}>{s}px</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div className="dv3-cardhead" style={{ marginBottom: 4 }}>inverted hierarchy</div>
                <div className="dv3-cardhead">Coal dispatched</div>
                <div className="dv3-hero">4,180<span style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 6 }}>t</span></div>
                <div className="dv3-support">−620 vs plan · 87%</div>
              </div>
              <TickingNumber />
              <div>
                <div className="dv3-cardhead" style={{ marginBottom: 4 }}>mono accents</div>
                <div className="dv3-mono" style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  CV-04 · CR-01 · SH-02<br />16:52:14 · 82.4 °C · 1,184 TPH
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* ── 3 · colour ── */}
        <Section id="colour" title="Colour" note="one accent · five series + baseline · seven status semantics with mandatory patterns">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Accent & series">
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 18 }}>
                <Swatch c="var(--accent)" name="Accent" sub="#2B5CE7" />
                <Swatch c="var(--accent-soft)" name="Accent soft" sub="#E9EFFE" />
              </div>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                <Swatch c="var(--series-1)" name="Series 1 · actual" sub="#2B5CE7" />
                <Swatch c="var(--series-2)" name="Series 2" sub="#12A594" />
                <Swatch c="var(--series-3)" name="Series 3" sub="#E5871F" />
                <Swatch c="var(--series-4)" name="Series 4" sub="#7B5EA7" />
                <Swatch c="var(--series-5)" name="Series 5" sub="#5B6B7F" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="34" height="34"><line x1="4" y1="17" x2="30" y2="17" stroke="var(--baseline)" strokeWidth="2" strokeDasharray="5 4" /></svg>
                  <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>Baseline / plan</div><div className="dv3-mono dv3-tert" style={{ fontSize: 10.5 }}>#A9B2C1 · dashed · behind</div></div>
                </div>
              </div>
            </Card>
            <Card title="Status — locked semantics, pattern-encoded">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px', marginBottom: 16 }}>
                {Object.keys(STATUS).map(k => <StatusChip key={k} k={k} />)}
              </div>
              <div className="dv3-cardhead" style={{ marginBottom: 6 }}>as a state timeline row (toggle greyscale — patterns carry it)</div>
              <StatusBar width={460} segments={[
                { k: 'operating', w: 34 }, { k: 'idleJ', w: 8 }, { k: 'operating', w: 16 },
                { k: 'idleU', w: 10 }, { k: 'downU', w: 12 }, { k: 'operating', w: 12 },
                { k: 'downP', w: 6 }, { k: 'degraded', w: 8 }, { k: 'nodata', w: 6 },
              ]} />
            </Card>
          </div>
        </Section>

        {/* ── 4 · controls ── */}
        <Section id="controls" title="Controls" note="pill filters · segmented · buttons · the black-pill tooltip (adopted exactly)">
          <Card>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill chevron>Shift B · Today</Pill>
              <Pill active>vs Plan</Pill>
              <Pill>vs 7-day avg</Pill>
              <Segmented options={['Live', 'Replay']} value="Live" onChange={() => {}} />
              <button className="dv3-btn dv3-btn--primary">Schedule into window</button>
              <button className="dv3-btn dv3-btn--ghost">Export</button>
              <span className="dv3-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>SLA 48 h</span>
              <TooltipSpecimen />
            </div>
          </Card>
        </Section>

        {/* ── 5 · primitives & enforcement ── */}
        <Section id="primitives" title="Primitives & rule enforcement" note="R1 / R2 / R5 are component contracts — violations render as defects">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Card title="<Metric> — R1 enforced">
              <Metric value="1,184" unit="TPH" comparator="design 1,800" delta={-616} deltaPct={66} good={false} size="sm" />
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                <div className="dv3-cardhead" style={{ marginBottom: 6 }}>missing comparator →</div>
                <Metric value="1,184" size="sm" />
              </div>
            </Card>
            <Card title="<SensorValue> — R5 enforced">
              <div style={{ display: 'grid', gap: 10 }}>
                <SensorValue value={82} unit="°C" deviation={11} rate={3.1} />
                <SensorValue value={148} unit="A" deviation={9} rate={1.2} />
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                  <div className="dv3-cardhead" style={{ marginBottom: 6 }}>raw value alone →</div>
                  <SensorValue value={82} unit="°C" />
                </div>
              </div>
            </Card>
            <Card title="Badges">
              <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
                <ConfidenceBadge level="full" />
                <ConfidenceBadge level="partial" note="Partial — 2 of 3 sources" />
                <ConfidenceBadge level="learning" note="Learning — 12 d to baseline" />
                <ConfidenceBadge level="gap" note="Data gap 16:10–16:25" />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <MaturityBadge level="rule" /><MaturityBadge level="stat" /><MaturityBadge level="learnedLo" /><MaturityBadge level="learnedHi" />
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ── 6 · alert card ── */}
        <Section id="alerts" title="Alert card (Action Center object)" note="no alert ships without hypothesis · consequence · action · owner · SLA">
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            <AlertCard severity="P2" asset="CV-04 · Overland Conveyor" maturity="stat"
              hypothesis="Degraded cooling path on drive motor — not a bearing"
              evidence={['ΔT +11 °C vs expected', 'dT/dt 3.1 °C/h', 'vibration flat · ISO Zone B', 'current +9 A']}
              consequence="~3.2 h unplanned stoppage ≈ 2,100 t deferred coal"
              action="Clean cooling fins" window="22:00 changeover" owner="Electrical Maintenance" sla="48 h" />
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <AlertCard compact severity="P1" asset="HT-03 · Haul Truck" hypothesis="Auto-stopped 4 m from a worker on the ROM road" owner="Shift In-charge" sla="now" />
              <AlertCard compact severity="P3" asset="SC-01 · Sizing Screen" hypothesis="Specific energy drifting +8% at constant throughput" owner="Reliability" sla="7 d" />
              <AlertCard compact severity="P4" asset="P-07 · Dewatering" hypothesis="Runtime 22% above same shift last week" owner="—" sla="digest" />
            </div>
          </div>
        </Section>

        {/* ── 7 · table rows ── */}
        <Section id="table" title="Table rows" note={`asset-health row grammar · ${density === 'Working' ? '36px working' : '40px balanced'} — switch density in the toolbar`}>
          <Card density={density === 'Working' ? 'working' : ''}>
            <div className="dv3-thead" style={{ padding: '0 12px', gap: 12, fontSize: 11.5, color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span style={{ width: 64 }}>Asset</span><span style={{ flex: 1 }}>Name</span><span style={{ width: 120 }}>State</span>
              <span style={{ width: 96 }}>Health 30 d</span><span style={{ width: 70, textAlign: 'right' }}>AHI</span><span style={{ width: 92, textAlign: 'right' }}>At risk</span>
            </div>
            {[
              { id: 'CV-04', name: 'Overland Conveyor 4', st: 'degraded', spark: [92, 91, 90, 88, 87, 84, 81, 78, 74, 71], ahi: 71, risk: '2,100 t' },
              { id: 'CR-01', name: 'Primary Crusher', st: 'operating', spark: [83, 84, 82, 83, 85, 84, 83, 84, 83, 84], ahi: 84, risk: '—' },
              { id: 'SH-02', name: 'Shovel 2', st: 'idleU', spark: [88, 88, 87, 88, 86, 87, 88, 87, 88, 88], ahi: 88, risk: '—' },
              { id: 'HT-03', name: 'Haul Truck 3', st: 'downP', spark: [79, 78, 80, 79, 77, 78, 79, 78, 77, 78], ahi: 78, risk: '640 t' },
            ].map(r => (
              <div key={r.id} className={rowCls} style={{ padding: '0 12px', gap: 12 }}>
                <span className="dv3-mono" style={{ width: 64, fontSize: 12, fontWeight: 600 }}>{r.id}</span>
                <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{r.name}</span>
                <span style={{ width: 120 }}>
                  <svg width="14" height="12" style={{ marginRight: 6, verticalAlign: -1 }}><rect width="14" height="12" rx="3" fill={statusFill(r.st)} /></svg>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{STATUS[r.st].label.split(' — ')[0]}</span>
                </span>
                <span style={{ width: 96 }}><Sparkline points={r.spark} color={r.ahi < 75 ? 'var(--st-degraded)' : 'var(--series-1)'} /></span>
                <span className="dv3-mono" style={{ width: 70, textAlign: 'right', fontWeight: 600, color: r.ahi < 75 ? 'var(--st-degraded)' : 'var(--text-primary)' }}>{r.ahi}</span>
                <span className="dv3-mono" style={{ width: 92, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{r.risk}</span>
              </div>
            ))}
            {/* loading + data-gap rows */}
            <div className={rowCls} style={{ padding: '0 12px', gap: 12 }}>
              <Skel w={40} h={12} /><span style={{ flex: 1 }}><Skel w={140} h={12} /></span>
              <span style={{ width: 120 }}><Skel w={80} h={12} /></span><span style={{ width: 96 }}><Skel w={84} h={16} /></span>
              <span style={{ width: 70 }} /><span style={{ width: 92 }} />
            </div>
            <div className={rowCls} style={{ padding: '0 12px', gap: 12, borderBottom: 'none' }}>
              <span className="dv3-mono" style={{ width: 64, fontSize: 12, fontWeight: 600 }}>P-07</span>
              <span style={{ flex: 1, color: 'var(--text-secondary)' }}>Dewatering Pump 7</span>
              <span style={{ width: 120 }}>
                <svg width="14" height="12" style={{ marginRight: 6, verticalAlign: -1 }}><rect width="14" height="12" rx="3" fill={statusFill('nodata')} /></svg>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No data</span>
              </span>
              <span style={{ width: 96 }}><div className="dv3-gap" style={{ width: 84, height: 16 }} /></span>
              <span className="dv3-mono dv3-muted" style={{ width: 70, textAlign: 'right' }}>—</span>
              <span style={{ width: 92 }} />
            </div>
          </Card>
        </Section>

        {/* ── 8 · the five R6 states ── */}
        <Section id="states" title="The five states (R6)" note="loading · empty · partial (named source, muted) · learning · data gap — every card ships all five">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            <Card density="working" title="Loading">
              <Skel w={110} h={38} r={8} /><div style={{ marginTop: 10 }}><Skel w={150} h={11} /></div><div style={{ marginTop: 6 }}><Skel w={120} h={11} /></div>
            </Card>
            <Card density="working" title="Empty">
              <div style={{ padding: '10px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>No rakes placed yet this shift.<div style={{ fontSize: 12, marginTop: 4 }}>Next placement expected 20:05.</div></div>
            </Card>
            <Card density="working" title="Partial data">
              <div className="dv3-muted"><Metric value="3,940" unit="t" comparator="plan" delta={-410} good={false} size="sm" /></div>
              <div style={{ marginTop: 8 }}><ConfidenceBadge level="partial" note="Weighbridge offline — road tonnes excluded" /></div>
            </Card>
            <Card density="working" title="Learning">
              <div className="dv3-hero dv3-hero--md" style={{ color: 'var(--text-secondary)' }}>0.91</div>
              <div className="dv3-support" style={{ marginTop: 6 }}>No baseline yet</div>
              <div style={{ marginTop: 8 }}><ConfidenceBadge level="learning" note="Learning — 12 d to baseline" /></div>
            </Card>
            <Card density="working" title="Data gap">
              <div className="dv3-gap" style={{ height: 38, width: '75%', borderRadius: 8 }} />
              <div className="dv3-support" style={{ marginTop: 10, fontSize: 12 }}>16:10–16:25 · edge gateway offline.<br />Never interpolated.</div>
            </Card>
          </div>
        </Section>

        {/* ── 9 · chart language ── */}
        <Section id="charts" title="Chart language" note="Highcharts + shared dv3 theme · plan/actual convention · annotation layer · ghost tracks (hand-rolled)">
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
            <Card title="Coal dispatched — cumulative vs plan (Shift B)">
              <ShiftLineSpecimen />
            </Card>
            <Card title="Stage throughput inside capability">
              <GhostTrackSpecimen />
              <Reading>Crushing is the binding constraint — 780 of 1,200 TPH while every other stage has headroom.</Reading>
            </Card>
          </div>
        </Section>

      </div>
    </div>
  )
}
