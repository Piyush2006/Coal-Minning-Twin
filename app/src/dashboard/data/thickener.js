// Thickener (CHPP tailings) per-day signals — underflow slurry / solids masses
// and overflow turbidity. A rough day dilutes the underflow (lower density) and
// clouds the overflow (higher turbidity), coherently.
import { mulberry, hash, dayKey } from './rng'

export const THICKENER = { targetDensity: 60, targetTurbidity: 30 } // % solids · NTU

export function thickenerDay(date, scope) {
  const r = mulberry(hash(`${dayKey(date)}|${scope.key}|thick`) ^ 0x7C)
  const bad = r() < 0.16

  const slurryMass = 800 + r() * 240                                            // T underflow slurry
  const solidFrac = THICKENER.targetDensity / 100 * (0.95 + r() * 0.1) - (bad ? 0.035 : 0)
  const solidsMass = slurryMass * Math.max(0.4, solidFrac)                      // T solids in the underflow

  const turbidity = THICKENER.targetTurbidity * (0.9 + r() * 0.35) + (bad ? 16 : 0)  // NTU overflow

  return { slurryMass, solidsMass, turbidity }
}
