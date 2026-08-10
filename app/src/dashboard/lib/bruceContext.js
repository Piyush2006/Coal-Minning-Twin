// Builds the LIVE DATA CONTEXT sent to Bruce with every question. It runs the
// same calc builders the dashboard renders from, so Bruce always answers about
// exactly what the user is looking at (current filters + date range included).
// Output is compact plain text with clear section headers and numbers.
import { buildProduction } from '../calc/production'
import { buildEquipment } from '../calc/equipment'
import { buildFleet } from '../calc/fleet'
import { buildPdm } from '../calc/pdm'
import { buildSafety } from '../calc/safety'
import { fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { MINES, AREAS, EQUIP_TYPES, CURRENCY } from '../data/taxonomy'
import { fmtEvidenceTime } from '../components/EvidenceModal'

const nameOf = (list, id) => list.find(x => x.id === id)?.name || id
const pct = (v, d = 1) => `${fmt(v, d)}%`

export function buildBruceContext(state) {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings, plan, safetyActions = {} } = state
  const args = { range, mineId, areaId, equipTypeId, shiftMode, settings, plan }

  const prod = buildProduction(args)
  const equip = buildEquipment({ range, mineId, areaId, equipTypeId, settings, overallUtil: prod.utilization.pct })
  const fleet = buildFleet({ range, mineId, areaId, equipTypeId, settings, overallUtil: prod.utilization.pct })
  const pdm = buildPdm({ range, mineId, areaId, equipTypeId, settings })
  const safety = buildSafety({ range, mineId, areaId, equipTypeId, settings })

  const L = []
  const push = (s = '') => L.push(s)

  push('BLACKRIDGE COAL — MANAGEMENT DASHBOARD · LIVE DATA SNAPSHOT')
  push('You are Bruce, the assistant embedded in this dashboard. Answer ONLY from the data below; if something is not present, say so. Keep answers concise and reference the exact numbers.')
  push('')
  push(`Scope: ${nameOf(MINES, mineId)} · Area: ${nameOf(AREAS, areaId)} · Equipment: ${nameOf(EQUIP_TYPES, equipTypeId)} · Shift-wise: ${shiftMode ? 'ON' : 'OFF'}`)
  push(`Date range: ${fmtStamp(range.start)} → ${fmtStamp(range.end)} (${prod.days} days)`)
  push(`Currency: ${CURRENCY}`)

  // ── Plan ──
  push('')
  if (plan) {
    push(`OPERATIONAL PLAN: ${plan.level} plan (source: ${plan.source}${plan.fileName ? `, ${plan.fileName}` : ''}), ${plan.rows?.length ?? 0} rows. Covers ${prod.plan.coveredDays}/${prod.plan.totalDays} days of this range.`)
  } else {
    push('OPERATIONAL PLAN: none uploaded — Plan-vs-Actual, targets and gap are unavailable until a plan is added.')
  }

  // ── Production ──
  push('')
  push('PRODUCTION PERFORMANCE')
  if (prod.achievement) {
    const a = prod.achievement
    push(`- Plan vs Actual: ${fmt(a.actual)} T actual of ${fmt(a.planned)} T planned = ${pct(a.pct)} achievement (${a.status}).`)
    push(`- Gap: ${fmt(Math.max(0, a.planned - a.actual))} T. Loss by cause: ${prod.loss.byCause.map(c => `${c.cause} ${fmt(c.value)} T`).join(', ')}.`)
  } else {
    push(`- Actual output: ${fmt(prod.totals.actual)} T (no plan covers this range, so no achievement %).`)
  }
  push(`- Throughput: ${fmt(prod.throughput.actual)} T/hr${prod.throughput.target != null ? ` (target ${fmt(prod.throughput.target)})` : ''}.`)
  push(`- Coal Recovery: ${pct(prod.yield.actual)} (${prod.yield.status}).`)
  if (shiftMode && prod.shifts) push(`- By shift: ${prod.shifts.map(s => `${s.name} ${fmt(s.actual)} T`).join(', ')}.`)

  // ── Efficiency & Cost ──
  const t = prod.totals
  push('')
  push('EFFICIENCY & COST')
  push(`- Operating Cost / Ton: ${CURRENCY}${fmt(prod.cost.actual)} (planned ${CURRENCY}${fmt(prod.cost.target)}, variance ${fmt(prod.cost.variance, 1)}%).`)
  push(`- Energy / Ton: ${fmt(prod.energy.actual, 2)} kWh/T${prod.targets.energy != null ? ` (target ${prod.targets.energy})` : ''}.`)
  push(`- Fuel / Ton: ${fmt(prod.fuel.actual, 3)} L/T${prod.targets.fuel != null ? ` (target ${prod.targets.fuel})` : ''}.`)
  push(`- Man-Hours / Ton: ${fmt(prod.manHours.actual, 3)} mh/T${prod.targets.manHours != null ? ` (target ${prod.targets.manHours})` : ''}.`)
  push(`- Period totals: saleable ${fmt(t.saleable)} T, energy ${fmt(t.kwh)} kWh, fuel ${fmt(t.litres)} L, man-hours ${fmt(t.manHours)}.`)

  // ── Equipment ──
  push('')
  push('EQUIPMENT UTILISATION & DOWNTIME')
  push(`- Utilisation: ${pct(equip.utilizationPct)} across ${equip.unitCount} units; total downtime ${fmt(equip.downtimeHours, 1)} h.`)
  push(`- Utilisation by type: ${equip.byType.slice(0, 5).map(g => `${g.typeName} ${pct(g.util, 0)}`).join(', ')}.`)
  push(`- Top downtime reasons (h): ${equip.byReason.slice(0, 4).map(r => `${r.name} ${fmt(r.hours, 1)}`).join(', ')}.`)
  push(`- Worst units (downtime h): ${equip.topUnits.slice(0, 4).map(u => `${u.id} ${fmt(u.hours, 1)}h`).join(', ')}.`)

  // ── Fleet ──
  push('')
  push('FLEET')
  const c = fleet.counts
  push(`- ${c.total} units — Running ${c['Running']}, Idle on-job ${c['Idle — On Job']}, Idle off-job ${c['Idle — Off Job']}, Breakdown ${c['Breakdown']}. Avg health ${fmt(fleet.avgHealth)}.`)
  push(`- Lowest health: ${fleet.rows.slice(0, 5).map(r => `${r.id || r.name} (health ${fmt(r.health)}, ${r.status})`).join(', ')}.`)

  // ── Predictive maintenance ──
  push('')
  push('PREDICTIVE MAINTENANCE')
  push(`- ${pdm.counts.Critical} critical, ${pdm.counts.Warning} warning, ${pdm.counts.Normal} normal.`)
  if (pdm.alerts.length) {
    push(`- Top alerts: ${pdm.alerts.slice(0, 5).map(a => `${a.id || a.name} — ${a.diagnosis?.faultType || 'issue'} (${a.severity}, health ${fmt(a.health)})`).join('; ')}.`)
  }

  // ── Safety ──
  push('')
  push('SAFETY')
  push(`- Compliance: ${pct(safety.total.compliancePct)} (${fmt(safety.total.checks)} checks, ${fmt(safety.total.violations)} violations).`)
  push(`- Violations by category: ${safety.byCategory.map(x => `${x.cat} ${fmt(x.violations)}`).join(', ')}.`)
  const raised = Object.keys(safetyActions).length
  const highCrit = safety.evidence.filter(e => e.severity === 'High' || e.severity === 'Critical').length
  push(`- Evidence log: ${safety.evidenceTotal} records (${highCrit} High/Critical); ${raised} action(s) raised.`)
  if (safety.evidence.length) {
    push(`- Recent evidence: ${safety.evidence.slice(0, 5).map(e => `[${fmtEvidenceTime(e.ts)}] ${e.description} (${e.severity}, ${e.location})`).join('; ')}.`)
  }

  // ── Daily series (for trend / line charts) — arrays align to Days, oldest→newest ──
  const tr = prod.trend
  push('')
  push('DAILY SERIES (each array aligns to "Days", oldest→newest — use these for trend/line charts)')
  push(`Days: ${tr.categories.join(', ')}`)
  push(`Actual coal (T/day): ${tr.actual.join(', ')}`)
  if (plan) push(`Planned coal (T/day): ${tr.planned.map(v => (v == null ? '—' : v)).join(', ')}`)
  push(`Energy per ton (kWh/T): ${tr.energyPerTon.join(', ')}`)
  push(`Fuel per ton (L/T): ${tr.fuelPerTon.join(', ')}`)
  push(`Man-hours per ton (mh/T): ${tr.manHoursPerTon.join(', ')}`)
  push(`Safety compliance (%/day): ${safety.trend.compliance.all.join(', ')}`)

  return L.join('\n')
}
