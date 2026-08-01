// Operations Dashboard — presentation rebuilt to the exact design spec.
// Data comes from mineModel via a 5-second snapshot (no per-second jitter).
import { useState, useEffect, useRef } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { productionCurve } from '../../lib/mineModel'
import { TILES, overallStatus, rowAlertsFor } from '../../lib/dashboardConfig'
import { getParamHistory } from '../../lib/paramHistory'
import { ChartCard, SCurve, MiniSpark } from './Charts'
import { useFeedStore } from '../CameraFeed'
import { DashboardPreviewCard, PreviewBackdrop } from './DashboardPreview'
import { ZoneAnalytics } from './ZoneAnalytics'
import { VisionCard, CoalSizeWidget, VisionModal, VisionChip, useVision } from './VisionEvidence'
import { T, ty, card, Unit, PlanDelta, fmt, rel, STATUS, STATUS_WORD, useDashSnapshot, NumberFlow, linkStyle } from './tokens'

const num = (o, k) => Number(o?.parameters?.[k])
const Grid = ({ children, style }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 16, ...style }}>{children}</div>

// ── top bar (56) ──
function TopBar({ dash, m }) {
  const elapsedPct = Math.min(100, Math.max(0, Math.round((m.tH / 12) * 100)))
  const pace = m.plan.toNow > 0 ? Math.round((m.today.production / m.plan.toNow) * 100) : 100
  return (
    <div style={{ height: 56, flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px' }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: T.accent }} />
      <span style={ty.pageTitle}>Blackridge Coal Mine</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.ink2, marginLeft: 14, whiteSpace: 'nowrap' }}>Day Shift · 06:00–18:00</span>
      <span style={{ width: 140, height: 4, borderRadius: 2, background: '#EAECF0', overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ display: 'block', height: '100%', width: `${elapsedPct}%`, background: T.accent, borderRadius: 2, transition: 'width 300ms ease' }} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.ink2, whiteSpace: 'nowrap' }}>{elapsedPct}% elapsed · production <span style={{ color: pace < 98 ? '#F79009' : T.ink }}>{pace}%</span> of plan pace</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
          <span style={{ ...ty.body, fontWeight: 600, padding: '6px 14px', background: T.accent, color: '#fff' }}>Dashboard</span>
          <button onClick={dash.openTwin} style={{ ...ty.body, fontWeight: 600, padding: '6px 14px', background: 'transparent', color: T.ink2, border: 'none', cursor: 'pointer' }}>3D Twin</button>
        </div>
        <button onClick={dash.playTour} style={{ ...ty.body, fontWeight: 600, padding: '7px 16px', border: 'none', borderRadius: 8, background: T.accent, color: '#fff', cursor: 'pointer' }}>▶ Play Tour</button>
      </div>
    </div>
  )
}

