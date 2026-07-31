// Zone Analytics — six zones from the namespace hierarchy, each with model-
// driven KPIs (with deltas vs nominal), 60-minute trend charts (target band),
// sparse alert timeline, ranked problem assets, and a compare view across
// comparable-unit metrics only. Zone health = the shared severity source.
import { useMemo } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { evaluateAlerts } from '../../lib/alertsEngine'
import { STATUS_COLOR } from '../../lib/kpiStatus'
import { getModel, NOM } from '../../lib/mineModel'
import {
  ZONES, zoneAssets, zoneStatus, zoneHeadline, zoneThroughput, zoneUtilization, zoneEnergy,
  zoneWorkers, zoneAlerts, topProblemAssets, assetHeadlineParam, assetStatus,
} from '../../lib/zones'
import { zoneSeries, zoneAlertEvents, zoneDowntimeMin } from '../../lib/zoneHistory'
import { LineChart, AlertsChart, CompareBars } from './Charts'
import { CoalSizeWidget } from './VisionEvidence'
import { C, R } from '../../ui/theme'

const tnum = { fontVariantNumeric: 'tabular-nums' }
const Dot = ({ s, size = 8 }) => (s === 'green' ? null : <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[s] }} />)
const n0 = (v) => (Number.isFinite(+v) ? Math.round(+v).toLocaleString() : '—')
const delta = (v, nom) => (nom ? Math.round(((v - nom) / nom) * 1000) / 10 : null)

function ZoneChip({ zone, objects, alerts, active, onSelect }) {
  const st = zoneStatus(objects, zone, alerts)
  const h = zoneHeadline(objects, zone)
  return (
    <button onClick={onSelect} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: 12, borderRadius: R.md,
      background: active ? C.surface : C.bg, border: `1px solid ${active ? C.accent : C.line}`, borderLeft: `3px solid ${st === 'green' ? (active ? C.accent : C.line) : STATUS_COLOR[st]}`,
      display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Dot s={st} size={7} />{zone.name}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: C.text, ...tnum }}>{n0(h.value) === h.value || typeof h.value === 'string' ? h.value : n0(h.value)}<span style={{ fontSize: 10, fontWeight: 600, color: C.text3, marginLeft: 3 }}>{h.unit}</span></span>
      <span style={{ fontSize: 10, color: C.text3 }}>{h.sub || h.label}</span>
    </button>
  )
}

function Kpi({ label, value, unit, status, delta: d }) {
  return (
    <div style={{ padding: '9px 11px', borderRadius: R.md, background: C.surface, border: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2, color: C.text3 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: status && status !== 'green' ? STATUS_COLOR[status] : C.text, ...tnum }}>{value}<span style={{ fontSize: 10, fontWeight: 600, color: C.text3, marginLeft: 2 }}>{unit}</span></span>
        {d != null && <span style={{ fontSize: 10.5, fontWeight: 600, color: d < -8 ? STATUS_COLOR.amber : C.text3 }}>{d >= 0 ? '+' : ''}{d}%</span>}
      </div>
    </div>
  )
}

const COMPARE_METRICS = [
  { id: 'alerts', label: 'Active alerts', unit: '', get: (o, z, al) => zoneAlerts(o, z, al).list.length },
  { id: 'downtime', label: 'Downtime', unit: 'min', get: (o, z) => zoneDowntimeMin(z.id) },
  { id: 'util', label: 'Utilization', unit: '%', get: (o, z) => zoneUtilization(o, z) },
  { id: 'energy', label: 'Energy intensity', unit: '', get: (o, z) => zoneEnergy(o, z).value },
]

