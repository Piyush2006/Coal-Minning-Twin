// Zone Analytics tab — the mine divided into six zones, each with analytical
// KPIs, 60-minute trend charts, top problem assets, and a cross-zone compare
// view. Zone health comes from the same severity source as the rings and the
// health wall (lib/zones), history from the shared metric service. Reuses the
// app's cards/chips/severity colours and the SVG charts.
import { useMemo, useState } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { evaluateAlerts, ALERT_SEVERITY_COLOR } from '../../lib/alertsEngine'
import { STATUS_COLOR } from '../../lib/kpiStatus'
import {
  ZONES, zoneAssets, zoneStatus, zoneHeadline, zoneThroughput, zoneUtilization, zoneEnergy,
  zoneWorkers, zoneAlerts, topProblemAssets, assetHeadlineParam, assetStatus,
} from '../../lib/zones'
import { zoneSeries, zoneDowntimeMin } from '../../lib/zoneHistory'
import { LineChart, AlertsChart, CompareBars } from './Charts'
import { C, R, SHADOW } from '../../ui/theme'

const Dot = ({ status, size = 9 }) => <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[status] || STATUS_COLOR.green }} />
const n0 = (v) => (Number.isFinite(+v) ? Math.round(+v).toLocaleString() : '—')

function ZoneChip({ zone, objects, alerts, active, onSelect }) {
  const st = zoneStatus(objects, zone, alerts)
  const head = zoneHeadline(objects, zone)
  return (
    <button onClick={onSelect} style={{
      textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: 12, borderRadius: R.lg,
      background: C.surface, border: `1px solid ${active ? C.accent : (st !== 'green' ? STATUS_COLOR[st] : C.line)}`,
      boxShadow: active ? `0 0 0 2px ${C.accent}22, ${SHADOW.card}` : SHADOW.card, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Dot status={st} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{n0(head.value)}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.text3 }}>{head.unit}</span>
      </div>
      <span style={{ fontSize: 10, color: C.text3 }}>{head.label}</span>
    </button>
  )
}

function Kpi({ label, value, unit, status }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: R.md, background: C.surface, border: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        {status && <Dot status={status} size={7} />}
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase', color: C.text3 }}>{label}</span>
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{value}<span style={{ fontSize: 10.5, fontWeight: 600, color: C.text3, marginLeft: 3 }}>{unit}</span></span>
    </div>
  )
}

const COMPARE_METRICS = [
  { id: 'alerts', label: 'Active alerts', unit: '', get: (o, z, al) => zoneAlerts(o, z, al).list.length },
  { id: 'downtime', label: 'Downtime', unit: 'min', get: (o, z) => zoneDowntimeMin(z.id) },
  { id: 'throughput', label: 'Throughput', unit: 't/h', get: (o, z) => zoneThroughput(o, z).out },
  { id: 'energy', label: 'Energy intensity', unit: '', get: (o, z) => zoneEnergy(o, z).value },
  { id: 'util', label: 'Utilization', unit: '%', get: (o, z) => zoneUtilization(o, z) },
]

