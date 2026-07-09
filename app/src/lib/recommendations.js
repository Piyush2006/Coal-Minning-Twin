// Bruce operational recommendations — derived from the asset's condition (its
// state = the single source of truth). For a Reduction Pot these are the levers a
// potline operator actually pulls: alumina point-feed dosing, AlF₃ addition, and
// anode-effect breaking. Tone tracks urgency (info / warn / critical).

// Shopfloor-level (plant / line) recommendations — aggregated across all pots in
// the given objects map. Card shape: { id, tone, code, title, summary, recommendation, ids? }.
// `ids` = the assets it concerns (so the UI can frame them in 3D).
export function shopfloorRecommendations(objects) {
  const all = Object.values(objects || {})
  const pots = all.filter(o => o.type === 'ReductionPot')
  if (!pots.length) return []
  const names = (arr, n = 4) => arr.map(p => p.name).slice(0, n).join(', ') + (arr.length > n ? '…' : '')
  const ids = (arr) => arr.map(p => p.id)
  const ae  = pots.filter(p => p.state === 'anodeEffect')
  const chg = pots.filter(p => p.state === 'anodeChange')
  const lean = pots.filter(p => p.state === 'anodeEffect' || p.state === 'beamRaise')
  const temps = pots.map(p => +p.parameters?.bathTemp).filter(Number.isFinite)
  const avgT = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null
  const silos = all.filter(o => o.type === 'AluminaSilo' && (o.state === 'low' || o.state === 'empty'))

  const recs = []
  if (ae.length) recs.push({
    id: 'ae', tone: 'critical', code: 'AE-01',
    title: `Anode effect on ${ae.length} cell${ae.length > 1 ? 's' : ''}`,
    summary: `${names(ae)} ${ae.length > 1 ? 'are' : 'is'} developing an anode effect — cell voltage spiking and feed disrupted.`,
    recommendation: 'Issue the Anode Effect Breaking command across the affected cells and confirm alumina feed resumes.',
    ids: ids(ae),
  })
  recs.push({
    id: 'alumina', tone: lean.length ? 'warn' : 'info', code: 'AL-01',
    title: 'Alumina flow rate — point-feed hopper',
    summary: `Holding 2–3 % bath alumina across the line${lean.length ? `; ${lean.length} cell${lean.length > 1 ? 's are' : ' is'} running lean` : ''}.`,
    recommendation: `Raise hopper alumina dosing ≈ 4 % on the lean cells to avoid sludging and anode effects.`,
    ids: ids(lean),
  })
  recs.push({
    id: 'alf3', tone: 'info', code: 'AF-01',
    title: 'Aluminium trifluoride (AlF₃) flow rate',
    summary: avgT ? `Plant average bath temperature ${avgT} °C.` : `Bath ratio drifting across the line.`,
    recommendation: 'Trim the AlF₃ addition rate to hold the 955–965 °C band and target bath ratio.',
    ids: [],
  })
  if (chg.length) recs.push({
    id: 'chg', tone: 'warn', code: 'AC-01',
    title: `${chg.length} pot${chg.length > 1 ? 's' : ''} due anode change`,
    summary: `${names(chg)} ${chg.length > 1 ? 'are' : 'is'} at end of anode life.`,
    recommendation: 'Sequence the Pot Tending Machine to change anodes on the flagged cells.',
    ids: ids(chg),
  })
  if (silos.length) recs.push({
    id: 'silo', tone: 'warn', code: 'AS-01',
    title: `${silos.length} alumina silo${silos.length > 1 ? 's' : ''} low`,
    summary: `${names(silos)} running low.`,
    recommendation: 'Schedule a refill to protect feed continuity to the point-feed hoppers.',
    ids: ids(silos),
  })
  return recs
}

// Plant insights — quick observed metrics for the "Insights" tab.
export function shopfloorInsights(objects) {
  const all = Object.values(objects || {})
  const pots = all.filter(o => o.type === 'ReductionPot')
  if (!pots.length) return []
  const sev = (p) => (p.state === 'anodeEffect' || p.state === 'offline')
  const temps = pots.map(p => +p.parameters?.bathTemp).filter(Number.isFinite)
  const avgT = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null
  const volts = pots.map(p => +p.parameters?.voltage).filter(Number.isFinite)
  const avgV = volts.length ? (volts.reduce((a, b) => a + b, 0) / volts.length).toFixed(2) : null
  return [
    { label: 'Cells online', value: `${pots.filter(p => !sev(p)).length}/${pots.length}` },
    { label: 'Anode effects active', value: String(pots.filter(p => p.state === 'anodeEffect').length) },
    { label: 'Pots due anode change', value: String(pots.filter(p => p.state === 'anodeChange').length) },
    { label: 'Avg bath temperature', value: avgT != null ? `${avgT} °C` : '—' },
    { label: 'Avg pot voltage', value: avgV != null ? `${avgV} V` : '—' },
  ]
}

export function bruceRecommendations(obj) {
  if (!obj || obj.type !== 'ReductionPot') return []
  const num = parseInt((String(obj.name || '').match(/\d+/) || [])[0] || '1', 10)
  const zone = Math.max(1, Math.ceil(num / 4))
  const ae = obj.state === 'anodeEffect'
  const warn = ae || obj.state === 'beamRaise' || obj.state === 'offline'

  return [
    {
      id: 'alumina', icon: '⛏', tone: 'info',
      title: 'Alumina flow rate — point-feed hopper',
      detail: `Hold bath alumina at 2–3 %. Raise the hopper alumina flow rate ≈ 4 % to keep ${obj.name} from running lean (lean bath drives anode effects).`,
      action: 'Adjust hopper feed',
    },
    {
      id: 'alf3', icon: '⚗', tone: warn ? 'warn' : 'info',
      title: 'Aluminium trifluoride (AlF₃) flow rate',
      detail: `Bath ratio drifting. Trim the AlF₃ addition rate to steer bath temperature back toward the 955–965 °C target.`,
      action: 'Tune AlF₃ flow',
    },
    {
      id: 'ae', tone: ae ? 'critical' : 'warn', icon: '⚡',
      title: `Anode effect ${ae ? 'developing' : 'watch'} — Zone ${zone}`,
      detail: ae
        ? `${obj.name} cell voltage is spiking. Execute the Anode Effect Breaking command to quench the effect and restore normal feed.`
        : `No active anode effect on Zone ${zone}. Keep the Anode Effect Breaking command on standby.`,
      action: 'Anode effect breaking command',
    },
  ]
}
