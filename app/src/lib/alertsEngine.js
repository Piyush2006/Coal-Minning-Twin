// ── Generic alert / threshold layer ─────────────────────────────────────────
// ONE evaluator for every monitoring use case. Any asset opts in via config:
//
//   config.alertRules = [{
//     id: 'tyre-temp',            // stable rule id (unique within the asset)
//     param: 'tyreTemp',          // parameter key on this asset
//     op: '>' | '<' | 'between',  // between → threshold = [lo, hi], fires inside
//     threshold: 85,              // number, or [lo, hi] for 'between'
//     severity: 'warn' | 'critical',
//     useCase: 'TPMS',            // free tag shown in the alerts panel
//     message: 'Tyre over-temp {tyreTemp} °C',   // {param} tokens interpolate live values
//     enabled?: true,
//   }, …]
//
// Values come from the asset's (mock, simulator-driven) parameters — the same
// data the tooltips and fleet panel read. A firing rule surfaces through the
// EXISTING severity colours (warn = amber, critical = red) on the StatusLamp
// and through the Alerts panel; no parallel colour system.
import { useMemo } from 'react'
import { useSceneStore } from '../store/sceneStore'

// Same amber/red the state-severity system uses (stateSchemas / ui theme).
export const ALERT_SEVERITY_COLOR = { warn: '#ff9f0a', critical: '#ff3b30' }

function fires(rule, v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return false
  const t = rule.threshold
  switch (rule.op) {
    case '>': return n > Number(t)
    case '<': return n < Number(t)
    case 'between': return Array.isArray(t) && t.length === 2 && n >= Number(t[0]) && n <= Number(t[1])
    default: return false
  }
}

// "{param}" tokens in messages read the asset's live value (1-decimal).
function interpolate(msg, obj) {
  return String(msg || '').replace(/\{(\w+)\}/g, (_, k) => {
    const v = obj.parameters?.[k]
    if (typeof v === 'string') return v                                  // string params (e.g. restrictedZone) pass through
    return Number.isFinite(Number(v)) ? String(Math.round(Number(v) * 10) / 10) : `{${k}}`
  })
}

// First-seen timestamps so the panel can order newest-first and alerts don't
// re-order while they stay active. Module-level (render-independent).
const firstSeen = new Map()

// Session log of FIRED alerts (each key logged once per firing episode) for
// the drill-down's alert history. Ring buffer, newest first, hard cap.
const ALERT_LOG = []
const LOG_CAP = 100

/** Recent fired alerts, newest first — optionally filtered to one asset. */
export function getAlertLog(objId) {
  return objId ? ALERT_LOG.filter(e => e.objId === objId) : ALERT_LOG
}

/** Evaluate all alert rules over an objects map → active alerts, newest first. */
export function evaluateAlerts(objects) {
  const out = []
  const active = new Set()
  for (const id in objects) {
    const o = objects[id]
    const rules = o.config?.alertRules
    if (!Array.isArray(rules)) continue
    for (const r of rules) {
      if (!r || r.enabled === false || !r.param) continue
      if (!fires(r, o.parameters?.[r.param])) continue
      const key = `${id}:${r.id ?? r.param}`
      active.add(key)
      if (!firstSeen.has(key)) {
        firstSeen.set(key, Date.now())
        ALERT_LOG.unshift({
          t: Date.now(), objId: id, asset: o.name ?? id,
          severity: r.severity === 'critical' ? 'critical' : 'warn',
          useCase: r.useCase ?? '', message: interpolate(r.message, o),
        })
        if (ALERT_LOG.length > LOG_CAP) ALERT_LOG.pop()
      }
      out.push({
        key, objId: id, asset: o.name ?? id,
        severity: r.severity === 'critical' ? 'critical' : 'warn',
        useCase: r.useCase ?? '', message: interpolate(r.message, o),
        param: r.param, value: Number(o.parameters?.[r.param]),
        since: firstSeen.get(key),
      })
    }
  }
  for (const k of [...firstSeen.keys()]) if (!active.has(k)) firstSeen.delete(k)
  out.sort((a, b) => (b.since - a.since) || (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
  return out
}

/** objId → worst active severity ('critical' beats 'warn') — drives StatusLamps. */
export function alertSeverityMap(alerts) {
  const m = {}
  for (const a of alerts) if (a.severity === 'critical' || !m[a.objId]) m[a.objId] = a.severity
  return m
}

/** Live active alerts over the whole scene (recomputes on each simulator tick). */
export function useActiveAlerts() {
  const objects = useSceneStore(s => s.objects)
  return useMemo(() => evaluateAlerts(objects), [objects])
}
