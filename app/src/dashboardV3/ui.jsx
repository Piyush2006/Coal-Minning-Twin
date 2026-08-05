// Dashboard v3 primitives. The insight rules (brief §6) are enforced in the
// component contracts, not in review: <Metric> requires a comparator + delta
// (R1), <SensorValue> requires a deviation (R5), every card state of R6 is a
// designed state. A violated contract renders a loud DEFECT chip — visible in
// dev and in the gallery, impossible to ship quietly.
import { useEffect, useRef, useState } from 'react'

/* ── layout ── */
export function Card({ title, density = '', style, children, right }) {
  const cls = density === 'airy' ? 'dv3-card dv3-card--airy' : density === 'working' ? 'dv3-card dv3-card--working' : 'dv3-card'
  return (
    <div className={cls} style={style}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          {title && <div className="dv3-cardhead">{title}</div>}
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

const Defect = ({ children }) => (
  <span className="dv3-chip" style={{ background: '#FDECEC', color: '#B42318', fontFamily: 'var(--font-mono)' }}>⚠ {children}</span>
)

/* ── R1: no naked numbers. value + comparator + signed delta, or a defect. ── */
export function Metric({ value, unit, comparator, delta, deltaPct, size = 'md', good }) {
  const heroCls = size === 'xl' ? 'dv3-hero dv3-hero--xl' : size === 'sm' ? 'dv3-hero dv3-hero--md' : 'dv3-hero'
  if (comparator == null || delta == null) return <div><div className={heroCls}>{value}</div><Defect>R1 DEFECT — naked number</Defect></div>
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  const deltaColor = good == null ? 'var(--text-secondary)' : good ? 'var(--st-operating)' : 'var(--st-down-u)'
  return (
    <div>
      <div className={heroCls}>
        {value}{unit && <span style={{ fontSize: '0.42em', fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 6 }}>{unit}</span>}
      </div>
      <div className="dv3-support" style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ color: deltaColor, fontWeight: 600 }}>{sign}{Math.abs(delta).toLocaleString()}{unit ? ` ${unit}` : ''} vs {comparator}</span>
        {deltaPct != null && <span className="dv3-tert">{deltaPct}%</span>}
      </div>
    </div>
  )
}

/* ── R2: one sentence of plain language under the hero number. ── */
// The screen's single thesis — what this screen concludes right now. One per
// screen, at the top, with presence. This is the only paragraph of prose that
// should be visible on a screen.
export function Thesis({ children }) {
  return <div style={{ fontSize: 15, fontWeight: 550, color: 'var(--text-primary)', lineHeight: 1.45, margin: '2px 0 16px', maxWidth: 940 }}>{children}</div>
}

// Card reading, demoted to a caption: one clause, ≤12 words, tertiary, one line.
// The long explanation (if any) lives in `more` and surfaces on hover only —
// never on the surface. Keeps R2 (every card has a reading) without the wall.
export function Reading({ children, more }) {
  return (
    <div className="dv3-cap" title={typeof more === 'string' ? more : undefined}
      style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.4, cursor: more ? 'help' : 'default' }}>
      {children}{more && <span style={{ marginLeft: 4, opacity: 0.55, fontSize: 10 }}>ⓘ</span>}
    </div>
  )
}

/* ── R5: raw sensor values never appear alone. deviation is REQUIRED. ── */
export function SensorValue({ value, unit, deviation, rate }) {
  if (deviation == null) return <Defect>R5 DEFECT — sensor value without deviation</Defect>
  const sign = deviation > 0 ? '+' : deviation < 0 ? '−' : '±'
  const warm = Math.abs(deviation) > 0
  return (
    <span className="dv3-mono" style={{ fontSize: 13, display: 'inline-flex', gap: 8, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value} {unit}</span>
      <span style={{ color: warm ? 'var(--st-degraded)' : 'var(--text-tertiary)' }}>{sign}{Math.abs(deviation)} vs expected</span>
      {rate != null && <span style={{ color: 'var(--text-tertiary)' }}>{rate > 0 ? '↑' : '↓'}{Math.abs(rate)} {unit}/h</span>}
    </span>
  )
}

/* ── confidence badge (K21 — every KPI knows the health of its inputs) ── */
const CONF = {
  full:     { bg: '#EAF7F1', fg: '#0E7A55', label: 'All sources reporting' },
  partial:  { bg: '#FDF3E2', fg: '#9A6308', label: 'Partial data' },
  learning: { bg: '#E9EFFE', fg: '#2B5CE7', label: 'Learning' },
  gap:      { bg: '#EEF1F5', fg: '#5B6B7F', label: 'Data gap' },
}
export function ConfidenceBadge({ level = 'full', note }) {
  const c = CONF[level] ?? CONF.full
  return (
    <span className="dv3-chip" style={{ background: c.bg, color: c.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.fg, opacity: 0.8 }} />
      {note || c.label}
    </span>
  )
}

/* ── model maturity badge (blueprint mandate: on every AI output) ── */
const MATURITY = {
  rule:      { label: 'Rule-based' },
  stat:      { label: 'Statistical' },
  learnedLo: { label: 'Learned · low-N' },
  learnedHi: { label: 'Learned · validated' },
}
export function MaturityBadge({ level = 'rule' }) {
  const m = MATURITY[level] ?? MATURITY.rule
  return (
    <span className="dv3-chip dv3-mono" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 10.5, letterSpacing: 0.2 }}>
      {m.label}
    </span>
  )
}

