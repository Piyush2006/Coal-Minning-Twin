// Operations Dashboard — the landing view of the coal-mine project. A single
// health wall: all 10 mining use cases as traffic-light KPI cards, a live 3D
// mini-preview, and the live alert feed. Reuses the app's cards / chips /
// typography and the shared sparkline + severity colours — no second styling
// system. Cards keep a FIXED order and never reorder; troubled cards glow.
import { useMemo } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { evaluateAlerts, ALERT_SEVERITY_COLOR } from '../../lib/alertsEngine'
import { CARDS, cardStatus, overallStatus, attentionCount, domainAlertCount, fleetDiesel } from '../../lib/dashboardConfig'
import { STATUS_COLOR, statusLabel } from '../../lib/kpiStatus'
import { getAcc, fleetRunning } from '../../lib/accumulators'
import { getParamHistory } from '../../lib/paramHistory'
import { Sparkline } from '../AssetDrilldown'
import { useFeedStore } from '../CameraFeed'
import { DashboardPreviewCard, PreviewBackdrop } from './DashboardPreview'
import { C, R, FONT, SHADOW } from '../../ui/theme'

const Dot = ({ status, size = 9 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[status] || STATUS_COLOR.green }} />
)

function KpiRow({ kpi, objects }) {
  const raw = kpi.get(objects)
  const val = kpi.fmt ? kpi.fmt(raw) : raw
  const st = kpi.status(objects)
  const sub = kpi.sub ? kpi.sub(objects) : null
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderTop: `1px solid ${C.line}` }}>
      <Dot status={st} size={7} />
      <span style={{ fontSize: 12, color: C.text2, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {kpi.label}{sub && sub !== '—' ? <span style={{ color: C.text3 }}> · {sub}</span> : null}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap' }}>
        {val}{kpi.unit ? <span style={{ fontSize: 10.5, fontWeight: 600, color: C.text3, marginLeft: 3 }}>{kpi.unit}</span> : null}
      </span>
    </div>
  )
}

function UseCaseCard({ card, objects, alerts, onView }) {
  const st = cardStatus(card, objects)
  const glow = st !== 'green'
  const domainAlerts = alerts.filter(a => a.useCase === card.tag).length
  const sparkData = card.spark ? getParamHistory('dash', card.spark) : []
  const headline = card.kpis.find(k => k.headline)
  return (
    <div style={{
      background: C.surface, border: `1px solid ${glow ? STATUS_COLOR[st] : C.line}`, borderRadius: R.lg,
      boxShadow: glow ? `0 0 0 1px ${STATUS_COLOR[st]}22, ${SHADOW.card}` : SHADOW.card,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 4,
      animation: st === 'red' ? 'dashPulse 1.6s ease-in-out infinite' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Dot status={st} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.title}</span>
        {domainAlerts > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: ALERT_SEVERITY_COLOR.warn === STATUS_COLOR[st] || st === 'red' ? STATUS_COLOR[st] : STATUS_COLOR.amber,
            borderRadius: R.pill, padding: '1px 7px' }}>{domainAlerts}</span>
        )}
      </div>
      {headline && sparkData.length >= 2 && (
        <div style={{ margin: '2px 0 4px' }}>
          <Sparkline data={sparkData} height={30} stroke={STATUS_COLOR[st]}
            fill={st === 'green' ? 'rgba(52,199,89,0.10)' : st === 'amber' ? 'rgba(255,159,10,0.12)' : 'rgba(255,59,48,0.12)'} />
        </div>
      )}
      <div>{card.kpis.map(k => <KpiRow key={k.key} kpi={k} objects={objects} />)}</div>
      <button onClick={() => onView(card)} style={{
        marginTop: 6, alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: C.accent, padding: 0 }}>
        View in Twin →
      </button>
    </div>
  )
}

function StripStat({ label, value, unit, status }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 92 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 700, color: C.text, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {status && <Dot status={status} size={8} />}{value}
        {unit ? <span style={{ fontSize: 11, fontWeight: 600, color: C.text3 }}>{unit}</span> : null}
      </span>
    </div>
  )
}

