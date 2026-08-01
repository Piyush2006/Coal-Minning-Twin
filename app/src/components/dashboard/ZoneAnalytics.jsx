// Zone Analytics — presentation rebuilt to the design spec. Same tokens/grid.
import { useSceneStore } from '../../store/sceneStore'
import { useDashboard } from '../../lib/dashboardStore'
import { NOM } from '../../lib/mineModel'
import {
  ZONES, zoneAssets, zoneStatus, zoneHeadline, zoneThroughput, zoneUtilization, zoneEnergy,
  zoneWorkers, zoneAlerts, topProblemAssets, assetHeadlineParam, assetStatus,
} from '../../lib/zones'
import { zoneSeries, zoneAlertEvents, zoneDowntimeMin } from '../../lib/zoneHistory'
import { ChartCard, TrendChart, AlertTimeline, CompareBars } from './Charts'
import { CoalSizeWidget } from './VisionEvidence'
import { T, ty, card, Unit, Delta, fmt, STATUS, STATUS_WORD, useDashSnapshot, linkStyle } from './tokens'

const Grid = ({ children, style }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 16, ...style }}>{children}</div>
const nomOut = { pit: NOM.romExPit, proc: NOM.chppFeed, yard: NOM.product, rail: NOM.railOut, port: NOM.shipLoad, power: NOM.powerBurn }
const deltaPct = (v, nom) => (nom ? ((v - nom) / nom) * 100 : null)

function ZoneStripBlock({ zone, objects, alerts, active, onSelect, last }) {
  const st = zoneStatus(objects, zone, alerts)
  const h = zoneHeadline(objects, zone)
  return (
    <button onClick={onSelect} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', background: 'none', border: 'none',
      borderRight: last ? 'none' : `1px solid ${T.line}`, borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
      padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ ...ty.label, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {st !== 'green' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS[st] }} />}{zone.name}
      </span>
      <span style={ty.kpiM}>{typeof h.value === 'string' ? h.value : fmt(h.value)}<Unit>{h.unit}</Unit></span>
      <span style={ty.label}>{h.sub || h.label}</span>
    </button>
  )
}