/* ── controls ── */
export function Pill({ children, active, onClick, chevron }) {
  return (
    <button className="dv3-pill" data-active={active ? 'true' : undefined} onClick={onClick}>
      {children}{chevron && <span style={{ fontSize: 10, opacity: 0.55 }}>▾</span>}
    </button>
  )
}
export function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 999, padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange?.(o)}
          style={{ border: 'none', cursor: 'pointer', borderRadius: 999, padding: '5px 12px', fontSize: 13, fontFamily: 'var(--font-ui)',
            background: o === value ? '#fff' : 'transparent', color: o === value ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: o === value ? 500 : 400, boxShadow: o === value ? '0 1px 3px rgba(16,24,40,0.10)' : 'none', transition: 'background 150ms ease-out' }}>
          {o}
        </button>
      ))}
    </div>
  )
}

/* ── black-pill tooltip specimen (§3.3 — adopt exactly) ── */
export function TooltipSpecimen() {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div className="dv3-tooltip">
        <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 3 }}>16:52 · Shift B</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600 }}>2,410 t</span>
          <span style={{ opacity: 0.75 }}>plan 2,720 t</span>
          <span style={{ color: '#F97066' }}>−310</span>
        </div>
      </div>
    </div>
  )
}

/* ── ticking number: tabular-nums proof (no jitter vs proportional) ── */
export function TickingNumber() {
  const [v, setV] = useState(3117.4)
  useEffect(() => { const t = setInterval(() => setV(x => +(x + 1.7).toFixed(1)), 1000); return () => clearInterval(t) }, [])
  const s = v.toLocaleString(undefined, { minimumFractionDigits: 1 })
  return (
    <div style={{ display: 'flex', gap: 32 }}>
      <div>
        <div className="dv3-cardhead" style={{ marginBottom: 4 }}>tabular-nums (ours)</div>
        <div style={{ fontSize: 28, fontWeight: 600 }}>{s} <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>t</span></div>
      </div>
      <div>
        <div className="dv3-cardhead" style={{ marginBottom: 4 }}>proportional (banned)</div>
        <div style={{ fontSize: 28, fontWeight: 600, fontVariantNumeric: 'normal' }}>{s} <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>t</span></div>
      </div>
    </div>
  )
}

/* ── tiny hand-rolled sparkline (table rows, health trends) ── */
export function Sparkline({ points, w = 84, h = 22, color = 'var(--series-1)' }) {
  const min = Math.min(...points), max = Math.max(...points)
  const span = max - min || 1
  const d = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - 2 - ((p - min) / span) * (h - 4)}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── skeleton (R6 loading — must match the shape it replaces) ── */
export const Skel = ({ w, h = 12, r = 6, style }) => <div className="dv3-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />

/* ── the Action-Center alert object (§9) — hypothesis / evidence / consequence /
      action / owner / SLA, or it is not an alert. ── */
const SEV = {
  P1: { label: 'P1 · Safety-critical', color: 'var(--sev-p1)' },
  P2: { label: 'P2 · Production-critical', color: 'var(--sev-p2)' },
  P3: { label: 'P3 · Degradation', color: 'var(--sev-p3)' },
  P4: { label: 'P4 · Advisory', color: 'var(--sev-p4)' },
}
export function AlertCard({ severity = 'P3', asset, hypothesis, evidence = [], consequence, action, window: win, owner, sla, maturity, compact }) {
  const s = SEV[severity] ?? SEV.P3
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-inner)', boxShadow: 'var(--card-shadow)', padding: compact ? '12px 14px' : '16px 18px', borderLeft: `3px solid ${s.color}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <span className="dv3-chip" style={{ background: 'var(--surface-2)', color: s.color, fontWeight: 600 }}>{s.label}</span>
        <span className="dv3-mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{asset}</span>
        {maturity && <MaturityBadge level={maturity} />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>{hypothesis}</div>
      {!compact && evidence.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {evidence.map((e, i) => (
            <span key={i} className="dv3-chip dv3-mono" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 11 }}>{e}</span>
          ))}
        </div>
      )}
      {!compact && consequence && (
        <div className="dv3-support" style={{ marginTop: 8 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>If unaddressed · </span>{consequence}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {action && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>→ {action}{win ? ` · ${win}` : ''}</span>}
        <span style={{ flex: 1 }} />
        {owner && <span className="dv3-support" style={{ fontSize: 12 }}>{owner}</span>}
        {sla && <span className="dv3-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>SLA {sla}</span>}
      </div>
    </div>
  )
}
