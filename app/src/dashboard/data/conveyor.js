// Conveyor-belt (CHPP) per-day signals + vision-detected belt anomalies.
// Belt loading & speed are intensive (don't scale with scope). A rough day
// lowers loading and widens speed deviation, and makes anomalies more likely.
import { mulberry, hash, dayKey } from './rng'

export const CONVEYOR = { ratedCapacity: 1200, targetSpeed: 3.5, targetLoading: 85 } // T/hr · m/s · %

// vision anomaly classes → the belt-camera frame shown + baseline severity + daily rate
const ANOMALIES = {
  'Belt Tear':         { image: 'coal_size_analysis.webp', severity: 'Critical', rate: 0.06, loc: 'Main Conveyor' },
  'Foreign Object':    { image: 'lane_monitoring.webp',    severity: 'High',     rate: 0.11, loc: 'Transfer Point 2' },
  'Material Spillage': { image: 'coal_size_analysis.webp', severity: 'Medium',   rate: 0.15, loc: 'Stacker Conveyor' },
  'Misalignment':      { image: 'lane_monitoring.webp',    severity: 'Medium',   rate: 0.13, loc: 'Tail Pulley' },
}

export function conveyorDay(date, scope) {
  const r = mulberry(hash(`${dayKey(date)}|${scope.key}|belt`) ^ 0xBE)
  const bad = r() < 0.16

  const loadingPct = Math.min(99, CONVEYOR.targetLoading * (0.92 + r() * 0.14) - (bad ? 8 : 0))   // ~78–97%
  const actualThroughput = CONVEYOR.ratedCapacity * loadingPct / 100                              // T/hr
  const speedDev = bad ? (r() < 0.5 ? -1 : 1) * (3 + r() * 4) : (r() - 0.5) * 4                    // % from target
  const actualSpeed = CONVEYOR.targetSpeed * (1 + speedDev / 100)

  const events = []
  let i = 0
  for (const [type, cfg] of Object.entries(ANOMALIES)) {
    if (r() < cfg.rate * (bad ? 2.2 : 1)) {
      const hour = Math.floor(r() * 24), min = Math.floor(r() * 60)
      events.push({
        id: `${dayKey(date)}-belt-${i++}`,
        ts: new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, min).getTime(),
        type, severity: cfg.severity, location: cfg.loc,
        camera: `CV-${String(1 + Math.floor(r() * 8)).padStart(2, '0')}`,
        confidence: Math.round((0.84 + r() * 0.14) * 100),
        image: `/vision/${cfg.image}`,
      })
    }
  }

  return { loadingPct, actualThroughput, actualSpeed, speedDev, events }
}