export function ZoneAnalytics() {
  const objects = useSceneStore(s => s.objects)
  const dash = useDashboard()
  const zoneId = useDashboard(s => s.zone)
  const alerts = useMemo(() => evaluateAlerts(objects), [objects])
  const m = getModel(objects)
  const zone = ZONES.find(z => z.id === zoneId) || ZONES[0]
  const cmpState = useDashboard(s => s.compare)
  const cmpMetric = useDashboard(s => s.cmpMetric)

  const selectAsset = (id) => { dash.openTwin(); useSceneStore.getState().selectObject(id); setTimeout(() => useSceneStore.getState().flyToObject(id), 90) }
  const viewZoneInTwin = () => { dash.openTwin(); setTimeout(() => useSceneStore.getState().flyToObject(zone.focus), 90) }

  const t = zoneThroughput(objects, zone), e = zoneEnergy(objects, zone), za = zoneAlerts(objects, zone, alerts)
  const util = zoneUtilization(objects, zone)
  const problems = topProblemAssets(objects, zone, alerts)
  const assets = zoneAssets(objects, zone)
  const cmp = COMPARE_METRICS.find(x => x.id === cmpMetric) || COMPARE_METRICS[0]
  const cmpRows = ZONES.map(z => ({ id: z.id, name: z.name, status: zoneStatus(objects, z, alerts), value: cmp.get(objects, z, alerts), onClick: () => { dash.setCompare(false); dash.setZone(z.id) } }))
  const nomOut = { pit: NOM.romExPit, proc: NOM.chppFeed, yard: NOM.product, rail: NOM.railOut, port: NOM.shipLoad, power: NOM.powerBurn }[zone.id]

  return (
    <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 16, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10, flexShrink: 0 }}>
        {ZONES.map(z => <ZoneChip key={z.id} zone={z} objects={objects} alerts={alerts} active={!cmpState && z.id === zoneId} onSelect={() => { dash.setCompare(false); dash.setZone(z.id) }} />)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${C.line}`, borderRadius: R.pill, overflow: 'hidden' }}>
          <button onClick={() => dash.setCompare(false)} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: cmpState ? 'transparent' : 'rgba(10,132,255,0.1)', color: cmpState ? C.text2 : C.accent }}>Zone detail</button>
          <button onClick={() => dash.setCompare(true)} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: cmpState ? 'rgba(10,132,255,0.1)' : 'transparent', color: cmpState ? C.accent : C.text2 }}>Compare zones</button>
        </div>
        {cmpState && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{COMPARE_METRICS.map(mt => (
          <button key={mt.id} onClick={() => dash.setCmpMetric(mt.id)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: R.pill, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${cmpMetric === mt.id ? C.accent : C.line}`, background: cmpMetric === mt.id ? 'rgba(10,132,255,0.08)' : 'transparent', color: cmpMetric === mt.id ? C.accent : C.text2 }}>{mt.label}</button>
        ))}</div>}
      </div>

      {cmpState ? (
        <div style={{ overflowY: 'auto' }}>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>{cmp.label} by zone{cmp.unit ? ` (${cmp.unit})` : ''}</div>
            <CompareBars rows={cmpRows} unit={cmp.unit} />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Dot s={zoneStatus(objects, zone, alerts)} size={11} />
              <span style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{zone.name}</span>
              <button onClick={viewZoneInTwin} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: C.accent }}>View in Twin →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              <Kpi label="Throughput in" value={n0(t.in)} unit="t/h" />
              <Kpi label="Throughput out" value={n0(t.out)} unit="t/h" delta={delta(t.out, nomOut)} />
              <Kpi label="Utilization" value={util} unit="%" status={util < 80 ? 'amber' : 'green'} delta={delta(util, 88)} />
              <Kpi label="Active alerts" value={za.list.length} unit="" status={za.crit ? 'red' : za.warn ? 'amber' : 'green'} />
              <Kpi label={`Energy (${e.unit})`} value={e.value} unit="" />
              <Kpi label="Downtime today" value={zoneDowntimeMin(zone.id)} unit="min" />
              <Kpi label="Workers" value={zoneWorkers(objects, zone)} unit="" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <LineChart label="Throughput — 60 min (t/h)" data={zoneSeries(zone.id, 'tout')} unit="t/h" band={nomOut ? [nomOut * 0.92, nomOut] : null} />
              <AlertsChart label="Alerts — 60 min" events={zoneAlertEvents(zone.id)} />
              <LineChart label={`Utilization — 60 min (%)`} data={zoneSeries(zone.id, 'util')} unit="%" band={[82, 96]} accent="#7d5ce6" />
            </div>
            {zone.id === 'proc' && <CoalSizeWidget />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Top Problem Assets</div>
              {problems.length === 0 && <p style={{ fontSize: 12, color: C.text3 }}>No issues in this zone</p>}
              {problems.map((o, i) => {
                const hp = assetHeadlineParam(o), st = assetStatus(o)
                return (
                  <button key={o.id} onClick={() => selectAsset(o.id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', border: 'none', borderTop: i ? `1px solid ${C.line}` : 'none', background: 'none' }}>
                    <Dot s={st} size={7} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                    {hp && <span style={{ fontSize: 11, fontWeight: 600, color: st !== 'green' ? STATUS_COLOR[st] : C.text2, ...tnum }}>{hp.label} {Math.round(+hp.value * 10) / 10}<span style={{ color: C.text3, marginLeft: 2 }}>{hp.unit}</span></span>}
                  </button>
                )
              })}
            </div>
            <div style={{ border: `1px solid ${C.line}`, borderRadius: R.lg, background: C.surface, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Machines ({assets.length})</div>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {assets.map(o => (
                  <button key={o.id} onClick={() => selectAsset(o.id)} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', border: 'none', background: 'none' }}>
                    <Dot s={assetStatus(o)} size={7} /><span style={{ fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
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