// ── glance row (84) — six hairline-separated stat blocks, NOT cards ──
function GlanceBlock({ label, value, unit, sub, dot, dotPulse, last }) {
  return (
    <div style={{ flex: 1, padding: '0 24px', borderRight: last ? 'none' : `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0 }}>
      <span style={ty.label}>{label}</span>
      <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', color: T.ink, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        {dot && <span className={dotPulse ? 'breathe' : undefined} style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: dot }} />}{value}{unit ? <Unit>{unit}</Unit> : null}
      </span>
      <span style={{ height: 15 }}>{sub}</span>
    </div>
  )
}
function GlanceRow({ m, objects, alerts }) {
  const overall = overallStatus(alerts)
  const nCrit = alerts.filter(a => a.severity === 'critical').length
  if (import.meta.env.DEV && nCrit > 0 && overall !== 'red') console.warn('[dashboard] overallStatus out of sync with critical alerts')
  return (
    <div style={{ height: 84, flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'stretch' }}>
      <GlanceBlock label="Overall status" value={STATUS_WORD[overall]} dot={STATUS[overall]} dotPulse={overall !== 'green'} />
      <GlanceBlock label="Production today" value={<NumberFlow value={m.today.production} />} unit="t" sub={<PlanDelta pct={m.plan.deltaPct} />} />
      <GlanceBlock label="Throughput" value={<NumberFlow value={m.rates.crusher} />} unit="t/h" />
      <GlanceBlock label="Fleet running" value={`${m.fleet.running}/${m.fleet.total}`} />
      <GlanceBlock label="Active alerts" value={<NumberFlow value={alerts.length} />} sub={nCrit ? <span style={{ fontSize: 13, fontWeight: 500, color: T.bad }}>{nCrit} critical</span> : null} />
      <GlanceBlock label="Workers on site" value={<NumberFlow value={Math.round(num(objects['safety-1'], 'workersOnSite'))} />} last />
    </div>
  )
}

// ── flow strip (128) — shared baseline, integer rates, arrow connectors ──
function FlowStrip({ m, openZone }) {
  return (
    <div style={{ ...card, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <span style={ty.cardTitle}>Material Flow · pit → port</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginTop: 6 }}>
        {m.stages.map((st, i) => {
          const bn = m.bottleneck === st.id
          const rising = st.trend != null ? st.trend >= 0 : null
          const spark = getParamHistory('dash', st.id === 'stock' ? 'stockFlow' : 'flow_' + st.id)
          return (
            <div key={st.id} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <button onClick={() => openZone(st.zone)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', background: 'none', border: 'none',
                borderLeft: bn ? `3px solid ${T.warn}` : '3px solid transparent', paddingLeft: 8, display: 'grid', gridTemplateRows: '14px 28px 14px 12px', alignItems: 'center' }}>
                <span style={{ ...ty.label, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{st.label}{bn && <span style={{ fontSize: 12, fontWeight: 600, color: T.warn }}>Bottleneck</span>}</span>
                <span style={{ ...ty.kpiM, whiteSpace: 'nowrap' }}>{st.id === 'stock' ? Math.round(st.level).toLocaleString() : Math.round(st.rate).toLocaleString()}<Unit>{st.id === 'stock' ? 't' : 't/h'}</Unit>{st.id === 'stock' && rising != null && <span style={{ ...ty.label, marginLeft: 4 }}>{rising ? '▲' : '▼'}</span>}</span>
                <MiniSpark data={spark} w={64} h={12} />
                <span style={{ ...ty.label, whiteSpace: 'nowrap' }}>{st.feed != null ? `feed ${Math.round(st.feed)} · rejects ${Math.round(st.reject)} t/h` : ''}</span>
              </button>
              {i < m.stages.length - 1 && <span aria-hidden style={{ flexShrink: 0, padding: '0 8px', color: '#D0D5DD', fontSize: 16, lineHeight: 1 }}>›</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── use-case LEDGER (table) — no fixed heights, no absolute, no clipping ──
const LEDGER = {
  ops:     { full: 'Mine Operations Optimization', ctx: 'production vs plan' },
  workers: { full: 'Real-Time Worker Monitoring',   ctx: 'personnel on site', step: true },
  prox:    { full: 'Collision & Proximity Safety',  ctx: 'closest approach' },
  fleet:   { full: 'Fleet & Equipment Management',  ctx: 'units running', step: true },
  pdm:     { full: 'Predictive Maintenance',        ctx: 'lowest asset RUL' },
  asset:   { full: 'Asset Performance Management',  ctx: 'worst vibration' },
  prod:    { full: 'Production & Productivity',      ctx: (m) => `${m.plan.deltaPct >= 0 ? '+' : ''}${m.plan.deltaPct.toFixed(1)}% vs plan` },
  energy:  { full: 'Energy & Sustainability',       ctx: 'specific energy' },
  env:     { full: 'Environmental Compliance',      ctx: 'PM10 now' },
  supply:  { full: 'Supply Chain & Logistics',      ctx: 'stock on ground' },
}

function Drawer({ tile, m, objects, spark }) {
  const rows = tile.detail(m, objects)
  return (
    <div style={{ padding: '4px 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ ...card, padding: 12 }}>
            <div style={ty.label}>{r.label}{r.sub && r.sub !== '—' ? ` · ${r.sub}` : ''}</div>
            <div style={{ ...ty.kpiM, fontSize: 18, color: r.status && r.status !== 'green' ? STATUS[r.status] : T.ink }}>{r.value}{r.unit ? <Unit>{r.unit}</Unit> : null}</div>
          </div>
        ))}
      </div>
      {spark.length >= 2 && <div style={{ ...card, padding: 12 }}><MiniSpark data={spark} w={640} h={48} /></div>}
      {tile.vision === 'coal' ? <CoalSizeWidget /> : tile.vision ? <div style={{ maxWidth: 360 }}><VisionCard id={tile.vision} /></div> : null}
    </div>
  )
}

function LedgerRow({ tile, m, objects, alerts, expanded, onToggle, onView, first }) {
  const rowAlerts = rowAlertsFor(tile.id, alerts)
  const st = rowAlerts.some(a => a.severity === 'critical') ? 'red' : rowAlerts.length ? 'amber' : 'green'
  const val = tile.value(m, objects)
  const meta = LEDGER[tile.id] || { full: tile.title, ctx: '' }
  const ctx = typeof meta.ctx === 'function' ? meta.ctx(m, objects) : meta.ctx
  const n = rowAlerts.length
  const last = rowAlerts.map(a => a.since).sort((a, b) => b - a)[0]
  const spark = tile.spark ? getParamHistory('dash', tile.spark) : []
  const word = st === 'green' ? 'Normal' : STATUS_WORD[st]
  const wc = st === 'green' ? T.ink2 : STATUS[st]
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${T.line}`, borderLeft: st === 'green' ? '3px solid transparent' : `3px solid ${STATUS[st]}`, transition: 'border-color 300ms ease' }}>
      <div onClick={onToggle} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', cursor: 'pointer' }}>
        <span style={{ width: 84, flexShrink: 0, fontSize: 12, fontWeight: 600, color: wc }}>{word}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 14, fontWeight: 550, color: T.ink }}>{meta.full}</span>
          {tile.vision && <VisionChip />}
        </span>
        <span style={{ width: 150, flexShrink: 0, textAlign: 'right' }}>
          <span style={ty.kpiM}>{Number.isFinite(Number(String(val).replace(/,/g, ''))) ? <NumberFlow value={Number(String(val).replace(/,/g, ''))} /> : val}{tile.unit ? <Unit>{tile.unit}</Unit> : null}</span>
          <span style={{ display: 'block', ...ty.label }}>{ctx}</span>
        </span>
        <span style={{ width: 84, flexShrink: 0, display: 'flex', justifyContent: 'center' }}><MiniSpark data={spark} w={80} h={24} step={meta.step} /></span>
        <span style={{ width: 96, flexShrink: 0, ...ty.label }}>{n > 0 ? `${n} alert${n > 1 ? 's' : ''}${last ? ` · ${rel(last)}` : ''}` : '—'}</span>
        <span style={{ width: 100, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <button onClick={(e) => { e.stopPropagation(); onView() }} className="link-twin" style={linkStyle}>View in Twin →</button>
          {tile.vision && <button onClick={(e) => { e.stopPropagation(); useVision.getState().show(tile.vision) }} className="link-twin" style={linkStyle}>Evidence</button>}
        </span>
      </div>
      {expanded && <Drawer tile={tile} m={m} objects={objects} spark={spark} />}
    </div>
  )
}

