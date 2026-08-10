// Operational jobs for the Equipment & Resources tab. Windows are expressed as
// offsets from "now" (hours) so some are current, some upcoming; a couple share a
// unit (built-in conflict), and a couple are unassigned or need an unavailable
// unit. Standalone demo data — not tied to the twin.
const H = 3600e3

// offStart = hours from now the job starts; durH = duration; defaultUnit = the
// pre-assigned unit (null = unassigned).
export const JOBS = [
  { id: 'JOB-201', title: 'Overburden strip — North Bench', area: 'load', priority: 'P1', reqType: 'shovel',   offStart: -2, durH: 6,  defaultUnit: 'EX-01' },
  { id: 'JOB-202', title: 'Coal loading — Seam 3',          area: 'load', priority: 'P2', reqType: 'shovel',   offStart: 3,  durH: 5,  defaultUnit: 'EX-02' },
  { id: 'JOB-203', title: 'Haul cycle — Pit → Crusher',     area: 'haul', priority: 'P1', reqType: 'truck',    offStart: -1, durH: 8,  defaultUnit: 'HT-01' },
  { id: 'JOB-204', title: 'Haul cycle — Pit → Stockpile',   area: 'haul', priority: 'P2', reqType: 'truck',    offStart: -1, durH: 8,  defaultUnit: 'HT-02' },
  { id: 'JOB-205', title: 'Blast-hole drilling — B-114',    area: 'pit',  priority: 'P1', reqType: 'drill',    offStart: 0,  durH: 6,  defaultUnit: 'BD-01' },
  { id: 'JOB-206', title: 'Blast-hole drilling — B-115',    area: 'pit',  priority: 'P2', reqType: 'drill',    offStart: 7,  durH: 6,  defaultUnit: 'BD-02' },
  { id: 'JOB-207', title: 'Haul road maintenance — Ramp R-4', area: 'haul', priority: 'P3', reqType: 'loader', offStart: -3, durH: 5,  defaultUnit: 'WL-01' },
  { id: 'JOB-208', title: 'Primary crushing run',           area: 'crush', priority: 'P1', reqType: 'crusher', offStart: -4, durH: 12, defaultUnit: 'CR-01' },
  { id: 'JOB-209', title: 'Conveyor transfer — CHPP feed',  area: 'crush', priority: 'P2', reqType: 'conveyor', offStart: -2, durH: 10, defaultUnit: 'CV-01' },
  { id: 'JOB-210', title: 'Tailings thickening',            area: 'wash', priority: 'P2', reqType: 'thickener', offStart: -5, durH: 14, defaultUnit: 'TH-01' },
  { id: 'JOB-211', title: 'Night haul — Pit → Crusher',     area: 'haul', priority: 'P2', reqType: 'truck',    offStart: 10, durH: 8,  defaultUnit: 'HT-03' },
  { id: 'JOB-212', title: 'Excavator relocation — South Wall', area: 'load', priority: 'P2', reqType: 'shovel', offStart: 1, durH: 4, defaultUnit: 'EX-01' }, // overlaps JOB-201 on EX-01 → conflict
  { id: 'JOB-213', title: 'Reserve haul truck — standby',   area: 'haul', priority: 'P3', reqType: 'truck',    offStart: 2,  durH: 6,  defaultUnit: null },   // unassigned
  { id: 'JOB-214', title: 'Screen deck inspection support', area: 'wash', priority: 'P2', reqType: 'loader',   offStart: 5,  durH: 3,  defaultUnit: null },   // unassigned
  { id: 'JOB-215', title: 'Ad-hoc haulage — spillage clear', area: 'haul', priority: 'P1', reqType: 'truck',   offStart: 0,  durH: 4,  defaultUnit: 'HT-04' }, // HT-04 is under maintenance → unavailable
]

export const jobById = (id) => JOBS.find(j => j.id === id)
export const jobWindow = (job, now) => { const start = new Date(now.getTime() + job.offStart * H); return { start, end: new Date(start.getTime() + job.durH * H) } }
export const effectiveUnit = (job, assignments = {}) => (job.id in assignments ? assignments[job.id] : job.defaultUnit) || null

export const overlaps = (a, b) => a.start < b.end && b.start < a.end

export function jobsForUnit(unitId, assignments, now) {
  return JOBS.filter(j => effectiveUnit(j, assignments) === unitId).map(j => ({ ...j, ...jobWindow(j, now) }))
}
export function currentJobFor(unitId, assignments, now) {
  return jobsForUnit(unitId, assignments, now).find(j => j.start <= now && now < j.end) || null
}
export function upcomingFor(unitId, assignments, now) {
  return jobsForUnit(unitId, assignments, now).filter(j => j.start > now).sort((a, b) => a.start - b.start)
}
