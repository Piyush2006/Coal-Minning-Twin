// Formatting + semantic-status helpers shared by every KPI. Status maps to the
// design-sdk semantic palette (positive / normal / warning / critical) so colour
// is only ever used to convey state.
export const NUM = { fontVariantNumeric: 'tabular-nums' }

export const fmt = (n, dp = 0) => {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
export const fmtSigned = (n, dp = 1) => `${n >= 0 ? '+' : ''}${fmt(n, dp)}`

// design-sdk token bundles per status
export const STATUS = {
  positive: { text: 'var(--text-positive-default)', fill: 'var(--background-positive-default)', badge: 'Positive', label: 'Above target' },
  normal:   { text: 'var(--text-gray-primary)', fill: 'var(--background-info-default)', badge: 'Neutral', label: 'On target' },
  warning:  { text: 'var(--text-warning-default)', fill: 'var(--background-warning-default)', badge: 'Notice', label: 'Watch' },
  critical: { text: 'var(--text-error-default)', fill: 'var(--background-error-default)', badge: 'Negative', label: 'Off target' },
}

// Compare an actual to a target and classify. `goodIfHigh` flips direction for
// metrics where lower is better (cost/ton, energy/ton, fuel/ton). `band` is the
// on-target tolerance in %.
export function metric(actual, target, { goodIfHigh = true, band = 3 } = {}) {
  const variance = target ? ((actual - target) / target) * 100 : 0
  const signed = goodIfHigh ? variance : -variance   // >0 means better than target
  let status = 'normal'
  if (signed >= 2) status = 'positive'
  else if (signed >= -band) status = 'normal'
  else if (signed >= -2 * band) status = 'warning'
  else status = 'critical'
  return { actual, target, variance, status, goodIfHigh }
}

// achievement % → status band (100%+ positive, ≥95 normal, ≥88 warning, else critical)
export function achievementStatus(pct) {
  if (pct >= 100) return 'positive'
  if (pct >= 95) return 'normal'
  if (pct >= 88) return 'warning'
  return 'critical'
}

// coal recovery % → status band. No target (the site just maximises recovery);
// colour reflects absolute recovery quality, higher is better.
export function recoveryStatus(pct) {
  if (pct >= 85) return 'positive'
  if (pct >= 78) return 'normal'
  if (pct >= 70) return 'warning'
  return 'critical'
}

// utilisation % → status band
export function utilStatus(pct) {
  if (pct >= 85) return 'positive'
  if (pct >= 72) return 'normal'
  if (pct >= 58) return 'warning'
  return 'critical'
}