function Ledger({ m, objects, alerts, expanded, setExpanded, dash }) {
  return (
    <div className="panel-in" style={{ ...card, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...ty.cardTitle, padding: '18px 20px 6px', flexShrink: 0 }}>Monitoring Use Cases</div>
      <div className="dash-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {TILES.map((tile, i) => (
          <LedgerRow key={tile.id} tile={tile} m={m} objects={objects} alerts={alerts} first={i === 0}
            expanded={expanded === tile.id}
            onToggle={() => setExpanded(expanded === tile.id ? null : tile.id)}
            onView={() => { dash.openTwin(); setTimeout(() => useSceneStore.getState().flyToObject(tile.focus), 90) }} />
        ))}
      </div>
    </div>
  )
}

// ── alert rows (shared by the full feed and the compact overview rail) ──
// arrival tracking: alerts present at dashboard start never pulse; only keys
// first seen AFTER the initial seed animate in (slide + 2 ring pulses)
const seenAlertKeys = new Set()
let seenSeeded = false
function AlertRowBtn({ a, objects }) {
  const openTwin = useDashboard(s => s.openTwin)
  const isNew = seenSeeded && !seenAlertKeys.has(a.key)
  useEffect(() => { seenAlertKeys.add(a.key) }, [a.key])
  return (
    <button onClick={() => { openTwin(); useSceneStore.getState().selectObject(a.objId); setTimeout(() => { useSceneStore.getState().flyToObject(a.objId); if (objects[a.objId]?.config?.watch) useFeedStore.getState().openFeed(a.objId) }, 80) }}
      className={isNew ? `alert-new-${a.severity === 'critical' ? 'critical' : 'warn'} row-hover` : 'row-hover'}
      style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', background: 'none', border: 'none', padding: '8px 6px', borderTop: `1px solid ${T.line}`, display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: a.severity === 'critical' ? T.bad : T.warn }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ ...ty.body, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset}</span>
        <span style={{ ...ty.label, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>{a.message}<span style={{ whiteSpace: 'nowrap' }}> · {rel(a.since)}</span></span>
      </span>
    </button>
  )
}

// full rail (Monitoring tab) — fills its column, scrolls internally
function AlertFeed({ objects, alerts }) {
  const crit = alerts.filter(a => a.severity === 'critical'), warn = alerts.filter(a => a.severity === 'warn')
  const ordered = [...crit, ...warn]
  return (
    <div className="panel-in" style={{ ...card, minWidth: 0, minHeight: 0, height: '100%', padding: 20, display: 'flex', flexDirection: 'column', animationDelay: '60ms' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <span style={ty.cardTitle}>Live Alerts</span>
        <span style={{ ...ty.kpiM, fontSize: 16, marginLeft: 'auto' }}>{alerts.length}</span>
      </div>
      {alerts.length === 0 && <div style={{ flex: 1, display: 'grid', placeItems: 'center', ...ty.label }}>All clear</div>}
      <div className="dash-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ordered.map(a => <AlertRowBtn key={a.key} a={a} objects={objects} />)}
      </div>
    </div>
  )
}

// compact rail (Overview tab) — renders only as many WHOLE items as fit the
// measured height; footer switches to the Monitoring tab
function CompactAlertRail({ objects, alerts }) {
  const setTab = useDashboard(s => s.setActiveTab)
  const boxRef = useRef(null)
  const [fit, setFit] = useState(3)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const hs = [...el.children].map(c => c.offsetHeight).filter(Boolean)
      const ih = hs.length ? Math.max(...hs) : 54
      setFit(Math.max(1, Math.floor(el.clientHeight / ih)))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el); measure()
    return () => ro.disconnect()
  }, [])
  const crit = alerts.filter(a => a.severity === 'critical'), warn = alerts.filter(a => a.severity === 'warn')
  const ordered = [...crit, ...warn]
  const shown = ordered.slice(0, fit)
  return (
    <div className="panel-in" style={{ ...card, minWidth: 0, minHeight: 0, flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', animationDelay: '120ms' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexShrink: 0 }}>
        <span style={ty.cardTitle}>Live Alerts</span>
        <span style={{ ...ty.kpiM, fontSize: 16, marginLeft: 'auto' }}>{alerts.length}</span>
      </div>
      {alerts.length === 0 && <div style={{ flex: 1, display: 'grid', placeItems: 'center', ...ty.label }}>All clear</div>}
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {shown.map(a => <AlertRowBtn key={a.key} a={a} objects={objects} />)}
      </div>
      {alerts.length > 0 && (
        <button onClick={() => setTab('monitoring')} style={{ ...ty.label, color: T.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0', textAlign: 'left', flexShrink: 0, borderTop: `1px solid ${T.line}` }}>View all ({alerts.length}) →</button>
      )}
    </div>
  )
}

const TABS = [['overview', 'Overview'], ['monitoring', 'Monitoring'], ['zones', 'Zone Analytics']]
function TabRow({ tab, setTab }) {
  return (
    <div style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, padding: '8px 24px', display: 'flex' }}>
      <div style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
        {TABS.map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...ty.body, fontWeight: 600, padding: '6px 16px', border: 'none', cursor: 'pointer', background: tab === k ? T.accent : 'transparent', color: tab === k ? '#fff' : T.ink2 }}>{lbl}</button>
        ))}
      </div>
    </div>
  )
}

