// Predictive Maintenance — an ACTION list (not a KPI, no PdM score). Across all
// assets: current sensors vs configured thresholds → Warning/Critical alerts;
// multiple abnormal signals are grouped into one diagnosed fault with evidence
// and a recommendation. Counts + fault types drive the filters.
import { hash } from '../data/rng'
import { UNITS } from '../data/equipment'
import { filterAssets, assetCondition } from '../data/assets'

const SEV_ORDER = { Critical: 0, Warning: 1, Normal: 2 }

export function buildPdm({ range, mineId, areaId, equipTypeId, settings }) {
  const units = filterAssets(UNITS, { mineId, areaId, equipTypeId })
  const span = Math.max(1, range.end - range.start)
  const assets = units.map(u => {
    const c = assetCondition(u, settings)
    // detected within the selected window (deterministic) — supports the time filter
    const frac = (hash(u.id + 'det') % 1000) / 1000
    const detectedAt = new Date(range.end.getTime() - frac * Math.min(span, 3 * 86400e3))
    return { ...c, detectedAt }
  })

  const alerts = assets
    .filter(a => a.severity !== 'Normal')
    .sort((a, b) => (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || (a.health - b.health))

  const counts = {
    Critical: assets.filter(a => a.severity === 'Critical').length,
    Warning: assets.filter(a => a.severity === 'Warning').length,
    Normal: assets.filter(a => a.severity === 'Normal').length,
  }
  const faultTypes = [...new Set(alerts.map(a => a.diagnosis?.faultType).filter(Boolean))].sort()
  return { assets, alerts, counts, faultTypes }
}
