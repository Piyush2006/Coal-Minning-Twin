// Safety observations — per-day checks and violations by category (PPE /
// Restricted Area / Vehicle Safety / Other). More observations on busier
// operations (scope factor); more violations on rough days — so a bad day both
// dents production and lowers safety compliance.
import { mulberry, hash, dayKey } from './rng'

export const SAFE_CATS = ['PPE', 'Restricted Area', 'Vehicle Safety', 'Other']
const CHECK_SHARE = { 'PPE': 0.4, 'Restricted Area': 0.2, 'Vehicle Safety': 0.3, 'Other': 0.1 }
const VRATE = { 'PPE': 0.035, 'Restricted Area': 0.02, 'Vehicle Safety': 0.03, 'Other': 0.015 }

// CV-detection evidence library per category — the snapshot shown, the possible
// detections (with severity) and where they happen. Danger-zone / blast-zone
// crossings are the high-severity events; missing-PPE is mostly medium.
const EVIDENCE = {
  'PPE': {
    image: 'ppe_compliance.webp',
    items: [
      { text: 'Worker without hard hat near primary crusher', sev: 'High' },
      { text: 'Missing hi-vis vest — CHPP walkway', sev: 'Medium' },
      { text: 'Safety glasses not worn — workshop bay', sev: 'Low' },
      { text: 'No gloves during manual handling — loadout', sev: 'Medium' },
    ],
    loc: ['Primary Crusher', 'CHPP Walkway', 'Workshop Bay 2', 'Loadout'],
  },
  'Restricted Area': {
    image: 'lane_monitoring.webp',
    items: [
      { text: 'Personnel crossing haul-road danger zone', sev: 'High' },
      { text: 'Entry into blast exclusion zone', sev: 'Critical' },
      { text: 'Pedestrian in reversing zone — dump area', sev: 'High' },
      { text: 'Unauthorised entry — high-wall setback', sev: 'Medium' },
    ],
    loc: ['Haul Road HR-02', 'Blast Zone B-114', 'Dump Area', 'High-wall Bench 3'],
  },
  'Vehicle Safety': {
    image: 'lane_monitoring.webp',
    items: [
      { text: 'Haul truck over-speed in loading bay', sev: 'High' },
      { text: 'No seatbelt detected — dozer operator', sev: 'Medium' },
      { text: 'Light vehicle too close to haul truck', sev: 'High' },
      { text: 'Proximity breach — shovel swing radius', sev: 'Medium' },
    ],
    loc: ['Loading Bay 1', 'Ramp R-4', 'Pit Exit', 'Shovel EX-02'],
  },
  'Other': {
    image: 'ppe_compliance.webp',
    items: [
      { text: 'Spill not barricaded — CHPP', sev: 'Medium' },
      { text: 'Fire extinguisher access blocked', sev: 'Low' },
      { text: 'Housekeeping — obstructed walkway', sev: 'Low' },
    ],
    loc: ['CHPP', 'Fuel Bay', 'Store Yard'],
  },
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]

export function safetyDay(date, scope) {
  const rng = mulberry(hash(`${dayKey(date)}|${scope.key}|safe`) ^ 0x5a1e)
  const bad = rng() < 0.18
  const totalChecks = Math.round((130 + rng() * 70) * (0.55 + scope.factor * 0.9))
  const cats = SAFE_CATS.map(c => {
    const checks = Math.max(1, Math.round(totalChecks * CHECK_SHARE[c] * (0.85 + rng() * 0.3)))
    const rate = VRATE[c] * (bad ? 1.8 + rng() * 0.8 : 0.6 + rng() * 0.9)
    return { cat: c, checks, violations: Math.round(checks * rate) }
  })
  const s1 = 0.5 + (rng() - 0.5) * 0.1

  // one discrete evidence record per violation (capped per category per day) so
  // the evidence log reconciles with the violation counts.
  const events = []
  for (const c of cats) {
    const conf = EVIDENCE[c.cat]
    const n = Math.min(c.violations, 6)
    for (let i = 0; i < n; i++) {
      const item = pick(rng, conf.items)
      const hour = Math.floor(rng() * 24)
      const min = Math.floor(rng() * 60)
      events.push({
        id: `${dayKey(date)}-${c.cat.replace(/\s+/g, '')}-${i}`,
        ts: new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, min).getTime(),
        cat: c.cat,
        severity: item.sev,
        description: item.text,
        location: pick(rng, conf.loc),
        camera: `CV-${String(1 + Math.floor(rng() * 18)).padStart(2, '0')}`,
        confidence: Math.round((0.82 + rng() * 0.16) * 100),
        image: `/vision/${conf.image}`,
        resolved: false,               // open until an action is raised (or curated resolved)
      })
    }
  }

  // Curated demo — TODAY's live board: a single PPE violation that has already
  // been actioned (resolved), and nothing open right now. Past days keep their
  // procedural events so the trend/log still tell a real story.
  if (dayKey(date) === dayKey(new Date())) {
    const conf = EVIDENCE.PPE
    const item = pick(rng, conf.items)
    const today = new Date()
    return {
      date, cats, s1,
      events: [{
        id: `${dayKey(date)}-PPE-curated`,
        ts: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 12).getTime(),
        cat: 'PPE', severity: item.sev, description: item.text,
        location: pick(rng, conf.loc), camera: 'CV-04',
        confidence: 94, image: `/vision/${conf.image}`, resolved: true,
      }],
    }
  }

  return { date, cats, s1, events }
}