export function OpsDashboard() {
  const dash = useDashboard()
  const activeTab = useDashboard(s => s.activeTab)
  const snap = useDashSnapshot()
  const { objects, model: m, alerts } = snap
  const [expanded, setExpanded] = useState(null)
  if (!seenSeeded) { alerts.forEach(a => seenAlertKeys.add(a.key)); seenSeeded = true }
  useEffect(() => {
    if (!expanded) return
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(null) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [expanded])
  useEffect(() => {                                    // viewport lock while mounted
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = prev }
  }, [])
  useEffect(() => {                                    // no-scroll self-check per tab
    const id = requestAnimationFrame(() => {
      if (document.body.scrollHeight > window.innerHeight + 1) console.warn('[dashboard] page scroll detected on tab', activeTab)
    })
    return () => cancelAnimationFrame(id)
  }, [activeTab])
  const curve = productionCurve(objects)

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, height: '100dvh', background: activeTab === 'overview' ? 'transparent' : T.bg, fontFamily: T.font, fontVariantNumeric: 'tabular-nums', display: 'grid', gridTemplateRows: 'auto auto auto minmax(0,1fr)', overflow: 'hidden' }}>
      <style>{`
        .dash-scroll{scrollbar-width:thin;scrollbar-color:#D0D5DD transparent} .dash-scroll::-webkit-scrollbar{width:6px} .dash-scroll::-webkit-scrollbar-thumb{background:#D0D5DD;border-radius:3px} .dash-scroll::-webkit-scrollbar-track{background:transparent}
        .link-twin:hover{text-decoration:underline}
        .row-hover{transition:background 150ms ease} .row-hover:hover{background:#F7F8FA}
        .card-hover{transition:border-color 150ms ease, box-shadow 150ms ease} .card-hover:hover{border-color:#DDE1E8;box-shadow:0 4px 12px rgba(16,24,40,.08),0 2px 4px rgba(16,24,40,.04)}
        @media (prefers-reduced-motion: no-preference){
          @keyframes popIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
          @keyframes panelIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
          .panel-in{animation:panelIn 350ms ease-out backwards}
          @keyframes tabFade{from{opacity:0}to{opacity:1}}
          .tab-fade{animation:tabFade 150ms ease-out}
          @keyframes sparkDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
          .spark-draw{stroke-dasharray:1 1;animation:sparkDraw 600ms ease-out both}
          @keyframes alertIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
          @keyframes pulseCrit{0%{box-shadow:0 0 0 0 rgba(240,68,56,.15)}70%{box-shadow:0 0 0 6px rgba(240,68,56,.15)}100%{box-shadow:0 0 0 0 rgba(240,68,56,0)}}
          @keyframes pulseWarn{0%{box-shadow:0 0 0 0 rgba(247,144,9,.15)}70%{box-shadow:0 0 0 6px rgba(247,144,9,.15)}100%{box-shadow:0 0 0 0 rgba(247,144,9,0)}}
          .alert-new-critical{animation:alertIn 250ms ease-out backwards, pulseCrit 675ms ease-in-out 250ms 2;border-radius:8px}
          .alert-new-warn{animation:alertIn 250ms ease-out backwards, pulseWarn 675ms ease-in-out 250ms 2;border-radius:8px}
          @keyframes breathe{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.12);opacity:1}}
          .breathe{animation:breathe 2s ease-in-out infinite}
        }
      `}</style>
      {activeTab === 'overview' && <PreviewBackdrop />}
      <VisionModal />
      <div style={{ position: 'relative', zIndex: 1 }}><TopBar dash={dash} m={m} /></div>
      <div style={{ position: 'relative', zIndex: 1 }}><GlanceRow m={m} objects={objects} alerts={alerts} /></div>
      <div style={{ position: 'relative', zIndex: 1 }}><TabRow tab={activeTab} setTab={dash.setActiveTab} /></div>
      <div key={activeTab} className="tab-fade" style={{ position: 'relative', zIndex: 1, minHeight: 0 }}>
        {activeTab === 'overview' && (
          <div style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 600px', gridTemplateRows: 'minmax(0,1fr) auto', gap: 24, padding: 24 }}>
            <div className="panel-in" style={{ ...card, minWidth: 0, minHeight: 0, padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexShrink: 0 }}>
                <span style={ty.cardTitle}>Production vs Plan</span>
                <PlanDelta pct={m.plan.deltaPct} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, margin: '10px 0 14px', flexShrink: 0 }}>
                <span style={ty.kpiXL}><NumberFlow value={m.today.production} /><Unit>t today</Unit></span>
                <span style={{ ...ty.kpiM, color: T.ink2 }}><NumberFlow value={m.plan.toNow} /><Unit>t plan</Unit></span>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}><SCurve actual={curve.actual} plan={curve.plan} /></div>
            </div>
            <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="panel-in" style={{ flexShrink: 0, animationDelay: '60ms' }}><DashboardPreviewCard onOpen={dash.openTwin} label="Enter Twin" /></div>
              <CompactAlertRail objects={objects} alerts={alerts} />
            </div>
            <div className="panel-in" style={{ gridColumn: '1 / -1', minWidth: 0, animationDelay: '180ms' }}><FlowStrip m={m} openZone={dash.openZone} /></div>
          </div>
        )}
        {activeTab === 'monitoring' && (
          <div style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,1fr)', gap: 24, padding: 24 }}>
            <Ledger m={m} objects={objects} alerts={alerts} expanded={expanded} setExpanded={setExpanded} dash={dash} />
            <AlertFeed objects={objects} alerts={alerts} />
          </div>
        )}
        {activeTab === 'zones' && <ZoneAnalytics />}
      </div>
    </div>
  )
}
