// Safety observations — per-day checks and violations by category (PPE /
// Restricted Area / Vehicle Safety / Other). More observations on busier
// operations (scope factor); more violations on rough days — so a bad day both
// dents production and lowers safety compliance.
import { mulberry, hash, dayKey } from './rng'

export const SAFE_CATS = ['PPE', 'Restricted Area', 'Vehicle Safety', 'Other']
const CHECK_SHARE = { 'PPE': 0.4, 'Restricted Area': 0.2, 'Vehicle Safety': 0.3, 'Other': 0.1 }
const VRATE = { 'PPE': 0.035, 'Restricted Area': 0.02, 'Vehicle Safety': 0.03, 'Other': 0.015 }

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
  return { date, cats, s1 }
}