export function ZoneAnalytics() {
  const objects = useSceneStore(s => s.objects)
  const dash = useDashboard()
  const alerts = useMemo(() => evaluateAlerts(objects), [objects])
  const [zoneId, setZoneId] = useState('pit')
  const [compare, setCompare] = useState(false)
  const [cmpMetric, setCmpMetric] = useState('alerts')
  const zone = ZONES.find(z => z.id === zoneId) || ZONES[0]

  const selectAsset = (id) => { dash.openTwin(); useSceneStore.getState().selectObject(id); setTimeout(() => useSceneStore.getState().flyToObject(id), 90) }
  const viewZoneInTwin = () => { dash.openTwin(); setTimeout(() => useSceneStore.getState().flyToObject(zone.focus), 90) }

  const t = zoneThroughput(objects, zone), e = zoneEnergy(objects, zone), za = zoneAlerts(objects, zone, alerts)
  const util = zoneUtilization(objects, zone)
  const problems = topProblemAssets(objects, zone, alerts)
  const assets = zoneAssets(objects, zone).filter(o => o.status)

  const cmp = COMPARE_METRICS.find(m => m.id === cmpMetric)
  const cmpRows = ZONES.map(z => ({ id: z.id, name: z.name, status: zoneStatus(objects, z, alerts), value: cmp.get(objects, z, alerts), onClick: () => { setCompare(false); setZoneId(z.id) } }))

  return (
    <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 16, overflow: 'hidden' }}>
      {/* zone strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10, flexShrink: 0 }}>
        {ZONES.map(z => <ZoneChip key={z.id} zone={z} objects={objects} alerts={alerts} active={!compare && z.id === zoneId} onSelect={() => { setCompare(false); setZoneId(z.id) }} />)}
      </div>

      {/* compare toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${C.line}`, borderRadius: R.pill, overflow: 'hidden' }}>
          <button onClick={() => setCompare(false)} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: compare ? 'transparent' : C.accent, color: compare ? C.text2 : '#fff' }}>Zone detail</button>
          <button onClick={() => setCompare(true)} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: compare ? C.accent : 'transparent', color: compare ? '#fff' : C.text2 }}>Compare zones</button>
        </div>
        {compare && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COMPARE_METRICS.map(m => (
              <button key={m.id} onClick={() => setCmpMetric(m.id)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: R.pill, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${cmpMetric === m.id ? C.accent : C.line}`, background: cmpMetric === m.id ? 'rgba(10,132,255,0.08)' : 'transparent', color: cmpMetric === m.id ? C.accent : C.text2 }}>{m.label}</button>
            ))}
          </div>
        )}
      </div>

      {compare ? (
        <div style={{ overflowY: 'auto' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.card, padding: 16, maxWidth: 640 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>{cmp.label} by zone{cmp.unit ? ` (${cmp.unit})` : ''}</div>
            <CompareBars rows={cmpRows} unit={cmp.unit} />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14, overflow: 'hidden' }}>
          {/* selected zone: KPIs + charts */}
          <div style={{ overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Dot status={zoneStatus(objects, zone, alerts)} size={12} />
              <span style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{zone.name}</span>
              <button onClick={viewZoneInTwin} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: C.accent }}>View in Twin →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              <Kpi label="Throughput in" value={n0(t.in)} unit="t/h" />
              <Kpi label="Throughput out" value={n0(t.out)} unit="t/h" />
              <Kpi label="Utilization" value={util} unit="%" status={util < 60 ? 'amber' : 'green'} />
              <Kpi label="Active alerts" value={za.list.length} unit="" status={za.crit ? 'red' : za.warn ? 'amber' : 'green'} />
              <Kpi label="Energy" value={n0(e.value)} unit={e.unit} />
              <Kpi label="Downtime today" value={zoneDowntimeMin(zone.id)} unit="min" />
              <Kpi label="Workers" value={zoneWorkers(objects, zone)} unit="" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <LineChart label="Throughput (60 min)" data={zoneSeries(zone.id, 'tout')} unit="t/h" stroke={C.accent} />
              <AlertsChart label="Alerts over time" warn={zoneSeries(zone.id, 'warn')} crit={zoneSeries(zone.id, 'crit')} />
              <LineChart label={zone.energy === 'diesel' ? 'Diesel burn (60 min)' : 'Energy (60 min)'} data={zoneSeries(zone.id, 'energy')} unit={e.unit} stroke="#7d5ce6" fill="rgba(125,92,230,0.10)" />
            </div>
          </div>

          {/* right: top problems + asset list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.card, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text3, marginBottom: 8 }}>Top Problem Assets</div>
              {problems.length === 0 && <p style={{ fontSize: 12, color: C.text3 }}>No issues in this zone</p>}
              {problems.map(o => {
                const hp = assetHeadlineParam(o)
                return (
                  <button key={o.id} onClick={() => selectAsset(o.id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', border: 'none', borderTop: `1px solid ${C.line}`, background: 'none' }}>
                    <Dot status={assetStatus(o)} size={8} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                    {hp && <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text2 }}>{Math.round(+hp.value * 10) / 10}</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.lg, boxShadow: SHADOW.card, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: C.text3, marginBottom: 8 }}>Assets ({assets.length})</div>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {assets.map(o => (
                  <button key={o.id} onClick={() => selectAsset(o.id)} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', border: 'none', background: 'none' }}>
                    <Dot status={assetStatus(o)} size={7} />
                    <span style={{ fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
