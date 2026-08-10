// Predict view — asks the Bruce agent to forecast a new borehole's time / diesel
// / cost from the historical per-rock rates + the planned column. Falls back to
// the deterministic local estimate when the agent is unavailable, so Predict
// always renders. Reuses the stateless chat client.
import { bruceChat } from './bruceClient'
import { predictLocal } from '../calc/depth'
import { ROCKS } from '../data/geology'

function parse(raw) {
  const grab = (s) => { const a = s.indexOf('{'), b = s.lastIndexOf('}'); return a >= 0 && b > a ? s.slice(a, b + 1) : s }
  for (const t of [raw, grab(raw), grab(raw).replace(/,\s*([}\]])/g, '$1')]) {
    try { return JSON.parse(t) } catch { /* next */ }
  }
  return null
}

// Build the predicted depth-vs curve from perLayer hours/diesel (cumulative).
function curveFrom(perLayer) {
  let depth = 0, timeH = 0, diesel = 0
  const curve = [{ depth: 0, timeH: 0, diesel: 0 }]
  for (const l of perLayer) {
    depth = Math.round((depth + (l.thicknessM || 0)) * 10) / 10
    timeH = Math.round((timeH + (l.hours || 0)) * 100) / 100
    diesel = Math.round(diesel + (l.diesel || 0))
    curve.push({ depth, timeH, diesel })
  }
  return curve
}

export async function predictWithBruce(baselines, plannedLayers, signal) {
  const layers = plannedLayers.filter(l => l.rock && l.thickness > 0)
  if (!layers.length) return predictLocal(plannedLayers, baselines)

  const rateTable = Object.entries(baselines)
    .filter(([, v]) => v)
    .map(([rock, v]) => `${ROCKS[rock]?.name || rock}: ROP ${v.rop} m/h, fuel ${v.fuelPerM} L/m, cost ₹${v.costPerM}/m`)
    .join('\n')
  const planned = layers.map(l => `${ROCKS[l.rock]?.name || l.rock}: ${l.thickness} m`).join('\n')

  const message =
`PREDICT MODE — output ONLY JSON, no markdown, no preamble. Forecast the drilling of a planned borehole from the historical per-rock-type rates. Harder rock (basalt, limestone) drills slower, burns more diesel and costs more per metre; keep the forecast consistent with the historical rates.

HISTORICAL RATES (averaged across drilled holes):
${rateTable}

PLANNED COLUMN (top to bottom):
${planned}

Return exactly this shape:
{"perLayer":[{"rock":"<name>","thicknessM":<n>,"hours":<n>,"diesel":<n>,"costRs":<n>}],
 "totals":{"depthM":<n>,"hours":<n>,"diesel":<n>,"costRs":<n>,"rop":<n>,"fuelIntensity":<n>},
 "rationale":"<=18 words on the main time/fuel driver"}`

  try {
    const { text } = await bruceChat({ message, sessionId: null, signal })
    const j = parse(text)
    if (!j || !j.totals || !Array.isArray(j.perLayer)) throw new Error('unparseable')
    return { source: 'bruce', perLayer: j.perLayer, totals: j.totals, curve: curveFrom(j.perLayer), rationale: j.rationale || '' }
  } catch {
    return predictLocal(plannedLayers, baselines)   // graceful fallback
  }
}
