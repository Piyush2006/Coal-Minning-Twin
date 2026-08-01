// Operations Dashboard — presentation rebuilt to the exact design spec.
// Data comes from mineModel via a 5-second snapshot (no per-second jitter).
import { useState, useEffect } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { productionCurve } from '../../lib/mineModel'
import { TILES, tileStatus, overallStatus, attentionCount, domainAlertCount } from '../../lib/dashboardConfig'
import { getParamHistory } from '../../lib/paramHistory'
import { ChartCard, SCurve, MiniSpark } from './Charts'
import { useFeedStore } from '../CameraFeed'
import { DashboardPreviewCard, PreviewBackdrop } from './DashboardPreview'
import { ZoneAnalytics } from './ZoneAnalytics'
import { VisionCard, CoalSizeWidget, VisionModal, VisionChip } from './VisionEvidence'
import { T, ty, card, Unit, Delta, fmt, rel, STATUS, STATUS_WORD, SHADOW_MODAL, useDashSnapshot } from './tokens'

const num = (o, k) => Number(o?.parameters?.[k])
const Grid = ({ children, style }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 16, ...style }}>{children}</div>

// ── top bar (56) ──
function TopBar({ dash }) {
  return (
    <div style={{ height: 56, flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px' }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: T.accent }} />
      <span style={ty.pageTitle}>Blackridge Coal Mine</span>
      <span style={{ ...ty.label, marginLeft: 2 }}>Operations</span>
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
function GlanceBlock({ label, value, unit, sub, dot, last }) {
  return (
    <div style={{ flex: 1, padding: '0 24px', borderRight: last ? 'none' : `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0 }}>
      <span style={ty.label}>{label}</span>
      <span style={{ ...ty.kpiM, display: 'inline-flex', alignItems: 'center', gap: 7 }}>{dot && <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot }} />}{value}{unit ? <Unit>{unit}</Unit> : null}</span>
      <span style={{ height: 14 }}>{sub}</span>
    </div>
  )
}
function GlanceRow({ m, objects, alerts }) {
  const overall = overallStatus(m, objects, alerts)
  const nCrit = alerts.filter(a => a.severity === 'critical').length
  return (
    <div style={{ height: 84, flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'stretch' }}>
      <GlanceBlock label="Overall status" value={STATUS_WORD[overall]} dot={STATUS[overall]} />
      <GlanceBlock label="Production today" value={fmt(m.today.production)} unit="t" sub={<Delta pct={m.plan.deltaPct} />} />
      <GlanceBlock label="Throughput" value={fmt(m.rates.crusher)} unit="t/h" />
      <GlanceBlock label="Fleet running" value={`${m.fleet.running}/${m.fleet.total}`} />
      <GlanceBlock label="Active alerts" value={alerts.length} sub={nCrit ? <span style={{ fontSize: 12, fontWeight: 500, color: T.bad }}>{nCrit} critical</span> : null} />
      <GlanceBlock label="Workers on site" value={Math.round(num(objects['safety-1'], 'workersOnSite'))} last />
    </div>
  )
}

// ── flow strip (128) ──
function FlowStrip({ m, openZone }) {
  return (
    <div style={{ ...card, gridColumn: 'span 12', minWidth: 0, height: 128, padding: 16, display: 'flex', flexDirection: 'column' }}>
      <span style={ty.cardTitle}>Material Flow · pit → port</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 0, marginTop: 8 }}>
        {m.stages.map((st, i) => {
          const bn = m.bottleneck === st.id
          const rising = st.trend != null ? st.trend >= 0 : null
          const spark = getParamHistory('dash', st.id === 'stock' ? 'stockFlow' : 'flow_' + st.id)
          return (
            <div key={st.id} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
              <button onClick={() => openZone(st.zone)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', background: 'none', border: 'none', borderLeft: bn ? `3px solid ${T.warn}` : 'none', paddingLeft: bn ? 10 : 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
                <span style={{ ...ty.label, display: 'flex', alignItems: 'center', gap: 6 }}>{st.label}{bn && <span style={{ fontSize: 12, fontWeight: 600, color: T.warn }}>Bottleneck</span>}</span>
                <span style={ty.kpiM}>{st.id === 'stock' ? fmt(st.level) : fmt(st.rate)}<Unit>{st.id === 'stock' ? 't' : 't/h'}</Unit>{st.id === 'stock' && rising != null && <span style={{ ...ty.label, marginLeft: 4 }}>{rising ? '▲' : '▼'}</span>}</span>
                <MiniSpark data={spark} />
                {st.reject != null && <span style={ty.label}>rejects {Math.round(st.reject)} t/h</span>}
              </button>
              {i < m.stages.length - 1 && <svg width="28" height="100%" viewBox="0 0 28 40" preserveAspectRatio="none" style={{ flexShrink: 0 }}><line x1="2" y1="20" x2="26" y2="20" stroke={T.line} strokeWidth="2" strokeDasharray="4 4" className="flowdash" /></svg>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── use-case tile ──
function UseTile({ tile, m, objects, alerts, onOpen }) {
  const st = tileStatus(tile, m, objects, alerts)
  const val = tile.value(m, objects)
  const n = domainAlertCount(objects, [tile.tag], alerts)
  const last = alerts.filter(a => a.useCase === tile.tag).map(a => a.since).sort((a, b) => b - a)[0]
  const sub = n > 0 ? `${n} alert${n > 1 ? 's' : ''}${last ? ` · ${rel(last)}` : ''}` : (tile.detail(m, objects)[0] ? `${tile.detail(m, objects)[0].label} ${tile.detail(m, objects)[0].value}` : '')
  return (
    <button onClick={onOpen} style={{ ...card, height: 96, padding: 16, textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
      borderLeft: st === 'green' ? `1px solid ${T.line}` : `3px solid ${STATUS[st]}`, transition: 'border-color 300ms ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ ...ty.cardTitle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tile.title}</span>
        {tile.vision && <VisionChip />}
        {st !== 'green' && <span style={{ ...ty.label, marginLeft: 'auto', color: STATUS[st], fontWeight: 600 }}>{STATUS_WORD[st]}</span>}
      </div>
      <span style={ty.kpiM}>{val}{tile.unit ? <Unit>{tile.unit}</Unit> : null}</span>
      <span style={{ ...ty.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
    </button>
  )
}
function Popover({ tile, m, objects, onView, onClose }) {
  const rows = tile.detail(m, objects)
  const spark = tile.spark ? getParamHistory('dash', tile.spark) : []
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 360, zIndex: 50, ...card, boxShadow: SHADOW_MODAL, padding: 16, animation: 'popIn 150ms ease' }}>
        <div style={{ ...ty.cardTitle, marginBottom: 8 }}>{tile.title}</div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', padding: '5px 0', borderTop: i ? `1px solid ${T.line}` : 'none' }}>
            <span style={{ ...ty.body, color: T.ink2, flex: 1 }}>{r.label}{r.sub ? ` · ${r.sub}` : ''}</span>
            <span style={{ ...ty.body, fontWeight: 600, color: r.status && r.status !== 'green' ? STATUS[r.status] : T.ink }}>{r.value}{r.unit ? <Unit>{r.unit}</Unit> : null}</span>
          </div>
        ))}
        {spark.length >= 2 && <div style={{ marginTop: 10 }}><MiniSpark data={spark} w={328} h={36} /></div>}
        {tile.vision === 'coal' ? <div style={{ marginTop: 12 }}><CoalSizeWidget compact /></div> : tile.vision ? <div style={{ marginTop: 12 }}><VisionCard id={tile.vision} /></div> : null}
        <button onClick={onView} style={{ marginTop: 12, border: 'none', background: 'none', cursor: 'pointer', ...ty.body, fontWeight: 600, color: T.accent, padding: 0 }}>View in Twin →</button>
      </div>
    </>
  )
}

// ── alert feed ──
function AlertFeed({ objects, alerts }) {
  const crit = alerts.filter(a => a.severity === 'critical'), warn = alerts.filter(a => a.severity === 'warn')
  const ordered = [...crit, ...warn].slice(0, 8)
  const openTwin = useDashboard(s => s.openTwin)
  return (
    <div style={{ ...card, gridColumn: 'span 3', minWidth: 0, height: '100%', padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={ty.cardTitle}>Live Alerts</span>
        <span style={{ ...ty.kpiM, fontSize: 16, marginLeft: 'auto' }}>{alerts.length}</span>
      </div>
      {alerts.length === 0 && <div style={{ flex: 1, display: 'grid', placeItems: 'center', ...ty.label }}>All clear</div>}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ordered.map(a => (
          <button key={a.key} onClick={() => { openTwin(); useSceneStore.getState().selectObject(a.objId); setTimeout(() => { useSceneStore.getState().flyToObject(a.objId); if (objects[a.objId]?.config?.watch) useFeedStore.getState().openFeed(a.objId) }, 80) }}
            style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', background: 'none', border: 'none', padding: '8px 0', borderTop: `1px solid ${T.line}`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: a.severity === 'critical' ? T.bad : T.warn }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ ...ty.body, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset}</span>
              <span style={{ ...ty.label, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>{a.message} · {rel(a.since)}</span>
            </span>
          </button>
        ))}
        {alerts.length > 8 && <button onClick={() => {}} style={{ ...ty.label, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', textAlign: 'left' }}>View all ({alerts.length})</button>}
      </div>
    </div>
  )
}

export function OpsDashboard() {
  const dash = useDashboard()
  const subTab = useDashboard(s => s.subTab)
  const snap = useDashSnapshot()
  const { objects, model: m, alerts } = snap
  const [open, setOpen] = useState(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const curve = productionCurve(objects)

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: subTab === 'overview' ? 'transparent' : T.bg, fontFamily: T.font, fontVariantNumeric: 'tabular-nums', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes flowdrift{to{stroke-dashoffset:-8}} .flowdash{animation:flowdrift 1.4s linear infinite} @keyframes popIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {subTab === 'overview' && <PreviewBackdrop />}
      <VisionModal />
      <div style={{ position: 'fixed', right: 8, bottom: 6, zIndex: 60, fontSize: 10, color: '#98A2B3', pointerEvents: 'none', fontFamily: T.font }}>build r3 · grid-safe</div>
      <div style={{ position: 'relative', zIndex: 1 }}><TopBar dash={dash} /></div>
      {subTab === 'zones' ? <ZoneAnalytics /> : (
        <>
          <div style={{ position: 'relative', zIndex: 1 }}><GlanceRow m={m} objects={objects} alerts={alerts} /></div>
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* ROW A */}
              <Grid>
                <div style={{ ...card, gridColumn: 'span 8', minWidth: 0, height: 340, padding: 16, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={ty.cardTitle}>Production vs Plan</span>
                    <Delta pct={m.plan.deltaPct} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, margin: '10px 0 14px' }}>
                    <span style={ty.kpiXL}>{fmt(m.today.production)}<Unit>t today</Unit></span>
                    <span style={{ ...ty.kpiM, color: T.ink2 }}>{fmt(m.plan.toNow)}<Unit>t plan</Unit></span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}><SCurve actual={curve.actual} plan={curve.plan} /></div>
                </div>
                <div style={{ gridColumn: 'span 4', minWidth: 0, height: 340 }}>
                  <div style={{ ...card, height: '100%', background: 'transparent', overflow: 'hidden', position: 'relative' }}>
                    <DashboardPreviewCard onOpen={dash.openTwin} label="Enter Twin" fill />
                  </div>
                </div>
              </Grid>
              {/* ROW B */}
              <Grid><FlowStrip m={m} openZone={dash.openZone} /></Grid>
              {/* ROW C */}
              <Grid style={{ height: 208 }}>
                <div style={{ gridColumn: 'span 9', minWidth: 0, height: '100%', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gridAutoRows: 96, gap: 16 }}>
                  {TILES.map(tile => (
                    <div key={tile.id} style={{ position: 'relative' }}>
                      <UseTile tile={tile} m={m} objects={objects} alerts={alerts} onOpen={() => setOpen(open === tile.id ? null : tile.id)} />
                      {open === tile.id && <Popover tile={tile} m={m} objects={objects} onClose={() => setOpen(null)}
                        onView={() => { setOpen(null); dash.openTwin(); setTimeout(() => useSceneStore.getState().flyToObject(tile.focus), 90) }} />}
                    </div>
                  ))}
                </div>
                <AlertFeed objects={objects} alerts={alerts} />
              </Grid>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
