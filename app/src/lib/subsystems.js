// Subsystem model for the asset inspector: maps spec part names AND active
// alerts onto a small set of machine subsystems. Health/banding reuses the
// Pass-3 asset-health selector — no forked derivation.
import { assetHealthModel } from './assetHealth'

const KEYWORDS = [
  [/track|crawler|wheel|tyre|tire/i, 'Undercarriage & Tyres'],
  [/boom|arm|stick|bucket|blade|mast|dump|coalload/i, 'Work Group'],
  [/engine|exhaust|radiator|hood|grille/i, 'Engine'],
  [/cab|canopy|rops/i, 'Cab'],
  [/belt|idler|roller|pulley|drum/i, 'Belt & Idlers'],
  [/motor|drive|gear|bearing|shaft|jaw|liner|screen|flywheel|crush/i, 'Drivetrain'],
]
// per-type overrides for misfit part names
const TYPE_OVERRIDES = {
  haul_truck: { chassis: 'Structure', headlightL: 'Structure', headlightR: 'Structure' },
}

export function partSubsystem(name, type) {
  if (!name) return null
  const ov = TYPE_OVERRIDES[type]
  if (ov && ov[name] !== undefined) return ov[name]
  for (const [re, sub] of KEYWORDS) if (re.test(name)) return sub
  return 'Structure'
}

// alert tag → subsystem (Operational is a pseudo-subsystem: list-only, no 3D parts)
const ALERT_SUB = {
  'HEMM PdM': 'Engine', 'TPMS': 'Undercarriage & Tyres', 'Vibration CBM': 'Drivetrain',
  'Conveyor Vision': 'Belt & Idlers', 'CHP SEC': 'Drivetrain',
  'Haulage': 'Operational', 'Worker Safety': 'Operational',
  'Dust & Env': 'Structure',
}
export const alertSubsystem = (a) => ALERT_SUB[a.useCase] ?? 'Structure'

const CANON = ['Engine', 'Drivetrain', 'Undercarriage & Tyres', 'Work Group', 'Belt & Idlers', 'Cab', 'Structure', 'Hull/Body', 'Operational']
const RANK = { red: 0, amber: 1, green: 2 }

export function buildInspectorModel(objects, alerts, id, typeDef) {
  const obj = objects[id]
  const row = assetHealthModel(objects, alerts).rows.find(r => r.id === id) ?? { band: 'green', health: 95, alerts: [], worst: null }
  const parts = typeDef?.parts ?? []
  const singleBody = !!obj?.config?.model?.file || parts.length === 0
  const present = new Set()
  if (singleBody) present.add('Hull/Body')
  else for (const p of parts) { const sub = partSubsystem(p.id, obj?.type); if (sub) present.add(sub) }
  // map this asset's active alerts onto subsystems (physical alerts collapse to
  // Hull/Body on single-body assets; Operational always stays separate)
  const alertsBySub = new Map()
  for (const a of row.alerts) {
    let sub = alertSubsystem(a)
    if (singleBody && sub !== 'Operational') sub = 'Hull/Body'
    present.add(sub)
    if (!alertsBySub.has(sub)) alertsBySub.set(sub, [])
    alertsBySub.get(sub).push(a)
  }
  const subsystems = [...present].map(name => {
    const list = alertsBySub.get(name) ?? []
    const worst = list.find(a => a.severity === 'critical') ?? list[0] ?? null
    return { name, band: worst ? (worst.severity === 'critical' ? 'red' : 'amber') : 'green', note: worst ? worst.message : 'Nominal' }
  }).sort((a, b) => RANK[a.band] - RANK[b.band] || CANON.indexOf(a.name) - CANON.indexOf(b.name))
  const worstSub = subsystems.find(s => s.band !== 'green') ?? null
  return { row, subsystems, singleBody, worstSub }
}
