// Operations Dashboard — Overview: a calm, information-first health wall driven
// entirely by the coherent mineModel. Header is exactly a Dashboard|3D Twin
// switcher + Play Tour, with Overview|Zone Analytics sub-tabs. One accent
// colour; amber/red only on genuine non-green status.
import { useMemo, useState } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { evaluateAlerts, ALERT_SEVERITY_COLOR } from '../../lib/alertsEngine'
import { STATUS_COLOR, statusLabel } from '../../lib/kpiStatus'
import { getModel, productionCurve } from '../../lib/mineModel'
import { TILES, tileStatus, overallStatus, attentionCount } from '../../lib/dashboardConfig'
import { SCurveChart } from './Charts'
import { useFeedStore } from '../CameraFeed'
import { DashboardPreviewCard, PreviewBackdrop } from './DashboardPreview'
import { ZoneAnalytics } from './ZoneAnalytics'
import { VisionCard, CoalSizeWidget, VisionModal, VisionChip } from './VisionEvidence'
import { C, R, FONT, SHADOW } from '../../ui/theme'

const TAB = { fontSize: 12.5, fontWeight: 600, padding: '6px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const Dot = ({ s, size = 8 }) => (s === 'green' ? null : <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[s] }} />)
const num = (o, k) => Number(o?.parameters?.[k])
const tnum = { fontVariantNumeric: 'tabular-nums' }

// ── header ──
function Header({ subTab, setSubTab, dash }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: `1px solid ${C.line}`, background: C.surface }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg, ${C.accent}, #5ac8fa)` }} />
      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Blackridge Coal Mine</span>
      <div style={{ display: 'inline-flex', border: `1px solid ${C.line}`, borderRadius: R.pill, overflow: 'hidden', marginLeft: 6 }}>
        {['overview', 'zones'].map(tk => (
          <button key={tk} onClick={() => setSubTab(tk)} style={{ ...TAB, background: subTab === tk ? 'rgba(10,132,255,0.10)' : 'transparent', color: subTab === tk ? C.accent : C.text2 }}>{tk === 'overview' ? 'Overview' : 'Zone Analytics'}</button>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${C.line}`, borderRadius: R.pill, overflow: 'hidden' }}>
          <span style={{ ...TAB, background: C.accent, color: '#fff' }}>Dashboard</span>
          <button onClick={dash.openTwin} style={{ ...TAB, background: 'transparent', color: C.text2 }}>3D Twin</button>
        </div>
        <button onClick={dash.playTour} style={{ ...TAB, borderRadius: R.sm, background: C.text, color: '#fff', padding: '7px 16px' }}>▶ Play Tour</button>
      </div>
    </div>
  )
}

// ── top strip ──
function TopStrip({ m, objects, alerts }) {
  const overall = overallStatus(m, objects, alerts)
  const attention = attentionCount(m, objects, alerts)
  const nCrit = alerts.filter(a => a.severity === 'critical').length
  const stat = (label, value, unit, extra) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2, color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: C.text, ...tnum }}>{value}{unit ? <span style={{ fontSize: 11, fontWeight: 600, color: C.text3, marginLeft: 3 }}>{unit}</span> : null}{extra}</span>
    </div>
  )
  const delta = m.plan.deltaPct
  return (
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 30, padding: '12px 20px', borderBottom: `1px solid ${C.line}`, background: C.surface, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2, color: C.text3 }}>Status</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: overall === 'green' ? C.text : STATUS_COLOR[overall], display: 'inline-flex', alignItems: 'center', gap: 7 }}><Dot s={overall} size={11} />{statusLabel(overall)}</span>
      </div>
      <Divider />
      {stat('Production today', Math.round(m.today.production).toLocaleString(), 't',
        <span style={{ fontSize: 11.5, fontWeight: 600, marginLeft: 8, color: delta < -8 ? STATUS_COLOR.amber : STATUS_COLOR.green }}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs plan</span>)}
      {stat('Throughput', Math.round(m.rates.crusher).toLocaleString(), 't/h')}
      {stat('Fleet', `${m.fleet.running}/${m.fleet.total}`, '')}
      {stat('Active alerts', alerts.length, '', nCrit ? <span style={{ fontSize: 11.5, fontWeight: 600, color: STATUS_COLOR.red, marginLeft: 6 }}>{nCrit} critical</span> : null)}
      {stat('Workers', Math.round(num(objects['safety-1'], 'workersOnSite')), '')}
      {attention > 0 && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: STATUS_COLOR.amber, background: 'rgba(255,159,10,0.10)', borderRadius: R.pill, padding: '5px 12px' }}>{attention} need attention</span>}
    </div>
  )
}
const Divider = () => <div style={{ width: 1, height: 30, background: C.line }} />

// ── flow strip (centerpiece) ──
function FlowStrip({ m, openZone }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 10 }}>Material Flow · pit → port</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
        {m.stages.map((st, i) => {
          const isBn = m.bottleneck === st.id
          const rising = st.trend != null ? st.trend >= 0 : null
          return (
            <div key={st.id} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
              <button onClick={() => openZone(st.zone)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit',
                border: `1px solid ${isBn ? STATUS_COLOR.amber : C.line}`, background: isBn ? 'rgba(255,159,10,0.06)' : C.bg, borderRadius: R.md, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {st.label}{isBn && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: STATUS_COLOR.amber, borderRadius: 3, padding: '1px 5px' }}>BOTTLENECK</span>}
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, color: isBn ? STATUS_COLOR.amber : C.text, ...tnum }}>
                  {st.id === 'stock' ? Math.round(st.level).toLocaleString() : Math.round(st.rate).toLocaleString()}
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: C.text3, marginLeft: 3 }}>{st.id === 'stock' ? 't' : 't/h'}</span>
                  {st.id === 'stock' && rising != null && <span style={{ marginLeft: 5, color: rising ? STATUS_COLOR.green : STATUS_COLOR.amber }}>{rising ? '↑' : '↓'}</span>}
                </span>
                {st.reject != null && <span style={{ fontSize: 10, color: C.text3 }}>rejects {Math.round(st.reject)} t/h</span>}
              </button>
              {i < m.stages.length - 1 && <span style={{ alignSelf: 'center', color: C.text3, fontSize: 14, padding: '0 2px' }}>›</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── use-case rail (slim tiles + popover) ──
function UseCaseRail({ m, objects, alerts }) {
  const [open, setOpen] = useState(null)
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, overflow: 'hidden' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, padding: '12px 14px 6px' }}>Monitoring use cases</div>
      {TILES.map((tile, i) => {
        const st = tileStatus(tile, m, objects, alerts)
        const val = tile.value(m, objects)
        return (
          <div key={tile.id} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(open === tile.id ? null : tile.id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit',
              display: 'grid', gridTemplateColumns: '3px 1fr auto', alignItems: 'center', gap: 10, padding: '9px 14px',
              borderTop: i ? `1px solid ${C.line}` : 'none', background: open === tile.id ? C.bg : 'transparent', border: 'none', borderLeft: `3px solid ${st === 'green' ? 'transparent' : STATUS_COLOR[st]}` }}>
              <span />
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tile.title}</span>
                {tile.vision && <VisionChip />}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: st === 'green' ? C.text : STATUS_COLOR[st], whiteSpace: 'nowrap', ...tnum }}>{val}<span style={{ fontSize: 9.5, fontWeight: 500, color: C.text3, marginLeft: 3 }}>{tile.unit}</span></span>
            </button>
            {open === tile.id && <Popover tile={tile} m={m} objects={objects} onView={() => { setOpen(null); useDashboard.getState().openTwin(); setTimeout(() => useSceneStore.getState().flyToObject(tile.focus), 90) }} />}
          </div>
        )
      })}
    </div>
  )
}
function Popover({ tile, m, objects, onView }) {
  const rows = tile.detail(m, objects)
  return (
    <div style={{ padding: '4px 14px 12px', background: C.bg, borderTop: `1px solid ${C.line}` }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0' }}>
          <span style={{ fontSize: 11.5, color: C.text2, flex: 1, minWidth: 0 }}>{r.label}{r.sub ? <span style={{ color: C.text3 }}> · {r.sub}</span> : null}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: r.status && r.status !== 'green' ? STATUS_COLOR[r.status] : C.text, ...tnum }}>{r.value}<span style={{ fontSize: 9.5, fontWeight: 500, color: C.text3, marginLeft: 3 }}>{r.unit}</span></span>
        </div>
      ))}
      {tile.vision === 'coal' ? <div style={{ marginTop: 8 }}><CoalSizeWidget /></div> : tile.vision ? <div style={{ marginTop: 8, maxWidth: 300 }}><VisionCard id={tile.vision} /></div> : null}
      <button onClick={onView} style={{ marginTop: 8, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: C.accent, padding: 0 }}>View in Twin →</button>
    </div>
  )
}

// ── alert feed (grouped critical / warning) ──
function AlertFeed({ objects, alerts }) {
  const crit = alerts.filter(a => a.severity === 'critical'), warn = alerts.filter(a => a.severity === 'warn')
  const openTwin = useDashboard(s => s.openTwin)
  const row = (a) => (
    <button key={a.key} onClick={() => { openTwin(); useSceneStore.getState().selectObject(a.objId); setTimeout(() => { useSceneStore.getState().flyToObject(a.objId); if (objects[a.objId]?.config?.watch) useFeedStore.getState().openFeed(a.objId) }, 80) }}
      style={{ textAlign: 'left', cursor: 'pointer', width: '100%', padding: '8px 10px', borderRadius: R.md, background: 'transparent', border: 'none', borderLeft: `3px solid ${ALERT_SEVERITY_COLOR[a.severity]}`, font: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset}</span>
        {a.useCase && <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: C.text2, background: 'rgba(120,120,128,0.10)', borderRadius: R.pill, padding: '1px 7px' }}>{a.useCase}</span>}
      </div>
      <p style={{ fontSize: 11.5, color: C.text2, marginTop: 3, lineHeight: 1.35 }}>{a.message}</p>
    </button>
  )
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Live Alerts</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR.red }}>{crit.length} critical</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR.amber }}>{warn.length} warning</span>
      </div>
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {alerts.length === 0 && <p style={{ fontSize: 12, color: C.text3 }}>All systems nominal</p>}
        {crit.map(row)}{warn.map(row)}
      </div>
    </div>
  )
}

export function OpsDashboard() {
  const objects = useSceneStore(s => s.objects)
  const dash = useDashboard()
  const subTab = useDashboard(s => s.subTab)
  const alerts = useMemo(() => evaluateAlerts(objects), [objects])
  const m = getModel(objects)
  const curve = useMemo(() => productionCurve(objects), [Math.round(m.tH * 20)]) // eslint-disable-line

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: subTab === 'overview' ? 'transparent' : C.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {subTab === 'overview' && <PreviewBackdrop />}
      <VisionModal />
      <Header subTab={subTab} setSubTab={dash.setSubTab} dash={dash} />
      {subTab === 'zones' ? <ZoneAnalytics /> : (
        <>
          <TopStrip m={m} objects={objects} alerts={alerts} />
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, padding: 16, overflow: 'hidden' }}>
            <div style={{ overflowY: 'auto', paddingRight: 4, display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(260px, 1fr)', gridAutoRows: 'min-content', gap: 14 }}>
              {/* hero: production vs plan */}
              <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>Production vs Plan</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, marginLeft: 'auto', color: m.plan.deltaPct < -8 ? STATUS_COLOR.amber : STATUS_COLOR.green, background: m.plan.deltaPct < -8 ? 'rgba(255,159,10,0.10)' : 'rgba(52,199,89,0.10)', borderRadius: R.pill, padding: '2px 9px' }}>
                    {m.plan.deltaPct >= 0 ? '+' : ''}{m.plan.deltaPct.toFixed(1)}% vs plan
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: C.text, ...tnum }}>{Math.round(m.today.production).toLocaleString()}<span style={{ fontSize: 12, color: C.text3, marginLeft: 3 }}>t today</span></div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: C.text3, ...tnum }}>{Math.round(m.plan.toNow).toLocaleString()}<span style={{ fontSize: 12, color: C.text3, marginLeft: 3 }}>t plan</span></div></div>
                </div>
                <SCurveChart actual={curve.actual} plan={curve.plan} unit="t" />
              </div>
              {/* preview */}
              <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: 'transparent', padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 8 }}>Site Overview</div>
                <DashboardPreviewCard onOpen={dash.openTwin} label="Enter Twin" />
              </div>
              {/* flow strip full-width */}
              <div style={{ gridColumn: '1 / -1' }}><FlowStrip m={m} openZone={dash.openZone} /></div>
              {/* use-case rail full-width */}
              <div style={{ gridColumn: '1 / -1' }}><UseCaseRail m={m} objects={objects} alerts={alerts} /></div>
            </div>
            <AlertFeed objects={objects} alerts={alerts} />
          </div>
        </>
      )}
    </div>
  )
}
