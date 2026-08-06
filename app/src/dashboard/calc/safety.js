// Safety KPIs — Compliance % = (Checks − Violations) / Checks × 100, overall and
// per category, with a per-day compliance trend and a shift split.
import { eachDay, scopeOf, fmtDay } from '../data/rng'
import { safetyDay, SAFE_CATS } from '../data/safety'

const comp = (checks, viol) => (checks ? ((checks - viol) / checks) * 100 : 100)
const r1 = (v) => Math.round(v * 10) / 10

export function complianceStatus(pct) {
  if (pct >= 98) return 'positive'
  if (pct >= 95) return 'normal'
  if (pct >= 90) return 'warning'
  return 'critical'
}

export function buildSafety({ range, mineId, areaId, equipTypeId, settings }) {
  const scope = scopeOf({ mineId, areaId, equipTypeId })
  const days = eachDay(range).map(d => safetyDay(d, scope))

  const catTotals = Object.fromEntries(SAFE_CATS.map(c => [c, { checks: 0, violations: 0 }]))
  let checks = 0, violations = 0
  for (const d of days) for (const c of d.cats) { catTotals[c.cat].checks += c.checks; catTotals[c.cat].violations += c.violations; checks += c.checks; violations += c.violations }

  const byCategory = SAFE_CATS.map(c => ({
    cat: c, checks: catTotals[c].checks, violations: catTotals[c].violations, compliancePct: comp(catTotals[c].checks, catTotals[c].violations),
  })).sort((a, b) => b.violations - a.violations)

  // per-day trend (overall + per category)
  const categories = days.map(d => fmtDay(d.date))
  const compliance = { all: [] }
  const viols = { all: [] }
  SAFE_CATS.forEach(c => { compliance[c] = []; viols[c] = [] })
  for (const d of days) {
    let dc = 0, dv = 0
    for (const c of d.cats) { compliance[c.cat].push(r1(comp(c.checks, c.violations))); viols[c.cat].push(c.violations); dc += c.checks; dv += c.violations }
    compliance.all.push(r1(comp(dc, dv))); viols.all.push(dv)
  }

  const names = [settings.shift1?.name || 'Shift 1', settings.shift2?.name || 'Shift 2']
  const shifts = [0, 1].map(i => {
    let sc = 0, sv = 0
    for (const d of days) { const f = i === 0 ? d.s1 : 1 - d.s1; for (const c of d.cats) { sc += c.checks * f; sv += c.violations * f } }
    return { name: names[i], checks: Math.round(sc), violations: Math.round(sv), compliancePct: comp(sc, sv) }
  })

  const totalsByKey = { all: { checks, violations, compliancePct: comp(checks, violations) } }
  for (const c of byCategory) totalsByKey[c.cat] = { checks: c.checks, violations: c.violations, compliancePct: c.compliancePct }

  return { total: totalsByKey.all, totalsByKey, byCategory, categories, trend: { compliance, violations: viols }, shifts }
}
