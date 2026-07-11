// Asset drill-down sections for the view-mode Asset tab: live mini sparklines
// over the asset's key parameters, and the asset's recent fired-alert history.
// Fully generic — works for any asset with params/alertRules, no per-type code.
// Cheap: values buffer (paramHistory ring buffers) only while a panel showing
// them is mounted; sparklines are plain SVG polylines, re-rendered at the 1 Hz
// sim tick only while the panel is open.
import { useEffect, useMemo } from 'react'
import { useSceneStore } from '../store/sceneStore'
import { getAlertLog, ALERT_SEVERITY_COLOR } from '../lib/alertsEngine'
import { recordParam, getParamHistory } from '../lib/paramHistory'
import { C } from '../ui/theme'

const SectionLabel = ({ children }) => (
  <div style={{ padding: '16px 0 6px' }}>
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>{children}</span>
  </div>
)

function Spark({ objId, def }) {
  const data = getParamHistory(objId, def.key)
  const W = 236, H = 40
  let path = null, lo = 0, hi = 0
  if (data.length >= 2) {
    lo = Math.min(...data); hi = Math.max(...data)
    const span = hi - lo || 1
    path = data.map((v, i) =>
      `${((i / (data.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - lo) / span) * (H - 8)).toFixed(1)}`).join(' ')
  }
  const last = data.length ? data[data.length - 1] : null
  return (
    <div style={{ padding: '8px 10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.line}`, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text2 }}>{def.label ?? def.key}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
          {last != null ? +last.toFixed(2) : '—'}<span style={{ fontSize: 10, fontWeight: 500, color: C.text3, marginLeft: 3 }}>{def.unit ?? ''}</span>
        </span>
      </div>
      {path ? (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} preserveAspectRatio="none">
          <polyline points={`0,${H} ${path} ${W},${H}`} fill="rgba(10,132,255,0.10)" stroke="none" />
          <polyline points={path} fill="none" stroke={C.accent} strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      ) : (
        <div style={{ height: H, display: 'grid', placeItems: 'center', fontSize: 11, color: C.text3 }}>collecting…</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: C.text3, marginTop: 2 }}>
        <span>{data.length >= 2 ? +lo.toFixed(1) : ''}</span><span>{data.length >= 2 ? +hi.toFixed(1) : ''}</span>
      </div>
    </div>
  )
}

/** Live sparklines over the asset's first few parameters (ring-buffered). */
export function AssetSparklines({ obj, defs }) {
  const shown = useMemo(() => (defs ?? []).filter(d => d.freq !== 'manual').slice(0, 4), [defs])
  // Subscribing to this asset's params re-renders at the sim tick while the
  // panel is open — each tick appends to the ring buffers.
  const params = useSceneStore(s => s.objects[obj.id]?.parameters)
  useEffect(() => {
    if (!params) return
    for (const d of shown) recordParam(obj.id, d.key, Number(params[d.key]))
  }, [params, obj.id, shown])
  if (!shown.length) return null
  return (
    <div>
      <SectionLabel>Live Trends</SectionLabel>
      {shown.map(d => <Spark key={d.key} objId={obj.id} def={d} />)}
    </div>
  )
}

/** This asset's recent fired alerts (session ring buffer, newest first). */
export function AssetAlertHistory({ obj }) {
  const objects = useSceneStore(s => s.objects)                      // refresh with the sim tick
  const log = useMemo(() => getAlertLog(obj.id).slice(0, 6), [objects, obj.id])
  return (
    <div>
      <SectionLabel>Recent Alerts</SectionLabel>
      {log.length === 0 && <p style={{ fontSize: 12, color: C.text3 }}>No alerts fired this session.</p>}
      {log.map((e, i) => (
        <div key={`${e.t}:${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px',
          borderRadius: 10, background: C.surface, border: `1px solid ${C.line}`, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
            background: ALERT_SEVERITY_COLOR[e.severity] }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.35 }}>{e.message}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
              <span style={{ fontSize: 9.5, color: C.text3 }}>{new Date(e.t).toLocaleTimeString()}</span>
              {e.useCase && <span style={{ fontSize: 9, fontWeight: 600, color: C.text2, background: 'rgba(120,120,128,0.12)',
                borderRadius: 4, padding: '1px 6px' }}>{e.useCase}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
