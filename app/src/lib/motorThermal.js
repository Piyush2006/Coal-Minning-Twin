// Load-aware drive-motor thermal model (CV-01 story; reusable per drive).
// Physics shape, not precision: steady-state expected temperature is ambient +
// no-load rise + load-proportional rise; the actual winding temperature follows
// it with first-order thermal inertia; a cooling-path degradation RESIDUAL adds
// on top and is the thing that drifts.
//
// The key demanded behaviour: during a starvation window (load → 0) the
// ABSOLUTE temperature falls toward the no-load expectation while the RESIDUAL
// keeps climbing at its drift rate — which is precisely what rules load out as
// the cause. The L2 measurement (actual − expected(load)) stays clean.
//
// Used by the fixture recorder now; the live sim adopts the same module for the
// plane-unification work (Step-4 gate).

export function createMotorThermal({ ambient = 34, noLoadRise = 13, loadRise = 21, tauSec = 1500, i0 = 38, i1 = 128 } = {}) {
  let temp = null
  return {
    expected(loadFrac) { return ambient + noLoadRise + loadRise * clamp01(loadFrac) },
    /** step the motor by dt seconds at loadFrac (0..1) with degradation residual (°C) */
    step(loadFrac, residual, dt) {
      const target = this.expected(loadFrac) + residual
      if (temp == null) temp = target
      temp += (target - temp) * (1 - Math.exp(-dt / tauSec))
      const current = (i0 + i1 * clamp01(loadFrac)) * (1 + residual * 0.006)
      return {
        temp: round1(temp),
        current: round1(current),
        expected: round1(this.expected(loadFrac)),
        residualMeasured: round1(temp - this.expected(loadFrac)),   // the L2 companion
      }
    },
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const round1 = (v) => Math.round(v * 10) / 10