function AlertRail({ objects }) {
  const alerts = useMemo(() => evaluateAlerts(objects), [objects])
  const selectObject = useSceneStore(s => s.selectObject)
  const openTwin = useDashboard(s => s.openTwin)
  const flyToObject = useSceneStore(s => s.flyToObject)
  const nCrit = alerts.filter(a => a.severity === 'critical').length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text3 }}>Live Alerts</span>
        {alerts.length > 0 && (
          <span style={{ minWidth: 18, textAlign: 'center', padding: '1px 6px', borderRadius: R.pill, fontSize: 10.5, fontWeight: 700,
            color: '#fff', background: nCrit ? ALERT_SEVERITY_COLOR.critical : ALERT_SEVERITY_COLOR.warn }}>{alerts.length}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        {alerts.length === 0 && <p style={{ fontSize: 12, color: C.text3 }}>All systems nominal</p>}
        {alerts.map(a => (
          <button key={a.key}
            onClick={() => { openTwin(); selectObject(a.objId); setTimeout(() => { flyToObject(a.objId); if (objects[a.objId]?.config?.watch) useFeedStore.getState().openFeed(a.objId) }, 80) }}
            style={{ textAlign: 'left', cursor: 'pointer', padding: '8px 10px', borderRadius: R.md, background: C.surface, border: `1px solid ${C.line}`, font: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ALERT_SEVERITY_COLOR[a.severity] }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asset}</span>
              {a.useCase && <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: C.text2, background: 'rgba(120,120,128,0.10)', border: `1px solid ${C.line}`, borderRadius: R.pill, padding: '1px 7px' }}>{a.useCase}</span>}
            </div>
            <p style={{ fontSize: 11.5, color: C.text2, marginTop: 4, lineHeight: 1.35 }}>{a.message}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export function OpsDashboard() {
  const objects = useSceneStore(s => s.objects)          // re-renders on each sim tick
  const projectName = 'Blackridge Coal Mine'
  const overall = overallStatus(objects)
  const attention = attentionCount(objects)
  const fleet = fleetRunning(objects)
  const acc = getAcc()
  const alerts = useMemo(() => evaluateAlerts(objects), [objects])
  const workers = Math.round(Number(objects['safety-1']?.parameters?.workersOnSite) || 0)
  const crusher = Math.round(Number(objects['crusher-1']?.parameters?.throughput) || 0)

  const dash = useDashboard()
  const onView = (card) => { dash.openTwin(); setTimeout(() => { if (card.focus && objects[card.focus] && !objects[card.focus].config?.hidden) useSceneStore.getState().flyToObject(card.focus) }, 90) }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'transparent', fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PreviewBackdrop />
      <style>{`@keyframes dashPulse { 0%,100% { box-shadow: 0 0 0 1px ${STATUS_COLOR.red}33, ${SHADOW.card} } 50% { box-shadow: 0 0 0 3px ${STATUS_COLOR.red}44, ${SHADOW.card} } }`}</style>

      {/* header: project + view toggle + actions */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: `1px solid ${C.line}`, background: C.surface }}>
        <span style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg, ${C.accent}, #5ac8fa)` }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{projectName}</span>
        <span style={{ fontSize: 12, color: C.text3 }}>Operations Dashboard</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'inline-flex', border: `1px solid ${C.line}`, borderRadius: R.pill, overflow: 'hidden' }}>
            <span style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, background: C.accent, color: '#fff' }}>Dashboard</span>
            <button onClick={dash.openTwin} style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, background: 'transparent', color: C.text2, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>3D Twin</button>
          </div>
          <button onClick={dash.openTwin} style={{ padding: '7px 14px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Open 3D Twin</button>
          <button onClick={dash.playTour} style={{ padding: '7px 16px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>▶ Play Tour</button>
        </div>
      </div>

      {/* top strip — Mine at a Glance */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 26, padding: '14px 20px', borderBottom: `1px solid ${C.line}`, background: C.surface, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text3 }}>Mine at a Glance</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.text, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Dot status={overall} size={12} />{statusLabel(overall)}
          </span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: C.line }} />
        <StripStat label="Production today" value={Math.round(acc.productionToday).toLocaleString()} unit="t" />
        <StripStat label="Throughput" value={crusher.toLocaleString()} unit="t/h" />
        <StripStat label="Fleet running" value={`${fleet.run}/${fleet.total}`} />
        <StripStat label="Active alerts" value={alerts.length} status={alerts.some(a => a.severity === 'critical') ? 'red' : alerts.length ? 'amber' : 'green'} />
        <StripStat label="Workers on site" value={workers} />
        {attention > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: STATUS_COLOR.amber,
            background: 'rgba(255,159,10,0.10)', border: `1px solid rgba(255,159,10,0.3)`, borderRadius: R.pill, padding: '6px 14px' }}>
            {attention} use case{attention > 1 ? 's' : ''} need attention
          </span>
        )}
      </div>

      {/* body: preview column (non-scrolling) | 10 cards (scroll) | alert rail */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px minmax(0,1fr) 300px', gap: 16, padding: 16, overflow: 'hidden' }}>
        {/* preview lives here, out of the scroll flow, so its rect is stable */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <div style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: R.lg, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text3, marginBottom: 8 }}>Site Overview</div>
            <DashboardPreviewCard onOpen={dash.openTwin} />
          </div>
        </div>
        <div style={{ overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14, alignItems: 'start' }}>
            {CARDS.map(card => <UseCaseCard key={card.id} card={card} objects={objects} alerts={alerts} onView={onView} />)}
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.card, padding: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <AlertRail objects={objects} />
        </div>
      </div>
    </div>
  )
}
