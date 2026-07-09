// ─────────────────────────────────────────────────────────────────────────────
// KPI registry — declarative aggregate metrics for the Overview dashboard. The
// reusable "what needs to be visible" configurator item: each KPI either
// aggregates a telemetry parameter across all assets of a type, or computes a
// derived/special value. KPIs whose assetType isn't present auto-HIDE, so the
// same registry generalises to any future twin.
//
//   def = { key, label, unit, digits?, assetType?, parameter?, agg?, compute?(assets, all) }
// ─────────────────────────────────────────────────────────────────────────────

import { severityOf } from './stateSchemas'

const sum = (arr) => arr.reduce((a, b) => a + b, 0)
const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0)

function agg(kind, arr) {
  if (!arr.length) return 0
  switch (kind) {
    case 'sum':   return sum(arr)
    case 'avg':   return avg(arr)
    case 'min':   return Math.min(...arr)
    case 'max':   return Math.max(...arr)
    case 'count': return arr.length
    default:      return 0
  }
}

export const KPI_DEFS = [
  // ── Aluminium potline (auto-hide when no ReductionPot present) ──
  { key: 'production', label: 'Production', unit: 't/day', digits: 1, assetType: 'ReductionPot',
    // ~ Σ(line current kA · current efficiency) scaled to a believable daily tonnage
    compute: (pots) => sum(pots.map(o => (o.parameters?.current ?? 0) * ((o.parameters?.currentEff ?? 0) / 100) * 0.0072)) },
  { key: 'avgVoltage', label: 'Avg Pot Voltage', unit: 'V', digits: 2, assetType: 'ReductionPot', parameter: 'voltage', agg: 'avg' },
  { key: 'avgCE', label: 'Current Efficiency', unit: '%', digits: 1, assetType: 'ReductionPot', parameter: 'currentEff', agg: 'avg' },
  { key: 'specificEnergy', label: 'Specific Energy', unit: 'kWh/kg', digits: 1, assetType: 'ReductionPot',
    compute: (pots) => { const ce = avg(pots.map(o => o.parameters?.currentEff ?? 0)) / 100
      return ce ? (avg(pots.map(o => o.parameters?.voltage ?? 0)) * 2.98) / ce : 0 } },
  { key: 'online', label: 'Pots Online', unit: '', digits: 0, assetType: 'ReductionPot',
    compute: (pots) => pots.filter(o => severityOf('ReductionPot', o.state) !== 'down').length },
  { key: 'anodeEffects', label: 'Anode Effects', unit: '', digits: 0, assetType: 'ReductionPot',
    compute: (pots) => pots.filter(o => o.state === 'anodeEffect').length },
]

// Compute a set of AUTHOR-DECLARED kpi defs (e.g. on a group/line) over a set of
// objects. def = { key,label,unit,assetType?,parameter,agg,digits?,compute? }.
export function computeGroupKPIs(defs, objects) {
  const all = Object.values(objects)
  const out = []
  for (const def of (defs || [])) {
    const assets = def.assetType ? all.filter(o => o.type === def.assetType) : all
    const value = def.compute
      ? def.compute(assets, all)
      : agg(def.agg || 'avg', assets.map(o => +(o.parameters?.[def.parameter] ?? 0)).filter(v => !Number.isNaN(v)))
    out.push({ key: def.key, label: def.label, unit: def.unit ?? '', digits: def.digits ?? 0, value })
  }
  return out
}

export function computeKPIs(objects) {
  const all = Object.values(objects)
  const byType = {}
  for (const o of all) (byType[o.type] ??= []).push(o)

  const out = []
  for (const def of KPI_DEFS) {
    const assets = def.assetType ? (byType[def.assetType] ?? []) : all
    if (def.assetType && assets.length === 0) continue            // auto-hide
    const value = def.compute
      ? def.compute(assets, all)
      : agg(def.agg, assets.map(o => +(o.parameters?.[def.parameter] ?? 0)).filter(v => !Number.isNaN(v)))
    out.push({ key: def.key, label: def.label, unit: def.unit, digits: def.digits ?? 0, value })
  }
  return out
}
