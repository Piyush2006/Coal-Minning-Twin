// Dashboard design tokens — EXACT values from the design spec. The spec wins
// over the app theme inside the dashboard presentation layer.
import { useEffect, useState } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { getModel } from '../../lib/mineModel'
import { evaluateAlerts, getAlertLog } from '../../lib/alertsEngine'

export const T = {
  bg: '#F6F7F9', surface: '#FFFFFF', ink: '#101828', ink2: '#667085', line: '#EAECF0',
  accent: '#1D4ED8', accentSoft: '#1D4ED814', good: '#12B76A', warn: '#F79009', bad: '#F04438',
  grid: '#F2F4F7', radius: 12, font: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
}
export const STATUS = { green: T.good, amber: T.warn, red: T.bad }
export const STATUS_WORD = { green: 'Healthy', amber: 'Attention', red: 'Critical' }
export const SHADOW_MODAL = '0 4px 24px rgba(16,24,40,.08)'

// 7-step type scale — the ONLY sizes that exist.
export const ty = {
  pageTitle: { fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: 0 },
  cardTitle: { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: T.ink2 },
  kpiXL: { fontSize: 32, fontWeight: 650, color: T.ink },
  kpiM: { fontSize: 22, fontWeight: 650, color: T.ink },
  body: { fontSize: 14, fontWeight: 450, color: T.ink },
  label: { fontSize: 12, fontWeight: 500, color: T.ink2 },
  unit: { fontSize: 12, fontWeight: 500, color: T.ink2 },
}
export const Unit = ({ children }) => <span style={{ ...ty.unit, marginLeft: 3 }}>{children}</span>
export const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radius, boxSizing: 'border-box' }

// Delta chip — text-only, coloured, 12px. e.g. ▲ 4.2% vs plan
export const Delta = ({ pct, suffix = 'vs plan', goodWhenPositive = true }) => {
  if (pct == null || !Number.isFinite(pct)) return null
  const up = pct >= 0
  const good = goodWhenPositive ? up : !up
  return <span style={{ fontSize: 12, fontWeight: 500, color: good ? T.good : T.bad }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% {suffix}</span>
}

// ONE plan-tolerance rule: |delta| <= 2% = On plan (neutral); 2-5% behind =
// amber; >5% behind = red; ahead >2% = good. Used by glance, hero and ledger.
export const PlanDelta = ({ pct }) => {
  if (pct == null || !Number.isFinite(pct)) return null
  if (Math.abs(pct) <= 2) return <span style={{ fontSize: 12, fontWeight: 500, color: T.ink2 }}>On plan</span>
  const up = pct >= 0
  const color = up ? T.good : Math.abs(pct) <= 5 ? T.warn : T.bad
  return <span style={{ fontSize: 12, fontWeight: 500, color }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% vs plan</span>
}

export const fmt = (v) => (Math.abs(+v) >= 1000 ? Math.round(+v).toLocaleString() : (Math.round(+v * 10) / 10).toLocaleString())
export const rel = (t) => { const m = Math.round((Date.now() - t) / 60000); return m <= 0 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago` }

// ── 5-second snapshot: values hold still for 5s (no per-second jitter) ──
function build() {
  const objects = useSceneStore.getState().objects
  return { objects, model: getModel(objects), alerts: evaluateAlerts(objects), log: getAlertLog(), t: Date.now() }
}
export function useDashSnapshot() {
  const [snap, setSnap] = useState(build)
  useEffect(() => { const id = setInterval(() => setSnap(build()), 5000); return () => clearInterval(id) }, [])
  return snap
}
