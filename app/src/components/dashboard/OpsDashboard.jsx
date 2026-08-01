// Operations Dashboard — presentation rebuilt to the exact design spec.
// Data comes from mineModel via a 5-second snapshot (no per-second jitter).
import { useState, useEffect, useRef, Fragment } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { productionCurve } from '../../lib/mineModel'
import { TILES, overallStatus, rowAlertsFor } from '../../lib/dashboardConfig'
import { getParamHistory } from '../../lib/paramHistory'
import { assetHealthModel } from '../../lib/assetHealth'
import { assetHeadlineParam } from '../../lib/zones'
import { motion } from 'framer-motion'
import { ChartCard, SCurve, MiniSpark } from './Charts'
import { useFeedStore } from '../CameraFeed'
import { DashboardPreviewCard, PreviewBackdrop } from './DashboardPreview'
import { ZoneAnalytics } from './ZoneAnalytics'
import { VisionCard, CoalSizeWidget, VisionModal, VisionChip, useVision } from './VisionEvidence'
import { T, ty, card, Unit, PlanDelta, fmt, rel, STATUS, STATUS_WORD, useDashSnapshot, NumberFlow, linkStyle, REDUCED_MOTION } from './tokens'

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

// ── flow strip — living material-flow spine. Six nodes joined by five lanes
// with coal-coloured dots whose count and speed derive from the SAME rates
// the numbers show (read-only on mineModel). Lane configs freeze at mount —
// restarting CSS animations on ticks would make dots jump; numbers keep
// live-ticking. Dots/halos are decorative absolute layers inside dedicated
// lane rows (carve-out) and vanish under prefers-reduced-motion.
function FlowStrip({ m, openZone }) {
  const lanesRef = useRef(null)
  if (!lanesRef.current) {
    const r = m.rates
    const mk = (rate) => ({ rate, n: Math.max(3, Math.min(10, Math.round(rate / 150))), dur: rate >= 50 ? 3000 / rate : 6, stalled: rate < 50 })
    // L1 Pit→Crusher intake · L2 →CHPP feed · L3 →Stockpile product · L4 →Rail · L5 →Port
    lanesRef.current = [mk(r.crusher), mk(r.chppFeed), mk(r.product), mk(r.rail), mk(r.ship)]
  }
  const lanes = lanesRef.current
  const bnLane = m.stages.findIndex(st => st.id === m.bottleneck) - 1     // lane INTO the bottleneck node
  const port = (side, halo) => <span className={halo ? 'port-halo' : undefined} style={{ position: 'absolute', [side]: 0, top: 5, width: 6, height: 6, borderRadius: '50%', background: '#FFFFFF', border: '1.5px solid #D0D5DD', boxSizing: 'border-box', zIndex: 1 }} />
  return (
    <div style={{ ...card, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <span style={ty.cardTitle}>Material Flow · pit → port</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr auto 1fr auto 1fr auto 1fr auto', alignItems: 'center', marginTop: 6 }}>
        {m.stages.map((st, i) => {
          const bn = m.bottleneck === st.id
          const rising = st.trend != null ? st.trend >= 0 : null
          const spark = getParamHistory('dash', st.id === 'stock' ? 'stockFlow' : 'flow_' + st.id)
          return (
            <Fragment key={st.id}>
              <button className="flow-node" onClick={() => openZone(st.zone)} style={{ minWidth: 0, textAlign: 'left', font: 'inherit', background: 'none', position: 'relative',
                border: '1px solid transparent', borderLeft: bn ? '3px solid ' + T.warn : '1px solid transparent', borderRadius: 8, padding: '2px 10px',
                display: 'grid', gridTemplateRows: '14px 28px 13px 13px', alignItems: 'center' }}>
                <span style={{ ...ty.label, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{st.label}{bn && <span style={{ fontSize: 12, fontWeight: 600, color: T.warn }}>Bottleneck</span>}<span className="node-arrow" style={{ color: T.accent }}>→</span></span>
                <span style={{ ...ty.kpiM, whiteSpace: 'nowrap' }}>{st.id === 'stock' ? Math.round(st.level).toLocaleString() : Math.round(st.rate).toLocaleString()}<Unit>{st.id === 'stock' ? 't' : 't/h'}</Unit>{st.id === 'stock' && rising != null && <span style={{ ...ty.label, marginLeft: 4 }}>{rising ? '▲' : '▼'}</span>}</span>
                <MiniSpark data={spark} w={64} h={12} />
                <span style={{ ...ty.label, whiteSpace: 'nowrap' }}>{st.feed != null ? `feed ${Math.round(st.feed)} · rejects ${Math.round(st.reject)} t/h` : ''}</span>
                {st.feed != null && (
                  <span aria-hidden style={{ position: 'absolute', left: 14, bottom: -18, width: 2, height: 20, background: '#EAECF0' }}>
                    {[0, 1, 2].map(j => <span key={j} className="rej-dot" style={{ animationDelay: `${-j * 0.6}s` }} />)}
                  </span>
                )}
              </button>
              {i < m.stages.length - 1 && (
                <div style={{ position: 'relative', height: 16, minWidth: 0, margin: '0 2px', containerType: 'inline-size' }}>
                  <span style={{ position: 'absolute', left: 2, right: 2, top: 7, height: 2, background: '#EAECF0' }} />
                  {port('left', false)}
                  {port('right', i === bnLane)}
                  {Array.from({ length: lanes[i].n }, (_, j) => (
                    <span key={j} className="flow-dot" style={{
                      animationDuration: `${lanes[i].dur}s`,
                      animationDelay: `${(-(j / lanes[i].n) * lanes[i].dur).toFixed(2)}s`,
                      animationTimingFunction: i === bnLane ? 'cubic-bezier(0.15, 0.75, 0.4, 1)' : 'linear',
                      animationPlayState: lanes[i].stalled ? 'paused' : 'running',
                      opacity: lanes[i].stalled ? 0.3 : undefined }} />
                  ))}
                </div>
              )}
            </Fragment>
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

// ── asset health rail (Overview) — monitored equipment ranked worst-first,
// health seeded per asset and banded by its ACTIVE alerts (same single source
// as the status rings); camera detections attach to the belt they watch.
const BAND_RANK = { red: 0, amber: 1, green: 2 }
const BAND_COLOR = { red: T.bad, amber: T.warn, green: T.good }

function HealthRing({ health, band, halo }) {
  const R = 12.5, C = 2 * Math.PI * R
  const [on, setOn] = useState(REDUCED_MOTION)
  useEffect(() => { if (!REDUCED_MOTION) { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id) } }, [])
  return (
    <span className={halo ? 'ring-halo' : undefined} style={{ position: 'relative', width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%' }}>
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx="14" cy="14" r={R} fill="none" stroke="#EAECF0" strokeWidth="3" />
        <circle cx="14" cy="14" r={R} fill="none" stroke={BAND_COLOR[band]} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={C.toFixed(2)} strokeDashoffset={(C * (1 - (on ? health / 100 : 0))).toFixed(2)}
          style={{ transition: REDUCED_MOTION ? 'none' : 'stroke-dashoffset 600ms ease-out, stroke 300ms ease' }} />
      </svg>
      <span style={{ fontSize: 9, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: T.ink }}><NumberFlow value={health} format={(v) => String(Math.round(v))} /></span>
    </span>
  )
}

function AssetRow({ row, objects, onOpen }) {
  const prevBand = useRef(row.band)
  const [pulse, setPulse] = useState(null)
  useEffect(() => {
    if (BAND_RANK[row.band] < BAND_RANK[prevBand.current] && !REDUCED_MOTION) {
      setPulse(row.band === 'red' ? 'critical' : 'warn')
      const t = setTimeout(() => setPulse(null), 1900)
      prevBand.current = row.band
      return () => clearTimeout(t)
    }
    prevBand.current = row.band
  }, [row.band])
  let subtitle
  if (row.worst) {
    subtitle = `${row.worst.message}${row.worst.cam ? ` (${row.worst.cam})` : ''} · ${rel(row.worst.since)}`
  } else {
    const hp = assetHeadlineParam(objects[row.id])
    subtitle = hp ? `${hp.label} ${Math.round(+hp.value * 10) / 10}${hp.unit ? ` ${hp.unit}` : ''}` : 'Nominal'
  }
  return (
    <div onClick={onOpen} className={`row-hover asset-row${pulse ? ` row-pulse-${pulse}` : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '12px 4px', borderTop: '1px solid #F2F4F7', cursor: 'pointer' }}>
      <HealthRing health={row.health} band={row.band} halo={row.band === 'red'} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: T.ink2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
      </span>
      <span className="node-arrow" style={{ fontSize: 13, color: T.accent, flexShrink: 0 }}>→</span>
    </div>
  )
}

function AssetHealthRail({ objects, alerts, dash }) {
  const { rows, counts } = assetHealthModel(objects, alerts)
  const total = rows.length
  const firstGreen = rows.findIndex(r2 => r2.band === 'green')
  const Wrap = REDUCED_MOTION ? 'div' : motion.div
  const wrapProps = REDUCED_MOTION ? {} : { layout: true, transition: { duration: 0.25, ease: 'easeOut' } }
  const seg = (n, color, dim) => (n > 0 ? <span style={{ flex: n, minWidth: 8, background: color, opacity: dim ? 0.45 : 1 }} /> : null)
  return (
    <div className="panel-in" style={{ ...card, minWidth: 0, minHeight: 0, flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', animationDelay: '120ms' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <span style={ty.cardTitle}>Asset Health</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: T.ink2 }}>{total} assets</span>
      </div>
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden' }}>
          {seg(counts.red, T.bad)}{seg(counts.amber, T.warn)}{seg(counts.green, T.good, true)}
        </div>
        <div style={{ fontSize: 12, color: T.ink2, margin: '6px 0 4px' }}>{counts.red} critical · {counts.amber} attention · {counts.green} healthy</div>
      </div>
      <div className="dash-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {rows.map((row, i) => (
          <Fragment key={row.id}>
            {i === firstGreen && firstGreen > 0 && (
              <Wrap {...wrapProps} key="__healthy" style={{ padding: '10px 4px 2px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#98A2B3' }}>Healthy — {counts.green}</Wrap>
            )}
            <Wrap {...wrapProps}>
              <AssetRow row={row} objects={objects} onOpen={() => dash.openAssetInspector(row.id)} />
            </Wrap>
          </Fragment>
        ))}
      </div>
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
        .flow-node{cursor:pointer;transition:border-color 150ms ease, box-shadow 150ms ease}
        .flow-node:hover{border-color:#DDE1E8 !important;box-shadow:0 4px 12px rgba(16,24,40,.08),0 2px 4px rgba(16,24,40,.04)}
        .node-arrow{opacity:0;transition:opacity 150ms ease}
        .flow-node:hover .node-arrow{opacity:1} .asset-row:hover .node-arrow{opacity:1}
        .flow-dot{display:none;position:absolute;left:2px;top:5.5px;width:5px;height:5px;border-radius:50%;background:rgba(52,64,84,.85)}
        .rej-dot{display:none;position:absolute;left:-1px;top:0;width:4px;height:4px;border-radius:50%;background:#98A2B3}
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
          @keyframes laneDot{from{transform:translateX(0)}to{transform:translateX(calc(100cqw - 9px))}}
          .flow-dot{display:block;animation:laneDot 4s linear infinite}
          @keyframes rejDot{from{transform:translateY(0);opacity:.7}to{transform:translateY(16px);opacity:0}}
          .rej-dot{display:block;animation:rejDot 1.8s linear infinite}
          @keyframes portHalo{0%{box-shadow:0 0 0 0 rgba(247,144,9,.18)}50%{box-shadow:0 0 0 6px rgba(247,144,9,.18)}100%{box-shadow:0 0 0 0 rgba(247,144,9,0)}}
          .port-halo{animation:portHalo 2s ease-in-out infinite}
          @keyframes ringHalo{0%,100%{box-shadow:0 0 0 0 rgba(240,68,56,0)}50%{box-shadow:0 0 0 6px rgba(240,68,56,.15)}}
          .ring-halo{animation:ringHalo 2s ease-in-out infinite}
          .row-pulse-critical{animation:pulseCrit 675ms ease-in-out 2;border-radius:8px}
          .row-pulse-warn{animation:pulseWarn 675ms ease-in-out 2;border-radius:8px}
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
              <AssetHealthRail objects={objects} alerts={alerts} dash={dash} />
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
