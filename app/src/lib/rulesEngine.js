// Pure visual-rules engine. No React, no three. Evaluates each asset's rules
// against its parameters (and optionally another asset's parameter) and returns
// the color of the first matching rule → drives the 3D glow.

import { severityOf } from './stateSchemas'

// Automatic glow by state severity, so any machine "in problem" is clearly
// differentiated even without an explicit rule. Red = down, amber = warn.
const SEVERITY_GLOW = { down: '#ff3b30', warn: '#ff8c1a' }

const OPS = {
  '>':  (a, b) => a >  b,
  '>=': (a, b) => a >= b,
  '<':  (a, b) => a <  b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
}

function resolveCompareValue(rule, objectsById) {
  if (rule.compareMode === 'asset') {
    return objectsById[rule.refAssetId]?.parameters?.[rule.refParameter]
  }
  return rule.value
}

// numeric-aware coercion: compare as numbers when both look numeric, else as strings
function coerce(x) {
  if (typeof x === 'number') return x
  if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) return Number(x)
  return x
}

// Returns the color of the first ENABLED rule whose condition holds, else null.
export function evaluateRules(obj, objectsById) {
  const rules = obj?.rules ?? []
  for (const r of rules) {
    if (!r.enabled) continue
    const op = OPS[r.operator]
    if (!op) continue
    const lhs = obj.parameters?.[r.parameter]
    const rhs = resolveCompareValue(r, objectsById)
    if (lhs == null || rhs == null) continue
    if (op(coerce(lhs), coerce(rhs))) return r.color
  }
  return null
}

// Per-object glow-color map. Pure over objects → memoize on `objects`.
// An explicit matching rule wins; otherwise a machine in a warn/down state glows
// automatically (amber/red) so problems are obvious across the whole scene.
export function computeGlowMap(objects) {
  const map = {}
  for (const id in objects) {
    const o = objects[id]
    const color = evaluateRules(o, objects)
    if (color) { map[id] = color; continue }
    const glow = SEVERITY_GLOW[severityOf(o.type, o.state)]
    if (glow) map[id] = glow
  }
  return map
}
