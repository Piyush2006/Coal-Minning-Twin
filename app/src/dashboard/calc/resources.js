// Equipment & Resources — the management/operational-readiness rollup. Reuses the
// existing asset-condition (health/sensors/PDM), per-unit utilisation, jobs and
// planned-downtime data. Pure given (filters, settings, assignments, now).
import { eachDay } from '../data/rng'
import { assetCondition } from '../data/assets'
import { unitStats } from '../data/equipment'
import { ROSTER, filterRoster, typeLabel, simplifyStatus } from '../data/resources'
import { JOBS, effectiveUnit, jobWindow, currentJobFor, upcomingFor, overlaps } from '../data/resourceJobs'
import { downtimeActiveNow } from '../data/plannedDowntime'

const BASELINE_UTIL = 82
const round = (n, dp = 0) => { const f = 10 ** dp; return Math.round(n * f) / f }
const PRIO = { P1: 0, P2: 1, P3: 2 }

export function buildResources({ range, mineId, areaId, equipTypeId, settings, assignments = {}, now = new Date() }) {
  const days = eachDay(range).length

  // condition + tab status for EVERY roster unit (assignment/conflict use the
  // full roster regardless of the monitor's type filter)
  const cond = {}, gStatus = {}
  for (const u of ROSTER) {
    cond[u.id] = assetCondition(u, settings)
    gStatus[u.id] = downtimeActiveNow(u.id, now) ? 'Under Maintenance' : simplifyStatus(cond[u.id].status)
  }
  const available = (id) => { const s = gStatus[id]; return !!s && s !== 'Breakdown' && s !== 'Under Maintenance' }

  // ── monitor rows (respect the global mine/area + type filter) ──
  const filtered = filterRoster({ mineId, areaId, equipTypeId })
  const rows = filtered.map(u => {
    const c = cond[u.id]
    const st = unitStats(u, BASELINE_UTIL, days, settings)
    const cur = currentJobFor(u.id, assignments, now)
    return {
      id: u.id, type: u.type, typeName: typeLabel(u.type), area: u.area,
      status: gStatus[u.id], util: round(st.util), downtimeH: round(st.downtimeMin / 60, 1),
      health: c.health, healthStatus: c.healthStatus, severity: c.severity, currentJob: cur ? cur.title : null,
    }
  })
  const rank = (s) => (s === 'Breakdown' ? 0 : s === 'Under Maintenance' ? 1 : 2)
  rows.sort((a, b) => rank(a.status) - rank(b.status) || a.health - b.health)

  // ── overview ──
  const counts = { total: rows.length, Running: 0, Idle: 0, Breakdown: 0, 'Under Maintenance': 0 }
  for (const r of rows) counts[r.status] += 1
  const overallUtil = rows.length ? round(rows.reduce((a, r) => a + r.util, 0) / rows.length) : 0
  const availability = rows.length ? round(((rows.length - counts.Breakdown - counts['Under Maintenance']) / rows.length) * 100) : 0
  const overview = { ...counts, overallUtil, availability }

  // ── assignments (all jobs, global) ──
  const jobRows = JOBS.map(j => {
    const eff = effectiveUnit(j, assignments)
    const win = jobWindow(j, now)
    return {
      job: j, eff, win, priority: j.priority, reqType: j.reqType, reqLabel: typeLabel(j.reqType),
      unitStatus: eff ? gStatus[eff] : null,
      unassigned: !eff,
      unitUnavailable: !!eff && !available(eff),
      conflict: false,
    }
  })

  // ── conflicts (same effective unit, overlapping windows) ──
  const conflicts = []
  const byUnit = {}
  for (const r of jobRows) if (r.eff) (byUnit[r.eff] || (byUnit[r.eff] = [])).push(r)
  for (const [unitId, list] of Object.entries(byUnit)) {
    for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) {
      if (overlaps(list[i].win, list[k].win)) {
        list[i].conflict = list[k].conflict = true
        conflicts.push({
          unitId, a: list[i].job, b: list[k].job,
          overlapStart: new Date(Math.max(list[i].win.start, list[k].win.start)),
          overlapEnd: new Date(Math.min(list[i].win.end, list[k].win.end)),
        })
      }
    }
  }
  jobRows.sort((a, b) => PRIO[a.priority] - PRIO[b.priority] || a.win.start - b.win.start)
  const problemCount = jobRows.filter(r => r.unassigned || r.unitUnavailable || r.conflict).length

  // ── equipment at risk (attention ranking over the filtered set) ──
  const atRisk = filtered.map(u => {
    const c = cond[u.id], s = gStatus[u.id]
    let score = 0; const reasons = []
    if (s === 'Breakdown') { score += 45; reasons.push('in breakdown') }
    if (c.severity === 'Critical') { score += 30; reasons.push(`critical: ${c.diagnosis?.fault || 'sensor alert'}`) }
    else if (c.severity === 'Warning') { score += 14; reasons.push(`warning: ${c.diagnosis?.fault || 'sensor alert'}`) }
    if (c.breakdowns) { score += c.breakdowns * 4; if (s !== 'Breakdown') reasons.push(`${c.breakdowns} recent breakdown${c.breakdowns > 1 ? 's' : ''}`) }
    if (c.maintenance === 'Overdue') { score += 10; reasons.push('maintenance overdue') }
    score += (100 - c.health) * 0.5
    return { id: u.id, typeName: typeLabel(u.type), status: s, health: c.health, healthStatus: c.healthStatus, score, reason: reasons[0] || `health ${c.health}` }
  }).filter(x => x.score >= 18).sort((a, b) => b.score - a.score).slice(0, 6)

  return { now, overview, rows, jobRows, conflicts, problemCount, atRisk, condOf: (id) => cond[id], statusOf: (id) => gStatus[id], available }
}

// candidate units for a job's required type (for the assign picker)
export function candidatesForType(reqType, gStatusOf) {
  return ROSTER.filter(u => u.type === reqType).map(u => ({ id: u.id, name: `${u.id} · ${typeLabel(u.type)}`, status: gStatusOf(u.id) }))
}

export { upcomingFor }
