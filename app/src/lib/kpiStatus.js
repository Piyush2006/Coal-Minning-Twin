// Traffic-light engine — ONE source of truth shared by the 3D alert rings and
// the operations dashboard. Status is derived from the SAME config.alertRules
// the alert engine evaluates, so a machine that shows a red ring in the twin
// shows a red KPI on the dashboard, always.
//
//   RED   = a critical rule on this param is firing (value beyond critical threshold)
//   AMBER = a warn rule is firing, OR value within NEAR (15%) of its nearest threshold
//   GREEN = otherwise
//
// KPIs without a rule use an explicit target band { good, warn, crit, dir }.
export const STATUS_RANK = { green: 0, amber: 1, red: 2 }
export const STATUS_COLOR = { green: '#34c759', amber: '#ff9f0a', red: '#ff3b30' }
const NEAR = 0.15

function ruleFires(rule, v) {
  const t = rule.threshold
  if (rule.op === '>') return v > Number(t)
  if (rule.op === '<') return v < Number(t)
  if (rule.op === 'between') return Array.isArray(t) && v >= Number(t[0]) && v <= Number(t[1])
  return false
}
// distance to threshold as a fraction of the threshold magnitude (0 = at it)
function nearness(rule, v) {
  const t = rule.threshold
  if (rule.op === '>') { const T = Number(t); return T ? (v >= T * (1 - NEAR) && v < T ? (T - v) / (Math.abs(T) || 1) : 1) : 1 }
  if (rule.op === '<') { const T = Number(t); return T ? (v <= T * (1 + NEAR) && v > T ? (v - T) / (Math.abs(T) || 1) : 1) : 1 }
  return 1
}

/** Status for one parameter on one object, using its alert rules. */
export function paramStatus(obj, param) {
  const v = Number(obj?.parameters?.[param])
  if (!Number.isFinite(v)) return 'green'
  const rules = (obj.config?.alertRules ?? []).filter(r => r && r.enabled !== false && r.param === param)
  let st = 'green'
  for (const r of rules) {
    if (ruleFires(r, v)) return r.severity === 'critical' ? 'red' : (st = 'amber', st === 'red' ? 'red' : 'amber')
  }
  // not firing — amber if hovering just short of a threshold
  for (const r of rules) if (nearness(r, v) < NEAR) st = st === 'red' ? 'red' : 'amber'
  return st
}

/** Status for a bare value against an explicit target band. */
export function bandStatus(v, band) {
  if (!band || !Number.isFinite(Number(v))) return 'green'
  v = Number(v)
  const dir = band.dir ?? 'high'                 // 'high' = higher is worse; 'low' = lower is worse
  const { warn, crit } = band
  if (dir === 'high') {
    if (crit != null && v >= crit) return 'red'
    if (warn != null && v >= warn) return 'amber'
    if (warn != null && v >= warn - Math.abs(warn) * NEAR) return 'amber'
  } else {
    if (crit != null && v <= crit) return 'red'
    if (warn != null && v <= warn) return 'amber'
    if (warn != null && v <= warn + Math.abs(warn) * NEAR) return 'amber'
  }
  return 'green'
}

export const worst = (statuses) => statuses.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a), 'green')
export const statusLabel = (s) => (s === 'red' ? 'Critical' : s === 'amber' ? 'Attention' : 'Healthy')