function StatBlock({ label, value, unit, sub, dot, last }) {
  return (
    <div style={{ flex: 1, padding: '0 20px', borderRight: last ? 'none' : `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0 }}>
      <span style={ty.label}>{label}</span>
      <span style={{ ...ty.kpiM, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{dot && <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot }} />}{value}{unit ? <Unit>{unit}</Unit> : null}</span>
      <span style={{ height: 14 }}>{sub}</span>
    </div>
  )
}

const COMPARE = [
  { id: 'alerts', label: 'Active alerts', unit: '', get: (o, z, al) => zoneAlerts(o, z, al).list.length },
  { id: 'downtime', label: 'Downtime', unit: 'min', get: (o, z) => zoneDowntimeMin(z.id) },
  { id: 'util', label: 'Utilization', unit: '%', get: (o, z) => zoneUtilization(o, z) },
  { id: 'energy', label: 'Energy intensity', unit: '', get: (o, z) => zoneEnergy(o, z).value },
]

export function ZoneAnalytics() {
  const dash = useDashboard()
  const zoneId = useDashboard(s => s.zone)
  const compare = useDashboard(s => s.compare)
  const cmpMetric = useDashboard(s => s.cmpMetric)
  const snap = useDashSnapshot()
  const { objects, alerts } = snap
  const zone = ZONES.find(z => z.id === zoneId) || ZONES[0]

  const selectAsset = (id) => { dash.openTwin(); useSceneStore.getState().selectObject(id); setTimeout(() => useSceneStore.getState().flyToObject(id), 90) }
  const t = zoneThroughput(objects, zone), e = zoneEnergy(objects, zone), za = zoneAlerts(objects, zone, alerts)
  const util = zoneUtilization(objects, zone), no = nomOut[zone.id]
  const problems = topProblemAssets(objects, zone, alerts)
  const assets = zoneAssets(objects, zone)
  const cmp = COMPARE.find(x => x.id === cmpMetric) || COMPARE[0]
  const cmpRows = ZONES.map(z => ({ id: z.id, name: z.name, status: zoneStatus(objects, z, alerts), value: cmp.get(objects, z, alerts), onClick: () => { dash.setCompare(false); dash.setZone(z.id) } }))

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto minmax(0,1fr)', gap: 20, padding: 24 }}>
      {/* zone strip — card row, natural height */}
      <div className="panel-in" style={{ ...card, display: 'flex', alignItems: 'stretch' }}>
        {ZONES.map((z, i) => <ZoneStripBlock key={z.id} zone={z} objects={objects} alerts={alerts} active={!compare && z.id === zoneId} onSelect={() => { dash.setCompare(false); dash.setZone(z.id) }} last={i === ZONES.length - 1} />)}
      </div>
      {/* mode + metric selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
          {[['detail', 'Zone detail'], ['compare', 'Compare zones']].map(([k, lbl]) => {
            const on = (k === 'compare') === !!compare
            return <button key={k} onClick={() => dash.setCompare(k === 'compare')} style={{ ...ty.body, fontWeight: 600, padding: '6px 14px', border: 'none', cursor: 'pointer', background: on ? T.accent : 'transparent', color: on ? '#fff' : T.ink2 }}>{lbl}</button>
          })}
        </div>
        {compare && <div style={{ display: 'inline-flex', border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
          {COMPARE.map(mt => { const on = cmpMetric === mt.id; return <button key={mt.id} onClick={() => dash.setCmpMetric(mt.id)} style={{ ...ty.body, fontWeight: 600, padding: '6px 12px', border: 'none', cursor: 'pointer', background: on ? T.accent : 'transparent', color: on ? '#fff' : T.ink2 }}>{mt.label}</button> })}
        </div>}
      </div>
      {compare ? (
        <div className="panel-in" style={{ ...card, minHeight: 0, padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...ty.cardTitle, marginBottom: 16, flexShrink: 0 }}>{cmp.label} by zone{cmp.unit ? ` (${cmp.unit})` : ''}</div>
          <div className="dash-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}><CompareBars rows={cmpRows} unit={cmp.unit} /></div>
        </div>
      ) : (
        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 24 }}>
          <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)', gap: 24 }}>
            {/* KPI row — 6 stat blocks, natural height */}
            <div className="panel-in" style={{ ...card, display: 'flex', alignItems: 'stretch', padding: '12px 0', animationDelay: '60ms' }}>
              <StatBlock label="Throughput out" value={fmt(t.out)} unit="t/h" sub={<Delta pct={deltaPct(t.out, no)} suffix="vs nom" />} />
              <StatBlock label="Utilization" value={util} unit="%" sub={<Delta pct={deltaPct(util, 88)} suffix="vs target" />} />
              <StatBlock label="Active alerts" value={za.list.length} dot={za.crit ? STATUS.red : za.warn ? STATUS.amber : null} />
              <StatBlock label="Energy intensity" value={e.value} unit={e.unit} />
              <StatBlock label="Downtime today" value={zoneDowntimeMin(zone.id)} unit="min" />
              <StatBlock label="Workers" value={zoneWorkers(objects, zone)} last />
            </div>
            {/* three chart cards fill the remaining height */}
            <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 24 }}>
              <ChartCard title="Throughput · 60 min" value={fmt(t.out)} unit="t/h"><TrendChart data={zoneSeries(zone.id, 'tout')} band={no ? [no * 0.92, no] : null} /></ChartCard>
              <ChartCard title="Alerts · 60 min" value={za.list.length}><AlertTimeline events={zoneAlertEvents(zone.id)} /></ChartCard>
              <ChartCard title="Utilization · 60 min" value={util} unit="%"><TrendChart data={zoneSeries(zone.id, 'util')} band={[82, 96]} /></ChartCard>
            </div>
          </div>
          {/* right column: issues + evidence + machines (machines absorbs overflow) */}
          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="panel-in" style={{ ...card, padding: 20, flexShrink: 0, animationDelay: '120ms' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}><span style={ty.cardTitle}>Top Issues</span>
                <button onClick={() => { dash.openTwin(); setTimeout(() => useSceneStore.getState().flyToObject(zone.focus), 90) }} className="link-twin" style={{ ...linkStyle, marginLeft: 'auto' }}>View in Twin →</button></div>
              {problems.length === 0 && <span style={ty.label}>No issues in this zone</span>}
              {problems.map((o, i) => { const hp = assetHeadlineParam(o), st = assetStatus(o); return (
                <button key={o.id} onClick={() => selectAsset(o.id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', border: 'none', borderTop: i ? `1px solid ${T.line}` : 'none', background: 'none' }}>
                  <span style={{ ...ty.body, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                  {hp && <span style={{ ...ty.label, whiteSpace: 'nowrap' }}>{hp.label} {Math.round(+hp.value * 10) / 10}{hp.unit}</span>}
                  <span style={{ ...ty.label, width: 58, textAlign: 'right', color: st !== 'green' ? STATUS[st] : T.ink2, fontWeight: 600 }}>{STATUS_WORD[st]}</span>
                </button>
              ) })}
            </div>
            {zone.id === 'proc' && <div style={{ flexShrink: 0 }}><CoalSizeWidget compact /></div>}
            <div className="panel-in" style={{ ...card, padding: 20, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', animationDelay: '180ms' }}>
              <div style={{ ...ty.cardTitle, marginBottom: 8, flexShrink: 0 }}>Machines ({assets.length})</div>
              <div className="dash-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {assets.map(o => { const st = assetStatus(o); return (
                  <button key={o.id} onClick={() => selectAsset(o.id)} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', border: 'none', background: 'none' }}>
                    {st !== 'green' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS[st] }} />}
                    <span style={{ ...ty.body, color: T.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                  </button>
                ) })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
