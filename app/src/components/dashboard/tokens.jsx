// Dashboard design tokens — EXACT values from the design spec. The spec wins
// over the app theme inside the dashboard presentation layer.
import { useEffect, useState, useRef } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { getModel } from '../../lib/mineModel'
import { evaluateAlerts, getAlertLog } from '../../lib/alertsEngine'

export const T = {
  bg: '#F7F8FA', surface: '#FFFFFF', ink: '#101828', ink2: '#667085', line: '#EAECF0',
  accent: '#1D4ED8', accentSoft: '#1D4ED814', good: '#12B76A', warn: '#F79009', bad: '#F04438',
  grid: '#F2F4F7', radius: 12, font: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
}
export const STATUS = { green: T.good, amber: T.warn, red: T.bad }
export const STATUS_WORD = { green: 'Healthy', amber: 'Attention', red: 'Critical' }
export const SHADOW_MODAL = '0 4px 24px rgba(16,24,40,.08)'
export const SHADOW_CARD = '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)'
export const SHADOW_RAISED = '0 4px 12px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)'

// 7-step type scale — the ONLY sizes that exist.
export const ty = {
  pageTitle: { fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: 0 },
  cardTitle: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.ink2 },
  kpiXL: { fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: T.ink },
  kpiM: { fontSize: 22, fontWeight: 600, color: T.ink },
  body: { fontSize: 13, fontWeight: 450, color: T.ink },
  label: { fontSize: 13, fontWeight: 500, color: T.ink2 },
  unit: { fontSize: 13, fontWeight: 500, color: T.ink2 },
}
export const Unit = ({ children }) => <span style={{ ...ty.unit, marginLeft: 3 }}>{children}</span>
export const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.radius, boxShadow: SHADOW_CARD, boxSizing: 'border-box' }

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

export const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const linkStyle = { fontSize: 13, fontWeight: 500, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }

// count-up: 0→value 600ms on first mount, old→new 300ms on ticks; layout-stable
// via tabular-nums + min-width reserved from the FINAL formatted value.
export function useCountUp(value) {
  const target = Number(value) || 0
  const [disp, setDisp] = useState(REDUCED_MOTION ? target : 0)
  const prev = useRef(REDUCED_MOTION ? target : 0)
  const first = useRef(true)
  useEffect(() => {
    if (REDUCED_MOTION) { setDisp(target); prev.current = target; return }
    const from = prev.current
    if (from === target) return
    const dur = first.current ? 600 : 300
    first.current = false
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setDisp(from + (target - from) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return disp
}
export function NumberFlow({ value, format = fmt }) {
  const v = useCountUp(value)
  const final = format(Number(value) || 0)
  return <span style={{ display: 'inline-block', minWidth: `${final.length}ch`, fontVariantNumeric: 'tabular-nums' }}>{format(v)}</span>
}

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
