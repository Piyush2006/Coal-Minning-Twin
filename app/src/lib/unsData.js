// ─────────────────────────────────────────────────────────────────────────────
// UNS live VALUES — the working resolve path (resolveAndCompute is a dead end for
// this UNS: wrong host on connector, cross-env 401 on staging). Instead, a bound
// topic PATH resolves through the browser (uns-backend-server) to a node's
// metadata → (legacyDevID, legacySensorID) → the connector device API, which is
// CORS-open so it's callable straight from the browser.
//
//   PUT connector/api/account/deviceData/getLastDPsofDevicesAndSensorProcessed
//   { devices:[{devID,sensor}] } → { data:[{devID,sensor,time,value,unit}] }
// ─────────────────────────────────────────────────────────────────────────────

const pairKey = (devID, sensor) => `${devID}::${sensor}`

// Latest values for [{ devID, sensor }] → { "devID::sensor": { value, time, unit } }.
export async function getLastValues({ token, base = 'https://connector.iosense.io/api' }, pairs) {
  const t = (token || '').trim()
  if (!t || !pairs?.length) return {}
  const bearer = /^bearer\s/i.test(t) ? t : `Bearer ${t}`
  const res = await fetch(`${base.replace(/\/$/, '')}/account/deviceData/getLastDPsofDevicesAndSensorProcessed`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: bearer },
    body: JSON.stringify({ devices: pairs.map(p => ({ devID: p.devID, sensor: p.sensor })) }),
  })
  if (res.status === 401) { const e = new Error('UNS session expired'); e.code = 'auth'; throw e }
  const j = await res.json().catch(() => null)
  if (!res.ok) { const e = new Error(j?.message || `device ${res.status}`); e.code = 'http'; throw e }
  const out = {}
  for (const d of (j?.data || [])) out[pairKey(d.devID, d.sensor)] = { value: d.value, time: d.time, unit: d.unit }
  return out
}

export { pairKey }
