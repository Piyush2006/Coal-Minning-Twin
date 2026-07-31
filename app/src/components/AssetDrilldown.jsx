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

// Reusable SVG sparkline (drill-down + operations dashboard). `stroke` lets a
// caller tint the line to a traffic-light colour; defaults to the app accent.
export function Sparkline({ data = [], height = 40, stroke = C.accent, fill = 'rgba(10,132,255,0.10)' }) {
  const W = 236, H = height
  if (data.length < 2) return <div style={{ height: H, display: 'grid', placeItems: 'center', fontSize: 11, color: C.text3 }}>collecting…</div>
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1
  const path = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - lo) / span) * (H - 8)).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} preserveAspectRatio="none">
      <polyline points={`0,${H} ${path} ${W},${H}`} fill={fill} stroke="none" />
      <polyline points={path} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function Spark({ objId, def }) {
  const data = getParamHistory(objId, def.key)
  const lo = data.length >= 2 ? Math.min(...data) : 0, hi = data.length >= 2 ? Math.max(...data) : 0
  const last = data.length ? data[data.length - 1] : null
  return (
    <div style={{ padding: '8px 10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.line}`, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text2 }}>{def.label ?? def.key}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
          {last != null ? +last.toFixed(2) : '—'}<span style={{ fontSize: 10, fontWeight: 500, color: C.text3, marginLeft: 3 }}>{def.unit ?? ''}</span>
        </span>
      </div>
      <Sparkline data={data} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: C.text3, marginTop: 2 }}>
        <span>{data.length >= 2 ? +lo.toFixed(1) : ''}</span><span>{data.length >= 2 ? +hi.toFixed(1) : ''}</span>
      </div>
    </div>
  )
}

/** Live sparklines over the asset's first few parameters (ring-buffered). */
export function AssetSparklines({ obj, defs }) {
  const shown = useMemo(() => {
    const pool = (defs ?? []).filter(d => d.freq !== 'manual')
    // params with a currently-firing alert rule lead the list — the drill-down
    // opens showing exactly the signal that raised the alarm
    const hot = new Set()
    for (const r of obj.config?.alertRules ?? []) {
      const v = Number(obj.parameters?.[r.param])
      if (!Number.isFinite(v)) continue
      const t = r.threshold
      const fires = r.op === '>' ? v > Number(t) : r.op === '<' ? v < Number(t)
        : Array.isArray(t) && v >= Number(t[0]) && v <= Number(t[1])
      if (fires) hot.add(r.param)
    }
    return [...pool].sort((a, b) => (hot.has(b.key) ? 1 : 0) - (hot.has(a.key) ? 1 : 0)).slice(0, 4)
  }, [defs, obj])
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
