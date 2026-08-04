// Asset Health Index — a composite over each asset's class parameters, ranked
// by risk = (100 − AHI) × criticality. Deliberately transparent: every score
// decomposes into named contributing factors (shown as bars on the screen), so
// the number is explainable, not a black box. Predictive horizons carry a
// maturity badge and never surface a raw RUL above L4.
export const CRIT = {
  'cv-01': 1.0, 'crusher-1': 1.0, 'chpp-1': 0.85, 'exc-coal-1': 0.9, 'exc-ob-1': 0.7,
  'screen-1': 0.7, 'stacker-1': 0.6, 'loadout-1': 0.7, 'shiploader-1': 0.7, 'loader-1': 0.5,
  'truck-1': 0.5, 'truck-2': 0.5, 'truck-3': 0.5, 'truck-4': 0.5, 'truck-5': 0.5, 'truck-6': 0.5, 'truck-7': 0.5, 'truck-8': 0.5,
}
export const ASSET_LABEL = {
  'cv-01': 'CV-01 Overland Conveyor', 'crusher-1': 'CR-01 Primary Crusher', 'chpp-1': 'CHPP DMC Module',
  'exc-coal-1': 'EX-02 Coal Shovel', 'exc-ob-1': 'EX-01 OB Shovel', 'screen-1': 'SC-01 Screen',
  'stacker-1': 'SR-01 Stacker-Reclaimer', 'loadout-1': 'TLO-01 Rail Load-out', 'shiploader-1': 'SL-01 Shiploader', 'loader-1': 'WL-01 Loader',
  'truck-1': 'HT-01', 'truck-2': 'HT-02', 'truck-3': 'HT-03', 'truck-4': 'HT-04', 'truck-5': 'HT-05', 'truck-6': 'HT-06', 'truck-7': 'HT-07', 'truck-8': 'HT-08',
}

// factor = { name, sev 0..1 (1 = worst), weight }. band maps a value into 0..1.
const band = (v, good, bad) => Math.max(0, Math.min(1, (v - good) / (bad - good)))
const inv = (v, good, bad) => Math.max(0, Math.min(1, (good - v) / (good - bad)))

export function cvExpectedTemp(loadPct) { return 47 + 21 * (Math.max(0, Math.min(100, loadPct)) / 100) }

function factorsFor(id, p) {
  if (id === 'cv-01') {
    const resid = (p.motorTemp ?? 0) - cvExpectedTemp(p.load ?? 0)
    return [
      { name: 'Thermal residual', sev: band(resid, 2, 12), weight: 0.6, detail: `+${resid.toFixed(1)} °C vs load-expected` },
      { name: 'Drive vibration', sev: band(p.vibration ?? 2, 3.5, 9), weight: 0.25, detail: `${(p.vibration ?? 2).toFixed(1)} mm/s (flat)` },
      { name: 'Motor current', sev: band(p.motorCurrent ?? 142, 160, 210), weight: 0.15, detail: `${Math.round(p.motorCurrent ?? 142)} A` },
    ]
  }
  if (id === 'crusher-1') return [
    { name: 'Bearing temp', sev: band(p.bearingTemp ?? 70, 85, 110), weight: 0.4, detail: `${Math.round(p.bearingTemp ?? 70)} °C` },
    { name: 'Vibration', sev: band(p.vibration ?? 4, 6, 10), weight: 0.35, detail: `${(p.vibration ?? 4).toFixed(1)} mm/s` },
    { name: 'RUL', sev: inv(p.rulHours ?? 600, 400, 120), weight: 0.25, detail: `${Math.round(p.rulHours ?? 600)} h` },
  ]
  if (id === 'chpp-1') return [
    { name: 'Bearing temp', sev: band(p.bearingTemp ?? 68, 85, 105), weight: 0.4, detail: `${Math.round(p.bearingTemp ?? 68)} °C` },
    { name: 'Availability', sev: inv(p.availability ?? 96, 92, 70), weight: 0.35, detail: `${Math.round(p.availability ?? 96)} %` },
    { name: 'Media loss', sev: band(p.magnetiteLoss ?? 1, 2, 5), weight: 0.25, detail: `${(p.magnetiteLoss ?? 1).toFixed(1)} g/t` },
  ]
  if (id.startsWith('truck')) return [
    { name: 'Engine health', sev: inv(p.engineHealth ?? 85, 75, 40), weight: 0.35, detail: `${Math.round(p.engineHealth ?? 85)} %` },
    { name: 'Hydraulic health', sev: inv(p.hydraulicHealth ?? 88, 75, 40), weight: 0.3, detail: `${Math.round(p.hydraulicHealth ?? 88)} %` },
    { name: 'RUL', sev: inv(p.rulHours ?? 500, 350, 100), weight: 0.2, detail: `${Math.round(p.rulHours ?? 500)} h` },
    { name: 'Tyre temp', sev: band(p.tyreTemp ?? 75, 82, 95), weight: 0.15, detail: `${Math.round(p.tyreTemp ?? 75)} °C` },
  ]
  return [{ name: 'General', sev: 0.12, weight: 1, detail: 'nominal' }]
}

export function assetHealth(id, params = {}) {
  const factors = factorsFor(id, params)
  const wsum = factors.reduce((a, f) => a + f.weight, 0) || 1
  const risk = factors.reduce((a, f) => a + f.sev * f.weight, 0) / wsum   // 0..1
  const ahi = Math.round((1 - risk) * 100)
  return { id, ahi, factors, crit: CRIT[id] ?? 0.5, riskScore: risk * (CRIT[id] ?? 0.5) }
}

export function rankAssets(snapshot) {
  return Object.keys(CRIT)
    .filter(id => snapshot[id])
    .map(id => assetHealth(id, snapshot[id].parameters))
    .sort((a, b) => b.riskScore - a.riskScore)
}
