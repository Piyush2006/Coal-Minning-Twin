// Global line dashboard — KPIs + line OEE + fleet state chips + active alerts.
// Shown as the "Overview" tab of the view-mode right panel (default when
// nothing selected). Pure render over `objects`; the simulator mutates objects
// each tick so it updates live. Reusable for any twin (KPIs auto-hide what
// isn't present; the alerts list shows whatever alertRules the assets declare).
import { useMemo } from 'react'
import { computeKPIs, computeGroupKPIs } from '../lib/kpiSchemas'
import { stateMeta } from '../lib/stateSchemas'
import { evaluateAlerts, ALERT_SEVERITY_COLOR } from '../lib/alertsEngine'
import { useSceneStore } from '../store/sceneStore'
import { C, R } from '../ui/theme'

const fmt = (v, d) => Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })

// ── Active alerts list (generic threshold layer — lib/alertsEngine) ─────────
// Same visual language as the fleet chips; newest first; click → fly to asset.
function AlertsSection({ objects }) {
  const alerts = useMemo(() => evaluateAlerts(objects), [objects])
  const selectObject = useSceneStore(s => s.selectObject)
  const flyToObject = useSceneStore(s => s.flyToObject)
  const nCrit = alerts.filter(a => a.severity === 'critical').length
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 8px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3 }}>
          Active Alerts
        </p>
        {alerts.length > 0 && (
          <span style={{ minWidth: 18, textAlign: 'center', padding: '1px 6px', borderRadius: R.pill, fontSize: 10.5, fontWeight: 700,
            color: '#fff', background: nCrit ? ALERT_SEVERITY_COLOR.critical : ALERT_SEVERITY_COLOR.warn }}>
            {alerts.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: C.text3,
          border: `1px solid ${C.line}`, borderRadius: R.pill, padding: '1px 7px' }}>MOCK DATA</span>
      </div>
      {alerts.length === 0 ? (
        <p style={{ fontSize: 12, color: C.text3, padding: '10px 2px' }}>No active alerts</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map(a => (
            <button key={a.key}
              onClick={() => { selectObject(a.objId); flyToObject(a.objId) }}
              style={{ textAlign: 'left', cursor: 'pointer', padding: '8px 10px', borderRadius: R.md,
                background: C.surface, border: `1px solid ${C.line}`, font: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: ALERT_SEVERITY_COLOR[a.severity] }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.asset}
                </span>
                {a.useCase && (
                  <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: C.text2,
                    background: 'rgba(120,120,128,0.10)', border: `1px solid ${C.line}`, borderRadius: R.pill, padding: '1px 7px' }}>
                    {a.useCase}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11.5, color: C.text2, marginTop: 4, lineHeight: 1.35 }}>{a.message}</p>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// `kpiDefs` (optional) = author-declared line/group KPIs; when present they
// replace the default global KPI set (used by the per-group inspector).
export function OverviewPanel({ objects, kpiDefs, title = 'Line Overview' }) {
  const kpis = kpiDefs?.length ? computeGroupKPIs(kpiDefs, objects) : computeKPIs(objects)

  // fleet state chips — aggregate by state label across all assets
  const chips = {}
  Object.values(objects).forEach(o => {
    const m = stateMeta(o.type, o.state)
    const c = chips[m.label] ?? { label: m.label, color: m.color, n: 0 }
    c.n += 1
    chips[m.label] = c
  })
  const chipList = Object.values(chips).sort((a, b) => b.n - a.n)

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{title}</h3>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: C.good }}>● LIVE</span>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {kpis.map(k => (
          <div key={k.key} style={{ padding: '10px 12px', borderRadius: R.md,
            background: C.surface, border: `1px solid ${C.line}` }}>
            <p style={{ fontSize: 19, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {fmt(k.value, k.digits)}
              {k.unit && <span style={{ fontSize: 11, fontWeight: 500, color: C.text3 }}> {k.unit}</span>}
            </p>
            <p style={{ fontSize: 11, color: C.text2, marginTop: 3 }}>{k.label}</p>
          </div>
        ))}
      </div>


      {/* Active alerts — generic threshold layer over the mock simulator */}
      <AlertsSection objects={objects} />

      {/* Fleet state chips */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
        color: C.text3, margin: '20px 0 8px' }}>Fleet Status</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chipList.map(c => (
          <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: R.pill, background: 'rgba(120,120,128,0.10)',
            border: `1px solid ${C.line}`, fontSize: 12, color: C.text2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
            {c.label}<span style={{ fontWeight: 600, color: C.text }}>{c.n}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
